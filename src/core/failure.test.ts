import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { failureApplies, failureBudget, failureEligible, planFailure, weekFailure, type FailureContext } from "./failure";
import { createSessionFromDay, finishSession, swapEntry } from "./session";
import { MIGRATIONS } from "./migrations";
import type { ProfileDraft, Session } from "./types";

const seed = buildSeed();
const exMap = new Map(seed.exercises.map((e) => [e.id, e]));
const routine = seed.routines[0];
const day = (id: string) => routine.days.find((d) => d.id === id)!;
// Made-up profiles only
const prof = (p: Partial<ProfileDraft> = {}): ProfileDraft => ({ goal: "growth", phase: "maintaining", age: 30, yearsTraining: 5, sleepHours: 8, ...p });
const ctx = (over: Partial<FailureContext> = {}, p: ProfileDraft | null = prof()): FailureContext => ({
  routine, exMap, targets: seed.targets, settings: { ...seed.settings, profile: p }, finished: [], today: "2026-11-16", ...over,
});
const ids = (xs: { slotId: string }[], d: string) => xs.map((x) => day(d).slots.find((s) => s.id === x.slotId)!.exerciseId);

describe("strategic last set to failure", () => {
  it("only safe moves: machine, cable, isolation; never ★ lifts or the unsafe list", () => {
    expect(seed.exercises.filter((e) => e.isHeavy && failureEligible(e))).toEqual([]);
    expect(failureEligible(exMap.get("ez-bar-incline-tricep-extension"))).toBe(false);
    expect(failureEligible(exMap.get("single-arm-db-row"))).toBe(false);
    expect(failureEligible(exMap.get("leg-extension"))).toBe(true);
    expect(failureEligible(exMap.get("db-incline-curl"))).toBe(true);
  });
  it("budget: 3; 2 with one of cutting / sleep < 6 h / age 40+; 1 with two or more", () => {
    expect(failureBudget(prof()).sets).toBe(3);
    expect(failureBudget(null).sets).toBe(3);
    expect(failureBudget(prof({ phase: "cutting" })).sets).toBe(2);
    expect(failureBudget(prof({ sleepHours: 5.5 })).sets).toBe(2);
    expect(failureBudget(prof({ age: 40 })).sets).toBe(2);
    expect(failureBudget(prof({ age: 45, phase: "cutting" })).sets).toBe(1);
  });
  it("mass gain and endurance only; none in a deload week or for beginners", () => {
    expect(failureApplies(undefined)).toBe(true);
    expect(failureApplies("endurance")).toBe(true);
    for (const goal of ["strength", "maintenance"] as const) expect(planFailure(day("fri"), "2026-11-18", ctx({}, prof({ goal })))).toEqual([]);
    expect(planFailure(day("fri"), "2026-11-18", ctx({}, prof({ goal: "endurance" }))).length).toBeGreaterThan(0);
    expect(planFailure(day("fri"), "2026-11-18", ctx({}, prof({ yearsTraining: 0.5 })))).toEqual([]);
    const deload = ctx(); deload.settings = { ...deload.settings, deload: { start: "2026-11-14", end: "2026-11-20" } };
    expect(planFailure(day("fri"), "2026-11-18", deload)).toEqual([]);
  });
  it("picks only the last exercise for a muscle, and never one trained again within 2 days", () => {
    // Back & Biceps (Sat): last back move and last biceps move
    expect(ids(planFailure(day("mon"), "2026-11-14", ctx()), "mon")).toEqual(["straight-arm-cable-pulldown", "barbell-preacher-curl"]);
    // Legs A (Mon): side delts are trained again Wed (2 days) → no lateral raise; 3 leg candidates left (calf raises are ★), budget 3
    const legs = ids(planFailure(day("wed"), "2026-11-16", ctx()), "wed");
    expect(legs).not.toContain("cable-lateral-raise");
    expect(legs).toEqual(["leg-extension", "prone-leg-curl", "hip-adduction"]); // calf raises are ★ (Nov 17), so not eligible
    // Sun: rear delts trained again Tue (2 days) → no reverse fly
    expect(ids(planFailure(day("tue"), "2026-11-15", ctx()), "tue")).not.toContain("machine-reverse-fly");
  });
  it("smaller budget takes fewer", () => {
    expect(planFailure(day("sat"), "2026-11-19", ctx({}, prof({ phase: "cutting", age: 50 }))).length).toBe(1);
  });
  it("not if the muscle was trained the day before; a skipped workout or exercise doesn't count", () => {
    // Thu (Legs B): triceps are planned Wed (the day before) → no flame on the kickback
    const thu = (c: FailureContext) => ids(planFailure(day("sat"), "2026-11-19", c), "sat");
    expect(thu(ctx())).not.toContain("cable-one-arm-tricep-kickback");
    // Wed's workout was skipped (it's Thursday now, nothing logged) → the kickback can get it
    expect(thu(ctx({ today: "2026-11-19" }))).toContain("cable-one-arm-tricep-kickback");
    // Wed done but the triceps exercise skipped inside it → same; done with it → no flame
    const wed = createSessionFromDay(routine, day("fri"), exMap, [], new Date(2026, 10, 18, 18));
    const fin = (skip: string | null): Session => finishSession({ ...wed, entries: wed.entries.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: e.exerciseId !== skip, weight: 50, reps: 10 })) })) }, new Date(2026, 10, 18, 19));
    expect(thu(ctx({ today: "2026-11-19", finished: [fin("rope-overhead-tricep-extension")] }))).toContain("cable-one-arm-tricep-kickback");
    expect(thu(ctx({ today: "2026-11-19", finished: [fin(null)] }))).not.toContain("cable-one-arm-tricep-kickback");
    // 2 days before is fine: Mon side delts don't block Wed's lateral raise
    expect(ids(planFailure(day("fri"), "2026-11-18", ctx()), "fri")).toContain("all-the-way-up-lateral-raise");
  });
  it("muscles above their weekly target are skipped", () => {
    const c = ctx({ targets: seed.targets.map((t) => (t.group === "calves" ? { ...t, min: 2, max: 4 } : t)) });
    expect(ids(planFailure(day("wed"), "2026-11-16", c), "wed")).not.toContain("standing-calf-raise");
  });
  it("manual on/off wins and uses the budget", () => {
    const d = day("wed");
    const r = { ...routine, days: routine.days.map((x) => (x.id !== "wed" ? x : { ...x, slots: x.slots.map((s) =>
      s.exerciseId === "standing-calf-raise" ? { ...s, toFailure: false } : s.exerciseId === "smith-squat" ? { ...s, toFailure: true } : s) })) };
    const out = planFailure(r.days.find((x) => x.id === "wed")!, "2026-11-16", ctx({ routine: r }));
    const got = out.map((x) => d.slots.find((s) => s.id === x.slotId)!.exerciseId);
    expect(got).toContain("smith-squat");
    expect(got).not.toContain("standing-calf-raise");
    expect(out.length).toBe(3);
    expect(out.find((x) => x.manual)!.why[0]).toMatch(/Edit plan/);
  });
  it("snapshot: stored on the session at start; finished days show what was stored", () => {
    const c = ctx();
    const picks = planFailure(day("wed"), "2026-11-16", c);
    const s = createSessionFromDay(routine, day("wed"), exMap, [], new Date(2026, 10, 16, 18), { failure: picks });
    expect(s.entries.filter((e) => e.toFailure).length).toBe(3);
    // Mark everything done and finish
    const done: Session = finishSession({ ...s, entries: s.entries.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: true, weight: 50, reps: 10 })) })) }, new Date(2026, 10, 16, 19));
    // Later: the profile changes to strength → past day keeps its flames, future days have none
    const later = ctx({ finished: [done], today: "2026-11-17" }, prof({ goal: "strength" }));
    const w = weekFailure(later);
    expect(w.get("wed")!.size).toBe(3);
    expect(w.get("fri")!.size).toBe(0);
    // Swapping a picked exercise to a ★ lift drops the flame
    const calf = s.entries.find((e) => e.exerciseId === "standing-calf-raise")!;
    expect(swapEntry(s, calf.id, exMap.get("smith-squat")!, []).entries.find((e) => e.id === calf.id)!.toFailure).toBeUndefined();
  });
  it("migration drops the old per-exercise defaults once", () => {
    const m = MIGRATIONS.find((x) => x.id === "2026-11-16-failure-strategic")!;
    const old = { ...seed, exercises: seed.exercises.map((e) => ({ ...e, failureLastSet: true })) };
    const out = m.run(old, "2026-11-16")!;
    expect(out.exercises.some((e) => "failureLastSet" in e)).toBe(false);
    expect(m.run(out, "2026-11-16")).toBeNull();
  });
});

