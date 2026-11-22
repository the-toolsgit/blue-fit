// One-time data migrations applied on launch. Each runs once (its id is remembered in meta).
import type { AppData, Exercise, MuscleGroup, Routine } from "./types";
import { deriveSkipped } from "./session";
import plainText from "./seed/exercise-text.json";
import figureFixes from "./seed/figure-fixes.json";
import figureAudit from "./seed/figure-audit.json";
import figureMachines from "./seed/figure-machines.json";
import formTempoWas from "./seed/form-tempo-was.json";
import exerciseJobs from "./seed/exercise-jobs.json";
import extraExercises from "./seed/extra-exercises.json";
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
  {
    // Nov 18 2026 (replaced the same day by "exercise-jobs": angles came from the plan, jobs are universal). Kept so the
    // id stays known; does nothing now.
    id: "2026-11-18-exercise-angles",
    run() { return null; },
  },
  {
    // Nov 18 2026: built-in exercises learn which job of each muscle they train and which muscles they stretch
    // (Plan → Week check). Drops the short-lived plan-based "angles" tags.
    id: "2026-11-18-exercise-jobs",
    run(d) {
      const tags = exerciseJobs as Record<string, Pick<Exercise, "jobs" | "stretch">>;
      const fix = (e: Exercise) => !e.isCustom && ((tags[e.id] && !e.jobs) || "angles" in e);
      if (!d.exercises.some(fix)) return null;
      return { ...d, exercises: d.exercises.map((e) => {
        if (!fix(e)) return e;
        const { angles: _a, ...rest } = e as Exercise & { angles?: unknown };
        return tags[e.id] && !e.jobs ? { ...rest, ...tags[e.id] } : rest;
      }) };
    },
  },
  {
    // Nov 18 2026: Kelso shrug is done on the T-bar row machine (one sleeve): log the plates on it, show the plates.
    id: "2026-11-18-kelso-tbar",
    run(d) {
      const k = d.exercises.find((e) => e.id === "kelso-shrug");
      if (!k || k.singleSleeve) return null;
      const setup = k.setup.length === 1 && k.setup[0] === "Chest on a row-machine pad, arms straight." ? ["Chest on the T-bar row pad, arms straight."] : k.setup;
      return { ...d, exercises: d.exercises.map((e) => (e.id === k.id ? { ...e, equipment: "plateMachine", loadMode: "total", singleSleeve: true, setup } : e)) };
    },
  },
  {
    // Nov 18 2026: new built-in exercise, the lean-in lateral raise (lean toward the machine). Added if missing.
    id: "2026-11-18-lean-in-lateral-raise",
    run(d) {
      const add = (extraExercises as unknown as Exercise[]).filter((x) => !d.exercises.some((e) => e.id === x.id));
      return add.length ? { ...d, exercises: [...d.exercises, ...structuredClone(add)] } : null;
    },
  },
  {
    // Nov 18 2026: the lean-in raise starts with the hand across the body (stretch), not at the side.
    // Only fields still reading as first added.
    id: "2026-11-18-lean-in-across",
    run(d) {
      const t = (extraExercises as unknown as Exercise[]).find((x) => x.id === "lean-in-lateral-raise")!;
      const old = { why: "Leaning in makes the top of the raise hardest.", form: ["Start with your hand at your side.", "Raise to shoulder height, lower slowly."], range: "Hand at your side → shoulder height" };
      let changed = false;
      const exercises = d.exercises.map((e) => {
        if (e.id !== t.id || e.isCustom) return e;
        const n: Exercise = { ...e };
        if (e.why === old.why) { n.why = t.why; changed = true; }
        if (JSON.stringify(e.form) === JSON.stringify(old.form)) { n.form = t.form; changed = true; }
        if (e.rangeOfMotion === old.range) { n.rangeOfMotion = t.rangeOfMotion; changed = true; }
        if (e.figure && e.figure.A.ua === 5) { n.figure = structuredClone(t.figure); changed = true; }
        return n;
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 18 2026: Kelso shrug figure shows the traps squeezing (a light curve on the upper back that bulges).
    id: "2026-11-18-kelso-traps",
    run: (d) => applyFigureFixes(d, "kelso-shrug"),
  },
  {
    // Nov 18 2026: Kelso shrug figure keeps the chest on the pad: arms come up (shoulder blades pull back),
    // the traps arch under the head bulges. Replaces the moving-torso version.
    id: "2026-11-18-kelso-traps-pad",
    run: (d) => applyFigureFixes(d, "kelso-shrug"),
  },
  {
    // Nov 18 2026: rotator cuff is no longer a muscle group (Leo: not something trained at the gym). Dropped from
    // every exercise's volume, stretch tags and secondary muscles, and from the targets.
    id: "2026-11-18-no-rotator-cuff",
    run(d) {
      const gone = (g: string) => g === "rotatorCuff";
      let changed = false;
      const exercises = d.exercises.map((e) => {
        const has = e.volume.some((v) => gone(v.group)) || e.stretch?.some((g) => gone(g)) || e.secondaryMuscles.includes("Rotator cuff");
        if (!has) return e;
        changed = true;
        return { ...e, volume: e.volume.filter((v) => !gone(v.group)), stretch: e.stretch?.filter((g) => !gone(g)), secondaryMuscles: e.secondaryMuscles.filter((m) => m !== "Rotator cuff") };
      });
      const targets = d.targets.filter((t) => !gone(t.group));
      if (targets.length !== d.targets.length) changed = true;
      return changed ? { ...d, exercises, targets } : null;
    },
  },
  {
    // Nov 18 2026: the Effort rule card says "a couple of reps short of failure" instead of "0–2" (only if unedited).
    id: "2026-11-18-effort-card-couple",
    run(d) {
      const t = RULE_TEXT.Effort;
      let changed = false;
      const routines = d.routines.map((r) => !r.rules ? r : { ...r, rules: r.rules.map((x) => {
        if (x.title !== "Effort" || !t.old.includes(x.text)) return x;
        changed = true;
        return { ...x, text: t.text };
      }) });
      return changed ? { ...d, routines } : null;
    },
  },
  {
    // Nov 18 2026: biceps jobs are now its parts: long head, short head, brachialis (was curl / hammer).
    // Built-in exercises take the seed's tag; any other "hammer" becomes brachialis, any other "curl" is dropped
    // (which head it trains depends on the arm position, so it can't be guessed).
    id: "2026-11-18-biceps-parts",
    run(d) {
      let changed = false;
      const exercises = d.exercises.map((e) => {
        const old = e.jobs?.biceps;
        if (old !== "curl" && old !== "hammer") return e;
        changed = true;
        const seed = (exerciseJobs as Record<string, Pick<Exercise, "jobs">>)[e.id]?.jobs?.biceps;
        const next = !e.isCustom && seed ? seed : old === "hammer" ? "brachialis" : undefined;
        const { biceps: _b, ...rest } = e.jobs!;
        return { ...e, jobs: next ? { ...rest, biceps: next } : rest };
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 18 2026: triceps jobs are now its heads: long head (overhead) and lateral + medial head (arm at the side;
    // was overhead / pushdown). Built-in exercises take the seed's tag; others: overhead → long head, pushdown → both.
    id: "2026-11-18-triceps-heads",
    run(d) {
      let changed = false;
      const tags = exerciseJobs as Record<string, Pick<Exercise, "jobs">>;
      const exercises = d.exercises.map((e) => {
        const old = e.jobs?.triceps;
        if (old !== "overhead" && old !== "pushdown") return e;
        changed = true;
        const seed = !e.isCustom ? tags[e.id]?.jobs?.triceps : undefined;
        return { ...e, jobs: { ...e.jobs, triceps: seed ?? (old === "overhead" ? "long head" : ["lateral head", "medial head"]) } };
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 18 2026: back, glutes and abs jobs named by region/muscle. Built-in exercises take the seed's tags; others
    // are renamed: vertical pull / straight-arm → lats, row → upper back, hip extension → glute max,
    // abduction → glute medius, flexion → rectus abs, rotation → obliques.
    id: "2026-11-18-job-regions",
    run(d) {
      const RENAME: Partial<Record<MuscleGroup, Record<string, string>>> = {
        back: { "vertical pull": "lats", "straight-arm": "lats", row: "upper back" },
        glutes: { "hip extension": "glute max", abduction: "glute medius" },
        abs: { flexion: "rectus abs", rotation: "obliques" },
      };
      const tags = exerciseJobs as Record<string, Pick<Exercise, "jobs">>;
      let changed = false;
      const exercises = d.exercises.map((e) => {
        if (!e.jobs) return e;
        let jobs = e.jobs, touched = false;
        for (const [g, map] of Object.entries(RENAME) as [MuscleGroup, Record<string, string>][]) {
          const cur = jobs[g];
          if (cur == null) continue;
          const list = Array.isArray(cur) ? cur : [cur];
          if (!list.some((j) => j in map)) continue;
          touched = true;
          const seed = !e.isCustom ? tags[e.id]?.jobs?.[g] : undefined;
          const next = seed ?? [...new Set(list.map((j) => map[j] ?? j))];
          jobs = { ...jobs, [g]: Array.isArray(next) && next.length === 1 ? next[0] : next };
        }
        if (!touched) return e;
        changed = true;
        return { ...e, jobs };
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 19 2026: new built-in standing cable kickback (Leo); it replaces the bent-over kickback in the current plan.
    // History keeps the bent-over one (a different exercise).
    id: "2026-11-19-standing-kickback",
    run(d) {
      const add = (extraExercises as unknown as Exercise[]).filter((x) => !d.exercises.some((e) => e.id === x.id));
      let changed = add.length > 0;
      const routines = d.routines.map((r) => {
        if (!r.isCurrent || !r.days.some((dy) => dy.slots.some((sl) => sl.exerciseId === "cable-one-arm-tricep-kickback"))) return r;
        changed = true;
        return { ...r, days: r.days.map((dy) => ({ ...dy, slots: dy.slots.map((sl) => (sl.exerciseId === "cable-one-arm-tricep-kickback" ? { ...sl, exerciseId: "standing-cable-tricep-kickback" } : sl)) })) };
      });
      return changed ? { ...d, exercises: [...d.exercises, ...structuredClone(add)], routines } : null;
    },
  },
  {
    // Nov 19 2026: standing kickback with the pulley high, holding the frame, leaning back (Leo).
    id: "2026-11-19-standing-kickback-v6",
    run(d) {
      // Researched form, tips and avoids (Nov 19 2026). Updates the built-in copy while it still has any earlier
      // version's setup (never a copy the user edited).
      const t = (extraExercises as unknown as Exercise[]).find((x) => x.id === "standing-cable-tricep-kickback")!;
      const e = d.exercises.find((x) => x.id === t.id);
      const known = ["Pulley at chest height. Face the machine, step back.", "Pulley high. Face the machine, feet close to it.", t.setup[0]];
      if (!e || e.isCustom || !known.includes(e.setup[0])) return null;
      const keys = ["why", "setup", "form", "tips", "avoid", "figure"] as const;
      if (keys.every((k) => JSON.stringify(e[k]) === JSON.stringify(t[k]))) return null;
      return { ...d, exercises: d.exercises.map((x) => (x.id === t.id ? { ...x, ...structuredClone(Object.fromEntries(keys.map((k) => [k, t[k]]))) } : x)) };
    },
  },
  {
    // Nov 20 2026: leg extension with the seat back, leaning back (hips bent ~40° instead of ~90°): same quad growth,
    // far more rectus femoris growth (Leo, from Jeff Nippard's summary of a 10-week study). New figure and text,
    // only while the built-in copy still has the earlier setup (never a copy the user edited).
    id: "2026-11-20-leg-extension-seat-back",
    run(d) {
      const id = "leg-extension";
      const t = (plainText as unknown as Record<string, Partial<Exercise>>)[id];
      const e = d.exercises.find((x) => x.id === id);
      if (!e || e.isCustom) return null;
      const fixed = applyFigureFixes(d, id) ?? d;
      const oldSetup = ["Knees at the seat edge, lined up with the pivot.", "Back of the knee at the seat edge, knee lined up with the machine's pivot."];
      if (!oldSetup.includes(e.setup[0])) return fixed === d ? null : fixed;
      return { ...fixed, exercises: fixed.exercises.map((x) => (x.id === id ? { ...x, why: t.why!, setup: [...t.setup!], form: [...t.form!], tips: [...t.tips!], avoid: [...t.avoid!] } : x)) };
    },
  },
  {
    // Nov 20 2026: shorter, plainer leg extension why and tip (Leo: no jargon). Only where the v0.1.56 wording is still there.
    id: "2026-11-20-leg-extension-plain-tip",
    run(d) {
      const t = (plainText as unknown as Record<string, Partial<Exercise>>)["leg-extension"];
      const was = { why: "Quads only. Seat back grows the rectus femoris more.", tip: "Leaning back stretches the rectus femoris (front of the thigh, crosses the hip): it grew much more than sitting upright." };
      let changed = false;
      const exercises = d.exercises.map((x) => {
        if (x.id !== "leg-extension" || x.isCustom) return x;
        const why = x.why === was.why ? t.why! : x.why;
        const tips = x.tips.map((y) => (y === was.tip ? t.tips![0] : y));
        if (why === x.why && tips.every((y, i) => y === x.tips[i])) return x;
        changed = true;
        return { ...x, why, tips };
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 20 2026: sitting upright isn't wrong, just less stretch (Leo): drop it from the leg extension's Avoid.
    id: "2026-11-20-leg-extension-upright-ok",
    run(d) {
      const e = d.exercises.find((x) => x.id === "leg-extension");
      if (!e || e.isCustom || !e.avoid.includes("Sitting upright.")) return null;
      return { ...d, exercises: d.exercises.map((x) => (x === e ? { ...x, avoid: x.avoid.filter((y) => y !== "Sitting upright.") } : x)) };
    },
  },
  {
    // Nov 21 2026: weekly targets move onto each plan. Every plan gets a copy of the app-wide list it used until now,
    // so nothing changes on screen; from here on, editing one plan's targets leaves the others alone.
    id: "2026-11-21-targets-per-plan",
    run(d) {
      if (!d.routines.some((r) => !r.targets)) return null;
      return { ...d, routines: d.routines.map((r) => (r.targets ? r : { ...r, targets: structuredClone(d.targets) })) };
    },
  },
  {
    // Nov 21 2026: the figure audit redrew 56 movement templates (bodies clear of benches, both legs, hands on the bar,
    // …). App exercises saved on the phone keep their own copy, so each gets the new figure, but only while its
    // figure is still one the app gave it (the old database figure or the shipped one); a figure the user picked stays.
    id: "2026-11-21-figure-audit",
    run(d) {
      const audit = figureAudit as unknown as Record<string, { was: string[]; figure: Exercise["figure"] }>;
      let changed = false;
      const exercises = d.exercises.map((e) => {
        const a = !e.isCustom ? audit[e.id] : undefined;
        if (!a || !e.figure || !a.was.includes(figureHash(e.figure))) return e;
        changed = true;
        return { ...e, figure: structuredClone(a.figure) };
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 22 2026: the figures show their machine (Leo: "many exercises' animations miss the machine"): seat, back pad,
    // frame, lever arms on the handles, sled and rails (hack squat redrawn on a 45° sled), Smith rails, cable towers,
    // the trap bar, and the standing lat prayer. Same rule as the audit: only while the figure is still one the app gave.
    id: "2026-11-22-machine-figures",
    run(d) {
      return replaceAppFigures(d, figureMachines as unknown as FigureUpdates);
    },
  },
  {
    // Nov 22 2026: the lat prayer is done standing, bent forward ~90°, chest lifting a little at the hips (Leo). A phone
    // copy still on the old kneeling text gets the new text; anything the user rewrote stays.
    id: "2026-11-22-lat-prayer-standing",
    run(d) {
      const old = { why: "Straight-arm pull from overhead to your thighs: lats only.", setup1: "Kneel facing it, arms long overhead, hips back." };
      let changed = false;
      const exercises = d.exercises.map((x) => {
        if (x.id !== "lat-prayer" || x.isCustom || x.setup[1] !== old.setup1) return x;
        changed = true;
        return {
          ...x,
          aliases: x.aliases.map((a) => (a === "Kneeling cable pullover" ? "Standing cable pullover" : a)),
          why: x.why === old.why ? "Straight-arm pull from overhead to your hips: lats only." : x.why,
          setup: ["Rope or bar on a high pulley.", "Stand facing it, step back, bend forward about 90°, arms long overhead."],
          form: ["Pull your hands down to your hips in an arc, arms almost straight.", "Lift your chest a little as they reach your hips, squeeze.", "Return slowly to the stretch."],
          rangeOfMotion: "Arms overhead, bent 90° → hands at your hips",
        };
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 22 2026: pec deck and reverse fly machine lose the box frame, only the base and pad stay (Leo)
    id: "2026-11-22-pecdeck-no-frame",
    run(d) {
      const frame = ["4,-16,4,104", "116,-16,116,104", "4,-16,116,-16"];
      let changed = false;
      const exercises = d.exercises.map((e) => {
        if (e.isCustom || (e.id !== "butterfly" && e.id !== "machine-reverse-fly") || !e.figure?.props) return e;
        const props = e.figure.props.filter((p) => !("line" in p && p.line && frame.includes(String(p.line))));
        if (props.length === e.figure.props.length) return e;
        changed = true;
        return { ...e, figure: { ...e.figure, props } };
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 22 2026: machine shoulder press starts with the handles at chin height, as its text says (Leo)
    id: "2026-11-22-shoulder-press-chin",
    run(d) {
      // Any app-given version (handles starting above the head at x 91/29) takes the new figure; one the user picked stays
      const fig = (figureMachines as unknown as FigureUpdates)["machine-shoulder-press"].figure;
      let changed = false;
      const exercises = d.exercises.map((e) => {
        if (e.isCustom || e.id !== "machine-shoulder-press") return e;
        const holds = (e.figure?.props ?? []).filter((p) => "hold" in p && Array.isArray(p.hold)).map((p) => String((p as { hold: number[] }).hold[0]));
        if (holds.join() !== "91,29") return e;
        changed = true;
        return { ...e, figure: structuredClone(fig) };
      });
      return changed ? { ...d, exercises } : null;
    },
  },
  {
    // Nov 22 2026: Form no longer repeats the Tempo card ("hold 1 s", "lower slowly", "pause 2 s"; Leo). Only where the
    // tempo already says it; where you move to stays. Phone copies still on the old app text get the new one.
    id: "2026-11-22-form-no-tempo",
    run(d) {
      const pairs = formTempoWas as unknown as Record<string, [string[], string[]][]>;
      let changed = false;
      const exercises = d.exercises.map((e) => {
        const hit = !e.isCustom ? pairs[e.id]?.find(([was]) => JSON.stringify(was) === JSON.stringify(e.form)) : undefined;
        if (!hit) return e;
        changed = true;
        return { ...e, form: [...hit[1]] };
      });
      return changed ? { ...d, exercises } : null;
    },
  },
];

type FigureUpdates = Record<string, { was: string[]; figure: Exercise["figure"] }>;
/** Give app exercises a new figure while theirs is one of the listed fingerprints (`was`). Null if none changed. */
function replaceAppFigures(d: AppData, updates: FigureUpdates): AppData | null {
  let changed = false;
  const exercises = d.exercises.map((e) => {
    const a = !e.isCustom ? updates[e.id] : undefined;
    if (!a || !e.figure || !a.was.includes(figureHash(e.figure))) return e;
    changed = true;
    return { ...e, figure: structuredClone(a.figure) };
  });
  return changed ? { ...d, exercises } : null;
}

/** Short fingerprint of a figure (djb2 over its JSON), to tell an app-given figure from one the user picked */
export const figureHash = (f: unknown): string => {
  const s = JSON.stringify(f);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};


/** Never re-run on an imported backup: moving the plan's weekdays only made sense for the phone's data on Nov 16
 *  (the seed already has it); a backup's plan may have been moved back to Monday on purpose. */
export const IMPORT_SKIP = ["2026-11-16-week-starts-saturday"];

/** Run every migration not in `done` on `d`, in order. Returns the data (unchanged object when nothing applied) and
 *  all ids now done. Used at launch, and on import/reset so a backup from an older version is brought up to date too. */
export function applyMigrations(d: AppData, today: string, done: string[] = []): { data: AppData; done: string[]; changed: boolean } {
  let data = d, changed = false;
  const ids = [...done];
  for (const m of MIGRATIONS) {
    if (ids.includes(m.id)) continue;
    const next = m.run(data, today);
    if (next) { data = next; changed = true; }
    ids.push(m.id);
  }
  return { data, done: ids, changed };
}
