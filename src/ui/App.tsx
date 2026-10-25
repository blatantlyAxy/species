import { Feedback, VersionFooter } from './Support';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CODEX_NOTES, FIRST_SPECIES, INTRO_CARDS, PERKS, SPECIES, STAT_FLOOR, STATS, STAT_LABEL, TIER2_USES, TRAITS, TRAIT_IDS, MASTERY_STEPS,
  act, birthRows, createAccount, finishRun, getView, masteryLevel, normalizeAccount, rollBirth, startRun, statUpkeep,
  tipText, traitSlots, triggeredTips, upkeepOf, xpForLevel,
} from '../engine';
import type {
  Account, Action, BirthRoll, CodexId, DebriefReport, RunState, RunView, Snap, SpeciesId, Stat, TipId, TraitId, TurnReport,
  TutorialState,
} from '../engine';

type Screen =
  | 'feedback' | 'menu' | 'intro' | 'select' | 'prep' | 'birth' | 'play' | 'unlock' | 'debrief' | 'codex' | 'account' | 'settings';

const GLOSSARY_URL = 'https://github.com/blatantlyAxy/species/blob/main/GLOSSARY.md';

const ACCOUNT_KEY = 'species_account_v1';
const RUN_KEY = 'species_run_v1';
const PRED_EMOJI: Record<string, string> = { hawk: '🦅', fox: '🦊', wolf: '🐺', rival: '🐺' };

function loadAccount(): Account {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (raw) return normalizeAccount(JSON.parse(raw));
  } catch { /* ignore */ }
  return createAccount();
}

function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (raw) return JSON.parse(raw) as RunState;
  } catch { /* ignore */ }
  return null;
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* ignore */ }
}

const newSeed = () => (Math.floor(Math.random() * 2 ** 31) + 1) >>> 0;

