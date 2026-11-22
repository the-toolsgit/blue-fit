// The whole week of a plan at a glance (Plan tab, view and edit mode): quick facts, the muscle map with a list per side
// (components/WeekMap.tsx), and the Week check (does the routine tick every box for the user's goal).
import type { Exercise, Routine, VolumeTarget } from "../../core/types";
import { weekInsight, type CheckId } from "../../core/workoutCheck";
import { failureApplies, failureEligible, mainMuscle } from "../../core/failure";
import type { MuscleGroup } from "../../core/types";
import { useStore } from "../store";
import { FlexFigure } from "./FlexFigure";
import { WeekMap, type TargetEditing } from "./WeekMap";
import { Icon } from "./Icon";
import { Ring } from "./RestTimer";

export function WeekInsight({ routine, exMap, targets, weekFail, edit }: {
  /** Plan tab: change a muscle's target from its card */
  edit?: TargetEditing;
  routine: Routine; exMap: Map<string, Exercise>; targets: VolumeTarget[];
  /** This week's failure picks (dayId → slotId → reasons) */
  weekFail: Map<string, Map<string, string[]>>;
}) {
  const { settings } = useStore();
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
        <div className="insight-fact insight-score"><b className="mono" style={{ color: scoreColor(i.score.score) }}>{i.score.score}</b><span>score</span></div>
      </div>

      <WeekMap tiles={i.tiles} routine={routine} exMap={exMap} edit={edit} />
      <p className="muted" style={{ fontSize: 12, margin: "8px 4px 0" }}>Sets a week (indirect = ½) / target. Tap a muscle for its details.</p>

      <h2 className="section-title">Plan check</h2>
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
            <div className="muted" style={{ fontSize: 13 }}>Tick every box for a complete plan.</div>
          </div>
        )}
        {/* Tiles: what's missing first (full width, with the details), then what's done (two per row) */}
        <div className="check-grid">
          {[...i.checks].sort((a, b) => rank(a) - rank(b)).map((c) => (
            <div key={c.id} className={"check-tile" + (c.pass ? " pass" : c.warn ? " fail warn" : " fail")}>
              <span className="check-head">
                <span className="check-ic"><Icon name={CHECK_ICON[c.id]} size={16} /></span>
                <span className="check-label">{c.label}</span>
              </span>
              {c.pass ? <span className="check-detail">{c.detail}</span> : (
                <span className="check-issues">
                  <span className="check-detail"><b>{c.warn ? "Tip:" : "Rule:"}</b> {c.rule}</span>
                  {c.issues.map((x, k) => <span key={k} className="check-issue">{x.who && <b>{x.who}</b>}<span>{x.what}</span></span>)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** Tile order: red misses, then yellow warnings, then passed */
const rank = (c: { pass: boolean; warn?: boolean }) => (c.pass ? 2 : c.warn ? 1 : 0);

/** An icon for each check (Plan check tiles) */
const CHECK_ICON: Record<CheckId, string> = {
  volume: "bars", jobs: "body", stretch: "stretch", frequency: "history", dose: "layers",
  recovery: "moon", reps: "repeat", mix: "today", rest: "timer", heavy: "bolt",
};

/** Score color: red under 50, amber under 75, green from 75 (*judgment*) */
const scoreColor = (n: number) => (n >= 75 ? "var(--good)" : n >= 50 ? "var(--warn)" : "var(--bad)");
