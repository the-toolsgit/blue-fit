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

import { figureCenterDx as centerDx, poseFrame as frameAt } from "./engine";
describe("figure centering", () => {
  it("centers the whole drawing over the movement in the 0–120 view", () => {
    const f = { base: { hx: 30, hy: 57 }, A: { ua: 0 }, B: { ua: 90 }, props: [] } as unknown as import("../types").FigureSpec;
    const dx = centerDx(f);
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= 50; i++) { const fr = frameAt(f, i / 50); fr.main.forEach((l) => l.forEach((q) => { lo = Math.min(lo, q[0]); hi = Math.max(hi, q[0]); })); lo = Math.min(lo, fr.head.cx - fr.head.r); hi = Math.max(hi, fr.head.cx + fr.head.r); }
    expect((lo + hi) / 2 + dx).toBeCloseTo(60, 0);
  });
});
