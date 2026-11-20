import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { JOBS, weekInsight } from "./workoutCheck";
import { MIGRATIONS } from "./migrations";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const r = seed.routines[0];

describe("workout check", () => {
  it("every built-in job tag is one of its muscle's universal jobs", () => {
    for (const e of seed.exercises) for (const [g, j] of Object.entries(e.jobs ?? {})) for (const one of [j].flat()) expect(JOBS[g as keyof typeof JOBS], `${e.id} ${g}`).toContain(one);
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
    expect(c.detail).toContain("Biceps: no brachialis");
    expect(w.tiles.find((t) => t.group === "biceps")!.jobs.find((a) => a.name === "brachialis")!.state).toBe("none");
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
    expect(h.jobs).toEqual({ biceps: "brachialis" });
    expect("angles" in h).toBe(false);
    expect(out.exercises.find((e) => e.id === "seated-leg-curl")!.stretch).toEqual(["hamstrings"]);
    expect(m.run(out, "2026-11-18")).toBeNull();
  });
});

describe("biceps parts migration", () => {
  it("curl/hammer tags become long head / short head / brachialis", async () => {
    const { buildSeed } = await import("./seed");
    const { MIGRATIONS } = await import("./migrations");
    const d = buildSeed();
    d.exercises = d.exercises.map((e) => e.id === "db-incline-curl" ? { ...e, jobs: { biceps: "curl" } } : e.id === "db-hammer-curl" ? { ...e, jobs: { biceps: "hammer" } } : e);
    d.exercises.push({ ...d.exercises[0], id: "my-curl", isCustom: true, jobs: { biceps: "curl", back: "row" } });
    const out = MIGRATIONS.find((m) => m.id === "2026-11-18-biceps-parts")!.run(d, "2026-11-18")!;
    expect(out.exercises.find((e) => e.id === "db-incline-curl")!.jobs).toEqual({ biceps: "long head" });
    expect(out.exercises.find((e) => e.id === "db-hammer-curl")!.jobs).toEqual({ biceps: "brachialis" });
    expect(out.exercises.find((e) => e.id === "my-curl")!.jobs).toEqual({ back: "row" });
  });
});

describe("triceps heads", () => {
  it("pushdowns count for the lateral and medial head; the migration converts old tags", async () => {
    const { buildSeed } = await import("./seed");
    const { MIGRATIONS } = await import("./migrations");
    const d = buildSeed();
    d.exercises = d.exercises.map((e) => e.id === "v-bar-pushdown" ? { ...e, jobs: { triceps: "pushdown" } } : e.id === "rope-overhead-tricep-extension" ? { ...e, jobs: { triceps: "overhead" } } : e);
    const out = MIGRATIONS.find((m) => m.id === "2026-11-18-triceps-heads")!.run(d, "2026-11-18")!;
    expect(out.exercises.find((e) => e.id === "v-bar-pushdown")!.jobs).toEqual({ triceps: ["lateral head", "medial head"] });
    expect(out.exercises.find((e) => e.id === "rope-overhead-tricep-extension")!.jobs).toEqual({ triceps: "long head" });
    const w = weekInsight(r, exMap, seed.targets);
    expect(w.tiles.find((t) => t.group === "triceps")!.jobs.every((j) => j.state === "hit")).toBe(true);
  });
});

describe("back, glutes and abs by region", () => {
  it("old movement tags are renamed on stored exercises", async () => {
    const { buildSeed } = await import("./seed");
    const { MIGRATIONS } = await import("./migrations");
    const d = buildSeed();
    d.exercises = d.exercises.map((e) => e.id === "wide-grip-lat-pulldown" ? { ...e, jobs: { back: "vertical pull" } } : e.id === "leg-press" ? { ...e, jobs: { quads: "squat", glutes: "hip extension" } } : e);
    d.exercises.push({ ...d.exercises[0], id: "my-crunch", isCustom: true, jobs: { abs: "flexion", back: "row" } });
    const out = MIGRATIONS.find((m) => m.id === "2026-11-18-job-regions")!.run(d, "2026-11-18")!;
    expect(out.exercises.find((e) => e.id === "wide-grip-lat-pulldown")!.jobs).toEqual({ back: "lats" });
    expect(out.exercises.find((e) => e.id === "leg-press")!.jobs).toEqual({ quads: "squat", glutes: "glute max" });
    expect(out.exercises.find((e) => e.id === "my-crunch")!.jobs).toEqual({ abs: "rectus abs", back: "upper back" });
  });
});

describe("week score", () => {
  it("starts at 20, earns up to 100, and counts indirect sets per workout", async () => {
    const { SCORE_BASE } = await import("./workoutCheck");
    const w = weekInsight(r, exMap, seed.targets);
    expect(w.score.score).toBeGreaterThanOrEqual(SCORE_BASE);
    expect(w.score.score).toBeLessThanOrEqual(100);
    expect(w.score.parts.map((p) => p.id)).toEqual(["volume", "parts", "recovery", "failure", "twice", "dose"]);
    // An empty plan still scores the base
    expect(weekInsight({ ...r, days: [] }, exMap, seed.targets).score.score).toBe(SCORE_BASE);
    // Failure points: none of the muscles get a failure set → 0 of 10
    const none = weekInsight(r, exMap, seed.targets, "growth", { muscles: new Set(), eligible: () => true, applies: true });
    expect(none.score.parts.find((p) => p.id === "failure")!.points).toBe(0);
  });
  it("sets per workout: 1–2 over the limit is a warning (still not passed), more is a miss", () => {
    const back = r.days.find((d) => d.slots.some((s) => s.exerciseId === "t-bar-reverse-row"))!;
    const withSets = (n: number) => ({ ...r, days: r.days.map((d) => (d.id !== back.id ? d : { ...d, slots: d.slots.map((s) => (s.exerciseId === "t-bar-reverse-row" ? { ...s, sets: s.sets + n } : s)) })) });
    const dose = (rr: typeof r) => weekInsight(rr, exMap, seed.targets).checks.find((c) => c.id === "dose")!;
    const base = dose(r);
    expect(base.pass).toBe(false);
    expect(base.warn).toBe(true); // back at 12
    expect(dose(withSets(1)).warn).toBe(true); // 13
    expect(dose(withSets(2)).warn).toBeFalsy(); // 14
    expect(dose(withSets(2)).pass).toBe(false);
  });
  it("twice a week is only asked of muscles over 11 sets a week", () => {
    const w = weekInsight(r, exMap, seed.targets);
    expect(w.checks.find((c) => c.id === "frequency")!.detail).not.toContain("Front delts");
  });
});

describe("exercises per muscle", () => {
  it("groups the routine's biceps exercises by part, with indirect ones apart", async () => {
    const { exercisesFor } = await import("./workoutCheck");
    const b = exercisesFor(r, exMap, "biceps");
    expect(b.parts.map((p) => p.job)).toEqual(["long head", "short head", "brachialis"]);
    expect(b.parts.find((p) => p.job === "brachialis")!.exercises.map((x) => x.exerciseId)).toContain("db-hammer-curl");
    expect(b.indirect.length).toBeGreaterThan(0);
    expect(exercisesFor(r, exMap, "adductors").parts).toEqual([]);
    expect(exercisesFor(r, exMap, "adductors").other.length).toBeGreaterThan(0);
  });
});
