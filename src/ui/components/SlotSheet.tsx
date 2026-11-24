// One exercise of a plan day: sets, rest, reps, last set to failure, note, and its actions. Used by the Plan tab (saves
// at once) and the plan editor (changes the draft); only `onPatch` and the action callbacks differ.
import { tempoTiming } from "../../core/figure/tempo";
import { failureApplies, failureEligible } from "../../core/failure";
import type { Exercise, Goal, RoutineDay, Slot } from "../../core/types";
import { fmtRest } from "../format";
import { Seg, Stepper } from "./Controls";
import { Figure } from "./Figure";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

export function SlotSheet({ slot, day, ex, goal, failWhy, restDefault, onPatch, onToggleSuperset, onSwap, onHowTo, onRemove, onClose }: {
  slot: Slot | undefined; day: RoutineDay | undefined; ex: Exercise | undefined; goal: Goal | undefined;
  /** This week's failure reasons for the slot, if it gets one */
  failWhy?: string[]; restDefault: number;
  onPatch: (p: Partial<Slot>) => void; onToggleSuperset: () => void; onSwap: () => void; onHowTo: () => void; onRemove: () => void; onClose: () => void;
}) {
  const idx = slot && day ? day.slots.findIndex((s) => s.id === slot.id) : -1;
  const time = ex?.measure === "time";
  return (
    <Sheet open={!!slot} onClose={onClose} label="Exercise in plan">
      {slot && day && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row">
            <Figure spec={ex?.figure} size={54} timing={tempoTiming(ex?.tempo, slot.exerciseId)} />
            <h3 className="title-md grow">{ex?.name}</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Stepper label="Sets" value={slot.sets} step={1} decimals={false} min={1} onChange={(v) => onPatch({ sets: Math.max(1, Math.min(20, v ?? 1)) })} />
            <Stepper label="Rest" suffix={fmtRest(slot.restSec)} value={slot.restSec} step={15} decimals={false} onChange={(v) => onPatch({ restSec: v ?? restDefault })} />
            <Stepper label={time ? "Seconds min" : "Reps min"} value={slot.repMin} step={time ? 5 : 1} decimals={false} min={1} onChange={(v) => onPatch({ repMin: Math.max(1, v ?? 1), repMax: Math.max(slot.repMax, v ?? 1) })} />
            <Stepper label={time ? "Seconds max" : "Reps max"} value={slot.repMax} step={time ? 5 : 1} decimals={false} min={1} onChange={(v) => onPatch({ repMax: Math.max(slot.repMin, v ?? slot.repMin) })} />
          </div>
          {failureApplies(goal) && (() => {
            const mode = slot.toFailure === true ? "on" : slot.toFailure === false ? "off" : "auto";
            const safe = failureEligible(ex);
            return (
              <div>
                <span className="row" style={{ gap: 6, fontWeight: 600, marginBottom: 6 }}><span style={{ color: "var(--warn)", display: "inline-flex" }}><Icon name="flame" size={16} /></span>Last set to failure</span>
                <Seg label="Last set to failure" value={mode} onChange={(v) => onPatch({ toFailure: v === "auto" ? undefined : v === "on" })}
                  options={[{ v: "auto", label: "Auto" }, { v: "on", label: "On" }, { v: "off", label: "Off" }]} />
                <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>
                  {mode === "auto" ? (failWhy ? `This week: yes. ${failWhy.join(" · ")}.` : safe ? "The app picks it when it fits the workout and your week." : "Auto never picks this one (★ lift or not safe to fail).")
                    : mode === "on" ? "Always, every week." : "Never."}
                </p>
              </div>
            );
          })()}
          {!time && (
            <div>
              <span className="row" style={{ gap: 6, fontWeight: 600, marginBottom: 6 }}><span style={{ color: "var(--neon-2)", display: "inline-flex" }}><Icon name="down" size={16} /></span>Drop set after the last set</span>
              <Seg label="Drop set after the last set" value={slot.dropSet ? "on" : "off"} onChange={(v) => onPatch({ dropSet: v === "on" ? true : undefined })}
                options={[{ v: "off", label: "Off" }, { v: "on", label: "On" }]} />
              <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>
                {slot.supersetGroup ? "Not in a superset." : "Lighter, no rest, to failure. Counts ½ set. Saves time."}
              </p>
            </div>
          )}
          <div className="field"><label htmlFor="snote">Note</label>
            <input id="snote" className="input" value={slot.notes ?? ""} placeholder="e.g. elbows to hips" onChange={(e) => onPatch({ notes: e.target.value || undefined })} /></div>
          <div>
            {idx < day.slots.length - 1 && (
              <button className="menu-item" onClick={onToggleSuperset}>
                <Icon name="link" /> {slot.supersetGroup && slot.supersetGroup === day.slots[idx + 1]?.supersetGroup ? "Unlink from next (end superset)" : "Superset with next exercise"}
              </button>
            )}
            <button className="menu-item" onClick={onSwap}><Icon name="swap" /> Swap exercise</button>
            <button className="menu-item" onClick={onHowTo}><Icon name="info" /> How to do it</button>
            <button className="menu-item danger" onClick={() => { onClose(); onRemove(); }}><Icon name="trash" /> Remove from day</button>
          </div>
          <button className="btn btn-primary btn-block" onClick={onClose}>Done</button>
        </div>
      )}
    </Sheet>
  );
}
