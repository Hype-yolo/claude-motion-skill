// Mid-century Cartoon engine (1950s limited animation, UPA / educational-film lineage).
// The look in four rules:
//   1. colour and line are two separate "cels": every fill is printed a few px off its ink line,
//      and the offset re-jitters on twos (12 fps) so the picture breathes like a hand-registered cel;
//   2. flat colour with a light dry-brush / print tooth, no gradients inside a shape;
//   3. thin ink line with pressure and deliberate breaks (the line never fully closes);
//   4. backgrounds are abstract colour planes, starbursts and atomic sparkles, never a full room.
// Every function takes plain coordinates in the current ctx transform.

export const PAL = {
  paper: '#F4EAD5', paperD: '#E6D8BC', paperDD: '#D4C29F',
  ink: '#2B2420', inkSoft: '#4A3F38',
  coral: '#E4613F', coralD: '#B8452B', coralL: '#F0917A',
  mustard: '#E8B43A', mustardD: '#C08A1E', mustardL: '#F3D37F',
  teal: '#3FA7A0', tealD: '#257A74', tealDD: '#1B5753', tealL: '#8ACFC6',
  blue: '#7F9CC0', blueD: '#5B789E', blueL: '#B5C8DE',
  pink: '#F0B4A8', pinkD: '#D98F82',
  avocado: '#A7AE5B', avocadoD: '#7E8538', avocadoL: '#CBD08E',
  plum: '#6E4A6B', brown: '#7B4B2E', brownL: '#A8704A', kraft: '#C9955D', kraftD: '#A2713F', kraftL: '#DDB47F',
  skin: '#F2C7A0', skinD: '#DDA37C', hair: '#3A2621', white: '#FBF6EA', chrome: '#C9CFCB', chromeD: '#8E9894',
};

// ---------- deterministic randomness ----------
export function rng(seed) { let s = seed | 0 || 1; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const hash = (x, y = 0, z = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); };
export function noise(seed = 0) {
  const g = (ix, iy) => hash(ix, iy, seed);
  const n = (x, y = 0) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (g(ix, iy) * (1 - u) + g(ix + 1, iy) * u) * (1 - v) + (g(ix, iy + 1) * (1 - u) + g(ix + 1, iy + 1) * u) * v; };
  n.fbm = (x, y, o = 4) => { let a = 0, w = 0.5, f = 1, s = 0; for (let i = 0; i < o; i++) { a += w * n(x * f, y * f); s += w; w *= 0.5; f *= 2; } return a / s; };
  return n;
}
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const eo = t => 1 - Math.pow(1 - clamp(t), 3);
export const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const back = (t, s = 1.7) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
export const TAU = Math.PI * 2;
// limited animation: hold every drawing for two frames (12 fps)
export const twos = (t, fps = 12) => Math.floor(t * fps + 1e-6) / fps;

// ---------- the register (colour cel vs ink cel) ----------
// base offset of the colour cel in px; jitter re-rolls on twos.
export const REG = { dx: 6, dy: 4, jit: 1.6, on: true };
let CLOCK = 0;
export function setClock(t) { CLOCK = t; }
export function reg(seed = 0, k = 1) {
  if (!REG.on) return [0, 0];
  const f = Math.floor(CLOCK * 12 + 1e-6);
  return [(REG.dx + (hash(f, seed, 1) - 0.5) * 2 * REG.jit) * k, (REG.dy + (hash(f, seed, 2) - 0.5) * 2 * REG.jit) * k];
}

