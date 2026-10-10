// Woodcut engine · knife strokes
// A stroke is one cut of a carving tool: a centreline, a width per point, a tool profile, and (optionally)
// a reveal time so it can be carved "live" (the knife travels from the first point to the last).
//
//   stroke = { p: Float32Array [x0,y0,x1,y1,...], w: Float32Array [w0,w1,...] | number,
//              kind: 'v' | 'u' | 'k' | 'stab',   seed, t0, dur }
//
// Everything here draws onto a *mask* canvas: white = wood carved away (paper stays white in the print),
// black = wood left standing (takes ink). Use colour '#000' to "leave" wood (re-ink) on top of a cut area.
import { clamp, hash } from '/core/lib.js';

// cheap 1-D value noise with seed
const vn = (x, s) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); const a = hash(i * 1.37 + s * 17.1), b = hash((i + 1) * 1.37 + s * 17.1); return a + (b - a) * u; };

export function mkStroke(pts, w, o = {}) {
  // pts: [[x,y],...] or flat array
  const p = pts.length && Array.isArray(pts[0]) ? Float32Array.from(pts.flat()) : Float32Array.from(pts);
  const n = p.length / 2;
  const ws = typeof w === 'number' ? new Float32Array(n).fill(w) : Float32Array.from(w);
  return { p, w: ws, kind: o.kind || 'v', seed: o.seed ?? Math.random() * 1000, t0: o.t0 ?? -1e9, dur: o.dur ?? .2, chip: o.chip ?? .16 };
}