describe("figure tempo", async () => {
  const { tempoSeconds, tempoTiming, TURN_MS } = await import("./figure/tempo");
  const { phase, DEFAULT_TIMING } = await import("./figure/engine");
  it("reads the tempo text; pose A→B follows the matching phase", () => {
    expect(tempoSeconds("Up 1 s · Down 3 s")).toEqual([1, 3]);
    expect(tempoSeconds("2-0-1")).toBeNull();
    expect(tempoTiming("Up 1 s · Down 3 s", "x")).toEqual({ ab: 1000, holdB: TURN_MS, ba: 3000, holdA: TURN_MS });
    expect(tempoTiming("Up 1 s · Hold 1 s · Down 3 s", "prone-leg-curl")).toEqual({ ab: 1000, holdB: 1000, ba: 3000, holdA: TURN_MS });
    // Calf raise: tempo starts "Down 3 s", the figure starts at the bottom → A→B is the 1 s "Up"
    // …and the 2 s hold after "Down" is at the bottom = pose A
    expect(tempoTiming("Down 3 s · Hold 2 s · Up 1 s", "standing-calf-raise")).toEqual({ ab: 1000, holdB: TURN_MS, ba: 3000, holdA: 2000 });
    expect(tempoTiming("", "x")).toBe(DEFAULT_TIMING);
    const t = tempoTiming("Up 1 s · Down 3 s");
    expect(phase(500, t)).toBeCloseTo(0.5);
    expect(phase(1100, t)).toBe(1);
    expect(phase(1250 + 1500, t)).toBeCloseTo(0.5);
    expect(phase(4400, t)).toBe(0);
  });
});

describe("tempo holds migration", () => {
  it("adds holds only where the old app tempo is still there, once", () => {
    const m = MIGRATIONS.find((x) => x.id === "2026-11-16-tempo-holds")!;
    const old = { ...seed, exercises: seed.exercises.map((e) =>
      e.id === "standing-calf-raise" ? { ...e, tempo: "Down 3 s · Up 1 s" } : e.id === "prone-leg-curl" ? { ...e, tempo: "Curl 1 s · Straighten 3 s" } : e.id === "barbell-shrug" ? { ...e, tempo: "My tempo" } : e) };
    const out = m.run(old, "2026-11-16")!;
    const t = (id: string) => out.exercises.find((e) => e.id === id)!.tempo;
    expect(t("standing-calf-raise")).toBe("Down 3 s · Hold 2 s · Up 1 s");
    expect(t("prone-leg-curl")).toBe("Up 1 s · Hold 1 s · Down 3 s");
    expect(t("barbell-shrug")).toBe("My tempo");
    expect(m.run(out, "2026-11-16")).toBeNull();
  });
});
