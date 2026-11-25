import { describe, expect, it } from "vitest";
import { MP, TurnTracker, motion, bodyAngle, framing, pitchFromBeta, poseCheck, roomCheck, tiltFromGravity, tiltOk, type Lm } from "./guide";

// A made-up standing body in normalized image coords, facing the phone, arms ~20° out.
function body(scale = 0.8, cx = 0.5): Lm[] {
  const lm: Lm[] = Array.from({ length: 33 }, () => ({ x: cx, y: 0.5, visibility: 1 }));
  const top = 0.5 - scale / 2;
  const at = (i: number, dx: number, fy: number) => (lm[i] = { x: cx + dx * scale, y: top + fy * scale, visibility: 1 });
  at(MP.nose, 0, 0.07); at(MP.earL, 0.04, 0.06); at(MP.earR, -0.04, 0.06);
  at(MP.shoulderL, 0.12, 0.18); at(MP.shoulderR, -0.12, 0.18);
  at(MP.elbowL, 0.17, 0.36); at(MP.elbowR, -0.17, 0.36); at(MP.wristL, 0.21, 0.5); at(MP.wristR, -0.21, 0.5);
  at(MP.hipL, 0.07, 0.52); at(MP.hipR, -0.07, 0.52); at(MP.kneeL, 0.08, 0.74); at(MP.kneeR, -0.08, 0.74);
  at(MP.ankleL, 0.08, 0.95); at(MP.ankleR, -0.08, 0.95); at(MP.heelL, 0.08, 0.98); at(MP.heelR, -0.08, 0.98); at(MP.toeL, 0.09, 0.99); at(MP.toeR, -0.09, 0.99);
  return lm;
}

