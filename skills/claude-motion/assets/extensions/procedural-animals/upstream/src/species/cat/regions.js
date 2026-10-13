// Meshing plan: body at 2 mm, head at 1 mm (overlapping across the upper neck and cross-faded),
// eyelid patches at 0.4 mm, and the lower jaw as its own surface so the mouth can open. (The cheetah's
// plan scaled to a cat: 0.7 % of the withers height for the body, the head at half that.)
import { catJoints, HEAD_O } from './rig.js';
import { eyeOf } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';
import { harmonizeSeamWeights as harmonizeCore } from '../../core/build/seams.js';

// the neck cut is fixed in reference space (joints of the reference individual)
const J0 = catJoints();
export const NECK_CUT = (() => {
  const d = norm(sub(J0.occiput, J0.neckMid));
  const c = lerp(J0.neckMid, J0.occiput, 0.8); // (close to the skull: the fine head mesh stays off the bending neck)
  return { c, d, band: 0.004 };
})();
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const eyeCentres = (params) => [1, -1].map((s) => eyeFrameOf(eyeOf(params), HEAD_O, s).c);
const PATCH = { R: 0.0165, B: 0.0025, h: 0.0004 }; // (inner radius 14 mm: the aperture rim at the skin lies at ~12.3 mm)
function eyePatchWeight(centres, x, y, z) {
  let dmin = 1e9;
  for (const c of centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(PATCH.R - PATCH.B, PATCH.R + PATCH.B, dmin);
}

export const CELL = { body: 0.00205, head: 0.00102 };

export function catRegions(rig, params, Q) {
  const B = NECK_CUT.band, r = Q.res;
  const centres = eyeCentres(params);
  // Without fur shells (crowd tier) the coarse body surface and the head surface do not coincide in
  // the overlap band: each stays visible past the cut by D (the depth test picks the outer one)
  // (the low tier's coarse body cells, 6 mm, leave the same gap at the sides of the neck: both surfaces are
  // drawn across an overlap there as well)
  // (a kitten's big head (x1.28, warped after meshing) spreads the two surfaces further apart in the band: more overlap;
  // so does a longhair's sculpted ruff round the neck: single open edges at the side of the neck at the low tier)
  const D = Q.shells > 0 && r < 2.5 ? 0 : (Q.shells > 0 ? 0.6 : 0.85) * CELL.body * r * (params.juv || params.longhair ? 1.6 : 1);
  // (medium too: Safari on a Mac and phones show medium, and its 2 mm face cells drew the lid margin in steps;
  // the two patches at 1 mm cost ~4.5k vertices of the tier's 32k)
  // (the head and body surfaces reach 3 body cells further across the cut, hidden by the fade, below the hero tier and on
  // kittens: the skin weights are smoothed over each mesh, one-sidedly near a region's edge, so the two surfaces' weights in
  // the band differed by 0.1-0.2 (the coarser the cells, the more; on a kitten, whose head / neck blend is shorter, rig.js,
  // also at hero) and they parted by up to 4.6 mm at the side of the neck when the head turned: red specks at the jowl's
  // outline in the 'holes' view at medium; seed 13: 4.6 -> 1.8 mm medium, 2.9 -> 1.5 high; vertices high <= 76.9k, medium
  // <= 30.2k over seeds 1-40. Hero, without: <= 1.6 mm, within its 130k)
  const M = (params.juv || r > 1.1 ? 3 : 0) * CELL.body * r;
  const patches = Q.eyePatches || (Q.shells > 0 && r <= 2) ? centres.map((c) => ({ c, R: PATCH.R, B: PATCH.B, h: PATCH.h * Math.max(1, r) * (Q.eyePatches ? 1 : 1.25) })) : [];
  const zTail = rig.J['tail' + (Object.keys(rig.J).filter((k) => /^tail\d+$/.test(k)).length - 1)][2];
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-0.085, -0.012, Math.min(-0.5, zTail - 0.03)], bmax: [0.085, 0.3, 0.2], h: CELL.body * r, F: 4, clip: (x, y, z) => neckS(x, y, z) < B + D + M }],
      [
        { name: 'head', part: 'body', bmin: [-0.065, 0.17, 0.12], bmax: [0.065, 0.325, 0.262], h: CELL.head * r, F: 6, clip: (x, y, z) => neckS(x, y, z) > -B - D - M, patches },
        // (the box takes the whole mandible: its rounded rear ends reach z 0.168, and a cut there showed as an open edge
        // under a big head)
        { name: 'jaw', part: 'jaw', bmin: [-0.03, 0.195, 0.162], bmax: [0.03, 0.228, 0.25], h: CELL.head * r, F: 6, rigidBone: 'jaw' },
      ],
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN - D);
      if (name === 'head') {
        let f = smoothstep(-B, B, sN + D);
        if (patches.length) { const ew = eyePatchWeight(centres, x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}

// The head and the body surfaces overlap across the neck cut, and the core smooths each surface's skin weights over its
// own mesh (3 neighbour passes: ~1.5 mm on the 1 mm head cells, ~3 mm on the 2 mm body cells), so where the weights curve
// (the occiput blend, the lips group behind the jowl) the two surfaces at one place took head / neck2 shares 0.05-0.07
// apart. Posed, they part where the head bends far against the neck (2.8 mm, hero 3.5, on the side of the cheek of the
// dead blue tom, seed 12; standing 0.2), and at the hand-over the fur rooted on the surface that lies under the other's
// skin loses its roots: a crisp edge across the cheek, the head's fur dark and velvety on one side, the neck's coarse and
// pale on the other, an unsmoothed seam between the parts. Here the body surface near the cut takes the head surface's
// weights at the same place (the closest point on the finer head mesh, barycentric), in full across the cross-fade band
// and fading back to its own over the next 8 mm on the body side.
export function harmonizeSeamWeights(ctx) { return harmonizeCore(ctx, neckS, NECK_CUT.band); }
