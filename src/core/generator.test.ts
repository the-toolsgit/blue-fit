import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { isTopPick, mergeCatalog } from "./catalog";
import { catalog } from "./seed/exercise-db/index";
import { generatePlan, planConflicts, REST_BY_GOAL, setsForMinutes, swapOptions } from "./generator";
import { estimateMinutes, slotsMinutes } from "./timeEstimate";
import { freshTargets } from "./volumeModel";
import { JOBS, weekInsight } from "./workoutCheck";
import type { Goal, RoutineDay, VolumeTarget } from "./types";
import { planVolume } from "./volume";

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

describe("Build my plan: balanced days", () => {
  it("6 days: every day within 4 sets of the others, and almost no 2-set exercises", () => {
    for (const s of [1, 2, 3, 4]) {
      const days = generatePlan({ goal: "growth", trainDays: SIX, maxMinutes: 75, targets, exercises: cat.exercises, seed: s, restSec: 120 }).filter((d) => d.slots.length);
      const sets = days.map((d) => d.slots.reduce((a, x) => a + x.sets, 0));
      expect(Math.max(...sets) - Math.min(...sets), `seed ${s}`).toBeLessThanOrEqual(4);
      // 2-set exercises only to cover another angle of a muscle with 2+ angles (3 sets each would pass its max)
      for (const x of days.flatMap((d) => d.slots).filter((y) => y.sets < 3)) {
        const g = cat.exMap.get(x.exerciseId)!.volume.find((v) => v.weight === 1)!.group;
        expect((JOBS[g] ?? []).length, cat.exMap.get(x.exerciseId)!.name).toBeGreaterThan(1);
      }
    }
  });
});

describe("Build my plan: across settings", () => {
  const profileFor = (goal: Goal) => ({ goal, phase: "maintaining" as const, age: 30, yearsTraining: 3, sleepHours: 7.5 });
  const DAYS: Record<number, number[]> = { 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 6, 0], 7: [0, 1, 2, 3, 4, 5, 6] };
  for (const goal of ["growth", "strength", "endurance", "maintenance"] as const) it(`${goal}: no muscle left out, nothing twice, days within time and 10–11 exercises; 5+ days pass the main checks`, () => {
    for (const n of [3, 4, 5, 6, 7]) for (const minutes of [60, 75]) {
      const t = freshTargets(profileFor(goal));
      const days = generatePlan({ goal, trainDays: DAYS[n], maxMinutes: minutes, targets: t, exercises: cat.exercises, seed: 1, restSec: REST_BY_GOAL[goal] });
      const where = `${n} days, ${minutes} min`;
      const all = ids(days);
      expect(new Set(all).size, where).toBe(all.length);
      for (const d of days.filter((x) => x.slots.length)) {
        expect(d.slots.length, where).toBeLessThanOrEqual(11);
        expect(slotsMinutes(d.slots), where).toBeLessThanOrEqual(minutes + 10);
      }
      const clean = !planConflicts({ trainDays: DAYS[n], maxMinutes: minutes, targets: t, restSec: REST_BY_GOAL[goal], goal }).length;
      const vol = new Map(planVolume(routine(days), cat.exMap).map((v) => [v.group, v.sets]));
      if (clean) for (const x of t.filter((y) => y.min)) expect(vol.get(x.group) ?? 0, `${where} ${x.group}`).toBeGreaterThan(0);
      if (n >= 5 && clean) {
        const w = weekInsight(routine(days), cat.exMap, t, goal);
        for (const id of ["volume", "jobs", "stretch", "frequency", "recovery"]) {
          const c = w.checks.find((x) => x.id === id);
          expect(!c || c.pass || c.warn, `${where} ${id}: ${c?.issues.map((i) => i.who + " " + i.what).join("; ")}`).toBe(true);
        }
      }
    }
  }, 60_000);
});

describe("Build my plan: integrity", () => {
  it("ids stay unique without crypto.randomUUID (the dev server over the local network is plain http)", async () => {
    const real = globalThis.crypto.randomUUID;
    // @ts-expect-error simulate a non-secure context
    globalThis.crypto.randomUUID = undefined;
    try {
      const { uid } = await import("./util");
      const ids8 = Array.from({ length: 500 }, () => uid().slice(0, 8));
      expect(new Set(ids8).size).toBe(500);
    } finally { globalThis.crypto.randomUUID = real; }
  });

  it("no slot on two days, no exercise twice, at most 11 exercises a day, across hard settings", () => {
    for (const goal of ["growth", "strength", "endurance", "maintenance"] as const)
      for (const [days, minutes, rest] of [[[1], 45, 180], [[1, 4], 60, 60], [[5, 6, 0], 75, 90], [[1, 3, 5], 75, 60], [[1, 2, 4, 5], 60, 180], [[0, 1, 2, 3, 4, 5, 6], 90, 120]] as [number[], number, number][])
        for (const seed of [1, 2]) {
          const p = generatePlan({ goal, trainDays: days, maxMinutes: minutes, targets: freshTargets(null, goal), exercises: cat.exercises, seed, restSec: rest });
          const slots = p.flatMap((d) => d.slots), where = `${goal} ${days.join("")} ${minutes} ${rest} ${seed}`;
          expect(new Set(slots).size, where).toBe(slots.length);
          expect(new Set(slots.map((s) => s.id)).size, where).toBe(slots.length);
          expect(new Set(slots.map((s) => s.exerciseId)).size, where).toBe(slots.length);
          for (const d of p) expect(d.slots.length, where).toBeLessThanOrEqual(11);
        }
  }, 60_000);

  it("the same answers and seed give the same plan (the check screen's preview is the plan you get)", () => {
    const inp = { goal: "growth" as const, trainDays: [1, 2, 4, 5], maxMinutes: 60, targets, exercises: cat.exercises, seed: 3, restSec: 90 };
    const sig = (d: RoutineDay[]) => JSON.stringify(d.map((x) => [x.title, x.slots.map((s) => [s.exerciseId, s.sets, s.repMin, s.repMax, s.restSec])]));
    expect(sig(generatePlan(inp))).toBe(sig(generatePlan(inp)));
  });
});
