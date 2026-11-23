// Core data types. Framework-free: no DOM, no React. Mirrors docs/APP_SPEC.md §Data model.

import muscleDb from "./seed/muscles.json";
export type MuscleGroup =
  | "back" | "biceps" | "triceps" | "sideDelts" | "rearDelts" | "traps" | "frontDelts" | "chest"
  | "quads" | "hamstrings" | "adductors" | "calves" | "glutes" | "forearms" | "abs" | "neck";

/** Muscle groups in display order; names, body region and default priority come from the muscle database (seed/muscles.json). */
const MUSCLE_ORDER: MuscleGroup[] = ["back", "biceps", "triceps", "sideDelts", "rearDelts", "traps", "frontDelts", "chest", "quads", "hamstrings", "adductors", "calves", "glutes", "forearms", "abs", "neck"];
export const MUSCLE_GROUPS: { id: MuscleGroup; label: string; region: "upper" | "lower"; priority?: boolean }[] = MUSCLE_ORDER.map((id) => {
  const m = muscleDb.muscles.find((x) => x.id === id)!;
  return { id, label: m.name, region: m.region as "upper" | "lower", ...(m.priority ? { priority: true } : {}) };
});
export const muscleLabel = (g: MuscleGroup) => MUSCLE_GROUPS.find((m) => m.id === g)?.label ?? g;

export type Equipment = "barbell" | "smith" | "fixedBar" | "dumbbell" | "cable" | "machine" | "plateMachine" | "bodyweight" | "other";
export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "Barbell", smith: "Smith machine", fixedBar: "Fixed bar", dumbbell: "Dumbbell", cable: "Cable",
  machine: "Machine", plateMachine: "Plate-loaded machine", bodyweight: "Bodyweight", other: "Other",
};

/** How the logged number relates to the load. Weights are stored exactly as typed. */
export type LoadMode = "perSide" | "total" | "perHand";

export interface VolumeShare { group: MuscleGroup; weight: 1 | 0.5 }

export type FigureSpec = {
  v?: "f";
  base: Record<string, unknown>;
  A: Record<string, number>;
  B: Record<string, number>;
  props?: Record<string, unknown>[];
};

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  muscles: string[];
  secondaryMuscles: string[];
  volume: VolumeShare[];
  equipment: Equipment;
  loadMode: LoadMode;
  /** Plate-loaded on one sleeve only (e.g. T-bar row): show the plates for the whole weight */
  singleSleeve?: boolean;
  /** No longer used (failure is now picked per workout, see core/failure.ts). Kept so older backups still import. */
  failureLastSet?: boolean;
  isHeavy: boolean;
  /** Multi-joint movement (from the exercise library). Unknown on older custom exercises. */
  compound?: boolean;
  /** Which job of each muscle this exercise trains (names from JOBS in workoutCheck.ts), e.g. { biceps: "hammer" } */
  /** Job(s) the exercise does for each muscle (names from JOBS in workoutCheck.ts); a few do two (pushdown: lateral + medial head) */
  jobs?: Partial<Record<MuscleGroup, string | string[]>>;
  /** Muscles this exercise loads at a long length (stretched position) */
  stretch?: MuscleGroup[];
  bodyRegion: "upper" | "lower";
  why: string;
  setup: string[];
  form: string[];
  tips: string[];
  avoid: string[];
  rangeOfMotion: string;
  tempo: string;
  defaultRestSec: number;
  incrementLb: number;
  figure: FigureSpec | null;
  isCustom: boolean;
  archived: boolean;
  /** Why it is or isn't a ★ key lift (from the exercise database) */
  heavyWhy?: string;
  /** A failed rep is dangerous: never a failure set (from the exercise database) */
  unsafeFailure?: boolean;
  /** Older ids of this exercise (merged duplicates); they still open it */
  formerIds?: string[];
  /** Top pick for these goals (exercise database): "growth", "strength"; maintenance and endurance follow growth */
  preferred?: { goals: string[]; why: string };
  /** Jeff Nippard's tier for it (his "best and worst exercises" rankings): S+ best … F worst; ranks picks and swaps */
  nippard?: { tier: string; src: string };
  /** "time": sets are logged in seconds (holds). Default: reps. */
  measure?: "reps" | "time";
  /** The logged weight is help (assisted machine): less is harder. No "add weight" hints or weight PRs. */
  assisted?: boolean;
}

