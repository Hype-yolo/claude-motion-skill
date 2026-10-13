// Snake skeleton in bind pose (metres): lying straight along -Z, belly on y = 0, head at +Z.
// Two builds share the code: the corn snake (default) and the western diamondback rattlesnake
// (variant). Numbers: total length 1.2 m (reference adults), corn head 3.4 cm and
// max body width 2.7 cm, rattlesnake head 5.2 cm (3.8 cm wide) and max body width 5.2 cm;
// tail 17 % (corn) / 7.5 % (rattlesnake) of the total length.
import { buildRig } from '../../core/rig/rig.js';
import { snakeSpine, snakeBones, snakeAxial, snakeSegments } from '../../core/rig/snake.js';

export const SPINE = 50; // spine bones (each ~4-5 vertebrae)

// Per-variant proportions (reference individual). hw = half width of the body (m) at arc fraction t
// (0 = occiput, 1 = tail tip); flat = axis height / half width (loaf cross-section: flat belly).
export const PROFILES = {
  corn: {
    TL: 1.2, headLen: 0.034, headW: 0.0185, headH: 0.0112, tail: 0.17, flat: 0.74,
    hw: [[0, 0.0071], [0.05, 0.0076], [0.22, 0.0112], [0.45, 0.0135], [0.66, 0.0128], [0.8, 0.0098], [0.88, 0.0068], [0.95, 0.0036], [1, 0.0011]],
    eye: { r: 0.0026, at: [0.006, 0.0027, 0.0205], yaw: 1.05, pitch: 0.2 },
  },
  rattlesnake: {
    TL: 1.2, headLen: 0.052, headW: 0.038, headH: 0.02, tail: 0.075, flat: 0.64,
    hw: [[0, 0.0092], [0.04, 0.0105], [0.2, 0.019], [0.46, 0.0265], [0.7, 0.0238], [0.86, 0.016], [0.92, 0.0112], [0.97, 0.0078], [1, 0.0062]],
    eye: { r: 0.0029, at: [0.0133, 0.0052, 0.032], yaw: 1.0, pitch: 0.22 },
    rattle: { len: 0.05, segs: 7 },
  },
};

// monotone cubic (Fritsch-Carlson) through [[t, v]...]
export function pchip(keys) {
  const n = keys.length, x = keys.map((k) => k[0]), y = keys.map((k) => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (t) => {
    if (t <= x[0]) return y[0];
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (i < n - 2 && t > x[i + 1]) i++;
    const h = x[i + 1] - x[i], u = (t - x[i]) / h;
    const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
    return h00 * y[i] + h10 * h * m[i] + h01 * y[i + 1] + h11 * h * m[i + 1];
  };
}

// Individual body plan from the variant profile and the seeded proportions in params:
// params.shape = { length, girth, head, tail } multipliers (1 = reference).
export function bodyPlan(params) {
  const P = PROFILES[params.variant] || PROFILES.corn;
  const sh = params.shape || {};
  const kL = sh.length ?? 1, kG = sh.girth ?? 1, kH = sh.head ?? 1, kT = sh.tail ?? 1;
  const headLen = P.headLen * kH;
  const bodyLen = P.TL * kL - headLen;
  const tailFrac = Math.min(0.3, (P.tail * kT * P.TL * kL) / bodyLen);
  // re-map the profile's tail portion to this individual's tail fraction
  const refTail = (P.tail * P.TL) / (P.TL - P.headLen);
  const remap = (t) => (t <= 1 - tailFrac ? (t / (1 - tailFrac)) * (1 - refTail) : 1 - refTail + ((t - (1 - tailFrac)) / tailFrac) * refTail);
  const base = pchip(P.hw);
  const neckK = kH; // a bigger head comes with a slightly thicker neck
  const hw = (t) => {
    const r = base(remap(t));
    const neck = 1 - Math.min(1, t / 0.1);
    return r * (kG * (1 - neck) + (0.5 * kG + 0.5 * neckK) * neck);
  };
  return { P, headLen, bodyLen, tailFrac, hw, flat: P.flat, kH };
}

export function snakeRig(params) {
  const B = bodyPlan(params);
  const P = B.P;
  const J = {};
  const lens = snakeSegments(SPINE, B.bodyLen, { tipShrink: P.rattle ? 0.8 : 0.5, tipBones: 10 });
  snakeSpine(J, 0, lens, (s, t) => B.hw(t) * B.flat);
  const y0 = J.v0[1];
  const kH = B.kH;
  const hL = B.headLen, hH = P.headH * kH;
  // head landmarks (head-local: origin v0, +Z forward). The jaw's underside rests on y = 0.
  // heights are from the belly plane (the jaw's underside rests on y = 0)
  J.nose = [0, 0.56 * hH, hL];
  J.jawHinge = [0, 0.34 * hH, 0.06 * hL];
  J.jawTip = [0, 0.16 * hH, 0.9 * hL];
  // tongue lies in its sheath in the floor of the mouth, tips just behind the chin
  J.tongueBase = [0, 0.2 * hH, 0.18 * hL];
  J.tongueFork = [0, 0.2 * hH, 0.62 * hL];
  J.tongueTip = [0, 0.2 * hH, 0.84 * hL];
  // fangs hinge at the front of the upper jaw, folded back along the palate
  J.fangBase = [0, 0.38 * hH, 0.72 * hL];
  J.fangTip = [0, 0.32 * hH, 0.55 * hL];
  const rig = buildRig({
    joints: J,
    unit: (B.headLen + B.bodyLen) / 1.3,
    headOrigin: J.v0,
    bones: snakeBones(SPINE, { neck: 4, tail: Math.round(B.tailFrac * SPINE) }),
    axial: {
      ...snakeAxial(SPINE),
      // the skull is rigid right up to the occiput; the neck blends in just behind it
      blend: { 1: [-0.004 * kH, 0.006 * kH] },
    },
    limbs: {},
    appendages: [],
  });
  rig.plan = B;
  return rig;
}
