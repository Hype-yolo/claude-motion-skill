// Toward the Mountain · 山へ五景 — Ukiyo-e 风格 demo
import { clamp, lerp, seg, ss, eio, eo, ei, hash, mulberry, TAU } from '/core/lib.js';
import { W, H, FR, PAL, TX, mk, buildTextures, inkify, stampLayer, stampFn, drawSeal, cartouche, sealCanvas, rgba, poly, vtext } from './print.js';
import { VIEWS } from './views.js';
import { traveler } from './traveler.js';
import { waveGeo, fclaw } from './wave.js';
import { DUR, T, VO, SLOT, SW, GAP, REVEAL_DUR, q8 } from './story.js';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const QS = new URLSearchParams(location.search);
const NOSUB = QS.has('nosub');
const J = async f => { try { const r = await fetch(f); if (r.ok) return await r.json(); } catch (e) { } return null; };
const LINES = (await J('lines.json')) || [], DURS = (await J('voices/dur.json')) || {};
const LINE = Object.fromEntries(LINES.map(l => [l.id, l]));

await document.fonts.load('400 40px Yuji', '山へ五景旅一二三四田毎の朝雨橋茶屋窓海立つ');
await document.fonts.load('600 40px ShipporiK', '山へ五景'); await document.fonts.load('500 40px Shippori', 'Aa'); await document.fonts.load('700 40px Shippori', 'Aa');
buildTextures();

// —— 字幕（题签式）——
export const SUBS = Object.entries(VO).map(([id, t0]) => { const d = DURS[id] ?? (LINE[id]?.text.length || 30) * .065; return { id, t0, t1: t0 + Math.max(1.8, d + .75), text: LINE[id]?.sub || LINE[id]?.text || '' }; });
SUBS.forEach((s, i) => { if (SUBS[i + 1] && s.t1 > SUBS[i + 1].t0 - .1) s.t1 = SUBS[i + 1].t0 - .1; });

// —— 色版缓存 ——
const REG = [[0, 0], [2.2, -1.3], [-1.8, 1.9], [1.5, 2.2]];
const SHIFT = [[4, -5], [-6, 4], [5, 5], [-5, -4]];
const cache = new Map();
function layer(v, name) {
  const k = v.id + ':' + name; if (cache.has(k)) return cache.get(k);
  const d = v.layers[name], c = mk(), x = c.getContext('2d');
  d.draw(x); const hk = hash(k.length * 7.3 + k.charCodeAt(0)); inkify(c, { speck: d.speck ?? .3, grain: (d.grain || 0) * 1.7, gx: hk * 400 - 200, baren: d.baren ?? (d.g ? .38 : .12), bx: (hk - .5) * 300, by: (hash(hk) - .5) * 200 });
  cache.set(k, c); return c;
}
// 各版的吃墨进度
function revFor(i, g, t) {
  const list = i === 0 ? T.print1 : i === 4 ? T.print5 : null;
  if (!list) return 1;
  return clamp((t - list[g]) / REVEAL_DUR);
}

// —— 题签配置（每幅画的位置）——
const CART = [
  { x: 1800, y: 74, title: '一 田毎の朝', seal: [1800, 0, '旅'] },
  { x: 120, y: 74, title: '二 雨の橋', seal: [120, 0, '旅'] },
  { x: 1230, y: 150, title: '三 茶屋の窓', seal: [1230, 0, '旅'], so: [-82, -40] },
  { x: 120, y: 74, title: '四 海立つ', seal: [120, 0, '旅'] },
  { x: 1800, y: 74, title: '五 山', seal: [1800, 0, '山旅'] },
];
const CART_T = [T.cart.v1, T.cart.v2, T.cart.v3, null, T.cart.v5];