export interface Slot {
  id: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  supersetGroup?: string;
  notes?: string;
  whyOverride?: string;
  tipsOverride?: string[];
  /** Last set to failure: the user's choice in Edit plan (true/false). Unset = the app decides each workout. */
  toFailure?: boolean;
}

export interface RoutineDay {
  id: string;
  /** 0 = Sunday … 6 = Saturday; null = not tied to a weekday */
  weekday: number | null;
  title: string;
  slots: Slot[];
}

export interface Routine {
  id: string;
  name: string;
  isCurrent: boolean;
  createdAt: string;
  /** Short training rules shown with the plan (e.g. Effort, Progression, ★ Key lift) */
  rules?: { title: string; text: string }[];
  days: RoutineDay[];
  /** This plan's weekly set targets per muscle (Nov 21 2026: per plan; before, one list for the whole app) */
  targets?: VolumeTarget[];
  /** How Build my plan made it (Nov 23 2026), so a reported plan can be rebuilt exactly; absent for hand-made plans */
  build?: PlanBuild;
}

/** Build my plan's inputs and its untouched output. Rebuilding with the same inputs (and the same exercise library)
 *  gives `built` again; any difference between `built` and the saved days is an edit made after the build. */
export interface PlanBuild {
  /** App version that built it */
  version: string;
  /** When it was built (ISO) */
  at: string;
  goal: Goal;
  phase?: string;
  trainDays: number[];
  maxMinutes: number;
  restSec: number;
  seed: number;
  /** The exercises the builder was asked to avoid (the plan that was current then) */
  avoid: string[];
  /** The targets it was built for */
  targets: VolumeTarget[];
  /** The plan exactly as built, before any swap, removal or addition: per day, [exerciseId, sets] */
  built: { weekday: number | null; title: string; slots: [string, number][] }[];
}

export interface VolumeTarget {
  group: MuscleGroup;
  min: number | null;
  max: number | null;
  angles?: string;
  gap?: string;
  note?: string;
  /** Skip (was "not a focus"): grayed out, no warnings. min/max are kept for when it's turned back on. */
  off?: boolean;
  /** Priority muscle (its range is the upper half of the usual one; Normal the lower half). Unset → the app's default (bold muscles). */
  priority?: boolean;
  /** Older data: below min was a deliberate choice. Treated like `off`. */
  acceptedBelow?: boolean;
}

export type SetType = "warmup" | "working" | "drop" | "failure";

export interface LoggedSet {
  id: string;
  type: SetType;
  weight: number | null;
  reps: number | null;
  done: boolean;
  rir?: number | null;
  completedAt?: string | null;
}

export interface SessionEntry {
  id: string;
  exerciseId: string;
  /** Set when swapped for this session only */
  swappedFromId?: string;
  slotId?: string;
  supersetGroup?: string;
  restSec: number;
  repMin?: number;
  repMax?: number;
  notes?: string;
  /** Last set to failure, fixed when the workout started (with the reasons shown when the flame is tapped) */
  toFailure?: boolean;
  failWhy?: string[];
  /** One set added to make up work skipped earlier this week (the reasons), fixed when the workout started */
  extraSet?: string[];
  /** Auto-adjust off: what the app would have changed (an extra set / last set to failure, with the reasons), shown as
   *  a tip and in the summary instead of applied. Cleared when the user takes it. */
  suggestExtra?: string[];
  suggestFailure?: string[];
  /** Working sets when the workout started (only with suggestExtra) */
  plannedSets?: number;
  sets: LoggedSet[];
}

