// Blue Fit's own weekly volume model (Interview phase, draft 2). Reasoned from what a muscle needs:
//   a hard set (≈0–3 reps from failure) is the unit of stimulus; a muscle can only use so many hard sets in one
//   session; it can only be trained productively again once it has recovered; muscles with several functions
//   need sets for each function. Goal, priority and profile then shape the range.
// Units: fractional weekly sets (direct 1, indirect ½), same as the rest of the app. Pure and framework-free.
// Reasoning and sources: docs/plans/volume-targets.md §6.
import { MUSCLE_GROUPS, type MuscleGroup, type TrainingProfile, type VolumeTarget } from "./types";
export type { Goal, Phase, TrainingProfile } from "./types";

export type Priority = "priority" | "normal" | "off";

/** A target's priority: off (skipped) wins; otherwise its own flag, else the app default (bold muscles). */
export const priorityOf = (group: MuscleGroup, t?: VolumeTarget): Priority =>
  t?.off || t?.acceptedBelow ? "off" : (t?.priority ?? !!MUSCLE_GROUPS.find((m) => m.id === group)?.priority) ? "priority" : "normal";

export interface Muscle {
  /** Distinct functions/regions that need their own exercise (e.g. hamstrings: knee flexion + hip extension). */
  functions: 1 | 2 | 3;
  /** Days until it can do another productive hard session. */
  recoveryDays: number;
  why: string;
}

export const MUSCLES: Record<MuscleGroup, Muscle> = {
  back: { functions: 3, recoveryDays: 2.5, why: "3 jobs: vertical pull, row, lat stretch/upper back" },
  biceps: { functions: 2, recoveryDays: 2.5, why: "2 jobs: curl, stretched long head; damages easily (Chen 2011)" },
  triceps: { functions: 2, recoveryDays: 2.5, why: "2 jobs: overhead long head, pushdown/press" },
  sideDelts: { functions: 1, recoveryDays: 2, why: "1 job: raise out to the side; recovers fast" },
  rearDelts: { functions: 1, recoveryDays: 2, why: "1 job: pull arm back; recovers fast" },
  traps: { functions: 2, recoveryDays: 2, why: "2 jobs: shrug (upper), retract (mid/lower); recovers fast" },
  frontDelts: { functions: 1, recoveryDays: 2, why: "1 job: raise forward; presses already hit it" },
  chest: { functions: 2, recoveryDays: 2.5, why: "2 regions: upper (incline), mid/lower" },
  quads: { functions: 2, recoveryDays: 3, why: "2 jobs: squat/press, knee extension; heavy, slow to recover" },
  hamstrings: { functions: 2, recoveryDays: 3, why: "2 jobs: knee flexion, hip extension; slow to recover" },
  adductors: { functions: 1, recoveryDays: 2.5, why: "1 job: pull the leg in" },
  calves: { functions: 2, recoveryDays: 2, why: "2 muscles: straight-knee (gastroc), bent-knee (soleus); recovers fast" },
  glutes: { functions: 2, recoveryDays: 3, why: "2 jobs: hip extension, abduction; heavy, slow to recover" },
  forearms: { functions: 2, recoveryDays: 2, why: "2 groups: flexors, extensors; recovers fast" },
  // Added Nov 17 2026 (*judgment*, coaching sources: abs adapt to a lot of work and recover fast, RP; neck grows with
  // direct work, Conley 1997, trained 2–3×/week, Stump 1993). Start on Skip until the user sets a target.
  abs: { functions: 2, recoveryDays: 2, why: "2 jobs: crunch/leg raise (flexion), twist/side bend (obliques); recovers fast" },
  neck: { functions: 2, recoveryDays: 2, why: "2 jobs: flexion (front), extension (back); grows only with direct work" },
};

/** Hard sets one session can use, by number of functions (Pelland 2024: ~11 fractional sets/session, no detectable extra growth beyond). */
export const SESSION_SETS: Record<1 | 2 | 3, number> = { 1: 6, 2: 8, 3: 10 };
/** Most sessions per week worth doing for one muscle. */
export const MAX_SESSIONS = 3;

