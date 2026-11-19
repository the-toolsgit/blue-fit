// The whole week of a plan at a glance: a tile per muscle, and whether the routine "checks all the boxes" for the
// user's goal (Plan → Week check). The rules are universal (training research), never taken from a plan.
// Pure and framework-free. Numbers marked *judgment* are our own reasoning; the rest cite their source.
import { muscleLabel, type Exercise, type Goal, type MuscleGroup, type Routine, type RoutineDay, type Slot, type VolumeTarget } from "./types";
import { formatTarget, isFocus, planVolume } from "./volume";
import { fmtNum } from "./util";
import { estimateMinutes } from "./timeEstimate";

/**
 * The jobs (movement patterns / regions) each muscle needs to be fully trained, from anatomy. Varying exercises across
 * these grows a muscle more evenly than one exercise (Costa 2021; Kassiano 2022). Examples:
 * biceps: long head (arm behind the body, e.g. incline curl) + short head (arm in front, e.g. preacher curl) + brachialis
 *   (a separate muscle under the biceps that pushes it up; neutral or palms-down grip shifts work to it: hammer, reverse
 *   curl). Regional growth differs with arm position (Pedrosa 2023); Leo, Nov 18 2026: counted as biceps;
 * triceps: long head (arm overhead: overhead extensions grow it most, Maeo 2023) + lateral head + medial head (arm at the
 *   side: pushdown, kickback, dip; the medial head works in every extension, so it's tagged with the arm-down moves);
 * quads: squat/press + knee extension (only extensions grow the rectus femoris well, Ema 2016; Zabaleta-Korta 2021);
 * hamstrings: knee flexion + hip hinge (curls and hinges grow different parts, Maeo 2021; Bourne 2017);
 * calves: straight-knee (gastrocnemius) + bent-knee (soleus);
 * back (Nov 18 2026, by region): lats (pulldowns, straight-arm pulldowns, rows with the elbow tucked) + upper back
 *   (rows: rhomboids, mid traps, teres) + lower back (spinal erectors: hip hinges, back extensions);
 * glutes: glute max (hip extension: thrusts, squats, presses) + glute medius (abduction);
 * abs: rectus abs (crunches, leg raises: "upper/lower abs" is one muscle) + obliques (twists, side bends).
 * A muscle with one job has no job check.
 */
export const JOBS: Partial<Record<MuscleGroup, string[]>> = {
  back: ["lats", "upper back", "lower back"],
  biceps: ["long head", "short head", "brachialis"],
  triceps: ["long head", "lateral head", "medial head"],
  traps: ["shrug", "mid/lower"],
  chest: ["upper", "mid/lower"],
  quads: ["squat", "extension"],
  hamstrings: ["knee flexion", "hip hinge"],
  calves: ["straight-knee", "bent-knee"],
  glutes: ["glute max", "glute medius"],
  forearms: ["flexors", "extensors"],
  abs: ["rectus abs", "obliques"],
  neck: ["flexion", "extension"],
};
/** Muscles with direct studies showing more growth from training at long length (stretched position):
 *  biceps (Pedrosa 2023), triceps (Maeo 2023), quads (Pedrosa 2022), hamstrings (Maeo 2021), calves (Kassiano 2023).
 *  Chest and lats are added by analogy (*judgment*). Other muscles have no stretch check. */
export const STRETCH_MUSCLES = new Set<MuscleGroup>(["biceps", "triceps", "quads", "hamstrings", "calves", "chest", "back"]);

/** Most direct sets for one muscle in one workout before extra sets add little (*judgment*: per-session returns
 *  shrink, so 20 weekly sets are better split over 2+ days; Schoenfeld 2016, Pelland 2024). */
export const MAX_SESSION_SETS = 10;
/** Direct sets that count as hard work for a muscle that day: hard work on back-to-back days leaves under ~48 h to
 *  recover (ACSM 2009: 48 h between sessions for the same muscles). The 4-set line is *judgment*. */
