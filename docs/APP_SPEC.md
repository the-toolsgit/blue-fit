# Blue Fit: App Specification

Platform-neutral description of the whole app. A Swift or Android developer should be able to rebuild Blue Fit from this document without reading the web code. Kept current with every behavior or design change.

Spec version: 0.1 (Phase 1). Backup format version: 1.

---

## 1. Purpose and users

Blue Fit is a single-user training app that replaces Jefit for one advanced lifter. It plans training (routines), logs every workout set by set, and tracks progress. It is mobile-first, used one-handed mid-workout, and works fully offline.

- One user, no accounts, no social features.
- All data stays on the device. Backup is a JSON file the user exports and imports.
- Units: pounds (lb). Weights are stored exactly as the user types them (see §5.1).
- Feature model: Jefit's planning and tracking, plus a full "how to do it" card with an animated line figure for every exercise.

## 2. Navigation

Bottom tab bar (always visible, floating glass bar): **Today · Plan · History · Progress · Settings**.

Above the tab bar sits the **dock**, a stack of floating actions:
- Today's **Start workout** button (on Today, when no workout is running and the selected day has exercises).
- The **rest timer** row, when a rest timer is running (on every screen).
- **Resume workout** button, when a workout is running and you're not on the logger. If a rest timer is also running, the timer row gets a ▶ button instead (it goes to the logger).

Routes (web uses hash routes because GitHub Pages has no server routing):

| Route | Screen | Tab highlighted |
|---|---|---|
| `today` (default) | Today | Today |
| `workout` | Workout logger | Today |
| `exercise/{id}` | Exercise detail (page) | Plan |
| `summary/{sessionId}` | Workout summary | History |
| `plan` | Plan | Plan |
| `history` | History | History |
| `progress` | Progress | Progress |
| `settings` | Settings | Settings |

Exercise detail also opens as a **bottom sheet** from Today and the logger, so you never lose your place.

Page change animation: the new page fades in and rises 14 px (0.42 s, ease-out `cubic-bezier(.22,1,.36,1)`). Disabled with reduced motion.

## 3. Screens

### 3.1 Loading
Shown while storage opens. The line figure doing a dumbbell curl (LOADING pose), label "LOADING". Storage error: toast "Storage unavailable. This browser blocked local storage. Private mode can cause this."

### 3.2 Today
- **Header:** small static FLEX figure + "BLUE FIT" in neon, today's date (e.g. "NOV 14").
- **Week strip:** 7 buttons Mon→Sun. Today's weekday is preselected. The selected day is a neon gradient pill; today's day (if not selected) is neon text. A green glowing dot marks days of the current week (Mon–Sun) with a finished workout for that routine day.
- **Training day card:** eyebrow "TODAY · MONDAY" (or just the weekday when previewing another day); day title huge in neon gradient (e.g. "BACK & BICEPS"); "✓ Done today" badge if a finished session today has this day. A large animated figure cycles through the day's exercises, one per 3.2 s animation loop, with the exercise name under it. Three stat tiles: exercises · sets · ~minutes (time estimate §5.8).
- **Exercises list:** number, small static figure, name, ★ if heavy, the slot note (or primary muscles), "sets × reps". Tap opens the exercise detail sheet.
- **Free workout** text button: starts an empty session titled "Free workout".
- **Dock:** "▶ START WORKOUT" (pulsing glow) or "START WEDNESDAY" when previewing another day. Hidden when a workout is active (the dock then shows Resume).
- **Rest day state** (no day, or a day without exercises; Sunday in the seed plan): REST figure sitting on a bench, breathing slowly; "REST DAY"; "Walk if you like, but keep it easy."; hint to pick a day above or start a free workout.

