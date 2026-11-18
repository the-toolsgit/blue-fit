import { describe, expect, it } from "vitest";
import { effortGap, setsLabel } from "./effort";
import type { LoggedSet, SessionEntry } from "./types";

const set = (id: string, weight: number, reps: number, type: LoggedSet["type"] = "working", done = true): LoggedSet => ({ id, type, weight, reps, done });
const entry = (sets: LoggedSet[], toFailure = true): SessionEntry => ({ id: "e", exerciseId: "x", restSec: 90, toFailure, sets });

describe("effort check", () => {
  it("flags earlier sets that left more than 2 reps", () => {
    const g = effortGap(entry([set("w", 100, 10, "warmup"), set("a", 170, 12), set("b", 170, 12), set("c", 170, 17)]));
    expect(g).toMatchObject({ sets: [1, 2], min: 5, max: 5, failReps: 17 });
    expect(setsLabel(g!.sets)).toBe("Sets 1–2");
  });
  it("passes when within 2 reps, at another weight, or not done", () => {
    expect(effortGap(entry([set("a", 170, 12), set("b", 170, 14)]))).toBeNull();
    expect(effortGap(entry([set("a", 160, 12), set("b", 170, 17)]))).toBeNull();
    expect(effortGap(entry([set("a", 170, 12), set("b", 170, 17, "working", false)]))).toBeNull();
  });
  it("uses a manual failure set, and ignores the pick on a deload", () => {
    expect(effortGap(entry([set("a", 50, 8), set("b", 50, 12, "failure")], false))?.sets).toEqual([1]);
    expect(effortGap(entry([set("a", 50, 8), set("b", 50, 12)]), true)).toBeNull();
  });
});
