// One muscle's weekly target editor (min/max sets, Priority · Normal · Skip, reset), used by the week map's muscle card
// and Build my plan. (Was VolumeTable.tsx, whose table of tiles is gone since Nov 22 2026: nothing showed it.)
import { formatTarget } from "../../core/volume";
import { completeProfile, type Goal, type MuscleGroup, type Phase, type TrainingProfile, type VolumeTarget } from "../../core/types";
import { Seg, Stepper } from "./Controls";
import { defaultRange, freshTargets, priorityOf, type Priority } from "../../core/volumeModel";
import { useStore } from "../store";
import { Icon } from "./Icon";

/** Set a target's focus level, storing only what differs from the app default (keeps saved data clean).
 *  Priority and Normal also set the range for that priority (Nov 21 2026: Priority needs more sets, so its range is
 *  narrower and higher): `range` is the default range for the chosen priority (volumeModel.defaultRange). Skip keeps
 *  the numbers. */
export function withPriority(t: VolumeTarget, p: Priority, range: { min: number | null; max: number | null }): VolumeTarget {
  const { off: _o, acceptedBelow: _a, priority: _p, ...rest } = t;
  if (p === "off") return { ...rest, ...(t.priority != null ? { priority: t.priority } : {}), off: true };
  const isDefault = priorityOf(t.group) === p;
  return { ...rest, min: range.min, max: range.max, ...(isDefault ? {} : { priority: p === "priority" }) };
}

/** Change one muscle's weekly target: min/max sets and Priority · Normal · Skip.
 *  current: its sets a week now (seeds empty steppers). Used by the targets table and the week map's muscle card. */
/** The three delt heads: tracked apart, but Priority / Normal / Skip is one Shoulders choice (Leo, Nov 21 2026) */
export const DELTS: MuscleGroup[] = ["frontDelts", "sideDelts", "rearDelts"];

/** Priority / Normal / Skip for all three delt heads, each to its own default range */
export function shouldersTo(targets: VolumeTarget[], p: Priority, profile: TrainingProfile | null, goal?: Goal): VolumeTarget[] {
  return DELTS.map((g) => {
    const t = targets.find((x) => x.group === g) ?? { group: g, min: null, max: null };
    return withPriority(t, p, p === "off" ? t : defaultRange(g, profile, p, goal));
  });
}

/** One muscle's target: Min / Max, Priority · Normal · Skip, Reset to default. For a delt head with `all` and
 *  `onEditAll`, the focus choice is "Shoulders" and sets all three heads. */
export function TargetEdit({ group, label, t, current, onEdit, all, onEditAll, hideFocus, answers }: {
  group: MuscleGroup; label: string; t?: VolumeTarget; current: number; onEdit: (t: VolumeTarget) => void;
  all?: VolumeTarget[]; onEditAll?: (ts: VolumeTarget[]) => void;
  /** The focus choice is shown elsewhere (Build my plan's Shoulders row): only Min / Max and reset */
  hideFocus?: boolean;
  /** Build my plan: the goal and eating it asked, used for the defaults instead of the saved profile's */
  answers?: { goal: Goal; phase: Phase };
}) {
  const edit = t ?? { group, min: null, max: null };
  const set = (p: Partial<VolumeTarget>) => onEdit({ ...edit, ...p });
  const prio = priorityOf(group, t), v = current;
  // This muscle's default: the training profile's numbers, else the muscle database's range; Normal, not skipped
  const { settings } = useStore();
  const profile = completeProfile(settings.profile && answers ? { ...settings.profile, ...answers } : settings.profile);
  const goal = answers?.goal ?? settings.profile?.goal ?? undefined;
  const def = freshTargets(profile, goal).find((x) => x.group === group)!;
  const isDefault0 = edit.min === def.min && edit.max === def.max && priorityOf(group, edit) === "normal";
  const shoulders = DELTS.includes(group) && !!all && !!onEditAll;
  const heads = shoulders ? DELTS.map((g) => priorityOf(g, all!.find((x) => x.group === g))) : [];
  const focusValue = (shoulders ? (heads.every((x) => x === heads[0]) ? heads[0] : "") : prio) as Priority;
  // A delt head keeps its Shoulders choice: reset only puts its range back to the default for that choice
  const keepPrio = (hideFocus || shoulders) && prio !== "off";
  const headDef = keepPrio ? defaultRange(group, profile, prio as Exclude<Priority, "off">, goal) : null;
  const resetTo = headDef ?? def;
  const isDefault = headDef ? edit.min === headDef.min && edit.max === headDef.max : isDefault0;
  const reset = () => {
    if (headDef) return onEdit({ ...edit, ...headDef });
    const { off: _o, acceptedBelow: _a, priority: _p, ...rest } = edit; onEdit({ ...rest, min: def.min, max: def.max, ...(def.priority != null ? { priority: def.priority } : {}) });
  };
  return (
    <div className="vedit">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stepper label="Min sets" value={edit.min} step={1} decimals={false} empty={edit.max ?? Math.max(1, Math.round(v))}
          onChange={(x) => set({ min: x, max: x != null && edit.max != null && edit.max < x ? x : edit.max })} />
        <Stepper label="Max sets" value={edit.max} step={1} decimals={false} min={edit.min ?? 0} empty={(edit.min ?? Math.max(1, Math.round(v))) + 4}
          onChange={(x) => set({ max: x })} />
      </div>
      <div style={{ marginTop: 10 }}>
        {!hideFocus && <>
        {shoulders && <span className="vedit-label">Shoulders (all 3 heads)</span>}
        <Seg label={`${shoulders ? "Shoulders" : label}: focus`} value={focusValue}
          onChange={(x: Priority) => (shoulders ? onEditAll!(shouldersTo(all!, x, profile, goal)) : onEdit(withPriority(edit, x, x === "off" ? edit : defaultRange(group, profile, x, goal))))}
          options={[{ v: "priority", label: "Priority" }, { v: "normal", label: "Normal" }, { v: "off", label: "Skip" }]} />
        <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>{shoulders && !focusValue ? "The three heads differ: pick one choice for all of them." : focusValue === "priority" ? "Upper half of the usual range: more sets to grow it faster." : focusValue === "off" ? "Skipped: grayed out, no warnings. Your numbers are kept." : "Lower half of the usual range: enough to grow."}</p>
        </>}
        {!isDefault && <button type="button" className="btn btn-quiet vedit-reset" onClick={reset}><Icon name="undo" size={16} /> Reset to default · {resetTo.min == null ? "no target" : formatTarget(resetTo as VolumeTarget)}</button>}
      </div>
    </div>
  );
}

/** Long press on a muscle row: Skip it, or bring a skipped one back as Normal (its default range). A delt head turns all
 *  three Shoulders heads (one choice for them). Returns the changed targets. */
export function toggleSkip(targets: VolumeTarget[], g: MuscleGroup, profile: TrainingProfile | null, goal?: Goal): VolumeTarget[] {
  const t = targets.find((x) => x.group === g) ?? { group: g, min: null, max: null };
  const next: Priority = priorityOf(g, t) === "off" ? "normal" : "off";
  if (DELTS.includes(g)) return shouldersTo(targets, next, profile, goal);
  return [withPriority(t, next, next === "off" ? t : defaultRange(g, profile, next, goal))];
}
