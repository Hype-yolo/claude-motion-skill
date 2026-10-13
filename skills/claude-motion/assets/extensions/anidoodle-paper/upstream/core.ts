// PORTABLE ART CORE, phase 0. Plain TypeScript: no React, no Remotion, no DOM, no SVG,
// and no ctx.filter of any kind. Everything a host must supply is in `Env`.
//
// Contract: draw(ctx, frame, env) is a pure function of (frame, env). Randomness only
// from rng(seed). Texture = seeded, tileable noise composited per layer. Edge wobble
// and wet-edge displacement are baked into GEOMETRY, never applied as a filter.

export type P = [number, number];
export type Ctx = CanvasRenderingContext2D;
export type Layer = { canvas: CanvasImageSource & { width: number; height: number }; ctx: Ctx };
export type Env = {
  W: number; H: number; scale: number; // logical size, device pixels per logical pixel
  canvas(w: number, h: number): Layer; // the ONLY way the core obtains an offscreen surface
  image?(name: string): CanvasImageSource | undefined; // assets are decoded by the ADAPTER before frame 0
  cache: Map<string, unknown>;
  // OPTIONAL, host-provided: a store of finished plate frames that outlives the page (the adapters
  // keep it on disk, keyed by a hash of the plate's source, so it can never hand back stale art).
  // get() returns the exact pixels renderFrame would draw for (film, frame) at w x h, or nothing;
  // put() offers a freshly drawn one. A core that never calls it draws exactly the same frames.
  bake?: { get(film: object, frame: number, w: number, h: number): CanvasImageSource | undefined; put(film: object, frame: number, layer: Layer): void };
  // set by the host on the film's own env (never on a plate's): what is drawn with it lands in the
  // frame, so the frame probe (framecheck.mjs) may hold its text and content boxes to the frame's edges
  root?: boolean;
};

// ---------------------------------------------------------------- the frame probe
// With a probe installed (hosts/page.ts, only while framecheck.mjs asks), drawing code reports the
// device-pixel box of what the viewer must see whole: a line of text, a card, a window. A box the
// frame's edge cuts through is a design fault (clipped type, an edge-cropped card). Off by default: no cost.
export type ProbeRec = { kind: "text" | "box"; label: string; x0: number; y0: number; x1: number; y1: number };
export const probeRect = (ctx: Ctx, env: Env, x: number, y: number, w: number, h: number, label: string, kind: ProbeRec["kind"] = "box") => {
  const p = (globalThis as { __ANIDOODLE_PROBE__?: (r: ProbeRec) => void }).__ANIDOODLE_PROBE__;
  if (!p || !env.root || ctx.globalAlpha < 0.1) return;
  const m = ctx.getTransform(), pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([a, b]) => [m.a * a + m.c * b + m.e, m.b * a + m.d * b + m.f]);
  p({ kind, label, x0: Math.min(...pts.map((q) => q[0])), y0: Math.min(...pts.map((q) => q[1])), x1: Math.max(...pts.map((q) => q[0])), y1: Math.max(...pts.map((q) => q[1])) });
};

// ---------------------------------------------------------------- deterministic randomness
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

