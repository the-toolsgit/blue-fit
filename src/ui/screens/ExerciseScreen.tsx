// Exercise detail: the full card from the plan page + records. Used as a page and as a sheet (logger, Today).
import { computeRecords } from "../../core/records";
import { lastEntryFor } from "../../core/session";
import { EQUIPMENT_LABEL, muscleLabel, type Exercise } from "../../core/types";
import { fmtNum } from "../../core/util";
import { Figure } from "../components/Figure";
import { tempoTiming } from "../../core/figure/tempo";
import { ExerciseEditor } from "../components/ExerciseEditor";
import { lazy, Suspense, useState } from "react";
const ExerciseProgress = lazy(() => import("../components/ExerciseProgress").then((m) => ({ default: m.ExerciseProgress })));
import { Icon } from "../components/Icon";
import { useWeekFailure } from "../components/FailFlame";
import { Sheet } from "../components/Sheet";
import { fmtDate, fmtRest, fmtVolume, loadSuffix, setsLine } from "../format";
import { back, go } from "../router";
import { useStore } from "../store";

/** "Up 1 s · Down 3 s" → [{ word: "Up", sec: "1 s" }, …]; anything else is shown as one phase. */
const tempoPhases = (t: string) => t.split("·").map((p) => p.trim()).filter(Boolean).map((p) => {
  const m = p.match(/^(.*?)\s*(\d+(?:[.–-]\d+)?\s*s)$/);
  return m ? { word: m[1], sec: m[2] } : { word: p, sec: "" };
});

function Section({ title, items, tone }: { title: string; items: string[]; tone?: "tip" | "bad" }) {
  if (!items.length) return null;
  const color = tone === "tip" ? "var(--neon-2)" : tone === "bad" ? "var(--bad)" : "var(--muted)";
  return (
    <div>
      <h4 style={{ font: "600 12px var(--body)", letterSpacing: ".12em", textTransform: "uppercase", color, marginBottom: 6 }}>{title}</h4>
      <ul className="stack" style={{ gap: 4 }}>{items.map((x, i) => <li key={i} style={{ fontSize: 15 }}>{x}</li>)}</ul>
    </div>
  );
}

/** `failWhy`: this exercise takes its last set to failure in this workout (with the reasons). */
export function ExerciseInfo({ ex, whyOverride, tipsOverride, failWhy }: { ex: Exercise; whyOverride?: string; tipsOverride?: string[]; failWhy?: string[] }) {
  const { finished, settings } = useStore();
  const rec = computeRecords(finished, ex.id);
  const last = lastEntryFor(finished, ex.id);
  const restSec = ex.defaultRestSec || settings.restDefaultSec;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="fig-stage" style={{ padding: "8px 0 0" }}><Figure spec={ex.figure} size={200} timing={tempoTiming(ex.tempo, ex.id)} label={`Animation: ${ex.name}`} /></div>
      <div>
        <h2 className="title-lg">{ex.name} {ex.isHeavy && <span className="star">★</span>}</h2>
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {ex.muscles.map((m) => <span key={m} className="badge p">{m}</span>)}
          {ex.secondaryMuscles.map((m) => <span key={m} className="badge">{m}</span>)}
          {ex.isHeavy && <span className="badge star">★ key lift</span>}
          {failWhy && <span className="badge fail-badge"><Icon name="flame" size={12} /> last set to failure</span>}
        </div>
        {failWhy && failWhy.length > 0 && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{failWhy.join(" · ")}</p>}
      </div>
      <p style={{ fontSize: 16 }}>{whyOverride ?? ex.why}</p>
      <Section title="Setup" items={ex.setup} />
      <Section title="Form" items={ex.form} />
      <Section title="Tips" items={tipsOverride ?? ex.tips} tone="tip" />
      <Section title="Avoid" items={ex.avoid} tone="bad" />
      <div className="info-tiles">
        <div className="info-tile wide"><span className="info-ic"><Icon name="range" size={20} /></span><div><div className="eyebrow">Range</div><div>{ex.rangeOfMotion}</div></div></div>
        <div className="info-tile"><span className="info-ic"><Icon name="tempo" size={20} /></span><div><div className="eyebrow">Tempo</div>
          <div className="tempo">{tempoPhases(ex.tempo).map((p, i) => <span key={i}>{i > 0 && <span className="muted" aria-hidden="true">→ </span>}<b>{p.word}</b> <span className="mono">{p.sec.replace(" ", "")}</span></span>)}</div></div></div>
        <div className="info-tile"><span className="info-ic"><Icon name="timer" size={20} /></span><div><div className="eyebrow">Rest</div><div className="mono">{fmtRest(restSec)}</div></div></div>
        <div className="info-tile wide"><span className="info-ic"><Icon name="today" size={20} /></span><div><div className="eyebrow">Equipment</div>
          <div>{EQUIPMENT_LABEL[ex.equipment]}{ex.singleSleeve ? <span className="muted"> · log the plates on it</span> : ex.loadMode === "perSide" ? <span className="muted"> · log one side, no bar</span> : ex.loadMode === "perHand" ? <span className="muted"> · log one hand</span> : null}</div></div></div>
        <div className="info-tile wide"><span className="info-ic"><Icon name="body" size={20} /></span><div><div className="eyebrow">Works</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 4 }}>{ex.volume.map((v) => <span key={v.group} className={"badge" + (v.weight === 1 ? " p" : "")}>{muscleLabel(v.group)}{v.weight === 1 ? "" : " ½"}</span>)}</div></div></div>
      </div>
      <div>
        <h4 className="section-title" style={{ margin: "4px 0 8px" }}>Your records</h4>
        {rec.heaviest ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              ["Heaviest", `${fmtNum(rec.heaviest.weight)}${loadSuffix(ex)}`, `× ${rec.heaviest.reps} · ${fmtDate(rec.heaviest.date)}`],
              ["Best est. 1RM", fmtNum(Math.round(rec.bestE1rm!.value)), `${fmtNum(rec.bestE1rm!.weight)} × ${rec.bestE1rm!.reps}`],
              ["Best volume", fmtVolume(rec.bestSessionVolume?.value ?? 0), rec.bestSessionVolume ? fmtDate(rec.bestSessionVolume.date) : ""],
              ["Last time", last ? setsLine(last.entry.sets) : "—", last ? fmtDate(last.session.date) : ""],
            ].map(([l, v, s]) => (
              <div key={l} className="glass" style={{ padding: 12, borderRadius: 16 }}>
                <div className="eyebrow" style={{ fontSize: 10 }}>{l}</div>
                <div className="mono" style={{ fontSize: 20, marginTop: 4, color: "var(--neon-ink)" }}>{v}</div>
                <div className="muted" style={{ fontSize: 12 }}>{s}</div>
              </div>
            ))}
          </div>
        ) : <p className="muted" style={{ fontSize: 14 }}>No sets logged yet. Records and charts appear after your first workout.</p>}
      </div>
      {rec.heaviest && <ExerciseHistory ex={ex} />}
    </div>
  );
}

