// Rest timer dock: lives above the tab bar on every screen, survives navigation and reloads
// (its end time is stored). Chimes at zero. Also shows a "Back to workout" pill away from the logger.
import { useEffect, useRef, useState } from "react";
import { REST } from "../../core/figure/poses";
import { durationMin } from "../../core/session";
import { chime, vibrate } from "../device";
import { fmtClock } from "../format";
import { go, useRoute } from "../router";
import { useStore } from "../store";
import { Figure } from "./Figure";
import { Icon } from "./Icon";

export function Ring({ frac, size, stroke, done }: { frac: number; size: number; stroke: number; done?: boolean }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 0 6px var(--glow))" }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={done ? "var(--good)" : "url(#ringGrad)"} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, frac)))} style={{ transition: "stroke-dashoffset .3s linear" }} />
      <defs><linearGradient id="ringGrad"><stop offset="0" stopColor="var(--neon)" /><stop offset="1" stopColor="var(--neon-2)" /></linearGradient></defs>
    </svg>
  );
}

export function RestTimerDock() {
  const { restTimer, setRestTimer, active, settings } = useStore();
  const [name] = useRoute();
  const [now, setNow] = useState(Date.now());
  const [big, setBig] = useState(false);
  const alerted = useRef<number | null>(null);

  useEffect(() => {
    if (!restTimer && !active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [restTimer, active]);

  const left = restTimer ? (restTimer.endsAt - now) / 1000 : 0;
  const over = !!restTimer && left <= 0;

  useEffect(() => {
    if (!restTimer || !over || alerted.current === restTimer.endsAt) return;
    alerted.current = restTimer.endsAt;
    if (settings.sound) chime();
    vibrate([180, 90, 180]);
    const t = setTimeout(() => { setRestTimer(null); setBig(false); }, 6000);
    return () => clearTimeout(t);
  }, [over, restTimer, settings.sound, setRestTimer]);

  const adjust = (d: number) => restTimer && setRestTimer({ ...restTimer, endsAt: Math.max(Date.now() + 1000, restTimer.endsAt + d * 1000), durationSec: Math.max(1, restTimer.durationSec + d) });
  const frac = restTimer ? Math.max(0, left) / restTimer.durationSec : 0;
  const showResume = active && name !== "workout";
  // On the workout screen the timer lives in the header (WorkoutRestPill / WorkoutRestPanel); this keeps the chime.
  if (name === "workout") return null;
  if (!restTimer && !showResume) return null;

  return (
    <>
      <div className="dock">
        {restTimer && (
          <div className="glass edge row" style={{ padding: "8px 8px 8px 10px", borderRadius: 20, boxShadow: over ? "0 0 0 1px var(--good), 0 0 40px -6px var(--good)" : "0 12px 40px -14px var(--glow)" }}>
            <button className="row grow" onClick={() => setBig(true)} aria-label="Open rest timer">
              <div style={{ position: "relative", width: 46, height: 46 }}>
                <Ring frac={over ? 1 : frac} size={46} stroke={4} done={over} />
                <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: over ? "var(--good)" : "var(--neon-ink)" }}><Icon name="timer" size={18} /></span>
              </div>
              <div style={{ textAlign: "left" }}>
                <div className="eyebrow" style={{ fontSize: 10 }}>{over ? "Rest over" : "Rest"}</div>
                <div className="mono" style={{ fontSize: 28, lineHeight: 1, color: over ? "var(--good)" : "var(--ink)" }} aria-live="off">{over ? "GO!" : fmtClock(left)}</div>
              </div>
            </button>
            {!showResume && <>
              <button className="btn btn-ghost" style={{ padding: "0 10px", minWidth: 52 }} onClick={() => adjust(-15)} aria-label="15 seconds less">−15</button>
              <button className="btn btn-ghost" style={{ padding: "0 10px", minWidth: 52 }} onClick={() => adjust(15)} aria-label="15 seconds more">+15</button>
            </>}
            {showResume
              ? <button className="btn btn-primary" style={{ padding: 0, minHeight: 46, minWidth: 52 }} onClick={() => go("workout")} aria-label="Back to workout"><Icon name="play" size={20} /></button>
              : <button className="icon-btn" onClick={() => setRestTimer(null)} aria-label="Skip rest"><Icon name="close" /></button>}
          </div>
        )}
        {showResume && !restTimer && (
          <button className="btn btn-primary btn-xl" style={{ justifyContent: "space-between", padding: "0 20px", minHeight: 54, fontSize: 19 }} onClick={() => go("workout")}>
            <span className="row"><Icon name="play" size={18} /> Back to workout</span>
            <span className="mono" style={{ fontSize: 16 }}>{durationMin(active!, new Date(now))} min</span>
          </button>
        )}
      </div>
      {big && restTimer && (
        <div className="sheet-backdrop" style={{ display: "grid", placeItems: "center", background: "rgba(2,5,12,.82)" }} onClick={() => setBig(false)}>
          <div className="stack" style={{ justifyItems: "center", gap: 18 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ position: "relative", width: 260, height: 260 }}>
              <Ring frac={over ? 1 : frac} size={260} stroke={10} done={over} />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", alignContent: "center" }}>
                <Figure spec={REST} size={84} />
                <div className="mono" style={{ fontSize: 54, lineHeight: 1, color: over ? "var(--good)" : "var(--ink)", textShadow: "0 0 18px var(--glow)" }}>{over ? "GO!" : fmtClock(left)}</div>
              </div>
            </div>
            <div className="row">
              <button className="btn btn-ghost" style={{ minWidth: 84, minHeight: 56 }} onClick={() => adjust(-15)}>−15 s</button>
              <button className="btn btn-ghost" style={{ minWidth: 84, minHeight: 56 }} onClick={() => adjust(15)}>+15 s</button>
              <button className="btn btn-primary" style={{ minWidth: 84, minHeight: 56 }} onClick={() => { setRestTimer(null); setBig(false); }}>Skip</button>
            </div>
            <button className="btn btn-ghost" style={{ minWidth: 280, minHeight: 52, marginTop: 6 }} onClick={() => { setBig(false); if (name !== "workout") go("workout"); }}>
              <Icon name={name === "workout" ? "back" : "play"} size={18} /> {name === "workout" ? "Back to workout" : "Go to workout"}
            </button>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>The timer keeps running.</p>
          </div>
        </div>
      )}
    </>
  );
}

