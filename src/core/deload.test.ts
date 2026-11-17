import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { deloadActive, deloadReference, deloadSets, deloadSuggestion, deloadWeek, deloadWeight, endDeload, stallCheck } from "./deload";
import { createSessionFromDay, lastEntryFor } from "./session";
import { DEFAULT_SETTINGS, type LoggedSet, type Session, type Settings } from "./types";
import { addDays } from "./util";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const routine = seed.routines[0];
const set = (weight: number, reps: number): LoggedSet => ({ id: Math.random().toString(), type: "working", weight, reps, done: true });
let n = 0;
const sess = (date: string, exerciseId: string, sets: LoggedSet[], deload = false): Session => ({
  id: "d" + ++n, date, title: "t", startedAt: date + "T10:00:00.000Z", finishedAt: date + "T11:00:00.000Z", status: "finished", source: "app", ...(deload ? { deload: true } : {}),
  entries: [{ id: "e" + n, exerciseId, restSec: 120, sets }],
});
const S = (p: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...p });

describe("deload week content", () => {
  it("half the sets rounded up, 10% lighter to the nearest weight step", () => {
    expect([1, 2, 3, 4].map(deloadSets)).toEqual([1, 1, 2, 2]);
    expect(deloadWeight(100, 5)).toBe(90);
    expect(deloadWeight(137.5, 2.5)).toBe(125); // 123.75 → nearest 2.5 step
    expect(deloadWeight(70, 10)).toBe(60); // fixed bar: 63 → 60
    expect(deloadWeight(5, 5)).toBe(5); // never below one step
  });
  it("deload sessions: same days and exercises, half sets, lighter pre-fill, flagged", () => {
    const day = routine.days.find((d) => d.id === "wed")!; // Legs A: Smith Squat 4 sets
    const hist = [sess("2026-11-09", "smith-squat", [set(90, 10), set(90, 10), set(90, 9), set(90, 8)])];
    const s = createSessionFromDay(routine, day, exMap, hist, new Date(2026, 10, 16), { deload: true });
    expect(s.deload).toBe(true);
    expect(s.entries.map((e) => e.exerciseId)).toEqual(day.slots.map((x) => x.exerciseId));
    expect(s.entries[0].sets.map((x) => [x.weight, x.reps])).toEqual([[80, 10], [80, 10]]); // 4 → 2 sets, 81 → 80 (step 5)
    expect(s.entries[1].sets).toHaveLength(2); // leg extension 3 → 2
  });
  it("pre-fill and progression skip deload sessions", () => {
    const hist = [sess("2026-11-09", "leg-press", [set(100, 12)]), sess("2026-11-16", "leg-press", [set(90, 8)], true)];
    expect(lastEntryFor(hist, "leg-press")!.entry.sets[0].weight).toBe(100);
  });
});

describe("deload window", () => {
  it("current training week (Sat–Fri), active check, end early", () => {
    const w = deloadWeek("2026-11-16", 6);
    expect(w).toEqual({ start: "2026-11-14", end: "2026-11-20" });
    const s = S({ deload: w });
    expect(deloadActive(s, "2026-11-20")).toBe(true);
    expect(deloadActive(s, "2026-11-21")).toBe(false);
    expect(endDeload(s, "2026-11-17").deload).toEqual({ start: "2026-11-14", end: "2026-11-16" });
    expect(endDeload(S({ deload: { start: "2026-11-17", end: "2026-11-20" } }), "2026-11-17").deload).toBeNull();
  });
  it("reference day: latest of first logged workout, deload end+1, Not now; none without workouts", () => {
    const first = [sess("2026-09-01", "leg-press", [set(100, 10)])];
    expect(deloadReference(S({}), [])).toBeNull();
    expect(deloadReference(S({}), first)).toBe("2026-09-01");
    expect(deloadReference(S({ deload: { start: "2026-10-10", end: "2026-10-16" } }), first)).toBe("2026-10-17");
    expect(deloadReference(S({ deload: { start: "2026-10-10", end: "2026-10-16" }, deloadDismissedAt: "2026-11-01" }), first)).toBe("2026-11-01");
  });
});

describe("deload suggestion", () => {
  const today = "2026-11-16";
  const firstAt = (daysAgo: number) => [sess(addDays(today, -daysAgo), "leg-press", [set(100, 10)])];
  it("interval: 6 weeks since the first logged workout or the last deload", () => {
    expect(deloadSuggestion(firstAt(41), routine, exMap, S({}), today)).toBeNull();
    expect(deloadSuggestion(firstAt(42), routine, exMap, S({}), today)).toEqual({ reason: "interval", weeks: 6 });
    expect(deloadSuggestion(firstAt(300), routine, exMap, S({ deload: { start: addDays(today, -20), end: addDays(today, -14) } }), today)).toBeNull();
  });
  it("nothing before the first logged workout, however long the app has been installed", () => {
    expect(deloadSuggestion([], routine, exMap, S({}), today)).toBeNull();
  });
  it("not during a deload week; Not now waits for the next trigger", () => {
    expect(deloadSuggestion(firstAt(300), routine, exMap, S({ deload: deloadWeek(today, 6) }), today)).toBeNull();
    expect(deloadSuggestion(firstAt(300), routine, exMap, S({ deloadDismissedAt: addDays(today, -10) }), today)).toBeNull();
  });
  // Each exercise: one older session (before the 4-week window) and three recent ones
  const IDS = [...new Set(routine.days.flatMap((d) => d.slots.map((x) => x.exerciseId)))];
  const history = (improved: number, firstDaysAgo = 30) => [...firstAt(firstDaysAgo), ...IDS.flatMap((id, i) => [
    sess(addDays(today, -29), id, [set(100, 10)]),
    sess(addDays(today, -21), id, [set(100, 10)]),
    sess(addDays(today, -14), id, [set(100, 10)]),
    sess(addDays(today, -7), id, [set(i < improved ? 105 : 100, 10)]),
  ])];
  it("stall: half or more of all plan exercises (★ or not) without progress in 4 weeks", () => {
    const n = IDS.length, half = Math.ceil(n / 2);
    expect(stallCheck(history(n - half), routine, exMap, today)).toMatchObject({ judged: n, stalled: half });
    expect(deloadSuggestion(history(n - half), routine, exMap, S({}), today)).toEqual({ reason: "stall", stalled: half, judged: n });
    expect(deloadSuggestion(history(n - half + 1), routine, exMap, S({}), today)).toBeNull(); // under half → no
  });
  it("needs 3 recent workouts of an exercise to judge it", () => {
    const h = IDS.flatMap((id) => [sess(addDays(today, -40), id, [set(100, 10)]), sess(addDays(today, -14), id, [set(100, 10)]), sess(addDays(today, -7), id, [set(100, 10)])]);
    expect(stallCheck(h, routine, exMap, today).judged).toBe(0);
  });
  it("more reps at the same weight counts as progress even if est. 1RM didn't rise; deload sessions are ignored", () => {
    const h = IDS.flatMap((id) => [
      sess(addDays(today, -40), id, [set(120, 8), set(100, 10)]),
      ...[-20, -10, -5].map((d) => sess(addDays(today, d), id, [set(100, 11)])),
      sess(addDays(today, -3), id, [set(50, 5)], true),
    ]);
    const st = stallCheck(h, routine, exMap, today);
    expect(st.judged).toBe(IDS.length);
    expect(st.stalled).toBe(0);
  });
  it("stall needs 4 weeks since the reference day", () => {
    const h = history(0, 27).filter((x) => x.date >= addDays(today, -27));
    expect(deloadSuggestion(h, routine, exMap, S({}), today)).toBeNull();
  });
});
