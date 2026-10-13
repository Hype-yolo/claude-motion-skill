// Meshing plan: body at 5.4 mm (0.7 % of the withers height, like the cheetah), head at 2.6 mm
// overlapping the body across the upper neck and cross-faded, eyelid patches at 0.9 mm, the lower
// lip / chin / beard as its own rigid surface (the mouth opens) and the horns as a rigid keratin
// surface on the skull.
import { EYE, hornPath, hornCell, hornSplit, hornTipCell } from './sculpt.js';
import { HEAD_O, hqOf, goatJoints } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { norm, smoothstep, clamp } from '../../core/math/vec.js';

const J = goatJoints();
// The head mesh takes over across a plane through the upper neck, 30 % of the way from the mid neck
// to the occiput, its normal the upper neck axis turned 45 deg forward (toward the head): it crosses
// the nape ~6 cm behind the poll and the throat ~9 cm below the jaw angle, both where the neck is a
// smooth tube and the fine and coarse meshes agree. (The first cut ran behind the poll and into the
// concave jaw angle / throat junction, where they did not: a crack from the poll to the throat. A
// plane square to the upright neck cut through the lower face, which hangs forward below the throat.)
const NECK_U = norm([0, J.occiput[1] - J.neckMid[1], J.occiput[2] - J.neckMid[2]]);
const NECK_A = Math.atan2(NECK_U[1], NECK_U[2]) - Math.PI / 4;
export const NECK_CUT = {
  c: [0, J.neckMid[1] + 0.3 * (J.occiput[1] - J.neckMid[1]), J.neckMid[2] + 0.3 * (J.occiput[2] - J.neckMid[2])],
  d: [0, Math.sin(NECK_A), Math.cos(NECK_A)], band: 0.014,
};
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const EYE_PATCH = { R: 0.024, B: 0.004, h: 0.0011, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

export function goatRegions(rig, params, Q) {
  // (the band: wider than a body cell, so the body's cut edge, which lies up to a cell into the band,
  // stays in its hidden half: at the crowd tier a 25 mm cell left it on the visible side of a 14 mm band,
  // at the low tier 0.95 of a cell left one edge of a buck's neck uncovered)
  const r = Q.res, B = Math.max(NECK_CUT.band, 0.0059 * r * 1.2);
  const Ho = HEAD_O;
  // eyelid patches at hero, high and medium (what Safari and phones show): without them the 24 x 16 mm aperture's lid
  // margin fell on the medium tier's 5.6 mm face cells and tore into pale and dark flakes round every eye
  // (the full 24 mm patch: the face mesh stops a cell inside it, and at 21.5 mm that cut reached the lid margin, 19-22
  // exposed edges round the eyes at medium)
  const patches = (Q.eyePatches || r <= 2) ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  const head = [
    // (the long, broad lop ears of Nubians and Boers are meshed with the head: its cells 6 % coarser keep a
    // lop-eared buck inside the hero budget, 133k -> 128k vertices)
    { name: 'head', part: 'body', bmin: [-0.3, 0.6, 0.33], bmax: [0.3, Ho[1] + 0.14, Ho[2] + 0.24], h: 0.0028 * r * (params.ear === 'lop' ? (params.sex === 'male' && params.age !== 'juvenile' ? (r === 2 ? 1.13 : 1.12) : 1.06) : 1), F: 6, clip: (x, y, z) => neckS(x, y, z) > -B, patches },
    { name: 'jaw', part: 'jaw', bmin: [-0.06, Ho[1] - 0.27, Ho[2] - 0.09], bmax: [0.06, Ho[1] - 0.03, Ho[2] + 0.22], h: 0.0028 * r, F: 6, rigidBone: 'jaw' },
  ];
  // (the beard's locks are 7-12 mm thick: at the medium tier's 6.8 mm cells their tips folded over, back faces showing;
  // 5.4 mm there)
  if ((params.beard || 0) > 0.01) head.push({ name: 'beard', part: 'beard', bmin: [-0.07, Ho[1] - 0.46, Ho[2] - 0.16], bmax: [0.07, Ho[1] - 0.06, Ho[2] + 0.18], h: 0.0034 * (r === 2 ? 1.6 : r), F: 6, rigidBone: 'beard' });
  if (params.wattles) head.push({ name: 'wattle', part: 'wattle', bmin: [-0.06, Ho[1] - 0.2, Ho[2] - 0.18], bmax: [0.06, Ho[1] + 0.03, Ho[2] + 0.02], h: 0.0022 * r, F: 6, rigidBone: 'neck2' });
  // the udder / a buck's scrotum: its own closed surface, rigid on the udder bone (sculpt.js) (the scrotum
  // coarser: a horned, bearded lop-eared buck was 200 vertices over the hero budget)
  const adult = params.age !== 'juvenile', male = params.sex === 'male', HQ = hqOf(params);
  if (adult && (male || (params.udder ?? 0.5) > 0.05)) head.push({ name: 'udder', part: 'udder', bmin: [-0.11, 0.17, -0.44 + HQ], bmax: [0.11, male ? 0.62 : 0.56, -0.2 + HQ], h: (male ? 0.005 : 0.0042) * r, F: 6, rigidBone: 'udder' });
  if (params.horns && params.horns.len > 0) {
    // the box from the horn centre lines (both sides) plus the horn radius and two cells: a fixed box
    // cut the horn bases off (they start at the poll, z 0.65, and a doe's horns reach z 0.68)
    // (cells with the horn's girth: a buck's longest, thickest horns took 18k vertices at 3.2 mm, and a
    // lop-eared buck with them and a long beard came to 137k at hero, over the 130k budget)
    // (at most the low tier's cells at the crowd tier too: 16 mm cells left a buck's horn a chain of ragged lumps;
    // the horn is also kept ~0.45 of a cell thick there, sculpt.js hornPath)
    // (at the low and crowd tiers the tapering outer part is its own solid at the medium tier's cells, sculpt.js hornSplit)
    const h = hornCell(params, r), hT = hornTipCell(params);
    const box = (part, hh, from, to) => {
      const bmin = [1e9, 1e9, 1e9], bmax = [-1e9, -1e9, -1e9];
      for (const s of [1, -1]) {
        const pth = hornPath(params, s), J = hornSplit(params, pth);
        pth.forEach((q, i) => {
          if (J >= 0 && (i < from(J) || i > to(J, pth.length))) return;
          const m = q.r * 1.25 + 2 * hh + 0.004;
          for (let k = 0; k < 3; k++) { bmin[k] = Math.min(bmin[k], q.p[k] - m); bmax[k] = Math.max(bmax[k], q.p[k] + m); }
        });
      }
      head.push({ name: part, part, bmin, bmax, h: hh, F: 6, rigidBone: 'head' });
    };
    const split = hornSplit(params, hornPath(params, 1)) >= 0;
    box('horn', h, () => 0, (J, n) => (split ? J : n));
    if (split) box('horntip', hT, (J) => J - 2, (J, n) => n);
  }
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-0.26, -0.01, -0.66], bmax: [0.26, 1.0, 0.7], h: 0.0059 * r, F: 4, clip: (x, y, z) => neckS(x, y, z) < B }],
      head,
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
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
