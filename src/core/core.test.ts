import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { groupsLeftThisWeek, planVolume, sessionsVolume, targetStatus, tonnage } from "./volume";
import { estimateMinutes } from "./timeEstimate";
import { groupPlates, platesFor } from "./plates";
import { epley } from "./oneRm";
import { computeRecords, prsForSet, prsForEntry } from "./records";
import { progressionHint } from "./progression";
import { addSet, afterSetDone, applyHint, createSessionFromDay, finishSession, summarize, swapEntry, toggleDone, toggleSupersetWithNext, updateSet } from "./session";
import { dayForDate } from "./today";
import { buildBackup, parseBackup } from "./io/exportFormat";
import { MemoryAdapter } from "./storage/memoryAdapter";
import { type LoggedSet, type Session } from "./types";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const routine = seed.routines[0];

describe("groups still planned this training week (week starts Saturday)", () => {
  const legsB = routine.days.find((d) => d.weekday === 4)!;
  it("Friday (rest, last day of the week): nothing left", () => {
    expect(groupsLeftThisWeek(routine, exMap, [], "2026-11-20", 6).size).toBe(0);
  });
  it("Thursday: Legs B still counts until it's finished", () => {
    expect(groupsLeftThisWeek(routine, exMap, [], "2026-11-19", 6).has("quads")).toBe(true);
    const done = { date: "2026-11-19", dayId: legsB.id, status: "finished" } as Session;
    expect(groupsLeftThisWeek(routine, exMap, [done], "2026-11-19", 6).has("quads")).toBe(false);
  });
});

describe("weekly volume (fractional)", () => {
  const rows = new Map(planVolume(routine, exMap).map((r) => [r.group, r]));
  // Exactly the plan's weekly volume table
  const table: [string, number, number][] = [
    ["back", 20, 2], ["biceps", 16.5, 2], ["triceps", 18, 3], ["sideDelts", 15.5, 3], ["rearDelts", 14.5, 3], ["traps", 15.5, 2],
    ["frontDelts", 6, 1], ["chest", 2, 0], ["quads", 13, 2], ["hamstrings", 8, 2], ["adductors", 10.5, 2], ["calves", 8, 2],
  ];
  for (const [g, sets, days] of table)
    it(`${g} = ${sets} sets on ${days} days`, () => {
      expect(rows.get(g as never)!.sets).toBe(sets);
      expect(rows.get(g as never)!.directDays).toBe(days);
    });
  it("tracks the extra groups", () => {
    expect(rows.get("glutes")!.sets).toBe(3.5);
    expect(rows.get("rotatorCuff")!.sets).toBe(2);
    expect(rows.get("forearms")!.sets).toBe(3);
  });
  it("target status: not-a-focus groups are off; below turns in progress while the week still plans it", () => {
    const t = new Map(seed.targets.map((x) => [x.group, x]));
    expect(targetStatus(8, t.get("hamstrings"))).toBe("ok");
    expect(targetStatus(8, { group: "hamstrings", min: 10, max: null, acceptedBelow: true })).toBe("off");
    expect(targetStatus(12, t.get("back"), true)).toBe("inProgress");
    expect(targetStatus(23, t.get("back"), true)).toBe("above");
    expect(targetStatus(20, t.get("back"))).toBe("ok");
    expect(targetStatus(12, t.get("back"))).toBe("below");
    expect(targetStatus(23, t.get("back"))).toBe("above");
    expect(targetStatus(2, t.get("chest"))).toBe("off");
  });
  it("plan totals 117 sets over 36 slots", () => {
    expect(routine.days.flatMap((d) => d.slots).length).toBe(36);
    expect(routine.days.flatMap((d) => d.slots).reduce((a, s) => a + s.sets, 0)).toBe(117);
  });
});

describe("time estimate", () => {
  it("matches the plan page formula per day", () => {
    const mins = routine.days.filter((d) => d.slots.length).map((d) => estimateMinutes(d.slots.reduce((a, s) => a + s.sets, 0), d.slots.length));
    expect(mins).toEqual([55, 55, 65, 60, 55, 60]); // e.g. Wed: 22 sets, 6 ex → (16.5 + 42 + 6) / 5 ≈ 12.9 → 65
    expect(estimateMinutes(0, 0)).toBe(0);
  });
});

describe("plates (standard gym plates, unlimited)", () => {
  it("heaviest first, as many as needed", () => {
    expect(platesFor(70).plates).toEqual([45, 25]);
    expect(platesFor(137.5).plates).toEqual([45, 45, 45, 2.5]);
    expect(platesFor(405).plates).toEqual(Array(9).fill(45));
    expect(platesFor(0).plates).toEqual([]);
  });
  it("groups and reports what can't be loaded", () => {
    expect(groupPlates(platesFor(120).plates)).toEqual([{ weight: 45, count: 2 }, { weight: 25, count: 1 }, { weight: 5, count: 1 }]);
    expect(platesFor(46)).toMatchObject({ loaded: 45, remainder: 1 });
  });
});

