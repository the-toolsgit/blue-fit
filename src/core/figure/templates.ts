// Movement templates for the exercise database (docs/plans/exercise-database.md §3): one figure per movement, built
// with the figure engine, plus a pure builder that adds an exercise's adjustments and equipment. Pose A is always where
// the tempo's first move starts (startsAt "A"), so the animation follows the tempo text. Pure and framework-free.
import type { FigureSpec } from "../types";

export interface Template {
  spec: FigureSpec;
  /** Pose the tempo's first move starts from */
  startsAt: "A" | "B";
  /** What the hands (or hips) do on the first move, checked by tests: "down" = moves down the screen, etc. */
  firstMove: { joint: "ha" | "hip" | "sh" | "haR" | "an" | "knR"; dir: "up" | "down" | "toward" | "away" };
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
  "press-machine-seated": T({ base: { hx: 48, hy: 80, t: 0, th: 88, sh: 0 }, A: { ua: -50, fa: 92 }, B: { ua: 90, fa: 90 }, props: [{ line: [36, 84, 60, 84] }, { line: [48, 84, 48, 104] }, { line: [44, 82, 44, 40] }] }, { joint: "ha", dir: "away" }, "none"),
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
  "ab-wheel": T({ base: { hx: 50, hy: 78, th: 0, sh: -90, nofoot: 1 }, A: { t: 40, ua: 15, fa: 15 }, B: { t: 78, ua: 100, fa: 100 }, props: [] }, { joint: "ha", dir: "away" }, "none"),
  woodchop: T({ v: "f", base: { L: { ua: 120, fa: 120 } }, A: { ua: 140, fa: 140 }, B: { ua: 20, fa: 10 }, props: [{ cable: [112, -12], to: "haR" }] }, { joint: "haR", dir: "down" }, "none"),
  "side-bend": T({ v: "f", base: { L: { ua: 4, fa: 4 } }, A: { rot: 0, ua: 4, fa: 4 }, B: { rot: 16, ua: 4, fa: 4 }, props: [{ db: "haR" }] }, { joint: "haR", dir: "down" }, "none"),
  // ── Forearms and neck ──
  "wrist-curl": T({ base: { hx: 50, hy: 80, t: 20, th: 88, sh: 0, ua: 30 }, A: { fa: 70 }, B: { fa: 100 }, props: [{ line: [38, 84, 62, 84] }, { line: [50, 84, 50, 104] }] }, { joint: "ha", dir: "up" }, "db"),
  "neck-flexion": T({ base: { hx: 74, hy: 84, th: 100, sh: 0, ua: 80, fa: 260 }, A: { t: -96 }, B: { t: -74 }, props: [{ line: [40, 88, 86, 88] }, { line: [56, 88, 56, 104] }] }, { joint: "sh", dir: "up" }, "none"),
  "neck-extension": T({ base: { hx: 44, hy: 84, th: -100, sh: 0, ua: -80, fa: -260 }, A: { t: 96 }, B: { t: 74 }, props: [{ line: [30, 88, 78, 88] }, { line: [62, 88, 62, 104] }] }, { joint: "sh", dir: "up" }, "none"),

  // ── Added for the writers' poor fits (phase 2) ──
  "lateral-raise-lean-in": T({ v: "f", base: { cx: 70, la: 0, sa: 0, hw: 1.5, rot: -14, L: { ua: -60, fa: -60 } }, A: { ua: 8, fa: 8 }, B: { ua: 92, fa: 92 }, props: [{ line: [98, -14, 98, 104] }, { line: [92, 104, 104, 104] }] }, { joint: "haR", dir: "up" }, "db"),
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
