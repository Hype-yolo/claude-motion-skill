// Eagle (bald eagle Haliaeetus leucocephalus; golden eagle Aquila chrysaetos as `variant: 'golden'`).
// A soaring raptor on the bird body plan (core/motion/bird.js): upright perching carriage, massive
// hooked bill under a heavy brow, huge talons, broad plank wings with deeply slotted primaries.
import { eagleRig, HEAD_O } from './rig.js';
import { sculptEagle, EYE } from './sculpt.js';
import { eagleRegions } from './regions.js';
import { eagleCoat, eagleFeatherColour } from './coat.js';
import { motion, WING, FEATHERS } from './motion.js';
import { featherCards } from '../../core/build/featherCards.js';
import { srgb } from '../../core/build/coatKit.js';

export default {
  id: 'eagle',
  name: 'Eagle',
  latin: 'Haliaeetus leucocephalus',
  group: 'birds',
  plan: 'bird',
  covering: 'feathers',
  variants: ['bald', 'golden'],

  // Seeded individual. Reversed size dimorphism: females ~25-35 % heavier, ~8-10 % larger linearly.
  // Age: ~30 % of seeds are juveniles (bald: brown with white mottling, dark head and bill, brown
  // iris; golden: white tail base with a black band and white wing patches). Individuals differ in
  // size, bill size, leg length, head size, girth, plumage tone, wear and mottling.
  variation(R, o) {
    const g = () => (R() + R() + R() - 1.5) / 1.5;
    const variant = o.variant === 'golden' ? 'golden' : 'bald';
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || (R() < 0.3 ? 'juvenile' : 'adult');
    const juv = age === 'juvenile';
    const size = (sex === 'female' ? 1.04 : 0.94) * (1 + 0.035 * g()) * (variant === 'golden' ? 0.96 : 1);
    const bill = (sex === 'female' ? 1.03 : 0.98) * (1 + 0.05 * g()) * (variant === 'golden' ? 0.94 : 1);
    return {
      sex, age, size, variant,
      warps: [
        { type: 'legs', k: 1 + 0.035 * g(), top: 0.24 },
        // bill length / depth about the bill base (golden eagle: a smaller bill)
        { type: 'scaleAbout', c: [HEAD_O[0], HEAD_O[1] - 0.012, HEAD_O[2] + 0.045], k: bill, r0: 0.05, r1: 0.1 },
        { type: 'scaleAbout', c: HEAD_O, k: (1 + 0.03 * g()) * (variant === 'golden' ? 0.95 : 1), r0: 0.06, r1: 0.12 },
        // (girth: +-3.5 %, juveniles +1 % for their looser plumage - they read heavy at +3 %)
        { type: 'girth', k: 1 + 0.035 * g() + (juv ? 0.01 : 0), cy: 0.32, z0: -0.14, z1: 0.1, fade: 0.06 },
      ],
      wear: Math.max(0, 0.3 * g() + (juv ? 0.35 : 0.1)),
      warm: 0.5 + 0.5 * g(),
      mottle: juv ? 0.55 + 0.35 * g() : 0,
      billAge: juv ? Math.max(0, 0.25 * g()) : 1,
      goldK: 0.5 + 0.4 * g(),
      hood: 0.26 + 0.07 * g(), // how far down the neck the white hood reaches
    };
  },
  rig: () => eagleRig(),
  sculpt: (m, rig, params) => sculptEagle(m, rig, params),
  regions: eagleRegions,
  coat: eagleCoat,
  surfaces: (ctx) => featherCards({ ...ctx, wing: WING, feathers: FEATHERS, tail: { bindFan: 0.2 }, colour: eagleFeatherColour(ctx.params), thickness: 0.0009 }),
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: eyeLook(params) })),
  motion,
  render: { markColor: srgb(0x1a140f), strandDensity: 700, clumpDensity: 1.2, shellScale: 1, finWidth: 0.3 },
};

// Round pupil; bald adult: pale yellow iris; juveniles and golden eagles: brown. Bird lids with a
// nictitating membrane.
const EYE_BASE = {
  pupil: 'round',
  lids: 'bird',
  sclera: { visible: false, color: [0.02, 0.02, 0.02] },
  pupilSize: [0.34, 0.5],
};
export function eyeLook(p = {}) {
  const golden = p.variant === 'golden', juv = p.age === 'juvenile';
  let iris;
  if (!golden && !juv) iris = { inner: srgb(0xd9c878), mid: srgb(0xf2e6a0), hi: srgb(0xfaf2c8), outer: srgb(0xa89048) };
  else if (golden && !juv) iris = { inner: srgb(0x5a3414), mid: srgb(0x8a5a28), hi: srgb(0xb07a3c), outer: srgb(0x3a2410) };
  else iris = { inner: srgb(0x241408), mid: srgb(0x4a2c14), hi: srgb(0x6a4424), outer: srgb(0x1c1008) };
  return { ...EYE_BASE, iris, lidColor: golden || juv ? srgb(0x4a3a2a) : srgb(0xc8b070) };
}
