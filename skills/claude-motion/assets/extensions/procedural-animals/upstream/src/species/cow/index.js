// Domestic cattle (Bos taurus). Cloven-hoofed (two claws and two dew claws per foot, on the horse's
// hoof-bone rig), a big barrel with prominent hooks and pins, dewlap, udder or bull's crest, a moist
// pebbled muzzle, horizontal-bar pupils behind long lashes, a switch tail; seeded breeds:
// Holstein-Friesian (default: black-and-white piebald patches grown per individual), Hereford (red,
// white face), Angus (black, polled), Jersey (fawn, dark face, dished), Highland (shaggy, long horns).
// Behaviours: the walk's head bob, grazing with the tongue, chewing the cud (standing and lying),
// lying down front knees first and rising hind end first, fly swishes, ear flicks, nose licks, the
// bull's pawing charge and the cow's sideways kick.
import { cowRig, HEAD_O } from './rig.js';
import { sculptCow, EYE } from './sculpt.js';
import { cowRegions } from './regions.js';
import { cowCoat } from './coat.js';
import { srgb } from '../../core/build/coatKit.js';
import { motion } from './motion.js';

const pick = (R, table) => {
  let x = R() * table.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of table) { x -= w; if (x <= 0) return k; }
  return table[table.length - 1][0];
};

// withers height (m) of adult cows / bulls per breed, frame and build
const BREED = {
  holstein: { name: 'Holstein-Friesian', h: [1.45, 1.63], dairy: 1, udder: [0.8, 1.15], dewlap: 0.35, tags: 0.7, legs: 1, girth: 1, length: 1 },
  hereford: { name: 'Hereford', h: [1.34, 1.5], dairy: 0, udder: [0.3, 0.45], dewlap: 0.85, tags: 0.5, legs: 0.9, girth: 1.08, length: 0.97 },
  angus: { name: 'Aberdeen Angus', h: [1.3, 1.45], dairy: 0, udder: [0.3, 0.45], dewlap: 0.45, tags: 0.5, legs: 0.89, girth: 1.08, length: 0.96 },
  jersey: { name: 'Jersey', h: [1.2, 1.4], dairy: 1, udder: [0.7, 0.95], dewlap: 0.35, tags: 0.7, legs: 1, girth: 0.94, length: 0.98 },
  highland: { name: 'Highland', h: [1.12, 1.25], dairy: 0.2, udder: [0.25, 0.35], dewlap: 0.3, tags: 0.25, legs: 0.84, girth: 1.06, length: 0.95 },
};
const VARIANT_KEYS = Object.keys(BREED);