// —— 画一张纸（第 i 幅）——
function drawSheet(i, t, M) {
  const v = VIEWS[i];
  ctx.save(); ctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  // 纸
  if (i % 2) { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(TX.paper, 0, 0); ctx.restore(); } else ctx.drawImage(TX.paper, 0, 0);
  const blank = i === 4 && t < T.print5[0];
  let borderDone = false;
  const border = () => {
    if (borderDone) return; borderDone = true;
    const r = revFor(i, 0, t); if (r <= 0) return;
    stampFn(ctx, x => { x.strokeStyle = PAL.sumi; x.lineWidth = 3.4; x.strokeRect(FR.x0, FR.y0, FR.x1 - FR.x0, FR.y1 - FR.y0); x.lineWidth = 1.3; x.strokeRect(FR.x0 - 9, FR.y0 - 9, FR.x1 - FR.x0 + 18, FR.y1 - FR.y0 + 18); }, r, SHIFT[0]);
  };
  if (!blank) {
    ctx.save(); ctx.beginPath(); ctx.rect(FR.x0, FR.y0, FR.x1 - FR.x0, FR.y1 - FR.y0); ctx.clip();
    const R = {
      L: name => { const g = v.layers[name].g; stampLayer(ctx, layer(v, name), revFor(i, g, t), REG[g], SHIFT[g]); },
      D: (g, fn) => { const r = revFor(i, g, t); if (r >= 1) { ctx.save(); ctx.translate(REG[g][0], REG[g][1]); fn(ctx); ctx.restore(); } else stampFn(ctx, fn, r, SHIFT[g]); },
      free: fn => { ctx.restore(); ctx.restore(); fn(ctx); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); ctx.save(); ctx.beginPath(); ctx.rect(FR.x0, FR.y0, FR.x1 - FR.x0, FR.y1 - FR.y0); ctx.clip(); },
      border: () => { ctx.restore(); border(); ctx.save(); ctx.beginPath(); ctx.rect(FR.x0, FR.y0, FR.x1 - FR.x0, FR.y1 - FR.y0); ctx.clip(); },
    };
    v.paint(ctx, t, R);
    ctx.restore();
    border();
    // 题签 + 印章
    const ct = CART_T[i], C = CART[i];
    if (ct && t > ct[0] || (ct && QS.has('cart'))) {
      const p = QS.has('cart') ? 1 : clamp((t - ct[0]) / .35), sp = QS.has('cart') ? 1 : clamp((t - ct[1]) / .3);
      stampFn(ctx, x => { const b = cartouche(x, C.x, C.y, C.title); C._b = b; }, p, [0, -14]);
      if (C._b) drawSeal(ctx, C.seal[2], C.x + (C.so ? C.so[0] : 0), C._b.y0 + C._b.h + (C.so ? C.so[1] : 58), C.seal[2].length > 1 ? 74 : 62, sp, { seed: i + 3, rot: (hash(i) - .5) * .06 });
    }
    if (i === 0) titleCard(t);
  }
  ctx.globalAlpha = 1; ctx.drawImage(TX.fiber, 0, 0);
  ctx.restore(); ctx.restore();
}

// —— 片名（压在第一幅上的纸签，之后被揭起）——
function titleCard(t) {
  if (!QS.has('title') && (t < T.title[0] || t > T.title[1] + .6)) return;
  const a = QS.has('title') ? 1 : clamp((t - T.title[0]) / .3), out = QS.has('title') ? 0 : ss(seg(t, T.title[1], T.title[1] + .6));
  ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(0, -out * 30);
  stampFn(ctx, x => {
    const b = cartouche(x, 170, 100, '山へ五景', { series: '', w: 104, size: 70, fill: '#f3e7c6' });
    // 横题签
    const x0 = 250, y0 = 100, w = 720, h = 150;
    x.fillStyle = '#f3e7c6'; x.fillRect(x0, y0, w, h); x.fillStyle = PAL.beniL; x.fillRect(x0, y0 + h - 40, w, 40);
    x.strokeStyle = PAL.sumi; x.lineWidth = 3; x.strokeRect(x0, y0, w, h); x.lineWidth = 1.2; x.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
    x.lineWidth = 1.5; x.beginPath(); x.moveTo(x0 + 6, y0 + h - 40); x.lineTo(x0 + w - 6, y0 + h - 40); x.stroke();
    x.fillStyle = PAL.sumi; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 62px Shippori'; x.fillText('Toward the Mountain', x0 + w / 2, y0 + 58);
    x.font = '500 22px Shippori'; x.fillText('F I V E   V I E W S   O N   T H E   W A Y', x0 + w / 2, y0 + h - 20);
  }, a, [0, -12]);
  drawSeal(ctx, '山旅', 925, 300, 80, QS.has('title') ? 1 : clamp((t - T.title[0] - .45) / .3), { seed: 9, rot: .03 });
  ctx.restore();
}

