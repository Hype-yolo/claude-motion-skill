// portraits.js — 对话框头像（32×32，3/4 侧向右），底图 + 表情叠层（眉眼 x9–25 行 14–19，嘴 x15–23 行 22–24）
import { C, sprFromRows } from './px.js';

const BASE_A = [
  '...........kkkkk..kkk.kk........',
  '........kkkhhhhhkkhhhkhhk.......',
  '......kkhhhHHHHHhhhhhhk.........',
  '.....khhhHHHHHHHHHhhhhhkk.......',
  '....khhHHHHhhhhhHHHHhhhhhk......',
  '...khhHHHhhhhhhhhhHHHhhhhk......',
  '..khhhhhhhhhhhhhhhhhhhhhhk......',
  '..khjhhhhhhhhhhhhhhhhhhhhhk.....',
  '.khjjhhhhhhhhjhhhhhhjhhhhhk.....',
  '.khjhhhhhhhhjfhhhhhjfjhhhhhk....',
  '.kjjhhhhhhhjffhhhhjfffjhhjhk....',
  'kjjhhhhhhhjfffhhhjffffffjffk....',
  'kjjhhhhhhjffffffffffffffffk.....',
  'kjjhhhhhjfffffffffffffffffk.....',
  'kjjhhhhhFffffffffffffffffk......',
  'kjjhhFGFFfffffffffffffffk.......',
  '.kjhFGGFFfffffffffffffffk.......',
  '.kjhFFGFFfffffffffffffffk.......',
  '.kjjhFFFFffffffffFfffffk........',
  '..kjjFFfffffffffFFsffffk........',
  '..kjjjFffffffffffffffffk........',
  '...kjjFFffffffffffffffk.........',
  '....kjFFfffffffffffffk..........',
  '.....kFFFffffffffffffk..........',
  '......kFFFfffffffffFk...........',
  '.......kkFFFFFfffFFk............',
  '.........kkFFFFFFkk.............',
  '..........kFFFFFFk..............',
  '.......kkrrrrrrrrrrrkk..........',
  '.....kkrrqqqrrrrrrrRRRk.........',
  '..kkkttkrrrrrrRRRRRRRkkttk......',
  '.kttTTTTkkkkkkkkkkkkkTTTTtk.....',
];
// 眉眼叠层：5 行（y14–18），从 x9 起 17 列；'.' = 保留底图
const EYES = {
  neutral: [
    '..bbbb.....bbb...',
    '.................',
    '..kkkkk....kkkk..',
    '..kwiiw....wiik..',
    '..kwIiF....wIiF..',
  ],
  wistful: [
    '.....b.....b.....',
    '..bbb.......bbb..',
    '.................',
    '..kkkkk....kkkk..',
    '..FwiiF....wiiF..',
  ],
  smile: [
    '..bbbb.....bbbb..',
    '.................',
    '.................',
    '...kkk......kk...',
    '..k...k....k..k..',
  ],
  sad: [
    '....bb.....bb....',
    '..bb.........bb..',
    '.................',
    '..kkkkk....kkkk..',
    '...FFF......FF...',
  ],
  determined: [
    '..bb..........bb.',
    '....bbb....bbb...',
    '..kkkkk....kkkk..',
    '..kwiik....kiik..',
    '..FwIiF....wIiF..',
  ],
};
const MOUTH = {
  neutral: ['.........', '...mmm...', '.........'],
  wistful: ['.........', '...mmm...', '....FF...'],
  smile: ['.........', '..m...m..', '...mmm...'],
  sad: ['...mmm...', '..m...m..', '.........'],
  determined: ['.........', '..mmmmm..', '...FFF...'],
};
const MAP_A = {
  k: C.ink, h: C.dbrown, H: C.brown, j: C.umber, f: C.skin, F: C.skinS, s: C.sand, G: C.brown,
  i: C.navy, I: C.blue, w: C.white, b: C.umber, m: C.dbrown, r: C.scarf, R: C.scarfD, q: C.scarfL, t: C.navy, T: C.blue,
};
function overlay(base, ov, x0, y0) {
  const rows = base.map(r => r.split(''));
  ov.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') rows[y0 + j][x0 + i] = r[i]; });
  return rows.map(r => r.join(''));
}
const cache = new Map();
export function portraitArlo(expr = 'neutral') {
  if (cache.has('a' + expr)) return cache.get('a' + expr);
  let rows = overlay(BASE_A, EYES[expr], 9, 12);
  rows = overlay(rows, MOUTH[expr], 14, 21);
  const s = sprFromRows(rows, MAP_A); cache.set('a' + expr, s); return s;
}

