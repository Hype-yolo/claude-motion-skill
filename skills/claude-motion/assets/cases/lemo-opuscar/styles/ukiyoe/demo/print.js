// 木版画引擎：和纸、色版（带错位 / 胡麻摺 / 木纹）、ぼかし、刻刀墨线、吃墨显现、题签与朱印
import { clamp, lerp, mulberry, hash, vnoise, ss, TAU } from '/core/lib.js';
export const W = 1920, H = 1080;
// 画框（墨线边框）
export const FR = { x0: 44, y0: 38, x1: 1876, y1: 1042 };
export const PAL = {
  paper: '#eee2c6', paperD: '#e2d3b0', mount: '#c9b690', mountD: '#b19d74',
  prus: '#1d3a66', prusD: '#13284a', prusL: '#4d6f98', ai: '#2f4f73', sky: '#8db0c6', skyL: '#bcd0d6',
  sumi: '#231f1c', sumiL: '#4a4540', grey: '#8b8a80', greyL: '#b3b0a2', greyD: '#5f5e58',
  beni: '#b8412f', beniL: '#e3a08a', beniP: '#efc4a8', ochre: '#cf9f4a', ochreL: '#e2c27e', straw: '#c9a45c',
  green: '#8aa152', greenD: '#50703c', greenL: '#b5c07a', pine: '#3e5a3a', skin: '#ecd6b2',
  wood: '#8a6a48', woodD: '#5e4631', woodL: '#b08d63', plaster: '#dfd2b2', white: '#f6efdc',
};
export const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// —— 噪声场（双线性 + smoothstep 的格点噪声，fbm）——
function field(w, h, cell, seed) {
  const R = mulberry(seed), gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = R();
  const f = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / cell, iy = fy | 0, ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < w; x++) {
      const fx = x / cell, ix = fx | 0, tx = fx - ix, sx = tx * tx * (3 - 2 * tx), o = iy * gw + ix;
      const a = g[o], b = g[o + 1], c = g[o + gw], d = g[o + gw + 1];
      f[y * w + x] = (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    }
  }
  return f;
}
export function fbm(w, h, cells, seed, weights) {
  const out = new Float32Array(w * h); let tot = 0;
  cells.forEach((c, i) => { const wt = weights ? weights[i] : 1 / (i + 1); tot += wt; const f = field(w, h, c, seed + i * 101); for (let k = 0; k < out.length; k++) out[k] += f[k] * wt; });
  for (let k = 0; k < out.length; k++) out[k] /= tot;
  return out;
}
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
export const rgba = (s, a = 1) => { const [r, g, b] = hex(s); return `rgba(${r},${g},${b},${a})`; };
export const mix = (s1, s2, t) => { const a = hex(s1), b = hex(s2); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join(''); };

