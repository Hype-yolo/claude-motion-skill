// 第 5 镜 静（笠檐大特写 → 过肩：拔剑写"水"）+ 第 6 镜 断流（捺笔出字化飞白，浪分上下两半翻卷塌下）
import { mk, draw, blot, mass } from './ink.js';
import { hero, POSE, mixPose } from './hero.js';
import { face } from './face.js';
import { wave } from './wave.js';
import { ridgeFn, mountainLayer, ripple } from './land.js';
import { shuiStrokes, cutStroke, tipAt } from './glyph.js';
import { T } from './story.js';
import { clamp, lerp, ss, eo, eio, mulberry } from '/core/lib.js';

let WV = null, BG = null, TM = null;
const BOX = [300, 110, 520];
const LINE0 = [300 + 88 * 5.2, 110 + 76.5 * 5.2], LINE1 = [2200, 640];
const lineY = x => x < LINE0[0] ? LINE0[1] : LINE0[1] + (x - LINE0[0]) / (LINE1[0] - LINE0[0]) * (LINE1[1] - LINE0[1]);
let STR = null, CUT = null;

export function init(TMP) {
  TM = TMP;
  const cv = () => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; return c; };
  WV = { wet: cv(), dry: cv() }; WV.ink = { wet: WV.wet.getContext('2d'), dry: WV.dry.getContext('2d') };
  BG = mountainLayer({ W: 1920, H: 1080, ridge: ridgeFn([[300, 160, 120], [620, 90, 140], [1700, 120, 150]], 830, 5, 20), depth: 160, tone: .1, rim: .5, mist: .8, seed: 5 });
  STR = shuiStrokes(BOX); CUT = cutStroke(BOX, LINE1[0], LINE1[1], { w: 17, dry: .6 });
}

// 写字进度
function prog(t) {
  const f = (w) => eio(clamp((t - w[0]) / (w[1] - w[0])));
  return [f(T.w1), f(T.w2), f(T.w3)];
}

export function render(A, t, TMP) {
  if (t < T.shot5b) return renderECU(A, t);
  return renderWrite(A, t);
}

// 笠檐大特写：看不见眼睛，一滴水从笠檐落下
function renderECU(A, t) {
  const u = (t - T.cut5) / (T.shot5b - T.cut5), z = 1 + .03 * u;
  for (const c of [A.cw, A.cd, A.cc]) { c.save(); c.translate(960, 540); c.scale(z, z); c.translate(-960, -540); }
  face(A.ink, 'calm', { x: 1000, y: 560, s: 9.5, seed: 3, hatY: -9, hide: true, drop: t < T.drop5 ? -1 : clamp((t - T.drop5) / (T.drip5 - T.drop5)) });
  for (const c of [A.cw, A.cd, A.cc]) c.restore();
  return { bleed: 6, rim: 1 };
}

