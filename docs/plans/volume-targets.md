# Plan: Interview phase · our own weekly volume targets (goal, profile, progress)

**Interview** = the foundation set up before the workout routine (D11): goal, profile, priorities and the volume model. The routine is built on top of it afterwards.

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
| D11 | This is the **Interview** phase: the foundation before the workout routine. Once it's defined, the routine is built on it. | "This is all part of a phase that we should label Interview, which is pre workout routine" |
| D12 | The model must be **truthful and useful for the goal**, not cautious. For Leo the goal is **mass gain**. | "i dont want the model to be too cautious, i want it to be truthful and useful for the goal WHICH IN THIS CASE IS MASS GAIN" |
| D13 | Add a **priority factor** per muscle. | "WE SHOULD add priority factor" |
| D14 | Strength/endurance numbers come from **our own reasoning about what a muscle needs** for each goal, not from waiting on conclusive research. | "think about what a muscle needs for gaining mass and what it needs for gaining strength in the gym and come up with your own model" |

Already built (before this plan): editable targets in Edit plan (min/max steppers, Not a focus switch, Reset targets to defaults).

## 2. Ground rules for this work

- **Don't make anything up.** Every number is either (a) from a cited source, or (b) **derived by our own reasoning**, with the reasoning written next to it. Nothing unexplained.
- **Not cautious, truthful** (D12): ranges aim at what actually works for the goal, not at the safest number.
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
- [x] 1.7a Draft 1 reviewed by Leo (Nov 16): too cautious, needs a priority factor, reason strength/endurance ourselves → draft 2.
- [x] 1.8 Draft 2: first-principles model (functions, recovery, per-session limit), priority factor, our own strength/endurance logic.
- [x] 1.9 Leo approved draft 2 (Nov 16).

### Step 2: training profile + defaults in the app
- [x] 2.1 Settings → Training profile: Goal (Mass · Strength · Endurance · Maintain), Eating (Cutting · Maintaining · Bulking), Age, Years lifting, Sleep. (Sessions per week: draft 2 uses each muscle's recovery instead of the plan's days.)
- [x] 2.1b Priority per muscle (D13): Priority · Normal · Not a focus in the target panel; default = the app's bold muscles.
- [x] 2.2 Reset targets to defaults uses the model's numbers when the profile is complete (else the plan's original numbers, D8).
- [x] 2.3 Each muscle shows "Suggested for you" with its range, the why, and a Use button.
- [x] 2.4 Leo's current targets unchanged (D6: nothing changes until he edits or presses Reset); Reset marks none as not a focus (D7).
- [x] 2.5 Backup/restore includes the profile and priorities; old backups still import (tested).
- [x] 2.6a Spec updated (§3.8, §4.6, §5.17, plan editor); 120 tests pass; checked in the preview.
- [ ] 2.6b Leo reviews in the app.

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

## 6. Step 1 model, draft 2 (code: `src/core/volumeModel.ts`, tests: `volumeModel.test.ts`)

Draft 1 (size/damage/joint multipliers on a 10–20 base) was replaced after Leo's review (D12–D14): it was cautious and had no priority.

Units: fractional weekly sets (direct 1, indirect ½), same as the rest of the app.

### 6.1 Reasoning (what a muscle needs)
1. **Hard sets drive growth.** A set ≈0–3 reps from failure is the unit of stimulus.
2. **One session can only use so many.** Beyond a point, extra sets in the same session add fatigue, not growth (Pelland 2024: ~11 fractional sets/session with no detectable extra growth). Muscles with more functions stay productive longer in one session because each function recruits partly different fibers: **6 / 8 / 10 sets** for 1 / 2 / 3 functions (our reasoning).
3. **It can only be trained again once recovered.** Sessions per week = min(3, 7 ÷ recovery days). Recovery days: 2 (small, low-damage, used all day), 2.5 (medium, or damage-prone: arms per Chen 2011), 3 (heavy lower-body: quads, hamstrings, glutes) (our reasoning).
4. **Every function needs its own work.** Floor = max(6, 4 × functions): at least 2 sessions × 3 sets, and ~4 sets for each function (our reasoning).

### 6.2 Goals
| Goal | Min | Max | Reasoning |
|---|---|---|---|
| Mass gain | floor (§6.1.4) | sessions × session sets | everything the muscle can use and recover from |
| Strength | same floor | 60% of mass max | heavy sets (1–6 reps) cost more recovery per set; strength is mostly practice on the lifts; size still drives it, so the floor stays |
| Endurance | same floor | recovery ½ day shorter | light sets (15–30+ reps) cause less damage, so it can train more often |
| Maintenance | ⅓ of mass | ⅓ of mass | Bickel 2011: ⅓ of training volume kept size |

