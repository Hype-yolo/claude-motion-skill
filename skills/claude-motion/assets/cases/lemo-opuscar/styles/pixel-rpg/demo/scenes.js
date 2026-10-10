// scenes.js — 场景：走廊 + 水晶厅（现在）、最终之门（正面仰摇）；光照 = 调色板索引提亮/压暗（不混色）
import { W, H, C, T, bayer, bayer8, hash, vnoise, clamp } from './px.js';
import { drawChar, scarfTail, scarfTailBack } from './sprites.js';
import { crystal, halo, pedestal, door } from './props.js';

// —— 索引提亮 / 压暗表 ——
export const LIGHT = new Uint8Array(256), DARK = new Uint8Array(256);
for (let i = 0; i < 256; i++) { LIGHT[i] = i; DARK[i] = i; }
const up = [[C.ink, C.night], [C.night, C.dslate], [C.dslate, C.slate], [C.slate, C.steel], [C.steel, C.silver], [C.silver, C.white],
  [C.umber, C.dbrown], [C.dbrown, C.brown], [C.brown, C.tan], [C.tan, C.sand], [C.teal, C.dgreen], [C.dgreen, C.green], [C.green, C.lime],
  [C.navy, C.blue], [C.blue, C.cyan], [C.crimson, C.red], [C.red, C.pink], [C.plum, C.rose], [C.rose, C.pink], [C.rust, C.clay], [C.clay, C.tan],
  [C.orange, C.amber], [C.amber, C.yellow], [C.yellow, C.white], [C.skinS, C.skin], [C.skin, C.sand], [C.sand, C.white]];
for (const [a, b] of up) LIGHT[a] = b;
const dn = [[C.night, C.ink], [C.dslate, C.night], [C.slate, C.dslate], [C.steel, C.slate], [C.silver, C.steel], [C.white, C.silver],
  [C.dbrown, C.umber], [C.brown, C.dbrown], [C.tan, C.brown], [C.sand, C.tan], [C.dgreen, C.teal], [C.green, C.dgreen], [C.lime, C.green],
  [C.blue, C.navy], [C.cyan, C.blue], [C.red, C.crimson], [C.pink, C.red], [C.rose, C.plum], [C.clay, C.rust], [C.amber, C.orange], [C.yellow, C.amber],
  [C.orange, C.rust], [C.skin, C.skinS], [C.skinS, C.brown], [C.navy, C.night], [C.teal, C.ink], [C.umber, C.ink], [C.plum, C.night], [C.crimson, C.umber]];
for (const [a, b] of dn) DARK[a] = b;
// 抖动光斑：以 (cx,cy) 为中心、半径 R，按 Bayer 把像素提亮 1–2 级
export function glow(fb, cx, cy, R, k = 1, sy = 1) {
  for (let y = Math.floor(-R); y <= R; y++) for (let x = Math.floor(-R); x <= R; x++) {
    const X = Math.round(cx + x), Y = Math.round(cy + y); if (X < 0 || Y < 0 || X >= fb.w || Y >= fb.h) continue;
    const d = Math.hypot(x, y / sy) / R; if (d >= 1) continue;
    const f = (1 - d) * k, b = bayer(X, Y), i = Y * fb.w + X, c = fb.d[i];
    if (b < f * .55) fb.d[i] = LIGHT[LIGHT[c]]; else if (b < f * 1.1) fb.d[i] = LIGHT[c];
  }
}
export function shade(fb, x0, y0, w, h, f) {        // 区域压暗（f(x,y) 0..1）
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { if (x < 0 || y < 0 || x >= fb.w || y >= fb.h) continue; const v = f(x, y); if (bayer(x, y) < v) { const i = y * fb.w + x; fb.d[i] = DARK[fb.d[i]]; } }
}