describe("scan guidance", () => {
  it("framing: whole body in, right distance; too close → step back; cut at the bottom; off to the side", () => {
    const f = framing(body(0.78));
    expect(f).toMatchObject({ top: true, bottom: true, left: true, right: true, distance: "ok", centered: true });
    expect(framing(body(0.95)).distance).toBe("back");
    expect(framing(body(1.02)).bottom).toBe(false);
    expect(framing(body(0.5)).distance).toBe("ok");
    expect(framing(body(0.4)).distance).toBe("closer");
    expect(framing(body(0.7, 0.86)).right).toBe(false);
  });
  it("pose: arms a few inches out and feet apart pass; arms against the body or raised don't", () => {
    expect(poseCheck(body()).ok).toBe(true);
    const tight = body(); tight[MP.wristL] = { ...tight[MP.wristL], x: tight[MP.shoulderL].x + 0.005 };
    expect(poseCheck(tight).say).toMatch(/away from your body/);
    const up = body(); up[MP.wristR] = { ...up[MP.wristR], y: 0.05 };
    expect(poseCheck(up).ok).toBe(false);
    const feet = body(); feet[MP.ankleL] = { ...feet[MP.ankleL], x: 0.5 }; feet[MP.ankleR] = { ...feet[MP.ankleR], x: 0.5 };
    expect(poseCheck(feet).say).toMatch(/hip-width/);
  });
  it("room: dark, backlit, legs in shadow, busy wall, low contrast, good", () => {
    const good = { bodyMean: 130, bgMean: 150, upperMean: 135, lowerMean: 120, bgEdges: 0.03, contrast: 40 };
    expect(roomCheck(good).ok).toBe(true);
    expect(roomCheck({ ...good, bodyMean: 40 }).say).toMatch(/too dark/);
    expect(roomCheck({ ...good, bgMean: 230 }).say).toMatch(/behind you/);
    expect(roomCheck({ ...good, lowerMean: 50 }).say).toMatch(/shadow/);
    expect(roomCheck({ ...good, bgEdges: 0.3 }).kind).toBe("background");
    expect(roomCheck({ ...good, contrast: 5 }).say).toMatch(/blends/);
  });
  it("body angle: facing 0°, side ±90°, back 180°", () => {
    const w = (lx: number, lz: number): Lm[] => {
      const a: Lm[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
      a[MP.shoulderL] = { x: lx, y: 0, z: lz }; a[MP.shoulderR] = { x: -lx, y: 0, z: -lz };
      a[MP.hipL] = { x: lx * 0.7, y: 0, z: lz * 0.7 }; a[MP.hipR] = { x: -lx * 0.7, y: 0, z: -lz * 0.7 };
      return a;
    };
    expect(bodyAngle(w(0.2, 0))).toBeCloseTo(0, 5);
    expect(bodyAngle(w(0, 0.2))).toBeCloseTo(90, 5);
    expect(bodyAngle(w(-0.2, 0))).toBeCloseTo(180, 5);
  });
  it("turn tracker: a photo per cue once the user has moved and stands still, whatever the angle reads", () => {
    const t = new TurnTracker(300, 2000);
    let now = 0;
    const seen: number[] = [];
    const feed = (ms: number, moved: number, angle = 0) => { for (let k = 0; k < ms; k += 50) { const c = t.update(angle, (now += 50), moved); if (c.kind === "capture") seen.push(c.hour); } };
    for (let h = 0; h < 12; h++) { feed(1500, 0.02, (h * 50) % 360); feed(1200, 0, (h * 50) % 360); }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it("turn tracker: no photo right after the cue, none without moving, none while moving", () => {
    const t = new TurnTracker(300, 2500);
    let now = 0;
    const kinds = (ms: number, moved: number, angle = 0) => { const out: string[] = []; for (let k = 0; k < ms; k += 50) out.push(t.update(angle, (now += 50), moved).kind); return out; };
    expect(kinds(500, 0)).toContain("capture"); // 12 o'clock
    expect(kinds(4000, 0, 90)).not.toContain("capture"); // the angle jumps but the body didn't move (under the 6 s give-up)
    expect(kinds(300, 0.02)).not.toContain("capture"); // a quick move
    expect(kinds(400, 0)).not.toContain("capture"); // still, but only ~0.7 s since the cue... and the 2.5 s aren't up
    expect(kinds(4000, 0.02)).not.toContain("capture"); // moving all the time
    expect(kinds(1000, 0)).toContain("capture"); // moved, time is up, now still
  });
  it("turn tracker: a slow turn (tiny motion per frame) counts once the body has shifted; stuck → photo anyway after 6 s", () => {
    const t = new TurnTracker(300, 2500, 6000);
    let now = 0;
    const kinds = (ms: number, moved: number, shift = 0) => { const out: string[] = []; for (let k = 0; k < ms; k += 50) out.push(t.update(0, (now += 50), moved, shift).kind); return out; };
    expect(kinds(500, 0)).toContain("capture");
    expect(kinds(2000, 0.002, 0.04)).not.toContain("capture"); // turning slowly: below the still limit per frame, but shifted
    expect(kinds(1000, 0)).toContain("capture"); // then still → photo
    expect(kinds(5000, 0)).not.toContain("capture"); // didn't move
    expect(kinds(1500, 0)).toContain("capture"); // 6 s up: photo anyway
  });
  it("tilt from gravity: upright 90°, flat 0°, green 85–95°", () => {
    expect(tiltFromGravity({ y: -9.81, z: 0 })).toBeCloseTo(90);
    expect(tiltFromGravity({ y: 0, z: -9.81 })).toBeCloseTo(0);
    expect(tiltOk(87)).toBe(true);
    expect(tiltOk(80)).toBe(false);
  });
  it("motion: 0 when nothing moved, grows with the shift", () => {
    const a = body(), b = body(0.8, 0.52);
    expect(motion(a, a)).toBe(0);
    expect(motion(a, b)).toBeCloseTo(0.02, 5);
  });
  it("pitch from beta: upright 0, screen tipped up 5° → +5°, unknown → 0", () => {
    expect(pitchFromBeta(90)).toBeCloseTo(0);
    expect(pitchFromBeta(85)).toBeCloseTo((5 * Math.PI) / 180);
    expect(pitchFromBeta(95)).toBeCloseTo((-5 * Math.PI) / 180);
    expect(pitchFromBeta(null)).toBe(0);
  });
});
