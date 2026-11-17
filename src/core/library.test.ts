import { describe, expect, it } from "vitest";
import { LIBRARY, LIBRARY_GROUPS } from "./library";
import { buildSeed } from "./seed";
import { MUSCLE_GROUPS } from "./types";

describe("exercise library", () => {
  it("unique ids, every field filled, valid muscles and weights, a source for each", () => {
    const groups = new Set(MUSCLE_GROUPS.map((m) => m.id));
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
    for (const e of LIBRARY) {
      expect(e.name && e.equipment && e.movement && e.heavyWhy).toBeTruthy();
      expect(e.volume.length).toBeGreaterThan(0);
      expect(e.volume.some((v) => v.weight === 1)).toBe(true);
      for (const v of e.volume) { expect(groups.has(v.group)).toBe(true); expect([0.5, 1]).toContain(v.weight); }
      expect(e.source.db ?? e.source.nippard ?? e.source.plan).toBeTruthy();
    }
  });
  it("covers every muscle group", () => {
    expect([...LIBRARY_GROUPS()].sort()).toEqual(MUSCLE_GROUPS.map((m) => m.id).sort());
  });
  it("every exercise in Leo's plan is in the library, with the same muscles", () => {
    const seed = buildSeed();
    for (const ex of seed.exercises) {
      const lib = LIBRARY.find((e) => e.planIds?.includes(ex.id));
      expect(lib, ex.id).toBeTruthy();
      expect([...lib!.volume].sort((a, b) => a.group.localeCompare(b.group))).toEqual([...ex.volume].sort((a, b) => a.group.localeCompare(b.group)));
    }
  });
  it("★ rule: single-joint moves aren't ★ except shrugs and calf raises", () => {
    for (const e of LIBRARY.filter((x) => x.isHeavy && !x.compound)) expect(["shrug", "calf"]).toContain(e.movement);
    expect(LIBRARY.find((e) => e.name === "Hammer Curls")!.isHeavy).toBe(false);
    expect(LIBRARY.find((e) => e.name === "Barbell Squat")!.isHeavy).toBe(true);
    expect(LIBRARY.find((e) => e.name === "JM Press")!.isHeavy).toBe(false); // over the face
  });
});

describe("abs and neck", () => {
  it("migration adds both targets on Skip once", async () => {
    const { MIGRATIONS } = await import("./migrations");
    const m = MIGRATIONS.find((x) => x.id === "2026-11-17-abs-neck")!;
    const seed = buildSeed();
    const old = { ...seed, targets: seed.targets.filter((t) => t.group !== "abs" && t.group !== "neck") };
    const out = m.run(old, "2026-11-17")!;
    expect(out.targets.filter((t) => t.group === "abs" || t.group === "neck").map((t) => [t.group, t.off])).toEqual([["abs", true], ["neck", true]]);
    expect(m.run(out, "2026-11-17")).toBeNull();
  });
});