### 3.3 Workout logger
- **Sticky header:** "WORKOUT · m:ss" (elapsed, live), the session title, notes button (neon when notes exist), **Finish** button, a neon progress bar of done/total sets, and "n/N sets".
- **Exercise cards** in order. The current exercise (focus) has a neon border and glow and an animated figure; others are slightly dimmed when complete and show a still figure.
  - Number badge (neon when focused, green ✓ when all sets done).
  - Name (tap → exercise detail sheet) with ★ if heavy; "sets × rep range · rest 2 min"; "swapped from X" if swapped.
  - Note (if any).
  - **Last:** "Last: 170 × 10, 10, 9" from the most recent finished session with this exercise (§5.6).
  - **Progression hint** (§5.5) with a **Use** button that writes the suggested weight and reps into the sets not yet done.
  - **Set rows:** type button (number for working sets, W warm-up, D drop, F failure; tap cycles working → warm-up → drop → failure), "weight /side × reps", and a done toggle (green glow when done; tap again to undo).
  - The **selected set** (first not-done set by default; tap a row to pick another) expands: Weight stepper (step = exercise increment; label shows "lb", "lb per side" or "lb per hand"), Reps stepper (step 1; first tap on an empty value jumps to the rep minimum), plate breakdown for per-side lifts (§5.9), big **✓ DONE · SET n**, and "Remove this set".
  - "+ Add set" (copies the last set's weight and reps).
  - Superset groups: consecutive entries with the same group letter get a cyan glowing bracket on the left and a "SUPERSET A" label.
- **⋯ menu per exercise:** Swap for this workout · Superset with next exercise / Unlink from next · Add note / Edit note · Add warm-up set · Move up · Move down · How to do it · Remove from workout (confirm).
- **+ Add exercise** opens the exercise picker (§3.9).
- **Marking a set done:** saves immediately; later empty sets of the same type copy its weight/reps; light haptic where supported; PR check (§5.4) shows a pink "NEW PR!" toast with a flexing figure and sparks; the rest timer starts (§5.7) if auto-start is on; focus moves to the next exercise when this one is finished (smooth scroll).
- **Finish sheet:** "FINISH WORKOUT?", "x of y sets done · n min. k sets not done will be dropped.", **Finish**, Keep going, Discard workout (confirm: "Everything logged in it is deleted. This can't be undone."). Finishing with no done sets goes to the discard confirmation.
- **Empty states:** no active workout → LOADING figure, "No workout running", button to Today. Free workout with no exercises → "Add your first exercise."
- Screen stays on while the logger is open (setting, §3.8).
- **Resume:** the active session lives in storage; closing the app and reopening restores it exactly.

### 3.4 Workout summary
- Fresh finish (within 10 min): big FLEX figure flexing, date, "WORKOUT COMPLETE" in neon gradient, the workout title. Past workout: back button and the title instead.
- Three tiles counting up from zero: minutes, sets (non-warm-up done sets), volume lb (tonnage §5.3).
- **Personal records** (pink section) per exercise with the PR kinds.
- **Sets per muscle** this session (fractional, §5.2) as neon bars.
- **Exercises** with sets line and notes (tap → exercise page). Workout notes.
- **Done** (fresh) → Today. **Delete workout** (confirm).

### 3.5 Exercise detail
Large animated figure (200 px), name, ★, primary muscle badges (neon), secondary badges (outline), ★ heavy badge, "why" text, sections Setup, Form, Tips (cyan heading), Avoid (red heading); info box: Range, Rest, Tempo, Equipment (+ how to log the weight), Counts as (e.g. "Back ×1 · Biceps ×½"). **Your records:** Heaviest, Best est. 1RM, Best volume, Last time; or "No sets logged yet." A slot can override "why" and "tips" (used for the leg-day cable lateral raise).

### 3.6 Plan
Routine name in neon gradient, "6 days · 36 exercises · 117 sets a week", horizontally scrolling rule cards (Effort, Progression, ★ Heavy) from routine data, day chips, the selected day's title with "sets · ~min" and its slots (figure, name, ★, note, rest, sets × reps → exercise page). **Weekly volume** table (§3.10). Editing arrives in Phase 3.

### 3.7 History (Phase 1 version)
Finished workouts grouped by week ("This week", "Week of Nov 9") with count; each row: weekday + day number, title, "min · sets · volume lb" → summary. Empty: FLEX figure, "No workouts yet. Finish one and it shows up here." Phase 2 adds the calendar heat map, streaks and editing.

### 3.8 Settings
- **Workout:** Default rest stepper (step 15 s; shows "2 min") + "Apply to every exercise in the plan" (confirm); Start rest timer when a set is done (switch); Sound when rest is over (switch); Keep screen on during a workout (switch).
- **Look:** Theme segmented control: System · Dark · Light.
- **Plates (pairs you have):** a stepper per plate weight (45, 35, 25, 10, 5, 2.5).
- **Data:** Export (downloads `blue-fit-backup-YYYY-MM-DD.json`), Copy JSON (clipboard), Import file, Paste JSON. Imports are validated (§7.3); a valid file shows a confirmation with its date and counts, then replaces all data. **Reset everything** (confirm) restores the seed.
- **App:** Update app (when a new version is waiting), install instructions when not installed ("Share → Add to Home Screen"), version.

### 3.9 Exercise picker (sheet)
Title (Swap exercise / Add exercise), search (name, aliases, muscles), muscle-group filter chips, equipment filter chips; list with figure, name, ★, muscles · equipment. With a muscle filter, exercises with direct work for that muscle come first. Swap hides the current exercise.

### 3.10 Volume table (component)
One row per muscle group (§4.2): name (priority muscles bold), value / target, status (✓, ⚠ below, ⚠ above, ⚠ by choice, or nothing for groups without a target), a neon bar with a dashed target band, and a detail line (days · angles · gap or note). Footer: "Indirect sets count as half. Warm-ups and drop sets don't count."

### 3.11 Progress (Phase 1 version)
"This week": workouts done / 6, volume lb, and the volume table of sets actually done this week (Mon–Sun, finished sessions). Phase 2 adds the charts, muscle map and recovery.

### 3.12 Toasts
Top of screen, auto-dismiss (3.2 s; PR 4.2 s), tap to dismiss. Kinds: info (bolt icon), PR (pink border and glow, flexing pink figure with 10 sparks), error (red border).

## 4. Data model

All IDs are strings. Dates: `YYYY-MM-DD` local calendar date; timestamps: ISO 8601 UTC.

### 4.1 Exercise
| Field | Type | Notes |
|---|---|---|
| id | string | slug of the name, e.g. `t-bar-reverse-row` |
| name | string | |
| aliases | string[] | includes the Jefit name |
| muscles | string[] | primary muscles, display text |
| secondaryMuscles | string[] | display text |
| volume | {group, weight: 1 \| 0.5}[] | drives all volume math (§4.2) |
| equipment | barbell \| smith \| fixedBar \| dumbbell \| cable \| machine \| plateMachine \| bodyweight \| other | |
| loadMode | perSide \| total \| perHand | how the logged number relates to the load |
| isHeavy | boolean | ★ |
| bodyRegion | upper \| lower | |
| why | string | |
| setup, form, tips, avoid | string[] | |
| rangeOfMotion, tempo | string | |
| defaultRestSec | int | 120 |
| incrementLb | number | stepper step and progression jump |
| figure | FigureSpec \| null | §8 |
| isCustom, archived | boolean | |

### 4.2 Muscle groups and the approved mapping
Groups: back, biceps, triceps, sideDelts, rearDelts, traps, frontDelts, chest, quads, hamstrings, adductors, calves, glutes, rotatorCuff, forearms. Priority (bold): back, biceps, triceps, side delts, rear delts, traps.

| Exercise | Direct (1) | Indirect (0.5) | Equipment / load | Increment |
|---|---|---|---|---|
| T-Bar Reverse Row ★ | back | rear delts, biceps | plate machine / per side | 2.5 |
| Single-arm Cable Lat Pulldown | back | biceps | cable | 5 |
| Single-arm DB Row | back | rear delts, biceps | dumbbell / per hand | 5 |
| Straight-arm Cable Pulldown | back | — | cable | 5 |
| DB Incline Curl | biceps | — | dumbbell / per hand | 5 |
| Barbell Preacher Curl | biceps | — | fixed bar | 10 |
| Machine Shoulder Press ★ | front delts | side delts, triceps | machine | 5 |
| Cable Lateral Raise | side delts | — | cable | 5 |
| Lateral/Shrug Hybrid ★ | traps | side delts | dumbbell / per hand | 5 |
| Barbell Shrug ★ | traps | — | barbell / per side | 2.5 |
| Overhead Trap | traps | — | cable | 5 |
| Machine Reverse Fly | rear delts | — | machine | 5 |
| Smith Squat ★ | quads | adductors, glutes | Smith / per side | 5 |
| Leg Extension | quads | — | machine | 10 |
| Prone Leg Curl | hamstrings | — | machine | 10 |
| Hip Adduction | adductors | — | machine | 10 |
| Standing Calf Raise | calves | — | machine | 10 |
| Wide-Grip Lat Pulldown ★ | back | biceps | cable | 5 |
| Cable Seated Row ★ | back | rear delts, biceps | cable | 5 |
| EZ Bar Incline Tricep Extension | triceps | — | fixed bar | 10 |
| Machine Dip ★ | triceps | chest, front delts | machine | 5 |
| V-Bar Pushdown | triceps | — | cable | 5 |
| Rope Face Pull | rear delts | traps, back, rotator cuff | cable | 5 |
| Lean-away Lateral Raise | side delts | — | dumbbell / per hand | 5 |
| All-the-way-up Lateral Raise | side delts | traps | dumbbell / per hand | 5 |
| Kelso Shrug | traps | — | machine | 5 |
| Single-arm Cable Reverse Fly | rear delts | — | cable | 5 |
| Rope Overhead Tricep Extension | triceps | — | cable | 5 |
| DB Hammer Curl ★ | biceps, forearms | — | dumbbell / per hand | 5 |
| Leg Press ★ | quads | adductors, glutes | plate machine / per side | 5 |
| Seated Leg Curl | hamstrings | — | machine | 10 |
| Seated Calf Raise | calves | — | machine | 10 |
| Cable One-Arm Tricep Kickback | triceps | — | cable | 5 |

With the seed plan this gives exactly: back 20, biceps 16.5, triceps 18, side delts 15.5, rear delts 14.5, traps 15.5, front delts 6, chest 2, quads 13, hamstrings 8, adductors 10.5, calves 8, glutes 3.5, rotator cuff 2, forearms 3.

### 4.3 Routine
`Routine { id, name, isCurrent, createdAt, rules?: {title, text}[], days: RoutineDay[] }`
`RoutineDay { id, weekday: 0–6 | null (0 = Sunday), title, slots: Slot[] }` (order = array order)
`Slot { id, exerciseId, sets, repMin, repMax, restSec, supersetGroup?, notes?, whyOverride?, tipsOverride? }`
Exactly one routine has `isCurrent = true`. Seed: "Leo v3.1" (Mon Back & Biceps, Tue Shoulders & Traps, Wed Legs A, Thu Back & Triceps, Fri Shoulders, Traps & Arms, Sat Legs B, Sun Rest), all rests 120 s.

### 4.4 Volume target
`VolumeTarget { group, min: number | null, max: number | null, angles?, gap?, note?, acceptedBelow? }`. Seed: back 14–22, biceps 14–20, triceps 14–22, side delts 14–20, rear delts 14–20, traps 12–20, front delts 6–8, quads 10+, hamstrings 10+ (acceptedBelow, note "by choice (shorter leg days)"), adductors 10+, calves 8+; chest (note "0 by plan"), glutes, rotator cuff, forearms have no target ("tracked only").

### 4.5 Session (logged workout)
`Session { id, date, title, routineId?, dayId?, startedAt, finishedAt?, status: active | finished, notes?, source: app | jefit, importKey?, entries: SessionEntry[] }`
`SessionEntry { id, exerciseId, swappedFromId?, slotId?, supersetGroup?, restSec, repMin?, repMax?, notes?, sets: LoggedSet[] }`
`LoggedSet { id, type: warmup | working | drop | failure, weight: number | null, reps: int | null, done: boolean, rir?: number | null, completedAt?: timestamp | null }`
At most one session is `active`. Duration = finishedAt − startedAt (minutes, rounded).

### 4.6 Settings
`{ units: "lb", restDefaultSec: 120, autoStartRest: true, sound: true, keepAwake: true, theme: system | light | dark, plates: [{weight, pairs}] }`. Default plates (pairs): 45×8, 35×2, 25×4, 10×4, 5×4, 2.5×2.

### 4.7 Other records
- `JefitAlias { jefitName, exerciseId | null }` (null = skip). Seeded from every exercise's aliases.
- `RestTimer { endsAt (epoch ms), durationSec, sessionId, entryId }`: stored so it survives navigation and restarts.
- Personal records are **derived**, never stored (§5.4).

### 4.8 Later phases (designed, not built)
- `BodyEntry { id, date, weightLb?, bodyFatPct?, measurements: {chest?, hips?, upperWaist?, lowerWaist?, upperArmR?, upperArmL?, forearmR?, forearmL?, thighR?, thighL?} (inches), photoIds?: string[], source: manual | scan }`, with a bodyweight band setting (min/max).
- Routine versions and deload weeks: `Routine.basedOn?`, `Session.routineId` keeps history tied to the version used.

## 5. Business rules

### 5.1 Weights
Stored exactly as typed. Plate-loaded lifts (Smith Squat, T-Bar Row, Leg Press, Barbell Shrug): weight on **one side**, bar not included. Dumbbells: **per hand**. Fixed bars (EZ, preacher): the number on the bar (10 lb steps). Machines and cables: the stack number. There is no bar-weight setting; tonnage is a personal trend number.

### 5.2 Fractional volume (weekly sets)
For each done set whose type is **working or failure**: for each `{group, weight}` in the exercise's `volume`, add `weight` (1 or 0.5) to that group. Warm-ups and drop sets add nothing.
Plan volume: `Σ slot.sets × weight` over all slots of the routine. **Days** = number of routine days with at least one **direct** (weight 1) slot for that group.
Status vs target: no target or min null → none; value < min → below (or **by choice** when `acceptedBelow`); max set and value > max → above; else ✓.

### 5.3 Tonnage (volume lb)
`Σ weight × reps` over done sets whose type is **not warm-up** (drop and failure included), using the logged number as is.

### 5.4 1RM and personal records
- Estimated 1RM (Epley): `weight × (1 + reps / 30)` (0 when reps = 0).
- Records per exercise from done, non-warm-up sets with weight and reps > 0: heaviest weight (ties broken by more reps), best e1RM, most reps at each exact weight, best session volume (Σ weight × reps of that exercise in one session).
- **PR alerts**: when a set is marked done, compare it with records from all other sessions plus this exercise's earlier done sets in the current session. No history for the exercise → no PR (first time sets the baseline). Kinds: heaviest weight (weight > record), best est. 1RM (> record), most reps at this weight (only at a weight done before), best session volume (the entry's volume crosses the record).
- Summary PRs: the same, evaluated over the whole entry.