// ---------- geometry ----------
export function spline(pts, closed = true, n = 8) {
  const out = [], N = pts.length, get = i => closed ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))];
  const segs = closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  if (!closed) out.push(pts[N - 1]);
  return out;
}
export const ellipse = (cx, cy, rx, ry, n = 48, a0 = 0, a1 = TAU, rot = 0) => {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
  return out;
};
export const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
export function rrect(x, y, w, h, r, n = 5) {
  r = Math.min(r, w / 2, h / 2); const out = [];
  const c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= n; i++) { const a = a0 + Math.PI / 2 * i / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
export const move = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
export const xform = (pts, ox, oy, a = 0, s = 1, sy = s) => { const c = Math.cos(a), si = Math.sin(a); return pts.map(([x, y]) => [ox + c * x * s - si * y * sy, oy + si * x * s + c * y * sy]); };
export function path(ctx, pts, closed = true) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (closed) ctx.closePath(); }
export function bbox(pts) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; }
export function plen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
// first fraction u (0..1) of an open polyline, by length
export function subpath(pts, u) {
  if (u >= 1) return pts; if (u <= 0) return [pts[0]];
  const L = plen(pts) * u, out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= L) { const k = (L - acc) / (d || 1); out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]); break; }
    acc += d; out.push(pts[i]);
  }
  return out;
}
export function pointAt(pts, u) { const s = subpath(pts, u); const a = s[s.length - 1], b = s[Math.max(0, s.length - 2)]; return { x: a[0], y: a[1], a: Math.atan2(a[1] - b[1], a[0] - b[0]) }; }

// ---------- textures (built once, seeded) ----------
let TEX = null;
function mkc(S) { const c = new OffscreenCanvas(S, S); return [c, c.getContext('2d')]; }
export function textures() {
  if (TEX) return TEX;
  const R = rng(4848), N = noise(48), S = 512;
  // dry-brush tooth: short horizontal-ish flecks (the paint dragged across a cel)
  const [dk, g1] = mkc(S);
  for (let i = 0; i < 3600; i++) {
    const x = R() * S, y = R() * S, l = 2 + R() * 9, a = (R() - 0.5) * 0.35;
    g1.strokeStyle = `rgba(40,25,15,${0.05 + R() * 0.16})`; g1.lineWidth = 0.6 + R() * 1.6;
    g1.beginPath(); g1.moveTo(x, y); g1.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g1.stroke();
  }
  // print holes: paper showing through thin ink
  const [lt, g2] = mkc(S);
  for (let i = 0; i < 2600; i++) {
    const x = R() * S, y = R() * S, r = 0.4 + R() * 1.3 * (N.fbm(x / 50, y / 50) + 0.2);
    g2.fillStyle = `rgba(255,250,236,${0.1 + R() * 0.32})`; g2.beginPath(); g2.ellipse(x, y, r * 1.6, r, 0.1, 0, TAU); g2.fill();
  }
  // paper: soft mottling + fibres
  const [pf, g3] = mkc(S);
  const img = g3.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = (N.fbm(x / 26, y / 26, 3) - 0.5) * 46 + (hash(x, y, 7) - 0.5) * 26, i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 128 + v; img.data[i + 3] = 255;
  }
  g3.putImageData(img, 0, 0);
  for (let i = 0; i < 220; i++) {
    const x = R() * S, y = R() * S, a = R() * TAU, l = 6 + R() * 16;
    g3.strokeStyle = R() < 0.5 ? 'rgba(90,80,60,0.3)' : 'rgba(255,255,245,0.4)'; g3.lineWidth = 0.7;
    g3.beginPath(); g3.moveTo(x, y); g3.quadraticCurveTo(x + Math.cos(a + 0.4) * l * 0.5, y + Math.sin(a + 0.4) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g3.stroke();
  }
  TEX = { dk, lt, pf };
  return TEX;
}
const patCache = new WeakMap();
export function pat(ctx, name) {
  let m = patCache.get(ctx); if (!m) { m = {}; patCache.set(ctx, m); }
  if (!m[name]) m[name] = ctx.createPattern(textures()[name], 'repeat');
  return m[name];
}
// tooth inside the current shape; k 0..1
export function grainIn(ctx, pts, k = 0.35) {
  if (k <= 0) return;
  const [x0, y0, x1, y1] = bbox(pts);
  ctx.save(); path(ctx, pts); ctx.clip();
  ctx.globalAlpha *= 0.6 * k; ctx.fillStyle = pat(ctx, 'dk'); ctx.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  ctx.globalAlpha /= 0.6; ctx.globalAlpha *= 0.9; ctx.fillStyle = pat(ctx, 'lt'); ctx.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  ctx.restore();
}

