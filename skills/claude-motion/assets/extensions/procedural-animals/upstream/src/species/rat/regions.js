// Meshing plan: body at 1 mm, the thin tail at 0.7 mm, head (with the thin ears) at 0.6 mm overlapping across the nape and
// cross-faded, the four feet (separate toes, ~1.7 mm thick) at 0.5 mm cross-faded above the wrist and
// the heel, eyelid patches at 0.2 mm, the lower jaw as its own rigid surface, and the incisors as
// rigid parts (hero .. medium; sub-pixel below).
import { ratJoints, HEAD_O } from './rig.js';
import { EYE } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';

const J0 = ratJoints();
export const NECK_CUT = (() => {
  const d = norm(sub(J0.occiput, J0.neckBase));
  const c = lerp(J0.neckMid, J0.occiput, 0.5);
  return { c, d, band: 0.003 };
})();
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

// feet: below this height (and inside the foot boxes) the fine foot mesh takes over
// tail: behind this plane the tail region takes over
export const TAIL_Z = -0.104, TAIL_B = 0.002;
export const FOOT_Y = 0.0105, FOOT_B = 0.0018;
const FOOT_BOX = {
  F: { x0: 0.006, x1: 0.036, z0: 0.012, z1: 0.058 },
  H: { x0: 0.006, x1: 0.04, z0: -0.058, z1: 0.01 },
};
export const inFoot = (x, z) => {
  const ax = Math.abs(x);
  for (const b of Object.values(FOOT_BOX)) if (ax > b.x0 && ax < b.x1 && z > b.z0 && z < b.z1) return true;
  return false;
};
// > 0 inside the foot region (signed height below the cut)
const footS = (x, y, z) => (inFoot(x, z) ? FOOT_Y - y : -1);

export const EYE_PATCH = { R: 0.0056, B: 0.0008, h: 0.0002, centres: [1, -1].map((c) => eyeFrameOf(EYE, HEAD_O, c).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

export function ratRegions(rig, params, Q) {
  // (the crowd tier's ~4 mm body cells need a wider overlap across the nape, or a slit opens there)
  const r = Q.res, B = NECK_CUT.band * Math.max(1, r / 2.6);
  const patches = Q.eyePatches ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  const feet = r < 2.5; // low / crowd: the feet stay in the body mesh
  const fine = r < 2.5; // the thin tail in its own finer region (hero .. medium)
  const jobs = [
    [{ name: 'body', part: 'body', bmin: [-0.055, -0.006, -0.3], bmax: [0.055, 0.15, 0.08], h: 0.00103 * r, F: 4, clip: (x, y, z) => neckS(x, y, z) < B && (!feet || footS(x, y, z) < FOOT_B) && (!fine || z > TAIL_Z - TAIL_B) }],
    [
      { name: 'head', part: 'body', bmin: [-0.04, 0.026, 0.035], bmax: [0.04, 0.108, 0.114], h: 0.00062 * r, F: 6, clip: (x, y, z) => neckS(x, y, z) > -B, patches },
      { name: 'jaw', part: 'jaw', bmin: [-0.013, 0.032, 0.053], bmax: [0.013, 0.062, 0.106], h: 0.00055 * r, F: 6, rigidBone: 'jaw' },
    ],
  ];
  if (feet) {
    const fj = [];
    for (const [k, b] of Object.entries(FOOT_BOX)) {
      for (const s of [1, -1]) {
        const x0 = s > 0 ? b.x0 : -b.x1, x1 = s > 0 ? b.x1 : -b.x0;
        fj.push({ name: 'foot' + k + (s > 0 ? 'L' : 'R'), part: 'body', bmin: [x0, -0.004, b.z0], bmax: [x1, FOOT_Y + 0.004, b.z1], h: 0.0005 * r, F: 6, clip: (x, y, z) => footS(x, y, z) > -FOOT_B });
      }
    }
    jobs.push(fj);
  }
  if (fine) jobs[0].push({ name: 'tail', part: 'body', bmin: [-0.02, -0.004, -0.32], bmax: [0.02, 0.05, TAIL_Z + 0.004], h: 0.0007 * r, F: 4, clip: (x, y, z) => z < TAIL_Z + TAIL_B });
  if (r < 2.5) {
    const ht = 0.00022 * Math.min(r, 1.6);
    jobs.push([
      { name: 'uteeth', part: 'uteeth', bmin: [-0.004, 0.042, 0.09], bmax: [0.004, 0.056, 0.106], h: ht, F: 4, rigidBone: 'head' },
      { name: 'lteeth', part: 'lteeth', bmin: [-0.004, 0.04, 0.088], bmax: [0.004, 0.052, 0.104], h: ht, F: 4, rigidBone: 'jaw' },
    ]);
  }
  return {
    jobs,
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') {
        let f = 1 - smoothstep(-B, B, sN);
        if (feet && inFoot(x, z)) f *= 1 - smoothstep(-FOOT_B, FOOT_B, FOOT_Y - y);
        if (fine) f *= smoothstep(TAIL_Z - TAIL_B, TAIL_Z + TAIL_B, z);
        return f;
      }
      if (name === 'head') {
        let f = smoothstep(-B, B, sN);
        if (patches.length) { const ew = eyePatchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      if (name === 'tail') return 1 - smoothstep(TAIL_Z - TAIL_B, TAIL_Z + TAIL_B, z);
      if (name.startsWith('foot')) return smoothstep(-FOOT_B, FOOT_B, FOOT_Y - y);
      return 1;
    },
  };
}
