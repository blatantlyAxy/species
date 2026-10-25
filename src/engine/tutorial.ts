import { SEASON_LEN } from './data';
import type { Coaching, RunState, RunView, SpeciesId, TipId } from './types';

// First-time tips and first-death coaching. Pure rules, no UI. Wording is a draft in the narrator-as-the-animal
// voice (first person, short sentences); the language pass will finalise it.

/** Tips in the order they are offered when more than one is eligible at once. */
const ORDER: TipId[] = ['first_turn', 'meter_low', 'predator', 'flashcard', 'travel', 'hurt', 'season'];

export interface TipContext {
  /** The run as the panels show it (the previous turn while a flashcard is up). */
  run: RunState;
  view: RunView;
  /** True while the flashcard is showing the result of the player's action. */
  cardUp: boolean;
}

/** Which tips are triggered right now, in offer order. The caller drops the ones already seen. */
export function triggeredTips(c: TipContext): TipId[] {
  const { run, view } = c;
  if (c.cardUp) return ['flashcard'];
  const rep = run.report;
  const out: TipId[] = [];
  const has = (t: TipId) => out.push(t);
  if (run.turnsTaken === 0 && !run.ended) has('first_turn');
  if (!run.ended && (view.satiety < 30 || view.energy < 25 || view.hp * 3 <= view.maxHp)) has('meter_low');
  if (!run.ended && run.event?.kind === 'threat' && run.event.pred) has('predator');
  if (!run.ended && rep && rep.turn > 0 && /^(Travel|Lead the herd|Follow the herd)/.test(rep.action)) has('travel');
  if (!run.ended && rep && rep.turn > 0 && rep.afterArrival.hp < rep.before.hp) has('hurt');
  if (!run.ended && run.age > 0 && (run.age + run.startOffset) % SEASON_LEN === 0) has('season');
  return ORDER.filter((t) => out.includes(t));
}

const THREAT_OPTIONS: Record<SpeciesId, string> = {
  mouse: 'hide, bolt, or keep eating and gamble',
  deer: 'hide, bolt, stand and fight, or warn the herd',
  wolf: 'stand my ground, back down or slip away',
};

export function tipText(id: TipId, c: TipContext): string {
  const { run, view } = c;
  switch (id) {
    case 'first_turn':
      return 'Hunger, Energy and Safety change as time passes. I need to watch all three.';
    case 'meter_low':
      return 'I am running low. Eat or rest before it gets worse.';
    case 'predator':
      return `Something is watching me. I can ${THREAT_OPTIONS[run.species]}, ${run.showOdds ? 'and the odds are on each button' : 'and each button shows the stat it tests'}.`;
    case 'flashcard':
      return 'This is what just happened. Tap to go on.';
    case 'travel':
      return view.tier >= 1
        ? 'Each place has its own food and cover. The marks show danger and food nearby.'
        : 'Each place has its own food and cover. For now I can only see where I stand.';
    case 'hurt':
      return 'That cost me Health. Resting helps me recover.';
    case 'season':
      return 'The season changed. Food and cold change with it.';
  }
}

// ---- first-death coaching ----

type Kind = 'hawk' | 'fox' | 'wolf' | 'starved' | 'cold' | 'sick' | 'kick' | 'packmate' | 'other';

function deathKind(run: RunState): Kind {
  const end = run.ended;
  if (!end || end.type !== 'death') return 'other';
  if (end.killedBy === 'hawk' || end.killedBy === 'fox' || end.killedBy === 'wolf') return end.killedBy;
  const c = end.cause.toLowerCase();
  if (c.includes('starv')) return 'starved';
  if (c.includes('froze')) return 'cold';
  if (c.includes('sickness')) return 'sick';
  if (c.includes('deer')) return 'kick';
  if (c.includes('pack-mate')) return 'packmate';
  return 'other';
}

const COACH: Record<Kind, Coaching> = {
  hawk: {
    ended: 'A hawk caught me.',
    suggestion: 'Hawks hunt open ground and shy from thick cover. Next time I will stay near cover, and hide when its shadow falls.',
    spend: 'Senses help me hide, and Mobility helps me bolt.',
  },
  fox: {
    ended: 'A fox caught me.',
    suggestion: 'A fox stalks, then pounces. Thick cover helps me hide, and I will keep some Energy in reserve so I can still bolt.',
    spend: 'Senses help me hide, and Mobility helps me bolt.',
  },
  wolf: {
    ended: 'The wolves caught me.',
    suggestion: 'I cannot beat a wolf pack head on. Next time I will hide in cover, or bolt early while I still have Energy.',
    spend: 'Mobility helps me outrun them, and Senses help me spot them first.',
  },
  starved: {
    ended: 'I starved.',
    suggestion: 'I will eat before Hunger gets high, and move to a richer place when the food runs thin. Clover Field is the best.',
    spend: 'Strength, Stamina and Intelligence make me hungrier, so I will keep those low.',
  },
  cold: {
    ended: 'The cold killed me.',
    suggestion: 'Winter is hard outside sheltered ground. Next time I will reach the Sheltered Glen before the cold sets in, and keep off Windy Ridge.',
    spend: 'Health helps me last longer, and the Thick Coat mutation shrugs the cold off.',
  },
  sick: {
    ended: 'Sickness killed me.',
    suggestion: 'Sickness strikes in summer and autumn. I will keep my Health up, and eat and rest so I can take a hit.',
    spend: 'More Health helps me shake sickness off.',
  },
  kick: {
    ended: 'A deer kicked me dead.',
    suggestion: 'A failed hunt can end in a kick. Next time I will rest to heal first, and take the small prey when my Health is low.',
    spend: 'Strength and Mobility make a hunt more likely to land.',
  },
  packmate: {
    ended: 'A pack-mate beat me in a challenge.',
    suggestion: 'I will only challenge when my Health is high and my rank progress is up. Winning small fights first helps.',
    spend: 'Strength decides a challenge.',
  },
  other: {
    ended: 'My life ended.',
    suggestion: 'I will watch my meters and take the safer choice when a threat shows up.',
    spend: 'Health, Senses and Mobility are good places to start.',
  },
};

export function coachingFor(run: RunState): Coaching {
  return COACH[deathKind(run)];
}

