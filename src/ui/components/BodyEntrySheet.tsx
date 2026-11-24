// Manual body measurements (tape) — and edit of any scan's date, height and weight
// (docs/plans/body-scan.md step 2). Values are typed in the user's length unit.
import { useEffect, useState } from "react";
import { bodyStats, MEASURE_VERSION } from "../../core/body/measure";
import { fromUnit, toUnit } from "../../core/body/trends";
import { BODY_PARTS, PART_NAMES, type BodyPart, type BodyScan, type Sex } from "../../core/body/types";
import { uid } from "../../core/util";
import { Seg, Stepper } from "./Controls";
import { Sheet } from "./Sheet";
import { useStore } from "../store";

const nowLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function BodyEntrySheet({ open, scan, onClose }: { open: boolean; scan?: BodyScan | null; onClose: () => void }) {
  const { settings, saveSettings, saveBodyScan, toast } = useStore();
  const unit = settings.lengthUnit ?? "in";
  const manual = !scan || scan.source === "manual";
  const [date, setDate] = useState(nowLocal());
  const [height, setHeight] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [sex, setSex] = useState<Sex>("male");
  const [vals, setVals] = useState<Partial<Record<BodyPart, number | null>>>({});
  useEffect(() => {
    if (!open) return;
    setDate(scan?.date ?? nowLocal());
    const h = scan?.heightCm ?? settings.heightCm ?? null;
    setHeight(h != null ? toUnit(h, unit) : null);
    setWeight(scan?.weightLb ?? null);
    setSex(scan?.sex ?? settings.sex ?? "male");
    setVals(Object.fromEntries(BODY_PARTS.map((p) => [p, scan?.measurements[p] != null ? toUnit(scan.measurements[p]!, unit) : null])));
  }, [open, scan, settings.heightCm, settings.sex, unit]);

  const save = () => {
    if (height == null || height <= 0) { toast({ kind: "warn", title: "Add your height", body: "Body fat needs it." }); return; }
    const heightCm = Math.round(fromUnit(height, unit) * 10) / 10;
    const measurements: Partial<Record<BodyPart, number>> = manual
      ? Object.fromEntries(BODY_PARTS.flatMap((p) => (vals[p] != null && vals[p]! > 0 ? [[p, Math.round(fromUnit(vals[p]!, unit) * 10) / 10]] : [])))
      : scan!.measurements;
    if (manual && !Object.keys(measurements).length) { toast({ kind: "warn", title: "Add at least one measurement" }); return; }
    const next: BodyScan = {
      ...(scan ?? { id: uid(), source: "manual", scannerVersion: "manual", measureVersion: MEASURE_VERSION }),
      date, heightCm, sex, weightLb: weight ?? undefined, measurements,
      confidence: manual ? Object.fromEntries(Object.keys(measurements).map((k) => [k, 1])) : scan!.confidence,
    } as BodyScan;
    Object.assign(next, bodyStats(sex, heightCm, measurements));
    saveBodyScan(next);
    if (settings.heightCm !== heightCm || settings.sex !== sex) saveSettings({ ...settings, heightCm, sex });
    toast({ kind: "info", title: scan ? "Saved" : "Measurements added" });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label={scan ? "Edit body measurements" : "Add body measurements"}>
      <div className="stack">
        <h3 className="title-md">{scan ? (manual ? "Edit measurements" : "Edit scan details") : "Add measurements"}</h3>
        <label className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">Date and time</span>
          <input className="input" type="datetime-local" value={date} onChange={(e) => e.target.value && setDate(e.target.value.slice(0, 16))} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <Stepper label="Height" suffix={unit} value={height} step={unit === "in" ? 0.5 : 1} min={0} empty={unit === "in" ? 68 : 173} onChange={setHeight} />
          <Stepper label="Weight" suffix="lb" value={weight} step={0.5} min={0} empty={180} onChange={setWeight} />
        </div>
        <div><span className="eyebrow" style={{ display: "block", margin: "0 2px 8px" }}>Body fat formula</span>
          <Seg label="Sex" value={sex} onChange={setSex} options={[{ v: "male", label: "Male" }, { v: "female", label: "Female" }]} /></div>
        {manual && <>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>Tape snug, not tight, in {unit === "in" ? "inches" : "cm"}. Leave out what you didn't measure. Body fat needs neck and lower waist (women: upper waist and hips too).</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {BODY_PARTS.map((p) => (
              <Stepper key={p} label={PART_NAMES[p]} suffix={unit} value={vals[p] ?? null} step={unit === "in" ? 0.25 : 0.5} min={0} onChange={(v) => setVals((x) => ({ ...x, [p]: v }))} />
            ))}
          </div>
        </>}
        <button className="btn btn-primary btn-block" style={{ minHeight: 54 }} onClick={save}>Save</button>
        <button className="btn btn-quiet btn-block" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}
