// Whiteboard Explainer engine (v2) — dry-erase marker ink on a glossy board, no hands.
// World units ≈ screen px at zoom 1. Everything is deterministic in t.
//   shapes  : line / poly / curve / arc / circle / rect / arrow / dashed / text / hatch → Stroke[]
//   timeline: Timeline.draw(pen, shapes, t0, opts) schedules strokes; pens float in, draw, lift, park off-frame
//   render  : Board.render(ctx, t, cam) — board, ghosts, ink (with erasers), texture, objects
import { clamp, lerp, vnoise, hash, mulberry, TAU } from '/core/lib.js';

export const INK = { black: '#23262c', blue: '#2a5cb3', orange: '#d97757', red: '#c8413a', green: '#2e7a4d' };
const RGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// ───────────────────────── geometry
function resample(p, step) {                       // flat [x,y,...] → evenly spaced
  const o = [p[0], p[1]]; let carry = 0;
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1], d = Math.hypot(bx - ax, by - ay);
    let s = step - carry;
    while (s <= d) { o.push(ax + (bx - ax) * s / d, ay + (by - ay) * s / d); s += step; }
    carry = d - (s - step);
  }
  const n = p.length; if (Math.hypot(o[o.length - 2] - p[n - 2], o[o.length - 1] - p[n - 1]) > step * .25) o.push(p[n - 2], p[n - 1]);
  return o;
}
function chaikin(p, it = 1) {
  for (let k = 0; k < it; k++) {
    const o = [p[0], p[1]];
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3];
      o.push(ax * .75 + bx * .25, ay * .75 + by * .25, ax * .25 + bx * .75, ay * .25 + by * .75);
    }
    o.push(p[p.length - 2], p[p.length - 1]); p = o;
  }
  return p;
}

// ───────────────────────── stroke
let SEED = 1;
export class Stroke {
  // pts: flat world coords. o: {color, w, jitter, wav, seed, over, alpha, kind, speed, smooth}
  constructor(pts, o = {}) {
    this.color = o.color || null; this.w = o.w ?? 9; this.alpha = o.alpha ?? .94;
    this.kind = o.kind || 'line'; this.speed = o.speed; this.seed = o.seed ?? SEED++;
    const step = Math.max(3, this.w * .6);
    let p = resample(o.smooth ? chaikin(pts, o.smooth) : pts, step);
    const J = o.jitter ?? 1, wav = o.wav ?? 220;
    if (J > 0 && p.length > 4) {                   // hand wobble: low-frequency offset along the normal
      const q = p.slice(); let s = 0;
      for (let i = 0; i < p.length; i += 2) {
        const j = Math.min(i, p.length - 4), tx = p[j + 2] - p[j], ty = p[j + 3] - p[j + 1], tl = Math.hypot(tx, ty) || 1;
        if (i) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
        const off = J * 2.6 * ((vnoise(s / wav + this.seed * 7.31) - .5) * 2 + .45 * (vnoise(s / (wav * .23) + this.seed * 3.1) - .5));
        q[i] = p[i] - ty / tl * off; q[i + 1] = p[i + 1] + tx / tl * off;
      }
      p = q;
    }
    if (o.over && p.length > 4) {                  // overshoot + tiny hook at the end
      const n = p.length, tx = p[n - 2] - p[n - 4], ty = p[n - 1] - p[n - 3], tl = Math.hypot(tx, ty) || 1;
      const hk = (hash(this.seed) - .5) * .5;
      for (let k = 1; k <= 4; k++) {
        const f = o.over * k / 4, a = hk * k / 4;
        p.push(p[n - 2] + (tx / tl * Math.cos(a) - ty / tl * Math.sin(a)) * f, p[n - 1] + (ty / tl * Math.cos(a) + tx / tl * Math.sin(a)) * f);
      }
    }
    this.clip = o.clip || null;
    this.pts = Float32Array.from(p);
    const n = p.length / 2; this.cum = new Float32Array(n);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < n; i++) {
      if (i) this.cum[i] = this.cum[i - 1] + Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
      x0 = Math.min(x0, p[2 * i]); x1 = Math.max(x1, p[2 * i]); y0 = Math.min(y0, p[2 * i + 1]); y1 = Math.max(y1, p[2 * i + 1]);
    }
    this.len = this.cum[n - 1] || 0.001; this.box = [x0 - this.w, y0 - this.w, x1 + this.w, y1 + this.w];
    this.t0 = 1e9; this.t1 = 1e9;                  // set by Timeline
  }
  at(L) {                                          // point at arc length L
    const c = this.cum, p = this.pts; L = clamp(L, 0, this.len);
    let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] < L) lo = m; else hi = m; }
    const u = (L - c[lo]) / ((c[hi] - c[lo]) || 1);
    return [lerp(p[2 * lo], p[2 * hi], u), lerp(p[2 * lo + 1], p[2 * hi + 1], u)];
  }
  get start() { return [this.pts[0], this.pts[1]]; }
  get end() { const n = this.pts.length; return [this.pts[n - 2], this.pts[n - 1]]; }
  // stroke progress 0..1 at time t (hand speed: slow in, fast middle, slow out)
  prog(t) { if (t <= this.t0) return 0; if (t >= this.t1) return 1; const u = (t - this.t0) / (this.t1 - this.t0); return u - Math.sin(TAU * u) / TAU * .8; }
}

