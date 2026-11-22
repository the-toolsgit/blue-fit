import { describe, expect, it } from "vitest";
import { buildFigure, TEMPLATES } from "./templates";
import { figureBox, poseJoints } from "./engine";

// Joints at pose A or B, after the props that pin hands and feet (hold, leg2)
const joints = (spec: any, pose: "A" | "B") => poseJoints(spec, pose === "A" ? 0 : 1).J as any;

describe("movement templates", () => {
  for (const [id, t] of Object.entries(TEMPLATES)) {
    it(`${id}: renders inside the view${t.hold ? " (hold)" : ` and the first move goes ${t.firstMove.dir}`}`, () => {
      const spec = buildFigure(id)!;
      const [x, y, w, h] = figureBox(spec, 0);
      expect(x).toBeGreaterThanOrEqual(-2);
      expect(x + w).toBeLessThanOrEqual(122);
      expect(y).toBeGreaterThanOrEqual(-26);
      expect(y + h).toBeLessThanOrEqual(107);
      if (t.hold) return; // a still hold: only the small brace motion, no first-move direction
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
  it("new variants are picked by the adjustments", () => {
    expect(buildFigure("reverse-fly-bent", { seated: true })).toEqual(buildFigure("reverse-fly-bent-seated"));
    expect(buildFigure("reverse-fly-prone", { bench: "flat" })).toEqual(buildFigure("reverse-fly-prone-flat"));
    expect(buildFigure("cable-crunch", { seated: true })).toEqual(buildFigure("cable-crunch-seated"));
    expect(buildFigure("trunk-rotation", { seated: true })).toEqual(buildFigure("trunk-rotation-seated"));
    expect(buildFigure("neck-flexion", { seated: true })).toEqual(buildFigure("neck-flexion-seated"));
    expect(buildFigure("fly-lying", { equipmentProp: "cable" })!.props!.some((p: any) => p.cable)).toBe(true);
  });
  it("phase 3 variants: incline / decline benches, seated and kneeling forms", () => {
    expect(buildFigure("crunch", { bench: "decline" })).toEqual(buildFigure("crunch-decline"));
    expect(buildFigure("crunch", { bench: "incline" })).toEqual(buildFigure("crunch")); // no incline variant: the template itself
    expect(buildFigure("lateral-raise", { seated: true })).toEqual(buildFigure("lateral-raise-seated"));
    expect(buildFigure("lateral-raise-machine", { seated: true })).toEqual(buildFigure("lateral-raise-machine-seated"));
    expect(buildFigure("fly-cable", { seated: true })).toEqual(buildFigure("fly-cable-seated"));
    expect(buildFigure("overhead-extension-cable", { kneeling: true })).toEqual(buildFigure("overhead-extension-cable-kneeling"));
    expect(buildFigure("press-machine-seated", { equipmentProp: "cable" })!.props!.some((p: any) => p.cable)).toBe(true);
  });
  it("neck templates move only the head", () => {
    for (const id of ["neck-flexion-seated", "neck-extension-seated"]) {
      const s = buildFigure(id)!, a = joints(s, "A"), b = joints(s, "B");
      expect(b.sh).toEqual(a.sh);
      expect(b.head).not.toEqual(a.head);
    }
  });
});

describe("machine drawings", () => {
  it("a cable figure stands its pulley on a tower (or a beam over to one), unless the template says none", () => {
    const pd = buildFigure("pushdown")!.props as any[];
    expect(pd.some((p) => p.line && p.line[0] === 84 && p.line[2] === 84 && p.line[3] === 104)).toBe(true);
    const lat = buildFigure("pulldown")!.props as any[];
    expect(lat.some((p) => p.line && p.line[0] === 100 && p.line[3] === 104)).toBe(true); // column beside the body
    expect(lat.some((p) => p.line && p.line[1] === -22 && p.line[3] === -22)).toBe(true); // beam to the pulley
    expect((buildFigure("kickback-standing")!.props as any[]).filter((p) => p.line).length).toBe(1); // its own post only
  });
  it("hack squat: hips slide down the 45° rail, back on the sled pad, feet on the platform", () => {
    const s = buildFigure("hack-squat")!, a = joints(s, "A"), b = joints(s, "B");
    expect(b.an).toEqual(a.an);
    expect((b.hip[1] - a.hip[1]) / (b.hip[0] - a.hip[0])).toBeCloseTo(1, 1); // 45°
    expect((s.props as any[]).some((p) => p.along)).toBe(true);
  });
});
