// Wild boar (Sus scrofa). Cloven-hoofed forager built on the horse / goat hoof rig: a wedge-shaped
// body with massive high shoulders sloping to narrow hips, a long wedge head ending in the snout
// disc, small eyes, erect hairy ears, a coarse grizzled coat with a dorsal mane that rises when the
// boar is alarmed, tusks (the lower canines curving up and out, whetted by the uppers), a thin
// tasselled tail, short slim legs. Rooting, sniffing, the trot as its travelling gait, charges that
// end in an upward tusk hook.
import { boarRig, HEAD_O } from './rig.js';
import { sculptBoar, EYE } from './sculpt.js';
import { boarRegions } from './regions.js';
import { boarCoat } from './coat.js';
import { srgb } from '../../core/build/coatKit.js';
import { rng } from '../../core/math/vec.js';
import { motion } from './motion.js';

const pick = (R, table) => {
  let x = R() * table.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of table) { x -= w; if (x <= 0) return k; }
  return table[table.length - 1][0];
};

export default {
  id: 'boar',
  name: 'Wild boar',
  latin: 'Sus scrofa',
  group: 'hooves',
  plan: 'quadruped',
  covering: 'fur',
  // age classes: adults (dark, black, grey-brown or pale grizzled), red-brown yearlings, striped piglets
  variants: ['adult', 'yearling', 'piglet'],

  // Seeded individual. Sex: male (larger, heavier forequarters and shoulder shield, long tusks) or
  // female (small tusks, teats); age class (o.variant, or o.age 'juvenile' -> yearling or piglet):
  // adult, yearling (0.55 m, uniform red-brown, short tusks), piglet (0.25 m, striped "humbug", big
  // head, short snout, no tusks). Size from the regional range (Mediterranean small .. Eastern
  // large), coat morph and tone, winter / summer coat length, mane.
  variation(R0, o) {
    const R = rng(Math.floor(R0() * 4294967296) ^ Math.imul(o.seed ?? 1, 0x9e3779b1) ^ 173);
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    let variant = ['adult', 'yearling', 'piglet'].includes(o.variant) ? o.variant : null;
    if (!variant) {
      if (o.age === 'juvenile') variant = R() < 0.5 ? 'piglet' : 'yearling';
      else if (o.age === 'adult') variant = 'adult';
      else variant = pick(R, [['adult', 72], ['yearling', 14], ['piglet', 14]]);
    }
    const age = variant === 'adult' ? 'adult' : 'juvenile';
    const piglet = variant === 'piglet', yearling = variant === 'yearling';
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const male = sex === 'male';
    const coat = piglet ? 'piglet' : yearling ? 'yearling' : pick(R, [['dark', 55], ['black', 15], ['brown', 15], ['pale', 15]]);
    // regional build: Central European default, sometimes a big Eastern boar or
    // a small Mediterranean one
    const region = variant === 'adult' ? pick(R, [['central', 80], ['eastern', 10], ['mediterranean', 10]]) : 'central';
    const regK = region === 'eastern' ? 1.18 : region === 'mediterranean' ? 0.86 : 1;
    const size = (piglet ? 0.34 : yearling ? 0.73 : male ? 1.06 : 0.94) * regK * (1 + 0.045 * g());
    let tusks = null;
    if (!piglet) {
      if (male && !yearling) tusks = { lower: 0.085 + 0.04 * R(), upper: 0.04 + 0.015 * R(), r: 0.0085 + 0.002 * R(), curve: 0.75 + 0.25 * R() };
      else if (male) tusks = { lower: 0.035 + 0.01 * R(), upper: 0.018, r: 0.006, curve: 0.5 };
      else tusks = { lower: yearling ? 0.02 : 0.03 + 0.012 * R(), upper: 0.012, r: 0.0055, curve: 0.45 };
    }
    const shield = male && !yearling && !piglet ? 0.55 + 0.45 * R() : 0;
    return {
      sex, age, size, variant, stage: variant, coat, region,
      tusks, shield,
      snout: piglet ? 0.72 : yearling ? 0.9 : 1 + 0.05 * g(),
      earSpread: R(),
      winter: R(),
      mane: piglet ? 0.4 : (male ? 1 : 0.8) * (0.85 + 0.3 * R()),
      coatShade: g(), coatLightness: 0.1 * g(),
      coatSeed: Math.floor(R() * 1e6),
      minThick: 0.004,
      warps: [
        // (the head scale first: its centre is the unwarped head origin)
        { type: 'scaleAbout', c: HEAD_O, k: 1.06 * (1 + 0.035 * g()) * (piglet ? 1.18 : yearling ? 1.06 : 1) * (male && !yearling ? 1.05 : 1), r0: 0.14, r1: 0.26 },
        { type: 'legs', k: (1 + 0.035 * g()) * (piglet ? 1.08 : 1), top: 0.3 },
        { type: 'length', k: (1 + 0.035 * g()) * (piglet ? 0.86 : 1), z0: -0.45, z1: 0.25 },
        { type: 'girth', k: (1 + 0.04 * g()) * (male && !yearling ? 1.05 : 1) * (piglet ? 0.94 : 1), cy: 0.46, z0: -0.5, z1: 0.35 },
      ],
    };
  },
  rig: (params) => boarRig(params),
  sculpt: (m, rig, params) => sculptBoar(m, rig, params),
  regions: boarRegions,
  coat: boarCoat,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: eyeLook(params) })),
  motion,
  // (the head's silhouette fins are masked off in coat.js: with strandDensity 360 its sparse bristle cards drew a
  // see-through fringe round the face, the skin's outline inside it; denser strands and a thicker undercoat
  // keep the coat closed, the clumps keep it coarse)
  render: { markColor: srgb(0x1a1716), strandDensity: 520, undercoat: 6, clumpDensity: 1.6, shellScale: 1, finWidth: 0.45, finMask: true, raiseLen: [0.06, 0.1] },
};

// Small dark eyes, round pupil in a dark brown iris (amber-brown in bright light: face1), sclera hidden,
// dark lids.
const IRISES = [
  { inner: 0x3b2618, mid: 0x4e331f, hi: 0x6a4524, outer: 0x1e130c },
  { inner: 0x4a2e18, mid: 0x6a4524, hi: 0x8a5e30, outer: 0x2a1a0e },
];
function eyeLook(params) {
  const s = ((params.coatSeed || 0) % 100) / 100;
  const ir = IRISES[s < 0.7 ? 0 : 1];
  return {
    pupil: 'round',
    lids: 'mammal',
    iris: { inner: srgb(ir.inner), mid: srgb(ir.mid), hi: srgb(ir.hi), outer: srgb(ir.outer) },
    sclera: { color: [0.5, 0.45, 0.4], visible: false },
    lidColor: [0.02, 0.018, 0.016],
    pupilSize: [0.25, 0.5],
  };
}
