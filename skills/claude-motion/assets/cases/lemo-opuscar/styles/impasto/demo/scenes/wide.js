// The square in the rain. One camera, three states: grey (opening), umbrellas in colour (middle), all colour + sun (finale).
// Scene units: 2112 x 1188 (1.1 x frame), one-point perspective, horizon y = 540.
import { Ref, paintRef, rnd } from '../engine/plate.js';
import { KNIFE, BRUSH, DAB } from '../engine/impasto.js';
import { P, E, lin, rad, lerp, hash } from './common.js';

export const WW = 2112, WH = 1188, HZ = 540, VP = [1150, 540];
// where people stand: ground y -> figure scale (1 = 260 units tall)
export const figScale = y => Math.max(.05, (y - HZ) / (1100 - HZ));
export const ARCH = { x: 1930, y: 872 };          // cellist's spot in the nearest arch

// perspective-correct point on a receding quad [nearTop, farTop, farBot, nearBot]
function pq(q, u, v) {
  const [a, b, c, d] = q, hn = d[1] - a[1], hf = c[1] - b[1];
  const l = u * hn / (u * hn + (1 - u) * hf);
  const top = [lerp(a[0], b[0], l), lerp(a[1], b[1], l)], bot = [lerp(d[0], c[0], l), lerp(d[1], c[1], l)];
  return [lerp(top[0], bot[0], v), lerp(top[1], bot[1], v)];
}
const sq = (q, u0, v0, u1, v1) => [pq(q, u0, v0), pq(q, u1, v0), pq(q, u1, v1), pq(q, u0, v1)];

