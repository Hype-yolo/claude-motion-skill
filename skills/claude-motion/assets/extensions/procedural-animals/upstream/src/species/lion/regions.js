// Meshing plan: body at 8.1 mm (the cheetah's 5.4 mm scaled to the lion's size), head at 4.2 mm
// (overlapping across the upper neck and cross-faded), eyelid patches at 1.5 mm, and the lower jaw
// as its own surface so the mouth can open.
import { lionJoints, HEAD_O, fe } from './rig.js';
import { EYE } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';

// the neck cut is fixed in reference space (joints of the reference individual)
const J0 = lionJoints();
export const NECK_CUT = (() => {
  const d = norm(sub(J0.occiput, J0.neckMid));
  const c = lerp(J0.neckMid, J0.occiput, 0.95);
  return { c, d, band: 0.018 };
})();
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

// A maned head: the head surface is the part in front of the neck cut AND inside a flattened ellipsoid
// round the face, or round an ear: the outer mane ruff stays on the (coarser) body surface, so the cut
// between the two surfaces never runs through the long hair far from the neck axis, where a bent neck
// opened it. The ellipsoid term is a pseudo-distance (the scaled radius divided by its gradient), so the
// cross-fade band is as wide in metres all round it (its gradient was up to 1.5: the band shrank to 12 mm
// on the sides, less than a coarse cell, and the cut came out on the visible side of the fade).
// A maneless head (lioness, cub) is cut at the neck alone: the ellipsoid crossed the nape at a grazing
// angle (a 28 cm crack at the crowd tier) and cut the ears off the head surface.
const HC = [HEAD_O[0], HEAD_O[1] + 0.01, HEAD_O[2] + 0.03], HR = 0.29;
function faceEll(x, y, z) {
  const sx = 1.5, sy = y < HC[1] ? 1.45 : 1, sz = z < HC[2] ? 1.3 : 1;
  const dx = (x - HC[0]) * sx, dy = (y - HC[1]) * sy, dz = (z - HC[2]) * sz;
  const r = Math.hypot(dx, dy, dz) || 1e-9;
  return ((HR - r) * r) / (Math.hypot(dx * sx, dy * sy, dz * sz) || 1e-9);
}
// the ears (a capsule round the pinna standing out of the mane, from above its buried base to beyond the
// tip) are head surface in a mane too; kept tight so the fine head mesh does not spread over the mane skin
// round the ears, which folds when the neck bends
const EAR_R = 0.05, EAR_T0 = 0.3;
const EARS = [1, -1].map((s) => {
  const a = [J0.earBaseL[0] * s, J0.earBaseL[1], J0.earBaseL[2]], t = [J0.earTipL[0] * s, J0.earTipL[1], J0.earTipL[2]];
  return { a, d: sub(t, a) };
});
function earS(x, y, z) {
  let best = -1e9;
  for (const { a, d } of EARS) {
    const px = x - a[0], py = y - a[1], pz = z - a[2];
    const t = Math.max(EAR_T0, Math.min(1.15, (px * d[0] + py * d[1] + pz * d[2]) / (d[0] * d[0] + d[1] * d[1] + d[2] * d[2])));
    best = Math.max(best, EAR_R - Math.hypot(px - d[0] * t, py - d[1] * t, pz - d[2] * t));
  }
  return best;
}
const splitMane = (x, y, z) => Math.min(neckS(x, y, z), Math.max(faceEll(x, y, z), earS(x, y, z)));
// the split for an individual (> 0 head surface, < 0 body)
export const splitFor = (params) => ((params && params.mane > 0) ? splitMane : neckS);

