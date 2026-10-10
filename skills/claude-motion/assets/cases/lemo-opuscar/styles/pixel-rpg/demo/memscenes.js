// memscenes.js — 三段回忆（4 色村庄 160×90 / 8-bit 篝火 / 16-bit 战斗）、缩略图、片名、结尾卡
import { W, H, FB, C, T, GBI, bayer, bayer8, hash, clamp, sprFromRows } from './px.js';
import { drawChar, scarfTail } from './sprites.js';
import { kidArlo, kidWren, kidWrenPoint } from './memsprites.js';
import { crystal, halo } from './props.js';
import { glow, LIGHT, DARK, shadowBlob } from './scenes.js';
import { text, textW, textOutlined } from './font.js';

// ———————————————— 回忆一：4 色村庄（半分辨率 160×90）————————————————
const [K, D, Lg, Wt] = GBI;
export const half = new FB(160, 90);
export function village(t, lt) {      // lt = 本段内时间
  const f = half; f.clear(Wt);
  const walkEnd = 4.667, kx = 58 + Math.min(lt, walkEnd) * 27;      // 小孩世界 x（半分辨率）
  const cam = Math.round(clamp(kx - 62, 0, 150));
  // 天：晨雾抖动 + 太阳（指向远方后升起一点）
  for (let y = 0; y < 30; y++) for (let x = 0; x < 160; x++) if (bayer(x, y) < (1 - y / 30) * .45) f.px(x, y, Lg);
  const rise = clamp((lt - 5.25) / 1.5, 0, 1), sx = 136 - Math.round(cam * .1), sy = 40 - Math.round(rise * 6);
  f.disc(sx - 0, sy, 7, Wt); for (let a = 0; a < 6.3; a += .22) f.px(Math.round(sx + Math.cos(a) * 8), Math.round(sy + Math.sin(a) * 8), Lg);
  if (rise > 0) for (let k = 0; k < 8; k++) { const a = -Math.PI + k * Math.PI / 7; for (let r = 11; r < 11 + rise * 7; r++) if ((r + k) % 2) f.px(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), Lg); }
  // 远山（视差 0.3）
  for (let x = 0; x < 160; x++) { const wx = x + cam * .3, top = Math.round(40 + 5 * Math.sin(wx * .05) + 3 * Math.sin(wx * .13)); for (let y = top; y < 56; y++) f.px(x, y, y === top ? D : Lg); }
  // 村庄（视差 0.8）：房子、树、炊烟
  const vo = Math.round(cam * .8);
  const house = (hx, w, h) => {
    const x0 = hx - vo, base = 58;
    for (let y = base - h; y < base; y++) for (let x = x0; x < x0 + w; x++) f.px(x, y, (x === x0 || x === x0 + w - 1) ? K : Wt);
    for (let i = 0; i < w / 2 + 2; i++) f.hline(x0 - 1 + i, x0 + w - i, base - h - 1 - i, i === 0 ? K : (i % 2 ? D : K));
    f.rect(x0 + 2, base - h + 3, 2, 2, K); f.rect(x0 + w - 5, base - 5, 3, 5, D);
    const cxm = x0 + w - 4; f.rect(cxm, base - h - w / 2 + 1, 2, 4, K);
    for (let k = 0; k < 4; k++) { const ph = (t * .6 + k * .25) % 1; f.px(cxm + Math.round(Math.sin(ph * 6 + k) * 1.5), base - h - w / 2 - 2 - Math.round(ph * 10), Lg); }
  };
  house(8, 14, 9); house(30, 18, 11); house(58, 12, 8);
  const tree = (tx, r) => { const x0 = tx - vo; f.disc(x0, 50, r, D); for (let a = 0; a < 6.3; a += .3) f.px(Math.round(x0 + Math.cos(a) * r), Math.round(50 + Math.sin(a) * r), K); f.vline(x0, 50 + r, 58, K); };
  tree(-4, 5); tree(50, 4); tree(78, 5);
  // 木栅门 + 路牌（1.0）
  for (let x = 88; x < 104; x += 3) { f.vline(x - cam, 50, 58, K); f.px(x - cam, 49, D); }
  f.hline(87 - cam, 104 - cam, 52, K); f.hline(87 - cam, 104 - cam, 55, K);
  f.rect(108 - cam, 46, 12, 5, D); f.rect(109 - cam, 47, 10, 3, Lg); f.vline(113 - cam, 51, 58, K);
  // 地面 + 小路 + 山坡
  for (let x = 0; x < 160; x++) {
    const wx = x + cam, hill = wx > 175 ? Math.round(Math.min(6, (wx - 175) * .12)) : 0, top = 58 - hill;
    for (let y = top; y < 90; y++) f.px(x, y, y === top ? K : (y < top + 3 ? Lg : (bayer(x + cam, y) < .28 ? K : D)));
    if (hash(wx, 3) < .12) f.px(x, top - 1, D);
  }
  // 小孩：WREN 在后、ARLO 在前（面向右），走路 8 fps 两帧；登顶后 WREN 指向太阳
  const hillAt = wx => wx > 175 ? Math.round(Math.min(6, (wx - 175) * .12)) : 0;
  const walking = lt < walkEnd, fr = walking ? Math.floor(lt * 8) : 0;
  const wx = Math.round(kx - 10 - cam), ax = Math.round(kx - cam);
  const wy = 58 - hillAt(kx - 10 + cam * 0 + 0) , ay = 58 - hillAt(kx);
  // 围巾（WREN 的，比她还长）
  const ph = Math.floor(t * 8) % 3;
  for (let i = 1; i < 10; i++) f.px(wx + 3 - i, wy - 6 + Math.round(i * .25 + Math.sin(ph * 2 - i * .8) * .8), i % 4 === 0 ? K : D);
  f.blit(lt > 5.25 ? kidWrenPoint() : kidWren(fr), wx, wy - 13);
  f.blit(kidArlo(fr + 1), ax, ay - 13);
  return f;
}
export function blitHalf(fb, f) { for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) { const c = f.d[y * 160 + x], i = y * 2 * W + x * 2; fb.d[i] = c; fb.d[i + 1] = c; fb.d[i + W] = c; fb.d[i + W + 1] = c; } }

