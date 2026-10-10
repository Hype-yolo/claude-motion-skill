// ui.js — RPG 界面：对话框（三种色深皮肤）、战报窗、菜单 + 手形光标、存档位列表、状态栏、存档进度、SAVE COMPLETE
import { W, H, C, T, GBI, bayer, sprFromRows } from './px.js';
import { text, textW, wrap, LINE_H } from './font.js';

// 窗口：皮肤 snes = 蓝渐变 + 白/银边；nes = 黑底白框；gb = 浅底深框（传入 4 色索引）
export function win(fb, x, y, w, h, skin = 'snes') {
  if (skin === 'gb') {
    const [K, D, Lg, Wt] = GBI;
    fb.rect(x + 1, y, w - 2, h, K); fb.rect(x, y + 1, w, h - 2, K);
    fb.rect(x + 1, y + 1, w - 2, h - 2, D); fb.rect(x + 2, y + 2, w - 4, h - 4, Wt); return;
  }
  if (skin === 'nes') {
    fb.rect(x + 1, y, w - 2, h, C.ink); fb.rect(x, y + 1, w, h - 2, C.ink);
    fb.rect(x + 2, y + 2, w - 4, h - 4, C.white); fb.rect(x + 4, y + 4, w - 8, h - 8, C.ink); fb.px(x + 2, y + 2, C.ink); fb.px(x + w - 3, y + 2, C.ink); fb.px(x + 2, y + h - 3, C.ink); fb.px(x + w - 3, y + h - 3, C.ink); return;
  }
  fb.rect(x + 2, y, w - 4, h, C.ink); fb.rect(x, y + 2, w, h - 4, C.ink); fb.rect(x + 1, y + 1, w - 2, h - 2, C.ink);
  fb.rect(x + 2, y + 1, w - 4, h - 2, C.white); fb.rect(x + 1, y + 2, w - 2, h - 4, C.white);
  fb.rect(x + 2, y + 2, w - 4, h - 4, C.silver);
  fb.gradV(x + 3, y + 3, w - 6, h - 6, [C.blue, C.navy, C.navy, C.night]);
  fb.hline(x + 3, x + w - 4, y + 3, C.blue);
}

// —— 对话框（字幕）——
// o: { skin, portrait(spr|null), text, t (秒，从开打起), cps, big: gb 时在 160 分辨率上 }
export function dialog(fb, o) {
  const skin = o.skin || 'snes', gb = skin === 'gb';
  const X = gb ? 3 : 8, Y = gb ? 62 : 134, Wd = gb ? 154 : 304, Hd = gb ? 26 : 42;
  win(fb, X, Y, Wd, Hd, skin);
  let tx = X + (gb ? 6 : 10);
  if (o.portrait) {
    const p = o.portrait, px = X + 5, py = Y + Math.round((Hd - p.h) / 2);
    if (skin === 'snes') { fb.rect(px - 1, py - 1, p.w + 2, p.h + 2, C.ink); fb.gradV(px, py, p.w, p.h, [C.navy, C.night]); }
    fb.blit(p, px, py); tx = px + p.w + 7;
  }
  const n = Math.max(0, Math.floor(o.t * (o.cps || 38)));
  const lines = wrap(o.text, X + Wd - tx - 8);
  const col = gb ? GBI[0] : C.white, sh = gb ? null : (skin === 'nes' ? null : C.night);
  let used = 0;
  lines.forEach((ln, i) => { const vis = ln.slice(0, Math.max(0, n - used)); used += ln.length + 1; text(fb, vis, tx, Y + (gb ? 5 : 9) + i * (gb ? 9 : 12), col, sh); });
  const total = o.text.length;
  if (n >= total && Math.floor(o.t * 3) % 2 === 0) text(fb, '▼', X + Wd - (gb ? 10 : 14), Y + Hd - (gb ? 10 : 12), gb ? GBI[1] : C.white);
  return { n: Math.min(n, total), total };
}
// 顶部战报窗
export function battleMsg(fb, s, t) {
  const w = Math.max(120, textW(s) + 24), x = Math.round((W - w) / 2);
  win(fb, x, 4, w, 17);
  const n = Math.floor(t * 45); text(fb, s.slice(0, n), x + Math.round((w - textW(s)) / 2), 9, C.white, C.night);
}

// —— 手形光标 ——
const HAND = sprFromRows([
  '.kk......',
  'kwwk.....',
  'kwwwkkkk.',
  'kwwwwwwwk',
  'kwwwwkkk.',
  'kwwwwk...',
  '.kkkk....',
], { k: C.ink, w: C.white });
export function hand(fb, x, y, t, bob = true) { fb.blit(HAND, x + (bob && Math.floor(t * 4) % 2 ? 1 : 0), y); }

// SAVE / QUIT 小菜单
export function saveMenu(fb, x, y, t, pressed = false) {
  win(fb, x, y, 56, 34);
  text(fb, 'SAVE', x + 20, y + 8, pressed ? C.yellow : C.white, C.night);
  text(fb, 'QUIT', x + 20, y + 20, C.steel, C.night);
  hand(fb, x + 7, y + 8, t, !pressed);
}

// —— 迷你头像 7×7（存档位里的队伍）——
const HEADA = sprFromRows(['..kkk..', '.khhhk.', 'khhhhhk', 'khfffhk', 'kfefefk', '.kfffk.', '..kkk..'], { k: C.ink, h: C.dbrown, f: C.skin, e: C.ink });
const HEADW = sprFromRows(['..kkk..', '.khhhk.', 'khhhhhk', 'khfffhk', 'hfefefh', 'hkfffkh', 'h.kkk.h'], { k: C.ink, h: C.rust, f: C.skin, e: C.ink });
export const miniHeads = { arlo: HEADA, wren: HEADW };

