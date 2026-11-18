// The whole week of a plan at a glance: per muscle (tiles), and whether the routine "checks all the boxes" for the
// user's goal (Plan → Week check). Pure and framework-free.
// Sources: weekly targets and angle lists come from the user's plan (targets.json); recovery days from the volume
// model (volumeModel.ts). Stretch: training a muscle at long length grows it more (Maeo 2021/2023, Pedrosa 2022).
// Heavy + light: both build muscle when taken close to failure (Schoenfeld 2017); mixing them is *judgment*, as are
// the ≤10 / ≥12 rep split and the 75-min limit.
import { muscleLabel, type Exercise, type Goal, type MuscleGroup, type Routine, type RoutineDay, type Slot, type VolumeTarget } from "./types";
import { formatTarget, isFocus, planVolume } from "./volume";
import { MUSCLES } from "./volumeModel";
import { estimateMinutes } from "./timeEstimate";
import { fmtNum } from "./util";

export type AngleState = "hit" | "none";
export interface Tile {
  group: MuscleGroup;
  /** Planned sets for the week (indirect = ½) */
  week: number;
  /** Days that train it directly */
  days: number;
  target?: VolumeTarget;
  status: "ok" | "below" | "above" | "off";
  angles: { name: string; state: AngleState }[];
}
export type CheckId = "volume" | "angles" | "stretch" | "mix" | "recovery" | "length" | "heavy" | "rest" | "reps";
export interface Check { id: CheckId; label: string; pass: boolean; detail: string }
export interface WeekInsight { days: number; sets: number; minutes: number; longest: number; muscles: number; tiles: Tile[]; checks: Check[] }

/** Longest workout that still passes "Length" (*judgment*). */
export const MAX_MINUTES = 75;
/** A slot counts as heavy when its rep range's middle is at most this, light when at least LIGHT_REPS (*judgment*). */
export const HEAVY_REPS = 10;
export const LIGHT_REPS = 12;
/** Angle names that put the muscle under load at long length. Triceps overhead = long head stretched (Maeo 2023). */
const STRETCH = /stretch|lengthened|overhead/;

/** A target's angle names: "stretched, lengthened, hammer" → ["stretched", "lengthened", "hammer"]; "press only" → ["press"]. */
export const angleList = (t: VolumeTarget | undefined): string[] =>
  (t?.angles ?? "").split(",").map((x) => x.trim().replace(/ only$/, "")).filter(Boolean);

const direct = (ex: Exercise | undefined, g: MuscleGroup) => !!ex?.volume.some((v) => v.group === g && v.weight === 1);
const mid = (s: Slot) => (s.repMin + s.repMax) / 2;

