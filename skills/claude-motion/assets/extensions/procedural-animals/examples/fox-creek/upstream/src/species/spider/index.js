// Spider: wolf spider (Lycosidae, default) and tarantula (Theraphosidae, opts.variant = 'tarantula').
// Body plan 'spider' (core/motion/spider.js): 8 legs x 7 segments, pedipalps, chelicerae with
// fangs, eight simple eyes.
import { spiderRig } from './rig.js';
import { sculptSpider, EYES, eyeSpec } from './sculpt.js';
import { spiderRegions } from './regions.js';
import { spiderCoat } from './coat.js';
import { motion } from './motion.js';

// glossy black domes; the look.iris.outer colour tints the dome (dark amber-brown lens)
const EYE_LOOK = {
  pupil: 'round',
  lids: 'simple',
  // the dome colour comes from iris.outer: near black with a faint amber tapetum glint
  iris: { inner: [0.02, 0.02, 0.02], mid: [0.03, 0.03, 0.025], hi: [0.05, 0.05, 0.04], outer: [0.3, 0.17, 0.05] },
  sclera: { color: [0.02, 0.02, 0.02], visible: false },
  lidColor: [0.02, 0.018, 0.015],
  pupilSize: [0.4, 0.5],
};

export default {
  id: 'spider',
  name: 'Spider',
  latin: 'Lycosidae / Theraphosidae',
  group: 'others',
  plan: 'spider',
  covering: 'chitin',
  variants: [
    { id: 'wolf', name: 'Wolf spider', latin: 'Lycosidae' },
    { id: 'tarantula', name: 'Tarantula', latin: 'Theraphosidae' },
  ],

  // Seeded individual. Females are larger with a heavy abdomen (gravid ones more so); males are
  // smaller and leggier with swollen palpal bulbs; spiderlings are small and short-legged.
  variation(R, o) {
    const variant = o.variant === 'tarantula' ? 'tarantula' : 'wolf';
    const sex = o.sex || (R() < 0.6 ? 'female' : 'male');
    const age = o.age || 'adult';
    const juv = age === 'juvenile';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    const male = sex === 'male' && !juv;
    const size = (male ? (variant === 'wolf' ? 0.82 : 0.88) : 1) * (1 + 0.08 * g()) * (juv ? 0.42 : 1);
    const p = {
      variant, sex, age, size,
      quality: o.quality,
      legK: (male ? 1.1 : 1) * (1 + 0.04 * g()) * (juv ? 0.9 : 1),
      abdK: (male ? 0.78 : 1 + 0.08 * Math.abs(g()) + 0.05 * g()) * (juv ? 0.9 : 1),
      palpBulb: male ? 1 : 0,
      coatWarmth: 0.9 * g(),
      coatLightness: 0.18 * g() + (male && variant === 'wolf' ? -0.08 : 0),
      patternContrast: variant === 'wolf' ? 0.6 + 0.55 * R() : 1,
      coatGrey: variant === 'wolf' ? 0.75 * R() ** 1.5 : 0,
      coatSeed: Math.floor(R() * 1e6),
      warps: [],
    };
    if (variant === 'tarantula') {
      const m = R();
      p.morph = m < 0.6 ? 'redknee' : m < 0.8 ? 'rosy' : 'pinktoe';
      p.bald = R() < 0.3; // kicked off its urticating hairs
    }
    return p;
  },
  rig: (params) => spiderRig(params),
  sculpt: (m, rig, params) => sculptSpider(m, rig, params),
  regions: spiderRegions,
  coat: spiderCoat,
  eyeSpecs: (params, rig) => {
    const out = [];
    for (const e of EYES[params.variant === 'tarantula' ? 'tarantula' : 'wolf']) for (const side of [1, -1]) out.push({ side, spec: eyeSpec(e), headOrigin: rig.J.ceph, bone: 'head', look: EYE_LOOK });
    return out;
  },
  motion,
  // setae: fine but still resolvable strands (a few per millimetre), loosely tufted; the tarantula's
  // long hair is coarser and fuzzier
  render: (params) => (params?.variant === 'tarantula'
    ? { markColor: [0.012, 0.009, 0.007], strandDensity: 3000, clumpDensity: 3, shellScale: 1, finWidth: 0.6 }
    : { markColor: [0.012, 0.009, 0.007], strandDensity: 5000, clumpDensity: 5, shellScale: 1, finWidth: 0.45 }),
};
