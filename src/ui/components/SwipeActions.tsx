// Swipe a card left to show its actions (a 2 × 3 grid beside it), like Mail. Replaces the ⋯ menu on workout cards.
// A thin handle on the card's right edge opens it too (and shows the swipe exists). Touch only: a mostly-horizontal
// move past 10 px locks to the swipe; anything else scrolls the page as usual. One card open at a time (the parent
// owns `open`). Tapping the open card, or anywhere outside it, closes it.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export interface SwipeAction { label: string; icon: string; onClick: () => void; danger?: boolean; disabled?: boolean }

const COL = 72, GAP = 8;

export function SwipeActions({ open, onOpen, onClose, actions, label, peek, children }: {
  open: boolean; onOpen: () => void; onClose: () => void; actions: SwipeAction[]; label: string;
  /** Slide open a little and back once (first time, to show the swipe exists) */
  peek?: boolean;
  children: ReactNode;
}) {
  const width = Math.ceil(actions.length / 2) * COL;
  const shut = -(width + GAP);
  const wrap = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const live = useRef<number | null>(null);
  const openRef = useRef(open), cb = useRef({ onOpen, onClose });
  openRef.current = open; cb.current = { onOpen, onClose };
  const swallowClick = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let st: { x: number; y: number; base: number } | null = null, lock: "x" | "y" | null = null;
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) { st = null; return; }
      st = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: openRef.current ? shut : 0 };
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
      const v = Math.max(shut - 36, Math.min(0, st.base + dx));
      live.current = v; setDrag(v);
    };
    const end = () => {
      if (st && lock === "x") {
        // Ignore a click the browser may still send for this swipe, but only right after it (often none comes)
        swallowClick.current = true;
        setTimeout(() => { swallowClick.current = false; }, 350);
        const v = live.current ?? 0;
        if (v < shut / 2) cb.current.onOpen(); else cb.current.onClose();
      }
      st = null; lock = null; live.current = null; setDrag(null);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end); };
  }, [shut]);

  // Tap anywhere outside closes it
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) cb.current.onClose(); };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);

  const x = drag ?? (open ? shut : 0);
  const shown = Math.min(1, -x / (width + GAP));
  return (
    <div ref={wrap} className="swipe-wrap" data-noswipe>
      <div className="swipe-actions" style={{ width, opacity: shown, visibility: shown > 0 ? "visible" : "hidden" }} role="group" aria-label={`${label}: actions`}>
        {actions.map((a) => (
          <button key={a.label} type="button" className={"swipe-act" + (a.danger ? " danger" : "")} disabled={a.disabled} tabIndex={open ? 0 : -1}
            onClick={() => { cb.current.onClose(); a.onClick(); }}>
            <Icon name={a.icon} size={20} /><span>{a.label}</span>
          </button>
        ))}
      </div>
      <div className={"swipe-card" + (peek && !open && drag == null ? " swipe-peek" : "")}
        style={{ transform: x ? `translateX(${x}px)` : undefined, transition: drag == null ? "transform .32s var(--ease)" : "none" }}
        onClickCapture={(e) => {
          if (swallowClick.current) { swallowClick.current = false; e.stopPropagation(); e.preventDefault(); return; }
          if (openRef.current) { e.stopPropagation(); e.preventDefault(); cb.current.onClose(); }
        }}>
        {children}
        <button type="button" className="swipe-handle" aria-label={`${label}: show actions`} aria-expanded={open}
          onClick={(e) => { e.stopPropagation(); if (open) onClose(); else onOpen(); }}><span /></button>
      </div>
    </div>
  );
}
