// SCRAPBOOK KIT. What the archival-ephemera plate needs and core.ts does not have:
//   staged()   a drawing-process film runner: an ordered list of steps (painter order), each with a
//              frame window; every step that is finished, together with all steps before it, is
//              baked into ONE rolling base bitmap, so a frame only redraws what is still moving.
//   paper      torn and scissor-cut edges, fibres and uneven dye, lifted with a soft shadow.
//   type       a stroke glyph table (capitals, figures, a few signs) set as PRINTED type: slab
//              serifs, weight, slant, width and outline are properties of a face, and a face is
//              stroked with the canvas pen (never fillText). Typewriter, ransom-note and hand faces.
//   burin      the copperplate line: a centreline whose width swells with tone and tapers to a
//              point at each end, breaking into the paper where the tone falls below a threshold.
// Everything pure: rng(seed) only, no filters, no assets. Candidates for promotion to core.
import { Gfx, fractal, rng, sample, type Ctx, type Env, type Layer, type P } from "./core";
import { bounds, mix, resample } from "./gallery";

export const clamp01 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
export const ease = (t: number) => { const x = clamp01(t); return x >= 1 ? 1 : x * x * (3 - 2 * x); };
export const easeOut = (t: number) => { const x = clamp01(t); return x >= 1 ? 1 : 1 - (1 - x) * (1 - x) * (1 - x); };

// ---------------------------------------------------------------- the process runner
export type Step = { id: string; start: number; end: number; draw: (ctx: Ctx, env: Env, p: number, f: number) => void };
// start < end; p = (f - start) / (end - start) clamped, exactly 1 at or past `end`. A step whose
// end <= 0 is part of frame 0 (the bare ground). `post` runs over everything every frame.
export const staged = (id: string, steps: Step[], post?: (ctx: Ctx, env: Env, f: number) => void) => {
  for (let i = 0; i < steps.length; i++) if (!(steps[i].end > steps[i].start)) throw new Error(`${id}: step ${steps[i].id} has no length`);
  return (ctx: Ctx, f: number, env: Env) => {
    const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale);
    let k = 0; while (k < steps.length && steps[k].end <= f) k++;
    // the base holds steps [0, k) fully drawn. Its value is a pure function of (k, scale), and
    // the stored k says which prefix it is, so the key is honest; it only ever rolls forward.
    const key = `${id}:base:${DW}x${DH}`; let c = env.cache.get(key) as { k: number; L: Layer } | undefined;
    if (!c) { c = { k: 0, L: env.canvas(DW, DH) }; env.cache.set(key, c); }
    if (c.k > k) { c.L.ctx.setTransform(1, 0, 0, 1, 0, 0); c.L.ctx.clearRect(0, 0, DW, DH); c.k = 0; }
    for (let i = c.k; i < k; i++) { reset(c.L.ctx); steps[i].draw(c.L.ctx, env, 1, f); }
    c.k = k;
    reset(ctx); ctx.drawImage(c.L.canvas as CanvasImageSource, 0, 0);
    for (let i = k; i < steps.length; i++) { const s = steps[i]; if (f < s.start) continue; const p = f >= s.end ? 1 : clamp01((f - s.start) / (s.end - s.start)); reset(ctx); s.draw(ctx, env, p, f); }
    reset(ctx); post?.(ctx, env, f); reset(ctx);
  };
};
const reset = (c: Ctx) => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; };
// every frame on the beat grid, checked at load
export const onGrid = (id: string, frames: number[], dur: number) => { frames.forEach((f) => { if (f % 5 && f > 0) throw new Error(`${id}: cue ${f} is off the 5-frame event grid`); if (f > dur) throw new Error(`${id}: cue ${f} past the end`); }); };

