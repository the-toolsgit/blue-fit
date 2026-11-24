// Spike: does MediaPipe pose run inside a module worker on iPhone Safari?
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

let pose: PoseLandmarker | null = null;
const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (ev: MessageEvent) => {
  const d = ev.data;
  try {
    if (d.type === "init") {
      const t0 = performance.now();
      const fileset = await FilesetResolver.forVisionTasks(d.wasm, true);
      const canvas = d.delegate === "GPU" ? new OffscreenCanvas(1, 1) : undefined;
      pose = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: d.model, delegate: d.delegate },
        runningMode: "VIDEO",
        numPoses: 1,
        canvas,
      });
      post({ ms: Math.round(performance.now() - t0) });
    } else if (d.type === "frame") {
      const t0 = performance.now();
      pose!.detectForVideo(d.bitmap as ImageBitmap, d.ts);
      (d.bitmap as ImageBitmap).close();
      post({ ms: performance.now() - t0 });
    } else if (d.type === "close") {
      pose?.close();
      pose = null;
      post({});
    }
  } catch (e) {
    post({ error: (e instanceof Error ? e.message : String(e)).slice(0, 160) });
  }
};
