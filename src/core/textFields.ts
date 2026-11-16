// The how-to text fields of an exercise, and a small fingerprint used to tell whether they were edited.
import type { Exercise } from "./types";

export const TEXT_FIELDS = ["why", "setup", "form", "tips", "avoid", "rangeOfMotion", "tempo"] as const;
export type ExerciseText = Pick<Exercise, (typeof TEXT_FIELDS)[number]>;

/** FNV-1a over the JSON of the text fields (hex). */
export function textFingerprint(e: ExerciseText): string {
  const s = JSON.stringify(TEXT_FIELDS.map((k) => e[k]));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}
