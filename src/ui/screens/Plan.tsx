import { lazy, Suspense, useEffect, useState } from "react";
import { deloadActive, deloadWeek, endDeload } from "../../core/deload";
import { localDate } from "../../core/util";
import { DELOAD_RULE } from "../components/DeloadBanner";
import { addDay, addSlot, clearDay, copyName, duplicateRoutine, moveSlot, removeSlot, renameDay, routineUsed, setCurrent, swapSlotExercise, toggleSlotSuperset, updateSlot } from "../../core/routineEdit";
import { failureApplies, failureEligible } from "../../core/failure";
import { tempoTiming } from "../../core/figure/tempo";
import { Seg, Stepper } from "../components/Controls";
import { ExercisePicker } from "../components/ExercisePicker";
import { Figure } from "../components/Figure";
import { fmtRest } from "../format";
import { Confirm, Sheet } from "../components/Sheet";
import type { Routine, Slot } from "../../core/types";
import { estimateMinutes } from "../../core/timeEstimate";
import { useWeekFailure } from "../components/FailFlame";
import { Icon } from "../components/Icon";
import { fmtDate } from "../format";
import { go } from "../router";
import { useStore } from "../store";
import { ExerciseSheet } from "./ExerciseScreen";
import { WeekInsight } from "../components/WeekInsight";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SortableDayList = lazy(() => import("../components/SortableDayList").then((m) => ({ default: m.SortableDayList })));

