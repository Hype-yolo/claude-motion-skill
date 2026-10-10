// 制图引擎：纸面坐标 → 斜二测投影 → 镜头 → 屏幕；所有几何都是折线，便于"按长度画出"。
// ink 画布：白 = 曝光的线，黑 = 纸（黑色填充 = 消隐）。fx 画布：R 投影 / G 水渍 / B 印章（lighter 叠加）。
export const W = 1920, H = 1080;
export const inkC = document.createElement('canvas'); inkC.width = W; inkC.height = H;
export const fxC = document.createElement('canvas'); fxC.width = W; fxC.height = H;
export const ovC = document.createElement('canvas'); ovC.width = W; ovC.height = H;
export const g = inkC.getContext('2d'), f = fxC.getContext('2d'), ov = ovC.getContext('2d');
export const TAU = Math.PI * 2;
export const cam = { x: 1600, y: 1000, z: .6, r: 0 };
export const proj = { k: 0, a: Math.PI / 4 };
export const LW = { out: 3.2, det: 2.0, thin: 1.25, hair: .9 };
let zp = 1;
export function setCam(c) { Object.assign(cam, c); zp = Math.pow(cam.z, .65); }
export const lw = w => w * zp;
export function clear() {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over'; f.filter = 'none';
  f.fillStyle = '#000'; f.fillRect(0, 0, W, H);
  ov.setTransform(1, 0, 0, 1, 0, 0); ov.clearRect(0, 0, W, H);
}
// 纸面点（含深度）→ 屏幕
export function S(x, y, d = 0) {
  if (d) { x += d * proj.k * Math.cos(proj.a); y -= d * proj.k * Math.sin(proj.a); }
  const dx = x - cam.x, dy = y - cam.y, c = Math.cos(cam.r), s = Math.sin(cam.r);
  return [(c * dx - s * dy) * cam.z + W / 2, (s * dx + c * dy) * cam.z + H / 2];
}
// 镜头矩阵（给文字 / 裁剪用）
export function camMatrix(ctx, x = 0, y = 0, rot = 0, d = 0) {
  const [sx, sy] = S(x, y, d), c = Math.cos(cam.r + rot) * cam.z, s = Math.sin(cam.r + rot) * cam.z;
  ctx.setTransform(c, s, -s, c, sx, sy);
}
export function plen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
// 截取折线前 u（0–1）部分，返回 [折线, 笔尖点]
export function trunc(p, u) {
  if (u >= 1) return [p, null]; if (u <= 0) return [[], null];
  const L = plen(p) * u; let acc = 0; const out = [p[0]];
  for (let i = 1; i < p.length; i++) {
    const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (acc + l >= L) { const k = (L - acc) / (l || 1); const q = [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k]; out.push(q); return [out, q]; }
    acc += l; out.push(p[i]);
  }
  return [out, p[p.length - 1]];
}
const DASH = { center: [34, 7, 6, 7], hidden: [11, 7], phantom: [30, 6, 5, 6, 5, 6], dot: [2, 7] };
function pathScreen(ctx, pts, d, closed) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) { const [x, y] = S(pts[i][0], pts[i][1], d); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  if (closed) ctx.closePath();
}
export const NIBS = [];   // 本帧正在画的笔尖（发光点）
// 描线：o = {w, dash, closed, u (0-1 画出进度), d (深度), v (亮度), cap}
export function line(pts, o = {}) {
  if (!pts || pts.length < 2) return;
  const u = o.u ?? 1; if (u <= 0) return;
  let P = pts, closed = o.closed;
  if (u < 1) { const [tp, nib] = trunc(closed ? [...pts, pts[0]] : pts, u); P = tp; closed = false; if (nib && o.nib !== false) NIBS.push([nib[0], nib[1], o.d || 0]); }
  if (P.length < 2) return;
  const v = o.v ?? 1;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.strokeStyle = `rgb(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0})`;
  g.lineWidth = lw(o.w ?? LW.det); g.lineCap = o.cap || 'round'; g.lineJoin = 'round';
  if (o.dash) { g.setLineDash((DASH[o.dash] || o.dash).map(x => x * cam.z)); g.lineDashOffset = (o.dashOff || 0) * cam.z; } else g.setLineDash([]);
  pathScreen(g, P, o.d || 0, closed); g.stroke(); g.setLineDash([]);
}
// 消隐填充（纸色）
export function knock(pts, d = 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; pathScreen(g, pts, d, true); g.fill(); }
export function fillV(pts, v, d = 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgb(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0})`; pathScreen(g, pts, d, true); g.fill(); }
// 点在多边形内
export function inPoly(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
// 实体：闭合轮廓 + 厚度（斜二测挤出，自动消隐）。o = {d0, th, w, u, conn, v}
export function solid(pts, o = {}) {
  const d0 = o.d0 || 0, th = o.th || 0, w = o.w ?? LW.out, u = o.u ?? 1;
  if (u <= 0) return;
  const offPx = th * proj.k * cam.z;
  if (offPx > .8 && u >= 1) {
    const N = Math.min(40, Math.ceil(offPx / 1.4));
    g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = '#fff'; g.lineWidth = lw(w) * 2; g.lineJoin = 'round'; g.setLineDash([]);
    for (let i = N; i >= 0; i--) { pathScreen(g, pts, d0 + th * i / N, true); g.stroke(); }
    g.fillStyle = '#000';
    for (let i = N; i >= 0; i--) { pathScreen(g, pts, d0 + th * i / N, true); g.fill(); }
    // 前后面交界的可见棱（顶点连线：从顶点沿深度方向离开多边形 → 可见）
    if (o.conn !== false) {
      const dx = Math.cos(proj.a), dy = -Math.sin(proj.a);
      for (const p of pts) {
        const q = [p[0] + dx * 2.5, p[1] + dy * 2.5];
        if (!inPoly(q, pts)) line2(p, d0, d0 + th, w * .8);
      }
    }
  } else if (o.fill !== false) knock(pts, d0);
  line(pts, { w, closed: true, u, d: d0, v: o.v });
}
function line2(p, da, db, w) {
  const a = S(p[0], p[1], da), b = S(p[0], p[1], db);
  g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = '#fff'; g.lineWidth = lw(w); g.setLineDash([]);
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
}
// 剖面线（细线阴影法）：在多边形内画 45° 平行线
export function hatch(pts, o = {}) {
  const sp = o.sp ?? 14, ang = o.ang ?? Math.PI / 4, d = o.d || 0, u = o.u ?? 1;
  if (u <= 0) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); pathScreen(g, pts, d, true); g.clip();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + sp;
  const c = Math.cos(ang), s = Math.sin(ang), n = Math.ceil(2 * R / sp);
  g.strokeStyle = `rgb(${(o.v ?? .85) * 255 | 0},${(o.v ?? .85) * 255 | 0},${(o.v ?? .85) * 255 | 0})`; g.lineWidth = lw(o.w ?? LW.hair); g.setLineDash([]); g.lineCap = 'butt';
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = -R + i * sp; if (i / n > u) break;
    const ax = cx + (-s) * t - c * R, ay = cy + c * t - s * R, bx = cx + (-s) * t + c * R, by = cy + c * t + s * R;
    const A = S(ax, ay, d), B = S(bx, by, d); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
  }
  g.stroke(); g.restore(); g.lineCap = 'round';
}
// 几何工具
export const circ = (cx, cy, r, n = 64, a0 = 0, a1 = TAU) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
export const ell = (cx, cy, rx, ry, rot = 0, n = 64, a0 = 0, a1 = TAU) => { const p = [], c = Math.cos(rot), s = Math.sin(rot); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry; p.push([cx + c * x - s * y, cy + s * x + c * y]); } return p; };
export const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
export const xf = (pts, tx, ty, rot = 0, sc = 1) => { const c = Math.cos(rot) * sc, s = Math.sin(rot) * sc; return pts.map(([x, y]) => [tx + c * x - s * y, ty + s * x + c * y]); };
export function gearPts(cx, cy, T, m, rot = 0) {   // 渐开线近似：梯形齿
  const r = m * T / 2, ra = r + m, rf = r - 1.25 * m, p = [];
  for (let i = 0; i < T; i++) {
    const a = rot + i * TAU / T, h = TAU / T;
    const pts = [[rf, -.30], [ra, -.16], [ra, .16], [rf, .30]];
    for (const [rr, fa] of pts) { const aa = a + fa * h; p.push([cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr]); }
    for (let k = 1; k <= 3; k++) { const aa = a + (.30 + .4 * k / 4) * h; p.push([cx + Math.cos(aa) * rf, cy + Math.sin(aa) * rf]); }
  }
  return p;
}
// 文字（纸面单位字号）；u = 写出进度（从左到右揭示）
export const FONT = { hand: 'Architects', tech: 'B612', mono: 'B612Mono', sign: 'Allura' };
export function text(str, x, y, o = {}) {
  const size = o.size ?? 28, u = o.u ?? 1; if (u <= 0 || !str) return 0;
  const ctx = o.ctx || g;
  camMatrix(ctx, x, y, o.rot || 0, o.d || 0);
  ctx.font = `${o.weight || 400} ${size}px ${o.font || FONT.hand}`;
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
  if (o.ls) ctx.letterSpacing = o.ls + 'px'; else ctx.letterSpacing = '0px';
  const wdt = ctx.measureText(str).width;
  const v = o.v ?? 1; ctx.fillStyle = o.color || `rgb(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0})`;
  if (u < 1) {
    const x0 = o.align === 'center' ? -wdt / 2 : o.align === 'right' ? -wdt : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 4, -size * 1.4, wdt * u + 4, size * 2.2); ctx.clip();
    ctx.fillText(str, 0, 0); ctx.restore();
    // 笔尖
    const nx = x0 + wdt * u, ny = -size * .35, c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
    if (o.nib !== false) NIBS.push([x + c * nx - s * ny, y + s * nx + c * ny, o.d || 0]);
  } else ctx.fillText(str, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.letterSpacing = '0px';
  return wdt;
}
export function textW(str, size, font = FONT.hand, ls = 0) { g.font = `400 ${size}px ${font}`; g.letterSpacing = ls + 'px'; const w = g.measureText(str).width; g.letterSpacing = '0px'; return w; }
// 尺寸线：p1-p2，偏移 off（法线方向），文字 label
export function dim(p1, p2, off, label, o = {}) {
  const u = o.u ?? 1; if (u <= 0) return;
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1, tx = dx / L, ty = dy / L, nx = -ty, ny = tx;
  const d = o.d || 0, gap = 8, ext = 14;
  const a = [p1[0] + nx * off, p1[1] + ny * off], b = [p2[0] + nx * off, p2[1] + ny * off];
  const sg = Math.sign(off) || 1;
  line([[p1[0] + nx * gap * sg, p1[1] + ny * gap * sg], [a[0] + nx * ext * sg, a[1] + ny * ext * sg]], { w: LW.hair, u: Math.min(1, u * 2), d, nib: false });
  line([[p2[0] + nx * gap * sg, p2[1] + ny * gap * sg], [b[0] + nx * ext * sg, b[1] + ny * ext * sg]], { w: LW.hair, u: Math.min(1, u * 2), d, nib: false });
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], uu = Math.max(0, Math.min(1, u * 1.4 - .2));
  if (uu > 0) {
    const h = uu / 2;
    line([mid, [mid[0] - tx * L * h, mid[1] - ty * L * h]], { w: LW.hair, d, nib: false });
    line([mid, [mid[0] + tx * L * h, mid[1] + ty * L * h]], { w: LW.hair, d, nib: false });
    if (uu >= 1) { arrow(a, [tx, ty], d); arrow(b, [-tx, -ty], d); }
  }
  if (label && u > .6) {
    let ang = Math.atan2(ty, tx); if (ang > Math.PI / 2 + .01) ang -= Math.PI; if (ang < -Math.PI / 2 - .01) ang += Math.PI;
    const tsz = o.size ?? 24;
    const lx = mid[0] + nx * 6 * sg * 0 , ly = mid[1];
    // 文字放在尺寸线外侧（上方）
    const up = [Math.sin(ang), -Math.cos(ang)];
    text(label, lx + up[0] * 8, ly + up[1] * 8, { size: tsz, align: 'center', rot: ang, font: o.font || FONT.hand, d, u: Math.min(1, (u - .6) / .4), nib: false });
  }
}
export function arrow(p, dir, d = 0, len = 16, wid = 4.5) {
  const [tx, ty] = dir, nx = -ty, ny = tx;
  fillV([p, [p[0] + tx * len + nx * wid, p[1] + ty * len + ny * wid], [p[0] + tx * len - nx * wid, p[1] + ty * len - ny * wid]], 1, d);
}
// 零件号：引线 + 圆圈
export function balloon(from, to, num, o = {}) {
  const u = o.u ?? 1; if (u <= 0) return;
  const r = o.r ?? 22, d = o.d || 0, dd = o.dt ?? d;
  const dx = to[0] - from[0], dy = to[1] - from[1], L = Math.hypot(dx, dy) || 1;
  const end = [to[0] - dx / L * r, to[1] - dy / L * r];
  line([from, end], { w: LW.hair, u: Math.min(1, u * 1.6), d, nib: false });
  const dot = S(from[0], from[1], d); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.beginPath(); g.arc(dot[0], dot[1], lw(3.2), 0, TAU); g.fill();
  if (u > .5) {
    const uu = Math.min(1, (u - .5) * 2);
    knock(circ(to[0], to[1], r, 32), dd);
    line(circ(to[0], to[1], r, 40, -Math.PI / 2, -Math.PI / 2 + TAU), { w: LW.thin, u: uu, d: dd, nib: false });
    if (uu > .5) text(String(num), to[0], to[1] + r * .36, { size: r * 1.05, align: 'center', font: FONT.hand, d: dd });
  }
}
// 笔尖光点（正在画的地方）
export function nibs(a = 1) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [x, y, d] of NIBS) { const [sx, sy] = S(x, y, d); const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 16 * zp); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.25, `rgba(255,255,255,${.45 * a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(sx - 20 * zp, sy - 20 * zp, 40 * zp, 40 * zp); }
  NIBS.length = 0;
}
// fx：投影 / 水渍 / 印章
export function fxShadow(pts, a, blur, d = 0) { f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'lighter'; f.filter = blur ? `blur(${blur * cam.z}px)` : 'none'; f.fillStyle = `rgba(255,0,0,${a})`; pathScreen(f, pts, d, true); f.fill(); f.filter = 'none'; }
export function fxWet(x, y, r, a) { const [sx, sy] = S(x, y); const R = r * cam.z; f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'lighter'; const gr = f.createRadialGradient(sx, sy, 0, sx, sy, R); gr.addColorStop(0, `rgba(0,255,0,${a})`); gr.addColorStop(.72, `rgba(0,255,0,${a * .92})`); gr.addColorStop(1, 'rgba(0,255,0,0)'); f.fillStyle = gr; f.beginPath(); f.arc(sx, sy, R, 0, TAU); f.fill(); }
// 投影裁掉（物体本身不被自己的影子压暗）：R 通道清零
export function fxUnshadow(pts, d = 0) { f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'multiply'; f.filter = 'none'; f.fillStyle = 'rgb(0,255,255)'; pathScreen(f, pts, d, true); f.fill(); f.globalCompositeOperation = 'lighter'; }
