// Multi-view silhouette fit (docs/plans/body-scan.md §3.3): one body (shape, posture, proportions,
// size) seen in 12 photos, one camera, each photo with its own turn (yaw) and floor position.
// Levenberg–Marquardt; the residuals per photo are a two-way outline match (model outline → photo
// outline via a distance field, photo outline → nearest model outline point) plus joint landmarks,
// a height term and priors. The outline sets are picked once per iteration and held fixed while the
// Jacobian is taken (finite differences: the body rebuild takes ~1 ms). Coarse to fine: placement
// and camera first, then posture and proportions, then body shape.
import { project, type Cam, type View } from "./camera";
import { cleanMask, edgePoints, iou, rasterize, sample, signedDistance, type Mask } from "./raster";
import { PART_LABELS } from "../../../core/body/mhr";
import { FitBody, POSE_PARAMS, SCALE_PARAMS, zeroParams, type BodyParams } from "./body";

export interface Photo {
  mask: Mask;
  /** 2D landmarks for LANDMARK_JOINTS (u, v pairs; NaN = not seen) */
  landmarks: Float64Array;
  /** Clock hour the user was asked to face (0 = facing the phone … 11) */
  hour: number;
}
/** yawSign: which way the user turned (+1 / −1); left out = tried both, the better fit wins. */
export interface FitInput { photos: Photo[]; heightCm: number; camGuess: Cam; yawSign?: 1 | -1 }
export interface FitResult {
  params: BodyParams; cam: Cam; views: View[];
  /** Per photo: overlap of the fitted body with the photo outline (0–1) and 90th-percentile outline distance (px) */
  iou: number[]; rmsPx: number[];
  iterations: number; ms: number; ok: boolean; reason?: string;
  /** Final cost (for comparing turn directions) */
  cost: number;
}

const W_OUT = 1, W_IN = 1, W_LM = 0.3, W_SHAPE = 2, W_POSE = 4, W_SCALE = 6, W_PITCH = 40;
/** Landmark trust per LANDMARK_JOINTS entry: pose-tracker hips and shoulders aren't joint centers, the head is
 *  between the ears. */
const LM_TRUST = [0.5, 0.5, 0.5, 1, 1, 1, 1, 0.3, 0.3, 1, 1, 1, 1];
const HUBER = 3;
const NB = 20, NP = POSE_PARAMS.length, NS = SCALE_PARAMS.length;

type State = { b: BodyParams; cam: Cam; views: View[] };
const clone = (s: State): State => ({ b: { body: [...s.b.body], pose: [...s.b.pose], scales: [...s.b.scales], scale: s.b.scale }, cam: { ...s.cam }, views: s.views.map((v) => ({ ...v })) });

// Parameter vector: [body 20 | pose | scales | scale (unused: set by the height) | f | camH | pitch | (yaw, tx, tz) × views]
function pack(s: State): number[] {
  return [...s.b.body, ...s.b.pose, ...s.b.scales, s.b.scale, s.cam.f, s.cam.h, s.cam.pitch, ...s.views.flatMap((v) => [v.yaw, v.tx, v.tz])];
}
/** Each photo's turn stays within this of its clock hour: a body seen from the front and from the back has nearly
 *  the same outline, so without a bound a photo can settle at the mirror-image turn. */
const YAW_BOUND = 0.6;
/** Body shape coefficients stay within this (standard deviations of MHR's people): beyond it the mesh folds into
 *  shapes that match an outline's edge without filling it (first real scans). */
const SHAPE_MAX = 3.5;
let yawTargets: number[] = [];
function unpack(x: number[], base: State): State {
  const s = clone(base);
  let k = 0;
  for (let i = 0; i < NB; i++) s.b.body[i] = Math.max(-SHAPE_MAX, Math.min(SHAPE_MAX, x[k++]));
  for (let i = 0; i < NP; i++) s.b.pose[i] = x[k++];
  for (let i = 0; i < NS; i++) s.b.scales[i] = x[k++];
  s.b.scale = x[k++]; s.cam.f = x[k++]; s.cam.h = x[k++]; s.cam.pitch = x[k++];
  s.views.forEach((v, i) => {
    const t = yawTargets[i];
    v.yaw = t == null ? x[k++] : Math.max(t - YAW_BOUND, Math.min(t + YAW_BOUND, x[k++]));
    v.tx = x[k++]; v.tz = x[k++];
  });
  return s;
}
const SHARED = NB + NP + NS + 1; // parameters that need a body rebuild
const VIEW0 = SHARED + 3; // first per-photo parameter

