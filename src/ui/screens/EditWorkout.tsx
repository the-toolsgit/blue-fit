// Edit a finished workout: title, date, duration, notes, exercises and every set. Saves on every change.
import { useEffect, useState } from "react";
import { setSessionDate, setSessionDuration } from "../../core/history";
import { addEntry, addSet, buildEntry, durationMin, removeEntry, removeSet, setEntry, swapEntry, updateSet } from "../../core/session";
import type { LoggedSet, Session, SetType } from "../../core/types";
import { Stepper } from "../components/Controls";
import { ExercisePicker } from "../components/ExercisePicker";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { Confirm, Sheet } from "../components/Sheet";
import { loadSuffix } from "../format";
import { go, replace } from "../router";
import { NoteSheet } from "./Workout";
import { localDate } from "../../core/util";
import { useStore } from "../store";

const TYPES: SetType[] = ["working", "warmup", "drop", "failure"];
const TYPE_UI: Record<SetType, { short: string; color: string; long: string }> = {
  working: { short: "", color: "var(--neon)", long: "Working set" }, warmup: { short: "W", color: "var(--muted)", long: "Warm-up" },
  drop: { short: "D", color: "var(--neon-2)", long: "Drop set" }, failure: { short: "F", color: "var(--bad)", long: "To failure" },
};

