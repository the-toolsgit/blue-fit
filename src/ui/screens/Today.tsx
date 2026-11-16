import { useEffect, useMemo, useState } from "react";
import { FLEX, REST } from "../../core/figure/poses";
import { createFreeSession, createSessionFromDay } from "../../core/session";
import { estimateMinutes } from "../../core/timeEstimate";
import { localDate, weekOrder, weekStart } from "../../core/util";
import { reducedMotion } from "../device";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { Dock } from "../components/Dock";
import { ExerciseSheet } from "./ExerciseScreen";
import { repRange } from "../format";
import { go } from "../router";
import { useStore } from "../store";

const LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TodayScreen() {
  const { routine, exMap, finished, active, saveSession, settings } = useStore();
  const sd = settings.weekStartDay;
  const now = new Date();
  const todayWd = now.getDay();
  const [wd, setWd] = useState(todayWd);
  const [open, setOpen] = useState<string | null>(null);
  const day = routine?.days.find((d) => d.weekday === wd);
  const isRest = !day || day.slots.length === 0;
  const slots = day?.slots ?? [];
  const sets = slots.reduce((a, s) => a + s.sets, 0);

  // Days of this week (starting on the chosen week-start day) that have a finished workout
  const doneDays = useMemo(() => {
    const ws = weekStart(localDate(now), sd);
    const m = new Map<number, boolean>();
    for (const s of finished) if (weekStart(s.date, sd) === ws && s.dayId) {
      const d = routine?.days.find((x) => x.id === s.dayId);
      if (d?.weekday != null) m.set(d.weekday, true);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, routine, sd]);
  const doneToday = finished.some((s) => s.date === localDate(now) && s.dayId === day?.id);

  // Hero figure cycles through the day's exercises, one per animation loop
  const [hero, setHero] = useState(0);
  useEffect(() => {
    setHero(0);
    if (reducedMotion() || slots.length < 2) return;
    const t = setInterval(() => setHero((h) => (h + 1) % slots.length), 3200);
    return () => clearInterval(t);
  }, [wd, slots.length]);
  const heroEx = exMap.get(slots[hero]?.exerciseId ?? "");

  const start = () => {
    if (!routine || !day) return;
    const s = createSessionFromDay(routine, day, exMap, finished, new Date());
    saveSession(s);
    go("workout");
  };
  const startFree = () => { saveSession(createFreeSession(new Date())); go("workout"); };

  return (
    <div className="page">
      <header className="spread" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 6 }}>
          <Figure spec={FLEX} size={30} still />
          <span style={{ font: "700 22px var(--display)", letterSpacing: ".12em" }} className="neon">BLUE FIT</span>
        </div>
        <span className="eyebrow">{now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </header>

      <div className="glass" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: 6, gap: 4, borderRadius: 18 }} role="tablist" aria-label="Day of the week">
        {weekOrder(1).map((d) => {
          const sel = d === wd, td = d === todayWd;
          return (
            <button key={d} role="tab" aria-selected={sel} onClick={() => setWd(d)}
              style={{ minHeight: 50, borderRadius: 13, display: "grid", placeItems: "center", gap: 2, transition: "all .25s var(--ease)",
                background: sel ? "linear-gradient(140deg,var(--neon),var(--neon-2))" : "transparent", color: sel ? "var(--on-neon)" : td ? "var(--neon)" : "var(--muted)",
                boxShadow: sel ? "0 0 20px -4px var(--glow)" : "none" }}>
              <span style={{ font: "700 14px var(--display)", letterSpacing: ".06em" }}>{LONG[d].slice(0, 3).toUpperCase()}</span>
              <span style={{ width: 5, height: 5, borderRadius: 5, background: doneDays.get(d) ? (sel ? "var(--on-neon)" : "var(--good)") : "transparent", boxShadow: doneDays.get(d) ? "0 0 6px var(--good)" : "none" }} />
            </button>
          );
        })}
      </div>

      {isRest ? (
        <section className="glass edge" style={{ marginTop: 14, padding: "26px 18px", textAlign: "center", display: "grid", justifyItems: "center", gap: 8 }}>
          <span className="eyebrow">{wd === todayWd ? "Today · " : ""}{LONG[wd]}</span>
          <div className="fig-stage"><Figure spec={REST} size={170} speed={0.5} label="Resting figure" /></div>
          <h1 className="title-xl neon-grad">Rest day</h1>
          <p className="muted" style={{ maxWidth: 300 }}>Walk if you like, but keep it easy.</p>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Training anyway? Pick a day above or start a free workout.</p>
        </section>
      ) : (
        <>
          <section className="glass edge" style={{ marginTop: 14, padding: 18 }}>
            <div className="spread" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <span className="eyebrow">{wd === todayWd ? "Today · " : ""}{LONG[wd]}</span>
                <h1 className="title-xl neon-grad" style={{ marginTop: 8 }}>{day!.title}</h1>
                {doneToday && <span className="badge" style={{ marginTop: 10, color: "var(--good)", borderColor: "var(--good)" }}><Icon name="check" size={14} /> Done today</span>}
              </div>
              <div className="fig-stage" style={{ marginRight: -6 }}>
                <Figure key={heroEx?.id} spec={heroEx?.figure} size={118} label={heroEx ? `Animation: ${heroEx.name}` : undefined} />
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12, textAlign: "right", minHeight: 18, transition: "opacity .3s" }} key={heroEx?.id}>{heroEx?.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>
              {[[slots.length, "exercises"], [sets, "sets"], [`~${estimateMinutes(sets, slots.length)}`, "min"]].map(([v, l]) => (
                <div key={l} style={{ padding: "10px 12px", borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                  <div className="mono" style={{ fontSize: 24, lineHeight: 1.1 }}>{v}</div>
                  <div className="eyebrow" style={{ fontSize: 10, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </section>

          <h2 className="section-title">Exercises</h2>
          <div className="glass" style={{ padding: 4 }}>
            {slots.map((s, i) => {
              const ex = exMap.get(s.exerciseId);
              if (!ex) return null;
              return (
                <button key={s.id} className="list-row" onClick={() => setOpen(ex.id)}>
                  <span className="mono muted" style={{ width: 18, fontSize: 13 }}>{i + 1}</span>
                  <Figure spec={ex.figure} size={40} still className="thin" />
                  <span className="grow">
                    <span style={{ display: "block", fontWeight: 600 }}>{ex.name} {ex.isHeavy && <span className="star">★</span>}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{s.notes ?? ex.muscles.join(", ")}</span>
                  </span>
                  <span className="mono" style={{ fontSize: 15, whiteSpace: "nowrap" }}>{s.sets} × {repRange(s.repMin, s.repMax)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <button className="btn btn-quiet btn-block" style={{ marginTop: 14 }} onClick={startFree}><Icon name="plus" size={18} /> Free workout</button>

      {!active && !isRest && (
        <Dock>
          <button className="btn btn-primary btn-xl pulse" onClick={start}>
            <Icon name="play" size={20} /> {wd === todayWd ? "Start workout" : `Start ${LONG[wd]}`}
          </button>
        </Dock>
      )}
      <ExerciseSheet id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
