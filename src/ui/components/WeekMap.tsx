// Plan → Your week: the body (front or back) colored by how each muscle meets its weekly target, next to a list of the
// muscles on that side. Tap a muscle (on the body or the list): the body zooms in on it, its parts get labeled lines
// (green = the plan hits it), and its row opens with sets, target, days a week and movement pills.
// Swipe the body or use ‹ › for the other side.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GUIDES, HEAD, MAP_H, MAP_PARTS, MAP_W, OUTLINE, partsKey, regionsFor, viewOf, zoomBox, type MapView } from "../../core/muscleMap";
import { fmtNum } from "../../core/util";
import { completeProfile, muscleLabel, type MuscleGroup } from "../../core/types";
import { exercisesFor, type Tile } from "../../core/workoutCheck";
import type { Exercise, Routine, VolumeTarget } from "../../core/types";
import { TargetEdit, toggleSkip } from "./TargetEdit";
import { useLongPress } from "./longPress";
import { useStore } from "../store";
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

/** Target editing (Plan tab): the muscle card gets a Change target button. */
export interface TargetEditing { targets: VolumeTarget[]; onEdit: (t: VolumeTarget) => void; onEditAll: (ts: VolumeTarget[]) => void }

export function WeekMap({ tiles, routine, exMap, edit }: { tiles: Tile[]; routine: Routine; exMap: Map<string, Exercise>; edit?: TargetEditing }) {
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

  // ‹ › (or a swipe) shows the other side, whole body: it also lets go of the picked muscle
  const flip = () => { setSel(null); setView((v) => (v === "front" ? "back" : "front")); };
  const pick = (g: MuscleGroup) => {
    if (sel && partsKey(sel) === partsKey(g)) { setSel(null); return; }
    setSel(g);
    // Stay on this side when the muscle is drawn here (side delts, traps, forearms are on both); else switch
    if (!regionsFor(view).some((r) => r.group === g)) setView(viewOf(g));
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
          {/* The whole row (‹ FRONT ›) is one button: shows the other side, whole body */}
          <button type="button" className="weekmap-nav" onClick={flip} aria-label={`Showing the ${view}. Show the ${view === "front" ? "back" : "front"}`}>
            <span className="weekmap-arrow" aria-hidden="true">‹</span><span>{view.toUpperCase()}</span><span className="weekmap-arrow" aria-hidden="true">›</span>
          </button>
        </div>
        <div className="weekmap-list">
          {groups.map((g) => {
            const t = byGroup.get(g), open = sel === g;
            return (
              <div key={g}>
                <ListRow g={g} open={open} color={tileColor(t)} count={`${fmtNum(t?.week ?? 0)}/${t?.target?.min ?? "–"}`} onTap={() => pick(g)} edit={edit} />
              </div>
            );
          })}
        </div>
      </div>
      {/* The picked muscle: details across the full width, then its exercises */}
      {sel && <MuscleDetail key={sel} g={sel} t={byGroup.get(sel)} edit={edit} />}
      {sel && <MuscleExercises g={sel} routine={routine} exMap={exMap} t={byGroup.get(sel)} />}
      <div className="weekmap-legend">
        {[["var(--good)", "in target"], ["hsl(50 100% 58%)", "a bit short"], ["hsl(0 100% 58%)", "far short"], ["var(--pink-2)", "above"], ["var(--faint)", "skipped"]].map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}
      </div>
    </div>
  );
}

/** A muscle in the list. With editing on, press and hold to Skip it (or bring a skipped one back as Normal; a delt head
 *  turns all three Shoulders heads). No toast: the row's color shows it (Leo, Nov 22 2026). */
function ListRow({ g, open, color, count, onTap, edit }: { g: MuscleGroup; open: boolean; color: string; count: string; onTap: () => void; edit?: TargetEditing }) {
  const { settings } = useStore();
  const long = useLongPress(edit ? () => edit.onEditAll(toggleSkip(edit.targets, g, completeProfile(settings.profile), settings.profile?.goal)) : undefined);
  return (
    <button type="button" className={"weekmap-row" + (open ? " sel" : "")} onClick={onTap} aria-expanded={open} {...long}>
      <i style={{ background: color }} /><span className="grow">{muscleLabel(g)}</span>
      <span className="mono muted">{count}</span>
    </button>
  );
}

