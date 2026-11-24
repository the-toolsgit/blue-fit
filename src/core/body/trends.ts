// Body scan history: order, compare, chart (framework-free). Trend rules for plan
// suggestions (MDC, gates) come in step 5 (docs/plans/body-scan.md §5–6).
import { BODY_PARTS, type BodyPart, type BodyScan, type ScanSource } from "./types";

/** Newest first. */
export const sortScans = (scans: BodyScan[]) => [...scans].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/** Scans compare only within one method: a manual tape and a camera scan measure differently. */
export const sameMethod = (a: BodyScan, b: BodyScan) => a.source === b.source;

/** The scan before `scan` made the same way (or undefined). */
export function previousOf(scans: BodyScan[], scan: BodyScan): BodyScan | undefined {
  return sortScans(scans).find((s) => s.date < scan.date && sameMethod(s, scan));
}

export interface PartChange { part: BodyPart; value: number; before?: number; diff?: number }

/** Every measured part of `scan` with its change since `prev` (cm). */
export function partChanges(scan: BodyScan, prev?: BodyScan): PartChange[] {
  return BODY_PARTS.filter((p) => scan.measurements[p] != null).map((part) => {
    const value = scan.measurements[part]!;
    const before = prev?.measurements[part];
    return { part, value, before, diff: before != null ? Math.round((value - before) * 10) / 10 : undefined };
  });
}

/** One part over time (oldest first), one method only. */
export function partSeries(scans: BodyScan[], part: BodyPart | "bodyFatPct" | "weightLb", source: ScanSource): { date: string; value: number }[] {
  return sortScans(scans).reverse().filter((s) => s.source === source).flatMap((s) => {
    const v = part === "bodyFatPct" ? s.bodyFatPct : part === "weightLb" ? s.weightLb : s.measurements[part];
    return v != null ? [{ date: s.date, value: v }] : [];
  });
}

export const CM_PER_IN = 2.54;
/** A length in the user's unit, 1 decimal. */
export const toUnit = (cm: number, unit: "in" | "cm") => Math.round((unit === "in" ? cm / CM_PER_IN : cm) * 10) / 10;
export const fromUnit = (v: number, unit: "in" | "cm") => (unit === "in" ? v * CM_PER_IN : v);
