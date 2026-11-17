import { LEVEL_XP, MASTERY_STEPS, PERKS, SPECIES, TIER2_USES, TRAITS, levelForXp } from './data';
import { progressOf, stageOf } from './run';
import { coachingFor } from './tutorial';
import type {
  Account, CodexId, DebriefReport, PayoutBreakdown, RunState, SpeciesId, TipId, TraitId, TutorialState,
} from './types';

void LEVEL_XP;

export const CODEX_IDS: CodexId[] = ['mouse', 'deer', 'wolf', 'hawk', 'fox'];

/**
 * Save schema version. Bump it when the shape of Account changes and teach normalizeAccount the step.
 * 1: up to v0.7.0. 2: v1.0.0 (youthDeaths, settings). 3: v1.1.0 (settings.classicScene).
 */
export const SAVE_VERSION = 3;
/** Deaths before adulthood needed to reveal the mayfly. */
export const MAYFLY_YOUTH_DEATHS = 3;

export function createAccount(): Account {
  return {
    version: SAVE_VERSION, xp: 0, level: 1, lives: 0,
    unlocked: { mouse: true, deer: true, wolf: false },
    hiddenFound: { mayfly: false },
    youthDeaths: 0,
    settings: { actionList: false, classicScene: false },
    codex: { mouse: 0, deer: 0, wolf: 0, hawk: 0, fox: 0 },
    mastery: { mouse: 0, deer: 0, wolf: 0 },
    gp: { mouse: SPECIES.mouse.startGp, deer: SPECIES.deer.startGp, wolf: 0 },
    wins: { mouse: 0, deer: 0, wolf: 0 },
    traitUses: { zigzag: 0, keen_nose: 0, thick_coat: 0 },
    tutorial: createTutorial(),
  };
}

export const TIP_IDS: TipId[] = ['first_turn', 'meter_low', 'predator', 'flashcard', 'travel', 'hurt', 'season'];

export function createTutorial(): TutorialState {
  return {
    introSeen: false, tipsOff: false, coached: false,
    tipsSeen: Object.fromEntries(TIP_IDS.map((t) => [t, false])) as Record<TipId, boolean>,
  };
}

