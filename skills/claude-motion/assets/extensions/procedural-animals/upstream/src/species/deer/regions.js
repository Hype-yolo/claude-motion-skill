// Meshing plan: body at 6.2 mm (0.67 % of the withers height), head at 2.9 mm overlapping the body
// across the upper neck and cross-faded, eyelid patches at 0.9 mm, the lower lip / chin as its own
// rigid surface (the mouth opens) and, in bucks, the antlers as a rigid region on the head bone.
import { EYE, antlerCurves } from './sculpt.js';
import { HEAD_O, deerJoints } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { norm, smoothstep } from '../../core/math/vec.js';

const J = deerJoints();
// the head is carried nose-down on a steep neck: cut just behind the poll - throat latch line
export const NECK_CUT = { c: [0, J.occiput[1] - 0.1, J.occiput[2] - 0.02], d: norm([0, 1, 0.35]), band: 0.013 };
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const EYE_PATCH = { R: 0.024, B: 0.004, h: 0.0009, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

function antlerBox(A) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const side of antlerCurves(A)) {
    for (const p of [...side.beam, ...side.tines.flatMap((t) => t.pts)]) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], side.burr[i]); hi[i] = Math.max(hi[i], side.burr[i]); }
  }
  const pad = A.base * 1.6 + 0.01;
  return { bmin: lo.map((v) => v - pad), bmax: hi.map((v) => v + pad) };
}

export function deerRegions(rig, params, Q) {
  const B = NECK_CUT.band, r = Q.res;
  const patches = Q.eyePatches ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  const headJobs = [
    { name: 'head', part: 'body', bmin: [-0.2, HEAD_O[1] - 0.22, HEAD_O[2] - 0.2], bmax: [0.2, HEAD_O[1] + 0.24, HEAD_O[2] + 0.2], h: 0.003 * r, F: 6, clip: (x, y, z) => neckS(x, y, z) > -B, patches },
    { name: 'jaw', part: 'jaw', bmin: [-0.04, HEAD_O[1] - 0.24, HEAD_O[2] + 0.02], bmax: [0.04, HEAD_O[1] - 0.02, HEAD_O[2] + 0.2], h: 0.0029 * r, F: 6, rigidBone: 'jaw' },
  ];
  const jobs = [
    [{ name: 'body', part: 'body', bmin: [-0.26, -0.01, -0.84], bmax: [0.26, 1.3, 0.66], h: 0.0064 * r, F: 4, clip: (x, y, z) => neckS(x, y, z) < B }],
    headJobs,
  ];
  if (params.antlers) {
    // (antler cell 3.5 mm at the hero tier, coarsening a little more slowly than the body)
    const bx = antlerBox(params.antlers);
    jobs.push([{ name: 'antler', part: 'antler', ...bx, h: 0.0035 * Math.pow(r, 0.85), F: 6, rigidBone: 'head' }]);
  }
  return {
    jobs,
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