// ---------------------------------------------------------------- paper
const nrmC = (s: P[]): P[] => s.map((_, i) => { const a = s[(i - 1 + s.length) % s.length], b = s[(i + 1) % s.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; });
const ring = (s: P[]) => s.reduce((a, p, i) => a + Math.hypot(p[0] - s[(i + 1) % s.length][0], p[1] - s[(i + 1) % s.length][1]), 0);
// a torn edge: the outline resampled finely and bitten by high-frequency noise; `grow` pushes it
// out so the white core of the sheet shows past the dyed face
export const tear = (shape: P[], amp: number, seed: number, grow = 0): P[] => {
  const s = resample([...shape, shape[0]], Math.max(24, Math.round(ring(shape) / 2.4))).slice(0, -1), nr = nrmC(s), r = rng(seed);
  return s.map(([x, y], i) => { const d = (fractal(seed, x, y, 0.08, 0.08, 3) - 0.5) * amp * 2.2 + (r() - 0.5) * amp * 0.7 + grow; return [x + nr[i][0] * d, y + nr[i][1] * d]; });
};
export const scissor = (shape: P[], seed: number, amt = 0.6): P[] => { const s = resample([...shape, shape[0]], Math.max(16, Math.round(ring(shape) / 5))).slice(0, -1), r = rng(seed); return s.map(([x, y]) => [x + (r() - 0.5) * amt, y + (r() - 0.5) * amt]); };
export const path = (c: Ctx, pts: P[], close = true) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (close) c.closePath(); };
export const rect = (w: number, h: number, cx = 0, cy = 0): P[] => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
// uneven dye, a few fibres and the odd inclusion, clipped to the sheet (raw ctx, current transform)
export const fibres = (c: Ctx, shape: P[], color: string, seed: number, density = 1, blotch = 0.22) => {
  const b = bounds(shape), r = rng(seed), area = (b.x1 - b.x0) * (b.y1 - b.y0);
  c.save(); path(c, shape); c.clip();
  for (let i = 0; i < 6; i++) { const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0), rx = 30 + r() * 110, g = c.createRadialGradient(x, y, 0, x, y, rx); const col = r() < 0.5 ? mix(color, "#ffffff", 0.25) : mix(color, "#6b4a22", 0.14); g.addColorStop(0, col); g.addColorStop(1, col + "00"); c.globalAlpha = blotch; c.fillStyle = g; c.fillRect(x - rx, y - rx, rx * 2, rx * 2); }
  c.lineCap = "round"; const n = Math.round((area / 1100) * density);
  for (let i = 0; i < n; i++) { const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0), a = r() * Math.PI, l = 2 + r() * 7; c.strokeStyle = r() < 0.6 ? mix(color, "#fffdf4", 0.5) : mix(color, "#3a2410", 0.28); c.globalAlpha = 0.18 + r() * 0.25; c.lineWidth = 0.4 + r() * 0.5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 2, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 2, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  c.restore(); c.globalAlpha = 1;
};
// a soft shadow of `shapes` on whatever is under them: drawn on its own layer and softened
export const shadowOf = (g: Gfx, shapes: P[][], off: P, blur: number, alpha: number, color = "#3b2a14", xf?: (c: Ctx) => void) => {
  g.group("plain", () => { const c = g.cur; c.save(); xf?.(c); c.fillStyle = color; for (const s of shapes) { path(c, s.map(([x, y]) => [x + off[0], y + off[1]] as P)); c.fill(); } c.restore(); shapes.forEach((s) => { const b = bounds(s); g.touch(b.x0 - 80, b.y0 - 80, b.x1 + 80, b.y1 + 80); }); }, { blur, alpha });
};

