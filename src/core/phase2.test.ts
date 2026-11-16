import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { dailyLoad, setSessionDate, setSessionDuration, weeklyStreak } from "./history";
import { averageSets, exerciseSeries, muscleFrequency, rangeStart, weeklyTotals } from "./progress";
import { recoveryStatus } from "./recovery";
import type { LoggedSet, Session } from "./types";
import { weekOrder, weekStart } from "./util";
import { MIGRATIONS, shiftWeekdays } from "./migrations";
import { DEFAULT_SETTINGS } from "./types";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const routine = seed.routines[0];
const set = (weight: number, reps: number, type: LoggedSet["type"] = "working", completedAt?: string): LoggedSet => ({ id: Math.random().toString(), type, weight, reps, done: true, completedAt });
let n = 0;
const sess = (date: string, exerciseId: string, sets: LoggedSet[], dayId?: string): Session => ({
  id: "s" + ++n, date, title: "t", dayId, startedAt: date + "T10:00:00.000Z", finishedAt: date + "T11:00:00.000Z", status: "finished", source: "app",
  entries: [{ id: "e" + n, exerciseId, restSec: 120, sets }],
});
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"];
// a full week starting Monday 2026-11-02
const fullWeek = (mon: string) => DAYS.map((d, i) => sess(new Date(Date.parse(mon) + i * 86_400_000).toISOString().slice(0, 10), "barbell-shrug", [set(100, 10)], d));

describe("calendar day load", () => {
  it("sums sets (no warm-ups/drops) and tonnage per day", () => {
    const m = dailyLoad([sess("2026-11-02", "barbell-shrug", [set(100, 10), set(50, 10, "warmup"), set(60, 8, "drop")]), sess("2026-11-02", "leg-press", [set(90, 10)])]);
    const d = m.get("2026-11-02")!;
    expect(d.sets).toBe(2);
    expect(d.tonnage).toBe(1000 + 480 + 900);
    expect(d.sessionIds).toHaveLength(2);
  });
});

describe("weekly streak", () => {
  it("counts consecutive complete weeks; current week in progress doesn't break it", () => {
    const s = [...fullWeek("2026-11-02"), ...fullWeek("2026-11-09"), sess("2026-11-16", "barbell-shrug", [set(100, 10)], "mon")];
    const r = weeklyStreak(s, routine, "2026-11-17");
    expect(r.current).toBe(2);
    expect(r.best).toBe(2);
    expect(r.thisWeek.daysLogged).toBe(1);
  });
  it("a short week breaks it; repeats of one day count once", () => {
    const short = fullWeek("2026-11-09").slice(0, 5).concat(sess("2026-11-14", "barbell-shrug", [set(1, 1)], "mon"));
    const r = weeklyStreak([...fullWeek("2026-11-02"), ...short], routine, "2026-11-18");
    expect(r.weeks.map((w) => w.complete)).toEqual([true, false, false]);
    expect(r.current).toBe(0);
    expect(r.best).toBe(1);
  });
  it("workouts without a routine day count by distinct date", () => {
    const s = fullWeek("2026-11-02").map((x) => ({ ...x, dayId: undefined }));
    expect(weeklyStreak(s, routine, "2026-11-08").thisWeek.complete).toBe(true);
  });
});

describe("editing a past workout", () => {
  it("moves date and times together", () => {
    const s = setSessionDate(sess("2026-11-02", "leg-press", [set(1, 1)]), "2026-11-04");
    expect(s.date).toBe("2026-11-04");
    expect(s.startedAt).toBe("2026-11-04T10:00:00.000Z");
    expect(s.finishedAt).toBe("2026-11-04T11:00:00.000Z");
    expect(setSessionDuration(s, 75).finishedAt).toBe("2026-11-04T11:15:00.000Z");
  });
});

