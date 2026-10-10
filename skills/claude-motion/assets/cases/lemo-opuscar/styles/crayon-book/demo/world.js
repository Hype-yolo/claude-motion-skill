// 这一页画：孩子式透视的房子、树、草地、梯子、白蜡星星、水彩刷痕。世界坐标 3200×1800（整页 = CAM s 0.6）
import { line, fill, dab, ellipse, handCircle, smooth, text, sx, sy, CAM, W, H } from './crayon.js';
import { part, curve } from './rig.js';
import { star } from './chars.js';
import { PAL } from './pal.js';
import { hash, clamp, lerp, mulberry } from '/core/lib.js';
const K = PAL.crayon;
export const WORLD = { W: 3200, H: 1800 };
export const pr = (t, a, b) => clamp((t - a) / (b - a));

// 房子几何
export const HOUSE = {
  A: [1100, 1050], B: [1720, 1010], Cc: [1950, 1318], D: [1320, 1360], Le: [870, 1360],
  wallL: 900, wallR: 1300, wallTop: 1345, ground: 1640, sideR: 1900,
};
export const ridgeY = x => 1050 - (x - 1100) * 40 / 620;
export const MOON = { x: 2450, y: 560, R: 240 };
export const WIN = [[1440, 1420], [1680, 1406], [1680, 1592], [1440, 1602]];
export const LAD = { l0: [1745, 1640], l1: [1760, 1296], r0: [1825, 1640], r1: [1840, 1292], rung: i => 1598 - i * 44 };
const lerp2 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];

