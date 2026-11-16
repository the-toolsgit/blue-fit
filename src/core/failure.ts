// "Last set to failure" (mass gain only). Research (Robinson 2024; Refalo 2023): growth rises as sets end closer to
// failure; true failure adds little and costs more fatigue, so it's kept to the last set of safe, low-fatigue
// isolation / machine / cable moves, never heavy compound lifts. Leo can turn it on or off per exercise in his plan.
import type { Exercise, Goal, Slot } from "./types";

/** Built-in exercises that default to "last set to failure". */
export const FAILURE_DEFAULT = [
  "single-arm-cable-lat-pulldown", "straight-arm-cable-pulldown", "db-incline-curl", "barbell-preacher-curl",
  "cable-lateral-raise", "overhead-trap", "machine-reverse-fly", "leg-extension", "prone-leg-curl", "hip-adduction",
  "standing-calf-raise", "v-bar-pushdown", "rope-face-pull", "lean-away-lateral-raise", "all-the-way-up-lateral-raise",
  "kelso-shrug", "single-arm-cable-reverse-fly", "rope-overhead-tricep-extension", "seated-leg-curl", "seated-calf-raise",
  "cable-one-arm-tricep-kickback",
] as const;

/** Only the mass-gain goal uses it. No profile yet counts as mass gain (the profile's default goal). */
export const failureApplies = (goal: Goal | undefined) => (goal ?? "growth") === "growth";

/** Whether this exercise (in this plan slot) takes its last set to failure. */
export const lastSetToFailure = (ex: Exercise | undefined, slot?: Slot) => slot?.toFailure ?? ex?.failureLastSet ?? false;
