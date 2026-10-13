// Meshing plan: body at 5.4 mm, head at 2.5 mm (overlapping across the upper neck and cross-faded),
// eyelid patches at 1 mm, and the lower jaw as its own surface so the mouth can open.
import { J } from './joints.js';
import { EYE } from './sculpt.js';
import { HEAD_O, TAIL_SEGS } from './rig.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { lerp, norm, sub, smoothstep } from '../../core/math/vec.js';

export const NECK_CUT = (() => {
  const d = norm(sub(J.occiput, J.neckMid));
  const c = lerp(J.neckMid, J.occiput, 0.55);
  return { c, d, band: 0.012 };
})();
export const neckS = (x, y, z) => (x - NECK_CUT.c[0]) * NECK_CUT.d[0] + (y - NECK_CUT.c[1]) * NECK_CUT.d[1] + (z - NECK_CUT.c[2]) * NECK_CUT.d[2];

export const EYE_PATCH = { R: 0.021, B: 0.004, h: 0.001, centres: [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s).c) };
export function eyePatchWeight(x, y, z) {
  let dmin = 1e9;
  for (const c of EYE_PATCH.centres) dmin = Math.min(dmin, Math.hypot(x - c[0], y - c[1], z - c[2]));
  return 1 - smoothstep(EYE_PATCH.R - EYE_PATCH.B, EYE_PATCH.R + EYE_PATCH.B, dmin);
}

// The tail as a polyline tail0 .. tail10: arc length s from the tail root and distance d of the
// closest point (bind pose). Only tail skin lies within TAIL_R of the polyline past the cut.
const TAIL_PTS = Array.from({ length: TAIL_SEGS + 1 }, (_, i) => J['tail' + i]);
const TAIL_ACC = TAIL_PTS.map((_, i) => TAIL_PTS.slice(1, i + 1).reduce((a, p, k) => a + norm3(sub(p, TAIL_PTS[k])), 0));
function norm3(v) { return Math.hypot(v[0], v[1], v[2]); }
export function tailSD(x, y, z) {
  let best = 1e9, bs = 0;
  for (let i = 0; i < TAIL_SEGS; i++) {
    const a = TAIL_PTS[i], b = TAIL_PTS[i + 1];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    let t = ((x - a[0]) * ab[0] + (y - a[1]) * ab[1] + (z - a[2]) * ab[2]) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - a[0] - ab[0] * t, y - a[1] - ab[1] * t, z - a[2] - ab[2] * t);
    if (d < best) { best = d; bs = TAIL_ACC[i] + t * (TAIL_ACC[i + 1] - TAIL_ACC[i]); }
  }
  return [bs, best];
}
const TAIL_R = 0.05;
export const TAIL_CUT = TAIL_ACC[3]; // tail3

export function cheetahRegions(rig, params, Q) {
  const r = Q.res, hBody = 0.0054 * r, hHead = 0.0025 * r;
  // The band is at least about a body cell wide on each side (low: 16 mm cells, crowd: 23 mm), so the
  // seam skirt that sinks the surface handing over (fade 0.5 -> 0.1) spans whole triangles.
  const B = Math.max(NECK_CUT.band, 1.1 * hBody);
  // Without fur shells (crowd tier) the coarse body surface (2 cm cells) and the head surface do not
  // coincide in the overlap band: a hard switch at the cut left see-through slits under the throat.
  // There each surface stays visible past the cut by D (they overlap and the depth test picks the
  // outer one); with shells the surfaces are fine enough and the band stays a clean switch.
  const D = Q.shells > 0 ? 0 : 0.6 * 0.0054 * r;
  // The mesher keeps whole cells (by centre), so a clipped surface ends up to ~1.4 cells inside its
  // clip plane: each clip lies 1.5 cells past the point where the surface's fade reaches 0.1 (where
  // the renderer stops drawing it, 0.61 B past its midline). A clip at the band edge left the body's
  // rim in the visible half of the band at the low tier (see-through specks at the side of the neck).
  const cBody = D + 0.61 * B + 1.5 * hBody, cHead = D + 0.61 * B + 1.5 * hHead;
  const patches = Q.eyePatches ? EYE_PATCH.centres.map((c) => ({ c, R: EYE_PATCH.R, B: EYE_PATCH.B, h: EYE_PATCH.h * Math.max(1, r) })) : [];
  // Crowd tier: at 23 mm body cells the tail (rings ~25 mm wide, 50 mm apart, a 25 mm white tip) is
  // meshed at about one ring period and loses its rings and tip, so from tail3 on the tail is its own
  // ~1 cm region, cross-faded with the body like the neck (~ +600 vertices of the 8k budget).
  const tailOwn = Q.shells <= 0, hTail = 0.0098, BT = 1.1 * hBody;
  const cTailBody = 0.61 * BT + 1.5 * hBody, cTail = 0.61 * BT + 1.5 * hTail;
  const inTail = (x, y, z, c) => { const [s, d] = tailSD(x, y, z); return d < TAIL_R && s > TAIL_CUT + c; };
  const bodyClip = tailOwn
    ? (x, y, z) => neckS(x, y, z) < cBody && !inTail(x, y, z, cTailBody)
    : (x, y, z) => neckS(x, y, z) < cBody;
  const jobs = [
    [{ name: 'body', part: 'body', bmin: [-0.2, -0.03, -1.2], bmax: [0.2, 0.93, 0.62], h: hBody, F: 4, clip: bodyClip }],
    [
      { name: 'head', part: 'body', bmin: [-0.1, 0.64, 0.42], bmax: [0.1, 0.91, 0.73], h: hHead, F: 6, clip: (x, y, z) => neckS(x, y, z) > -cHead, patches },
      { name: 'jaw', part: 'jaw', bmin: [-0.07, 0.69, 0.55], bmax: [0.07, 0.8, 0.72], h: hHead, F: 6, rigidBone: 'jaw' },
    ],
  ];
  if (tailOwn) {
    const lo = [1, 1, 1], hi = [-1, -1, -1];
    for (const p of TAIL_PTS.slice(2)) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k] - TAIL_R); hi[k] = Math.max(hi[k], p[k] + TAIL_R); }
    jobs.push([{ name: 'tail', part: 'body', bmin: lo, bmax: hi, h: hTail, F: 4, clip: (x, y, z) => inTail(x, y, z, -cTail) }]);
  }
  const tailFade = (x, y, z) => { const [s, d] = tailSD(x, y, z); return d < TAIL_R ? smoothstep(-BT, BT, s - TAIL_CUT) : 0; };
  return {
    jobs,
    fade(x, y, z, name, patch) {
      const sN = neckS(x, y, z);
      if (name === 'body') return (1 - smoothstep(-B, B, sN - D)) * (tailOwn ? 1 - tailFade(x, y, z) : 1);
      if (name === 'tail') return tailFade(x, y, z);
      if (name === 'head') {
        let f = smoothstep(-B, B, sN + D);
        if (patches.length) { const ew = eyePatchWeight(x, y, z); f *= patch ? ew : 1 - ew; }
        return f;
      }
      return 1;
    },
  };
}
