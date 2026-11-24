// Body-scan speed test (spike, docs/plans/body-scan.md §4). Temporary page:
// measures model load, live pose speed, per-capture segmentation, worker
// support, camera behavior, tilt, audio and a synthetic 3D-fit benchmark on
// the phone. Frames live only in memory and are closed right after use;
// nothing is stored except a step marker (to report a crash) in sessionStorage.
import { FilesetResolver, ImageSegmenter, PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { fitBenchmark } from "./fitBench";

const BASE = import.meta.env.BASE_URL;
const WASM = `${BASE}mediapipe`;
const M = (f: string) => `${BASE}models/${f}`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const runBtn = $<HTMLButtonElement>("run");
const statusEl = $("status");
const stage = $("stage");
const video = $<HTMLVideoElement>("video");
const cue = $("cue");
const reportEl = $<HTMLPreElement>("report");
const copyBtn = $<HTMLButtonElement>("copy");

const lines: string[] = [];
const log = (s: string) => {
  lines.push(s);
  reportEl.hidden = false;
  reportEl.textContent = lines.join("\n");
};
const status = (s: string) => (statusEl.textContent = s);
const step = (s: string) => {
  status(s);
  try { sessionStorage.setItem("bf-spike-step", s); } catch { /* ignore */ }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ms = (t0: number) => Math.round(performance.now() - t0);
const err = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 160);

// Report a crash from the previous run (Safari reloads a tab that ran out of memory).
try {
  const last = sessionStorage.getItem("bf-spike-step");
  if (last && last !== "done") log(`PREVIOUS RUN STOPPED during: "${last}" (tab likely crashed / out of memory)`);
} catch { /* ignore */ }

let audio: AudioContext | null = null;
function beep(freq = 1200, dur = 0.08) {
  if (!audio) return;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.25, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + dur);
}
function say(text: string) {
  cue.textContent = text;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

// Tilt from gravity: 90° = upright, 0° = flat.
const tilts: number[] = [];
function onMotion(e: DeviceMotionEvent) {
  const g = e.accelerationIncludingGravity;
  if (!g || g.y == null || g.z == null) return;
  tilts.push((Math.atan2(Math.abs(g.y), Math.abs(g.z)) * 180) / Math.PI);
  if (tilts.length > 400) tilts.shift();
}

function bodySpan(lm: NormalizedLandmark[]) {
  const ys = lm.map((p) => p.y);
  const xs = lm.map((p) => p.x);
  return { top: Math.min(...ys), bottom: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs) };
}

async function liveTest(pose: PoseLandmarker, seconds: number, label: string) {
  const times: number[] = [];
  let frames = 0;
  let spans: ReturnType<typeof bodySpan> | null = null;
  let people = 0;
  const end = performance.now() + seconds * 1000;
  let lastTs = -1;
  while (performance.now() < end) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now();
    if (now <= lastTs) continue;
    lastTs = now;
    const t0 = performance.now();
    const res = pose.detectForVideo(video, now);
    times.push(performance.now() - t0);
    frames++;
    people = Math.max(people, res.landmarks.length);
    if (res.landmarks[0]) spans = bodySpan(res.landmarks[0]);
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
  log(`${label}: ${(frames / seconds).toFixed(1)} fps, model ${avg.toFixed(0)} ms avg / ${times[Math.floor(times.length * 0.9)]?.toFixed(0)} ms p90, people seen ${people}`);
  return spans;
}

function classCounts(seg: ImageSegmenter, bitmap: ImageBitmap) {
  const t0 = performance.now();
  const res = seg.segment(bitmap);
  const t = ms(t0);
  const mask = res.categoryMask;
  const counts = new Map<number, number>();
  if (mask) {
    const a = mask.getAsUint8Array();
    for (let i = 0; i < a.length; i++) counts.set(a[i], (counts.get(a[i]) ?? 0) + 1);
    const total = a.length;
    res.close();
    const labels = seg.getLabels();
    const pct = [...counts.entries()].sort((x, y) => x[0] - y[0]).map(([k, v]) => `${labels[k] ?? k} ${((v / total) * 100).toFixed(0)}%`);
    return { t, summary: pct.join(", "), size: `${mask.width}x${mask.height}` };
  }
  res.close();
  return { t, summary: "no mask", size: "-" };
}

// Frame source for the worker test: the camera, or a blank canvas without one.
let frameSource: HTMLVideoElement | HTMLCanvasElement = video;

