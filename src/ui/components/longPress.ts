// Press and hold (~0.45 s) on a row: runs `onLong` instead of the tap. Moving the finger more than 8 px (a scroll)
// cancels it; the click that follows a long press is swallowed. Spread the returned props on the row's button.
import { useRef, type MouseEvent, type PointerEvent } from "react";
import { vibrate } from "../device";

export function useLongPress(onLong: (() => void) | undefined, ms = 450) {
  const t = useRef<number | null>(null), start = useRef<{ x: number; y: number } | null>(null), fired = useRef(false);
  const cancel = () => { if (t.current != null) clearTimeout(t.current); t.current = null; start.current = null; };
  if (!onLong) return {};
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false; start.current = { x: e.clientX, y: e.clientY };
      t.current = window.setTimeout(() => { fired.current = true; t.current = null; vibrate(15); onLong(); }, ms);
    },
    onPointerMove: (e: PointerEvent) => { const s = start.current; if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancel(); },
    onPointerUp: cancel, onPointerCancel: cancel, onPointerLeave: cancel,
    onClickCapture: (e: MouseEvent) => { if (fired.current) { fired.current = false; e.preventDefault(); e.stopPropagation(); } },
    // iOS: no text selection or callout menu while holding
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
    style: { WebkitTouchCallout: "none", userSelect: "none", WebkitUserSelect: "none" } as const,
  };
}
