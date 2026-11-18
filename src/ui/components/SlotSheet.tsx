// The "exercise in plan" sheet: sets, rest, reps, failure, note, superset, swap, how to do it, remove.
// Used by the Plan tab (saves at once) and the plan editor (edits the draft).
import { removeSlot, toggleSlotSuperset, updateSlot } from "../../core/routineEdit";
import { failureApplies, failureEligible } from "../../core/failure";
import { tempoTiming } from "../../core/figure/tempo";
import type { Exercise, Routine, RoutineDay, Settings } from "../../core/types";
import { fmtRest } from "../format";
import { Seg, Stepper } from "./Controls";
import { Figure } from "./Figure";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

export function SlotSheet({ routine, day, slotId, exMap, settings, why, onChange, onClose, onSwap, onHowTo }: {
  routine: Routine; day?: RoutineDay; slotId: string | null; exMap: Map<string, Exercise>; settings: Settings;
  /** This week's failure reasons for the slot (Auto). */ why?: string[];
  onChange: (r: Routine) => void; onClose: () => void; onSwap: (slotId: string) => void; onHowTo: (exerciseId: string) => void;
}) {
  const slot = day?.slots.find((s) => s.id === slotId);
  const slotIdx = day?.slots.findIndex((s) => s.id === slotId) ?? -1;
  const ex = slot ? exMap.get(slot.exerciseId) : undefined;
  return (
    <Sheet open={!!slot} onClose={onClose} label="Exercise in plan">
      {slot && day && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row">
            <Figure spec={ex?.figure} size={54} timing={tempoTiming(ex?.tempo, slot.exerciseId)} />
            <h3 className="title-md grow">{ex?.name}</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Stepper label="Sets" value={slot.sets} step={1} decimals={false} min={1} onChange={(v) => onChange(updateSlot(routine, day.id, slot.id, { sets: Math.max(1, Math.min(20, v ?? 1)) }))} />
            <Stepper label="Rest" suffix={fmtRest(slot.restSec)} value={slot.restSec} step={15} decimals={false} onChange={(v) => onChange(updateSlot(routine, day.id, slot.id, { restSec: v ?? settings.restDefaultSec }))} />
            <Stepper label="Reps min" value={slot.repMin} step={1} decimals={false} min={1} onChange={(v) => onChange(updateSlot(routine, day.id, slot.id, { repMin: Math.max(1, v ?? 1), repMax: Math.max(slot.repMax, v ?? 1) }))} />
            <Stepper label="Reps max" value={slot.repMax} step={1} decimals={false} min={1} onChange={(v) => onChange(updateSlot(routine, day.id, slot.id, { repMax: Math.max(slot.repMin, v ?? slot.repMin) }))} />
          </div>
          {failureApplies(settings.profile?.goal) && (() => {
            const mode = slot.toFailure === true ? "on" : slot.toFailure === false ? "off" : "auto";
            const safe = failureEligible(ex);
            return (
              <div>
                <span className="row" style={{ gap: 6, fontWeight: 600, marginBottom: 6 }}><span style={{ color: "var(--warn)", display: "inline-flex" }}><Icon name="flame" size={16} /></span>Last set to failure</span>
                <Seg label="Last set to failure" value={mode} onChange={(v) => onChange(updateSlot(routine, day.id, slot.id, { toFailure: v === "auto" ? undefined : v === "on" }))}
                  options={[{ v: "auto", label: "Auto" }, { v: "on", label: "On" }, { v: "off", label: "Off" }]} />
                <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>
                  {mode === "auto" ? (why ? `This week: yes. ${why.join(" · ")}.` : safe ? "The app picks it when it fits the workout and your week." : "Auto never picks this one (★ lift or not safe to fail).")
                    : mode === "on" ? "Always, every week." : "Never."}
                </p>
              </div>
            );
          })()}
          <div className="field"><label htmlFor="snote">Note</label>
            <input id="snote" className="input" value={slot.notes ?? ""} placeholder="e.g. elbows to hips" onChange={(e) => onChange(updateSlot(routine, day.id, slot.id, { notes: e.target.value || undefined }))} /></div>
          <div>
            {slotIdx < day.slots.length - 1 && (
              <button className="menu-item" onClick={() => onChange(toggleSlotSuperset(routine, day.id, slot.id))}>
                <Icon name="link" /> {slot.supersetGroup && slot.supersetGroup === day.slots[slotIdx + 1]?.supersetGroup ? "Unlink from next (end superset)" : "Superset with next exercise"}
              </button>
            )}
            <button className="menu-item" onClick={() => onSwap(slot.id)}><Icon name="swap" /> Swap exercise</button>
            <button className="menu-item" onClick={() => onHowTo(slot.exerciseId)}><Icon name="info" /> How to do it</button>
            <button className="menu-item danger" onClick={() => { onChange(removeSlot(routine, day.id, slot.id)); onClose(); }}><Icon name="trash" /> Remove from day</button>
          </div>
          <button className="btn btn-primary btn-block" onClick={onClose}>Done</button>
        </div>
      )}
    </Sheet>
  );
}
