// Woodcut engine · public API
// Draw anything as a relief print: shapes become black wood with white knife cuts that follow the form,
// light is literally carved (bright = wide cuts), and the result is printed by the WebGL compositor.
//
//   const P = WC.makePrinter();                 // once
//   const S = WC.shape([[..poly..]], { light: WC.light(.5,-.7,.6), sp: 8, halo: 6 });
//   mask: fill black (uncut block), S.draw(g, t) ... ; color plate: WC.plate(c, poly)
//   const out = P.render(maskCanvas, colorCanvas, { mode: 'print' });   // → canvas
import { clamp, mulberry } from '/core/lib.js';
import { mkStroke, spline, resample, drawStrokes, strokePath, progOf, chip, xform } from './knife.js';
import { Region, hatch, lines, reliefTone, light, dirAngle, dirRadial, dirRing, dirContour } from './hatch.js';
import { makePrinter } from './print.js';
import { woodcutFilter } from './filter.js';
export { mkStroke, spline, resample, drawStrokes, strokePath, progOf, chip, xform, Region, hatch, lines, reliefTone, light, dirAngle, dirRadial, dirRing, dirContour, makePrinter, woodcutFilter };

export const INK = '#111111', PAPER = '#EFE8D8', COPPER = '#C8502A', WOOD = '#D8C29C';

export function canvas(w = 1920, h = 1080) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function pathOf(g, P, close = true) { g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]); if (close) g.closePath(); }
export function fillPoly(g, polys, col = '#000', rule = 'evenodd') { g.fillStyle = col; g.beginPath(); for (const P of polys) pathOf(g, P); g.fill(rule); }

// offset a closed polygon along its vertex normals (d > 0 = outward for counter-clockwise… we auto-detect)
export function offsetPoly(P, d) {
  let A = 0; for (let i = 0; i < P.length; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length]; A += x0 * y1 - x1 * y0; }
  const sgn = A > 0 ? -1 : 1, n = P.length;
  return P.map((p, i) => { const a = P[(i - 1 + n) % n], b = P[(i + 1) % n]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; return [p[0] + ty * d * sgn, p[1] - tx * d * sgn]; });
}

// break a (closed or open) path into hand-cut knife strokes. o: {w, kind, seg:[a,b], gap:[a,b], seed, jw, reveal:{t0,t1,speed}}
export function cutAlong(P, o = {}) {
  const rnd = mulberry(o.seed ?? 3), pts = resample(o.closed ? [...P, P[0]] : P, o.step ?? 3);
  const seg = o.seg || [40, 140], gap = o.gap || [1, 5], w = o.w ?? 3, jw = o.jw ?? .25;
  const out = []; let cur = [], cw = [], acc = 0, target = seg[0] + rnd() * (seg[1] - seg[0]), skip = 0, total = 0, startLen = 0;
  const L = []; let s = 0; for (let i = 0; i < pts.length; i++) { if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(s); }
  const TL = s || 1;
  const flush = () => {
    if (cur.length >= 2) {
      const st = mkStroke(cur, cw, { kind: o.kind || 'v', seed: rnd() * 1000, chip: o.chip ?? .14 });
      if (o.reveal) { const r = o.reveal; st.t0 = r.t0 + (startLen / TL) * (r.t1 - r.t0); st.dur = Math.max(.03, acc / (r.speed ?? 900)); }
      out.push(st);
    }
    cur = []; cw = []; acc = 0; target = seg[0] + rnd() * (seg[1] - seg[0]);
  };
  const wf = typeof w === 'function' ? w : () => w;
  const wv = 1 + (rnd() - .5) * jw * 2;
  for (let i = 0; i < pts.length; i++) {
    const step = i ? L[i] - L[i - 1] : 0;
    if (skip > 0) { skip -= step; continue; }
    if (!cur.length) startLen = L[i];
    cur.push(pts[i]); cw.push(wf(L[i] / TL, pts[i]) * wv); acc += step;
    if (acc > target) { flush(); skip = gap[0] + rnd() * (gap[1] - gap[0]); }
  }
  flush();
  return out;
}

// snow / stipple: short stab cuts. pts [[x,y,r?],...]
export function flecks(pts, o = {}) {
  const rnd = mulberry(o.seed ?? 11), r0 = o.r ?? 3, ang = o.angle ?? 1.2;
  return pts.map(([x, y, r = r0]) => {
    const a = ang + (rnd() - .5) * .9, L = r * (1.4 + rnd() * .9);
    const s = mkStroke([[x - Math.cos(a) * L * .5, y - Math.sin(a) * L * .5], [x, y], [x + Math.cos(a) * L * .5, y + Math.sin(a) * L * .5]], r * 1.25, { kind: 'stab', seed: rnd() * 1000, chip: .2 });
    s.x = x; s.y = y; s.r = r; return s;
  });
}

