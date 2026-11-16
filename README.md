# Species

A turn-based evolution game. Live one animal's life at a time, die often, come back stranger.

**Play it:** https://species.startswithakshay.workers.dev (works offline once loaded; add it to your home screen to install it)

Three species in 1.0: Field Mouse, Deer and Wolf (the wolf is unlocked through the codex or a deer win). Eight places,
about twenty events, six stats, four meters, birth luck, Gene Points, three mutations, a codex, account levels and perks,
sight tiers, a minimap, a tutorial and an in-game guide. Progress is saved on the device, with save codes to move it.

New to the game's terms? The game has a How to play screen. The full reference is [GLOSSARY.md](GLOSSARY.md), and
[CHANGELOG.md](CHANGELOG.md) lists what each version changed.

## Run it

```bash
npm install
npm run dev            # local dev server
npm test               # typecheck, sim snapshot, engine checks, tutorial rules, UI smoke test
npm run build          # the site in dist/ (one HTML file plus the manifest, icons and service worker)
npm run preview        # serve dist/ locally, with the service worker
npm run sim            # headless balance simulation (a bot plays hundreds of lives)
```

Pushing to `main` deploys to Cloudflare Workers (`wrangler.jsonc` serves `dist/`). GitHub Actions runs `npm test` and the build on every push.

## Layout

- `src/engine/` all game rules in plain TypeScript, no UI code. Reusable for pixel and mobile builds.
  - `data.ts` species, places and paths (the map graph), events, traits, perks
  - `world.ts` food, populations, wandering predators, path finding
  - `run.ts` the turn loop: upkeep, event draw, actions, threat rolls, goals, the view and the minimap
  - `meta.ts` account, save schema and migration, death payout, codex, unlocks
  - `save.ts` save codes; `tutorial.ts` tips and first-death coaching
- `src/ui/` React UI. `App.tsx` screens, `Minimap.tsx`, `Guide.tsx` (How to play), `storage.ts` (local saves and backup), `Support.tsx` (feedback, crash screen)
- `public/` manifest, icons and `sw.js` (network first, cache as the offline fallback)
- `scripts/` `sim.ts` balance bot and `sim.snapshot.txt` (its expected output), `core.ts` engine checks, `tutorial.ts`, `uitest.tsx`, `trace.ts` (prints one life)
- `epics/` planned work (the pixel scene layer)

## Rules that keep it safe to change

- **Mechanics changes show up in the sim.** `npm run test:sim` compares the bot's results with `scripts/sim.snapshot.txt`. If you meant to change balance, regenerate it with `npx tsx scripts/sim.ts 300 > scripts/sim.snapshot.txt` and say so in the commit.
- **Saves must keep loading.** When `Account` changes shape, bump `SAVE_VERSION` in `meta.ts` and teach `normalizeAccount` the step. Storage key names never change. The order of `PATHS` in `data.ts` is part of saved lives.
- Bump `VERSION` in `src/ui/version.ts` on every shipped change, and update `GLOSSARY.md`, `src/ui/Guide.tsx` and `CHANGELOG.md` when a term or screen changes.

## Contested rolls in one line

Chance = 50% + 8 points per stat of difference, clamped to 5% to 95%.
