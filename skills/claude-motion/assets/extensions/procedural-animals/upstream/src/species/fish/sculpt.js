// Fish sculpt: a dense chain of elliptic cross-sections along the outline table, a separately meshed
// lower jaw (cut from the same sections with two complementary profile prisms, so the lip line
// matches exactly), gill covers with a free rear edge over a gill slit, lidless eyes seated in a
// shallow orbit, and every fin as a thin membrane slab (core/rig/swimmer.js sculptFin).
import { fishGeo, pickParent } from './rig.js';
import { sculptFin, fanRays, spineName } from '../../core/rig/swimmer.js';
import { add, sub, mul, norm, lerp } from '../../core/math/vec.js';

// hero cell size relative to SL (regions.js) and the fin membrane thickness derived from it
export const CELL = 1 / 300;
export const finThickness = (SL, V) => SL * CELL * (V?.cellK || 1) * 2.9;
// lip thickness in front of the buccal cavity (fraction of SL)
export const MOUTH_LIP = 0.022;
// the free (rear) edge of the gill cover: u (fraction of SL) at height e (-1 belly .. 1 back, fraction of
// the half depth); the gill cover plate below follows it, the coat paints the edge line along it
export const opEdgeU = (op, e) => op + 0.003 - 0.045 * Math.min(1.44, e * e);

