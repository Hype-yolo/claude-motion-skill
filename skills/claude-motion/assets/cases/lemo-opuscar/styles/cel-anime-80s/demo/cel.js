// 赛璐璐绘制工具：平滑/折角混合路径、平涂 + 硬边阴影 + 硬边高光 + 彩色描线、飘带、离屏画布
export const W = 1920, H = 1080;
export const TAU = Math.PI * 2;
export const LWK = { k: 1 };   // 全局描线粗细倍率（大特写时调细）

export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); return [c, g];
}

// pts: [[x,y], [x,y,1] (1 = 折角)]；Catmull-Rom → 三次贝塞尔
export function path(pts, closed = true, tension = 1) {
  const p = new Path2D(), n = pts.length;
  if (n < 2) return p;
  const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  p.moveTo(pts[0][0], pts[0][1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const k = tension / 6;
    let c1x = p1[0] + (p2[0] - p0[0]) * k, c1y = p1[1] + (p2[1] - p0[1]) * k;
    let c2x = p2[0] - (p3[0] - p1[0]) * k, c2y = p2[1] - (p3[1] - p1[1]) * k;
    if (p1[2] || (!closed && i === 0)) { c1x = p1[0] + (p2[0] - p1[0]) / 3; c1y = p1[1] + (p2[1] - p1[1]) / 3; }
    if (p2[2] || (!closed && i === segs - 1)) { c2x = p2[0] - (p2[0] - p1[0]) / 3; c2y = p2[1] - (p2[1] - p1[1]) / 3; }
    p.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
  }
  if (closed) p.closePath();
  return p;
}
export const poly = (pts, closed = true) => path(pts.map(q => [q[0], q[1], 1]), closed);

// 平涂 + 阴影 + 高光 + 描线
// o = { f: 底色, s: 阴影色, so: [dx,dy] 自动阴影（亮部副本朝光源方向的偏移，剩下的背光月牙就是阴影）,
//       sh: [pts|Path2D...] 额外阴影形, h: 高光色, ho: [dx,dy] 自动高光（朝背光方向偏移）, hi: [...] 额外高光形,
//       rim: {c, d:[dx,dy]} 轮廓光, l: 线色, lw }
const crescent = (P, d) => { const Q = new Path2D(); Q.addPath(P); Q.addPath(P, new DOMMatrix().translate(d[0], d[1])); return Q; };
export function cel(g, pts, o) {
  const P = pts instanceof Path2D ? pts : path(pts);
  if (o.f) { g.fillStyle = o.f; g.fill(P); }
  const toP = x => x instanceof Path2D ? x : path(x);
  if (o.so || o.ho || o.rim || (o.sh && o.sh.length) || (o.hi && o.hi.length) || o.clipFn) {
    g.save(); g.clip(P);
    if (o.so) { g.fillStyle = o.s; g.fill(crescent(P, o.so), 'evenodd'); }
    if (o.sh) { g.fillStyle = o.s; for (const s of o.sh) g.fill(toP(s)); }
    if (o.s2 && o.sh2) { g.fillStyle = o.s2; for (const s of o.sh2) g.fill(toP(s)); }
    if (o.ho) { g.fillStyle = o.h; g.fill(crescent(P, o.ho), 'evenodd'); }
    if (o.hi) { g.fillStyle = o.h; for (const s of o.hi) g.fill(toP(s)); }
    if (o.rim) { g.fillStyle = o.rim.c; g.fill(crescent(P, o.rim.d), 'evenodd'); }
    if (o.clipFn) o.clipFn(g, P);
    g.restore();
  }
  if (o.l) { g.strokeStyle = o.l; g.lineWidth = (o.lw || 2.2) * LWK.k; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(P); }
  return P;
}
export function line(g, pts, col, lw = 2, closed = false) {
  const P = pts instanceof Path2D ? pts : path(pts, closed);
  g.strokeStyle = col; g.lineWidth = lw * LWK.k; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(P);
}

// 飘带（头发束 / 围巾）：中心线 + 宽度函数 → 闭合形
// spine: [[x,y]...], width: i/n → 宽度；tip 尖/平
export function ribbon(spine, width) {
  const n = spine.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = width(i / (n - 1)) / 2;
    L.push([spine[i][0] - dy * w, spine[i][1] + dx * w]); R.push([spine[i][0] + dy * w, spine[i][1] - dx * w]);
  }
  return L.concat(R.reverse());
}
// 沿方向飘动的中心线：起点 (x,y)，基本方向 ang，长度 len，段数 n，波动 amp/波长/相位
export function flutter(x, y, ang, len, n, amp, waves, phase, droop = 0) {
  const pts = [], ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), s = u * len;
    const off = Math.sin(u * waves * TAU - phase) * amp * Math.pow(u, .8) + droop * u * u;
    pts.push([x + ca * s - sa * off, y + sa * s + ca * off]);
  }
  return pts;
}

// 颜色工具
export function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
export function mix(a, b, t) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
export function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }

// 确定性随机
export function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// 喷枪：柔边椭圆光斑
export function airbrush(g, x, y, rx, ry, col, a = 1, soft = 1) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, rgba(col, a)); gr.addColorStop(Math.max(0, 1 - soft), rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
}
export function vgrad(g, x, y, w, h, stops) {
  const gr = g.createLinearGradient(0, y, 0, y + h); for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
}
