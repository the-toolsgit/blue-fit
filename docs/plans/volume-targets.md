# Plan: our own weekly volume targets (goal, profile, progress)

Working document. Read it **before starting, while working, and after finishing** each step.
Tick items only when they are done *and verified*. Anything not agreed here is out of scope.
Started Nov 16 2026. Map: [volume-targets-map.html](volume-targets-map.html).

## 1. What Leo asked for (agreed decisions, in his words where possible)

| # | Decision | Source (Leo, Nov 16 2026) |
|---|---|---|
| D1 | Weekly set targets per muscle are **our own numbers**, worked out from muscle size, function, recovery needs and other factors, not copied from someone else's table. | "instead of looking at someone else's opinions, can we determine those numbers ourselves?" |
| D2 | Targets change with the **goal**. Support all goals: muscle growth, strength, endurance, maintenance. | "the numbers should change depending on the goal" · Q1 "yes" (all goals) |
| D3 | The goal is **one setting for the whole plan**, not per muscle. | Q2 "it should be for the whole plan" |
| D4 | The app **asks for age, sleep and phase**: cutting / **a middle option** / bulking. | Q3 "yes it should ask for age sleep cutting/bulking (but also add a middle option)" |
| D5 | The app **suggests target changes from progress**. Leo decides. | Q4 "yes app should suggest from progress for sure" |
| D6 | **Don't change Leo's current plan.** His current targets stay until he edits them or presses Reset. | "dont change my plan at all" |
| D7 | By default **no muscle is "not a focus"**. | "by default none of them are marked as not a focus" |
| D8 | Until the model is approved, **Reset uses the current plan numbers**. | "use the current numbers as defaults for now" |
| D9 | Biceps need **fewer** sets than back (a one-size range is wrong). | "Biceps will need less sets / week compared to back" |
| D10 | Built in **3 steps**, each shown to Leo before the next. | plan accepted: "yes" |

Already built (before this plan): editable targets in Edit plan (min/max steppers, Not a focus switch, Reset targets to defaults).

## 2. Ground rules for this work

- **Don't make anything up.** Every number is either (a) from a cited source, or (b) marked **our judgment** with the reason written next to it. Nothing unmarked.
- Where evidence is weak, say so in the app ("why" line) and here.
- `src/core/` stays framework-free; the model is a pure function (portable to Swift/Kotlin).
- Profile data (age, sleep, phase) stays **on the phone only**. Never commit real values. Tests use made-up profiles.
- Update `docs/APP_SPEC.md` in the same commit as any behavior change.
- Short replies to Leo. Show each step's result before starting the next.

## 3. Steps

### Step 1: the model (for Leo's review, not in the app yet)
- [x] 1.1 Goal base ranges, each with a source.
- [x] 1.2 Muscle factor table (15 groups): size / whole-body fatigue, recovery speed, joint load at high volume, indirect work it gets. Each value with its reason and confidence.
- [x] 1.3 Profile adjustments (years training, age, sleep, phase, sessions per week), each with source or marked judgment.
- [x] 1.4 Written formula: goal × muscle factors × profile → min–max per muscle, rounding rules.
- [x] 1.5 Pure core module `src/core/volumeModel.ts` + tests (not used by any screen yet).
- [x] 1.6 Table of resulting numbers for a sample profile, shown to Leo with a "why" per muscle.
- [ ] 1.7 Leo reviews and approves (or we adjust). **Stop here until approved.**

### Step 2: training profile + defaults in the app
- [ ] 2.1 Settings → Training profile: Goal (Muscle growth · Strength · Endurance · Maintenance), Phase (Cutting · Maintaining · Bulking), Age, Years training, Average sleep. Sessions per week come from the plan.
- [ ] 2.2 Reset targets to defaults uses the model's numbers (replaces D8's temporary defaults).
- [ ] 2.3 Each muscle shows a short "why" for its default.
- [ ] 2.4 Leo's current targets unchanged (D6); none marked not a focus by default (D7).
- [ ] 2.5 Backup/restore includes the profile; old backups still import.
- [ ] 2.6 Spec updated; tests pass; checked in the preview; Leo reviews.

### Step 3: suggestions from progress
- [ ] 3.1 Research thresholds first (how many weeks of stall, what counts as a performance drop), with sources; show Leo before building.
- [ ] 3.2 Suggestion card in Plan ("Biceps stalled 3 weeks → +2 sets?"). Accept updates the target; Ignore hides it until the next trigger.
- [ ] 3.3 Never during a deload week; deload sessions ignored (same rule as the deload feature).
- [ ] 3.4 Roadmap: becomes a notification in the native app.
- [ ] 3.5 Spec updated; tests pass; checked in the preview; Leo reviews.

