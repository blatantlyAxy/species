# Species: glossary

Every in-game term, what it means, and how it works in the current build (v0.5.1).
The engine code is the source of truth. Items marked **Planned** are in the design doc but not built yet.

When you add a feature that introduces a new term, add it here in the same change.

## Contents

- [The loop](#the-loop)
- [Life and turns](#life-and-turns)
- [The Play screen](#the-play-screen)
- [Stats](#stats)
- [Needs meters](#needs-meters)
- [Rolls and threats](#rolls-and-threats)
- [Birth](#birth)
- [Mutations](#mutations)
- [Account progression](#account-progression)
- [Codex and unlocks](#codex-and-unlocks)
- [Visibility tiers](#visibility-tiers)
- [Species goals](#species-goals)
- [World](#world)
- [Planned terms](#planned-terms)
- [Where the design doc and code differ](#where-the-design-doc-and-code-differ)

---

## The loop

**Run** — One life of one animal, from birth to win, death or old age. About 20 to 40 turns. Ends with a debrief.

**Life** — Same as a run. The account counts `lives` across all species.

**Respawn** — Starting a new run after one ends. The account, codex, Gene Points and mastery carry over; the animal does not.

**Debrief** — The screen after a run, reached from the **Your legacy** button: what killed you or what worked, XP earned, Gene Points, codex gains, mastery, unlocks and mutation upgrades.

**Unlock flash** (the New species flash) — A full-screen gold flash ("New species: Wolf") shown just before the debrief when a run unlocks a species. It states the condition that triggered it. The debrief keeps its own unlock badge too.

**Payout** — What a run earns. See [Account XP](#account-progression) for the formula.

**Ending** — How a run closes. Three kinds:
- **Win**: the species goal is complete. XP ×2, +3 bonus Gene Points, and a speed bonus on feats.
- **Death**: killed, starved, frozen or sick. XP ×1. The killer gains a little codex familiarity.
- **Old age**: reached the species' maximum age without winning. XP ×1.2.

---

## Life and turns

**Turn** — One outing. A mouse turn is half a day, a deer or wolf turn is a full day. Each turn the game does upkeep, draws an event, lets you choose one action, resolves it, moves the world, then checks for death, victory and stage change.

**Event** — The one thing that happens at the start of a turn, drawn from a weighted table by species, biome, season, cover and age. Kinds: threat, windfall, weather, hazard, social, sight and quiet. Only threats force a response; the rest are spent when the turn ends.

**Threat** — A predator event (hawk, fox, wolf pack, or a pack-mate rival). It replaces your normal action list with response options. See [Threat responses](#rolls-and-threats).

**Windfall** — A good event: seed fall, clover flush, berries, a fresh carcass. Foraging during a windfall feeds you 1.8× as much.

**Season** — Spring, Summer, Autumn, Winter, 8 turns each. A year is 32 turns. Where you start in the year comes from birth luck. Winter adds Hunger, adds Energy drain outside sheltered ground, and makes Windy Ridge dangerous.

**Life stage** — Juvenile, adult or elder. Juveniles get −1 Strength and Stamina. Elders get −1 Mobility and Stamina. Adulthood starts at the species' adult age, delayed by one turn for every point of Health or Intelligence you raised above baseline. Elder age is fixed per species.

**Maximum age** — The turn at which a run ends in old age: mouse 32, deer 40, wolf 40.

**Turn report** — The summary of one turn: what your action did, what changed when the next turn began, and a **NEW THIS TURN** tag on the new event. It is shown twice: first as the [flashcard](#the-play-screen), then in the Turn log.

---

## The Play screen

One screen, five **panels**. "Screen" is kept for whole screens (menu, prep, birth, play, debrief); the parts of the Play screen are panels.

| Panel | What it holds |
|---|---|
| **Environment panel** | Top. Season, turn and life stage, the place and its blurb, the animal sprites, and the current event (with the **NEW THIS TURN** tag). |
| **Turn log panel** | Under the Environment panel. Newest first: the turn that just began (upkeep, the new event, what it cost you), then the result of your last action (dimmer), then **Earlier**: the last three turns, each as a whole group. |
| **Meters panel** | Health, Hunger, Energy and Safety bars, the six stats, and the goal line. |
| **Surroundings panel** | Food here, your sight tier, and the neighbouring places with their danger and food markers. |
| **Actions panel** | The action buttons (or the travel picker). After each action it shows the flashcard instead. |

**Flashcard** — The result of the action you just took, shown in the Actions panel at the same height as the buttons, then faded up into the Turn log. It carries both halves of the report: the action result with its stat chips, and what the new turn opened with. Its colour follows the outcome: red when you were hurt, green when you came through a threat, gold for a goal moment, amber when the world cost you Health (the heading names the cause and the number, for example "Cold snap: -1 Health"), neutral for a quiet turn. The flashcard replaced the full-screen result flash in v0.5.1.
- **Quiet cards** (no threat, no Health lost, no ending) fade up by themselves after about a second. A thin bar shows the time left.
- **Held cards** (a threat, Health lost, death, victory or old age) wait for a tap, Enter, Space or Escape.
- **Number keys** skip any card. After a quiet card whose next turn is calm, the number key also picks that action. Otherwise it only dismisses the card, so you never choose blind against a threat.
- **Held panels**: while the card is up, the Environment, Turn log, Meters and Surroundings panels keep showing the turn you just left. They swap to the new turn as the card fades up.
- With reduced motion on, the card disappears instantly instead of animating.

**New species flash** — The one remaining full-screen flash: gold, shown just before the debrief when a run unlocks a species. See [Unlock flash](#the-loop).

---

## Stats

Six stats, each with a species baseline and a species cap. Stats are set at birth and do not change during a life, apart from a rare birth quirk.

| Stat | What it does |
|---|---|
| **Mobility** | Fleeing, hunting, chasing. Points above baseline make moves and flights cost more Energy. |
| **Strength** | Fighting, challenges. Points above baseline raise Hunger. |
| **Health** | Maximum HP (3 + 1.5 × Health, rounded), resistance to sickness, faster healing. Points above baseline delay adulthood. |
| **Stamina** | Endurance. Points above baseline raise Hunger. |
| **Intelligence** | Challenging for herd rank. Points above baseline raise Hunger and delay adulthood. |
| **Senses** | Hiding, warning, spotting threats, seeing the world. Points above baseline raise Energy drain. |

**Baseline** — A species' default value for a stat.

**Cap** — The highest a stat can be raised for that species. A mouse can never out-muscle a wolf.

**Floor** — The lowest a stat can go: 1. Lowering a stat below baseline refunds a Gene Point, so you can build a brute, a sprinter or a thinker.

**Upkeep** — The price of raising a stat. Every point above baseline costs something each turn, so you cannot max everything. Strength, Stamina and Intelligence points together add 1 Hunger per turn for every 2 points. Senses points add 1 Energy drain per 2 points. Mobility points add 1 Energy per move for every 2 points. Health and Intelligence points each add a turn before adulthood. The prep screen shows each stat's rule and your build's total, both read from the engine (`upkeepOf` in `run.ts`).

**Build** — A mix of raised and lowered stats and chosen mutations. Examples from playtests: the sprinter (Mobility), the brute (Strength, low Intelligence), the thinker (Intelligence and Senses).

**Build presets** — Optional chips on the prep screen (Balanced, Brute, Sprinter, Thinker) that set the stats in one tap. Each lowers a stat or two for a refund, then spends your Gene Points on its favourite stats up to their caps. You can still adjust afterwards.

**Birth quirk** — On any life after your first, a 12% chance that one random stat shifts by 1 for that life only (60% chance it goes up). Not to be confused with [mutations](#mutations), the traits you pick on the prep screen. Not yet shown to the player.

---

## Needs meters

All run from 0 to 100. Health and Energy are better when high; Hunger is better when low.

**Health (HP)** — Hit points. Maximum comes from the Health stat. At 0 you die. Lost to predator hits, cold, sickness and starvation. Regained by resting and, when well fed, slowly each few turns.

**Hunger** — How hungry you are. Rises every turn, falls when you eat. At 100 you starve: −2 Health per turn. The bar fills red as you get hungrier, and a Hunger chip is green when it drops. The engine still stores this as `satiety` (100 − Hunger), so saves and the sim are unchanged.

**Energy** — Effort budget. Falls with actions, rises with rest. Below certain thresholds some actions are disabled ("Too tired"). At 0 you can only rest.

**Safety** — How calm your surroundings are. Starts at 90 (85 for wolves), falls 16 per threatening predator at your location, rises 4 per point of cover (not for wolves). A live threat drops it to at most 35. Low Safety makes threat events more likely.

**Forage cost** — Energy spent foraging depends on the local food stock: 4 when rich, 5, 7, up to 9 when nearly empty.

---

## Rolls and threats

**Contested roll** — The one rule for every clash. Chance = 50% + 8 points per point of difference between your stat and theirs, clamped to 5%–95%. Roll 1–100; at or below the chance, you win. Cover, mutation bonuses and rank progress add small modifiers.

**Odds readout** — Showing the percentage on risky actions. A perk at account level 2; before that only the stat matchup is shown. The turn report never shows odds.

**Threat responses** — What you can do when a threat appears:
- **Hide** (Senses vs the predator's Senses, +½ cover): freeze and hope it passes.
- **Bolt** (Mobility vs its Mobility, +½ cover): run. The big Energy spend.
- **Stand and fight** (Strength + rank progress/3 vs its Strength): deer and wolf only.
- **Call a warning** (Senses): deer only. Success sends the herd away and raises your rank progress.
- **Keep eating (risky)** (Senses vs its Senses + 2): gamble for a meal.
- **Back down**: wolf only. Safe, but costs a little rank progress.

**Warned** — A threat you caught early because of the Keen Nose mutation. Gives a bonus on hide, warn and risky rolls.

**Hit** — A failed response. The predator strikes for its damage in Health. Hawk and fox 4, wolf pack 6, pack-mate 3.

---

## Birth

**Birth roll** — The random circumstances you spawn into: birthplace, season, litter and neighbours. Shown on the **Birth luck** screen before you begin, as three labelled rows (a one-line legend appears on your first life; tap a row label for more):
- **Season**: when in the year you begin. The later the season, the sooner winter arrives.
- **Start**: how well set up you are. Strong, ordinary or weak (the litter roll).
- **Place**: where you begin, plus how many predators live nearby (the birthplace and neighbours rolls).

**Birth luck** — The title of the birth screen and a summary badge for the birth roll: **lucky**, **average** or **unlucky**. Each roll part scores +1, 0 or −1. Net +2 or more is lucky, −2 or less is unlucky.

| Part | +1 | −1 |
|---|---|---|
| Birthplace | Clover Field | Windy Ridge |
| Season | Spring start | Late autumn start |
| Litter | Strong | Weak |
| Neighbours | Quiet patch | Predator at the edge of its range |

**Litter** — Strong, ordinary or weak (22% / 58% / 20%). Strong: +1 max HP, starts 10 less hungry, and a higher starting rank. Weak: −1 max HP, starts 15 hungrier.

**Neighbours** — Quiet removes predators from your birth location. Predator adds one there.

**Reroll** — Discard a bad birth and roll again, once per life. Unlocked as the **Second Chance** perk at account level 3.

---

## Mutations

**Mutation** — A passive ability carried into a life, tied to one stat, always with a price. Three exist now. Slots: one, or two from account level 4 (the **Second Mutation Slot** perk). When every slot is filled, the unpicked mutations grey out with "Slots full. Unpick one to swap." (Called heirloom traits before v0.5.0.)

| Trait | Stat | Benefit | Price |
|---|---|---|---|
| **Zigzag** | Mobility | +1 on flee rolls | Fleeing costs 4 extra Energy |
| **Keen Nose** | Senses | Catch threats early: +1 on hide, warn and risky rolls; widens your view | +1 Energy drain every turn |
| **Thick Coat** | Health | Ignore winter cold and the ridge wind | +1 Hunger in summer |

**Tier I / Tier II (Awakened)** — A mutation starts at Tier I. After it has helped 10 times (counted across all your lives), it awakens to Tier II and gets stronger: Zigzag +2 on flee, Keen Nose +2 on first response, Thick Coat +1 maximum Health. The prep screen shows the tier badge, "Upgrades at 10 …" with the thing that counts, and a progress bar. Tier II shows no bar. Announced on the debrief.

**Use** — A moment where the mutation actually mattered. Counts toward awakening. Zigzag counts **flees**, Keen Nose counts **early warnings**, Thick Coat counts **cold blasts shrugged off**.

---

## Account progression

One account holds everything. It has no combat stats of its own, so every species still plays differently.

**Account XP and level** — XP is earned from every run and sets your account level. Thresholds for levels 2 to 10: 50, 130, 250, 450, 750, 1150, 1650, 2250, 3000, then +900 per level.

**XP formula** — (time survived + goal progress + goal bonus + new discoveries) × ending bonus × difficulty bonus, rounded. These are the rows on the debrief.
- **Time survived**: 1 point per turn lived.
- **Goal progress**: up to 40 points for progress toward the species goal. Partial credit counts.
- **Goal bonus**: up to 30 points on a win, more the sooner you win.
- **New discoveries**: 10 per new codex entry or new mastery level.
- **Ending bonus**: win ×2, old age ×1.2, death ×1.
- **Difficulty bonus**: mouse ×1.5, deer ×1.0, wolf ×2.0.

**Perk** — A permanent account bonus from a level. They widen options rather than add raw power.

| Level | Perk | Effect |
|---|---|---|
| 2 | Odds Readout | Hit chances shown on risky actions |
| 3 | Second Chance | Reroll a bad birth once per life |
| 4 | Second Mutation Slot | Carry two mutations |
| 5 | Wider View | View of the world starts one tier wider |
| 7 | Far Sight | View gets another tier wider |

**Gene Points (GP)** — A per-species currency spent on the birth screen to raise stats above baseline, up to the cap. One point raises one stat by one. Lowering a stat below baseline refunds a point. Earned per life as that species: 2, plus 3 more for a win. Unspent points are kept. Every species starts with 3; wolf's 3 arrive when it unlocks.

**Mastery** — Per-species experience from living as that species: 1 per turn lived, +15 on a win. Levels at 30, 80 and 160. Each new level counts as a discovery for XP and adds a point of visibility.

**Lives** — Total runs across all species. Birth quirks only start after your first.

**Wins** — Per-species win count. A deer win unlocks wolf.

---

## Codex and unlocks

**Codex** — Your library of what you have learned about each animal: mouse, deer, wolf, hawk, fox. Notes appear as familiarity grows (at 1, 25, 50 and 75). Hawk and fox are listed but not yet playable.

**Familiarity** — A 0–100 meter per codex entry. Fills through experience:

| Experience | Familiarity |
|---|---|
| Killed by it | +2 (the least) |
| Spotted it, or heard it | +4 |
| Watched it hunt | +8 |
| Escaped it | +15 |
| Beat it in a fight, or ate it | +20 |

A single life can add at most 40 to any one meter, so one lucky run cannot unlock a species.

**Codex entry** — A codex animal's first appearance in your codex. A new entry earns a 10-point discovery bonus.

**Unlock** — Opening a new species. Wolf unlocks when its familiarity reaches 100, or when you win a run as a deer.

**Hidden species** — A species with no menu entry that simply appears when earned. Currently only the **mayfly**, found by starting and ending any run within one in-game day (one turn for deer and wolf, two for mouse). Detected and announced, but not playable yet.

---

## Visibility tiers

**Visibility tier** — How much of the hidden world you can see from where you stand, 0 to 3. Shown as "Sight: tier N of 3" in play.

| Tier | You can see |
|---|---|
| 0 | Only your own location |
| 1 | Danger markers on neighbouring places (calm, wary, dangerous) |
| 2 | Food level on neighbouring places (scant, thin, fair, rich). Wolves also see how much deer there is |
| 3 | Which predators are on neighbouring places |

**How you earn tiers** — Visibility points add up, then cap at 3. One point each for: account level 5, account level 7, each mastery level reached for that species (3 available), Senses of 8 or more, carrying the Keen Nose mutation, and average codex familiarity of 40 or more.

---

## Species goals

Each species has a one-sentence win condition.

**Field Mouse** — Raise two litters to weaning. Small prey, 32 turns, two turns a day.
- **Litter / nest**: Breeding needs an adult, cover 2 or more, not too hungry, and enough Energy. A nest holds 1 to 5 **pups** and takes 4 turns of nursing to wean. Leaving abandons the nest; predator hits and hunger kill pups.
- **Mate call**: An event that makes breeding easier and adds a pup.

**Deer** — Rise from herd-mate to leader, then lead the herd to the winter range intact. Herd prey, 40 turns.
- **Herd**: Starts at 8. Falls through wolf attacks, winter cold, hunger. Win needs at least 6 left.
- **Rank**: Your rank in the herd, 1 = leader. Start at 4, or 3 with a strong litter. Leaders and trusted ranks (1 to 3) keep more of the herd alive.
- **Rank progress**: How much the herd trusts you. Rises when you warn successfully, lead, and just by being an adult in a healthy herd. Falls on a failed challenge. Gates each rank-up and adds up to +2 to the roll. (Stored as `standing` in the engine; wolves use it too.)
- **Challenge for rank**: Contest the next rank up. Intelligence + Senses (averaged) against that rank's wit. A failed challenge costs rank progress and a two-turn **cooldown** ("Recovering"). (The action id is still `vie`.)
- **Lead / Follow**: Move toward the Glen. Ranks 1 to 3 lead: the herd follows closely (**cohesion** halves herd losses that turn) and your rank progress grows. Lower ranks follow at the herd's own pace.
- **The Glen**: Sheltered Glen, the winter range. Win by being there as the leader, in winter, age 8 or more, with 6 or more herd-mates.

**Wolf** — Become pack alpha. Pack predator, 40 turns.
- **Pack rank**: Out of 6, 1 = alpha. Start at 5, or 4 with a strong litter.
- **Challenge**: Fight the next rank up on Strength. A loss costs 3 Health, rank progress and a two-turn cooldown.
- **Pack-mate (rival)**: A threat event where a pack-mate tests you. Beating it raises your rank progress.
- **Howl**: A bonding action, small chance of a rank progress gain.
- **Hunt**: Deer are a big meal (Hunger −45) and raise rank progress. Small prey is a snack. **Fresh tracks** give a one-time hunt bonus.

---

## World

**Location** — A node in the world graph, not a free-roaming map. Eight exist: Open Meadow, Clover Field, Birch Edge, Deep Pines, Shallow Ford, Reed Bank, Windy Ridge, Sheltered Glen.

**Biome** — Meadow, forest, river or highlands. Sets which events can appear.

**Food** — Each location's current stock, regrowing by season and eaten down by grazers. Labelled scant, thin, fair or rich.

**Cover** — How hidden you are, from 1 (open) to 5 (dense). Helps hiding and bolting, raises Safety, and is needed for nesting. Hawks avoid dense cover.

**Harsh** — A location that hurts in winter: Windy Ridge. Costs Health unless you have the Thick Coat mutation.

**Sheltered** — A location safe from winter cold: Sheltered Glen.

**Predator** — Hawk, fox, wolf pack, pack-mate. Predators wander between locations toward prey and are what the danger markers show.

---

## Planned terms

None of these are in the engine yet.

**Keystone species** — Rare late additions such as owls, elephants and dolphins, each unlocking a biome of its own. Not in the current build or the codex.

**Listed / Clued / Hidden unlocks** — Three styles of unlock. Listed shows the requirement, clued gives a riddle, hidden has no menu entry. Only listed (wolf) and hidden (mayfly) exist.

**Tier III (Mastered)** — A trait upgrade after a special feat, turning it into a named variant, for example Zigzag into Phantom Weave.

**Random world events** — Storms, floods, wildfires, droughts and quakes that reshape locations for a while.

**Pressure levels** — Harder world variants that open after a species is won, with larger payouts.

**Wider trait pool** — Fifteen more traits in the design doc (Sprinter, Iron Jaw, Second Wind, Trickster and others).

**More species** — Salmon, fox, hawk and mayfly. Fox unlocks by winning as a mouse.

---

## Where the design doc and code differ

The design doc has not yet caught up with these shipped decisions. Worth reconciling when the doc is next updated.

- **Mutations (heirloom traits in the doc) are earned in the doc, free in the build.** The doc has wins and feats awarding a trait. Right now all three are available from the start, limited only by slot count.
- **Visibility inputs.** The doc ties tier 1 to Senses 4 and basic codex entries. The build uses the point system under [Visibility tiers](#visibility-tiers).
- **Stat range.** The doc says every stat runs 1 to 10. Caps are per species (mouse Strength 3, wolf Strength 10).
- **Rank and rank progress.** Deer leadership ranks, rank progress, challenging for rank, cohesion and the stat floor with Gene Point refunds are shipped but not in the doc.
- **Player-facing renames in v0.5.0.** Heirloom to Mutation, Satiety to Hunger (shown inverted), Standing and Place to Rank, Vie for place to Challenge for rank, Start Play to Begin, Begin life to Into the wild, See the debrief to Your legacy, "Your birth" to Birth luck. The doc still uses the old words.
- **Old-age lineage bonus.** The doc mentions a small lineage bonus on old age. Not built; old age only gets ×1.2 XP.
