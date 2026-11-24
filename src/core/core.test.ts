import { deriveSkipped, reconcileSkipped, skippedVolume } from "./session";
import { MIGRATIONS, applyMigrations } from "./migrations";
import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { planVolume, sessionsVolume, tonnage } from "./volume";
import { estimateMinutes } from "./timeEstimate";
import { groupPlates, platesFor } from "./plates";
import { epley } from "./oneRm";
import { computeRecords, prsForSet, prsForEntry } from "./records";
import { progressionHint } from "./progression";
import { addSet, afterSetDone, removeEntry, removeSet, applyHint, createSessionFromDay, finishSession, summarize, swapEntry, toggleDone, toggleSupersetWithNext, updateSet } from "./session";
import { dayForDate } from "./today";
import { buildBackup, parseBackup } from "./io/exportFormat";
import { MemoryAdapter } from "./storage/memoryAdapter";
import { type LoggedSet, type Session } from "./types";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const routine = seed.routines[0];

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
    expect(rows.get("forearms")!.sets).toBe(3);
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
    // Fewest plates, not heaviest first (Leo, Nov 23 2026)
    expect(platesFor(60).plates).toEqual([35, 25]);
    expect(platesFor(80).plates).toEqual([45, 35]);
    expect(platesFor(50).plates.length).toBe(2);
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
  it("top reached once → hold; twice in a row, or a failure set 2+ above the top → add weight", () => {
    const top = [set(170, 15), set(170, 15), set(170, 15), set(50, 5, "warmup")];
    expect(progressionHint(top, 10, 15, 2.5)).toEqual({ kind: "hold", weight: 170, reps: 15 });
    expect(progressionHint(top, 10, 15, 2.5, { prev: { sets: top } })).toEqual({ kind: "addWeight", weight: 180, reps: 10, from: 170 }); // 172.5 → round number
    const withFail = [set(170, 15), set(170, 15), set(170, 17, "failure")];
    expect(progressionHint(withFail, 10, 15, 5).kind).toBe("addWeight");
    expect(progressionHint([set(170, 15), set(170, 15), set(170, 16, "failure")], 10, 15, 5).kind).toBe("hold"); // only 1 above
  });
  it("tests with failure whenever the top was reached with no failure set; a failed test waits one workout", async () => {
    const { needsTest } = await import("./progression");
    const top = { sets: [set(100, 12), set(100, 12)] };
    expect(needsTest(top, 12)).toBe(true);
    expect(needsTest({ sets: [set(100, 12), set(100, 14, "failure")] }, 12)).toBe(false); // just tested: wait one workout
    expect(needsTest({ sets: [set(100, 11), set(100, 12)] }, 12)).toBe(false);
  });
  it("after a failed test: one workout at the same weight, then test; two at the top only count when no test can run (Nov 24 2026)", () => {
    const top = [set(190, 10), set(190, 10), set(190, 10)];
    const failedTest = [set(190, 10), set(190, 10), set(190, 10, "failure")];
    // Right after the failed test: hold, even though both workouts reached the top
    expect(progressionHint(failedTest, 10, 10, 10, { prev: { sets: top } })).toEqual({ kind: "hold", weight: 190, reps: 10 });
    // The next workout tests it: hold, the test decides
    expect(progressionHint(top, 10, 10, 10, { prev: { sets: failedTest }, testing: true }).kind).toBe("hold");
    // No test possible (recovery, goal, setting): two workouts at the top still go up, never stuck
    expect(progressionHint(top, 10, 10, 10, { prev: { sets: failedTest } }).kind).toBe("addWeight");
    expect(progressionHint([...top.slice(0, 2), set(190, 12, "failure")], 10, 10, 10).kind).toBe("addWeight");
  });

  it("otherwise asks to beat last reps", () => {
    expect(progressionHint([set(170, 10), set(170, 10), set(170, 9)], 10, 15, 5)).toEqual({ kind: "beatReps", weight: 170, targetReps: [11, 10, 9], lastReps: [10, 10, 9] });
    expect(progressionHint([set(170, 10), set(170, 10), set(170, 9)], 10, 10, 5)).toMatchObject({ targetReps: [10, 10, 10] });
  });
  it("drop sets don't block progression", () => {
    expect(progressionHint([set(50, 12), set(50, 12), set(30, 8, "drop")], 12, 12, 5).kind).toBe("hold");
    expect(progressionHint([set(50, 12), set(50, 12), set(30, 8, "drop")], 12, 12, 5, { prev: { sets: [set(50, 12), set(50, 12)] } }).kind).toBe("addWeight");
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
  it("auto-adjust off: suggestions are stored, not applied; taking one applies it; the summary notes the rest", async () => {
    const { takeExtra, takeFailure } = await import("./session");
    const { workoutNotes } = await import("./notes");
    const [a, b] = [mon.slots[0], mon.slots[1]];
    const s = createSessionFromDay(routine, mon, exMap, [], new Date(2026, 10, 16, 10), { suggest: { extra: [{ slotId: a.id, why: ["Lats behind this week"] }], failure: [{ slotId: b.id, why: ["x"] }] } });
    const [ea, eb] = s.entries;
    expect(ea.sets.length).toBe(a.sets);
    expect(ea.extraSet).toBeUndefined();
    expect(ea.suggestExtra).toEqual(["Lats behind this week"]);
    expect(eb.toFailure).toBeUndefined();
    expect(eb.suggestFailure).toEqual(["x"]);
    expect(workoutNotes(s, [], exMap).filter((n) => n.kind === "suggest")).toHaveLength(2);
    const t = takeFailure(takeExtra(s, ea.id), eb.id);
    expect(t.entries[0].sets.length).toBe(a.sets + 1);
    expect(t.entries[0].extraSet).toEqual(["Lats behind this week"]);
    expect(t.entries[0].suggestExtra).toBeUndefined();
    expect(t.entries[1].toFailure).toBe(true);
    expect(t.entries[1].suggestFailure).toBeUndefined();
    expect(workoutNotes(t, [], exMap).filter((n) => n.kind === "suggest")).toHaveLength(0);
    // The extra set copies the last working set and goes before a drop set
    const withDrop = addSet(s, ea.id, "drop");
    const t2 = takeExtra(withDrop, ea.id).entries[0].sets;
    expect(t2.map((x) => x.type)).toEqual([...Array(a.sets + 1).fill("working"), "drop"]);
    // A set added by hand: no "one more set" note
    const byHand = addSet(s, ea.id);
    expect(workoutNotes(byHand, [], exMap).some((n) => n.title.endsWith("one more set"))).toBe(false);
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
  it("planned drop set: added after the last set, ~22 % lighter, no rest before it, none in deload (Nov 24 2026)", () => {
    const slot = mon.slots.find((x) => exMap.get(x.exerciseId)!.equipment === "cable")!;
    const day = { ...mon, slots: mon.slots.map((x) => (x === slot ? { ...x, dropSet: true } : x)) };
    let s = createSessionFromDay(routine, day, exMap, [], new Date());
    const e = s.entries.find((x) => x.slotId === slot.id)!;
    expect(e.sets.map((x) => x.type)).toEqual([...Array(slot.sets).fill("working"), "drop"]);
    s = updateSet(s, e.id, e.sets[0].id, { weight: 100, reps: 10 });
    for (const x of e.sets.slice(0, -1)) s = toggleDone(s, e.id, x.id, new Date(), 5);
    const e2 = s.entries.find((x) => x.id === e.id)!;
    expect(e2.sets.at(-1)!.weight).toBe(75);
    expect(afterSetDone(s, e.id)).toEqual({ rest: false, nextEntryId: e.id });
    // + Add set goes before the drop set and copies the working weight; a swap keeps the working sets only
    s = addSet(s, e.id);
    const e3 = s.entries.find((x) => x.id === e.id)!;
    expect(e3.sets.map((x) => x.type).at(-1)).toBe("drop");
    expect(e3.sets.at(-2)!.weight).toBe(100);
    const other = [...exMap.values()].find((x) => x.equipment === "cable" && x.id !== e.exerciseId)!;
    expect(swapEntry(s, e.id, other, []).entries.find((x) => x.id === e.id)!.sets.length).toBe(slot.sets + 1);
    // In a superset: no drop set, and it doesn't count
    const sup = { ...mon, slots: mon.slots.map((x) => (x === slot ? { ...x, dropSet: true, supersetGroup: "A" } : x)) };
    expect(createSessionFromDay(routine, sup, exMap, [], new Date()).entries.find((x) => x.slotId === slot.id)!.sets.some((x) => x.type === "drop")).toBe(false);
    const dl = createSessionFromDay(routine, day, exMap, [], new Date(), { deload: true });
    expect(dl.entries.find((x) => x.slotId === slot.id)!.sets.some((x) => x.type === "drop")).toBe(false);
  });
  it("no rest after the workout's last set", () => {
    let s = createSessionFromDay(routine, mon, exMap, [], new Date());
    for (const e of s.entries) for (const x of e.sets) s = toggleDone(s, e.id, x.id, new Date());
    const last = s.entries[s.entries.length - 1];
    expect(afterSetDone(s, last.id).rest).toBe(false);
  });
  it("done set fills later empty sets", () => {
    let s = createSessionFromDay(routine, mon, exMap, [], new Date());
    const e = s.entries[1];
    s = updateSet(s, e.id, e.sets[0].id, { weight: 50, reps: 10 });
    s = toggleDone(s, e.id, e.sets[0].id, new Date());
    expect(s.entries[1].sets.map((x) => [x.weight, x.reps, x.done])).toEqual([[50, 10, true], [50, 10, false], [50, 10, false]]);
  });
  it("first time (no history): reps start at the low end of the plan's rep range, weight empty", () => {
    const s = createSessionFromDay(routine, mon, exMap, [], new Date());
    const slot = mon.slots[0];
    expect(s.entries[0].sets.every((x) => x.reps === slot.repMin && x.weight == null)).toBe(true);
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
    expect(sum.perGroup.back).toBe(1.5); // drop set counts ½ (Nov 24 2026)
    expect(sum.perGroup.biceps).toBe(0.75);
    expect(sessionsVolume([s], exMap).rearDelts).toBe(0.75);
    expect(tonnage([s])).toBe(1480);
    // Undone working sets are remembered for the finish screen: 2 left on the first exercise, every set of the rest
    expect(s.skipped![0]).toEqual({ exerciseId: "t-bar-reverse-row", sets: 2 });
    expect(skippedVolume(s, exMap).back).toBeGreaterThanOrEqual(2);
    // Older workouts without `skipped`: worked out from the plan day, and a migration saves it
    const old = { ...s, skipped: undefined };
    expect(deriveSkipped(old, routine)).toEqual(s.skipped);
    const m = MIGRATIONS.find((x) => x.id === "2026-11-17-backfill-skipped")!;
    expect(m.run({ ...seed, sessions: [old] }, "2026-11-17")!.sessions[0].skipped).toEqual(s.skipped);
    // Editing: a forgotten set recorded later takes one off the skipped count; deleting a set never adds one
    const e0 = s.entries[0];
    const added = addSet(s, e0.id, "working");
    const fresh = added.entries[0].sets.find((x) => !e0.sets.some((y) => y.id === x.id))!; // before the drop set
    const withSet = updateSet(added, e0.id, fresh.id, { weight: 100, reps: 10, done: true });
    expect(reconcileSkipped(s, withSet).skipped![0]).toEqual({ exerciseId: "t-bar-reverse-row", sets: 1 });
    // Deleting a recorded set of a plan exercise brings its skipped set back
    expect(reconcileSkipped(s, removeSet(s, e0.id, e0.sets[0].id)).skipped![0]).toEqual({ exerciseId: "t-bar-reverse-row", sets: 3 });
    // Empty sets (no reps) don't count as recorded
    const emptyAdded = addSet(s, e0.id, "working");
    const emptyDone = updateSet(emptyAdded, e0.id, emptyAdded.entries[0].sets.at(-1)!.id, { weight: null, reps: null, done: true });
    expect(reconcileSkipped(s, emptyDone).skipped![0]).toEqual({ exerciseId: "t-bar-reverse-row", sets: 2 });
    const mig = MIGRATIONS.find((x) => x.id === "2026-11-17-drop-empty-done-sets")!.run({ ...seed, sessions: [emptyDone] }, "2026-11-17")!;
    expect(mig.sessions[0].entries[0].sets.every((x) => (x.reps ?? 0) > 0)).toBe(true);
    // Removing a whole plan exercise makes its done sets skipped again
    const rec = reconcileSkipped(s, withSet);
    expect(reconcileSkipped(rec, removeEntry(rec, e0.id)).skipped![0]).toEqual({ exerciseId: "t-bar-reverse-row", sets: 3 }); // all 3 planned sets
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
    expect(r.counts).toEqual({ sessions: 1, exercises: 35, routines: 1 });
    const db2 = new MemoryAdapter();
    await db2.replaceAll(r.backup.data);
    expect(await db2.all("sessions")).toHaveLength(1);
  });
  it("keeps the Gray style; an unknown style from an older version (Signal) imports as Neon", async () => {
    const db = new MemoryAdapter();
    await db.init(buildSeed);
    const data = await db.exportAll();
    for (const [look, want] of [["gray", "gray"], ["signal2", undefined]] as const) {
      const r = parseBackup(JSON.stringify(buildBackup({ ...data, settings: { ...data.settings, look: look as "gray" } }, new Date())));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.backup.data.settings.look).toBe(want);
    }
  });
  it("a removed accent (green) or a missing one imports as blue; the others stay", async () => {
    const db = new MemoryAdapter();
    await db.init(buildSeed);
    const data = await db.exportAll();
    for (const [accent, want] of [["green", "blue"], [undefined, "blue"], ["pink", "pink"], ["brown", "brown"]] as const) {
      const r = parseBackup(JSON.stringify(buildBackup({ ...data, settings: { ...data.settings, accent: accent as "pink" } }, new Date())));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.backup.data.settings.accent).toBe(want);
    }
  });
  it("importing a backup from this version re-runs every migration without changing anything", () => {
    const first = applyMigrations(buildSeed(), "2026-11-22");
    const again = applyMigrations(structuredClone(first.data), "2026-11-22");
    expect(again.data).toEqual(first.data);
    expect(again.done).toEqual(MIGRATIONS.map((m) => m.id));
  });
  it("a backup comes back exactly as saved (per-plan targets, auto-adjust suggestions)", () => {
    const d = buildSeed();
    d.routines = d.routines.map((r) => ({ ...r, targets: [{ group: "chest", min: 10, max: 14, priority: true }] }));
    d.sessions = [{ id: "s1", date: "2026-11-20", title: "A", startedAt: "2026-11-20T10:00:00Z", finishedAt: "2026-11-20T11:00:00Z", status: "finished", source: "app",
      entries: [{ id: "e1", exerciseId: d.exercises[0].id, restSec: 120, suggestExtra: ["Chest behind"], suggestFailure: ["why"], plannedSets: 3,
        sets: [{ id: "x", type: "working", weight: 50, reps: 10, done: true }] }] }];
    const r = parseBackup(JSON.stringify(buildBackup(d, new Date())));
    expect(r.ok && r.backup.data.routines).toEqual(d.routines);
    expect(r.ok && r.backup.data.sessions).toEqual(d.sessions);
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
  it("body scans (format 2): round-trip; a format-1 backup imports with none; a newer format is refused", () => {
    const d = buildSeed();
    // made-up body
    d.settings = { ...d.settings, heightCm: 180, sex: "male", lengthUnit: "cm" };
    d.bodyScans = [{ id: "b1", date: "2026-11-24T08:00", source: "manual", scannerVersion: "manual", measureVersion: 1, heightCm: 180, weightLb: 200, sex: "male",
      measurements: { chest: 110, waistLower: 95, neck: 41 }, confidence: { chest: 1, waistLower: 1, neck: 1 }, bodyFatPct: 20.1, waistToHeight: 0.528 }];
    const r = parseBackup(JSON.stringify(buildBackup(d, new Date())));
    expect(r.ok && r.backup.schemaVersion).toBe(2);
    expect(r.ok && r.backup.data.bodyScans).toEqual(d.bodyScans);
    expect(r.ok && r.backup.data.settings).toMatchObject({ heightCm: 180, sex: "male", lengthUnit: "cm" });
    const v1 = JSON.parse(JSON.stringify(buildBackup(buildSeed(), new Date())));
    v1.schemaVersion = 1;
    delete v1.data.bodyScans;
    const r1 = parseBackup(JSON.stringify(v1));
    expect(r1.ok && r1.backup.data.bodyScans).toEqual([]);
    expect(parseBackup(JSON.stringify({ ...v1, schemaVersion: 3 }))).toMatchObject({ ok: false });
    const bad = JSON.parse(JSON.stringify(buildBackup(d, new Date())));
    bad.data.bodyScans[0].measurements.chest = "big";
    expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false });
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

describe("adding a warm-up set", async () => {
  const { addSet } = await import("./session");
  it("goes at the top, after existing warm-ups, empty", () => {
    const set = (id: string, type: "working" | "warmup") => ({ id, type, weight: 100, reps: 10, done: false });
    const s = { id: "s", date: "2026-11-18", title: "x", startedAt: "", status: "active" as const, source: "app" as const,
      entries: [{ id: "e", exerciseId: "x", restSec: 90, sets: [set("w1", "warmup"), set("a", "working"), set("b", "working")] }] };
    const sets = addSet(s, "e", "warmup").entries[0].sets;
    expect(sets.map((x) => x.type)).toEqual(["warmup", "warmup", "working", "working"]);
    expect(sets[1]).toMatchObject({ weight: null, reps: null });
    expect(addSet(s, "e").entries[0].sets.at(-1)!.type).toBe("working");
  });
});

describe("editing a set carries to the later undone sets", () => {
  it("set 3 at 10 reps makes set 4 10 too; done sets and other types stay; a done set changes alone", async () => {
    const { editSet } = await import("./session");
    const mk = (id: string, reps: number, done = false, type: "working" | "drop" = "working") => ({ id, type, weight: 60, reps, done, rir: null, completedAt: null });
    const s0 = { id: "s", entries: [{ id: "e", exerciseId: "x", sets: [mk("1", 10, true), mk("2", 8), mk("3", 8), mk("4", 8, true), mk("5", 8, false, "drop")] }] } as never;
    const out = (editSet(s0, "e", "2", { reps: 10 }) as any).entries[0].sets.map((x: any) => x.reps);
    expect(out).toEqual([10, 10, 10, 8, 8]);
    const done = (editSet(s0, "e", "1", { reps: 12 }) as any).entries[0].sets.map((x: any) => x.reps);
    expect(done).toEqual([12, 8, 8, 8, 8]);
  });
});
