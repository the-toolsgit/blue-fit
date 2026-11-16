// Plain wording for the plan's rule cards (applied over the extracted seed; `npm run seed` keeps it).
// `old`: earlier texts this replaces (only if the card still shows one of them, i.e. it wasn't edited).
export const RULE_TEXT: Record<string, { old: string[]; text: string }> = {
  "★ Heavy": {
    old: [
      "Stable lifts where adding weight is the main goal. Unmarked = isolation: lighter, strict, same effort. Rest about 2 min between sets. Workout times assume that and leave out warm-up.",
      "★ lifts: the main goal is adding weight over time. No ★: lighter lifts, strict form, but push just as hard. Rest about 2 min between sets. Workout times include that rest, not warm-ups.",
      "★ = big, stable lifts that are safe to load heavy: push the weight up whenever you can. No ★ = smaller isolation moves: they get heavier too, in small steps, with strict form and full range. Same effort for both.",
    ],
    text: "★ Key lifts: the heavy lifts where your weight should climb steadily. The app watches them to see if you're still getting stronger, and suggests a deload when they stall.",
  },
};
