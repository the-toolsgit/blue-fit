// Builds a whole week plan from the user's goal, training days, workout length and weekly targets (Plan → Generate).
// Pure and framework-free. Rules come from the muscle database and the Plan check (workoutCheck.ts); choices marked
// *judgment* are ours. The result is checked with weekInsight by the caller.
import { isTopPick, tierPoints } from "./catalog";
import { NEEDS_HEAVY_LIGHT, restDaysOf } from "./muscles";
import { HOLD_SLOT } from "./routineEdit";
import { estimateMinutes, slotsMinutes } from "./timeEstimate";
import { muscleLabel, MUSCLE_GROUPS, type Exercise, type Goal, type MuscleGroup, type RoutineDay, type Slot, type VolumeTarget } from "./types";
import { uid } from "./util";
import { isFocus, planVolume } from "./volume";
import { priorityOf } from "./volumeModel";
import { HARD_SETS, JOBS, MAX_SESSION_SETS, STRETCH_MUSCLES, weekInsight } from "./workoutCheck";

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
export type Theme = "full" | "upper" | "lower" | "push" | "pull" | "legs";
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

/** Most exercises in one workout (*judgment*: past ~10 a session drags and quality drops) */
export const MAX_EXERCISES = 10;
/** Big muscles: each themed day that trains them opens with one of their compound lifts */
const HEADLINE = new Set<MuscleGroup>(["back", "chest", "quads", "hamstrings"]);
const FREE_WEIGHT = new Set(["barbell", "dumbbell", "bodyweight", "fixedBar"]);
/** The big muscles a themed day is for: it should have a compound lift for each (full body: none required) */
const headlinesOf = (th: Theme): MuscleGroup[] =>
  th === "push" ? ["chest"] : th === "pull" ? ["back"] : th === "legs" || th === "lower" ? ["quads", "hamstrings"] : th === "upper" ? ["chest", "back"] : [];

type Meta = { main: MuscleGroup };

/**
 * The themes on the training days: the classic split for the number of days, turned so each muscle can get the
 * workouts it needs with its rest days in between on the days that train it (e.g. 5 days Mon–Fri: Upper, Lower,
 * Push, Pull, Legs, or another order when that spaces the muscles better).
 */
export function chooseThemes(trainDays: number[], targets: VolumeTarget[]): Map<number, Theme> {
  const base = SPLITS[Math.min(trainDays.length, 7)] ?? [];
  const tmap = new Map(targets.map((t) => [t.group, t]));
  let best = new Map<number, Theme>(), bestScore = -Infinity;
  for (let k = 0; k < Math.max(1, base.length); k++) {
    const themeOf = new Map(trainDays.map((d, i) => [d, base[(i + k) % base.length]]));
    let score = 0;
    for (const g of ORDER) {
      const t = tmap.get(g);
      if (!isFocus(t) || FAMILY[g] === "core") continue;
      const allowed = trainDays.filter((d) => THEME_FAMILIES[themeOf.get(d)!].includes(FAMILY[g]));
      const want = sessionsFor(aimSets(t!), trainDays.length);
      const fit = allowed.length ? fitSessions(allowed, g, want) : 0;
      score -= (want - fit) * (priorityOf(g, t) === "priority" ? 20 : 10) * (HEADLINE.has(g) ? 2 : 1);
    }
    if (score > bestScore) { bestScore = score; best = themeOf; }
  }
  return best;
}

/** Pull-family muscles that also fit a Push day (*judgment*: common practice trains rear delts and traps with the
 *  shoulders, forearms with the arms), so Push and Pull days can even out */
const ALSO_PUSH = new Set<MuscleGroup>(["rearDelts", "traps", "forearms"]);
/** Days whose theme trains this muscle (abs and neck: any day) */
export const allowedDaysFor = (g: MuscleGroup, trainDays: number[], themeOf: Map<number, Theme>) =>
  trainDays.filter((d) => FAMILY[g] === "core" || THEME_FAMILIES[themeOf.get(d)!].includes(FAMILY[g])
    || (ALSO_PUSH.has(g) && THEME_FAMILIES[themeOf.get(d)!].includes("push")));