export function sculptFish(m, rig, params) {
  const G = fishGeo(params);
  const V = G.V, SL = G.SL, J = rig.J, H = V.head, F = V.fins;
  const N = V.spineSegs;
  const boneAt = (u) => (u < H.occ ? 'head' : pickParent(G, u));
  const t = finThickness(SL, V);

  // ---------------------------------------------------------------- body sections
  const step = 0.018, rzMax = 0.05;
  const station = (u, part = 'body', extra = {}) => {
    const rz = Math.min(rzMax, u * 0.95 + 0.004) * SL;
    return m.ell({ tag: u < H.op ? 'head' : 'body', bone: boneAt(u), c: [0, G.yc(u), G.z(u)], r: [G.hw(u), G.hd(u), rz], k: 0.007 * SL, part, ...extra });
  };
  for (let u = 0.012; u <= 1.0001; u += step) station(Math.min(u, 1));
  // the caudal peduncle runs on into the fin base
  m.ell({ tag: 'body', bone: 'caudal0', c: [0, G.yc(1), G.z(1.025)], r: [G.hw(1) * 0.8, G.hd(1) * 0.92, 0.035 * SL], k: 0.008 * SL });

  // ---------------------------------------------------------------- head features
  // Eyes: no socket and no orbit rim. A fish's cornea bulges straight out of smooth head skin, so the
  // lidless eyeball (drawn by the eye renderer) simply stands out of the head surface: the depth test
  // draws the skin / cornea boundary as a clean circle at every tier. A socket carved around the ball
  // left a sub-cell gap that meshed into a jagged dark rim, and a hole at the eye's front corner.
  // gill covers: a plate on each cheek, slightly proud, free along its rear edge
  const op = H.op;
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const uc = op - 0.055;
    const c = G.flank(uc, 0.02, s);
    const nrm = norm([s, 0, 0.12]);
    m.ell({ tag: 'operculum', bone: 'operculum' + S, group: 'operculum' + S, c: sub(c, mul(nrm, 0.0205 * SL)), axis: [0, 0, 1], up: [0, 1, 0], r: [0.0225 * SL, G.hd(uc) * 0.78, 0.062 * SL], k: 0.014 * SL });
    if (H.earFlap) {
      // bluegill "ear": a black lobe at the top of the gill cover
      // a flat rounded lobe reaching back from the upper gill cover (about 0.08 SL long, 0.05 high)
      const ce = G.flank(op + 0.03, 0.2, s);
      m.ell({ tag: 'earflap', bone: 'operculum' + S, group: 'operculum' + S, c: sub(ce, [s * 0.0035 * SL, 0, 0]), axis: [0, 0, 1], up: [0, 1, 0], r: [0.0065 * SL, H.earFlap * 0.5 * SL, H.earFlap * 0.8 * SL], k: 0.004 * SL });
    }
  }
  // upper lip / premaxilla (protrudes when feeding)
  m.ell({ tag: 'lip', bone: 'upperJaw', group: 'upperJaw', c: [0, G.mouthY + 0.01 * SL, G.z(0.02)], r: [G.hw(0.03) * 0.95, 0.012 * SL, 0.022 * SL], k: 0.006 * SL });

  // ---------------------------------------------------------------- carvers (after every union)
  // mouth: the lower-jaw region, a profile prism in the median plane (z, y), cut out of the body
  const gape = H.mouth.gape, jd = H.mouth.jawDepth * SL;
  const zS = G.z0 + 0.03 * SL, yLow = -0.05 * SL;
  const zc = G.z(gape), zh = G.z(gape + 0.03), zb = G.z(gape + 0.075);
  const up = H.mouth.upturn * 0.012 * SL;
  const jawPoly = [[zS, G.mouthY + up], [(zS + zc) / 2, G.mouthY + up * 0.4], [zc, G.mouthY], [zh, G.mouthY - jd * 0.55], [zb, yLow], [zS, yLow]];
  const gap = 0.0013 * SL;
  const wide = 0.5 * SL;
  const prism = (poly, o) => m.fin({ o: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], t: wide, poly, round: 0, ...o });
  prism(offsetPoly(jawPoly, gap * 0.5), { tag: 'mouthcut', bone: 'head', carve: true, k: 0.004 * SL });
  // buccal cavity: it starts behind the lips (MOUTH_LIP of SL behind the snout), so a closed mouth
  // shows only the lip line and the dark cavity appears when the jaw drops. (Reaching through the
  // snout, it held the mouth open as a dark O at rest.)
  const uF = MOUTH_LIP, uB = gape + 0.035;
  const cavY = G.mouthY - 0.003 * SL;
  const mouthCav = (o) => m.ell({ tag: 'mouth', bone: 'head', c: [0, cavY, G.z((uF + uB) / 2)], r: [G.hw((uF + uB) / 2) * 0.55, Math.min(0.024 * SL, jd * 0.45), ((uB - uF) / 2) * SL], k: 0.003 * SL, carve: true, ...o });
  mouthCav({});
  // The gill slit is not carved: a sub-cell groove along the gill cover's edge meshed into a jagged
  // dark crack. The coat paints the edge as a soft shading line instead (coat.js opEdgeU).

  // ---------------------------------------------------------------- lower jaw (own surface, rigid)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  for (let u = 0.012; u <= gape + 0.1; u += step) station(u, 'jaw', { ...JW, tag: 'jaw' });
  // everything that is not lower jaw: the complement of the jaw prism
  const big = SL;
  const rest = [[zS, G.mouthY + up], [zS, G.mouthY + big], [zb - big, G.mouthY + big], [zb - big, yLow], [zb, yLow], [zh, G.mouthY - jd * 0.55], [zc, G.mouthY], [(zS + zc) / 2, G.mouthY + up * 0.4]];
  prism(offsetPoly(rest, gap * 0.5), { ...JW, tag: 'jawcut', carve: true, k: 0.004 * SL });
  mouthCav({ ...JW });

  // ---------------------------------------------------------------- median fins (membranes, x = 0 plane)
  const median = { origin: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], t, sink: 0.022 * SL };
  const dorsalBase = (u) => [G.z(u), G.yc(u) + G.hd(u) - 0.006 * SL];
  const ventralBase = (u) => [G.z(u), G.yc(u) - G.hd(u) + 0.006 * SL];
  const profileRays = (d, base, sign) => {
    const rays = [];
    for (let i = 0; i < d.n; i++) {
      const f = d.n === 1 ? 0 : i / (d.n - 1);
      const u = d.u0 + (d.u1 - d.u0) * f;
      const a = ((d.a0 + (d.a1 - d.a0) * f) * Math.PI) / 180;
      let L = d.len[0] + (d.len[1] - d.len[0]) * f;
      if (d.round) L *= 0.78 + 0.34 * Math.sin(Math.PI * Math.min(1, f * 1.15 + 0.08));
      if (d.spiny) L *= 1 - 0.18 * f * f;
      if (!d.round && !d.spiny) L *= 1 - 0.12 * Math.pow(f, 0.7) * (1 - f) * 2.5;
      const b = base(u);
      rays.push([b, [b[0] + Math.cos(a) * L * SL, b[1] + Math.sin(a) * L * SL * sign]]);
    }
    // close the fin back to the body behind the last ray
    return rays;
  };
  let fi = 0;
  for (const d of F.dorsal) {
    const rays = profileRays(d, dorsalBase, 1);
    sculptFin(m, { ...median, rays, bone: boneAt((d.u0 + d.u1) / 2), tag: 'fin', name: 'dorsal' + fi++, notch: d.notch || 0, k: t * 1.2 });
  }
  for (const d of F.anal) {
    // anal fin angles are given as absolute angles (below the axis)
    const rays = [];
    for (let i = 0; i < d.n; i++) {
      const f = i / (d.n - 1);
      const u = d.u0 + (d.u1 - d.u0) * f;
      const a = ((d.a0 + (d.a1 - d.a0) * f) * Math.PI) / 180;
      let L = d.len[0] + (d.len[1] - d.len[0]) * f;
      if (d.round) L *= 0.8 + 0.3 * Math.sin(Math.PI * Math.min(1, f * 1.1 + 0.1));
      const b = ventralBase(u);
      rays.push([b, [b[0] + Math.cos(a) * L * SL, b[1] + Math.sin(a) * L * SL]]);
    }
    sculptFin(m, { ...median, rays, bone: boneAt((d.u0 + d.u1) / 2), tag: 'fin', name: 'anal', k: t * 1.2 });
  }
  if (F.adipose) {
    const d = F.adipose, rays = [];
    for (let i = 0; i < 6; i++) {
      const f = i / 5, u = d.u0 + (d.u1 - d.u0) * f;
      const b = dorsalBase(u);
      const L = d.h * SL * (0.35 + 0.75 * Math.sin(Math.PI * Math.min(1, f * 0.9 + 0.1)));
      const a = ((100 + 60 * f) * Math.PI) / 180;
      rays.push([b, [b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L]]);
    }
    sculptFin(m, { ...median, t: 0.01 * SL, round: 0.004 * SL, rays, bone: boneAt(d.u0), tag: 'adipose', name: 'adipose', k: 0.006 * SL });
  }
  // caudal fin: rays fan from the hypural plate; fork > 0 shortens the middle rays (forked tail),
  // fork < 0 lengthens them (rounded tail)
  {
    const C = F.caudal;
    const h1 = G.hd(1), yb = G.yc(1), zb0 = G.z(1.0);
    const rays = [];
    for (let i = 0; i < C.n; i++) {
      const f = i / (C.n - 1);
      const e = 1 - 2 * f; // +1 upper lobe .. -1 lower lobe
      const a = Math.PI + (e * C.spread * Math.PI) / 180;
      const mid = 1 - Math.pow(Math.abs(e), C.lobe === 'pointed' ? 1.3 : 2.2);
      let L = G.tailLen * SL * (1 - C.fork * mid);
      if (C.lobe === 'rounded') L *= 1 - 0.1 * Math.pow(Math.abs(e), 4);
      const b = [zb0 + 0.012 * SL, yb + e * h1 * 0.78];
      rays.push([b, [b[0] + Math.cos(a) * L, b[1] - Math.sin(a) * L]]);
    }
    const bone = 'caudal0';
    sculptFin(m, { ...median, sink: 0.03 * SL, rays, bone, tag: 'fin', name: 'caudal', k: t * 1.5 });
  }

  // ---------------------------------------------------------------- paired fins (appendages)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    // pectoral: plane through the base line (pecBase -> pecUp) and the fin direction
    {
      const P = F.pectoral;
      const b = J['pecBase' + S], upJ = J['pecUp' + S], tip = J['pecTip' + S];
      const u = norm(sub(tip, b));
      const vb = sub(upJ, b);
      const v = norm(sub(vb, mul(u, vb[0] * u[0] + vb[1] * u[1] + vb[2] * u[2])));
      const bl = 0.036 * SL, L = P.len * G.finK * SL;
      const shape = P.shape;
      const rays = fanRays({
        base0: [-0.004 * SL, bl * 0.55], base1: [0.002 * SL, -bl * 0.45], n: P.n,
        angle0: shape === 'sickle' ? 12 : 15, angle1: -17,
        length: (f) => {
          if (shape === 'pointed') return L * (1.0 - 0.55 * Math.pow(f, 1.2)) * (0.8 + 0.2 * Math.min(1, f * 6));
          if (shape === 'sickle') return L * (1.0 - 0.78 * Math.pow(f, 0.8)) * (0.7 + 0.3 * Math.min(1, f * 8));
          return L * (0.72 + 0.3 * Math.sin(Math.PI * Math.min(1, f * 1.05 + 0.12)));
        },
      });
      // the right fin mirrors the left: flip the plane's v so the rays mirror too
      sculptFin(m, { origin: b, u, v: s > 0 ? v : v, rays, t, sink: 0.006 * SL, bone: 'pectoral' + S, group: 'pectoral' + S, tag: 'fin', name: 'pectoral' + S, k: t * 0.9 });
    }
    // pelvic
    {
      const Q = F.pelvic;
      const b = J['pelBase' + S], fr = J['pelFront' + S], tip = J['pelTip' + S];
      const u = norm(sub(tip, b));
      const vb = sub(fr, b);
      const v = norm(sub(vb, mul(u, vb[0] * u[0] + vb[1] * u[1] + vb[2] * u[2])));
      const bl = 0.026 * SL, L = Q.len * G.finK * SL;
      const rays = fanRays({
        base0: [0.002 * SL, bl * 0.5], base1: [-0.002 * SL, -bl * 0.5], n: Q.n, angle0: 18, angle1: -14,
        length: (f) => L * (1.0 - 0.45 * Math.pow(f, 1.1)) * (0.85 + 0.15 * Math.min(1, f * 5)),
      });
      sculptFin(m, { origin: b, u, v, rays, t, sink: 0.006 * SL, bone: 'pelvic' + S, group: 'pelvic' + S, tag: 'fin', name: 'pelvic' + S, k: t * 0.9 });
    }
  }
  void spineName; void lerp; void add; void N;
  return m;
}

// grows / shrinks a polygon outward by d (approximate: along the averaged edge normals)
function offsetPoly(poly, d) {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? 1 : -1;
  return poly.map((p, i) => {
    const a = poly[(i + n - 1) % n], b = poly[(i + 1) % n];
    const e1 = norm([p[0] - a[0], p[1] - a[1], 0]), e2 = norm([b[0] - p[0], b[1] - p[1], 0]);
    const n1 = [e1[1] * sgn, -e1[0] * sgn], n2 = [e2[1] * sgn, -e2[0] * sgn];
    const nn = norm([n1[0] + n2[0], n1[1] + n2[1], 0]);
    return [p[0] + nn[0] * d, p[1] + nn[1] * d];
  });
}
