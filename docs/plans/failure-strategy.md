# Plan: strategic "last set to failure"

Working document (agreed with Leo, Nov 16 2026). Read **before starting, while working, and after finishing**.
Tick items only when done *and verified*. Anything not agreed here is out of scope. Status: **approved, not built yet**.

## 1. What Leo asked for (in his words where possible)

| # | Decision | Source |
|---|---|---|
| F1 | Going to failure must be **strategic**: based on the full workout, goal, exercises, recovery, volume. The app figures it out; the user can change it. | "the choice of going to failure should be strategic… most users will want the app to figure that out for them" |
| F2 | Goals: **mass gain and endurance** use it. **Strength and maintain: no changes** (no extra cue). | "let's add it for endurance as well and no changes for the other 2" |
| F3 | Every set still stops with 0–2 good reps left; failure is only the **last working set** of a chosen exercise. | built Nov 16 (§5.19 of APP_SPEC) |
| F4 | **Timing:** today's flames are **fixed** once the workout starts. When a finished workout is **saved**, the flames for the **remaining days of the week** are worked out again from what was actually logged. Past workouts never change. | "the flames for today are fixed but when i save today's finished workout, then the flames for the remaining days of the week might change" |
| F5 | The user's **manual on/off** choice (Edit plan → exercise → "Last set to failure") always wins; the app decides only the exercises the user hasn't touched. | strategy accepted |
| F6 | This **replaces** the current simple defaults (FAILURE_DEFAULT list in `src/core/failure.ts`). | strategy accepted |

## 2. The strategy (approved)

Evidence: growth rises as sets end closer to failure (Robinson 2024); true failure adds little over stopping just short and costs more fatigue (Refalo 2023); failure needs roughly 24–48 h more recovery (Morán-Navarro 2017). Numbers marked *judgment* are our reasoning, not study figures.

1. **Who gets it:** goal = mass gain or endurance (no profile yet counts as mass gain). Not in a deload week. Not for beginners (< 1 year lifting: they grow fine without it and are still learning form).
2. **Eligible exercises (safety):** machine, cable and isolation moves. Never ★ heavy lifts. Never free weights over the face/head (e.g. EZ-bar incline extension). Never the single-arm DB row (free-weight compound).
3. **Failure budget per workout (fatigue):** 3 sets (*judgment*). 2 when cutting, or sleep < 6 h, or age 40+. 1 when two or more of those apply.
4. **Spending the budget, best first:**
   1. The **last exercise for each muscle in that workout** (failure fatigue can't hurt later sets for it).
   2. **Priority muscles** before normal ones (priority = target `priority` flag or the app default bold muscles).
   3. Muscles **below their weekly target** (from what's actually logged this training week + what's still planned) get the push; muscles **above** target are skipped.
   4. **Not if that muscle is trained again within 2 days** (*judgment*, from the recovery research). Use the real last-trained date from history for "trained recently", and the plan for "trained again soon".
   5. Tie → later in the workout wins.
5. **Explain it:** tapping the flame shows the reason, e.g. "Last biceps exercise today · priority · biceps rest 3 days".
6. **User control:** Edit plan switch sets `slot.toFailure` true/false (overrides); unset = the app decides.

## 3. When it's calculated (F4)

- **Preview** (Today, Plan tab, Edit plan): computed for each planned day of the current training week from: the plan, the profile, this week's **finished** sessions, last-trained dates.
- **Start workout:** the result for that day is **stored on the session** (e.g. `entry.toFailure` or `session.failureSetIds`) so it never changes mid-workout or afterwards.
- **After a workout is saved (finished):** previews for the remaining days recompute automatically (they're derived from finished sessions, so this happens on its own).
- Past sessions keep what was stored.

## 4. Steps

- [ ] 4.1 Pure core module (`src/core/failure.ts` rewrite): `planFailure(day, routine, exercises, targets, profile, finishedThisWeek, history, today, settings) → { slotId, why[] }[]`. Framework-free.
- [ ] 4.2 Eligibility rules (§2.1–2.2) as data/logic; replace FAILURE_DEFAULT (keep `failureLastSet` on exercises only if still needed as "eligible", or derive eligibility from equipment/isHeavy/an `unsafeFailure` list).
- [ ] 4.3 Budget (§2.3) and ranking (§2.4).
- [ ] 4.4 Snapshot on Start workout (§3); logger reads the snapshot, not the live preview.
- [ ] 4.5 UI: flames from the preview on Today / Plan / Edit plan; tap flame → reason sheet or tooltip; Edit plan switch = manual override (on / off / back to automatic).
- [ ] 4.6 Migration: existing `failureLastSet` defaults and `slot.toFailure` values — keep only the user's real overrides (slot.toFailure set by the user); drop the old defaults.
- [ ] 4.7 Tests: budget per profile, last-exercise-per-muscle pick, below/above target, 2-day recovery rule, snapshot stability, overrides win, deload/beginner/strength/maintain → none.
- [ ] 4.8 APP_SPEC.md §5.19 rewritten in the same commit; check in the preview; Leo reviews.

## 5. Final check
- [ ] F1–F6 implemented as written.
- [ ] Every number has a source or a *judgment* note.
- [ ] No personal values committed.
- [ ] Nothing left unticked without a reason.
