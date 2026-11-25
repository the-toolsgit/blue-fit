// Body scan worker (docs/plans/body-scan.md §3): everything heavy runs here so the screen never stutters.
// Live pose (MediaPipe full, GPU with a CPU fallback), room statistics, each capture's outline + landmarks
// (heavy pose with its full-resolution person mask; the multiclass segmenter removes head hair), and the 3D fit.
// Frames arrive as ImageBitmaps and are closed right after use; nothing is stored.
import { ImageSegmenter, PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
// MediaPipe's runtime as build assets (served by the app; the dev server won't let a worker import files from public/)
import wasmLoaderPath from "@mediapipe/tasks-vision/vision_wasm_module_internal.js?url";
import wasmBinaryPath from "@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url";
import { parseMhr } from "../../core/body/mhr";
import { measureGeometry } from "../../core/body/measure";
import type { Sex } from "../../core/body/types";
import { FitBody, LANDMARK_JOINTS } from "./fit/body";
import { SilhouetteFit, type Photo } from "./fit/fit";
import { buildGeometry } from "./fit/geometry";
import { project } from "./fit/camera";
import { rasterize } from "./fit/raster";
import { MP } from "./guide";

import { FIT_H, FIT_W, SCANNER_ID, SCANNER_VERSION } from "./constants";

// Only our own origin: model files and wasm are served by the app (a page CSP doesn't cover workers)
const nativeFetch = self.fetch.bind(self);
self.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, self.location.href);
  if (url.origin !== self.location.origin) return Promise.reject(new Error(`Blocked: ${url.origin}`));
  return nativeFetch(input, init);
}) as typeof fetch;

let live: PoseLandmarker | null = null;
let heavy: PoseLandmarker | null = null;
let seg: ImageSegmenter | null = null;
let liveDelegate: "GPU" | "CPU" = "GPU";
const photos: Photo[] = [];
const maskInfo: string[] = []; // per photo: mask size / frame size, body share (scan report)

const post = (m: unknown, t: Transferable[] = []) => (self as unknown as Worker).postMessage(m, t);

/** MediaPipe landmarks → the fit's joints (LANDMARK_JOINTS order), in fit pixels. Head = between the ears. */
function toJoints(lm: NormalizedLandmark[]): Float64Array {
  const pick: Record<(typeof LANDMARK_JOINTS)[number], number[]> = {
    c_head: [MP.earL, MP.earR], l_uparm: [MP.shoulderL], r_uparm: [MP.shoulderR], l_lowarm: [MP.elbowL], r_lowarm: [MP.elbowR],
    l_wrist: [MP.wristL], r_wrist: [MP.wristR], l_upleg: [MP.hipL], r_upleg: [MP.hipR], l_lowleg: [MP.kneeL], r_lowleg: [MP.kneeR],
    l_talocrural: [MP.ankleL], r_talocrural: [MP.ankleR],
  };
  const out = new Float64Array(LANDMARK_JOINTS.length * 2).fill(NaN);
  LANDMARK_JOINTS.forEach((j, k) => {
    const ps = pick[j].map((i) => lm[i]).filter((p) => p && (p.visibility ?? 1) > 0.5);
    if (!ps.length) return;
    out[k * 2] = (ps.reduce((a, p) => a + p.x, 0) / ps.length) * FIT_W;
    out[k * 2 + 1] = (ps.reduce((a, p) => a + p.y, 0) / ps.length) * FIT_H;
  });
  return out;
}

/** Downsample a full-resolution confidence mask to the fit size: area average, then ≥ 0.5 = body. */
function toFitMask(conf: Float32Array, w: number, h: number, hairBelowNeckOk: Uint8Array | null): Uint8Array {
  const out = new Uint8Array(FIT_W * FIT_H);
  const sx = w / FIT_W, sy = h / FIT_H;
  for (let y = 0; y < FIT_H; y++)
    for (let x = 0; x < FIT_W; x++) {
      let s = 0, n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.floor((y + 1) * sy); yy++)
        for (let xx = Math.floor(x * sx); xx < Math.floor((x + 1) * sx); xx++) { s += conf[yy * w + xx]; n++; }
      out[y * FIT_W + x] = n && s / n >= 0.5 && (!hairBelowNeckOk || hairBelowNeckOk[y * FIT_W + x]) ? 1 : 0;
    }
  return out;
}