interface ViewData { dt: Float32Array; samples: [number, number][] }
interface Corr { need: number[]; cIdx: number[]; nIdx: number[]; swap: boolean }

export class SilhouetteFit {
  private edges: [number, number, number, number][] = []; // v0, v1, face a, face b (-1 = border)
  /** Hands are left out of the quality check: fingers are noisy in photos, outnumber the torso's vertices, and no
   *  tape is taken there. (They stay in the match, or the arms would be pulled onto the hands' outline.) */
  private skip: Uint8Array;
  constructor(private fb: FitBody) {
    const m = fb.m;
    const hands = [PART_LABELS.indexOf("handL"), PART_LABELS.indexOf("handR")];
    this.skip = Uint8Array.from(m.partLabels, (l) => (hands.includes(l) ? 1 : 0));
    const map = new Map<number, [number, number, number, number]>();
    for (let f = 0; f < m.faces.length / 3; f++)
      for (let k = 0; k < 3; k++) {
        const a = m.faces[f * 3 + k], b = m.faces[f * 3 + ((k + 1) % 3)];
        const key = a < b ? a * 65536 + b : b * 65536 + a;
        const e = map.get(key);
        if (e) e[3] = f; else map.set(key, [Math.min(a, b), Math.max(a, b), f, -1]);
      }
    this.edges = [...map.values()];
  }

  /** Model outline vertices in one view: silhouette edges that lie on the model's own outer outline. */
  private contour(uv: Float64Array, w: number, h: number): number[] {
    const m = this.fb.m, F = m.faces;
    const nf = F.length / 3;
    const facing = new Int8Array(nf);
    for (let f = 0; f < nf; f++) {
      const a = F[f * 3] * 2, b = F[f * 3 + 1] * 2, c = F[f * 3 + 2] * 2;
      const area = (uv[b] - uv[a]) * (uv[c + 1] - uv[a + 1]) - (uv[c] - uv[a]) * (uv[b + 1] - uv[a + 1]);
      facing[f] = area > 0 ? 1 : -1;
    }
    // the model's own outline: a vertex is on it when a pixel next to it is outside the model's own mask, cleaned
    // like the photo masks (a small gap the photo's cleaning fills, between the legs, isn't outline). Worked on the
    // body's box only (with a margin, so the box border is background like the image border).
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < uv.length; i += 2) { const u = uv[i], v = uv[i + 1]; if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; }
    x0 = Math.max(0, Math.floor(x0) - 2); y0 = Math.max(0, Math.floor(y0) - 2);
    x1 = Math.min(w, Math.ceil(x1) + 3); y1 = Math.min(h, Math.ceil(y1) + 3);
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
    const local = new Float64Array(uv.length);
    for (let i = 0; i < uv.length; i += 2) { local[i] = uv[i] - x0; local[i + 1] = uv[i + 1] - y0; }
    // holes up to 1% filled (photos: 0.5%): a gap the photo's cleaning filled is always filled here too, so it
    // can't read as an outline error the length of the gap
    const own = cleanMask(rasterize(local, F, bw, bh), 0.01).data;
    const outside = (x: number, y: number) => x < 0 || y < 0 || x >= bw || y >= bh || !own[y * bw + x];
    const onOutline = (v: number) => {
      const x = Math.floor(local[v * 2]), y = Math.floor(local[v * 2 + 1]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (outside(x + dx, y + dy)) return true;
      return false;
    };
    const keep = new Set<number>();
    for (const [v0, v1, fa, fb] of this.edges) {
      if (fb >= 0 && facing[fa] === facing[fb]) continue;
      for (const v of [v0, v1]) if (!keep.has(v) && onOutline(v)) keep.add(v);
    }
    return [...keep];
  }

