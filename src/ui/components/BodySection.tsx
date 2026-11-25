// Progress → Body: latest scan or tape measurements, change since the one before
// (same method only), a chart per part, the list of scans (docs/plans/body-scan.md step 2).
import { useMemo, useState } from "react";
import { partChanges, partSeries, previousOf, sortScans, toUnit } from "../../core/body/trends";
import { BODY_PARTS, PART_NAMES, type BodyPart, type BodyScan } from "../../core/body/types";
import { fmtNum } from "../../core/util";
import { dayLabel, LineChart } from "./Charts";
import { BodyEntrySheet } from "./BodyEntrySheet";
import { Confirm, Sheet } from "./Sheet";
import { useKeptState } from "../keptState";
import { useStore } from "../store";
import { go } from "../router";

const SOURCE: Record<BodyScan["source"], string> = { "web-camera": "Camera scan", "native-camera": "Camera scan", manual: "Tape" };
const when = (d: string) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
type Metric = BodyPart | "bodyFatPct" | "weightLb";

export function BodySection() {
  const { bodyScans, settings, deleteBodyScan, toast } = useStore();
  const unit = settings.lengthUnit ?? "in";
  const scans = useMemo(() => sortScans(bodyScans), [bodyScans]);
  const latest = scans[0];
  const prev = latest && previousOf(scans, latest);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<BodyScan | null>(null);
  const [editing, setEditing] = useState<BodyScan | null>(null);
  const [del, setDel] = useState<BodyScan | null>(null);
  const [metric, setMetric] = useKeptState<Metric>("progress-body-metric", "waistLower");
  // Chips only for what the chart can show: entries made the same way as the latest
  const same = latest ? scans.filter((s) => s.source === latest.source) : [];
  const metrics: Metric[] = [...BODY_PARTS.filter((p) => same.some((s) => s.measurements[p] != null)), ...(same.some((s) => s.bodyFatPct != null) ? ["bodyFatPct" as const] : []), ...(same.some((s) => s.weightLb != null) ? ["weightLb" as const] : [])];
  const m = metrics.includes(metric) ? metric : metrics[0];
  const series = latest && m ? partSeries(scans, m, latest.source) : [];
  const metricUnit = (k: Metric) => (k === "bodyFatPct" ? "%" : k === "weightLb" ? "lb" : unit);
  const metricVal = (k: Metric, v: number) => (k === "bodyFatPct" || k === "weightLb" ? v : toUnit(v, unit));
  const metricName = (k: Metric) => (k === "bodyFatPct" ? "Body fat" : k === "weightLb" ? "Weight" : PART_NAMES[k]);

  return (
    <>
      <h2 className="section-title">Body</h2>
      <section className="glass" style={{ padding: 14 }}>
        {!latest ? (
          <div className="stack" style={{ gap: 10 }}>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>Track chest, waist, arms, thighs and body fat with a 3D camera scan, or add tape measurements.</p>
            <button className="btn btn-primary btn-block" onClick={() => go("scan")}>Scan my body</button>
            <button className="btn btn-ghost btn-block" onClick={() => setAdding(true)}>Add tape measurements</button>
          </div>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            <button className="list-row" style={{ display: "block", textAlign: "left" }} onClick={() => setOpen(latest)}>
              <span className="eyebrow">Latest · {SOURCE[latest.source]}</span>
              <span style={{ display: "block", fontSize: 14, marginTop: 2 }}>{when(latest.date)}{prev ? <span className="muted"> · vs {dayLabel(prev.date.slice(0, 10))}</span> : null}</span>
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {([
                [latest.bodyFatPct != null ? `${fmtNum(latest.bodyFatPct)}%` : "—", "body fat"],
                [latest.weightLb != null ? fmtNum(latest.weightLb) : "—", "weight lb"],
                [latest.waistToHeight != null ? latest.waistToHeight.toFixed(2) : "—", "waist ÷ height"],
              ] as const).map(([v, l]) => (
                <div key={l} className="glass edge" style={{ padding: "10px 8px", borderRadius: 14, textAlign: "center" }}>
                  <div className="mono neon" style={{ fontSize: 20, lineHeight: 1.1 }}>{v}</div><div className="eyebrow" style={{ fontSize: 9, marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
            <div>
              {partChanges(latest, prev).map((c) => {
                // change in the shown unit (a 0.1 cm change reads "=" in inches, never "↑ +0")
                const d = c.before == null ? null : Math.round((toUnit(c.value, unit) - toUnit(c.before, unit)) * 10) / 10;
                return (
                  <div key={c.part} className="list-row body-row">
                    <span className="grow">{PART_NAMES[c.part]}</span>
                    <span className="mono">{fmtNum(toUnit(c.value, unit))} <small className="muted">{unit}</small></span>
                    <span className={"mono body-diff" + (d ? (d > 0 ? " up" : " down") : "")}>{d == null ? "" : d === 0 ? "=" : `${d > 0 ? "↑ +" : "↓ −"}${fmtNum(Math.abs(d))}`}</span>
                  </div>
                );
              })}
            </div>
            {metrics.length > 0 && <>
              <div className="chips-scroll">
                {metrics.map((k) => <button key={k} className="chip" aria-pressed={m === k} onClick={() => setMetric(k)}>{metricName(k)}</button>)}
              </div>
              <LineChart key={m} points={series.map((p) => ({ label: dayLabel(p.date.slice(0, 10)), value: metricVal(m!, p.value) }))} unit={metricUnit(m!)} fmt={(n) => fmtNum(Math.round(n * 10) / 10)} />
              {scans.some((s) => s.source !== latest.source) && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Chart shows {SOURCE[latest.source].toLowerCase()} entries only: tape and camera measure differently.</p>}
            </>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button className="btn btn-primary" onClick={() => go("scan")}>Scan</button>
              <button className="btn btn-ghost" onClick={() => setAdding(true)}>Add tape</button>
            </div>
            {scans.length > 1 && <details className="body-history">
              <summary className="muted" style={{ fontSize: 13 }}>All entries ({scans.length})</summary>
              {scans.map((s) => (
                <button key={s.id} className="list-row" style={{ display: "flex", width: "100%" }} onClick={() => setOpen(s)}>
                  <span className="grow" style={{ textAlign: "left" }}>{when(s.date)}</span><span className="muted" style={{ fontSize: 12 }}>{SOURCE[s.source]}</span>
                </button>
              ))}
            </details>}
          </div>
        )}
      </section>

      <Sheet open={!!open} onClose={() => setOpen(null)} label="Body measurements">
        {open && <div className="stack">
          <span className="eyebrow">{SOURCE[open.source]}</span>
          <h3 className="title-md">{when(open.date)}</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Height {fmtNum(toUnit(open.heightCm, unit))} {unit}{open.weightLb != null ? ` · ${fmtNum(open.weightLb)} lb` : ""}{open.bodyFatPct != null ? ` · body fat ${fmtNum(open.bodyFatPct)}%` : ""}</p>
          <div>
            {partChanges(open, previousOf(scans, open)).map((c) => (
              <div key={c.part} className="list-row body-row"><span className="grow">{PART_NAMES[c.part]}</span><span className="mono">{fmtNum(toUnit(c.value, unit))} <small className="muted">{unit}</small></span></div>
            ))}
          </div>
          <button className="btn btn-ghost btn-block" onClick={() => { setEditing(open); setOpen(null); }}>Edit</button>
          <button className="btn btn-danger btn-block" onClick={() => { setDel(open); setOpen(null); }}>Delete</button>
        </div>}
      </Sheet>
      <BodyEntrySheet open={adding || !!editing} scan={editing} onClose={() => { setAdding(false); setEditing(null); }} />
      <Confirm open={!!del} title="Delete these measurements?" body={del && <>{SOURCE[del.source]} from {when(del.date)}. This can't be undone.</>} confirm="Delete" danger
        onClose={() => setDel(null)} onConfirm={() => { if (del) { deleteBodyScan(del.id); toast({ kind: "info", title: "Deleted" }); } }} />
    </>
  );
}
