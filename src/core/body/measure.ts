// Turns a scanner's BodyGeometry into tape measurements (docs/plans/body-scan.md §3.4).
// Same rules for every scanner. A tape wraps the convex outline of a cut, so every
// circumference is the perimeter of the cut's convex hull.
import { LIMB_PARTS, type BodyGeometry, type BodyPart, type BodyScan, type LimbPart, type Polygon, type Section, type Sex } from "./types";

/** Bump when a rule below changes: stored geometry is then measured again (remeasure). */
export const MEASURE_VERSION = 1;

/** Convex hull (monotone chain) of points, counter-clockwise, no repeats. */
export function convexHull(points: Polygon): Polygon {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Polygon = [], upper: Polygon = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Tape length around a cut, cm (polygon in mm). */
export function tapeCm(polygon: Polygon): number {
  const h = convexHull(polygon);
  if (h.length < 3) return 0;
  let per = 0;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    per += Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  return per / 10;
}

/**
 * U.S. Navy / Hodgdon–Beckett body fat %, inputs in cm (the formula itself works in inches, log10).
 * Men: waist at the navel and neck. Women: narrowest waist, hips and neck.
 */
export function navyBodyFat(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipsCm?: number): number | undefined {
  const inch = (cm: number) => cm / 2.54;
  const h = inch(heightCm), n = inch(neckCm), w = inch(waistCm);
  if (sex === "male") {
    if (!(w - n > 0) || !(h > 0)) return undefined;
    return plausible(86.010 * Math.log10(w - n) - 70.041 * Math.log10(h) + 36.76);
  }
  if (hipsCm == null) return undefined;
  const x = w + inch(hipsCm) - n;
  if (!(x > 0) || !(h > 0)) return undefined;
  return plausible(163.205 * Math.log10(x) - 97.684 * Math.log10(h) - 78.387);
}
/** Odd inputs give odd numbers: outside 2–60% the formula isn't meaningful, so no result. */
const plausible = (bf: number) => (bf >= 2 && bf <= 60 ? bf : undefined);

const round1 = (x: number) => Math.round(x * 10) / 10;

function sliceAt(g: BodyGeometry, y: number) {
  let best = g.torsoSlices[0];
  for (const s of g.torsoSlices) if (Math.abs(s.yCm - y) < Math.abs(best.yCm - y)) best = s;
  return best && Math.abs(best.yCm - y) <= 1.5 ? best : undefined;
}
function slicesBetween(g: BodyGeometry, lo: number, hi: number) {
  const a = Math.min(lo, hi), b = Math.max(lo, hi);
  return g.torsoSlices.filter((s) => s.yCm >= a && s.yCm <= b);
}
const tapes = (secs: { polygon: Polygon }[]) => secs.map((s) => tapeCm(s.polygon)).filter((t) => t > 0);
const pick = (secs: Section[], from: number, to: number) => secs.filter((s) => s.tCm >= from && s.tCm <= to);

/** Where on each limb its tape goes, as fractions of the bone length (proximal joint = 0). */
const LIMB_RULE: Record<"upperArm" | "forearm" | "thigh" | "calf", { from: number; to: number; take: "mid" | "max" }> = {
  upperArm: { from: 0.5, to: 0.5, take: "mid" }, // mid humerus
  forearm: { from: 0.1, to: 0.6, take: "max" }, // widest, upper forearm
  thigh: { from: 0.1, to: 0.35, take: "max" }, // just below the gluteal fold
  calf: { from: 0.15, to: 0.6, take: "max" }, // widest
};
const LIMB_AXES: Record<LimbPart, [keyof BodyGeometry["axes"], keyof BodyGeometry["axes"]]> = {
  upperArmL: ["shoulderL", "elbowL"], upperArmR: ["shoulderR", "elbowR"], forearmL: ["elbowL", "wristL"], forearmR: ["elbowR", "wristR"],
  thighL: ["hipJointL", "kneeL"], thighR: ["hipJointR", "kneeR"], calfL: ["kneeL", "ankleL"], calfR: ["kneeR", "ankleR"],
};

export interface Measured {
  measurements: Partial<Record<BodyPart, number>>;
  confidence: Partial<Record<BodyPart, number>>;
  bodyFatPct?: number;
  waistToHeight?: number;
}

/** All tape measurements for a scanned body (cm, 1 decimal). */
export function measureGeometry(g: BodyGeometry, sex: Sex, heightCm: number): Measured {
  const m: Partial<Record<BodyPart, number>> = {};
  const L = g.levels;
  const chest = sliceAt(g, L.armpit);
  if (chest) m.chest = tapeCm(chest.polygon);
  const upper = tapes(slicesBetween(g, L.lowestRib, L.hipCrest));
  if (upper.length) m.waistUpper = Math.min(...upper);
  const navel = sliceAt(g, L.navel);
  if (navel) m.waistLower = tapeCm(navel.polygon);
  const hips = tapes(slicesBetween(g, L.hipCrest, L.crotch));
  if (hips.length) m.hips = Math.max(...hips);
  // neck: narrowest cut along the neck (minimal neck girth, just below the larynx); tCm runs along the neck axis.
  // Low cuts flare into the trapezius and the top one reaches the jaw, so the narrowest is the neck itself.
  const neckLen = g.neckSections.length ? Math.max(...g.neckSections.map((s) => s.tCm)) : 0;
  const neck = tapes(pick(g.neckSections, 1, Math.max(1, neckLen * 0.9)));
  if (neck.length) m.neck = Math.min(...neck);
  for (const part of LIMB_PARTS) {
    const secs = g.limbSections.find((l) => l.part === part)?.sections;
    if (!secs?.length) continue;
    const [a, b] = LIMB_AXES[part].map((k) => g.axes[k]);
    const len = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const rule = LIMB_RULE[part.slice(0, -1) as keyof typeof LIMB_RULE];
    if (rule.take === "mid") {
      const t = len * rule.from;
      const s = secs.reduce((p, c) => (Math.abs(c.tCm - t) < Math.abs(p.tCm - t) ? c : p));
      const v = tapeCm(s.polygon);
      if (v > 0) m[part] = v;
    } else {
      const v = tapes(pick(secs, len * rule.from, len * rule.to));
      if (v.length) m[part] = Math.max(...v);
    }
  }
  for (const k of Object.keys(m) as BodyPart[]) m[k] = round1(m[k]!);
  const q = g.viewQuality.length ? g.viewQuality.reduce((s, x) => s + x, 0) / g.viewQuality.length : 1;
  const confidence: Partial<Record<BodyPart, number>> = {};
  for (const k of Object.keys(m) as BodyPart[]) confidence[k] = Math.round(Math.max(0, Math.min(1, q)) * 100) / 100;
  return { measurements: m, confidence, ...bodyStats(sex, heightCm, m) };
}

/** Body fat (Navy) and waist-to-height from measurements (manual or scanned). */
export function bodyStats(sex: Sex, heightCm: number, m: Partial<Record<BodyPart, number>>): { bodyFatPct?: number; waistToHeight?: number } {
  const waist = sex === "male" ? m.waistLower : m.waistUpper;
  const bf = m.neck != null && waist != null ? navyBodyFat(sex, heightCm, m.neck, waist, m.hips) : undefined;
  const wForRatio = m.waistLower ?? m.waistUpper;
  return {
    bodyFatPct: bf != null && Number.isFinite(bf) ? round1(bf) : undefined,
    waistToHeight: wForRatio != null && heightCm > 0 ? Math.round((wForRatio / heightCm) * 1000) / 1000 : undefined,
  };
}

/** Measure again with the current rules when a scan was measured with older ones (keeps trends on one method). */
export function remeasure(scan: BodyScan): BodyScan {
  if (!scan.geometry || scan.measureVersion === MEASURE_VERSION) return scan;
  return { ...scan, ...measureGeometry(scan.geometry, scan.sex, scan.heightCm), measureVersion: MEASURE_VERSION };
}