/** The opened muscle: sets a week on a bar with the target band, status and days a week, and each part ✓ / ✕. */
function MuscleDetail({ g, t, edit }: { g: MuscleGroup; t: Tile | undefined; edit?: TargetEditing }) {
  const [editing, setEditing] = useState(false);
  const week = t?.week ?? 0, min = t?.target?.min ?? null, max = t?.target?.max ?? null, c = tileColor(t);
  const focus = !!t && t.status !== "off" && min != null;
  const scale = Math.max(week, max ?? (min ?? 0) * 1.4, 1) * 1.12;
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <div className="wm-detail">
      <div className="wm-head">
        <div className="wm-big"><b className="mono" style={{ color: c }}>{fmtNum(week)}</b><span>sets a week</span></div>
        <span className="wm-state" style={{ color: c, borderColor: c }}>{stateText(t)}</span>
      </div>
      {focus && (
        <div className="wm-bar" aria-hidden="true">
          <span className="wm-band" style={{ left: pct(min!), width: max != null ? `calc(${pct(max)} - ${pct(min!)})` : `calc(100% - ${pct(min!)})` }} />
          <span className="wm-fill" style={{ width: pct(week), background: c }} />
        </div>
      )}
      <div className="wm-meta-row">
        <div className="wm-meta mono">{focus ? `target ${min}${max != null ? `–${max}` : "+"}` : "no target"}{t?.days ? ` · ${t.days}×/wk` : ""}</div>
        {edit && <button type="button" className="wm-edit" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Change target"}</button>}
      </div>
      {edit && editing && (
        <div style={{ width: "100%" }}>
          <TargetEdit group={g} label={muscleLabel(g)} t={edit.targets.find((x) => x.group === g)} current={week} onEdit={edit.onEdit} all={edit.targets} onEditAll={edit.onEditAll} />
        </div>
      )}
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

/** Below the map, for the picked muscle: the routine's exercises for each of its parts (red when a part has none),
 *  then exercises that work it indirectly. */
function MuscleExercises({ g, routine, exMap, t }: { g: MuscleGroup; routine: Routine; exMap: Map<string, Exercise>; t: Tile | undefined }) {
  const x = exercisesFor(routine, exMap, g);
  const focus = !!t && t.status !== "off";
  const line = (e: { exerciseId: string; name: string; sets: number; days: string[]; half?: boolean }) => (
    <li key={e.exerciseId} className={e.half ? "half" : undefined}><span className="grow">{e.name}{e.half && <span className="wm-half">counts ½</span>}</span><span className="mono muted">{fmtNum(e.sets)} sets</span></li>
  );
  return (
    <div className="wm-ex">
      <div className="eyebrow">{muscleLabel(g)} · exercises in your plan</div>
      {x.parts.map((p) => (
        <div key={p.job} className={"wm-ex-part" + (!p.exercises.length && focus ? " miss" : "")}>
          <div className="wm-ex-job">{p.job}</div>
          {p.exercises.length ? <ul>{p.exercises.map(line)}</ul> : <p className="wm-ex-none">{focus ? "Nothing in your plan trains this part" : "None"}</p>}
        </div>
      ))}
      {!!x.other.length && <div className="wm-ex-part">{!!x.parts.length && <div className="wm-ex-job">other</div>}<ul>{x.other.map(line)}</ul></div>}
      {!x.parts.length && !x.other.length && <p className="wm-ex-none">No exercise in your plan works it directly.</p>}
      {!!x.indirect.length && (
        <div className="wm-ex-part"><div className="wm-ex-job">also works it (each set counts ½)</div><ul className="wm-ex-ind">{x.indirect.map(line)}</ul></div>
      )}
    </div>
  );
}
