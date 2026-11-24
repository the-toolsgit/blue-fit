import { describe, expect, it } from "vitest";
import { MEASURE_VERSION, bodyStats, convexHull, measureGeometry, navyBodyFat, remeasure, tapeCm } from "./measure";
import { AXIS_KEYS, LIMB_PARTS, type BodyGeometry, type BodyScan, type Polygon } from "./types";

// Made-up bodies only.
const ellipse = (a: number, b: number, n = 180): Polygon =>
  Array.from({ length: n }, (_, i) => [Math.round(a * Math.cos((2 * Math.PI * i) / n)), Math.round(b * Math.sin((2 * Math.PI * i) / n))] as [number, number]);
const ellipsePerimeter = (a: number, b: number) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); // Ramanujan

describe("tape (convex hull perimeter)", () => {
  it("a circle of radius 15 cm is 94.2 cm (whole-mm points cost < 1 mm at real cut sizes)", () => {
    for (const n of [40, 60, 90]) expect(Math.abs(tapeCm(ellipse(150, 150, n)) - 2 * Math.PI * 15)).toBeLessThan(0.12);
  });
  it("bridges dents like a real tape (a C shape measures like its hull)", () => {
    const c: Polygon = [[0, 0], [100, 0], [100, 20], [20, 20], [20, 80], [100, 80], [100, 100], [0, 100]];
    expect(convexHull(c)).toHaveLength(4);
    expect(tapeCm(c)).toBeCloseTo(40, 6);
  });
});

describe("Navy body fat (Hodgdon–Beckett)", () => {
  // Worked by hand from the published formula (inches, log10).
  it("man 70 in, neck 15 in, waist 34 in → 17.5%", () => {
    expect(navyBodyFat("male", 70 * 2.54, 15 * 2.54, 34 * 2.54)).toBeCloseTo(17.51, 1);
  });
  it("woman 65 in, neck 13 in, waist 28 in, hips 38 in → 25.9%", () => {
    expect(navyBodyFat("female", 65 * 2.54, 13 * 2.54, 28 * 2.54, 38 * 2.54)).toBeCloseTo(25.93, 1);
  });
  it("no result when the numbers can't work (waist ≤ neck, women without hips)", () => {
    expect(navyBodyFat("male", 180, 40, 38)).toBeUndefined();
    expect(navyBodyFat("female", 165, 33, 71)).toBeUndefined();
  });
  it("men use the lower (navel) waist, women the upper (narrowest) waist + hips", () => {
    const m = { neck: 40, waistUpper: 80, waistLower: 95, hips: 100 };
    expect(bodyStats("male", 180, m).bodyFatPct).toBeCloseTo(navyBodyFat("male", 180, 40, 95)!, 1);
    expect(bodyStats("female", 180, m).bodyFatPct).toBeCloseTo(navyBodyFat("female", 180, 40, 80, 100)!, 1);
    expect(bodyStats("male", 180, m).waistToHeight).toBeCloseTo(95 / 180, 3);
  });
});

// A made-up "body": ellipse slices whose size is known at every height.
function fakeGeometry(): BodyGeometry {
  const torsoSlices = [];
  for (let y = 80; y <= 145; y++) {
    // waist narrowest at y=105 (a=140 mm), hips widest at 92, chest 130
    const a = y < 92 ? 170 : y < 105 ? 170 - (y - 92) * 2.3 : y < 130 ? 140 + (y - 105) * 1.6 : 180;
    torsoSlices.push({ yCm: y, polygon: ellipse(a, 110) });
  }
  const axes = Object.fromEntries(AXIS_KEYS.map((k) => [k, [0, 0, 0]])) as BodyGeometry["axes"];
  axes.shoulderL = [20, 140, 0]; axes.elbowL = [20, 110, 0]; axes.wristL = [20, 85, 0];
  axes.shoulderR = [-20, 140, 0]; axes.elbowR = [-20, 110, 0]; axes.wristR = [-20, 85, 0];
  axes.hipJointL = [9, 90, 0]; axes.kneeL = [9, 48, 0]; axes.ankleL = [9, 8, 0];
  axes.hipJointR = [-9, 90, 0]; axes.kneeR = [-9, 48, 0]; axes.ankleR = [-9, 8, 0];
  const limbSections = LIMB_PARTS.map((part) => ({
    part,
    sections: Array.from({ length: 30 }, (_, t) => ({ tCm: t, polygon: ellipse(part.startsWith("upperArm") ? 55 : part.startsWith("forearm") ? 45 - Math.abs(t - 6) : part.startsWith("thigh") ? 95 - t : 60 - Math.abs(t - 12), 50) })),
  }));
  return {
    torsoSlices, limbSections,
    neckSections: Array.from({ length: 10 }, (_, t) => ({ tCm: t, polygon: ellipse(65 - (t === 3 ? 4 : 0), 60) })),
    levels: { neckBase: 147, neckTop: 157, armpit: 135, lowestRib: 115, navel: 100, hipCrest: 98, buttocksMax: 90, crotch: 82, kneeMid: 48 },
    axes, viewQuality: Array(12).fill(0.9), scannerId: "test", scannerVersion: "0",
  };
}

describe("measureGeometry (made-up body)", () => {
  const g = fakeGeometry();
  const r = measureGeometry(g, "male", 180);
  it("finds each tape where the rules put it", () => {
    expect(r.measurements.chest).toBeCloseTo(ellipsePerimeter(18, 11), 0);
    expect(r.measurements.waistUpper).toBeCloseTo(ellipsePerimeter(14, 11), 0); // narrowest between rib and hip crest
    expect(r.measurements.hips).toBeCloseTo(ellipsePerimeter(17, 11), 0); // widest hip crest → crotch
    expect(r.measurements.neck).toBeCloseTo(ellipsePerimeter(6.1, 6), 0); // narrowest neck cut
    expect(r.measurements.upperArmL).toBeCloseTo(ellipsePerimeter(5.5, 5), 0);
    expect(r.measurements.forearmR).toBeCloseTo(ellipsePerimeter(4.5, 5), 0);
    expect(r.measurements.thighL).toBeCloseTo(ellipsePerimeter(9.0, 5), 0); // widest at 10% below the hip joint (t≈4)
    expect(r.measurements.calfR).toBeCloseTo(ellipsePerimeter(6, 5), 0);
  });
  it("adds body fat, waist-to-height and confidence", () => {
    expect(r.bodyFatPct).toBeGreaterThan(0);
    expect(r.waistToHeight).toBeGreaterThan(0.3);
    expect(r.confidence.chest).toBe(0.9);
  });
  it("measures old scans again with the current rules", () => {
    const old: BodyScan = { id: "s", date: "2026-11-24T08:00", source: "web-camera", scannerVersion: "0", measureVersion: 0, heightCm: 180, sex: "male", geometry: g, measurements: { chest: 1 }, confidence: {} };
    const r2 = remeasure(old);
    expect(r2.measureVersion).toBe(MEASURE_VERSION);
    expect(r2.measurements.chest).toBe(r.measurements.chest);
    const manual: BodyScan = { ...old, geometry: undefined };
    expect(remeasure(manual)).toBe(manual);
  });
});