### 5.5 Progression hint
Uses the last finished session with done sets of the exercise; considers its done **working and failure** sets.
- None → no hint.
- Every one reached the top of the rep range (`reps ≥ repMax`) → "Hit the top last time. Try {heaviest + increment} × {repMin}".
- Otherwise → "Beat last time: {heaviest} × {reps}", where the target reps are last time's reps with +1 on the first set below `repMax`.
- **Use** applies weight and target reps to the working sets not done yet.

### 5.6 Pre-fill and carry-forward
New entries get the slot's set count (working sets) pre-filled per position from the last session's done working/failure sets (weight and reps; the last one repeats when there are more sets). No history → empty values. When a set is marked done, later not-done sets of the same type with empty weight/reps copy its values.

### 5.7 Rest timer and supersets
After a set is marked done (auto-start on, entry rest > 0): start a timer for the entry's rest seconds, unless the entry is in a superset and not the last of the group in this round. Superset order: after a set in group member *i*, go to the next member with sets left; rest only when the round wraps to the start of the group. The timer stores an absolute end time, shows a ring + m:ss, can be adjusted −15/+15 s (never below 1 s left) and skipped; tapping it opens a full-screen ring with the REST figure. At zero: three-tone chime (880, 1175, 1568 Hz, 0.16 s apart), vibration where supported, "GO!" in green, auto-clears after 6 s. Timers that ended more than 60 s before a restart are discarded.