// ---------- ink line: a pressure ribbon with breaks ----------
export function ink(ctx, pts, w, o = {}) {
  const { color = PAL.ink, closed = false, wob = 0.4, seed = 1, breaks = 0, taper = true, alpha = 1, upto = 1 } = o;
  let P = closed ? [...pts, pts[0], pts[1] || pts[0]] : pts;
  if (upto < 1) P = subpath(P, upto);
  if (P.length < 2 || w <= 0) return;
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = L[L.length - 1]; if (total <= 0.5) return;
  const step = Math.max(1.5, Math.min(w * 0.7, total / 600)), n = Math.max(2, Math.ceil(total / step));
  const S = []; let j = 0;
  for (let i = 0; i <= n; i++) {
    const d = total * i / n; while (j < L.length - 2 && L[j + 1] < d) j++;
    const u = (d - L[j]) / Math.max(1e-6, L[j + 1] - L[j]); S.push([P[j][0] + (P[j + 1][0] - P[j][0]) * u, P[j][1] + (P[j + 1][1] - P[j][1]) * u, d]);
  }
  const N = noise(seed * 13 + 5);
  const wid = d => {
    let k = 1 + wob * (N(d / (w * 16), 0.5) - 0.5) * 2;
    if (taper && !closed) { const e = Math.min(d, total - d) / (w * 4); k *= Math.min(1, 0.3 + e * 0.7); }
    return Math.max(0.08, k) * w * 0.5;
  };
  const runs = []; let cur = [];
  for (let i = 0; i < S.length; i++) {
    const gap = breaks > 0 && N(S[i][2] / (w * 11), 7.3) < breaks * 0.5;
    if (gap) { if (cur.length > 1) runs.push(cur); cur = []; } else cur.push(S[i]);
  }
  if (cur.length > 1) runs.push(cur);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  for (const run of runs) {
    const left = [], right = [];
    for (let i = 0; i < run.length; i++) {
      const a = run[Math.max(0, i - 1)], b = run[Math.min(run.length - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const r = wid(run[i][2]); left.push([run[i][0] + nx * r, run[i][1] + ny * r]); right.push([run[i][0] - nx * r, run[i][1] - ny * r]);
    }
    ctx.beginPath(); left.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath(); ctx.fill();
    // round caps
    const r0 = wid(run[0][2]), r1 = wid(run[run.length - 1][2]);
    ctx.beginPath(); ctx.arc(run[0][0], run[0][1], r0, 0, TAU); ctx.arc(run[run.length - 1][0], run[run.length - 1][1], r1, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- the core call: a shape in this style ----------
// o.fill       colour (null = line only)
// o.line       ink width (0 = none)       o.lineColor  default ink
// o.off        [dx,dy] override of the register offset; o.reg = seed for the jitter; o.regK scale
// o.grain      tooth 0..1                  o.breaks     gaps in the line 0..1
// o.shade      [{pts,color,alpha}] flat shade planes clipped to the fill
export function shape(ctx, pts, o = {}) {
  const { fill = null, line = 0, lineColor = PAL.ink, grain = 0.35, breaks = 0.18, seed = 1, wob = 0.4, regK = 1, alpha = 1 } = o;
  const off = o.off || reg(o.reg ?? seed, regK);
  ctx.save(); ctx.globalAlpha *= alpha;
  if (fill) {
    const P = move(pts, off[0], off[1]);
    ctx.save(); path(ctx, P); ctx.fillStyle = fill; ctx.fill();
    if (o.shade) { ctx.clip(); for (const s of [].concat(o.shade)) { path(ctx, move(s.pts, off[0], off[1])); ctx.fillStyle = s.color; ctx.globalAlpha = alpha * (s.alpha ?? 1); ctx.fill(); ctx.globalAlpha = alpha; } }
    ctx.restore();
    grainIn(ctx, P, grain);
  }
  if (line > 0) ink(ctx, pts, line, { closed: true, color: lineColor, breaks, seed, wob });
  ctx.restore();
}
// a flat plane with no line at all (backgrounds)
export function plane(ctx, pts, fill, o = {}) { shape(ctx, pts, { fill, line: 0, grain: o.grain ?? 0.25, off: o.off || [0, 0], alpha: o.alpha ?? 1 }); }

// ---------- mid-century ornaments ----------
// starburst: n points, inner ratio, rotation. Used behind reveals and as the "clean!" sparkle.
export function starPts(cx, cy, r, n = 8, inner = 0.42, rot = 0, sq = 1) {
  const out = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n - Math.PI / 2, rr = i % 2 ? r * inner : r; out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sq]); }
  return out;
}
export function star(ctx, cx, cy, r, o = {}) {
  const { n = 8, inner = 0.42, rot = 0, fill = PAL.white, line = 0, seed = 7 } = o;
  shape(ctx, starPts(cx, cy, r, n, inner, rot), { fill, line, seed, grain: o.grain ?? 0.2, off: o.off, breaks: 0.3, alpha: o.alpha ?? 1 });
}
// the four-point atomic sparkle (thin concave star)
export function sparkle(ctx, cx, cy, r, o = {}) {
  const { rot = 0, fill = PAL.white, alpha = 1 } = o;
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = rot + i * Math.PI / 2 - Math.PI / 2, b = a + Math.PI / 4;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    pts.push([cx + Math.cos(b) * r * 0.14, cy + Math.sin(b) * r * 0.14]);
  }
  ctx.save(); ctx.globalAlpha *= alpha; path(ctx, pts); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
}
// sunburst rays: alternating wedges from a centre (the 1950s advertising "glory")
export function rays(ctx, cx, cy, n, r, fill, o = {}) {
  const { rot = 0, k = 1, alpha = 1, r0 = 0 } = o;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = fill; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot + i * TAU / n, a1 = a0 + TAU / n * 0.5 * k;
    ctx.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0); ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r); ctx.lineTo(cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0); ctx.closePath();
  }
  ctx.fill(); ctx.restore();
}
// "atom": three elliptical orbits + nucleus (line-only ornament)
export function atom(ctx, cx, cy, r, o = {}) {
  const { color = PAL.ink, w = 3, rot = 0, nucleus = PAL.coral } = o;
  for (let i = 0; i < 3; i++) ink(ctx, ellipse(cx, cy, r, r * 0.34, 40, 0, TAU, rot + i * Math.PI / 3), w, { closed: true, color, breaks: 0.25, seed: 30 + i });
  shape(ctx, ellipse(cx, cy, r * 0.16, r * 0.16, 16), { fill: nucleus, line: 0, grain: 0 });
}
// boomerang / kidney outlines (furniture and background motifs)
export const boomerang = (cx, cy, s, rot = 0) => xform(spline([[-1, -0.25], [-0.2, -0.05], [0.15, -0.55], [0.95, -0.2], [0.35, 0.1], [0.1, 0.45], [-0.85, 0.35]], true, 10), cx, cy, rot, s);
export const kidney = (cx, cy, s, rot = 0) => xform(spline([[-1, -0.1], [-0.6, -0.55], [0.1, -0.45], [0.35, -0.15], [0.8, -0.45], [1.05, 0.05], [0.6, 0.5], [-0.4, 0.5]], true, 10), cx, cy, rot, s);
// a fat dotted/dashed line (the diagram arrow shaft, the cleaning path)
export function dashed(ctx, pts, w, dash, gap, phase = 0, color = PAL.ink, upto = 1) {
  const P = upto < 1 ? subpath(pts, upto) : pts, L = plen(P); if (L < 1) return;
  const period = dash + gap; let d = -((phase % period) + period) % period;
  while (d < L) { const a = Math.max(0, d), b = Math.min(L, d + dash); if (b > a) { const s0 = subpath(P, a / L), s1 = subpath(P, b / L); ink(ctx, [s0[s0.length - 1], ...s1.slice(s0.length)], w, { color, taper: false, wob: 0.15, seed: Math.floor(d) }); } d += period; }
}

