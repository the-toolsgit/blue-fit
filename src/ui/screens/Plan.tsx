import { useMemo, useState } from "react";
import { estimateMinutes } from "../../core/timeEstimate";
import { planVolume } from "../../core/volume";
import { MUSCLE_GROUPS } from "../../core/types";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { VolumeTable } from "../components/VolumeTable";
import { fmtRest, repRange } from "../format";
import { go } from "../router";
import { useStore } from "../store";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PlanScreen() {
  const { routine, exMap, targets } = useStore();
  const days = (routine?.days ?? []).filter((d) => d.slots.length).sort((a, b) => ((a.weekday ?? 9) + 6) % 7 - ((b.weekday ?? 9) + 6) % 7);
  const [dayId, setDayId] = useState(days.find((d) => d.weekday === new Date().getDay())?.id ?? days[0]?.id);
  const vol = useMemo(() => (routine ? planVolume(routine, exMap) : []), [routine, exMap]);
  if (!routine) return <div className="page"><div className="empty">No routine.</div></div>;
  const day = days.find((d) => d.id === dayId) ?? days[0];
  const totals = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, vol.find((v) => v.group === m.id)?.sets ?? 0])) as never;
  const dayCount = Object.fromEntries(vol.map((v) => [v.group, v.directDays]));
  const allSets = routine.days.reduce((a, d) => a + d.slots.reduce((b, s) => b + s.sets, 0), 0);
  const sets = day?.slots.reduce((a, s) => a + s.sets, 0) ?? 0;

  return (
    <div className="page">
      <span className="eyebrow">Current plan</span>
      <h1 className="title-lg neon-grad" style={{ marginTop: 6 }}>{routine.name}</h1>
      <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>{days.length} days · {routine.days.flatMap((d) => d.slots).length} exercises · {allSets} sets a week</p>

      {routine.rules?.length ? (
        <div className="chips-scroll" style={{ marginTop: 14, gap: 10 }}>
          {routine.rules.map((r) => (
            <div key={r.title} className="glass" style={{ minWidth: 240, maxWidth: 260, padding: 12, borderRadius: 16, flex: "none" }}>
              <b style={{ font: "700 16px var(--display)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--neon)" }}>{r.title}</b>
              <p style={{ fontSize: 13, marginTop: 4 }}>{r.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="chips-scroll" style={{ marginTop: 12 }}>
        {days.map((d) => <button key={d.id} className="chip" aria-pressed={d.id === day?.id} onClick={() => setDayId(d.id)}>{d.weekday != null ? SHORT[d.weekday] : d.title}</button>)}
      </div>
      {day && (
        <>
          <div className="spread" style={{ margin: "14px 4px 8px" }}>
            <h2 className="title-md" style={{ textTransform: "uppercase" }}>{day.title}</h2>
            <span className="mono muted" style={{ fontSize: 13 }}>{sets} sets · ~{estimateMinutes(sets, day.slots.length)} min</span>
          </div>
          <div className="glass" style={{ padding: 4 }}>
            {day.slots.map((s, i) => {
              const ex = exMap.get(s.exerciseId);
              if (!ex) return null;
              return (
                <button key={s.id} className="list-row" onClick={() => go(`exercise/${ex.id}`)}>
                  <span className="mono muted" style={{ width: 16, fontSize: 13 }}>{i + 1}</span>
                  <Figure spec={ex.figure} size={44} still className="thin" />
                  <span className="grow">
                    <span style={{ display: "block", fontWeight: 600 }}>{ex.name} {ex.isHeavy && <span className="star">★</span>}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{s.notes ? `${s.notes} · ` : ""}rest {fmtRest(s.restSec)}</span>
                  </span>
                  <span className="mono" style={{ whiteSpace: "nowrap" }}>{s.sets} × {repRange(s.repMin, s.repMax)}</span>
                  <Icon name="chevron" size={16} />
                </button>
              );
            })}
          </div>
        </>
      )}

      <h2 className="section-title">Weekly volume</h2>
      <VolumeTable totals={totals} targets={targets} days={dayCount} />
      <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 14 }}>Editing the plan arrives in Phase 3.</p>
    </div>
  );
}
