// Thin SVG renderer for the figure engine. One shared animation loop (~30 fps) paints only visible figures.
import { useEffect, useRef } from "react";
import { phase, poseFrame } from "../../core/figure/engine";
import { frameToSvg } from "../../core/figure/svg";
import type { FigureSpec } from "../../core/types";
import { reducedMotion } from "../device";

type Reg = { spec: FigureSpec; visible: boolean; speed: number };
const registry = new Map<SVGSVGElement, Reg>();
let raf = 0, last = 0;
const loop = (ms: number) => {
  if (ms - last > 32) {
    last = ms;
    registry.forEach((r, el) => { if (r.visible) el.innerHTML = frameToSvg(poseFrame(r.spec, phase(ms * r.speed))); });
  }
  raf = registry.size ? requestAnimationFrame(loop) : 0;
};
const io = typeof IntersectionObserver === "function"
  ? new IntersectionObserver((es) => es.forEach((e) => { const r = registry.get(e.target as SVGSVGElement); if (r) r.visible = e.isIntersecting; }), { rootMargin: "80px" })
  : null;

export function Figure({ spec, size = 112, className = "", still, k = 1, label, speed = 1 }: {
  spec: FigureSpec | null | undefined; size?: number; className?: string; still?: boolean; k?: number; label?: string; speed?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !spec) return;
    el.innerHTML = frameToSvg(poseFrame(spec, still || reducedMotion() ? k : 0));
    if (still || reducedMotion()) return;
    registry.set(el, { spec, visible: !io, speed });
    io?.observe(el);
    if (!raf) raf = requestAnimationFrame(loop);
    return () => { registry.delete(el); io?.unobserve(el); };
  }, [spec, still, k, speed]);
  if (!spec) return null;
  return (
    <svg ref={ref} className={"fig " + className} viewBox="0 -24 120 131" width={size} height={(size * 131) / 120}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
  );
}