// Gradient noise, optionally periodic so a tile repeats without a seam. fractal() mirrors
// the shape of SVG fractalNoise: sum of octaves at halving amplitude, mapped to 0..1.
const noiseCache = new Map<number, { perm: Uint16Array; gx: Float32Array; gy: Float32Array }>();
const table = (seed: number) => {
  let t = noiseCache.get(seed);
  if (!t) { const r = rng(seed * 7919 + 13), perm = new Uint16Array(512), gx = new Float32Array(256), gy = new Float32Array(256); const p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; for (let i = 0; i < 256; i++) { const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); } t = { perm, gx, gy }; noiseCache.set(seed, t); }
  return t;
};
const noise2 = (seed: number, x: number, y: number, px = 0, py = 0): number => {
  const { perm, gx, gy } = table(seed);
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const w = (v: number, p: number) => (p > 0 ? ((v % p) + p) % p : v) & 255;
  const g = (ix: number, iy: number, dx: number, dy: number) => { const h = perm[perm[w(ix, px)] + w(iy, py)]; return gx[h] * dx + gy[h] * dy; };
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = g(x0, y0, fx, fy), b = g(x0 + 1, y0, fx - 1, fy), c = g(x0, y0 + 1, fx, fy - 1), d = g(x0 + 1, y0 + 1, fx - 1, fy - 1);
  return a + sx * (b - a) + sy * (c + sx * (d - c) - (a + sx * (b - a)));
};
export const fractal = (seed: number, x: number, y: number, fx: number, fy: number, oct: number, tile = 0): number => {
  let sum = 0, amp = 1, px = tile ? Math.max(1, Math.round(fx * tile)) : 0, py = tile ? Math.max(1, Math.round(fy * tile)) : 0;
  let kx = tile ? px / tile : fx, ky = tile ? py / tile : fy;
  for (let o = 0; o < oct; o++) { sum += noise2(seed + o * 101, x * kx, y * ky, px, py) * amp; amp *= 0.5; kx *= 2; ky *= 2; px *= 2; py *= 2; }
  return (sum + 1) / 2;
};
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- geometry (ported 1:1 from pencil.tsx)
export const jitter = (pts: P[], amt: number, seed: number): P[] => { if (amt <= 0) return pts; const r = rng(seed); return pts.map(([x, y]) => [x + (r() - 0.5) * 2 * amt, y + (r() - 0.5) * 2 * amt]); };
export const sample = (pts: P[], closed = false, per = 10): P[] => {
  if (pts.length < 2) return pts;
  const n = pts.length, at = (i: number): P => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]), out: P[] = [], segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) { const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]; for (let k = 0; k < per; k++) { const t = k / per, t2 = t * t, t3 = t2 * t; out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } }
  out.push(closed ? out[0] : pts[n - 1]);
  return out;
};
// centreline -> closed ribbon outline. `rough` is the pencil's bite: what the SVG build did with a displacement filter.
// resample a polyline so vertices sit about `step` apart: the edge needs somewhere to be bitten
const densify = (s: P[], step: number): P[] => { const out: P[] = [s[0]]; for (let i = 1; i < s.length; i++) { const a = s[i - 1], b = s[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } return out; };
const ribbon = (s0: P[], width: number, seed: number, taper: number, pressure: number, rough = 0): P[] => {
  const s = rough ? densify(s0, 1.5) : s0;
  const a = (seed % 17) * 0.37, b = (seed % 11) * 0.53, L: P[] = [], R: P[] = [], r = rng(seed * 31 + 7);
  for (let i = 0; i < s.length; i++) {
    const t = i / (s.length - 1), p = s[i], q = s[Math.min(s.length - 1, i + 1)], o = s[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], len = Math.hypot(dx, dy) || 1;
    const ends = Math.min(1, t / 0.14, (1 - t) / 0.2), tp = 1 - taper + taper * Math.pow(Math.max(0.04, ends), 0.7);
    const pr = Math.max(0.14, 1 - 0.26 * pressure + pressure * (0.3 * Math.sin(t * 5.5 + a) + 0.14 * Math.sin(t * 17 + b)));
    const w = (width * tp * pr) / 2, j1 = (r() - 0.5) * rough, j2 = (r() - 0.5) * rough;
    L.push([p[0] - (dy / len) * (w + j1), p[1] + (dx / len) * (w + j1)]); R.push([p[0] + (dy / len) * (w + j2), p[1] - (dx / len) * (w + j2)]);
  }
  return [...L, ...R.reverse()];
};
export const oval = (cx: number, cy: number, rx: number, ry = rx, n = 10, a0 = -1.9): P[] => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as P; });
export const softBox = (cx: number, cy: number, w: number, h: number, e = 3.2, n = 16): P[] => Array.from({ length: n }, (_, i) => { const a = -2.2 + (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = 1 / (Math.abs(c) ** e + Math.abs(s) ** e) ** (1 / e); return [cx + (c * k * w) / 2, cy + (s * k * h) / 2] as P; });
export const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 6): P[] => Array.from({ length: n }, (_, i) => { const a = a0 + (i / (n - 1)) * (a1 - a0); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as P; });
export const line = (a: P, b: P, bow = 0): P[] => { const nx = -(b[1] - a[1]), ny = b[0] - a[0], l = Math.hypot(nx, ny) || 1; return [a, [(a[0] + b[0]) / 2 + (nx / l) * bow, (a[1] + b[1]) / 2 + (ny / l) * bow], b]; };
export const turn = (pts: P[], cx: number, cy: number, deg: number): P[] => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); };
export const poly = (corners: P[], per = 3): P[] => corners.flatMap((a, i) => { const b = corners[(i + 1) % corners.length]; return Array.from({ length: per }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / per, a[1] + ((b[1] - a[1]) * k) / per] as P); });
export const heart = (cx: number, cy: number, s: number): P[] => Array.from({ length: 14 }, (_, i) => { const t = (i / 14) * Math.PI * 2; return [cx + s * Math.sin(t) ** 3, cy - (s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))) / 16] as P; });
export const tube = (centre: P[], r0: number, r1 = r0, cap = true): P[] => {
  const c = sample(centre, false, 5), L: P[] = [], R: P[] = [];
  c.forEach((p, i) => { const q = c[Math.min(c.length - 1, i + 1)], o = c[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], len = Math.hypot(dx, dy) || 1, r = r0 + ((r1 - r0) * i) / (c.length - 1); L.push([p[0] - (dy / len) * r, p[1] + (dx / len) * r]); R.push([p[0] + (dy / len) * r, p[1] - (dx / len) * r]); });
  const e = c[c.length - 1], e0 = c[c.length - 2], ex = e[0] - e0[0], ey = e[1] - e0[1], el = Math.hypot(ex, ey) || 1, tip: P[] = cap ? [[e[0] + (ex / el) * r1, e[1] + (ey / el) * r1]] : [], thin = (a: P[]) => a.filter((_, i) => i % 3 === 0 || i === a.length - 1);
  return [...thin(L), ...tip, ...thin(R).reverse()];
};
const bbox = (s: P[]) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; s.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }); return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; };
const scaled = (s: P[], k: number, dx = 0, dy = 0): P[] => { const b = bbox(s); return s.map(([x, y]) => [b.cx + (x - b.cx) * k + dx, b.cy + (y - b.cy) * k + dy]); };
// Displace geometry by a smooth vector field: the portable stand-in for feDisplacementMap.
export const displace = (pts: P[], amp: number, freq: number, oct: number, seed: number): P[] => pts.map(([x, y]) => [x + (fractal(seed, x, y, freq, freq, oct) - 0.5) * amp, y + (fractal(seed + 50, x, y, freq, freq, oct) - 0.5) * amp]);
export const halftone = (b: { x0: number; y0: number; x1: number; y1: number }, pitch: number, angleDeg: number, tone: (x: number, y: number) => number): [number, number, number][] => {
  const a = (angleDeg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + pitch, out: [number, number, number][] = [];
  for (let u = -R; u <= R; u += pitch) for (let v = -R; v <= R; v += pitch) { const x = cx + u * c - v * sn, y = cy + u * sn + v * c; if (x < b.x0 - pitch || x > b.x1 + pitch || y < b.y0 - pitch || y > b.y1 + pitch) continue; const t = clamp(tone(x, y)); if (t < 0.03) continue; out.push([x, y, pitch * 0.72 * Math.sqrt(t)]); }
  return out;
};

// ---------------------------------------------------------------- texture tiles
const TILE = 512; // logical px; every tile is periodic, so it repeats without a seam
type TileSpec = { fx: number; fy?: number; oct: number; seed: number; k?: number; o?: number; gray?: boolean };
export const TILES: Record<string, TileSpec> = {
  pencilTooth: { fx: 1.3, oct: 1, seed: 8, k: -2.0, o: 2.05 }, // graphite skips the valleys of the sheet
  washGran: { fx: 0.09, oct: 2, seed: 11, k: -0.45, o: 1.2 }, // granulating pigment
  risoSpeck: { fx: 1.15, oct: 2, seed: 18, k: -3.0, o: 2.35 }, // pinholes where soy ink missed
  risoMottle: { fx: 0.012, fy: 0.05, oct: 3, seed: 22, k: -0.9, o: 1.38 }, // the drum never inks evenly
  paper: { fx: 0.75, oct: 3, seed: 21, gray: true },
  coldpress: { fx: 0.16, oct: 4, seed: 23, gray: true },
  draftTooth: { fx: 0.95, oct: 2, seed: 33, k: -1.7, o: 1.95 }, // ruling-pen ink breaking up on the tooth of the sheet
  blueMottle: { fx: 0.0065, oct: 4, seed: 37, gray: true }, // a cyanotype never exposes evenly
};
const tile = (env: Env, kind: string): Layer => {
  const key = `tile:${kind}:${env.scale}`; let L = env.cache.get(key) as Layer | undefined;
  if (L) return L;
  const sp = TILES[kind], n = Math.round(TILE * env.scale); L = env.canvas(n, n);
  const img = L.ctx.createImageData(n, n), d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const lx = x / env.scale, ly = y / env.scale, i = (y * n + x) * 4, v = fractal(sp.seed, lx, ly, sp.fx, sp.fy ?? sp.fx, sp.oct, TILE);
    if (sp.gray) { const lin = clamp((v + fractal(sp.seed + 7, lx, ly, sp.fx, sp.fy ?? sp.fx, sp.oct, TILE)) / 2), g = 255 * (lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055); /* SVG filters work in linearRGB; match that */ d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255; }
    else { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 255 * clamp(sp.k! * v + sp.o!); }
  }
  L.ctx.putImageData(img, 0, 0); env.cache.set(key, L);
  return L;
};

