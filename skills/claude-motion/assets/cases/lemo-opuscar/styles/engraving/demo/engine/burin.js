// burin.js — a line engine for copperplate engraving in Canvas 2D.
// Adapted from the Opuscar 98 set engine (copied, not imported) and extended for this library:
//   * every stroke keeps its place in the engraver's cutting order, so any drawing can be "cut" line by line
//     (Ink.schedule + Ink.draw(ctx, t));
//   * formTone(): any closed shape + a light direction → a modelled tone field (distance-field "pillow");
//   * contourHatch(): lines that follow the form (iso-lines of the shape's distance field);
//   * all ink is vector and bucketed by width into Path2D chunks, so a frame strokes fast and stays sharp at any zoom.
//
//   const sh = shape('M0 0 C…Z', xf(x, y, s));
//   const ink = new Ink();
//   ink.group('outline'); outline(ink, sh.polys[0], { w: 2 });
//   ink.group('hatch');   engraveTone(ink, sh.polys, { tone: formTone(sh.polys, { light: [-1, -1] }) });
//   ink.schedule('outline', 0, 2); ink.schedule('hatch', 2, 6); ink.build();
//   ink.draw(ctx, t);                  // t = seconds; lines not yet cut are absent, the ones being cut grow
export const INK = '#1c1510', PAPER = '#efe6cf';

// ---------- randomness (deterministic) ----------
export function RNG(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (a, b = 0) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
export function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u; }
export function noise2(x, y, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(i + j * 57.1, seed), b = hash(i + 1 + j * 57.1, seed), c = hash(i + (j + 1) * 57.1, seed), d = hash(i + 1 + (j + 1) * 57.1, seed);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}
export const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
export const mix = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- transforms ----------
export function xf(x = 0, y = 0, s = 1, rot = 0, flip = false) {
  const c = Math.cos(rot) * s, sn = Math.sin(rot) * s, fx = flip ? -1 : 1;
  const f = ([px, py]) => { const X = px * fx; return [x + c * X - sn * py, y + sn * X + c * py]; };
  f.scale = s; return f;
}
export const compose = (outer, inner) => { const f = p => outer(inner(p)); f.scale = (outer.scale || 1) * (inner.scale || 1); return f; };

