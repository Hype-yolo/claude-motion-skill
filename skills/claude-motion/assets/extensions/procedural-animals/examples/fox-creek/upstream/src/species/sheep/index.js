// Domestic sheep (Ovis aries). Cloven-hoofed grazer in wool: the fleece is a sculpted volume broken
// into locks (sculpt.js) under short, tightly clumped, matte shells (the crimped staple tips), with a
// clean short-haired face and legs; horizontal bar pupils in amber irises; spiral horns in Merino
// rams; the flock animal's alarm, constant chewing while grazing, bleating, the ram's charge and the
// ewe's foot stamp (behaviour.js).
import { sheepRig, HEAD_O } from './rig.js';
import { sculptSheep, EYE } from './sculpt.js';
import { sheepRegions } from './regions.js';
import { sheepCoat } from './coat.js';
import { srgb } from '../../core/build/coatKit.js';
import { rng } from '../../core/math/vec.js';
import { motion } from './motion.js';

const pick = (R, table) => {
  let x = R() * table.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of table) { x -= w; if (x <= 0) return k; }
  return table[table.length - 1][0];
};

// Breeds / morphs (variants). fleece: [min, max] total fleece length (m, a year's growth);
// horned: share of rams with horns; docked: share of docked tails; ear: carriage (rig.js EAR_SET)
const BREEDS = {
  whiteface: { coats: [['white', 1]], fleece: [0.05, 0.12], horned: 0, docked: 0.6, ear: 'lateral', roman: [0, 0.2], topknot: 0.25, size: 1, legs: 1, girth: 1 },
  suffolk: { coats: [['suffolk', 1]], fleece: [0.04, 0.09], horned: 0, docked: 0.65, ear: 'droop', roman: [0.7, 1], topknot: 0, size: 1.08, legs: 1.03, girth: 1.03 },
  merino: { coats: [['merino', 1]], fleece: [0.06, 0.1], horned: 0.95, docked: 0.85, ear: 'small', roman: [0.2, 0.5], topknot: 1, size: 0.94, legs: 0.97, girth: 1 },
  black: { coats: [['black', 75], ['brown', 25]], fleece: [0.05, 0.12], horned: 0.3, docked: 0.4, ear: 'lateral', roman: [0, 0.3], topknot: 0.15, size: 0.98, legs: 1, girth: 1 },
  shorn: { coats: [['white', 60], ['texel', 40]], fleece: [0.004, 0.015], horned: 0, docked: 0.7, ear: 'lateral', roman: [0, 0.2], topknot: 0, size: 1, legs: 1, girth: 1 },
};

