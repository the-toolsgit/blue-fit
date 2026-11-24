// Puts the body-scan model files in public/ so the app serves them itself
// (no CDN at runtime). Models come from Google's official MediaPipe storage
// (Apache-2.0); the wasm runtime is copied from node_modules. Both folders are
// git-ignored and rebuilt on every build (skipped when already present).
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MODELS = {
  "pose_landmarker_full.task":
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
  "pose_landmarker_heavy.task":
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task",
  "selfie_multiclass_256x256.tflite":
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
};

const modelsDir = "public/models";
const wasmDir = "public/mediapipe";
mkdirSync(modelsDir, { recursive: true });
mkdirSync(wasmDir, { recursive: true });

const src = "node_modules/@mediapipe/tasks-vision/wasm";
for (const f of readdirSync(src)) copyFileSync(join(src, f), join(wasmDir, f));

for (const [name, url] of Object.entries(MODELS)) {
  const out = join(modelsDir, name);
  if (existsSync(out) && statSync(out).size > 0) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`fetched ${name} (${(statSync(out).size / 1e6).toFixed(1)} MB)`);
}