export default {
  id: 'cow',
  name: 'Cattle',
  latin: 'Bos taurus',
  group: 'hooves',
  plan: 'quadruped',
  covering: 'fur',
  variants: VARIANT_KEYS.map((id) => ({ id, name: BREED[id].name, latin: 'Bos taurus' })),

  // Seeded individual. opts.variant picks the breed (default Holstein); sex: cow (udder) or bull
  // (crest, larger and thicker horns, sheath, sometimes a nose ring); age: adult or calf (juvenile:
  // long legs, short body, big head, no horns, soft coat); size, frame, coat pattern / shade, face
  // marking, horns (per breed: mostly disbudded Holsteins, polled Angus, forward-down Hereford horns,
  // wide Highland horns), ear tags.
  variation(R, o) {
    const variant = BREED[o.variant] ? o.variant : 'holstein';
    const B = BREED[variant];
    const sex = o.sex || (R() < 0.7 ? 'female' : 'male');
    const age = o.age || 'adult';
    const calf = age === 'juvenile';
    const male = sex === 'male';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    const bull = male ? (calf ? 0.25 : 0.85 + 0.15 * R()) : 0;
    const frame = g();
    const size = (B.h[male ? 1 : 0] / 1.45) * (1 + 0.035 * frame) * (calf ? 0.5 : 1);
    // coat colour within the breed
    let coat = variant;
    if (variant === 'holstein' && R() < 0.12) coat = 'redholstein';
    if (variant === 'angus' && R() < 0.15) coat = 'redangus';
    if (variant === 'highland') coat = pick(R, [['highland', 60], ['highlandblack', 20], ['highlanddun', 20]]);
    // horns
    let horns = null;
    const hr = R();
    if (!calf) {
      if (variant === 'holstein' && hr < (male ? 0.5 : 0.15)) horns = male ? { style: 'bull', len: 0.17 + 0.07 * R(), r: 0.042, a0: 12, a1: 60 } : { style: 'lyre', len: 0.24 + 0.08 * R(), r: 0.027, a0: 10, a1: 100 };
      if (variant === 'hereford' && hr < 0.5) horns = male ? { style: 'down', len: 0.2 + 0.05 * R(), r: 0.045, a0: 8, a1: 70 } : { style: 'down', len: 0.26 + 0.07 * R(), r: 0.03, a0: 6, a1: 85 };
      if (variant === 'jersey' && hr < (male ? 0.4 : 0.2)) horns = male ? { style: 'bull', len: 0.16 + 0.05 * R(), r: 0.036, a0: 12, a1: 65 } : { style: 'lyre', len: 0.2 + 0.06 * R(), r: 0.023, a0: 10, a1: 105 };
      if (variant === 'highland') horns = male ? { style: 'wide', len: 0.4 + 0.08 * R(), r: 0.055, a0: 4, a1: 55, curlPow: 1.6 } : { style: 'wide', len: 0.52 + 0.14 * R(), r: 0.04, a0: 4, a1: 85, curlPow: 1.5 };
    }
    const face = variant === 'holstein' ? pick(R, [['blaze', 45], ['star', 12], ['white', 15], ['strip', 15], ['none', 13]]) : 'none';
    return {
      variant, coat, sex, age, size,
      bull, dairy: B.dairy,
      udder: male || calf ? 0 : B.udder[0] + (B.udder[1] - B.udder[0]) * R(),
      dewlap: B.dewlap * (male ? 1.4 : 1) * (0.8 + 0.4 * R()),
      horns,
      polledPeak: variant === 'angus' ? 0.6 + 0.4 * R() : 0,
      dished: variant === 'jersey' ? 1 : 0,
      shaggy: variant === 'highland',
      earTags: R() < (calf ? 0.85 : B.tags),
      noseRing: male && !calf && variant !== 'highland' && R() < 0.5,
      face, faceWidth: 0.7 + 0.7 * R(),
      blackCover: 0.55 + 0.22 * g(),
      patchFreq: 2.1 + 0.7 * R(),
      spectacles: variant === 'hereford' && R() < 0.25,
      switchLen: 0.8 + 0.3 * R(),
      coatShade: g(), coatLightness: 0.06 * g(),
      coatSeed: Math.floor(R() * 1e6),
      minThick: 0.006,
      warps: [
        { type: 'legs', k: B.legs * (1 + 0.03 * g()) * (calf ? 1.42 : 1), top: 0.72 },
        { type: 'length', k: B.length * (1 + 0.025 * g()) * (calf ? 0.84 : 1), z0: -0.7, z1: 0.62 },
        { type: 'girth', k: B.girth * (1 + 0.04 * g()) * (male && !calf ? 1.04 : 1) * (calf ? 0.9 : 1), cy: 1.05, z0: -0.85, z1: 0.75 },
        { type: 'scaleAbout', c: HEAD_O, k: (1 + 0.03 * g()) * (calf ? 1.3 : 1) * (male && !calf ? 1.06 : 1) * (variant === 'jersey' ? 0.95 : 1), r0: 0.22, r1: 0.42 },
      ],
    };
  },
  rig: () => cowRig(),
  sculpt: (m, rig, params) => sculptCow(m, rig, params),
  regions: cowRegions,
  coat: cowCoat,
  eyeSpecs: () => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: EYE_LOOK })),
  motion,
  render: { markColor: srgb(0x1a1616), strandDensity: 820, clumpDensity: 1, shellScale: 1, finWidth: 0.45, flatMaterial: true },
};

// Horizontal bar pupil in a dark brown iris (lighter brown fibres round the pupil, a dark limbus: the
// bar reads against it), a rim of white sclera at the corners, dark grey-brown lids (a shade lighter
// than black hair, so the lid line separates the eye from a black face).
export const EYE_LOOK = {
  pupil: 'bar',
  lids: 'mammal',
  iris: { inner: srgb(0x2a180d), mid: srgb(0x4a2e1c), hi: srgb(0x7a5234), outer: srgb(0x160c06) },
  sclera: { color: [0.72, 0.68, 0.64], visible: true },
  lidColor: [0.055, 0.045, 0.04],
  pupilSize: [0.14, 0.42],
};
