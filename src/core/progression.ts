// Progression rule (plan page): pick a weight that reaches the bottom of the rep range.
// When every working set hits the top, add weight (the exercise's increment) and start at the bottom again.
// Otherwise, beat last time's reps.
import type { LoggedSet } from "./types";

export type Hint =
  | { kind: "none" }
  | { kind: "addWeight"; weight: number; reps: number; from: number }
  | { kind: "beatReps"; weight: number; targetReps: number[]; lastReps: number[] };

const isWork = (x: LoggedSet) => x.done && (x.type === "working" || x.type === "failure") && x.weight != null && x.reps != null;

export function progressionHint(lastSets: LoggedSet[] | undefined, repMin: number, repMax: number, increment: number): Hint {
  const work = (lastSets ?? []).filter(isWork);
  if (!work.length) return { kind: "none" };
  const top = Math.max(...work.map((x) => x.weight!));
  // Next weight: one step up, as a round number from 40 lb (multiples of 10; Leo, Nov 18 2026)
  if (work.every((x) => x.reps! >= repMax)) { const w = top + increment; return { kind: "addWeight", weight: w >= 40 ? Math.ceil(w / 10) * 10 : w, reps: repMin, from: top }; }
  const lastReps = work.map((x) => x.reps!);
  const targetReps = [...lastReps];
  const i = targetReps.findIndex((r) => r < repMax);
  if (i >= 0) targetReps[i] += 1;
  return { kind: "beatReps", weight: top, targetReps, lastReps };
}
