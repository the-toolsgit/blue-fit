// Hand-drawn neon SVG charts: line (with area) and bars. Tap or drag to read a value.
import { useId, useState, type PointerEvent } from "react";
import { fmtDate } from "../format";

const W = 320, PL = 34, PR = 10, PT = 12, PB = 22;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const shortNum = (n: number) => (Math.abs(n) >= 10000 ? `${Math.round(n / 1000)}k` : Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n * 10) / 10}`);

export interface ChartPoint { label: string; value: number; sub?: string }

function useReadout(n: number, x0: number, step: number) {
  const [i, setI] = useState<number | null>(null);
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    setI(Math.max(0, Math.min(n - 1, Math.round((x - x0) / (step || 1)))));
  };
  return { i, onMove, clear: () => setI(null) };
}

function Readout({ p, fmt, unit }: { p?: ChartPoint; fmt: (n: number) => string; unit?: string }) {
  return (
    <div className="spread" style={{ minHeight: 22, fontSize: 13 }}>
      <span className="muted">{p ? p.label : "Tap the chart"}</span>
      {p && <span className="mono" style={{ color: "var(--neon-ink)" }}>{fmt(p.value)}{unit ? ` ${unit}` : ""}{p.sub ? <span className="muted"> · {p.sub}</span> : null}</span>}
    </div>
  );
}

export function LineChart({ points, height = 150, fmt = shortNum, unit, band }: { points: ChartPoint[]; height?: number; fmt?: (n: number) => string; unit?: string; band?: { min: number | null; max: number | null } }) {
  const id = useId().replace(/:/g, "");
  const H = height;
  const vals = points.map((p) => p.value);
  const lo0 = Math.min(...vals, band?.min ?? Infinity), hi0 = Math.max(...vals, band?.max ?? band?.min ?? -Infinity);
  const pad = (hi0 - lo0) * 0.15 || Math.max(1, hi0 * 0.1);
  const lo = Math.max(0, lo0 - pad), hi = hi0 + pad;
  const step = points.length > 1 ? (W - PL - PR) / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? PL + i * step : (W + PL - PR) / 2);
  const y = (v: number) => PT + (1 - (v - lo) / (hi - lo || 1)) * (H - PT - PB);
  const { i, onMove, clear } = useReadout(points.length, PL, step);
  if (!points.length) return <div className="muted" style={{ fontSize: 13, padding: "18px 0", textAlign: "center" }}>No data yet</div>;
  const d = points.map((p, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const sel = i ?? points.length - 1;
  return (
    <div>
      <Readout p={i != null ? points[i] : points[points.length - 1]} fmt={fmt} unit={unit} />
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", touchAction: "pan-y" }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={clear} role="img" aria-label="Line chart">
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--neon)" stopOpacity=".35" /><stop offset="1" stopColor="var(--neon)" stopOpacity="0" /></linearGradient>
          <linearGradient id={`l${id}`}><stop offset="0" stopColor="var(--neon-ink)" /><stop offset="1" stopColor="var(--neon-ink-2)" /></linearGradient>
        </defs>
        {[lo, (lo + hi) / 2, hi].map((t, k) => (
          <g key={k}><line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={PL - 6} y={y(t) + 3} textAnchor="end" fill="var(--muted)" style={{ font: "500 9px var(--mono)" }}>{shortNum(t)}</text></g>
        ))}
        {band && band.min != null && <rect x={PL} width={W - PL - PR} y={y(Math.min(hi, band.max ?? hi))} height={Math.max(0, y(band.min) - y(Math.min(hi, band.max ?? hi)))} fill="var(--good)" opacity=".08" />}
        {points.length > 1 && <path d={`${d} L${x(points.length - 1)},${H - PB} L${x(0)},${H - PB} Z`} fill={`url(#a${id})`} className="chart-area" />}
        <path d={d} fill="none" stroke={`url(#l${id})`} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="chart-line" style={{ filter: "drop-shadow(0 0 4px var(--glow))" }} />
        {points.map((p, k) => <circle key={k} cx={x(k)} cy={y(p.value)} r={k === sel ? 4.5 : points.length > 24 ? 0 : 2.2} fill={k === sel ? "var(--neon-ink-2)" : "var(--neon-ink)"} style={k === sel ? { filter: "drop-shadow(0 0 6px var(--neon-2))" } : undefined} />)}
        {i != null && <line x1={x(i)} x2={x(i)} y1={PT} y2={H - PB} stroke="var(--line-strong)" />}
        <text x={x(0)} y={H - 6} fill="var(--muted)" textAnchor={points.length > 1 ? "start" : "middle"} style={{ font: "500 9px var(--body)" }}>{points[0].label}</text>
        {points.length > 1 && <text x={x(points.length - 1)} y={H - 6} fill="var(--muted)" textAnchor="end" style={{ font: "500 9px var(--body)" }}>{points[points.length - 1].label}</text>}
      </svg>
    </div>
  );
}

