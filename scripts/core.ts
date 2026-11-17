// Engine checks that need no UI: the map graph, save codes, account and run normalising, the mayfly counter.
import {
  LOCATIONS, LOC_IDS, MAYFLY_YOUTH_DEATHS, PATHS, SAVE_VERSION, act, buildMap, createAccount, decodeSave, encodeSave,
  finishRun, getActions, getView, normalizeAccount, normalizeRun, rollBirth, startRun,
} from '../src/engine';
import type { Account, RunState } from '../src/engine';

const fail = (m: string): never => { throw new Error(m); };
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };
const throws = (f: () => unknown, m: string) => { try { f(); } catch { return; } fail(m); };

// --- map graph ---
{
  eq(LOC_IDS.length, 8, 'eight places');
  eq(PATHS.length, 10, 'ten paths');
  for (const id of LOC_IDS) {
    const l = LOCATIONS[id];
    for (const n of l.adj) if (!LOCATIONS[n].adj.includes(id)) fail(`one-way path ${id} to ${n}`);
    if (!(l.x >= 0 && l.x <= 100 && l.y >= 0 && l.y <= 100)) fail(`${id} needs a map position`);
  }
  // neighbour order is part of saved runs (random numbers are drawn while walking it)
  eq(LOCATIONS.reed_bank.adj, ['shallow_ford', 'clover_field'], 'reed bank neighbours');
  eq(LOCATIONS.sheltered_glen.adj, ['windy_ridge', 'deep_pines'], 'glen neighbours');
  eq(LOCATIONS.deep_pines.adj, ['birch_edge', 'windy_ridge', 'sheltered_glen'], 'pines neighbours');
  const place = (id: string) => ({ id, name: id, biome: 'meadow' as const, food: 1, cover: 1, x: 0, y: 0, blurb: '' });
  throws(() => buildMap([place('a'), place('b')], []), 'an unreachable place must be refused');
  throws(() => buildMap([place('a')], [['a', 'zz']]), 'a path to nowhere must be refused');
  throws(() => buildMap([place('a'), place('b')], [['a', 'b'], ['b', 'a']]), 'a repeated path must be refused');
}

// --- minimap view ---
{
  const acc = createAccount();
  const birth = { ...rollBirth('mouse', 4), loc: 'shallow_ford' };
  let run = startRun(acc, 'mouse', {}, [], birth, 77).run;
  const m0 = getView(run).map;
  eq(m0.nodes.filter((n) => n.here).map((n) => n.id), ['shallow_ford'], 'here marker');
  eq(m0.nodes.filter((n) => n.known).map((n) => n.id).sort(), ['open_meadow', 'reed_bank', 'shallow_ford'], 'tier 0 knows here and next door');
  if (m0.nodes.some((n) => n.danger)) fail('tier 0 shows no danger rings');
  run.event = null;
  run = act(run, 'travel', 'open_meadow');
  if (!run.ended) {
    const m1 = getView(run).map;
    if (m1.nodes.find((n) => n.id === 'reed_bank')!.known) fail('a place that is neither visited nor next door goes back to fog');
    if (!m1.nodes.find((n) => n.id === 'shallow_ford')!.known) fail('a visited place stays known');
    eq(run.visited, ['shallow_ford', 'open_meadow'], 'visited list');
  }
  const deer = startRun(acc, 'deer', {}, [], rollBirth('deer', 4), 78).run;
  const glen = getView(deer).map.nodes.find((n) => n.id === 'sheltered_glen')!;
  if (!glen.goal || !glen.known) fail('the deer always knows where the Glen is');
  const far = { ...deer, visibilityTier: 3 };
  if (getView(far).map.nodes.some((n) => !n.known)) fail('tier 3 clears the fog');
}

