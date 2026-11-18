import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { angleList, weekInsight } from "./workoutCheck";
import { MIGRATIONS } from "./migrations";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const r = seed.routines[0];

describe("workout check", () => {
  it("every built-in angle tag is one of its muscle's plan angles", () => {
    const t = new Map(seed.targets.map((x) => [x.group, angleList(x)]));
    for (const e of seed.exercises) for (const [g, a] of Object.entries(e.angles ?? {})) expect(t.get(g as never), `${e.id} ${g}`).toContain(a);
  });
  it("tiles light the week's angles and list the checks for each goal", () => {
    const w = weekInsight(r, exMap, seed.targets);
    const bi = w.tiles.find((t) => t.group === "biceps")!;
    expect(bi.angles.every((a) => a.state === "hit")).toBe(true);
    expect(w.checks.map((c) => c.id)).toEqual(["volume", "angles", "stretch", "mix", "recovery", "length"]);
    expect(weekInsight(r, exMap, seed.targets, "maintenance").checks.map((c) => c.id)).toEqual(["volume", "recovery"]);
    expect(weekInsight(r, exMap, seed.targets, "strength").checks.map((c) => c.id)).toContain("heavy");
    expect(weekInsight(r, exMap, seed.targets, "endurance").checks.map((c) => c.id)).toContain("reps");
  });
  it("a missing angle fails the angle check", () => {
    const noHammer = { ...r, days: r.days.map((d) => ({ ...d, slots: d.slots.filter((s) => s.exerciseId !== "db-hammer-curl") })) };
    const w = weekInsight(noHammer, exMap, seed.targets);
    const c = w.checks.find((x) => x.id === "angles")!;
    expect(c.pass).toBe(false);
    expect(c.detail).toContain("hammer");
    expect(w.tiles.find((t) => t.group === "biceps")!.angles.find((a) => a.name === "hammer")!.state).toBe("none");
  });
  it("migration tags built-in exercises once", () => {
    const m = MIGRATIONS.find((x) => x.id === "2026-11-18-exercise-angles")!;
    const old = { ...seed, exercises: seed.exercises.map(({ angles: _a, ...e }) => e) };
    const out = m.run(old, "2026-11-18")!;
    expect(out.exercises.find((e) => e.id === "db-hammer-curl")!.angles).toEqual({ biceps: "hammer" });
    expect(m.run(out, "2026-11-18")).toBeNull();
  });
});
