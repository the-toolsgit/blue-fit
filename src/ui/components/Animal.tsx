// Cute, puffy animals for "You lifted an elephant" (summary). Neon blue outline like the line man, lighter blue
// details, and a little depth the line man doesn't have: shaded fill, highlight, far legs dimmed, a ground shadow.
// Parts are drawn back to front with a fill, so nearer parts hide the outline of the ones behind.
import { useId, type ReactNode } from "react";
import type { AnimalId } from "../../core/animals";

type Art = (f: string) => ReactNode;

// Shorthands: m = main part (outline + shaded fill), far = part on the far side (dimmed), d = light detail line,
// dot = light filled detail, hi = highlight stroke
const m = (f: string) => ({ className: "an-m", fill: f });
const far = (f: string) => ({ className: "an-m an-far", fill: f });
const d = { className: "an-d" };
const dot = { className: "an-dot" };
const hi = { className: "an-hi" };
const mp = { className: "an-m an-patch" };
const dp = { className: "an-d an-patch" };

// Deadpan, half-closed eyes: unimpressed, the joke for adults (no blush, no sparkle)
const eye = (f: string, x: number, y: number, r = 2.6) => (<>
  <circle cx={x} cy={y} r={r} {...dot} />
  <path d={`M${x - r - 0.8} ${y + 0.2} A${r + 0.8} ${r + 0.8} 0 0 1 ${x + r + 0.8} ${y + 0.2} Z`} fill={f} stroke="none" />
  <path {...d} d={`M${x - r - 1} ${y + 0.2} L${x + r + 1} ${y + 0.2}`} />
</>);