// ---------- the moving manual arrow ----------
// A 1950s instruction-sheet arrow: curved ink shaft that draws itself on, a fat solid head, and a
// bounce on the beat. from/to in px; bend = sideways bow as a fraction of the length.
//   u    0..1 draw-on progress      bob  0..1 bounce phase (use beat phase)
export function arrow(ctx, from, to, o = {}) {
  const { u = 1, bob = 0, bend = 0.25, w = 7, color = PAL.ink, fill = PAL.coral, head = 34, dashedShaft = false, seed = 11 } = o;
  const [x0, y0] = from, [x1, y1] = to, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L, mx = (x0 + x1) / 2 + nx * L * bend, my = (y0 + y1) / 2 + ny * L * bend;
  const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; pts.push([a * x0 + b * mx + c * x1, a * y0 + b * my + c * y1]); }
  const k = 1 - Math.abs(Math.sin(bob * Math.PI)) * 0.18; // bob pulls the head back along the shaft
  const shaft = subpath(pts, u * k);
  const tip = shaft[shaft.length - 1], pre = subpath(pts, Math.max(0, u * k - 0.06)), p2 = pre[pre.length - 1];
  const ang = Math.atan2(tip[1] - p2[1], tip[0] - p2[0]);
  if (dashedShaft) dashed(ctx, subpath(shaft, 0.92), w, w * 2.4, w * 1.6, 0, color); else ink(ctx, subpath(shaft, 0.94), w, { color, seed, taper: true });
  if (u > 0.15) {
    const hs = head * ss(seg(u, 0.15, 0.5));
    const H = xform([[0, 0], [-hs * 1.1, -hs * 0.62], [-hs * 0.78, 0], [-hs * 1.1, hs * 0.62]], tip[0] + Math.cos(ang) * hs * 0.25, tip[1] + Math.sin(ang) * hs * 0.25, ang);
    shape(ctx, H, { fill, line: 3.5, seed: seed + 1, grain: 0.15, breaks: 0 });
  }
}