export function drawWide(R) {
  const c = R.ctx;
  // ---------------- sky (after-rain sunset in colour; flat pale grey in the grey world)
  R.fill(P([[0, 0], [WW, 0], [WW, HZ + 40], [0, HZ + 40]]), lin(0, 0, 0, HZ, [[0, '#34507e'], [.35, '#6f7fa6'], [.62, '#d99a78'], [.85, '#f4c47c'], [1, '#f7dca0']]), { dir: -6, fallback: -6, group: 'sky', maxR: 44, jit: .07, detail: 2.4, aj: .3 });
  // clouds: soft violet banks with warm undersides
  const cloud = (x, y, w, h, col, und) => { R.fill(c2 => { c2.ellipse(x, y, w, h, 0, 0, 7); c2.ellipse(x - w * .55, y + h * .25, w * .6, h * .7, 0, 0, 7); c2.ellipse(x + w * .6, y + h * .3, w * .55, h * .6, 0, 0, 7); }, lin(0, y - h, 0, y + h, [[0, col], [.7, col], [1, und]]), { dir: -4, fallback: -4, group: 'sky', maxR: 30, detail: 1.6, aj: .3 }); };
  cloud(420, 120, 260, 55, '#6c6a8e', '#d98a7a'); cloud(1500, 90, 330, 60, '#5f6390', '#cf8c7c'); cloud(1020, 250, 220, 34, '#9a86a0', '#f0b080'); cloud(1900, 300, 200, 30, '#a48ca0', '#f2b884');
  // ---------------- ground: wet cobbles; near the buildings the wet stone mirrors the bright sky
  const gcol = lin(0, HZ, 0, WH, [[0, '#d6ab8c'], [.1, '#a58a90'], [.3, '#6a6076'], [.65, '#453e50'], [1, '#2f2b38']]);
  const bands = [[HZ - 20, 575, 4], [575, 630, 7], [630, 720, 11], [720, 860, 17], [860, WH, 26]];
  bands.forEach(([y0, y1, r]) => R.fill(P([[0, y0], [WW, y0], [WW, y1], [0, y1]]), gcol, { dir: 0, fallback: 0, group: 'ground', maxR: r, aj: .3, jit: .09 }));
  // the wet street mirrors the bright end of the sky: a luminous path from the vanishing point to us
  { const c0 = R.ctx; c0.save(); c0.filter = 'blur(38px)'; c0.globalCompositeOperation = 'source-atop'; c0.beginPath(); P([[1100, HZ - 10], [1220, HZ - 10], [1560, WH + 60], [640, WH + 60]])(c0); c0.fillStyle = lin(0, HZ, 0, WH, [[0, 'rgba(252,214,156,.95)'], [.3, 'rgba(232,168,136,.5)'], [1, 'rgba(120,120,170,.1)']])(c0); c0.fill(); c0.restore(); }
  // (no puddle blob: the wet path carries the reflection)
  // ---------------- distant street: two small facade rows converging on a belfry, in blue haze
  R.fill(P([[870, 437], [1085, 505], [1085, 548], [870, 574]]), lin(870, 0, 1085, 0, [[0, '#9a8aa0'], [1, '#a7a3bb']]), { dir: 90, maxR: 6, group: 'farL' });
  R.fill(P([[1330, 400], [1215, 490], [1215, 550], [1330, 562]]), lin(1215, 0, 1330, 0, [[0, '#a9a2b8'], [1, '#a39096']]), { dir: 90, maxR: 6, group: 'farR' });
  R.fill(P([[1085, 470], [1110, 452], [1135, 470], [1135, 548], [1085, 548]]), '#8f8fb0', { dir: 90, maxR: 4, group: 'farC' });
  R.fill(P([[1135, 480], [1215, 466], [1215, 550], [1135, 548]]), '#9c98b4', { dir: 90, maxR: 4, group: 'farC' });
  R.fill(P([[1150, 470], [1150, 330], [1165, 312], [1180, 330], [1180, 470]]), '#8184a8', { dir: 90, maxR: 4, group: 'bel' });
  R.fill(P([[1144, 334], [1165, 262], [1186, 334]]), '#6c6f98', { dir: 90, maxR: 3, group: 'bel' });
  R.fill(E(1165, 372, 7, 9), '#f4d49a', { maxR: 2, group: 'belw' });
  [[900, 470], [950, 485], [1000, 498], [1040, 508], [1250, 480], [1285, 460], [1230, 505]].forEach(([x, y], i) => R.fill(P([[x, y], [x + 9, y], [x + 9, y + 12], [x, y + 12]]), i % 3 ? '#f2c878' : '#6a6488', { dir: 90, maxR: 2, group: 'farw' + i }));
  // ---------------- left buildings (receding)
  const L1 = [[0, 30], [520, 272], [520, 679], [0, 865]], L2 = [[520, 318], [870, 437], [870, 574], [520, 679]];
  R.fill(P(L1), lin(0, 0, 0, 860, [[0, '#dca064'], [.55, '#c08452'], [1, '#8e6048']]), { dir: 90, fallback: 90, group: 'L1', maxR: 34, detail: 1.6 });
  R.fill(P([[520, 272], [870, 400], [870, 437], [520, 318]]), '#b07a6c', { dir: 90, group: 'L2' });
  R.fill(P(L2), lin(520, 0, 870, 0, [[0, '#c98d7e'], [1, '#a98690']]), { dir: 90, fallback: 90, group: 'L2', maxR: 20 });
  // roofs / cornices
  R.fill(P([[0, 0], [520, 250], [520, 272], [0, 30]]), '#433e55', { dir: 25, group: 'roof' });
  R.fill(P([[0, 0], [300, 0], [520, 250]]), '#3a3650', { dir: 20, group: 'roof' });
  R.fill(P([[520, 300], [870, 425], [870, 437], [520, 318]]), '#5a4a5a', { dir: 20, group: 'L2' });
  // windows L1: 4 floors x 5 columns, warm lit ones and dark ones, green shutters
  const cols1 = [.06, .27, .46, .63, .79], rows1 = [.07, .27, .47];
  cols1.forEach((u, i) => rows1.forEach((v, j) => {
    const lit = hash(i * 7 + j * 3) > .45;
    const w = sq(L1, u, v, u + .1, v + .13);
    R.fill(P(w), lit ? lin(0, w[0][1], 0, w[3][1], [[0, '#f9dc8e'], [1, '#e8953e']]) : '#3b3448', { dir: 90, maxR: 9 });
    R.fill(P(sq(L1, u - .035, v, u - .005, v + .13)), '#3f7a6c', { dir: 90, maxR: 6 });
    R.fill(P(sq(L1, u + .105, v, u + .135, v + .13)), '#3f7a6c', { dir: 90, maxR: 6 });
    R.fill(P(sq(L1, u - .02, v + .135, u + .12, v + .155)), '#e8d6b0', { dir: 0, maxR: 5 });
  }));
  // cafe: red awning + warm shop window
  R.fill(P(sq(L1, .02, .7, .98, .76)), '#b8342a', { dir: 90, maxR: 14, group: 'awn' });
  for (let k = 0; k < 8; k++) R.fill(P(sq(L1, .04 + k * .12, .7, .1 + k * .12, .76)), '#efe0c8', { dir: 90, maxR: 8, group: 'awn' });
  R.fill(P(sq(L1, .05, .775, .9, .97)), lin(0, 700, 0, 860, [[0, '#ffd27a'], [1, '#e08a3c']]), { dir: 90, maxR: 16 });
  cols1.forEach((u, i) => R.fill(P(sq(L1, u + .1, .775, u + .12, .97)), '#4a3a36', { dir: 90, maxR: 4 }));
  // windows L2
  [.1, .35, .6, .82].forEach((u, i) => [.1, .38, .66].forEach((v, j) => R.fill(P(sq(L2, u, v, u + .1, v + .16)), hash(i + j * 5 + 2) > .5 ? '#f3c26a' : '#3e3650', { dir: 90, maxR: 5 })));
  // ---------------- right building with arcade (receding)
  const Rq = [[WW, -60], [1330, 400], [1330, 562], [WW, 905]];
  R.fill(P(Rq), lin(0, 0, 0, 900, [[0, '#ecc09a'], [.5, '#d4a489'], [1, '#9c7a80']]), { dir: 90, fallback: 90, group: 'R', maxR: 34, detail: 1.7 });
  R.fill(P([[WW, -60], [1330, 400], [1330, 380], [WW, -120]]), '#4a4258', { dir: 20, group: 'roof' });
  // upper windows
  [.08, .3, .5, .68].forEach((u, i) => [.1, .3].forEach((v, j) => {
    R.fill(P(sq(Rq, u, v, u + .09, v + .12)), hash(i * 3 + j) > .4 ? lin(0, 0, 0, 900, [[0, '#f7d488'], [1, '#e89a48']]) : '#3c3448', { dir: 90, maxR: 9 });
    R.fill(P(sq(Rq, u - .02, v + .125, u + .11, v + .145)), '#efe2c6', { dir: 0, maxR: 5 });
  }));
  // arcade: round arches on pillars, nearest first; the nearest is lamp-lit and holds the cellist
  const arches = [[.03, .26], [.33, .52], [.58, .73], [.78, .9]];
  arches.forEach(([u0, u1], i) => {
    const vs = .5, a = pq(Rq, u0, vs), b = pq(Rq, u1, vs), bb = pq(Rq, u1, 1), ab = pq(Rq, u0, 1);
    const w = Math.abs(a[0] - b[0]), rise = w * .5;
    R.fill(cc => { cc.moveTo(ab[0], ab[1]); cc.lineTo(a[0], a[1]); cc.bezierCurveTo(a[0], a[1] - rise * 1.1, b[0], b[1] - rise * 1.1, b[0], b[1]); cc.lineTo(bb[0], bb[1]); cc.closePath(); },
      i === 0 ? rad((a[0] + b[0]) / 2, a[1] + 40, 10, w * .8, [[0, '#b0703e'], [.35, '#6a4034'], [1, '#2a2030']]) : lin(0, a[1] - rise, 0, bb[1], [[0, '#2c2432'], [.6, '#4a3436'], [1, '#6a4a3a']]),
      { dir: 90, group: 'arch' + i, maxR: i ? 10 : 20 });
    // archivolt: a lit stone band around the opening
    R.line(cc => { cc.moveTo(ab[0], ab[1]); cc.lineTo(a[0], a[1]); cc.bezierCurveTo(a[0], a[1] - rise * 1.1, b[0], b[1] - rise * 1.1, b[0], b[1]); cc.lineTo(bb[0], bb[1]); }, '#f0cfa8', Math.max(4, w * .06), { dir: 'edge', group: 'av' + i, maxR: 6 });
    if (i === 0) { ARCH.x = (a[0] + b[0]) / 2 + w * .06; ARCH.y = (ab[1] + bb[1]) / 2 - 8; ARCH.w = w; ARCH.top = a[1] - rise * .8; }
  });
  // lamp inside the nearest arch
  R.fill(E(ARCH.x - ARCH.w * .32, ARCH.top + 120, 12, 17), '#ffe6a8', { maxR: 4, group: 'lampA' });
  R.tint(E(ARCH.x - ARCH.w * .32, ARCH.top + 120, 140, 140), rad(ARCH.x - ARCH.w * .32, ARCH.top + 120, 5, 140, [[0, 'rgba(255,200,120,.6)'], [1, 'rgba(255,200,120,0)']]));
  // ---------------- lamp posts
  const lamp = (x, y, h, s) => {
    R.fill(P([[x - 5 * s, y], [x + 5 * s, y], [x + 3 * s, y - h], [x - 3 * s, y - h]]), '#262230', { dir: 90, maxR: 4, group: 'post' + x });
    R.fill(P([[x - 16 * s, y - h - 44 * s], [x + 16 * s, y - h - 44 * s], [x + 11 * s, y - h], [x - 11 * s, y - h]]), '#ffe09a', { dir: 90, maxR: 4, group: 'lamp' + x });
    R.fill(P([[x - 20 * s, y - h - 44 * s], [x + 20 * s, y - h - 44 * s], [x, y - h - 60 * s]]), '#262230', { dir: 0, maxR: 3, group: 'post' + x });
    R.tint(E(x, y - h - 22 * s, 120 * s, 120 * s), rad(x, y - h - 22 * s, 10, 120 * s, [[0, 'rgba(255,214,140,.55)'], [1, 'rgba(255,214,140,0)']]));
  };
  lamp(790, 760, 250, 1); lamp(1455, 720, 190, .8);
}

