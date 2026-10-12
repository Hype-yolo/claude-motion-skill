// 红纸剪纸引擎：纸张纹理、剪纸片（填充 + 镂空 + 内刻线 + 刀口）、纸影、背光透射
// 坐标：每个"片"在自己的单位坐标里画（枢轴在原点），预渲染成贴图（K 像素/单位）后按变换贴到画面上。
export const PAL = {
  red: '#d2201f',      // 女孩 / 团花 / 房子（中国红）
  nian: '#b00f26',     // 年兽（深一档）
  far: '#7e1424',      // 远山远房
  mid: '#9c1323',
  rice: '#f2e8d0',     // 米白宣纸
  indigo: '#1c2446',   // 夜色纸
  gold: '#d9a93f',     // 金箔
  sub: '#a8111f',      // 字幕纸条
  back: '#e98f86',     // 红纸背面（折纸时露出，浅一档）
  shadow: 'rgba(52,6,10,.38)',
  light: '#ffe3a6', transmit: '#e0401c'
};
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return [c, c.getContext('2d')]; }

// ---------- 确定性噪声 ----------
const h2 = (x, y, s = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
function tileNoise(P) {  // 周期 P 的值噪声
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const w = (a, b) => h2(((a % P) + P) % P, ((b % P) + P) % P, P);
    return (w(i, j) * (1 - u) + w(i + 1, j) * u) * (1 - v) + (w(i, j + 1) * (1 - u) + w(i + 1, j + 1) * u) * v;
  };
}
export const rnd = (k, s = 0) => h2(k * 1.37 + .5, s * 2.11 + .3, 9.1);

// ---------- 纸张纹理（可平铺） ----------
const TEX = {};
function fibers(g, N, n, col, a, len, w, seed) {
  g.save(); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const x = rnd(k, seed) * N, y = rnd(k, seed + 1) * N, an = rnd(k, seed + 2) * 6.283, L = len * (.35 + rnd(k, seed + 3));
    g.globalAlpha = a * (.4 + .6 * rnd(k, seed + 4));
    for (const [ox, oy] of [[0, 0], [-N, 0], [N, 0], [0, -N], [0, N]]) {   // 平铺边界上画两遍
      g.beginPath(); g.moveTo(x + ox, y + oy);
      const bx = Math.cos(an + (rnd(k, seed + 5) - .5)) * L * .5, by = Math.sin(an + (rnd(k, seed + 5) - .5)) * L * .5;
      g.quadraticCurveTo(x + ox + bx, y + oy + by, x + ox + Math.cos(an) * L, y + oy + Math.sin(an) * L); g.stroke();
    }
  }
  g.restore();
}
// 叠加用的中性灰纹理（soft-light：128 = 不变），用于红纸 / 年兽纸
export function paperGrain(kind = 'red') {
  if (TEX[kind]) return TEX[kind];
  const N = 768, [c, g] = canvas(N, N), id = g.createImageData(N, N), d = id.data;
  const n1 = tileNoise(6), n2 = tileNoise(24), n3 = tileNoise(96);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const f = (n1(x / 128, y / 128) - .5) * 1.0 + (n2(x / 32, y / 32) - .5) * .45 + (n3(x / 8, y / 8) - .5) * .25;
    const sp = h2(x, y, 3) > .993 ? -38 : 0;
    const v = 128 + f * 46 + sp, i = (y * N + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, v)); d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  fibers(g, N, 700, '#ffffff', .22, 34, 1.1, 11);
  fibers(g, N, 260, '#000000', .12, 26, .9, 17);
  TEX[kind] = c; return c;
}
// 完整颜色的底纸（宣纸 / 夜色纸）
export function paperTile(kind) {
  if (TEX[kind]) return TEX[kind];
  const N = 1024, [c, g] = canvas(N, N), id = g.createImageData(N, N), d = id.data;
  const base = kind === 'rice' ? [242, 232, 208] : kind === 'indigo' ? [28, 36, 70] : kind === 'ink' ? [15, 20, 42] : [240, 226, 196];
  const n1 = tileNoise(4), n2 = tileNoise(16), n3 = tileNoise(128);
  const amp = kind === 'rice' ? .05 : .13;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const f = (n1(x / 256, y / 256) - .5) * 1.2 + (n2(x / 64, y / 64) - .5) * .5 + (n3(x / 8, y / 8) - .5) * .25;
    const k = 1 + f * amp, i = (y * N + x) * 4;
    d[i] = base[0] * k; d[i + 1] = base[1] * k; d[i + 2] = base[2] * (1 + f * amp * 1.1); d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  if (kind === 'rice') { fibers(g, N, 900, '#ffffff', .35, 60, 1.2, 21); fibers(g, N, 500, '#9a8a64', .13, 44, .8, 23); fibers(g, N, 40, '#8a7650', .2, 8, 1.6, 27); }
  else { fibers(g, N, 900, kind === 'ink' ? '#3a4880' : '#5e6ea8', .16, 60, 1.1, 31); fibers(g, N, 400, '#0a0e22', .25, 40, .9, 33); }
  TEX[kind] = c; return c;
}
// 用底纸铺满一个矩形；纹理跟着世界走（C = 画面变换 [k,0,0,k,tx,ty]）
export function fillPaper(g, kind, x, y, w, h, C = [1, 0, 0, 1, 0, 0], tint = null) {
  const p = g.createPattern(paperTile(kind), 'repeat');
  p.setTransform(new DOMMatrix([C[0] * .75, 0, 0, C[3] * .75, C[4], C[5]]));
  g.save(); g.fillStyle = p; g.fillRect(x, y, w, h);
  if (tint) { g.fillStyle = tint; g.fillRect(x, y, w, h); }
  g.restore();
}

