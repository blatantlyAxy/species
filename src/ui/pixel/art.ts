// Pixel scene art. Everything here is plain data and pure functions (no canvas, no DOM), so it runs in tests.
// Sprites are 16 by 16 character grids using one shared palette. These are placeholders: to replace one,
// redraw its grid here (or, later, load a PNG through a manifest and fall back to these).

export const SCENE_W = 160;
export const SCENE_H = 64;
export const SPRITE = 16;

/** One shared palette. '.' is transparent. */
export const PAL: Record<string, string> = {
  k: '#1a1c2c', // outline
  w: '#f4f4f4', // white
  g: '#b8c2d0', // light grey
  G: '#7d8aa0', // grey
  D: '#566178', // dark grey
  b: '#b0703f', // brown
  B: '#6f4426', // dark brown
  t: '#e0b070', // tan
  o: '#e8823a', // orange
  O: '#b85a20', // dark orange
  p: '#f2a2b0', // pink
  y: '#ffd34e', // yellow
  r: '#d9534f', // red
};

export type SpriteId = 'mouse' | 'deer' | 'wolf' | 'hawk' | 'fox' | 'nest';

/** All sprites face right. Foes are mirrored when drawn. */
export const SPRITES: Record<SpriteId, string[]> = {
  mouse: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........kk....',
    '.........kppk...',
    '.....kkkkkpGkk..',
    '...kkGGGGGGGGGk.',
    '..kGGGGGGGGGkGGk',
    '..kGGGGGGGGGGGGp',
    '.pkGGGGGGGGGGGk.',
    'p.kGGgggggggGk..',
    'p..kkgggggggk...',
    '.pp.kkkkkkkkk...',
    '....pk....pk....',
  ],
  deer: [
    '.........t...t..',
    '.........tt.tt..',
    '..........ttt...',
    '..........kbbk..',
    '.........kbbkbk.',
    '.........kbbbbbk',
    '..........kbbkk.',
    '.wkkkkkkkkbbk...',
    'wkbbbbbbbbbbk...',
    '.kbbbbbbbbbbk...',
    '.kbbtttttttbk...',
    '.kbkkkkkkkbbk...',
    '.kbk.....kbk....',
    '.kbk.....kbk....',
    '.kBk.....kBk....',
    '.kkk.....kkk....',
  ],
  wolf: [
    '................',
    '................',
    '..........k..k..',
    '.........kGkkGk.',
    '.........kGGGGGk',
    '.........kGGkGGw',
    'k........kGGGGkk',
    'Gk.kkkkkkGGGGk..',
    'kGkGGGGGGGGGGk..',
    '.kGGGGGGGGGGGk..',
    '..kGGgggggGGGk..',
    '..kGkkkkkkkGGk..',
    '..kGk.....kGk...',
    '..kGk.....kGk...',
    '..kDk.....kDk...',
    '..kkk.....kkk...',
  ],
  hawk: [
    '................',
    'kk..........kk..',
    'kBk........kBk..',
    'kBBk......kBBk..',
    '.kBBBk..kBBBk...',
    '..kBBBBkBBBBk...',
    '...kBBBBBBBkkk..',
    '....kBbbbBkwwky.',
    '....kBbbbbkwkky.',
    '.....kbbbbbkk...',
    '......kbbbk.....',
    '......ky.yk.....',
    '......y...y.....',
    '................',
    '................',
    '................',
  ],
  fox: [
    '................',
    '................',
    '................',
    '..........k..k..',
    '.........kokkok.',
    '.........kooooo.',
    '.........kookoow',
    'ww.......koooowk',
    'wok.kkkkkooook..',
    'kookooooooook...',
    '.koooooooooook..',
    '..kooowwwwwook..',
    '..kokkkkkkkook..',
    '..kOk.....kOk...',
    '..kOk.....kOk...',
    '..kkk.....kkk...',
  ],
  nest: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....pp..pp.....',
    '....kppkkppk....',
    '..tktttttttkt...',
    '.tBtBtBtBtBtBt..',
    '..tBtBtBtBtBt...',
    '...tttttttttt...',
    '................',
  ],
};

