// Fractional volume: a direct set counts 1, an indirect set 0.5 (per exercise.volume).
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type Routine, type Session, type SetType, type Slot, type VolumeTarget } from "./types";

export type GroupTotals = Record<MuscleGroup, number>;
const zero = (): GroupTotals => Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, 0])) as GroupTotals;

/** Set types that count as whole sets (skipped sets, catch-up). Warm-ups and drop sets don't. */
export const countsForVolume = (t: SetType) => t === "working" || t === "failure";
/** How much a set counts toward weekly sets: working and failure 1, a drop set ½ (Leo, Nov 24 2026: drop sets give
 *  similar growth in less time, Sødal 2023), warm-ups 0. */
export const volumeShare = (t: SetType) => (t === "working" || t === "failure" ? 1 : t === "drop" ? 0.5 : 0);
/** A plan slot's sets toward weekly sets: its sets plus ½ for its drop set. */
export const slotVolumeSets = (s: Pick<Slot, "sets" | "dropSet" | "supersetGroup">) => s.sets + (s.dropSet && !s.supersetGroup ? 0.5 : 0);
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
        sets[v.group] += slotVolumeSets(slot) * v.weight;
        if (v.weight === 1) (days[v.group] ??= new Set()).add(day.id);
      }
    }
  return MUSCLE_GROUPS.map((m) => ({ group: m.id, sets: sets[m.id], directDays: days[m.id]?.size ?? 0 }));
}

/** Fractional sets per group for logged sessions (done working/failure sets 1, drop sets ½). */
export function sessionsVolume(sessions: Session[], exercises: Map<string, Exercise>): GroupTotals {
  const t = zero();
  for (const s of sessions)
    for (const e of s.entries) {
      const ex = exercises.get(e.exerciseId);
      if (!ex) continue;
      const n = e.sets.reduce((a, x) => a + (x.done ? volumeShare(x.type) : 0), 0);
      for (const v of ex.volume) t[v.group] += n * v.weight;
    }
  return t;
}

/** Weights logged per side (plates, no bar) or per hand (dumbbells) count twice in volume: both sides were lifted. */
export const loadFactor = (ex: Exercise | undefined) => (ex?.loadMode === "perSide" || ex?.loadMode === "perHand" ? 2 : 1);

/** Tonnage: Σ weight × reps of done non-warm-up sets, per-side and per-hand weights doubled (bar not included). */
export function tonnage(sessions: Session[], exMap?: Map<string, Exercise>): number {
  let t = 0;
  for (const s of sessions) for (const e of s.entries) {
    const ex = exMap?.get(e.exerciseId);
    const k = ex?.measure === "time" ? 0 : loadFactor(ex); // holds: seconds aren't reps
    for (const x of e.sets) if (x.done && countsForLoad(x.type) && x.weight != null && x.reps != null) t += x.weight * x.reps * k;
  }
  return t;
}

/** ok / above / below the weekly target; inProgress = below, but a planned day this week still works it; off = skipped (no target, or the plan accepts being below it). */
export const isFocus = (t: VolumeTarget | undefined): t is VolumeTarget & { min: number } => !!t && t.min != null && !t.off && !t.acceptedBelow;

export const formatTarget = (t: VolumeTarget | undefined) =>
  !t || t.min == null ? "—" : t.max == null ? `${t.min}+` : `${t.min}–${t.max}`;
