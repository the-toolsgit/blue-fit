import type { Routine, RoutineDay } from "./types";

/** The current routine's day for a date's weekday. null = rest day (no day, or a day without exercises). */
export function dayForDate(routine: Routine | undefined, date: Date): RoutineDay | null {
  const day = routine?.days.find((d) => d.weekday === date.getDay());
  return day && day.slots.length ? day : null;
}
