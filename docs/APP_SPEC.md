# Blue Fit: App Specification

Platform-neutral description of the whole app. A Swift or Android developer should be able to rebuild Blue Fit from this document without reading the web code. Kept current with every behavior or design change.

Spec version: 1.1 (deload weeks). Build phases: 1 logger ✓ · 2 history & charts ✓ · 3 plan editor ✓ · 4 Jefit import (skipped) · 5 polish ✓. Backup format version: 1.

---

## 1. Purpose and users

Blue Fit is a single-user training app that replaces Jefit for one advanced lifter. It plans training (routines), logs every workout set by set, and tracks progress. It is mobile-first, used one-handed mid-workout, and works fully offline.

- One user, no accounts, no social features.
- All data stays on the device. Backup is a JSON file the user exports and imports.
- Units: pounds (lb). Weights are stored exactly as the user types them (see §5.1).
- Feature model: Jefit's planning and tracking, plus a full "how to do it" card with an animated line figure for every exercise.

## 2. Navigation

Bottom tab bar (always visible, floating glass bar): **Today · Plan · History · Progress · Settings**. **Swipe right** on a screen with a back arrow (exercise, workout summary, edit workout) goes back, like tapping the arrow (it wins over the tab swipe). **Swipe left / right** on a main tab screen switches to the next / previous tab (sideways move ≥ 70 px, at least twice the vertical move, under 0.7 s; the new tab slides in from that side, 40 px, no fade; once played it stays put, nothing replays). Not on inner screens (workout, exercise, summary, edit, plan editor) and not where a sideways swipe already does something: horizontally scrolling rows, charts and the muscle-map caption, sheets and form fields. Once you scroll down it shrinks to a thin icons-only bar (64 → 46 px, labels fade, icons 24 → 20 px and centered, the active marker moves under the icon; 0.32 s). Tabs switch on touch end (a touch that moved under 12 px), so one tap works even while the page is still scrolling (iOS spends that tap stopping the scroll: it sends no click and cancels pointer events, but touch events still arrive). It stays thin when scrolling back up and grows back only at the top of the page, when the bar is tapped, or on a new screen. The dock above it follows.

The app doesn't zoom: pinch and double-tap zoom are blocked (viewport `user-scalable=no`, iOS gesture events cancelled, `touch-action: manipulation`), like a native app.

Behind the tab bar and dock, a soft fade to the page background (no blur) keeps scrolling content from clashing with them; it is taller when the dock shows something.

