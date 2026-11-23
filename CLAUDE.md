# Blue Fit: project rules

Leo's personal training app (replaces Jefit). Mobile-first PWA on GitHub Pages: https://the-toolsgit.github.io/blue-fit/

## Working with Leo
- **Discuss before building.** New features or big structural changes: short plan first (what, where, data impact), wait for OK.
- **Small fixes don't need approval.** Fix bugs and obvious gaps directly.
- **Be short and direct — less verbose in every reply.** Say what changed and what to test. No long recaps, no extra explanation unless asked.
- **Don't guess training facts.** Exercise content, sets, reps, targets and rules come from the plan data (`src/core/seed/`, extracted from Leo's plan page). If something is missing, ask.
- **Look: neon, built from the blue line man.** Glowing blue lines, dark-led, fun, smooth animations, very easy to navigate. This is a must. Keep 44px+ tap targets, actions at the bottom, and respect `prefers-reduced-motion`.
- **Bump the version on every push** (`npm version patch --no-git-tag-version`, shown in Settings as "Blue Fit · version x.y.z") and tell Leo the new number in the reply, so he knows which build he is testing.
- Leo uses an **iPhone** (no web vibration, no alerts while the screen is locked; native app later).

## Architecture rules
- `src/core/` is **framework-free** (no React, no DOM, no browser APIs): types, volume, 1RM, records, progression, sessions, time estimate, plates, today, importers, export format, figure engine. It must stay portable to Swift/Kotlin.
- The **plan and exercise library are data** (`src/core/seed/*.json`), never hard-coded in components.
- The **figure engine** is a pure function: spec + progress (0–1) → shapes (`core/figure/engine.ts`). SVG output is a thin layer (`core/figure/svg.ts`, `ui/components/Figure.tsx`).
- Screens use only the **`StorageAdapter`** interface (`core/storage/StorageAdapter.ts`). IndexedDB lives only in `src/storage/idbAdapter.ts` (raw IndexedDB, no library). `dexieAdapter.ts` is kept only to test that data written by older versions still opens.
- Weights are stored **exactly as typed**: plate lifts per side without the bar, dumbbells per hand, fixed bars and machines as shown. No bar-weight math.
- Volume counting: direct set = 1, indirect = 0.5. Warm-ups and drop sets don't count toward weekly sets. Drop sets count toward tonnage and PRs.

## Living spec (required)
- `docs/APP_SPEC.md` describes the whole app platform-neutrally. **Update it in the same commit** as any change to behavior or looks.

## Commands
- `npm run dev`: dev server (also on your local network, for testing on the phone)
- `npm test`: Vitest (core logic + storage)
- `npm run build`: hooks lint (oxlint `rules-of-hooks`) + typecheck + production build; the deploy fails on a hooks error
- `npm run seed`: re-extract seed JSON from `docs/source/Leo_Training_Plan.html` (local only; `docs/source/` is git-ignored because it holds personal notes)
- `npm run icons`: regenerate the app icons from the FLEX pose

## Privacy
The repo is **public**. Never commit `docs/source/` or any body measurements, weights or health notes. Workout data lives only on the phone (export/import JSON).
