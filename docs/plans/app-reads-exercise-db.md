# The app reads the exercise database, and holds — plan

Status: built (Nov 21 2026). Dead hang left out (no checked source yet).

## 1. What changes for Leo

- **Add / swap exercise** lists every exercise in the database (about 450) plus his own ones, searchable by name,
  other names and muscle, filtered by muscle and equipment. Top picks for his goal show a small "Top pick" tag and
  come first.
- **Plan check "Every angle"** can now pass for every angle (the database tags each exercise with its angle). When an
  angle is missing, the message names two top picks or angle matches to add.
- **Failure:** an exercise marked "unsafe to fail" in the database never gets a failure set, whatever its equipment.
- **Holds** (plank, side plank, dead hang, Copenhagen plank, farmer's carry) are exercises: sets are logged in seconds.
- Nothing in his plans, history or custom exercises changes.

## 2. How the database joins the app's exercises (reviewed Nov 21 2026)

The database is **built-in data**, loaded once on launch (lazy chunk via `core/seed/exercise-db/index.ts`, 16 plain
imports; the store waits for it with storage), built into `Exercise` shape once and cached.

1. **Phone exercises win** on name, text, volume, figure and sets.
2. **Tags always come from the database** for phone exercises that are not custom (Leo can't edit them):
   `jobs`, `stretch`, `compound`, `unsafeFailure`, `heavyWhy`, `measure`, `formerIds`, top-pick goals. This fills the
   gaps in his plan exercises (e.g. face pull had no rear-delt angle) so "Every angle" can pass.
3. **Database-only exercises appear in the picker.** Picking one (add, swap) saves a full copy on the phone, so
   backups stay complete, records and history work as for any exercise, and nothing else needs special cases.
4. The store's `exercises` (picker, Progress) and `exMap` are the merged list; merged in its own `useMemo` on
   phone exercises only. Database entries whose name matches a phone exercise are hidden in the picker; the editor's
   "Name taken" check looks only at phone exercises; its figure list stays phone exercises.
5. Old ids (`formerIds`) map to their exercise in `exMap` (a phone exercise with that id always wins).
6. Backup schema gains the new optional fields (`measure`, `unsafeFailure`, `formerIds`, `heavyWhy`, `preferred`).
7. Top pick: goal maintenance → the "maintain" list (= growth), no profile → growth.
8. Muscles text and body region from the existing `withDerivedMuscles`.

Shipped in two pushes: A) database + picker + failure flag + angles, B) holds.

## 3. Failure rule

`failureEligible(ex)`: `ex.unsafeFailure === true` → never (new, checked first); then the current rule (unsafe id
list, safe equipment, isolation). The old hard-coded `UNSAFE_FAILURE` ids stay as a fallback for phone copies.

## 4. Holds

Research note: static holds train endurance and trunk stiffness; there is little growth research (coaching).

- Places that must treat seconds as time, not reps: tonnage, daily load, records/e1RM, progress chart, deload stall
  check, progression hint ("+5 s"), Plan check (rep range, heavy/light mix, high reps, ★ heavy skip time slots),
  new/swapped slot range 20–60 s, "Seconds" label on range steppers, workout hint text.
- Exercise field `measure: "time"` (default reps). A set's `reps` field holds the **seconds** (no new storage field,
  older data unaffected). Slot `repMin/repMax` are a seconds range (default 20–60 s for growth/maintain/endurance;
  holds get no strength target).
- Workout screen: the set row shows "s" instead of "reps"; a **Hold** button counts up and fills the seconds when
  tapped again (stays on screen, works with the rest timer).
- Tempo: one move, e.g. "Hold 30–60 s". The database test allows one timed "Hold" move for `measure: "time"`.
- Volume: each hold set counts like any set (abs, adductors, forearms…). Tonnage, e1RM and weight PRs skip holds;
  the record is the longest hold (at the same weight).
- Progression (*judgment*, coaching): add 5 s a session until every set reaches the top of the range, then add a
  little weight (plate on the back / heavier hand weight) and go back to the bottom of the range.
- Failure: holds never get a failure set (you just stop, nothing to gain).
- Entries: plank (abs), side plank (abs, obliques angle), Copenhagen plank (adductors), dead hang (forearms,
  grip), farmer's carry (forearms 1, traps 0.5; seconds walked). Old ids `plank`, `side-bridge` move into the
  database (removed from the left-out list).
- Figure: a hold template moves very little (small breathing motion) so it still animates.

## 5. Done means

- Picker shows the merged list; adding a database exercise to a plan works, logging it works, history shows it.
- Leo's plan and history unchanged (test: phone data in → same plan/sessions out; plan exercises keep their text).
- Plan check angles can all pass; failure skips unsafe ones; holds log seconds end to end.
- Tests for merge, old ids, failure flag, holds (volume, records, progression). APP_SPEC updated. Version bumped.
