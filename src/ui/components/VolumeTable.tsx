// Sets per muscle vs weekly target as a grid of tiles (number, target, mini bar with the dashed target band, status mark).
// Skipped muscles collapse into one line. Tap a tile for days, angles and notes (and the target editor when editing).
import { formatTarget, targetStatus, type GroupTotals } from "../../core/volume";
import { completeProfile, MUSCLE_GROUPS, type MuscleGroup, type VolumeTarget } from "../../core/types";
import { fmtNum } from "../../core/util";
import { useState } from "react";
import { Seg, Stepper } from "./Controls";
import { defaultRange, freshTargets, priorityOf, type Priority } from "../../core/volumeModel";
import { useStore } from "../store";
import { Icon } from "./Icon";

const STATUS = {
  ok: { label: "✓", cls: "status-ok" },
  above: { label: "⚠ above", cls: "status-warn" },
  below: { label: "⚠ below", cls: "status-warn" },
  inProgress: { label: "in progress", cls: "status-progress" },
  off: { label: "", cls: "status-none" },
};
/** "skipped", plus the plan's reason when it has one */
const offNote = (note?: string) => {
  const why = note && !/tracked only/i.test(note) ? note.replace(/^by choice\s*/i, "").replace(/^\((.*)\)$/, "$1") : "";
  return "skipped" + (why ? ` · ${why}` : "");
};

/**
 * stillPlanned: groups a planned day later this week still works (live week only) → below target shows "in progress".
 * onEdit: makes rows tappable to change the target (min/max sets) and turn Priority, Normal or Skip.
 */
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

export function VolumeTable({ totals, targets, days, stillPlanned, onEdit }: { totals: GroupTotals; targets: VolumeTarget[]; days?: Record<string, number>; stillPlanned?: Set<MuscleGroup>; onEdit?: (t: VolumeTarget) => void }) {
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const [open, setOpen] = useState<MuscleGroup | null>(null);
  const toggle = (g: MuscleGroup) => setOpen(open === g ? null : g);
  const rows = MUSCLE_GROUPS.map((m) => {
    const t = tmap.get(m.id), v = totals[m.id];
    return { m, t, v, st: targetStatus(v, t, stillPlanned?.has(m.id)) };
  });
  const focus = rows.filter((r) => r.st !== "off"), skipped = rows.filter((r) => r.st === "off");
  /** The detail under a tile (full width): days · angles · note, and the target editor when editing */
  const detail = (r: (typeof rows)[number]) => {
    const note = r.st === "off" ? offNote(r.t?.note) : r.t?.gap;
    const bits = [days && `${days[r.m.id] ?? 0} day${days[r.m.id] === 1 ? "" : "s"}`, days && r.t?.angles, note].filter(Boolean);
    return (
      <div key={r.m.id + "-detail"} className="vt-detail">
        <div className="spread"><b>{r.m.label}</b><span className="mono">{fmtNum(r.v)}<span className="muted"> / {formatTarget(r.t)}</span></span></div>
        {bits.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{bits.join(" · ")}</div>}
        {onEdit && <TargetEdit group={r.m.id} label={r.m.label} t={r.t} current={r.v} onEdit={onEdit} />}
      </div>
    );
  };
  return (
    <div className="glass" style={{ padding: 10 }}>
      {/* Tiles, three per row; the open one's details span the row right under it (dense flow backfills the row) */}
      <div className="vt-grid">
        {focus.flatMap((r) => {
          const { m, t, v, st } = r, s = STATUS[st];
          const hi = Math.max(t?.max ?? (t?.min ?? 0) * 1.5, v, 1) * 1.15;
          const tile = (
            <button key={m.id} type="button" className={"vt-tile" + (open === m.id ? " open" : "") + (st === "above" || st === "below" ? " warn" : "")} onClick={() => toggle(m.id)} aria-expanded={open === m.id}>
              <span className="vt-top"><span className="vt-name" style={{ fontWeight: priorityOf(m.id, t) === "priority" ? 700 : 500 }}>{m.label}</span><span className={s.cls + " vt-mark"} title={s.label.replace("⚠ ", "")}>{MARK[st]}</span></span>
              <span className="vt-num"><span className="mono">{fmtNum(v)}</span><span className="mono muted">/{formatTarget(t)}</span></span>
              <span className="vbar vt-bar">
                {t?.min != null && <span className="band" style={{ left: `${(t.min / hi) * 100}%`, width: `${(((t.max ?? hi) - t.min) / hi) * 100}%` }} />}
                <span className={"fill" + (st === "ok" || st === "inProgress" ? "" : " warn")} style={{ width: `${Math.min(100, (v / hi) * 100)}%` }} />
              </span>
            </button>
          );
          return open === m.id ? [tile, detail(r)] : [tile];
        })}
      </div>
      {skipped.length > 0 && (
        <div className="vt-skipped">
          <span className="muted">Skipped</span>
          {skipped.map((r) => <button key={r.m.id} type="button" className={"vt-skip" + (open === r.m.id ? " open" : "")} onClick={() => toggle(r.m.id)} aria-expanded={open === r.m.id}>{r.m.label}{r.v > 0 ? ` ${fmtNum(r.v)}` : ""}</button>)}
          {skipped.filter((r) => r.m.id === open).map(detail)}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, padding: "10px 4px 2px" }}>{onEdit ? "" : "Tap a muscle for details. "}Indirect sets count as half. Warm-ups and drop sets don't count.</p>
    </div>
  );
}

