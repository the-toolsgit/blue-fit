// Builds a whole week plan from the user's goal, training days, workout length and weekly targets (Plan → Generate).
// Pure and framework-free. Rules come from the muscle database and the Plan check (workoutCheck.ts); choices marked
// *judgment* are ours. The result is checked with weekInsight by the caller.
import { isTopPick } from "./catalog";
import { NEEDS_HEAVY_LIGHT, restDaysOf } from "./muscles";
import { HOLD_SLOT } from "./routineEdit";
import { estimateMinutes } from "./timeEstimate";
import { muscleLabel, MUSCLE_GROUPS, type Exercise, type Goal, type MuscleGroup, type RoutineDay, type Slot, type VolumeTarget } from "./types";
import { uid } from "./util";
import { isFocus, planVolume } from "./volume";
import { priorityOf } from "./volumeModel";
import { JOBS, MAX_SESSION_SETS, STRETCH_MUSCLES } from "./workoutCheck";

export interface GenInput {
  goal: Goal;
  /** Weekdays to train (0 = Sunday … 6 = Saturday) */
  trainDays: number[];
  /** Longest workout the user wants, in minutes */
  maxMinutes: number;
  targets: VolumeTarget[];
  /** Exercises to pick from (the whole catalog; full gym) */
  exercises: Exercise[];
  /** Exercises of the plan the user comes from: picked only when nothing else fits, so the new plan changes them up */
  avoid?: Set<string>;
  /** Rest between sets the user picked, in seconds (holds keep 60 s). Unset → by goal (REST_BY_GOAL) */
  restSec?: number;
  /** Different seed → a different plan (Build again) */
  seed?: number;
}

/** Rest between sets each goal does best with (research: 3 min+ for strength, de Salles 2009; 2 min for growth, more than
 *  60 s helps a little, Schoenfeld 2016 / Singer 2024; about 1 min for endurance, ACSM 2009; 90 s to maintain is *judgment*) */
export const REST_BY_GOAL: Record<Goal, number> = { strength: 180, growth: 120, endurance: 60, maintenance: 90 };

/** Families decide which muscles share a day (push / pull / legs, *judgment*: the classic splits). */
const FAMILY: Record<MuscleGroup, "push" | "pull" | "legs" | "core"> = {
  chest: "push", frontDelts: "push", sideDelts: "push", triceps: "push",
  back: "pull", rearDelts: "pull", biceps: "pull", traps: "pull", forearms: "pull",
  quads: "legs", hamstrings: "legs", glutes: "legs", adductors: "legs", calves: "legs",
  abs: "core", neck: "core",
};
/** Big muscles first: their compound lifts give the small ones indirect sets, so the small ones need fewer of their own */
const ORDER: MuscleGroup[] = ["back", "chest", "quads", "hamstrings", "glutes", "sideDelts", "rearDelts", "traps", "triceps", "biceps", "adductors", "calves", "frontDelts", "forearms", "abs", "neck"];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
/** Share of the summed targets that needs sets of its own: compound lifts cover the rest as indirect sets (about 80%, *judgment*) */
const INDIRECT_SHARE = 0.8;
/** Workout length is an average: ±5 min still counts as that length (Leo: 55–65 is "60") */
export const LENGTH_BUFFER = 5;
type Theme = "full" | "upper" | "lower" | "push" | "pull" | "legs";
const SPLITS: Record<number, Theme[]> = {
  1: ["full"], 2: ["full", "full"], 3: ["full", "full", "full"], 4: ["upper", "lower", "upper", "lower"],
  5: ["upper", "lower", "push", "pull", "legs"], 6: ["push", "pull", "legs", "push", "pull", "legs"],
  7: ["push", "pull", "legs", "push", "pull", "legs", "full"],
};
const THEME_FAMILIES: Record<Theme, string[]> = { full: ["push", "pull", "legs"], upper: ["push", "pull"], lower: ["legs"], push: ["push"], pull: ["pull"], legs: ["legs"] };
const THEME_NAME: Record<Theme, string> = { full: "Full body", upper: "Upper", lower: "Lower", push: "Push", pull: "Pull", legs: "Legs" };