// ---------- SVG path → polylines ----------
export function parseD(d, step = 2) {
  const tok = d.match(/[MmLlHhVvCcSsQqTtZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const subs = []; let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', lcx = 0, lcy = 0, lq = null, i = 0;
  const num = () => +tok[i++];
  const push = (px, py) => { cur.pts.push([px, py]); };
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    const L = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2), n = Math.max(2, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; push(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3); }
    lcx = x2; lcy = y2; x = x3; y = y3;
  };
  const quad = (x1, y1, x2, y2) => {
    const L = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; push(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2); }
    lq = [x1, y1]; x = x2; y = y2;
  };
  const line = (x2, y2) => {
    const L = Math.hypot(x2 - x, y2 - y), n = Math.max(1, Math.ceil(L / (step * 3)));
    for (let k = 1; k <= n; k++) push(x + (x2 - x) * k / n, y + (y2 - y) * k / n);
    x = x2; y = y2;
  };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C !== 'C' && C !== 'S') lcx = NaN;
    if (C !== 'Q' && C !== 'T') lq = null;
    switch (C) {
      case 'M': { x = num() + ox; y = num() + oy; sx = x; sy = y; cur = { pts: [[x, y]], closed: false }; subs.push(cur); cmd = rel ? 'l' : 'L'; break; }
      case 'L': line(num() + ox, num() + oy); break;
      case 'H': line(num() + ox, y); break;
      case 'V': line(x, num() + oy); break;
      case 'C': { const a = num() + ox, b = num() + oy, c = num() + ox, dd = num() + oy, e = num() + ox, f = num() + oy; cubic(a, b, c, dd, e, f); break; }
      case 'S': { const a = isNaN(lcx) ? x : 2 * x - lcx, b = isNaN(lcx) ? y : 2 * y - lcy; const c = num() + ox, dd = num() + oy, e = num() + ox, f = num() + oy; cubic(a, b, c, dd, e, f); break; }
      case 'Q': { const a = num() + ox, b = num() + oy, c = num() + ox, dd = num() + oy; quad(a, b, c, dd); break; }
      case 'T': { const a = lq ? 2 * x - lq[0] : x, b = lq ? 2 * y - lq[1] : y; quad(a, b, num() + ox, num() + oy); break; }
      case 'Z': { if (Math.hypot(x - sx, y - sy) > 0.01) line(sx, sy); cur.closed = true; x = sx; y = sy; cur.pts.pop(); break; }
      default: i++;
    }
  }
  return subs.filter(s => s.pts.length > 1);
}
export function toPath(subs, path = new Path2D()) {
  for (const s of subs) { s.pts.forEach(([x, y], k) => k ? path.lineTo(x, y) : path.moveTo(x, y)); if (s.closed) path.closePath(); }
  return path;
}
export function bboxOf(polys, pad = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}
// shape(d, f): an SVG path placed in the world. polys = closed rings, lines = open subpaths.
export function shape(d, f = xf(), step = 2) {
  const s = f.scale || 1, subs = parseD(d, step / s).map(sp => ({ pts: sp.pts.map(f), closed: sp.closed }));
  return fromSubs(subs);
}
export function fromSubs(subs) {
  const polys = subs.filter(x => x.closed).map(x => x.pts), lines = subs.filter(x => !x.closed).map(x => x.pts);
  return { subs, polys, lines, path: toPath(subs), bbox: bboxOf(subs.map(x => x.pts)) };
}
export const ring = pts => fromSubs([{ pts, closed: true }]);
export function ellipsePts(cx, cy, rx, ry, rot = 0, n = 64, a0 = 0, a1 = Math.PI * 2) {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
  for (let k = 0; k < (full ? n : n + 1); k++) { const a = a0 + (a1 - a0) * k / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push([cx + c * x - s * y, cy + s * x + c * y]); }
  return out;
}
export const ellipse = (cx, cy, rx, ry, rot = 0, n = 72) => ring(ellipsePts(cx, cy, rx, ry, rot, n));
export function inPoly(polys, x, y) {
  let ins = false;
  for (const p of polys) for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
// inside any of several (possibly overlapping) rings
export const inAny = (polys, x, y) => { for (const p of polys) if (inPoly([p], x, y)) return true; return false; };
export function resample(pts, step) {
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const d = Math.hypot(bx - ax, by - ay); let t0 = 0;
    if (d < 1e-9) continue;
    while (acc + d * (1 - t0) >= step) { const need = step - acc, t = t0 + need / d; out.push([ax + (bx - ax) * t, ay + (by - ay) * t]); t0 = t; acc = 0; }
    acc += d * (1 - t0);
  }
  const last = pts[pts.length - 1], o = out[out.length - 1];
  if (Math.hypot(o[0] - last[0], o[1] - last[1]) > 0.5) out.push(last);
  return out;
}
export function normals(P, closed) {
  const n = P.length, N = [];
  for (let i = 0; i < n; i++) {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; N.push([dy / L, -dx / L]);
  }
  return N;
}
export const polyArea = P => { let s = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; s += x1 * y2 - x2 * y1; } return s / 2; };
// offset a closed ring outward by d(i) (negative = inward). Fine for the mostly convex shapes of a specimen.
export function offsetRing(P, d) {
  const N = normals(P, true), sg = polyArea(P) > 0 ? 1 : -1;
  return P.map((p, i) => { const k = typeof d === 'function' ? d(i, p) : d; return [p[0] - N[i][0] * sg * k, p[1] - N[i][1] * sg * k]; });
}
// sample a polyline by arc length: returns point + tangent at fraction u
export function along(P, u) {
  let L = 0; const seg = []; for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(d); L += d; }
  let s = clamp(u) * L;
  for (let i = 0; i < seg.length; i++) {
    if (s <= seg[i] || i === seg.length - 1) { const f = seg[i] ? clamp(s / seg[i]) : 0, a = P[i], b = P[i + 1]; return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, dx: (b[0] - a[0]) / (seg[i] || 1), dy: (b[1] - a[1]) / (seg[i] || 1), L }; }
    s -= seg[i];
  }
  return { x: P[0][0], y: P[0][1], dx: 1, dy: 0, L };
}

