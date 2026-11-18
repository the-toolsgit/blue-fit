import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { angleList, dayInsight } from "./workoutCheck";
import { MIGRATIONS } from "./migrations";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const r = seed.routines[0];

describe("workout check", () => {
  it("every built-in angle tag is one of its muscle's plan angles", () => {
    const t = new Map(seed.targets.map((x) => [x.group, angleList(x)]));
    for (const e of seed.exercises) for (const [g, a] of Object.entries(e.angles ?? {})) expect(t.get(g as never), `${e.id} ${g}`).toContain(a);
  });
  it("tiles light today's angles and list the checks for each goal", () => {
    const fri = r.days.find((d) => d.slots.some((s) => s.exerciseId === "db-hammer-curl"))!;
    const i = dayInsight(r, fri, exMap, seed.targets);
    const bi = i.tiles.find((t) => t.group === "biceps")!;
    expect(bi.angles.find((a) => a.name === "hammer")!.state).toBe("today");
    expect(bi.angles.find((a) => a.name === "stretched")!.state).toBe("week");
    expect(i.checks.map((c) => c.id)).toEqual(["volume", "angles", "stretch", "mix", "recovery", "length"]);
    expect(dayInsight(r, fri, exMap, seed.targets, "maintenance").checks.map((c) => c.id)).toEqual(["volume", "recovery"]);
    expect(dayInsight(r, fri, exMap, seed.targets, "strength").checks.map((c) => c.id)).toContain("heavy");
    expect(dayInsight(r, fri, exMap, seed.targets, "endurance").checks.map((c) => c.id)).toContain("reps");
  });
  it("a missing angle fails the angle check", () => {
    const noHammer = { ...r, days: r.days.map((d) => ({ ...d, slots: d.slots.filter((s) => s.exerciseId !== "db-hammer-curl") })) };
    const day = noHammer.days.find((d) => d.slots.some((s) => s.exerciseId === "db-incline-curl"))!;
    const c = dayInsight(noHammer, day, exMap, seed.targets).checks.find((x) => x.id === "angles")!;
    expect(c.pass).toBe(false);
    expect(c.detail).toContain("hammer");
  });
  it("migration tags built-in exercises once", () => {
    const m = MIGRATIONS.find((x) => x.id === "2026-11-18-exercise-angles")!;
    const old = { ...seed, exercises: seed.exercises.map(({ angles: _a, ...e }) => e) };
    const out = m.run(old, "2026-11-18")!;
    expect(out.exercises.find((e) => e.id === "db-hammer-curl")!.angles).toEqual({ biceps: "hammer" });
    expect(m.run(out, "2026-11-18")).toBeNull();
  });
});
