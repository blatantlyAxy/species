import {
  CODEX_NOTES, EVENTS, LOCATIONS, PREDATORS, SEASON_NAMES, SPECIES, TIER2_USES, TRAITS, MASTERY_STEPS,
} from './data';
import { clamp, nextRand, seededRand, weightedPick } from './rng';
import {
  countPred, initWorld, pathStep, seasonOf, threatsAt, worldStep,
} from './world';
import type {
  Account, Action, ActiveEvent, BirthRoll, CodexId, EventDef, Neighbour, PredatorDef, RunState,
  RunView, SpeciesId, Snap, Stage, Stat, TraitId, TurnReport,
} from './types';
import { STATS, STAT_LABEL } from './types';

const GLEN = 'sheltered_glen';
const NPC_STR: Record<number, number> = { 1: 10, 2: 9, 3: 9, 4: 8 };

// ---------- helpers ----------

const rnd = (run: RunState) => nextRand(run);

/** A trusted lead keeps the herd together. */
function keep(run: RunState): number {
  return run.rank <= 1 ? 0.3 : run.rank <= 3 ? 0.6 : 1;
}

function say(run: RunState, s: string) {
  run.last.push(s);
}

export function stageOf(run: RunState): Stage {
  const d = SPECIES[run.species];
  const shift = upkeepOf(run.species, run.stats).growUp;
  if (run.age < d.adultAt + shift) return 'juvenile';
  if (run.age < d.elderAt) return 'adult';
  return 'elder';
}

export function effStat(run: RunState, s: Stat): number {
  let v = run.stats[s];
  const st = stageOf(run);
  if (st === 'juvenile' && (s === 'strength' || s === 'stamina')) v -= 1;
  if (st === 'elder' && (s === 'mobility' || s === 'stamina')) v -= 1;
  return Math.max(1, v);
}

const hasTrait = (run: RunState, t: TraitId) => run.traits.includes(t);
const tierOf = (run: RunState, t: TraitId) => run.traitTiers[t] ?? 1;
function useTrait(run: RunState, t: TraitId) {
  run.traitUsesRun[t] = (run.traitUsesRun[t] ?? 0) + 1;
}

export function maxHpOf(run: RunState): number {
  return (
    Math.round(3 + 1.5 * run.stats.health) + run.hpMod + (hasTrait(run, 'thick_coat') && tierOf(run, 'thick_coat') >= 2 ? 1 : 0)
  );
}

const above = (stats: Record<Stat, number>, species: SpeciesId, s: Stat) =>
  Math.max(0, stats[s] - SPECIES[species].baseStats[s]);

export interface Upkeep {
  /** Extra Hunger gained each turn (Strength, Stamina and Intelligence above baseline). */
  hunger: number;
  /** Extra Energy lost each turn (Senses above baseline). */
  energy: number;
  /** Extra Energy per move, flee or hunt (Mobility above baseline). */
  move: number;
  /** Extra turns before adulthood (Health and Intelligence above baseline). */
  growUp: number;
}

/** The price of raised stats. The engine and the prep screen both read this. */
export function upkeepOf(species: SpeciesId, stats: Record<Stat, number>): Upkeep {
  return {
    hunger: Math.floor((above(stats, species, 'strength') + above(stats, species, 'stamina') + above(stats, species, 'intelligence')) / 2),
    energy: Math.floor(above(stats, species, 'senses') / 2),
    move: Math.floor(above(stats, species, 'mobility') / 2),
    growUp: above(stats, species, 'health') + above(stats, species, 'intelligence'),
  };
}

/** What one stat costs on its own, with every other stat at baseline. */
export function statUpkeep(species: SpeciesId, stat: Stat, value: number): Upkeep {
  const base = { ...SPECIES[species].baseStats };
  base[stat] = value;
  return upkeepOf(species, base);
}

function moveExtra(run: RunState): number {
  return upkeepOf(run.species, run.stats).move;
}

function addFam(run: RunState, id: CodexId, n: number, why: string) {
  const cur = run.famGain[id] ?? 0;
  const add = Math.min(n, 40 - cur);
  if (add <= 0) return;
  run.famGain[id] = cur + add;
  run.famNotes.push(`${CODEX_NOTES[id].name} familiarity +${add} (${why})`);
}

function clash(run: RunState, a: number, d: number, label: string) {
  const chance = clamp(50 + 8 * (a - d), 5, 95);
  const roll = 1 + Math.floor(rnd(run) * 100);
  const ok = roll <= chance;
  return { ok, chance, roll };
}

function die(run: RunState, cause: string, killedBy?: CodexId) {
  if (run.ended) return;
  run.ended = { type: 'death', cause, killedBy };
  say(run, `You die. ${cause}`);
}

function energyCost(run: RunState, n: number) {
  run.energy = clamp(run.energy - n, 0, 100);
}

function gainSatiety(run: RunState, n: number) {
  run.satiety = clamp(run.satiety + n, 0, 100);
}

/** Record Health lost to the world, so the turn report can name the cause. */
function envHit(run: RunState, cause: string, chip: string, hp: number) {
  (run.envHits ??= []).push({ cause, chip, hp });
}

function heal(run: RunState, n: number) {
  run.hp = Math.min(maxHpOf(run), run.hp + n);
}

// ---------- birth and start ----------

const SEASON_BIRTH = [
  'Spring: mild weather and a long season ahead.',
  'Summer: plenty to eat, but the cold is coming.',
  'Autumn: winter is on its way.',
  'Late autumn: winter arrives within a few turns.',
];

const LITTER_LINE = {
  strong: 'A strong start: well fed, with family close by.',
  ordinary: 'An ordinary start: no head start, no handicap.',
  weak: 'A weak start: small, hungry, and short on help.',
};
const NEIGHBOUR_LINE = {
  quiet: 'A quiet patch with few predators about.',
  normal: '',
  predator: 'You were born at the edge of a predator\'s range.',
};

