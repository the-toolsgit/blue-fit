import { describe, expect, it } from "vitest";
import { modelTarget, modelTargets, type TrainingProfile } from "./volumeModel";

// Made-up sample profile (not anyone's real data)
const base: TrainingProfile = { goal: "growth", phase: "maintaining", age: 30, yearsTraining: 2, sleepHours: 8 };

describe("volume model", () => {
  it("covers every muscle group with min < max", () => {
    const all = modelTargets(base);
    expect(all).toHaveLength(15);
    for (const t of all) expect(t.max).toBeGreaterThanOrEqual(t.min + 2);
  });
  it("biceps need fewer sets than back", () => {
    const b = modelTarget("biceps", base), k = modelTarget("back", base);
    expect(b.min).toBeLessThan(k.min);
    expect(b.max).toBeLessThan(k.max);
  });
  it("maintenance and strength need less than growth", () => {
    expect(modelTarget("back", { ...base, goal: "maintenance" }).max).toBeLessThan(modelTarget("back", base).min);
    expect(modelTarget("back", { ...base, goal: "strength" }).max).toBeLessThan(modelTarget("back", base).max);
  });
  it("cutting, short sleep and age lower the ceiling, not the floor", () => {
    const ref = modelTarget("quads", base);
    for (const p of [{ phase: "cutting" as const }, { sleepHours: 5 }, { age: 45 }]) {
      const t = modelTarget("quads", { ...base, ...p });
      expect(t.max).toBeLessThan(ref.max);
      expect(t.min).toBe(ref.min);
    }
  });
  it("caps the max at ~11 sets per training day", () => {
    const t = modelTarget("back", base, 1);
    expect(t.max).toBe(Math.max(11, t.min + 2)); // never closer than 2 sets to the min
    expect(modelTarget("back", base, 1).why.some((w) => w.includes("per session"))).toBe(true);
  });
});
