// Sets per muscle vs weekly target, with neon bars and the target band.
import { formatTarget, targetStatus, type GroupTotals } from "../../core/volume";
import { MUSCLE_GROUPS, type VolumeTarget } from "../../core/types";
import { fmtNum } from "../../core/util";

const STATUS = {
  ok: { label: "✓", cls: "status-ok" },
  above: { label: "⚠ above", cls: "status-warn" },
  below: { label: "⚠ below", cls: "status-warn" },
  byChoice: { label: "⚠ by choice", cls: "status-warn" },
  none: { label: "", cls: "status-none" },
};

export function VolumeTable({ totals, targets, days, hideEmpty }: { totals: GroupTotals; targets: VolumeTarget[]; days?: Record<string, number>; hideEmpty?: boolean }) {
  const tmap = new Map(targets.map((t) => [t.group, t]));
  const scale = Math.max(24, ...MUSCLE_GROUPS.map((m) => totals[m.id]), ...targets.map((t) => t.max ?? t.min ?? 0));
  return (
    <div className="glass" style={{ padding: "6px 14px" }}>
      {MUSCLE_GROUPS.filter((m) => !hideEmpty || totals[m.id] > 0 || tmap.get(m.id)?.min != null).map((m) => {
        const t = tmap.get(m.id), v = totals[m.id], st = targetStatus(v, t), s = STATUS[st];
        const note = st === "none" ? t?.note ?? "tracked only" : st === "byChoice" ? t?.note?.replace(/^by choice\s*/, "") : t?.gap;
        return (
          <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="spread" style={{ alignItems: "baseline" }}>
              <span style={{ fontWeight: m.priority ? 600 : 400 }}>{m.label}</span>
              <span className="row" style={{ gap: 10 }}>
                <span className="mono" style={{ fontSize: 16 }}>{fmtNum(v)}<span className="muted" style={{ fontSize: 12 }}> / {formatTarget(t)}</span></span>
                <span className={s.cls} style={{ fontSize: 13, minWidth: 18, textAlign: "right" }}>{s.label}</span>
              </span>
            </div>
            <div className="vbar" style={{ marginTop: 7 }}>
              {t?.min != null && <div className="band" style={{ left: `${(t.min / scale) * 100}%`, width: `${(((t.max ?? scale) - t.min) / scale) * 100}%` }} />}
              <div className={"fill" + (st === "ok" ? "" : st === "none" ? " none" : " warn")} style={{ width: `${Math.min(100, (v / scale) * 100)}%` }} />
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