  /** Residuals of one photo (fixed correspondences), written at `off`; returns the next offset. */
  private viewRes(s: State, body: ReturnType<FitBody["evaluate"]>, input: FitInput, vd: ViewData[], c: Corr, v: number, out: Float64Array, off: number): number {
    const ph = input.photos[v];
    const { w, h } = ph.mask;
    const n = c.need.length;
    const pts = new Float64Array(n * 3);
    for (let k = 0; k < n; k++) { const i = c.need[k] * 3; pts[k * 3] = body.verts[i]; pts[k * 3 + 1] = body.verts[i + 1]; pts[k * 3 + 2] = body.verts[i + 2]; }
    const uv = new Float64Array(n * 2);
    project(pts, n, s.views[v], s.cam, uv);
    for (const k of c.cIdx) {
      const r = sample(vd[v].dt, w, h, uv[k * 2], uv[k * 2 + 1]);
      out[off++] = W_OUT * (Math.abs(r) > HUBER ? Math.sign(r) * Math.sqrt(HUBER * (2 * Math.abs(r) - HUBER)) : r);
    }
    const sm = vd[v].samples;
    for (let q = 0; q < sm.length; q++) {
      const k = c.nIdx[q];
      const du = uv[k * 2] - sm[q][0], dv = uv[k * 2 + 1] - sm[q][1], len = Math.hypot(du, dv);
      // Huber on the pair's length: a hair strand, a floor shadow or a hand on the hip can't pull hard
      const f = len > HUBER ? Math.sqrt(HUBER * (2 * len - HUBER)) / len : 1;
      out[off++] = W_IN * f * du;
      out[off++] = W_IN * f * dv;
    }
    const nj = body.joints.length / 3;
    const juv = new Float64Array(nj * 2);
    project(body.joints, nj, s.views[v], s.cam, juv);
    const lm = c.swap ? swapLR(ph.landmarks) : ph.landmarks;
    for (let j = 0; j < juv.length; j++) out[off++] = Number.isFinite(lm[j]) ? W_LM * LM_TRUST[j >> 1] * (juv[j] - lm[j]) : 0;
    return off;
  }
  private globalRes(s: State, _body: ReturnType<FitBody["evaluate"]>, input: FitInput, out: Float64Array, off: number) {
    // weak camera priors (focal length and phone height trade off against distance otherwise); tilt from gravity
    out[off++] = (20 * (s.cam.f - input.camGuess.f)) / input.camGuess.f;
    out[off++] = 0.2 * (s.cam.h - input.camGuess.h);
    out[off++] = W_PITCH * (s.cam.pitch - input.camGuess.pitch);
    for (const x of s.b.body) out[off++] = W_SHAPE * x;
    for (const x of s.b.pose) out[off++] = W_POSE * x;
    for (const x of s.b.scales) out[off++] = W_SCALE * x;
  }
  private residuals(s: State, body: ReturnType<FitBody["evaluate"]>, input: FitInput, vd: ViewData[], corr: Corr[], out: Float64Array) {
    let off = 0;
    for (let v = 0; v < corr.length; v++) off = this.viewRes(s, body, input, vd, corr[v], v, out, off);
    this.globalRes(s, body, input, out, off);
  }

  /** Pick outline vertices and photo-outline matches for the current state. */
  private correspond(s: State, body: ReturnType<FitBody["evaluate"]>, input: FitInput, vd: ViewData[]): Corr[] {
    const nV = this.fb.m.vertexCount;
    const uv = new Float64Array(nV * 2);
    return input.photos.map((ph, v) => {
      project(body.verts, nV, s.views[v], s.cam, uv);
      const { w, h } = ph.mask;
      const contour = this.contour(uv, w, h).filter((i) => uv[i * 2] >= 1 && uv[i * 2 + 1] >= 1 && uv[i * 2] <= w - 1 && uv[i * 2 + 1] <= h - 1);
      // an empty outline (body pushed off the image by a wild trial step) pairs every photo point with vertex 0
      const nearest = nearestOn(contour.length ? contour : [0], uv, vd[v].samples);
      // pose trackers mix up left and right when the back faces the camera: use whichever labelling fits better
      const nj = body.joints.length / 3;
      const juv = new Float64Array(nj * 2);
      project(body.joints, nj, s.views[v], s.cam, juv);
      const err = (lm: Float64Array) => { let e = 0; for (let j = 0; j < juv.length; j++) if (Number.isFinite(lm[j])) e += (juv[j] - lm[j]) ** 2; return e; };
      const swap = ph.hour >= 4 && ph.hour <= 8 && err(swapLR(ph.landmarks)) < err(ph.landmarks);
      const need = [...new Set([...contour, ...nearest])];
      const pos = new Map(need.map((i, k) => [i, k]));
      return { need, cIdx: contour.map((i) => pos.get(i)!), nIdx: nearest.map((i) => pos.get(i)!), swap };
    });
  }
  /** Where each photo's residuals start, and the total count. */
  private layout(vd: ViewData[], corr: Corr[]) {
    const nj = this.fb.jointIdx.length * 2;
    const starts: number[] = [];
    let off = 0;
    corr.forEach((c, v) => { starts.push(off); off += c.cIdx.length + vd[v].samples.length * 2 + nj; });
    starts.push(off);
    return { starts, total: off + 3 + NB + NP + NS };
  }

