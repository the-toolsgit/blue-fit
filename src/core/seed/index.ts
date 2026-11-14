// Seed data, extracted from the plan page (see scripts/extract-plan.mjs).
import exercises from "./exercises.json";
import routine from "./routine-leo-v3-1.json";
import targets from "./targets.json";
import { DEFAULT_SETTINGS, type AppData, type Exercise, type Routine, type VolumeTarget } from "../types";

export const SEED_VERSION = 1;

export function buildSeed(): AppData {
  const ex = structuredClone(exercises) as unknown as Exercise[];
  return {
    exercises: ex,
    routines: [structuredClone(routine) as Routine],
    sessions: [],
    targets: structuredClone(targets) as VolumeTarget[],
    settings: structuredClone(DEFAULT_SETTINGS),
    jefitAliases: ex.flatMap((e) => e.aliases.map((a) => ({ jefitName: a, exerciseId: e.id }))),
  };
}
