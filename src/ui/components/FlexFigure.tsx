// The splash's flex, on its own: the line man flexes once when he comes on screen (forearms curl in, a bicep pops up) and holds it.
import { useEffect, useRef } from "react";
import { SPLASH_FLEX } from "../../core/figure/poses";
import { bicepBumps, bumpsToSvg } from "../../core/figure/flex";
import { frameToSvg } from "../../core/figure/svg";
import { poseFrame } from "../../core/figure/engine";
import { reducedMotion } from "../device";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const draw = (k: number) => { const f = poseFrame(SPLASH_FLEX, k); return frameToSvg(f) + bumpsToSvg(bicepBumps(f, k)); };

export function FlexFigure({ size = 130, delayMs = 250, durationMs = 420 }: { size?: number; delayMs?: number; durationMs?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    if (reducedMotion()) { svg.innerHTML = draw(1); return; }
    svg.innerHTML = draw(0);
    let raf = 0, timer = 0;
    // Flex once, when it's on screen
    const play = () => { timer = window.setTimeout(() => {
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / durationMs);
        svg.innerHTML = draw(easeOut(t));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delayMs); };
    const io = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io?.disconnect(); play(); } }, { threshold: 0.6 })
      : null;
    if (io) io.observe(svg); else play();
    return () => { io?.disconnect(); clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [delayMs, durationMs]);
  return <svg ref={ref} className="fig flex-fig" viewBox="0 -24 120 131" width={size} height={(size * 131) / 120} role="img" aria-label="Line man flexing" />;
}
