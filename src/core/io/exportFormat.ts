// Versioned JSON backup format. Validates strictly; refuses bad data with a clear message.
import { z } from "zod";
import { ACCENTS, type AppData } from "../types";
import { AXIS_KEYS, BODY_PARTS, LEVEL_KEYS, LIMB_PARTS } from "../body/types";

export const APP_ID = "blue-fit";
/** 2 (Nov 24 2026): body scans. An older app refuses a version-2 backup instead of silently dropping scans. */
export const SCHEMA_VERSION = 2;

const group = z.enum(["back", "biceps", "triceps", "sideDelts", "rearDelts", "traps", "frontDelts", "chest", "quads", "hamstrings", "adductors", "calves", "glutes", "forearms", "abs", "neck"]);
const str = z.string();
const strs = z.array(z.string());

export const exerciseSchema = z.object({
  id: str.min(1), name: str.min(1), aliases: strs, muscles: strs, secondaryMuscles: strs,
  volume: z.array(z.object({ group, weight: z.union([z.literal(1), z.literal(0.5)]) })),
  equipment: z.enum(["barbell", "smith", "fixedBar", "dumbbell", "cable", "machine", "plateMachine", "bodyweight", "other"]),
  loadMode: z.enum(["perSide", "total", "perHand"]), singleSleeve: z.boolean().optional(), failureLastSet: z.boolean().optional(),
  isHeavy: z.boolean(), compound: z.boolean().optional(), angles: z.record(z.string(), z.string()).optional(), jobs: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(), stretch: z.array(group).optional(), bodyRegion: z.enum(["upper", "lower"]),
  why: str, setup: strs, form: strs, tips: strs, avoid: strs, rangeOfMotion: str, tempo: str,
  defaultRestSec: z.number().int().min(0).max(1800), incrementLb: z.number().min(0).max(100),
  figure: z.object({ v: z.literal("f").optional(), base: z.record(str, z.unknown()), A: z.record(str, z.number()), B: z.record(str, z.number()), props: z.array(z.record(str, z.unknown())).optional() }).nullable(),
  isCustom: z.boolean(), archived: z.boolean(),
  heavyWhy: str.optional(), unsafeFailure: z.boolean().optional(), formerIds: strs.optional(),
  preferred: z.object({ goals: strs, why: str }).optional(), measure: z.enum(["reps", "time"]).optional(), assisted: z.boolean().optional(),
});

const slotSchema = z.object({
  id: str.min(1), exerciseId: str.min(1), sets: z.number().int().min(1).max(20), repMin: z.number().int().min(1), repMax: z.number().int().min(1),
  restSec: z.number().int().min(0).max(1800), supersetGroup: str.optional(), notes: str.optional(), whyOverride: str.optional(), tipsOverride: strs.optional(), toFailure: z.boolean().optional(), dropSet: z.boolean().optional(),
});
const targetSchema = z.object({
  group, min: z.number().nullable(), max: z.number().nullable(), angles: str.optional(), gap: str.optional(), note: str.optional(), off: z.boolean().optional(), priority: z.boolean().optional(), acceptedBelow: z.boolean().optional(),
});
export const routineSchema = z.object({
  id: str.min(1), name: str.min(1), isCurrent: z.boolean(), createdAt: str, rules: z.array(z.object({ title: str, text: str })).optional(),
  days: z.array(z.object({ id: str.min(1), weekday: z.number().int().min(0).max(6).nullable(), title: str, slots: z.array(slotSchema) })),
  targets: z.array(targetSchema).optional(),
  // How Build my plan made it (Nov 23 2026)
  build: z.object({
    version: str, at: str, goal: z.enum(["growth", "strength", "endurance", "maintenance"]), phase: str.optional(),
    trainDays: z.array(z.number().int()), maxMinutes: z.number(), restSec: z.number(), seed: z.number(), avoid: z.array(str),
    targets: z.array(targetSchema), built: z.array(z.object({ weekday: z.number().int().nullable(), title: str, slots: z.array(z.tuple([str, z.number()])) })),
  }).optional(),
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
  skipped: z.array(z.object({ exerciseId: str.min(1), sets: z.number().int().min(1) })).optional(),
  entries: z.array(z.object({
    id: str.min(1), exerciseId: str.min(1), swappedFromId: str.optional(), slotId: str.optional(), supersetGroup: str.optional(),
    restSec: z.number().int().min(0).max(1800), repMin: z.number().int().optional(), repMax: z.number().int().optional(), notes: str.optional(), toFailure: z.boolean().optional(), failWhy: strs.optional(), extraSet: strs.optional(),
    suggestExtra: strs.optional(), suggestFailure: strs.optional(), plannedSets: z.number().int().min(0).optional(),
    sets: z.array(setSchema),
  })),
});
const settingsSchema = z.object({
  units: z.literal("lb"), restDefaultSec: z.number().int().min(0).max(1800), autoStartRest: z.boolean(), sound: z.boolean(), keepAwake: z.boolean(), deloadSuggestions: z.boolean().default(true), progressionHints: z.boolean().default(true), autoAdjust: z.boolean().default(true),
  theme: z.enum(["system", "light", "dark"]), accent: z.enum(ACCENTS).catch("blue"), look: z.enum(["neon", "gray"]).optional().catch(undefined),
  profile: z.object({ goal: z.enum(["growth", "strength", "endurance", "maintenance"]), phase: z.enum(["cutting", "maintaining", "bulking"]),
    age: z.number().min(10).max(100).nullable(), yearsTraining: z.number().min(0).max(80).nullable(), sleepHours: z.number().min(0).max(16).nullable(),
    born: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), liftingSince: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional() }).nullable().optional(), weekStartDay: z.number().int().min(0).max(6).default(6),
  deload: z.object({ start: str, end: str }).nullable().optional(), deloadDismissedAt: str.nullable().optional(), streakFreezes: z.array(z.object({ start: str, end: str.nullable() })).optional(),
  heightCm: z.number().min(50).max(260).nullable().optional(), sex: z.enum(["male", "female"]).nullable().optional(), lengthUnit: z.enum(["in", "cm"]).optional(), plates: z.array(z.object({ weight: z.number().positive(), pairs: z.number().int().min(0).max(50) })),
});

