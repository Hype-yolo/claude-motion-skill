// Meshing plan: body at 5.6 mm (0.8 % of the withers height; the fleece makes a large surface),
// head at 2.6 mm overlapping the body across the upper neck and cross-faded, eyelid patches at
// 0.9 mm, the lower lip / chin as its own rigid surface (the mouth opens) and the horns as a rigid
// keratin surface on the skull.
import { EYE } from './sculpt.js';
import { HEAD_O, hl } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { smoothstep } from '../../core/math/vec.js';

export { NECK_CUT, neckS } from './neck.js';
import { NECK_CUT, neckS } from './neck.js';

export const EYE_PATCH = { R: 0.024, B: 0.004, h: 0.0011, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
// the front of the nose re-meshed finer too: the nostril slits (7 x 20 mm carves) and the philtrum came out of
// the 4-5 mm face cells as ragged dark blotches; ~1.2 mm cells (2.4 at medium) give clean slits
export const NOSE_PATCH = { R: 0.024, B: 0.004, h: 0.0012, centres: [hl([0, -0.022, 0.195])] };
const ballWeight = (P, x, y, z) => {
  let dmin = 1e9;
  for (const c of P.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(P.R - P.B, P.R + P.B, dmin);
};
export const eyePatchWeight = (x, y, z) => ballWeight(EYE_PATCH, x, y, z);
// (the patches lie far apart: a point is in one at most)
export const patchWeight = (x, y, z) => Math.max(ballWeight(EYE_PATCH, x, y, z), ballWeight(NOSE_PATCH, x, y, z));

export function sheepRegions(rig, params, Q) {
  const r = Q.res;
  const W = 0.2 + (params.wool || 0) * 1.3;
  const hBody = 0.0065 * (1 + 1.6 * (params.wool || 0)) * r;
  // (the band is wider than a body cell, so the body's cut edge, which lies up to a cell into the band,
  // stays in its hidden half: at the low and crowd tiers a 12 mm band left it on show, an open seam
  // across the top of the neck)
  const B = Math.max(NECK_CUT.band, hBody * 1.2);
  // (eyelid patches at medium too: Safari and phones show medium, and the coarse face cut the almond into a
  // ragged notch)
  const patches = (Q.eyePatches || r <= 2) ? [EYE_PATCH, NOSE_PATCH].flatMap((P) => P.centres.map((c) => ({ c, R: P.R, B: P.B, h: P.h * Math.max(1, r) }))) : [];
  // (the face a little finer at medium: the nostril slits and the lip line came out ragged)
  const hm = r === 2 ? 0.78 : 1;
  const head = [
    { name: 'head', part: 'body', bmin: [-0.3, 0.5, 0.3], bmax: [0.3, 1.05, 0.8], h: 0.0031 * r * hm, F: 6, clip: (x, y, z) => neckS(x, y, z) > -B, patches },
    { name: 'jaw', part: 'jaw', bmin: [-0.05, 0.5, 0.45], bmax: [0.05, 0.8, 0.8], h: 0.0027 * r * hm, F: 6, rigidBone: 'jaw' },
  ];
  if (params.horns && params.horns.turns > 0) {
    head.push({ name: 'horn', part: 'horn', bmin: [-0.36, 0.5, 0.2], bmax: [0.36, 1.12, 0.8], h: (params.horns.base > 0.025 ? 0.0042 : 0.003) * r, F: 6, rigidBone: 'head' });
  }
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-W - 0.02, -0.01, -0.62 - W], bmax: [W + 0.02, 1.02, 0.72], h: hBody, F: 4, clip: (x, y, z) => neckS(x, y, z) < B }],
      head,
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN);
      if (name === 'head') {
        let f = smoothstep(-B, B, sN);
        if (patches.length) { const ew = patchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
