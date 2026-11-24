// Multi-view silhouette fit (docs/plans/body-scan.md §3.3): one body (shape, posture, proportions,
// size) seen in 12 photos, one camera, each photo with its own turn (yaw) and floor position.
// Levenberg–Marquardt; the residuals per photo are a two-way outline match (model outline → photo
// outline via a distance field, photo outline → nearest model outline point) plus joint landmarks,
// a height term and priors. The outline sets are picked once per iteration and held fixed while the
// Jacobian is taken (finite differences: the body rebuild takes ~1 ms). Coarse to fine: placement
// and camera first, then posture and proportions, then body shape.
import { project, type Cam, type View } from "./camera";
import { edgePoints, iou, rasterize, sample, signedDistance, type Mask } from "./raster";
import { FitBody, POSE_PARAMS, SCALE_PARAMS, zeroParams, type BodyParams } from "./body";

export interface Photo {
  mask: Mask;
  /** 2D landmarks for LANDMARK_JOINTS (u, v pairs; NaN = not seen) */
  landmarks: Float64Array;
  /** Clock hour the user was asked to face (0 = facing the phone … 11) */
  hour: number;
}
export interface FitInput { photos: Photo[]; heightCm: number; camGuess: Cam; yawSign?: 1 | -1 }
export interface FitResult {
  params: BodyParams; cam: Cam; views: View[];
  /** Per photo: overlap of the fitted body with the photo outline (0–1) and 90th-percentile outline distance (px) */
  iou: number[]; rmsPx: number[];
  iterations: number; ms: number; ok: boolean; reason?: string;
}

const W_OUT = 1, W_IN = 1, W_LM = 0.3, W_HEIGHT = 3, W_SHAPE = 2, W_POSE = 4, W_SCALE = 6;
const HUBER = 3;
const NB = 20, NP = POSE_PARAMS.length, NS = SCALE_PARAMS.length;

type State = { b: BodyParams; cam: Cam; views: View[] };
const clone = (s: State): State => ({ b: { body: [...s.b.body], pose: [...s.b.pose], scales: [...s.b.scales], scale: s.b.scale }, cam: { ...s.cam }, views: s.views.map((v) => ({ ...v })) });

// Parameter vector: [body 20 | pose | scales | scale | f | camH | (yaw, tx, tz) × views]
function pack(s: State): number[] {
  return [...s.b.body, ...s.b.pose, ...s.b.scales, s.b.scale, s.cam.f, s.cam.h, ...s.views.flatMap((v) => [v.yaw, v.tx, v.tz])];
}
function unpack(x: number[], base: State): State {
  const s = clone(base);
  let k = 0;
  for (let i = 0; i < NB; i++) s.b.body[i] = x[k++];
  for (let i = 0; i < NP; i++) s.b.pose[i] = x[k++];
  for (let i = 0; i < NS; i++) s.b.scales[i] = x[k++];
  s.b.scale = x[k++]; s.cam.f = x[k++]; s.cam.h = x[k++];
  for (const v of s.views) { v.yaw = x[k++]; v.tx = x[k++]; v.tz = x[k++]; }
  return s;
}
const SHARED = NB + NP + NS + 1; // parameters that need a body rebuild

interface ViewData { dt: Float32Array; samples: [number, number][] }
interface Corr { need: number[]; cIdx: number[]; nIdx: number[] }

