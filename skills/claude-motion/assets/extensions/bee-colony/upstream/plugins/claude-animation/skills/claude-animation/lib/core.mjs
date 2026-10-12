// core.mjs — maths, easing, noise, path helpers and the two textures everything uses (grain, hatch).
// Pure functions of their inputs: no Math.random, no Date. Same frame in, same pixels out.
import { createCanvas, Path2D } from "@napi-rs/canvas";
export { createCanvas, Path2D };

// ------------------------------------------------------------------ numbers
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const rad = (d) => d * Math.PI / 180;
export const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };   // smoothstep window
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const rng = (seed) => { let s = Math.max(1, Math.floor(seed)) % 2147483647; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
export const noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1; };

// ------------------------------------------------------------------ easing (k in 0..1)
export const eOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
export const eIn = (k) => Math.pow(clamp(k), 3);
export const eIO = (k) => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const eExpo = (k) => (k = clamp(k), k === 1 ? 1 : 1 - Math.pow(2, -10 * k));
export const eBack = (k, s = 1.8) => { k = clamp(k) - 1; return 1 + (s + 1) * k * k * k + s * k * k; };      // overshoot, settles at 1
export const eElastic = (k) => { k = clamp(k); return k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - .75) * (2 * Math.PI / 3)) + 1; };
export const eBounce = (k) => { k = clamp(k); const n = 7.5625, d = 2.75;
  if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + .75;
  if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + .9375; return n * (k -= 2.625 / d) * k + .984375; };
// a pop-in scale that overshoots: 0 before t0, ~1.1 at the peak, 1 after `d` seconds
export const popS = (t, t0, d = .38, s = 2.2) => t < t0 ? 0 : eBack((t - t0) / d, s);

// ------------------------------------------------------------------ geometry
export const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const centroid = (P) => [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
export const ellPts = (cx, cy, rx, ry, n = 24, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
export const rrect = (x, y, w, h, r) => { const p = [], k = [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]];
  for (const [cx, cy, a0] of k) for (let i = 0; i <= 4; i++) { const a = rad(a0 + i * 22.5); p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
export function catmull(P, closed = false, step = 7) {           // dense points through control points
  const out = [], n = P.length, g = (i) => closed ? P[(i + n) % n] : P[clamp(i, 0, n - 1)];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2), m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let s = 0; s < m; s++) { const t = s / m, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); }
  }
  out.push(closed ? [...P[0]] : [...P[n - 1]]); return out;
}
export function densify(P, step = 7) { const out = [];
  for (let i = 0; i < P.length - 1; i++) { const [x0, y0] = P[i], [x1, y1] = P[i + 1], m = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step)); for (let s = 0; s < m; s++) out.push([lerp(x0, x1, s / m), lerp(y0, y1, s / m)]); }
  out.push([...P[P.length - 1]]); return out; }
// arc-length sampler: path(pts).at(u) -> [x, y, angle], .slice(u) -> points up to u
export function pathOf(pts) {
  const D = catmull(pts, false, 5), L = [0]; for (let i = 1; i < D.length; i++) L.push(L[i - 1] + Math.hypot(D[i][0] - D[i - 1][0], D[i][1] - D[i - 1][1]));
  const T = L[L.length - 1];
  const idx = (u) => { const lim = clamp(u) * T; let i = 1; while (i < D.length - 1 && L[i] < lim) i++; return [i, (lim - L[i - 1]) / ((L[i] - L[i - 1]) || 1)]; };
  return { length: T, points: D,
    at(u) { const [i, k] = idx(u), a = D[i - 1], b = D[i]; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), Math.atan2(b[1] - a[1], b[0] - a[0])]; },
    slice(u) { const [i, k] = idx(u), out = D.slice(0, i); const a = D[i - 1], b = D[i]; out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)]); return out; } };
}
// 2-bone IK: joint position for a limb from `a` to `c` with segment lengths l1, l2; bendUp picks the side
// pref: which way the joint should point — true = up, or a direction vector [dx, dy] (e.g. [-.6, -.8] = back and up)
export function ik(a, c, l1, l2, pref = true) {
  const dx = c[0] - a[0], dy = c[1] - a[1], d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + .01, l1 + l2 - .01);
  const base = Math.atan2(dy, dx), off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const cand = [base + off, base - off].map((ang) => [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1]);
  const v = pref === true ? [0, -1] : pref === false ? [0, 1] : pref, score = (p) => (p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1];
  return score(cand[0]) >= score(cand[1]) ? cand[0] : cand[1];
}

