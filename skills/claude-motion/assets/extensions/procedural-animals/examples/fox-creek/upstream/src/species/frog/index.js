// True frogs (Ranidae): the American bullfrog (Lithobates catesbeianus, default) and the common frog
// (Rana temporaria, variant 'common-frog'). Built on the quadruped engine with its sprawl knob
// (knees and elbows out), paired hind legs and the hopper tools: the classic sitting frog is the
// resting stance; it crawls for short moves, hops as its main gait, makes long jumps (hind legs
// fully extended in flight, forelimbs land first), turns by pivoting, and has frog behaviours
// (throat pumping, blinking by retracting the eyes, tongue-flick feeding, croaking with the vocal
// sac, long motionless sits) through species hooks (behaviour.js).
import { frogRig, HEAD_O } from './rig.js';
import { sculptFrog, EYE } from './sculpt.js';
import { frogRegions } from './regions.js';
import { frogCoat } from './coat.js';
import { motion } from './motion.js';

// Seeded individual.
//  variant: 'bullfrog' (default: green / olive / pale colour morphs), 'bullfrog-pale',
//           'common-frog' (Rana temporaria: smaller, brown with a dark temporal mask and
//           dorsolateral folds)
//  sex:     bullfrog males: tympanum larger than the eye, yellow throat, thicker forearms with a
//           nuptial pad, a little smaller than females; females: tympanum ~ eye, cream throat
//  age:     'adult' | 'juvenile' (a young frog: much smaller, big head and eyes, greener)
function variation(R, o) {
  const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
  const age = o.age || 'adult';
  const juv = age === 'juvenile';
  const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
  const u = () => 2 * R() - 1;
  let variant = o.variant || 'bullfrog';
  const temporaria = variant === 'common-frog';
  let colour;
  if (temporaria) colour = 'temporaria';
  else if (variant === 'bullfrog-pale') colour = 'pale';
  else colour = sex === 'male' ? (R() < 0.75 ? 'green' : 'olive') : (R() < 0.45 ? 'green' : 'olive');
  // size: bullfrog SVL 90-152 mm, females larger (reference 140 mm); common frog 60-90 mm
  let size = temporaria ? 0.55 * (1 + 0.08 * g()) * (sex === 'female' ? 1.03 : 0.97) : (sex === 'male' ? 0.92 : 1.0) * (1 + 0.07 * g());
  if (juv) size *= 0.42;
  const male = sex === 'male';
  return {
    sex, age, size, variant, colour,
    // tympanum radius (m at the reference size): males 1.3-1.6x the eye, females ~ the eye
    tympanum: (male ? 0.0102 : 0.0073) * (1 + 0.07 * g()) * (juv ? 0.8 : 1),
    headWidth: (1 + 0.035 * g()) * (juv ? 1.04 : 1),
    plump: (1 + 0.05 * g()) * (sex === 'female' ? 1.03 : 0.98) * (juv ? 0.95 : 1),
    armK: 1 + 0.05 * g(),
    mottle: temporaria ? 0.55 + 0.35 * R() : 0.35 + 0.5 * R(),
    mottleSize: 0.8 + 0.45 * R(),
    minThick: 0.0008,
    warps: [
      { type: 'legs', k: 1 + 0.03 * g(), top: 0.02 },
      { type: 'length', k: 1 + 0.03 * g() - (juv ? 0.05 : 0), z0: -0.05, z1: 0.02 },
      { type: 'scaleAbout', c: HEAD_O, k: (1 + 0.03 * g()) * (juv ? 1.22 : 1) * (temporaria ? 0.96 : 1), r0: 0.02, r1: 0.045 },
    ],
    coatWarmth: (temporaria ? 1.2 : 0.8) * u(),
    coatLightness: 0.12 * u(),
    coatGreen: temporaria ? 0.6 * u() : 0.5 * u() + (male ? 0.3 : 0),
    coatSeed: Math.floor(R() * 1e6),
  };
}

export default {
  id: 'frog',
  name: 'True frog',
  latin: 'Lithobates catesbeianus / Rana temporaria',
  group: 'others',
  plan: 'quadruped',
  covering: 'skin',
  variants: [
    { id: 'bullfrog', name: 'American bullfrog', latin: 'Lithobates catesbeianus' },
    { id: 'bullfrog-pale', name: 'American bullfrog (pale morph)', latin: 'Lithobates catesbeianus' },
    { id: 'common-frog', name: 'Common frog', latin: 'Rana temporaria' },
  ],
  variation,
  rig: (params) => frogRig(params),
  sculpt: (m, rig, params) => sculptFrog(m, rig, params),
  regions: frogRegions,
  coat: frogCoat,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: side > 0 ? 'eyeL' : 'eyeR', look: params.variant === 'common-frog' ? EYE_TEMPORARIA : EYE_BULLFROG })),
  motion,
  render: { markColor: [0.02, 0.018, 0.01] },
};

// Horizontal (bar) pupil in a gold / bronze iris with dark reticulation; no sclera; the translucent
// lower lid (nictitating membrane) rises to blink (driven by behaviour.js with the eye retraction:
// automatic mammal / bird blinks are off).
export const EYE_BULLFROG = {
  pupil: 'bar',
  lids: 'bird',
  blink: false,
  iris: { inner: [0.42, 0.26, 0.05], mid: [0.62, 0.4, 0.09], hi: [0.9, 0.66, 0.22], outer: [0.1, 0.06, 0.015] },
  sclera: { color: [0.05, 0.04, 0.02], visible: false },
  lidColor: [0.2, 0.22, 0.12],
  pupilSize: [0.16, 0.44],
};
export const EYE_TEMPORARIA = {
  ...EYE_BULLFROG,
  iris: { inner: [0.24, 0.12, 0.03], mid: [0.44, 0.25, 0.06], hi: [0.68, 0.46, 0.16], outer: [0.06, 0.035, 0.015] },
  lidColor: [0.2, 0.15, 0.09],
};
