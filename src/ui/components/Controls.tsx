import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/** Big −/+ stepper with a typeable value. */
export function Stepper({ label, value, step, onChange, decimals = true, suffix, min = 0, empty }: {
  label: string; value: number | null; step: number; onChange: (v: number | null) => void; decimals?: boolean; suffix?: string; min?: number;
  /** Value the first tap jumps to when empty */
  empty?: number;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);
  const bump = (d: number) => onChange(value == null && empty != null ? empty : Math.max(min, Math.round(((value ?? 0) + d) * 100) / 100));
  return (
    <div>
      <div className="stepper-label"><span>{label}</span>{suffix && <span>{suffix}</span>}</div>
      <div className="stepper">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => bump(-step)}><Icon name="minus" size={24} stroke={2.4} /></button>
        <input aria-label={label} inputMode={decimals ? "decimal" : "numeric"} value={text} placeholder="—"
          onFocus={(e) => e.currentTarget.select()}
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
