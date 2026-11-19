// The whole week of a plan at a glance (Plan tab, view and edit mode): quick facts, the muscle map with a list per side
// (components/WeekMap.tsx), and the Week check (does the routine tick every box for the user's goal).
import type { Exercise, Routine, VolumeTarget } from "../../core/types";
import { weekInsight } from "../../core/workoutCheck";
import { failureApplies, failureEligible, mainMuscle } from "../../core/failure";
import { fmtNum } from "../../core/util";
import type { MuscleGroup } from "../../core/types";
import { useState } from "react";
import { useStore } from "../store";
import { FlexFigure } from "./FlexFigure";
import { WeekMap } from "./WeekMap";
import { Icon } from "./Icon";
import { Ring } from "./RestTimer";

export function WeekInsight({ routine, exMap, targets, weekFail }: {
  routine: Routine; exMap: Map<string, Exercise>; targets: VolumeTarget[];
  /** This week's failure picks (dayId → slotId → reasons) */
  weekFail: Map<string, Map<string, string[]>>;
}) {
  const { settings } = useStore();
  const [showScore, setShowScore] = useState(false);
  // Muscles that get a failure set this week, for the score
  const failMuscles = new Set<MuscleGroup>();
  for (const [dayId, m] of weekFail) for (const slotId of m.keys()) {
    const g = mainMuscle(exMap.get(routine.days.find((d) => d.id === dayId)?.slots.find((sl) => sl.id === slotId)?.exerciseId ?? ""));
    if (g) failMuscles.add(g);
  }
  const i = weekInsight(routine, exMap, targets, settings.profile?.goal,
    { muscles: failMuscles, eligible: failureEligible, applies: failureApplies(settings.profile?.goal) });
  if (!i.tiles.length) return null;
  const passed = i.checks.filter((c) => c.pass).length, all = passed === i.checks.length;
  return (
    <>
      <div className="insight-facts">
        {[[i.days, "workouts"], [i.sets, "sets"], [`~${i.minutes}`, "min each"]].map(([v, l]) => (
          <div key={l} className="insight-fact"><b className="mono">{v}</b><span>{l}</span></div>
        ))}
        <button type="button" className="insight-fact insight-score" onClick={() => setShowScore((v) => !v)} aria-expanded={showScore}>
          <b className="mono" style={{ color: scoreColor(i.score.score) }}>{i.score.score}</b><span>score</span>
        </button>
      </div>
      {showScore && (
        <div className="glass score-card">
          {i.score.parts.map((p) => (
            <div key={p.id} className="score-row">
              <span className="grow"><b>{p.label}</b><br /><span className="muted">{p.note}</span></span>
              <span className="mono" style={{ color: p.points < 0 ? "var(--bad)" : p.points >= p.max ? "var(--good)" : "var(--ink)" }}>
                {p.max ? `${fmtNum(p.points)}/${p.max}` : p.points < 0 ? fmtNum(p.points) : "0"}
              </span>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>Every plan starts at 20. The rest is earned.</p>
        </div>
      )}

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

/** Score color: red under 50, amber under 75, green from 75 (*judgment*) */
const scoreColor = (n: number) => (n >= 75 ? "var(--good)" : n >= 50 ? "var(--warn)" : "var(--bad)");
