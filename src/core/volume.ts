// Fractional volume: a direct set counts 1, an indirect set 0.5 (per exercise.volume).
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type Routine, type Session, type SetType, type VolumeTarget } from "./types";
import { addDays, parseLocalDate, weekStart } from "./util";

export type GroupTotals = Record<MuscleGroup, number>;
const zero = (): GroupTotals => Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, 0])) as GroupTotals;

/** Set types that count toward weekly sets. Warm-ups and drop sets don't. */
export const countsForVolume = (t: SetType) => t === "working" || t === "failure";
/** Set types that count toward tonnage and PRs. Only warm-ups are excluded. */
export const countsForLoad = (t: SetType) => t !== "warmup";

export interface PlanVolumeRow { group: MuscleGroup; sets: number; directDays: number }

export function planVolume(routine: Routine, exercises: Map<string, Exercise>): PlanVolumeRow[] {
  const sets = zero();
  const days: Record<string, Set<string>> = {};
  for (const day of routine.days)
    for (const slot of day.slots) {
      const ex = exercises.get(slot.exerciseId);
      if (!ex) continue;
      for (const v of ex.volume) {
        sets[v.group] += slot.sets * v.weight;
        if (v.weight === 1) (days[v.group] ??= new Set()).add(day.id);
      }
    }
  return MUSCLE_GROUPS.map((m) => ({ group: m.id, sets: sets[m.id], directDays: days[m.id]?.size ?? 0 }));
}

/** Fractional sets per group for logged sessions (done working/failure sets only). */
export function sessionsVolume(sessions: Session[], exercises: Map<string, Exercise>): GroupTotals {
  const t = zero();
  for (const s of sessions)
    for (const e of s.entries) {
      const ex = exercises.get(e.exerciseId);
      if (!ex) continue;
      const n = e.sets.filter((x) => x.done && countsForVolume(x.type)).length;
      for (const v of ex.volume) t[v.group] += n * v.weight;
    }
  return t;
}

/** Tonnage: Σ weight × reps of done non-warm-up sets, using the weight exactly as logged. */
export function tonnage(sessions: Session[]): number {
  let t = 0;
  for (const s of sessions) for (const e of s.entries) for (const x of e.sets)
    if (x.done && countsForLoad(x.type) && x.weight != null && x.reps != null) t += x.weight * x.reps;
  return t;
}

/** ok / above / below the weekly target; inProgress = below, but a planned day this week still works it; off = not a focus (no target, or the plan accepts being below it). */
export type TargetStatus = "ok" | "below" | "inProgress" | "above" | "off";
export const isFocus = (t: VolumeTarget | undefined): t is VolumeTarget & { min: number } => !!t && t.min != null && !t.acceptedBelow;
export function targetStatus(sets: number, t: VolumeTarget | undefined, stillPlanned = false): TargetStatus {
  if (!isFocus(t)) return "off";
  if (t.max != null && sets > t.max) return "above";
  if (sets >= t.min) return "ok";
  return stillPlanned ? "inProgress" : "below";
}

/**
 * Muscle groups that a planned day still left in this training week works (directly or indirectly).
 * Today counts unless today's planned day is already finished.
 */
export function groupsLeftThisWeek(routine: Routine | undefined, exercises: Map<string, Exercise>, finished: Session[], today: string, weekStartDay: number): Set<MuscleGroup> {
  const left = new Set<MuscleGroup>();
  if (!routine) return left;
  const end = addDays(weekStart(today, weekStartDay), 6);
  for (let d = today; d <= end; d = addDays(d, 1)) {
    const day = routine.days.find((x) => x.weekday === parseLocalDate(d).getDay());
    if (!day || (d === today && finished.some((s) => s.date === d && s.dayId === day.id))) continue;
    for (const slot of day.slots) for (const v of exercises.get(slot.exerciseId)?.volume ?? []) left.add(v.group);
  }
  return left;
}
export const formatTarget = (t: VolumeTarget | undefined) =>
  !t || t.min == null ? "—" : t.max == null ? `${t.min}+` : `${t.min}–${t.max}`;
