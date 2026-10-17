import { Feedback, VersionFooter } from './Support';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CODEX_NOTES, PERKS, SPECIES, STAT_FLOOR, STATS, STAT_LABEL, TIER2_USES, TRAITS, TRAIT_IDS, MASTERY_STEPS,
  act, createAccount, finishRun, getView, masteryLevel, rollBirth, startRun, traitSlots, xpForLevel,
} from '../engine';
import type {
  Account, Action, BirthRoll, CodexId, DebriefReport, RunState, Snap, SpeciesId, Stat, TraitId, TurnReport,
} from '../engine';

type Screen = 'feedback' | 'menu' | 'select' | 'prep' | 'birth' | 'play' | 'debrief' | 'codex' | 'account';

const ACCOUNT_KEY = 'species_account_v1';
const RUN_KEY = 'species_run_v1';
const PRED_EMOJI: Record<string, string> = { hawk: '🦅', fox: '🦊', wolf: '🐺', rival: '🐺' };

function loadAccount(): Account {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const base = createAccount();
      return {
        ...base, ...p,
        unlocked: { ...base.unlocked, ...p.unlocked },
        hiddenFound: { ...base.hiddenFound, ...p.hiddenFound },
        codex: { ...base.codex, ...p.codex },
        mastery: { ...base.mastery, ...p.mastery },
        gp: { ...base.gp, ...p.gp },
        wins: { ...base.wins, ...p.wins },
        traitUses: { ...base.traitUses, ...p.traitUses },
      };
    }
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

  useEffect(() => safeSet(ACCOUNT_KEY, JSON.stringify(account)), [account]);
  useEffect(() => safeSet(RUN_KEY, run ? JSON.stringify(run) : null), [run]);

  const [fbFrom, setFbFrom] = useState<Screen>('menu');
  const openFeedback = () => { if (screen !== 'feedback') setFbFrom(screen); setScreen('feedback'); };
  const fbContext = [
    `Screen: ${fbFrom}`,
    `Account level ${account.level}, ${account.lives} lives`,
    run ? `Run: ${run.species}, turn ${run.age}, ${run.loc}, hp ${run.hp}` : 'No run in progress',
  ].join('. ');

  const goSelect = () => setScreen('select');

  const choose = (id: SpeciesId) => {
    setSpecies(id);
    setInvest({});
    setTraits((t) => t.slice(0, traitSlots(account)));
    setScreen('prep');
  };

  const beBorn = () => {
    setBirth(rollBirth(species, newSeed()));
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
      setScreen('play');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const finish = () => {
    if (!run || !run.ended) return;
    const res = finishRun(account, run);
    setAccount(res.account);
    setReport(res.report);
    setRun(null);
    setScreen('debrief');
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
          onContinue={() => setScreen('play')} onStart={goSelect}
          onCodex={() => setScreen('codex')} onAccount={() => setScreen('account')} onReset={resetAll} eraseArmed={eraseArmed} />
      )}
      {screen === 'select' && <Select account={account} onPick={choose} onBack={() => setScreen('menu')} />}
      {screen === 'prep' && (
        <Prep account={account} species={species} invest={invest} setInvest={setInvest}
          traits={traits} setTraits={setTraits} onBorn={beBorn} onBack={goSelect} />
      )}
      {screen === 'birth' && birth && (
        <Birth account={account} birth={birth} rerolled={rerolled}
          onReroll={() => { setBirth(rollBirth(species, newSeed())); setRerolled(true); }}
          onBegin={begin} onBack={() => setScreen('prep')} />
      )}
      {screen === 'play' && run && (
        <Play account={account} run={run} onRun={setRun} onFinish={finish} onMenu={() => setScreen('menu')} />
      )}
      {screen === 'debrief' && report && (
        <Debrief report={report} species={species} account={account}
          onAgain={() => choose(species)} onMenu={() => setScreen('menu')} />
      )}
      {screen === 'codex' && <Codex account={account} onBack={() => setScreen('menu')} />}
      {screen === 'account' && <AccountScreen account={account} onBack={() => setScreen('menu')} />}
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
  onCodex: () => void; onAccount: () => void; onReset: () => void; eraseArmed: boolean;
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
        <button className="btn primary" onClick={p.onStart}>Start Play</button>
        <button className="btn" onClick={p.onCodex}>Codex</button>
        <button className="btn" onClick={p.onAccount}>Account and perks</button>
        <button className="btn" onClick={p.onReset}>{p.eraseArmed ? 'Tap again to erase everything' : 'Erase save'}</button>
      </div>
    </>
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