// ribbon fill of the first L units of a stroke (variable width = chisel + pressure)
function ribbon(ctx, s, L, k) {
  const p = s.pts, c = s.cum, n = c.length; if (L <= 0) return;
  let m = n; for (let i = 1; i < n; i++) if (c[i] > L) { m = i + 1; break; }
  const X = new Float32Array(m), Y = new Float32Array(m), H = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    if (i === m - 1 && c[Math.min(i, n - 1)] > L) { const q = s.at(L); X[i] = q[0]; Y[i] = q[1]; }
    else { X[i] = p[2 * i]; Y[i] = p[2 * i + 1]; }
  }
  const w = s.w * k;
  for (let i = 0; i < m; i++) {
    const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
    const th = Math.atan2(Y[b] - Y[a], X[b] - X[a]);
    const d = c[Math.min(i, n - 1)];
    const pr = Math.min(1, .72 + d / (s.w * 2.2)) * (1 - .12 * clamp((d - (s.len - s.w * 2)) / (s.w * 2)));
    H[i] = w * .5 * (.8 + .2 * Math.abs(Math.sin(th - 2.35))) * pr;
  }
  if (m < 2 || s.len < s.w * 1.2) { const r = s.w * .6 * k; ctx.moveTo(X[0] + r, Y[0]); ctx.arc(X[0], Y[0], r, 0, TAU); return; }   // dots
  const nx = new Float32Array(m), ny = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1); let tx = X[b] - X[a], ty = Y[b] - Y[a]; const tl = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / tl; ny[i] = tx / tl;
  }
  ctx.moveTo(X[0] + nx[0] * H[0], Y[0] + ny[0] * H[0]);
  for (let i = 1; i < m; i++) ctx.lineTo(X[i] + nx[i] * H[i], Y[i] + ny[i] * H[i]);
  const ae = Math.atan2(ny[m - 1], nx[m - 1]); ctx.arc(X[m - 1], Y[m - 1], H[m - 1], ae, ae - Math.PI, true);
  for (let i = m - 2; i >= 0; i--) ctx.lineTo(X[i] - nx[i] * H[i], Y[i] - ny[i] * H[i]);
  const as = Math.atan2(-ny[0], -nx[0]); ctx.arc(X[0], Y[0], H[0], as, as - Math.PI, true);
  ctx.closePath();
}

