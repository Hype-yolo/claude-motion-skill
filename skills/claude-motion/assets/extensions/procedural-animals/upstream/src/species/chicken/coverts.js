// The folded wing's coverts (photos side1 / side2 / three-quarter1 / rear_three-quarter: the coverts are
// a layered surface of shingles continuous with the body, lying ON the secondaries; the flight
// feathers show below and behind them). From the top:
//   - the shield (sculpt.js coverts()): skin on the forearm's dorsal side, shaded with the body's
//     contour-feather shingles (lesser and median coverts); its top is a plane fitted just above the
//     flight-feather stack under it (wingStack.js: the highest card over the wing's motion), so it is
//     no thicker than the stack it covers, and it reaches down below the wing plane (the feathers'
//     roots are inside skin); the lid continues it over its upper rear corner and the back (the inner
//     vanes and the primaries leave its rim there);
//   - the greater coverts: rounded feather cards rigid on the forearm (this file), with the body's down,
//     reaching into the shield and lying on its top, draped over its rim down onto the secondaries
//     (above the stack in every wing pose), so the rim is a row of soft shingle ends rather than a skin
//     edge over a dark gap, and the flight feathers come out from under them;
//   - the flight feathers (core/build/featherCards.js), their greater covert cards dropped (motion.js
//     feathersFor: cov.skip); the tertials restyled as contour feathers (wingLook.js).
// Plan coordinates: the ulna's (x from the wrist toward the elbow, y toward the trailing edge, mm at
// wingK 1); heights above the wing plane in mm (absolute: the feather stack's lift steps do not scale).
import { wingStack, insidePoly } from './wingStack.js';
import { MAT } from '../../core/build/coatKit.js';
import { add, sub, mul, norm, cross, dot } from '../../core/math/vec.js';

export const SHIELD = {
  // the shield's outline (lesser / median coverts): front round the wrist, top edge along the leading
  // edge, lower rim along the secondaries' bases, rear end at the elbow
  core: [[-7, -6], [-4, -15], [4, -22], [18, -25], [36, -24], [52, -19], [64, -15], [71, -10], [74, -4], [72, 1], [67, 4], [60, 6], [50, 7], [38, 7.5], [26, 7], [15, 6], [6, 4], [-3, 1]],
  // greater coverts: root (x, y), direction (deg from +x toward +y), length factor, depth inside the rim
  // (mm, default inRoot); side by side along the lower rim and up the rear end, so their rounded ends make
  // the scalloped rim (fitted alternately: every other card first, the ones between them on top)
  cards: [[15, 3.6, 50, 0.8, 3], [21, 3.8, 48, 0.95], [30, 4.4, 45, 1.08], [39, 4.6, 43, 0.97], [48, 4.4, 41, 1.06], [57, 3.6, 37, 0.98], [65, 1.8, 29, 1.04], [71, -4, 14, 1.0]],
  len: 21, halfW: 6.8, // card length (x the card's factor), half width (mm)
  gap: 0.3, step: 0.3, coreGap: 0.45, coreRound: 3.5, coreDown: 2, // mm
  // the lid over the upper rear corner and the back (plan mm), its gap above the stack, thickness, rim
  // radius, blend (its lower edge stays above y -12 near x 68: card #7 lies under it)
  lid: { poly: [[44, -22], [58, -31], [74, -31], [84, -19], [82, -12], [68, -14], [56, -16], [44, -18]], gap: 0.4, t: 5.2, round: 2.4, k: 0.008 },
  // cards along the rim (fitted alternately), the cards' reach into the shield, their height on its top
  // (+ a step per card they overlap there), the drape from its rim down to their planes, the width at
  // the root (neighbours' roots side by side, their free ends overlapping)
  rim: 8, inRoot: 8, onTop: 0.3, ordStep: 0.6, drape: 7, rootTaper: 0.55,
};

