// Meshing plan: body at 10.7 mm (0.66 % of the withers height), head at 5.1 mm overlapping the body
// across the upper neck and cross-faded, eyelid patches at 1.6 mm, and the lower lip / chin as its
// own rigid surface so the mouth can open.
import { EYE } from './sculpt.js';
import { HEAD_O, horseJoints } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { norm, smoothstep } from '../../core/math/vec.js';

const J = horseJoints();
// the head hangs steeply from the neck: cut just behind the poll - throat latch line
export const NECK_CUT = { c: [0, 1.7, J.occiput[2] - 0.045], d: norm([0, 0.25, 1]), band: 0.024 };
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const EYE_PATCH = { R: 0.042, B: 0.007, h: 0.0016, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

// Cell sizes (x Q.res): body and head. The head / body cross-fade band B widens with the body's cell
// at the coarse tiers (at least one body cell), and the two surfaces overlap by OV: across the middle
// of the band both are drawn (fade > 0.5), so the fur does not thin where two half-faded shell stacks
// meet (a dark seam over the under-shell base) and no crack opens between them.
export const H_BODY = 0.0111, H_HEAD = 0.0051;
export function neckBand(r) {
  const B = Math.max(NECK_CUT.band, 1.1 * H_BODY * r), OV = 0.5 * B;
  // Each surface runs on 2-3 of its own cells past the band, where it is hidden (fade 0): its ragged
  // clip edge stays out of view, and its band vertices are not biased by the edge (the axial skin
  // coordinate is relaxed over each surface separately, so near an edge it drifts by about a cell)
  return { B, OV, clipBody: B + OV + 3 * H_BODY * r, clipHead: B + OV + 2 * H_HEAD * r };
}
export const neckFade = (sN, name, r) => {
  const { B, OV } = neckBand(r);
  return name === 'body' ? 1 - smoothstep(-B, B, sN - OV) : smoothstep(-B, B, sN + OV);
};

export function horseRegions(rig, params, Q) {
  const r = Q.res, { B, OV, clipBody, clipHead } = neckBand(r);
  const patches = Q.eyePatches ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-0.46, -0.01, -1.12], bmax: [0.46, 2.2, 1.3], h: H_BODY * r, F: 4, clip: (x, y, z) => neckS(x, y, z) < clipBody }],
      [
        { name: 'head', part: 'body', bmin: [-0.2, 1.25, 0.88], bmax: [0.2, 2.3, 1.72], h: H_HEAD * r, F: 6, clip: (x, y, z) => neckS(x, y, z) > -clipHead, patches },
        { name: 'jaw', part: 'jaw', bmin: [-0.08, 1.3, 1.2], bmax: [0.08, 1.72, 1.72], h: H_HEAD * r, F: 6, rigidBone: 'jaw' },
      ],
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN - OV);
      if (name === 'head') {
        let f = smoothstep(-B, B, sN + OV);
        if (patches.length) { const ew = eyePatchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