// resample a polyline [[x,y]...] so no segment is longer than `step`
export function resample(pts, step = 3) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], d = Math.hypot(bx - ax, by - ay), k = Math.max(1, Math.ceil(d / step));
    for (let j = 1; j <= k; j++) out.push([ax + (bx - ax) * j / k, ay + (by - ay) * j / k]);
  }
  return out;
}
// Catmull-Rom through control points → dense polyline
export function spline(cp, step = 3, closed = false) {
  const P = closed ? [cp[cp.length - 1], ...cp, cp[0], cp[1]] : [cp[0], ...cp, cp[cp.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), k = Math.max(2, Math.ceil(d / step));
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      out.push([.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(closed ? P[P.length - 2] : cp[cp.length - 1]);
  return out;
}

// width multiplier of the tool along the cut. s = distance from start, L = total length, w = local width
function prof(kind, s, L, w) {
  if (kind === 'u') {
    const a = clamp(s / (.55 * w + .5)), b = clamp((L - s) / (.7 * w + .5));
    return Math.sqrt(1 - (1 - a) * (1 - a)) * Math.sqrt(1 - (1 - b) * (1 - b));
  }
  if (kind === 'k') return clamp(s / (1.5 * w + 1)) ** .5 * clamp((L - s) / (3 * w + 2)) ** .6;
  if (kind === 'stab') { const u = clamp(s / Math.max(L, .01)); return Math.sin(Math.PI * Math.min(1, u * 1.35)) ** .6 * (1 - .35 * u); }
  // 'v' gouge: fairly blunt entry, long pointed exit
  const a = clamp(s / (.9 * w + 1)), b = clamp((L - s) / (2.6 * w + 2));
  return (.35 + .65 * a * (2 - a)) * Math.pow(b, .75);
}

const _L = [], _R = [];
// append the outline of stroke `s` carved up to progress `pr` (0..1) to the current path of g
export function strokePath(g, s, pr = 1) {
  const p = s.p, n = p.length / 2; if (n < 2 || pr <= 0) return 0;
  // cumulative length
  let L = 0; const cum = strokePath._c || (strokePath._c = new Float32Array(4096));
  const C = cum.length < n ? (strokePath._c = new Float32Array(n * 2)) : cum;
  C[0] = 0; for (let i = 1; i < n; i++) { L += Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]); C[i] = L; }
  if (L < .5) return 0;
  const Lv = L * clamp(pr), live = pr < 1, tipL = 6;
  _L.length = 0; _R.length = 0;
  const ch = s.chip, sd = s.seed;
  for (let i = 0; i < n; i++) {
    let si = C[i], x = p[2 * i], y = p[2 * i + 1];
    if (si > Lv) {  // interpolate the live tip
      const f = (Lv - C[i - 1]) / Math.max(1e-6, si - C[i - 1]);
      x = p[2 * i - 2] + (x - p[2 * i - 2]) * f; y = p[2 * i - 1] + (y - p[2 * i - 1]) * f; si = Lv;
    }
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    let tx = p[2 * i1] - p[2 * i0], ty = p[2 * i1 + 1] - p[2 * i0 + 1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const wi = s.w[i] ?? s.w[0];
    let hw = .5 * wi * prof(s.kind, si, live ? Math.max(Lv, Math.min(L, Lv + tipL)) : L, wi);
    if (live) hw *= Math.pow(clamp((Lv - si) / tipL + .15), .5);
    const el = 1 + ch * (vn(si * .21, sd) - .5) * 2 + ch * .8 * (vn(si * .9, sd + 3) - .5);
    const er = 1 + ch * (vn(si * .21, sd + 7) - .5) * 2 + ch * .8 * (vn(si * .9, sd + 11) - .5);
    _L.push(x - ty * hw * el, y + tx * hw * el); _R.push(x + ty * hw * er, y - tx * hw * er);
    if (si >= Lv) break;
  }
  const m = _L.length / 2; if (m < 2) return 0;
  g.moveTo(_L[0], _L[1]);
  for (let i = 1; i < m; i++) g.lineTo(_L[2 * i], _L[2 * i + 1]);
  for (let i = m - 1; i >= 0; i--) g.lineTo(_R[2 * i], _R[2 * i + 1]);
  g.closePath();
  return Lv;
}

// progress of a stroke at time t (knife moves with a slight ease-in)
export const progOf = (s, t) => { const u = clamp((t - s.t0) / s.dur); return u < 1 ? u * (0.55 + 0.45 * u) : 1; };

// draw many strokes at time t in one fill. Returns list of live tips [{x,y,a,w}] (for chips / sound hooks)
export function drawStrokes(g, list, { t = 1e9, color = '#fff', tips = null } = {}) {
  g.fillStyle = color; g.beginPath();
  for (const s of list) {
    const pr = progOf(s, t); if (pr <= 0) continue;
    const Lv = strokePath(g, s, pr);
    if (tips && pr < 1 && Lv > 0) tips.push(tipOf(s, Lv));
  }
  g.fill('nonzero');
}
function tipOf(s, Lv) {
  const p = s.p, n = p.length / 2; let L = 0;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
    if (L + d >= Lv) { const f = (Lv - L) / (d || 1); return { x: p[2 * i - 2] + (p[2 * i] - p[2 * i - 2]) * f, y: p[2 * i - 1] + (p[2 * i + 1] - p[2 * i - 1]) * f, a: Math.atan2(p[2 * i + 1] - p[2 * i - 1], p[2 * i] - p[2 * i - 2]), w: s.w[i] ?? s.w[0], kind: s.kind }; }
    L += d;
  }
  return { x: p[2 * n - 2], y: p[2 * n - 1], a: 0, w: s.w[0], kind: s.kind };
}

// a curl of wood chip lifting at the knife tip (block world only)
export function chip(g, tip, k = 1, col = '#fff') {
  const { x, y, a, w } = tip, r = Math.max(2.5, w * .9) * k;
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = col; g.beginPath();
  g.moveTo(0, -r * .5); g.bezierCurveTo(r * 1.6, -r * 1.2, r * 2.2, r * .2, r * 1.2, r * .9);
  g.bezierCurveTo(r * 1.5, r * .1, r * 1.1, -r * .5, 0, r * .3); g.closePath(); g.fill();
  g.restore();
}

// bounding-box helpers
export function strokeBounds(s) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < s.p.length; i += 2) { x0 = Math.min(x0, s.p[i]); x1 = Math.max(x1, s.p[i]); y0 = Math.min(y0, s.p[i + 1]); y1 = Math.max(y1, s.p[i + 1]); } return [x0, y0, x1, y1]; }
// transform a stroke list by a 2-D affine [a,b,c,d,e,f] (returns new strokes, widths scaled by sqrt|det|)
export function xform(list, m) {
  const k = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  return list.map(s => { const p = new Float32Array(s.p.length); for (let i = 0; i < p.length; i += 2) { const x = s.p[i], y = s.p[i + 1]; p[i] = m[0] * x + m[2] * y + m[4]; p[i + 1] = m[1] * x + m[3] * y + m[5]; } return { ...s, p, w: s.w.map(v => v * k) }; });
}