function ExerciseHistory({ ex }: { ex: Exercise }) {
  const { finished } = useStore();
  const rows = finished.flatMap((s) => s.entries.filter((e) => e.exerciseId === ex.id && e.sets.some((x) => x.done)).map((e) => ({ s, e })));
  return (
    <div>
      <h4 className="section-title" style={{ margin: "4px 0 8px" }}>Progress</h4>
      <div className="glass" style={{ padding: 14, minHeight: 230 }}><Suspense fallback={null}><ExerciseProgress ex={ex} /></Suspense></div>
      <h4 className="section-title" style={{ margin: "16px 0 8px" }}>History · {rows.length}</h4>
      <div className="glass" style={{ padding: 4 }}>
        {rows.slice(0, 40).map(({ s, e }) => (
          <button key={e.id} className="list-row" onClick={() => go(`summary/${s.id}`)}>
            <span className="grow">
              <span style={{ display: "block", fontSize: 13 }} className="muted">{fmtDate(s.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
              <span className="mono" style={{ fontSize: 15 }}>{setsLine(e.sets)}<span className="muted" style={{ fontSize: 12 }}>{loadSuffix(ex)}</span></span>
            </span>
            <span className="mono muted" style={{ fontSize: 12 }}>{fmtVolume(e.sets.filter((x) => x.done && x.type !== "warmup").reduce((a, x) => a + (x.weight ?? 0) * (x.reps ?? 0), 0))} lb</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExerciseSheet({ id, onClose, whyOverride, tipsOverride, failWhy }: { id: string | null; onClose: () => void; whyOverride?: string; tipsOverride?: string[]; failWhy?: string[] }) {
  const { exMap } = useStore();
  const ex = id ? exMap.get(id) : undefined;
  return (
    <Sheet open={!!ex} onClose={onClose} label={ex?.name ?? "Exercise"}>
      {ex && <ExerciseInfo ex={ex} whyOverride={whyOverride} tipsOverride={tipsOverride} failWhy={failWhy} />}
    </Sheet>
  );
}

/** `slotId`: opened from a plan day (Plan tab), so its failure flame and reasons can show. */
export function ExerciseScreen({ id, slotId }: { id?: string; slotId?: string }) {
  const { exMap, routine } = useStore();
  const weekFail = useWeekFailure(routine);
  const failDay = slotId ? routine?.days.find((d) => d.slots.some((s) => s.id === slotId)) : undefined;
  const failWhy = failDay && slotId ? weekFail.get(failDay.id)?.get(slotId) : undefined;
  const [editing, setEditing] = useState(false);
  const ex = id ? exMap.get(id) : undefined;
  return (
    <div className="page">
      <div className="spread">
        <button className="icon-btn" onClick={() => back("plan")} aria-label="Back" style={{ marginLeft: -10 }}><Icon name="back" /></button>
        {ex && <button className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => setEditing(true)}><Icon name="note" size={18} /> Edit</button>}
      </div>
      {ex?.archived && <p className="badge" style={{ marginBottom: 8 }}>Hidden from the exercise picker</p>}
      <ExerciseEditor open={editing} exercise={ex} onClose={() => setEditing(false)} />
      {ex ? <ExerciseInfo ex={ex} failWhy={failWhy} /> : <div className="empty">Exercise not found.</div>}
    </div>
  );
}
