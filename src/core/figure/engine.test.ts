import { describe, expect, it } from "vitest";
import { poseFrame, phase } from "./engine";
import { frameToSvg } from "./svg";
import reference from "./reference.fixture.json";
import exercises from "../seed/exercises.json";
import fixes from "../seed/figure-fixes.json";
import type { FigureSpec } from "../types";

describe("figure engine port", () => {
  const byName = new Map(exercises.map((e) => [e.name, e.figure as unknown as FigureSpec | null]));
  // Figures corrected on purpose (seed/figure-fixes.json) no longer match the plan page.
  const fixed = new Set(exercises.filter((e) => e.id in fixes).map((e) => e.name));
  for (const [name, frames] of Object.entries(reference as Record<string, string[]>)) {
    if (fixed.has(name)) continue;
    it(`matches the plan page for ${name}`, () => {
      const spec = byName.get(name);
      expect(spec).toBeTruthy();
      [0, 0.25, 0.5, 0.75, 1].forEach((k, i) => expect(frameToSvg(poseFrame(spec!, k))).toBe(frames[i]));
    });
  }
  it("figure fixes are applied to the seed", () => {
    const seat = exercises.find((e) => e.id === "cable-seated-row")!.figure as unknown as FigureSpec;
    expect(seat.B.t).toBe(0); // upright at the end: "Swinging back isn't" fine
  });
  it("every seeded exercise has a figure", () => {
    expect(exercises.every((e) => e.figure)).toBe(true);
  });
});

describe("phase", () => {
  it("runs A → B → hold → A over 3.2 s", () => {
    expect(phase(0)).toBe(0);
    expect(phase(0.42 * 3200)).toBe(1);
    expect(phase(0.46 * 3200)).toBe(1);
    expect(phase(0.95 * 3200)).toBe(0);
    expect(phase(0.21 * 3200)).toBeCloseTo(0.5, 5);
  });
});
