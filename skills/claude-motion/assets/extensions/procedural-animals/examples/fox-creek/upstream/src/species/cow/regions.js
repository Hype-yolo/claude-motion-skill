// Meshing plan: body at 12.2 mm (0.84 % of the withers height), head at 5.2 mm overlapping the body
// across the upper neck and cross-faded, the four feet below the fetlocks at 5.5 mm (so the cleft
// between the two claws and the dew claws read) cross-faded with the body, eyelid patches at 1.5 mm
// (3 mm at medium: Safari and phones show medium), and rigid surfaces: the lower lip / chin (the mouth
// opens and chews), the tongue, the horns, the ear tags and the nose ring.
// Budgets (vertices, hero / high / medium / low / crowd: 130k / 80k / 32k / 15k / 8k): the cells of an
// individual with more surface than the reference cow (a bull's crest, dewlap and thick legs, a beef
// breed's width) grow with it, the small rigid parts (ear tags, nose ring) are dropped at low and crowd,
// and the horns coarsen with the tier.
import { EYE, hornPath } from './sculpt.js';
import { HEAD_O, cowJoints } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { norm, smoothstep } from '../../core/math/vec.js';

const J = cowJoints();
// the head hangs from the neck: cut just behind the poll - throat line
export const NECK_CUT = { c: [0, 1.35, J.occiput[2] - 0.05], d: norm([0, 0.3, 1]), band: 0.024 };
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];
// feet: below the fetlocks
export const FOOT_CUT = { y: 0.115, band: 0.012 };

export const EYE_PATCH = { R: 0.033, B: 0.006, h: 0.0015, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

function boxOf(pts, pad) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of pts) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i] - pad); mx[i] = Math.max(mx[i], p[i] + pad); }
  return [mn, mx];
}

export function cowRegions(rig, params, Q) {
  const B = NECK_CUT.band, r = Q.res, FB = FOOT_CUT.band, FY = FOOT_CUT.y;
  const crowd = r >= 4, far = r >= 2.5; // (low / crowd: no tongue, ear-tag or ring surfaces at crowd, none of the small ones at low)
  // eyelid patches at hero / high and at medium (coarser there)
  const patches = Q.eyePatches || r <= 2 ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  // an individual's extra surface over the reference cow: bulls (crest, dewlap, sheath, thick legs and
  // neck: +8-10 % vertices), beef breeds (a wider barrel: +3 %)
  const kS = 1 + 0.045 * (params.bull || 0) + 0.02 * (1 - (params.dairy ?? 1));
  const rigid = [];
  if (params.horns) {
    const pts = [];
    for (const s of [1, -1]) { const hp = hornPath(params, s); pts.push(...hp.pts); }
    const [bmin, bmax] = boxOf(pts, params.horns.r * 1.3 + 0.01);
    rigid.push({ name: 'horn', part: 'horn', bmin, bmax, h: Math.max(0.0035, params.horns.r * 0.15) * (crowd ? 2.6 : Math.min(r, 2.2)), F: 6, rigidBone: 'head' });
  }
  if (params.earTags && !far) {
    for (const S of ['L', 'R']) {
      const a = rig.J['earBase' + S], b = rig.J['earTip' + S];
      const [bmin, bmax] = boxOf([a, b], 0.08);
      rigid.push({ name: 'tag' + S, part: 'tag' + S, bmin, bmax, h: r > 1 ? 0.0032 : 0.003, F: 6, rigidBone: 'ear' + S });
    }
  }
  if (params.noseRing && !far) {
    const c = rig.J.nose;
    rigid.push({ name: 'ring', part: 'ring', bmin: [c[0] - 0.05, c[1] - 0.12, c[2] - 0.08], bmax: [c[0] + 0.05, c[1] + 0.03, c[2] + 0.08], h: 0.002 * Math.min(r, 1.6), F: 6, rigidBone: 'head' });
  }
  const wide = params.shaggy ? 0.1 : 0;
  // feet: the clip keeps cells by their centre, so the mesh can end up to 1.5 cells below it; the
  // feet surface must reach past the middle of the band (FY, fade 0.5) at every tier, or its open
  // top ring shows (crowd: 18 mm cells, 65-87 exposed edges at the fetlocks); the box ends two cells
  // above the clip so it never cuts the surface first
  const hF = crowd ? 0.02 : 0.0055 * Math.min(r, 3);
  const feetTop = Math.max(FY + FB, FY + 1.5 * hF + 0.004);
  // the neck band likewise: each surface is kept to past the middle of the band (fade 0.5 at the cut)
  // by 1.5 of its own cells (low / crowd: the body's 37-51 mm cells ended in its visible half along
  // the upper neck, 7 exposed edges)
  const hB = 0.0122 * r * kS, hH = 0.0052 * r * kS;
  const bodyTo = Math.max(B, 1.5 * hB + 0.004), headFrom = -Math.max(B, 1.5 * hH + 0.004);
  const bodyFrom = Math.min(FY - FB, FY - 1.5 * hB - 0.004); // (and at the fetlocks)
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-0.5 - wide, bodyFrom - 2 * hB, -1.14], bmax: [0.5 + wide, 1.72, 1.4], h: hB, F: 4, clip: (x, y, z) => neckS(x, y, z) < bodyTo && y > bodyFrom }],
      [
        { name: 'head', part: 'body', bmin: [-0.36 - wide, 0.84, 0.86], bmax: [0.36 + wide, 1.66, 1.62], h: hH, F: 6, clip: (x, y, z) => neckS(x, y, z) > headFrom, patches },
        { name: 'jaw', part: 'jaw', bmin: [-0.1, 0.84, 1.1], bmax: [0.1, 1.36, 1.62], h: 0.0046 * r, F: 6, rigidBone: 'jaw' },
        ...(crowd ? [] : [{ name: 'tongue', part: 'tongue', bmin: [-0.06, 0.84, 1.1], bmax: [0.06, 1.36, 1.62], h: 0.0055 * Math.min(r, 2), F: 6, rigidBone: 'tongue' }]),
      ],
      [{ name: 'feet', part: 'body', bmin: [-0.3, -0.01, -0.75], bmax: [0.3, feetTop + 2 * hF, 0.86], h: hF, F: 6, clip: (x, y, z) => y < feetTop }, ...rigid],
    ],
    fade(x, y, z, name, patch) {
      if (name === 'body') {
        const sN = neckS(x, y, z);
        return (1 - smoothstep(-B, B, sN)) * smoothstep(FY - FB, FY + FB, y);
      }
      if (name === 'feet') return 1 - smoothstep(FY - FB, FY + FB, y);
      if (name === 'head') {
        let f = smoothstep(-B, B, neckS(x, y, z));
        if (patches.length) { const ew = eyePatchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
