// 引擎层（所有画风之上统一的"游戏 UI"）：引线计时条、命令词、结果章、生命头盔、字幕牌
import { P, K, part, line, dot, circ, ell, rrect, poly, outlined } from './toon.js';
import { clamp, seg, eo, back, lerp, hash, mulberry } from '/core/lib.js';
const TAU = Math.PI * 2;

// ───────── 引线：编织绳 + 每拍一个刻度结；火花从左烧到右端的小冲天炮 ─────────
// p = 进度 0..1（火花位置），beats = 刻度数，t = 全局时间（火花闪烁用），o.boss = 加粗双股
export function fuse(g, p, beats, t, o = {}) {
  const x0 = o.x0 ?? 150, x1 = o.x1 ?? 1700, y = o.y ?? 1022, boss = !!o.boss;
  const th = boss ? 16 : 11;
  const X = u => lerp(x0, x1, u), Y = u => y + Math.sin(u * 22) * 3;
  const sx = X(clamp(p));
  g.save(); K.s = 1;
  // 已烧过：焦黑残段（虚线）
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(40,30,50,.55)'; g.lineWidth = th * .5; g.setLineDash([6, 9]);
  g.beginPath(); g.moveTo(x0, y); for (let u = 0; u <= clamp(p); u += .005) g.lineTo(X(u), Y(u)); g.stroke(); g.setLineDash([]);
  // 未烧：编织绳（墨色底 + 两股扭绳）
  const path = () => { g.beginPath(); g.moveTo(sx, Y(p)); for (let u = clamp(p); u <= 1.0001; u += .004) g.lineTo(X(u), Y(u)); };
  path(); g.strokeStyle = P.ink; g.lineWidth = th + 8; g.stroke();
  path(); g.strokeStyle = '#e8c17a'; g.lineWidth = th; g.stroke();
  // 扭纹
  g.strokeStyle = '#a8742e'; g.lineWidth = 3;
  for (let u = clamp(p); u <= 1; u += 14 / (x1 - x0)) { const x = X(u), yy = Y(u); g.beginPath(); g.moveTo(x - 4, yy - th / 2 + 1); g.lineTo(x + 4, yy + th / 2 - 1); g.stroke(); }
  // 刻度结（每拍）：火花经过时亮一下
  for (let i = 1; i < beats; i++) {
    const u = i / beats; if (u < p - .002) continue;
    const x = X(u), yy = Y(u);
    g.fillStyle = P.ink; g.beginPath(); g.ellipse(x, yy, th * .75 + 4, th * .75 + 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#c98f3c'; g.beginPath(); g.ellipse(x, yy, th * .75, th * .75, 0, 0, TAU); g.fill();
  }
  // 末端冲天炮
  const rx = x1 + 60, ry = y - 6;
  g.save(); g.translate(rx, ry); g.rotate(-.25 - (o.launch || 0) * .1); g.translate(0, -(o.launch || 0) * 400);
  part(rrect(-20, -50, 40, 76, 10), P.red, P.redD, { sh: 5, lw: 6 });
  part(poly([[-24, -46], [24, -46], [0, -84]]), P.gold, P.goldD, { sh: 4, lw: 6 });
  part(rrect(-20, -18, 40, 12, 2), P.white, null, { lw: 5 });
  part(poly([[-20, 18], [-36, 38], [-20, 30]]), P.gold, null, { lw: 5 });
  part(poly([[20, 18], [36, 38], [20, 30]]), P.gold, null, { lw: 5 });
  g.restore();
  // 火花
  if (p > 0 && p < 1) {
    const r = mulberry(Math.floor(t * 24) + 7), yy = Y(p);
    for (let i = 0; i < (boss ? 14 : 9); i++) {
      const a = r() * TAU, l = (14 + r() * 26) * (boss ? 1.4 : 1);
      g.strokeStyle = i % 3 ? '#ffe45c' : '#ffffff'; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(sx + Math.cos(a) * 6, yy + Math.sin(a) * 6); g.lineTo(sx + Math.cos(a) * l, yy + Math.sin(a) * l); g.stroke();
    }
    g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(sx, yy, boss ? 13 : 10, 0, TAU); g.fill();
    g.fillStyle = '#ff9a1a'; g.beginPath(); g.arc(sx, yy, boss ? 7 : 5, 0, TAU); g.fill();
  }
  g.restore();
}

// ───────── 命令词：第一拍"砸"进来（1.6 → 1.0，2 帧过冲），停 hold 秒后缩到左上角成小标签 ─────────
export function command(g, txt, lt, hold = .75, o = {}) {
  if (lt < 0) return;
  const inT = .12, shrink = .22;
  let s, x, y, a = 1;
  const big = o.size || (txt.length > 9 ? 190 : 230);
  if (lt < inT) { const u = lt / inT; s = lerp(1.9, .92, eo(u)); x = 960; y = 560; }
  else if (lt < inT + .08) { s = lerp(.92, 1, (lt - inT) / .08); x = 960; y = 560; }
  else if (lt < hold) { s = 1 + (lt - inT) * .03; x = 960; y = 560; }
  else if (lt < hold + shrink) { const u = eo((lt - hold) / shrink); s = lerp(1.02, .3, u); x = lerp(960, 60 + big * .3 * txt.length * .3, u); y = lerp(560, 100, u); }
  else { s = .3; x = 60 + big * .3 * txt.length * .3; y = 100; }
  const tag = lt >= hold + shrink;
  if (o.noTag && lt >= hold) { const u = (lt - hold) / .15; if (u >= 1) return; s = lerp(1.02, 1.6, u); x = 960; y = 560; g.save(); g.globalAlpha = 1 - u; }
  else g.save();
  g.translate(x, y); g.rotate(-.06); g.transform(1, 0, -.12, 1, 0, 0); g.scale(s, s);
  if (!tag) {
    // 背后一道放射爆炸形（只在大字时）
    g.save(); g.fillStyle = o.burst || P.gold; g.strokeStyle = P.ink; g.lineWidth = 10; g.beginPath();
    const w = big * txt.length * .36 + 120, h = big * .85;
    for (let i = 0; i <= 28; i++) { const aa = i / 28 * TAU, rr = i % 2 ? .78 : 1.04; g.lineTo(Math.cos(aa) * w * .5 * rr, Math.sin(aa) * h * rr - big * .3); }
    g.closePath(); g.globalAlpha = .96; g.fill(); g.stroke(); g.restore();
  }
  outlined(g, txt, 0, 0, { font: `${big}px Titan`, lw: 22, stroke: P.ink, fill: P.white, shadow: tag ? P.ink : P.mag, sd: [8, 14] });
  g.restore();
}

// ───────── 结果章：OK!（绿圆）/ OOPS（红叉），pop = 0..1 ─────────
export function stamp(g, ok, x, y, lt, s = 1) {
  if (lt < 0) return;
  const k = lt < .1 ? lerp(2.2, .95, eo(lt / .1)) : lt < .18 ? lerp(.95, 1, (lt - .1) / .08) : 1;
  g.save(); g.translate(x, y); g.scale(s * k, s * k); g.rotate(ok ? -.12 : .1); K.s = s * k;
  if (ok) {
    part(circ(0, 0, 120), P.green, P.greenD, { sh: 12, lw: 12 });
    part(circ(0, 0, 96), P.green, null, { lw: 5, stroke: 'rgba(255,255,255,.7)' });
    outlined(g, 'OK!', 0, 34, { font: '104px Titan', lw: 16, fill: P.white });
  } else {
    part(circ(0, 0, 120), P.red, P.redD, { sh: 12, lw: 12 });
    line([[-54, -54], [54, 54]], 36, P.ink); line([[54, -54], [-54, 54]], 36, P.ink);
    line([[-54, -54], [54, 54]], 22, P.white); line([[54, -54], [-54, 54]], 22, P.white);
  }
  g.restore(); K.s = 1;
}

// ───────── 生命：小头盔图标（crack = 0..1 裂开掉落）─────────
export function lifeIcon(g, x, y, s, o = {}) {
  const c = o.crack || 0;
  g.save();
  let fx = x, fy = y, rot = 0, al = 1;
  if (c > 0) { const u = c; fy = y + (u < .25 ? -30 * Math.sin(u / .25 * Math.PI) : Math.pow((u - .25) / .75, 2) * 700); fx = x + u * 90; rot = u * 2.2; al = 1 - seg(u, .7, 1); }
  g.translate(fx, fy); g.rotate(rot); g.scale(s, s); g.globalAlpha = al; K.s = s;
  if (o.blink) { g.globalAlpha *= o.blink; }
  const dead = o.dead;
  // 天线
  line([[0, -46], [0, -70]], 5, P.ink); part(circ(0, -74, 11), dead ? P.gray : P.orange, dead ? P.grayD : P.orangeD, { sh: 3, lw: 5 });
  part(circ(0, 0, 48), dead ? '#4a3e6a' : 'rgba(150,230,255,.9)', dead ? '#3a2e58' : '#6ab8e0', { sh: 6, lw: 7 });
  if (!dead) { part(circ(3, 6, 30), P.skin, P.skinD, { sh: 4, lw: 5 }); dot(-8, 4, 4.5, P.ink); dot(12, 4, 4.5, P.ink); g.beginPath(); g.arc(3, 16, 7, .2, Math.PI - .2); g.lineWidth = 4 / s * s; g.strokeStyle = P.ink; g.stroke(); }
  g.beginPath(); g.arc(0, 0, 38, Math.PI * 1.1, Math.PI * 1.4); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 7; g.lineCap = 'round'; g.stroke();
  if (c > 0) { line([[-10, -46], [4, -14], [-6, 6], [10, 40]], 5, P.ink); }
  part(ell(0, 44, 36, 10), P.cyan, P.cyanD, { sh: 3, lw: 5 });
  g.restore(); K.s = 1;
}
export function livesBoard(g, n, x, y, o = {}) {
  // n = 当前生命；o.crack = [index, 0..1]；o.blink = 最后一条命闪烁
  g.save(); K.s = 1;
  part(rrect(x - 30, y - 70, 3 * 118 + 40, 150, 28), P.deep, P.night, { sh: 8, lw: 7 });
  for (let i = 0; i < 3; i++) {
    const cx = x + 30 + i * 118, cy = y + 8;
    const cr = o.crack && o.crack[0] === i ? o.crack[1] : 0;
    if (i < n || cr > 0) lifeIcon(g, cx, cy, .95, { crack: cr, blink: (n === 1 && i === 0 && o.blink) ? o.blink : 0 });
    else { g.save(); g.globalAlpha = .35; g.strokeStyle = P.vio; g.lineWidth = 5; g.setLineDash([10, 8]); g.beginPath(); g.arc(cx, cy, 44, 0, TAU); g.stroke(); g.restore(); }
  }
  g.restore();
}
export function stageBadge(g, n, x, y) {
  g.save(); K.s = 1;
  part(rrect(x, y, 260, 110, 24), P.gold, P.goldD, { sh: 8, lw: 7 });
  outlined(g, 'STAGE', x + 130, y + 44, { font: '40px Lilita', lw: 0, fill: P.ink });
  outlined(g, String(n).padStart(2, '0'), x + 130, y + 98, { font: '62px Titan', lw: 9, fill: P.white });
  g.restore();
}
// ───────── 字幕牌：金黄圆角牌 + 描边 + 硬投影；icon = 'tick' | 'dot' ─────────
export function subtitle(g, text, lt, dur, o = {}) {
  if (lt < 0 || lt > dur) return;
  const k = lt < 1 / 12 ? .82 : lt < 2 / 12 ? .95 : 1;
  const out = lt > dur - 1 / 12 ? .9 : 1;
  g.save(); g.font = '50px Lilita'; const w = g.measureText(text).width + 150, h = 86;
  const x = 960, y = o.y ?? 930;
  g.translate(x, y); g.scale(k * out, k * out); K.s = 1;
  part(rrect(-w / 2, -h / 2, w, h, 26), P.gold, P.goldD, { sh: 6, lw: 7 });
  g.fillStyle = P.ink; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(text, -w / 2 + 108, 3);
  // 图标
  g.save(); g.translate(-w / 2 + 56, 0); K.s = 1;
  if ((o.icon || 'tick') === 'tick') { part(circ(0, 0, 28), P.gold, P.goldD, { sh: 3, lw: 6 }); part(circ(0, 0, 20), P.dial, null, { lw: 3 }); line([[0, 0], [0, -15]], 4, P.red); part(rrect(-7, -40, 14, 10, 3), P.gold, null, { lw: 4 }); }
  else { g.scale(.55, .55); lifeIcon(g, 0, 8, 1); }
  g.restore();
  g.restore();
}
