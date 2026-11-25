// Made-up bodies for testing the scan fit (never real people): a random MHR body, posed like a
// scan (arms slightly out), photographed from 12 clock hours by a phone at waist height.
import { project, type Cam, type View } from "./camera";
import { rasterize } from "./raster";
import { FitBody, zeroParams, type BodyParams } from "./body";
import type { Photo } from "./fit";

/** Small seeded random numbers (repeatable tests). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return { u, n: (sd = 1) => sd * Math.sqrt(-2 * Math.log(u() || 1e-9)) * Math.cos(2 * Math.PI * u()) };
}

export interface Scene { truth: BodyParams; cam: Cam; views: View[]; photos: Photo[]; heightCm: number }

export function makeScene(fb: FitBody, seed: number, opts: { w?: number; h?: number; noisePx?: number; turn?: 1 | -1; swapBack?: boolean; pitch?: number; yawNoise?: number; damage?: boolean | string; skipAt?: number } = {}): Scene {
  const r = rng(seed);
  const W = opts.w ?? 480, H = opts.h ?? 640;
  const truth = zeroParams();
  truth.body = truth.body.map(() => Math.max(-2, Math.min(2, r.n(0.8))));
  truth.pose = truth.pose.map(() => r.n(0.05));
  truth.scales = truth.scales.map(() => r.n(0.06));
  const heightCm = 160 + r.u() * 35;
  truth.scale = heightCm / fb.straight(truth);
  const cam: Cam = { f: 0.725 * H * (1 + r.n(0.03)), cx: W / 2, cy: H / 2, h: 100 + r.n(5), pitch: opts.pitch ?? 0 };
  const body = fb.evaluate(truth);
  const nV = fb.m.vertexCount;
  const uv = new Float64Array(nV * 2), juv = new Float64Array(body.joints.length / 3 * 2);
  const views: View[] = [];
  const photos: Photo[] = [];
  for (let hour = 0; hour < 12; hour++) {
    // far enough that the whole body is in frame (the real scan won't start otherwise)
    // skipAt: the user turned two hours at that stop, so every later photo is one hour further than its label
    const turned = hour + (opts.skipAt != null && hour >= opts.skipAt ? 1 : 0);
    const v: View = { yaw: Math.PI + (opts.turn ?? 1) * turned * (Math.PI / 6) + r.n(opts.yawNoise ?? 0.06), tx: r.n(6), tz: heightCm * 1.05 + 10 + Math.abs(r.n(6)) };
    views.push(v);
    project(body.verts, nV, v, cam, uv);
    project(body.joints, body.joints.length / 3, v, cam, juv);
    let lm = Float64Array.from(juv, (x) => x + r.n(opts.noisePx ?? 2));
    // like a pose tracker, swap left and right while the back faces the camera
    if (opts.swapBack && hour >= 4 && hour <= 8) for (let j = 1; j + 1 < lm.length / 2; j += 2) { const a = lm.slice(j * 2, j * 2 + 2); lm.set(lm.slice((j + 1) * 2, (j + 1) * 2 + 2), j * 2); lm.set(a, (j + 1) * 2); }
    const mask = rasterize(uv, fb.m.faces, W, H);
    if (opts.damage) damage(mask.data, W, H, r, opts.damage === true ? "ragged,hole,shadow,blob" : opts.damage);
    photos.push({ mask, landmarks: lm, hour });
  }
  return { truth, cam, views, photos, heightCm };
}

/** Real-mask faults: ragged edges (±1 px), a hole, a floor-shadow blob at the feet, a stray blob in the room. */
function damage(d: Uint8Array, w: number, h: number, r: ReturnType<typeof rng>, kinds: string) {
  const src = d.slice();
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const edge = src[i] !== src[i - 1] || src[i] !== src[i + 1] || src[i] !== src[i - w] || src[i] !== src[i + w];
      if (edge && r.u() < 0.3 && kinds.includes("ragged")) d[i] = src[i] ? 0 : 1;
    }
  let top = h, bot = 0, cx = 0, n = 0;
  for (let i = 0; i < w * h; i++) if (src[i]) { const y = Math.floor(i / w); top = Math.min(top, y); bot = Math.max(bot, y); cx += i % w; n++; }
  cx = Math.round(cx / n);
  const blob = (bx: number, by: number, rx: number, ry: number, v: number) => {
    for (let y = by - ry; y <= by + ry; y++) for (let x = bx - rx; x <= bx + rx; x++)
      if (x >= 0 && y >= 0 && x < w && y < h && ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 <= 1) d[y * w + x] = v;
  };
  if (kinds.includes("hole")) blob(cx, Math.round(top + (bot - top) * 0.4), 3, 3, 0); // hole in the torso
  if (kinds.includes("shadow")) blob(cx + 25, bot, 30, 4, 1); // shadow at the feet
  if (kinds.includes("blob")) blob(20, 40, 8, 8, 1); // something in the room
}
