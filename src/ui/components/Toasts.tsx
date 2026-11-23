import { useRef, type ReactNode } from "react";
import { FLEX } from "../../core/figure/poses";
import { useStore } from "../store";
import { Figure } from "./Figure";
import { Icon } from "./Icon";

const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return { dx: `${Math.cos(a) * 34}px`, dy: `${Math.sin(a) * 34}px`, delay: `${(i % 3) * 60}ms` };
});

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <Swipeable key={t.id} className={"toast " + t.kind + (t.leaving ? " out" : "")} onClose={() => dismissToast(t.id)}>
          {t.kind === "pr" ? (
            <div style={{ position: "relative", width: 44, height: 48, flex: "none" }}>
              <Figure spec={FLEX} size={44} speed={2} />
              {SPARKS.map((s, i) => <i key={i} className="spark" style={{ left: 20, top: 22, ["--dx" as string]: s.dx, ["--dy" as string]: s.dy, animationDelay: s.delay }} />)}
            </div>
          ) : (
            <span style={{ color: t.kind === "error" ? "var(--bad)" : t.kind === "warn" ? "var(--warn)" : "var(--neon-ink)" }}><Icon name={t.kind === "error" || t.kind === "warn" ? "info" : "bolt"} /></span>
          )}
          <div className="grow">
            <div style={{ font: "700 17px var(--display)", letterSpacing: ".06em", textTransform: "uppercase", color: t.kind === "pr" ? "var(--pink)" : undefined }}>{t.title}</div>
            {t.body && <div className="muted" style={{ fontSize: 13 }}>{t.body}</div>}
          </div>
          {t.action && <button type="button" className="btn btn-ghost toast-act" onClick={(e) => { e.stopPropagation(); t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>}
        </Swipeable>
      ))}
    </div>
  );
}

/** A notification follows your finger up and closes when swiped up (or tapped). Pulling down barely moves it. */
function Swipeable({ className, onClose, children }: { className: string; onClose: () => void; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const g = useRef({ y0: 0, t0: 0, dy: 0, moved: false });
  const set = (y: number, anim: boolean) => {
    const n = el.current;
    if (!n) return;
    n.style.transition = anim ? "transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s" : "none";
    n.style.transform = y ? `translateY(${y}px)` : "";
    n.style.opacity = y < 0 ? String(Math.max(0.2, 1 + y / 120)) : "";
  };
  return (
    <div ref={el} className={className} role="status"
      onTouchStart={(e) => { g.current = { y0: e.touches[0].clientY, t0: performance.now(), dy: 0, moved: false }; set(0, false); }}
      onTouchMove={(e) => {
        const dy = e.touches[0].clientY - g.current.y0;
        g.current.dy = dy;
        if (Math.abs(dy) > 4) g.current.moved = true;
        set(dy < 0 ? dy : dy / 4, false);
      }}
      onTouchEnd={() => {
        const { dy, t0 } = g.current;
        const fast = dy < -12 && performance.now() - t0 < 250;
        if (dy < -36 || fast) { set(-160, true); setTimeout(onClose, 180); } else set(0, true);
      }}
      onClick={() => { if (!g.current.moved) onClose(); }}>
      {children}
    </div>
  );
}
