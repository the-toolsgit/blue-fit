import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { moveSlot } from "../../core/routineEdit";
import { REST, SPLASH_FLEX } from "../../core/figure/poses";
import { createSessionFromDay } from "../../core/session";
import { MANUAL_WHY } from "../../core/failure";
import { ExtraTag, FailFlame, useWeekExtraSets, useWeekFailure } from "../components/FailFlame";
import { slotsMinutes } from "../../core/timeEstimate";
import { localDate, weekOrder, weekStart } from "../../core/util";
import { reducedMotion } from "../device";
import { Figure } from "../components/Figure";
import { tempoTiming } from "../../core/figure/tempo";
import { loopMs } from "../../core/figure/engine";
import { Icon } from "../components/Icon";
import { Dock } from "../components/Dock";
import { DeloadBanner } from "../components/DeloadBanner";
import { deloadActive, deloadSets, deloadSuggestion } from "../../core/deload";
import { daysSince, downloadBackup, REMIND_AFTER_DAYS } from "../backup";
import { ExerciseSheet } from "./ExerciseScreen";
import { fmtDate, repRange } from "../format";
import { go } from "../router";
import { useStore } from "../store";

const SortableDayList = lazy(() => import("../components/SortableDayList").then((m) => ({ default: m.SortableDayList })));

const LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TodayScreen() {
  const { routine, exMap, finished, active, saveSession, saveRoutine, settings, backup, markBackup, snoozeBackup, exportAll, toast } = useStore();
  const since = daysSince(backup.lastAt);
  const remind = finished.length > 0 && (since == null || since >= REMIND_AFTER_DAYS) && !(backup.snoozedUntil && backup.snoozedUntil > new Date().toISOString());
  const sd = settings.weekStartDay;
  const now = new Date();
  const todayWd = now.getDay();
  const [wd, setWd] = useState(todayWd);
  const [open, setOpen] = useState<string | null>(null);
  const day = routine?.days.find((d) => d.weekday === wd);
  const isRest = !day || day.slots.length === 0;
  const slots = day?.slots ?? [];
  const today = localDate(now);
  const deloading = deloadActive(settings, today);
  const fail = useWeekFailure(routine).get(day?.id ?? "");
  // Auto-adjust off: what the app would have changed, kept as suggestions on the workout
  const autoOff = settings.autoAdjust === false;
  const failSug = useWeekFailure(autoOff ? routine : undefined, undefined, true).get(day?.id ?? "");
  const extraSug = useWeekExtraSets(autoOff ? routine : undefined, true).get(day?.id ?? "");
  // Extra sets making up work skipped earlier this week (none on a deload)
  const extra = useWeekExtraSets(routine).get(day?.id ?? "");
  const slotSets = (n: number, id?: string) => (deloading ? deloadSets(n) : n + (id && extra?.has(id) ? 1 : 0));
  const sets = slots.reduce((a, s) => a + slotSets(s.sets, s.id), 0);
  const suggestion = useMemo(() => (active || !settings.deloadSuggestions ? null : deloadSuggestion(finished, routine, exMap, settings, today)), [active, finished, routine, exMap, settings, today]);

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
  // A planned day earlier this week with no finished workout: grey dot
  const skipped = (d: number) => !doneDays.get(d) && (d - sd + 7) % 7 < (todayWd - sd + 7) % 7 && !!routine?.days.some((x) => x.weekday === d && x.slots.length);
  const doneToday = finished.some((s) => s.date === localDate(now) && s.dayId === day?.id);

  // Hero figure cycles through the day's exercises, one per animation loop
  const [hero, setHero] = useState(0);
  useEffect(() => { setHero(0); }, [wd, slots.length]);
  const heroEx = exMap.get(slots[hero]?.exerciseId ?? "");
  const heroTiming = tempoTiming(heroEx?.tempo, heroEx?.id);
  const heroLoop = loopMs(heroTiming);
  // Next exercise after one full loop at this exercise's tempo
  useEffect(() => {
    if (reducedMotion() || slots.length < 2) return;
    const t = setTimeout(() => setHero((h) => (h + 1) % slots.length), heroLoop);
    return () => clearTimeout(t);
  }, [hero, heroLoop, slots.length]);

  const start = () => {
    if (active) return go("workout"); // one workout at a time
    if (!routine || !day) return;
    const s = createSessionFromDay(routine, day, exMap, finished, new Date(), { deload: deloading, failure: [...(fail ?? [])].map(([slotId, why]) => ({ slotId, why })), extra: [...(extra ?? [])].map(([slotId, why]) => ({ slotId, why })),
      suggest: autoOff ? { failure: [...(failSug ?? [])].filter(([, why]) => !why.includes(MANUAL_WHY)).map(([slotId, why]) => ({ slotId, why })), extra: [...(extraSug ?? [])].map(([slotId, why]) => ({ slotId, why })) } : undefined });
    saveSession(s);
    go("workout");
  };

  return (
    <div className="page">
      <header className="spread" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 6 }}>
          <Figure spec={SPLASH_FLEX} size={30} still bumps />
          <span style={{ font: "700 22px var(--display)", letterSpacing: ".12em" }} className="brand">BLUE FIT</span>
        </div>
        <span className="eyebrow">{now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </header>

      {suggestion && <DeloadBanner suggestion={suggestion} today={today} />}

      {remind && (
        <div className="glass row" role="status" style={{ padding: "8px 8px 8px 14px", marginBottom: 12, borderRadius: 16, borderColor: "color-mix(in srgb, var(--warn) 45%, transparent)" }}>
          <span style={{ color: "var(--warn)" }}><Icon name="download" size={20} /></span>
          <span className="grow" style={{ fontSize: 13 }}>{since == null ? "You haven't backed up your workouts yet." : `Last backup ${since} days ago.`}</span>
          <button className="btn btn-ghost" style={{ minHeight: 38, padding: "0 12px", fontSize: 14 }} onClick={async () => { await downloadBackup(await exportAll()); markBackup(); toast({ kind: "info", title: "Backup exported" }); }}>Back up</button>
          <button className="icon-btn" aria-label="Remind me in a week" onClick={() => snoozeBackup(7)}><Icon name="close" size={18} /></button>
        </div>
      )}

      <div className="glass" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: 6, gap: 4, borderRadius: 18 }} role="tablist" aria-label="Day of the week">
        {weekOrder(1).map((d) => {
          const sel = d === wd, td = d === todayWd;
          return (
            <button key={d} role="tab" aria-selected={sel} onClick={() => setWd(d)}
              style={{ minHeight: 50, borderRadius: 13, display: "grid", placeItems: "center", gap: 2, transition: "all .25s var(--ease)",
                background: sel ? "linear-gradient(140deg,var(--neon),var(--neon-2))" : "transparent", color: sel ? "var(--on-neon)" : td ? "var(--neon-ink)" : "var(--muted)",
                boxShadow: sel ? "0 0 20px -4px var(--glow)" : "none" }}>
              <span style={{ font: "700 14px var(--display)", letterSpacing: ".06em" }}>{LONG[d].slice(0, 3).toUpperCase()}</span>
              <span style={{ width: 5, height: 5, borderRadius: 5, background: doneDays.get(d) ? (sel ? "var(--on-neon)" : "var(--good)") : skipped(d) ? (sel ? "var(--on-neon)" : "var(--faint)") : "transparent", boxShadow: doneDays.get(d) ? "0 0 6px var(--good)" : "none" }} />
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
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Training anyway? Pick a day above.</p>
        </section>
      ) : (
        <>
          <section className="glass edge" style={{ marginTop: 14, padding: 18 }}>
            <div className="spread" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <span className="eyebrow">{wd === todayWd ? "Today · " : ""}{LONG[wd]}</span>
                <h1 className="title-xl neon-grad" style={{ marginTop: 8 }}>{day!.title}</h1>
                {deloading && <span className="badge" style={{ marginTop: 10, marginRight: 6, color: "var(--neon-2)", borderColor: "var(--neon-2)" }}>Deload week · until {fmtDate(settings.deload!.end, { weekday: "short" })}</span>}
                {doneToday && <span className="badge" style={{ marginTop: 10, color: "var(--good)", borderColor: "var(--good)" }}><Icon name="check" size={14} /> Done today</span>}
              </div>
              <div className="fig-stage" style={{ marginRight: -6 }}>
                <Figure key={heroEx?.id} spec={heroEx?.figure} size={118} timing={heroTiming} label={heroEx ? `Animation: ${heroEx.name}` : undefined} />
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12, textAlign: "right", minHeight: 18, transition: "opacity .3s" }} key={heroEx?.id}>{heroEx?.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>
              {[[slots.length, "exercises"], [sets, "sets"], [`~${slotsMinutes(slots)}`, "min"]].map(([v, l]) => (
                <div key={l} style={{ padding: "10px 12px", borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                  <div className="mono" style={{ fontSize: 24, lineHeight: 1.1 }}>{v}</div>
                  <div className="eyebrow" style={{ fontSize: 10, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </section>

          <h2 className="section-title">Exercises</h2>
          <div className="glass" style={{ padding: 4 }}>
            <Suspense fallback={null}>
              <SortableDayList slots={slots} exMap={exMap} onOpen={(s) => setOpen(s.exerciseId)}
                onMove={(from, to) => routine && day && saveRoutine(moveSlot(routine, day.id, from, to))}
                row={(s, ex, i) => <>
                  <span className="mono muted" style={{ width: 18, fontSize: 13 }}>{i + 1}</span>
                  <Figure spec={ex.figure} size={40} still className="thin" />
                  <span className="grow">
                    <span style={{ display: "block", fontWeight: 600 }}>{ex.name} {ex.isHeavy && <span className="star">★</span>}<FailFlame why={fail?.get(s.id)} /></span>
                    <span className="muted" style={{ fontSize: 13 }}>{s.notes ?? ex.muscles.join(", ")}</span>
                  </span>
                  <span className="mono" style={{ fontSize: 15, whiteSpace: "nowrap", color: deloading ? "var(--neon-2)" : undefined }}>{!deloading && <ExtraTag why={extra?.get(s.id)} />}{slotSets(s.sets, s.id)} × {repRange(s.repMin, s.repMax, ex.measure === "time")}</span>
                </>} />
            </Suspense>
          </div>
        </>
      )}


      {!active && !isRest && (
        <Dock>
          <button className="btn btn-primary btn-xl pulse" onClick={start}>
            <Icon name="play" size={20} /> {wd === todayWd ? "Start workout" : `Start ${LONG[wd]}`}
          </button>
        </Dock>
      )}
      {(() => { const os = slots.find((s) => s.exerciseId === open);
        return <ExerciseSheet id={open} onClose={() => setOpen(null)} failWhy={fail?.get(os?.id ?? "")} whyOverride={os?.whyOverride} tipsOverride={os?.tipsOverride} />; })()}
    </div>
  );
}