// ———————————————— 回忆二：8-bit 篝火 ————————————————
const S8 = { k: C.ink, h: C.dbrown, H: C.brown, s: C.skin, c: C.navy, C: C.blue, d: C.dslate, b: C.umber, r: C.scarf, R: C.scarfD, g: C.green, G: C.dgreen, o: C.rust, O: C.clay };
const A8 = sprFromRows([
  '....kkkk......',
  '...kHHHHk.....',
  '..kHhhhhhk....',
  '..khhhssk.....',
  '..khhskssk....',
  '...khssssk....',
  '....kkssk.....',
  '...kcCCCk.....',
  '..kcCCCCCk....',
  '..kcCCCsssk...',
  '..kccccCkk....',
  '..kddddddkkk..',
  '..kddddddddbk.',
  '...kkkkkkkkbk.',
  '..........kbk.',
  '..........kbbk',
  '..........kkkk',
], S8);
const W8s = sprFromRows([
  '....kkkk......',
  '...kOOOOk.....',
  '..kOoooook....',
  '.kooooossk....',
  '.koooskssk....',
  '.kooosssk.....',
  '.ko.kksk......',
  '.k.kRrrRk.....',
  '..kgggggk.....',
  '..kgggssk.....',
  '..kggggsk.....',
  '..kGGGGGGkkk..',
  '..kGGGGGGGGbk.',
  '...kkkkkkkkbk.',
  '..........kbk.',
  '..........kbbk',
  '..........kkkk',
], S8);
export function campfire(fb, t, lt) {
  // 天：黑 + 星（4 fps 闪）
  fb.clear(C.ink);
  for (let i = 0; i < 90; i++) { const x = Math.floor(hash(i, 1) * W), y = Math.floor(hash(i, 2) * 80); if (Math.floor(t * 4 + i) % 7 === 0) continue; fb.px(x, y, hash(i, 3) < .25 ? C.white : C.steel); }
  fb.disc(262, 26, 7, C.sand); fb.disc(265, 24, 6, C.ink);
  const ss = lt - 6.0; if (ss > 0 && ss < .6) { const x = 40 + ss * 300, y = 14 + ss * 50; for (let k = 0; k < 14; k++) fb.px(Math.round(x - k * 2.2), Math.round(y - k * .4), k < 3 ? C.white : C.steel); }
  // 松林剪影（两层）
  for (let k = 0; k < 18; k++) {
    const tx = k * 20 - 8 + Math.round(hash(k, 4) * 8), th = 30 + Math.round(hash(k, 5) * 26), base = 96;
    for (let y = 0; y < th; y++) { const hw = Math.round((y / th) * 8 + (y % 5 < 2 ? 1 : 0)); fb.hline(tx - hw, tx + hw, base - th + y, C.teal); }
  }
  for (let y = 90; y < 100; y++) fb.hline(0, W - 1, y, C.teal);
  // 地面（深绿，火光照亮）
  for (let y = 100; y < H; y++) for (let x = 0; x < W; x++) fb.px(x, y, y === 100 ? C.green : (bayer(x, y) < .25 ? C.teal : C.dgreen));
  // 圆木凳
  const logY = 130;
  fb.rect(92, logY - 7, 86, 8, C.dbrown); fb.hline(92, 177, logY - 7, C.brown); fb.rect(92, logY - 7, 4, 8, C.tan); fb.px(93, logY - 4, C.dbrown); fb.hline(92, 177, logY, C.umber);
  // 篝火（3 帧）
  const fx = 222, fy = 136, fr = Math.floor(t * 8) % 3;
  for (let k = -2; k <= 2; k++) fb.line(fx - 11, fy + 1 + k * .5, fx + 11, fy - 1 - k * .5, k % 2 ? C.dbrown : C.brown);
  for (let k = 0; k < 7; k++) fb.px(fx - 12 + k * 4, fy + 3, C.slate);
  const flame = [[8, 8, 7, 7, 6, 5, 4, 4, 3, 2, 2, 1, 1], [8, 7, 7, 6, 6, 5, 5, 4, 3, 2, 1, 1, 0], [8, 8, 7, 6, 5, 5, 4, 3, 3, 2, 1, 1, 1]][fr];
  flame.forEach((w, i) => { const sxo = [0, 1, -1][fr] * (i > 6 ? 1 : 0); for (let dx = -w; dx <= w; dx++) fb.px(fx + dx + sxo, fy - 2 - i, i < 4 ? (Math.abs(dx) < w - 2 ? C.yellow : C.orange) : i < 8 ? (Math.abs(dx) < w - 1 ? C.amber : C.red) : C.red); });
  for (let k = 0; k < 6; k++) { const ph = (t * .9 + k * .21) % 1; fb.px(fx + Math.round(Math.sin(ph * 9 + k) * 5), fy - 16 - Math.round(ph * 36), ph < .5 ? C.amber : C.red); }
  // 暖光：地面的绿在火光里变成暖棕（NES 表里落到棕色系），靠近火变成锈红
  { const R = 74 + (fr === 1 ? 2 : 0), warm1 = { [C.dgreen]: C.umber, [C.teal]: C.umber, [C.green]: C.dbrown, [C.dbrown]: C.brown, [C.brown]: C.tan }, warm2 = { [C.dgreen]: C.dbrown, [C.teal]: C.dbrown, [C.green]: C.rust, [C.umber]: C.dbrown, [C.dbrown]: C.rust, [C.brown]: C.clay, [C.navy]: C.blue, [C.skin]: C.sand };
    for (let y = fy - 60; y < H; y++) for (let x = fx - R - 20; x < fx + R + 20; x++) { if (x < 0 || x >= W || y < 0) continue; const d = Math.hypot(x - fx, (y - fy + 4) * 1.6) / R; if (d >= 1) continue; const i = y * W + x, c = fb.d[i], b = bayer(x, y), f = 1 - d;
      if (b < f * f * 1.3 && warm2[c] !== undefined) fb.d[i] = warm2[c]; else if (b < f * 1.2 && warm1[c] !== undefined) fb.d[i] = warm1[c]; } }
  // 两人（8-bit：同一骨架、去高光阶）
  const wrap = clamp((lt - 4.44) / 1.4, 0, 1), close = wrap >= 1;
  const ax = 124 + (close ? 3 : 0), wxp = 150;
  const aS = drawChar('arlo', close ? 'sitlean' : 'sit', { t, flat: true, scarf: close }), wS = drawChar('wren', 'sit', { t, flat: true });
  fb.blit(aS, ax - aS.ox, logY - 6 - aS.oy + 6);
  for (let i = 1; i < 11; i++) fb.px(wxp - 2 - Math.round(i * .45), logY - 25 + i, i % 3 ? C.scarf : C.scarfD);
  fb.blit(wS, wxp - wS.ox, logY - 6 - wS.oy + 6);
  // 围巾的另一端沿弧线绕到他脖子上
  const n0 = [wxp - 1, logY - 25], n1 = [ax + 1, logY - 26];
  if (wrap > 0 && !close) {
    const steps = 22, m = Math.round(steps * wrap);
    for (let i = 0; i <= m; i++) { const u = i / steps, x = n0[0] + (n1[0] - n0[0]) * u, y = n0[1] - Math.sin(u * Math.PI) * 9; fb.px(Math.round(x), Math.round(y), C.scarf); fb.px(Math.round(x), Math.round(y) + 1, C.scarfD); }
  }
  if (close) for (let x = n1[0]; x <= n0[0]; x++) { const y = n1[1] + 1 + Math.round(Math.sin((x - n1[0]) / (n0[0] - n1[0]) * Math.PI) * 2); fb.px(x, y, C.scarf); fb.px(x, y + 1, C.scarfD); }
}

