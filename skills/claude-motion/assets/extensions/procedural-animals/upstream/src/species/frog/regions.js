// Meshing plan: body at 0.72 mm (hero), the head (with the throat and the front of the shoulders)
// at 0.5 mm, overlapping across a cut behind the skull and cross-faded, eyelid patches at 0.22 mm,
// and the lower jaw and the tongue as their own rigid surfaces.
import { frogJoints } from './rig.js';
import { EYE } from './sculpt.js';
import { HEAD_O } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { smoothstep } from '../../core/math/vec.js';

const J0 = frogJoints();
// head region: in front of a plane behind the tympana and above the forelimbs
export const HEAD_CUT = { z: 0.0125, y: 0.027, band: 0.0016 };
export const headS = (x, y, z) => Math.min(z - HEAD_CUT.z + 0.1 * (y - 0.05), y - HEAD_CUT.y);

export const EYE_PATCH = { R: 0.0098, B: 0.0014, h: 0.0003, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

export function frogRegions(rig, params, Q) {
  const B = HEAD_CUT.band, r = Q.res;
  const patches = Q.eyePatches ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  const tb = J0.tongueBase, tt = J0.tongueTip;
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-0.115, -0.004, -0.085], bmax: [0.115, 0.075, 0.07], h: 0.0009 * r, F: 4, clip: (x, y, z) => headS(x, y, z) < B }],
      [
        { name: 'head', part: 'body', bmin: [-0.042, 0.02, 0.0], bmax: [0.042, 0.078, 0.095], h: 0.00068 * r, F: 6, clip: (x, y, z) => headS(x, y, z) > -B, patches },
        { name: 'jaw', part: 'jaw', bmin: [-0.036, 0.027, 0.018], bmax: [0.036, 0.05, 0.094], h: 0.00095 * r, F: 6, rigidBone: 'jaw' },
        { name: 'tongue', part: 'tongue', bmin: [-0.012, 0.034, tt[2] - 0.012], bmax: [0.012, 0.052, tb[2] + 0.006], h: 0.0011 * r, F: 4, rigidBone: 'tongue' },
      ],
    ],
    fade(x, y, z, name, patch) {
      const s = headS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, s);
      if (name === 'head') {
        let f = smoothstep(-B, B, s);
        if (patches.length) { const ew = eyePatchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
