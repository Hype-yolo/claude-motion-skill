// The stack of flight-feather cards seen in the forearm's plan: a height map of the top card above the
// wing plane, the highest over the wing's motion (folded, half open, spread and over-fanned). The covert
// shield on the forearm (sculpt.js coverts()) and the greater covert cards along its rim (coverts.js)
// are placed from it, so the coverts lie ON the stack (a small gap above its top card) in every pose and
// no flight feather comes out through them.
//
// Plan frame (the ulna's): x from the wrist toward the elbow, y toward the trailing edge, h along the
// wing's dorsal normal; mm, for this individual (not normalised by the wing's size).
import { wingFK, makeWingFrames, degs, featherFrame, makeFeatherFrame, resolveFeathers, extension, DEG } from '../../core/rig/bird.js';
import { vaneWidth } from '../../core/build/featherCards.js';
import { wingFor, feathersFor } from './motion.js';

const V = (o) => [o.x, o.y, o.z];
const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// wing states between folded (0) and spread (1, glide), the feather fan up to the engine's over-fan
export const STACK_STATES = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1, 1.2];

const cache = new Map();
/**
 * @returns { at(x, y) -> top card height (mm, max over the states) or -Infinity where no card lies,
 *            fold(x, y) -> the same, folded only, cell (mm) }
 */