// —— 火把 ——（lit 0..1；12 fps 四帧火焰）
export function torch(fb, x, y, t, lit = 1) {
  fb.rect(x - 1, y, 3, 9, C.dbrown); fb.px(x - 1, y, C.brown); fb.vline(x - 1, y + 1, y + 8, C.brown);
  fb.rect(x - 3, y - 2, 7, 3, C.slate); fb.hline(x - 3, x + 3, y - 2, C.steel); fb.px(x - 3, y, C.night); fb.px(x + 3, y, C.night);
  fb.rect(x - 2, y + 9, 5, 2, C.slate); fb.hline(x - 2, x + 2, y + 11, C.night);
  if (lit <= 0) { fb.px(x, y - 3, C.night); fb.px(x - 1, y - 3, C.ink); return; }
  const fr = ((Math.floor(t * 12) % 4) + 4) % 4, hgt = Math.round(8 * Math.min(1, lit * 1.3));
  const shape = [[3, 3, 2, 2, 1, 1, 1, 0], [3, 3, 3, 2, 2, 1, 0, 0], [3, 2, 2, 2, 1, 1, 1, 0], [3, 3, 2, 1, 1, 1, 0, 0]][fr];
  const lean = [0, 1, 0, -1][fr];
  for (let i = 0; i < hgt; i++) {
    const w = shape[i], sx = Math.round(lean * i / 5);
    for (let dx = -w + 1; dx < w; dx++) {
      const edge = Math.abs(dx) === w - 1;
      fb.px(x + dx + sx, y - 3 - i, i < 2 ? (edge ? C.orange : C.yellow) : i < 5 ? (edge ? C.orange : C.amber) : (edge ? C.rust : C.orange));
    }
  }
  fb.px(x + lean, y - 4, C.white);
  if (fr % 2) fb.px(x + lean * 2, y - 12, C.amber);
}
export function torchGlow(fb, x, y, t, lit = 1) { if (lit > 0) glow(fb, x, y - 5, 26 * lit + Math.sin(t * 9 + x) * 1.2, .9 * lit, .8); }