const num = z.number().finite();
const polygon = z.array(z.tuple([num, num]));
const section = z.object({ tCm: num, polygon });
const partRecord = z.partialRecord(z.enum(BODY_PARTS), num);
export const bodyGeometrySchema = z.object({
  torsoSlices: z.array(z.object({ yCm: num, polygon })),
  limbSections: z.array(z.object({ part: z.enum(LIMB_PARTS), sections: z.array(section) })),
  neckSections: z.array(section),
  levels: z.record(z.enum(LEVEL_KEYS), num),
  axes: z.record(z.enum(AXIS_KEYS), z.tuple([num, num, num])),
  shape: z.object({ model: z.literal("MHR"), version: str, body: z.array(num), params: z.array(num), scale: num }).optional(),
  viewQuality: z.array(num), scannerId: str, scannerVersion: str,
});
export const bodyScanSchema = z.object({
  id: str.min(1), date: str.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "date must be YYYY-MM-DDTHH:mm"),
  source: z.enum(["web-camera", "native-camera", "manual"]), scannerVersion: str, measureVersion: z.number().int().min(0),
  heightCm: z.number().min(50).max(260), weightLb: z.number().min(20).max(1000).optional(), sex: z.enum(["male", "female"]),
  geometry: bodyGeometrySchema.optional(),
  measurements: partRecord, bodyFatPct: num.optional(), waistToHeight: num.optional(),
  confidence: z.partialRecord(z.enum(BODY_PARTS), z.number().min(0).max(1)),
});

export const appDataSchema = z.object({
  exercises: z.array(exerciseSchema), routines: z.array(routineSchema), sessions: z.array(sessionSchema),
  targets: z.array(targetSchema), settings: settingsSchema,
  jefitAliases: z.array(z.object({ jefitName: str.min(1), exerciseId: str.nullable() })),
  bodyScans: z.array(bodyScanSchema).default([]),
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

/** Upgrade older backup formats to the current one. Version 1 is the first format; 2 added body scans
 *  (a version-1 backup simply has none). */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const r = stripRemovedGroups(raw);
  const d = r.data as Record<string, unknown> | undefined;
  if (d && typeof d === "object" && !Array.isArray(d.bodyScans)) return { ...r, data: { ...d, bodyScans: [] } };
  return r;
}

/** Muscle groups the app no longer has (rotator cuff, removed Nov 18 2026): dropped from exercises and targets of
 *  older backups so they still import. */
const REMOVED_GROUPS = new Set(["rotatorCuff"]);
function stripRemovedGroups(raw: Record<string, unknown>): Record<string, unknown> {
  const d = raw.data as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") return raw;
  const ok = (g: unknown) => !REMOVED_GROUPS.has(g as string);
  const exercises = Array.isArray(d.exercises) ? d.exercises.map((e: any) => (e && Array.isArray(e.volume)
    ? { ...e, volume: e.volume.filter((v: any) => ok(v?.group)), stretch: Array.isArray(e.stretch) ? e.stretch.filter(ok) : e.stretch,
        secondaryMuscles: Array.isArray(e.secondaryMuscles) ? e.secondaryMuscles.filter((m: unknown) => m !== "Rotator cuff") : e.secondaryMuscles }
    : e)) : d.exercises;
  const targets = Array.isArray(d.targets) ? d.targets.filter((t: any) => ok(t?.group)) : d.targets;
  return { ...raw, data: { ...d, exercises, targets } };
}