export const HARD_SETS = 4;
/** Rep ranges (middle of the range). Growth: similar results anywhere from ~6 to ~30 reps taken close to failure
 *  (Schoenfeld 2017, 2021). Heavy ≤ 10 and light ≥ 12 for the mix (*judgment*; Schoenfeld 2021 suggests combining). */
export const GROWTH_REPS = [6, 30] as const;
export const HEAVY_REPS = 10, LIGHT_REPS = 12;
/** Rest: under ~90 s grows a little less (Schoenfeld 2016; Singer 2024). Strength: 3+ min (ACSM 2009). Endurance: ≤ 90 s (ACSM 2009). */
export const GROWTH_REST = 90, STRENGTH_REST = 180, ENDURANCE_REST = 90;

export type JobState = "hit" | "none";
export interface Tile {
  group: MuscleGroup;
  /** Planned sets for the week (indirect = ½) */
  week: number;
  /** Days that train it directly */
  days: number;
  target?: VolumeTarget;
  status: "ok" | "below" | "above" | "off";
  jobs: { name: string; state: JobState }[];
}
export type CheckId = "volume" | "jobs" | "stretch" | "frequency" | "dose" | "recovery" | "reps" | "mix" | "rest" | "heavy";
export interface Check { id: CheckId; label: string; pass: boolean; detail: string }
export interface ScorePart { id: "volume" | "parts" | "recovery" | "failure" | "twice" | "dose"; label: string; points: number; max: number; note: string }
export interface WeekScore { score: number; parts: ScorePart[] }
export interface WeekInsight { days: number; sets: number; minutes: number; muscles: number; tiles: Tile[]; checks: Check[]; score: WeekScore }

/** The week's score: starts at SCORE_BASE, the rest is earned (weights are *judgment*, Leo Nov 18 2026). */
export const SCORE_BASE = 20;
export const SCORE_WEIGHTS = { volume: 25, parts: 20, recovery: 15, failure: 10, twice: 10 } as const;
/** Points off for each muscle-workout over MAX_SESSION_SETS (*judgment*) */
export const DOSE_PENALTY = 2;

const mid = (s: Slot) => (s.repMin + s.repMax) / 2;
const isDirect = (ex: Exercise | undefined, g: MuscleGroup) => !!ex?.volume.some((v) => v.group === g && v.weight === 1);

/**
 * `failure`: muscles that get a failure set this week (from the failure picks), and whether failure applies to the
 * goal at all. Without it, failure points are given in full.
 */