  run(input: FitInput, opts: { maxIter?: number; init?: { params: BodyParams; cam: Cam; views: View[] }; noFit?: boolean; stages?: number; firstIters?: number } = {}): FitResult {
    if (!input.yawSign && !opts.init) {
      // which way did the user turn? Place the photos both ways (first stage only) and keep the better one
      const a = this.run({ ...input, yawSign: 1 }, { stages: 1, firstIters: 6 }), b = this.run({ ...input, yawSign: -1 }, { stages: 1, firstIters: 6 });
      const r = this.run({ ...input, yawSign: a.cost <= b.cost ? 1 : -1 }, opts);
      return { ...r, ms: r.ms + a.ms + b.ms };
    }
    const t0 = performance.now();
    const sign = input.yawSign ?? 1;
    const cleaned = input.photos.map((ph) => cleanMask(ph.mask));
    const vd: ViewData[] = input.photos.map((_, i) => {
      // the true edge (between pixels), not the edge pixels' centers: those sit half a pixel inside
      const mask = cleaned[i];
      return { dt: signedDistance(mask), samples: edgePoints(mask, 4) };
    });
    // start: mean body at the user's height, each photo placed from its outline box
    const b0 = zeroParams();
    b0.scale = input.heightCm / this.fb.evaluate(b0).height;
    const cam = { ...input.camGuess };
    const views: View[] = input.photos.map((ph, i) => {
      let top = Infinity, bot = -Infinity, left = Infinity, right = -Infinity;
      const { w, data } = cleaned[i]; // the cleaned outline: a stray blob in the room would move the box
      for (let i = 0; i < data.length; i++) if (data[i]) { const x = i % w, y = Math.floor(i / w); top = Math.min(top, y); bot = Math.max(bot, y); left = Math.min(left, x); right = Math.max(right, x); }
      if (top === Infinity) return { yaw: Math.PI + sign * ph.hour * (Math.PI / 6), tx: 0, tz: input.heightCm * 1.2 }; // empty mask
      const tz = (cam.f * input.heightCm) / Math.max(1, bot - top);
      return { yaw: Math.PI + sign * ph.hour * (Math.PI / 6), tx: -(((left + right) / 2 - cam.cx) * tz) / cam.f, tz };
    });
    yawTargets = input.photos.map((ph) => Math.PI + sign * ph.hour * (Math.PI / 6));
    const hourYaw = [...yawTargets];
    let s: State = opts.init ? clone({ b: opts.init.params, cam: opts.init.cam, views: opts.init.views }) : { b: b0, cam, views };
    // People stop well off the hour, and a stop can be skipped or doubled: place every photo at once over a wide
    // range (±75° of its hour), keeping them roughly in order (each step −20° to 80° the same way round). Outline overlap with
    // the mean body scores each turn; the order settles what the overlap can't (front vs back look alike). The
    // chosen turns become the photos' new hours for the bounded fit.
    const order = (st: State) => {
      const body0 = this.fb.evaluate(st.b, input.heightCm);
      const nV = this.fb.m.vertexCount, uv0 = new Float64Array(nV * 2);
      const buf = new Uint8Array(input.photos[0].mask.w * input.photos[0].mask.h);
      const STEP = Math.PI / 24, K = 10; // 7.5°, ±75°
      const cand = (i: number, k: number) => yawTargets[i] + (k - K) * STEP;
      const score = st.views.map((v, i) => Array.from({ length: 2 * K + 1 }, (_, k) => {
        project(body0.verts, nV, { ...v, yaw: cand(i, k) }, st.cam, uv0);
        return iou(rasterize(uv0, this.fb.m.faces, input.photos[i].mask.w, input.photos[i].mask.h, buf), cleaned[i]);
      }));
      const n = st.views.length, M = 2 * K + 1;
      const best = score.map(() => new Float64Array(M).fill(-Infinity)), from = score.map(() => new Int32Array(M).fill(-1));
      best[0].set(score[0]);
      for (let i = 1; i < n; i++)
        for (let k = 0; k < M; k++)
          for (let j = 0; j < M; j++) {
            const step = sign * (cand(i, k) - cand(i - 1, j)) * (180 / Math.PI);
            if (step < -20 || step > 80 || best[i - 1][j] === -Infinity) continue;
            const v = best[i - 1][j] + score[i][k];
            if (v > best[i][k]) { best[i][k] = v; from[i][k] = j; }
          }
      let k = -1, top = -Infinity;
      for (let q = 0; q < M; q++) if (best[n - 1][q] > top) { top = best[n - 1][q]; k = q; }
      if (k < 0) return; // no ordered placement (can't happen with 12 photos 30° apart): keep the hours
      const pick: number[] = new Array(n);
      for (let i = n - 1; i >= 0; i--) { pick[i] = k; k = from[i][k]; }
      pick.forEach((q, i) => { st.views[i].yaw = cand(i, q); yawTargets[i] = cand(i, q); });
    };
    // people rarely stop exactly on the hour: put a photo at the turn (within the bound) whose outline overlaps best
    // wide: search ±75° of the photo's clock hour (not ±34° of its current turn) and move its bound there
    const regrid = (st: State, only?: (i: number) => boolean, wide = false) => {
      const body0 = this.fb.evaluate(st.b, input.heightCm);
      const nV = this.fb.m.vertexCount, uv0 = new Float64Array(nV * 2);
      const quality: number[] = [];
      const buf = new Uint8Array(input.photos[0].mask.w * input.photos[0].mask.h);
      st.views.forEach((v, i) => {
        const ph = input.photos[i];
        const at = (yaw: number) => { project(body0.verts, nV, { ...v, yaw }, st.cam, uv0); return iou(rasterize(uv0, this.fb.m.faces, ph.mask.w, ph.mask.h, buf), cleaned[i]); };
        if (only && !only(i)) { quality.push(at(v.yaw)); return; }
        let best = v.yaw, bestIou = only ? at(v.yaw) : -1;
        const tryYaw = (yaw: number) => { const q = at(yaw); if (q > bestIou) { bestIou = q; best = yaw; } };
        // coarse over the range, then half a step either side of the best
        const center = wide ? hourYaw[i] : yawTargets[i], range = wide ? (75 * Math.PI) / 180 : YAW_BOUND, step = wide ? Math.PI / 24 : 0.2;
        for (let d = -range; d <= range + 1e-9; d += step) tryYaw(center + d);
        const c = best;
        for (const d of [-step / 2, step / 2]) if (Math.abs(c + d - center) <= range + 1e-9) tryYaw(c + d);
        v.yaw = best;
        if (wide) yawTargets[i] = best;
        quality.push(bestIou);
      });
      return quality;
    };
    if (!opts.init) { order(s); regrid(s); }
    const stages: { iters: number; active: (k: number) => boolean }[] = [
      { iters: opts.firstIters ?? 15, active: (k) => k > NB + NP + NS }, // camera, placement (size is fixed by the height)
      { iters: 10, active: (k) => k >= NB && k !== NB + NP + NS }, // + posture and proportions
      { iters: opts.maxIter ?? 25, active: (k) => k !== NB + NP + NS }, // + body shape
    ];
    const nP = pack(s).length;
    let iterations = 0;

    let lastCost = Infinity;
    for (const stage of opts.noFit ? [] : stages.slice(0, opts.stages ?? stages.length)) {
      let lambda = 1e-3;
      for (let it = 0; it < stage.iters; it++) {
        iterations++;
        let body = this.fb.evaluate(s.b, input.heightCm);
        const corr = this.correspond(s, body, input, vd);
        const lay = this.layout(vd, corr);
        const r = new Float64Array(lay.total), rp = new Float64Array(lay.total);
        this.residuals(s, body, input, vd, corr, r);
        const cost = r.reduce((a, x) => a + x * x, 0);
        if (lastCost === Infinity) lastCost = cost;
        const x = pack(s);
        const act = x.map((_, k) => stage.active(k));
        // Jacobian (forward differences), column by column
        const cols: (Float64Array | null)[] = new Array(nP).fill(null);
        const span: [number, number][] = new Array(nP).fill([0, 0]);
        for (let k = 0; k < nP; k++) {
          if (!act[k]) continue;
          const step = k < NB ? 1e-3 : k < NB + NP + NS ? 1e-4 : k === NB + NP + NS ? 1e-5 : k === SHARED ? 0.05 : k === SHARED + 1 ? 0.05 : k === SHARED + 2 ? 1e-4 : (k - VIEW0) % 3 === 0 ? 1e-4 : 0.05;
          const xp = [...x]; xp[k] += step;
          const sp = unpack(xp, s);
          const col = new Float64Array(r.length);
          if (k >= VIEW0) {
            // one photo's placement: only that photo's residuals move
            const v = Math.floor((k - VIEW0) / 3);
            this.viewRes(sp, body, input, vd, corr[v], v, rp, lay.starts[v]);
            for (let i = lay.starts[v]; i < lay.starts[v + 1]; i++) col[i] = (rp[i] - r[i]) / step;
            rp.set(r.subarray(lay.starts[v], lay.starts[v + 1]), lay.starts[v]);
            span[k] = [lay.starts[v], lay.starts[v + 1]];
          } else {
            const bp = k < SHARED ? this.fb.evaluate(sp.b, input.heightCm) : body;
            this.residuals(sp, bp, input, vd, corr, rp);
            for (let i = 0; i < r.length; i++) col[i] = (rp[i] - r[i]) / step;
            span[k] = [0, r.length];
          }
          cols[k] = col;
        }
        const idx = cols.map((c, k) => (c ? k : -1)).filter((k) => k >= 0);
        const n = idx.length;
        const A = new Float64Array(n * n), g = new Float64Array(n);
        for (let a = 0; a < n; a++) {
          const ca = cols[idx[a]]!, [la, ha] = span[idx[a]];
          let ga = 0;
          for (let i = la; i < ha; i++) ga += ca[i] * r[i];
          g[a] = ga;
          for (let bb = a; bb < n; bb++) {
            const cb = cols[idx[bb]]!, [lb, hb] = span[idx[bb]];
            const lo = Math.max(la, lb), hi = Math.min(ha, hb);
            let sum = 0;
            for (let i = lo; i < hi; i++) sum += ca[i] * cb[i];
            A[a * n + bb] = sum; A[bb * n + a] = sum;
          }
        }
        let accepted = false;
        for (let tries = 0; tries < 6 && !accepted; tries++) {
          const M = Float64Array.from(A);
          for (let a = 0; a < n; a++) M[a * n + a] += lambda * (A[a * n + a] + 1e-6);
          const d = solve(M, g, n);
          if (!d) { lambda *= 10; continue; }
          const xn = [...x];
          idx.forEach((k, a) => (xn[k] -= d[a]));
          const sn = unpack(xn, s);
          const bn = this.fb.evaluate(sn.b, input.heightCm);
          this.residuals(sn, bn, input, vd, corr, rp);
          const cn = rp.reduce((a2, v) => a2 + v * v, 0);
          if (cn < cost) { s = sn; body = bn; lastCost = cn; lambda = Math.max(1e-7, lambda / 10); accepted = true; if ((cost - cn) / cost < 1e-4) it = stage.iters; }
          else lambda *= 10;
        }
        if (!accepted) break;
      }
      // a photo that still matches poorly probably sits at the wrong turn: search its turn again with this body
      if (!opts.init) {
        const q = regrid(s, () => false);
        const bad = new Set(q.flatMap((x, i) => (x < 0.95 ? [i] : [])));
        // with the fitted body (not front/back alike like the mean body), search wide: a photo stuck at the mirror
        // turn (a side view seen from the front vs from the back) is found again
        if (bad.size) regrid(s, (i) => bad.has(i), true);
      }
    }
    // quality per photo
    const body = this.fb.evaluate(s.b, input.heightCm);
    s.b.scale = body.scale;
    const nV = this.fb.m.vertexCount;
    const uv = new Float64Array(nV * 2);
    const ious: number[] = [], rms: number[] = [];
    input.photos.forEach((ph, v) => {
      project(body.verts, nV, s.views[v], s.cam, uv);
      ious.push(Math.round(iou(rasterize(uv, this.fb.m.faces, ph.mask.w, ph.mask.h), cleaned[v]) * 1000) / 1000);
      const c = this.contour(uv, ph.mask.w, ph.mask.h);
      // 90th percentile of the outline distance: a few stray points (a finger, a fold) don't fail a good fit
      const inImg = (i: number) => uv[i * 2] >= 1 && uv[i * 2 + 1] >= 1 && uv[i * 2] <= ph.mask.w - 1 && uv[i * 2 + 1] <= ph.mask.h - 1;
      const e = c.filter((i) => !this.skip[i] && inImg(i)).map((i) => Math.abs(sample(vd[v].dt, ph.mask.w, ph.mask.h, uv[i * 2], uv[i * 2 + 1]))).sort((a, b) => a - b);
      rms.push(Math.round((e[Math.floor(e.length * 0.9)] ?? 0) * 100) / 100);
    });
    // shapes are clamped to ±SHAPE_MAX; a fit that pins most of them there is straining against the photos
    const badShape = s.b.body.filter((x) => Math.abs(x) >= SHAPE_MAX - 1e-6).length > NB / 2;
    const ok = ious.every((x) => x >= 0.9) && rms.every((x) => x <= 3) && !badShape;
    return {
      params: s.b, cam: s.cam, views: s.views, iou: ious, rmsPx: rms, iterations, ms: Math.round(performance.now() - t0), ok, cost: lastCost,
      reason: ok ? undefined : badShape ? "unusual body shape" : ious.some((x) => x < 0.9) ? "outline doesn't match" : "edges too far",
    };
  }
}

