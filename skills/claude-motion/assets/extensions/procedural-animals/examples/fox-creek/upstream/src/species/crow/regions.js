// Meshing plan: body (incl. wing arms and legs) at 1.7 mm, head + the top of the neck at 0.86 mm
// (overlapping the body at the cut and cross-faded), eyelid patches at 0.35 mm, and the lower mandible
// as its own rigid surface so the bill can open. Cells scale with the quality tier (Q.res).
import { J } from './joints.js';
import { EYE } from './sculpt.js';
import { HEAD_O, NECK_SEGS } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';

export const NECK_CUT = (() => {
  const d = norm(sub(J.occiput, J['neck' + (NECK_SEGS - 1)]));
  const c = lerp(J['neck' + (NECK_SEGS - 1)], J.occiput, 0.55);
  return { c, d, band: 0.004 };
})();
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const EYE_PATCH = { R: 0.0085, B: 0.0018, h: 0.00035, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

export function crowRegions(rig, params, Q) {
  const B = NECK_CUT.band, r = Q.res;
  const patches = Q.eyePatches ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  return {
    jobs: [
      [
        { name: 'body', part: 'body', bmin: [-0.19, -0.004, -0.15], bmax: [0.19, 0.3, 0.14], h: 0.0017 * r, F: 4, clip: (x, y, z) => neckS(x, y, z) < B },
      ],
      [
        { name: 'head', part: 'body', bmin: [-0.035, 0.225, 0.015], bmax: [0.035, 0.335, 0.192], h: 0.00086 * r, F: 6, clip: (x, y, z) => neckS(x, y, z) > -B, patches },
        { name: 'jaw', part: 'jaw', bmin: [-0.014, 0.262, 0.1], bmax: [0.014, 0.296, 0.19], h: 0.00068 * r, F: 6, rigidBone: 'jaw' },
      ],
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN);
      if (name === 'head') {
        // (the head surface reaches 1.5 mm past the body's cut: the two overlap instead of leaving a
        // see-through crack where the meshes do not coincide exactly)
        let f = smoothstep(-B - 0.0015, B - 0.0015, sN);
        if (patches.length) { const ew = eyePatchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
