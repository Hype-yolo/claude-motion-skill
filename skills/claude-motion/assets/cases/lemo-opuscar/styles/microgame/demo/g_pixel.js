// 像素画风（向 pixel-rpg 学：索引色帧缓冲、整数像素、最近邻放大、1px 墨色外轮廓、Bayer 抖动）——自写简化版
import { canvas } from './glpass.js';
import { mulberry, clamp, seg } from '/core/lib.js';
export const PW = 240, PH = 135, SC = 8;
const PAL = ['#0d0b21', '#1e1d4f', '#3e3d91', '#7d7ce0', '#f4f1e6', '#c7bfa8', '#ff7a1a', '#b4480c', '#45e0e0', '#1a8a9a', '#ffc9a3', '#7a4128', '#8c8aa3', '#55536b', '#ffd23f', '#ff3b3b', '#241f3d', '#ffffff', '#e0cfa0', '#8a4a2a'];
export const C = { space: 0, deep: 1, indigo: 2, lav: 3, suit: 4, suitD: 5, org: 6, orgD: 7, cyan: 8, teal: 9, skin: 10, hair: 11, gray: 12, grayD: 13, yel: 14, red: 15, ink: 16, white: 17, sand: 18, rust: 19 };
const RGB = PAL.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const fb = new Uint8Array(PW * PH), spr = new Int16Array(PW * PH);
const [pc, px] = canvas(PW, PH); const img = px.createImageData(PW, PH);
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + .5) / 16;
export function pset(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < PW && y < PH) fb[y * PW + x] = c; }
export function fill(c) { fb.fill(c); }
export function rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) pset(x + i, y + j, c); }
export function disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx + .5) ** 2 + (y - cy + .5) ** 2 <= r * r) pset(x, y, c); }
// 精灵层：先画进 spr（-1 = 空），再自动加 1px 墨色外轮廓，合进 fb
function sclear() { spr.fill(-1); }
function sset(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < PW && y < PH) spr[y * PW + x] = c; }
function srect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) sset(x + i, y + j, c); }
function sdisc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx + .5) ** 2 + (y - cy + .5) ** 2 <= r * r) sset(x, y, c); }
function sflush(outline = C.ink) {
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const i = y * PW + x;
    if (spr[i] >= 0) { fb[i] = spr[i]; continue; }
    if ((x > 0 && spr[i - 1] >= 0) || (x < PW - 1 && spr[i + 1] >= 0) || (y > 0 && spr[i - PW] >= 0) || (y < PH - 1 && spr[i + PW] >= 0)) fb[i] = outline;
  }
}
export function present(g, x = 0, y = 0, s = SC, key = -1) {
  const d = img.data;
  for (let i = 0; i < PW * PH; i++) { const c = RGB[fb[i]]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = fb[i] === key ? 0 : 255; }
  px.putImageData(img, 0, 0);
  g.save(); g.imageSmoothingEnabled = false; g.drawImage(pc, x, y, PW * s, PH * s); g.restore();
}

