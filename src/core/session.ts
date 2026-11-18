// Session (logged workout) logic. Pure functions: every operation returns a new Session.
import { progressionHint } from "./progression";
import { prsForEntry, type PrKind } from "./records";
import type { Exercise, LoggedSet, MuscleGroup, Routine, RoutineDay, Session, SessionEntry, Slot } from "./types";
import { localDate, uid } from "./util";
import { deloadSets, deloadWeight } from "./deload";
import { failureEligible } from "./failure";
import { countsForLoad, countsForVolume, sessionsVolume, tonnage, type GroupTotals } from "./volume";

const byNewest = (a: Session, b: Session) => (b.startedAt > a.startedAt ? 1 : b.startedAt < a.startedAt ? -1 : 0);

/** Most recent finished, non-deload session that has done sets of this exercise (deload weeks are lighter on purpose). */
export function lastEntryFor(history: Session[], exerciseId: string, excludeSessionId?: string): { session: Session; entry: SessionEntry } | null {
  for (const s of [...history].sort(byNewest)) {
    if (s.id === excludeSessionId || s.status !== "finished" || s.deload) continue;
    const entry = s.entries.find((e) => e.exerciseId === exerciseId && e.sets.some((x) => x.done));
    if (entry) return { session: s, entry };
  }
  return null;
}

const newSet = (weight: number | null, reps: number | null, type: LoggedSet["type"] = "working"): LoggedSet => ({ id: uid(), type, weight, reps, done: false, completedAt: null });

/**
 * Build an entry, pre-filled with last session's weights and reps (working sets, by position).
 * Deload: half the slot's sets (rounded up) and weights 10% lighter.
 */
export function buildEntry(ex: Exercise, history: Session[], opts: { sets?: number; repMin?: number; repMax?: number; restSec?: number; slot?: Slot; deload?: boolean } = {}): SessionEntry {
  const last = lastEntryFor(history, ex.id);
  const lastWork = last?.entry.sets.filter((x) => x.done && x.type !== "warmup" && x.type !== "drop") ?? [];
  const planned = opts.slot?.sets ?? opts.sets ?? (lastWork.length || 3);
  const n = opts.deload ? deloadSets(planned) : planned;
  const top = lastWork.length ? lastWork[lastWork.length - 1] : undefined;
  const w = (v: number | null | undefined) => (v == null ? null : opts.deload ? deloadWeight(v, ex.incrementLb) : v);
  const sets = Array.from({ length: n }, (_, i) => newSet(w(lastWork[i]?.weight ?? top?.weight), lastWork[i]?.reps ?? top?.reps ?? null));
  return {
    id: uid(),
    exerciseId: ex.id,
    slotId: opts.slot?.id,
    supersetGroup: opts.slot?.supersetGroup,
    restSec: opts.slot?.restSec ?? opts.restSec ?? ex.defaultRestSec,
    repMin: opts.slot?.repMin ?? opts.repMin,
    repMax: opts.slot?.repMax ?? opts.repMax,
    sets,
  };
}

/** `failure`: the day's "last set to failure" picks (core/failure.ts planFailure), stored on the entries so they stay fixed. */
export function createSessionFromDay(routine: Routine, day: RoutineDay, exercises: Map<string, Exercise>, history: Session[], now: Date, opts: { deload?: boolean; failure?: { slotId: string; why: string[] }[] } = {}): Session {
  const fail = new Map((opts.failure ?? []).map((x) => [x.slotId, x.why]));
  const entries = day.slots.flatMap((slot) => {
    const ex = exercises.get(slot.exerciseId);
    if (!ex) return [];
    const e = buildEntry(ex, history, { slot, deload: opts.deload });
    const why = fail.get(slot.id);
    return [why ? { ...e, toFailure: true, failWhy: why } : e];
  });
  return { id: uid(), date: localDate(now), title: day.title, routineId: routine.id, dayId: day.id, startedAt: now.toISOString(), finishedAt: null, status: "active", source: "app", entries, ...(opts.deload ? { deload: true } : {}) };
}

export function createFreeSession(now: Date, opts: { deload?: boolean } = {}): Session {
  return { id: uid(), date: localDate(now), title: "Free workout", startedAt: now.toISOString(), finishedAt: null, status: "active", source: "app", entries: [], ...(opts.deload ? { deload: true } : {}) };
}

