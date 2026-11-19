// Swipe a card left to show its actions: the card's header (the part marked data-swipe-cover) slides out to the left
// while a bar slides in from the right in its place, both inside the card's edges, until it's swiped back right. Replaces the ⋯ menu on workout cards. A thin
// handle on the header's right edge opens it too (and shows the swipe exists). Touch: after 6 px the move locks to
// whichever direction is larger (sideways = swipe, else the page scrolls); a quick flick opens or closes by direction. One card open at a time (the parent owns `open`).
// It stays open (also while an action's sheet is up) until it's swiped back right, the handle is tapped again, or
// another card is opened.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export interface SwipeAction { label: string; icon: string; onClick: () => void; danger?: boolean; disabled?: boolean }

export function SwipeActions({ open, onOpen, onClose, actions, label, peek, children }: {
  open: boolean; onOpen: () => void; onClose: () => void; actions: SwipeAction[]; label: string;
  /** Slide in a little and back once (first time, to show the swipe exists) */
  peek?: boolean;
  children: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  // How tall the header band is (from the card's top to just under the header) and the card's width
  const [band, setBand] = useState<{ height: number; width: number } | null>(null);
  const measure = () => {
    const w = wrap.current, h = w?.querySelector<HTMLElement>("[data-swipe-cover]");
    if (!w || !h) return;
    const wr = w.getBoundingClientRect(), hr = h.getBoundingClientRect();
    const next = { height: Math.round(hr.bottom - wr.top) + 8, width: Math.round(wr.width) };
    setBand((b) => (b && b.height === next.height && b.width === next.width ? b : next));
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => measure()) : null;
    if (wrap.current) ro?.observe(wrap.current);
    return () => ro?.disconnect();
  }, []);

  const width = band?.width ?? 0;
  const [drag, setDrag] = useState<number | null>(null); // how much of the bar shows, 0 … width
  const live = useRef<number | null>(null);
  const openRef = useRef(open), cb = useRef({ onOpen, onClose }), widthRef = useRef(width);
  openRef.current = open; cb.current = { onOpen, onClose }; widthRef.current = width;
  const swallowClick = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // The wrapper has touch-action: pan-y, so the browser only ever scrolls vertically here and every sideways move
    // reaches us from the first pixel (iOS ignores preventDefault once it has started a pan).
    let st: { x: number; y: number; base: number } | null = null, lock: "x" | "y" | null = null;
    let vel = 0, lastX = 0, lastT = 0; // finger speed (px/ms, + = to the right), for flicks
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) { st = null; return; }
      st = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: openRef.current ? widthRef.current : 0 };
      lock = null; vel = 0; lastX = st.x; lastT = performance.now();
    };
    const move = (e: TouchEvent) => {
      if (!st) return;
      const x = e.touches[0].clientX, dx = x - st.x, dy = e.touches[0].clientY - st.y;
      if (!lock) {
        // Decide early (6 px), by whichever direction the finger moved more
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
        lock = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (lock !== "x") return;
      if (e.cancelable) e.preventDefault();
      const now = performance.now(), dt = now - lastT;
      if (dt > 0) vel = 0.7 * ((x - lastX) / dt) + 0.3 * vel;
      lastX = x; lastT = now;
      const v = Math.max(0, Math.min(widthRef.current, st.base - dx));
      live.current = v; setDrag(v);
    };
    const end = () => {
      if (st && lock === "x") {
        // Ignore a click the browser may still send for this swipe, but only right after it (often none comes)
        swallowClick.current = true;
        setTimeout(() => { swallowClick.current = false; }, 350);
        const v = live.current ?? 0;
        // A quick flick decides by its direction; a slow drag by how far it got
        const open = Math.abs(vel) > 0.35 ? vel < 0 : v > widthRef.current / 2;
        if (open) cb.current.onOpen(); else cb.current.onClose();
      }
      st = null; lock = null; live.current = null; setDrag(null);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end); };
  }, []);

  const shown = drag ?? (open ? width : 0);
  const peeking = !!peek && !open && drag == null;
  // The header slides out to the left as the bar slides in from the right (the card clips both)
  useLayoutEffect(() => {
    const h = wrap.current?.querySelector<HTMLElement>("[data-swipe-cover]");
    if (!h) return;
    h.style.transform = shown ? `translateX(${-shown}px)` : "";
    h.style.transition = drag == null ? "transform .32s var(--ease)" : "none";
  }, [shown, drag]);
  return (
    <div ref={wrap} className="swipe-wrap" data-noswipe
      onClickCapture={(e) => { if (swallowClick.current) { swallowClick.current = false; e.stopPropagation(); e.preventDefault(); } }}>
      {children}
      {band && (
        <>
          <button type="button" className="swipe-handle" style={{ top: band.height / 2 }} aria-label={`${label}: show actions`} aria-expanded={open}
            onClick={(e) => { e.stopPropagation(); if (open) onClose(); else onOpen(); }}><span /></button>
          <div className="swipe-clip" style={{ height: band.height, visibility: shown > 0 || peeking ? "visible" : "hidden" }}>
          <div className={"swipe-cover" + (peeking ? " swipe-peek" : "")} role="group" aria-label={`${label}: actions`} aria-hidden={!open}
            style={{ height: band.height, transform: peeking ? undefined : `translateX(${width - shown}px)`, transition: drag == null ? "transform .32s var(--ease)" : "none", visibility: shown > 0 || peeking ? "visible" : "hidden" }}>
            {actions.map((a) => (
              <button key={a.label} type="button" className={"swipe-act" + (a.danger ? " danger" : "")} disabled={a.disabled} tabIndex={open ? 0 : -1}
                onClick={(e) => { e.stopPropagation(); a.onClick(); }}>
                <Icon name={a.icon} size={20} /><span>{a.label}</span>
              </button>
            ))}
          </div>
          </div>
        </>
      )}
    </div>
  );
}
