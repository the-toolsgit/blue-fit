import type { Slot } from "./types";

/** Workout time: 45 s per set + the rest between sets (2 min unless given) + 1 min setup per exercise, rounded to 5 min. */
export function estimateMinutes(totalSets: number, exerciseCount: number, restSec = 120): number {
  if (totalSets <= 0) return 0;
  return Math.round((totalSets * 0.75 + ((totalSets - 1) * restSec) / 60 + exerciseCount) / 5) * 5;
}

/** Workout time from the slots themselves: each exercise's own rest (2 min when it has none), same rules as above. */
export function slotsMinutes(slots: Pick<Slot, "sets" | "restSec">[]): number {
  const sets = slots.reduce((a, s) => a + s.sets, 0);
  if (sets <= 0) return 0;
  const rest = slots.reduce((a, s) => a + s.sets * (s.restSec || 120), 0) - (slots.at(-1)!.restSec || 120);
  return Math.round((sets * 0.75 + rest / 60 + slots.length) / 5) * 5;
}
