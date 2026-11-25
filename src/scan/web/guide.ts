// Live scan guidance (docs/plans/body-scan.md §3.1): framing, distance, pose, light, background and the
// 12-hour turn. Pure functions on pose landmarks (MediaPipe's 33, normalized 0–1 image coords, not mirrored)
// and simple image statistics, so they're testable without a camera.

export interface Lm { x: number; y: number; z?: number; visibility?: number }

// MediaPipe pose landmark indices
export const MP = { nose: 0, earL: 7, earR: 8, shoulderL: 11, shoulderR: 12, elbowL: 13, elbowR: 14, wristL: 15, wristR: 16, hipL: 23, hipR: 24, kneeL: 25, kneeR: 26, ankleL: 27, ankleR: 28, heelL: 29, heelR: 30, toeL: 31, toeR: 32 } as const;

export interface Framing {
  /** Per side: is the body clear of that edge? */
  top: boolean; bottom: boolean; left: boolean; right: boolean;
  /** Body height as a share of the frame height (head top to feet) */
  fill: number;
  distance: "ok" | "closer" | "back";
  centered: boolean;
}

const vis = (p: Lm | undefined) => !!p && (p.visibility ?? 1) > 0.5;

/** Where the body sits in the frame. Head top is estimated above the nose (a head is ~1.1 × nose→shoulder line). */
export function framing(lm: Lm[]): Framing {
  const nose = lm[MP.nose], sl = lm[MP.shoulderL], sr = lm[MP.shoulderR];
  const shoulderY = (sl.y + sr.y) / 2;
  const top = nose.y - Math.max(0.02, (shoulderY - nose.y) * 1.1);
  const feet = [MP.heelL, MP.heelR, MP.toeL, MP.toeR, MP.ankleL, MP.ankleR].map((i) => lm[i]).filter(vis);
  const bottom = feet.length ? Math.max(...feet.map((p) => p.y)) + 0.01 : 1.5;
  const xs = lm.filter(vis).map((p) => p.x);
  const left = Math.min(...xs) - 0.03, right = Math.max(...xs) + 0.03;
  const fill = bottom - top;
  const M = 0.02;
  return {
    top: top > M, bottom: feet.length >= 2 && bottom < 1 - M, left: left > M, right: right < 1 - M,
    fill, distance: fill > 0.9 ? "back" : fill < 0.62 ? "closer" : "ok",
    centered: Math.abs((left + right) / 2 - 0.5) < 0.12,
  };
}

/** The scan pose: arms straight and a few inches out (10–35° from the body), feet about hip-width apart. */
export function poseCheck(lm: Lm[]): { ok: boolean; say?: string } {
  const ang = (s: Lm, w: Lm) => (Math.atan2(Math.abs(w.x - s.x), w.y - s.y) * 180) / Math.PI;
  const aL = ang(lm[MP.shoulderL], lm[MP.wristL]), aR = ang(lm[MP.shoulderR], lm[MP.wristR]);
  if (lm[MP.wristL].y < lm[MP.shoulderL].y || lm[MP.wristR].y < lm[MP.shoulderR].y) return { ok: false, say: "Lower your arms, a few inches away from your sides" };
  if (aL < 8 || aR < 8) return { ok: false, say: "Move your arms a little away from your body" };
  if (aL > 40 || aR > 40) return { ok: false, say: "Lower your arms a little" };
  const hipW = Math.abs(lm[MP.hipL].x - lm[MP.hipR].x), ankleW = Math.abs(lm[MP.ankleL].x - lm[MP.ankleR].x);
  if (ankleW < hipW * 0.6) return { ok: false, say: "Stand with your feet hip-width apart" };
  return { ok: true };
}

/** Luminance statistics the worker measures on a small frame with the person mask (0–255). */
export interface RoomStats { bodyMean: number; bgMean: number; upperMean: number; lowerMean: number; bgEdges: number; contrast: number }

