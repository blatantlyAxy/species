# Epic PIXEL: Pixel scene layer

Written 21 Oct 2026 against build v0.5.0 (repo `main`, commit 5aa35f4). Estimates are rough working sessions (S = half, M = one, L = two) for one builder chat plus review. Art is not included in the code estimates.

## Goal
Replace the text-and-emoji scene with a pixel-art scene that plays each turn's result as a short animation, using the same engine. No mechanics change, so `scripts/sim.ts` results must stay identical.

## Scope
- **In:** pixel UI skin, animal/predator sprites, biome backdrops, a scene that animates the turn report (forage, flee, hit, die, birth), pixel flash screens, season/weather tint.
- **Out (for now):** walkable tile map, free movement, sound, touch gestures beyond tap. A tile world changes the design (the game is location-and-turn based), so it is a separate epic if ever wanted.

## What already exists (from the code)
- `.scene` block in `Play` (`src/ui/App.tsx`) with a CSS gradient per biome (meadow, forest, river, highlands) and emoji sprites with a 2-step `bob` animation. This is the natural mount point.
- `FlashScreen` component with tones (gold, bad, good, warn) and `UnlockFlash` (shipped in 0.5.0).
- `TurnReport` in `src/engine/types.ts` has before/after snapshots, `threat.outcome`, `envHits`, `newEvent`. The engine is pure TS and the UI only reads `RunView` and `TurnReport`.
- Gaps the epic must close: `TurnReport.action` is a display label, not an action id, so the UI cannot reliably tell "forage" from "hide". The build uses `vite-plugin-singlefile`, so every image would be inlined into one HTML file. `jsdom` (used by `scripts/uitest.tsx`) has no canvas.

## Key decisions (proposed, overrule freely)
| # | Decision | Proposal |
|---|---|---|
| D1 | Renderer | Canvas 2D inside a React `<PixelScene>`, integer scaling, `image-rendering: pixelated`. Rest of the UI stays DOM. |
| D2 | Animation driver | Engine emits `cues` on the report; the scene plays them. The engine never knows about frames. |
| D3 | Assets | PNG sprite sheets plus one JSON manifest. Missing art falls back to today's emoji, so work can ship in slices. |
| D4 | Fallback | A "Classic view" toggle keeps the text/emoji scene for testers, accessibility and low-end phones. |
| D5 | Target | Mobile portrait first (about 360 px wide), desktop scales up. |

## Needed from Akshay
1. Scope confirmation: Milestones 0 to 2 (tier 2), with 3 as polish.
2. Art source: you draw it, commission, licensed pack, or generated placeholders first. (Placeholders first is the cheapest way to judge the feel.)
3. Sprite size (16 or 32 px), palette or reference games, pixel font choice.
4. Sign-off on the asset list below.
5. Pending UI decisions that touch pixel buttons: 2x2 action layout (A/B/C), and the "small prey / herd prey" wording.

## Asset list (first pass, about 60 to 100 frames)
- Species (mouse, deer, wolf): idle 2, move 4, eat or graze 2, hurt 2, die 3, rest 2 (about 15 frames each).
- Predators (hawk, fox, wolf pack, rival pack-mate): idle 2, strike 2.
- Extras: herd-mate, pup, nest, carcass, berries, seeds.
- Backdrops: 4 biomes first (meadow, forest, river, highlands), then per-location variants (8 locations). Seasons by palette tint, not new art.
- Overlays: rain, snow or cold, wind lines, night.
- UI: pixel font, button and bar frames, 8 to 10 icons (Health, Hunger, Energy, Safety, rank, herd).

---

## Milestone 0: Foundations

**P-1. Art direction and asset spec** (M, needs Akshay)
As the designer I want a locked sprite size, palette and asset list so art can start.
- Done when: `epics/art-spec.md` exists with sprite size, palette, frame counts per state, file naming, and the manifest format.
- Blocks: P-3, P-5, P-6.

**P-2. Render spike: `<PixelScene>`** (M)
As a player I see a canvas scene where the emoji sprites are today.
- Mounts in `Play` in place of `.sprites`, driven by `RunView` (biome, species, event pred, herd, nest).
- Integer scaling, crisp edges, correct at 360 px portrait and on desktop.
- Placeholder rectangles or emoji drawn on canvas is acceptable.
- Behind the Classic view toggle from P-16 (stub the flag here).

**P-3. Asset pipeline and manifest** (M)
As a builder I can add art by dropping a PNG and a manifest line.
- Loader for sprite sheets, manifest of species, state, frame count, fps.
- Missing sprite falls back to emoji with no crash.
- Decide inline versus separate asset files given `vite-plugin-singlefile`; set a size budget (proposal: 400 KB total) and a build check that fails above it.
- Depends on: P-1, P-2.

## Milestone 1: Pixel skin (tier 1)

**P-4. Pixel UI theme** (M)
As a player the whole app feels pixel, not just the scene.
- Pixel font, bevelled buttons, segmented bars (the bars already use stepped fills in `styles.css`), framed cards.
- Disabled states stay clearly greyed (Round 1 feedback).
- Action layout follows the decided option from the 2x2 question.
- Depends on: P-1, 2x2 layout decision.