// ───────── 像素版 Dot（约 22×30）：pose = 'stand' | 'run0' | 'run1' | 'jump' | 'win'；(x,y) = 脚底中心 ─────────
export function cadetPix(x, y, pose = 'stand', o = {}) {
  sclear(); x |= 0; y |= 0;
  const jump = pose === 'jump', win = pose === 'win';
  // 背包
  srect(x - 10, y - 20, 4, 9, C.org); srect(x - 10, y - 12, 4, 1, C.orgD);
  // 腿 / 靴
  const lf = pose === 'run0' ? [-1, 2] : pose === 'run1' ? [2, -1] : [0, 0];
  if (jump) { srect(x - 5, y - 9, 4, 3, C.suit); srect(x + 1, y - 10, 4, 3, C.suit); srect(x - 6, y - 7, 5, 3, C.org); srect(x + 1, y - 8, 5, 3, C.org); }
  else {
    srect(x - 5 + lf[0], y - 8, 4, 5, C.suit); srect(x + 1 + lf[1], y - 8, 4, 5, C.suit);
    srect(x - 6 + lf[0], y - 3, 5, 3, C.org); srect(x + 1 + lf[1], y - 3, 6, 3, C.org);
    srect(x - 6 + lf[0], y - 1, 5, 1, C.orgD); srect(x + 1 + lf[1], y - 1, 6, 1, C.orgD);
  }
  // 身体
  srect(x - 6, y - 19, 13, 11, C.suit); srect(x + 5, y - 18, 2, 9, C.suitD); srect(x - 6, y - 10, 13, 2, C.gray);
  srect(x - 3, y - 17, 5, 4, C.org); sset(x - 2, y - 16, C.white); sset(x, y - 16, C.white); sset(x - 2, y - 15, C.white); sset(x, y - 15, C.white);
  // 手臂
  if (jump || win) { srect(x - 9, y - 26, 3, 7, C.suit); srect(x + 7, y - 26, 3, 7, C.suit); srect(x - 10, y - 28, 4, 3, C.org); srect(x + 7, y - 28, 4, 3, C.org); }
  else { const sw = pose === 'run0' ? 1 : pose === 'run1' ? -1 : 0; srect(x - 8 + sw, y - 18, 3, 6, C.suit); srect(x + 6 - sw, y - 18, 3, 6, C.suit); srect(x - 9 + sw, y - 13, 4, 3, C.org); srect(x + 6 - sw, y - 13, 4, 3, C.org); }
  // 领圈
  srect(x - 6, y - 21, 13, 2, C.cyan);
  // 头盔（玻璃）+ 脸
  const hx = x + .5, hy = y - 29;
  sdisc(hx, hy, 8.6, C.deep);
  sdisc(hx + 1, hy + 1, 6.2, C.skin);
  srect(x - 5, hy - 6, 10, 3, C.hair); srect(x - 6, hy - 4, 3, 3, C.hair); srect(x - 1, hy - 8, 4, 2, C.hair);
  // 眼（面向右）
  const blink = o.blink;
  if (win) { sset(x + 1, hy, C.ink); sset(x + 2, hy - 1, C.ink); sset(x + 3, hy, C.ink); sset(x + 5, hy, C.ink); sset(x + 6, hy - 1, C.ink); }
  else { srect(x + 2, hy - 1, 1, blink ? 1 : 2, C.ink); srect(x + 5, hy - 1, 1, blink ? 1 : 2, C.ink); }
  sset(x + 1, hy + 2, C.red); sset(x + 6, hy + 2, C.red);
  sset(x + 3, hy + 3, C.ink); sset(x + 4, hy + 3, C.ink);
  // 玻璃高光
  sset(x - 4, hy - 4, C.white); sset(x - 5, hy - 3, C.white); sset(x - 5, hy - 2, C.white);
  // 天线
  const aw = o.ant || 0;
  sset(x, hy - 9, C.gray); sset(x, hy - 10, C.gray); sset(x + (aw > .5 ? 1 : aw < -.5 ? -1 : 0), hy - 11, C.gray); sset(x + (aw > .5 ? 1 : aw < -.5 ? -1 : 0), hy - 12, C.gray);
  const bx = x + (aw > .5 ? 2 : aw < -.5 ? -2 : 0);
  srect(bx - 1, hy - 15, 3, 3, C.org); sset(bx - 1, hy - 15, C.yel);
  sflush();
  return { ball: [bx, hy - 14] };
}
// 陨石：带火尾
export function meteor(x, y, r, t) {
  sclear();
  for (let i = 0; i < 26; i++) {   // 尾巴（右侧，因为陨石向左飞）
    const tx = x + r + i * 1.6, spread = r * (1 - i / 26);
    for (let j = -spread; j <= spread; j++) { const b = bayer(tx | 0, (y + j) | 0); const heat = 1 - i / 26 - Math.abs(j) / (spread + 1) * .6; if (heat > b * .9) pset(tx, y + j + Math.sin(t * 30 + i) * .5, heat > .7 ? C.yel : heat > .45 ? C.org : C.red); }
  }
  sdisc(x, y, r, C.rust); sdisc(x - 1, y - 1, r - 2, C.gray); sdisc(x + r * .3, y - r * .2, r * .25, C.grayD); sdisc(x - r * .35, y + r * .3, r * .2, C.grayD);
  sflush();
}
function stars(scroll, seed, n, col, par) {
  const r = mulberry(seed);
  for (let i = 0; i < n; i++) { const sx = ((r() * PW * 2 - scroll * par) % PW + PW) % PW, sy = r() * (PH - 32); pset(sx, sy, col); }
}
function planet(cx, cy, R) {
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const d = x * x + y * y; if (d > R * R) continue;
    const lx = (x + R * .45) / R, ly = (y + R * .4) / R, sh = lx * lx + ly * ly;
    const band = Math.sin((y + x * .3) * .35) > .6;
    const b = bayer(cx + x, cy + y);
    let c = band ? C.lav : C.indigo;
    if (sh > 1.15 + b * .5) c = C.deep;
    if (sh < .25 + b * .2) c = band ? C.white : C.lav;
    pset(cx + x, cy + y, c);
  }
}
function ground(scroll) {
  const top = PH - 26;
  for (let x = 0; x < PW; x++) {
    const wx = x + scroll, h = Math.round(2 * Math.sin(wx * .05) + 1.4 * Math.sin(wx * .13));
    for (let y = top + h; y < PH; y++) {
      const dy = y - top - h, b = bayer(x, y);
      pset(x, y, dy === 0 ? C.suitD : dy < 3 ? C.gray : (dy < 8 && b < .5) ? C.gray : C.grayD);
    }
  }
  // 陨石坑
  for (let k = 0; k < 6; k++) { const cx = ((k * 67 - scroll) % (PW + 60) + PW + 60) % (PW + 60) - 30, cy = top + 10 + (k % 3) * 4; for (let x = -7; x <= 7; x++) { pset(cx + x, cy, C.grayD); if (Math.abs(x) < 6) pset(cx + x, cy + 1, C.space); } pset(cx - 8, cy - 1, C.suitD); pset(cx + 8, cy - 1, C.suitD); }
}