### 5.8 Time estimate
`round((sets × 0.75 + (sets − 1) × 2 + exercises) / 5) × 5` minutes (45 s per set, 2 min rest between sets, 1 min setup per exercise). Seed plan: Mon 55, Tue 55, Wed 65, Thu 60, Fri 55, Sat 60.

### 5.9 Plate math
Input: the per-side weight. Greedy from the heaviest plate, limited by pairs owned. Output: plates for one side and any remainder that can't be loaded ("+1 lb can't be loaded").

### 5.10 Today's day
Today's weekday (local time) → the current routine's day with that weekday. Missing or empty day → rest day. The user can preview any weekday and start it.

### 5.11 Finishing
Finish drops sets not done and exercises left with no done sets, sets `status = finished` and `finishedAt`. A session with nothing done can only be discarded.

### 5.12 Streak (Phase 2)
A week (Mon–Sun) counts when all 6 planned training days are logged. Streak = consecutive counted weeks.

### 5.13 Recovery (Phase 2)
Per muscle group: ≥ 4 fractional working sets in the last 48 h → recovering; trained within 48–72 h → partially recovered; otherwise fresh. Display only (muscle map shading).

## 6. Design system

### 6.1 Concept
Neon, built from the blue line man: deep-space background with blue/cyan haze and a faint 28 px measuring grid; glass surfaces; thin precise strokes with a glow; condensed uppercase display type. Dark is the hero theme. It should feel like a precise instrument with personality: fun, alive, and fast to use with one hand.