export function weekInsight(routine: Routine, exMap: Map<string, Exercise>, targets: VolumeTarget[], goal: Goal = "growth"): WeekInsight {
  const days = routine.days.map((d) => ({ ...d, slots: d.slots.filter((s) => exMap.has(s.exerciseId)) })).filter((d) => d.slots.length);
  const slots = days.flatMap((d) => d.slots);
  const dayMin = (d: RoutineDay) => estimateMinutes(d.slots.reduce((a, s) => a + s.sets, 0), d.slots.length);
  const mins = days.map(dayMin);
  const sets = slots.reduce((a, s) => a + s.sets, 0);
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const week = new Map(planVolume(routine, exMap).map((v) => [v.group, v.sets]));
  const anglesOf = (g: MuscleGroup) => new Set(slots.map((s) => exMap.get(s.exerciseId)?.angles?.[g]).filter((x): x is string => !!x));
  const daysFor = (g: MuscleGroup) => days.filter((d) => d.slots.some((s) => direct(exMap.get(s.exerciseId), g)));

  const tiles: Tile[] = [...week].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([g, n]) => {
    const t = tmap.get(g), hit = anglesOf(g);
    return {
      group: g, week: n, days: daysFor(g).length, target: t,
      status: !isFocus(t) ? "off" : n < t.min ? "below" : t.max != null && n > t.max ? "above" : "ok",
      angles: angleList(t).map((name) => ({ name, state: hit.has(name) ? "hit" : "none" })),
    };
  });

  // Focus muscles the week trains directly (skipped muscles never fail a check)
  const main = [...new Set(slots.flatMap((s) => exMap.get(s.exerciseId)!.volume.filter((v) => v.weight === 1).map((v) => v.group)))]
    .filter((g) => isFocus(tmap.get(g)));
  const label = (g: MuscleGroup) => muscleLabel(g);
  const list = (xs: string[]) => xs.slice(0, 3).join(" · ") + (xs.length > 3 ? ` · +${xs.length - 3} more` : "");
  const check = (id: CheckId, l: string, bad: string[], ok: string): Check => ({ id, label: l, pass: bad.length === 0, detail: bad.length ? list(bad) : ok });

  const volume = (minOnly: boolean) => check("volume", "Weekly volume", main.flatMap((g) => {
    const t = tmap.get(g)!, w = week.get(g) ?? 0;
    if (w < t.min!) return [`${label(g)} below (${fmtNum(w)} of ${formatTarget(t)})`];
    if (!minOnly && t.max != null && w > t.max) return [`${label(g)} above (${fmtNum(w)} of ${formatTarget(t)})`];
    return [];
  }), "Every muscle in its weekly range");

  const angles = check("angles", "All angles", main.flatMap((g) => {
    const names = angleList(tmap.get(g)), hit = anglesOf(g);
    const miss = names.length < 2 ? [] : names.filter((n) => !hit.has(n));
    return miss.length ? [`${label(g)}: no ${miss.join(", ")}`] : [];
  }), "Every angle of every muscle");

  const stretch = check("stretch", "Stretch", main.flatMap((g) => {
    if (!angleList(tmap.get(g)).some((n) => STRETCH.test(n))) return [];
    return [...anglesOf(g)].some((n) => STRETCH.test(n)) ? [] : [`${label(g)}: no stretch exercise`];
  }), "Every muscle loaded at a long length");

  const mix = check("mix", "Heavy and light", main.flatMap((g) => {
    const own = slots.filter((s) => direct(exMap.get(s.exerciseId), g));
    if (own.length < 2) return [];
    const heavy = own.some((s) => mid(s) <= HEAVY_REPS), light = own.some((s) => mid(s) >= LIGHT_REPS);
    return heavy && light ? [] : [`${label(g)}: all ${heavy ? `≤${HEAVY_REPS}` : `${LIGHT_REPS}+`} reps`];
  }), `Heavy (≤${HEAVY_REPS}) and light (${LIGHT_REPS}+) sets per muscle`);

  const recovery = check("recovery", "Recovery", main.flatMap((g) => {
    const need = Math.floor(MUSCLES[g]?.recoveryDays ?? 2);
    const wd = [...new Set(daysFor(g).map((d) => d.weekday).filter((w): w is number => w != null))].sort((a, b) => a - b);
    if (wd.length < 2) return [];
    const gap = Math.min(...wd.map((w, i) => ((wd[(i + 1) % wd.length] - w + 7) % 7) || 7));
    return gap < need ? [`${label(g)} ${gap} day${gap === 1 ? "" : "s"} apart (needs ${need})`] : [];
  }), "Every muscle rested between workouts");

  const longest = mins.length ? Math.max(...mins) : 0;
  const length = check("length", "Length", days.filter((d) => dayMin(d) > MAX_MINUTES).map((d) => `${d.title} ~${dayMin(d)} min`),
    `Every workout ~${MAX_MINUTES} min or less`);

  const stars = slots.filter((s) => exMap.get(s.exerciseId)?.isHeavy);
  const checks: Check[] =
    goal === "maintenance" ? [volume(true), recovery]
    : goal === "strength" ? [volume(false), angles,
        check("heavy", "Heavy lifts", stars.some((s) => s.repMin <= 6) ? [] : ["No ★ lift at 6 reps or less"], "★ lifts at 6 reps or less"),
        check("rest", "Long rests", stars.filter((s) => s.restSec < 180).map((s) => `${exMap.get(s.exerciseId)!.name}: rest under 3 min`), "3+ min rest on ★ lifts"),
        recovery, length]
    : goal === "endurance" ? [volume(false), angles,
        check("reps", "High reps", slots.filter((s) => mid(s) >= 15).length * 2 >= slots.length ? [] : ["Most exercises under 15 reps"], "Most exercises 15+ reps"),
        check("rest", "Short rests", [...new Set(slots.filter((s) => s.restSec > 90).map((s) => `${exMap.get(s.exerciseId)!.name}: rest over 90 s`))], "Rests 90 s or less"),
        recovery, length]
    : [volume(false), angles, stretch, mix, recovery, length];

  return { days: days.length, sets, minutes: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length / 5) * 5 : 0, longest, muscles: main.length, tiles, checks };
}