export function weekInsight(routine: Routine, exMap: Map<string, Exercise>, targets: VolumeTarget[], goal: Goal = "growth",
  failure?: { muscles: Set<MuscleGroup>; eligible: (ex: Exercise) => boolean; applies: boolean }): WeekInsight {
  const days = routine.days.map((d) => ({ ...d, slots: d.slots.filter((s) => exMap.has(s.exerciseId)) })).filter((d) => d.slots.length);
  const slots = days.flatMap((d) => d.slots);
  const ex = (s: Slot) => exMap.get(s.exerciseId)!;
  const sets = slots.reduce((a, s) => a + s.sets, 0);
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const week = new Map(planVolume(routine, exMap).map((v) => [v.group, v.sets]));
  const jobsHit = (g: MuscleGroup) => new Set(slots.flatMap((s) => { const j = ex(s).jobs?.[g]; return j == null ? [] : Array.isArray(j) ? j : [j]; }));
  const directSets = (d: RoutineDay, g: MuscleGroup) => d.slots.filter((s) => isDirect(ex(s), g)).reduce((a, s) => a + s.sets, 0);
  const daysFor = (g: MuscleGroup) => days.filter((d) => directSets(d, g) > 0);
  /** Sets a muscle gets in one workout, indirect at ½ (as weekly volume counts them) */
  const daySets = (d: RoutineDay, g: MuscleGroup) => d.slots.reduce((a, s) => a + s.sets * (ex(s).volume.find((v) => v.group === g)?.weight ?? 0), 0);

  const tiles: Tile[] = [...week].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([g, n]) => {
    const t = tmap.get(g), hit = jobsHit(g);
    return {
      group: g, week: n, days: daysFor(g).length, target: t,
      status: !isFocus(t) ? "off" : n < t.min ? "below" : t.max != null && n > t.max ? "above" : "ok",
      jobs: (JOBS[g] ?? []).map((name) => ({ name, state: hit.has(name) ? "hit" : "none" })),
    };
  });

  // Focus muscles the week trains directly (skipped muscles never fail a check)
  const main = [...new Set(slots.flatMap((s) => ex(s).volume.filter((v) => v.weight === 1).map((v) => v.group)))].filter((g) => isFocus(tmap.get(g)));
  const L = (g: MuscleGroup) => muscleLabel(g);
  const list = (xs: string[]) => xs.slice(0, 3).join(" · ") + (xs.length > 3 ? ` · +${xs.length - 3} more` : "");
  const check = (id: CheckId, label: string, bad: string[], ok: string): Check => ({ id, label, pass: bad.length === 0, detail: bad.length ? list(bad) : ok });
  const uniq = (xs: string[]) => [...new Set(xs)];

  const volume = (minOnly: boolean) => check("volume", "Weekly volume", main.flatMap((g) => {
    const t = tmap.get(g)!, w = week.get(g) ?? 0;
    if (w < t.min!) return [`${L(g)} below (${fmtNum(w)} of ${formatTarget(t)})`];
    if (!minOnly && t.max != null && w > t.max) return [`${L(g)} above (${fmtNum(w)} of ${formatTarget(t)})`];
    return [];
  }), "Every muscle in its weekly target");

  const jobs = check("jobs", "Every job", main.flatMap((g) => {
    const miss = (JOBS[g] ?? []).filter((j) => !jobsHit(g).has(j));
    return miss.length ? [`${L(g)}: no ${miss.join(", ")}`] : [];
  }), "Every muscle trained in all its movements");

  const stretch = check("stretch", "Stretch", main.filter((g) => STRETCH_MUSCLES.has(g) && !slots.some((s) => ex(s).stretch?.includes(g)))
    .map((g) => `${L(g)}: nothing at a long length`), "Every muscle loaded in the stretch");

  // With the same weekly sets, once or twice a week grow a muscle about the same (Schoenfeld 2019; Pelland 2024); a
  // second day matters when the week's sets would be too many for one workout. So only muscles over MAX_SESSION_SETS a
  // week need 2+ days.
  const needsTwo = (g: MuscleGroup) => (week.get(g) ?? 0) > MAX_SESSION_SETS;
  const frequency = check("frequency", "Twice a week", main.filter((g) => needsTwo(g) && daysFor(g).length < 2).map((g) => `${L(g)}: ${fmtNum(week.get(g) ?? 0)} sets in one day`),
    `Every muscle over ${MAX_SESSION_SETS} sets a week on 2+ days`);

  const over = main.flatMap((g) => days.filter((d) => daySets(d, g) > MAX_SESSION_SETS).map((d) => ({ g, d, n: daySets(d, g) })));
  const dose = check("dose", "Sets per workout", uniq(over.map((o) => `${L(o.g)}: ${fmtNum(o.n)} sets on ${o.d.title}`)),
    `${MAX_SESSION_SETS} or fewer sets per muscle per workout (indirect count ½)`);

  const recovery = check("recovery", "Recovery", main.flatMap((g) => {
    const hard = days.filter((d) => d.weekday != null && directSets(d, g) >= HARD_SETS);
    const pair = hard.find((a) => hard.some((b) => b !== a && (b.weekday! - a.weekday! + 7) % 7 === 1));
    return pair ? [`${L(g)}: hard on back-to-back days`] : [];
  }), "No muscle worked hard two days in a row");

  const reps = check("reps", "Rep range", uniq(slots.filter((s) => mid(s) < GROWTH_REPS[0] || mid(s) > GROWTH_REPS[1]).map((s) => `${ex(s).name}: ${s.repMin}–${s.repMax}`)),
    `Every exercise ${GROWTH_REPS[0]}–${GROWTH_REPS[1]} reps`);

  const mix = check("mix", "Heavy and light", main.flatMap((g) => {
    const own = slots.filter((s) => isDirect(ex(s), g));
    if (new Set(own.map((s) => s.exerciseId)).size < 2) return [];
    const heavy = own.some((s) => mid(s) <= HEAVY_REPS), light = own.some((s) => mid(s) >= LIGHT_REPS);
    return heavy && light ? [] : [`${L(g)}: all ${heavy ? `≤${HEAVY_REPS}` : `${LIGHT_REPS}+`} reps`];
  }), `Heavy (≤${HEAVY_REPS}) and light (${LIGHT_REPS}+) work per muscle`);

  const rest = (min: number | null, max: number | null, only?: Slot[]) => {
    const pool = only ?? slots;
    const bad = uniq(pool.filter((s) => (min != null && s.restSec < min) || (max != null && s.restSec > max)).map((s) => `${ex(s).name}: ${s.restSec} s`));
    return check("rest", min != null && max == null ? "Long enough rests" : "Short rests", bad,
      min != null ? `Rests ${min >= 120 ? `${min / 60} min` : `${min} s`} or more` : `Rests ${max} s or less`);
  };

  const stars = slots.filter((s) => ex(s).isHeavy);
  const checks: Check[] =
    goal === "maintenance" ? [volume(true), recovery]
    : goal === "strength" ? [volume(false), jobs, frequency, recovery,
        check("heavy", "Heavy lifts", stars.length && stars.every((s) => s.repMin <= 6) ? [] : stars.length ? uniq(stars.filter((s) => s.repMin > 6).map((s) => `${ex(s).name}: ${s.repMin}+ reps`)) : ["No ★ heavy lift"], "★ lifts at 6 reps or less (Schoenfeld 2017)"),
        rest(STRENGTH_REST, null, stars)]
    : goal === "endurance" ? [volume(false), jobs, frequency, recovery,
        check("reps", "High reps", slots.filter((s) => mid(s) >= 15).length * 2 >= slots.length ? [] : ["Most exercises under 15 reps"], "Most exercises 15+ reps (ACSM 2009)"),
        rest(null, ENDURANCE_REST)]
    : [volume(false), jobs, stretch, frequency, dose, recovery, reps, mix, rest(GROWTH_REST, null)];

  // Score: each part earns its share of points
  const share = (good: number, all: number) => (all ? good / all : 1);
  const inTarget = main.filter((g) => { const t = tmap.get(g)!, w = week.get(g) ?? 0; return w >= t.min! && (t.max == null || w <= t.max); }).length;
  const allJobs = main.flatMap((g) => (JOBS[g] ?? []).length > 1 ? (JOBS[g] ?? []).map((j) => jobsHit(g).has(j)) : []);
  const backToBack = (g: MuscleGroup) => { const hard = days.filter((d) => d.weekday != null && directSets(d, g) >= HARD_SETS); return hard.some((a) => hard.some((b) => b !== a && (b.weekday! - a.weekday! + 7) % 7 === 1)); };
  const failEligible = failure ? main.filter((g) => slots.some((s) => isDirect(ex(s), g) && failure.eligible(ex(s)))) : [];
  const twoNeeded = main.filter(needsTwo);
  const W = SCORE_WEIGHTS;
  const parts: ScorePart[] = [
    { id: "volume", label: "Weekly volume", max: W.volume, points: W.volume * share(inTarget, main.length), note: `${inTarget} of ${main.length} muscles in target` },
    { id: "parts", label: "Every part", max: W.parts, points: W.parts * share(allJobs.filter(Boolean).length, allJobs.length), note: `${allJobs.filter(Boolean).length} of ${allJobs.length} parts trained` },
    { id: "recovery", label: "Recovery", max: W.recovery, points: W.recovery * share(main.filter((g) => !backToBack(g)).length, main.length), note: `${main.filter((g) => !backToBack(g)).length} of ${main.length} muscles rested` },
    { id: "failure", label: "Failure", max: W.failure, points: !failure || !failure.applies ? W.failure : W.failure * share(failEligible.filter((g) => failure.muscles.has(g)).length, failEligible.length),
      note: !failure || !failure.applies ? "Not used for your goal" : `${failEligible.filter((g) => failure.muscles.has(g)).length} of ${failEligible.length} muscles get a failure set` },
    { id: "twice", label: "Twice a week", max: W.twice, points: W.twice * share(twoNeeded.filter((g) => daysFor(g).length >= 2).length, twoNeeded.length), note: twoNeeded.length ? `${twoNeeded.filter((g) => daysFor(g).length >= 2).length} of ${twoNeeded.length} big muscles on 2+ days` : "No muscle needs it" },
    { id: "dose", label: "Sets per workout", max: 0, points: -DOSE_PENALTY * over.length, note: over.length ? `${over.length} over ${MAX_SESSION_SETS} in one workout` : `None over ${MAX_SESSION_SETS}` },
  ];
  // An empty plan earns nothing beyond the base
  const earned = main.length ? parts.reduce((a, p) => a + p.points, 0) : 0;
  const score = { score: Math.max(SCORE_BASE, Math.min(100, Math.round(SCORE_BASE + earned))), parts: parts.map((p) => ({ ...p, points: Math.round(p.points * 10) / 10 })) };

  const mins = days.map((d) => estimateMinutes(d.slots.reduce((a, s) => a + s.sets, 0), d.slots.length));
  return { days: days.length, sets, minutes: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length / 5) * 5 : 0, muscles: main.length, tiles, checks, score };
}

