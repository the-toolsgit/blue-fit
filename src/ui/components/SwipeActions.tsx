// Swipe a card left to show its actions: a bar slides in from the right and fully covers the card's header (the part
// marked data-swipe-cover), edge to edge, until it's swiped back right. Replaces the ⋯ menu on workout cards. A thin
// handle on the header's right edge opens it too (and shows the swipe exists). Touch: a mostly-horizontal move past
// 10 px locks to the swipe; anything else scrolls as usual. One card open at a time (the parent owns `open`).
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
    let st: { x: number; y: number; base: number } | null = null, lock: "x" | "y" | null = null;
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) { st = null; return; }
      st = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: openRef.current ? widthRef.current : 0 };
      lock = null;
    };
    const move = (e: TouchEvent) => {
      if (!st) return;
      const dx = e.touches[0].clientX - st.x, dy = e.touches[0].clientY - st.y;
      if (!lock) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) lock = "x";
        else if (Math.abs(dy) > 10) lock = "y";
      }
      if (lock !== "x") return;
      e.preventDefault();
      const v = Math.max(0, Math.min(widthRef.current, st.base - dx));
      live.current = v; setDrag(v);
    };
    const end = () => {
      if (st && lock === "x") {
        // Ignore a click the browser may still send for this swipe, but only right after it (often none comes)
        swallowClick.current = true;
        setTimeout(() => { swallowClick.current = false; }, 350);
        const v = live.current ?? 0;
        if (v > widthRef.current / 2) cb.current.onOpen(); else cb.current.onClose();
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
