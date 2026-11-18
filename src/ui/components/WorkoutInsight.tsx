// A plan day at a glance (Plan tab, view and edit mode): quick facts, a tile per muscle with the week's total and the
// angles it hits, and the Workout check (does it tick every box for the user's goal).
import type { Exercise, Routine, RoutineDay, VolumeTarget } from "../../core/types";
import { muscleLabel } from "../../core/types";
import { formatTarget } from "../../core/volume";
import { fmtNum } from "../../core/util";
import { dayInsight } from "../../core/workoutCheck";
import { useStore } from "../store";
import { FlexFigure } from "./FlexFigure";
import { Icon } from "./Icon";
import { Ring } from "./RestTimer";

export function WorkoutInsight({ routine, day, exMap, targets, failures }: {
  routine: Routine; day: RoutineDay; exMap: Map<string, Exercise>; targets: VolumeTarget[]; failures: number;
}) {
  const { settings } = useStore();
  const i = dayInsight(routine, day, exMap, targets, settings.profile?.goal);
  if (!i.tiles.length) return null;
  const passed = i.checks.filter((c) => c.pass).length, all = passed === i.checks.length;
  return (
    <>
      <div className="insight-facts">
        {[[i.sets, "sets"], [`~${i.minutes}`, "min"], [failures, "to failure"], [i.muscles, i.muscles === 1 ? "muscle" : "muscles"]].map(([v, l]) => (
          <div key={l} className="insight-fact"><b className="mono">{v}</b><span>{l}</span></div>
        ))}
      </div>

      <div className="insight-tiles">
        {i.tiles.map((t) => (
          <div key={t.group} className={"insight-tile " + t.status}>
            <div className="spread" style={{ alignItems: "baseline" }}>
              <span className="insight-name">{muscleLabel(t.group)}</span>
              {t.status === "ok" && <span className="insight-ok"><Icon name="check" size={14} stroke={3} /></span>}
            </div>
            <div className="mono insight-sets">+{fmtNum(t.sets)}</div>
            <div className="muted mono" style={{ fontSize: 11 }}>
              {t.status === "off" ? `${fmtNum(t.week)} a week · skipped` : `week ${fmtNum(t.week)} · ${formatTarget(t.target)}`}
              {t.status === "below" && <span style={{ color: "var(--warn)" }}> · below</span>}
              {t.status === "above" && <span style={{ color: "var(--warn)" }}> · above</span>}
            </div>
            {t.angles.length > 1 && (
              <div className="insight-chips">
                {t.angles.map((a) => <span key={a.name} className={"insight-chip " + a.state}>{a.name}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: "8px 4px 0" }}>+ sets this workout adds (indirect = ½). Angles: bright = today, dim outline = another day this week, faded = not in the plan.</p>

      <h2 className="section-title">Workout check</h2>
      <div className={"glass insight-check" + (all ? " complete" : "")}>
        {all ? (
          <div className="insight-reward">
            <FlexFigure size={96} />
            <div>
              <div className="insight-reward-title">Complete workout</div>
              <div className="muted" style={{ fontSize: 13 }}>Every box ticked for your goal.</div>
            </div>
          </div>
        ) : (
          <div className="row" style={{ gap: 12, marginBottom: 4 }}>
            <div style={{ position: "relative", width: 56, height: 56, flex: "none" }}>
              <Ring frac={passed / i.checks.length} size={56} stroke={4} />
              <span className="mono" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 15 }}>{passed}/{i.checks.length}</span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>Tick every box for a complete workout.</div>
          </div>
        )}
        {i.checks.map((c) => (
          <div key={c.id} className={"insight-row" + (c.pass ? " pass" : "")}>
            <span className="insight-mark"><Icon name={c.pass ? "check" : "close"} size={14} stroke={3} /></span>
            <span className="grow">
              <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{c.label}</span>
              <span className="muted" style={{ fontSize: 12 }}>{c.detail}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