function placeLine(loc: string): string {
  const L = LOCATIONS[loc];
  if (loc === 'clover_field') return `Born in ${L.name}: food everywhere and cover close by.`;
  if (loc === 'windy_ridge') return `Born on ${L.name}: barren, exposed, and far from anything to eat.`;
  return `Born at ${L.name}. ${L.blurb}`;
}

export type BirthRowLabel = 'Season' | 'Start' | 'Place';

/** The birth panel as three labelled rows. Built from the same lines the birth roll writes. */
export function birthRows(birth: BirthRoll): { label: BirthRowLabel; text: string }[] {
  const si = birth.startOffset === 0 ? 0 : birth.startOffset === 8 ? 1 : birth.startOffset === 16 ? 2 : 3;
  const place = [placeLine(birth.loc), NEIGHBOUR_LINE[birth.neighbours]].filter(Boolean).join(' ');
  return [
    { label: 'Season', text: SEASON_BIRTH[si] },
    { label: 'Start', text: LITTER_LINE[birth.litter] },
    { label: 'Place', text: place },
  ];
}

export function rollBirth(species: SpeciesId, seed: number): BirthRoll {
  const r = seededRand(seed);
  const def = SPECIES[species];
  const loc = weightedPick(Object.entries(def.spawn).map(([k, w]) => ({ w, v: k })), r())!;
  const sr = r();
  const startOffset = sr < 0.5 ? 0 : sr < 0.75 ? 8 : sr < 0.92 ? 16 : 22;
  const lr = r();
  const litter = lr < 0.22 ? 'strong' : lr < 0.8 ? 'ordinary' : 'weak';
  const nr = r();
  const neighbours = nr < 0.2 ? 'quiet' : nr < 0.8 ? 'normal' : 'predator';

  let pts = 0;
  const lines: string[] = [];
  if (loc === 'clover_field') pts++;
  else if (loc === 'windy_ridge') pts--;
  lines.push(placeLine(loc));
  const si = startOffset === 0 ? 0 : startOffset === 8 ? 1 : startOffset === 16 ? 2 : 3;
  if (si === 0) pts++;
  if (si === 3) pts--;
  lines.push(SEASON_BIRTH[si]);
  if (litter === 'strong') { pts++; lines.push(LITTER_LINE.strong); }
  if (litter === 'weak') { pts--; lines.push(LITTER_LINE.weak); }
  if (neighbours === 'quiet') { pts++; lines.push(NEIGHBOUR_LINE.quiet); }
  if (neighbours === 'predator') { pts--; lines.push(NEIGHBOUR_LINE.predator); }
  const luck = pts >= 2 ? 'lucky' : pts <= -2 ? 'unlucky' : 'average';
  return { seed, loc, startOffset, litter, neighbours, lines, luck };
}

export function visibilityFor(account: Account, species: SpeciesId, stats: Record<Stat, number>, traits: TraitId[]): number {
  let pts = 0;
  if (account.level >= 5) pts++;
  if (account.level >= 7) pts++;
  const m = account.mastery[species];
  pts += MASTERY_STEPS.filter((s) => m >= s && s > 0).length;
  if (stats.senses >= 8) pts++;
  if (traits.includes('keen_nose')) pts++;
  const known = Object.values(account.codex).reduce((a, b) => a + b, 0) / 5;
  if (known >= 40) pts++;
  return clamp(pts, 0, 3);
}

export function traitSlots(account: Account): number {
  return account.level >= 4 ? 2 : 1;
}

export const STAT_FLOOR = 1;

export function startRun(
  account: Account,
  species: SpeciesId,
  invest: Partial<Record<Stat, number>>,
  traits: TraitId[],
  birth: BirthRoll,
  seed: number,
): { account: Account; run: RunState } {
  const def = SPECIES[species];
  if (!account.unlocked[species]) throw new Error('Species is locked.');
  const acc: Account = structuredClone(account);
  const stats = { ...def.baseStats };
  let spent = 0;
  for (const s of STATS) {
    const n = Math.floor(invest[s] ?? 0);
    const room = def.caps[s] - def.baseStats[s];
    const add = Math.max(STAT_FLOOR - def.baseStats[s], Math.min(n, room));
    stats[s] += add;
    spent += add;
  }
  if (spent > acc.gp[species]) throw new Error('Not enough Gene Points.');
  acc.gp[species] -= spent;

  const run: RunState = {
    species, rng: seed >>> 0, age: 0, turnsTaken: 0, startOffset: birth.startOffset, loc: birth.loc,
    stats, traits: traits.slice(0, traitSlots(acc)), traitTiers: {}, traitUsesRun: {},
    hp: 1, hpMod: birth.litter === 'strong' ? 1 : birth.litter === 'weak' ? -1 : 0,
    satiety: 70 + (birth.litter === 'strong' ? 10 : birth.litter === 'weak' ? -15 : 0),
    energy: 80, safety: 80, event: null,
    world: undefined as never, birth, mutation: null,
    herd: 8, rank: species === 'deer' ? (birth.litter === 'strong' ? 3 : 4) : birth.litter === 'strong' ? 4 : 5, standing: 0, cooldown: 0,
    nest: null, litters: 0, mateCall: false, trackBonus: false, cohesion: false,
    famGain: {}, famNotes: [], last: [], history: [], ended: null, visibilityTier: 0,
    showOdds: acc.level >= 2, report: null,
  };
  for (const t of run.traits) run.traitTiers[t] = (acc.traitUses[t] ?? 0) >= TIER2_USES ? 2 : 1;

  // mutation
  if (acc.lives > 0 && rnd(run) < 0.12) {
    const s = STATS[Math.floor(rnd(run) * STATS.length)];
    const up = rnd(run) < 0.6;
    run.stats[s] = clamp(run.stats[s] + (up ? 1 : -1), 1, 12);
    run.mutation = `Birth quirk: ${STAT_LABEL[s]} ${up ? '+1' : '-1'} for this life.`;
  }
  run.hp = maxHpOf(run);
  run.world = initWorld(() => rnd(run), birth, species);
  run.visibilityTier = visibilityFor(acc, species, run.stats, run.traits);
  say(run, `${SPECIES[species].name}, ${birth.lines[0].charAt(0).toLowerCase()}${birth.lines[0].slice(1)}`);
  const bornLines = run.last;
  run.last = [];
  const snap0 = snapOf(run);
  beginTurn(run, true);
  run.report = {
    turn: 0, action: 'Born', resolve: bornLines, arrival: run.last, before: snap0, afterAction: snap0,
    afterArrival: snapOf(run), newEvent: run.event?.name,
  };
  run.last = bornLines;
  run.history.push(...bornLines, ...run.report.arrival);
  return { account: acc, run };
}