export default {
  id: 'sheep',
  name: 'Sheep',
  latin: 'Ovis aries',
  group: 'hooves',
  plan: 'quadruped',
  covering: 'fur',
  variants: [
    { id: 'whiteface', name: 'White-faced sheep', latin: 'Ovis aries' },
    { id: 'suffolk', name: 'Suffolk', latin: 'Ovis aries' },
    { id: 'merino', name: 'Merino', latin: 'Ovis aries' },
    { id: 'black', name: 'Black sheep', latin: 'Ovis aries' },
    { id: 'shorn', name: 'Shorn sheep', latin: 'Ovis aries' },
  ],

  // Seeded individual. Breed / morph (o.variant: whiteface (default type), suffolk, merino, black,
  // shorn) sets the colours, ears, Roman nose, horns and fleece; sex: ewe or ram (heavier, broader,
  // thick neck, curled horns in horned breeds); age: adult or lamb (juvenile: long legs, short body,
  // big head and ears, short tight curly fleece, long tail). The fleece length (params.fleece,
  // 0 = shorn .. 0.15 m) is seeded within the breed's range (overrides: { fleece }).
  variation(R0, o) {
    // (the pipeline's stream is correlated between neighbouring seeds: re-mix it through an integer hash)
    let h = (Math.floor(R0() * 4294967296) ^ Math.imul((o.seed ?? 1) + 0x632be5ab, 0x9e3779b1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h = (h ^ (h >>> 16)) >>> 0;
    const R = rng(h);
    for (let i = 0; i < 3; i++) R();
    const variant = BREEDS[o.variant] ? o.variant : pick(R, [['whiteface', 40], ['suffolk', 24], ['merino', 16], ['black', 10], ['shorn', 10]]);
    const Bd = BREEDS[variant];
    const sex = o.sex || (R() < 0.4 ? 'male' : 'female');
    const age = o.age || (R() < 0.18 ? 'juvenile' : 'adult');
    const lamb = age === 'juvenile';
    const ram = sex === 'male' && !lamb;
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    const coat = pick(R, Bd.coats);
    // fleece length: a year's growth for adults, 10-20 mm tight curls for lambs
    const u = 0.5 + 0.5 * g();
    let fleece = lamb ? 0.012 + 0.01 * R() : Bd.fleece[0] + (Bd.fleece[1] - Bd.fleece[0]) * u;
    if (o.overrides && o.overrides.fleece !== undefined) fleece = o.overrides.fleece;
    fleece = Math.max(0, Math.min(0.15, fleece));
    // the outer staple tips are shells; the rest of the fleece is sculpted volume
    const staple = Math.max(0.005, Math.min(0.018, 0.25 * fleece + 0.004)) * (lamb ? 1.1 : 1);
    const wool = fleece > 0.035 ? fleece - staple : 0; // (short fleeces: shells over the body skin only)
    let horns = null;
    if (ram && R() < Bd.horned) horns = { turns: (variant === 'merino' ? 1.0 : 0.75) + 0.35 * R(), base: 0.03 + 0.009 * R(), r0: 0.95 + 0.1 * R(), flare: 0.8 + 0.4 * R() };
    else if (lamb && sex === 'male' && R() < Bd.horned) horns = { turns: 0.12 + 0.06 * R(), base: 0.012, r0: 0.75, flare: 0.5 };
    const docked = !lamb ? R() < Bd.docked : R() < Bd.docked * 0.5;
    const tailLen = docked ? 0.06 + 0.04 * R() : 0.3 + 0.08 * R();
    const size = (ram ? 1.13 + 0.05 * R() : 1) * (1 + 0.045 * g()) * Bd.size * (lamb ? 0.62 : 1);
    return {
      sex, age, size, variant, coat,
      fleece, staple, wool,
      horns,
      tailLen,
      ear: Bd.ear,
      earLift: R(),
      roman: (Bd.roman[0] + (Bd.roman[1] - Bd.roman[0]) * R()) + (ram ? 0.2 : 0),
      topknot: R() < Bd.topknot ? 0.4 + 0.6 * R() : 0,
      folds: variant === 'merino' && !lamb ? (ram ? 0.7 : 0.4) + 0.3 * R() : 0,
      muscle: coat === 'texel' ? 0.6 + 0.4 * R() : 0.3 * R(),
      udder: sex === 'female' && !lamb ? 0.1 + 0.6 * R() : 0,
      heavy: ram ? 0.6 + 0.4 * R() : 0,
      hoofStripe: R(),
      hornColor: variant === 'black' ? 0x6a5846 : 0xb09a78,
      coatShade: g(), coatLightness: 0.05 * g(),
      coatSeed: Math.floor(R() * 1e6),
      minThick: 0.004,
      warps: [
        // (the head scale first: its centre is the unwarped head origin)
        { type: 'scaleAbout', c: HEAD_O, k: (1 + 0.035 * g()) * (lamb ? 1.22 : 1) * (ram ? 1.06 : 1), r0: 0.1, r1: 0.2 },
        { type: 'legs', k: (1 + 0.035 * g()) * Bd.legs * (lamb ? 1.24 : 1), top: 0.36 },
        { type: 'length', k: (1 + 0.035 * g()) * (lamb ? 0.84 : 1), z0: -0.4, z1: 0.3 },
        { type: 'girth', k: (1 + 0.04 * g()) * Bd.girth * (ram ? 1.05 : 1) * (lamb ? 0.9 : 1), cy: 0.47, z0: -0.5, z1: 0.36 },
      ],
    };
  },
  rig: (params) => sheepRig(params),
  sculpt: (m, rig, params) => sculptSheep(m, rig, params),
  regions: sheepRegions,
  coat: sheepCoat,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: eyeLook(params) })),
  motion,
  // wool: fine, dense strands in small tight clumps (crimped staple tips); matte
  render: (params) => ({
    markColor: srgb(['suffolk', 'black'].includes(params.variant) ? 0x141212 : 0x5c4a46),
    strandDensity: params.variant === 'merino' ? 1500 : 1150,
    clumpDensity: (params.fleece || 0) > 0.02 ? 1.9 : 1.3,
    shellScale: 1,
    finWidth: 0.35,
    // (the short face and leg hair forms small tufts too, each leaning its own way: the face reads as short
    // hair rather than a smooth rubber skin, and the highlight on a black face breaks up instead of running
    // in glossy streaks; the default [0.0055, 0.016] left 4-6 mm hair untufted)
    clumpLen: [0.0015, 0.009],
    // (no silhouette fins: over a sculpted fleece they drew the lock bumps' contours as dark seams across
    // the back and the rump, and on short coats (shorn, lambs) they traced the head / body mesh hand-over
    // down the neck as a dotted line; the shells alone give the short coat's soft edge)
    fins: false,
    // (core render hint: the wool's shells slide down the staple as they rise; where the neck creases (the
    // throat when grazing, the side of the neck toward which the head turns) they dove under the skin of the
    // fold and it showed as a jagged bald line. Taken ~5 mm nearer the camera they stay on top; face and leg
    // hair shorter than 8 mm is untouched)
    shellDepthBias: [0.6, 0.008],
  }),
};

// The sheep's eye: a horizontal bar pupil (rectangular, 2.5-3 : 1 when constricted) in a golden to
// amber-brown iris, sclera hardly visible, dark lids; lambs paler.
const IRISES = [
  { inner: 0x9c7a34, mid: 0xb8913f, hi: 0xd4b066, outer: 0x5e4418 }, // amber (default)
  { inner: 0x6e5020, mid: 0x8a6a30, hi: 0xa8864a, outer: 0x3e2a10 }, // darker amber-brown
  { inner: 0xa88a48, mid: 0xc8a85a, hi: 0xe0c888, outer: 0x6a5020 }, // pale golden
];
function eyeLook(params) {
  const s = ((params.coatSeed || 0) % 100) / 100;
  const ir = IRISES[params.age === 'juvenile' ? 2 : s < 0.6 ? 0 : s < 0.9 ? 1 : 2];
  return {
    pupil: 'bar',
    lids: 'mammal',
    iris: { inner: srgb(ir.inner), mid: srgb(ir.mid), hi: srgb(ir.hi), outer: srgb(ir.outer) },
    sclera: { color: [0.45, 0.38, 0.32], visible: false },
    lidColor: [0.03, 0.025, 0.022],
    pupilSize: [0.1, 0.34],
  };
}
