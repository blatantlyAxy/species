import { getActions, getView } from '../src/engine';
import type { RunState } from '../src/engine';

export function pickForTrace(run: RunState): { id: string; target?: string } {
  const view = getView(run);
  const acts = getActions(run).filter((a) => !a.disabled);
  const has = (id: string) => acts.find((a) => a.id === id);
  const ev = run.event;

  if (ev && ev.kind === 'threat') {
    if (run.species === 'mouse') return has('hide') ? { id: 'hide' } : { id: acts[0].id };
    if (run.species === 'deer') return has('warn') ? { id: 'warn' } : { id: acts[0].id };
    return has('fight') && run.hp > 6 ? { id: 'fight' } : { id: 'submit' };
  }
  if (view.energy < 25 && has('rest')) return { id: 'rest' };
  if (view.hp < view.maxHp * 0.5 && view.satiety > 40 && has('rest')) return { id: 'rest' };

  if (run.species === 'mouse') {
    if (view.satiety < 40 && has('forage')) return { id: 'forage' };
    if (has('nurse')) return { id: 'nurse' };
    if (has('breed')) return { id: 'breed' };
    if (view.satiety < 70 && has('forage')) return { id: 'forage' };
    // move to a place with cover for breeding
    const loc = view.locName;
    if (loc === 'Open Meadow' || loc === 'Shallow Ford') {
      const t = getActions(run).find((a) => a.id === 'travel');
      const dest = t?.targets?.find((x) => x.label === 'Clover Field' || x.label === 'Birch Edge');
      if (dest && has('travel')) return { id: 'travel', target: dest.id };
    }
    if (has('forage')) return { id: 'forage' };
    return { id: 'rest' };
  }
  if (run.species === 'deer') {
    if (view.satiety < 40 && has('forage')) return { id: 'forage' };
    if (has('vie') && view.energy > 24 && view.satiety > 50) return { id: 'vie' };
    if (run.age >= 8 && has('lead')) return { id: 'lead' };
    if (run.age >= 6 && has('follow')) return { id: 'follow' };
    if (has('settle')) return { id: 'settle' };
    if (has('forage')) return { id: 'forage' };
    return { id: 'rest' };
  }
  // wolf
  if (view.satiety < 60) {
    if (has('scavenge')) return { id: 'scavenge' };
    if (has('hunt_deer')) return { id: 'hunt_deer' };
    const t = getActions(run).find((a) => a.id === 'travel');
    if (t?.targets && has('travel') && (run.world.deer[run.loc] ?? 0) < 1) {
      const best = t.targets.slice().sort((x, y) => (run.world.deer[y.id] ?? 0) - (run.world.deer[x.id] ?? 0))[0];
      return { id: 'travel', target: best.id };
    }
    if (has('hunt_small')) return { id: 'hunt_small' };
  }
  if (has('challenge') && view.hp > 7 && run.standing >= (5 - run.rank) * 0.8) return { id: 'challenge' };
  if (has('hunt_deer') && view.satiety < 85) return { id: 'hunt_deer' };
  if (has('howl')) return { id: 'howl' };
  return { id: 'rest' };
}
