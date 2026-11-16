// Blue Fit's own weekly volume model (Interview phase, draft 2). Reasoned from what a muscle needs:
//   a hard set (≈0–3 reps from failure) is the unit of stimulus; a muscle can only use so many hard sets in one
//   session; it can only be trained productively again once it has recovered; muscles with several functions
//   need sets for each function. Goal, priority and profile then shape the range.
// Units: fractional weekly sets (direct 1, indirect ½), same as the rest of the app. Pure and framework-free.
// Reasoning and sources: docs/plans/volume-targets.md §6.
import type { MuscleGroup } from "./types";

export type Goal = "growth" | "strength" | "endurance" | "maintenance";
export type Phase = "cutting" | "maintaining" | "bulking";
export type Priority = "priority" | "normal" | "off";

export interface TrainingProfile {
  goal: Goal;
  phase: Phase;
  age: number;
  yearsTraining: number;
  sleepHours: number;
}

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
  rotatorCuff: { functions: 1, recoveryDays: 2, why: "1 job: rotate and stabilize the shoulder" },
  forearms: { functions: 2, recoveryDays: 2, why: "2 groups: flexors, extensors; recovers fast" },
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
  const why = [m.why];
  const perSession = SESSION_SETS[m.functions];
  const sessions = (rec: number) => Math.min(MAX_SESSIONS, 7 / rec);
  const growthMax = sessions(m.recoveryDays) * perSession;
  const growthMin = Math.max(6, 4 * m.functions);

  const goal = priority === "off" ? "maintenance" : p.goal;
  let min: number, max: number;
  if (goal === "growth") { min = growthMin; max = growthMax; }
  else if (goal === "strength") { min = growthMin; max = growthMax * 0.6; why.push("strength: heavy sets, fewer but harder"); }
  else if (goal === "endurance") { min = growthMin; max = sessions(Math.max(1.5, m.recoveryDays - 0.5)) * perSession; why.push("endurance: light sets recover sooner"); }
  else { min = Math.max(2, growthMin / 3); max = growthMax / 3; why.push(priority === "off" ? "not a focus: keep what you have (⅓, Bickel 2011)" : "maintenance: ⅓ keeps size (Bickel 2011)"); }

  // Profile: recovery capacity scales the ceiling
  let rec = 1;
  if (p.yearsTraining < 1) { rec *= 0.75; min *= 0.75; why.push("new to training: less is enough"); }
  else if (p.yearsTraining >= 3) { rec *= 1.1; why.push("3+ years: tolerates more"); }
  if (p.age >= 60) { rec *= 0.85; if (goal === "maintenance") min *= 1.5; why.push("60+: slower recovery, needs more to maintain (Bickel 2011)"); }
  else if (p.age >= 40) { rec *= 0.92; why.push("40+: a bit slower recovery"); }
  if (p.sleepHours < 6) { rec *= 0.8; why.push("under 6 h sleep: less recovery (Lamon 2021)"); }
  else if (p.sleepHours < 7) { rec *= 0.92; why.push("6–7 h sleep: a bit less recovery"); }
  if (goal !== "maintenance") {
    if (p.phase === "cutting") { rec *= 0.85; why.push("cutting: less fuel to recover and grow (Murphy & Koehler 2022)"); }
    else if (p.phase === "bulking") { rec *= 1.1; why.push("bulking: extra fuel, recovers more"); }
  }
  max *= rec;
  if (min > max - 2) min = max - 2;

  if (priority === "priority" && goal !== "maintenance") { min = (min + max) / 2; why.push("priority: aim for the top half"); }

  const lo = Math.max(1, Math.round(min));
  const hi = Math.max(lo + 2, Math.round(max));
  return { group, min: lo, max: hi, why };
}

export function modelTargets(p: TrainingProfile, priorities: Partial<Record<MuscleGroup, Priority>> = {}): ModelTarget[] {
  return (Object.keys(MUSCLES) as MuscleGroup[]).map((g) => modelTarget(g, p, priorities[g] ?? "normal"));
}
