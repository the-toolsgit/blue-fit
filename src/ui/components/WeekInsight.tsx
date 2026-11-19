// The whole week of a plan at a glance (Plan tab, view and edit mode): quick facts, the muscle map with a list per side
// (components/WeekMap.tsx), and the Week check (does the routine tick every box for the user's goal).
import type { Exercise, Routine, VolumeTarget } from "../../core/types";
import { weekInsight } from "../../core/workoutCheck";
import { useStore } from "../store";
import { FlexFigure } from "./FlexFigure";
import { WeekMap } from "./WeekMap";
import { Icon } from "./Icon";
import { Ring } from "./RestTimer";

export function WeekInsight({ routine, exMap, targets, failures }: {
  routine: Routine; exMap: Map<string, Exercise>; targets: VolumeTarget[]; failures: number;
}) {
  const { settings } = useStore();
  const i = weekInsight(routine, exMap, targets, settings.profile?.goal);
  if (!i.tiles.length) return null;
  const passed = i.checks.filter((c) => c.pass).length, all = passed === i.checks.length;
  return (
    <>
      <div className="insight-facts">
        {[[i.days, "workouts"], [i.sets, "sets"], [`~${i.minutes}`, "min each"], [failures, "to failure"]].map(([v, l]) => (
          <div key={l} className="insight-fact"><b className="mono">{v}</b><span>{l}</span></div>
        ))}
      </div>

      <WeekMap tiles={i.tiles} />
      <p className="muted" style={{ fontSize: 12, margin: "8px 4px 0" }}>Sets a week (indirect = ½) / target. Tap a muscle for its details.</p>

      <h2 className="section-title">Week check</h2>
      <div className={"glass insight-check" + (all ? " complete" : "")}>
        {all ? (
          <div className="insight-reward">
            <FlexFigure size={96} />
            <div>
              <div className="insight-reward-title">Complete week</div>
              <div className="muted" style={{ fontSize: 13 }}>Your routine ticks every box for your goal.</div>
            </div>
          </div>
        ) : (
          <div className="row" style={{ gap: 12, marginBottom: 4 }}>
            <div style={{ position: "relative", width: 56, height: 56, flex: "none" }}>
              <Ring frac={passed / i.checks.length} size={56} stroke={4} />
              <span className="mono" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 15 }}>{passed}/{i.checks.length}</span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>Tick every box for a complete week.</div>
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