// ------------------------------------------------------------------ canvas helpers
export const INK = "#1E1612";
export function poly(ctx, pts, close = true) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (close) ctx.closePath(); }
export function smooth(ctx, pts, close = true) {                  // quadratic through midpoints: soft organic outlines
  const n = pts.length, g = (i) => close ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  ctx.beginPath(); ctx.moveTo(...(close ? mid(g(-1), g(0)) : g(0)));
  for (let i = 0; i < (close ? n : n - 1); i++) { const a = g(i), b = g(i + 1), m = mid(a, b); ctx.quadraticCurveTo(a[0], a[1], m[0], m[1]); }
  if (!close) ctx.lineTo(...g(n - 1)); else ctx.closePath();
}
export function ellipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, Math.PI * 2); }
export function stroke(ctx, w = 3, c = INK) { ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); }
export function fill(ctx, c) { ctx.fillStyle = c; ctx.fill(); }
export function line(ctx, pts, w = 2, c = INK, dash = null) { ctx.save(); if (dash) ctx.setLineDash(dash); poly(ctx, pts, false); stroke(ctx, w, c); ctx.restore(); }
export function at(ctx, x, y, s, r, fn) { ctx.save(); ctx.translate(x, y); if (r) ctx.rotate(r); if (s !== 1) ctx.scale(s, s); fn(); ctx.restore(); }
// tapered stroke (thick in the middle, thin at the ends) — for limbs, stems, antennae
export function taper(ctx, pts, w0, w1, c = INK) { for (let i = 0; i < pts.length - 1; i++) line(ctx, [pts[i], pts[i + 1]], lerp(w0, w1, i / Math.max(1, pts.length - 2)), c); }

// ------------------------------------------------------------------ texture
export function grainCanvas(sz = 256, amt = 60, seed = 3) {
  const c = createCanvas(sz, sz), x = c.getContext("2d"), d = x.createImageData(sz, sz), r = rng(seed);
  for (let i = 0; i < sz * sz; i++) { const v = 255 - Math.floor(Math.pow(r(), 2.2) * amt); d.data[i * 4] = v; d.data[i * 4 + 1] = v; d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
}
const _grain = {};
// multiply printed-paper grain over whatever `clipFn` outlines
export function grainOver(ctx, clipFn, a = .5, amt = 60) {
  const key = amt; _grain[key] ??= ctx.createPattern(grainCanvas(256, amt, 3 + amt), "repeat");
  ctx.save(); clipFn(); ctx.clip(); ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = a; ctx.fillStyle = _grain[key]; ctx.fillRect(-4000, -4000, 8000, 8000); ctx.restore();
}
// parallel hatch lines inside `clipFn`, at angle `ang`, every `gap` px, inside bounding box `box`
export function hatch(ctx, clipFn, ang, gap, c, w = 1, a = .35, box = [-600, -600, 2600, 2600]) {
  ctx.save(); clipFn(); ctx.clip(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.globalAlpha *= a;
  const [x0, y0, x1, y1] = box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0);
  ctx.translate(cx, cy); ctx.rotate(ang); ctx.beginPath(); for (let d = -R; d < R; d += gap) { ctx.moveTo(-R, d); ctx.lineTo(R, d); } ctx.stroke(); ctx.restore();
}
// short random strokes along an angle: pencil / crayon fibre, used on suns, felt, fur
export function fibre(ctx, clipFn, box, n, ang, len, cols, w = 1.2, a = .6, seed = 9) {
  const r = rng(seed); ctx.save(); clipFn(); ctx.clip(); ctx.lineCap = "round"; ctx.lineWidth = w; const [x0, y0, x1, y1] = box;
  for (let i = 0; i < n; i++) { const x = lerp(x0, x1, r()), y = lerp(y0, y1, r()), l = len * (.5 + r()), aa = ang + (r() - .5) * .5;
    ctx.globalAlpha = a * (.5 + r() * .5); ctx.strokeStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(aa) * l, y + Math.sin(aa) * l); ctx.stroke(); }
  ctx.restore();
}
// radial burst / impact lines around a point
export function burst(ctx, x, y, r0, r1, n = 10, w = 3, c = INK, a0 = 0, span = Math.PI * 2) {
  for (let i = 0; i < n; i++) { const a = a0 + (span >= Math.PI * 2 ? i / n : i / Math.max(1, n - 1)) * span; line(ctx, [[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], w, c); }
}
// speed lines trailing behind a moving thing (dir = travel angle)
export function speedLines(ctx, x, y, dir, n = 3, len = 50, gap = 12, w = 2.4, c = INK) {
  const bx = -Math.cos(dir), by = -Math.sin(dir), nx = -by, ny = bx;
  for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * gap, sx = x + bx * 30 + nx * o, sy = y + by * 30 + ny * o; line(ctx, [[sx, sy], [sx + bx * len * (1 - i * .15), sy + by * len * (1 - i * .15)]], w, c); }
}
export function lerpColor(a, b, k) { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(",")})`; }
