// A plan day's exercise list (Plan tab and Today). Tap a row to open the exercise; press and hold (or drag with a mouse)
// to move it up or down. With onDelete, swipe a row left to delete it (short swipe shows Delete, long swipe deletes). Loaded lazily so the drag library isn't in the startup bundle.
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Exercise, Slot } from "../../core/types";
import { fmtRest, repRange } from "../format";
import { vibrate } from "../device";
import { FailFlame } from "./FailFlame";
import { Figure } from "./Figure";
import { Icon } from "./Icon";

/** Rows only move up and down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Width of the Delete button a short swipe leaves showing; a long swipe deletes at once. */
const OPEN_W = 88, DELETE_AT = 150;

function Row({ slot, ex, index, onOpen, onDelete, fail, content }: { slot: Slot; ex: Exercise; index: number; onOpen: () => void; onDelete?: () => void; fail?: string[]; content?: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  const wrap = useRef<HTMLDivElement | null>(null);
  const [dx, setDx] = useState(0); // how far the row is slid left (≤ 0)
  const [live, setLive] = useState(false); // finger down (no animation)
  const cb = useRef({ onDelete, dx }); cb.current = { onDelete, dx };
  const swallow = useRef(false);
  // Swipe left to delete: sideways moves lock after 6 px (vertical = page scroll, press and hold = drag to move)
  useEffect(() => {
    const el = wrap.current;
    if (!el || !onDelete) return;
    let st: { x: number; y: number; base: number } | null = null, lock: "x" | "y" | null = null, cur = 0, vel = 0, lx = 0, lt = 0;
    const start = (e: TouchEvent) => { if (e.touches.length !== 1) return; st = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: cb.current.dx }; lock = null; cur = st.base; vel = 0; lx = st.x; lt = performance.now(); };
    const move = (e: TouchEvent) => {
      if (!st) return;
      const x = e.touches[0].clientX, mx = x - st.x, my = e.touches[0].clientY - st.y;
      if (!lock) { if (Math.max(Math.abs(mx), Math.abs(my)) < 6) return; lock = Math.abs(mx) > Math.abs(my) ? "x" : "y"; }
      if (lock !== "x") return;
      if (e.cancelable) e.preventDefault();
      const now = performance.now(); if (now > lt) vel = 0.7 * ((x - lx) / (now - lt)) + 0.3 * vel; lx = x; lt = now;
      cur = Math.min(0, st.base + mx); setLive(true); setDx(cur);
    };
    const end = () => {
      if (st && lock === "x") {
        swallow.current = true; setTimeout(() => { swallow.current = false; }, 350);
        setLive(false);
        if (cur < -DELETE_AT || (vel < -0.9 && cur < -40)) { setDx(-(el.offsetWidth + 20)); setTimeout(() => cb.current.onDelete?.(), 200); }
        else setDx(vel < -0.35 || (vel <= 0.35 && cur < -OPEN_W / 2) ? -OPEN_W : 0);
      }
      st = null; lock = null;
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end); };
  }, [!!onDelete]);
  return (
    <div ref={(n) => { setNodeRef(n); wrap.current = n; }} className={"day-row" + (isDragging ? " dragging" : "") + (dx ? " swiping" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClickCapture={(e) => { if (swallow.current) { swallow.current = false; e.stopPropagation(); e.preventDefault(); } }}>
      {onDelete && dx < 0 && (
        <button type="button" className="day-row-del" style={{ width: Math.max(OPEN_W, -dx) }} onClick={() => { setDx(-(wrap.current?.offsetWidth ?? 400) - 20); setTimeout(() => onDelete(), 200); }}>
          <Icon name="trash" size={20} /><span>Delete</span>
        </button>
      )}
      <button className="list-row" onClick={() => (dx ? setDx(0) : onOpen())} {...attributes} {...listeners} aria-roledescription="Exercise. Press and hold to move it."
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: live ? "none" : "transform .28s var(--ease)" }}>
        {content ?? <>
        <span className="mono muted" style={{ width: 16, fontSize: 13 }}>{index + 1}</span>
        <Figure spec={ex.figure} size={44} still className="thin" />
        <span className="grow">
          <span style={{ display: "block", fontWeight: 600 }}>{ex.name} {ex.isHeavy && <span className="star">★</span>}<FailFlame why={fail} /></span>
          <span className="muted" style={{ fontSize: 12 }}>{slot.supersetGroup ? `Superset ${slot.supersetGroup} · ` : ""}{slot.notes ? `${slot.notes} · ` : ""}rest {fmtRest(slot.restSec)}</span>
        </span>
        <span className="mono" style={{ whiteSpace: "nowrap" }}>{slot.sets} × {repRange(slot.repMin, slot.repMax)}</span>
        <Icon name="chevron" size={16} />
        </>}
      </button>
    </div>
  );
}

export function SortableDayList({ slots, exMap, onOpen, onMove, onDelete, fail, row }: {
  slots: Slot[]; exMap: Map<string, Exercise>; onOpen: (slot: Slot) => void; onMove: (from: number, to: number) => void; fail?: Map<string, string[]>;
  /** Swipe a row left to delete it (Plan tab) */
  onDelete?: (slot: Slot) => void;
  /** Custom row content (Today's list); defaults to the Plan tab's row */
  row?: (slot: Slot, ex: Exercise, index: number) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onMove(slots.findIndex((s) => s.id === e.active.id), slots.findIndex((s) => s.id === e.over!.id));
  };
  const shown = slots.filter((s) => exMap.has(s.exerciseId));
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragStart={() => vibrate(10)} onDragEnd={onDragEnd}>
      <SortableContext items={shown.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {shown.map((s, i) => <Row key={s.id} slot={s} ex={exMap.get(s.exerciseId)!} index={i} onOpen={() => onOpen(s)} onDelete={onDelete ? () => onDelete(s) : undefined} fail={fail?.get(s.id)} content={row?.(s, exMap.get(s.exerciseId)!, i)} />)}
      </SortableContext>
    </DndContext>
  );
}
