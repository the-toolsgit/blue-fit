// Figure animation speed from the exercise's tempo text ("Up 1 s · Hold 1 s · Down 3 s"), so the line man moves
// (and holds) at the tempo the exercise asks for. Pure, framework-free.
import { DEFAULT_TIMING, type Timing } from "./engine";

/** Figures whose pose A → B is the tempo's *second* movement (e.g. calf raise: tempo starts "Down", the figure starts at the bottom). */
const STARTS_AT_SECOND = new Set(["standing-calf-raise", "seated-calf-raise", "leg-press", "ez-bar-incline-tricep-extension", "machine-dip"]);
/** Short pause at an end of the movement that has no "Hold" in the tempo */
export const TURN_MS = 250;

export interface TempoPhases { moves: [number, number]; holdAfter: [number | null, number | null] }

/** "Up 1 s · Hold 1 s · Down 3 s" → moves [1, 3] s, hold 1 s after the first move. null if it isn't two timed moves. */
export function tempoPhases(tempo: string | undefined): TempoPhases | null {
  const parts = (tempo ?? "").split("·").map((p) => p.trim()).filter(Boolean).map((p) => ({ hold: /^hold\b/i.test(p), sec: Number(p.match(/(\d+(?:\.\d+)?)\s*s\b/)?.[1]) }));
  if (parts.some((p) => !(p.sec > 0))) return null;
  const moves: number[] = [], holdAfter: (number | null)[] = [];
  for (const p of parts) {
    if (p.hold) { if (!moves.length) return null; holdAfter[moves.length - 1] = p.sec; }
    else { moves.push(p.sec); holdAfter.push(null); }
  }
  return moves.length === 2 ? { moves: [moves[0], moves[1]], holdAfter: [holdAfter[0] ?? null, holdAfter[1] ?? null] } : null;
}
/** Seconds per movement: "Up 1 s · Down 3 s" → [1, 3]. */
export const tempoSeconds = (tempo: string | undefined) => tempoPhases(tempo)?.moves ?? null;

export function tempoTiming(tempo: string | undefined, exerciseId?: string): Timing {
  const t = tempoPhases(tempo);
  if (!t) return DEFAULT_TIMING;
  const i = exerciseId && STARTS_AT_SECOND.has(exerciseId) ? 1 : 0, j = 1 - i;
  const ms = (h: number | null) => (h == null ? TURN_MS : h * 1000);
  return { ab: t.moves[i] * 1000, holdB: ms(t.holdAfter[i]), ba: t.moves[j] * 1000, holdA: ms(t.holdAfter[j]) };
}
