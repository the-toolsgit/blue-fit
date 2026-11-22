import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/** Big −/+ stepper with a typeable value. Swipe across it to change the number: right adds, left takes away, one step
 *  every 24 px (Leo, Nov 21 2026). */
export function Stepper({ label, value, step, onChange, decimals = true, suffix, min = 0, empty, invalid }: {
  label: string; value: number | null; step: number; onChange: (v: number | null) => void; decimals?: boolean; suffix?: string; min?: number;
  /** Highlight in the error red (e.g. a missing value) */
  invalid?: boolean;
  /** Value the first tap jumps to when empty */
  empty?: number;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);
  const bump = (d: number) => onChange(value == null && empty != null ? empty : Math.max(min, Math.round(((value ?? 0) + d) * 100) / 100));
  // Swipe: starts once the finger moves 8 px more sideways than up/down; vertical moves still scroll the page
  const drag = useRef<{ x: number; y: number; base: number; on: boolean; last: number } | null>(null);
  const swiped = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    swiped.current = false;
    drag.current = { x: e.clientX, y: e.clientY, base: value ?? empty ?? 0, on: false, last: 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag.current = null; return; }
      if (Math.abs(dx) < 8) return;
      d.on = true; swiped.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    const n = Math.trunc(dx / 24);
    if (n !== d.last) { d.last = n; onChange(Math.max(min, Math.round((d.base + n * step) * 100) / 100)); }
  };
  const onPointerEnd = () => { drag.current = null; };
  return (
    <div>
      <div className={"stepper-label" + (invalid ? " invalid" : "")}><span>{label}</span>{suffix && <span>{suffix}</span>}</div>
      <div className={"stepper" + (invalid ? " invalid" : "")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
        // A swipe isn't a tap: no −/+ press and no keyboard after it
        onClickCapture={(e) => { if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; } }}>
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => bump(-step)}><Icon name="minus" size={24} stroke={2.4} /></button>
        <input aria-label={label} aria-invalid={invalid || undefined} inputMode={decimals ? "decimal" : "numeric"} value={text} placeholder="—"
          onFocus={(e) => { if (drag.current?.on) e.currentTarget.blur(); else e.currentTarget.select(); }}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={() => { const n = parseFloat(text); onChange(Number.isFinite(n) ? Math.max(min, decimals ? n : Math.round(n)) : null); }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
        <button type="button" aria-label={`Increase ${label}`} onClick={() => bump(step)}><Icon name="plus" size={24} stroke={2.4} /></button>
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.v} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>{o.label}</button>)}
    </div>
  );
}
