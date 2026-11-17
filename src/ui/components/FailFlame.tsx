// "Last set to failure" flame. Tap it to see why the app picked this exercise (a toast).
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

export function FailFlame({ why, size = 14 }: { why: string[] | undefined; size?: number }) {
  const { toast } = useStore();
  if (!why) return null;
  const show = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toast({ kind: "info", title: "Last set to failure", body: why.length ? why.join(" · ") : undefined });
  };
  return (
    <span className="fail-icon" role="button" tabIndex={0} aria-label="Last set to failure: why" title="Last set to failure"
      onClick={show} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && show(e)}
      // Keep the row's press-and-hold drag and tap from starting
      onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <Icon name="flame" size={size} />
    </span>
  );
}
