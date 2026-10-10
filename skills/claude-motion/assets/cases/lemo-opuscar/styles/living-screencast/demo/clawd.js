// Clawd：18×10 方像素。由 Claude Code 终端 logo 的象限字符 ▐▛███▜▌ / ▝▜█████▛▘ / ▘▘ ▝▝ 1:1 展开
//（每个字符格 = 2×2 象限，行加倍成方像素）。道具与特效用同一像素网格。
export const CLAY = '#D97757', CLAY_D = '#B85F40', EYE = '#2A2622';

// 返回 [[c, r, kind]]，kind: 1 身体 2 眼睛
export function grid({ eyes = 'n', arms = 'down', legs = 'stand' } = {}) {
  const P = new Map(), put = (c, r, v = 1) => P.set(c + ',' + r, v);
  for (let r = 0; r < 8; r++) for (let c = 3; c <= 14; c++) put(c, r);
  if (arms === 'up') for (const r of [0, 1, 2, 3]) { put(1, r); put(2, r); put(15, r); put(16, r); }
  else if (arms === 'wave') { for (const r of [4, 5]) { put(1, r); put(2, r); } for (const r of [0, 1, 2, 3]) { put(15, r); put(16, r); } }
  else if (arms === 'tuck') { /* 手收起 */ }
  else for (const r of [4, 5]) for (const c of [1, 2, 15, 16]) put(c, r);
  const L = { stand: [[4, 2], [6, 2], [11, 2], [13, 2]], walkA: [[4, 2], [6, 1], [11, 2], [13, 1]], walkB: [[4, 1], [6, 2], [11, 1], [13, 2]],
    tuck: [[4, 1], [6, 1], [11, 1], [13, 1]], none: [] }[legs];
  for (const [c, h] of L) for (let r = 8; r < 8 + h; r++) put(c, r);
  const E = { n: [[5, 2], [5, 3], [12, 2], [12, 3]], r: [[6, 2], [6, 3], [13, 2], [13, 3]], l: [[4, 2], [4, 3], [11, 2], [11, 3]],
    u: [[5, 1], [5, 2], [12, 1], [12, 2]], d: [[5, 3], [5, 4], [12, 3], [12, 4]],
    blink: [[5, 3], [12, 3]], happy: [[4, 3], [5, 2], [6, 3], [11, 3], [12, 2], [13, 3]], wide: [[5, 1], [5, 2], [5, 3], [12, 1], [12, 2], [12, 3]],
    shut: [[4, 3], [5, 3], [6, 3], [11, 3], [12, 3], [13, 3]] }[eyes];
  for (const [c, r] of E) put(c, r, 2);
  return [...P].map(([k, v]) => { const [c, r] = k.split(',').map(Number); return [c, r, v]; });
}

