import { useMemo, useRef, useState } from "react";
import { useKeptState } from "../keptState";
import { inRange, muscleFrequency, rangeStart, RANGE_LABEL, weeklyTotals, type Range } from "../../core/progress";
import { recoveryStatus, type MuscleRecovery, type Recovery } from "../../core/recovery";
import { MUSCLE_GROUPS, muscleLabel, type MuscleGroup } from "../../core/types";
import { fmtNum, localDate } from "../../core/util";
import { formatTarget } from "../../core/volume";
import { CURL } from "../../core/figure/poses";
import { BarChart, weekLabel } from "../components/Charts";
import { Seg } from "../components/Controls";
import { ExerciseProgress } from "../components/ExerciseProgress";
import { Figure } from "../components/Figure";
import { MuscleMap, RECOVERY_COLOR } from "../components/MuscleMap";
import { fmtVolume } from "../format";
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
  const freq = useMemo(() => muscleFrequency(inRange(finished, from), exMap, weeks.length), [finished, exMap, from, weeks.length]);
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

  const thisWeek = weeks[weeks.length - 1]?.sets ?? ({} as Record<MuscleGroup, number>);
  const intensity = Object.fromEntries(MUSCLE_GROUPS.map((m) => { const t = tmap.get(m.id); return [m.id, (thisWeek[m.id] ?? 0) / (t?.max ?? t?.min ?? 12)]; }));
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
          <MuscleMap intensity={mapMode === "volume" ? intensity : undefined} recovery={mapMode === "recovery" ? recMap : undefined} selected={sel} onSelect={(g) => { setSwipeDir(null); setSel(sel === g ? null : g); }} />
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
            ? <span className="muted">Brighter = closer to the top of the target.</span>
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

      <h2 className="section-title">Frequency (times a week)</h2>
      <section className="glass" style={{ padding: 14, display: "grid", gap: 9 }}>
        {MUSCLE_GROUPS.filter((m) => freq[m.id] > 0).sort((a, b) => freq[b.id] - freq[a.id]).map((m) => (
          <div key={m.id} style={{ display: "grid", gridTemplateColumns: "96px 1fr 40px", gap: 10, alignItems: "center", fontSize: 14 }}>
            <span>{m.label}</span>
            <div className="vbar"><div className="fill" style={{ width: `${Math.min(100, (freq[m.id] / 3) * 100)}%` }} /></div>
            <span className="mono" style={{ textAlign: "right" }}>{fmtNum(freq[m.id])}×</span>
          </div>
        ))}
        <p className="muted" style={{ fontSize: 12 }}>Workouts per week with direct work for the muscle.</p>
      </section>

      <h2 className="section-title">Exercise progress</h2>
      <section className="glass" style={{ padding: 14 }}>
        <select className="input" aria-label="Exercise" value={ex?.id ?? ""} onChange={(e) => setExId(e.target.value)} style={{ marginBottom: 10 }}>
          {logged.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {ex && <ExerciseProgress key={ex.id + range} ex={ex} from={from} />}
      </section>
    </div>
  );
}
