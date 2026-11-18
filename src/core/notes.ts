// Notes at the end of a workout (summary → Notes): what changed against your past workouts and what to do about it.
// Pure and framework-free. Numbers marked *judgment* are our own reasoning (coaching practice, not studies).
import { DELOAD, stallCheck } from "./deload";
import { effortGap, effortLine, EFFORT_RULE, failureSet } from "./effort";
import { epley } from "./oneRm";
import type { Exercise, LoggedSet, Routine, Session, SessionEntry } from "./types";
import { fmtNum } from "./util";
import { tonnage } from "./volume";

export type NoteKind = "deload" | "below" | "drop" | "stuck" | "above" | "effort" | "rest" | "skipped" | "volume";
export type NoteTone = "warn" | "up" | "good" | "info";
export interface WorkoutNote { kind: NoteKind; tone: NoteTone; exerciseId?: string; title: string; text: string }

/** At most this many notes, most important first (*judgment*: a short list gets read). */
export const MAX_NOTES = 6;
/** Rests count as short when the time between sets is under this share of the planned rest (*judgment*; the time
 *  between sets also includes the set itself, so a real short rest is even shorter). */
export const SHORT_REST = 0.75;
/** Volume change worth a note (*judgment*). */
export const VOLUME_NOTE = 0.05;
/** Weight for next time aims at the bottom of the range with 2 reps left (Epley; *judgment*). */
const AIM_LEFT = 2;

const ORDER: NoteKind[] = ["deload", "below", "drop", "stuck", "above", "effort", "rest", "skipped", "volume"];
const isWork = (x: LoggedSet) => x.done && (x.type === "working" || x.type === "failure") && x.weight != null && x.reps != null && x.reps > 0;
const topWeight = (sets: LoggedSet[]) => Math.max(0, ...sets.filter(isWork).map((x) => x.weight!));
const step = (ex: Exercise) => (ex.incrementLb > 0 ? ex.incrementLb : 5);
const pct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`;
const mmss = (sec: number) => (sec % 60 === 0 ? `${sec / 60} min` : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`);

/** Weight that leaves AIM_LEFT reps at `reps`, from an est. 1RM, rounded down to the exercise's step. */
export function weightFor(e1rm: number, reps: number, ex: Exercise): number {
  const s = step(ex);
  return Math.floor(e1rm / (1 + (reps + AIM_LEFT) / 30) / s) * s;
}

/** The last finished, non-deload workout before `s` that did this exercise. */
function previous(history: Session[], s: Session, exerciseId: string): SessionEntry | undefined {
  const past = history.filter((h) => h.id !== s.id && h.status === "finished" && !h.deload && h.startedAt < s.startedAt)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  for (const h of past) {
    const e = h.entries.find((x) => x.exerciseId === exerciseId && x.sets.some(isWork));
    if (e) return e;
  }
  return undefined;
}

