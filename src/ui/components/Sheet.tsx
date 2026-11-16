import { useEffect, useRef, type ReactNode } from "react";
import { reducedMotion } from "../device";
import { createPortal } from "react-dom";

/**
 * Bottom sheet. Closes with a swipe down like iOS (and Escape on a keyboard): drag down from the grip, or anywhere
 * while the sheet is scrolled to the top; let go past ~110 px (or with a quick flick) to close, else it springs back.
 */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const sheet = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sheet.current;
    if (!open || !el) return;
    let startY = 0, dy = 0, t0 = 0, dragging = false, armed = false;
    const set = (y: number, animate: boolean) => {
      el.style.animation = "none";
      el.style.transition = animate ? "transform .28s cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
      el.style.transform = `translate(-50%, ${y}px)`;
      if (backdrop.current) { backdrop.current.style.transition = animate ? "opacity .28s" : "none"; backdrop.current.style.opacity = String(Math.max(0, 1 - y / (el.offsetHeight || 1))); }
    };
    const start = (y: number, target: EventTarget | null) => {
      startY = y; dy = 0; t0 = performance.now(); dragging = false;
      armed = el.scrollTop <= 0 || !!(target as HTMLElement | null)?.closest?.(".sheet-grip-area");
    };
    const move = (y: number, e: Event) => {
      if (!armed) return;
      dy = y - startY;
      if (!dragging && dy > 6) dragging = true;
      if (!dragging) return;
      if (e.cancelable) e.preventDefault(); // stop the page/sheet from scrolling while dragging the sheet
      set(Math.max(0, dy), false);
    };
    const end = () => {
      if (!dragging) { armed = false; return; }
      const speed = dy / Math.max(1, performance.now() - t0);
      dragging = armed = false;
      if (dy > 110 || speed > 0.6) {
        if (reducedMotion()) return onClose();
        set(el.offsetHeight + 40, true);
        setTimeout(onClose, 260);
      } else set(0, true);
    };
    const ts = (e: TouchEvent) => start(e.touches[0].clientY, e.target);
    const tm = (e: TouchEvent) => move(e.touches[0].clientY, e);
    const pd = (e: PointerEvent) => { if (e.pointerType !== "mouse" || !(e.target as HTMLElement).closest(".sheet-grip-area")) return; start(e.clientY, e.target); window.addEventListener("pointermove", pm); window.addEventListener("pointerup", pu, { once: true }); };
    const pm = (e: PointerEvent) => move(e.clientY, e);
    const pu = () => { window.removeEventListener("pointermove", pm); end(); };
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("pointerdown", pd);
    return () => {
      el.removeEventListener("touchstart", ts); el.removeEventListener("touchmove", tm); el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end); el.removeEventListener("pointerdown", pd); window.removeEventListener("pointermove", pm);
    };
  }, [open, onClose]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <div ref={backdrop} className="sheet-backdrop" />
      <div ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-grip-area" aria-hidden="true"><div className="sheet-grip" /></div>
        {children}
      </div>
    </>,
    document.body,
  );
}

export function Confirm({ open, title, body, confirm, danger, onConfirm, onClose }: {
  open: boolean; title: string; body?: ReactNode; confirm: string; danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <div className="stack" style={{ padding: "4px 4px 8px" }}>
        <h3 className="title-md">{title}</h3>
        {body && <div className="muted">{body}</div>}
        <button className={"btn btn-block " + (danger ? "btn-danger" : "btn-primary")} style={{ minHeight: 54, marginTop: 8 }} onClick={() => { onConfirm(); onClose(); }}>{confirm}</button>
        <button className="btn btn-quiet btn-block" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}
