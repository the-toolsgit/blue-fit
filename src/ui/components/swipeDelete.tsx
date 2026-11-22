// Swipe a list row left to delete it (Plan tab, plan editor): a short swipe leaves a red Delete button, a long swipe or a
// fast flick deletes at once; tapping the row while it's open closes it. Sideways moves lock after 6 px (vertical =
// page scroll, press and hold = drag to move). Also: FigureTap, a row's line man that opens the exercise's how-to.
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Width of the Delete button a short swipe leaves showing; a long swipe deletes at once. */
const OPEN_W = 88, DELETE_AT = 150;

export function useSwipeDelete(onDelete?: () => void) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [dx, setDx] = useState(0); // how far the row is slid left (≤ 0)
  const [live, setLive] = useState(false); // finger down (no animation)
  const cb = useRef({ onDelete, dx }); cb.current = { onDelete, dx };
  const swallow = useRef(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el || !onDelete) return;
    let st: { x: number; y: number; base: number } | null = null, lock: "x" | "y" | null = null, cur = 0, vel = 0, lx = 0, lt = 0;
    const start = (e: TouchEvent) => { if (e.touches.length !== 1) return; st = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: cb.current.dx }; lock = null; cur = st.base; vel = 0; lx = st.x; lt = performance.now(); };
    const move = (e: TouchEvent) => {
      if (!st) return;
      const x = e.touches[0].clientX, mx = x - st.x, my = e.touches[0].clientY - st.y;
      if (!lock) { if (Math.max(Math.abs(mx), Math.abs(my)) < 6) return; lock = Math.abs(mx) > Math.abs(my) ? "x" : "y"; }
      if (lock !== "x") return;
      if (e.cancelable) e.preventDefault();
      const now = performance.now(); if (now > lt) vel = 0.7 * ((x - lx) / (now - lt)) + 0.3 * vel; lx = x; lt = now;
      cur = Math.min(0, st.base + mx); setLive(true); setDx(cur);
    };
    const end = () => {
      if (st && lock === "x") {
        swallow.current = true; setTimeout(() => { swallow.current = false; }, 350);
        setLive(false);
        if (cur < -DELETE_AT || (vel < -0.9 && cur < -40)) { setDx(-(el.offsetWidth + 20)); setTimeout(() => cb.current.onDelete?.(), 200); }
        else setDx(vel < -0.35 || (vel <= 0.35 && cur < -OPEN_W / 2) ? -OPEN_W : 0);
      }
      st = null; lock = null;
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end); };
  }, [!!onDelete]);
  return {
    wrap, dx, setDx,
    /** Put on the row's wrapper: a swipe's trailing click doesn't open the row */
    onClickCapture: (e: MouseEvent) => { if (swallow.current) { swallow.current = false; e.stopPropagation(); e.preventDefault(); } },
    /** The sliding part's style */
    slide: { transform: dx ? `translateX(${dx}px)` : undefined, transition: live ? "none" : "transform .28s var(--ease)" },
    /** The red Delete button behind the row (only while slid) */
    button: onDelete && dx < 0 ? (
      <button type="button" className="day-row-del" style={{ width: Math.max(OPEN_W, -dx) }} onClick={() => { setDx(-(wrap.current?.offsetWidth ?? 400) - 20); setTimeout(() => onDelete(), 200); }}>
        <Icon name="trash" size={20} /><span>Delete</span>
      </button>
    ) : null,
  };
}

/** A row's line man as its own tap target (inside the row's button): opens the exercise's how-to instead of the row */
export function FigureTap({ name, onTap, children }: { name: string; onTap: () => void; children: ReactNode }) {
  const go = (e: MouseEvent | KeyboardEvent) => { e.stopPropagation(); e.preventDefault(); onTap(); };
  return (
    <span role="button" tabIndex={0} className="fig-tap" aria-label={`How to do ${name}`} onClick={go}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") go(e); }}>
      {children}
    </span>
  );
}