describe("progress series", () => {
  const hist = [sess("2026-11-02", "leg-press", [set(100, 10), set(110, 6), set(40, 5, "warmup")]), sess("2026-11-09", "leg-press", [set(105, 10)])];
  it("per-session est. 1RM, best set and volume", () => {
    const p = exerciseSeries(hist, "leg-press");
    expect(p).toHaveLength(2);
    expect(p[0].e1rm).toBeCloseTo(133.33, 1);
    expect(p[0].best).toEqual({ weight: 100, reps: 10 });
    expect(p[0].volume).toBe(1660);
    expect(p[1].e1rm).toBe(140);
  });
  it("weekly totals include empty weeks; averages and frequency", () => {
    const w = weeklyTotals(hist, exMap, rangeStart("4w", "2026-11-16"), "2026-11-16");
    expect(w.map((x) => x.weekStart)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(w[1].sets.quads).toBe(2);
    expect(w[1].sets.adductors).toBe(1);
    expect(w[1].tonnage).toBe(1660);
    expect(averageSets(w).quads).toBe(0.8); // 3 / 4 weeks = 0.75 → 0.8
    expect(muscleFrequency(hist, exMap, 4).quads).toBe(0.5);
    expect(muscleFrequency(hist, exMap, 4).adductors).toBe(0);
  });
  it("range starts", () => {
    expect(rangeStart("12w", "2026-11-16")).toBe("2026-08-31");
    expect(rangeStart("all", "2026-11-16")).toBeNull();
  });
});

describe("recovery", () => {
  const now = new Date("2026-11-16T12:00:00.000Z");
  const at = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  it("hard work in 48 h → recovering, 48–72 h → partial, else fresh", () => {
    const s = [
      sess("2026-11-15", "barbell-shrug", [set(1, 1, "working", at(20)), set(1, 1, "working", at(20)), set(1, 1, "working", at(20)), set(1, 1, "failure", at(20))]),
      sess("2026-11-13", "leg-press", [1, 2, 3, 4].map(() => set(1, 1, "working", at(60)))),
      sess("2026-11-15", "hip-adduction", [set(1, 1, "working", at(10)), set(1, 1, "warmup", at(10))]),
      sess("2026-11-10", "leg-extension", [1, 2, 3, 4].map(() => set(1, 1, "working", at(140)))),
    ];
    const r = recoveryStatus(s, exMap, now);
    expect(r.traps.status).toBe("recovering");
    expect(r.quads.status).toBe("partial");
    expect(r.adductors.status).toBe("fresh"); // 1 + 2 (leg press ½ × 4) = 3 < 4
    expect(r.adductors.sets72).toBe(3);
    expect(r.hamstrings.status).toBe("fresh");
  });
});

describe("week start day", () => {
  it("weekStart honours the start day", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // Monday
    expect(weekStart("2026-11-16", 6)).toBe("2026-11-14"); // Saturday
    expect(weekStart("2026-11-14", 6)).toBe("2026-11-14");
    expect(weekStart("2026-11-20", 6)).toBe("2026-11-14"); // Friday belongs to the week that began Saturday
    expect(weekStart("2026-11-21", 6)).toBe("2026-11-21");
    expect(weekStart("2026-11-16", 0)).toBe("2026-11-15");
    expect(weekOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });
  it("streak and weekly totals use it", () => {
    // Sat Nov 14 – Thu Nov 19 = one full Saturday-start week
    const s = DAYS.map((d, i) => sess(`2026-11-${14 + i}`, "barbell-shrug", [set(100, 10)], d));
    expect(weeklyStreak(s, routine, "2026-11-20", 6).current).toBe(1);
    expect(weeklyStreak(s, routine, "2026-11-20", 1).current).toBe(0); // split across two Monday weeks
    const w = weeklyTotals(s, exMap, rangeStart("4w", "2026-11-20", 6), "2026-11-20", 6);
    expect(w[w.length - 1]).toMatchObject({ weekStart: "2026-11-14", workouts: 6 });
  });
});

describe("one-time migration: week starts Saturday", () => {
  const original = shiftWeekdays(routine, 2); // the plan as it was (Mon = Back & Biceps)
  const m = MIGRATIONS.find((x) => x.id === "2026-11-16-week-starts-saturday")!;
  it("moves Monday's day to Saturday, Tuesday's to Sunday …, and sets the week start", () => {
    const out = m.run({ ...seed, routines: [original], settings: { ...DEFAULT_SETTINGS, weekStartDay: 1 } }, "2026-11-16")!;
    const byId = Object.fromEntries(out.routines[0].days.map((d) => [d.id, d.weekday]));
    expect(byId).toEqual({ mon: 6, tue: 0, wed: 1, thu: 2, fri: 3, sat: 4, sun: 5 });
    expect(out.settings.weekStartDay).toBe(6);
  });
  it("does nothing when already moved", () => expect(m.run(seed, "2026-11-16")).toBeNull());
});

describe("one-time migration: hamstrings 8–10", () => {
  const m = MIGRATIONS.find((x) => x.id === "2026-11-16-hamstrings-8-10")!;
  const old = seed.targets.map((t) => (t.group === "hamstrings" ? { ...t, min: 10, max: null, acceptedBelow: true, note: "by choice (shorter leg days)" } : t));
  it("turns the old by-choice target into 8–10", () => {
    const h = m.run({ ...seed, targets: old }, "2026-11-16")!.targets.find((t) => t.group === "hamstrings")!;
    expect(h).toMatchObject({ min: 8, max: 10 });
    expect(h.acceptedBelow).toBeUndefined();
  });
  it("does nothing when already updated", () => expect(m.run(seed, "2026-11-16")).toBeNull());
});

describe("one-time migration: T-bar row has one sleeve", () => {
  const m = MIGRATIONS.find((x) => x.id === "2026-11-16-tbar-single-sleeve")!;
  it("logs the T-bar as the plates on its one sleeve", () => {
    const old = { ...seed, exercises: seed.exercises.map((e) => (e.id === "t-bar-reverse-row" ? { ...e, loadMode: "perSide" as const, singleSleeve: undefined } : e)) };
    expect(m.run(old, "2026-11-16")!.exercises.find((e) => e.id === "t-bar-reverse-row")).toMatchObject({ loadMode: "total", singleSleeve: true });
  });
  it("does nothing when already updated", () => expect(m.run(seed, "2026-11-16")).toBeNull());
});

describe("plain exercise texts", () => {
  const m = MIGRATIONS.find((x) => x.id === "2026-11-16-plain-exercise-text")!;
  it("every built-in exercise has a plain text and a two-phase tempo in movement order", () => {
    for (const e of seed.exercises) {
      expect(e.tempo).toMatch(/^[A-Z][a-z]+ \d s · [A-Z][a-z]+ \d s$/);
      expect(e.why.toLowerCase()).not.toMatch(/your only|back day|traps days|fits the plan|locked-in/);
    }
    expect(seed.exercises.find((e) => e.id === "smith-squat")!.tempo).toBe("Down 3 s · Up 1 s");
    expect(seed.exercises.find((e) => e.id === "t-bar-reverse-row")!.tempo).toBe("Up 1 s · Down 3 s");
  });
  it("updates exercises still showing the original text, skips edited ones, runs once", async () => {
    const raw = (await import("./seed/exercises.json")).default as unknown as typeof seed.exercises;
    const old = { ...seed, exercises: raw.map((e) => (e.id === "leg-press" ? { ...e, why: "My own note" } : structuredClone(e))) };
    const out = m.run(old, "2026-11-16")!;
    expect(out.exercises.find((e) => e.id === "t-bar-reverse-row")!.why).toBe("A heavy row for your lats.");
    expect(out.exercises.find((e) => e.id === "leg-press")!.why).toBe("My own note");
    expect(m.run(out, "2026-11-16")).toBeNull();
  });
});

describe("plain rule text", () => {
  const m = MIGRATIONS.find((x) => x.id === "2026-11-16-plain-rule-text")!;
  it("rewrites the original ★ Heavy card once, leaves edited ones alone", async () => {
    const raw = (await import("./seed/routine-leo-v3-1.json")).default as unknown as typeof seed.routines[0];
    const out = m.run({ ...seed, routines: [structuredClone(raw)] }, "2026-11-16")!;
    expect(out.routines[0].rules!.find((r) => r.title === "★ Heavy")!.text).toMatch(/^★ lifts: the main goal is adding weight/);
    expect(m.run(out, "2026-11-16")).toBeNull();
    expect(seed.routines[0].rules!.find((r) => r.title === "★ Heavy")!.text).toMatch(/^★ lifts/);
  });
});