// ---------- 路径工具 ----------
// 平滑闭合（过中点的二次曲线）→ 采样成折线，再加刀口抖动
export function curve(pts, closed = true, step = 3) {
  const out = [], n = pts.length;
  if (n < 3) return pts.slice();
  const m = (i) => { const a = pts[(i + n) % n], b = pts[(i + 1 + n) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const I = closed ? n : n - 2;
  if (!closed) out.push(pts[0]);
  for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
    const s = closed ? m(i - 1) : (i === 1 ? pts[0] : m(i - 1)), c = pts[i], e = closed ? m(i) : (i === n - 2 ? pts[n - 1] : m(i));
    const L = Math.hypot(c[0] - s[0], c[1] - s[1]) + Math.hypot(e[0] - c[0], e[1] - c[1]), k = Math.max(2, Math.ceil(L / step));
    for (let j = 0; j < k; j++) { const u = j / k, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), cc = u * u; out.push([a * s[0] + b * c[0] + cc * e[0], a * s[1] + b * c[1] + cc * e[1]]); }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
export function wob(poly, amp = .35, seed = 1, freq = .09) {   // 手剪的微小不齐：沿弧长的低频抖动
  let s = 0; const out = [];
  for (let i = 0; i < poly.length; i++) {
    if (i) s += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
    const a = poly[Math.max(0, i - 1)], b = poly[Math.min(poly.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const x = s * freq, j = Math.floor(x), f = x - j, u = f * f * (3 - 2 * f);
    const nz = (rnd(j, seed) * (1 - u) + rnd(j + 1, seed) * u - .5) * 2 + (rnd(i, seed + 7) - .5) * .35;
    out.push([poly[i][0] - dy / l * nz * amp, poly[i][1] + dx / l * nz * amp]);
  }
  return out;
}
export function trace(g, poly, closed = true) { g.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) g.lineTo(poly[i][0], poly[i][1]); if (closed) g.closePath(); }
export const P = (pts, closed = true, amp = .35, seed = 1) => wob(curve(pts, closed), amp, seed);   // 常用：平滑 + 抖动
export function densify(pts, closed = true, step = 4) {
  const o = [], n = pts.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / step)); for (let j = 0; j < k; j++) o.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); }
  if (!closed) o.push(pts[n - 1]); return o;
}
export const Pl = (pts, closed = true, amp = .35, seed = 1) => wob(densify(pts, closed), amp, seed);   // 尖角折线 + 抖动（建筑）
export function ellipsePoly(cx, cy, rx, ry, rot = 0, n = 40, a0 = 0, a1 = Math.PI * 2) {
  const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry; o.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); } return o;
}

// ---------- 剪纸基本操作（在片的单位坐标里） ----------
export function fill(g, pathFn, col = PAL.red, rule = 'nonzero') { g.beginPath(); pathFn(g); g.fillStyle = col; g.fill(rule); }
export function cut(g, pathFn, rule = 'nonzero') {   // 镂空：destination-out，先设不透明黑（alpha 决定挖多少）
  g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.beginPath(); pathFn(g); g.fill(rule); g.restore();
}
export function cutLine(g, w, pathFn) {
  g.save(); g.globalCompositeOperation = 'destination-out'; g.strokeStyle = '#000'; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pathFn(g); g.stroke(); g.restore();
}
// 锥形刻线：两头尖（剪纸刻线的典型形状，像月牙的一半）
export function cutTaper(g, pts, w, closed = false) {
  const n = pts.length; if (n < 2) return; const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const k = closed ? 1 : Math.sin(Math.PI * (i / (n - 1))) * .92 + .08, ww = w * k / 2;
    L.push([pts[i][0] - dy / l * ww, pts[i][1] + dx / l * ww]); R.push([pts[i][0] + dy / l * ww, pts[i][1] - dx / l * ww]);
  }
  cut(g, q => { q.moveTo(...L[0]); for (const p of L) q.lineTo(...p); for (let i = n - 1; i >= 0; i--) q.lineTo(...R[i]); q.closePath(); });
}
// 内刻线：沿轮廓内侧 inset 处刻一条 gap 宽的缝（双线轮廓）
export function inset(g, poly, ins = 4, gap = 1.6, col = PAL.red) {
  g.save(); g.beginPath(); trace(g, poly); g.clip();
  g.globalCompositeOperation = 'destination-out'; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.lineWidth = 2 * (ins + gap); g.beginPath(); trace(g, poly); g.stroke();
  g.globalCompositeOperation = 'source-over'; g.strokeStyle = col; g.lineWidth = 2 * ins; g.beginPath(); trace(g, poly); g.stroke();
  g.restore();
}
// 在 poly 形状里剪（clip 之后执行 fn）
export function within(g, poly, fn) { g.save(); g.beginPath(); trace(g, poly); g.clip(); fn(); g.restore(); }

