import { useMemo, useRef, useState } from "react";
import { useKeptState } from "../keptState";
import { inRange, lastChanges, rangeStart, RANGE_LABEL, weeklyTotals, type Range } from "../../core/progress";
import { recoveryStatus, type MuscleRecovery, type Recovery } from "../../core/recovery";
import { MUSCLE_GROUPS, muscleLabel, type MuscleGroup } from "../../core/types";
import { fmtNum, localDate } from "../../core/util";
import { formatTarget } from "../../core/volume";
import { CURL } from "../../core/figure/poses";
import { BarChart, weekLabel } from "../components/Charts";
import { Seg } from "../components/Controls";
import { ExerciseProgress } from "../components/ExerciseProgress";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { MuscleMap, RECOVERY_COLOR, STAGE_STYLE, type VolumeStage } from "../components/MuscleMap";
import { fmtVolume, loadSuffix } from "../format";
import { useStore } from "../store";

const ago = (k: number) => (k === 0 ? "today" : k === 1 ? "yesterday" : `${k} days ago`);
const recNote = (r: MuscleRecovery) => r.daysAgo == null ? "no hard day lately" : `${fmtNum(r.sets)} sets ${ago(r.daysAgo)}${r.slower.length ? ` · +1 day: ${r.slower.join(", ")}` : ""}`;
/** Swipe order on the muscle map: top to bottom */
const MAP_ORDER: MuscleGroup[] = ["neck", "traps", "frontDelts", "sideDelts", "rearDelts", "chest", "back", "abs", "biceps", "triceps", "forearms", "glutes", "quads", "hamstrings", "adductors", "calves"];
const REC_LABEL: Record<Recovery, string> = { recovering: "Recovering", partial: "Partly recovered", fresh: "Fresh" };

