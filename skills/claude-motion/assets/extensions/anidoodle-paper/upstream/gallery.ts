// GALLERY KIT. The shared drawing helpers the style-gallery subjects are built from. Everything
// here is geometry or raw canvas on the CURRENT group surface (g.cur), so it composes with the
// core's groups, textures and papers. No randomness except rng(seed); no filters; no assets.
import { Gfx, type Ctx, type P, rng, sample, fractal } from "./core";

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpP = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const smooth = (pts: P[], closed = false, per = 12): P[] => sample(pts, closed, per);

// ---------------------------------------------------------------- colour
const hex = (h: string): [number, number, number] => { const s = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number]; };
export const mix = (a: string, b: string, t: number): string => { const x = hex(a), y = hex(b); return "#" + x.map((v, i) => Math.round(lerp(v, y[i], t)).toString(16).padStart(2, "0")).join(""); };

// ---------------------------------------------------------------- polylines
export const polyLen = (s: P[]) => s.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]) : 0), 0);
// n points evenly spaced by arc length: the only honest way to hang a width profile on a curve
export const resample = (s: P[], n: number): P[] => {
  const cum = [0]; for (let i = 1; i < s.length; i++) cum.push(cum[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
  const L = cum[cum.length - 1], out: P[] = []; let j = 1;
  for (let k = 0; k < n; k++) { const d = (L * k) / (n - 1); while (j < s.length - 1 && cum[j] < d) j++; const f = (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1); out.push(lerpP(s[j - 1], s[j], clamp(f))); }
  return out;
};
const normals = (s: P[], closed = false): P[] => s.map((_, i) => {
  const n = s.length, a = closed ? s[(i - 1 + n) % n] : s[Math.max(0, i - 1)], b = closed ? s[(i + 1) % n] : s[Math.min(n - 1, i + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l];
});
export const area = (s: P[]) => s.reduce((a, p, i) => { const q = s[(i + 1) % s.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

// piecewise-linear profile through [t, value] knots, smoothed with a cosine ease between knots
export const profile = (knots: [number, number][]) => (t: number) => {
  if (t <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) if (t <= knots[i][0]) { const [t0, v0] = knots[i - 1], [t1, v1] = knots[i], f = (t - t0) / (t1 - t0); return lerp(v0, v1, (1 - Math.cos(f * Math.PI)) / 2); }
  return knots[knots.length - 1][1];
};

// ---------------------------------------------------------------- a body hung on a spine
// A creature seen from above is a spine plus a half-width at every point along it. `at(t, s)` is
// the body's own coordinate frame: t runs nose (0) to tail (1), s runs -1 (left edge) to +1 (right
// edge). Anything placed in (t, s) bends with the body, which is what makes markings and fins sit
// ON the animal instead of floating over it.
export type Body = { spine: P[]; nrm: P[]; hw: (t: number) => number; outline: P[]; at: (t: number, s: number) => P; tan: (t: number) => P };
export const body = (ctrl: P[], hw: (t: number) => number, n = 120): Body => {
  const spine = resample(smooth(ctrl, false, 16), n), nrm = normals(spine);
  const idx = (t: number) => clamp(t) * (n - 1);
  const pick = (arr: P[], t: number): P => { const f = idx(t), i = Math.floor(f), k = Math.min(n - 1, i + 1); return lerpP(arr[i], arr[k], f - i); };
  const at = (t: number, s: number): P => { const p = pick(spine, t), q = pick(nrm, t), w = hw(t); return [p[0] + q[0] * w * s, p[1] + q[1] * w * s]; };
  const tan = (t: number): P => { const q = pick(nrm, t); return [q[1], -q[0]]; };
  const L: P[] = [], R: P[] = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); L.push(at(t, -1)); R.push(at(t, 1)); }
  return { spine, nrm, hw, outline: [...L, ...R.reverse()], at, tan };
};

// ---------------------------------------------------------------- raw drawing on the current surface
export const trace = (c: Ctx, pts: P[], closed = true) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (closed) c.closePath(); };
const boxOf = (pts: P[]) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };
export const bounds = boxOf;
export const fillShape = (g: Gfx, pts: P[], color: string, alpha = 1) => { const b = boxOf(pts); g.touch(b.x0 - 2, b.y0 - 2, b.x1 + 2, b.y1 + 2); const c = g.cur; c.globalAlpha = alpha; c.fillStyle = color; trace(c, pts); c.fill(); c.globalAlpha = 1; };
// draw `fn` only inside `pts`. Marks the clip box so the group composites the right region.
export const clipped = (g: Gfx, pts: P[], fn: () => void) => { const b = boxOf(pts); g.touch(b.x0 - 2, b.y0 - 2, b.x1 + 2, b.y1 + 2); const c = g.cur; c.save(); trace(c, pts); c.clip(); fn(); c.restore(); };

// ---------------------------------------------------------------- the inker's line
// A brush-marker contour: tapered ends, and HEAVIER on the side turned away from the light (the
// comic inker's rule). `light` is a unit vector pointing TO the light. For a closed contour the
// outward normal is found from the winding; for an open stroke `side` picks which normal is "out".
export type InkOpts = { w: number; light?: P; shadow?: number; taper?: [number, number]; seed?: number; rough?: number; closed?: boolean; side?: 1 | -1; min?: number; swell?: number };
export const inkRibbon = (center: P[], o: InkOpts): P[] => {
  const { w, light = [-0.6, -0.8], shadow = 0.8, taper = [0.12, 0.18], seed = 1, rough = 0.25, closed = false, side = 1, min = 0.18, swell = 0.12 } = o;
  const s = closed ? center : center, n = s.length, nr = normals(s, closed), out = closed ? (area(s) > 0 ? -1 : 1) : side, r = rng(seed);
  const ph = (seed % 13) * 0.7, L: P[] = [], R: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), q = nr[i], ox = q[0] * out, oy = q[1] * out;
    const away = clamp(-(ox * light[0] + oy * light[1]));                         // 1 where the edge faces away from the light
    const ends = closed ? 1 : Math.min(1, t / taper[0], (1 - t) / taper[1]);
    const tp = min + (1 - min) * Math.pow(clamp(ends), 0.8);
    const wv = w * tp * (1 + shadow * away * 1.1 - shadow * 0.35) * (1 + swell * Math.sin(t * 9 + ph)) / 2;
    const j1 = (r() - 0.5) * rough, j2 = (r() - 0.5) * rough;
    L.push([s[i][0] - q[0] * (wv + j1), s[i][1] - q[1] * (wv + j1)]); R.push([s[i][0] + q[0] * (wv + j2), s[i][1] + q[1] * (wv + j2)]);
  }
  return closed ? [...L, L[0], ...[...R, R[0]].reverse()] : [...L, ...R.reverse()];
};
// fill a ribbon; a closed ribbon is two loops, filled even-odd so the middle stays open
export const ink = (g: Gfx, center: P[], color: string, o: InkOpts, alpha = 1) => {
  const pts = inkRibbon(center, o), b = boxOf(pts); g.touch(b.x0 - 3, b.y0 - 3, b.x1 + 3, b.y1 + 3);
  const c = g.cur; c.globalAlpha = alpha; c.fillStyle = color;
  if (o.closed) { const n = center.length + 1; c.beginPath(); pts.slice(0, n).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); pts.slice(n).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill("evenodd"); }
  else { trace(c, pts); c.fill(); }
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------- organic blobs
// a closed wobbly blob: markings, pads, patches. `k` is how far the edge wanders (0..1 of r).
export const blob = (cx: number, cy: number, rx: number, ry: number, seed: number, k = 0.18, n = 14, rot = 0): P[] => {
  const r = rng(seed), ph = r() * 6.28, out: P[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, f = 1 + (fractal(seed, Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10, 0.6, 0.6, 2) - 0.5) * 2 * k + Math.sin(a * 3 + ph) * k * 0.3; const x = Math.cos(a) * rx * f, y = Math.sin(a) * ry * f; out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
  return smooth(out, true, 6);
};

// ---------------------------------------------------------------- hatching
// parallel strokes across a region at `angle`, spaced `gap`, kept only where `keep(x, y)` says so.
// Each stroke is broken into runs so tone can come from WHERE lines are, not from their opacity.
export const hatchRuns = (b: { x0: number; y0: number; x1: number; y1: number }, angle: number, gap: number, keep: (x: number, y: number) => boolean, step = 3, seed = 1): P[][] => {
  const c = Math.cos(angle), s = Math.sin(angle), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + gap, r = rng(seed), runs: P[][] = [];
  for (let v = -R; v <= R; v += gap) {
    const off = (r() - 0.5) * gap * 0.35; let cur: P[] = [];
    for (let u = -R; u <= R; u += step) { const x = cx + u * c - (v + off) * s, y = cy + u * s + (v + off) * c; if (keep(x, y)) cur.push([x, y]); else if (cur.length) { if (cur.length > 1) runs.push(cur); cur = []; } }
    if (cur.length > 1) runs.push(cur);
  }
  return runs;
};
export const inside = (pts: P[], x: number, y: number) => { let k = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