## 4. Final check (after step 3)
- [ ] Every decision D1–D10 is implemented as written.
- [ ] Every number in the model has a source or a "judgment" note.
- [ ] No personal values in the repo.
- [ ] APP_SPEC.md matches the app.
- [ ] Nothing in this document is left unticked without a reason written next to it.

## 5. Open questions / parked
- Endurance and strength per-muscle volume evidence is thinner than for growth: flag in the app.

## 6. Step 1 draft: the model (code: `src/core/volumeModel.ts`, tests: `volumeModel.test.ts`)

Units: fractional weekly sets per muscle (direct 1, indirect ½), same as the rest of the app.

### 6.1 Goal base (large reference muscle)
| Goal | Base | Source |
|---|---|---|
| Muscle growth | 10–20 | Schoenfeld 2017 (10+ trend best); Baz-Valle 2022 (12–20 ≈ >20); Pelland 2024 (keeps rising, smaller gains) |
| Strength | 6–12 | **Judgment**, anchored on Ralston 2017 (medium/high weekly sets beat low) and Pelland 2024 (strength levels off sooner) |
| Endurance | 10–20 | **Judgment**: no volume study found; endurance comes from reps/rest, not more sets. Low confidence |
| Maintenance | 4–7 | Bickel 2011: ⅓ of training volume kept size in young adults (older adults needed more) |

### 6.2 Muscle factors (0 low · 1 medium · 2 high), **judgment** unless a source is named
| Muscle | Size | Damage | Joint | Reason |
|---|---|---|---|---|
| Back | 2 | 0 | 1 | large; lower back loads on rows |
| Biceps | 0 | 2 | 1 | small; damages easily (Chen 2011); elbow tendons |
| Triceps | 1 | 2 | 1 | medium; damages easily (Chen 2011); elbow tendons |
| Side delts | 0 | 0 | 1 | small; recovers fast; shoulder joint |
| Rear delts | 0 | 0 | 0 | small; recovers fast |
| Traps | 1 | 0 | 0 | medium; recovers fast |
| Front delts | 0 | 0 | 1 | small; presses already work it |
| Chest | 1 | 0 | 1 | medium; shoulder joint |
| Quads | 2 | 0 | 1 | large; least damage-prone (Chen 2011); knees |
| Hamstrings | 1 | 1 | 0 | more damage-prone than quads (Chen 2011) |
| Adductors | 1 | 0 | 0 | medium |
| Calves | 0 | 0 | 0 | small; used all day |
| Glutes | 2 | 0 | 0 | large |
| Rotator cuff | 0 | 0 | 2 | shoulder stability; keep moderate |
| Forearms | 0 | 0 | 1 | elbow tendons |

### 6.3 Formula
- min = base.min × (0.6 + 0.2 × size) × profile min factor
- max = base.max × (0.8 + 0.1 × size − 0.05 × damage − 0.05 × joint) × profile max factors
- max ≤ 11 × days the plan trains the muscle directly (Pelland 2024: ~11 fractional sets per session, no detectable extra growth beyond)
- Rounded to whole sets; max ≥ min + 2. All multipliers are **judgment**.

### 6.4 Profile adjustments (**judgment** unless noted)
| Input | Effect |
|---|---|
| Years training < 1 | min ×0.7, max ×0.8 |
| Years training > 3 | max ×1.1 |
| Age 40–59 | max ×0.9 |
| Age 60+ | max ×0.85; maintenance min ×1.5 (Bickel 2011: older adults need more to maintain) |
| Sleep 6–7 h | max ×0.9 |
| Sleep < 6 h | max ×0.8 (Lamon 2021: one night without sleep cut muscle protein synthesis 18%) |
| Cutting | max ×0.85 (Murphy & Koehler 2022: lean-mass gains impaired in a deficit) |
| Bulking | max ×1.05 |

### 6.5 Known weaknesses (for Leo's review)
- The model's growth ranges come out **lower** than both Leo's plan and the coaching landmarks (e.g. biceps 6–13 vs plan 14–20 vs coaching 10–16). The size/damage multipliers may be too conservative.
- No "priority muscle" factor (not agreed; Leo's plan prioritizes arms/back/shoulders/traps).
- Endurance and strength bases are judgment with thin evidence.

### 6.6 Sources
Schoenfeld 2017 (J Sports Sci) · Baz-Valle 2022 (J Hum Kinet) · Pelland 2024 (SportRxiv preprint) · Ralston 2017 (Sports Med) · Bickel 2011 (MSSE) · Chen 2011 (Eur J Appl Physiol) · Lamon 2021 (Physiol Rep) · Murphy & Koehler 2022 (Scand J Med Sci Sports)
