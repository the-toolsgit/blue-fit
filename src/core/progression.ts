// Progression (double progression): pick a weight that reaches the bottom of the rep range, add reps until every set
// reaches the top, then add weight (the exercise's increment) and start at the bottom again.
// Ready for more weight only when the top isn't a one-off (Leo, Nov 18 2026; thresholds are *judgment*):
//  • every regular set reached the top two workouts in a row (workouts, not weeks), only for exercises the app
//    can't test with a failure set (Leo, Nov 24 2026: failure-safe exercises always prove it with a test first), or
//  • the failure set beat the top by 2+ reps (it shows the reps you really had left), or
//  • the failure set shows even the bottom-of-the-effort target is past the range (failure reps − 2 > top).
// Top reached without that proof → "hold": stay at the same weight (the app tests it with a failure set when it
// safely can, core/failure.ts). A failed test → one more workout at that weight, then test again.
import type { LoggedSet } from "./types";

export type Hint =
  | { kind: "none" }
  | { kind: "addWeight"; weight: number; reps: number; from: number }
  | { kind: "hold"; weight: number; reps: number }
  | { kind: "beatReps"; weight: number; targetReps: number[]; lastReps: number[] };

/** One past workout of the exercise: its sets and its failure set, if one was taken to failure. */
export interface PastSets { sets: LoggedSet[]; fail?: LoggedSet }

/** Failure set reps above the top that prove you're ready for more weight (*judgment*) */
export const READY_MARGIN = 2;

/** No weight = bodyweight only, counted as 0 added load (Nov 22 2026) */
const isWork = (x: LoggedSet) => x.done && (x.type === "working" || x.type === "failure") && x.reps != null;
const load = (x: LoggedSet) => x.weight ?? 0;

/** Whether every regular set (the failure set left out) at the top weight reached the top of the range. */
export function atTop(p: PastSets | undefined, repMax: number): boolean {
  const work = (p?.sets ?? []).filter(isWork);
  if (!work.length) return false;
  const top = Math.max(...work.map(load));
  const regular = work.filter((x) => x !== p!.fail && x.type !== "failure");
  const judged = (regular.length ? regular : work).filter((x) => load(x) === top);
  return judged.length > 0 && judged.every((x) => x.reps! >= repMax);
}

/** Next weight: one step up, as a round number from 40 lb (multiples of 10; Leo, Nov 18 2026) */
const nextWeight = (w: number, inc: number) => { const n = w + inc; return n >= 40 ? Math.ceil(n / 10) * 10 : n; };

/**
 * How much to add when the failure set shows the weight was too light (Leo, Nov 19 2026; *judgment*, each spare rep ≈
 * 2–3 % of the load): reps past the target (a couple short of failure = failure − 2) beyond the top of the range,
 * 1–2 → +5 lb, 3+ → +10 lb. Steps of 5 lb allowed here.
 */
export function failureJump(failReps: number, repMax: number): number {
  return failReps - READY_MARGIN - repMax >= 3 ? 10 : 5;
}

/** Weight after a failure set that shows the weight was too light: the jump above, never less than the normal step
 *  (so 13 reps never gives less than 12; Leo, Nov 21 2026). */
export function failureWeight(top: number, failReps: number, repMax: number, increment: number): number {
  return Math.max(top + failureJump(failReps, repMax), nextWeight(top, increment));
}

export function progressionHint(lastSets: LoggedSet[] | undefined, repMin: number, repMax: number, increment: number,
  opts: { fail?: LoggedSet; prev?: PastSets; time?: boolean; testable?: boolean } = {}): Hint {
  // Holds (seconds; *judgment*, coaching): every set held to the top of the range → add a little weight, back to the
  // bottom of the range; otherwise add 5 s to the first set that fell short.
  if (opts.time) {
    const held = (lastSets ?? []).filter((x) => x.done && (x.type === "working" || x.type === "failure") && x.reps != null);
    if (!held.length) return { kind: "none" };
    const top = Math.max(...held.map((x) => x.weight ?? 0));
    if (held.every((x) => x.reps! >= repMax)) return { kind: "addWeight", weight: nextWeight(top, increment), reps: repMin, from: top };
    const lastReps = held.map((x) => x.reps!), targetReps = [...lastReps];
    const i = targetReps.findIndex((r) => r < repMax);
    if (i >= 0) targetReps[i] = Math.min(repMax, targetReps[i] + 5);
    return { kind: "beatReps", weight: top, targetReps, lastReps };
  }
  const work = (lastSets ?? []).filter(isWork);
  if (!work.length) return { kind: "none" };
  const top = Math.max(...work.map(load));
  const last: PastSets = { sets: work, fail: opts.fail ?? work.find((x) => x.type === "failure") };
  const f = last.fail && load(last.fail) === top && last.fail.reps != null ? last.fail.reps : null;
  const topNow = atTop(last, repMax);
  const proven = f != null && f >= repMax + READY_MARGIN;
  const twice = !opts.testable && topNow && atTop(opts.prev, repMax) && Math.max(...(opts.prev?.sets ?? []).filter(isWork).map(load)) >= top;
  // The failure set says too light: add by how far past (5 or 10 lb), never less than the normal step
  if (f != null && f - READY_MARGIN > repMax) return { kind: "addWeight", weight: failureWeight(top, f, repMax, increment), reps: repMin, from: top };
  if (topNow && (proven || twice)) return { kind: "addWeight", weight: nextWeight(top, increment), reps: repMin, from: top };
  if (topNow) return { kind: "hold", weight: top, reps: repMax };
  const lastReps = work.map((x) => x.reps!);
  const targetReps = [...lastReps];
  const i = targetReps.findIndex((r) => r < repMax);
  if (i >= 0) targetReps[i] += 1;
  return { kind: "beatReps", weight: top, targetReps, lastReps };
}

/** Whether this exercise should test with a failure set next time: top reached last time, no failure set to prove it.
 *  After a failed test the next workout has a failure set, so it waits one workout, then tests again (Leo, Nov 24 2026). */
export function needsTest(last: PastSets | undefined, repMax: number): boolean {
  return !!last && !last.fail && !last.sets.some((x) => x.done && x.type === "failure") && atTop(last, repMax);
}
