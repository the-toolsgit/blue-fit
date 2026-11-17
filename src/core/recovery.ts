// Recovery status per muscle group, for the muscle map. Display only. Counted in whole days (workout dates),
// because people train at about the same time each day.
// A "hard day" for a muscle = ≥ 4 fractional working/failure sets that day (indirect sets count ½).
//   Hard day today or yesterday → recovering. 2 days ago → partly recovered (fine to train). 3+ days → fresh.
//   Slower recovery (age 40+, sleep under 6 h, or a ★ key lift set to failure for that muscle that day):
//   partly recovered one day longer. It never blocks training.
// Basis: 48–72 h for performance to come back (Morán-Navarro 2017; Korak 2015); training a muscle every 48–72 h is
// common and works (Schoenfeld 2016, 2019). The 4-set line and the +1 day are *judgment*.
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type ProfileDraft, type Session } from "./types";
import { countsForVolume } from "./volume";
import { daysBetween } from "./util";

export type Recovery = "recovering" | "partial" | "fresh";
export const HARD_SETS = 4;

export interface MuscleRecovery {
  status: Recovery;
  /** Sets on the hard day behind the status (0 when fresh with no hard day) */
  sets: number;
  /** Days ago of that hard day (null = none in the last 3 days) */
  daysAgo: number | null;
  /** Why it stays partly recovered one more day */
  slower: string[];
}

/** Profile reasons that slow recovery by one day. */
export function slowRecovery(p: ProfileDraft | null | undefined): string[] {
  const why: string[] = [];
  if (p?.age != null && p.age >= 40) why.push("age 40+");
  if (p?.sleepHours != null && p.sleepHours < 6) why.push("sleep under 6 h");
  return why;
}

export function recoveryStatus(sessions: Session[], exMap: Map<string, Exercise>, today: string, profile?: ProfileDraft | null): Record<MuscleGroup, MuscleRecovery> {
  // sets[k][group], keyFail[k] = groups hit directly by a ★ key lift failure set, k = days ago (0–3)
  const sets = [0, 1, 2, 3].map(() => new Map<MuscleGroup, number>());
  const keyFail = [0, 1, 2, 3].map(() => new Set<MuscleGroup>());
  for (const s of sessions) {
    if (s.status !== "finished") continue;
    const k = daysBetween(s.date, today);
    if (k < 0 || k > 3) continue;
    for (const e of s.entries) {
      const ex = exMap.get(e.exerciseId);
      if (!ex) continue;
      for (const x of e.sets) {
        if (!x.done || !countsForVolume(x.type)) continue;
        for (const v of ex.volume) {
          sets[k].set(v.group, (sets[k].get(v.group) ?? 0) + v.weight);
          if (ex.isHeavy && x.type === "failure" && v.weight === 1) keyFail[k].add(v.group);
        }
      }
    }
  }
  const base = slowRecovery(profile);
  const rank: Record<Recovery, number> = { fresh: 0, partial: 1, recovering: 2 };
  return Object.fromEntries(MUSCLE_GROUPS.map(({ id }) => {
    let best: MuscleRecovery = { status: "fresh", sets: 0, daysAgo: null, slower: [] };
    for (let k = 0; k <= 3; k++) {
      const n = sets[k].get(id) ?? 0;
      if (n < HARD_SETS) continue;
      const slower = [...base, ...(keyFail[k].has(id) ? ["★ key lift to failure"] : [])];
      const status: Recovery = k <= 1 ? "recovering" : k === 2 || slower.length ? "partial" : "fresh";
      if (rank[status] > rank[best.status]) best = { status, sets: n, daysAgo: k, slower: status === "partial" && k === 3 ? slower : [] };
    }
    return [id, best];
  })) as Record<MuscleGroup, MuscleRecovery>;
}
