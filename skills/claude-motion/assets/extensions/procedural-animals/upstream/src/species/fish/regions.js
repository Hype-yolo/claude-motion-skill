// Meshing plan: the whole fish (body + fins) as one surface at SL * CELL (0.8 mm for a 26 cm trout at
// the hero tier), and the lower jaw as its own rigid surface so the mouth can open.
import { fishGeo } from './rig.js';
import { CELL } from './sculpt.js';

export function fishRegions(rig, params, Q) {
  const G = fishGeo(params);
  const SL = G.SL, V = G.V, r = Q.res;
  const h = SL * CELL * (V.cellK || 1) * r;
  // tight box: body outline + the longest dorsal / anal rays + the paired fins
  let top = 0, bot = 0, hw = 0;
  for (const r of V.prof) { top = Math.max(top, r[1]); bot = Math.max(bot, r[2]); hw = Math.max(hw, r[3]); }
  const dl = Math.max(...V.fins.dorsal.map((d) => Math.max(...d.len))), al = Math.max(...V.fins.anal.map((d) => Math.max(...d.len)));
  const J = rig.J;
  const xMax = Math.max(hw * SL, Math.abs(J.pecTipL[0]), Math.abs(J.pelTipL[0])) + 0.03 * SL;
  const topY = G.axisY + (top + dl) * SL + 0.03 * SL;
  const botY = Math.min(G.axisY - (bot + al * 0.9) * SL, J.pelTipL[1], J.pecTipL[1]) - 0.03 * SL;
  const zTail = G.z(1 + G.tailLen * 1.08 + 0.03);
  const g = V.head.mouth.gape;
  return {
    jobs: [
      [{ name: 'body', part: 'body', bmin: [-xMax, botY, zTail], bmax: [xMax, topY, G.z0 + 0.03 * SL], h, F: 6 }],
      [{ name: 'jaw', part: 'jaw', bmin: [-0.2 * SL, -0.02 * SL, G.z(g + 0.14)], bmax: [0.2 * SL, G.mouthY + 0.03 * SL, G.z0 + 0.04 * SL], h: h * 0.8, F: 4, rigidBone: 'jaw' }],
    ],
    fade: () => 1,
  };
}
