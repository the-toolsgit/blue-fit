// Main-thread side of the web scanner: opens the front camera the way iOS Safari needs (ask landscape 4:3,
// get real portrait 3:4; spike Nov 24 2026), pumps frames to the worker, and wraps its messages in promises.
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { BodyGeometry } from "../../core/body/types";
import type { Measured } from "../../core/body/measure";
import type { RoomStats } from "./guide";
import { FIT_H, FIT_W } from "./constants";

export interface PoseFrame { people: number; landmarks: NormalizedLandmark[] | null; world: NormalizedLandmark[] | null }
/** Fit quality per photo and the fitted camera: for the scan report (no body values). */
export interface FitReport { iou: number[]; rmsPx: number[]; yawDeg: number[]; pitchDeg: number; pitchGuessDeg: number; focal: number; camH: number; iterations: number; masks: string[]; shapeMax: number }
/** One photo's outline (FIT_W×FIT_H, 1 = body) and the fitted body's, for the on-phone check; kept in memory only. */
export interface FitView { hour: number; photo: Uint8Array; model: Uint8Array }
export interface Fitted { ok: boolean; reason?: string; ms: number; geometry: BodyGeometry; measured: Measured; report: FitReport; views: FitView[] }

/** Open the front camera in portrait. Throws a readable error. */
export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't use the camera.");
  // iOS swaps width and height: asking landscape 4:3 returns portrait 3:4 with the full top-to-bottom view
  const asks: MediaTrackConstraints[] = [
    { facingMode: "user", width: { exact: 1920 }, height: { exact: 1440 } },
    { facingMode: "user", width: { exact: 1440 }, height: { exact: 1920 } },
    { facingMode: "user", width: { ideal: 1440 }, height: { ideal: 1920 } },
  ];
  let last: unknown = null;
  for (const c of asks) {
    let s: MediaStream | null = null;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: c, audio: false });
      video.srcObject = s;
      await video.play();
      for (let i = 0; i < 20 && !video.videoWidth; i++) await new Promise((r) => setTimeout(r, 50));
      if (video.videoHeight > video.videoWidth) return s;
      s.getTracks().forEach((t) => t.stop());
    } catch (e) {
      s?.getTracks().forEach((t) => t.stop());
      last = e;
      if ((e as Error).name === "NotAllowedError") throw new Error("Camera access is off. Allow it for this site in Settings → Safari → Camera.");
    }
  }
  throw new Error(last ? "This phone's camera isn't supported yet." : "Couldn't get an upright camera picture.");
}

export class ScanWorker {
  private w: Worker;
  private next = 1;
  private waiting = new Map<number, (m: any) => void>();
  onReady?: (m: { ms: number; delegate: string }) => void;
  constructor() {
    this.w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.w.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "ready") { this.ready(m); return; }
      const f = this.waiting.get(m.id);
      if (f) { this.waiting.delete(m.id); f(m); }
    };
  }
  private ready: (m: any) => void = () => {};
  /** Load the models (seconds; start early, e.g. on the Weight & Height step). */
  init(): Promise<{ ms: number; delegate: string }> {
    return new Promise((ok, fail) => {
      this.ready = ok;
      this.w.onerror = (e) => fail(new Error(e.message || "The scanner couldn't start."));
      this.w.postMessage({ type: "init", base: import.meta.env.BASE_URL });
    });
  }
  private ask<T>(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> {
    const id = this.next++;
    return new Promise((ok, fail) => {
      this.waiting.set(id, (m) => (m.type === "error" ? fail(new Error(m.error)) : ok(m)));
      this.w.postMessage({ ...msg, id }, transfer);
    });
  }
  async pose(video: HTMLVideoElement): Promise<PoseFrame> {
    const bitmap = await createImageBitmap(video, { resizeWidth: 360, resizeHeight: 480 });
    return this.ask({ type: "frame", bitmap, ts: performance.now() }, [bitmap]);
  }
  async room(video: HTMLVideoElement): Promise<RoomStats | null> {
    const bitmap = await createImageBitmap(video, { resizeWidth: 240, resizeHeight: 320 });
    return (await this.ask<{ stats: RoomStats | null }>({ type: "room", bitmap }, [bitmap])).stats;
  }
  /** Capture one hour: a 3× fit-size frame (sharper outline after downsampling), processed and dropped in the worker. */
  async capture(video: HTMLVideoElement, hour: number): Promise<boolean> {
    const bitmap = await createImageBitmap(video, { resizeWidth: FIT_W * 2, resizeHeight: FIT_H * 2 });
    return (await this.ask<{ ok: boolean }>({ type: "capture", bitmap, hour }, [bitmap])).ok;
  }
  reset() { return this.ask({ type: "reset" }); }
  /** pitch: the phone's camera pitch during the photos (radians, + = looking up). */
  fit(heightCm: number, sex: "male" | "female", pitch: number): Promise<Fitted> {
    return this.ask({ type: "fit", heightCm, sex, pitch, base: import.meta.env.BASE_URL });
  }
  close() { this.w.terminate(); this.waiting.clear(); }
}
