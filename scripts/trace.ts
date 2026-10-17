import { act, createAccount, getView, getActions, rollBirth, startRun } from '../src/engine';
import type { SpeciesId } from '../src/engine';
import { pickForTrace } from './policy';
const sp = (process.argv[2] ?? 'wolf') as SpeciesId;
const seed = Number(process.argv[3] ?? 5);
const acc = createAccount(); acc.unlocked.wolf = true; acc.gp.wolf = 3;
const birth = rollBirth(sp, seed);
let { run } = startRun(acc, sp, { senses: 1, health: 1, strength: 1 }, [], birth, seed);
console.log(birth.lines.join(' | '));
let g = 0;
while (!run.ended && g++ < 80) {
  const v = getView(run);
  const a = pickForTrace(run);
  console.log(`T${v.turn} ${v.seasonName} ${v.locName} hp${v.hp}/${v.maxHp} sat${v.satiety} en${v.energy} rank${run.rank} stand${run.standing} herd${run.herd} ev=${run.event?.id} -> ${a.id}${a.target ? ':' + a.target : ''}`);
  run = act(run, a.id, a.target);
  for (const l of run.last) console.log('    ' + l);
}
console.log('END', run.ended);
