// Front + back muscle map in the figure's neon line style. Regions shade by value (0–1) or recovery status.
import { GUIDES, HEAD, MAP_H, MAP_W, OUTLINE, regionsFor, type MapView } from "../../core/muscleMap";
import type { Recovery } from "../../core/recovery";
import { muscleLabel, type MuscleGroup } from "../../core/types";

const pts = (l: number[][]) => l.map((q) => q.join(",")).join(" ");
export const RECOVERY_COLOR: Record<Recovery, string> = { recovering: "var(--recovering)", partial: "var(--warn)", fresh: "var(--good)" };
/** This week's sets against the target, in clear steps (Progress map): not trained = outline only */
export type VolumeStage = "none" | "started" | "half" | "target" | "above";
export const STAGE_STYLE: Record<VolumeStage, { color: string; fill: number; label: string }> = {
  none: { color: "var(--map-guide)", fill: 0, label: "Not yet" },
  // Gray, not the accent (Nov 27 2026): only In target and Above are colors
  started: { color: "var(--map-line)", fill: 0.22, label: "Started" },
  half: { color: "var(--map-half)", fill: 0.62, label: "Halfway" },
  target: { color: "var(--good)", fill: 0.75, label: "In target" },
  above: { color: "var(--pink-2)", fill: 0.75, label: "Above" },
};

export function MuscleMap({ intensity, recovery, stage, selected, onSelect }: {
  intensity?: Partial<Record<MuscleGroup, number>>;
  stage?: Partial<Record<MuscleGroup, VolumeStage>>;
  recovery?: Partial<Record<MuscleGroup, Recovery>>;
  selected?: MuscleGroup | null;
  onSelect?: (g: MuscleGroup) => void;
}) {
  const view = (v: MapView, x: number) => (
    <g transform={`translate(${x},0)`}>
      {regionsFor(v).map(({ group, shape }, i) => {
        const k = Math.max(0, Math.min(1, intensity?.[group] ?? 0));
        const rec = recovery?.[group];
        const st = stage ? STAGE_STYLE[stage[group] ?? "none"] : null;
        const color = st ? st.color : rec ? RECOVERY_COLOR[rec] : "var(--neon)";
        const opacity = st ? st.fill : rec ? (rec === "fresh" ? 0.16 : 0.75) : k > 0 ? 0.14 + 0.7 * k : 0.05;
        const glow = st ? st.fill >= 0.7 : rec ? rec !== "fresh" : k > 0.55;
        const sel = selected === group;
        const props = {
          fill: color, fillOpacity: sel ? Math.max(opacity, 0.5) : opacity,
          stroke: sel ? "var(--ink)" : color, strokeOpacity: sel ? 0.9 : st ? (st.fill >= 0.7 ? 1 : st.fill ? 0.55 : 0.7) : Math.min(1, opacity + 0.15), strokeWidth: sel ? 1.2 : 0.6,
          style: { filter: glow ? `drop-shadow(0 0 3px ${color})` : undefined, transition: "fill-opacity .6s var(--ease)", cursor: onSelect ? "pointer" : undefined },
          onClick: onSelect ? () => onSelect(group) : undefined,
        };
        return shape.kind === "ellipse"
          ? <ellipse key={i} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} transform={`rotate(${shape.rot ?? 0} ${shape.cx} ${shape.cy})`} {...props}><title>{muscleLabel(group)}</title></ellipse>
          : <polygon key={i} points={pts(shape.points)} {...props}><title>{muscleLabel(group)}</title></polygon>;
      })}
      <g style={{ pointerEvents: "none" }}>
        {OUTLINE.map((l, i) => <polyline key={i} points={pts(l)} fill="none" stroke="var(--map-line)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />)}
        {GUIDES[v].map((l, i) => <polyline key={"g" + i} points={pts(l)} fill="none" stroke="var(--map-guide)" strokeWidth={0.8} />)}
        <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill="none" stroke="var(--map-line)" strokeWidth={1.5} />
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
