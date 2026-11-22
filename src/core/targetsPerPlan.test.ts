import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { MIGRATIONS } from "./migrations";
import { duplicateRoutine, newRoutine } from "./routineEdit";
import { defaultRange, freshTargets, modelTarget, priorityOf, targetsOf } from "./volumeModel";
import { isFocus } from "./volume";
import type { AppData } from "./types";

const seed = buildSeed();
const migration = MIGRATIONS.find((m) => m.id === "2026-11-21-targets-per-plan")!;

describe("weekly targets per plan", () => {
  it("the migration gives every plan a copy of the app-wide targets, once", () => {
    const d: AppData = { ...seed, routines: seed.routines.map(({ targets: _t, ...r }) => r) };
    const next = migration.run(d, "2026-11-21")!;
    for (const r of next.routines) expect(r.targets).toEqual(d.targets);
    expect(next.routines[0].targets).not.toBe(d.targets); // a copy, not shared
    expect(migration.run(next, "2026-11-21")).toBeNull();
  });

  it("a plan without its own targets falls back to the app-wide list", () => {
    const { targets: _t, ...r } = seed.routines[0];
    expect(targetsOf(r, seed.targets)).toBe(seed.targets);
    expect(targetsOf({ ...r, targets: [] }, seed.targets)).toEqual([]);
  });

  it("new plans target every muscle, none skipped", () => {
    const t = freshTargets(null);
    expect(t.some((x) => x.off)).toBe(false);
    expect(t.find((x) => x.group === "chest")).toMatchObject({ group: "chest", min: 10, max: 15 });
    expect(t.every((x) => priorityOf(x.group, x) === "normal")).toBe(true);
    expect(t.find((x) => x.group === "abs")).toMatchObject({ group: "abs", min: 6, max: 11 });
    // Every muscle has a minimum now (Nov 21 2026), even the ones presses, pulls and grip also work
    for (const g of ["frontDelts", "forearms", "neck"] as const) expect(t.find((x) => x.group === g)).toMatchObject({ group: g, min: 4, max: 6 });
    expect(t.every((x) => isFocus(x))).toBe(true);
    const r = newRoutine([], new Date("2026-11-21T10:00:00Z"), t);
    expect(r.targets).toBe(t);
  });

  it("uses the training profile's numbers when it's complete", () => {
    const p = { goal: "strength" as const, phase: "maintaining" as const, age: 30, yearsTraining: 5, sleepHours: 8 };
    const chest = freshTargets(p).find((x) => x.group === "chest")!;
    const m = modelTarget("chest", p, "normal");
    expect(chest).toMatchObject({ group: "chest", min: m.min, max: m.max });
  });

  it("duplicating a plan copies its targets", () => {
    const r = { ...seed.routines[0], targets: freshTargets(null) };
    const c = duplicateRoutine(r, "Copy", new Date());
    expect(c.targets).toEqual(r.targets);
    expect(c.targets).not.toBe(r.targets);
  });

  it("Normal is the lower half of the range, Priority the upper half", () => {
    // No profile: database Mass gain range (adductors 6–14), split in two: Normal 6–10, Priority 10–14
    expect(defaultRange("adductors", null, "normal")).toEqual({ min: 6, max: 10 });
    expect(defaultRange("adductors", null, "priority")).toEqual({ min: 10, max: 14 });
    // With a profile: the model's numbers for that priority
    const p = { goal: "growth" as const, phase: "maintaining" as const, age: 30, yearsTraining: 5, sleepHours: 8 };
    const n = defaultRange("adductors", p, "normal"), pr = defaultRange("adductors", p, "priority");
    expect(pr.min!).toBeGreaterThan(n.min!);
    expect(pr.min!).toBeGreaterThanOrEqual(n.max!);
  });
});
