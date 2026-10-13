// Horse (Equus caballus). The first hoofed animal: cannon / pastern / hoof anatomy with a separate
// hoof bone (fetlock sink under load, hoof flip in swing), long mane and tail hair, a rideable back
// with tack attachment points, the four natural gaits and the horse's signature behaviours.
import { horseRig, HEAD_O } from './rig.js';
import { sculptHorse, EYE } from './sculpt.js';
import { horseRegions } from './regions.js';
import { horseCoat, COATS } from './coat.js';
import { srgb } from '../../core/build/coatKit.js';
import { motion } from './motion.js';

const pick = (R, table) => {
  let x = R() * table.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of table) { x -= w; if (x <= 0) return k; }
  return table[table.length - 1][0];
};

export default {
  id: 'horse',
  name: 'Horse',
  latin: 'Equus caballus',
  group: 'hooves',
  plan: 'quadruped',
  covering: 'fur',

  // Seeded individual. Sex: mare, gelding or stallion (crest and sheath); age: adult or foal
  // (juvenile: long legs, short body, big head, bristly mane, short fluffy tail); size, proportions
  // (sport horse <-> lighter thoroughbred type <-> stockier type); coat colour and white markings.
  // o.variant may force a coat colour ('bay', 'chestnut', 'grey', ...).
  variation(R, o) {
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const foal = age === 'juvenile';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    const gelding = sex === 'male' && R() < 0.65;
    const type = g(); // - lighter / leggier, + stockier
    const size = (sex === 'male' ? 1.02 : 0.98) * (1 + 0.045 * g()) * (foal ? 0.5 : 1);
    const coat = COATS[o.variant] ? o.variant : pick(R, [['bay', 30], ['darkbay', 10], ['chestnut', 22], ['black', 8], ['grey', 12], ['palomino', 7], ['dun', 6], ['buckskin', 5]]);
    const face = pick(R, [['none', 35], ['star', 20], ['stripe', 10], ['blaze', 20], ['snip', 5], ['starsnip', 10]]);
    const sockH = () => pick(R, [[0, 60], [0.085, 8], [0.13, 10], [0.24, 14], [0.45, 8]]);
    const socks = [sockH(), sockH(), sockH(), sockH()];
    if (R() < 0.3) socks[2] = socks[3] = Math.max(socks[2], socks[3]);
    return {
      sex, age, size, gelding,
      crest: sex === 'male' ? (gelding ? 0.45 : 1) + 0.15 * g() : 0.15 + 0.1 * g(),
      coat, face, socks,
      flaxen: coat === 'chestnut' && R() < 0.3,
      greyLevel: coat === 'grey' ? (foal ? 0.05 : 0.15 + 0.75 * R()) : 0,
      maneLen: 0.14 + 0.12 * R(),
      maneSide: R() < 0.8 ? -1 : 1,
      coatShade: g(), coatLightness: 0.06 * g(),
      coatSeed: Math.floor(R() * 1e6),
      minThick: 0.006,
      warps: [
        { type: 'legs', k: (1 + 0.035 * g() - 0.025 * type) * (foal ? 1.55 : 1), top: 0.95 },
        { type: 'length', k: (1 + 0.03 * g() - 0.015 * type) * (foal ? 0.86 : 1), z0: -0.62, z1: 0.62 },
        { type: 'girth', k: (1 + 0.05 * type) * (sex === 'male' && !gelding ? 1.02 : 1), cy: 1.25, z0: -0.7, z1: 0.75 },
        { type: 'scaleAbout', c: HEAD_O, k: (1 + 0.03 * g()) * (foal ? 1.22 : 1), r0: 0.2, r1: 0.4 },
      ],
    };
  },
  rig: () => horseRig(),
  sculpt: (m, rig, params) => sculptHorse(m, rig, params),
  regions: horseRegions,
  coat: horseCoat,
  eyeSpecs: () => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: EYE_LOOK })),
  motion,
  render: { markColor: srgb(0x241f1d), strandDensity: 900, clumpDensity: 1, shellScale: 1, finWidth: 0.45 },
};

// Horizontal bar pupil with corpora nigra, dark brown iris, sclera hidden, dark lids.
export const EYE_LOOK = {
  pupil: 'bar',
  lids: 'mammal',
  // (dark brown, light enough that the iris and the bar pupil read under the catchlight: near-black
  // read as a black button, and as blue-grey glass under a sky reflection)
  iris: { inner: srgb(0x2a170c), mid: srgb(0x5c3a20), hi: srgb(0x8a5a2e), outer: srgb(0x1e1109) },
  sclera: { color: [0.55, 0.5, 0.45], visible: false },
  lidColor: [0.025, 0.02, 0.02],
  pupilSize: [0.12, 0.4],
};
