// Lion (Panthera leo). A heavy, deep-chested digitigrade cat: massive head and forequarters, short
// legs relative to its bulk; the male's mane, the lioness, and woolly spotted cubs.
import { lionRig, HEAD_O } from './rig.js';
import { sculptLion, EYE } from './sculpt.js';
import { lionRegions, EYE_CENTRES } from './regions.js';
import { lionCoat } from './coat.js';
import { motion } from './motion.js';
import { lionWhiskers } from './whiskers.js';

export default {
  id: 'lion',
  name: 'Lion',
  latin: 'Panthera leo',
  group: 'paws',
  plan: 'quadruped',
  covering: 'fur',
  variants: ['tawny', 'white'],

  // Seeded individual. Males ~1.075 x the reference size (withers
  // ~1.15 m), a bigger, broader head and a mane whose extent grows with age (young / "maneless"
  // Tsavo-type males carry a short ruff) and whose colour runs from blond to black-fringed; lionesses
  // ~0.935 (withers ~1.0 m), no mane, a flatter head. Cubs (age 'juvenile', ~4-6 months): ~0.42 size,
  // big head, ears and paws, short legs, woolly greyer coat with faint rosettes, grey-amber eyes.
  // Individuals vary in leg length, body length, head size, coat warmth / lightness, nose freckling
  // (age), faint leg spots. Rare leucistic "white lion" (variant 'white', ~3 %).
  variation(R, o) {
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const juv = age === 'juvenile' ? 1 : 0;
    const male = sex === 'male' && !juv;
    const g = () => R() + R() - 1; // [-1, 1], triangular
    let variant = o.variant;
    if (!variant) variant = R() < 0.03 ? 'white' : 'tawny'; else R();
    const prime = R(); // 0 young adult .. 1 prime / old (mane extent and darkness, nose freckling)
    const maneless = R() < 0.08;
    const mane = male ? (maneless ? 0.12 : Math.min(1, 0.3 + 0.75 * prime * (0.8 + 0.2 * R()))) : 0;
    const maneDark = male ? Math.min(1, Math.max(0, 0.1 + 0.65 * prime + 0.3 * g())) : 0;
    const size = (male ? 1.075 : 0.935) * (1 + 0.06 * g()) * (juv ? 0.42 : 1);
    const legs = 1 + 0.045 * g() - 0.08 * juv;
    const head = (male ? 1.12 : 1.07) * (1 + 0.04 * g()) * (juv ? 1.28 : 1);
    return {
      sex, age, size, variant, juv,
      mane, maneDark,
      noseDark: juv ? 0 : Math.min(1, Math.max(0, 0.15 + 0.6 * prime + 0.15 * g())),
      legSpots: juv ? 1 : Math.max(0, 0.15 + 0.2 * g()),
      coatWarmth: 1.1 * g(),
      coatLightness: 0.25 * g(), // (+-0.16 read as a pride of clones)
      coatSeed: Math.floor(R() * 1e6),
      minThick: 0.005,
      warps: [
        // cubs (research 1, cub_lying1): a short muzzle (the face in front of the eyes 22 % shorter) and eyes 15 %
        // bigger, in reference space before the other warps (the adult's muzzle scaled down)
        ...(juv ? [{ type: 'length', k: 0.7, z0: 0.878, z1: 1.03 }, ...EYE_CENTRES.map((c) => ({ type: 'scaleAbout', c, k: 1.15, r0: 0.026, r1: 0.05 }))] : []),
        { type: 'legs', k: legs, top: 0.55 },
        { type: 'length', k: 1 + 0.07 * g() - 0.05 * juv, z0: -0.55, z1: 0.4 },
        { type: 'scaleAbout', c: HEAD_O, k: head, r0: 0.14, r1: 0.32 },
        // (cub paws: sculpt.js, longer and deeper; a warp about them also made them wider, and they lay in the ground)
      ],
      // (drawn after everything above, so a seed keeps its sex, mane, size and coat)
      earDark: 0.55 + 0.45 * R(), // ear backs from sooty brown to black
      belly: 0.6 + 0.8 * R(), // the loose belly fold (primordial pouch), small .. heavy
    };
  },
  rig: () => lionRig(),
  sculpt: (m, rig, params) => sculptLion(m, rig, params),
  regions: lionRegions,
  coat: lionCoat,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: params.juv ? CUB_EYE_SPEC : EYE, headOrigin: HEAD_O, bone: 'head', look: params.juv ? CUB_EYE : EYE_LOOK })),
  motion,
  surfaces: lionWhiskers, // the whiskers (strands on a bone per side)
  render: {
    markColor: [0.012, 0.009, 0.007],
    strandDensity: 560,
    // silhouette fins on the mane, the tufts and the fringes only (hair >= 24 mm): on the face, the cheeks and a cub's
    // soft head their dark roots drew a dark outline wherever the head turns side-on, a hood round a cub's face; the core option finMinLen (default 5.8 mm)
    finMinLen: 0.024,
    // the shells' strands cross-faded between two hashing planes near a switch of the plane (the core option
    // strandBlend, default off): the broad forehead tilted ~45 deg drew a rectangle where the plane switched
    // (0.35: at 0.12 the bridge, sloping ~45 deg and convex, still drew two or three horizontal bands of
    // stretched strands across it and one across the top of the forehead, stitches or creases from the front)
    strandBlend: 0.35,
    clumpDensity: 0.85,
    leatherTint: 1, // nose leather in its tint: pink-brown to mottled black by age (coat.js), pink in the white lion
  },
};

// Round pupil (constricts to a small circle), amber iris (#b8802f, darker limbal ring), no visible
// sclera, black lid margins.
export const EYE_LOOK = {
  pupil: 'round',
  lids: 'mammal',
  // (amber-gold: face_male1 amber, face_female1 paler gold; a saturated orange read as a cartoon eye, a
  // grey-gold hazel as a washed-out yellow in sunlight)
  iris: { inner: [0.3, 0.16, 0.035], mid: [0.5, 0.3, 0.075], hi: [0.7, 0.47, 0.15], outer: [0.13, 0.07, 0.018] },
  sclera: { color: [0.2, 0.15, 0.11], visible: false },
  lidColor: [0.015, 0.012, 0.01],
  pupilSize: [0.2, 0.55], // (about 0.25-0.3 of the iris in daylight, the photos; ~0.5 measured in the harness light)
};
// cubs (4-6 months): amber-brown, duller than an adult's (blue-grey until ~3 months, amber by the end of the first year;
// cub_lying1: amber-brown; a grey-blue iris read as a doll's eye)
// (a cub's iris fills more of its opening, cub_Alert_cub_*, cub_Krueger_lion_cub: the dark eyeball round a
// small iris read as dark bluish rings, eye make-up or bruises, in the showcase's sky light)
const CUB_EYE_SPEC = { ...EYE, irisR: EYE.irisR * 1.14 };
export const CUB_EYE = {
  ...EYE_LOOK,
  sclera: { color: [0.26, 0.17, 0.1], visible: false },
  // (the upper lid that covers the iris's top in a cub's bigger opening: tawny furred skin with the dark margin at its edge; black, it
  // reflected the sky as a dark blue band over the iris)
  lidColor: [0.18, 0.1, 0.045],
  iris: { inner: [0.22, 0.13, 0.05], mid: [0.38, 0.24, 0.09], hi: [0.52, 0.36, 0.16], outer: [0.1, 0.06, 0.025] },
};