const mapEntry = (s: Session, entryId: string, f: (e: SessionEntry) => SessionEntry): Session => ({ ...s, entries: s.entries.map((e) => (e.id === entryId ? f(e) : e)) });

export const updateSet = (s: Session, entryId: string, setId: string, patch: Partial<LoggedSet>): Session =>
  mapEntry(s, entryId, (e) => ({ ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) }));

/** Mark a set done (or undo). When marking done, later empty sets of the same type copy its weight and reps. */
export function toggleDone(s: Session, entryId: string, setId: string, now: Date): Session {
  const x = s.entries.find((e) => e.id === entryId)?.sets.find((y) => y.id === setId);
  if (!x) return s;
  if (x.done) return updateSet(s, entryId, setId, { done: false, completedAt: null });
  return mapEntry(s, entryId, (e) => {
    const i = e.sets.findIndex((y) => y.id === setId);
    return {
      ...e,
      sets: e.sets.map((y, k) => {
        if (k === i) return { ...y, done: true, completedAt: now.toISOString() };
        if (k > i && !y.done && y.type === x.type) return { ...y, weight: y.weight ?? x.weight, reps: y.reps ?? x.reps };
        return y;
      }),
    };
  });
}

export const addSet = (s: Session, entryId: string, type: LoggedSet["type"] = "working"): Session =>
  mapEntry(s, entryId, (e) => {
    const prev = e.sets[e.sets.length - 1];
    return { ...e, sets: [...e.sets, newSet(prev?.weight ?? null, prev?.reps ?? null, type)] };
  });

export const removeSet = (s: Session, entryId: string, setId: string): Session => mapEntry(s, entryId, (e) => ({ ...e, sets: e.sets.filter((x) => x.id !== setId) }));
export const setEntry = (s: Session, entryId: string, patch: Partial<SessionEntry>): Session => mapEntry(s, entryId, (e) => ({ ...e, ...patch }));
export const addEntry = (s: Session, entry: SessionEntry): Session => ({ ...s, entries: [...s.entries, entry] });
export const removeEntry = (s: Session, entryId: string): Session => ({ ...s, entries: s.entries.filter((e) => e.id !== entryId) });

export function moveEntry(s: Session, entryId: string, dir: -1 | 1): Session {
  const i = s.entries.findIndex((e) => e.id === entryId), j = i + dir;
  if (i < 0 || j < 0 || j >= s.entries.length) return s;
  const entries = [...s.entries];
  [entries[i], entries[j]] = [entries[j], entries[i]];
  return { ...s, entries };
}

/** Swap an exercise for this session only. Keeps set count, rest and rep range; pre-fills from the new exercise's history. */
export function swapEntry(s: Session, entryId: string, ex: Exercise, history: Session[]): Session {
  return mapEntry(s, entryId, (e) => {
    const fresh = buildEntry(ex, history, { sets: e.sets.length, restSec: e.restSec, repMin: e.repMin, repMax: e.repMax });
    // A swap to a move that isn't safe to take to failure drops the flame
    const keep = e.toFailure && failureEligible(ex);
    return { ...e, exerciseId: ex.id, swappedFromId: e.swappedFromId ?? e.exerciseId, sets: fresh.sets, toFailure: keep || undefined, failWhy: keep ? e.failWhy : undefined };
  });
}

/** Link this entry with the next one in a superset, or unlink if they already share a group. */
export function toggleSupersetWithNext(s: Session, entryId: string): Session {
  const i = s.entries.findIndex((e) => e.id === entryId);
  const a = s.entries[i], b = s.entries[i + 1];
  if (!a || !b) return s;
  if (a.supersetGroup && a.supersetGroup === b.supersetGroup) {
    // split the group after a
    const g = a.supersetGroup;
    const entries = s.entries.map((e, k) => (k > i && e.supersetGroup === g ? { ...e, supersetGroup: undefined } : e));
    return { ...s, entries: cleanupSolo(entries) };
  }
  const used = new Set(s.entries.map((e) => e.supersetGroup).filter(Boolean));
  const g = a.supersetGroup ?? b.supersetGroup ?? "ABCDEFGHIJ".split("").find((c) => !used.has(c))!;
  const entries = s.entries.map((e, k) => (k === i || k === i + 1 || (b.supersetGroup && e.supersetGroup === b.supersetGroup) ? { ...e, supersetGroup: g } : e));
  return { ...s, entries };
}
function cleanupSolo(entries: SessionEntry[]): SessionEntry[] {
  const count = new Map<string, number>();
  entries.forEach((e) => e.supersetGroup && count.set(e.supersetGroup, (count.get(e.supersetGroup) ?? 0) + 1));
  return entries.map((e) => (e.supersetGroup && count.get(e.supersetGroup) === 1 ? { ...e, supersetGroup: undefined } : e));
}