// ---------- turn start: upkeep and event ----------

function beginTurn(run: RunState, first = false) {
  const def = SPECIES[run.species];
  const loc = LOCATIONS[run.loc];
  const season = seasonOf(run);
  if (!first) {
    const upkeep = upkeepOf(run.species, run.stats);
    let drain = def.drain.satiety + upkeep.hunger;
    if (season === 3) drain += 2;
    if (hasTrait(run, 'thick_coat') && season === 1) drain += 1;
    gainSatiety(run, -drain);
    let eDrain = def.drain.energy + upkeep.energy;
    if (hasTrait(run, 'keen_nose')) eDrain += 1;
    if (season === 3 && !loc.sheltered) eDrain += 1;
    energyCost(run, eDrain);
    say(run, `Time passes: Hunger +${drain}, Energy -${eDrain}.`);

    if (run.satiety <= 0) {
      run.hp -= 2;
      envHit(run, 'Starving', 'starving', 2);
      say(run, 'You are starving. -2 Health.');
      if (run.hp <= 0) { die(run, 'You starved.'); return; }
    }
    if (season === 3 && loc.harsh) {
      if (hasTrait(run, 'thick_coat')) {
        useTrait(run, 'thick_coat');
        say(run, 'Your thick coat blunts the bitter wind.');
      } else {
        run.hp -= 1;
        envHit(run, 'Bitter wind', 'wind', 1);
        say(run, 'The bitter wind bites. -1 Health.');
        if (run.hp <= 0) { die(run, 'You froze on the ridge.'); return; }
      }
      if (run.species === 'deer' && run.herd > 1 && rnd(run) < 0.5 * keep(run)) {
        run.herd--;
        say(run, 'A herd-mate falls to the cold.');
      }
    } else if (run.species === 'deer' && season === 3 && !loc.sheltered && run.herd > 1 && rnd(run) < 0.2 * keep(run)) {
      run.herd--;
      say(run, 'A weak herd-mate fails in the winter.');
    }
    if (run.species === 'deer' && run.satiety < 20 && run.herd > 1 && rnd(run) < 0.2 * keep(run)) {
      run.herd--;
      say(run, 'A hungry herd-mate drops behind.');
    }
    if (run.nest && run.satiety < 15) {
      run.nest.pups--;
      say(run, 'A pup weakens from hunger.');
      if (run.nest.pups <= 0) { run.nest = null; say(run, 'The nest is empty.'); }
    }
    // passive regeneration
    if (run.satiety >= 60 && run.age % (run.stats.health >= 5 ? 2 : 3) === 0) heal(run, 1);
  }

  // safety meter
  const threatCount = threatsAt(run.world, run.loc, run.species).length;
  run.safety = clamp(
    (run.species === 'wolf' ? 85 : 90) - 16 * threatCount + 4 * (run.species === 'wolf' ? 0 : loc.cover),
    0, 100,
  );

  drawEvent(run);
}

function eligibleEvents(run: RunState): { w: number; v: EventDef }[] {
  const loc = LOCATIONS[run.loc];
  const season = seasonOf(run);
  const out: { w: number; v: EventDef }[] = [];
  for (const e of EVENTS) {
    if (e.species && !e.species.includes(run.species)) continue;
    if (e.biomes && !e.biomes.includes(loc.biome)) continue;
    if (e.seasons && !e.seasons.includes(season)) continue;
    if (e.maxCover !== undefined && loc.cover > e.maxCover) continue;
    if (e.minAge !== undefined && run.age < e.minAge) continue;
    let w = e.weight;
    if (e.kind === 'threat' && e.pred && e.pred !== 'rival') {
      w *= (0.15 + countPred(run.world, run.loc, e.pred) * 0.5) * (run.species === 'deer' ? 2.6 : 1);
      w *= clamp(1 + (60 - run.safety) / 100, 0.6, 1.6);
    }
    if (e.kind === 'windfall' && e.id !== 'carcass' && run.world.food[run.loc] < 2) w *= 0.3;
    out.push({ w, v: e });
  }
  return out;
}

