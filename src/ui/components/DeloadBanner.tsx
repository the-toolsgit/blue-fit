// Deload suggestion on Today: the app suggests, the user decides. (Native app: becomes a notification.)
import { REST } from "../../core/figure/poses";
import { DELOAD, deloadWeek, type DeloadSuggestion } from "../../core/deload";
import { fmtDate } from "../format";
import { useStore } from "../store";
import { Figure } from "./Figure";

export const DELOAD_RULE = `Half the sets, 10% lighter, stop every set with ${DELOAD.repsLeft} reps left. Same days and exercises.`;

export function DeloadBanner({ suggestion, today }: { suggestion: DeloadSuggestion; today: string }) {
  const { settings, saveSettings, toast } = useStore();
  const week = deloadWeek(today, settings.weekStartDay);
  const why = suggestion.reason === "interval"
    ? `It's been ${suggestion.weeks} weeks since ${settings.deload ? "your last deload" : "your first logged workout"}.`
    : `${suggestion.stalled} of your ${suggestion.judged} ★ lifts haven't gone up in ${DELOAD.stallWeeks} weeks.`;
  return (
    <section className="glass edge" role="status" style={{ padding: 16, marginBottom: 12, borderColor: "color-mix(in srgb, var(--neon-2) 50%, transparent)", boxShadow: "0 0 40px -18px var(--neon-2)" }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
        <div className="fig-stage" style={{ flex: "none" }}><Figure spec={REST} size={70} speed={0.5} /></div>
        <div className="grow">
          <span className="eyebrow" style={{ color: "var(--neon-2)" }}>Suggestion</span>
          <h2 className="title-md" style={{ textTransform: "uppercase", marginTop: 4 }}>Time for a deload?</h2>
          <p style={{ fontSize: 14, marginTop: 6 }}>{why}</p>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{DELOAD_RULE} Until {fmtDate(week.end, { weekday: "long" })}.</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => { saveSettings({ ...settings, deload: week, deloadDismissedAt: null }); toast({ kind: "info", title: "Deload week on", body: `Back to normal after ${fmtDate(week.end, { weekday: "long" })}.` }); }}>Deload this week</button>
        <button className="btn btn-ghost" onClick={() => saveSettings({ ...settings, deloadDismissedAt: today })}>Not now</button>
      </div>
    </section>
  );
}
