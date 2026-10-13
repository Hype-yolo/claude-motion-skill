// Meshing plan: body at 6.7 mm (0.9 % of the withers height), head at 3.3 mm overlapping the body
// across the upper neck and cross-faded, eyelid patches at 0.9 mm, the lower lip / chin as its own
// rigid surface (the mouth opens), the tusks as rigid ivory surfaces (lower on the jaw, upper on the
// skull).
//
// Seam. The skinning relaxes the axial coordinate and solves the limb fields over each surface
// separately, so the two overlapping surfaces move alike only where their weights do not depend on the
// surface. The throat and the lower neck lie beside the upper arms, and the forelimb field of the body
// surface reaches into them (the head surface has no limb at all): a cut through them tore open
// whenever a foreleg or the head moved. So the cut leans forward at the bottom (like the horse's and
// the cow's): behind the ears at the top, in front of the throat below (the throat, the jowl angle and
// the lower neck belong to the body surface), and far in front of the forefeet (a cut leaning back
// reached the ground at z 0.21 m and cut off the fore claws). Both surfaces carry on past the band by
// M (the relaxation is one-sided next to a surface's open edge), and the band widens with the tier so
// it is always wider than a body cell.
import { EYE, tuskPath } from './sculpt.js';
import { HEAD_O, hl } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { norm, smoothstep } from '../../core/math/vec.js';

const ENV = (typeof process !== 'undefined' && process.env) || {};
const cutC = ENV.BOAR_CUT_C ? ENV.BOAR_CUT_C.split(',').map(Number) : [0, 0.62, 0.40];
const cutD = ENV.BOAR_CUT_D ? ENV.BOAR_CUT_D.split(',').map(Number) : [0, 0.45, 1];
export const NECK_CUT = { c: cutC, d: norm(cutD), band: 0.014 };
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const EYE_PATCH = { R: 0.02, B: 0.004, h: 0.0009, centres: [1, -1].map((c) => eyeFrameOf(EYE, HEAD_O, c).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

// head-local box -> world bounds
function boxOf(lo, hi, pad = 0) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
    const p = hl([x, y, z]);
    for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i] - pad); mx[i] = Math.max(mx[i], p[i] + pad); }
  }
  return [mn, mx];
}
function pathBox(paths, pad) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const P of paths) for (const q of P) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], q.p[i] - q.r - pad); mx[i] = Math.max(mx[i], q.p[i] + q.r + pad); }
  return [mn, mx];
}

export function boarRegions(rig, params, Q) {
  const r = Q.res;
  const hBody = 0.0067 * r, hHead = 0.0033 * r;
  // the band is wider than a body cell at every tier; both surfaces run on past it by M
  const B = Math.max(NECK_CUT.band, 1.2 * hBody), M = Math.min(3 * hBody, 0.04);
  const patches = Q.eyePatches ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  const [hmn, hmx] = boxOf([-0.16, -0.22, -0.3], [0.16, 0.26, 0.36], 0.02);
  const [jmn, jmx] = boxOf([-0.06, -0.14, -0.12], [0.06, -0.03, 0.32], 0.01);
  const head = [
    { name: 'head', part: 'body', bmin: hmn, bmax: hmx, h: hHead, F: 6, clip: (x, y, z) => neckS(x, y, z) > -B - M, patches },
    { name: 'jaw', part: 'jaw', bmin: jmn, bmax: jmx, h: hHead, F: 6, rigidBone: 'jaw' },
  ];
  const lower = [tuskPath(params, 1, 'lower'), tuskPath(params, -1, 'lower')].filter((p) => p.length);
  const upper = [tuskPath(params, 1, 'upper'), tuskPath(params, -1, 'upper')].filter((p) => p.length);
  if (lower.length) {
    const [a, b] = pathBox(lower, 0.012);
    head.push({ name: 'tusk', part: 'tusk', bmin: a, bmax: b, h: 0.0015 * r, F: 6, rigidBone: 'jaw' });
  }
  if (upper.length) {
    const [a, b] = pathBox(upper, 0.012);
    head.push({ name: 'tuskup', part: 'tuskup', bmin: a, bmax: b, h: 0.0015 * r, F: 6, rigidBone: 'head' });
  }
  return {
    jobs: [
      // (the box floor lies a few cells under the soles: the claws are meshed whole at every tier)
      [{ name: 'body', part: 'body', bmin: [-0.28, -0.03, -0.68], bmax: [0.28, 0.82, 0.62], h: hBody, F: 4, clip: (x, y, z) => neckS(x, y, z) < B + M }],
      head,
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN);
      if (name === 'head') {
        let f = smoothstep(-B, B, sN);
        if (patches.length) { const ew = eyePatchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