// ---------------------------------------------------------------- the drawing surface
export type Medium = { nib: number; taper: number; pressure: number; retrace: boolean; wobble: number; rough: number };
export const PENCIL: Medium = { nib: 1.45, taper: 1, pressure: 1, retrace: true, wobble: 1, rough: 1.15 };
export const RISOLINE: Medium = { nib: 1.7, taper: 0.5, pressure: 0.5, retrace: false, wobble: 1.6, rough: 0.9 };
export const GRAPHITE = "#3d3437";
export const TINT = { white: "#fffaf3", blush: "#f2899c", rose: "#e9a3ad", butter: "#f3d577", sky: "#a9c8e6", denim: "#6f93c4", sage: "#a9cfa6", lilac: "#c7b3e0", peach: "#f5b98a", glow: "#ffe9a3" };
type PenOpts = { w?: number; color?: string; seed?: number; closed?: boolean; wobble?: number; boil?: number; taper?: number; opacity?: number; retrace?: boolean; progress?: number };

export type Rect = [number, number, number, number]; // device px: x0, y0, x1, y1
type Tracked = Layer & { dirty?: Rect | null };

// PERFORMANCE RULE: nothing here touches a full-size surface unless it has to. Every primitive
// marks the device-pixel box it drew into; blur, texture, compositing and clearing are then
// confined to that box. (Phase 0 cleared and composited whole layers ~150 times per frame.)
export class Gfx {
  // `drawn`: union of every device box composited onto `main` since construction. Read-only for the
  // art; the web profile (bake.ts) crops a part into a sprite by it. Setting it changes no pixel.
  drawn: Rect | null = null;
  cur: Ctx; private pool: Tracked[] = []; private stack: [number, number, number, number][] = [[0, 0, 1, 0]]; private box: Rect | null = null;
  constructor(public main: Ctx, public env: Env, public frame: number, public medium: Medium) {
    this.cur = main; this.base(main);
    // surfaces outlive the frame: allocating six full-size canvases per frame is pure churn
    const key = `pool:${Math.round(env.W * env.scale)}x${Math.round(env.H * env.scale)}`; let pool = env.cache.get(key) as Tracked[] | undefined; if (!pool) { pool = []; env.cache.set(key, pool); } this.pool = pool;
  }
  private get m() { return this.stack[this.stack.length - 1]; }
  private get DW() { return Math.round(this.env.W * this.env.scale); }
  private get DH() { return Math.round(this.env.H * this.env.scale); }
  private base(c: Ctx) { const [x, y, s, r] = this.m, k = this.env.scale; if (r === 0) { c.setTransform(k * s, 0, 0, k * s, k * x, k * y); return; } const co = Math.cos(r), si = Math.sin(r); c.setTransform(k * s * co, k * s * si, -k * s * si, k * s * co, k * x, k * y); }
  private dev(c: Ctx) { c.setTransform(1, 0, 0, 1, 0, 0); }
  private clip(r: Rect, pad = 0): Rect { return [Math.max(0, Math.floor(r[0] - pad)), Math.max(0, Math.floor(r[1] - pad)), Math.min(this.DW, Math.ceil(r[2] + pad)), Math.min(this.DH, Math.ceil(r[3] + pad))]; }
  private join(a: Rect | null, b: Rect): Rect { return a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b; }
  // local points -> device box, with `pad` local units of slack (line weight, displacement, blur)
  private boxOf(pts: P[], pad: number): Rect { const [tx, ty, s, r] = this.m, k = this.env.scale; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } x0 -= pad; y0 -= pad; x1 += pad; y1 += pad; if (r === 0) return this.clip([k * (tx + x0 * s), k * (ty + y0 * s), k * (tx + x1 * s), k * (ty + y1 * s)]); const co = Math.cos(r), si = Math.sin(r), cs = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]; let a0 = 1e9, b0 = 1e9, a1 = -1e9, b1 = -1e9; for (const [x, y] of cs) { const ax = k * (tx + s * (co * x - si * y)), by = k * (ty + s * (si * x + co * y)); if (ax < a0) a0 = ax; if (by < b0) b0 = by; if (ax > a1) a1 = ax; if (by > b1) b1 = by; } return this.clip([a0, b0, a1, b1]); }
  mark(pts: P[], pad = 4) { this.box = this.join(this.box, this.boxOf(pts, pad)); }
  touch(x0: number, y0: number, x1: number, y1: number) { this.mark([[x0, y0], [x1, y1]], 0); } // for raw ctx drawing inside a group
  layer(): Tracked { let L = this.pool.pop(); if (!L) { L = this.env.canvas(this.DW, this.DH) as Tracked; L.dirty = null; } this.dev(L.ctx); L.ctx.globalCompositeOperation = "source-over"; L.ctx.globalAlpha = 1; if (L.dirty) { const d = L.dirty; L.ctx.clearRect(d[0], d[1], d[2] - d[0], d[3] - d[1]); L.dirty = null; } return L; }
  release(L: Tracked, dirty: Rect | null) { L.dirty = dirty ? this.join(L.dirty ?? null, dirty) : L.dirty; this.pool.push(L); }
  push(x: number, y: number, s: number, r = 0) { const [px, py, ps, pr] = this.m; if (pr === 0) { this.stack.push([px + x * ps, py + y * ps, ps * s, r]); this.base(this.cur); return; } const co = Math.cos(pr), si = Math.sin(pr); this.stack.push([px + ps * (co * x - si * y), py + ps * (si * x + co * y), ps * s, pr + r]); this.base(this.cur); }
  pop() { this.stack.pop(); this.base(this.cur); }

  path(c: Ctx, pts: P[]) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
  // gaussian-ish blur without ctx.filter (Safari has none): halve the box N times, scale it back up
  soften(L: Tracked, radius: number, r: Rect): Rect {
    const rp = this.clip(r, radius * this.env.scale * 3), steps = Math.max(1, Math.round(Math.log2(Math.max(2, radius * this.env.scale * 1.6)))), T = this.layer(), U = this.layer();
    let w = rp[2] - rp[0], h = rp[3] - rp[1]; if (w < 2 || h < 2) { this.release(T, null); this.release(U, null); return rp; }
    const sizes: [number, number][] = [[w, h]]; let src: Tracked = L, sx = rp[0], sy = rp[1], a = T, b = U;
    for (let i = 0; i < steps; i++) { const nw = Math.max(1, Math.ceil(w / 2)), nh = Math.max(1, Math.ceil(h / 2)); a.ctx.clearRect(0, 0, nw + 1, nh + 1); a.ctx.imageSmoothingEnabled = true; a.ctx.drawImage(src.canvas as CanvasImageSource, sx, sy, w, h, 0, 0, nw, nh); sizes.push([nw, nh]); src = a; sx = 0; sy = 0; w = nw; h = nh; [a, b] = [b, a]; }
    for (let i = steps - 1; i >= 1; i--) { const [dw, dh] = sizes[i]; a.ctx.clearRect(0, 0, dw + 1, dh + 1); a.ctx.drawImage(src.canvas as CanvasImageSource, 0, 0, w, h, 0, 0, dw, dh); src = a; w = dw; h = dh; [a, b] = [b, a]; }
    this.dev(L.ctx); L.ctx.clearRect(rp[0], rp[1], rp[2] - rp[0], rp[3] - rp[1]); L.ctx.imageSmoothingEnabled = true; L.ctx.drawImage(src.canvas as CanvasImageSource, 0, 0, w, h, rp[0], rp[1], rp[2] - rp[0], rp[3] - rp[1]);
    const used: Rect = [0, 0, sizes[1][0] + 1, sizes[1][1] + 1]; this.release(T, used); this.release(U, used);
    return rp;
  }
  // multiply a layer's alpha by a texture tile, inside the box only (texK scales the tooth with the actor)
  tooth(L: Tracked, kind: string, r: Rect, texK = 1) { const c = L.ctx, t = tile(this.env, kind); c.save(); c.setTransform(texK, 0, 0, texK, 0, 0); c.globalCompositeOperation = "destination-in"; c.fillStyle = c.createPattern(t.canvas as CanvasImageSource, "repeat")!; c.beginPath(); c.rect(r[0] / texK, r[1] / texK, (r[2] - r[0]) / texK, (r[3] - r[1]) / texK); c.clip(); c.fillRect(r[0] / texK - 1, r[1] / texK - 1, (r[2] - r[0]) / texK + 2, (r[3] - r[1]) / texK + 2); c.restore(); }
  // draw a group on its own layer, texture it once, composite only what was touched
  group(kind: "ink" | "paint" | "plain", fn: () => void, opts: { blend?: GlobalCompositeOperation; alpha?: number; off?: P; textures?: string[]; blur?: number } = {}) {
    const L = this.layer(), prev = this.cur, outer = this.box; this.cur = L.ctx; this.box = null; this.base(L.ctx); fn(); this.cur = prev; if (prev !== this.main) this.base(prev);
    let r: Rect = this.box ?? [0, 0, this.DW, this.DH]; this.box = outer; const k = this.m[2];
    if (kind === "paint") { r = this.soften(L, 0.9 * k, r); this.tooth(L, "washGran", r, k); }
    if (kind === "ink") this.tooth(L, "pencilTooth", r, k);
    if (opts.blur) r = this.soften(L, opts.blur, r);
    (opts.textures ?? []).forEach((t) => this.tooth(L, t, r));
    const m = this.main, w = r[2] - r[0], h = r[3] - r[1];
    if (w > 0 && h > 0) { const ox = Math.round((opts.off?.[0] ?? 0) * this.env.scale), oy = Math.round((opts.off?.[1] ?? 0) * this.env.scale); this.drawn = this.join(this.drawn, this.clip([r[0] + ox, r[1] + oy, r[2] + ox, r[3] + oy])); }
    if (w > 0 && h > 0) { m.save(); this.dev(m); m.globalCompositeOperation = opts.blend ?? "source-over"; m.globalAlpha = opts.alpha ?? 1; m.drawImage(L.canvas as CanvasImageSource, r[0], r[1], w, h, r[0] + Math.round((opts.off?.[0] ?? 0) * this.env.scale), r[1] + Math.round((opts.off?.[1] ?? 0) * this.env.scale), w, h); m.restore(); }
    this.release(L, r);
  }

  // INK IN ONE PASS. White ink on a blue ground blooms, so every line wants a soft halo under it.
  // Drawing the group twice (halo, then line) costs the strokes twice; this takes the halo from a
  // blurred COPY of the same ink instead, which is the same picture for half the stroke work.
  inkGroup(fn: () => void, o: { blur?: number; alpha?: number; textures?: string[] } = {}) {
    const L = this.layer(), prev = this.cur, outer = this.box; this.cur = L.ctx; this.box = null; this.base(L.ctx); fn(); this.cur = prev; if (prev !== this.main) this.base(prev);
    const r: Rect = this.box ?? [0, 0, this.DW, this.DH]; this.box = outer;
    const w = r[2] - r[0], h = r[3] - r[1]; if (w <= 0 || h <= 0) { this.release(L, r); return; }
    const H = this.layer(), pad = this.clip(r, (o.blur ?? 1.8) * this.env.scale * 3);
    this.dev(H.ctx); H.ctx.drawImage(L.canvas as CanvasImageSource, r[0], r[1], w, h, r[0], r[1], w, h);
    const rh = this.soften(H, o.blur ?? 1.8, r);
    (o.textures ?? ["draftTooth"]).forEach((t) => this.tooth(L, t, r));
    this.drawn = this.join(this.drawn, this.join(rh, r));
    const m = this.main; m.save(); this.dev(m); m.globalCompositeOperation = "source-over";
    m.globalAlpha = o.alpha ?? 0.28; m.drawImage(H.canvas as CanvasImageSource, rh[0], rh[1], rh[2] - rh[0], rh[3] - rh[1], rh[0], rh[1], rh[2] - rh[0], rh[3] - rh[1]);
    m.globalAlpha = 1; m.drawImage(L.canvas as CanvasImageSource, r[0], r[1], w, h, r[0], r[1], w, h); m.restore(); this.base(m);
    this.release(L, r); this.release(H, pad);
  }

  // progress < 1 draws the first part of the stroke only, cut on the CENTRELINE so the travelling
  // tip keeps the taper of a lifting nib. progress 1 takes the old path, byte for byte.
  private upTo(s: P[], progress: number): P[] {
    if (progress >= 1) return s; const n = (s.length - 1) * progress, i = Math.floor(n), f = n - i;
    const head = s.slice(0, i + 1); if (f > 1e-9 && i + 1 < s.length) head.push([s[i][0] + (s[i + 1][0] - s[i][0]) * f, s[i][1] + (s[i + 1][1] - s[i][1]) * f]);
    return head.length > 1 ? head : s.slice(0, 2);
  }
  pen(pts: P[], o: PenOpts = {}) {
    const { w = 3.4, color = GRAPHITE, seed = 1, closed = false, wobble = 1.1, boil = 0.55, taper = 1, opacity = 0.96, retrace = true, progress = 1 } = o, M = this.medium, b = Math.floor(this.frame / 4), c = this.cur;
    if (progress <= 0) return;
    const ctrl = closed ? [...pts, pts[0], pts[1]] : pts, basePts = jitter(ctrl, wobble * M.wobble, seed), W = w * M.nib;
    const main = ribbon(this.upTo(sample(jitter(basePts, boil, seed * 911 + b)), progress), W, seed, taper * M.taper, M.pressure, M.rough); this.mark(main, 2);
    c.fillStyle = color; c.globalAlpha = opacity; this.path(c, main); c.fill();
    if (retrace && M.retrace) { const re = ribbon(this.upTo(sample(jitter(basePts, boil + 1.3 * M.wobble, seed * 577 + b)), progress), W * 0.5, seed + 5, 1, M.pressure, M.rough); this.mark(re, 2); c.globalAlpha = opacity * 0.4; this.path(c, re); c.fill(); }
    c.globalAlpha = 1;
  }
  hatch(x: number, y: number, w: number, o: { n?: number; len?: number; angle?: number; color?: string; seed?: number; pw?: number; opacity?: number } = {}) {
    const { n = 8, len = 16, angle = -1.05, color = GRAPHITE, seed = 1, pw = 1.9, opacity = 0.55 } = o, r = rng(seed);
    for (let i = 0; i < n; i++) { const px = x + (w * i) / Math.max(1, n - 1) + (r() - 0.5) * 3, l = len * (0.7 + r() * 0.6), a = angle + (r() - 0.5) * 0.18; this.pen([[px, y], [px + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5], [px + Math.cos(a) * l, y + Math.sin(a) * l]], { w: pw, color, seed: seed + i, wobble: 0.6, opacity, retrace: false }); }
  }
  // a plain filled shape (for media that cut or print rather than paint)
  fill(pts: P[], color: string, alpha = 1) { const c = this.cur; this.mark(pts, 2); c.globalAlpha = alpha; c.fillStyle = color; this.path(c, pts); c.fill(); c.globalAlpha = 1; }
  // watercolour that never quite fills its outline; the wet edge is displaced GEOMETRY
  wash(pts: P[], color: string, o: { alpha?: number; seed?: number; dx?: number; dy?: number; shrink?: number; rim?: boolean } = {}) {
    const { alpha = 0.62, seed = 1, dx = 3, dy = 2, shrink = 0.94, rim = true } = o, c = this.cur;
    const s = displace(scaled(sample(jitter(pts, 2.2, seed), true, 8), shrink, dx, dy), 13, 0.022, 3, 5); this.mark(s, 5);
    c.globalAlpha = alpha; c.fillStyle = color; this.path(c, s); c.fill();
    if (rim) { c.globalAlpha = alpha * 0.55; c.strokeStyle = color; c.lineWidth = 3.5; c.lineJoin = "round"; c.stroke(); } // pigment settles at the edge
    c.globalAlpha = 1;
  }
  // a shaded form: shadow colour underneath, the lit colour shifted toward the light (one soft pass, one crisp), a lifted highlight
  form(pts: P[], color: string, shade: string, o: { seed?: number; light?: P; alpha?: number; hi?: number[] } = {}) {
    const { seed = 1, light = [-8, -9], alpha = 0.98, hi } = o, s = displace(sample(jitter(pts, 1.2, seed), true, 8), 13, 0.022, 3, 5), k = this.m[2];
    const r = this.boxOf(s, 3); this.box = this.join(this.box, r);
    const T = this.layer(); this.base(T.ctx); T.ctx.fillStyle = shade; this.path(T.ctx, s); T.ctx.fill();
    const U = this.layer(); this.base(U.ctx); U.ctx.fillStyle = color; U.ctx.translate(light[0], light[1]); this.path(U.ctx, s); U.ctx.fill(); const ru = this.soften(U, 5 * k, this.boxOf(s.map(([x, y]) => [x + light[0], y + light[1]] as P), 2));
    const w = r[2] - r[0], h = r[3] - r[1];
    T.ctx.save(); this.base(T.ctx); this.path(T.ctx, s); T.ctx.clip(); this.dev(T.ctx); T.ctx.drawImage(U.canvas as CanvasImageSource, r[0], r[1], w, h, r[0], r[1], w, h); this.base(T.ctx); T.ctx.translate(light[0] * 2.2, light[1] * 2.2); T.ctx.fillStyle = color; this.path(T.ctx, s); T.ctx.fill();
    if (hi) { const V = this.layer(); this.base(V.ctx); V.ctx.fillStyle = "#ffffff"; V.ctx.globalAlpha = 0.75; V.ctx.beginPath(); V.ctx.ellipse(hi[0], hi[1], hi[2], hi[3], ((hi[4] ?? -30) * Math.PI) / 180, 0, Math.PI * 2); V.ctx.fill(); const m = Math.max(hi[2], hi[3]); const rv = this.soften(V, 5 * k, this.boxOf([[hi[0] - m, hi[1] - m], [hi[0] + m, hi[1] + m]], 1)); this.dev(T.ctx); T.ctx.drawImage(V.canvas as CanvasImageSource, rv[0], rv[1], rv[2] - rv[0], rv[3] - rv[1], rv[0], rv[1], rv[2] - rv[0], rv[3] - rv[1]); this.release(V, rv); }
    T.ctx.restore();
    const c = this.cur; c.save(); this.dev(c); c.globalAlpha = alpha; c.drawImage(T.canvas as CanvasImageSource, r[0], r[1], w, h, r[0], r[1], w, h); c.restore(); this.base(c);
    this.release(T, r); this.release(U, ru);
  }
  glow(cx: number, cy: number, r: number, color: string, opacity: number) { const c = this.cur, g = c.createRadialGradient(cx, cy, 0, cx, cy, r * 1.7), a = (v: number) => Math.round(255 * clamp(v * opacity)).toString(16).padStart(2, "0"); [[0, 1], [0.35, 0.9], [0.6, 0.55], [0.8, 0.2], [1, 0]].forEach(([t, v]) => g.addColorStop(t, color + a(v))); this.touch(cx - r * 1.8, cy - r * 1.8, cx + r * 1.8, cy + r * 1.8); c.fillStyle = g; c.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4); }
  // the sheet itself, over everything
  paper(kind: string, opacity: number) { const m = this.main, t = tile(this.env, kind); m.save(); this.dev(m); m.globalCompositeOperation = "multiply"; m.globalAlpha = opacity; m.fillStyle = m.createPattern(t.canvas as CanvasImageSource, "repeat")!; m.fillRect(0, 0, this.DW, this.DH); m.restore(); this.base(m); }
  vignette(edge: string) { const m = this.main, W = this.env.W, H = this.env.H; m.save(); this.base(m); m.translate(W / 2, H * 0.46); m.scale(1, H / W); const g = m.createRadialGradient(0, 0, 0, 0, 0, W * 0.72); g.addColorStop(0, "rgba(255,250,240,0.08)"); g.addColorStop(0.45, "rgba(255,250,240,0)"); g.addColorStop(1, edge); m.fillStyle = g; m.fillRect(-W, -H, W * 2, H * 2); m.restore(); }
}
