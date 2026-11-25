/// <reference types="node" />
// Step 3a (docs/plans/body-scan.md §10): fit + measure on made-up bodies. Each body is a random MHR shape,
// photographed (as outlines + noisy landmarks) from 12 clock hours; the fit only sees those photos and the height.
// Optimistic by design (MHR fitting MHR outlines): real accuracy is checked against a tape on the phone.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMhr } from "../../../core/body/mhr";
import { measureGeometry } from "../../../core/body/measure";
import { LIMB_PARTS } from "../../../core/body/types";
import { project } from "./camera";
import { FitBody } from "./body";
import { SilhouetteFit } from "./fit";
import { buildGeometry } from "./geometry";
import { edgePoints, rasterize, sample, signedDistance } from "./raster";
import { makeScene } from "./synthetic";

const load = (lod: number) => { const b = readFileSync(`public/mhr/v1/mhr-lod${lod}.bin`); return parseMhr(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const meta = { scannerId: "test", scannerVersion: "0", viewQuality: [] };

describe("outline maths", () => {
  it("signed distance is 0 on the true edge, − inside, + outside", () => {
    const m = { w: 20, h: 20, data: new Uint8Array(400) };
    for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) m.data[y * 20 + x] = 1;
    const sd = signedDistance(m);
    expect(sample(sd, 20, 20, 5, 10)).toBeCloseTo(0, 5); // the left edge of the square
    expect(sample(sd, 20, 20, 7.5, 10)).toBeLessThan(0);
    expect(sample(sd, 20, 20, 2.5, 10)).toBeCloseTo(2.5, 5);
    expect(sample(sd, 20, 20, 9.5, 10)).toBeCloseTo(-4.5, 5);
    expect(edgePoints(m).every(([x, y]) => x === 5 || x === 15 || y === 5 || y === 15)).toBe(true);
  });
  it("projects a point in front of the phone to the image center", () => {
    const out = new Float64Array(2);
    project([0, 100, 0], 1, { yaw: 0, tx: 0, tz: 200 }, { f: 500, cx: 240, cy: 320, h: 100, pitch: 0 }, out);
    expect([out[0], out[1]]).toEqual([240, 320]);
    const tri = new Float64Array([10, 10, 30, 10, 10, 30]);
    expect(rasterize(tri, [0, 1, 2], 40, 40).data.reduce((a, x) => a + x, 0)).toBeGreaterThan(150);
  });
});

describe("silhouette fit on made-up bodies", () => {
  const m = load(2);
  const fb = new FitBody(m);
  const cases: { seed: number; turn: 1 | -1; label: string; pitch?: number; yawNoise?: number; damage?: boolean }[] = [
    { seed: 2, turn: 1, label: "turning one way" },
    { seed: 4, turn: -1 as const, label: "turning the other way, phone tilted 6°, ±10° off each hour", pitch: 0.1, yawNoise: 0.17, damage: false },
    { seed: 5, turn: 1 as const, label: "phone tilted 6°, ±10° off each hour", pitch: 0.1, yawNoise: 0.17, damage: false },
  ];
  for (const { seed, turn, label, pitch, yawNoise, damage } of cases) {
    it(`body ${seed} (${label}; left/right swapped on back views): converges, torso within 1.5 cm, limbs within 2 cm`, () => {
      const sc = makeScene(fb, seed, { turn, swapBack: true, pitch, yawNoise, damage });
      const res = new SilhouetteFit(fb).run({ photos: sc.photos, heightCm: sc.heightCm, camGuess: { f: 0.725 * 640, cx: 240, cy: 320, h: 100, pitch: sc.cam.pitch } });
      expect(res.ok).toBe(true);
      const truth = measureGeometry(buildGeometry(m, fb, sc.truth, meta), "male", sc.heightCm).measurements;
      const got = measureGeometry(buildGeometry(m, fb, res.params, meta), "male", sc.heightCm).measurements;
      for (const k of ["chest", "waistUpper", "waistLower", "hips"] as const) expect(Math.abs(got[k]! - truth[k]!)).toBeLessThanOrEqual(1.5);
      for (const k of LIMB_PARTS) expect(Math.abs(got[k]! - truth[k]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(got.neck! - truth.neck!)).toBeLessThanOrEqual(2.5);
    }, 180_000);
  }
});
