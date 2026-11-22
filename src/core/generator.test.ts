import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { isTopPick, mergeCatalog } from "./catalog";
import { catalog } from "./seed/exercise-db/index";
import { generatePlan, planConflicts, REST_BY_GOAL, setsForMinutes, swapOptions } from "./generator";
import { estimateMinutes, slotsMinutes } from "./timeEstimate";
import { freshTargets } from "./volumeModel";
import { weekInsight } from "./workoutCheck";
import type { RoutineDay, VolumeTarget } from "./types";

const seed = buildSeed();
const cat = mergeCatalog(seed.exercises, catalog());
const targets = freshTargets(null);
const SIX = [1, 2, 3, 4, 6, 0];
const routine = (days: RoutineDay[]) => ({ id: "g", name: "g", isCurrent: false, createdAt: "", days });
const ids = (days: RoutineDay[]) => days.flatMap((d) => d.slots.map((s) => s.exerciseId));

describe("plan generator", () => {
  it("6 days: push/pull/legs twice, every day on its weekday, rest days empty", () => {
    const days = generatePlan({ goal: "growth", trainDays: SIX, maxMinutes: 75, targets, exercises: cat.exercises, seed: 1 });
    expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(days.find((d) => d.weekday === 5)!.slots).toEqual([]);
    expect(days.filter((d) => d.slots.length).map((d) => d.title)).toEqual(["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"]);
  });

  it("6 days passes the plan check's main rules and stays within time", () => {
    const days = generatePlan({ goal: "growth", trainDays: SIX, maxMinutes: 75, targets, exercises: cat.exercises, seed: 1 });
    const w = weekInsight(routine(days), cat.exMap, targets, "growth");
    for (const id of ["volume", "stretch", "frequency", "dose", "recovery", "rest"]) expect(w.checks.find((c) => c.id === id)!.pass, id).toBe(true);
    for (const d of days) expect(d.slots.reduce((a, s) => a + s.sets, 0)).toBeLessThanOrEqual(setsForMinutes(80));
  });

  it("no exercise twice in a week, mostly top picks, 2–4 sets each", () => {
    const days = generatePlan({ goal: "growth", trainDays: SIX, maxMinutes: 75, targets, exercises: cat.exercises, seed: 1 });
    const all = ids(days);
    expect(new Set(all).size).toBe(all.length);
    expect(all.filter((id) => isTopPick(cat.exMap.get(id)!, "growth")).length / all.length).toBeGreaterThan(0.8);
    for (const s of days.flatMap((d) => d.slots)) { expect(s.sets).toBeGreaterThanOrEqual(2); expect(s.sets).toBeLessThanOrEqual(4); }
  });

  it("changes up the exercises of the plan you come from, and Try again gives a different plan", () => {
    const first = generatePlan({ goal: "growth", trainDays: SIX, maxMinutes: 75, targets, exercises: cat.exercises, seed: 1 });
    const avoid = new Set(ids(first));
    const second = generatePlan({ goal: "growth", trainDays: SIX, maxMinutes: 75, targets, exercises: cat.exercises, seed: 1, avoid });
    const overlap = ids(second).filter((id) => avoid.has(id)).length / ids(second).length;
    expect(overlap).toBeLessThan(0.35);
    const other = generatePlan({ goal: "growth", trainDays: SIX, maxMinutes: 75, targets, exercises: cat.exercises, seed: 2 });
    expect(ids(other)).not.toEqual(ids(first));
  });

  it("strength: key lifts get 3–6 reps and 3 min rest", () => {
    const days = generatePlan({ goal: "strength", trainDays: SIX, maxMinutes: 90, targets, exercises: cat.exercises, seed: 1 });
    const heavy = days.flatMap((d) => d.slots).filter((s) => cat.exMap.get(s.exerciseId)!.isHeavy);
    expect(heavy.length).toBeGreaterThan(0);
    for (const s of heavy) expect([s.repMin, s.repMax, s.restSec]).toEqual([3, 6, 180]);
  });

  it("conflicts: too many sets for the days, no rest between back-to-back days, too long", () => {
    const biceps: VolumeTarget[] = targets.map((t) => (t.group === "biceps" ? { ...t, min: 25, max: 28 } : t));
    const c = planConflicts({ trainDays: [1, 2], maxMinutes: 60, targets: biceps });
    // Mon + Tue: biceps needs a rest day after a hard workout, so only one of them counts: 11 sets max
    expect(c.find((x) => x.id === "max-biceps")?.fix?.targets?.[0]).toMatchObject({ group: "biceps", min: 7, max: 11 });
    expect(c.find((x) => x.id === "max-biceps")?.text).toMatch(/only 1 fit/);
    // Priority back on 6 days: aims past what fits, but the minimum (17) fits in 2 workouts, so nothing to fix
    const back: VolumeTarget[] = targets.map((t) => (t.group === "back" ? { ...t, min: 17, max: 28, priority: true } : t));
    expect(planConflicts({ trainDays: SIX, maxMinutes: 90, targets: back }).some((x) => x.id === "max-back")).toBe(false);
    const plan = generatePlan({ goal: "growth", trainDays: SIX, maxMinutes: 90, targets: back, exercises: cat.exercises, seed: 1 });
    const backDays = plan.filter((d) => d.slots.some((s) => cat.exMap.get(s.exerciseId)!.volume.some((v) => v.group === "back" && v.weight === 1)));
    expect(backDays.length).toBe(2);
    expect(c.some((x) => x.id === "time")).toBe(true);
    // When a longer workout would fit, the fix offers it
    expect(planConflicts({ trainDays: [1, 2, 4, 5], maxMinutes: 45, targets }).find((x) => x.id === "time")?.fix?.maxMinutes).toBeGreaterThan(45);
    // 3 rest days: it also suggests training more days
    const t4 = planConflicts({ trainDays: [1, 2, 4, 5], maxMinutes: 45, targets }).find((x) => x.id === "time")!;
    expect(t4.moreDays?.days).toBeGreaterThan(4);
    expect(t4.moreDays?.minutes).toBeLessThan(90);
    expect(planConflicts({ trainDays: SIX, maxMinutes: 75, targets })).toEqual([]);
    expect(planConflicts({ trainDays: [], maxMinutes: 75, targets })[0].id).toBe("days");
  });
});

