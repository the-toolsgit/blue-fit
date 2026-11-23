// Build my plan, fuzzed (Nov 23 2026, after Leo found a built plan above a target that a few hand-picked settings
// never showed): random goals, days, lengths, rests, current plans to avoid, skipped muscles and seeds. Every plan
// built without a setup conflict must keep every muscle at or under its ceiling, and the same inputs must always give
// the same plan (so a plan's saved recipe rebuilds it exactly). FUZZ=n runs n plans (default 120, for the deploy);
// FUZZ_SEED=n picks another random set.
import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { mergeCatalog } from "./catalog";
import { catalog } from "./seed/exercise-db/index";
import { generatePlan, MAX_EXERCISES, planConflicts, REST_BY_GOAL } from "./generator";
import { freshTargets } from "./volumeModel";
import { planVolume } from "./volume";
import { weekInsight } from "./workoutCheck";
import { slotsMinutes } from "./timeEstimate";
import { MUSCLE_GROUPS, type Goal, type RoutineDay, type VolumeTarget } from "./types";

const seed = buildSeed();
const cat = mergeCatalog(seed.exercises, catalog());
// Vitest runs in Node; read its env without Node's types
const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const N = Number(env.FUZZ ?? 120);
const GOALS: Goal[] = ["growth", "strength", "endurance", "maintenance"];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const routine = (days: RoutineDay[]) => ({ id: "f", name: "f", isCurrent: false, createdAt: "", days });
const compact = (days: RoutineDay[]) => days.map((d) => d.slots.map((s) => `${s.exerciseId}×${s.sets}`).join(","));

function rng(s: number) { return () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 2 ** 32); }

describe("Build my plan, fuzzed", () => {
  it(`${N} random setups: no muscle above its ceiling, every angle trained, days within time, same inputs same plan`, () => {
    const r = rng(Number(env.FUZZ_SEED ?? 20261123));
    const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
    const pool = cat.exercises.filter((e) => !e.isCustom).map((e) => e.id);
    const bad: string[] = [];
    let built = 0;
    for (let i = 0; i < N * 3 && built < N; i++) {
      const goal = pick(GOALS);
      const nDays = 3 + Math.floor(r() * 4);
      const trainDays = [...WEEK].sort(() => r() - 0.5).slice(0, nDays);
      const maxMinutes = pick([45, 60, 75, 90]);
      const restSec = r() < 0.7 ? REST_BY_GOAL[goal] : pick([60, 90, 120, 180]);
      // Some muscles skipped, as people do (never the big ones all at once)
      const targets: VolumeTarget[] = freshTargets(null, goal).map((t) => (r() < 0.15 && !["back", "quads"].includes(t.group) ? { ...t, off: true } : t));
      const avoid = new Set(pool.filter(() => r() < 0.1));
      const sd = 1 + Math.floor(r() * 20);
      if (planConflicts({ trainDays, maxMinutes, targets, restSec, goal }).length) continue;
      built++;
      const input = { goal, trainDays, maxMinutes, targets, exercises: cat.exercises, seed: sd, avoid, restSec };
      const days = generatePlan(input);
      const where = `${goal} ${nDays}d [${trainDays}] ${maxMinutes}min rest ${restSec} seed ${sd}`;
      // Days within the length (+5 buffer, +5 for rounding as the settings test allows) and 11 exercises at most
      for (const d of days.filter((x) => x.slots.length)) {
        if (slotsMinutes(d.slots) > maxMinutes + 10) bad.push(`${where}: ${d.title} ${slotsMinutes(d.slots)} min`);
        if (d.slots.length > MAX_EXERCISES + 1) bad.push(`${where}: ${d.title} ${d.slots.length} exercises`);
      }
      for (const v of planVolume(routine(days), cat.exMap)) {
        const t = targets.find((x) => x.group === v.group);
        if (t && !t.off && t.max != null && v.sets > t.max + 1e-9) bad.push(`${where}: ${v.group} ${v.sets} > ${t.max}` + (" || " + days.flatMap((d) => d.slots.filter((s) => cat.exMap.get(s.exerciseId)!.volume.some((q) => q.group === v.group)).map((s) => `${d.title}:${s.exerciseId}×${s.sets}[${cat.exMap.get(s.exerciseId)!.volume.map((q) => q.group + q.weight).join(" ")}]`)).join(", ") + " || targets " + targets.filter((x) => !x.off).map((x) => `${x.group} ${x.min}-${x.max}`).join(", ") + " || vol " + planVolume(routine(days), cat.exMap).map((q) => q.group + " " + q.sets).join(", ")));
      }
      // Every angle (not for maintain). The one excuse: every day that trains the muscle is already full, at the
      // exercise cap or the length (e.g. 45-minute days, or 3 full-body days with neck's 3 angles): nothing more fits
      // there, and the Plan check says so
      if (goal !== "maintenance") {
        const full = (d: RoutineDay) => d.slots.length >= MAX_EXERCISES || slotsMinutes(d.slots) >= maxMinutes;
        const c = weekInsight(routine(days), cat.exMap, targets, goal, undefined, { fast: true }).checks.find((x) => x.id === "jobs");
        for (const x of c && !c.pass && !c.warn ? c.issues : []) {
          const g = MUSCLE_GROUPS.find((m) => m.label === x.who)?.id;
          const its = days.filter((d) => d.slots.some((s) => cat.exMap.get(s.exerciseId)!.volume.some((v) => v.group === g)));
          // (a muscle on no day at all: every training day full)
          if ((its.length ? its : days.filter((d) => d.slots.length)).every(full)) continue;
          const t = targets.find((y) => y.group === g);
          bad.push(`${where}: ${x.who} ${x.what} || target ${t?.min}-${t?.max}: ` + its.map((d) => `${d.title} ${slotsMinutes(d.slots)}min/${d.slots.length}`).join(", ") + " | " + days.flatMap((d) => d.slots.filter((s) => cat.exMap.get(s.exerciseId)!.volume.some((v) => v.group === g)).map((s) => `${d.title}:${s.exerciseId}×${s.sets}(${JSON.stringify(cat.exMap.get(s.exerciseId)!.jobs?.[g!] ?? "")})`)).join(", "));
        }
      }
      if (i % 10 === 0) expect(compact(generatePlan(input)), `${where}: rebuild differs`).toEqual(compact(days));
    }
    expect(built).toBeGreaterThan(N / 2);
    expect(bad, bad.slice(0, 10).join("\n")).toEqual([]);
  }, 600_000);
});
