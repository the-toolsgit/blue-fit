// Finish summary (also the read-only view of a past workout until the History editor lands).
import { useMemo, useState } from "react";
import { FLEX } from "../../core/figure/poses";
import { PR_LABEL } from "../../core/records";
import { workoutNotes, type NoteTone } from "../../core/notes";
import { animalFor } from "../../core/animals";
import { Animal } from "../components/Animal";
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
  const { sessions, exMap, finished, deleteSession, routines } = useStore();
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
  // Notes: what changed against past workouts and what to do; the volume as an animal of about that weight
  const notes = workoutNotes(s, finished, exMap, routines.find((r) => r.id === s.routineId) ?? routines.find((r) => r.isCurrent));
  const animal = animalFor(sum.tonnage);

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

      {animal && (
        <section className="glass row animal-card" style={{ marginTop: 10, padding: "12px 14px", gap: 12, borderRadius: 18 }}>
          <Animal id={animal.animal.id} size={118} label={animal.animal.name} />
          <div className="grow">
            <div className="eyebrow" style={{ fontSize: 10 }}>You lifted</div>
            <div style={{ font: "800 24px/1.05 var(--display)", textTransform: "uppercase", color: "var(--neon-ink)" }}>{animal.label}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{fmtVolume(sum.tonnage)} lb · {animal.count === 1 ? "about" : "each about"} {animal.animal.lb.toLocaleString("en-US")} lb</div>
          </div>
        </section>
      )}

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
            {anySkipped && <p className="muted row" style={{ fontSize: 12, gap: 6 }}><span aria-hidden style={{ width: 14, height: 8, borderRadius: 4, background: "#721d1d", display: "inline-block" }} /> = sets skipped</p>}
          </div>
        </>
      )}

      <h2 className="section-title">Exercises</h2>
      <div className="glass" style={{ padding: 4 }}>
        {s.entries.map((e) => {
          const ex = exMap.get(e.exerciseId);
          return (
            <div key={e.id} className="list-row">
              <Figure spec={ex?.figure} size={38} still className="thin" />
              <span className="grow">
                <span style={{ display: "block", fontWeight: 600 }}>{ex?.name ?? e.exerciseId}</span>
                <span className="mono muted" style={{ fontSize: 13 }}>{setsLine(e.sets)}{ex && e.sets.some((x) => x.weight) ? loadSuffix(ex) : ""}</span>
                {e.notes && <span className="muted" style={{ display: "block", fontSize: 12 }}>{e.notes}</span>}
              </span>
            </div>
          );
        })}
      </div>
      {s.notes && <div className="glass" style={{ padding: 14, marginTop: 12, fontSize: 14 }}><span className="eyebrow">Your notes</span><p style={{ marginTop: 6 }}>{s.notes}</p></div>}

      {notes.length > 0 && (
        <>
          <h2 className="section-title">Notes</h2>
          <div className="glass" style={{ padding: 6 }}>
            {notes.map((n, i) => (
              <div key={i} className="list-row note-row" style={{ alignItems: "flex-start" }}>
                <span className={`note-ic ${n.tone}`}><Icon name={NOTE_ICON[n.tone]} size={20} /></span>
                <span className="grow"><b>{n.title}</b><br /><span className="muted" style={{ fontSize: 13 }}>{n.text}</span></span>
              </div>
            ))}
          </div>
        </>
      )}

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

const NOTE_ICON: Record<NoteTone, "flame" | "up" | "check" | "note"> = { warn: "flame", up: "up", good: "check", info: "note" };
