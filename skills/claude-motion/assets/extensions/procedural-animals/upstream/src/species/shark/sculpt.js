// Shark sculpt: a dense chain of elliptic sections along the outline table (conical snout, spindle
// trunk, caudal keel), fleshy fins as tapered slabs (a thin full outline + thicker inner cores, so the
// fin is an airfoil that thins toward its trailing edge), a separately meshed lower jaw cut from the
// same sections with two complementary profile prisms (the lip line matches exactly), an upper-jaw
// (gum) pad that protrudes on the bite, rows of triangular teeth meshed as their own rigid parts,
// gill slits, nostrils and small lidless eyes in shallow sockets, claspers on males.
import { sharkGeo, pickParent, pecDir, finFrame } from './rig.js';
import { add, sub, mul, norm, cross, dot, lerp } from '../../core/math/vec.js';

// hero cell size relative to TL (regions.js)
export const CELL = 1 / 415;
// fin outlines squeezed to knife edges below the cell size (core build/finEdges.js): the meshed rim
// (~2 cells thick, rounded) scaled to 0.15 of its thickness at the outline, easing back over 3 cells,
// the round cap beyond the outline drawn in to 0.4 of its width
const SHARP = { edge: 0.15, band: 3, rim: 0.4 };

export function sculptShark(m, rig, params) {
  const G = sharkGeo(params);
  const V = G.V, TL = G.TL, J = rig.J, H = V.head, F = V.fins;
  const boneAt = (u) => (u < H.occ ? 'head' : pickParent(G, u));
  const cell = TL * CELL * (V.cellK || 1);

  // ---------------------------------------------------------------- body sections
  // Two ellipsoids per station (the teardrop cross-section of rig.js: a narrower upper ellipse and a
  // wide, flat lower one), long along the body and closely spaced, so the union has no scallops between
  // stations (they showed as rings in the highlights).
  // (short ellipsoids in the head, where the outline curves fast: long ones would stand proud of the
  // outline there, burying the eyes and swelling the snout)
  // (the spacing follows the length, so the number of overlapping sections, and with it the bulge of the
  // smooth unions over the outline, changes smoothly along the body: no step where the spacing changes)
  const rzAt = (u) => Math.min(0.045, u * 0.9 + 0.003, 0.012 + 0.033 * Math.max(0, Math.min(1, (u - 0.12) / 0.16)));
  const stepAt = (u) => Math.max(0.003, Math.min(0.0075, rzAt(u) / 4.5));
  const station = (u, part = 'body', extra = {}) => {
    const rz = rzAt(u) * TL;
    const hd = G.hd(u), hw = G.hw(u), yc = G.yc(u), tag = u < 0.24 ? 'head' : 'body';
    m.ell({ tag, bone: boneAt(u), c: [0, yc, G.z(u)], r: [hw * G.wk(u), hd, rz], k: 0.006 * TL, part, ...extra });
    return m.ell({ tag, bone: boneAt(u), c: [0, yc - G.LOW.dy * hd, G.z(u)], r: [hw, G.LOW.ry * hd, rz], k: 0.006 * TL, part, ...extra });
  };
  for (let u = 0.004; u <= G.pc + 0.0001; u += stepAt(u)) station(Math.min(u, G.pc));
  // the peduncle runs on into the caudal fin base
  {
    const u = G.pc + 0.02;
    m.ell({ tag: 'body', bone: 'caudal0', c: [0, G.yc(G.pc) + 0.004 * TL, G.z(u)], r: [G.hw(G.pc) * 0.75, G.hd(G.pc) * 0.95, 0.03 * TL], k: 0.006 * TL });
  }
  // caudal keel (white shark): a lateral ridge along the peduncle
  if (F.caudal.keel > 0) {
    for (let u = 0.69; u <= G.pc + 0.025; u += 0.012) {
      const f = Math.sin(Math.PI * Math.min(1, (u - 0.69) / (G.pc + 0.03 - 0.69)));
      m.ell({ tag: 'keel', bone: boneAt(Math.min(u, G.pc - 0.001)), c: [0, G.yc(Math.min(u, G.pc)), G.z(u)], r: [Math.min(G.hw(Math.min(u, G.pc)), G.hw(G.pc)) + F.caudal.keel * TL * f, G.hd(Math.min(u, G.pc)) * 0.22, 0.02 * TL], k: 0.008 * TL });
    }
  }

  // ---------------------------------------------------------------- head features
  const E = G.eye;
  // a slight swelling around the small eye
  for (const s of [1, -1]) m.sphere({ tag: 'orbit', bone: 'head', c: [s * (E.x - 0.6 * E.r), E.y, E.z], rad: E.r * 1.5, k: E.r * 1.2 });
  // upper jaw pad (gums behind the upper lip): protrudes forward / down with the upperJaw bone
  for (const s of [1, -1]) {
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const p = G.lipPoint(t * 0.92, s, 0.6, 0.016 * TL);
      m.sphere({ tag: 'gumU', bone: 'upperJaw', group: 'upperJaw', c: p, rad: 0.014 * TL * (1 - 0.3 * t), k: 0.009 * TL });
    }
  }

  // ---------------------------------------------------------------- median fins
  const dorsalBase = (u) => G.top(u) - 0.004 * TL;
  const medianFin = (d, name, sign, bone, k = 1) => {
    // poly in TL units: (du back from the origin, dv up (sign +1) / down (sign -1) from the outline)
    const u0 = d.u;
    const y0 = sign > 0 ? dorsalBase(u0) : G.bot(u0) + 0.004 * TL;
    const origin = [0, y0, G.z(u0)];
    const poly = d.poly.map(([a, b]) => [a * TL, b * TL * k]);
    // follow the body outline under the base: sink the base points by the local outline change
    for (const p of poly) {
      const uu = u0 + p[0] / TL;
      const yy = sign > 0 ? dorsalBase(Math.min(uu, G.pc)) : G.bot(Math.min(uu, G.pc)) + 0.004 * TL;
      p[1] = p[1] + (yy - y0);
    }
    const root = [poly[1][0] + 0.25 * (poly[poly.length - 2][0] - poly[1][0]), poly[1][1]];
    taperFin(m, { sharpen: SHARP, origin, u: [0, 0, -1], v: [0, 1, 0], poly, root, tRoot: d.thick * TL, tEdge: Math.max(2.1 * cell, d.thick * TL * 0.28), bone, tag: 'fin', name, k: d.thick * TL * 0.9 });
  };
  medianFin(F.dorsal1, 'dorsal1', 1, boneAt(F.dorsal1.u + 0.04), G.dorsalK);
  medianFin(F.dorsal2, 'dorsal2', 1, boneAt(F.dorsal2.u));
  medianFin(F.anal, 'anal', -1, boneAt(F.anal.u));

  // caudal fin: upper lobe along the caudal chain, lunate / heterocercal trailing edge, lower lobe
  {
    const C = F.caudal, Cg = G.caudal;
    const pit = Cg.pit;
    const hdp = G.hd(G.pc);
    const P2 = (b, h) => [b * TL, h * TL]; // (backward, up) in TL
    const ua = Cg.ua, la = Cg.la;
    const up = Cg.up, low = Cg.low;
    const pts = [];
    // root, upper leading edge (slightly convex), tip
    pts.push(P2(-0.035, hdp / TL * 0.6));
    const nU = 7;
    for (let i = 0; i <= nU; i++) {
      const f = i / nU;
      const l = up * f;
      const bow = 0.012 * Math.sin(Math.PI * f) * (1 - f * 0.3);
      pts.push(P2(Math.cos(ua) * l - Math.sin(ua) * bow + 0.0 * f, hdp / TL * 0.85 * (1 - f) + Math.sin(ua) * l + Math.cos(ua) * bow));
    }
    const tipU = [Math.cos(ua) * up, Math.sin(ua) * up];
    // trailing edge of the upper lobe: from the tip down to the fork (concave), with the terminal
    // lobe notch of carcharhinids just below the tip
    const fork = [C.fork * G.tailK + 0.02, -0.004];
    const tipL = [Math.cos(la) * low, Math.sin(la) * low];
    const edge = (a, b, n, sag, fromTip = 0) => {
      for (let i = 1; i <= n; i++) {
        const f = i / n;
        const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
        // sag toward the front (lunate concave trailing edge)
        const s = sag * Math.sin(Math.PI * f);
        let notch = 0;
        if (fromTip && C.notch > 0) notch = -C.notch * Math.exp(-Math.pow((f - 0.14) / 0.06, 2));
        pts.push(P2(x - s + notch, y));
      }
    };
    edge(tipU, fork, 9, 0.028 * G.tailK, 1);
    edge(fork, tipL, 6, 0.018 * G.tailK);
    // lower lobe leading edge back to the peduncle underside
    const nL = 5;
    for (let i = 1; i <= nL; i++) {
      const f = 1 - i / nL;
      const l = low * f;
      const bow = 0.01 * Math.sin(Math.PI * f);
      pts.push(P2(Math.cos(la) * l + Math.sin(-la) * bow * 0, -hdp / TL * 0.85 * (1 - f) + Math.sin(la) * l - Math.cos(la) * bow));
    }
    pts.push(P2(-0.035, -hdp / TL * 0.6));
    const origin = pit.slice();
    const root = [0.01 * TL, 0.02 * TL];
    taperFin(m, { sharpen: SHARP, origin, u: [0, 0, -1], v: [0, 1, 0], poly: pts, root, tRoot: C.thick * TL, tEdge: Math.max(2.1 * cell, C.thick * TL * 0.3), bone: 'caudal0', tag: 'fin', name: 'caudal', k: C.thick * TL, rootAlong: [Math.cos(ua), Math.sin(ua)], rootLen: up * TL * 0.85 });
  }

  // ---------------------------------------------------------------- paired fins (appendages)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const mir = (v) => [v[0] * s, v[1], v[2]];
    // pectoral: a thick, stiff hydrofoil
    {
      const P = F.pectoral;
      const b = J['pecBase' + S];
      const sp = mir(pecDir(P.abduct, P.droop));
      const fr = finFrame(sp);
      const span = P.len * G.finK * G.pecK * TL;
      const poly = P.poly.map(([a, c]) => [a * span, c * TL * G.finK]);
      taperFin(m, { sharpen: SHARP, origin: b, u: fr.s, v: fr.c, poly, root: [0.02 * span, 0.03 * TL], tRoot: P.thick * TL, tEdge: Math.max(2.1 * cell, P.thick * TL * 0.2), bone: 'pectoral' + S, group: 'pectoral' + S, tag: 'fin', name: 'pectoral' + S, k: P.thick * TL * 0.8, rootAlong: [1, 0.12], rootLen: span * 0.8 });
      // fleshy base blending into the flank
      m.ell({ tag: 'pecBase', bone: 'pectoral' + S, group: 'pectoral' + S, c: add(b, mul(fr.s, 0.02 * TL)), axis: fr.c, up: fr.n, r: [0.035 * TL, 0.0085 * TL, 0.045 * TL], k: 0.01 * TL });
    }
    // pelvic
    {
      const Q = F.pelvic;
      const b = J['pelBase' + S], tip = J['pelTip' + S];
      const sp = norm(sub(tip, b));
      const fr = finFrame(sp);
      const span = Q.len * G.finK * TL;
      const poly = Q.poly.map(([a, c]) => [a * span, c * TL]);
      taperFin(m, { sharpen: SHARP, origin: b, u: fr.s, v: fr.c, poly, root: [0.05 * span, 0.01 * TL], tRoot: Q.thick * TL, tEdge: Math.max(2.1 * cell, Q.thick * TL * 0.3), bone: 'pelvic' + S, group: 'pelvic' + S, tag: 'fin', name: 'pelvic' + S, k: Q.thick * TL * 0.8 });
      // claspers (males): calcified rods along the inner edge of the pelvic fins
      if (params.sex === 'male') {
        const cl = F.clasper * TL * (params.age === 'juvenile' ? 0.35 : 1);
        const a = add(b, [-s * 0.01 * TL, -0.004 * TL, -0.012 * TL]);
        const d = norm([s * 0.05, -0.18, -1]);
        m.cone({ tag: 'clasper', bone: 'pelvic' + S, group: 'pelvic' + S, a, b: add(a, mul(d, cl)), ra: 0.0065 * TL, rb: 0.0035 * TL, k: 0.004 * TL });
      }
    }
  }

  // ---------------------------------------------------------------- carvers (after every union)
  const Mo = H.mouth;
  const zS = G.z0 + 0.03 * TL, yLow = G.bot(Mo.uF) - 0.06 * TL;
  const lipPts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const u = Mo.uF + (Mo.uC - Mo.uF) * t;
    lipPts.push([G.z(u), G.lipY(u)]);
  }
  const zc = G.z(Mo.uC), zh = G.z(Mo.uC + 0.022), zb = G.z(Mo.uC + 0.06);
  const jd = Mo.jawDepth * TL;
  // lower-jaw region in the median plane (z, y): below the lip line, behind the front of the gape
  const zF = G.z(Mo.uF);
  const jawPoly = [[zF + 0.006 * TL, G.yF - 0.02 * TL], ...lipPts, [zh, G.yC - jd * 0.5], [zb, yLow], [zF + 0.006 * TL, yLow]];
  const gap = 0.0012 * TL;
  const wide = 0.6 * TL;
  const prism = (poly, o) => m.fin({ o: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], t: wide, poly, round: 0, ...o });
  prism(offsetPoly(jawPoly, gap * 0.5), { tag: 'mouthcut', bone: 'head', carve: true, k: 0.002 * TL });
  // mouth cavity behind the lips (seen when the jaws open)
  const cavU = Mo.uF + (Mo.uC - Mo.uF) * 0.55;
  const mouthCav = (o) => m.ell({ tag: 'mouth', bone: 'head', c: [0, G.lipY(cavU) + 0.004 * TL, G.z(cavU)], r: [G.hw(cavU) * 0.68, 0.014 * TL, (Mo.uC - Mo.uF) * 0.62 * TL], k: 0.003 * TL, carve: true, ...o });
  mouthCav({});
  // eye sockets
  for (const s of [1, -1]) m.sphere({ tag: 'eyesocket', bone: 'head', c: [s * E.x, E.y, E.z], rad: E.r * 1.05, k: E.r * 0.25, carve: true });
  // nostrils: oblique slits on the underside of the snout
  {
    const Nn = H.nostril;
    for (const s of [1, -1]) {
      const p = G.flank(Nn.u, Nn.e, s);
      m.ell({ tag: 'nostril', bone: 'head', c: p, axis: norm([s * 0.5, 0, 1]), up: [0, 1, 0], r: [0.002 * TL, 0.0018 * TL, 0.008 * TL], k: 0.002 * TL, carve: true });
    }
  }
  // gill slits: shallow grooves (the coat paints them dark)
  {
    const Gi = H.gills;
    for (const s of [1, -1]) {
      for (let i = 0; i < Gi.n; i++) {
        const u = Gi.u0 + ((Gi.u1 - Gi.u0) * i) / (Gi.n - 1);
        const len = 1 - 0.18 * Math.abs(i - (Gi.n - 1) * 0.6) / Gi.n;
        for (let j = 0; j <= 8; j++) {
          const e = Gi.e0 + ((Gi.e1 - Gi.e0) * len * j) / 8;
          const uu = u - Gi.lean * (e - Gi.e0);
          const p = G.flank(uu, e, s);
          const nx = norm([s * 1, e * 0.5, 0]);
          if (!params.gillGrooves) continue;
          m.ell({ tag: 'gillslit', bone: 'head', c: sub(p, mul(nx, 0.0016 * TL)), axis: [0, 0, 1], up: norm(cross([0, 0, 1], nx)), r: [0.0026 * TL, ((Gi.e1 - Gi.e0) / 8) * G.hd(uu) * 1.6, 0.0011 * TL], k: 0.002 * TL, carve: true });
        }
      }
    }
  }

  // ---------------------------------------------------------------- fin nicks (adults)
  // old bite and abrasion nicks in the trailing edge of the first dorsal (and the upper caudal lobe):
  // small seeded bites carved out of the edge
  for (const nk of params.nicks || []) {
    if (nk.fin === 'dorsal1') {
      // trailing edge of the first dorsal: from the apex down to the free rear tip
      const d = F.dorsal1, poly = d.poly, i0 = 5, i1 = poly.length - 2;
      const f = (i1 - i0) * nk.t, i = Math.min(i1 - 1, i0 + Math.floor(f)), fr = f - Math.floor(f);
      const a = poly[i][0] + (poly[i + 1][0] - poly[i][0]) * fr, b = (poly[i][1] + (poly[i + 1][1] - poly[i][1]) * fr) * G.dorsalK;
      const uu = d.u + a, y = dorsalBase(Math.min(uu, G.pc)) + b * TL;
      m.sphere({ tag: 'nick', bone: boneAt(d.u + 0.04), c: [0, y, G.z(uu) - nk.r * 0.35 * TL], rad: nk.r * TL, k: 0.0015 * TL, carve: true });
    } else {
      // upper caudal lobe trailing edge, behind the leading edge toward the tip
      const Cg = G.caudal, l = Cg.up * (0.55 + 0.35 * nk.t);
      const p = [0, Cg.pit[1] + Math.sin(Cg.ua) * l * TL, Cg.pit[2] - Math.cos(Cg.ua) * l * TL - 0.012 * TL];
      m.sphere({ tag: 'nick', bone: 'caudal' + V.caudalSegs, c: p, rad: nk.r * TL, k: 0.0015 * TL, carve: true });
    }
  }

  // ---------------------------------------------------------------- lower jaw (own surface, rigid)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  for (let u = 0.004; u <= Mo.uC + 0.075; u += stepAt(u)) station(u, 'jaw', { ...JW, tag: 'jaw' });
  const big = TL;
  const rest = [[zF + 0.006 * TL, G.yF - 0.02 * TL], [zS, G.yF - 0.02 * TL], [zS, G.yF + big], [zb - big, G.yF + big], [zb - big, yLow], [zb, yLow], [zh, G.yC - jd * 0.5], ...lipPts.slice().reverse()];
  prism(offsetPoly(rest, gap * 0.5), { ...JW, tag: 'jawcut', carve: true, k: 0.002 * TL });
  mouthCav({ ...JW });

  // ---------------------------------------------------------------- teeth (rigid parts)
  sculptTeeth(m, G, params);
  void lerp;
  return m;
}