export type Biome = 'meadow' | 'forest' | 'river' | 'highlands';

export interface SceneSpec {
  biome: Biome;
  /** 0 spring, 1 summer, 2 autumn, 3 winter. */
  season: number;
  /** Seeds the scenery so each place always looks the same. */
  place: string;
  player: SpriteId;
  foe?: SpriteId;
  /** Other animals of your kind standing with you (herd or pack), drawn small. Capped when drawn. */
  companions?: number;
  nest?: boolean;
  /** 0 or 1: the two steps of the idle bob. */
  frame: number;
}

export interface Frame { w: number; h: number; px: Uint32Array }

/** Where things stand, in scene pixels. The UI places name tags from the same numbers. */
export const PLAYER_X = 40;
export const FOE_X = 108;
export const GROUND_Y = 54;

const rgb = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  // canvas ImageData is RGBA bytes; on little-endian machines that is 0xAABBGGRR as a 32-bit number
  return (0xff << 24) | ((n & 0xff) << 16) | (((n >> 8) & 0xff) << 8) | ((n >> 16) & 0xff);
};
const PAL32: Record<string, number> = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, rgb(v)]));

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// sky (top, bottom), far hills, ground (light, dark), accent, for each biome and season
type Look = { sky: [string, string]; far: string; ground: [string, string]; accent: string };
const LOOKS: Record<Biome, Look[]> = {
  meadow: [
    { sky: ['#8fd0f4', '#d4efc0'], far: '#7fc27a', ground: ['#6fbf5c', '#4e9a48'], accent: '#f6e36b' },
    { sky: ['#7cc4f2', '#cfe8b0'], far: '#6cb05f', ground: ['#5faa4f', '#3f7e3a'], accent: '#f2a2b0' },
    { sky: ['#f0c890', '#f4e2b4'], far: '#c79a52', ground: ['#c9a04a', '#9a7434'], accent: '#d9534f' },
    { sky: ['#b9c6d8', '#e4eaf2'], far: '#c5cede', ground: ['#eef2f8', '#c3ccdc'], accent: '#9fb0c8' },
  ],
  forest: [
    { sky: ['#8fc8b8', '#c4e4c0'], far: '#4f8f62', ground: ['#4a8a54', '#2f6038'], accent: '#3a7446' },
    { sky: ['#7ab89a', '#b0d8a8'], far: '#3f7a50', ground: ['#3e7a48', '#285230'], accent: '#2f6038' },
    { sky: ['#e0b078', '#eed0a0'], far: '#a8703a', ground: ['#8a6a34', '#5e4622'], accent: '#c0602a' },
    { sky: ['#a8b6c8', '#d8e0ea'], far: '#7f93a4', ground: ['#dfe6ee', '#aebccc'], accent: '#4a6a5a' },
  ],
  river: [
    { sky: ['#9bd4ee', '#d2eef0'], far: '#7cbf8a', ground: ['#74b868', '#4f9050'], accent: '#55a8e0' },
    { sky: ['#86c8ec', '#c4e6ec'], far: '#68ac74', ground: ['#62a658', '#407c42'], accent: '#3f86b8' },
    { sky: ['#ecc48e', '#f2dcb2'], far: '#b8904e', ground: ['#b89848', '#866c30'], accent: '#4f8eb0' },
    { sky: ['#b4c2d6', '#e0e8f0'], far: '#bcc8d8', ground: ['#e8eef6', '#bcc8da'], accent: '#8fb4d0' },
  ],
  highlands: [
    { sky: ['#b0c4e4', '#dce6f2'], far: '#8a94ac', ground: ['#8fa07c', '#6a7860'], accent: '#f4f4f4' },
    { sky: ['#a4bce0', '#d4e0f0'], far: '#7e88a0', ground: ['#869670', '#5e6c54'], accent: '#f4f4f4' },
    { sky: ['#d8b89c', '#ecd8c0'], far: '#8c8494', ground: ['#9a8a64', '#6e6248'], accent: '#f4f4f4' },
    { sky: ['#aab4c8', '#d8dee8'], far: '#9aa3b8', ground: ['#e6eaf2', '#b4bccc'], accent: '#f4f4f4' },
  ],
};