// ———————————————— 回忆三：16-bit 战斗 ————————————————
export const BATTLE = { ground: 110, arloX: 228, wrenX0: 258, wrenX1: 196 };
function shadeBeast(fb, t, charge, hit) {
  const cx = 70, cy = 72, br = Math.sin(t * 3) * 1.5;
  const R = (x, y) => {       // 形体：几团噪声圆的并集
    const blobs = [[0, 8, 34], [-18, -6, 20], [16, -12, 22], [-26, 24, 16], [24, 22, 18], [0, -26, 16]];
    let v = -1e9;
    for (const [bx, by, r] of blobs) { const d = r + br - Math.hypot(x - bx, (y - by) * 1.1); v = Math.max(v, d); }
    return v + (hash(Math.round(x / 2), Math.round(y / 2), Math.floor(t * 8)) - .5) * 3;
  };
  for (let y = -56; y < 48; y++) for (let x = -56; x < 60; x++) {
    const v = R(x, y); if (v < 0) continue;
    const X = cx + x, Y = cy + y;
    let c = v < 1.5 ? C.plum : v < 3 ? C.night : C.ink;
    if (v > 3 && bayer(X, Y) < .12 && y < 0) c = C.night;
    fb.px(X, Y, c);
  }
  // 角
  for (let i = 0; i < 12; i++) { fb.px(cx - 12 - i, cy - 36 - Math.round(i * .9), C.night); fb.px(cx - 11 - i, cy - 36 - Math.round(i * .9), C.ink); fb.px(cx + 14 + i, cy - 38 - Math.round(i * .8), C.night); fb.px(cx + 13 + i, cy - 38 - Math.round(i * .8), C.ink); }
  // 眼：红色、闪
  const eye = Math.floor(t * 5) % 9 === 0 ? C.crimson : C.hot;
  for (const ex of [cx + 6, cx + 20]) { fb.hline(ex - 3, ex + 3, cy - 18, eye); fb.hline(ex - 2, ex + 2, cy - 17, C.red); }
  glow(fb, cx + 13, cy - 18, 14, .6);
  // 嘴：一道锯齿獠牙缝
  for (let x = -10; x <= 16; x++) { const y = cy - 6 + Math.round(Math.abs(x - 3) * .12); fb.px(cx + 8 + x, y, C.crimson); if (x % 4 === 0) { fb.px(cx + 8 + x, y + 1, C.silver); fb.px(cx + 8 + x, y + 2, C.steel); } if (x % 4 === 2) fb.px(cx + 8 + x, y - 1, C.silver); }
  // 爪
  for (const [bx, dir] of [[cx - 22, -1], [cx + 30, 1]]) for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) fb.px(bx + k * 4 * dir + Math.round(i * .5 * dir), cy + 40 + i, i > 3 ? C.silver : C.night);
  // 蓄力：嘴前暗红能量球
  if (charge > 0) {
    const ox = cx + 34, oy = cy - 4, r = 3 + charge * 10;
    for (let y = -r - 3; y <= r + 3; y++) for (let x = -r - 3; x <= r + 3; x++) { const d = Math.hypot(x, y); if (d > r) { if (d < r + 2.5 && Math.floor(d * 2 - t * 30) % 3 === 0) fb.px(ox + x, oy + y, C.hot); continue; } fb.px(ox + x, oy + y, d < r * .45 ? C.pink : d < r * .75 ? C.hot : C.crimson); }
    glow(fb, ox, oy, r * 3, .8);
  }
}
function wardShield(fb, x, y, t, k) {       // 六边形护盾（施放 k 0..1）
  const R = 20 * k;
  for (let a = 0; a < 6; a++) {
    const a0 = a * Math.PI / 3 + Math.PI / 6, a1 = a0 + Math.PI / 3;
    fb.line(x + Math.cos(a0) * R * .6, y + Math.sin(a0) * R, x + Math.cos(a1) * R * .6, y + Math.sin(a1) * R, Math.floor(t * 12 + a) % 3 ? C.cyan : C.white);
  }
  for (let yy = -R; yy <= R; yy++) for (let xx = -R * .6; xx <= R * .6; xx++) { const X = Math.round(x + xx), Y = Math.round(y + yy); if (bayer(X, Y) < .12 * k && (X + Y) % 2 === 0) { const i = Y * W + X; fb.d[i] = LIGHT[fb.d[i]]; } }
}
export function battle(fb, t, lt, st) {    // st: {wrenState, blast, scarfOnly, uiHide}
  // 天：黄昏
  const skyC = [C.plum, C.plum, C.rose, C.pink, C.orange, C.amber, C.yellow];
  for (let y = 0; y < BATTLE.ground; y++) { const v = y / 96 * (skyC.length - 1), b = Math.min(skyC.length - 2, Math.floor(v)), f = v - b; for (let x = 0; x < W; x++) fb.d[y * W + x] = y > 96 ? C.yellow : skyC[bayer(x, y) < f ? b + 1 : b]; }
  fb.disc(250, 84, 16, C.yellow); fb.disc(250, 84, 12, C.white);
  // 远处废墟城堡剪影（慢漂）
  const drift = Math.round(lt * 1.5);
  const towers = [[150, 40, 16], [172, 26, 12], [196, 48, 20], [226, 34, 12], [262, 54, 22], [292, 30, 14], [312, 60, 12]];
  for (const [x, y, w] of towers) { const X = x - drift; fb.rect(X, y, w, BATTLE.ground - y, C.umber); fb.vline(X, y, BATTLE.ground, C.dbrown); for (let c = 0; c < w; c += 4) fb.rect(X + c, y - 3, 2, 3, C.umber); if (hash(x, 1) < .6) fb.rect(X + w / 2 - 1, y + 8, 2, 4, C.orange); }
  for (let x = 0; x < W; x++) { const h = Math.round(92 + 5 * Math.sin((x + drift) * .04)); for (let y = h; y < BATTLE.ground; y++) fb.px(x, y, y === h ? C.plum : C.umber); }
  // 地面：石板
  for (let y = BATTLE.ground; y < H; y++) for (let x = 0; x < W; x++) {
    const d = y - BATTLE.ground, row = Math.floor(Math.sqrt(d * 5)), joint = (Math.sqrt(d * 5) % 1) < .15 || ((x + row * 13) % 30 === 0);
    fb.px(x, y, d === 0 ? C.tan : joint ? C.umber : (row % 2 ? C.dbrown : C.brown));
  }
  // 余烬（调色板循环）
  for (let k = 0; k < 26; k++) { const ph = (lt * .35 + hash(k, 7)) % 1, x = Math.round(hash(k, 8) * W + Math.sin(lt * 2 + k) * 6), y = Math.round(BATTLE.ground + 10 - ph * 120); fb.px(x, y, [C.yellow, C.amber, C.orange, C.red][(k + Math.floor(lt * 10)) % 4]); }
  shadeBeast(fb, t, st.charge || 0);
  // 队伍（面向左 = 翻转）
  const g = BATTLE.ground;
  const ap = st.arloPose || 'ready', aspr = drawChar('arlo', ap, { t, scarf: false });
  shadowBlob(fb, BATTLE.arloX, g, 7);
  fb.blit(aspr, BATTLE.arloX - (aspr.w - aspr.ox), g - aspr.oy, true);
  if (st.wrenX !== undefined && st.wrenVis) {
    const wp = st.wrenPose || 'idle', wspr = drawChar('wren', wp, { t });
    const wx = Math.round(st.wrenX);
    shadowBlob(fb, wx, g, 7);
    scarfTail(fb, wx + 3, g - (wp === 'kneel' ? 19 : 24), t, .7, -1, 13);
    if (!st.blink) fb.blit(wspr, wx - (wspr.w - wspr.ox), g - wspr.oy, true);
  }
  if (st.scarfOnly) {       // 地上只剩她的围巾
    const x0 = BATTLE.wrenX1;
    const rows = ['....rrr.....', '..rrRRrrr...', '.rRrrrrRrr..', 'rRr..rrrRrrr', 'R.......RrR.'];
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') fb.px(x0 - 6 + x, g - 5 + y, r[x] === 'r' ? C.scarf : C.scarfD); });
  }
  if (st.ward > 0) wardShield(fb, BATTLE.wrenX1 - 16, g - 16, t, st.ward);
  if (st.beam > 0) {       // 冲击光束
    for (let y = -7; y <= 7; y++) for (let x = 104; x < 200; x++) { const f = 1 - Math.abs(y) / 8; if (bayer(x, y + 64) < f * st.beam) fb.px(x, g - 18 + y, Math.abs(y) < 3 ? C.white : C.hot); }
  }
}
// 战斗底部窗（名字 + HP）
export function battleUI(fb, win, hpW, wrenKO) {
  win(fb, 8, 134, 304, 42);
  text(fb, 'ARLO', 20, 144, C.white, C.night); text(fb, 'HP', 70, 144, C.silver, C.night); text(fb, '188/350', 88, 144, C.white, C.night);
  const wc = wrenKO ? C.slate : C.white;
  text(fb, 'WREN', 20, 158, wc, wrenKO ? null : C.night); text(fb, 'HP', 70, 158, wrenKO ? C.slate : C.silver, wrenKO ? null : C.night);
  text(fb, (hpW < 10 ? ' ' : '') + hpW + '/280', 88, 158, wrenKO ? C.slate : hpW < 30 ? C.red : C.white, wrenKO ? null : C.night);
  // 右侧：行动栏（装饰）
  text(fb, 'FIGHT', 214, 144, C.steel, C.night); text(fb, 'MAGIC', 214, 158, C.steel, C.night); text(fb, 'ITEM', 262, 144, C.steel, C.night); text(fb, 'RUN', 262, 158, C.slate, C.night);
}