export function generatePlan(input: GenInput): RoutineDay[] {
  const rand = rng(input.seed ?? 1);
  const restSec = input.restSec ?? REST_BY_GOAL[input.goal];
  const trainDays = WEEK.filter((d) => input.trainDays.includes(d));
  const n = trainDays.length;
  const tmap = new Map(input.targets.map((t) => [t.group, t]));
  const focus = ORDER.filter((g) => isFocus(tmap.get(g)));
  const pool = input.exercises.filter((e) => !e.archived);
  const exMap = new Map(pool.map((e) => [e.id, e]));
  // The length is an average with a 5-minute buffer both ways (Leo, Nov 21 2026): a day may run up to 5 min over
  const limit = input.maxMinutes + LENGTH_BUFFER;
  const days: RoutineDay[] = WEEK.map((wd) => ({ id: "day-" + uid().slice(0, 8), weekday: wd, title: "Rest", slots: [] }));
  if (!n) return days;
  const dayOf = (wd: number) => days.find((d) => d.weekday === wd)!;
  const meta = new Map<string, Meta>();
  const sumSets = (d: RoutineDay) => d.slots.reduce((a, s) => a + s.sets, 0);
  const restOf = (ex: Exercise) => repsFor(ex, input.goal, restSec).restSec;
  /** Would this day stay within the time and exercise limits with these slots added? */
  const fits = (d: RoutineDay, add: { sets: number; restSec: number }[]) =>
    d.slots.length + add.length <= MAX_EXERCISES && slotsMinutes([...d.slots, ...add]) <= limit;

  // 1. The split: themes on the days, turned for the best spacing (see chooseThemes)
  const themeOf = chooseThemes(trainDays, input.targets);

  // 2. Weekly aim per muscle. Every angle needs an exercise of its own: when the ceiling allows, at least 3 sets per
  //    angle (2 when only that fits). Then, when the week can't hold it all in the time, cut Normal muscles toward
  //    their minimum first, then Priority ones, then everything evenly (never under 2 sets).
  const aim = new Map(focus.map((g) => [g, aimSets(tmap.get(g)!)]));
  // Maintain has no Every angle check (minimums only): no room kept for angles there
  const angleRule = input.goal !== "maintenance";
  if (angleRule) for (const g of focus) {
    const J = JOBS[g]?.length ?? 1, t = tmap.get(g)!, max = t.max ?? Infinity;
    if (J > 1) aim.set(g, Math.max(aim.get(g)!, 3 * J <= max ? 3 * J : 2 * J <= max ? 2 * J : 0));
  }
  // Strength: ★ lifts rest 3 min whatever the pick, about half the sets (*judgment*), so the day holds fewer
  const capSets = setsForMinutes(limit, input.goal === "strength" ? Math.max(restSec, (restSec + 180) / 2) : restSec);
  const room = Math.min(capSets, MAX_EXERCISES * 3.5) * n;
  const direct = () => [...aim.values()].reduce((a, b) => a + b, 0) * INDIRECT_SHARE;
  /** The week was cut to fit the time: later steps don't add the cut sets back */
  const squeezed = direct() > room;
  for (const tier of ["normal", "priority"] as const) {
    const excess = direct() / INDIRECT_SHARE - room / INDIRECT_SHARE;
    if (excess <= 0) break;
    const gs = focus.filter((g) => priorityOf(g, tmap.get(g)) === tier);
    const slack = gs.reduce((a, g) => a + Math.max(0, aim.get(g)! - tmap.get(g)!.min!), 0);
    if (!slack) continue;
    const f = Math.min(1, excess / slack);
    for (const g of gs) aim.set(g, Math.round(aim.get(g)! - Math.max(0, aim.get(g)! - tmap.get(g)!.min!) * f));
  }
  if (direct() > room) { const f = room / direct(); for (const [g, v] of aim) aim.set(g, Math.max(2, Math.floor(v * f))); }

  // 3. Sets per muscle per day, then the exercises that fill them. Big muscles first, so their compound lifts' half
  //    sets count for the small ones. Each muscle gets as many workouts as its sets need (2 from 10 a week; more when
  //    over 11 per workout) on the days its theme trains, with its rest days in between; its sets split evenly over
  //    those days, the bigger share on the lighter day. A share that doesn't fit a day's time goes to another of its days.
  const have = new Map<MuscleGroup, number>();
  const jobsHit = new Map<MuscleGroup, Set<string>>();
  const stretched = new Set<MuscleGroup>();
  const used = new Set<string>();
  const add = (d: RoutineDay, ex: Exercise, sets: number, main: MuscleGroup) => {
    const s: Slot = { id: "slot-" + uid().slice(0, 8), exerciseId: ex.id, sets, repMin: 0, repMax: 0, restSec: restOf(ex) };
    d.slots.push(s); meta.set(s.id, { main }); used.add(ex.id);
    for (const v of ex.volume) have.set(v.group, (have.get(v.group) ?? 0) + sets * v.weight);
    for (const [g, j] of Object.entries(ex.jobs ?? {})) for (const one of [j].flat()) jobsHit.set(g as MuscleGroup, new Set([...(jobsHit.get(g as MuscleGroup) ?? []), one!]));
    for (const g of ex.stretch ?? []) stretched.add(g);
  };
  const pick = (g: MuscleGroup, d: RoutineDay, sets: number): Exercise | undefined => {
    // Never the same movement twice on one day (Leo, Nov 22 2026): no exercise whose angle for this muscle is already there
    const taken = new Set(d.slots.filter((s) => meta.get(s.id)?.main === g).map((s) => moveKey(exMap.get(s.exerciseId)!, g)));
    const cands = pool.filter((e) => e.volume.some((v) => v.group === g && v.weight === 1) && (e.measure !== "time" || g === "abs") && !taken.has(moveKey(e, g)));
    const needCompound = HEADLINE.has(g) && !d.slots.some((s) => meta.get(s.id)?.main === g && exMap.get(s.exerciseId)?.compound);
    const bestNewTier = Math.max(-1, ...cands.filter((e) => !input.avoid?.has(e.id) && !used.has(e.id)).map(tierPoints));
    let best: Exercise | undefined, bestScore = -Infinity;
    for (const e of cands) {
      let score = rand() * 2;
      // An angle still missing counts more than a top pick: every angle is a rule, a top pick a preference
      const jobs = [e.jobs?.[g]].flat().filter(Boolean) as string[];
      score += 10 * jobs.filter((j) => !jobsHit.get(g)?.has(j)).length;
      if (isTopPick(e, input.goal)) score += 6;
      score += tierBonus(e, input.goal);
      if (needCompound && e.compound) score += 8;
      if (needCompound && e.compound && FREE_WEIGHT.has(e.equipment)) score += 1;
      // The Stretch check is a rule too: as much as a missing angle
      if (STRETCH_MUSCLES.has(g) && !stretched.has(g) && e.stretch?.includes(g)) score += 10;
      // Your current plan's exercises: something new when an equally good one (same or better tier) is there, never at
      // the cost of quality for the goal (Leo, Nov 22 2026)
      if (input.avoid?.has(e.id) && tierPoints(e) <= bestNewTier) score -= 8;
      if (used.has(e.id)) score -= 30;
      if (d.slots.some((x) => x.exerciseId === e.id)) score -= 100;
      // Don't push other muscles past their ceiling with half sets
      for (const v of e.volume) { const t = tmap.get(v.group); if (v.group !== g && t?.max != null && (have.get(v.group) ?? 0) + v.weight * sets > t.max) score -= 4; }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  };
  /** A muscle's sets in one workout as the Sets per workout check counts them (half sets ½) */
  const doseOn = (d: RoutineDay, g: MuscleGroup) => d.slots.reduce((a, s) => a + s.sets * (exMap.get(s.exerciseId)?.volume.find((v) => v.group === g)?.weight ?? 0), 0);
  for (const g of focus) {
    const t = tmap.get(g)!, allowed = allowedDaysFor(g, trainDays, themeOf);
    if (!allowed.length) continue;
    const openJobs = () => (JOBS[g] ?? []).filter((j) => !jobsHit.get(g)?.has(j)).length;
    let need = Math.max(0, Math.round(aim.get(g)! - (have.get(g) ?? 0)));
    // Angles still open need their own exercise even when half sets already cover the number (ceiling allowing)
    const open0 = angleRule && (JOBS[g]?.length ?? 1) > 1 ? openJobs() : 0;
    const roomLeft = Math.max(0, (t.max ?? Infinity) - (have.get(g) ?? 0));
    // Short on time: 2 sets an angle, within the cut aim (step 2's cut stays)
    if (open0) need = Math.max(need, squeezed ? Math.min(Math.floor(roomLeft), 2 * open0, aim.get(g)!) : Math.min(Math.floor(roomLeft), 3 * open0));
    if (need < 2) continue;
    // Workouts: enough to stay at or under 11 a workout; 2 when the week's total is over 11 (Twice a week)
    // A big muscle also gets every day whose theme is for it (Push for chest, Pull for back…), 3 sets a day at least
    const themed = allowed.filter((d) => headlinesOf(themeOf.get(d)!).includes(g)).length;
    const want = Math.max(sessionsFor(need, n), aim.get(g)! > MAX_SESSION_SETS && n >= 2 ? 2 : 1, Math.min(themed, Math.floor(need / 3)));
    const k = Math.min(fitSessions(allowed, g, want), Math.floor(need / 2) || 1);
    let best: number[] = allowed.slice(0, k), bestScore = -Infinity;
    for (const c of combos(allowed, k)) {
      // Lightest days first; abs and neck (any day) go where there are fewest exercises
      const score = (restsEnough(c, g) ? 1000 : 0) - c.reduce((a, d) => a + sumSets(dayOf(d)) + (FAMILY[g] === "core" ? 4 * dayOf(d).slots.length : 0), 0) + rand() * 0.5;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    // Even split, the extra set on the lighter day
    const order = [...best].sort((a, b) => sumSets(dayOf(a)) - sumSets(dayOf(b)));
    const shares = order.map((_, i) => Math.floor(need / k) + (i < need % k ? 1 : 0));
    // Exercises a day: 3–4 sets each; enough of them to reach the open angles
    order.forEach((wd, i) => {
      const d = dayOf(wd);
      // 11 sets a workout at most, half sets from other exercises that day included
      let share = Math.min(shares[i], Math.floor(MAX_SESSION_SETS - doseOn(d, g)));
      const anglesLeftHere = Math.ceil(openJobs() / Math.max(1, order.length - i));
      // Angles come first: as many exercises as open angles when 2 sets each fit (one exercise may cover two)
      let count = Math.max(1, Math.round(share / 3.5), Math.min(anglesLeftHere, Math.floor(share / 2)));
      count = Math.min(count, Math.floor(share / 2));
      for (let c = 0; c < count && share >= 2; c++) {
        const sets = Math.min(4, Math.ceil(share / (count - c)));
        const ex = pick(g, d, sets);
        if (!ex) {
          // No other movement for this muscle left on this day (never the same one twice): another of its days that has
          // one free and the time, keeping the rest days; else more sets on what's here (4 each at most)
          const alt = allowed.map(dayOf).filter((x) => x !== d).sort((a, b) => sumSets(a) - sumSets(b))
            .map((x) => ({ x, e: pick(g, x, sets) }))
            .find(({ x, e }) => e && fits(x, [{ sets, restSec: restOf(e) }]) && doseOn(x, g) + sets <= MAX_SESSION_SETS
              && (restsEnough(trainDays.filter((w) => w === x.weekday || dayOf(w).slots.some((s) => meta.get(s.id)?.main === g)), g) || sets < HARD_SETS));
          if (alt) { add(alt.x, alt.e!, sets, g); share -= sets; continue; }
          for (const o of d.slots.filter((x) => meta.get(x.id)?.main === g)) {
            while (share > 0 && o.sets < 4 && doseOn(d, g) + 1 <= MAX_SESSION_SETS && slotsMinutes(d.slots.map((x) => (x === o ? { ...x, sets: x.sets + 1 } : x))) <= limit) {
              o.sets++; share--;
              for (const v of exMap.get(o.exerciseId)!.volume) have.set(v.group, (have.get(v.group) ?? 0) + v.weight);
            }
          }
          break;
        }
        let where = d;
        if (!fits(d, [{ sets, restSec: restOf(ex) }])) {
          // No time left that day: another of its days with room, keeping its rest days between hard workouts
          const alt = allowed.map(dayOf).filter((x) => x !== d && !x.slots.some((s) => s.exerciseId === ex.id) && fits(x, [{ sets, restSec: restOf(ex) }]))
            .sort((a, b) => (a.slots.some((s) => meta.get(s.id)?.main === g) ? 1 : 0) - (b.slots.some((s) => meta.get(s.id)?.main === g) ? 1 : 0) || sumSets(a) - sumSets(b))
            .find((x) => restsEnough(trainDays.filter((w) => w === x.weekday || dayOf(w).slots.some((s) => meta.get(s.id)?.main === g)), g) || sets < HARD_SETS);
          if (!alt) {
            // Day full of exercises: more sets on this muscle's exercises already there (4 each at most), time allowing
            for (const o of d.slots.filter((x) => meta.get(x.id)?.main === g)) {
              while (share > 0 && o.sets < 4 && slotsMinutes(d.slots.map((x) => (x === o ? { ...x, sets: x.sets + 1 } : x))) <= limit) {
                o.sets++; share--;
                for (const v of exMap.get(o.exerciseId)!.volume) have.set(v.group, (have.get(v.group) ?? 0) + v.weight);
              }
            }
            break;
          }
          where = alt;
        }
        add(where, ex, sets, g);
        share -= sets;
      }
    });
  }

  // 4. Fit the weekly targets: trim sets where a muscle went over its ceiling (an exercise keeps 3 when it can), add
  //    where it's still short (up to 4 an exercise, within the day's time)
  const volNow = () => new Map(planVolume({ id: "", name: "", isCurrent: false, createdAt: "", days }, exMap).map((v) => [v.group, v.sets]));
  const ownSlots = (g: MuscleGroup) => days.flatMap((d) => d.slots.filter((s) => exMap.get(s.exerciseId)?.volume.some((v) => v.group === g && v.weight === 1)).map((s) => ({ d, s })));
  for (let pass = 0; pass < 3; pass++) {
    const vol = volNow();
    for (const g of focus) {
      const t = tmap.get(g)!, w = vol.get(g) ?? 0, own = ownSlots(g);
      if (t.max != null && w > t.max) {
        for (const floor of [3, 2]) for (const o of own.sort((a, b) => b.s.sets - a.s.sets)) {
          if ((vol.get(g) ?? 0) <= t.max || o.s.sets <= floor) continue;
          o.s.sets--;
          for (const v of exMap.get(o.s.exerciseId)!.volume) vol.set(v.group, (vol.get(v.group) ?? 0) - v.weight);
        }
        // Still over from half sets: trim the exercises that give them, while their own muscle stays in its target
        for (const d of days) for (const o of d.slots) {
          const v = exMap.get(o.exerciseId)!.volume.find((x) => x.group === g && x.weight < 1), m = meta.get(o.id)?.main;
          if (!v || !m || (vol.get(g) ?? 0) <= t.max || o.sets <= 3) continue;
          const tm = tmap.get(m);
          if (tm?.min != null && (vol.get(m) ?? 0) - 1 < tm.min) continue;
          o.sets--;
          for (const x of exMap.get(o.exerciseId)!.volume) vol.set(x.group, (vol.get(x.group) ?? 0) - x.weight);
        }
      } else if (w < t.min! && own.every((o) => o.s.sets >= 4 || !fits({ ...o.d, slots: o.d.slots.filter((x) => x !== o.s) }, [{ sets: o.s.sets + 1, restSec: o.s.restSec }]))) {
        // Still short and its exercises can't take more (4 sets each, or no time), or none of its own (half sets from
        // others fell short): one more exercise (2–3 sets) on its day with fewest exercises, even past the time; step 7
        // takes the time back from muscles over their minimum
        const sets = Math.max(2, Math.min(3, Math.ceil(t.min! - w)));
        // (one over the exercise limit if that's the only way: leaving a muscle out is worse)
        const d = allowedDaysFor(g, trainDays, themeOf).map(dayOf).filter((x) => x.slots.length <= MAX_EXERCISES && !own.some((o) => o.d === x && o.s.sets < 4)).sort((a, b) => a.slots.length - b.slots.length || sumSets(a) - sumSets(b))[0];
        const ex = d && pick(g, d, sets);
        if (d && ex) { add(d, ex, sets, g); for (const v of ex.volume) vol.set(v.group, (vol.get(v.group) ?? 0) + sets * v.weight); }
      } else if (w < t.min!) for (const o of own.sort((a, b) => a.s.sets - b.s.sets)) {
        if ((vol.get(g) ?? 0) >= t.min! || o.s.sets >= 4 || !fits({ ...o.d, slots: o.d.slots.filter((x) => x !== o.s) }, [{ sets: o.s.sets + 1, restSec: o.s.restSec }])) continue;
        o.s.sets++; vol.set(g, (vol.get(g) ?? 0) + 1);
      }
    }
  }

  // 5. No 2-set exercises where it can be helped (Leo: "balanced"): a third set if the ceiling and the time allow; else
  //    one from a 4-set exercise for the same muscle; else drop it and give its sets to the muscle's other exercises
  //    when no angle or stretch is lost
  {
    const vol = volNow();
    for (const d of days) for (const s of d.slots) {
      if (s.sets >= 3) continue;
      const ex = exMap.get(s.exerciseId)!, g = meta.get(s.id)?.main;
      const roomy = fits({ ...d, slots: d.slots.filter((x) => x !== s) }, [{ sets: s.sets + 1, restSec: s.restSec }]);
      if (roomy && !ex.volume.some((v) => { const t = tmap.get(v.group); return t?.max != null && (vol.get(v.group) ?? 0) + v.weight > t.max; })) {
        s.sets++; for (const v of ex.volume) vol.set(v.group, (vol.get(v.group) ?? 0) + v.weight); continue;
      }
      if (!g) continue;
      const four = (roomy ? days.flatMap((x) => x.slots) : d.slots).find((o) => o.sets >= 4 && meta.get(o.id)?.main === g && o !== s);
      if (four) { four.sets--; s.sets++; continue; }
      const others = days.flatMap((x) => x.slots).filter((o) => o !== s && o.sets > 0 && meta.get(o.id)?.main === g);
      const jobsOf = (e: Exercise) => [e.jobs?.[g]].flat().filter(Boolean) as string[];
      // Twice a week: a muscle over 11 a week keeps a second day
      const daysAfter = new Set(days.filter((x) => x.slots.some((o) => o !== s && o.sets > 0 && meta.get(o.id)?.main === g)).map((x) => x.id)).size;
      const keeps = jobsOf(ex).every((j) => others.some((o) => jobsOf(exMap.get(o.exerciseId)!).includes(j)))
        && (!ex.stretch?.includes(g) || others.some((o) => exMap.get(o.exerciseId)!.stretch?.includes(g)))
        && ((vol.get(g) ?? 0) <= MAX_SESSION_SETS || daysAfter >= 2);
      const room2 = others.filter((o) => o.sets < 4).sort((x, y) => (d.slots.includes(y) ? 1 : 0) - (d.slots.includes(x) ? 1 : 0));
      if (keeps && room2.length >= s.sets && room2.slice(0, s.sets).every((o) => d.slots.includes(o) || fits(days.find((x) => x.slots.includes(o))!, [{ sets: 1, restSec: o.restSec }]))) {
        for (let k = 0; k < s.sets; k++) room2[k].sets++;
        s.sets = 0;
      }
    }
    for (const d of days) d.slots = d.slots.filter((x) => x.sets > 0);
  }

  // 6. Even days: move whole exercises from the busiest day to the lightest while that narrows the gap, the lighter
  //    day's theme trains that muscle, it isn't there yet, the muscle stays at 11 sets or fewer that day, keeps its rest
  //    days between hard workouts (4+ direct sets), and the day stays within the time and exercise limits
  const directOn = (d: RoutineDay, g: MuscleGroup) => d.slots.reduce((a, s) => a + (exMap.get(s.exerciseId)?.volume.some((v) => v.group === g && v.weight === 1) ? s.sets : 0), 0);
  const train = trainDays.map(dayOf);
  for (let guard = 0; guard < 60; guard++) {
    const byLoad = [...train].sort((a, b) => sumSets(b) - sumSets(a));
    let moved = false;
    for (const H of byLoad) {
      for (const L of [...byLoad].reverse()) {
        const gap0 = sumSets(H) - sumSets(L);
        if (gap0 <= 2) break;
        for (const s of [...H.slots].sort((a, b) => a.sets - b.sets)) {
          const g = meta.get(s.id)?.main, ex = exMap.get(s.exerciseId);
          if (!g || !ex || Math.abs(gap0 - 2 * s.sets) >= gap0) continue;
          if (!allowedDaysFor(g, trainDays, themeOf).includes(L.weekday!)) continue;
          if (L.slots.some((x) => x.exerciseId === s.exerciseId) || !fits(L, [s])) continue;
          // Don't take a themed day's only headline compound away
          if (HEADLINE.has(g) && ex.compound && !H.slots.some((x) => x !== s && meta.get(x.id)?.main === g && exMap.get(x.exerciseId)?.compound)) continue;
          const groups = ex.volume.filter((v) => v.weight === 1).map((v) => v.group);
          if (ex.volume.some((v) => doseOn(L, v.group) + s.sets * v.weight > MAX_SESSION_SETS)) continue;
          const before = groups.map((m) => restsEnough(train.filter((d) => directOn(d, m) >= HARD_SETS).map((d) => d.weekday!), m));
          H.slots = H.slots.filter((x) => x !== s); L.slots = [...L.slots, s];
          const ok = groups.every((m, i) => !before[i] || restsEnough(train.filter((d) => directOn(d, m) >= HARD_SETS).map((d) => d.weekday!), m));
          if (ok) { moved = true; break; }
          L.slots = L.slots.filter((x) => x !== s); H.slots = [...H.slots, s];
        }
        if (moved) break;
      }
      if (moved) break;
    }
    if (!moved) break;
  }

  // 6b. Twice a week: a muscle over 11 sets a week (half sets included) trained directly on one day only moves one of
  //     its exercises to another day its theme allows (time, 11-a-workout and rest days permitting), or trades places
  //     with an exercise of another muscle there that can move the other way
  {
    const vol = volNow();
    for (const g of focus) {
      if ((vol.get(g) ?? 0) <= MAX_SESSION_SETS) continue;
      const on = train.filter((d) => directOn(d, g) > 0);
      if (on.length !== 1 || on[0].slots.filter((x) => meta.get(x.id)?.main === g).length < 2) continue;
      const H = on[0];
      const mine = H.slots.filter((x) => meta.get(x.id)?.main === g).sort((a, b) => a.sets - b.sets);
      const targetsL = allowedDaysFor(g, trainDays, themeOf).map(dayOf).filter((d) => d !== H).sort((a, b) => sumSets(a) - sumSets(b));
      const okRest = (m: MuscleGroup) => restsEnough(train.filter((d) => directOn(d, m) >= HARD_SETS).map((d) => d.weekday!), m);
      const tryMove = (s: Slot, from: RoutineDay, to: RoutineDay) => {
        const ex = exMap.get(s.exerciseId)!;
        if (!from.slots.includes(s) || to.slots.some((x) => x.exerciseId === s.exerciseId) || ex.volume.some((v) => doseOn(to, v.group) + s.sets * v.weight > MAX_SESSION_SETS)) return false;
        const groups = ex.volume.filter((v) => v.weight === 1).map((v) => v.group), before = groups.map(okRest);
        from.slots = from.slots.filter((x) => x !== s); to.slots = [...to.slots, s];
        if (groups.every((m, i) => !before[i] || okRest(m))) return true;
        to.slots = to.slots.filter((x) => x !== s); from.slots = [...from.slots, s];
        return false;
      };
      let done = false;
      for (const s of mine) {
        for (const L of targetsL) {
          if (fits(L, [s]) && tryMove(s, H, L)) { done = true; break; }
          // Trade: an exercise on L whose muscle may go on H and isn't the only one of that muscle on L
          for (const o of [...L.slots].sort((a, b) => Math.abs(a.sets - s.sets) - Math.abs(b.sets - s.sets))) {
            const og = meta.get(o.id)?.main;
            if (!og || og === g || !allowedDaysFor(og, trainDays, themeOf).includes(H.weekday!)) continue;
            if (HEADLINE.has(og) && exMap.get(o.exerciseId)?.compound) continue;
            // Both days must stay within time and the exercise limit; anything else puts both back exactly as they were
            const keepH = H.slots, keepL = L.slots;
            if (tryMove(o, L, H) && tryMove(s, H, L) && slotsMinutes(H.slots) <= limit && slotsMinutes(L.slots) <= limit
              && H.slots.length <= MAX_EXERCISES && L.slots.length <= MAX_EXERCISES) { done = true; break; }
            H.slots = keepH; L.slots = keepL;
          }
          if (done) break;
        }
        if (done) break;
      }
    }
  }

  // 7. Time: a day still over the length + 5 drops sets from the muscle furthest over its minimum; first only from
  //    muscles that stay at or above it, then (the length you picked wins; the check screen warned) from any, never
  //    under 2 sets
  {
    const vol = volNow();
    for (const d of train) for (let guard = 0; guard < 40 && slotsMinutes(d.slots) > limit; guard++) {
      const above = (x: Slot) => exMap.get(x.exerciseId)!.volume.every((v) => { const t = tmap.get(v.group); return !isFocus(t) || (vol.get(v.group) ?? 0) - v.weight >= t!.min!; });
      const pool2 = d.slots.filter((x) => x.sets > 2 && above(x));
      const s = (pool2.length ? pool2 : d.slots.filter((x) => x.sets > 2)).sort((a, b) => {
        const sur = (x: Slot) => { const g = meta.get(x.id)?.main; const t = g && tmap.get(g); return t && t.min != null ? (vol.get(g!) ?? 0) / t.min : 9; };
        return sur(b) - sur(a);
      })[0];
      if (!s) break;
      s.sets--;
      for (const v of exMap.get(s.exerciseId)!.volume) vol.set(v.group, (vol.get(v.group) ?? 0) - v.weight);
    }
  }

  // 8. Reps last, once every exercise is in place: mass gain gives each big muscle one heavy exercise (6–10, its best
  //    free-weight compound) and one light (12–15, an isolation or machine exercise); the rest by goal (repsFor)
  const assignReps = () => {
    const role = new Map<string, "heavy" | "light">();
    if (input.goal === "growth") for (const g of NEEDS_HEAVY_LIGHT) {
      const own = train.flatMap((d) => d.slots).filter((s) => meta.get(s.id)?.main === g && exMap.get(s.exerciseId)!.measure !== "time");
      if (new Set(own.map((s) => s.exerciseId)).size < 2) continue;
      const ex = (s: Slot) => exMap.get(s.exerciseId)!;
      const heavyScore = (s: Slot) => (ex(s).compound ? 4 : 0) + (ex(s).isHeavy ? 2 : 0) + (FREE_WEIGHT.has(ex(s).equipment) ? 1 : 0);
      const heavy = [...own].sort((a, b) => heavyScore(b) - heavyScore(a))[0];
      const light = [...own].filter((s) => s !== heavy).sort((a, b) => heavyScore(a) - heavyScore(b))[0];
      role.set(heavy.id, "heavy"); role.set(light.id, "light");
    }
    for (const d of train) for (const s of d.slots) Object.assign(s, repsFor(exMap.get(s.exerciseId)!, input.goal, restSec, role.get(s.id)));
  };
  assignReps();

  // 8b. Polish against the real Plan check: small changes (a set more or less, swap, add, remove or move an exercise)
  //     aimed at what the check still flags, the days over time and the 2-set exercises; each kept only when the whole
  //     plan gets better (misses first, then warnings, time, exercises per day, 2-set exercises, even days). Bounded,
  //     so it stays fast (about 300 tries).
  // Names first, so the check tells the days apart while polishing ("Back: 12 sets on Pull A")
  const nameDays = () => {
    const count = new Map<string, number>();
    for (const d of trainDays) count.set(themeOf.get(d)!, (count.get(themeOf.get(d)!) ?? 0) + 1);
    const seen = new Map<string, number>();
    for (const d of days) {
      if (!d.slots.length || d.weekday == null || !themeOf.has(d.weekday)) { d.title = "Rest"; continue; }
      const th = themeOf.get(d.weekday)!;
      const i = seen.get(th) ?? 0; seen.set(th, i + 1);
      d.title = THEME_NAME[th] + (count.get(th)! > 1 ? " " + "ABC"[i] : "");
    }
  };
  nameDays();
  polish({ days, train, meta, exMap, pool, input, restSec, limit, themeOf, trainDays, rand });
  // 8c. Nothing left out: a muscle with a minimum that ended at 0 sets (time cuts can do that) gets 2 sets on the day
  //     with the most time left, making room by taking sets from the muscles furthest above their minimum (never under 2)
  for (const g of focus) {
    const t = tmap.get(g)!;
    if (!t.min || (volNow().get(g) ?? 0) > 0) continue;
    const allowed = allowedDaysFor(g, trainDays, themeOf);
    const cands = (allowed.length ? allowed : trainDays).map(dayOf).sort((a, b) => slotsMinutes(a.slots) - slotsMinutes(b.slots));
    const vol = volNow();
    const surplus = (x: Slot) => { const m = meta.get(x.id)?.main; const tt = m && tmap.get(m); return tt && tt.min ? (vol.get(m!) ?? 0) / tt.min : 9; };
    let d = cands.find((x) => x.slots.length < MAX_EXERCISES);
    if (!d) {
      // Every day is full: swap out exercises whose muscles stay at or above their minimum without them, most spare
      // first (a muscle already under its minimum may only lose half sets, never down to 0)
      // Try the days with the fewest exercises first; use the first where enough can go
      for (const day of [...cands].sort((a, b) => a.slots.length - b.slots.length)) {
        const v2 = new Map(vol), keep = [...day.slots];
        const stays2 = (x: Slot) => exMap.get(x.exerciseId)!.volume.every((v) => {
          const tt = tmap.get(v.group), now = v2.get(v.group) ?? 0, after = now - v.weight * x.sets;
          return !isFocus(tt) || after >= tt.min || (now < tt.min && v.weight < 1 && after > 0);
        });
        while (keep.length >= MAX_EXERCISES) {
          const s = keep.filter(stays2).sort((a, b) => surplus(b) - surplus(a))[0];
          if (!s) break;
          keep.splice(keep.indexOf(s), 1);
          for (const v of exMap.get(s.exerciseId)!.volume) v2.set(v.group, (v2.get(v.group) ?? 0) - v.weight * s.sets);
        }
        if (keep.length >= MAX_EXERCISES) continue;
        day.slots = keep;
        for (const [k, v] of v2) vol.set(k, v);
        d = day;
        break;
      }
      if (!d) continue;
    }
    const ex = pick(g, d, 2);
    if (!ex) continue;
    for (let guard = 0; guard < 12 && !fits(d, [{ sets: 2, restSec: restOf(ex) }]); guard++) {
      const s = d.slots.filter((x) => x.sets > 2).sort((a, b) => surplus(b) - surplus(a))[0];
      if (!s) break;
      s.sets--;
      for (const v of exMap.get(s.exerciseId)!.volume) vol.set(v.group, (vol.get(v.group) ?? 0) - v.weight);
    }
    if (fits(d, [{ sets: 2, restSec: restOf(ex) }])) add(d, ex, 2, g);
  }
  assignReps();

  // 9. Order within each day, then names from the split ("Push A", "Upper B", "Full body C"); a theme used once has no letter
  for (const d of train) d.slots.sort((a, b) => rank(exMap.get(a.exerciseId)!, meta.get(a.id)?.main ?? ORDER[0]) - rank(exMap.get(b.exerciseId)!, meta.get(b.id)?.main ?? ORDER[0]));
  nameDays();
  return days;
}

/** Step 8b of generatePlan: local search against the Plan check (see there) */
function polish(c: { days: RoutineDay[]; train: RoutineDay[]; meta: Map<string, Meta>; exMap: Map<string, Exercise>; pool: Exercise[]; input: GenInput;
  restSec: number; limit: number; themeOf: Map<number, Theme>; trainDays: number[]; rand: () => number }) {
  const { days, train, meta, exMap, pool, input, restSec, limit, themeOf, trainDays } = c;
  const plan = { id: "", name: "", isCurrent: false, createdAt: "", days };
  const tmap = new Map(input.targets.map((t) => [t.group, t]));
  const sumSets = (d: RoutineDay) => d.slots.reduce((a, s) => a + s.sets, 0);
  const label = new Map(MUSCLE_GROUPS.map((m) => [m.label, m.id]));
  const cost = () => {
    const w = weekInsight(plan, exMap, input.targets, input.goal, undefined, { fast: true });
    let k = 0;
    for (const ch of w.checks) if (!ch.pass) k += (ch.warn ? 150 : 1000) * Math.max(1, ch.issues.length);
    for (const d of train) {
      k += 500 * Math.max(0, slotsMinutes(d.slots) - limit) + 600 * Math.max(0, d.slots.length - MAX_EXERCISES) + 4 * d.slots.filter((s) => s.sets < 3).length;
    }
    const ss = train.map(sumSets);
    k += 25 * Math.max(0, Math.max(...ss) - Math.min(...ss) - 2);
    // A coach's eye: two exercises for the same angle of a muscle on one day, or 3+ for one small muscle, is waste;
    // a Push / Pull / Legs / Upper / Lower day without a compound for its big muscle is missing its point
    for (const d of train) {
      const byMain = new Map<MuscleGroup, Slot[]>();
      for (const s of d.slots) { const g = meta.get(s.id)?.main; if (g) byMain.set(g, [...(byMain.get(g) ?? []), s]); }
      for (const [g, xs] of byMain) {
        const keys = xs.map((s) => angleKey(exMap.get(s.exerciseId)!, g));
        k += 40 * (keys.length - new Set(keys).size);
        // The same movement (same angle and equipment) twice on one day is a rule (Leo, Nov 22 2026): as bad as a miss
        const moves = xs.map((s) => moveKey(exMap.get(s.exerciseId)!, g));
        k += 1000 * (moves.length - new Set(moves).size);
        if (!HEADLINE.has(g) && xs.length >= 3) k += 40 * (xs.length - 2);
      }
      for (const g of headlinesOf(themeOf.get(d.weekday!)!)) {
        if (!isFocus(tmap.get(g))) continue;
        if (!d.slots.some((s) => meta.get(s.id)?.main === g && exMap.get(s.exerciseId)!.compound)) k += 300;
      }
    }
    return { k, w };
  };
  // Undo keeps the same slot objects (later tries hold references to them)
  const snap = () => ({ slots: days.map((d) => d.slots.map((s) => [s, { ...s }] as const)), meta: new Map(meta) });
  const restore = (x: ReturnType<typeof snap>) => {
    days.forEach((d, i) => { d.slots = x.slots[i].map(([ref, v]) => Object.assign(ref, v)); });
    meta.clear(); for (const [k, v] of x.meta) meta.set(k, v);
  };
  const allowed = (g: MuscleGroup) => allowedDaysFor(g, trainDays, themeOf).map((wd) => days.find((d) => d.weekday === wd)!);
  const isDirect = (e: Exercise, g: MuscleGroup) => e.volume.some((v) => v.group === g && v.weight === 1);
  const newSlot = (ex: Exercise, sets: number, g: MuscleGroup): Slot => {
    const s: Slot = { id: "slot-" + uid().slice(0, 8), exerciseId: ex.id, sets, ...repsFor(ex, input.goal, restSec) };
    meta.set(s.id, { main: g });
    return s;
  };
  let best = cost(), tries = 0;
  for (let round = 0; round < 40 && tries < 320; round++) {
    // Muscles the check names, then the days over time
    const P = [...new Set(best.w.checks.filter((ch) => !ch.pass).flatMap((ch) => ch.issues.map((i) => label.get(i.who)).filter((g): g is MuscleGroup => !!g && isFocus(tmap.get(g)))))].slice(0, 6);
    const late = train.filter((d) => slotsMinutes(d.slots) > limit || d.slots.length > MAX_EXERCISES);
    const twos = train.flatMap((d) => d.slots.filter((s) => s.sets < 3).map((s) => ({ d, s })));
    const moves: (() => void)[] = [];
    const used = new Set(days.flatMap((d) => d.slots.map((s) => s.exerciseId)));
    for (const g of P) {
      const mine = days.flatMap((d) => d.slots.filter((s) => meta.get(s.id)?.main === g || isDirect(exMap.get(s.exerciseId)!, g)).map((s) => ({ d, s })));
      const hit = new Set(days.flatMap((d) => d.slots.flatMap((s) => [exMap.get(s.exerciseId)!.jobs?.[g]].flat().filter(Boolean) as string[])));
      const missing = (JOBS[g] ?? []).filter((j) => !hit.has(j));
      const needStretch = STRETCH_MUSCLES.has(g) && !days.some((d) => d.slots.some((s) => exMap.get(s.exerciseId)!.stretch?.includes(g)));
      const cands = pool.filter((e) => isDirect(e, g) && !used.has(e.id) && (e.measure !== "time" || g === "abs"))
        .map((e) => ({ e, sc: 10 * ([e.jobs?.[g]].flat().filter((j) => j && missing.includes(j)).length) + (needStretch && e.stretch?.includes(g) ? 10 : 0) + (isTopPick(e, input.goal) ? 6 : 0) + tierBonus(e, input.goal) + c.rand() }))
        .sort((a, b) => b.sc - a.sc).slice(0, 3).map((x) => x.e);
      for (const { d, s } of mine) {
        if (s.sets < 4) moves.push(() => { s.sets++; });
        if (s.sets > 2) moves.push(() => { s.sets--; });
        for (const e of cands) moves.push(() => { s.exerciseId = e.id; Object.assign(s, repsFor(e, input.goal, restSec)); meta.set(s.id, { main: g }); });
        for (const L of allowed(g)) if (L !== d && L.slots.length < MAX_EXERCISES && !L.slots.some((x) => x.exerciseId === s.exerciseId)) moves.push(() => { d.slots = d.slots.filter((x) => x !== s); L.slots = [...L.slots, s]; });
        if (mine.length > 1) moves.push(() => { d.slots = d.slots.filter((x) => x !== s); });
      }
      for (const e of cands) for (const L of allowed(g)) if (L.slots.length < MAX_EXERCISES) for (const n of [3, 2]) moves.push(() => { L.slots = [...L.slots, newSlot(e, n, g)]; });
      // A full day: free a spot by folding an exercise that repeats an angle into its twin (up to 4 sets), then add
      const jobsFor = (e: Exercise, m: MuscleGroup) => [e.jobs?.[m]].flat().filter(Boolean) as string[];
      for (const L of allowed(g)) if (L.slots.length >= MAX_EXERCISES - 1) for (const x of L.slots) {
        const mx = meta.get(x.id)?.main;
        if (!mx || mx === g) continue;
        const jx = jobsFor(exMap.get(x.exerciseId)!, mx);
        const sib = days.flatMap((d) => d.slots).filter((y) => y !== x && meta.get(y.id)?.main === mx && y.sets < 4);
        // The same angle first; else any exercise of that muscle (the check then judges the lost angle)
        const twin = sib.find((y) => jx.every((j) => jobsFor(exMap.get(y.exerciseId)!, mx).includes(j))
          && (!exMap.get(x.exerciseId)!.stretch?.includes(mx) || exMap.get(y.exerciseId)!.stretch?.includes(mx))) ?? sib[0];
        if (!twin || !cands[0]) continue;
        for (const e of cands.slice(0, 2)) for (const n of [3, 2]) moves.push(() => { twin.sets = Math.min(4, twin.sets + x.sets); L.slots = [...L.slots.filter((z) => z !== x), newSlot(e, n, g)]; });
      }
    }
    for (const d of late) for (const s of d.slots) {
      if (s.sets > 2) moves.push(() => { s.sets--; });
      const g = meta.get(s.id)?.main;
      if (g) for (const L of allowed(g)) if (L !== d && L.slots.length < MAX_EXERCISES && !L.slots.some((x) => x.exerciseId === s.exerciseId)) moves.push(() => { d.slots = d.slots.filter((x) => x !== s); L.slots = [...L.slots, s]; });
    }
    for (const { s } of twos.slice(0, 4)) moves.push(() => { s.sets++; });
    // Same-day trade: a set from a muscle above its minimum to a short one (time stays the same)
    const vol = new Map(planVolume(plan, exMap).map((v) => [v.group, v.sets]));
    const spare = (o: Slot) => o.sets > 2 && exMap.get(o.exerciseId)!.volume.every((v) => { const t = tmap.get(v.group); return !isFocus(t) || (vol.get(v.group) ?? 0) - v.weight >= t!.min!; });
    for (const g of P) for (const d of train) for (const s of d.slots.filter((x) => meta.get(x.id)?.main === g && x.sets < 4))
      for (const o of d.slots.filter((x) => x !== s && spare(x)).slice(0, 4)) moves.push(() => { s.sets++; o.sets--; });
    // Fold an exercise that repeats an angle on the same day into its twin
    for (const d of train) for (const x of d.slots) {
      const g = meta.get(x.id)?.main;
      if (!g) continue;
      const key = (y: Slot) => [exMap.get(y.exerciseId)!.jobs?.[g]].flat().filter(Boolean).sort().join("+");
      const twin = d.slots.find((y) => y !== x && meta.get(y.id)?.main === g && key(y) === key(x) && y.sets < 4);
      if (twin) moves.push(() => { twin.sets = Math.min(4, twin.sets + x.sets); d.slots = d.slots.filter((z) => z !== x); });
      // …or spread the repeats: one of them to another day that trains the muscle
      const many = d.slots.filter((y) => meta.get(y.id)?.main === g).length >= 3;
      if (twin || many) for (const L of allowed(g)) if (L !== d && L.slots.length < MAX_EXERCISES && !L.slots.some((z) => z.exerciseId === x.exerciseId))
        moves.push(() => { d.slots = d.slots.filter((z) => z !== x); L.slots = [...L.slots, x]; });
    }
    // A themed day without its big muscle's compound: bring one from another day, or add one
    for (const d of train) for (const g of headlinesOf(themeOf.get(d.weekday!)!)) {
      if (!isFocus(tmap.get(g)) || d.slots.some((s) => meta.get(s.id)?.main === g && exMap.get(s.exerciseId)!.compound)) continue;
      for (const o of train) if (o !== d) for (const s of o.slots.filter((x) => meta.get(x.id)?.main === g && exMap.get(x.exerciseId)!.compound))
        if (!d.slots.some((x) => x.exerciseId === s.exerciseId)) moves.push(() => { o.slots = o.slots.filter((x) => x !== s); d.slots = [...d.slots, s]; });
      const comp = pool.filter((e) => e.compound && isDirect(e, g) && !used.has(e.id)).sort((a, b) => (isTopPick(b, input.goal) ? 1 : 0) - (isTopPick(a, input.goal) ? 1 : 0) || tierBonus(b, input.goal) - tierBonus(a, input.goal))[0];
      if (comp) {
        moves.push(() => { d.slots = [...d.slots, newSlot(comp, 3, g)]; });
        // or in place of an isolation exercise for that muscle there
        for (const x of d.slots.filter((y) => meta.get(y.id)?.main === g)) moves.push(() => { x.exerciseId = comp.id; Object.assign(x, repsFor(comp, input.goal, restSec)); });
      }
    }
    // A day over time with every exercise at 2 sets: drop a whole exercise
    for (const d of late) if (d.slots.every((x) => x.sets <= 2)) for (const x of d.slots) moves.push(() => { d.slots = d.slots.filter((z) => z !== x); });
    // Even days: exercises from the busier days to lighter ones
    for (const H of [...train].sort((a, b) => sumSets(b) - sumSets(a)).slice(0, 3)) for (const s of [...H.slots].sort((a, b) => a.sets - b.sets)) {
      const g = meta.get(s.id)?.main;
      if (g) for (const L of allowed(g)) if (L !== H && L.slots.length < MAX_EXERCISES && sumSets(L) + s.sets < sumSets(H) && !L.slots.some((x) => x.exerciseId === s.exerciseId)) moves.push(() => { H.slots = H.slots.filter((x) => x !== s); L.slots = [...L.slots, s]; });
    }
    let improved = false;
    for (const m of moves) {
      if (tries >= 320) break;
      const before = snap();
      m(); tries++;
      const now = cost();
      if (now.k < best.k - 0.5) { best = now; improved = true; break; }
      restore(before);
    }
    if (!improved) break;
  }
}

/** Reps and rest for one exercise (database rules: heavy ≤ 10, light ≥ 12; holds 60 s rest). `mix` forces the
 *  heavy (6–10) or light (12–15) half for mass gain. */
export function repsFor(ex: Exercise, goal: Goal, restSec: number, mix?: "heavy" | "light"): Pick<Slot, "repMin" | "repMax" | "restSec"> {
  if (ex.measure === "time") return { repMin: HOLD_SLOT.repMin, repMax: HOLD_SLOT.repMax, restSec: 60 };
  const big = ex.isHeavy || ex.compound;
  const r: [number, number] = goal === "strength" ? (ex.isHeavy && ex.compound ? [3, 6] : big ? [6, 8] : [8, 12])
    : goal === "endurance" ? [15, 20] : goal === "maintenance" ? [8, 12]
    : mix === "heavy" ? [6, 10] : mix === "light" ? [12, 15] : big ? [8, 12] : [10, 15];
  // Strength: ★ compound lifts rest 3 min or more whatever the rest picked (ACSM 2009; the Long rests check);
  // ★ calf raises and shrugs get 6–8 reps (isHeavy && !compound → big → 6–8) and the picked rest
  return { repMin: r[0], repMax: r[1], restSec: goal === "strength" && ex.isHeavy && ex.compound ? Math.max(restSec, 180) : restSec };
}

/** Main muscle of an exercise: its first direct muscle */
/** A muscle's angle(s) an exercise trains ("one" when the muscle has no angles) */
const angleKey = (e: Exercise, g: MuscleGroup) => [e.jobs?.[g]].flat().filter(Boolean).sort().join("+") || "one";
/** Same angle with the same equipment = the same movement (DB lateral raise and DB lateral-to-front raise); a DB and a
 *  cable lateral raise load the muscle differently, so they're different (Leo, Nov 22 2026) */
const moveKey = (e: Exercise, g: MuscleGroup) => angleKey(e, g) + "|" + e.equipment;
/** Jeff Nippard's tier as a pick bonus (Leo, Nov 22 2026): S+ about +8, A +3, unrated 0, F −4. His lists rank for muscle
 *  growth, so strength plans don't use them (their ★ lifts and top picks lead there). */
const tierBonus = (e: Exercise, goal: Goal | undefined) => (goal === "strength" ? 0 : (tierPoints(e) - 2.8) * 1.5);
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
    .sort((a, b) => (!!b.compound === !!ex.compound ? 1 : 0) - (!!a.compound === !!ex.compound ? 1 : 0) || tierBonus(b, goal) - tierBonus(a, goal) || (isTopPick(b, goal) ? 1 : 0) - (isTopPick(a, goal) ? 1 : 0) || (b.isHeavy ? 1 : 0) - (a.isHeavy ? 1 : 0) || a.name.localeCompare(b.name));
}

/** Day order: compound lifts first (big muscles first, ★ before the rest, free weights before machines), then isolation, abs and neck last */
const rank = (e: Exercise, main: MuscleGroup) => (FAMILY[main] === "core" ? 100 : 0) + (e.compound ? 0 : 50) + ORDER.indexOf(main) + (e.isHeavy ? 0 : 0.5) + (FREE_WEIGHT.has(e.equipment) ? 0 : 0.25);

// ——— Conflicts: what in the inputs breaks the main rules, shown before building ———
export interface Conflict { id: string; text: string; fix?: { label: string; targets?: VolumeTarget[]; maxMinutes?: number; restSec?: number };
  /** What the user can change to solve it on the check screen: a muscle's target, the workout length or the days */
  edit: { kind: "target"; group: MuscleGroup } | { kind: "time" } | { kind: "days" } | { kind: "rest" };
  /** More than one rest day: training more days is the other way to fix it (days a week and the minutes each) */
  moreDays?: { days: number; minutes: number } }

export function planConflicts(input: Pick<GenInput, "trainDays" | "maxMinutes" | "targets" | "restSec"> & { goal?: Goal }): Conflict[] {
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
  // Endurance: rests of 90 s or less (ACSM 2009; the Short rests check)
  if (input.goal === "endurance" && (input.restSec ?? 0) > 90) {
    out.push({ id: "rest", text: `Endurance works best with rests of 90 s or less, and you picked ${(input.restSec ?? 0) / 60} min.`,
      fix: { label: "Rest 1½ min", restSec: 90 }, edit: { kind: "rest" } });
  }
  // Every angle needs an exercise of its own (2 sets at least): a ceiling too low for all of them
  for (const t of focus) {
    const J = JOBS[t.group]?.length ?? 1;
    if (J < 2 || t.max == null || t.max >= 2 * J) continue;
    const M = muscleLabel(t.group);
    out.push({ id: "angles-" + t.group, text: `${M}: its ${J} angles need ${2 * J} sets a week (2 each), but the target stops at ${t.max}.`,
      fix: { label: `Set ${M} to ${Math.min(t.min!, 2 * J)}–${2 * J}`, targets: [{ ...t, max: 2 * J }] }, edit: { kind: "target", group: t.group } });
  }
  // Time: the week's sets spread over the days (indirect sets cover part of the work)
  // Same sizing as the builder: angles get 3 sets each where the ceiling allows (not for maintain), and for strength
  // ★ lifts rest 3 min (about half the sets)
  const aimOf = (t: VolumeTarget) => {
    const J = JOBS[t.group]?.length ?? 1, a = aimSets(t), max = t.max ?? Infinity;
    return input.goal === "maintenance" || J < 2 ? a : Math.max(a, 3 * J <= max ? 3 * J : 2 * J <= max ? 2 * J : 0);
  };
  const restEff = input.goal === "strength" ? Math.max(restSec, (restSec + 180) / 2) : restSec;
  const weekSets = focus.reduce((a, t) => a + aimOf(t), 0) * INDIRECT_SHARE;
  const perDay = Math.ceil(weekSets / n), minutes = estimateMinutes(perDay, Math.ceil(perDay / 3.5), restEff);
  if (minutes > input.maxMinutes + LENGTH_BUFFER) {
    const next = [45, 60, 75, 90, 120].find((m) => m >= minutes);
    // More than one rest day: training more days spreads the same sets over shorter workouts (Leo, Nov 21 2026)
    const minsFor = (k: number) => { const p = Math.ceil(weekSets / k); return estimateMinutes(p, Math.ceil(p / 3.5), restEff); };
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

