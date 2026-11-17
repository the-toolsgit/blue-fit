// Week streak flame that fills from the bottom as the week's planned days get logged:
// yellow at the bottom, orange in the middle, red at the top. Empty = just the faint outline.
import { useId } from "react";
import { Sparks } from "./StreakFlames";

const FLAME = "M12 21c4 0 6.5-2.6 6.5-6.3 0-4.4-4.2-6.4-4.8-11.2-2.3 1.6-3.7 4.3-3.4 7.2-1.5-.6-2.4-2-2.6-3.4C5.9 9.2 5.5 11.4 5.5 14.7 5.5 18.4 8 21 12 21z";
/** Flame top and bottom in the 24-unit icon box */
const TOP = 3.5, BOTTOM = 21;

/** Week complete (full): sparks drift up from the tip. */
export function FillFlame({ fill, size = 30 }: { fill: number; size?: number }) {
  const id = useId().replace(/:/g, "");
  const f = Math.max(0, Math.min(1, fill));
  const y = BOTTOM - (BOTTOM - TOP) * f;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="streak-flame"
      style={{ overflow: "visible", filter: f > 0 ? "drop-shadow(0 0 6px rgba(255,120,0,.55))" : undefined }}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1={BOTTOM} x2="0" y2={TOP} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD23F" />
          <stop offset="0.5" stopColor="#FF8A00" />
          <stop offset="1" stopColor="#FF2C2C" />
        </linearGradient>
        <clipPath id={`c${id}`}><rect x="0" width="24" height="24" y={y} style={{ transition: "y .8s cubic-bezier(.2,.8,.2,1)" }} /></clipPath>
      </defs>
      <path d={FLAME} fill={`url(#g${id})`} clipPath={`url(#c${id})`} />
      <path d={FLAME} fill="none" stroke={f >= 1 ? "#FF2C2C" : f > 0 ? "#FF8A00" : "var(--faint)"} strokeWidth="1.8" strokeLinejoin="round" />
      {f >= 1 && <Sparks y={3.2} />}
    </svg>
  );
}