### 6.2 Color tokens
| Token | Dark | Light | Use |
|---|---|---|---|
| bg / bg-2 | #04060C / #08101F | #EEF3FC / #E3EBFA | background gradient |
| surface | rgba(13,21,39,.72) | rgba(255,255,255,.82) | glass cards (blur 16) |
| surface-solid | #0B1322 | #FFFFFF | sheets, toasts |
| surface-2 | rgba(25,39,68,.62) | rgba(226,236,253,.85) | inputs, tiles |
| line / line-strong | rgba(110,165,255,.15/.34) | rgba(31,90,200,.14/.30) | borders |
| ink / muted / faint | #EAF2FF / #8494B4 / #4A5878 | #0A1430 / #52618A / #9AA8C6 | text |
| fig | #4FA6FF | #1F6BFF | figure body |
| fig2 | #2B5AA6 | #9DBCF6 | figure equipment, floor |
| neon / neon-2 | #3D9BFF / #23E2FF | #1F6BFF / #00A3D4 | primary, gradients |
| glow / glow-soft | rgba(61,155,255,.55/.18) | rgba(31,107,255,.32/.10) | shadows |
| pink | #FF3FA8 | #E0187F | PRs, celebration |
| good / warn / bad | #3DFFB0 / #FFC53D / #FF4D6A | #0B9E62 / #B7791F / #D6334F | status |
| star | #FFC53D | #C98A12 | ★ heavy |
| on-neon | #02101F | #FFFFFF | text on neon fills |

