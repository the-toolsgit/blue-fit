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
  /** A muscle drawn as a filled shape in the body color (e.g. the traps squeezing), closed back along the body line */
  | { kind: "curve"; points: Pt[] };

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
    J.toe = [p.ax + 8, 104 - (p.fh || 0)]; // fh: toes raised off the floor (feet on a bench)
  } else {
    J.hip = [p.hx, p.hy];
    J.kn = add(J.hip, V(p.th, 24));
    J.an = add(J.kn, V(p.sh, 23));
    J.toe = p.nofoot ? J.an : add(J.an, V(p.sh + 90, 8));
  }
  J.sh = add(add(J.hip, V(180 - p.t, 34)), [p.sb || 0, 0]);
  // hn: head tilt on the neck (degrees, + = chin forward/down), for neck work where only the head moves
  J.head = add(J.sh, V(180 - p.t - (p.hn || 0), 11));
  J.el = add(J.sh, V(p.ua, 20 * (p.al ?? 1)));
  J.ha = add(J.el, V(p.fa, 18 * (p.fl ?? 1)));
  if (p.pa != null) J.tip = add(J.ha, V(p.pa, p.pl ?? 9));
  J.lines = [[J.hip, J.kn, J.an, J.toe], [J.hip, J.sh], [J.sh, J.el, J.ha]];
  return J;
}

export function frontPose(p: P): Joints {
  const J: any = {};
  const tl = p.tl || 0, up = V(180 - tl, 1), perp: Pt = [Math.cos(rad(tl)), Math.sin(rad(tl))];
  const hc: Pt = [p.cx ?? 60, p.hy], shc = add(hc, up, 34), lf = p.lf || 1, la = p.la ?? 6, sa = p.sa ?? la;
  // hn: head tilt sideways on the neck (degrees), e.g. neck side bends
  const hup = p.hn ? V(180 - tl - p.hn, 1) : up;
  J.head = add(shc, hup, 12);
  ([["R", 1], ["L", -1]] as const).forEach(([s, m]) => {
    const hp = add(hc, perp, (p.hw ?? 6) * m), sp = add(add(shc, perp, 11 * m), [0, -(p.shr || 0)]);
    const arm = s === "L" && p.L ? Object.assign({ al: 1, fl: 1 }, p.L) : p;
    // laL / saL / lfL: the left leg on its own (e.g. a side lunge); the right leg uses la / sa / lf
    const [la1, sa1, lf1] = s === "L" ? [p.laL ?? la, p.saL ?? sa, p.lfL ?? lf] : [la, sa, lf];
    const kn = add(hp, V(la1 * m, 24 * lf1)), an = add(kn, V(sa1 * m, 23)), toe = add(an, [5 * m, 0]);
    const el = add(sp, V(arm.ua * m, 20 * (arm.al ?? 1))), ha = add(el, V(arm.fa * m, 18 * (arm.fl ?? 1)));
    Object.assign(J, { ["kn" + s]: kn, ["an" + s]: an, ["sh" + s]: sp, ["el" + s]: el, ["ha" + s]: ha, ["hip" + s]: hp });
    J.lines = (J.lines || []).concat([[hp, kn, an, toe], [sp, el, ha]]);
  });
  J.lines.push(
    [J.hipL, J.hipR],
    [J.shL, J.shR],
    [add(J.hipL, J.hipR), add(J.shL, J.shR)].map((q) => [q[0] / 2, q[1] / 2]),
    [add(J.shL, J.shR).map((q) => q / 2), add(J.head, hup, -7)],
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
    // lift: raise the turned figure off the floor (e.g. lying on its side, so the lower shoulder stays above it)
    const drop = Math.max(J.anR[1], J.anL[1]) - 104 + (p.lift || 0), moved = new Set<Pt>();
    J.lines.forEach((l: Pt[]) => l.forEach((q) => { if (!moved.has(q)) { moved.add(q); q[1] -= drop; } }));
    Object.values(J).forEach((v) => { if (isPt(v) && !moved.has(v)) { moved.add(v); v[1] -= drop; } });
    J.lines[0][3] = [J.anR[0] + 5, J.anR[1]];
    J.lines[2][3] = [J.anL[0] - 5, J.anL[1]];
  }
  J.ha = J.haR;
  if (p.pa != null) J.tip = add(J.haR, V(p.pa, p.pl ?? 9));
  return J;
}

