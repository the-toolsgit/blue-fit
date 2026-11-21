// Movement templates for the exercise database (docs/plans/exercise-database.md §3): one figure per movement, built
// with the figure engine, plus a pure builder that adds an exercise's adjustments and equipment. Pose A is always where
// the tempo's first move starts (startsAt "A"), so the animation follows the tempo text. Pure and framework-free.
import type { FigureSpec } from "../types";

export interface Template {
  spec: FigureSpec;
  /** Pose the tempo's first move starts from */
  startsAt: "A" | "B";
  /** What the hands (or hips) do on the first move, checked by tests: "down" = moves down the screen, etc. */
  firstMove: { joint: "ha" | "hip" | "sh" | "haR"; dir: "up" | "down" | "toward" | "away" };
  /** Default equipment prop */
  prop: "cable" | "bar" | "db" | "none";
  /** Where a cable comes from (pulley), when the prop is a cable */
  pulley?: [number, number];
}

const T = (spec: FigureSpec, firstMove: Template["firstMove"], prop: Template["prop"], pulley?: [number, number]): Template => ({ spec, startsAt: "A", firstMove, prop, pulley });

export const TEMPLATES: Record<string, Template> = {
  // ── Back: lats ──
  pulldown: T({ v: "f", base: { hy: 70, lf: 0.5 }, A: { ua: 155, fa: 165 }, B: { ua: 45, fa: 170 }, props: [{ line: [44, 72, 76, 72] }, { line: [42, 80, 78, 80] }] }, { joint: "haR", dir: "down" }, "cable", [60, -22]),
  "pulldown-single": T({ base: { hx: 52, hy: 78, t: 5, th: 0, sh: -90, nofoot: 1 }, A: { ua: 170, fa: 172 }, B: { ua: -15, fa: 160 }, props: [] }, { joint: "ha", dir: "down" }, "cable", [62, -22]),
  pullup: T({ v: "f", base: { lf: 1, la: 4, sa: 2 }, A: { hy: 56, ua: 165, fa: 170 }, B: { hy: 28, ua: 60, fa: 175 }, props: [{ line: [22, -15, 98, -15] }] }, { joint: "sh", dir: "up" }, "none"),
  // Kneeling straight-arm pulldown (lat prayer)
  "straight-arm-pulldown-kneeling": T({ base: { hx: 50, hy: 78, t: 30, th: 0, sh: -90, nofoot: 1 }, A: { ua: 150, fa: 150 }, B: { ua: 20, fa: 20 }, props: [] }, { joint: "ha", dir: "down" }, "cable", [112, -20]),
  "straight-arm-pulldown": T({ base: { hx: 50, hy: 57, t: 30, th: 5, sh: -3 }, A: { ua: 150, fa: 150 }, B: { ua: 5, fa: 5 }, props: [] }, { joint: "ha", dir: "down" }, "cable", [112, -20]),
  pullover: T({ base: { hx: 78, hy: 76, t: -88, th: 100, sh: 0, ua: -95 }, A: { ua: -180, fa: -180 }, B: { ua: -95, fa: -95 }, props: [{ line: [36, 80, 86, 80] }, { line: [52, 80, 52, 104] }] }, { joint: "ha", dir: "down" }, "db"),
  // Seated machine pullover: arms from overhead down to the body
  "pullover-machine": T({ base: { hx: 50, hy: 80, t: 0, th: 88, sh: 0 }, A: { ua: 168, fa: 160 }, B: { ua: 15, fa: 40 }, props: [{ line: [38, 84, 62, 84] }, { line: [50, 84, 50, 104] }, { line: [44, 82, 44, 40] }] }, { joint: "ha", dir: "down" }, "none"),
  // ── Back: rows ──
  "row-cable": T({ base: { hx: 40, hy: 88, th: 85, sh: 85 }, A: { t: 15, ua: 85, fa: 88 }, B: { t: 0, ua: -40, fa: 85 }, props: [{ line: [20, 92, 50, 92] }, { line: [93, 70, 93, 95] }] }, { joint: "ha", dir: "toward" }, "cable", [118, 72]),
  "row-bent-barbell": T({ base: { hx: 46, hy: 58, t: 62, th: 14, sh: -8 }, A: { ua: 0, fa: 0 }, B: { ua: -65, fa: -5 }, props: [] }, { joint: "ha", dir: "up" }, "bar"),
  "row-tbar": T({ base: { hx: 48, hy: 58, t: 50, th: 12, sh: -8 }, A: { ua: 0, fa: 0 }, B: { ua: -60, fa: -5 }, props: [{ line: [56, 62, 80, 42] }] }, { joint: "ha", dir: "up" }, "db"),
  "row-db-one-arm": T({ base: { hx: 40, hy: 56, t: 80, th: 8, sh: 0 }, A: { ua: 0, fa: 0 }, B: { ua: -75, fa: 0 }, props: [{ line: [78, 92, 112, 92] }, { line: [108, 92, 108, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  // Seated chest-supported machine row: chest on the pad, feet on the floor
  "row-chest-supported-seated": T({ base: { hx: 44, hy: 80, t: 30, th: 88, sh: 0 }, A: { ua: 70, fa: 75 }, B: { ua: -45, fa: 70 }, props: [{ line: [32, 84, 56, 84] }, { line: [44, 84, 44, 104] }, { line: [70, 40, 70, 78] }] }, { joint: "ha", dir: "toward" }, "none"),
  // Seal row: lying face down on a flat bench, arms hanging
  "row-chest-supported-flat": T({ base: { hx: 68, hy: 62, t: -90, th: 90, sh: 90, nofoot: 1 }, A: { ua: 0, fa: 0 }, B: { ua: -60, fa: 20 }, props: [{ line: [20, 66, 100, 66] }, { line: [36, 66, 36, 104] }, { line: [88, 66, 88, 104] }] }, { joint: "ha", dir: "up" }, "bar"),
  // Standing one-arm cable row (split stance)
  "row-cable-standing": T({ base: { t: 8 }, A: { ua: 82, fa: 86 }, B: { ua: -40, fa: 86 }, props: [] }, { joint: "ha", dir: "toward" }, "cable", [116, 62]),
  // Plank row (renegade): straight body from the feet, hands on dumbbells under the shoulders, one arm rows
  "row-plank": T({ base: { anchor: 1, ax: 100, th: 62, sh: 62, t: -62 }, A: { ua: 0, fa: 0 }, B: { ua: 135, fa: 0 }, props: [] }, { joint: "ha", dir: "up" }, "db"),
  "row-chest-supported": T({ base: { hx: 44, hy: 57, t: 45, th: 10, sh: -6 }, A: { ua: 5, fa: 5 }, B: { ua: -60, fa: 15 }, props: [{ line: [54, 61, 76, 39] }, { line: [58, 61, 58, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  // Straight body from the heels (fixed on the floor) to the head; hands stay on the bar
  "row-inverted": T({ base: { anchor: 1, ax: 102 }, A: { th: 80, sh: 80, t: -80, ua: 180, fa: 180 }, B: { th: 62, sh: 62, t: -62, ua: 150, fa: 280 }, props: [{ line: [12, 51, 34, 51] }] }, { joint: "sh", dir: "up" }, "none"),
  // ── Back: lower back and hinges ──
  "back-extension": T({ base: { hx: 46, hy: 56, th: -45, sh: -45 }, A: { t: 158, ua: 202, fa: 22 }, B: { t: 45, ua: 315, fa: 135 }, props: [{ pad: "hip", r: 3 }, { line: [12, 96, 44, 64] }, { line: [28, 80, 28, 104] }] }, { joint: "sh", dir: "up" }, "none"),
  hinge: T({ base: { anchor: 1, ax: 60 }, A: { th: 0, sh: 0, t: 0, ua: 0, fa: 0 }, B: { th: 20, sh: -8, t: 75, ua: 0, fa: 0 }, props: [] }, { joint: "ha", dir: "down" }, "bar"),
  deadlift: T({ base: { anchor: 1, ax: 60 }, A: { th: 62, sh: -28, t: 58, ua: 0, fa: 0 }, B: { th: 0, sh: 0, t: 0, ua: 0, fa: 0 }, props: [] }, { joint: "ha", dir: "up" }, "bar"),
  shrug: T({ v: "f", base: { ua: 4, fa: 4 }, A: { shr: 0 }, B: { shr: 7 }, props: [] }, { joint: "haR", dir: "up" }, "bar"),
  // ── Biceps ──
  "curl-standing": T({ base: { ua: 0 }, A: { fa: 0 }, B: { fa: 145 }, props: [] }, { joint: "ha", dir: "up" }, "db", [84, 100]),
  "curl-hammer": T({ base: { ua: 0 }, A: { fa: 0 }, B: { fa: 145 }, props: [] }, { joint: "ha", dir: "up" }, "db", [84, 100]),
  "curl-cable-standing": T({ base: { ua: 0, t: -4 }, A: { fa: 10 }, B: { fa: 145 }, props: [] }, { joint: "ha", dir: "up" }, "cable", [84, 100]),
  "curl-incline": T({ base: { hx: 52, hy: 80, t: -35, th: 88, sh: 0, ua: -5 }, A: { fa: -5 }, B: { fa: 140 }, props: [{ line: [49, 85, 28, 55] }, { line: [48, 84, 70, 85] }, { line: [58, 85, 58, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  "curl-bayesian": T({ base: { t: 6, ua: -28 }, A: { fa: -28 }, B: { fa: 115 }, props: [] }, { joint: "ha", dir: "up" }, "cable", [16, 84]),
  "curl-preacher": T({ base: { hx: 45, hy: 78, t: 12, th: 88, sh: 0, ua: 45 }, A: { fa: 60 }, B: { fa: 165 }, props: [{ line: [54, 53, 70, 68] }, { line: [66, 68, 66, 104] }] }, { joint: "ha", dir: "up" }, "db", [100, 100]),
  "curl-spider": T({ base: { hx: 44, hy: 58, t: 48, th: 20, sh: -10, ua: 0 }, A: { fa: 0 }, B: { fa: 140 }, props: [{ line: [52, 62, 74, 38] }, { line: [56, 62, 56, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  "curl-concentration": T({ base: { hx: 44, hy: 78, t: 38, th: 88, sh: 0, ua: 14 }, A: { fa: 14 }, B: { fa: 150 }, props: [{ line: [30, 82, 52, 82] }, { line: [40, 82, 40, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  // Lying, head toward a high pulley, arms pointing up; curls the bar toward the forehead
  "curl-lying-high-pulley": T({ base: { hx: 70, hy: 98, t: -90, th: 90, sh: 90, nofoot: 1, ua: 180 }, A: { fa: 200 }, B: { fa: 300 }, props: [] }, { joint: "ha", dir: "toward" }, "cable", [8, -10]),
  // Lying on a flat bench, arms hanging toward the floor (lying supine curl)
  "curl-incline-flat": T({ base: { hx: 70, hy: 64, t: -90, th: 120, sh: 0, ua: 0 }, A: { fa: 0 }, B: { fa: -140 }, props: [{ line: [28, 68, 86, 68] }, { line: [44, 68, 44, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  "curl-lying-cable": T({ base: { hx: 52, hy: 96, t: 90, th: -90, sh: -90, nofoot: 1, ua: 180 }, A: { fa: 215 }, B: { fa: 100 }, props: [] }, { joint: "ha", dir: "away" }, "cable", [8, 98]),
  "curl-overhead-cable": T({ base: { ua: 88 }, A: { fa: 88 }, B: { fa: 190 }, props: [] }, { joint: "ha", dir: "up" }, "cable", [116, 20]),
  "curl-drag": T({ base: {}, A: { ua: 0, fa: 0 }, B: { ua: -48, fa: 120 }, props: [] }, { joint: "ha", dir: "up" }, "bar"),
};

export interface FigureAdjust {
  grip?: "wide" | "close" | "neutral" | "underhand";
  oneArm?: boolean;
  seated?: boolean;
  kneeling?: boolean;
  bench?: "flat" | "incline" | "decline";
  equipmentProp?: "cable" | "bar" | "db" | "none";
}

/** Template + an exercise's adjustments → the figure the app draws. Unknown template: null. */
export function buildFigure(templateId: string, adj: FigureAdjust = {}): FigureSpec | null {
  // Variants: "<template>-seated", "-kneeling", "-flat" when the adjustment asks for one and it exists
  const variant = adj.seated ? "-seated" : adj.kneeling ? "-kneeling" : adj.bench === "flat" ? "-flat" : "";
  if (variant && TEMPLATES[templateId + variant]) return buildFigure(templateId + variant, { ...adj, seated: false, kneeling: false, bench: undefined });
  const t = TEMPLATES[templateId];
  if (!t) return null;
  const spec: FigureSpec = JSON.parse(JSON.stringify(t.spec));
  const props = (spec.props ?? []) as any[];
  const side = spec.v !== "f";
  // Standing side-view figures can sit (on a bench) or kneel
  const standing = side && (spec.base as any).anchor == null && (spec.base as any).th == null && (spec.base as any).hx == null;
  if (standing && adj.seated) { Object.assign(spec.base, { hx: 50, hy: 80, th: 88, sh: 0 }); props.push({ line: [38, 84, 62, 84] }, { line: [50, 84, 50, 104] }); }
  else if (standing && adj.kneeling) Object.assign(spec.base, { hx: 52, hy: 78, th: 0, sh: -90, nofoot: 1 });
  // Front view: close grip brings the hands in
  if (!side && adj.grip === "close") { for (const k of ["A", "B"] as const) if ((spec as any)[k].ua != null) (spec as any)[k].ua = Math.max(20, (spec as any)[k].ua - 25); }
  // Equipment prop
  const prop = adj.equipmentProp ?? t.prop;
  if (prop === "db") props.push({ db: side ? "ha" : "haR" });
  else if (prop === "bar") props.push(side ? { pad: "ha", r: 3 } : { bar: 1 });
  else if (prop === "cable" && t.pulley) props.push({ cable: t.pulley, to: side ? "ha" : "barmid" });
  if (!side && prop === "cable" && t.pulley) props.push({ bar: 1 });
  spec.props = props;
  return spec;
}
