// Meshing plan: body at 7.8 mm (0.78 % of the hump height), head at 3.6 mm overlapping the body
// across the upper neck and cross-faded, eyelid patches at 1.2 mm, and the lower jaw as its own
// surface so the mouth can open.
import { bearJoints, HEAD_O, hlOf } from './rig.js';
import { eyeOf } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';

// the neck cut is fixed in reference space (joints of the reference individual)
const J0 = bearJoints();
export const NECK_CUT = (() => {
  const d = norm(sub(J0.occiput, J0.neckMid));
  const c = lerp(J0.neckMid, J0.occiput, 0.55);
  return { c, d, band: 0.02 };
})();
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const eyeCentres = (params) => [1, -1].map((s) => eyeFrameOf(eyeOf(params), HEAD_O, s).c);
const PATCH = { R: 0.024, B: 0.005, h: 0.0012 };
// the nose pad re-meshed finer (nostrils ~13 mm across, a 5 mm groove: at the head's 3.6-7.2 mm cells they were
// dimples or nothing), at every tier with shells (hero 1.8 mm, high 2.3 mm, medium 3.6 mm)
const NOSE_PATCH = { R: 0.04, B: 0.005, h: 0.0018 };
export const eyePatchesAt = (Q) => !!Q && (Q.eyePatches || Q.res <= 2.01);
export const noseCentre = (params) => hlOf(params.muzzle || 1, params.headW || 1)([0, -0.002, 0.212]);
function patchWeight(patches, x, y, z) {
  let w = 0;
  for (const p of patches) w = Math.max(w, 1 - smoothstep(p.R - p.B, p.R + p.B, Math.hypot(x - p.c[0], y - p.c[1], z - p.c[2])));
  return w;
}

export function bearRegions(rig, params, Q) {
  const r = Q.res;
  // the cross-fade band is at least 1.5 body cells wide on either side of the cut: at the coarse tiers
  // a 2 cm band was a single body cell and the body's clipped edge showed at the side of the neck
  const B = Math.max(NECK_CUT.band, 1.5 * 0.0078 * r);
  // each mesh carries on past the far side of the band, hidden (fade 0): the skin weights relax the axial coordinate
  // over each mesh on its own, and near a mesh's edge that average is one-sided (in the band the head mesh took up to
  // 11 % more head weight than the body mesh at the same place, 20 % at medium), so in a look turn the two copies of
  // the skin parted by up to 6 mm: the head's surface sank under the body's seam skirt, its hair's roots under the
  // body's base, a bald trench behind the ear edged by the standing ruff. With the edges 4 body cells and
  // 3 head cells past the band the copies agree to ~1 % there (at medium the body's extension only: the budget)
  const XB = Math.min(0.062, 4 * 0.0078 * r), XH = r > 1.5 && r < 2.5 ? 0 : Math.min(0.022, 3 * 0.0036 * r);
  const centres = eyeCentres(params);
  // (eyelid patches down to medium, which Safari on a Mac and phones show: without them the aperture was meshed at the
  // 7.2 mm head cell, a ragged polygon with white slivers on its lower rim; medium 2.4 mm)
  // (the cross-fade band at least a head cell wide, and the eye patch's inner radius keeping the aperture rim, ~16 mm,
  // and the painted lid margin; at medium the cells a little coarser than the tier's res alone: the vertex budget)
  const bandOf = (b) => Math.max(b, 1.05 * 0.0036 * r);
  const hK = r > 1.5 ? 1.15 : 1;
  const eB = bandOf(PATCH.B), nB = bandOf(NOSE_PATCH.B);
  const patches = eyePatchesAt(Q) ? centres.map((c) => ({ c, R: Math.max(PATCH.R, 0.018 + eB), B: eB, h: PATCH.h * Math.max(1, r) * hK })) : [];
  // (at medium the pad at 2.7 mm in a slightly smaller patch, and the head's cells 5 % coarser for the budget: at
  // 4.1 mm the nostrils were jagged polygons flecked with pale facets)
  // (at medium the body's cells 2 % coarser: the claws' own surfaces, claws.js, ~520 vertices there)
  const med = r > 1.5 && r < 2.5;
  if (r <= 2.01) patches.push(med ? { c: noseCentre(params), R: 0.036, B: nB, h: 0.0027 } : { c: noseCentre(params), R: NOSE_PATCH.R, B: nB, h: NOSE_PATCH.h * Math.max(1, r) * hK });
  const zN = rig.J.nose[2] + 0.04;
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-0.4, -0.02, -0.82], bmax: [0.4, 1.08, 0.78], h: 0.0078 * r * (med ? 1.02 : 1), F: 4, clip: (x, y, z) => neckS(x, y, z) < B + XB }],
      [
        // (the box's top clears the tips of the black bear's big ears)
        { name: 'head', part: 'body', bmin: [-0.22, 0.54, 0.46], bmax: [0.22, 1.12, zN], h: 0.0036 * r * (med ? 1.05 : 1), F: 6, clip: (x, y, z) => neckS(x, y, z) > -B - XH, patches },
        { name: 'jaw', part: 'jaw', bmin: [-0.1, 0.62, 0.6], bmax: [0.1, 0.78, zN], h: 0.0036 * r, F: 6, rigidBone: 'jaw' },
      ],
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN);
      if (name === 'head') {
        let f = smoothstep(-B, B, sN);
        if (patches.length) { const pw = patchWeight(patches, x, y, z); f *= patch ? pw : 1 - pw; }
        return f;
      }
      return 1;
    },
  };
}
