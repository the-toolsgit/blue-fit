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

import { frontPose, sidePose } from "./engine";
describe("engine additions (phase 3)", () => {
  const base = { hx: 60, hy: 57, t: 0, ua: 0, fa: 0, th: 0, sh: 0 };
  it("hn tilts only the head on the neck", () => {
    const a = sidePose({ ...base }), b = sidePose({ ...base, hn: 40 });
    expect(b.sh).toEqual(a.sh);
    expect(b.head[0]).toBeGreaterThan(a.head[0] + 5); // chin forward
    expect(Math.hypot(b.head[0] - b.sh[0], b.head[1] - b.sh[1])).toBeCloseTo(11, 5);
  });
  it("pa / pl put a handle tip on the hand that turns, and the tip prop draws it", () => {
    const J = sidePose({ ...base, pa: 180, pl: 10 });
    expect(J.tip[0]).toBeCloseTo(J.ha[0], 5);
    expect(J.tip[1]).toBeCloseTo(J.ha[1] - 10, 5);
    const f = frontPose({ ...base, pa: 90, pl: 10 });
    expect(f.tip[0]).toBeCloseTo(f.haR[0] + 10, 5);
    const fr = poseFrame({ base: { pl: 10 }, A: { pa: 90 }, B: { pa: 180 }, props: [{ tip: 1 }] } as unknown as FigureSpec, 1);
    expect(fr.light.some((s) => s.kind === "line" && s.width === 3)).toBe(true);
  });
  it("laL / saL / lfL move the left leg on its own", () => {
    const a = frontPose({ ...base, la: 6 }), b = frontPose({ ...base, la: 6, laL: 40 });
    expect(b.anR).toEqual(a.anR);
    expect(b.anL[0]).toBeLessThan(a.anL[0] - 5);
  });
  it("lift raises a turned figure; fh raises the toes of an anchored one", () => {
    const a = frontPose({ ...base, rot: -90, cx: 100 }), b = frontPose({ ...base, rot: -90, cx: 100, lift: 5 });
    expect(b.head[1]).toBeCloseTo(a.head[1] - 5, 5);
    expect(sidePose({ ...base, anchor: 1, ax: 100, ah: 20, fh: 18 }).toe[1]).toBe(86);
  });
  it("hang draws a weight under a joint; pad dy shifts the pad down", () => {
    const f = { base: {}, A: {}, B: {}, props: [{ hang: "ha", len: 10 }, { hang: "head", len: 20, plate: 8 }, { pad: "sh", r: 9, dy: 9 }] } as unknown as FigureSpec;
    const fr = poseFrame(f, 0), J = sidePose({ ...base });
    expect(fr.light[0]).toMatchObject({ kind: "line", y2: (J.ha[1] + 10).toFixed(1), width: 3.5 });
    expect(fr.light.filter((s) => s.kind === "line").length).toBe(3);
    expect(fr.light.find((s) => s.kind === "circle")).toMatchObject({ cy: J.sh[1] + 9, r: 9 });
  });
});

import { poseJoints, reach2 } from "./engine";
describe("engine additions (figure review): limbs pinned to points", () => {
  it("reach2 keeps both bone lengths and lands on the target, bending toward kd", () => {
    const [el, ha] = reach2([0, 0], [20, 20], 20, 18, 90);
    expect(Math.hypot(el[0], el[1])).toBeCloseTo(20, 5);
    expect(Math.hypot(ha[0] - el[0], ha[1] - el[1])).toBeCloseTo(18, 5);
    expect(ha).toEqual([20, 20]);
    expect(el[0]).toBeGreaterThan(reach2([0, 0], [20, 20], 20, 18, 270)[0][0]);
  });
  it("hold keeps a hand on a point (or moving in a line) at every frame; leg2 draws the other leg; rod draws a bar", () => {
    const spec = { base: { anchor: 1, ax: 102 }, A: { th: 60, sh: 60, t: -60 }, B: { th: 75, sh: 75, t: -75 }, props: [{ hold: [32, 103], kd: 135 }, { leg2: [40, 104] }, { rod: [0, 104], to: "ha" }] } as unknown as FigureSpec;
    for (const k of [0.3, 0.7, 1]) expect(poseJoints(spec, k).J.ha).toEqual([32, 103]); // (at 0 it is just out of reach: straight arm)
    const fr = poseFrame(spec, 0.5);
    expect(fr.main.length).toBe(4); // the second leg is added
    expect(fr.light.some((s) => s.kind === "line" && s.width === 2.5 && s.x2 === "32.0")).toBe(true);
    const moving = { v: "f", base: {}, A: {}, B: {}, props: [{ hold: [80, 10, 50, 50], kd: 90 }, { hold: "haR", arm: "L", straight: 1 }] } as unknown as FigureSpec;
    const m = poseJoints(moving, 0.5).J;
    expect(m.haR).toEqual([65, 30]);
    expect(m.haL).toEqual([65, 30]);
  });
});
