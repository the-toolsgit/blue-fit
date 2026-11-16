import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { deloadActive, deloadReference, deloadSets, deloadSuggestion, deloadWeek, deloadWeight, endDeload, stallCheck } from "./deload";
import { createSessionFromDay, lastEntryFor } from "./session";
import { MIGRATIONS } from "./migrations";
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
const HEAVY = ["t-bar-reverse-row", "machine-shoulder-press", "lateral-shrug-hybrid", "barbell-shrug", "smith-squat", "wide-grip-lat-pulldown", "cable-seated-row", "machine-dip", "db-hammer-curl", "leg-press"];

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
  it("reference day: latest of deload end+1, Not now, start", () => {
    expect(deloadReference(S({ startedAt: "2026-09-01" }))).toBe("2026-09-01");
    expect(deloadReference(S({ startedAt: "2026-09-01", deload: { start: "2026-10-10", end: "2026-10-16" } }))).toBe("2026-10-17");
    expect(deloadReference(S({ startedAt: "2026-09-01", deload: { start: "2026-10-10", end: "2026-10-16" }, deloadDismissedAt: "2026-11-01" }))).toBe("2026-11-01");
  });
});

describe("deload suggestion", () => {
  const today = "2026-11-16";
  it("interval: 6 weeks since start or last deload", () => {
    expect(deloadSuggestion([], routine, exMap, S({ startedAt: addDays(today, -41) }), today)).toBeNull();
    expect(deloadSuggestion([], routine, exMap, S({ startedAt: addDays(today, -42) }), today)).toEqual({ reason: "interval", weeks: 6 });
    expect(deloadSuggestion([], routine, exMap, S({ startedAt: "2026-01-01", deload: { start: addDays(today, -20), end: addDays(today, -14) } }), today)).toBeNull();
  });
  it("not during a deload week; Not now waits for the next trigger", () => {
    expect(deloadSuggestion([], routine, exMap, S({ startedAt: "2026-01-01", deload: deloadWeek(today, 6) }), today)).toBeNull();
    expect(deloadSuggestion([], routine, exMap, S({ startedAt: "2026-01-01", deloadDismissedAt: addDays(today, -10) }), today)).toBeNull();
  });
  // Each ★ lift: one older session (before the 4-week window) and one recent one
  const history = (improved: number) => HEAVY.flatMap((id, i) => [
    sess(addDays(today, -40), id, [set(100, 10)]),
    sess(addDays(today, -7), id, [set(i < improved ? 105 : 100, 10)]),
  ]);
  it("stall: more than half of the ★ lifts without est. 1RM gain in 4 weeks", () => {
    const s = S({ startedAt: addDays(today, -30) }); // 4+ weeks in, not yet 6
    expect(stallCheck(history(4), routine, exMap, today)).toMatchObject({ judged: 10, stalled: 6 });
    expect(deloadSuggestion(history(4), routine, exMap, s, today)).toEqual({ reason: "stall", stalled: 6, judged: 10 });
    expect(deloadSuggestion(history(5), routine, exMap, s, today)).toBeNull(); // exactly half → no
  });
  it("more reps at the same weight counts as improvement; deload sessions are ignored", () => {
    const h = HEAVY.flatMap((id) => [sess(addDays(today, -40), id, [set(100, 10)]), sess(addDays(today, -7), id, [set(100, 11)]), sess(addDays(today, -3), id, [set(50, 5)], true)]);
    expect(stallCheck(h, routine, exMap, today).stalled).toBe(0);
  });
  it("stall needs 4 weeks since the reference day", () => {
    expect(deloadSuggestion(history(0), routine, exMap, S({ startedAt: addDays(today, -27) }), today)).toBeNull();
  });
});

describe("start date migration", () => {
  const m = MIGRATIONS.find((x) => x.id === "2026-11-16-started-at")!;
  it("first logged workout, else today; never overwrites", () => {
    expect(m.run({ ...seed, sessions: [sess("2026-10-03", "leg-press", [set(1, 1)])] }, "2026-11-16")!.settings.startedAt).toBe("2026-10-03");
    expect(m.run(seed, "2026-11-16")!.settings.startedAt).toBe("2026-11-16");
    expect(m.run({ ...seed, settings: { ...seed.settings, startedAt: "2026-01-01" } }, "2026-11-16")).toBeNull();
  });
});
