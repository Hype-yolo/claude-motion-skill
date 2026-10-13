// Meshing plan: body (incl. wing arms and legs) at 2.0 mm, head + the top of the neck at 0.9 mm
// (overlapping the body at the cut and cross-faded; the thin comb and wattles need the fine cells),
// eyelid patches at 0.4 mm, and the lower mandible as its own rigid surface so the bill can open.
// Cells scale with the quality tier (Q.res). Everything is computed from the individual's rig (the
// head sits higher on a rooster, the comb is taller).
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';
import { NECK_SEGS } from './rig.js';
import { eyeFor } from './sculpt.js';

export function neckCut(J) {
  const a = J['neck' + (NECK_SEGS - 1)];
  const d = norm(sub(J.occiput, a));
  const c = lerp(a, J.occiput, 0.5);
  return { c, d, band: 0.0045 };
}

export function eyePatch(rig, form) {
  const E = eyeFor(form), HO = rig.headOrigin, k = form.headK ?? 1;
  return { R: 0.011 * k, B: 0.0022 * k, h: 0.0004 * k, centres: [1, -1].map((s) => eyeFrameOf(E, HO, s).c) };
}

export function chickenRegions(rig, params, Q) {
  const J = rig.J, form = params.form || {};
  const NC = neckCut(J), B = NC.band, r = Q.res;
  const neckS = (x, y, z) => (x - NC.c[0]) * NC.d[0] + (y - NC.c[1]) * NC.d[1] + (z - NC.c[2]) * NC.d[2];
  const EP = eyePatch(rig, form);
  const eyeW = (x, y, z) => {
    let dmin = 1e9;
    for (const c of EP.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
    return 1 - smoothstep(EP.R - EP.B, EP.R + EP.B, dmin);
  };
  const patches = Q.eyePatches ? EP.centres.map((c) => ({ c, R: EP.R, B: EP.B, h: EP.h * Math.max(1, r) })) : [];
  const HO = rig.headOrigin, hk = form.headK ?? 1;
  const juv = !!form.chick;
  // body box: wings bound half open reach out to the side
  const top = Math.max(J.occiput[1], J.tailTip[1]) + 0.06;
  const hbox = {
    min: [HO[0] - 0.034 * hk, HO[1] - 0.06 * hk * (form.wattle ?? 1) - 0.01, HO[2] - 0.075 * hk],
    max: [HO[0] + 0.034 * hk, HO[1] + 0.058 * hk * (form.combH ?? 1), HO[2] + 0.055 * hk],
  };
  const male = params.sex === 'male' && !juv; // (bigger comb, wattles and hackle: slightly coarser cells keep the budgets)
  const hBody = (juv ? 0.0024 : male ? 0.00216 : 0.0021) * r, hHead = (juv ? 0.0012 : male ? 0.00098 : 0.00092) * r;
  return {
    jobs: [
      [
        { name: 'body', part: 'body', bmin: [-0.26, -0.004, -0.2], bmax: [0.26, top, 0.2], h: hBody, F: 4, clip: (x, y, z) => neckS(x, y, z) < B },
      ],
      [
        { name: 'head', part: 'body', bmin: hbox.min, bmax: hbox.max, h: hHead, F: 6, clip: (x, y, z) => neckS(x, y, z) > -B, patches },
        { name: 'jaw', part: 'jaw', bmin: [HO[0] - 0.01 * hk, HO[1] - 0.016 * hk, HO[2] + 0.008 * hk], bmax: [HO[0] + 0.01 * hk, HO[1] - 0.002 * hk, HO[2] + 0.047 * hk], h: 0.0007 * r * hk, F: 6, rigidBone: 'jaw' },
      ],
    ],
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return 1 - smoothstep(-B, B, sN);
      if (name === 'head') {
        // (the head surface reaches 1.5 mm past the body's cut, so no see-through crack shows)
        let f = smoothstep(-B - 0.0015, B - 0.0015, sN);
        if (patches.length) { const ew = eyeW(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
