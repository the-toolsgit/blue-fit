import { useEffect, useRef, useState } from "react";
// A normal import (not lazy): a lazy list showed about 0.3 s after the rest of the screen the first time
import { SortableDayList } from "../components/SortableDayList";
import { newPlanKey } from "../planDraft";
import { SlotSheet } from "../components/SlotSheet";
import { useKeptState } from "../keptState";
import { deloadActive, deloadWeek, endDeload } from "../../core/deload";
import { localDate, WEEKDAY_SHORT } from "../../core/util";
import { DELOAD_RULE } from "../components/DeloadBanner";
import { addDay, addSlot, clearDay, copyName, duplicateRoutine, moveSlot, newRoutine, insertSlot, removeSlot, renameDay, routineUsed, setCurrent, swapSlotExercise, toggleSlotSuperset, updateSlot } from "../../core/routineEdit";
import { ExercisePicker } from "../components/ExercisePicker";
import { Confirm } from "../components/Sheet";
import { completeProfile, type Routine, type Slot } from "../../core/types";
import { editImpact } from "../../core/workoutCheck";
import { freshTargets } from "../../core/volumeModel";
import { slotsMinutes } from "../../core/timeEstimate";
import { useWeekFailure } from "../components/FailFlame";
import { Icon } from "../components/Icon";
import { fmtDate } from "../format";
import { go } from "../router";
import { useStore } from "../store";
import { ExerciseSheet } from "./ExerciseScreen";
import { WeekInsight } from "../components/WeekInsight";