// ---------- lettering ----------
// Two-plate type: a colour plate printed off-register under an ink (or cream) plate.
export function text(ctx, str, x, y, o = {}) {
  const { font = '64px Jost', fill = PAL.ink, plate = null, align = 'left', base = 'alphabetic', track = 0, alpha = 1, seed = 3, rot = 0, maxW = 0 } = o;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font; ctx.textAlign = align; ctx.textBaseline = base;
  if (track) ctx.letterSpacing = track + 'px';
  ctx.translate(x, y); ctx.rotate(rot);
  if (maxW) { const w = ctx.measureText(str).width; if (w > maxW) ctx.scale(maxW / w, 1); }
  if (plate) { const [ox, oy] = o.off || reg(seed, 0.8); ctx.fillStyle = plate; ctx.fillText(str, ox, oy); }
  ctx.fillStyle = fill; ctx.fillText(str, 0, 0);
  ctx.restore();
}
export function measure(ctx, str, font, track = 0) { ctx.save(); ctx.font = font; if (track) ctx.letterSpacing = track + 'px'; const w = ctx.measureText(str).width; ctx.restore(); return w; }
// word-wrap into lines no wider than maxW; shrinks the font (down to minPx) before wrapping past maxLines
export function fit(ctx, str, fam, px, maxW, maxLines = 2, minPx = px * 0.6) {
  for (let p = px; p >= minPx; p -= 2) {
    const font = fam.replace('{px}', p), words = String(str).split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (measure(ctx, t, font) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines && lines.every(l => measure(ctx, l, font) <= maxW)) return { font, px: p, lines };
  }
  const font = fam.replace('{px}', minPx); return { font, px: minPx, lines: [String(str)] };
}

// ---------- finishing ----------
export function paperFinish(ctx, W, H, k = 1) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.26 * k; ctx.fillStyle = pat(ctx, 'pf'); ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.14 * k;
  const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.45, W / 2, H * 0.5, H * 1.05); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(110,80,50,1)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
