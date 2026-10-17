import { Component, useState } from 'react';
import type { ReactNode } from 'react';
import { BUILD_DATE, FEEDBACK_EMAIL, FEEDBACK_SUBJECT, VERSION } from './version';

export const RUN_STORAGE_KEY = 'species_run_v1';
export const ACCOUNT_STORAGE_KEY = 'species_account_v1';

async function copyText(text: string, fallbackEl?: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      if (fallbackEl) {
        fallbackEl.focus();
        fallbackEl.select();
        return document.execCommand('copy');
      }
    } catch { /* ignore */ }
    return false;
  }
}

function readStored(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Crash report: error plus the run log. Only used on crashes. */
export function buildCrashReport(err: unknown): string {
  const e = err instanceof Error ? err : new Error(String(err));
  const run = readStored(RUN_STORAGE_KEY);
  const acc = readStored(ACCOUNT_STORAGE_KEY);
  const lines: string[] = [
    `Species crash report`,
    `Version ${VERSION} (build ${BUILD_DATE})`,
    `Time ${new Date().toISOString()}`,
    `Browser ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`,
    '',
    `Error: ${e.message}`,
    (e.stack ?? '').split('\n').slice(0, 8).join('\n'),
    '',
  ];
  if (acc) lines.push(`Account: level ${acc.level}, ${acc.lives} lives`);
  if (run) {
    lines.push(
      `Run: ${run.species}, seed ${run.rng}, turn ${run.age}, at ${run.loc}`,
      `Vitals: hp ${run.hp}, satiety ${Math.round(run.satiety)}, energy ${Math.round(run.energy)}, safety ${Math.round(run.safety)}`,
      `Stats: ${JSON.stringify(run.stats)}`,
      `Event: ${run.event ? run.event.id : 'none'}`,
      '',
      'Run log (last 60 lines):',
      ...(run.history ?? []).slice(-60),
    );
  } else {
    lines.push('No run in progress.');
  }
  return lines.join('\n');
}

export function VersionFooter(p: { onFeedback: () => void }) {
  return (
    <div className="footer small dim">
      <span>Species v{VERSION} &middot; build {BUILD_DATE}</span>
      <button className="linkbtn" onClick={p.onFeedback}>Send feedback</button>
    </div>
  );
}

const CATEGORIES = ['Bug', 'Balance', 'Idea', 'Confusing', 'Other'] as const;

export function Feedback(p: { context: string; onClose: () => void }) {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('Idea');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const body = `[${cat}] ${text.trim()}\n\n--\nSpecies v${VERSION} (build ${BUILD_DATE})\n${p.context}`;
  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`${FEEDBACK_SUBJECT} [${cat}]`)}&body=${encodeURIComponent(body)}`;
  const empty = text.trim().length === 0;
  return (
    <div className="screen pad stack">
      <h2>Send feedback</h2>
      <p className="small dim">Tell us what you noticed. The version and where you are in the game are attached automatically.</p>
      <div className="row">
        {CATEGORIES.map((c) => (
          <button key={c} className={`btn chipbtn ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <textarea
        className="fbtext" rows={6} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="What happened? What did you expect? What did you feel?"
      />
      <div className="small dim">Attached: v{VERSION}, build {BUILD_DATE}. {p.context}</div>
      {FEEDBACK_EMAIL && (
        <a className={`btn primary center ${empty ? 'disabledlink' : ''}`} href={empty ? undefined : mailto} aria-disabled={empty}>
          Send by email
        </a>
      )}
      <button
        className={`btn ${FEEDBACK_EMAIL ? '' : 'primary'} center`} disabled={empty}
        onClick={async () => setStatus((await copyText(body)) ? 'Copied. Paste it wherever you were asked to send feedback.' : 'Could not copy automatically. Select the text above and copy it.')}
      >
        Copy feedback
      </button>
      {status && <div className="small" style={{ color: 'var(--good)' }}>{status}</div>}
      <button className="btn center" onClick={p.onClose}>Back to the game</button>
    </div>
  );
}

export function CrashScreen(p: { error: unknown; onDiscardRun: () => void }) {
  const report = buildCrashReport(p.error);
  const [status, setStatus] = useState('');
  let areaRef: HTMLTextAreaElement | null = null;
  return (
    <div className="console">
      <div className="screen flash bad">
        <div className="flashtitle">Something broke</div>
        <p>Sorry about that. Your progress is saved on this device. Please copy the report below and send it along; it has what is needed to reproduce the problem.</p>
        <textarea className="fbtext" rows={8} readOnly value={report} ref={(el) => { areaRef = el; }} />
        <button className="btn primary center" onClick={async () => setStatus((await copyText(report, areaRef)) ? 'Copied.' : 'Select the text and copy it manually.')}>
          Copy crash report
        </button>
        {status && <div className="small" style={{ color: 'var(--good)' }}>{status}</div>}
        <button className="btn center" onClick={() => location.reload()}>Reload the game</button>
        <button className="btn center" onClick={p.onDiscardRun}>Abandon this life and reload</button>
      </div>
      <div className="footer small dim"><span>Species v{VERSION} &middot; build {BUILD_DATE}</span></div>
    </div>
  );
}

export class CrashBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidMount() {
    window.addEventListener('error', this.onWin);
    window.addEventListener('unhandledrejection', this.onRej);
  }
  componentWillUnmount() {
    window.removeEventListener('error', this.onWin);
    window.removeEventListener('unhandledrejection', this.onRej);
  }
  onWin = (e: ErrorEvent) => this.setState({ error: e.error ?? new Error(e.message) });
  onRej = (e: PromiseRejectionEvent) => this.setState({ error: e.reason });
  discard = () => {
    try { localStorage.removeItem(RUN_STORAGE_KEY); } catch { /* ignore */ }
    location.reload();
  };
  render() {
    if (this.state.error) return <CrashScreen error={this.state.error} onDiscardRun={this.discard} />;
    return this.props.children;
  }
}
