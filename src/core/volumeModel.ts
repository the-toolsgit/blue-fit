// Weekly set targets: the muscle database (seed/muscles.json) gives each muscle a range per goal and the rules for how
// the training profile changes it. Units: fractional weekly sets (direct 1, indirect ½). Pure and framework-free.
import { MUSCLE_GROUPS, type MuscleGroup, type TrainingProfile, type VolumeTarget } from "./types";
import { muscleInfo, PROFILE_RULES, profileStep, RULES, type GoalKey } from "./muscles";
export type { Goal, Phase, TrainingProfile } from "./types";

export type Priority = "priority" | "normal" | "off";

/** A target's priority: off (skipped) wins; otherwise its own flag, else the app default (bold muscles). */
export const priorityOf = (group: MuscleGroup, t?: VolumeTarget): Priority =>
  t?.off || t?.acceptedBelow ? "off" : (t?.priority ?? !!MUSCLE_GROUPS.find((m) => m.id === group)?.priority) ? "priority" : "normal";

export interface ModelTarget { group: MuscleGroup; min: number; max: number; why: string[] }

/**
 * Weekly set range for a muscle: the muscle database's range for the goal (seed/muscles.json weeklySets), then the
 * profile rules from the same file (years training, age, sleep, cutting/bulking) scale it. Priority → top half of the
 * range; skipped → no sets.
 */
export function modelTarget(group: MuscleGroup, p: TrainingProfile, priority: Priority = "normal"): ModelTarget {
  // Skipped muscles aren't trained or checked: no sets
  if (priority === "off") return { group, min: 0, max: 0, why: ["Skipped: not trained"] };
  const m = muscleInfo(group);
  const R = PROFILE_RULES;
  const why: string[] = [];
  const goal: GoalKey = p.goal === "maintenance" ? "maintain" : p.goal;
  let [min, max] = m.weeklySets[goal];
  if (goal !== "growth") why.push(RULES.goalWhy[goal]);

  // Profile: the ceiling follows recovery; beginners need less
  let rec = 1;
  for (const step of [profileStep(R.yearsTraining, p.yearsTraining), profileStep(R.age, p.age), profileStep(R.sleepHours, p.sleepHours)]) {
    if (!step) continue;
    if (step.max) rec *= step.max;
    if (step.min) min *= step.min;
    if (step.maintainMin && goal === "maintain") min *= step.maintainMin;
    if (step.why) why.push(step.why);
  }
  if (goal !== "maintain" && (p.phase === "cutting" || p.phase === "bulking")) { rec *= R.phase[p.phase].max; why.push(R.phase[p.phase].why); }
  max *= rec;
  if (max > 0 && min > max - 2) min = Math.max(0, max - 2);
  // Priority on mass gain: more sets (more weekly sets grow more muscle, with smaller gains as you add more;
  // Schoenfeld 2017, Pelland 2024). Minimum to the middle, ceiling +25% (*judgment*). Other goals: the top half.
  if (priority === "priority" && goal === "growth") { min = (min + max) / 2; max *= R.priority.maxGrowth; why.push(R.priority.why); }
  else if (priority === "priority" && goal !== "maintain") { min = (min + max) / 2; why.push("Priority: top half of the range"); }

  const lo = Math.max(0, Math.round(min));
  const hi = Math.max(lo + 2, Math.round(max));
  // A minimum of 0 means "not tracked": the muscle gets no target (no green "in target" with no work)
  return { group, min: lo, max: hi, why: lo === 0 ? [...why, "Optional: not tracked unless you set a minimum"] : why };
}

export function modelTargets(p: TrainingProfile, priorities: Partial<Record<MuscleGroup, Priority>> = {}): ModelTarget[] {
  return MUSCLE_GROUPS.map((x) => x.id).map((g) => modelTarget(g, p, priorities[g] ?? "normal"));
}