// radial burst of carved rays (light made of cuts). o: {n, r0, r1:[a,b], w, jit, seed, a0, a1, kind, reveal:{t0,t1}}
export function rays(cx, cy, o = {}) {
  const rnd = mulberry(o.seed ?? 5), n = o.n ?? 40, a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2, out = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i + .5 + (rnd() - .5) * (o.jit ?? .6)) / n;
    const r0 = (o.r0 ?? 40) * (.8 + rnd() * .5), r1 = (o.r1 ? o.r1[0] + rnd() * (o.r1[1] - o.r1[0]) : 600);
    const wv = (o.w ?? 14) * (.6 + rnd() * .8), bend = (rnd() - .5) * (o.bend ?? .05);
    const pts = []; const N = Math.max(4, Math.ceil((r1 - r0) / 8));
    for (let k = 0; k <= N; k++) { const u = k / N, r = r0 + (r1 - r0) * u, aa = a + bend * u * u; pts.push([cx + Math.cos(aa) * r, cy + Math.sin(aa) * r]); }
    const ws = pts.map((_, k) => wv * (1 - .75 * (k / N)));
    const s = mkStroke(pts, ws, { kind: o.kind || 'u', seed: rnd() * 1000, chip: .18 });
    if (o.reveal) { s.t0 = o.reveal.t0 + rnd() * (o.reveal.jit ?? .15) * (o.reveal.t1 - o.reveal.t0); s.dur = (o.reveal.t1 - o.reveal.t0) * (.55 + rnd() * .45); }
    out.push(s);
  }
  return out;
}

// A carved SHAPE: black silhouette + white halo around it + form-following hatching lit by `light`.
// polys: [[x,y],...][]   o: { light, R, amb, sp, wmax, lo, hi, dir:'contour'|angle|fn, a0, halo, haloW, inset,
//                              kind, seg, seed, tone(x,y)→ override, reveal:{t0,t1,key,speed}, res, fill }
export function shape(polys, o = {}) {
  const reg = new Region(polys, { res: o.res ?? 2 });
  const L = o.light || light(.55, -.65, .55);
  const tone = o.tone ? o.tone(reg) : reliefTone(reg, L, { R: o.R ?? 50, amb: o.amb ?? .05, k: o.k ?? 1.05, rim: o.rim ?? 0 });
  let dir = o.dir;
  if (dir === undefined || dir === 'contour') dir = dirContour(reg, o.a0 ?? 0, o.depth ?? 36);
  else if (typeof dir === 'number') dir = dirAngle(dir);
  const ins = o.inset ?? 0;
  const regIn = ins ? { ...reg, bbox: reg.bbox, inside: (x, y) => reg.inside(x, y) && reg.dist(x, y) > ins } : reg;
  const white = !!o.white, htone = white ? (x, y) => 1 - tone(x, y) : tone;
  const strokes = hatch(regIn, { dir, tone: htone, sp: o.sp ?? 8, wmax: o.wmax, lo: o.lo ?? .3, hi: o.hi ?? .95, gamma: o.gamma ?? 1, kind: o.kind || 'v', seg: o.seg, gap: o.gap, seed: o.seed ?? 1, reveal: o.reveal, jit: o.jit ?? .12, chip: o.chip });
  const halo = o.halo ? polys.flatMap((P, i) => cutAlong(offsetPoly(P, o.halo * .5 + (o.haloOff ?? 0)), { closed: true, w: o.halo, kind: 'v', seg: o.haloSeg || [60, 200], gap: [0, 2], seed: (o.seed ?? 1) + i * 7, reveal: o.reveal ? { t0: o.reveal.t0, t1: o.reveal.t0 + (o.reveal.t1 - o.reveal.t0) * .5, speed: 1400 } : null })) : [];
  return {
    reg, strokes, halo, polys, tone,
    // draw on mask g at time t. fill: true = paint the silhouette black first (covers what is behind)
    draw(g, t = 1e9, opts = {}) {
      if (halo.length) drawStrokes(g, halo, { t, color: '#fff' });
      if (o.fill !== false && opts.fill !== false) fillPoly(g, polys, white ? '#fff' : '#000');
      drawStrokes(g, strokes, { t, color: white ? '#000' : '#fff', tips: opts.tips });
    }
  };
}

// colour plate: paint polygons (or any path fn) on the colour canvas with density a
export function plate(c, polys, a = 1) { c.fillStyle = `rgba(0,0,0,${a})`; c.beginPath(); if (typeof polys === 'function') polys(c); else for (const P of polys) pathOf(c, P); c.fill('evenodd'); }

// ellipse / helper polygons
export function ellipse(cx, cy, rx, ry, n = 64, a0 = 0) { const out = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return out; }
export function rect(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
