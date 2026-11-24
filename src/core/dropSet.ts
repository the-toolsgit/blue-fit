// Drop sets (Nov 24 2026, Leo; plan: docs/plans/drop-sets.md). Right after the last working set, lower the weight and
// keep going with no rest. Similar growth to normal sets in less time (Sødal 2023 meta-analysis; Fink 2018); counts ½
// set toward weekly sets (core/volume.ts volumeShare).
import { failureEligible } from "./failure";
import type { Exercise, Slot } from "./types";

/** How much lighter the drop set starts: 20–25 % (common practice, *judgment*) */
export const DROP_FACTOR = 0.775;

/** Exercises whose weight changes in seconds and are safe near failure: cables and pin machines, dumbbell isolation.
 *  Never barbell, Smith or plate-loaded (stripping plates takes too long), bodyweight, holds, assisted or ★ key lifts. */
export function dropEligible(ex: Exercise | undefined): boolean {
  if (!ex || ex.isHeavy || ex.assisted || ex.measure === "time" || !failureEligible(ex)) return false;
  if (ex.equipment === "cable" || ex.equipment === "machine") return true;
  return ex.equipment === "dumbbell" && !ex.compound;
}

/** A plan slot that may get a drop set: an eligible exercise, not a heavy 6–10 slot (or lower), not in a superset. */
export const dropSlotOk = (s: Slot, ex: Exercise | undefined) => dropEligible(ex) && s.repMin >= 8 && !s.supersetGroup;

/** The drop set's starting weight: ~22.5 % lighter than the set before, rounded down to the exercise's step. */
export function dropWeight(w: number | null | undefined, incrementLb: number): number | null {
  if (w == null || w <= 0) return null;
  const step = incrementLb > 0 ? incrementLb : 5;
  const d = Math.floor((w * DROP_FACTOR) / step) * step;
  return d > 0 && d < w ? d : null;
}
