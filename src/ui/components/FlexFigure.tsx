// The splash's flex, looping: the line man flexes (forearms curl in, a bicep pops up), holds, relaxes, rests, again.
// Runs only while on screen. Reduced motion: shows the flexed pose, still.
import { useEffect, useRef } from "react";
import { SPLASH_FLEX } from "../../core/figure/poses";
import { bicepBumps, bumpsToSvg } from "../../core/figure/flex";
import { frameToSvg } from "../../core/figure/svg";
import { poseFrame } from "../../core/figure/engine";
import { reducedMotion } from "../device";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const draw = (k: number) => { const f = poseFrame(SPLASH_FLEX, k); return frameToSvg(f) + bumpsToSvg(bicepBumps(f, k)); };

/** One cycle (ms): flex up, hold, relax, rest. */
const UP = 420, HOLD = 900, DOWN = 520, REST = 600, CYCLE = UP + HOLD + DOWN + REST;
const kAt = (ms: number) => {
  const t = ms % CYCLE;
  if (t < UP) return easeOut(t / UP);
  if (t < UP + HOLD) return 1;
  if (t < UP + HOLD + DOWN) return 1 - easeInOut((t - UP - HOLD) / DOWN);
  return 0;
};

export function FlexFigure({ size = 130 }: { size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    if (reducedMotion()) { svg.innerHTML = draw(1); return; }
    svg.innerHTML = draw(0);
    let raf = 0, t0 = 0, last = -1;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const k = Math.round(kAt(now - t0) * 200) / 200;
      if (k !== last) { svg.innerHTML = draw(k); last = k; }
      raf = requestAnimationFrame(step);
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(step); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const io = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((es) => (es.some((e) => e.isIntersecting) ? start() : stop()), { threshold: 0.2 })
      : null;
    if (io) io.observe(svg); else start();
    return () => { io?.disconnect(); stop(); };
  }, []);
  return <svg ref={ref} className="fig flex-fig" viewBox="0 -24 120 131" width={size} height={(size * 131) / 120} role="img" aria-label="Line man flexing" />;
}
