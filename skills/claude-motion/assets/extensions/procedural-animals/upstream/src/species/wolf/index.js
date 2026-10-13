// Grey wolf (Canis lupus). Digitigrade trot specialist with a dense double coat.
import { wolfRig, HEAD_O } from './rig.js';
import { sculptWolf, eyeOf } from './sculpt.js';
import { wolfRegions } from './regions.js';
import { wolfCoat } from './coat.js';
import { motion } from './motion.js';

const VARIANTS = [['grey', 0.6], ['black', 0.2], ['pale', 0.15], ['tawny', 0.05]];

export default {
  id: 'wolf',
  name: 'Grey wolf',
  latin: 'Canis lupus',
  group: 'paws',
  plan: 'quadruped',
  covering: 'fur',
  // the colour morphs (createAnimal('wolf', { variant: 'black' })); without a variant the seed picks one
  // (grey 60 %, black 20 %, pale 15 %, tawny 5 %)
  variants: [
    { id: 'grey', name: 'Grey wolf', latin: 'Canis lupus' },
    { id: 'black', name: 'Black wolf', latin: 'Canis lupus (melanistic)' },
    { id: 'pale', name: 'Pale wolf', latin: 'Canis lupus (arctic type)' },
    { id: 'tawny', name: 'Tawny wolf', latin: 'Canis lupus (Eurasian type)' },
  ],

  // Seeded individual. Morph (grey agouti 60 %, black 20 %, pale / arctic-type 15 %, tawny 5 %);
  // males ~20 % heavier (+4 % withers height), broader head and muzzle, fuller ruff; pups (8-12
  // weeks): half size, big domed head and big paws, short muzzle (~55-70 % of adult), short legs
  // and tail, uniform sooty fluffy coat, blue-grey eyes. Individuals vary in leg length, body
  // length, muzzle, ears, tail, saddle extent, mask contrast and colour temperature.
  variation(R, o) {
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const juv = age === 'juvenile' ? 1 : 0;
    const male = sex === 'male';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    let variant = o.variant;
    if (!variant) {
      let x = R();
      variant = 'grey';
      for (const [name, p] of VARIANTS) { if (x < p) { variant = name; break; } x -= p; }
    } else R();
    const size = (male ? 1.035 : 0.965) * (variant === 'tawny' ? 0.94 : 1) * (1 + 0.035 * g()) * (juv ? 0.52 : 1);
    const legs = 1 + 0.03 * g() - 0.1 * juv + (variant === 'pale' ? -0.03 : 0);
    const head = (male ? 1.035 : 0.98) * (1 + 0.02 * g());
    return {
      sex, age, size, variant, juv,
      muzzle: (1 + 0.04 * g()) * (juv ? 0.68 : 1) * (variant === 'pale' ? 0.96 : 1),
      headW: (male ? 1.06 : 0.98) * (1 + 0.02 * g()) * (juv ? 1.06 : 1),
      ear: (1 + 0.05 * g()) * (juv ? 1.12 : 1) * (variant === 'pale' ? 0.92 : 1),
      tail: (1 + 0.04 * g()) * (juv ? 0.75 : 1),
      tailBrush: (1 + 0.06 * g()) * (juv ? 0.85 : 1),
      ruff: Math.max(0.85, 1 + 0.12 * g()) * (male ? 1.1 : 0.95) - 0.2 * juv,
      saddle: 1.1 * g(),
      mask: 1 + 0.15 * g(),
      legLine: variant === 'grey' || variant === 'tawny' ? Math.max(0, 0.3 + 0.7 * g()) : 0,
      frost: variant === 'black' ? Math.max(0, 0.25 + 0.5 * g()) * (juv ? 0 : 1) : 0,
      coatWarmth: 0.6 * g(),
      coatLightness: 0.18 * g(),
      coatSeed: Math.floor(R() * 1e6),
      minThick: 0.0035,
      warps: [
        { type: 'legs', k: legs, top: 0.45 },
        { type: 'length', k: 1 + 0.03 * g() - 0.04 * juv, z0: -0.3, z1: 0.38 },
        { type: 'scaleAbout', c: HEAD_O, k: head * (juv ? 1.3 : 1), r0: 0.08, r1: 0.2 },
        // big pup paws
        ...(juv ? [[0.056, 0.32], [-0.056, 0.32], [0.064, -0.3], [-0.064, -0.3]].map(([x, z]) => ({ type: 'scaleAbout', c: [x, 0.03, z], k: 1.22, r0: 0.035, r1: 0.075 })) : []),
      ],
      // grey individuals range from cream-grey (threequarter1, front1) to dark grizzled (threequarter2,
      // face1): -1 toward the black morph .. 1 toward the pale one (drawn last: the other params keep
      // their seeds)
      greyTone: g(),
    };
  },
  rig: (params) => wolfRig(params),
  sculpt: (m, rig, params) => sculptWolf(m, rig, params),
  regions: wolfRegions,
  coat: wolfCoat,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: eyeOf(params), headOrigin: HEAD_O, bone: 'head', look: params.juv ? PUP_EYE : EYE_LOOK })),
  motion,
  render: {
    markColor: [0.012, 0.01, 0.009],
    strandDensity: 700,
    clumpDensity: 0.8,
    // the leather is matte, with a broad soft sheen (face1, face2; 0.42 focused the key light into one
    // hard dot), and its marks are the nostrils (coat.js)
    noseRoughness: 0.58,
    noseMarks: true,
    // (its colour from the coat: pale rims round the nostrils and a paler septum)
    noseTint: true,
  },
};

// Round pupil, amber iris (#c89b45 with a darker limbal ring #6b4a20), no visible sclera, black lids.
export const EYE_LOOK = {
  pupil: 'round',
  lids: 'mammal',
  iris: { inner: [0.36, 0.2, 0.035], mid: [0.58, 0.33, 0.06], hi: [0.78, 0.52, 0.13], outer: [0.15, 0.07, 0.014] },
  sclera: { color: [0.2, 0.15, 0.11], visible: false },
  lidColor: [0.02, 0.017, 0.015],
  pupilSize: [0.25, 0.55],
};
// 8-12 week pups: blue-grey eyes (turn amber at 8-16 weeks)
export const PUP_EYE = {
  ...EYE_LOOK,
  iris: { inner: [0.1, 0.13, 0.17], mid: [0.2, 0.25, 0.32], hi: [0.36, 0.42, 0.5], outer: [0.06, 0.07, 0.09] },
};
