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
  // Feet must be in (the size comes from the height, head to toe) but only just: with the phone at waist height the
  // feet reach the bottom edge before the body fills the frame, so "closer" waits until the body is under half of it.
  const M = 0.02;
  return {
    top: top > M, bottom: feet.length >= 2 && bottom < 0.995, left: left > M, right: right < 1 - M,
    fill, distance: fill > 0.92 ? "back" : fill < 0.45 ? "closer" : "ok",
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

/** moving: still turning; hold: just stopped; more: standing still short of the hour; turn: standing still without having turned yet. */
export type TurnCue = { kind: "moving"; hour: number } | { kind: "more"; hour: number } | { kind: "hold"; hour: number } | { kind: "turn"; hour: number } | { kind: "tooFar"; hour: number } | { kind: "capture"; hour: number } | { kind: "done" };

/** How much the body moved between two frames (mean 2D shift of shoulders, hips, knees, ankles; share of the frame). */
export function motion(a: Lm[] | null, b: Lm[] | null): number {
  if (!a || !b) return 1;
  const ids = [MP.shoulderL, MP.shoulderR, MP.hipL, MP.hipR, MP.kneeL, MP.kneeR, MP.ankleL, MP.ankleR];
  let s = 0;
  for (const i of ids) s += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return s / ids.length;
}

/**
 * Follows the turn through the 12 hours by counting stops: a photo is taken when the user has clearly moved since
 * the last photo (body travel, or the estimated turn) and then stands still. The pose tracker's angle is too rough
 * to place a photo (sides and back confuse it, and summed small errors drift), so it's only used per step: to see a
 * turn and to catch a step far bigger than one hour. The 3D fit finds each photo's exact turn (within ±34°).
 */
export class TurnTracker {
  hour = 0; // next hour to capture (0 = facing the phone)
  /** Body motion per frame below which the user counts as still (set from the user's own stillness at the start). */
  stillLimit = 0.004;
  /** Body travel since the last photo (share of the frame, summed over moving frames). */
  travel = 0;
  private dir: 1 | -1 | 0 = 0;
  private unwrapped = 0;
  private atLast = 0; // unwrapped angle at the last photo
  private last: number | null = null;
  private steadySince: number | null = null;
  private moveEma = 0;
  private turnEma = 0;
  constructor(private steadyMs = 600, private minTravel = 0.03, private maxStep = 75) {}

  /** Feed one frame's raw angle (0–360) and how much the body moved since the last frame (see `motion`). */
  update(raw: number, now: number, moved = 0): TurnCue {
    if (this.hour >= 12) return { kind: "done" };
    let d = 0;
    if (this.last == null) { this.last = raw; this.unwrapped = raw > 180 ? raw - 360 : raw; this.atLast = this.unwrapped; }
    else {
      d = raw - this.last;
      if (d > 180) d -= 360; if (d < -180) d += 360;
      // ignore jumps a body can't make between two frames (tracker glitches, left/right swaps)
      if (Math.abs(d) < 45) this.unwrapped += d; else d = 0;
      this.last = raw;
    }
    this.moveEma = this.moveEma * 0.7 + moved * 0.3;
    this.turnEma = this.turnEma * 0.7 + Math.abs(d) * 0.3;
    if (moved < 1) this.travel += Math.max(0, moved - this.stillLimit);
    if (this.dir === 0 && this.hour >= 1 && Math.abs(this.unwrapped) > 15) this.dir = this.unwrapped > 0 ? 1 : -1;
    const still = this.moveEma < this.stillLimit && this.turnEma < 1.5;
    if (!still) { this.steadySince = null; return { kind: "moving", hour: this.hour }; }
    this.steadySince ??= now;
    if (now - this.steadySince < this.steadyMs) return { kind: "hold", hour: this.hour };
    const step = this.dir === 0 ? Math.abs(this.unwrapped - this.atLast) : this.dir * (this.unwrapped - this.atLast);
    if (this.hour > 0 && step > this.maxStep) return { kind: "tooFar", hour: this.hour };
    const turned = this.hour === 0 || this.travel >= this.minTravel || step >= 15;
    if (turned) {
      const h = this.hour;
      this.hour++; this.travel = 0; this.atLast = this.unwrapped; this.steadySince = null;
      return { kind: "capture", hour: h };
    }
    return this.travel > this.minTravel / 3 ? { kind: "more", hour: this.hour } : { kind: "turn", hour: this.hour };
  }
  /** Which way the user turned (+1 / −1; 0 = not known yet). */
  get direction() { return this.dir; }
}

/** Phone tilt from gravity (DeviceMotion accelerationIncludingGravity): 90° = upright, 0° = flat. */
export const tiltFromGravity = (g: { y: number | null; z: number | null }) =>
  g.y == null || g.z == null ? null : (Math.atan2(Math.abs(g.y), Math.abs(g.z)) * 180) / Math.PI;
export const tiltOk = (deg: number | null) => deg != null && deg >= 85 && deg <= 95;
/** Camera pitch for the fit (radians, + = looking up) from DeviceOrientation beta (90 = upright; below 90 the screen
 *  tips up, so the front camera looks up). beta follows the W3C axes on iOS and Android, unlike the gravity signs. */
export const pitchFromBeta = (beta: number | null) => (beta == null ? 0 : (Math.max(-30, Math.min(30, 90 - beta)) * Math.PI) / 180);

/** Words for each hour ("Turn to 1 o'clock"). */
export const hourCue = (h: number) => `Turn to ${h} o'clock`;