/** Interpolate a spec at progress k (0 = pose A, 1 = pose B) into a frame of plain shapes. */
const interp = (f: FigureSpec, k: number): P => {
  const p: P = Object.assign({ hx: 60, hy: 57, t: 0, ua: 0, fa: 0, th: 0, sh: 0 }, f.base);
  for (const key of new Set([...Object.keys(f.A), ...Object.keys(f.B)])) {
    const a = f.A[key] ?? p[key], b = f.B[key] ?? p[key];
    p[key] = a + (b - a) * k;
  }
  return p;
};

/** Two-bone reach: from `s` toward target `t` with bones `a` and `b`. Of the two bends, the one whose middle joint
 *  points most along direction `kd` (degrees, as V) wins. Out of reach: the limb points straight at the target. */
export function reach2(s: Pt, t: Pt, a: number, b: number, kd: number): [Pt, Pt] {
  const dx = t[0] - s[0], dy = t[1] - s[1], d = Math.hypot(dx, dy) || 1e-6, u: Pt = [dx / d, dy / d];
  if (d >= a + b) return [add(s, u, a), add(s, u, a + b)];
  const dd = Math.max(d, Math.abs(a - b) + 0.01);
  const A = Math.acos(Math.min(1, Math.max(-1, (a * a + dd * dd - b * b) / (2 * a * dd))));
  const pref = V(kd, 1);
  const cand = [A, -A].map((r): Pt => add(s, [u[0] * Math.cos(r) - u[1] * Math.sin(r), u[0] * Math.sin(r) + u[1] * Math.cos(r)], a));
  const score = (m: Pt) => (m[0] - s[0]) * pref[0] + (m[1] - s[1]) * pref[1];
  return [score(cand[0]) >= score(cand[1]) ? cand[0] : cand[1], [t[0], t[1]]];
}

/** The joints of a spec at progress k, after the props that pin limbs to points:
 *  - `hold`: a hand stays on a point ([x, y]), moves in a straight line ([xA, yA, xB, yB]) or stays on another joint
 *    (e.g. "head", "haR"); `arm` "L" for the left arm (front view), `kd` the elbow's direction (degrees), `straight`
 *    for an unbent arm. E.g. hands on the floor in a push-up, on dip bars, both hands on one handle in a woodchop.
 *  - `leg2`: side view, the other leg from the hip to a foot point (`kd`: the knee's direction, `toe`: the foot's
 *    angle, default 90 = forward), e.g. the back leg of a lunge or the standing leg of a kickback.
 *  - `foot`: side view, the drawn leg itself from the hip to a foot point, or one moving in a line [xA, yA, xB, yB]
 *    (`kd` as leg2; `toe`: the foot's angle, or [A, B] for a foot that turns), so a hip that slides (hack squat sled)
 *    or a foot on a moving sled (leg press) stays on its platform. */