// MediaPipe imports its loader for each model and expects the import to set self.ModuleFactory; a module import
// runs only once per worker, so the factory is kept here and put back before each model is created.
let factory: unknown = null;
async function create<T>(make: () => Promise<T>): Promise<T> {
  const g = self as unknown as { ModuleFactory?: unknown };
  if (!factory) { const mod = await import(/* @vite-ignore */ wasmLoaderPath); factory = mod.default ?? g.ModuleFactory; }
  g.ModuleFactory = factory;
  return make();
}

async function init(base: string) {
  const files = { wasmLoaderPath, wasmBinaryPath };
  const model = (f: string) => `${base}models/${f}`;
  try {
    live = await create(() => PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: model("pose_landmarker_full.task"), delegate: "GPU" }, runningMode: "VIDEO", numPoses: 2, canvas: new OffscreenCanvas(1, 1) }));
  } catch {
    liveDelegate = "CPU";
    live = await create(() => PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: model("pose_landmarker_full.task"), delegate: "CPU" }, runningMode: "VIDEO", numPoses: 2 }));
  }
  heavy = await create(() => PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: model("pose_landmarker_heavy.task"), delegate: "CPU" }, runningMode: "IMAGE", numPoses: 1, outputSegmentationMasks: true }));
  seg = await create(() => ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: model("selfie_multiclass_256x256.tflite"), delegate: "CPU" }, runningMode: "IMAGE", outputCategoryMask: true, outputConfidenceMasks: false }));
}