// p: 各部分的画出进度 {hl: 房子线, hf: 房子色, tl, tf, gl, gf, wf(窗)}
export function drawWorld(F, L, p) {
  const bo = 0.6;
  const H_ = HOUSE;
  // 草地
  const gtop = []; for (let x = -60; x <= 3260; x += 80) gtop.push([x, 1618 + 14 * Math.sin(x * 0.013) + 10 * hash(x)]);
  const ground = [...gtop, [3260, 1860], [-60, 1860]];
  fill(F, ground, { col: K.green, p: 0.7, gap: 12, w: 13, ang: 1.25, seed: 11, draw: p.gf, boil: 0, over: 10 });
  line(L, gtop.filter(q => q[0] < 880), { w: 7, seed: 12, draw: p.gl, boil: bo, col: K.green, p: 0.95 }); line(L, gtop.filter(q => q[0] > 1900), { w: 7, seed: 13, draw: p.gl, boil: bo, col: K.green, p: 0.95 });
  for (let i = 0; i < 26; i++) { const x = 60 + i * 124 + hash(i) * 60, y = 1668 + hash(i + 3) * 100; if (x > 860 && x < 1960 && y < 1680) continue; line(L, [[x - 10, y + 8], [x - 4, y - 14], [x + 2, y + 6], [x + 9, y - 12], [x + 14, y + 8]], { w: 4.5, seed: 20 + i, col: K.green, p: 0.9 * p.gf, boil: bo, draw: p.gf }); }
  if (p.gf > 0.5) [[260, 1700, K.pink], [680, 1730, K.yellow], [2240, 1712, K.pink], [2720, 1690, K.yellow], [3020, 1735, K.pink]].forEach(([x, y, c], i) => {
    line(L, [[x, y + 40], [x + 2, y + 8]], { w: 5, col: K.green, seed: 60 + i, boil: bo });
    for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; dab(F, x + Math.cos(a) * 11, y + Math.sin(a) * 11, 8, { col: c, p: 0.85, seed: 70 + i * 5 + k, boil: 0 }); }
    dab(F, x, y, 6, { col: K.orange, p: 0.9, seed: 99 + i, boil: 0 });
  });
  // 树
  const trunk = [[505, 1640], [500, 1420], [560, 1420], [556, 1640]];
  fill(F, trunk, { col: K.brown, p: 0.8, gap: 9, w: 11, ang: 1.5, seed: 30, draw: p.tf, boil: 0 });
  line(L, [[505, 1642], [502, 1430]], { w: 7, seed: 31, draw: p.tl, boil: bo }); line(L, [[556, 1642], [558, 1430]], { w: 7, seed: 32, draw: p.tl, boil: bo });
  const crown = []; for (let i = 0; i <= 72; i++) { const a = i / 72 * 6.283; const b = 1 + 0.09 * Math.abs(Math.sin(a * 4.5)); crown.push([530 + Math.cos(a) * 185 * b, 1290 + Math.sin(a) * 165 * b]); }
  fill(F, crown, { col: K.green, p: 0.72, gap: 12, w: 14, ang: 0.8, seed: 33, draw: p.tf, boil: 0, cross: true, crossP: 0.4 });
  line(L, crown, { w: 7.5, seed: 34, draw: p.tl, boil: bo });
  if (p.tf > 0.7) [[460, 1230], [600, 1270], [520, 1360], [640, 1180], [420, 1330]].forEach(([x, y], i) => dab(F, x, y, 13, { col: K.red, p: 0.85, seed: 40 + i, boil: 0 }));
  // 侧墙
  const side = [[H_.wallR, H_.wallTop + 8], [H_.sideR, H_.wallTop - 28], [H_.sideR, H_.ground], [H_.wallR, H_.ground]];
  fill(F, side, { col: K.ochre, p: 0.8, gap: 10, w: 12, ang: 0.3, seed: 50, draw: p.hf, boil: 0, cross: true, crossP: 0.5 });
  // 山墙（正面）
  const gable = [[H_.wallL, H_.ground], [H_.wallL, H_.wallTop], H_.A, [H_.wallR, H_.wallTop], [H_.wallR, H_.ground]];
  fill(F, gable, { col: K.ochre, p: 0.82, gap: 10, w: 12, ang: -0.5, seed: 51, draw: p.hf, boil: 0, cross: true, crossP: 0.5 });
  // 屋顶面
  const roof = [H_.A, H_.B, H_.Cc, H_.D];
  fill(F, roof, { col: K.red, p: 0.78, gap: 11, w: 13, ang: 0.62, seed: 52, draw: p.hf, boil: 0 });
  // 山墙屋檐边（红色宽边）
  const eaveL = [H_.Le, H_.A, H_.D, [H_.D[0] - 30, H_.D[1] + 4], [H_.A[0], H_.A[1] + 36], [H_.Le[0] + 30, H_.Le[1] + 4]];
  fill(F, eaveL, { col: K.red, p: 0.85, gap: 7, w: 9, ang: 1.3, seed: 53, draw: p.hf, boil: 0 });
  // 烟囱
  const chim = [[1212, 928], [1294, 928], [1294, 1072], [1212, 1082]];
  part({ k: F, f: F, l: L, noKnock: true }, chim, { col: K.brown, p: 0.8, gap: 8, w: 10, ang: 1.5, seed: 54, draw: p.hf, boil: 0 }, null, { occ: false, kn: false });
  fill(F, [[1200, 912], [1306, 912], [1306, 940], [1200, 940]], { col: K.red, p: 0.9, gap: 6, w: 8, seed: 55, draw: p.hf, boil: 0 });
  // 门、阁楼圆窗
  const door = [[1058, 1640], [1058, 1512], [1080, 1494], [1128, 1494], [1150, 1512], [1150, 1640]];
  fill(F, door, { col: K.brown, p: 0.85, gap: 8, w: 10, ang: 1.45, seed: 56, draw: p.hf, boil: 0 });
  fill(F, ellipse(1100, 1210, 44, 44, 30), { col: K.sky, p: 0.7, gap: 7, w: 9, seed: 57, draw: p.hf, boil: 0 });
  // 窗（亮着暖黄的灯）
  fill(F, WIN, { col: K.yellow, p: 0.9, gap: 8, w: 11, ang: 0.4, seed: 58, draw: p.wf, boil: 0, cross: true, crossP: 0.6 });
  if (p.wf > 0.6) {
    fill(F, [[1446, 1424], [1500, 1422], [1470, 1520], [1446, 1560]], { col: K.pink, p: 0.85, gap: 6, w: 8, seed: 59, boil: 0 });
    fill(F, [[1674, 1410], [1620, 1412], [1650, 1510], [1674, 1550]], { col: K.pink, p: 0.85, gap: 6, w: 8, seed: 60, boil: 0 });
  }
  // —— 线 ——
  const hl = p.hl;
  line(L, [H_.Le, H_.A, H_.D], { w: 8, seed: 80, draw: hl, boil: bo });
  line(L, [H_.A, H_.B, H_.Cc, H_.D], { w: 8, seed: 81, draw: pr(hl, 0.1, 1), boil: bo });
  line(L, [[H_.wallL, H_.wallTop + 2], [H_.wallL, H_.ground]], { w: 8, seed: 82, draw: pr(hl, 0.2, 1), boil: bo });
  line(L, [[H_.wallR, H_.wallTop + 10], [H_.wallR, H_.ground]], { w: 8, seed: 83, draw: pr(hl, 0.25, 1), boil: bo });
  line(L, [[H_.sideR, H_.wallTop - 26], [H_.sideR, H_.ground]], { w: 8, seed: 84, draw: pr(hl, 0.3, 1), boil: bo });
  line(L, [[H_.wallL - 20, H_.ground], [H_.sideR + 20, H_.ground]], { w: 8, seed: 85, draw: pr(hl, 0.35, 1), boil: bo });
  line(L, [...chim, chim[0]], { w: 7, seed: 86, draw: pr(hl, 0.4, 1), boil: bo });
  line(L, [[1200, 912], [1306, 912], [1306, 940], [1200, 940], [1200, 912]], { w: 6, seed: 87, draw: pr(hl, 0.45, 1), boil: bo });
  line(L, door, { w: 7, seed: 88, draw: pr(hl, 0.5, 1), boil: bo });
  if (hl > 0.7) dab(L, 1136, 1575, 6, { col: K.yellow, p: 1, seed: 89, boil: bo });
  line(L, handCircle(1100, 1210, 44, 90), { w: 7, seed: 90, draw: pr(hl, 0.55, 1), boil: bo });
  line(L, [[1058, 1210], [1142, 1210]], { w: 5, seed: 91, draw: pr(hl, 0.6, 1), boil: bo }); line(L, [[1100, 1168], [1100, 1252]], { w: 5, seed: 92, draw: pr(hl, 0.62, 1), boil: bo });
  line(L, [...WIN, WIN[0]], { w: 8, seed: 93, draw: pr(hl, 0.6, 1), boil: bo });
  line(L, [[1430, 1606], [1690, 1596]], { w: 9, seed: 94, draw: pr(hl, 0.7, 1), boil: bo, col: K.brown });
  // 屋瓦：几排小圆弧（沿屋檐方向）
  if (p.hf > 0.5) for (let r = 1; r <= 4; r++) {
    const u = r / 5; const a = lerp2(H_.A, H_.D, u), b = lerp2(H_.B, H_.Cc, u);
    const n = 9; for (let i = 0; i < n; i++) { const q0 = lerp2(a, b, i / n), q1 = lerp2(a, b, (i + 1) / n); const m = [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2 + 16]; line(L, [q0, m, q1], { w: 4, seed: 100 + r * 10 + i, col: K.brown, p: 0.55, boil: bo, taper: 0.3 }); }
  }
  // 砖缝
  if (p.hf > 0.5) [[1212, 980, 1294, 980], [1212, 1030, 1294, 1030], [1250, 940, 1250, 980], [1235, 980, 1235, 1030], [1270, 1030, 1270, 1076]].forEach(([a, b, c, d], i) => line(L, [[a, b], [c, d]], { w: 3.5, seed: 150 + i, col: K.ink, p: 0.5, boil: bo }));
}

