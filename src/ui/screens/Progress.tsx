import { useMemo } from "react";
import { LOADING } from "../../core/figure/poses";
import { sessionsVolume, tonnage } from "../../core/volume";
import { localDate, weekStart } from "../../core/util";
import { Figure } from "../components/Figure";
import { VolumeTable } from "../components/VolumeTable";
import { fmtVolume } from "../format";
import { useStore } from "../store";

export function ProgressScreen() {
  const { finished, exMap, targets } = useStore();
  const ws = weekStart(localDate(new Date()));
  const week = useMemo(() => finished.filter((s) => weekStart(s.date) === ws), [finished, ws]);
  const totals = useMemo(() => sessionsVolume(week, exMap), [week, exMap]);
  return (
    <div className="page">
      <span className="eyebrow">Progress</span>
      <h1 className="title-lg" style={{ marginTop: 6 }}>This week</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <div className="glass edge" style={{ padding: 14, borderRadius: 18 }}><div className="mono neon" style={{ fontSize: 28 }}>{week.length}<span className="muted" style={{ fontSize: 14 }}> / 6</span></div><div className="eyebrow" style={{ fontSize: 10 }}>workouts</div></div>
        <div className="glass edge" style={{ padding: 14, borderRadius: 18 }}><div className="mono neon" style={{ fontSize: 28 }}>{fmtVolume(tonnage(week))}</div><div className="eyebrow" style={{ fontSize: 10 }}>volume lb</div></div>
      </div>
      <h2 className="section-title">Sets per muscle vs target</h2>
      <VolumeTable totals={totals} targets={targets} hideEmpty />
      <div className="empty" style={{ paddingTop: 28 }}>
        <Figure spec={LOADING} size={90} />
        <p style={{ fontSize: 13 }}>Charts for 1RM, volume, muscle map and recovery arrive in Phase 2.</p>
      </div>
    </div>
  );
}
