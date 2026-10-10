// ---------- 基础工具 ----------
const W = 1920, H = 1080;
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let RNG = mulberry(20260924);
const rnd = (a = 0, b = 1) => a + (b - a) * RNG();
const pick = a => a[Math.floor(RNG() * a.length)];
function withSeed(seed, fn) { const keep = RNG; RNG = mulberry(seed); try { return fn(); } finally { RNG = keep; } }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const ei = t => Math.pow(clamp(t), 2.2);
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const vnoise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
const fbm = x => vnoise(x) * .55 + vnoise(x * 2.1 + 17) * .3 + vnoise(x * 4.3 + 41) * .15;

// 单调三次插值（Fritsch–Carlson），相机路径用
function monotone(keys) {
  const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return t => {
    if (t <= xs[0]) return ys[0]; if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = (t - xs[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}

// ---------- 颜色 ----------
const PAPER = '#f1e9da', INK = '#2b2520', INK2 = '#3d3129';
const _rgb = {};
const hex2rgb = h => _rgb[h] || (_rgb[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const mixc = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const rgba = (h, a) => { const c = hex2rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(3)})`; };

// ---------- 笔触 ----------
function qcurve(x0, y0, x1, y1, bend = 0, n = 12) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const cx = mx - dy / L * bend, cy = my + dx / L * bend, out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); }
  return out;
}
function qctrl(x0, y0, cx, cy, x1, y1, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); }
  return out;
}
const polar = (x, y, a, len, bend = 0, n = 8) => qcurve(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, bend, n);

// 一笔：中心线 + 宽度轮廓 + 干笔飞白（若干"毛"）
function mk(pts, w, col, o = {}) {
  const n = pts.length, ws = [], nx = [], ny = [];
  const seed = rnd(0, 1000), rough = o.rough ?? .22, prof = o.prof || 'brush';
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1); let f;
    if (prof === 'leaf') f = Math.pow(Math.sin(Math.PI * (s * .94 + .03)), .7);
    else if (prof === 'even') f = Math.min(1, s / .06 + .35) * Math.min(1, (1 - s) / .08 + .4);
    else if (prof === 'tip') f = Math.pow(1 - s * .92, .85) * Math.min(1, s / .05 + .6);
    else if (prof === 'trunk') f = (1 - s * .62) * (1 + Math.max(0, .06 - s) * 9);
    else f = Math.min(1, s / .1 + .3) * Math.pow(1 - s * .85, .6);
    ws.push(Math.max(.5, w * f * (1 + rough * (vnoise(seed + i * .9) * 2 - 1))));
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    nx.push(-dy / L); ny.push(dx / L);
  }
  const nb = o.nb ?? (w >= 6 ? Math.min(9, Math.max(3, Math.round(w / 3.2))) : 0);
  let br = null;
  if (nb > 0) {
    br = [];
    for (let j = 0; j < nb; j++) {
      const dash = []; for (let k = 0; k < 6; k++) dash.push(k % 2 ? rnd(1, w * .5 + 3) : rnd(18, 90));
      br.push({ off: rnd(-.46, .46), bw: Math.max(.7, w / nb * rnd(.6, 1.3)), a: rnd(.3, .85), end: rnd(.72, 1), dash });
    }
  }
  return { pts, ws, nx, ny, col, a: o.a ?? .92, rib: o.rib ?? (nb ? .62 : .92), br };
}

function drawS(c, s, p = 1, col = null, am = 1) {
  if (p <= 0) return;
  const P = s.pts, n = P.length, m = (n - 1) * clamp(p), k = Math.floor(m), f = m - k, cc = col || s.col;
  const cnt = f > .001 && k < n - 1 ? k + 2 : k + 1;
  const X = i => i <= k ? P[i][0] : lerp(P[k][0], P[k + 1][0], f), Y = i => i <= k ? P[i][1] : lerp(P[k][1], P[k + 1][1], f);
  c.beginPath();
  for (let i = 0; i < cnt; i++) { const j = Math.min(i, n - 1), hw = s.ws[j] / 2 * (p < 1 && i === cnt - 1 ? .5 : 1); const x = X(i) + s.nx[j] * hw, y = Y(i) + s.ny[j] * hw; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  for (let i = cnt - 1; i >= 0; i--) { const j = Math.min(i, n - 1), hw = s.ws[j] / 2 * (p < 1 && i === cnt - 1 ? .5 : 1); c.lineTo(X(i) - s.nx[j] * hw, Y(i) - s.ny[j] * hw); }
  c.closePath(); c.fillStyle = rgba(cc, s.a * s.rib * am); c.fill();
  if (s.br) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const b of s.br) {
      const e = Math.min(m, (n - 1) * b.end), kk = Math.floor(e); if (kk < 1) continue;
      c.beginPath();
      for (let i = 0; i <= kk; i++) { const hw = s.ws[i] * b.off, x = P[i][0] + s.nx[i] * hw, y = P[i][1] + s.ny[i] * hw; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.setLineDash(b.dash); c.lineWidth = b.bw; c.strokeStyle = rgba(cc, s.a * b.a * am); c.stroke();
    }
    c.setLineDash([]);
  }
}

// 一组笔触按顺序"画出来"：p∈[0,1]
function drawList(c, L, p = 1, col = null, am = 1) {
  const N = L.length; if (!N) return;
  if (p >= 1) { for (const s of L) drawS(c, s, 1, col, am); return; }
  const dur = Math.min(.5, Math.max(.12, 4 / N));
  for (let j = 0; j < N; j++) { const t0 = j / N * (1 - dur); drawS(c, L[j], (p - t0) / dur, col, am); }
}

function bbox(L, pad = 6) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of L) for (let i = 0; i < s.pts.length; i++) { const [x, y] = s.pts[i], w = s.ws[i]; x0 = Math.min(x0, x - w); y0 = Math.min(y0, y - w); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + w); }
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
}
function sprite(L, col = null) {
  const [x0, y0, x1, y1] = bbox(L), cv = document.createElement('canvas');
  cv.width = Math.max(1, x1 - x0); cv.height = Math.max(1, y1 - y0);
  const c = cv.getContext('2d'); c.translate(-x0, -y0); for (const s of L) drawS(c, s, 1, col);
  return { cv, x0, y0, x1, y1 };
}

// 叶团：一簇点叶
function clump(S, cx, cy, r, n, cols, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), rr = r * Math.sqrt(rnd());
    const x = cx + Math.cos(a) * rr * (o.sx ?? 1.25), y = cy + Math.sin(a) * rr * (o.sy ?? .8);
    const d = o.dir !== undefined ? o.dir + rnd(-(o.spread ?? .6), o.spread ?? .6) : rnd(0, Math.PI * 2);
    const len = rnd(o.l0 ?? 10, o.l1 ?? 22), w = rnd(o.w0 ?? 6, o.w1 ?? 12);
    S.push(mk(qcurve(x, y, x + Math.cos(d) * len, y + Math.sin(d) * len, rnd(-3, 3), 5), w, pick(cols), { prof: 'leaf', nb: w > 9 ? 3 : 0, a: rnd(o.a0 ?? .72, o.a1 ?? .95), rough: .3 }));
  }
}
// 沿笔触一侧的墨线（树干明暗边）
function edgeOf(s, side, w, col, a = .85) {
  const pts = s.pts.map((p, i) => [p[0] + s.nx[i] * s.ws[i] * .47 * side, p[1] + s.ny[i] * s.ws[i] * .47 * side]);
  return mk(pts, w, col, { prof: 'even', nb: 0, a, rough: .35 });
}