// —— 镜头（世界坐标 = 手卷坐标）——
const C = i => [SLOT(i) + 960, 540];
const TOTAL = SLOT(0) + W;
const REP = [10.4, 16.3, 22.2, 28.1];   // 拉远时各幅画定格的代表时刻
function camera(t) {
  let cx, cy, z = 1, rot = 0;
  const pan = (a, b, t0, t1) => { const u = eio(seg(t, t0, t1)); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; };
  if (t < T.pan12[0]) [cx, cy] = C(0);
  else if (t < T.pan12[1]) [cx, cy] = pan(C(0), C(1), ...T.pan12);
  else if (t < T.pan23[0]) [cx, cy] = C(1);
  else if (t < T.pan23[1]) [cx, cy] = pan(C(1), C(2), ...T.pan23);
  else if (t < T.pan34[0]) { const u = ss(seg(t, T.v3[0], T.pan34[0])); [cx, cy] = C(2); cx -= 50 * u; cy -= 22 * u; z = 1 + .065 * u; }
  else if (t < T.pan34[1]) { const u = eio(seg(t, ...T.pan34)); const a = [C(2)[0] - 50, C(2)[1] - 22]; [cx, cy] = [lerp(a[0], C(3)[0], u), lerp(a[1], C(3)[1], u)]; z = lerp(1.065, 1, u); }
  else if (t < T.ma[0]) {
    [cx, cy] = C(3);
    const u = eio(seg(t, T.waveRise[0] + .2, T.hang[0] + .1)), h = ss(seg(t, T.hang[0], T.fall[0]));
    cy = lerp(540, 262, u) - 10 * h; z = lerp(1, .975, u) + .02 * h; rot = lerp(0, -.03, u) - .01 * h;
    const f = ei(seg(t, T.fall[0], T.crash[1]));
    if (f > 0) { const G = waveGeo(1, Math.pow(seg(t, T.fall[0], T.crash[1]), 1.5)); cx = lerp(cx, SLOT(3) + G.tip[0] - 40, f); cy = lerp(cy, G.tip[1] + 60, f); z = lerp(z, 3.0, f); rot = lerp(rot, -.09, f); }
  }
  else if (t < T.pull[0]) { [cx, cy] = C(4); const u = ss(seg(t, T.print5[3], T.pull[0])); z = 1 + .02 * u; }
  else {
    const u = eio(seg(t, ...T.pull)), zEnd = (W * .94) / (TOTAL + 420);
    z = Math.exp(lerp(Math.log(1.02), Math.log(zEnd), u));
    cx = lerp(C(4)[0], (TOTAL - 200) / 2, ss(seg(t, T.pull[0], T.pull[1] - .2))); cy = lerp(540, 470, u);
  }
  return { cx, cy, z, rot };
}
function camMatrix(cam) {
  const c = Math.cos(cam.rot) * cam.z, s = Math.sin(cam.rot) * cam.z;
  // screen = R*z*(world - center) + (W/2,H/2)
  return [c, s, -s, c, W / 2 - (c * cam.cx - s * cam.cy), H / 2 - (s * cam.cx + c * cam.cy)];
}