// x,y = 脚底中点（世界坐标）；px = 像素边长；sq>0 压扁 <0 拉长；flip 朝左；rot 弧度（空翻）
export function sprite({ x, y, px = 7, flip = false, sq = 0, rot = 0, op = 1, shadow = 0, ...pose }) {
  const G = grid(pose); let s = '';
  for (let [c, r, v] of G) { if (flip) c = 17 - c; s += `<rect x="${c}" y="${r}" width="1.04" height="1.04" fill="${v === 2 ? EYE : CLAY}"/>`; }
  // 身体下沿一排暗色像素 = 体积感（只画在身体行 7）
  for (let c = 3; c <= 14; c++) s += `<rect x="${c}" y="7" width="1.04" height="1.04" fill="${CLAY_D}" opacity=".55"/>`;
  const sy = 1 - sq, sx = 1 + sq * .7, w = 18 * px * sx, h = 10 * px * sy;
  const sh = shadow > 0 ? `<div style="position:absolute;left:${x - 7 * px}px;top:${y - px * .4}px;width:${14 * px}px;height:${px * .8}px;border-radius:50%;background:rgba(0,0,0,${.16 * shadow})"></div>` : '';
  return sh + `<svg class="px" viewBox="0 0 18 10" width="${w}" height="${h}" style="left:${x - w / 2}px;top:${y - h}px;opacity:${op};transform:rotate(${rot}rad);transform-origin:50% 60%" shape-rendering="crispEdges">${s}</svg>`;
}
// 精灵的像素中心点（世界坐标），给像素爆散/合体用
export function pixels(o) {
  const { x, y, px = 7, flip = false } = o;
  return grid(o).map(([c, r, v]) => ({ x: x + ((flip ? 17 - c : c) - 9 + .5) * px, y: y + (r - 10 + .5) * px, v }));
}
export function pixart(rows, { x, y, px = 7, pal, op = 1 }) {
  let s = ''; rows.forEach((row, r) => [...row].forEach((ch, c) => { if (pal[ch]) s += `<rect x="${c}" y="${r}" width="1.04" height="1.04" fill="${pal[ch]}"/>`; }));
  const W = rows[0].length, H = rows.length;
  return `<svg class="px" viewBox="0 0 ${W} ${H}" width="${W * px}" height="${H * px}" style="left:${x}px;top:${y}px;opacity:${op}" shape-rendering="crispEdges">${s}</svg>`;
}
export const BANG = (x, y, px = 6, op = 1) => pixart(['.kkk.', 'kwwwk', 'kwkwk', 'kwkwk', 'kwwwk', 'kwkwk', 'kwwwk', '.kkk.', '..k..'], { x, y, px, op, pal: { w: '#fff', k: EYE } });
export const DOTS = (x, y, px = 6, n = 3, op = 1) => n < 1 ? '' : pixart(['kk.kk.kk'.slice(0, n * 3 - 1), 'kk.kk.kk'.slice(0, n * 3 - 1)], { x, y, px, op, pal: { k: EYE } });
export const PENCIL = (x, y, px = 6, op = 1) => pixart(['......kk', '.....yyk', '....yyy.', '...yyy..', '..yyy...', '.pyy....', 'ppy.....', 'k.......'], { x, y, px, op, pal: { y: '#F2C14E', k: EYE, p: '#E8A898' } });
export const SPARK = (x, y, px = 6, col = '#F2C14E', op = 1) => pixart(['..y..', '..y..', 'yy.yy', '..y..', '..y..'], { x: x - 2.5 * px, y: y - 2.5 * px, px, op, pal: { y: col } });
export const HEART = (x, y, px = 5, op = 1) => pixart(['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], { x: x - 3.5 * px, y: y - 3 * px, px, op, pal: { r: '#E0543A' } });
export const CHECK = (x, y, px = 6, op = 1) => pixart(['.....g', '....gg', 'g..gg.', 'gggg..', '.gg...'], { x, y, px, op, pal: { g: '#2F9E4F' } });
export const SWEAT = (x, y, px = 5, op = 1) => pixart(['.b.', 'bbb', 'bbb', '.b.'], { x, y, px, op, pal: { b: '#7FB6E8' } });
// 尘土：t 0→1 向两侧散开
export function dust(x, y, t, px = 5, n = 6, seed = 1) {
  if (t <= 0 || t >= 1) return ''; let s = '';
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, k = (i >> 1) + 1, e = 1 - Math.pow(1 - t, 2);
    const dx = side * (18 + k * 16 + ((seed * 7 + i * 13) % 9)) * e, dy = -(8 + k * 5) * Math.sin(Math.PI * t * .9);
    const sz = px * (1 - t * .7);
    s += `<div style="position:absolute;left:${x + dx - sz / 2}px;top:${y + dy - sz}px;width:${sz}px;height:${sz}px;background:#CFC7B6;opacity:${1 - t}"></div>`;
  }
  return s;
}
// 速度线：像素短横
export function speedlines(x, y, dir, t, px = 5) {
  if (t <= 0 || t >= 1) return ''; let s = '';
  for (let i = 0; i < 4; i++) {
    const len = (3 + (i % 2) * 3) * px, off = (i * 23 + 11) % 60 - 30;
    s += `<div style="position:absolute;left:${x - dir * (40 + i * 12) - (dir > 0 ? len : 0)}px;top:${y - 40 + off}px;width:${len}px;height:${px}px;background:${CLAY};opacity:${(1 - t) * .7}"></div>`;
  }
  return s;
}