// Rows of serrated triangular teeth: the upper row hangs from the upper jaw (part 'uteeth', rides
// the protruding upperJaw bone), the lower row stands on the lower jaw (part 'lteeth').
export function sculptTeeth(m, G, params) {
  const TL = G.TL, V = G.V;
  const white = params.variant === 'white';
  const nT = white ? 12 : 13;
  const h0 = (white ? 0.0105 : 0.0075) * TL * (params.age === 'juvenile' ? 0.8 : 1);
  for (const [part, bone, dir] of [['uteeth', 'upperJaw', -1], ['lteeth', 'jaw', 1]]) {
    for (const s of [1, -1]) {
      for (let i = 0; i < nT; i++) {
        const t = (i + 0.5) / nT;
        const upper = dir < 0;
        const p = G.lipPoint(t * 0.94, s, upper ? 0.86 : 0.8, upper ? 0.003 * TL : -0.004 * TL);
        const pn = G.lipPoint(Math.min(1, t * 0.94 + 0.02), s, upper ? 0.86 : 0.8);
        const tang = norm(sub(pn, p));
        // front teeth largest; white upper teeth broad triangles, lower narrower and pointed
        const h = h0 * (1 - 0.55 * t * t) * (upper ? 1 : 0.9);
        const w = h * (white ? (upper ? 0.85 : 0.6) : (upper ? 0.55 : 0.45));
        const axis = norm([0, dir, -0.12 - 0.25 * t * (upper ? 1 : -0.3)]);
        // tooth plane: tangent to the jaw arc; blade leans slightly inward (toward the midline)
        const inward = norm([-s * 0.25, 0, 0]);
        const v = norm(add(axis, mul(inward, 0.2)));
        const u = norm(sub(tang, mul(v, dot(tang, v))));
        const base = sub(p, mul(v, h * 0.35));
        const poly = [[-w * 0.5, 0], [-w * 0.42, h * 0.35], [-w * 0.12, h * 0.85], [0.02 * w, h], [w * 0.16, h * 0.84], [w * 0.44, h * 0.35], [w * 0.5, 0]];
        const th = Math.max(w * 0.34, 0.0022 * TL);
        const pr = m.fin({ o: base, u, v, t: th, poly, round: th * 0.45, bone, part, tag: 'tooth', k: 0.0006 * TL });
        pr.thin = false;
      }
    }
  }
}

