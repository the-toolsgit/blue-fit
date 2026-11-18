// Seed data, extracted from the plan page (see scripts/extract-plan.mjs).
import exercises from "./exercises.json";
import routine from "./routine-leo-v3-1.json";
import targets from "./targets.json";
import plainText from "./exercise-text.json";
import exerciseAngles from "./exercise-angles.json";
import { RULE_TEXT, RULE_TITLE } from "./rule-text";
import { DEFAULT_SETTINGS, type AppData, type Exercise, type MuscleGroup, type Routine, type VolumeTarget } from "../types";

export const SEED_VERSION = 1;

/** Each built-in exercise's angle per muscle (matches the angle names in targets.json). */
export const ANGLES = exerciseAngles as unknown as Record<string, Partial<Record<MuscleGroup, string>>>;

/** Plain wording for rule cards whose text is still the original. */
export const withRuleText = (r: Routine): Routine =>
  r.rules ? { ...r, rules: r.rules.map((x) => (RULE_TEXT[x.title]?.old.includes(x.text) ? { ...x, text: RULE_TEXT[x.title].text } : x)).map((x) => (RULE_TITLE[x.title] ? { ...x, title: RULE_TITLE[x.title] } : x)) } : r;

export function buildSeed(): AppData {
  // Plain-language how-to texts override the extracted ones (kept in their own file so `npm run seed` doesn't undo them)
  const text = plainText as unknown as Record<string, Partial<Exercise>>;
  const ex = (structuredClone(exercises) as unknown as Exercise[]).map((e) => ({ ...e, ...(text[e.id] ?? {}) }))
    .map((e) => (ANGLES[e.id] ? { ...e, angles: ANGLES[e.id] } : e));
  return {
    exercises: ex,
    routines: [withRuleText(structuredClone(routine) as Routine)],
    sessions: [],
    targets: structuredClone(targets) as VolumeTarget[],
    settings: structuredClone(DEFAULT_SETTINGS),
    jefitAliases: ex.flatMap((e) => e.aliases.map((a) => ({ jefitName: a, exerciseId: e.id }))),
  };
}
