// 折—剪—展开：纸坐标 = 团花坐标（原点 = 纸中心，半边长 400 = TR）
import { PAL, canvas, piece, fill, trace, finishPaper, fillPaper, paperShadow, noShadow } from './paper.js';
import { put, mul, T, S, R } from './rig.js';
import { TR, outerR, wedgeFlat, D4 } from './tuanhua.js';
import { drawScissors } from './girl.js';
import { clamp, seg, ss, lerp, eio, eo, back, hash, track } from '/core/lib.js';
import { T as TL } from './story.js';

const FRONT = PAL.red, BACK = '#de3b30';
const Kx = 2.2, Q = Math.PI / 4;
const F = {};
function build() {
  if (F.front) return F;
  const sq = col => piece([-TR, -TR, TR, TR], g => fill(g, q => q.rect(-TR, -TR, 2 * TR, 2 * TR), col), { ss: Kx, seed: 77, col, edge: 0 });
  F.front = sq(FRONT); F.back = sq(BACK);
  const wt = col => { const w = wedgeFlat(Kx, col), [c, g] = canvas(w.c.width, w.c.height); g.drawImage(w.c, 0, 0); finishPaper(c, g, { seed: 78 }); return { c, x0: w.x0, y0: w.y0, w: w.w, h: w.h }; };
  F.wFront = wt(FRONT); F.wBack = wt(BACK);
  return F;
}
const TRI = [[0, 0], [TR, 0], [TR, TR]];
// 在 M 变换下，把 face 片裁进 poly（纸坐标）
function layer(g, M, poly, face, opt = {}) {
  const p = face === 'back' ? F.back : F.front;
  g.save(); g.setTransform(...M);
  g.beginPath(); trace(g, poly); g.clip();
  if (opt.shadow) paperShadow(g, Math.hypot(M[0], M[1]), opt.shadow);
  g.drawImage(p.c, p.x0, p.y0, p.w, p.h);
  noShadow(g);
  if (opt.shade) { g.fillStyle = `rgba(40,0,6,${opt.shade})`; g.fillRect(-TR, -TR, 2 * TR, 2 * TR); }
  if (opt.hi) { g.fillStyle = `rgba(255,220,200,${opt.hi})`; g.fillRect(-TR, -TR, 2 * TR, 2 * TR); }
  g.restore();
}
// 纸叠的厚度：往右下偏移画几层深色
function stack(g, M, poly, n) {
  for (let i = n; i >= 1; i--) { g.save(); g.setTransform(...M); g.translate(i * 1.1, i * 1.4); g.beginPath(); trace(g, poly); g.fillStyle = i % 2 ? '#9c1418' : '#b51a1c'; g.fill(); g.restore(); }
}
// 翻起的纸：沿法线分 16 条，每条按抬起高度做近大远小（伪透视），画进离屏再整体投影
const [Fc, Fg] = canvas(1920, 1080);
function flap(g, C, n, s, poly, face) {
  const tv = [-n[1], n[0]], ds = poly.map(p => p[0] * n[0] + p[1] * n[1]), D = Math.max(...ds.map(Math.abs)), sg = Math.sign(ds.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0)) || 1;
  const lift = Math.sqrt(Math.max(0, 1 - s * s)), N = 16;
  Fg.setTransform(1, 0, 0, 1, 0, 0); Fg.clearRect(0, 0, 1920, 1080);
  for (let i = 0; i < N; i++) {
    const d0 = sg * D * i / N - sg * .6, d1 = sg * D * (i + 1) / N + sg * .6, dm = (d0 + d1) / 2;
    const sc = 1 + .28 * Math.abs(dm) / TR * lift;
    const M = [1 + (s - 1) * n[0] * n[0] + (sc - 1) * tv[0] * tv[0], (s - 1) * n[0] * n[1] + (sc - 1) * tv[0] * tv[1], (s - 1) * n[0] * n[1] + (sc - 1) * tv[0] * tv[1], 1 + (s - 1) * n[1] * n[1] + (sc - 1) * tv[1] * tv[1], 0, 0];
    const strip = [[d0 * n[0] - 3000 * tv[0], d0 * n[1] - 3000 * tv[1]], [d0 * n[0] + 3000 * tv[0], d0 * n[1] + 3000 * tv[1]], [d1 * n[0] + 3000 * tv[0], d1 * n[1] + 3000 * tv[1]], [d1 * n[0] - 3000 * tv[0], d1 * n[1] - 3000 * tv[1]]];
    const MM = mul(C, M), p = face === 'back' ? F.back : F.front;
    Fg.save(); Fg.setTransform(...MM); Fg.beginPath(); trace(Fg, poly); Fg.clip(); Fg.beginPath(); trace(Fg, strip); Fg.clip();
    Fg.drawImage(p.c, p.x0, p.y0, p.w, p.h);
    // 明暗：竖起时变暗，背面朝上时略亮
    const shade = .38 * lift * (s > 0 ? 1 : .6);
    Fg.fillStyle = s > 0 ? `rgba(40,0,6,${shade})` : `rgba(255,225,205,${.12 + .1 * lift})`; Fg.fillRect(-TR * 2, -TR * 2, TR * 4, TR * 4);
    Fg.restore();
  }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); const z = C[0];
  g.shadowColor = `rgba(50,8,6,${.3 + .25 * lift})`; g.shadowBlur = (6 + 30 * lift) * z; g.shadowOffsetX = (3 + 22 * lift) * z; g.shadowOffsetY = (4 + 28 * lift) * z;
  g.drawImage(Fc, 0, 0); g.restore();
  // 折痕：一道细暗线
  g.save(); g.setTransform(...C); g.strokeStyle = 'rgba(80,6,10,.45)'; g.lineWidth = 1.6 / z; g.beginPath(); g.moveTo(-2000 * tv[0], -2000 * tv[1]); g.lineTo(2000 * tv[0], 2000 * tv[1]); g.restore();
}
const flapM = (n, s) => { const [nx, ny] = n; return [1 + (s - 1) * nx * nx, (s - 1) * nx * ny, (s - 1) * nx * ny, 1 + (s - 1) * ny * ny, 0, 0]; };
const foldS = u => Math.cos(Math.PI * eio(u));       // 1 → -1
// 刀路（楔形坐标）：外缘花边 → 外圈叶脉 → 灯笼 → 镂空中圈 → 内圈 → 花心
const PATH = (() => {
  const p = [], pol = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
  p.push([TR * 1.08, TR * .05]);
  for (let i = 0; i <= 10; i++) p.push(pol(outerR(i / 10 * Q) - 6, i / 10 * Q));
  for (const a of [Q * .9, Q * .75, Q * .6, Q * .45, Q * .25, Q * .1]) p.push(pol(TR * .8, a));
  p.push(pol(TR * .62, Q * .5)); p.push(pol(TR * .535, Q * .62)); p.push(pol(TR * .45, Q * .5)); p.push(pol(TR * .535, Q * .38));
  for (const a of [Q * .1, Q * .02, Q * .3, Q * .7, Q * .98, Q * .9]) p.push(pol(TR * .5, a));
  for (const a of [Q * .8, Q * .5, Q * .2]) p.push(pol(TR * .31, a));
  p.push(pol(TR * .18, Q * .5)); p.push(pol(TR * .08, Q * .5)); p.push([6, 3]);
  return p;
})();
const PL = (() => { const L = [0]; for (let i = 1; i < PATH.length; i++) L.push(L[i - 1] + Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1])); return L; })();
function pathAt(u) {
  const s = clamp(u) * PL[PL.length - 1]; let i = 0; while (i < PL.length - 2 && PL[i + 1] < s) i++;
  const f = (s - PL[i]) / (PL[i + 1] - PL[i]), a = PATH[i], b = PATH[i + 1];
  return { p: [lerp(a[0], b[0], f), lerp(a[1], b[1], f)], ang: Math.atan2(b[1] - a[1], b[0] - a[0]), i, s };
}
const cutU = t => seg(t, TL.cut0 + .1, TL.cut1);
// 相机
const camK = track([[TL.folds[0] - .01, [0, 0, .95]], [TL.folds[0] + .7, [0, 190, 1.22]], [TL.folds[1] + .7, [190, 190, 1.62]], [TL.folds[2] + .6, [262, 140, 2.25]],
  [TL.cut1 + .3, [262, 140, 2.2]], [TL.unfolds[0] + .02, [240, 130, 2.0]], [TL.unfolds[2] + .45, [0, 0, 1.12]], [TL.bloom + 1, [0, 0, 1.14]]]);
