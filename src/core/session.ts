// Session (logged workout) logic. Pure functions: every operation returns a new Session.
import { progressionHint } from "./progression";
import { prsForEntry, type PrKind } from "./records";
import type { Exercise, LoggedSet, MuscleGroup, Routine, RoutineDay, Session, SessionEntry, Slot } from "./types";
import { localDate, uid } from "./util";
import { deloadSets, deloadWeight } from "./deload";
import { failureEligible, mainMuscle, MANUAL_WHY, TEST_WHY } from "./failure";
import { countsForLoad, countsForVolume, sessionsVolume, tonnage, type GroupTotals } from "./volume";

const byNewest = (a: Session, b: Session) => (b.startedAt > a.startedAt ? 1 : b.startedAt < a.startedAt ? -1 : 0);

/** Most recent finished, non-deload session that has done sets of this exercise (deload weeks are lighter on purpose). */
/** The workout before the last one for this exercise (same rules as lastEntryFor), for "two in a row" checks. */
export function prevEntryFor(history: Session[], exerciseId: string, excludeSessionId?: string): { session: Session; entry: SessionEntry } | null {
  const last = lastEntryFor(history, exerciseId, excludeSessionId);
  return last ? lastEntryFor(history.filter((s) => s.id !== last.session.id), exerciseId, excludeSessionId) : null;
}

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
  const sets = Array.from({ length: n }, (_, i) => newSet(w(lastWork[i]?.weight ?? top?.weight), lastWork[i]?.reps ?? top?.reps ?? opts.slot?.repMin ?? opts.repMin ?? null)); // no history: reps start at the low end of the plan's range
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

/** `failure`: the day's "last set to failure" picks (core/failure.ts planFailure); `extra`: slots that get one more set
 *  (planExtraSets). Both are stored on the entries so they stay fixed. */
