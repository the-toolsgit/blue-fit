import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { MIGRATIONS } from "./migrations";
import { duplicateRoutine, newRoutine } from "./routineEdit";
import { freshTargets, modelTarget, priorityOf, targetsOf } from "./volumeModel";
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

  it("new plans target every muscle the database gives a minimum, none skipped", () => {
    const t = freshTargets(null);
    expect(t.some((x) => x.off)).toBe(false);
    expect(t.find((x) => x.group === "chest")).toEqual({ group: "chest", min: 10, max: 20 });
    expect(t.find((x) => x.group === "abs")).toEqual({ group: "abs", min: 6, max: 16 });
    // Optional in the database (minimum 0): tracked, not checked
    expect(isFocus(t.find((x) => x.group === "frontDelts"))).toBe(false);
    const r = newRoutine([], new Date("2026-11-21T10:00:00Z"), t);
    expect(r.targets).toBe(t);
  });

  it("uses the training profile's numbers when it's complete", () => {
    const p = { goal: "strength" as const, phase: "maintaining" as const, age: 30, yearsTraining: 5, sleepHours: 8 };
    const chest = freshTargets(p).find((x) => x.group === "chest")!;
    const m = modelTarget("chest", p, priorityOf("chest"));
    expect(chest).toEqual({ group: "chest", min: m.min, max: m.max });
  });

  it("duplicating a plan copies its targets", () => {
    const r = { ...seed.routines[0], targets: freshTargets(null) };
    const c = duplicateRoutine(r, "Copy", new Date());
    expect(c.targets).toEqual(r.targets);
    expect(c.targets).not.toBe(r.targets);
  });
});