/** Rest timer state for the workout header: seconds left, ticking 4× a second while a timer runs. */
export function useRest() {
  const { restTimer, setRestTimer } = useStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!restTimer) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [restTimer]);
  const left = restTimer ? (restTimer.endsAt - now) / 1000 : 0;
  const running = !!restTimer && left > 0;
  const adjust = (d: number) => restTimer && setRestTimer({ ...restTimer, endsAt: Math.max(Date.now() + 1000, restTimer.endsAt + d * 1000), durationSec: Math.max(1, restTimer.durationSec + d) });
  return { running, left, frac: restTimer ? Math.max(0, left) / restTimer.durationSec : 0, adjust, skip: () => setRestTimer(null) };
}

/** Whether a rest is running, without a clock tick: re-checks once when the rest ends (so the parent screen
 *  doesn't re-render 4× a second; only the pill and panel below tick). */
export function useRestRunning() {
  const { restTimer } = useStore();
  const [, bump] = useState(0);
  const ms = restTimer ? restTimer.endsAt - Date.now() : 0;
  useEffect(() => {
    if (!restTimer || ms <= 0) return;
    const t = setTimeout(() => bump((n) => n + 1), ms + 20);
    return () => clearTimeout(t);
  }, [restTimer, ms > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return ms > 0;
}

/** Workout header: the running rest timer in place of Finish. Tap opens the full timer under the header. */
export function WorkoutRestPill({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { left, frac } = useRest();
  return (
    <button onClick={onToggle} aria-expanded={open} aria-label="Rest timer"
      style={{ position: "relative", width: 48, height: 48, padding: 0, border: 0, background: "none", color: "var(--ink)", cursor: "pointer", flex: "none" }}>
      <Ring frac={frac} size={48} stroke={3} />
      <span className="mono" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 13, letterSpacing: 0 }}>{fmtClock(left)}</span>
    </button>
  );
}

/** The full rest timer, shown right under the workout header: ring with icon, time, −15 / +15 / Skip (tap the pill again to close it). */
export function WorkoutRestPanel() {
  const { left, frac, adjust, skip } = useRest();
  return (
    <div className="row" style={{ marginTop: 10, gap: 8 }}>
      <div style={{ position: "relative", width: 46, height: 46, flex: "none" }}>
        <Ring frac={frac} size={46} stroke={4} />
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--neon-ink)" }}><Icon name="timer" size={18} /></span>
      </div>
      <div className="grow">
        <div className="eyebrow" style={{ fontSize: 10 }}>Rest</div>
        <div className="mono" style={{ fontSize: 28, lineHeight: 1 }} aria-live="off">{fmtClock(left)}</div>
      </div>
      <button className="btn btn-ghost" style={{ padding: "0 10px", minWidth: 52 }} onClick={() => adjust(-15)} aria-label="15 seconds less">−15</button>
      <button className="btn btn-ghost" style={{ padding: "0 10px", minWidth: 52 }} onClick={() => adjust(15)} aria-label="15 seconds more">+15</button>
      <button className="btn btn-ghost" style={{ padding: "0 10px", minWidth: 52, fontSize: 14 }} onClick={skip} aria-label="End rest now">Skip</button>
    </div>
  );
}