// ————————————————————— 走廊（世界坐标，地面 y = 128）—————————————————————
export const FLOOR = 128;
export const CORR = { crystalX: 331, heroStop: 295, doorFar: 297 };
function farWall(fb, cam, t) {
  const off = Math.round(cam * .35);
  for (let y = 0; y < FLOOR; y++) for (let x = 0; x < W; x++) {
    const wx = x + off, row = Math.floor(y / 9), o2 = row % 2 ? 7 : 0, ly = y % 9;
    const mort = ly === 8 || (wx + o2) % 14 === 0;
    let c = mort ? C.ink : ly === 0 ? C.dslate : C.night;
    if (!mort && hash(Math.floor((wx + o2) / 14), row, 11) < .12) c = C.dslate;
    fb.d[y * W + x] = c;
  }
  // 拱窗（每 96 px），窗外夜空 + 星 + 月
  for (let k = Math.floor(off / 96) - 1; k <= Math.floor((off + W) / 96) + 1; k++) {
    const wx0 = k * 96 + 30; if (wx0 + 30 > CORR.doorFar) continue;
    const x0 = wx0 - off, top = 20, bot = 98, ww = 26, cx = x0 + ww / 2;
    for (let y = top; y < bot; y++) for (let x = x0; x < x0 + ww; x++) {
      const inArch = y > top + 12 || Math.hypot((x + .5 - cx) * 1.0, (y - (top + 13)) * 1.0) < ww / 2 - 0 && Math.abs(x + .5 - cx) < ww / 2;
      const pointed = y > top + 12 || (Math.abs(x + .5 - cx) < (y - top) * .95);
      if (!(inArch && pointed)) continue;
      const v = (y - top) / (bot - top);
      let c = bayer(x, y) < v * 1.4 ? C.dslate : C.night; if (v > .75 && bayer(x, y) < (v - .75) * 3) c = C.slate;
      if (hash(x + off, y, 5) < .012) c = C.silver;
      if (x === x0 || x === x0 + ww - 1 || (!pointed)) c = C.ink;
      fb.px(x, y, c);
    }
    // 窗棂 + 窗台
    fb.vline(Math.round(cx), top + 4, bot - 1, C.ink); fb.hline(x0, x0 + ww - 1, 60, C.ink);
    fb.rect(x0 - 3, bot, ww + 6, 3, C.slate); fb.hline(x0 - 3, x0 + ww + 2, bot, C.steel); fb.hline(x0 - 3, x0 + ww + 2, bot + 3, C.ink);
    // 月亮（只在一扇窗里）
    if (k === 2) { const mx = x0 + 18, my = top + 22; fb.disc(mx, my, 5, C.silver); fb.disc(mx + 2, my - 1, 4, C.night); for (let yy = my - 5; yy < my + 6; yy++) for (let xx = mx - 5; xx < mx + 6; xx++) { const i = yy * W + xx; if (xx >= 0 && xx < W && fb.d[i] === C.silver && Math.hypot(xx - mx, yy - my) > 4.2) fb.d[i] = C.white; } }
  }
}
// 月光斜束（窗 → 地面），在墙、柱之后叠加提亮
function moonShafts(fb, cam) {
  const off = Math.round(cam * .35);
  for (let k = Math.floor(off / 96) - 1; k <= Math.floor((off + W) / 96) + 1; k++) {
    const wx0 = k * 96 + 30; if (wx0 + 30 > CORR.doorFar) continue;
    const x0 = wx0 - off;
    for (let y = 62; y < FLOOR + 30; y++) {
      const sx = x0 + 4 + Math.round((y - 62) * .62), w = 18;
      for (let x = 0; x < w; x++) {
        const X = sx + x; if (X < 0 || X >= W || y >= H) continue;
        const edge = x < 2 || x > w - 3, fade = y > FLOOR ? 1 - (y - FLOOR) / 30 : 1;
        const on = edge ? ((X + y) % 4 === 0) : ((X + y) % 2 === 0);
        if (on && hash(X, y, 9) < fade) { const i = y * W + X; fb.d[i] = LIGHT[fb.d[i]]; }
      }
    }
  }
}
function colonnade(fb, cam, t, torchLit = 1) {
  const off = Math.round(cam * .7);
  for (let k = Math.floor(off / 72) - 1; k <= Math.floor((off + W) / 72) + 1; k++) {
    const wx = k * 72; if (wx > 420) continue;
    const x0 = wx - off, pw = 16;
    for (let y = 8; y < FLOOR; y++) for (let x = 0; x < pw; x++) {
      const u = x / (pw - 1); let c = u < .1 ? C.steel : u < .22 ? C.slate : u > .82 ? C.night : C.dslate;
      if (Math.abs(u - .45) < .04 || Math.abs(u - .65) < .04) c = C.night;
      fb.px(x0 + x, y, c);
    }
    for (const yy of [8, FLOOR - 7]) { fb.rect(x0 - 2, yy, pw + 4, 6, C.slate); fb.hline(x0 - 2, x0 + pw + 1, yy, C.steel); fb.hline(x0 - 2, x0 + pw + 1, yy + 5, C.ink); }
    // 拱（柱间上方）
    for (let x = x0 + pw; x < x0 + 72; x++) { const u = (x - x0 - pw) / (72 - pw), h = Math.round(18 * Math.sin(u * Math.PI)); for (let y = 0; y < 26 - h; y++) fb.px(x, y, y === 25 - h ? C.slate : y === 26 - h - 2 ? C.night : C.ink); }
    // 横幅（隔一个柱间一面）
    if (((k % 2) + 2) % 2 === 0) {
      const bx = x0 + pw + 20, sway = Math.round(Math.sin(t * 1.3 + k) * .6);
      for (let y = 22; y < 70; y++) for (let x = 0; x < 16; x++) {
        const tail = y > 62 && Math.abs(x - 7.5) < (y - 62) * 1.1; if (tail) continue;
        const X = bx + x + (y > 40 ? sway : 0);
        let c = x === 0 || x === 15 ? C.umber : x < 3 ? C.crimson : x > 12 ? C.umber : C.crimson;
        if (x > 2 && x < 13 && (y === 26 || y === 58)) c = C.amber;
        fb.px(X, y, c);
      }
      // 徽记：一颗水晶
      const ex = bx + 8 + sway, ey = 42;
      for (let d = 0; d < 6; d++) { fb.hline(ex - Math.floor(d / 2), ex + Math.floor(d / 2) - 1 + 1, ey - 5 + d, C.amber); fb.hline(ex - Math.floor(d / 2), ex + Math.floor(d / 2), ey + 5 - d, C.amber); }
      fb.hline(bx - 1, bx + 16, 21, C.dbrown); fb.px(bx - 2, 21, C.amber); fb.px(bx + 17, 21, C.amber);
    }
    // 火把（每根柱子）
    torch(fb, x0 + pw / 2, 64, t + k, torchLit);
  }
}
function colonnadeGlow(fb, cam, t, torchLit = 1) {
  const off = Math.round(cam * .7);
  for (let k = Math.floor(off / 72) - 1; k <= Math.floor((off + W) / 72) + 1; k++) { const wx = k * 72; if (wx > 420) continue; torchGlow(fb, wx - off + 8, 64, t + k, torchLit); }
}
function floor(fb, cam) {
  const off = Math.round(cam);
  for (let y = FLOOR; y < H; y++) {
    const dz = (y - FLOOR) / (H - FLOOR);
    for (let x = 0; x < W; x++) {
      const wx = x + off, band = Math.floor(Math.sqrt((y - FLOOR) * 3.2)), lb = Math.sqrt((y - FLOOR) * 3.2) % 1;
      const sp = 24 * (1 + dz * 1.6), jx = ((wx - (off + W / 2)) * (1 / (1 + dz * 1.6)) + off + W / 2);
      const joint = lb < .12 || ((jx % 24) + 24) % 24 < 1.1;
      let c = joint ? C.ink : (band % 2 ? C.night : C.dslate);
      if (!joint && hash(Math.floor(jx / 24), band, 3) < .2) c = C.night;
      if (y === FLOOR) c = C.slate; else if (y === FLOOR + 1) c = C.ink;
      fb.d[y * W + x] = c;
    }
  }
}
function fgPillars(fb, cam) {
  const off = Math.round(cam * 1.6);
  for (const wx of [150, 470]) {
    const x0 = wx - off; if (x0 > W || x0 < -30) continue;
    for (let y = 0; y < H; y++) for (let x = 0; x < 24; x++) { const c = x === 23 ? C.night : C.ink; fb.px(x0 + x, y, c); }
  }
}
// 水晶厅：门（远景层）+ 石台 + 水晶
function chamberBack(fb, cam, t) {
  const off = Math.round(cam * .35), dx = CORR.doorFar - off;
  if (dx < W) door(fb, dx, -150, 196, FLOOR + 150, 0, t, 1);
}
export function corridor(fb, t, cam, hero) {
  farWall(fb, cam, t);
  chamberBack(fb, cam, t);
  moonShafts(fb, cam);
  colonnade(fb, cam, t, 1);
  colonnadeGlow(fb, cam, t, 1);
  floor(fb, cam);
  // 水晶
  const cx = CORR.crystalX - Math.round(cam), cyc = FLOOR - 26 + Math.round(Math.sin(t * 2) * 1.2);
  if (cx > -30 && cx < W + 30) {
    pedestal(fb, cx, FLOOR + 1);
    halo(fb, cx, cyc, 20 + Math.round(hero.flare || 0), .9 + (hero.flare || 0) * .05);
    const xs = crystal(Math.floor(t * 8)); fb.blit(xs, cx - (xs.w >> 1), cyc - (xs.h >> 1));
    glow(fb, cx, FLOOR + 2, 16, .6, .3);
  }
  // 主角
  if (hero) {
    const hx = Math.round(hero.x - cam), spr = drawChar('arlo', hero.pose, { t });
    shadowBlob(fb, hx, FLOOR, 7);
    scarfTail(fb, hx - 2, FLOOR - 25 + (hero.pose === 'walk1' || hero.pose === 'walk3' ? -1 : 0), t, hero.wind ?? .55, 1, 16);
    fb.blit(spr, hx - spr.ox, FLOOR - spr.oy);
  }
  fgPillars(fb, cam);
}
export function shadowBlob(fb, cx, y, r) { for (let x = -r; x <= r; x++) { const i = y * W + cx + x; if (cx + x < 0 || cx + x >= W) continue; fb.d[i] = DARK[fb.d[i]]; if (Math.abs(x) < r - 2) fb.d[i + W] = DARK[fb.d[i + W]]; } }

