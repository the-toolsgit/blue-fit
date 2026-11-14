// Exercise detail: the full card from the plan page + records. Used as a page and as a sheet (logger, Today).
import { computeRecords } from "../../core/records";
import { lastEntryFor } from "../../core/session";
import { EQUIPMENT_LABEL, muscleLabel, type Exercise } from "../../core/types";
import { fmtNum } from "../../core/util";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { fmtDate, fmtRest, fmtVolume, loadSuffix, setsLine } from "../format";
import { back } from "../router";
import { useStore } from "../store";

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

export function ExerciseInfo({ ex, whyOverride, tipsOverride }: { ex: Exercise; whyOverride?: string; tipsOverride?: string[] }) {
  const { finished, settings } = useStore();
  const rec = computeRecords(finished, ex.id);
  const last = lastEntryFor(finished, ex.id);
  const restSec = ex.defaultRestSec || settings.restDefaultSec;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="fig-stage" style={{ padding: "8px 0 0" }}><Figure spec={ex.figure} size={200} label={`Animation: ${ex.name}`} /></div>
      <div>
        <h2 className="title-lg">{ex.name} {ex.isHeavy && <span className="star">★</span>}</h2>
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {ex.muscles.map((m) => <span key={m} className="badge p">{m}</span>)}
          {ex.secondaryMuscles.map((m) => <span key={m} className="badge">{m}</span>)}
          {ex.isHeavy && <span className="badge star">★ heavy</span>}
        </div>
      </div>
      <p style={{ fontSize: 16 }}>{whyOverride ?? ex.why}</p>
      <Section title="Setup" items={ex.setup} />
      <Section title="Form" items={ex.form} />
      <Section title="Tips" items={tipsOverride ?? ex.tips} tone="tip" />
      <Section title="Avoid" items={ex.avoid} tone="bad" />
      <div className="glass" style={{ padding: 14, display: "grid", gap: 8, fontSize: 14 }}>
        <div><b>Range</b> <span className="muted">· {ex.rangeOfMotion}</span></div>
        <div><b>Rest</b> <span className="muted">· {fmtRest(restSec)}</span></div>
        <div><b>Tempo</b> <span className="muted">· {ex.tempo}</span></div>
        <div><b>Equipment</b> <span className="muted">· {EQUIPMENT_LABEL[ex.equipment]}{ex.loadMode === "perSide" ? " · log weight per side, bar not included" : ex.loadMode === "perHand" ? " · log weight per hand" : ""}</span></div>
        <div><b>Counts as</b> <span className="muted">· {ex.volume.map((v) => `${muscleLabel(v.group)} ${v.weight === 1 ? "×1" : "×½"}`).join(" · ")}</span></div>
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
                <div className="mono" style={{ fontSize: 20, marginTop: 4, color: "var(--neon)" }}>{v}</div>
                <div className="muted" style={{ fontSize: 12 }}>{s}</div>
              </div>
            ))}
          </div>
        ) : <p className="muted" style={{ fontSize: 14 }}>No sets logged yet. Records and charts appear after your first workout.</p>}
      </div>
    </div>
  );
}

export function ExerciseSheet({ id, onClose, whyOverride, tipsOverride }: { id: string | null; onClose: () => void; whyOverride?: string; tipsOverride?: string[] }) {
  const { exMap } = useStore();
  const ex = id ? exMap.get(id) : undefined;
  return (
    <Sheet open={!!ex} onClose={onClose} label={ex?.name ?? "Exercise"}>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: -6 }}>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </div>
      {ex && <ExerciseInfo ex={ex} whyOverride={whyOverride} tipsOverride={tipsOverride} />}
    </Sheet>
  );
}

export function ExerciseScreen({ id }: { id?: string }) {
  const { exMap } = useStore();
  const ex = id ? exMap.get(id) : undefined;
  return (
    <div className="page">
      <button className="icon-btn" onClick={() => back("plan")} aria-label="Back" style={{ marginLeft: -10 }}><Icon name="back" /></button>
      {ex ? <ExerciseInfo ex={ex} /> : <div className="empty">Exercise not found.</div>}
    </div>
  );
}
