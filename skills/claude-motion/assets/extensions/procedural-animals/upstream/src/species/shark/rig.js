// Shark skeleton (bind pose, metres): forward = +Z, up = +Y, left = +X; the lowest fin tips rest near
// y = 0. Every landmark comes from the variant's outline table (variants.js), so the white shark and
// the blacktip share one builder. The standard swimmer bone set is in core/rig/swimmer.js; the
// heterocercal tail is the caudal chain climbing into the upper lobe (the engine reads its rest pitch).
import { buildRig } from '../../core/rig/rig.js';
import { swimmerBones, swimmerAppendages, axialJoints, axialBones, swimmerJointsAlias, spineName } from '../../core/rig/swimmer.js';
import { VARIANTS } from './variants.js';
import { norm, add, mul, cross, sub, dot } from '../../core/math/vec.js';

const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  const lo = Math.min(p1, p2), hi = Math.max(p1, p2), pad = (hi - lo) * 0.25;
  return Math.max(lo - pad, Math.min(hi + pad, v));
};
const D2R = Math.PI / 180;

/** Geometry helper for one individual: outline lookups (metres), landmarks and fin frames. */
export function sharkGeo(params) {
  const V = VARIANTS[params.variant];
  if (!V) throw new Error(`shark: unknown variant "${params.variant}"`);
  const TL = V.TL;
  const rows = V.prof, n = rows.length;
  const col = (i, k) => rows[Math.max(0, Math.min(n - 1, i))][k];
  const at = (u, k) => {
    if (u <= rows[0][0]) return rows[0][k] * Math.sqrt(Math.max(0, u) / rows[0][0]);
    if (u >= rows[n - 1][0]) return rows[n - 1][k];
    let i = 0;
    while (i < n - 2 && u > rows[i + 1][0]) i++;
    const t = (u - rows[i][0]) / (rows[i + 1][0] - rows[i][0]);
    return cr(col(i - 1, k), col(i, k), col(i + 1, k), col(i + 2, k), t);
  };
  const girthK = params.girthK || 1;
  const axisY = 0.155 * TL;
  const z0 = 0.45 * TL;
  const G = {
    V, TL, axisY, z0, girthK,
    finK: params.finK || 1, dorsalK: params.dorsalK || 1, pecK: params.pecK || 1, tailK: params.tailK || 1,
    pc: V.precaudal,
    z: (u) => z0 - u * TL,
    u: (z) => (z0 - z) / TL,
    yc: (u) => axisY + ((at(u, 1) - at(u, 2)) / 2) * TL,
    hd: (u) => ((at(u, 1) + at(u, 2)) / 2) * TL * (u > 0.1 && u < 0.72 ? 1 + (girthK - 1) * Math.sin(Math.PI * (u - 0.1) / 0.62) : 1),
    hw: (u) => at(u, 3) * TL * (u > 0.1 && u < 0.72 ? 1 + (girthK - 1) * Math.sin(Math.PI * (u - 0.1) / 0.62) : 1),
  };
  G.top = (u) => G.yc(u) + G.hd(u);
  G.bot = (u) => G.yc(u) - G.hd(u);
  // Cross-section: not an ellipse (that reads as an inflated balloon) but a rounded teardrop: an upper
  // ellipse narrower than the body (the back rises to a rounded ridge) united with a wide, flat lower
  // ellipse (the flanks are widest below the axis, at the pectoral level, and the belly is flattish).
  // The snout is flat underneath and conical above; the peduncle (caudal keels) stays wide.
  G.LOW = { dy: 0.3, ry: 0.7 };
  G.wk = (u) => {
    const t1 = Math.max(0, Math.min(1, (u - 0.08) / 0.14)), t2 = Math.max(0, Math.min(1, (u - 0.66) / 0.12));
    const s1 = t1 * t1 * (3 - 2 * t1), s2 = t2 * t2 * (3 - 2 * t2);
    return 0.95 - 0.11 * s1 + 0.09 * s2;
  };
  // surface half width at height y
  G.surfX = (u, y) => {
    const hd = Math.max(1e-6, G.hd(u)), hw = G.hw(u);
    const e = (y - G.yc(u)) / hd;
    const eb = (y - (G.yc(u) - G.LOW.dy * hd)) / (G.LOW.ry * hd);
    return Math.max(hw * G.wk(u) * Math.sqrt(Math.max(0, 1 - e * e)), hw * Math.sqrt(Math.max(0, 1 - eb * eb)));
  };
  // the ventral surface at a fraction f of the half width (f < 1)
  G.belly = (u, f) => G.yc(u) - G.LOW.dy * G.hd(u) - G.LOW.ry * G.hd(u) * Math.sqrt(Math.max(0, 1 - f * f));
  // a point on the flank at (u, height fraction e of the half depth)
  G.flank = (u, e, s = 1) => {
    const y = G.yc(u) + e * G.hd(u);
    return [s * G.surfX(u, y), y, G.z(u)];
  };
  // mouth: the upper lip line in the side view, from the front of the gape (on the underside) to the
  // corner. lipY(u) for u in [uF, uC]
  const H = V.head, M = H.mouth;
  G.uF = M.uF; G.uC = M.uC;
  G.yF = G.bot(M.uF) + 0.0015 * TL;
  G.yC = G.yc(M.uC) + M.eC * G.hd(M.uC);
  G.lipY = (u) => {
    const t = Math.max(0, Math.min(1, (u - M.uF) / (M.uC - M.uF)));
    // rises steeply behind the front, then runs flatter to the corner; `smile` bows it down a little
    return G.yF + (G.yC - G.yF) * Math.pow(t, 0.7) - M.smile * 0.012 * TL * Math.sin(Math.PI * t);
  };
  // the lip arc in 3D (one side), t = 0 front centre .. 1 corner; inset (0..1) toward the midline
  G.lipPoint = (t, s = 1, inset = 0.9, dy = 0) => {
    const u = M.uF + (M.uC - M.uF) * Math.pow(t, 0.75);
    const y = G.lipY(u) + dy;
    const x = G.surfX(u, y) * inset;
    return [s * x, y, G.z(u)];
  };
  const E = H.eye;
  G.eye = { u: E.u, y: G.yc(E.u) + E.e * G.hd(E.u), r: E.r * TL, z: G.z(E.u) };
  // (the smooth unions of the sculpt's sections stand ~0.0033 TL proud of the outline: the eye sits at
  // the real skin)
  G.skinOut = 0.0033 * TL;
  G.eye.x = G.surfX(E.u, G.eye.y) + G.skinOut - 0.3 * G.eye.r;
  G.headO = [0, G.eye.y, G.eye.z];
  // caudal lobes (2D in the median plane: b = backward from the precaudal pit, h = up from the axis)
  const C = V.fins.caudal;
  const ua = C.upAng * D2R, la = C.lowAng * D2R;
  G.caudal = {
    up: C.up * G.tailK, low: C.low * G.tailK * (params.lowLobeK || 1), ua, la,
    pit: [0, G.yc(G.pc), G.z(G.pc)],
    tipUp: [Math.cos(ua) * C.up * G.tailK, Math.sin(ua) * C.up * G.tailK],
  };
  return G;
}

