// Domestic pig (Sus scrofa domesticus). Cloven-hoofed (two main claws and two dew claws per foot,
// on the cow's hoof-bone rig), a long fat barrel on short legs, the wedge head with the flat rostral
// disc on its own bone, small deep-set eyes with round pupils and pale lashes, erect / semi / lop
// ears per breed, and the corkscrew tail. Bare skin (material 4, subsurface-lit) under sparse
// bristles. Seeded breeds (variants): Large White / Yorkshire (default), Landrace, Duroc, Hampshire,
// Berkshire, spotted (Gloucester Old Spot / Pietrain).
// Behaviours: rooting, sniffing with the disc, grunting, tail curling and wagging, flopping onto the
// side to lie, the waddling trot, bouncing piglets; attack: a shoulder shove and bite, the boar's
// upward tusk slash.
import { pigRig, HEAD_O } from './rig.js';
import { sculptPig, EYE } from './sculpt.js';
import { pigRegions } from './regions.js';
import { pigCoat } from './coat.js';
import { srgb } from '../../core/build/coatKit.js';
import { QUALITY } from '../../core/build/pipeline.js';
import { rng } from '../../core/math/vec.js';
import { motion } from './motion.js';

const pick = (R, table) => {
  let x = R() * table.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of table) { x -= w; if (x <= 0) return k; }
  return table[table.length - 1][0];
};

// Breeds: withers height of an adult sow (boars ~5-10 % taller), ears, face, build
// (a finisher of 0.72 m is the reference individual)
const BREED = {
  largewhite: { name: 'Large White / Yorkshire', h: [0.7, 0.9], ear: 'erect', dish: 0.35, snout: 1.0, length: 1.0, legs: 1.0, girth: 1.0, ham: 1.0, earSize: 1.0 },
  landrace: { name: 'Landrace', h: [0.68, 0.88], ear: 'lop', dish: 0.0, snout: 1.1, length: 1.08, legs: 0.98, girth: 0.97, ham: 0.95, earSize: 1.05 },
  duroc: { name: 'Duroc', h: [0.72, 0.92], ear: 'semi', dish: 0.25, snout: 1.0, length: 0.98, legs: 1.02, girth: 1.04, ham: 1.1, earSize: 0.95 },
  hampshire: { name: 'Hampshire', h: [0.7, 0.88], ear: 'erect', dish: 0.15, snout: 1.02, length: 0.98, legs: 1.0, girth: 1.02, ham: 1.08, earSize: 0.9 },
  berkshire: { name: 'Berkshire', h: [0.64, 0.82], ear: 'erect', dish: 0.9, snout: 0.86, length: 0.96, legs: 0.96, girth: 1.03, ham: 1.02, earSize: 0.9 },
  spotted: { name: 'Spotted (Gloucester Old Spot)', h: [0.7, 0.88], ear: 'lop', dish: 0.2, snout: 1.0, length: 1.0, legs: 0.98, girth: 1.05, ham: 1.0, earSize: 1.0 },
};
const VARIANT_KEYS = Object.keys(BREED);

