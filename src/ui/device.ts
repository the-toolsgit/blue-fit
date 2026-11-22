// Browser-only helpers: sound, vibration, screen wake lock, reduced motion.
let ctx: AudioContext | null = null;

/** iOS only allows audio after a user gesture: unlock on the first tap anywhere. */
export function unlockAudio() {
  // Back from the lock screen or another app: iOS suspends (or interrupts) the audio, so wake it for the next chime
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && ctx && ctx.state !== "running") void ctx.resume().catch(() => {}); });
  const unlock = () => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx ??= new AC();
      if (ctx.state === "suspended") void ctx.resume();
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "transient";
    } catch { /* no audio */ }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
}

/** Rest-over chime: three rising tones. */
export function chime() {
  if (!ctx) return;
  if (ctx.state !== "running") void ctx.resume().catch(() => {});
  const t0 = ctx.currentTime + 0.02;
  [880, 1175, 1568].forEach((f, i) => {
    const o = ctx!.createOscillator(), g = ctx!.createGain();
    o.type = "sine"; o.frequency.value = f;
    const t = t0 + i * 0.16;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(ctx!.destination); o.start(t); o.stop(t + 0.3);
  });
}

export const vibrate = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* iOS: not supported */ } };

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let lock: { release(): Promise<void> } | null = null;
export async function keepAwake(on: boolean) {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (on && wl && !lock && document.visibilityState === "visible") lock = await wl.request("screen");
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") lock = null; });

export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
