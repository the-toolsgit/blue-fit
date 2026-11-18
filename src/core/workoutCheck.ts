// What one plan day does for the week, per muscle (tiles), and whether it "checks all the boxes" for the user's
// goal (Plan → Workout check). Pure and framework-free.
// Sources: weekly targets and angle lists come from the user's plan (targets.json); recovery days from the volume
// model (volumeModel.ts). Stretch: training a muscle at long length grows it more (Maeo 2021/2023, Pedrosa 2022).
// Heavy + light: both build muscle when taken close to failure (Schoenfeld 2017); mixing them is *judgment*, as are
// the ≤10 / ≥12 rep split and the 75-min limit.
import { muscleLabel, type Exercise, type Goal, type MuscleGroup, type Routine, type RoutineDay, type Slot, type VolumeTarget } from "./types";
import { formatTarget, isFocus, planVolume } from "./volume";
import { MUSCLES } from "./volumeModel";
import { estimateMinutes } from "./timeEstimate";
import { fmtNum } from "./util";

export type AngleState = "today" | "week" | "none";
export interface Tile {
  group: MuscleGroup;
  /** Sets this workout adds (indirect = ½) */
  sets: number;
  /** Planned sets for the whole week */
  week: number;
  target?: VolumeTarget;
  status: "ok" | "below" | "above" | "off";
  angles: { name: string; state: AngleState }[];
}
export type CheckId = "volume" | "angles" | "stretch" | "mix" | "recovery" | "length" | "heavy" | "rest" | "reps";
export interface Check { id: CheckId; label: string; pass: boolean; detail: string }
export interface DayInsight { sets: number; minutes: number; muscles: number; tiles: Tile[]; checks: Check[] }

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

