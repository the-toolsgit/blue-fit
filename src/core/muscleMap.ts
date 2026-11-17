// Muscle map geometry: front and back body outline in the figure's line style, plus one
// shape per muscle region. Pure data (portable). Each view is 120 × 210, centered on x = 60.
// Shapes are drawn for the figure's right side (viewer's right) and mirrored when `mirror` is set.
import type { MuscleGroup } from "./types";

export type MapView = "front" | "back";
export type Pt = [number, number];
export type RegionShape = { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; rot?: number } | { kind: "poly"; points: Pt[] };
export interface MapRegion { group: MuscleGroup; view: MapView; shape: RegionShape; mirror: boolean }

export const MAP_W = 120, MAP_H = 210;

/** Outline polylines for one side; mirrored for the other. */
const SIDE_OUTLINE: Pt[][] = [
  [[64, 24], [64, 28], [78, 31], [86, 35], [89, 42]],
  [[89, 42], [92, 60], [95, 80], [98, 104]],
  [[81, 48], [84, 62], [87, 80], [92, 105]],
  [[78, 42], [77, 62], [75, 82], [77, 98]],
  [[77, 98], [80, 128], [77, 160], [76, 196], [80, 199]],
  [[61, 110], [64, 140], [65, 162], [66, 196], [70, 199]],
];
const mirrorPt = (p: Pt): Pt => [MAP_W - p[0], p[1]];
export const OUTLINE: Pt[][] = [...SIDE_OUTLINE, ...SIDE_OUTLINE.map((l) => l.map(mirrorPt)), [[59, 110], [61, 110]]];
export const HEAD = { cx: 60, cy: 13, r: 9 };
/** Faint guide lines (center line front, spine back) */
export const GUIDES: Record<MapView, Pt[][]> = {
  front: [[[60, 34], [60, 92]]],
  back: [[[60, 28], [60, 96]]],
};

const e = (cx: number, cy: number, rx: number, ry: number, rot = 0): RegionShape => ({ kind: "ellipse", cx, cy, rx, ry, rot });
const p = (...points: Pt[]): RegionShape => ({ kind: "poly", points });

export const REGIONS: MapRegion[] = [
  // front
  { group: "traps", view: "front", shape: p([64, 28], [75, 30.5], [67, 33]), mirror: true },
  { group: "frontDelts", view: "front", shape: e(82.5, 39.5, 4.6, 6, -20), mirror: true },
  { group: "sideDelts", view: "front", shape: e(88, 44, 2.6, 7, -12), mirror: true },
  { group: "chest", view: "front", shape: p([62, 36], [76.5, 36], [77.5, 47], [70, 53], [62, 51]), mirror: true },
  { group: "biceps", view: "front", shape: e(87, 60, 3.6, 10, -10), mirror: true },
  { group: "forearms", view: "front", shape: e(92, 89, 3.6, 13, -10), mirror: true },
  { group: "quads", view: "front", shape: p([66, 104], [77, 101], [79, 128], [74.5, 151], [67, 149], [64.5, 124]), mirror: true },
  { group: "adductors", view: "front", shape: p([61.5, 110], [65.5, 107], [64, 127], [62.5, 134]), mirror: true },
  { group: "calves", view: "front", shape: e(75, 172, 2.4, 12, 4), mirror: true },
  { group: "abs", view: "front", shape: p([61.5, 55], [70, 54.5], [71.5, 70], [70.5, 86], [61.5, 92]), mirror: true },
  { group: "neck", view: "front", shape: p([60.8, 22.6], [63.4, 22.6], [63.6, 27.6], [60.8, 28.6]), mirror: true },
  // back
  { group: "traps", view: "back", shape: p([60, 24], [67, 28.5], [79, 32], [70, 41], [60, 62], [50, 41], [41, 32], [53, 28.5]), mirror: false },
  { group: "rearDelts", view: "back", shape: e(84, 40.5, 4.8, 5.5, 20), mirror: true },
  { group: "sideDelts", view: "back", shape: e(88.4, 45, 2.4, 6.5, -12), mirror: true },
  { group: "rotatorCuff", view: "back", shape: e(71.5, 46, 5, 3.6, 18), mirror: true },
  { group: "back", view: "back", shape: p([62, 60], [74, 50], [77.5, 58], [76, 76], [69, 86], [62, 88]), mirror: true },
  { group: "triceps", view: "back", shape: e(87.6, 60, 3.8, 10.5, -10), mirror: true },
  { group: "forearms", view: "back", shape: e(92, 89, 3.6, 13, -10), mirror: true },
  { group: "glutes", view: "back", shape: e(68.5, 104, 8.4, 8.6), mirror: true },
  { group: "hamstrings", view: "back", shape: p([63.5, 115], [77, 113], [78, 136], [72.5, 151], [65.5, 149]), mirror: true },
  { group: "calves", view: "back", shape: e(71, 170, 4.8, 13, 3), mirror: true },
  { group: "neck", view: "back", shape: p([56.6, 21.8], [63.4, 21.8], [63.6, 25.2], [60, 23.6], [56.4, 25.2]), mirror: false },
];

/** Region shapes for a view, with mirrored copies expanded. */
export function regionsFor(view: MapView): { group: MuscleGroup; shape: RegionShape }[] {
  return REGIONS.filter((r) => r.view === view).flatMap((r) => {
    if (!r.mirror) return [{ group: r.group, shape: r.shape }];
    const m: RegionShape = r.shape.kind === "ellipse"
      ? { ...r.shape, cx: MAP_W - r.shape.cx, rot: -(r.shape.rot ?? 0) }
      : { kind: "poly", points: r.shape.points.map(mirrorPt) };
    return [{ group: r.group, shape: r.shape }, { group: r.group, shape: m }];
  });
}