export interface ModelTarget { group: MuscleGroup; min: number; max: number; why: string[] }

/**
 * Growth (mass gain):
 *   sessions = min(3, 7 / recoveryDays)            how often it can be trained productively
 *   max      = sessions × session sets              everything it can use and recover from
 *   min      = max(6, 4 × functions)                every function trained, at least 2 sessions × 3 sets
 *   priority → min moves to the middle of the range (aim high); off → maintenance range
 * Strength: heavy sets (1–6 reps) cost more recovery per set and strength is mostly practice on the lifts,
 *   so max = 60% of growth max; min = growth min (size still drives strength).
 * Endurance: light sets (15–30+ reps) do less damage, so it can train ~½ day sooner; same per-session sets.
 * Maintenance: ⅓ of growth (Bickel 2011).
 * Profile scales the max (recovery) and, for beginners, the min.
 */
export function modelTarget(group: MuscleGroup, p: TrainingProfile, priority: Priority = "normal"): ModelTarget {
  const m = MUSCLES[group];
  // Plain reasons for the user, one per thing that changed the number (sources in the comments above).
  const why: string[] = [];
  const perSession = SESSION_SETS[m.functions];
  const sessions = (rec: number) => Math.min(MAX_SESSIONS, 7 / rec);
  const growthMax = sessions(m.recoveryDays) * perSession;
  const growthMin = Math.max(6, 4 * m.functions);

  const goal = priority === "off" ? "maintenance" : p.goal;
  let min: number, max: number;
  if (goal === "growth") { min = growthMin; max = growthMax; }
  else if (goal === "strength") { min = growthMin; max = growthMax * 0.6; why.push("Strength goal: fewer, harder sets"); }
  else if (goal === "endurance") { min = growthMin; max = sessions(Math.max(1.5, m.recoveryDays - 0.5)) * perSession; why.push("Endurance goal: light sets recover faster"); }
  else { min = Math.max(2, growthMin / 3); max = growthMax / 3; why.push(priority === "off" ? "Skipped: a third of the sets keeps what you have" : "Maintain goal: a third of the sets keeps your size"); }

  // Profile: recovery capacity scales the ceiling
  let rec = 1;
  if (p.yearsTraining < 1) { rec *= 0.75; min *= 0.75; why.push("New to lifting: less is enough"); }
  else if (p.yearsTraining >= 3) { rec *= 1.1; why.push("Lifting 3+ years: you can handle more"); }
  if (p.age >= 60) { rec *= 0.85; if (goal === "maintenance") min *= 1.5; why.push("Age 60+: slower recovery"); }
  else if (p.age >= 40) { rec *= 0.92; why.push("Age 40+: slightly slower recovery"); }
  if (p.sleepHours < 6) { rec *= 0.8; why.push("Under 6 h sleep: slower recovery"); }
  else if (p.sleepHours < 7) { rec *= 0.92; why.push("6–7 h sleep: slightly slower recovery"); }
  if (goal !== "maintenance") {
    if (p.phase === "cutting") { rec *= 0.85; why.push("Cutting: less food, slower recovery"); }
    else if (p.phase === "bulking") { rec *= 1.1; why.push("Bulking: more food, faster recovery"); }
  }
  max *= rec;
  if (min > max - 2) min = max - 2;

  if (priority === "priority" && goal !== "maintenance") { min = (min + max) / 2; why.push("Priority: top half of the range"); }

  const lo = Math.max(1, Math.round(min));
  const hi = Math.max(lo + 2, Math.round(max));
  return { group, min: lo, max: hi, why };
}

export function modelTargets(p: TrainingProfile, priorities: Partial<Record<MuscleGroup, Priority>> = {}): ModelTarget[] {
  return (Object.keys(MUSCLES) as MuscleGroup[]).map((g) => modelTarget(g, p, priorities[g] ?? "normal"));
}
