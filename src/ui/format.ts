import type { Exercise, LoggedSet } from "../core/types";
import { fmtNum } from "../core/util";

export const fmtW = (w: number | null | undefined) => (w == null ? "—" : fmtNum(w));
export const fmtClock = (sec: number) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
export const fmtRest = (sec: number) => (sec % 60 === 0 ? `${sec / 60} min` : fmtClock(sec));
export const repRange = (min?: number, max?: number) => (min == null ? "" : max == null || max === min ? `${min}` : `${min}–${max}`);
export const setsLine = (sets: LoggedSet[]) => {
  const w = sets.filter((x) => x.done && x.type !== "warmup");
  if (!w.length) return "";
  const same = w.every((x) => x.weight === w[0].weight);
  return same ? `${fmtW(w[0].weight)} × ${w.map((x) => x.reps ?? "—").join(", ")}` : w.map((x) => `${fmtW(x.weight)}×${x.reps ?? "—"}`).join(", ");
};
export const loadSuffix = (e: Exercise) => (e.loadMode === "perSide" ? " /side" : e.loadMode === "perHand" ? " /hand" : "");
export const fmtVolume = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString("en-US"));
export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", opts);
};
