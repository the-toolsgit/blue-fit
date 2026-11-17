// Strategic "last set to failure" (mass gain and endurance). The app picks, per workout, which exercises take their
// last working set to failure; the user's on/off choice in Edit plan always wins. Pure and framework-free.
// Evidence: growth rises as sets end closer to failure (Robinson 2024); true failure adds little over stopping just
// short and costs more fatigue (Refalo 2023); failure needs roughly 24–48 h more recovery (Morán-Navarro 2017).
// Numbers marked *judgment* are our own reasoning. Plan: docs/plans/failure-strategy.md.
import { muscleLabel, type Exercise, type Goal, type MuscleGroup, type ProfileDraft, type Routine, type RoutineDay, type Session, type Settings, type Slot, type VolumeTarget } from "./types";
import { countsForVolume, isFocus } from "./volume";
import { priorityOf } from "./volumeModel";
import { addDays, parseLocalDate, weekStart } from "./util";
import { deloadActive } from "./deload";

/** Mass gain and endurance use it. Strength and maintain don't. No profile yet counts as mass gain. */
export const failureApplies = (goal: Goal | undefined) => { const g = goal ?? "growth"; return g === "growth" || g === "endurance"; };

/** Never to failure, even though they look like isolation moves: free weight over the face, free-weight compound row. */
export const UNSAFE_FAILURE = new Set(["ez-bar-incline-tricep-extension", "single-arm-db-row"]);
const MACHINE_LIKE = new Set(["machine", "plateMachine", "cable"]);
const FREE_ISOLATION = new Set(["dumbbell", "fixedBar", "bodyweight", "other"]);

/** Safe to take to failure: machine, cable and isolation moves; never ★ heavy lifts or the unsafe list. */
export function failureEligible(ex: Exercise | undefined): boolean {
  if (!ex || ex.isHeavy || UNSAFE_FAILURE.has(ex.id)) return false;
  if (MACHINE_LIKE.has(ex.equipment)) return true;
  return FREE_ISOLATION.has(ex.equipment) && ex.volume.filter((v) => v.weight === 1).length === 1;
}

/** The muscle an exercise is mainly for (its first direct group). */
export const mainMuscle = (ex: Exercise | undefined): MuscleGroup | undefined => ex?.volume.find((v) => v.weight === 1)?.group;

/** Failure sets per workout (*judgment*): 3; 2 when cutting, sleep < 6 h or age 40+; 1 when two or more apply. */
export function failureBudget(p: ProfileDraft | null | undefined): { sets: number; why: string[] } {
  const why: string[] = [];
  if (p?.phase === "cutting") why.push("cutting");
  if (p?.sleepHours != null && p.sleepHours < 6) why.push("sleep under 6 h");
  if (p?.age != null && p.age >= 40) why.push("age 40+");
  return { sets: why.length === 0 ? 3 : why.length === 1 ? 2 : 1, why };
}
/** A muscle trained again within this many days doesn't get a failure set (*judgment*, from the recovery research). */
export const FAILURE_GAP_DAYS = 2;

export interface FailurePick { slotId: string; why: string[]; manual?: boolean }

export interface FailureContext {
  routine: Routine;
  exMap: Map<string, Exercise>;
  targets: VolumeTarget[];
  settings: Settings;
  /** Finished sessions (any week; this training week's are used for the weekly totals) */
  finished: Session[];
  /** Today's local date: days from here on that aren't finished still count as planned */
  today: string;
}

const dayOn = (r: Routine, date: string) => r.days.find((d) => d.weekday === parseLocalDate(date).getDay());

/** This training week's sets per muscle: what's been logged plus what's still planned (today on, not yet done). */
export function projectedWeek(c: FailureContext): Map<MuscleGroup, number> {
  const ws = weekStart(c.today, c.settings.weekStartDay), we = addDays(ws, 6);
  const out = new Map<MuscleGroup, number>();
  const add = (g: MuscleGroup, n: number) => out.set(g, (out.get(g) ?? 0) + n);
  const week = c.finished.filter((s) => s.status === "finished" && s.date >= ws && s.date <= we);
  for (const s of week) for (const e of s.entries) {
    const n = e.sets.filter((x) => x.done && countsForVolume(x.type)).length;
    for (const v of c.exMap.get(e.exerciseId)?.volume ?? []) add(v.group, n * v.weight);
  }
  for (let d = c.today; d <= we; d = addDays(d, 1)) {
    const day = dayOn(c.routine, d);
    if (!day || week.some((s) => s.date === d && s.dayId === day.id)) continue;
    for (const slot of day.slots) for (const v of c.exMap.get(slot.exerciseId)?.volume ?? []) add(v.group, slot.sets * v.weight);
  }
  return out;
}

/** Days until the plan trains this muscle directly again after `date` (the plan repeats weekly); null = never. */
function nextTrained(r: Routine, exMap: Map<string, Exercise>, g: MuscleGroup, date: string): number | null {
  for (let i = 1; i <= 7; i++) {
    const day = dayOn(r, addDays(date, i));
    if (day?.slots.some((s) => exMap.get(s.exerciseId)?.volume.some((v) => v.group === g && v.weight === 1))) return i;
  }
  return null;
}

/** Whether the muscle was worked directly in the 2 days before `date`: what was actually logged for past days
 *  (a skipped workout doesn't count), the plan for days still ahead. */