function NumField({ value, onChange, label, decimals }: { value: number | null; onChange: (v: number | null) => void; label: string; decimals?: boolean }) {
  const [t, setT] = useState(value == null ? "" : String(value));
  useEffect(() => setT(value == null ? "" : String(value)), [value]);
  return (
    <input className="input mono" aria-label={label} inputMode={decimals ? "decimal" : "numeric"} value={t} placeholder="—"
      style={{ textAlign: "center", fontSize: 18, padding: "8px 4px", minHeight: 44 }}
      onFocus={(e) => e.currentTarget.select()} onChange={(e) => setT(e.target.value.replace(/[^0-9.]/g, ""))}
      onBlur={() => { const n = parseFloat(t); onChange(Number.isFinite(n) ? (decimals ? n : Math.round(n)) : null); }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
  );
}

export function EditWorkoutScreen({ id }: { id?: string }) {
  const { sessions, exMap, finished, saveSession, settings } = useStore();
  const s = sessions.find((x) => x.id === id);
  const [menu, setMenu] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; entryId: string } | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  if (!s) return <div className="page"><div className="empty">Workout not found.</div></div>;
  const commit = (n: Session) => saveSession(n);
  const history = finished.filter((x) => x.id !== s.id);
  const done = () => {
    // Drop exercises left without sets
    const cleaned = { ...s, entries: s.entries.filter((e) => e.sets.length > 0) };
    if (cleaned.entries.length !== s.entries.length) commit(cleaned);
    replace(`summary/${s.id}`);
  };
  const addDoneSet = (entryId: string) => {
    const n = addSet(s, entryId);
    const e = n.entries.find((x) => x.id === entryId)!;
    const last = e.sets[e.sets.length - 1];
    commit(updateSet(n, entryId, last.id, { done: true, completedAt: s.finishedAt ?? s.startedAt }));
  };
  const menuEntry = s.entries.find((e) => e.id === menu);

  return (
    <div className="page">
      <div className="spread" style={{ marginBottom: 6 }}>
        <button className="icon-btn" onClick={done} aria-label="Back" style={{ marginLeft: -10 }}><Icon name="back" /></button>
        <button className="btn btn-primary" style={{ minHeight: 42 }} onClick={done}><Icon name="check" size={18} /> Done</button>
      </div>
      <span className="eyebrow">Edit workout</span>
      <div className="glass" style={{ padding: 14, marginTop: 10, display: "grid", gap: 12 }}>
        <div className="field"><label htmlFor="ttl">Title</label>
          <input id="ttl" className="input" defaultValue={s.title} onBlur={(e) => e.target.value.trim() && e.target.value !== s.title && commit({ ...s, title: e.target.value.trim() })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
          <div className="field"><label htmlFor="dt">Date</label>
            <input id="dt" type="date" className="input" value={s.date} max={localDate(new Date())} onChange={(e) => e.target.value && commit(setSessionDate(s, e.target.value))} /></div>
          <Stepper label="Minutes" value={durationMin(s)} step={5} decimals={false} onChange={(v) => commit(setSessionDuration(s, v ?? 0))} />
        </div>
      </div>

      {s.entries.map((e) => {
        const ex = exMap.get(e.exerciseId);
        return (
          <section key={e.id} className="glass" style={{ padding: 12, marginTop: 12 }}>
            <div className="row">
              <Figure spec={ex?.figure} size={40} still className="thin" />
              <span className="grow" style={{ font: "700 19px var(--display)" }}>{ex?.name ?? e.exerciseId} {ex?.isHeavy && <span className="star">★</span>}</span>
              <button className="icon-btn" onClick={() => setMenu(e.id)} aria-label={`Options for ${ex?.name}`}><Icon name="more" /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 14px 1fr 40px", gap: 6, alignItems: "center", marginTop: 8 }}>
              <span className="eyebrow" style={{ fontSize: 9 }}>Type</span><span className="eyebrow" style={{ fontSize: 9 }}>lb{ex ? loadSuffix(ex) : ""}</span><span /><span className="eyebrow" style={{ fontSize: 9 }}>Reps</span><span />
              {e.sets.map((x: LoggedSet) => {
                const t = TYPE_UI[x.type];
                const wi = e.sets.filter((y, k) => y.type === "working" && k <= e.sets.indexOf(x)).length;
                return [
                  <button key={x.id + "t"} aria-label={`Set type: ${t.long}. Tap to change`} onClick={() => commit(updateSet(s, e.id, x.id, { type: TYPES[(TYPES.indexOf(x.type) + 1) % 4] }))}
                    style={{ height: 40, borderRadius: 10, font: "700 15px var(--mono)", color: t.color, border: `1px solid color-mix(in srgb, ${t.color} 45%, transparent)` }}>{t.short || wi}</button>,
                  <NumField key={x.id + "w"} label="Weight" decimals value={x.weight} onChange={(v) => commit(updateSet(s, e.id, x.id, { weight: v }))} />,
                  <span key={x.id + "x"} className="muted" style={{ textAlign: "center" }}>×</span>,
                  <NumField key={x.id + "r"} label="Reps" value={x.reps} onChange={(v) => commit(updateSet(s, e.id, x.id, { reps: v }))} />,
                  <button key={x.id + "d"} className="icon-btn" aria-label="Delete set" onClick={() => commit(removeSet(s, e.id, x.id))}><Icon name="trash" size={18} /></button>,
                ];
              })}
            </div>
            <button className="btn btn-quiet btn-block" style={{ minHeight: 40, fontSize: 14 }} onClick={() => addDoneSet(e.id)}><Icon name="plus" size={18} /> Add set</button>
            {e.notes && <p className="muted" style={{ fontSize: 13 }}><Icon name="note" size={13} /> {e.notes}</p>}
          </section>
        );
      })}

      <button className="btn btn-ghost btn-block" style={{ marginTop: 14, minHeight: 52 }} onClick={() => setPicker({ mode: "add" })}><Icon name="plus" /> Add exercise</button>
      <div className="field" style={{ marginTop: 14 }}><label htmlFor="nts">Workout notes</label>
        <textarea id="nts" className="input" defaultValue={s.notes ?? ""} onBlur={(e) => e.target.value !== (s.notes ?? "") && commit({ ...s, notes: e.target.value.trim() || undefined })} /></div>

      <Sheet open={!!menuEntry} onClose={() => setMenu(null)} label="Exercise options">
        {menuEntry && (
          <div>
            <div className="eyebrow" style={{ padding: "0 8px 8px" }}>{exMap.get(menuEntry.exerciseId)?.name}</div>
            <button className="menu-item" onClick={() => { setPicker({ mode: "swap", entryId: menuEntry.id }); setMenu(null); }}><Icon name="swap" /> Change exercise</button>
            <button className="menu-item" onClick={() => { setNoteFor(menuEntry.id); setMenu(null); }}><Icon name="note" /> {menuEntry.notes ? "Edit note" : "Add note"}</button>
            <button className="menu-item" onClick={() => { go(`exercise/${menuEntry.exerciseId}`); }}><Icon name="info" /> Exercise details</button>
            <button className="menu-item danger" onClick={() => { setRemove(menuEntry.id); setMenu(null); }}><Icon name="trash" /> Remove exercise</button>
          </div>
        )}
      </Sheet>
      <ExercisePicker open={!!picker} title={picker?.mode === "swap" ? "Change exercise" : "Add exercise"} onClose={() => setPicker(null)}
        onPick={(ex) => {
          if (picker?.mode === "swap") {
            // keep the logged sets, only the exercise changes
            const old = s.entries.find((x) => x.id === picker.entryId)!;
            const n = swapEntry(s, picker.entryId, ex, history);
            commit(setEntry(n, picker.entryId, { sets: old.sets, swappedFromId: undefined }));
          } else {
            const ne = buildEntry(ex, history, { restSec: ex.defaultRestSec || settings.restDefaultSec, sets: 1 });
            commit(addEntry(s, { ...ne, sets: ne.sets.map((x) => ({ ...x, done: true, completedAt: s.finishedAt ?? s.startedAt })) }));
          }
        }} />
      <NoteSheet open={!!noteFor} title="Note" value={s.entries.find((x) => x.id === noteFor)?.notes ?? ""}
        onSave={(v) => noteFor && commit(setEntry(s, noteFor, { notes: v || undefined }))} onClose={() => setNoteFor(null)} />
      <Confirm open={!!remove} title="Remove this exercise?" body="Its sets in this workout are deleted." confirm="Remove" danger onClose={() => setRemove(null)} onConfirm={() => remove && commit(removeEntry(s, remove))} />
    </div>
  );
}