function Prep(p: {
  account: Account; species: SpeciesId; invest: Partial<Record<Stat, number>>;
  setInvest: (v: Partial<Record<Stat, number>>) => void; traits: TraitId[]; setTraits: (t: TraitId[]) => void;
  onBorn: () => void; onBack: () => void;
}) {
  const d = SPECIES[p.species];
  const spent = STATS.reduce((a, s) => a + (p.invest[s] ?? 0), 0);
  const left = p.account.gp[p.species] - spent;
  const slots = traitSlots(p.account);
  const bump = (s: Stat, delta: number) => {
    const cur = p.invest[s] ?? 0;
    const next = cur + delta;
    if (d.baseStats[s] + next < STAT_FLOOR || d.baseStats[s] + next > d.caps[s]) return;
    if (delta > 0 && left <= 0) return;
    p.setInvest({ ...p.invest, [s]: next });
  };
  const toggle = (t: TraitId) => {
    if (p.traits.includes(t)) p.setTraits(p.traits.filter((x) => x !== t));
    else if (p.traits.length < slots) p.setTraits([...p.traits, t]);
  };
  return (
    <div className="screen pad stack">
      <h2>{d.emoji} {d.name}</h2>
      <p className="small dim">Goal: {d.goal}</p>
      <h3>Stats &middot; {left} Gene Points left</h3>
      <div>
        {STATS.map((s) => {
          const add = p.invest[s] ?? 0;
          const val = d.baseStats[s] + add;
          const canDown = val > STAT_FLOOR;
          const canUp = val < d.caps[s] && left > 0;
          const upWhy = val >= d.caps[s] ? 'At the species cap' : left <= 0 ? 'No Gene Points left' : '';
          return (
            <div className="statrow" key={s}>
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
          );
        })}
      </div>
      <p className="small dim">Every point above the baseline has an upkeep: more Satiety or Energy drain, or slower growing up. Lowering a stat (down to {STAT_FLOOR}) refunds a Gene Point to spend elsewhere, so you can build a brute, a sprinter or a thinker.</p>
      <h3>Heirloom {slots > 1 ? 'traits' : 'trait'} (pick up to {slots})</h3>
      {TRAIT_IDS.map((t) => {
        const tr = TRAITS[t];
        const awakened = p.account.traitUses[t] >= TIER2_USES;
        const on = p.traits.includes(t);
        return (
          <div key={t} className={`card pick`} style={on ? { borderColor: 'var(--accent)' } : undefined} onClick={() => toggle(t)}>
            <div className="row spread">
              <b>{on ? '✔ ' : ''}{tr.name}</b>
              <span className="badge">{tr.stat} &middot; {awakened ? 'Tier II' : `Tier I (${p.account.traitUses[t]}/${TIER2_USES} uses)`}</span>
            </div>
            <div className="small">{tr.benefit}{awakened ? `. ${tr.tier2}` : ''}</div>
            <div className="small dim">Price: {tr.price}</div>
          </div>
        );
      })}
      <button className="btn primary center" onClick={p.onBorn}>Be born</button>
      <button className="btn center" onClick={p.onBack}>Back</button>
    </div>
  );
}

// ---------------- birth ----------------

