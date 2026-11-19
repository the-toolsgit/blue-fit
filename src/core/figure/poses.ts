// Brand poses in the same spec format as exercise figures.
import type { FigureSpec } from "../types";

/** Logo: front double-biceps flex. */
export const FLEX: FigureSpec = { v: "f", base: { hy: 60, la: 9, sa: 3 }, A: { ua: 76, fa: 150 }, B: { ua: 92, fa: 182, shr: 1.5 }, props: [] };

/** Rest day: sitting back on a bench, breathing slowly. */
export const REST: FigureSpec = {
  base: { hx: 56, hy: 82, th: 86, sh: 4 },
  A: { t: -24, ua: -26, fa: -22 },
  B: { t: -19, ua: -22, fa: -18 },
  props: [{ line: [18, 87, 76, 87] }, { line: [24, 87, 24, 104] }, { line: [70, 87, 70, 104] }],
};

/** Empty states: a dumbbell curl. */
export const CURL: FigureSpec = { base: { ua: 0 }, A: { fa: 0 }, B: { fa: 145 }, props: [{ db: "ha" }] };

/** Loading: running to the right (both legs and arms, each pair half a stride apart). */
export const LOADING: FigureSpec = { base: { hx: 58, hy: 61, t: 12 }, A: { th: 45, sh: 5, ua: -45, fa: 50 }, B: { th: -30, sh: -95, ua: 40, fa: 125 }, props: [{ run: true }] };
/** Loading run speed: one stride each way, no pauses */
export const LOADING_TIMING = { ab: 340, holdB: 0, ba: 340, holdA: 0 };

/**
 * Splash flex: upper arms stay flat (horizontal); forearms rotate inward toward the head.
 * Pair with bicepBumps() for the bicep that rises on top of each upper arm. Same head as FLEX.
 */
export const SPLASH_FLEX: FigureSpec = { v: "f", base: { hy: 60, la: 9, sa: 3, ua: 90 }, A: { fa: 180 }, B: { fa: 200 }, props: [] };
