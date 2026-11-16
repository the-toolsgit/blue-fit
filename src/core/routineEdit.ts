// Plan (routine) editing. Pure functions: every operation returns a new Routine.
import type { Exercise, Routine, RoutineDay, Session, Slot } from "./types";
import { uid } from "./util";

export const NEW_SLOT = { sets: 3, repMin: 10, repMax: 12 };
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const mapDay = (r: Routine, dayId: string, f: (d: RoutineDay) => RoutineDay): Routine => ({ ...r, days: r.days.map((d) => (d.id === dayId ? f(d) : d)) });
const move = <T>(a: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= a.length || to < 0 || to >= a.length || from === to) return a;
  const b = [...a];
  const [x] = b.splice(from, 1);
  b.splice(to, 0, x);
  return b;
};

/** Weekdays already used by another day of the routine. */
export const takenWeekdays = (r: Routine, exceptDayId?: string) => new Set(r.days.filter((d) => d.id !== exceptDayId && d.weekday != null).map((d) => d.weekday!));

/** Add a day on the given weekday (or the first free one, or none). */
export function addDay(r: Routine, weekday?: number | null): { routine: Routine; dayId: string } {
  const taken = takenWeekdays(r);
  const wd = weekday !== undefined ? weekday : [1, 2, 3, 4, 5, 6, 0].find((d) => !taken.has(d)) ?? null;
  const id = "day-" + uid().slice(0, 8);
  const day: RoutineDay = { id, weekday: wd != null && !taken.has(wd) ? wd : null, title: "New day", slots: [] };
  return { routine: { ...r, days: [...r.days, day] }, dayId: id };
}
export const removeDay = (r: Routine, dayId: string): Routine => ({ ...r, days: r.days.filter((d) => d.id !== dayId) });
export const renameDay = (r: Routine, dayId: string, title: string): Routine => mapDay(r, dayId, (d) => ({ ...d, title }));

/** Set a day's weekday. If another day has it, the two days swap weekdays. */
export function setDayWeekday(r: Routine, dayId: string, weekday: number | null): Routine {
  const me = r.days.find((d) => d.id === dayId);
  if (!me) return r;
  const other = weekday == null ? undefined : r.days.find((d) => d.id !== dayId && d.weekday === weekday);
  return { ...r, days: r.days.map((d) => (d.id === dayId ? { ...d, weekday } : other && d.id === other.id ? { ...d, weekday: me.weekday } : d)) };
}

export function addSlot(r: Routine, dayId: string, ex: Exercise, restSec: number): { routine: Routine; slotId: string } {
  const id = "slot-" + uid().slice(0, 8);
  const slot: Slot = { id, exerciseId: ex.id, ...NEW_SLOT, restSec: ex.defaultRestSec || restSec };
  return { routine: mapDay(r, dayId, (d) => ({ ...d, slots: [...d.slots, slot] })), slotId: id };
}
export const removeSlot = (r: Routine, dayId: string, slotId: string): Routine =>
  mapDay(r, dayId, (d) => ({ ...d, slots: cleanupSolo(d.slots.filter((s) => s.id !== slotId)) }));
export const updateSlot = (r: Routine, dayId: string, slotId: string, patch: Partial<Slot>): Routine =>
  mapDay(r, dayId, (d) => ({ ...d, slots: d.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)) }));
export const moveSlot = (r: Routine, dayId: string, from: number, to: number): Routine =>
  mapDay(r, dayId, (d) => ({ ...d, slots: regroup(move(d.slots, from, to)) }));
/** Swap the exercise in a slot. Day-specific text overrides are dropped (they described the old exercise). */
export const swapSlotExercise = (r: Routine, dayId: string, slotId: string, ex: Exercise): Routine =>
  mapDay(r, dayId, (d) => ({ ...d, slots: d.slots.map((s) => (s.id === slotId ? { ...s, exerciseId: ex.id, whyOverride: undefined, tipsOverride: undefined } : s)) }));