// —— 纹理（启动时生成一次）——
export const TX = {};
export function buildTextures() {
  // 1. 和纸底
  {
    const c = mk(), x = c.getContext('2d');
    const w = 480, h = 270, m = fbm(w, h, [90, 30, 9, 3], 11), sm = mk(w, h), sx = sm.getContext('2d'), id = sx.createImageData(w, h);
    const [r, g, b] = hex(PAL.paper);
    for (let i = 0; i < w * h; i++) { const v = (m[i] - .5) * 22; id.data[i * 4] = r + v; id.data[i * 4 + 1] = g + v * .95; id.data[i * 4 + 2] = b + v * .8; id.data[i * 4 + 3] = 255; }
    sx.putImageData(id, 0, 0); x.imageSmoothingQuality = 'high'; x.drawImage(sm, 0, 0, W, H);
    fibers(x, 5200, '#fbf6e9', .30, 1, 7); fibers(x, 1500, '#c7b893', .16, .8, 8); fibers(x, 160, '#f9f3e3', .35, 1.6, 9, 140);
    const R = mulberry(5); for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(150,110,60,${.03 + R() * .06})`; x.beginPath(); x.arc(R() * W, R() * H, .6 + R() * 2.2, 0, TAU); x.fill(); }
    const gr = x.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 1150); gr.addColorStop(0, 'rgba(160,120,60,0)'); gr.addColorStop(1, 'rgba(150,108,55,.16)');
    x.fillStyle = gr; x.fillRect(0, 0, W, H); TX.paper = c;
  }
  // 2. 压在墨上的浅色纤维（纸纤维透过墨色）
  { const c = mk(), x = c.getContext('2d'); fibers(x, 3000, '#f4ead4', .09, .8, 21); fibers(x, 90, '#f4ead4', .13, 1.3, 22, 160); TX.fiber = c; }
  // 3. 胡麻摺斑点（destination-out 用）
  {
    const w = 960, h = 540, m = fbm(w, h, [60, 16], 31), R = mulberry(32), c = mk(w, h), x = c.getContext('2d'), id = x.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const p = .02 + .32 * Math.pow(m[i], 3.5); id.data[i * 4 + 3] = R() < p ? 90 + R() * 140 : 0; }
    x.putImageData(id, 0, 0); TX.speck = c;
  }
  // 4. 木纹（source-atop 用）：扭曲场的等值线 = 年轮纹，偶有节疤；另有宽的浓淡带
  {
    const w = 1920, h = 1080, m = fbm(w / 2, h / 2, [160, 48, 14], 41, [1, .45, .2]), c = mk(w, h), x = c.getContext('2d'), id = x.createImageData(w, h);
    const knots = [[420, 300], [1300, 760], [1650, 180], [760, 900]];
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
      const i = y * w + X, mv = m[(y >> 1) * (w / 2) + (X >> 1)];
      let u = y * .035 + mv * 9 + Math.sin(X * .0021) * 1.4;
      for (const [kx, ky] of knots) { const d = Math.hypot((X - kx) * .5, y - ky); u += 2.2 * Math.exp(-d * d / 5000); }
      const f = u - Math.floor(u), d = Math.abs(f - .5) * 2, line = d > .8 ? Math.pow((d - .8) / .2, 1.6) : 0, band = .5 + .5 * Math.sin(u * .9);
      id.data[i * 4] = 24; id.data[i * 4 + 1] = 20; id.data[i * 4 + 2] = 30; id.data[i * 4 + 3] = (line * .85 + band * .28) * 255;
    }
    x.putImageData(id, 0, 0); TX.grain = c;
  }
  // 4b. 馬連擦痕：一圈圈的圆弧压痕与横向之字擦痕（destination-out 用 → 墨色不均）
  {
    const c = mk(), x = c.getContext('2d'), R = mulberry(61);
    x.filter = 'blur(7px)'; x.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const cx = R() * W, cy = R() * H, r = 40 + R() * 170, a0 = R() * TAU;
      x.strokeStyle = `rgba(0,0,0,${.05 + R() * .12})`; x.lineWidth = 14 + R() * 40;
      x.beginPath(); x.arc(cx, cy, r, a0, a0 + 1 + R() * 3.5); x.stroke();
    }
    for (let i = 0; i < 70; i++) {
      let px = R() * W, py = R() * H; x.strokeStyle = `rgba(0,0,0,${.04 + R() * .08})`; x.lineWidth = 20 + R() * 30; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += 60 + R() * 80; py += (k % 2 ? 1 : -1) * (30 + R() * 50); x.lineTo(px, py); } x.stroke();
    }
    x.filter = 'none'; TX.baren = c;
    const p = mk(), px = p.getContext('2d'); px.fillStyle = PAL.paper; px.fillRect(0, 0, W, H); px.globalCompositeOperation = 'destination-in'; px.drawImage(c, 0, 0); TX.barenPaper = p;
  }
  // 5. 吃墨显现遮罩（馬連压痕：大块斑驳 + 细点），12 级
  {
    const w = 960, h = 540, m = fbm(w, h, [120, 40, 12, 3], 51, [1, .7, .45, .35]);
    TX.reveal = [];
    for (let k = 0; k <= 12; k++) {
      const thr = 1.35 - k / 12 * 1.75, c = mk(w, h), x = c.getContext('2d'), id = x.createImageData(w, h);
      for (let i = 0; i < w * h; i++) { const X = i % w, Y = (i / w) | 0, v = 1 - (X / w * .75 + Y / h * .25) + (m[i] - .5) * .55; id.data[i * 4 + 3] = clamp((v - thr) / .06) * 255; }
      x.putImageData(id, 0, 0); TX.reveal.push(c);
    }
  }
  TX.tmp = mk(); TX.tmp2 = mk();
}
function fibers(x, n, col, a, lw, seed, len = 60) {
  const R = mulberry(seed); x.strokeStyle = col; x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let px = R() * W, py = R() * H, ang = R() * TAU; const L = len * (.3 + R()), steps = 5;
    x.globalAlpha = a * (.4 + R() * .6); x.lineWidth = lw * (.5 + R()); x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < steps; s++) { ang += (R() - .5) * .9; px += Math.cos(ang) * L / steps; py += Math.sin(ang) * L / steps; x.lineTo(px, py); }
    x.stroke();
  }
  x.globalAlpha = 1;
}

// 把一块色版做成"印出来的"：胡麻摺斑点 + 木纹
export function inkify(c, { speck = .5, grain = 0, gx = 0, gy = 0, baren = 0, bx = 0, by = 0 } = {}) {
  const x = c.getContext('2d'); x.save();
  if (grain) { x.globalCompositeOperation = 'source-atop'; x.globalAlpha = grain; x.drawImage(TX.grain, gx, gy, W, H); x.drawImage(TX.grain, gx - W, gy, W, H); }
  if (baren) { x.globalCompositeOperation = 'destination-out'; x.globalAlpha = baren; x.drawImage(TX.baren, bx, by); }
  if (speck) { x.globalCompositeOperation = 'destination-out'; x.globalAlpha = speck; x.drawImage(TX.speck, 0, 0, W, H); }
  x.restore(); return c;
}

// —— 路径与墨线 ——
export function smooth(x, p, closed = false) {
  const n = p.length; if (n < 2) return;
  if (!closed) {
    x.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < n - 1; i++) x.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    x.lineTo(p[n - 1][0], p[n - 1][1]);
  } else {
    const m = i => [(p[i % n][0] + p[(i + 1) % n][0]) / 2, (p[i % n][1] + p[(i + 1) % n][1]) / 2];
    const s = m(n - 1); x.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) { const e = m(i); x.quadraticCurveTo(p[i][0], p[i][1], e[0], e[1]); }
    x.closePath();
  }
}
export function poly(x, p) { x.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) x.lineTo(p[i][0], p[i][1]); x.closePath(); }
// Catmull-Rom 加密
export function dense(p, per = 8, closed = false) {
  const n = p.length, out = [], N = closed ? n : n - 1;
  const P = i => closed ? p[(i + n) % n] : p[clamp(i, 0, n - 1)];
  for (let i = 0; i < N; i++) {
    const a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2);
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      out.push([.5 * (2 * b[0] + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3),
      .5 * (2 * b[1] + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3)]);
    }
  }
  if (!closed) out.push(p[n - 1]);
  return out;
}
// 刻刀墨线：变宽填充线（两端收尖、带低频粗细抖动）
export function carve(x, pts, w, { taper = [.25, .25], seed = 1, jit = .22, closed = false, per = 6, col } = {}) {
  const p = dense(pts, per, closed), n = p.length; if (n < 2) return;
  let L = [0]; for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const tot = L[n - 1] || 1, left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const u = L[i] / tot;
    let prof = 1; if (!closed) { if (taper[0] > 0 && u < taper[0]) prof = Math.sin(u / taper[0] * Math.PI / 2); if (taper[1] > 0 && u > 1 - taper[1]) prof = Math.min(prof, Math.sin((1 - u) / taper[1] * Math.PI / 2)); }
    const ww = w * .5 * (.25 + .75 * prof) * (1 + jit * (vnoise(L[i] * .035 + seed * 13.1) - .5) * 2);
    left.push([p[i][0] - dy * ww, p[i][1] + dx * ww]); right.push([p[i][0] + dy * ww, p[i][1] - dx * ww]);
  }
  if (col) x.fillStyle = col;
  x.beginPath(); x.moveTo(left[0][0], left[0][1]); for (let i = 1; i < n; i++) x.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) x.lineTo(right[i][0], right[i][1]); x.closePath(); x.fill();
}
// 手刻的轻微抖动（对点列做低频位移）
export function wob(pts, amp = 2, seed = 1, f = .02) {
  return pts.map(([a, b]) => [a + (vnoise(a * f + b * f * .7 + seed * 7.3) - .5) * 2 * amp, b + (vnoise(b * f + a * f * .6 + seed * 3.1 + 50) - .5) * 2 * amp]);
}
// 普通墨线（圆头）
export function line(x, pts, w = 2.6, col = PAL.sumi, closed = false) { x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); smooth(x, pts, closed); x.stroke(); }
export function fillPath(x, pts, col, closed = true) { x.fillStyle = col; x.beginPath(); smooth(x, pts, closed); x.fill(); }

// ぼかし：手抹的渐变（逐像素生成，边缘按列低频错开，不留接缝）
export function bokashi(x, x0, y0, x1, y1, col, a0, a1, { rough = 22, seed = 3, col2, ease = 1 } = {}) {
  const X0 = Math.max(0, Math.floor(x0)), X1 = Math.min(W, Math.ceil(x1));
  const Y0 = Math.max(0, Math.floor(Math.min(y0, y1) - rough * 1.4)), Y1 = Math.min(H, Math.ceil(Math.max(y0, y1) + rough * 1.4));
  const w = X1 - X0, h = Y1 - Y0; if (w <= 0 || h <= 0) return;
  const c = mk(w, h), cx = c.getContext('2d'), id = cx.createImageData(w, h), d = id.data;
  const A = hex(col), B = hex(col2 || col);
  for (let i = 0; i < w; i++) {
    const X = X0 + i, off = (vnoise(X * .006 + seed) - .5) * 2 * rough + (vnoise(X * .03 + seed * 5) - .5) * rough * .35;
    for (let j = 0; j < h; j++) {
      const Y = Y0 + j; let u = (Y - (y0 + off)) / (y1 - y0); u = u < 0 ? 0 : u > 1 ? 1 : u; if (ease !== 1) u = Math.pow(u, ease);
      const a = a0 + (a1 - a0) * u, k = (j * w + i) * 4;
      d[k] = A[0] + (B[0] - A[0]) * u; d[k + 1] = A[1] + (B[1] - A[1]) * u; d[k + 2] = A[2] + (B[2] - A[2]) * u; d[k + 3] = a * 255;
    }
  }
  cx.putImageData(id, 0, 0); x.drawImage(c, X0, Y0);
}
// 横向霞带（すやり霞）：两端圆头的长条
export function kasumi(x, cx, cy, w, h, col, a = 1, vfade = 0) {
  if (vfade) { x.save(); const t = mk(W, H), tx = t.getContext('2d'); kasumi(tx, cx, cy, w, h, col, a); tx.globalCompositeOperation = 'destination-in'; const vg = tx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(.35, 'rgba(0,0,0,1)'); vg.addColorStop(1, `rgba(0,0,0,${1 - vfade})`); tx.fillStyle = vg; tx.fillRect(0, 0, W, H); x.drawImage(t, 0, 0); x.restore(); return; }
  x.save(); const g = x.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(.12, rgba(col, a)); g.addColorStop(.88, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  x.fillStyle = g; x.beginPath();
  x.moveTo(cx - w / 2 + h / 2, cy - h / 2); x.lineTo(cx + w / 2 - h / 2, cy - h / 2); x.arc(cx + w / 2 - h / 2, cy, h / 2, -Math.PI / 2, Math.PI / 2);
  x.lineTo(cx - w / 2 + h / 2, cy + h / 2); x.arc(cx - w / 2 + h / 2, cy, h / 2, Math.PI / 2, Math.PI * 1.5); x.fill(); x.restore();
}
// 画一层到目标上：reveal ∈[0,1]（吃墨显现 + 错位对准）
export function stampLayer(dst, src, reveal = 1, reg = [0, 0], shift = [5, -4]) {
  if (reveal <= 0) return;
  if (reveal >= 1) { dst.drawImage(src, reg[0], reg[1]); return; }
  const k = Math.min(12, Math.floor(reveal * 12.999)), t = TX.tmp, x = t.getContext('2d');
  const e = 1 - ss(clamp(reveal * 1.6)), ox = reg[0] + shift[0] * e, oy = reg[1] + shift[1] * e;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'copy'; x.drawImage(src, ox, oy);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(TX.reveal[k], 0, 0, W, H); x.globalCompositeOperation = 'source-over';
  dst.drawImage(t, 0, 0);
}
// 把一段即时绘制的内容（函数）按 reveal 印上去
export function stampFn(dst, fn, reveal = 1, shift = [5, -4]) {
  if (reveal <= 0) return;
  if (reveal >= 1) { fn(dst); return; }
  const t = TX.tmp2, x = t.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
  fn(x); stampLayer(dst, t, reveal, [0, 0], shift);
}

// —— 朱印 ——
const sealCache = {};
export function sealCanvas(chars, size, { white = true, seed = 1, col = PAL.beni } = {}) {
  const key = chars + size + white + seed; if (sealCache[key]) return sealCache[key];
  const pad = 6, c = mk(size + pad * 2, size + pad * 2), x = c.getContext('2d'), R = mulberry(seed);
  // 略不规则的方框
  const q = [[pad + R() * 2, pad + R() * 2], [pad + size - R() * 2, pad + R() * 2.5], [pad + size - R() * 2, pad + size - R() * 2], [pad + R() * 2.5, pad + size - R() * 2]];
  x.fillStyle = col;
  if (white) { x.beginPath(); poly(x, q); x.fill(); x.globalCompositeOperation = 'destination-out'; }
  else { x.lineWidth = size * .07; x.strokeStyle = col; x.beginPath(); poly(x, q); x.stroke(); }
  x.fillStyle = white ? '#000' : col; x.textAlign = 'center'; x.textBaseline = 'middle';
  const n = chars.length;
  if (n === 1) { x.font = `400 ${size * .78}px Yuji`; x.fillText(chars, pad + size / 2, pad + size / 2 + size * .04); }
  else if (n === 2) { x.font = `400 ${size * .5}px Yuji`; x.fillText(chars[0], pad + size / 2, pad + size * .29); x.fillText(chars[1], pad + size / 2, pad + size * .74); }
  else { x.font = `400 ${size * .42}px Yuji`; const cc = [...chars];[[.72, .28], [.72, .73], [.28, .28], [.28, .73]].forEach(([u, v], i) => cc[i] && x.fillText(cc[i], pad + size * u, pad + size * v)); }
  // 印泥不匀 + 边缘磕损
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < size * 1.6; i++) { x.globalAlpha = .2 + R() * .6; x.beginPath(); const ed = R() < .5; const px = ed ? pad + (R() < .5 ? R() * 4 : size - R() * 4) : pad + R() * size, py = ed ? pad + R() * size : pad + (R() < .5 ? R() * 4 : size - R() * 4); x.arc(px, py, .5 + R() * 1.8, 0, TAU); x.fill(); }
  for (let i = 0; i < size * 2; i++) { x.globalAlpha = .12 + R() * .3; x.beginPath(); x.arc(pad + R() * size, pad + R() * size, .4 + R() * 1.1, 0, TAU); x.fill(); }
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  return sealCache[key] = c;
}
// 盖章动画：p 0→1（下压放大 → 落定），之后常显
export function drawSeal(x, chars, cx, cy, size, p, opts = {}) {
  if (p <= 0) return;
  const c = sealCanvas(chars, size, opts), s = p < 1 ? lerp(1.35, 1, ss(clamp(p / .55))) : 1, a = clamp(p / .35);
  x.save(); x.globalAlpha = a * .93; x.translate(cx, cy); x.rotate(opts.rot || 0); x.scale(s, s); x.globalCompositeOperation = opts.normal ? 'source-over' : 'multiply';
  x.drawImage(c, -c.width / 2, -c.height / 2); x.restore();
}

// —— 题签（竖式）——
export function vtext(x, str, cx, y0, size, gap = 1.06, font = 'Yuji', weight = 400) {
  x.font = `${weight} ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  let y = y0 + size / 2; for (const ch of str) { if (ch === ' ') { y += size * .45; continue; } x.fillText(ch, cx, y); y += size * gap; }
  return y - size / 2;
}
export function vlen(str, size, gap = 1.06) { let h = 0; for (const ch of str) h += ch === ' ' ? size * .45 : size * gap; return h; }
// 竖题签：series（上方浅红小签）+ title
export function cartouche(x, cx, y0, title, { series = '山へ五景', w = 84, size = 50, ssize = 27, fill = '#f3e7c6', tab = PAL.beniL } = {}) {
  const th = vlen(title, size) + 26, sh = series ? vlen(series, ssize) + 20 : 0, h = sh + th, x0 = cx - w / 2;
  x.save();
  x.fillStyle = fill; x.fillRect(x0, y0, w, h);
  if (series) { x.fillStyle = tab; x.fillRect(x0, y0, w, sh); }
  x.strokeStyle = PAL.sumi; x.lineWidth = 3; x.strokeRect(x0, y0, w, h); x.lineWidth = 1.2; x.strokeRect(x0 + 5, y0 + 5, w - 10, h - 10);
  if (series) { x.lineWidth = 1.5; x.beginPath(); x.moveTo(x0 + 5, y0 + sh); x.lineTo(x0 + w - 5, y0 + sh); x.stroke(); }
  x.fillStyle = PAL.sumi;
  if (series) vtext(x, series, cx, y0 + 11, ssize);
  vtext(x, title, cx, y0 + sh + 13, size);
  x.restore();
  return { x0, y0, w, h };
}

// 动态绘制的大色块（浪身、海）也要有版画质感：在当前 clip 内压木纹与纸色擦痕
export function printTex(x, grain = .1, baren = .5, ox = 0, oy = 0) {
  x.save(); x.globalAlpha = grain; x.drawImage(TX.grain, ox, oy); x.globalAlpha = baren; x.drawImage(TX.barenPaper, -ox * .5, oy * .3); x.restore();
}
