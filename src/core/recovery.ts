// Recovery status per muscle group, for the muscle map. Display only.
// ≥ 4 fractional working sets in the last 48 h → recovering.
// Otherwise ≥ 4 in the last 72 h (the hard work was 48–72 h ago) → partly recovered. Else fresh.
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type Session } from "./types";
import { countsForVolume } from "./volume";

export type Recovery = "recovering" | "partial" | "fresh";
export const HARD_SETS = 4;

export function recoveryStatus(sessions: Session[], exMap: Map<string, Exercise>, now: Date): Record<MuscleGroup, { status: Recovery; sets48: number; sets72: number }> {
  const s48 = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, 0])) as Record<MuscleGroup, number>;
  const s72 = { ...s48 };
  const t = now.getTime();
  for (const s of sessions) {
    if (s.status !== "finished") continue;
    for (const e of s.entries) {
      const ex = exMap.get(e.exerciseId);
      if (!ex) continue;
      for (const x of e.sets) {
        if (!x.done || !countsForVolume(x.type)) continue;
        const at = Date.parse(x.completedAt ?? s.finishedAt ?? s.startedAt);
        const h = (t - at) / 3_600_000;
        if (h < 0 || h > 72) continue;
        for (const v of ex.volume) { s72[v.group] += v.weight; if (h <= 48) s48[v.group] += v.weight; }
      }
    }
  }
  return Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.id, {
    status: s48[m.id] >= HARD_SETS ? "recovering" : s72[m.id] >= HARD_SETS ? "partial" : "fresh",
    sets48: s48[m.id], sets72: s72[m.id],
  }])) as Record<MuscleGroup, { status: Recovery; sets48: number; sets72: number }>;
}