// --- save codes ---
{
  const acc: Account = { ...createAccount(), xp: 480, lives: 12 };
  acc.codex.wolf = 64;
  const code = encodeSave(acc);
  if (!/^SPECIES1\.[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(code)) fail('save code shape: ' + code.slice(0, 40));
  const back = decodeSave(`  ${code.slice(0, 30)}\n${code.slice(30)} `);
  eq([back.xp, back.lives, back.codex.wolf, back.level, back.version], [480, 12, 64, 5, SAVE_VERSION], 'save code round trip, whitespace ignored');
  throws(() => decodeSave(code.slice(0, -2)), 'a cut-short code must be refused');
  throws(() => decodeSave(code.replace('SPECIES1', 'OTHER')), 'a foreign code must be refused');
  throws(() => decodeSave('hello'), 'nonsense must be refused');
  throws(() => decodeSave(''), 'an empty code must be refused');
}

// --- account normalising ---
{
  const bad = normalizeAccount({ xp: 'lots', level: 99, lives: -4, codex: { wolf: 5000, dragon: 3 }, gp: { mouse: null }, unlocked: { mouse: false, wolf: 'yes' }, settings: 7 });
  eq([bad.xp, bad.level, bad.lives, bad.codex.wolf, (bad.codex as any).dragon, bad.gp.mouse, bad.unlocked.mouse, bad.unlocked.wolf, bad.settings.actionList],
    [0, 1, 0, 100, undefined, createAccount().gp.mouse, true, false, false], 'damaged values fall back to safe defaults');
  eq(normalizeAccount({ xp: 260, level: 1 }).level, 4, 'level is always derived from XP');
  eq(normalizeAccount([]).lives, 0, 'an array is not an account');
  eq(normalizeAccount({ version: 1, lives: 2 }).version, SAVE_VERSION, 'old saves are stamped with the current version');
}

// --- run normalising ---
{
  const acc = createAccount();
  const run = startRun(acc, 'mouse', {}, [], rollBirth('mouse', 9), 5).run;
  const json = () => JSON.parse(JSON.stringify(run));
  if (!normalizeRun(json())) fail('a healthy run must load');
  const old = json(); delete old.visited;
  eq(normalizeRun(old)!.visited, [run.loc], 'a run saved before 1.0 gets a visited list');
  for (const [label, damage] of [
    ['unknown species', (r: any) => { r.species = 'salmon'; }],
    ['unknown place', (r: any) => { r.loc = 'the_moon'; }],
    ['missing world', (r: any) => { delete r.world; }],
    ['missing stat', (r: any) => { delete r.stats.senses; }],
    ['predator in an unknown place', (r: any) => { r.world.preds[0].loc = 'nowhere'; }],
    ['missing food entry', (r: any) => { delete r.world.food.reed_bank; }],
  ] as [string, (r: any) => void][]) {
    const r = json(); damage(r);
    if (normalizeRun(r)) fail(`a run with ${label} must be refused`);
  }
  if (normalizeRun(null) || normalizeRun('x') || normalizeRun({})) fail('junk must be refused');
  // a loaded run plays on exactly like the original
  let a: RunState = run; let b: RunState = normalizeRun(json())!;
  for (let i = 0; i < 40 && !a.ended; i++) {
    const pick = getActions(a).find((x) => !x.disabled && !x.targets)!;
    a = act(a, pick.id); b = act(b, pick.id);
  }
  eq([b.age, b.hp, b.loc, b.rng, b.ended], [a.age, a.hp, a.loc, a.rng, a.ended], 'a reloaded run stays in step');
}

// --- mayfly: three deaths before adulthood ---
{
  let acc = createAccount();
  const dieAs = (stage: 'young' | 'adult') => {
    const r = startRun(acc, 'mouse', {}, [], rollBirth('mouse', 3), 9).run;
    if (stage === 'adult') r.age = 10;
    r.ended = { type: 'death', cause: 'You starved.' };
    return finishRun(acc, r);
  };
  let f = dieAs('adult');
  eq([f.account.youthDeaths, f.account.hiddenFound.mayfly], [0, false], 'an adult death does not count');
  acc = f.account;
  for (let i = 1; i <= MAYFLY_YOUTH_DEATHS; i++) {
    f = dieAs('young');
    acc = f.account;
    eq([acc.youthDeaths, acc.hiddenFound.mayfly], [i, i >= MAYFLY_YOUTH_DEATHS], `young death ${i}`);
    if ((i === MAYFLY_YOUTH_DEATHS) !== f.report.unlocks.some((u) => u.includes('mayfly'))) fail('the mayfly is announced exactly once, on the third');
  }
  f = dieAs('young');
  if (f.report.unlocks.some((u) => u.includes('mayfly'))) fail('the mayfly must not be announced again');
  const quick = startRun(createAccount(), 'mouse', {}, [], rollBirth('mouse', 3), 9).run;
  quick.age = 10; quick.turnsTaken = 1; quick.ended = { type: 'old_age', cause: '' };
  if (finishRun(createAccount(), quick).account.hiddenFound.mayfly) fail('the old one-day rule is gone');
}
// --- pixel scene art ---
{
  const { PAL, SPRITES, SCENE_W, SCENE_H, drawScene } = await import('../src/ui/pixel/art');
  for (const [id, rows] of Object.entries(SPRITES)) {
    if (rows.length !== 16) fail(`sprite ${id} needs 16 rows, has ${rows.length}`);
    rows.forEach((r, i) => {
      if (r.length !== 16) fail(`sprite ${id} row ${i} needs 16 columns, has ${r.length}`);
      for (const ch of r) if (ch !== '.' && !PAL[ch]) fail(`sprite ${id} row ${i} uses "${ch}", which is not in the palette`);
    });
    if (!rows.some((r) => /[^.]/.test(r))) fail(`sprite ${id} is empty`);
  }
  if (Object.keys(PAL).length > 16) fail('the shared palette is capped at 16 colours');
  const base = { biome: 'meadow', season: 1, place: 'open_meadow', player: 'mouse', frame: 0 } as const;
  const key = (f: { px: Uint32Array }) => f.px.join(',');
  const a = drawScene(base);
  eq([a.w, a.h, a.px.length], [SCENE_W, SCENE_H, SCENE_W * SCENE_H], 'scene size');
  if (a.px.some((v) => v === 0)) fail('every scene pixel must be painted');
  eq(key(drawScene(base)), key(a), 'the same place and frame always draws the same picture');
  for (const [label, change] of [
    ['biome', { biome: 'forest' }], ['season', { season: 3 }], ['place', { place: 'clover_field' }], ['foe', { foe: 'hawk' }],
    ['player', { player: 'deer' }], ['companions', { companions: 3 }], ['nest', { nest: true }], ['frame', { frame: 1 }],
  ] as [string, object][]) {
    if (key(drawScene({ ...base, ...change } as any)) === key(a)) fail(`changing the ${label} should change the picture`);
  }
  for (const biome of ['meadow', 'forest', 'river', 'highlands']) for (let season = 0; season < 4; season++) {
    if (drawScene({ ...base, biome, season } as any).px.some((v) => v === 0)) fail(`unpainted pixels in ${biome}, season ${season}`);
  }
}
console.log('core checks ok: map graph, minimap view, save codes, account and run normalising, mayfly counter, pixel art');