export function App() {
  const [account, setAccount] = useState<Account>(loadAccount);
  const [run, setRun] = useState<RunState | null>(loadRun);
  const [screen, setScreen] = useState<Screen>('menu');
  const [species, setSpecies] = useState<SpeciesId>('mouse');
  const [invest, setInvest] = useState<Partial<Record<Stat, number>>>({});
  const [traits, setTraits] = useState<TraitId[]>([]);
  const [birth, setBirth] = useState<BirthRoll | null>(null);
  const [rerolled, setRerolled] = useState(false);
  const [report, setReport] = useState<DebriefReport | null>(null);
  const [customising, setCustomising] = useState(false);

  useEffect(() => safeSet(ACCOUNT_KEY, JSON.stringify(account)), [account]);
  useEffect(() => safeSet(RUN_KEY, run ? JSON.stringify(run) : null), [run]);

  const [fbFrom, setFbFrom] = useState<Screen>('menu');
  const openFeedback = () => { if (screen !== 'feedback') setFbFrom(screen); setScreen('feedback'); };
  const fbContext = [
    `Screen: ${fbFrom}`,
    `Account level ${account.level}, ${account.lives} lives`,
    run ? `Run: ${run.species}, turn ${run.age}, ${run.loc}, hp ${run.hp}` : 'No run in progress',
  ].join('. ');

  const setTutorial = (f: (t: TutorialState) => TutorialState) => setAccount((a) => ({ ...a, tutorial: f(a.tutorial) }));

  /** The first life skips the species and prep screens: the lowest species, Balanced, no mutation. */
  const goSelect = () => {
    if (account.lives === 0) {
      setSpecies(FIRST_SPECIES);
      setInvest({});
      setTraits([]);
      setCustomising(false);
      if (!account.tutorial.introSeen) setScreen('intro');
      else beBorn(FIRST_SPECIES);
      return;
    }
    setScreen('select');
  };

  const finishIntro = () => {
    setTutorial((t) => ({ ...t, introSeen: true }));
    beBorn(FIRST_SPECIES);
  };

  const choose = (id: SpeciesId) => {
    setCustomising(false);
    setSpecies(id);
    setInvest({});
    setTraits((t) => t.slice(0, traitSlots(account)));
    setScreen('prep');
  };

  const beBorn = (sp: SpeciesId = species) => {
    setBirth(rollBirth(sp, newSeed()));
    setRerolled(false);
    setScreen('birth');
  };

  const begin = () => {
    if (!birth) return;
    try {
      const res = startRun(account, species, invest, traits, birth, newSeed());
      setAccount(res.account);
      setRun(res.run);
      setReport(null);
      setCustomising(false);
      setScreen('play');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const finish = () => {
    if (!run || !run.ended) return;
    const res = finishRun(account, run);
    setAccount(res.account);
    setSpecies(run.species);
    setReport(res.report);
    setRun(null);
    setScreen(res.report.newSpecies?.length ? 'unlock' : 'debrief');
  };

  const [eraseArmed, setEraseArmed] = useState(false);
  const resetAll = () => {
    if (!eraseArmed) { setEraseArmed(true); return; }
    setAccount(createAccount());
    setRun(null);
    setReport(null);
    setEraseArmed(false);
    setScreen('menu');
  };

  return (
    <div className="console">
      {screen === 'menu' && (
        <Menu account={account} hasRun={!!run && !run.ended} hasEnded={!!run?.ended}
          onContinue={() => { if (run) setSpecies(run.species); setScreen('play'); }} onStart={goSelect}
          onCodex={() => setScreen('codex')} onAccount={() => setScreen('account')} onSettings={() => setScreen('settings')}
          onReset={resetAll} eraseArmed={eraseArmed} />
      )}
      {screen === 'intro' && <Intro onDone={finishIntro} />}
      {screen === 'select' && <Select account={account} onPick={choose} onBack={() => setScreen('menu')} />}
      {screen === 'prep' && (
        <Prep account={account} species={species} invest={invest} setInvest={setInvest}
          traits={traits} setTraits={setTraits} customising={customising}
          onBorn={() => (customising ? setScreen('birth') : beBorn())}
          onBack={() => (customising ? setScreen('birth') : goSelect())} />
      )}
      {screen === 'birth' && birth && (
        <Birth account={account} birth={birth} species={species} rerolled={rerolled}
          onReroll={() => { setBirth(rollBirth(species, newSeed())); setRerolled(true); }}
          onCustomise={account.lives === 0 ? () => { setCustomising(true); setScreen('prep'); } : undefined}
          onBegin={begin} onBack={() => setScreen(account.lives === 0 ? 'menu' : 'prep')} />
      )}
      {screen === 'play' && run && (
        <Play account={account} run={run} onRun={setRun} onFinish={finish} onMenu={() => setScreen('menu')}
          onTipSeen={(id) => setTutorial((t) => (t.tipsSeen[id] ? t : { ...t, tipsSeen: { ...t.tipsSeen, [id]: true } }))}
          onHideTips={() => setTutorial((t) => ({ ...t, tipsOff: true }))} />
      )}
      {screen === 'unlock' && report?.newSpecies?.length ? (
        <UnlockFlash species={report.newSpecies} onContinue={() => setScreen('debrief')} />
      ) : null}
      {screen === 'debrief' && report && (
        <Debrief report={report} species={report.species} account={account}
          onAgain={() => choose(report.species)} onMenu={() => setScreen('menu')} />
      )}
      {screen === 'codex' && <Codex account={account} onBack={() => setScreen('menu')} />}
      {screen === 'account' && <AccountScreen account={account} onBack={() => setScreen('menu')} />}
      {screen === 'settings' && (
        <SettingsScreen account={account} onBack={() => setScreen('menu')}
          onTipsOff={(v) => setTutorial((t) => ({ ...t, tipsOff: v }))} />
      )}
      {screen === 'feedback' && <Feedback context={fbContext} onClose={() => setScreen(fbFrom)} />}
      {screen !== 'feedback' && <VersionFooter onFeedback={openFeedback} />}
    </div>
  );
}

// ---------------- menu ----------------

function levelProgress(a: Account): number {
  const lo = xpForLevel(a.level);
  const hi = xpForLevel(a.level + 1);
  return Math.max(0, Math.min(1, (a.xp - lo) / Math.max(1, hi - lo)));
}

function Menu(p: {
  account: Account; hasRun: boolean; hasEnded: boolean; onContinue: () => void; onStart: () => void;
  onCodex: () => void; onAccount: () => void; onSettings: () => void; onReset: () => void; eraseArmed: boolean;
}) {
  return (
    <>
      <div className="screen pad">
        <div className="title-art">🐭🦌🐺</div>
        <h1 style={{ textAlign: 'center' }}>Species</h1>
        <p className="dim" style={{ textAlign: 'center' }}>Live one life at a time. Die often. Come back stranger.</p>
        <div className="small dim">Level {p.account.level} &middot; {p.account.xp} XP &middot; {p.account.lives} lives lived</div>
        <div className="meter"><div style={{ width: `${levelProgress(p.account) * 100}%` }} /></div>
      </div>
      <div className="screen pad stack">
        {(p.hasRun || p.hasEnded) && (
          <button className="btn primary" onClick={p.onContinue}>{p.hasEnded ? 'See how your last life ended' : 'Continue your life'}</button>
        )}
        <button className="btn primary" onClick={p.onStart}>Begin</button>
        <button className="btn" onClick={p.onCodex}>Codex</button>
        <button className="btn" onClick={p.onAccount}>Account and perks</button>
        <button className="btn" onClick={p.onSettings}>Settings</button>
        <button className="btn" onClick={p.onReset}>{p.eraseArmed ? 'Tap again to erase everything' : 'Erase save'}</button>
      </div>
    </>
  );
}

// ---------------- intro ----------------

function Intro(p: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const card = INTRO_CARDS[i];
  const last = i === INTRO_CARDS.length - 1;
  return (
    <div className="screen pad stack introcard" data-intro={i}>
      <div className="title-art">{card.emoji}</div>
      <h2 style={{ textAlign: 'center' }}>{card.title}</h2>
      <p className="introtext">{card.text}</p>
      <div className="dots" aria-label={`Card ${i + 1} of ${INTRO_CARDS.length}`}>
        {INTRO_CARDS.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}
      </div>
      <button className="btn primary center" autoFocus onClick={() => (last ? p.onDone() : setI(i + 1))}>
        {last ? 'Begin my first life' : 'Next'}
      </button>
      <button className="btn center" onClick={p.onDone}>Skip</button>
    </div>
  );
}

function SettingsScreen(p: { account: Account; onTipsOff: (v: boolean) => void; onBack: () => void }) {
  const off = p.account.tutorial.tipsOff;
  return (
    <div className="screen pad stack">
      <h2>Settings</h2>
      <button className={`btn switch ${off ? 'on' : ''}`} role="switch" aria-checked={off} onClick={() => p.onTipsOff(!off)}>
        <span>Don't show tips</span>
        <span className="switchstate">{off ? 'On' : 'Off'}</span>
      </button>
      <p className="small dim">Tips are the one-line hints that appear the first time something comes up. Turning this on hides them all.</p>
      <button className="btn center" onClick={p.onBack}>Back</button>
    </div>
  );
}

// ---------------- species select ----------------

function Select(p: { account: Account; onPick: (id: SpeciesId) => void; onBack: () => void }) {
  const ids: SpeciesId[] = ['mouse', 'deer', 'wolf'];
  return (
    <div className="screen pad stack">
      <h2>Choose a species</h2>
      {ids.map((id) => {
        const d = SPECIES[id];
        const open = p.account.unlocked[id];
        return (
          <div key={id} className={`card ${open ? 'pick' : 'locked'}`} onClick={() => open && p.onPick(id)}>
            <div className="row spread">
              <b>{open ? d.emoji : '❔'} {open ? d.name : '???'}</b>
              <span className="badge">{open ? `${p.account.gp[id]} Gene Points` : 'Locked'}</span>
            </div>
            {open ? (
              <>
                <div className="small dim">{d.role}. Goal: {d.goal}</div>
                <div className="small dim">Mastery {masteryLevel(p.account.mastery[id])} &middot; {p.account.wins[id]} wins</div>
              </>
            ) : (
              <div className="small dim">
                {d.unlockText} (Wolf familiarity {p.account.codex.wolf}/100)
                <div className="meter"><div style={{ width: `${p.account.codex.wolf}%` }} /></div>
              </div>
            )}
          </div>
        );
      })}
      {p.account.hiddenFound.mayfly && (
        <div className="card locked">
          <b>🪰 Mayfly</b> <span className="badge">Hidden species found</span>
          <div className="small dim">Spawn within one day. Not playable in this prototype.</div>
        </div>
      )}
      <button className="btn center" onClick={p.onBack}>Back</button>
    </div>
  );
}

// ---------------- prep ----------------

type Invest = Partial<Record<Stat, number>>;

/** One-tap builds. They raise the "up" stats and lower the "down" stats, within caps and your Gene Points. */
const PRESETS: { id: string; label: string; up: Stat[]; down: Stat[] }[] = [
  { id: 'balanced', label: 'Balanced', up: [], down: [] },
  { id: 'brute', label: 'Brute', up: ['strength', 'health'], down: ['intelligence'] },
  { id: 'sprinter', label: 'Sprinter', up: ['mobility', 'stamina'], down: ['intelligence'] },
  { id: 'thinker', label: 'Thinker', up: ['intelligence', 'senses'], down: ['strength'] },
];

function presetInvest(species: SpeciesId, gp: number, preset: (typeof PRESETS)[number]): Invest {
  const d = SPECIES[species];
  const invest: Invest = {};
  let points = gp;
  for (const s of preset.down) {
    const lower = Math.min(2, d.baseStats[s] - STAT_FLOOR);
    if (lower > 0) { invest[s] = -lower; points += lower; }
  }
  let progressed = true;
  while (points > 0 && progressed) {
    progressed = false;
    for (const s of preset.up) {
      if (points <= 0) break;
      const cur = invest[s] ?? 0;
      if (d.baseStats[s] + cur >= d.caps[s]) continue;
      invest[s] = cur + 1;
      points--;
      progressed = true;
    }
  }
  return invest;
}

function sameInvest(a: Invest, b: Invest): boolean {
  return STATS.every((s) => (a[s] ?? 0) === (b[s] ?? 0));
}

/** What raising one stat costs, read from the engine's upkeep calculation (not hardcoded). */
function upkeepRules(species: SpeciesId, s: Stat): string[] {
  const base = SPECIES[species].baseStats[s];
  const out: string[] = [];
  const seen = new Set<string>();
  for (let k = 1; k <= 8; k++) {
    const u = statUpkeep(species, s, base + k);
    const per = k === 1 ? 'per point' : `per ${k} points`;
    if (u.hunger > 0 && !seen.has('hunger')) { seen.add('hunger'); out.push(`+${u.hunger} Hunger each turn ${per}`); }
    if (u.energy > 0 && !seen.has('energy')) { seen.add('energy'); out.push(`+${u.energy} Energy each turn ${per}`); }
    if (u.move > 0 && !seen.has('move')) { seen.add('move'); out.push(`+${u.move} Energy per move ${per}`); }
    if (u.growUp > 0 && !seen.has('growUp')) { seen.add('growUp'); out.push(`+${u.growUp} turn${u.growUp === 1 ? '' : 's'} to grow up ${per}`); }
  }
  return out;
}

function upkeepSummary(species: SpeciesId, stats: Record<Stat, number>): string {
  const u = upkeepOf(species, stats);
  const parts: string[] = [];
  if (u.hunger) parts.push(`+${u.hunger} Hunger each turn`);
  if (u.energy) parts.push(`+${u.energy} Energy each turn`);
  if (u.move) parts.push(`+${u.move} Energy per move`);
  if (u.growUp) parts.push(`+${u.growUp} turn${u.growUp === 1 ? '' : 's'} to grow up`);
  return parts.length ? parts.join(', ') : 'none yet';
}

function Prep(p: {
  account: Account; species: SpeciesId; invest: Invest;
  setInvest: (v: Invest) => void; traits: TraitId[]; setTraits: (t: TraitId[]) => void;
  customising?: boolean; onBorn: () => void; onBack: () => void;
}) {
  const d = SPECIES[p.species];
  const gp = p.account.gp[p.species];
  const spent = STATS.reduce((a, s) => a + (p.invest[s] ?? 0), 0);
  const left = gp - spent;
  const slots = traitSlots(p.account);
  const full = p.traits.length >= slots;
  const stats = Object.fromEntries(STATS.map((s) => [s, d.baseStats[s] + (p.invest[s] ?? 0)])) as Record<Stat, number>;
  const bump = (s: Stat, delta: number) => {
    const cur = p.invest[s] ?? 0;
    const next = cur + delta;
    if (d.baseStats[s] + next < STAT_FLOOR || d.baseStats[s] + next > d.caps[s]) return;
    if (delta > 0 && left <= 0) return;
    p.setInvest({ ...p.invest, [s]: next });
  };
  const toggle = (t: TraitId) => {
    if (p.traits.includes(t)) p.setTraits(p.traits.filter((x) => x !== t));
    else if (!full) p.setTraits([...p.traits, t]);
  };
  return (
    <div className="screen pad stack">
      <h2>{d.emoji} {d.name}</h2>
      <p className="small dim">Goal: {d.goal}</p>
      <h3>Stats &middot; {left} Gene Points left</h3>
      <p className="small dim">Raising a stat costs 1 Gene Point and makes you hungrier or more tired.</p>
      <p className="small dim">Lower a stat to get a Gene Point back.</p>
      <div className="row">
        {PRESETS.map((pr) => {
          const inv = presetInvest(p.species, gp, pr);
          return (
            <button key={pr.id} type="button" className={`btn chipbtn ${sameInvest(inv, p.invest) ? 'on' : ''}`}
              onClick={() => p.setInvest(inv)}>{pr.label}</button>
          );
        })}
      </div>
      <div>
        {STATS.map((s) => {
          const add = p.invest[s] ?? 0;
          const val = d.baseStats[s] + add;
          const canDown = val > STAT_FLOOR;
          const canUp = val < d.caps[s] && left > 0;
          const upWhy = val >= d.caps[s] ? 'At the species cap' : left <= 0 ? 'No Gene Points left' : '';
          const rules = upkeepRules(p.species, s);
          return (
            <div key={s}>
              <div className="statrow">
                <span>{STAT_LABEL[s]}</span>
                <span className="dim small">{STAT_FLOOR}-{d.caps[s]}</span>
                <span className="statval">
                  <b style={{ color: add > 0 ? 'var(--good)' : add < 0 ? 'var(--warn)' : 'var(--accent)' }}>{val}</b>
                  {add !== 0 && <span className={`small arrow ${add > 0 ? 'up' : 'down'}`}> {add > 0 ? '▲' : '▼'} ({add > 0 ? '+' : ''}{add})</span>}
                </span>
                <span className="row">
                  <button className="btn mini center" disabled={!canDown} title={canDown ? 'Lower: refunds a Gene Point' : 'Already at the minimum'} onClick={() => bump(s, -1)}>-</button>
                  <button className="btn mini center" disabled={!canUp} title={upWhy || 'Raise: costs a Gene Point'} onClick={() => bump(s, 1)}>+</button>
                </span>
              </div>
              <div className="upkeep small dim">{rules.length ? `Upkeep above ${d.baseStats[s]}: ${rules.join('; ')}` : 'No upkeep'}</div>
            </div>
          );
        })}
      </div>
      <p className="small dim">Upkeep now: {upkeepSummary(p.species, stats)}.</p>
      <h3>Mutations (pick up to {slots})</h3>
      {full && <p className="small warnline">Slots full ({p.traits.length}/{slots}). Unpick one to swap.</p>}
      {TRAIT_IDS.map((t) => {
        const tr = TRAITS[t];
        const uses = p.account.traitUses[t];
        const awakened = uses >= TIER2_USES;
        const on = p.traits.includes(t);
        const blocked = full && !on;
        return (
          <button key={t} type="button" className="card pick mutbtn" disabled={blocked}
            title={blocked ? `Slots full (${p.traits.length}/${slots}). Unpick one to swap.` : undefined}
            style={on ? { borderColor: 'var(--accent)' } : undefined} onClick={() => toggle(t)}>
            <div className="row spread">
              <b>{on ? '✔ ' : ''}{tr.name}</b>
              <span className="badge">{tr.stat} &middot; {awakened ? 'Tier II' : 'Tier I'}</span>
            </div>
            <div className="small">{tr.benefit}{awakened ? `. ${tr.tier2}` : ''}</div>
            <div className="small dim">Price: {tr.price}</div>
            {!awakened && (
              <>
                <div className="small dim" style={{ marginTop: 4 }}>Upgrades at {TIER2_USES} {tr.unit} ({uses}/{TIER2_USES})</div>
                <div className="meter"><div style={{ width: `${Math.min(100, (uses / TIER2_USES) * 100)}%` }} /></div>
              </>
            )}
          </button>
        );
      })}
      <button className="btn primary center" onClick={p.onBorn}>{p.customising ? 'Done' : 'Be born'}</button>
      <button className="btn center" onClick={p.onBack}>{p.customising ? 'Back to my birth' : 'Back'}</button>
    </div>
  );
}

// ---------------- birth ----------------

const BIRTH_ROW_HELP: Record<string, string> = {
  Season: 'When in the year you are born. The later the season, the sooner winter arrives.',
  Start: 'How well set up you are. A strong start adds Health and Hunger relief; a weak one takes them away.',
  Place: 'Where you begin and how many predators live nearby.',
};

function Birth(p: {
  account: Account; birth: BirthRoll; species: SpeciesId; rerolled: boolean; onReroll: () => void;
  onCustomise?: () => void; onBegin: () => void; onBack: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const canReroll = p.account.level >= 3 && !p.rerolled;
  const firstLife = p.account.lives === 0;
  return (
    <div className="screen pad stack">
      <h2>Birth luck <span className={`badge ${p.birth.luck}`}>{p.birth.luck}</span></h2>
      {firstLife && (
        <p className="small dim">Season is when in the year you begin, Start is how well set up you are, and Place is where you land and who lives nearby (tap a label for more).</p>
      )}
      {birthRows(p.birth).map((r) => (
        <div key={r.label} className="birthrow">
          <button type="button" className="rowlabel" aria-expanded={open === r.label}
            title={BIRTH_ROW_HELP[r.label]} onClick={() => setOpen(open === r.label ? null : r.label)}>{r.label}</button>
          <div>
            <div>{r.text}</div>
            {open === r.label && <div className="small dim">{BIRTH_ROW_HELP[r.label]}</div>}
          </div>
        </div>
      ))}
      <button className="btn primary center" onClick={p.onBegin}>Into the wild {SPECIES[p.species].emoji}</button>
      {canReroll && <button className="btn center" onClick={p.onReroll}>Reroll this birth (once)</button>}
      {p.onCustomise && <button className="linkbtn" onClick={p.onCustomise}>Customise your {SPECIES[p.species].name.toLowerCase()}</button>}
      <button className="btn center" onClick={p.onBack}>Back</button>
    </div>
  );
}

// ---------------- play ----------------

function Bar(p: { cls: string; label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (p.value / p.max) * 100));
  return (
    <div className={`bar ${p.cls}`}>
      <span>{p.label}</span>
      <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
      <span className="num">{p.value}/{p.max}</span>
    </div>
  );
}

function Chips(p: { a: Snap; b: Snap; hpCause?: string }) {
  // Each chip shows the change in the number on screen (arrow = direction) and is coloured by whether it is good or bad.
  const hp = p.b.hp - p.a.hp;
  const hunger = p.a.satiety - p.b.satiety; // Hunger is the inverse of how full the animal is
  const energy = p.b.energy - p.a.energy;
  const items: { name: string; d: number; cls: string; good: boolean }[] = [
    { name: hp < 0 && p.hpCause ? `Health (${p.hpCause})` : 'Health', d: hp, cls: 'hp', good: hp > 0 },
    { name: 'Hunger', d: hunger, cls: 'hun', good: hunger < 0 },
    { name: 'Energy', d: energy, cls: 'en', good: energy > 0 },
  ];
  if (p.a.herd !== p.b.herd) items.push({ name: 'Herd', d: p.b.herd - p.a.herd, cls: 'herd', good: p.b.herd > p.a.herd });
  const shown = items.filter((i) => i.d !== 0);
  if (!shown.length) return <div className="chips"><span className="chip zero">no change</span></div>;
  return (
    <div className="chips">
      {shown.map((i) => (
        <span key={i.name} className={`chip ${i.cls} ${i.good ? 'good' : 'bad'}`}>{i.name} {i.d > 0 ? '▲' : '▼'} {i.d > 0 ? '+' : ''}{i.d}</span>
      ))}
    </div>
  );
}

function reportTone(r: TurnReport, ended: RunState['ended']): 'bad' | 'good' | 'gold' | 'warn' | 'plain' {
  if (ended?.type === 'win') return 'gold';
  if (r.threat?.outcome === 'killed' || ended?.type === 'death') return 'bad';
  if (r.threat?.outcome === 'hurt' || r.afterAction.hp < r.before.hp) return 'bad';
  if (r.threat?.outcome === 'safe') return 'good';
  if (r.afterArrival.hp < r.afterAction.hp) return 'warn';
  return 'plain';
}

function isNotable(r: TurnReport, ended: RunState['ended']): boolean {
  return !!r.threat || !!ended || r.afterArrival.hp < r.before.hp;
}

/** Result of the action you took: heading, verdict, what happened, and the stat changes. */
function ResultBlock(p: { r: TurnReport; hideHead?: boolean }) {
  const { r } = p;
  return (
    <>
      {!p.hideHead && <div className="rhead">{r.turn === 0 ? 'Birth luck' : `Turn ${r.turn}: ${r.action}`}</div>}
      {r.threat && (
        <div className={`verdict ${r.threat.outcome}`}>
          {PRED_EMOJI[r.threat.pred]} {r.threat.name}:{' '}
          {r.threat.outcome === 'safe' ? 'you came through unharmed' : r.threat.outcome === 'hurt' ? 'you were hurt' : 'you did not survive'}
        </div>
      )}
      {r.resolve.map((l, i) => <div key={`r${i}`} className="rl">{l}</div>)}
      {r.turn > 0 && <Chips a={r.before} b={r.afterAction} />}
    </>
  );
}

/** What the next turn opened with: upkeep, the new event, and what it cost you. */
function ArrivalBlock(p: { r: TurnReport; ended: RunState['ended']; head: 'now' | 'next' }) {
  const { r } = p;
  if (!r.arrival.length) return null;
  if (p.ended) return <>{r.arrival.map((l, i) => <div key={`a${i}`} className="rl">{l}</div>)}</>;
  return (
    <>
      <div className={`rhead ${p.head}`}>{r.turn === 0 ? 'The first moments' : `Turn ${r.turn + 1} begins`}</div>
      {r.arrival.map((l, i) => <div key={`a${i}`} className="rl">{l}</div>)}
      <Chips a={r.afterAction} b={r.afterArrival} hpCause={[...new Set((r.envHits ?? []).map((h) => h.chip))].join(', ') || undefined} />
    </>
  );
}

/** Both halves in the order they happened. Used on the flashcard, which is read once. */
function ReportBody(p: { r: TurnReport; ended: RunState['ended']; hideHead?: boolean }) {
  return (
    <div className="report">
      <ResultBlock r={p.r} hideHead={p.hideHead} />
      <ArrivalBlock r={p.r} ended={p.ended} head="next" />
    </div>
  );
}

function FlashScreen(p: { tone: string; title: string; children: ReactNode; button: ReactNode; onContinue: () => void }) {
  return (
    <div className={`screen flash ${p.tone}`}>
      <div className="flashtitle">{p.title}</div>
      <div className="flashbody">{p.children}</div>
      <button className="btn primary center" autoFocus onClick={p.onContinue}>{p.button}</button>
    </div>
  );
}

/** Heading for a turn where the world, not an action, cost Health. Names the cause and the number. */
function worldHeading(r: TurnReport): string {
  if (r.envHits?.length) return r.envHits.map((h) => `${h.cause}: -${h.hp} Health`).join(' · ');
  const lost = r.afterAction.hp - r.afterArrival.hp;
  return `Lost ${lost} Health`;
}

function UnlockFlash(p: { species: NonNullable<DebriefReport['newSpecies']>; onContinue: () => void }) {
  const names = p.species.map((u) => SPECIES[u.id].name).join(' and ');
  return (
    <FlashScreen tone="gold" title={`New species: ${names}`} button="Continue" onContinue={p.onContinue}>
      {p.species.map((u) => (
        <div key={u.id} className="report">
          <div style={{ fontSize: 56, textAlign: 'center' }}>{SPECIES[u.id].emoji}</div>
          <div className="rl">{u.condition}</div>
          <div className="small dim">Find it in the species list when you press Begin.</div>
        </div>
      ))}
    </FlashScreen>
  );
}

// ---- the Play screen is five panels: Environment, Turn log, Meters, Surroundings, Actions ----

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const CARD_AUTO_MS = 1000; // a quiet card fades up by itself after this long
const CARD_LEAVE_MS = 340; // time the card takes to fade up into the log

/** Older turns, newest first, each as a whole group. The latest turn is shown above them, so it is dropped here. */
function earlierTurns(history: string[], max = 3): { label: string; lines: string[] }[] {
  const chunks: { label: string; lines: string[] }[] = [];
  let cur: { label: string; lines: string[] } | null = null;
  for (const l of history) {
    const m = /^— Turn (\d+) —$/.exec(l);
    if (m) { cur = { label: `Turn ${m[1]}`, lines: [] }; chunks.push(cur); }
    else {
      if (!cur) { cur = { label: 'Birth', lines: [] }; chunks.push(cur); }
      cur.lines.push(l);
    }
  }
  return chunks.slice(0, -1).reverse().slice(0, max);
}

function EnvironmentPanel(p: { run: RunState; view: RunView }) {
  const { run, view } = p;
  const def = SPECIES[run.species];
  const ev = view.event;
  const rep = run.report;
  return (
    <div className={`scene ${view.biome}`} data-panel="environment">
      <div className="topline">
        <span>{view.seasonName} &middot; Turn {view.turn}/{view.maxTurns}</span>
        <span>{view.stage}</span>
      </div>
      <div className="place">{view.locName}</div>
      <div className="small" style={{ opacity: 0.85 }}>{view.blurb}</div>
      <div className="sprites">
        <span className="sprite">{def.emoji}</span>
        {ev?.kind === 'threat' && ev.pred && <span className="sprite foe">{PRED_EMOJI[ev.pred]}</span>}
        {run.species === 'deer' && <span className="sprite small">{'🦌'.repeat(Math.min(3, Math.max(0, view.herd! - 1)))}</span>}
        {run.species === 'mouse' && view.nest && <span className="sprite small">🪺</span>}
      </div>
      {ev && (
        <div className={`eventbox ${ev.kind}`}>
          {rep?.newEvent === ev.name && <span className="newtag">NEW THIS TURN</span>}
          <b>{ev.name}.</b> {ev.text}
        </div>
      )}
    </div>
  );
}

/** Newest first: the turn that just began, then the result of your last action, then older turns. */
function TurnLogPanel(p: { run: RunState }) {
  const { run } = p;
  const rep = run.report;
  const tone = rep ? reportTone(rep, run.ended) : 'plain';
  const earlier = earlierTurns(run.history);
  return (
    <div className={`log tone-${tone}`} data-panel="turn-log">
      {rep && (
        <div className="report">
          <div key={run.turnsTaken} className="fresh">
            <ArrivalBlock r={rep} ended={run.ended} head="now" />
          </div>
          <div className="prevturn"><ResultBlock r={rep} /></div>
        </div>
      )}
      {earlier.length > 0 && <div className="olderhead">Earlier</div>}
      {earlier.map((c, i) => (
        <div key={`${c.label}${i}`} className="oldturn">
          <div className="oldlabel">{c.label}</div>
          {c.lines.map((l, j) => <div key={j} className="old">{l}</div>)}
        </div>
      ))}
    </div>
  );
}

function MetersPanel(p: { view: RunView }) {
  const { view } = p;
  return (
    <div data-panel="meters">
      <div className="hud">
        <Bar cls="hp" label="Health" value={view.hp} max={view.maxHp} />
        <Bar cls="hun" label="Hunger" value={100 - view.satiety} max={100} />
        <Bar cls="en" label="Energy" value={view.energy} max={100} />
        <Bar cls="safe" label="Safety" value={view.safety} max={100} />
      </div>
      <div className="stats">
        {STATS.map((s) => <span key={s}>{STAT_LABEL[s].slice(0, 3)} <b>{view.stats[s]}</b></span>)}
      </div>
      <div className="goal">Goal: {view.goalLine}{view.nest ? ` Nest: ${view.nest.pups} pups, ${view.nest.turnsLeft} turns to wean.` : ''}</div>
    </div>
  );
}

function SurroundingsPanel(p: { view: RunView }) {
  const { view } = p;
  return (
    <div className="look" data-panel="surroundings">
      <span className="dim">{view.foodHere}. <span title="How much you can see about nearby places">Sight: tier {view.tier} of 3.</span></span>
      <div className="nb">
        {view.neighbours.map((n) => (
          <span key={n.id}>
            {n.name}
            {n.danger && <> <span className={n.danger}>[{n.danger}]</span></>}
            {n.food && <> food {n.food}</>}
            {n.prey && <> deer {n.prey}</>}
            {n.predators && n.predators.length > 0 && <> ({n.predators.join(', ')})</>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The result of the action you just took. It sits where the buttons are, then fades up into the Turn log. */
function Flashcard(p: { run: RunState; hold: boolean; leaving: boolean; onDismiss: () => void }) {
  const rep = p.run.report!;
  const tone = reportTone(rep, p.run.ended);
  const title =
    tone === 'gold' ? 'Victory'
      : tone === 'bad' ? (p.run.ended ? 'Life over' : 'That hurt')
        : tone === 'good' ? 'Close call, survived'
          : tone === 'warn' ? worldHeading(rep)
            : rep.action;
  return (
    <div className={`flashcard ${tone} ${p.leaving ? 'leaving' : ''}`} role="button" tabIndex={0}
      aria-label="Result of your action. Press Enter to continue." onClick={p.onDismiss}>
      <div className="flashtitle">{title}</div>
      <ReportBody r={rep} ended={p.run.ended} hideHead={tone === 'plain'} />
      {p.hold
        ? <div className="cardhint small dim">{p.run.ended ? 'Tap or press Enter to continue' : `Tap or press Enter to continue to turn ${rep.turn + 1}`}</div>
        : <div className="cardtimer" style={{ animationDuration: `${CARD_AUTO_MS}ms` }} />}
    </div>
  );
}

/** A one-line first-time tip, near the Actions panel and never in the way of it. */
function TipStrip(p: { text: string; onGotIt: () => void; onHide: () => void }) {
  return (
    <div className="tipstrip" role="note" data-panel="tip">
      <span className="tiptext">{p.text}</span>
      <span className="tipacts">
        <a className="linkbtn" href={GLOSSARY_URL} target="_blank" rel="noopener noreferrer" title="What do these words mean? Opens the glossary" aria-label="Open the glossary">?</a>
        <button className="linkbtn" onClick={p.onGotIt}>Got it</button>
        <button className="linkbtn" onClick={p.onHide}>Hide tips</button>
      </span>
    </div>
  );
}

function Play(p: {
  account: Account; run: RunState; onRun: (r: RunState) => void; onFinish: () => void; onMenu: () => void;
  onTipSeen: (id: TipId) => void; onHideTips: () => void;
}) {
  const { run } = p;
  const view = useMemo(() => getView(run), [run]);
  const [picking, setPicking] = useState<Action | null>(null);
  const rep = run.report;
  const [acked, setAcked] = useState(run.turnsTaken);
  // The run as it was before your last action. The Environment, Turn log, Meters and Surroundings
  // panels keep showing it while the flashcard is up, so the card lands before the new turn does.
  const [held, setHeld] = useState<RunState | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [cardH, setCardH] = useState(0);
  const actionsRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cardPending = !!rep && rep.turn > 0 && acked < run.turnsTaken;
  const shown = cardPending && held ? held : run;
  const shownView = useMemo(() => getView(shown), [shown]);

  // first-time tips: the first triggered tip you have not seen, unless you turned tips off
  const tutorial = p.account.tutorial;
  const tipCtx = { run: shown, view: shownView, cardUp: cardPending };
  const activeTip: TipId | null = tutorial.tipsOff ? null : triggeredTips(tipCtx).find((t) => !tutorial.tipsSeen[t]) ?? null;
  const { onTipSeen } = p;
  // hurt, threat, death and victory cards wait for you, and so does the card that explains cards
  const hold = (!!rep && isNotable(rep, run.ended)) || activeTip === 'flashcard';

  const doAct = useCallback((id: string, target?: string) => {
    if (activeTip) onTipSeen(activeTip);
    setPicking(null);
    setCardH(actionsRef.current?.offsetHeight ?? 0);
    setHeld(run);
    p.onRun(act(run, id, target));
  }, [run, p, activeTip, onTipSeen]);

  const choose = useCallback((a: Action) => {
    if (a.disabled) return;
    if (a.targets) setPicking(a);
    else doAct(a.id);
  }, [doAct]);

  /** Fade the card up into the Turn log. The panels show the new turn as the card leaves. */
  const dismiss = useCallback((instant = false) => {
    if (!cardPending || leaving) return;
    if (activeTip) onTipSeen(activeTip);
    setHeld(null);
    if (instant || prefersReducedMotion()) { setAcked(run.turnsTaken); return; }
    setLeaving(true);
    leaveTimer.current = setTimeout(() => { setLeaving(false); setAcked(run.turnsTaken); }, CARD_LEAVE_MS);
  }, [cardPending, leaving, run.turnsTaken, activeTip, onTipSeen]);

  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); }, []);

  // quiet cards fade up by themselves
  useEffect(() => {
    if (!cardPending || hold || leaving) return;
    const t = setTimeout(() => dismiss(), CARD_AUTO_MS);
    return () => clearTimeout(t);
  }, [cardPending, hold, leaving, dismiss]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (cardPending) {
        if (leaving) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); dismiss(); return; }
        if (/^[1-9]$/.test(e.key)) {
          e.preventDefault();
          // A number key skips the card and also picks that action, but only after a calm turn.
          // Anything else (a threat, a hurt, an ending) would be choosing blind, so the key just dismisses.
          const calm = !hold && !run.ended && run.event?.kind !== 'threat';
          const a = view.actions[Number(e.key) - 1];
          dismiss(true);
          if (calm && a && !a.disabled && !a.targets) setTimeout(() => doAct(a.id), 0);
        }
        return;
      }
      if (run.ended) return;
      if (e.key === 'Escape') { setPicking(null); return; }
      const n = Number(e.key);
      if (!n || n < 1) return;
      if (picking?.targets) {
        const t = picking.targets[n - 1];
        if (t) doAct(picking.id, t.id);
      } else {
        const a = view.actions[n - 1];
        if (a) choose(a);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardPending, leaving, hold, run.ended, run.event, picking, view.actions, choose, doAct, dismiss]);

  return (
    <>
      <div className="screen">
        <EnvironmentPanel run={shown} view={shownView} />
        <TurnLogPanel run={shown} />
      </div>

      <div className="screen">
        <MetersPanel view={shownView} />
        <SurroundingsPanel view={shownView} />
        {activeTip && (
          <TipStrip text={tipText(activeTip, tipCtx)} onGotIt={() => onTipSeen(activeTip)} onHide={p.onHideTips} />
        )}
        <div className={`actions ${cardPending ? 'hascard' : ''}`} data-panel="actions" ref={actionsRef}
          style={cardPending && cardH ? { height: cardH } : undefined}>
          {cardPending ? (
            <Flashcard run={run} hold={hold} leaving={leaving} onDismiss={() => dismiss()} />
          ) : run.ended ? (
            <>
              <p style={{ margin: 0 }}><b>{run.ended.type === 'win' ? 'Victory.' : run.ended.type === 'old_age' ? 'A full life.' : 'Life over.'}</b> {run.ended.cause}</p>
              <button className="btn primary center" onClick={p.onFinish}>Your legacy</button>
            </>
          ) : picking ? (
            <>
              <div className="small dim">Where to? (Esc to cancel)</div>
              {picking.targets!.map((t, i) => (
                <button key={t.id} className="btn" onClick={() => doAct(picking.id, t.id)}>
                  <span className="key">{i + 1}</span>{t.label}
                  {(() => {
                    const n = view.neighbours.find((x) => x.id === t.id);
                    return n?.danger ? <span className="hint">Danger: <span className={n.danger}>{n.danger}</span></span> : null;
                  })()}
                </button>
              ))}
              <button className="btn center" onClick={() => setPicking(null)}>Cancel</button>
            </>
          ) : (
            view.actions.map((a, i) => (
              <button key={a.id} className="btn" disabled={!!a.disabled} onClick={() => choose(a)}>
                <span className="key">{i + 1}</span>{a.label}
                {(a.hint || a.disabled) && (
                  <span className="hint">{a.hint}{a.disabled ? <span className="why"> {a.hint ? '· ' : ''}{a.disabled}</span> : null}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
      <button className="btn center" onClick={p.onMenu}>Menu (your life is saved)</button>
    </>
  );
}

// ---------------- debrief ----------------

function Delta(p: { from: number; to: number; unit?: string }) {
  const d = p.to - p.from;
  const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'same';
  return (
    <span className="delta">
      <b>{p.to}{p.unit ?? ''}</b>
      {d !== 0 && <span className={`arrow ${cls}`}> {d > 0 ? '▲' : '▼'} ({d > 0 ? '+' : ''}{d})</span>}
    </span>
  );
}

function GainBar(p: { label: ReactNode; before: number; after: number; lo?: number; hi: number; right?: ReactNode; emoji?: string }) {
  const lo = p.lo ?? 0;
  const span = Math.max(1, p.hi - lo);
  const b = Math.max(0, Math.min(1, (Math.max(p.before, lo) - lo) / span));
  const a = Math.max(0, Math.min(1, (p.after - lo) / span));
  return (
    <div className="gainrow">
      <div className="row spread small">
        <span>{p.emoji ? `${p.emoji} ` : ''}{p.label}</span>
        <span>{p.right}</span>
      </div>
      <div className="gaintrack">
        <div className="gainbase" style={{ width: `${b * 100}%` }} />
        <div className="gainadd" style={{ left: `${b * 100}%`, width: `${Math.max(0, a - b) * 100}%` }} />
      </div>
    </div>
  );
}

function Debrief(p: {
  report: DebriefReport; species: SpeciesId; account: Account; onAgain: () => void; onMenu: () => void;
}) {
  const r = p.report;
  const pay = r.payout;
  const title = r.end.type === 'win' ? 'Victory' : r.end.type === 'old_age' ? 'A full life' : 'Death';
  return (
    <div className="screen pad stack">
      <h2>{title}</h2>
      <p>{r.end.cause} You lived {r.turns} turn{r.turns === 1 ? '' : 's'}.</p>
      {r.coaching && (
        <div className="card coach" data-panel="coaching">
          <b>What I take with me</b>
          <p><b>What happened.</b> {r.coaching.ended}</p>
          <p><b>Next time.</b> {r.coaching.suggestion}</p>
          <p><b>My Gene Points.</b> I have {p.account.gp[p.species]} to spend on the next screen. {r.coaching.spend} Every point I raise costs upkeep, and lowering a stat gives a point back.</p>
        </div>
      )}
      <h3>Experience</h3>
      <table>
        <tbody>
          <tr><td>Time survived</td><td className="num">{pay.survival}</td></tr>
          <tr><td>Goal progress</td><td className="num">{pay.goal}</td></tr>
          <tr><td>Goal bonus</td><td className="num">{pay.feats}</td></tr>
          <tr><td>New discoveries</td><td className="num">{pay.discoveries}</td></tr>
          <tr><td>Ending bonus</td><td className="num">&times;{pay.endingMult}</td></tr>
          <tr><td>Difficulty bonus</td><td className="num">&times;{pay.difficulty}</td></tr>
          <tr><td><b>Account XP</b></td><td className="num"><b className="arrow up">▲ +{pay.xp}</b></td></tr>
          <tr><td>Gene Points ({SPECIES[p.species].name})</td><td className="num"><span className="arrow up">▲ +{pay.gpGain}</span></td></tr>
        </tbody>
      </table>
      {(() => {
        const xpAfter = p.account.xp;
        const xpBefore = xpAfter - pay.xp;
        const lvl = r.levelAfter;
        const up = r.levelAfter > r.levelBefore;
        return (
          <>
            <GainBar
              label={<b>Account level {up ? <span className="arrow up">{r.levelBefore} ▲ {r.levelAfter}</span> : r.levelAfter}</b>}
              before={up ? xpForLevel(lvl) : xpBefore} after={xpAfter} lo={xpForLevel(lvl)} hi={xpForLevel(lvl + 1)}
              right={<span className="arrow up">▲ (+{pay.xp} XP)</span>}
            />
            {up && r.newPerks.map((perk) => (
              <div key={perk.name} className="card"><b>New perk: {perk.name}</b><div className="small">{perk.text}</div></div>
            ))}
          </>
        );
      })()}
      {r.masteryAfter > r.masteryBefore && (() => {
        const lvA = masteryLevel(r.masteryAfter);
        const lvB = masteryLevel(r.masteryBefore);
        const lo = MASTERY_STEPS[Math.min(lvA, MASTERY_STEPS.length - 1)];
        const hi = MASTERY_STEPS[Math.min(MASTERY_STEPS.length - 1, lvA + 1)];
        return (
          <GainBar
            emoji={SPECIES[p.species].emoji}
            label={<>{SPECIES[p.species].name} mastery, level {lvA >= lvB && lvA > lvB ? <span className="arrow up">{lvB} ▲ {lvA}</span> : lvA}</>}
            before={lvA > lvB ? lo : r.masteryBefore} after={r.masteryAfter} lo={lo} hi={Math.max(hi, lo + 1)}
            right={<Delta from={r.masteryBefore} to={r.masteryAfter} />}
          />
        );
      })()}
      {r.famChanges.length > 0 && (
        <>
          <h3>Codex</h3>
          {r.famChanges.map((f) => (
            <GainBar key={f.id} emoji={CODEX_NOTES[f.id].emoji} label={CODEX_NOTES[f.id].name}
              before={f.before} after={f.after} hi={100} right={<Delta from={f.before} to={f.after} />} />
          ))}
        </>
      )}
      {r.notes.map((n, i) => <p key={i} className="small dim">{n}</p>)}
      {r.traitTierUps.map((t, i) => <div key={i} className="card"><b>{t}</b></div>)}
      {r.unlocks.map((u, i) => <div key={i} className="card"><b>{u}</b></div>)}
      <button className="btn primary center" onClick={p.onAgain}>Live again as {SPECIES[p.species].name}</button>
      <button className="btn center" onClick={p.onMenu}>Main menu</button>
    </div>
  );
}

// ---------------- codex and account ----------------

function Codex(p: { account: Account; onBack: () => void }) {
  const ids: CodexId[] = ['mouse', 'deer', 'wolf', 'hawk', 'fox'];
  return (
    <div className="screen pad stack">
      <h2>Codex</h2>
      <p className="small dim">The more you learn about an animal, the closer you get to playing as it. Seeing, escaping, watching and beating a species all count. Dying to it counts least.</p>
      {ids.map((id) => {
        const f = p.account.codex[id];
        const e = CODEX_NOTES[id];
        return (
          <div key={id} className="card">
            <div className="row spread"><b>{e.emoji} {f > 0 ? e.name : '???'}</b><span className="badge">{f}/100</span></div>
            <div className="meter"><div style={{ width: `${f}%` }} /></div>
            {e.notes.filter(([need]) => f >= need).map(([, text], i) => <div key={i} className="small" style={{ marginTop: 4 }}>{text}</div>)}
            {f === 0 && <div className="small dim">Not met yet.</div>}
          </div>
        );
      })}
      <button className="btn center" onClick={p.onBack}>Back</button>
    </div>
  );
}

function AccountScreen(p: { account: Account; onBack: () => void }) {
  const a = p.account;
  return (
    <div className="screen pad stack">
      <h2>Account</h2>
      <p>Level {a.level} &middot; {a.xp} XP &middot; next level at {xpForLevel(a.level + 1)}</p>
      <div className="meter"><div style={{ width: `${levelProgress(a) * 100}%` }} /></div>
      <h3>Perks</h3>
      {PERKS.map((perk) => (
        <div key={perk.name} className={`card ${a.level >= perk.level ? '' : 'locked'}`}>
          <b>{perk.name}</b> <span className="badge">Level {perk.level}</span>
          <div className="small dim">{perk.text}</div>
        </div>
      ))}
      <h3>Species</h3>
      {(Object.keys(SPECIES) as SpeciesId[]).map((id) => (
        <div key={id} className="small">
          {SPECIES[id].emoji} {SPECIES[id].name}: mastery {masteryLevel(a.mastery[id])} ({a.mastery[id]}/{MASTERY_STEPS[Math.min(MASTERY_STEPS.length - 1, masteryLevel(a.mastery[id]) + 1)]}), {a.wins[id]} wins, {a.gp[id]} Gene Points
        </div>
      ))}
      <button className="btn center" onClick={p.onBack}>Back</button>
    </div>
  );
}
