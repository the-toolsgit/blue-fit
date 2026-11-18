import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { JOBS, weekInsight } from "./workoutCheck";
import { MIGRATIONS } from "./migrations";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const r = seed.routines[0];

describe("workout check", () => {
  it("every built-in job tag is one of its muscle's universal jobs", () => {
    for (const e of seed.exercises) for (const [g, j] of Object.entries(e.jobs ?? {})) expect(JOBS[g as keyof typeof JOBS], `${e.id} ${g}`).toContain(j);
  });
  it("lists the checks for each goal", () => {
    const w = weekInsight(r, exMap, seed.targets);
    expect(w.checks.map((c) => c.id)).toEqual(["volume", "jobs", "stretch", "frequency", "dose", "recovery", "reps", "mix", "rest"]);
    expect(weekInsight(r, exMap, seed.targets, "maintenance").checks.map((c) => c.id)).toEqual(["volume", "recovery"]);
    expect(weekInsight(r, exMap, seed.targets, "strength").checks.map((c) => c.id)).toContain("heavy");
    expect(weekInsight(r, exMap, seed.targets, "endurance").checks.map((c) => c.id)).toContain("reps");
  });
  it("a missing job fails the job check and fades its chip", () => {
    const noHammer = { ...r, days: r.days.map((d) => ({ ...d, slots: d.slots.filter((s) => s.exerciseId !== "db-hammer-curl") })) };
    const w = weekInsight(noHammer, exMap, seed.targets);
    const c = w.checks.find((x) => x.id === "jobs")!;
    expect(c.detail).toContain("Biceps: no hammer");
    expect(w.tiles.find((t) => t.group === "biceps")!.jobs.find((a) => a.name === "hammer")!.state).toBe("none");
  });
  it("hard work on back-to-back days fails recovery; light work doesn't", () => {
    const day = (id: string, weekday: number, exerciseId: string, sets: number) => ({ id, weekday, title: id, slots: [{ id: id + "s", exerciseId, sets, repMin: 8, repMax: 12, restSec: 120 }] });
    const mk = (a: number, b: number) => ({ ...r, days: [day("a", 1, "v-bar-pushdown", a), day("b", 2, "rope-overhead-tricep-extension", b)] }) as typeof r;
    const rec = (x: typeof r) => weekInsight(x, exMap, seed.targets).checks.find((c) => c.id === "recovery")!.pass;
    expect(rec(mk(5, 5))).toBe(false);
    expect(rec(mk(5, 3))).toBe(true);
  });
  it("migration tags built-in exercises with jobs once", () => {
    const m = MIGRATIONS.find((x) => x.id === "2026-11-18-exercise-jobs")!;
    const old = { ...seed, exercises: seed.exercises.map(({ jobs: _j, stretch: _s, ...e }) => (e.id === "db-hammer-curl" ? { ...e, angles: { biceps: "hammer" } } : e)) };
    const out = m.run(old, "2026-11-18")!;
    const h = out.exercises.find((e) => e.id === "db-hammer-curl")!;
    expect(h.jobs).toEqual({ biceps: "hammer" });
    expect("angles" in h).toBe(false);
    expect(out.exercises.find((e) => e.id === "seated-leg-curl")!.stretch).toEqual(["hamstrings"]);
    expect(m.run(out, "2026-11-18")).toBeNull();
  });
});
