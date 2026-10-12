// v2 — crayon-on-paper, real 3/4 view: the snowman sits on a bench at an upright piano,
// seen from the piano's treble end. Scene is modelled in cm and projected with a pinhole camera.
//   node render.js stills 3 20 40     → out/still_*.png
//   node render.js video [file] [t0] [t1]
const { createCanvas } = require('@napi-rs/canvas');
const { spawn } = require('child_process');
const fs = require('fs');
const S = require('./score');

const W = 1080, H = 1080, FPS = 24;
const canvas = createCanvas(W, H);
let ctx = canvas.getContext('2d');
const mainCtx = ctx;
const layer = createCanvas(W, H), lctx = layer.getContext('2d');
// draw fn() on an offscreen layer and composite it at the given opacity (used for cross-fades)
function withLayer(alpha, fn) {
  if (alpha <= 0.001) return null;
  if (alpha >= 0.999) return fn();
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, W, H);
  ctx = lctx;
  let r;
  try { r = fn(); } finally { ctx = mainCtx; }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(layer, 0, 0); ctx.restore();
  return r;
}
const OUT = __dirname + '/out';

// ------------------------------------------------------------ utils
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (a, b) => (Math.imul(a | 0, 2654435761) ^ Math.imul((b | 0) + 7, 40503)) >>> 0;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const easeOut = u => 1 - Math.pow(1 - clamp(u), 3);
const easeInOut = u => { u = clamp(u); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const win = (t, a, b) => clamp((t - a) / (b - a));
const pulse = (t, a, b, c, d) => Math.min(smooth(win(t, a, b)), 1 - smooth(win(t, c, d)));
function rgb(h) { if (h[0] === 'r') return h.match(/\d+/g).slice(0, 3).map(Number); const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function tone(h, f) { const [r, g, b] = rgb(h); const m = x => Math.round(clamp(f > 0 ? x + (255 - x) * f : x * (1 + f), 0, 255)); return `rgb(${m(r)},${m(g)},${m(b)})`; }
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
    const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
    const u = (e || easeInOut)((t - t0) / (t1 - t0));
    return Array.isArray(v0) ? v0.map((x, j) => Array.isArray(x) ? x.map((y, k) => lerp(y, v1[j][k], u)) : lerp(x, v1[j], u)) : lerp(v0, v1, u);
  }
  return keys[keys.length - 1][1];
}
const B = (bar, beat = 1) => S.T(bar, beat);
let BOIL = 0;

// ------------------------------------------------------------ 3D camera (cm)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
let CAM;
function setCamera(pos, target, F) {
  const f = norm(sub(target, pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  CAM = { pos, f, r, u, F };
}
function P(p) {
  const d = sub(p, CAM.pos), z = Math.max(1, dot(d, CAM.f));
  return [W / 2 + CAM.F * dot(d, CAM.r) / z, H / 2 - CAM.F * dot(d, CAM.u) / z, z];
}
const PP = pts => pts.map(p => { const q = P(p); return [q[0], q[1]]; });
const pxcm = p => CAM.F / P(p)[2];
const toCam = p => norm(sub(CAM.pos, p));
function circle3(c, r, n = 40) {
  const o = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; o.push([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]); }
  return o;
}
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// axis-aligned box: draw the faces that face the camera
function box([x0, x1], [y0, y1], [z0, z1], color, o = {}) {
  const faces = [
    { n: [0, -1, 0], v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], sh: -0.3 },
    { n: [-1, 0, 0], v: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], sh: o.side ?? -0.12 },
    { n: [1, 0, 0], v: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], sh: o.side ?? -0.12 },
    { n: [0, 0, 1], v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], sh: 0 },
    { n: [0, 1, 0], v: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], sh: o.top ?? 0.12 },
  ];
  let k = 0;
  for (const f of faces) {
    k++;
    const fc = f.v.reduce((s, v) => add(s, mul(v, 0.25)), [0, 0, 0]);
    if (dot(f.n, sub(CAM.pos, fc)) <= 0) continue;
    crayon(polyPts(PP(f.v), o.step ?? 22), tone(color, f.sh), { ...o, seed: (o.seed ?? 1) * 7 + k, angle: o.angle ?? -0.8 });
  }
}

// ------------------------------------------------------------ 2D geometry
function ellipsePts(cx, cy, rx, ry, rot = 0, n = 40) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; p.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
  return p;
}
function polyPts(c, step = 20) {
  const p = [];
  for (let i = 0; i < c.length; i++) {
    const [x0, y0] = c[i], [x1, y1] = c[(i + 1) % c.length];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let j = 0; j < n; j++) p.push([lerp(x0, x1, j / n), lerp(y0, y1, j / n)]);
  }
  return p;
}
function bez(p0, p1, p2, p3, n = 16) {
  const o = [];
  for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u; o.push(p0.map((_, k) => v * v * v * p0[k] + 3 * v * v * u * p1[k] + 3 * v * u * u * p2[k] + u * u * u * p3[k])); }
  return o;
}
function jitter(pts, a, R) { return pts.map(([x, y]) => [x + (R() - .5) * a, y + (R() - .5) * a]); }
function trace(pts, closed = true) {
  ctx.beginPath();
  const n = pts.length;
  if (!closed) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]); return; }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m = mid(pts[n - 1], pts[0]); ctx.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const q = mid(pts[i], pts[(i + 1) % n]); ctx.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
  ctx.closePath();
}
function bbox(pts) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; }
function ribbon(center, w0, w1 = w0) {
  const L = [], R = [];
  for (let i = 0; i < center.length; i++) {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / (center.length - 1)) / 2;
    L.push([center[i][0] - dy / d * w, center[i][1] + dx / d * w]); R.push([center[i][0] + dy / d * w, center[i][1] - dx / d * w]);
  }
  return [...L, ...R.reverse()];
}