const SHORT = WEEKDAY_SHORT;


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
  // Opens on the first day of the training week (Settings → week start)
  const [sel, setSel] = useKeptState("plan-day", `w${settings.weekStartDay}`);
  // For Undo after a remove: the plans as they are when Undo is tapped
  const latest = useRef(routines); latest.current = routines;
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
  /** A swap, removal, addition or set change: saved, and a notice when it breaks the plan check (a muscle over or
   *  under its target, an angle left short) that was fine before */
  const saveEdit = (next: Routine) => {
    const lines = editImpact(routine, next, exMap, targets);
    saveRoutine(next);
    if (lines.length) toast({ kind: "warn", title: "That change breaks the plan check", body: lines.join(" · ") });
  };
  const setSlot = (p: Partial<Slot>) => day && slot && (p.sets != null ? saveEdit : saveRoutine)(updateSlot(routine, day.id, slot.id, p));
  // Undo puts back only this exercise, into the plan as it is then (other changes made meanwhile stay)
  const removeWithUndo = (s: Slot) => {
    if (!day) return;
    const at = day.slots.findIndex((x) => x.id === s.id), dayId = day.id, rid = routine.id;
    saveEdit(removeSlot(routine, day.id, s.id));
    toast({ kind: "info", title: "Exercise removed", body: exMap.get(s.exerciseId)?.name, action: { label: "Undo", run: () => {
      const r = latest.current.find((x) => x.id === rid);
      if (r) saveRoutine(insertSlot(r, dayId, s, at));
    } } });
  };
  const allSets = routine.days.reduce((a, d) => a + d.slots.reduce((b, s) => b + s.sets, 0), 0);
  const sets = day?.slots.reduce((a, s) => a + s.sets, 0) ?? 0;

  return (
    <div className="page">
      {/* Plans menu: drops down right under the header row (not a bottom sheet) */}
      <div className="spread plans-anchor">
        <span className="eyebrow">Current plan</span>
        <button className="btn btn-ghost" style={{ minHeight: 40, padding: "0 12px" }} aria-expanded={manage} onClick={() => setManage((v) => !v)}>Plans <span style={{ display: "inline-flex", transform: `rotate(${manage ? -90 : 90}deg)`, transition: "transform .2s" }}><Icon name="chevron" size={14} /></span></button>
        {manage && (
          <>
            <div className="plans-backdrop" onClick={() => setManage(false)} />
            <div className="plans-menu glass" role="dialog" aria-label="Plans">
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
              <button className="btn btn-ghost btn-block plans-new" onClick={() => { const r = newRoutine(routines.map((x) => x.name), new Date(), freshTargets(completeProfile(settings.profile))); saveRoutine(r); try { sessionStorage.setItem(newPlanKey(r.id), "1"); } catch { /* ignore */ } setManage(false); go(`plan-edit/${r.id}`); }}><Icon name="plus" size={18} /> New plan</button>
            </div>
          </>
        )}
      </div>
      <InlineText as="h1" className="title-lg" textClass="neon-grad" style={{ marginTop: 6 }} label="Plan name" value={routine.name}
        onSave={(name) => saveRoutine({ ...routine, name })} />
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>{days.length} days · {routine.days.flatMap((d) => d.slots).length} exercises · {allSets} sets a week</p>

      {/* Week strip: every day's workout at a glance, tap one to see and edit it below */}
      <div className="week-strip" style={{ gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))` }}>
        {chips.map((c) => {
          const on = !!c.day?.slots.length;
          const isToday = c.weekday === new Date().getDay();
          return (
            <button key={c.key} className={"ws-day" + (on ? "" : " rest") + (isToday ? " today" : "")} aria-pressed={c.key === cur.key} onClick={() => setSel(c.key)}
              aria-label={`${c.label}: ${on ? c.day!.title : "rest day"}${isToday ? " (today)" : ""}`}>
              <span className="ws-dow">{c.weekday != null ? c.label : "Day"}</span>
              <span className="ws-title">{on ? c.day!.title : "Rest"}</span>
            </button>
          );
        })}
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
            <span className="mono muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{sets} sets · ~{slotsMinutes(day.slots)} min</span>
          </div>
          <div className="glass" style={{ padding: 4 }}>
              <SortableDayList slots={day.slots} exMap={exMap} onOpen={(s) => setSlotId(s.id)} onDelete={removeWithUndo} onFigure={(s) => setHowTo(s.id)}
                onMove={(from, to) => saveRoutine(moveSlot(routine, day.id, from, to))} fail={weekFail.get(day.id)} />
            <button className="list-row add-row" onClick={() => setPicker({ mode: "add" })}><Icon name="plus" /> Add exercise</button>
          </div>
          <div className="row" style={{ margin: "6px 4px 0", justifyContent: "flex-end" }}>
            <button className="btn btn-quiet" style={{ color: "var(--bad)", fontSize: 13, minHeight: 44, padding: 0, whiteSpace: "nowrap" }} onClick={() => setDelDay(true)}><Icon name="trash" size={16} /> Delete day</button>
          </div>
        </>
      )}

      <h2 className="section-title">Plan overview</h2>
      <WeekInsight routine={routine} exMap={exMap} targets={targets} weekFail={weekFail} edit={{ targets, onEdit: (t) => saveTargets([t]), onEditAll: saveTargets }} />

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
      <SlotSheet slot={slot} day={day} ex={slot ? exMap.get(slot.exerciseId) : undefined} goal={settings.profile?.goal} failWhy={day && slot ? weekFail.get(day.id)?.get(slot.id) : undefined}
        restDefault={settings.restDefaultSec} onPatch={(p) => setSlot(p)} onClose={() => setSlotId(null)}
        onToggleSuperset={() => day && slot && saveRoutine(toggleSlotSuperset(routine, day.id, slot.id))}
        onSwap={() => slot && setPicker({ mode: "swap", slotId: slot.id })} onHowTo={() => slot && setHowTo(slot.id)} onRemove={() => slot && removeWithUndo(slot)} />
      <ExercisePicker open={!!picker} title={picker?.mode === "swap" ? "Swap exercise" : "Add exercise"}
        exclude={picker?.mode === "swap" ? day?.slots.find((x) => x.id === picker.slotId)?.exerciseId : undefined}
        swapFor={picker?.mode === "swap" ? exMap.get(day?.slots.find((x) => x.id === picker.slotId)?.exerciseId ?? "") : undefined}
        onClose={() => setPicker(null)}
        onPick={picker?.mode === "swap" ? (ex) => { if (day) saveEdit(swapSlotExercise(routine, day.id, picker.slotId, ex)); } : undefined}
        onPickMany={picker?.mode === "swap" ? undefined : (exs) => {
          // A rest day without a plan day yet gets one on that weekday
          const made = day ? { routine, dayId: day.id } : addDay(routine, cur.weekday);
          saveEdit(exs.reduce((r, ex) => addSlot(r, made.dayId, ex, settings.restDefaultSec).routine, made.routine));
        }} />
      {(() => {
        // howTo is a slot id: the sheet shows its exercise with the slot's own why/tips and this week's failure reasons
        const hs = day?.slots.find((x) => x.id === howTo);
        return <ExerciseSheet id={hs?.exerciseId ?? null} onClose={() => setHowTo(null)} failWhy={day && hs ? weekFail.get(day.id)?.get(hs.id) : undefined} whyOverride={hs?.whyOverride} tipsOverride={hs?.tipsOverride} />;
      })()}
      <Confirm open={delDay} title={`Delete ${day?.title ?? "this day"}?`} body="All its exercises are removed and it becomes a rest day. Past workouts stay in history." confirm="Delete" danger
        onClose={() => setDelDay(false)} onConfirm={() => { if (day) saveEdit(clearDay(routine, day.id)); }} />
      <Confirm open={confirmDeload} title="Start a deload week?" confirm="Start deload"
        body={<>{DELOAD_RULE} It lasts until {fmtDate(deloadWeek(today, settings.weekStartDay).end, { weekday: "long" })}, then your normal plan comes back.</>}
        onClose={() => setConfirmDeload(false)} onConfirm={() => saveSettings({ ...settings, deload: deloadWeek(today, settings.weekStartDay), deloadDismissedAt: null })} />
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
