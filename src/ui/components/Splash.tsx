// Launch splash: the line man above "BLUE FIT" flexes once (forearms curl in, upper arms stay flat, a bicep
// pops up and stays), then we zoom into his head and the app appears inside the circle. Mounted once per app launch (returning from the background doesn't remount it).
import { useEffect, useRef, useState } from "react";
import { SPLASH_FLEX } from "../../core/figure/poses";
import { bicepBumps, bumpsToSvg } from "../../core/figure/flex";
import { frameToSvg } from "../../core/figure/svg";
import { poseFrame } from "../../core/figure/engine";
import { reducedMotion } from "../device";

const FIG_W = 150; // px
const INTRO_MS = 380, FLEX_MS = 1000, ZOOM_MS = 720;
const FLEX_UP_MS = 420; // the flex itself; it then holds for the rest of FLEX_MS and through the zoom
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const draw = (k: number) => { const f = poseFrame(SPLASH_FLEX, k); return frameToSvg(f) + bumpsToSvg(bicepBumps(f, k)); };

export function Splash({ onDone, word: text = "BLUE FIT" }: { onDone: () => void; /** The word under the figure (Build my plan: "Your plan") */ word?: string }) {
  const overlay = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(false);
  const fig = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (fig.current) fig.current.innerHTML = draw(0);
    if (reducedMotion()) {
      const a = setTimeout(() => setFade(true), 350), b = setTimeout(onDone, 650);
      return () => { clearTimeout(a); clearTimeout(b); };
    }
    let raf = 0;
    // One flex: forearms curl in and the bicep pops up, then it stays flexed (through the zoom too).
    const flexStart = setTimeout(() => {
      const t0 = performance.now();
      const flex = (now: number) => {
        const t = Math.min(1, (now - t0) / FLEX_UP_MS);
        if (fig.current) fig.current.innerHTML = draw(easeOut(t));
        if (t < 1) raf = requestAnimationFrame(flex);
      };
      raf = requestAnimationFrame(flex);
    }, INTRO_MS);
    const start = setTimeout(() => {
      cancelAnimationFrame(raf);
      if (fig.current) fig.current.innerHTML = draw(1);
      const ov = overlay.current, st = stage.current, box = fig.current;
      if (!ov || !st || !box) return onDone();
      // Measure the final resting position: settle the intro animation first (else the zoom drifts off the head).
      st.getAnimations?.({ subtree: true }).forEach((a) => a.finish());
      // Head center and inner radius in screen px (figure viewBox: x 0–120, y −24–107).
      const head = poseFrame(SPLASH_FLEX, 1).head;
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
    }, INTRO_MS + FLEX_MS);
    return () => { clearTimeout(flexStart); clearTimeout(start); cancelAnimationFrame(raf); };
  }, [onDone]);

  return (
    <div ref={overlay} className="splash" aria-hidden="true" style={fade ? { opacity: 0, transition: "opacity .3s ease" } : undefined}>
      <div className="bg-fx" style={{ position: "absolute" }} />
      <div ref={stage} className="splash-stage">
        <div className="splash-fig"><svg ref={fig} className="fig" viewBox="0 -24 120 131" width={FIG_W} height={(FIG_W * 131) / 120} /></div>
        <div ref={word} className="splash-word brand">{text.toUpperCase()}</div>
      </div>
    </div>
  );
}
