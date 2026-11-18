// What one workout day adds to the week, per muscle (Plan tab, view and edit mode).
import type { Exercise, Routine, RoutineDay, VolumeTarget } from "../../core/types";
import { muscleLabel } from "../../core/types";
import { formatTarget, planVolume } from "../../core/volume";
import { fmtNum } from "../../core/util";

/**
 * What this workout adds to the week: only the muscles it works, with its sets (indirect = ½) on top of the rest
 * of the week's planned sets, against the weekly target.
 */
export function DayVolume({ routine, day, exMap, targets }: { routine: Routine; day: RoutineDay; exMap: Map<string, Exercise>; targets: VolumeTarget[] }) {
  const dayVol = planVolume({ ...routine, days: [day] }, exMap).filter((v) => v.sets > 0).sort((a, b) => b.sets - a.sets);
  const week = new Map(planVolume(routine, exMap).map((v) => [v.group, v.sets]));
  const tmap = new Map(targets.map((t) => [t.group, t]));
  if (!dayVol.length) return null;
  return (
    <div className="glass" style={{ padding: "6px 14px" }}>
      {dayVol.map((v) => {
        const total = week.get(v.group) ?? v.sets, t = tmap.get(v.group);
        const scale = Math.max(total, t?.max ?? t?.min ?? 0, 1) * 1.1;
        const before = total - v.sets;
        return (
          <div key={v.group} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="spread" style={{ alignItems: "baseline" }}>
              <span style={{ fontWeight: 600 }}>{muscleLabel(v.group)}</span>
              <span className="mono" style={{ fontSize: 18, color: "var(--neon-ink)" }}>+{fmtNum(v.sets)} <span style={{ fontSize: 12 }}>sets</span></span>
            </div>
            <div className="vbar" style={{ marginTop: 7 }}>
              {t?.min != null && <div className="band" style={{ left: `${(t.min / scale) * 100}%`, width: `${(((t.max ?? scale) - t.min) / scale) * 100}%` }} />}
              <div className="fill none" style={{ width: `${(total / scale) * 100}%`, opacity: 0.45 }} />
              <div className="fill" style={{ left: `${(before / scale) * 100}%`, width: `${(v.sets / scale) * 100}%` }} />
            </div>
            <div className="muted mono" style={{ fontSize: 12, marginTop: 5 }}>{fmtNum(total)} a week{t && t.min != null ? ` · target ${formatTarget(t)}` : ""}</div>
          </div>
        );
      })}
      <p className="muted" style={{ fontSize: 12, padding: "10px 0 6px" }}>Bright = this workout · dim = the rest of the week · dashed = weekly target. Indirect sets count as half.</p>
    </div>
  );
}