### 6.3 Priority (D13)
- **Priority**: min moves to the middle of the range (aim for the top half). Max unchanged (recovery limit).
- **Normal**: full range.
- **Not a focus**: maintenance range.
- Defaults: none "not a focus" (D7). Leo's plan already marks back, biceps, triceps, side/rear delts, traps as priority.

### 6.4 Profile (scales the max; beginners also the min) (our reasoning unless noted)
| Input | Effect |
|---|---|
| Years training < 1 | min and max ×0.75 |
| Years training ≥ 3 | max ×1.1 |
| Age 40–59 | max ×0.92 |
| Age 60+ | max ×0.85; maintenance min ×1.5 (Bickel 2011) |
| Sleep 6–7 h | max ×0.92 |
| Sleep < 6 h | max ×0.8 (Lamon 2021: one sleepless night cut muscle protein synthesis 18%) |
| Cutting | max ×0.85 (Murphy & Koehler 2022: lean-mass gains impaired in a deficit) |
| Maintaining | — |
| Bulking | max ×1.1 |

### 6.5 Muscles
| Muscle | Functions | Recovery days | Why |
|---|---|---|---|
| Back | 3 | 2.5 | vertical pull, row, lat stretch/upper back |
| Biceps | 2 | 2.5 | curl, stretched long head; damage-prone (Chen 2011) |
| Triceps | 2 | 2.5 | overhead long head, pushdown/press |
| Side delts | 1 | 2 | raise to the side |
| Rear delts | 1 | 2 | pull arm back |
| Traps | 2 | 2 | shrug, retract |
| Front delts | 1 | 2 | raise forward; presses hit it |
| Chest | 2 | 2.5 | upper, mid/lower |
| Quads | 2 | 3 | squat/press, knee extension |
| Hamstrings | 2 | 3 | knee flexion, hip extension |
| Adductors | 1 | 2.5 | pull leg in |
| Calves | 2 | 2 | gastroc (straight knee), soleus (bent knee) |
| Glutes | 2 | 3 | hip extension, abduction |
| Rotator cuff | 1 | 2 | rotate/stabilize shoulder |
| Forearms | 2 | 2 | flexors, extensors |

### 6.6 Result for a sample profile (made up: age 30, 2 years, 8 h sleep, maintaining; ★ = priority)
| Muscle | Mass gain | Strength | Endurance | Maintenance | Leo's plan target | Plan does |
|---|---|---|---|---|---|---|
| Back ★ | 20–28 | 14–17 | 21–30 | 4–9 | 14–22 | 20 |
| Biceps ★ | 15–22 | 11–13 | 16–24 | 3–7 | 14–20 | 16.5 |
| Triceps ★ | 15–22 | 11–13 | 16–24 | 3–7 | 14–22 | 18 |
| Side delts ★ | 12–18 | 8–11 | 12–18 | 2–6 | 14–20 | 15.5 |
| Rear delts ★ | 12–18 | 8–11 | 12–18 | 2–6 | 14–20 | 14.5 |
| Traps ★ | 16–24 | 11–14 | 16–24 | 3–8 | 12–20 | 15.5 |
| Front delts | 6–18 | 6–11 | 6–18 | 2–6 | 6–8 | 6 |
| Chest | 8–22 | 8–13 | 8–24 | 3–7 | — | 2 |
| Quads | 8–19 | 8–11 | 8–22 | 3–6 | 10+ | 13 |
| Hamstrings | 8–19 | 8–11 | 8–22 | 3–6 | 8–10 | 8 |
| Adductors | 6–17 | 6–10 | 6–18 | 2–6 | 10+ | 10.5 |
| Calves | 8–24 | 8–14 | 8–24 | 3–8 | 8+ | 8 |
| Glutes | 8–19 | 8–11 | 8–22 | 3–6 | — | 3.5 |
| Rotator cuff | 6–18 | 6–11 | 6–18 | 2–6 | — | 2 |
| Forearms | 8–24 | 8–14 | 8–24 | 3–8 | — | 3 |

### 6.7 Sources
Pelland 2024 (SportRxiv preprint) · Bickel 2011 (MSSE) · Chen 2011 (Eur J Appl Physiol) · Lamon 2021 (Physiol Rep) · Murphy & Koehler 2022 (Scand J Med Sci Sports). Background: Schoenfeld 2017, Baz-Valle 2022, Ralston 2017.
