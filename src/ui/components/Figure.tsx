// Thin SVG renderer for the figure engine. One shared animation loop (~30 fps) paints only visible figures.
import { bicepBumps, bumpsToSvg } from "../../core/figure/flex";
import { useEffect, useRef } from "react";
import { phase, poseFrame, type Timing } from "../../core/figure/engine";
import { frameToSvg } from "../../core/figure/svg";
import type { FigureSpec } from "../../core/types";
import { reducedMotion } from "../device";

type Reg = { spec: FigureSpec; visible: boolean; speed: number; timing?: Timing; t0: number };
const registry = new Map<SVGSVGElement, Reg>();
let raf = 0, last = 0;
const loop = (ms: number) => {
  if (ms - last > 32) {
    last = ms;
    registry.forEach((r, el) => { if (r.visible) el.innerHTML = frameToSvg(poseFrame(r.spec, phase((ms - r.t0) * r.speed, r.timing))); });
  }
  raf = registry.size ? requestAnimationFrame(loop) : 0;
};
const io = typeof IntersectionObserver === "function"
  ? new IntersectionObserver((es) => es.forEach((e) => { const r = registry.get(e.target as SVGSVGElement); if (r) r.visible = e.isIntersecting; }), { rootMargin: "80px" })
  : null;

/** `timing`: per-exercise speed from its tempo (core/figure/tempo.ts); each figure starts its loop when it appears. */
export function Figure({ spec, size = 112, className = "", still, k = 1, label, speed = 1, timing, bumps }: {
  spec: FigureSpec | null | undefined; size?: number; className?: string; still?: boolean; k?: number; label?: string; speed?: number; timing?: Timing;
  /** Flexed biceps on the upper arms (still figures only, e.g. the logo) */
  bumps?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !spec) return;
    const f0 = poseFrame(spec, still || reducedMotion() ? k : 0);
    el.innerHTML = frameToSvg(f0) + (bumps && still ? bumpsToSvg(bicepBumps(f0, 1, 5)) : "");
    if (still || reducedMotion()) return;
    registry.set(el, { spec, visible: !io, speed, timing, t0: performance.now() });
    io?.observe(el);
    if (!raf) raf = requestAnimationFrame(loop);
    return () => { registry.delete(el); io?.unobserve(el); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, still, bumps, k, speed, timing?.ab, timing?.ba, timing?.holdA, timing?.holdB]);
  if (!spec) return null;
  return (
    <svg ref={ref} className={"fig " + className} viewBox="0 -24 120 131" width={size} height={(size * 131) / 120}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
  );
}