/** For each query point, the nearest of `ids` (points uv[i*2], uv[i*2+1]): a uniform grid, searched ring by ring. */
function nearestOn(ids: number[], uv: Float64Array, queries: [number, number][]): number[] {
  if (!ids.length) return queries.map(() => -1);
  const C = 8;
  const cells = new Map<number, number[]>();
  const key = (cx: number, cy: number) => cx * 4096 + cy;
  for (const i of ids) {
    const k = key(Math.floor(uv[i * 2] / C), Math.floor(uv[i * 2 + 1] / C));
    const c = cells.get(k);
    if (c) c.push(i); else cells.set(k, [i]);
  }
  return queries.map(([qx, qy]) => {
    const cx = Math.floor(qx / C), cy = Math.floor(qy / C);
    let best = ids[0], bd = Infinity;
    const visit = (x: number, y: number) => {
      const c = cells.get(key(x, y));
      if (c) for (const i of c) { const d = (uv[i * 2] - qx) ** 2 + (uv[i * 2 + 1] - qy) ** 2; if (d < bd) { bd = d; best = i; } }
    };
    for (let r = 0; ; r++) {
      // every point in ring r is at least (r - 1) cells away
      if (r > 0 && ((r - 1) * C) ** 2 > bd) break;
      if (r > 600) break; // far outside any image
      if (r === 0) { visit(cx, cy); continue; }
      for (let d = -r; d <= r; d++) { visit(cx + d, cy - r); visit(cx + d, cy + r); }
      for (let d = -r + 1; d <= r - 1; d++) { visit(cx - r, cy + d); visit(cx + r, cy + d); }
    }
    return best;
  });
}