const cache = new Map();
/** Fitted layout: { core: { poly, plane [h0, hx, hy] (top), t }, cards: [{ x, y, a, len, w, plane }] } (plan mm, this individual) */
export function shieldLayout(form = {}) {
  const key = JSON.stringify([form.wingK, form.priK, form.fwK, form.chick, form.up]);
  if (cache.has(key)) return cache.get(key);
  const C = SHIELD, wk = form.wingK ?? 1, S = wingStack(form);
  const core = C.core.map(([x, y]) => [x * wk, y * wk]);
  const cards = C.cards.map(([x, y, a, lk = 1, inR = C.inRoot], i) => {
    const r = a * Math.PI / 180, d = [Math.cos(r), Math.sin(r)], s = [-d[1], d[0]];
    const c = { i, x: x * wk, y: y * wk, d, s, len: C.len * lk * wk, w: C.halfW * wk, plane: null };
    c.tipL = Math.min(c.len * 0.55, c.w * 1.5); c.body = c.len - c.tipL;
    // (x, y): where the card's shaft leaves the shield; each side of the card starts inR mm inside the
    // shield's outline (its root edge runs along the rim, on the shield's top)
    const U0 = [];
    for (let k = 0; k <= 20; k++) {
      const v = (-1 + k / 10) * c.w;
      let ue = -20 * wk;
      for (let u = 20 * wk; u >= -20 * wk; u -= 0.2) if (insidePoly(core, c.x + d[0] * u + s[0] * v, c.y + d[1] * u + s[1] * v)) { ue = u + 0.2; break; }
      U0.push(Math.min(ue - inR * wk, c.body));
    }
    c.u0 = (cc) => { const f = (cc + 1) * 10, k = Math.min(19, Math.floor(f)); return U0[k] + (U0[k + 1] - U0[k]) * (f - k); };
    const poly = [];
    for (let k = 0; k <= 10; k++) poly.push(cardPoint(c, 0, -1 + k / 5));
    for (let k = 1; k <= 12; k++) poly.push(cardPoint(c, k / 12, 1));
    for (let k = 11; k >= 1; k--) poly.push(cardPoint(c, k / 12, -1));
    c.poly = poly;
    return c;
  });
  // sample points of each card's footprint outside the shield (1 mm grid)
  for (const c of cards) {
    const xs = c.poly.map((p) => p[0]), ys = c.poly.map((p) => p[1]);
    c.pts = [];
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += 1) {
      if (!insidePoly(c.poly, x, y) || insidePoly(core, x, y)) continue;
      c.pts.push([x, y, S.near(x, y, 1.2)]);
    }
  }
  // fit in stacking order: above the stack (+ gap + half the card's thickness) and above every earlier
  // card where they overlap (+ the card's thickness + step); planar, tilted to follow the stack (least
  // mean clearance)
  const hOf = (pl, x, y) => pl[0] + pl[1] * x + pl[2] * y;
  // fitting order: alternate cards along the rim first, then the ones between them (each lies on its two
  // neighbours: no chain of overlaps piling up toward the elbow), the extra cards last
  const nR = C.rim ?? cards.length;
  const order = [...cards.slice(0, nR).filter((c) => c.i % 2 === 0), ...cards.slice(0, nR).filter((c) => c.i % 2 === 1), ...cards.slice(nR)];
  const done = [];
  for (const c of order) {
    const need = c.pts.map(([x, y, h]) => {
      let L = Number.isFinite(h) ? h + C.gap + 0.25 : -Infinity;
      for (const cj of done) if (insidePoly(cj.poly, x, y)) L = Math.max(L, hOf(cj.plane, x, y) + 0.5 + C.step);
      return [x, y, L];
    }).filter((q) => Number.isFinite(q[2]));
    let best = null;
    for (let bx = -0.1; bx <= 0.3001; bx += 0.01) for (let by = -0.2; by <= 0.2001; by += 0.01) {
      let a = -Infinity; for (const [x, y, L] of need) a = Math.max(a, L - bx * x - by * y);
      if (!Number.isFinite(a)) a = 0;
      let m = 0; for (const [x, y, L] of need) m += a + bx * x + by * y - L;
      m /= Math.max(1, need.length);
      if (!best || m < best.m - 1e-9) best = { m, plane: [a, bx, by] };
    }
    c.plane = best.plane;
    c.fitGap = best.m;
    if (!need.length) c.plane = [S.near(c.x, c.y, 3) + C.gap + 0.25, 0, 0];
    done.push(c);
  }
  // each card's step above the shield's top where it lies on it: one above the highest earlier card it overlaps there
  for (let q = 0; q < order.length; q++) {
    const c = order[q];
    let o = 0;
    const xs = c.poly.map((p) => p[0]), ys = c.poly.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 0.5) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += 0.5) {
      if (!insidePoly(c.poly, x, y) || distPoly(core, x, y) > (insidePoly(core, x, y) ? 1e9 : C.drape * wk)) continue;
      for (let j = 0; j < q; j++) if (order[j].ord + 1 > o && insidePoly(order[j].poly, x, y)) o = order[j].ord + 1;
    }
    c.ord = o;
  }
  // the shield's top: above the stack inside it (+ coreGap) and above the covert cards' roots
  const cxs = core.map((p) => p[0]), cys = core.map((p) => p[1]);
  const need = [];
  for (let y = Math.floor(Math.min(...cys)); y <= Math.ceil(Math.max(...cys)); y += 1) for (let x = Math.floor(Math.min(...cxs)); x <= Math.ceil(Math.max(...cxs)); x += 1) {
    if (!insidePoly(core, x, y)) continue;
    let L = S.near(x, y, 1.2) + C.coreGap;
    if (Number.isFinite(L)) need.push([x, y, L]);
  }
  let best = null;
  for (let bx = 0; bx <= 0.3001; bx += 0.005) for (let by = -0.2; by <= 0.2001; by += 0.005) {
    let a = -Infinity; for (const [x, y, L] of need) a = Math.max(a, L - bx * x - by * y);
    let m = 0; for (const [x, y, L] of need) m += a + bx * x + by * y - L;
    if (!best || m < best.m) best = { m, plane: [a, bx, by] };
  }
  // thick enough to reach C.coreDown mm below the wing plane everywhere under it
  let tMax = 0; for (const [x, y] of core) tMax = Math.max(tMax, hOf(best.plane, x, y) + C.coreDown);
  const out = { core: { poly: core, plane: best.plane, t: tMax, round: C.coreRound }, cards, stack: S };
  // the lid over the shield's upper rear corner: a plate above the stack (the inner vanes come out of the
  // shield's rim there, beside the back, with nothing over them), its underside fitted just above the
  // stack's highest card over the wing's motion
  if (C.lid) {
    const lp = C.lid.poly.map(([x, y]) => [x * wk, y * wk]);
    const lneed = [];
    const lx = lp.map((p) => p[0]), ly = lp.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ly)); y <= Math.ceil(Math.max(...ly)); y += 1) for (let x = Math.floor(Math.min(...lx)); x <= Math.ceil(Math.max(...lx)); x += 1) {
      if (!insidePoly(lp, x, y)) continue;
      const h = S.near(x, y, 1.5);
      if (Number.isFinite(h)) lneed.push([x, y, h + C.lid.gap]);
    }
    // (tilted so its top runs on from the shield's top as closely as it can: no tab standing up)
    const lt = C.lid.t * wk, lpts = [];
    for (let y = Math.floor(Math.min(...ly)); y <= Math.ceil(Math.max(...ly)); y += 1) for (let x = Math.floor(Math.min(...lx)); x <= Math.ceil(Math.max(...lx)); x += 1) if (insidePoly(lp, x, y)) lpts.push([x, y]);
    let lb = null;
    for (let bx = -0.3; bx <= 0.3001; bx += 0.01) for (let by = -0.4; by <= 0.4001; by += 0.01) {
      let a = -Infinity; for (const [x, y, L] of lneed) a = Math.max(a, L - bx * x - by * y);
      let m = 0; for (const [x, y] of lpts) { const d = a + bx * x + by * y + lt - hOf(best.plane, x, y); m += d * d; }
      if (!lb || m < lb.m) lb = { m, plane: [a, bx, by] };
    }
    out.lid = { poly: lp, plane: lb.plane, t: lt, round: C.lid.round * wk, k: (C.lid.k ?? 0.003) * wk };
  }
  // a card's height (mm above the wing plane) at plan (x, y), s mm from its root edge: on the shield's top inside its
  // outline (each card a step above the ones before it), draped over the rim down to its fitted plane outside
  const top = best.plane;
  out.cardH = (c, x, y, s) => {
    const hTop = hOf(top, x, y) + C.onTop + C.ordStep * c.ord;
    const hOut = hOf(c.plane, x, y);
    const dOut = insidePoly(core, x, y) ? 0 : distPoly(core, x, y);
    const f = 1 - smooth01(dOut / (C.drape * wk));
    let h = hOut + (hTop - hOut) * f;
    // (the root edge lies on the shield, in its down; a root sunk into the skin crossed the card before it)
    void s;
    return h;
  };
  cache.set(key, out);
  return out;
}