function trainedRecently(c: FailureContext, g: MuscleGroup, date: string): boolean {
  const direct = (exId: string) => !!c.exMap.get(exId)?.volume.some((v) => v.group === g && v.weight === 1);
  for (let i = 1; i <= FAILURE_GAP_DAYS; i++) {
    const d = addDays(date, -i);
    const logged = c.finished.filter((s) => s.status === "finished" && s.date === d);
    if (logged.some((s) => s.entries.some((e) => direct(e.exerciseId) && e.sets.some((x) => x.done && countsForVolume(x.type))))) return true;
    if (logged.length || d < c.today) continue;
    if (dayOn(c.routine, d)?.slots.some((s) => direct(s.exerciseId))) return true;
  }
  return false;
}

/**
 * Which slots of `day` (on `date`) take their last set to failure, with the reasons.
 * Manual on/off (slot.toFailure) wins. The app picks the rest, best first:
 *   only the last exercise for its muscle in the workout · not if that muscle is above its weekly target ·
 *   not if it's trained again within 2 days, or was trained in the 2 days before (logged, or planned if still ahead) · priority muscles first · then muscles below target · then later in the workout.
 */
export function planFailure(day: RoutineDay, date: string, c: FailureContext): FailurePick[] {
  const p = c.settings.profile;
  if (!failureApplies(p?.goal) || deloadActive(c.settings, date)) return [];
  const label = (g: MuscleGroup) => muscleLabel(g).toLowerCase();
  const manual: FailurePick[] = day.slots.filter((s) => s.toFailure === true && c.exMap.has(s.exerciseId))
    .map((s) => ({ slotId: s.id, why: ["You turned this on in Edit plan"], manual: true }));
  // Beginners (< 1 year): they grow fine without it and are still learning form
  if (p?.yearsTraining != null && p.yearsTraining < 1) return manual;
  const budget = failureBudget(p);
  const left = budget.sets - manual.length;
  if (left <= 0) return manual;
  const week = projectedWeek(c);
  const tmap = new Map(c.targets.map((t) => [t.group, t]));
  type Cand = { slot: Slot; index: number; prio: number; below: number; why: string[] };
  const cands: Cand[] = [];
  day.slots.forEach((slot, index) => {
    if (slot.toFailure !== undefined) return;
    const ex = c.exMap.get(slot.exerciseId);
    const g = mainMuscle(ex);
    if (!g || !failureEligible(ex)) return;
    // Only the last exercise for this muscle today (failure fatigue can't hurt later sets for it)
    if (day.slots.slice(index + 1).some((s) => mainMuscle(c.exMap.get(s.exerciseId)) === g)) return;
    const t = tmap.get(g);
    const sets = week.get(g) ?? 0;
    if (isFocus(t) && t.max != null && sets > t.max) return;
    const gap = nextTrained(c.routine, c.exMap, g, date);
    if (gap != null && gap <= FAILURE_GAP_DAYS) return;
    if (trainedRecently(c, g, date)) return;
    const pr = priorityOf(g, t);
    const below = isFocus(t) && sets < t.min;
    const why = [`Last ${label(g)} exercise in this workout`];
    if (pr === "priority") why.push("priority muscle");
    if (below) why.push(`${label(g)} below weekly target`);
    why.push(gap == null ? `${label(g)} not trained again this week` : `${label(g)} rests ${gap} days`);
    cands.push({ slot, index, prio: pr === "priority" ? 2 : pr === "normal" ? 1 : 0, below: below ? 1 : 0, why });
  });
  cands.sort((a, b) => b.prio - a.prio || b.below - a.below || b.index - a.index);
  const note = budget.why.length ? [`Up to ${budget.sets} per workout (${budget.why.join(", ")})`] : [];
  const auto = cands.slice(0, left).map((x) => ({ slotId: x.slot.id, why: [...x.why, ...note] }));
  // Back in workout order
  const order = new Map(day.slots.map((s, i) => [s.id, i]));
  return [...manual, ...auto].sort((a, b) => order.get(a.slotId)! - order.get(b.slotId)!);
}

/** Planned date of a routine day in the current training week. */
export function dateInWeek(day: RoutineDay, today: string, weekStartDay: number): string | null {
  if (day.weekday == null) return null;
  const ws = weekStart(today, weekStartDay);
  return addDays(ws, (day.weekday - weekStartDay + 7) % 7);
}

/** Flames for every day of the routine this week: dayId → slotId → reasons. Days already finished show what was stored. */
export function weekFailure(c: FailureContext): Map<string, Map<string, string[]>> {
  const out = new Map<string, Map<string, string[]>>();
  const ws = weekStart(c.today, c.settings.weekStartDay), we = addDays(ws, 6);
  for (const day of c.routine.days) {
    const date = dateInWeek(day, c.today, c.settings.weekStartDay);
    if (!date) continue;
    const done = c.finished.find((s) => s.status === "finished" && s.dayId === day.id && s.date >= ws && s.date <= we);
    const m = new Map<string, string[]>();
    if (done) { for (const e of done.entries) if (e.toFailure && e.slotId) m.set(e.slotId, e.failWhy ?? []); }
    else for (const x of planFailure(day, date, c)) m.set(x.slotId, x.why);
    out.set(day.id, m);
  }
  return out;
}
