// Fitted MHR body → the scanner-neutral BodyGeometry that core/body/measure.ts measures
// (docs/plans/body-scan.md §1, §3.4). Body cuts use torso and leg faces (arms and hands left
// out), limb cuts are perpendicular to each bone, neck cuts along the neck axis.
// Height levels come from the fitted skeleton (MHR joints; see LEVEL_RULES).
import { PART_LABELS, skeletonState, poseVertices, type MhrModel } from "../../../core/body/mhr";
import type { AxisKey, BodyGeometry, LevelKey, LimbPart, Polygon, Section } from "../../../core/body/types";
import type { BodyParams, FitBody } from "./body";

const L = (name: (typeof PART_LABELS)[number]) => PART_LABELS.indexOf(name);
type V3 = [number, number, number];

const AXIS_JOINTS: Record<AxisKey, string> = {
  shoulderL: "l_uparm", shoulderR: "r_uparm", elbowL: "l_lowarm", elbowR: "r_lowarm", wristL: "l_wrist", wristR: "r_wrist",
  hipJointL: "l_upleg", hipJointR: "r_upleg", kneeL: "l_lowleg", kneeR: "r_lowleg", ankleL: "l_talocrural", ankleR: "r_talocrural",
};
const LIMBS: Record<LimbPart, { from: AxisKey; to: AxisKey; label: number }> = {
  upperArmL: { from: "shoulderL", to: "elbowL", label: L("armL") }, upperArmR: { from: "shoulderR", to: "elbowR", label: L("armR") },
  forearmL: { from: "elbowL", to: "wristL", label: L("armL") }, forearmR: { from: "elbowR", to: "wristR", label: L("armR") },
  thighL: { from: "hipJointL", to: "kneeL", label: L("legL") }, thighR: { from: "hipJointR", to: "kneeR", label: L("legR") },
  calfL: { from: "kneeL", to: "ankleL", label: L("legL") }, calfR: { from: "kneeR", to: "ankleR", label: L("legR") },
};