/** Link a slot with the next one in a superset, or unlink if they already share a group. */
export function toggleSlotSuperset(r: Routine, dayId: string, slotId: string): Routine {
  return mapDay(r, dayId, (d) => {
    const i = d.slots.findIndex((s) => s.id === slotId);
    const a = d.slots[i], b = d.slots[i + 1];
    if (!a || !b) return d;
    if (a.supersetGroup && a.supersetGroup === b.supersetGroup) {
      const g = a.supersetGroup;
      return { ...d, slots: cleanupSolo(d.slots.map((s, k) => (k > i && s.supersetGroup === g ? { ...s, supersetGroup: undefined } : s))) };
    }
    const used = new Set(d.slots.map((s) => s.supersetGroup).filter(Boolean));
    const g = a.supersetGroup ?? b.supersetGroup ?? "ABCDEFGHIJ".split("").find((c) => !used.has(c))!;
    return { ...d, slots: d.slots.map((s, k) => (k === i || k === i + 1 || (b.supersetGroup && s.supersetGroup === b.supersetGroup) ? { ...s, supersetGroup: g } : s)) };
  });
}
/** A group needs at least two slots; a slot that moved away from its group leaves it. */
function regroup(slots: Slot[]): Slot[] {
  const out = slots.map((s, i) => {
    if (!s.supersetGroup) return s;
    const touches = slots[i - 1]?.supersetGroup === s.supersetGroup || slots[i + 1]?.supersetGroup === s.supersetGroup;
    return touches ? s : { ...s, supersetGroup: undefined };
  });
  return cleanupSolo(out);
}
function cleanupSolo(slots: Slot[]): Slot[] {
  const n = new Map<string, number>();
  slots.forEach((s) => s.supersetGroup && n.set(s.supersetGroup, (n.get(s.supersetGroup) ?? 0) + 1));
  return slots.map((s) => (s.supersetGroup && n.get(s.supersetGroup) === 1 ? { ...s, supersetGroup: undefined } : s));
}

/** Copy a routine with new ids for the routine, days and slots. The copy is not current. */
export function duplicateRoutine(r: Routine, name: string, now: Date): Routine {
  return {
    ...structuredClone(r), id: "routine-" + uid().slice(0, 8), name, isCurrent: false, createdAt: now.toISOString(),
    days: r.days.map((d) => ({ ...structuredClone(d), id: "day-" + uid().slice(0, 8), slots: d.slots.map((s) => ({ ...structuredClone(s), id: "slot-" + uid().slice(0, 8) })) })),
  };
}
export const setCurrent = (routines: Routine[], id: string): Routine[] => routines.map((r) => ({ ...r, isCurrent: r.id === id }));

/** Next free name like "Leo v3.1 copy", "Leo v3.1 copy 2". */
export function copyName(name: string, existing: string[]): string {
  const base = `${name} copy`;
  if (!existing.includes(base)) return base;
  for (let i = 2; ; i++) if (!existing.includes(`${base} ${i}`)) return `${base} ${i}`;
}

export interface RoutineIssue { dayId?: string; slotId?: string; message: string }
/** Problems that block saving. */
export function validateRoutine(r: Routine): RoutineIssue[] {
  const out: RoutineIssue[] = [];
  if (!r.name.trim()) out.push({ message: "The plan needs a name." });
  const seen = new Map<number, string>();
  for (const d of r.days) {
    if (!d.title.trim()) out.push({ dayId: d.id, message: "A day needs a name." });
    if (d.weekday != null) {
      if (seen.has(d.weekday)) out.push({ dayId: d.id, message: `Two days are on ${WD[d.weekday]}.` });
      seen.set(d.weekday, d.id);
    }
    for (const s of d.slots) {
      if (s.sets < 1) out.push({ dayId: d.id, slotId: s.id, message: "Every exercise needs at least 1 set." });
      if (s.repMin < 1 || s.repMax < s.repMin) out.push({ dayId: d.id, slotId: s.id, message: "Rep range: the max must be at least the min." });
    }
  }
  return out;
}

/** Sessions keep a routine's history meaningful: a routine is "used" if any session references it. */
export const routineUsed = (id: string, sessions: Session[]) => sessions.some((s) => s.routineId === id);
