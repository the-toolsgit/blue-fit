// MHR body model (Meta "Momentum Human Rig", Apache-2.0) — framework-free.
// Reads the compact binary made by scripts/convert-mhr.py and rebuilds the
// body: rest shape from the 20 body identity coefficients, skeleton from the
// 204 model parameters, linear blend skinning. Units: cm, y up. A line-by-line
// port of MHR's own PyTorch rig (mhr/_torch_rig.py, pose correctives skipped);
// mhr.test.ts checks it against vertices from that code.

export const BODY_SHAPES = 20;
export const MODEL_PARAMS = 204;
/** Vertex part labels (from each vertex's strongest skinning joint). */
export const PART_LABELS = ["torso", "armL", "armR", "handL", "handR", "legL", "legR", "neck", "head"] as const;
export type PartLabel = (typeof PART_LABELS)[number];

type Dtype = "float32" | "uint16" | "uint32" | "uint8" | "int16";
type Arr = Float32Array | Uint16Array | Uint32Array | Uint8Array | Int16Array;

export interface MhrModel {
  lod: number;
  vertexCount: number;
  jointCount: number;
  jointNames: string[];
  paramNames: string[];
  baseShape: Float32Array; // V*3
  bodyShapes: Float32Array; // 20*V*3
  faces: Uint16Array | Uint32Array; // F*3
  skinIndices: Uint8Array; // V*8
  skinWeights: Float32Array; // V*8
  partLabels: Uint8Array; // V
  jointOffsets: Float32Array; // J*3
  jointPrerotations: Float32Array; // J*4 (x,y,z,w)
  jointParents: Int16Array;
  inverseBindPose: Float32Array; // J*8 (t3, q4, s1)
  fkChild: Int16Array;
  fkParent: Int16Array;
  fkSizes: number[];
  ptRows: Int16Array;
  ptCols: Int16Array;
  ptVals: Float32Array;
  limitMin: Float32Array;
  limitMax: Float32Array;
  limitIndex: Int16Array;
}

const MAGIC = "BFMHR1";

export function parseMhr(buf: ArrayBuffer): MhrModel {
  const bytes = new Uint8Array(buf);
  if (String.fromCharCode(...bytes.subarray(0, 6)) !== MAGIC) throw new Error("Not an MHR file");
  const headLen = new DataView(buf).getUint32(8, true);
  const head = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headLen)));
  const base = 12 + headLen;
  const get = <T extends Arr>(name: string): T => {
    const a = head.arrays.find((x: { name: string }) => x.name === name);
    if (!a) throw new Error(`MHR file is missing ${name}`);
    const n = (a.shape as number[]).reduce((p, c) => p * c, 1);
    const off = base + a.offset;
    const C: Record<Dtype, new (b: ArrayBuffer, o: number, n: number) => Arr> = {
      float32: Float32Array, uint16: Uint16Array, uint32: Uint32Array, uint8: Uint8Array, int16: Int16Array,
    };
    return new C[a.dtype as Dtype](buf.slice(off, off + n * C[a.dtype as Dtype].prototype.BYTES_PER_ELEMENT), 0, n) as T;
  };
  const fk = get<Int16Array>("fk_indices");
  const fkLen = fk.length / 2;
  const baseShape = get<Float32Array>("base_shape");
  const jointOffsets = get<Float32Array>("joint_offsets");
  return {
    lod: head.lod,
    vertexCount: baseShape.length / 3,
    jointCount: jointOffsets.length / 3,
    jointNames: head.jointNames,
    paramNames: head.paramNames,
    baseShape,
    bodyShapes: get("body_shapes"),
    faces: get("faces"),
    skinIndices: get("skin_indices"),
    skinWeights: get("skin_weights"),
    partLabels: get("part_labels"),
    jointOffsets,
    jointPrerotations: get("joint_prerotations"),
    jointParents: get("joint_parents"),
    inverseBindPose: get("inverse_bind_pose"),
    fkChild: fk.slice(0, fkLen),
    fkParent: fk.slice(fkLen),
    fkSizes: Array.from(get<Int16Array>("fk_sizes")),
    ptRows: get("pt_rows"),
    ptCols: get("pt_cols"),
    ptVals: get("pt_vals"),
    limitMin: get("limit_min"),
    limitMax: get("limit_max"),
    limitIndex: get("limit_index"),
  };
}

// ── quaternion helpers (x, y, z, w), on plain arrays at an offset ──
function qmul(a: ArrayLike<number>, ao: number, b: ArrayLike<number>, bo: number, out: Float64Array, oo: number) {
  const x1 = a[ao], y1 = a[ao + 1], z1 = a[ao + 2], w1 = a[ao + 3];
  const x2 = b[bo], y2 = b[bo + 1], z2 = b[bo + 2], w2 = b[bo + 3];
  out[oo] = w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2;
  out[oo + 1] = w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2;
  out[oo + 2] = w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2;
  out[oo + 3] = w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2;
}
function normalize4(q: Float64Array, o: number) {
  const n = Math.hypot(q[o], q[o + 1], q[o + 2], q[o + 3]) || 1;
  q[o] /= n; q[o + 1] /= n; q[o + 2] /= n; q[o + 3] /= n;
}
/** Rotate (vx,vy,vz) by unit quaternion q at offset o; writes into out[0..2]. */
function rotate(q: ArrayLike<number>, o: number, vx: number, vy: number, vz: number, out: Float64Array) {
  const ax = q[o], ay = q[o + 1], az = q[o + 2], s = q[o + 3];
  const cx = ay * vz - az * vy, cy = az * vx - ax * vz, cz = ax * vy - ay * vx;
  const ccx = ay * cz - az * cy, ccy = az * cx - ax * cz, ccz = ax * cy - ay * cx;
  out[0] = vx + 2 * (s * cx + ccx);
  out[1] = vy + 2 * (s * cy + ccy);
  out[2] = vz + 2 * (s * cz + ccz);
}

