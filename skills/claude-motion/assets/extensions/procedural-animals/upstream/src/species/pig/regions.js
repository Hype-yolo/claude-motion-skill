// Meshing plan: body at 7.8 mm (1.1 % of the withers height: the barrel's skin area is ~1.6x the
// cheetah's), the face at 4.1 mm overlapping the body just behind the eyes and cross-faded, the feet
// below mid-cannon at 3.5 mm (the cleft and the dew claws read), eyelid patches at 0.9 mm, and
// separate surfaces: the lower jaw (lower lip, chin; rigid), the boar's tusks (1.2 mm, rigid on the jaw), the ears (rigid on the
// ear bones, their thick roots buried in the head) and the corkscrew tail (its own skinned surface at
// 2 mm, the root buried in the rump).
//
// Seams. The skinning relaxes the axial coordinate and solves the limb fields over each surface
// separately, so two overlapping surfaces agree only where the weights do not depend on the
// surface: the face cut lies in front of the jowls (the jowls touch the shoulders, and the body's
// limb field reached into them while the head surface had no limb at all: the neck cracked open
// when the head went down), the foot cut on the rigid cannon; the overlaps run on well past the
// fade line (M), since the relaxation is one-sided next to a surface's open edge.
import { EYE, earShape, tuskCones } from './sculpt.js';
import { EAR_CELL } from './ears.js';
import { HEAD_O, HZ, hl } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { smoothstep, norm } from '../../core/math/vec.js';

// The face is cut off across the head behind the eyes: below the eye line by a plane slanting forward
// to the throat (in front of the jowls, see above), above it by a plane across the head axis 5 cm behind
// the eyes. The upper plane keeps the switch line in front of the poll: behind it (the slanted plane
// alone reached 16 cm back there, behind the occiput) both surfaces carry ~25 % neck2 weight, relaxed
// differently on each, and they parted by up to 6 mm when the head lay on its side (lie, sleep, death).
// Here both carry the head bone alone. (smooth minimum of the two signed distances, k 2 cm)
export const NECK_CUT = { c: hl([0, 0, -0.035]), d: norm([0, 0.4, 1]), top: hl([0, 0, -0.05]), band: 0.012 };
export const neckS = (x, y, z) => {
  const a = (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];
  const b = (y - NECK_CUT.top[1]) * HZ[1] + (z - NECK_CUT.top[2]) * HZ[2];
  const k = 0.02, h = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
};
// feet: below mid-cannon
export const FOOT_CUT = { y: 0.105, band: 0.007 };

export const EYE_PATCH = { R: 0.023, B: 0.003, h: 0.0009, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

function boxOf(pts, pad) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of pts) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i] - pad); mx[i] = Math.max(mx[i], p[i] + pad); }
  return [mn, mx];
}

export function pigRegions(rig, params, Q) {
  // (the cross-fade bands are wider than the coarser surface's cells at every tier)
  const r = Q.res, B = NECK_CUT.band * (0.6 + 0.4 * r), FB = FOOT_CUT.band * (0.3 + 0.7 * r), FY = FOOT_CUT.y;
  const J = rig.J;
  // eyelid patches at hero / high (0.9 / 1.2 mm) and, the pig's own, at medium (1.8 mm): the lids of the
  // 22 x 12 mm aperture meshed at the medium head cells (8.6 mm) came out as a jagged notch (Safari, phones)
  const patches = Q.eyePatches || r <= 2 ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B * Math.max(1, r), h: r > 1.5 ? 0.0021 : EYE_PATCH.h * Math.max(1, r) })) : [];
  const crowd = r >= 4;
  const hBody = 0.0078 * r, hHead = 0.0041 * r * (1 + 0.05 * (r - 1)), hFeet = 0.0035 * (crowd ? 4.2 : Math.min(r, 2.4));
  // overlapping surfaces sample the field on the same coarse spacing as the body (F x h ~ 4 body
  // cells): the primitive lists a vertex is skinned from are then culled alike on both sides
  const Fof = (h) => Math.max(3, Math.round((4 * hBody) / h));
  const M = Math.min(3.5 * hBody, 0.04);
  const tailPts = [J.tailBase];
  for (let i = 1; i <= 10; i++) if (J['tail' + i]) tailPts.push(J['tail' + i]);
  const [tmin, tmax] = boxOf(tailPts, 0.025);
  const [hmin, hmax] = boxOf([J.nose, J.jawHinge, J.jawTip, hl([0, 0.1, -0.05]), hl([0.12, -0.15, -0.05]), hl([-0.12, -0.15, -0.05])], 0.06);
  const ear = (S, h, F) => { const [bmin, bmax] = boxOf(earShape(J, params, S).pts, 0.05); return { name: 'ear' + S, part: 'ear' + S, bmin, bmax, h, F, rigidBone: 'ear' + S }; };
  // the boar's tusks: a small rigid surface each at 1.2 mm (x res), their roots buried in the lower lip (in the jaw's
  // 3 mm cells the 1.2-7 mm cone meshed as a crumpled blade)
  const tusks = (params.tusks || 0) > 0.05 ? [1, -1].map((s) => {
    const pts = []; for (const c of tuskCones(params, s)) pts.push(c.a, c.b);
    const [bmin, bmax] = boxOf(pts, 0.012);
    return { name: s > 0 ? 'tuskL' : 'tuskR', part: 'tusk', bmin, bmax, h: 0.0012 * r, F: 3, rigidBone: 'jaw' };
  }) : [];
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-0.3, Math.max(-0.01, FY - FB - M - hBody), -0.72], bmax: [0.3, 0.84, 0.8], h: hBody, F: 4, clip: (x, y, z) => neckS(x, y, z) < B + M && y > FY - FB - M }],
      [
        { name: 'head', part: 'body', bmin: hmin, bmax: hmax, h: hHead, F: Fof(hHead), clip: (x, y, z) => neckS(x, y, z) > -B - M, patches },
        { name: 'jaw', part: 'jaw', bmin: [-0.1, 0.3, 0.5], bmax: [0.1, 0.62, 0.84], h: 0.003 * r * (r > 2 ? 0.8 : 1), F: 6, rigidBone: 'jaw' },
        // (the leaves are at least 1.8 of these cells thick at every tier, ears.js)
        ear('L', EAR_CELL * r, 3), ear('R', EAR_CELL * r, 3),
        ...tusks,
      ],
      [
        { name: 'feet', part: 'body', bmin: [-0.16, -0.01, -0.45], bmax: [0.16, FY + FB + M + hFeet, 0.45], h: hFeet, F: Fof(hFeet), clip: (x, y, z) => y < FY + FB + M },
        { name: 'tail', part: 'tail', bmin: tmin, bmax: tmax, h: 0.002 * Math.min(r, 3.6), F: 3 },
      ],
    ],
    fade(x, y, z, name, patch) {
      if (name === 'body') return (1 - smoothstep(-B, B, neckS(x, y, z))) * smoothstep(FY - FB, FY + FB, y);
      if (name === 'feet') return 1 - smoothstep(FY - FB, FY + FB, y);
      if (name === 'head') {
        let f = smoothstep(-B, B, neckS(x, y, z));
        if (patches.length) { const ew = eyePatchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