export const EYE_CENTRES = [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c);
const PATCH = { R: 0.039, B: 0.006, h: 0.0015 }; // (R - B holds the aperture rim at the skin, 31.6 mm)
// the nose leather (its edge, the comma nostrils) meshed finer as well: at the medium tier's 8.4 mm face
// cells its lower edge and the nostrils were jagged dark notches
// (the whole leather, its outline and the short fur round it inside the patch's core, R - B: with the leather's top corners in
// the cross-fade band the coarse face mesh's colours showed through there as ragged dark-red patches)
export const NOSE_PATCH = { c: fe(0, -0.98, 1.03), R: 0.072, B: 0.008, h: 0.0022 };
export function eyePatchWeight(x, y, z) {
  let w = 0;
  for (const c of EYE_CENTRES) w = Math.max(w, 1 - smoothstep(PATCH.R - PATCH.B, PATCH.R + PATCH.B, Math.hypot(x - c[0], y - c[1], z - c[2])));
  const n = NOSE_PATCH;
  return Math.max(w, 1 - smoothstep(n.R - n.B, n.R + n.B, Math.hypot(x - n.c[0], y - n.c[1], z - n.c[2])));
}

export function lionRegions(rig, params, Q) {
  // (the medium tier's body 5 % coarser: its eyelid and nose patches take ~2k of its 32k vertices)
  // (a maned body 5 % coarser at a full mane: the mane's locks add surface; a lioness's cells unchanged)
  const r = Q.res, hBody = 0.0081 * r * (Math.abs(r - 2) < 0.01 ? 1.05 : 1) * (1 + 0.05 * (params.mane || 0));
  const splitS = splitFor(params);
  // The mesher keeps whole cells by their centre, so a cut's boundary vertices lie up to ~0.85 of a
  // cell either side of it: the band must be over a body cell wide (1.2 cells), or at the medium and low tiers
  // the body's cut came out where its fade still shows (open edges on the visible side).
  const B = Math.max(NECK_CUT.band, 1.2 * hBody);
  // Without fur shells (crowd tier) the coarse body surface and the head surface do not coincide in
  // the overlap band: each surface stays visible past the cut by D there (see the cheetah).
  const D = Q.shells > 0 ? 0 : 0.6 * 0.0076 * r;
  // (patches at medium too: Safari on a Mac and phones show medium; the eyes' lid margins and the nose)
  const patches = r <= 2.01 ? [...EYE_CENTRES.map((c) => ({ c, R: PATCH.R, B: PATCH.B, h: PATCH.h * Math.max(1, r) })), { ...NOSE_PATCH, h: NOSE_PATCH.h * Math.max(1, r) }] : [];
  const zN = rig.J.nose[2] + 0.04;
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-0.36, -0.03, -1.5], bmax: [0.36, 1.3, 0.95], h: hBody, F: 4, clip: (x, y, z) => splitS(x, y, z) < B + D }],
      [
        { name: 'head', part: 'body', bmin: [-0.3, 0.6, 0.45], bmax: [0.3, 1.27, zN], h: 0.0042 * r, F: 6, clip: (x, y, z) => splitS(x, y, z) > -B - D, patches },
        // (the jaw is small and sits under the overhanging upper lip, where its dark lip band meets the white
        // chin: at 8 mm cells that edge was a black-and-white saw-tooth, a grimace)
        { name: 'jaw', part: 'jaw', bmin: [-0.12, 0.77, 0.69], bmax: [0.12, 0.94, zN], h: 0.004 * (r <= 2.01 ? Math.min(r, 1.5) : 0.75 * r), F: 6, rigidBone: 'jaw' },
        // the upper canines (up to the medium tier: at low and crowd nobody sees into a mouth)
        ...(r <= 2.01 ? [{ name: 'canine', part: 'canine', bmin: [-0.07, 0.785, 0.9], bmax: [0.07, 0.875, 0.98], h: 0.0019 * Math.pow(r, 0.8), F: 6, rigidBone: 'head' }] : []),
      ],
    ],
    fade(x, y, z, name, patch) {
      const sN = splitS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN - D);
      if (name === 'head') {
        let f = smoothstep(-B, B, sN + D);
        if (patches.length) { const ew = eyePatchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
