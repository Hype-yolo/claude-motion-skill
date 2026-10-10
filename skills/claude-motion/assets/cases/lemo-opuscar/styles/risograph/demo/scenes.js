// 场景背景（分版绘制）。每个函数只画背景层，人物由镜头脚本叠加。
import { g, W, H, rect, rrect, poly, blob, line, curve, circle, ellipse, over, inkA, ring } from './draw.js';
import { mulberry, hash } from '/core/lib.js';

// 分段色带天空：从地平线往上，一层层网点带（riso 做渐变常用阶梯）
export function bands(y0, y1, cols) {
  const n = cols.length, h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) rect(0, y1 - (i + 1) * h - 1, W, h + 2, cols[i]);
}

// ───────── 河边 ─────────
// 构图规则（Haugomat）：一条地平线、一个太阳、一个人；每块区域最多两版、最多一版用网点
// o: { cx 镜头横移量(px), sunX, sunY, sunR }
export const RIVER = { horizon: 700, quay: 985 };
function town(seed, n, x0, x1, base, hmin, hmax) {   // 远景屋顶剪影（坡顶、烟囱、圆顶、尖塔）
  const R = mulberry(seed), out = [];
  let x = x0;
  while (x < x1) {
    const w = 40 + R() * 80, h = hmin + R() * (hmax - hmin), k = R();
    out.push({ x, w, h, k, c: R() }); x += w + (R() < .2 ? 10 + R() * 30 : -2);
  }
  return out;
}
const TOWN = town(11, 0, -300, 2600, 0, 18, 62);
function townPath(cx, HZ, par) {
  g.beginPath();
  for (const b of TOWN) {
    const X = b.x - cx * par, top = HZ - b.h;
    if (X > W + 200 || X + b.w < -200) continue;
    g.moveTo(X, HZ + 2); g.lineTo(X, top);
    if (b.k < .35) { g.lineTo(X + b.w / 2, top - b.w * .45); g.lineTo(X + b.w, top); }          // 坡顶
    else if (b.k < .45) { g.arc(X + b.w / 2, top, b.w / 2, Math.PI, 0); }                    // 圆顶
    else if (b.k < .52) { g.lineTo(X + b.w * .42, top); g.lineTo(X + b.w * .5, top - 90); g.lineTo(X + b.w * .58, top); g.lineTo(X + b.w, top); } // 尖塔
    else { g.lineTo(X + b.w, top); }
    g.lineTo(X + b.w, HZ + 2); g.closePath();
    if (b.c < .5) g.rect(X + b.w * .2, top - (b.k < .35 ? b.w * .3 : 0) - 16, 9, 18);           // 烟囱
  }
}
export function river(o = {}) {
  const cx = o.cx || 0, HZ = o.hz ?? RIVER.horizon, QY = o.quay ?? RIVER.quay;
  // 天空：只用黄版，四级色带
  bands(0, HZ, [[0, 1, 0], [0, .62, 0], [0, .38, 0], [0, .2, 0]]);
  // 太阳：荧光粉实地，挖掉黄
  const sx = (o.sunX ?? 1000) - cx * .04, sy = o.sunY ?? 500, sr = o.sunR ?? 330;
  circle(sx, sy, sr, [0, 0, 1]);
  // 远岸屋顶：蓝版 55% 网点；与太阳重叠处叠印粉 → 紫
  townPath(cx, HZ, .12); g.fillStyle = inkA([.55, 0, 0]); g.fill();
  g.save(); g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.clip(); over(() => { townPath(cx, HZ, .12); g.fillStyle = inkA([0, 0, 1]); g.fill(); }); g.restore();
  // 左侧远处的桥（细，低于屋顶）
  const bx = 330 - cx * .2;
  g.beginPath(); g.moveTo(bx - 440, HZ - 46); g.lineTo(bx + 440, HZ - 46); g.lineTo(bx + 440, HZ);
  for (let i = 2; i >= -2; i--) { const ax = bx + i * 170; g.lineTo(ax + 64, HZ); g.arc(ax, HZ, 64, 0, Math.PI, true); }
  g.lineTo(bx - 440, HZ); g.closePath();
  g.fillStyle = inkA([1, 0, 0]); g.fill();
  for (let i = -2; i <= 3; i++) rect(bx + i * 170 - 85 - 3, HZ - 58, 6, 12, [1, 0, 0]);
  // 河水：黄实地 + 蓝 22% 网点（倒影由印刷层叠加）
  rect(0, HZ, W, QY - HZ, [.22, .85, 0]);
  const R2 = mulberry(3);
  for (let i = 0; i < 46; i++) {
    const u = Math.pow(R2(), 1.3), yy = HZ + 10 + u * (QY - HZ - 24);
    const xx = ((R2() * 2600 - cx * (.25 + u * .6)) % 2600 + 2600) % 2600 - 300, ww = 30 + R2() * 110 * (1 + u * 2);
    rect(xx, yy, ww, 3 + u * 4, [.75, .5, 0]);
  }
  // 近岸石堤：实地蓝 + 粉（深紫），顶上一道压顶石
  const wr = o.wallRow || 36;
  rect(0, QY, W, H - QY, [.85, 0, .8]);
  rect(0, QY, W, o.coping || 14, [.4, 0, .6]);
  for (let r = 0; r < Math.ceil((H - QY) / wr); r++) {
    const yy = QY + (o.coping || 14) + r * wr;
    for (let k = -1; k < 16; k++) { const xx = ((k * wr * 4.2 + (r % 2) * wr * 2.1 - cx) % 2400 + 2400) % 2400 - 150; rect(xx, yy + 4, 3, wr - 6, [.4, 0, .5]); }
    rect(0, yy + wr - 2, W, 3, [.4, 0, .5]);
  }
}

