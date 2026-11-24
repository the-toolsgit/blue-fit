/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BODY_SHAPES, MODEL_PARAMS, PART_LABELS, parseMhr, poseVertices } from "./mhr";
import ref from "./__fixtures__/mhr-ref.json";

// Reference vertices come from MHR's own PyTorch rig (mhr/_torch_rig.py,
// v1.2.0, no pose correctives) for the mean body and two random made-up
// bodies with random poses (scratch script, see scripts/convert-mhr.py).
const load = (lod: number) => {
  const b = readFileSync(`public/mhr/v1/mhr-lod${lod}.bin`);
  return parseMhr(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};

describe("MHR body model (step 0)", () => {
  for (const lod of [2, 3] as const) {
    it(`LOD ${lod} matches MHR's PyTorch rig within 0.01 cm`, () => {
      const m = load(lod);
      expect(m.paramNames.length).toBe(MODEL_PARAMS);
      expect(m.bodyShapes.length).toBe(BODY_SHAPES * m.vertexCount * 3);
      for (const c of (ref as Record<string, { body: number[]; params: number[]; idx: number[]; verts: number[][] }[]>)[lod]) {
        const v = poseVertices(m, c.body, c.params);
        let worst = 0;
        c.idx.forEach((i, k) => {
          for (let d = 0; d < 3; d++) worst = Math.max(worst, Math.abs(v[i * 3 + d] - c.verts[k][d]));
        });
        expect(worst).toBeLessThan(0.01);
      }
    });
  }

  it("rebuilds the mean body (172.5 cm) and scales it to any height", () => {
    const m = load(3);
    const v = poseVertices(m, [], []);
    let min = Infinity, max = -Infinity;
    for (let i = 1; i < v.length; i += 3) { min = Math.min(min, v[i]); max = Math.max(max, v[i]); }
    expect(max - min).toBeCloseTo(172.54, 1);
    const target = 180; // made-up height
    const s = target / (max - min);
    expect((max - min) * s).toBeCloseTo(target, 6);
  });

  it("labels every vertex with a body part, arms and legs mirrored", () => {
    const m = load(3);
    const count = PART_LABELS.map((_, i) => m.partLabels.filter((p) => p === i).length);
    expect(count.every((n) => n > 0)).toBe(true);
    expect(count[1]).toBe(count[2]); // armL = armR
    expect(count[5]).toBe(count[6]); // legL = legR
  });
});
