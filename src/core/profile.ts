// Age and years lifting from dates, so they stay current on their own (Leo, Nov 25 2026).
import type { ProfileDraft } from "./types";

/** Whole years from a birthday ("YYYY-MM-DD") to `today` ("YYYY-MM-DD"). */
export function ageOn(born: string, today: string): number {
  const [by, bm, bd] = born.split("-").map(Number), [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Years since a start month ("YYYY-MM") to `today`, in half years (rounded down), never below 0. */
export function yearsSince(since: string, today: string): number {
  const [sy, sm] = since.split("-").map(Number), [ty, tm] = today.split("-").map(Number);
  const months = (ty - sy) * 12 + (tm - sm);
  return Math.max(0, Math.floor(months / 6) / 2);
}

/** The profile with age and years lifting worked out from the saved dates (when set). */
export function resolveProfile<P extends ProfileDraft | null | undefined>(p: P, today: string): P {
  if (!p || (!p.born && !p.liftingSince)) return p;
  return { ...p, age: p.born ? ageOn(p.born, today) : p.age, yearsTraining: p.liftingSince ? yearsSince(p.liftingSince, today) : p.yearsTraining };
}
