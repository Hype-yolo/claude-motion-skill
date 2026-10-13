// European rabbit (Oryctolagus cuniculus): the wild agouti rabbit plus the common domestic colours.
// The body plan proves the hopping path of the quadruped engine: long hind legs, feet flat at rest
// and on the toes in motion, half-bound and bound gaits with the hind feet landing together, a
// crouched resting stance, and rabbit behaviours (hop, nose twitch, ear swivels, grooming,
// periscope, thumping, binky, zig-zag escape, grazing, boxing).
import { rabbitRig, HEAD_O } from './rig.js';
import { sculptRabbit, EYE } from './sculpt.js';
import { rabbitRegions } from './regions.js';
import { rabbitCoat } from './coat.js';
import { motion } from './motion.js';

// Seeded individual.
//  variant: 'wild' (default: agouti, the European rabbit), 'domestic' (random domestic colour),
//           'agouti-domestic', 'fawn', 'black', 'white' (REW albino), 'dutch' (pied), 'lop'
//  age:     'adult' | 'juvenile' (a kit ~4-6 weeks: round head, short ears, big eyes and feet)
function variation(R, o) {
  const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
  const age = o.age || 'adult';
  const juv = age === 'juvenile';
  const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
  const u = () => 2 * R() - 1; // uniform [-1, 1]
  let variant = o.variant || 'wild';
  if (variant === 'domestic') variant = ['agouti-domestic', 'fawn', 'black', 'white', 'dutch', 'lop'][Math.floor(R() * 6)];
  const domestic = variant !== 'wild';
  const lop = variant === 'lop';
  // colour: wild and agouti-domestic are agouti; lops come in any colour
  let colour = { wild: 'agouti', 'agouti-domestic': 'agouti', fawn: 'fawn', black: 'black', white: 'white', dutch: R() < 0.6 ? 'black' : 'agouti', lop: ['agouti', 'fawn', 'black', 'white'][Math.floor(R() * 4)] }[variant] || 'agouti';
  // size: wild 1.5-2.2 kg (length ~ mass^1/3); domestic breeds 1-3.5 kg; kits ~0.2-0.4 kg
  let size = (domestic ? 1.06 + 0.08 * g() : 1 + 0.07 * u()) * (sex === 'male' ? 1.01 : 0.99);
  if (juv) size *= 0.58;
  const earLen = (domestic ? 0.92 : 1) * (1 + 0.07 * g()) * (juv ? 0.78 : 1);
  return {
    sex, age, size, variant, colour, domestic, lop,
    dutch: variant === 'dutch',
    earLen,
    earWidth: (lop ? 1.25 : 1) * (1 + 0.05 * g()),
    headWidth: (domestic ? 1.06 : 1) * (sex === 'male' ? 1.03 : 1) * (juv ? 1.06 : 1),
    minThick: 0.0011,
    warps: [
      { type: 'legs', k: 1 + 0.04 * g() - (juv ? 0.04 : 0), top: 0.08 },
      { type: 'length', k: 1 + 0.03 * g() - (domestic ? 0.03 : 0) - (juv ? 0.06 : 0), z0: -0.12, z1: 0.07 },
      { type: 'girth', k: 1 + 0.06 * g() + (domestic ? 0.05 : 0), cy: 0.12, z0: -0.15, z1: 0.1 },
      { type: 'scaleAbout', c: HEAD_O, k: (sex === 'male' ? 1.02 : 0.99) * (1 + 0.02 * g()) * (juv ? 1.2 : 1) * (domestic ? 1.03 : 1), r0: 0.035, r1: 0.075 },
    ],
    coatWarmth: 1.1 * u(),
    coatLightness: 0.12 * u(),
    coatSeed: Math.floor(R() * 1e6),
  };
}

export default {
  id: 'rabbit',
  name: 'European rabbit',
  latin: 'Oryctolagus cuniculus',
  group: 'paws',
  plan: 'quadruped',
  covering: 'fur',
  variation,
  rig: (params) => rabbitRig(params),
  sculpt: (m, rig, params) => sculptRabbit(m, rig, params),
  regions: rabbitRegions,
  coat: rabbitCoat,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: params.colour === 'white' ? EYE_ALBINO : EYE_LOOK })),
  motion,
  render: { markColor: [0.018, 0.014, 0.011], strandDensity: 1500, clumpDensity: 1.2, shellScale: 1, finWidth: 0.45 },
};

// Round pupil in a dark brown iris that fills the whole opening (no sclera shows).
export const EYE_LOOK = {
  pupil: 'round',
  lids: 'mammal',
  iris: { inner: [0.02, 0.011, 0.006], mid: [0.045, 0.024, 0.012], hi: [0.1, 0.06, 0.03], outer: [0.012, 0.007, 0.004] },
  sclera: { color: [0.03, 0.02, 0.015], visible: false },
  lidColor: [0.05, 0.035, 0.028],
  pupilSize: [0.45, 0.62],
};
// REW albino: pale pink iris, red pupil (the fundus shows through)
export const EYE_ALBINO = {
  pupil: 'round',
  lids: 'mammal',
  iris: { inner: [0.55, 0.12, 0.14], mid: [0.75, 0.42, 0.44], hi: [0.9, 0.6, 0.6], outer: [0.6, 0.3, 0.32] },
  sclera: { color: [0.6, 0.35, 0.35], visible: false },
  lidColor: [0.75, 0.5, 0.48],
  pupilSize: [0.35, 0.5],
};
