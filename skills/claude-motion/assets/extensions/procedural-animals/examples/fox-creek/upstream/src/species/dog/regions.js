// Meshing plan: body at 4.2 mm (0.7 % of the withers height), head at 2.1 mm (overlapping across the
// upper neck and cross-faded), eyelid patches at ~1 mm, the lower jaw and the tongue as their own
// rigid surfaces so the mouth can open and the tongue slide out. The tongue is dropped at the low and
// crowd tiers (it is hidden in the closed mouth and too thin for their cells).
import { HEAD_O } from './rig.js';
import { eyeOf } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { norm, smoothstep } from '../../core/math/vec.js';

// the neck cut, fixed in reference space: a plane just behind the skull, tilted forward so the throat
// stays with the neck and the whole jaw with the head (the dog carries its neck steeply)
export const NECK_CUT = { c: [HEAD_O[0], HEAD_O[1] - 0.005, HEAD_O[2] - 0.085], d: norm([0, 0.45, 1]), band: 0.011 };
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const eyeCentres = (params) => [1, -1].map((s) => eyeFrameOf(eyeOf(params), HEAD_O, s).c);
const PATCH = { R: 0.019, B: 0.0036, h: 0.001 };
function eyePatchWeight(centres, R, B, x, y, z) {
  let dmin = 1e9;
  for (const c of centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(R - B, R + B, dmin);
}

export function dogRegions(rig, params, Q) {
  const B = NECK_CUT.band, r = Q.res;
  // Each surface is clipped past the band's midline by at least two of its own cells: the mesher keeps
  // whole cells, so a clipped surface's open edge lies up to ~2 cells inside the clip plane. With the
  // clip at the band edge (11 mm) the coarse body (13 mm cells at low, 18 mm at crowd) ended on the
  // visible side of the midline and left a row of open cells round the throat and the nape.
  const hB = 0.00435 * r, hH = 0.00218 * r;
  const cB = Math.max(B, 2 * hB), cH = Math.max(B, 2 * hH);
  const ek = params.eyeK || 1;
  const PR = PATCH.R * ek, PB = PATCH.B * ek;
  const centres = eyeCentres(params);
  const patches = Q.eyePatches ? centres.map((c) => ({ c, R: PR, B: PB, h: PATCH.h * Math.max(1, r) })) : [];
  const J = rig.J;
  const zN = J.nose[2] + 0.03;
  const hw = params.headW || 1;
  const tb = J.tongueBase, tt = J.tongueTip;
  const jobs = [
    [{ name: 'body', part: 'body', bmin: [-0.17, -0.03, -0.72], bmax: [0.17, 0.86, 0.56], h: hB, F: 4, clip: (x, y, z) => neckS(x, y, z) < cB }],
    [
      { name: 'head', part: 'body', bmin: [-0.14, 0.5, 0.33], bmax: [0.14, 0.88, zN], h: hH, F: 6, clip: (x, y, z) => neckS(x, y, z) > -cH, patches },
      { name: 'jaw', part: 'jaw', bmin: [-0.06 * hw, 0.54, 0.44], bmax: [0.06 * hw, 0.66, zN], h: 0.0021 * r, F: 6, rigidBone: 'jaw' },
    ],
  ];
  // the tongue (hero, high, medium)
  if (r < 2.5) jobs[1].push({ name: 'tongue', part: 'tongue', bmin: [-0.03 * hw, Math.min(tb[1], tt[1]) - 0.02, tb[2] - 0.04], bmax: [0.03 * hw, Math.max(tb[1], tt[1]) + 0.02, tt[2] + 0.03], h: 0.0021 * r, F: 4, rigidBone: 'tongue' });
  return {
    jobs,
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN);
      if (name === 'head') {
        let f = smoothstep(-B, B, sN);
        if (patches.length) { const ew = eyePatchWeight(centres, PR, PB, x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
