// Weekly set targets: the muscle database (seed/muscles.json) gives each muscle a range per goal and the rules for how
// the training profile changes it. Units: fractional weekly sets (direct 1, indirect ½). Pure and framework-free.
import { MUSCLE_GROUPS, type Goal, type MuscleGroup, type Routine, type TrainingProfile, type VolumeTarget } from "./types";
import { ANGLES, muscleInfo, PROFILE_RULES, profileStep, RULES, type GoalKey } from "./muscles";
export type { Goal, Phase, TrainingProfile } from "./types";

export type Priority = "priority" | "normal" | "off";

/** A target's priority: off (skipped) wins; otherwise its own flag, else the app default (bold muscles). */
export const priorityOf = (group: MuscleGroup, t?: VolumeTarget): Priority =>
  t?.off || t?.acceptedBelow ? "off" : (t?.priority ?? !!MUSCLE_GROUPS.find((m) => m.id === group)?.priority) ? "priority" : "normal";

export interface ModelTarget { group: MuscleGroup; min: number; max: number; why: string[] }

/**
 * Weekly set range for a muscle: the muscle database's range for the goal (seed/muscles.json weeklySets), then the
 * profile rules from the same file (years training, age, sleep, cutting/bulking) scale it. Normal → lower half, Priority → upper half of the
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
  // Normal and Priority split the goal's range in two, no overlap (Leo, Nov 21 2026): Normal the lower half, Priority
  // the upper half (more weekly sets grow more muscle, with smaller gains as you add more: Schoenfeld 2017, Pelland 2024;
  // the halfway split is *judgment*). Maintain keeps one range.
  const mid = (min + max) / 2;
  if (goal !== "maintain" && priority === "priority") { min = mid; why.push(R.priority.why); }
  else if (goal !== "maintain") { max = mid; why.push("Normal: lower half of the range"); }

  const lo = Math.max(0, Math.round(min));
  const hi = Math.max(lo + 2, Math.round(max));
  // A minimum of 0 means "not tracked": the muscle gets no target (no green "in target" with no work)
  return { group, min: lo, max: hi, why: lo === 0 ? [...why, "Optional: not tracked unless you set a minimum"] : why };
}

/**
 * Targets for a new plan (and a muscle's "Reset to default"): every muscle targeted, none skipped, all Normal. With a
 * complete training profile, the model's numbers;
 * without one, the muscle database's growth range. (Every muscle has a database minimum since Nov 21 2026; a 0 would give
 * no target: tracked, not checked.)
 */
export function freshTargets(p: TrainingProfile | null, goal?: Goal): VolumeTarget[] {
  // All Normal (Leo, Nov 21 2026): muscles the app would make Priority by default get an explicit Normal
  return MUSCLE_GROUPS.map(({ id: g }) => ({ group: g, ...defaultRange(g, p, "normal", goal), ...(priorityOf(g) === "priority" ? { priority: false } : {}) }));
}

/**
 * A muscle's default weekly range for a priority: the model's numbers with a complete profile; without one, the muscle
 * database's range for `goal` (Mass gain when not given; Build my plan passes the goal it asked), split the same way
 * (Normal the lower half, Priority the upper half; maintain one range). The ceiling leaves 2 sets per angle. A minimum of 0 gives no target (tracked, not checked).
 */
export function defaultRange(g: MuscleGroup, p: TrainingProfile | null, priority: Exclude<Priority, "off">, goal: Goal = "growth"): { min: number | null; max: number | null } {
  let min: number, max: number;
  if (p) ({ min, max } = modelTarget(g, p, priority));
  else {
    const k: GoalKey = goal === "maintenance" ? "maintain" : goal;
    [min, max] = muscleInfo(g).weeklySets[k];
    // Same split as the model: Normal the lower half, Priority the upper half (maintain: one range)
    const mid = (min + max) / 2;
    if (k !== "maintain") { if (priority === "priority") min = mid; else max = mid; }
  }
  const lo = Math.round(min), hi = Math.round(max);
  // Room for every angle: a muscle with 2+ angles needs an exercise for each, 2 sets at least, so the ceiling is never
  // under 2 sets per angle (*judgment*, Nov 21 2026: e.g. neck's 3 angles need 6; Build my plan covers every angle)
  const angles = ANGLES[g]?.length ?? 1;
  return lo > 0 ? { min: lo, max: Math.max(lo, hi, angles > 1 ? 2 * angles : 0) } : { min: null, max: null };
}

export function modelTargets(p: TrainingProfile, priorities: Partial<Record<MuscleGroup, Priority>> = {}): ModelTarget[] {
  return MUSCLE_GROUPS.map((x) => x.id).map((g) => modelTarget(g, p, priorities[g] ?? "normal"));
}

/** A plan's targets; plans saved before targets moved onto plans (and old backups) fall back to the app-wide list. */
export const targetsOf = (r: Routine | undefined, fallback: VolumeTarget[]): VolumeTarget[] => r?.targets ?? fallback;
