// Effort check: a set taken to failure shows how many reps the earlier sets left in the tank.
// Lifters underestimate reps left, more so the further from failure they are (Halperin 2022; Refalo 2023).
// The failure set comes last, already tired, so its reps understate what a fresh set could do: if it still beats an
// earlier set at the same weight by more than REPS_LEFT_MAX, that set surely stopped too early. The check can miss
// a set that was too easy, but never flags one that wasn't. Too-hard sets can't be told apart from fatigue, so
// they're not flagged. Pure and framework-free.
import type { LoggedSet, SessionEntry } from "./types";

/** Every set stops with 0–2 good reps left (APP_SPEC §5.19). */
export const REPS_LEFT_MAX = 2;

export interface EffortGap {
  /** Working-set numbers (1-based, warm-ups and drops not counted) that left too many reps */
  sets: number[];
  /** Reps those sets left: smallest and largest */
  min: number;
  max: number;
  weight: number;
  failReps: number;
}

const isWork = (x: LoggedSet) => x.type === "working" || x.type === "failure";

/** The set taken to failure: a done "failure" set, or (when the entry was picked for failure, not on a deload) its last working set. */
export function failureSet(e: SessionEntry, deload = false): LoggedSet | undefined {
  const marked = [...e.sets].reverse().find((x) => x.type === "failure" && x.done);
  if (marked) return marked;
  if (!e.toFailure || deload) return undefined;
  const last = [...e.sets].reverse().find(isWork);
  return last?.done ? last : undefined;
}

export function effortGap(e: SessionEntry, deload = false): EffortGap | null {
  const f = failureSet(e, deload);
  if (!f || f.reps == null || f.weight == null) return null;
  const work = e.sets.filter(isWork);
  const before = work.slice(0, work.indexOf(f));
  const bad = before.flatMap((x, i) => (x.done && x.reps != null && x.weight === f.weight && f.reps! - x.reps > REPS_LEFT_MAX ? [{ n: i + 1, left: f.reps! - x.reps }] : []));
  if (!bad.length) return null;
  const lefts = bad.map((b) => b.left);
  return { sets: bad.map((b) => b.n), min: Math.min(...lefts), max: Math.max(...lefts), weight: f.weight, failReps: f.reps };
}

/** "Sets 1–2" / "Set 1" / "Sets 1, 3" */
export function setsLabel(n: number[]): string {
  if (n.length === 1) return `Set ${n[0]}`;
  const run = n.every((x, i) => i === 0 || x === n[i - 1] + 1);
  return `Sets ${run ? `${n[0]}–${n[n.length - 1]}` : n.join(", ")}`;
}

/** "~5 reps" / "~4–6 reps" */
export const repsLeftLabel = (g: EffortGap) => `~${g.min === g.max ? g.min : `${g.min}–${g.max}`} reps`;
