// Meshing plan: the long body at ~7 % of the max half width, the head at half that (overlapping the
// body across the neck and cross-faded), the lower jaw, tongue, fangs and rattle as rigid regions.
// Thin parts (tongue, fangs) are dropped at the low and crowd tiers.
import { SPINE } from './rig.js';
import { smoothstep } from '../../core/math/vec.js';

export function snakeRegions(rig, params, Q) {
  const J = rig.J, B = rig.plan, P = B.P, r = Q.res;
  let hwMax = 0;
  for (let i = 0; i <= 40; i++) hwMax = Math.max(hwMax, B.hw(i / 40));
  const hL = B.headLen, W = P.headW * B.kH, H = P.headH * B.kH;
  const hBody = 0.078 * hwMax * r;
  const hHead = Math.min(hBody * 0.5, 0.012 * hL * r);
  const zCut = -0.35 * hL, band = Math.max(0.0025, 1.5 * hBody);
  const zTail = J['v' + SPINE][2];
  const pad = 3 * hBody;
  const y0 = J.v0[1];
  const jobs = [
    [{ name: 'body', part: 'body', bmin: [-hwMax - pad, -pad, zTail - pad - 0.01], bmax: [hwMax + pad, 2.2 * hwMax + pad, zCut + band + pad], h: hBody, F: 4, clip: (x, y, z) => z < zCut + band }],
  ];
  const head = [
    { name: 'head', part: 'body', bmin: [-0.7 * W, -pad, zCut - band - 0.004], bmax: [0.7 * W, y0 + 1.2 * H, hL * 1.12], h: hHead, F: 5, clip: (x, y, z) => z > zCut - band },
    { name: 'jaw', part: 'jaw', bmin: [-0.6 * W, -0.003, -0.1 * hL], bmax: [0.6 * W, y0 + 0.2 * H, hL * 1.05], h: hHead, F: 5, rigidBone: 'jaw' },
  ];
  if (r < 2.5) {
    const tr = 0.0012 * B.kH;
    const hT = Math.min(0.00022 * B.kH * r, hHead);
    head.push(
      { name: 'tongue', part: 'tongue', bmin: [-tr * 2, J.tongueBase[1] - tr * 2, J.tongueBase[2] - tr * 2], bmax: [tr * 2, J.tongueBase[1] + tr * 2, J.tongueFork[2] + tr * 3], h: hT, F: 4, rigidBone: 'tongue' },
      { name: 'fork', part: 'fork', bmin: [-0.3 * hL, J.tongueFork[1] - tr * 2, J.tongueFork[2] - tr * 2], bmax: [0.3 * hL, J.tongueFork[1] + tr * 2, J.tongueTip[2] + tr * 2], h: hT, F: 4, rigidBone: 'tongueTip' },
    );
    if (params.variant === 'rattlesnake') {
      head.push({ name: 'fang', part: 'fang', bmin: [-0.4 * W, J.fangTip[1] - 0.004, J.fangTip[2] - 0.004], bmax: [0.4 * W, J.fangBase[1] + 0.003, J.fangBase[2] + 0.003], h: hT, F: 4, rigidBone: 'fang' });
    }
  }
  jobs.push(head);
  if (P.rattle) {
    const b = J['v' + SPINE];
    const L = P.rattle.len * 1.3 * (params.shape?.girth ?? 1);
    const w = B.hw(1) * 2;
    jobs[0].push({ name: 'rattle', part: 'rattle', bmin: [-w, b[1] - w, b[2] - L - 0.01], bmax: [w, b[1] + w, b[2] + 0.01], h: Math.min(hBody * 0.5, 0.00035 * r), F: 4, rigidBone: 'spine' + (SPINE - 1) });
  }
  return {
    jobs,
    fade(x, y, z, name) {
      if (name === 'body') return 1 - smoothstep(zCut - band, zCut + band, z);
      if (name === 'head') return smoothstep(zCut - band, zCut + band, z);
      return 1;
    },
  };
}