export function createSessionFromDay(routine: Routine, day: RoutineDay, exercises: Map<string, Exercise>, history: Session[], now: Date, opts: { deload?: boolean; failure?: { slotId: string; why: string[] }[]; extra?: { slotId: string; why: string[] }[];
  /** Auto-adjust off: the picks the app would have made, stored as suggestions (not applied) */
  suggest?: { failure?: { slotId: string; why: string[] }[]; extra?: { slotId: string; why: string[] }[] } } = {}): Session {
  const fail = new Map((opts.failure ?? []).map((x) => [x.slotId, x.why]));
  const extra = new Map((opts.deload ? [] : opts.extra ?? []).map((x) => [x.slotId, x.why]));
  const sFail = new Map((opts.deload ? [] : opts.suggest?.failure ?? []).map((x) => [x.slotId, x.why]));
  const sExtra = new Map((opts.deload ? [] : opts.suggest?.extra ?? []).map((x) => [x.slotId, x.why]));
  const entries = day.slots.flatMap((slot) => {
    const ex = exercises.get(slot.exerciseId);
    if (!ex) return [];
    const more = extra.get(slot.id);
    const e0 = buildEntry(ex, history, { slot: more ? { ...slot, sets: slot.sets + 1 } : slot, deload: opts.deload });
    const e = more ? { ...e0, extraSet: more } : e0;
    const why = fail.get(slot.id);
    const e2 = why ? { ...e, toFailure: true, failWhy: why } : e;
    const se = sExtra.get(slot.id), sf = why ? undefined : sFail.get(slot.id);
    // plannedSets: working sets at the start, so the summary can tell if a set was added by hand
    return [{ ...e2, ...(se ? { suggestExtra: se, plannedSets: e2.sets.filter((x) => x.type === "working").length } : {}), ...(sf ? { suggestFailure: sf } : {}) }];
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

/** Add a set. A warm-up goes at the top, after any warm-ups already there, and starts empty (it's lighter than the
 *  working weight); other sets go at the end, copying the last one. */
export const addSet = (s: Session, entryId: string, type: LoggedSet["type"] = "working"): Session =>
  mapEntry(s, entryId, (e) => {
    if (type === "warmup") {
      const at = e.sets.findIndex((x) => x.type !== "warmup");
      const i = at < 0 ? e.sets.length : at;
      return { ...e, sets: [...e.sets.slice(0, i), newSet(null, null, "warmup"), ...e.sets.slice(i)] };
    }
    const prev = e.sets[e.sets.length - 1];
    return { ...e, sets: [...e.sets, newSet(prev?.weight ?? null, prev?.reps ?? null, type)] };
  });

export const removeSet = (s: Session, entryId: string, setId: string): Session => mapEntry(s, entryId, (e) => ({ ...e, sets: e.sets.filter((x) => x.id !== setId) }));
/** Take the suggested extra set: one more working set, now an applied extra set. */
export const takeExtra = (s: Session, entryId: string): Session =>
  mapEntry(s, entryId, ({ suggestExtra, ...e }) => {
    // One more working set, copied from the last working set and placed after it (before any drop sets)
    const i = e.sets.map((x) => x.type).lastIndexOf("working");
    const src = e.sets[i];
    const at = i < 0 ? e.sets.length : i + 1;
    return { ...e, extraSet: suggestExtra, sets: [...e.sets.slice(0, at), newSet(src?.weight ?? null, src?.reps ?? null, "working"), ...e.sets.slice(at)] };
  });
/** Take the suggested failure set: the last set goes to failure. */
export const takeFailure = (s: Session, entryId: string): Session =>
  mapEntry(s, entryId, ({ suggestFailure, ...e }) => ({ ...e, toFailure: true, failWhy: suggestFailure }));

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

/** Move an exercise from one position to another (drag and drop). */
export function moveEntryTo(s: Session, from: number, to: number): Session {
  if (from === to || from < 0 || to < 0 || from >= s.entries.length || to >= s.entries.length) return s;
  const entries = [...s.entries];
  const [e] = entries.splice(from, 1);
  entries.splice(to, 0, e);
  return { ...s, entries };
}

/**
 * After a reorder or a done set, keep each app-picked failure set on the last exercise for its muscle (the rule it was
 * picked by). Exercises already started count as done, so starting the flagged one while another for the same muscle
 * is untouched moves the failure to the last untouched one that's safe to fail (gym order can differ from the plan);
 * with none, it stays. After a reorder (not started) it moves to the exercise that is now last for that muscle, if
 * that one is safe to fail and wasn't turned off in Edit plan (`offSlotIds`); otherwise it's dropped. Failure the user turned on, or one already done, stays put.
 */
export function refitFailure(s: Session, exMap: Map<string, Exercise>, offSlotIds: Set<string> = new Set()): Session {
  let entries = s.entries;
  for (const e of s.entries) {
    if (!e.toFailure || e.failWhy?.includes(MANUAL_WHY) || e.failWhy?.includes(TEST_WHY)) continue; // a test belongs to its exercise
    const cur = entries.find((x) => x.id === e.id)!;
    if (!cur.toFailure) continue;
    const lastWork = [...cur.sets].reverse().find((x) => x.type === "working" || x.type === "failure");
    if (lastWork?.done) continue;
    const g = mainMuscle(exMap.get(cur.exerciseId));
    if (!g) continue;
    // Last among the exercises for this muscle not started yet (the gym order can differ from the plan's)
    const started = (x: SessionEntry) => x.sets.some((y) => y.done && (y.type === "working" || y.type === "failure"));
    const left = entries.filter((x) => mainMuscle(exMap.get(x.exerciseId)) === g && !started(x));
    const canFail = (x: SessionEntry) => !x.toFailure && failureEligible(exMap.get(x.exerciseId)) && !(x.slotId && offSlotIds.has(x.slotId));
    // Already started: move only to an untouched exercise that's safe to fail; with none, it stays here
    const last = started(cur) ? [...left].reverse().find(canFail) : left.at(-1);
    if (!last || last.id === cur.id) continue;
    const ok = canFail(last);
    entries = entries.map((x) => x.id === cur.id ? { ...x, toFailure: undefined, failWhy: undefined }
      : x.id === last.id && ok ? { ...x, toFailure: true, failWhy: cur.failWhy } : x);
  }
  return entries === s.entries ? s : { ...s, entries };
}

/** Swap an exercise for this session only. Keeps set count, rest and rep range; pre-fills from the new exercise's history. */
export function swapEntry(s: Session, entryId: string, ex: Exercise, history: Session[]): Session {
  return mapEntry(s, entryId, (e) => {
    const time = ex.measure === "time"; // a hold gets a seconds range
    const fresh = buildEntry(ex, history, { sets: e.sets.length, restSec: e.restSec, repMin: time ? 20 : e.repMin, repMax: time ? 60 : e.repMax });
    // A swap to a move that isn't safe to take to failure drops the flame
    const keep = e.toFailure && failureEligible(ex);
    return { ...e, ...(time ? { repMin: 20, repMax: 60 } : {}), exerciseId: ex.id, swappedFromId: e.swappedFromId ?? e.exerciseId, sets: fresh.sets, toFailure: keep || undefined, failWhy: keep ? e.failWhy : undefined };
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
  // The workout's last set: nothing left to rest for
  if (s.entries.every((x) => x.sets.every((y) => y.done))) return { rest: false, nextEntryId: e.id };
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

/** A recorded set counts once it has reps (an empty set added in Edit workout doesn't). */
export const isRecorded = (x: LoggedSet) => x.done && (x.reps ?? 0) > 0;

/** Editing a finished workout keeps `skipped` in line with what's recorded. For each exercise that was planned
 * (`planned`: working sets per exercise from the plan day; otherwise done + skipped before the edit is used as the
 * plan), skipped = planned − recorded, never below 0. Exercises outside the plan never get skipped sets. */
export function reconcileSkipped(before: Session, after: Session, planned?: Record<string, number>): Session {
  const done = (x: Session, id: string) => x.entries.filter((e) => e.exerciseId === id).reduce((a, e) => a + e.sets.filter((y) => isRecorded(y) && countsForVolume(y.type)).length, 0);
  const skipBefore = (id: string) => before.skipped?.find((k) => k.exerciseId === id)?.sets ?? 0;
  const ids = new Set([...(before.skipped ?? []).map((k) => k.exerciseId), ...Object.keys(planned ?? {}), ...before.entries.filter((e) => e.slotId).map((e) => e.exerciseId)]);
  const skipped = [...ids]
    .map((id) => ({ exerciseId: id, sets: Math.max(0, (planned?.[id] ?? done(before, id) + skipBefore(id)) - done(after, id)) }))
    .filter((k) => k.sets > 0);
  const { skipped: _drop, ...rest } = after;
  return skipped.length ? { ...after, skipped } : rest;
}

/** For workouts finished before `skipped` was saved: planned working sets of the day (from the plan) minus the
 * ones done, per slot. Approximate if the plan changed since. Empty when the workout has no plan day. */
export function deriveSkipped(s: Session, routine: Routine | undefined): { exerciseId: string; sets: number }[] {
  const day = routine && s.routineId === routine.id ? routine.days.find((d) => d.id === s.dayId) : undefined;
  if (!day) return [];
  return day.slots.map((slot) => {
    const e = s.entries.find((x) => x.slotId === slot.id);
    const planned = s.deload ? deloadSets(slot.sets) : slot.sets;
    const done = e ? e.sets.filter((x) => x.done && countsForVolume(x.type)).length : 0;
    return { exerciseId: e?.exerciseId ?? slot.exerciseId, sets: Math.max(0, planned - done) };
  }).filter((x) => x.sets > 0);
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
    .map((e) => ({ exerciseId: e.exerciseId, kinds: prsForEntry(history, s.id, e.exerciseId, e.sets, s.date, exercises.get(e.exerciseId)?.measure === "time") }))
    .filter((p) => p.kinds.length);
  return {
    durationMin: durationMin(s),
    setsDone: s.entries.reduce((a, e) => a + e.sets.filter((x) => x.done && countsForLoad(x.type)).length, 0),
    tonnage: tonnage([s], exercises),
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