export function camFold(t) {
  let [x, y, z] = camK(t);
  if (t > TL.cut0 && t < TL.cut1 + .4) { const { p } = pathAt(cutU(t)), k = .32 * Math.min(seg(t, TL.cut0, TL.cut0 + .4), 1 - seg(t, TL.cut1, TL.cut1 + .4)); x = lerp(x, p[0], k); y = lerp(y, p[1], k); }
  if (t > TL.bloom - .05) { const u = t - TL.bloom; z *= 1 + .07 * Math.exp(-u * 5) * Math.sin(Math.min(u * 14, Math.PI)); }
  return [z, 0, 0, z, 960 - x * z, 540 - y * z];
}
const [Mc, Mg] = canvas(1920, 1080);
export function drawFold(g, t) {
  build();
  const C = camFold(t), z = C[0];
  // 桌面：宣纸 + 烛光暖晕
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); fillPaper(g, 'rice', 0, 0, 1920, 1080, [z * .9, 0, 0, z * .9, C[4], C[5]]);
  const gr = g.createRadialGradient(560, 300, 100, 900, 560, 1400); gr.addColorStop(0, 'rgba(255,200,120,.10)'); gr.addColorStop(1, 'rgba(60,20,10,.45)');
  g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); g.restore();
  const [f1, f2, f3] = TL.folds, D = .55;
  const scraps = [];
  if (t < f1) layer(g, C, [[-TR, -TR], [TR, -TR], [TR, TR], [-TR, TR]], 'front', { shadow: 1 });
  else if (t < f1 + D) {
    const s = foldS((t - f1) / D);
    layer(g, C, [[-TR, 0], [TR, 0], [TR, TR], [-TR, TR]], 'front', { shadow: 1 });
    flap(g, C, [0, 1], s, [[-TR, -TR], [TR, -TR], [TR, 0], [-TR, 0]], s > 0 ? 'front' : 'back');
  } else if (t < f2) {
    stack(g, C, [[-TR, 0], [TR, 0], [TR, TR], [-TR, TR]], 1);
    layer(g, C, [[-TR, 0], [TR, 0], [TR, TR], [-TR, TR]], 'back', { shadow: 1 });
  } else if (t < f2 + D) {
    const s = foldS((t - f2) / D);
    stack(g, C, [[0, 0], [TR, 0], [TR, TR], [0, TR]], 1);
    layer(g, C, [[0, 0], [TR, 0], [TR, TR], [0, TR]], 'back', { shadow: 1 });
    flap(g, C, [1, 0], s, [[-TR, 0], [0, 0], [0, TR], [-TR, TR]], s > 0 ? 'back' : 'front');
  } else if (t < f3) {
    stack(g, C, [[0, 0], [TR, 0], [TR, TR], [0, TR]], 3);
    layer(g, C, [[0, 0], [TR, 0], [TR, TR], [0, TR]], 'front', { shadow: 1 });
  } else if (t < f3 + D) {
    const s = foldS((t - f3) / D), n = [-Math.SQRT1_2, Math.SQRT1_2];
    stack(g, C, TRI, 3);
    layer(g, C, TRI, 'front', { shadow: 1 });
    flap(g, C, n, s, [[0, 0], [TR, TR], [0, TR]], s > 0 ? 'front' : 'back');
  } else if (t < TL.unfolds[0]) {
    // —— 剪 ——
    const u = cutU(t), tip = pathAt(u);
    // 已剪的部分 = 楔形剪纸（下面几层错开 = 厚度）；没剪的 = 整块三角（用蒙版遮住）
    g.save(); g.setTransform(...C); g.beginPath(); trace(g, TRI); g.clip(); paperShadow(g, z, 1);
    g.filter = 'brightness(.62)'; for (let i = 3; i >= 1; i--) g.drawImage(F.wBack.c, F.wBack.x0 + i * 1.1 / z, F.wBack.y0 + i * 1.4 / z, F.wBack.w, F.wBack.h);
    g.filter = 'none'; g.drawImage(F.wBack.c, F.wBack.x0, F.wBack.y0, F.wBack.w, F.wBack.h); g.restore();
    Mg.setTransform(1, 0, 0, 1, 0, 0); Mg.globalCompositeOperation = 'source-over'; Mg.clearRect(0, 0, 1920, 1080);
    stack(Mg, C, TRI, 4);
    Mg.save(); Mg.setTransform(...C); Mg.beginPath(); trace(Mg, TRI); Mg.clip(); Mg.drawImage(F.back.c, F.back.x0, F.back.y0, F.back.w, F.back.h); Mg.restore(); Mg.setTransform(...C);
    Mg.globalCompositeOperation = 'destination-out'; Mg.fillStyle = '#000'; Mg.beginPath();
    const n = Math.floor(tip.s / 10); for (let k = 0; k <= n; k++) { const q = pathAt(k * 10 / PL[PL.length - 1]).p; Mg.moveTo(q[0] + 62, q[1]); Mg.arc(q[0], q[1], 62, 0, 7); }
    Mg.fill();
    // 外缘花边剪过的角度之外的角料整块去掉
    const edgeLen = PL[11], thd = Math.min(1, tip.s / edgeLen) * Q * 1.02;
    if (thd > 0) { Mg.beginPath(); Mg.moveTo(900, -30); for (let i = 0; i <= 40; i++) { const a = -.05 + (thd + .05) * i / 40; Mg.lineTo(Math.cos(a) * (outerR(a) - 1), Math.sin(a) * (outerR(a) - 1)); } Mg.lineTo(Math.cos(thd) * 900, Math.sin(thd) * 900); Mg.closePath(); Mg.fill(); }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(Mc, 0, 0); g.restore();
    // 纸屑（每 0.25 s 一片，从刀尖飘开落下）
    drawScraps(g, C, t);
    // 剪刀：沿刀路，刃每 0.25 s 开合一次
    if (t < TL.cut1 + .35) {
      const ph = ((t - TL.cut0) / .25) % 1, open = t < TL.cut1 ? .1 + .42 * (.5 + .5 * Math.cos(ph * Math.PI * 2)) : .5;
      const lift = seg(t, TL.cut1, TL.cut1 + .35), p = tip.p;
      const ca = Math.cos(tip.ang), sa = Math.sin(tip.ang), bk = 22 * 1.75;
      drawScissors(g, mul(C, mul(T(p[0] - ca * bk + lift * 60, p[1] - sa * bk - lift * 160), S(1.75 * (1 + lift * .25)))), tip.ang, open, { shadow: 2.5 + lift * 3 });
    }
  } else {
    drawUnfold(g, C, t);
  }
  if (t >= f3 + D && t < TL.unfolds[0]) { } else if (t >= TL.unfolds[0]) drawScraps(g, C, t);
  return C;
}
function drawScraps(g, C, t) {
  const n = Math.floor((Math.min(t, TL.cut1) - TL.cut0) / .25);
  for (let k = 0; k < n; k++) {
    const t0 = TL.cut0 + k * .25, u = Math.min(1, (t - t0) / .7), tip = pathAt(cutU(t0)).p;
    const dir = hash(k * 3.1) * 6.28, dist = 90 + hash(k * 7.7) * 160;
    const x = tip[0] + Math.cos(dir) * dist * eo(u) + 40, y = tip[1] + Math.sin(dir) * dist * eo(u) + 60 * eo(u);
    const rot = (hash(k) - .5) * 6 * eo(u) + k, sc = 1 + .5 * Math.sin(u * Math.PI) ;
    const sz = 10 + hash(k * 5.3) * 16;
    g.save(); g.setTransform(...mul(C, mul(T(x, y), mul(R(rot), S(sc))))); paperShadow(g, C[0], 1 + 3 * Math.sin(u * Math.PI));
    g.beginPath(); g.moveTo(-sz, -sz * .3); g.lineTo(sz * .8, -sz * .6); g.lineTo(sz * .3, sz * .7); g.closePath(); g.fillStyle = k % 3 ? BACK : FRONT; g.fill(); g.restore();
  }
}
// 展开：楔形 8 份（D4），按三次展开逐步翻开
function drawUnfold(g, C, t) {
  const [u1, u2, u3] = TL.unfolds, Dd = .2;
  const sOf = t0 => t < t0 ? -1 : t > t0 + Dd ? 1 : -Math.cos(Math.PI * eo((t - t0) / Dd));
  const sA = sOf(u1), sB = sOf(u2), sC = sOf(u3);
  const Rx = [-1, 0, 0, 1, 0, 0], Ry = [1, 0, 0, -1, 0, 0];
  const n1 = [-Math.SQRT1_2, Math.SQRT1_2];
  // 第一次展开：W0 + 对角翻开的 W1
  const copies = [];
  const push = (M, s) => copies.push({ M, s });
  const flapA = flapM(n1, sA);
  const L1 = [[D4[0], 1], [mul(flapA, D4[0]), sA]];
  // 翻开 = 镜像版本从折叠位置转开：W1 = 对角镜像，flapM 作用于 W0 的镜像（swap）
  const baseSet = [{ M: D4[0], s: 1 }, { M: mul(flapA, D4[1]), s: sA }];
  const fB = flapM([1, 0], sB), fC = flapM([0, 1], sC);
  let set = baseSet;
  if (t >= u2) set = set.concat(baseSet.map(c => ({ M: mul(fB, mul(Rx, c.M)), s: sB })));
  if (t >= u3) set = set.concat(set.map(c => ({ M: mul(fC, mul(Ry, c.M)), s: sC })));
  // 未展开到的层叠厚度
  const bloomHi = t > TL.bloom - .03 ? .35 * Math.exp(-(t - TL.bloom) * 4) : 0;
  const nl = t < u2 ? 4 : t < u3 ? 2 : 0;
  // 先画翻开中的（s<1）在上面
  const sorted = set.slice().sort((a, b) => (b.s > .999) - (a.s > .999));
  for (const c of sorted) {
    const w = c.s < 0 ? F.wBack : F.wFront, M = mul(C, c.M);
    g.save(); g.setTransform(...M); paperShadow(g, C[0], 1 + 4 * (1 - Math.abs(c.s)));
    g.drawImage(w.c, w.x0, w.y0, w.w, w.h); g.restore();
  }
  if (bloomHi > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(960, 540, 0, 960, 540, 700); gr.addColorStop(0, `rgba(255,210,150,${bloomHi})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); g.restore(); }
}