// ------------------------------------------------------------ crayon
// low-frequency "hand pressure" field: strokes are heavier in some patches
const PRESS = (() => { const R = mulberry(71), g = []; for (let i = 0; i < 41 * 41; i++) g.push(R()); return (x, y) => { const gx = clamp(x / 30, 0, 39.99), gy = clamp(y / 30, 0, 39.99), ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy; return lerp(lerp(g[iy * 41 + ix], g[iy * 41 + ix + 1], fx), lerp(g[(iy + 1) * 41 + ix], g[(iy + 1) * 41 + ix + 1], fx), fy); }; })();
function crayon(pts, color, o = {}) {
  if (pts.length < 3) return;
  const [bx0, by0, bx1, by1] = bbox(pts);
  { // cull in screen space (the context may be transformed, e.g. for the cat)
    const m = ctx.getTransform();
    const xs = [], ys = [];
    for (const [x, y] of [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]]) { xs.push(m.a * x + m.c * y + m.e); ys.push(m.b * x + m.d * y + m.f); }
    if (Math.max(...xs) < -60 || Math.min(...xs) > W + 60 || Math.max(...ys) < -60 || Math.min(...ys) > H + 60) return;
  }
  const R = mulberry(hash(o.seed ?? 1, BOIL));
  const edge = jitter(pts, o.wob ?? 3, R);
  const sz = Math.max(bx1 - bx0, by1 - by0);
  const scale = o.fixed ? 1 : clamp(sz / 120, 0.35, 1);
  const gap = (o.gap ?? 5.5) * lerp(0.6, 1, scale), len = (o.len ?? 34) * lerp(0.4, 1, scale), w = (o.w ?? 3.2) * lerp(0.7, 1, scale);
  ctx.save();
  trace(edge); ctx.clip();
  if (o.base !== 0) { ctx.globalAlpha = o.base ?? 0.28; ctx.fillStyle = color; ctx.fill(); }
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, rad = Math.hypot(bx1 - bx0, by1 - by0) / 2 + 8;
  const passes = o.passes ?? [[o.angle ?? -0.75, 1]];
  const mix = o.mix; // [colour, share] — a second crayon layered in
  ctx.lineCap = 'round';
  for (const [ang0, dens] of passes) {
    const buckets = Array.from({ length: 8 }, () => []);
    const ca = Math.cos(ang0), sa = Math.sin(ang0);
    for (let d = -rad; d < rad; d += gap / dens * (0.6 + R() * 0.8)) {
      let s = -rad - R() * len;
      while (s < rad) {
        const l = len * (0.45 + R() * 1.1), a = ang0 + (R() - .5) * 0.26;
        const px = cx - sa * d + ca * s, py = cy + ca * d + sa * s;
        const heavy = PRESS(px, py) > 0.55 ? 1 : 0;
        const tn = mix && R() < mix[1] ? 3 : Math.floor(R() * 3);
        buckets[tn * 2 + heavy].push([px, py, px + Math.cos(a) * l, py + Math.sin(a) * l, (R() - .5) * 5]);
        s += l * (0.7 + R() * 0.45);
      }
    }
    buckets.forEach((ls, i) => {
      if (!ls.length) return;
      const tn = i >> 1, heavy = i & 1;
      ctx.beginPath();
      for (const [a, b, c, d, bow] of ls) { ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c) / 2 + bow, (b + d) / 2 - bow, c, d); }
      ctx.strokeStyle = tn === 3 ? mix[0] : tone(color, [-0.17, -0.03, 0.14][tn] * (o.var ?? 1));
      ctx.globalAlpha = (o.alpha ?? 0.8) * [0.9, 0.8, 0.6, 0.7][tn] * (heavy ? 1 : 0.72);
      ctx.lineWidth = w * [1.1, 1, 0.85, 0.9][tn] * (heavy ? 1.1 : 0.9);
      ctx.stroke();
    });
  }
  if (o.inner) o.inner(R);
  ctx.restore();
  if (o.rim !== false) {
    // broken, doubled contour like a real crayon outline
    const rc = o.rimColor ?? tone(color, -0.28);
    for (let p = 0; p < 2; p++) {
      ctx.setLineDash([20 + R() * 60, 3 + R() * 9, 30 + R() * 50, 2 + R() * 6]);
      ctx.lineDashOffset = R() * 100;
      trace(jitter(pts, 3.2, R)); ctx.strokeStyle = rc; ctx.globalAlpha = (o.rimAlpha ?? 0.55) * (p ? 0.55 : 1);
      ctx.lineWidth = (o.rimW ?? 2.8) * (p ? 0.6 : 1) * lerp(0.7, 1, scale); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}
function stroke(pts, color, w = 4, o = {}) {
  if (pts.length < 2) return;
  const R = mulberry(hash(o.seed ?? 5, BOIL));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let p = 0; p < (o.passes ?? 3); p++) {
    trace(jitter(pts, o.wob ?? 2.2, R), false);
    ctx.strokeStyle = p === 2 ? tone(color, 0.18) : color;
    ctx.globalAlpha = (o.alpha ?? 0.85) * [1, 0.6, 0.45][p];
    ctx.lineWidth = w * [1, 0.7, 0.5][p];
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ paper + tooth
const PAPER = [245, 237, 220];
const paperTex = new Uint8ClampedArray(W * H * 4);
{
  const R = mulberry(3);
  const lw = 40, lo = new Float32Array(lw * lw).map(() => R() - .5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = x / 30, gy = y / 30, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
    const v = lerp(lerp(lo[iy * lw + ix], lo[iy * lw + ix + 1], fx), lerp(lo[(iy + 1) * lw + ix], lo[(iy + 1) * lw + ix + 1], fx), fy);
    const n = v * 7 + (R() - .5) * 5 - (R() < 0.002 ? 16 : 0);
    const i = (y * W + x) * 4;
    paperTex[i] = PAPER[0] + n; paperTex[i + 1] = PAPER[1] + n; paperTex[i + 2] = PAPER[2] + n * 1.15; paperTex[i + 3] = 255;
  }
}
// tooth = how much wax the paper grabs. Two scales: cold-press bumps + streaky crayon drag.
function makeTooth(seed) {
  const R = mulberry(seed);
  const n = new Float32Array(W * H).map(() => R());
  const cw = Math.ceil(W / 3) + 2, coarse = new Float32Array(cw * cw).map(() => R());
  const out = new Uint8Array(W * H).fill(200);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x;
    const streak = (n[i] * 2 + n[i - W + 1] + n[i + W - 1] + n[i - 2 * W + 2] * 0.7 + n[i + 2 * W - 2] * 0.7 + n[i + 1] * 0.4 + n[i - 1] * 0.4) / 6.2;
    const gx = x / 3, gy = y / 3, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
    const cb = lerp(lerp(coarse[iy * cw + ix], coarse[iy * cw + ix + 1], fx), lerp(coarse[(iy + 1) * cw + ix], coarse[(iy + 1) * cw + ix + 1], fx), fy);
    const v = smooth((streak * 0.6 + cb * 0.4 - 0.28) / 0.34);
    out[i] = Math.round((0.18 + 0.82 * v) * 255);
  }
  return out;
}
const TOOTH = [makeTooth(11), makeTooth(12), makeTooth(13)];
function applyTooth(k) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data, T = TOOTH[k % 3];
  for (let p = 0, i = 0; p < T.length; p++, i += 4) {
    const dr = d[i] - PAPER[0], dg = d[i + 1] - PAPER[1], db = d[i + 2] - PAPER[2];
    const mag = (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
    let t = T[p] / 255;
    t = t + (1 - t) * Math.pow(clamp(mag / 200), 1.5) * 0.7;
    d[i] = paperTex[i] + dr * t; d[i + 1] = paperTex[i + 1] + dg * t; d[i + 2] = paperTex[i + 2] + db * t;
  }
  ctx.putImageData(img, 0, 0);
}

// ------------------------------------------------------------ palette & scene (cm)
const C = {
  piano: '#8db0d8', pianoDk: '#6f95c6', pianoLt: '#b5cbe7', pianoMix: '#9b9fd6', key: '#f7f1e3', keyEdge: '#9c978d', black: '#403c3f',
  sheet: '#f3ecdb', ink: '#2f2c2a', lamp: '#f5c34a', lampDk: '#d99b2b', wood: '#b07a52', woodDk: '#8a5a3a', floor: '#d8b98f',
  snow: '#ffffff', snowShade: '#aebfd6', coal: '#2a2728', carrot: '#ef7d2d', scarf: '#d8403a', twig: '#7a5534',
  cat: '#221f20', catEye: '#e9d24a', blossom: '#f4a9b8', branch: '#6f5642', water: '#7fb0de', wall2: '#efe3c9',
};
const FAR_X = -330;                         // far wall plane
const PIANO = { x0: -150, x1: -10, h: 128, d: 56 };
const KEY = { x0: -143, x1: -17, y: 72, z0: 60, z1: 76 };
const BENCH = { x0: -128, x1: -30, y: 50, z0: 92, z1: 126 };
const SEAT_Y = BENCH.y;
const LAMP = [-78, 131, 16];
const isWhite = m => [0, 2, 4, 5, 7, 9, 11].includes(((m % 12) + 12) % 12);
const whiteIdx = m => { let i = 0; for (let k = 21; k < m; k++) if (isWhite(k)) i++; return i; };
const KW = (KEY.x1 - KEY.x0) / 52;
const keyX = m => isWhite(m) ? KEY.x0 + (whiteIdx(m) + 0.5) * KW : KEY.x0 + whiteIdx(m) * KW;

function keyDepth(m, t) {
  let d = 0;
  for (const n of S.notes) {
    if (n.m !== m || n.t > t) continue;
    const off = n.t + Math.max(0.12, n.dur);
    if (t < off) d = Math.max(d, Math.min(1, (t - n.t) / 0.03 + 0.3));
    else if (t < off + 0.08) d = Math.max(d, 1 - (t - off) / 0.08);
  }
  return d;
}

// ------------------------------------------------------------ story clocks
const FINAL = S.FINAL, END_T = S.END_T, LEN = S.LEN;
const melt = t => clamp(track(t, [[0, 0], [B(5), 0.02], [B(9), 0.18, t => t], [B(13), 0.45, t => t], [FINAL, 0.86, t => t], [FINAL + 1.6, 1, easeOut]]));
const season = t => track(t, [[0, 0], [B(5), 0], [B(9), 0.5], [B(11), 1]]);

function chords(ns) {
  const g = [];
  for (const n of ns) { const l = g[g.length - 1]; if (l && Math.abs(l.t - n.t) < 0.03) l.ms.push(n.m); else g.push({ t: n.t, ms: [n.m] }); }
  return g.map(c => ({ t: c.t, x: c.ms.reduce((s, m) => s + keyX(m), 0) / c.ms.length }));
}
const LHs = chords(S.notes.filter(n => n.who === 'snow-l'));
const RHs = chords(S.notes.filter(n => n.who === 'snow-r').filter((n, i, a) => !(i > 0 && Math.abs(a[i - 1].t - n.t) < 0.03 && n.m < a[i - 1].m)));
const CATs = chords(S.notes.filter(n => n.who === 'cat'));
function handAt(seq, t, rest) {
  let i = -1;
  for (let k = 0; k < seq.length; k++) if (seq[k].t <= t + 0.06) i = k;
  const prev = i >= 0 ? seq[i] : { t: -9, x: rest }, next = seq[i + 1];
  let x = prev.x, lift = 0;
  if (next && next.t - prev.t < 2.2) {
    const a = prev.t + Math.min(0.14, (next.t - prev.t) * 0.4), b = next.t - 0.03;
    const u = clamp((t + 0.06 - a) / (b - a));
    x = lerp(prev.x, next.x, easeInOut(u)); lift = Math.sin(Math.PI * u) * Math.min(4, 1.5 + Math.abs(next.x - prev.x) * 0.15);
  }
  const hit = i >= 0 ? Math.exp(-Math.max(0, t - prev.t) / 0.07) : 0;
  return { p: [x, KEY.y + 1.2 + lift - hit * 0.5, 69], hit };
}

// ------------------------------------------------------------ room
function drawRoom(t) {
  const cTop = P([FAR_X, 400, 0]), cBot = P([FAR_X, 0, 0]);
  const farBot = P([FAR_X, 0, 260]), farTop = P([FAR_X, 400, 260]);
  // far wall is in shade
  crayon(polyPts([[cTop[0], cTop[1]], [cBot[0], cBot[1]], [farBot[0], farBot[1]], [farBot[0] - 2000, farBot[1] + 400], [farTop[0] - 2000, -400], [cTop[0], -400]], 40),
    C.wall2, { seed: 20, angle: -1.2, gap: 7, alpha: 0.35, base: 0.35, rim: false, len: 50 });
  // lamp glow
  const lg = P([LAMP[0], LAMP[1] + 25, LAMP[2]]);
  const g = ctx.createRadialGradient(lg[0], lg[1], 10, lg[0], lg[1], 620);
  g.addColorStop(0, 'rgba(255,200,105,0.6)'); g.addColorStop(0.45, 'rgba(255,205,120,0.2)'); g.addColorStop(1, 'rgba(255,205,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // floor
  const backR = P([60, 0, 0]);
  const floorPoly = [[farBot[0] - 2000, farBot[1] + 400], [farBot[0], farBot[1]], [cBot[0], cBot[1]], [backR[0], backR[1]], [backR[0] + 3000, backR[1] + 900], [W + 400, H + 400], [-400, H + 400]];
  crayon(polyPts(floorPoly, 40), C.floor, { seed: 21, angle: -0.35, gap: 5, len: 60, alpha: 0.7, base: 0.35, rim: false, mix: ['#c9a27a', 0.25] });
  for (let z = 14; z <= 220; z += 14) {
    const seg = [];
    for (let x = FAR_X; x <= 80; x += 20) { const q = P([x, 0, z]); if (q[2] > 20) seg.push([q[0], q[1]]); }
    if (seg.length > 1) stroke(seg, '#a88560', 1.8, { seed: 30 + z, passes: 2, alpha: 0.55 });
    const R = mulberry(z);
    for (let k = 0; k < 4; k++) { const x = FAR_X + 40 + R() * 380; const a = P([x, 0, z]), b = P([x, 0, z + 14]); if (a[2] > 20 && b[2] > 20) stroke([[a[0], a[1]], [b[0], b[1]]], '#a88560', 1.4, { seed: 40 + z + k, passes: 1, alpha: 0.5 }); }
  }
  // baseboards + corner
  crayon(polyPts(PP([[FAR_X + 0.5, 0, 0], [FAR_X + 0.5, 8, 0], [FAR_X + 0.5, 8, 260], [FAR_X + 0.5, 0, 260]]), 30), '#e9dcc4', { seed: 22, angle: -0.2, gap: 4, alpha: 0.6, rimColor: '#b8a58a' });
  crayon(polyPts(PP([[FAR_X, 0, 0.5], [60, 0, 0.5], [60, 8, 0.5], [FAR_X, 8, 0.5]]), 30), '#e9dcc4', { seed: 23, angle: -0.2, gap: 4, alpha: 0.6, rimColor: '#b8a58a' });
  stroke([[cTop[0], cTop[1]], [cBot[0], cBot[1]]], '#cdbb9d', 2.5, { seed: 24, passes: 2, alpha: 0.6 });
  // a small framed picture above the piano
  crayon(polyPts(PP([[-120, 172, 0.5], [-70, 172, 0.5], [-70, 212, 0.5], [-120, 212, 0.5]]), 14), '#e7ddc8', { seed: 25, angle: -0.8, gap: 6, alpha: 0.4, base: 0.6, rimColor: C.woodDk, rimAlpha: 0.8, rimW: 4 });
  const sun = P([-84, 200, 0.6]), ps = pxcm([-84, 200, 0]);
  crayon(ellipsePts(sun[0], sun[1], 5 * ps, 5 * ps, 0, 14), '#e9a3a0', { seed: 26, gap: 3, len: 10, w: 2.5, alpha: 0.8, rim: false, fixed: true });
  crayon(polyPts(PP([[-118, 175, 0.6], [-104, 188, 0.6], [-92, 182, 0.6], [-72, 192, 0.6], [-72, 175, 0.6]]), 8), '#9cc08a', { seed: 27, gap: 3, len: 10, w: 2.5, alpha: 0.85, rim: false, fixed: true });
}

// window on the far wall; the view outside follows the season
function winMap(u, v) {
  const q = P([FAR_X + 0.5, lerp(92, 205, v), lerp(175, 55, u)]); return [q[0], q[1]];
}
function drawWindow(t) {
  const sn = season(t);
  const quad = [winMap(0, 0), winMap(1, 0), winMap(1, 1), winMap(0, 1)];
  const sky = `rgb(${lerp(206, 196, sn) | 0},${lerp(218, 228, sn) | 0},${lerp(230, 244, sn) | 0})`;
  crayon(polyPts(quad, 20), sky, { seed: 60, angle: -0.4, gap: 8, alpha: 0.25, var: 0.2, base: 0.8, rim: false });
  ctx.save(); trace(polyPts(quad, 20)); ctx.clip();
  const hill = [[-0.1, 0], [-0.1, 0.3], [0.2, 0.38], [0.45, 0.3], [0.7, 0.42], [1.1, 0.33], [1.1, 0]].map(([u, v]) => winMap(u, v));
  crayon(polyPts(hill, 16), sn < 0.5 ? '#f4f6f9' : '#b5d39a', { seed: 61, angle: -0.3, gap: 5, alpha: 0.7, var: 0.4, rim: false });
  const roof = [[0.08, 0.3], [0.2, 0.46], [0.34, 0.3]].map(([u, v]) => winMap(u, v));
  crayon(polyPts(roof, 10), sn < 0.5 ? '#fafbfd' : '#c9745f', { seed: 62, gap: 4, alpha: 0.8, rimColor: '#9aa8b8', rimAlpha: 0.5 });
  if (sn > 0.05) {
    const grow = smooth(win(sn, 0.05, 0.7));
    const full = bez(winMap(1.05, 0.88), winMap(0.85, 0.94), winMap(0.55, 0.9), winMap(0.3, 0.8), 28);
    const n = Math.max(2, Math.round(grow * (full.length - 1)) + 1);
    const br = full.slice(0, n);
    stroke(br, C.branch, 6, { seed: 63 });
    [[0.2, -8], [0.35, 7], [0.5, -6], [0.62, 9], [0.78, -5], [0.9, 6]].forEach(([u, off], i) => {
      const k = smooth(win(sn, 0.3 + i * 0.08, 0.55 + i * 0.08));
      if (k <= 0) return;
      if (u > grow) return;
      const p = full[Math.round(u * (full.length - 1))];
      crayon(ellipsePts(p[0], p[1] + off, 10 * k, 9 * k, 0, 12), C.blossom, { seed: 64 + i, gap: 3, len: 9, w: 2.6, alpha: 0.9, rimAlpha: 0.4, fixed: true });
    });
  }
  const R = mulberry(77);
  const snowA = 1 - smooth(win(sn, 0.1, 0.45)), petalA = smooth(win(sn, 0.6, 1)), rainA = pulse(sn, 0.15, 0.3, 0.45, 0.6);
  const lateSnow = smooth(win(t, END_T + 0.6, END_T + 2));
  for (let i = 0; i < 50; i++) {
    const u = R(), sp = 0.05 + R() * 0.05, ph = R();
    const v = 1.05 - ((ph + t * sp) % 1.1);
    const [x, y] = winMap(u + Math.sin(t * 1.2 + i) * 0.02, v);
    const a = Math.max(snowA, lateSnow * (i % 2 ? 1 : 0));
    if (a > 0.02) { ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 2.5 + (i % 3), 0, 7); ctx.fill(); }
    if (petalA * (1 - lateSnow) > 0.02 && i % 3 === 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2 + i); ctx.globalAlpha = petalA * (1 - lateSnow); ctx.fillStyle = C.blossom; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, 7); ctx.fill(); ctx.restore(); }
    if (rainA > 0.02) { const [x2, y2] = winMap(u - 0.01, v - 0.05); ctx.globalAlpha = rainA * 0.5; ctx.strokeStyle = '#7f98b3'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  const fr = '#f3eee4', rimC = '#a99a88';
  const frame3 = (z0, z1, y0, y1, seed) => crayon(polyPts(PP([[FAR_X + 1, y0, z0], [FAR_X + 1, y0, z1], [FAR_X + 1, y1, z1], [FAR_X + 1, y1, z0]]), 16), fr, { seed, angle: -0.8, gap: 4, alpha: 0.85, rimColor: rimC, rimAlpha: 0.55, rimW: 2.2 });
  frame3(178, 172, 88, 208, 70); frame3(58, 52, 88, 208, 71); frame3(178, 52, 203, 208, 72);
  frame3(116, 112, 92, 205, 73); frame3(175, 55, 146, 150, 74);
  box([FAR_X, FAR_X + 9], [85, 91], [48, 182], '#f1ebe0', { seed: 75, gap: 4, alpha: 0.8, rimColor: rimC });
}

// ------------------------------------------------------------ piano
function drawPiano(t) {
  const { x0, x1, h, d } = PIANO;
  const base = { gap: 5, len: 40, alpha: 0.8, base: 0.25, mix: [C.pianoMix, 0.15] };
  box([x0, x0 + 7], [62, 77], [d, 80], C.piano, { seed: 100, ...base });
  box([x0, x0 + 7], [0, 62], [72, 79], C.piano, { seed: 99, ...base });
  crayon(polyPts(PP([[x0, 4, d], [x1, 4, d], [x1, 62, d], [x0, 62, d]]), 26), C.piano, { seed: 101, ...base, angle: -0.9 });
  crayon(polyPts(PP([[x0 + 16, 14, d + 0.5], [x1 - 16, 14, d + 0.5], [x1 - 16, 54, d + 0.5], [x0 + 16, 54, d + 0.5]]), 26), C.pianoLt, { seed: 102, gap: 6, alpha: 0.5, base: 0.1, rimColor: C.pianoDk, rimAlpha: 0.45, angle: -0.9 });
  for (const [dx, s] of [[-7, 1], [0, 2], [7, 3]]) box([-86 + dx - 1.2, -86 + dx + 1.2], [5, 6.5], [d, d + 9], '#e3b64a', { seed: 110 + s, gap: 2.5, len: 8, w: 2.4, alpha: 0.95, rimColor: '#98742a', fixed: true });
  crayon(polyPts(PP([[x0, 76, d - 4], [x1, 76, d - 4], [x1, h, d - 4], [x0, h, d - 4]]), 26), C.piano, { seed: 103, ...base, angle: -0.9 });
  box([-132, -40], [84, 87], [d - 4, d + 2], C.pianoDk, { seed: 104, gap: 3, alpha: 0.9 });
  for (const [a, b, s] of [[-126, -88, 1], [-86, -48, 2]]) {
    const pg = [[a, 87, d + 0.5], [b, 87, d + 0.5], [b, 113, d - 2.5], [a, 113, d - 2.5]];
    crayon(polyPts(PP(pg), 16), C.sheet, { seed: 120 + s, angle: -0.6, gap: 7, alpha: 0.3, base: 0.95, rimColor: '#a39a88', rimAlpha: 0.5, rimW: 2 });
    const map = (u, v) => { const q = P([lerp(a, b, u), lerp(87, 113, v), lerp(d + 0.5, d - 2.5, v)]); return [q[0], q[1]]; };
    const sc = pxcm([(a + b) / 2, 100, d]) / 7;
    for (let st = 0; st < 3; st++) {
      const v0 = 0.72 - st * 0.27;
      for (let l = 0; l < 5; l++) stroke([map(0.07, v0 + l * 0.028), map(0.93, v0 + l * 0.028)], '#8f887c', 0.9, { seed: 130 + s * 30 + st * 6 + l, passes: 1, wob: 0.8, alpha: 0.65 });
      const R = mulberry(300 + s * 10 + st);
      for (let k = 0; k < 8; k++) {
        const [nx, ny] = map(0.12 + k * 0.105, v0 + Math.floor(R() * 5) * 0.028);
        ctx.fillStyle = C.ink; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.ellipse(nx, ny, 3.4 * sc, 2.6 * sc, -0.4, 0, 7); ctx.fill();
        ctx.fillRect(nx + 2.5 * sc, ny - 13 * sc, 1.3 * sc, 13 * sc);
        ctx.globalAlpha = 1;
      }
    }
  }
  crayon(polyPts(PP([[x0 + 7, 73, d + 1], [x1 - 7, 73, d + 1], [x1 - 7, 80, d - 3], [x0 + 7, 80, d - 3]]), 20), C.pianoDk, { seed: 105, gap: 4, alpha: 0.9, angle: -0.2 });
  crayon(polyPts(PP([[x0, 62, 80], [x1, 62, 80], [x1, 70, 80], [x0, 70, 80]]), 22), C.pianoDk, { seed: 106, gap: 4, alpha: 0.85, angle: -0.15 });
  drawKeys(t);
  box([x1 - 7, x1], [62, 77], [d, 80], C.piano, { seed: 107, ...base });
  box([x1 - 7, x1], [0, 62], [72, 79], C.piano, { seed: 108, ...base });
  crayon(polyPts(PP([[x1, 0, 0], [x1, 0, d], [x1, h, d], [x1, h, 0]]), 26), tone(C.piano, -0.1), { seed: 109, ...base, angle: -1.0 });
  box([x0 - 2, x1 + 2], [h, h + 3], [-1, d + 3], C.pianoLt, { seed: 115, gap: 4, alpha: 0.85, base: 0.35, top: 0.08, mix: [C.pianoMix, 0.12] });
}
function drawKeys(t) {
  const { x0, x1, y, z0, z1 } = KEY;
  crayon(polyPts(PP([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]), 26), C.key, { seed: 150, angle: -0.5, gap: 9, alpha: 0.25, base: 0.95, rim: false });
  crayon(polyPts(PP([[x0, y - 2, z1], [x1, y - 2, z1], [x1, y, z1], [x0, y, z1]]), 26), tone(C.key, -0.06), { seed: 151, angle: -0.2, gap: 6, alpha: 0.3, base: 0.9, rim: false });
  for (let m = 21, wi = 0; m <= 108; m++) {
    if (!isWhite(m)) continue;
    const xa = x0 + wi * KW, xb = xa + KW, dpt = keyDepth(m, t);
    if (dpt > 0) {
      const q = PP([[xa + 0.1, y, z0], [xb - 0.1, y, z0], [xb - 0.1, y, z1], [xa + 0.1, y, z1]]);
      ctx.fillStyle = `rgba(130,140,160,${0.4 * dpt})`; trace(q); ctx.fill();
    }
    if (wi > 0) {
      const a = P([xa, y, z0]), b = P([xa, y, z1]), c = P([xa, y - 2, z1]);
      if (a[0] > -40 && a[0] < W + 40) stroke([[a[0], a[1]], [b[0], b[1]], [c[0], c[1]]], C.keyEdge, 1.6, { seed: 600 + wi, passes: 2, wob: 1.2, alpha: 0.75 });
    }
    wi++;
  }
  for (let m = 21; m <= 108; m++) {
    if (isWhite(m)) continue;
    const xc = keyX(m), dpt = keyDepth(m, t);
    const q = P([xc, y, z0]); if (q[0] < -40 || q[0] > W + 40) continue;
    box([xc - 0.65, xc + 0.65], [y, y + 1.6 - dpt * 0.5], [z0, z0 + 9.5], dpt > 0 ? '#747078' : C.black, { seed: 800 + m, gap: 2.2, len: 10, w: 2.4, alpha: 0.95, base: 0.6, wob: 1.2, rimW: 1.5, top: 0.15, side: -0.2, fixed: true });
  }
}
function drawLamp(t) {
  const [x, y, z] = LAMP;
  const pool = hull(PP(circle3([x, y + 0.2, z], 30, 30)));
  ctx.save(); trace(pool); ctx.clip();
  const c = P([x, y, z]);
  const g = ctx.createRadialGradient(c[0], c[1], 5, c[0], c[1], 170);
  g.addColorStop(0, 'rgba(255,220,130,0.6)'); g.addColorStop(1, 'rgba(255,220,130,0)');
  ctx.fillStyle = g; ctx.fillRect(c[0] - 220, c[1] - 220, 440, 440);
  ctx.restore();
  crayon(hull(PP(circle3([x, y, z], 8, 24))), C.wood, { seed: 30, gap: 3, alpha: 0.9, len: 14 });
  const a = P([x, y, z]), b = P([x, y + 17, z]);
  stroke([[a[0], a[1]], [b[0], b[1]]], '#8c6a44', 1.1 * pxcm(LAMP), { seed: 31 });
  const shade = hull(PP([...circle3([x, y + 15, z], 14, 24), ...circle3([x, y + 31, z], 8.5, 24)]));
  crayon(polyPts(shade, 12), C.lamp, { seed: 32, angle: -1.3, gap: 3.5, len: 24, alpha: 0.95, base: 0.55, rimColor: C.lampDk });
}

// ------------------------------------------------------------ bench + water
function drawBench(t) {
  const { x0, x1, y, z0, z1 } = BENCH;
  const sh = hull(PP([[x0 - 4, 0.2, z0 - 2], [x1 + 4, 0.2, z0 - 2], [x1 + 6, 0.2, z1 + 6], [x0 - 2, 0.2, z1 + 6]]));
  crayon(polyPts(sh, 20), '#b89a74', { seed: 200, gap: 5, alpha: 0.35, base: 0.15, rim: false, angle: -0.3 });
  drawFloorPuddle(t);
  const leg = (x, z, s) => box([x - 1.8, x + 1.8], [0, y - 4], [z - 1.8, z + 1.8], C.wood, { seed: s, gap: 3, len: 14, alpha: 0.9, base: 0.4, fixed: true });
  leg(x0 + 5, z0 + 5, 201); leg(x1 - 5, z0 + 5, 202); leg(x0 + 5, z1 - 5, 203);
  box([x0 + 5, x1 - 5], [y - 12, y - 10], [z0 + 4, z0 + 6], C.woodDk, { seed: 205, gap: 3, fixed: true });
  box([x0, x1], [y - 4, y], [z0, z1], C.wood, { seed: 206, gap: 4, len: 30, alpha: 0.9, base: 0.35, mix: ['#c48d62', 0.2] });
  leg(x1 - 5, z1 - 5, 204);
  drawSeatWater(t);
}
function glints(sp, seed, n) {
  const R = mulberry(seed);
  const [x0, y0, x1, y1] = bbox(sp);
  ctx.save(); trace(sp); ctx.clip();
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, 0.25 + R() * 0.5), y = lerp(y0, y1, 0.3 + R() * 0.4);
    const rx = Math.min(46, (x1 - x0) * (0.08 + R() * 0.06));
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.32);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.5, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
  ctx.restore();
}
// water on the seat: spreads from the snowman's base and spills over the front edge
function drawSeatWater(t) {
  const m = melt(t);
  if (m < 0.03) return;
  const r = 6 + m * 38;
  const c = [-84, SEAT_Y + 0.15, 108];
  const pts = [];
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * Math.PI * 2;
    const rr = r * (1 + 0.18 * Math.sin(a * 3 + 1.3) + 0.1 * Math.sin(a * 5 + 0.4));
    pts.push([clamp(c[0] + Math.cos(a) * rr * 1.3, BENCH.x0 + 1, BENCH.x1 - 1), c[1], clamp(c[2] + Math.sin(a) * rr, BENCH.z0 + 1, BENCH.z1 + 0.5)]);
  }
  const sp = PP(pts);
  crayon(polyPts(sp, 10), '#a6cdf0', { seed: 210, angle: -0.3, gap: 9, alpha: 0.28, base: 0.12, rimColor: '#6c9fd2', rimAlpha: 0.55, rimW: 2 });
  glints(sp, 211, 5);
  if (r > (BENCH.z1 - c[2]) * 0.9) {
    const R = mulberry(212);
    for (let k = 0; k < 4; k++) {
      const x = -84 + (R() - .5) * r * 1.6;
      if (x < BENCH.x0 + 3 || x > BENCH.x1 - 3) continue;
      const a = P([x, SEAT_Y, BENCH.z1 + 0.3]), b = P([x + 0.3, SEAT_Y - 4.5, BENCH.z1 + 0.3]);
      stroke([[a[0], a[1]], [b[0], b[1]]], '#6aa2d8', 3, { seed: 213 + k, passes: 2, alpha: 0.8 });
    }
  }
}
// drops fall from the seat edge; each impact rings the puddle on the floor
const DROPS = (() => {
  const R = mulberry(5150), d = [];
  let t = B(7);
  while (t < FINAL + 3) { d.push({ t, x: -84 + (R() - .5) * 50, z: BENCH.z1 + 1 }); t += lerp(0.9, 0.22, clamp((t - B(7)) / (FINAL - B(7)))) * (0.6 + R() * 0.8); }
  return d;
})();
const FALL = 0.3;
function drawFloorPuddle(t) {
  const r = Math.pow(clamp((t - B(7)) / (FINAL + 2 - B(7))), 0.8) * 62;
  if (r < 1) return;
  const c = [-84, 0.2, BENCH.z1 + 4];
  const pts = [];
  for (let i = 0; i < 44; i++) {
    const a = i / 44 * Math.PI * 2;
    const rr = r * (1 + 0.2 * Math.sin(a * 3 + 0.7) + 0.12 * Math.sin(a * 7 + 2.1) + 0.08 * Math.sin(a * 11));
    pts.push([c[0] + Math.cos(a) * rr * 1.25, 0.2, c[2] + Math.sin(a) * rr * 0.8 - rr * 0.2]);
  }
  const sp = PP(pts);
  crayon(polyPts(sp, 12), C.water, { seed: 220, angle: -0.25, gap: 5, len: 30, alpha: 0.5, base: 0.4, rimColor: '#5d8fc4', rimAlpha: 0.55, rimW: 2.4,
    inner: () => {
      // reflections: the warm lamp and the dark bench legs
      const lr = P([LAMP[0] - 20, 0, BENCH.z1 + 10]);
      crayon(ellipsePts(lr[0], lr[1], 30, 9, 0, 14), '#f7d27a', { seed: 221, gap: 3, len: 12, alpha: 0.55, base: 0.2, rim: false, fixed: true });
      for (const [x, z] of [[BENCH.x0 + 5, BENCH.z1 - 5], [BENCH.x1 - 5, BENCH.z1 - 5]]) {
        const a = P([x, 0, z]), b = P([x, -22, z]);
        stroke([[a[0], a[1]], [b[0], b[1]]], '#8f6d56', 6, { seed: 222 + (x | 0), passes: 2, alpha: 0.3 });
      }
    } });
  glints(sp, 223, 4);
  for (const dr of DROPS) {
    const dt = t - (dr.t + FALL);
    if (dt < 0 || dt > 1.1) continue;
    const rr = 1.5 + dt * 16, a = 1 - dt / 1.1;
    for (const k of [1, 0.6]) {
      const ring = PP(circle3([dr.x, 0.3, dr.z + 3], rr * k, 28));
      trace(ring); ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = a * 0.8; ctx.lineWidth = 2.4 * k; ctx.stroke();
      trace(ring.map(([x, y]) => [x, y + 2])); ctx.strokeStyle = '#5d8fc4'; ctx.globalAlpha = a * 0.45; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
function drawDrops(t) {
  for (const dr of DROPS) {
    const dt = t - dr.t;
    if (dt < -0.35 || dt > FALL) continue;
    if (dt < 0) { // swelling on the seat edge
      const q = P([dr.x, SEAT_Y - 4.5, dr.z]), s = (1 + dt / 0.35) * 0.9 * pxcm([dr.x, 45, dr.z]);
      crayon(ellipsePts(q[0], q[1] + s * 0.6, s * 0.7, s, 0, 10), C.water, { seed: 230, gap: 2, len: 5, w: 2, alpha: 0.9, base: 0.6, fixed: true, rimColor: '#4f86bf', rimW: 1.2 });
      continue;
    }
    const y = SEAT_Y - 4.5 - 0.5 * 980 * dt * dt;
    const q = P([dr.x, Math.max(0.5, y), dr.z]), s = 0.9 * pxcm([dr.x, y, dr.z]);
    crayon(ellipsePts(q[0], q[1], s * 0.6, s * 1.6, 0, 10), C.water, { seed: 231, gap: 2, len: 5, w: 2, alpha: 0.9, base: 0.6, fixed: true, rimColor: '#4f86bf', rimW: 1.2 });
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(q[0] - s * 0.2, q[1] - s * 0.5, s * 0.22, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------ snowman
const SNOW_POS = [-84, 108];
function snowState(t) {
  const m = melt(t);
  const l = handAt(LHs, t, keyX(48)), r = handAt(RHs, t, keyX(72));
  const rest = smooth(win(t, B(12, 3), B(13)));
  r.p = mix3(r.p, [keyX(64), KEY.y + 1, 70], rest);
  const closed = Math.max(pulse(t, 3.5, 4.2, B(4, 3), B(5)), pulse(t, B(9), B(9, 1.6), B(11, 4), B(12, 1)), pulse(t, B(14), B(14, 2), B(15, 3), B(15, 4)));
  const lookCat = Math.max(pulse(t, B(7, 3), B(8), B(8, 4), B(9)), pulse(t, B(12), B(12, 1.5), B(13, 3), B(14)), pulse(t, B(15, 4), B(16), FINAL + 1.6, FINAL + 2));
  const lookDown = pulse(t, B(5, 3), B(6), B(7), B(7, 3));
  const sway = Math.sin(t * Math.PI * 2 / (S.beatDur(0) * 4)) * 0.05 * (1 - m);
  return { m, l, r, closed, lookCat, lookDown, sway, t };
}
function sphereShade(sx, sy, rs, seed) {
  const lp = P(LAMP);
  let dx = lp[0] - sx, dy = lp[1] - 80 - sy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  crayon(ellipsePts(sx - dx * rs * 0.38, sy - dy * rs * 0.38 + rs * 0.1, rs * 0.88, rs * 0.84, 0, 30), C.snowShade, { seed, base: 0.08, angle: -0.8, gap: 6, alpha: 0.45, rim: false });
}
function wetSheen(c, rx, ry, m, seed) {
  crayon(ellipsePts(c[0], c[1] + ry * 0.55, rx * 1.05, ry * 0.5, 0, 24), '#cfe2f5', { seed, base: 0.3 * m, angle: -0.2, gap: 5, alpha: 0.5 * m, rim: false });
  const R = mulberry(hash(seed, BOIL >> 1));
  for (let i = 0; i < 3; i++) { const x = c[0] + (R() - .3) * rx, y = c[1] + ry * (0.35 + R() * 0.3); stroke([[x, y], [x + rx * 0.18, y + 2]], '#ffffff', 2.6, { seed: seed + i, passes: 1, alpha: 0.9 * m }); }
}
function snowGeom(s) {
  const m = s.m;
  const cl = smooth(win(s.t, FINAL + 0.2, FINAL + 1.9));
  const bR = 30 * (1 - 0.3 * m) * (1 + 0.15 * cl), bRy = bR * (1 - 0.5 * m) * (1 - 0.75 * cl);
  const bc = [SNOW_POS[0], SEAT_Y + bRy * 0.9, SNOW_POS[1]];
  const hR = 20 * (1 - 0.42 * m) * (1 - 0.55 * cl);
  const hc = [SNOW_POS[0] - m * 7 + s.sway * 8, bc[1] + bRy * 0.95 + hR * 0.78 - m * 4, SNOW_POS[1] - 2 - m * 3];
  return { bR, bRy, bc, hR, hc };
}
function drawSnowman(s, cat, part) {
  const m = Math.min(1, s.m), { bR, bRy, bc, hR, hc } = snowGeom(s);
  const hk = hR / 20; // features shrink with the head
  // face direction: toward the keys, turned toward the camera so the face reads
  const toCat = cat ? norm(sub([cat.pos[0], cat.pos[1] + 18, cat.pos[2]], hc)) : [0, 0, -1];
  let fdir = norm([0.9, -0.22 - s.lookDown * 0.35, -0.42]);
  fdir = norm(mix3(fdir, toCat, s.lookCat * 0.8));
  const side = norm(cross(fdir, [0, 1, 0])), up = norm(cross(side, fdir));
  const shoulder = sd => add(bc, [sd * bR * 0.9, bRy * 0.35, -bR * 0.25]);
  const arm = (sd, hand, seed) => {
    const cl = smooth(win(s.t, FINAL + 0.2, FINAL + 1.6));
    const sh = mix3(shoulder(sd), add(hand, [-22, 0.5, 1]), cl); // twig drops flat onto the keys as the body collapses
    const k = 1 - cl, pts = PP(bez(sh, add(sh, [sd * 6 * k, 8 * k, -10 * k]), add(hand, [0, 14 * k, 8 * k]), hand, 14));
    const w = 1.25 * pxcm(sh) * (1 - m * 0.2);
    stroke(pts, C.twig, w, { seed });
    const e = pts[pts.length - 1], pr = pts[pts.length - 3];
    const ang = Math.atan2(e[1] - pr[1], e[0] - pr[0]), fl = w * 2.2;
    for (const da of [-0.6, 0, 0.55]) stroke([e, [e[0] + Math.cos(ang + da) * fl, e[1] + Math.sin(ang + da) * fl]], C.twig, w * 0.55, { seed: seed + Math.round(da * 10), passes: 2 });
    const mid = pts[6];
    stroke([mid, [mid[0] - sd * w * 1.2, mid[1] - w * 3]], C.twig, w * 0.5, { seed: seed + 50, passes: 2 });
  };
  if (part === 'back') { arm(-1, s.l.p, 61); return; }
  // body: squashes and spreads as it melts
  const bcs = P(bc), bs = pxcm(bc);
  const body = ellipsePts(bcs[0], bcs[1], bR * bs, bRy * bs, 0, 48).map(([x, y], i) => {
    const bump = 1 + m * 0.07 * Math.sin(i * 1.7) + (y > bcs[1] ? m * 0.25 * ((y - bcs[1]) / (bRy * bs)) : 0);
    return [bcs[0] + (x - bcs[0]) * bump, y];
  });
  crayon(body, C.snow, { seed: 70, base: 0.92, angle: -0.8, gap: 7, len: 30, alpha: 0.3, rimColor: C.snowShade, rimAlpha: 0.95, rimW: 4,
    inner: () => { sphereShade(bcs[0], bcs[1], bR * bs, 71); if (m > 0.05) wetSheen(bcs, bR * bs, bRy * bs, m, 72); } });
  // scarf: a knitted band wrapped round the neck. Its visible arc tapers at both ends where it
  // turns away behind the neck, sags at the front, and loosens as the snowman melts.
  const neckY = bc[1] + bRy * 0.86, ringR = Math.min(hR * 0.84, bR * 0.9) + 1.2;
  const thick = 6.5 * (0.65 + 0.35 * hk);
  const flatF = norm([fdir[0], 0, fdir[2]]);
  const ring = [];
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, n = [Math.cos(a), 0, Math.sin(a)];
    const sag = Math.max(0, dot(n, flatF)) * (1.6 + m * 3);
    const c = [hc[0], neckY - sag, hc[2]];
    ring.push({ n, c, v: dot(n, toCam(add(c, mul(n, ringR)))) });
  }
  let st = ring.findIndex((r, i) => r.v > -0.02 && ring[(i + 71) % 72].v <= -0.02); if (st < 0) st = 0;
  const run = []; for (let k = 0; k < 72; k++) { const r = ring[(st + k) % 72]; if (r.v <= -0.02) break; run.push(r); }
  const wOf = r => thick * (0.8 + 0.2 * smooth((r.v + 0.02) / 0.3));
  const upper = run.map(r => P(add(add(r.c, mul(r.n, ringR)), [0, wOf(r) * 0.45, 0])));
  const lower = run.map(r => P(add(add(r.c, mul(r.n, ringR + 0.9)), [0, -wOf(r) * 0.55, 0])));
  { // back half of the scarf, darker, mostly hidden by the head
    const back = ring.filter(r => r.v <= -0.02);
    let b0 = ring.findIndex((r, i) => r.v <= -0.02 && ring[(i + 71) % 72].v > -0.02);
    const brun = []; for (let k = 0; k < 72 && b0 >= 0; k++) { const r = ring[(b0 + k) % 72]; if (r.v > -0.02) break; brun.push(r); }
    if (brun.length > 2) {
      const bu = brun.map(r => P(add(add(r.c, mul(r.n, ringR)), [0, thick * 0.45, 0]))), bl = brun.map(r => P(add(add(r.c, mul(r.n, ringR + 0.9)), [0, -thick * 0.55, 0])));
      crayon([...bu, ...bl.reverse()].map(q => [q[0], q[1]]), tone(C.scarf, -0.18), { seed: 79, angle: -0.3, gap: 3.6, len: 16, alpha: 0.95, base: 0.5, wob: 1.6 });
    }
  }
  // head
  const hcs = P(hc), hs = pxcm(hc), hr = hR * hs;
  crayon(ellipsePts(hcs[0], hcs[1], hr, hr * (1 - m * 0.15), 0, 40), C.snow, { seed: 73, base: 0.92, angle: -0.8, gap: 7, len: 24, alpha: 0.3, rimColor: C.snowShade, rimAlpha: 0.95, rimW: 4,
    inner: () => { sphereShade(hcs[0], hcs[1], hr, 74); if (m > 0.1) wetSheen(hcs, hr, hr, m * 0.7, 75); } });
  // face features placed on the sphere
  const onHead = (dx, dy) => { const n = norm(add(fdir, add(mul(side, dx), mul(up, dy)))); const p = add(hc, mul(n, hR)); const v = dot(n, toCam(p)); return { p, s: P(p), v, fore: clamp((v - 0.04) / 0.4, 0, 1) }; };
  [-1, 1].forEach((sd, i) => {
    const e = onHead(sd * 0.36, 0.22 - m * 0.1);
    if (e.fore <= 0.02) return;
    const er = 2.6 * hs * (0.45 + 0.55 * hk), ex = er * lerp(0.35, 1, e.fore);
    const k = s.closed;
    if (k >= 0.62) stroke(bez([e.s[0] - ex * 1.2, e.s[1]], [e.s[0] - ex * 0.5, e.s[1] - er], [e.s[0] + ex * 0.5, e.s[1] - er], [e.s[0] + ex * 1.2, e.s[1]], 6), C.coal, er * 0.55, { seed: 100 + i });
    else crayon(ellipsePts(e.s[0], e.s[1] + er * k * 0.5, ex, er * 1.1 * (1 - k * 1.25), 0, 14), C.coal, { seed: 102 + i, angle: -0.8, gap: 2.4, len: 9, w: 3.2, alpha: 1, base: 0.9, wob: 1.2, rimW: 1.6, fixed: true });
  });
  for (let i = 0; i < 5; i++) {
    const u = (i - 2) / 2, f = onHead(u * 0.3, -0.3 - (1 - u * u) * 0.12 * (1 - m * 0.5));
    if (f.fore <= 0.02) continue;
    const r = 1.05 * hs * (0.5 + 0.5 * hk);
    crayon(ellipsePts(f.s[0], f.s[1], r * lerp(0.4, 1, f.fore), r, 0, 8), C.coal, { seed: 120 + i, gap: 2, len: 5, w: 2.6, alpha: 1, base: 0.9, wob: 1, rim: false, fixed: true });
  }
  // carrot: a cone along the face direction, drooping as it melts
  const nb = onHead(0, -0.05);
  const cdir = norm(add(fdir, [0, -m * 0.9, 0]));
  const tip = P(add(nb.p, mul(cdir, 11 * (0.55 + 0.45 * hk))));
  const baseW = 2.3 * hs * (0.55 + 0.45 * hk), ang = Math.atan2(tip[1] - nb.s[1], tip[0] - nb.s[0]);
  const nx = -Math.sin(ang) * baseW, ny = Math.cos(ang) * baseW;
  crayon(polyPts([[nb.s[0] + nx, nb.s[1] + ny], [tip[0], tip[1]], [nb.s[0] - nx, nb.s[1] - ny]], 6), C.carrot, { seed: 110, angle: ang + 1.2, gap: 2.6, len: 12, w: 3, alpha: 1, base: 0.6, rimColor: '#c0561c', fixed: true });
  const band = [...upper, ...lower.slice().reverse()].map(q => [q[0], q[1]]);
  crayon(band, C.scarf, { seed: 80, angle: -0.3, gap: 3.6, len: 16, alpha: 0.95, base: 0.45, mix: ['#b8322f', 0.3], wob: 1.6,
    inner: () => {
      // shade toward the ends (turning away) and along the lower edge; knit ribs
      const eL = run.length;
      for (const k of [0, eL - 1]) { const q = upper[k]; ctx.globalAlpha = 0.2; ctx.fillStyle = '#7d1f1c'; ctx.beginPath(); ctx.arc(q[0], q[1], thick * hs * 0.9, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      stroke(lower.map(q => [q[0], q[1] - 1.5]), '#8f2623', 2.4, { seed: 84, passes: 2, alpha: 0.55 });
      for (let k = 3; k < eL - 3; k += 5) { const a = upper[k], b = lower[k]; stroke([[a[0], a[1]], [b[0], b[1]]], '#a82d2a', 1.3, { seed: 85 + k, passes: 1, alpha: 0.45 }); }
    } });
  // knot + hanging tail on the side facing the camera
  const flutter = Math.sin(s.t * 2.1) * 1.5;
  const tn = norm(add(mul(norm([toCam(hc)[0], 0, toCam(hc)[2]]), 0.7), mul(flatF, 0.5)));
  const ta = add([hc[0], neckY - Math.max(0, dot(tn, flatF)) * (1.6 + m * 3), hc[2]], mul(tn, ringR + 0.6));
  const tlen = 17 * (1 - m * 0.35);
  const tp = PP(bez(ta, add(ta, [0.5 + flutter * 0.3, -tlen * 0.5, 1.5]), add(ta, [0.8 + flutter * 0.5, -tlen * 0.75, 2]), add(ta, [1.5 + flutter, -tlen, 2.5]), 8));
  crayon(ribbon(tp, 6 * hs * (0.7 + 0.3 * hk), 5.6 * hs * (0.7 + 0.3 * hk)), C.scarf, { seed: 81, angle: -1.4, gap: 3.4, len: 14, alpha: 0.95, base: 0.45, mix: ['#b8322f', 0.3], wob: 1.6,
    inner: () => { for (let i = 1; i <= 2; i++) { const q = tp[Math.round(i * 2.6)]; stroke([[q[0] - 2.6 * hs, q[1]], [q[0] + 2.6 * hs, q[1] - 1]], '#f2e2c8', 2.2, { seed: 82 + i, passes: 1, alpha: 0.75 }); } } });
  const kq = P(ta), kr = 3.2 * hs * (0.7 + 0.3 * hk);
  crayon(ellipsePts(kq[0], kq[1] + kr * 0.2, kr, kr * 0.85, 0, 14), tone(C.scarf, -0.08), { seed: 86, gap: 2.6, len: 8, w: 2.6, alpha: 0.95, base: 0.5, fixed: true, rimColor: '#8f2623', rimW: 1.6 });
  const te = tp[tp.length - 1];
  for (let i = -2; i <= 2; i++) stroke([[te[0] + i * 1.1 * hs, te[1]], [te[0] + i * 1.2 * hs + flutter, te[1] + 2.4 * hs]], C.scarf, 2, { seed: 90 + i, passes: 2 });
  // drips sliding down the body
  if (m > 0.05) {
    for (let k = 0; k < 5; k++) {
      const ph = ((s.t * 0.22 + k * 0.23) % 1);
      const ax = [-0.6, -0.2, 0.3, 0.55, 0.05][k];
      const x = bcs[0] + ax * bR * bs, y = bcs[1] - bRy * bs * 0.6 + ph * bRy * bs * 1.4;
      const ds = 0.8 * bs;
      ctx.globalAlpha = Math.sin(Math.PI * ph);
      crayon(ellipsePts(x, y, ds, ds * 1.5, 0, 10), C.water, { seed: 240 + k, gap: 2, len: 5, w: 2, alpha: 0.9, base: 0.6, rimColor: '#4f86bf', rimW: 1.2, fixed: true });
      ctx.globalAlpha = 1;
    }
  }
  arm(1, s.r.p, 62);
}
// what's left on the bench: cross-fades in exactly where the snowman melts away
const MELT_FADE = [FINAL + 0.9, FINAL + 1.9];
function drawRemains(t) {
  const y = SEAT_Y + 0.6;
  crayon(polyPts(PP([[-104, y, 100], [-72, y, 97], [-60, y, 108], [-66, y, 118], [-88, y, 121], [-108, y, 116]]), 10), C.scarf, { seed: 130, angle: -0.3, gap: 3.6, len: 18, alpha: 0.95, base: 0.45, mix: ['#b8322f', 0.3] });
  const fr = PP([[-62, y, 110], [-55, y, 116]]);
  for (let i = 0; i < 4; i++) stroke([[fr[0][0] + i * 4, fr[0][1] + i * 2], [fr[1][0] + i * 4, fr[1][1] + i * 2]], C.scarf, 2.2, { seed: 131 + i, passes: 2 });
  const cr = PP([[-82, y + 1, 103], [-64, y + 1, 108]]);
  const ang = Math.atan2(cr[1][1] - cr[0][1], cr[1][0] - cr[0][0]), bw = 2.4 * pxcm([-74, y, 105]);
  crayon(polyPts([[cr[0][0] - Math.sin(ang) * bw, cr[0][1] + Math.cos(ang) * bw], cr[1], [cr[0][0] + Math.sin(ang) * bw, cr[0][1] - Math.cos(ang) * bw]], 6), C.carrot, { seed: 136, gap: 2.5, len: 10, w: 3, alpha: 1, base: 0.6, fixed: true });
  for (const [x, z, i] of [[-90, 100, 0], [-81, 98, 1]]) { const q = P([x, y + 1, z]), r = 2 * pxcm([x, y, z]); crayon(ellipsePts(q[0], q[1], r, r * 0.9, 0, 12), C.coal, { seed: 137 + i, gap: 2.4, len: 8, w: 3, alpha: 1, base: 0.9, fixed: true, rimW: 1.6 }); }
  // both twigs stay where the hands last were: on the keys
  stroke(PP([[keyX(64) - 8, KEY.y + 1, 68], [keyX(64) + 14, KEY.y + 1, 70]]), C.twig, 1.2 * pxcm([keyX(64), KEY.y, 69]), { seed: 140 });
  stroke(PP([[keyX(50) - 10, KEY.y + 1, 70], [keyX(50) + 12, KEY.y + 1, 68]]), C.twig, 1.2 * pxcm([keyX(50), KEY.y, 69]), { seed: 141 });
}

// ------------------------------------------------------------ cat
const PO = {
  sit: { by: 58, rx: 50, ry: 44, rot: -1.0, hx: 22, hy: -128, ht: 0, eye: 1, legs: [[-24, -26, -2, 0], [22, -52, 22, 0], [-14, -26, 8, 0], [34, -52, 36, 0]], tail: [-40, -8, -74, 2, -56, 14, 20, 10] },
  loaf: { by: 34, rx: 70, ry: 34, rot: 0, hx: 66, hy: -64, ht: 0, eye: 1, legs: [[-40, -8, -32, -2], [42, -8, 50, -2], [-42, -8, -34, -2], [40, -8, 48, -2]], tail: [-64, -20, -94, -6, -110, 10, -60, 20] },
  sleep: { by: 26, rx: 72, ry: 28, rot: 0, hx: 70, hy: -26, ht: 0.35, eye: 0, legs: [[-40, -8, -32, -2], [42, -8, 50, -2], [-42, -8, -34, -2], [40, -8, 48, -2]], tail: [-66, -16, -96, 10, -40, 20, 40, 8] },
  leap: { by: 44, rx: 84, ry: 26, rot: -0.2, hx: 96, hy: -60, ht: 0, eye: 1, legs: [[-50, -38, -106, -14], [50, -42, 112, -56], [-44, -38, -98, -26], [56, -42, 120, -44]], tail: [-80, -44, -120, -48, -150, -38, -184, -54] },
  land: { by: 34, rx: 70, ry: 30, rot: 0, hx: 76, hy: -50, ht: 0, eye: 1, legs: [[-42, -22, -56, 0], [40, -22, 54, 0], [-36, -22, -48, 0], [48, -22, 66, 0]], tail: [-64, -34, -98, -66, -102, -110, -88, -142] },
  stand: { by: 52, rx: 58, ry: 27, rot: 0, hx: 62, hy: -86, ht: 0, eye: 1, legs: [[-40, -46, -42, 0], [34, -46, 36, 0], [-30, -46, -28, 0], [44, -46, 48, 0]], tail: [-54, -60, -84, -84, -92, -124, -68, -144] },
  reach: { by: 66, rx: 50, ry: 42, rot: -1.12, hx: 30, hy: -142, ht: 0.05, eye: 1, legs: [[-24, -26, -2, 0], [24, -62, 46, -76], [-14, -26, 8, 0], [34, -62, 64, -88]], tail: [-40, -8, -74, 2, -56, 14, 20, 10] },
};
function lerpPose(a, b, u) {
  const o = {};
  for (const k in a) {
    if (k === 'legs') o.legs = a.legs.map((l, i) => l.map((v, j) => lerp(v, b.legs[i][j], u)));
    else if (Array.isArray(a[k])) o[k] = a[k].map((v, j) => lerp(v, b[k][j], u));
    else o[k] = lerp(a[k], b[k] ?? a[k], u);
  }
  return o;
}
function walkLegs(p, ph, amp = 14) {
  p.legs = p.legs.map((l, i) => { const off = [0, Math.PI, Math.PI, 0][i]; return [l[0], l[1], l[2] + Math.sin(ph + off) * amp, l[3] - Math.max(0, Math.cos(ph + off)) * amp * 0.7]; });
  p.by += Math.abs(Math.sin(ph)) * 2.5;
  return p;
}
const CAT_TOP = [-24, PIANO.h + 3, 47];
const CAT_BENCH = [-40, SEAT_Y, 104];
const CAT_CHEEK = [-13.5, 77, 70];
const K_CAT = 0.155; // cm per pose unit
function catState(t) {
  let pos, yaw, p, eye = [-0.8, 0.2], tailWave = 1, paw = null;
  // two hops, like a real cat: lid → the piano's end block → bench (keeps clear of the snowman)
  const hop1 = [B(8, 1.7), B(8, 2.35)], hop2 = [B(8, 2.75), B(8, 3.5)];
  const jump = [hop1[0], hop2[1]];
  const E = FINAL; // epilogue beats
  const hopPose = u => { const q = lerpPose(PO.leap, PO.land, smooth(win(u, 0.55, 1))); q.worry = 1; return q; };
  if (t < hop1[0]) {
    pos = CAT_TOP; yaw = 0.1;
    p = lerpPose(PO.loaf, PO.sit, smooth(win(t, B(2), B(2, 3))));
    p.worry = smooth(win(t, B(6), B(6, 2)));
    eye = [lerp(-0.9, -0.7, smooth(win(t, B(5, 2), B(5, 4)))), lerp(0.5, 0.9, smooth(win(t, B(5, 2), B(5, 4))))];
    if (t > hop1[0] - 0.4) p = lerpPose(p, PO.land, smooth(win(t, hop1[0] - 0.4, hop1[0])));
  } else if (t < hop1[1]) {
    const u = win(t, hop1[0], hop1[1]);
    pos = mix3(CAT_TOP, CAT_CHEEK, easeInOut(u)); pos[1] += Math.sin(Math.PI * u) * 10;
    yaw = 0.1; p = hopPose(u); eye = [-0.4, 0.9];
  } else if (t < hop2[0]) {
    pos = CAT_CHEEK; yaw = lerp(0.1, -0.7, smooth(win(t, hop1[1], hop2[0])));
    p = lerpPose(PO.land, PO.land, 0); p.worry = 1; p.by -= 4 * smooth(win(t, hop2[0] - 0.25, hop2[0]));
    eye = [-0.9, 0.5];
  } else if (t < hop2[1]) {
    const u = win(t, hop2[0], hop2[1]);
    pos = mix3(CAT_CHEEK, CAT_BENCH, easeInOut(u)); pos[1] += Math.sin(Math.PI * u) * 12;
    yaw = lerp(-0.7, 0.1, smooth(u)); p = hopPose(u); eye = [-0.6, 0.6];
  } else if (t < E + 2.2) {
    const cn = handAt(CATs, t, keyX(79));
    const playing = pulse(t, B(12, 3), B(13) - 0.2, E + 0.3, E + 0.9);
    const lean = pulse(t, B(9, 3), B(10), B(12), B(12, 3));
    pos = [lerp(lerp(CAT_BENCH[0], -52, lean), cn.p[0] + 5 + 9 * smooth(melt(t)), playing), SEAT_Y, lerp(CAT_BENCH[2], 91, playing)];
    yaw = lerp(0.1, Math.PI, smooth(clamp(playing * 1.3)));
    p = lerpPose(PO.land, PO.sit, smooth(win(t, jump[1], jump[1] + 0.5)));
    if (t < jump[1] + 0.5) p.worry = 1;
    if (playing > 0) { p = lerpPose(p, PO.reach, smooth(playing)); paw = { p: cn.p, w: smooth(playing) }; }
    eye = [lerp(-0.8, 0.8, smooth(playing)), lerp(0.2, 0.8, smooth(playing))];
    p.worry = Math.max(1 - lean * 0.5, smooth(win(t, E + 0.9, E + 1.3)));
    tailWave = 0.6;
  } else {
    // stand, turn, walk over to the scarf, circle, lie down; snowflakes wake it
    const from = [lerp(CAT_BENCH[0], CAT_BENCH[0], 0), SEAT_Y, CAT_BENCH[2]], to = [-78, SEAT_Y + 1.5, 109];
    const up = smooth(win(t, E + 2.2, E + 2.6));
    const walkU = win(t, E + 2.6, E + 3.8);
    const settle = smooth(win(t, E + 3.8, E + 4.6));
    pos = mix3(from, to, easeInOut(walkU));
    yaw = lerp(lerp(0.1, -Math.PI / 2, up), 0.2, settle);
    p = lerpPose(PO.sit, PO.stand, up);
    if (walkU > 0 && walkU < 1) p = walkLegs(p, (t - (E + 2.6)) * 11, 13 * Math.sin(Math.PI * walkU) + 3);
    p = lerpPose(p, PO.sleep, settle);
    const wake = Math.max(0, ...S.FLAKES.slice(0, 3).map(fl => pulse(t, fl.t, fl.t + 0.25, fl.t + 0.9, fl.t + 1.3) * 0.6));
    const wakeEnd = smooth(win(t, S.FLAKES[3].t - 0.2, S.FLAKES[3].t + 0.4));
    p.eye = Math.max(1 - smooth(win(t, E + 4.2, E + 5.2)), wake, wakeEnd);
    p.ht += wakeEnd * -0.5; p.hy -= wakeEnd * 26;
    eye = [lerp(0.3, 0, wakeEnd), lerp(-0.8, -0.6, wakeEnd)];
    p.worry = 1 - up; tailWave = 0.3 + wakeEnd;
  }
  return { pos, yaw, p, eye, tailWave, paw, t };
}
function drawCat(c) {
  const p = c.p;
  const sp = P(c.pos), s = pxcm(c.pos) * K_CAT;
  // continuous facing: how much of the cat's side we see; it squashes through 0 while turning
  const fwd = [Math.sin(c.yaw), 0, Math.cos(c.yaw)], sideV = [Math.cos(c.yaw), 0, -Math.sin(c.yaw)];
  const d1 = P(add(c.pos, mul(fwd, 10)))[0] - sp[0], d2 = P(add(c.pos, mul(sideV, 10)))[0] - sp[0];
  const fx = d1 / (Math.hypot(d1, d2) || 1);
  const f = Math.sign(fx) * Math.pow(Math.abs(fx), 0.6) || 0.01;
  ctx.save();
  ctx.translate(sp[0], sp[1]); ctx.scale(f * s, s);
  const col = C.cat, o = { angle: -0.9, gap: 3, len: 18, w: 3.4, alpha: 1, base: 0.8, rimColor: '#0f0d0e', rimAlpha: 0.6, fixed: true };
  ctx.globalAlpha = 0.22; ctx.fillStyle = '#3a2c20'; ctx.beginPath(); ctx.ellipse(0, 2, p.rx * 1.1, 8, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  const tw = Math.sin(c.t * 2.8) * 10 * c.tailWave, tl = p.tail;
  crayon(ribbon(bez([tl[0], tl[1]], [tl[2], tl[3]], [tl[4] + tw * 0.6, tl[5]], [tl[6] + tw, tl[7]], 14), 17, 12), col, { ...o, seed: 300 });
  const leg = (l, sd, w) => crayon(ribbon([[l[0], l[1]], [lerp(l[0], l[2], 0.5) + 3, lerp(l[1], l[3], 0.5)], [l[2], l[3]]], w, w * 0.9), col, { ...o, seed: sd });
  leg(p.legs[0], 301, 18); leg(p.legs[1], 302, 18);
  // haunch: when the cat sits upright its thigh is a rounded mass on the ground
  const upr = clamp((-p.rot - 0.5) / 0.4);
  if (upr > 0.03) crayon(ellipsePts(-10, -24 * upr, 32 * upr + 2, 24 * upr + 2, -0.25, 22), col, { ...o, seed: 305 });
  crayon(ellipsePts(0, -p.by, p.rx, p.ry, p.rot, 32), col, { ...o, seed: 310 });
  let nf = p.legs[3];
  if (c.paw) { const q = P(c.paw.p); const fs = Math.sign(f) * Math.max(Math.abs(f), 0.35); const lx = (q[0] - sp[0]) / (fs * s), ly = (q[1] - sp[1]) / s; const w = c.paw.w * clamp((Math.abs(f) - 0.2) / 0.3); nf = [nf[0], nf[1], lerp(nf[2], lx, w), lerp(nf[3], ly, w)]; }
  leg(p.legs[2], 303, 20);
  if (c.paw && c.paw.w > 0.05) {
    const sx = nf[0], sy = nf[1], ex = nf[2], ey = nf[3];
    const dx = ex - sx, dy = ey - sy, L = Math.hypot(dx, dy) || 1;
    const bend = 0.22 * L * c.paw.w; // elbow bows outward/down, like a soft cat arm
    const el = [sx + dx * 0.45 + (dy / L) * bend, sy + dy * 0.45 - (dx / L) * bend * -1];
    const arm = bez([sx, sy], el, [lerp(el[0], ex, 0.6), lerp(el[1], ey, 0.6)], [ex, ey], 12);
    crayon(ribbon(arm, 22, 13), col, { ...o, seed: 304 });
    crayon(ellipsePts(ex, ey + 2, 11, 8, Math.atan2(dy, dx), 14), col, { ...o, seed: 306 });
  } else leg(nf, 304, 20);
  ctx.save(); ctx.translate(p.hx, p.hy); ctx.rotate(p.ht);
  const ed = (p.worry || 0) * 10;
  for (const sd of [-1, 1]) crayon(polyPts([[sd * 6 - 8, -20], [sd * 25 + sd * ed, -46 + ed], [sd * 30, -8]], 8), col, { ...o, seed: 320 + sd });
  crayon(ellipsePts(0, 0, 36, 31, 0, 26), col, { ...o, seed: 325 });
  for (const sd of [-1, 1]) {
    const ex = 4 + sd * 15, ey = -3;
    if (p.eye > 0.15) {
      crayon(ellipsePts(ex, ey, 9, 9 * p.eye, 0, 14), C.catEye, { seed: 330 + sd, angle: -0.8, gap: 2, len: 8, w: 2.6, alpha: 1, base: 0.9, wob: 1, rimColor: '#1a1718', rimAlpha: 0.5, rimW: 1.5, fixed: true });
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(ex + c.eye[0] * 3, ey + c.eye[1] * 2.5 * p.eye, 2.8, 6.4 * p.eye, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 2.5, ey - 3 * p.eye, 1.6, 0, 7); ctx.fill();
    } else stroke([[ex - 8, ey + 1], [ex, ey + 4], [ex + 8, ey + 1]], '#6d6660', 2.2, { seed: 332 + sd, passes: 2 });
  }
  stroke([[1, 14], [4, 17], [7, 14]], '#6d6660', 1.8, { seed: 340, passes: 1 });
  for (const sd of [-1, 1]) for (const k of [-1, 1]) stroke([[6 + sd * 16, 12 + k * 2], [6 + sd * 42, 8 + k * 6]], '#8b847e', 1, { seed: 350 + sd * 3 + k, passes: 1, alpha: 0.6 });
  ctx.restore();
  ctx.restore();
  // screen-space head centre (for the last snowflake)
  const hcx = sp[0] + f * p.hx * s, hcy = sp[1] + p.hy * s;
  return { head: [hcx, hcy], s, f };
}

// ------------------------------------------------------------ snowflakes: white, with a pale blue edge
function flakeGlyph(x, y, r, rot, alpha) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.7);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, 7); ctx.fill();
  for (const [col, w] of [['#b9cde3', r * 0.24], ['#ffffff', r * 0.13]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
      ctx.moveTo(0, 0); ctx.lineTo(ca * r, sa * r);
      for (const bb of [0.45, 0.72]) {
        const bx = ca * r * bb, by = sa * r * bb, bl = r * 0.32 * (1.15 - bb);
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.8) * bl, by + Math.sin(a + 0.8) * bl);
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.8) * bl, by + Math.sin(a - 0.8) * bl);
      }
    }
    ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawFlakes(t, cd) {
  S.FLAKES.forEach((fl, i) => {
    const t0 = fl.t - 3.4;
    if (t < t0) return;
    const last = i === 3;
    let ts;
    if (last) ts = [cd.head[0] - cd.f * 6 * cd.s, cd.head[1] - 34 * cd.s];
    else { const q = P([keyX(fl.m), KEY.y + 0.5, 68]); ts = [q[0], q[1]]; }
    const u = win(t, t0, fl.t);
    const ss = P([FAR_X + 10, 150 + i * 8, 120 - i * 14]);
    const x = lerp(ss[0], ts[0], easeInOut(u)) + Math.sin(t * 1.7 + i) * 30 * (1 - u), y = lerp(ss[1], ts[1], u) + Math.sin(t * 2.3 + i) * 8 * (1 - u);
    const fade = last ? 1 - win(t, fl.t + 2.4, fl.t + 3.4) : 1 - win(t, fl.t + 0.3, fl.t + 1.5);
    if (fade <= 0) return;
    const r = lerp(10, last ? 15 : 12, u) * CAM.F / 1100;
    flakeGlyph(x, y, r, t * 0.9 + i, fade);
    const g = pulse(t, fl.t, fl.t + 0.05, fl.t + 0.25, fl.t + 0.7);
    if (g > 0) { ctx.globalAlpha = g * 0.7; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ts[0], ts[1], 16 * g + 6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  });
}

// ------------------------------------------------------------ camera
function camera(t) {
  const k = track(t, [
    [0, [[96, 150, 178], [-80, 92, 76], [1060]]],
    [B(5), [[92, 148, 176], [-80, 92, 78], [1080]]],
    [B(9), [[80, 144, 172], [-78, 92, 82], [1120]]],
    [B(12, 3), [[66, 136, 168], [-72, 88, 86], [1180]]],
    [FINAL, [[56, 128, 170], [-72, 80, 92], [1200]]],
    [END_T, [[50, 124, 176], [-82, 72, 96], [1180]]],
    [S.FLAKES[3].t + 0.8, [[30, 112, 176], [-84, 64, 102], [1300]]],
    [LEN, [[26, 110, 176], [-84, 64, 102], [1330]]],
  ]);
  setCamera(k[0], k[1], k[2][0]);
}

// ------------------------------------------------------------ frame
function frame(t, fi) {
  BOIL = Math.floor(fi / 3);
  camera(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgb(${PAPER.join(',')})`; ctx.fillRect(0, 0, W, H);
  drawRoom(t);
  drawWindow(t);
  drawPiano(t);
  drawLamp(t);
  const cat = catState(t);
  const sn = snowState(t);
  drawBench(t);
  const fadeIn = win(t, MELT_FADE[0], MELT_FADE[1]);
  withLayer(smooth(fadeIn), () => drawRemains(t));
  const drawSnow = () => withLayer(1 - smooth(fadeIn), () => { drawSnowman(sn, cat, 'back'); drawSnowman(sn, cat, 'front'); });
  // painter's order by true camera depth
  const catFar = P(cat.pos)[2] > P(snowGeom(sn).bc)[2];
  let cd;
  if (catFar) { cd = drawCat(cat); drawSnow(); } else { drawSnow(); cd = drawCat(cat); }
  drawDrops(t);
  drawFlakes(t, cd);
  applyTooth(BOIL);
  const fade = 1 - win(t, LEN - 1.2, LEN); // no fade-in: first frame must be the full scene (X thumbnail)
  if (fade < 1) { ctx.globalAlpha = 1 - fade; ctx.fillStyle = `rgb(${PAPER.join(',')})`; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// ------------------------------------------------------------ main
fs.mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] || 'stills';
if (mode === 'stills') {
  for (const a of process.argv.slice(3)) {
    const t = +a; frame(t, Math.round(t * FPS));
    fs.writeFileSync(`${OUT}/still_${t.toFixed(2)}.png`, canvas.toBuffer('image/png'));
  }
} else {
  const file = process.argv[3] || `${OUT}/songbie_v2.mp4`;
  const f0 = Math.round(+(process.argv[4] ?? 0) * FPS), f1 = Math.round(+(process.argv[5] ?? LEN) * FPS);
  // single pass straight to the deliverable (video + loudness-normalised audio), no big intermediate
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', `${FPS}`, '-i', '-',
    '-i', `${OUT}/audio.wav`, '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'grain', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=14', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.stdin.on('error', e => { console.error('ffmpeg pipe closed:', e.code); process.exit(1); });
  (async () => {
    const t0 = Date.now();
    for (let fi = f0; fi < f1; fi++) {
      frame(fi / FPS, fi);
      const buf = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (fi % 72 === 0) process.stderr.write(`\r${fi}/${f1} ${((Date.now() - t0) / (fi - f0 + 1)).toFixed(0)}ms/f `);
    }
    ff.stdin.end();
    ff.on('close', () => console.error('\ndone', file));
  })();
}
