// Domestic goat (Capra hircus). Cloven-hoofed browser: the horse's hoof rig (pastern + hoof bone)
// with two claws per foot, scimitar horns (a rigid keratin surface on the skull), beard and wattles,
// horizontal bar pupils in pale amber irises, the short tail carried up, cud chewing, browsing on the
// hind legs and the rearing head clash.
import { goatRig, goatJoints, HEAD_O } from './rig.js';
import { add, sub, mul } from '../../core/math/vec.js';
import { sculptGoat, EYE } from './sculpt.js';
import { goatRegions } from './regions.js';
import { goatCoat } from './coat.js';
import { srgb } from '../../core/build/coatKit.js';
import { rng } from '../../core/math/vec.js';
import { motion } from './motion.js';
import { QUALITY } from '../../core/build/pipeline.js';

// a kid's short neck: the head and the upper neck move down the neck by 20 % of its length (12 % for lop ears: further,
// the hanging ear's tip ran into the throat), shortening the neck above its lowest 15 % (from the neck base the shift
// reached the scapulae, and the Nubian kid's sprint jittered at the wrist, p99 0.084 % S)
const J0 = goatJoints();
const NECK_BASE = add(J0.neckBase, mul(sub(J0.occiput, J0.neckBase), 0.15));
const kidNeck = (lop) => mul(sub(J0.occiput, J0.neckBase), lop ? -0.12 : -0.2);

const pick = (R, table) => {
  let x = R() * table.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of table) { x -= w; if (x <= 0) return k; }
  return table[table.length - 1][0];
};

// Breeds (variants) and their coats (coat.js COATS). salt: the breed's own seed stream, so a seed gives
// a different animal in every breed (with one stream, seed N was the same individual in five coats and
// seeds 1-2 were kids in every breed); picked so that seed 1 is a horned adult doe (the reference
// individual, the tools' default) and seeds 2-4 hold a horned buck, a kid and a doe
const BREEDS = {
  saanen: { salt: 158, coats: [['saanen', 1]], polled: 0.4, ear: 'erect', roman: 0, legs: 1, girth: 1, horn: 0xb4a07c },
  alpine: { salt: 746, coats: [['chamoisee', 40], ['coublanc', 25], ['toggenburg', 20], ['britishalpine', 15]], polled: 0.35, ear: 'erect', roman: 0, legs: 1.0, girth: 0.98, horn: 0x8a7050 },
  pied: { salt: 208, coats: [['pied', 60], ['piedbrown', 40]], polled: 0.3, ear: 'erect', roman: 0.15, legs: 0.98, girth: 1.02, horn: 0x9e8058 },
  nubian: { salt: 398, coats: [['nubianred', 40], ['nubiantan', 35], ['nubianblack', 25]], polled: 0.5, ear: 'lop', roman: 1, legs: 1.06, girth: 0.97, horn: 0x7a6248 },
  boer: { salt: 165, coats: [['boer', 1]], polled: 0.05, ear: 'lop', roman: 0.7, legs: 0.9, girth: 1.1, horn: 0x5e4c3a },
};

