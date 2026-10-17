import { LEVEL_XP, MASTERY_STEPS, PERKS, SPECIES, TIER2_USES, TRAITS, levelForXp } from './data';
import { progressOf } from './run';
import type {
  Account, CodexId, DebriefReport, PayoutBreakdown, RunState, SpeciesId, TraitId,
} from './types';

void LEVEL_XP;

export const CODEX_IDS: CodexId[] = ['mouse', 'deer', 'wolf', 'hawk', 'fox'];

export function createAccount(): Account {
  return {
    version: 1, xp: 0, level: 1, lives: 0,
    unlocked: { mouse: true, deer: true, wolf: false },
    hiddenFound: { mayfly: false },
    codex: { mouse: 0, deer: 0, wolf: 0, hawk: 0, fox: 0 },
    mastery: { mouse: 0, deer: 0, wolf: 0 },
    gp: { mouse: SPECIES.mouse.startGp, deer: SPECIES.deer.startGp, wolf: 0 },
    wins: { mouse: 0, deer: 0, wolf: 0 },
    traitUses: { zigzag: 0, keen_nose: 0, thick_coat: 0 },
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
    unlocks.push(acc.codex.wolf >= 100 ? 'Wolf unlocked: you know them well enough to become one.' : 'Wolf unlocked: the herd survived, and the hunters are next.');
  }
  const day = SPECIES[species].turnsPerDay;
  if (!acc.hiddenFound.mayfly && run.turnsTaken <= day) {
    acc.hiddenFound.mayfly = true;
    unlocks.push('Something stirred in the margins of your codex. A hidden species has been found. (Not playable in this prototype.)');
  }

  const report: DebriefReport = {
    end, turns: run.age, payout, levelBefore, levelAfter: acc.level, newPerks, famChanges,
    masteryBefore, masteryAfter, unlocks, traitTierUps, notes,
  };
  return { account: acc, report };
}

export function speciesUnlockStatus(a: Account, id: SpeciesId): string {
  if (a.unlocked[id]) return 'Unlocked';
  if (id === 'wolf') return `Wolf familiarity ${a.codex.wolf}/100, or win a run as a deer`;
  return 'Locked';
}