describe("1RM", () => {
  it("Epley", () => {
    expect(epley(300, 10)).toBe(400);
    expect(epley(100, 0)).toBe(0);
  });
});

const set = (weight: number, reps: number, type: LoggedSet["type"] = "working"): LoggedSet => ({ id: Math.random().toString(), type, weight, reps, done: true });
const sess = (id: string, date: string, exerciseId: string, sets: LoggedSet[]): Session => ({
  id, date, title: "t", startedAt: date + "T10:00:00.000Z", finishedAt: date + "T11:00:00.000Z", status: "finished", source: "app",
  entries: [{ id: id + "e", exerciseId, restSec: 120, sets }],
});

describe("records and PRs", () => {
  const hist = [sess("a", "2026-11-01", "barbell-shrug", [set(100, 12), set(100, 10), set(140, 3, "warmup")]), sess("b", "2026-11-05", "barbell-shrug", [set(110, 8)])];
  const r = computeRecords(hist, "barbell-shrug");
  it("ignores warm-ups", () => expect(r.heaviest).toEqual({ weight: 110, reps: 8, date: "2026-11-05" }));
  it("best e1RM and session volume", () => {
    expect(r.bestE1rm!.value).toBeCloseTo(140, 5);
    expect(r.bestSessionVolume!.value).toBe(2200);
    expect(r.repsAtWeight.get(100)).toBe(12);
  });
  it("detects PR kinds", () => {
    expect(prsForSet(r, set(115, 5))).toEqual(["weight"]);
    expect(prsForSet(r, set(100, 13))).toEqual(["e1rm", "reps"]);
    expect(prsForSet(r, set(90, 5))).toEqual([]);
    expect(prsForSet(r, set(100, 30))).toEqual(["e1rm", "reps"]);
    expect(prsForSet(r, set(200, 1, "warmup"))).toEqual([]);
  });
  it("no PRs without history", () => expect(prsForEntry([], "x", "barbell-shrug", [set(500, 5)], "2026-11-14")).toEqual([]));
  it("entry PRs include volume", () => expect(prsForEntry(hist, "new", "barbell-shrug", [set(100, 12), set(100, 12)], "2026-11-14")).toContain("volume"));
});

describe("progression hint", () => {
  it("adds the increment when every working set hit the top", () => {
    expect(progressionHint([set(170, 15), set(170, 15), set(170, 16), set(50, 5, "warmup")], 10, 15, 2.5)).toEqual({ kind: "addWeight", weight: 172.5, reps: 10, from: 170 });
  });
  it("otherwise asks to beat last reps", () => {
    expect(progressionHint([set(170, 10), set(170, 10), set(170, 9)], 10, 15, 5)).toEqual({ kind: "beatReps", weight: 170, targetReps: [11, 10, 9], lastReps: [10, 10, 9] });
    expect(progressionHint([set(170, 10), set(170, 10), set(170, 9)], 10, 10, 5)).toMatchObject({ targetReps: [10, 10, 10] });
  });
  it("drop sets don't block progression", () => {
    expect(progressionHint([set(50, 12), set(50, 12), set(30, 8, "drop")], 12, 12, 5).kind).toBe("addWeight");
  });
  it("no history → none", () => expect(progressionHint([], 8, 10, 5)).toEqual({ kind: "none" }));
});

