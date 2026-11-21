// Icons for the exercise picker's filter sheet, in the line man's neon style.
// Equipment: a drawn detail of the gear (bodyweight uses the line man instead, from the caller).
// Muscle: a close-up of the muscle map, the chosen muscle lit and the body outline around it.
import { GUIDES, HEAD, OUTLINE, regionsFor, viewOf, type Pt, type RegionShape } from "../../core/muscleMap";
import type { Equipment, MuscleGroup } from "../../core/types";
import type { ReactElement } from "react";

const glow = { filter: "drop-shadow(0 0 3px var(--fig-glow))" };
const line = { fill: "none", stroke: "var(--fig)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const soft = { ...line, stroke: "var(--fig2)", strokeWidth: 1.4 } as const;

const DRAW: Partial<Record<Equipment, ReactElement>> = {
  // Close-up of one end of the bar: big plate, smaller plates, collar, sleeve
  barbell: <>
    <path d="M2 24h12M33 24h13" {...line} />
    <rect x="14" y="7" width="6" height="34" rx="1.5" {...line} />
    <rect x="21" y="12" width="4.5" height="24" rx="1.2" {...line} />
    <rect x="26.5" y="16" width="3" height="16" rx="1" {...line} />
    <rect x="30" y="20.5" width="3" height="7" rx="0.8" {...line} />
  </>,
  // Hex dumbbell
  dumbbell: <>
    <path d="M6 15l5-3 5 3v18l-5 3-5-3z M32 15l5-3 5 3v18l-5 3-5-3z" {...line} />
    <path d="M16 24h16" {...line} strokeWidth={3} />
    <path d="M20 22v4M24 22v4M28 22v4" {...soft} />
  </>,
  // EZ bar with welded plate ends
  fixedBar: <>
    <path d="M8 24h7l3-4 4 8 4-8 4 8 3-4h7" {...line} />
    <rect x="2" y="14" width="6" height="20" rx="1.5" {...line} />
    <rect x="40" y="14" width="6" height="20" rx="1.5" {...line} />
  </>,
  // Pulley, cable and D-handle
  cable: <>
    <path d="M24 2v4" {...line} />
    <circle cx="24" cy="12" r="6" {...line} />
    <circle cx="24" cy="12" r="1.3" fill="var(--fig)" />
    <path d="M30 12v20" {...line} />
    <path d="M24 32h12l-2 9h-8z" {...line} />
  </>,
  // Weight stack on guide rods, with the pin
  machine: <>
    <path d="M17 3v42M31 3v42" {...soft} />
    <path d="M24 3v8" {...line} />
    {[11, 17, 23, 29, 35].map((y) => <rect key={y} x="12" y={y} width="24" height="5" rx="1" {...line} />)}
    <path d="M36 25.5h7" {...line} /><circle cx="44" cy="25.5" r="1.6" {...line} />
  </>,
  // Lever arm on a pivot with a plate on its horn
  plateMachine: <>
    <path d="M6 42h20M12 42l6-14" {...line} />
    <circle cx="18" cy="28" r="2.5" {...line} />
    <path d="M18 28l18-16" {...line} />
    <circle cx="35" cy="13" r="9" {...line} />
    <circle cx="35" cy="13" r="2.5" {...line} />
    <path d="M18 28l-12-4" {...line} />
  </>,
  // Rails, bar on hooks, plates
  smith: <>
    <path d="M9 3v40M39 3v40M4 44h40" {...line} />
    <path d="M3 21h42" {...line} />
    <path d="M14 21v4M34 21v4" {...soft} />
    <rect x="11" y="14" width="3" height="14" rx="1" {...line} />
    <rect x="34" y="14" width="3" height="14" rx="1" {...line} />
  </>,
  // Kettlebell
  other: <>
    <path d="M17 19c-2-10 16-10 14 0" {...line} />
    <path d="M14 22a12 12 0 1 0 20 0z" {...line} />
    <path d="M17 41h14" {...soft} />
  </>,
};

export function EquipmentIcon({ eq, size = 44 }: { eq: Equipment; size?: number }) {
  const d = DRAW[eq] ?? DRAW.other;
  return <svg viewBox="0 0 48 48" width={size} height={size} style={glow} aria-hidden>{d}</svg>;
}

const ONE_SIDE: MuscleGroup[] = ["biceps", "triceps", "forearms", "frontDelts", "sideDelts", "rearDelts", "quads", "hamstrings", "calves", "adductors"];
const pts = (l: Pt[]) => l.map((q) => q.join(",")).join(" ");
const bounds = (s: RegionShape): [number, number, number, number] => {
  if (s.kind === "ellipse") { const r = Math.max(s.rx, s.ry); return [s.cx - r, s.cy - r, s.cx + r, s.cy + r]; }
  const xs = s.points.map((q) => q[0]), ys = s.points.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

export function MuscleIcon({ group, size = 48 }: { group: MuscleGroup | null; size?: number }) {
  const view = group ? viewOf(group) : "front";
  const regions = regionsFor(view);
  // Square box around the muscle (both sides), padded so some outline shows; whole body for "All"
  let box = [0, 0, 120, 210];
  if (group) {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    // Limbs and delts: zoom on one side (the figure's right) so the muscle fills the icon
    const one = ONE_SIDE.includes(group);
    for (const r of regions) if (r.group === group) { const b = bounds(r.shape); if (one && b[2] <= 60) continue; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    if (Number.isFinite(x0)) {
      const side = Math.max(x1 - x0, y1 - y0, 22) * 1.5;
      box = [(x0 + x1) / 2 - side / 2, (y0 + y1) / 2 - side / 2, side, side];
    }
  } else box = [-45, 0, 210, 210];
  const k = box[2] / 48; // keep line widths the same at every zoom
  return (
    <svg viewBox={box.join(" ")} width={size} height={size} style={glow} aria-hidden>
      {regions.map(({ group: g, shape }, i) => {
        const on = !group || g === group;
        const p = { fill: "var(--neon)", fillOpacity: on ? (group ? 0.85 : 0.5) : 0.06, stroke: "var(--neon)", strokeOpacity: on ? 1 : 0.2, strokeWidth: 0.6 * k };
        return shape.kind === "ellipse"
          ? <ellipse key={i} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} transform={`rotate(${shape.rot ?? 0} ${shape.cx} ${shape.cy})`} {...p} />
          : <polygon key={i} points={pts(shape.points)} {...p} />;
      })}
      {OUTLINE.map((l, i) => <polyline key={i} points={pts(l)} fill="none" stroke="var(--fig)" strokeWidth={1.3 * k} strokeLinecap="round" strokeLinejoin="round" />)}
      {GUIDES[view].map((l, i) => <polyline key={"g" + i} points={pts(l)} fill="none" stroke="var(--fig2)" strokeWidth={0.7 * k} />)}
      <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill="none" stroke="var(--fig)" strokeWidth={1.3 * k} />
    </svg>
  );
}