/**
 * After a set is marked done: should the rest timer start, and which exercise is next?
 * Supersets alternate through the group and rest only after the last exercise of the group.
 */
export function afterSetDone(s: Session, entryId: string): { rest: boolean; nextEntryId: string | null } {
  const i = s.entries.findIndex((e) => e.id === entryId);
  const e = s.entries[i];
  if (!e) return { rest: false, nextEntryId: null };
  if (!e.supersetGroup) return { rest: true, nextEntryId: e.sets.some((x) => !x.done) ? e.id : s.entries[i + 1]?.id ?? null };
  const group = s.entries.filter((x) => x.supersetGroup === e.supersetGroup);
  const gi = group.findIndex((x) => x.id === e.id);
  const pending = (x: SessionEntry) => x.sets.some((y) => !y.done);
  for (let k = 1; k < group.length; k++) {
    const cand = group[(gi + k) % group.length];
    if (pending(cand)) {
      const wrapped = gi + k >= group.length;
      return { rest: wrapped, nextEntryId: cand.id };
    }
  }
  const lastIdx = s.entries.findIndex((x) => x.id === group[group.length - 1].id);
  return { rest: true, nextEntryId: pending(e) ? e.id : s.entries[lastIdx + 1]?.id ?? null };
}

/** Finish: drop sets that weren't done and exercises with no done sets. Undone sets that would have counted
 * toward weekly volume are remembered per exercise (`skipped`) for the finish screen. */
export function finishSession(s: Session, now: Date): Session {
  const skipped = s.entries
    .map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((x) => !x.done && countsForVolume(x.type)).length }))
    .filter((x) => x.sets > 0);
  const entries = s.entries.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })).filter((e) => e.sets.length > 0);
  return { ...s, entries, status: "finished", finishedAt: now.toISOString(), ...(skipped.length ? { skipped } : {}) };
}

/** Sets per muscle that were skipped (same weights as weekly volume: direct 1, indirect ½). */
export function skippedVolume(s: Session, exercises: Map<string, Exercise>): Partial<Record<MuscleGroup, number>> {
  const t: Partial<Record<MuscleGroup, number>> = {};
  for (const k of s.skipped ?? []) for (const v of exercises.get(k.exerciseId)?.volume ?? []) t[v.group] = (t[v.group] ?? 0) + k.sets * v.weight;
  return t;
}

export const durationMin = (s: Session, now: Date = new Date()): number =>
  Math.max(0, Math.round(((s.finishedAt ? Date.parse(s.finishedAt) : now.getTime()) - Date.parse(s.startedAt)) / 60000));

export interface SessionSummary {
  durationMin: number;
  setsDone: number;
  tonnage: number;
  perGroup: GroupTotals;
  prs: { exerciseId: string; kinds: PrKind[] }[];
}

export function summarize(s: Session, exercises: Map<string, Exercise>, history: Session[]): SessionSummary {
  const prs = s.entries
    .map((e) => ({ exerciseId: e.exerciseId, kinds: prsForEntry(history, s.id, e.exerciseId, e.sets, s.date) }))
    .filter((p) => p.kinds.length);
  return {
    durationMin: durationMin(s),
    setsDone: s.entries.reduce((a, e) => a + e.sets.filter((x) => x.done && countsForLoad(x.type)).length, 0),
    tonnage: tonnage([s]),
    perGroup: sessionsVolume([s], exercises),
    prs,
  };
}

/** Apply a progression hint to the sets not done yet. */
export function applyHint(s: Session, entryId: string, weight: number, reps: number[] | number): Session {
  return mapEntry(s, entryId, (e) => {
    let w = 0;
    return {
      ...e,
      sets: e.sets.map((x) => {
        if (x.done || x.type !== "working") return x;
        const r = Array.isArray(reps) ? reps[w] ?? reps[reps.length - 1] : reps;
        w++;
        return { ...x, weight, reps: r };
      }),
    };
  });
}

export { progressionHint };
