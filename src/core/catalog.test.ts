import { describe, expect, it } from "vitest";
import { mergeCatalog, isTopPick } from "./catalog";
import { catalog, DB_ENTRIES } from "./seed/exercise-db";
import { buildSeed } from "./seed";
import { failureEligible } from "./failure";
import { weekInsight } from "./workoutCheck";

describe("exercise database in the app", () => {
  const db = catalog();
  const seed = buildSeed();

  it("builds every entry with a figure and muscle names", () => {
    expect(db.length).toBe(DB_ENTRIES.length);
    for (const e of db) {
      expect(e.figure, e.id).not.toBeNull();
      expect(e.muscles.length, e.id).toBeGreaterThan(0);
    }
  });

  it("keeps the phone's plan exercises as saved, with database tags", () => {
    const { exercises, exMap } = mergeCatalog(seed.exercises, db);
    for (const p of seed.exercises) {
      const m = exMap.get(p.id)!;
      expect(m.name).toBe(p.name);
      expect(m.form).toEqual(p.form);
      expect(m.volume).toEqual(p.volume);
      expect(m.figure).toEqual(p.figure);
    }
    // gaps filled from the database: face pull now has its rear-delt angle
    expect(exMap.get("rope-face-pull")?.jobs?.rearDelts).toBeTruthy();
    // database-only exercises are listed once
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
    expect(exercises.length).toBe(db.length);
  });

  it("custom exercises are never changed, and a same-name database entry is hidden from the list", () => {
    const custom = { ...db[0], id: "custom-1", isCustom: true, jobs: undefined };
    const { exercises, exMap } = mergeCatalog([custom], db);
    expect(exMap.get("custom-1")?.jobs).toBeUndefined();
    expect(exercises.filter((e) => e.name === db[0].name)).toHaveLength(1);
    expect(exMap.get(db[0].id)).toBeTruthy(); // still opens by id
  });

  it("old ids open their exercise", () => {
    const { exMap } = mergeCatalog([], db);
    const withOld = db.find((e) => e.formerIds?.length)!;
    expect(exMap.get(withOld.formerIds![0])?.id).toBe(withOld.id);
  });

  it("unsafe-to-fail exercises never get a failure set", () => {
    const e = db.find((x) => x.unsafeFailure && x.equipment === "machine") ?? { ...db[0], equipment: "machine" as const, unsafeFailure: true };
    expect(failureEligible(e)).toBe(false);
  });

  it("top picks: strength has its own list, other goals use growth", () => {
    const s = db.find((e) => e.preferred?.goals.includes("strength"))!;
    expect(isTopPick(s, "strength")).toBe(true);
    const g = db.find((e) => e.preferred && !e.preferred.goals.includes("strength"))!;
    expect(isTopPick(g, "maintenance")).toBe(true);
    expect(isTopPick(g, "strength")).toBe(false);
  });

  it("Every angle names exercises to try for a missing angle", () => {
    const { exMap } = mergeCatalog(seed.exercises, db);
    const r = structuredClone(seed.routines[0]);
    r.days = [{ id: "d", weekday: 1, title: "x", slots: [{ id: "s", exerciseId: "wide-grip-lat-pulldown", sets: 3, repMin: 10, repMax: 12, restSec: 120 }] }];
    const jobs = weekInsight(r, exMap, seed.targets).checks.find((c) => c.id === "jobs")!;
    expect(jobs.pass).toBe(false);
    expect(jobs.issues.some((i) => i.what.includes("try"))).toBe(true);
  });
});