// ───────────────────────── shape builders (all return Stroke or Stroke[])
export const line = (x0, y0, x1, y1, o = {}) => {
  const bow = (o.bow ?? .012) * Math.hypot(x1 - x0, y1 - y0) * (hash(SEED * 1.7) - .5) * 2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const d = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / d, ny = (x1 - x0) / d;
  return new Stroke([x0, y0, mx + nx * bow, my + ny * bow, x1, y1], { smooth: 2, ...o });
};
export const poly = (pts, o = {}) => new Stroke(pts.flat ? pts.flat() : pts, o);
export const curve = (pts, o = {}) => new Stroke(pts.flat ? pts.flat() : pts, { smooth: 3, ...o });
export function arc(cx, cy, r, a0, a1, o = {}) {
  const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * r / 10)), p = [];
  const ry = o.ry ?? r;
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * ry); }
  return new Stroke(p, { wav: 300, ...o });
}
// a hand circle never closes exactly: it starts at a0 and overlaps by `lap`
export const circle = (cx, cy, r, o = {}) => { const a0 = o.a0 ?? -2.2; return arc(cx, cy, r, a0, a0 + (o.dir ?? 1) * (TAU + (o.lap ?? .22)), o); };
export function rect(x, y, w, h, o = {}) {        // four strokes, slight overshoot at corners
  const e = o.over ?? 6;
  return [line(x - e, y, x + w + e, y, o), line(x + w, y - e, x + w, y + h + e, o), line(x + w + e, y + h, x - e, y + h, o), line(x, y + h + e, x, y - e, o)];
}
export function roundRect(x, y, w, h, r, o = {}) {  // one continuous stroke
  const p = [], seg = (cx, cy, a0) => { for (let i = 0; i <= 8; i++) { const a = a0 + i / 8 * Math.PI / 2; p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } };
  seg(x + w - r, y + r, -Math.PI / 2); seg(x + w - r, y + h - r, 0); seg(x + r, y + h - r, Math.PI / 2); seg(x + r, y + r, Math.PI);
  p.push(p[0] + 14, p[1]);
  return new Stroke(p, { wav: 400, ...o });
}
export function arrow(x0, y0, x1, y1, o = {}) {
  const sh = o.curve ? curve([[x0, y0], o.curve, [x1, y1]], o) : line(x0, y0, x1, y1, o);
  const [ex, ey] = sh.end, [px, py] = sh.at(sh.len - 30), a = Math.atan2(ey - py, ex - px), hl = o.head ?? 34;
  const h1 = line(ex + Math.cos(a + 2.6) * hl, ey + Math.sin(a + 2.6) * hl, ex, ey, { ...o, bow: 0 });
  const h2 = line(ex, ey, ex + Math.cos(a - 2.6) * hl, ey + Math.sin(a - 2.6) * hl, { ...o, bow: 0 });
  return [sh, h1, h2];
}
export function dashed(pts, o = {}) {              // dashed polyline (one stroke per dash)
  const base = new Stroke(pts.flat ? pts.flat() : pts, { jitter: 0, smooth: o.smooth ?? 3, w: 1 });
  const dash = o.dash ?? 40, gap = o.gap ?? 26, out = [];
  for (let s = 0; s < base.len - 4; s += dash + gap) {
    const e = Math.min(base.len, s + dash), q = [];
    for (let u = s; u <= e; u += 6) q.push(...base.at(u)); q.push(...base.at(e));
    out.push(new Stroke(q, { jitter: .5, kind: 'dash', ...o }));
  }
  return out;
}
export function hatch(poly, o = {}) {             // zig-zag scribble fill inside a convex-ish polygon
  const ang = o.angle ?? -.8, sp = o.spacing ?? 26, ca = Math.cos(ang), sa = Math.sin(ang);
  const P = poly.map(([x, y]) => [x * ca + y * sa, -x * sa + y * ca]);
  const v0 = Math.min(...P.map(p => p[1])), v1 = Math.max(...P.map(p => p[1])), pts = [];
  let flip = 0;
  for (let v = v0 + sp * .5; v < v1; v += sp) {
    const xs = [];
    for (let i = 0; i < P.length; i++) {
      const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
      if ((ay - v) * (by - v) < 0) xs.push(ax + (v - ay) / (by - ay) * (bx - ax));
    }
    if (xs.length < 2) continue; xs.sort((a, b) => a - b);
    const a = xs[0] + sp * .2, b = xs[xs.length - 1] - sp * .2;
    const seg = flip ? [b, a] : [a, b]; flip ^= 1;
    for (const u of seg) pts.push([u * ca - v * sa, u * sa + v * ca]);
  }
  return new Stroke(pts.flat(), { w: o.w ?? 6, alpha: o.alpha ?? .55, jitter: .6, ...o, smooth: 0 });
}

// ───────────────────────── single-line handwriting (EMS/Hershey SVG fonts → JSON)
const FONTS = {};
const EXTRA = {                                     // glyphs the fonts lack, drawn in the same hand (font units, y up)
  'μ': { w: 520, s: [[100, -260, 108, 300], [106, 130, 140, 40, 220, 5, 300, 30, 370, 120, 380, 300], [380, 300, 386, 60, 420, 5, 470, 12]] },
  '≈': { w: 500, s: [[60, 310, 120, 350, 200, 330, 280, 290, 360, 310, 430, 350], [60, 170, 120, 210, 200, 190, 280, 150, 360, 170, 430, 210]] },
  '→': { w: 640, s: [[40, 250, 580, 250], [450, 380, 590, 250, 450, 120]] },
  '×': { w: 470, s: [[90, 100, 380, 420], [380, 100, 90, 420]] },
  '−': { w: 480, s: [[70, 260, 420, 260]] },
  '✓': { w: 520, s: [[40, 270, 170, 90, 470, 560]] },
  '²': { w: 260, s: [[40, 560, 90, 612, 160, 614, 196, 566, 176, 508, 44, 404, 210, 404]] },
  '↓': { w: 420, s: [[210, 640, 210, 40], [90, 170, 210, 30, 330, 170]] },
  '.': { w: 190, s: [[92, 14, 98, 16]] },
  '±': { w: 470, s: [[235, 520, 235, 170], [80, 345, 390, 345], [80, 60, 390, 60]] },
  '°': { w: 260, s: [[130, 660, 80, 630, 80, 570, 130, 540, 180, 570, 180, 630, 130, 660]] },
};
export async function loadFont(name, url) { FONTS[name] = (await (await fetch(url)).json()).glyphs; }
// returns Stroke[] (in writing order) + .width; opts: {h (cap height), font, align, color, w, spacing, slant, seed}
export function text(str, x, y, o = {}) {
  const G = FONTS[o.font || 'tech'], h = o.h ?? 60, k = h / 677, sp = o.spacing ?? 1, sl = o.slant ?? 0;
  const R = mulberry(o.seed ?? (SEED += 13));
  let adv = 0; const glyphs = [];
  for (const ch of str) {
    const g = EXTRA[ch] || G[ch] || G['?'];
    glyphs.push({ g, x: adv }); adv += g.w * k * sp;
  }
  const x0 = o.align === 'center' ? x - adv / 2 : o.align === 'right' ? x - adv : x;
  const out = [];
  for (const { g, x: gx } of glyphs) {
    const rot = (R() - .5) * .07, dy = (R() - .5) * h * .07, sc = 1 + (R() - .5) * .06, cx = x0 + gx + g.w * k / 2;
    for (const s of g.s) {
      const p = [];
      for (let i = 0; i < s.length; i += 2) {
        let px = (s[i] - g.w / 2) * k * sc, py = -s[i + 1] * k * sc;
        px += -py * sl;
        p.push(cx + px * Math.cos(rot) - py * Math.sin(rot), y + dy + px * Math.sin(rot) + py * Math.cos(rot));
      }
      if (p.length === 2) p.push(p[0] + 1, p[1] + 1);
      out.push(new Stroke(p, { w: o.w ?? Math.max(5, h * .13), color: o.color, jitter: o.jitter ?? .35, wav: 90, kind: 'text', smooth: 1, alpha: o.alpha }));
    }
  }
  out.width = adv; out.x0 = x0;
  return out;
}