// ---------- the ink store: ordered strokes, width-bucketed Path2D chunks ----------
const WB0 = 0.22, WBR = 1.13, NB = 34;
export const BW = Array.from({ length: NB }, (_, b) => WB0 * Math.pow(WBR, b));
const bucket = w => Math.max(0, Math.min(NB - 1, Math.round(Math.log(w / WB0) / Math.log(WBR))));
export class Ink {
  constructor({ color = INK, minW = 0.16, chunk = 160 } = {}) { this.color = color; this.minW = minW; this.chunk = chunk; this.S = []; this.g = 'main'; this.built = false; }
  group(name) { this.g = name; return this; }
  // pts [[x,y]…], w number | per-point array. A width ≤ minW breaks the line (the burin lifts).
  add(pts, w) {
    const n = pts.length; if (n < 2) return;
    const xy = new Float32Array(n * 2), ws = new Float32Array(n); let len = 0;
    for (let i = 0; i < n; i++) { xy[2 * i] = pts[i][0]; xy[2 * i + 1] = pts[i][1]; ws[i] = typeof w === 'number' ? w : w[i]; if (i) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); }
    let any = false; for (let i = 0; i < n - 1; i++) if ((ws[i] + ws[i + 1]) * 0.5 > this.minW) { any = true; break; }
    if (!any) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) { const x = xy[2 * i], y = xy[2 * i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    this.S.push({ xy, ws, n, len, g: this.g, s0: 0, s1: 0, bb: [x0, y0, x1, y1], i: this.S.length });
    this.built = false;
  }
  dot(x, y, r) { this.add([[x - r * 0.02, y], [x + r * 0.02, y]], r * 2); }
  groups() { return [...new Set(this.S.map(s => s.g))]; }
  // Give every stroke of a group a cutting window inside [t0, t1]. Order = the order the strokes were added
  // (hatch families sweep across the form), time ∝ cumulative cut length, so the burin keeps an even speed.
  // conc: how many lines are being cut at once (≥1). Strokes may be reordered with opts.key(stroke).
  schedule(group, t0, t1, { conc = 6, key = null, minDur = 0.06 } = {}) {
    const gs = Array.isArray(group) ? group : [group];
    let L = this.S.filter(s => gs.includes(s.g));
    if (key) L = L.map(s => [key(s), s]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const tot = L.reduce((a, s) => a + s.len, 0) || 1, T = t1 - t0, v = tot / (T * conc);   // burin speed, px/s
    let acc = 0;
    for (const s of L) {
      const d = Math.min(T, Math.max(minDur, s.len / v));
      let st = t0 + (acc / tot) * T, en = Math.min(t1, st + d); if (en - st < minDur) st = en - minDur;
      s.s0 = st; s.s1 = en; acc += s.len;
    }
    this.built = false; return this;
  }
  // strokes of a group appear at once (no growth), e.g. for a finished figure
  instant(group, t = -1) { for (const s of this.S) if (s.g === group) { s.s0 = t - 1e-3; s.s1 = t; } this.built = false; return this; }
  build() {
    const S = this.S.slice().sort((a, b) => a.s1 - b.s1); this.sorted = S; this.maxDur = S.reduce((m, x) => Math.max(m, x.s1 - x.s0), 0);
    this.chunks = [];
    for (let a = 0; a < S.length; a += this.chunk) {
      const b = Math.min(S.length, a + this.chunk), per = new Map(); let bb = [Infinity, Infinity, -Infinity, -Infinity];
      for (let k = a; k < b; k++) { const s = S[k]; this._runs(s, s.n - 1, per); bb = [Math.min(bb[0], s.bb[0]), Math.min(bb[1], s.bb[1]), Math.max(bb[2], s.bb[2]), Math.max(bb[3], s.bb[3])]; }
      this.chunks.push({ a, b, t: S[b - 1].s1, bb: [bb[0] - 8, bb[1] - 8, bb[2] + 8, bb[3] + 8], paths: [...per.entries()].map(([k, p]) => [BW[k], p]) });
    }
    this.built = true; return this;
  }
  // append the runs of stroke s up to point position f (float index) into per-bucket paths
  _runs(s, f, per) {
    const { xy, ws } = s, last = Math.min(s.n - 1, f); let rb = -1, p = null;
    for (let i = 0; i < last; i++) {
      const seg = Math.min(1, last - i); if (seg <= 0) break;
      const w = (ws[i] + ws[i + 1]) * 0.5; if (!(w > this.minW)) { rb = -1; continue; }
      const b = bucket(w);
      if (b !== rb) { p = per.get(b); if (!p) per.set(b, p = new Path2D()); p.moveTo(xy[2 * i], xy[2 * i + 1]); rb = b; }
      p.lineTo(xy[2 * i] + (xy[2 * i + 2] - xy[2 * i]) * seg, xy[2 * i + 1] + (xy[2 * i + 3] - xy[2 * i + 1]) * seg);
    }
  }
  // draw everything cut by time t (Infinity = all). Returns the tips being cut right now (for glints and sound).
  draw(ctx, t = Infinity, { view = viewRect(ctx), color = this.color, wScale = 1, dx = 0, dy = 0 } = {}) {
    if (!this.built) this.build();
    ctx.save(); if (dx || dy) ctx.translate(dx, dy);
    ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const vis = bb => !view || !(bb[2] < view[0] || bb[0] > view[2] || bb[3] < view[1] || bb[1] > view[3]);
    let k = 0; const tips = [];
    for (; k < this.chunks.length; k++) {
      const c = this.chunks[k]; if (c.t > t) break;
      if (!vis(c.bb)) continue;
      for (const [w, p] of c.paths) { ctx.lineWidth = w * wScale; ctx.stroke(p); }
    }
    if (k < this.chunks.length) {
      const per = new Map(), S = this.sorted;
      for (let i = this.chunks[k].a; i < S.length; i++) {
        const s = S[i]; if (s.s0 >= t) { if (s.s1 > t + this.maxDur + 1e-3) break; continue; }
        const f = s.s1 <= t ? s.n - 1 : (s.n - 1) * clamp((t - s.s0) / (s.s1 - s.s0));
        if (!vis(s.bb)) continue;
        this._runs(s, f, per);
        if (s.s1 > t) { const j = Math.min(s.n - 2, Math.floor(f)), u = f - j; tips.push([s.xy[2 * j] + (s.xy[2 * j + 2] - s.xy[2 * j]) * u, s.xy[2 * j + 1] + (s.xy[2 * j + 3] - s.xy[2 * j + 1]) * u, s.ws[j]]); }
      }
      for (const [b, p] of per) { ctx.lineWidth = BW[b] * wScale; ctx.stroke(p); }
    }
    ctx.restore();
    return tips;
  }
  // time span of a group (after schedule)
  span(group) { let a = Infinity, b = -Infinity; for (const s of this.S) if (s.g === group) { a = Math.min(a, s.s0); b = Math.max(b, s.s1); } return [a, b]; }
  count(group) { return this.S.filter(s => !group || s.g === group).length; }
}
// visible world rectangle under the current transform
export function viewRect(ctx, pad = 20) {
  const m = ctx.getTransform().inverse(), W = ctx.canvas.width, H = ctx.canvas.height;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) { const X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  const s = Math.hypot(m.a, m.b) * pad; return [x0 - s, y0 - s, x1 + s, y1 + s];
}

// ---------- hatching ----------
function spans(E, b) {
  const xs = [];
  for (let k = 0; k < E.length; k += 4) { const B1 = E[k + 1], B2 = E[k + 3]; if ((B1 <= b) !== (B2 <= b)) xs.push(E[k] + (b - B1) / (B2 - B1) * (E[k + 2] - E[k])); }
  xs.sort((p, q) => p - q); return xs;
}
function subtract(a, e) {
  if (!e.length) return a;
  const out = [];
  for (let i = 0; i < a.length; i += 2) {
    let s = a[i]; const f = a[i + 1];
    for (let j = 0; j < e.length; j += 2) { if (e[j + 1] <= s || e[j] >= f) continue; if (e[j] > s) out.push(s, e[j]); s = Math.max(s, e[j + 1]); if (s >= f) break; }
    if (s < f) out.push(s, f);
  }
  return out;
}
// One family of parallel lines at `angle`, bent by `bend` (parabolic about a0) so they wrap the form,
// clipped to polys minus excl. Width follows tone(x, y): absent below thr, swelling to wMax in the darks.
// The engraver's convention: lines taper at both ends and swell where the form turns away from the light.
export function hatch(ink, polys, o = {}) {
  const { angle = 0, spacing = 6, bend = 0, tone = () => 0.5, thr = 0.15, wMin = 0.18, wMax = 2.0, gamma = 1.0, step = 2.5, taper = 10,
    jitter = 0.12, wobble = 0.35, seed = 1, excl = null, origin = null, a0 = 0, dash = 0, bend2 = 0, flipDir = false, swell = 0.8 } = o;
  if (!polys || !polys.length) return;
  const c = Math.cos(angle), s = Math.sin(angle), bb = bboxOf(polys), O = origin || [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
  const tr = ([x, y]) => { const dx = x - O[0], dy = y - O[1], A = dx * c + dy * s; return [A, -dx * s + dy * c - bend * (A - a0) * (A - a0) - bend2 * (A - a0) ** 3]; };
  const edges = pl => { const E = []; for (const p of pl) for (let i = 0; i < p.length; i++) { const [a1, b1] = tr(p[i]), [a2, b2] = tr(p[(i + 1) % p.length]); E.push(a1, b1, a2, b2); } return E; };
  const E = edges(polys), X = excl && excl.length ? excl.map(q => edges([q])) : null;
  let bmin = Infinity, bmax = -Infinity; for (let k = 1; k < E.length; k += 2) { bmin = Math.min(bmin, E[k]); bmax = Math.max(bmax, E[k]); }
  const R = RNG(seed); let li = 0;
  for (let b = bmin + spacing * (0.3 + 0.5 * R()); b < bmax; b += spacing * (1 + (R() - 0.5) * jitter), li++) {
    let iv = spans(E, b); if (X) for (const xe of X) { const ev = spans(xe, b); if (ev.length) iv = subtract(iv, ev); }
    for (let k = 0; k + 1 < iv.length; k += 2) {
      const A0 = iv[k], A1 = iv[k + 1], L = A1 - A0; if (L < 1) continue;
      const n = Math.max(2, Math.ceil(L / step)), pts = [], ws = [];
      for (let j = 0; j <= n; j++) {
        const A = A0 + L * j / n, wob = (noise1(A * 0.015 + li * 3.7, seed) - 0.5) * wobble * 2;
        const B = b + bend * (A - a0) * (A - a0) + bend2 * (A - a0) ** 3 + wob;
        const x = O[0] + A * c - B * s, y = O[1] + A * s + B * c;
        const tv = tone(x, y); const v = (tv - thr) / (1 - thr); let w = 0;
        if (v > 0) w = wMin + (wMax - wMin) * Math.pow(Math.min(1, v * 1.25), gamma);
        // the burin's swelling line: it enters fine, bites deeper toward the middle of its run and lifts out to a point
        const uu = (A - A0) / L, tp = Math.max(taper, L * 0.22), e = Math.min(A - A0, A1 - A);
        w *= (1 - swell) + swell * Math.pow(Math.sin(Math.PI * uu), 0.7);
        if (e < tp) w *= Math.pow(e / tp, 0.8);
        if (dash && noise1(A * dash + li * 9.1, seed + 7) < 0.28) w = 0;
        pts.push([x, y]); ws.push(w);
      }
      if (flipDir !== (li % 2 === 1 && o.boustro)) ink.add(pts, ws); else ink.add(pts.reverse(), ws.reverse());
    }
  }
}
// the engraver's three passes: a first family where the tone asks, a crossing family in the half-tones,
// a third (lozenge) family in the deep darks. Each pass goes in its own ink group (`${g}`, `${g}2`, `${g}3`)
// so a film can cut them one after another.
export function engraveTone(ink, polys, o = {}) {
  const { angle = -0.7, spacing = 6, cross = 1.05, third = -0.5, t2 = 0.5, t3 = 0.78, wMax = 1.9, bend = 0, excl, seed = 1, g = null } = o;
  const G = ink.g;
  if (g) ink.group(g);
  hatch(ink, polys, { ...o, angle, spacing, bend, wMax, seed });
  if (g) ink.group(g + '2');
  if (t2 !== null) hatch(ink, polys, { ...o, angle: angle + cross, spacing: spacing * 1.1, bend: -bend * 0.6, thr: t2, wMax: wMax * 0.78, seed: seed + 11, excl });
  if (g) ink.group(g + '3');
  if (t3 !== null) hatch(ink, polys, { ...o, angle: angle + third, spacing: spacing * 1.25, bend: bend * 0.3, thr: t3, wMax: wMax * 0.6, seed: seed + 23, excl });
  ink.group(G);
}
// contour hatching along a guide curve (sleeves of a leg, the rim of an eye)
export function hatchAlong(ink, polys, guide, o = {}) {
  const { spacing = 6, from = 0, to = 20, tone = () => 0.5, thr = 0.15, wMin = 0.3, wMax = 1.8, taper = 10, seed = 1, excl = null, step = 2.5, wobble = 0.3 } = o;
  const G = resample(guide, step), N = normals(G, false), R = RNG(seed);
  for (let k = from; k <= to; k++) {
    const off = k * spacing + (R() - 0.5) * spacing * 0.2, pts = [], ws = [];
    const flush = () => { if (pts.length > 1) { const L = pts.length; for (let j = 0; j < L; j++) { const e = Math.min(j, L - 1 - j) * step; if (e < taper) ws[j] *= Math.pow(e / taper, 0.6); } ink.add(pts.slice(), ws.slice()); } pts.length = 0; ws.length = 0; };
    for (let j = 0; j < G.length; j++) {
      const wob = (noise1(j * 0.08 + k * 5.3, seed) - 0.5) * wobble * 2;
      const x = G[j][0] + N[j][0] * (off + wob), y = G[j][1] + N[j][1] * (off + wob);
      if (!inPoly(polys, x, y) || (excl && inPoly(excl, x, y))) { flush(); continue; }
      const v = (tone(x, y) - thr) / (1 - thr); const w = v > 0 ? wMin + (wMax - wMin) * Math.min(1, v * 1.25) : 0;
      pts.push([x, y]); ws.push(w);
    }
    flush();
  }
}
// swelling outline: heavier on the side turned from the light, slightly irregular, tapered on open strokes
export function outline(ink, pts, o = {}) {
  const { w = 2, closed = true, light = [-0.6, -0.8], vary = 0.8, taper = 14, seed = 3, step = 2, excl = null, grain = 0.2, w0 = null, w1 = null, run = 110, pinch = 0.55, swell = true } = o;
  let P = resample(closed ? [...pts, pts[0]] : pts, step); if (closed) P.pop();
  const n = P.length; if (n < 2) return;
  const N = normals(P, closed), sg = closed ? (polyArea(P) > 0 ? 1 : -1) : 1, L = Math.hypot(...light), lx = light[0] / L, ly = light[1] / L;
  const ws = [];
  for (let i = 0; i < n; i++) {
    let wi = w;
    if (closed) { const sh = -(N[i][0] * sg * lx + N[i][1] * sg * ly); wi *= 1 - vary * 0.45 + vary * 0.9 * clamp(sh * 0.5 + 0.5); }
    wi *= 1 + (noise1(i * step * 0.03, seed) - 0.5) * grain * 2;
    // a contour is cut in several runs of the burin; each run swells and thins where the next one takes over
    if (closed && run) { const ph = (i * step) / run + noise1(i * step / run * 0.7, seed + 5) * 0.6; wi *= (1 - pinch) + pinch * Math.pow(Math.abs(Math.sin(Math.PI * ph)), 0.55); }
    if (!closed) { const Lt = (n - 1) * step, tp = swell ? Math.max(taper, Lt * 0.3) : taper, e0 = i * step, e1 = (n - 1 - i) * step; wi *= Math.pow(Math.min(1, e0 / tp), 0.75) * Math.pow(Math.min(1, e1 / tp), 0.75) * (swell ? 0.75 + 0.25 * Math.sin(Math.PI * i / (n - 1)) : 1); if (w0 != null || w1 != null) wi *= mix(w0 ?? 1, w1 ?? 1, i / (n - 1)); }
    if (excl && inAny(excl, P[i][0], P[i][1])) wi = 0;
    ws.push(wi);
  }
  if (closed) { P.push(P[0]); ws.push(ws[0]); }
  ink.add(P, ws);
}
export const stroke = (ink, pts, w = 1.4, o = {}) => outline(ink, pts, { closed: false, w, taper: o.taper ?? 16, grain: 0.15, ...o });
// stipple (flesh of a surface, dust, pollen): dots whose density follows tone
export function stipple(ink, polys, { density = 0.02, tone = () => 0.5, r = 0.7, seed = 5, thr = 0.2, excl = null } = {}) {
  const bb = bboxOf(polys), R = RNG(seed), n = Math.floor((bb[2] - bb[0]) * (bb[3] - bb[1]) * density);
  const pts = [];
  for (let i = 0; i < n; i++) { const x = bb[0] + R() * (bb[2] - bb[0]), y = bb[1] + R() * (bb[3] - bb[1]); if (!inPoly(polys, x, y) || (excl && inAny(excl, x, y))) continue; const t = tone(x, y); if (R() < (t - thr) * 1.4) pts.push([x, y, r * (0.6 + t)]); }
  pts.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [x, y, rr] of pts) ink.dot(x, y, rr);
}
// hair / fur: short tapered flicks rooted inside the shape, combed along dir(x,y) (unit vector), longer at the rim.
export function fur(ink, polys, { density = 0.01, len = 10, dir = () => [0, 1], w = 0.9, seed = 9, tone = () => 0.6, curl = 0.25, rimOut = 1, excl = null } = {}) {
  const bb = bboxOf(polys), R = RNG(seed), n = Math.floor((bb[2] - bb[0]) * (bb[3] - bb[1]) * density);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = bb[0] + R() * (bb[2] - bb[0]), y = bb[1] + R() * (bb[3] - bb[1]); if (!inPoly(polys, x, y) || (excl && inAny(excl, x, y))) continue;
    const t = tone(x, y); if (R() > 0.35 + t * 0.9) continue;
    let [dx, dy] = dir(x, y); const L = len * (0.6 + R() * 0.8) * (1 + rimOut * 0), c = (R() - 0.5) * curl;
    const pts = [], ws = []; let px = x, py = y;
    for (let k = 0; k <= 5; k++) { pts.push([px, py]); ws.push(w * (0.5 + t * 0.9) * Math.sin(Math.PI * (0.15 + 0.85 * k / 5)) ** 0.6 * (1 - k / 7)); const a = c * k / 5; const ca = Math.cos(a), sa = Math.sin(a); const nx = dx * ca - dy * sa, ny = dx * sa + dy * ca; px += nx * L / 5; py += ny * L / 5; }
    out.push([y, pts, ws]);
  }
  out.sort((a, b) => a[0] - b[0]);
  for (const [, pts, ws] of out) ink.add(pts, ws);
}

