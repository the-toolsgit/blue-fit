import { describe, expect, it } from "vitest";
import { modelTarget, modelTargets, priorityOf, type TrainingProfile } from "./volumeModel";
import { completeProfile } from "./types";

// Made-up sample profile (not anyone's real data)
const base: TrainingProfile = { goal: "growth", phase: "maintaining", age: 30, yearsTraining: 2, sleepHours: 8 };

describe("volume model (draft 2)", () => {
  it("covers every muscle group with min < max", () => {
    const all = modelTargets(base);
    expect(all).toHaveLength(16); // incl. abs and neck (Nov 17 2026)
    for (const t of all) expect(t.max).toBeGreaterThanOrEqual(t.min + 2);
  });
  it("biceps need fewer sets than back", () => {
    const b = modelTarget("biceps", base), k = modelTarget("back", base);
    expect(b.min).toBeLessThan(k.min);
    expect(b.max).toBeLessThan(k.max);
  });
  it("priority raises the floor, not the ceiling", () => {
    const n = modelTarget("biceps", base), p = modelTarget("biceps", base, "priority");
    expect(p.min).toBeGreaterThan(n.min);
    expect(p.max).toBe(n.max);
  });
  it("a skipped muscle gets no sets", () => {
    const off = modelTarget("chest", base, "off");
    expect([off.min, off.max]).toEqual([0, 0]);
  });
  it("strength and maintenance ceilings are below growth", () => {
    const g = modelTarget("back", base).max;
    expect(modelTarget("back", { ...base, goal: "strength" }).max).toBeLessThan(g);
    expect(modelTarget("back", { ...base, goal: "maintenance" }).max).toBeLessThan(modelTarget("back", base).min);
  });
  it("cutting, short sleep and age lower the ceiling; bulking raises it", () => {
    const ref = modelTarget("quads", base).max;
    for (const p of [{ phase: "cutting" as const }, { sleepHours: 5 }, { age: 45 }]) expect(modelTarget("quads", { ...base, ...p }).max).toBeLessThan(ref);
    expect(modelTarget("quads", { ...base, phase: "bulking" }).max).toBeGreaterThan(ref);
  });
  it("priority: skip wins, then the muscle's own flag, then the app default", () => {
    expect(priorityOf("biceps")).toBe("priority");
    expect(priorityOf("chest")).toBe("normal");
    expect(priorityOf("biceps", { group: "biceps", min: 1, max: 3, priority: false })).toBe("normal");
    expect(priorityOf("chest", { group: "chest", min: 1, max: 3, priority: true })).toBe("priority");
    expect(priorityOf("biceps", { group: "biceps", min: 1, max: 3, off: true })).toBe("off");
  });
  it("profile is used only once age, years and sleep are filled in", () => {
    expect(completeProfile({ goal: "growth", phase: "bulking", age: 30, yearsTraining: null, sleepHours: 7 })).toBeNull();
    expect(completeProfile({ goal: "growth", phase: "bulking", age: 30, yearsTraining: 2, sleepHours: 7 })).toMatchObject({ yearsTraining: 2 });
  });
});
