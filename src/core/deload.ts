// Deload weeks (agreed with Leo, Nov 16 2026).
// A deload week keeps the same days and exercises with: half the sets (rounded up), weights 10% lighter,
// and every set stopped with 3–4 reps left. It lasts the current training week.
// The app SUGGESTS a deload; the user decides ("Deload this week" / "Not now"). Suggest when either comes first:
//  • interval: 6 weeks since the reference day (end of the last deload, else the first logged workout);
//  • stall: 4 weeks since the reference day AND half or more of the plan's exercises have stalled.
//    Judged: done at least 3 times in the last 4 weeks and at least once before (deload sessions ignored).
//    Stalled: neither the est. 1RM (best of the last 4 weeks vs best before) nor the reps at any same weight went up.
//    Every exercise counts, not just ★ lifts: isolation work builds muscle as well as compounds and strength gains are
//    specific to each exercise (agreed with Leo, Nov 17 2026). The 3-times minimum and the half line are judgment.
// "Not now" moves the reference day to the day it was tapped (wait for the next trigger).
import { exerciseSeries } from "./progress";
import type { Exercise, Routine, Session, Settings } from "./types";
import { addDays, daysBetween, weekStart } from "./util";

export const DELOAD = { setsFactor: 0.5, weightFactor: 0.9, repsLeft: "3–4", intervalWeeks: 6, stallWeeks: 4 } as const;

/** Half the sets, rounded up (at least 1). */
export const deloadSets = (n: number) => Math.max(1, Math.ceil(n * DELOAD.setsFactor));
/** 10% lighter, rounded to the nearest weight step of the exercise (never below one step). */
export function deloadWeight(w: number, step: number): number {
  const s = step > 0 ? step : 0.5;
  const v = Math.round((w * DELOAD.weightFactor) / s) * s;
  return Math.round(Math.max(w > 0 ? Math.min(s, w) : 0, v) * 100) / 100;
}

/** The current training week as a deload window (inclusive dates). */
export function deloadWeek(today: string, weekStartDay: number): { start: string; end: string } {
  const start = weekStart(today, weekStartDay);
  return { start, end: addDays(start, 6) };
}
export const deloadActive = (s: Settings, today: string) => !!s.deload && s.deload.start <= today && today <= s.deload.end;

/** End an active deload early (it then ended yesterday, or is removed if it started today). */
export function endDeload(s: Settings, today: string): Settings {
  if (!s.deload) return s;
  return { ...s, deload: s.deload.start >= today ? null : { ...s.deload, end: addDays(today, -1) } };
}

/** First logged (finished) workout date, or null if none yet. */
export const firstWorkoutDate = (sessions: Session[]) =>
  sessions.filter((x) => x.status === "finished").reduce<string | null>((a, x) => (!a || x.date < a ? x.date : a), null);

/**
 * Reference day the triggers count from: the latest of the day after the last deload ended,
 * the "Not now" day, and the first logged workout. No workouts yet → no reference (no suggestion).
 */
export function deloadReference(s: Settings, sessions: Session[]): string | null {
  const first = firstWorkoutDate(sessions);
  if (!first) return null;
  const candidates = [first, s.deload ? addDays(s.deload.end, 1) : null, s.deloadDismissedAt ?? null].filter(Boolean) as string[];
  return candidates.reduce((a, b) => (a > b ? a : b));
}

export interface StallCheck { judged: number; stalled: number; lifts: { exerciseId: string; recentBest: number; previousBest: number; stalled: boolean }[] }
/** Times an exercise must be done in the last 4 weeks to be judged (*judgment*: filters out noise). */
export const STALL_MIN_SESSIONS = 3;

/** Best reps at each weight in these sessions (done working/failure/drop sets). */
function repsByWeight(sessions: Session[], exerciseId: string): Map<number, number> {
  const m = new Map<number, number>();
  for (const s of sessions) for (const e of s.entries) if (e.exerciseId === exerciseId)
    for (const x of e.sets) if (x.done && x.type !== "warmup" && x.weight != null && x.reps != null && x.reps > 0)
      m.set(x.weight, Math.max(m.get(x.weight) ?? 0, x.reps));
  return m;
}

/** Every exercise in the plan: est. 1RM and reps at the same weight, last 4 weeks vs. before (deload sessions ignored). */
export function stallCheck(sessions: Session[], routine: Routine | undefined, exMap: Map<string, Exercise>, today: string): StallCheck {
  const ids = [...new Set((routine?.days ?? []).flatMap((d) => d.slots.map((s) => s.exerciseId)))].filter((id) => exMap.has(id));
  const normal = sessions.filter((s) => !s.deload && s.status === "finished");
  const cutoff = addDays(today, -7 * DELOAD.stallWeeks); // window = after cutoff
  const lifts: StallCheck["lifts"] = [];
  for (const id of ids) {
    const pts = exerciseSeries(normal, id);
    const recent = pts.filter((p) => p.date > cutoff), before = pts.filter((p) => p.date <= cutoff);
    if (recent.length < STALL_MIN_SESSIONS || !before.length) continue; // can't judge this exercise
    const recentBest = Math.max(...recent.map((p) => p.e1rm)), previousBest = Math.max(...before.map((p) => p.e1rm));
    const rNow = repsByWeight(normal.filter((s) => s.date > cutoff), id), rBefore = repsByWeight(normal.filter((s) => s.date <= cutoff), id);
    const moreReps = [...rNow].some(([w, r]) => rBefore.has(w) && r > rBefore.get(w)!);
    lifts.push({ exerciseId: id, recentBest, previousBest, stalled: recentBest <= previousBest + 1e-9 && !moreReps });
  }
  return { judged: lifts.length, stalled: lifts.filter((l) => l.stalled).length, lifts };
}

export type DeloadSuggestion = { reason: "interval"; weeks: number } | { reason: "stall"; stalled: number; judged: number };

export function deloadSuggestion(sessions: Session[], routine: Routine | undefined, exMap: Map<string, Exercise>, settings: Settings, today: string): DeloadSuggestion | null {
  if (deloadActive(settings, today)) return null;
  const ref = deloadReference(settings, sessions);
  if (!ref) return null;
  const days = daysBetween(ref, today);
  if (days >= DELOAD.stallWeeks * 7) {
    const st = stallCheck(sessions, routine, exMap, today);
    if (st.judged > 0 && st.stalled * 2 >= st.judged) return { reason: "stall", stalled: st.stalled, judged: st.judged };
  }
  if (days >= DELOAD.intervalWeeks * 7) return { reason: "interval", weeks: Math.floor(days / 7) };
  return null;
}
