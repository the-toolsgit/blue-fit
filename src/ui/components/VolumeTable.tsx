// Sets per muscle vs weekly target, with neon bars and the target band (dashed). Muscles that aren't a focus are grayed with a striped bar.
import { formatTarget, targetStatus, type GroupTotals } from "../../core/volume";
import { MUSCLE_GROUPS, type MuscleGroup, type VolumeTarget } from "../../core/types";
import { fmtNum } from "../../core/util";
import { useState } from "react";
import { Stepper, Switch } from "./Controls";
import { Icon } from "./Icon";

const STATUS = {
  ok: { label: "✓", cls: "status-ok" },
  above: { label: "⚠ above", cls: "status-warn" },
  below: { label: "⚠ below", cls: "status-warn" },
  inProgress: { label: "in progress", cls: "status-progress" },
  off: { label: "", cls: "status-none" },
};
/** "not a focus", plus the plan's reason when it has one */
const offNote = (note?: string) => {
  const why = note && !/tracked only/i.test(note) ? note.replace(/^by choice\s*/i, "").replace(/^\((.*)\)$/, "$1") : "";
  return "not a focus" + (why ? ` · ${why}` : "");
};

/**
 * stillPlanned: groups a planned day later this week still works (live week only) → below target shows "in progress".
 * onEdit: makes rows tappable to change the target (min/max sets) and turn "Not a focus" on or off.
 */
export function VolumeTable({ totals, targets, days, stillPlanned, onEdit }: { totals: GroupTotals; targets: VolumeTarget[]; days?: Record<string, number>; stillPlanned?: Set<MuscleGroup>; onEdit?: (t: VolumeTarget) => void }) {
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const [open, setOpen] = useState<MuscleGroup | null>(null);
  const scale = Math.max(24, ...MUSCLE_GROUPS.map((m) => totals[m.id]), ...targets.map((t) => t.max ?? t.min ?? 0));
  return (
    <div className="glass" style={{ padding: "6px 14px" }}>
      {MUSCLE_GROUPS.map((m) => {
        const t = tmap.get(m.id), v = totals[m.id], st = targetStatus(v, t, stillPlanned?.has(m.id)), s = STATUS[st];
        const off = st === "off";
        const note = off ? offNote(t?.note) : t?.gap;
        const edit = t ?? { group: m.id, min: null, max: null };
        const isOpen = onEdit && open === m.id;
        const set = (p: Partial<VolumeTarget>) => onEdit?.({ ...edit, ...p });
        return (
          <div key={m.id} className={off ? "vrow off" : "vrow"} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="spread" style={{ alignItems: "baseline", cursor: onEdit ? "pointer" : undefined }} onClick={onEdit ? () => setOpen(isOpen ? null : m.id) : undefined}
              role={onEdit ? "button" : undefined} aria-expanded={onEdit ? !!isOpen : undefined} tabIndex={onEdit ? 0 : undefined}
              onKeyDown={onEdit ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(isOpen ? null : m.id); } } : undefined}>
              <span className="row" style={{ gap: 6, fontWeight: m.priority ? 600 : 400 }}>{m.label}{onEdit && <span className="muted" style={{ display: "inline-flex", transform: isOpen ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform .25s var(--ease)" }}><Icon name="chevron" size={16} /></span>}</span>
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
            {isOpen && (
              <div className="vedit">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Stepper label="Min sets" value={edit.min} step={1} decimals={false} empty={edit.max ?? Math.max(1, Math.round(v))}
                    onChange={(x) => set({ min: x, max: x != null && edit.max != null && edit.max < x ? x : edit.max })} />
                  <Stepper label="Max sets" value={edit.max} step={1} decimals={false} min={edit.min ?? 0} empty={(edit.min ?? Math.max(1, Math.round(v))) + 4}
                    onChange={(x) => set({ max: x })} />
                </div>
                <p className="muted" style={{ fontSize: 12, margin: "6px 2px 0" }}>Weekly sets. Leave max empty for no upper limit.</p>
                <div className="spread" style={{ marginTop: 6, minHeight: 44 }}>
                  <span>Not a focus <span className="muted" style={{ fontSize: 12 }}>· grayed, no warnings</span></span>
                  <Switch label={`${m.label}: not a focus`} checked={!!(edit.off || edit.acceptedBelow)}
                    onChange={(x) => {
                      if (x) return set({ off: true });
                      // Back to a focus: drop the not-a-focus flags (keeps the saved data clean) and give it a minimum if it had none
                      const { off: _o, acceptedBelow: _a, ...rest } = edit;
                      onEdit?.({ ...rest, min: edit.min ?? Math.max(1, Math.round(v)) });
                    }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
      <p className="muted" style={{ fontSize: 12, padding: "10px 0 6px" }}>Indirect sets count as half. Warm-ups and drop sets don't count.</p>
    </div>
  );
}
