// One-time data migrations applied on launch. Each runs once (its id is remembered in meta).
import type { AppData, Exercise, Routine } from "./types";
import { deriveSkipped } from "./session";
import plainText from "./seed/exercise-text.json";
import figureFixes from "./seed/figure-fixes.json";
import textWas from "./seed/text-review-was.json";
import shortWas from "./seed/text-short-was.json";
import { TEXT_FIELDS, textFingerprint } from "./textFields";
import { RULE_TEXT, RULE_TITLE } from "./seed/rule-text";

/** Fingerprints of the original (pre Nov 16 2026) how-to texts: only exercises still showing those get the new plain texts. */
const OLD_TEXT: Record<string, string> = {"t-bar-reverse-row": "6b8632a7", "single-arm-cable-lat-pulldown": "df96e44a", "single-arm-db-row": "12ea0da8", "straight-arm-cable-pulldown": "b7a692c2", "db-incline-curl": "656a2c8e", "barbell-preacher-curl": "e438cae0", "machine-shoulder-press": "3c4be1", "cable-lateral-raise": "5876a8cb", "lateral-shrug-hybrid": "15387c0f", "barbell-shrug": "7178eb3d", "overhead-trap": "f04c5cb1", "machine-reverse-fly": "82d257d8", "smith-squat": "a37ba86e", "leg-extension": "307c6f71", "prone-leg-curl": "1d775ce5", "hip-adduction": "5c6be17f", "standing-calf-raise": "513af48c", "wide-grip-lat-pulldown": "a2f2d4b1", "cable-seated-row": "ce490152", "ez-bar-incline-tricep-extension": "4b283842", "machine-dip": "c5b42a37", "v-bar-pushdown": "733b2c4b", "rope-face-pull": "3e0264c2", "lean-away-lateral-raise": "2593c16", "all-the-way-up-lateral-raise": "80d56b5d", "kelso-shrug": "417581ff", "single-arm-cable-reverse-fly": "fc8526a4", "rope-overhead-tricep-extension": "93fca8aa", "db-hammer-curl": "8762b83b", "leg-press": "5552ec03", "seated-leg-curl": "eb257054", "seated-calf-raise": "57abd3bf", "cable-one-arm-tricep-kickback": "a899d5fb"};

/** Move every routine day by `by` weekdays (e.g. −2: Monday → Saturday). Days keep their ids, so history stays linked. */
export function shiftWeekdays(r: Routine, by: number): Routine {
  return { ...r, days: r.days.map((d) => (d.weekday == null ? d : { ...d, weekday: (((d.weekday + by) % 7) + 7) % 7 })) };
}

/** Merge seed/figure-fixes.json over built-in figures (objects merge, arrays replace). Null if nothing to fix. */
function applyFigureFixes(d: AppData, only?: string): AppData | null {
  const fixes = figureFixes as unknown as Record<string, Record<string, unknown>>;
  let changed = false;
  const exercises = d.exercises.map((e) => {
    const fx = fixes[e.id];
    if (!fx || e.id === "_about" || (only && e.id !== only) || e.isCustom || !e.figure) return e;
    changed = true;
    const f: any = { ...e.figure };
    for (const [k, v] of Object.entries(fx)) f[k] = Array.isArray(v) ? v : { ...f[k], ...(v as object) };
    return { ...e, figure: f };
  });
  return changed ? { ...d, exercises } : null;
}

export interface Migration { id: string; run(d: AppData, today: string): AppData | null }