self.onmessage = async (ev: MessageEvent) => {
  const d = ev.data;
  try {
    if (d.type === "init") {
      const t = performance.now();
      await init(d.base);
      post({ type: "ready", ms: Math.round(performance.now() - t), delegate: liveDelegate });
    } else if (d.type === "frame") {
      const bmp = d.bitmap as ImageBitmap;
      const r = live!.detectForVideo(bmp, d.ts);
      bmp.close();
      post({ type: "pose", id: d.id, people: r.landmarks.length, landmarks: r.landmarks[0] ?? null, world: r.worldLandmarks[0] ?? null });
    } else if (d.type === "room") {
      // light and background, from a small frame and the person mask
      const bmp = d.bitmap as ImageBitmap;
      const w = bmp.width, h = bmp.height;
      const c = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true })!;
      c.drawImage(bmp, 0, 0);
      const px = c.getImageData(0, 0, w, h).data;
      const res = heavy!.detect(bmp);
      bmp.close();
      const rm = res.segmentationMasks?.[0];
      const raw = rm?.getAsFloat32Array();
      const rw = rm?.width ?? w, rh = rm?.height ?? h;
      const lm = res.landmarks[0];
      // resample to the frame's pixels when the mask has its own size
      const mask = raw && (rw !== w || rh !== h) ? Float32Array.from({ length: w * h }, (_, i) => raw[Math.floor(((Math.floor(i / w) + 0.5) * rh) / h) * rw + Math.floor((((i % w) + 0.5) * rw) / w)]) : raw?.slice();
      res.close();
      if (!mask || !lm) { post({ type: "room", id: d.id, stats: null }); return; }
      const hipY = ((lm[MP.hipL].y + lm[MP.hipR].y) / 2) * h;
      const lum = (i: number) => 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      let bS = 0, bN = 0, gS = 0, gN = 0, uS = 0, uN = 0, lS = 0, lN = 0, edges = 0, eN = 0, bR = 0, bG = 0, bB = 0, gR = 0, gG = 0, gB = 0;
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x, L = lum(i);
          if (mask[i] > 0.5) {
            bS += L; bN++; bR += px[i * 4]; bG += px[i * 4 + 1]; bB += px[i * 4 + 2];
            if (y < hipY) { uS += L; uN++; } else { lS += L; lN++; }
          } else if (mask[i] < 0.1) {
            gS += L; gN++; gR += px[i * 4]; gG += px[i * 4 + 1]; gB += px[i * 4 + 2];
            const gx = lum(i + 1) - lum(i - 1), gy = lum(i + w) - lum(i - w);
            if (Math.hypot(gx, gy) > 60) edges++;
            eN++;
          }
        }
      const contrast = bN && gN ? Math.hypot(bR / bN - gR / gN, bG / bN - gG / gN, bB / bN - gB / gN) : 0;
      post({ type: "room", id: d.id, stats: { bodyMean: bN ? bS / bN : 0, bgMean: gN ? gS / gN : 0, upperMean: uN ? uS / uN : 0, lowerMean: lN ? lS / lN : 0, bgEdges: eN ? edges / eN : 0, contrast } });
    } else if (d.type === "capture") {
      // one photo: full-resolution person mask (heavy pose) minus head hair (multiclass), landmarks, then drop the frame
      const bmp = d.bitmap as ImageBitmap;
      const w = bmp.width, h = bmp.height;
      const r = heavy!.detect(bmp);
      const lm = r.landmarks[0];
      // the mask's own size (not assumed to be the frame's)
      const mk = r.segmentationMasks?.[0];
      const conf = mk?.getAsFloat32Array().slice();
      const mw = mk?.width ?? w, mh = mk?.height ?? h;
      r.close();
      const s = seg!.segment(bmp);
      const cat = s.categoryMask?.getAsUint8Array().slice();
      const cw = s.categoryMask?.width ?? 0, ch = s.categoryMask?.height ?? 0;
      s.close();
      bmp.close();
      if (!lm || !conf) { post({ type: "captured", id: d.id, ok: false }); return; }
      // head hair (class 1) above the shoulders isn't body; hair below the neck (body hair) is
      const neckY = Math.min(lm[MP.shoulderL].y, lm[MP.shoulderR].y) * FIT_H;
      let keep: Uint8Array | null = null;
      if (cat && cw) {
        keep = new Uint8Array(FIT_W * FIT_H).fill(1);
        for (let y = 0; y < Math.min(FIT_H, neckY); y++)
          for (let x = 0; x < FIT_W; x++) if (cat[Math.floor((y / FIT_H) * ch) * cw + Math.floor((x / FIT_W) * cw)] === 1) keep[y * FIT_W + x] = 0;
      }
      const mask = toFitMask(conf, mw, mh, keep);
      photos[d.hour] = { mask: { w: FIT_W, h: FIT_H, data: mask }, landmarks: toJoints(lm), hour: d.hour };
      let area = 0;
      for (let i = 0; i < mask.length; i++) area += mask[i];
      maskInfo[d.hour] = `${mw}×${mh}/${w}×${h} ${Math.round((area / mask.length) * 1000) / 10}%`;
      post({ type: "captured", id: d.id, ok: true, hour: d.hour });
    } else if (d.type === "reset") {
      photos.length = 0; maskInfo.length = 0;
      post({ type: "reset", id: d.id });
    } else if (d.type === "fit") {
      // free the camera models before the fit (memory)
      live?.close(); heavy?.close(); seg?.close(); live = heavy = null; seg = null;
      const buf = await (await fetch(`${d.base}mhr/v1/mhr-lod2.bin`)).arrayBuffer();
      const m = parseMhr(buf);
      const fb = new FitBody(m);
      const got = photos.filter(Boolean);
      const res = new SilhouetteFit(fb).run({ photos: got, heightCm: d.heightCm, camGuess: { f: 0.725 * FIT_H, cx: FIT_W / 2, cy: FIT_H / 2, h: 100, pitch: d.pitch ?? 0 } });
      const viewQuality = res.iou.map((x, i) => Math.round(Math.max(0, Math.min(1, x * (res.rmsPx[i] <= 3 ? 1 : 0.8))) * 100) / 100);
      const geometry = buildGeometry(m, fb, res.params, { scannerId: SCANNER_ID, scannerVersion: SCANNER_VERSION, viewQuality });
      const measured = measureGeometry(geometry, d.sex as Sex, d.heightCm);
      photos.length = 0;
      const deg = (r: number) => Math.round((r * 180) / Math.PI);
      const report = { iou: res.iou, rmsPx: res.rmsPx, yawDeg: res.views.map((v) => deg(v.yaw)), pitchDeg: Math.round((res.cam.pitch * 1800) / Math.PI) / 10, pitchGuessDeg: Math.round(((d.pitch ?? 0) * 1800) / Math.PI) / 10, focal: Math.round(res.cam.f), camH: Math.round(res.cam.h), iterations: res.iterations };
      // what the fit saw, for the on-phone outline check: each photo mask and the fitted body's mask (never saved)
      const body = fb.evaluate(res.params, d.heightCm);
      const uv = new Float64Array(m.vertexCount * 2);
      const views = got.map((ph, i) => {
        project(body.verts, m.vertexCount, res.views[i], res.cam, uv);
        return { hour: ph.hour, photo: ph.mask.data, model: rasterize(uv, m.faces, FIT_W, FIT_H).data, landmarks: Array.from(ph.landmarks) };
      });
      const shapeMax = Math.round(Math.max(...res.params.body.map(Math.abs)) * 10) / 10;
      photos.length = 0;
      post({ type: "fitted", id: d.id, ok: res.ok, reason: res.reason, ms: res.ms, geometry, measured, report: { ...report, masks: got.map((p) => maskInfo[p.hour] ?? "?"), shapeMax }, views });
    }
  } catch (e) {
    post({ type: "error", id: d.id, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
  }
};