### 6.3 Type
Display: Barlow Condensed 600/700, uppercase, letter-spacing .02–.16 em (XL 46/0.92, LG 32, MD 22). Body: IBM Plex Sans 400/600, 15/1.5. Numbers: IBM Plex Mono 500, tabular. Eyebrow: 12 px, 600, .16 em, uppercase, muted.

### 6.4 Spacing, shape, motion
Spacing 4/8/12/16/24/32. Radii 10/16/22 (cards 22, sheets 26 top). Minimum tap target 44 px; primary buttons 54–62 px. Ease `cubic-bezier(.22,1,.36,1)`. Motion: page enter 0.42 s; sheet slide-up 0.42 s; dock items rise 0.4 s; button press scale .96; Start button glow pulse 2.4 s; done toggle fills green with glow; bars grow from 0 in 0.9 s; summary numbers count up 1 s; PR toast drops in with 10 sparks. **Reduced motion:** all animation off, figures show the end position (pose B).

### 6.5 Components
Glass card (with gradient hairline edge), primary button (neon→cyan gradient, dark text, glow), ghost button, quiet button, danger button, chip (selected = neon fill), badge (primary/secondary/star/pink), stepper (− value +, 52 px tall, typeable), switch, segmented control, bottom sheet (grip, backdrop blur), confirm sheet, toast, list row, volume bar with target band, progress ring (rest timer), tab bar (floating glass, active icon glows with a neon bar on top).

