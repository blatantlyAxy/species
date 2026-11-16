import { normalizeAccount } from './meta';
import type { Account } from './types';

// Save codes: the account as one line of text the player can copy to another device or keep as a backup.
// Format: SPECIES1.<base64url of the account JSON>.<checksum>. The checksum catches a code that was cut short.

const PREFIX = 'SPECIES1';

function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const toB64 = (text: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromB64(b64: string): string {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeSave(account: Account): string {
  const body = toB64(JSON.stringify(account));
  return `${PREFIX}.${body}.${checksum(body)}`;
}

/** Read a save code. Throws an Error with a message fit to show the player. */
export function decodeSave(code: string): Account {
  const parts = code.replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) throw new Error('That does not look like a Species save code.');
  if (checksum(parts[1]) !== parts[2]) throw new Error('That save code is incomplete or was changed. Copy the whole code and try again.');
  let raw: unknown;
  try { raw = JSON.parse(fromB64(parts[1])); } catch { throw new Error('That save code could not be read.'); }
  if (!raw || typeof raw !== 'object' || typeof (raw as any).xp !== 'number') throw new Error('That save code could not be read.');
  return normalizeAccount(raw);
}