export default {
  id: 'goat',
  name: 'Goat',
  latin: 'Capra hircus',
  group: 'hooves',
  plan: 'quadruped',
  covering: 'fur',
  variants: Object.keys(BREEDS),

  // Seeded individual. Breed (o.variant: saanen, alpine, pied, nubian, boer) sets coat colours, ears,
  // Roman nose and build; sex: doe (udder) or buck (heavier, broader, a mane and "pants", big horns,
  // long beard); age: adult or kid (juvenile: long legs, short body, big head, horn buds, fluffy
  // coat). Horns (scimitar, larger in bucks) or polled; beard (bucks, many does); wattles (some).
  variation(R0, o) {
    // (a re-mixed stream: the early draws of neighbouring seeds were correlated, e.g. 16 of seeds 1-20
    // came out polled)
    const salt = BREEDS[o.variant] ? BREEDS[o.variant].salt : 0;
    const R = rng(Math.floor(R0() * 4294967296) ^ Math.imul(o.seed ?? 1, 0x9e3779b1) ^ 0x2545f491 ^ Math.imul(salt, 0x85ebca6b));
    const variant = BREEDS[o.variant] ? o.variant : pick(R, [['saanen', 30], ['alpine', 30], ['pied', 20], ['nubian', 15], ['boer', 5]]);
    const Bd = BREEDS[variant];
    const sex = o.sex || (R() < 0.45 ? 'male' : 'female');
    const age = o.age || (R() < 0.15 ? 'juvenile' : 'adult');
    const kid = age === 'juvenile';
    const buck = sex === 'male' && !kid;
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    const coat = pick(R, Bd.coats);
    const polled = R() < Bd.polled;
    let horns = null;
    if (!polled) {
      if (kid) horns = { len: 0.02 + 0.01 * R(), base: 0.008, curve: 0.2, spread: 0.12, upright: 0.3 };
      else if (buck) horns = { len: 0.3 + 0.18 * R(), base: 0.024 + 0.006 * R(), curve: 1.6 + 0.5 * R(), spread: 0.18 + 0.16 * R(), upright: 0.1 * R() };
      else horns = { len: 0.14 + 0.1 * R(), base: 0.0125 + 0.0035 * R(), curve: 0.9 + 0.45 * R(), spread: 0.08 + 0.1 * R(), upright: 0.2 * R() };
    }
    const beardP = variant === 'nubian' || variant === 'boer' ? 0.3 : 0.65;
    const beard = kid ? 0 : buck ? 0.12 + 0.1 * R() : R() < beardP ? 0.05 + 0.07 * R() : 0;
    const size = (buck ? 1.12 : 1) * (1 + 0.045 * g()) * (variant === 'nubian' ? 1.04 : 1) * (kid ? 0.58 : 1);
    return {
      sex, age, size, variant, coat,
      horns, beard,
      wattles: R() < 0.3,
      earLift: R(),
      ear: Bd.ear,
      // (a kid's face is straight: the Roman arch grows in with age, and on a kid's short face it swelled)
      roman: Bd.roman * (0.75 + 0.25 * R()) * (kid ? 0.35 : 1),
      udder: sex === 'female' && !kid ? 0.2 + 0.8 * R() : 0,
      heavy: buck ? 0.7 + 0.3 * R() : 0,
      mane: buck ? 0.4 + 0.6 * R() : 0,
      // (the long-haired landrace roll only: every buck had a 0.25 share of its skirt, which made every buck's barrel
      // a sheep's fleece; a dairy buck's body coat is as short and sleek as a doe's)
      shaggy: (variant === 'alpine' && R() < 0.25 ? 0.4 : 0),
      hornColor: Bd.horn,
      coatShade: g(), coatLightness: 0.05 * g(),
      coatSeed: Math.floor(R() * 1e6),
      // (the quality tier's mesh scale: the horns' cells, their least thickness and their sculpted growth ridges follow it)
      tierRes: (QUALITY[o.quality] || QUALITY.high).res,
      minThick: 0.005, // (thin parts at the coarse tiers: at 8 mm the erect ear's floor under its cup showed pinholes at medium)
      warps: [
        // a kid's neck is short (kid_side, front2: the head carried forward at about the height of the withers; with
        // the adult's neck its upright neck and high head read as a llama)
        ...(kid ? [{ type: 'shift', a: NECK_BASE, b: J0.occiput, d: kidNeck(Bd.ear === 'lop') }] : []),
        // (the head scale next: its centre is the head origin, where the shift has moved it)
        { type: 'scaleAbout', c: kid ? add(HEAD_O, kidNeck(Bd.ear === 'lop')) : HEAD_O, k: (1 + 0.035 * g()) * (kid ? 1.18 : 1) * (buck ? 1.06 : 1), r0: 0.1, r1: 0.2 },
        { type: 'legs', k: (1 + 0.035 * g()) * Bd.legs * (kid ? 1.18 : 1), top: 0.46 },
        { type: 'length', k: (1 + 0.035 * g()) * (kid ? 0.84 : 1), z0: -0.32, z1: 0.32 },
        { type: 'girth', k: (1 + 0.04 * g()) * Bd.girth * (buck ? 1.06 : 1) * (kid ? 0.92 : 1), cy: 0.56, z0: -0.4, z1: 0.38 },
      ],
    };
  },
  rig: (params) => goatRig(params),
  sculpt: (m, rig, params) => sculptGoat(m, rig, params),
  regions: goatRegions,
  coat: goatCoat,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: eyeLook(params) })),
  motion,
  // (marks are the lash lines: soft brown-grey on pink-skinned white coats, dark otherwise)
  // (clumpDensity is the density of the tufts, not the clumping strength: lower means bigger tufts. At 0.6
  // the 9-11 mm coat broke into 6-14 mm tufts that read as astrakhan curls, and a buck's back at 0.45 as a
  // pebbled rug; side2 / side3 / walk1 show a sleek coat of fine lengthwise hair. finWidth 0.4 gave the
  // outline a regular zipper hem at hero)
  // (a buck's sleek body takes the does' fine tufts, 1.5: his long mane clumps through its length anyway; 1.1 on every
  // buck read as a fleece)
  render: (params) => ({ markColor: srgb(pinkSkinned(params) ? 0x4a3934 : 0x241f1d), strandDensity: 1400, clumpDensity: longHair(params) ? 1.1 : params.sex === 'male' && params.age !== 'juvenile' ? 1.5 : 1.6, shellScale: 0.9, finWidth: 0.3, matBorders: true }),
};