// ---------- tone fields ----------
export const LIGHT = { x: -0.55, y: -0.6, z: 0.58 };
const normL = L => { const l = Math.hypot(L.x, L.y, L.z); return { x: L.x / l, y: L.y / l, z: L.z / l }; };
export function sphereTone(cx, cy, rx, ry, { base = 0, k = 1, L = LIGHT, rot = 0 } = {}) {
  const c = Math.cos(-rot), s = Math.sin(-rot); L = normL(L);
  return (x, y) => {
    let dx = (x - cx), dy = (y - cy); [dx, dy] = [(dx * c - dy * s) / rx, (dx * s + dy * c) / ry];
    const r2 = dx * dx + dy * dy, nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2))), d = dx * L.x + dy * L.y + nz * L.z;
    return clamp(base + k * (1 - clamp(d)) * 0.9 + (r2 > 0.85 ? (r2 - 0.85) * 1.2 : 0));
  };
}
export function cylTone(cx, cy, r, a, { base = 0, k = 1, L = LIGHT } = {}) {
  const c = Math.cos(a), s = Math.sin(a); L = normL(L);
  return (x, y) => {
    const u = clamp((-(x - cx) * s + (y - cy) * c) / r, -1, 1), nx = -s * u, ny = c * u, nz = Math.sqrt(1 - u * u);
    const d = nx * L.x + ny * L.y + nz * L.z; return clamp(base + k * (1 - clamp(d)) * 0.9);
  };
}
export const linTone = (x0, y0, x1, y1, t0, t1) => { const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy; return (x, y) => mix(t0, t1, clamp(((x - x0) * dx + (y - y0) * dy) / L2)); };
export const addT = (...fs) => (x, y) => clamp(fs.reduce((a, f) => a + (typeof f === 'number' ? f : f(x, y)), 0));
export const maxT = (...fs) => (x, y) => Math.max(...fs.map(f => typeof f === 'number' ? f : f(x, y)));
export const mulT = (f, k) => (x, y) => clamp(f(x, y) * k);
export const blobTone = (cx, cy, rx, ry, v = 0.6, soft = 0.5) => (x, y) => { const d = Math.hypot((x - cx) / rx, (y - cy) / ry); return v * (1 - sstep(1 - soft, 1, d)); };