const ART: Record<AnimalId, Art> = {
  cat: (f) => (<>
    <path {...m(f)} d="M104 98 C126 106 142 86 128 70 C124 66 117 70 120 74 C127 84 118 94 104 90 Z" />
    <ellipse {...m(f)} cx="84" cy="82" rx="30" ry="25" />
    <ellipse {...d} cx="84" cy="88" rx="14" ry="12" opacity=".55" />
    <path {...m(f)} d="M60 36 L58 14 L77 28 Z" /><path {...m(f)} d="M100 36 L102 14 L83 28 Z" />
    <path {...d} d="M62 30 L61 20 L70 27" /><path {...d} d="M98 30 L99 20 L90 27" />
    <ellipse {...m(f)} cx="80" cy="46" rx="25" ry="21" />
    <path {...hi} d="M62 40 Q65 31 74 28" />
    {eye(f, 71, 45)}{eye(f, 89, 45)}
    <path {...dot} d="M77.5 51 L82.5 51 L80 54 Z" />
    <path {...d} d="M76.5 57 L83.5 57" />
    <path {...d} d="M58 50 L49 48 M58 54 L49 55 M102 50 L111 48 M102 54 L111 55" opacity=".7" />
    <ellipse {...m(f)} cx="72" cy="104" rx="9" ry="5" /><ellipse {...m(f)} cx="92" cy="104" rx="9" ry="5" />
  </>),

  dog: (f) => (<>
    <ellipse {...far(f)} cx="62" cy="96" rx="7" ry="12" /><ellipse {...far(f)} cx="100" cy="96" rx="7" ry="12" />
    <path {...m(f)} d="M42 70 C28 64 28 50 34 48 C39 55 42 61 50 63 Z" />
    <ellipse {...m(f)} cx="72" cy="76" rx="35" ry="20" />
    <path {...hi} d="M48 66 Q62 57 82 57" />
    <ellipse {...m(f)} cx="54" cy="98" rx="7.5" ry="12" /><ellipse {...m(f)} cx="92" cy="98" rx="7.5" ry="12" />
    <ellipse {...d} cx="54" cy="108" rx="7" ry="2.5" /><ellipse {...d} cx="92" cy="108" rx="7" ry="2.5" />
    <circle {...m(f)} cx="106" cy="52" r="18" />
    <ellipse {...m(f)} cx="121" cy="59" rx="12" ry="8.5" />
    <ellipse {...dot} cx="131" cy="56" rx="3.8" ry="2.8" />
    <path {...d} d="M120 66 Q125 69 130 64" />
    {eye(f, 111, 48)}
    <path {...m(f)} d="M97 40 C87 42 86 64 95 67 C102 63 103 48 97 40 Z" />
    <path {...d} d="M92 66 Q98 74 108 71" />
    <circle {...dot} cx="100" cy="72" r="2.2" />
  </>),

  panda: (f) => (<>
    <circle {...mp} cx="60" cy="24" r="8.5" /><circle {...mp} cx="100" cy="24" r="8.5" />
    <ellipse {...m(f)} cx="80" cy="82" rx="32" ry="26" />
    <ellipse {...d} cx="80" cy="88" rx="16" ry="13" opacity=".5" />
    <ellipse {...mp} cx="57" cy="80" rx="9" ry="15" transform="rotate(-18 57 80)" />
    <ellipse {...mp} cx="103" cy="80" rx="9" ry="15" transform="rotate(18 103 80)" />
    <ellipse {...mp} cx="65" cy="104" rx="12" ry="7" /><ellipse {...mp} cx="95" cy="104" rx="12" ry="7" />
    <circle {...m(f)} cx="80" cy="44" r="24" />
    <path {...hi} d="M60 36 Q64 27 73 24" />
    <ellipse {...dp} cx="70.5" cy="44" rx="6" ry="8.5" transform="rotate(-28 70.5 44)" />
    <ellipse {...dp} cx="89.5" cy="44" rx="6" ry="8.5" transform="rotate(28 89.5 44)" />
    {eye(f, 71, 44, 2.4)}{eye(f, 89, 44, 2.4)}
    <ellipse {...dot} cx="80" cy="53" rx="3.6" ry="2.6" />
    <path {...d} d="M77 58 L83 58" />
  </>),

  lion: (f) => (<>
    <path {...m(f)} d="M106 98 C128 102 132 84 126 74 C130 72 134 66 130 62 C126 60 122 64 123 69 C126 80 120 92 106 90 Z" />
    <ellipse {...m(f)} cx="86" cy="84" rx="28" ry="22" />
    {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((a) => (
      <circle key={a} {...m(f)} cx={80 + 24 * Math.cos((a * Math.PI) / 180)} cy={48 + 24 * Math.sin((a * Math.PI) / 180)} r="10" />
    ))}
    <circle {...m(f)} cx="66" cy="33" r="5.5" /><circle {...m(f)} cx="94" cy="33" r="5.5" />
    <circle {...m(f)} cx="80" cy="49" r="18" />
    <path {...hi} d="M66 42 Q69 35 76 33" />
    {eye(f, 73, 46, 2.4)}{eye(f, 87, 46, 2.4)}
    <ellipse {...d} cx="76" cy="57" rx="5" ry="3.8" /><ellipse {...d} cx="84" cy="57" rx="5" ry="3.8" />
    <path {...dot} d="M77 51.5 L83 51.5 L80 55 Z" />
    <ellipse {...m(f)} cx="74" cy="104" rx="9" ry="5" /><ellipse {...m(f)} cx="94" cy="104" rx="9" ry="5" />
  </>),

  cow: (f) => (<>
    <rect {...far(f)} x="60" y="80" width="11" height="25" rx="5" /><rect {...far(f)} x="96" y="80" width="11" height="25" rx="5" />
    <path {...d} d="M38 66 C30 74 30 88 32 94" /><ellipse {...dot} cx="32" cy="96" rx="2.5" ry="4" />
    <ellipse {...m(f)} cx="74" cy="72" rx="38" ry="22" />
    <path {...dp} d="M54 58 C62 54 72 60 68 68 C64 76 52 72 54 58 Z" />
    <path {...dp} d="M86 74 C94 70 102 76 98 84 C92 88 84 82 86 74 Z" />
    <path {...hi} d="M46 62 Q60 52 80 51" />
    <rect {...m(f)} x="48" y="82" width="12" height="25" rx="5.5" /><rect {...m(f)} x="84" y="82" width="12" height="25" rx="5.5" />
    <path {...d} d="M49 102 H59 M85 102 H95" />
    <path {...d} d="M68 92 Q72 98 76 92" />
    <path {...d} d="M106 44 C104 38 106 34 110 34 M124 44 C126 38 124 34 120 34" />
    <ellipse {...m(f)} cx="102" cy="52" rx="7" ry="4" transform="rotate(-25 102 52)" />
    <ellipse {...m(f)} cx="116" cy="56" rx="15" ry="13" />
    <ellipse {...m(f)} cx="122" cy="65" rx="12" ry="8.5" />
    <ellipse {...dot} cx="118" cy="65" rx="1.6" ry="2.2" /><ellipse {...dot} cx="126" cy="65" rx="1.6" ry="2.2" />
    {eye(f, 118, 52, 2.4)}
  </>),

  hippo: (f) => (<>
    <ellipse {...far(f)} cx="60" cy="96" rx="9" ry="10" /><ellipse {...far(f)} cx="96" cy="96" rx="9" ry="10" />
    <path {...m(f)} d="M36 66 L28 62 L32 70 Z" />
    <ellipse {...m(f)} cx="74" cy="72" rx="42" ry="26" />
    <path {...hi} d="M44 60 Q58 48 82 47" />
    <ellipse {...m(f)} cx="50" cy="98" rx="10" ry="10" /><ellipse {...m(f)} cx="86" cy="98" rx="10" ry="10" />
    <path {...d} d="M44 106 Q50 109 56 106 M80 106 Q86 109 92 106" />
    <ellipse {...m(f)} cx="110" cy="47" rx="4" ry="6" transform="rotate(-15 110 47)" />
    <circle {...m(f)} cx="117" cy="52" r="5.5" />
    <ellipse {...m(f)} cx="116" cy="66" rx="18" ry="16" />
    <ellipse {...m(f)} cx="129" cy="72" rx="13" ry="12" />
    {eye(f, 118, 52, 2.2)}
    <ellipse {...dot} cx="131" cy="66" rx="1.8" ry="1.4" /><ellipse {...dot} cx="137" cy="68" rx="1.8" ry="1.4" />
    <path {...d} d="M120 78 Q128 84 138 78" />
  </>),

  elephant: (f) => (<>
    <rect {...far(f)} x="58" y="76" width="15" height="30" rx="7" /><rect {...far(f)} x="94" y="76" width="15" height="30" rx="7" />
    <path {...d} d="M32 62 C26 70 26 80 28 86" /><path {...dot} d="M25 86 L31 86 L28 92 Z" />
    <ellipse {...m(f)} cx="70" cy="64" rx="40" ry="28" />
    <path {...hi} d="M40 52 Q54 38 78 37" />
    <rect {...m(f)} x="42" y="78" width="16" height="29" rx="7.5" /><rect {...m(f)} x="80" y="78" width="16" height="29" rx="7.5" />
    <path {...d} d="M45 104 Q47 101 49 104 M51 104 Q53 101 55 104 M83 104 Q85 101 87 104 M89 104 Q91 101 93 104" />
    <circle {...m(f)} cx="112" cy="50" r="20" />
    <path {...m(f)} d="M126 54 C134 68 131 84 139 91 C143 94 147 90 143 86 C138 80 141 66 132 50 Z" />
    <path {...d} d="M131 64 L134 63 M133 72 L136 71 M135 80 L138 80" opacity=".7" />
    <path {...dot} d="M124 64 Q130 70 134 68 Q128 66 126 61 Z" />
    <ellipse {...m(f)} cx="100" cy="52" rx="14" ry="18" />
    <ellipse {...d} cx="100" cy="53" rx="8" ry="11.5" opacity=".7" />
    {eye(f, 120, 45, 2.4)}
  </>),

  humpback: (f) => (<>
    <path {...m(f)} d="M30 70 C20 60 10 58 4 62 C10 66 14 70 16 74 C12 80 8 84 10 88 C16 86 22 80 32 74 Z" />
    <path {...m(f)} d="M24 70 C34 50 72 42 110 50 C132 54 146 62 148 72 C142 86 110 92 72 90 C46 88 30 82 24 70 Z" />
    <path {...hi} d="M52 54 Q78 44 108 50" />
    <path {...d} d="M104 80 Q124 82 144 75 M102 85 Q120 87 138 80" opacity=".7" />
    <circle {...dot} cx="70" cy="58" r="1.6" /><circle {...dot} cx="82" cy="54" r="1.4" /><circle {...dot} cx="60" cy="64" r="1.3" />
    <path {...m(f)} d="M84 86 C80 98 66 106 56 106 C64 100 72 92 74 86 Z" />
    {eye(f, 128, 68, 2.4)}
    <path {...d} d="M134 77 Q140 78 144 74" />
    <path {...d} d="M112 46 C110 38 106 34 102 32 M114 46 C114 38 116 32 120 30 M113 46 L113 34" />
  </>),

  blueWhale: (f) => (<>
    <path {...m(f)} d="M22 72 C14 64 6 62 2 64 C6 68 9 71 10 74 C7 78 4 82 5 85 C10 84 15 80 24 75 Z" />
    <path {...m(f)} d="M18 72 C30 58 70 52 112 56 C134 58 152 64 156 72 C150 82 120 88 76 86 C48 85 26 80 18 72 Z" />
    <path {...m(f)} d="M52 60 L58 51 L62 59 Z" />
    <path {...hi} d="M64 58 Q92 52 120 56" />
    {[[70, 66], [84, 62], [98, 68], [60, 72], [110, 62], [88, 74]].map(([x, y]) => <circle key={`${x}${y}`} {...dot} cx={x} cy={y} r="1.4" opacity=".7" />)}
    <path {...d} d="M112 78 Q132 80 152 75 M110 82 Q128 84 146 79" opacity=".6" />
    <path {...m(f)} d="M96 84 C94 92 86 98 78 99 C84 94 88 88 88 84 Z" />
    {eye(f, 136, 70, 2.2)}
    <path {...d} d="M142 77 Q148 78 152 75" />
    <path {...d} d="M126 54 C124 46 120 42 116 40 M128 54 C128 46 130 40 134 38" />
  </>),
};

/** One animal, gently bobbing (still with reduced motion). */
export function Animal({ id, size = 120, label }: { id: AnimalId; size?: number; label?: string }) {
  const g = useId().replace(/:/g, "");
  return (
    <svg className="animal" viewBox="0 0 160 116" width={size} height={(size * 116) / 160} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <radialGradient id={g} cx="35%" cy="25%" r="85%">
          <stop offset="0" className="s0" />
          <stop offset=".55" className="s1" />
          <stop offset="1" className="s2" />
        </radialGradient>
      </defs>
      <ellipse className="an-shadow" cx="80" cy="109" rx="52" ry="5" />
      <g className="an-body">{ART[id](`url(#${g})`)}</g>
    </svg>
  );
}
