// Meshing plan: body at 2.8 mm (0.7 % of the withers height), head at 1.35 mm (overlapping across the
// upper neck and cross-faded), eyelid patches at ~0.7 mm, and the lower jaw as its own surface so the
// mouth can open.
import { foxJoints, HEAD_O } from './rig.js';
import { eyeOf } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';

// the neck cut is fixed in reference space (joints of the reference individual)
const J0 = foxJoints();
export const NECK_CUT = (() => {
  const d = norm(sub(J0.occiput, J0.neckMid));
  const c = lerp(J0.neckMid, J0.occiput, 0.75);
  return { c, d, band: 0.0065 };
})();
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const eyeCentres = (params) => [1, -1].map((s) => eyeFrameOf(eyeOf(params), HEAD_O, s).c);
const PATCH = { R: 0.017, B: 0.003, h: 0.0007 };
function eyePatchWeight(centres, R, B, x, y, z) {
  let dmin = 1e9;
  for (const c of centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(R - B, R + B, dmin);
}

export function foxRegions(rig, params, Q) {
  // the cross-fade band grows with the coarser (body) cell: at the low and crowd tiers the body cells
  // (9-13 mm) were bigger than a fixed 6.5 mm band, so the body's clip rim could land on the visible
  // side of the band and open the skin beside the cheeks (exposed holes, low / crowd)
  const r = Q.res, B = Math.max(NECK_CUT.band, 1.6 * 0.003 * r);
  const ek = params.eyeK || 1;
  const PR = PATCH.R * ek, PB = PATCH.B * ek;
  const centres = eyeCentres(params);
  const patches = Q.eyePatches ? centres.map((c) => ({ c, R: PR, B: PB, h: PATCH.h * Math.max(1, r) })) : [];
  const zN = rig.J.nose[2] + 0.02;
  const hw = params.headW || 1;
  return {
    jobs: [
      // (the body box reaches past the jaw hinge: the neck cut runs steeply down through the back of the
      // jaw, and the jowl's lower front, flush with the jaw's lower line, still lies on the body's side of
      // the band there (z ~0.38-0.40); a box face at 0.38 cut it open)
      [{ name: 'body', part: 'body', bmin: [-0.11, -0.02, -0.62], bmax: [0.11, 0.52, 0.42], h: 0.003 * r, F: 4, clip: (x, y, z) => neckS(x, y, z) < B }],
      [
        { name: 'head', part: 'body', bmin: [-0.08, 0.3, 0.22], bmax: [0.08, 0.58, zN], h: 0.00142 * r, F: 6, clip: (x, y, z) => neckS(x, y, z) > -B, patches },
        { name: 'jaw', part: 'jaw', bmin: [-0.035 * hw, 0.34, 0.31], bmax: [0.035 * hw, 0.41, zN], h: 0.00135 * r, F: 6, rigidBone: 'jaw' },
      ],
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN);
      if (name === 'head') {
        let f = smoothstep(-B, B, sN);
        if (patches.length) { const ew = eyePatchWeight(centres, PR, PB, x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
