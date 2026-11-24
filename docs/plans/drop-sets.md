# Drop sets to save time (reviewed draft, Nov 24 2026)

Goal (Leo): when there's too little time (short length picked in Build my plan, or a day over its length), the
builder uses drop sets instead of only cutting sets.

## Evidence
- Drop sets give similar growth to normal sets in about ½–⅓ the time: Sødal 2023 meta-analysis (6 studies),
  Iversen 2021, Fink 2018 (1 drop set vs 3 sets: similar growth, less time; strength favored normal sets).
  Caveats: small studies, mostly isolation work. "2 sets + 1 drop ≈ 3 sets" is *judgment*.
- Drop ≈ 20–25 % lighter (common practice, *judgment*).

## Plan
1. **Data:** `Slot.dropSet?: boolean` (optional in export; old plans and backups = off).
2. **Which exercises:** own allow-list: cable, machine (pin), dumbbell isolation. Not barbell, Smith,
   plate-loaded, bodyweight, holds, assisted, ★ key lifts, heavy (6–10) slots, superset slots.
3. **Builder step 7:** before cutting plain sets, turn a 3-set exercise into 2 sets + drop (saves ≈ 2.25 min at
   2 min rest), for muscles that would otherwise fall below their minimum. After polish: remove any drop the day
   no longer needs, and any on a slot raised back to 3 sets. Runs inside the existing loop; no slowdown.
4. **Time estimate:** `slotsMinutes` adds 0.5 min per drop, no rest before it (builder, plan check, conflicts).
5. **Volume:** drop set counts **½ set** (plan and logged workouts, manual D sets too), not 0. Needs a change to
   the CLAUDE.md rule. Skipped-set catch-up stays whole sets.
6. **Workout:** the drop set is added after the last working set, weight prefilled ~75–80 % (rounded to the
   exercise step). No rest timer between the last set and its drop; stays on the same exercise. Cue: "Drop set:
   lower the weight, no rest, go until you can't." No drops in deload weeks.
7. **Failure / weight test:** a readiness test always wins: the last set goes to failure, the drop follows. Other
   app failure picks on that exercise are replaced by the drop (the drop is the hard set).
8. **Guards:** header "3 × 10" counts only working/failure sets; deload stall check ignores drops. Already safe:
   progression, weight tests, effort check, PRs, Up/down, extra-set catch-up.
9. **Plan UI:** small "+drop" tag on plan rows; slot sheet toggle "Drop set after last set" On/Off.
10. **Later, not now:** live "running behind" suggestion during a workout.

Spec + tests in the same commit.
