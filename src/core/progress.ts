// Progress series for charts. All inputs are finished sessions; pure functions.
import { epley } from "./oneRm";
import { entryVolume } from "./records";
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type Session } from "./types";
import { addDays, weekStart } from "./util";
import { countsForLoad, countsForVolume, sessionsVolume, tonnage, type GroupTotals } from "./volume";

export type Range = "4w" | "12w" | "6m" | "all";
export const RANGE_LABEL: Record<Range, string> = { "4w": "4 wk", "12w": "12 wk", "6m": "6 mo", all: "All" };

/** First local date included in a range (first day of the first week). null = all time. */
export function rangeStart(range: Range, today: string, startDay = 1): string | null {
  const ws = weekStart(today, startDay);
  if (range === "4w") return addDays(ws, -7 * 3);
  if (range === "12w") return addDays(ws, -7 * 11);
  if (range === "6m") return addDays(ws, -7 * 25);
  return null;
}
export const inRange = (sessions: Session[], from: string | null) => sessions.filter((s) => s.status === "finished" && (!from || s.date >= from));

export interface ExercisePoint { date: string; sessionId: string; e1rm: number; best: { weight: number; reps: number }; volume: number; sets: number }

/** One point per session that has done non-warm-up sets of the exercise, oldest first. */
/** `time` (holds): no est. 1RM; the point is the longest hold (seconds in `e1rm`, so the chart shows seconds). */
/** `factor`: 2 for per-side / per-hand lifts, so volume is the whole load (like tonnage). Sets without a weight
 *  (bodyweight only) count as 0 added load; a session with only those has its most reps in `e1rm` (Nov 22 2026). */
export function exerciseSeries(sessions: Session[], exerciseId: string, time = false, factor = 1): ExercisePoint[] {
  const out: ExercisePoint[] = [];
  for (const s of [...sessions].filter((x) => x.status === "finished").sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))) {
    const sets = s.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets)
      .filter((x) => x.done && countsForLoad(x.type) && x.reps != null && x.reps > 0);
    if (!sets.length) continue;
    const loaded = sets.some((x) => (x.weight ?? 0) > 0);
    let e1rm = 0, best = { weight: 0, reps: 0 };
    for (const x of sets) {
      const v = time || !loaded ? x.reps! : epley(x.weight ?? 0, x.reps!);
      if (v > e1rm) { e1rm = v; best = { weight: x.weight ?? 0, reps: x.reps! }; }
    }
    out.push({ date: s.date, sessionId: s.id, e1rm, best, volume: entryVolume(sets, time) * factor, sets: sets.length });
  }
  return out;
}

/** Up / down (Progress tab, Nov 24 2026): each exercise's last workout against the one before.
 *  Weighted work compares the best set by estimated max (Epley), so a lighter weight for more reps (a new rep range:
 *  180×10 → 170×12) counts as the same, not down (Leo, Nov 25 2026); within ±2% is "same". Holds compare the longest
 *  hold in seconds, bodyweight work logged without a weight the most reps, assisted work less help (then more reps). Needs two workouts with the exercise. */
export interface LastChange {
  exerciseId: string; before: number; after: number; unit: "lb" | "s" | "reps"; date: string;
  /** Reps of the best set (weighted work only), shown as weight × reps */
  beforeReps?: number; afterReps?: number;
  /** 1 up, −1 down, 0 about the same */
  dir: 1 | -1 | 0;
}
/** Estimated-max change that still counts as the same (*judgment*: a rep or so of day-to-day noise) */
export const SAME_PCT = 0.02;
export function lastChanges(sessions: Session[], exercises: Exercise[]): LastChange[] {
  const done = [...sessions].filter((x) => x.status === "finished").sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  const out: LastChange[] = [];
  for (const ex of exercises) {
    const time = ex.measure === "time";
    const tops: { date: string; weight: number; reps: number; maxReps: number; e1rm: number }[] = [];
    for (const s of done) {
      // Working and failure sets only: a drop set's extra reps at a lighter weight aren't progress
      const sets = s.entries.filter((e) => e.exerciseId === ex.id).flatMap((e) => e.sets)
        .filter((x) => x.done && countsForVolume(x.type) && x.reps != null && x.reps > 0);
      if (!sets.length) continue;
      // best set: highest estimated max (ties: the heavier one)
      const best = ex.assisted
        ? sets.reduce((b, x) => ((x.weight ?? 0) < (b.weight ?? 0) || ((x.weight ?? 0) === (b.weight ?? 0) && x.reps! > b.reps!) ? x : b))
        : sets.reduce((b, x) => { const v = epley(x.weight ?? 0, x.reps!), bv = epley(b.weight ?? 0, b.reps!); return v > bv || (v === bv && (x.weight ?? 0) > (b.weight ?? 0)) ? x : b; });
      tops.push({ date: s.date, weight: best.weight ?? 0, reps: best.reps!, maxReps: Math.max(...sets.map((x) => x.reps!)), e1rm: epley(best.weight ?? 0, best.reps!) });
      if (tops.length === 2) break;
    }
    if (tops.length < 2) continue;
    const [last, prev] = tops;
    // Seconds or reps when it is a hold, or when neither workout had a weight
    const byReps = time || (last.weight === 0 && prev.weight === 0);
    // Assisted (the weight is help, less is harder): less help is up, then more reps at the same help
    if (ex.assisted && !byReps) {
      const dir = last.weight < prev.weight ? 1 : last.weight > prev.weight ? -1 : last.reps > prev.reps ? 1 : last.reps < prev.reps ? -1 : 0;
      out.push({ exerciseId: ex.id, before: prev.weight, after: last.weight, beforeReps: prev.reps, afterReps: last.reps, unit: "lb", date: last.date, dir });
      continue;
    }
    if (byReps) {
      const before = prev.maxReps, after = last.maxReps;
      out.push({ exerciseId: ex.id, before, after, unit: time ? "s" : "reps", date: last.date, dir: after > before ? 1 : after < before ? -1 : 0 });
      continue;
    }
    const ch = prev.e1rm > 0 ? last.e1rm / prev.e1rm - 1 : last.e1rm > 0 ? 1 : 0;
    out.push({ exerciseId: ex.id, before: prev.weight, after: last.weight, beforeReps: prev.reps, afterReps: last.reps, unit: "lb", date: last.date,
      dir: ch > SAME_PCT ? 1 : ch < -SAME_PCT ? -1 : 0 });
  }
  return out;
}

export interface WeekTotals { weekStart: string; tonnage: number; sets: GroupTotals; workouts: number }

/** Weekly totals (weeks begin on startDay) from `from` (or the first workout) through the current week. Empty weeks included. */
export function weeklyTotals(sessions: Session[], exMap: Map<string, Exercise>, from: string | null, today: string, startDay = 1): WeekTotals[] {
  const list = inRange(sessions, from);
  const first = from ? weekStart(from, startDay) : list.length ? weekStart(list.reduce((a, s) => (s.date < a ? s.date : a), list[0].date), startDay) : weekStart(today, startDay);
  const out: WeekTotals[] = [];
  for (let w = first; w <= weekStart(today, startDay); w = addDays(w, 7)) {
    const wk = list.filter((s) => weekStart(s.date, startDay) === w);
    out.push({ weekStart: w, tonnage: tonnage(wk, exMap), sets: sessionsVolume(wk, exMap), workouts: wk.length });
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