const smooth01 = (t) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
// distance from (x, y) to a polygon's outline
export function distPoly(poly, x, y) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    m = Math.min(m, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return m;
}

// a point of a covert card in the plan (mm): tau 0 (its root edge, along the shield's rim) .. 1 (the tip of
// its rounded end), cc -1 .. 1 across it
export function cardPoint(c, tau, cc) {
  const u0 = c.u0(cc), u = u0 + tau * (c.len - u0);
  let hw = u <= c.body ? c.w : c.w * Math.sqrt(Math.max(0, 1 - ((u - c.body) / c.tipL) ** 2));
  // (narrower toward the root: neighbours' roots side by side, their free ends overlapping)
  if (SHIELD.rootTaper) { const a = Math.min(1, Math.max(0, (u - u0) / Math.max(1e-6, c.body - u0))); hw *= SHIELD.rootTaper + (1 - SHIELD.rootTaper) * Math.min(1, a / 0.6); }
  const v = cc * Math.max(hw, 0.05);
  return [c.x + c.d[0] * u + c.s[0] * v, c.y + c.d[1] * u + c.s[1] * v, hw];
}

// plan (mm) -> bind space, in the ulna's frame from the bind joints (as sculpt.js coverts())
export function planFrame(J, s) {
  const S = s > 0 ? 'L' : 'R';
  const sh = J['shoulder' + S], el = J['elbow' + S], wr = J['wrist' + S];
  let n = norm(cross(sub(el, sh), sub(wr, el)));
  if (n[1] < 0) n = mul(n, -1);
  const d = norm(sub(wr, el));
  const t = mul(norm(cross(n, d)), s);
  const X = mul(d, -1), Y = t;
  return { wr, X, Y, n, Q: (x, y, h) => add(add(add(wr, mul(X, x * 0.001)), mul(Y, y * 0.001)), mul(n, h * 0.001)) };
}