export class SilhouetteFit {
  private edges: [number, number, number, number][] = []; // v0, v1, face a, face b (-1 = border)
  constructor(private fb: FitBody) {
    const m = fb.m;
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
    // the model's own outline: a vertex is on it when a pixel next to it is outside the model's own mask
    const hw = w, hh = h;
    const half = uv;
    const own = rasterize(uv, F, w, h).data;
    const outside = (x: number, y: number) => x < 0 || y < 0 || x >= hw || y >= hh || !own[y * hw + x];
    const onOutline = (v: number) => {
      const x = Math.floor(half[v * 2]), y = Math.floor(half[v * 2 + 1]);
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
      out[off++] = W_IN * (uv[k * 2] - sm[q][0]);
      out[off++] = W_IN * (uv[k * 2 + 1] - sm[q][1]);
    }
    const nj = body.joints.length / 3;
    const juv = new Float64Array(nj * 2);
    project(body.joints, nj, s.views[v], s.cam, juv);
    for (let j = 0; j < juv.length; j++) out[off++] = Number.isFinite(ph.landmarks[j]) ? W_LM * (juv[j] - ph.landmarks[j]) : 0;
    return off;
  }
  private globalRes(s: State, body: ReturnType<FitBody["evaluate"]>, input: FitInput, out: Float64Array, off: number) {
    out[off++] = W_HEIGHT * (body.height - input.heightCm);
    // weak camera priors (focal length and phone height trade off against distance otherwise)
    out[off++] = (20 * (s.cam.f - input.camGuess.f)) / input.camGuess.f;
    out[off++] = 0.2 * (s.cam.h - input.camGuess.h);
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
      const nearest = vd[v].samples.map(([qx, qy]) => {
        let best = contour[0], bd = Infinity;
        for (const i of contour) { const d = (uv[i * 2] - qx) ** 2 + (uv[i * 2 + 1] - qy) ** 2; if (d < bd) { bd = d; best = i; } }
        return best;
      });
      const need = [...new Set([...contour, ...nearest])];
      const pos = new Map(need.map((i, k) => [i, k]));
      return { need, cIdx: contour.map((i) => pos.get(i)!), nIdx: nearest.map((i) => pos.get(i)!) };
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

  run(input: FitInput, opts: { maxIter?: number; init?: { params: BodyParams; cam: Cam; views: View[] }; noFit?: boolean } = {}): FitResult {
    const t0 = performance.now();
    const sign = input.yawSign ?? 1;
    const vd: ViewData[] = input.photos.map((ph) => {
      // the true edge (between pixels), not the edge pixels' centers: those sit half a pixel inside
      return { dt: signedDistance(ph.mask), samples: edgePoints(ph.mask, 4) };
    });
    // start: mean body at the user's height, each photo placed from its outline box
    const b0 = zeroParams();
    b0.scale = input.heightCm / this.fb.evaluate(b0).height;
    const cam = { ...input.camGuess };
    const views: View[] = input.photos.map((ph) => {
      let top = Infinity, bot = -Infinity, left = Infinity, right = -Infinity;
      const { w, data } = ph.mask;
      for (let i = 0; i < data.length; i++) if (data[i]) { const x = i % w, y = Math.floor(i / w); top = Math.min(top, y); bot = Math.max(bot, y); left = Math.min(left, x); right = Math.max(right, x); }
      const tz = (cam.f * input.heightCm) / Math.max(1, bot - top);
      return { yaw: Math.PI + sign * ph.hour * (Math.PI / 6), tx: (((left + right) / 2 - cam.cx) * tz) / cam.f, tz };
    });
    let s: State = opts.init ? clone({ b: opts.init.params, cam: opts.init.cam, views: opts.init.views }) : { b: b0, cam, views };
    const stages: { iters: number; active: (k: number) => boolean }[] = [
      { iters: 15, active: (k) => k > NB + NP + NS }, // camera, placement (size is fixed by the height)
      { iters: 10, active: (k) => k >= NB && k !== NB + NP + NS }, // + posture and proportions
      { iters: opts.maxIter ?? 25, active: (k) => k !== NB + NP + NS }, // + body shape
    ];
    const nP = pack(s).length;
    let iterations = 0;

    for (const stage of opts.noFit ? [] : stages) {
      let lambda = 1e-3;
      for (let it = 0; it < stage.iters; it++) {
        iterations++;
        let body = this.fb.evaluate(s.b, input.heightCm);
        const corr = this.correspond(s, body, input, vd);
        const lay = this.layout(vd, corr);
        const r = new Float64Array(lay.total), rp = new Float64Array(lay.total);
        this.residuals(s, body, input, vd, corr, r);
        const cost = r.reduce((a, x) => a + x * x, 0);
        const x = pack(s);
        const act = x.map((_, k) => stage.active(k));
        // Jacobian (forward differences), column by column
        const cols: (Float64Array | null)[] = new Array(nP).fill(null);
        const span: [number, number][] = new Array(nP).fill([0, 0]);
        for (let k = 0; k < nP; k++) {
          if (!act[k]) continue;
          const step = k < NB ? 1e-3 : k < NB + NP + NS ? 1e-4 : k === NB + NP + NS ? 1e-5 : k === SHARED ? 0.05 : k === SHARED + 1 ? 0.05 : (k - SHARED - 2) % 3 === 0 ? 1e-4 : 0.05;
          const xp = [...x]; xp[k] += step;
          const sp = unpack(xp, s);
          const col = new Float64Array(r.length);
          if (k >= SHARED + 2) {
            // one photo's placement: only that photo's residuals move
            const v = Math.floor((k - SHARED - 2) / 3);
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
          if (cn < cost) { s = sn; body = bn; lambda = Math.max(1e-7, lambda / 10); accepted = true; if ((cost - cn) / cost < 1e-4) it = stage.iters; }
          else lambda *= 10;
        }
        if (!accepted) break;
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
      ious.push(Math.round(iou(rasterize(uv, this.fb.m.faces, ph.mask.w, ph.mask.h), ph.mask) * 1000) / 1000);
      const c = this.contour(uv, ph.mask.w, ph.mask.h);
      // 90th percentile of the outline distance: a few stray points (a finger, a fold) don't fail a good fit
      const e = c.map((i) => Math.abs(sample(vd[v].dt, ph.mask.w, ph.mask.h, uv[i * 2], uv[i * 2 + 1]))).sort((a, b) => a - b);
      rms.push(Math.round((e[Math.floor(e.length * 0.9)] ?? 0) * 100) / 100);
    });
    const badShape = s.b.body.some((x) => Math.abs(x) > 3);
    const ok = ious.every((x) => x >= 0.9) && rms.every((x) => x <= 2) && !badShape;
    return {
      params: s.b, cam: s.cam, views: s.views, iou: ious, rmsPx: rms, iterations, ms: Math.round(performance.now() - t0), ok,
      reason: ok ? undefined : badShape ? "unusual body shape" : ious.some((x) => x < 0.9) ? "outline doesn't match" : "edges too far",
    };
  }
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