async function workerTest(seconds: number) {
  // A fresh worker per delegate (MediaPipe's wasm can't be set up twice in one worker).
  for (const delegate of ["GPU", "CPU"] as const) {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    } catch (e) {
      log(`Worker: could not start (${err(e)})`);
      return;
    }
    const ask = (msg: unknown, transfer: Transferable[] = []) =>
      new Promise<any>((resolve) => {
        worker.onmessage = (ev) => resolve(ev.data);
        worker.onerror = (ev) => resolve({ error: ev.message || "worker error" });
        worker.postMessage(msg, transfer);
      });
    const init = await Promise.race([ask({ type: "init", wasm: WASM, model: M("pose_landmarker_full.task"), delegate }), sleep(30000).then(() => ({ error: "timeout 30 s" }))]);
    if (init.error) { log(`Worker ${delegate}: init failed (${init.error})`); worker.terminate(); continue; }
    const times: number[] = [];
    const end = performance.now() + seconds * 1000;
    let frames = 0;
    while (performance.now() < end) {
      const bmp = await createImageBitmap(frameSource);
      const r = await ask({ type: "frame", bitmap: bmp, ts: performance.now() }, [bmp]);
      if (r.error) { log(`Worker ${delegate}: frame failed (${r.error})`); break; }
      times.push(r.ms);
      frames++;
    }
    const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
    log(`Worker ${delegate}: init ${init.ms} ms, ${(frames / seconds).toFixed(1)} fps incl. transfer, model ${avg.toFixed(0)} ms avg`);
    worker.terminate();
  }
}

