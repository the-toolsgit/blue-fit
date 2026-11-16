import { useMemo, useState } from "react";
import { FLEX } from "../../core/figure/poses";
import { dailyLoad, plannedDays, weeklyStreak } from "../../core/history";
import { durationMin } from "../../core/session";
import { tonnage } from "../../core/volume";
import { addDays, localDate, parseLocalDate, weekOrder, weekStart } from "../../core/util";
import { Figure } from "../components/Figure";
import { Icon } from "../components/Icon";
import { fmtDate, fmtVolume } from "../format";
import { go } from "../router";
import { useStore } from "../store";
import type { Session } from "../../core/types";

const WD = ["S", "M", "T", "W", "T", "F", "S"];

function StreakCard() {
  const { finished, routine, settings } = useStore();
  const sd = settings.weekStartDay;
  const today = localDate(new Date());
  const st = useMemo(() => weeklyStreak(finished, routine, today, sd), [finished, routine, today, sd]);
  const planned = plannedDays(routine);
  const doneDayIds = new Set(finished.filter((s) => weekStart(s.date, sd) === weekStart(today, sd)).map((s) => s.dayId));
  const days = (routine?.days ?? []).filter((d) => d.weekday != null && d.slots.length).sort((a, b) => ((a.weekday! + 6) % 7) - ((b.weekday! + 6) % 7));
  const hot = st.current > 0;
  return (
    <section className="glass edge" style={{ padding: 16, display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "center" }}>
      <div style={{ display: "grid", justifyItems: "center", minWidth: 74 }}>
        <span style={{ color: hot ? "var(--pink)" : "var(--faint)", filter: hot ? "drop-shadow(0 0 8px var(--pink-glow))" : undefined }} className={hot ? "flicker" : undefined}><Icon name="flame" size={30} /></span>
        <span className="mono" style={{ fontSize: 40, lineHeight: 1, color: hot ? "var(--ink)" : "var(--muted)", textShadow: hot ? "0 0 16px var(--pink-glow)" : undefined }}>{st.current}</span>
        <span className="eyebrow" style={{ fontSize: 9, marginTop: 4 }}>week streak</span>
      </div>
      <div>
        <div className="spread"><span className="eyebrow" style={{ fontSize: 10 }}>This week</span><span className="mono" style={{ fontSize: 13 }}>{st.thisWeek.daysLogged}/{planned} days</span></div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, days.length)},1fr)`, gap: 5, marginTop: 8 }}>
          {days.map((d) => {
            const done = doneDayIds.has(d.id);
            return (
              <div key={d.id} title={d.title} style={{ height: 30, borderRadius: 9, display: "grid", placeItems: "center", font: "700 12px var(--display)", letterSpacing: ".06em",
                background: done ? "linear-gradient(140deg,var(--neon),var(--neon-2))" : "var(--surface-2)", color: done ? "var(--on-neon)" : "var(--muted)",
                boxShadow: done ? "0 0 12px -2px var(--glow)" : "none", border: "1px solid var(--line)" }}>
                {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.weekday!]}
              </div>
            );
          })}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {st.thisWeek.complete ? "Week complete. Streak +1." : `Log all ${planned} days to ${st.current ? "keep" : "start"} the streak.`} Best: {st.best} wk.
        </p>
      </div>
    </section>
  );
}

function Calendar({ onPickDay }: { onPickDay: (date: string, ids: string[]) => void }) {
  const { finished } = useStore();
  const today = localDate(new Date());
  const [month, setMonth] = useState(today.slice(0, 7) + "-01");
  const load = useMemo(() => dailyLoad(finished), [finished]);
  const max = Math.max(12, ...[...load.values()].map((d) => d.sets));
  const first = weekStart(month); // calendar grid is always Mon → Sun
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const rows = cells[35].slice(0, 7) === month.slice(0, 7) ? 6 : 5;
  const shift = (n: number) => { const d = parseLocalDate(month); d.setMonth(d.getMonth() + n); setMonth(localDate(d).slice(0, 7) + "-01"); };
  const monthSets = cells.filter((c) => c.slice(0, 7) === month.slice(0, 7)).reduce((a, c) => a + (load.get(c)?.sessionIds.length ?? 0), 0);
  return (
    <section className="glass" style={{ padding: 14, marginTop: 12 }}>
      <div className="spread" style={{ marginBottom: 10 }}>
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="back" /></button>
        <div style={{ textAlign: "center" }}>
          <div style={{ font: "700 20px var(--display)", letterSpacing: ".08em", textTransform: "uppercase" }}>{fmtDate(month, { month: "long", year: "numeric" })}</div>
          <div className="muted" style={{ fontSize: 12 }}>{monthSets} workout{monthSets === 1 ? "" : "s"}</div>
        </div>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month" disabled={month.slice(0, 7) >= today.slice(0, 7)} style={{ opacity: month.slice(0, 7) >= today.slice(0, 7) ? 0.3 : 1 }}><Icon name="chevron" /></button>
      </div>
      <div className="cal">
        {weekOrder(1).map((d) => <div key={d} className="cal-h">{WD[d]}</div>)}
        {cells.slice(0, rows * 7).map((c) => {
          const l = load.get(c);
          const k = l ? Math.min(1, 0.25 + 0.75 * (l.sets / max)) : 0;
          const cls = ["cal-d", l ? "on" : "", c === today ? "today" : "", c.slice(0, 7) !== month.slice(0, 7) ? "out" : ""].join(" ");
          return (
            <button key={c} className={cls} disabled={!l} onClick={() => l && onPickDay(c, l.sessionIds)} aria-label={`${fmtDate(c)}${l ? `: ${l.sessionIds.length} workout, ${l.sets} sets` : ""}`}
              style={l ? { background: `linear-gradient(140deg, color-mix(in srgb, var(--neon) ${Math.round(k * 100)}%, transparent), color-mix(in srgb, var(--neon-2) ${Math.round(k * 85)}%, transparent))`, color: k > 0.6 ? "var(--on-neon)" : undefined, fontWeight: 700, boxShadow: k > 0.5 ? `0 0 ${Math.round(16 * k)}px -3px var(--glow)` : undefined } : undefined}>
              {Number(c.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="row" style={{ justifyContent: "flex-end", gap: 6, marginTop: 10, fontSize: 11 }} aria-hidden>
        <span className="muted">Fewer sets</span>
        {[0.25, 0.5, 0.75, 1].map((k) => <span key={k} style={{ width: 14, height: 14, borderRadius: 4, background: `linear-gradient(140deg, color-mix(in srgb, var(--neon) ${Math.round(k * 100)}%, transparent), color-mix(in srgb, var(--neon-2) ${Math.round(k * 85)}%, transparent))` }} />)}
        <span className="muted">More</span>
      </div>
    </section>
  );
}

function Row({ s }: { s: Session }) {
  return (
    <button className="list-row" onClick={() => go(`summary/${s.id}`)}>
      <span style={{ width: 44, textAlign: "center" }}>
        <span className="eyebrow" style={{ fontSize: 10, display: "block" }}>{fmtDate(s.date, { weekday: "short" })}</span>
        <span className="mono" style={{ fontSize: 20 }}>{Number(s.date.slice(8))}</span>
      </span>
      <span className="grow">
        <span style={{ display: "block", fontWeight: 600 }}>{s.title}{s.deload && <span style={{ color: "var(--neon-2)", fontWeight: 400, fontSize: 13 }}> · Deload</span>}</span>
        <span className="muted mono" style={{ fontSize: 12 }}>{durationMin(s)} min · {s.entries.reduce((a, e) => a + e.sets.length, 0)} sets · {fmtVolume(tonnage([s]))} lb</span>
      </span>
      <Icon name="chevron" size={18} />
    </button>
  );
}

export function HistoryScreen() {
  const { finished, settings } = useStore();
  const sd = settings.weekStartDay;
  const [picked, setPicked] = useState<string | null>(null);
  const thisWeek = weekStart(localDate(new Date()), sd);
  const groups = new Map<string, Session[]>();
  for (const s of finished) { const w = weekStart(s.date, sd); groups.set(w, [...(groups.get(w) ?? []), s]); }
  const pickedList = picked ? finished.filter((s) => s.date === picked) : [];
  return (
    <div className="page">
      <span className="eyebrow">History</span>
      <h1 className="title-lg" style={{ marginTop: 6, marginBottom: 14 }}>Workouts</h1>
      <StreakCard />
      <Calendar onPickDay={(d, ids) => (ids.length === 1 ? go(`summary/${ids[0]}`) : setPicked(d))} />
      {picked && (
        <section>
          <h2 className="section-title">{fmtDate(picked, { weekday: "long", month: "short", day: "numeric" })}</h2>
          <div className="glass" style={{ padding: 4 }}>{pickedList.map((s) => <Row key={s.id} s={s} />)}</div>
        </section>
      )}
      {!finished.length && (
        <div className="empty"><Figure spec={FLEX} size={130} /><p>No workouts yet. Finish one and it shows up here.</p></div>
      )}
      {[...groups].map(([w, list]) => (
        <section key={w}>
          <h2 className="section-title">{w === thisWeek ? "This week" : `Week of ${fmtDate(w, { month: "short", day: "numeric" })}`} · {list.length}</h2>
          <div className="glass" style={{ padding: 4 }}>{list.map((s) => <Row key={s.id} s={s} />)}</div>
        </section>
      ))}
    </div>
  );
}
