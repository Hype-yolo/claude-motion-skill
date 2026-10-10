// sheet.js — 角色设定表 / 精灵图（480×270 原生，×4 = 1920×1080）
// ?sheet=1                整张设定表
// ?sheet=1&zoom=a:b,...    开发用放大（arlo:idle / pa:neutral / pw:smile / pw8:x）
import { FB, C, T, LUT, RGB, NES, GB4, FADED_RAMP, bayer, hash } from './px.js';
import { drawChar, scarfTail } from './sprites.js';
import { text, textW } from './font.js';
import { portraitArlo, portraitWren, portraitWren8 } from './portraits.js';
import { crystal, halo, pedestal, door } from './props.js';
import { kidArlo, kidWren, kidWrenPoint } from './memsprites.js';
import { GBI } from './px.js';

const SW = 480, SH = 270, S = 4;
const fb = new FB(SW, SH);
const cv = document.getElementById('c'), o = cv.getContext('2d'); o.imageSmoothingEnabled = false;
const lo = document.createElement('canvas'); lo.width = SW; lo.height = SH; const g = lo.getContext('2d');
const img = g.createImageData(SW, SH), u32 = new Uint32Array(img.data.buffer);
const pack = (h) => { const r = parseInt(h.slice(1, 3), 16), gg = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return (255 << 24) | (b << 16) | (gg << 8) | r; };

const Z = new URLSearchParams(location.search).get('zoom');
function zoomView() {
  o.fillStyle = '#3a4466'; o.fillRect(0, 0, 1920, 1080);
  Z.split(',').forEach((k, i) => {
    const [ch, p] = k.split(':');
    const spr = ch === 'pa' ? portraitArlo(p) : ch === 'pw' ? portraitWren(p) : ch === 'pw8' ? portraitWren8() : ch === 'x' ? crystal(+p) : drawChar(ch, p);
    const f = new FB(spr.w, spr.h); f.clear(C.dslate); f.blit(spr, 0, 0);
    const c = document.createElement('canvas'); c.width = spr.w; c.height = spr.h; const gg = c.getContext('2d'); const im = gg.createImageData(spr.w, spr.h); const u = new Uint32Array(im.data.buffer);
    for (let j = 0; j < f.d.length; j++) u[j] = LUT.full[f.d[j]]; gg.putImageData(im, 0, 0);
    o.drawImage(c, (i % 4) * 480, Math.floor(i / 4) * 500, spr.w * 10, spr.h * 10);
  });
}

const put = (spr, x, y, flip = false) => fb.blit(spr, flip ? x - (spr.w - spr.ox) : x - spr.ox, y - spr.oy, flip);
const label = (s, x, y, col = C.steel) => text(fb, s, Math.round(x - textW(s) / 2), y, col);

// 小场景（色深演示用）：黄昏原野 + 两人 + 水晶
function miniScene(f, x0, y0, w, h, t) {
  f.clip = [x0, y0, x0 + w, y0 + h];
  for (let y = 0; y < h; y++) {
    const cols = [C.night, C.dslate, C.plum, C.rose, C.pink, C.orange, C.amber];
    const v = y / (h * .62) * (cols.length - 1), b = Math.min(cols.length - 2, Math.floor(v)), fr = v - b;
    for (let x = 0; x < w; x++) f.px(x0 + x, y0 + y, v >= cols.length - 1 ? cols[cols.length - 1] : cols[bayer(x0 + x, y0 + y) < fr ? b + 1 : b]);
  }
  f.disc(x0 + 62, y0 + 27, 7, C.yellow); f.disc(x0 + 62, y0 + 27, 5, C.white);
  for (let x = 0; x < w; x++) { const hh = Math.round(y0 + 26 + 4 * Math.sin((x0 + x) * .09) + 2 * Math.sin((x0 + x) * .23)); for (let y = hh; y < y0 + h; y++) f.px(x0 + x, y, y < hh + 1 ? C.rose : C.plum); }
  for (let x = 0; x < w; x++) { const hh = Math.round(y0 + 32 + 2 * Math.sin((x0 + x) * .13 + 2)); for (let y = hh; y < y0 + h; y++) f.px(x0 + x, y, y < hh + 1 ? C.lime : bayer(x0 + x, y) < (y - hh) / 14 ? C.dgreen : C.green); }
  for (let x = 0; x < w; x++) if (hash(x0 + x, 5) < .3) f.px(x0 + x, y0 + 33 + Math.round(hash(x, 9) * 8), C.lime);
  const wr = drawChar('wren', 'idle'), ar = drawChar('arlo', 'idle');
  scarfTail(f, x0 + 24 - 3, y0 + h - 3 - 23, t, .6, 1, 10);
  f.blit(wr, x0 + 24 - wr.ox, y0 + h - 3 - wr.oy);
  f.blit(ar, x0 + 44 - ar.ox, y0 + h - 3 - ar.oy);
  const xs = crystal(2); halo(f, x0 + 70, y0 + h - 16, 9, .9); f.blit(xs, x0 + 70 - (xs.w >> 1), y0 + h - 16 - (xs.h >> 1));
  f.clip = [0, 0, f.w, f.h];
}