// ———————————————— 缩略图（40×22）————————————————
export function thumbVillage(fb, x0, y0) {
  const f = new FB(20, 11); f.clear(Wt);
  f.disc(14, 4, 2, Wt); for (let a = 0; a < 6.3; a += .5) f.px(Math.round(14 + Math.cos(a) * 3), Math.round(4 + Math.sin(a) * 3), Lg);
  for (let x = 0; x < 20; x++) { const tp = Math.round(6 + Math.sin(x * .4)); for (let y = tp; y < 11; y++) f.px(x, y, y === tp ? D : Lg); }
  for (let x = 0; x < 20; x++) for (let y = 8; y < 11; y++) f.px(x, y, y === 8 ? K : D);
  f.rect(2, 4, 4, 4, Wt); f.hline(1, 6, 3, K); f.px(3, 5, K);
  f.px(9, 6, K); f.px(9, 7, K); f.px(11, 6, K); f.px(11, 7, D);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 20; x++) fb.rect(x0 + x * 2, y0 + y * 2, 2, 2, f.d[y * 20 + x]);
}
export function thumbCamp(fb, x0, y0) {
  fb.rect(x0, y0, 40, 22, C.ink);
  for (let i = 0; i < 10; i++) fb.px(x0 + Math.floor(hash(i, 21) * 40), y0 + Math.floor(hash(i, 22) * 10), C.white);
  for (let k = 0; k < 6; k++) { const tx = x0 + k * 8 + 2; for (let y = 0; y < 8; y++) fb.hline(tx - Math.round(y / 3), tx + Math.round(y / 3), y0 + 8 + y, C.dgreen); }
  fb.rect(x0, y0 + 16, 40, 6, C.teal);
  fb.px(x0 + 27, y0 + 15, C.yellow); fb.px(x0 + 27, y0 + 14, C.amber); fb.px(x0 + 26, y0 + 16, C.red); fb.px(x0 + 28, y0 + 16, C.red); fb.px(x0 + 27, y0 + 13, C.red);
  fb.rect(x0 + 14, y0 + 13, 2, 3, C.navy); fb.px(x0 + 14, y0 + 12, C.dbrown); fb.rect(x0 + 18, y0 + 13, 2, 3, C.green); fb.px(x0 + 18, y0 + 12, C.rust); fb.hline(x0 + 15, x0 + 18, y0 + 13, C.scarf);
}
export function thumbBattle(fb, x0, y0) {
  for (let y = 0; y < 22; y++) for (let x = 0; x < 40; x++) fb.px(x0 + x, y0 + y, y < 5 ? C.plum : y < 9 ? (bayer(x, y) < .5 ? C.rose : C.plum) : y < 13 ? C.pink : y < 15 ? C.orange : C.brown);
  for (const [x, y, w] of [[22, 6, 3], [27, 4, 2], [31, 8, 4], [36, 5, 2]]) fb.rect(x0 + x, y0 + y, w, 15 - y, C.umber);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) if (Math.hypot(x - 6, (y - 5) * 1.1) < 5.5) fb.px(x0 + 3 + x, y0 + 5 + y, C.ink);
  fb.px(x0 + 7, y0 + 8, C.hot); fb.px(x0 + 10, y0 + 8, C.hot);
  fb.rect(x0 + 26, y0 + 13, 2, 3, C.green); fb.px(x0 + 26, y0 + 12, C.rust); fb.px(x0 + 25, y0 + 13, C.scarf);
  fb.rect(x0 + 31, y0 + 13, 2, 3, C.navy); fb.px(x0 + 31, y0 + 12, C.dbrown);
}
export function thumbNow(fb, x0, y0, t) {      // 新存档：现在（褪色）
  for (let y = 0; y < 22; y++) for (let x = 0; x < 40; x++) fb.px(x0 + x, y0 + y, y > 15 ? C.dslate : C.night);
  for (let x = 4; x < 40; x += 12) fb.rect(x0 + x, y0 + 2, 3, 14, C.slate);
  fb.rect(x0 + 18, y0 + 11, 2, 5, C.navy); fb.px(x0 + 18, y0 + 10, C.dbrown); fb.px(x0 + 17, y0 + 12, C.scarf); fb.px(x0 + 16, y0 + 12, C.scarf);
  fb.px(x0 + 26, y0 + 10, C.xc); fb.px(x0 + 26, y0 + 11, C.xb); fb.px(x0 + 26, y0 + 9, C.xw);
}