export function ProgressScreen() {
  const { finished, exMap, targets, exercises, settings } = useStore();
  const sd = settings.weekStartDay;
  const today = localDate(new Date());
  const [range, setRange] = useKeptState<Range>("progress-range", "4w");
  const [mapMode, setMapMode] = useKeptState<"volume" | "recovery">("progress-map", "volume");
  const [sel, setSel] = useState<MuscleGroup | null>(null);
  const [swipeDir, setSwipeDir] = useState<"next" | "prev" | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const step = (dir: 1 | -1) => {
    const i = sel ? MAP_ORDER.indexOf(sel) : dir === 1 ? -1 : 0;
    setSel(MAP_ORDER[(i + dir + MAP_ORDER.length) % MAP_ORDER.length]);
    setSwipeDir(dir === 1 ? "next" : "prev");
  };
  const [muscle, setMuscle] = useKeptState<MuscleGroup>("progress-muscle", "back");
  // "This week" by default; the last choice is remembered on this phone
  const from = rangeStart(range, today, sd);
  const weeks = useMemo(() => weeklyTotals(finished, exMap, from, today, sd), [finished, exMap, from, today, sd]);
  const rec = useMemo(() => recoveryStatus(finished, exMap, today, settings.profile), [finished, exMap, today, settings.profile]);
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const workouts = inRange(finished, from).length;
  const totalTon = weeks.reduce((a, w) => a + w.tonnage, 0);
  const logged = useMemo(() => {
    const last = new Map<string, string>();
    for (const s of finished) for (const e of s.entries) if (e.sets.some((x) => x.done) && !last.has(e.exerciseId)) last.set(e.exerciseId, s.date);
    return exercises.filter((e) => last.has(e.id)).sort((a, b) => (last.get(b.id)! > last.get(a.id)! ? 1 : -1));
  }, [finished, exercises]);
  const [exId, setExId] = useKeptState<string | null>("progress-exercise", null);
  const ex = exMap.get(exId ?? logged[0]?.id ?? "");
  const exIdx = Math.max(0, logged.findIndex((e) => e.id === ex?.id));
  const [exDir, setExDir] = useState<"next" | "prev" | null>(null);
  // Up / down: last workout vs the one before, per exercise (biggest change first)
  const changes = useMemo(() => lastChanges(finished, exercises), [finished, exercises]);
  const ups = changes.filter((c) => c.after > c.before).sort((a, b) => (b.after - b.before) - (a.after - a.before));
  const downs = changes.filter((c) => c.after < c.before).sort((a, b) => (a.after - a.before) - (b.after - b.before));
  const [udPick, setUd] = useKeptState<"up" | "down">("progress-updown", "up");
  const ud = udPick === "up" && !ups.length && downs.length ? "down" : udPick === "down" && !downs.length && ups.length ? "up" : udPick;
  const exSection = useRef<HTMLHeadingElement>(null);
  const openEx = (id: string) => { setExDir(null); setExId(id); exSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const stepEx = (d: 1 | -1) => { const n = logged[exIdx + d]; if (n) { setExDir(d === 1 ? "next" : "prev"); setExId(n.id); } };

  const thisWeek = weeks[weeks.length - 1]?.sets ?? ({} as Record<MuscleGroup, number>);
  // This week's sets against each muscle's target, in clear steps (no target: any sets count as started)
  const stage = Object.fromEntries(MUSCLE_GROUPS.map((m) => {
    const n = thisWeek[m.id] ?? 0, t = tmap.get(m.id), min = t && !t.off ? t.min : null, max = t && !t.off ? t.max : null;
    const st: VolumeStage = n <= 0 ? "none" : max != null && n > max ? "above" : min != null && n >= min ? "target" : min != null && n >= min / 2 ? "half" : "started";
    return [m.id, st];
  })) as Record<MuscleGroup, VolumeStage>;
  const recMap = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, rec[m.id].status])) as Record<MuscleGroup, Recovery>;
  const t = tmap.get(muscle);

  if (!finished.length) {
    return (
      <div className="page">
        <span className="eyebrow">Progress</span>
        <h1 className="title-lg" style={{ marginTop: 6 }}>Progress</h1>
        <div className="empty" style={{ paddingTop: 40 }}><Figure spec={CURL} size={120} /><p>Finish a workout and your charts, muscle map and recovery show up here.</p></div>
      </div>
    );
  }

  return (
    <div className="page">
      <span className="eyebrow">Progress</span>
      <h1 className="title-lg" style={{ marginTop: 6 }}>Progress</h1>
      <div style={{ marginTop: 12 }}>
        <Seg label="Range" value={range} onChange={setRange} options={(Object.keys(RANGE_LABEL) as Range[]).map((r) => ({ v: r, label: RANGE_LABEL[r] }))} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>
        {[[String(workouts), "workouts"], [fmtNum(Math.round((workouts / Math.max(1, weeks.length)) * 10) / 10), "per week"], [fmtVolume(totalTon), "volume lb"]].map(([v, l]) => (
          <div key={l} className="glass edge" style={{ padding: "12px 10px", borderRadius: 16, textAlign: "center" }}>
            <div className="mono neon" style={{ fontSize: 24, lineHeight: 1.1 }}>{v}</div><div className="eyebrow" style={{ fontSize: 9, marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      <h2 className="section-title">Muscle map</h2>
      <section className="glass" style={{ padding: 14 }}>
        <Seg label="Map mode" value={mapMode} onChange={(v) => { setMapMode(v); setSel(null); }} options={[{ v: "volume", label: "This week" }, { v: "recovery", label: "Recovery" }]} />
        <div style={{ marginTop: 10 }}>
          <MuscleMap stage={mapMode === "volume" ? stage : undefined} recovery={mapMode === "recovery" ? recMap : undefined} selected={sel} onSelect={(g) => { setSwipeDir(null); setSel(sel === g ? null : g); }} />
        </div>
        <div className="map-caption row" style={{ minHeight: 48, gap: 0, alignItems: "center", marginTop: 6, textAlign: "center", fontSize: 14, touchAction: "pan-y" }}
          onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={(e) => {
            const s0 = swipe.current; swipe.current = null;
            if (!s0) return;
            const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
          }}
          onPointerCancel={() => { swipe.current = null; }}>
          <button className="map-chev" aria-label="Previous muscle" onClick={() => step(-1)}>‹</button>
          <div key={sel ?? "none"} className={`grow${sel && swipeDir ? ` swipe-in-${swipeDir}` : ""}`}>
          {sel ? (
            mapMode === "volume"
              ? <><b>{muscleLabel(sel)}</b> · <span className="mono">{fmtNum(thisWeek[sel] ?? 0)}</span> sets this week <span className="muted">· target {formatTarget(tmap.get(sel))}</span></>
              : <><b>{muscleLabel(sel)}</b> · <span style={{ color: RECOVERY_COLOR[rec[sel].status] }}>{REC_LABEL[rec[sel].status]}</span> <span className="muted">· {recNote(rec[sel])}</span></>
          ) : mapMode === "volume"
            ? <span className="row" style={{ justifyContent: "space-evenly", gap: 7, fontSize: 11, flexWrap: "nowrap", width: "100%", maxWidth: 320, margin: "0 auto" }}>{(Object.keys(STAGE_STYLE) as VolumeStage[]).filter((k) => k !== "none").map((k) => <span key={k} className="row" style={{ gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, border: `1px solid ${STAGE_STYLE[k].color}`, background: STAGE_STYLE[k].fill ? STAGE_STYLE[k].color : "transparent", opacity: k === "started" ? 0.6 : 1, boxShadow: STAGE_STYLE[k].fill >= 0.7 ? `0 0 6px ${STAGE_STYLE[k].color}` : undefined }} />{STAGE_STYLE[k].label}</span>)}</span>
            : <span className="row" style={{ justifyContent: "center", gap: 12, fontSize: 12 }}>{(Object.keys(REC_LABEL) as Recovery[]).map((r) => <span key={r} className="row" style={{ gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: RECOVERY_COLOR[r], boxShadow: `0 0 6px ${RECOVERY_COLOR[r]}` }} />{REC_LABEL[r]}</span>)}</span>}
          </div>
          <button className="map-chev" aria-label="Next muscle" onClick={() => step(1)}>›</button>
        </div>
      </section>

      <h2 className="section-title">Weekly sets vs target</h2>
      <section className="glass" style={{ padding: 14 }}>
        <div className="chips-scroll" style={{ marginBottom: 8 }}>
          {MUSCLE_GROUPS.map((m) => <button key={m.id} className="chip" aria-pressed={muscle === m.id} onClick={() => setMuscle(m.id)}>{m.label}</button>)}
        </div>
        <BarChart key={muscle + range} points={weeks.map((w) => ({ label: weekLabel(w.weekStart), value: w.sets[muscle] }))} unit="sets" band={t ? { min: t.min, max: t.max } : undefined} highlightLast />
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Green band = target {formatTarget(t)} sets a week.</p>
      </section>

      <h2 className="section-title">Weekly volume</h2>
      <section className="glass" style={{ padding: 14 }}>
        <BarChart key={"t" + range} points={weeks.map((w) => ({ label: weekLabel(w.weekStart), value: w.tonnage, sub: `${w.workouts} workouts` }))} unit="lb" highlightLast />
      </section>

      <h2 className="section-title" ref={exSection} style={{ scrollMarginTop: 16 }}>Exercise progress</h2>
      <section className="glass" style={{ padding: 14 }}>
        <div className="ex-step">
          <button className="ex-step-btn" aria-label="Previous exercise" disabled={exIdx <= 0} onClick={() => stepEx(-1)}><span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="chevron" size={20} /></span></button>
          <div className="ex-step-mid">
            <select className="input" aria-label="Exercise" value={ex?.id ?? ""} onChange={(e) => { setExDir(null); setExId(e.target.value); }}>
              {logged.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <span className="ex-step-count">{exIdx + 1} / {logged.length}</span>
          </div>
          <button className="ex-step-btn" aria-label="Next exercise" disabled={exIdx >= logged.length - 1} onClick={() => stepEx(1)}><Icon name="chevron" size={20} /></button>
        </div>
        {ex && <div key={ex.id} className={exDir ? `ex-slide-${exDir}` : undefined}><ExerciseProgress key={ex.id + range} ex={ex} from={from} /></div>}
      </section>

      {/* Up / down: tap a count for its list; tap an exercise to see its chart above */}
      <h2 className="section-title">Up / down</h2>
      <section className="glass" style={{ padding: 14 }}>
        {!changes.length ? <p className="muted" style={{ fontSize: 14 }}>Do an exercise twice to see if it went up or down.</p> : <>
          <div className="ud-tiles" role="group" aria-label="Went up or down">
            <button className="ud-tile up" aria-pressed={ud === "up"} onClick={() => setUd("up")}><b>{ups.length}</b><span>Went up</span></button>
            <button className="ud-tile down" aria-pressed={ud === "down"} onClick={() => setUd("down")}><b>{downs.length}</b><span>Went down</span></button>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: "10px 2px 4px" }}>Last workout vs the one before · heaviest weight</p>
          {(ud === "up" ? ups : downs).length === 0
            ? <p className="muted" style={{ fontSize: 14, padding: "8px 2px" }}>{ud === "up" ? "Nothing went up last time." : "Nothing went down last time."}</p>
            : (ud === "up" ? ups : downs).map((c) => {
              const e = exMap.get(c.exerciseId)!;
              const d = c.after - c.before;
              const u = c.unit === "lb" ? `lb${loadSuffix(e)}` : c.unit;
              return (
                <button key={c.exerciseId} className="list-row ud-row" onClick={() => openEx(c.exerciseId)}
                  aria-label={`${e.name}: ${fmtNum(c.before)} to ${fmtNum(c.after)} ${u}`}>
                  <span className={"ud-arrow " + ud} aria-hidden="true">{d > 0 ? "↑" : "↓"}</span>
                  <span className="ud-name">{e.name}</span>
                  <span className="mono ud-vals">{fmtNum(c.before)} → {fmtNum(c.after)} <small>{u}</small></span>
                  <span className={"mono ud-d " + ud}>{d > 0 ? "+" : "−"}{fmtNum(Math.abs(d))}</span>
                </button>
              );
            })}
        </>}
      </section>
    </div>
  );
}
