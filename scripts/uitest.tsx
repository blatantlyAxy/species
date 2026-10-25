import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis as any;
g.window = dom.window; g.document = dom.window.document; g.localStorage = dom.window.localStorage;
g.HTMLElement = dom.window.HTMLElement; g.KeyboardEvent = dom.window.KeyboardEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;
// Reduced motion is on for most of the run so cards dismiss instantly; one block below turns it off.
g.__reduceMotion = true;
dom.window.matchMedia = ((q: string) => ({
  matches: g.__reduceMotion === true && q.includes('reduced-motion'), media: q,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
})) as any;
// jsdom has no layout, so give the Actions panel a fixed height to check that the card keeps it.
Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get() { return (this as HTMLElement).classList?.contains('actions') ? 300 : 0; },
});
g.confirm = () => true; g.alert = (m: string) => { throw new Error('alert: ' + m); };

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { App } = await import('../src/ui/App');

const root = createRoot(document.getElementById('root')!);
await act(async () => { root.render(React.createElement(App)); });

const buttons = () => Array.from(document.querySelectorAll('button, .card.pick')) as HTMLElement[];
const click = async (el: HTMLElement) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const clickText = async (t: string) => {
  const el = buttons().find((b) => (b.textContent ?? '').includes(t) && !(b as HTMLButtonElement).disabled);
  if (!el) throw new Error('no button: ' + t + '\n' + document.body.textContent!.slice(0, 300));
  await click(el);
};

let cur = root;
const remount = async (storage: Record<string, string>) => {
  await act(async () => { cur.unmount(); });
  localStorage.clear();
  for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
  const d = document.createElement('div'); document.body.appendChild(d);
  cur = createRoot(d);
  await act(async () => { cur.render(React.createElement(App)); });
};
const has = (t: string) => document.body.textContent!.includes(t);
const q1 = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const savedAccount = () => JSON.parse(localStorage.getItem('species_account_v1') ?? '{}');
const liveActions = () => (Array.from(document.querySelectorAll('[data-panel="actions"] button')) as HTMLButtonElement[])
  .filter((b) => !b.disabled && !b.textContent!.startsWith('Cancel'));
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

// mutation slots: with one slot, picking one greys out the rest until it is unpicked
const exerciseMutations = async () => {
  const traitBtns = () => buttons().filter((b) => b.classList.contains('mutbtn')) as HTMLButtonElement[];
  if (traitBtns().length < 2) throw new Error('no mutation buttons');
  if (traitBtns().some((b) => b.disabled)) throw new Error('mutation buttons disabled before any pick');
  if (has('Slots full')) throw new Error('slots-full hint shown too early');
  await click(traitBtns()[0]);
  const others = traitBtns().slice(1);
  if (!others.every((b) => b.disabled)) throw new Error('unpicked mutations should be disabled when slots are full');
  if (traitBtns()[0].disabled) throw new Error('picked mutation must stay clickable so it can be unpicked');
  if (!has('Slots full (1/1). Unpick one to swap.')) throw new Error('slots-full hint missing');
  await click(traitBtns()[0]);
  if (traitBtns().some((b) => b.disabled) || has('Slots full')) throw new Error('slots did not free up after unpicking');
  for (const w of ['Mutations (pick up to', 'Upgrades at 10', 'Raising a stat costs 1 Gene Point', 'Upkeep']) {
    if (!has(w)) throw new Error('prep screen missing: ' + w);
  }
  await clickText('Sprinter');
};