// ---------- 片：预渲染贴图 ----------
export const SS = 3;
export function piece(box, draw, opt = {}) {
  const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0, K = opt.ss || SS;
  const [c, g] = canvas(w * K, h * K);
  g.setTransform(K, 0, 0, K, -x0 * K, -y0 * K); g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  finishPaper(c, g, opt);
  return { c, x0, y0, w, h, K, col: opt.col || PAL.red };
}
// 纸质：soft-light 纤维斑驳 + 刀口亮 / 暗边，最后用原 alpha 还原镂空
export function finishPaper(c, g, opt = {}) {
  const W = c.width, H = c.height, [m, mg] = canvas(W, H); mg.drawImage(c, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (opt.tex !== false) {
    const pat = g.createPattern(paperGrain(), 'repeat'), s = opt.seed || 0;
    pat.setTransform(new DOMMatrix([opt.texScale || 1, 0, 0, opt.texScale || 1, (s * 137) % 768, (s * 71) % 768]));
    g.globalCompositeOperation = 'soft-light'; g.fillStyle = pat; g.fillRect(0, 0, W, H);
  }
  // 刀口：左上亮边、右下暗边（纸的切面，约 1 px）
  const e = opt.edge ?? 1.2;
  if (e > 0) {
    const [r, rg] = canvas(W, H);
    rg.drawImage(m, 0, 0); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(m, e, e);
    rg.globalCompositeOperation = 'source-in'; rg.fillStyle = 'rgba(255,190,170,.55)'; rg.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-atop'; g.drawImage(r, 0, 0);
    rg.globalCompositeOperation = 'source-over'; rg.clearRect(0, 0, W, H);
    rg.drawImage(m, 0, 0); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(m, -e, -e);
    rg.globalCompositeOperation = 'source-in'; rg.fillStyle = 'rgba(60,0,8,.45)'; rg.fillRect(0, 0, W, H);
    g.drawImage(r, 0, 0);
  }
  g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0);
  g.restore();
}
// 贴到画面：M = 当前世界→屏幕矩阵已在 g 上；片自己的局部变换由调用者 setTransform
export function drawPiece(g, p) { g.drawImage(p.c, p.x0, p.y0, p.w, p.h); }
// 纸影：设置当前 context 的阴影（设备像素，不受变换影响）；z = 纸离底的高度感（1 = 贴纸）
export function paperShadow(g, zoom = 1, z = 1, col = PAL.shadow) {
  g.shadowColor = col; g.shadowBlur = 5 * zoom * z; g.shadowOffsetX = 2.6 * zoom * z; g.shadowOffsetY = 3.6 * zoom * z;
}
export function noShadow(g) { g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; }

// ---------- 背光透射 ----------
// 给一个片生成"透射贴图"：纸处 = 透射色（带厚薄斑驳），镂空处透明。用 multiply 画在光场上：纸 = 光×透射，孔 = 原光
export function transmitOf(p, col = PAL.transmit, seed = 0) {
  if (p.tr && p.trCol === col) return p.tr;
  const W = p.c.width, H = p.c.height, [c, g] = canvas(W, H);
  g.fillStyle = col; g.fillRect(0, 0, W, H);
  const pat = g.createPattern(paperGrain(), 'repeat'); pat.setTransform(new DOMMatrix([1, 0, 0, 1, (seed * 97) % 768, (seed * 53) % 768]));
  g.globalCompositeOperation = 'overlay'; g.fillStyle = pat; g.fillRect(0, 0, W, H);   // 纤维厚处更暗、薄处更亮
  g.globalCompositeOperation = 'destination-in'; g.drawImage(p.c, 0, 0);
  p.tr = c; p.trCol = col; return c;
}
// 只要"孔"的形状（alpha = 1 - 纸），用于投影光和辉光：box 内反相
export function holesOf(p) {
  if (p.holes) return p.holes;
  const W = p.c.width, H = p.c.height, [c, g] = canvas(W, H);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'destination-out'; g.drawImage(p.c, 0, 0);
  p.holes = c; return c;
}