// ───────────────────────── timeline: pens draw shapes in order
const flat = a => (Array.isArray(a) ? a.flatMap(flat) : [a]);
export class Pen {
  constructor(id, color, o = {}) { this.id = id; this.color = color; this.segs = []; this.park = o.park || [2250, 1300]; this.len = o.len ?? 430; this.label = o.label ?? color; }
}
export class Timeline {
  constructor() { this.strokes = []; this.erasers = []; this.ev = []; this.objs = []; }
  // draw shapes with pen starting at t; returns end time
  draw(pen, shapes, t, o = {}) {
    const list = flat(shapes), speed = o.speed ?? 1500, trav = o.travel ?? 2600, want = t;
    let prev = pen.segs.length ? pen.segs[pen.segs.length - 1] : null;
    if (prev && prev.t1 > t - .02) t = Math.max(t, prev.t1 + .05);
    if (t > want + .25) console.warn(`pen ${pen.id} late by ${(t - want).toFixed(2)}s at ${want.toFixed(2)} (${o.tag || list[0].kind})`);
    // pen-up hops between consecutive strokes of this call
    const gap = list.map((s, i) => i ? clamp(Math.hypot(s.start[0] - list[i - 1].end[0], s.start[1] - list[i - 1].end[1]) / trav, o.minGap ?? .035, o.maxGap ?? .3) : 0);
    let durs;
    if (o.by) {                                     // fit mode: finish exactly at o.by; hops get at most 35% of the window
      const win = o.by - t, len = list.reduce((a, s) => a + s.len, 0), G = gap.reduce((a, b) => a + b, 0);
      if (win < .08 * list.length ** .5) console.warn(`pen ${pen.id}: window ${win.toFixed(2)}s tight at ${t.toFixed(2)} (${o.tag || list[0].kind})`);
      const gs = G > win * .35 ? win * .35 / G : 1; for (let i = 0; i < gap.length; i++) gap[i] *= gs;
      const avail = win - G * gs; durs = list.map(s => s.len / len * avail);
    } else durs = list.map(s => Math.max(s.kind === 'dash' ? .02 : s.len < 14 ? .05 : .09, s.len / (s.speed || (s.kind === 'text' ? (o.textSpeed ?? speed * .8) : speed))) * (o.slow ?? 1));
    list.forEach((s, i) => {
      if (!s.color || o.color) s.color = o.color || pen.color;
      t += gap[i]; s.t0 = t; s.t1 = t + durs[i];
      s.pen = pen; s.epoch = this.erasers.length;
      this.strokes.push(s); const seg = { s, t0: s.t0, t1: s.t1 }; pen.segs.push(seg); prev = seg;
      this.ev.push({ t: +s.t0.toFixed(3), type: s.len < 16 ? 'tap' : (s.kind === 'text' ? 'write' : s.kind === 'dash' ? 'dash' : 'stroke'), dur: +(s.t1 - s.t0).toFixed(3), len: Math.round(s.len), pen: pen.id, x: Math.round(s.start[0]), y: Math.round(s.start[1]) });
      t = s.t1;
    });
    return t;
  }
  // eraser sweeping a zig-zag over the box [x,y,w,h] (or custom path) from t to t+dur
  erase(path, t, dur, o = {}) {
    const E = { path: new Stroke(path.flat ? path.flat() : path, { jitter: 0, w: 1, smooth: 2 }), t0: t, t1: t + dur, width: o.width ?? 150, strength: o.strength ?? .9, id: this.erasers.length };
    this.erasers.push(E); this.ev.push({ t: +t.toFixed(3), type: 'erase', dur: +dur.toFixed(3), len: Math.round(E.path.len) });
    return t + dur;
  }
  cue(t, type, extra = {}) { this.ev.push({ t: +t.toFixed(3), type, ...extra }); }
  end() { this.strokes.sort((a, b) => a.t0 - b.t0); for (const p of new Set(this.strokes.map(s => s.pen))) p.segs.sort((a, b) => a.t0 - b.t0); this.ev.sort((a, b) => a.t - b.t); }
}
export function zigzag(x, y, w, h, n = 5, dir = 1) { // eraser path covering a box
  const p = []; for (let i = 0; i <= n; i++) { const yy = y + h * i / n; p.push(dir > 0 ? (i % 2 ? [x + w, yy] : [x, yy]) : (i % 2 ? [x, yy] : [x + w, yy])); }
  return p;
}

