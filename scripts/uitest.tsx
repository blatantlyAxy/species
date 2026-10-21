import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis as any;
g.window = dom.window; g.document = dom.window.document; g.localStorage = dom.window.localStorage;
g.HTMLElement = dom.window.HTMLElement; g.KeyboardEvent = dom.window.KeyboardEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;
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
    const fl = document.querySelector('.flash button') as HTMLButtonElement | null;
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
    const fl = document.querySelector('.flash button') as HTMLButtonElement | null;
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