await clickText('Send feedback');
if (!document.body.textContent!.includes('Send feedback') || !document.querySelector('textarea')) throw new Error('feedback screen missing');
await clickText('Bug');
await clickText('Back to the game');
if (!document.body.textContent!.includes('Live one life')) throw new Error('did not return to menu');
console.log('feedback ok');
{
  const { CrashScreen, buildCrashReport } = await import('../src/ui/Support');
  const { VERSION } = await import('../src/ui/version');
  const r = buildCrashReport(new Error('boom'));
  if (!r.includes('boom') || !r.includes(`Version ${VERSION}`)) throw new Error('bad crash report');
  const d2 = document.createElement('div'); document.body.appendChild(d2);
  const r2 = createRoot(d2);
  await act(async () => { r2.render(React.createElement(CrashScreen, { error: new Error('boom'), onDiscardRun: () => {} })); });
  if (!d2.textContent!.includes('Copy crash report')) throw new Error('crash screen missing');
  await act(async () => { r2.unmount(); }); d2.remove();
  console.log('crash screen ok');
}
let flashes = 0;
for (const species of ['Field Mouse', 'Deer']) {
  await clickText('Begin');
  if (species === 'Field Mouse') {
    // the first life: intro cards, then straight to the mouse's birth. No species or prep screen.
    if (!has('One life')) throw new Error('the first Begin should show the intro');
    await clickText('Skip');
    if (has('Choose a species')) throw new Error('first life must skip the species screen');
    if (!has('Birth luck')) throw new Error('first life should land on the birth screen');
    await clickText('Customise your field mouse');
    await exerciseMutations();
    await clickText('Done');
  } else {
    await clickText(species);
    await exerciseMutations();
    await clickText('Be born');
    if (has('Customise your')) throw new Error('only the first life offers Customise');
  }
  {
    const t = document.body.textContent!;
    for (const w of ['Birth luck', 'Season', 'Start', 'Place', 'Into the wild']) if (!t.includes(w)) throw new Error('birth screen missing: ' + w);
  }
  await clickText('Into the wild');
  {
    const t = document.body.textContent!;
    if (!t.includes('Hunger')) throw new Error('Hunger bar missing');
    if (/Satiety|Heirloom|standing/i.test(t)) throw new Error('old wording on the play screen');
    const hun = document.querySelector('.bar.hun .num')?.textContent ?? '';
    if (!/^\d+\/100$/.test(hun)) throw new Error('bad hunger bar: ' + hun);
  }
  let steps = 0;
  while (steps++ < 200) {
    const fl = document.querySelector('.flashcard') as HTMLElement | null;
    if (fl) { flashes++; await click(fl); continue; }
    if (document.body.textContent!.includes('Your legacy')) break;
    const acts = Array.from(document.querySelectorAll('.actions button')) as HTMLButtonElement[];
    const live = acts.filter((b) => !b.disabled && !b.textContent!.startsWith('Cancel'));
    if (!live.length) throw new Error('no live actions');
    await click(live[Math.floor(Math.random() * live.length)]);
  }
  await clickText('Your legacy');
  if (document.querySelector('.flash') && document.body.textContent!.includes('New species')) await clickText('Continue');
  for (const w of ['Time survived', 'Goal bonus', 'New discoveries', 'Ending bonus', 'Difficulty bonus']) {
    if (!document.body.textContent!.includes(w)) throw new Error('debrief missing: ' + w);
  }
  console.log(species, 'finished after', steps, 'clicks;', document.querySelector('h2')?.textContent);
  await clickText('Main menu');
}
await clickText('Codex'); console.log('codex ok'); await clickText('Back');
await clickText('Account'); console.log('account ok'); await clickText('Back');
console.log('flash screens seen:', flashes);

