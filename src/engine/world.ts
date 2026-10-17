import { LOCATIONS, LOC_IDS, SEASON_LEN, YEAR_LEN } from './data';
import type { BirthRoll, PredatorId, RunState, SpeciesId, World } from './types';
import { clamp } from './rng';

export function seasonAt(startOffset: number, age: number): number {
  return Math.floor(((startOffset + age) % YEAR_LEN) / SEASON_LEN);
}

export function seasonOf(run: RunState): number {
  return seasonAt(run.startOffset, run.age);
}

const REGEN = [1.2, 1.0, 0.6, 0.1];

export function initWorld(rand: () => number, birth: BirthRoll, species: SpeciesId): World {
  const food: Record<string, number> = {};
  const mouse: Record<string, number> = {};
  const deer: Record<string, number> = {};
  for (const id of LOC_IDS) {
    const l = LOCATIONS[id];
    food[id] = l.food * (0.8 + rand() * 0.4);
    mouse[id] = Math.round(l.food * 1.2 * 10) / 10;
  }
  Object.assign(deer, {
    open_meadow: 4, clover_field: 4, birch_edge: 3, deep_pines: 1,
    shallow_ford: 1, reed_bank: 2, windy_ridge: 0, sheltered_glen: 2,
  });
  const preds: World['preds'] = [
    { id: 'hawk', loc: 'open_meadow' }, { id: 'hawk', loc: 'shallow_ford' },
    { id: 'hawk', loc: 'windy_ridge' }, { id: 'hawk', loc: 'open_meadow' },
    { id: 'fox', loc: 'birch_edge' }, { id: 'fox', loc: 'open_meadow' }, { id: 'fox', loc: 'reed_bank' },
    { id: 'wolf', loc: 'deep_pines' }, { id: 'wolf', loc: 'birch_edge' }, { id: 'wolf', loc: 'windy_ridge' },
  ];
  // Birth luck: neighbours
  const here = birth.loc;
  if (birth.neighbours === 'quiet') {
    for (let i = preds.length - 1; i >= 0; i--) if (preds[i].loc === here) preds.splice(i, 1);
  } else if (birth.neighbours === 'predator') {
    if (species === 'mouse') preds.push({ id: rand() < 0.5 ? 'hawk' : 'fox', loc: here });
    else if (species === 'deer') preds.push({ id: 'wolf', loc: here });
  }
  return { food, mouse, deer, preds };
}

export function predsAt(world: World, loc: string): { id: PredatorId; loc: string }[] {
  return world.preds.filter((p) => p.loc === loc);
}

/** Predators that threaten this species at a location. */
export function threatsAt(world: World, loc: string, species: SpeciesId): PredatorId[] {
  const ids = predsAt(world, loc).map((p) => p.id);
  if (species === 'mouse') return ids.filter((i) => i === 'hawk' || i === 'fox');
  if (species === 'deer') return ids.filter((i) => i === 'wolf');
  return [];
}

export function countPred(world: World, loc: string, id: PredatorId): number {
  return world.preds.filter((p) => p.loc === loc && p.id === id).length;
}

export function worldStep(run: RunState, rand: () => number): void {
  const w = run.world;
  const season = seasonOf(run);
  for (const id of LOC_IDS) {
    const l = LOCATIONS[id];
    const max = l.food * 2;
    const regen = l.food * 0.3 * REGEN[season];
    const eaten = w.mouse[id] * 0.03 + w.deer[id] * 0.12;
    w.food[id] = clamp(w.food[id] + regen - eaten, 0, max);

    const fed = clamp(w.food[id] / Math.max(1, l.food), 0, 1.5);
    const foxes = countPred(w, id, 'fox');
    const hawks = countPred(w, id, 'hawk');
    const wolves = countPred(w, id, 'wolf');
    const mouseCap = l.food * 1.8;
    w.mouse[id] = clamp(w.mouse[id] + w.mouse[id] * 0.07 * fed * (season === 3 ? 0.2 : 1) - (foxes + hawks) * 0.25, 0.3, mouseCap);
    const deerCap = l.biome === 'highlands' && l.harsh ? 1 : l.food * 1.2;
    w.deer[id] = clamp(w.deer[id] + w.deer[id] * 0.06 * fed - wolves * 0.12, 0, Math.max(deerCap, 1));
  }
  // predators wander toward prey
  for (const p of w.preds) {
    if (rand() > 0.3) continue;
    const here = LOCATIONS[p.loc];
    const opts = here.adj.map((a) => {
      const l = LOCATIONS[a];
      const prey = p.id === 'wolf' ? w.deer[a] : w.mouse[a];
      const openBias = p.id === 'hawk' ? (6 - l.cover) / 3 : 1;
      return { id: a, w: 0.4 + prey * openBias };
    });
    const total = opts.reduce((s, o) => s + o.w, 0);
    let x = rand() * total;
    for (const o of opts) {
      x -= o.w;
      if (x <= 0) { p.loc = o.id; break; }
    }
  }
}

export function pathStep(from: string, to: string): { next: string | null; dist: number } {
  if (from === to) return { next: null, dist: 0 };
  const prev: Record<string, string | null> = { [from]: null };
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === to) break;
    for (const n of LOCATIONS[cur].adj) {
      if (!(n in prev)) { prev[n] = cur; q.push(n); }
    }
  }
  if (!(to in prev)) return { next: null, dist: 99 };
  let step = to;
  let dist = 0;
  while (prev[step] && prev[step] !== from) { step = prev[step]!; dist++; }
  return { next: step, dist: dist + 1 };
}