export const MIGRATIONS: Migration[] = [
  {
    // Nov 16 2026: Leo's training week now starts on Saturday. Monday's day moves to Saturday,
    // Tuesday's to Sunday, and so on. Only if the plan still has its original weekdays.
    id: "2026-11-16-week-starts-saturday",
    run(d) {
      const r = d.routines.find((x) => x.id === "leo-v3-1");
      if (!r || r.days.find((x) => x.id === "mon")?.weekday !== 1) return null;
      return { ...d, routines: d.routines.map((x) => (x.id === r.id ? shiftWeekdays(x, -2) : x)), settings: { ...d.settings, weekStartDay: 6 } };
    },
  },
  {
    // Nov 16 2026: "last set to failure" is now picked per workout (core/failure.ts). Drop the old per-exercise
    // defaults; slot.toFailure values stay (they were only ever saved when the user changed the default).
    // Replaces "2026-11-16-failure-defaults".
    id: "2026-11-16-failure-strategic",
    run(d) {
      if (!d.exercises.some((e) => e.failureLastSet !== undefined)) return null;
      return { ...d, exercises: d.exercises.map(({ failureLastSet: _f, ...e }) => e) };
    },
  },
  {
    // Nov 16 2026: plainer "★ Heavy" rule card (only if it still shows an earlier app text). Re-run as "-4" for the latest wording.
    id: "2026-11-16-plain-rule-text-4",
    run(d) {
      let changed = false;
      const routines = d.routines.map((r) => !r.rules ? r : { ...r, rules: r.rules.map((x) => {
        const t = RULE_TEXT[x.title];
        if (!t || !t.old.includes(x.text)) return x;
        changed = true;
        return { ...x, text: t.text };
      }) });
      return changed ? { ...d, routines } : null;
    },
  },
  {
    // Nov 16 2026: "★ Heavy" card is now "★ Key lift" (runs after the text update above, which looks cards up by the old title).
    id: "2026-11-16-key-lift-title",
    run(d) {
      let changed = false;
      const routines = d.routines.map((r) => !r.rules ? r : { ...r, rules: r.rules.map((x) => {
        if (!RULE_TITLE[x.title]) return x;
        changed = true;
        return { ...x, title: RULE_TITLE[x.title] };
      }) });
      return changed ? { ...d, routines } : null;
    },
  },
  {
    // Nov 17 2026: the stall check now uses every exercise, so the ★ card says what ★ means: heavy lift
    // ("-3": was "heavy compound lifts", then "…never takes them to failure", no longer true since the Nov 17 failure rule). Works on the card under its old or new title; only if it still shows an earlier app text.
    id: "2026-11-17-key-lift-text-3",
    run(d) {
      let changed = false;
      const oldTitle = (title: string) => Object.keys(RULE_TITLE).find((k) => RULE_TITLE[k] === title) ?? title;
      const routines = d.routines.map((r) => !r.rules ? r : { ...r, rules: r.rules.map((x) => {
        const t = RULE_TEXT[oldTitle(x.title)];
        if (!t || !t.old.includes(x.text)) return x;
        changed = true;
        return { ...x, text: t.text };
      }) });
      return changed ? { ...d, routines } : null;
    },
  },
  {
    // Nov 17 2026: DB Hammer Curl isn't a heavy lift (small single-joint move): no ★. Only the built-in exercise.
    id: "2026-11-17-hammer-curl-not-heavy",
    run(d) {
      const ex = d.exercises.find((e) => e.id === "db-hammer-curl" && !e.isCustom && e.isHeavy);
      if (!ex) return null;
      return { ...d, exercises: d.exercises.map((e) => (e === ex ? { ...e, isHeavy: false } : e)) };
    },
  },
  {
    // Nov 17 2026: ★ by the library rule (docs/plans/exercise-library.md), Leo agreed: calf raises, Kelso shrug,
    // single-arm cable lat pulldown, single-arm DB row. Built-in exercises only.
    id: "2026-11-17-library-heavy",
    run(d) {
      const ids = new Set(["standing-calf-raise", "seated-calf-raise", "kelso-shrug", "single-arm-cable-lat-pulldown", "single-arm-db-row"]);
      if (!d.exercises.some((e) => ids.has(e.id) && !e.isCustom && !e.isHeavy)) return null;
      return { ...d, exercises: d.exercises.map((e) => (ids.has(e.id) && !e.isCustom ? { ...e, isHeavy: true } : e)) };
    },
  },
  {
    // Nov 17 2026: built-in exercises learn whether they're multi-joint (used by the failure rule: free-weight
    // compounds are never taken to failure).
    id: "2026-11-17-compound-flag",
    run(d) {
      const comp = new Set(["t-bar-reverse-row", "single-arm-cable-lat-pulldown", "single-arm-db-row", "machine-shoulder-press", "smith-squat", "wide-grip-lat-pulldown", "cable-seated-row", "machine-dip", "leg-press"]);
      const seedIds = new Set(Object.keys(OLD_TEXT)); // the built-in exercise ids
      if (!d.exercises.some((e) => seedIds.has(e.id) && !e.isCustom && e.compound === undefined)) return null;
      return { ...d, exercises: d.exercises.map((e) => (seedIds.has(e.id) && !e.isCustom && e.compound === undefined ? { ...e, compound: comp.has(e.id) } : e)) };
    },
  },
  {
    // Nov 17 2026: new muscle groups abs and neck. Their targets start on Skip until the user sets one.
    id: "2026-11-17-abs-neck",
    run(d) {
      const add = (["abs", "neck"] as const).filter((g) => !d.targets.some((t) => t.group === g));
      if (!add.length) return null;
      return { ...d, targets: [...d.targets, ...add.map((group) => ({ group, min: null, max: null, off: true, note: "tracked only" }))] };
    },
  },
  {
    // Nov 17 2026: figures must follow the exercise text (seated row and face pull no longer lean back;
    // cable lateral raise leans away a little). Built-in exercises only.
    id: "2026-11-17-figure-fixes",
    run: (d) => applyFigureFixes(d),
  },
  {
    // Nov 17 2026: cable lateral raise holds the machine and starts with the hand across the body (stretch).
    // Figure always; texts only where they still read as before.
    id: "2026-11-17-lateral-raise-stretch",
    run(d) {
      const t = (plainText as unknown as Record<string, Partial<Exercise>>)["cable-lateral-raise"];
      const was = { setup: ["Pulley low, one arm, cable behind your body.", "Lean away a little."], form: ["Raise your arm out to the side to shoulder height, elbow leading.", "Lower slowly."], rangeOfMotion: "Hand by your hip → shoulder height" };
      const fixed = applyFigureFixes(d, "cable-lateral-raise") ?? d;
      let changed = fixed !== d;
      const exercises = fixed.exercises.map((e) => {
        if (e.id !== "cable-lateral-raise" || e.isCustom) return e;
        const n: Exercise = { ...e };
        for (const k of ["setup", "form", "rangeOfMotion"] as const) if (JSON.stringify(e[k]) === JSON.stringify(was[k])) { (n as any)[k] = t[k]; changed = true; }
        return n;
      });
      return changed ? { ...fixed, exercises } : null;
    },
  },
  {
    // Nov 17 2026: cable lateral raise setup says the cable runs in front of the body (Leo's version).
    id: "2026-11-17-lateral-raise-cable-front",
    run(d) {
      const old = "Pulley low, one arm, cable behind your body.", now = "Pulley low, one arm, cable in front of your body.";
      if (!d.exercises.some((e) => e.id === "cable-lateral-raise" && !e.isCustom && e.setup[0] === old)) return null;
      return { ...d, exercises: d.exercises.map((e) => (e.id === "cable-lateral-raise" && !e.isCustom && e.setup[0] === old ? { ...e, setup: [now, ...e.setup.slice(1)] } : e)) };
    },
  },
  {
    // Nov 17 2026: cable lateral raise stands with feet together so both feet touch the floor while leaning.
    id: "2026-11-17-lateral-raise-feet",
    run: (d) => applyFigureFixes(d, "cable-lateral-raise"),
  },
  {
    // Nov 17 2026: text review (stretch cues, setup details, holds in the tempo, machine dip avoid) and the
    // lean-away raise figure starting across the body. Texts only where they still read as before the review.
    id: "2026-11-17-text-review",
    run(d) {
      const now = plainText as unknown as Record<string, Record<string, unknown>>;
      const was = textWas as unknown as Record<string, Record<string, unknown>>;
      const fixed = applyFigureFixes(d, "lean-away-lateral-raise") ?? d;
      let changed = fixed !== d;
      const exercises = fixed.exercises.map((e) => {
        const old = was[e.id];
        if (!old || e.isCustom) return e;
        const n: any = { ...e };
        for (const [k, v] of Object.entries(old)) if (JSON.stringify(n[k]) === JSON.stringify(v)) { n[k] = now[e.id][k]; changed = true; }
        return n as Exercise;
      });
      return changed ? { ...fixed, exercises } : null;
    },
  },
  {
    // Nov 17 2026: the lean-away lateral raise is a cable exercise (Leo: always was). Equipment and log mode
    // switch only if still dumbbell / per hand; why and setup only where they still read as before.
    id: "2026-11-17-lean-away-cable",
    run(d) {
      const id = "lean-away-lateral-raise";
      const t = (plainText as unknown as Record<string, Partial<Exercise>>)[id];
      const was = { why: "Leaning away makes the start of the raise harder for the side of your shoulder.", setup: ["Hold a post with one hand and lean away, about 15–30°.", "Dumbbell in the other hand."], setupOld: ["Hold a post with one hand and lean away.", "Dumbbell in the other hand."] };
      const fixed = applyFigureFixes(d, id) ?? d;
      let changed = fixed !== d;
      const exercises = fixed.exercises.map((e) => {
        if (e.id !== id || e.isCustom) return e;
        const n: Exercise = { ...e };
        if (e.equipment === "dumbbell" && e.loadMode === "perHand") { n.equipment = "cable"; n.loadMode = "total"; changed = true; }
        if (e.why === was.why) { n.why = t.why!; changed = true; }
        const s = JSON.stringify(e.setup);
        if (s === JSON.stringify(was.setup) || s === JSON.stringify(was.setupOld)) { n.setup = t.setup!; changed = true; }
        return n;
      });
      return changed ? { ...fixed, exercises } : null;
    },
  },
  {
    // Nov 17 2026: shorter how-to texts for the phone screen (same information, duplicates removed).
    // Only fields that still read as before.
    id: "2026-11-17-short-texts",
    run(d) {
      const now = plainText as unknown as Record<string, Record<string, unknown>>;
      const was = shortWas as unknown as Record<string, Record<string, unknown>>;
      let changed = false;
      const exercises = d.exercises.map((e) => {
        const old = was[e.id];
        if (!old || e.isCustom) return e;
        const n: any = { ...e };
        for (const [k, v] of Object.entries(old)) if (JSON.stringify(n[k]) === JSON.stringify(v)) { n[k] = now[e.id][k]; changed = true; }
        return n as Exercise;
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 17 2026: skipped sets are saved when a workout is finished. Workouts finished just before that
    // (from Nov 16, the app's first days) get them worked out from the plan day.
    id: "2026-11-17-backfill-skipped",
    run(d) {
      let changed = false;
      const sessions = d.sessions.map((s) => {
        if (s.status !== "finished" || s.source !== "app" || s.skipped || s.date < "2026-11-16") return s;
        const sk = deriveSkipped(s, d.routines.find((r) => r.id === s.routineId));
        if (!sk.length) return s;
        changed = true;
        return { ...s, skipped: sk };
      });
      return changed ? { ...d, sessions } : null;
    },
  },
  {
    // Nov 17 2026: "Add" in Edit workout used to save the planned sets as done even when left empty, so they
    // counted as done. Drop done sets without reps from finished workouts and work out their skipped sets again.
    id: "2026-11-17-drop-empty-done-sets",
    run(d) {
      let changed = false;
      const sessions = d.sessions.map((s) => {
        if (s.status !== "finished" || !s.entries.some((e) => e.sets.some((x) => x.done && !((x.reps ?? 0) > 0)))) return s;
        changed = true;
        const entries = s.entries.map((e) => ({ ...e, sets: e.sets.filter((x) => !(x.done && !((x.reps ?? 0) > 0))) })).filter((e) => e.sets.length > 0);
        const cleaned = { ...s, entries };
        const sk = deriveSkipped(cleaned, d.routines.find((r) => r.id === s.routineId));
        const { skipped: _old, ...rest } = cleaned;
        return sk.length ? { ...rest, skipped: sk } : rest;
      });
      return changed ? { ...d, sessions } : null;
    },
  },
  {
    // Nov 18 2026: machine dip setup says "Back against the pad." (seats on many machines lean forward by design).
    id: "2026-11-18-dip-setup",
    run(d) {
      const old = [["Sit upright (keeps it on the triceps)."], ["Sit up straight."]].map((x) => JSON.stringify(x));
      if (!d.exercises.some((e) => e.id === "machine-dip" && !e.isCustom && old.includes(JSON.stringify(e.setup)))) return null;
      return { ...d, exercises: d.exercises.map((e) => (e.id === "machine-dip" && !e.isCustom && old.includes(JSON.stringify(e.setup)) ? { ...e, setup: ["Back against the pad."] } : e)) };
    },
  },
  {
    // Nov 16 2026: plain-language how-to texts and one-number tempos for the built-in exercises.
    // Skips any exercise whose texts were edited in the app.
    id: "2026-11-16-plain-exercise-text",
    run(d) {
      const text = plainText as unknown as Record<string, Partial<Exercise>>;
      let changed = false;
      const exercises = d.exercises.map((e) => {
        const t = text[e.id];
        if (e.isCustom || !t || OLD_TEXT[e.id] !== textFingerprint(e)) return e;
        changed = true;
        return { ...e, ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, t[k] ?? e[k]])) } as Exercise;
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 16 2026: the T-bar row has one sleeve, so its weight is the plates on that sleeve (not "per side").
    id: "2026-11-16-tbar-single-sleeve",
    run(d) {
      const t = d.exercises.find((e) => e.id === "t-bar-reverse-row");
      if (!t || t.singleSleeve) return null;
      return { ...d, exercises: d.exercises.map((e) => (e.id === t.id ? { ...e, loadMode: "total", singleSleeve: true } : e)) };
    },
  },
  {
    // Nov 16 2026: holds in the tempo (calf raises 2 s at the bottom; shrugs, face pull, leg curls 1 s squeeze).
    // Only exercises still showing an earlier app tempo.
    id: "2026-11-16-tempo-holds",
    run(d) {
      const text = plainText as unknown as Record<string, Partial<Exercise>>;
      const old: Record<string, string[]> = {"standing-calf-raise": ["Down 3 s · Up 1 s"], "seated-calf-raise": ["Down 3 s · Up 1 s"], "barbell-shrug": ["Up 1 s · Down 3 s"], "lateral-shrug-hybrid": ["Up 1 s · Down 3 s"], "kelso-shrug": ["Back 1 s · Forward 3 s"], "rope-face-pull": ["Pull 1 s · Return 3 s"], "prone-leg-curl": ["Up 1 s · Down 3 s", "Curl 1 s · Straighten 3 s"], "seated-leg-curl": ["Curl 1 s · Straighten 3 s"]};
      let changed = false;
      const exercises = d.exercises.map((e) => {
        if (!old[e.id]?.includes(e.tempo) || !text[e.id]?.tempo) return e;
        changed = true;
        return { ...e, tempo: text[e.id].tempo! };
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 16 2026: prone leg curl tempo reads "Up · Down" (legs go up, then down). Only if still the earlier app text.
    id: "2026-11-16-prone-curl-tempo",
    run(d) {
      const old = "Curl 1 s · Straighten 3 s";
      if (!d.exercises.some((e) => e.id === "prone-leg-curl" && e.tempo === old)) return null;
      return { ...d, exercises: d.exercises.map((e) => (e.id === "prone-leg-curl" && e.tempo === old ? { ...e, tempo: "Up 1 s · Down 3 s" } : e)) };
    },
  },
  {
    // Nov 16 2026: hamstrings become a normal muscle with an 8–10 target (2 leg curls × 4 sets), instead of "10+, below by choice".
    id: "2026-11-16-hamstrings-8-10",
    run(d) {
      const h = d.targets.find((t) => t.group === "hamstrings");
      if (!h?.acceptedBelow) return null;
      return { ...d, targets: d.targets.map((t) => (t.group === "hamstrings" ? { group: "hamstrings", min: 8, max: 10, angles: t.angles, gap: t.gap } : t)) };
    },
  },
];