async function run() {
  runBtn.disabled = true;
  copyBtn.hidden = true;
  lines.length = 0;

  // Everything that needs the tap first.
  let motion = "not available";
  try {
    const DME = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    motion = DME.requestPermission ? await DME.requestPermission() : "granted (no prompt)";
    if (motion === "granted" || motion.startsWith("granted")) addEventListener("devicemotion", onMotion);
  } catch (e) { motion = `error: ${err(e)}`; }
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
    audio = new AudioContext();
    await audio.resume();
    beep(880);
  } catch { /* ignore */ }
  say("Test started.");

  const ua = navigator.userAgent;
  log(`Blue Fit scan speed test · ${new Date().toISOString().slice(0, 16)}Z · app ${__APP_VERSION__}`);
  log(`Device: ${ua.match(/\(([^)]+)\)/)?.[1] ?? ua} · Safari ${ua.match(/Version\/([\d.]+)/)?.[1] ?? "?"}`);
  log(`Standalone (home screen): ${matchMedia("(display-mode: standalone)").matches} · CPU cores ${navigator.hardwareConcurrency ?? "?"} · screen ${screen.width}x${screen.height} @${devicePixelRatio}x`);
  let gpu = "no navigator.gpu";
  try {
    const g = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (g) gpu = (await g.requestAdapter()) ? "adapter OK" : "no adapter";
  } catch (e) { gpu = `error ${err(e)}`; }
  log(`WebGPU: ${gpu} · OffscreenCanvas: ${typeof OffscreenCanvas !== "undefined"} · audioSession: ${"audioSession" in navigator} · wakeLock: ${"wakeLock" in navigator}`);
  log(`Motion permission: ${motion} · voices: ${speechSynthesis.getVoices().length}`);

  let wake: { release: () => Promise<void> } | null = null;
  try { wake = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen"); log("Wake lock: OK"); } catch (e) { log(`Wake lock: failed (${err(e)})`); }

  // Models.
  step("Loading models");
  let t0 = performance.now();
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  log(`\nLOAD  wasm runtime: ${ms(t0)} ms`);
  const load = async <T>(label: string, f: () => Promise<T>): Promise<T | null> => {
    const t = performance.now();
    try { const r = await f(); log(`LOAD  ${label}: ${ms(t)} ms`); return r; } catch (e) { log(`LOAD  ${label}: FAILED (${err(e)})`); return null; }
  };
  const poseGpu = await load("pose full (GPU)", () => PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: M("pose_landmarker_full.task"), delegate: "GPU" }, runningMode: "VIDEO", numPoses: 2 }));
  const poseCpu = await load("pose full (CPU)", () => PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: M("pose_landmarker_full.task"), delegate: "CPU" }, runningMode: "VIDEO", numPoses: 2 }));
  const poseHeavy = await load("pose heavy (CPU, image + mask)", () => PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: M("pose_landmarker_heavy.task"), delegate: "CPU" }, runningMode: "IMAGE", numPoses: 1, outputSegmentationMasks: true }));
  const segCpu = await load("segmenter multiclass (CPU)", () => ImageSegmenter.createFromOptions(fileset, { baseOptions: { modelAssetPath: M("selfie_multiclass_256x256.tflite"), delegate: "CPU" }, runningMode: "IMAGE", outputCategoryMask: true, outputConfidenceMasks: false }));
  const segGpu = await load("segmenter multiclass (GPU)", () => ImageSegmenter.createFromOptions(fileset, { baseOptions: { modelAssetPath: M("selfie_multiclass_256x256.tflite"), delegate: "GPU" }, runningMode: "IMAGE", outputCategoryMask: true, outputConfidenceMasks: false }));

  // Camera.
  step("Opening camera");
  let stream: MediaStream;
  try {
    t0 = performance.now();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    const tr = stream.getVideoTracks()[0];
    const s = tr.getSettings() as MediaTrackSettings & { zoom?: number };
    const caps = (tr.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { zoom?: { min: number; max: number } };
    log(`\nCAMERA open ${ms(t0)} ms · got ${s.width}x${s.height} (asked 1080x1920) · video ${video.videoWidth}x${video.videoHeight} · ${s.frameRate?.toFixed?.(0) ?? "?"} fps · facing ${s.facingMode ?? "?"} · zoom ${s.zoom ?? "n/a"} (range ${caps.zoom ? `${caps.zoom.min}-${caps.zoom.max}` : "n/a"})`);
  } catch (e) {
    log(`CAMERA: FAILED (${err(e)}) · skipping the camera tests`);
    const c = document.createElement("canvas");
    c.width = 720; c.height = 1280;
    frameSource = c;
    log("");
    await workerTest(3);
    benchFit();
    finish(wake);
    return;
  }
  stage.style.display = "block";

  step("Positioning");
  say("Prop the phone upright at waist height. Then step back about one and a half meters, arms slightly out.");
  for (let i = 15; i > 0; i--) { cue.textContent = `Step back · starting in ${i}`; await sleep(1000); }
  const tiltAvg = tilts.length ? tilts.slice(-60).reduce((a, b) => a + b, 0) / Math.min(60, tilts.length) : NaN;
  log(`TILT  phone ${Number.isNaN(tiltAvg) ? "n/a" : `${tiltAvg.toFixed(1)}° (90 = upright)`}`);

  step("Live pose test");
  say("Hold still.");
  let span: ReturnType<typeof bodySpan> | null = null;
  if (poseGpu) span = await liveTest(poseGpu, 8, "\nLIVE  pose full GPU (main thread)");
  if (poseCpu) span = (await liveTest(poseCpu, 6, "LIVE  pose full CPU (main thread)")) ?? span;
  if (span) log(`FRAME body spans y ${span.top.toFixed(2)}–${span.bottom.toFixed(2)}, x ${span.left.toFixed(2)}–${span.right.toFixed(2)} of the frame (1.00 = full) · fits: ${span.top > 0 && span.bottom < 1 ? "yes" : "NO (cut off)"}`);
  else log("FRAME no body detected");

  step("Captures");
  say("Three photos now. Hold still.");
  await sleep(1500);
  for (let i = 1; i <= 3; i++) {
    const bmp = await createImageBitmap(video);
    beep(1500, 0.05);
    const line: string[] = [`CAPTURE ${i}: ${bmp.width}x${bmp.height}`];
    if (segCpu) { const r = classCounts(segCpu, bmp); line.push(`seg CPU ${r.t} ms (${r.size}: ${r.summary})`); }
    if (i === 1 && segGpu) { const r = classCounts(segGpu, bmp); line.push(`seg GPU ${r.t} ms (${r.summary})`); }
    if (poseHeavy) {
      const t = performance.now();
      const r = poseHeavy.detect(bmp);
      line.push(`pose heavy ${ms(t)} ms (${r.landmarks.length ? "body found" : "no body"}${r.segmentationMasks?.[0] ? `, mask ${r.segmentationMasks[0].width}x${r.segmentationMasks[0].height}` : ""})`);
      r.close();
    }
    bmp.close();
    log(line.join(" · "));
    await sleep(800);
  }

  step("Worker test");
  log("");
  await workerTest(5);

  say("Done with the camera. You can pick up the phone.");
  stream.getTracks().forEach((t) => t.stop());
  stage.style.display = "none";
  poseGpu?.close(); poseCpu?.close(); poseHeavy?.close(); segCpu?.close(); segGpu?.close();

  benchFit();
  finish(wake);
}

function benchFit() {
  step("Fit benchmark");
  try {
    const r = fitBenchmark();
    log(`\nFIT   synthetic 3D fit (6,890 vertices, 45 shape + 65 other params, 12 views × 400 outline points): ${r.iterMs.toFixed(0)} ms per iteration · 30 iterations ≈ ${(r.iterMs * 30 / 1000).toFixed(1)} s`);
  } catch (e) { log(`FIT   failed (${err(e)})`); }
}

function finish(wake: { release: () => Promise<void> } | null) {
  wake?.release().catch(() => {});
  removeEventListener("devicemotion", onMotion);
  step("done");
  status("Done. Tap Copy report and paste it to Claude.");
  copyBtn.hidden = false;
  runBtn.disabled = false;
  runBtn.textContent = "Run again";
}

runBtn.addEventListener("click", () => {
  run().catch((e) => { log(`STOPPED: ${err(e)}`); finish(null); });
});
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(reportEl.textContent ?? "");
    copyBtn.textContent = "Copied";
  } catch {
    const r = document.createRange();
    r.selectNodeContents(reportEl);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(r);
    copyBtn.textContent = "Selected: tap Copy";
  }
});
