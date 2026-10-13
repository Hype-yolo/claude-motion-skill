// Cheetah (Acinonyx jubatus). Ported from the original procedural cheetah, which set the quality bar.
import { cheetahRig, HEAD_O } from './rig.js';
import { sculptCheetah, EYE } from './sculpt.js';
import { cheetahRegions } from './regions.js';
import { cheetahCoat } from './coat.js';
import { motion } from './motion.js';

export default {
  id: 'cheetah',
  name: 'Cheetah',
  latin: 'Acinonyx jubatus',
  group: 'paws',
  plan: 'quadruped',
  covering: 'fur',

  // Seeded individual: size, proportions and coat. Adults only differ a little by sex (males ~10 %
  // heavier, slightly larger heads); juveniles are smaller with relatively bigger heads and paws.
  variation(R, o) {
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const juv = age === 'juvenile';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    const size = (sex === 'male' ? 1.02 : 0.96) * (1 + 0.04 * g()) * (juv ? 0.62 : 1);
    return {
      sex, age, size,
      warps: [
        { type: 'legs', k: 1 + 0.035 * g() - (juv ? 0.06 : 0), top: 0.5 },
        { type: 'length', k: 1 + 0.03 * g(), z0: -0.45, z1: 0.35 },
        { type: 'scaleAbout', c: HEAD_O, k: (sex === 'male' ? 1.03 : 0.98) * (1 + 0.025 * g()) * (juv ? 1.18 : 1), r0: 0.07, r1: 0.16 },
      ],
      coatWarmth: 0.6 * g(),
      coatLightness: 0.05 * g(),
      coatSeed: Math.floor(R() * 1e6),
    };
  },
  rig: () => cheetahRig(),
  sculpt: (m, rig) => sculptCheetah(m, rig),
  regions: cheetahRegions,
  coat: cheetahCoat,
  eyeSpecs: () => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: EYE_LOOK })),
  motion,
};

// Round pupil, amber iris, dark lid margins (the famous black "eyeliner").
export const EYE_LOOK = {
  pupil: 'round',
  lids: 'mammal',
  iris: { inner: [0.2, 0.06, 0.007], mid: [0.54, 0.2, 0.022], hi: [0.78, 0.38, 0.055], outer: [0.26, 0.075, 0.009] },
  lidColor: [0.5, 0.31, 0.15],
  pupilSize: [0.3, 0.5],
};
