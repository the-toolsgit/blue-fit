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
 * biceps: curl + hammer (neutral grip shifts work to the brachialis, a separate muscle under the biceps);
 * triceps: overhead (long head at length, Maeo 2023) + arms down (pushdown, kickback, dip);
 * quads: squat/press + knee extension (only extensions grow the rectus femoris well, Ema 2016; Zabaleta-Korta 2021);
 * hamstrings: knee flexion + hip hinge (curls and hinges grow different parts, Maeo 2021; Bourne 2017);
 * calves: straight-knee (gastrocnemius) + bent-knee (soleus). A muscle with one job has no job check.
 */
export const JOBS: Partial<Record<MuscleGroup, string[]>> = {
  back: ["vertical pull", "row", "straight-arm"],
  biceps: ["curl", "hammer"],
  triceps: ["overhead", "pushdown"],
  traps: ["shrug", "mid/lower"],
  chest: ["upper", "mid/lower"],
  quads: ["squat", "extension"],
  hamstrings: ["knee flexion", "hip hinge"],
  calves: ["straight-knee", "bent-knee"],
  glutes: ["hip extension", "abduction"],
  forearms: ["flexors", "extensors"],
  abs: ["flexion", "rotation"],
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
export interface WeekInsight { days: number; sets: number; minutes: number; muscles: number; tiles: Tile[]; checks: Check[] }

const mid = (s: Slot) => (s.repMin + s.repMax) / 2;
const isDirect = (ex: Exercise | undefined, g: MuscleGroup) => !!ex?.volume.some((v) => v.group === g && v.weight === 1);

export function weekInsight(routine: Routine, exMap: Map<string, Exercise>, targets: VolumeTarget[], goal: Goal = "growth"): WeekInsight {
  const days = routine.days.map((d) => ({ ...d, slots: d.slots.filter((s) => exMap.has(s.exerciseId)) })).filter((d) => d.slots.length);
  const slots = days.flatMap((d) => d.slots);
  const ex = (s: Slot) => exMap.get(s.exerciseId)!;
  const sets = slots.reduce((a, s) => a + s.sets, 0);
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const week = new Map(planVolume(routine, exMap).map((v) => [v.group, v.sets]));
  const jobsHit = (g: MuscleGroup) => new Set(slots.map((s) => ex(s).jobs?.[g]).filter((x): x is string => !!x));
  const directSets = (d: RoutineDay, g: MuscleGroup) => d.slots.filter((s) => isDirect(ex(s), g)).reduce((a, s) => a + s.sets, 0);
  const daysFor = (g: MuscleGroup) => days.filter((d) => directSets(d, g) > 0);

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

  const frequency = check("frequency", "Twice a week", main.filter((g) => daysFor(g).length < 2).map((g) => `${L(g)}: once a week`),
    "Every muscle on 2+ days");

  const dose = check("dose", "Sets per workout", uniq(main.flatMap((g) => days.filter((d) => directSets(d, g) > MAX_SESSION_SETS)
    .map((d) => `${L(g)}: ${directSets(d, g)} sets on ${d.title}`))), `${MAX_SESSION_SETS} or fewer sets per muscle per workout`);

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

  const mins = days.map((d) => estimateMinutes(d.slots.reduce((a, s) => a + s.sets, 0), d.slots.length));
  return { days: days.length, sets, minutes: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length / 5) * 5 : 0, muscles: main.length, tiles, checks };
}