function Birth(p: {
  account: Account; birth: BirthRoll; rerolled: boolean; onReroll: () => void; onBegin: () => void; onBack: () => void;
}) {
  const canReroll = p.account.level >= 3 && !p.rerolled;
  return (
    <div className="screen pad stack">
      <h2>Your birth <span className={`badge ${p.birth.luck}`}>{p.birth.luck}</span></h2>
      {p.birth.lines.map((l, i) => <p key={i}>{l}</p>)}
      <button className="btn primary center" onClick={p.onBegin}>Begin life</button>
      {canReroll && <button className="btn center" onClick={p.onReroll}>Reroll this birth (once)</button>}
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

function Chips(p: { a: Snap; b: Snap }) {
  const items: [string, number, string][] = [
    ['Health', p.b.hp - p.a.hp, 'hp'], ['Satiety', p.b.satiety - p.a.satiety, 'sat'],
    ['Energy', p.b.energy - p.a.energy, 'en'],
  ];
  if (p.a.herd !== p.b.herd) items.push(['Herd', p.b.herd - p.a.herd, 'herd']);
  const shown = items.filter((i) => i[1] !== 0);
  if (!shown.length) return <div className="chips"><span className="chip zero">no change</span></div>;
  return (
    <div className="chips">
      {shown.map(([n, d, c]) => (
        <span key={n} className={`chip ${c} ${d > 0 ? 'up' : 'down'}`}>{n} {d > 0 ? '▲' : '▼'} {d > 0 ? '+' : ''}{d}</span>
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

function ReportBody(p: { r: TurnReport; ended: RunState['ended'] }) {
  const { r } = p;
  return (
    <div className="report">
      <div className="rhead">{r.turn === 0 ? 'Your birth' : `Turn ${r.turn}: ${r.action}`}</div>
      {r.threat && (
        <div className={`verdict ${r.threat.outcome}`}>
          {PRED_EMOJI[r.threat.pred]} {r.threat.name}:{' '}
          {r.threat.outcome === 'safe' ? 'you got away unharmed' : r.threat.outcome === 'hurt' ? 'you were hurt' : 'you did not survive'}
        </div>
      )}
      {r.resolve.map((l, i) => <div key={`r${i}`} className="rl">{l}</div>)}
      {r.turn > 0 && <Chips a={r.before} b={r.afterAction} />}
      {!p.ended && r.arrival.length > 0 && (
        <>
          <div className="rhead next">{r.turn === 0 ? 'The first moments' : `Turn ${r.turn + 1} begins`}</div>
          {r.arrival.map((l, i) => <div key={`a${i}`} className="rl">{l}</div>)}
          <Chips a={r.afterAction} b={r.afterArrival} />
        </>
      )}
      {p.ended && r.arrival.length > 0 && r.arrival.map((l, i) => <div key={`a${i}`} className="rl">{l}</div>)}
    </div>
  );
}

function Play(p: {
  account: Account; run: RunState; onRun: (r: RunState) => void; onFinish: () => void; onMenu: () => void;
}) {
  const { run } = p;
  const view = useMemo(() => getView(run), [run]);
  const [picking, setPicking] = useState<Action | null>(null);
  const def = SPECIES[run.species];
  const ev = view.event;
  const rep = run.report;
  const [acked, setAcked] = useState(run.turnsTaken);
  const flash = !!rep && rep.turn > 0 && acked < run.turnsTaken && isNotable(rep, run.ended);
  const tone = rep ? reportTone(rep, run.ended) : 'plain';

  const doAct = useCallback((id: string, target?: string) => {
    setPicking(null);
    const next = act(run, id, target);
    p.onRun(next);
  }, [run, p]);

  const choose = useCallback((a: Action) => {
    if (a.disabled) return;
    if (a.targets) setPicking(a);
    else doAct(a.id);
  }, [doAct]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (flash) {
        if (e.key === 'Enter' || e.key === ' ' || /^[1-9]$/.test(e.key)) { e.preventDefault(); setAcked(run.turnsTaken); }
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
  }, [run.ended, run.turnsTaken, flash, picking, view.actions, choose, doAct]);

  const older = run.history.slice(0, Math.max(0, run.history.length - (rep ? rep.resolve.length + rep.arrival.length + 1 : 0))).slice(-5);

  if (flash && rep) {
    return (
      <div className={`screen flash ${tone}`}>
        <div className="flashtitle">
          {tone === 'gold' ? 'Victory' : tone === 'bad' ? (run.ended ? 'Life over' : 'That hurt') : tone === 'good' ? 'Close call, survived' : tone === 'warn' ? 'The world pushes back' : 'Result'}
        </div>
        <div className="flashbody"><ReportBody r={rep} ended={run.ended} /></div>
        <button className="btn primary center" autoFocus onClick={() => setAcked(run.turnsTaken)}>
          {run.ended ? 'Continue' : `Continue to turn ${rep.turn + 1}`} <span className="dim">(Enter)</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="screen">
        <div className={`scene ${view.biome}`}>
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
        <div className={`log tone-${tone}`}>
          {rep && <ReportBody r={rep} ended={run.ended} />}
          {older.length > 0 && <div className="olderhead">Earlier</div>}
          {older.map((l, i) => <div key={`o${i}`} className="old">{l}</div>)}
        </div>
      </div>

      <div className="screen">
        <div className="hud">
          <Bar cls="hp" label="Health" value={view.hp} max={view.maxHp} />
          <Bar cls="sat" label="Satiety" value={view.satiety} max={100} />
          <Bar cls="en" label="Energy" value={view.energy} max={100} />
          <Bar cls="safe" label="Safety" value={view.safety} max={100} />
        </div>
        <div className="stats">
          {STATS.map((s) => <span key={s}>{STAT_LABEL[s].slice(0, 3)} <b>{view.stats[s]}</b></span>)}
        </div>
        <div className="goal">Goal: {view.goalLine}{view.nest ? ` Nest: ${view.nest.pups} pups, ${view.nest.turnsLeft} turns to wean.` : ''}</div>
        <div className="look">
          <span className="dim">{view.foodHere}. View tier {view.tier}.</span>
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

        <div className="actions">
          {run.ended ? (
            <>
              <p style={{ margin: 0 }}><b>{run.ended.type === 'win' ? 'Victory.' : run.ended.type === 'old_age' ? 'A full life.' : 'Life over.'}</b> {run.ended.cause}</p>
              <button className="btn primary center" onClick={p.onFinish}>See the debrief</button>
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
      <h3>Experience</h3>
      <table>
        <tbody>
          <tr><td>Survival</td><td className="num">{pay.survival}</td></tr>
          <tr><td>Goal progress</td><td className="num">{pay.goal}</td></tr>
          <tr><td>Goal success and speed</td><td className="num">{pay.feats}</td></tr>
          <tr><td>Discoveries</td><td className="num">{pay.discoveries}</td></tr>
          <tr><td>Ending multiplier</td><td className="num">&times;{pay.endingMult}</td></tr>
          <tr><td>Species difficulty</td><td className="num">&times;{pay.difficulty}</td></tr>
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
