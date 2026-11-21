import { describe, expect, it } from "vitest";
import type { Exercise, LoggedSet, Session } from "./types";
import { tonnage } from "./volume";
import { computeRecords } from "./records";
import { progressionHint } from "./progression";
import { addSlot, HOLD_SLOT } from "./routineEdit";
import { failureEligible } from "./failure";
import { exerciseSeries } from "./progress";
import { dailyLoad } from "./history";

const hold: Exercise = {
  id: "h", name: "Hold", aliases: [], muscles: ["Abs"], secondaryMuscles: [], volume: [{ group: "abs", weight: 1 }], equipment: "bodyweight",
  loadMode: "total", isHeavy: false, compound: false, bodyRegion: "upper", why: "", setup: [], form: [], tips: [], avoid: [], rangeOfMotion: "",
  tempo: "Hold 30–60 s", defaultRestSec: 120, incrementLb: 5, figure: null, isCustom: false, archived: false, measure: "time",
};
const set = (weight: number | null, reps: number): LoggedSet => ({ id: Math.random().toString(), type: "working", weight, reps, done: true });
const session = (sets: LoggedSet[], date = "2026-11-20"): Session => ({ id: date, date, title: "", startedAt: date, status: "finished", source: "app", entries: [{ id: "e", exerciseId: "h", restSec: 60, sets }] });

describe("holds (sets in seconds)", () => {
  const exMap = new Map([["h", hold]]);
  it("seconds aren't tonnage", () => {
    expect(tonnage([session([set(25, 60)])], exMap)).toBe(0);
    expect(dailyLoad([session([set(25, 60)])], exMap).get("2026-11-20")!.tonnage).toBe(0);
    expect(dailyLoad([session([set(25, 60)])], exMap).get("2026-11-20")!.sets).toBe(1);
  });
  it("no est. 1RM; longest hold at a weight is the record", () => {
    const r = computeRecords([session([set(25, 40), set(25, 55)])], "h", undefined, true);
    expect(r.bestE1rm).toBeNull();
    expect(r.repsAtWeight.get(25)).toBe(55);
  });
  it("adds 5 s until every set reaches the top, then a little weight", () => {
    const h1 = progressionHint([set(null, 40), set(null, 30)], 20, 60, 5, { time: true });
    expect(h1).toMatchObject({ kind: "beatReps", targetReps: [45, 30] });
    const h2 = progressionHint([set(null, 60), set(null, 60)], 20, 60, 5, { time: true });
    expect(h2).toMatchObject({ kind: "addWeight", weight: 5, reps: 20 });
  });
  it("new slots get a seconds range; holds never get a failure set", () => {
    const r = { id: "r", name: "r", isCurrent: true, createdAt: "", days: [{ id: "d", weekday: 1, title: "d", slots: [] }] };
    const { routine } = addSlot(r, "d", hold, 120);
    expect(routine.days[0].slots[0]).toMatchObject({ repMin: HOLD_SLOT.repMin, repMax: HOLD_SLOT.repMax });
    expect(failureEligible(hold)).toBe(false);
  });
  it("progress chart shows the longest hold, bodyweight included", () => {
    expect(exerciseSeries([session([set(null, 45)])], "h", true)[0].e1rm).toBe(45);
  });
});