// ───────── G5 DODGE!（本地 lt，0..2.571s，140 BPM，12fps）─────────
const BEAT = 60 / 140;
export const DODGE_HITS = [2, 3.5, 5].map(b => b * BEAT);
export function sceneDodge(g, lt, o = {}) {
  const T = o.step === false ? lt : Math.floor(lt * 12) / 12;
  const scroll = T * 90;
  fill(C.space);
  stars(scroll, 1, 90, C.indigo, .2); stars(scroll, 2, 40, C.lav, .45); stars(scroll, 3, 14, C.white, .8);
  planet(182, 36, 22);
  ground(scroll);
  // 跳跃：以每颗陨石到达时刻为中心
  const X = 62, gy = PH - 26;
  let jy = 0, pose = Math.floor(T * 8) % 2 ? 'run0' : 'run1';
  for (const h of DODGE_HITS) { const u = (T - (h - .2)) / .4; if (u >= 0 && u <= 1) { jy = Math.round(4 * u * (1 - u) * 30); pose = 'jump'; } }
  const won = T >= DODGE_HITS[2] + .25;
  if (won) { pose = 'win'; jy = Math.round(Math.abs(Math.sin((T - 2.4) * 9)) * 6); }
  // 陨石（从右飞来，在到达时刻越过 Dot 的 x）
  DODGE_HITS.forEach((h, i) => {
    const mx = X + (h - T) * 260, my = gy - 8;
    if (mx > -40 && mx < PW + 40) meteor(mx, my, i === 1 ? 8 : 6, T);
  });
  const ant = T > DODGE_HITS[2] && T < DODGE_HITS[2] + .4 ? Math.sin((T - DODGE_HITS[2]) * 40) : 0;
  const d = cadetPix(X, gy - jy + (pose === 'jump' ? 0 : 1), pose, { ant });
  // 第三颗擦过天线球：火花
  if (Math.abs(T - DODGE_HITS[2]) < .09) { const bx = X, by = gy - jy - 2; for (let k = 0; k < 6; k++) pset(bx + [3, 5, 2, 4, 6, 1][k], by + [-3, 0, -5, 3, -2, 2][k], k % 2 ? C.yel : C.white); }
  present(g);
}

// 海鸥（像素，给 Boss 关客串）
export function gull(x, y, f) {
  sclear(); x |= 0; y |= 0;
  const up = f % 2 === 0;
  srect(x - 2, y, 6, 3, C.white); sset(x + 4, y, C.white); sset(x + 5, y + 1, C.yel);
  if (up) { srect(x - 6, y - 3, 4, 1, C.white); srect(x - 3, y - 2, 2, 2, C.white); srect(x + 2, y - 3, 4, 1, C.white); srect(x + 1, y - 2, 2, 2, C.white); }
  else { srect(x - 6, y + 2, 4, 1, C.white); srect(x - 3, y + 1, 2, 1, C.white); srect(x + 2, y + 2, 4, 1, C.white); srect(x + 1, y + 1, 2, 1, C.white); }
  sset(x + 3, y, C.ink);
  sflush();
}
