// Workout logger. Built for one hand and sweaty fingers: the current set is expanded with big steppers
// and one big Done button; everything saves on every tap; rest starts automatically.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DndContext, MeasuringStrategy, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent, type DraggableAttributes, type DraggableSyntheticListeners, type Modifier } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MANUAL_WHY } from "../../core/failure";
import { orderSlotsLike } from "../../core/routineEdit";
import { useRestRunning, WorkoutRestPanel, WorkoutRestPill } from "../components/RestTimer";
import { LOADING } from "../../core/figure/poses";
import { groupPlates, platesFor } from "../../core/plates";
import { progressionHint } from "../../core/progression";
import { EFFORT_RULE, effortGap, effortLine } from "../../core/effort";
import { addSetToRecords, cloneRecords, computeRecords, entryVolume, PR_LABEL, prsForSet, type PrKind } from "../../core/records";
import {
  addEntry, addSet, afterSetDone, applyHint, buildEntry, durationMin, finishSession, lastEntryFor, moveEntryTo, refitFailure, removeEntry, removeSet,
  setEntry, swapEntry, toggleDone, toggleSupersetWithNext, updateSet,
} from "../../core/session";
import type { Exercise, LoggedSet, Session, SessionEntry, SetType } from "../../core/types";
import { fmtNum } from "../../core/util";
import { Stepper } from "../components/Controls";
import { ExercisePicker } from "../components/ExercisePicker";
import { Figure } from "../components/Figure";
import { tempoTiming } from "../../core/figure/tempo";
import { Icon } from "../components/Icon";
import { Confirm, Sheet } from "../components/Sheet";
import { keepAwake, reducedMotion, vibrate } from "../device";
import { fmtClock, fmtRest, fmtW, loadSuffix, repRange, setsLine } from "../format";
import { go } from "../router";
import { useStore } from "../store";
import { DELOAD } from "../../core/deload";
import { ExerciseSheet } from "./ExerciseScreen";

const TYPES: SetType[] = ["working", "warmup", "drop", "failure"];
const TYPE_UI: Record<SetType, { short: string; long: string; color: string }> = {
  working: { short: "", long: "Working set", color: "var(--neon-ink)" },
  warmup: { short: "W", long: "Warm-up", color: "var(--muted)" },
  drop: { short: "D", long: "Drop set", color: "var(--neon-2)" },
  failure: { short: "F", long: "To failure", color: "var(--bad)" },
};

function Elapsed({ s }: { s: Session }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  return <span className="mono">{fmtClock((Date.now() - Date.parse(s.startedAt)) / 1000)}</span>;
}

/** Scroll so the card's top sits just under the sticky workout header (its height differs per phone). */
function scrollBelowHeader(el: HTMLElement | undefined, behavior: ScrollBehavior) {
  if (!el) return;
  // Layout positions (offsetTop) ignore the page's slide-in animation, which would throw a measurement off.
  const header = (document.querySelector(".page > header") as HTMLElement | null)?.offsetHeight ?? 0;
  let top = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
  window.scrollTo({ top: Math.max(0, top - header - 10), behavior });
}

