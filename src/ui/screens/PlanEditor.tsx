// Plan editor: edit a draft copy of a routine (days, exercises, sets/reps/rest, supersets),
// see the weekly volume update live, then Save or Cancel.
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, KeyboardSensor } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import {
  addSlot, clearDay, moveSlot, removeSlot, renameDay, swapSlotExercise, toggleSlotSuperset, updateSlot, validateRoutine,
} from "../../core/routineEdit";
import { estimateMinutes } from "../../core/timeEstimate";
import { type Exercise, type Goal, type Phase, type Routine, type RoutineDay, type Slot, type VolumeTarget } from "../../core/types";
import { targetsOf } from "../../core/volumeModel";
import { failureApplies, failureEligible } from "../../core/failure";
import { FailFlame, useWeekFailure } from "../components/FailFlame";
import { Seg, Stepper } from "../components/Controls";
import { Dock } from "../components/Dock";
import { ExercisePicker } from "../components/ExercisePicker";
import { Figure } from "../components/Figure";
import { FigureTap, useSwipeDelete } from "../components/swipeDelete";
import { tempoTiming } from "../../core/figure/tempo";
import { Icon } from "../components/Icon";
import { Confirm, Sheet } from "../components/Sheet";
import { fmtRest, repRange } from "../format";
import { replace } from "../router";
import { useStore } from "../store";
import { WeekInsight } from "../components/WeekInsight";
import { ExerciseSheet } from "./ExerciseScreen";
import { PlanWizard, type WizardResult } from "./PlanWizard";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mondayFirst = (w: number | null) => (w == null ? 9 : (w + 6) % 7);
const draftKey = (id: string) => "bf-plan-draft-" + id;

function SlotRow({ slot, ex, index, groupStart, groupEnd, onOpen, onDelete, onFigure, fail }: {
  slot: Slot; ex: Exercise | undefined; index: number; groupStart: boolean; groupEnd: boolean; onOpen: () => void; onDelete: () => void; onFigure: () => void; fail?: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  const sw = useSwipeDelete(onDelete);
  return (
    <div ref={(n) => { setNodeRef(n); sw.wrap.current = n; }} className={"day-row" + (sw.dx ? " swiping" : "")} onClickCapture={sw.onClickCapture} style={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 5 : undefined, paddingLeft: slot.supersetGroup ? 10 : 0,
      background: isDragging ? "var(--surface-solid)" : undefined, borderRadius: 14, boxShadow: isDragging ? "0 0 0 1px var(--neon), 0 16px 40px -10px var(--glow)" : undefined }}>
      {slot.supersetGroup && <div aria-hidden style={{ position: "absolute", left: 2, top: groupStart ? 16 : 0, bottom: groupEnd ? 16 : 0, width: 3, borderRadius: 3, background: "var(--neon-2)", boxShadow: "0 0 10px var(--neon-2)" }} />}
      {sw.button}
      <div className="row" style={{ gap: 0, ...sw.slide }}>
        <button className="icon-btn" style={{ touchAction: "none", cursor: "grab", width: 32, flex: "none" }} aria-label={`Drag to reorder ${ex?.name}`} {...attributes} {...listeners}>
          <svg width="16" height="22" viewBox="0 0 16 22" aria-hidden><g fill="currentColor">{[5, 11, 17].flatMap((y) => [<circle key={"a" + y} cx="5" cy={y} r="1.8" />, <circle key={"b" + y} cx="11" cy={y} r="1.8" />])}</g></svg>
        </button>
        <button className="list-row grow" style={{ paddingLeft: 0 }} onClick={() => (sw.dx ? sw.setDx(0) : onOpen())}>
          <span className="mono muted" style={{ width: 16, fontSize: 13 }}>{index + 1}</span>
          <FigureTap name={ex?.name ?? "this exercise"} onTap={() => (sw.dx ? sw.setDx(0) : onFigure())}><Figure spec={ex?.figure} size={44} still className="thin" /></FigureTap>
          <span className="grow" style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600 }}>{ex?.name ?? slot.exerciseId} {ex?.isHeavy && <span className="star">★</span>}<FailFlame why={fail} /></span>
            <span className="muted" style={{ fontSize: 12 }}>{slot.supersetGroup && groupStart ? `Superset ${slot.supersetGroup} · ` : ""}{slot.notes ? `${slot.notes} · ` : ""}rest {fmtRest(slot.restSec)}</span>
          </span>
          <span className="mono" style={{ whiteSpace: "nowrap" }}>{slot.sets} × {repRange(slot.repMin, slot.repMax, ex?.measure === "time")}</span>
          <Icon name="chevron" size={16} />
        </button>
      </div>
    </div>
  );
}