export function wingStack(form = {}, states = STACK_STATES) {
  const key = JSON.stringify([form.wingK, form.priK, form.fwK, form.chick, form.up, states]);
  if (cache.has(key)) return cache.get(key);
  const W = wingFor(form), F = resolveFeathers(feathersFor(form)), cov = F.coverts;
  const L = { h: W.lengths[0], u: W.lengths[1], m: W.lengths[2] };
  const cell = 1, X0 = -40, Y0 = -70, NX = 320, NY = 160;
  const maxH = new Float32Array(NX * NY).fill(-Infinity), foldH = new Float32Array(NX * NY).fill(-Infinity);
  const ff = makeFeatherFrame();
  for (const e of states) {
    const eW = Math.min(1, e), cfg = Object.fromEntries(Object.keys(W.fold).map((k) => [k, W.fold[k] + (W.glide[k] - W.fold[k]) * eW]));
    const fr = wingFK(makeWingFrames(), 1, L, degs(cfg));
    const eH = Math.min(1.25, extension(cfg.wrist * DEG, W.fold.wrist * DEG, W.glide.wrist * DEG) + Math.max(0, e - 1));
    const eU = Math.min(1.2, extension(cfg.elbow * DEG, W.fold.elbow * DEG, W.glide.elbow * DEG) + Math.max(0, e - 1));
    const P0 = V(fr.wrist), dU = V(fr.dU), nU = V(fr.nU), tU = nrm(cross(nU, dU)), X = dU.map((x) => -x);
    const proj = (p) => { const q = [p[0] - P0[0], p[1] - P0[1], p[2] - P0[2]]; return [dot(q, X) * 1000, dot(q, tU) * 1000, dot(q, nU) * 1000]; };
    const P0o = { x: P0[0], y: P0[1], z: P0[2] };
    const raster = (f, o = {}) => {
      const A = V(ff.axis), N = V(ff.normal), Tv = nrm(cross(N, A));
      const fo = o.shape ? { ...f, ...o.shape } : f;
      const len = f.len * (o.lenK || 1), w = f.width * (o.widthK || 1);
      const root = add(add(V(ff.root), N, o.lift || 0), A, o.shift || 0), arch = fo.arch ?? 0.12;
      // the card's top layer on a (t, c) grid
      const nt = 24, nc = 6, G = [];
      for (let i = 0; i <= nt; i++) {
        const t = i / nt, [wo, wi] = vaneWidth(fo, Math.min(t, 0.999), w), cu = (fo.curve || 0) * len * t * t, dr = (fo.droop || 0) * len * t * t;
        const row = [];
        for (let j = 0; j <= nc; j++) {
          const c = -1 + 2 * j / nc, ww = c < 0 ? wo : wi;
          let p = add(root, A, t * len);
          p = add(p, Tv, cu + c * ww);
          p = add(p, N, -dr - Math.abs(c) * ww * arch + 0.00025);
          row.push(proj(p));
        }
        G.push(row);
      }
      for (let i = 0; i < nt; i++) for (let j = 0; j < nc; j++) {
        const a = G[i][j], b = G[i + 1][j], c = G[i + 1][j + 1], d = G[i][j + 1];
        tri(a, b, c); tri(a, c, d);
      }
    };
    const tri = (a, b, c) => {
      const x0 = Math.floor((Math.min(a[0], b[0], c[0]) - X0) / cell), x1 = Math.ceil((Math.max(a[0], b[0], c[0]) - X0) / cell);
      const y0 = Math.floor((Math.min(a[1], b[1], c[1]) - Y0) / cell), y1 = Math.ceil((Math.max(a[1], b[1], c[1]) - Y0) / cell);
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-9) return;
      for (let iy = Math.max(0, y0); iy <= Math.min(NY - 1, y1); iy++) for (let ix = Math.max(0, x0); ix <= Math.min(NX - 1, x1); ix++) {
        const px = X0 + ix * cell, py = Y0 + iy * cell;
        const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den;
        const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den;
        const l3 = 1 - l1 - l2;
        // (a cell touched by the triangle's edge counts: the outline is conservative by ~half a cell)
        if (l1 < -0.08 || l2 < -0.08 || l3 < -0.08) continue;
        const h = l1 * a[2] + l2 * b[2] + l3 * c[2], k = iy * NX + ix;
        if (h > maxH[k]) maxH[k] = h;
        if (e === 0 && h > foldH[k]) foldH[k] = h;
      }
    };
    for (const f of F.primaries) {
      featherFrame(ff, P0o, fr.dM, fr.nM, L.m, 1, f, f.fold + (f.spread - f.fold) * eH, false);
      raster(f);
      if (!f.cov?.skip) raster(f, { lenK: cov.primary * (1 - 0.25 * f.i / Math.max(1, f.n - 1)), widthK: 1.05, lift: 0.0022, shift: -0.004, ...(f.cov || {}), shape: { emarg: 0, tipRound: 0.6, outer: 0.45, curve: 0.02, ...(f.cov?.shape || {}) } });
    }
    for (const f of F.secondaries) {
      featherFrame(ff, P0o, fr.dU, fr.nU, L.u, 1, f, f.fold + (f.spread - f.fold) * eU, true);
      raster(f);
      if (!f.cov?.skip) raster(f, { lenK: cov.secondary, widthK: 1.15, lift: 0.0028, shift: -0.006, ...(f.cov || {}), shape: { tipRound: 0.65, outer: 0.45, curve: 0.02, ...(f.cov?.shape || {}) } });
    }
  }
  const look = (A) => (x, y) => {
    const ix = Math.round((x - X0) / cell), iy = Math.round((y - Y0) / cell);
    if (ix < 0 || iy < 0 || ix >= NX || iy >= NY) return -Infinity;
    return A[iy * NX + ix];
  };
  // the highest card within r mm of (x, y) (a footprint's clearance)
  const near = (A) => (x, y, r = 1) => {
    let m = -Infinity;
    const ix0 = Math.round((x - X0) / cell), iy0 = Math.round((y - Y0) / cell), R = Math.ceil(r / cell);
    for (let iy = iy0 - R; iy <= iy0 + R; iy++) for (let ix = ix0 - R; ix <= ix0 + R; ix++) {
      if (ix < 0 || iy < 0 || ix >= NX || iy >= NY) continue;
      if ((ix - ix0) ** 2 + (iy - iy0) ** 2 > R * R) continue;
      m = Math.max(m, A[iy * NX + ix]);
    }
    return m;
  };
  const out = { at: look(maxH), fold: look(foldH), near: near(maxH), cell };
  cache.set(key, out);
  return out;
}

// point in polygon (plan)
export function insidePoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
