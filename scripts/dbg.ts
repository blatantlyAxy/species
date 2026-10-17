import { act, createAccount, rollBirth, startRun } from '../src/engine';
import { pickForTrace } from './policy';
const rows: Record<string, { n: number; win: number; old: number }> = {};
for (let i = 0; i < 300; i++) {
  const seed = i + 11;
  const acc = createAccount();
  const birth = rollBirth('mouse', seed);
  let { run } = startRun(acc, 'mouse', { senses: 1, health: 1, mobility: 1 }, [], birth, seed * 7 + 1);
  let g = 0;
  while (!run.ended && g++ < 200) { const a = pickForTrace(run); run = act(run, a.id, a.target); }
  const key = `${birth.loc} off${birth.startOffset}`;
  rows[key] ??= { n: 0, win: 0, old: 0 };
  rows[key].n++;
  if (run.ended!.type === 'win') rows[key].win++;
  if (run.ended!.type === 'old_age') rows[key].old++;
}
for (const [k, v] of Object.entries(rows).sort()) console.log(k.padEnd(28), JSON.stringify(v));
