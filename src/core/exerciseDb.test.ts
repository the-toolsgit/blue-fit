// Checks for the exercise database (src/core/seed/exercise-db/*.json), docs/plans/exercise-database.md §5.
import { describe, expect, it } from "vitest";
import { buildFigure, TEMPLATES } from "./figure/templates";
import { tempoPhases } from "./figure/tempo";
import { MUSCLE_DB } from "./muscles";
import libraryData from "./seed/library.json";
import planData from "./seed/exercises.json";

const mods = import.meta.glob("./seed/exercise-db/*.json", { eager: true }) as Record<string, { default: any[] }>;
const files = Object.keys(mods).map((k) => k.split("/").pop()!);
const all: any[] = Object.entries(mods).flatMap(([k, m]) => m.default.map((e: any) => ({ ...e, _file: k.split("/").pop() })));
const library = (libraryData as any).exercises as any[];
const plan = planData as any[];
const EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "plateMachine", "smith", "fixedBar", "bodyweight", "other"];
const angles = new Map(MUSCLE_DB.map((m) => [m.id, m.angles.map((a) => a.name)]));

describe("exercise database", () => {
  it("has entries", () => expect(all.length).toBeGreaterThan(50));
  it("ids, names and aliases are unique", () => {
    const ids = all.flatMap((e) => [e.id, ...(e.formerIds ?? [])]);
    expect(new Set(ids).size).toBe(ids.length);
    const names = all.flatMap((e) => [e.name, ...(e.aliases ?? [])].map((n: string) => n.toLowerCase()));
    expect(new Set(names).size).toBe(names.length);
  });
  it("every old id of the covered muscles still resolves (id or formerIds)", () => {
    const covered = new Set(files.map((f) => f.replace(".json", "")));
    const known = new Set(all.flatMap((e) => [e.id, ...(e.formerIds ?? [])]));
    const old = [...library, ...plan].filter((e) => covered.has(e.volume?.find((v: any) => v.weight === 1)?.group));
    // Reverse curls moved to biceps from forearms; pullovers to back from chest: those are checked in their own phase
    // Left out on purpose: static holds don't fit the two-move tempo (docs/plans/exercise-database.md)
    const LEFT_OUT = new Set(["plank", "side-bridge"]);
    for (const e of old) if (!LEFT_OUT.has(e.id) && covered.has(e.volume.find((v: any) => v.weight === 1).group)) expect(known, e.id).toContain(e.id);
  });
  for (const e of all) {
    it(`${e.id}: complete and valid`, () => {
      expect(EQUIPMENT).toContain(e.equipment);
      expect(["total", "perSide", "perHand"]).toContain(e.loadMode);
      expect(typeof e.compound).toBe("boolean");
      const main = e.volume.find((v: any) => v.weight === 1)?.group;
      expect(main, "main muscle").toBeTruthy();
      expect(e._file).toBe(`${main}.json`);
      for (const v of e.volume) { expect(angles.has(v.group)).toBe(true); expect([1, 0.5]).toContain(v.weight); }
      for (const [g, j] of Object.entries(e.jobs ?? {})) for (const a of Array.isArray(j) ? j : [j]) expect(angles.get(g as any), `${g}: ${a}`).toContain(a);
      if ((angles.get(main)?.length ?? 0) > 1) expect(e.jobs?.[main], "angle of the main muscle").toBeTruthy();
      for (const k of ["why", "rangeOfMotion", "tempo"]) expect(e[k], k).toBeTruthy();
      for (const k of ["setup", "form"]) { expect(e[k].length, k).toBeGreaterThan(0); expect(e[k].length, k).toBeLessThanOrEqual(3); }
      for (const k of ["tips", "avoid"]) expect((e[k] ?? []).length, k).toBeLessThanOrEqual(3);
      expect(tempoPhases(e.tempo), "tempo has two timed moves").not.toBeNull();
      const holdInTempo = /hold/i.test(e.tempo), holdInForm = /squeeze|pause|hold/i.test([...e.form, ...(e.setup ?? [])].join(" "));
      if (holdInTempo) expect(holdInForm, "a hold in the tempo needs a squeeze/pause in the form").toBe(true);
      expect(TEMPLATES[e.figureTemplate] ?? null, "template").not.toBeNull();
      expect(buildFigure(e.figureTemplate, e.figureAdjust ?? {}), "figure builds").not.toBeNull();
      expect(e.source && (e.source.db || e.source.url || e.source.plan), "source").toBeTruthy();
      expect(JSON.stringify(e.source)).not.toContain("docs/source");
      if (e.preferred) {
        expect(e.preferred.goals.length).toBeGreaterThan(0);
        for (const g of e.preferred.goals) expect(["growth", "strength", "endurance", "maintain"]).toContain(g);
        expect(e.preferred.why).toBeTruthy();
        expect(e.preferred.source?.url, "preferred source").toBeTruthy();
      }
    });
  }
});
