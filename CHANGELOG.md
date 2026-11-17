# Changelog

## 1.1.0 (17 Nov 2026)

No game rules changed (the sim snapshot is unchanged).

- **Pixel scene.** The top of the Play screen is now a drawn scene: your animal, your herd or pack, a nest, and whatever is hunting you, on a backdrop for the place's biome and the season (snow falls in winter, the river ripples). Name tags sit over you and the threat. All art is placeholder, written as 16 by 16 character grids in `src/ui/pixel/art.ts` with one shared 13-colour palette.
- **Classic view** switch in Settings brings back the emoji scene. Browsers without canvas get it automatically.
- **Credit.** "Built on the foundation laid by TierZoo" on the menu, with a Credits section in How to play. Both say the game is independent and not affiliated.
- Save schema version 3 (adds the Classic view setting). Older saves load as before.

## 1.0.0 (16 Nov 2026)

The first release meant for players, not only testers. No game rules changed: the balance sim's output is identical to 0.7.0.

**Saves**
- The save has a schema version and is repaired on load: missing fields get defaults, damaged values fall back safely, saves from every earlier build still load.
- A backup of the account is kept from the end of each life and is restored if the main save cannot be read.
- A life in progress that cannot be played (damaged, or from an incompatible build) is dropped with a notice instead of crashing.
- A warning appears if the device refuses to save (storage full or blocked).
- Save codes: copy your progress as text in Settings and load it on another device.

**Play**
- Minimap in the Surroundings panel: every place and path, fog for places you have not visited and cannot see, danger rings, a snowflake on ground that is deadly this winter, a star on the deer's goal. Tap a neighbouring place to travel.
- The map is now one explicit graph: places and paths are listed once, neighbours are derived, and a broken map (unknown place, repeated path, unreachable place) fails at startup.
- Action buttons are two across by default. Settings has a switch back to a single list.
- How to play: an in-game guide, on the menu, on the Play screen and behind the ? on tips (it replaces the link to GitHub).
- "Sight: tier N of 3" can be tapped for an explanation.
- A long flashcard now grows the panel instead of being cut off.
- Mayfly unlock: found by dying before adulthood in three separate lives, as any species (the old one-day rule could not be reached). The mayfly is revealed but not playable yet.

**Settings**
- Show the intro again, save codes, and Erase save (moved from the main menu, still two taps).

**App**
- Installable, and playable offline after the first visit (web app manifest, icons, service worker).
- Page title, description and share preview.
- No browser alert boxes; errors show on the screen.

**Project**
- `npm test` runs every check; the sim has a snapshot so rule changes cannot slip in unnoticed; GitHub Actions runs the checks and the build on each push.

## 0.7.0 and earlier

See the commit history and the project hub. 0.7.0 prep stat bars, 0.6.0 tutorial, 0.5.1 flashcard and panels, 0.5.0 wording pass.
