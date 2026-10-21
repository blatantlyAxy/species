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
  await clickText(species);
  {
    // mutation slots: with one slot, picking one greys out the rest until it is unpicked
    const traitBtns = () => buttons().filter((b) => b.classList.contains('mutbtn')) as HTMLButtonElement[];
    if (traitBtns().length < 2) throw new Error('no mutation buttons');
    if (traitBtns().some((b) => b.disabled)) throw new Error('mutation buttons disabled before any pick');
    if (document.body.textContent!.includes('Slots full')) throw new Error('slots-full hint shown too early');
    await click(traitBtns()[0]);
    const others = traitBtns().slice(1);
    if (!others.every((b) => b.disabled)) throw new Error('unpicked mutations should be disabled when slots are full');
    if (traitBtns()[0].disabled) throw new Error('picked mutation must stay clickable so it can be unpicked');
    if (!document.body.textContent!.includes('Slots full (1/1). Unpick one to swap.')) throw new Error('slots-full hint missing');
    await click(traitBtns()[0]);
    if (traitBtns().some((b) => b.disabled) || document.body.textContent!.includes('Slots full')) throw new Error('slots did not free up after unpicking');
    for (const w of ['Mutations (pick up to', 'Upgrades at 10', 'Raising a stat costs 1 Gene Point', 'Upkeep']) {
      if (!document.body.textContent!.includes(w)) throw new Error('prep screen missing: ' + w);
    }
    await clickText('Sprinter');
  }
  await clickText('Be born');
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

// unlock flash: seed an account that has already won as a deer, so the next finished life unlocks the wolf
{
  await act(async () => { root.unmount(); });
  localStorage.clear();
  localStorage.setItem('species_account_v1', JSON.stringify({ wins: { deer: 1 } }));
  const d3 = document.createElement('div'); document.body.appendChild(d3);
  const root3 = createRoot(d3);
  await act(async () => { root3.render(React.createElement(App)); });
  await clickText('Begin');
  await clickText('Field Mouse');
  await clickText('Be born');
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
