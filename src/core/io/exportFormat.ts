// Versioned JSON backup format. Validates strictly; refuses bad data with a clear message.
import { z } from "zod";
import { ACCENTS, type AppData } from "../types";

export const APP_ID = "blue-fit";
export const SCHEMA_VERSION = 1;

const group = z.enum(["back", "biceps", "triceps", "sideDelts", "rearDelts", "traps", "frontDelts", "chest", "quads", "hamstrings", "adductors", "calves", "glutes", "rotatorCuff", "forearms"]);
const str = z.string();
const strs = z.array(z.string());

export const exerciseSchema = z.object({
  id: str.min(1), name: str.min(1), aliases: strs, muscles: strs, secondaryMuscles: strs,
  volume: z.array(z.object({ group, weight: z.union([z.literal(1), z.literal(0.5)]) })),
  equipment: z.enum(["barbell", "smith", "fixedBar", "dumbbell", "cable", "machine", "plateMachine", "bodyweight", "other"]),
  loadMode: z.enum(["perSide", "total", "perHand"]), singleSleeve: z.boolean().optional(), failureLastSet: z.boolean().optional(),
  isHeavy: z.boolean(), compound: z.boolean().optional(), bodyRegion: z.enum(["upper", "lower"]),
  why: str, setup: strs, form: strs, tips: strs, avoid: strs, rangeOfMotion: str, tempo: str,
  defaultRestSec: z.number().int().min(0).max(1800), incrementLb: z.number().min(0).max(100),
  figure: z.object({ v: z.literal("f").optional(), base: z.record(str, z.unknown()), A: z.record(str, z.number()), B: z.record(str, z.number()), props: z.array(z.record(str, z.unknown())).optional() }).nullable(),
  isCustom: z.boolean(), archived: z.boolean(),
});

const slotSchema = z.object({
  id: str.min(1), exerciseId: str.min(1), sets: z.number().int().min(1).max(20), repMin: z.number().int().min(1), repMax: z.number().int().min(1),
  restSec: z.number().int().min(0).max(1800), supersetGroup: str.optional(), notes: str.optional(), whyOverride: str.optional(), tipsOverride: strs.optional(), toFailure: z.boolean().optional(),
});
export const routineSchema = z.object({
  id: str.min(1), name: str.min(1), isCurrent: z.boolean(), createdAt: str, rules: z.array(z.object({ title: str, text: str })).optional(),
  days: z.array(z.object({ id: str.min(1), weekday: z.number().int().min(0).max(6).nullable(), title: str, slots: z.array(slotSchema) })),
});
const setSchema = z.object({
  id: str.min(1), type: z.enum(["warmup", "working", "drop", "failure"]),
  weight: z.number().min(0).max(5000).nullable(), reps: z.number().int().min(0).max(1000).nullable(),
  done: z.boolean(), rir: z.number().min(0).max(10).nullable().optional(), completedAt: str.nullable().optional(),
});
export const sessionSchema = z.object({
  id: str.min(1), date: str.regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"), title: str,
  routineId: str.optional(), dayId: str.optional(), startedAt: str, finishedAt: str.nullable().optional(),
  status: z.enum(["active", "finished"]), notes: str.optional(), source: z.enum(["app", "jefit"]), importKey: str.optional(), deload: z.boolean().optional(),
  entries: z.array(z.object({
    id: str.min(1), exerciseId: str.min(1), swappedFromId: str.optional(), slotId: str.optional(), supersetGroup: str.optional(),
    restSec: z.number().int().min(0).max(1800), repMin: z.number().int().optional(), repMax: z.number().int().optional(), notes: str.optional(), toFailure: z.boolean().optional(), failWhy: strs.optional(),
    sets: z.array(setSchema),
  })),
});
const targetSchema = z.object({
  group, min: z.number().nullable(), max: z.number().nullable(), angles: str.optional(), gap: str.optional(), note: str.optional(), off: z.boolean().optional(), priority: z.boolean().optional(), acceptedBelow: z.boolean().optional(),
});
const settingsSchema = z.object({
  units: z.literal("lb"), restDefaultSec: z.number().int().min(0).max(1800), autoStartRest: z.boolean(), sound: z.boolean(), keepAwake: z.boolean(), deloadSuggestions: z.boolean().default(true), progressionHints: z.boolean().default(true),
  theme: z.enum(["system", "light", "dark"]), accent: z.enum(ACCENTS).default("blue"),
  profile: z.object({ goal: z.enum(["growth", "strength", "endurance", "maintenance"]), phase: z.enum(["cutting", "maintaining", "bulking"]),
    age: z.number().min(10).max(100).nullable(), yearsTraining: z.number().min(0).max(80).nullable(), sleepHours: z.number().min(0).max(16).nullable() }).nullable().optional(), weekStartDay: z.number().int().min(0).max(6).default(1),
  deload: z.object({ start: str, end: str }).nullable().optional(), deloadDismissedAt: str.nullable().optional(), streakFreezes: z.array(z.object({ start: str, end: str.nullable() })).optional(), plates: z.array(z.object({ weight: z.number().positive(), pairs: z.number().int().min(0).max(50) })),
});

export const appDataSchema = z.object({
  exercises: z.array(exerciseSchema), routines: z.array(routineSchema), sessions: z.array(sessionSchema),
  targets: z.array(targetSchema), settings: settingsSchema,
  jefitAliases: z.array(z.object({ jefitName: str.min(1), exerciseId: str.nullable() })),
});

export const backupSchema = z.object({ app: z.literal(APP_ID), schemaVersion: z.number().int(), exportedAt: str, data: appDataSchema });
export type Backup = z.infer<typeof backupSchema>;

export function buildBackup(data: AppData, now: Date): Backup {
  return { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export type ParseResult = { ok: true; backup: Backup; counts: { sessions: number; exercises: number; routines: number } } | { ok: false; error: string };

/** Parse and validate a backup file. Checks references (sessions → exercises) too. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "This file isn't valid JSON." }; }
  if (typeof raw !== "object" || raw === null || (raw as { app?: unknown }).app !== APP_ID) return { ok: false, error: "This isn't a Blue Fit backup file." };
  const v = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof v !== "number" || v > SCHEMA_VERSION) return { ok: false, error: `This backup is from a newer version of Blue Fit (format ${String(v)}). Update the app first.` };
  const r = backupSchema.safeParse(migrate(raw as Record<string, unknown>));
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, error: `The file has invalid data at "${i.path.join(".")}": ${i.message}.` };
  }
  const d = r.data.data;
  const ids = new Set(d.exercises.map((e) => e.id));
  for (const s of d.sessions) for (const e of s.entries) if (!ids.has(e.exerciseId)) return { ok: false, error: `Workout on ${s.date} uses an unknown exercise "${e.exerciseId}".` };
  for (const rt of d.routines) for (const day of rt.days) for (const sl of day.slots) if (!ids.has(sl.exerciseId)) return { ok: false, error: `Routine "${rt.name}" uses an unknown exercise "${sl.exerciseId}".` };
  if (d.routines.filter((x) => x.isCurrent).length > 1) return { ok: false, error: "More than one routine is marked current." };
  return { ok: true, backup: r.data, counts: { sessions: d.sessions.length, exercises: d.exercises.length, routines: d.routines.length } };
}

/** Upgrade older backup formats to the current one. Version 1 is the first format. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  return raw;
}