// WREN（16-bit，微笑）：短波波头 + 刘海，绿色领口，围巾
const BASE_W = [
  '................................',
  '..........kkkkkkkk..............',
  '.......kkkhhhhhhhhkk............',
  '.....kkhhhHHHHHHHhhhkk..........',
  '....khhhHHHHHHHHHHHhhhk.........',
  '...khhHHHHhhhhhhhHHHhhhk........',
  '..khhHHHhhhhhhhhhhHHHhhhk.......',
  '..khhhhhhhhhhhhhhhhhhhhhk.......',
  '.khhhhhhhhhhhhhhhhhhhhhhhk......',
  '.khhhhhhhhjhhhhhhjhhhhhhhk......',
  'khhhhhhhhjfhhhhhjffhhhjhhhk.....',
  'khhjhhhhjffhhhhjfffhhjffhhk.....',
  'khhjhhhjffffhhjffffffjfffhk.....',
  'khjjhhhjffffffffffffffffffk.....',
  'khjhhhhffffffffffffffffffk......',
  'khjhhhfffffffffffffffffffk......',
  'khjhhhFfffffffffffffffffk.......',
  'khjhhFFFffffffffffffffffk.......',
  'khjhhFsFfffffffffffffffk........',
  'khjjhFFFfffffffffFffffk.........',
  '.khjhhFFffffffffFFsfffk.........',
  '.khjjhhFfffffffffffffk..........',
  '.khjjhhFFfffffffffffFk..........',
  '..kjjhhkFFffffffffffk...........',
  '..kjjhk.kFFfffffffFk............',
  '...kjk...kkFFFFFFkk.............',
  '...kk......kFFFFk...............',
  '.........kkrrrrrrkk.............',
  '.......kkrrqqqrrrRRkk...........',
  '....kkggkrrrrrRRRRRRkggk........',
  '..kkgGGGGkRRRRRRRRkkGGGggk......',
  '.kgGGGGGGGkkkkkkkkkGGGGGggk.....',
];
const EYES_W = [
  '..kkk......kkk...',
  '.k...k....k...k..',
  '.................',
  '.................',
  '..F.F.......F....',
];
const EYES_W_OPEN = [
  '..bbb......bb....',
  '.kkkkk....kkkk...',
  '.kwiiw....wiik...',
  '..wIiw....wIi....',
  '...FF......FF....',
];
const MAP_W = { ...MAP_A, h: C.rust, H: C.clay, j: C.dbrown, b: C.dbrown, i: C.dgreen, I: C.green, g: C.dgreen, G: C.green, m: C.crimson };
export function portraitWren(expr = 'smile') {
  if (cache.has('w' + expr)) return cache.get('w' + expr);
  let rows = overlay(BASE_W, expr === 'smile' ? EYES_W : EYES_W_OPEN, 8, 14);
  rows = overlay(rows, expr === 'smile' ? MOUTH.smile : MOUTH.neutral, 13, 21);
  const s = sprFromRows(rows, MAP_W); cache.set('w' + expr, s); return s;
}

// WREN 8-bit 头像（24×24，黑底白框对话框用）：4 色 + 透明
const W8 = [
  '........................',
  '.......oooooooo.........',
  '.....oohhhhhhhhoo.......',
  '....ohhhhhhhhhhhho......',
  '...ohhhhhhhhhhhhhho.....',
  '...ohhhhhhhhhhhhhho.....',
  '..ohhhhhhhhhhhhhhhho....',
  '..ohhhhsshhhhsshhhho....',
  '..ohhhsssshhsssshhho....',
  '..ohhssssssssssssho.....',
  '..ohhsooossssooosho.....',
  '..ohhssoossssoossho.....',
  '..ohhsssssssssssho......',
  '..ohhssssssssssho.......',
  '..ohhhssssoossssho......',
  '...ohhssssssssso........',
  '...oho.ssssssso.........',
  '....o...ooooo...........',
  '.......rrrrrrrr.........',
  '.....rrrrrrrrrrrr.......',
  '...ggrrrrrrrrrrrrgg.....',
  '..ggggrrrrrrrrrrgggg....',
  '.ggggggoooooooogggggg...',
  'gggggggggggggggggggggg..',
];
export function portraitWren8() {
  if (cache.has('w8')) return cache.get('w8');
  const s = sprFromRows(W8, { o: C.ink, h: C.rust, s: C.skin, r: C.scarf, g: C.green });
  cache.set('w8', s); return s;
}
