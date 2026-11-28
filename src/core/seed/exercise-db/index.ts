// The exercise database (one file per main muscle), built into the app's Exercise shape. Loaded lazily by the store.
// Plain imports so core stays portable (no bundler globs).
import type { Exercise } from "../../types";
import { buildFigure, withPlates, type FigureAdjust } from "../../figure/templates";
import { withDerivedMuscles } from "../../customExercise";
import abs from "./abs.json";
import adductors from "./adductors.json";
import back from "./back.json";
import biceps from "./biceps.json";
import calves from "./calves.json";
import chest from "./chest.json";
import forearms from "./forearms.json";
import frontDelts from "./frontDelts.json";
import glutes from "./glutes.json";
import hamstrings from "./hamstrings.json";
import neck from "./neck.json";
import quads from "./quads.json";
import rearDelts from "./rearDelts.json";
import sideDelts from "./sideDelts.json";
import traps from "./traps.json";
import triceps from "./triceps.json";

/** A raw database entry (fields as in the JSON files). */
export type DbEntry = Omit<Exercise, "figure" | "muscles" | "secondaryMuscles" | "isCustom" | "archived" | "tips" | "avoid"> & {
  tips?: string[]; avoid?: string[]; figureTemplate: string; figureAdjust?: FigureAdjust;
  preferred?: { goals: string[]; why: string; source?: unknown }; source?: unknown; evidence?: unknown;
};

export const DB_ENTRIES = [abs, adductors, back, biceps, calves, chest, forearms, frontDelts, glutes, hamstrings, neck, quads, rearDelts, sideDelts, traps, triceps].flat() as unknown as DbEntry[];

/** One database entry as an app exercise (figure from its template, muscle names from its volume). */
export function toExercise(e: DbEntry): Exercise {
  const { figureTemplate, figureAdjust, source: _s, evidence: _e, preferred, ...rest } = e;
  return withDerivedMuscles({
    ...rest, muscles: [], secondaryMuscles: [], tips: e.tips ?? [], avoid: e.avoid ?? [],
    ...(preferred ? { preferred: { goals: preferred.goals, why: preferred.why } } : {}),
    figure: withPlates(buildFigure(figureTemplate, figureAdjust ?? {}), e.equipment as string), isCustom: false, archived: false,
  } as Exercise);
}

let cache: Exercise[] | null = null;
/** Every database exercise, built once. */
export const catalog = (): Exercise[] => (cache ??= DB_ENTRIES.map(toExercise));
