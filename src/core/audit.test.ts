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

describe("form doesn't repeat the tempo", async () => {
  const { MIGRATIONS } = await import("./migrations");
  const run = MIGRATIONS.find((m) => m.id === "2026-11-22-form-no-tempo")!.run;
  const was = (await import("./seed/form-tempo-was.json")).default as unknown as Record<string, [string[], string[]][]>;
  it("a phone copy on the old text gets the new form; a rewritten one stays", () => {
    const [old, now] = was["overhead-trap"][0];
    const mk = (form: string[], isCustom = false) => ({ id: "overhead-trap", form, isCustom }) as never;
    const out = run({ exercises: [mk(old)] } as never, "2026-11-22") as unknown as { exercises: { form: string[] }[] };
    expect(out.exercises[0].form).toEqual(now);
    expect(run({ exercises: [mk(["My own words."])] } as never, "2026-11-22")).toBeNull();
    expect(now.join(" ")).not.toMatch(/\d s\b|slowly/);
  });
});

describe("regular cable lateral raise stands straight", async () => {
  const { MIGRATIONS } = await import("./migrations");
  const run = MIGRATIONS.find((m) => m.id === "2026-11-23-cable-lateral-upright")!.run;
  const leaning = { v: "f", base: { L: { ua: 72, fa: 80 }, cx: 56, rot: 14, la: 0, sa: 0, hw: 1.5 }, A: { ua: -30, fa: -32 }, B: { ua: 90, fa: 92 }, props: [{ line: [22, -14, 22, 104] }, { line: [16, 104, 30, 104] }, { cable: [22, 96], to: "haR" }] };
  it("the leaning figure and setup line are replaced; a user's own stays", () => {
    const mk = (figure: unknown, setup: string[], isCustom = false) => ({ id: "cable-lateral-raise", figure, setup, isCustom }) as never;
    const out = run({ exercises: [mk(leaning, ["Pulley low.", "Hold the machine with your free hand, lean away."])] } as never, "2026-11-23") as unknown as { exercises: { figure: { base: { rot: number } }; setup: string[] }[] };
    expect(out.exercises[0].figure.base.rot).toBe(0);
    expect(out.exercises[0].setup[1]).toBe("Stand tall, free hand on the machine.");
    expect(run({ exercises: [mk({ ...leaning, base: { cx: 50 } }, ["Mine."])] } as never, "2026-11-23")).toBeNull();
  });
});

describe("machine flies get the lever arms", async () => {
  const { MIGRATIONS } = await import("./migrations");
  const run = MIGRATIONS.find((m) => m.id === "2026-11-23-fly-machine-levers-all")!.run;
  it("an older app figure is replaced; a user's own stays", () => {
    const old = { v: "f", base: { hy: 66 }, A: {}, B: {}, props: [{ line: [44, 68, 76, 68] }, { perp: "haR", ang: 0, len: 10 }, { perp: "haL", ang: 0, len: 10 }] };
    const out = run({ exercises: [{ id: "machine-reverse-fly", figure: old, isCustom: false }] } as never, "2026-11-23") as unknown as { exercises: { figure: { props: Record<string, unknown>[] } }[] };
    expect(out.exercises[0].figure.props.some((p) => p.lever)).toBe(true);
    expect(run({ exercises: [{ id: "machine-reverse-fly", figure: { ...old, props: [{ db: "haR" }] }, isCustom: false }] } as never, "2026-11-23")).toBeNull();
  });
});
