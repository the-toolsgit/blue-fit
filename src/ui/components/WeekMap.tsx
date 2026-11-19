// Plan → Your week: the body (front or back) colored by how each muscle meets its weekly target, next to a list of the
// muscles on that side. Tap a muscle (on the body or the list): the body zooms in on it, its parts get labeled lines
// (green = the plan hits it), and its row opens with sets, target, days a week and movement pills.
// Swipe the body or use ‹ › for the other side.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GUIDES, HEAD, MAP_H, MAP_PARTS, MAP_W, OUTLINE, partsKey, regionsFor, viewOf, zoomBox, type MapView } from "../../core/muscleMap";
import { fmtNum } from "../../core/util";
import { muscleLabel, type MuscleGroup } from "../../core/types";
import type { Tile } from "../../core/workoutCheck";
import { reducedMotion } from "../device";
import { Icon } from "./Icon";

const pts = (l: number[][]) => l.map((q) => q.join(",")).join(" ");
const WHOLE: [number, number, number, number] = [0, 0, MAP_W, MAP_H + 4];

/** Green = in target; yellow → red = short (red far short); purple = above; grey = skipped or not in the plan */
export function tileColor(t: Tile | undefined): string {
  if (!t || t.status === "off" || !t.target || t.target.min == null) return "var(--faint)";
  if (t.status === "above") return "var(--pink-2)";
  if (t.week >= t.target.min) return "var(--good)";
  return `hsl(${Math.round(50 * Math.max(0, Math.min(1, t.week / t.target.min)))} 100% 58%)`;
}
const stateText = (t: Tile | undefined) => !t || !t.week ? "Not trained in this plan" : t.status === "off" ? "Skipped"
  : t.status === "above" ? "Above target" : t.target?.min != null && t.week >= t.target.min ? "In target" : `${fmtNum((t.target?.min ?? 0) - t.week)} sets short`;

