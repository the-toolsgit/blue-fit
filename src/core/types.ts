// Core data types. Framework-free: no DOM, no React. Mirrors docs/APP_SPEC.md §Data model.

export type MuscleGroup =
  | "back" | "biceps" | "triceps" | "sideDelts" | "rearDelts" | "traps" | "frontDelts" | "chest"
  | "quads" | "hamstrings" | "adductors" | "calves" | "glutes" | "rotatorCuff" | "forearms";

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string; region: "upper" | "lower"; priority?: boolean }[] = [
  { id: "back", label: "Back", region: "upper", priority: true },
  { id: "biceps", label: "Biceps", region: "upper", priority: true },
  { id: "triceps", label: "Triceps", region: "upper", priority: true },
  { id: "sideDelts", label: "Side delts", region: "upper", priority: true },
  { id: "rearDelts", label: "Rear delts", region: "upper", priority: true },
  { id: "traps", label: "Traps", region: "upper", priority: true },
  { id: "frontDelts", label: "Front delts", region: "upper" },
  { id: "chest", label: "Chest", region: "upper" },
  { id: "quads", label: "Quads", region: "lower" },
  { id: "hamstrings", label: "Hamstrings", region: "lower" },
  { id: "adductors", label: "Adductors", region: "lower" },
  { id: "calves", label: "Calves", region: "lower" },
  { id: "glutes", label: "Glutes", region: "lower" },
  { id: "rotatorCuff", label: "Rotator cuff", region: "upper" },
  { id: "forearms", label: "Forearms", region: "upper" },
];
export const muscleLabel = (g: MuscleGroup) => MUSCLE_GROUPS.find((m) => m.id === g)?.label ?? g;

export type Equipment = "barbell" | "smith" | "fixedBar" | "dumbbell" | "cable" | "machine" | "plateMachine" | "bodyweight" | "other";
export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "Barbell", smith: "Smith machine", fixedBar: "Fixed bar", dumbbell: "Dumbbell", cable: "Cable",
  machine: "Machine", plateMachine: "Plate-loaded machine", bodyweight: "Bodyweight", other: "Other",
};

/** How the logged number relates to the load. Weights are stored exactly as typed. */
export type LoadMode = "perSide" | "total" | "perHand";
export const LOAD_LABEL: Record<LoadMode, string> = { perSide: "per side", total: "", perHand: "per hand" };

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
  /** Short training rules shown with the plan (e.g. Effort, Progression, ★ Heavy) */
  rules?: { title: string; text: string }[];
  days: RoutineDay[];
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
  /** Priority muscle (aims for the top half of its range). Unset → the app's default (bold muscles). */
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

export interface PlateStock { weight: number; pairs: number }

export interface Settings {
  units: "lb";
  restDefaultSec: number;
  autoStartRest: boolean;
  sound: boolean;
  keepAwake: boolean;
  /** Reminders and tips that can be turned off (Settings → Reminders & tips) */
  deloadSuggestions: boolean;
  progressionHints: boolean;
  theme: "system" | "light" | "dark";
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
}

export const DEFAULT_SETTINGS: Settings = {
  units: "lb",
  restDefaultSec: 120,
  autoStartRest: true,
  sound: true,
  keepAwake: true,
  deloadSuggestions: true,
  progressionHints: true,
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