function drawEvent(run: RunState) {
  const def = weightedPick(eligibleEvents(run), rnd(run));
  const loc = LOCATIONS[run.loc];
  if (!def) { run.event = null; return; }
  const ev: ActiveEvent = {
    id: def.id, name: def.name, kind: def.kind, pred: def.pred,
    text: def.text.replace('{loc}', loc.name),
  };
  run.event = ev;
  if (def.kind === 'threat') {
    if (hasTrait(run, 'keen_nose')) {
      ev.warned = true;
      useTrait(run, 'keen_nose');
      say(run, 'Your keen nose catches it early.');
    }
    if (def.pred && def.pred !== 'rival') run.safety = Math.min(run.safety, 35);
  }
  switch (def.effect) {
    case 'cold':
      if (!loc.sheltered) {
        if (hasTrait(run, 'thick_coat')) {
          useTrait(run, 'thick_coat');
          say(run, 'Your thick coat shrugs off the cold.');
        } else {
          run.hp -= 1;
          energyCost(run, 8);
          envHit(run, 'Cold snap', 'cold', 1);
          say(run, 'The cold gets into you. -1 Health, -8 Energy.');
          if (run.hp <= 0) die(run, 'You froze.');
        }
      } else say(run, 'The glen keeps the worst of the cold off.');
      break;
    case 'rain':
      energyCost(run, 6);
      break;
    case 'sick': {
      const c = clash(run, effStat(run, 'health'), 5, 'Health vs sickness');
      if (!c.ok) {
        run.hp -= 3;
        energyCost(run, 10);
        envHit(run, 'Sickness', 'sickness', 3);
        say(run, 'The sickness takes hold. -3 Health, -10 Energy.');
        if (run.hp <= 0) die(run, 'You succumbed to sickness.');
      } else say(run, 'You shrug the sickness off.');
      break;
    }
    case 'mate': run.mateCall = true; break;
    case 'witness': {
      const id: CodexId = run.species === 'mouse' ? 'hawk' : 'wolf';
      addFam(run, id, 8, 'watched it hunt');
      break;
    }
    case 'howl': addFam(run, 'wolf', 4, 'heard it'); break;
    case 'tracks': run.trackBonus = true; break;
    case 'sun': energyCost(run, -4); break;
    default: break;
  }
}

// ---------- actions ----------

function foodLabel(stock: number, max: number): string {
  const r = stock / Math.max(1, max);
  return r < 0.15 ? 'scant' : r < 0.45 ? 'thin' : r < 0.75 ? 'fair' : 'rich';
}

function preyLabel(n: number): string {
  return n < 0.8 ? 'none' : n < 2 ? 'few' : n < 3.5 ? 'some' : 'many';
}

function threatParams(run: RunState, resp: string, pred: PredatorDef, warned: boolean) {
  const cover = LOCATIONS[run.loc].cover;
  const nose = warned ? (tierOf(run, 'keen_nose') >= 2 ? 2 : 1) : 0;
  const zig = hasTrait(run, 'zigzag') ? (tierOf(run, 'zigzag') >= 2 ? 2 : 1) : 0;
  switch (resp) {
    case 'hide': return { a: effStat(run, 'senses') + Math.floor(cover / 2) + nose, d: pred.senses, label: 'Senses' };
    case 'bolt': return { a: effStat(run, 'mobility') + Math.floor(cover / 2) + zig, d: pred.mobility, label: 'Mobility' };
    case 'fight': return { a: effStat(run, 'strength') + Math.floor(run.standing / 3), d: pred.strength, label: 'Strength' };
    case 'warn': return { a: effStat(run, 'senses') + nose, d: pred.senses, label: 'Senses' };
    case 'risky': return { a: effStat(run, 'senses') + nose, d: pred.senses + 2, label: 'Senses' };
    default: return { a: 0, d: 0, label: '' };
  }
}

