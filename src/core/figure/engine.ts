// Figure engine: pose spec + progress (0–1) → plain shapes. Pure math, no DOM.
// Faithful port of sidePose / frontPose / drawFig from the plan page.
// Coordinate system: viewBox x 0–120, y −24–107, y grows downward, floor at y = 105.
// Angles are degrees; V(a, L) = [sin a · L, cos a · L], so 0° points straight down, 90° right, 180° up.
import type { FigureSpec } from "../types";

export type Pt = [number, number];
export type LightShape =
  | { kind: "line"; x1: number | string; y1: number | string; x2: number | string; y2: number | string; width?: number }
  | { kind: "cable"; points: Pt[]; anchor: Pt }
  | { kind: "circle"; cx: number; cy: number; r: number }
  /** Solid light curve (a muscle, e.g. the traps squeezing) */
  | { kind: "curve"; points: Pt[]; width?: number };

export interface FigureFrame {
  floor: { x1: number; y1: number; x2: number; y2: number };
  light: LightShape[];
  /** Main body polylines (stroke --fig) */
  main: Pt[][];
  head: { cx: number; cy: number; r: number };
}

type P = Record<string, any>;
type Joints = Record<string, any> & { lines: Pt[][] };

const rad = (d: number) => (d * Math.PI) / 180;
const V = (a: number, L: number): Pt => [Math.sin(rad(a)) * L, Math.cos(rad(a)) * L];
const add = (p: Pt, v: Pt, k = 1): Pt => [p[0] + v[0] * k, p[1] + v[1] * k];

export function sidePose(p: P): Joints {
  const J: any = {};
  if (p.anchor) {
    J.an = [p.ax, 104 - (p.ah || 0)];
    J.kn = add(J.an, V(p.sh, 23), -1);
    J.hip = add(J.kn, V(p.th, 24), -1);
    J.toe = [p.ax + 8, 104];
  } else {
    J.hip = [p.hx, p.hy];
    J.kn = add(J.hip, V(p.th, 24));
    J.an = add(J.kn, V(p.sh, 23));
    J.toe = p.nofoot ? J.an : add(J.an, V(p.sh + 90, 8));
  }
  J.sh = add(add(J.hip, V(180 - p.t, 34)), [p.sb || 0, 0]);
  J.head = add(J.sh, V(180 - p.t, 11));
  J.el = add(J.sh, V(p.ua, 20 * (p.al ?? 1)));
  J.ha = add(J.el, V(p.fa, 18 * (p.fl ?? 1)));
  J.lines = [[J.hip, J.kn, J.an, J.toe], [J.hip, J.sh], [J.sh, J.el, J.ha]];
  return J;
}

export function frontPose(p: P): Joints {
  const J: any = {};
  const tl = p.tl || 0, up = V(180 - tl, 1), perp: Pt = [Math.cos(rad(tl)), Math.sin(rad(tl))];
  const hc: Pt = [p.cx ?? 60, p.hy], shc = add(hc, up, 34), lf = p.lf || 1, la = p.la ?? 6, sa = p.sa ?? la;
  J.head = add(shc, up, 12);
  ([["R", 1], ["L", -1]] as const).forEach(([s, m]) => {
    const hp = add(hc, perp, (p.hw ?? 6) * m), sp = add(add(shc, perp, 11 * m), [0, -(p.shr || 0)]);
    const arm = s === "L" && p.L ? Object.assign({ al: 1, fl: 1 }, p.L) : p;
    const kn = add(hp, V(la * m, 24 * lf)), an = add(kn, V(sa * m, 23)), toe = add(an, [5 * m, 0]);
    const el = add(sp, V(arm.ua * m, 20 * (arm.al ?? 1))), ha = add(el, V(arm.fa * m, 18 * (arm.fl ?? 1)));
    Object.assign(J, { ["kn" + s]: kn, ["an" + s]: an, ["sh" + s]: sp, ["el" + s]: el, ["ha" + s]: ha, ["hip" + s]: hp });
    J.lines = (J.lines || []).concat([[hp, kn, an, toe], [sp, el, ha]]);
  });
  J.lines.push(
    [J.hipL, J.hipR],
    [J.shL, J.shR],
    [add(J.hipL, J.hipR), add(J.shL, J.shR)].map((q) => [q[0] / 2, q[1] / 2]),
    [add(J.shL, J.shR).map((q) => q / 2), add(J.head, up, -7)],
  );
  if (p.rot) {
    // Rotate the whole figure about the floor point, then drop it back so the lower foot touches the floor.
    // Points are shared between lines and joints, so each array is moved exactly once (by identity).
    const c = Math.cos(rad(p.rot)), sn = Math.sin(rad(p.rot)), px = p.cx ?? 60, py = 104, seen = new Set<Pt>();
    const rotp = (q: Pt) => {
      if (seen.has(q)) return;
      seen.add(q);
      const dx = q[0] - px, dy = q[1] - py;
      q[0] = px + dx * c - dy * sn;
      q[1] = py + dx * sn + dy * c;
    };
    const isPt = (v: unknown): v is Pt => Array.isArray(v) && typeof v[0] === "number";
    J.lines.forEach((l: Pt[]) => l.forEach(rotp));
    Object.values(J).forEach((v) => { if (isPt(v)) rotp(v); });
    const drop = Math.max(J.anR[1], J.anL[1]) - 104, moved = new Set<Pt>();
    J.lines.forEach((l: Pt[]) => l.forEach((q) => { if (!moved.has(q)) { moved.add(q); q[1] -= drop; } }));
    Object.values(J).forEach((v) => { if (isPt(v) && !moved.has(v)) { moved.add(v); v[1] -= drop; } });
    J.lines[0][3] = [J.anR[0] + 5, J.anR[1]];
    J.lines[2][3] = [J.anL[0] - 5, J.anL[1]];
  }
  J.ha = J.haR;
  return J;
}

