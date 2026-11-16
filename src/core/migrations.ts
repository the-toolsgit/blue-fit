// One-time data migrations applied on launch. Each runs once (its id is remembered in meta).
import type { AppData, Routine } from "./types";

/** Move every routine day by `by` weekdays (e.g. −2: Monday → Saturday). Days keep their ids, so history stays linked. */
export function shiftWeekdays(r: Routine, by: number): Routine {
  return { ...r, days: r.days.map((d) => (d.weekday == null ? d : { ...d, weekday: (((d.weekday + by) % 7) + 7) % 7 })) };
}

export interface Migration { id: string; run(d: AppData): AppData | null }

export const MIGRATIONS: Migration[] = [
  {
    // Nov 16 2026: Leo's training week now starts on Saturday. Monday's day moves to Saturday,
    // Tuesday's to Sunday, and so on. Only if the plan still has its original weekdays.
    id: "2026-11-16-week-starts-saturday",
    run(d) {
      const r = d.routines.find((x) => x.id === "leo-v3-1");
      if (!r || r.days.find((x) => x.id === "mon")?.weekday !== 1) return null;
      return { ...d, routines: d.routines.map((x) => (x.id === r.id ? shiftWeekdays(x, -2) : x)), settings: { ...d.settings, weekStartDay: 6 } };
    },
  },
];
