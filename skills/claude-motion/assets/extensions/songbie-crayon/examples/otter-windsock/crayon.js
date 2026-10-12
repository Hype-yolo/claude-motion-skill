// Adapted from Johnny Wang, songbie, MIT; commit 97225eb54a351c9938ad896e04bef7a7020393fb.
// Core functions below are preserved from render.js lines 29-264, except the dynamic paper grid.
export function createCrayonRenderer(canvas) {
const W=canvas.width,H=canvas.height,ctx=canvas.getContext('2d');
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
  const lw = Math.ceil(Math.max(W, H) / 30) + 2, lo = new Float32Array(lw * lw).map(() => R() - .5);
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


function begin(t,fps=24){ BOIL=Math.floor(Math.round(t*fps)/3);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle=`rgb(${PAPER.join(',')})`;ctx.fillRect(0,0,W,H); }
function depthSort(items){ return [...items].sort((a,b)=>P(b.pos)[2]-P(a.pos)[2]).forEach(item=>item.draw()); }
return {ctx,begin,finish:()=>applyTooth(BOIL),crayon,stroke,trace,ellipsePts,polyPts,ribbon,bez,box,setCamera,P,PP,pxcm,circle3,hull,depthSort,PRESS,clamp,lerp,smooth,win,track,tone};
}
