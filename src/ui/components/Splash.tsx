// Launch splash: the line man (FLEX pose) above "BLUE FIT"; then we zoom into his head and the app
// appears inside the circle. Mounted once per app launch (returning from the background doesn't remount it).
import { useEffect, useRef, useState } from "react";
import { FLEX } from "../../core/figure/poses";
import { poseFrame } from "../../core/figure/engine";
import { reducedMotion } from "../device";
import { Figure } from "./Figure";

const FIG_W = 150; // px
const INTRO_MS = 380, HOLD_MS = 260, ZOOM_MS = 720;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function Splash({ onDone }: { onDone: () => void }) {
  const overlay = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const figBox = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (reducedMotion()) {
      const a = setTimeout(() => setFade(true), 350), b = setTimeout(onDone, 650);
      return () => { clearTimeout(a); clearTimeout(b); };
    }
    let raf = 0;
    const start = setTimeout(() => {
      const ov = overlay.current, st = stage.current, box = figBox.current?.querySelector("svg");
      if (!ov || !st || !box) return onDone();
      // Measure the final resting position: settle the intro animation first (else the zoom drifts off the head).
      st.getAnimations?.({ subtree: true }).forEach((a) => a.finish());
      // Head center and inner radius in screen px (figure viewBox: x 0–120, y −24–107).
      const head = poseFrame(FLEX, 1).head;
      const r = box.getBoundingClientRect(), k = r.width / 120;
      const cx = r.left + head.cx * k, cy = r.top + (head.cy + 24) * k;
      const inner = (head.r - 1.3) * k;
      const cover = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) * 1.05;
      const maxScale = cover / inner;
      st.style.transformOrigin = `${cx}px ${cy}px`;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / ZOOM_MS), e = ease(p);
        const s = Math.exp(e * Math.log(maxScale));
        st.style.transform = `scale(${s})`;
        const hole = Math.max(0, inner * s);
        const m = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${hole}px, #000 ${hole + 1}px)`;
        ov.style.webkitMaskImage = m;
        ov.style.maskImage = m;
        if (word.current) word.current.style.opacity = String(Math.max(0, 1 - p * 3));
        if (p < 1) raf = requestAnimationFrame(tick);
        else onDone();
      };
      raf = requestAnimationFrame(tick);
    }, INTRO_MS + HOLD_MS);
    return () => { clearTimeout(start); cancelAnimationFrame(raf); };
  }, [onDone]);

  return (
    <div ref={overlay} className="splash" aria-hidden="true" style={fade ? { opacity: 0, transition: "opacity .3s ease" } : undefined}>
      <div className="bg-fx" style={{ position: "absolute" }} />
      <div ref={stage} className="splash-stage">
        <div ref={figBox} className="splash-fig"><Figure spec={FLEX} size={FIG_W} still k={1} /></div>
        <div ref={word} className="splash-word neon">BLUE FIT</div>
      </div>
    </div>
  );
}