/**
 * The greater covert cards (surfaces block, rigid on the forearm bones), laid out as
 * core/build/featherCards.js cards (two layers, rachis + two vane columns, material VANE).
 * colour(kind, i, side, t, c, layer) as featherCards (kind 'wingCovert').
 */
export function covertCards(ctx, colour, look = null) {
  const { rig, params, Q } = ctx;
  const form = params.form || {};
  if (form.chick) return null;
  const Lyt = shieldLayout(form);
  const res = Q?.res ?? 1;
  if (res >= 4) return null; // (the crowd tier drops coverts, as featherCards)
  // (more rows than a flight feather: the card drapes over the shield's rim)
  const nA = (res <= 1.35 ? 9 : res <= 2.1 ? 6 : res <= 3.1 ? 4 : 3) + 4;
  const th = 0.0005;
  const P = [], N = [], Cb = [], T = [], Sf = [], SI = [], I = [], X = [], PCL = [], FL = [];
  for (const side of [1, -1]) {
    const F = planFrame(rig.J, side), b = rig.BONE['ulna' + (side > 0 ? 'L' : 'R')];
    for (const c of Lyt.cards) {
      const [a0, ax, ay] = c.plane;
      const h = (x, y) => a0 + ax * x + ay * y;
      // card frame in bind space
      const p0 = F.Q(c.x, c.y, h(c.x, c.y));
      const A = norm(sub(F.Q(c.x + c.d[0], c.y + c.d[1], h(c.x + c.d[0], c.y + c.d[1])), p0));
      const Sv = norm(sub(F.Q(c.x + c.s[0], c.y + c.s[1], h(c.x + c.s[0], c.y + c.s[1])), p0));
      let Nn = norm(cross(A, Sv));
      if (dot(Nn, F.n) < 0) Nn = mul(Nn, -1);
      const v0 = P.length / 3;
      const ts = []; for (let j = 0; j <= nA; j++) ts.push(0.5 - 0.5 * Math.cos(Math.PI * j / nA));
      const COLS = [-1, -0.5, 0, 0.5, 1], nc = COLS.length;
      const pt = (t, cc) => {
        const [x, y] = cardPoint(c, t, cc);
        const sR = t * (c.len - c.u0(cc));
        return F.Q(x, y, Lyt.cardH ? Lyt.cardH(c, x, y, sR) : h(x, y));
      };
      const halfW = (t) => cardPoint(c, t, 0)[2];
      for (const layer of [1, -1]) {
        for (let j = 0; j <= nA; j++) {
          const t = ts[j];
          for (const cc of COLS) {
            // local normal from the (draped) surface
            const e = 0.02;
            const dt = sub(pt(Math.min(1, t + e), cc), pt(Math.max(0, t - e), cc)), dc = sub(pt(t, Math.min(1, cc + e)), pt(t, Math.max(-1, cc - e)));
            let nl = norm(cross(dt, dc));
            if (!Number.isFinite(nl[0])) nl = Nn;
            if (dot(nl, F.n) < 0) nl = mul(nl, -1);
            const p = add(pt(t, cc), mul(nl, layer * th * 0.5 * (1 - 0.6 * t) - (layer > 0 ? 0 : 0)));
            P.push(...p); N.push(...mul(nl, layer));
            Cb.push(...norm(dt));
            if (look) {
              // shaded as the shield's contour feathers (material FEATHER, one big shingle per card)
              const k = (1 + 0.06 * Math.sin(c.i * 12.9898 + side * 3.1)) * (layer > 0 ? 1 : 0.8);
              T.push(look.rgb[0] * k, look.rgb[1] * k, look.rgb[2] * k, MAT.FEATHER);
              Sf.push(look.gloss, look.size, look.mz, look.irid);
              if (look.mcol) PCL.push([P.length / 3 - 1, look.mcol, 0]);
              FL.push(layer > 0 ? look.fur ?? 0 : 0);
            } else {
              const col = colour('wingCovert', c.i, side, t, cc, layer);
              T.push(col.rgb[0], col.rgb[1], col.rgb[2], MAT.VANE);
              if (col.bar) PCL.push([P.length / 3 - 1, col.bar.rgb, -c.len * 0.001 / col.bar.period]);
              // (across never reaches 0: no rachis line, a covert's shaft is hidden in its barbs)
              Sf.push(col.gloss ?? 0.4, col.irid ?? 0, 0.3 + 0.7 * Math.abs(cc), t);
            }
            X.push(cc * halfW(t) * 0.001 * side);
            SI.push(b.index, 0, 0, 0);
          }
        }
        const base = v0 + (layer > 0 ? 0 : (nA + 1) * nc);
        for (let j = 0; j < nA; j++) for (let k = 0; k < nc - 1; k++) {
          const a = base + j * nc + k, bq = a + 1, c2 = a + nc, d = a + nc + 1;
          I.push(a, c2, bq, bq, c2, d);
        }
      }
      // winding: each triangle faces its layer's normal
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t], bb = I[t + 1], c3 = I[t + 2];
        if (a < v0) continue;
        const e1 = [P[bb * 3] - P[a * 3], P[bb * 3 + 1] - P[a * 3 + 1], P[bb * 3 + 2] - P[a * 3 + 2]];
        const e2 = [P[c3 * 3] - P[a * 3], P[c3 * 3 + 1] - P[a * 3 + 1], P[c3 * 3 + 2] - P[a * 3 + 2]];
        const g = cross(e1, e2);
        if (g[0] * N[a * 3] + g[1] * N[a * 3 + 1] + g[2] * N[a * 3 + 2] < 0) { I[t + 1] = c3; I[t + 2] = bb; }
      }
    }
  }
  const nV = P.length / 3;
  const out = {
    nV, pos: Float32Array.from(P), nrm: Float32Array.from(N), index: Uint32Array.from(I),
    skinIndex: Uint16Array.from(SI), skinWeight: new Float32Array(nV * 4),
    comb: Float32Array.from(Cb), tint: Float32Array.from(T), surf: Float32Array.from(Sf),
    pattern: Float32Array.from(X), mark: new Float32Array(nV).fill(1), furLen: FL.length === nV ? Float32Array.from(FL) : new Float32Array(nV),
    patternColor: new Float32Array(nV * 4),
  };
  for (const [v, rgb, n] of PCL) out.patternColor.set([rgb[0], rgb[1], rgb[2], n], v * 4);
  for (let v = 0; v < nV; v++) out.skinWeight[v * 4] = 1;
  return out;
}

