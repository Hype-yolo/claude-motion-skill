// 纸片工具：画布、白边剪纸、纸纹、描边形状
import { mulberry, TAU } from './lib.js';
export const INK = '#3a2a24';

export function cv(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }

// 纸纤维纹理（灰度 + alpha），叠在剪纸上
function makeGrain(n, seed) {
  const c = cv(n, n), x = c.getContext('2d'), R = mulberry(seed), img = x.createImageData(n, n), d = img.data;
  for (let i = 0; i < n * n; i++) { const v = R(); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v < .5 ? 0 : 255; d[i * 4 + 3] = Math.abs(v - .5) * 34; }
  x.putImageData(img, 0, 0);
  // 纤维
  x.lineCap = 'round';
  for (let i = 0; i < n * 1.2; i++) {
    const px = R() * n, py = R() * n, a = R() * TAU, l = 4 + R() * 18;
    x.strokeStyle = R() < .5 ? 'rgba(90,70,50,.10)' : 'rgba(255,255,255,.22)'; x.lineWidth = .6 + R() * .8;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + .5) * l * .5, py + Math.sin(a + .5) * l * .5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  return c;
}
export const GRAIN = makeGrain(512, 7);

// 大面积纸张（书页、天空）：颜色 + 斑驳 + 纤维
export function paperFill(x, w, h, col, seed = 1, mott = .06) {
  x.fillStyle = col; x.fillRect(0, 0, w, h);
  const R = mulberry(seed);
  for (let i = 0; i < 70; i++) {
    const px = R() * w, py = R() * h, r = 40 + R() * 220, g = x.createRadialGradient(px, py, 0, px, py, r);
    const dark = R() < .5; g.addColorStop(0, dark ? `rgba(120,90,60,${mott * R()})` : `rgba(255,255,255,${mott * 1.4 * R()})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  x.save(); x.globalAlpha = .9; x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.fillRect(0, 0, w, h); x.restore();
}

// 把 art 画布加工成剪纸：外扩白边 + 纸板灰边 + 纸纹
export function finishCut(art, border = 14, o = {}) {
  const w = art.width, h = art.height, out = cv(w, h), x = out.getContext('2d');
  const dil = (r, col) => {
    const c = cv(w, h), y = c.getContext('2d'), n = Math.max(16, Math.round(r * 1.2));
    for (const rr of [r, r * .66, r * .33]) for (let i = 0; i < n; i++) { const a = i / n * TAU; y.drawImage(art, Math.cos(a) * rr, Math.sin(a) * rr); }
    y.globalCompositeOperation = 'source-in'; y.fillStyle = col; y.fillRect(0, 0, w, h); return c;
  };
  if (border > 0) {
    x.drawImage(dil(border + 2.5, o.edge || '#b9ad9c'), 0, 1.5);
    x.drawImage(dil(border, o.paper || '#fffdf7'), 0, 0);
  }
  x.drawImage(art, 0, 0);
  if (o.grain !== false) { x.save(); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = o.grainA ?? .85; x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.fillRect(0, 0, w, h); x.restore(); }
  return out;
}

// 画布描边帮手
export function sh(x, fill, lw = 6, stroke = INK) {
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (lw > 0) { x.lineWidth = lw; x.strokeStyle = stroke; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); }
}
// 抖动椭圆路径
export function blob(x, cx, cy, rx, ry, wob = .04, seed = 1, n = 28, rot = 0) {
  const R = mulberry(seed), ph = [R() * TAU, R() * TAU, R() * TAU];
  x.beginPath();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, k = 1 + wob * (Math.sin(a * 3 + ph[0]) * .5 + Math.sin(a * 5 + ph[1]) * .3 + Math.sin(a * 2 + ph[2]) * .4);
    const px = Math.cos(a) * rx * k, py = Math.sin(a) * ry * k;
    pts.push([cx + px * Math.cos(rot) - py * Math.sin(rot), cy + px * Math.sin(rot) + py * Math.cos(rot)]);
  }
  smoothClosed(x, pts);
}
// 过点的平滑闭合曲线（中点二次曲线）
export function smoothClosed(x, pts) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[n - 1], pts[0]); x.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mm = mid(p, q); x.quadraticCurveTo(p[0], p[1], mm[0], mm[1]); }
  x.closePath();
}
export function smoothOpen(x, pts, move = true) {
  const n = pts.length; if (move) x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n - 1; i++) { const p = pts[i], q = pts[i + 1]; x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  x.lineTo(pts[n - 1][0], pts[n - 1][1]);
}
// 月牙阴影：在 pathFn 形状内，把偏移后形状以外的部分涂 shade
export function crescent(x, pathFn, shade, dx, dy, base) {
  x.save(); pathFn(); x.clip();
  x.fillStyle = shade; x.fillRect(-9999, -9999, 30000, 30000);
  x.translate(-dx, -dy); pathFn(); x.fillStyle = base; x.fill();
  x.restore();
}
export function rr(x, px, py, w, h, r) { x.beginPath(); x.roundRect(px, py, w, h, r); }
