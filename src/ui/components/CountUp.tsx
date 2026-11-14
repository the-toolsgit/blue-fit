import { useEffect, useState } from "react";
import { reducedMotion } from "../device";

/** Number that counts up on mount. */
export function CountUp({ value, format = (n: number) => String(Math.round(n)), ms = 1000 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const [n, setN] = useState(reducedMotion() ? value : 0);
  useEffect(() => {
    if (reducedMotion()) { setN(value); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setN(value * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{format(n)}</>;
}