export default {
  id: 'pig',
  name: 'Pig',
  latin: 'Sus scrofa domesticus',
  group: 'hooves',
  plan: 'quadruped',
  covering: 'skin',
  variants: VARIANT_KEYS.map((id) => ({ id, name: BREED[id].name, latin: 'Sus scrofa domesticus' })),

  // Seeded individual. opts.variant picks the breed (default Large White); sex: sow (teat row, a
  // sagging belly with age) or boar (heavier shoulders and neck shield, visible small tusks, sheath
  // and testes); age: adult (finisher to mature breeding stock) or juvenile (a piglet: big head and
  // ears, short snout and body, fine hair, bouncy); size, build, ears, face, tail curl side, coat
  // shade, mud, spots / belt / points.
  variation(R0, o) {
    const R = rng(Math.floor(R0() * 4294967296) ^ Math.imul(o.seed ?? 1, 0x9e3779b1) ^ 0x5bd1e995);
    const variant = BREED[o.variant] ? o.variant : 'largewhite';
    const B = BREED[variant];
    const sex = o.sex || (R() < 0.6 ? 'female' : 'male');
    const age = o.age || 'adult';
    const piglet = age === 'juvenile';
    const male = sex === 'male';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    // maturity: 0 finisher (6 months) .. 1 mature breeding sow / boar
    const mature = piglet ? 0 : Math.pow(R(), 1.4);
    const boar = male && !piglet ? 0.5 + 0.5 * mature : 0;
    const hRef = B.h[0] + (B.h[1] - B.h[0]) * mature;
    // (piglet: a weaner of 4-10 weeks, 0.30-0.45 m at the withers, built like side1 / threequarter3: a long, rounded
    // body with its underline tucked up, on thick straight legs, the head and ears still big; a newborn's
    // shape at a weaner's size, 1.42-1.49 withers heights long on thin stilts)
    const size = piglet ? (0.36 + 0.14 * R()) : (hRef / 0.74) * (male ? 1.06 : 1) * (1 + 0.03 * g()); // (0.74: the withers after the legs warp)
    const belly = male || piglet ? 0.1 : 0.2 + 0.45 * mature * (0.6 + 0.4 * R());
    // (a piglet's erect ears big and broad and held out to the sides, front1 / front2; its lop and semi-lop leaves
    // only a little bigger for its size. The head warp enlarges the ears too, at no cost in vertices: the mesh is
    // made in reference space, and 1.25 x 1.3 bigger leaves put a piglet over the vertex budgets)
    const erect = B.ear === 'erect';
    const earSize = B.earSize * (1 + 0.06 * g()) * (piglet ? (erect ? 1.12 : 1.02) : 1);
    return {
      variant, sex, age, size,
      boar, mature,
      belly,
      fat: 1 + 0.04 * g() + 0.03 * mature,
      ham: B.ham * (1 + 0.05 * g()) * (piglet ? 1.06 : 1),
      ear: B.ear, earSize, earWide: piglet && erect ? 1.18 : 1, earFwd: 0.5 * g(), earOut: 0.6 * g() + (piglet && erect ? 0.6 : 0),
      dish: B.dish * (0.8 + 0.4 * R()) + (piglet ? 0.1 : 0),
      snoutLen: B.snout * (1 + 0.04 * g()) * (piglet ? 0.85 : 1),
      tusks: male && !piglet ? 0.35 + 0.65 * mature * (0.7 + 0.3 * R()) : 0,
      teats: R() < 0.5 ? 7 : R() < 0.7 ? 6 : 8,
      tailSide: R() < 0.5 ? 1 : -1,
      docked: false,
      wrinkles: 0.3 + 0.5 * mature + (variant === 'berkshire' ? 0.2 : 0),
      bristle: (1 + 0.15 * g()) * (male ? 1.2 : 1),
      mud: R() < 0.35 ? 0.35 + 0.6 * R() : 0,
      // Hampshire belt edges: the front one across the head behind the eyes (head-local z), the back one
      // at mid-ribcage (bind z); coat.js says why
      belt: [-0.055 + 0.012 * g(), 0.02 + 0.04 * g()],
      blaze: 0.6 + 0.6 * R(), socks: 0.8 + 0.5 * R(),
      spotCount: 5 + Math.floor(R() * 7), spotSize: 0.8 + 0.5 * R(),
      coatShade: g(), coatLightness: 0.05 * g(),
      coatSeed: Math.floor(R() * 1e6),
      // thin parts (ears, the tail tip) at the coarse tiers: at least sqrt(3) cells thick (a slab
      // thinner than that slips between the samples: rows of pinholes in the ears at medium)
      minThick: 0.0027,
      // (the quality tier's cell scale: the ear leaf's tiles overlap by the rim radius the core inflates them to)
      tierRes: QUALITY[o.quality]?.res ?? 1,
      warps: [
        // (the head scale first: its centre is the unwarped head origin)
        // (piglet, with its tucked-up underline, sculpt.js: snout -> buttock 1.72-1.82 withers heights, belly 0.45-0.47
        // above the ground, head (disc -> ear base) 0.41-0.42, elbow 0.47, width 0.53: side1 1.73-1.76 / 0.47-0.49 /
        // 0.43 / 0.48, a weaner 1.8-1.9 long, research 2; an earlier piglet measured 1.42-1.49 long, 0.46 wide, elbow 0.50)
        { type: 'scaleAbout', c: HEAD_O, k: 1.13 * (1 + 0.03 * g()) * (piglet ? 1.24 : 1) * (male && !piglet ? 1.05 : 1), r0: 0.12, r1: 0.24 },
        { type: 'legs', k: 1.06 * B.legs * (1 + 0.045 * g()) * (piglet ? 1.19 : 1), top: 0.36 },
        { type: 'length', k: 0.95 * B.length * (1 + 0.045 * g()) * (piglet ? 1.16 : 1) * (1 + 0.03 * mature), z0: -0.42, z1: 0.3 },
        { type: 'girth', k: B.girth * (1 + 0.06 * g()) * (piglet ? 0.95 : 1) * (1 + 0.04 * mature), cy: 0.52, z0: -0.55, z1: 0.36 },
        ...(boar > 0 ? [{ type: 'girth', k: 1 + 0.07 * boar, cy: 0.55, z0: 0.12, z1: 0.5 }] : []),
      ],
    };
  },
  rig: (params) => pigRig(params),
  sculpt: (m, rig, params) => sculptPig(m, rig, params),
  regions: pigRegions,
  coat: pigCoat,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: EYE, headOrigin: HEAD_O, bone: 'head', look: eyeLook(params) })),
  motion,
  // (a piglet's hair is finer and denser than a finisher's bristles: side1, threequarter3, front2 show a pale
  // velvet over the skin, no single hairs. On the adult grid, 1.85 mm cells, a piglet's short hairs stacked
  // every shell into one crisp speck: 6.6-9.5 % bright specks on a lit cheek; on a finer grid each
  // hair is below a pixel from half a metre on and the shells draw their expected coverage, a haze)
  // (and the Duroc's longer red-gold hair sparser, face3: individual hairs, not a fine speckle)
  render: (params) => ({ ...RENDER, strandDensity: params && params.age === 'juvenile' ? PIGLET_STRANDS : params && params.variant === 'duroc' ? 3400 : RENDER.strandDensity }),
};
// (strands on a 12000 /m grid (piglets 13000): the shells draw a bristle 0.3 of its cell wide, and the hair
// shader lights it darker than the wrapped skin near the terminator, so the 6000 grid's 0.25 mm hairs drew a dark
// hatching over the face from half a metre; on the finer grid they fall below a pixel there and blend to a faint
// haze, single pale hairs showing only up close and in the silhouette fins. skinScatter less red: the wrap past the
// terminator tinted the pale skin brick; it is also the colour of the light through the ears, coat.js)
const RENDER = { markColor: srgb(0x3a2a28), strandDensity: 12000, skinScatter: [0.86, 0.58, 0.52, 0.42], skinTrans: [0, 1], clumpDensity: 1, shellScale: 1, finWidth: 0.35, raiseLen: [0.02, 0.04] };
const PIGLET_STRANDS = 13000;