// 梯子：rungs = 已画出的横档数（可带小数，最后一格正在画）
export function drawLadder(F, L, rungs, rail) {
  if (rail <= 0) return;
  const bo = 0.8;
  const top = Math.min(1, rail);
  line(L, [LAD.l0, lerp2(LAD.l0, LAD.l1, top)], { w: 8, col: K.brown, seed: 170, boil: bo, p: 0.95 });
  line(L, [LAD.r0, lerp2(LAD.r0, LAD.r1, top)], { w: 8, col: K.brown, seed: 171, boil: bo, p: 0.95 });
  for (let i = 0; i < 8; i++) {
    const d = clamp(rungs - i); if (d <= 0) break;
    const y = LAD.rung(i); const u = (1640 - y) / (1640 - 1294);
    const a = lerp2(LAD.l0, LAD.l1, u), b = lerp2(LAD.r0, LAD.r1, u);
    line(L, [[a[0] - 6, a[1] + 2], [b[0] + 6, b[1]]], { w: 7.5, col: K.brown, seed: 180 + i, boil: bo, draw: d });
  }
}

// 白蜡星星：确定性分布
const RNG = mulberry(4242);
export const STARS = [];
for (let n = 0; STARS.length < 250 && n < 5000; n++) {
  const x = 40 + RNG() * 3120, y = 30 + RNG() * 1250, r = RNG(), sz = RNG();
  if (Math.hypot(x - MOON.x, y - MOON.y) < MOON.R + 80) continue;
  if (x > 50 && x < 820 && y > 60 && y < 400) continue;             // 片名
  if (x > 830 && x < 1990 && y > 900) continue;                      // 房子
  if (Math.hypot(x - 530, y - 1290) < 250) continue;                 // 树
  if (y > 1180 && (x < 820 || x > 1990) && RNG() < 0.5) continue;
  if (STARS.some(s => Math.hypot(s.x - x, s.y - y) < 55)) continue;
  STARS.push({ x, y, big: sz < 0.42, r: sz < 0.42 ? 11 + r * 13 : 4 + r * 4, rot: RNG() * 1.2, seed: 500 + n });
}
export function drawStars(G) {
  for (const s of STARS) {
    if (s.big) star(G, [s.x, s.y], s.r, s.seed, s.rot, K.white, false);
    else dab(G.f, s.x, s.y, s.r, { col: K.white, p: 1, seed: s.seed, gap: 3, w: 4, over: 0.5, boil: 0.25 });
  }
}

