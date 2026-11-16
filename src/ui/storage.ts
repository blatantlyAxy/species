import { createAccount, normalizeAccount, normalizeRun } from '../engine';
import type { Account, RunState } from '../engine';

// Everything the game keeps on this device. Three keys: the account, a backup of the account taken at the
// end of each life, and the life in progress. The key names keep their "_v1" suffix so saves from every
// earlier build still load; the schema version lives inside the account (SAVE_VERSION).

export const ACCOUNT_KEY = 'species_account_v1';
export const BACKUP_KEY = 'species_account_backup_v1';
export const RUN_KEY = 'species_run_v1';

/** How the account was loaded: as saved, from the backup, or started over because nothing could be read. */
export type LoadState = 'ok' | 'new' | 'backup' | 'reset';

function read(key: string): { found: boolean; value: unknown } {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { found: false, value: null };
    const value = JSON.parse(raw);
    return { found: true, value: value && typeof value === 'object' ? value : null };
  } catch {
    return { found: true, value: null };
  }
}

function write(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

let backupLives = -1;

export function loadAccount(): { account: Account; state: LoadState } {
  const main = read(ACCOUNT_KEY);
  if (main.value) return { account: normalizeAccount(main.value), state: 'ok' };
  const backup = read(BACKUP_KEY);
  if (backup.value) return { account: normalizeAccount(backup.value), state: 'backup' };
  return { account: createAccount(), state: main.found || backup.found ? 'reset' : 'new' };
}

/** Save the account. The backup copy is refreshed once per finished life, so one bad write cannot take both. */
export function saveAccount(account: Account): boolean {
  const text = JSON.stringify(account);
  const ok = write(ACCOUNT_KEY, text);
  if (ok && account.lives !== backupLives) {
    if (write(BACKUP_KEY, text)) backupLives = account.lives;
  }
  return ok;
}

/** The life in progress, or null. A run that cannot be played is dropped here instead of crashing later. */
export function loadRun(): { run: RunState | null; dropped: boolean } {
  const r = read(RUN_KEY);
  if (!r.found) return { run: null, dropped: false };
  const run = normalizeRun(r.value);
  if (!run) write(RUN_KEY, null);
  return { run, dropped: !run };
}

export function saveRun(run: RunState | null): boolean {
  return write(RUN_KEY, run ? JSON.stringify(run) : null);
}

export function eraseAll(): void {
  backupLives = -1;
  write(ACCOUNT_KEY, null);
  write(BACKUP_KEY, null);
  write(RUN_KEY, null);
}

/** Ask the browser not to clear this site's storage under pressure. Best effort; never throws. */
export function requestPersistence(): void {
  try { void navigator.storage?.persist?.().catch(() => undefined); } catch { /* not supported */ }
}