export function getActions(run: RunState): Action[] {
  if (run.ended) return [];
  const loc = LOCATIONS[run.loc];
  const season = seasonOf(run);
  const stage = stageOf(run);
  const def = SPECIES[run.species];
  const ev = run.event;
  const acts: Action[] = [];
  const odds = (resp: string, pred: PredatorDef) => {
    const p = threatParams(run, resp, pred, !!ev?.warned);
    const chance = clamp(50 + 8 * (p.a - p.d), 5, 95);
    return run.showOdds ? `${p.label} vs ${pred.name} (${chance}%)` : `${p.label} vs ${pred.name}`;
  };

  if (ev && ev.kind === 'threat' && ev.pred) {
    const pred = PREDATORS[ev.pred];
    const tired = run.energy < 10;
    if (run.species === 'wolf') {
      acts.push({ id: 'fight', label: 'Stand your ground', hint: odds('fight', pred) });
      acts.push({ id: 'submit', label: 'Back down', hint: 'Costs a little rank.' });
      acts.push({ id: 'bolt', label: 'Slip away', hint: odds('bolt', pred), disabled: tired ? 'Too tired' : undefined });
      return acts;
    }
    acts.push({
      id: 'hide', label: run.species === 'mouse' ? 'Freeze and hide' : 'Stand still in cover', hint: odds('hide', pred),
    });
    acts.push({
      id: 'bolt', label: run.species === 'mouse' ? 'Bolt for cover' : 'Bolt with the herd',
      hint: odds('bolt', pred), disabled: tired ? 'Too tired' : undefined,
    });
    if (run.species === 'deer') {
      acts.push({ id: 'fight', label: 'Stand and fight', hint: odds('fight', pred), disabled: tired ? 'Too tired' : undefined });
      acts.push({ id: 'warn', label: 'Call a warning to the herd', hint: odds('warn', pred) });
    }
    acts.push({ id: 'risky', label: 'Keep eating (risky)', hint: odds('risky', pred) });
    return acts;
  }

  // forced rest when exhausted
  const exhausted = run.energy <= 0;

  if (run.species === 'wolf') {
    const deerHere = run.world.deer[run.loc];
    const mouseHere = run.world.mouse[run.loc];
    if (ev?.id === 'carcass') acts.push({ id: 'scavenge', label: 'Feast on the carcass', hint: 'Safe. Big meal.' });
    acts.push({
      id: 'hunt_deer', label: 'Hunt deer',
      hint: 'Your Mobility + Strength vs the deer\'s.',
      disabled: exhausted || run.energy < 15 ? 'Too tired' : deerHere < 1 ? 'No deer here' : undefined,
    });
    acts.push({ id: 'hunt_small', label: 'Hunt small prey', hint: 'Easy, small meal', disabled: exhausted ? 'Too tired' : mouseHere < 0.8 ? 'Nothing here' : undefined });
  } else {
    acts.push({
      id: 'forage', label: run.species === 'mouse' ? 'Forage for seeds' : 'Graze',
      hint: `Food here: ${foodLabel(run.world.food[run.loc], loc.food * 2)}, about ${foragingCost(run.world.food[run.loc])} Energy`,
      disabled: exhausted ? 'Too tired' : undefined,
    });
  }
  acts.push({ id: 'rest', label: 'Rest', hint: 'Recover Energy and a little Health' });

  const tooTiredToMove = run.energy < 8;
  const moves = loc.adj.map((id) => ({ id, label: LOCATIONS[id].name }));
  if (run.species === 'deer') {
    const step = pathStep(run.loc, GLEN);
    const leads = run.rank <= 3;
    if (step.next) {
      acts.push({
        id: leads ? 'lead' : 'follow',
        label: leads ? 'Lead the herd toward the Glen' : 'Follow the herd toward the Glen',
        hint: `${step.dist} step${step.dist === 1 ? '' : 's'} away${leads ? '. The herd trusts your lead' : '. The herd keeps its own pace'}`,
        disabled: tooTiredToMove ? 'Too tired' : undefined,
      });
    } else {
      acts.push({ id: 'settle', label: 'Settle the herd', hint: run.herd >= 6 ? 'You are home' : 'Too few herd-mates', disabled: run.herd >= 6 ? undefined : 'Herd too small' });
    }
  }
  acts.push({
    id: 'travel', label: 'Travel', hint: run.nest ? 'Leaving abandons the nest' : 'Move to a neighbouring place',
    targets: moves, disabled: tooTiredToMove ? 'Too tired' : undefined,
  });

  if (run.species === 'mouse') {
    if (run.nest) {
      acts.push({ id: 'nurse', label: `Nurse the litter (${run.nest.turnsLeft} turn${run.nest.turnsLeft === 1 ? '' : 's'} to wean)`, hint: `${run.nest.pups} pup${run.nest.pups === 1 ? '' : 's'}`, disabled: run.nest.loc !== run.loc ? 'Not at the nest' : undefined });
    } else {
      let why: string | undefined;
      if (stage === 'juvenile') why = 'Not grown yet';
      else if (loc.cover < 2) why = 'Needs cover';
      else if (run.satiety < 35) why = 'Too hungry';
      else if (run.energy < 15) why = 'Too tired';
      acts.push({ id: 'breed', label: run.mateCall ? 'Join the calling mate and nest' : 'Find a mate and nest', hint: 'Goal: two litters weaned', disabled: why });
    }
  }
  if (run.species === 'deer') {
    const target = run.rank - 1;
    const need = vieNeed(target);
    let why: string | undefined;
    if (run.rank <= 1) why = 'You lead the herd';
    else if (stage === 'juvenile') why = 'Not grown yet';
    else if (run.cooldown > 0) why = `Recovering (${run.cooldown})`;
    else if (run.energy < 15) why = 'Too tired';
    else if (run.standing < need) why = `The herd does not trust you yet (rank progress ${run.standing.toFixed(1)}/${need.toFixed(1)})`;
    acts.push({
      id: 'vie', label: run.rank <= 1 ? 'Lead doe of the herd' : `Challenge for rank ${target}`,
      hint: 'Goal: become the herd leader. Wits and senses',
      disabled: why,
    });
  }
  if (run.species === 'wolf') {
    const target = run.rank > 1 ? run.rank - 1 : 0;
    let why: string | undefined;
    if (run.rank <= 1) why = 'You are the alpha';
    else if (stage === 'juvenile') why = 'Not grown yet';
    else if (run.cooldown > 0) why = `Recovering (${run.cooldown})`;
    else if (run.energy < 20) why = 'Too tired';
    else if (run.satiety < 30) why = 'Too hungry';
    acts.push({
      id: 'challenge', label: target ? `Challenge rank ${target} (Strength ${NPC_STR[target] ?? 7})` : 'Challenge', hint: 'Goal: rise to alpha', disabled: why,
    });
    acts.push({ id: 'howl', label: 'Howl with the pack', hint: 'Bond. A little rank progress.' });
  }
  void def;
  return acts;
}

const NPC_WIT: Record<number, number> = { 4: 3, 3: 4, 2: 5, 1: 7 };
export function vieNeed(target: number): number {
  return Math.max(0, (5 - target) * 0.5);
}

function takeHit(run: RunState, pred: PredatorDef) {
  run.hp -= pred.damage;
  say(run, `The ${pred.name.toLowerCase()} strikes. -${pred.damage} Health.`);
  if (run.nest) {
    run.nest.pups--;
    say(run, 'A pup is lost in the chaos.');
    if (run.nest.pups <= 0) { run.nest = null; say(run, 'The nest is empty.'); }
  }
  if (run.hp <= 0) {
    if (pred.id === 'rival') die(run, 'A pack-mate killed you in a challenge.');
    else die(run, `A ${pred.name.toLowerCase()} killed you.`, pred.id as CodexId);
  }
}

