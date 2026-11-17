// Week streak flames: the fire mark (complete week) with sparks above it, and the ice flame (streak frozen)
// with tiny shiny snowflakes above it. Animation is CSS only and stops with reduced motion.
import { useId } from "react";

export const FLAME_PATH = "M12 21c4 0 6.5-2.6 6.5-6.3 0-4.4-4.2-6.4-4.8-11.2-2.3 1.6-3.7 4.3-3.4 7.2-1.5-.6-2.4-2-2.6-3.4C5.9 9.2 5.5 11.4 5.5 14.7 5.5 18.4 8 21 12 21z";

/** A six-armed snowflake centered on (x, y). */
const Flake = ({ x, y, r, delay }: { x: number; y: number; r: number; delay: number }) => (
  <g className="twinkle" style={{ animationDelay: `${delay}s`, transformOrigin: `${x}px ${y}px` }}>
    {[0, 60, 120].map((a) => {
      const c = Math.cos((a * Math.PI) / 180) * r, s = Math.sin((a * Math.PI) / 180) * r;
      return <line key={a} x1={x - c} y1={y - s} x2={x + c} y2={y + s} />;
    })}
  </g>
);

/** viewBox 0 0 24 27: the flame sits 3 units down so the sparks / flakes have room above it. */
export function StreakFlame({ kind, size = 34 }: { kind: "fire" | "ice"; size?: number }) {
  const id = useId().replace(/:/g, "");
  const fire = kind === "fire";
  return (
    <svg width={size} height={(size * 27) / 24} viewBox="0 0 24 27" aria-hidden="true" className="streak-flame"
      style={{ overflow: "visible", filter: fire ? "drop-shadow(0 0 5px rgba(255,120,0,.6))" : "drop-shadow(0 0 6px rgba(80,170,255,.7))" }}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="24" x2="0" y2="6.5" gradientUnits="userSpaceOnUse">
          {fire
            ? <><stop offset="0" stopColor="#FFD23F" /><stop offset=".5" stopColor="#FF8A00" /><stop offset="1" stopColor="#FF2C2C" /></>
            : <><stop offset="0" stopColor="#BFF0FF" /><stop offset=".45" stopColor="#3D8BFF" /><stop offset="1" stopColor="#0B2E9E" /></>}
        </linearGradient>
      </defs>
      <g transform="translate(0 3)">
        <path d={FLAME_PATH} fill={`url(#g${id})`} stroke={fire ? "#FF2C2C" : "#9FE6FF"} strokeWidth="1.6" strokeLinejoin="round" />
        {!fire && <path d="M7.2 18.2l1 2.2.9-1.6 1 2 .9-1.5 1 1.9.9-1.6 1 1.6.9-2" fill="none" stroke="#E8FBFF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />}
      </g>
      {fire ? (
        <g fill="#FFE27A" style={{ filter: "drop-shadow(0 0 1.5px #FF8A00)" }}>
          <circle className="spark" cx="9.6" cy="5.6" r="1.25" style={{ animationDelay: "0s" }} />
          <circle className="spark" cx="15.8" cy="4.6" r="1.1" style={{ animationDelay: ".45s" }} />
          <circle className="spark" cx="12.6" cy="2.8" r="1" style={{ animationDelay: ".9s" }} />
          <circle className="spark" cx="6.8" cy="3.6" r=".85" style={{ animationDelay: "1.3s" }} />
          <circle className="spark" cx="18.2" cy="2.6" r=".8" style={{ animationDelay: "1.6s" }} />
        </g>
      ) : (
        <g stroke="#FFFFFF" strokeWidth=".7" strokeLinecap="round">
          <Flake x={8.4} y={3.6} r={1.5} delay={0} />
          <Flake x={15.8} y={2.4} r={1.9} delay={0.6} />
          <Flake x={12.2} y={0.6} r={1.1} delay={1.2} />
        </g>
      )}
    </svg>
  );
}
