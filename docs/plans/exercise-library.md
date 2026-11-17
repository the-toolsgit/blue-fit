# Exercise library and "heavy lift" (★) — plan

Goal: one internal list of the gym exercises the app knows, each marked heavy (★) or not, for manual and (later)
automatic plan building. Nothing is guessed: every exercise comes from a source, every ★ from a written rule.

Status: built (Nov 17 2026). Rule agreed; shrugs and calf raises ★ (Leo). Open: the ★ differences on Leo's own plan (step 6) and the second-pass disagreements.

## Defaults (Leo said "go ahead" without picking)
- Size: 350 gym exercises after filtering (not the full 876; stretches, cardio, abs/neck and odd variations left out).
- The exercise picker keeps showing the current list; the new library is used when plan building comes.

## Step 1 — the rule (agreed)
Research found no single scientific definition of a "heavy lift". Coaches split programs into **main lifts**
(big multi-joint lifts, trained heaviest) and **accessories** (lighter, often isolation). Strength Level's user
standards give an objective number for how much weight people move (intermediate men, × bodyweight), e.g.
deadlift 1.93, squat 1.66, bench 1.22, barbell row 1.10, machine shoulder press 1.00, barbell curl 0.58,
DB hammer curl 0.30, barbell shrug 1.50, leg extension 1.25, machine calf raise 1.75.
So load alone isn't enough (leg extensions and calf raises move a lot but are isolation moves).

Draft rule — ★ when all three hold:
1. **Multi-joint** (compound) movement — from the source database's `mechanic`, checked by hand.
2. **Big muscles drive it:** quads/glutes/hamstrings, back/lats, chest, or an overhead press.
3. **Safe to load heavy:** stable (barbell, Smith, machine, plate-loaded, DB press/row, weighted pull-up/dip);
   not explosive/high-skill (Olympic lifts, jumps), not a free weight over the face.

Leo's call: **shrugs and calf raises are ★** (isolation, but very heavy loads in a short range: 1.50× and 1.75×).
Also in the rule (from step 3 of the draft): no free weight over the face (JM press, skullcrushers); bodyweight-only
moves aren't ★ except pull-ups, chin-ups and dips (commonly loaded with a belt); free-weight single-leg/balance-limited
lifts (lunges, split squats, step-ups) aren't ★ unless on a Smith machine or machine.

## Step 2 — master list from a real database
- Source: free-exercise-db (github.com/yuhonas/free-exercise-db, public domain / Unlicense): 876 exercises with
  name, equipment, compound/isolation, primary and secondary muscles. (Not cross-checked with ExRx: muscles come from movement templates instead, see APP_SPEC §5.20.)
- Keep category strength / powerlifting; drop stretching, cardio, plyometrics, strongman, most Olympic lifts.
- Each entry keeps its source id. Map their muscles to ours (their "shoulders" must be split into front/side/rear
  delts by hand per exercise — flagged for review, never guessed silently).

## Step 3 — Jeff Nippard exercises (only if missing and sourced)
Add exercises he uses that aren't in the list, each with a source (his videos/book or a write-up quoting him).
Found so far: Bayesian cable curl, Kelso shrug, cable lateral raise, reverse cable crossover, seated super-stretch
cable fly, incline DB Y raise, seated leg curl, Smith machine squat, chest-supported row. More to search; names not
confirmed by a source (e.g. "Katana extension") are left out.

## Step 4 — fields per exercise
Name, aliases, equipment, compound/isolation, main and secondary muscles, volume weights (direct 1, indirect ½),
★ yes/no with a one-line reason, source.

## Step 5 — sort and double-check
Apply the rule automatically; a second independent pass sorts again without seeing the first; disagreements and
borderline cases go to Leo.

## Step 6 — Leo's current 33 exercises
Map them to the library; any ★ that differs from the rule is shown to Leo; nothing changes without his OK.

## Step 7 — store, test, document
Data in `src/core/seed/` (no history change). Tests: unique ids, all fields present, every muscle group covered.
Update APP_SPEC.md.

Sources: strengthlevel.com strength standards (per exercise pages); free-exercise-db; coaching write-ups on main vs
accessory lifts (setforset.com, outlift.com); Nippard write-ups (fitnessvolt.com, barbend.com, generationiron.com).