// concatenate two surfaces blocks (indices of the second offset)
export function joinSurfaces(a, b) {
  if (!b || !b.nV) return a;
  if (!a || !a.nV) return b;
  const cat = (x, y, T) => { const r = new T(x.length + y.length); r.set(x); r.set(y, x.length); return r; };
  const idx = new Uint32Array(a.index.length + b.index.length);
  idx.set(a.index); for (let i = 0; i < b.index.length; i++) idx[a.index.length + i] = b.index[i] + a.nV;
  return {
    nV: a.nV + b.nV, pos: cat(a.pos, b.pos, Float32Array), nrm: cat(a.nrm, b.nrm, Float32Array), index: idx,
    skinIndex: cat(a.skinIndex, b.skinIndex, Uint16Array), skinWeight: cat(a.skinWeight, b.skinWeight, Float32Array),
    comb: cat(a.comb, b.comb, Float32Array), tint: cat(a.tint, b.tint, Float32Array), surf: cat(a.surf, b.surf, Float32Array),
    pattern: cat(a.pattern, b.pattern, Float32Array), mark: cat(a.mark, b.mark, Float32Array), furLen: cat(a.furLen, b.furLen, Float32Array),
    patternColor: cat(a.patternColor, b.patternColor, Float32Array),
  };
}
