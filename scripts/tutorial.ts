// Checks the tutorial rules without the UI: tip triggers, coaching text, and old-save migration.
import {
  FIRST_SPECIES, TIP_IDS, act, coachingFor, createAccount, finishRun, getActions, getView, normalizeAccount,
  rollBirth, startRun, tipText, triggeredTips,
} from '../src/engine';
import type { Account, RunState, TipId } from '../src/engine';

const fail = (m: string): never => { throw new Error(m); };
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };

// --- migration ---
{
  const fresh = normalizeAccount(null);
  eq(fresh.tutorial.introSeen, false, 'fresh account shows the intro');
  const old = normalizeAccount({ lives: 5, xp: 300, level: 3, gp: { mouse: 1 } });
  eq([old.tutorial.introSeen, old.tutorial.coached, old.tutorial.tipsOff], [true, true, false], 'a played-before save skips the intro and coaching');
  eq(old.gp.deer, createAccount().gp.deer, 'old saves still merge defaults');
  const unplayed = normalizeAccount({ lives: 0 });
  eq(unplayed.tutorial.introSeen, false, 'an unplayed save sees the intro');
  const partial = normalizeAccount({ lives: 2, tutorial: { tipsSeen: { hurt: true } } });
  eq([partial.tutorial.tipsSeen.hurt, partial.tutorial.tipsSeen.season, partial.tutorial.introSeen], [true, false, false], 'a partial tutorial block is merged');
  eq(Object.keys(fresh.tutorial.tipsSeen), TIP_IDS, 'every tip has a seen flag');
}

// --- tip triggers over many lives ---
const seen = new Set<TipId>();
let deathsCoached = 0;
for (let seed = 1; seed < 300; seed++) {
  for (const sp of ['mouse', 'deer', 'wolf'] as const) {
    const acc: Account = createAccount(); acc.unlocked.wolf = true; acc.gp.wolf = 3;
    let run: RunState = startRun(acc, sp, {}, [], rollBirth(sp, seed), seed * 5 + 1).run;
    const first = triggeredTips({ run, view: getView(run), cardUp: false });
    if (!first.includes('first_turn')) fail('first_turn must trigger on turn 0');
    for (const id of first) seen.add(id);
    let g = 0;
    while (!run.ended && g++ < 200) {
      const acts = getActions(run);
      const a = acts.find((x) => !x.disabled && !x.targets) ?? acts[0];
      const tg = acts.find((x) => x.targets && !x.disabled);
      const pick = tg && g % 5 === 0 ? { id: tg.id, target: tg.targets![0].id } : { id: a.id, target: undefined as string | undefined };
      run = act(run, pick.id, pick.target);
      const v = getView(run);
      const t = triggeredTips({ run, view: v, cardUp: false });
      if (t.includes('first_turn')) fail('first_turn must not trigger after the first action');
      for (const id of t) { seen.add(id); if (!tipText(id, { run, view: v, cardUp: false }).length) fail('empty tip text ' + id); }
      if (run.ended && t.length) fail('no tips once the life has ended');
      if (triggeredTips({ run, view: v, cardUp: true }).indexOf('flashcard') < 0 && !run.ended) fail('flashcard tip must trigger while a card is up');
    }
    if (run.ended?.type === 'death') {
      const c = coachingFor(run);
      if (!c.ended || !c.suggestion || !c.spend) fail('coaching needs three parts');
      const fin = finishRun(acc, run);
      if (!fin.report.coaching || !fin.account.tutorial.coached) fail('first death must produce coaching');
      const again = finishRun(fin.account, run);
      if (again.report.coaching) fail('coaching must appear only once');
      deathsCoached++;
    }
  }
}
for (const id of TIP_IDS) if (id !== 'flashcard' && !seen.has(id)) fail('tip never triggered in 900 lives: ' + id);

// --- coaching picks the right cause ---
{
  const acc = createAccount();
  const mk = (cause: string, killedBy?: string) => {
    const r = startRun(acc, FIRST_SPECIES, {}, [], rollBirth(FIRST_SPECIES, 3), 9).run;
    r.ended = { type: 'death', cause, killedBy: killedBy as any };
    return coachingFor(r).ended;
  };
  eq(mk('A hawk killed you.', 'hawk'), 'A hawk caught me.', 'hawk coaching');
  eq(mk('You starved.'), 'I starved.', 'starved coaching');
  eq(mk('You froze on the ridge.'), 'The cold killed me.', 'cold coaching');
  eq(mk('You succumbed to sickness.'), 'Sickness killed me.', 'sickness coaching');
  eq(mk("A deer's kick killed you."), 'A deer kicked me dead.', 'kick coaching');
  eq(mk('A pack-mate killed you in a challenge.'), 'A pack-mate beat me in a challenge.', 'pack-mate coaching');
  const win = startRun(acc, FIRST_SPECIES, {}, [], rollBirth(FIRST_SPECIES, 3), 9).run;
  win.ended = { type: 'win', cause: 'Two litters weaned.' };
  if (finishRun(acc, win).report.coaching) fail('no coaching on a win');
  eq(finishRun(acc, win).account.tutorial.coached, false, 'a win does not use up the coaching');
}
console.log('tutorial rules ok;', deathsCoached, 'first-death coachings checked; tips seen:', [...seen].join(', '));
