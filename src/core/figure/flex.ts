// Bicep bump for the flex pose: a small arc that rises on top of each upper arm. Pure geometry.
import type { FigureFrame, Pt } from "./engine";

/**
 * Quadratic curves [start, control, end] over each upper arm (front view lines 1 = right arm, 3 = left arm:
 * [shoulder, elbow, hand]). k = 0 → flat (no bump), 1 → full bump of `height` units, peaking toward the head side (up).
 */
export function bicepBumps(frame: FigureFrame, k: number, height = 2.5): [Pt, Pt, Pt][] {
  return [frame.main[1], frame.main[3]].filter(Boolean).map((arm) => {
    const [sh, el] = arm;
    const at = (t: number): Pt => [sh[0] + (el[0] - sh[0]) * t, sh[1] + (el[1] - sh[1]) * t];
    const a = at(0.16), b = at(0.66), m = at(0.41);
    // Perpendicular pointing up (negative y) so the bump grows above the arm line.
    const dx = el[0] - sh[0], dy = el[1] - sh[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const h = 2 * height * Math.max(0, Math.min(1, k)); // quadratic control at 2× gives a peak of `height`
    return [a, [m[0] + nx * h, m[1] + ny * h], b];
  });
}

export const bumpsToSvg = (bumps: [Pt, Pt, Pt][]) =>
  `<g class="bump">${bumps.map(([a, c, b]) => `<path d="M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}"/>`).join("")}</g>`;
