// Progress series for charts. All inputs are finished sessions; pure functions.
import { epley } from "./oneRm";
import { entryVolume } from "./records";
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type Session } from "./types";
import { addDays, localDate, weekStart } from "./util";
import { countsForLoad, countsForVolume, sessionsVolume, tonnage, type GroupTotals } from "./volume";

export type Range = "4w" | "12w" | "6m" | "all";
export const RANGE_LABEL: Record<Range, string> = { "4w": "4 wk", "12w": "12 wk", "6m": "6 mo", all: "All" };

/** First local date included in a range (Monday of the first week). null = all time. */
export function rangeStart(range: Range, today: string): string | null {
  const ws = weekStart(today);
  if (range === "4w") return addDays(ws, -7 * 3);
  if (range === "12w") return addDays(ws, -7 * 11);
  if (range === "6m") return addDays(ws, -7 * 25);
  return null;
}
export const inRange = (sessions: Session[], from: string | null) => sessions.filter((s) => s.status === "finished" && (!from || s.date >= from));

export interface ExercisePoint { date: string; sessionId: string; e1rm: number; best: { weight: number; reps: number }; volume: number; sets: number }

/** One point per session that has done non-warm-up sets of the exercise, oldest first. */
export function exerciseSeries(sessions: Session[], exerciseId: string): ExercisePoint[] {
  const out: ExercisePoint[] = [];
  for (const s of [...sessions].filter((x) => x.status === "finished").sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))) {
    const sets = s.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets)
      .filter((x) => x.done && countsForLoad(x.type) && x.weight != null && x.reps != null && x.reps > 0);
    if (!sets.length) continue;
    let e1rm = 0, best = { weight: 0, reps: 0 };
    for (const x of sets) {
      const v = epley(x.weight!, x.reps!);
      if (v > e1rm) { e1rm = v; best = { weight: x.weight!, reps: x.reps! }; }
    }
    out.push({ date: s.date, sessionId: s.id, e1rm, best, volume: entryVolume(sets), sets: sets.length });
  }
  return out;
}

export interface WeekTotals { weekStart: string; tonnage: number; sets: GroupTotals; workouts: number }

/** Weekly totals (Mon–Sun) from `from` (or the first workout) through the current week. Empty weeks included. */
export function weeklyTotals(sessions: Session[], exMap: Map<string, Exercise>, from: string | null, today: string): WeekTotals[] {
  const list = inRange(sessions, from);
  const first = from ? weekStart(from) : list.length ? weekStart(list.reduce((a, s) => (s.date < a ? s.date : a), list[0].date)) : weekStart(today);
  const out: WeekTotals[] = [];
  for (let w = first; w <= weekStart(today); w = addDays(w, 7)) {
    const wk = list.filter((s) => weekStart(s.date) === w);
    out.push({ weekStart: w, tonnage: tonnage(wk), sets: sessionsVolume(wk, exMap), workouts: wk.length });
  }
  return out;
}

/** Average weekly sets per group over the weeks given (all weeks count, including empty ones). */
export function averageSets(weeks: WeekTotals[]): GroupTotals {
  const t = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, 0])) as GroupTotals;
  if (!weeks.length) return t;
  for (const w of weeks) for (const m of MUSCLE_GROUPS) t[m.id] += w.sets[m.id];
  for (const m of MUSCLE_GROUPS) t[m.id] = Math.round((t[m.id] / weeks.length) * 10) / 10;
  return t;
}

/**
 * Training frequency: average number of workouts per week in which the group got
 * at least one direct (weight 1) working/failure set.
 */
export function muscleFrequency(sessions: Session[], exMap: Map<string, Exercise>, weekCount: number): Record<MuscleGroup, number> {
  const f = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, 0])) as Record<MuscleGroup, number>;
  for (const s of sessions) {
    const hit = new Set<MuscleGroup>();
    for (const e of s.entries) {
      const ex = exMap.get(e.exerciseId);
      if (!ex || !e.sets.some((x) => x.done && countsForVolume(x.type))) continue;
      ex.volume.filter((v) => v.weight === 1).forEach((v) => hit.add(v.group));
    }
    hit.forEach((g) => f[g]++);
  }
  if (weekCount > 0) for (const m of MUSCLE_GROUPS) f[m.id] = Math.round((f[m.id] / weekCount) * 10) / 10;
  return f;
}

export const todayStr = (d = new Date()) => localDate(d);
