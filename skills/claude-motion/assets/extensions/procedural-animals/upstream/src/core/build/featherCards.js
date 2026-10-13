// Flight-feather cards: real feather geometry (primaries, secondaries, rectrices and their coverts)
// appended to the base surface. Each card is a thin two-sided vane (top and bottom layer, rachis
// down the middle, asymmetric outer / inner vane, rounded or emarginated tip, curved rachis) rigidly
// skinned to its own feather bone, so the engine can fan, fold, twist and splay every feather while
// the base draw call renders it (one draw, shadows and the crowd tier included). Material id 10
// (vane) is shaded in core/render/coatMaterial.js from surf = [gloss, iridescence, across, along]:
// across -1 (outer vane edge) .. 0 (rachis) .. 1 (inner vane edge), along 0 (root) .. 1 (tip).
// colour(kind, i, side, t, c, layer) -> { rgb, gloss, irid, bar? }: bar { rgb, period (m) } draws bars
// across the vane in the shader (patternColor = [rgb, -bar count]; opt-in, e.g. barred poultry).
//
// Species usage (surfaces hook, see core/build/pipeline.js):
//   surfaces: (ctx) => featherCards({ ...ctx, wing: motion.wing, feathers: motion.feathers,
//                                    tail: motion.tail, colour: (kind, i, side, t, c) => ({ rgb, gloss, irid }) })
import { featherJoints, DEG } from '../rig/bird.js';
import { MAT } from './coatKit.js';

const V = (x, y, z) => [x, y, z];
const addS = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mirror = (p) => [-p[0], p[1], p[2]];

// vane half-widths at t (0 root .. 1 tip): [outer, inner] (also used by the bird engine's ground checks)
// (f.base0: the vane's width at the root as a fraction of its full width, default 0.3)
export function vaneWidth(f, t, w) {
  const b0 = f.base0 ?? 0.3;
  const base = b0 + (1 - b0) * smooth(0.0, 0.16, t);
  const tr = f.tipRound;
  let tip = 1;
  if (t > 1 - tr) { const x = (t - (1 - tr)) / tr; tip = Math.sqrt(Math.max(0, 1 - x * x)); }
  let wo = w * f.outer * base * tip, wi = w * (1 - f.outer) * base * tip;
  if (f.emarg > 0) {
    // emarginated primaries: both vanes step in beyond the notch, leaving a narrow "finger"
    const k = smooth(0.5, 0.64, t) * f.emarg;
    wi *= 1 - 0.62 * k; wo *= 1 - 0.3 * k;
  }
  return [wo, Math.max(wi, 0.0006)];
}
function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/**
 * @param ctx { rig, params, Q, wing, feathers, tail, colour, thickness? }
 * @returns surfaces block { nV, pos, nrm, index, skinIndex, skinWeight, comb, tint, pattern, mark, furLen, patternColor, surf }
 */
