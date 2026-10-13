// Pig ear leaves: the geometry shared by the rig (the ear bone runs from the root to the leaf's tip), the
// sculpt (tiles), the meshing plan (the region box) and the coat (the hollow side, how far out along the ear).
//
// A leaf is one smooth curved sheet with a mid-surface P(s, a) (s 0 root .. 1 tip, a -1 .. 1 across):
// - the spine leaves the head along the root direction `root` (WORLD, standing pig, left ear), runs straight
//   for the first s0 of its length and then bends toward the hollow side by `bend` degrees in all (bendPow
//   > 1: the bend comes late, toward the tip);
// - its cross-section is a circular arc that rolls both edges toward the hollow by `cup` (rad, root -> tip:
//   the root rolled into the funnel of the ear canal, flatter toward the tip), half width W earW(s);
// - it is thick at the root and thins toward the rim (`thick`: [root, rim] full thickness, m): cartilage and
//   skin ~1.2-1.5 cm where the pinna leaves the head, 3-4 mm at its free edge, with a round rim.
// The sheet is tiled with small exact slabs (m.fin with a thickness gradient, core sdf.js), each its quad
// projected on its own plane and run one rim radius past every edge it shares with a neighbour, so the
// rounded ends of neighbours make one cylinder there and the sheet runs on smoothly.
//
// Forms (from photos):
// - erect (Large White, Hampshire, Berkshire; face1, face2, front1): a broad leaf up and forward, the hollow
//   facing forward and out, a rounded tip curling a little forward;
// - semi (Duroc; face3): up and out from the top corners of the poll with the hollow facing forward, curving
//   out and down as it goes (sweep) and the outer part folding forward and down (bend), a thick, soft leaf
//   hanging beside the eyes;
// - lop (Landrace, Gloucester Old Spot): the leaf leaves the poll corner forward along the head and a little out
//   and up, then droops forward and down over the eye toward the snout, a soft visor with air under it (its
//   convex back out and up, the hollow facing the face below it), the forehead showing between the two.
const PI = Math.PI;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ear root on the head (head-local, rig.js hl()): the top corners of the broad poll (face2 / front1: the
// ear bases well out from the midline)
export const EAR_BASE = [0.07, 0.056, -0.074];
// the ears' meshing cell at the hero tier (regions.js: x the tier's res)
export const EAR_CELL = 0.003;

// leaf outlines: half width (x W) along the leaf
const OUTLINE = {
  // (broad, the widest a third of the way up, a rounded tip: face2, front1)
  // (a pointed tip, lw_show, head_hausschwein5, face2; the rounded tip read as a mouse's ear)
  erect: [[0, 0.5], [0.08, 0.68], [0.22, 0.94], [0.4, 1.0], [0.6, 0.9], [0.78, 0.66], [0.9, 0.38], [1.0, 0.06]],
  // (broad and blunt: face3)
  semi: [[0, 0.5], [0.08, 0.7], [0.24, 0.95], [0.45, 1.0], [0.66, 0.9], [0.84, 0.64], [0.95, 0.36], [1.0, 0.12]],
  // (long, widest past the middle, a rounded point toward the snout)
  lop: [[0, 0.46], [0.08, 0.64], [0.24, 0.9], [0.46, 1.0], [0.66, 0.92], [0.84, 0.66], [0.95, 0.36], [1.0, 0.1]],
};
// root / facing: WORLD directions of the standing pig (left ear); rootH / facingH: the same in head-local
// coordinates (x out, y dorsal, z along the head toward the disc; the head is carried HEAD_PITCH nose-down)
export const EAR_FORM = {
  // (splayed out ~36 deg from upright and a broader leaf, as in lw_show, face2, head_hausschwein5: at 29 deg
  // and 0.38 wide they stood up like a rabbit's)
  erect: { root: [0.58, 0.8, 0.2], len: 0.2, facing: [0.45, -0.4, 0.9], bend: 12, s0: 0.1, bendPow: 2, cup: [0.95, 0.28], width: 0.41, thick: [0.012, 0.0055], wave: 0, ns: 12, na: 10 },
  // (up and out from the poll corner with the hollow forward, the outer part folding forward and down to hang
  // beside the eye, the tips about level with the eyes: face3, Duroc photos; held out flat as brims)
  semi: { root: [0.9, 0.0, 0.45], len: 0.235, facing: [0.1, -0.45, 1], bend: 45, s0: 0.4, bendPow: 1.2, sweep: 75, sweepS0: 0.2, sweepPow: 1.3, cup: [0.7, 0.35], width: 0.29, thick: [0.014, 0.0055], wave: 0, ns: 22, na: 10 },
  // (forward from the poll corners along the head and angled out, then drooping over the eyes like a soft visor
  // with air under it, the forehead showing between the two: Landrace photos; 0.68 as wide as long and
  // rolled round the head, the two leaves covered the whole upper face like a helmet)
  // (the root rising ~8 deg above level before the leaf droops (it left the poll 12 deg nose-down
  // and lay along the forehead like a decal from the front 3/4; lr_heads: forward and level from the
  // poll, then down over the eye))
  lop: { rootH: [0.3, 0.55, 0.78], len: 0.22, facingH: [-0.5, -0.85, 0.15], bend: 95, s0: 0.3, bendPow: 1.5, cup: [0.45, 0.2], width: 0.28, thick: [0.015, 0.0055], wave: 0.015, ns: 14, na: 10 },
};
// (rig.js HEAD_PITCH: kept here as a number, rig.js imports this module)
const HP = (35 * PI) / 180;
const fromHead = (v) => [v[0], v[1] * Math.cos(HP) - v[2] * Math.sin(HP), v[1] * Math.sin(HP) + v[2] * Math.cos(HP)];
const rootOf = (F) => (F.rootH ? fromHead(F.rootH) : F.root);
const facingOf = (F) => (F.facingH ? fromHead(F.facingH) : F.facing);
export const earType = (params) => (params.ear === 'lop' || params.ear === 'semi' ? params.ear : 'erect');
export const earW = (type, t) => {
  const W = OUTLINE[type];
  for (let i = 1; i < W.length; i++) if (t <= W[i][0]) { const [t0, w0] = W[i - 1], [t1, w1] = W[i]; return w0 + ((w1 - w0) * (t - t0)) / (t1 - t0); }
  return W[W.length - 1][1];
};

// the root direction of the left ear (world, standing) and the leaf length for this individual (the pinnae
// carried more forward / more out, params.earFwd / earOut; params.earSize)
// (params.earForm: overrides of the form's numbers, for tools)
const formOf = (params) => (params.earForm ? { ...EAR_FORM[earType(params)], ...params.earForm } : EAR_FORM[earType(params)]);
export function earRoot(params) {
  const F = formOf(params);
  const d = norm(rootOf(F));
  return { dir: norm([d[0] + 0.25 * (params.earOut || 0), d[1], d[2] + 0.35 * (params.earFwd || 0)]), len: F.len * (params.earSize ?? 1) };
}

// the spine of one leaf: stations 0..steps from the root; per station the point and the leaf's frame: d along
// the spine, h the hollow side, l across the leaf (l = d x h). The frame folds toward the hollow (`bend`
// degrees in all from s0 on, bendPow > 1: late) and sweeps within the leaf's plane toward +l (`sweep`
// degrees from sweepS0 on, sweepPow): a leaf held out sideways with its hollow forward that curves down as
// it goes (face3) sweeps; one that tips over toward its hollow folds. (Left ear; mirrored for the right.)
export function earSpine(base, S, params, steps = 96) {
  const s = S === 'L' || S === 1 ? 1 : -1;
  const type = earType(params);
  const F = formOf(params);
  const { dir, len } = earRoot(params);
  const d0 = [dir[0] * s, dir[1], dir[2]];
  const fc = facingOf(F);
  const fw = [fc[0] * s, fc[1], fc[2]];
  const f0 = norm(sub(fw, mul(d0, dot(fw, d0))));
  const lat = norm(cross(d0, f0));
  const B = (F.bend * PI) / 180, Bs = ((F.sweep || 0) * PI) / 180 * s, Bt = ((F.twist || 0) * PI) / 180 * s;
  const ramp = (u, u0, p) => Math.pow(clamp01((u - u0) / (1 - u0)), p);
  const foldAt = (u) => B * ramp(u, F.s0, F.bendPow);
  const sweepAt = (u) => Bs * ramp(u, F.sweepS0 ?? F.s0, F.sweepPow ?? 1);
  const twistAt = (u) => Bt * ramp(u, F.twistS0 ?? F.s0, F.twistPow ?? 1);
  const pts = [base], fr = [{ d: d0, h: f0, l: lat }];
  let o = base, d = d0, h = f0, l = lat;
  for (let k = 1; k <= steps; k++) {
    const u0 = (k - 1) / steps, u1 = k / steps;
    const da = foldAt(u1) - foldAt(u0), db = sweepAt(u1) - sweepAt(u0), dt = twistAt(u1) - twistAt(u0);
    const dPrev = d;
    // fold: d toward h about l
    { const c = Math.cos(da), sn = Math.sin(da); const d2 = add(mul(d, c), mul(h, sn)); h = sub(mul(h, c), mul(d, sn)); d = d2; }
    // sweep: d toward l about h (the right ear sweeps the mirrored way: its l is the mirror's -l)
    { const c = Math.cos(db), sn = Math.sin(db); const d2 = add(mul(d, c), mul(l, sn)); l = sub(mul(l, c), mul(d, sn)); d = d2; }
    // twist: the leaf turns about its spine, h toward l (a lop ear's leaf turns from a visor over the eye to a
    // flap hanging down the side of the face)
    { const c = Math.cos(dt), sn = Math.sin(dt); const h2 = add(mul(h, c), mul(l, sn)); l = sub(mul(l, c), mul(h, sn)); h = h2; }
    d = norm(d); h = norm(sub(h, mul(d, dot(h, d)))); l = cross(d, h);
    o = add(o, mul(norm(add(dPrev, d)), len / steps));
    pts.push(o);
    fr.push({ d, h, l });
  }
  return { type, F, s, d0, f0, lat, pts, fr, L: len, W: F.width * len * (params.earWide ?? 1), steps, tip: o };
}

// the leaf: tiles for the sculpt, the mid-surface for tools, the outline points for the region box.
// res: the quality tier's cell scale (params.tierRes): the leaf is at least 1.8 ear cells thick at every tier
// (EAR_CELL x res, regions.js; a sheet thinner than that has both faces in one cell and meshes with rows of
// pinholes: a 3.6 mm rim at the 3 mm hero cells did).
// Each tile is a curved, tapered slab (core fin({ grad, curve })): its mid-surface a quadric fitted to 9
// points of the leaf's mid-surface, its half thickness a plane fitted to its corners, so neighbouring tiles
// meet with the same tangent plane and thickness (a smooth sheet: planar tiles showed a grid of facets).
export function earLeaf(base, S, params) {
  const sp = earSpine(base, S, params);
  const { F, type, pts: spine, fr, steps: STEPS, W, L } = sp;
  const res = params.tierRes ?? 1;
  const tMin = (res >= 1.9 ? 2.3 : 1.8) * EAR_CELL * res; // (medium and below 2.3 cells: at 1.8 the round rim, thinner than a 6 mm cell, meshed scalloped like torn paper)
  // (fractional stations: linear between the spine's 96 steps)
  const at = (kf) => {
    const k = Math.min(STEPS - 1, Math.max(0, Math.floor(kf))), f = kf - k, A = fr[k], Bf = fr[k + 1];
    const h = norm(add(mul(A.h, 1 - f), mul(Bf.h, f))), l = norm(add(mul(A.l, 1 - f), mul(Bf.l, f)));
    return { p: add(mul(spine[k], 1 - f), mul(spine[k + 1], f)), h, l };
  };
  // (a soft, slightly uneven rim: the half width wanders by F.wave along the leaf, three to four times, face3;
  // the phase differs per side and individual)
  const wph = ((params.coatSeed || 0) % 628) / 100 + (S === 'L' || S === 1 ? 0 : 2.1);
  const half = (kf) => { const t = kf / STEPS; return Math.max(1e-4, earW(type, t) * W * (1 + (F.wave || 0) * Math.sin(2 * PI * 3.4 * t + wph) * sstep(0.1, 0.35, t))); };
  const cupAt = (kf) => F.cup[0] + (F.cup[1] - F.cup[0]) * (kf / STEPS);
  // mid-surface point and hollow-side normal at station kf (0..STEPS), across a (-1..1)
  const P = (kf, a) => {
    const { p, h, l } = at(kf), w = half(kf), kap = cupAt(kf) / w, x = a * w;
    return add(add(p, mul(l, Math.sin(kap * x) / kap)), mul(h, (1 - Math.cos(kap * x)) / kap));
  };
  const Nrm = (kf, a) => {
    const { h, l } = at(kf), w = half(kf), kap = cupAt(kf) / w, x = a * w;
    return norm(add(mul(h, Math.cos(kap * x)), mul(l, -Math.sin(kap * x))));
  };
  // thickness (full, m): thick where the pinna leaves the head, thinning toward the tip and the edges
  const thick = (u, a) => {
    const tr = F.thick[0], te = F.thick[1];
    const t = te + (tr - te) * (1 - sstep(0, 0.55, u)) * (1 - sstep(0.25, 1, Math.abs(a)));
    return Math.max(t, tMin);
  };
  const NS = F.ns, NA = F.na;
  const st = (i) => (i * STEPS) / NS;
  const segs = [], outline = [base];
  for (let i = 0; i < NS; i++) {
    for (let j = 0; j < NA; j++) {
      const a0 = -1 + (2 * j) / NA, a1 = -1 + (2 * (j + 1)) / NA, k0 = st(i), k1 = st(i + 1);
      const Q = [P(k0, a0), P(k1, a0), P(k1, a1), P(k0, a1)];
      const C = mul(add(add(Q[0], Q[1]), add(Q[2], Q[3])), 0.25);
      const v = norm(sub(add(Q[1], Q[2]), add(Q[0], Q[3])));
      let u = sub(add(Q[3], Q[2]), add(Q[0], Q[1]));
      u = norm(sub(u, mul(v, dot(u, v))));
      // (the fin's normal u x v points into the hollow: the coat reads the hollow side from it)
      if (dot(cross(u, v), Nrm((k0 + k1) / 2, (a0 + a1) / 2)) < 0) u = mul(u, -1);
      const n = cross(u, v);
      const q2 = Q.map((q) => [dot(sub(q, C), u), dot(sub(q, C), v)]);
      // the mid-surface over the tile: z = m0 + mu x + mv y + (muu x^2 + 2 muv x y + mvv y^2) / 2 (least squares, 9 points)
      const rows = [], zs = [];
      for (const kf of [k0, (k0 + k1) / 2, k1]) for (const a of [a0, (a0 + a1) / 2, a1]) {
        const d = sub(P(kf, a), C), x = dot(d, u), y = dot(d, v);
        rows.push([1, x, y, 0.5 * x * x, x * y, 0.5 * y * y]); zs.push(dot(d, n));
      }
      const curve = lsq(rows, zs);
      // half thickness at the corners, fitted by a plane h0 + gu x + gv y
      const hc = [thick(k0 / STEPS, a0), thick(k1 / STEPS, a0), thick(k1 / STEPS, a1), thick(k0 / STEPS, a1)].map((t) => t / 2);
      const [h0, gu, gv] = lsq(q2.map(([x, y]) => [1, x, y]), hc);
      // edges: Q0-Q1 the a0 side (the rim if j = 0), Q1-Q2 the tip side (the rim if last), Q2-Q3 the a1
      // side (the rim if j = NA - 1), Q3-Q0 the root side (the first row runs into the head)
      const hEdge = (c0, c1) => (hc[c0] + hc[c1]) / 2;
      const ext = [j === 0 ? 0 : hEdge(0, 1), i === NS - 1 ? 0 : hEdge(1, 2), j === NA - 1 ? 0 : hEdge(2, 3), hEdge(3, 0)];
      const poly = offsetPoly(q2, ext);
      segs.push({ o: C, u, v, poly, t: 2 * h0, grad: [gu, gv], curve });
      for (const [x, y] of poly) {
        const z = curve[0] + curve[1] * x + curve[2] * y + 0.5 * (curve[3] * x * x + 2 * curve[4] * x * y + curve[5] * y * y);
        outline.push(add(add(add(C, mul(u, x)), mul(v, y)), mul(n, z)));
      }
    }
  }
  // (mid-surface for tools: s 0..1, a -1..1)
  const mid = (s, a) => ({ p: P(clamp01(s) * STEPS, a), n: Nrm(clamp01(s) * STEPS, a) });
  return { base, along: norm(sub(sp.tip, base)), L, W, segs, pts: outline, mid, tip: sp.tip, type };
}

// least squares: argmin |A m - z| (normal equations, Gaussian elimination with partial pivoting)
function lsq(A, z) {
  const n = A[0].length;
  const M = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  for (let r = 0; r < A.length; r++) for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] += A[r][i] * A[r][j]; M[i][n] += A[r][i] * z[r]; }
  for (let c = 0; c < n; c++) {
    let pr = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pr][c])) pr = r;
    [M[c], M[pr]] = [M[pr], M[c]];
    const d = M[c][c] || 1e-30;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-30));
}

// a convex polygon (2D) with each edge k pushed out by ext[k]
function offsetPoly(q, ext) {
  const n = q.length;
  let area = 0;
  for (let k = 0; k < n; k++) { const [x0, y0] = q[k], [x1, y1] = q[(k + 1) % n]; area += x0 * y1 - x1 * y0; }
  const sg = area > 0 ? 1 : -1;
  const lines = q.map((p, k) => {
    const p1 = q[(k + 1) % n], dx = p1[0] - p[0], dy = p1[1] - p[1], l = Math.hypot(dx, dy) || 1;
    return { px: p[0] + ((sg * dy) / l) * ext[k], py: p[1] - ((sg * dx) / l) * ext[k], dx: dx / l, dy: dy / l };
  });
  return q.map((_, k) => {
    const A = lines[(k + n - 1) % n], B = lines[k], den = A.dx * B.dy - A.dy * B.dx;
    if (Math.abs(den) < 1e-9) return [B.px, B.py];
    const t = ((B.px - A.px) * B.dy - (B.py - A.py) * B.dx) / den;
    return [A.px + A.dx * t, A.py + A.dy * t];
  });
}
