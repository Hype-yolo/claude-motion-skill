// Meshing plan: body at 5.2 mm, head at 2.5 mm (overlapping across the upper neck and cross-faded),
// eyelid patches at 1 mm, and the lower jaw as its own surface so the mouth can open.
import { wolfJoints, HEAD_O } from './rig.js';
import { eyeOf } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';

// the neck cut is fixed in reference space (joints of the reference individual)
const J0 = wolfJoints();
export const NECK_CUT = (() => {
  const d = norm(sub(J0.occiput, J0.neckMid));
  const c = lerp(J0.neckMid, J0.occiput, 0.5);
  return { c, d, band: 0.02 };
})();
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const eyeCentres = (params) => [1, -1].map((s) => eyeFrameOf(eyeOf(params), HEAD_O, s).c);
const PATCH = { R: 0.021, B: 0.004, h: 0.001 };
// Eyelid patches at hero, high and medium: medium's 5 mm face cells drew the 22 x 10.5 mm lid aperture
// as a jagged crown; its patches are meshed at 2 mm, with the cross-fade band a face cell wide.
export const eyePatchOf = (Q) => (Q.eyePatches || Q.res <= 2 ? { R: PATCH.R, B: Math.max(PATCH.B, 0.0025 * Q.res), h: PATCH.h * Math.max(1, Q.res) * (Q.eyePatches ? 1 : 1.25) } : null);
function eyePatchWeight(centres, P, x, y, z) {
  let dmin = 1e9;
  for (const c of centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(P.R - P.B, P.R + P.B, dmin);
}

export function wolfRegions(rig, params, Q) {
  const B = NECK_CUT.band, r = Q.res, OV = 0.006 * Math.max(1, r / 2);
  const centres = eyeCentres(params);
  const EP = eyePatchOf(Q);
  const patches = EP ? centres.map((c) => ({ c, R: EP.R, B: EP.B, h: EP.h })) : [];
  const zN = rig.J.nose[2] + 0.03;
  return {
    jobs: [
      // (each clip lies a full cell past its surface's visible half of the band (fade midpoint at +-OV):
      // a clip nearer than one cell dropped a row of visible cells at the coarse tiers, a ring of holes
      // round the top of the neck at crowd)
      [{ name: 'body', part: 'body', bmin: [-0.2, -0.03, -0.9], bmax: [0.2, 0.9, 0.66], h: 0.0052 * r, F: 4, clip: (x, y, z) => neckS(x, y, z) < B + OV + 0.0052 * r }],
      [
        { name: 'head', part: 'body', bmin: [-0.13, 0.55, 0.22], bmax: [0.13, 0.96, zN], h: 0.0025 * r, F: 6, clip: (x, y, z) => neckS(x, y, z) > -B - OV - 0.0025 * r, patches },
        { name: 'jaw', part: 'jaw', bmin: [-0.065, 0.63, 0.52], bmax: [0.065, 0.73, zN], h: 0.0025 * r, F: 6, rigidBone: 'jaw' },
      ],
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      // the two surfaces overlap by OV (both drawn) so no crack opens where they are not coincident
      if (name === 'body') return 1 - smoothstep(-B, B, sN - OV);
      if (name === 'head') {
        let f = smoothstep(-B, B, sN + OV);
        if (patches.length) { const ew = eyePatchWeight(centres, EP, x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