/** Light and background, with the fix to say. First problem wins. */
export function roomCheck(r: RoomStats): { ok: boolean; say?: string; kind?: "light" | "background" } {
  if (r.bodyMean < 55) return { ok: false, kind: "light", say: "It's too dark. Turn on more lights" };
  if (r.bgMean - r.bodyMean > 70) return { ok: false, kind: "light", say: "There's bright light behind you. Turn so it's not behind you" };
  if (r.lowerMean < r.upperMean * 0.55) return { ok: false, kind: "light", say: "Your legs are in shadow. Add light lower down" };
  if (r.bgEdges > 0.12) return { ok: false, kind: "background", say: "Too busy behind you. Stand in front of a plain wall" };
  if (r.contrast < 18) return { ok: false, kind: "background", say: "Your outline blends into the wall. Try a different wall or clothes" };
  return { ok: true };
}

/**
 * Body turn angle from MediaPipe world landmarks (metres, x right in the image, z away from the camera):
 * 0° facing the phone, growing as the user turns. The shoulder and hip lines give the angle; their depth tells
 * front from back. `dir` is the turning direction learned from the first clear move (+1 / −1).
 */
export function bodyAngle(world: Lm[]): number {
  const v = (a: number, b: number) => [world[a].x - world[b].x, (world[a].z ?? 0) - (world[b].z ?? 0)];
  const [sx, sz] = v(MP.shoulderL, MP.shoulderR), [hx, hz] = v(MP.hipL, MP.hipR);
  // facing the phone (not mirrored): the user's left shoulder is on the image's right → x_L − x_R > 0, z equal
  const deg = (Math.atan2(sz + hz, sx + hx) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export type TurnCue = { kind: "hold" } | { kind: "turn"; hour: number } | { kind: "tooFar"; hour: number } | { kind: "capture"; hour: number } | { kind: "done" };

/** Follows the turn through the 12 hours: clockwise only, captures when steady at each hour. */
export class TurnTracker {
  hour = 0; // next hour to capture (0 = facing the phone)
  private dir: 1 | -1 | 0 = 0;
  private unwrapped = 0;
  private last: number | null = null;
  private steadySince: number | null = null;
  constructor(private steadyMs = 600, private tol = 12) {}

  /** Feed one frame's raw angle (0–360). Returns what to do now. */
  update(raw: number, now: number): TurnCue {
    if (this.hour >= 12) return { kind: "done" };
    if (this.last == null) { this.last = raw; this.unwrapped = raw > 180 ? raw - 360 : raw; }
    else {
      let d = raw - this.last;
      if (d > 180) d -= 360; if (d < -180) d += 360;
      // ignore jumps a body can't make between two frames (tracker glitches)
      if (Math.abs(d) < 45) this.unwrapped += d;
      this.last = raw;
    }
    if (this.dir === 0 && this.hour >= 1 && Math.abs(this.unwrapped) > 15) this.dir = this.unwrapped > 0 ? 1 : -1;
    const progress = this.dir === 0 ? Math.abs(this.unwrapped) : this.dir * this.unwrapped;
    const target = this.hour * 30;
    if (progress > target + this.tol + 8) { this.steadySince = null; return { kind: "tooFar", hour: this.hour }; }
    if (Math.abs(progress - target) <= this.tol) {
      this.steadySince ??= now;
      if (now - this.steadySince >= this.steadyMs) { const h = this.hour; this.hour++; this.steadySince = null; return { kind: "capture", hour: h }; }
      return { kind: "hold" };
    }
    this.steadySince = null;
    return { kind: "turn", hour: this.hour };
  }
  /** Which way the user turned (+1 / −1; 0 = not known yet). */
  get direction() { return this.dir; }
}

/** Phone tilt from gravity (DeviceMotion accelerationIncludingGravity): 90° = upright, 0° = flat. */
export const tiltFromGravity = (g: { y: number | null; z: number | null }) =>
  g.y == null || g.z == null ? null : (Math.atan2(Math.abs(g.y), Math.abs(g.z)) * 180) / Math.PI;
export const tiltOk = (deg: number | null) => deg != null && deg >= 85 && deg <= 95;

/** Words for each hour ("Turn to 1 o'clock"). */
export const hourCue = (h: number) => `Turn to ${h} o'clock`;
