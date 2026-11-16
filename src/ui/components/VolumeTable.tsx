// Sets per muscle vs weekly target, with neon bars and the target band (dashed). Muscles that aren't a focus are grayed with a striped bar.
import { formatTarget, targetStatus, type GroupTotals } from "../../core/volume";
import { MUSCLE_GROUPS, type MuscleGroup, type VolumeTarget } from "../../core/types";
import { fmtNum } from "../../core/util";

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

/** stillPlanned: groups a planned day later this week still works (live week only) → below target shows "in progress". */
export function VolumeTable({ totals, targets, days, stillPlanned }: { totals: GroupTotals; targets: VolumeTarget[]; days?: Record<string, number>; stillPlanned?: Set<MuscleGroup> }) {
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const scale = Math.max(24, ...MUSCLE_GROUPS.map((m) => totals[m.id]), ...targets.map((t) => t.max ?? t.min ?? 0));
  return (
    <div className="glass" style={{ padding: "6px 14px" }}>
      {MUSCLE_GROUPS.map((m) => {
        const t = tmap.get(m.id), v = totals[m.id], st = targetStatus(v, t, stillPlanned?.has(m.id)), s = STATUS[st];
        const off = st === "off";
        const note = off ? offNote(t?.note) : t?.gap;
        return (
          <div key={m.id} className={off ? "vrow off" : "vrow"} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="spread" style={{ alignItems: "baseline" }}>
              <span style={{ fontWeight: m.priority ? 600 : 400 }}>{m.label}</span>
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
          </div>
        );
      })}
      <p className="muted" style={{ fontSize: 12, padding: "10px 0 6px" }}>Indirect sets count as half. Warm-ups and drop sets don't count.</p>
    </div>
  );
}
