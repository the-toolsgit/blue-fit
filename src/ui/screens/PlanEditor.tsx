// Plan editor: edit a draft copy of a routine (days, exercises, sets/reps/rest, supersets),
// see the weekly volume update live, then Save or Cancel.
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, KeyboardSensor } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import {
  addDay, addSlot, moveSlot, removeDay, removeSlot, renameDay, setDayWeekday, swapSlotExercise, toggleSlotSuperset, updateSlot, validateRoutine,
} from "../../core/routineEdit";
import { estimateMinutes } from "../../core/timeEstimate";
import { MUSCLE_GROUPS, type Exercise, type Routine, type RoutineDay, type Slot } from "../../core/types";
import { planVolume, targetStatus } from "../../core/volume";
import { Stepper } from "../components/Controls";
import { Dock } from "../components/Dock";
import { ExercisePicker } from "../components/ExercisePicker";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { Confirm, Sheet } from "../components/Sheet";
import { VolumeTable } from "../components/VolumeTable";
import { fmtRest, repRange } from "../format";
import { replace } from "../router";
import { reducedMotion } from "../device";
import { useStore } from "../store";
import { ExerciseSheet } from "./ExerciseScreen";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mondayFirst = (w: number | null) => (w == null ? 9 : (w + 6) % 7);
const draftKey = (id: string) => "bf-plan-draft-" + id;

