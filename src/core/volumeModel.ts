// Blue Fit's own weekly volume model: goal × muscle factors × training profile → a min–max weekly set target
// per muscle (fractional sets: direct 1, indirect ½, same as the rest of the app). Pure and framework-free.
// Every number is either sourced (see `source`) or marked as our judgment (see docs/plans/volume-targets.md §6).
import type { MuscleGroup } from "./types";

export type Goal = "growth" | "strength" | "endurance" | "maintenance";
export type Phase = "cutting" | "maintaining" | "bulking";

export interface TrainingProfile {
  goal: Goal;
  phase: Phase;
  age: number;
  yearsTraining: number;
  sleepHours: number;
}

/** Base weekly sets for a large reference muscle, per goal. */
export const GOAL_BASE: Record<Goal, { min: number; max: number; source: string }> = {
  growth: { min: 10, max: 20, source: "Schoenfeld 2017 (10+ sets trend best); Baz-Valle 2022 (12–20 ≈ more than 20); Pelland 2024 (keeps rising, smaller gains)" },
  strength: { min: 6, max: 12, source: "Judgment anchored on Ralston 2017 (medium/high weekly sets beat low) and Pelland 2024 (strength returns level off sooner than size)" },
  endurance: { min: 10, max: 20, source: "Judgment: no volume study found for local endurance; endurance comes from higher reps and shorter rest, so volume stays like growth" },
  maintenance: { min: 4, max: 7, source: "Bickel 2011: one third of training volume kept muscle size in young adults" },
};

/** 0 = low, 1 = medium, 2 = high */
type Level = 0 | 1 | 2;
export interface MuscleFactors {
  /** Size: bigger muscles need more sets before growth starts and have room for more exercises/angles. */
  size: Level;
  /** How easily it gets damaged/sore from hard sets (slower recovery → lower ceiling). */
  damage: Level;
  /** Joint/tendon load at high volume (lower ceiling). */
  joint: Level;
  why: string;
}

/** Judgment unless a source is named in `why`. Chen 2011: elbow flexors/extensors more damage-prone than knee muscles; knee flexors more than knee extensors. */
export const MUSCLE_FACTORS: Record<MuscleGroup, MuscleFactors> = {
  back: { size: 2, damage: 0, joint: 1, why: "large; lower back takes load on rows" },
  biceps: { size: 0, damage: 2, joint: 1, why: "small; damages easily (Chen 2011); elbow tendons" },
  triceps: { size: 1, damage: 2, joint: 1, why: "medium; damages easily (Chen 2011); elbow tendons" },
  sideDelts: { size: 0, damage: 0, joint: 1, why: "small; recovers fast; shoulder joint" },
  rearDelts: { size: 0, damage: 0, joint: 0, why: "small; recovers fast; light joint load" },
  traps: { size: 1, damage: 0, joint: 0, why: "medium; recovers fast" },
  frontDelts: { size: 0, damage: 0, joint: 1, why: "small; shoulder joint; presses already work it" },
  chest: { size: 1, damage: 0, joint: 1, why: "medium; shoulder joint on presses" },
  quads: { size: 2, damage: 0, joint: 1, why: "large; least damage-prone (Chen 2011); knees" },
  hamstrings: { size: 1, damage: 1, joint: 0, why: "medium; more damage-prone than quads (Chen 2011)" },
  adductors: { size: 1, damage: 0, joint: 0, why: "medium" },
  calves: { size: 0, damage: 0, joint: 0, why: "small; used all day, recovers fast" },
  glutes: { size: 2, damage: 0, joint: 0, why: "large" },
  rotatorCuff: { size: 0, damage: 0, joint: 2, why: "small; shoulder joint stability, keep volume moderate" },
  forearms: { size: 0, damage: 0, joint: 1, why: "small; elbow tendons" },
};

/** Per-session cap: Pelland 2024 found no detectable extra growth beyond ~11 fractional sets in one session. */
export const SETS_PER_SESSION_CAP = 11;

export interface ModelTarget { group: MuscleGroup; min: number; max: number; why: string[] }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Model target for one muscle.
 * min = base.min × (0.6 + 0.2·size) × profile min factor
 * max = base.max × (0.8 + 0.1·size − 0.05·damage − 0.05·joint) × profile max factors, capped at 11 × days the plan trains it
 * Rounded to whole sets; max is always at least min + 2.
 */
export function modelTarget(group: MuscleGroup, p: TrainingProfile, daysPerWeek?: number): ModelTarget {
  const base = GOAL_BASE[p.goal], f = MUSCLE_FACTORS[group];
  const why = [f.why];
  let min = base.min * (0.6 + 0.2 * f.size);
  let max = base.max * (0.8 + 0.1 * f.size - 0.05 * f.damage - 0.05 * f.joint);

  // Profile (judgment unless noted)
  if (p.yearsTraining < 1) { min *= 0.7; max *= 0.8; why.push("new to training: less is enough"); }
  else if (p.yearsTraining > 3) { max *= 1.1; why.push("3+ years training: higher ceiling"); }
  if (p.age >= 60) { max *= 0.85; if (p.goal === "maintenance") min *= 1.5; why.push("60+: slower recovery; needs more to maintain (Bickel 2011)"); }
  else if (p.age >= 40) { max *= 0.9; why.push("40+: slower recovery"); }
  if (p.sleepHours < 6) { max *= 0.8; why.push("under 6 h sleep: less recovery (Lamon 2021)"); }
  else if (p.sleepHours < 7) { max *= 0.9; why.push("6–7 h sleep: a bit less recovery"); }
  if (p.phase === "cutting" && p.goal !== "maintenance") { max *= 0.85; why.push("cutting: less room to grow (Murphy & Koehler 2022)"); }
  else if (p.phase === "bulking" && p.goal !== "maintenance") { max *= 1.05; why.push("bulking: a bit more room"); }
  if (daysPerWeek != null && daysPerWeek >= 1 && max > SETS_PER_SESSION_CAP * daysPerWeek) {
    max = SETS_PER_SESSION_CAP * daysPerWeek;
    why.push(`trained ${daysPerWeek} day${daysPerWeek === 1 ? "" : "s"} a week: about ${SETS_PER_SESSION_CAP} sets per session is the useful limit (Pelland 2024)`);
  }

  const lo = Math.max(1, Math.round(min));
  const hi = Math.max(lo + 2, Math.round(max));
  return { group, min: clamp(lo, 1, 40), max: clamp(hi, lo + 2, 42), why };
}

export function modelTargets(p: TrainingProfile, days: Partial<Record<MuscleGroup, number>> = {}): ModelTarget[] {
  return (Object.keys(MUSCLE_FACTORS) as MuscleGroup[]).map((g) => modelTarget(g, p, days[g]));
}
