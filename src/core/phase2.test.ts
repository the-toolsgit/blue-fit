import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { dailyLoad, setSessionDate, setSessionDuration, weeklyStreak } from "./history";
import { averageSets, exerciseSeries, lastChanges, muscleFrequency, rangeStart, weeklyTotals } from "./progress";
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

describe("streak freeze and calendar flames", async () => {
  const { toggleFreeze, activeFreeze, streakMarks, restDayOf } = await import("./history");
  it("a frozen missed week holds the streak (no +1); unfrozen it breaks it", () => {
    const s = [...fullWeek("2026-11-02"), ...fullWeek("2026-11-16")]; // week of Nov 9 missed
    expect(weeklyStreak(s, routine, "2026-11-25").current).toBe(1);
    const frozen = weeklyStreak(s, routine, "2026-11-25", 1, [{ start: "2026-11-10", end: "2026-11-12" }]);
    expect(frozen.current).toBe(2);
    expect(frozen.best).toBe(2);
    // Still frozen (no end) → following missed weeks hold too
    expect(weeklyStreak(fullWeek("2026-11-02"), routine, "2026-11-30", 1, [{ start: "2026-11-09", end: null }]).current).toBe(1);
  });
  it("tap toggles: freeze from today, unfreeze ends it today (same day = undo)", () => {
    const on = toggleFreeze([], "2026-11-16");
    expect(activeFreeze(on)).toEqual({ start: "2026-11-16", end: null });
    expect(toggleFreeze(on, "2026-11-16")).toEqual([]);
    expect(toggleFreeze(on, "2026-11-20")).toEqual([{ start: "2026-11-16", end: "2026-11-20" }]);
  });
  it("skipped days: past planned days not done that week (a moved workout isn't skipped)", async () => {
    const { skippedDays } = await import("./history");
    // Seed plan: Mon = day "wed" (Legs A), Tue = "thu", Wed = "fri"
    const mon = sess("2026-11-02", "leg-press", [set(100, 10)], "wed");
    expect([...skippedDays([mon], routine, "2026-11-05", 1)]).toEqual(["2026-11-03", "2026-11-04"]);
    // Tuesday's workout done on Wednesday → neither day is skipped
    const moved = sess("2026-11-04", "barbell-shrug", [set(100, 10)], "thu");
    expect([...skippedDays([mon, moved], routine, "2026-11-05", 1)]).toEqual([]);
    expect(skippedDays([mon], routine, "2026-11-02", 1).size).toBe(0); // today never
  });
  it("fire on the rest day of each complete week, ice on the day a freeze started", () => {
    // Monday weeks; the seed plan trains Sat–Thu (rest day Fri)
    expect(restDayOf("2026-11-02", routine)).toBe("2026-11-06");
    const st = weeklyStreak([...fullWeek("2026-11-02")], routine, "2026-11-20");
    const m = streakMarks(st, routine, [{ start: "2026-11-16", end: null }]);
    expect(m.get("2026-11-06")).toBe("fire");
    expect(m.get("2026-11-16")).toBe("ice");
    expect(m.size).toBe(2);
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
    expect(w[1].tonnage).toBe(3320); // leg press is logged per side: both sides count
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
  const four = (t: LoggedSet["type"] = "working") => [1, 2, 3, 4].map(() => set(1, 1, t));
  it("full rest days from the muscle database: 2 for big muscles, 1 for the rest", () => {
    const s = [
      sess("2026-11-14", "leg-extension", four()), // quads (2 rest days): Sat hard → Sun, Mon rest → Tue fresh
      sess("2026-11-15", "hip-adduction", four()), // adductors (1 rest day): Sun hard → Mon rest → Tue fresh
      sess("2026-11-14", "barbell-shrug", four()), // traps (1 rest day): Sat hard → fresh from Mon
      sess("2026-11-16", "standing-calf-raise", [set(1, 1), set(1, 1, "warmup")]), // under 4 sets: not hard
    ];
    const r = recoveryStatus(s, exMap, "2026-11-16");
    expect(r.quads).toMatchObject({ status: "recovering", sets: 4, daysAgo: 2 });
    expect(r.adductors).toMatchObject({ status: "recovering", daysAgo: 1 });
    expect(r.traps.status).toBe("fresh");
    expect(r.calves.status).toBe("fresh");
    expect(recoveryStatus(s, exMap, "2026-11-17").quads.status).toBe("fresh");
  });
  it("age 40+, short sleep or a ★ key lift to failure keep it partly recovered one more day", () => {
    const s = [sess("2026-11-14", "barbell-shrug", four())];
    expect(recoveryStatus(s, exMap, "2026-11-15").traps.status).toBe("recovering");
    expect(recoveryStatus(s, exMap, "2026-11-16").traps.status).toBe("fresh");
    expect(recoveryStatus(s, exMap, "2026-11-16", { age: 45 } as never).traps).toMatchObject({ status: "partial", slower: ["age 40+"] });
    expect(recoveryStatus(s, exMap, "2026-11-16", { sleepHours: 5 } as never).traps.status).toBe("partial");
    const f = [sess("2026-11-14", "barbell-shrug", [...four().slice(0, 3), set(1, 1, "failure")])];
    expect(recoveryStatus(f, exMap, "2026-11-16").traps.slower).toEqual(["★ key lift to failure"]);
    expect(recoveryStatus(f, exMap, "2026-11-17").traps.status).toBe("fresh");
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
      expect(e.tempo).toMatch(/^[A-Z][a-z]+ \d s( · Hold \d s)? · [A-Z][a-z]+ \d s( · Hold \d s)?$/);
      expect(e.why.toLowerCase()).not.toMatch(/your only|back day|traps days|fits the plan|locked-in/);
    }
    expect(seed.exercises.find((e) => e.id === "smith-squat")!.tempo).toBe("Down 3 s · Up 1 s");
    expect(seed.exercises.find((e) => e.id === "t-bar-reverse-row")!.tempo).toBe("Up 1 s · Hold 1 s · Down 3 s"); // hold added in the Nov 17 text review
  });
  it("updates exercises still showing the original text, skips edited ones, runs once", async () => {
    const raw = (await import("./seed/exercises.json")).default as unknown as typeof seed.exercises;
    const old = { ...seed, exercises: raw.map((e) => (e.id === "leg-press" ? { ...e, why: "My own note" } : structuredClone(e))) };
    const out = m.run(old, "2026-11-16")!;
    expect(out.exercises.find((e) => e.id === "t-bar-reverse-row")!.why).toBe("Heavy row for your lats.");
    expect(out.exercises.find((e) => e.id === "leg-press")!.why).toBe("My own note");
    expect(m.run(out, "2026-11-16")).toBeNull();
  });
});

describe("plain rule text", () => {
  const m = MIGRATIONS.find((x) => x.id === "2026-11-16-plain-rule-text-4")!;
  it("rewrites the original ★ Heavy card once, leaves edited ones alone", async () => {
    const raw = (await import("./seed/routine-leo-v3-1.json")).default as unknown as typeof seed.routines[0];
    const out = m.run({ ...seed, routines: [structuredClone(raw)] }, "2026-11-16")!;
    expect(out.routines[0].rules!.find((r) => r.title === "★ Heavy")!.text).toMatch(/^★ Key lifts: heavy lifts\./);
    expect(m.run(out, "2026-11-16")).toBeNull();
    expect(seed.routines[0].rules!.find((r) => r.title === "★ Key lift")!.text).toMatch(/^★ Key lifts: heavy lifts\./);
  });
  it("Nov 17: DB Hammer Curl loses its ★ (built-in only)", () => {
    const m3 = MIGRATIONS.find((x) => x.id === "2026-11-17-hammer-curl-not-heavy")!;
    const ex = seed.exercises.map((e) => (e.id === "db-hammer-curl" ? { ...e, isHeavy: true } : e));
    const out = m3.run({ ...seed, exercises: ex }, "2026-11-17")!;
    expect(out.exercises.find((e) => e.id === "db-hammer-curl")!.isHeavy).toBe(false);
    expect(m3.run(out, "2026-11-17")).toBeNull();
    expect(seed.exercises.find((e) => e.id === "db-hammer-curl")!.isHeavy).toBe(false);
  });
  it("Nov 17: ★ Key lift card says what ★ means (old wording only)", () => {
    const m2 = MIGRATIONS.find((x) => x.id === "2026-11-17-key-lift-text-3")!;
    const r = structuredClone(seed.routines[0]);
    r.rules = [{ title: "★ Key lift", text: "★ Key lifts: the app tracks these to measure your strength progress, and suggests a deload when they stall." }, { title: "Effort", text: "x" }];
    const out = m2.run({ ...seed, routines: [r] }, "2026-11-17")!;
    expect(out.routines[0].rules![0].text).toMatch(/^★ Key lifts: heavy lifts\./);
    expect(m2.run(out, "2026-11-17")).toBeNull();
    r.rules = [{ title: "★ Key lift", text: "★ Key lifts: heavy compound lifts. Add weight whenever you can. The app never takes them to failure." }];
    expect(m2.run({ ...seed, routines: [r] }, "2026-11-17")!.routines[0].rules![0].text).toMatch(/^★ Key lifts: heavy lifts\./);
    r.rules = [{ title: "★ Key lift", text: "My own text" }];
    expect(m2.run({ ...seed, routines: [r] }, "2026-11-17")).toBeNull();
  });
});


describe("up / down (last workout vs the one before)", () => {
  const exs = seed.exercises.filter((e) => ["leg-press", "barbell-shrug"].includes(e.id));
  it("compares the best set by estimated max of the last two workouts; warm-ups ignored; one workout is not enough", () => {
    const h = [
      sess("2026-11-02", "leg-press", [set(80, 10)]),
      sess("2026-11-09", "leg-press", [set(100, 8), set(90, 10)]),
      sess("2026-11-16", "leg-press", [set(200, 5, "warmup"), set(95, 12)]),
      sess("2026-11-16", "barbell-shrug", [set(100, 10)]),
    ];
    const r = lastChanges(h, exs);
    // 100×8 (est. 127) → 95×12 (est. 133): lighter but more reps = up
    expect(r).toEqual([{ exerciseId: "leg-press", before: 100, after: 95, beforeReps: 8, afterReps: 12, unit: "lb", date: "2026-11-16", dir: 1 }]);
  });
  it("a new rep range: 180×10 → 170×12 is the same, 180×10 → 180×12 up, 180×10 → 170×10 down", () => {
    const dir = (w: number, r: number) => lastChanges([sess("2026-11-02", "leg-press", [set(180, 10)]), sess("2026-11-09", "leg-press", [set(w, r)])], exs)[0].dir;
    expect(dir(170, 12)).toBe(0);
    expect(dir(180, 12)).toBe(1);
    expect(dir(170, 10)).toBe(-1);
  });
  it("assisted: less help is up", () => {
    const a = [{ ...exs[0], id: "leg-press", assisted: true }];
    const dir = (w: number, r: number) => lastChanges([sess("2026-11-02", "leg-press", [set(50, 10)]), sess("2026-11-09", "leg-press", [set(w, r)])], a)[0].dir;
    expect(dir(40, 10)).toBe(1);
    expect(dir(60, 12)).toBe(-1);
    expect(dir(50, 11)).toBe(1);
  });
  it("bodyweight work without a weight compares the most reps", () => {
    const r = lastChanges([sess("2026-11-02", "barbell-shrug", [set(0, 10)]), sess("2026-11-09", "barbell-shrug", [set(0, 12)])], exs);
    expect(r[0]).toMatchObject({ before: 10, after: 12, unit: "reps" });
  });
});