// —— 存档位列表 ——
// files: [{label, place, time, thumb(fb,x,y)}]；cursor 行号（可为小数 = 移动中），newFile 行在最后
// 返回缩略图区域 [{x,y,w,h,lut}] 供按区域换查找表（回忆保有自己的颜色）
export const LIST = { x: 4, y: 6, w: 176, rowH: 27, thumbW: 40, thumbH: 22 };
export function fileList(fb, files, cursor, t, o = {}) {
  const { x, y, w, rowH } = LIST, h = 16 + rowH * (files.length + 1) + 2;
  win(fb, x, y, w, h);
  text(fb, 'SELECT A FILE', x + 10, y + 6, C.yellow, C.night);
  const regions = [];
  files.forEach((f, i) => {
    const ry = y + 17 + i * rowH, tx = x + 20;
    fb.rect(tx - 1, ry - 1, LIST.thumbW + 2, LIST.thumbH + 2, C.ink);
    f.thumb(fb, tx, ry);
    regions.push({ x: tx, y: ry, w: LIST.thumbW, h: LIST.thumbH, lut: f.lut });
    const sel = Math.round(cursor) === i;
    text(fb, f.label, tx + 46, ry + 2, sel ? C.yellow : C.silver, C.night);
    text(fb, f.place, tx + 46 + textW(f.label) + 6, ry + 2, sel ? C.white : C.steel, C.night);
    text(fb, f.time, tx + 46, ry + 13, C.steel, C.night);
    // 队伍小头像（在回忆颜色区域里）
    const hx = tx + 46 + textW(f.time) + 8;
    fb.blit(HEADA, hx, ry + 13); fb.blit(HEADW, hx + 9, ry + 13);
    regions.push({ x: hx, y: ry + 13, w: 16, h: 7, lut: f.lut });
  });
  const ny = y + 17 + files.length * rowH, tx = x + 20;
  for (let i = 0; i < LIST.thumbW + 2; i += 2) { fb.px(tx - 1 + i, ny - 1, C.steel); fb.px(tx - 1 + i, ny + LIST.thumbH, C.steel); }
  for (let j = 0; j < LIST.thumbH + 2; j += 2) { fb.px(tx - 1, ny - 1 + j, C.steel); fb.px(tx + LIST.thumbW, ny - 1 + j, C.steel); }
  if (o.newThumb) { o.newThumb(fb, tx, ny); regions.push({ x: tx, y: ny, w: LIST.thumbW, h: LIST.thumbH, lut: o.newLut }); }
  const selN = Math.round(cursor) === files.length;
  text(fb, o.newLabel || 'NEW FILE', tx + 46, ny + 7, selN ? C.yellow : C.silver, C.night);
  // 光标（行间移动时按整数像素插值）
  const cy = Math.round(y + 17 + cursor * rowH + 7);
  hand(fb, x + 5, cy, t, o.bob ?? true);
  return regions;
}

// —— 状态栏（门前）——
export function statusWin(fb, x, y) {
  win(fb, x, y, 150, 38);
  text(fb, 'ARLO', x + 8, y + 7, C.white, C.night); text(fb, 'LV 42', x + 38, y + 7, C.steel, C.night);
  bar(fb, x + 72, y + 7, 'HP', 212 / 350, C.lime, C.green); bar(fb, x + 72, y + 15, 'MP', 40 / 96, C.cyan, C.blue);
  text(fb, 'WREN', x + 8, y + 25, C.slate, null); text(fb, 'LV 38', x + 38, y + 25, C.slate, null); text(fb, '---', x + 90, y + 25, C.slate, null);
}
function bar(fb, x, y, lab, f, c1, c2) {
  text(fb, lab, x, y, C.silver, C.night);
  const bx = x + 14, bw = 56; fb.rect(bx - 1, y, bw + 2, 6, C.ink); fb.rect(bx, y + 1, bw, 4, C.night);
  const fw = Math.round(bw * f); fb.rect(bx, y + 1, fw, 2, c1); fb.rect(bx, y + 3, fw, 2, c2);
}
// 存档进度 / 完成
export function savingWin(fb, f, t) {
  const x = 184, y = 70, w = 128, h = 30;
  win(fb, x, y, w, h);
  text(fb, 'SAVING' + '...'.slice(0, 1 + Math.floor(t * 4) % 3), x + 10, y + 7, C.white, C.night);
  fb.rect(x + 10, y + 18, w - 20, 5, C.ink); fb.rect(x + 11, y + 19, Math.round((w - 22) * f), 3, C.cyan);
}
export function saveCompleteWin(fb, t) {
  const x = 184, y = 70, w = 128, h = 30;
  win(fb, x, y, w, h);
  const s = 'SAVE COMPLETE', tw = textW(s);
  text(fb, s, x + Math.round((w - tw) / 2), y + 12, Math.floor(t * 6) % 4 === 0 && t < .8 ? C.white : C.yellow, C.night);
  // 两颗闪光（像素星）
  for (const [sx, sy, ph] of [[x + 8, y + 8, 0], [x + w - 10, y + h - 9, .4]]) { const k = Math.floor((t + ph) * 6) % 3; if (k === 2) continue; fb.px(sx, sy, C.white); if (k === 0) { fb.px(sx - 1, sy, C.yellow); fb.px(sx + 1, sy, C.yellow); fb.px(sx, sy - 1, C.yellow); fb.px(sx, sy + 1, C.yellow); } }
}