export function poseJoints(f: FigureSpec, k: number): { p: P; J: Joints } {
  const p = interp(f, k);
  const J = f.v === "f" ? frontPose(p) : sidePose(p);
  for (const o of (f.props || []) as any[]) {
    if (o.hold) {
      const s = o.arm === "L" ? "L" : f.v === "f" ? "R" : "";
      const sh: Pt = J["sh" + s], el: Pt = J["el" + s], ha: Pt = J["ha" + s];
      if (!sh || !el || !ha) continue;
      const arm = s === "L" && p.L ? Object.assign({ al: 1, fl: 1 }, p.L) : p;
      const h = o.hold, t: Pt = typeof h === "string" ? J[h] : h.length === 4 ? [h[0] + (h[2] - h[0]) * k, h[1] + (h[3] - h[1]) * k] : h;
      const a = 20 * (arm.al ?? 1), b = 18 * (arm.fl ?? 1);
      // straight: the arm points at the target, drawn shorter when it reaches toward the viewer (front view)
      const [e2, h2] = o.straight ? [add(sh, [t[0] - sh[0], t[1] - sh[1]], a / (a + b)), [t[0], t[1]] as Pt] : reach2(sh, t, a, b, o.kd ?? 0);
      el[0] = e2[0]; el[1] = e2[1]; ha[0] = h2[0]; ha[1] = h2[1];
      if (p.pa != null && (s === "" || s === "R")) J.tip = add(ha, V(p.pa, p.pl ?? 9));
    }
    if (o.foot && f.v !== "f") {
      // foot: a point, or one moving in a line [xA, yA, xB, yB] (e.g. on a sliding sled); toe: an angle or [A, B]
      const ft = o.foot, tgt: Pt = ft.length === 4 ? [ft[0] + (ft[2] - ft[0]) * k, ft[1] + (ft[3] - ft[1]) * k] : ft;
      const ta = Array.isArray(o.toe) ? o.toe[0] + (o.toe[1] - o.toe[0]) * k : o.toe ?? 90;
      const [kn, an] = reach2(J.hip, tgt, 24, 23, o.kd ?? 90), toe = add(an, V(ta, 8));
      // Move the leg's points in place: they are shared with J.lines[0]
      for (const [q, v] of [[J.kn, kn], [J.an, an], [J.toe, toe]] as [Pt, Pt][]) if (q !== J.an || v === an) { q[0] = v[0]; q[1] = v[1]; }
    }
    if (o.leg2 && f.v !== "f") {
      const [kn, an] = reach2(J.hip, o.leg2, 24, 23, o.kd ?? 90);
      J.lines.unshift([J.hip, kn, an, add(an, V(o.toe ?? 90, 8))]);
      J.kn2 = kn; J.an2 = an;
    }
  }
  return { p, J };
}