// 路灯（前景，视差 >1）
export function lamp(x, yb, h, on = 1) {
  line([[x, yb], [x, yb - h]], 9, [1, 0, .3]);
  curve([[x, yb - h], [x + 10, yb - h - 26], [x + 40, yb - h - 30]], 7, [1, 0, .3]);
  poly([[x + 26, yb - h - 30], [x + 58, yb - h - 30], [x + 52, yb - h - 12], [x + 32, yb - h - 12]], [1, 0, .3]);
  if (on) over(() => { g.beginPath(); g.arc(x + 42, yb - h - 8, 34, 0, 7); g.fillStyle = inkA([0, .7 * on, 0]); g.fill(); });
}

// ───────── 街道（蓝色清晨 → 面包店）─────────
// 世界坐标：x 连续；FB = 立面底，CURB = 路缘，RY = 骑行地面
export const ST = { FB: 872, CURB: 912, RY: 992, BAKERY_X: 2600 };
const FAC = [[0, .16, .06], [.16, 0, .22], [0, .08, .34], [.2, .16, .08], [0, .24, .2], [.1, .1, .04]];
function mkStreet() {
  const R = mulberry(21), out = []; let x = -500, i = 0;
  while (x < 7000) {
    const w = 300 + Math.floor(R() * 4) * 50, floors = 2 + Math.floor(R() * 1.8);
    const b = { x, w, floors, fac: FAC[i % FAC.length], roof: R() < .6 ? 'mansard' : 'flat', r: R(), lit: [], box: R() < .5, bal: R() < .4, gf: R() < .5 ? 'shutter' : 'door', cat: false };
    for (let k = 0; k < 20; k++) b.lit.push(R() < .18);
    if (Math.abs(x + w / 2 - ST.BAKERY_X) < w / 2 + 1) b.gf = 'bakery';
    out.push(b); x += w; i++;
  }
  out[3].cat = true;
  return out;
}
export const STREET = mkStreet();
export function bakeryBuilding() { return STREET.find(b => b.gf === 'bakery'); }
export function street(o = {}) {
  const cx = o.cx || 0, FB = ST.FB, light = o.light ?? 0, sun = o.sun ?? 0;
  // 天空：蓝版阶梯；地平线处黄（黄版上机后才看得见的晨光）
  bands(0, 640, [[0, .8, .12], [.12, .45, .06], [.2, .15, 0], [.3, 0, 0], [.4, 0, .05]]);
  // 太阳（面包店段升起，屋顶后）
  if (sun > 0) circle(1500 - cx * .05, 560 - sun * 190, 120, [0, 1, .15]);
  // 远处屋顶剪影（视差 .35）
  g.beginPath();
  for (let k = -2; k < 30; k++) { const X = k * 150 - (cx * .35) % 150, hh = 40 + (hash(k + Math.floor(cx * .35 / 150)) * 60); g.rect(X, 640 - hh, 152, hh + 20); }
  g.fillStyle = inkA([.5, 0, .12]); g.fill();
  // 建筑
  for (const b of STREET) {
    const X = b.x - cx; if (X > W + 50 || X + b.w < -50) continue;
    building(b, X, light);
  }
  // 人行道 + 路缘 + 石板路
  rect(0, FB, W, ST.CURB - FB, [.2, .12, .06]);
  rect(0, ST.CURB - 6, W, 10, [1, 0, .15]);
  rect(0, ST.CURB + 4, W, H - ST.CURB, [0, .08, .04]);
  for (let r = 0; r < 6; r++) {
    const yy = ST.CURB + 20 + r * 28 + r * r * 2, sp = 60 + r * 10;
    for (let k = -2; k < W / sp + 3; k++) { if (hash(k * 13 + r * 7 + Math.floor(cx / sp)) > .22) continue; const xx = k * sp - (cx % sp) + (r % 2) * sp / 2; g.beginPath(); g.arc(xx, yy + 12, sp * .42, Math.PI * 1.2, Math.PI * 1.8); g.lineWidth = 3; g.strokeStyle = inkA([1, .05, .15]); g.stroke(); }
  }
  // 路灯 + 行道树（人行道上）
  for (let k = -1; k < 14; k++) {
    const X = k * 620 + 180 - cx; if (X < -300 || X > W + 300) continue;
    lamp(X, ST.CURB - 8, 300, o.lamps ?? 1);
  }
}
function tree(x, yb, k) {
  line([[x, yb], [x, yb - 190]], 16, [.8, .15, .2]);
  const R = mulberry(k * 7 + 3);
  const pts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = 105 + R() * 30; pts.push([x + Math.cos(a) * r * 1.1, yb - 290 + Math.sin(a) * r * .85]); }
  blob(pts, [.42, .78, .06]);
  const pts2 = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = 60 + R() * 20; pts2.push([x - 28 + Math.cos(a) * r, yb - 320 + Math.sin(a) * r * .8]); }
  blob(pts2, [.28, .95, .12]);
}
function building(b, X, light) {
  const FB = ST.FB, fh = 118, gfh = 150, top = FB - gfh - b.floors * fh;
  // 屋顶
  if (b.roof === 'mansard') {
    poly([[X - 6, top], [X + b.w + 6, top], [X + b.w - 22, top - 70], [X + 22, top - 70]], [.72, 0, .14]);
    for (let d = 0; d < Math.floor(b.w / 90); d++) { const dx = X + 40 + d * 90; rect(dx, top - 60, 34, 46, [.72, 0, .14]); rect(dx + 6, top - 52, 22, 34, [1, 0, .25]); poly([[dx - 4, top - 60], [dx + 38, top - 60], [dx + 17, top - 80]], [.72, 0, .14]); }
    rect(X + b.w * .7, top - 104, 26, 40, [.72, 0, .14]);
  } else { rect(X, top - 16, b.w, 16, [.6, 0, .1]); rect(X + b.w * .2, top - 50, 22, 36, [.6, 0, .1]); }
  // 立面
  rect(X, top, b.w, FB - top, b.fac);
  rect(X, top, b.w, 10, [.55, 0, .1]);
  // 窗
  const nw = Math.max(2, Math.floor((b.w - 40) / 130)), sp = (b.w - 20) / nw;
  for (let f = 0; f < b.floors; f++) for (let k = 0; k < nw; k++) {
    const wx = X + 10 + sp * k + sp / 2 - 20, wy = top + 26 + f * fh;
    const lit = b.lit[(f * nw + k) % 20];
    rect(wx - 16, wy - 4, 14, 82, [.4, .65, 0]); rect(wx + 42, wy - 4, 14, 82, [.4, .65, 0]);   // 百叶（蓝 + 黄 = 绿）
    rect(wx, wy, 40, 76, lit ? [0, .9 * light + .0, .1 * light] : [1, 0, .22]);
    if (!lit || light < .5) line([[wx + 20, wy], [wx + 20, wy + 76]], 3, lit ? [.6, 0, .1] : [.35, 0, .05]);
    if (b.box && f === 0) { rect(wx - 4, wy + 76, 48, 12, [.7, .1, .3]); for (let q = 0; q < 5; q++) circle(wx + 2 + q * 9, wy + 72, 6, [0, .2, 1]); }
    if (b.bal && f === 1) { rect(wx - 18, wy + 70, 76, 5, [1, 0, .2]); for (let q = 0; q < 8; q++) line([[wx - 16 + q * 10, wy + 75], [wx - 16 + q * 10, wy + 96]], 2.5, [1, 0, .2]); rect(wx - 18, wy + 94, 76, 5, [1, 0, .2]); }
    if (b.cat && f === 0 && k === 1) catSil(wx + 20, wy + 76);
  }
  // 底层
  const gy = FB - gfh;
  rect(X, gy, b.w, 8, [.55, 0, .1]);
  if (b.gf === 'bakery') { bakeryFront(X, gy, b.w, light); return; }
  if (b.gf === 'shutter') {
    rect(X + 24, gy + 26, b.w - 48, gfh - 26, [.36, .02, .04]);
    for (let yy = gy + 34; yy < FB; yy += 11) line([[X + 24, yy], [X + b.w - 24, yy]], 2.5, [.55, 0, .08]);
    rect(X + 18, gy + 18, b.w - 36, 12, [.7, .1, .2]);
  } else {
    const dx = X + b.w / 2 - 38; rect(dx, gy + 30, 76, gfh - 30, [.85, .25, .35]); rect(dx + 8, gy + 40, 26, 50, [1, 0, .3]); rect(dx + 42, gy + 40, 26, 50, [1, 0, .3]); circle(dx + 56, gy + 104, 4, [0, .9, .3]);
    rect(X + 26, gy + 34, 60, 80, [1, 0, .22]); rect(X + b.w - 86, gy + 34, 60, 80, [1, 0, .22]);
  }
}
function catSil(x, y) {
  ellipse(x, y - 16, 20, 15, 0, [1, 0, .2]); circle(x + 14, y - 34, 11, [1, 0, .2]);
  poly([[x + 6, y - 42], [x + 9, y - 54], [x + 15, y - 44]], [1, 0, .2]); poly([[x + 15, y - 44], [x + 22, y - 54], [x + 24, y - 40]], [1, 0, .2]);
  curve([[x - 18, y - 8], [x - 30, y + 6], [x - 26, y + 24]], 5, [1, 0, .2]);
}
export function bakeryFront(X, gy, w, light) {
  const FB = ST.FB;
  // 橱窗：暖光（黄版）+ 面包剪影
  rect(X + 20, gy + 40, w - 120, FB - gy - 40, [.9, .1, .3]);
  rect(X + 32, gy + 52, w - 144, FB - gy - 64, light > 0 ? [0, .75, .12] : [.2, .75, .12]);
  for (let k = 0; k < 3; k++) rect(X + 32, gy + 80 + k * 26, w - 144, 5, [.6, .4, .2]);
  for (let k = 0; k < 7; k++) { const bx = X + 46 + k * ((w - 170) / 7); ellipse(bx + 12, gy + 74, 14, 8, 0, [.1, 1, .6]); ellipse(bx + 12, gy + 100, 10, 7, 0, [.1, 1, .7]); }
  // 门
  rect(X + w - 92, gy + 30, 72, FB - gy - 30, [.9, .1, .35]);
  rect(X + w - 84, gy + 40, 56, 60, light > 0 ? [0, .75, .12] : [.2, .75, .12]);
  // 条纹遮阳篷（黄版）+ 波浪边
  const ay = gy - 6;
  for (let k = 0; k < Math.ceil(w / 36); k++) poly([[X + k * 36, ay], [X + k * 36 + 36, ay], [X + k * 36 + 44, ay + 44], [X + k * 36 + 8, ay + 44]], k % 2 ? [0, .15, 0] : [0, 1, .1]);
  for (let k = 0; k < Math.ceil(w / 36); k++) { g.beginPath(); g.arc(X + k * 36 + 26, ay + 44, 18, 0, Math.PI); g.fillStyle = inkA(k % 2 ? [0, .15, 0] : [0, 1, .1]); g.fill(); }
  // 招牌
  rrect(X + w / 2 - 110, gy - 70, 220, 50, 6, [1, 0, .3]);
  g.font = '700 34px Bricolage'; g.fillStyle = inkA([0, .9, 0]); g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '6px'; g.fillText('BAKERY', X + w / 2 + 3, gy - 44); g.letterSpacing = '0px';
}