/** Landmarks with left and right swapped (LANDMARK_JOINTS order: head, then L/R pairs). */
function swapLR(lm: Float64Array): Float64Array {
  const out = Float64Array.from(lm);
  for (let j = 1; j + 1 < lm.length / 2; j += 2) {
    out[j * 2] = lm[(j + 1) * 2]; out[j * 2 + 1] = lm[(j + 1) * 2 + 1];
    out[(j + 1) * 2] = lm[j * 2]; out[(j + 1) * 2 + 1] = lm[j * 2 + 1];
  }
  return out;
}

/** Solve M d = g (symmetric positive definite) by Cholesky; null if not positive definite. */
function solve(M: Float64Array, g: Float64Array, n: number): Float64Array | null {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let sum = M[i * n + j];
      for (let k = 0; k < j; k++) sum -= L[i * n + k] * L[j * n + k];
      if (i === j) { if (sum <= 0) return null; L[i * n + i] = Math.sqrt(sum); }
      else L[i * n + j] = sum / L[j * n + j];
    }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) { let sum = g[i]; for (let k = 0; k < i; k++) sum -= L[i * n + k] * y[k]; y[i] = sum / L[i * n + i]; }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let sum = y[i]; for (let k = i + 1; k < n; k++) sum -= L[k * n + i] * x[k]; x[i] = sum / L[i * n + i]; }
  return x;
}
