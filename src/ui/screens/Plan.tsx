import { lazy, Suspense, useState } from "react";
import { deloadActive, deloadWeek, endDeload } from "../../core/deload";
import { localDate } from "../../core/util";
import { DELOAD_RULE } from "../components/DeloadBanner";
import { copyName, duplicateRoutine, moveSlot, routineUsed, setCurrent } from "../../core/routineEdit";
import { Confirm, Sheet } from "../components/Sheet";
import type { Exercise, Routine, RoutineDay, VolumeTarget } from "../../core/types";
import { estimateMinutes } from "../../core/timeEstimate";
import { formatTarget, planVolume } from "../../core/volume";
import { muscleLabel } from "../../core/types";
import { fmtNum } from "../../core/util";
import { Icon } from "../components/Icon";
import { fmtDate } from "../format";
import { go } from "../router";
import { useStore } from "../store";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SortableDayList = lazy(() => import("../components/SortableDayList").then((m) => ({ default: m.SortableDayList })));

/**
 * What this workout adds to the week: only the muscles it works, with its sets (indirect = ½) on top of the rest
 * of the week's planned sets, against the weekly target.
 */
function DayVolume({ routine, day, exMap, targets }: { routine: Routine; day: RoutineDay; exMap: Map<string, Exercise>; targets: VolumeTarget[] }) {
  const dayVol = planVolume({ ...routine, days: [day] }, exMap).filter((v) => v.sets > 0).sort((a, b) => b.sets - a.sets);
  const week = new Map(planVolume(routine, exMap).map((v) => [v.group, v.sets]));
  const tmap = new Map(targets.map((t) => [t.group, t]));
  if (!dayVol.length) return null;
  return (
    <div className="glass" style={{ padding: "6px 14px" }}>
      {dayVol.map((v) => {
        const total = week.get(v.group) ?? v.sets, t = tmap.get(v.group);
        const scale = Math.max(total, t?.max ?? t?.min ?? 0, 1) * 1.1;
        const before = total - v.sets;
        return (
          <div key={v.group} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="spread" style={{ alignItems: "baseline" }}>
              <span style={{ fontWeight: 600 }}>{muscleLabel(v.group)}</span>
              <span className="mono" style={{ fontSize: 18, color: "var(--neon-ink)" }}>+{fmtNum(v.sets)} <span style={{ fontSize: 12 }}>sets</span></span>
            </div>
            <div className="vbar" style={{ marginTop: 7 }}>
              {t?.min != null && <div className="band" style={{ left: `${(t.min / scale) * 100}%`, width: `${(((t.max ?? scale) - t.min) / scale) * 100}%` }} />}
              <div className="fill none" style={{ width: `${(total / scale) * 100}%`, opacity: 0.45 }} />
              <div className="fill" style={{ left: `${(before / scale) * 100}%`, width: `${(v.sets / scale) * 100}%` }} />
            </div>
            <div className="muted mono" style={{ fontSize: 12, marginTop: 5 }}>{fmtNum(total)} a week{t && t.min != null ? ` · target ${formatTarget(t)}` : ""}</div>
          </div>
        );
      })}
      <p className="muted" style={{ fontSize: 12, padding: "10px 0 6px" }}>Bright = this workout · dim = the rest of the week · dashed = weekly target. Indirect sets count as half.</p>
    </div>
  );
}

export function PlanScreen() {
  const { routine, routines, exMap, targets, sessions, saveRoutine, saveRoutines, deleteRoutine, toast, settings, saveSettings } = useStore();
  const today = localDate(new Date());
  const deloading = deloadActive(settings, today);
  const [confirmDeload, setConfirmDeload] = useState(false);
  const [manage, setManage] = useState(false);
  const [del, setDel] = useState<Routine | null>(null);
  const days = (routine?.days ?? []).filter((d) => d.slots.length).sort((a, b) => ((a.weekday ?? 9) + 6) % 7 - ((b.weekday ?? 9) + 6) % 7);
  const [dayId, setDayId] = useState(days.find((d) => d.weekday === new Date().getDay())?.id ?? days[0]?.id);
  if (!routine) return <div className="page"><div className="empty">No routine.</div></div>;
  const day = days.find((d) => d.id === dayId) ?? days[0];
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
              <b style={{ font: "700 16px var(--display)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--neon-ink)" }}>{r.title}</b>
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
            <Suspense fallback={<div style={{ minHeight: day.slots.length * 64 }} />}>
              <SortableDayList slots={day.slots} exMap={exMap} onOpen={(id) => go(`exercise/${id}`)}
                onMove={(from, to) => saveRoutine(moveSlot(routine, day.id, from, to))} />
            </Suspense>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: "6px 4px 0" }}>Press and hold an exercise to move it.</p>
        </>
      )}

      {day && <>
        <h2 className="section-title">This workout's volume</h2>
        <DayVolume routine={routine} day={day} exMap={exMap} targets={targets} />
      </>}
      <Sheet open={manage} onClose={() => setManage(false)} label="Plans">
        <div className="spread" style={{ marginBottom: 8 }}>
          <h3 className="title-md" style={{ textTransform: "uppercase" }}>Plans</h3>
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