function resolveThreat(run: RunState, resp: string) {
  const ev = run.event!;
  const pred = PREDATORS[ev.pred!];
  const codex: CodexId | null = pred.id === 'rival' ? null : (pred.id as CodexId);
  const warned = !!ev.warned;
  const zig = hasTrait(run, 'zigzag');
  let hit = false;
  let herdP = 0;
  const wolfOnDeer = run.species === 'deer' && pred.id === 'wolf';

  const chase = () => {
    const p = threatParams(run, 'bolt', pred, warned);
    if (zig) useTrait(run, 'zigzag');
    const c = clash(run, p.a, p.d, 'Chase');
    energyCost(run, 6 + moveExtra(run) + (zig ? 4 : 0));
    if (c.ok) {
      say(run, `You scramble clear of the ${pred.name.toLowerCase()}.`);
      if (codex) addFam(run, codex, 15, 'escaped it');
      return true;
    }
    hit = true;
    return false;
  };

  switch (resp) {
    case 'hide': {
      const p = threatParams(run, 'hide', pred, warned);
      const c = clash(run, p.a, p.d, 'Hide');
      energyCost(run, 2);
      if (c.ok) {
        say(run, `The ${pred.name.toLowerCase()} loses interest and passes on.`);
        if (codex) addFam(run, codex, 4, 'spotted it');
        herdP = 0.5;
      } else {
        say(run, 'You were noticed!');
        const ok = chase();
        herdP = ok ? 0.6 : 1;
      }
      break;
    }
    case 'bolt': {
      const p = threatParams(run, 'bolt', pred, warned);
      if (zig) useTrait(run, 'zigzag');
      const c = clash(run, p.a, p.d, 'Flee');
      energyCost(run, 10 + moveExtra(run) + (zig ? 4 : 0));
      if (c.ok) {
        say(run, `You break away from the ${pred.name.toLowerCase()}.`);
        if (codex) addFam(run, codex, 15, 'escaped it');
        herdP = 0.25;
      } else {
        hit = true;
        herdP = 1;
      }
      break;
    }
    case 'fight': {
      const p = threatParams(run, 'fight', pred, warned);
      const c = clash(run, p.a, p.d, 'Fight');
      energyCost(run, 12);
      if (c.ok) {
        say(run, `You drive off the ${pred.name.toLowerCase()}.`);
        if (codex) addFam(run, codex, 20, 'beat it');
        if (pred.id === 'rival') {
          run.standing += 1;
          say(run, 'Your rank progress grows.');
        }
      } else {
        hit = true;
        herdP = 1;
        if (pred.id === 'rival') run.standing = Math.max(0, run.standing - 0.5);
      }
      break;
    }
    case 'warn': {
      const p = threatParams(run, 'warn', pred, warned);
      const c = clash(run, p.a, p.d, 'Warn');
      energyCost(run, 3);
      if (c.ok) {
        say(run, 'Your warning sends the herd away in time.');
        if (run.species === 'deer') { run.standing += 1; say(run, 'The herd takes note of you.'); }
        if (codex) addFam(run, codex, 4, 'spotted it');
        herdP = 0.15;
      } else {
        say(run, 'The warning came too late.');
        const ok = chase();
        herdP = ok ? 0.6 : 1;
      }
      break;
    }
    case 'risky': {
      const p = threatParams(run, 'risky', pred, warned);
      const c = clash(run, p.a, p.d, 'Gamble');
      energyCost(run, 3);
      if (c.ok) {
        forage(run, 0.8);
        say(run, `You eat on while the ${pred.name.toLowerCase()} passes.`);
        if (codex) addFam(run, codex, 4, 'spotted it');
        herdP = 0.4;
      } else {
        forage(run, 0.4);
        hit = true;
        herdP = 1;
      }
      break;
    }
    case 'submit': {
      run.standing = Math.max(0, run.standing - 0.5);
      say(run, 'You lower your head and step aside.');
      break;
    }
    default: break;
  }
  if (hit) takeHit(run, pred);
  if (!run.ended && wolfOnDeer && run.herd > 1) {
    const p = (hit ? 1 : herdP) * (run.cohesion ? 0.5 : 1) * keep(run);
    if (rnd(run) < p) {
      run.herd--;
      say(run, 'A herd-mate is dragged down.');
    }
  }
  run.event = null;
}

function forage(run: RunState, mult = 1) {
  const stock = run.world.food[run.loc];
  const isMouse = run.species === 'mouse';
  let gain = (isMouse ? 8 : 11) + 3 * Math.min(stock, 5);
  gain *= 0.8 + 0.4 * rnd(run);
  if (stock < 0.5) gain = 4 + rnd(run) * 3;
  const ev = run.event;
  const boosted = ev && ev.kind === 'windfall' && ev.id !== 'carcass';
  if (boosted) gain *= 1.8;
  gain = Math.round(gain * mult);
  gainSatiety(run, gain);
  run.world.food[run.loc] = Math.max(0, stock - (isMouse ? 1 : 1.5));
  const cost = foragingCost(stock);
  energyCost(run, cost);
  const tail = boosted ? ' (a windfall!)' : '';
  if (stock < 1) say(run, `Slim pickings. You search a long while. Hunger -${gain}, Energy -${cost}.${tail}`);
  else say(run, `You eat well. Hunger -${gain}, Energy -${cost}${tail}.`);
}

export function foragingCost(stock: number): number {
  return stock < 1 ? 9 : stock < 2.5 ? 7 : stock < 4.5 ? 5 : 4;
}

export function snapOf(run: RunState): Snap {
  return { hp: Math.max(0, run.hp), satiety: Math.round(run.satiety), energy: Math.round(run.energy), herd: run.herd };
}

function huntDeer(run: RunState) {
  const aBase = Math.floor((effStat(run, 'mobility') + effStat(run, 'strength')) / 2);
  const a = aBase + (effStat(run, 'senses') >= 8 ? 1 : 0) + (run.trackBonus ? 1 : 0);
  const c = clash(run, a, 6, 'Hunt');
  energyCost(run, 12 + moveExtra(run));
  run.trackBonus = false;
  if (c.ok) {
    gainSatiety(run, 45);
    run.standing += 1;
    run.world.deer[run.loc] = Math.max(0, run.world.deer[run.loc] - 1);
    say(run, 'You bring down a deer. Hunger -45. The pack respects the catch.');
    addFam(run, 'deer', 20, 'ate it');
  } else {
    say(run, 'The deer bolts. The hunt fails.');
    if (rnd(run) < 0.35) {
      run.hp -= 2;
      say(run, 'A hoof catches you. -2 Health.');
      if (run.hp <= 0) die(run, 'A deer\'s kick killed you.');
    }
  }
}