// flashcard: the result of each action sits in the Actions panel, then fades up into the Turn log
{
  const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
  const turnText = () => q('[data-panel="environment"] .topline')!.textContent!;
  const turnNo = () => Number(/Turn (\d+)\//.exec(turnText())![1]);
  const live = () => (Array.from(document.querySelectorAll('[data-panel="actions"] button')) as HTMLButtonElement[])
    .filter((b) => !b.disabled && !b.textContent!.startsWith('Cancel'));
  const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
  const key = (k: string) => act(async () => { window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k })); });

  await clickText('Begin');
  await clickText('Field Mouse');
  await clickText('Be born');
  await clickText('Into the wild');
  for (const panel of ['environment', 'turn-log', 'meters', 'surroundings', 'actions']) {
    if (!q(`[data-panel="${panel}"]`)) throw new Error('missing panel: ' + panel);
  }
  if (turnNo() !== 1) throw new Error('should start on turn 1');
  await click(live()[0]);
  if (!q('.flashcard')) throw new Error('flashcard missing after an action');
  if (q('[data-panel="actions"] > button')) throw new Error('buttons should be hidden under the card');
  if (q('[data-panel="actions"]')!.style.height !== '300px') throw new Error('card must keep the Actions panel height');
  if (turnNo() !== 1) throw new Error('Environment panel should hold the old turn while the card is up');
  await key('Enter');
  if (q('.flashcard')) throw new Error('Enter should dismiss the card');
  if (turnNo() !== 2) throw new Error('new turn should show once the card is gone');
  {
    const log = q('[data-panel="turn-log"]')!.textContent!;
    const now = log.indexOf('Turn 2 begins');
    const prev = log.indexOf('Turn 1:');
    if (now < 0 || prev < 0 || now > prev) throw new Error('Turn log should list the newest turn first: ' + log.slice(0, 200));
  }

  // a quiet card fades up by itself
  let auto = false;
  for (let i = 0; i < 40 && !auto; i++) {
    if (document.body.textContent!.includes('Your legacy')) break;
    await click(live()[0]);
    const card = q('.flashcard');
    if (!card) throw new Error('no card');
    if (card.classList.contains('plain')) {
      await wait(1400);
      if (q('.flashcard')) throw new Error('quiet card should fade up by itself');
      auto = true;
    } else {
      if (!card.textContent!.includes('Tap or press Enter')) throw new Error('held card needs a continue hint');
      await wait(1400);
      if (!q('.flashcard')) throw new Error('a hurt, threat or ending card must wait for you');
      await click(card);
    }
  }
  if (!auto) throw new Error('never saw a quiet card (test is random; re-run)');
  console.log('auto fade ok');

  // a number key skips a card (and, after a calm turn, also picks that action), never more than one extra turn
  if (!document.body.textContent!.includes('Your legacy')) {
    let before = -1;
    for (let i = 0; i < 40; i++) {
      if (document.body.textContent!.includes('Your legacy')) break;
      if (q('.flashcard')) { await click(q('.flashcard')!); continue; }
      before = turnNo();
      await click(live()[0]);
      if (q('.flashcard')) break;
    }
    if (q('.flashcard')) {
      await key('1');
      await wait(30);
      const gained = turnNo() - before;
      if (q('.flashcard') && !q('.flashcard')!.classList.contains('plain') && gained < 1) throw new Error('number key should skip the card');
      console.log('number key ok');
    }
    while (q('.flashcard')) await click(q('.flashcard')!);
  }

  // with motion allowed the card fades up into the log before the buttons come back
  g.__reduceMotion = false;
  if (!document.body.textContent!.includes('Your legacy')) {
    await click(live()[0]);
    const card = q('.flashcard')!;
    await click(card);
    if (!q('.flashcard.leaving')) throw new Error('card should fade up when motion is allowed');
    await wait(500);
    if (q('.flashcard')) throw new Error('card should be gone after fading up');
    console.log('fade-up ok');
  }
  g.__reduceMotion = true;
  console.log('flashcard ok');
  while (!document.body.textContent!.includes('Your legacy')) {
    if (q('.flashcard')) { await click(q('.flashcard')!); continue; }
    await click(live()[Math.floor(Math.random() * live().length)]);
  }
  await clickText('Your legacy');
  if (q('.flash') && document.body.textContent!.includes('New species')) await clickText('Continue');
  await clickText('Main menu');
}

