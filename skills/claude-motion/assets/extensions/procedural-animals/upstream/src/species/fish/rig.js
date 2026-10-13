// Fish skeleton (bind pose, metres): forward = +Z, up = +Y, left = +X; the body rests just above y = 0.
// All landmarks come from the variant's outline table (variants.js), so the four body plans share one
// rig builder. The standard swimmer bone set is in core/rig/swimmer.js.
import { buildRig } from '../../core/rig/rig.js';
import { swimmerBones, swimmerAppendages, axialJoints, axialBones, swimmerJointsAlias, spineName } from '../../core/rig/swimmer.js';
import { VARIANTS } from './variants.js';
import { norm, add, mul } from '../../core/math/vec.js';

const cr = (p0, p1, p2, p3, t) => {
  // Catmull-Rom (centripetal enough for our smooth tables), clamped to the neighbours' range
  const t2 = t * t, t3 = t2 * t;
  const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  const lo = Math.min(p1, p2), hi = Math.max(p1, p2), pad = (hi - lo) * 0.25;
  return Math.max(lo - pad, Math.min(hi + pad, v));
};

/** Geometry helper for one variant: outline lookups (metres) and the landmarks. Cached per params. */
export function fishGeo(params) {
  const key = params.variant;
  const V = VARIANTS[key];
  if (!V) throw new Error(`fish: unknown variant "${key}"`);
  const SL = V.SL;
  const rows = V.prof;
  const n = rows.length;
  const col = (i, k) => rows[Math.max(0, Math.min(n - 1, i))][k];
  const at = (u, k) => {
    if (u <= rows[0][0]) return rows[0][k] * Math.sqrt(Math.max(0, u) / rows[0][0]);
    if (u >= rows[n - 1][0]) return rows[n - 1][k];
    let i = 0;
    while (i < n - 2 && u > rows[i + 1][0]) i++;
    const t = (u - rows[i][0]) / (rows[i + 1][0] - rows[i][0]);
    return cr(col(i - 1, k), col(i, k), col(i + 1, k), col(i + 2, k), t);
  };
  let maxBot = 0;
  for (const r of rows) maxBot = Math.max(maxBot, r[2]);
  const axisY = (maxBot + 0.04) * SL;
  const z0 = 0.42 * SL;
  const G = {
    V, SL, axisY, z0,
    tailLen: V.fins.caudal.len * (params.tailK || 1),
    finK: params.finK || 1,
    L: SL * (1 + V.fins.caudal.len * (params.tailK || 1) * 0.95),
    z: (u) => z0 - u * SL,
    u: (z) => (z0 - z) / SL,
    top: (u) => at(u, 1) * SL,
    bot: (u) => at(u, 2) * SL,
    hw: (u) => at(u, 3) * SL,
    yc: (u) => axisY + ((at(u, 1) - at(u, 2)) / 2) * SL,
    hd: (u) => ((at(u, 1) + at(u, 2)) / 2) * SL,
  };
  // surface half width at height y (elliptic cross-section)
  G.surfX = (u, y) => {
    const e = (y - G.yc(u)) / Math.max(1e-6, G.hd(u));
    return G.hw(u) * Math.sqrt(Math.max(0, 1 - e * e));
  };
  // a point on the flank surface at (u, height fraction e in -1..1 of the half depth)
  G.flank = (u, e, s = 1) => {
    const y = G.yc(u) + e * G.hd(u);
    return [s * G.surfX(u, y), y, G.z(u)];
  };
  const H = V.head;
  G.mouthY = axisY + H.mouth.h * SL;
  const eu = H.eye.u, ey = axisY + H.eye.h * SL;
  G.eye = { u: eu, y: ey, r: H.eye.r * SL, z: G.z(eu) };
  G.eye.x = G.surfX(eu, ey) - 0.62 * G.eye.r; // flush: only a shallow cap shows
  G.headO = [0, ey, G.z(eu)];
  return G;
}