// ———————————————— 片名 / 结尾卡 ————————————————
const titleCol = (y) => y < 2 ? C.white : y < 4 ? C.silver : y < 6 ? C.steel : C.slate;
export function titleCard(fb, alpha) {          // alpha 0..1：按 Bayer 显现
  const tmp = new FB(); tmp.clear(T);
  const s1 = 'THE LAST', s2 = 'SAVE POINT';
  textOutlined(tmp, s1, Math.round((W - textW(s1, 2)) / 2), 22, titleCol, C.ink, 2);
  textOutlined(tmp, s2, Math.round((W - textW(s2, 2)) / 2), 42, titleCol, C.ink, 2);
  for (let i = 0; i < tmp.d.length; i++) { const c = tmp.d[i]; if (c === T) continue; const x = i % W, y = (i / W) | 0; if (bayer(x, y) < alpha) fb.d[i] = c; }
}
export function endCard(fb, t, lt) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fb.d[y * W + x] = bayer(x, y) < y / H * .8 ? C.night : C.ink;
  for (let i = 0; i < 60; i++) { const x = Math.floor(hash(i, 31) * W), y = Math.floor(hash(i, 32) * H); if (Math.floor(t * 3 + i) % 5) fb.px(x, y, hash(i, 33) < .3 ? C.silver : C.slate); }
  const xs = crystal(Math.floor(t * 8)); halo(fb, 160, 38, 16, .9); fb.blit(xs, 160 - (xs.w >> 1), 38 - (xs.h >> 1));
  const c2 = y => y < 2 ? C.white : y < 4 ? C.yellow : y < 6 ? C.amber : C.orange;
  const s1 = 'THE LAST SAVE POINT';
  textOutlined(fb, s1, Math.round((W - textW(s1, 2)) / 2), 64, c2, C.ink, 2);
  const cont = 'CONTINUE';
  if (lt > .6) { text(fb, cont, 160 - Math.round(textW(cont) / 2) + 4, 94, C.white, C.navy); if (Math.floor(t * 2.5) % 2 === 0) text(fb, '▶', 160 - Math.round(textW(cont) / 2) - 8, 94, C.yellow); }
  const l1 = '16-BIT PIXEL RPG · LEMO-OPUSCAR', l2 = 'LemoLab × Claude Opus 5.5';
  text(fb, l1, Math.round((W - textW(l1)) / 2), 132, C.steel, C.ink);
  text(fb, l2, Math.round((W - textW(l2)) / 2), 146, C.silver, C.ink);
  // 一条红围巾随风从左下飘过
  const u = lt / 4.1, sx = -20 + u * 360, sy = 170 - u * 150 + Math.sin(u * 9) * 6;
  for (let i = 0; i < 16; i++) { const x = Math.round(sx - i * 1.4), y = Math.round(sy + i * .6 + Math.sin(t * 7 - i * .7) * 1.6); fb.px(x, y, i % 5 === 0 ? C.scarfL : C.scarf); fb.px(x, y + 1, C.scarfD); }
}