const num = (v: unknown, d: number, lo = 0, hi = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;

/** Merge a saved record of numbers over the defaults, dropping keys the game no longer has and bad values. */
function nums<K extends string>(base: Record<K, number>, saved: any, hi?: number): Record<K, number> {
  const out = { ...base };
  if (saved && typeof saved === 'object') {
    for (const k of Object.keys(base) as K[]) out[k] = num(saved[k], base[k], 0, hi);
  }
  return out;
}
function flags<K extends string>(base: Record<K, boolean>, saved: any): Record<K, boolean> {
  const out = { ...base };
  if (saved && typeof saved === 'object') {
    for (const k of Object.keys(base) as K[]) if (typeof saved[k] === 'boolean') out[k] = saved[k];
  }
  return out;
}

/**
 * Bring a saved account up to date, whatever build wrote it. Missing fields get defaults, unknown fields are
 * dropped, and damaged values fall back to defaults instead of crashing the game later. A save from before the
 * tutorial existed that has already played a life skips the intro and the first-death coaching.
 */
export function normalizeAccount(raw: any): Account {
  const base = createAccount();
  if (!raw || typeof raw !== 'object') return base;
  const t = createTutorial();
  const saved = raw.tutorial && typeof raw.tutorial === 'object' ? raw.tutorial : null;
  const lives = Math.floor(num(raw.lives, 0));
  if (!saved && lives > 0) { t.introSeen = true; t.coached = true; }
  const xp = Math.floor(num(raw.xp, 0));
  const unlocked = flags(base.unlocked, raw.unlocked);
  unlocked.mouse = true;
  unlocked.deer = true;
  return {
    version: SAVE_VERSION,
    xp, level: levelForXp(xp), lives,
    unlocked,
    hiddenFound: flags(base.hiddenFound, raw.hiddenFound),
    youthDeaths: Math.floor(num(raw.youthDeaths, 0)),
    settings: flags(base.settings, raw.settings),
    codex: nums(base.codex, raw.codex, 100),
    mastery: nums(base.mastery, raw.mastery),
    gp: nums(base.gp, raw.gp),
    wins: nums(base.wins, raw.wins),
    traitUses: nums(base.traitUses, raw.traitUses),
    tutorial: {
      introSeen: typeof saved?.introSeen === 'boolean' ? saved.introSeen : t.introSeen,
      tipsOff: typeof saved?.tipsOff === 'boolean' ? saved.tipsOff : t.tipsOff,
      coached: typeof saved?.coached === 'boolean' ? saved.coached : t.coached,
      tipsSeen: flags(t.tipsSeen, saved?.tipsSeen),
    },
  };
}

export function masteryLevel(xp: number): number {
  let l = 0;
  for (let i = 1; i < MASTERY_STEPS.length; i++) if (xp >= MASTERY_STEPS[i]) l = i;
  return l;
}

export function wolfUnlockProgress(a: Account): { fam: number; deerWins: number } {
  return { fam: a.codex.wolf, deerWins: a.wins.deer };
}

export function computePayout(run: RunState, newDiscoveries: number): PayoutBreakdown {
  const def = SPECIES[run.species];
  const end = run.ended!;
  const survival = run.age;
  const progress = progressOf(run);
  const goal = Math.round(40 * progress);
  const speed = 1 - run.age / def.maxAge;
  const feats = end.type === 'win' ? Math.round(30 * (0.5 + 0.5 * speed)) : 0;
  const discoveries = 10 * newDiscoveries;
  const endingMult = end.type === 'win' ? 2 : end.type === 'old_age' ? 1.2 : 1;
  const difficulty = def.difficulty;
  const xp = Math.round((survival + goal + feats + discoveries) * endingMult * difficulty);
  const gpGain = 2 + (end.type === 'win' ? 3 : 0);
  return { survival, goal, feats, discoveries, endingMult, difficulty, xp, gpGain };
}

/** Apply a finished run to the account and build the debrief. */
export function finishRun(account: Account, run: RunState): { account: Account; report: DebriefReport } {
  if (!run.ended) throw new Error('Run is not finished.');
  const acc: Account = structuredClone(account);
  const species = run.species;
  const end = run.ended;
  const notes: string[] = [];
  const unlocks: string[] = [];
  const newSpecies: NonNullable<DebriefReport['newSpecies']> = [];
  const traitTierUps: string[] = [];

  // killed-by familiarity (the lowest gain)
  const gains: Partial<Record<CodexId, number>> = { ...run.famGain };
  if (end.type === 'death' && end.killedBy) {
    const cur = gains[end.killedBy] ?? 0;
    const add = Math.min(2, 40 - cur);
    if (add > 0) {
      gains[end.killedBy] = cur + add;
      notes.push(`${end.killedBy === 'wolf' ? 'Wolf' : end.killedBy === 'hawk' ? 'Hawk' : 'Fox'} familiarity +${add} (killed by it, the smallest gain).`);
    }
  }

  const famChanges: DebriefReport['famChanges'] = [];
  let newEntries = 0;
  for (const id of CODEX_IDS) {
    const g = gains[id] ?? 0;
    if (g <= 0) continue;
    const before = acc.codex[id];
    const after = Math.min(100, before + g);
    if (before === 0 && after > 0) newEntries++;
    acc.codex[id] = after;
    famChanges.push({ id, before, after, gained: after - before });
  }

  // mastery
  const masteryBefore = acc.mastery[species];
  acc.mastery[species] += run.age + (end.type === 'win' ? 15 : 0);
  const masteryAfter = acc.mastery[species];
  const lvlUps = Math.max(0, masteryLevel(masteryAfter) - masteryLevel(masteryBefore));

  const payout = computePayout(run, newEntries + lvlUps);
  const levelBefore = acc.level;
  acc.xp += payout.xp;
  acc.level = levelForXp(acc.xp);
  const newPerks = PERKS.filter((p) => p.level > levelBefore && p.level <= acc.level);

  acc.gp[species] += payout.gpGain;
  acc.lives++;
  if (end.type === 'win') acc.wins[species]++;

  // trait use and tiers
  for (const t of Object.keys(run.traitUsesRun) as TraitId[]) {
    const before = acc.traitUses[t];
    acc.traitUses[t] += run.traitUsesRun[t];
    if (before < TIER2_USES && acc.traitUses[t] >= TIER2_USES) {
      traitTierUps.push(`${TRAITS[t].name} has awakened (Tier II). ${TRAITS[t].tier2}`);
    }
  }

  // unlocks
  if (!acc.unlocked.wolf && (acc.codex.wolf >= 100 || acc.wins.deer >= 1)) {
    acc.unlocked.wolf = true;
    acc.gp.wolf += SPECIES.wolf.startGp;
    const byCodex = acc.codex.wolf >= 100;
    unlocks.push(byCodex ? 'Wolf unlocked: you know them well enough to become one.' : 'Wolf unlocked: the herd survived, and the hunters are next.');
    newSpecies.push({
      id: 'wolf',
      condition: byCodex ? 'You filled the Wolf entry in your codex.' : 'You won a run as a deer.',
    });
  }
  // the mayfly: cut short in youth, three times, as any species
  if (end.type === 'death' && stageOf(run) === 'juvenile') {
    acc.youthDeaths++;
    if (!acc.hiddenFound.mayfly && acc.youthDeaths >= MAYFLY_YOUTH_DEATHS) {
      acc.hiddenFound.mayfly = true;
      unlocks.push('Something stirred in the margins of your codex. Three lives cut short have shown you a hidden species: the mayfly.');
    }
  }

  // the first death gets one coaching card, once
  let coaching: DebriefReport['coaching'];
  if (end.type === 'death' && !acc.tutorial.coached) {
    coaching = coachingFor(run);
    acc.tutorial.coached = true;
  }

  const report: DebriefReport = {
    species, end, turns: run.age, payout, levelBefore, levelAfter: acc.level, newPerks, famChanges,
    masteryBefore, masteryAfter, unlocks, traitTierUps, notes, newSpecies, coaching,
  };
  return { account: acc, report };
}

export function speciesUnlockStatus(a: Account, id: SpeciesId): string {
  if (a.unlocked[id]) return 'Unlocked';
  if (id === 'wolf') return `Wolf familiarity ${a.codex.wolf}/100, or win a run as a deer`;
  return 'Locked';
}
