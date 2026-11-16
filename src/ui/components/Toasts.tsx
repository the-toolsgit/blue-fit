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
        <div key={t.id} className={"toast " + t.kind + (t.leaving ? " out" : "")} role="status" onClick={() => dismissToast(t.id)}>
          {t.kind === "pr" ? (
            <div style={{ position: "relative", width: 44, height: 48, flex: "none" }}>
              <Figure spec={FLEX} size={44} speed={2} />
              {SPARKS.map((s, i) => <i key={i} className="spark" style={{ left: 20, top: 22, ["--dx" as string]: s.dx, ["--dy" as string]: s.dy, animationDelay: s.delay }} />)}
            </div>
          ) : (
            <span style={{ color: t.kind === "error" ? "var(--bad)" : "var(--neon-ink)" }}><Icon name={t.kind === "error" ? "info" : "bolt"} /></span>
          )}
          <div className="grow">
            <div style={{ font: "700 17px var(--display)", letterSpacing: ".06em", textTransform: "uppercase", color: t.kind === "pr" ? "var(--pink)" : undefined }}>{t.title}</div>
            {t.body && <div className="muted" style={{ fontSize: 13 }}>{t.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
