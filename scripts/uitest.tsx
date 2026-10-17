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
  const r = buildCrashReport(new Error('boom'));
  if (!r.includes('boom') || !r.includes('Version 0.4.0')) throw new Error('bad crash report');
  const d2 = document.createElement('div'); document.body.appendChild(d2);
  const r2 = createRoot(d2);
  await act(async () => { r2.render(React.createElement(CrashScreen, { error: new Error('boom'), onDiscardRun: () => {} })); });
  if (!d2.textContent!.includes('Copy crash report')) throw new Error('crash screen missing');
  await act(async () => { r2.unmount(); }); d2.remove();
  console.log('crash screen ok');
}
let flashes = 0;
for (const species of ['Field Mouse', 'Deer']) {
  await clickText('Start Play');
  await clickText(species);
  await clickText('Be born');
  await clickText('Begin life');
  let steps = 0;
  while (steps++ < 200) {
    const fl = document.querySelector('.flash button') as HTMLButtonElement | null;
    if (fl) { flashes++; await click(fl); continue; }
    if (document.body.textContent!.includes('See the debrief')) break;
    const acts = Array.from(document.querySelectorAll('.actions button')) as HTMLButtonElement[];
    const live = acts.filter((b) => !b.disabled && !b.textContent!.startsWith('Cancel'));
    if (!live.length) throw new Error('no live actions');
    await click(live[Math.floor(Math.random() * live.length)]);
  }
  await clickText('See the debrief');
  console.log(species, 'finished after', steps, 'clicks;', document.querySelector('h2')?.textContent);
  await clickText('Main menu');
}
await clickText('Codex'); console.log('codex ok'); await clickText('Back');
await clickText('Account'); console.log('account ok'); await clickText('Back');
console.log('flash screens seen:', flashes);
console.log('UI smoke test passed');
process.exit(0);
