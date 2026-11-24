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

export function makeScene(fb: FitBody, seed: number, opts: { w?: number; h?: number; noisePx?: number } = {}): Scene {
  const r = rng(seed);
  const W = opts.w ?? 480, H = opts.h ?? 640;
  const truth = zeroParams();
  truth.body = truth.body.map(() => Math.max(-2, Math.min(2, r.n(0.8))));
  truth.pose = truth.pose.map(() => r.n(0.05));
  truth.scales = truth.scales.map(() => r.n(0.06));
  const heightCm = 160 + r.u() * 35;
  truth.scale = 1;
  truth.scale = heightCm / fb.evaluate(truth).height;
  const cam: Cam = { f: 0.725 * H * (1 + r.n(0.03)), cx: W / 2, cy: H / 2, h: 100 + r.n(5), pitch: 0 };
  const body = fb.evaluate(truth);
  const nV = fb.m.vertexCount;
  const uv = new Float64Array(nV * 2), juv = new Float64Array(body.joints.length / 3 * 2);
  const views: View[] = [];
  const photos: Photo[] = [];
  for (let hour = 0; hour < 12; hour++) {
    // far enough that the whole body is in frame (the real scan won't start otherwise)
    const v: View = { yaw: Math.PI + hour * (Math.PI / 6) + r.n(0.06), tx: r.n(6), tz: heightCm * 1.05 + 10 + Math.abs(r.n(6)) };
    views.push(v);
    project(body.verts, nV, v, cam, uv);
    project(body.joints, body.joints.length / 3, v, cam, juv);
    const lm = Float64Array.from(juv, (x) => x + r.n(opts.noisePx ?? 2));
    photos.push({ mask: rasterize(uv, fb.m.faces, W, H), landmarks: lm, hour });
  }
  return { truth, cam, views, photos, heightCm };
}