export function WeekMap({ tiles }: { tiles: Tile[] }) {
  const byGroup = new Map(tiles.map((t) => [t.group, t]));
  const [view, setView] = useState<MapView>("front");
  const [sel, setSel] = useState<MuscleGroup | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const vb = useRef<[number, number, number, number]>([...WHOLE]);
  const [settled, setSettled] = useState(true); // labels show once the zoom has landed

  // Glide the viewBox to the target box
  const target = sel ? zoomBox(sel, view) : WHOLE;
  const key = target.map((v) => v.toFixed(2)).join(" ");
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const from = [...vb.current], to = target, dur = reducedMotion() ? 0 : 450, t0 = performance.now();
    let raf = 0;
    setSettled(false);
    const step = (now: number) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      vb.current = from.map((v, i) => v + (to[i] - v) * e) as typeof vb.current;
      svg.setAttribute("viewBox", vb.current.map((v) => v.toFixed(2)).join(" "));
      if (k < 1) raf = requestAnimationFrame(step); else setSettled(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Swipe the body for the other side
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    let x0: number | null = null;
    const s = (e: TouchEvent) => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; };
    const end = (e: TouchEvent) => { if (x0 != null && Math.abs(e.changedTouches[0].clientX - x0) > 40) flip(); x0 = null; };
    el.addEventListener("touchstart", s, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    return () => { el.removeEventListener("touchstart", s); el.removeEventListener("touchend", end); };
  });

  const flip = () => setView((v) => (v === "front" ? "back" : "front"));
  // The opened muscle scrolls to the top of the list (inside it, not the page)
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current, row = list?.querySelector<HTMLElement>(".weekmap-row.sel");
    if (list && row) list.scrollTo({ top: row.offsetTop - 2, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [sel, view]);
  const pick = (g: MuscleGroup) => {
    if (sel && partsKey(sel) === partsKey(g)) { setSel(null); return; }
    setSel(g);
    setView(viewOf(g));
  };

  const regions = regionsFor(view);
  // The list: muscles drawn on this side, most sets first
  const groups = [...new Set(regions.map((r) => r.group))].sort((a, b) => (byGroup.get(b)?.week ?? 0) - (byGroup.get(a)?.week ?? 0));
  const parts = sel && settled ? MAP_PARTS[partsKey(sel)]?.[view] : undefined;
  const [bx, by, bw] = target, fs = bw * 0.066, lx = bx + bw * 0.54;
  const partColor = (ref: string) => {
    if (!ref.startsWith("job:")) return tileColor(byGroup.get(ref as MuscleGroup));
    const job = byGroup.get(partsKey(sel!) === "frontDelts" ? sel! : partsKey(sel!))?.jobs.find((j) => j.name === ref.slice(4));
    const t = byGroup.get(partsKey(sel!) === "frontDelts" ? sel! : partsKey(sel!));
    return job?.state === "hit" ? "var(--good)" : !t || t.status === "off" ? "var(--faint)" : "var(--bad)";
  };
  // Labels spread out vertically so they never overlap
  const labelYs = (ys: number[]) => ys.map((y, i) => Math.max(y, i ? ys[i - 1] + fs * 1.3 : y));

  return (
    <div className="glass weekmap">
      <div className="weekmap-split">
        <div className="weekmap-body">
          <div ref={mapRef} className="weekmap-map" data-noswipe>
            <svg ref={svgRef} viewBox={WHOLE.join(" ")} role="img" aria-label={`Muscle map, ${view}`}>
              {regions.map(({ group, shape }, i) => {
                const t = byGroup.get(group), c = tileColor(t), on = !!sel && partsKey(sel) === partsKey(group);
                const p = { fill: c, fillOpacity: on ? 0.85 : sel ? 0.22 : t ? 0.5 : 0.08, stroke: on ? "var(--ink)" : c, strokeWidth: on ? 1.6 : 1, vectorEffect: "non-scaling-stroke" as const, style: { cursor: "pointer" }, onClick: () => pick(group) };
                return shape.kind === "ellipse"
                  ? <ellipse key={i} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} transform={`rotate(${shape.rot ?? 0} ${shape.cx} ${shape.cy})`} {...p}><title>{muscleLabel(group)}</title></ellipse>
                  : <polygon key={i} points={pts(shape.points)} {...p}><title>{muscleLabel(group)}</title></polygon>;
              })}
              <g style={{ pointerEvents: "none" }}>
                {OUTLINE.map((l, i) => <polyline key={i} points={pts(l)} fill="none" stroke="var(--fig)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />)}
                {GUIDES[view].map((l, i) => <polyline key={"g" + i} points={pts(l)} fill="none" stroke="var(--fig2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
                <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill="none" stroke="var(--fig)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                {parts && (() => {
                  const ys = labelYs(parts.map((q) => q.y));
                  return parts.map((q, i) => {
                    const c = partColor(q.ref);
                    return (
                      <g key={q.label} className="weekmap-part">
                        <circle cx={q.x} cy={q.y} r={fs * 0.18} fill={c} />
                        <polyline points={`${q.x},${q.y} ${lx - fs * 0.3},${ys[i]}`} fill="none" stroke={c} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                        <text x={lx} y={ys[i] + fs * 0.35} fontSize={fs} fill={c === "var(--faint)" ? "var(--muted)" : c} stroke="var(--surface-solid)" strokeWidth={fs * 0.32} paintOrder="stroke" strokeLinejoin="round">{q.label}</text>
                      </g>
                    );
                  });
                })()}
                {parts && partsKey(sel!) === "frontDelts" && view === "front" && <text x={lx} y={by + target[3] - fs * 0.6} fontSize={fs * 0.85} fill="var(--muted)">rear: back ›</text>}
              </g>
            </svg>
          </div>
          <div className="weekmap-nav">
            <button type="button" className="icon-btn" onClick={flip} aria-label="Show the other side">‹</button>
            <span>{view.toUpperCase()}</span>
            <button type="button" className="icon-btn" onClick={flip} aria-label="Show the other side">›</button>
          </div>
          {/* Always takes its space, so the section doesn't grow when a muscle is picked */}
          <button type="button" className="weekmap-out" onClick={() => setSel(null)} style={{ visibility: sel ? "visible" : "hidden" }} tabIndex={sel ? 0 : -1}>Whole body</button>
        </div>
        <div className="weekmap-listbox"><div className="weekmap-list" ref={listRef}>
          {groups.map((g) => {
            const t = byGroup.get(g), open = sel === g;
            return (
              <div key={g}>
                <button type="button" className={"weekmap-row" + (open ? " sel" : "")} onClick={() => pick(g)} aria-expanded={open}>
                  <i style={{ background: tileColor(t) }} /><span className="grow">{muscleLabel(g)}</span>
                  <span className="mono muted">{fmtNum(t?.week ?? 0)}/{t?.target?.min ?? "–"}</span>
                </button>
                {open && <MuscleDetail t={t} />}
              </div>
            );
          })}
        </div></div>
      </div>
      <div className="weekmap-legend">
        {[["var(--good)", "in target"], ["hsl(50 100% 58%)", "a bit short"], ["hsl(0 100% 58%)", "far short"], ["var(--pink-2)", "above"], ["var(--faint)", "skipped"]].map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}
      </div>
    </div>
  );
}

/** The opened muscle: sets a week on a bar with the target band, status and days a week, and each part ✓ / ✕. */
function MuscleDetail({ t }: { t: Tile | undefined }) {
  const week = t?.week ?? 0, min = t?.target?.min ?? null, max = t?.target?.max ?? null, c = tileColor(t);
  const focus = !!t && t.status !== "off" && min != null;
  const scale = Math.max(week, max ?? (min ?? 0) * 1.4, 1) * 1.12;
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <div className="wm-detail">
      <div className="wm-big"><b className="mono" style={{ color: c }}>{fmtNum(week)}</b><span>sets a week</span></div>
      {focus && (
        <div className="wm-bar" aria-hidden="true">
          <span className="wm-band" style={{ left: pct(min!), width: max != null ? `calc(${pct(max)} - ${pct(min!)})` : `calc(100% - ${pct(min!)})` }} />
          <span className="wm-fill" style={{ width: pct(week), background: c }} />
        </div>
      )}
      <div className="wm-meta mono">{focus ? `target ${min}${max != null ? `–${max}` : "+"}` : "no target"}{t?.days ? ` · ${t.days}×/wk` : ""}</div>
      <span className="wm-state" style={{ color: c, borderColor: c }}>{stateText(t)}</span>
      {!!t && t.jobs.length > 1 && (
        <ul className="wm-parts">
          {t.jobs.map((j) => {
            const ok = j.state === "hit", cls = ok ? "hit" : focus ? "miss" : "off";
            return <li key={j.name} className={cls}><Icon name={ok ? "check" : "close"} size={13} stroke={3} />{j.name}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
