// Meshing plan: the whole shark (body + fleshy fins) as one surface at TL * CELL (1 cm for a 4.5 m
// white shark at the hero tier), the lower jaw as its own rigid surface so the mouth can open, and
// the two tooth rows as rigid parts at a fine cell size (hero and high; from medium on the teeth
// are sub-pixel and are left out).
import { sharkGeo } from './rig.js';
import { CELL } from './sculpt.js';

export function sharkRegions(rig, params, Q) {
  const G = sharkGeo(params);
  const TL = G.TL, V = G.V, r = Q.res;
  const h = TL * CELL * (V.cellK || 1) * r;
  const J = rig.J;
  let hw = 0, top = 0;
  for (const row of V.prof) { hw = Math.max(hw, row[3]); top = Math.max(top, row[1]); }
  const xMax = Math.max(hw * TL * (G.girthK || 1) * 1.1, Math.abs(J.pecTipL[0]) + 0.03 * TL) + 0.02 * TL;
  const topY = Math.max(G.axisY + (top + 0.13 * G.dorsalK) * TL, J['caudal' + V.caudalSegs][1] + 0.05 * TL) + 0.02 * TL;
  const botY = -0.03 * TL;
  const zTail = G.z(G.pc) - Math.max(G.caudal.up, G.caudal.low) * TL - 0.06 * TL;
  const M = V.head.mouth;
  const jobs = [
    [{ name: 'body', part: 'body', bmin: [-xMax, botY, zTail], bmax: [xMax, topY, G.z0 + 0.02 * TL], h, F: 6 }],
    [{ name: 'jaw', part: 'jaw', bmin: [-0.12 * TL, G.bot(M.uC) - 0.03 * TL, G.z(M.uC + 0.09)], bmax: [0.12 * TL, G.yC + 0.02 * TL, G.z(0) + 0.01 * TL], h: h * 0.75, F: 4, rigidBone: 'jaw' }],
  ];
  if (r < 1.9) {
    const ht = TL * (params.variant === 'white' ? 0.0011 : 0.0009) * Math.min(r, 1.6);
    const y0 = Math.min(G.yC, G.yF), y1 = Math.max(G.yC, G.yF);
    const box = (dy0, dy1) => ({ bmin: [-0.11 * TL, y0 + dy0 * TL, G.z(M.uC + 0.015)], bmax: [0.11 * TL, y1 + dy1 * TL, G.z(M.uF) + 0.01 * TL] });
    jobs.push([
      { name: 'uteeth', part: 'uteeth', ...box(-0.025, 0.025), h: ht, F: 4, rigidBone: 'upperJaw' },
      { name: 'lteeth', part: 'lteeth', ...box(-0.025, 0.025), h: ht, F: 4, rigidBone: 'jaw' },
    ]);
  }
  return { jobs, fade: () => 1 };
}