export function fishJoints(params) {
  const G = fishGeo(params);
  const V = G.V, SL = G.SL, H = V.head, F = V.fins;
  const N = V.spineSegs, M = V.caudalSegs;
  const J = {};
  J.snout = [0, G.mouthY + 0.004 * SL, G.z0];
  for (let i = 0; i <= N; i++) {
    const u = H.occ + ((1 - H.occ) * i) / N;
    J[spineName(i)] = [0, G.yc(u), G.z(u)];
  }
  swimmerJointsAlias(J, N);
  const cl = G.tailLen * 0.86;
  for (let j = 1; j <= M; j++) J['caudal' + j] = [0, G.yc(1), G.z(1 + (cl * j) / M)];
  // lower jaw: hinge below the end of the gape, tip at the chin
  const g = H.mouth.gape;
  J.jawHinge = [0, G.mouthY - H.mouth.jawDepth * SL * 0.55, G.z(g + 0.02)];
  J.jawTip = [0, G.mouthY - 0.006 * SL, G.z(0.004)];
  J.premaxBase = [0, G.mouthY + 0.03 * SL, G.z(g * 0.85)];
  J.premaxTip = [0, G.mouthY + 0.008 * SL, G.z(0.0)];
  // gill cover: hinge along its front edge, free edge at the back
  const op = H.op;
  J.opHingeL = G.flank(op - 0.075, 0.5);
  J.opLowL = G.flank(op - 0.1, -0.45);
  J.opEdgeL = G.flank(op, 0.05);
  // pectoral fin: base line on the flank behind the gill cover
  const P = F.pectoral;
  const pb = G.flank(P.u, (P.h * SL - (G.yc(P.u) - G.axisY)) / G.hd(P.u));
  pb[0] += 0.004 * SL;
  J.pecBaseL = pb;
  J.pecUpL = [pb[0] - 0.004 * SL, pb[1] + 0.03 * SL, pb[2] + 0.008 * SL];
  J.pecTipL = add(pb, mul(finDir(P.sweep, P.droop, P.abduct), P.len * G.finK * SL));
  // pelvic fin: on the belly
  const Q = F.pelvic;
  const ybot = G.yc(Q.u) - G.hd(Q.u);
  const pl = [G.hw(Q.u) * 0.42, ybot + 0.18 * G.hd(Q.u) * 0.3, G.z(Q.u)];
  pl[1] = G.yc(Q.u) - G.hd(Q.u) * Math.sqrt(1 - Math.pow(pl[0] / G.hw(Q.u), 2)) + 0.003 * SL;
  J.pelBaseL = pl;
  J.pelFrontL = [pl[0] + 0.02 * SL, pl[1] - 0.004 * SL, pl[2] + 0.004 * SL];
  J.pelTipL = add(pl, mul(finDir(90 - Q.sweep, 90 - Q.sweep * 0.2, Q.abduct, true), Q.len * G.finK * SL));
  return { J, G };
}

// Fin direction: `sweep` deg back from lateral toward -Z, `droop` deg below horizontal, `abduct` deg
// out from the body wall. For the pelvic (ventral) fins pass ventral = true: they point back and down.
export function finDir(sweep, droop, abduct, ventral = false) {
  const d2r = Math.PI / 180;
  if (ventral) {
    const back = Math.cos(abduct * d2r), out = Math.sin(abduct * d2r);
    return norm([out * 0.8, -Math.sin((90 - droop) * d2r) * 0.55 - 0.25, -back]);
  }
  const ab = abduct * d2r, dr = droop * d2r;
  return norm([Math.sin(ab), -Math.sin(dr), -Math.cos(ab) * Math.cos(dr)]);
}

export function pickParent(G, u) {
  const V = G.V, N = V.spineSegs, occ = V.head.occ;
  const i = Math.max(0, Math.min(N - 1, Math.floor(((u - occ) / (1 - occ)) * N)));
  return spineName(i);
}

export function fishRig(params) {
  const { J, G } = fishJoints(params);
  const V = G.V, N = V.spineSegs, M = V.caudalSegs;
  return buildRig({
    joints: J,
    unit: G.L / 1.3,
    headOrigin: G.headO,
    bones: swimmerBones({ spineSegs: N, caudalSegs: M, jaw: true, upperJaw: true, opercula: true, pectoralParent: pickParent(G, V.fins.pectoral.u), pelvicParent: pickParent(G, V.fins.pelvic.u) }),
    axial: { points: axialJoints(N, M), bones: axialBones(N, M) },
    limbs: {},
    appendages: swimmerAppendages({ upperJaw: true, blend: [-0.004, 0.006] }),
    meta: { variant: params.variant, SL: G.SL },
  });
}