// The goat's signature eye: a strongly elongated horizontal bar pupil in a pale golden / amber iris
//, sclera hidden, dark lids. Some lines have blue-grey irises.
// (mid / hi lightened ~15 %: under the cornea they rendered darker than their hex, a dark bead)
const IRISES = [
  { inner: 0xb88f30, mid: 0xdcb24a, hi: 0xf0d284, outer: 0x6a4a18 }, // golden
  { inner: 0xa87f3c, mid: 0xe8d28a, hi: 0xf6e8b0, outer: 0x7a6030 }, // pale yellow
  { inner: 0x74501e, mid: 0xb08238, hi: 0xd49e52, outer: 0x3e2810 }, // brown-amber
  { inner: 0x5e7280, mid: 0xa2bccb, hi: 0xc8dae2, outer: 0x3a4650 }, // blue
];
// shaggy (long-haired landrace) goats: long coarse hair lies in bigger locks (small tight tufts read as a lamb's wool)
const longHair = (params) => (params.shaggy || 0) > 0.3;
// white-coated goats (and the white areas of pied / Boer coats) have pink skin: nose, lips, lids
const pinkSkinned = (params) => ['saanen', 'pied', 'piedbrown'].includes(params.coat);
function eyeLook(params) {
  const s = ((params.coatSeed || 0) % 100) / 100;
  const ir = IRISES[s < 0.45 ? 0 : s < 0.75 ? 1 : s < 0.96 ? 2 : 3];
  return {
    pupil: 'bar',
    lids: 'mammal',
    iris: { inner: srgb(ir.inner), mid: srgb(ir.mid), hi: srgb(ir.hi), outer: srgb(ir.outer) },
    sclera: { color: [0.55, 0.5, 0.45], visible: false },
    // (pink-grey lids on white goats: side2, face3; dark on the others)
    lidColor: pinkSkinned(params) ? srgb(0x8a6a62) : [0.03, 0.025, 0.022],
    pupilSize: [0.09, 0.32],
  };
}