describe("Build my plan: rest, time and swaps", () => {
  it("the time estimate uses the rest: 3 min rests make longer workouts than 1 min", () => {
    expect(estimateMinutes(15, 5, 180)).toBeGreaterThan(estimateMinutes(15, 5, 60));
    expect(estimateMinutes(15, 5)).toBe(estimateMinutes(15, 5, 120));
    expect(slotsMinutes([{ sets: 3, restSec: 120 }, { sets: 3, restSec: 120 }])).toBe(estimateMinutes(6, 2));
    expect(slotsMinutes([])).toBe(0);
  });

  it("every exercise gets the picked rest (holds 60 s), and short rests fit more sets", () => {
    const days = generatePlan({ goal: "growth", trainDays: SIX, maxMinutes: 60, targets, exercises: cat.exercises, seed: 1, restSec: 90 });
    for (const s of days.flatMap((d) => d.slots)) expect(s.restSec).toBe(cat.exMap.get(s.exerciseId)!.measure === "time" ? 60 : 90);
    expect(setsForMinutes(60, 60)).toBeGreaterThan(setsForMinutes(60, 180));
    expect(REST_BY_GOAL.strength).toBe(180);
  });

  it("swap options work the same main muscle and angle, and skip the day's other exercises", () => {
    const ex = cat.exercises.find((e) => e.name === "Incline Dumbbell Press")!;
    const main = ex.volume.find((v) => v.weight === 1)!.group;
    const jobs = [ex.jobs?.[main]].flat();
    const opts = swapOptions(ex, cat.exercises, "growth", new Set());
    expect(opts.length).toBeGreaterThan(3);
    for (const o of opts) {
      expect(o.volume.find((v) => v.weight === 1)!.group).toBe(main);
      expect([o.jobs?.[main]].flat().some((j) => jobs.includes(j))).toBe(true);
    }
    expect(opts[0].compound).toBe(true); // presses before flies
    expect(swapOptions(ex, cat.exercises, "growth", new Set([opts[0].id]))).not.toContainEqual(opts[0]);
  });
});
