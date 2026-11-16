// Per-exercise progress: est. 1RM, best set and volume over time, plus the session list.
import { useMemo, useState } from "react";
import { exerciseSeries } from "../../core/progress";
import type { Exercise } from "../../core/types";
import { fmtNum } from "../../core/util";
import { dayLabel, BarChart, LineChart } from "./Charts";
import { Seg } from "./Controls";
import { loadSuffix } from "../format";
import { useStore } from "../store";

type Metric = "e1rm" | "best" | "volume";

export function ExerciseProgress({ ex, from }: { ex: Exercise; from?: string | null }) {
  const { finished } = useStore();
  const [m, setM] = useState<Metric>("e1rm");
  const series = useMemo(() => exerciseSeries(finished, ex.id).filter((p) => !from || p.date >= from), [finished, ex.id, from]);
  if (!series.length) return <p className="muted" style={{ fontSize: 14, padding: "8px 0" }}>No sets logged{from ? " in this range" : ""} yet.</p>;
  const suf = loadSuffix(ex).trim();
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Seg label="Metric" value={m} onChange={setM} options={[{ v: "e1rm", label: "Est. 1RM" }, { v: "best", label: "Best set" }, { v: "volume", label: "Volume" }]} />
      {m === "e1rm" && <LineChart key="e" points={series.map((p) => ({ label: dayLabel(p.date), value: Math.round(p.e1rm * 10) / 10, sub: `${fmtNum(p.best.weight)} × ${p.best.reps}` }))} unit="lb" />}
      {m === "best" && <LineChart key="b" points={series.map((p) => ({ label: dayLabel(p.date), value: p.best.weight, sub: `× ${p.best.reps}` }))} unit={`lb${suf ? " " + suf : ""}`} />}
      {m === "volume" && <BarChart key="v" points={series.map((p) => ({ label: dayLabel(p.date), value: p.volume, sub: `${p.sets} sets` }))} unit="lb" highlightLast />}
    </div>
  );
}