/** Median time between done sets (completedAt), or null with fewer than 2 timed sets. */
function medianGapSec(e: SessionEntry): number | null {
  const t = e.sets.filter((x) => x.done && x.completedAt).map((x) => Date.parse(x.completedAt!)).sort((a, b) => a - b);
  const gaps = t.slice(1).map((v, i) => (v - t[i]) / 1000).filter((g) => g > 0 && g < 15 * 60);
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

export function workoutNotes(s: Session, history: Session[], exMap: Map<string, Exercise>, routine?: Routine): WorkoutNote[] {
  const notes: WorkoutNote[] = [];
  const all = history.some((h) => h.id === s.id) ? history : [...history, s];
  const name = (id: string) => exMap.get(id)?.name ?? "Exercise";

  // Stuck: the deload stall rule (est. 1RM and reps at the same weight, last 4 weeks vs before), for this workout's exercises
  const ids = new Set(s.entries.map((e) => e.exerciseId));
  const st = s.deload ? null : stallCheck(all, routine, exMap, s.date);
  const stuck = st?.lifts.filter((l) => l.stalled && ids.has(l.exerciseId)) ?? [];
  if (st && st.judged > 0 && st.stalled * 2 >= st.judged)
    notes.push({ kind: "deload", tone: "warn", title: "Time for a deload", text: `${st.stalled} of ${st.judged} exercises stopped improving over ${DELOAD.stallWeeks} weeks. That points to tiredness, not the exercises. Start a deload week (Plan tab).` });

  for (const e of s.entries) {
    const ex = exMap.get(e.exerciseId);
    if (!ex) continue;
    const f = failureSet(e, s.deload);
    const regular = e.sets.filter((x) => isWork(x) && x.type === "working" && x !== f);
    const repMin = e.repMin, repMax = e.repMax ?? e.repMin;
    const range = repMin == null ? "" : repMin === repMax ? String(repMin) : `${repMin}–${repMax}`;
    const lastTime = previous(all, s, e.exerciseId);
    const gap = medianGapSec(e);
    const shortRest = gap != null && e.restSec > 0 && gap < e.restSec * SHORT_REST;

    if (!s.deload) {
      // Lighter than last time (same exercise, top working weight)
      const now = topWeight(e.sets), before = lastTime ? topWeight(lastTime.sets) : 0;
      if (now > 0 && before > 0 && now < before)
        notes.push({ kind: "drop", tone: "warn", exerciseId: e.exerciseId, title: `${ex.name}: lighter`, text: `${fmtNum(now)}, last time ${fmtNum(before)}. Go back to ${fmtNum(before)} next time, unless it was on purpose.` });

      // Below the range: the first regular set fell short of the bottom → too heavy
      const first = regular[0];
      if (repMin != null && first && first.reps! < repMin) {
        const w = weightFor(epley(first.weight!, first.reps!), repMin, ex);
        if (w > 0 && w < first.weight!)
          notes.push({ kind: "below", tone: "warn", exerciseId: e.exerciseId, title: `${ex.name}: too heavy`, text: `Set 1: ${first.reps} reps at ${fmtNum(first.weight!)}, but the plan says ${range} reps. Use ${fmtNum(w)} next time to reach ${repMin}.` });
      }

      // Above the range: every regular set went past the top → heavier next time
      if (repMax != null && repMin != null && regular.length && regular.every((x) => x.reps! > repMax)) {
        const best = Math.max(...regular.map((x) => epley(x.weight!, x.reps!)));
        const top = Math.max(...regular.map((x) => x.weight!));
        const w = Math.max(top + step(ex), weightFor(best, repMin, ex));
        notes.push({ kind: "above", tone: "up", exerciseId: e.exerciseId, title: `${ex.name}: go heavier`, text: `Every set went past the plan's ${range} reps. Use ${fmtNum(w)} next time.` });
      }

      // Stuck (not covered by a deload note)
      if (!notes.some((n) => n.kind === "deload") && stuck.some((l) => l.exerciseId === e.exerciseId))
        notes.push({ kind: "stuck", tone: "warn", exerciseId: e.exerciseId, title: `${ex.name}: not improving`, text: shortRest
          ? `No progress in ${DELOAD.stallWeeks} weeks, and rests ran short. Rest the full ${mmss(e.restSec)} first.`
          : `No progress in ${DELOAD.stallWeeks} weeks. Try a different rep range, or swap to another exercise for the same job.` });
    }

    const g = effortGap(e, s.deload);
    if (g) notes.push({ kind: "effort", tone: "warn", exerciseId: e.exerciseId, title: `${ex.name}: too easy`, text: `${effortLine(g)}. ${EFFORT_RULE}` });

    if (shortRest && !notes.some((n) => n.kind === "stuck" && n.exerciseId === e.exerciseId))
      notes.push({ kind: "rest", tone: "info", exerciseId: e.exerciseId, title: `${ex.name}: short rests`, text: `About ${mmss(Math.round(gap!))} between sets, ${mmss(e.restSec)} planned. Shorter rests cost reps.` });
  }

  const skipped = (s.skipped ?? []).filter((k) => k.sets > 0);
  if (skipped.length) {
    const n = skipped.reduce((a, k) => a + k.sets, 0);
    notes.push({ kind: "skipped", tone: "info", title: `${n} set${n === 1 ? "" : "s"} skipped`, text: skipped.map((k) => `${name(k.exerciseId)} ${k.sets}`).join(" · ") });
  }

  // Volume vs the last time you did this same plan day
  if (s.dayId && !s.deload) {
    const last = all.filter((h) => h.id !== s.id && h.dayId === s.dayId && h.status === "finished" && !h.deload && h.startedAt < s.startedAt)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
    const now = tonnage([s], exMap), then = last ? tonnage([last], exMap) : 0;
    if (then > 0) {
      const d = (now - then) / then;
      if (Math.abs(d) >= VOLUME_NOTE)
        notes.push({ kind: "volume", tone: d > 0 ? "good" : "info", title: `Volume ${pct(d)}`, text: `${d > 0 ? "More" : "Less"} than the last time you did ${s.title}.` });
      else notes.push({ kind: "volume", tone: "info", title: "Volume about the same", text: `Same as the last time you did ${s.title}.` });
    }
  }

  return notes.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)).slice(0, MAX_NOTES);
}
