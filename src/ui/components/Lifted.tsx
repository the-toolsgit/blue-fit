// Everyday heavy objects for "You lifted a car" (summary). Neon blue outline like the line man, lighter blue details,
// and a little depth the line man doesn't have: shaded fill, highlight, far parts dimmed, a ground shadow.
// Parts are drawn back to front with a fill, so nearer parts hide the outline of the ones behind.
import { useId, type ReactNode } from "react";
import type { LiftedId } from "../../core/lifted";

type Art = (f: string) => ReactNode;

// m = main part (outline + shaded fill), far = far side (dimmed), d = light detail line, dot = light filled detail,
// gl = glass (light tint), hi = highlight stroke
const m = (f: string) => ({ className: "lf-m", fill: f });
const far = (f: string) => ({ className: "lf-m lf-far", fill: f });
const d = { className: "lf-d" };
const dot = { className: "lf-dot" };
const gl = { className: "lf-d lf-glass" };
const hi = { className: "lf-hi" };
const dp = gl;

/** A wheel: tire, rim, hub. */
const wheel = (f: string, x: number, y: number, r: number) => (<>
  <circle {...m(f)} cx={x} cy={y} r={r} />
  <circle {...d} cx={x} cy={y} r={r * 0.58} />
  <circle {...dot} cx={x} cy={y} r={r * 0.18} />
</>);

