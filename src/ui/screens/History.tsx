import { FLEX } from "../../core/figure/poses";
import { durationMin } from "../../core/session";
import { tonnage } from "../../core/volume";
import { localDate, weekStart } from "../../core/util";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { fmtDate, fmtVolume } from "../format";
import { go } from "../router";
import { useStore } from "../store";

export function HistoryScreen() {
  const { finished } = useStore();
  const thisWeek = weekStart(localDate(new Date()));
  const groups = new Map<string, typeof finished>();
  for (const s of finished) { const w = weekStart(s.date); groups.set(w, [...(groups.get(w) ?? []), s]); }
  return (
    <div className="page">
      <span className="eyebrow">History</span>
      <h1 className="title-lg" style={{ marginTop: 6 }}>Workouts</h1>
      {!finished.length && (
        <div className="empty"><Figure spec={FLEX} size={130} /><p>No workouts yet. Finish one and it shows up here.</p></div>
      )}
      {[...groups].map(([w, list]) => (
        <section key={w}>
          <h2 className="section-title">{w === thisWeek ? "This week" : `Week of ${fmtDate(w, { month: "short", day: "numeric" })}`} · {list.length}</h2>
          <div className="glass" style={{ padding: 4 }}>
            {list.map((s) => (
              <button key={s.id} className="list-row" onClick={() => go(`summary/${s.id}`)}>
                <span style={{ width: 44, textAlign: "center" }}>
                  <span className="eyebrow" style={{ fontSize: 10, display: "block" }}>{fmtDate(s.date, { weekday: "short" })}</span>
                  <span className="mono" style={{ fontSize: 20 }}>{Number(s.date.slice(8))}</span>
                </span>
                <span className="grow">
                  <span style={{ display: "block", fontWeight: 600 }}>{s.title}</span>
                  <span className="muted mono" style={{ fontSize: 12 }}>{durationMin(s)} min · {s.entries.reduce((a, e) => a + e.sets.length, 0)} sets · {fmtVolume(tonnage([s]))} lb</span>
                </span>
                <Icon name="chevron" size={18} />
              </button>
            ))}
          </div>
        </section>
      ))}
      {finished.length > 0 && <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 18 }}>Calendar, streaks and editing past workouts arrive in Phase 2.</p>}
    </div>
  );
}