Above the tab bar sits the **dock**, a stack of floating actions:
- Today's **Start workout** button (on Today, when no workout is running and the selected day has exercises).
- The **rest timer** row, when a rest timer is running (on every screen).
- **Back to workout** button (with the workout's minutes so far), when a workout is running and you're not on the logger. If a rest timer is also running, the timer row shows the time and a **▶** button (play icon only; goes back to the workout) instead (−15/+15 are left out there to keep it clear; they're in the big timer). Tapping the timer opens the big timer (ring, REST figure, −15 s · +15 s · Skip), which also has **Back to workout** / **Go to workout** (closes it; the timer keeps running) and closes on a tap outside.

Routes (web uses hash routes because GitHub Pages has no server routing):

| Route | Screen | Tab highlighted |
|---|---|---|
| `today` (default) | Today | Today |
| `workout` | Workout logger | Today |
| `exercise/{id}` | Exercise detail (page) | Plan |
| `summary/{sessionId}` | Workout summary | History |
| `edit/{sessionId}` | Edit a finished workout | History |
| `plan` | Plan | Plan |
| `plan-edit/{routineId}` | Plan editor | Plan |
| `history` | History | History |
| `progress` | Progress | Progress |
| `settings` | Settings | Settings |

Exercise detail also opens as a **bottom sheet** from Today and the logger, so you never lose your place.

**Bottom sheets** (exercise detail, picker, plan manager, slot editor, confirms) close like iOS: swipe down from the grip at the top, or from anywhere while the sheet is scrolled to the top. The sheet follows the finger and the backdrop fades; letting go past ~110 px or with a quick flick closes it (slides off, 0.26 s), otherwise it springs back. No X button and no tap-on-backdrop close (Leo's choice); Escape still closes on a keyboard; confirms keep their Cancel button.

Page change animation: the new page fades in and rises 14 px (0.42 s, ease-out `cubic-bezier(.22,1,.36,1)`). Disabled with reduced motion.

## 3. Screens

### 3.0 Launch splash
Before the app loads, the screen is already the app background (no white flash): the page paints the background color before any script (dark, or light when the light theme applies), and on iPhone home-screen launches a plain dark launch image per iPhone size (`apple-touch-startup-image`, generated by `npm run icons`).
Shown once each time the app is launched (not when it returns from the background). Full screen in the app background with the haze/grid: the FLEX figure (150 px, no floor line, strong glow) centered, "BLUE FIT" below (display 34 px, letter-spacing .22em, neon). Timing (~2.1 s): figure and wordmark fade/scale in (0.38 s); the figure flexes once over 0.42 s (ease-out) and holds for the rest of 1 s and through the zoom: SPLASH_FLEX pose, upper arms flat (90°), forearms curl in from 180° to 200°, and a bicep bump rises on each upper arm (quadratic arc from 16% to 66% of the upper arm, peak 3.5 units above it at k = 1, filled); then a 0.72 s zoom (cubic ease-in-out, exponential scale) centered on the figure's head while a circular window matching the inside of the head ring reveals the app; the wordmark fades out in the first third of the zoom. Reduced motion: no flex or zoom, it fades out after 0.35 s.

### 3.1 Loading
Shown while storage opens. The line figure doing a dumbbell curl (LOADING pose), label "LOADING". Storage error: toast "Storage unavailable. This browser blocked local storage. Private mode can cause this."

### 3.2 Today
- **Deload suggestion** (top, §5.16; not while a workout is running or a deload is active): REST figure, "SUGGESTION", "TIME FOR A DELOAD?", the reason ("It's been 7 weeks since your last deload." or "…since your first logged workout." / "18 of your 30 exercises haven't gone up in 4 weeks."), the rule ("Half the sets, 10% lighter, stop every set with 3–4 reps left. Same days and exercises. Until Friday."), **Deload this week** (starts it; toast "Deload week on · Back to normal after Friday.") and **Not now**. Native app: this becomes a notification.
- **During a deload week:** cyan badge "Deload week · until Fri" under the day title; set counts (tiles and list) show the deload sets in cyan; Start workout creates a deload session.
- **Backup reminder** (top, only when there are finished workouts and the last backup is 14+ days old or never, and not snoozed): amber-edged glass row "You haven't backed up your workouts yet." / "Last backup n days ago.", **Back up** (downloads the backup file right away) and × (remind again in 7 days).
- **Header:** small static logo figure (arms up, biceps flexed, as in §6.7) + "BLUE FIT" in neon, today's date (e.g. "NOV 14").
- **Week strip:** 7 buttons Mon→Sun (always calendar order). Today's weekday is preselected. The selected day is a neon gradient pill; today's day (if not selected) is neon text. A green glowing dot marks days of the current training week (§4.6) with a finished workout for that routine day.
- **Training day card:** eyebrow "TODAY · MONDAY" (or just the weekday when previewing another day); day title huge in neon gradient (e.g. "BACK & BICEPS"); "✓ Done today" badge if a finished session today has this day. A large animated figure cycles through the day's exercises, one per animation loop (at that exercise's tempo), with the exercise name under it. Three stat tiles: exercises · sets · ~minutes (time estimate §5.8).
- **Exercises list:** number, small static figure, name, ★ if heavy, the slot note (or primary muscles), "sets × reps". Tap opens the exercise detail sheet. Press and hold (~0.3 s; drag with a mouse) to move an exercise up or down; the plan day saves the new order at once (as in the Plan tab).
- Only one workout runs at a time: Start is hidden while one is running and, if reached anyway, opens the running workout. (The Free workout button was removed on Nov 16 2026 at Leo's request; older free sessions still show and edit normally.)
- **Dock:** "▶ START WORKOUT" (pulsing glow) or "START WEDNESDAY" when previewing another day. Hidden when a workout is active (the dock then shows Resume).
- **Rest day state** (no day, or a day without exercises; Friday in the seed plan): REST figure sitting on a bench, breathing slowly; "REST DAY"; "Walk if you like, but keep it easy."; hint to pick a day above.

### 3.3 Workout logger
- **Sticky header** (solid surface, no backdrop blur so the text stays sharp on iPhone): "WORKOUT · m:ss" (elapsed, live), the session title, a **target** button (scrolls to the exercise you're on, just under the header; if it's already in view, its border flashes bright once), **Finish** button, a neon progress bar of done/total sets, and "n/N sets". While a rest timer runs, **Finish** is replaced by a round timer (48 px ring that empties, time inside, no box); tapping it opens the full timer right under the progress bar inside the header (ring with timer icon, "REST" and the time, −15, +15, **Skip** (ends the rest; Finish comes back); no ×: tap the ring again to close it). When the rest is over, Finish comes back. On the workout screen the rest timer dock above the tab bar is hidden (it still chimes at zero).
- **Exercise cards** in order. Coming back to the workout from another tab (or after a reload) jumps straight to the exercise you were on (remembered per workout; scrolled so the card's top sits 10 px under the sticky header, measured per phone; the same for the auto-scroll to the next exercise); if none is remembered, to the first exercise already started but not finished, else the first with a set left. The current exercise (focus) has a neon border and glow and an animated figure; others are slightly dimmed when complete and show a still figure. Every card's figure is the same size (88 px scale, focused or not) and trimmed to its drawing (the empty space around the whole movement is cropped, `figureBox`), so all figures line up at the top right (14 px in from the card's padding, clear of the swipe handle), leaving room on the left. Tapping the card header (number, name or figure; not the handle) opens the exercise page in a sheet.
  - Number badge (neon when focused, green ✓ when all sets done). When all sets are done the whole card gets a green outline with a soft green glow (slightly dimmed when not focused).
  - Name (tap → exercise detail sheet) with ★ if heavy; "sets × rep range · rest 2 min"; "swapped from X" if swapped.
  - Note (if any).
  - **Last:** "Last: 170 × 10, 10, 9" from the most recent finished session with this exercise (§5.6).
  - In a deload session: header eyebrow starts with "Deload ·", and instead of the progression hint a cyan note "Deload: weights are 10% lighter. Stop every set with 3–4 reps left."
  - **Progression hint** (§5.5) with a **Use** button that writes the suggested weight and reps into the sets not yet done.
  - **Set rows:** type button (number for working sets, W warm-up, D drop, F failure; tap cycles working → warm-up → drop → failure), "weight /side × reps", and a done toggle (green glow when done; tap again to undo).
  - The **selected set** (the first not-done set; sets open in order, so a later set can't be expanded until the earlier ones are done and shows dimmed; done sets can still be tapped) expands: Weight stepper (step = exercise increment; label shows "lb", "lb per side" or "lb per hand"), Reps stepper (step 1; first tap on an empty value jumps to the rep minimum), plates to load for per-side and single-sleeve lifts (§5.9), labeled "Plates per side" (or "Plates" for a single sleeve), as compact pills on one line, a small plate circle with its weight and the count ("(45) × 3  (35) × 1"; picked Nov 18 2026 over a sleeve drawing and big round plates), big **✓ DONE · SET n**, and "Remove this set". A set can only be marked done with reps and a weight (weight not needed for bodyweight exercises); otherwise the tapped button (✓ or Done, only that one) shakes left-right (0.36 s), the set opens, and the missing Weight/Reps field turns error red (border, glow and label) until it's filled. No toast.
  - "+ Add set" (copies the last set's weight and reps).
  - Superset groups: consecutive entries with the same group letter get a cyan glowing bracket on the left and a "SUPERSET A" label.
- **Reorder:** press and hold an exercise's name (~0.3 s; drag with a mouse) and drag the card up or down. While dragging, every card shrinks to its name row. The new order is saved to the workout and to the plan day too (exercises not in the workout keep their places; supersets regroup as in the editor). An app-picked failure set that is not done yet moves to whichever exercise is now last for its muscle, unless that one is not safe to fail or was turned off in Edit plan, then it is dropped; failure you turned on stays put.
- **Card actions (swipe left)** (Nov 18 2026, replaces the ⋯ menu so the header keeps its width): swipe a card left (or tap the thin handle on the header's right edge) and the header slides out to the left while an action bar slides in from the right in its place (from the card's top to just under the header, edge to edge), both clipped to the card's edges, flat (no shadow between them); it stays until swiped back right. Six actions in one row: **Swap** (for this workout) · **Superset** / **Unlink** (with the next exercise; off on the last one) · **Note** / **Edit note** · **Warm-up** (adds a warm-up set at the top, after any warm-ups already there, empty: it's lighter than the working weight) · **How to** · **Remove** (red; confirm). One card open at a time. It stays open, also after using an action (e.g. How to: closing that sheet brings you back to the open bar), until swiped back right, the handle is tapped again, or another card is opened. After 6 px a touch move locks to whichever direction is larger: sideways is the swipe, otherwise the page scrolls (the card only lets the browser pan vertically, so a sideways move is never lost to it); a quick flick (over 0.35 px/ms) opens or closes by its direction, a slow drag by whether it got past halfway. Press-and-hold still reorders. First time after the change, the bar on the current card slides in a little and back once (none with reduced motion).
- **+ Add exercise** opens the exercise picker (§3.9).
- **Marking a set done:** saves immediately; later empty sets of the same type copy its weight/reps; light haptic where supported; PR check (§5.4) shows a pink "NEW PR!" toast with a flexing figure and sparks; the rest timer starts (§5.7) if auto-start is on; focus moves to the next exercise when this one is finished (smooth scroll).
- **Notes** (exercise and workout): a card floating in the middle of the visible screen (above the keyboard), all corners rounded: title, text box, **Save**. Tap outside to close (a change is saved).
- **Finish sheet:** "FINISH WORKOUT?" with a **notes** button on the right (neon when notes exist; opens Workout notes, and closing them returns to this sheet), "x of y sets done · n min. k sets not done will be dropped.", **Finish**, Keep going, Discard workout (confirm: "Everything logged in it is deleted. This can't be undone."). Finishing with no done sets goes to the discard confirmation.
- **Empty states:** no active workout → LOADING figure, "No workout running", button to Today. A workout with no exercises → "Add your first exercise."
- Screen stays on while the logger is open (setting, §3.8).
- **Resume:** the active session lives in storage; closing the app and reopening restores it exactly.

### 3.4 Workout summary
- Fresh finish (within 10 min): big FLEX figure flexing, date, "WORKOUT COMPLETE" in neon gradient, the workout title. Past workout: back button and the title instead. Deload workouts add "· Deload" to the date line.
- **Sets per muscle** (finish screen and past workouts): working sets left undone (stored on the workout as `skipped`, per exercise, when it is finished; weighted like weekly volume) show as a dark red part (#721d1d, solid, no glow; Leo's pick) joined to the blue done part in one bar, rounded only at its outer ends, with a small dark red swatch and "= sets skipped" under the bars. Muscles that were only skipped appear with 0. Workouts finished from Nov 16 2026 before this existed get `skipped` worked out once from their plan day (planned working sets, halved on deload, minus done; migration `2026-11-17-backfill-skipped`). Free workouts and imports have none. **Edit workout** changes only that day's recorded workout (never the plan); skipped sets follow what's recorded: for each planned exercise, skipped = the plan day's working sets (halved on deload) − recorded sets (with reps), never below 0, so adding a set shrinks the red and deleting one brings it back. Exercises outside the plan never get red. Migration `2026-11-17-drop-empty-done-sets` removes empty sets that an earlier version saved as done and works out skipped again.
- Three tiles counting up from zero: minutes, sets (non-warm-up done sets), volume lb (tonnage §5.3).
- **Personal records** (pink section) per exercise with the PR kinds.
- **Sets per muscle** this session (fractional, §5.2) as neon bars.
- **Exercises** with sets line and notes (read only: tapping does nothing, it's a summary). Workout notes.
- **Done** (fresh) → Today. **Edit workout** → editor (§3.7.1). **Delete workout** (confirm).

### 3.5 Exercise detail
Large animated figure (200 px; its movement always follows the written instructions, e.g. no leaning back when the text says not to; corrections live in `seed/figure-fixes.json`; e.g. the lean-away lateral raise is a cable exercise (low pulley at the post, migration `2026-11-17-lean-away-cable`) and starts with the hand across the body; the cable lateral raise holds the machine with the free hand, leans away with both feet together on the floor and starts with the hand across the body for the stretch), name, ★, primary muscle badges (neon), secondary badges (outline), ★ key lift badge, "why" text (★ lifts add a small line under it: "★ Key lift: heavy lift."), sections Setup, Form, Tips (cyan heading), Avoid (red heading); **info tiles** (rounded tiles, each with a neon icon chip and a small label): Range (↕, full width: "start → end"), Tempo (metronome: the phases in the order the lifter does them, e.g. "Down 3s → Hold 2s → Up 1s") and Rest (timer) side by side (when the tempo has a Hold: Rest takes only the room it needs, the tempo text is 12 px and the Tempo icon shows whenever it fits (hidden only on narrow screens for the longest tempos) so it stays on one line), Equipment (dumbbell, full width: e.g. "Smith machine · log one side, no bar"; "log one hand"; single sleeve "log the plates on it"), Works (stick figure, full width: muscle chips, direct in neon, indirect with "½"). **Your records:** Heaviest, Best est. 1RM, Best volume, Last time; or "No sets logged yet." With history: **Progress** (the exercise progress chart, §3.13) and **History · n** (up to 40 most recent sessions: date, sets line with /side or /hand, session volume; tap → summary). A slot can override "why" and "tips" (used for the leg-day cable lateral raise).

### 3.6 Plan
Header: "CURRENT PLAN" and **Plans** (ghost). There is no Edit mode: the current plan is always editable in place, looks the same as a read-only view, and every change saves at once (Nov 18 2026). Routine name in neon gradient: tap it to type (it is a see-through field over the drawn text; Enter or leaving saves; empty keeps the old name). "6 days · 36 exercises · 117 sets a week", day chips (Mon→Sun), the selected day's title (tap to type, same way) with "sets · ~min" and its slots (figure, name, ★, "Superset A ·" when grouped, note, rest, sets × reps, chevron; no drag handle). **Tap** a slot → **slot sheet** (same as the editor's: Sets, Rest, Reps min/max, Last set to failure Auto/On/Off, Note, Superset with next / Unlink, Swap exercise, How to do it, Remove from day, Done). **Press and hold** (~0.3 s; drag with a mouse) to move it up or down (the drag code loads only when the Plan tab opens). **Swipe left**: a short swipe leaves a red Delete button, a long swipe or fast flick deletes at once; tapping the row closes it. Removing an exercise shows a toast "Exercise removed" with **Undo** (5 s). **+ Add exercise** is the last row (exercise picker). Under the list, on the right: **Delete day** (no hint text) (confirm; the day becomes a rest day and leaves the chips). **Your week** (§5.21): facts, the muscle map with a list per side, and the Week check; the muscle card has **Change target**: min/max sets and Priority · Normal · Skip open flat inside the card, with no box of their own and no hint line, saved at once for every plan. Below that: horizontally scrolling rule cards (Effort, Progression, ★ Key lift) from routine data, then the deload card. **Plans** sheet: Make current, Edit (other plans only; opens the editor screen below), Duplicate, Delete.
**Deload card** (at the bottom, under the rule cards): "DELOAD WEEK" + the rule and **Start** (confirm: rule + "It lasts until Friday, then your normal plan comes back."); while active: "DELOAD WEEK · UNTIL FRI" (cyan) and **End** (ends it early; toast "Deload ended").
**Plans sheet:** every routine (current first, then newest): name, "n days · n sets/week", "Current" badge; actions Make current, Edit, Duplicate (named "X copy", "X copy 2" …), Delete (not for the current one; confirm: "Workouts you did with it stay in history." when used).

#### 3.6.1 Plan editor
Edits a **draft copy** of the routine; nothing changes until Save. The draft survives a reload during the session. It uses the **same layout as the Plan tab** (no page animation when opened from it), with the changeable parts turned into fields, so editing feels like the same screen.
- Top: "EDITING PLAN" (cyan) where "CURRENT PLAN" was; **Cancel** (asks "Discard changes?" when there are changes) and **✓ Done / Save** where Plans and Edit were.
- Plan name: the big neon title as a field (dashed underline); the "days · exercises · sets" line under it.
- Day chips as in the view (weekday, or the day name when it has none; days without a weekday come last), including rest days. No way to add or remove days: a plan keeps its days.
- Day title as a field (dashed underline) with "n sets · ~min" beside it.
- Exercise rows look like the view's rows (number, figure, name ★, note · rest, sets × reps, chevron) with a drag handle (6 dots) in front; drag to reorder (keyboard supported). Superset groups show the cyan bracket and "Superset A" in the first row. **+ Add exercise** is the last row of the list. Under it: "Tap an exercise to change it. Drag ⋮⋮ to move it." and **Delete day** (removes all the day's exercises; the day stays as a rest day with its name and weekday; confirm: "All its exercises are removed and it becomes a rest day. Past workouts stay in history."; disabled on an empty day). Then **Your week** (facts, tiles, Week check) as in the view, live with the draft, above Weekly targets. Tap a row → **slot sheet**: Sets (1–20), Rest (step 15 s), Reps min, Reps max (max never below min), Note; Superset with next / Unlink; Swap exercise; How to do it; Remove from day; Done.
- Empty day: "No exercises. A day without exercises is a rest day." **+ Add exercise** → picker (§3.9); new slots are 3 × 10–12 with the exercise's rest (or the default rest).
- **Weekly targets** table (§3.10) recalculated on every change, listing every muscle group. Hint: "Tap a muscle to change its weekly target, make it a priority or skip it." Tapping a row opens an inline panel: Min sets and Max sets steppers, no hint line (max empty = no upper limit; raising min above max raises max), a **Priority · Normal · Skip** control (priority aims for the top half of the range and the muscle name is bold; Skip is grayed, striped, no warnings, numbers kept; leaving Skip gives a group with no minimum one equal to its planned sets). Below the table, without a complete profile: "Fill in Settings → Training profile to get targets worked out for you." Save reads **Done** (and just leaves) while nothing has changed. **Reset targets to defaults** (confirm) sets every muscle to the model's range with default priorities and no "Skip" (or, without a complete profile, to the plan's original numbers); angle and gap notes are kept. Target edits apply to every plan and are saved with Save plan; Cancel discards them.
- Dock: **Save plan** (reads **Done** while nothing has changed).
- Save checks (§5.15); the first problem shows as an error toast. Saved → "Plan saved" toast, back to Plan.

### 3.7 History
- **Streak card:** tap the streak (flame, number, label) to **freeze** it: from that day until tapped again, weeks that aren't complete hold the streak (don't break it, don't add); complete weeks still add 1. Frozen look: ice flame (light cyan → blue → deep blue, frost at the bottom, 3 tiny snowflakes drifting down above it, each on its own rhythm), number and "FROZEN" label in ice blue (no toast). Tapping on the day it was frozen undoes it. Stored as `settings.streakFreezes` [{start, end|null}]. Otherwise: flame that fills from the bottom as this week's planned days are logged (yellow bottom → orange middle → red top; outline faint when empty, orange while filling, red when full; orange glow and gentle flicker once a day is logged; the same white sparks once the week is complete), current streak in weeks, "STREAK"; "This week n/6 days" with one pill per planned day (Mon→Sun order) lit in neon when that routine day is logged this week; "Week complete. Streak +1." or "Log all 6 days to keep/start the streak."; best streak.
- **Calendar:** month view, always Monday first, 5 or 6 rows; ‹ › month buttons (no months after the current one); month name and "n workouts". Days with workouts are shaded neon→cyan by working sets that day (intensity `0.25 + 0.75 × sets / max(12, most sets in any day)`), bright days glow; today has a cyan ring; days of other months are dimmed. Tap a day with one workout → its summary; with several → a list under the calendar. Legend "Fewer sets ▢▢▢▢ More".
- **List:** finished workouts grouped by week (weeks newest first; inside a week oldest at the top, most recent at the bottom) (deload workouts show "· Deload" after the title) ("This week", "Week of Nov 9") with count; each row: weekday + day number, title, "min · sets · volume lb" → summary.
- Empty: the splash flex on a loop (SPLASH_FLEX: flex up 0.42 s, hold 0.9 s, relax 0.52 s, rest 0.6 s, repeat; runs only while on screen; still flexed with reduced motion; no zoom), "No workouts yet. Finish one and it shows up here."

#### 3.7.1 Edit workout
Back at the top and a big **Done** at the bottom, under the workout notes (both return to the summary, replacing the editor in navigation history). The workout title is shown read-only (title and minutes can't be edited). Field: Date (date picker, not after today; moving the date moves start and finish times by the same days). The cards follow the plan day's order and show the **whole day**: a planned exercise that wasn't recorded shows as a dimmed dashed card "Not recorded · plan 3 × 10" with **+ Add** (adds the planned number of sets, empty; a set counts as recorded once it has reps, clearing reps un-records it; on Done/back, empty sets are dropped and an exercise left with none shows "Not recorded" again). Exercises added outside the plan (during the workout) come after. A plan workout has no **+ Add exercise** here (only the plan day's exercises can be recorded); free workouts keep it. One card per recorded exercise: figure, name, ★, ⋯ menu (Change exercise: keeps the sets; Add/Edit note; Exercise details; Remove exercise with confirm); a grid of sets: type button (cycles like the logger), weight field, ×, reps field, delete. "+ Add set" adds a done set copying the last one. "+ Add exercise" adds an exercise with one done set pre-filled from its history. Workout notes. Every change saves immediately; on Done, exercises left with no sets are removed.

### 3.8 Settings
Sections in this order:
- **Training week starts on:** 7 chips Mon…Sun (default Sat). Only drives the numbers: streak, "this week", history grouping by week, weekly charts and ranges. Every screen still shows days Mon→Sun (week strip, calendar, plan, streak pills).
- **Training profile** (Interview): Goal (Mass · Strength · Endurance · Maintain), Eating (Cutting · Maintaining · Bulking), Age, Years lifting, Sleep a night (h). Note: "Used to work out your weekly set targets (Edit plan → Reset targets). Stays on this phone." The volume model uses it once age, years and sleep are filled in (§5.17).
- **Workout:** Default rest stepper (step 15 s; shows "2 min") + "Apply to every exercise in the plan" (confirm); Start rest timer when a set is done (switch); Sound when rest is over (switch); Keep screen on during a workout (switch).
- **Reminders & tips:** switches (each with a one-line explanation), on by default: **Deload suggestions** (the Today card, §5.16) and **Beat last time** (the progression target in the logger). Off hides them; nothing else changes. More switches will be added here.
- **Look:** Theme segmented control: System · Dark · Light. Accent: five round swatches (Blue default, Pink, Orange, Green, Brown); the choice is saved and applied before the splash paints.
- **Data:** "Last backup: today / yesterday / n days ago / never" (amber when 14+ days or never). Export (downloads `blue-fit-backup-YYYY-MM-DD.json`), Copy JSON (clipboard); both record the backup time. Import file, Paste JSON. Imports are validated (§7.3); a valid file shows a confirmation with its date and counts, then replaces all data. **Reset everything** (confirm) restores the seed.
- **App:** Update app (when a new version is waiting), otherwise Check for updates (toast "You're up to date" or "Update found"). The app also checks on launch, each time it returns to the foreground, and every 30 minutes while open, install instructions when not installed ("Share → Add to Home Screen"), version.

### 3.9 Exercise picker (sheet)
Title (Swap exercise / Add exercise), **+ New exercise** (opens the exercise editor; the new exercise is picked right away), search (name, aliases, muscles), muscle-group filter chips, equipment filter chips; list with figure, name, ★, muscles · equipment. With a muscle filter, exercises with direct work for that muscle come first. Swap hides the current exercise. Hidden (archived) exercises never show.

### 3.9.1 Exercise editor (sheet)
Opened from the picker (new) or the exercise page's **Edit** button, which shows only for custom exercises (built-in exercises are system content and can't be edited). Cancel · title · Save. Live figure preview. Fields: Name (required, unique ignoring case); Figure (None or any existing exercise's figure, as tiles); Muscles (a chip per muscle group; tap cycles off → direct ×1 → indirect ×½); Equipment (picking it sets the default log mode: barbell/Smith/plate machine → per side, dumbbell → per hand, others → as shown); Key lift ★; Log weight (As shown / Per side / Per hand); Weight step (lb); Rest; Why; Setup, Form, Tips, Avoid (one item per line); Range; Tempo (default "1–2 s up, 2–3 s down"); Other names (comma separated, used by the Jefit import). Custom exercises derive their muscle text and body region from the muscle chips; built-in ones keep their written muscle text. Delete (custom only): **Hide** when the exercise is in history or any plan (archived, still shown where used), otherwise **Delete** for good.

### 3.10 Volume table (component)
One row per muscle group (§4.2), always all of them: name (priority muscles bold), value / target, status (✓, ⚠ above, ⚠ below, or "in progress"), a neon bar with a dashed target band (the weekly goal range), and a detail line (days · angles · gap). In the live "This week" table, a muscle under its target shows "in progress" (muted, normal bar) while a planned day left in this training week (today included until today's day is finished) still works it; only when none is left does it show ⚠ below. Muscles that aren't a focus (no target, or the plan accepts being below it, like hamstrings) are grayed out with a diagonal-striped bar, no target band and no status; detail line "skipped" plus the plan's reason. Footer: "Indirect sets count as half. Warm-ups and drop sets don't count."

### 3.11 Progress
Empty (no finished workouts): LOADING figure, "Finish a workout and your charts, muscle map and recovery show up here."
- **Range:** segmented 4 wk (default) · 12 wk · 6 mo · All (§5.14).
- **Tiles:** workouts in range, per week, volume lb.
- **Muscle map** (§8.6) with a toggle:
  - *This week:* each region's brightness = sets done so far this training week (any range) ÷ (target max, else target min, else 12), capped at 1; regions above 0.55 glow. Caption with nothing selected: "Brighter = closer to the top of the target." Tap a region: "Biceps · 6 sets this week · target 14–20".
  - *Recovery:* recovering = pink, partly recovered = amber, fresh = green (faint); legend. Tap: "Quads · Recovering · 6 sets yesterday", "Traps · Partly recovered · 4 sets 3 days ago · +1 day: age 40+", "Calves · Fresh · no hard day lately".
  - **Swipe** left/right on the caption under the map: selects the next/previous muscle, top to bottom (neck, traps, front delts, side delts, rear delts, chest, back, abs, biceps, triceps, forearms, glutes, quads, hamstrings, adductors, calves; wraps around); the caption slides in. Faint ‹ › on both sides of the caption (vertically centered, also tappable) hint at the swipe. The chart below doesn't change.
- **Weekly sets vs target:** muscle chips; bar chart of that muscle's sets per week with the target as a green band; then a toggle "This week | Average · range" for the volume table (§3.10). Default: This week; the last choice is remembered on the phone.
- **Weekly volume:** bar chart of tonnage per week (readout shows workouts that week).
- **Frequency (times a week):** muscles with direct work, highest first, bar scaled to 3×/week, value "2.3×".
- **Exercise progress:** exercise dropdown (exercises with logged sets, most recently trained first) + the exercise progress chart (§3.13), limited to the range.

### 3.13 Exercise progress chart (component)
Segmented Est. 1RM · Best set · Volume. Est. 1RM: line chart, one point per session, readout "160 lb · 120 × 10". Best set: line of the best set's weight (by e1RM), readout "× reps". Volume: bars of the session volume for the exercise, readout "n sets". "No sets logged (in this range) yet." when empty.

### 3.14 Charts (component)
Width-fitting SVG (320-unit wide coordinate space). Line: neon→cyan gradient stroke 2.4 with glow, area fill fading down, small dots (hidden above 24 points), the selected point larger and cyan; dashed grid at min/mid/max with mono labels; first and last labels on the x axis; draws itself in over 1.1 s. Bars: neon→cyan gradient, 62 % opacity except the selected or latest bar (full, glowing); grow from the bottom with an 18 ms stagger. Both: optional green target band; a readout line above ("Week of Nov 9 · 18 sets"); tap or drag to select a point (vertical guide line on line charts).

### 3.11.1 Crash recovery
If a screen fails, it's replaced (not the tab bar) by: REST figure, "SOMETHING WENT WRONG", "This screen hit an error. Your workouts are stored safely on this phone. Save a backup to be sure, then go back.", **Save a backup** (reads storage directly and downloads the backup file; shows "Backup downloaded." or the reason it failed), Go to Today, Reload the app, and the error message in small mono text. Navigating to another screen clears it.

### 3.12 Toasts
Top of screen, auto-dismiss (3.2 s; PR 4.2 s), tap or **swipe up** to dismiss (it follows the finger and fades; past 36 px or a quick flick it slides away, otherwise it springs back; pulling down barely moves it). Slides down into place (0.28 s, fade + 16 px) and slides all the way up off the screen when it closes (0.24 s, no fade); no bounce. Kinds: info (bolt icon), PR (pink border and glow, flexing blue figure with 10 sparks), error (red border).

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
| rangeOfMotion, tempo | string | rangeOfMotion as "start → end"; tempo as two phases in movement order, one number each: "Up 1 s · Down 3 s" (lifting 1 s, lowering 3 s) |
| defaultRestSec | int | 120 |
| incrementLb | number | stepper step and progression jump |
| figure | FigureSpec \| null | §8 |
| isCustom, archived | boolean | |

### 4.2 Muscle groups and the approved mapping
Groups: back, biceps, triceps, sideDelts, rearDelts, traps, frontDelts, chest, quads, hamstrings, adductors, calves, glutes, forearms, abs, neck (rotator cuff removed Nov 18 2026: not trained at the gym; migration `2026-11-18-no-rotator-cuff` drops it from exercises and targets, and older backups import without it; abs and neck added Nov 17 2026; their targets start on Skip, migration `2026-11-17-abs-neck`; volume model: 2 functions each, recover in 2 days, *judgment*). Priority (bold): back, biceps, triceps, side delts, rear delts, traps.

| Exercise | Direct (1) | Indirect (0.5) | Equipment / load | Increment |
|---|---|---|---|---|
| T-Bar Reverse Row ★ | back | rear delts, biceps | plate machine / single sleeve (whole weight) | 2.5 |
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
| Rope Face Pull | rear delts | traps, back | cable | 5 |
| Lean-away Lateral Raise | side delts | — | cable | 5 |
| Lean-in Lateral Raise (not in the plan; added Nov 18 2026, `seed/extra-exercises.json`, migration `2026-11-18-lean-in-lateral-raise`): lean toward the machine, start with the hand across the body (stretch), top of the raise hardest; migration `2026-11-18-lean-in-across` updates copies stored before that | side delts | — | cable | 5 |
| All-the-way-up Lateral Raise | side delts | traps | dumbbell / per hand | 5 |
| Kelso Shrug | traps | — | T-bar row machine (one sleeve, log the plates on it) | 5 |
| Single-arm Cable Reverse Fly | rear delts | — | cable | 5 |
| Rope Overhead Tricep Extension | triceps | — | cable | 5 |
| DB Hammer Curl ★ | biceps, forearms | — | dumbbell / per hand | 5 |
| Leg Press ★ | quads | adductors, glutes | plate machine / per side | 5 |
| Seated Leg Curl | hamstrings | — | machine | 10 |
| Seated Calf Raise | calves | — | machine | 10 |
| Cable One-Arm Tricep Kickback | triceps | — | cable | 5 |

With the seed plan this gives exactly: back 20, biceps 16.5, triceps 18, side delts 15.5, rear delts 14.5, traps 15.5, front delts 6, chest 2, quads 13, hamstrings 8, adductors 10.5, calves 8, glutes 3.5, forearms 3.

### 4.3 Routine
`Routine { id, name, isCurrent, createdAt, rules?: {title, text}[], days: RoutineDay[] }`
`RoutineDay { id, weekday: 0–6 | null (0 = Sunday), title, slots: Slot[] }` (order = array order)
`Slot { id, exerciseId, sets, repMin, repMax, restSec, supersetGroup?, notes?, whyOverride?, tipsOverride?, toFailure?: boolean (Auto = unset) }`
Exactly one routine has `isCurrent = true`. Seed: "Leo v3.1" (Sat Back & Biceps, Sun Shoulders & Traps, Mon Legs A, Tue Back & Triceps, Wed Shoulders, Traps & Arms, Thu Legs B, Fri Rest), all rests 120 s. Day ids keep their original names (mon … sun) so history stays linked.

### 4.4 Volume target
`VolumeTarget { group, min: number | null, max: number | null, angles?, gap?, note?, off?, priority?, acceptedBelow? }` (`priority` unset = app default: back, biceps, triceps, side delts, rear delts, traps) (`off` = Skip; `acceptedBelow` is the older flag and means the same). Seed: back 14–22, biceps 14–20, triceps 14–22, side delts 14–20, rear delts 14–20, traps 12–20, front delts 6–8, quads 10+, hamstrings 8–10 (2 leg curls × 4 sets; changed from "10+, below by choice" on Nov 16 2026 by a one-time migration)"), adductors 10+, calves 8+; chest (note "0 by plan"), glutes, forearms have no target ("tracked only").

### 4.5 Session (logged workout)
`Session { id, date, title, routineId?, dayId?, startedAt, finishedAt?, status: active | finished, notes?, source: app | jefit, importKey?, deload?: boolean, entries: SessionEntry[] }`
`SessionEntry { id, exerciseId, swappedFromId?, slotId?, supersetGroup?, restSec, repMin?, repMax?, notes?, toFailure?, failWhy?: string[], sets: LoggedSet[] }`
`LoggedSet { id, type: warmup | working | drop | failure, weight: number | null, reps: int | null, done: boolean, rir?: number | null, completedAt?: timestamp | null }`
At most one session is `active`. Duration = finishedAt − startedAt (minutes, rounded).

### 4.6 Settings
`{ units: "lb", restDefaultSec: 120, autoStartRest: true, sound: true, keepAwake: true, deloadSuggestions: true, progressionHints: true (backups without them import as on), theme: system | light | dark, profile?: { goal: growth | strength | endurance | maintenance, phase: cutting | maintaining | bulking, age, yearsTraining, sleepHours (numbers may be null while filling in) } | null, accent: blue | pink | orange | green | brown (default blue; backups without it import as blue), weekStartDay: 0–6 (0 = Sunday; default 6 = Saturday; backups without it import as 1 = Monday), plates: [{weight, pairs}], deload?: {start, end} | null (current or last deload week, inclusive dates), deloadDismissedAt?: date | null ("Not now") }`. Default plates (pairs): 45×8, 35×2, 25×4, 10×4, 5×4, 2.5×2.

### 4.7 Other records
- `JefitAlias { jefitName, exerciseId | null }` (null = skip). Seeded from every exercise's aliases.
- `RestTimer { endsAt (epoch ms), durationSec, sessionId, entryId }`: stored so it survives navigation and restarts.
- Personal records are **derived**, never stored (§5.4).

### 4.8 Later phases (designed, not built)
- **Deload notification (native app):** the deload suggestion (§5.16) becomes a notification. Previously planned as: the app suggests a deload week (whichever comes first: 6 weeks since the last deload or since the user started; or a 4-week stall of half or more of the plan's exercises, §5.16) and the user decides: "Deload this week" or "Not now". Web version: a banner on Today (web apps on iPhone can't notify without a server). **Native app: turn it into a notification.**
- `BodyEntry { id, date, weightLb?, bodyFatPct?, measurements: {chest?, hips?, upperWaist?, lowerWaist?, upperArmR?, upperArmL?, forearmR?, forearmL?, thighR?, thighL?} (inches), photoIds?: string[], source: manual | scan }`, with a bodyweight band setting (min/max).
- Routine versions and deload weeks: `Routine.basedOn?`, `Session.routineId` keeps history tied to the version used.

## 5. Business rules

### 5.1 Weights
Stored exactly as typed. Plate-loaded lifts with two sides (Smith Squat, Leg Press, Barbell Shrug): weight on **one side**, bar not included. T-Bar Row and Kelso Shrug (done on the T-bar row machine) have one sleeve (`singleSleeve`): the weight is all the plates on it, and the workout shows those plates (migrations Nov 16 and Nov 18 2026; earlier numbers mean the same load). Dumbbells: **per hand**. Fixed bars (EZ, preacher): the number on the bar (10 lb steps). Machines and cables: the stack number. There is no bar-weight setting. Volume (tonnage: workout, week, History rows, the "You lifted" object, an exercise's best volume) counts per-side and per-hand weights **twice** (both sides were lifted; Nov 18 2026); the bar is still not included.

### 5.2 Fractional volume (weekly sets)
For each done set whose type is **working or failure**: for each `{group, weight}` in the exercise's `volume`, add `weight` (1 or 0.5) to that group. Warm-ups and drop sets add nothing.
Plan volume: `Σ slot.sets × weight` over all slots of the routine. **Days** = number of routine days with at least one **direct** (weight 1) slot for that group.
Status vs target: no target, min null, `off` or `acceptedBelow` → skipped (off); max set and value > max → above; value ≥ min → ✓; else below, or in progress when a planned day left this training week still works the muscle (live week only).

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
- **Ready for more weight** (Nov 18 2026; the top alone can be a one-off) when every regular set (the failure set left out) at the top weight reached the top of the range (`reps ≥ repMax`) **and** either the workout before also did (two workouts in a row, not weeks) or the failure set beat the top by 2+ reps (`READY_MARGIN`); also when the failure set shows failure reps − 2 is already past the top. → "You reached {repMax} reps on every set last time. Go up to {next} × {repMin}." Next = heaviest + increment, rounded up to a multiple of 10 from 40 lb (Leo: round numbers). Thresholds are *judgment*.
- **Top reached once, not proven yet** → "Stay at {weight} × {repMax} once more." (plus "; your last set tests if you're ready for more" when today's failure pick is that test, §5.19).
- Otherwise → "Beat last time: {heaviest} × {reps}", where the target reps are last time's reps with +1 on the first set below `repMax`.
- **Use** applies weight and target reps to the working sets not done yet.

### 5.6 Pre-fill and carry-forward
New entries get the slot's set count (working sets) pre-filled per position from the last session's done working/failure sets (weight and reps; the last one repeats when there are more sets). No history → reps start at the low end of the plan's rep range (e.g. 10 for 10–12), weight empty. (Edit workout's **+ Add** still starts empty.) When a set is marked done, later not-done sets of the same type with empty weight/reps copy its values.

### 5.7 Rest timer and supersets
After a set is marked done (auto-start on, entry rest > 0): start a timer for the entry's rest seconds, unless the entry is in a superset and not the last of the group in this round. Superset order: after a set in group member *i*, go to the next member with sets left; rest only when the round wraps to the start of the group. The timer stores an absolute end time, shows a ring + m:ss, can be adjusted −15/+15 s (never below 1 s left) and skipped; tapping it opens a full-screen ring with the REST figure. At zero: three-tone chime (880, 1175, 1568 Hz, 0.16 s apart), vibration where supported, "GO!" in green, auto-clears after 6 s. Timers that ended more than 60 s before a restart are discarded.

### 5.8 Time estimate
`round((sets × 0.75 + (sets − 1) × 2 + exercises) / 5) × 5` minutes (45 s per set, 2 min rest between sets, 1 min setup per exercise). Seed plan: Mon 55, Tue 55, Wed 65, Thu 60, Fri 55, Sat 60.

### 5.9 Plate math
Input: the weight for one sleeve (per-side weight, or the whole weight for a single sleeve). Standard gym plates 45, 35, 25, 10, 5, 2.5 lb, as many as needed; greedy from the heaviest. Output: plates grouped with counts, and any remainder ("+1 lb can't be loaded with standard plates"). No plate setting (`settings.plates` is unused, kept for older backups).

### 5.10 Today's day
Today's weekday (local time) → the current routine's day with that weekday. Missing or empty day → rest day. The user can preview any weekday and start it.

### 5.11 Finishing
Finish drops sets not done and exercises left with no done sets, sets `status = finished` and `finishedAt`. A session with nothing done can only be discarded.

### 5.15 Plan editing rules
- Save is blocked when: the plan name is empty; a day name is empty; two days share a weekday; a slot has < 1 set; rep max < rep min.
- Setting a weekday used by another day swaps them; "None" frees it.
- Supersets: "Superset with next" links a slot with the following one (joining its group if it has one); unlinking splits the group after the slot. A group always has ≥ 2 adjacent slots: moving a slot away from its group removes it from the group, and a group left with one slot dissolves.
- Swapping a slot's exercise drops that slot's day-specific why/tips.
- Duplicate copies days and slots with new ids; the copy is not current. Make current sets exactly one routine current. Workouts keep the routine and day ids they were logged with; Today and streaks use the current routine.

### 5.17 Volume model (Interview phase, approved Nov 16 2026)
Framework-free `core/volumeModel.ts`. Full reasoning and sources: `docs/plans/volume-targets.md` §6. Fractional weekly sets.
- Per muscle: functions (1–3) and recovery days (2, 2.5 or 3). Sets one session can use: 6 / 8 / 10 by functions. Sessions per week = min(3, 7 ÷ recovery days).
- Mass: min = max(6, 4 × functions); max = sessions × session sets. Strength: same min, max × 0.6. Endurance: recovery ½ day shorter. Maintenance: ⅓ of mass.
- Priority: min moves to the middle of the range. Skip: maintenance range.
- Profile scales the max: < 1 year ×0.75 (min too), ≥ 3 years ×1.1, age 40–59 ×0.92, 60+ ×0.85 (maintenance min ×1.5), sleep 6–7 h ×0.92, < 6 h ×0.8, cutting ×0.85, bulking ×1.1 (cutting/bulking not applied to maintenance).
- Rounded; max ≥ min + 2. Each result carries "why" lines shown in the editor.

### 5.18 Exercise texts (Nov 16 2026)
How-to texts are plain and as short as possible for the phone screen, without leaving out anything important (no item repeats another section; empty sections are hidden), for reading mid-set: everyday words, no jargon, nothing tied to Leo's personal plan (that stays in plan slot notes). They live in `core/seed/exercise-text.json`, applied over the extracted seed by `buildSeed` (so `npm run seed` keeps them). Tempo: one number per phase (lifting 1 s, lowering 3 s, from the plan's 1–2 s up / 2–3 s down), phases in the order the lifter does them (squats, leg press, calf raises, the incline EZ extension start with Down; pulldowns, pushdowns and machine dips start with Down as the effort; rows and curls start with Up). Research found no reason for different tempos per exercise (0.5–8 s reps grow muscle about the same, Schoenfeld 2015), so all use 1 s / 3 s. Holds: calf raises "Hold 2 s" at the bottom (stops the Achilles tendon bouncing you up; common coaching advice); shrugs, Kelso shrug, face pull and leg curls "Hold 1 s" squeeze at the top (Leo's choice; coaching habit, not research). Every exercise whose text says to squeeze or pause 1 second has that "Hold 1 s" in its tempo (Nov 17 text review: T-bar row, leg extension, hip adduction, seated row, overhead trap, cable kickback after the first move; single-arm pulldown at the end, "Down 1 s · Up 3 s · Hold 1 s", the stretch). The plain texts keep the plan's stretch cues, setup details and angles (e.g. "shoulder blades spread", knee lined up with the pivot, Smith squat no deeper than level, bench angles); migration `2026-11-17-text-review` updates fields still showing the pre-review text (`seed/text-review-was.json`). Migration `2026-11-17-short-texts` swaps in the shortened texts where a field still reads as before (`seed/text-short-was.json`). Migration `2026-11-16-tempo-holds` updates stored exercises still showing the earlier app tempo. A one-time migration updates the stored built-in exercises whose texts were never edited (checked by a fingerprint of the original texts).

The plan's "★ Key lift" rule card (was "★ Heavy"; renamed by the seed and migration `2026-11-16-key-lift-title`) reads: "★ Key lifts: heavy lifts. Add weight whenever you can." (migration `2026-11-17-key-lift-text-3`). DB Hammer Curl has no ★ (not a heavy lift; migration `2026-11-17-hammer-curl-not-heavy`, built-in exercise only). It says only what ★ means. In the app ★ means: the extra recovery day after a ★ failure set (§5.13); it no longer affects failure picks (§5.19). Since Nov 17 2026 the deload stall check uses every exercise, not just ★ lifts. (`core/seed/rule-text.ts`, applied by the seed and by a one-time migration when the card still shows an earlier app text.)

### 5.19 Last set to failure (strategic; mass gain and endurance, Nov 16 2026)
Every set still stops a couple of reps short of failure (Effort rule card wording since Nov 18 2026: "Stop every set a couple of reps short of failure."; migration `2026-11-18-effort-card-couple`). On top of that, for the **mass gain** and **endurance** goals (or no profile yet), the app picks per workout which exercises take their **last working set to failure** (`core/failure.ts` `planFailure`). Research: growth rises as sets end closer to failure (Robinson 2024); true failure adds little over stopping just short and costs more fatigue (Refalo 2023); failure needs about 24–48 h more recovery (Morán-Navarro 2017). Plan: `docs/plans/failure-strategy.md`.
- **None:** strength and maintain goals, a deload week, beginners (< 1 year lifting; manual "On" still applies).
- **Eligible** (Nov 17 2026: a failed rep must be harmless; ★ doesn't matter): machine, plate-loaded machine, cable, Smith machine (safety stops assumed set) and bodyweight moves; free weights (barbell, dumbbell, fixed bar, other) only for isolation moves (exercise `compound` flag, from the library; if unknown on an older custom exercise, only a one-muscle or arm-only move counts). Never the EZ-bar incline extension (over the face) or the single-arm DB row. Basis: coaches keep heavy free-weight compounds 1–2 reps short and use failure on machines, cables and isolation work (expert consensus, no injury study).
- **Budget per workout** (*judgment*): 3 failure sets; 2 with one of cutting / sleep < 6 h / age 40+; 1 with two or more. Manual "On" exercises use it up first.
- **Picks** (by the exercise's main muscle = first direct group): only the **last exercise for that muscle** in the workout; skipped if the muscle's projected weekly sets (logged this training week + still planned from today) are **above its max**; skipped if the plan trains that muscle directly again **within 2 days**, or it was trained directly **the day before** (*judgment*: normal sets are mostly recovered by 48 h; past days use what was actually logged, so a skipped workout or a skipped exercise doesn't count; days still ahead use the plan). Then best first: priority muscles (target flag or the default bold muscles; Skip muscles last) → muscles below their weekly min → later in the workout.
- **Reasons**, short (e.g. "Last biceps exercise", "Priority muscle", "Below weekly target", "4 days rest after" or "Not trained again this week", plus "Max 2 today (cutting)" when the budget is smaller; at most 5). In the logger cue they hide behind a **Why?** link and open as bullets in two columns. Sets you turned on yourself (Edit plan → On) show no Why?. Shown on the exercise page opened from Today, the Plan tab, the logger or Edit plan ("🔥 last set to failure" badge next to "★ key lift", reasons under it, led by "Why to failure?" in the flame color); also in the logger cue and the Edit plan exercise sheet. The flame next to a name is not tappable on its own (same as ★).
- **User control:** Edit plan → exercise sheet → **Last set to failure: Auto / On / Off** (stored as `slot.toFailure` true/false; Auto = unset). Manual always wins.
- **Timing:** previews (Today, Plan tab, Edit plan) are worked out for this training week's date of each day. **Start workout** stores the picks on the session entries (`entry.toFailure`, `entry.failWhy`), so they never change mid-workout or later; a finished day this week shows what was stored. After a workout is saved, the remaining days recompute from what was actually logged. Swapping a picked exercise to one that isn't eligible drops its flame.
- Replaces the old fixed per-exercise defaults (`failureLastSet`); one-time migration `2026-11-16-failure-strategic` removes them and keeps users' slot choices.
- Shown: amber flame next to the name on Today, the Plan tab and Edit plan; in the logger a small "failure" tag on the last working set, which, while open and not done, has an amber outline that flickers softly like a flame (glow and shade shift unevenly over 3 s; reduced motion: a still amber glow), and when that set is open a cue "Last set: go to failure. Keep going until you can't do another clean rep." with the reasons below.
- **Extra set for skipped work** (`core/failure.ts` `planExtraSets`, Nov 18 2026): when a focus muscle is behind this training week because planned sets or a whole day were skipped (plan's weekly sets minus logged + still-planned), the **first workout still ahead this week that trains it directly** gets one more set on its **last exercise for that muscle** (e.g. 3 → 4). Limits: never more than 4 sets on the exercise (`EXTRA_SET_MAX`), +1 only; the muscle stays at 10 direct sets or fewer that workout (`MAX_SESSION_SETS`); not if the muscle is trained hard (4+ direct sets) the next day; never above the weekly target's max; focus muscles only; never on a deload. Extra sets come before failure: the failure picker counts them, so a muscle they bring back to target doesn't also get failure. Basis: weekly sets drive growth fairly reliably (Pelland 2024); failure adds little and costs fatigue (Refalo 2023). Picking the last exercise is *judgment*. Shown on Today as a neon "+1" tag before the sets (which count one more), and in the workout under the name: "+1 set Biceps behind this week". Picked when the workout starts and stored on the entry (`extraSet`), so it never changes mid-workout.
- **Test for more weight** (Nov 18 2026): an exercise that reached the top of its rep range once, with no failure set last time to prove it (`needsTest`), takes its last set to failure in the next workout, reason "Testing if you're ready for more weight". Same safety and recovery rules as any failure pick (eligible exercise; not if the muscle is trained again within 2 days or was trained the day before), but not the "last exercise for this muscle" rule. Tests come first and count toward the day's limit; when the limit is full they replace the app's other picks, never the ones turned on in Edit plan. A test isn't moved to another exercise when the workout is reordered. Its result feeds the progression hint (§5.5): failure 2+ above the top → add weight.
- **Effort check** (`core/effort.ts`): once the failure set (the picked last set, or any set marked F) is done, earlier working sets at the same weight whose reps are more than 2 below it are flagged as stopped too early (where failure was, then what to do: "Failure at 14 reps. Go from 8 to 12 reps to stay a couple short of failure." — target = failure reps − 2; "… on set 1" / "on sets 1 and 2" when only some sets fell short (set numbers always in words, never "1–2", which reads like reps); "from 8 or 9" when they differ. If the target is past the top of the rep range: "Failure at 15 reps. The weight was too light: go heavier.", which matches the blue hint). Basis: lifters underestimate reps left, more so further from failure (Halperin 2022, Refalo 2023); the failure set is done tired, so the gap can only understate, never falsely flag. Too-hard sets aren't flagged (can't be told apart from fatigue). Shown in three places: a dashed amber note under the exercise's sets in the logger; a note in the summary's **Notes** (§ Workout notes); and next time on that exercise, above the progression hint ("Last time: failure at 14 reps. Go from 8 to 12 reps…", shown under the blue progression hint: what to lift today comes first). The blue "Beat last time" hint uses the same target for the sets the tip names (failure reps − 2, e.g. "100 × 12, 12, 14" instead of "9, 8, 14"), so the two never disagree; past the rep range the tip says to go heavier and the hint is unchanged until that exercise has its own failure result; its ✕ (top right) hides it for that exercise for the rest of the workout.


### Workout notes and "You lifted" (summary)
`core/notes.ts` `workoutNotes`, `core/lifted.ts` `liftedFor`; drawings in `ui/components/Lifted.tsx`.
- **You lifted …** card under the minutes / sets / volume tiles: the heaviest everyday object the workout's volume reaches and how many (one decimal under 10): fridge 250 lb, motorcycle 500, grand piano 1,000, car 3,500, pickup truck 5,000, school bus 25,000, semi truck (empty trailer) 35,000, jet airliner (empty) 90,000, tank 130,000, space shuttle 165,000 (typical weights, rounded). Volume doubles per-side and per-hand weights (§ weights; bar not included). Under the count, a dry one-liner per object (e.g. car "Parked it on your chest.", shuttle "Houston, we have a PR."). Objects, not animals (Leo, Nov 18 2026: animals read as made for children). Drawn in neon line art like the line man, lighter-blue details (windows, wheels' rims, keys) and some depth the line man doesn't have (shaded fill, highlight stroke, far parts dimmed, a ground shadow). It is lifted 4 px and set down again every 3.2 s, the shadow shrinking as it rises (still with reduced motion).
- **Notes** section near the bottom (before Edit / Delete), most important first, at most 6. The user's own workout note is now labeled "Your notes". Compared with the last finished non-deload workout that did the exercise; deload workouts get no weight notes. *Judgment* = coaching practice, not studies.
  1. **Time for a deload**: the deload stall rule (§ deload: half or more of the judged plan exercises stalled over 4 weeks) → "start a deload week".
  2. **Too heavy**: set 1 under the bottom of the rep range ("You got 10 reps at 210 on every set, but the plan says 12. Try 190 next time."; "on every set" when every regular set at that weight fell short, else "on set 1" / "on sets 1 and 2") → a lighter weight (est. 1RM by Epley, aiming at the bottom of the range with 2 reps left, rounded down to a round number: multiples of 10 from 40 lb up, else the exercise's step (Leo: no weights ending in 5); *judgment*).
  3. **Lighter**: top working weight below last time → "Go back to X next time, unless it was on purpose."
  4. **Not improving**: the exercise is stalled (same rule) → "Try a different rep range, or swap to another exercise for the same job" (*judgment*).
  5. **Go heavier**: every regular set (not the failure set) above the top of the range → the next weight (at least one step up; same Epley aim; rounded up to a round number).
  6. **Too easy**: the effort check.
  (No rest-time note: set times aren't reliable, a set is sometimes logged late, right before the next one; Leo, Nov 18 2026.)
  7. **Sets skipped**: count and per exercise.
  8. **Volume** vs the last time this plan day was done: "+8%" (green) / "−6%" / "about the same" (under 5%; *judgment*).
### 5.20 Exercise library and ★ heavy lifts (Nov 17 2026)
An internal library of the gym exercises the app knows (`core/library.ts`, data in `core/seed/library.json`, built by `scripts/build-library.mjs`); used later for manual and automatic plan building (not shown in the exercise picker yet). Plan and sources: `docs/plans/exercise-library.md`.
- **Sources:** free-exercise-db (public domain, pinned commit; strength/powerlifting exercises with gym equipment, minus banded/chained/speed/Olympic/strongman and odd variations); Jeff Nippard exercises missing from it, each with a source; and the few exercises only in Leo's plan. Each entry keeps its source. Abs and neck exercises are included (template: abs 1 / neck 1).
- **Muscles:** from a movement template that follows the plan's own conventions (e.g. row = back 1, rear delts ½, biceps ½; squat = quads 1, glutes ½, adductors ½; overhead press = front delts 1, side delts ½, triceps ½). Every plan exercise maps to a library entry with the same muscles (`planIds`).
- **★ heavy lift** when all three hold: (1) multi-joint (hip hinges and hip thrusts count); (2) big muscles drive it (legs, back, chest) or an overhead press; (3) safe to load heavy — not a free weight over the face, not bodyweight-only (pull-ups, chin-ups and dips count: commonly loaded with a belt), not a free-weight single-leg/balance-limited lift. Plus, by Leo's choice, **every shrug and calf raise** (very heavy loads in a short range). Basis: coaches' main-lift vs accessory split; Strength Level load standards (e.g. DB hammer curl 0.30× bodyweight, barbell shrug 1.50×, machine calf raise 1.75×). Checked by an independent second pass; disagreements went to Leo. Applied to Leo's plan (migration `2026-11-17-library-heavy`): Standing and Seated Calf Raise, Kelso Shrug, Single-arm Cable Lat Pulldown and Single-arm DB Row are now ★ (★ no longer affects failure, §5.19).

### 5.16 Deload weeks (agreed with Leo, Nov 16 2026)
- **Content:** same days and exercises; each exercise gets half its sets rounded up (4→2, 3→2, 1→1); pre-filled weights are 10% lighter, rounded to the nearest weight step of the exercise (never below one step); every set stops with 3–4 reps left (shown as a reminder). No progression hint during a deload.
- **Window:** the current training week (§4.6), e.g. Sat–Fri; afterwards the normal plan is back automatically. "End" ends it early (ended yesterday; removed if it started today).
- **History:** sessions logged during it are marked `deload`. They count normally for history, streak, volume and charts, but are skipped for pre-fill, "Last", progression hints and stall checks.
- **Suggestion** (user decides; never automatic). Reference day = the latest of: the first logged workout, the day after the last deload ended, the day "Not now" was tapped. No logged workouts → no suggestion. Suggest when either comes first:
  - **Interval:** ≥ 6 weeks since the reference day.
  - **Stall:** ≥ 4 weeks since the reference day, and **half or more** of the judgeable exercises in the current plan (every exercise, ★ or not) have stalled. Judgeable: done in at least 3 non-deload workouts in the last 28 days and at least once before. Stalled: the best est. 1RM (Epley) of the last 28 days is not higher than the best before, **and** at no weight done in both periods did the best reps go up. Basis: isolation work builds muscle about as well as compounds and strength gains are specific to each exercise, so key lifts alone miss stalls; the 3-workout minimum (filters noise from small weight steps) and the half line are judgment calls.
  - Not shown during a deload or while a workout is running. "Not now" waits for the next trigger (it moves the reference day to today).
- Basis: lifters report deloading about every 5–6 weeks for about a week, keeping days and exercises and cutting sets, load and effort (Rogerson et al. 2024, survey of 246 athletes); amounts and the stall rule are Leo's choices.

### 5.12 Streak
Freezes: a week overlapping any freeze period that isn't complete is skipped (holds). **Calendar flames** (History calendar): the number sits on a flame — fire (yellow → orange → red, 3 small white sparks drifting up like a fire pit, each on its own rhythm) on the rest day of every complete week (the last weekday the plan doesn't train; else the week's last day), ice (3 tiny snowflakes drifting down above it) on each day a freeze started. **Skipped days** (gray dashed outline with grayed-out stripes inside; label "skipped"): past planned training days, from the first logged workout on, with no workout that date and that routine day not done anywhere else in the same week (a workout moved to another day isn't skipped). Today is never skipped. Tapping a skipped day shows a small "Skipped" tooltip above it for 3 s (fades in and out; no animation with reduced motion).
Weeks start on the week-start day (§4.6). Planned days = routine days with a weekday and at least one slot (6 in the seed plan). Days logged in a week = distinct routine days done (by dayId) + distinct dates of finished workouts without a routine day (free or imported) not already counted. A week is **complete** when days logged ≥ planned days. Current streak = consecutive complete weeks counting back from the current week; the current week adds 1 once complete and doesn't break the streak while in progress. Best = longest run of complete weeks.

### 5.13 Recovery
Counted in **whole days** (workout dates), since people train at about the same time each day. Basis: performance comes back in about 48–72 h (Morán-Navarro 2017; Korak 2015), and training a muscle every 48–72 h is common and works (Schoenfeld 2016, 2019); a muscle doesn't need to be fully recovered to train it again. The 4-set line and the extra day are judgment calls.
- **Hard day** for a muscle: ≥ 4 done working/failure sets that day, each adding its fractional weight (§5.2) to every group of its exercise (indirect ½).
- Hard day today or yesterday → **recovering**; 2 days ago → **partly recovered** (fine to train); 3+ days → **fresh**.
- **Slower recovery** (age 40+, sleep under 6 h, or a ★ key lift set to failure hitting that muscle directly that day): partly recovered one day longer (3 days ago). Never more; it never blocks training.
- Display only (muscle map). The worst status over the last 3 days wins.

### 5.14 Progress ranges and series
- Weeks begin on the week-start day (§4.6). Range start (first day included): 4 wk = the first day of the week 3 weeks before the current week; 12 wk = 11 weeks before; 6 mo = 25 weeks before; All = first workout's week.
- Weekly totals: one row per week from the range start to the current week, empty weeks included: tonnage (§5.3), fractional sets per group (§5.2), workouts.
- Average weekly sets = Σ weekly sets ÷ number of weeks (empty weeks count), rounded to 0.1.
- Frequency = workouts in the range with ≥ 1 direct (weight 1) working/failure set for the group ÷ number of weeks, rounded to 0.1.
- Exercise series: one point per finished session with done non-warm-up sets of the exercise (oldest first): est. 1RM = best Epley of its sets, best set = the set giving it, volume = Σ weight × reps, sets.
- Calendar day load: per date, working/failure sets done, tonnage, workouts.

### 5.21 Your week and the Week check (Nov 18 2026)
Shown on the Plan tab under the day's exercises (and in the editor, live with the draft). It looks at the **whole routine**. **The rules are universal** (training research and anatomy, `core/workoutCheck.ts`), never taken from a plan; numbers marked *judgment* are our own reasoning.
- **Facts:** workouts a week · sets a week · ~min per workout (average, §5.8) · **score** (Nov 18 2026, replaced "to failure"; tap it for the breakdown).
- **Week score** (`weekInsight(...).score`; weights are *judgment*, Leo Nov 18 2026): starts at **20**, max 100, the rest earned as a share of focus muscles: weekly volume in target **25** · every part trained (all jobs of muscles with 2+) **20** · recovery (no hard, 4+ direct sets, on back-to-back days) **15** · failure (muscles with a failure-eligible exercise that get a failure set this week, from the failure picks; full points when the goal doesn't use failure) **10** · twice a week (only muscles over 10 sets a week) **10**; minus **2** for each muscle-workout over 10 sets (indirect sets count ½). An empty plan scores 20. Color: green from 75, amber from 50, red below. The breakdown lists each part with "x of y" and its points, and "Every plan starts at 20. The rest is earned."
- **Muscle map** (Nov 18 2026, replaced the 2-column tiles; `components/WeekMap.tsx`, geometry `core/muscleMap.ts`): the Progress body, front or back (‹ FRONT › under it is one button, the label included; or swipe the body), each muscle colored by its weekly sets vs its target: green = in target, yellow → red = short (hue by sets ÷ minimum: red far short, yellow close), purple = above the max, grey = skipped or not trained. Beside it, a list of the muscles drawn on that side (most sets first, including ones with 0 sets), each with its color and "sets/min". The list doesn't scroll inside (that fought the page scroll): it shows every muscle on the side (the picked one highlighted); rows are compact (30 px, tighter than the usual 44 px tap size, Leo's call: the body is the main way to pick), and the picked muscle's card spans the full width under the body and list, above its exercises. Under the map, the picked muscle's **exercises in your plan** (`exercisesFor`): for each part, the routine's exercises that train it with their weekly sets, or in red "Nothing in your plan trains this part"; muscles without parts list their direct exercises; then "also works it (½ set each)" with the exercises that work it indirectly. Tap a muscle on the body or the list: its card shows across the full width: big sets-a-week number in the muscle's color with the status pill beside it, a bar with the target band (dashed) and the week's sets, "target min–max · n×/wk" (one line), a status pill (In target / n sets short / Above target / Skipped / Not trained in this plan), and each part as a line, ✓ when the plan trains it, red ✕ when it doesn't (grey for skipped muscles), and the body glides in on it (0.45 s viewBox zoom, same proportions so the page doesn't jump; stays on the side you're looking at when the muscle is drawn there, e.g. side delts, traps, calves, forearms are on both; otherwise switches to the side that has it). Zoomed muscles split by region get a labeled line per part, green when the plan hits it, red when not (grey for skipped muscles): shoulders (front, side, rear; the front view adds "rear: back ›"), biceps (long head, short head, brachialis), triceps (long head, lateral head, medial head; on the back), traps (upper, mid/lower), chest (upper, mid/lower), calves (upper, lower), back (upper back, lats, lower back), glutes (medius, max), abs (rectus, obliques), quads (extension, squat), hamstrings (hip hinge, knee flexion), forearms (flexors on the front, extensors on the back), neck (flexion front, extension back): every muscle with 2+ jobs, so the zoom shows every angle the plan should cover. Labels have a dark outline so they stay readable over the body; a missing part's label is muted grey. ‹ › or a swipe shows the other side as the whole body (letting go of the picked muscle); tapping the same muscle again also zooms out. No "Whole body" button (Nov 18 2026). Legend on one line: in target · a bit short · far short · above · skipped. Lines keep their width when zoomed (non-scaling strokes).
- **Jobs per muscle** (anatomy; variation grows a muscle more evenly, Costa 2021, Kassiano 2022): back = lats (pulldowns, straight-arm pulldowns, tucked rows), upper back (rows), lower back (hip hinges, back extensions) · biceps = long head (arm behind the body: incline curl), short head (arm in front: preacher curl), brachialis (under the biceps, pushes it up: hammer or reverse curl; Pedrosa 2023; counted as biceps, Nov 18 2026, migration `2026-11-18-biceps-parts`) · triceps = long head (arm overhead: overhead extensions, Maeo 2023), lateral head and medial head (arm at the side: pushdown, kickback, dip; the medial head works in every extension, so it's tagged with the arm-down moves; an exercise can carry two jobs for one muscle; migration `2026-11-18-triceps-heads`) · traps = shrug, mid/lower · chest = upper, mid/lower · quads = squat, extension (Ema 2016) · hamstrings = knee flexion, hip hinge (Maeo 2021, Bourne 2017) · calves = straight-knee, bent-knee · glutes = glute max (hip extension), glute medius (abduction) · forearms = flexors, extensors · abs = rectus abs (crunches, leg raises; "upper/lower abs" is one muscle), obliques (twists, side bends) · neck = flexion, extension (migration `2026-11-18-job-regions` renames back, glute and abs tags on stored exercises). Others have one job. Built-in exercises carry `jobs` per muscle and `stretch` (muscles loaded at long length) from seed `exercise-jobs.json` (migration `2026-11-18-exercise-jobs`, which also drops the earlier plan-based `angles` tags); custom exercises have none yet.
- **Week check:** a ring "n/N" and one row per check (✓ / ×, with the reasons, up to 3 then "+n more"). All passed → green-edged card, flexing figure and "COMPLETE WEEK · Your routine ticks every box for your goal." Checks look only at focus muscles trained directly. The goal comes from the training profile (Mass gain until changed).
  - *Mass gain (9):* **Weekly volume** (each muscle within its weekly target, §5.17) · **Every job** · **Stretch** (biceps, triceps, quads, hamstrings, calves have an exercise at long length — Pedrosa 2022/2023, Maeo 2021/2023, Kassiano 2023; chest and back by analogy, *judgment*) · **Twice a week** (each muscle over 10 sets a week trained directly on 2+ days: with equal weekly sets, once or twice grow about the same, Schoenfeld 2019, Pelland 2024; a second day matters when one workout would be too much; Nov 18 2026) · **Sets per workout** (≤ 10 sets per muscle per workout, indirect sets counted ½, *judgment*: per-session returns shrink) · **Recovery** (no muscle gets 4+ direct sets on back-to-back weekdays; ACSM 2009 48 h, 4-set line *judgment*) · **Rep range** (every exercise's range middle 6–30; Schoenfeld 2017/2021) · **Heavy and light** (a muscle with 2+ exercises has one ≤ 10 reps and one ≥ 12; *judgment*, Schoenfeld 2021 suggests mixing) · **Long enough rests** (90 s+; Schoenfeld 2016, Singer 2024).
  - *Strength:* Weekly volume · Every job · Twice a week · Recovery · **Heavy lifts** (★ lifts at ≤ 6 reps; Schoenfeld 2017) · **Long enough rests** on ★ lifts (3 min+; ACSM 2009).
  - *Endurance:* Weekly volume · Every job · Twice a week · Recovery · **High reps** (at least half the exercises 15+; ACSM 2009) · **Short rests** (≤ 90 s; ACSM 2009).
  - *Maintain:* Weekly volume (minimum only; Bickel 2011) · Recovery.

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
| neon / neon-2 | #3D9BFF / #23E2FF | #1559D6 / #0078A0 | primary, gradients |
| glow / glow-soft | rgba(61,155,255,.55/.18) | rgba(31,107,255,.32/.10) | shadows |
| pink | #FF3FA8 | #C41470 | PRs, celebration |
| good / warn / bad | #3DFFB0 / #FFC53D / #FF2C2C | #08794B / #8F5C0E / #FF2C2C | status; #FF2C2C is the one error red everywhere (Leo's choice) |
| star | #FFC53D | #8F6206 | ★ key lift |
| on-neon | #02101F | #FFFFFF | text on neon fills |

**Accent palettes.** The accent recolors buttons, chips, switches, steppers, bars, glows, lines and the background haze. The line man, his glow and the BLUE FIT wordmark are always blue, and the background stays navy in dark and soft white-blue in light, with a faint blue haze kept in every palette. Each accent has a fill color (buttons, chips, bars; dark text on it) and an ink color (accent text and chart lines). They are the same, except light Blue, whose ink is its deeper shade. (Light Pink/Orange/Green/Brown ink is Leo's choice and is below 4.5:1 on white.)

| Accent | Dark fill / 2nd | Light fill / 2nd | Light ink / 2nd (if different) |
|---|---|---|---|
| Blue (default) | #3D9BFF / #23E2FF | #1559D6 / #0078A0 (white text) | #1559D6 / #0078A0 |
| Pink | #FF8FD0 / #FFC2E6 | #FF8DA1 / #FFB3C1 | same as fill |
| Orange | #FF9D4D / #FFC98A | #FF5C00 / #FF8A3D | same as fill |
| Green | #5CF2A8 / #B4FFD8 | #0BDA51 / #4BE887 | same as fill |
| Brown | #D9A46B / #F0CFA0 | #B07A45 / #C99662 | same as fill |

With the Pink accent, PR highlights (normally pink) turn gold and the "recovering" muscle color turns coral, so they still stand out. PR toasts keep the line man blue.

Text colors meet WCAG AA (4.5:1) on their backgrounds in both themes, except `faint` (placeholders and decorative only).

### 6.3 Type
Display: Barlow Condensed 600/700, uppercase, letter-spacing .02–.16 em (XL 46/0.92, LG 32, MD 22). Body: IBM Plex Sans 400/600, 15/1.5. Numbers: IBM Plex Mono 500, tabular. Eyebrow: 12 px, 600, .16 em, uppercase, muted.

### 6.4 Spacing, shape, motion
Spacing 4/8/12/16/24/32. Radii 10/16/22 (cards 22, sheets 26 top). Minimum tap target 44 px (chips and switches are drawn smaller but have an invisible 44 px hit area); primary buttons 54–62 px. Layouts work down to 320 px wide with no sideways scrolling; the calendar's day cells shrink to fit. Ease `cubic-bezier(.22,1,.36,1)`. Motion: page enter 0.42 s; sheet slide-up 0.42 s; dock items rise 0.4 s; button press scale .96; Start button glow pulse 2.4 s; done toggle fills green with glow; bars grow from 0 in 0.9 s; summary numbers count up 1 s; PR toast drops in with 10 sparks. **Reduced motion:** all animation off, figures show the end position (pose B).

### 6.5 Components
Glass card (with gradient hairline edge), primary button (neon→cyan gradient, dark text, glow), ghost button, quiet button, danger button, chip (selected = neon fill), badge (primary/secondary/star/pink), stepper (− value +, 52 px tall, typeable), switch, segmented control, bottom sheet (grip, backdrop blur), confirm sheet, toast, list row, volume bar with target band, progress ring (rest timer), tab bar (floating glass, active icon glows with a neon bar on top), line and bar charts (§3.14), heat-map calendar (§3.7), streak card, muscle map (§8.6).

### 6.6 Icons
24 × 24 line icons, stroke 1.9, round caps/joins, same style as the figure: today (dumbbell), plan (clipboard), history (calendar), progress (rising line), settings (sliders), plus, minus, check, close, more, swap, back, chevron, up, down, trash, note, link, info, timer, play, search, download, upload, copy, bolt, flame, trophy.

### 6.7 Logo and app icon
The splash's end pose (front double-biceps, both arms up) drawn by the figure engine at progress 1, with the flexed bicep bumps on both upper arms (5 units high, filled), stroke #6CC0FF 3.2, with a soft blue glow (Gaussian blur 1.3 in figure units, merged twice under the crisp line), on a radial gradient #0F2350 → #070D1D → #03050B with a blue halo. Sizes: 192, 512, maskable 512 (figure at 62 % for the safe zone), Apple touch 180, SVG favicon (rounded).

## 7. Storage

### 7.1 Interface (`StorageAdapter`)
`init(seed)`, `all(table)`, `put(table, row)`, `putMany(table, rows)`, `remove(table, key)`, `getSettings()`, `saveSettings(s)`, `getMeta(key)`, `setMeta(key, value)`, `exportAll()`, `replaceAll(data)` (one transaction). Tables and keys: exercises.id, routines.id, sessions.id, targets.group, jefitAliases.jefitName. Screens never touch the database directly.

### 7.1.1 Web implementation
Raw IndexedDB (no library), database `blue-fit`, IndexedDB version 10, object stores exercises (keyPath id, index name), routines (id), sessions (id, indexes date, status, importKey), targets (group), jefitAliases (jefitName), kv (key; holds `settings` and `meta:*`). Versions up to Phase 3 wrote the same database through the Dexie library (which records schema 1 as version 10); a test proves the current adapter opens that data unchanged.

Meta keys: `restTimer`, `migrations` (done migration ids), `lastBackupAt`, `backupSnoozedUntil`.

### 7.2 Write-through
The UI updates its in-memory snapshot immediately, then queues the write; writes run in order. A failed write shows "Couldn't save" with advice to export a backup. The browser is asked for persistent storage.

### 7.3 Backup JSON (version 1)
```json
{ "app": "blue-fit", "schemaVersion": 1, "exportedAt": "2026-11-14T18:00:00.000Z",
  "data": { "exercises": [...], "routines": [...], "sessions": [...], "targets": [...], "settings": {...}, "jefitAliases": [...] } }
```
Import checks, in order: valid JSON ("This file isn't valid JSON."); `app` = "blue-fit" ("This isn't a Blue Fit backup file."); version not newer than supported ("…from a newer version of Blue Fit…"); full schema (first error with its path); every session and slot references a known exercise; at most one current routine. Then the user confirms and all data is replaced. Older versions will be migrated step by step.

### 7.4 Swapping in a cloud database later
**Roadmap:** once users log in and data syncs to the cloud, remove the manual backup features (Export, Copy JSON, Import, Paste JSON, the backup reminder on Today, "Last backup" in Settings, and the crash screen's "Save a backup"). The local-only web version is temporary.

Implement `StorageAdapter` against the cloud store (e.g. Supabase tables with the same keys plus `userId`), add sign-in, keep IndexedDB as an offline cache, and sync by `id` with last-write-wins on `updatedAt` (to be added to rows at that point). No screen changes.

### 7.5 One-time migrations
On launch, each migration in order runs once; done ids are stored in meta `migrations`. `2026-11-16-week-starts-saturday`: if routine `leo-v3-1` still has day `mon` on Monday, move every day two weekdays earlier (Mon→Sat, Tue→Sun, …, Sun→Fri) and set weekStartDay = 6.

### 7.6 Seed
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
**Muscle curve** (side view, prop `trap`): the traps drawn as a small, round filled shape in the body color, like the biceps bump (two outward-bowed halves with a soft point in the middle, closed back along the body), starting exactly where the back line starts (the shoulder point, never past it toward the head) and running 8.5 units down the back, peaking in the middle, bulging out and thickening as `tq` goes 0 → 1, so the squeeze shows. Used by the Kelso Shrug: the torso stays still (chest on the pad), the straight arms come up (upper arm 80 % length at the squeeze) and the arch bulges (migrations `2026-11-18-kelso-traps`, `-traps-pad`).

Exercise figures move at the exercise's **tempo** (`core/figure/tempo.ts`): "Up 1 s · Down 3 s" → A→B 1 s, B→A 3 s, with a 0.25 s pause at each end; a "Hold N s" phase holds that position for N s instead (the moves of a figure with a real hold use a gentler ease, 60 % linear + 40 % quadratic in-out, so the slow creep near the ends doesn't make the hold look longer than N s) (calf raises: 2 s at the bottom; shrugs, Kelso shrug, face pull, leg curls: 1 s squeeze); each loop starts when the figure appears. For figures that start at the tempo's second position (standing and seated calf raise, leg press, EZ-bar incline extension, machine dip), the phases swap. No usable tempo, and the other figures (splash, loading, rest, flex): loop 3.2 s, ease-in-out A→B over 42 %, hold B 8 %, ease B→A 42 %, hold A 8 % (ease = quadratic in-out). Redraw about 30 fps, only while visible. Reduced motion: draw pose B once.

### 8.5 Brand poses
FLEX (logo, PR, summary): front view, base hy 60, la 9, sa 3; A ua 76 fa 150 → B ua 92 fa 182 shr 1.5. SPLASH_FLEX (launch splash): base hy 60, la 9, sa 3, ua 90; A fa 180 → B fa 200, plus bicep bumps (core/figure/flex.ts). REST (rest day, rest timer): side view sitting back on a bench with hands behind, breathing (t −24 → −19). LOADING: side-view dumbbell curl.

### 8.6 Muscle map
Two views side by side (front, back), each 120 × 210 units, centered on x = 60, labeled FRONT / BACK below. Drawn in the figure style: outline polylines stroke fig 1.5 with round joins, head circle (60, 13) r 9, a faint center line (front, y 34–92) or spine (back, y 28–96) in fig2. One side of the outline (mirrored at x → 120 − x): neck-shoulder (64,24)(64,28)(78,31)(86,35)(89,42); outer arm (89,42)(92,60)(95,80)(98,104); inner arm (81,48)(84,62)(87,80)(92,105); torso (78,42)(77,62)(75,82)(77,98); outer leg (77,98)(80,128)(77,160)(76,196)(80,199); inner leg (61,110)(64,140)(65,162)(66,196)(70,199); crotch (59,110)(61,110).
Regions (right side, mirrored unless noted; ellipse = cx, cy, rx, ry, rotation°):
- Front: traps polygon (64,28)(75,30.5)(67,33); front delts ellipse 82.5,39.5,4.6,6,−20; side delts 88,44,2.6,7,−12; chest polygon (62,36)(76.5,36)(77.5,47)(70,53)(62,51); biceps 87,60,3.6,10,−10; forearms 92,89,3.6,13,−10; quads polygon (66,104)(77,101)(79,128)(74.5,151)(67,149)(64.5,124); adductors polygon (61.5,110)(65.5,107)(64,127)(62.5,134); calves 75,172,2.4,12,4.
- Abs (front): polygon (61.5,55)(70,54.5)(71.5,70)(70.5,86)(61.5,92), mirrored. Neck: front polygon (60.8,22.6)(63.4,22.6)(63.6,27.6)(60.8,28.6), mirrored; back polygon, not mirrored (56.6,21.8)(63.4,21.8)(63.6,25.2)(60,23.6)(56.4,25.2).
- Back: traps polygon, not mirrored (60,24)(67,28.5)(79,32)(70,41)(60,62)(50,41)(41,32)(53,28.5); rear delts 84,40.5,4.8,5.5,20; side delts 88.4,45,2.4,6.5,−12; back (lats) polygon (62,60)(74,50)(77.5,58)(76,76)(69,86)(62,88); triceps 87.6,60,3.8,10.5,−10; forearms 92,89,3.6,13,−10; glutes 68.5,104,8.4,8.6; hamstrings polygon (63.5,115)(77,113)(78,136)(72.5,151)(65.5,149); calves 71,170,4.8,13,3.
Mirrored ellipses negate the rotation. Region fill opacity: empty 0.05; value k → 0.14 + 0.7k; recovery: fresh 0.16, others 0.75. Selected region: white-ish stroke, fill ≥ 0.5. Fill changes animate over 0.6 s.

## 9. Offline, install, deploy
- Loading: the app shell, Today, logger, plan view, history and settings load at start (about 100 KB of compressed JavaScript); Progress, the plan editor, the workout editor, exercise charts, the seed data (first launch/reset only) and the backup format/validator load on first use, showing the LOADING figure meanwhile. Everything is precached, so this works offline too.
- PWA: manifest (standalone, portrait, theme #05070D), service worker precaches all app files (latin font subsets only); works with no network after the first visit. Update flow: "Update ready" toast and Settings → Update app.
- iPhone: install from Safari via Share → Add to Home Screen. Web limits: no vibration; no alert while the screen is locked (the app keeps the screen on during workouts instead).
- Hosting: GitHub Pages project site at `/blue-fit/`; GitHub Actions builds, tests and deploys on every push to `main`.

## 10. Feature table (Jefit → Blue Fit)

| Jefit feature | Blue Fit | Status |
|---|---|---|
| Routines with days and exercises | Routine → days → slots, several routines, one current | Built |
| Routine editor (add/remove/reorder, sets, reps, rest) | Plan editor with drag and drop, live volume table | Built |
| Supersets | Superset groups in logger and plan editor | Built |
| Exercise database + search/filters | Exercise library + picker (muscle, equipment) | Built |
| Custom exercises | Same fields + muscle mapping + optional figure; edit built-ins too | Built |
| Exercise instructions / videos | Full how-to card + animated line figure | Built (videos left out) |
| Workout logging with previous values | Logger with pre-fill, Last line, steppers | Built |
| Set types (warm-up, drop, failure) | Warm-up, working, drop, failure | Built |
| Rest timer | Auto rest timer, adjustable, chime, persists | Built |
| Plate calculator | Plates per side | Built |
| Personal records + alerts | Derived PRs, live pink alerts | Built |
| Workout summary | Summary with PRs and sets per muscle | Built |
| Workout history list | History list, edit and delete past workouts | Built |
| Calendar / streaks | Heat-map calendar, weekly-plan streak | Built |
| Progress charts (1RM, volume) | Per-exercise charts, weekly sets vs targets, tonnage, frequency | Built |
| Muscle recovery map | Muscle map (weekly sets) + recovery status | Built |
| Import history | Jefit export importer with name mapping | Left out (skipped by choice; Jefit names stay as exercise aliases in case it comes back) |
| Body stats and photos | Body tracking (weight band, scans, photos) | Later phase |
| Deload weeks | Suggested by interval/stall, user decides; lighter week of the same plan | Built (web: banner; native: notification later) |
| Interval / stopwatch timer | Timer modes | Later phase |
| Cloud sync / account | Swap StorageAdapter; then remove manual backup/import | Later phase |
| Auto-build plan | Builds the weekly plan from goal, profile and targets. Uses the §5.13 recovery rule, indirect sets included (½): indirect work on a recovering muscle is allowed but adds to its load, and no hard direct work for a muscle the day after a hard day for it | Later phase |
| AI coach, social, community, watch apps, video library | — | Left out |