**P-5. Biome backdrops** (M)
As a player each location looks like where I am.
- 4 biome backdrops replacing the CSS gradients; season palette tint (spring, summer, autumn, winter).
- Stretch: per-location variants for the 8 locations in `data.ts`.
- Depends on: P-3.

**P-6. Species, predator and prop sprites (idle)** (L)
As a player I see pixel mouse, deer, wolf, hawk, fox, wolf pack, rival, herd-mates, nest.
- Replaces `PRED_EMOJI` and `def.emoji` in the scene; 2-frame idle loop.
- Herd-mates show up to 3 as today, then scale to the real herd size in P-13.
- Depends on: P-3.

**P-7. Pixel flash screens** (S)
As a player the result flash (hurt, close call, victory, world pushes back, unlock) has its own pixel art.
- One illustrated header per tone in `FlashScreen`; keep the amber, red, green, gold tone logic from `reportTone`.
- Depends on: P-4.

## Milestone 2: Scene view (tier 2)

**P-8. Engine: scene cues on the turn report** (M)
As a builder the scene knows what happened without parsing text.
- Add `actionId` and `cues: SceneCue[]` to `TurnReport` (examples: `forage`, `rest`, `travel {to}`, `threat_enter {pred}`, `respond {hide|bolt|fight|warn}`, `hit`, `escape`, `death`, `birth`, `herd_change`, `env {cold|wind|starving}`).
- Built inside `act()` in `src/engine/run.ts` from data it already has. No change to rolls or RNG order.
- Done when: `npm run sim` output is byte-identical to before; a new script prints cues for a scripted run.

**P-9. Cue player** (M)
As a player the turn plays out in the scene before I choose again.
- Plays cues in order, 0.5 to 1.5 s total, then shows the existing report and flash.
- Tap or Enter skips; `prefers-reduced-motion` skips straight to the end state.
- Depends on: P-2, P-8.

**P-10. Animal action animations** (L)
- Move, eat or graze, hunt, rest, hurt, die, birth for the three species.
- Depends on: P-6, P-9.

**P-11. Threat staging** (M)
- Predator enters from the edge, the response (hide, bolt, fight, warn) plays, outcome shows (escape, hit, kill).
- Uses `report.threat.outcome` and the response cue.
- Depends on: P-10.

**P-12. Weather, time of day and season** (M)
- Overlays: rain (`rain_storm`), cold or snow, wind (`Windy Ridge` in winter), night for the later half of a day (`turnsPerDay` is 2 for mouse).
- Driven by `RunView.seasonName`, active event effect, and `envHits` chips.
- Depends on: P-5, P-9.

**P-13. Goal-state visuals** (M)
- Deer: true herd size (up to 8) and the player's rank position. Wolf: pack of 6 with rank. Mouse: nest, pups, litters.
- Depends on: P-6.

**P-14. Travel transition** (S)
- Short slide or fade between locations using the `travel` cue.
- Depends on: P-5, P-9.

**P-15. Menu, species select, debrief and codex art** (M)
- Portraits replace emoji on the species cards, codex, unlock flash and debrief.
- Depends on: P-6.

## Milestone 3: Polish and release

**P-16. Classic view and motion settings** (S)
- Toggle in the menu: Pixel scene or Classic. Reduce-motion honours the OS setting. Choice saved in local storage with the account.

**P-17. Performance and device QA** (M)
- 60 fps on a mid-range Android in portrait, no battery drain when the scene is idle (pause the loop when the tab is hidden or nothing is animating).
- Check bundle size against the P-3 budget and the Cloudflare Workers asset deploy.

**P-18. Tests** (M)
- `scripts/uitest.tsx` runs in jsdom with no canvas: stub canvas or render the Classic view in that script, and unit-test the cue generator and manifest loader separately.
- Add a sim check that cues never change outcomes (same seed, same result).

**P-19. Docs and release** (S)
- Bump `VERSION` (suggest 0.6.0), update `GLOSSARY.md` for any new player-facing terms, README (how to add art), the hub page, and the feedback log. Ask testers about the new scene.

---

## Suggested order and totals
1. P-1 (in parallel with P-2).
2. P-2, P-3 (placeholders), then P-8 in parallel.
3. Ship a **first slice**: P-4, P-5, P-6 with placeholder art. Playtest the feel.
4. P-9 to P-15 in any order after P-8/P-9.
5. P-16 to P-19, then release.

Code effort, roughly: Milestone 0 about 2.5 sessions, Milestone 1 about 5, Milestone 2 about 8 to 9, Milestone 3 about 3. Calendar time depends mostly on art.

## Risks
- **Art volume and consistency** is the main cost and schedule risk. Mitigation: placeholders first, one style guide (P-1).
- **Single-file build** inflates with images. Mitigation: size budget and a build check (P-3).
- **Cue/engine drift**: animations lying about what happened. Mitigation: cues generated from the same data as the report, plus the same-seed test (P-18).
- **Testing**: jsdom has no canvas (P-18).
- **Scope creep toward a tile world.** Keep it out of this epic.