export function dayInsight(routine: Routine, day: RoutineDay, exMap: Map<string, Exercise>, targets: VolumeTarget[], goal: Goal = "growth"): DayInsight {
  const slots = day.slots.filter((s) => exMap.has(s.exerciseId));
  const sets = slots.reduce((a, s) => a + s.sets, 0);
  const minutes = estimateMinutes(sets, slots.length);
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const week = new Map(planVolume(routine, exMap).map((v) => [v.group, v.sets]));
  const anglesIn = (d: RoutineDay, g: MuscleGroup) => new Set(d.slots.map((s) => exMap.get(s.exerciseId)?.angles?.[g]).filter((x): x is string => !!x));

  const tiles: Tile[] = planVolume({ ...routine, days: [day] }, exMap).filter((v) => v.sets > 0).sort((a, b) => b.sets - a.sets).map((v) => {
    const t = tmap.get(v.group), total = week.get(v.group) ?? v.sets;
    const today = anglesIn(day, v.group);
    const all = new Set(routine.days.flatMap((d) => [...anglesIn(d, v.group)]));
    return {
      group: v.group, sets: v.sets, week: total, target: t,
      status: !isFocus(t) ? "off" : total < t.min ? "below" : t.max != null && total > t.max ? "above" : "ok",
      angles: angleList(t).map((name) => ({ name, state: today.has(name) ? "today" : all.has(name) ? "week" : "none" })),
    };
  });

  // Muscles this workout trains directly and that are a focus (skipped muscles never fail a check)
  const main = [...new Set(slots.flatMap((s) => exMap.get(s.exerciseId)!.volume.filter((v) => v.weight === 1).map((v) => v.group)))]
    .filter((g) => isFocus(tmap.get(g)));
  const label = (g: MuscleGroup) => muscleLabel(g);
  const list = (xs: string[]) => xs.slice(0, 2).join(" · ") + (xs.length > 2 ? ` · +${xs.length - 2} more` : "");
  const check = (id: CheckId, l: string, bad: string[], ok: string): Check => ({ id, label: l, pass: bad.length === 0, detail: bad.length ? list(bad) : ok });

  const volume = (minOnly: boolean) => check("volume", "Weekly volume", main.flatMap((g) => {
    const t = tmap.get(g)!, w = week.get(g) ?? 0;
    if (w < t.min!) return [`${label(g)} below (${fmtNum(w)} of ${formatTarget(t)})`];
    if (!minOnly && t.max != null && w > t.max) return [`${label(g)} above (${fmtNum(w)} of ${formatTarget(t)})`];
    return [];
  }), "Every muscle in its weekly range");

  const angles = check("angles", "All angles", main.flatMap((g) => {
    const names = angleList(tmap.get(g));
    if (names.length < 2) return [];
    const hit = new Set(routine.days.flatMap((d) => [...anglesIn(d, g)]));
    const miss = names.filter((n) => !hit.has(n));
    return miss.length ? [`${label(g)}: no ${miss.join(", ")}`] : [];
  }), "Every angle hit this week");

  const stretch = check("stretch", "Stretch", main.flatMap((g) => {
    const names = angleList(tmap.get(g)).filter((n) => STRETCH.test(n));
    if (!names.length) return [];
    return [...anglesIn(day, g)].some((n) => STRETCH.test(n)) ? [] : [`${label(g)}: no stretch today`];
  }), "Each muscle loaded at a long length");

  const mix = check("mix", "Heavy and light", main.flatMap((g) => {
    const own = slots.filter((s) => direct(exMap.get(s.exerciseId), g));
    if (own.length < 2) return [];
    const heavy = own.some((s) => mid(s) <= HEAVY_REPS), light = own.some((s) => mid(s) >= LIGHT_REPS);
    return heavy && light ? [] : [`${label(g)}: all ${heavy ? `≤${HEAVY_REPS}` : `${LIGHT_REPS}+`} reps`];
  }), `Heavy (≤${HEAVY_REPS}) and light (${LIGHT_REPS}+) sets per muscle`);

  const recovery = check("recovery", "Recovery", day.weekday == null ? [] : main.flatMap((g) => {
    const need = Math.floor(MUSCLES[g]?.recoveryDays ?? 2);
    const gaps = routine.days.filter((d) => d.id !== day.id && d.weekday != null && d.slots.some((s) => direct(exMap.get(s.exerciseId), g)))
      .map((d) => { const k = (d.weekday! - day.weekday! + 7) % 7; return Math.min(k, 7 - k); });
    const gap = gaps.length ? Math.min(...gaps) : Infinity;
    return gap < need ? [`${label(g)} again ${gap === 0 ? "the same day" : `after ${gap} day${gap === 1 ? "" : "s"}`} (needs ${need})`] : [];
  }), "Every muscle rested before its next workout");

  const length = check("length", "Length", minutes > MAX_MINUTES ? [`~${minutes} min (aim for ${MAX_MINUTES} or less)`] : [], `~${minutes} min`);

  const stars = slots.filter((s) => exMap.get(s.exerciseId)?.isHeavy);
  const checks: Check[] =
    goal === "maintenance" ? [volume(true), recovery]
    : goal === "strength" ? [volume(false), angles,
        check("heavy", "Heavy lift", stars.some((s) => s.repMin <= 6) ? [] : ["No ★ lift at 6 reps or less"], "A ★ lift at 6 reps or less"),
        check("rest", "Long rests", stars.filter((s) => s.restSec < 180).map((s) => `${exMap.get(s.exerciseId)!.name}: rest under 3 min`), "3+ min rest on ★ lifts"),
        recovery, length]
    : goal === "endurance" ? [volume(false), angles,
        check("reps", "High reps", slots.filter((s) => mid(s) >= 15).length * 2 >= slots.length ? [] : ["Most sets under 15 reps"], "Most sets 15+ reps"),
        check("rest", "Short rests", slots.filter((s) => s.restSec > 90).map((s) => `${exMap.get(s.exerciseId)!.name}: rest over 90 s`), "Rests 90 s or less"),
        recovery, length]
    : [volume(false), angles, stretch, mix, recovery, length];

  return { sets, minutes, muscles: main.length, tiles, checks };
}