// Round pupil (slightly horizontally oval), brown iris (light amber to deep chocolate; a few blue),
// sclera hidden, pink or dark lids.
// (the amber iris read olive-green in the showcase's daylight; the photos show warm mid to dark brown)
const IRISES = [
  { inner: 0x3a2214, mid: 0x6a4026, hi: 0x8c5a36, outer: 0x24140c }, // brown
  { inner: 0x4a2c16, mid: 0x7c4c2a, hi: 0x9c6a3e, outer: 0x2e1a0c }, // light brown
  { inner: 0x1e120a, mid: 0x321e12, hi: 0x4c2e1c, outer: 0x120a06 }, // dark chocolate
  { inner: 0x4a5a66, mid: 0x7a8c98, hi: 0x9aacb6, outer: 0x2e3840 }, // blue-grey
];
function eyeLook(params) {
  const s = ((params.coatSeed || 0) % 100) / 100;
  // (blue-grey only in the white breeds; a Duroc's blue-grey iris read milky in daylight)
  const pinkBreed = !params.variant || params.variant === 'largewhite' || params.variant === 'landrace' || params.variant === 'spotted';
  const ir = IRISES[s < 0.5 ? 0 : s < 0.75 ? 1 : s < 0.95 || !pinkBreed ? 2 : 3];
  const dark = params.variant === 'berkshire' || params.variant === 'hampshire';
  return {
    pupil: 'round',
    lids: 'mammal',
    iris: { inner: srgb(ir.inner), mid: srgb(ir.mid), hi: srgb(ir.hi), outer: srgb(ir.outer) },
    sclera: { color: [0.6, 0.55, 0.52], visible: false },
    // (the Duroc's lids its red skin, coat.js COATS.red body #8A5846 in linear: the pink of the white
    // breeds drew a pale lilac disc over the eye in a blink, in the shade under the ear)
    lidColor: dark ? [0.06, 0.05, 0.05] : params.variant === 'duroc' ? [0.25, 0.1, 0.065] : [0.42, 0.22, 0.2],
    pupilSize: [0.2, 0.42],
  };
}
