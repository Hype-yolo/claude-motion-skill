// toon.js — 2D 卡通矢量引擎
// 1) 自己维护仿射矩阵：形状先变换到屏幕坐标再描边 → 任何景别线宽恒定（卡通特写不会变细线）
// 2) line boil：屏幕空间按 ~7px 重采样，沿法向做低频噪声位移；BOIL 状态 12fps 在 3 张之间循环
// 3) 平涂：fill → clip 内画硬边阴影块 → 最后描边
import { clamp, lerp, hash, vnoise, TAU } from '/core/lib.js';
export const W = 1920, H = 1080;
export const INK = '#1b1422';
export let g = null;
export function init(canvas) { g = canvas.getContext('2d'); return g; }

// —— 矩阵栈 ——
let M = [1, 0, 0, 1, 0, 0]; const ST = [];
export const push = () => ST.push(M.slice());
export const pop = () => { M = ST.pop(); };
export const reset = () => { M = [1, 0, 0, 1, 0, 0]; ST.length = 0; };
export function translate(x, y) { M = [M[0], M[1], M[2], M[3], M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]; }
export function rotate(a) { const c = Math.cos(a), s = Math.sin(a); M = [M[0] * c + M[2] * s, M[1] * c + M[3] * s, -M[0] * s + M[2] * c, -M[1] * s + M[3] * c, M[4], M[5]]; }
export function scale(sx, sy = sx) { M = [M[0] * sx, M[1] * sx, M[2] * sy, M[3] * sy, M[4], M[5]]; }
export const tx = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
export const zoom = () => Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
export const mirrored = () => M[0] * M[3] - M[1] * M[2] < 0;
export const getM = () => M.slice();
export const setM = m => { M = m.slice(); };

// —— 全局状态（每帧设置）——
export const S = { boil: 0, amp: 1.7, sid: 0, lw: 7, lwScale: 1 };
export function frame(t, { amp = 1.7 } = {}) {
  S.boil = Math.floor(t * 12 + 1e-6) % 3; S.amp = amp; S.sid = 0; reset();
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// —— 局部坐标下的形状点 ——
export function ell(cx, cy, rx, ry, n = 0, a0 = 0) {
  if (!n) n = Math.max(16, Math.min(90, Math.round((rx + ry) * zoom() * .25)));
  const p = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p;
}
export function arc(cx, cy, rx, ry, a0, a1, n = 24) { const p = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; }
// Catmull-Rom 样条
export function spline(c, closed = true, k = 8) {
  const n = c.length, out = [], P = i => closed ? c[(i + n) % n] : c[clamp(i, 0, n - 1)];
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(d => .5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  if (!closed) out.push(c[n - 1]);
  return out;
}
export function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); const p = [];
  const c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
  for (const [cx, cy, a] of c) for (let i = 0; i <= 6; i++) { const b = a + i / 6 * Math.PI / 2; p.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r]); }
  return p;
}
export const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// 二次曲线
export function quad(a, c, b, n = 16) { const p = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; p.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } return p; }
// 面条肢体：a→b 二次曲线，bend 为垂直偏移，w0→w1 渐细，两端圆头
export function noodle(a, b, bend, w0, w1 = w0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const c = [(a[0] + b[0]) / 2 + nx * bend, (a[1] + b[1]) / 2 + ny * bend];
  const mid = quad(a, c, b, 14), L1 = [], R1 = [];
  for (let i = 0; i < mid.length; i++) {
    const p = mid[i], q = mid[Math.min(mid.length - 1, i + 1)], o = mid[Math.max(0, i - 1)];
    let tx_ = q[0] - o[0], ty_ = q[1] - o[1]; const l = Math.hypot(tx_, ty_) || 1; tx_ /= l; ty_ /= l;
    const w = lerp(w0, w1, i / (mid.length - 1)) / 2;
    L1.push([p[0] - ty_ * w, p[1] + tx_ * w]); R1.push([p[0] + ty_ * w, p[1] - tx_ * w]);
  }
  const endA = Math.atan2(mid[mid.length - 1][1] - mid[mid.length - 2][1], mid[mid.length - 1][0] - mid[mid.length - 2][0]);
  const begA = Math.atan2(mid[1][1] - mid[0][1], mid[1][0] - mid[0][0]);
  const capB = arc(b[0], b[1], w1 / 2, w1 / 2, endA + Math.PI / 2, endA - Math.PI / 2, 8);
  const capA = arc(a[0], a[1], w0 / 2, w0 / 2, begA - Math.PI / 2, begA - Math.PI * 1.5, 8);
  return [...L1, ...capB, ...R1.reverse(), ...capA];
}