// —— 手卷裱纸与背景 ——
const BAND = [-430, 1510];
function drawScroll(M, t) {
  ctx.save(); ctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
  ctx.fillStyle = PAL.mount; ctx.fillRect(-60, BAND[0], TOTAL + 120, BAND[1] - BAND[0]);
  // 裱纸纹理：平铺和纸（压暗）
  ctx.globalAlpha = .55; ctx.globalCompositeOperation = 'multiply';
  for (let X = -60; X < TOTAL + 60; X += W) for (let Y = BAND[0]; Y < BAND[1]; Y += H) ctx.drawImage(TX.paper, X, Y);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // 上下的细边
  ctx.fillStyle = PAL.mountD; ctx.fillRect(-60, BAND[0], TOTAL + 120, 34); ctx.fillRect(-60, BAND[1] - 34, TOTAL + 120, 34);
  // 左端卷轴（未展开的部分卷在左边）
  const rx = -160, rw = 150;
  const g = ctx.createLinearGradient(rx, 0, rx + rw, 0); g.addColorStop(0, '#8f7a55'); g.addColorStop(.35, '#d8c69c'); g.addColorStop(1, '#8a744e');
  ctx.fillStyle = g; ctx.fillRect(rx, BAND[0] - 30, rw, BAND[1] - BAND[0] + 60);
  ctx.fillStyle = '#3a2a1c'; ctx.fillRect(rx + 30, BAND[0] - 120, rw - 60, 90); ctx.fillRect(rx + 30, BAND[1] + 30, rw - 60, 90);
  ctx.restore();
}

// —— 字幕（屏幕空间，横式题签）——
function subtitle(t) {
  const s = SUBS.find(s => t >= s.t0 - .05 && t < s.t1); if (!s) return;
  const a = clamp((t - s.t0 + .05) / .22), fo = 1 - clamp((t - (s.t1 - .25)) / .25);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '500 42px Shippori'; const tw = ctx.measureText(s.text).width, w = tw + 150, h = 74, x0 = (W - w) / 2, y0 = H - 72 - h;
  ctx.globalAlpha = fo;
  stampFn(ctx, x => {
    x.fillStyle = 'rgba(243,231,198,.96)'; x.fillRect(x0, y0, w, h);
    x.strokeStyle = PAL.sumi; x.lineWidth = 2.6; x.strokeRect(x0, y0, w, h); x.lineWidth = 1; x.strokeRect(x0 + 5, y0 + 5, w - 10, h - 10);
    x.fillStyle = PAL.sumi; x.textAlign = 'left'; x.textBaseline = 'middle'; x.font = '500 42px Shippori'; x.fillText(s.text, x0 + 96, y0 + h / 2 + 2);
  }, a, [0, 0]);
  const sc = sealCanvas('旅', 40, { seed: 17 }); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = fo * a * .92; ctx.drawImage(sc, x0 + 30, y0 + h / 2 - sc.height / 2);
  ctx.restore();
}

// —— 碎浪白屏：浪爪从浪头炸开、铺满全屏，白就是纸 ——
function whiteout(t, M) {
  const c = seg(t, T.crash[0] - .15, T.crash[1]); if (c <= 0 || t >= T.ma[0]) return;
  const G = waveGeo(1, Math.pow(seg(t, T.fall[0], T.crash[1]), 1.5)), wx = SLOT(3) + G.tip[0] - 60, wy = G.tip[1] + 40;
  const sx = M[0] * wx + M[2] * wy + M[4], sy = M[1] * wx + M[3] * wy + M[5];
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const R = mulberry(9), e = Math.pow(c, 1.7), st = { fill: '#f4ecd6', ink: PAL.prusD, lw: 3 }, st2 = { fill: '#cfdde6', ink: PAL.prusD, lw: 2.6 };
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU + R() * .3 + pass * .2, len = (160 + R() * 220) * (.3 + e * 7), wid = (40 + R() * 40) * (.4 + e * 6);
    fclaw(ctx, sx + Math.cos(a) * 30, sy + Math.sin(a) * 30, a, len, wid, .9 + R() * .4, 2, pass ? st : st2, R);
  }
  const R2 = mulberry(11);
  for (let i = 0; i < 26; i++) { const a = R2() * TAU, d = (40 + R2() * 400) * (.3 + e * 3), r = (6 + R2() * 20) * (.5 + e * 5); ctx.fillStyle = '#f4ecd6'; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * d, sy + Math.sin(a) * d, r, 0, TAU); ctx.fill(); ctx.strokeStyle = PAL.prusD; ctx.lineWidth = 2.4; ctx.stroke(); }
  if (c > .72) { ctx.globalAlpha = ss(clamp((c - .72) / .26)); ctx.drawImage(TX.paper, 0, 0); }
  ctx.restore();
}

