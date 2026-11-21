// History: calendar day totals, weekly plan streak, editing helpers for past workouts.
import type { Exercise, Routine, Session, StreakFreeze } from "./types";
import { addDays, daysBetween, parseLocalDate, weekStart } from "./util";
import { countsForLoad, countsForVolume } from "./volume";

export interface DayLoad { date: string; sets: number; tonnage: number; sessionIds: string[] }

/** Per calendar day: working/failure sets done, tonnage and the sessions (finished only). */
export function dailyLoad(sessions: Session[], exMap?: Map<string, Exercise>): Map<string, DayLoad> {
  const m = new Map<string, DayLoad>();
  for (const s of sessions) {
    if (s.status !== "finished") continue;
    const d = m.get(s.date) ?? { date: s.date, sets: 0, tonnage: 0, sessionIds: [] };
    d.sessionIds.push(s.id);
    for (const e of s.entries) for (const x of e.sets) {
      if (!x.done) continue;
      const time = exMap?.get(e.exerciseId)?.measure === "time";
      if (countsForVolume(x.type)) d.sets++;
      if (!time && countsForLoad(x.type) && x.weight != null && x.reps != null) d.tonnage += x.weight * x.reps;
    }
    m.set(s.date, d);
  }
  return m;
}

/** Number of planned training days in a routine (days with exercises and a weekday). */
export const plannedDays = (r: Routine | undefined) => (r?.days ?? []).filter((d) => d.weekday != null && d.slots.length > 0).length;

export interface WeekStatus { weekStart: string; daysLogged: number; complete: boolean }
export interface Streak { current: number; best: number; thisWeek: WeekStatus; weeks: WeekStatus[] }

/**
 * Days logged in a week = distinct planned routine days done (by dayId), plus distinct dates
 * of workouts without a routine day (free or imported workouts) that aren't already counted.
 * A week is complete when days logged ≥ planned training days.
 */
export function weekStatus(sessions: Session[], ws: string, planned: number, startDay = 1): WeekStatus {
  const inWeek = sessions.filter((s) => s.status === "finished" && weekStart(s.date, startDay) === ws);
  const dayIds = new Set(inWeek.filter((s) => s.dayId).map((s) => s.dayId));
  const datesWithDay = new Set(inWeek.filter((s) => s.dayId).map((s) => s.date));
  const otherDates = new Set(inWeek.filter((s) => !s.dayId && !datesWithDay.has(s.date)).map((s) => s.date));
  const daysLogged = dayIds.size + otherDates.size;
  return { weekStart: ws, daysLogged, complete: planned > 0 && daysLogged >= planned };
}

/** Whether any day of the week starting `ws` falls in a streak freeze. */
export const weekFrozen = (ws: string, freezes: StreakFreeze[] = []) =>
  freezes.some((f) => f.start <= addDays(ws, 6) && (f.end == null || f.end >= ws));
export const activeFreeze = (freezes: StreakFreeze[] = []) => freezes.find((f) => f.end == null) ?? null;
/** Tap on the streak: freeze from today, or end the running freeze today. */
export function toggleFreeze(freezes: StreakFreeze[] = [], today: string): StreakFreeze[] {
  const on = activeFreeze(freezes);
  if (on) return on.start === today ? freezes.filter((f) => f !== on) : freezes.map((f) => (f === on ? { ...f, end: today } : f));
  return [...freezes, { start: today, end: null }];
}

/**
 * Streak = consecutive complete weeks (starting on startDay) up to now. The current week only adds
 * once complete; while it's in progress it doesn't break the streak. A frozen week that isn't
 * complete holds the streak (doesn't break it, doesn't add); a complete week always adds.
 */
export function weeklyStreak(sessions: Session[], routine: Routine | undefined, today: string, startDay = 1, freezes: StreakFreeze[] = []): Streak {
  const planned = plannedDays(routine);
  const finished = sessions.filter((s) => s.status === "finished");
  const thisWs = weekStart(today, startDay);
  const thisWeek = weekStatus(finished, thisWs, planned, startDay);
  if (!finished.length) return { current: 0, best: 0, thisWeek, weeks: [] };
  const first = weekStart(finished.reduce((a, s) => (s.date < a ? s.date : a), finished[0].date), startDay);
  const weeks: WeekStatus[] = [];
  for (let w = first; w <= thisWs; w = addDays(w, 7)) weeks.push(w === thisWs ? thisWeek : weekStatus(finished, w, planned, startDay));
  let best = 0, run = 0;
  for (const w of weeks) {
    if (w.complete) run++;
    else if (!weekFrozen(w.weekStart, freezes) && w.weekStart !== thisWs) run = 0;
    best = Math.max(best, run);
  }
  let current = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i];
    if (w.complete) current++;
    else if (w.weekStart === thisWs || weekFrozen(w.weekStart, freezes)) continue;
    else break;
  }
  return { current, best, thisWeek, weeks };
}

/** The rest day of a week: the last weekday the plan has no training on (else the week's last day). */
export function restDayOf(ws: string, routine: Routine | undefined): string {
  const trained = new Set((routine?.days ?? []).filter((d) => d.weekday != null && d.slots.length).map((d) => d.weekday));
  for (let i = 6; i >= 0; i--) { const d = addDays(ws, i); if (!trained.has(parseLocalDate(d).getDay())) return d; }
  return addDays(ws, 6);
}

/**
 * Skipped days: past planned training days whose routine day wasn't done that week (by dayId, so a workout
 * moved to another day of the same week isn't "skipped"). Only from the first logged workout on, never today.
 */
export function skippedDays(sessions: Session[], routine: Routine | undefined, today: string, startDay = 1): Set<string> {
  const out = new Set<string>();
  const finished = sessions.filter((s) => s.status === "finished");
  if (!finished.length || !routine) return out;
  const first = finished.reduce((a, s) => (s.date < a ? s.date : a), finished[0].date);
  for (let d = first; d < today; d = addDays(d, 1)) {
    const day = routine.days.find((x) => x.weekday === parseLocalDate(d).getDay() && x.slots.length);
    if (!day) continue;
    const ws = weekStart(d, startDay);
    if (!finished.some((s) => s.dayId === day.id && weekStart(s.date, startDay) === ws) && !finished.some((s) => s.date === d)) out.add(d);
  }
  return out;
}

/** Calendar marks: a fire on the rest day of every complete week, ice on each day a freeze started. */
export function streakMarks(st: Streak, routine: Routine | undefined, freezes: StreakFreeze[] = []): Map<string, "fire" | "ice"> {
  const m = new Map<string, "fire" | "ice">();
  for (const w of st.weeks) if (w.complete) m.set(restDayOf(w.weekStart, routine), "fire");
  for (const f of freezes) m.set(f.start, "ice");
  return m;
}

/** Move a workout to another calendar date, shifting its start/finish times by the same number of days. */
export function setSessionDate(s: Session, date: string): Session {
  const n = daysBetween(s.date, date);
  if (!n) return s;
  const shift = (iso?: string | null) => (iso ? new Date(Date.parse(iso) + n * 86_400_000).toISOString() : iso);
  return { ...s, date, startedAt: shift(s.startedAt)!, finishedAt: shift(s.finishedAt) };
}

/** Change a finished workout's duration (minutes) by moving its finish time. */
export function setSessionDuration(s: Session, minutes: number): Session {
  return { ...s, finishedAt: new Date(Date.parse(s.startedAt) + Math.max(0, minutes) * 60_000).toISOString() };
}
