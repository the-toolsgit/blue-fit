// "Last set to failure" flame, and the hook that works out this week's flames.
import { useMemo } from "react";
import { weekFailure } from "../../core/failure";
import type { Routine, VolumeTarget } from "../../core/types";
import { localDate } from "../../core/util";
import { useStore } from "../store";
import { Icon } from "./Icon";

/** This week's flames for a routine (the saved plan or an Edit plan draft): dayId → slotId → reasons. */
export function useWeekFailure(routine: Routine | undefined, targetsDraft?: VolumeTarget[]) {
  const { exMap, targets: saved, settings, finished } = useStore();
  const targets = targetsDraft ?? saved;
  const today = localDate(new Date());
  return useMemo(() => (routine ? weekFailure({ routine, exMap, targets, settings, finished, today }) : new Map<string, Map<string, string[]>>()),
    [routine, exMap, targets, settings, finished, today]);
}

/** Flame next to an exercise name. The reasons are shown on the exercise's page (tap the row). */
export function FailFlame({ why, size = 14 }: { why: string[] | undefined; size?: number }) {
  if (!why) return null;
  return <span className="fail-icon" title="Last set to failure" aria-label="Last set to failure"><Icon name="flame" size={size} /></span>;
}
