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

/**
 * Parts drawn with a labeled line when a muscle is zoomed in (Plan → Your week). `ref` is the muscle group whose
 * color the line takes (shoulders), or "job:<name>" for one of the muscle's jobs (core/workoutCheck.ts JOBS): green
 * when the plan hits it. Points are on the figure's right side (x > 60), in the view's coordinates.
 * Every muscle with 2+ jobs has its parts here, so the zoom shows every angle the plan should cover.
 */
export interface MapPart { ref: string; x: number; y: number; label: string }
export const MAP_PARTS: Partial<Record<MuscleGroup, Partial<Record<MapView, MapPart[]>>>> = {
  frontDelts: { front: [{ ref: "frontDelts", x: 82.5, y: 39.5, label: "front" }, { ref: "sideDelts", x: 88.5, y: 45, label: "side" }], back: [{ ref: "rearDelts", x: 84, y: 40.5, label: "rear" }, { ref: "sideDelts", x: 88.6, y: 46, label: "side" }] },
  biceps: { front: [{ ref: "job:long head", x: 89, y: 55, label: "long head" }, { ref: "job:short head", x: 85.3, y: 60, label: "short head" }, { ref: "job:brachialis", x: 88.6, y: 68, label: "brachialis" }] },
  triceps: { back: [{ ref: "job:long head", x: 86, y: 55, label: "long head" }, { ref: "job:lateral head", x: 90, y: 58, label: "lateral head" }, { ref: "job:medial head", x: 88.5, y: 67, label: "medial head" }] },
  traps: { back: [{ ref: "job:shrug", x: 66, y: 29.5, label: "upper" }, { ref: "job:mid/lower", x: 64, y: 46, label: "mid/lower" }] },
  chest: { front: [{ ref: "job:upper", x: 70, y: 39, label: "upper" }, { ref: "job:mid/lower", x: 70, y: 48.5, label: "mid/lower" }] },
  calves: { back: [{ ref: "job:straight-knee", x: 71.5, y: 163, label: "upper" }, { ref: "job:bent-knee", x: 72, y: 179, label: "lower" }] },
  back: { back: [{ ref: "job:upper back", x: 67, y: 46, label: "upper back" }, { ref: "job:lats", x: 73, y: 64, label: "lats" }, { ref: "job:lower back", x: 63.5, y: 84, label: "lower back" }] },
  glutes: { back: [{ ref: "job:glute medius", x: 73.5, y: 98, label: "medius" }, { ref: "job:glute max", x: 69, y: 107, label: "max" }] },
  abs: { front: [{ ref: "job:rectus abs", x: 65, y: 66, label: "rectus" }, { ref: "job:obliques", x: 70.5, y: 78, label: "obliques" }] },
  quads: { front: [{ ref: "job:extension", x: 70.5, y: 114, label: "extension" }, { ref: "job:squat", x: 76, y: 130, label: "squat" }] },
  hamstrings: { back: [{ ref: "job:hip hinge", x: 70, y: 120, label: "hip hinge" }, { ref: "job:knee flexion", x: 72, y: 140, label: "knee flexion" }] },
  forearms: { front: [{ ref: "job:flexors", x: 92, y: 89, label: "flexors" }], back: [{ ref: "job:extensors", x: 92, y: 89, label: "extensors" }] },
  neck: { front: [{ ref: "job:flexion", x: 62.2, y: 25.5, label: "flexion" }], back: [{ ref: "job:extension", x: 61.5, y: 23.2, label: "extension" }] },
};
/** The three delts zoom together as "shoulders" */
export const SHOULDERS: MuscleGroup[] = ["frontDelts", "sideDelts", "rearDelts"];
export const partsKey = (g: MuscleGroup): MuscleGroup => (SHOULDERS.includes(g) ? "frontDelts" : g);

/** Zoom box (x, y, w, h) on a muscle's right-side shapes, same proportions as the whole view, with the muscle in the
 *  left ~40% so labels fit on the right. Shapes across the middle (traps on the back) use their right half. */
export function zoomBox(g: MuscleGroup, view: MapView): [number, number, number, number] {
  const groups = SHOULDERS.includes(g) ? SHOULDERS : [g];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of regionsFor(view)) {
    if (!groups.includes(r.group)) continue;
    const s = r.shape;
    const xs = s.kind === "ellipse" ? [s.cx - s.ry, s.cx + s.ry] : s.points.map((q) => q[0]);
    const ys = s.kind === "ellipse" ? [s.cy - s.ry, s.cy + s.ry] : s.points.map((q) => q[1]);
    if (Math.max(...xs) <= MAP_W / 2) continue; // left-side copy
    x0 = Math.min(x0, Math.max(MAP_W / 2 - 2, Math.min(...xs))); x1 = Math.max(x1, ...xs);
    y0 = Math.min(y0, ...ys); y1 = Math.max(y1, ...ys);
  }
  if (!Number.isFinite(x0)) return [0, 0, MAP_W, MAP_H];
  const w = Math.max((x1 - x0) / 0.4, ((y1 - y0 + 14) * MAP_W) / MAP_H), h = (w * MAP_H) / MAP_W;
  return [x0 - w * 0.12, (y0 + y1) / 2 - h / 2, w, h];
}
/** Which side to show a muscle on: back for the back-only ones, else front */
export const viewOf = (g: MuscleGroup): MapView => (REGIONS.some((r) => r.group === g && r.view === "front") && !["traps", "calves", "triceps", "back", "glutes", "hamstrings"].includes(g) ? "front" : "back");
