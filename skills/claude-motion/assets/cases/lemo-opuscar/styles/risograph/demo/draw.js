// 分版绘制工具：颜色 = 三版浓度 [蓝, 黄, 粉]（0..1）
// 普通绘制 = 挖空（覆盖三版）；over() 内绘制 = 只往对应版上加墨（叠印）
export const W = 1920, H = 1080;
export const plate = document.createElement('canvas');
plate.width = W; plate.height = H;
const G0 = plate.getContext('2d', { alpha: false, willReadFrequently: false });
export let g = G0;
// 角色层：先把 fn 画到透明图层，再在分版上压一圈纸白"挖空描边"（halo px），最后盖上图层
const layerC = document.createElement('canvas'); layerC.width = W; layerC.height = H;
const LG = layerC.getContext('2d');
export function layer(fn, halo = 5) {
  LG.setTransform(1, 0, 0, 1, 0, 0); LG.globalCompositeOperation = 'source-over'; LG.clearRect(0, 0, W, H);
  const prev = g; LG.setTransform(prev.getTransform()); g = LG; try { fn(); } finally { g = prev; }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (halo > 0) {
    g.filter = 'brightness(0)';
    const n = 12; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.drawImage(layerC, Math.cos(a) * halo, Math.sin(a) * halo); }
    g.filter = 'none';
  }
  g.drawImage(layerC, 0, 0);
  g.restore();
}

export const S = { mask: [1, 1, 1] };           // 全局版遮罩（设定表"逐版演示"用）
const c255 = v => Math.round(Math.max(0, Math.min(1, v)) * 255);
export const ink = (b = 0, y = 0, p = 0) => `rgb(${c255(b * S.mask[0])},${c255(y * S.mask[1])},${c255(p * S.mask[2])})`;
export const inkA = a => ink(a[0], a[1], a[2]);
export const PAPERINK = 'rgb(0,0,0)';

export function clear(c = [0, 0, 0]) { g.globalCompositeOperation = 'source-over'; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = inkA(c); g.fillRect(0, 0, W, H); }
// 叠印：fn 里的绘制只加墨不挖空
export function over(fn) { const o = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; fn(); g.globalCompositeOperation = o; }

export function fill(c) { g.fillStyle = Array.isArray(c) ? inkA(c) : c; g.fill(); }
export function circle(x, y, r, c) { g.beginPath(); g.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2); fill(c); }
export function ellipse(x, y, rx, ry, rot, c) { g.beginPath(); g.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, Math.PI * 2); fill(c); }
export function rect(x, y, w, h, c) { g.fillStyle = Array.isArray(c) ? inkA(c) : c; g.fillRect(x, y, w, h); }
export function rrect(x, y, w, h, r, c) { g.beginPath(); g.roundRect(x, y, w, h, r); fill(c); }
export function poly(pts, c) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); fill(c); }
// 平滑闭合形（二次曲线穿过中点）
export function blob(pts, c) {
  const n = pts.length; g.beginPath();
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let s = m(pts[n - 1], pts[0]); g.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = m(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
  g.closePath(); fill(c);
}
export function line(pts, w, c, cap = 'round') {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.lineWidth = w; g.lineCap = cap; g.lineJoin = 'round'; g.strokeStyle = Array.isArray(c) ? inkA(c) : c; g.stroke();
}
export function curve(pts, w, c) {   // 平滑开放曲线
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) { const q = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
  const L = pts[pts.length - 1]; g.lineTo(L[0], L[1]);
  g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = Array.isArray(c) ? inkA(c) : c; g.stroke();
}
export function ring(x, y, r, w, c) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.lineWidth = w; g.strokeStyle = Array.isArray(c) ? inkA(c) : c; g.stroke(); }
// 胶囊段 a→b，宽 w；stripes: [颜色A, 颜色B, 条宽] 时画垂直于段的条纹
export function limb(a, b, w, c, stripes) {
  if (!stripes) { line([a, b], w, c); return; }
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
  g.save(); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
  g.lineWidth = w; g.lineCap = 'round'; g.strokeStyle = inkA(stripes[0]); g.stroke();
  // 条纹：在段坐标系里画横条，用段的胶囊形裁剪
  g.translate(a[0], a[1]); g.rotate(ang);
  g.beginPath(); g.arc(0, 0, w / 2, Math.PI / 2, Math.PI * 1.5); g.lineTo(L, -w / 2); g.arc(L, 0, w / 2, -Math.PI / 2, Math.PI / 2); g.closePath(); g.clip();
  g.fillStyle = inkA(stripes[1]);
  const sw = stripes[2], off = stripes[3] || 0;
  for (let x = -w + off % (sw * 2); x < L + w; x += sw * 2) g.fillRect(x, -w, sw, w * 2);
  g.restore();
}
// 2 骨 IK：根 a、目标 t、段长 l1 l2、bend=+1/-1 弯向
export function ik(a, t, l1, l2, bend = 1) {
  const dx = t[0] - a[0], dy = t[1] - a[1]; let d = Math.hypot(dx, dy);
  const dmax = l1 + l2 - 0.01; if (d > dmax) d = dmax;
  const base = Math.atan2(dy, dx);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA))) * bend;
  const j = [a[0] + Math.cos(base + A) * l1, a[1] + Math.sin(base + A) * l1];
  const e = [a[0] + Math.cos(base) * d, a[1] + Math.sin(base) * d];
  return [j, e];
}
export const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const rot2 = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

export function text(s, x, y, font, c, align = 'left', base = 'alphabetic', track = 0) {
  g.font = font; g.fillStyle = Array.isArray(c) ? inkA(c) : c; g.textAlign = align; g.textBaseline = base;
  if (track) { g.letterSpacing = track + 'px'; }
  g.fillText(s, x, y);
  g.letterSpacing = '0px';
}
