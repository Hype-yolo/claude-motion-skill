// Crow (American crow Corvus brachyrhynchos; carrion crow C. corone and hooded crow C. cornix as
// variants). The proving species of the bird body plan (core/motion/bird.js).
import { crowRig, HEAD_O } from './rig.js';
import { sculptCrow, EYE } from './sculpt.js';
import { crowRegions } from './regions.js';
import { crowCoat, crowFeatherColour } from './coat.js';
import { motion, WING, FEATHERS } from './motion.js';
import { featherCards } from '../../core/build/featherCards.js';
import { srgb } from '../../core/build/coatKit.js';

export default {
  id: 'crow',
  name: 'Crow',
  latin: 'Corvus brachyrhynchos',
  group: 'birds',
  plan: 'bird',
  covering: 'feathers',
  variants: [
    { id: 'american', name: 'American crow', latin: 'Corvus brachyrhynchos' },
    { id: 'carrion', name: 'Carrion crow', latin: 'Corvus corone' },
    { id: 'hooded', name: 'Hooded crow', latin: 'Corvus cornix' },
  ],

  // Seeded individual. No plumage dimorphism; males ~5 % larger (wing, bill). Juveniles are adult-sized
  // at fledging but duller, fluffier and blue-grey eyed with a shorter tail. Individuals differ in size,
  // bill length and depth, leg length, head size, gloss and feather wear (brownish in summer).
  // Variants: 'american' (default), 'carrion' (greener gloss, heavier bill), 'hooded' (grey body).
  variation(R, o) {
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const juv = age === 'juvenile';
    const g = () => (R() + R() + R() - 1.5) / 1.5;
    const morph = o.variant || (R() < 0.75 ? 'american' : 'carrion');
    const size = (sex === 'male' ? 1.03 : 0.97) * (1 + 0.045 * g()) * (juv ? 0.95 : 1) * (morph === 'american' ? 1 : 1.06);
    const bill = (morph === 'carrion' ? 1.06 : 1) * (1 + 0.06 * g()) * (sex === 'male' ? 1.03 : 1);
    return {
      sex, age, size, morph, variant: morph,
      warps: [
        { type: 'legs', k: 1 + 0.04 * g(), top: 0.12 },
        // bill length / depth about the bill base
        { type: 'scaleAbout', c: [0, 0.292, 0.135], k: bill, r0: 0.03, r1: 0.06 },
        { type: 'scaleAbout', c: HEAD_O, k: (1 + 0.03 * g()) * (juv ? 1.06 : 1), r0: 0.03, r1: 0.06 },
        { type: 'girth', k: 1 + 0.05 * g() + (juv ? 0.05 : 0), cy: 0.16, z0: -0.08, z1: 0.1, fade: 0.04 },
      ],
      wear: Math.max(0, 0.25 * g() + (juv ? 0.4 : 0.1)),
      gloss: 1 + 0.12 * g() - (juv ? 0.4 : 0),
      tailK: juv ? 0.88 : 1 + 0.03 * g(),
    };
  },
  rig: () => crowRig(),
  sculpt: (m, rig) => sculptCrow(m, rig),
  regions: crowRegions,
  coat: crowCoat,
  surfaces: (ctx) => featherCards({ ...ctx, wing: WING, feathers: FEATHERS, tail: { bindFan: 0.2 }, colour: crowFeatherColour(ctx.params) }),
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: params.age === 'juvenile' ? EYE_JUV : EYE_LOOK })),
  motion,
  // featherEdge: faint shingle outlines (photos show a smooth sheen, not scaled feathers)
  render: { markColor: srgb(0x121214), strandDensity: 900, clumpDensity: 1.4, shellScale: 1, finWidth: 0.3, featherEdge: 0.4 },
};

// Round pupil, dark brown iris (reads black at distance), bird lids with a nictitating membrane.
export const EYE_LOOK = {
  pupil: 'round',
  lids: 'bird',
  iris: { inner: srgb(0x120c09), mid: srgb(0x2a1e18), hi: srgb(0x4a3526), outer: srgb(0x100b09) },
  sclera: { visible: false, color: [0.02, 0.02, 0.02] },
  lidColor: srgb(0x1c1b1d),
  pupilSize: [0.36, 0.52],
};
export const EYE_JUV = { ...EYE_LOOK, iris: { inner: srgb(0x3a4450), mid: srgb(0x7d8ca0), hi: srgb(0xa6b3c2), outer: srgb(0x3c4552) } };