export function featherCards(ctx) {
  const { rig, Q, wing, feathers, tail } = ctx;
  const colour = ctx.colour || (() => ({ rgb: [0.02, 0.02, 0.02], gloss: 0.5, irid: 0 }));
  // the bind layout (the rig built the joints from the same call)
  const Jl = {};
  for (const k of ['shoulderL', 'tailBase', 'tailTip']) Jl[k] = rig.J[k];
  const lay = featherJoints(Jl, wing, feathers, tail);
  const res = Q?.res ?? 1;
  const nA = res <= 1.35 ? 9 : res <= 2.1 ? 6 : res <= 3.1 ? 4 : 3;
  const th = ctx.thickness ?? 0.0005;
  const coverts = res < 4 || ctx.crowdCoverts;
  const P = [], N = [], C = [], T = [], S = [], SI = [], I = [], X = [];
  const PCL = []; // vane bars: [vertex, rgb, -count]
  const cov = lay.F.coverts;

  const card = (bone, side, fr, f, opts) => {
    const b = rig.BONE[bone];
    if (!b) throw new Error('featherCards: missing bone ' + bone);
    const s = side;
    const m = (p) => (s > 0 ? p : mirror(p));
    const L = f.len * (opts.lenK || 1), W = f.width * (opts.widthK || 1);
    const A = m(V(fr.axis.x, fr.axis.y, fr.axis.z)), Nn = m(V(fr.normal.x, fr.normal.y, fr.normal.z));
    // inner vane side (+across): s * (N x A)
    const Tv = norm(cross(Nn, A)).map((x) => x * s);
    const root0 = m(V(fr.root.x, fr.root.y, fr.root.z));
    const root = addS(addS(root0, Nn, opts.lift || 0), A, opts.shift || 0);
    const fo = opts.shape ? { ...f, ...opts.shape } : f;
    // vane arch: the edges sit this fraction of the half-width below the rachis (feather spec `arch`,
    // default 0.12; a flatter vane lets overlapping neighbours stack on smaller lift steps)
    const arch = fo.arch ?? 0.12;
    const v0 = P.length / 3;
    const ts = [];
    for (let j = 0; j <= nA; j++) { const u = j / nA; ts.push(0.5 - 0.5 * Math.cos(Math.PI * u)); }
    const pt = (t, c) => {
      const [wo, wi] = vaneWidth(fo, t, W);
      const w = c < 0 ? wo : wi;
      if (fo.arc) {
        // rachis bent along a circular arc of total angle `arc` (rad) toward the inner vane, length
        // kept (long display feathers: a rooster's sickles); the vane width turns with the rachis
        const a = fo.arc * t, R = L / fo.arc, ca = Math.cos(a), sa = Math.sin(a);
        let p = addS(root, A, R * sa);
        p = addS(p, Tv, R * (1 - ca));
        p = addS(p, A, -sa * c * w);
        p = addS(p, Tv, ca * c * w);
        return addS(p, Nn, -fo.droop * L * t * t - Math.abs(c) * w * arch);
      }
      // curved rachis (toward the inner vane, drooping), vanes slightly convex (edges lower)
      const along = t * L, curve = fo.curve * L * t * t, droop = fo.droop * L * t * t;
      let p = addS(root, A, along);
      p = addS(p, Tv, curve + c * w);
      p = addS(p, Nn, -droop - Math.abs(c) * w * arch);
      return p;
    };
    const cols = [-1, 0, 1];
    for (const layer of [1, -1]) {
      for (let j = 0; j <= nA; j++) {
        const t = ts[j];
        for (const c of cols) {
          const p = addS(pt(t, c), Nn, layer * th * 0.5 * (1 - 0.6 * t));
          // surface tangents for the normal
          const e = 1e-3;
          const pa = pt(Math.min(1, t + e), c), pb = pt(Math.max(0, t - e), c);
          const pc = pt(t, Math.min(1, c + 0.05)), pd = pt(t, Math.max(-1, c - 0.05));
          const dt = [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]], dc = [pc[0] - pd[0], pc[1] - pd[1], pc[2] - pd[2]];
          let n = norm(cross(dt, dc));
          const sgn = (n[0] * Nn[0] + n[1] * Nn[1] + n[2] * Nn[2]) < 0 ? -1 : 1;
          n = n.map((x) => x * sgn * layer);
          if (!Number.isFinite(n[0])) n = Nn.map((x) => x * layer);
          P.push(...p); N.push(...n);
          C.push(...norm(dt));
          const col = colour(opts.kind, f.i, s, t, c, layer);
          T.push(col.rgb[0], col.rgb[1], col.rgb[2], MAT.VANE);
          // opt-in bars across the vane (colour() returns bar: { rgb, period (m) }): shader-drawn
          if (col.bar) PCL.push([P.length / 3 - 1, col.bar.rgb, -L / col.bar.period]);
          S.push(col.gloss ?? 0.5, col.irid ?? 0, c, t);
          const wv = vaneWidth(fo, t, W);
          X.push(c * (c < 0 ? wv[0] : wv[1]) * s);
          SI.push(b.index, 0, 0, 0);
        }
      }
      const base = v0 + (layer > 0 ? 0 : (nA + 1) * 3);
      for (let j = 0; j < nA; j++) {
        for (let k = 0; k < 2; k++) {
          const a = base + j * 3 + k, bq = a + 1, c2 = a + 3, d = a + 4;
          // top layer faces +N; the bottom layer is wound the other way
          if ((layer > 0) === (s > 0)) I.push(a, c2, bq, bq, c2, d);
          else I.push(a, bq, c2, bq, d, c2);
        }
      }
    }
    // winding sanity: flip this card's triangles if their geometric normal disagrees with the layer normal
    fixWinding(P, N, I, v0);
  };

  // per-feather covert overrides (spec field `cov`: { lift, shift, lenK, widthK, shape }, merged over
  // the defaults below; opt-in: a species can restack its coverts, e.g. reverse their overlap order;
  // `cov: { skip: true }` drops the covert card, e.g. where the species sculpts the coverts as skin)
  const covOpts = (f, o) => (f.cov ? { ...o, ...f.cov, shape: { ...o.shape, ...(f.cov.shape || {}) } } : o);
  const wEH = lay.frames;
  for (const side of [1, -1]) {
    const S2 = side > 0 ? 'L' : 'R';
    for (const fr of wEH.pri) {
      const f = fr.f;
      card(`pri${f.i + 1}${S2}`, side, fr, f, { kind: 'primary' });
      if (coverts && !f.cov?.skip) card(`pri${f.i + 1}${S2}`, side, fr, f, covOpts(f, { kind: 'primaryCovert', lenK: cov.primary * (1 - 0.25 * f.i / Math.max(1, f.n - 1)), widthK: 1.05, lift: 0.0022, shift: -0.004, shape: { emarg: 0, tipRound: 0.6, outer: 0.45, curve: 0.02 } }));
    }
    for (const fr of wEH.sec) {
      const f = fr.f;
      card(`sec${f.i + 1}${S2}`, side, fr, f, { kind: 'secondary' });
      if (coverts && !f.cov?.skip) card(`sec${f.i + 1}${S2}`, side, fr, f, covOpts(f, { kind: 'secondaryCovert', lenK: cov.secondary, widthK: 1.15, lift: 0.0028, shift: -0.006, shape: { tipRound: 0.65, outer: 0.45, curve: 0.02 } }));
    }
    for (const fr of wEH.rec) {
      const f = fr.f;
      card(`rec${f.i + 1}${S2}`, side, fr, f, { kind: 'rectrix' });
      if (coverts && f.i < 4 && !f.cov?.skip) card(`rec${f.i + 1}${S2}`, side, fr, f, covOpts(f, { kind: 'tailCovert', lenK: cov.tail * (1 - 0.1 * f.i), widthK: 1.2, lift: 0.0025, shift: -0.012, shape: { tipRound: 0.7, outer: 0.5 } }));
    }
  }
  const nV = P.length / 3;
  const out = {
    nV,
    pos: Float32Array.from(P), nrm: Float32Array.from(N), index: Uint32Array.from(I),
    skinIndex: Uint16Array.from(SI), skinWeight: new Float32Array(nV * 4),
    comb: Float32Array.from(C), tint: Float32Array.from(T), surf: Float32Array.from(S),
    pattern: Float32Array.from(X), mark: new Float32Array(nV).fill(1), furLen: new Float32Array(nV),
    patternColor: new Float32Array(nV * 4),
  };
  for (const [v, rgb, n] of PCL) out.patternColor.set([rgb[0], rgb[1], rgb[2], n], v * 4);
  for (let v = 0; v < nV; v++) out.skinWeight[v * 4] = 1;
  return out;
}

function fixWinding(P, N, I, v0) {
  // triangles are appended per card; check the first triangle referencing v0's range
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (a < v0) continue;
    const e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]];
    const e2 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
    const g = cross(e1, e2);
    const d = g[0] * N[a * 3] + g[1] * N[a * 3 + 1] + g[2] * N[a * 3 + 2];
    if (d < 0) { I[t + 1] = c; I[t + 2] = b; }
  }
}

export { DEG };
