import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { MIGRATIONS } from "./migrations";
import { catalog } from "./seed/exercise-db";
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

describe("figure audit migration (Nov 21 2026)", () => {
  const mig = MIGRATIONS.find((m) => m.id === "2026-11-21-figure-audit")!;
  it("gives app exercises the redrawn figure, but keeps a figure the user picked", () => {
    let d: AppData = buildSeed();
    for (const m of MIGRATIONS) { if (m === mig) break; d = m.run(d, "2026-11-21") ?? d; }
    const lp = d.exercises.find((e) => e.id === "leg-press")!;
    const picked = { ...d.exercises.find((e) => e.id === "seated-calf-raise")!, figure: structuredClone(lp.figure) };
    const custom = { ...lp, id: "my-press", isCustom: true };
    const next = mig.run({ ...d, exercises: d.exercises.map((e) => (e.id === picked.id ? picked : e)).concat(custom) }, "2026-11-21")!;
    expect(next.exercises.find((e) => e.id === "leg-press")!.figure).not.toEqual(lp.figure);
    expect(next.exercises.find((e) => e.id === picked.id)!.figure).toEqual(picked.figure);
    expect(next.exercises.find((e) => e.id === "my-press")!.figure).toEqual(custom.figure);
    expect(mig.run(next, "2026-11-21")).toBeNull();
  });
});

describe("machine figures migration (Nov 22 2026)", () => {
  const mig = MIGRATIONS.find((m) => m.id === "2026-11-22-machine-figures")!;
  it("draws the machine on app exercises, keeps a figure the user picked, runs once", () => {
    let d: AppData = buildSeed();
    for (const m of MIGRATIONS) { if (m === mig) break; d = m.run(d, "2026-11-22") ?? d; }
    const press = d.exercises.find((e) => e.id === "machine-shoulder-press")!;
    const picked = { ...d.exercises.find((e) => e.id === "leg-press")!, figure: structuredClone(press.figure) };
    const custom = { ...press, id: "my-press", isCustom: true };
    const next = mig.run({ ...d, exercises: d.exercises.map((e) => (e.id === picked.id ? picked : e)).concat(custom) }, "2026-11-22")!;
    const fig = next.exercises.find((e) => e.id === "machine-shoulder-press")!.figure!;
    expect(fig).not.toEqual(press.figure);
    expect((fig.props as any[]).some((p) => p.rod)).toBe(true); // the lever arms to the handles
    expect((next.exercises.find((e) => e.id === "hack-squat") ?? { figure: null }).figure).toBeFalsy(); // not in the plan: nothing added
    expect(next.exercises.find((e) => e.id === picked.id)!.figure).toEqual(picked.figure);
    expect(next.exercises.find((e) => e.id === "my-press")!.figure).toEqual(custom.figure);
    expect(mig.run(next, "2026-11-22")).toBeNull();
  });
  it("updates a database exercise saved before (hack squat) to the 45° sled", () => {
    const hack = catalog().find((e) => e.id === "hack-squat")!;
    const old = { ...hack, figure: { base: { anchor: 1, ax: 64, ua: 0, fa: 160 }, A: { th: 0, sh: 4, t: -18 }, B: { th: 90, sh: -40, t: -8 }, props: [{ line: [40, -6, 30, 60] }] } } as typeof hack;
    const d = { ...buildSeed(), exercises: [old] };
    const next = mig.run(d, "2026-11-22")!;
    expect(next.exercises[0].figure).toEqual(hack.figure);
    expect((hack.figure!.props as any[]).some((p) => p.foot)).toBe(true);
  });
});