// pen pose at t: {x,y,lift(0..1),on(bool),vis}
export function penPose(pen, t, cam) {
  const S = pen.segs, parkAt = tt => cam.toWorld(pen.park[0], pen.park[1], tt);
  if (!S.length) return null;
  let i = S.findIndex(s => s.t1 >= t);
  if (i >= 0 && t >= S[i].t0) { const s = S[i].s, p = s.at(s.prog(t) * s.len); return { x: p[0], y: p[1], lift: 0, on: true }; }
  const a = i < 0 ? S[S.length - 1] : (i > 0 ? S[i - 1] : null), b = i < 0 ? null : S[i];
  const IN = .42, OUT = .38;
  const gap = a && b ? b.t0 - a.t1 : 1e9;
  if (a && b && gap < .75) {                        // hop between strokes
    const u = clamp((t - a.t1) / gap), e = u * u * (3 - 2 * u), [ax, ay] = a.s.end, [bx, by] = b.s.start;
    const hop = Math.min(1, Math.hypot(bx - ax, by - ay) / 220 + .25);
    return { x: lerp(ax, bx, e), y: lerp(ay, by, e), lift: Math.sin(Math.PI * u) * hop, on: false };
  }
  if (a && t - a.t1 < OUT) {                        // leave toward park
    const u = (t - a.t1) / OUT, e = u * u, [ax, ay] = a.s.end, [px, py] = parkAt(t);
    return { x: lerp(ax, px, e), y: lerp(ay, py, e), lift: Math.min(1, u * 3), on: false };
  }
  if (b && b.t0 - t < IN) {                         // come in from park
    const u = 1 - (b.t0 - t) / IN, e = 1 - (1 - u) * (1 - u) * (1 - u), [bx, by] = b.s.start, [px, py] = parkAt(t);
    return { x: lerp(px, bx, e), y: lerp(py, by, e), lift: Math.min(1, (1 - u) * 2.2), on: false };
  }
  return null;                                      // parked off-frame
}

// ───────────────────────── camera
export class Camera {
  // keys: [t, x, y, zoom, rot?, ease?]  ease: 'io' | 'i' | 'o' | 'l' | 'h' (hold then cut)
  constructor(keys) { this.k = keys.map(k => ({ t: k[0], x: k[1], y: k[2], z: k[3], r: k[4] || 0, e: k[5] || 'io' })); }
  at(t) {
    const K = this.k; if (t <= K[0].t) return K[0]; if (t >= K[K.length - 1].t) return K[K.length - 1];
    let i = 0; while (t > K[i + 1].t) i++;
    const a = K[i], b = K[i + 1], u = (t - a.t) / (b.t - a.t);
    const E = { io: u => u * u * u * (u * (u * 6 - 15) + 10), i: u => u * u * u, o: u => 1 - (1 - u) ** 3, l: u => u, s: u => u * u * (3 - 2 * u), h: () => 0 }[b.e] || (u => u);
    const e = E(u), lz = lerp(Math.log(a.z), Math.log(b.z), e);
    // keep the midpoint of a zoom move stable in screen space: interpolate position weighted by zoom
    const za = a.z, zb = b.z, z = Math.exp(lz), wgt = Math.abs(zb - za) > 1e-4 ? (1 / za - 1 / z) / (1 / za - 1 / zb) : e;
    return { x: lerp(a.x, b.x, wgt), y: lerp(a.y, b.y, wgt), z, r: lerp(a.r, b.r, e) };
  }
  toWorld(sx, sy, t) { const c = this.at(t), dx = (sx - 960) / c.z, dy = (sy - 540) / c.z, cs = Math.cos(-c.r), sn = Math.sin(-c.r); return [c.x + dx * cs - dy * sn, c.y + dx * sn + dy * cs]; }
}
export function applyCam(ctx, c) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(960, 540); ctx.rotate(c.r); ctx.scale(c.z, c.z); ctx.translate(-c.x, -c.y); }
export function toScreen(c, x, y) { const dx = (x - c.x) * c.z, dy = (y - c.y) * c.z, cs = Math.cos(c.r), sn = Math.sin(c.r); return [960 + dx * cs - dy * sn, 540 + dx * sn + dy * cs]; }

