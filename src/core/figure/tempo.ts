// Figure animation speed from the exercise's tempo text ("Up 1 s · Down 3 s"), so the line man moves at the
// tempo the exercise asks for. Pure, framework-free.
import { DEFAULT_TIMING, type Timing } from "./engine";

/** Figures whose pose A → B is the tempo's *second* phase (e.g. calf raise: tempo starts "Down", the figure starts at the bottom). */
const STARTS_AT_SECOND = new Set(["standing-calf-raise", "seated-calf-raise", "leg-press", "ez-bar-incline-tricep-extension", "machine-dip"]);
/** Short pause at each end of the movement (not part of the tempo text) */
export const TURN_MS = 250;

/** Seconds per phase, in order: "Up 1 s · Down 3 s" → [1, 3]. null if it isn't two timed phases. */
export function tempoSeconds(tempo: string | undefined): [number, number] | null {
  const secs = (tempo ?? "").split("·").map((p) => p.match(/(\d+(?:\.\d+)?)\s*s\b/)?.[1]).map(Number);
  return secs.length === 2 && secs.every((n) => n > 0) ? [secs[0], secs[1]] : null;
}

export function tempoTiming(tempo: string | undefined, exerciseId?: string): Timing {
  const s = tempoSeconds(tempo);
  if (!s) return DEFAULT_TIMING;
  const [first, second] = exerciseId && STARTS_AT_SECOND.has(exerciseId) ? [s[1], s[0]] : s;
  return { ab: first * 1000, ba: second * 1000, hold: TURN_MS };
}