export function buildWide(seed = 3) {
  const R = new Ref(WW, WH, 1);
  drawWide(R);
  const st = paintRef(R, { R: [44, 22, 11, 5.5, 3], T: 13, seed,
    // colour floods out from the cellist's arch at the final chord
    rev: (x, y) => Math.hypot(x - ARCH.x, (y - ARCH.y) * 1.6) / 1500 + hash(x * .13 + y) * .12,
    app: (x, y, lv) => ((WW - x) / WW) * .3 + lv * .03 });
  reflections(st, R);
  return { strokes: st, ref: R };
}

// wet-stone reflections: stacks of short horizontal knife dabs under every light source
function reflections(st, R) {
  const stack = (x, yTop, len, w, col, k = 1, a0 = .85) => {
    const n = Math.round(len / 9);
    for (let i = 0; i < n; i++) {
      const f = i / n, y = yTop + f * len, sc = figScale(y) * .6 + .5;
      if (rnd() < f * .45) continue;
      const ww = w * (1 - f * .5) * (.55 + rnd() * .6);
      const c = col.map(v => v * (1 - f * .35) * k);
      st.push({ x: x + (rnd() - .5) * w * .5, y, ang: (rnd() - .5) * .12, len: ww, wid: 7 * sc + rnd() * 5, c, c2: c.map(v => v * .85), type: 0, hgt: .7, alpha: a0 * (1 - f * .7), seed: rnd() * 999,
        rev: Math.hypot(x - ARCH.x, (y - ARCH.y) * 1.6) / 1500, skew: (rnd() - .5) });
    }
  };
  stack(790, 770, 260, 30, [1, .86, .55]); stack(1455, 726, 200, 24, [1, .86, .55]);
  stack(230, 880, 280, 200, [.98, .74, .4], .95); stack(120, 870, 120, 110, [.72, .22, .18], 1, .7);
  [[60, 760], [175, 735], [300, 712], [405, 694]].forEach(([x, y]) => stack(x, y + 130, 120, 40, [.95, .75, .42], .9, .55));
  stack(ARCH.x - 20, ARCH.y + 30, 240, 90, [.95, .7, .42], 1, .75); stack(1700, 800, 120, 40, [.8, .55, .4], 1, .5);
  stack(1165, 560, 150, 110, [.96, .8, .62], 1, .6);
}