// ───────────────────────── textures
function noiseTile(seed) {                          // dry-marker speckle & streaks (used with destination-out)
  const c = new OffscreenCanvas(512, 512), g = c.getContext('2d'), R = mulberry(seed);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${R() * .35})`; const r = R() * 1.6 + .3; g.beginPath(); g.arc(R() * 512, R() * 512, r, 0, TAU); g.fill(); }
  g.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(0,0,0,${R() * .22})`; g.lineWidth = R() * 1.4 + .4;
    const x = R() * 512, y = R() * 512, a = (R() - .5) * .5, l = 20 + R() * 70;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return c;
}
function boardTile(seed) {                          // faint scuffs / micro scratches on the board surface
  const c = new OffscreenCanvas(1024, 1024), g = c.getContext('2d'), R = mulberry(seed);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,95,105,${R() * .03})`; g.beginPath(); g.arc(R() * 1024, R() * 1024, R() * 2.5 + .5, 0, TAU); g.fill(); }
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {                   // wrapped so the tile has no seams
    const al = R() * .028, lw = R() * 12 + 4, x = R() * 1024, y = R() * 1024, a = (R() - .5) * .4, l = 40 + R() * 260;
    g.strokeStyle = `rgba(80,86,96,${al})`; g.lineWidth = lw;
    for (const ox of [-1024, 0, 1024]) for (const oy of [-1024, 0, 1024]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke(); }
  }
  return c;
}

// ───────────────────────── board renderer
export class Board {
  // o: {W,H, frame, tray, ghosts:Stroke[], wall}
  constructor(tl, o = {}) {
    this.tl = tl; this.W = o.W ?? 8000; this.H = o.H ?? 4500; this.ghosts = o.ghosts || [];
    this.ink = new OffscreenCanvas(1920, 1080); this.ig = this.ink.getContext('2d');
    this.nt = noiseTile(7); this.bt = boardTile(11);
    this.objs = [];                                 // {draw(ctx, t, cam)} in world, drawn after ink
    this.overlays = [];                             // {draw(ctx, t, cam)} in screen space
  }
  render(ctx, t, cam) {
    const c = cam.at(t), W = this.W, H = this.H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // wall (only visible on wide shots)
    ctx.fillStyle = '#d8d3ca'; ctx.fillRect(0, 0, 1920, 1080);
    applyCam(ctx, c);
    if (c.z < .5) this.frame(ctx, c);
    // board surface
    const g = ctx.createLinearGradient(0, 0, W * .3, H);
    g.addColorStop(0, '#fbfbf9'); g.addColorStop(1, '#eeede9');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const pat = ctx.createPattern(this.bt, 'repeat'); pat.setTransform(new DOMMatrix().scale(1.6)); ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
    // ghosts of old lessons
    ctx.save(); ctx.globalAlpha = 1;
    for (const s of this.ghosts) { ctx.fillStyle = s.color || '#9aa0a8'; ctx.globalAlpha = s.alpha; ctx.beginPath(); ribbon(ctx, s, s.len, 1.5); ctx.fill(); }
    ctx.restore();
    // ink layer
    const ig = this.ig; ig.setTransform(1, 0, 0, 1, 0, 0); ig.clearRect(0, 0, 1920, 1080); applyCam(ig, c);
    const vw = 1400 / c.z, vx0 = c.x - vw, vx1 = c.x + vw, vy0 = c.y - vw, vy1 = c.y + vw;
    const E = this.tl.erasers; let ep = 0;
    const flushErasers = upto => {
      while (ep < upto) {
        const e = E[ep++]; if (t <= e.t0) continue;
        const L = e.path.len * clamp((t - e.t0) / (e.t1 - e.t0));
        ig.save(); ig.globalCompositeOperation = 'destination-out'; ig.globalAlpha = e.strength; ig.lineCap = 'round'; ig.lineJoin = 'round';
        ig.lineWidth = e.width; ig.beginPath(); const p = e.path.pts; ig.moveTo(p[0], p[1]);
        for (let i = 1; i < e.path.cum.length && e.path.cum[i] <= L; i++) ig.lineTo(p[2 * i], p[2 * i + 1]);
        const q = e.path.at(L); ig.lineTo(q[0], q[1]); ig.stroke(); ig.restore();
      }
    };
    for (const s of this.tl.strokes) {
      if (s.t0 >= t) continue;
      if (s.epoch > ep) flushErasers(s.epoch);
      const b = s.box; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      if (s.hide && s.hide(t)) continue;
      const L = s.prog(t) * s.len;
      if (s.clip) { ig.save(); ig.beginPath(); ig.roundRect(...s.clip); ig.clip(); }
      ig.globalAlpha = s.alpha; ig.fillStyle = s.color || INK.black; ig.beginPath(); ribbon(ig, s, L, 1); ig.fill();
      if (s.len > 30) { ig.globalAlpha = .3; ig.beginPath(); const [x, y] = s.at(s.w * .5); ig.arc(x, y, s.w * .33, 0, TAU); ig.fill(); }   // pooled ink where the nib landed
      if (s.clip) ig.restore();
    }
    flushErasers(E.length);
    ig.globalAlpha = 1;
    if (c.z > .3) {                                 // dry-marker texture, locked to the board
      ig.save(); ig.globalCompositeOperation = 'destination-out'; const np = ig.createPattern(this.nt, 'repeat');
      np.setTransform(new DOMMatrix().scale(.9)); ig.fillStyle = np; ig.globalAlpha = clamp((c.z - .3) * 2) * .9;
      ig.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); ig.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(this.ink, 0, 0); ctx.restore();
    // specular sheen: a soft window reflection that drifts slower than the board (sells the gloss)
    ctx.save(); applyCam(ctx, c); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sx = -c.x * c.z * .35 + 900, sh = ctx.createLinearGradient(sx - 700, 0, sx + 700, 1080);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.45, 'rgba(255,255,255,.10)'); sh.addColorStop(.5, 'rgba(255,255,255,.16)');
    sh.addColorStop(.55, 'rgba(255,255,255,.10)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
    // world objects (magnets, pens, eraser)
    for (const o of this.objs) { ctx.save(); o.draw(ctx, t, c, cam); ctx.restore(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const o of this.overlays) { ctx.save(); o.draw(ctx, t, c, cam); ctx.restore(); }
  }
  frame(ctx, c) {                                   // aluminium frame + tray + wall shadow (wide shots)
    const W = this.W, H = this.H, f = 70;
    ctx.save();
    ctx.fillStyle = 'rgba(60,50,40,.18)'; ctx.filter = `blur(${Math.max(2, 60 * c.z)}px)`; ctx.fillRect(40, 90, W + 60, H + 140); ctx.filter = 'none';
    const g = ctx.createLinearGradient(0, -f, 0, H + f); g.addColorStop(0, '#e9ebee'); g.addColorStop(.5, '#b9bec6'); g.addColorStop(1, '#8f949c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-f, -f, W + 2 * f, H + 2 * f, 30); ctx.fill();
    ctx.fillStyle = '#7d828a'; ctx.fillRect(-4, -4, W + 8, H + 8);
    // tray
    const tg = ctx.createLinearGradient(0, H + f - 10, 0, H + f + 110); tg.addColorStop(0, '#d7dadf'); tg.addColorStop(1, '#8e939b');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.roundRect(W * .08, H + f - 20, W * .84, 130, 18); ctx.fill();
    ctx.restore();
  }
}

// ───────────────────────── physical objects
// dry-erase marker, drawn at its world tip. No hand: it floats, lifts, and parks off-frame.
export function drawMarker(ctx, pen, pose, c, t) {
  if (!pose) return;
  const [sx, sy] = toScreen(c, pose.x, pose.y), z = Math.min(c.z, 1.25), L = pen.len * z;
  const lift = pose.lift, wob = Math.sin(t * 5.3 + pen.id.length) * .02;
  const ang = pose.ang ?? (-0.95 + wob - lift * .06);              // body points up-right from the tip
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const up = lift * 26 * z;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // shadow: projected body (height grows along the axis), shifted down-right when lifted
  ctx.save(); ctx.filter = `blur(${(6 + lift * 10) * z}px)`; ctx.fillStyle = `rgba(40,40,50,${.26 - lift * .08})`;
  ctx.translate(sx + up * .9 + 6 * z, sy + up * 1.2 + 8 * z); ctx.transform(ca * 1.06, sa * .85 + .22, -sa, ca, 0, 0);
  ctx.beginPath(); ctx.roundRect(4 * z, -L * .06, L, L * .12, L * .05); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(sx - up * .15, sy - up); ctx.rotate(ang); const s = L / 430; ctx.scale(s, s);
  // nib (felt bullet), collar, barrel, band, end cap
  ctx.fillStyle = pen.color; ctx.beginPath(); ctx.moveTo(-2, -5); ctx.quadraticCurveTo(-8, 0, -2, 5); ctx.lineTo(20, 9); ctx.lineTo(20, -9); ctx.closePath(); ctx.fill();
  const col = ctx.createLinearGradient(0, -22, 0, 22); col.addColorStop(0, '#dfe2e6'); col.addColorStop(.35, '#ffffff'); col.addColorStop(1, '#8b9099');
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(20, -10); ctx.lineTo(50, -24); ctx.lineTo(50, 24); ctx.lineTo(20, 10); ctx.closePath(); ctx.fill();
  const bar = ctx.createLinearGradient(0, -26, 0, 26); bar.addColorStop(0, '#e6e8eb'); bar.addColorStop(.3, '#ffffff'); bar.addColorStop(.62, '#e9ebee'); bar.addColorStop(1, '#9ea3ab');
  ctx.fillStyle = bar; ctx.beginPath(); ctx.roundRect(48, -26, 300, 52, 6); ctx.fill();
  const [r, g, b] = RGB(pen.color);
  const band = ctx.createLinearGradient(0, -26, 0, 26); band.addColorStop(0, `rgb(${r * .8 | 0},${g * .8 | 0},${b * .8 | 0})`); band.addColorStop(.3, `rgb(${Math.min(255, r * 1.25) | 0},${Math.min(255, g * 1.25) | 0},${Math.min(255, b * 1.25) | 0})`); band.addColorStop(1, `rgb(${r * .55 | 0},${g * .55 | 0},${b * .55 | 0})`);
  ctx.fillStyle = band; ctx.fillRect(150, -26, 110, 52);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(166, -6, 78, 5); ctx.fillRect(166, 4, 50, 3);
  ctx.fillStyle = band; ctx.beginPath(); ctx.roundRect(338, -29, 92, 58, 12); ctx.fill();
  ctx.fillStyle = `rgba(0,0,0,.18)`; ctx.fillRect(338, -29, 6, 58);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(350, -22, 70, 6);
  ctx.restore();
}
// felt eraser following an erase path
export function drawEraser(ctx, e, t, c) {
  if (t < e.t0 - .45 || t > e.t1 + .45) return;
  let x, y, lift = 0;
  const P0 = e.path.start, P1 = e.path.end;
  if (t < e.t0) { const u = (t - e.t0 + .45) / .45; [x, y] = [P0[0] + 500 * (1 - u), P0[1] + 700 * (1 - u) ** 2]; lift = 1 - u; }
  else if (t > e.t1) { const u = (t - e.t1) / .45; [x, y] = [P1[0] + 500 * u, P1[1] + 700 * u * u]; lift = u; }
  else[x, y] = e.path.at(e.path.len * (t - e.t0) / (e.t1 - e.t0));
  const [sx, sy] = toScreen(c, x, y), z = c.z, w = e.width * 1.9 * z, h = e.width * 1.0 * z, up = lift * 30 * z;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save(); ctx.filter = `blur(${(8 + lift * 12) * z}px)`; ctx.fillStyle = `rgba(40,40,50,${.3 - lift * .1})`;
  ctx.beginPath(); ctx.roundRect(sx - w / 2 + 10 * z + up, sy - h / 2 + 16 * z + up, w, h, 14 * z); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(sx, sy - up); ctx.rotate(-.08 + Math.sin(t * 17) * .02);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#4a4f58'); g.addColorStop(.5, '#2e3239'); g.addColorStop(1, '#1d2025');
  ctx.fillStyle = '#c9c4ba'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + h * .72, w, h * .3, 8 * z); ctx.fill();   // felt
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h * .78, 14 * z); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 12 * z, -h / 2 + 8 * z, w - 24 * z, h * .16, 8 * z); ctx.fill();
  ctx.fillStyle = INK.orange; ctx.globalAlpha = .9; ctx.fillRect(-w * .18, -h * .12, w * .36, h * .2);
  ctx.restore();
}
// flat map-pin magnet (the only glossy, physical object on the board)
export function drawPinMagnet(ctx, x, y, c, o = {}) {
  const [sx, sy] = toScreen(c, x, y), s = (o.size ?? 150) * c.z / 150, lift = o.lift ?? 0, up = lift * 40 * s;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const shape = (g) => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-18, -40, -58, -70, -58, -112); g.arc(0, -112, 58, Math.PI, 0); g.bezierCurveTo(58, -70, 18, -40, 0, 0); g.closePath(); };
  ctx.save(); ctx.translate(sx + (8 + up * .8) * s, sy + (12 + up) * s); ctx.scale(s, s); ctx.filter = `blur(${(7 + lift * 14) * s}px)`;
  ctx.fillStyle = `rgba(60,30,20,${.36 - lift * .15})`; shape(ctx); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(sx, sy - up * s); ctx.scale(s * (1 + lift * .08), s * (1 + lift * .08)); ctx.rotate(o.rot ?? 0);
  const g = ctx.createRadialGradient(-22, -132, 8, 0, -100, 110); g.addColorStop(0, '#f6a98c'); g.addColorStop(.45, o.color || INK.orange); g.addColorStop(1, '#a4492f');
  ctx.fillStyle = g; shape(ctx); ctx.fill();
  ctx.fillStyle = '#fff8f2'; ctx.beginPath(); ctx.arc(0, -112, 22, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-24, -140, 16, 8, -.6, 0, TAU); ctx.fill();
  ctx.restore();
}
export { ribbon, resample, chaikin };
