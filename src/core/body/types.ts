// Body scan data (docs/plans/body-scan.md §1). Framework-free and scanner-neutral:
// any scanner (web camera now, native camera later) returns a BodyGeometry, and
// core/body/measure.ts turns it into the same measurements for every scanner.

/** Height levels every scanner must find on its own 3D body (cm, y up, floor = 0). */
export const LEVEL_KEYS = ["neckBase", "neckTop", "armpit", "lowestRib", "navel", "hipCrest", "buttocksMax", "crotch", "kneeMid"] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];

/** Joint centers every scanner must provide (cm). Limb sections run along these axes. */
export const AXIS_KEYS = ["shoulderL", "shoulderR", "elbowL", "elbowR", "wristL", "wristR", "hipJointL", "hipJointR", "kneeL", "kneeR", "ankleL", "ankleR"] as const;
export type AxisKey = (typeof AXIS_KEYS)[number];

export const LIMB_PARTS = ["upperArmL", "upperArmR", "forearmL", "forearmR", "thighL", "thighR", "calfL", "calfR"] as const;
export type LimbPart = (typeof LIMB_PARTS)[number];

export const BODY_PARTS = ["neck", "chest", "waistUpper", "waistLower", "hips", ...LIMB_PARTS] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

/** A closed outline in a cut plane: [a, b] pairs in whole millimetres. */
export type Polygon = [number, number][];

export interface Section { tCm: number; polygon: Polygon }

export interface BodyGeometry {
  /** Horizontal torso cuts every 1 cm (torso surface only, arms and hands left out). Polygon = [x, z]. */
  torsoSlices: { yCm: number; polygon: Polygon }[];
  /** Cuts perpendicular to each limb bone, every 1 cm from the proximal joint (tCm). */
  limbSections: { part: LimbPart; sections: Section[] }[];
  /** Cuts perpendicular to the neck axis (neckBase → neckTop), every 1 cm. */
  neckSections: Section[];
  levels: Record<LevelKey, number>;
  axes: Record<AxisKey, [number, number, number]>;
  /** Body model fit, so the 3D body can be rebuilt (optional: needs the model file). */
  shape?: { model: "MHR"; version: string; body: number[]; params: number[]; scale: number };
  /** Fit quality per captured view (12), 0–1. */
  viewQuality: number[];
  scannerId: string;
  scannerVersion: string;
}

export type ScanSource = "web-camera" | "native-camera" | "manual";
export type Sex = "male" | "female";

export interface BodyScan {
  id: string;
  /** Local date-time, ISO "YYYY-MM-DDTHH:mm" */
  date: string;
  source: ScanSource;
  scannerVersion: string;
  /** measure.ts version the measurements were made with (re-measured when it changes) */
  measureVersion: number;
  heightCm: number;
  weightLb?: number;
  sex: Sex;
  geometry?: BodyGeometry;
  /** Circumferences in cm */
  measurements: Partial<Record<BodyPart, number>>;
  bodyFatPct?: number;
  waistToHeight?: number;
  /** 0–1 per part; manual entries are 1 */
  confidence: Partial<Record<BodyPart, number>>;
}

export const PART_NAMES: Record<BodyPart, string> = {
  neck: "Neck", chest: "Chest", waistUpper: "Upper waist", waistLower: "Lower waist", hips: "Hips",
  upperArmL: "Upper arm (left)", upperArmR: "Upper arm (right)", forearmL: "Forearm (left)", forearmR: "Forearm (right)",
  thighL: "Thigh (left)", thighR: "Thigh (right)", calfL: "Calf (left)", calfR: "Calf (right)",
};
