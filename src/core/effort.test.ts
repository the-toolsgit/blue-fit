import { describe, expect, it } from "vitest";
import { effortGap, effortLine } from "./effort";
import type { LoggedSet, SessionEntry } from "./types";

const set = (id: string, weight: number, reps: number, type: LoggedSet["type"] = "working", done = true): LoggedSet => ({ id, type, weight, reps, done });
const entry = (sets: LoggedSet[], toFailure = true): SessionEntry => ({ id: "e", exerciseId: "x", restSec: 90, toFailure, sets });

describe("effort check", () => {
  it("flags earlier sets that left more than 2 reps", () => {
    const g = effortGap(entry([set("w", 100, 10, "warmup"), set("a", 170, 12), set("b", 170, 12), set("c", 170, 17)]));
    expect(g).toMatchObject({ sets: [1, 2], min: 5, max: 5, failReps: 17 });
    expect(effortLine(g!)).toBe("Failure at 17 reps. Go from 12 to 15 reps to stay a couple short of failure.");
    expect(effortLine(g!, 12)).toBe("Failure at 17 reps. The weight was too light: add 10 lb.");
  });
  it("passes when within 2 reps, at another weight, or not done", () => {
    expect(effortGap(entry([set("a", 170, 12), set("b", 170, 14)]))).toBeNull();
    expect(effortGap(entry([set("a", 160, 12), set("b", 170, 17)]))).toBeNull();
    expect(effortGap(entry([set("a", 170, 12), set("b", 170, 17, "working", false)]))).toBeNull();
  });
  it("uses a manual failure set, and ignores the pick on a deload", () => {
    expect(effortGap(entry([set("a", 50, 8), set("b", 50, 12, "failure")], false))?.sets).toEqual([1]);
    expect(effortLine(effortGap(entry([set("a", 50, 8), set("b", 50, 11), set("c", 50, 12)]))!)).toBe("Failure at 12 reps. Go from 8 to 10 reps on set 1 to stay a couple short of failure.");
    expect(effortGap(entry([set("a", 50, 8), set("b", 50, 12)]), true)).toBeNull();
  });
  it("the beat-last-time hint uses the effort target", async () => {
    const { alignHint } = await import("./effort");
    const g = effortGap(entry([set("a", 100, 8), set("b", 100, 8), set("c", 100, 14)]))!;
    expect(alignHint({ kind: "beatReps", targetReps: [9, 8, 14] }, g, 15).targetReps).toEqual([12, 12, 14]);
    expect(alignHint({ kind: "beatReps", targetReps: [9, 8, 14] }, g, 10).targetReps).toEqual([9, 8, 14]); // past the range: go heavier
  });
});

describe("too light by the failure set", () => {
  it("adds 5 lb for 1–2 spare reps past the range, 10 lb for 3+", async () => {
    const { failureJump, progressionHint } = await import("./progression");
    expect(failureJump(15, 12)).toBe(5);
    expect(failureJump(16, 12)).toBe(5);
    expect(failureJump(17, 12)).toBe(10);
    const set = (reps: number, type: "working" | "failure" = "working") => ({ id: String(reps) + type, weight: 110, reps, type, done: true }) as never;
    expect(progressionHint([set(12), set(12), set(12), set(15, "failure")], 10, 12, 5)).toMatchObject({ kind: "addWeight", weight: 120 }); // 115 → round number from 40 lb
  });
  it("more failure reps never give a smaller jump (200 × 10: 12 → 210, 13 → 210, 15 → 210)", async () => {
    const { progressionHint } = await import("./progression");
    const set = (reps: number, type: "working" | "failure" = "working") => ({ id: String(reps) + type, weight: 200, reps, type, done: true }) as never;
    for (const f of [12, 13, 14, 15]) expect(progressionHint([set(10), set(10), set(f, "failure")], 10, 10, 5)).toMatchObject({ kind: "addWeight", weight: 210 });
  });
});

import { tooHeavy } from "./notes";
describe("tooHeavy (go-down tip)", () => {
  const ex = { id: "x", name: "X", incrementLb: 5 } as unknown as import("./types").Exercise;
  const set = (w: number, r: number) => ({ id: `s${w}${r}${Math.random()}`, type: "working", weight: w, reps: r, done: true }) as import("./types").LoggedSet;
  it("suggests a lighter weight when the first set falls short of the range", () => {
    const e = { id: "e", exerciseId: "x", repMin: 12, repMax: 12, sets: [set(210, 9), set(210, 9), set(210, 9)] } as unknown as import("./types").SessionEntry;
    const h = tooHeavy(e, ex)!;
    expect(h.from).toBe(210); expect(h.weight).toBeLessThan(210);
  });
  it("stays (add reps) when only 1–2 reps short", () => {
    const e = { id: "e", exerciseId: "x", repMin: 12, repMax: 12, sets: [set(60, 10), set(60, 10), set(60, 10)] } as unknown as import("./types").SessionEntry;
    expect(tooHeavy(e, ex)).toBeNull();
  });
  it("is quiet when the range was reached", () => {
    const e = { id: "e", exerciseId: "x", repMin: 10, repMax: 12, sets: [set(210, 10)] } as unknown as import("./types").SessionEntry;
    expect(tooHeavy(e, ex)).toBeNull();
  });
});