export function poseFrame(f: FigureSpec, k: number): FigureFrame {
  const { p, J } = poseJoints(f, k);
  const light: LightShape[] = [];
  for (const o of (f.props || []) as any[]) {
    if (o.line) light.push({ kind: "line", x1: o.line[0], y1: o.line[1], x2: o.line[2], y2: o.line[3], ...(o.width ? { width: o.width } : {}) });
    // A straight up/down bar from a joint to height `y` that moves sideways with it, e.g. a pec deck arm hanging
    // from the frame to the handle
    if (o.vline) { const h = J[o.vline]; light.push({ kind: "line", x1: h[0].toFixed(1), y1: h[1].toFixed(1), x2: h[0].toFixed(1), y2: o.y, ...(o.width ? { width: o.width } : {}) }); }
    if (o.cable) {
      const t: Pt = o.to === "barmid" ? [(J.haL[0] + J.haR[0]) / 2, (J.haL[1] + J.haR[1]) / 2] : J[o.to];
      light.push({ kind: "cable", points: [o.cable, t], anchor: o.cable });
    }
    if (o.db) {
      const h = J[o.db];
      light.push({ kind: "line", x1: (h[0] - 4).toFixed(1), y1: h[1].toFixed(1), x2: (h[0] + 4).toFixed(1), y2: h[1].toFixed(1), width: 4 });
    }
    // Front view: a trap (hex) bar in both hands: the front rail from handle to handle, the sleeves out to the sides
    // and a plate on each
    if (o.hex && J.haL && J.haR) {
      const a: Pt = J.haL, b: Pt = J.haR, y = (a[1] + b[1]) / 2, f = (v: number) => v.toFixed(1);
      light.push({ kind: "line", x1: f(a[0]), y1: f(y), x2: f(b[0]), y2: f(y), width: 2.5 });
      light.push({ kind: "line", x1: f(a[0] - 3), y1: f(y), x2: f(a[0] - 17), y2: f(y), width: 2.5 });
      light.push({ kind: "line", x1: f(b[0] + 3), y1: f(y), x2: f(b[0] + 17), y2: f(y), width: 2.5 });
      light.push({ kind: "line", x1: f(a[0] - 11), y1: f(y - 11), x2: f(a[0] - 11), y2: f(y + 11), width: 3.5 });
      light.push({ kind: "line", x1: f(b[0] + 11), y1: f(y - 11), x2: f(b[0] + 11), y2: f(y + 11), width: 3.5 });
    }
    if (o.bar) {
      const a = J.haL, b = J.haR;
      light.push({ kind: "line", x1: (a[0] - 7).toFixed(1), y1: a[1].toFixed(1), x2: (b[0] + 7).toFixed(1), y2: b[1].toFixed(1), width: 2.5 });
    }
    // Side view, running: the other leg and arm, half a stride behind (the pose at 1 − k)
    if (o.run && f.v !== "f") {
      const J2 = sidePose(interp(f, 1 - k));
      J.lines.unshift(J2.lines[0], J2.lines[2]);
    }
    // Side view: the other arm, held still (e.g. holding the machine), drawn like the body: [upper arm, forearm] angles
    if (o.arm2 && J.sh) {
      const el = add(J.sh, V(o.arm2[0], 20)), ha = add(el, V(o.arm2[1], 18));
      J.lines.push([J.sh, el, ha]);
    }
    // A rigid bar from a fixed point to a joint, e.g. a landmine or T-bar pivoting on the floor
    if (o.rod) { const h = J[o.to || "ha"]; light.push({ kind: "line", x1: o.rod[0], y1: o.rod[1], x2: h[0].toFixed(1), y2: h[1].toFixed(1), width: 2.5 }); }
    if (o.pad) { const h = J[o.pad]; light.push({ kind: "circle", cx: h[0] + (o.dx || 0), cy: h[1] + (o.dy || 0), r: o.r || 2.6 }); }
    // A pad or sled that moves with a body segment: a line parallel to joint a → joint b, `off` to the side (+ = behind
    // a side-view torso, i.e. to the left of a → b), stretched `ext` [before a, past b]; e.g. a hack squat's back pad
    if (o.along) {
      const a: Pt = J[o.along[0]], b: Pt = J[o.along[1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], n: Pt = [u[1], -u[0]];
      const [e0, e1] = o.ext ?? [0, 0], off = o.off ?? 0;
      const p1 = add(add(a, u, -e0), n, off), p2 = add(add(b, u, e1), n, off);
      light.push({ kind: "line", x1: p1[0].toFixed(1), y1: p1[1].toFixed(1), x2: p2[0].toFixed(1), y2: p2[1].toFixed(1), width: o.w ?? 3 });
    }
    // A handle held at one end (pa / pl: angle and length from the hand), e.g. a forearm rotation dumbbell
    if (o.tip && J.tip) light.push({ kind: "line", x1: J.ha[0].toFixed(1), y1: J.ha[1].toFixed(1), x2: J.tip[0].toFixed(1), y2: J.tip[1].toFixed(1), width: 3 });
    // A weight hanging straight down from a joint: a solid bar (dumbbell held by one end), or with `plate`, a chain
    // and a plate (e.g. a neck harness)
    if (o.hang) {
      const h = J[o.hang], y2 = h[1] + o.len;
      if (o.plate) {
        light.push({ kind: "line", x1: h[0].toFixed(1), y1: h[1].toFixed(1), x2: h[0].toFixed(1), y2: y2.toFixed(1) });
        light.push({ kind: "line", x1: (h[0] - o.plate / 2).toFixed(1), y1: y2.toFixed(1), x2: (h[0] + o.plate / 2).toFixed(1), y2: y2.toFixed(1), width: 3 });
      } else light.push({ kind: "line", x1: h[0].toFixed(1), y1: h[1].toFixed(1), x2: h[0].toFixed(1), y2: y2.toFixed(1), width: 3.5 });
    }
    if (o.trap && J.hip && J.sh) {
      // Side view: the traps as a small pointed arch under the back of the head, from the neck to the top of the back.
      // It bulges out as `tq` goes 0 → 1 (the squeeze), so the work shows while the chest stays on the pad.
      const len = Math.hypot(J.sh[0] - J.hip[0], J.sh[1] - J.hip[1]) || 1;
      const u: Pt = [(J.sh[0] - J.hip[0]) / len, (J.sh[1] - J.hip[1]) / len];
      const back: Pt = [u[1], -u[0]];
      const q = p.tq ?? 0;
      // Starts where the back line starts (the shoulder point, below the head) and peaks in the middle.
      const p0 = add(J.sh, back, 0.6), p2 = add(add(J.sh, u, -8.5), back, 0.6);
      const peak = add(add(J.sh, u, -4), back, 0.8 + 2 * q);
      // Two outward-bowed halves meeting at the peak: round, with a soft point in the middle (not a triangle).
      const bow = 0.45 + 0.8 * q;
      const half = (a: Pt, b: Pt): Pt[] => {
        const c = add([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], back, bow);
        return [0, 0.25, 0.5, 0.75, 1].map((t) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]] as Pt);
      };
      const pts: Pt[] = [...half(p0, peak), ...half(peak, p2).slice(1)];
      light.push({ kind: "curve", points: pts });
    }
    // A machine lever arm that swings with the hand (front view): from a pivot post at x = `lever[1]` straight across
    // to the top of the handle (`dy` above the hand), e.g. a pec deck's arms. The post hangs from `top` to the lever.
    if (o.lever) {
      const h = J[o.lever[0]], y = h[1] + (o.dy ?? -6), x0 = o.lever[1];
      light.push({ kind: "line", x1: x0, y1: o.top ?? 4, x2: x0, y2: y.toFixed(1), width: 2.5 });
      light.push({ kind: "line", x1: x0, y1: y.toFixed(1), x2: h[0].toFixed(1), y2: y.toFixed(1), width: 2.5 });
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
export const loopMs = (t: Timing = DEFAULT_TIMING) => t.ab + t.holdB + t.ba + t.holdA;
/** Holds longer than this are real "Hold N s" phases (the short turn at an end is 250 ms). */
const REAL_HOLD_MS = 400;
export function phase(ms: number, t: Timing = DEFAULT_TIMING): number {
  const e = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  // Next to a real hold, a gentler ease (60 % linear): the quadratic one creeps so slowly near the end that a
  // 1 s hold looked nearly twice as long. The hold itself stays exactly its length.
  const soft = (u: number) => 0.6 * u + 0.4 * e(u);
  const eAB = t.holdB > REAL_HOLD_MS || t.holdA > REAL_HOLD_MS ? soft : e;
  const x = ms % loopMs(t);
  if (x < t.ab) return eAB(x / t.ab);
  if (x < t.ab + t.holdB) return 1;
  if (x < t.ab + t.holdB + t.ba) return 1 - eAB((x - t.ab - t.holdB) / t.ba);
  return 0;
}

/** Box (viewBox units: x, y, width, height) around everything a figure draws over its whole movement, plus a
 *  margin; the floor line counts only for its height (it stays under the feet). Used to line figures up at an edge
 *  and drop empty space without changing their scale. */
export function figureBox(f: FigureSpec, margin = 4, ks: number[] = [0, 0.25, 0.5, 0.75, 1]): [number, number, number, number] {
  let lo = Infinity, hi = -Infinity, top = Infinity, bot = -Infinity;
  const x = (v: number | string) => { const n = Number(v); if (Number.isFinite(n)) { lo = Math.min(lo, n); hi = Math.max(hi, n); } };
  const y = (v: number | string) => { const n = Number(v); if (Number.isFinite(n)) { top = Math.min(top, n); bot = Math.max(bot, n); } };
  for (const k of ks) {
    const fr = poseFrame(f, k);
    fr.main.forEach((l) => l.forEach((q) => { x(q[0]); y(q[1]); }));
    x(fr.head.cx - fr.head.r); x(fr.head.cx + fr.head.r); y(fr.head.cy - fr.head.r);
    for (const s of fr.light) {
      if (s.kind === "line") { x(s.x1); x(s.x2); y(s.y1); y(s.y2); }
      else if (s.kind === "circle") { x(s.cx - s.r); x(s.cx + s.r); y(s.cy - s.r); y(s.cy + s.r); }
      else s.points.forEach((q) => { x(q[0]); y(q[1]); });
    }
    y(fr.floor.y1);
  }
  if (!Number.isFinite(lo)) return [0, -24, 120, 131];
  return [lo - margin, top - margin, hi - lo + 2 * margin, bot - top + 2 * margin];
}

/** Sideways shift that centers a figure's drawing (body and equipment over the whole movement, or only at progress
 *  `k` for a still figure) in the 0–120 view. */
export function figureCenterDx(f: FigureSpec, k?: number): number {
  const [x0, , w] = figureBox(f, 0, k == null ? undefined : [k]);
  return w > 0 && w < 120 ? 60 - (x0 + w / 2) : 0;
}