// ————————————————————— 最终之门（正面，仰摇）—————————————————————
// 世界 y：门底 = 132（地面）；门高 440；camY < 0 表示镜头上移
export const DOOR = { floor: 134, w: 200, h: 452 };
export function doorScene(fb, t, camY, o) {
  const top = DOOR.floor - DOOR.h, cy = Math.round(camY);
  const litT = o.torch || 0;                         // 0..1 火把依次点燃
  // 墙
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wy = y + cy, row = Math.floor((wy + 900) / 9), o2 = row % 2 ? 7 : 0, ly = ((wy + 900) % 9);
    const mort = ly === 8 || (x + o2) % 14 === 0;
    let c = mort ? C.ink : ly === 0 ? C.dslate : C.night;
    if (!mort && hash(Math.floor((x + o2) / 14), row, 13) < .12) c = C.dslate;
    fb.d[y * W + x] = c;
  }
  // 两侧高处的横幅
  for (const bx of [22, 282]) for (let k = 0; k < 3; k++) {
    const by = DOOR.floor - 120 - k * 110 - cy; if (by > H || by < -80) continue;
    for (let y = 0; y < 60; y++) for (let x = 0; x < 16; x++) { if (y > 52 && Math.abs(x - 7.5) < (y - 52) * 1.1) continue; fb.px(bx + x, by + y, x === 0 || x === 15 ? C.umber : x < 3 ? C.crimson : x > 12 ? C.umber : C.crimson); if (x > 2 && x < 13 && (y === 4 || y === 48)) fb.px(bx + x, by + y, C.amber); }
  }
  // 门上方的圆形玫瑰窗（仰摇到顶才看得到）
  { const rx = 160, ry = top - 34 - cy, R = 26;
    if (ry > -R - 4 && ry < H + R) for (let y = -R - 3; y <= R + 3; y++) for (let x = -R - 3; x <= R + 3; x++) {
      const d = Math.hypot(x, y); if (d > R + 3) continue; const X = rx + x, Y = ry + y;
      if (d > R) { fb.px(X, Y, d > R + 2 ? C.ink : C.steel); continue; }
      const a = Math.atan2(y, x), seg = Math.floor((a + Math.PI) / (Math.PI / 6)), spoke = Math.abs(((a + Math.PI) / (Math.PI / 6)) % 1 - .5) > .42;
      let c = spoke || Math.abs(d - R * .55) < .8 ? C.ink : d < R * .55 ? (d < 5 ? C.amber : C.crimson) : [C.navy, C.plum, C.blue, C.crimson][seg % 4];
      if (!spoke && c !== C.ink && bayer(X, Y) < .15) c = LIGHT[c];
      fb.px(X, Y, c);
    } }
  // 门
  door(fb, 60, top - cy, DOOR.w, DOOR.h, o.open || 0, t, o.runes ?? 1);
  // 火把（左右各 3 支，自下而上依次点燃）
  const torches = [[40, 70], [280, 70], [40, 190], [280, 190], [40, 310], [280, 310]];
  torches.forEach(([x, h], i) => { const y = DOOR.floor - h - cy; const lit = clamp(litT * 6 - i * .8, 0, 1); if (y > -20 && y < H + 20) torch(fb, x, y, t + i, lit); });
  torches.forEach(([x, h], i) => { const y = DOOR.floor - h - cy; const lit = clamp(litT * 6 - i * .8, 0, 1); if (y > -40 && y < H + 40) torchGlow(fb, x, y, t + i, lit); });
  // 门缝的光洒在地面
  const fy = DOOR.floor - cy;
  for (let y = fy; y < H; y++) for (let x = 0; x < W; x++) {
    const d = y - fy; let c = d === 0 ? C.slate : d === 1 ? C.ink : (Math.floor(Math.sqrt(d * 4)) % 2 ? C.night : C.dslate);
    fb.px(x, y, c);
    const gw = (o.open || 0) * 90;
    if (gw > 0) { const f = 1 - Math.abs(x - 160) / (gw + d * 1.8); if (f > 0 && bayer(x, y) < f * .9) { const i = y * W + x; fb.d[i] = LIGHT[LIGHT[fb.d[i]]]; } }
  }
  // 主角（背面）
  if (o.hero) {
    const hx = o.hero.x, hy = o.hero.y - cy, spr = drawChar('arlo', o.hero.pose, { t });
    shadowBlob(fb, hx, hy, 7);
    fb.blit(spr, hx - spr.ox, hy - spr.oy);
    const neckY = hy - 22 - (o.hero.pose === 'backlook' ? 1 : 0) + (o.hero.pose === 'backpush' ? 1 : 0);
    scarfTailBack(fb, hx, neckY, t, o.hero.wind ?? .4, 14);
    if (o.hero.sil) { for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) { if (spr.d[y * spr.w + x] === T) continue; const X = hx - spr.ox + x, Y = hy - spr.oy + y; if (bayer(X, Y) < o.hero.sil) fb.px(X, Y, o.hero.sil > .7 ? C.white : C.ink); } }
  }
}
