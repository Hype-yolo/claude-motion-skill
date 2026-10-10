// The Bell Founder · tiny 2-D rig for carved characters
// A part = closed outline (spline control points in its own local space) + a pivot + hatch settings
// + optional feature cuts (open splines, carved white or left black). Hatching is generated once in
// local space and cached, so a part keeps its carving while it moves (no line boil).
import * as WC from './engine/index.js';

const cache = new Map();
export function part(key, def) {
  if (cache.has(key)) return cache.get(key);
  const outline = def.poly || WC.spline(def.cp, def.step ?? 4, true);
  const S = def.solid ? null : WC.shape([outline], {
    light: def.light || WC.light(.6, -.55, .58), R: def.R ?? 34, amb: def.amb ?? 0, k: def.k ?? 1.1, sp: def.sp ?? 6,
    lo: def.lo ?? .36, hi: def.hi ?? .9, dir: def.dir, a0: def.a0 ?? 0, depth: def.depth ?? 24, halo: def.halo ?? 4, white: def.white,
    tone: def.tone, seg: def.seg || [26, 90], gap: def.gap || [2, 6], seed: def.seed ?? 1, res: def.res ?? 1.5, kind: def.kind, gamma: def.gamma, jit: def.jit ?? .1,
  });
  const feats = (def.feats || []).map((f, i) => {
    if (f.dot) { const [x, y, rx, ry, a = 0] = f.dot; return { poly: WC.ellipse(x, y, rx, ry, 18, a), col: f.white ? '#fff' : '#000' }; }
    const pts = f.pts ? f.pts : WC.spline(f.cp, 2);
    const w = f.w ?? 3;
    const st = f.one ? [WC.mkStroke(pts, pts.map((_, j) => w * (f.taper ? Math.sin(Math.PI * Math.min(.999, (j + .5) / pts.length)) ** .5 : 1)), { kind: f.kind || 'v', seed: i * 13 + 5 })]
      : WC.cutAlong(pts, { w, kind: f.kind || 'v', seg: f.seg || [30, 120], gap: f.gap || [1, 3], seed: i * 13 + 5, jw: .15 });
    return { st, col: (f.black || (def.white && !f.cut)) ? '#000' : '#fff' };
  });
  const P = { outline, S, feats, def };
  cache.set(key, P);
  return P;
}
export function drawPart(g, P, t = 1e9, { fill = true } = {}) {
  if (P.S) P.S.draw(g, t, { fill });
  else if (fill) { WC.drawStrokes(g, WC.cutAlong(WC.offsetPoly(P.outline, P.def.halo * .5 || 2), { closed: true, w: P.def.halo || 4, seg: [80, 200], gap: [0, 2], seed: 3 }), { t }); WC.fillPoly(g, [P.outline], P.def.white ? '#fff' : '#000'); }
  if (P.def.outline) { P.ol = P.ol || WC.cutAlong(WC.offsetPoly(P.outline, -P.def.outline * .45), { closed: true, w: P.def.outline, kind: 'k', seg: [60, 200], gap: [0, 1], seed: 9, jw: .2 }); WC.drawStrokes(g, P.ol, { t, color: '#000' }); }
  for (const f of P.feats) { if (f.poly) WC.fillPoly(g, [f.poly], f.col); else WC.drawStrokes(g, f.st, { t, color: f.col }); }
}

// affine helpers (canvas order a,b,c,d,e,f)
export const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
export const T = (x, y) => [1, 0, 0, 1, x, y];
export const R = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
export const S = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
export const about = (x, y, a) => mul(T(x, y), mul(R(a), T(-x, -y)));
export function put(g, M, fn) { g.save(); g.transform(...M); fn(); g.restore(); }
export const ap = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
