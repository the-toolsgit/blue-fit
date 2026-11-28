// Fixes from the Nov 26 2026 audit (the Nov 22 one is audit.test.ts)
import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { swapEntry } from "./session";
import { swapSlotExercise } from "./routineEdit";
import { dropEligible } from "./dropSet";
import { TEST_WHY } from "./failure";
import { workoutNotes } from "./notes";
import { DEFAULT_SETTINGS, type Session } from "./types";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const routine = seed.routines[0];
const set = (id: string, weight: number, reps: number, done = true) => ({ id, type: "working" as const, weight, reps, done });

describe("audit fixes", () => {
  const lift = seed.exercises.find((e) => !e.assisted && e.measure !== "time" && e.equipment !== "bodyweight")!;
  const other = seed.exercises.find((e) => e.id !== lift.id && !e.assisted && e.measure !== "time" && e.equipment !== "bodyweight")!;
  const past = (w: number): Session => ({ id: "p", date: "2026-11-01", startedAt: "2026-11-01T08:00", status: "finished", title: "t",
    entries: [{ id: "pe", exerciseId: other.id, restSec: 60, sets: [set("a", w, 10)] }] } as unknown as Session);

  it("a swap in a deload workout pre-fills deload weight; a weight test doesn't carry over", () => {
    const s = { id: "s", date: "2026-11-20", startedAt: "", title: "t", deload: true,
      entries: [{ id: "e", exerciseId: lift.id, restSec: 60, repMin: 8, repMax: 12, toFailure: true, failWhy: [TEST_WHY], sets: [set("x", 100, 10, false)] }] } as unknown as Session;
    const e = swapEntry(s, "e", other, [past(200)]).entries[0];
    expect(e.sets[0].weight).toBeLessThan(200);
    expect(e.toFailure).toBeUndefined();
    const normal = swapEntry({ ...s, deload: false }, "e", other, [past(200)]).entries[0];
    expect(normal.sets[0].weight).toBe(200);
  });

  it("swapping a plan exercise drops a drop set the new exercise can't take", () => {
    const d = routine.days.find((x) => x.slots.length)!;
    const slot = d.slots[0];
    const r = { ...routine, days: routine.days.map((x) => (x.id === d.id ? { ...x, slots: x.slots.map((y) => (y.id === slot.id ? { ...y, dropSet: true } : y)) } : x)) };
    const bad = seed.exercises.find((e) => !dropEligible(e))!, good = seed.exercises.find((e) => dropEligible(e))!;
    const get = (rr: typeof r) => rr.days.find((x) => x.id === d.id)!.slots.find((y) => y.id === slot.id)!;
    expect(get(swapSlotExercise(r, d.id, slot.id, bad)).dropSet).toBeUndefined();
    expect(get(swapSlotExercise(r, d.id, slot.id, good)).dropSet).toBe(true);
  });

  it("assisted: less help is no 'lighter' note", () => {
    const asst = { ...lift, id: "asst", assisted: true };
    const m = new Map(exMap).set("asst", asst);
    const mk = (id: string, date: string, w: number): Session => ({ id, date, startedAt: date + "T08:00", status: "finished", title: "t",
      entries: [{ id: id + "e", exerciseId: "asst", restSec: 60, repMin: 8, repMax: 12, sets: [set(id + "x", w, 10)] }] } as unknown as Session);
    const before = mk("a", "2026-11-10", 60), now = mk("b", "2026-11-17", 50);
    expect(workoutNotes(now, [before, now], m).some((n) => n.kind === "drop")).toBe(false);
  });

  it("deload note: off when Deload suggestions is off", () => {
    const s = { id: "z", date: "2026-11-20", startedAt: "2026-11-20T08:00", status: "finished", title: "t", entries: [] } as unknown as Session;
    expect(workoutNotes(s, [s], exMap, routine, { ...DEFAULT_SETTINGS, deloadSuggestions: false }).some((n) => n.kind === "deload")).toBe(false);
  });
});

describe("barbell bench: rack and plate (Nov 27 2026)", () => {
  it("barbell bench figures get the rack and a plate; EZ bar only the plate; dumbbells and Smith nothing", async () => {
    const { buildFigure } = await import("./figure/templates");
    const hi = (f: ReturnType<typeof buildFigure>) => ((f?.props ?? []) as Record<string, unknown>[]).filter((p) => p.hi);
    expect(hi(buildFigure("press-flat", {}))).toHaveLength(5);
    expect(hi(buildFigure("press-incline", {}))).toHaveLength(5);
    expect(hi(buildFigure("press-flat", { noRack: true }))).toHaveLength(1);
    expect(hi(buildFigure("press-flat", { equipmentProp: "db" }))).toHaveLength(0);
    expect(hi(buildFigure("press-flat-smith", {}))).toHaveLength(0);
  });
  it("migration adds it to phone copies once", async () => {
    const { MIGRATIONS } = await import("./migrations");
    const { buildFigure } = await import("./figure/templates");
    const m = MIGRATIONS.find((x) => x.id === "2026-11-27-bench-rack-plate")!;
    const old = buildFigure("press-flat", {})!;
    old.props = (old.props as Record<string, unknown>[]).filter((p) => !p.hi);
    const d = { ...seed, exercises: [{ ...seed.exercises[0], id: "x-bench", isCustom: false, equipment: "barbell", figure: old }] } as typeof seed;
    const out = m.run(d, "2026-11-27")!;
    expect(((out.exercises[0].figure!.props ?? []) as Record<string, unknown>[]).filter((p) => p.hi)).toHaveLength(5);
    expect(m.run(out, "2026-11-27")).toBeNull();
  });
});
