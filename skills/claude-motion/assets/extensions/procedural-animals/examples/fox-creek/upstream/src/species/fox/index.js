// Red fox (Vulpes vulpes). A small, light, long-legged canid with a narrow pointed muzzle, big black-
// backed ears, vertical-slit pupils, black stockings, a white bib and a huge white-tipped brush; trots
// in a near single-file line and hunts small prey with a high arcing "mousing" pounce.
// Colour morphs are variants (createAnimal('fox', { variant: 'silver' })) or come from the seed.
import { foxRig, HEAD_O } from './rig.js';
import { sculptFox, eyeOf } from './sculpt.js';
import { foxRegions } from './regions.js';
import { foxCoat, palette } from './coat.js';
import { motion } from './motion.js';
import { rng } from '../../core/math/vec.js';

// [id, name, seeded frequency]
const VARIANTS = [
  ['red', 'Red fox', 0.7],
  ['cross', 'Cross fox', 0.12],
  ['silver', 'Silver fox', 0.08],
  ['urban', 'Urban fox (dark winter coat)', 0.1],
];

export default {
  id: 'fox',
  name: 'Red fox',
  latin: 'Vulpes vulpes',
  group: 'paws',
  plan: 'quadruped',
  covering: 'fur',
  variants: VARIANTS.map(([id, name]) => ({ id, name, latin: 'Vulpes vulpes' })),

  // Seeded individual. Morph (red 70 %, cross 12 %, silver 8 %, urban 10 %, or opts.variant); dog
  // foxes ~15-20 % heavier (+4 % withers height), broader head and muzzle, fuller ruff; vixens finer;
  // kits (age 'juvenile', ~10-12 weeks): about half size, big domed head, short muzzle, very big ears,
  // short legs and brush, woolly sandy coat, blue-grey eyes. Individuals vary in leg length, body
  // length, muzzle, ears, brush, the extent of the white bib, stockings and tail tip, colour warmth.
  variation(R, o) {
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const juv = age === 'juvenile' ? 1 : 0;
    const male = sex === 'male';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    // morph from its own hashed stream (consecutive seeds must not correlate)
    const M = rng(Math.imul((o.seed ?? 1) + 0x3c6ef372, 0x9e3779b1) ^ 0x5be0cd19);
    for (let i = 0; i < 3; i++) M();
    let variant = o.variant && VARIANTS.some((v) => v[0] === o.variant) ? o.variant : null;
    if (!variant) {
      let x = M();
      variant = 'red';
      for (const [id, , p] of VARIANTS) { if (x < p) { variant = id; break; } x -= p; }
    } else M();
    const size = (male ? 1.04 : 0.96) * (1 + 0.04 * g()) * (juv ? 0.55 : 1);
    const legs = 1 + 0.03 * g() - 0.1 * juv;
    const head = (male ? 1.03 : 0.98) * (1 + 0.02 * g());
    const coatSeed = Math.floor(R() * 1e6);
    // (every draw is made whatever the morph, so that a morph never changes the individual: the silver
    // fox's stockings ignore theirs)
    const morphed = (v, x) => (variant === 'silver' ? v : x);
    return {
      sex, age, size, variant, juv,
      muzzle: (male ? 1.02 : 0.99) * (1 + 0.04 * g()) * (juv ? 0.7 : 1),
      headW: (male ? 1.05 : 0.98) * (1 + 0.025 * g()) * (juv ? 1.06 : 1),
      ear: (1 + 0.05 * g()) * (juv ? 1.12 : 1),
      eyeK: juv ? 1.18 : 1,
      tail: (1 + 0.05 * g()) * (juv ? 0.72 : 1),
      tailBrush: (1 + 0.07 * g()) * (juv ? 0.75 : 1),
      ruff: (male ? 1.1 : 0.9) + 0.12 * g() - 0.2 * juv,
      slim: (male ? 1.04 : 0.97) * (1 + 0.03 * g()) * (juv ? 1.08 : 1),
      boneK: juv ? 1.12 : 1,
      pawK: juv ? 1.15 : 1,
      bib: 1 + 0.25 * g(),
      stockings: morphed(1, Math.max(0.2, 1 + 0.45 * g())),
      tailTip: M() < 0.08 && variant === 'red' ? 0 : 0.75 + 0.5 * M(), // 70-90 % of foxes have a white tip
      tear: 0.7 + 0.5 * M(),
      coatWarmth: 1.3 * g(),
      coatLightness: 0.16 * g(),
      coatSeed,
      minThick: 0.0022,
      warps: [
        { type: 'legs', k: legs, top: 0.25 },
        { type: 'length', k: 1 + 0.03 * g() - 0.05 * juv, z0: -0.19, z1: 0.24 },
        { type: 'scaleAbout', c: HEAD_O, k: head * (juv ? 1.3 : 1), r0: 0.05, r1: 0.12 },
        // big kit paws
        ...(juv ? [[0.028, 0.2], [-0.028, 0.2], [0.033, -0.2], [-0.033, -0.2]].map(([x, z]) => ({ type: 'scaleAbout', c: [x, 0.015, z], k: 1.18, r0: 0.018, r1: 0.04 })) : []),
      ],
    };
  },
  rig: (params) => foxRig(params),
  sculpt: (m, rig, params) => sculptFox(m, rig, params),
  regions: foxRegions,
  coat: foxCoat,
  eyeSpecs: (params) => {
    const look = eyeLookOf(params);
    return [1, -1].map((side) => ({ side, spec: eyeOf(params), headOrigin: HEAD_O, bone: 'head', look }));
  },
  motion,
  render: {
    markColor: [0.012, 0.01, 0.009],
    strandDensity: 1400,
    clumpDensity: 0.9,
  },
};

// Vertical slit pupil (elliptical in bright light, dilating to round in the dark), amber to yellow-
// orange iris (#c8943c with a darker ring #7a4a1c), no visible sclera, black lid margins.
export const EYE_LOOK = {
  pupil: 'slit',
  lids: 'mammal',
  iris: { inner: [0.5, 0.26, 0.04], mid: [0.62, 0.32, 0.06], hi: [0.8, 0.5, 0.14], outer: [0.19, 0.065, 0.012] },
  sclera: { color: [0.2, 0.15, 0.11], visible: false },
  lidColor: [0.45, 0.14, 0.035], // (per individual: eyeLookOf)
  pupilSize: [0.12, 0.75],
};
// kits: blue-grey eyes (turn amber at ~4-5 months)
export const KIT_EYE = {
  ...EYE_LOOK,
  iris: { inner: [0.1, 0.13, 0.17], mid: [0.2, 0.25, 0.32], hi: [0.36, 0.42, 0.5], outer: [0.06, 0.07, 0.09] },
};
// the lids are furred in the individual's face colour (the shader darkens the margin itself), so a
// blink, the curled sleep and death show a closed, furred lid with a dark line, not a black bead
function eyeLookOf(params) {
  return { ...(params.juv ? KIT_EYE : EYE_LOOK), lidColor: palette(params).lid };
}
