# Exercise database — plan

Goal: one database of every gym exercise the app knows, each one fully described and linked to the muscle database
(`src/core/seed/muscles.json`). The app will later read exercises only from here. A readable page is built from it,
like the muscle page. Status: plan reviewed (Nov 20 2026); phase 1 = back and biceps.

## 1. What each exercise has

Field names are the app's own `Exercise` fields (src/core/types.ts), so the app can later load entries as they are.

| Field | What | Notes |
|---|---|---|
| `id` | stable id, e.g. `bayesian-cable-curl` | **every existing id is kept** (plan 35 + library 403); merged duplicates keep the old id in `formerIds` |
| `name`, `aliases` | display name, other names (Jefit, gym slang) | aliases help search and imports |
| `equipment` | barbell, dumbbell, cable, machine, plateMachine, smith, fixedBar, bodyweight, other | the app's `Equipment` list; bands and kettlebells are `other` for now |
| `singleSleeve` | true for one-end loaded bars (T-bar row, landmine) | logged with `loadMode: total` |
| `loadMode` | `total` · `perSide` · `perHand` | how the weight is logged |
| `compound` | true (multi-joint) / false | required: the failure rule reads it |
| `volume` | `[{group, weight}]`: weight **1** = direct (counts 1 set), **0.5** = indirect (½ set) | a second direct muscle is weight 1 (hammer curl: biceps 1, forearms 1) |
| `jobs` | angle(s) per muscle, e.g. `{ biceps: "brachialis" }` or two: `{ triceps: ["lateral head", "medial head"] }` | names must exist in the muscle database |
| `stretch` | muscles it loads at long length | feeds the Stretch check |
| `isHeavy`, `heavyWhy` | ★ key lift + reason | rule and exceptions: docs/plans/exercise-library.md (shrugs and calf raises ★; bodyweight only pull-ups, chin-ups, dips; free-weight single-leg moves not ★); Leo's plan values win |
| `unsafeFailure` | true when a failed rep is dangerous (weight over the face, free-weight spine loading) | failure is **derived** by the app's `failureEligible()` from equipment + compound + this flag; a test checks it |
| `why` | one short line: what it's for | |
| `setup`, `form`, `tips`, `avoid` | 1–3 short plain lines each | no jargon, no duplicates between sections, nothing personal |
| `rangeOfMotion` | "start → end" | |
| `tempo` | exactly two timed moves in the order the lifter does them, holds optional | 1 s lifting, 3 s lowering; e.g. squat "Down 3 s · Up 1 s", curl "Up 1 s · Down 3 s" |
| `defaultRestSec` | 120 | same for every exercise; longer rests by goal stay a Plan check rule |
| `incrementLb` | weight step | from equipment |
| `bodyRegion` | upper / lower | |
| `figure` | animation, built from a template (see 3) | |
| `preferred` | goals this exercise is a top pick for, with reason + source: `{ goals: ["growth", "strength", …], why, source }` | the best-known exercises for the muscle (e.g. machine shoulder press, squat, rope overhead extension). Separate lists per goal only where the research or expert consensus really differs (strength is specific to the lifts trained; endurance and maintain likely follow growth). Each muscle's preferred list is built from these marks; 2–5 per muscle and goal |
| `source` | where it comes from: database + id, or article/video URL (+ a second source when possible); plan exercises: "Leo's plan" | never a path into docs/source/ |
| `evidence` | research / coaching / our call for any claim in tips | same tags as the muscle database |

## 2. Where exercises come from

1. **Current data first:** the 403-exercise library and the plan's exercises. Nothing is dropped without a reason;
   every id stays.
2. **free-exercise-db** (github.com/yuhonas/free-exercise-db, Unlicense = public domain), pinned commit, same filter
   as the current library (gym strength only). No images.
3. **wger** (CC-BY-SA 4.0): looked up by hand to find missing exercises only; no scripted import, no copied text.
4. **Jeff Nippard and other evidence-based coaches** (public videos, articles): less common variations (Bayesian curl,
   seat-back leg extension, lean-in lateral raise, Kelso shrug, cross-body extensions, cable Y-raise, etc.). We write
   our own text; each links its source (and a second source when possible); no thumbnails, no quotes; coach names
   never in app branding.

Duplicates are merged (same movement + equipment + body position = one exercise; other names become aliases, old ids
go to `formerIds`). Target: as many as are real and distinct, likely 600–800. An exercise without a clear source, main
muscle and angle is left out. Text is never copied from a source. Left out on purpose: static holds (plank, side plank, farmer's walk, dead hang), which don't fit the two-move tempo; old ids `plank` and `side-bridge` stay in the old library until holds get their own type.

## 3. Animations

- About 40 **movement templates** (row, pulldown, straight-arm pulldown, curl, preacher curl, press, fly, lateral
  raise, reverse fly, shrug, squat, lunge, hinge, leg curl, leg extension, calf raise, hip thrust, crunch, …). Each is a
  figure spec (pose A → B) with a `startsAt` (A or B: which pose the tempo's first move starts from), replacing the
  hard-coded list in tempo.ts.
- A pure builder in core/figure: **template + adjustments → FigureSpec** (incline, seated, one arm, seat back, lean)
  plus **equipment props** (cable + pulley height, bar, dumbbells, bench, pad, frame) using the engine's existing
  shapes (lines, cables, circles).
- **Automatic checks** for every figure: it renders, stays inside the view, and moves the way the tempo's first move
  says (e.g. "Up" = the hands or hips go up). Contact sheets (rendered grids) are a spot check on top.
- Plan exercises keep their current hand-made figures.

## 4. The page

`docs/exercises.html`, built by a script from the data, same look as the muscle page: grouped by muscle → angle, each
exercise a card with its animated figure, tags (equipment, ★ key lift, failure ok, indirect muscles), setup / form /
tips / avoid, range, tempo, rest and source link. Filters by muscle and equipment, search by name. Links to the
muscle page by muscle id. Credits: free-exercise-db, wger.

## 5. How the work is done

- Phase 1: **back and biceps**. Leo checks the quality before the rest.
- Then the other 14 muscles in groups (shoulders + traps, chest + triceps, legs, core + neck + forearms).
- Per group: one agent collects the exercises and writes the entries; a second agent reviews every entry (muscle,
  angle, volume, ★, failure inputs, text, sources); I fix and build the figures.
- Automatic checks (tests): angles exist in the muscle database; every exercise has a source; text lengths; tempo
  parses to two moves; failure inputs match `failureEligible`; every old library and plan id still resolves; no
  duplicate names or ids; figures pass the checks in 3.
- Size: the data file is lazy-loaded (or split per muscle) when the app uses it; the build reports its size.
- Each shipped phase updates docs/APP_SPEC.md and bumps the version.

## 6. App impact

None in the data phases: the app keeps using its current exercises. Later step (separate plan): the app reads this
database (picker, Plan check angles, failure rule). Rules for that step:
- the user's edited and custom exercises (on the phone) always win over database defaults;
- every id in the user's plans and history keeps working (`formerIds` resolve);
- custom exercises can pick a muscle and angle.
That step fixes "Every angle" never passing for angles no current exercise is tagged with.

## 7. Done means (per phase)

- Data file `src/core/seed/exercise-db.json` + page `docs/exercises.html` for the phase's muscles.
- Every exercise: all fields filled, a source, a figure that animates the right way at its tempo.
- Reviewer agent finds no "definitely wrong" items left; tests pass.
