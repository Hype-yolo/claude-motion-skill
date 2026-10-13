// Meshing plan: body (incl. wing arms and legs) at 3.2 mm, head + the top of the neck at 1.5 mm
// (overlapping the body at the cut and cross-faded), eyelid patches at 0.6 mm, and the lower mandible
// as its own rigid surface so the bill can open. Cells scale with the quality tier (Q.res).
import { J } from './joints.js';
import { EYE } from './sculpt.js';
import { HEAD_O, NECK_SEGS } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';

export const NECK_CUT = (() => {
  const d = norm(sub(J.occiput, J['neck' + (NECK_SEGS - 1)]));
  const c = lerp(J['neck' + (NECK_SEGS - 1)], J.occiput, 0.65);
  return { c, d, band: 0.008 };
})();
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const EYE_PATCH = { R: 0.0205, B: 0.0035, h: 0.0006, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

export function eagleRegions(rig, params, Q) {
  const B = NECK_CUT.band, r = Q.res;
  const patches = Q.eyePatches ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  const [hx, hy, hz] = HEAD_O;
  const hBody = 0.0038 * r, hHead = 0.0018 * r;
  // Each surface is cut two of its cells past the far edge of the band, not at the edge: the mesher
  // keeps a cell by its centre and its vertex may sit ~1.5 cells from there, so at the coarse tiers
  // (a 16 mm crowd cell vs the +-8 mm band) a cut at the band edge landed on the visible side of the
  // cross-fade and left an open rim under the head (the head's fade midline is 3 mm below the body's).
  const cutBody = B + 2 * hBody, cutHead = B + 0.003 + 2 * hHead;
  return {
    jobs: [
      [
        { name: 'body', part: 'body', bmin: [-0.44, -0.006, -0.28], bmax: [0.44, 0.62, 0.26], h: hBody, F: 4, clip: (x, y, z) => neckS(x, y, z) < cutBody },
      ],
      [
        { name: 'head', part: 'body', bmin: [hx - 0.1, hy - 0.23, hz - 0.18], bmax: [hx + 0.1, hy + 0.06, hz + 0.125], h: hHead, F: 6, clip: (x, y, z) => neckS(x, y, z) > -cutHead, patches },
        { name: 'jaw', part: 'jaw', bmin: [hx - 0.022, hy - 0.05, hz - 0.02], bmax: [hx + 0.022, hy - 0.015, hz + 0.1], h: 0.0012 * r, F: 6, rigidBone: 'jaw' },
      ],
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN);
      if (name === 'head') {
        // (the head surface reaches 3 mm past the body's cut: the two overlap instead of leaving a
        // see-through crack where the meshes do not coincide exactly)
        let f = smoothstep(-B - 0.003, B - 0.003, sN);
        if (patches.length) { const ew = eyePatchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