// the pectoral's direction from sweep-back (abduct = angle from straight back toward lateral) and droop
export function pecDir(abduct, droop) {
  const ab = abduct * D2R, dr = droop * D2R;
  return norm([Math.sin(ab) * Math.cos(dr), -Math.sin(dr), -Math.cos(ab) * Math.cos(dr)]);
}

// a fin frame: s = span direction, c = chord direction (forward, orthogonal to s), n = normal
export function finFrame(s) {
  const f = [0, 0, 1];
  const c = norm(sub(f, mul(s, dot(f, s))));
  return { s, c, n: norm(cross(s, c)) };
}

export function sharkJoints(params) {
  const G = sharkGeo(params);
  const V = G.V, TL = G.TL, H = V.head, F = V.fins;
  const N = V.spineSegs, M = V.caudalSegs;
  const J = {};
  J.snout = [0, G.yc(0) + H.snoutY * TL, G.z0];
  for (let i = 0; i <= N; i++) {
    const u = H.occ + ((G.pc - H.occ) * i) / N;
    J[spineName(i)] = [0, G.yc(u), G.z(u)];
  }
  swimmerJointsAlias(J, N);
  // the vertebral column runs up into the upper caudal lobe (heterocercal)
  // the rise is spread over the last joints (a smooth upward curve, no kink at the pit): the last
  // trunk segment pitches up ~0.17 x the lobe angle, then the caudal segments 0.54 / 0.89 / 1.2 x
  const ua = G.caudal.ua;
  const segL = ((G.pc - H.occ) / N) * TL;
  J[spineName(N)][1] += Math.sin(0.17 * ua) * segL;
  swimmerJointsAlias(J, N);
  const cl = G.caudal.up * 0.92 * TL;
  let q = J[spineName(N)].slice();
  const fac = M === 3 ? [0.54, 0.89, 1.2] : Array.from({ length: M }, (_, j) => 0.5 + (0.7 * j) / Math.max(1, M - 1));
  for (let j = 1; j <= M; j++) {
    const a = fac[j - 1] * ua, l = cl / M;
    q = [0, q[1] + Math.sin(a) * l, q[2] - Math.cos(a) * l];
    J['caudal' + j] = q;
  }
  // lower jaw: hinge at the mouth corner, tip at the symphysis
  const Mo = H.mouth;
  J.jawHinge = [0, G.yC - Mo.jawDepth * 0.35 * TL, G.z(Mo.uC + 0.012)];
  J.jawTip = [0, G.yF - 0.004 * TL, G.z(Mo.uF + 0.004)];
  // upper jaw (palatoquadrate): protrudes forward and down on the bite
  J.premaxBase = [0, G.yC + 0.035 * TL, G.z(Mo.uC + 0.01)];
  J.premaxTip = [0, G.yF + 0.012 * TL, G.z(Mo.uF + 0.006)];
  // pectoral fin: base low on the flank behind the gill slits
  const P = F.pectoral;
  const pb = G.flank(P.u, P.e);
  pb[0] -= 0.004 * TL;
  const pd = pecDir(P.abduct, P.droop);
  J.pecBaseL = pb;
  J.pecUpL = add(pb, [0, 0.002 * TL, 0.03 * TL]);
  J.pecTipL = add(pb, mul(pd, P.len * G.finK * G.pecK * TL));
  // pelvic fin: on the belly
  const Q = F.pelvic;
  const yb = G.bot(Q.u);
  const px = G.hw(Q.u) * 0.42;
  const pl = [px, G.belly(Q.u, 0.42) + 0.004 * TL, G.z(Q.u)];
  const qd = norm([Math.sin(Q.abduct * D2R) * 0.9, -0.5, -1.0]);
  J.pelBaseL = pl;
  J.pelFrontL = add(pl, [0.002 * TL, 0, 0.02 * TL]);
  J.pelTipL = add(pl, mul(qd, Q.len * G.finK * TL));
  void yb;
  return { J, G };
}

export function pickParent(G, u) {
  const V = G.V, N = V.spineSegs, occ = V.head.occ;
  const i = Math.max(0, Math.min(N - 1, Math.floor(((u - occ) / (G.pc - occ)) * N)));
  return spineName(i);
}

export function sharkRig(params) {
  const { J, G } = sharkJoints(params);
  const V = G.V, N = V.spineSegs, M = V.caudalSegs;
  return buildRig({
    joints: J,
    unit: G.TL / 1.3,
    headOrigin: G.headO,
    bones: swimmerBones({ spineSegs: N, caudalSegs: M, jaw: true, upperJaw: true, opercula: false, pectoralParent: pickParent(G, V.fins.pectoral.u), pelvicParent: pickParent(G, V.fins.pelvic.u) }),
    axial: { points: axialJoints(N, M), bones: axialBones(N, M) },
    limbs: {},
    appendages: swimmerAppendages({ upperJaw: true, opercula: false, blend: [-0.003, 0.004] }),
    meta: { variant: params.variant, TL: G.TL },
  });
}
