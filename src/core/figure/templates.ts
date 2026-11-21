// Movement templates for the exercise database (docs/plans/exercise-database.md §3): one figure per movement, built
// with the figure engine, plus a pure builder that adds an exercise's adjustments and equipment. Pose A is always where
// the tempo's first move starts (startsAt "A"), so the animation follows the tempo text. Pure and framework-free.
import type { FigureSpec } from "../types";

export interface Template {
  spec: FigureSpec;
  /** Pose the tempo's first move starts from */
  startsAt: "A" | "B";
  /** What the hands (or hips) do on the first move, checked by tests: "down" = moves down the screen, etc. */
  firstMove: { joint: "ha" | "hip" | "sh" | "haR" | "an" | "knR" | "head" | "tip"; dir: "up" | "down" | "toward" | "away" };
  /** Default equipment prop */
  prop: "cable" | "bar" | "db" | "none";
  /** Where a cable comes from (pulley), when the prop is a cable */
  pulley?: [number, number];
  /** A static hold (tempo "Hold N s"): A and B differ only by a small brace/breathing motion, so firstMove isn't checked */
  hold?: boolean;
}

const T = (spec: FigureSpec, firstMove: Template["firstMove"], prop: Template["prop"], pulley?: [number, number]): Template => ({ spec, startsAt: "A", firstMove, prop, pulley });
const H = (spec: FigureSpec, prop: Template["prop"]): Template => ({ spec, startsAt: "A", firstMove: { joint: "sh", dir: "up" }, prop, hold: true });

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

  // ── Shoulders and traps ──
  "press-overhead": T({ v: "f", base: { hy: 66, lf: 0.45, la: 12, sa: 4 }, A: { ua: 90, fa: 180 }, B: { ua: 160, fa: 175 }, props: [{ line: [44, 68, 76, 68] }, { db: "haR" }, { db: "haL" }] }, { joint: "haR", dir: "up" }, "none"),
  "press-overhead-standing": T({ v: "f", base: {}, A: { ua: 90, fa: 180 }, B: { ua: 160, fa: 175 }, props: [] }, { joint: "haR", dir: "up" }, "bar"),
  "lateral-raise": T({ v: "f", base: {}, A: { ua: 8, fa: 8 }, B: { ua: 88, fa: 90 }, props: [{ db: "haR" }, { db: "haL" }] }, { joint: "haR", dir: "up" }, "none"),
  "lateral-raise-full": T({ v: "f", base: {}, A: { ua: 8, fa: 8 }, B: { ua: 165, fa: 165 }, props: [{ db: "haR" }, { db: "haL" }] }, { joint: "haR", dir: "up" }, "none"),
  "lateral-raise-cable": T({ v: "f", base: { L: { ua: 72, fa: 80 }, cx: 53, rot: 14, la: 0, sa: 0, hw: 1.5 }, A: { ua: -30, fa: -32 }, B: { ua: 90, fa: 92 }, props: [{ line: [19, -14, 19, 104] }, { line: [13, 104, 27, 104] }, { cable: [19, 96], to: "haR" }] }, { joint: "haR", dir: "up" }, "none"),
  "lateral-raise-lean-away": T({ v: "f", base: { cx: 36, la: 0, sa: 0, hw: 1.5, rot: 20, L: { ua: 22, fa: 22 } }, A: { ua: -10, fa: -10 }, B: { ua: 98, fa: 98 }, props: [{ line: [28, -14, 28, 104] }, { line: [22, 104, 36, 104] }, { cable: [28, 96], to: "haR" }] }, { joint: "haR", dir: "up" }, "none"),
  "front-raise": T({ base: { ua: 0 }, A: { ua: 0, fa: 0 }, B: { ua: 95, fa: 95 }, props: [] }, { joint: "ha", dir: "up" }, "db", [86, 100]),
  "upright-row": T({ v: "f", base: {}, A: { ua: 6, fa: 6 }, B: { ua: 100, fa: 250 }, props: [] }, { joint: "haR", dir: "up" }, "bar"),
  "reverse-fly-machine": T({ v: "f", base: { hy: 66, lf: 0.45, la: 12, sa: 4, ua: 90, fa: 90 }, A: { al: 0.2, fl: 0.2 }, B: { al: 1, fl: 1 }, props: [{ line: [44, 68, 76, 68] }, { db: "haR" }, { db: "haL" }] }, { joint: "haR", dir: "away" }, "none"),
  "reverse-fly-cable": T({ v: "f", base: { L: { ua: 4, fa: 4 }, ua: 90, fa: 90 }, A: { al: -0.55, fl: -0.55 }, B: { al: 1, fl: 1 }, props: [{ cable: [12, 24], to: "haR" }] }, { joint: "haR", dir: "away" }, "none"),
  "reverse-fly-bent": T({ base: { hx: 46, hy: 58, t: 70, th: 14, sh: -8 }, A: { ua: 0, fa: 0 }, B: { ua: -80, fa: -80 }, props: [] }, { joint: "ha", dir: "up" }, "db"),
  "face-pull": T({ base: { hx: 48, th: 4, sh: -3 }, A: { t: 0, ua: 95, fa: 95, al: 1, fl: 1 }, B: { t: 0, ua: 92, al: 0.3, fa: 168, fl: 0.75 }, props: [{ line: [110, -16, 110, 104] }, { line: [100, 104, 116, 104] }, { line: [104, -16, 110, -16] }, { cable: [106, 16], to: "ha" }] }, { joint: "ha", dir: "toward" }, "none"),
  "kelso-shrug": T({ base: { hx: 46, hy: 59, t: 42, th: 10, sh: -6, ua: 35, fa: 35 }, A: { sb: 0, tq: 0, al: 1 }, B: { sb: 0, tq: 1, al: 0.8 }, props: [{ line: [56, 63, 78, 41] }, { trap: true }] }, { joint: "ha", dir: "toward" }, "db"),
  "y-raise": T({ v: "f", base: { L: { ua: 4, fa: 4 } }, A: { ua: 15, fa: 15 }, B: { ua: 155, fa: 155 }, props: [{ cable: [34, 104], to: "haR" }] }, { joint: "haR", dir: "up" }, "none"),
  "shrug-db": T({ v: "f", base: {}, A: { ua: 6, fa: 6, shr: 0 }, B: { ua: 6, fa: 6, shr: 7 }, props: [{ db: "haR" }, { db: "haL" }] }, { joint: "haR", dir: "up" }, "none"),
  // ── Chest ──
  "press-flat": T({ base: { hx: 70, hy: 76, t: -90, th: 100, sh: 0 }, A: { ua: 180, fa: 180 }, B: { ua: 20, fa: 172 }, props: [{ line: [28, 80, 82, 80] }, { line: [44, 80, 44, 104] }] }, { joint: "ha", dir: "down" }, "bar"),
  "press-incline": T({ base: { hx: 66, hy: 80, t: -55, th: 88, sh: 0 }, A: { ua: 150, fa: 150 }, B: { ua: 10, fa: 150 }, props: [{ line: [64, 86, 34, 64] }, { line: [62, 84, 82, 84] }, { line: [66, 86, 66, 104] }] }, { joint: "ha", dir: "down" }, "bar"),
  "press-decline": T({ base: { hx: 50, hy: 64, t: -110, th: 60, sh: 0 }, A: { ua: 185, fa: 185 }, B: { ua: 30, fa: 190 }, props: [{ line: [16, 80, 62, 66] }, { line: [36, 74, 36, 104] }] }, { joint: "ha", dir: "down" }, "bar"),
  "press-machine-seated": T({ base: { hx: 48, hy: 80, t: 0, th: 88, sh: 0 }, A: { ua: -50, fa: 92 }, B: { ua: 90, fa: 90 }, props: [{ line: [36, 84, 60, 84] }, { line: [48, 84, 48, 104] }, { line: [44, 82, 44, 40] }] }, { joint: "ha", dir: "away" }, "none", [12, 46]),
  fly: T({ v: "f", base: {}, A: { ua: 92, fa: 92 }, B: { ua: 35, fa: -15 }, props: [{ db: "haR" }, { db: "haL" }] }, { joint: "haR", dir: "toward" }, "none"),
  "fly-cable": T({ v: "f", base: {}, A: { ua: 120, fa: 115 }, B: { ua: 30, fa: -20 }, props: [{ cable: [112, -12], to: "haR" }] }, { joint: "haR", dir: "toward" }, "none"),
  pushup: T({ base: { anchor: 1, ax: 102 }, A: { th: 60, sh: 60, t: -60, ua: 0, fa: 0 }, B: { th: 75, sh: 75, t: -75, ua: 100, fa: 322 }, props: [] }, { joint: "sh", dir: "down" }, "none"),
  "dip-machine": T({ base: { hx: 50, hy: 78, t: 0, th: 88, sh: 0 }, A: { ua: -55, fa: 28 }, B: { ua: -3, fa: 3 }, props: [{ line: [38, 81, 64, 81] }, { db: "ha" }] }, { joint: "ha", dir: "down" }, "none"),
  dip: T({ base: { th: 20, sh: -40 }, A: { hy: 48, t: 10, ua: 0, fa: 0 }, B: { hy: 60, t: 25, ua: -60, fa: 15 }, props: [{ line: [40, 88, 70, 88] }] }, { joint: "sh", dir: "down" }, "none"),
  // ── Triceps ──
  pushdown: T({ base: { hx: 55, hy: 57, t: 12, th: 4, sh: -2, ua: -5 }, A: { fa: 115 }, B: { fa: 2 }, props: [] }, { joint: "ha", dir: "down" }, "cable", [84, -22]),
  "overhead-extension-cable": T({ base: { hx: 52, hy: 57, t: 22, th: 8, sh: -4, ua: 155 }, A: { fa: 305 }, B: { fa: 155 }, props: [] }, { joint: "ha", dir: "up" }, "cable", [4, 100]),
  "overhead-extension-db": T({ base: { hx: 50, hy: 80, t: 0, th: 88, sh: 0, ua: 172 }, A: { fa: 330 }, B: { fa: 172 }, props: [{ line: [38, 84, 62, 84] }, { line: [50, 84, 50, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  skullcrusher: T({ base: { hx: 70, hy: 76, t: -90, th: 100, sh: 0, ua: 195 }, A: { fa: 195 }, B: { fa: 320 }, props: [{ line: [28, 80, 82, 80] }, { line: [44, 80, 44, 104] }] }, { joint: "ha", dir: "down" }, "bar", [6, 96]),
  "skullcrusher-incline": T({ base: { hx: 58, hy: 78, t: -55, th: 80, sh: 0, ua: 200 }, A: { fa: 200 }, B: { fa: 350 }, props: [{ line: [56, 84, 26, 64] }, { line: [52, 82, 72, 82] }] }, { joint: "ha", dir: "down" }, "bar"),
  "kickback-standing": T({ base: { hx: 66, hy: 58, t: -12, th: 12, sh: 12, ua: -15 }, A: { fa: 80 }, B: { fa: -15 }, props: [{ line: [94, -14, 94, 104] }, { arm2: [106, 106] }] }, { joint: "ha", dir: "toward" }, "cable", [92, -8]),
  "kickback-bent": T({ base: { hx: 46, hy: 58, t: 70, th: 14, sh: -8, ua: -80 }, A: { fa: 0 }, B: { fa: -80 }, props: [] }, { joint: "ha", dir: "toward" }, "db", [100, 100]),
  // ── Quads ──
  squat: T({ base: { anchor: 1, ax: 60, ua: -25, fa: 150 }, A: { th: 0, sh: 0, t: 8 }, B: { th: 82, sh: -32, t: 38 }, props: [{ pad: "sh", r: 3 }] }, { joint: "hip", dir: "down" }, "none"),
  "squat-smith": T({ base: { anchor: 1, ax: 60, ua: -25, fa: 150 }, A: { th: 0, sh: 0, t: 8 }, B: { th: 82, sh: -32, t: 38 }, props: [{ line: [67, -18, 67, 104] }, { pad: "sh", r: 3 }] }, { joint: "hip", dir: "down" }, "none"),
  "squat-front": T({ base: { anchor: 1, ax: 60, ua: 25, fa: 165 }, A: { th: 0, sh: 0, t: 4 }, B: { th: 88, sh: -36, t: 22 }, props: [] }, { joint: "hip", dir: "down" }, "db"),
  "hack-squat": T({ base: { anchor: 1, ax: 64, ua: 0, fa: 160 }, A: { th: 0, sh: 4, t: -18 }, B: { th: 90, sh: -40, t: -8 }, props: [{ line: [40, -6, 30, 60] }] }, { joint: "hip", dir: "down" }, "none"),
  "leg-press": T({ base: { hx: 40, hy: 80, t: -45, ua: 20, fa: 40 }, A: { th: 125, sh: 128 }, B: { th: 168, sh: 78 }, props: [{ line: [44, 85, 18, 59] }, { perp: "an", ang: 40, len: 20 }] }, { joint: "an", dir: "toward" }, "none"),
  lunge: T({ base: { anchor: 1, ax: 72 }, A: { th: -14, sh: 0, t: 0 }, B: { th: 80, sh: -12, t: 4 }, props: [] }, { joint: "hip", dir: "down" }, "db"),
  "split-squat": T({ base: { anchor: 1, ax: 74 }, A: { th: -10, sh: 0, t: 2 }, B: { th: 80, sh: -10, t: 8 }, props: [{ line: [10, 78, 36, 78] }, { line: [22, 78, 22, 104] }] }, { joint: "hip", dir: "down" }, "db"),
  "step-up": T({ base: { anchor: 1, ax: 70, ah: 22 }, A: { th: 80, sh: -20, t: 20 }, B: { th: 0, sh: 0, t: 0 }, props: [{ line: [56, 82, 90, 82] }, { line: [56, 82, 56, 104] }, { line: [90, 82, 90, 104] }] }, { joint: "hip", dir: "up" }, "db"),
  "leg-extension": T({ base: { hx: 45, hy: 72, t: -50, th: 90, ua: 40, fa: 60 }, A: { sh: 0 }, B: { sh: 85 }, props: [{ line: [36, 75, 70, 75] }, { line: [40, 77, 13, 55] }, { line: [52, 75, 52, 104] }, { pad: "an" }] }, { joint: "an", dir: "up" }, "none"),
  // ── Hamstrings ──
  "leg-curl-lying": T({ base: { hx: 58, hy: 70, t: 90, th: -90, ua: 10, fa: 80 }, A: { sh: -90 }, B: { sh: -175 }, props: [{ line: [8, 75, 106, 75] }, { line: [30, 75, 30, 104] }, { line: [90, 75, 90, 104] }, { pad: "an" }] }, { joint: "an", dir: "up" }, "none"),
  "leg-curl-seated": T({ base: { hx: 45, hy: 72, t: 15, th: 90, ua: 20, fa: 40 }, A: { sh: 85 }, B: { sh: -15 }, props: [{ line: [36, 75, 66, 75] }, { line: [50, 67, 70, 67] }, { line: [52, 75, 52, 104] }, { pad: "an" }] }, { joint: "an", dir: "toward" }, "none"),
  nordic: T({ base: { sh: -90, nofoot: 1, ua: 20, fa: 120 }, A: { hx: 42, hy: 78, th: 0, t: 0 }, B: { hx: 62.8, hy: 90, th: -60, t: 60 }, props: [{ line: [18, 104, 30, 104] }] }, { joint: "sh", dir: "down" }, "none"),
  "good-morning": T({ base: { anchor: 1, ax: 60, ua: -25, fa: 150 }, A: { th: 0, sh: 0, t: 0 }, B: { th: 16, sh: -6, t: 78 }, props: [{ pad: "sh", r: 3 }] }, { joint: "sh", dir: "down" }, "none"),
  // ── Glutes ──
  "hip-thrust": T({ base: { anchor: 1, ax: 90, sh: -10, ua: 45, fa: 110 }, A: { th: 150, t: -50 }, B: { th: 100, t: -72 }, props: [{ line: [22, 74, 44, 74] }, { line: [32, 74, 32, 104] }] }, { joint: "hip", dir: "up" }, "bar"),
  "glute-bridge": T({ base: { anchor: 1, ax: 90, sh: -10, ua: -90, fa: -90 }, A: { th: 150, t: -90 }, B: { th: 100, t: -116 }, props: [] }, { joint: "hip", dir: "up" }, "none"),
  "hip-abduction": T({ v: "f", base: { hy: 66, lf: 0.5, ua: 20, fa: 20 }, A: { la: 6, sa: 4 }, B: { la: 40, sa: 10 }, props: [{ line: [44, 68, 76, 68] }, { pad: "knR" }, { pad: "knL" }] }, { joint: "knR", dir: "away" }, "none"),
  "hip-adduction": T({ v: "f", base: { hy: 66, lf: 0.5, ua: 20, fa: 20 }, A: { la: 40, sa: 10 }, B: { la: 6, sa: 4 }, props: [{ line: [44, 68, 76, 68] }, { pad: "knR" }, { pad: "knL" }] }, { joint: "knR", dir: "toward" }, "none"),
  "kickback-glute": T({ base: { hx: 60, hy: 57, t: 22, ua: 30, fa: 30 }, A: { th: 0, sh: 0 }, B: { th: -45, sh: -35 }, props: [] }, { joint: "an", dir: "toward" }, "cable", [104, 100]),
  // ── Calves ──
  "calf-raise-standing": T({ base: { anchor: 1, ax: 60 }, A: { ah: 7 }, B: { ah: 0 }, props: [{ pad: "sh", r: 3 }] }, { joint: "hip", dir: "down" }, "none"),
  "calf-raise-seated": T({ base: { anchor: 1, ax: 70, th: 90, sh: 0, t: 0, ua: 20, fa: 60 }, A: { ah: 6 }, B: { ah: 0 }, props: [{ pad: "kn", r: 3 }] }, { joint: "hip", dir: "down" }, "none"),
  // ── Abs ──
  crunch: T({ base: { hx: 62, hy: 98, th: 140, sh: 0, ua: 150, fa: 230 }, A: { t: -92 }, B: { t: -55 }, props: [] }, { joint: "sh", dir: "up" }, "none"),
  "cable-crunch": T({ base: { hx: 52, hy: 78, th: 0, sh: -90, nofoot: 1, ua: 170, fa: 300 }, A: { t: 10 }, B: { t: 75 }, props: [] }, { joint: "sh", dir: "down" }, "cable", [96, -20]),
  "leg-raise-hanging": T({ base: { hx: 60, hy: 58, t: 0, ua: 180, fa: 180 }, A: { th: 0, sh: 0 }, B: { th: 95, sh: 95 }, props: [{ line: [44, -18, 76, -18] }] }, { joint: "an", dir: "up" }, "none"),
  "leg-raise-lying": T({ base: { hx: 70, hy: 98, t: -90, ua: -150, fa: -150 }, A: { th: 90, sh: 90 }, B: { th: 175, sh: 175 }, props: [] }, { joint: "an", dir: "up" }, "none"),
  // Kneeling rollout: knees stay put, hands on the wheel on the floor roll out until the body is long and low
  "ab-wheel": T({ base: { sh: -90, nofoot: 1 }, A: { hx: 26, hy: 78, th: 0, t: 68, ua: 20, fa: 20 }, B: { hx: 38, hy: 81.2, th: -30, t: 84, ua: 52, fa: 52 }, props: [{ pad: "ha", r: 3 }] }, { joint: "ha", dir: "away" }, "none"),
  woodchop: T({ v: "f", base: { L: { ua: 120, fa: 120 } }, A: { ua: 140, fa: 140 }, B: { ua: 20, fa: 10 }, props: [{ cable: [112, -12], to: "haR" }] }, { joint: "haR", dir: "down" }, "none"),
  "side-bend": T({ v: "f", base: { L: { ua: 4, fa: 4 } }, A: { tl: 0, ua: 4, fa: 4 }, B: { tl: 16, ua: 4, fa: 4 }, props: [{ db: "haR" }] }, { joint: "haR", dir: "down" }, "none"),
  // ── Forearms and neck ──
  "wrist-curl": T({ base: { hx: 50, hy: 80, t: 20, th: 88, sh: 0, ua: 30 }, A: { fa: 70 }, B: { fa: 100 }, props: [{ line: [38, 84, 62, 84] }, { line: [50, 84, 50, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  "neck-flexion": T({ base: { hx: 74, hy: 84, th: 100, sh: 0, ua: 80, fa: 260 }, A: { t: -96 }, B: { t: -74 }, props: [{ line: [40, 88, 86, 88] }, { line: [56, 88, 56, 104] }] }, { joint: "sh", dir: "up" }, "none"),
  "neck-extension": T({ base: { hx: 44, hy: 84, th: -100, sh: 0, ua: -80, fa: -260 }, A: { t: 96 }, B: { t: 74 }, props: [{ line: [30, 88, 78, 88] }, { line: [62, 88, 62, 104] }] }, { joint: "sh", dir: "up" }, "none"),

  // ── Added for the writers' poor fits (phase 2) ──
  "lateral-raise-lean-in": T({ v: "f", base: { cx: 52, la: 0, sa: 0, hw: 1.5, rot: -14, L: { ua: 50, fa: 50 } }, A: { ua: -8, fa: -8 }, B: { ua: 92, fa: 92 }, props: [{ line: [12, -14, 12, 104] }, { line: [6, 104, 18, 104] }] }, { joint: "haR", dir: "up" }, "db"),
  "lateral-raise-lying": T({ base: { hx: 70, hy: 76, t: -90, th: 90, sh: 90, nofoot: 1 }, A: { ua: 90, fa: 90 }, B: { ua: 180, fa: 180 }, props: [{ line: [20, 80, 100, 80] }, { line: [36, 80, 36, 104] }, { line: [86, 80, 86, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  "landmine-press": T({ base: { t: 10 }, A: { ua: -20, fa: 160 }, B: { ua: 130, fa: 130 }, props: [] }, { joint: "ha", dir: "up" }, "cable", [104, 104]),
  "y-raise-incline": T({ base: { hx: 44, hy: 58, t: 48, th: 20, sh: -10 }, A: { ua: 0, fa: 0 }, B: { ua: 140, fa: 140 }, props: [{ line: [52, 62, 74, 38] }, { line: [56, 62, 56, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  "pullup-scapular": T({ v: "f", base: { lf: 1, la: 4, sa: 2 }, A: { hy: 58, ua: 172, fa: 172 }, B: { hy: 51, ua: 160, fa: 172 }, props: [{ line: [22, -18, 98, -18] }] }, { joint: "sh", dir: "up" }, "none"),
  "handstand-pushup": T({ base: { hx: 60, t: 180, th: 170, sh: 170, nofoot: 1 }, A: { hy: 32, ua: 12, fa: -12 }, B: { hy: 46, ua: 50, fa: 306 }, props: [{ line: [40, -20, 40, 104] }] }, { joint: "sh", dir: "down" }, "none"),
  "overhead-extension-standing": T({ base: { ua: 172 }, A: { fa: 330 }, B: { fa: 172 }, props: [] }, { joint: "ha", dir: "up" }, "db", [16, 100]),
  "fly-cable-low": T({ v: "f", base: {}, A: { ua: 40, fa: 30 }, B: { ua: 130, fa: 190 }, props: [{ cable: [112, 100], to: "haR" }] }, { joint: "haR", dir: "up" }, "none"),
  "press-floor": T({ base: { hx: 70, hy: 98, t: -90, th: 135, sh: 0 }, A: { ua: 180, fa: 180 }, B: { ua: 110, fa: 175 }, props: [] }, { joint: "ha", dir: "down" }, "bar"),
  "pallof-press": T({ base: { t: 0 }, A: { ua: -40, fa: 90 }, B: { ua: 90, fa: 90 }, props: [] }, { joint: "ha", dir: "away" }, "cable", [116, 62]),
  "woodchop-up": T({ v: "f", base: { L: { ua: 20, fa: 10 } }, A: { ua: 20, fa: 10 }, B: { ua: 140, fa: 140 }, props: [{ cable: [112, 100], to: "haR" }] }, { joint: "haR", dir: "up" }, "none"),
  "leg-lower-lying": T({ base: { hx: 70, hy: 98, t: -90, ua: 180, fa: 180 }, A: { th: 175, sh: 175 }, B: { th: 100, sh: 100 }, props: [] }, { joint: "an", dir: "down" }, "none"),
  "reverse-nordic": T({ base: { sh: -90, nofoot: 1, ua: 20, fa: 120 }, A: { hx: 52, hy: 78, th: 0, t: 0 }, B: { hx: 41.9, hy: 80.2, th: 25, t: -25 }, props: [] }, { joint: "sh", dir: "down" }, "none"),
  "sissy-squat": T({ base: { anchor: 1, ax: 56, ah: 6, ua: 60, fa: 120 }, A: { th: 0, sh: 0, t: 0 }, B: { th: 60, sh: -40, t: -30 }, props: [{ line: [70, 30, 70, 104] }] }, { joint: "hip", dir: "down" }, "none"),
  "calf-press": T({ base: { hx: 40, hy: 80, t: -45, ua: 20, fa: 40 }, A: { th: 127, sh: 120 }, B: { th: 120, sh: 138 }, props: [{ line: [44, 85, 18, 59] }, { perp: "an", ang: 40, len: 20 }] }, { joint: "an", dir: "toward" }, "none"),
  "calf-raise-donkey": T({ base: { anchor: 1, ax: 46, t: 80, th: 0, sh: 0, ua: 10, fa: 10 }, A: { ah: 7 }, B: { ah: 0 }, props: [{ line: [84, 70, 104, 70] }, { line: [96, 70, 96, 104] }] }, { joint: "hip", dir: "down" }, "none"),
  "kickback-quadruped": T({ base: { hx: 50, hy: 80, t: 65, ua: 0, fa: 0, nofoot: 1 }, A: { th: 0, sh: -90 }, B: { th: -100, sh: -100 }, props: [] }, { joint: "an", dir: "up" }, "none", [4, 100]),
  "hip-abduction-standing": T({ v: "f", base: {}, A: { la: 4, sa: 2 }, B: { la: 26, sa: 6 }, props: [{ line: [100, -14, 100, 104] }] }, { joint: "knR", dir: "away" }, "none"),
  "pull-through": T({ base: { anchor: 1, ax: 60 }, A: { th: 0, sh: 0, t: 0, ua: 0, fa: 0 }, B: { th: 20, sh: -8, t: 75, ua: 0, fa: 0 }, props: [{ cable: [8, 100], to: "ha" }] }, { joint: "ha", dir: "down" }, "none"),

  // ── Added by the review fixes (phase 2) ──
  // Lean-in cable raise: post and low pulley on the working side, body leaning toward the free hand's post
  "lateral-raise-lean-in-cable": T({ v: "f", base: { cx: 52, la: 0, sa: 0, hw: 1.5, rot: -14, L: { ua: 50, fa: 50 } }, A: { ua: -20, fa: -22 }, B: { ua: 92, fa: 92 }, props: [{ line: [12, -14, 12, 104] }, { line: [6, 104, 18, 104] }, { cable: [12, 96], to: "haR" }] }, { joint: "haR", dir: "up" }, "none"),
  // Lying fly (flat bench): arms up over the chest, then open wide (side view: the arms drop and shorten as they go out)
  "fly-lying": T({ base: { hx: 70, hy: 76, t: -90, th: 100, sh: 0 }, A: { ua: 180, fa: 180, al: 1, fl: 1 }, B: { ua: 190, fa: 205, al: 0.3, fl: 0.45 }, props: [{ line: [28, 80, 82, 80] }, { line: [44, 80, 44, 104] }, { db: "ha" }] }, { joint: "ha", dir: "down" }, "none", [30, 104]),
  // Standing front raise all the way overhead
  "front-raise-full": T({ base: {}, A: { ua: 0, fa: 0 }, B: { ua: 170, fa: 170 }, props: [] }, { joint: "ha", dir: "up" }, "db", [86, 100]),
  // Chest on an incline bench, arms hanging, raised out to the sides (drawn like reverse-fly-bent)
  "reverse-fly-prone": T({ base: { hx: 44, hy: 58, t: 48, th: 20, sh: -10 }, A: { ua: 0, fa: 0, al: 1, fl: 1 }, B: { ua: -80, fa: -80, al: 0.7, fl: 0.7 }, props: [{ line: [52, 62, 74, 38] }, { line: [56, 62, 56, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  // Face down on a flat bench (variant for bench: "flat")
  "reverse-fly-prone-flat": T({ base: { hx: 68, hy: 62, t: -90, th: 90, sh: 90, nofoot: 1 }, A: { ua: 0, fa: 0, al: 1, fl: 1 }, B: { ua: -20, fa: -20, al: 0.25, fl: 0.25 }, props: [{ line: [20, 66, 100, 66] }, { line: [36, 66, 36, 104] }, { line: [88, 66, 88, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  // Seated on a bench end, chest on the thighs, arms from under the knees out to the sides (variant for seated)
  "reverse-fly-bent-seated": T({ base: { hx: 40, hy: 76, t: 72, th: 88, sh: 0 }, A: { ua: 0, fa: 0, al: 1, fl: 1 }, B: { ua: -80, fa: -80, al: 0.7, fl: 0.7 }, props: [{ line: [26, 80, 50, 80] }, { line: [36, 80, 36, 104] }] }, { joint: "ha", dir: "up" }, "db", [76, 104]),
  // Seated cable row to the neck, elbows high and wide
  "row-rear-delt-seated": T({ base: { hx: 40, hy: 88, th: 85, sh: 85, t: 0 }, A: { ua: 90, fa: 90, al: 1, fl: 1 }, B: { ua: 90, fa: 170, al: 0.3, fl: 0.75 }, props: [{ line: [20, 92, 50, 92] }, { line: [93, 70, 93, 95] }, { cable: [118, 52], to: "ha" }] }, { joint: "ha", dir: "toward" }, "none"),
  // Back extension starting at the top: body straight in line with the bench, then hinge down
  "back-extension": T({ base: { hx: 46, hy: 56, th: -45, sh: -45 }, A: { t: 45, ua: 315, fa: 135 }, B: { t: 158, ua: 202, fa: 22 }, props: [{ pad: "hip", r: 3 }, { line: [12, 96, 44, 64] }, { line: [28, 80, 28, 104] }] }, { joint: "sh", dir: "down" }, "none"),
  // Reverse hyper: face down on a high pad, legs hanging, swung up in line with the body
  "reverse-hyper": T({ base: { hx: 70, hy: 54, t: -90, ua: 0, fa: 0, nofoot: 1 }, A: { th: 0, sh: 0 }, B: { th: 86, sh: 86 }, props: [{ line: [30, 58, 72, 58] }, { line: [46, 58, 46, 104] }] }, { joint: "an", dir: "up" }, "none"),
  // Reverse crunch: lying, thighs straight up, knees bent; the hips curl up off the floor
  "reverse-crunch": T({ base: { ua: 90, fa: 90 }, A: { hx: 70, hy: 98, t: -90, th: 180, sh: 90 }, B: { hx: 70, hy: 90, t: -104, th: 222, sh: 120 }, props: [] }, { joint: "hip", dir: "up" }, "none"),
  // Dead bug: lying, arm up and knee bent 90°; the arm goes overhead and the leg straightens toward the floor
  "dead-bug": T({ base: { hx: 70, hy: 98, t: -90 }, A: { ua: 180, fa: 180, th: 180, sh: 90 }, B: { ua: 255, fa: 255, th: 105, sh: 100 }, props: [] }, { joint: "ha", dir: "down" }, "none"),
  // Bench dip: hands on a bench behind, heels on the floor; the hips drop until the upper arms are level
  "bench-dip": T({ base: { anchor: 1, ax: 86 }, A: { th: 50, sh: 50, t: 0, ua: -14, fa: -20 }, B: { th: 90, sh: 40, t: 5, ua: -60, fa: 21 }, props: [{ line: [18, 77, 46, 77] }, { line: [26, 77, 26, 104] }] }, { joint: "sh", dir: "down" }, "none"),
  // Lying cable extension, head toward a low pulley: upper arms up, elbows bent first, then straighten
  "lying-cable-extension": T({ base: { hx: 70, hy: 76, t: -90, th: 100, sh: 0, ua: 195 }, A: { fa: 320 }, B: { fa: 195 }, props: [{ line: [28, 80, 82, 80] }, { line: [44, 80, 44, 104] }] }, { joint: "ha", dir: "up" }, "cable", [6, 96]),
  // Incline cable extension, back to a high pulley: elbows bent first, then straighten
  "lying-cable-extension-incline": T({ base: { hx: 58, hy: 78, t: -55, th: 80, sh: 0, ua: 200 }, A: { fa: 350 }, B: { fa: 200 }, props: [{ line: [56, 84, 26, 64] }, { line: [52, 82, 72, 82] }] }, { joint: "ha", dir: "up" }, "cable", [6, -16]),
  // Trunk rotation (front view): arms out in front, the torso turns to one side
  "trunk-rotation": T({ v: "f", base: { la: 8, sa: 4, L: { ua: 20, fa: 20, al: 0.85, fl: 0.85 } }, A: { ua: 30, fa: 30, al: 0.6, fl: 0.6 }, B: { ua: 85, fa: 85, al: 1, fl: 1 }, props: [] }, { joint: "haR", dir: "away" }, "none"),
  // Seated version (variant for seated): sitting on the floor or a bench
  "trunk-rotation-seated": T({ v: "f", base: { hy: 66, lf: 0.45, la: 12, sa: 4, L: { ua: 20, fa: 20, al: 0.85, fl: 0.85 } }, A: { ua: 30, fa: 30, al: 0.6, fl: 0.6 }, B: { ua: 85, fa: 85, al: 1, fl: 1 }, props: [{ line: [44, 68, 76, 68] }] }, { joint: "haR", dir: "away" }, "none"),
  // Standing cable crunch, back to a high pulley: the spine curls down from a slight arch
  "cable-crunch-standing": T({ base: { anchor: 1, ax: 62, th: 4, sh: -2 }, A: { t: -6, ua: 25, fa: 165 }, B: { t: 55, ua: 85, fa: 225 }, props: [] }, { joint: "sh", dir: "down" }, "cable", [8, -20]),
  // Seated version (variant for seated): sitting on a bench, back to a high pulley
  "cable-crunch-seated": T({ base: { hx: 52, hy: 80, th: 88, sh: 0 }, A: { t: -6, ua: 25, fa: 165 }, B: { t: 55, ua: 85, fa: 225 }, props: [{ line: [40, 84, 64, 84] }, { line: [52, 84, 52, 104] }] }, { joint: "sh", dir: "down" }, "cable", [8, -20]),
  // Seated neck machine (variants for seated): torso still, only the head tips forward, or back
  "neck-flexion-seated": T({ base: { hx: 50, hy: 80, t: 0, th: 88, sh: 0, ua: 20, fa: 80 }, A: { hn: 0 }, B: { hn: 40 }, props: [{ line: [38, 84, 62, 84] }, { line: [50, 84, 50, 104] }, { line: [84, 20, 84, 104] }, { cable: [84, 34], to: "head" }] }, { joint: "head", dir: "away" }, "none"),
  "neck-extension-seated": T({ base: { hx: 50, hy: 80, t: 0, th: 88, sh: 0, ua: 20, fa: 80 }, A: { hn: 12 }, B: { hn: -24 }, props: [{ line: [38, 84, 62, 84] }, { line: [50, 84, 50, 104] }, { line: [16, 20, 16, 104] }, { cable: [16, 34], to: "head" }] }, { joint: "head", dir: "toward" }, "none"),
  // Standing leg curl: one leg, thigh against a pad, heel curls up behind
  "leg-curl-standing": T({ base: { hx: 56, hy: 57, t: 10, th: 0, ua: 70, fa: 80 }, A: { sh: 0 }, B: { sh: -120 }, props: [{ line: [57, 57, 58, 104] }, { pad: "an" }, { line: [86, 30, 86, 104] }] }, { joint: "an", dir: "up" }, "none"),
  // Standing cable hip adduction (front view): leg pulled in across the body from a low pulley on its side
  "hip-adduction-standing": T({ v: "f", base: {}, A: { la: 26, sa: 6 }, B: { la: -8, sa: -4 }, props: [{ line: [104, -14, 104, 104] }, { cable: [104, 100], to: "anR" }] }, { joint: "knR", dir: "toward" }, "none"),
  // Belt squat: upright squat, hands free, a chain from the hips to the platform
  "belt-squat": T({ base: { anchor: 1, ax: 60, ua: 60, fa: 80 }, A: { th: 0, sh: 0, t: 2 }, B: { th: 86, sh: -30, t: 14 }, props: [{ cable: [64, 104], to: "hip" }, { line: [36, 104, 96, 104] }] }, { joint: "hip", dir: "down" }, "none"),
  // Copenhagen adduction: side plank on the forearm, top leg on a bench, hips lift into a straight line
  copenhagen: T({ base: { nofoot: 1, ua: 0, fa: 0, fl: 0.1 }, A: { hx: 64, hy: 98, t: -62, th: 105, sh: 105 }, B: { hx: 64, hy: 83, t: -88, th: 95, sh: 85 }, props: [{ line: [98, 86, 118, 86] }, { line: [108, 86, 108, 104] }] }, { joint: "hip", dir: "up" }, "none"),
  // ── Added for the poor fits (phase 3) ──
  // Forearm rotation (front view, seated): forearm forward, a dumbbell held by one end turns from flat to thumb up
  "forearm-pronation": T({ v: "f", base: { hy: 66, lf: 0.45, la: 12, sa: 4, ua: 28, fa: 10, fl: 0.35, pl: 12, L: { ua: 10, fa: 20, fl: 0.35 } }, A: { pa: 90 }, B: { pa: 180 }, props: [{ line: [44, 68, 76, 68] }, { tip: 1 }] }, { joint: "tip", dir: "up" }, "none"),
  "forearm-supination": T({ v: "f", base: { hy: 66, lf: 0.45, la: 12, sa: 4, ua: 28, fa: 10, fl: 0.35, pl: 12, L: { ua: 10, fa: 20, fl: 0.35 } }, A: { pa: 270 }, B: { pa: 180 }, props: [{ line: [44, 68, 76, 68] }, { tip: 1 }] }, { joint: "tip", dir: "up" }, "none"),
  // Seated neck harness: leaning forward, hands on the knees, a plate hanging from the head; the head lifts
  "neck-harness-seated": T({ base: { hx: 44, hy: 80, t: 35, th: 88, sh: 0, ua: 20, fa: 20 }, A: { hn: 45 }, B: { hn: -25 }, props: [{ line: [30, 84, 54, 84] }, { line: [40, 84, 40, 104] }, { hang: "head", len: 26, plate: 8 }] }, { joint: "head", dir: "up" }, "none"),
  // Incline front raise: back on an incline bench, arms from the thighs up to shoulder height
  "front-raise-incline": T({ base: { hx: 52, hy: 80, t: -35, th: 88, sh: 0 }, A: { ua: 12, fa: 12 }, B: { ua: 95, fa: 95 }, props: [{ line: [49, 85, 28, 55] }, { line: [48, 84, 70, 85] }, { line: [58, 85, 58, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  // Prone Kelso shrug: chest on an incline bench, arms hanging; only the shoulder blades squeeze
  "kelso-shrug-prone": T({ base: { hx: 44, hy: 58, t: 48, th: 20, sh: -10, ua: 0, fa: 0 }, A: { tq: 0, al: 1, fl: 1, sb: 0 }, B: { tq: 1, al: 0.88, fl: 0.88, sb: -2 }, props: [{ line: [52, 62, 74, 38] }, { line: [56, 62, 56, 104] }, { trap: true }] }, { joint: "ha", dir: "up" }, "db"),
  // Seated lateral raise (variant for seated)
  "lateral-raise-seated": T({ v: "f", base: { hy: 66, lf: 0.45, la: 12, sa: 4 }, A: { ua: 8, fa: 8 }, B: { ua: 88, fa: 90 }, props: [{ line: [44, 68, 76, 68] }, { db: "haR" }, { db: "haL" }] }, { joint: "haR", dir: "up" }, "none"),
  // Machine lateral raise: elbows bent, pads on the outside of the arms
  "lateral-raise-machine": T({ v: "f", base: { fl: 0.4 }, A: { ua: 8, fa: 20 }, B: { ua: 88, fa: 60 }, props: [{ pad: "elR", r: 3 }, { pad: "elL", r: 3 }] }, { joint: "haR", dir: "up" }, "none"),
  "lateral-raise-machine-seated": T({ v: "f", base: { hy: 66, lf: 0.45, la: 12, sa: 4, fl: 0.4 }, A: { ua: 8, fa: 20 }, B: { ua: 88, fa: 60 }, props: [{ line: [44, 68, 76, 68] }, { pad: "elR", r: 3 }, { pad: "elL", r: 3 }] }, { joint: "haR", dir: "up" }, "none"),
  // Incline / decline seated press (machine, or cable with the pulley behind), and the standing cable press
  "press-incline-machine": T({ base: { hx: 50, hy: 80, t: -25, th: 88, sh: 0 }, A: { ua: -40, fa: 70 }, B: { ua: 125, fa: 125 }, props: [{ line: [38, 84, 62, 84] }, { line: [50, 84, 50, 104] }, { line: [46, 84, 32, 52] }] }, { joint: "ha", dir: "up" }, "none", [14, 76]),
  "press-decline-machine": T({ base: { hx: 48, hy: 80, t: -8, th: 88, sh: 0 }, A: { ua: -45, fa: 95 }, B: { ua: 62, fa: 62 }, props: [{ line: [36, 84, 60, 84] }, { line: [48, 84, 48, 104] }, { line: [44, 82, 40, 40] }] }, { joint: "ha", dir: "away" }, "none"),
  "press-cable-standing": T({ base: { t: 10, th: 4, sh: -2 }, A: { ua: -40, fa: 90 }, B: { ua: 85, fa: 88 }, props: [] }, { joint: "ha", dir: "away" }, "cable", [16, 28]),
  // Pec deck (front view, seated): arms open wide, then together in front of the chest (drawn shorter as they come
  // forward, like reverse-fly-cable)
  "pec-deck": T({ v: "f", base: { hy: 66, lf: 0.45, la: 12, sa: 4, ua: 92, fa: 92 }, A: { al: 1, fl: 1 }, B: { al: -0.3, fl: -0.3 }, props: [{ line: [44, 68, 76, 68] }] }, { joint: "haR", dir: "toward" }, "none"),
  // Seated cable fly (variant for seated): pulleys at shoulder height on both sides
  "fly-cable-seated": T({ v: "f", base: { hy: 66, lf: 0.45, la: 12, sa: 4, ua: 92, fa: 92 }, A: { al: 1, fl: 1 }, B: { al: -0.3, fl: -0.3 }, props: [{ line: [44, 68, 76, 68] }, { cable: [114, 32], to: "haR" }, { cable: [6, 32], to: "haL" }] }, { joint: "haR", dir: "toward" }, "none"),
  // Cable press-around (front view): one hand from beside the chest, forward and across past the middle
  "press-around": T({ v: "f", base: { L: { ua: 4, fa: 4 } }, A: { ua: 35, fa: 165, al: 0.7, fl: 0.6 }, B: { ua: -75, fa: -80, al: 0.6, fl: 0.6 }, props: [{ cable: [84, 14], to: "haR" }] }, { joint: "haR", dir: "toward" }, "none"),
  // Push-ups: hands on a bench (incline), feet on a bench (decline), hands on blocks (deficit)
  "pushup-incline": T({ base: { anchor: 1, ax: 102 }, A: { th: 42, sh: 42, t: -42, ua: 6, fa: -16 }, B: { th: 56, sh: 56, t: -56, ua: 71, fa: -29 }, props: [{ line: [30, 81, 58, 81] }, { line: [34, 81, 34, 104] }, { line: [54, 81, 54, 104] }] }, { joint: "sh", dir: "down" }, "none"),
  "pushup-decline": T({ base: { anchor: 1, ax: 104, ah: 24, fh: 20 }, A: { th: 63, sh: 63, t: -63, ua: -2, fa: -2 }, B: { th: 92, sh: 92, t: -92, ua: 70, fa: -41 }, props: [{ line: [94, 84, 118, 84] }, { line: [98, 84, 98, 104] }, { line: [114, 84, 114, 104] }] }, { joint: "sh", dir: "down" }, "none"),
  "pushup-deficit": T({ base: { anchor: 1, ax: 102 }, A: { th: 58, sh: 58, t: -58, ua: -6, fa: -6 }, B: { th: 82, sh: 82, t: -82, ua: 120, fa: -36 }, props: [{ line: [21, 99, 36, 99] }, { line: [21, 101.5, 36, 101.5] }, { line: [23, 99, 23, 104] }, { line: [34, 99, 34, 104] }] }, { joint: "sh", dir: "down" }, "none"),
  // Tate press: lying, dumbbells from straight up in to the chest, elbows out (arms drawn short: they point out sideways)
  "tate-press": T({ base: { hx: 70, hy: 76, t: -90, th: 100, sh: 0 }, A: { ua: 180, fa: 180, al: 1, fl: 1 }, B: { ua: 175, fa: 100, al: 0.5, fl: 0.35 }, props: [{ line: [28, 80, 82, 80] }, { line: [44, 80, 44, 104] }] }, { joint: "ha", dir: "down" }, "db"),
  // Cross-body cable extension (front view): cables crossed, hands by the opposite shoulders, then down and out
  "cross-body-extension": T({ v: "f", base: {}, A: { ua: 15, al: 0.6, fa: -115 }, B: { ua: 30, al: 1, fa: 35 }, props: [{ cable: [8, -16], to: "haR" }, { cable: [112, -16], to: "haL" }] }, { joint: "haR", dir: "down" }, "none"),
  // Katana extension (front view): hand behind the head on the other side, then up and out; low pulley behind
  katana: T({ v: "f", base: { L: { ua: 4, fa: 4 } }, A: { ua: 160, fa: 300 }, B: { ua: 150, fa: 150 }, props: [{ cable: [34, 100], to: "haR" }] }, { joint: "haR", dir: "up" }, "none"),
  // Seated machine extension: upper arms on a sloped pad, the hands push down until the arms are straight
  "triceps-extension-machine": T({ base: { hx: 46, hy: 80, t: 5, th: 88, sh: 0, ua: 60 }, A: { fa: 170 }, B: { fa: 60 }, props: [{ line: [34, 84, 58, 84] }, { line: [46, 84, 46, 104] }, { line: [50, 51, 68, 61] }] }, { joint: "ha", dir: "down" }, "none"),
  // Kneeling overhead cable extension (variant for kneeling): upper arms on a bench, back to a high pulley
  "overhead-extension-cable-kneeling": T({ base: { hx: 44, hy: 78, th: 0, sh: -90, nofoot: 1, t: 45, ua: 100 }, A: { fa: 270 }, B: { fa: 100 }, props: [{ line: [74, 61, 100, 61] }, { line: [94, 61, 94, 104] }] }, { joint: "ha", dir: "away" }, "cable", [10, -12]),
  // ── Abs (phase 3) ──
  // V-up: lying flat, arms overhead; arms and legs lift together
  "v-up": T({ base: { hx: 72, hy: 98, nofoot: 1 }, A: { t: -90, th: 90, sh: 90, ua: 270, fa: 270 }, B: { t: -40, th: 140, sh: 140, ua: 140, fa: 140 }, props: [] }, { joint: "an", dir: "up" }, "none"),
  // Side-lying crunch (front view turned on its side): the top shoulder lifts toward the hip
  "side-crunch": T({ v: "f", base: { rot: -90, cx: 104, lift: 5, la: 4, sa: 2, ua: 150, fa: 250, al: 0.8, fl: 0.8, L: { ua: 0, fa: 0 } }, A: { tl: 0 }, B: { tl: 22 }, props: [] }, { joint: "haR", dir: "up" }, "none"),
  // Side jackknife: as side-crunch, and the top leg lifts too
  "side-jackknife": T({ v: "f", base: { rot: -90, cx: 104, lift: 5, sa: 2, ua: 150, fa: 250, al: 0.8, fl: 0.8, L: { ua: 0, fa: 0 }, laL: 4, saL: 2 }, A: { tl: 0, la: 4 }, B: { tl: 22, la: 34 }, props: [] }, { joint: "haR", dir: "up" }, "none"),
  // Heel touch (seen from above, lying, knees bent): side bend to one heel, then the other
  "heel-touch": T({ v: "f", base: { rot: -90, cx: 106, lift: 13, la: 24, sa: -24, lf: 0.6, ua: 0, fa: 0 }, A: { tl: -9 }, B: { tl: 9 }, props: [] }, { joint: "haR", dir: "away" }, "none"),
  // Bicycle crunch (side view): shoulders up, hands by the head; one knee in as the other leg straightens
  bicycle: T({ base: { hx: 74, hy: 98, t: -58, ua: 200, fa: 320, al: 0.7, fl: 0.7, nofoot: 1 }, A: { th: 195, sh: 95 }, B: { th: 100, sh: 100 }, props: [{ run: 1 }] }, { joint: "an", dir: "down" }, "none"),
  // Captain's chair: back on the pad, forearms on the arm pads, knees up
  "knee-raise-chair": T({ base: { hx: 60, hy: 52, t: 0, ua: 0, fa: 90 }, A: { th: 0, sh: 0 }, B: { th: 100, sh: 10 }, props: [{ line: [54, 8, 54, 104] }, { line: [56, 40.5, 82, 40.5] }, { line: [56, 56, 56, 56] }] }, { joint: "an", dir: "up" }, "none"),
  // Hanging knee raise: knees bent up to the chest
  "knee-raise-hanging": T({ base: { hx: 60, hy: 56, t: 0, ua: 180, fa: 180 }, A: { th: 0, sh: 0 }, B: { th: 105, sh: 15 }, props: [{ line: [44, -20, 76, -20] }] }, { joint: "an", dir: "up" }, "none"),
  // Seated leg pull-in: on a bench edge, leaning back, hands on the bench; knees and chest come together
  "leg-pull-in-seated": T({ base: { hx: 44, hy: 82, nofoot: 0 }, A: { t: -45, th: 95, sh: 95, ua: 16, fa: 68 }, B: { t: -25, th: 140, sh: 40, ua: -1, fa: 45 }, props: [{ line: [30, 84, 58, 84] }, { line: [44, 84, 44, 104] }] }, { joint: "an", dir: "toward" }, "none"),
  // Lying leg pull-in: on the floor, legs straight just off it; knees pulled to the chest
  "leg-pull-in-lying": T({ base: { hx: 70, hy: 98, t: -90, ua: 90, fa: 90 }, A: { th: 95, sh: 95 }, B: { th: 200, sh: 110 }, props: [] }, { joint: "an", dir: "toward" }, "none"),
  // Rollout from the toes: from a pike over the bar out to a long, low body
  "rollout-toes": T({ base: { anchor: 1, ax: 114 }, A: { th: 48, sh: 48, t: -110, ua: -60, fa: -60 }, B: { th: 70, sh: 70, t: -88, ua: -66, fa: -66 }, props: [] }, { joint: "ha", dir: "toward" }, "bar"),
  // Rollout from a bench: kneeling on the bench end, hands on a bar on the floor
  "rollout-bench": T({ base: { sh: 90, nofoot: 1 }, A: { hx: 84, hy: 62, th: 0, t: -100, ua: -41, fa: -5 }, B: { hx: 68.6, hy: 67.6, th: 40, t: -95, ua: -39, fa: -34 }, props: [{ line: [78, 88, 116, 88] }, { line: [84, 88, 84, 104] }, { line: [112, 88, 112, 104] }] }, { joint: "ha", dir: "toward" }, "bar"),
  // Cable Russian twist on a ball: shoulders on the ball, hips up, arms straight up; the arms swing to one side
  "russian-twist-ball": T({ base: { anchor: 1, ax: 96, sh: -10, th: 95, t: -90, ua: 180, fa: 180 }, A: { al: 1, fl: 1 }, B: { al: 0.55, fl: 0.55 }, props: [{ pad: "sh", r: 10, dy: 10.5 }] }, { joint: "ha", dir: "down" }, "none"),
  // High-pulley side bend (front view): handle by the shoulder, bend sideways toward it
  "side-bend-high-cable": T({ v: "f", base: { L: { ua: 4, fa: 4 }, ua: 8, fa: 172 }, A: { tl: 0 }, B: { tl: 18 }, props: [{ cable: [78, -20], to: "haR" }] }, { joint: "haR", dir: "down" }, "none"),
  // Decline crunch (variant for bench decline): head low on the bench, feet hooked high
  "crunch-decline": T({ base: { hx: 64, hy: 76, th: 125, sh: 70, ua: 150, fa: 230 }, A: { t: -114 }, B: { t: -70 }, props: [{ line: [20, 100, 96, 66] }, { line: [82, 73, 82, 104] }, { pad: "an" }] }, { joint: "sh", dir: "up" }, "none"),
  // Behind-the-back wrist curl: standing, bar behind the hips; only the hands curl up
  "wrist-curl-behind": T({ base: { ua: -6, fa: -6, pl: 6 }, A: { pa: 0 }, B: { pa: -75 }, props: [{ tip: 1 }, { pad: "tip", r: 2.6 }] }, { joint: "tip", dir: "up" }, "none"),
  // ── Legs (phase 3) ──
  // Dumbbell squat: a dumbbell hanging at each side
  "squat-db": T({ base: { anchor: 1, ax: 60, ua: 0, fa: 0 }, A: { th: 0, sh: 0, t: 6 }, B: { th: 82, sh: -32, t: 32 }, props: [] }, { joint: "hip", dir: "down" }, "db"),
  // Goblet squat: one dumbbell held upright at the chest
  "squat-goblet": T({ base: { anchor: 1, ax: 60, ua: 14, fa: 172 }, A: { th: 0, sh: 0, t: 4 }, B: { th: 88, sh: -36, t: 22 }, props: [{ perp: "ha", ang: 0, len: 9 }] }, { joint: "hip", dir: "down" }, "none"),
  // Sumo dumbbell squat (front view): wide stance, one dumbbell hanging between the legs
  "squat-sumo": T({ v: "f", base: { ua: -16.7, fa: -16.7 }, A: { hy: 60.6, la: 30, sa: 10, lf: 1 }, B: { hy: 71.1, la: 62, sa: -7.6, lf: 0.9 }, props: [{ hang: "haR", len: 10 }] }, { joint: "sh", dir: "down" }, "none"),
  // Barbell hack squat: bar held behind the legs, arms straight
  "hack-squat-barbell": T({ base: { anchor: 1, ax: 60 }, A: { th: 0, sh: 0, t: 4, ua: -6, fa: -6 }, B: { th: 82, sh: -34, t: 30, ua: -22, fa: -22 }, props: [] }, { joint: "hip", dir: "down" }, "bar"),
  // Lying leg press (Smith or lying machine): on the back, feet up on a bar or platform
  "leg-press-lying": T({ base: { hx: 74, hy: 98, t: -90, ua: 90, fa: 90 }, A: { th: 178, sh: 178 }, B: { th: 215, sh: 140 }, props: [{ perp: "an", ang: 90, len: 16 }] }, { joint: "an", dir: "down" }, "none"),
  // Side lunge (front view): bar on the back, sit to one side, the other leg straight
  "side-lunge": T({ v: "f", base: { ua: 60, fa: 205, fl: 0.8, lfL: 1 }, A: { cx: 60, hy: 61.4, la: 25, sa: 25, lf: 1, laL: 25, saL: 25 }, B: { cx: 72, hy: 69.4, la: 47.4, sa: -13.5, lf: 0.75, laL: 42.7, saL: 42.7 }, props: [] }, { joint: "sh", dir: "down" }, "bar"),
  // ── Holds (tempo "Hold N s"): a still pose with a small brace/breathing motion ──
  // Forearm plank: on the toes and forearms, body straight
  "plank-hold": H({ base: { anchor: 1, ax: 104, ua: 0, fa: -90 }, A: { th: 74.2, sh: 74.2, t: -74.2 }, B: { th: 73.4, sh: 73.4, t: -73.4 }, props: [] }, "none"),
  // Side plank (front view turned on its side): on one forearm, body straight, top hand on the hip
  "side-plank-hold": H({ v: "f", base: { rot: -72, cx: 108, la: 2, sa: 2, hw: 2, ua: -12, fa: -12, al: 0.8, fl: 0.8, L: { ua: 72, fa: 174, al: 0.8 } }, A: { tl: 0 }, B: { tl: 1.5 }, props: [] }, "none"),
  // Copenhagen hold: side plank on the forearm, top leg on a bench, held at the top
  "copenhagen-hold": H({ base: { nofoot: 1, ua: 0, fa: 0, fl: 0.1, hx: 64, t: -88, th: 95, sh: 85 }, A: { hy: 83 }, B: { hy: 84.2 }, props: [{ line: [98, 86, 118, 86] }, { line: [108, 86, 108, 104] }] }, "none"),
  // Farmer's carry: standing tall, a dumbbell at each side, short steps
  carry: H({ base: { ua: 0, fa: 0 }, A: { th: 9, sh: 4 }, B: { th: -9, sh: -14 }, props: [{ run: 1 }, { db: "ha" }] }, "none"),

  // ── New exercises (phase 3b) ──
  // Svend press: a plate squeezed between the palms at the chest, pressed straight forward
  "svend-press": T({ base: { t: 4 }, A: { ua: -40, fa: 90 }, B: { ua: 88, fa: 88 }, props: [{ perp: "ha", ang: 0, len: 11 }] }, { joint: "ha", dir: "away" }, "none"),
  // Ball pull-in: push-up position, shins on a ball; the knees pull in and the ball rolls toward the hands
  "ball-pull-in": T({ base: { anchor: 1 }, A: { ax: 105.5, ah: 27, fh: 27, t: -81.4, th: 81.4, sh: 81.4, ua: 1, fa: 1 }, B: { ax: 66, ah: 25.2, fh: 25.2, t: -102, th: -30, sh: 90, ua: 6, fa: 6 }, props: [{ pad: "an", r: 13, dy: 13 }] }, { joint: "an", dir: "toward" }, "none"),
  // Wrist roller: arms straight out in front, the hands roll the bar; the weight hangs on its rope
  "wrist-roller": T({ base: { ua: 88, fa: 88, pl: 5 }, A: { pa: 90 }, B: { pa: 150 }, props: [{ tip: 1 }, { pad: "tip", r: 2.6 }, { hang: "ha", len: 30, plate: 8 }] }, { joint: "tip", dir: "up" }, "none"),
  // Standing reverse wrist curl: bar in front of the thighs, the backs of the hands lift
  "wrist-curl-standing": T({ base: { ua: 6, fa: 6, pl: 6 }, A: { pa: 0 }, B: { pa: 75 }, props: [{ tip: 1 }, { pad: "tip", r: 2.6 }] }, { joint: "tip", dir: "up" }, "none"),
  // Side-lying hip abduction (front view turned on its side): the top leg lifts
  "hip-abduction-lying": T({ v: "f", base: { rot: -90, cx: 104, lift: 5, sa: 2, ua: 150, fa: 250, al: 0.8, fl: 0.8, L: { ua: 0, fa: 0 }, laL: 4, saL: 2 }, A: { la: 4 }, B: { la: 38 }, props: [] }, { joint: "knR", dir: "up" }, "none"),
  // Lying neck side raise: on the side on a bench, head off the end; the ear lifts toward the top shoulder
  "neck-side-raise-lying": T({ v: "f", base: { rot: -90, cx: 110, lift: 18, la: 3, sa: 2, ua: 150, fa: 250, al: 0.8, fl: 0.8, L: { ua: 0, fa: 0 } }, A: { hn: -20 }, B: { hn: 28 }, props: [{ line: [30, 92, 116, 92] }, { line: [36, 92, 36, 104] }, { line: [110, 92, 110, 104] }] }, { joint: "head", dir: "up" }, "none"),
  // Seated neck side bend (front view): torso still, the head tilts to one side against a pad
  "neck-side-bend-seated": T({ v: "f", base: { hy: 66, lf: 0.45, la: 12, sa: 4, ua: 20, fa: 20 }, A: { hn: 0 }, B: { hn: 28 }, props: [{ line: [44, 68, 76, 68] }, { line: [98, -6, 98, 104] }, { cable: [98, 18], to: "head" }] }, { joint: "head", dir: "away" }, "none"),
  // Assisted dip machine: kneeling on the assist pad, hands on the bars
  "dip-assisted": T({ base: { th: 20, sh: -40 }, A: { hy: 48, t: 10, ua: 0, fa: 0 }, B: { hy: 60, t: 25, ua: -60, fa: 15 }, props: [{ line: [40, 88, 70, 88] }, { pad: "kn", r: 3 }] }, { joint: "sh", dir: "down" }, "none"),
  // Seated overhead machine extension: upper arms up on the pad, hands from behind the head to straight up
  "overhead-extension-machine": T({ base: { hx: 50, hy: 80, t: 0, th: 88, sh: 0, ua: 172 }, A: { fa: 330 }, B: { fa: 172 }, props: [{ line: [38, 84, 62, 84] }, { line: [50, 84, 50, 104] }] }, { joint: "ha", dir: "up" }, "none"),
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
  // Variants: "<template>-seated", "-kneeling", "-flat", "-incline", "-decline" when the adjustment asks for one and it exists
  const variant = adj.seated ? "-seated" : adj.kneeling ? "-kneeling" : adj.bench ? "-" + adj.bench : "";
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