// ---------- any shape + a light → a modelled tone field ----------
// Rasterise the shape, take its distance field, inflate it into a pillow (height ∝ √ of the distance),
// light the pillow with a Lambert term. Returns tone(x,y) in 0 (lit) … 1 (turned away), plus .df(x,y) (distance
// to the edge in world px) and .grad(x,y) for contour hatching.
export function formTone(polys, { light = [-0.6, -0.7], lz = 0.55, base = 0.05, k = 1, res = 180, radius = null, rim = 0.25, ambient = 0 } = {}) {
  const bb = bboxOf(polys, 2), W = bb[2] - bb[0], H = bb[3] - bb[1], g = Math.max(W, H) / res;
  const nx = Math.ceil(W / g) + 1, ny = Math.ceil(H / g) + 1, D = new Float32Array(nx * ny), INF = 1e9;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) D[j * nx + i] = inPoly(polys, bb[0] + i * g, bb[1] + j * g) ? INF : 0;
  // two-pass chamfer (3-4) distance transform, in grid units
  const a = 1, b = 1.4142;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const id = j * nx + i; if (!D[id]) continue; let m = D[id];
    if (i > 0) m = Math.min(m, D[id - 1] + a); if (j > 0) m = Math.min(m, D[id - nx] + a); if (i > 0 && j > 0) m = Math.min(m, D[id - nx - 1] + b); if (i < nx - 1 && j > 0) m = Math.min(m, D[id - nx + 1] + b); D[id] = m; }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const id = j * nx + i; if (!D[id]) continue; let m = D[id];
    if (i < nx - 1) m = Math.min(m, D[id + 1] + a); if (j < ny - 1) m = Math.min(m, D[id + nx] + a); if (i < nx - 1 && j < ny - 1) m = Math.min(m, D[id + nx + 1] + b); if (i > 0 && j < ny - 1) m = Math.min(m, D[id + nx - 1] + b); D[id] = m; }
  let dmax = 0; for (const v of D) if (v > dmax) dmax = v;
  const R = (radius ? radius / g : dmax) || 1;
  const Hh = new Float32Array(nx * ny); for (let i = 0; i < D.length; i++) { const u = Math.min(1, D[i] / R); Hh[i] = Math.sqrt(1 - (1 - u) * (1 - u)) * R; }
  const Ll = Math.hypot(light[0], light[1], lz), lx = light[0] / Ll, ly = light[1] / Ll, lzz = lz / Ll;
  const T = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const id = j * nx + i; if (!D[id]) { T[id] = 0; continue; }
    const hx = (Hh[j * nx + Math.min(nx - 1, i + 1)] - Hh[j * nx + Math.max(0, i - 1)]) / 2, hy = (Hh[Math.min(ny - 1, j + 1) * nx + i] - Hh[Math.max(0, j - 1) * nx + i]) / 2;
    const L = Math.hypot(hx, hy, 1), nX = -hx / L, nY = -hy / L, nZ = 1 / L;
    const lam = clamp(nX * lx + nY * ly + nZ * lzz);
    T[id] = clamp(base + k * (1 - lam) * 0.95 + rim * Math.max(0, 1 - D[id] / (R * 0.18)) * 0.6 - ambient);
  }
  const samp = A => (x, y) => { const fx = (x - bb[0]) / g, fy = (y - bb[1]) / g, i = Math.floor(fx), j = Math.floor(fy); if (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1) return 0; const u = fx - i, v = fy - j, id = j * nx + i; return (A[id] * (1 - u) + A[id + 1] * u) * (1 - v) + (A[id + nx] * (1 - u) + A[id + nx + 1] * u) * v; };
  const f = samp(T); const dg = samp(D); f.df = (x, y) => dg(x, y) * g; f.grid = { D, nx, ny, g, bb }; return f;
}
// lines that follow the form: iso-distance contours of the shape (marching squares on the distance field),
// widths by tone. The classic engraver's "contour lines" on a rounded body.
export function contourHatch(ink, polys, { spacing = 6, tone = null, thr = 0.15, wMin = 0.3, wMax = 1.8, from = 0.5, maxLevels = 200, taper = 8, seed = 4, light } = {}) {
  const f = tone || formTone(polys, { light }); const { D, nx, ny, g, bb } = f.grid;
  const R = RNG(seed);
  for (let lv = 0; lv < maxLevels; lv++) {
    const iso = (from + lv) * spacing / g + (R() - 0.5) * 0.15; let any = false;
    const segs = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const id = j * nx + i, v0 = D[id], v1 = D[id + 1], v2 = D[id + nx + 1], v3 = D[id + nx];
      let c = 0; if (v0 > iso) c |= 1; if (v1 > iso) c |= 2; if (v2 > iso) c |= 4; if (v3 > iso) c |= 8;
      if (c === 0 || c === 15) continue; any = true;
      const P = (ax, ay, va, bx, by, vb) => { const u = (iso - va) / (vb - va); return [bb[0] + (ax + (bx - ax) * u) * g, bb[1] + (ay + (by - ay) * u) * g]; };
      const e = [P(i, j, v0, i + 1, j, v1), P(i + 1, j, v1, i + 1, j + 1, v2), P(i + 1, j + 1, v2, i, j + 1, v3), P(i, j + 1, v3, i, j, v0)];
      const T = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[0, 3]] }[c];
      for (const [p, q] of T) segs.push([e[p], e[q]]);
    }
    if (!any) break;
    // chain segments into polylines
    const key = p => Math.round(p[0] * 20) + ',' + Math.round(p[1] * 20), ends = new Map(), used = new Uint8Array(segs.length);
    segs.forEach((s, k) => { for (const e of [0, 1]) { const kk = key(s[e]); (ends.get(kk) || ends.set(kk, []).get(kk)).push(k); } });
    for (let k0 = 0; k0 < segs.length; k0++) {
      if (used[k0]) continue; used[k0] = 1; const line = [segs[k0][0], segs[k0][1]];
      for (const dir of [1, 0]) { for (;;) { const end = dir ? line[line.length - 1] : line[0]; const cand = (ends.get(key(end)) || []).find(k => !used[k]); if (cand == null) break; used[cand] = 1; const s = segs[cand]; const nxt = key(s[0]) === key(end) ? s[1] : s[0]; if (dir) line.push(nxt); else line.unshift(nxt); } }
      if (line.length < 3) continue;
      const P = resample(line, 2.5), ws = P.map(([x, y]) => { const v = (f(x, y) - thr) / (1 - thr); return v > 0 ? wMin + (wMax - wMin) * Math.min(1, v * 1.25) : 0; });
      const n = P.length; for (let j = 0; j < n; j++) { const e = Math.min(j, n - 1 - j) * 2.5; if (e < taper) ws[j] *= Math.pow(e / taper, 0.6); }
      ink.add(P, ws);
    }
  }
}