function SlotRow({ slot, ex, index, count, groupStart, groupEnd, onOpen, onMove }: {
  slot: Slot; ex: Exercise | undefined; index: number; count: number; groupStart: boolean; groupEnd: boolean; onOpen: () => void; onMove: (to: number) => void;
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
            <span style={{ display: "block", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex?.name ?? slot.exerciseId} {ex?.isHeavy && <span className="star">★</span>}</span>
            <span className="mono muted" style={{ fontSize: 12 }}>{slot.sets} × {repRange(slot.repMin, slot.repMax)} · {fmtRest(slot.restSec)}</span>
          </span>
        </button>
        <div style={{ display: "grid" }}>
          <button className="icon-btn" style={{ height: 30 }} disabled={index === 0} aria-label="Move up" onClick={() => onMove(index - 1)}><Icon name="up" size={16} /></button>
          <button className="icon-btn" style={{ height: 30 }} disabled={index === count - 1} aria-label="Move down" onClick={() => onMove(index + 1)}><Icon name="down" size={16} /></button>
        </div>
      </div>
    </div>
  );
}

export function PlanEditorScreen({ id }: { id?: string }) {
  const { routines, exMap, targets, settings, saveRoutine, toast } = useStore();
  const original = routines.find((r) => r.id === id);
  const [draft, setDraft] = useState<Routine | null>(() => {
    try { const s = sessionStorage.getItem(draftKey(id ?? "")); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return original ? structuredClone(original) : null;
  });
  const [dayId, setDayId] = useState<string | null>(null);
  const [slotOpen, setSlotOpen] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; slotId: string } | null>(null);
  const [howTo, setHowTo] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "cancel" | "deleteDay">(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { if (!draft && original) setDraft(structuredClone(original)); }, [original, draft]);
  useEffect(() => { if (draft && id) try { sessionStorage.setItem(draftKey(id), JSON.stringify(draft)); } catch { /* ignore */ } }, [draft, id]);
  const vol = useMemo(() => (draft ? planVolume(draft, exMap) : []), [draft, exMap]);
  if (!draft || !original) return <div className="page"><div className="empty">Plan not found.</div></div>;

  const days = [...draft.days].sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday));
  const day: RoutineDay | undefined = days.find((d) => d.id === dayId) ?? days.find((d) => d.slots.length) ?? days[0];
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const issues = validateRoutine(draft);
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const totals = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, vol.find((v) => v.group === m.id)?.sets ?? 0])) as never;
  const dayCount = Object.fromEntries(vol.map((v) => [v.group, v.directDays]));
  const statuses = vol.map((v) => targetStatus(v.sets, tmap.get(v.group)));
  const ok = statuses.filter((s) => s === "ok").length, warn = statuses.filter((s) => s === "below" || s === "above").length;
  const slot = day?.slots.find((s) => s.id === slotOpen);
  const slotIdx = day?.slots.findIndex((s) => s.id === slotOpen) ?? -1;

  const leave = () => { try { sessionStorage.removeItem(draftKey(id!)); } catch { /* ignore */ } replace("plan"); };
  const save = () => {
    if (issues.length) return toast({ kind: "error", title: "Can't save yet", body: issues[0].message });
    saveRoutine({ ...draft, name: draft.name.trim(), days: draft.days.map((d) => ({ ...d, title: d.title.trim() })) });
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
        <button className="btn btn-primary" style={{ minHeight: 40 }} onClick={save} disabled={!dirty}>Save</button>
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
                <SlotRow key={s.id} slot={s} ex={exMap.get(s.exerciseId)} index={i} count={day.slots.length}
                  groupStart={s.supersetGroup !== day.slots[i - 1]?.supersetGroup} groupEnd={s.supersetGroup !== day.slots[i + 1]?.supersetGroup}
                  onOpen={() => setSlotOpen(s.id)} onMove={(to) => setDraft(moveSlot(draft, day.id, i, to))} />
              ))}
            </SortableContext>
          </DndContext>
          {!day.slots.length && <p className="muted" style={{ textAlign: "center", fontSize: 14, padding: 12 }}>No exercises. A day without exercises is a rest day.</p>}
          <button className="btn btn-ghost btn-block" style={{ minHeight: 52 }} onClick={() => setPicker({ mode: "add" })}><Icon name="plus" /> Add exercise</button>
        </div>
      )}

      <h2 className="section-title" id="live-volume">Weekly volume · live</h2>
      <VolumeTable totals={totals} targets={targets} days={dayCount} />

      <Dock>
        <div className="glass row" style={{ padding: 8, borderRadius: 20 }}>
          <button className="row grow" style={{ padding: "0 8px", minHeight: 44 }} onClick={() => document.getElementById("live-volume")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" })} aria-label="Jump to weekly volume">
            <span className="status-ok mono">✓ {ok}</span>
            <span className={warn ? "status-warn mono" : "muted mono"}>⚠ {warn}</span>
            <span className="muted" style={{ fontSize: 12 }}>on target</span>
          </button>
          <button className="btn btn-primary" style={{ minHeight: 46 }} onClick={save} disabled={!dirty}><Icon name="check" size={18} /> Save plan</button>
        </div>
      </Dock>

      <Sheet open={!!slot} onClose={() => setSlotOpen(null)} label="Exercise in plan">
        {slot && day && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row">
              <Figure spec={exMap.get(slot.exerciseId)?.figure} size={54} />
              <h3 className="title-md grow">{exMap.get(slot.exerciseId)?.name}</h3>
              <button className="icon-btn" onClick={() => setSlotOpen(null)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Stepper label="Sets" value={slot.sets} step={1} decimals={false} min={1} onChange={(v) => setDraft(updateSlot(draft, day.id, slot.id, { sets: Math.max(1, Math.min(20, v ?? 1)) }))} />
              <Stepper label="Rest" suffix={fmtRest(slot.restSec)} value={slot.restSec} step={15} decimals={false} onChange={(v) => setDraft(updateSlot(draft, day.id, slot.id, { restSec: v ?? settings.restDefaultSec }))} />
              <Stepper label="Reps min" value={slot.repMin} step={1} decimals={false} min={1} onChange={(v) => setDraft(updateSlot(draft, day.id, slot.id, { repMin: Math.max(1, v ?? 1), repMax: Math.max(slot.repMax, v ?? 1) }))} />
              <Stepper label="Reps max" value={slot.repMax} step={1} decimals={false} min={1} onChange={(v) => setDraft(updateSlot(draft, day.id, slot.id, { repMax: Math.max(slot.repMin, v ?? slot.repMin) }))} />
            </div>
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
        onPick={(ex) => {
          if (!day) return;
          if (picker?.mode === "swap") setDraft(swapSlotExercise(draft, day.id, picker.slotId, ex));
          else setDraft(addSlot(draft, day.id, ex, settings.restDefaultSec).routine);
        }} />
      <ExerciseSheet id={howTo} onClose={() => setHowTo(null)} />
      <Confirm open={confirm === "cancel"} title="Discard changes?" body="Your edits to this plan are thrown away." confirm="Discard" danger onClose={() => setConfirm(null)} onConfirm={leave} />
      <Confirm open={confirm === "deleteDay"} title={`Delete ${day?.title ?? "this day"}?`} body="Past workouts of this day stay in history." confirm="Delete" danger
        onClose={() => setConfirm(null)} onConfirm={() => { if (day) { setDraft(removeDay(draft, day.id)); setDayId(null); } }} />
    </div>
  );
}
