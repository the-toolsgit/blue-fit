// Fixes from the Nov 22 2026 app audit
import { describe, expect, it } from "vitest";
import { computeRecords, prsForEntry } from "./records";
import { progressionHint } from "./progression";
import { exerciseSeries } from "./progress";
import { buildEntry, summarize } from "./session";
import { deloadAssist } from "./deload";
import type { Exercise, LoggedSet, Session } from "./types";
import { buildSeed } from "./seed";

const set = (weight: number | null, reps: number): LoggedSet => ({ id: Math.random().toString(36), type: "working", weight, reps, done: true });
const sess = (id: string, date: string, exerciseId: string, sets: LoggedSet[]): Session => ({
  id, date, title: "W", startedAt: date + "T10:00:00Z", finishedAt: date + "T11:00:00Z", status: "finished", source: "app",
  entries: [{ id: id + "e", exerciseId, restSec: 120, sets }],
});
const base = buildSeed().exercises[0];

describe("bodyweight sets without a weight", () => {
  const hist = [sess("a", "2026-11-10", "pu", [set(null, 8), set(null, 8)]), sess("b", "2026-11-12", "pu", [set(null, 10), set(null, 9)])];
  it("count for records, the chart and hints", () => {
    const r = computeRecords(hist, "pu");
    expect(r.heaviest).toMatchObject({ weight: 0, reps: 10 });
    expect(r.bestE1rm).toBeNull();
    expect(exerciseSeries(hist, "pu").map((p) => p.e1rm)).toEqual([8, 10]);
    expect(progressionHint([set(null, 12), set(null, 12)], 8, 12, 5).kind).not.toBe("none");
  });
  it("more reps is a reps PR", () => expect(prsForEntry(hist, "c", "pu", [set(null, 11)], "2026-11-14")).toContain("reps"));
});

describe("assisted machines", () => {
  const ex: Exercise = { ...base, id: "ad", assisted: true, incrementLb: 5 };
  it("deload adds help", () => {
    expect(deloadAssist(50, 5)).toBeGreaterThan(50);
    const hist = [sess("a", "2026-11-10", "ad", [set(50, 10)])];
    expect(buildEntry(ex, hist, { deload: true }).sets.find((x) => x.type === "working")?.weight).toBeGreaterThan(50);
  });
  it("no PRs in the summary", () => {
    const hist = [sess("a", "2026-11-10", "ad", [set(50, 10)])];
    const now = sess("b", "2026-11-12", "ad", [set(70, 12)]);
    expect(summarize(now, new Map([["ad", ex]]), [...hist, now]).prs).toEqual([]);
  });
});

it("volume chart doubles per-side lifts like tonnage", () => {
  const hist = [sess("a", "2026-11-10", "sq", [set(90, 10)])];
  expect(exerciseSeries(hist, "sq", false, 2)[0].volume).toBe(1800);
});

describe("ready-for-more-weight test drops when the weight goes up", async () => {
  const { dropTestIfRaised } = await import("./session");
  const { TEST_WHY, MANUAL_WHY } = await import("./failure");
  const set = (weight: number, done = false) => ({ id: "s" + weight + done, type: "working" as const, weight, reps: 10, done });
  const mk = (why: string[], w: number) => ({ id: "x", date: "2026-11-22", entries: [{ id: "e", exerciseId: "a", sets: [set(w), set(w)], toFailure: true, failWhy: why }] }) as never;
  const last = [set(90, true), set(90, true)];
  it("drops at a heavier weight", () => {
    const e = (dropTestIfRaised(mk([TEST_WHY], 100), "e", last) as { entries: { toFailure?: boolean }[] }).entries[0];
    expect(e.toFailure).toBeUndefined();
  });
  it("keeps at the same weight, and keeps other reasons", () => {
    expect((dropTestIfRaised(mk([TEST_WHY], 90), "e", last) as { entries: { toFailure?: boolean }[] }).entries[0].toFailure).toBe(true);
    expect((dropTestIfRaised(mk([MANUAL_WHY], 100), "e", last) as { entries: { toFailure?: boolean }[] }).entries[0].toFailure).toBe(true);
  });
});
