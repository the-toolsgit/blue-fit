// Personal records, derived from logged sets (never stored). Warm-ups never count.
import { epley } from "./oneRm";
import type { LoggedSet, Session } from "./types";
import { countsForLoad } from "./volume";

export interface ExerciseRecords {
  heaviest: { weight: number; reps: number; date: string } | null;
  bestE1rm: { value: number; weight: number; reps: number; date: string } | null;
  /** weight → most reps done at exactly that weight */
  repsAtWeight: Map<number, number>;
  bestSessionVolume: { value: number; date: string } | null;
}

const valid = (x: LoggedSet) => x.done && countsForLoad(x.type) && x.weight != null && x.reps != null && x.reps > 0;

export function emptyRecords(): ExerciseRecords {
  return { heaviest: null, bestE1rm: null, repsAtWeight: new Map(), bestSessionVolume: null };
}

/** `time`: a hold (reps are seconds): no est. 1RM or volume, the "reps" record is the longest hold at a weight. */
export function addSetToRecords(r: ExerciseRecords, x: LoggedSet, date: string, time = false) {
  if (!valid(x)) return;
  const w = x.weight!, reps = x.reps!;
  if (!r.heaviest || w > r.heaviest.weight || (w === r.heaviest.weight && reps > r.heaviest.reps)) r.heaviest = { weight: w, reps, date };
  const e = epley(w, reps);
  if (!time && (!r.bestE1rm || e > r.bestE1rm.value)) r.bestE1rm = { value: e, weight: w, reps, date };
  if (reps > (r.repsAtWeight.get(w) ?? 0)) r.repsAtWeight.set(w, reps);
}

export const entryVolume = (sets: LoggedSet[], time = false) => time ? 0 : sets.filter(valid).reduce((a, x) => a + x.weight! * x.reps!, 0);

/** Records for one exercise across sessions (optionally excluding one session, e.g. the active one). */
export function computeRecords(sessions: Session[], exerciseId: string, excludeSessionId?: string, time = false): ExerciseRecords {
  const r = emptyRecords();
  for (const s of sessions) {
    if (s.id === excludeSessionId) continue;
    let vol = 0;
    for (const e of s.entries) if (e.exerciseId === exerciseId) { e.sets.forEach((x) => addSetToRecords(r, x, s.date, time)); vol += entryVolume(e.sets, time); }
    if (vol > 0 && (!r.bestSessionVolume || vol > r.bestSessionVolume.value)) r.bestSessionVolume = { value: vol, date: s.date };
  }
  return r;
}

export type PrKind = "weight" | "e1rm" | "reps" | "volume";
export const PR_LABEL: Record<PrKind, string> = { weight: "Heaviest weight", e1rm: "Best est. 1RM", reps: "Most reps at this weight", volume: "Best session volume" };

/**
 * PRs a set sets against previous records. With no history for the exercise nothing is a PR
 * (the first session just sets the baseline). "Reps" only counts at a weight done before.
 */
export function prsForSet(prev: ExerciseRecords, x: LoggedSet): PrKind[] {
  if (!valid(x) || !prev.heaviest) return [];
  const out: PrKind[] = [];
  const w = x.weight!, reps = x.reps!;
  if (w > prev.heaviest.weight) out.push("weight");
  if (prev.bestE1rm && epley(w, reps) > prev.bestE1rm.value + 1e-9) out.push("e1rm");
  const at = prev.repsAtWeight.get(w);
  if (at != null && reps > at) out.push("reps");
  return out;
}

/** PRs reached by one entry of a session vs. history (used for alerts and the finish summary). */
export function prsForEntry(history: Session[], sessionId: string, exerciseId: string, sets: LoggedSet[], date: string, time = false): PrKind[] {
  const prev = computeRecords(history, exerciseId, sessionId, time);
  if (!prev.heaviest) return [];
  const found = new Set<PrKind>();
  const running = cloneRecords(prev);
  for (const x of sets) { prsForSet(running, x).forEach((k) => found.add(k)); addSetToRecords(running, x, date, time); }
  if (prev.bestSessionVolume && entryVolume(sets, time) > prev.bestSessionVolume.value) found.add("volume");
  return [...found];
}

export function cloneRecords(r: ExerciseRecords): ExerciseRecords {
  return { ...r, repsAtWeight: new Map(r.repsAtWeight) };
}
