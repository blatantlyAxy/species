// Small deterministic PRNG (mulberry32). State lives on the object so runs are saveable.
export function nextRand(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function seededRand(seed: number): () => number {
  const s = { rng: seed >>> 0 };
  return () => nextRand(s);
}

export function weightedPick<T>(items: { w: number; v: T }[], r: number): T | undefined {
  const total = items.reduce((a, b) => a + Math.max(0, b.w), 0);
  if (total <= 0) return undefined;
  let x = r * total;
  for (const it of items) {
    x -= Math.max(0, it.w);
    if (x <= 0) return it.v;
  }
  return items[items.length - 1]?.v;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
