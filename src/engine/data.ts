import type { EventDef, Location, PredatorDef, PredatorId, SpeciesDef, SpeciesId, TraitId, Perk } from './types';

export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const SEASON_LEN = 8;
export const YEAR_LEN = SEASON_LEN * 4;

export const LOCATIONS: Record<string, Location> = {
  open_meadow: {
    id: 'open_meadow', name: 'Open Meadow', biome: 'meadow', food: 5, cover: 1,
    adj: ['clover_field', 'birch_edge', 'shallow_ford'],
    blurb: 'Wide grass under an open sky. Plenty to eat, nowhere to hide.',
  },
  clover_field: {
    id: 'clover_field', name: 'Clover Field', biome: 'meadow', food: 7, cover: 2,
    adj: ['open_meadow', 'birch_edge', 'reed_bank'],
    blurb: 'Thick clover and seed heads as far as you can see.',
  },
  birch_edge: {
    id: 'birch_edge', name: 'Birch Edge', biome: 'forest', food: 4, cover: 3,
    adj: ['open_meadow', 'clover_field', 'deep_pines'],
    blurb: 'Pale trunks and dappled light where the meadow meets the wood.',
  },
  deep_pines: {
    id: 'deep_pines', name: 'Deep Pines', biome: 'forest', food: 2, cover: 4,
    adj: ['birch_edge', 'windy_ridge', 'sheltered_glen'],
    blurb: 'Dark, quiet, and soft underfoot. Little grows here.',
  },
  shallow_ford: {
    id: 'shallow_ford', name: 'Shallow Ford', biome: 'river', food: 3, cover: 1,
    adj: ['open_meadow', 'reed_bank'],
    blurb: 'Cold water over smooth stones. Everything comes here to drink.',
  },
  reed_bank: {
    id: 'reed_bank', name: 'Reed Bank', biome: 'river', food: 3, cover: 3,
    adj: ['shallow_ford', 'clover_field'],
    blurb: 'Tall reeds hiss in the wind along the river.',
  },
  windy_ridge: {
    id: 'windy_ridge', name: 'Windy Ridge', biome: 'highlands', food: 1, cover: 2,
    adj: ['deep_pines', 'sheltered_glen'],
    blurb: 'Bare rock and thin grass. The wind never stops.', harsh: true,
  },
  sheltered_glen: {
    id: 'sheltered_glen', name: 'Sheltered Glen', biome: 'highlands', food: 3, cover: 4,
    adj: ['windy_ridge', 'deep_pines'],
    blurb: 'A hollow in the hills, shielded from the worst of winter.', sheltered: true,
  },
};

export const LOC_IDS = Object.keys(LOCATIONS);

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  mouse: {
    id: 'mouse', name: 'Field Mouse', emoji: '🐭', role: 'Small prey',
    goal: 'Raise two litters to weaning.',
    difficulty: 1.5,
    baseStats: { mobility: 6, strength: 2, health: 3, stamina: 4, intelligence: 4, senses: 6 },
    caps: { mobility: 8, strength: 3, health: 5, stamina: 6, intelligence: 6, senses: 8 },
    maxAge: 32, adultAt: 5, elderAt: 24,
    drain: { satiety: 6, energy: 4 }, turnsPerDay: 2,
    spawn: { open_meadow: 3, clover_field: 2, birch_edge: 2, shallow_ford: 1, reed_bank: 1, windy_ridge: 0.5 },
    startGp: 3, unlockText: 'Available from the start.',
  },
  deer: {
    id: 'deer', name: 'Deer', emoji: '🦌', role: 'Herd prey',
    goal: 'Rise from herd-mate to leader, then lead the herd to the winter range intact.',
    difficulty: 1.0,
    baseStats: { mobility: 6, strength: 5, health: 6, stamina: 7, intelligence: 4, senses: 6 },
    caps: { mobility: 8, strength: 7, health: 8, stamina: 9, intelligence: 6, senses: 8 },
    maxAge: 40, adultAt: 6, elderAt: 32,
    drain: { satiety: 5, energy: 4 }, turnsPerDay: 1,
    spawn: { open_meadow: 3, clover_field: 2, birch_edge: 2, reed_bank: 1, windy_ridge: 0.5 },
    startGp: 3, unlockText: 'Available from the start.',
  },
  wolf: {
    id: 'wolf', name: 'Wolf', emoji: '🐺', role: 'Pack predator',
    goal: 'Become pack alpha.',
    difficulty: 2.0,
    baseStats: { mobility: 7, strength: 8, health: 6, stamina: 8, intelligence: 6, senses: 7 },
    caps: { mobility: 9, strength: 10, health: 8, stamina: 10, intelligence: 8, senses: 9 },
    maxAge: 40, adultAt: 7, elderAt: 32,
    drain: { satiety: 7, energy: 4 }, turnsPerDay: 1,
    spawn: { birch_edge: 3, deep_pines: 3, open_meadow: 1, windy_ridge: 1 },
    startGp: 3, unlockText: 'Fill the wolf familiarity meter in your codex, or win a run as a deer.',
  },
};

