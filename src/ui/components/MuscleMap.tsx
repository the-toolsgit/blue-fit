// Front + back muscle map in the figure's neon line style. Regions shade by value (0–1) or recovery status.
import { GUIDES, HEAD, MAP_H, MAP_W, OUTLINE, regionsFor, type MapView } from "../../core/muscleMap";
import type { Recovery } from "../../core/recovery";
import { muscleLabel, type MuscleGroup } from "../../core/types";

const pts = (l: number[][]) => l.map((q) => q.join(",")).join(" ");
export const RECOVERY_COLOR: Record<Recovery, string> = { recovering: "var(--recovering)", partial: "var(--warn)", fresh: "var(--good)" };

export function MuscleMap({ intensity, recovery, selected, onSelect }: {
  intensity?: Partial<Record<MuscleGroup, number>>;
  recovery?: Partial<Record<MuscleGroup, Recovery>>;
  selected?: MuscleGroup | null;
  onSelect?: (g: MuscleGroup) => void;
}) {
  const view = (v: MapView, x: number) => (
    <g transform={`translate(${x},0)`}>
      {regionsFor(v).map(({ group, shape }, i) => {
        const k = Math.max(0, Math.min(1, intensity?.[group] ?? 0));
        const rec = recovery?.[group];
        const color = rec ? RECOVERY_COLOR[rec] : "var(--neon)";
        const opacity = rec ? (rec === "fresh" ? 0.16 : 0.75) : k > 0 ? 0.14 + 0.7 * k : 0.05;
        const sel = selected === group;
        const props = {
          fill: color, fillOpacity: sel ? Math.max(opacity, 0.5) : opacity,
          stroke: sel ? "var(--ink)" : color, strokeOpacity: sel ? 0.9 : Math.min(1, opacity + 0.15), strokeWidth: sel ? 1.2 : 0.6,
          style: { filter: (rec ? rec !== "fresh" : k > 0.55) ? `drop-shadow(0 0 3px ${color})` : undefined, transition: "fill-opacity .6s var(--ease)", cursor: onSelect ? "pointer" : undefined },
          onClick: onSelect ? () => onSelect(group) : undefined,
        };
        return shape.kind === "ellipse"
          ? <ellipse key={i} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} transform={`rotate(${shape.rot ?? 0} ${shape.cx} ${shape.cy})`} {...props}><title>{muscleLabel(group)}</title></ellipse>
          : <polygon key={i} points={pts(shape.points)} {...props}><title>{muscleLabel(group)}</title></polygon>;
      })}
      <g style={{ pointerEvents: "none" }}>
        {OUTLINE.map((l, i) => <polyline key={i} points={pts(l)} fill="none" stroke="var(--fig)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />)}
        {GUIDES[v].map((l, i) => <polyline key={"g" + i} points={pts(l)} fill="none" stroke="var(--fig2)" strokeWidth={0.8} />)}
        <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill="none" stroke="var(--fig)" strokeWidth={1.5} />
      </g>
      <text x={MAP_W / 2} y={MAP_H + 12} textAnchor="middle" fill="var(--muted)" style={{ font: "600 9px var(--body)", letterSpacing: ".16em" }}>{v.toUpperCase()}</text>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${MAP_W * 2 + 16} ${MAP_H + 16}`} width="100%" style={{ display: "block", maxWidth: 420, margin: "0 auto", filter: "drop-shadow(0 0 4px var(--glow-soft))" }} role="img" aria-label="Muscle map, front and back">
      {view("front", 0)}
      {view("back", MAP_W + 16)}
    </svg>
  );
}