### 6.6 Icons
24 × 24 line icons, stroke 1.9, round caps/joins, same style as the figure: today (dumbbell), plan (clipboard), history (calendar), progress (rising line), settings (sliders), plus, minus, check, close, more, swap, back, chevron, up, down, trash, note, link, info, timer, play, search, download, upload, copy, bolt, flame, trophy.

### 6.7 Logo and app icon
The FLEX pose (front double-biceps) drawn by the figure engine at progress 1, stroke #6CC0FF 3.2, with a soft blue glow (Gaussian blur 1.3 in figure units, merged twice under the crisp line), on a radial gradient #0F2350 → #070D1D → #03050B with a blue halo. Sizes: 192, 512, maskable 512 (figure at 62 % for the safe zone), Apple touch 180, SVG favicon (rounded).

## 7. Storage

### 7.1 Interface (`StorageAdapter`)
`init(seed)`, `all(table)`, `put(table, row)`, `putMany(table, rows)`, `remove(table, key)`, `getSettings()`, `saveSettings(s)`, `getMeta(key)`, `setMeta(key, value)`, `exportAll()`, `replaceAll(data)` (one transaction). Tables and keys: exercises.id, routines.id, sessions.id, targets.group, jefitAliases.jefitName. Screens never touch the database directly.

### 7.2 Write-through
The UI updates its in-memory snapshot immediately, then queues the write; writes run in order. A failed write shows "Couldn't save" with advice to export a backup. The browser is asked for persistent storage.

### 7.3 Backup JSON (version 1)
```json
{ "app": "blue-fit", "schemaVersion": 1, "exportedAt": "2026-11-14T18:00:00.000Z",
  "data": { "exercises": [...], "routines": [...], "sessions": [...], "targets": [...], "settings": {...}, "jefitAliases": [...] } }
```
Import checks, in order: valid JSON ("This file isn't valid JSON."); `app` = "blue-fit" ("This isn't a Blue Fit backup file."); version not newer than supported ("…from a newer version of Blue Fit…"); full schema (first error with its path); every session and slot references a known exercise; at most one current routine. Then the user confirms and all data is replaced. Older versions will be migrated step by step.

### 7.4 Swapping in a cloud database later
Implement `StorageAdapter` against the cloud store (e.g. Supabase tables with the same keys plus `userId`), add sign-in, keep IndexedDB as an offline cache, and sync by `id` with last-write-wins on `updatedAt` (to be added to rows at that point). No screen changes.

### 7.5 Seed
On first launch (no exercises stored) the seed is written: 33 exercises, routine "Leo v3.1" (36 slots, 117 sets), targets, default settings, Jefit aliases. Seed JSON is extracted from the plan page by a script.

## 8. Figure engine

### 8.1 Coordinate system
View box x 0–120, y −24–107 (width 120, height 131); y grows downward; floor line y = 105. Angles in degrees with `V(a, L) = (sin a · L, cos a · L)`: 0° points down, 90° right, 180° up. Segment lengths: thigh 24, shin 23, torso 34, neck→head center 11 (side) / 12 (front), upper arm 20, forearm 18, foot 8, head radius 7.

### 8.2 Spec format
`{ v?: "f" (front view; default side view), base: {param: value}, A: {param: value}, B: {param: value}, props?: Prop[] }`. Animated params interpolate linearly from A to B with progress k; others come from `base`, then defaults `hx 60, hy 57, t 0, ua 0, fa 0, th 0, sh 0`.

**Side view params:** hx, hy (hip); t (torso lean, 0 = upright, + = forward); th, sh (thigh, shin angles); ua, fa (upper arm, forearm angles); al, fl (arm segment length factors); sb (shoulder shift x); nofoot; anchor + ax + ah (feet planted at x = ax, heel raise ah; legs solved upward from the ankle).
Joints: hip; knee = hip + V(th, 24); ankle = knee + V(sh, 23); toe = ankle + V(sh + 90, 8); shoulder = hip + V(180 − t, 34) + (sb, 0); head = shoulder + V(180 − t, 11); elbow = shoulder + V(ua, 20·al); hand = elbow + V(fa, 18·fl). Lines: hip-knee-ankle-toe, hip-shoulder, shoulder-elbow-hand.

