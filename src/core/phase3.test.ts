import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { addDay, addSlot, copyName, duplicateRoutine, moveSlot, removeDay, removeSlot, setCurrent, setDayWeekday, swapSlotExercise, toggleSlotSuperset, updateSlot, validateRoutine } from "./routineEdit";
import { exerciseInUse, newCustomExercise, withDerivedMuscles, defaultLoadMode } from "./customExercise";
import { planVolume } from "./volume";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const r0 = seed.routines[0];
const mon = r0.days.find((d) => d.id === "mon")!; // Back & Biceps (Saturday)

describe("routine editing", () => {
  it("add slot uses defaults and updates live volume", () => {
    const before = planVolume(r0, exMap).find((v) => v.group === "chest")!.sets;
    const { routine } = addSlot(r0, mon.id, exMap.get("machine-dip")!, 120);
    const s = routine.days.find((d) => d.id === mon.id)!.slots.at(-1)!;
    expect(s).toMatchObject({ exerciseId: "machine-dip", sets: 3, repMin: 10, repMax: 12, restSec: 120 });
    expect(planVolume(routine, exMap).find((v) => v.group === "chest")!.sets).toBe(before + 1.5);
  });
  it("update, move, remove slots", () => {
    let r = updateSlot(r0, mon.id, mon.slots[0].id, { sets: 5 });
    expect(r.days.find((d) => d.id === mon.id)!.slots[0].sets).toBe(5);
    r = moveSlot(r, mon.id, 0, 2);
    expect(r.days.find((d) => d.id === mon.id)!.slots.map((s) => s.exerciseId).slice(0, 3)).toEqual(["single-arm-cable-lat-pulldown", "single-arm-db-row", "t-bar-reverse-row"]);
    r = removeSlot(r, mon.id, mon.slots[0].id);
    expect(r.days.find((d) => d.id === mon.id)!.slots).toHaveLength(5);
  });
  it("supersets link, unlink, and break when a slot moves away", () => {
    let r = toggleSlotSuperset(r0, mon.id, mon.slots[4].id);
    let d = r.days.find((x) => x.id === mon.id)!;
    expect([d.slots[4].supersetGroup, d.slots[5].supersetGroup]).toEqual(["A", "A"]);
    r = moveSlot(r, mon.id, 5, 0);
    d = r.days.find((x) => x.id === mon.id)!;
    expect(d.slots.every((s) => !s.supersetGroup)).toBe(true);
    r = toggleSlotSuperset(r0, mon.id, mon.slots[0].id);
    r = toggleSlotSuperset(r, mon.id, mon.slots[0].id);
    expect(r.days.find((x) => x.id === mon.id)!.slots.every((s) => !s.supersetGroup)).toBe(true);
  });
  it("swap drops day-specific text", () => {
    const wedLat = r0.days.find((d) => d.title === "Legs A")!.slots[5];
    expect(wedLat.whyOverride).toBeTruthy();
    const r = swapSlotExercise(r0, "wed", wedLat.id, exMap.get("machine-reverse-fly")!);
    expect(r.days.find((d) => d.id === "wed")!.slots[5]).toMatchObject({ exerciseId: "machine-reverse-fly", whyOverride: undefined });
  });
  it("days: add on a free weekday, swap weekdays, remove", () => {
    const { routine, dayId } = addDay(r0);
    expect(routine.days.find((d) => d.id === dayId)!.weekday).toBeNull(); // every weekday is used (Friday = Rest day)
    let r = setDayWeekday(routine, dayId, 5); // take Friday → the Rest day loses it
    expect(r.days.find((d) => d.id === dayId)!.weekday).toBe(5);
    expect(r.days.find((d) => d.id === "sun")!.weekday).toBeNull();
    r = setDayWeekday(r, dayId, 6); // take Saturday → Back & Biceps moves to Friday
    expect(r.days.find((d) => d.id === "mon")!.weekday).toBe(5);
    expect(addDay(removeDay(r0, "sun")).routine.days.at(-1)!.weekday).toBe(5);
    expect(removeDay(r, dayId).days).toHaveLength(r0.days.length);
  });
  it("validation", () => {
    expect(validateRoutine(r0)).toEqual([]);
    const bad = updateSlot({ ...r0, name: " " }, mon.id, mon.slots[0].id, { repMin: 12, repMax: 8 });
    expect(validateRoutine(bad).map((i) => i.message)).toEqual(["The plan needs a name.", "Rep range: the max must be at least the min."]);
    const dup = { ...r0, days: r0.days.map((d) => (d.id === "sun" ? { ...d, weekday: 6 } : d)) };
    expect(validateRoutine(dup)[0].message).toBe("Two days are on Saturday.");
  });
  it("duplicate and current", () => {
    const c = duplicateRoutine(r0, copyName(r0.name, [r0.name]), new Date());
    expect(c.name).toBe("Leo v3.1 copy");
    expect(c.isCurrent).toBe(false);
    expect(c.days[0].id).not.toBe(r0.days[0].id);
    expect(c.days[0].slots[0].exerciseId).toBe(r0.days[0].slots[0].exerciseId);
    expect(copyName("X", ["X copy", "X copy 2"])).toBe("X copy 3");
    expect(setCurrent([r0, c], c.id).map((x) => x.isCurrent)).toEqual([false, true]);
  });
});

describe("custom exercises", () => {
  it("derives display muscles and body region from volume", () => {
    const e = withDerivedMuscles({ ...newCustomExercise("Hack Squat"), volume: [{ group: "adductors", weight: 0.5 }, { group: "quads", weight: 1 }] });
    expect(e.id).toMatch(/^custom-/);
    expect(e.muscles).toEqual(["Quads"]);
    expect(e.secondaryMuscles).toEqual(["Adductors"]);
    expect(e.bodyRegion).toBe("lower");
    expect(defaultLoadMode("smith")).toBe("perSide");
    expect(defaultLoadMode("dumbbell")).toBe("perHand");
  });
  it("in use → archive instead of delete", () => {
    expect(exerciseInUse("leg-press", [], seed.routines)).toBe(true);
    expect(exerciseInUse("custom-x", [], seed.routines)).toBe(false);
  });
});