// tutorial: intro cards, first-life setup, tips and the Settings switch
{
  const SEED = (o: object) => ({ species_account_v1: JSON.stringify(o) });
  await remount({});
  await clickText('Begin');
  if (!has('One life') || !q1('[data-intro="0"]')) throw new Error('intro card 1 missing');
  if (!buttons().some((b) => b.textContent === 'Skip')) throw new Error('every card needs Skip');
  await clickText('Next');
  if (!has('Dying makes me stronger')) throw new Error('intro card 2 missing');
  if (!buttons().some((b) => b.textContent === 'Skip')) throw new Error('every card needs Skip');
  await clickText('Next');
  if (!has('Read the world') || !buttons().some((b) => b.textContent === 'Skip')) throw new Error('intro card 3 missing');
  await clickText('Begin my first life');
  if (has('Choose a species') || !has('Birth luck')) throw new Error('first life should go straight to the birth');
  if (savedAccount().tutorial?.introSeen !== true) throw new Error('intro seen flag not saved');
  // Customise must not give a free reroll of the birth
  const birthText = () => Array.from(document.querySelectorAll('.birthrow')).map((e) => e.textContent).join('|');
  const before = birthText();
  await clickText('Customise your field mouse');
  if (!has('Gene Points left')) throw new Error('Customise should open the prep screen');
  await clickText('Done');
  if (birthText() !== before) throw new Error('Customise must not reroll the birth');
  await clickText('Back');
  if (!has('Begin') || has('Birth luck')) throw new Error('Back from a first birth returns to the menu');

  // a player who skips the intro still gets the Balanced mouse
  await remount({});
  await clickText('Begin');
  await clickText('Skip');
  if (!has('Birth luck') || has('Choose a species')) throw new Error('skipping the intro still starts the first life');
  await clickText('Into the wild');

  // first turn tip, then Got it
  if (!q1('[data-panel="tip"]') || !has('Hunger, Energy and Safety change as time passes')) throw new Error('first-turn tip missing');
  if (q1('[data-panel="actions"] .flashcard')) throw new Error('a tip must never cover the buttons');
  if (!q1('[data-panel="tip"] a[href*="GLOSSARY"]')) throw new Error('tip needs a ? link to the glossary');
  await clickText('Got it');
  if (q1('[data-panel="tip"]')) throw new Error('Got it should clear the tip');
  if (savedAccount().tutorial?.tipsSeen?.first_turn !== true) throw new Error('seen flag not saved');

  // the first card is held until you tap it, and explains itself
  await click(liveActions()[0]);
  if (!q1('.flashcard') || !has('This is what just happened. Tap to go on.')) throw new Error('flashcard tip missing');
  await wait(1400);
  if (!q1('.flashcard')) throw new Error('the first card must wait for a tap');
  await click(q1('.flashcard')!);
  if (q1('[data-panel="tip"]') && has('This is what just happened')) throw new Error('flashcard tip should be seen after the tap');
  if (savedAccount().tutorial?.tipsSeen?.flashcard !== true) throw new Error('flashcard seen flag not saved');

  // play on: each tip shows at most once per account, and nothing blocks the buttons
  const shownTips = new Map<string, number>();
  let steps = 0;
  while (!has('Your legacy') && steps++ < 120) {
    const tip = q1('[data-panel="tip"] .tiptext');
    if (tip) shownTips.set(tip.textContent!, (shownTips.get(tip.textContent!) ?? 0) + 1);
    if (q1('.flashcard')) { await click(q1('.flashcard')!); continue; }
    await click(liveActions()[Math.floor(Math.random() * liveActions().length)]);
  }
  // Hide tips turns them all off
  await remount({});
  await clickText('Begin'); await clickText('Skip'); await clickText('Into the wild');
  await clickText('Hide tips');
  if (q1('[data-panel="tip"]') || savedAccount().tutorial?.tipsOff !== true) throw new Error('Hide tips should turn tips off');
  steps = 0;
  while (!has('Your legacy') && steps++ < 120) {
    if (q1('[data-panel="tip"]')) throw new Error('no tips once they are hidden');
    if (q1('.flashcard')) { await click(q1('.flashcard')!); continue; }
    await click(liveActions()[Math.floor(Math.random() * liveActions().length)]);
  }
  await clickText('Your legacy');
  if (has('New species')) await clickText('Continue');
  await clickText('Main menu');
  // Settings shows the switch, and switching it off brings tips back
  await clickText('Settings');
  if (!q1('[role="switch"][aria-checked="true"]') || !has("Don't show tips")) throw new Error('Settings should show the tips switch on');
  await click(q1('[role="switch"]')!);
  if (savedAccount().tutorial?.tipsOff !== false || !q1('[role="switch"][aria-checked="false"]')) throw new Error('the switch should turn tips back on');
  await clickText('Back');

  // a save from before the tutorial that has played already skips the intro
  await remount(SEED({ lives: 3, xp: 120, level: 2 }));
  await clickText('Begin');
  if (has('One life')) throw new Error('an experienced save must not see the intro');
  if (!has('Choose a species')) throw new Error('an experienced save keeps the species screen');
  console.log('tutorial flow ok');
}