/** Interpolate a spec at progress k (0 = pose A, 1 = pose B) into a frame of plain shapes. */
export function poseFrame(f: FigureSpec, k: number): FigureFrame {
  const p: P = Object.assign({ hx: 60, hy: 57, t: 0, ua: 0, fa: 0, th: 0, sh: 0 }, f.base);
  for (const key of new Set([...Object.keys(f.A), ...Object.keys(f.B)])) {
    const a = f.A[key] ?? p[key], b = f.B[key] ?? p[key];
    p[key] = a + (b - a) * k;
  }
  const J = f.v === "f" ? frontPose(p) : sidePose(p);
  const light: LightShape[] = [];
  for (const o of (f.props || []) as any[]) {
    if (o.line) light.push({ kind: "line", x1: o.line[0], y1: o.line[1], x2: o.line[2], y2: o.line[3] });
    if (o.cable) {
      const t: Pt = o.to === "barmid" ? [(J.haL[0] + J.haR[0]) / 2, (J.haL[1] + J.haR[1]) / 2] : J[o.to];
      light.push({ kind: "cable", points: [o.cable, t], anchor: o.cable });
    }
    if (o.db) {
      const h = J[o.db];
      light.push({ kind: "line", x1: (h[0] - 4).toFixed(1), y1: h[1].toFixed(1), x2: (h[0] + 4).toFixed(1), y2: h[1].toFixed(1), width: 4 });
    }
    if (o.bar) {
      const a = J.haL, b = J.haR;
      light.push({ kind: "line", x1: (a[0] - 7).toFixed(1), y1: a[1].toFixed(1), x2: (b[0] + 7).toFixed(1), y2: b[1].toFixed(1), width: 2.5 });
    }
    if (o.pad) { const h = J[o.pad]; light.push({ kind: "circle", cx: h[0], cy: h[1], r: o.r || 2.6 }); }
    if (o.trap && J.hip && J.sh) {
      // Side view: the traps as a curve on the upper back, from the base of the neck down between the shoulder
      // blades. It bulges out as `tq` goes 0 → 1 (the squeeze), so the work shows, not just the shoulder moving.
      const len = Math.hypot(J.sh[0] - J.hip[0], J.sh[1] - J.hip[1]) || 1;
      const u: Pt = [(J.sh[0] - J.hip[0]) / len, (J.sh[1] - J.hip[1]) / len];
      const back: Pt = [u[1], -u[0]];
      const q = p.tq ?? 0;
      const p0 = add(add(J.sh, u, 6), back, 0.5), p2 = add(add(J.sh, u, -18), back, 0.8);
      const c = add(add(J.sh, u, -5), back, 2 + 9 * q);
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, a1 = (1 - t) * (1 - t), b1 = 2 * (1 - t) * t, c1 = t * t;
        pts.push([a1 * p0[0] + b1 * c[0] + c1 * p2[0], a1 * p0[1] + b1 * c[1] + c1 * p2[1]]);
      }
      light.push({ kind: "curve", points: pts, width: 2 + 2.6 * q });
    }
    if (o.perp) {
      const h = J[o.perp], v = V(o.ang, o.len / 2);
      light.push({ kind: "line", x1: (h[0] - v[0]).toFixed(1), y1: (h[1] - v[1]).toFixed(1), x2: (h[0] + v[0]).toFixed(1), y2: (h[1] + v[1]).toFixed(1), width: 2.5 });
    }
  }
  return { floor: { x1: 0, y1: 105, x2: 120, y2: 105 }, light, main: J.lines, head: { cx: J.head[0], cy: J.head[1], r: 7 } };
}

/** Animation timing (ms): ease A→B, hold at B, ease B→A, hold at A. Default: 3.2 s loop (42 % / 8 % / 42 % / 8 %). */
export interface Timing { ab: number; holdB: number; ba: number; holdA: number }
export const DEFAULT_TIMING: Timing = { ab: 1344, holdB: 256, ba: 1344, holdA: 256 };
export const PHASE_MS = 3200;
export const loopMs = (t: Timing = DEFAULT_TIMING) => t.ab + t.holdB + t.ba + t.holdA;
export function phase(ms: number, t: Timing = DEFAULT_TIMING): number {
  const e = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const x = ms % loopMs(t);
  if (x < t.ab) return e(x / t.ab);
  if (x < t.ab + t.holdB) return 1;
  if (x < t.ab + t.holdB + t.ba) return 1 - e((x - t.ab - t.holdB) / t.ba);
  return 0;
}
