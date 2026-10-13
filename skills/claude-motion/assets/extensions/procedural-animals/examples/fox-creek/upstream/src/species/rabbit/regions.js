// Meshing plan: body at 1.85 mm, head (with the thin ears) at 1.1 mm, overlapping across the upper
// neck and cross-faded, eyelid patches at 0.45 mm, and the lower jaw as its own rigid surface.
import { rabbitJoints, HEAD_O } from './rig.js';
import { EYE } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';

const J0 = rabbitJoints();
export const NECK_CUT = (() => {
  const d = norm(sub(J0.occiput, J0.neckBase));
  const c = lerp(J0.neckMid, J0.occiput, 0.3);
  return { c, d, band: 0.004 };
})();
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const EYE_PATCH = { R: 0.0135, B: 0.002, h: 0.00045, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

export function rabbitRegions(rig, params, Q) {
  const B = NECK_CUT.band, r = Q.res;
  const patches = Q.eyePatches ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  const lop = !!params.lop;
  // lop ears hang below the neck cut: keep them in the finely meshed head region
  const sH = lop ? (x, y, z) => Math.max(neckS(x, y, z), Math.min(Math.abs(x) - 0.036, z - 0.1, 0.16 - y)) : neckS;
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-0.1, -0.012, -0.2], bmax: [0.1, 0.23, 0.15], h: 0.00185 * r, F: 4, clip: (x, y, z) => sH(x, y, z) < B }],
      [
        { name: 'head', part: 'body', bmin: [-0.075, lop ? 0.09 : 0.12, 0.07], bmax: [0.075, 0.345, 0.225], h: 0.0011 * r, F: 6, clip: (x, y, z) => sH(x, y, z) > -B, patches },
        { name: 'jaw', part: 'jaw', bmin: [-0.03, 0.15, 0.115], bmax: [0.03, 0.215, 0.2], h: 0.00105 * r, F: 6, rigidBone: 'jaw' },
      ],
    ],
    fade(x, y, z, name, patch) {
      const sN = sH(x, y, z);
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