function perform(run: RunState, id: string, target?: string) {
  const loc = LOCATIONS[run.loc];
  switch (id) {
    case 'hide': case 'bolt': case 'fight': case 'warn': case 'risky': case 'submit':
      resolveThreat(run, id);
      return;
    case 'forage': forage(run); break;
    case 'hunt_deer': huntDeer(run); break;
    case 'hunt_small': {
      const a = effStat(run, 'mobility') + 1;
      const c = clash(run, a, 3, 'Hunt');
      energyCost(run, 8);
      if (c.ok) {
        gainSatiety(run, 18);
        run.world.mouse[run.loc] = Math.max(0.3, run.world.mouse[run.loc] - 0.5);
        say(run, 'A quick snack. Hunger -18.');
        addFam(run, 'mouse', 20, 'ate it');
      } else say(run, 'It squirms out of reach.');
      break;
    }
    case 'scavenge':
      gainSatiety(run, 40);
      run.standing += 0.5;
      energyCost(run, 3);
      say(run, 'You gorge on the carcass. Hunger -40.');
      break;
    case 'rest': {
      energyCost(run, -30);
      heal(run, 1 + (loc.cover >= 3 && run.satiety >= 30 ? 1 : 0));
      say(run, 'You rest and recover.');
      break;
    }
    case 'vie': {
      const target = run.rank - 1;
      const d = NPC_WIT[target] ?? 7;
      const a = Math.round((effStat(run, 'intelligence') + effStat(run, 'senses')) / 2) + Math.min(2, Math.floor(run.standing / 3));
      const c = clash(run, a, d, 'Vie');
      energyCost(run, 10);
      if (c.ok) {
        run.rank = target;
        say(run, target <= 1 ? 'The old lead doe steps aside. The herd looks to you.' : `The herd shifts to make room. You rise to rank ${run.rank}.`);
      } else {
        run.standing = Math.max(0, run.standing - 0.5);
        run.cooldown = 2;
        say(run, 'The herd is not convinced. You fall back, and your rank progress slips.');
      }
      break;
    }
    case 'travel': case 'lead': case 'follow': {
      let dest = target;
      if (id === 'lead' || id === 'follow') {
        dest = pathStep(run.loc, GLEN).next ?? undefined;
        if (id === 'lead') { run.cohesion = true; run.standing += 0.4; }
      }
      if (!dest || !loc.adj.includes(dest)) { say(run, 'There is no path that way.'); break; }
      if (run.nest) {
        say(run, 'You leave the nest behind. The pups are lost.');
        run.nest = null;
      }
      energyCost(run, 6 + moveExtra(run));
      run.loc = dest;
      say(run, `You move on to ${LOCATIONS[dest].name}.`);
      break;
    }
    case 'settle':
      say(run, 'The herd settles in the glen.');
      break;
    case 'breed': {
      const pups = clamp(2 + (run.satiety >= 70 ? 1 : 0) + (run.mateCall ? 1 : 0) - (seasonOf(run) === 3 ? 1 : 0), 1, 5);
      run.nest = { pups, turnsLeft: 4, loc: run.loc };
      run.mateCall = false;
      energyCost(run, 10);
      say(run, `You find a mate and build a nest. ${pups} pups are born.`);
      break;
    }
    case 'nurse': {
      if (!run.nest) break;
      run.nest.turnsLeft--;
      energyCost(run, 3);
      if (run.nest.turnsLeft <= 0) {
        run.litters++;
        say(run, `The litter is weaned. ${run.nest.pups} pup${run.nest.pups === 1 ? '' : 's'} scatter into the grass.`);
        run.nest = null;
      } else say(run, 'You keep the pups warm and fed.');
      break;
    }
    case 'challenge': {
      const target = run.rank - 1;
      const d = NPC_STR[target] ?? 7;
      const a = effStat(run, 'strength') + Math.min(2, Math.floor(run.standing / 3));
      const c = clash(run, a, d, 'Challenge');
      energyCost(run, 15);
      if (c.ok) {
        run.rank = target;
        say(run, `You win the challenge and rise to rank ${run.rank}.`);
      } else {
        run.hp -= 3;
        run.cooldown = 2;
        run.standing = Math.max(0, run.standing - 1);
        say(run, 'You lose the challenge. -3 Health.');
        if (run.hp <= 0) die(run, 'A pack-mate killed you in a challenge.');
      }
      break;
    }
    case 'howl': {
      energyCost(run, 3);
      if (rnd(run) < 0.5) { run.standing += 0.5; say(run, 'The pack answers. Your bond grows.'); }
      else say(run, 'Your howl fades into the dark.');
      break;
    }
    default: break;
  }
}

function checkWin(run: RunState) {
  if (run.ended) return;
  const season = seasonOf(run);
  if (run.species === 'mouse' && run.litters >= 2) {
    run.ended = { type: 'win', cause: 'Two litters weaned.' };
  } else if (run.species === 'deer' && run.loc === GLEN && run.herd >= 6 && season === 3 && run.age >= 8 && run.rank <= 1) {
    run.ended = { type: 'win', cause: 'You lead the herd to the winter range.' };
  } else if (run.species === 'wolf' && run.rank <= 1) {
    run.ended = { type: 'win', cause: 'You are the pack alpha.' };
  }
  if (run.ended) say(run, `Victory! ${run.ended.cause}`);
}