// Tapered fleshy fin: a thin slab with the full outline plus thicker slabs of the outline shrunk
// toward `root` (optionally stretched along `rootAlong` so the leading edge / the caudal lobe's
// vertebral column stays thick), smoothly united: an airfoil thinning toward the trailing edge.
export function taperFin(m, o) {
  const { origin, u, v, poly, root, tRoot, tEdge, bone, group, tag, name, k } = o;
  // (most of the fin is close to the edge thickness: a thin blade with a thick root and leading edge,
  // not a uniformly fat paddle)
  // (three cores in big steps left grooves along the span, a rubbery look: six cores in
  // small steps give a smooth airfoil)
  const layers = [[1, tEdge]];
  for (let i = 1; i <= 6; i++) {
    const f = i / 6;
    layers.push([1 - 0.72 * f, tEdge + (tRoot - tEdge) * Math.pow(f, 1.2)]);
  }
  let first = null;
  for (const [sc, t] of layers) {
    const pts = poly.map(([a, b]) => {
      let da = a - root[0], db = b - root[1];
      if (o.rootAlong) {
        // shrink across the root line more than along it
        const ax = o.rootAlong, al = Math.hypot(ax[0], ax[1]);
        const ex = ax[0] / al, ey = ax[1] / al;
        const along = da * ex + db * ey, across = -da * ey + db * ex;
        const al2 = along * (sc + (1 - sc) * 0.55), ac2 = across * sc;
        da = al2 * ex - ac2 * ey; db = al2 * ey + ac2 * ex;
        return [root[0] + da, root[1] + db];
      }
      return [root[0] + da * sc, root[1] + db * sc];
    });
    const pr = m.fin({ o: origin, u, v, t, poly: pts, round: t * 0.5, bone, group, ...(o.part ? { part: o.part } : {}), tag: sc === 1 ? tag : 'finCore', k: sc === 1 ? k : t * 1.2 });
    pr.thin = sc === 1;
    // the outline slab's meshed rim squeezed to a knife edge (core build/finEdges.js): 0.15 of the
    // meshed thickness at the outline, full over ~3 cells inward
    if (sc === 1 && o.sharpen) pr.sharpen = o.sharpen;
    pr.finName = name;
    pr.fin2 = { origin: origin.slice(), u: norm(u), v: norm(sub(v, mul(norm(u), dot(v, norm(u))))), poly: poly.map((p) => p.slice()) };
    if (!first) first = pr;
  }
  return first;
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
