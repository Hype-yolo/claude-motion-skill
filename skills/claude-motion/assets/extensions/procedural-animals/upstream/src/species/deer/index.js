// White-tailed deer (Odocoileus virginianus). Hooves with hoof bones (the horse's anatomy at deer
// proportions: very slender long legs), large mobile ears, the white flag of a tail, antlers on bucks
// (rigid bone-coloured geometry on the head, grown by age: spike yearling, 6-8 points, 8-10
// points), spotted fawns, summer red-brown and winter grey-brown coats.
import { deerRig, HEAD_O } from './rig.js';
import { sculptDeer, EYE } from './sculpt.js';
import { deerRegions } from './regions.js';
import { deerCoat, COATS } from './coat.js';
import { srgb } from '../../core/build/coatKit.js';
import { motion } from './motion.js';

const pick = (R, table) => {
  let x = R() * table.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of table) { x -= w; if (x <= 0) return k; }
  return table[table.length - 1][0];
};

// Antlers by age class: burr on the frontal pedicle, main beam curving out,
// back and then forward and in, tines rising near-vertically from its top. Tine rows: [position
// along the beam 0..1, length (m), outward lean].
function antlersFor(R, ageClass, g) {
  const burr = [0.024, 0.042, -0.022];
  if (ageClass === 'yearling') {
    if (R() < 0.6) return { spike: true, beam: 0.11 + 0.07 * R(), base: 0.0105, burr, seed: Math.floor(R() * 1e6), points: 2 };
    return { spike: false, beam: 0.2 + 0.05 * R(), base: 0.012, spread: 0.85 + 0.1 * g(), rise: 1.15, curl: 0.8, burr, tines: [[0.45, 0.07 + 0.03 * R(), 0.2]], seed: Math.floor(R() * 1e6), points: 4 };
  }
  const mature = ageClass === 'mature';
  const beam = mature ? 0.44 + 0.08 * R() : 0.33 + 0.07 * R();
  const tines = [];
  const brow = mature ? R() < 0.9 : R() < 0.6;
  if (brow) tines.push([0.09, 0.04 + 0.05 * R(), 0.15]);
  tines.push([0.37, (mature ? 0.13 : 0.1) + 0.05 * R(), 0.3]);
  if (mature || R() < 0.55) tines.push([0.6, (mature ? 0.11 : 0.08) + 0.04 * R(), 0.3]);
  if (mature && R() < 0.65) tines.push([0.8, 0.06 + 0.04 * R(), 0.25]);
  return {
    spike: false, beam, base: mature ? 0.022 : 0.018,
    spread: (mature ? 1.2 : 1.08) + 0.1 * g(), rise: 1 + 0.12 * g(), curl: 1 + 0.12 * g(),
    burr, tines, seed: Math.floor(R() * 1e6), points: 2 * (tines.length + 1),
  };
}

export default {
  id: 'deer',
  name: 'White-tailed deer',
  latin: 'Odocoileus virginianus',
  group: 'hooves',
  plan: 'quadruped',
  covering: 'fur',
  // coat seasons as variants (createAnimal('deer', { variant: 'winter' }))
  variants: [
    { id: 'summer', name: 'White-tailed deer (summer coat)', latin: 'Odocoileus virginianus' },
    { id: 'winter', name: 'White-tailed deer (winter coat)', latin: 'Odocoileus virginianus' },
  ],

  // Seeded individual. Sex: doe or buck; age: adult (bucks by age class: yearling, 2.5 years,
  // mature) or juvenile (fawn: spotted reddish coat, long legs, big head and ears); size and
  // proportions within the species' range; summer red-brown or winter grey-brown coat (o.variant
  // forces 'summer' / 'winter'); bucks in summer carry antlers in velvet.
  variation(R, o) {
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || (R() < 0.12 ? 'juvenile' : 'adult');
    const fawn = age === 'juvenile';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    const coat = o.variant === 'summer' || o.variant === 'winter' ? o.variant : R() < 0.5 ? 'summer' : 'winter';
    const ageClass = fawn ? 'fawn' : sex === 'male' ? pick(R, [['yearling', 30], ['prime', 35], ['mature', 35]]) : 'adult';
    const buckSize = { yearling: 0.97, prime: 1.05, mature: 1.12 }[ageClass] || 1;
    const size = (sex === 'male' ? buckSize : 0.98) * (1 + 0.04 * g()) * (fawn ? 0.52 : 1);
    const antlers = sex === 'male' && !fawn ? antlersFor(R, ageClass, g) : null;
    if (antlers) antlers.velvet = coat === 'summer' && R() < 0.75;
    const type = g(); // - leggier / lighter, + stockier
    return {
      sex, age, ageClass, size, coat, antlers,
      variant: coat, // the variant this individual was built as (the showcase and tools read params.variant)
      neck: sex === 'male' && !fawn ? (ageClass === 'mature' ? 0.7 : ageClass === 'prime' ? 0.45 : 0.15) * (coat === 'winter' ? 1 : 0.5) : 0,
      coatShade: g(), coatLightness: 0.06 * g(),
      coatSeed: Math.floor(R() * 1e6),
      minThick: 0.004,
      warps: [
        { type: 'legs', k: (1 + 0.03 * g() - 0.02 * type) * (fawn ? 1.22 : 1), top: 0.5 },
        { type: 'length', k: (1 + 0.03 * g() + ({ prime: 0.02, mature: 0.04 }[ageClass] || 0)) * (fawn ? 0.86 : 1), z0: -0.5, z1: 0.35 },
        { type: 'girth', k: 1 + 0.045 * type + ({ yearling: 0.02, prime: 0.05, mature: 0.08 }[ageClass] || 0), cy: 0.68, z0: -0.55, z1: 0.42 },
        fawn
          ? { type: 'scaleAbout', c: HEAD_O, k: 1.28, r0: 0.1, r1: 0.26 }
          : { type: 'scaleAbout', c: HEAD_O, k: 1 + 0.025 * g(), r0: 0.2, r1: 0.5 },
      ],
    };
  },
  rig: () => deerRig(),
  sculpt: (m, rig, params) => sculptDeer(m, rig, params),
  regions: deerRegions,
  coat: deerCoat,
  eyeSpecs: () => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: EYE_LOOK })),
  motion,
  render: { markColor: srgb(0x1c1816), strandDensity: 1000, clumpDensity: 1, shellScale: 1, finWidth: 0.45 },
};
void COATS;

// Horizontal bar pupil, dark brown iris (looks black), sclera hidden, dark lids.
export const EYE_LOOK = {
  pupil: 'bar',
  lids: 'mammal',
  iris: { inner: srgb(0x160d08), mid: srgb(0x2a1a10), hi: srgb(0x40281a), outer: srgb(0x0e0805) },
  sclera: { color: [0.5, 0.45, 0.4], visible: false },
  lidColor: [0.02, 0.018, 0.016],
  pupilSize: [0.12, 0.38],
};
