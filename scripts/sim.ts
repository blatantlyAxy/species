// Headless playtest: a simple bot plays many lives so we can check balance.
import {
  act, createAccount, finishRun, getActions, getView, rollBirth, startRun,
} from '../src/engine';
import type { Account, RunState, SpeciesId, Stat, TraitId } from '../src/engine';
import { pickForTrace as pick } from './policy';

type Policy = (run: RunState) => { id: string; target?: string };


function playLife(acc: Account, species: SpeciesId, seed: number, policy: Policy, traits: TraitId[]) {
  const birth = rollBirth(species, seed);
  // spend GP on the species' signature stats
  const invest: Partial<Record<Stat, number>> = {};
  const gp = acc.gp[species];
  const prefs: Stat[] = species === 'mouse' ? ['senses', 'health', 'mobility'] : species === 'deer' ? ['senses', 'health', 'stamina'] : ['strength', 'health', 'stamina'];
  for (let i = 0; i < gp; i++) invest[prefs[i % prefs.length]] = (invest[prefs[i % prefs.length]] ?? 0) + 1;
  const started = startRun(acc, species, invest, traits, birth, seed * 7 + 1);
  let run = started.run;
  let guard = 0;
  while (!run.ended && guard++ < 200) {
    const a = policy(run);
    const next = act(run, a.id, a.target);
    if (next === run || (next.turnsTaken === run.turnsTaken && !next.ended)) { run = act(run, 'rest'); } else run = next;
  }
  const fin = finishRun(started.account, run);
  return { run, ...fin };
}

const N = Number(process.argv[2] ?? 300);
const species: SpeciesId[] = ['mouse', 'deer', 'wolf'];
for (const sp of species) {
  let acc = createAccount();
  acc.unlocked.wolf = true;
  acc.gp.wolf = 3;
  const traits: TraitId[] = process.env.NOTRAIT ? [] : sp === 'wolf' ? ['thick_coat'] : sp === 'mouse' ? ['keen_nose'] : ['zigzag'];
  const tally = { win: 0, death: 0, old_age: 0 } as Record<string, number>;
  const killers: Record<string, number> = {};
  let turns = 0;
  let xp = 0;
  const firstLifeTally = { win: 0, n: 0 };
  for (let i = 0; i < N; i++) {
    // fresh account for the first 100 lives to measure first-life odds, then keep the account
    const a = i < 100 ? (() => { const f = createAccount(); f.unlocked.wolf = true; f.gp.wolf = 3; return f; })() : acc;
    const res = playLife(a, sp, i + 11, pick, traits);
    if (i >= 100) acc = res.account;
    tally[res.report.end.type]++;
    turns += res.run.age;
    xp += res.report.payout.xp;
    if (i < 100) { firstLifeTally.n++; if (res.report.end.type === 'win') firstLifeTally.win++; }
    const k = res.report.end.killedBy ?? (res.report.end.type === 'death' ? res.report.end.cause : '-');
    if (res.report.end.type === 'death') killers[k] = (killers[k] ?? 0) + 1;
  }
  const pct = (n: number) => `${Math.round((n / N) * 100)}%`;
  console.log(`\n${sp.toUpperCase()}  (${N} lives)`);
  console.log(`  win ${pct(tally.win)}  death ${pct(tally.death)}  old age ${pct(tally.old_age)}`);
  console.log(`  first-life win rate (fresh account): ${Math.round((firstLifeTally.win / firstLifeTally.n) * 100)}%`);
  console.log(`  avg turns ${(turns / N).toFixed(1)}  avg xp ${(xp / N).toFixed(0)}`);
  console.log(`  killers: ${JSON.stringify(killers)}`);
}