// 4 色原生场景：半分辨率画完再 ×2 贴进设定表
function gbScene(x0, y0, w, h) {
  const hw = w >> 1, hh = h >> 1, f = new FB(hw, hh), [K, D, Lg, Wt] = GBI;
  f.clear(Wt);
  for (let y = 0; y < 6; y++) for (let x = 0; x < hw; x++) if (bayer(x, y) < (6 - y) / 12) f.px(x, y, Lg);
  f.disc(33, 9, 3, Wt); for (let a = 0; a < 6.3; a += .3) f.px(Math.round(33 + Math.cos(a) * 4), Math.round(9 + Math.sin(a) * 4), Lg);
  for (let x = 0; x < hw; x++) { const t = Math.round(14 + 1.5 * Math.sin(x * .25)); for (let y = t; y < hh; y++) f.px(x, y, Lg); }
  for (let x = 0; x < hw; x++) { const t = 20; for (let y = t; y < hh; y++) f.px(x, y, y === t ? K : (bayer(x, y) < .25 ? K : D)); }
  for (let x = 1; x < 9; x += 2) { f.vline(x, 13, 19, K); f.px(x, 12, D); } f.hline(0, 9, 15, K); f.hline(0, 9, 18, K);
  const wr = kidWrenPoint(), ar = kidArlo(0);
  for (let i = 1; i < 8; i++) f.px(14 - i, 14 + Math.round(Math.sin(i * .9) * .7 + i * .2), i % 3 ? D : K);
  f.blit(wr, 13, 7); f.blit(ar, 24, 7);
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) fb.rect(x0 + x * 2, y0 + y * 2, 2, 2, f.d[y * hw + x]);
}
window.render = () => {
  if (Z) return zoomView();
  fb.clear(C.night);
  // 底纹：细网格
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if ((x % 8 === 0 || y % 8 === 0) && bayer(x, y) < .5) fb.px(x, y, C.ink);
  // 标题
  fb.rect(0, 0, SW, 13, C.ink);
  text(fb, 'THE LAST SAVE POINT', 6, 3, C.white, C.navy);
  text(fb, 'model sheet v1 · sprites 8-12 fps · 320x180 native', 122, 3, C.steel);
  text(fb, '16-BIT PIXEL RPG', SW - textW('16-BIT PIXEL RPG') - 6, 3, C.amber);

  // —— ARLO ——
  text(fb, 'ARLO', 6, 17, C.white, C.navy); text(fb, 'hero · 22x34 · wears her scarf now', 34, 17, C.steel);
  const A = [['front', 16], ['idle', 40], ['back', 64], ['walk0', 96], ['walk1', 120], ['walk2', 144], ['walk3', 168],
    ['breathe', 198], ['ready', 224], ['attack', 254], ['hurt', 286], ['lookup', 310], ['backlook', 336], ['backpush', 360]];
  const byA = 64;
  for (const [p, x] of A) {
    const back = p.startsWith('back') || p === 'back';
    if (!back && p !== 'front') scarfTail(fb, x - 2, byA - 25 + (p === 'hurt' ? 1 : 0), p.length * 1.3, p.startsWith('walk') ? .75 : .45, 1, 9);
    put(drawChar('arlo', p), x, byA);
  }
  const lab = { front: 'front', idle: 'side', back: 'back', walk0: '1', walk1: '2', walk2: '3', walk3: '4', breathe: 'breath', ready: 'ready', attack: 'attack', hurt: 'hurt', lookup: 'look up', backlook: 'look up', backpush: 'push' };
  A.forEach(([p, x], i) => label(lab[p], x + (p === 'attack' ? 4 : 0), byA + 3 + (i >= 7 && i % 2 ? 8 : 0), C.steel));
  fb.hline(88, 176, byA + 12, C.slate); label('walk cycle 8 fps', 132, byA + 14, C.slate);
  

  // —— WREN ——
  const byW = 128;
  text(fb, 'WREN', 6, 86, C.white, C.navy);
  const Wp = [['front', 16], ['idle', 40], ['back', 64], ['walk0', 96], ['walk1', 120], ['walk2', 144], ['walk3', 168], ['cast', 200], ['kneel', 232]];
  for (const [p, x] of Wp) {
    if (p !== 'front' && p !== 'back') scarfTail(fb, x - 3, byW - (p === 'kneel' ? 19 : 24), p.length, p.startsWith('walk') ? .8 : .5, 1, 12);
    put(drawChar('wren', p), x, byW);
  }
  const labW = { front: 'front', idle: 'side', back: 'back', walk0: '1', walk1: '2', walk2: '3', walk3: '4', cast: 'ward', kneel: 'falls' };
  for (const [p, x] of Wp) label(labW[p], x, byW + 3, p.startsWith('walk') ? C.slate : C.steel);

  // —— 存档水晶 8 帧 ——
  text(fb, 'SAVE CRYSTAL', 262, 88, C.white, C.navy); text(fb, '8 frames / 90 deg', 262 + 76, 88, C.steel);
  for (let k = 0; k < 8; k++) { const xs = crystal(k); fb.blit(xs, 262 + k * 13, byW - xs.h - 2); }
  label('flat-shaded 3D, quantized', 314, byW + 3, C.slate);

  // —— 头像 ——
  const py = 151;
  text(fb, 'PORTRAITS', 6, py - 3 - 8, C.white, C.navy); text(fb, 'dialog box · 32x32', 66, py - 11, C.steel);
  const P = [['neutral', portraitArlo('neutral')], ['wistful', portraitArlo('wistful')], ['smile', portraitArlo('smile')], ['sad', portraitArlo('sad')], ['resolve', portraitArlo('determined')], ['wren', portraitWren('smile')], ['wren 8-bit', portraitWren8()]];
  P.forEach(([n, s], i) => {
    const x = 8 + i * 38; fb.rect(x - 1, py - 1, 34, 34, C.ink); fb.gradV(x, py, 32, 32, [C.navy, C.navy, C.night]);
    if (n === 'wren 8-bit') { fb.rect(x, py, 32, 32, C.ink); fb.blit(s, x + 4, py + 6); } else fb.blit(s, x, py);
    label(n, x + 16, py + 35, i < 5 ? C.steel : C.rose);
  });
  // 石台 + 水晶 + 光晕
  pedestal(fb, 300, py + 34); halo(fb, 300, py + 8, 16, 1); { const xs = crystal(3); fb.blit(xs, 300 - (xs.w >> 1), py + 8 - (xs.h >> 1)); }
  label('save point', 300, py + 36, C.cyan);
  // 菜单光标样例
  fb.rect(326, py + 2, 40, 24, C.ink); fb.gradV(327, py + 3, 38, 22, [C.blue, C.navy, C.night]); fb.rect(326, py + 2, 40, 1, C.white);
  text(fb, 'SAVE', 340, py + 6, C.white, C.ink); text(fb, 'QUIT', 340, py + 16, C.steel, C.ink);
  text(fb, '▶', 331, py + 6, C.yellow);

  // —— 色深演示 ——
  const dy = 205, pw = 86, ph = 45;
  text(fb, 'COLOR DEPTH = MEMORY', 6, dy - 11, C.white, C.navy); text(fb, 'older = fewer colors · now: only her scarf + the crystal', 126, dy - 11, C.steel);
  const names = [['16-bit · recent', 'full'], ['8-bit · older', 'nes'], ['4-color · oldest', 'gb4'], ['now · faded', 'faded']];
  names.forEach(([n, l], i) => { const x = 6 + i * (pw + 4); fb.rect(x - 1, dy - 1, pw + 2, ph + 2, C.ink); if (l === 'gb4') gbScene(x, dy, pw, ph); else miniScene(fb, x, dy, pw, ph, 1.2); label(n, x + pw / 2, dy + ph + 8, C.steel); });
  // 最终之门
  text(fb, 'THE LAST DOOR', 376, 17, C.white, C.navy);
  door(fb, 374, 28, 102, 226, 0, 1.0);
  label('3 screens tall in film', 425, 258, C.slate);

  // —— 输出：每个演示面板用自己的查找表；4 色面板还要降一半分辨率 ——
  for (let i = 0; i < fb.d.length; i++) u32[i] = LUT.full[fb.d[i]];
  names.forEach(([, l], i) => {
    const x0 = 6 + i * (pw + 4), L = LUT[l];
    for (let y = dy; y < dy + ph; y++) for (let x = x0; x < x0 + pw; x++) {
      const sx = x, sy = y;
      u32[y * SW + x] = L[fb.d[sy * SW + sx]];
    }
    // 调色板色块
    const pal = l === 'full' ? RGB.map(c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')) : l === 'nes' ? NES : l === 'gb4' ? GB4 : [...FADED_RAMP, '#e43b44', '#2ce8f5'];
    const sw = Math.floor(pw / pal.length);
    pal.forEach((h, k) => { for (let y = dy + ph + 2; y < dy + ph + 6; y++) for (let x = x0 + k * sw; x < x0 + (k + 1) * sw; x++) u32[y * SW + x] = pack(h); });
  });
  g.putImageData(img, 0, 0); o.drawImage(lo, 0, 0, SW * S, SH * S);
};
window.DUR = 1; window.READY = true;