class Canvas {
  px: Uint32Array;
  constructor(public w: number, public h: number) { this.px = new Uint32Array(w * h); }
  set(x: number, y: number, c: number) {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  sprite(id: SpriteId, x: number, y: number, scale: number, flip = false, shade?: Record<string, string>) {
    const rows = SPRITES[id];
    for (let j = 0; j < SPRITE; j++) for (let i = 0; i < SPRITE; i++) {
      let ch = rows[j][flip ? SPRITE - 1 - i : i];
      if (ch === '.') continue;
      if (shade && shade[ch]) ch = shade[ch];
      this.rect(x + i * scale, y + j * scale, scale, scale, PAL32[ch]);
    }
  }
}

function backdrop(c: Canvas, spec: SceneSpec) {
  const look = LOOKS[spec.biome][((spec.season % 4) + 4) % 4];
  const r = rng(hash(spec.place));
  const horizon = 38;
  const [skyTop, skyLow] = look.sky.map(rgb);
  const far = rgb(look.far);
  const [gLight, gDark] = look.ground.map(rgb);
  const accent = rgb(look.accent);
  const winter = spec.season === 3;

  // sky in two bands with a dithered seam
  for (let y = 0; y < horizon; y++) for (let x = 0; x < c.w; x++) {
    const low = y > 20 || (y > 16 && (x + y) % 2 === 0);
    c.set(x, y, low ? skyLow : skyTop);
  }
  // sun, or a pale winter sun
  const sunX = 118 + Math.floor(r() * 24);
  c.rect(sunX, 5, 6, 6, rgb(winter ? '#f4f4f4' : '#fff0a0'));
  c.rect(sunX + 1, 4, 4, 8, rgb(winter ? '#f4f4f4' : '#fff0a0'));
  // clouds
  for (let i = 0; i < 2; i++) {
    const cx = Math.floor(r() * 110) + 6; const cy = 4 + Math.floor(r() * 8);
    c.rect(cx, cy + 1, 14, 2, rgb('#ffffff')); c.rect(cx + 3, cy, 8, 1, rgb('#ffffff'));
  }
  // far line: rolling hills, or peaks in the highlands
  const phase = r() * 6;
  for (let x = 0; x < c.w; x++) {
    let top: number;
    if (spec.biome === 'highlands') {
      const tri = Math.abs(((x + phase * 9) % 46) - 23);
      top = 12 + Math.floor(tri * 0.9);
      for (let y = top; y < horizon; y++) c.set(x, y, y < top + 4 ? accent : far);
    } else {
      top = 30 + Math.round(Math.sin(x / 13 + phase) * 3 + Math.sin(x / 5 + phase) * 1);
      for (let y = top; y < horizon; y++) c.set(x, y, far);
    }
  }
  // ground with a dithered top edge
  for (let y = horizon; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const dark = y > 50 || (y > 44 && (x + y) % 2 === 0);
    c.set(x, y, dark ? gDark : gLight);
  }

  if (spec.biome === 'forest') {
    // a row of pines behind, leaving the middle clear for the animals
    for (let i = 0; i < 9; i++) {
      const tx = Math.floor(r() * 150) + 4; const th = 14 + Math.floor(r() * 10);
      const base = horizon + 2;
      c.rect(tx, base - 3, 2, 5, rgb('#5e4622'));
      for (let j = 0; j < th; j++) {
        const half = Math.floor((j % 6) / 1.5) + 1 + Math.floor(j / 6);
        c.rect(tx + 1 - half, base - 3 - th + j, half * 2, 1, j % 6 === 0 && winter ? rgb('#f4f4f4') : accent);
      }
    }
  }
  if (spec.biome === 'river') {
    // water along the bottom, with ripples that move on the second frame
    const water = accent; const lite = rgb('#bfe6ff');
    for (let y = 56; y < c.h; y++) for (let x = 0; x < c.w; x++) c.set(x, y, water);
    for (let i = 0; i < 14; i++) {
      const rx = (Math.floor(r() * 150) + spec.frame * 2) % 156; const ry = 57 + Math.floor(r() * 6);
      c.rect(rx, ry, 4, 1, winter ? rgb('#f4f4f4') : lite);
    }
    // reeds
    for (let i = 0; i < 10; i++) {
      const rx = Math.floor(r() * 156) + 2; const rh = 5 + Math.floor(r() * 5);
      c.rect(rx, 56 - rh, 1, rh, rgb(winter ? '#a89a70' : '#3f7e3a'));
      c.rect(rx, 56 - rh - 2, 1, 2, rgb('#6f4426'));
    }
  }
  if (spec.biome === 'highlands') {
    for (let i = 0; i < 7; i++) {
      const rx = Math.floor(r() * 150) + 2; const ry = 42 + Math.floor(r() * 18); const rw = 4 + Math.floor(r() * 6);
      c.rect(rx, ry, rw, 3, rgb('#7d8aa0')); c.rect(rx + 1, ry - 1, rw - 2, 1, rgb('#b8c2d0'));
    }
  }
  if (spec.biome === 'meadow' || spec.biome === 'river') {
    // grass tufts and, outside winter, flowers
    for (let i = 0; i < 26; i++) {
      const gx = Math.floor(r() * 158); const gy = 40 + Math.floor(r() * (spec.biome === 'river' ? 14 : 22));
      c.set(gx, gy, gDark); c.set(gx + 1, gy - 1, gDark); c.set(gx + 2, gy, gDark);
      if (!winter && spec.biome === 'meadow' && i % 3 === 0) c.set(gx + 1, gy - 2, accent);
    }
  }
  if (winter) {
    // falling snow, shifted on the second frame
    for (let i = 0; i < 40; i++) {
      const sx = Math.floor(r() * c.w); const sy = (Math.floor(r() * c.h) + spec.frame * 2) % c.h;
      c.set(sx, sy, rgb('#ffffff'));
    }
  }
}

/** Draw the whole scene for one frame. */
export function drawScene(spec: SceneSpec): Frame {
  const c = new Canvas(SCENE_W, SCENE_H);
  backdrop(c, spec);
  const shadow = rgb('#1a1c2c');
  const bob = spec.frame % 2;
  // companions stand behind, small
  const mates = Math.min(4, Math.max(0, spec.companions ?? 0));
  for (let i = 0; i < mates; i++) {
    const mx = 1 + i * 8; const my = GROUND_Y - 22 - (i % 2) * 4;
    c.sprite(spec.player, mx, my + ((i + bob) % 2), 1, i % 2 === 1);
  }
  if (spec.nest) c.sprite('nest', PLAYER_X + 30, GROUND_Y - 16, 1);
  // the player, two scene pixels per sprite pixel
  c.rect(PLAYER_X + 4, GROUND_Y - 1, 24, 2, shadow);
  c.sprite(spec.player, PLAYER_X, GROUND_Y - 32 - bob, 2);
  if (spec.foe) {
    const flying = spec.foe === 'hawk';
    const rival = spec.foe === spec.player;
    const fy = flying ? GROUND_Y - 50 : GROUND_Y - 32;
    if (!flying) c.rect(FOE_X + 4, GROUND_Y - 1, 24, 2, shadow);
    c.sprite(spec.foe, FOE_X, fy + bob, 2, true, rival ? { G: 'D', g: 'G' } : undefined);
  }
  return { w: c.w, h: c.h, px: c.px };
}