/** Cut the faces whose 3 vertices all carry `labels` with a plane (point p, normal n). Points in mm on (e1, e2). */
export function cut(verts: ArrayLike<number>, faces: ArrayLike<number>, lab: ArrayLike<number>, labels: number[], p: V3, n: V3, e1: V3, e2: V3): Polygon {
  const out: Polygon = [];
  const d = (i: number) => (verts[i * 3] - p[0]) * n[0] + (verts[i * 3 + 1] - p[1]) * n[1] + (verts[i * 3 + 2] - p[2]) * n[2];
  for (let f = 0; f < faces.length; f += 3) {
    const ids = [faces[f], faces[f + 1], faces[f + 2]];
    if (!ids.every((i) => labels.includes(lab[i]))) continue;
    const ds = ids.map(d);
    for (let k = 0; k < 3; k++) {
      const a = ids[k], b = ids[(k + 1) % 3], da = ds[k], db = ds[(k + 1) % 3];
      if ((da < 0) === (db < 0)) continue;
      const t = da / (da - db);
      const x = verts[a * 3] + t * (verts[b * 3] - verts[a * 3]) - p[0];
      const y = verts[a * 3 + 1] + t * (verts[b * 3 + 1] - verts[a * 3 + 1]) - p[1];
      const z = verts[a * 3 + 2] + t * (verts[b * 3 + 2] - verts[a * 3 + 2]) - p[2];
      out.push([Math.round((x * e1[0] + y * e1[1] + z * e1[2]) * 10), Math.round((x * e2[0] + y * e2[1] + z * e2[2]) * 10)]);
    }
  }
  return out;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function basis(n: V3): [V3, V3] {
  const ref: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = norm(cross(ref, n));
  return [e1, cross(n, e1)];
}
function sections(verts: ArrayLike<number>, m: MhrModel, labels: number[], a: V3, b: V3): Section[] {
  const n = norm(sub(b, a));
  const [e1, e2] = basis(n);
  const out: Section[] = [];
  for (let t = 0; t <= len(sub(b, a)); t += 1) {
    const p: V3 = [a[0] + n[0] * t, a[1] + n[1] * t, a[2] + n[2] * t];
    const poly = cut(verts, m.faces, m.partLabels, labels, p, n, e1, e2);
    if (poly.length >= 3) out.push({ tCm: t, polygon: poly });
  }
  return out;
}

/** Front-midline vertices of the mean body nearest to a height: their height on a fitted body follows its surface
 *  (more stable than joint centers, which the outline barely sees). Picked once per model. */
const levelVertexCache = new WeakMap<MhrModel, Record<string, number>>();
function levelVertices(m: MhrModel, fb: FitBody): Record<string, number> {
  const hit = levelVertexCache.get(m);
  if (hit) return hit;
  const params = fb.modelParams({ body: new Array(20).fill(0), pose: new Array(fb.poseIdx.length).fill(0), scales: new Array(fb.scaleIdx.length).fill(0), scale: 1 });
  const v = poseVertices(m, [], params);
  const st = skeletonState(m, params);
  const jy = (n: string) => st[m.jointNames.indexOf(n) * 8 + 1];
  const torso = PART_LABELS.indexOf("torso");
  const pick = (y: number) => {
    let best = -1, score = Infinity;
    for (let i = 0; i < m.vertexCount; i++) {
      if (m.partLabels[i] !== torso || v[i * 3 + 2] < 0) continue; // front half of the torso
      const sc = Math.abs(v[i * 3 + 1] - y) * 3 + Math.abs(v[i * 3]); // on the midline, at the height
      if (sc < score) { score = sc; best = i; }
    }
    return best;
  };
  const r = { lowestRib: pick(jy("c_spine2")), navel: pick(jy("c_spine1")), hipCrest: pick((jy("c_spine0") + jy("c_spine1")) / 2) };
  levelVertexCache.set(m, r);
  return r;
}

/**
 * Height levels from the fitted skeleton (MHR joint names). The waist and hip tapes are searched within these
 * ranges (narrowest / widest), so the levels only need to bracket them. Armpit and crotch come from the mesh.
 * Navel, lowest rib and hip crest are fixed front-midline vertices (picked on the mean body at the c_spine1, c_spine2
 * and c_spine0/1 joint heights; the navel at 105 of 172.5 cm, 0.61 of stature, about where it sits), so they follow
 * the fitted surface. A mesh-based navel finder can replace this later (bump the scanner version).
 */
export function buildGeometry(m: MhrModel, fb: FitBody, fitted: BodyParams, meta: { scannerId: string; scannerVersion: string; viewQuality: number[] }): BodyGeometry {
  // Measured in the standard scan pose: the fitted shape and proportions, without the small posture changes of
  // this scan (a slightly different arm or head angle must not change a tape).
  const p: BodyParams = { ...fitted, pose: fitted.pose.map(() => 0) };
  const params = fb.modelParams(p);
  const raw = poseVertices(m, p.body, params);
  const st = skeletonState(m, params);
  let minY = Infinity;
  for (let i = 1; i < raw.length; i += 3) minY = Math.min(minY, raw[i]);
  const s = p.scale;
  const verts = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 3) { verts[i] = raw[i] * s; verts[i + 1] = (raw[i + 1] - minY) * s; verts[i + 2] = raw[i + 2] * s; }
  const joint = (name: string): V3 => {
    const j = m.jointNames.indexOf(name);
    return [st[j * 8] * s, (st[j * 8 + 1] - minY) * s, st[j * 8 + 2] * s];
  };
  const axes = Object.fromEntries(Object.entries(AXIS_JOINTS).map(([k, j]) => [k, joint(j).map((x) => Math.round(x * 10) / 10)])) as Record<AxisKey, V3>;

  // armpit: lowest torso vertex sharing a face with an arm vertex; crotch: lowest torso vertex near the middle
  const torso = L("torso"), armL = L("armL"), armR = L("armR");
  let armpit = Infinity, crotch = Infinity;
  for (let f = 0; f < m.faces.length; f += 3) {
    const ids = [m.faces[f], m.faces[f + 1], m.faces[f + 2]];
    const labs = ids.map((i) => m.partLabels[i]);
    if (labs.includes(armL) || labs.includes(armR)) for (const i of ids) if (m.partLabels[i] === torso) armpit = Math.min(armpit, verts[i * 3 + 1]);
  }
  for (let i = 0; i < m.vertexCount; i++) if (m.partLabels[i] === torso && Math.abs(verts[i * 3]) < 3 * s) crotch = Math.min(crotch, verts[i * 3 + 1]);
  const y = (j: string) => joint(j)[1];
  const lv = levelVertices(m, fb);
  const vy = (i: number) => verts[i * 3 + 1];
  const levels: Record<LevelKey, number> = {
    neckBase: y("c_neck"), neckTop: y("c_head"), armpit,
    lowestRib: vy(lv.lowestRib), navel: vy(lv.navel), hipCrest: vy(lv.hipCrest),
    buttocksMax: (y("root") + crotch) / 2, crotch, kneeMid: (y("l_lowleg") + y("r_lowleg")) / 2,
  };
  for (const k of Object.keys(levels) as LevelKey[]) levels[k] = Math.round(levels[k] * 10) / 10;

  // body cuts: torso + legs (at buttock height a tape goes around both upper thighs), arms and hands left out
  const torsoSlices = [];
  for (let yy = Math.ceil(crotch); yy <= levels.neckBase; yy++) {
    const poly = cut(verts, m.faces, m.partLabels, [torso, L("legL"), L("legR")], [0, yy, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    if (poly.length >= 3) torsoSlices.push({ yCm: yy, polygon: poly });
  }
  const limbSections = (Object.keys(LIMBS) as LimbPart[]).map((part) => {
    const r = LIMBS[part];
    return { part, sections: sections(verts, m, [r.label], axes[r.from], axes[r.to]) };
  });
  const neckSections = sections(verts, m, [torso, L("neck"), L("head")], joint("c_neck"), joint("c_head"));
  return {
    torsoSlices, limbSections, neckSections, levels, axes,
    shape: { model: "MHR", version: "v1", body: p.body.map((x) => Math.round(x * 1e4) / 1e4), params: fb.modelParams(fitted).map((x) => Math.round(x * 1e4) / 1e4), scale: Math.round(s * 1e5) / 1e5 },
    viewQuality: meta.viewQuality, scannerId: meta.scannerId, scannerVersion: meta.scannerVersion,
  };
}