const ART: Record<LiftedId, Art> = {
  fridge: (f) => (<>
    <path {...far(f)} d="M104 16 L118 9 L118 99 L104 106 Z" />
    <path {...m(f)} d="M60 16 L74 9 L118 9 L104 16 Z" />
    <rect {...m(f)} x="60" y="16" width="44" height="90" rx="3" />
    <path {...d} d="M60 46 H104" />
    <path {...d} d="M96 24 V38 M96 54 V76" strokeWidth="2.4" />
    <path {...hi} d="M65 22 V40 M65 52 V98" />
    <path {...d} d="M66 104 V108 M98 104 V108" opacity=".6" />
  </>),

  motorcycle: (f) => (<>
    {wheel(f, 42, 88, 17)}
    <path {...d} d="M42 88 L78 78 M122 88 L112 54" strokeWidth="2.2" />
    <path {...m(f)} d="M56 72 L72 54 C78 46 92 44 102 48 L118 56 L134 66 L126 74 L102 72 L86 80 L62 80 Z" />
    <path {...m(f)} d="M48 60 L60 56 L74 58 L66 66 L52 66 Z" />
    <path {...gl} d="M118 56 L124 44 L130 46 L128 58 Z" />
    <path {...d} d="M86 78 L64 86 L46 84" />
    <path {...hi} d="M76 52 C84 47 94 46 102 49" />
    <path {...d} d="M112 50 L104 46" strokeWidth="2" />
    {wheel(f, 122, 88, 17)}
  </>),

  piano: (f) => (<>
    <path {...far(f)} d="M30 42 L108 12 L112 17 L36 46 Z" />
    <path {...d} d="M88 21 L96 52" />
    <path {...m(f)} d="M24 46 C46 34 72 30 90 34 C104 38 112 46 128 44 C140 43 148 48 148 56 L148 66 L24 66 Z" />
    <rect {...far(f)} x="74" y="66" width="7" height="34" rx="2" />
    <rect {...m(f)} x="30" y="66" width="8" height="36" rx="2" /><rect {...m(f)} x="134" y="66" width="8" height="36" rx="2" />
    <path {...d} d="M28 102 H40 M132 102 H144" />
    <rect {...gl} x="14" y="52" width="14" height="10" rx="1.5" />
    <path {...d} d="M17 52 V58 M20 52 V58 M23 52 V58 M26 52 V58" opacity=".7" />
    <path {...d} d="M60 66 L64 92 L58 98 H70 L64 92" opacity=".8" />
    <path {...hi} d="M32 44 C52 36 74 33 88 36 C100 40 112 48 128 46" />
  </>),

  car: (f) => (<>
    <path {...m(f)} d="M14 84 L14 72 C14 66 20 64 28 62 L50 58 L64 44 C68 40 74 38 82 38 L112 38 C120 38 126 42 132 48 L142 58 C150 60 156 64 156 72 L156 84 Z" />
    <path {...gl} d="M56 58 L68 46 C70 44 74 42 80 42 L96 42 L96 58 Z" />
    <path {...gl} d="M100 42 L112 42 C118 42 122 46 126 50 L134 58 L100 58 Z" />
    <path {...d} d="M98 58 V82 M60 60 L58 82 M136 60 L138 80" opacity=".7" />
    <path {...d} d="M84 64 H90 M120 64 H126" strokeWidth="2" />
    <path {...hi} d="M30 66 C60 60 110 59 148 64" />
    <path {...dot} d="M150 66 L156 67 L156 71 L150 70 Z" /><path {...dot} d="M14 68 L19 68 L19 73 L14 73 Z" opacity=".7" />
    {wheel(f, 44, 86, 13)}{wheel(f, 128, 86, 13)}
  </>),

  pickup: (f) => (<>
    <path {...m(f)} d="M10 84 L10 62 L68 62 L76 40 C78 36 82 34 88 34 L108 34 C114 34 118 38 122 44 L130 58 C142 60 152 62 154 68 L156 84 Z" />
    <path {...gl} d="M80 40 L106 40 C110 40 114 44 116 48 L122 58 L80 58 Z" />
    <path {...d} d="M68 62 V84 M10 66 H68" opacity=".7" />
    <path {...d} d="M98 58 V82 M88 64 H94" opacity=".7" />
    <path {...hi} d="M14 64 H64 M82 36 H106" />
    <path {...dot} d="M150 64 L156 66 L156 70 L150 69 Z" />
    {wheel(f, 36, 86, 14)}{wheel(f, 128, 86, 14)}
  </>),

  bus: (f) => (<>
    <path {...m(f)} d="M8 88 L8 30 C8 26 12 24 16 24 L126 24 C132 24 134 28 134 34 L134 56 L148 60 C152 62 154 66 154 72 L154 88 Z" />
    {[16, 34, 52, 70, 88, 106].map((x) => <rect key={x} {...gl} x={x} y="32" width="14" height="16" rx="1.5" />)}
    <path {...gl} d="M122 32 L130 32 L130 54 L122 54 Z" />
    <path {...d} d="M8 58 H134 M8 64 H134" opacity=".6" />
    <path {...d} d="M126 58 V86" opacity=".6" />
    <path {...hi} d="M14 28 H128" />
    <path {...dot} d="M148 66 L154 67 L154 72 L148 71 Z" />
    {wheel(f, 34, 90, 12)}{wheel(f, 126, 90, 12)}
  </>),

  semi: (f) => (<>
    <rect {...m(f)} x="4" y="28" width="92" height="56" rx="2" />
    <path {...d} d="M4 78 H96" opacity=".6" />
    <path {...hi} d="M8 32 H92" />
    <path {...m(f)} d="M98 86 L98 40 C98 36 102 34 106 34 L130 34 C134 34 136 36 138 40 L144 56 C150 58 156 60 156 66 L156 86 Z" />
    <path {...gl} d="M110 40 L130 40 C132 40 134 42 135 44 L139 56 L110 56 Z" />
    <path {...d} d="M104 30 V16" strokeWidth="2.6" />
    <path {...d} d="M106 60 V84" opacity=".6" />
    <path {...dot} d="M150 62 L156 63 L156 68 L150 67 Z" />
    {wheel(f, 20, 92, 9)}{wheel(f, 40, 92, 9)}{wheel(f, 112, 91, 10)}{wheel(f, 140, 91, 10)}
  </>),

  jet: (f) => (<>
    <path {...far(f)} d="M76 60 L96 40 L106 40 L94 60 Z" />
    <path {...m(f)} d="M14 58 L6 30 L18 30 L38 58 Z" />
    <path {...m(f)} d="M8 62 C8 58 14 56 22 56 L132 56 C146 56 156 60 156 64 C156 68 148 72 136 72 L22 72 C14 72 8 68 8 62 Z" />
    <path {...hi} d="M22 59 H130" />
    {[40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120].map((x) => <circle key={x} {...dot} cx={x} cy="62" r="1.3" opacity=".8" />)}
    <path {...gl} d="M140 60 L149 61 L147 64 L140 64 Z" />
    <path {...m(f)} d="M70 68 L52 94 L62 94 L94 68 Z" />
    <ellipse {...m(f)} cx="78" cy="78" rx="11" ry="5" />
    <path {...d} d="M68 76 V80" />
    <path {...d} d="M128 72 V102 M44 72 V102" opacity=".6" />
    <circle {...m(f)} cx="128" cy="104" r="3" /><circle {...m(f)} cx="44" cy="104" r="3" />
  </>),

  tank: (f) => (<>
    <path {...m(f)} d="M16 96 C9 96 7 89 11 85 L22 74 L134 74 L145 85 C149 89 147 96 140 96 Z" />
    {[30, 46, 62, 78, 94, 110, 126].map((x) => <circle key={x} {...d} cx={x} cy="88" r="6" />)}
    <path {...m(f)} d="M20 74 L28 62 L132 62 L140 74 Z" />
    <path {...m(f)} d="M108 48 L158 48 L158 54 L108 54 Z" />
    <path {...m(f)} d="M48 62 L54 46 C56 42 60 40 66 40 L102 40 C108 40 112 44 112 50 L116 62 Z" />
    <path {...d} d="M70 40 V34 H82 V40" />
    <path {...hi} d="M58 44 H104 M30 66 H130" />
  </>),

  shuttle: (f) => (<>
    <path {...m(f)} d="M18 58 L10 26 L22 26 L46 58 Z" />
    <path {...m(f)} d="M16 60 L4 56 L4 64 L16 66 Z" /><path {...m(f)} d="M16 66 L4 66 L4 74 L16 72 Z" />
    <path {...m(f)} d="M16 74 L16 56 L116 56 C134 56 150 60 158 66 C150 72 136 76 120 76 L16 76 Z" />
    <path {...d} d="M30 60 H110" opacity=".6" />
    <path {...gl} d="M130 60 L142 62 L140 66 L128 65 Z" />
    <path {...hi} d="M22 58 H112" />
    <path {...m(f)} d="M56 76 L120 76 L104 84 L64 84 Z" />
    <path {...dp} d="M120 72 C136 72 150 70 158 66 C150 74 134 78 120 78 Z" />
  </>),
};



/** One object, gently lifted and set down (still with reduced motion). */
export function Lifted({ id, size = 120, label }: { id: LiftedId; size?: number; label?: string }) {
  const g = useId().replace(/:/g, "");
  return (
    <svg className="lifted" viewBox="0 0 160 116" width={size} height={(size * 116) / 160} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" className="s0" />
          <stop offset=".55" className="s1" />
          <stop offset="1" className="s2" />
        </linearGradient>
      </defs>
      <ellipse className="lf-shadow" cx="80" cy="109" rx="66" ry="4.5" />
      <g className="lf-body">{ART[id](`url(#${g})`)}</g>
    </svg>
  );
}
