# Species: first playable (text sim)

A turn-based evolution game. Live one animal's life at a time, die often, come back stranger.
This is the text-sim prototype described in the Evolution Game design doc.

New to the game's terms (Gene Points, mutations, birth luck, visibility tiers and so on)? See [GLOSSARY.md](GLOSSARY.md).

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # single-file site in dist/index.html (host it on Cloudflare Pages)
npm run sim        # headless balance simulation (a bot plays hundreds of lives)
npm run typecheck
```

Deploy to Cloudflare Pages: connect the repo, build command `npm run build`, output directory `dist`.

## Layout

- `src/engine/` all game rules in plain TypeScript, no UI code. Reusable for pixel and mobile builds.
  - `data.ts` species, locations, events, traits, perks (the data-driven content)
  - `world.ts` location graph, food, populations, wandering predators
  - `run.ts` the turn loop: upkeep, event draw, actions, threat rolls, goals
  - `meta.ts` account, death payout, codex familiarity, unlocks
- `src/ui/` React text UI with a two-screen layout (scene on top, menu below)
- `scripts/sim.ts` balance bot, `scripts/trace.ts` prints one life turn by turn
- `scripts/tutorial.ts` checks the tutorial rules (tip triggers, coaching, old-save migration); `scripts/uitest.tsx` is the UI smoke test (run both with `npx tsx`)

## In this first playable

Species: Field Mouse, Deer, Wolf (wolf unlocks through codex familiarity or a deer win).
Eight locations, about twenty events, six stats, three needs meters, birth luck, Gene Points,
three mutations (Zigzag, Keen Nose, Thick Coat), codex familiarity, account XP and perks,
visibility tiers, and saves in local storage.

Not yet: random world events (storms, quakes), the hidden mayfly (the unlock is detected, the species
is not playable), keystone species, pixel art, accounts and cloud saves.

## Contested rolls in one line

Chance = 50% + 8 points per stat of difference, clamped to 5% to 95%.
