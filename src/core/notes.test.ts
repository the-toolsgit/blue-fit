import { describe, expect, it } from "vitest";
import { workoutNotes, weightFor } from "./notes";
import type { Exercise, LoggedSet, Session, SessionEntry } from "./types";

const ex = { id: "x", name: "Raise", incrementLb: 5, volume: [{ group: "sideDelts", weight: 1 }] } as unknown as Exercise;
const exMap = new Map([[ex.id, ex]]);
let n = 0;
const set = (weight: number, reps: number, type: LoggedSet["type"] = "working", at?: string): LoggedSet => ({ id: `s${n++}`, type, weight, reps, done: true, completedAt: at ?? null });
const entry = (sets: LoggedSet[], o: Partial<SessionEntry> = {}): SessionEntry => ({ id: `e${n++}`, exerciseId: "x", restSec: 120, repMin: 10, repMax: 12, sets, ...o });
const session = (date: string, entries: SessionEntry[], o: Partial<Session> = {}): Session =>
  ({ id: `w${n++}`, date, title: "Shoulders", dayId: "d1", startedAt: `${date}T10:00:00Z`, finishedAt: `${date}T11:00:00Z`, status: "finished", source: "app", entries, ...o });
const kinds = (s: Session, h: Session[]) => workoutNotes(s, h, exMap).map((x) => x.kind);

describe("workout notes", () => {
  it("lighter than last time", () => {
    const a = session("2026-11-01", [entry([set(50, 11), set(50, 11)])]);
    const b = session("2026-11-08", [entry([set(45, 11), set(45, 11)])]);
    const note = workoutNotes(b, [a, b], exMap).find((x) => x.kind === "drop")!;
    expect(note.text).toContain("45, last time 50");
  });
  it("above the range suggests a heavier weight; below suggests lighter", () => {
    const up = workoutNotes(session("2026-11-08", [entry([set(40, 15), set(40, 15)])]), [], exMap).find((x) => x.kind === "above")!;
    expect(up.text).toMatch(/Try \d+ next time/);
    expect(workoutNotes(session("2026-11-08", [entry([set(60, 7), set(60, 7)])]), [], exMap).find((x) => x.kind === "below")!.text).toMatch(/^You got 7 reps at 60 on every set, but the plan says 10–12\. Try \d+ next time\.$/);
    expect(kinds(session("2026-11-08", [entry([set(50, 11), set(50, 10)])]), [])).toEqual([]);
  });
  it("short rests from the set times", () => {
    const s = session("2026-11-08", [entry([set(50, 11, "working", "2026-11-08T10:00:00Z"), set(50, 11, "working", "2026-11-08T10:01:00Z"), set(50, 11, "working", "2026-11-08T10:02:00Z")])]);
    expect(kinds(s, [])).toContain("rest");
  });
  it("skips weight notes on a deload, and compares volume with the same day", () => {
    const a = session("2026-11-01", [entry([set(50, 11), set(50, 11)])]);
    expect(kinds(session("2026-11-08", [entry([set(40, 11)])], { deload: true }), [a])).not.toContain("drop");
    const b = session("2026-11-08", [entry([set(55, 11), set(55, 11)])]);
    expect(workoutNotes(b, [a, b], exMap).find((x) => x.kind === "volume")?.title).toBe("Volume +10%");
  });
  it("weightFor aims at the bottom of the range with 2 reps left", () => {
    expect(weightFor(100, 10, ex)).toBe(70); // 100 / (1 + 12/30) = 71.4 → 70
    expect(weightFor(300, 12, ex)).toBe(200); // 204.5 → round number below: 200, not 200 + 5
    expect(weightFor(40, 10, ex)).toBe(25); // under 40 lb: the exercise's 5 lb step

  });
});

describe("volume object", async () => {
  const { liftedFor } = await import("./lifted");
  it("picks the heaviest object reached and how many", () => {
    expect(liftedFor(100)).toBeNull();
    expect(liftedFor(3600)?.label).toBe("a car");
    expect(liftedFor(30000)?.label).toBe("1.2 school buses");
    expect(liftedFor(90000)?.label).toBe("a jet airliner");
  });
});