export function progressOf(run: RunState): number {
  if (run.ended?.type === 'win') return 1;
  if (run.species === 'mouse') {
    const nestPart = run.nest ? 0.35 * (1 - run.nest.turnsLeft / 4) : 0;
    return clamp((run.litters + nestPart) / 2, 0, 0.95);
  }
  if (run.species === 'deer') {
    const dist = Math.min(3, pathStep(run.loc, GLEN).dist);
    return clamp(0.35 * (1 - dist / 3) + 0.2 * Math.min(1, run.herd / 8) + 0.4 * ((5 - run.rank) / 4), 0, 0.95);
  }
  return clamp(((5 - run.rank) / 4) * 0.9 + (Math.min(run.standing, 6) / 6) * 0.1, 0, 0.95);
}

// ---------- the turn ----------

export function act(run0: RunState, actionId: string, target?: string): RunState {
  const run: RunState = structuredClone(run0);
  if (run.ended) return run;
  run.last = [];
  run.envHits = [];
  const a = getActions(run).find((x) => x.id === actionId);
  if (!a || a.disabled) {
    say(run, 'That cannot be done right now.');
    return run;
  }
  run.turnsTaken++;
  const turnNo = run.age + 1;
  const ev0 = run.event;
  const wasThreat = !!ev0 && ev0.kind === 'threat' && !!ev0.pred;
  const wasQuiet = !wasThreat;
  const before = snapOf(run);
  let label = a.label;
  if (target && a.targets) label = `${a.label}: ${a.targets.find((t) => t.id === target)?.label ?? ''}`;
  perform(run, actionId, target);
  // events that were not threats are spent after the turn
  if (wasQuiet) run.event = null;
  if (!run.ended) checkWin(run);
  const afterAction = snapOf(run);
  const resolve = run.last;
  run.last = [];
  if (!run.ended) {
    worldStep(run, () => rnd(run));
    if (run.cooldown > 0) run.cooldown--;
    run.cohesion = false;
    run.age++;
    if (run.species === 'deer' && stageOf(run) === 'adult' && run.herd >= 4) run.standing += 0.4;
    if (run.age >= SPECIES[run.species].maxAge) {
      run.ended = { type: 'old_age', cause: 'You lived a full life.' };
      say(run, 'You have grown old. Your time is done.');
    } else {
      beginTurn(run);
    }
  }
  const arrival = run.last;
  const report: TurnReport = {
    turn: turnNo, action: label, resolve, arrival, before, afterAction, afterArrival: snapOf(run),
    newEvent: run.ended ? undefined : run.event?.name,
    envHits: run.envHits && run.envHits.length ? run.envHits : undefined,
  };
  if (wasThreat && ev0?.pred) {
    const killed = run.ended?.type === 'death' && afterAction.hp <= 0;
    report.threat = {
      name: ev0.name, pred: ev0.pred,
      outcome: killed ? 'killed' : afterAction.hp < before.hp ? 'hurt' : 'safe',
    };
  }
  run.report = report;
  run.last = [...resolve, ...arrival];
  run.history.push(`— Turn ${turnNo} —`, ...resolve, ...arrival);
  if (run.history.length > 80) run.history = run.history.slice(-80);
  return run;
}

// ---------- view ----------

export function getView(run: RunState): RunView {
  const loc = LOCATIONS[run.loc];
  const def = SPECIES[run.species];
  const tier = run.visibilityTier;
  const neighbours: Neighbour[] = loc.adj.map((id) => {
    const l = LOCATIONS[id];
    const n: Neighbour = { id, name: l.name };
    if (tier >= 1) {
      const t = threatsAt(run.world, id, run.species).length;
      n.danger = t === 0 ? 'calm' : t === 1 ? 'wary' : 'dangerous';
    }
    if (tier >= 2) {
      n.food = foodLabel(run.world.food[id], l.food * 2);
      if (run.species === 'wolf') n.prey = preyLabel(run.world.deer[id]);
    }
    if (tier >= 3) {
      n.predators = [...new Set(run.world.preds.filter((p) => p.loc === id).map((p) => PREDATORS[p.id].name))];
    }
    return n;
  });
  let goalLine = '';
  if (run.species === 'mouse') goalLine = `Litters weaned: ${run.litters}/2`;
  if (run.species === 'deer') goalLine = `Rank ${run.rank} in the herd (1 = leader). Herd ${run.herd}/8. Lead at least 6 of them to the Glen by winter.`;
  if (run.species === 'wolf') goalLine = `Pack rank ${run.rank} of 6. Rank progress ${run.standing.toFixed(1)}.`;
  return {
    locName: loc.name, biome: loc.biome, blurb: loc.blurb,
    seasonName: SEASON_NAMES[seasonOf(run)], turn: run.age + 1, maxTurns: def.maxAge,
    stage: stageOf(run), hp: Math.max(0, run.hp), maxHp: maxHpOf(run),
    satiety: Math.round(run.satiety), energy: Math.round(run.energy), safety: Math.round(run.safety),
    stats: Object.fromEntries(STATS.map((s) => [s, effStat(run, s)])) as Record<Stat, number>,
    event: run.event, actions: getActions(run), neighbours, tier,
    herd: run.species === 'deer' ? run.herd : undefined,
    rank: run.species === 'wolf' ? run.rank : undefined,
    standing: run.species === 'wolf' ? run.standing : undefined,
    nest: run.species === 'mouse' ? (run.nest ? { pups: run.nest.pups, turnsLeft: run.nest.turnsLeft } : null) : undefined,
    litters: run.species === 'mouse' ? run.litters : undefined,
    foodHere: run.species === 'wolf'
      ? `Deer here: ${preyLabel(run.world.deer[run.loc])}`
      : `Food here: ${foodLabel(run.world.food[run.loc], loc.food * 2)}`,
    goalLine,
  };
}

export { TRAITS };