export interface Session {
  id: string;
  /** Local calendar date YYYY-MM-DD */
  date: string;
  title: string;
  routineId?: string;
  dayId?: string;
  startedAt: string;
  finishedAt?: string | null;
  status: "active" | "finished";
  notes?: string;
  source: "app" | "jefit";
  importKey?: string;
  /** Logged during a deload week (lighter on purpose): skipped for pre-fill, progression hints and stall checks */
  deload?: boolean;
  /** Working sets left undone when the workout was finished (per exercise), shown red on the finish screen */
  skipped?: { exerciseId: string; sets: number }[];
  entries: SessionEntry[];
}

export type Goal = "growth" | "strength" | "endurance" | "maintenance";
export type Phase = "cutting" | "maintaining" | "bulking";
/** Interview: the training profile the volume model uses. */
export interface TrainingProfile { goal: Goal; phase: Phase; age: number; yearsTraining: number; sleepHours: number }
/** Saved while filling in: numbers can still be missing. */
export type ProfileDraft = { goal: Goal; phase: Phase; age: number | null; yearsTraining: number | null; sleepHours: number | null };
export const completeProfile = (p: ProfileDraft | null | undefined): TrainingProfile | null =>
  p && p.age != null && p.yearsTraining != null && p.sleepHours != null ? { ...p, age: p.age, yearsTraining: p.yearsTraining, sleepHours: p.sleepHours } : null;

export const ACCENTS = ["blue", "pink", "orange", "green", "brown"] as const;
export type Accent = (typeof ACCENTS)[number];

export interface StreakFreeze { start: string; end: string | null }

export interface PlateStock { weight: number; pairs: number }

export interface Settings {
  units: "lb";
  restDefaultSec: number;
  autoStartRest: boolean;
  sound: boolean;
  keepAwake: boolean;
  /** Reminders and tips that can be turned off (Settings → Reminders & tips) */
  deloadSuggestions: boolean;
  /** Settings → "Inline workout tips": every tip in the workout card (go up/down, effort notes) */
  progressionHints: boolean;
  /** Settings → Workout adjustments: the app adds a set for skipped work and picks failure sets from the week
   *  (off: neither; failure turned On in the plan still applies). Missing = on. */
  autoAdjust: boolean;
  theme: "system" | "light" | "dark";
  /** App look: neon (the blue line man, default) or signal (flat orange, black and off-white tiles). Missing = neon. */
  look?: "neon" | "signal";
  /** Accent palette; the line man always stays blue */
  accent: Accent;
  /** Interview: training profile for the volume model (on this phone only) */
  profile?: ProfileDraft | null;
  /** First day of the training week: 0 = Sunday … 6 = Saturday */
  weekStartDay: number;
  /** No longer used (the app assumes standard plates, unlimited). Kept so older backups still import. */
  plates: PlateStock[];
  /** The current or most recent deload week (inclusive local dates) */
  deload?: { start: string; end: string } | null;
  /** Day the deload suggestion was answered "Not now" */
  deloadDismissedAt?: string | null;
  /** Week streak freezes (inclusive local dates; end null = still frozen). A frozen week holds the streak. */
  streakFreezes?: StreakFreeze[];
}

export const DEFAULT_SETTINGS: Settings = {
  units: "lb",
  restDefaultSec: 120,
  autoStartRest: true,
  sound: true,
  keepAwake: true,
  deloadSuggestions: true,
  progressionHints: true,
  autoAdjust: true,
  theme: "system",
  accent: "blue",
  weekStartDay: 6,
  plates: [
    { weight: 45, pairs: 8 }, { weight: 35, pairs: 2 }, { weight: 25, pairs: 4 },
    { weight: 10, pairs: 4 }, { weight: 5, pairs: 4 }, { weight: 2.5, pairs: 2 },
  ],
};

export interface JefitAlias { jefitName: string; exerciseId: string | null }

/** Rest timer state, stored so it survives screen switches and reloads. */
export interface RestTimer { endsAt: number; durationSec: number; sessionId: string; entryId: string }

export interface AppData {
  exercises: Exercise[];
  routines: Routine[];
  sessions: Session[];
  targets: VolumeTarget[];
  settings: Settings;
  jefitAliases: JefitAlias[];
}