export const PREDATORS: Record<PredatorId, PredatorDef> = {
  hawk: { id: 'hawk', name: 'Hawk', senses: 6, mobility: 8, strength: 3, damage: 4 },
  fox: { id: 'fox', name: 'Fox', senses: 6, mobility: 6, strength: 4, damage: 4 },
  wolf: { id: 'wolf', name: 'Wolf pack', senses: 7, mobility: 7, strength: 8, damage: 6 },
  rival: { id: 'rival', name: 'Pack-mate', senses: 6, mobility: 6, strength: 7, damage: 3 },
};

export const TRAITS: Record<TraitId, { id: TraitId; name: string; stat: string; benefit: string; price: string; tier2: string; unit: string }> = {
  zigzag: {
    id: 'zigzag', name: 'Zigzag', stat: 'Mobility',
    benefit: '+1 on flee rolls', price: 'Fleeing costs extra Energy',
    tier2: 'Awakened: +2 on flee rolls', unit: 'flees',
  },
  keen_nose: {
    id: 'keen_nose', name: 'Keen Nose', stat: 'Senses',
    benefit: 'Catch threats early: +1 on your first response, and a wider view of nearby danger',
    price: 'Costs extra Energy each turn',
    tier2: 'Awakened: +2 on your first response', unit: 'early warnings',
  },
  thick_coat: {
    id: 'thick_coat', name: 'Thick Coat', stat: 'Health',
    benefit: 'Shrug off winter cold', price: 'Hunger rises faster in summer',
    tier2: 'Awakened: +1 maximum Health', unit: 'cold blasts shrugged off',
  },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

/** The first life is always the lowest species in the roster. */
export const FIRST_SPECIES: SpeciesId = 'mouse';

/** Shown once, before the first life. Draft wording; the language pass will finalise it. */
export const INTRO_CARDS: { title: string; emoji: string; text: string }[] = [
  { title: 'One life', emoji: '🐭', text: 'I get one life, and it is short. I eat, I hide, I move on. Sooner or later something finds me.' },
  { title: 'Dying makes me stronger', emoji: '🧬', text: 'When I die, what I learned stays. The next life starts stronger: Gene Points to spend, mutations to carry, a codex that fills.' },
  { title: 'Read the world', emoji: '👁️', text: 'Watch my Hunger, Energy and Safety. Every choice costs something, and danger shows its odds before I act.' },
];
export const TIER2_USES = 10;

export const MASTERY_STEPS = [0, 30, 80, 160];

export const LEVEL_XP = [0, 50, 130, 250, 450, 750, 1150, 1650, 2250, 3000];
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level - 1 < LEVEL_XP.length) return LEVEL_XP[level - 1];
  return LEVEL_XP[LEVEL_XP.length - 1] + (level - LEVEL_XP.length) * 900;
}
export function levelForXp(xp: number): number {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

export const PERKS: Perk[] = [
  { level: 2, name: 'Odds Readout', text: 'Hit chances are shown on each risky action.' },
  { level: 3, name: 'Second Chance', text: 'Reroll a bad birth once per life.' },
  { level: 4, name: 'Second Mutation Slot', text: 'Carry two mutations into a life.' },
  { level: 5, name: 'Wider View', text: 'Your view of the world starts one tier wider.' },
  { level: 7, name: 'Far Sight', text: 'Your view of the world gets another tier wider.' },
];

// Codex notes that unlock as familiarity grows
export const CODEX_NOTES: Record<string, { name: string; emoji: string; notes: [number, string][] }> = {
  mouse: { name: 'Field Mouse', emoji: '🐭', notes: [
    [1, 'Small, quick, and everywhere there are seeds.'],
    [25, 'Mice freeze when a shadow passes. Predators know it.'],
    [50, 'They nest where cover is thick and feed in the open at dawn.'],
    [75, 'A mouse can usually be caught with a short sprint.'],
  ] },
  deer: { name: 'Deer', emoji: '🦌', notes: [
    [1, 'Grazers that move in herds.'],
    [25, 'The herd bolts together, and stragglers get picked off.'],
    [50, 'They head for sheltered ground before the first snow.'],
    [75, 'A deer\'s kick can break a wolf\'s ribs. Pick the weak.'],
  ] },
  wolf: { name: 'Wolf', emoji: '🐺', notes: [
    [1, 'A pack hunter, patient and loud at dusk.'],
    [25, 'Wolves test the herd and chase whatever lags.'],
    [50, 'They hunt the forest edge and the river reeds.'],
    [75, 'A pack keeps a strict order, and the order can be challenged.'],
  ] },
  hawk: { name: 'Hawk', emoji: '🦅', notes: [
    [1, 'A shadow on the grass is the only warning you get.'],
    [25, 'Hawks hunt open ground and avoid dense cover.'],
    [50, 'They strike from above and rarely chase through brush.'],
    [75, 'A hawk circles before it dives. Hide when the shadow stops.'],
  ] },
  fox: { name: 'Fox', emoji: '🦊', notes: [
    [1, 'A low russet shape slipping through cover.'],
    [25, 'Foxes stalk, then pounce from a short distance.'],
    [50, 'They patrol the forest edge at dusk.'],
    [75, 'Foxes tire quickly in a long chase.'],
  ] },
};

export const EVENTS: EventDef[] = [
  // Threats
  { id: 'hawk_shadow', name: 'Hawk Overhead', kind: 'threat', pred: 'hawk', weight: 6, species: ['mouse'],
    biomes: ['meadow', 'river', 'highlands'], maxCover: 3,
    text: 'A shadow slides across the grass. A hawk is circling above {loc}.' },
  { id: 'fox_stalk', name: 'Fox on the Prowl', kind: 'threat', pred: 'fox', weight: 5, species: ['mouse'],
    biomes: ['meadow', 'forest', 'river'],
    text: 'Something low and russet is slinking through the cover at {loc}. A fox.' },
  { id: 'wolf_pack_deer', name: 'Wolves Near the Herd', kind: 'threat', pred: 'wolf', weight: 10, species: ['deer'],
    biomes: ['meadow', 'forest', 'highlands'],
    text: 'The herd goes still. A wolf pack has your scent at {loc}.' },
  { id: 'wolf_river', name: 'Wolves in the Reeds', kind: 'threat', pred: 'wolf', weight: 6, species: ['deer'],
    biomes: ['river'],
    text: 'Grey shapes wait in the reeds near the water at {loc}.' },
  { id: 'rival_wolf', name: 'A Pack-mate Bristles', kind: 'threat', pred: 'rival', weight: 4, species: ['wolf'],
    minAge: 4, text: 'A pack-mate blocks your path, hackles up, testing your place in the order.' },
  // Windfalls
  { id: 'seed_fall', name: 'Seed Fall', kind: 'windfall', weight: 3, species: ['mouse'],
    biomes: ['meadow', 'forest'], seasons: [1, 2],
    text: 'A seed pod bursts and scatters a feast across {loc}.' },
  { id: 'clover_flush', name: 'Clover Flush', kind: 'windfall', weight: 3, species: ['deer'],
    biomes: ['meadow'], seasons: [0, 1],
    text: 'Fresh clover has flushed green across {loc}.' },
  { id: 'berries', name: 'Ripe Berries', kind: 'windfall', weight: 3, species: ['mouse', 'deer'],
    biomes: ['forest'], seasons: [1, 2],
    text: 'Heavy berry bushes line the path at {loc}.' },
  { id: 'carcass', name: 'Fresh Carcass', kind: 'windfall', weight: 2, species: ['wolf'],
    seasons: [2, 3],
    text: 'A winter-killed deer lies near {loc}, easy meat.' },
  // Weather / hazards
  { id: 'cold_snap', name: 'Cold Snap', kind: 'weather', effect: 'cold', weight: 3, seasons: [2, 3],
    text: 'A hard cold sweeps across {loc}.' },
  { id: 'rain_storm', name: 'Rain Storm', kind: 'weather', effect: 'rain', weight: 3, seasons: [0, 1, 2],
    text: 'Rain hammers {loc}. Tracks wash away and everyone keeps their head down.' },
  { id: 'sickness', name: 'Sickness', kind: 'hazard', effect: 'sick', weight: 1.5, seasons: [1, 2],
    text: 'A sickness is moving through the animals around {loc}.' },
  // Social / sight
  { id: 'mate_call', name: 'A Mate Calls', kind: 'social', effect: 'mate', weight: 3, species: ['mouse'],
    seasons: [0, 1, 2], minAge: 5,
    text: 'A mate is squeaking from the grass near {loc}.' },
  { id: 'witness_hunt', name: 'A Distant Hunt', kind: 'sight', effect: 'witness', weight: 2.5, species: ['mouse', 'deer'],
    biomes: ['meadow', 'forest'],
    text: 'Far off across {loc} you watch a hunt play out.' },
  { id: 'distant_howl', name: 'Distant Howling', kind: 'sight', effect: 'howl', weight: 2, species: ['mouse', 'deer'],
    text: 'Wolves are howling somewhere beyond {loc}.' },
  { id: 'fresh_tracks', name: 'Fresh Tracks', kind: 'sight', effect: 'tracks', weight: 2, species: ['wolf'],
    text: 'Fresh deer tracks cross {loc}. The trail is clear.' },
  // Quiet
  { id: 'quiet_day', name: 'A Quiet Turn', kind: 'quiet', weight: 8,
    text: 'Nothing stirs around {loc}.' },
  { id: 'sunny', name: 'Warm Light', kind: 'quiet', effect: 'sun', weight: 3, seasons: [0, 1],
    text: 'Warm light settles over {loc}. You feel loose and rested.' },
  { id: 'still_air', name: 'Still Air', kind: 'quiet', weight: 4,
    text: 'The air is still. {loc} is calm for now.' },
];
