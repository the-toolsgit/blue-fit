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

/** Loading: a dumbbell curl. */
export const LOADING: FigureSpec = { base: { ua: 0 }, A: { fa: 0 }, B: { fa: 145 }, props: [{ db: "ha" }] };
