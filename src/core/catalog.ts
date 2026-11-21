// Joins the exercise database (built-in) with the exercises saved on the phone. Plan: docs/plans/app-reads-exercise-db.md.
// Phone exercises win on name, text, volume, figure; for the app's own (not custom) exercises the tags always come
// from the database. Database-only exercises are listed for picking; picking one saves a full copy on the phone.
import type { Exercise, Goal } from "./types";

/** Fields the database owns for the app's own exercises (the user can't edit them). */
const TAGS = ["jobs", "stretch", "compound", "unsafeFailure", "heavyWhy", "measure", "formerIds", "preferred", "assisted"] as const;

export interface Catalog {
  /** Phone exercises (tags filled in) + database exercises not on the phone */
  exercises: Exercise[];
  /** By id, plus old ids (formerIds) of database exercises */
  exMap: Map<string, Exercise>;
  /** Ids saved on the phone */
  phoneIds: Set<string>;
}

export function mergeCatalog(phone: Exercise[], db: Exercise[]): Catalog {
  const dbById = new Map(db.map((e) => [e.id, e]));
  const withTags = phone.map((p) => {
    const d = !p.isCustom ? dbById.get(p.id) : undefined;
    if (!d) return p;
    const out: Exercise = { ...p };
    for (const k of TAGS) if (d[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = d[k];
    return out;
  });
  const phoneIds = new Set(phone.map((e) => e.id));
  const names = new Set(phone.filter((e) => !e.archived).map((e) => e.name.trim().toLowerCase()));
  const extra = db.filter((e) => !phoneIds.has(e.id) && !names.has(e.name.trim().toLowerCase()));
  const exercises = [...withTags, ...extra];
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  // Database exercises hidden by a same-name phone exercise still open by id (history, plans)
  for (const e of db) if (!exMap.has(e.id)) exMap.set(e.id, e);
  for (const e of db) for (const old of e.formerIds ?? []) if (!exMap.has(old)) exMap.set(old, exMap.get(e.id)!);
  return { exercises, exMap, phoneIds };
}

/** Top pick for this goal: strength has its own list; growth, endurance, maintenance (and no profile) use growth. */
export const isTopPick = (e: Exercise, goal: Goal | undefined): boolean =>
  !!e.preferred?.goals.includes(goal === "strength" ? "strength" : "growth");
