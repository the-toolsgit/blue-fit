// The Plan tab's exercise list for one day. Tap a row to open the exercise; press and hold (or drag with a mouse)
// to move it up or down. Loaded lazily so the drag library isn't in the startup bundle.
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Exercise, Slot } from "../../core/types";
import { fmtRest, repRange } from "../format";
import { vibrate } from "../device";
import { FailFlame } from "./FailFlame";
import { Figure } from "./Figure";
import { Icon } from "./Icon";

/** Rows only move up and down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function Row({ slot, ex, index, onOpen, fail }: { slot: Slot; ex: Exercise; index: number; onOpen: () => void; fail?: string[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  return (
    <div ref={setNodeRef} className={"day-row" + (isDragging ? " dragging" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button className="list-row" onClick={onOpen} {...attributes} {...listeners} aria-roledescription="Exercise. Press and hold to move it.">
        <span className="mono muted" style={{ width: 16, fontSize: 13 }}>{index + 1}</span>
        <Figure spec={ex.figure} size={44} still className="thin" />
        <span className="grow">
          <span style={{ display: "block", fontWeight: 600 }}>{ex.name} {ex.isHeavy && <span className="star">★</span>}<FailFlame why={fail} /></span>
          <span className="muted" style={{ fontSize: 12 }}>{slot.notes ? `${slot.notes} · ` : ""}rest {fmtRest(slot.restSec)}</span>
        </span>
        <span className="mono" style={{ whiteSpace: "nowrap" }}>{slot.sets} × {repRange(slot.repMin, slot.repMax)}</span>
        <Icon name="chevron" size={16} />
      </button>
    </div>
  );
}

export function SortableDayList({ slots, exMap, onOpen, onMove, fail }: {
  slots: Slot[]; exMap: Map<string, Exercise>; onOpen: (slot: Slot) => void; onMove: (from: number, to: number) => void; fail?: Map<string, string[]>;
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
        {shown.map((s, i) => <Row key={s.id} slot={s} ex={exMap.get(s.exerciseId)!} index={i} onOpen={() => onOpen(s)} fail={fail?.get(s.id)} />)}
      </SortableContext>
    </DndContext>
  );
}
