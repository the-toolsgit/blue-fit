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
  /** Every earlier working set was flagged */
  all: boolean;
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
  return { sets: bad.map((b) => b.n), min: Math.min(...lefts), max: Math.max(...lefts), weight: f.weight, failReps: f.reps, all: bad.length === before.length };
}

/** "1 and 2" / "1, 2 and 3": set numbers in words, never "1–2" (reads like a rep range) */
export const andList = (n: (number | string)[]) => (n.length < 2 ? String(n[0] ?? "") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`);

/** "Regular sets" (all of them) / "Sets 1 and 2" / "Set 1" */
export function setsLabel(g: Pick<EffortGap, "sets" | "all">): string {
  const n = g.sets;
  if (g.all && n.length > 1) return "Regular sets";
  if (n.length === 1) return `Set ${n[0]}`;
  return `Sets ${andList(n)}`;
}

/** How many reps short of failure regular sets should stop (the failure set shows where failure is) */
export const REPS_SHORT = 2;

/**
 * The tip, in plain words: where failure was, and what the regular sets should do.
 * "Failure at 14 reps. Go from 8 to 12 reps to stay a couple short of failure."
 * Only some sets short: "… Go from 8 to 12 reps on sets 1 and 2 …". Different reps: "from 8 or 9".
 * If that target is past the top of the rep range, more reps isn't the answer: "The weight was too light: go heavier."
 */
export function effortLine(g: EffortGap, repMax?: number): string {
  const lo = g.failReps - g.max, hi = g.failReps - g.min;
  const from = lo === hi ? `${lo}` : `${lo} or ${hi}`, to = g.failReps - REPS_SHORT;
  const head = `Failure at ${g.failReps} reps.`;
  if (repMax != null && to > repMax) return `${head} The weight was too light: go heavier.`;
  const where = g.all ? "" : ` on ${setsLabel(g).toLowerCase()}`;
  return `${head} Go from ${from} to ${to} reps${where} to stay a couple short of failure.`;
}

/**
 * Make the "beat last time" hint agree with the effort tip: sets the failure set showed were too easy get the effort
 * tip's target (failure reps − 2) instead of +1 rep. Only when that target is inside the rep range (past it, the tip
 * says to go heavier instead). Other hints are returned as they are.
 */
export function alignHint<H extends { kind: string; targetReps?: number[] }>(hint: H, g: EffortGap | null, repMax: number): H {
  if (!g || hint.kind !== "beatReps" || !hint.targetReps) return hint;
  const to = g.failReps - REPS_SHORT;
  if (to > repMax) return hint;
  const targetReps = hint.targetReps.map((r, i) => (g.sets.includes(i + 1) ? Math.max(r, to) : r));
  return { ...hint, targetReps };
}
