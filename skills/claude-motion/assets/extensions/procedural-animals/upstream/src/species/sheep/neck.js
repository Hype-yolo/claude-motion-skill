// The head / body meshing boundary across the upper neck (regions.js), also used by the sculpt and
// the coat.
import { HZ, hl, EAR_BASE, EAR_SET, earTip } from './rig.js';
import { norm } from '../../core/math/vec.js';

// cut across the neck just behind the ears, perpendicular to the head's axis (the dense head mesh
// stops where the neck wool starts: the head emerges from the fleece)
// (two planes: one across the head's axis behind the ears, one tilted through the throat behind the
// jaw so the lower neck and the breast stay in the body)
const C1 = hl([0, 0, -0.078]), C2 = [0, 0.76, 0.5], D2 = norm([0, 0.45, 1]);
export const NECK_CUT = { c: C1, d: HZ, band: 0.012 };
// ... and the ears, swept back past that plane, stay in the head mesh: a zone round every ear any
// individual can carry (each carriage, ear lift and the horned ram's base), left side; mirrored by |x|
const EAR_SEGS = [];
for (const ear of Object.keys(EAR_SET)) {
  for (const earLift of [0, 0.5, 1]) {
    for (const horns of [null, { turns: 1 }]) {
      const base = horns ? [0.05, 0.002, -0.066] : EAR_BASE;
      EAR_SEGS.push([hl(base), hl(earTip({ ear, earLift, horns }, base))]);
    }
  }
}
const EAR_R = 0.038;
function earDist(x, y, z) {
  let dm = 1e9;
  for (const [a, b] of EAR_SEGS) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const px = Math.abs(x) - a[0], py = y - a[1], pz = z - a[2];
    const t = Math.max(0, Math.min(1, (px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz)));
    const d = Math.hypot(px - dx * t, py - dy * t, pz - dz * t);
    if (d < dm) dm = d;
  }
  return dm;
}
export const neckS = (x, y, z) => {
  const s = Math.min(
    (x - C1[0]) * HZ[0] + (y - C1[1]) * HZ[1] + (z - C1[2]) * HZ[2],
    (y - C2[1]) * D2[1] + (z - C2[2]) * D2[2],
  );
  return s > EAR_R ? s : Math.max(s, EAR_R - earDist(x, y, z));
};
