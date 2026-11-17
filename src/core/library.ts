// Exercise library: every gym exercise the app knows, with muscles, weekly-set weights and the ★ heavy-lift mark.
// Data only (src/core/seed/library.json, built by scripts/build-library.mjs); used for plan building later.
// Rule and sources: docs/plans/exercise-library.md.
import type { Equipment, MuscleGroup, VolumeShare } from "./types";
import data from "./seed/library.json";

export interface LibraryExercise {
  id: string;
  name: string;
  aliases?: string[];
  equipment: Equipment;
  /** Movement template the muscles come from (e.g. "row", "press", "lateral") */
  movement: string;
  compound: boolean;
  volume: VolumeShare[];
  /** ★ heavy lift, with the reason from the rule */
  isHeavy: boolean;
  heavyWhy: string;
  /** Where it comes from: free-exercise-db entry, a Jeff Nippard source, or Leo's plan */
  source: { db?: string; id?: string; mechanic?: string | null; primaryMuscles?: string[]; nippard?: string; plan?: string };
  /** Ids of the same exercise in Leo's plan */
  planIds?: string[];
}

export const LIBRARY = (data as { exercises: LibraryExercise[] }).exercises;
export const LIBRARY_GROUPS = (): Set<MuscleGroup> => new Set(LIBRARY.flatMap((e) => e.volume.map((v) => v.group)));