export function WorkoutScreen() {
  const store = useStore();
  const { active, exMap, finished, settings, saveSession, saveRoutine, setRestTimer, toast, routine } = store;
  // The exercise you're on survives switching tabs (and a reload): remembered per workout.
  const [focus, setFocusState] = useState<string | null>(() => { try { return sessionStorage.getItem("bf-focus-" + active?.id); } catch { return null; } });
  const setFocus = (id: string | null) => { setFocusState(id); try { if (active && id) sessionStorage.setItem("bf-focus-" + active.id, id); } catch { /* ignore */ } };
  const [detail, setDetail] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; entryId: string } | null>(null);
  const [noteFor, setNoteFor] = useState<string | "workout" | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [noteFromFinish, setNoteFromFinish] = useState(false);
  // Rest timer in the header while it runs (in place of Finish); tapping it opens the full timer under the header
  const resting = useRestRunning();
  const [restOpen, setRestOpen] = useState(false);
  useEffect(() => { if (!resting) setRestOpen(false); }, [resting]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!active || !settings.keepAwake) return;
    void keepAwake(true);
    const v = () => document.visibilityState === "visible" && keepAwake(true);
    document.addEventListener("visibilitychange", v);
    return () => { document.removeEventListener("visibilitychange", v); void keepAwake(false); };
  }, [active, settings.keepAwake]);

  // Focus = the exercise you're on: first one with a set left, unless chosen.
  const current = useMemo(() => {
    if (!active) return null;
    if (focus && active.entries.some((e) => e.id === focus && e.sets.some((x) => !x.done))) return focus;
    // Else an exercise already started but not finished (the first one if several), else the first with a set left
    return (active.entries.find((e) => e.sets.some((x) => x.done) && e.sets.some((x) => !x.done)) ?? active.entries.find((e) => e.sets.some((x) => !x.done)))?.id ?? null;
  }, [active, focus]);
  // Coming back to the workout (from another tab): jump straight to that exercise.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current || !current) return;
    arrived.current = true;
    if (current === active?.entries[0]?.id) return;
    requestAnimationFrame(() => scrollBelowHeader(refs.current.get(current), "auto"));
  }, [current, active]);

  if (!active) {
    return (
      <div className="page"><div className="empty" style={{ paddingTop: 80 }}>
        <Figure spec={LOADING} size={130} />
        <h2 className="title-lg">No workout running</h2>
        <p>Start one from Today.</p>
        <button className="btn btn-primary" onClick={() => go("today")}>Go to Today</button>
      </div></div>
    );
  }
  const s = active;
  const commit = (n: Session) => saveSession(n);
  const total = s.entries.reduce((a, e) => a + e.sets.length, 0);
  const done = s.entries.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const day = routine?.days.find((d) => d.id === s.dayId);
  const offSlots = new Set(day?.slots.filter((x) => x.toFailure === false).map((x) => x.id) ?? []);

  /** Target button: scroll to the current card, or flash its border when it's already in view. */
  const goToCurrent = () => {
    const el = current ? refs.current.get(current) : undefined;
    if (!el) return;
    const header = (document.querySelector(".page > header") as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0;
    const r = el.getBoundingClientRect();
    const inView = r.top >= header - 12 && r.top < window.innerHeight * 0.5;
    if (!inView) return scrollTo(current);
    const card = el.querySelector("article");
    if (!card) return;
    card.classList.remove("card-flash");
    void (card as HTMLElement).offsetWidth; // restart the animation on repeat taps
    card.classList.add("card-flash");
    card.addEventListener("animationend", () => card.classList.remove("card-flash"), { once: true });
  };

  // Press and hold an exercise's name to drag it (a mouse drags at once)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
  );
  // While dragging, every card shrinks to its name row so the whole list fits; the grabbed card stays under the finger
  const [sorting, setSorting] = useState(false);
  const keepTop = useRef<{ id: string; top: number } | null>(null);
  const onDragStart = (ev: DragStartEvent) => {
    vibrate(10);
    const el = refs.current.get(String(ev.active.id));
    keepTop.current = el ? { id: String(ev.active.id), top: el.getBoundingClientRect().top } : null;
    setSorting(true);
  };
  useLayoutEffect(() => {
    const k = keepTop.current;
    if (!sorting || !k) return;
    keepTop.current = null;
    const el = refs.current.get(k.id);
    if (el) window.scrollBy(0, el.getBoundingClientRect().top - k.top);
  }, [sorting]);
  const onDragEnd = (ev: DragEndEvent) => {
    setSorting(false);
    if (!ev.over || ev.active.id === ev.over.id) return;
    const from = s.entries.findIndex((x) => x.id === ev.active.id), to = s.entries.findIndex((x) => x.id === ev.over!.id);
    const next = refitFailure(moveEntryTo(s, from, to), exMap, offSlots);
    commit(next);
    // The plan day takes the new order too
    if (routine && day) {
      const r = orderSlotsLike(routine, day.id, next.entries.map((x) => x.slotId).filter((x): x is string => !!x));
      if (r !== routine) saveRoutine(r);
    }
  };

  const scrollTo = (id: string | null) => {
    if (!id) return;
    setTimeout(() => scrollBelowHeader(refs.current.get(id), reducedMotion() ? "auto" : "smooth"), 60);
  };

  const onToggle = (e: SessionEntry, x: LoggedSet) => {
    const ex = exMap.get(e.exerciseId)!;
    if (!x.done && needsValues(x, ex)) return; // the card shakes the button and highlights what's missing
    const next = toggleDone(s, e.id, x.id, new Date());
    commit(next);
    if (x.done) return; // undo
    vibrate(12);
    // PR check against history + this entry's earlier sets
    const prev = computeRecords(finished, ex.id, s.id);
    const running = cloneRecords(prev);
    const ne = next.entries.find((y) => y.id === e.id)!;
    for (const y of ne.sets) if (y.id !== x.id && y.done) addSetToRecords(running, y, s.date);
    const kinds: PrKind[] = prsForSet(running, { ...x, done: true });
    const before = entryVolume(e.sets), after = entryVolume(ne.sets);
    if (prev.bestSessionVolume && after > prev.bestSessionVolume.value && before <= prev.bestSessionVolume.value) kinds.push("volume");
    if (kinds.length) toast({ kind: "pr", title: "New PR!", body: `${ex.name}: ${kinds.map((k) => PR_LABEL[k]).join(" · ")} (${fmtW(x.weight)}${loadSuffix(ex)} × ${x.reps})` });
    const r = afterSetDone(next, e.id);
    if (r.rest && settings.autoStartRest && e.restSec > 0) setRestTimer({ endsAt: Date.now() + e.restSec * 1000, durationSec: e.restSec, sessionId: s.id, entryId: e.id });
    if (r.nextEntryId !== e.id) { setFocus(r.nextEntryId); scrollTo(r.nextEntryId); }
  };

  const doFinish = () => {
    const f = finishSession(s, new Date());
    if (!f.entries.length) { setFinishOpen(false); setConfirmDiscard(true); return; }
    commit(f);
    setRestTimer(null);
    go(`summary/${f.id}`);
  };

  // Group consecutive superset entries for the bracket
  const groupInfo = (i: number) => {
    const e = s.entries[i];
    if (!e.supersetGroup) return null;
    const prev = s.entries[i - 1], nxt = s.entries[i + 1];
    return { label: e.supersetGroup, first: prev?.supersetGroup !== e.supersetGroup, last: nxt?.supersetGroup !== e.supersetGroup };
  };
  const menuEntry = s.entries.find((e) => e.id === menu);
  const menuIdx = s.entries.findIndex((e) => e.id === menu);

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <header className="glass" style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--surface-solid)", backdropFilter: "none", WebkitBackdropFilter: "none", margin: "0 -16px 14px", padding: "calc(env(safe-area-inset-top) + 10px) 16px 12px", borderRadius: "0 0 22px 22px", borderTop: 0 }}>
        <div className="spread">
          <div className="grow">
            <div className="eyebrow" style={{ fontSize: 11 }}>{s.deload ? <span style={{ color: "var(--neon-2)" }}>Deload · </span> : null}{day ? "Workout" : "Free workout"} · <Elapsed s={s} /></div>
            <h1 className="title-md" style={{ textTransform: "uppercase", fontSize: 24, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</h1>
          </div>
          <button className="icon-btn" aria-label="Go to the current exercise" onClick={goToCurrent}><Icon name="target" /></button>
          {resting
            ? <WorkoutRestPill open={restOpen} onToggle={() => setRestOpen((o) => !o)} />
            : <button className="btn btn-primary" style={{ minHeight: 42, padding: "0 16px", fontSize: 16 }} onClick={() => setFinishOpen(true)}>Finish</button>}
        </div>
        <div style={{ marginTop: 10, height: 6, borderRadius: 6, background: "var(--surface-2)", overflow: "hidden" }} role="progressbar" aria-valuenow={done} aria-valuemax={total} aria-label="Sets done">
          <div style={{ height: "100%", width: `${total ? (done / total) * 100 : 0}%`, borderRadius: 6, background: "linear-gradient(90deg,var(--neon),var(--neon-2))", boxShadow: "0 0 12px var(--glow)", transition: "width .5s var(--ease)" }} />
        </div>
        <div className="muted mono" style={{ fontSize: 12, marginTop: 4, textAlign: "right" }}>{done}/{total} sets</div>
        {resting && restOpen && <WorkoutRestPanel />}
      </header>

      {s.entries.length === 0 && (
        <div className="empty"><Figure spec={LOADING} size={110} /><p>Add your first exercise.</p></div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setSorting(false)}>
      <SortableContext items={s.entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
      <div className={"stack" + (sorting ? " sorting" : "")} style={{ gap: sorting ? 8 : 14 }}>
        {s.entries.map((e, i) => {
          const ex = exMap.get(e.exerciseId);
          if (!ex) return null;
          const g = groupInfo(i);
          return (
            <SortableEntry key={e.id} id={e.id} setRef={(el) => { if (el) refs.current.set(e.id, el); }} style={{ scrollMarginTop: 120, position: "relative", paddingLeft: g ? 14 : 0 }}>{(drag) => (<>
              {g && (
                <div aria-hidden style={{ position: "absolute", left: 0, top: g.first ? 18 : -14, bottom: g.last ? 18 : -14, width: 3, borderRadius: 3, background: "var(--neon-2)", boxShadow: "0 0 10px var(--neon-2)" }} />
              )}
              {g?.first && <div className="eyebrow" style={{ color: "var(--neon-2)", margin: "0 0 6px 2px", fontSize: 11 }}>Superset {g.label}</div>}
              <EntryCard
                s={s} e={e} ex={ex} index={i} focused={current === e.id}
                onFocus={() => setFocus(e.id)} onToggle={(x) => onToggle(e, x)} commit={commit}
                onDetail={() => setDetail(e.id)} onMenu={() => setMenu(e.id)} drag={drag}
              />
            </>)}</SortableEntry>
          );
        })}
      </div>
      </SortableContext>
      </DndContext>

      <button className="btn btn-ghost btn-block" style={{ marginTop: 16, minHeight: 54 }} onClick={() => setPicker({ mode: "add" })}><Icon name="plus" /> Add exercise</button>

      {/* Exercise detail without losing your place */}
      {(() => {
        const de = s.entries.find((x) => x.id === detail);
        const slot = day?.slots.find((x) => x.id === de?.slotId);
        return <ExerciseSheet id={de?.exerciseId ?? null} onClose={() => setDetail(null)} failWhy={de?.toFailure && !s.deload ? de.failWhy ?? [] : undefined} whyOverride={de?.exerciseId === slot?.exerciseId ? slot?.whyOverride : undefined} tipsOverride={de?.exerciseId === slot?.exerciseId ? slot?.tipsOverride : undefined} />;
      })()}

      <Sheet open={!!menuEntry} onClose={() => setMenu(null)} label="Exercise options">
        {menuEntry && (
          <div>
            <div className="eyebrow" style={{ padding: "0 8px 8px" }}>{exMap.get(menuEntry.exerciseId)?.name}</div>
            <button className="menu-item" onClick={() => { setPicker({ mode: "swap", entryId: menuEntry.id }); setMenu(null); }}><Icon name="swap" /> Swap for this workout</button>
            {menuIdx < s.entries.length - 1 && (
              <button className="menu-item" onClick={() => { commit(toggleSupersetWithNext(s, menuEntry.id)); setMenu(null); }}>
                <Icon name="link" /> {menuEntry.supersetGroup && menuEntry.supersetGroup === s.entries[menuIdx + 1]?.supersetGroup ? "Unlink from next (end superset)" : "Superset with next exercise"}
              </button>
            )}
            <button className="menu-item" onClick={() => { setNoteFor(menuEntry.id); setMenu(null); }}><Icon name="note" /> {menuEntry.notes ? "Edit note" : "Add note"}</button>
            <button className="menu-item" onClick={() => { commit(addSet(s, menuEntry.id, "warmup")); setMenu(null); }}><Icon name="plus" /> Add warm-up set</button>
            <button className="menu-item" onClick={() => { setDetail(menuEntry.id); setMenu(null); }}><Icon name="info" /> How to do it</button>
            <button className="menu-item danger" onClick={() => { setConfirmRemove(menuEntry.id); setMenu(null); }}><Icon name="trash" /> Remove from workout</button>
          </div>
        )}
      </Sheet>

      <ExercisePicker
        open={!!picker}
        title={picker?.mode === "swap" ? "Swap exercise" : "Add exercise"}
        exclude={picker?.mode === "swap" ? s.entries.find((x) => x.id === picker.entryId)?.exerciseId : undefined}
        onClose={() => setPicker(null)}
        onPick={(ex) => {
          if (picker?.mode === "swap") commit(swapEntry(s, picker.entryId, ex, finished));
          else { const ne = buildEntry(ex, finished, { restSec: ex.defaultRestSec || settings.restDefaultSec }); commit(addEntry(s, ne)); scrollTo(ne.id); }
        }}
      />

      <NoteSheet
        open={noteFor != null}
        title={noteFor === "workout" ? "Workout notes" : `Note · ${exMap.get(s.entries.find((x) => x.id === noteFor)?.exerciseId ?? "")?.name ?? ""}`}
        value={noteFor === "workout" ? s.notes ?? "" : s.entries.find((x) => x.id === noteFor)?.notes ?? ""}
        onSave={(v) => {
          if (noteFor === "workout") commit({ ...s, notes: v || undefined });
          else if (noteFor) commit(setEntry(s, noteFor, { notes: v || undefined }));
        }}
        onClose={() => { setNoteFor(null); if (noteFromFinish) { setNoteFromFinish(false); setFinishOpen(true); } }}
      />

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} label="Finish workout">
        <div className="stack" style={{ padding: "0 4px" }}>
          <div className="spread">
            <h3 className="title-lg">Finish workout?</h3>
            {/* Workout notes live here now: add one before finishing (comes back to this sheet after) */}
            <button className="icon-btn" aria-label="Workout notes" style={{ color: s.notes ? "var(--neon-ink)" : undefined }}
              onClick={() => { setFinishOpen(false); setNoteFromFinish(true); setNoteFor("workout"); }}><Icon name="note" /></button>
          </div>
          <p className="muted">{done} of {total} sets done · {durationMin(s)} min.{total - done > 0 ? ` ${total - done} set${total - done > 1 ? "s" : ""} not done will be dropped.` : ""}</p>
          <button className="btn btn-primary btn-xl" onClick={doFinish}><Icon name="check" /> Finish</button>
          <button className="btn btn-ghost btn-block" onClick={() => setFinishOpen(false)}>Keep going</button>
          <button className="btn btn-quiet btn-block" style={{ color: "var(--bad)" }} onClick={() => { setFinishOpen(false); setConfirmDiscard(true); }}>Discard workout</button>
        </div>
      </Sheet>
      <Confirm open={confirmDiscard} title="Discard this workout?" body="Everything logged in it is deleted. This can't be undone." confirm="Discard" danger
        onClose={() => setConfirmDiscard(false)} onConfirm={() => { store.deleteSession(s.id); setRestTimer(null); go("today"); }} />
      <Confirm open={!!confirmRemove} title="Remove this exercise?" body="Its sets in this workout are removed." confirm="Remove" danger
        onClose={() => setConfirmRemove(null)} onConfirm={() => confirmRemove && commit(removeEntry(s, confirmRemove))} />
    </div>
  );
}

export function NoteSheet({ open, title, value, onSave, onClose }: { open: boolean; title: string; value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value, open]);
  const close = () => { if (v !== value) onSave(v.trim()); onClose(); };
  return (
    <Sheet open={open} onClose={close} label={title} floating>
      <div className="stack">
        <h3 className="title-md">{title}</h3>
        <textarea className="input" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Seat height, grip, how it felt…" />
        <button className="btn btn-primary btn-block" onClick={close}>Save</button>
      </div>
    </Sheet>
  );
}