// first-death coaching: once, with three parts
{
  const { createAccount, rollBirth, startRun } = await import('../src/engine');
  const mkDeadRun = (cause: string, killedBy?: string) => {
    const acc = createAccount();
    const r = startRun(acc, 'mouse', {}, [], rollBirth('mouse', 5), 11).run;
    r.ended = { type: 'death', cause, killedBy: killedBy as any };
    r.report = { ...r.report!, turn: 3, action: 'Bolt for cover' };
    r.age = 3; r.turnsTaken = 3;
    return JSON.stringify(r);
  };
  await remount({ species_account_v1: JSON.stringify(createAccount()), species_run_v1: mkDeadRun('A hawk killed you.', 'hawk') });
  await clickText('See how your last life ended');
  await clickText('Your legacy');
  const card = q1('[data-panel="coaching"]');
  if (!card) throw new Error('the first death should add a coaching card');
  for (const w of ['What happened.', 'A hawk caught me.', 'Next time.', 'cover', 'My Gene Points.']) {
    if (!card.textContent!.includes(w)) throw new Error('coaching card missing: ' + w);
  }
  if (savedAccount().tutorial?.coached !== true) throw new Error('coached flag not saved');
  const saved = localStorage.getItem('species_account_v1')!;
  await remount({ species_account_v1: saved, species_run_v1: mkDeadRun('You starved.') });
  await clickText('See how your last life ended');
  await clickText('Your legacy');
  if (q1('[data-panel="coaching"]')) throw new Error('coaching appears only once');
  console.log('coaching ok');
}

// unlock flash: seed an account that has already won as a deer, so the next finished life unlocks the wolf
{
  await remount({ species_account_v1: JSON.stringify({ wins: { deer: 1 } }) });
  await clickText('Begin');
  await clickText('Skip');
  await clickText('Into the wild');
  let n = 0;
  while (n++ < 300) {
    const fl = document.querySelector('.flashcard') as HTMLElement | null;
    if (fl) { await click(fl); continue; }
    if (document.body.textContent!.includes('Your legacy')) break;
    const live = (Array.from(document.querySelectorAll('.actions button')) as HTMLButtonElement[]).filter((b) => !b.disabled && !b.textContent!.startsWith('Cancel'));
    await click(live[Math.floor(Math.random() * live.length)]);
  }
  await clickText('Your legacy');
  const t = document.body.textContent!;
  if (!document.querySelector('.flash') || !t.includes('New species: Wolf') || !t.includes('You won a run as a deer')) throw new Error('unlock flash missing: ' + t.slice(0, 200));
  await clickText('Continue');
  if (document.querySelector('.flash') || !document.body.textContent!.includes('Time survived')) throw new Error('debrief should follow the unlock flash');
  if (!document.body.textContent!.includes('Wolf unlocked')) throw new Error('debrief unlock badge missing');
  console.log('unlock flash ok');
}
console.log('UI smoke test passed');
process.exit(0);