/** Small seeded random (mulberry32) so "Build again" gives a different but repeatable plan */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Weekly sets to aim for: Normal a quarter into the range, Priority past the middle, no ceiling → the minimum + 2 (*judgment*). */
export function aimSets(t: VolumeTarget): number {
  if (!isFocus(t)) return 0;
  const min = t.min!, max = t.max ?? min + 2;
  return Math.round(min + (max - min) * (priorityOf(t.group, t) === "priority" ? 0.6 : 0.25));
}

/** Calendar days from weekday a to weekday b going forward (1–7) */
const gap = (a: number, b: number) => ((b - a + 7) % 7) || 7;
/** True when hard workouts on these weekdays leave the muscle its rest days in between */
export const restsEnough = (days: number[], g: MuscleGroup) =>
  days.length < 2 || days.every((d) => days.every((e) => d === e || gap(d, e) - 1 >= restDaysOf(g)));

/** Most hard workouts a muscle can get on these days while keeping its rest days in between (up to `want`) */
export function fitSessions(days: number[], g: MuscleGroup, want: number): number {
  for (let k = Math.min(want, days.length); k > 1; k--) if (combos(days, k).some((c) => restsEnough(c, g))) return k;
  return Math.min(1, days.length);
}

/** Workouts a muscle gets in the week: enough to stay at or under the per-workout limit; 2 when it gets 10+ (*judgment*). */
const sessionsFor = (aim: number, n: number) => Math.min(n, Math.max(Math.ceil(aim / MAX_SESSION_SETS), aim >= 10 && n >= 2 ? 2 : 1));

/** Sets one workout can hold within the time limit (inverse of estimateMinutes, ~3.5 sets per exercise) */
export const setsForMinutes = (min: number, restSec = 120) => { let s = 0; while (estimateMinutes(s + 1, Math.ceil((s + 1) / 3.5), restSec) <= min) s++; return s; };