function renderWrite(A, t) {
  const L = A.ink, t12 = Math.floor(t * 12) / 12;
  const push = t < T.hush ? 1 : 1 + .05 * ss((t - T.hush) / (T.cut - T.hush));
  const after = t - T.cut, k = clamp((t - T.cutEnd) / 2.3);            // 劈开进度：飞白扫完才裂开
  const shk = after > 0 && after < .45 ? (1 - after / .45) * 14 : 0;
  const shake = [Math.sin(t * 91) * shk, Math.cos(t * 73) * shk * .6];
  for (const c of [A.cw, A.cd, A.cc]) { c.save(); c.translate(960, 540); c.scale(push, push); c.translate(-960, -540); }
  A.cw.drawImage(BG, 0, 0);
  // 浪：先画进临时层（静止中只微微起伏）
  for (const c of [WV.ink.wet, WV.ink.dry]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1920, 1080); }
  const wt = T.cut5 + (Math.min(t, T.cut) - T.cut5) * .15;
  wave(WV.ink, { x: 1250, y: 910, s: .98, rise: 1, curl: 1, t: wt, seed: 21 });
  if (k <= 0) {
    for (const key of ['wet', 'dry']) L[key].drawImage(WV[key], 0, 0);
  } else {
    // 上半：沿切口向上翻卷、化开；下半：向下塌落、压扁
    const up = eo(k), dn = ss(k);
    const x0 = 0, x1 = 1920;
    for (const key of ['wet', 'dry']) {
      const c = L[key];
      c.save(); c.beginPath(); c.moveTo(x0, lineY(x0) - 6); c.lineTo(x1, lineY(x1) - 6); c.lineTo(x1, -200); c.lineTo(x0, -200); c.closePath(); c.clip();
      c.globalAlpha = 1 - .9 * up; c.translate(LINE1[0], lineY(1200)); c.rotate(-.22 * up); c.translate(-LINE1[0], -lineY(1200)); c.drawImage(WV[key], 80 * up, -330 * up); c.restore();
      c.save(); c.beginPath(); c.moveTo(x0, lineY(x0) + 6); c.lineTo(x1, lineY(x1) + 6); c.lineTo(x1, 1300); c.lineTo(x0, 1300); c.closePath(); c.clip();
      c.globalAlpha = 1 - .8 * dn; c.translate(0, 910); c.scale(1, 1 - .6 * dn); c.translate(0, -910); c.drawImage(WV[key], 0, 240 * dn); c.restore();
    }
    // 浪脊：两道裂口上各一排向外翻卷的浪头（含墨短弧，浓边朝外），先卷起再随水塌散
    for (let side = -1; side <= 1; side += 2) {
      const a = clamp(k * 5) * (1 - clamp((k - .55) / .45));
      if (a <= 0) continue;
      const RR = mulberry(side + 30);
      for (let i = 0; i < 4; i++) {
        const sc = .6 + RR() * .8, x = 880 + i * 270 + RR() * 90, y = lineY(x) + (side < 0 ? -30 - 300 * up : 30 + 230 * dn) + (RR() - .5) * 40;
        const c = (30 + 110 * eo(clamp(k * 2.5 - i * .12))) * sc, sgn = side, lean = 40 + RR() * 60;
        const pts = [[x - 140 * sc, y + sgn * 6], [x - 40 * sc, y + sgn * c * .3], [x + lean * .5, y + sgn * c * .85], [x + lean * .3, y + sgn * c * 1.2], [x - 10 * sc, y + sgn * c * 1.1], [x - 25 * sc, y + sgn * c * .85]];
        draw(L, mk(pts, { w: (26 + RR() * 16) * sc, tone: .8, darkDir: [0, sgn], side: .85, brWet: true, body: .3, dry: .55, wet: .8, prof: 'brush', seed: 1520 + i + side * 10 }), 1, a * (.7 + .3 * RR()));
      }
      // 淡墨大块：翻卷的水体
      const yb = lineY(1200) + (side < 0 ? -80 - 300 * up : 80 + 230 * dn);
      draw(L, mk([[760, yb], [1300, yb + side * 20], [1960, yb - side * 10]], { w: 150, tone: .35, darkDir: [0, -side], side: .8, brWet: true, body: .35, dry: .5, wet: .95, prof: 'lens', seed: 1560 + side }), 1, a * .8);
    }
  }
  // 水字
  const p = prog(t), fadeC = clamp((t - (T.cut + 1.2)) / 1.4);
  const am = 1 - fadeC;
  if (am > 0) {
    STR.forEach((s, i) => { if (i < 3 && p[i] > 0) draw(L, s, p[i], am); });
    // 断流：捺笔出字 → 横扫出画
    if (after >= 0) draw(L, CUT, eo(clamp(after / (T.cutEnd - T.cut))), am);
    if (fadeC > 0) {   // 字化开：墨往湿层里晕
      A.cw.globalAlpha = fadeC * .5 * am; A.cw.drawImage(A.dry, 0, 0); A.cw.globalAlpha = 1;
    }
  }
  // 墨点：顺剑势向右飞溅，落下后留在纸上
  if (after > 0) {
    const R = mulberry(9);
    for (let i = 0; i < 120; i++) {
      const u = R(), r1 = R(), r2 = R(), r3 = R(), r4 = R(), r5 = R();
      const x0 = LINE0[0] + u * (1920 - LINE0[0]), y0 = lineY(x0);
      const born = (T.cutEnd - T.cut) * u, age = after - born; if (age < 0) continue;
      const vx = 300 + r1 * 900, vy = (r2 - .5) * 700, sz = 2 + r3 * 9 * (1 - u * .4), fl = Math.min(age, .9 + r4 * .5);
      const x = x0 + vx * fl * (1 - fl * .35), y = y0 + vy * fl + 380 * fl * fl;
      blot(A.cw, x, y, sz, .85, r5 * 3, .5 + .5 * clamp(1 - age * 2), i);
      if (age < .25) draw(L, mk([[x, y], [x - vx * .04, y - vy * .04]], { w: sz * .7, tone: .8, dry: .4, prof: 'tip', seed: 1000 + i }), 1, 1 - age * 4);
    }
  }
  // 侠客：背面，拔剑 → 写字（剑指笔尖）→ 横剑收势
  let P;
  const tw = t12;
  if (tw < T.draw) P = POSE.back;
  else if (tw < T.draw + .4) P = mixPose(POSE.back, POSE.backWrite, ss((tw - T.draw) / .4));
  else {
    // 当前笔尖
    let tip = null; const pp = prog(tw);
    if (tw >= T.cut) tip = [1920, 600];
    else { for (let i = 2; i >= 0; i--) if (pp[i] > 0) { tip = tipAt(STR, i, pp[i]); break; } }
    const base = POSE.backWrite;
    if (tip) {
      const sh = [8.5, -74], hx = 330, hy = 1330, s = 6.4;
      const tl = [(tip[0] - hx) / s, (tip[1] - hy) / s], d = [tl[0] - sh[0], tl[1] - sh[1]], L2 = Math.hypot(d[0], d[1]);
      const n = [d[0] / L2, d[1] / L2], hand = [sh[0] + n[0] * 24, sh[1] + n[1] * 24], elb = [sh[0] + n[0] * 12 + 3, sh[1] + n[1] * 12 + 4];
      P = { ...base, aR: [sh, elb, hand], sword: { a: Math.atan2(n[1], n[0]) } };
    } else P = base;
  }
  hero(L, P, { x: 330, y: 1330, s: 6.4, seed: 8, t: t12, boil: t12 * 12 });
  for (const c of [A.cw, A.cd, A.cc]) c.restore();
  const flash = after > 0 && after < .12 ? .35 * (1 - after / .12) : 0;
  return { bleed: 5, rim: 1, shake, flash };
}
