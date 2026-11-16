// History: calendar day totals, weekly plan streak, editing helpers for past workouts.
import type { Routine, Session } from "./types";
import { addDays, daysBetween, weekStart } from "./util";
import { countsForLoad, countsForVolume } from "./volume";

export interface DayLoad { date: string; sets: number; tonnage: number; sessionIds: string[] }

/** Per calendar day: working/failure sets done, tonnage and the sessions (finished only). */
export function dailyLoad(sessions: Session[]): Map<string, DayLoad> {
  const m = new Map<string, DayLoad>();
  for (const s of sessions) {
    if (s.status !== "finished") continue;
    const d = m.get(s.date) ?? { date: s.date, sets: 0, tonnage: 0, sessionIds: [] };
    d.sessionIds.push(s.id);
    for (const e of s.entries) for (const x of e.sets) {
      if (!x.done) continue;
      if (countsForVolume(x.type)) d.sets++;
      if (countsForLoad(x.type) && x.weight != null && x.reps != null) d.tonnage += x.weight * x.reps;
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
export function weekStatus(sessions: Session[], ws: string, planned: number): WeekStatus {
  const inWeek = sessions.filter((s) => s.status === "finished" && weekStart(s.date) === ws);
  const dayIds = new Set(inWeek.filter((s) => s.dayId).map((s) => s.dayId));
  const datesWithDay = new Set(inWeek.filter((s) => s.dayId).map((s) => s.date));
  const otherDates = new Set(inWeek.filter((s) => !s.dayId && !datesWithDay.has(s.date)).map((s) => s.date));
  const daysLogged = dayIds.size + otherDates.size;
  return { weekStart: ws, daysLogged, complete: planned > 0 && daysLogged >= planned };
}

/**
 * Streak = consecutive complete weeks (Mon–Sun) up to now. The current week only adds
 * once complete; while it's in progress it doesn't break the streak.
 */
export function weeklyStreak(sessions: Session[], routine: Routine | undefined, today: string): Streak {
  const planned = plannedDays(routine);
  const finished = sessions.filter((s) => s.status === "finished");
  const thisWs = weekStart(today);
  const thisWeek = weekStatus(finished, thisWs, planned);
  if (!finished.length) return { current: 0, best: 0, thisWeek, weeks: [] };
  const first = weekStart(finished.reduce((a, s) => (s.date < a ? s.date : a), finished[0].date));
  const weeks: WeekStatus[] = [];
  for (let w = first; w <= thisWs; w = addDays(w, 7)) weeks.push(w === thisWs ? thisWeek : weekStatus(finished, w, planned));
  let best = 0, run = 0;
  for (const w of weeks) { run = w.complete ? run + 1 : 0; best = Math.max(best, run); }
  let current = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i];
    if (w.complete) current++;
    else if (w.weekStart === thisWs) continue;
    else break;
  }
  return { current, best, thisWeek, weeks };
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