/** One exercise of the routine as it works a muscle: where and how much */
export interface MuscleExercise { exerciseId: string; name: string; days: string[]; sets: number }
/** The routine's exercises for one muscle, grouped by the part (job) they train; `other` = direct work with no job
 *  tag, `indirect` = exercises that work it at ½ (e.g. rows for biceps). Pure. */
export function exercisesFor(routine: Routine, exMap: Map<string, Exercise>, g: MuscleGroup): { parts: { job: string; exercises: MuscleExercise[] }[]; other: MuscleExercise[]; indirect: MuscleExercise[] } {
  const found = new Map<string, MuscleExercise & { weight: number }>();
  for (const d of routine.days) for (const s of d.slots) {
    const ex = exMap.get(s.exerciseId), v = ex?.volume.find((x) => x.group === g);
    if (!ex || !v) continue;
    const cur = found.get(ex.id) ?? { exerciseId: ex.id, name: ex.name, days: [], sets: 0, weight: v.weight };
    if (!cur.days.includes(d.title)) cur.days.push(d.title);
    cur.sets += s.sets;
    found.set(ex.id, cur);
  }
  const jobsOf = (id: string) => { const j = exMap.get(id)?.jobs?.[g]; return j == null ? [] : Array.isArray(j) ? j : [j]; };
  const all = [...found.values()];
  const strip = ({ weight: _w, ...x }: MuscleExercise & { weight: number }) => x;
  const parts = (JOBS[g] ?? []).map((job) => ({ job, exercises: all.filter((x) => x.weight === 1 && jobsOf(x.exerciseId).includes(job)).map(strip) }));
  return {
    parts: parts.length > 1 ? parts : [],
    other: all.filter((x) => x.weight === 1 && (parts.length < 2 || !jobsOf(x.exerciseId).some((j) => (JOBS[g] ?? []).includes(j)))).map(strip),
    indirect: all.filter((x) => x.weight < 1).map(strip),
  };
}