// —— 片尾卡 ——
function endCard(t) {
  const a = ss(seg(t, T.endcard, T.endcard + .8)); if (a <= 0) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a;
  ctx.fillStyle = PAL.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 64px Shippori'; ctx.fillText('Toward the Mountain', W / 2, 250);
  ctx.font = '400 34px Yuji'; ctx.fillText('山へ五景', W / 2, 318);
  ctx.font = '700 40px Shippori'; ctx.fillText('U K I Y O - E', W / 2, 790);
  ctx.font = '500 26px Shippori'; ctx.globalAlpha = a * .85; ctx.fillText('a Lemo-Opuscar demo', W / 2, 840);
  ctx.font = '500 30px Shippori'; ctx.globalAlpha = a; ctx.fillText('LemoLab  ×  Claude Opus 5.5', W / 2, 920);
  ctx.restore();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); drawSeal(ctx, '山旅', W / 2 + 402, 250, 64, clamp((t - T.endcard - .5) / .3), { seed: 31, normal: true }); ctx.restore();
}

// —— 角色测试页 ——
function testTrav(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(TX.paper, 0, 0);
  const poses = [['walk', 0], ['walk', .25], ['walk', .5], ['walk', .75]];
  poses.forEach(([m, ph], i) => traveler(ctx, 200 + i * 300, 520, 420, { mode: m, ph, t: ph, wind: 1 }));
  traveler(ctx, 1450, 520, 420, { mode: 'stand', t: 0, wind: 2, holdHat: true });
  traveler(ctx, 1750, 520, 420, { mode: 'walk', ph: .3, t: 0, mino: true, tilt: -.16 });
  traveler(ctx, 250, 1040, 420, { mode: 'sit', t: 0, cup: 0 }); traveler(ctx, 600, 1040, 420, { mode: 'sit', t: 0, cup: 1 });
  traveler(ctx, 1000, 1040, 420, { mode: 'back', t: 0, hatOff: 0 }); traveler(ctx, 1400, 1040, 420, { mode: 'back', t: 0, hatOff: 1 });
  ctx.drawImage(TX.fiber, 0, 0);
}
// —— 海报：巨浪冲出画框 + 片名题签 ——
function poster() {
  renderFrame(28.1, true);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const b = cartouche(ctx, 120, 330, '山へ五景', { series: '', w: 110, size: 74 });
  const x0 = 196, y0 = 330, w = 760, h = 160;
  ctx.fillStyle = '#f3e7c6'; ctx.fillRect(x0, y0, w, h); ctx.fillStyle = PAL.beniL; ctx.fillRect(x0, y0 + h - 42, w, 42);
  ctx.strokeStyle = PAL.sumi; ctx.lineWidth = 3; ctx.strokeRect(x0, y0, w, h); ctx.lineWidth = 1.2; ctx.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
  ctx.fillStyle = PAL.sumi; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 66px Shippori'; ctx.fillText('Toward the Mountain', x0 + w / 2, y0 + 62);
  ctx.font = '500 22px Shippori'; ctx.fillText('A N   U K I Y O - E   F I L M   ·   F I V E   V I E W S', x0 + w / 2, y0 + h - 21);
  ctx.restore();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); drawSeal(ctx, '山旅', 260, 570, 80, 1, { seed: 9 }); ctx.restore();
}
// —— 主渲染 ——
function render(t) {
  if (QS.get('test') === 'trav') return testTrav(t);
  if (QS.has('poster')) return poster();
  renderFrame(t, NOSUB);
}
function renderFrame(t, nosub) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#161a22'; ctx.fillRect(0, 0, W, H);
  const cam = camera(t), M = camMatrix(cam);
  drawScroll(M, t);
  // 可见的纸（粗略剔除）
  const half = (W / 2) / cam.z * 1.6;
  for (let i = 0; i < 5; i++) {
    const x0 = SLOT(i); if (x0 + W < cam.cx - half || x0 > cam.cx + half) continue;
    const Mi = [M[0], M[1], M[2], M[3], M[4] + M[0] * x0, M[5] + M[1] * x0];
    drawSheet(i, t >= T.pull[0] ? (i === 4 ? t : REP[i]) : t, Mi);
  }
  whiteout(t, M);
  if (!nosub) subtitle(t);
  endCard(t);
}