export function generatePlan(input: GenInput): RoutineDay[] {
  const rand = rng(input.seed ?? 1);
  const trainDays = WEEK.filter((d) => input.trainDays.includes(d));
  const n = trainDays.length;
  const tmap = new Map(input.targets.map((t) => [t.group, t]));
  const focus = ORDER.filter((g) => isFocus(tmap.get(g)));
  const aim = new Map(focus.map((g) => [g, aimSets(tmap.get(g)!)]));
  // The length is an average with a 5-minute buffer both ways (Leo, Nov 21 2026): a day may run up to 5 min over
  const restSec = input.restSec ?? REST_BY_GOAL[input.goal];
  const cap = setsForMinutes(input.maxMinutes + LENGTH_BUFFER, restSec);
  // Not enough time for every target: scale them all down evenly (at least 2 sets each), so no muscle is left out
  const need0 = [...aim.values()].reduce((a, b) => a + b, 0) * INDIRECT_SHARE;
  const room = cap * n;
  if (need0 > room && need0 > 0) for (const [g, v] of aim) aim.set(g, Math.max(2, Math.floor((v * room) / need0)));

  // 1. The split from the number of days (*judgment*: the classic ones): 1–3 full body, 4 upper/lower ×2,
  //    5 upper/lower + push/pull/legs, 6 push/pull/legs ×2, 7 the same + a full-body day. Themes go round the
  //    training days in week order, so the same theme lands 3+ days apart.
  const themes = SPLITS[Math.min(n, 7)] ?? [];
  const themeOf = new Map(trainDays.map((d, i) => [d, themes[i % themes.length]]));
  const load = new Map<number, number>(trainDays.map((d) => [d, 0]));
  const daysOf = new Map<MuscleGroup, number[]>();
  for (const g of focus) {
    const fam = FAMILY[g];
    // Days whose theme trains this muscle (abs and neck: any day)
    const allowed = trainDays.filter((d) => fam === "core" || THEME_FAMILIES[themeOf.get(d)!].includes(fam));
    // As many workouts as the target needs, but only as many as its rest days allow; the aim can't go past them
    const k = fitSessions(allowed, g, sessionsFor(aim.get(g)!, n));
    aim.set(g, Math.min(aim.get(g)!, MAX_SESSION_SETS * Math.max(1, k)));
    // Best set of k days: the muscle rests enough in between, then the lightest days
    let best: number[] = allowed.slice(0, k), bestScore = -Infinity;
    for (const c of combos(allowed, k)) {
      const score = (restsEnough(c, g) ? 100 : 0) - c.reduce((a, d) => a + load.get(d)!, 0) / 4 + rand() * 0.5;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    for (const d of best) load.set(d, load.get(d)! + aim.get(g)! / Math.max(1, k));
    daysOf.set(g, best);
  }

  // 2. Exercises: big muscles first; every pick adds its indirect sets to the other muscles
  const have = new Map<MuscleGroup, number>();
  const jobsHit = new Map<MuscleGroup, Set<string>>();
  const stretched = new Set<MuscleGroup>();
  const used = new Set<string>();
  const slotsOf = new Map<number, { s: Slot; ex: Exercise; main: MuscleGroup }[]>(trainDays.map((d) => [d, []]));
  const daySets = (d: number) => slotsOf.get(d)!.reduce((a, x) => a + x.s.sets, 0);
  const pool = input.exercises.filter((e) => !e.archived);
  const add = (d: number, ex: Exercise, sets: number, main: MuscleGroup) => {
    slotsOf.get(d)!.push({ s: { id: "slot-" + uid().slice(0, 8), exerciseId: ex.id, sets, repMin: 0, repMax: 0, restSec: 0 }, ex, main });
    used.add(ex.id);
    for (const v of ex.volume) have.set(v.group, (have.get(v.group) ?? 0) + sets * v.weight);
    for (const [g, j] of Object.entries(ex.jobs ?? {})) for (const one of [j].flat()) jobsHit.set(g as MuscleGroup, new Set([...(jobsHit.get(g as MuscleGroup) ?? []), one!]));
    for (const g of ex.stretch ?? []) stretched.add(g);
  };
  const pick = (g: MuscleGroup, d: number): Exercise | undefined => {
    const cands = pool.filter((e) => e.volume.some((v) => v.group === g && v.weight === 1) && (e.measure !== "time" || g === "abs"));
    let best: Exercise | undefined, bestScore = -Infinity;
    for (const e of cands) {
      let score = rand() * 2;
      if (isTopPick(e, input.goal)) score += 6;
      const jobs = [e.jobs?.[g]].flat().filter(Boolean) as string[];
      score += 5 * jobs.filter((j) => !jobsHit.get(g)?.has(j)).length;
      if (STRETCH_MUSCLES.has(g) && !stretched.has(g) && e.stretch?.includes(g)) score += 4;
      if (input.avoid?.has(e.id)) score -= 8;
      if (used.has(e.id)) score -= 30;
      if (slotsOf.get(d)!.some((x) => x.ex.id === e.id)) score -= 100;
      // Don't pile indirect sets on muscles already at their ceiling
      for (const v of e.volume) { const t = tmap.get(v.group); if (v.group !== g && t?.max != null && (have.get(v.group) ?? 0) >= t.max) score -= 3; }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  };
  for (const g of focus) {
    const days = daysOf.get(g)!;
    let need = Math.max(0, aim.get(g)! - (have.get(g) ?? 0));
    // A muscle with angles still uncovered gets at least one exercise of its own
    const missingJobs = (JOBS[g] ?? []).some((j) => !jobsHit.get(g)?.has(j));
    if (need < 2 && missingJobs && (JOBS[g]?.length ?? 0) > 1) need = 2;
    if (need <= 0) continue;
    // Small needs go on one day (no 1-set exercises)
    const useDays = need < 2 * days.length ? days.slice(0, Math.max(1, Math.floor(need / 2))) : days;
    useDays.forEach((d, i) => {
      let share = Math.round(need / useDays.length + (i === 0 ? (need % useDays.length) / 2 : 0));
      share = Math.min(share, MAX_SESSION_SETS, Math.max(0, cap - daySets(d)));
      while (share >= 2) {
        const ex = pick(g, d);
        if (!ex) break;
        // Angles still uncovered and few sets: 2-set exercises so more angles get covered
        const open = (JOBS[g] ?? []).filter((j) => !jobsHit.get(g)?.has(j)).length;
        const sets = open > 1 && share < 3 * open ? 2 : Math.min(4, share >= 6 ? 3 : share);
        add(d, ex, sets, g);
        share -= sets;
        if (share === 1) { const last = slotsOf.get(d)!.at(-1)!.s; if (last.sets < 4) { last.sets++; have.set(g, (have.get(g) ?? 0) + 1); } share = 0; }
      }
    });
  }

  // 3. Reps for the goal and the rest the user picked
  const heavyDone = new Set<MuscleGroup>();
  const lightDone = new Set<MuscleGroup>();
  for (const d of trainDays) for (const x of slotsOf.get(d)!) {
    const { s, ex, main } = x;
    let mix: "heavy" | "light" | undefined;
    // Mass gain: heavy for the first big lift of a muscle that needs the mix, light for its next exercise
    if (input.goal === "growth" && NEEDS_HEAVY_LIGHT.has(main) && ex.measure !== "time") {
      if ((ex.isHeavy || ex.compound) && !heavyDone.has(main)) { mix = "heavy"; heavyDone.add(main); }
      else if (heavyDone.has(main) && !lightDone.has(main)) { mix = "light"; lightDone.add(main); }
    }
    Object.assign(s, repsFor(ex, input.goal, restSec, mix));
  }

  // 4. Order within each day
  for (const d of trainDays) slotsOf.get(d)!.sort((a, b) => rank(a.ex, a.main) - rank(b.ex, b.main));

  // 5. Fit the weekly targets: trim sets where a muscle went over its ceiling, add where it's still short
  const days: RoutineDay[] = WEEK.map((wd) => ({ id: "day-" + uid().slice(0, 8), weekday: wd, title: "Rest", slots: (slotsOf.get(wd) ?? []).map((x) => x.s) }));
  const exMap = new Map(pool.map((e) => [e.id, e]));
  for (let pass = 0; pass < 3; pass++) {
    const vol = new Map(planVolume({ id: "", name: "", isCurrent: false, createdAt: "", days }, exMap).map((v) => [v.group, v.sets]));
    for (const g of focus) {
      const t = tmap.get(g)!, w = vol.get(g) ?? 0;
      const own = days.flatMap((d) => d.slots.filter((s) => exMap.get(s.exerciseId)?.volume.some((v) => v.group === g && v.weight === 1)).map((s) => ({ d, s })));
      if (t.max != null && w > t.max) for (const o of own.sort((a, b) => b.s.sets - a.s.sets)) { if ((vol.get(g) ?? 0) <= t.max || o.s.sets <= 2) continue; o.s.sets--; vol.set(g, (vol.get(g) ?? 0) - 1); }
      else if (w < t.min!) for (const o of own.sort((a, b) => a.s.sets - b.s.sets)) { if ((vol.get(g) ?? 0) >= t.min! || o.s.sets >= 4 || o.d.slots.reduce((a, s) => a + s.sets, 0) >= cap) continue; o.s.sets++; vol.set(g, (vol.get(g) ?? 0) + 1); }
    }
  }

  // 6. No 2-set exercises where a third set still fits the muscle's ceiling and the day's time (Leo: "balanced")
  const mainBySlot = new Map(trainDays.flatMap((d) => slotsOf.get(d)!.map((x) => [x.s.id, x.main] as const)));
  const sumSets = (d: RoutineDay) => d.slots.reduce((a, s) => a + s.sets, 0);
  {
    const vol = new Map(planVolume({ id: "", name: "", isCurrent: false, createdAt: "", days }, exMap).map((v) => [v.group, v.sets]));
    for (const d of days) for (const s of d.slots) {
      if (s.sets >= 3) continue;
      const ex = exMap.get(s.exerciseId)!;
      if (sumSets(d) >= cap || ex.volume.some((v) => { const t = tmap.get(v.group); return t?.max != null && (vol.get(v.group) ?? 0) + v.weight > t.max; })) {
        // No room (the muscle's ceiling or the day's time): take the set from a 4-set exercise for the same muscle instead (weekly sets stay the same)
        const g = mainBySlot.get(s.id);
        const four = (sumSets(d) >= cap ? d.slots : days.flatMap((x) => x.slots)).find((o) => o.sets >= 4 && mainBySlot.get(o.id) === g && o !== s);
        if (four) { four.sets--; s.sets++; continue; }
        // Or drop it and give its sets to the muscle's other exercises (3 → 4), when no angle or stretch is lost
        const others = days.flatMap((x) => x.slots).filter((o) => o !== s && mainBySlot.get(o.id) === g && exMap.get(o.exerciseId));
        const jobsOf = (e: Exercise) => [e.jobs?.[g!]].flat().filter(Boolean) as string[];
        const keeps = jobsOf(ex).every((j) => others.some((o) => jobsOf(exMap.get(o.exerciseId)!).includes(j)))
          && (!ex.stretch?.includes(g!) || others.some((o) => exMap.get(o.exerciseId)!.stretch?.includes(g!)));
        const room = others.filter((o) => o.sets < 4).sort((x, y) => (d.slots.includes(y) ? 1 : 0) - (d.slots.includes(x) ? 1 : 0));
        if (g && keeps && room.length >= s.sets && (sumSets(d) < cap || room.slice(0, s.sets).every((o) => d.slots.includes(o)))) { for (let k = 0; k < s.sets; k++) room[k].sets++; s.sets = 0; }
        continue;
      }
      s.sets++;
      for (const v of ex.volume) vol.set(v.group, (vol.get(v.group) ?? 0) + v.weight);
    }
  }

  for (const d of days) d.slots = d.slots.filter((x) => x.sets > 0);

  // 7. Even days: move whole exercises from the busiest day to the lightest while that narrows the gap, the lighter
  //    day's theme trains that muscle, it isn't there yet, the muscle stays at 11 sets or fewer that day and keeps
  //    its rest days between hard workouts (4+ direct sets), and the day stays within the time limit.
  const direct = (d: RoutineDay, g: MuscleGroup) => d.slots.reduce((a, s) => a + (exMap.get(s.exerciseId)?.volume.some((v) => v.group === g && v.weight === 1) ? s.sets : 0), 0);
  const train = days.filter((d) => d.slots.length);
  for (let guard = 0; guard < 40; guard++) {
    const byLoad = [...train].sort((a, b) => sumSets(b) - sumSets(a));
    let moved = false;
    for (const H of byLoad) {
      for (const L of [...byLoad].reverse()) {
        const gap0 = sumSets(H) - sumSets(L);
        if (gap0 <= 2) break;
        const cands = [...H.slots].sort((a, b) => a.sets - b.sets);
        for (const s of cands) {
          const g = mainBySlot.get(s.id), ex = exMap.get(s.exerciseId);
          if (!g || !ex) continue;
          if (Math.abs(gap0 - 2 * s.sets) >= gap0) continue; // must narrow the gap
          if (FAMILY[g] !== "core" && !THEME_FAMILIES[themeOf.get(L.weekday!)!].includes(FAMILY[g])) continue;
          if (L.slots.some((x) => x.exerciseId === s.exerciseId) || sumSets(L) + s.sets > cap) continue;
          const groups = ex.volume.filter((v) => v.weight === 1).map((v) => v.group);
          if (groups.some((m) => direct(L, m) + s.sets > MAX_SESSION_SETS)) continue;
          H.slots = H.slots.filter((x) => x !== s); L.slots = [...L.slots, s];
          const ok = groups.every((m) => restsEnough(train.filter((d) => direct(d, m) >= 4).map((d) => d.weekday!), m)
            || !restsEnough(train.filter((d) => (d === L ? direct(d, m) - s.sets : d === H ? direct(d, m) + s.sets : direct(d, m)) >= 4).map((d) => d.weekday!), m));
          if (ok) { moved = true; break; }
          L.slots = L.slots.filter((x) => x !== s); H.slots = [...H.slots, s];
        }
        if (moved) break;
      }
      if (moved) break;
    }
    if (!moved) break;
  }
  const exMain = (s: Slot) => mainBySlot.get(s.id) ?? ORDER[0];
  for (const d of train) d.slots.sort((a, b) => rank(exMap.get(a.exerciseId)!, exMain(a)) - rank(exMap.get(b.exerciseId)!, exMain(b)));

  // 8. Names from the split ("Push A", "Upper B", "Full body C"); a theme used once has no letter
  const count = new Map<string, number>();
  for (const d of trainDays) count.set(themeOf.get(d)!, (count.get(themeOf.get(d)!) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const d of days) {
    if (!d.slots.length) continue;
    const th = themeOf.get(d.weekday!)!;
    const i = seen.get(th) ?? 0; seen.set(th, i + 1);
    d.title = THEME_NAME[th] + (count.get(th)! > 1 ? " " + "ABC"[i] : "");
  }
  return days;
}

/** Reps and rest for one exercise (database rules: heavy ≤ 10, light ≥ 12; holds 60 s rest). `mix` forces the
 *  heavy (6–10) or light (12–15) half for mass gain. */
export function repsFor(ex: Exercise, goal: Goal, restSec: number, mix?: "heavy" | "light"): Pick<Slot, "repMin" | "repMax" | "restSec"> {
  if (ex.measure === "time") return { repMin: HOLD_SLOT.repMin, repMax: HOLD_SLOT.repMax, restSec: 60 };
  const big = ex.isHeavy || ex.compound;
  const r: [number, number] = goal === "strength" ? (ex.isHeavy ? [3, 6] : big ? [6, 8] : [8, 12])
    : goal === "endurance" ? [15, 20] : goal === "maintenance" ? [8, 12]
    : mix === "heavy" ? [6, 10] : mix === "light" ? [12, 15] : big ? [8, 12] : [10, 15];
  return { repMin: r[0], repMax: r[1], restSec };
}

/** Main muscle of an exercise: its first direct muscle */
const mainOf = (e: Exercise) => e.volume.find((v) => v.weight === 1)?.group;

/**
 * Other exercises for the same job (Build my plan → swap): the same main muscle worked directly, at least one of the
 * same angles, same kind (reps or a hold). The same type first (compound or isolation), then top picks for the goal,
 * then ★, then by name. Exercises already in
 * `taken` (the rest of that day) are left out.
 */
export function swapOptions(ex: Exercise, all: Exercise[], goal: Goal, taken: Set<string>): Exercise[] {
  const g = mainOf(ex);
  if (!g) return [];
  const jobs = new Set([ex.jobs?.[g]].flat().filter(Boolean) as string[]);
  return all
    .filter((e) => e.id !== ex.id && !e.archived && !taken.has(e.id) && mainOf(e) === g && (e.measure === "time") === (ex.measure === "time"))
    .filter((e) => !jobs.size || [e.jobs?.[g]].flat().some((j) => j && jobs.has(j)))
    .sort((a, b) => (!!b.compound === !!ex.compound ? 1 : 0) - (!!a.compound === !!ex.compound ? 1 : 0) || (isTopPick(b, goal) ? 1 : 0) - (isTopPick(a, goal) ? 1 : 0) || (b.isHeavy ? 1 : 0) - (a.isHeavy ? 1 : 0) || a.name.localeCompare(b.name));
}

/** Day order: compound lifts first (big muscles first, ★ before the rest), then isolation, abs and neck last */
const rank = (e: Exercise, main: MuscleGroup) => (FAMILY[main] === "core" ? 100 : 0) + (e.compound ? 0 : 50) + ORDER.indexOf(main) + (e.isHeavy ? 0 : 0.5);

// ——— Conflicts: what in the inputs breaks the main rules, shown before building ———
export interface Conflict { id: string; text: string; fix?: { label: string; targets?: VolumeTarget[]; maxMinutes?: number };
  /** What the user can change to solve it on the check screen: a muscle's target, the workout length or the days */
  edit: { kind: "target"; group: MuscleGroup } | { kind: "time" } | { kind: "days" };
  /** More than one rest day: training more days is the other way to fix it (days a week and the minutes each) */
  moreDays?: { days: number; minutes: number } }

export function planConflicts(input: Pick<GenInput, "trainDays" | "maxMinutes" | "targets" | "restSec">): Conflict[] {
  const restSec = input.restSec ?? 120;
  const out: Conflict[] = [];
  const n = input.trainDays.length;
  if (!n) return [{ id: "days", text: "Pick at least one day to train.", edit: { kind: "days" } }];
  const days = WEEK.filter((d) => input.trainDays.includes(d));
  const focus = input.targets.filter(isFocus);
  for (const t of focus) {
    // Workouts the minimum needs (11 sets max each) vs. how many fit with the muscle's rest days in between
    const need = Math.ceil(t.min! / MAX_SESSION_SETS);
    const fit = fitSessions(days, t.group, need), most = MAX_SESSION_SETS * fit;
    if (fit >= need) continue;
    const rest = restDaysOf(t.group), M = muscleLabel(t.group);
    const why = fit < n
      ? `with ${rest} rest day${rest > 1 ? "s" : ""} after each hard workout, only ${fit} fit in your week`
      : `you train ${n} day${n > 1 ? "s" : ""}`;
    out.push({ id: "max-" + t.group,
      text: `${M}: ${t.min} sets a week needs ${need} workouts (max ${MAX_SESSION_SETS} sets each), but ${why}. The most it can get: ${most}.`,
      fix: { label: `Set ${M} to ${Math.max(1, most - 4)}–${most}`, targets: [{ ...t, min: Math.max(1, most - 4), max: most }] },
      edit: { kind: "target", group: t.group } });
  }
  // Time: the week's sets spread over the days (indirect sets cover part of the work)
  const weekSets = focus.reduce((a, t) => a + aimSets(t), 0) * INDIRECT_SHARE;
  const perDay = Math.ceil(weekSets / n), minutes = estimateMinutes(perDay, Math.ceil(perDay / 3.5), restSec);
  if (minutes > input.maxMinutes + LENGTH_BUFFER) {
    const next = [45, 60, 75, 90, 120].find((m) => m >= minutes);
    // More than one rest day: training more days spreads the same sets over shorter workouts (Leo, Nov 21 2026)
    const minsFor = (k: number) => { const p = Math.ceil(weekSets / k); return estimateMinutes(p, Math.ceil(p / 3.5), restSec); };
    const more = 7 - n >= 2 ? [n + 1, n + 2, n + 3, n + 4, n + 5].filter((k) => k <= 6).find((k) => minsFor(k) <= input.maxMinutes + LENGTH_BUFFER) : undefined;
    const k = more ?? Math.min(6, n + 2);
    out.push({ id: "time", text: `About ${minutes} min a workout to hit every target, over your ${input.maxMinutes} min.${!next && 7 - n < 2 ? " Lower some targets." : ""}`,
      fix: next ? { label: `Allow ${next} min`, maxMinutes: next } : undefined, edit: { kind: "time" },
      moreDays: 7 - n >= 2 && k > n ? { days: k, minutes: minsFor(k) } : undefined });
  }
  return out;
}

function combos(xs: number[], k: number): number[][] {
  if (k === 0) return [[]];
  return xs.flatMap((x, i) => combos(xs.slice(i + 1), k - 1).map((c) => [x, ...c]));
}

/** Muscle groups in display order (for the flow's target list) */
export const GROUPS = MUSCLE_GROUPS.map((m) => m.id);
