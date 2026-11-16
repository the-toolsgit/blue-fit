import { useMemo, useState } from "react";
import { deloadActive, deloadWeek, endDeload } from "../../core/deload";
import { localDate } from "../../core/util";
import { DELOAD_RULE } from "../components/DeloadBanner";
import { copyName, duplicateRoutine, routineUsed, setCurrent } from "../../core/routineEdit";
import { Confirm, Sheet } from "../components/Sheet";
import type { Routine } from "../../core/types";
import { estimateMinutes } from "../../core/timeEstimate";
import { planVolume } from "../../core/volume";
import { MUSCLE_GROUPS } from "../../core/types";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { VolumeTable } from "../components/VolumeTable";
import { fmtDate, fmtRest, repRange } from "../format";
import { go } from "../router";
import { useStore } from "../store";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PlanScreen() {
  const { routine, routines, exMap, targets, sessions, saveRoutine, saveRoutines, deleteRoutine, toast, settings, saveSettings } = useStore();
  const today = localDate(new Date());
  const deloading = deloadActive(settings, today);
  const [confirmDeload, setConfirmDeload] = useState(false);
  const [manage, setManage] = useState(false);
  const [del, setDel] = useState<Routine | null>(null);
  const days = (routine?.days ?? []).filter((d) => d.slots.length).sort((a, b) => ((a.weekday ?? 9) + 6) % 7 - ((b.weekday ?? 9) + 6) % 7);
  const [dayId, setDayId] = useState(days.find((d) => d.weekday === new Date().getDay())?.id ?? days[0]?.id);
  const vol = useMemo(() => (routine ? planVolume(routine, exMap) : []), [routine, exMap]);
  if (!routine) return <div className="page"><div className="empty">No routine.</div></div>;
  const day = days.find((d) => d.id === dayId) ?? days[0];
  const totals = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, vol.find((v) => v.group === m.id)?.sets ?? 0])) as never;
  const dayCount = Object.fromEntries(vol.map((v) => [v.group, v.directDays]));
  const allSets = routine.days.reduce((a, d) => a + d.slots.reduce((b, s) => b + s.sets, 0), 0);
  const sets = day?.slots.reduce((a, s) => a + s.sets, 0) ?? 0;

  return (
    <div className="page">
      <div className="spread">
        <span className="eyebrow">Current plan</span>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost" style={{ minHeight: 40, padding: "0 12px" }} onClick={() => setManage(true)}>Plans</button>
          <button className="btn btn-primary" style={{ minHeight: 40, padding: "0 14px" }} onClick={() => go(`plan-edit/${routine.id}`)}><Icon name="note" size={18} /> Edit</button>
        </div>
      </div>
      <h1 className="title-lg neon-grad" style={{ marginTop: 6 }}>{routine.name}</h1>
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>{days.length} days · {routine.days.flatMap((d) => d.slots).length} exercises · {allSets} sets a week</p>

      <section className="glass row" style={{ padding: "10px 10px 10px 14px", marginTop: 12, borderRadius: 16, borderColor: deloading ? "color-mix(in srgb, var(--neon-2) 50%, transparent)" : undefined }}>
        <div className="grow">
          <div style={{ font: "700 16px var(--display)", letterSpacing: ".08em", textTransform: "uppercase", color: deloading ? "var(--neon-2)" : undefined }}>
            {deloading ? `Deload week · until ${fmtDate(settings.deload!.end, { weekday: "short" })}` : "Deload week"}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{DELOAD_RULE}</div>
        </div>
        {deloading
          ? <button className="btn btn-ghost" style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }} onClick={() => { saveSettings(endDeload(settings, today)); toast({ kind: "info", title: "Deload ended", body: "Back to your normal plan." }); }}>End</button>
          : <button className="btn btn-ghost" style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }} onClick={() => setConfirmDeload(true)}>Start</button>}
      </section>
      <Confirm open={confirmDeload} title="Start a deload week?" confirm="Start deload"
        body={<>{DELOAD_RULE} It lasts until {fmtDate(deloadWeek(today, settings.weekStartDay).end, { weekday: "long" })}, then your normal plan comes back.</>}
        onClose={() => setConfirmDeload(false)} onConfirm={() => saveSettings({ ...settings, deload: deloadWeek(today, settings.weekStartDay), deloadDismissedAt: null })} />

      {routine.rules?.length ? (
        <div className="chips-scroll" style={{ marginTop: 14, gap: 10 }}>
          {routine.rules.map((r) => (
            <div key={r.title} className="glass" style={{ minWidth: 240, maxWidth: 260, padding: 12, borderRadius: 16, flex: "none" }}>
              <b style={{ font: "700 16px var(--display)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--neon)" }}>{r.title}</b>
              <p style={{ fontSize: 13, marginTop: 4 }}>{r.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="chips-scroll" style={{ marginTop: 12 }}>
        {days.map((d) => <button key={d.id} className="chip" aria-pressed={d.id === day?.id} onClick={() => setDayId(d.id)}>{d.weekday != null ? SHORT[d.weekday] : d.title}</button>)}
      </div>
      {day && (
        <>
          <div className="spread" style={{ margin: "14px 4px 8px" }}>
            <h2 className="title-md" style={{ textTransform: "uppercase" }}>{day.title}</h2>
            <span className="mono muted" style={{ fontSize: 13 }}>{sets} sets · ~{estimateMinutes(sets, day.slots.length)} min</span>
          </div>
          <div className="glass" style={{ padding: 4 }}>
            {day.slots.map((s, i) => {
              const ex = exMap.get(s.exerciseId);
              if (!ex) return null;
              return (
                <button key={s.id} className="list-row" onClick={() => go(`exercise/${ex.id}`)}>
                  <span className="mono muted" style={{ width: 16, fontSize: 13 }}>{i + 1}</span>
                  <Figure spec={ex.figure} size={44} still className="thin" />
                  <span className="grow">
                    <span style={{ display: "block", fontWeight: 600 }}>{ex.name} {ex.isHeavy && <span className="star">★</span>}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{s.notes ? `${s.notes} · ` : ""}rest {fmtRest(s.restSec)}</span>
                  </span>
                  <span className="mono" style={{ whiteSpace: "nowrap" }}>{s.sets} × {repRange(s.repMin, s.repMax)}</span>
                  <Icon name="chevron" size={16} />
                </button>
              );
            })}
          </div>
        </>
      )}

      <h2 className="section-title">Weekly volume</h2>
      <VolumeTable totals={totals} targets={targets} days={dayCount} />
      <Sheet open={manage} onClose={() => setManage(false)} label="Plans">
        <div className="spread" style={{ marginBottom: 8 }}>
          <h3 className="title-md" style={{ textTransform: "uppercase" }}>Plans</h3>
          <button className="icon-btn" onClick={() => setManage(false)} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="stack">
          {[...routines].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || (a.createdAt < b.createdAt ? 1 : -1)).map((r) => (
            <div key={r.id} className="glass" style={{ padding: 12, borderColor: r.isCurrent ? "color-mix(in srgb, var(--neon) 50%, transparent)" : undefined }}>
              <div className="spread">
                <div>
                  <b style={{ font: "700 19px var(--display)", textTransform: "uppercase" }}>{r.name}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{r.days.filter((d) => d.slots.length).length} days · {r.days.reduce((a, d) => a + d.slots.reduce((b, x) => b + x.sets, 0), 0)} sets/week</div>
                </div>
                {r.isCurrent && <span className="badge p">Current</span>}
              </div>
              <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {!r.isCurrent && <button className="chip" onClick={() => { saveRoutines(setCurrent(routines, r.id)); toast({ kind: "info", title: `${r.name} is now current` }); }}>Make current</button>}
                <button className="chip" onClick={() => { setManage(false); go(`plan-edit/${r.id}`); }}>Edit</button>
                <button className="chip" onClick={() => { const c = duplicateRoutine(r, copyName(r.name, routines.map((x) => x.name)), new Date()); saveRoutine(c); toast({ kind: "info", title: `Copied as ${c.name}` }); }}>Duplicate</button>
                {!r.isCurrent && <button className="chip" style={{ color: "var(--bad)" }} onClick={() => setDel(r)}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
      <Confirm open={!!del} title={`Delete ${del?.name ?? "plan"}?`} danger confirm="Delete"
        body={del && routineUsed(del.id, sessions) ? "Workouts you did with it stay in history." : "This can't be undone."}
        onClose={() => setDel(null)} onConfirm={() => del && deleteRoutine(del.id)} />
    </div>
  );
}