// —— 变换 + 重采样 + boil ——
function toScreen(pts, closed) {
  const s = pts.map(p => tx(p[0], p[1]));
  // 按弧长重采样（屏幕空间）
  const out = [], step = 7; let acc = 0;
  const n = closed ? s.length : s.length - 1;
  out.push(s[0]);
  for (let i = 0; i < n; i++) {
    const a = s[i], b = s[(i + 1) % s.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let pos = step - acc;
    while (pos < d) { const u = pos / d; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); pos += step; }
    acc = d - (pos - step);
  }
  if (!closed) out.push(s[s.length - 1]);
  return out;
}
function boilPts(s, closed, amp, seed) {
  if (amp <= 0 || s.length < 3) return s;
  const n = s.length, L = n * 7, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = s[(i - 1 + n) % n], b = s[(i + 1) % n];
    const p = s[i], ia = closed ? a : s[Math.max(0, i - 1)], ib = closed ? b : s[Math.min(n - 1, i + 1)];
    let nx = -(ib[1] - ia[1]), ny = ib[0] - ia[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const x = i * 7 / 38;
    let v = vnoise(x + seed) * 2 - 1;
    if (closed) { const w = i / n; v = lerp(v, vnoise(x - L / 38 + seed) * 2 - 1, w); }
    const v2 = vnoise(x * 2.3 + seed * 1.7 + 50) * 2 - 1;
    const d = (v * .8 + v2 * .35) * amp;
    out[i] = [p[0] + nx * d, p[1] + ny * d];
  }
  return out;
}
function pathOf(s, closed) {
  const P = new Path2D(); P.moveTo(s[0][0], s[0][1]);
  for (let i = 1; i < s.length; i++) P.lineTo(s[i][0], s[i][1]);
  if (closed) P.closePath(); return P;
}
// 主绘制：返回 Path2D（可再用来 clip / 描边）
export function shape(pts, o = {}) {
  const closed = o.closed !== false, id = S.sid++;
  const seed = hash(id * 1.37 + 3) * 90 + S.boil * 23.7;
  let s = toScreen(pts, closed);
  s = boilPts(s, closed, (o.boil ?? 1) * S.amp, seed);
  const P = pathOf(s, closed);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (o.alpha != null) g.globalAlpha = o.alpha;
  if (o.fill && closed) { g.fillStyle = o.fill; g.fill(P); }
  if (o.shade) { g.save(); g.clip(P); o.shade(); g.restore(); }
  if (o.stroke !== false && o.line !== null) outline(P, o.lw ?? S.lw, o.line ?? INK);
  if (o.alpha != null) g.globalAlpha = 1;
  return P;
}
export function outline(P, lw = S.lw, col = INK) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineWidth = lw * S.lwScale; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = col; g.stroke(P);
}
export const fillOnly = (pts, fill, o = {}) => shape(pts, { ...o, fill, stroke: false });
export const stroke = (pts, lw = S.lw, o = {}) => shape(pts, { ...o, closed: false, lw });
export const dot = (x, y, r, col = INK) => { const [a, b] = tx(x, y); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = col; g.beginPath(); g.arc(a, b, Math.max(1.5, r * zoom()), 0, TAU); g.fill(); };

// 世界坐标里写字（招牌等）
export function text(str, x, y, { font = '800 40px "Baloo 2"', fill = INK, align = 'center', base = 'middle', rot = 0, outlineW = 0, outlineCol = INK } = {}) {
  g.save(); g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
  g.translate(x, y); if (rot) g.rotate(rot); if (mirrored()) g.scale(-1, 1);
  g.font = font; g.textAlign = align; g.textBaseline = base;
  if (outlineW) { g.lineWidth = outlineW; g.lineJoin = 'round'; g.strokeStyle = outlineCol; g.strokeText(str, 0, 0); }
  g.fillStyle = fill; g.fillText(str, 0, 0); g.restore();
}

// —— 屏幕空间工具 ——
export function screenRect(col, a = 1) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
// 平涂带状"渐变"（卡通天空：硬边色带）
export function bands(cols, y0, y1, x0 = -4000, x1 = 6000) {
  const n = cols.length;
  for (let i = 0; i < n; i++) fillOnly(rect(x0, lerp(y0, y1, i / n), x1 - x0, (y1 - y0) / n + 2), cols[i], { boil: 0 });
}
export const wob = (t, f = 1, ph = 0) => Math.sin(t * TAU * f + ph);
