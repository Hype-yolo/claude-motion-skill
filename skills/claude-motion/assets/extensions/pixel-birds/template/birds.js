// Adapted extraction from simonw/tools, Apache-2.0. Original region retained.
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = a => '#' + a.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const shade = (h, k) => toHex(rgbOf(h).map(v => v * k));
const mix = (h1, h2, k) => { const b = rgbOf(h2); return toHex(rgbOf(h1).map((v, i) => v + (b[i] - v) * k)); };
const u32 = h => { const [r, g, b] = rgbOf(h); return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; };
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function paintGrid(g, rows, map, ox, oy) {
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch !== '.') { g.fillStyle = map[ch]; g.fillRect(ox + x, oy + y, 1, 1); }
    }
  }
}

/* ------------------------------------------------------------ the kākāpō */
// Front-on bird, 18 px wide.
// K outline · G D L H Y moss-green plumage · F f S facial disc · C B b beak · E W eyes · P p feet
const BODY = [
  '......KKKKKK......',
  '....KKGHGGHGKK....',
  '...KGDGHGGHGDGK...',
  '..KGDGFFFFFFGDGK..',
  '..KGFFFffffFFFGK..',
  '.KGFWEFCCCCFWEFGK.',
  '.KGFEEFbBBbFEEFGK.',
  '.KGFSffbBBbffSFGK.',
  '.KGFFSffBbffSFFGK.',
  'KGDGFFfFbbFfFFGDGK',
  'KGGDGFFfSSfFFGDGGK',
  'KGLGDGFFFFFFGDGLGK',
  'KDGDGLGYGGYGLGDGDK',
  'KGDGDGYGLLGYGDGDGK',
  'KDGDGYGLYYLGYGDGDK',
  'KGDGDLGYGGYGLDGDGK',
  '.KDGDGLGYYGLGDGDK.',
  '..KGDGGLGGLGGDGK..',
  '...KKPPKKKKPPKK...',
  '..KPpPpPKKPpPpPK..',
  '...KKKKK..KKKKK...',
];
const AIR_LEGS = [
  '...KKPPKKKKPPKK...',
  '....KPPK..KPPK....',
  '...KPpPK..KPpPK...',
  '....KKK....KKK....',
];
// Left wings; the right wing is mirrored. Kākāpō can't fly, but they flap to parachute down.
const WING_UP  = ['..KK...', '.KLGK..', 'KLLDGK.', 'KLGLDGK', '.KLGDGK', '..KGLDK', '...KGGK', '....KKK'];
const WING_OUT = ['...KKKK.', '.KKGDGGK', 'KLGLGDGK', 'KLDLDLK.', '.KKKKK..'];

const GREENS = [
  { K: '#1f2a0f', G: '#6f8f2a', D: '#435e1a', L: '#a3b43f', H: '#86a532', Y: '#b3b54f' },
  { K: '#242b0e', G: '#7e962c', D: '#4f6319', L: '#b6c048', H: '#95ae39', Y: '#c4c05a' },
  { K: '#1a240c', G: '#5f7e25', D: '#3a5217', L: '#93a83a', H: '#779a2e', Y: '#a4aa4a' },
];
const FACES = [
  { F: '#a88b58', f: '#cdb37e', S: '#735f39' },
  { F: '#a0754e', f: '#c69c6f', S: '#6a4a30' },
];
const COMMON = { C: '#8a867b', B: '#ebe5cf', b: '#b2ab98', E: '#120d0a', W: '#ffffff', P: '#c7a3a0', p: '#8e6c6a' };
const VARIANTS = [];
for (const g of GREENS) for (const f of FACES) VARIANTS.push(Object.assign({}, COMMON, g, f));

const OX = 7, FW = 32;           // body sits 7 px in from the left of each frame canvas
function widen(rows, a, b) {     // chubbier rows for squash and the chest-puffed "boom"
  return rows.map((r, i) => {
    if (i < a || i >= b) return [0, r];
    let L = 0, R = r.length - 1;
    while (r[L] === '.') L++;
    while (r[R] === '.') R--;
    return [-1, r.slice(0, L + 1) + r[L + 1] + r.slice(L + 1, R) + r[R - 1] + r.slice(R)];
  });
}
function buildFrames(pal) {
  const plain = rows => rows.map(r => [0, r]);
  const defs = {
    STAND:  [plain(BODY)],
    SQUASH: [widen(BODY.slice(0, 13).concat([BODY[14]], BODY.slice(16)), 9, 16)],
    UP:     [plain(BODY.slice(0, 14).concat([BODY[13]], BODY.slice(14, 18), AIR_LEGS)), WING_UP, -6, 2],
    DOWN:   [plain(BODY.slice(0, 18).concat(AIR_LEGS)), WING_OUT, -7, 8],
    PUFF:   [widen(BODY, 9, 18)],
  };
  const out = {};
  for (const k in defs) {
    const [rows, wing, wx, wy] = defs[k];
    const c = mkCanvas(FW, rows.length), g = c.getContext('2d');
    rows.forEach(([dx, r], y) => paintGrid(g, [r], pal, OX + dx, y));
    if (wing) {
      paintGrid(g, wing, pal, OX + wx, wy);
      const mirrored = wing.map(r => r.split('').reverse().join(''));
      paintGrid(g, mirrored, pal, OX + 17 - wx - (wing[0].length - 1), wy);
    }
    out[k] = { c, h: rows.length };
  }
  return out;
}
const FRAMES = VARIANTS.map(buildFrames);


export {FRAMES,paintGrid,shade,mix,hash};
