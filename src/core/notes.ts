// Notes at the end of a workout (summary → Notes): what changed against your past workouts and what to do about it.
// Pure and framework-free. Numbers marked *judgment* are our own reasoning (coaching practice, not studies).
import { DELOAD, stallCheck } from "./deload";
import { andList, effortGap, effortLine, failureSet } from "./effort";
import { epley } from "./oneRm";
import type { Exercise, LoggedSet, Routine, Session, SessionEntry } from "./types";
import { fmtNum } from "./util";
import { tonnage } from "./volume";

export type NoteKind = "deload" | "below" | "drop" | "stuck" | "above" | "effort" | "skipped" | "volume";
export type NoteTone = "warn" | "up" | "good" | "info";
export interface WorkoutNote { kind: NoteKind; tone: NoteTone; exerciseId?: string; title: string; text: string }

/** At most this many notes, most important first (*judgment*: a short list gets read). */
export const MAX_NOTES = 6;
/** Volume change worth a note (*judgment*). */
export const VOLUME_NOTE = 0.05;
/** Weight for next time aims at the bottom of the range with 2 reps left (Epley; *judgment*). */
const AIM_LEFT = 2;

const ORDER: NoteKind[] = ["deload", "below", "drop", "stuck", "above", "effort", "skipped", "volume"];
const isWork = (x: LoggedSet) => x.done && (x.type === "working" || x.type === "failure") && x.weight != null && x.reps != null && x.reps > 0;
const topWeight = (sets: LoggedSet[]) => Math.max(0, ...sets.filter(isWork).map((x) => x.weight!));
const step = (ex: Exercise) => (ex.incrementLb > 0 ? ex.incrementLb : 5);
const pct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`;

/** Suggested weights are round: multiples of 10 from 40 up (Leo: easier to load and remember), else the exercise's step. */
export const ROUND_FROM = 40;
const unit = (w: number, ex: Exercise) => (w >= ROUND_FROM ? 10 : step(ex));
export const roundDown = (w: number, ex: Exercise) => Math.floor(w / unit(w, ex)) * unit(w, ex);
export const roundUp = (w: number, ex: Exercise) => Math.ceil(w / unit(w, ex)) * unit(w, ex);

/** Weight that leaves AIM_LEFT reps at `reps`, from an est. 1RM, rounded down (round number). */
export function weightFor(e1rm: number, reps: number, ex: Exercise): number {
  return roundDown(e1rm / (1 + (reps + AIM_LEFT) / 30), ex);
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

/** Which sets at this weight fell short, in plain words: "on every set" / "on sets 1 and 2" / "on set 1". */
function shortSets(sets: LoggedSet[], repMin: number): { reps: string; where: string } {
  const short = sets.map((x, i) => ({ n: i + 1, r: x.reps! })).filter((x) => x.r < repMin);
  const lo = Math.min(...short.map((x) => x.r)), hi = Math.max(...short.map((x) => x.r));
  const reps = `${lo === hi ? lo : `${lo} or ${hi}`} reps`;
  if (short.length === sets.length && sets.length > 1) return { reps, where: "on every set" };
  if (short.length === 1) return { reps, where: `on set ${short[0].n}` };
  return { reps, where: `on sets ${andList(short.map((x) => x.n))}` };
}

/**
 * Too heavy: the first regular set fell short of the bottom of the rep range. The weight to use next time leaves
 * AIM_LEFT reps at the bottom of the range (Epley), rounded down. Same rule for the end-of-workout note and the
 * workout's "go down" tip.
 */
export function tooHeavy(e: SessionEntry, ex: Exercise, deload = false): { weight: number; from: number; reps: number } | null {
  const f = failureSet(e, deload);
  const first = e.sets.find((x) => isWork(x) && x.type === "working" && x !== f);
  if (e.repMin == null || !first || first.reps! >= e.repMin) return null;
  const w = weightFor(epley(first.weight!, first.reps!), e.repMin, ex);
  return w > 0 && w < first.weight! ? { weight: w, from: first.weight!, reps: first.reps! } : null;
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

    if (!s.deload) {
      // Lighter than last time (same exercise, top working weight)
      const now = topWeight(e.sets), before = lastTime ? topWeight(lastTime.sets) : 0;
      if (now > 0 && before > 0 && now < before)
        notes.push({ kind: "drop", tone: "warn", exerciseId: e.exerciseId, title: `${ex.name}: lighter`, text: `${fmtNum(now)}, last time ${fmtNum(before)}. Go back to ${fmtNum(before)} next time, unless it was on purpose.` });

      // Below the range: the first regular set fell short of the bottom → too heavy
      const first = regular[0];
      const heavy = tooHeavy(e, ex, s.deload);
      if (repMin != null && first && heavy) {
        const w = heavy.weight;
          notes.push({ kind: "below", tone: "warn", exerciseId: e.exerciseId, title: `${ex.name}: too heavy`, text: (({ reps, where }) => `You got ${reps} at ${fmtNum(first.weight!)} ${where}, but the plan says ${range}. Try ${fmtNum(w)} next time.`)(shortSets(regular.filter((x) => x.weight === first.weight), repMin)) });
      }

      // Above the range: every regular set went past the top → heavier next time
      if (repMax != null && repMin != null && regular.length && regular.every((x) => x.reps! > repMax)) {
        const best = Math.max(...regular.map((x) => epley(x.weight!, x.reps!)));
        const top = Math.max(...regular.map((x) => x.weight!));
        const w = roundUp(Math.max(top + step(ex), weightFor(best, repMin, ex)), ex);
        notes.push({ kind: "above", tone: "up", exerciseId: e.exerciseId, title: `${ex.name}: go heavier`, text: `You went past the plan's ${range} reps on every set. Try ${fmtNum(w)} next time.` });
      }

      // Stuck (not covered by a deload note)
      if (!notes.some((n) => n.kind === "deload") && stuck.some((l) => l.exerciseId === e.exerciseId))
        notes.push({ kind: "stuck", tone: "warn", exerciseId: e.exerciseId, title: `${ex.name}: not improving`, text: `No progress in ${DELOAD.stallWeeks} weeks. Try a different rep range, or swap to another exercise for the same job.` });
    }

    const g = effortGap(e, s.deload);
    if (g) notes.push({ kind: "effort", tone: "warn", exerciseId: e.exerciseId, title: `${ex.name}: too easy`, text: effortLine(g, e.repMax ?? e.repMin) });
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
