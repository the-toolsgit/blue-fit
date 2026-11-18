// Finish summary (also the read-only view of a past workout until the History editor lands).
import { useMemo, useState } from "react";
import { FLEX } from "../../core/figure/poses";
import { PR_LABEL } from "../../core/records";
import { skippedVolume, summarize } from "../../core/session";
import { MUSCLE_GROUPS } from "../../core/types";
import { fmtNum } from "../../core/util";
import { CountUp } from "../components/CountUp";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { Confirm } from "../components/Sheet";
import { fmtDate, fmtVolume, loadSuffix, setsLine } from "../format";
import { back, go } from "../router";
import { useStore } from "../store";

export function SummaryScreen({ id }: { id?: string }) {
  const { sessions, exMap, finished, deleteSession } = useStore();
  const s = sessions.find((x) => x.id === id);
  const [del, setDel] = useState(false);
  const fresh = !!s?.finishedAt && Date.now() - Date.parse(s.finishedAt) < 10 * 60_000;
  const sum = useMemo(() => (s ? summarize(s, exMap, finished) : null), [s, exMap, finished]);
  if (!s || !sum) return <div className="page"><div className="empty">Workout not found.<button className="btn btn-ghost" onClick={() => go("history")}>History</button></div></div>;
  // Sets left undone show as a red part after the blue (done) part.
  const skip = s ? skippedVolume(s, exMap) : {};
  const sk = (g: keyof typeof skip) => skip[g] ?? 0;
  const groups = MUSCLE_GROUPS.filter((m) => sum.perGroup[m.id] > 0 || sk(m.id) > 0);
  const maxG = Math.max(1, ...groups.map((m) => sum.perGroup[m.id] + sk(m.id)));
  const anySkipped = groups.some((m) => sk(m.id) > 0);

  return (
    <div className="page">
      {!fresh && <button className="icon-btn" onClick={() => back("history")} aria-label="Back" style={{ marginLeft: -10 }}><Icon name="back" /></button>}
      <section style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: 6, padding: fresh ? "18px 0 8px" : "0 0 8px" }}>
        {fresh && <div className="fig-stage"><Figure spec={FLEX} size={150} speed={1.4} label="Flexing figure" /></div>}
        <span className="eyebrow">{fmtDate(s.date, { weekday: "long", month: "long", day: "numeric" })}{s.deload ? <span style={{ color: "var(--neon-2)" }}> · Deload</span> : null}</span>
        <h1 className="title-xl neon-grad">{fresh ? "Workout complete" : s.title}</h1>
        {fresh && <span className="muted">{s.title}</span>}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
        {[
          { l: "minutes", v: sum.durationMin, f: (n: number) => String(Math.round(n)) },
          { l: "sets", v: sum.setsDone, f: (n: number) => String(Math.round(n)) },
          { l: "volume lb", v: sum.tonnage, f: fmtVolume },
        ].map((t) => (
          <div key={t.l} className="glass edge" style={{ padding: "14px 10px", textAlign: "center", borderRadius: 18 }}>
            <div className="mono neon" style={{ fontSize: 28, lineHeight: 1 }}><CountUp value={t.v} format={t.f} /></div>
            <div className="eyebrow" style={{ fontSize: 10, marginTop: 6 }}>{t.l}</div>
          </div>
        ))}
      </div>

      {sum.prs.length > 0 && (
        <>
          <h2 className="section-title" style={{ color: "var(--pink)" }}>Personal records</h2>
          <div className="glass" style={{ padding: 6, borderColor: "color-mix(in srgb,var(--pink) 40%,transparent)", boxShadow: "0 0 40px -18px var(--pink-glow)" }}>
            {sum.prs.map((p) => (
              <div key={p.exerciseId} className="list-row">
                <span style={{ color: "var(--pink)" }}><Icon name="trophy" /></span>
                <span className="grow"><b>{exMap.get(p.exerciseId)?.name}</b><br /><span className="muted" style={{ fontSize: 13 }}>{p.kinds.map((k) => PR_LABEL[k]).join(" · ")}</span></span>
              </div>
            ))}
          </div>
        </>
      )}

      {groups.length > 0 && (
        <>
          <h2 className="section-title">Sets per muscle</h2>
          <div className="glass" style={{ padding: 14, display: "grid", gap: 10 }}>
            {groups.map((m) => (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "96px 1fr 34px", alignItems: "center", gap: 10, fontSize: 14 }}>
                <span>{m.label}</span>
                <div className="vbar">
                  {sk(m.id) > 0
                    ? <div className="fill split" style={{ width: `${((sum.perGroup[m.id] + sk(m.id)) / maxG) * 100}%` }}>
                        <span style={{ width: `${(sum.perGroup[m.id] / (sum.perGroup[m.id] + sk(m.id))) * 100}%` }} /><span className="skipped" />
                      </div>
                    : <div className="fill" style={{ width: `${(sum.perGroup[m.id] / maxG) * 100}%` }} />}
                </div>
                <span className="mono" style={{ textAlign: "right" }}>{fmtNum(sum.perGroup[m.id])}</span>
              </div>
            ))}
            {anySkipped && <p className="muted" style={{ fontSize: 12 }}><span style={{ color: "var(--bad)" }}>Red</span> = sets skipped.</p>}
          </div>
        </>
      )}

      <h2 className="section-title">Exercises</h2>
      <div className="glass" style={{ padding: 4 }}>
        {s.entries.map((e) => {
          const ex = exMap.get(e.exerciseId);
          return (
            <button key={e.id} className="list-row" onClick={() => go(`exercise/${e.exerciseId}`)}>
              <Figure spec={ex?.figure} size={38} still className="thin" />
              <span className="grow">
                <span style={{ display: "block", fontWeight: 600 }}>{ex?.name ?? e.exerciseId}</span>
                <span className="mono muted" style={{ fontSize: 13 }}>{setsLine(e.sets)}{ex && e.sets.some((x) => x.weight) ? loadSuffix(ex) : ""}</span>
                {e.notes && <span className="muted" style={{ display: "block", fontSize: 12 }}>{e.notes}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {s.notes && <div className="glass" style={{ padding: 14, marginTop: 12, fontSize: 14 }}><span className="eyebrow">Notes</span><p style={{ marginTop: 6 }}>{s.notes}</p></div>}

      <div className="stack" style={{ marginTop: 18 }}>
        {fresh && <button className="btn btn-primary btn-xl" onClick={() => go("today")}>Done</button>}
        <button className="btn btn-ghost btn-block" onClick={() => go(`edit/${s.id}`)}><Icon name="note" size={18} /> Edit workout</button>
        <button className="btn btn-quiet btn-block" style={{ color: "var(--bad)" }} onClick={() => setDel(true)}><Icon name="trash" size={18} /> Delete workout</button>
      </div>
      <Confirm open={del} title="Delete this workout?" body="It's removed from history, records and charts. This can't be undone." confirm="Delete" danger
        onClose={() => setDel(false)} onConfirm={() => { deleteSession(s.id); go("history"); }} />
    </div>
  );
}