export function BarChart({ points, height = 140, fmt = shortNum, unit, band, highlightLast }: { points: ChartPoint[]; height?: number; fmt?: (n: number) => string; unit?: string; band?: { min: number | null; max: number | null }; highlightLast?: boolean }) {
  const id = useId().replace(/:/g, "");
  const H = height;
  const hi = niceMax(Math.max(...points.map((p) => p.value), band?.max ?? band?.min ?? 0, 1) * 1.08);
  const n = points.length, slot = (W - PL - PR) / Math.max(1, n), bw = Math.max(2, Math.min(22, slot * 0.62));
  const y = (v: number) => PT + (1 - v / hi) * (H - PT - PB);
  const { i, onMove, clear } = useReadout(n, PL + slot / 2, slot);
  if (!n) return <div className="muted" style={{ fontSize: 13, padding: "18px 0", textAlign: "center" }}>No data yet</div>;
  return (
    <div>
      <Readout p={i != null ? points[i] : points[n - 1]} fmt={fmt} unit={unit} />
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", touchAction: "pan-y" }} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={clear} role="img" aria-label="Bar chart">
        <defs><linearGradient id={`b${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="var(--neon)" /><stop offset="1" stopColor="var(--neon-2)" /></linearGradient></defs>
        {[0, hi / 2, hi].map((t, k) => (
          <g key={k}><line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={k ? "2 4" : undefined} />
            <text x={PL - 6} y={y(t) + 3} textAnchor="end" fill="var(--muted)" style={{ font: "500 9px var(--mono)" }}>{shortNum(t)}</text></g>
        ))}
        {band && band.min != null && <rect x={PL} width={W - PL - PR} y={y(Math.min(hi, band.max ?? hi))} height={Math.max(0, y(band.min) - y(Math.min(hi, band.max ?? hi)))} fill="var(--good)" opacity=".1" />}
        {points.map((p, k) => {
          const on = k === i || (i == null && highlightLast && k === n - 1);
          const h = Math.max(p.value > 0 ? 2 : 0, H - PB - y(p.value));
          return <rect key={k} className="chart-bar" x={PL + k * slot + (slot - bw) / 2} y={H - PB - h} width={bw} height={h} rx={Math.min(4, bw / 2)}
            fill={`url(#b${id})`} opacity={on ? 1 : 0.62} style={{ filter: on ? "drop-shadow(0 0 6px var(--glow))" : undefined, animationDelay: `${k * 18}ms` }} />;
        })}
        <text x={PL} y={H - 6} fill="var(--muted)" style={{ font: "500 9px var(--body)" }}>{points[0].label}</text>
        {n > 1 && <text x={W - PR} y={H - 6} fill="var(--muted)" textAnchor="end" style={{ font: "500 9px var(--body)" }}>{points[n - 1].label}</text>}
      </svg>
    </div>
  );
}

export const weekLabel = (ws: string) => `Week of ${fmtDate(ws, { month: "short", day: "numeric" })}`;
export const dayLabel = (d: string) => fmtDate(d, { month: "short", day: "numeric", year: "2-digit" });
