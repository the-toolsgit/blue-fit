import { describe, expect, it } from "vitest";
import { buildFigure, TEMPLATES } from "./templates";
import { figureBox, frontPose, sidePose } from "./engine";

const joints = (spec: any, pose: "A" | "B") => {
  const p = Object.assign({ hx: 60, hy: 57, t: 0, ua: 0, fa: 0, th: 0, sh: 0 }, spec.base, spec[pose]);
  return (spec.v === "f" ? frontPose(p) : sidePose(p)) as any;
};

describe("movement templates", () => {
  for (const [id, t] of Object.entries(TEMPLATES)) {
    it(`${id}: renders inside the view and the first move goes ${t.firstMove.dir}`, () => {
      const spec = buildFigure(id)!;
      const [x, y, w, h] = figureBox(spec, 0);
      expect(x).toBeGreaterThanOrEqual(-2);
      expect(x + w).toBeLessThanOrEqual(122);
      expect(y).toBeGreaterThanOrEqual(-26);
      expect(y + h).toBeLessThanOrEqual(107);
      const key = t.firstMove.joint === "sh" && spec.v === "f" ? "shR" : t.firstMove.joint;
      const a = joints(spec, t.startsAt), b = joints(spec, t.startsAt === "A" ? "B" : "A");
      const [dx, dy] = [b[key][0] - a[key][0], b[key][1] - a[key][1]];
      if (t.firstMove.dir === "up") expect(dy).toBeLessThan(-2);
      if (t.firstMove.dir === "down") expect(dy).toBeGreaterThan(2);
      if (t.firstMove.dir === "toward") expect(dx).toBeLessThan(-2);
      if (t.firstMove.dir === "away") expect(dx).toBeGreaterThan(2);
    });
  }
  it("unknown template gives no figure; adjustments add the right props", () => {
    expect(buildFigure("nope")).toBeNull();
    expect(buildFigure("curl-standing", { equipmentProp: "cable" })!.props!.some((p: any) => p.cable)).toBe(true);
    expect(buildFigure("row-chest-supported", { seated: true })).toEqual(buildFigure("row-chest-supported-seated"));
    expect(buildFigure("curl-incline", { bench: "flat" })).toEqual(buildFigure("curl-incline-flat"));
    expect(buildFigure("curl-standing", { seated: true })!.base.th).toBe(88);
    expect(buildFigure("row-cable")!.props!.some((p: any) => p.cable)).toBe(true);
  });
});