describe("session logic", () => {
  const mon = routine.days.find((d) => d.id === "mon")!;
  it("today's day: the week starts Saturday with Back & Biceps; Friday is rest", () => {
    expect(dayForDate(routine, new Date(2026, 10, 14))!.title).toBe("Back & Biceps"); // Saturday
    expect(dayForDate(routine, new Date(2026, 10, 15))!.title).toBe("Shoulders & Traps"); // Sunday
    expect(dayForDate(routine, new Date(2026, 10, 16))!.title).toBe("Legs A"); // Monday
    expect(dayForDate(routine, new Date(2026, 10, 19))!.title).toBe("Legs B"); // Thursday
    expect(dayForDate(routine, new Date(2026, 10, 20))).toBeNull(); // Friday
  });
  it("pre-fills from last session", () => {
    const hist = [sess("a", "2026-11-09", "t-bar-reverse-row", [set(90, 12), set(90, 11), set(90, 10)])];
    const s = createSessionFromDay(routine, mon, exMap, hist, new Date(2026, 10, 16, 10));
    expect(s.entries).toHaveLength(6);
    expect(s.entries[0].sets.map((x) => [x.weight, x.reps])).toEqual([[90, 12], [90, 11], [90, 10]]);
    expect(s.entries[1].sets[0].weight).toBeNull();
    const h = applyHint(s, s.entries[0].id, 92.5, 10);
    expect(h.entries[0].sets.every((x) => x.weight === 92.5 && x.reps === 10)).toBe(true);
  });
  it("supersets alternate and rest after the last one", () => {
    let s = createSessionFromDay(routine, mon, exMap, [], new Date());
    s = toggleSupersetWithNext(s, s.entries[4].id); // curls A
    const [a, b] = [s.entries[4], s.entries[5]];
    expect(a.supersetGroup).toBe("A");
    expect(b.supersetGroup).toBe("A");
    s = toggleDone(s, a.id, a.sets[0].id, new Date());
    expect(afterSetDone(s, a.id)).toEqual({ rest: false, nextEntryId: b.id });
    s = toggleDone(s, b.id, b.sets[0].id, new Date());
    expect(afterSetDone(s, b.id)).toEqual({ rest: true, nextEntryId: a.id });
    s = toggleSupersetWithNext(s, a.id);
    expect(s.entries[4].supersetGroup).toBeUndefined();
  });
  it("done set fills later empty sets", () => {
    let s = createSessionFromDay(routine, mon, exMap, [], new Date());
    const e = s.entries[1];
    s = updateSet(s, e.id, e.sets[0].id, { weight: 50, reps: 10 });
    s = toggleDone(s, e.id, e.sets[0].id, new Date());
    expect(s.entries[1].sets.map((x) => [x.weight, x.reps, x.done])).toEqual([[50, 10, true], [50, 10, false], [50, 10, false]]);
  });
  it("swap keeps sets count and remembers the original", () => {
    let s = createSessionFromDay(routine, mon, exMap, [], new Date());
    s = swapEntry(s, s.entries[0].id, exMap.get("cable-seated-row")!, []);
    expect(s.entries[0].exerciseId).toBe("cable-seated-row");
    expect(s.entries[0].swappedFromId).toBe("t-bar-reverse-row");
    expect(s.entries[0].sets).toHaveLength(3);
  });
  it("finish drops undone sets, summary counts volume", () => {
    let s = createSessionFromDay(routine, mon, exMap, [], new Date("2026-11-16T10:00:00Z"));
    const e = s.entries[0];
    s = updateSet(s, e.id, e.sets[0].id, { weight: 100, reps: 10, done: true });
    s = addSet(s, e.id, "drop");
    const d = s.entries[0].sets[3];
    s = updateSet(s, e.id, d.id, { weight: 60, reps: 8, done: true });
    s = finishSession(s, new Date("2026-11-16T10:50:00Z"));
    expect(s.entries).toHaveLength(1);
    expect(s.entries[0].sets).toHaveLength(2);
    const sum = summarize(s, exMap, []);
    expect(sum.durationMin).toBe(50);
    expect(sum.setsDone).toBe(2);
    expect(sum.tonnage).toBe(1480);
    expect(sum.perGroup.back).toBe(1); // drop set excluded from weekly sets
    expect(sum.perGroup.biceps).toBe(0.5);
    expect(sessionsVolume([s], exMap).rearDelts).toBe(0.5);
    expect(tonnage([s])).toBe(1480);
  });
});

describe("backup export / import", () => {
  it("round-trips through the memory adapter", async () => {
    const db = new MemoryAdapter();
    await db.init(buildSeed);
    await db.put("sessions", sess("a", "2026-11-01", "barbell-shrug", [set(100, 12)]));
    const text = JSON.stringify(buildBackup(await db.exportAll(), new Date()));
    const r = parseBackup(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.counts).toEqual({ sessions: 1, exercises: 33, routines: 1 });
    const db2 = new MemoryAdapter();
    await db2.replaceAll(r.backup.data);
    expect(await db2.all("sessions")).toHaveLength(1);
  });
  it("keeps the training profile and target priorities; older backups without them still import", () => {
    const d = buildSeed();
    d.settings = { ...d.settings, profile: { goal: "growth", phase: "bulking", age: 30, yearsTraining: 2, sleepHours: 7.5 } };
    d.targets = d.targets.map((t) => (t.group === "chest" ? { ...t, priority: true } : t));
    const r = parseBackup(JSON.stringify(buildBackup(d, new Date())));
    expect(r.ok && r.backup.data.settings.profile).toMatchObject({ phase: "bulking", sleepHours: 7.5 });
    expect(r.ok && r.backup.data.targets.find((t) => t.group === "chest")?.priority).toBe(true);
    const old = JSON.parse(JSON.stringify(buildBackup(buildSeed(), new Date())));
    delete old.data.settings.profile;
    expect(parseBackup(JSON.stringify(old)).ok).toBe(true);
  });
  it("refuses bad files with a clear message", () => {
    expect(parseBackup("nope")).toEqual({ ok: false, error: "This file isn't valid JSON." });
    expect(parseBackup('{"app":"other"}')).toMatchObject({ ok: false, error: "This isn't a Blue Fit backup file." });
    expect(parseBackup('{"app":"blue-fit","schemaVersion":99}')).toMatchObject({ ok: false });
    const b = buildBackup(buildSeed(), new Date());
    b.data.sessions.push(sess("z", "2026-11-01", "ghost-exercise", [set(1, 1)]));
    const r = parseBackup(JSON.stringify(b));
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toContain("ghost-exercise");
    const bad = JSON.parse(JSON.stringify(buildBackup(buildSeed(), new Date())));
    bad.data.settings.restDefaultSec = "x";
    expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false });
  });
});
