// Small framework-free helpers.
/** Random id. randomUUID only exists on https (not on the dev server over the local network), so the fallback puts
 *  random characters first: callers use the first 8 (`uid().slice(0, 8)`), which must differ every call. */
export const uid = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const r = new Uint32Array(2);
  if (typeof globalThis.crypto?.getRandomValues === "function") globalThis.crypto.getRandomValues(r);
  else { r[0] = Math.random() * 2 ** 32; r[1] = Math.random() * 2 ** 32; }
  return r[0].toString(36).padStart(7, "0") + r[1].toString(36).padStart(7, "0") + Date.now().toString(36);
};

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar date YYYY-MM-DD */
export const localDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseLocalDate = (s: string): Date => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
/** First day of the week containing date s (local YYYY-MM-DD). startDay: 0 = Sunday … 6 = Saturday (default Monday). */
export const weekStart = (s: string, startDay = 1): string => { const d = parseLocalDate(s); d.setDate(d.getDate() - ((d.getDay() - startDay + 7) % 7)); return localDate(d); };
/** Weekdays in week order starting at startDay, e.g. 6 → [6, 0, 1, 2, 3, 4, 5] */
export const weekOrder = (startDay = 1): number[] => Array.from({ length: 7 }, (_, i) => (startDay + i) % 7);
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));
/** Add days to a local YYYY-MM-DD date */
export const addDays = (s: string, n: number): string => { const d = parseLocalDate(s); d.setDate(d.getDate() + n); return localDate(d); };
/** Whole days from a to b (b − a), local calendar dates */
export const daysBetween = (a: string, b: string): number => Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86_400_000);