// ---------------------------------------------------------------- type
// Glyphs on a 4 x 6 cell, y down (after drafting.ts). l = straight polylines, c = curves.
type Glyph = { l?: P[][]; c?: P[][]; w?: number };
const O: P[] = [[1.3, 0.1], [0.2, 1.3], [0.2, 4.7], [1.3, 5.9], [2.7, 5.9], [3.8, 4.7], [3.8, 1.3], [2.7, 0.1], [1.3, 0.1]];
export const GLYPHS: Record<string, Glyph> = {
  A: { l: [[[0, 6], [2, 0], [4, 6]], [[0.8, 3.9], [3.2, 3.9]]] }, B: { l: [[[0, 0], [0, 6]]], c: [[[0, 0], [2.6, 0], [3.5, 0.8], [3.5, 2.2], [2.6, 3], [0, 3]], [[2.6, 3], [3.8, 3.8], [3.8, 5.1], [2.8, 6], [0, 6]]] },
  C: { c: [[[3.8, 1.2], [2.8, 0.1], [1.3, 0.1], [0.2, 1.3], [0.2, 4.7], [1.3, 5.9], [2.8, 5.9], [3.8, 4.8]]] }, D: { l: [[[0, 0], [0, 6]]], c: [[[0, 0], [2.3, 0], [3.8, 1.5], [3.8, 4.5], [2.3, 6], [0, 6]]] },
  E: { l: [[[3.6, 0], [0, 0], [0, 6], [3.7, 6]], [[0, 3], [2.8, 3]]] }, F: { l: [[[3.6, 0], [0, 0], [0, 6]], [[0, 3], [2.8, 3]]] },
  G: { c: [[[3.8, 1.2], [2.8, 0.1], [1.3, 0.1], [0.2, 1.3], [0.2, 4.7], [1.3, 5.9], [2.8, 5.9], [3.8, 4.8]]], l: [[[3.8, 4.9], [3.8, 3.2], [2.2, 3.2]]] },
  H: { l: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]] }, I: { l: [[[1, 0], [1, 6]]], w: 2 }, J: { c: [[[3.4, 0], [3.4, 4.8], [2.4, 5.9], [1.2, 5.9], [0.2, 4.8]]] },
  K: { l: [[[0, 0], [0, 6]], [[3.8, 0], [0, 3.7]], [[1.4, 2.5], [3.9, 6]]] }, L: { l: [[[0, 0], [0, 6], [3.6, 6]]] }, M: { l: [[[0, 6], [0, 0], [2.3, 3.8], [4.6, 0], [4.6, 6]]], w: 4.6 },
  N: { l: [[[0, 6], [0, 0], [4, 6], [4, 0]]] }, O: { c: [O] }, P: { l: [[[0, 0], [0, 6]]], c: [[[0, 0], [2.7, 0], [3.7, 0.9], [3.7, 2.4], [2.7, 3.3], [0, 3.3]]] },
  Q: { c: [O], l: [[[2.4, 4.2], [4.1, 6.3]]] }, R: { l: [[[0, 0], [0, 6]], [[2, 3.3], [3.9, 6]]], c: [[[0, 0], [2.7, 0], [3.7, 0.9], [3.7, 2.4], [2.7, 3.3], [0, 3.3]]] },
  S: { c: [[[3.7, 1], [2.7, 0.1], [1.2, 0.1], [0.3, 1], [0.3, 2.1], [1.2, 2.9], [2.8, 3.2], [3.7, 4], [3.7, 5], [2.8, 5.9], [1.2, 5.9], [0.2, 5]]] }, T: { l: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]] },
  U: { c: [[[0, 0], [0, 4.7], [1.2, 5.9], [2.8, 5.9], [4, 4.7], [4, 0]]] }, V: { l: [[[0, 0], [2, 6], [4, 0]]] }, W: { l: [[[0, 0], [1.2, 6], [2.5, 2], [3.8, 6], [5, 0]]], w: 5 },
  X: { l: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]] }, Y: { l: [[[0, 0], [2, 3.1], [4, 0]], [[2, 3.1], [2, 6]]] }, Z: { l: [[[0, 0], [4, 0], [0, 6], [4, 6]]] },
  "0": { c: [[[1.3, 0.1], [0.4, 1.2], [0.4, 4.8], [1.3, 5.9], [2.5, 5.9], [3.4, 4.8], [3.4, 1.2], [2.5, 0.1], [1.3, 0.1]]], w: 3.6 }, "1": { l: [[[0.6, 1.2], [1.8, 0], [1.8, 6]]], w: 2.6 },
  "2": { c: [[[0.3, 1.3], [1.1, 0.2], [2.7, 0.2], [3.5, 1.1], [3.5, 2.2], [0.3, 6]]], l: [[[0.3, 6], [3.7, 6]]], w: 3.7 }, "3": { c: [[[0.4, 0.9], [1.3, 0.1], [2.8, 0.1], [3.5, 1], [3.5, 2.1], [2.6, 3], [1.7, 3]], [[2.6, 3], [3.7, 3.8], [3.7, 5.1], [2.8, 5.9], [1.2, 5.9], [0.3, 5.1]]], w: 3.7 },
  "4": { l: [[[2.8, 6], [2.8, 0], [0.1, 4.3], [3.9, 4.3]]], w: 3.9 }, "5": { l: [[[3.5, 0], [0.7, 0], [0.4, 2.8]]], c: [[[0.4, 2.8], [2.5, 2.5], [3.6, 3.6], [3.6, 5], [2.7, 5.9], [1, 5.9], [0.2, 5.1]]], w: 3.7 },
  "6": { c: [[[3.2, 0.4], [1.5, 0.2], [0.4, 1.4], [0.3, 4.7], [1.2, 5.9], [2.6, 5.9], [3.5, 5], [3.5, 3.8], [2.6, 2.9], [1.2, 2.9], [0.3, 3.8]]], w: 3.7 }, "7": { l: [[[0.3, 0], [3.6, 0], [1.5, 6]]], w: 3.6 },
  "8": { c: [[[1.9, 0.1], [3, 0.4], [3.5, 1.3], [3.3, 2.2], [1.9, 3], [0.5, 2.2], [0.3, 1.3], [0.8, 0.4], [1.9, 0.1]], [[1.9, 3], [3.4, 3.7], [3.7, 4.6], [3.3, 5.5], [1.9, 5.9], [0.5, 5.5], [0.1, 4.6], [0.4, 3.7], [1.9, 3]]], w: 3.8 },
  "9": { c: [[[3.5, 2.5], [2.6, 3.2], [1.2, 3.2], [0.3, 2.3], [0.3, 1.1], [1.2, 0.1], [2.6, 0.1], [3.5, 1.1], [3.5, 4.6], [2.5, 5.8], [0.7, 5.8]]], w: 3.7 },
  "-": { l: [[[0.6, 3.2], [3, 3.2]]], w: 3.4 }, ".": { l: [[[0.7, 5.5], [0.9, 5.9]]], w: 1.8 }, ",": { l: [[[0.9, 5.4], [0.5, 6.8]]], w: 1.8 }, ":": { l: [[[0.7, 2], [0.9, 2.4]], [[0.7, 5.4], [0.9, 5.8]]], w: 1.8 }, "/": { l: [[[0.2, 6.4], [3.2, -0.2]]], w: 3.4 },
  "=": { l: [[[0.4, 2.3], [3.4, 2.3]], [[0.4, 4.1], [3.4, 4.1]]], w: 3.8 }, "~": { c: [[[0.2, 3.6], [0.9, 2.7], [1.7, 3.1], [2.4, 3.6], [3.1, 3.4], [3.7, 2.6]]], w: 3.9 },
  "°": { c: [[[1, -0.1], [0.3, 0.5], [0.4, 1.4], [1.1, 1.8], [1.8, 1.3], [1.8, 0.4], [1, -0.1]]], w: 2.4 }, "·": { l: [[[0.7, 3.0], [0.9, 3.35]]], w: 1.8 },
  "§": { c: [[[3.1, 0.7], [2.4, 0.05], [1.3, 0.1], [0.6, 0.8], [0.9, 1.7], [2.5, 2.4], [3.3, 3.3], [3.0, 4.2], [2.1, 4.5]], [[1.8, 1.55], [0.8, 2.1], [0.6, 3.0], [1.4, 3.7], [2.9, 4.4], [3.3, 5.2], [2.7, 5.9], [1.5, 5.95], [0.8, 5.3]]], w: 3.8 },
  "(": { c: [[[2, -0.4], [0.8, 1.6], [0.8, 4.6], [2, 6.6]]], w: 2.4 }, ")": { c: [[[0.4, -0.4], [1.6, 1.6], [1.6, 4.6], [0.4, 6.6]]], w: 2.4 },
  "'": { l: [[[0.9, -0.2], [0.7, 1.6]]], w: 1.8 }, "+": { l: [[[0.4, 3.2], [3.4, 3.2]], [[1.9, 1.7], [1.9, 4.7]]], w: 3.8 },
  " ": { w: 2.6 },
};
export type Face = { weight: number; slant?: number; wide?: number; serif?: number; outline?: string; cap?: CanvasLineCap; join?: CanvasLineJoin; mono?: number; track?: number };
const glyphOf = (ch: string) => GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS["-"];
export const advance = (ch: string, face: Face) => ((face.mono ?? glyphOf(ch).w ?? 4) * (face.wide ?? 1) + (face.track ?? 1.3));
export const measure = (text: string, cap: number, face: Face) => [...text].reduce((a, ch) => a + advance(ch, face), 0) * (cap / 6) - (face.track ?? 1.3) * (cap / 6);
// the pen paths of one glyph in cell units, serifs included, as stroke lists
const glyphStrokes = (ch: string, face: Face): P[][] => {
  const gl = glyphOf(ch), out: P[][] = [], sf = face.serif ?? 0;
  (gl.l ?? []).forEach((st) => {
    out.push(st);
    if (sf) [0, st.length - 1].forEach((e) => { const p = st[e], q = st[e === 0 ? 1 : st.length - 2]; if ((p[1] <= 0.05 || p[1] >= 5.95) && Math.abs(q[0] - p[0]) < Math.abs(q[1] - p[1]) * 0.8) out.push([[p[0] - sf, p[1]], [p[0] + sf, p[1]]]); });
  });
  (gl.c ?? []).forEach((st) => out.push(sample(st, false, 6)));
  return out;
};
// set one glyph at (x, y) = top-left of the cap height, in the current transform
export const glyph = (c: Ctx, ch: string, x: number, y: number, cap: number, face: Face, color: string, alpha = 1) => {
  const s = cap / 6, sl = face.slant ?? 0, wd = face.wide ?? 1, cx = face.mono ? ((face.mono - (glyphOf(ch).w ?? 4)) / 2) : 0;
  const T = ([px, py]: P): P => [x + ((px + cx) * wd + (6 - py) * sl) * s, y + py * s];
  const strokes = glyphStrokes(ch, face);
  c.lineCap = face.cap ?? "butt"; c.lineJoin = face.join ?? "miter"; c.miterLimit = 3; c.globalAlpha = alpha;
  const run = (w: number, col: string) => { c.lineWidth = w; c.strokeStyle = col; strokes.forEach((st) => { c.beginPath(); st.forEach((p, i) => { const q = T(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.stroke(); }); };
  if (face.outline) { run(face.weight * cap + cap * 0.14, color); run(face.weight * cap, face.outline); } else run(face.weight * cap, color);
  c.globalAlpha = 1;
};
export const TYPEWRITER: Face = { weight: 0.1, serif: 0.55, mono: 4.2, track: 0.9, cap: "butt", join: "round" };
// typed: each strike its own density and a hair off the line, the ribbon printing double faintly.
// `n` = how many characters have been struck (typing is one character at a time).
export const typed = (c: Ctx, text: string, x: number, y: number, cap: number, color: string, seed: number, n = Infinity) => {
  const r = rng(seed), s = cap / 6; let cx = x;
  [...text].forEach((ch, i) => { const dens = 0.72 + r() * 0.28, dy = (r() - 0.5) * cap * 0.06, dx = (r() - 0.5) * cap * 0.03; if (i < n && ch !== " ") { glyph(c, ch, cx + dx + 0.35, y + dy + 0.25, cap, TYPEWRITER, color, dens * 0.3); glyph(c, ch, cx + dx, y + dy, cap, TYPEWRITER, color, dens); } cx += advance(ch, TYPEWRITER) * s; });
};
// a hand-lettered line in a stroke pen (annotation): Gfx pen, so it tapers and wobbles like ink
export const handWrite = (g: Gfx, text: string, x: number, y: number, cap: number, color: string, seed: number, progress = 1, slant = 0.22, w = 2.2) => {
  const s = cap / 6, r = rng(seed * 17 + 3); let cx = x; const all: P[][] = [];
  [...text].forEach((ch) => { const k = 1 + (r() - 0.5) * 0.12, dy = (r() - 0.5) * cap * 0.1, T = ([px, py]: P): P => [cx + (px + (6 - py) * slant) * s * k, y + dy + py * s * k]; glyphStrokes(ch, {} as Face).forEach((st) => all.push(st.map(T))); cx += ((glyphOf(ch).w ?? 4) * 0.92 + 1.1) * s; });
  let left = progress >= 1 ? Infinity : progress * all.length;
  all.forEach((st, i) => { const p = left === Infinity ? 1 : clamp01(left); if (left !== Infinity) left -= 1; if (p > 0) g.pen(st, { w, color, seed: seed + i * 7, wobble: 0.45, boil: 0, taper: 0.5, opacity: 0.92, retrace: false, progress: p }); });
};

// ---------------------------------------------------------------- the burin
export type Cut = { pts: P[]; w: number[] };
// fill one tapering ribbon; the ends come to a point over `tip` samples, as a graver lifts
const ribbonFill = (c: Ctx, s: P[], w: number[], tip = 3) => {
  const n = s.length, L: P[] = [], R: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, e = Math.min(1, (i + 0.6) / tip, (n - i - 0.4) / tip), h = (w[i] * e) / 2;
    L.push([s[i][0] - (dy / l) * h, s[i][1] + (dx / l) * h]); R.push([s[i][0] + (dy / l) * h, s[i][1] - (dx / l) * h]);
  }
  c.beginPath(); L.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); for (let i = n - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); c.closePath(); c.fill();
};
// cut one line: runs where the width is above `min`, each tapering to a point. `upto` 0..1 cuts
// only the first part of it: the graver travelling.
export const burin = (c: Ctx, cut: Cut, min = 0.16, upto = 1) => {
  const m = upto >= 1 ? cut.pts.length : Math.max(0, Math.floor(cut.pts.length * upto)); let run: number[] = [];
  const flush = () => { if (run.length >= 2) ribbonFill(c, run.map((i) => cut.pts[i]), run.map((i) => cut.w[i])); run = []; };
  for (let i = 0; i < m; i++) { if (cut.w[i] > min) run.push(i); else flush(); }
  flush();
};
// draw cuts[0 .. p * cuts.length): whole lines, and the one in progress partly
export const engrave = (c: Ctx, cuts: Cut[], p: number, color: string, min = 0.16) => {
  c.fillStyle = color; const n = p >= 1 ? cuts.length : p * cuts.length, whole = Math.floor(n);
  for (let i = 0; i < whole; i++) burin(c, cuts[i], min);
  if (whole < cuts.length && n > whole) burin(c, cuts[whole], min, n - whole);
};
// a polyline resampled to ~`step` spacing: burin widths need evenly spaced samples
export const dense = (pts: P[], step = 2): P[] => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return resample(pts, Math.max(2, Math.round(L / step) + 1)); };
export const inPoly = (pts: P[], x: number, y: number) => { let k = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
export type Occluder = { pts: P[]; b: { x0: number; y0: number; x1: number; y1: number } };
export const occluder = (pts: P[]): Occluder => ({ pts, b: bounds(pts) });
export const hidden = (occ: Occluder[], x: number, y: number) => occ.some((o) => x >= o.b.x0 && x <= o.b.x1 && y >= o.b.y0 && y <= o.b.y1 && inPoly(o.pts, x, y));
// a cut from a centreline and a width function, zeroed where something in front covers it
export const cutLine = (pts: P[], width: (x: number, y: number, i: number, n: number) => number, occ: Occluder[] = [], step = 2): Cut => { const d = dense(pts, step); return { pts: d, w: d.map(([x, y], i) => (hidden(occ, x, y) ? 0 : width(x, y, i, d.length))) }; };