/** `onExit`: used when the Plan tab edits in place (no route change); `initialDayId`: keep the day the user was looking at. */
export function PlanEditorScreen({ id, onExit, initialDayId }: { id?: string; onExit?: () => void; initialDayId?: string }) {
  const { routines, exMap, targets: currentTargets, settings, saveRoutine, saveSettings, toast, ensureSaved } = useStore();
  /** Build my plan's goal and eating answers: saved to the training profile with the plan, not before */
  const [answers, setAnswers] = useState<{ goal: Goal; phase: Phase } | null>(() => {
    try { const s = sessionStorage.getItem(draftKey(id ?? "") + "-answers"); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return null;
  });
  const original = routines.find((r) => r.id === id);
  // This plan's own weekly targets (older plans without their own fall back to the app-wide list)
  const targets = targetsOf(original, currentTargets);
  const [draft, setDraft] = useState<Routine | null>(() => {
    try { const s = sessionStorage.getItem(draftKey(id ?? "")); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return original ? structuredClone(original) : null;
  });
  const [dayId, setDayId] = useState<string | null>(initialDayId ?? null);
  const [slotOpen, setSlotOpen] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; slotId: string } | null>(null);
  const [howTo, setHowTo] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [confirm, setConfirm] = useState<null | "cancel" | "deleteDay">(null);
  // This plan's weekly targets are edited here too and saved with Save plan.
  const [tdraft, setTdraft] = useState<VolumeTarget[]>(() => {
    try { const s = sessionStorage.getItem(draftKey(id ?? "") + "-targets"); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return structuredClone(targets);
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { if (!draft && original) setDraft(structuredClone(original)); }, [original, draft]);
  useEffect(() => { if (draft && id) try { sessionStorage.setItem(draftKey(id), JSON.stringify(draft)); } catch { /* ignore */ } }, [draft, id]);
  useEffect(() => { if (id) try { sessionStorage.setItem(draftKey(id) + "-targets", JSON.stringify(tdraft)); } catch { /* ignore */ } }, [tdraft, id]);
  useEffect(() => { if (id && answers) try { sessionStorage.setItem(draftKey(id) + "-answers", JSON.stringify(answers)); } catch { /* ignore */ } }, [answers, id]);
  const weekFail = useWeekFailure(draft ?? undefined, tdraft);
  if (!draft || !original) return <div className="page"><div className="empty">Plan not found.</div></div>;

  const days = [...draft.days].sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday));
  const day: RoutineDay | undefined = days.find((d) => d.id === dayId) ?? days.find((d) => d.slots.length) ?? days[0];
  const targetsDirty = JSON.stringify(tdraft) !== JSON.stringify(targets);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original) || targetsDirty;
  const editTarget = (t: VolumeTarget) => setTdraft((ts) => (ts.some((x) => x.group === t.group) ? ts.map((x) => (x.group === t.group ? t : x)) : [...ts, t]));
  const issues = validateRoutine(draft);
  const slot = day?.slots.find((s) => s.id === slotOpen);
  const slotIdx = day?.slots.findIndex((s) => s.id === slotOpen) ?? -1;

  const leave = () => { try { sessionStorage.removeItem(draftKey(id!)); sessionStorage.removeItem(draftKey(id!) + "-targets"); sessionStorage.removeItem(draftKey(id!) + "-answers"); } catch { /* ignore */ } if (onExit) onExit(); else replace("plan"); };
  const save = () => {
    if (issues.length) return toast({ kind: "error", title: "Can't save yet", body: issues[0].message });
    // Database exercises the plan uses get a full copy on the phone, so backups stay complete (§5.26)
    for (const ex of new Set(draft.days.flatMap((d) => d.slots.map((s) => s.exerciseId)))) { const e = exMap.get(ex); if (e) ensureSaved(e); }
    saveRoutine({ ...draft, name: draft.name.trim(), days: draft.days.map((d) => ({ ...d, title: d.title.trim() })), targets: tdraft });
    if (answers) {
      // The goal and eating answers update the training profile (the other numbers stay as they were)
      const p = settings.profile;
      saveSettings({ ...settings, profile: { goal: answers.goal, phase: answers.phase, age: p?.age ?? null, yearsTraining: p?.yearsTraining ?? null, sleepHours: p?.sleepHours ?? null } });
    }
    toast({ kind: "info", title: "Plan saved" });
    leave();
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!day || !e.over || e.active.id === e.over.id) return;
    const from = day.slots.findIndex((s) => s.id === e.active.id), to = day.slots.findIndex((s) => s.id === e.over!.id);
    setDraft(moveSlot(draft, day.id, from, to));
  };
  /** Swipe left on a row: remove it from the draft, with Undo (5 s) */
  const removeWithUndo = (s: Slot) => {
    if (!day) return;
    const before = draft;
    setDraft(removeSlot(draft, day.id, s.id));
    toast({ kind: "info", title: "Exercise removed", body: exMap.get(s.exerciseId)?.name, action: { label: "Undo", run: () => setDraft(before) } });
  };

  const allSets = draft.days.reduce((a, d) => a + d.slots.reduce((b, s) => b + s.sets, 0), 0);
  const daySets = day ? day.slots.reduce((a, s) => a + s.sets, 0) : 0;
  // Same layout as the Plan tab's view, with the parts that can change turned into fields (edit in place).
  const field = { background: "transparent", border: 0, borderBottom: "1px dashed var(--line-strong)", borderRadius: 0, padding: "2px 0", width: "100%", color: "inherit" } as const;
  return (
    <div className="page" style={{ animation: onExit ? "none" : undefined }}>
      <div className="spread">
        <span className="eyebrow" style={{ color: "var(--neon-2)" }}>Editing plan</span>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost" style={{ minHeight: 40, padding: "0 12px" }} onClick={() => (dirty ? setConfirm("cancel") : leave())}>Cancel</button>
          <button className="btn btn-primary" style={{ minHeight: 40, padding: "0 14px" }} onClick={dirty ? save : leave}><Icon name="check" size={18} /> {dirty ? "Save" : "Done"}</button>
        </div>
      </div>
      <input className="title-lg" aria-label="Plan name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        style={{ ...field, marginTop: 6, font: "700 32px/1 var(--display)", textTransform: "uppercase", letterSpacing: ".02em", color: "var(--neon-ink)" }} />
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>{draft.days.filter((d) => d.slots.length).length} days · {draft.days.flatMap((d) => d.slots).length} exercises · {allSets} sets a week</p>

      {/* No exercises yet: the app can build the whole week (or add them yourself below) */}
      {!draft.days.some((d) => d.slots.length) && (
        <div className="gen-card">
          <b>Build it for me</b>
          <p>Answer a few quick questions and the app builds the week from your goal, days and targets: top exercises, every angle, nothing repeated. Or add exercises yourself below.</p>
          <button className="btn btn-primary btn-xl" onClick={() => setWizard(true)}><Icon name="bolt" size={20} /> Build my plan</button>
        </div>
      )}
      <div className="chips-scroll" style={{ marginTop: 12 }}>
        {days.map((d) => (
          <button key={d.id} className="chip" aria-pressed={d.id === day?.id} onClick={() => setDayId(d.id)} title={d.title}>
            {d.weekday != null ? SHORT[d.weekday] : d.title.length > 10 ? d.title.slice(0, 9) + "…" : d.title || "New"}
          </button>
        ))}
      </div>

      {day && (
        <>
          <div className="spread" style={{ margin: "14px 4px 8px", alignItems: "flex-end" }}>
            <input className="title-md" aria-label="Day name" value={day.title} onChange={(e) => setDraft(renameDay(draft, day.id, e.target.value))}
              style={{ ...field, font: "700 22px/1.05 var(--display)", textTransform: "uppercase", letterSpacing: ".02em", flex: 1, minWidth: 0 }} />
            <span className="mono muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{daySets} sets · ~{estimateMinutes(daySets, day.slots.length)} min</span>
          </div>
          <div className="glass" style={{ padding: 4, marginTop: 8 }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={day.slots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {day.slots.map((s, i) => (
                  <SlotRow key={s.id} slot={s} ex={exMap.get(s.exerciseId)} index={i}
                    groupStart={s.supersetGroup !== day.slots[i - 1]?.supersetGroup} groupEnd={s.supersetGroup !== day.slots[i + 1]?.supersetGroup}
                    onOpen={() => setSlotOpen(s.id)} onDelete={() => removeWithUndo(s)} onFigure={() => setHowTo(s.exerciseId)} fail={weekFail.get(day.id)?.get(s.id)} />
                ))}
              </SortableContext>
            </DndContext>
            {!day.slots.length && <p className="muted" style={{ textAlign: "center", fontSize: 14, padding: 12 }}>No exercises. A day without exercises is a rest day.</p>}
            <button className="list-row" style={{ color: "var(--neon-ink)", justifyContent: "center" }} onClick={() => setPicker({ mode: "add" })}><Icon name="plus" /> Add exercise</button>
          </div>
          <div className="spread" style={{ margin: "6px 4px 0" }}>
            <p className="muted" style={{ fontSize: 12 }}>Tap an exercise to change it. Drag ⋮⋮ to move it. Swipe left to delete.</p>
            <button className="btn btn-quiet" style={{ color: "var(--bad)", fontSize: 13, minHeight: 36, padding: 0, whiteSpace: "nowrap" }} onClick={() => setConfirm("deleteDay")} disabled={!day.slots.length}><Icon name="trash" size={16} /> Delete day</button>
          </div>
          
        </>
      )}

<h2 className="section-title">Plan overview</h2>
      <WeekInsight routine={draft} exMap={exMap} targets={tdraft} weekFail={weekFail} edit={{ targets: tdraft, onEdit: editTarget, onEditAll: (ts) => ts.forEach(editTarget) }} />


      <Dock>
        <button className="btn btn-primary btn-xl" onClick={dirty ? save : leave}><Icon name="check" size={20} /> {dirty ? "Save plan" : "Done"}</button>
      </Dock>

      <Sheet open={!!slot} onClose={() => setSlotOpen(null)} label="Exercise in plan">
        {slot && day && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row">
              <Figure spec={exMap.get(slot.exerciseId)?.figure} size={54} timing={tempoTiming(exMap.get(slot.exerciseId)?.tempo, slot.exerciseId)} />
              <h3 className="title-md grow">{exMap.get(slot.exerciseId)?.name}</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Stepper label="Sets" value={slot.sets} step={1} decimals={false} min={1} onChange={(v) => setDraft(updateSlot(draft, day.id, slot.id, { sets: Math.max(1, Math.min(20, v ?? 1)) }))} />
              <Stepper label="Rest" suffix={fmtRest(slot.restSec)} value={slot.restSec} step={15} decimals={false} onChange={(v) => setDraft(updateSlot(draft, day.id, slot.id, { restSec: v ?? settings.restDefaultSec }))} />
              <Stepper label={exMap.get(slot.exerciseId)?.measure === "time" ? "Seconds min" : "Reps min"} value={slot.repMin} step={exMap.get(slot.exerciseId)?.measure === "time" ? 5 : 1} decimals={false} min={1} onChange={(v) => setDraft(updateSlot(draft, day.id, slot.id, { repMin: Math.max(1, v ?? 1), repMax: Math.max(slot.repMax, v ?? 1) }))} />
              <Stepper label={exMap.get(slot.exerciseId)?.measure === "time" ? "Seconds max" : "Reps max"} value={slot.repMax} step={exMap.get(slot.exerciseId)?.measure === "time" ? 5 : 1} decimals={false} min={1} onChange={(v) => setDraft(updateSlot(draft, day.id, slot.id, { repMax: Math.max(slot.repMin, v ?? slot.repMin) }))} />
            </div>
            {failureApplies(settings.profile?.goal) && (() => {
              const mode = slot.toFailure === true ? "on" : slot.toFailure === false ? "off" : "auto";
              const why = weekFail.get(day.id)?.get(slot.id);
              const safe = failureEligible(exMap.get(slot.exerciseId));
              return (
                <div>
                  <span className="row" style={{ gap: 6, fontWeight: 600, marginBottom: 6 }}><span style={{ color: "var(--warn)", display: "inline-flex" }}><Icon name="flame" size={16} /></span>Last set to failure</span>
                  <Seg label="Last set to failure" value={mode} onChange={(v) => setDraft(updateSlot(draft, day.id, slot.id, { toFailure: v === "auto" ? undefined : v === "on" }))}
                    options={[{ v: "auto", label: "Auto" }, { v: "on", label: "On" }, { v: "off", label: "Off" }]} />
                  <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>
                    {mode === "auto" ? (why ? `This week: yes. ${why.join(" · ")}.` : safe ? "The app picks it when it fits the workout and your week." : "Auto never picks this one (★ lift or not safe to fail).")
                      : mode === "on" ? "Always, every week." : "Never."}
                  </p>
                </div>
              );
            })()}
            <div className="field"><label htmlFor="snote">Note</label>
              <input id="snote" className="input" value={slot.notes ?? ""} placeholder="e.g. elbows to hips" onChange={(e) => setDraft(updateSlot(draft, day.id, slot.id, { notes: e.target.value || undefined }))} /></div>
            <div>
              {slotIdx < day.slots.length - 1 && (
                <button className="menu-item" onClick={() => setDraft(toggleSlotSuperset(draft, day.id, slot.id))}>
                  <Icon name="link" /> {slot.supersetGroup && slot.supersetGroup === day.slots[slotIdx + 1]?.supersetGroup ? "Unlink from next (end superset)" : "Superset with next exercise"}
                </button>
              )}
              <button className="menu-item" onClick={() => { setPicker({ mode: "swap", slotId: slot.id }); }}><Icon name="swap" /> Swap exercise</button>
              <button className="menu-item" onClick={() => setHowTo(slot.exerciseId)}><Icon name="info" /> How to do it</button>
              <button className="menu-item danger" onClick={() => { setDraft(removeSlot(draft, day.id, slot.id)); setSlotOpen(null); }}><Icon name="trash" /> Remove from day</button>
            </div>
            <button className="btn btn-primary btn-block" onClick={() => setSlotOpen(null)}>Done</button>
          </div>
        )}
      </Sheet>

      <ExercisePicker open={!!picker} title={picker?.mode === "swap" ? "Swap exercise" : "Add exercise"}
        exclude={picker?.mode === "swap" ? day?.slots.find((s) => s.id === picker.slotId)?.exerciseId : undefined}
        onClose={() => setPicker(null)}
        onPick={picker?.mode === "swap" ? (ex) => { if (day) setDraft(swapSlotExercise(draft, day.id, picker.slotId, ex)); } : undefined}
        onPickMany={picker?.mode === "swap" ? undefined : (exs) => { if (day) setDraft(exs.reduce((r, ex) => addSlot(r, day.id, ex, settings.restDefaultSec).routine, draft)); }} />
      <PlanWizard open={wizard} initialTargets={tdraft} onClose={() => setWizard(false)} onDone={(r: WizardResult) => {
        setDraft({ ...draft, days: r.days });
        setTdraft(r.targets);
        setDayId(r.days.find((d) => d.slots.length)?.id ?? null);
        setAnswers({ goal: r.goal, phase: r.phase });
        setWizard(false);
        toast({ kind: "info", title: "Plan built", body: "Check it, change anything, then Save plan." });
      }} />
      <ExerciseSheet id={howTo} onClose={() => setHowTo(null)} failWhy={day && slot ? weekFail.get(day.id)?.get(slot.id) : undefined} />
      <Confirm open={confirm === "cancel"} title="Discard changes?" body="Your edits to this plan are thrown away." confirm="Discard" danger onClose={() => setConfirm(null)} onConfirm={leave} />
      <Confirm open={confirm === "deleteDay"} title={`Delete ${day?.title ?? "this day"}?`} body="All its exercises are removed and it becomes a rest day. Past workouts stay in history." confirm="Delete" danger
        onClose={() => setConfirm(null)} onConfirm={() => { if (day) setDraft(clearDay(draft, day.id)); }} />
    </div>
  );
}
