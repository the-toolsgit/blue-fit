// Plan editor: edit a draft copy of a routine (days, exercises, sets/reps/rest, supersets),
// see the weekly volume update live, then Save or Cancel.
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, KeyboardSensor } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import {
  addDay, addSlot, moveSlot, removeDay, renameDay, setDayWeekday, swapSlotExercise, validateRoutine,
} from "../../core/routineEdit";
import { estimateMinutes } from "../../core/timeEstimate";
import { completeProfile, MUSCLE_GROUPS, type Exercise, type Routine, type RoutineDay, type Slot, type VolumeTarget } from "../../core/types";
import { modelTarget, priorityOf } from "../../core/volumeModel";
import defaultTargets from "../../core/seed/targets.json";
import { planVolume } from "../../core/volume";
import { FailFlame, useWeekFailure } from "../components/FailFlame";
import { Dock } from "../components/Dock";
import { ExercisePicker } from "../components/ExercisePicker";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { Confirm } from "../components/Sheet";
import { VolumeTable } from "../components/VolumeTable";
import { fmtRest, repRange } from "../format";
import { replace } from "../router";
import { useStore } from "../store";
import { ExerciseSheet } from "./ExerciseScreen";
import { SlotSheet } from "../components/SlotSheet";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mondayFirst = (w: number | null) => (w == null ? 9 : (w + 6) % 7);
const draftKey = (id: string) => "bf-plan-draft-" + id;

function SlotRow({ slot, ex, groupStart, groupEnd, onOpen, fail }: {
  slot: Slot; ex: Exercise | undefined; groupStart: boolean; groupEnd: boolean; onOpen: () => void; fail?: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 5 : undefined, paddingLeft: slot.supersetGroup ? 14 : 0 }}>
      {slot.supersetGroup && <div aria-hidden style={{ position: "absolute", left: 0, top: groupStart ? 16 : -6, bottom: groupEnd ? 16 : -6, width: 3, borderRadius: 3, background: "var(--neon-2)", boxShadow: "0 0 10px var(--neon-2)" }} />}
      {slot.supersetGroup && groupStart && <div className="eyebrow" style={{ color: "var(--neon-2)", fontSize: 10, margin: "2px 0 4px" }}>Superset {slot.supersetGroup}</div>}
      <div className="glass row" style={{ padding: "6px 6px 6px 2px", borderRadius: 16, boxShadow: isDragging ? "0 0 0 1px var(--neon), 0 16px 40px -10px var(--glow)" : undefined }}>
        <button className="icon-btn" style={{ touchAction: "none", cursor: "grab", width: 36 }} aria-label={`Drag to reorder ${ex?.name}`} {...attributes} {...listeners}>
          <svg width="16" height="22" viewBox="0 0 16 22" aria-hidden><g fill="currentColor">{[5, 11, 17].flatMap((y) => [<circle key={"a" + y} cx="5" cy={y} r="1.8" />, <circle key={"b" + y} cx="11" cy={y} r="1.8" />])}</g></svg>
        </button>
        <button className="row grow" style={{ textAlign: "left", minHeight: 52 }} onClick={onOpen}>
          <Figure spec={ex?.figure} size={40} still className="thin" />
          <span className="grow" style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex?.name ?? slot.exerciseId} {ex?.isHeavy && <span className="star">★</span>}<FailFlame why={fail} /></span>
            <span className="mono muted" style={{ fontSize: 12 }}>{slot.sets} × {repRange(slot.repMin, slot.repMax)} · {fmtRest(slot.restSec)}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

