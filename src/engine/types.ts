export type Stat = 'mobility' | 'strength' | 'health' | 'stamina' | 'intelligence' | 'senses';
export const STATS: Stat[] = ['mobility', 'strength', 'health', 'stamina', 'intelligence', 'senses'];
export const STAT_LABEL: Record<Stat, string> = {
  mobility: 'Mobility',
  strength: 'Strength',
  health: 'Health',
  stamina: 'Stamina',
  intelligence: 'Intelligence',
  senses: 'Senses',
};

export type SpeciesId = 'mouse' | 'deer' | 'wolf';
export type CodexId = 'mouse' | 'deer' | 'wolf' | 'hawk' | 'fox';
export type PredatorId = 'hawk' | 'fox' | 'wolf' | 'rival';
export type Biome = 'meadow' | 'forest' | 'river' | 'highlands';
export type TraitId = 'zigzag' | 'keen_nose' | 'thick_coat';
export type Stage = 'juvenile' | 'adult' | 'elder';

export interface Location {
  id: string;
  name: string;
  biome: Biome;
  food: number; // baseline food richness
  cover: number; // 1 (open) .. 5 (dense)
  adj: string[];
  blurb: string;
  harsh?: boolean; // brutal in winter
  sheltered?: boolean; // safe from winter cold
}

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  emoji: string;
  role: string;
  goal: string;
  difficulty: number; // payout multiplier
  baseStats: Record<Stat, number>;
  caps: Record<Stat, number>;
  maxAge: number;
  adultAt: number;
  elderAt: number;
  drain: { satiety: number; energy: number };
  turnsPerDay: number;
  spawn: Record<string, number>;
  startGp: number;
  unlockText: string;
}

export interface PredatorDef {
  id: PredatorId;
  name: string;
  senses: number;
  mobility: number;
  strength: number;
  damage: number;
}

export type EventKind = 'threat' | 'windfall' | 'weather' | 'hazard' | 'social' | 'sight' | 'quiet';
export type EventEffect = 'cold' | 'rain' | 'sick' | 'mate' | 'witness' | 'howl' | 'tracks' | 'sun';

export interface EventDef {
  id: string;
  name: string;
  kind: EventKind;
  text: string;
  weight: number;
  species?: SpeciesId[];
  biomes?: Biome[];
  seasons?: number[];
  maxCover?: number;
  minAge?: number;
  pred?: PredatorId;
  effect?: EventEffect;
}

export interface ActiveEvent {
  id: string;
  name: string;
  text: string;
  kind: EventKind;
  pred?: PredatorId;
  warned?: boolean;
}

export interface BirthRoll {
  seed: number;
  loc: string;
  startOffset: number;
  litter: 'strong' | 'ordinary' | 'weak';
  neighbours: 'quiet' | 'normal' | 'predator';
  lines: string[];
  luck: 'lucky' | 'average' | 'unlucky';
}

export interface World {
  food: Record<string, number>;
  mouse: Record<string, number>;
  deer: Record<string, number>;
  preds: { id: PredatorId; loc: string }[];
}

export interface RunEnd {
  type: 'win' | 'death' | 'old_age';
  cause: string;
  killedBy?: CodexId;
}

export interface Snap {
  hp: number;
  satiety: number;
  energy: number;
  herd: number;
}

export interface TurnReport {
  turn: number;
  action: string;
  resolve: string[];
  arrival: string[];
  before: Snap;
  afterAction: Snap;
  afterArrival: Snap;
  threat?: { name: string; pred: PredatorId; outcome: 'safe' | 'hurt' | 'killed' };
  newEvent?: string;
}

export interface RunState {
  species: SpeciesId;
  rng: number;
  age: number; // completed turns
  turnsTaken: number;
  startOffset: number;
  loc: string;
  stats: Record<Stat, number>;
  traits: TraitId[];
  traitTiers: Record<string, number>;
  traitUsesRun: Record<string, number>;
  hp: number;
  hpMod: number;
  satiety: number;
  energy: number;
  safety: number;
  event: ActiveEvent | null;
  world: World;
  birth: BirthRoll;
  mutation: string | null;
  // goal state
  herd: number;
  rank: number;
  standing: number;
  cooldown: number;
  nest: { pups: number; turnsLeft: number; loc: string } | null;
  litters: number;
  mateCall: boolean;
  trackBonus: boolean;
  cohesion: boolean;
  // bookkeeping
  famGain: Partial<Record<CodexId, number>>;
  famNotes: string[];
  last: string[];
  history: string[];
  ended: RunEnd | null;
  visibilityTier: number;
  showOdds: boolean;
  report: TurnReport | null;
}

export interface Perk {
  level: number;
  name: string;
  text: string;
}

export interface Account {
  version: 1;
  xp: number;
  level: number;
  lives: number;
  unlocked: Record<SpeciesId, boolean>;
  hiddenFound: { mayfly: boolean };
  codex: Record<CodexId, number>;
  mastery: Record<SpeciesId, number>;
  gp: Record<SpeciesId, number>;
  wins: Record<SpeciesId, number>;
  traitUses: Record<TraitId, number>;
}

export interface Action {
  id: string;
  label: string;
  hint?: string;
  disabled?: string;
  targets?: { id: string; label: string }[];
}

export interface Neighbour {
  id: string;
  name: string;
  danger?: 'calm' | 'wary' | 'dangerous';
  food?: string;
  prey?: string;
  predators?: string[];
}

export interface RunView {
  locName: string;
  biome: Biome;
  blurb: string;
  seasonName: string;
  turn: number;
  maxTurns: number;
  stage: Stage;
  hp: number;
  maxHp: number;
  satiety: number;
  energy: number;
  safety: number;
  stats: Record<Stat, number>;
  event: ActiveEvent | null;
  actions: Action[];
  neighbours: Neighbour[];
  tier: number;
  herd?: number;
  rank?: number;
  standing?: number;
  nest?: { pups: number; turnsLeft: number } | null;
  litters?: number;
  foodHere: string;
  goalLine: string;
}

export interface PayoutBreakdown {
  survival: number;
  goal: number;
  feats: number;
  discoveries: number;
  endingMult: number;
  difficulty: number;
  xp: number;
  gpGain: number;
}

export interface DebriefReport {
  species: SpeciesId;
  end: RunEnd;
  turns: number;
  payout: PayoutBreakdown;
  levelBefore: number;
  levelAfter: number;
  newPerks: Perk[];
  famChanges: { id: CodexId; before: number; after: number; gained: number }[];
  masteryBefore: number;
  masteryAfter: number;
  unlocks: string[];
  traitTierUps: string[];
  notes: string[];
}