/** States are 8 numbers per joint: t(3), q(4), s(1). out = first ∘ second. */
function stateMul(a: Float64Array, ao: number, b: ArrayLike<number>, bo: number, out: Float64Array, oo: number, tmp: Float64Array) {
  const qa = new Float64Array([a[ao + 3], a[ao + 4], a[ao + 5], a[ao + 6]]);
  normalize4(qa, 0);
  const qb = new Float64Array([b[bo + 3], b[bo + 4], b[bo + 5], b[bo + 6]]);
  normalize4(qb, 0);
  rotate(qa, 0, b[bo], b[bo + 1], b[bo + 2], tmp);
  const sa = a[ao + 7];
  const t0 = a[ao] + sa * tmp[0], t1 = a[ao + 1] + sa * tmp[1], t2 = a[ao + 2] + sa * tmp[2];
  qmul(qa, 0, qb, 0, out, oo + 3);
  out[oo] = t0; out[oo + 1] = t1; out[oo + 2] = t2;
  out[oo + 7] = sa * b[bo + 7];
}

/** Rest shape (before posing) for the 20 body coefficients. */
export function restShape(m: MhrModel, body: ArrayLike<number>): Float32Array {
  const V3 = m.vertexCount * 3;
  const out = new Float32Array(m.baseShape);
  for (let k = 0; k < BODY_SHAPES; k++) {
    const c = body[k] ?? 0;
    if (!c) continue;
    const o = k * V3;
    for (let i = 0; i < V3; i++) out[i] += m.bodyShapes[o + i] * c;
  }
  return out;
}

/** World state of every joint (J*8: t, q, s) for the 204 model parameters. */
export function skeletonState(m: MhrModel, params: ArrayLike<number>): Float64Array {
  const J = m.jointCount;
  const jp = new Float64Array(J * 7);
  for (let i = 0; i < m.ptVals.length; i++) jp[m.ptRows[i]] += m.ptVals[i] * (params[m.ptCols[i]] ?? 0);
  const state = new Float64Array(J * 8);
  const e = new Float64Array(4);
  for (let j = 0; j < J; j++) {
    const p = j * 7, s = j * 8;
    state[s] = jp[p] + m.jointOffsets[j * 3];
    state[s + 1] = jp[p + 1] + m.jointOffsets[j * 3 + 1];
    state[s + 2] = jp[p + 2] + m.jointOffsets[j * 3 + 2];
    // euler xyz → quaternion (same formula as MHR)
    const [roll, pitch, yaw] = [jp[p + 3], jp[p + 4], jp[p + 5]];
    const cy = Math.cos(yaw * 0.5), sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5), sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5), sr = Math.sin(roll * 0.5);
    e[0] = sr * cp * cy - cr * sp * sy;
    e[1] = cr * sp * cy + sr * cp * sy;
    e[2] = cr * cp * sy - sr * sp * cy;
    e[3] = cr * cp * cy + sr * sp * sy;
    qmul(m.jointPrerotations, j * 4, e, 0, state, s + 3);
    state[s + 7] = Math.exp(0.6931471824645996 * jp[p + 6]);
  }
  // forward kinematics, group by group (a group reads the states from before it)
  const tmp = new Float64Array(3);
  let start = 0;
  for (const size of m.fkSizes) {
    const upd = new Float64Array(size * 8);
    for (let k = 0; k < size; k++) stateMul(state, m.fkParent[start + k] * 8, state, m.fkChild[start + k] * 8, upd, k * 8, tmp);
    for (let k = 0; k < size; k++) state.set(upd.subarray(k * 8, k * 8 + 8), m.fkChild[start + k] * 8);
    start += size;
  }
  return state;
}

/** Posed vertices (V*3, cm) for body coefficients + model parameters. */
export function poseVertices(m: MhrModel, body: ArrayLike<number>, params: ArrayLike<number>): Float32Array {
  const rest = restShape(m, body);
  const state = skeletonState(m, params);
  const J = m.jointCount;
  const js = new Float64Array(J * 8);
  const tmp = new Float64Array(3);
  for (let j = 0; j < J; j++) {
    stateMul(state, j * 8, m.inverseBindPose, j * 8, js, j * 8, tmp);
    normalize4(js, j * 8 + 3);
  }
  const V = m.vertexCount;
  const out = new Float32Array(V * 3);
  const r = new Float64Array(3);
  for (let v = 0; v < V; v++) {
    let x = 0, y = 0, z = 0;
    const px = rest[v * 3], py = rest[v * 3 + 1], pz = rest[v * 3 + 2];
    for (let k = 0; k < 8; k++) {
      const w = m.skinWeights[v * 8 + k];
      if (!(w > 1e-5)) continue;
      const o = m.skinIndices[v * 8 + k] * 8;
      const s = js[o + 7];
      rotate(js, o + 3, s * px, s * py, s * pz, r);
      x += w * (js[o] + r[0]);
      y += w * (js[o + 1] + r[1]);
      z += w * (js[o + 2] + r[2]);
    }
    out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z;
  }
  return out;
}