/** Tile status mark: on target ✓, above ▲, below ▼, still to come this week … */
const MARK = { ok: "✓", above: "▲", below: "▼", inProgress: "…", off: "" } as const;

/** Change one muscle's weekly target: min/max sets and Priority · Normal · Skip.
 *  current: its sets a week now (seeds empty steppers). Used by the targets table and the week map's muscle card. */
export function TargetEdit({ group, label, t, current, onEdit }: {
  group: MuscleGroup; label: string; t?: VolumeTarget; current: number; onEdit: (t: VolumeTarget) => void;
}) {
  const edit = t ?? { group, min: null, max: null };
  const set = (p: Partial<VolumeTarget>) => onEdit({ ...edit, ...p });
  const prio = priorityOf(group, t), v = current;
  // This muscle's default: the training profile's numbers, else the muscle database's range; normal priority, not skipped
  const { settings } = useStore();
  const profile = completeProfile(settings.profile);
  const def = freshTargets(profile).find((x) => x.group === group)!;
  const isDefault = edit.min === def.min && edit.max === def.max && !edit.off && !edit.acceptedBelow && edit.priority == null;
  const reset = () => { const { off: _o, acceptedBelow: _a, priority: _p, ...rest } = edit; onEdit({ ...rest, min: def.min, max: def.max }); };
  return (
    <div className="vedit">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stepper label="Min sets" value={edit.min} step={1} decimals={false} empty={edit.max ?? Math.max(1, Math.round(v))}
          onChange={(x) => set({ min: x, max: x != null && edit.max != null && edit.max < x ? x : edit.max })} />
        <Stepper label="Max sets" value={edit.max} step={1} decimals={false} min={edit.min ?? 0} empty={(edit.min ?? Math.max(1, Math.round(v))) + 4}
          onChange={(x) => set({ max: x })} />
      </div>
      <div style={{ marginTop: 10 }}>
        <Seg label={`${label}: focus`} value={prio} onChange={(x: Priority) => onEdit(withPriority(edit, x, x === "off" ? edit : defaultRange(group, profile, x)))}
          options={[{ v: "priority", label: "Priority" }, { v: "normal", label: "Normal" }, { v: "off", label: "Skip" }]} />
        <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>{prio === "priority" ? "Aims for the top half of its range." : prio === "off" ? "Skipped: grayed out, no warnings. Your numbers are kept." : "Full range."}</p>
        {!isDefault && <button type="button" className="btn btn-quiet vedit-reset" onClick={reset}><Icon name="undo" size={16} /> Reset to default · {def.min == null ? "no target" : formatTarget(def)}</button>}
      </div>
    </div>
  );
}
