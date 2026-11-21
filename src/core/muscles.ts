// The muscle database (seed/muscles.json): one place for everything the app knows about each muscle. The Plan check,
// recovery, weekly target suggestions and the muscle page (scripts/muscle-doc.ts) all read it. Pure and framework-free.
import db from "./seed/muscles.json";
import type { MuscleGroup } from "./types";

export type GoalKey = "growth" | "strength" | "endurance" | "maintain";
export interface MuscleInfo {
  id: MuscleGroup; name: string; side: "front" | "back" | "both"; size: "big" | "small"; priority: boolean;
  does: string;
  angles: { name: string; what: string; examples: string[] }[];
  stretch: { how: string; evidence: string; note?: string; check?: boolean } | null;
  heavyLight: { needs: boolean; why: string; evidence: string };
  recoveryHours: { value: number; evidence: string; note?: string };
  failure: { safe: string; avoid: string; evidence: string };
  keyLifts: string;
  weeklySets: Record<GoalKey, [number, number]>;
  setup: string[]; tips: string[]; avoid: string[];
}
type Step = { under?: number; from?: number; min?: number; max?: number; maintainMin?: number; extraDay?: boolean; why: string };
export interface ProfileRules {
  yearsTraining: Step[]; age: Step[]; sleepHours: Step[];
  phase: Record<"cutting" | "bulking", { max: number; why: string }>;
  priority: { why: string };
}

export const MUSCLE_DB = db.muscles as unknown as MuscleInfo[];
const BY_ID = new Map(MUSCLE_DB.map((m) => [m.id, m]));
export const muscleInfo = (g: MuscleGroup): MuscleInfo => BY_ID.get(g)!;
export const PROFILE_RULES = db.profile as unknown as ProfileRules;
export const RULES = db.rules;

/** Angles per muscle (only muscles with 2+: one angle needs no check). Names match exercise `jobs` tags. */
export const ANGLES: Partial<Record<MuscleGroup, string[]>> = Object.fromEntries(
  MUSCLE_DB.filter((m) => m.angles.length > 1).map((m) => [m.id, m.angles.map((a) => a.name)]));
/** Muscles the Stretch check asks about */
export const STRETCH_CHECKED = new Set<MuscleGroup>(MUSCLE_DB.filter((m) => m.stretch && m.stretch.check !== false).map((m) => m.id));
/** Muscles that should get both heavy and light sets */
export const NEEDS_HEAVY_LIGHT = new Set<MuscleGroup>(MUSCLE_DB.filter((m) => m.heavyLight.needs).map((m) => m.id));
/** Days a muscle needs after hard work before it's fresh again */
export const recoveryDaysOf = (g: MuscleGroup) => (BY_ID.get(g)?.recoveryHours.value ?? 48) / 24;
/** First matching step of a profile rule */
export const profileStep = (steps: Step[], v: number | null | undefined): Step | undefined =>
  v == null ? undefined : steps.find((s) => (s.under != null ? v < s.under : s.from != null ? v >= s.from : false));
