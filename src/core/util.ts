// Small framework-free helpers.
export const uid = (): string =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar date YYYY-MM-DD */
export const localDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseLocalDate = (s: string): Date => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
/** Monday-based week start (local) as YYYY-MM-DD */
export const weekStart = (s: string): string => { const d = parseLocalDate(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localDate(d); };
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));
