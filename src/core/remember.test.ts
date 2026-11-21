import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { addSlot, removeSlot } from "./routineEdit";
import { createSessionFromDay } from "./session";
import type { Session } from "./types";

// Leo, Nov 21 2026: an exercise taken out of the plan and added back months later starts from its last weights and reps.
describe("exercise history outlives the plan", () => {
  it("removed, then re-added months later: last weight and reps come back", () => {
    const seed = buildSeed();
    const ex = seed.exercises.find((e) => e.id === "leg-press")!;
    const old: Session = { id: "s1", date: "2026-03-02", title: "", startedAt: "2026-03-02T10:00:00Z", status: "finished", source: "app",
      entries: [{ id: "e1", exerciseId: ex.id, restSec: 120, sets: [
        { id: "a", type: "working", weight: 180, reps: 12, done: true },
        { id: "b", type: "working", weight: 190, reps: 10, done: true }] }] };
    let r = seed.routines[0];
    const day = r.days.find((d) => d.slots.some((s) => s.exerciseId === ex.id))!;
    for (const s of day.slots.filter((s) => s.exerciseId === ex.id)) r = removeSlot(r, day.id, s.id);
    const added = addSlot(r, day.id, ex, 120);
    const d = added.routine.days.find((x) => x.id === day.id)!;
    const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
    const s = createSessionFromDay(added.routine, d, exMap, [old], new Date("2026-11-21T10:00:00Z"));
    const sets = s.entries.find((e) => e.exerciseId === ex.id)!.sets;
    expect(sets.slice(0, 2).map((x) => [x.weight, x.reps])).toEqual([[180, 12], [190, 10]]);
  });
});
