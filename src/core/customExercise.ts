// Custom exercises: creation, derived display fields, delete vs archive.
import { MUSCLE_GROUPS, muscleLabel, type Equipment, type Exercise, type LoadMode, type Routine, type Session, type VolumeShare } from "./types";
import { uid } from "./util";

/** Sensible load mode for an equipment type (the user can change it). */
export const defaultLoadMode = (eq: Equipment): LoadMode =>
  eq === "barbell" || eq === "smith" || eq === "plateMachine" ? "perSide" : eq === "dumbbell" ? "perHand" : "total";

export function newCustomExercise(name: string): Exercise {
  return {
    id: "custom-" + uid().slice(0, 8), name, aliases: [], muscles: [], secondaryMuscles: [], volume: [],
    equipment: "machine", loadMode: "total", isHeavy: false, bodyRegion: "upper",
    why: "", setup: [], form: [], tips: [], avoid: [], rangeOfMotion: "", tempo: "1–2 s up, 2–3 s down",
    defaultRestSec: 120, incrementLb: 5, figure: null, isCustom: true, archived: false,
  };
}

/** Display muscles follow the volume mapping (direct → primary, indirect → secondary), kept in muscle-group order. */
export function withDerivedMuscles(ex: Exercise): Exercise {
  const order = (v: VolumeShare[]) => MUSCLE_GROUPS.filter((m) => v.some((x) => x.group === m.id)).map((m) => muscleLabel(m.id));
  const lower = new Set(["quads", "hamstrings", "adductors", "calves", "glutes"]);
  const direct = ex.volume.filter((v) => v.weight === 1);
  return {
    ...ex,
    muscles: order(direct),
    secondaryMuscles: order(ex.volume.filter((v) => v.weight === 0.5)),
    bodyRegion: direct.length && direct.every((v) => lower.has(v.group)) ? "lower" : "upper",
  };
}

/** Exercises in history or in any routine are archived (hidden) instead of deleted, so nothing breaks. */
export function exerciseInUse(id: string, sessions: Session[], routines: Routine[]): boolean {
  return sessions.some((s) => s.entries.some((e) => e.exerciseId === id || e.swappedFromId === id))
    || routines.some((r) => r.days.some((d) => d.slots.some((sl) => sl.exerciseId === id)));
}

/** Text area ↔ list helpers: one item per line. */
export const linesToList = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);
export const listToLines = (l: string[]) => l.join("\n");
