// Sets per muscle vs weekly target, with neon bars and the target band (dashed). Muscles that aren't a focus are grayed with a striped bar.
import { formatTarget, targetStatus, type GroupTotals } from "../../core/volume";
import { MUSCLE_GROUPS, type MuscleGroup, type VolumeTarget } from "../../core/types";
import { fmtNum } from "../../core/util";
import { useState } from "react";
import { Seg, Stepper } from "./Controls";
import { priorityOf, type ModelTarget, type Priority } from "../../core/volumeModel";
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
/** Set a target's focus level, storing only what differs from the app default (keeps saved data clean). */
export function withPriority(t: VolumeTarget, p: Priority, fallbackMin: number): VolumeTarget {
  const { off: _o, acceptedBelow: _a, priority: _p, ...rest } = t;
  if (p === "off") return { ...rest, ...(t.priority != null ? { priority: t.priority } : {}), off: true };
  const isDefault = priorityOf(t.group) === p;
  return { ...rest, min: t.min ?? fallbackMin, ...(isDefault ? {} : { priority: p === "priority" }) };
}

/** defaults: the model's suggestion per muscle (shown in the edit panel with its reasons). */
export function VolumeTable({ totals, targets, days, stillPlanned, onEdit, defaults }: { totals: GroupTotals; targets: VolumeTarget[]; days?: Record<string, number>; stillPlanned?: Set<MuscleGroup>; onEdit?: (t: VolumeTarget) => void; defaults?: Map<MuscleGroup, ModelTarget> }) {
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const [open, setOpen] = useState<MuscleGroup | null>(null);
  const scale = Math.max(24, ...MUSCLE_GROUPS.map((m) => totals[m.id]), ...targets.map((t) => t.max ?? t.min ?? 0));
  return (
    <div className="glass" style={{ padding: "6px 14px" }}>
      {MUSCLE_GROUPS.map((m) => {
        const t = tmap.get(m.id), v = totals[m.id], st = targetStatus(v, t, stillPlanned?.has(m.id)), s = STATUS[st];
        const off = st === "off";
        const note = off ? offNote(t?.note) : t?.gap;
        const isOpen = onEdit && open === m.id;
        const def = defaults?.get(m.id);
        return (
          <div key={m.id} className={off ? "vrow off" : "vrow"} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="spread" style={{ alignItems: "baseline", cursor: onEdit ? "pointer" : undefined }} onClick={onEdit ? () => setOpen(isOpen ? null : m.id) : undefined}
              role={onEdit ? "button" : undefined} aria-expanded={onEdit ? !!isOpen : undefined} tabIndex={onEdit ? 0 : undefined}
              onKeyDown={onEdit ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(isOpen ? null : m.id); } } : undefined}>
              <span className="row" style={{ gap: 6, fontWeight: priorityOf(m.id, t) === "priority" ? 600 : 400 }}>{m.label}{onEdit && <span className="muted" style={{ display: "inline-flex", transform: isOpen ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .25s var(--ease)" }}><Icon name="chevron" size={16} /></span>}</span>
              <span className="row" style={{ gap: 10 }}>
                <span className="mono" style={{ fontSize: 16 }}>{fmtNum(v)}<span className="muted" style={{ fontSize: 12 }}> / {formatTarget(t)}</span></span>
                <span className={s.cls} style={{ fontSize: 13, minWidth: 18, textAlign: "right" }}>{s.label}</span>
              </span>
            </div>
            <div className={off ? "vbar off" : "vbar"} style={{ marginTop: 7 }}>
              {!off && t?.min != null && <div className="band" style={{ left: `${(t.min / scale) * 100}%`, width: `${(((t.max ?? scale) - t.min) / scale) * 100}%` }} />}
              <div className={"fill" + (st === "ok" || st === "inProgress" ? "" : off ? " none" : " warn")} style={{ width: `${Math.min(100, (v / scale) * 100)}%` }} />
            </div>
            {(note || days) && (
              <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
                {days && `${days[m.id] ?? 0} day${days[m.id] === 1 ? "" : "s"}`}{days && t?.angles ? ` · ${t.angles}` : ""}{note ? `${days ? " · " : ""}${note}` : ""}
              </div>
            )}
            {isOpen && <TargetEdit group={m.id} label={m.label} t={t} current={v} def={def} onEdit={onEdit!} />}
          </div>
        );
      })}
      <p className="muted" style={{ fontSize: 12, padding: "10px 0 6px" }}>Indirect sets count as half. Warm-ups and drop sets don't count.</p>
    </div>
  );
}

/** Change one muscle's weekly target: min/max sets, Priority · Normal · Skip, and the suggestion from the training profile.
 *  current: its sets a week now (seeds empty steppers). Used by the targets table and the week map's muscle card. */
export function TargetEdit({ group, label, t, current, def, onEdit }: {
  group: MuscleGroup; label: string; t?: VolumeTarget; current: number; def?: ModelTarget; onEdit: (t: VolumeTarget) => void;
}) {
  const edit = t ?? { group, min: null, max: null };
  const set = (p: Partial<VolumeTarget>) => onEdit({ ...edit, ...p });
  const prio = priorityOf(group, t), v = current;
  return (
    <div className="vedit">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stepper label="Min sets" value={edit.min} step={1} decimals={false} empty={edit.max ?? Math.max(1, Math.round(v))}
          onChange={(x) => set({ min: x, max: x != null && edit.max != null && edit.max < x ? x : edit.max })} />
        <Stepper label="Max sets" value={edit.max} step={1} decimals={false} min={edit.min ?? 0} empty={(edit.min ?? Math.max(1, Math.round(v))) + 4}
          onChange={(x) => set({ max: x })} />
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>Weekly sets. Leave max empty for no upper limit.</p>
      <div style={{ marginTop: 10 }}>
        <Seg label={`${label}: focus`} value={prio} onChange={(x: Priority) => onEdit(withPriority(edit, x, Math.max(1, Math.round(v))))}
          options={[{ v: "priority", label: "Priority" }, { v: "normal", label: "Normal" }, { v: "off", label: "Skip" }]} />
        <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>{prio === "priority" ? "Aims for the top half of its range." : prio === "off" ? "Skipped: grayed out, no warnings. Your numbers are kept." : "Full range."}</p>
      </div>
      {def && (
        <div className="vdefault">
          <div className="spread"><span className="eyebrow">Suggested for you</span><span className="mono">{def.min}–{def.max}</span></div>
          <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>{def.why.join(" · ")}</p>
          {(def.min !== edit.min || def.max !== edit.max) && <button className="btn btn-quiet" style={{ minHeight: 40, padding: 0, fontSize: 14 }} onClick={() => set({ min: def.min, max: def.max })}>Use {def.min}–{def.max}</button>}
        </div>
      )}
    </div>
  );
}