// —— 事件（拟音 / 对白 / 配乐 cue）——
function events() {
  const ev = [], add = (type, t, o = {}) => ev.push({ t: +t.toFixed(3), type, ...o });
  for (const [id, t0] of Object.entries(VO)) add('vo', t0, { id });
  // 印刷：放版的木头轻响 + 馬連摩擦
  T.print1.forEach((t, i) => { add('block', t - .12, { v: .5 + i * .1 }); add('baren', t, { d: .36, v: .7 }); });
  T.print5.forEach((t, i) => { add('block', t - .1, { v: .7 }); add('baren', t, { d: .34, v: .85 }); });
  add('slip', T.title[0] - .05, { v: .6 }); add('seal', T.title[0] + .45, { v: .8 }); add('slip', T.title[1], { v: .4 });
  for (const k of ['v1', 'v2', 'v3', 'v5']) { add('slip', T.cart[k][0], { v: .45 }); add('seal', T.cart[k][1], { v: k === 'v5' ? 1.1 : .85 }); }
  add('seal', T.endcard + .5, { v: .7 });
  // 手卷平移
  add('scroll', T.pan12[0], { d: T.pan12[1] - T.pan12[0], v: .7 }); add('scroll', T.pan23[0], { d: T.pan23[1] - T.pan23[0], v: .75 }); add('scroll', T.pan34[0], { d: T.pan34[1] - T.pan34[0], v: .95 });
  add('scroll', T.pull[0], { d: T.pull[1] - T.pull[0] + .4, v: .45 });
  // 环境
  add('amb', 0.25, { w: 'field', d: T.pan12[1] - .25 }); add('amb', T.pan12[0] + .3, { w: 'rain', d: T.pan23[1] - T.pan12[0] - .3 });
  add('amb', T.pan23[0] + .3, { w: 'tea', d: T.pan34[1] - T.pan23[0] - .3 }); add('amb', T.pan34[0] + .2, { w: 'sea', d: T.ma[0] - T.pan34[0] - .2 });
  add('amb', T.print5[0], { w: 'high', d: DUR - T.print5[0] });
  // 脚步
  for (let t = 3.35; t < 10.4; t += 1 / (2 * 1.05)) add('step', t, { m: 'dirt', v: .5 });
  for (let t = 11.8; t < 16.35; t += 1 / (2 * .9)) add('step', t, { m: 'wood', v: .6 });
  add('geese', 5.2); add('lark', 1.4); add('lark', 7.6);
  [17.9, 19.6, 21.0].forEach(t => add('chime', t)); add('sip', 19.2); add('cup', 21.75);
  add('gust', 24.0); add('gust', T.hang[0] - .3, { v: 1.2 }); add('rise', T.waveRise[0], { d: T.crash[1] - T.waveRise[0] }); add('fall', T.fall[0], { d: T.crash[1] - T.fall[0] }); add('crash', T.crash[1] - .04);
  add('kite', 35.6); add('hat', T.hatOff[0]);
  return ev.sort((a, b) => a.t - b.t);
}

window.render = render; window.DUR = DUR; window.EV = events(); window.SUBS = SUBS;
render(parseFloat(QS.get('t') ?? '20'));
window.READY = true;