// 水彩刷痕：三道横扫。t 是片内时间
export const BANDS = [
  { y0: -120, y1: 640, t0: 27.9, t1: 29.9, dir: 1, seed: 1 },
  { y0: 540, y1: 1090, t0: 30.0, t1: 32.1, dir: -1, seed: 2 },
  { y0: 990, y1: 1655, t0: 32.5, t1: 34.7, dir: 1, seed: 3 },
];
const X0 = -260, X1 = 3460;
export function bandFront(b, t) { const u = clamp((t - b.t0) / (b.t1 - b.t0)); const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; const v = 0.15 * u + 0.85 * e; return b.dir > 0 ? lerp(X0, X1, v) : lerp(X1, X0, v); }
export function drawWash(LW, t) {
  const g = LW.g; g.save();
  g.setTransform(CAM.s, 0, 0, CAM.s, W / 2 - CAM.x * CAM.s, H / 2 - CAM.y * CAM.s);
  for (const b of BANDS) {
    if (t < b.t0) continue;
    const f = bandFront(b, t), moving = t < b.t1;
    const top = [], bot = [];
    for (let x = X0; x <= X1; x += 40) {
      top.push([x, b.y0 + 12 * (Math.sin(x * 0.006 + b.seed) + 0.6 * Math.sin(x * 0.017 + b.seed * 3)) + 12 * hash(x * 0.37 + b.seed)]);
      bot.push([x, b.y1 + 14 * (Math.sin(x * 0.005 + b.seed * 2) + 0.5 * Math.sin(x * 0.019 + b.seed)) + 14 * hash(x * 0.71 + b.seed)]);
    }
    // 刷子前沿：中间鼓出来的弧
    const frontX = y => f + b.dir * 70 * Math.sin(clamp((y - b.y0) / (b.y1 - b.y0)) * Math.PI) + 12 * Math.sin(y * 0.05);
    g.save();
    g.beginPath();
    if (b.dir > 0) { g.moveTo(X0 - 50, b.y0 - 200); for (let y = b.y0 - 200; y <= b.y1 + 200; y += 20) g.lineTo(frontX(y), y); g.lineTo(X0 - 50, b.y1 + 200); }
    else { g.moveTo(X1 + 50, b.y0 - 200); for (let y = b.y0 - 200; y <= b.y1 + 200; y += 20) g.lineTo(frontX(y), y); g.lineTo(X1 + 50, b.y1 + 200); }
    g.closePath(); g.clip();
    const shape = new Path2D(); top.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); for (let i = bot.length - 1; i >= 0; i--) shape.lineTo(bot[i][0], bot[i][1]); shape.closePath();
    g.fillStyle = '#000'; g.globalAlpha = 0.8; g.fill(shape);
    g.save(); g.clip(shape);
    // 鬃毛条纹：沿刷子方向的深浅
    const R = mulberry(b.seed * 97);
    for (let i = 0; i < 26; i++) {
      const yy = lerp(b.y0, b.y1, R()), wdt = 6 + R() * 30, dark = R() < 0.55;
      g.beginPath(); for (let x = X0; x <= X1; x += 60) { const y = yy + 14 * Math.sin(x * 0.002 + i) + 6 * Math.sin(x * 0.01 + i * 2); x === X0 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.lineWidth = dark ? wdt : wdt * 0.5; g.globalCompositeOperation = dark ? 'source-over' : 'destination-out'; g.globalAlpha = dark ? 0.14 + R() * 0.12 : 0.05 + R() * 0.07; g.strokeStyle = '#000'; g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    // 湿前沿：颜料堆在刷子停下/经过的边缘
    g.beginPath(); for (let y = b.y0 - 80; y <= b.y1 + 80; y += 16) { const x = frontX(y) - b.dir * 14; y === b.y0 - 80 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.lineWidth = moving ? 34 : 22; g.globalAlpha = moving ? 0.3 : 0.14; g.stroke();
    g.restore(); g.restore();
  }
  g.restore();
}