export function PlanScreen() {
  const { routine, routines, exMap, targets, sessions, saveRoutine, saveRoutines, saveTargets, deleteRoutine, toast, settings, saveSettings } = useStore();
  const today = localDate(new Date());
  const weekFail = useWeekFailure(routine);
  const deloading = deloadActive(settings, today);
  const [confirmDeload, setConfirmDeload] = useState(false);
  const [manage, setManage] = useState(false);
  const [slotId, setSlotId] = useState<string | null>(null); // the exercise whose popup is open
  const [howTo, setHowTo] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; slotId: string } | null>(null);
  const [delDay, setDelDay] = useState(false);
  const [del, setDel] = useState<Routine | null>(null);
  const days = (routine?.days ?? []).filter((d) => d.slots.length).sort((a, b) => ((a.weekday ?? 9) + 6) % 7 - ((b.weekday ?? 9) + 6) % 7);
  // Every weekday has a chip (rest days too), plus any day without a weekday
  const [sel, setSel] = useState(`w${new Date().getDay()}`);
  if (!routine) return <div className="page"><div className="empty">No routine.</div></div>;
  const chips = [
    ...[1, 2, 3, 4, 5, 6, 0].map((w) => ({ key: `w${w}`, label: SHORT[w], weekday: w as number | null, day: routine.days.find((d) => d.weekday === w) })),
    ...routine.days.filter((d) => d.weekday == null && d.slots.length).map((d) => ({ key: d.id, label: d.title, weekday: null as number | null, day: d as typeof d | undefined })),
  ];
  const cur = chips.find((c) => c.key === sel) ?? chips[0];
  const day = cur.day;
  const rest = !day || !day.slots.length;
  // Everything is edited in place and saved at once: name and day title are fields that look like text,
  // tap an exercise for its popup, hold to move, swipe left to delete, Add exercise at the bottom.
  const slot = day?.slots.find((x) => x.id === slotId);
  const slotIdx = day && slot ? day.slots.indexOf(slot) : -1;
  const setSlot = (p: Partial<Slot>) => day && slot && saveRoutine(updateSlot(routine, day.id, slot.id, p));
  const removeWithUndo = (s: Slot) => {
    if (!day) return;
    const before = routine;
    saveRoutine(removeSlot(routine, day.id, s.id));
    toast({ kind: "info", title: "Exercise removed", body: exMap.get(s.exerciseId)?.name, action: { label: "Undo", run: () => saveRoutine(before) } });
  };
  const allSets = routine.days.reduce((a, d) => a + d.slots.reduce((b, s) => b + s.sets, 0), 0);
  const sets = day?.slots.reduce((a, s) => a + s.sets, 0) ?? 0;

  return (
    <div className="page">
      <div className="spread">
        <span className="eyebrow">Current plan</span>
        <button className="btn btn-ghost" style={{ minHeight: 40, padding: "0 12px" }} onClick={() => setManage(true)}>Plans</button>
      </div>
      <InlineText as="h1" className="title-lg" textClass="neon-grad" style={{ marginTop: 6 }} label="Plan name" value={routine.name}
        onSave={(name) => saveRoutine({ ...routine, name })} />
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>{days.length} days · {routine.days.flatMap((d) => d.slots).length} exercises · {allSets} sets a week</p>

      <div className="chips-scroll" style={{ marginTop: 12 }}>
        {chips.map((c) => <button key={c.key} className={"chip" + (!c.day?.slots.length ? " chip-rest" : "")} aria-pressed={c.key === cur.key} onClick={() => setSel(c.key)}>{c.label}</button>)}
      </div>
      {rest ? (
        <>
          <div className="spread" style={{ margin: "14px 4px 8px" }}><h2 className="title-md" style={{ textTransform: "uppercase" }}>Rest day</h2></div>
          <div className="glass" style={{ padding: 4 }}>
            <p className="muted" style={{ textAlign: "center", fontSize: 14, padding: "14px 12px 4px" }}>No workout planned.</p>
            <button className="list-row add-row" onClick={() => setPicker({ mode: "add" })}><Icon name="plus" /> Add exercise</button>
          </div>
        </>
      ) : day && (
        <>
          <div className="spread" style={{ margin: "14px 4px 8px" }}>
            <InlineText as="h2" className="title-md" style={{ textTransform: "uppercase", flex: 1, minWidth: 0 }} label="Day name" value={day.title}
              onSave={(t) => saveRoutine(renameDay(routine, day.id, t))} />
            <span className="mono muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{sets} sets · ~{estimateMinutes(sets, day.slots.length)} min</span>
          </div>
          <div className="glass" style={{ padding: 4 }}>
            <Suspense fallback={<div style={{ minHeight: day.slots.length * 64 }} />}>
              <SortableDayList slots={day.slots} exMap={exMap} onOpen={(s) => setSlotId(s.id)} onDelete={removeWithUndo}
                onMove={(from, to) => saveRoutine(moveSlot(routine, day.id, from, to))} fail={weekFail.get(day.id)} />
            </Suspense>
            <button className="list-row add-row" onClick={() => setPicker({ mode: "add" })}><Icon name="plus" /> Add exercise</button>
          </div>
          <div className="row" style={{ margin: "6px 4px 0", justifyContent: "flex-end" }}>
            <button className="btn btn-quiet" style={{ color: "var(--bad)", fontSize: 13, minHeight: 44, padding: 0, whiteSpace: "nowrap" }} onClick={() => setDelDay(true)}><Icon name="trash" size={16} /> Delete day</button>
          </div>
        </>
      )}

      <h2 className="section-title">Plan overview</h2>
      <WeekInsight routine={routine} exMap={exMap} targets={targets} weekFail={weekFail} edit={{ targets, onEdit: (t) => saveTargets([t]) }} />

      {routine.rules?.length ? (
        <div className="chips-scroll" style={{ marginTop: 22, gap: 10 }}>
          {routine.rules.map((r) => (
            <div key={r.title} className="glass" style={{ minWidth: 240, maxWidth: 260, padding: 12, borderRadius: 16, flex: "none" }}>
              <b style={{ font: "700 16px var(--display)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--neon-ink)" }}>{r.title}</b>
              <p style={{ fontSize: 13, marginTop: 4 }}>{r.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      <section className="glass row" style={{ padding: "10px 10px 10px 14px", marginTop: 14, borderRadius: 16, borderColor: deloading ? "color-mix(in srgb, var(--neon-2) 50%, transparent)" : undefined }}>
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
      <Sheet open={!!slot} onClose={() => setSlotId(null)} label="Exercise in plan">
        {slot && day && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row">
              <Figure spec={exMap.get(slot.exerciseId)?.figure} size={54} timing={tempoTiming(exMap.get(slot.exerciseId)?.tempo, slot.exerciseId)} />
              <h3 className="title-md grow">{exMap.get(slot.exerciseId)?.name}</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Stepper label="Sets" value={slot.sets} step={1} decimals={false} min={1} onChange={(v) => setSlot({ sets: Math.max(1, Math.min(20, v ?? 1)) })} />
              <Stepper label="Rest" suffix={fmtRest(slot.restSec)} value={slot.restSec} step={15} decimals={false} onChange={(v) => setSlot({ restSec: v ?? settings.restDefaultSec })} />
              <Stepper label="Reps min" value={slot.repMin} step={1} decimals={false} min={1} onChange={(v) => setSlot({ repMin: Math.max(1, v ?? 1), repMax: Math.max(slot.repMax, v ?? 1) })} />
              <Stepper label="Reps max" value={slot.repMax} step={1} decimals={false} min={1} onChange={(v) => setSlot({ repMax: Math.max(slot.repMin, v ?? slot.repMin) })} />
            </div>
            {failureApplies(settings.profile?.goal) && (() => {
              const mode = slot.toFailure === true ? "on" : slot.toFailure === false ? "off" : "auto";
              const why = weekFail.get(day.id)?.get(slot.id);
              const safe = failureEligible(exMap.get(slot.exerciseId));
              return (
                <div>
                  <span className="row" style={{ gap: 6, fontWeight: 600, marginBottom: 6 }}><span style={{ color: "var(--warn)", display: "inline-flex" }}><Icon name="flame" size={16} /></span>Last set to failure</span>
                  <Seg label="Last set to failure" value={mode} onChange={(v) => setSlot({ toFailure: v === "auto" ? undefined : v === "on" })}
                    options={[{ v: "auto", label: "Auto" }, { v: "on", label: "On" }, { v: "off", label: "Off" }]} />
                  <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>
                    {mode === "auto" ? (why ? `This week: yes. ${why.join(" · ")}.` : safe ? "The app picks it when it fits the workout and your week." : "Auto never picks this one (★ lift or not safe to fail).")
                      : mode === "on" ? "Always, every week." : "Never."}
                  </p>
                </div>
              );
            })()}
            <div className="field"><label htmlFor="snote">Note</label>
              <input id="snote" className="input" value={slot.notes ?? ""} placeholder="e.g. elbows to hips" onChange={(e) => setSlot({ notes: e.target.value || undefined })} /></div>
            <div>
              {slotIdx < day.slots.length - 1 && (
                <button className="menu-item" onClick={() => saveRoutine(toggleSlotSuperset(routine, day.id, slot.id))}>
                  <Icon name="link" /> {slot.supersetGroup && slot.supersetGroup === day.slots[slotIdx + 1]?.supersetGroup ? "Unlink from next (end superset)" : "Superset with next exercise"}
                </button>
              )}
              <button className="menu-item" onClick={() => setPicker({ mode: "swap", slotId: slot.id })}><Icon name="swap" /> Swap exercise</button>
              <button className="menu-item" onClick={() => setHowTo(slot.exerciseId)}><Icon name="info" /> How to do it</button>
              <button className="menu-item danger" onClick={() => { setSlotId(null); removeWithUndo(slot); }}><Icon name="trash" /> Remove from day</button>
            </div>
            <button className="btn btn-primary btn-block" onClick={() => setSlotId(null)}>Done</button>
          </div>
        )}
      </Sheet>
      <ExercisePicker open={!!picker} title={picker?.mode === "swap" ? "Swap exercise" : "Add exercise"}
        exclude={picker?.mode === "swap" ? day?.slots.find((x) => x.id === picker.slotId)?.exerciseId : undefined}
        onClose={() => setPicker(null)}
        onPick={(ex) => {
          if (picker?.mode === "swap") { if (day) saveRoutine(swapSlotExercise(routine, day.id, picker.slotId, ex)); return; }
          // A rest day without a plan day yet gets one on that weekday
          const made = day ? { routine, dayId: day.id } : addDay(routine, cur.weekday);
          saveRoutine(addSlot(made.routine, made.dayId, ex, settings.restDefaultSec).routine);
        }} />
      <ExerciseSheet id={howTo} onClose={() => setHowTo(null)} failWhy={day && slot ? weekFail.get(day.id)?.get(slot.id) : undefined} />
      <Confirm open={delDay} title={`Delete ${day?.title ?? "this day"}?`} body="All its exercises are removed and it becomes a rest day. Past workouts stay in history." confirm="Delete" danger
        onClose={() => setDelDay(false)} onConfirm={() => { if (day) saveRoutine(clearDay(routine, day.id)); }} />
      <Confirm open={confirmDeload} title="Start a deload week?" confirm="Start deload"
        body={<>{DELOAD_RULE} It lasts until {fmtDate(deloadWeek(today, settings.weekStartDay).end, { weekday: "long" })}, then your normal plan comes back.</>}
        onClose={() => setConfirmDeload(false)} onConfirm={() => saveSettings({ ...settings, deload: deloadWeek(today, settings.weekStartDay), deloadDismissedAt: null })} />
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
                {!r.isCurrent && <button className="chip" onClick={() => { setManage(false); go(`plan-edit/${r.id}`); }}>Edit</button>}
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

/** Text that looks exactly like the heading it replaces but is a field: tap it and the keyboard opens.
 *  The heading stays drawn (gradient and all) under a see-through input; while typing the input's own text shows. */
function InlineText({ as: Tag, className, textClass, style, label, value, onSave }: {
  as: "h1" | "h2"; className: string; textClass?: string; style?: React.CSSProperties; label: string; value: string; onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setV(value); }, [value, focus]);
  const commit = () => { const t = v.trim(); if (t && t !== value) onSave(t); else setV(value); };
  return (
    <Tag className={className + " inline-edit"} style={style}>
      <span aria-hidden className={textClass} style={{ visibility: focus ? "hidden" : undefined }}>{v || "\u00a0"}</span>
      <input aria-label={label} value={v} enterKeyHint="done" autoCapitalize="characters" spellCheck={false}
        onChange={(e) => setV(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); commit(); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setV(value); e.currentTarget.blur(); } }} />
    </Tag>
  );
}