export function PlanEditorScreen({ id }: { id?: string }) {
  const { routines, exMap, targets, settings, saveRoutine, saveTargets, toast } = useStore();
  const original = routines.find((r) => r.id === id);
  const [draft, setDraft] = useState<Routine | null>(() => {
    try { const s = sessionStorage.getItem(draftKey(id ?? "")); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return original ? structuredClone(original) : null;
  });
  const [dayId, setDayId] = useState<string | null>(null);
  const [slotOpen, setSlotOpen] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; slotId: string } | null>(null);
  const [howTo, setHowTo] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "cancel" | "deleteDay" | "resetTargets">(null);
  // Weekly targets are edited here too (they apply to every plan) and saved with Save plan.
  const [tdraft, setTdraft] = useState<VolumeTarget[]>(() => {
    try { const s = sessionStorage.getItem(draftKey(id ?? "") + "-targets"); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return structuredClone(targets);
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { if (!draft && original) setDraft(structuredClone(original)); }, [original, draft]);
  useEffect(() => { if (draft && id) try { sessionStorage.setItem(draftKey(id), JSON.stringify(draft)); } catch { /* ignore */ } }, [draft, id]);
  useEffect(() => { if (id) try { sessionStorage.setItem(draftKey(id) + "-targets", JSON.stringify(tdraft)); } catch { /* ignore */ } }, [tdraft, id]);
  const vol = useMemo(() => (draft ? planVolume(draft, exMap) : []), [draft, exMap]);
  const weekFail = useWeekFailure(draft ?? undefined, tdraft);
  if (!draft || !original) return <div className="page"><div className="empty">Plan not found.</div></div>;

  const days = [...draft.days].sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday));
  const day: RoutineDay | undefined = days.find((d) => d.id === dayId) ?? days.find((d) => d.slots.length) ?? days[0];
  const targetsDirty = JSON.stringify(tdraft) !== JSON.stringify(targets);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original) || targetsDirty;
  // Interview: the model's suggestion for each muscle, from the training profile and the muscle's priority
  const profile = completeProfile(settings.profile);
  const suggest = (g: VolumeTarget["group"], t?: VolumeTarget) => (profile ? modelTarget(g, profile, priorityOf(g, t)) : null);
  const defaults = profile ? new Map(MUSCLE_GROUPS.map((m) => [m.id, suggest(m.id, tdraft.find((x) => x.group === m.id))!])) : undefined;
  /** Reset: model numbers when the profile is filled in, else the plan's original numbers. Notes are kept; no muscle is skipped; priorities go back to the default. */
  const resetTargets = () => setTdraft((defaultTargets as VolumeTarget[]).map((t) => {
    const s = suggest(t.group);
    return s ? { group: t.group, min: s.min, max: s.max, ...(t.angles ? { angles: t.angles } : {}), ...(t.gap ? { gap: t.gap } : {}) } : { ...t };
  }));
  const editTarget = (t: VolumeTarget) => setTdraft((ts) => (ts.some((x) => x.group === t.group) ? ts.map((x) => (x.group === t.group ? t : x)) : [...ts, t]));
  const issues = validateRoutine(draft);
  const totals = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, vol.find((v) => v.group === m.id)?.sets ?? 0])) as never;
  const dayCount = Object.fromEntries(vol.map((v) => [v.group, v.directDays]));
  const slot = day?.slots.find((s) => s.id === slotOpen);

  const leave = () => { try { sessionStorage.removeItem(draftKey(id!)); sessionStorage.removeItem(draftKey(id!) + "-targets"); } catch { /* ignore */ } replace("plan"); };
  const save = () => {
    if (issues.length) return toast({ kind: "error", title: "Can't save yet", body: issues[0].message });
    saveRoutine({ ...draft, name: draft.name.trim(), days: draft.days.map((d) => ({ ...d, title: d.title.trim() })) });
    if (targetsDirty) saveTargets(tdraft);
    toast({ kind: "info", title: "Plan saved" });
    leave();
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!day || !e.over || e.active.id === e.over.id) return;
    const from = day.slots.findIndex((s) => s.id === e.active.id), to = day.slots.findIndex((s) => s.id === e.over!.id);
    setDraft(moveSlot(draft, day.id, from, to));
  };

  return (
    <div className="page">
      <div className="spread" style={{ marginBottom: 8 }}>
        <button className="btn btn-quiet" style={{ paddingLeft: 0 }} onClick={() => (dirty ? setConfirm("cancel") : leave())}>Cancel</button>
        <span className="eyebrow">Edit plan</span>
        <button className="btn btn-primary" style={{ minHeight: 40 }} onClick={dirty ? save : leave}>{dirty ? "Save" : "Done"}</button>
      </div>
      <input className="input" aria-label="Plan name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        style={{ font: "700 28px var(--display)", textTransform: "uppercase", letterSpacing: ".02em", background: "transparent", border: "1px dashed var(--line-strong)" }} />

      <div className="chips-scroll" style={{ marginTop: 12 }}>
        {days.map((d) => (
          <button key={d.id} className="chip" aria-pressed={d.id === day?.id} onClick={() => setDayId(d.id)} title={d.title}>
            {d.weekday != null ? SHORT[d.weekday] : "—"} · {d.title.length > 14 ? d.title.slice(0, 13) + "…" : d.title}
          </button>
        ))}
        <button className="chip" onClick={() => { const r = addDay(draft); setDraft(r.routine); setDayId(r.dayId); }}><Icon name="plus" size={16} /> Day</button>
      </div>

      {day && (
        <section className="glass" style={{ padding: 14, marginTop: 10, display: "grid", gap: 12 }}>
          <div className="field"><label htmlFor="dtitle">Day name</label>
            <input id="dtitle" className="input" value={day.title} onChange={(e) => setDraft(renameDay(draft, day.id, e.target.value))} /></div>
          <div className="field"><span className="label">Weekday · picking a used one swaps the two days</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 4 }}>
              {[1, 2, 3, 4, 5, 6, 0].map((w) => {
                const owner = draft.days.find((d) => d.id !== day.id && d.weekday === w);
                return (
                  <button key={w} className="chip" aria-pressed={day.weekday === w} title={owner ? `Swap with ${owner.title}` : undefined}
                    style={{ padding: 0, justifyContent: "center", minHeight: 40, opacity: owner && day.weekday !== w ? 0.7 : 1 }}
                    onClick={() => setDraft(setDayWeekday(draft, day.id, w))}>{SHORT[w]}</button>
                );
              })}
              <button className="chip" aria-pressed={day.weekday == null} style={{ padding: 0, justifyContent: "center", minHeight: 40 }} onClick={() => setDraft(setDayWeekday(draft, day.id, null))}>None</button>
            </div>
          </div>
          <div className="spread">
            <span className="mono muted" style={{ fontSize: 13 }}>{day.slots.length} exercises · {day.slots.reduce((a, s) => a + s.sets, 0)} sets · ~{estimateMinutes(day.slots.reduce((a, s) => a + s.sets, 0), day.slots.length)} min</span>
            <button className="btn btn-quiet" style={{ color: "var(--bad)", fontSize: 13, minHeight: 36, padding: 0, whiteSpace: "nowrap" }} onClick={() => setConfirm("deleteDay")}><Icon name="trash" size={16} /> Delete day</button>
          </div>
        </section>
      )}

      {day && (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={day.slots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {day.slots.map((s, i) => (
                <SlotRow key={s.id} slot={s} ex={exMap.get(s.exerciseId)}
                  groupStart={s.supersetGroup !== day.slots[i - 1]?.supersetGroup} groupEnd={s.supersetGroup !== day.slots[i + 1]?.supersetGroup}
                  onOpen={() => setSlotOpen(s.id)} fail={weekFail.get(day.id)?.get(s.id)} />
              ))}
            </SortableContext>
          </DndContext>
          {!day.slots.length && <p className="muted" style={{ textAlign: "center", fontSize: 14, padding: 12 }}>No exercises. A day without exercises is a rest day.</p>}
          <button className="btn btn-ghost btn-block" style={{ minHeight: 52 }} onClick={() => setPicker({ mode: "add" })}><Icon name="plus" /> Add exercise</button>
        </div>
      )}

      <h2 className="section-title">Weekly volume</h2>
      <p className="muted" style={{ fontSize: 12, margin: "-2px 4px 8px" }}>Tap a muscle to change its weekly target, make it a priority or skip it.</p>
      <VolumeTable totals={totals} targets={tdraft} days={dayCount} onEdit={editTarget} defaults={defaults} />
      {!profile && <p className="muted" style={{ fontSize: 12, margin: "8px 4px 0" }}>Fill in Settings → Training profile to get targets worked out for you.</p>}
      <button className="btn btn-quiet btn-block" style={{ marginTop: 8 }} onClick={() => setConfirm("resetTargets")}><Icon name="undo" size={18} /> Reset targets to defaults</button>

      <Dock>
        <button className="btn btn-primary btn-xl" onClick={dirty ? save : leave}><Icon name="check" size={20} /> {dirty ? "Save plan" : "Done"}</button>
      </Dock>

      <SlotSheet routine={draft} day={day} slotId={slotOpen} exMap={exMap} settings={settings} why={day && slotOpen ? weekFail.get(day.id)?.get(slotOpen) : undefined}
        onChange={setDraft} onClose={() => setSlotOpen(null)} onSwap={(slotId) => setPicker({ mode: "swap", slotId })} onHowTo={setHowTo} />

      <ExercisePicker open={!!picker} title={picker?.mode === "swap" ? "Swap exercise" : "Add exercise"}
        exclude={picker?.mode === "swap" ? day?.slots.find((s) => s.id === picker.slotId)?.exerciseId : undefined}
        onClose={() => setPicker(null)}
        onPick={(ex) => {
          if (!day) return;
          if (picker?.mode === "swap") setDraft(swapSlotExercise(draft, day.id, picker.slotId, ex));
          else setDraft(addSlot(draft, day.id, ex, settings.restDefaultSec).routine);
        }} />
      <ExerciseSheet id={howTo} onClose={() => setHowTo(null)} failWhy={day && slot ? weekFail.get(day.id)?.get(slot.id) : undefined} />
      <Confirm open={confirm === "cancel"} title="Discard changes?" body="Your edits to this plan are thrown away." confirm="Discard" danger onClose={() => setConfirm(null)} onConfirm={leave} />
      <Confirm open={confirm === "deleteDay"} title={`Delete ${day?.title ?? "this day"}?`} body="Past workouts of this day stay in history." confirm="Delete" danger
        onClose={() => setConfirm(null)} onConfirm={() => { if (day) { setDraft(removeDay(draft, day.id)); setDayId(null); } }} />
      <Confirm open={confirm === "resetTargets"} title="Reset targets?" body={profile ? "Every muscle gets the target worked out from your training profile, with default priorities and none skipped. Nothing is saved until you tap Save plan." : "Every muscle goes back to the plan's original target. Fill in your training profile in Settings to get targets worked out for you. Nothing is saved until you tap Save plan."} confirm="Reset"
        onClose={() => setConfirm(null)} onConfirm={resetTargets} />
    </div>
  );
}
