// 团花：8 层折叠剪（D4 对称）。只设计一个 45° 楔形，再镜像 8 次——折纸 / 展开动画用的也是同一个楔形。
// 单位：半径 R = 400；原点 = 纸中心；楔形 θ ∈ [0, π/4]（canvas y 向下，θ 顺时针）
import { PAL, canvas, piece, finishPaper, fill, cut, cutTaper, trace, curve } from './paper.js';
import { sawRow, crescent, crescentPts, swirl, plum, rosette, dots, along } from './motifs.js';

export const TR = 400;
const Q = Math.PI / 4;
const pol = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
// 外轮廓：16 瓣花边 + 细锯齿
export function outerR(a) { const k = Math.abs(Math.cos(a * 8)); return TR * (.9 + .1 * Math.pow(k, .6)); }
function wedgePoly(m = .012) {
  const pts = [[0, 0]];
  for (let i = 0; i <= 90; i++) { const a = -m + (Q + 2 * m) * i / 90; pts.push(pol(outerR(a), a)); }
  return pts;
}
// 楔形里的全部剪纹（在 fill 之后调用）。中圈是阳刻（剪空、只留红线网），内外圈是阴刻（红面上剪孔）
export function wedgeCuts(g, opt = {}) {
  const R = TR, mid = Q / 2, col = g.__col || PAL.red;
  const red = (w, fn) => { g.save(); g.globalCompositeOperation = 'source-over'; g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); fn(g); g.stroke(); g.restore(); };
  const redFill = fn => { g.save(); g.globalCompositeOperation = 'source-over'; g.fillStyle = col; g.beginPath(); fn(g); g.fill(); g.restore(); };
  const arcPts = (r, a0, a1, n = 24) => { const o = []; for (let i = 0; i <= n; i++) o.push(pol(r, a0 + (a1 - a0) * i / n)); return o; };
  // —— 花心：八瓣（×8）+ 中心孔 + 一圈小三角孔
  cut(g, q => {
    const P = (u, v) => [Math.cos(mid) * u - Math.sin(mid) * v, Math.sin(mid) * u + Math.cos(mid) * v];
    q.moveTo(...P(R * .045, 0)); q.quadraticCurveTo(...P(R * .12, R * .075), ...P(R * .21, 0)); q.quadraticCurveTo(...P(R * .12, -R * .075), ...P(R * .045, 0));
  });
  cut(g, q => { q.moveTo(R * .026, 0); q.arc(0, 0, R * .026, 0, Math.PI * 2); });
  for (const a of [Q * .18, Q * .82]) cut(g, q => { const p0 = pol(R * .16, a); q.moveTo(...p0); q.arc(...p0, R * .018, 0, 7); });
  cut(g, q => trace(q, crescentPts(0, 0, R * .29, mid - .32, mid + .32, R * .05, 16)));
  for (const a of [0, Q]) cut(g, q => trace(q, crescentPts(0, 0, R * .29, a - .12, a + .12, R * .03, 8)));
  sawRow(g, curve([pol(R * .335, -.02), pol(R * .335, mid), pol(R * .335, Q + .02)], false, 2), R * .045, R * .02, -1, .72);
  // —— 中圈：整带剪空，再留红线（阳刻）
  const r0 = R * .38, r1 = R * .69;
  cut(g, q => { const A = arcPts(r0, -.05, Q + .05), B = arcPts(r1, Q + .05, -.05); trace(q, A.concat(B)); });
  red(R * .016, q => { trace(q, arcPts(r0 + R * .006, -.05, Q + .05), false); });
  red(R * .016, q => { trace(q, arcPts(r1 - R * .006, -.05, Q + .05), false); });
  // 环边上的红锯齿（齿尖朝空处）
  for (const [r, s] of [[r0 + R * .012, 1], [r1 - R * .012, -1]]) {
    const S = along(arcPts(r, -.03, Q + .03, 40), R * .03);
    redFill(q => { for (let i = 0; i < S.length - 1; i++) { const A = S[i], B = S[i + 1], m = [(A.x + B.x) / 2, (A.y + B.y) / 2], d = Math.hypot(m[0], m[1]), n = [m[0] / d * s, m[1] / d * s]; q.moveTo(A.x, A.y); q.lineTo(B.x, B.y); q.lineTo(m[0] + n[0] * R * .032, m[1] + n[1] * R * .032); q.closePath(); } });
  }
  // 折线上的如意云卷（红线，镜像后成对）
  for (const [a, dir] of [[0, 1], [Q, -1]]) {
    const c = pol(R * .535, a), pts = [], n = 60;
    for (let i = 0; i <= n; i++) { const u = i / n, an = a + dir * (Math.PI * .5 + u * Math.PI * 2.1), rr = R * .085 * (1 - u * .85); pts.push([c[0] + Math.cos(an) * rr, c[1] + Math.sin(an) * rr]); }
    red(R * .014, q => trace(q, pts, false));
    red(R * .014, q => { const s0 = pts[0]; q.moveTo(...s0); q.lineTo(...pol(r1 - R * .01, a)); });
    red(R * .014, q => { const p1 = pol(R * .535 - R * .085, a); q.moveTo(...p1); q.lineTo(...pol(r0 + R * .01, a)); });
  }
  // 灯笼（红面 + 肋间开窗），上挂绳连内环，下流苏连外环
  lanternPos(g, R * .535, mid, R * .2, R * .15, col, red, redFill);
  // 小梅花（红）点缀在灯笼两侧
  for (const a of [mid - .24, mid + .24]) { const c = pol(R * .6, a); redFill(q => { for (let k = 0; k < 5; k++) { const an = k * Math.PI * 2 / 5, p = [c[0] + Math.cos(an) * R * .016, c[1] + Math.sin(an) * R * .016]; q.moveTo(p[0] + R * .014, p[1]); q.arc(p[0], p[1], R * .014, 0, 7); } }); cut(g, q => q.arc(c[0], c[1], R * .007, 0, 7)); red(R * .008, q => { q.moveTo(...c); q.lineTo(...pol(R * .64, a + (a < mid ? .08 : -.08))); }); }
  // —— 外圈：每瓣一把放射叶脉 + 月牙
  for (const pa of [Q * .25, Q * .75]) {
    const base = pol(R * .72, pa);
    for (let k = -3; k <= 3; k++) { const an = pa + k * .055, L = R * (.13 - Math.abs(k) * .012); const p0 = pol(R * .735, pa + k * .02), p1 = [p0[0] + Math.cos(an) * L, p0[1] + Math.sin(an) * L], pm = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]; cutTaper(g, [p0, pm, p1], R * .022); }
    cut(g, q => trace(q, crescentPts(...pol(R * .74, pa), R * .06, pa + Math.PI - 1.1, pa + Math.PI + 1.1, R * .02, 10)));
  }
  for (const a of [0, Q]) plum(g, ...pol(R * .8, a), R * .032, a);
  plum(g, ...pol(R * .79, mid), R * .026, mid);
  // 外缘细锯齿
  const edge = []; for (let i = 0; i <= 60; i++) { const a = -.01 + (Q + .02) * i / 60; edge.push(pol(outerR(a) - R * .03, a)); }
  sawRow(g, edge, R * .026, R * .016, 1, .7);
}
// 阳刻灯笼：红色灯身（肋间开窗）+ 灯帽 + 挂绳 + 流苏
function lanternPos(g, r, a, h, w, col, red, redFill) {
  const c = pol(r, a), ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const P = (u, v) => [c[0] + ux * u + vx * v, c[1] + uy * u + vy * v];
  const body = []; for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2; body.push(P(Math.cos(t) * h * .5, Math.sin(t) * w * .5)); }
  redFill(q => trace(q, body));
  // 肋间开窗：4 条月牙形竖窗
  for (const v of [-.36, -.12, .12, .36]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const u = -h * .38 + h * .76 * i / 16, b = Math.sqrt(Math.max(0, 1 - (u / (h * .5)) ** 2)); pts.push(P(u, v * w * b)); }
    cutTaper(g, pts, w * .13);
  }
  // 灯帽
  redFill(q => { const A = P(-h * .5 - h * .07, -w * .24), B = P(-h * .5 - h * .07, w * .24), C = P(-h * .5 + h * .03, w * .3), D = P(-h * .5 + h * .03, -w * .3); q.moveTo(...A); q.lineTo(...B); q.lineTo(...C); q.lineTo(...D); q.closePath(); });
  redFill(q => { const A = P(h * .5 + h * .07, -w * .2), B = P(h * .5 + h * .07, w * .2), C = P(h * .5 - h * .03, w * .28), D = P(h * .5 - h * .03, -w * .28); q.moveTo(...A); q.lineTo(...B); q.lineTo(...C); q.lineTo(...D); q.closePath(); });
  // 挂绳（到内环）与流苏（到外环）
  red(w * .08, q => { q.moveTo(...P(-h * .56, 0)); q.lineTo(...pol(TR * .385, a)); });
  red(w * .07, q => { q.moveTo(...P(h * .56, 0)); q.lineTo(...pol(TR * .685, a)); });
  for (const v of [-.14, .14]) red(w * .05, q => { q.moveTo(...P(h * .58, 0)); q.lineTo(...P(h * .78, v * w)); });
}
// 平面红楔形贴图（无纹理，用于合成）
const CACHE = {};
export function wedgeFlat(K = 2.4, col = PAL.red) {
  const key = K + col; if (CACHE[key]) return CACHE[key];
  const p = piece([-10, -10, TR + 10, TR * .75 + 10], g => {
    g.__col = col;
    fill(g, q => trace(q, wedgePoly()), col);
    wedgeCuts(g);
    g.save(); g.globalCompositeOperation = 'destination-in'; g.beginPath(); trace(g, wedgePoly(.012)); g.fill(); g.restore();
  }, { ss: K, tex: false, edge: 0, col });
  CACHE[key] = p; return p;
}
// D4 的 8 个变换（作用在楔形上）：R(kπ/2) 和 R(kπ/2)·镜像(沿 π/4)
export const D4 = [];
for (let k = 0; k < 4; k++) { const c = Math.round(Math.cos(k * Math.PI / 2)), s = Math.round(Math.sin(k * Math.PI / 2)); D4.push([c, s, -s, c, 0, 0]); D4.push([c * 0 + -s * 1, s * 0 + c * 1, c * 1 + -s * 0, s * 1 + c * 0, 0, 0]); }
// 整张团花（带纹理、刀口）：返回 piece 形式，中心在原点
export function tuanhua(K = 2.4, col = PAL.red, seed = 61) {
  const key = 'full' + K + col; if (CACHE[key]) return CACHE[key];
  const W = TR * 2 + 20, [c, g] = canvas(W * K, W * K), w = wedgeFlat(K, col);
  for (const M of D4) {
    g.setTransform(K, 0, 0, K, W * K / 2, W * K / 2); g.transform(...M);
    g.drawImage(w.c, w.x0, w.y0, w.w, w.h);
  }
  finishPaper(c, g, { seed });
  const p = { c, x0: -W / 2, y0: -W / 2, w: W, h: W, K, col };
  CACHE[key] = p; return p;
}
// 孔蒙版（圆内的孔 = 白，纸 = 透明，圆外 = 透明）——投影光、辉光用
export function tuanhuaHoles(K = 1.2) {
  const key = 'holes' + K; if (CACHE[key]) return CACHE[key];
  const t = tuanhua(K), [c, g] = canvas(t.c.width, t.c.height);
  g.setTransform(K, 0, 0, K, -t.x0 * K, -t.y0 * K);
  g.beginPath(); for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2, r = outerR(a) - 2; const p = pol(r, a); if (i) g.lineTo(...p); else g.moveTo(...p); } g.fillStyle = '#fff'; g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out'; g.drawImage(t.c, 0, 0);
  const p = { c, x0: t.x0, y0: t.y0, w: t.w, h: t.h }; CACHE[key] = p; return p;
}
