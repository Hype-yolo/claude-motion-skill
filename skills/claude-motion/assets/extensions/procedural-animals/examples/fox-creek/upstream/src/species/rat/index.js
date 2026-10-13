// Brown rat (Rattus norvegicus). A small plantigrade quadruped on the rabbit / bear templates: a
// hunched pear-shaped body, pointed snout with whiskers (real geometry) and yellow incisors, dark
// bulging eyes, thin rounded ears, pink hands and feet with separate toes, and a long scaly tail.
// Colours are variants (createAnimal('rat', { variant: 'hooded' })): 'wild' (default: agouti, ~15 %
// of seeds the dark urban form), 'agouti', 'dark', 'albino' (white, pink skin, red eyes), 'hooded'
// (fancy: black hood and dorsal stripe on white, sometimes a blaze); pups with { age: 'juvenile' }.
import { ratRig, HEAD_O, hl } from './rig.js';
import { sculptRat, eyeOf } from './sculpt.js';
import { ratRegions } from './regions.js';
import { ratCoat } from './coat.js';
import { ratWhiskers } from './whiskers.js';
import { motion } from './motion.js';
import { rng } from '../../core/math/vec.js';

const VARIANTS = [
  ['wild', 'Wild brown rat'],
  ['agouti', 'Agouti'],
  ['dark', 'Dark (urban)'],
  ['albino', 'Albino (PEW)'],
  ['hooded', 'Hooded (fancy)'],
];

// Seeded individual. Size: males 350-500 g, females 250-350 g (length ~ mass^1/3 against the
// ~330 g reference); juveniles (~4-5 weeks, ~70 g): 0.6 x, big head, eyes, ears and feet, shorter
// tail. Proportions per seed: legs, body length, girth, head width, muzzle, ears, tail length.
function variation(R, o) {
  const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
  // the coat from its own hashed stream so consecutive seeds do not correlate
  const M = rng(Math.imul((o.seed ?? 1) + 0x5bd1e995, 0x297a2d39) ^ 0x1b873593);
  for (let i = 0; i < 3; i++) M();
  let variant = o.variant && VARIANTS.some((v) => v[0] === o.variant) ? o.variant : 'wild';
  const colour = variant === 'wild' ? (M() < 0.15 ? 'dark' : 'agouti') : variant;
  const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
  const age = o.age || 'adult';
  const juv = age === 'juvenile' ? 1 : 0;
  const male = sex === 'male' ? 1 : 0;
  const fancy = colour === 'albino' || colour === 'hooded';
  const size = (male ? 1.07 : 0.965) * (1 + 0.045 * g()) * (juv ? 0.6 : 1);
  const head = (male ? 1.03 : 0.99) * (1 + 0.025 * g()) * (juv ? 1.22 : 1);
  const params = {
    sex, age, size, variant, colour, juv,
    tail: (1 + 0.05 * g()) * (juv ? 0.86 : 1),
    tailThick: (1 + 0.06 * g()) * (male ? 1.05 : 1) * (juv ? 0.9 : 1),
    ear: (1 + 0.06 * g()) * (juv ? 1.14 : 1) * (fancy ? 1.04 : 1),
    earWidth: 1 + 0.05 * g(),
    headWidth: (male ? 1.05 : 1) * (1 + 0.03 * g()),
    muzzle: (1 + 0.04 * g()) * (juv ? 0.86 : 1) * (fancy ? 0.97 : 1),
    whisker: (1 + 0.06 * g()) * (juv ? 0.8 : 1),
    blaze: colour === 'hooded' && M() < 0.35 ? 0.7 + 0.5 * M() : 0,
    coatWarmth: colour === 'agouti' ? 0.9 * g() : 0.3 * g(),
    coatLightness: 0.09 * g(),
    coatSeed: Math.floor(R() * 1e6),
    minThick: 0.0005,
    warps: [
      { type: 'legs', k: 1 + 0.035 * g() - 0.04 * juv, top: 0.03 },
      { type: 'length', k: 1 + 0.03 * g() - 0.07 * juv + 0.01 * male, z0: -0.07, z1: 0.03 },
      { type: 'girth', k: 1 + 0.06 * g() + 0.03 * male - 0.04 * juv + (fancy ? 0.02 : 0), cy: 0.05, z0: -0.085, z1: 0.04, fade: 0.012 },
      { type: 'scaleAbout', c: HEAD_O, k: head, r0: 0.016, r1: 0.034 },
      // pups: big feet
      ...(juv ? [[0.019, 0.037], [-0.019, 0.037], [0.024, -0.028], [-0.024, -0.028]].map(([x, z]) => ({ type: 'scaleAbout', c: [x, 0.003, z], k: 1.15, r0: 0.006, r1: 0.014 })) : []),
    ],
  };
  return params;
}

export default {
  id: 'rat',
  name: 'Brown rat',
  latin: 'Rattus norvegicus',
  group: 'paws',
  plan: 'quadruped',
  covering: 'fur',
  variants: VARIANTS.map(([id, name]) => ({ id, name, latin: 'Rattus norvegicus' })),
  variation,
  rig: (params) => ratRig(params),
  sculpt: (m, rig, params) => sculptRat(m, rig, params),
  regions: ratRegions,
  coat: ratCoat,
  surfaces: ratWhiskers,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: eyeOf(params), headOrigin: HEAD_O, bone: 'head', look: params.colour === 'albino' ? EYE_ALBINO : EYE_LOOK })),
  motion,
  render: (params = {}) => ({
    markColor: params.colour === 'albino' ? [0.5, 0.25, 0.25] : [0.02, 0.015, 0.013],
    strandDensity: 2600,
    clumpDensity: 2.2,
    shellScale: 1,
    // (no silhouette fins: on this short coat their inset edge drew a dark line along the outline)
    fins: false,
    raiseLen: [0.004, 0.009],
  }),
};

// Wild type: a glossy near-black bead (very dark brown iris, the round pupil barely distinguishable)
export const EYE_LOOK = {
  pupil: 'round',
  lids: 'mammal',
  iris: { inner: [0.006, 0.003, 0.0025], mid: [0.011, 0.006, 0.005], hi: [0.03, 0.017, 0.012], outer: [0.004, 0.0025, 0.002] },
  sclera: { color: [0.01, 0.007, 0.006], visible: false },
  lidColor: [0.03, 0.02, 0.018],
  pupilSize: [0.55, 0.7],
};
// Albino: red (the fundus through an unpigmented iris), a pale pink tinge at the rim
export const EYE_ALBINO = {
  pupil: 'round',
  lids: 'mammal',
  iris: { inner: [0.35, 0.02, 0.03], mid: [0.45, 0.04, 0.05], hi: [0.7, 0.3, 0.3], outer: [0.3, 0.05, 0.06] },
  sclera: { color: [0.4, 0.1, 0.1], visible: false },
  lidColor: [0.7, 0.42, 0.4],
  pupilSize: [0.45, 0.6],
};
void hl;