**Front view params:** cx (center x, default 60), hy, tl (torso tilt), hw (half hip width, default 6), lf (thigh length factor), la, sa (thigh/shin spread), shr (shrug, raises shoulders), ua, fa, al, fl for the right arm mirrored to the left (×−1), L (separate left arm), rot (rotate the whole figure about (cx, 104), then drop it so the lower ankle is on the floor; toes redrawn flat). Shoulders are 11 out from the center at hip + 34 up; head 12 above the shoulder center.

**Props (drawn in fig2):** `line [x1,y1,x2,y2]`; `cable [x,y] → joint` (dashed 2 2, pulley circle r 2.2; `barmid` = midpoint between hands); `db joint` (8-wide bar, stroke 4); `bar` (between hands ±7, stroke 2.5); `pad joint` (circle r 2.6 or r); `perp joint, ang, len` (platform line through a joint).

### 8.3 Rendering
Main lines: polylines, stroke fig 2.6, round caps/joins, no fill; head circle r 7. Props: stroke fig2 1.6. Floor: fig2, 1. Neon: a glow drop-shadow under the whole figure.

### 8.4 Timing
Loop 3.2 s: ease-in-out A→B over 42 %, hold B 8 %, ease B→A 42 %, hold A 8 % (ease = quadratic in-out). Redraw about 30 fps, only while visible. Reduced motion: draw pose B once.

### 8.5 Brand poses
FLEX (logo, PR, summary): front view, base hy 60, la 9, sa 3; A ua 76 fa 150 → B ua 92 fa 182 shr 1.5. REST (rest day, rest timer): side view sitting back on a bench with hands behind, breathing (t −24 → −19). LOADING: side-view dumbbell curl.

## 9. Offline, install, deploy
- PWA: manifest (standalone, portrait, theme #05070D), service worker precaches all app files (latin font subsets only); works with no network after the first visit. Update flow: "Update ready" toast and Settings → Update app.
- iPhone: install from Safari via Share → Add to Home Screen. Web limits: no vibration; no alert while the screen is locked (the app keeps the screen on during workouts instead).
- Hosting: GitHub Pages project site at `/blue-fit/`; GitHub Actions builds, tests and deploys on every push to `main`.

## 10. Feature table (Jefit → Blue Fit)

| Jefit feature | Blue Fit | Status |
|---|---|---|
| Routines with days and exercises | Routine → days → slots, current routine | Built (view); editor Phase 3 |
| Routine editor (add/remove/reorder, sets, reps, rest) | Plan editor with drag and drop, live volume table | Planned (Phase 3) |
| Supersets | Superset groups in logger (link/unlink) and plan | Built (logger); plan Phase 3 |
| Exercise database + search/filters | Exercise library + picker (muscle, equipment) | Built |
| Custom exercises | Same fields + optional figure | Planned (Phase 3) |
| Exercise instructions / videos | Full how-to card + animated line figure | Built (videos left out) |
| Workout logging with previous values | Logger with pre-fill, Last line, steppers | Built |
| Set types (warm-up, drop, failure) | Warm-up, working, drop, failure | Built |
| Rest timer | Auto rest timer, adjustable, chime, persists | Built |
| Plate calculator | Plates per side | Built |
| Personal records + alerts | Derived PRs, live pink alerts | Built |
| Workout summary | Summary with PRs and sets per muscle | Built |
| Workout history list | History list | Built (basic); calendar + edit Phase 2 |
| Calendar / streaks | Heat-map calendar, weekly-plan streak | Planned (Phase 2) |
| Progress charts (1RM, volume) | Per-exercise charts, weekly sets vs targets, tonnage | Planned (Phase 2) |
| Muscle recovery map | Muscle map + recovery status | Planned (Phase 2) |
| Import history | Jefit export importer with name mapping | Planned (Phase 4) |
| Body stats and photos | Body tracking (weight band, scans, photos) | Later phase |
| Interval / stopwatch timer | Timer modes | Later phase |
| Cloud sync / account | Swap StorageAdapter | Later phase |
| AI coach, social, community, watch apps, video library | — | Left out |