type DragProps = { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners };

/** Rows only move up and down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** One exercise in the drag-and-drop list; the card's name area is the handle. */
function SortableEntry({ id, setRef, style, children }: { id: string; setRef: (el: HTMLDivElement | null) => void; style: React.CSSProperties; children: (d: DragProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={(el) => { setNodeRef(el); setRef(el); }} className={isDragging ? "entry-dragging" : undefined}
      style={{ ...style, transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 5 : undefined }}>
      {children({ attributes, listeners })}
    </div>
  );
}

function EntryCard({ s, e, ex, index, focused, onFocus, onToggle, commit, onDetail, onMenu, drag }: {
  s: Session; e: SessionEntry; ex: Exercise; index: number; focused: boolean;
  onFocus: () => void; onToggle: (x: LoggedSet) => void; commit: (n: Session) => void; onDetail: () => void; onMenu: () => void; drag?: DragProps;
}) {
  const { finished, exMap, settings } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  // Missing weight/reps on a refused "done": which set, and a counter to restart the shake
  const [missing, setMissing] = useState<{ id: string; n: number; from: "check" | "done" } | null>(null);
  const refuse = (x: LoggedSet, from: "check" | "done") => { onFocus(); setSel(x.id); setMissing((m) => ({ id: x.id, n: (m?.n ?? 0) + 1, from })); vibrate([30, 40, 30]); };
  const last = useMemo(() => lastEntryFor(finished, ex.id, s.id), [finished, ex.id, s.id]);
  const repMin = e.repMin ?? 8, repMax = e.repMax ?? repMin;
  // Deload: no progression push; a fixed reminder instead.
  const hint = s.deload || !settings.progressionHints ? ({ kind: "none" } as const) : progressionHint(last?.entry.sets, repMin, repMax, ex.incrementLb);
  const allDone = e.sets.length > 0 && e.sets.every((x) => x.done);
  // Effort check: the failure set shows earlier sets at the same weight left too many reps (today, and last time)
  const gap = effortGap(e, s.deload);
  const lastGap = last ? effortGap(last.entry) : null;
  // The first set that isn't done is the open one; a picked set counts only if it's done or that one (sets go in order)
  const firstOpen = e.sets.find((x) => !x.done) ?? null;
  const picked = e.sets.find((x) => x.id === sel);
  const selected = picked && (picked.done || picked.id === firstOpen?.id) ? picked : firstOpen;
  const workIdx = (x: LoggedSet) => e.sets.filter((y) => y.type === "working" && e.sets.indexOf(y) <= e.sets.indexOf(x)).length;
  const swappedFrom = e.swappedFromId ? exMap.get(e.swappedFromId)?.name : undefined;
  // Last set to failure: picked when the workout started (stored on the entry, so it never changes mid-workout)
  const failSetId = !s.deload && e.toFailure
    ? [...e.sets].reverse().find((x) => x.type === "working" || x.type === "failure")?.id : undefined;

  return (
    <article className="glass edge" onClick={onFocus}
      style={{ padding: 14, borderRadius: 22, transition: "box-shadow .35s, border-color .35s, opacity .35s",
        // All sets done: green line around the card
        borderColor: allDone ? "var(--good)" : focused ? "color-mix(in srgb, var(--neon) 55%, transparent)" : undefined,
        boxShadow: allDone ? "0 0 0 1px var(--good), 0 0 22px -8px var(--good)" : focused ? "0 0 0 1px color-mix(in srgb,var(--neon) 30%,transparent), 0 18px 50px -20px var(--glow)" : undefined,
        opacity: allDone && !focused ? 0.9 : 1 }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
        {/* Number, name and figure: one tap target that opens how to do it */}
        <button className="row grow entry-handle" style={{ textAlign: "left", alignItems: "flex-start", gap: 10, minWidth: 0 }} onClick={(ev) => { ev.stopPropagation(); onDetail(); }} {...drag?.attributes} {...drag?.listeners} aria-label={`${ex.name}: how to do it`} aria-roledescription="Exercise. Press and hold to move it.">
          <span className="mono" style={{ width: 26, height: 26, flex: "none", display: "grid", placeItems: "center", borderRadius: 8, fontSize: 13, marginTop: 2,
            background: allDone ? "var(--good)" : focused ? "var(--neon)" : "var(--surface-2)", color: allDone || focused ? "var(--on-neon)" : "var(--muted)", boxShadow: allDone ? "0 0 12px var(--good)" : focused ? "0 0 12px var(--glow)" : "none", transition: "all .3s" }}>
            {allDone ? <Icon name="check" size={16} stroke={3} /> : index + 1}
          </span>
          <span className="grow" style={{ display: "block" }}>
          <div style={{ font: "700 21px/1.1 var(--display)", letterSpacing: ".01em" }}>{ex.name} {ex.isHeavy && <span className="star">★</span>}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
            {e.sets.filter((x) => x.type !== "warmup").length} × {repRange(e.repMin, e.repMax) || "—"} · rest {fmtRest(e.restSec)}
            {swappedFrom && <> · <span style={{ color: "var(--neon-2)" }}>swapped from {swappedFrom}</span></>}
          </div>
          {e.extraSet && <div className="extra-why"><span className="extra-tag">+1 set</span> {e.extraSet.map((w) => w.replace(/ \(skipped[^)]*\)$/, "")).join(" · ")}</div>}
          </span>
          <Figure spec={ex.figure} size={64} trim still={!focused} timing={tempoTiming(ex.tempo, ex.id)} />
        </button>
        <button className="icon-btn" style={{ marginRight: -8, marginTop: -6 }} onClick={(ev) => { ev.stopPropagation(); onMenu(); }} aria-label={`Options for ${ex.name}`}><Icon name="more" /></button>
      </div>

      {e.notes && <div className="row" style={{ gap: 8, alignItems: "center", fontSize: 13, marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "var(--surface-2)" }}><span style={{ display: "inline-flex", flex: "none" }}><Icon name="note" size={15} /></span><span>{e.notes}</span></div>}

      {(last || hint.kind !== "none" || s.deload || (lastGap && !allDone)) && (
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {last && <div className="mono muted" style={{ fontSize: 13 }}>Last: {setsLine(last.entry.sets)}</div>}
          {s.deload && !allDone && (
            <div className="row" style={{ padding: "8px 10px", borderRadius: 12, fontSize: 14, border: "1px solid color-mix(in srgb,var(--neon-2) 40%,transparent)", background: "color-mix(in srgb,var(--neon-2) 10%,transparent)" }}>
              <span style={{ color: "var(--neon-2)" }}><Icon name="timer" size={18} /></span>
              <span className="grow">Deload: weights are 10% lighter. Stop every set with {DELOAD.repsLeft} reps left.</span>
            </div>
          )}
          {lastGap && !allDone && !gap && (
            <div className="effort-note"><Icon name="flame" size={18} /><span><b>Last time: {effortLine(lastGap).replace(/^R/, "r").replace(/^S/, "s")}.</b> {EFFORT_RULE}</span></div>
          )}
          {hint.kind !== "none" && !allDone && (
            <div className="row" style={{ padding: "8px 10px", borderRadius: 12, background: "var(--glow-soft)", border: "1px solid color-mix(in srgb,var(--neon) 30%,transparent)" }}>
              <span style={{ color: "var(--neon-ink)" }}><Icon name={hint.kind === "addWeight" ? "up" : "bolt"} size={18} /></span>
              <span className="grow" style={{ fontSize: 14 }}>
                {hint.kind === "addWeight"
                  ? <>Hit the top last time. Try <b className="mono">{fmtNum(hint.weight)}{loadSuffix(ex)}</b> × {hint.reps}.</>
                  : <>Beat last time: <b className="mono">{fmtNum(hint.weight)} × {hint.targetReps.join(", ")}</b></>}
              </span>
              <button className="btn btn-ghost" style={{ minHeight: 36, padding: "0 12px", fontSize: 14 }}
                onClick={(ev) => { ev.stopPropagation(); commit(applyHint(s, e.id, hint.weight, hint.kind === "addWeight" ? hint.reps : hint.targetReps)); }}>Use</button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        {e.sets.map((x, xi) => {
          const isSel = selected?.id === x.id && focused;
          // Sets open in order: a set can't be expanded while an earlier one isn't done
          const locked = !x.done && e.sets.slice(0, xi).some((y) => !y.done);
          const t = TYPE_UI[x.type];
          return (
            <div key={x.id} className={x.id === failSetId && isSel && !x.done ? "fail-set" : undefined} style={{ borderRadius: 14, background: isSel ? "var(--surface-2)" : "transparent", border: `1px solid ${isSel ? "var(--line-strong)" : "transparent"}`, transition: "all .25s var(--ease)" }}>
              <div className="row" style={{ minHeight: 48, padding: "0 4px 0 6px" }}>
                <button aria-label={`Set type: ${t.long}. Tap to change`} title={t.long}
                  onClick={(ev) => { ev.stopPropagation(); commit(updateSet(s, e.id, x.id, { type: TYPES[(TYPES.indexOf(x.type) + 1) % TYPES.length] })); }}
                  style={{ width: 40, height: 36, borderRadius: 10, font: "700 15px var(--mono)", color: t.color, border: `1px solid color-mix(in srgb, ${t.color} 45%, transparent)` }}>
                  {t.short || workIdx(x)}
                </button>
                <button className="grow mono" style={{ textAlign: "left", fontSize: 18, padding: "8px 6px", color: x.done ? "var(--ink)" : "var(--muted)", opacity: locked ? 0.55 : 1, cursor: locked ? "default" : undefined }}
                  onClick={(ev) => { ev.stopPropagation(); onFocus(); if (!locked) setSel(x.id); }} aria-label={locked ? "Finish the earlier sets first" : "Edit set"} aria-disabled={locked}>
                  {fmtW(x.weight)}<span style={{ fontSize: 12 }}>{x.weight != null ? loadSuffix(ex) : ""}</span> <span style={{ opacity: 0.6 }}>×</span> {x.reps ?? "—"}
                  {x.id === failSetId && <span className="fail-tag" title="Last set: go to failure"><Icon name="flame" size={14} /> failure</span>}
                </button>
                <button key={missing?.id === x.id ? "m" + missing.n : "c"} className={missing?.id === x.id && missing.from === "check" && !x.done ? "shake" : undefined} aria-label={x.done ? "Mark not done" : "Mark done"} aria-pressed={x.done}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    // Can't be done without weight and reps: shake, open the set (if it's the next one) and mark what's missing
                    if (!x.done && needsValues(x, ex)) { if (!locked) refuse(x, "check"); else setMissing((m) => ({ id: x.id, n: (m?.n ?? 0) + 1, from: "check" })); return; }
                    setSel(null); onToggle(x);
                  }}
                  style={{ width: 48, height: 40, borderRadius: 12, display: "grid", placeItems: "center", transition: "all .25s var(--ease)",
                    background: x.done ? "var(--good)" : "transparent", color: x.done ? "var(--on-neon)" : "var(--muted)",
                    border: `1.5px solid ${x.done ? "var(--good)" : "var(--line-strong)"}`, boxShadow: x.done ? "0 0 16px -2px var(--good)" : "none",
                    transform: x.done ? "scale(1)" : "scale(.96)" }}>
                  <Icon name="check" size={22} stroke={2.6} />
                </button>
              </div>
              {isSel && !x.done && (
                <div style={{ padding: "4px 10px 12px", display: "grid", gap: 10, animation: "pageIn .3s var(--ease) both" }} onClick={(ev) => ev.stopPropagation()}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8, alignItems: "end" }}>
                    <Stepper invalid={missing?.id === x.id && ex.equipment !== "bodyweight" && !(x.weight != null && x.weight > 0)} label="Weight" suffix={ex.loadMode === "perSide" ? "lb/side" : ex.loadMode === "perHand" ? "lb/hand" : "lb"} value={x.weight} step={ex.incrementLb || 5} onChange={(v) => commit(updateSet(s, e.id, x.id, { weight: v }))} />
                    <Stepper invalid={missing?.id === x.id && !(x.reps != null && x.reps > 0)} label="Reps" value={x.reps} step={1} decimals={false} empty={repMin} onChange={(v) => commit(updateSet(s, e.id, x.id, { reps: v }))} />
                  </div>
                  {x.id === failSetId && <div className="fail-cue"><Icon name="flame" size={18} /><span><b>Last set: go to failure.</b> Keep going until you can't do another clean rep.{e.failWhy?.some((w) => w !== MANUAL_WHY) ? <FailWhy why={e.failWhy} /> : null}</span></div>}
                  {(ex.loadMode === "perSide" || ex.singleSleeve) && x.weight != null && x.weight > 0 && <Plates weight={x.weight} single={ex.singleSleeve} />}
                  <button key={missing?.id === x.id ? missing.n : 0} className={"btn btn-primary btn-xl" + (missing?.id === x.id && missing.from === "done" ? " shake" : "")} style={{ minHeight: 56 }} onClick={() => { if (needsValues(x, ex)) return refuse(x, "done"); setSel(null); onToggle(x); }}>
                    <Icon name="check" size={22} stroke={2.6} /> Done{e.sets.indexOf(x) === e.sets.length - 1 ? "" : ` · set ${e.sets.indexOf(x) + 1}`}
                  </button>
                  <button className="btn btn-quiet" style={{ minHeight: 36, fontSize: 13 }} onClick={() => commit(removeSet(s, e.id, x.id))}><Icon name="trash" size={16} /> Remove this set</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {gap && <div className="effort-note" style={{ marginTop: 8 }}><Icon name="flame" size={18} /><span><b>{effortLine(gap)}.</b> {EFFORT_RULE}</span></div>}
      <button className="btn btn-quiet btn-block" style={{ marginTop: 4, minHeight: 40, fontSize: 14 }} onClick={(ev) => { ev.stopPropagation(); commit(addSet(s, e.id)); onFocus(); }}>
        <Icon name="plus" size={18} /> Add set
      </button>
    </article>
  );
}

/** Why a set can't be marked done yet, or null when it can: reps always, weight unless it's a bodyweight exercise. */
function needsValues(x: LoggedSet, ex: Exercise): string | null {
  const noW = ex.equipment !== "bodyweight" && (x.weight == null || x.weight <= 0), noR = x.reps == null || x.reps <= 0;
  return noW && noR ? "Enter weight and reps first" : noW ? "Enter the weight first" : noR ? "Enter the reps first" : null;
}

/** Plates to load, drawn as plates (front view, sized by weight) with a count. Standard gym plates, unlimited. */
function Plates({ weight, single }: { weight: number; single?: boolean }) {
  const r = platesFor(weight);
  const label = single ? "Plates" : "Plates per side";
  return (
    <div className="plates" aria-label={`${label}: ${groupPlates(r.plates).map((g) => `${g.count} × ${fmtNum(g.weight)}`).join(", ")}`}>
      <span className="eyebrow" style={{ fontSize: 10 }}>{label}</span>
      <div className="plates-row" aria-hidden="true">
        {groupPlates(r.plates).map((g) => (
          <span key={g.weight} className="plate-group">
            <span className="plate" style={{ ["--d" as string]: `${PLATE_SIZE[g.weight] ?? 24}px` }}><b>{fmtNum(g.weight)}</b></span>
            {g.count > 1 && <span className="plate-count mono">×{g.count}</span>}
          </span>
        ))}
      </div>
      {r.remainder > 0 && <span className="plates-warn" style={{ color: "var(--warn)", fontSize: 13 }}>+{fmtNum(r.remainder)} lb can't be loaded with standard plates</span>}
    </div>
  );
}
const PLATE_SIZE: Record<number, number> = { 45: 50, 35: 45, 25: 40, 10: 34, 5: 30, 2.5: 28 };

/** The reasons a set goes to failure: hidden behind "Why?", shown as bullets in two columns. */
function FailWhy({ why }: { why: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="fail-why-btn" aria-expanded={open} onClick={(ev) => { ev.stopPropagation(); setOpen((o) => !o); }}>{open ? "Hide" : "Why?"}</button>
      {open && <ul className="fail-why muted">{why.map((w) => <li key={w}>{w.replace(/ (in this workout|today)$/, "")}</li>)}</ul>}
    </>
  );
}
