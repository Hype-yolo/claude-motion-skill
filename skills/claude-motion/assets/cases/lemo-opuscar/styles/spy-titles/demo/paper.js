// 剪纸 + 丝网平涂引擎：4 色纸、剪刀毛边（局部坐标里剪一次，形状跟着纸片走，不"沸腾"）、切缝、纸影、纸纹
import { hash, vnoise, clamp } from '/core/lib.js';

export const W = 1920, H = 1080;
export const C = {
  ink: '#1b1714', paper: '#efe4c9', red: '#d23a22', mus: '#e2a52a',
  redD: '#9a2a18', musD: '#b07e1c', paperD: '#d9ccae', inkL: '#3a322b',
};
export const cv = document.getElementById('c');
export const gMain = cv.getContext('2d');
export let g = gMain;   // 活绑定：画剪影图层时临时指向图层
export function setG(c) { g = c; }

// ── 场景状态：切缝颜色 = 当前场景底色（纸片之间露出的底板） ──
export const S = { bg: C.paper, gap: 2.4, shadow: true, shAlpha: .30 };
export function clear(col) { S.bg = col; const m = g.getTransform(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = col; g.fillRect(0, 0, W, H); g.setTransform(m); }   // 保留摄像机变换

// 当前变换的缩放（切缝/描边要保持屏幕像素宽）
export function curScale(ctx = g) { const m = ctx.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; }

// ── 剪刀毛边：沿轮廓重采样，按弧长做低频摆动 + 偶尔一个小豁口；种子固定 → 同一纸片永远同一个剪边 ──
const cache = new Map();
export function rough(pts, seed = 1, amp = 1.3, step = 10, closed = true) {
  const n = pts.length, out = [];
  let s = 0;
  const E = closed ? n : n - 1;
  for (let i = 0; i < E; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-6;
    const nx = -dy / L, ny = dx / L;
    const k = Math.max(1, Math.round(L / step));
    for (let j = 0; j < k; j++) {
      const u = j / k, ss = s + u * L;
      // 角点不偏（剪刀在角上是准的），边中间摆动
      const w = j === 0 ? .25 : 1;
      let o = (vnoise(ss / (step * 2.3) + seed * 17.13) * 2 - 1) * amp * w;
      o += (vnoise(ss / (step * .55) + seed * 5.7) * 2 - 1) * amp * .35 * w;
      if (hash(Math.floor(ss / (step * 3)) + seed * 91.7) > .965 && j > 0) o -= amp * 1.6; // 小豁口
      out.push([a[0] + dx * u + nx * o, a[1] + dy * u + ny * o]);
    }
    s += L;
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
export function roughC(key, fn, seed, amp, step) {  // 缓存版（形状恒定的纸片）
  let r = cache.get(key); if (!r) { r = rough(fn(), seed, amp, step); cache.set(key, r); } return r;
}
export function pathPoly(ctx, pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }

// 画一块纸片：polys = 一个或多个轮廓（evenodd 镂空）。opt: gap（切缝像素，0 关）、shadow、gapCol
export function piece(polys, col, opt = {}, ctx = g) {
  if (!Array.isArray(polys[0][0])) polys = [polys];
  const sc = curScale(ctx);
  ctx.beginPath(); for (const p of polys) pathPoly(ctx, p);
  if (S.inLayer && !opt.force) {   // 剪影图层里：纸片直接融成一个外轮廓；opt.cut = 挖一圈透明缝
    if (opt.cut) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineJoin = 'round'; ctx.lineWidth = opt.cut * 2 / sc; ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = col; ctx.fill('evenodd'); return;
  }
  const gap = opt.gap ?? S.gap;
  if (gap > 0 && opt.gapCol !== null) {
    ctx.lineJoin = 'round'; ctx.lineWidth = gap * 2 / sc; ctx.strokeStyle = opt.gapCol || S.bg; ctx.stroke();
  }
  if ((opt.shadow ?? S.shadow) && !ctx.__noShadow) {
    ctx.save();
    ctx.shadowColor = `rgba(20,12,6,${opt.shA ?? S.shAlpha})`; ctx.shadowBlur = (opt.shB ?? 5);
    ctx.shadowOffsetX = opt.shX ?? 2.5; ctx.shadowOffsetY = opt.shY ?? 3.5;
    ctx.fillStyle = col; ctx.fill('evenodd'); ctx.restore();
  } else { ctx.fillStyle = col; ctx.fill('evenodd'); }
}

// 基本形状（局部坐标，未剪边）
export function rectP(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
export function circP(cx, cy, r, n = 0, a0 = 0) { n = n || Math.max(18, Math.round(r * .9)); const o = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
export function ellP(cx, cy, rx, ry, n = 40, rot = 0) { const o = [], c = Math.cos(rot), s = Math.sin(rot); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; o.push([cx + x * c - y * s, cy + x * s + y * c]); } return o; }
export function arcP(cx, cy, r, a0, a1, n = 24) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
// 平滑折线（Chaikin），剪纸也要有圆弧
export function smooth(pts, it = 2, closed = true) {
  for (let k = 0; k < it; k++) {
    const o = [], n = pts.length, E = closed ? n : n - 1;
    if (!closed) o.push(pts[0]);
    for (let i = 0; i < E; i++) { const a = pts[i], b = pts[(i + 1) % n]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); }
    if (!closed) o.push(pts[n - 1]);
    pts = o;
  }
  return pts;
}
export function xf(pts, x = 0, y = 0, s = 1, r = 0) { const c = Math.cos(r), sn = Math.sin(r); return pts.map(([a, b]) => [x + (a * c - b * sn) * s, y + (a * sn + b * c) * s]); }

// ── 纸纹：一次生成，最后整屏 multiply；墨色区域里撒一点漏印的纸白 ──
let tex = null, speck = null;
function makeTex() {
  tex = document.createElement('canvas'); tex.width = W; tex.height = H;
  const t = tex.getContext('2d'), im = t.createImageData(W, H), d = im.data;
  let sd = 12345; const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  // 低频云纹 + 纤维
  const low = new Float32Array((W / 8 + 2) * (H / 8 + 2)); const lw = W / 8 + 2;
  for (let i = 0; i < low.length; i++) low[i] = rnd();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = x / 8, gy = y / 8, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
    const l = (low[iy * lw + ix] * (1 - fx) + low[iy * lw + ix + 1] * fx) * (1 - fy) + (low[(iy + 1) * lw + ix] * (1 - fx) + low[(iy + 1) * lw + ix + 1] * fx) * fy;
    const v = 255 - (l * 14 + rnd() * 12);
    const i4 = (y * W + x) * 4; d[i4] = v; d[i4 + 1] = v - 1; d[i4 + 2] = v - 4; d[i4 + 3] = 255;
  }
  t.putImageData(im, 0, 0);
  // 纤维
  t.globalAlpha = .06; t.strokeStyle = '#6b5a40'; t.lineWidth = 1;
  for (let i = 0; i < 2600; i++) { const x = rnd() * W, y = rnd() * H, a = rnd() * 6.28, l = 6 + rnd() * 22; t.beginPath(); t.moveTo(x, y); t.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); t.stroke(); }
  // 漏印白点（screen 叠加，只在深色上显出来）
  speck = document.createElement('canvas'); speck.width = W; speck.height = H;
  const s2 = speck.getContext('2d'); s2.fillStyle = '#000'; s2.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { const x = rnd() * W, y = rnd() * H, r = rnd() < .9 ? .6 + rnd() * .9 : 1.5 + rnd() * 1.5; s2.fillStyle = `rgba(120,108,88,${.25 + rnd() * .5})`; s2.beginPath(); s2.arc(x, y, r, 0, 7); s2.fill(); }
  // 丝网墨层的横向刮墨条纹（很淡）
  for (let y = 0; y < H; y += 3) { const a = vnoise(y / 37) * .05; s2.fillStyle = `rgba(90,80,64,${a})`; s2.fillRect(0, y, W, 3); }
}
export function paperFinish(amt = 1) {
  if (!tex) makeTex();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = amt; g.globalCompositeOperation = 'multiply'; g.drawImage(tex, 0, 0);
  g.globalAlpha = .55 * amt; g.globalCompositeOperation = 'screen'; g.drawImage(speck, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

// 文字（普通 canvas 字，用于小标注）
export function label(s, x, y, font, col, align = 'left', ls = 0) {
  g.save(); g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'alphabetic';
  if (ls) g.letterSpacing = ls + 'px';
  g.fillText(s, x, y); g.restore();
}

// ── 剪影图层：角色的纸片先在图层里融成一个外轮廓（内部只留关节缝），再整体贴到主画布：
//    外圈 2.4px 底色缝（与后面的字母/布景分开）+ 一层纸影 ──
let LC = null, LT = null;
export function silhouette(fn, opt = {}) {
  if (!LC) { LC = document.createElement('canvas'); LC.width = W; LC.height = H; LT = document.createElement('canvas'); LT.width = W; LT.height = H; }
  const L = LC.getContext('2d'), T2 = LT.getContext('2d'), main = g;
  L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, W, H); L.setTransform(main.getTransform());
  g = L; S.inLayer = true;
  try { fn(); } finally { g = main; S.inLayer = false; }
  const r = opt.outline ?? S.gap;
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0);
  if (r > 0) {
    T2.setTransform(1, 0, 0, 1, 0, 0); T2.globalCompositeOperation = 'source-over'; T2.clearRect(0, 0, W, H); T2.drawImage(LC, 0, 0);
    T2.globalCompositeOperation = 'source-in'; T2.fillStyle = opt.outlineCol || S.bg; T2.fillRect(0, 0, W, H); T2.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; main.drawImage(LT, Math.cos(a) * r, Math.sin(a) * r); }
  }
  if (opt.shadow ?? true) { main.shadowColor = `rgba(20,12,6,${opt.shA ?? .32})`; main.shadowBlur = 5; main.shadowOffsetX = 3; main.shadowOffsetY = 4; }
  main.globalAlpha = opt.alpha ?? 1;
  main.drawImage(LC, 0, 0);
  main.restore();
}
// 关节缝：在图层里挖一道透明细缝（x,y 局部坐标；ang = 缝的方向；len 局部单位；w 屏幕像素）
export function slit(x, y, ang, len, w = 1.7) {
  const sc = curScale();
  g.save(); g.translate(x, y); g.rotate(ang); g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000'; g.fillRect(-len / 2, -w / 2 / sc, len, w / sc); g.restore();
}
