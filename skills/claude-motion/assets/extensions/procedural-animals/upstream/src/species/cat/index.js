// Domestic cat (Felis catus). Digitigrade quadruped on the cheetah template: a small, stocky cat with
// a big round head, huge eyes with vertical slit pupils, tall ears and a long expressive tail.
// Coats are variants (createAnimal('cat', { variant: 'tuxedo' })) or come from the seed; longhair is a
// seeded option (or overrides: { longhair: true }); kittens with { age: 'juvenile' }.
import { catRig, HEAD_O, hl } from './rig.js';
import { sculptCat, eyeOf } from './sculpt.js';
import { catRegions } from './regions.js';
import { catCoat, catLidColor } from './coat.js';
import { motion } from './motion.js';
import { catWhiskers } from './whiskers.js';
import { srgb } from '../../core/build/coatKit.js';
import { rng } from '../../core/math/vec.js';

// [id, name, share of the seeded population]
const VARIANTS = [
  ['mackerel', 'Mackerel tabby', 0.22],
  ['classic', 'Classic tabby', 0.12],
  ['ginger', 'Ginger tabby', 0.14],
  ['black', 'Black', 0.14],
  ['tuxedo', 'Tuxedo', 0.14],
  ['calico', 'Calico / tortie', 0.11],
  ['grey', 'Grey (blue)', 0.13],
];
const pick = (x, table) => {
  let acc = 0;
  for (const [k, , w] of table) { acc += w; if (x < acc) return k; }
  return table[table.length - 1][0];
};

// iris colours (linear rgb: inner, mid, hi, outer), from reference photos
const IRIS = {
  // (cats' irises are bright and fairly even: a paler, often yellower ring round the pupil, a thin darker
  // limbal edge; the shader darkens the rim and the zone under the upper lid itself)
  green: [0xa6a64c, 0x93bb70, 0xc9e29e, 0x5d7c46],
  hazel: [0xbfa044, 0xbcb956, 0xe2dd8c, 0x72702e],
  // (the gold and copper highlights darker and more saturated: near-cream, they lost the iris's hue first)
  gold: [0xd29c32, 0xd4a236, 0xe8c050, 0x9c7222],
  copper: [0xc2722c, 0xc8742e, 0xe0904a, 0x924c1e],
  blue: [0x6c9cca, 0x7cb0e2, 0xbad6f2, 0x3c5c88],
  kitten: [0x6c8498, 0x8aa2b6, 0xb6c6d4, 0x46586c],
};
const IRIS_NEAR = { green: ['hazel', 'aqua'], hazel: ['gold', 'green'], gold: ['copper', 'hazel'], copper: ['deepCopper', 'gold'] };
IRIS.aqua = [0x94a468, 0x7fb09a, 0xb4dcc8, 0x4f7a64]; // a cool blue-green (face1)
IRIS.deepCopper = [0xb0601e, 0xb8621e, 0xd07a36, 0x7a3a14];
const EYE_BY_COAT = {
  mackerel: [['green', 0.45], ['hazel', 0.35], ['gold', 0.2]],
  classic: [['green', 0.4], ['hazel', 0.35], ['gold', 0.25]],
  ginger: [['gold', 0.55], ['copper', 0.3], ['hazel', 0.15]],
  black: [['gold', 0.45], ['copper', 0.3], ['green', 0.25]],
  tuxedo: [['gold', 0.4], ['green', 0.4], ['hazel', 0.2]],
  calico: [['gold', 0.45], ['green', 0.35], ['copper', 0.2]],
  grey: [['copper', 0.6], ['gold', 0.4]],
};

export default {
  id: 'cat',
  name: 'Domestic cat',
  latin: 'Felis catus',
  group: 'paws',
  plan: 'quadruped',
  covering: 'fur',
  variants: VARIANTS.map(([id, name]) => ({ id, name, latin: 'Felis catus' })),

  // Seeded individual: coat (variant), sex (ginger cats are ~80 % male, calicos female), size and
  // build (toms 10-25 % heavier with broad heads and jowls; the blue "British" type stockier), leg,
  // body, head, ear and tail proportions, stripe spacing, white spotting layout, eye colour, longhair
  // (~18 %). Kittens (8-10 weeks, age 'juvenile'): ~0.55 size, big head and ears, short legs and tail,
  // big paws, fluffy coat, blue-grey eyes.
  variation(R, o) {
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    let variant = o.variant && VARIANTS.some((v) => v[0] === o.variant) ? o.variant : null;
    // coat from its own hashed stream so consecutive seeds do not correlate
    const M = rng(Math.imul((o.seed ?? 1) + 0x2c1b3c6d, 0x297a2d39) ^ 0x1b873593);
    for (let i = 0; i < 3; i++) M();
    if (!variant) variant = pick(M(), VARIANTS); else M();
    const sexR = R();
    const sex = o.sex || (variant === 'calico' ? 'female' : variant === 'ginger' ? (sexR < 0.8 ? 'male' : 'female') : sexR < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const juv = age === 'juvenile' ? 1 : 0;
    const male = sex === 'male' ? 1 : 0;
    const stocky = variant === 'grey' ? 1 : 0;
    const longhair = M() < 0.18;
    // individual traits from their own hashed stream (the other streams stay as they were: every seed keeps its
    // coat, sex, eye colour and markings)
    const V = rng(Math.imul((o.seed ?? 1) + 0x5bd1e995, 0x27d4eb2d) ^ 0x165667b1);
    for (let i = 0; i < 3; i++) V();
    const vv = Array.from({ length: 10 }, () => V());
    const solid = variant === 'black' || variant === 'grey' || variant === 'tuxedo';
    // the blue: most are the cobby British type (front_sit1: a broad chest, a big round head with full cheeks, small
    // ears, thick short legs, a shorter thick tail), about one in five the slim foreign type (side3)
    const cob = stocky ? (vv[0] < 0.2 ? 0.1 : 0.6 + 0.4 * vv[1]) : 0;
    const size = (male ? 1.04 : 0.955) * (1 + 0.07 * g()) * (1 + 0.035 * cob) * (juv ? 0.56 : 1);
    const head = (male ? 1.04 : 0.985) * (1 + 0.025 * g()) * (juv ? 1.28 : 1) * (1 + 0.12 * cob);
    const earK = (1 + 0.09 * g()) * (juv ? 1.12 : 1) * (1 - 0.3 * cob);
    const eyeT = EYE_BY_COAT[variant];
    let eye = eyeT[0][0];
    { let x = M(), acc = 0; for (const [k, w] of eyeT) { acc += w; if (x < acc) { eye = k; break; } } }
    const wR = M();
    const params = {
      sex, age, size, variant, juv, longhair, cob,
      jowl: (male ? 1.1 : 0.97) * (1 + 0.1 * cob) * (juv ? 0.92 : 1),
      tail: (1 + 0.05 * g()) * (juv ? 0.78 : 1) * (1 - 0.1 * cob),
      eye: juv ? 'kitten' : eye,
      // (the iris hue shifts toward a neighbouring colour: two gold-eyed cats are not the same gold)
      eyeTone: 2 * vv[2] - 1,
      coatWarmth: 0.8 * g(),
      // (solid coats and gingers vary more in tone, +-15 %, evenly: the peaked +-12 % left most solid cats alike)
      // (a black coat only lighter: rusty in the sun; darker it read as a flat silhouette)
      coatLightness: ((l) => (variant === 'black' || variant === 'tuxedo' ? 0.2 * vv[3] - 0.04 : solid || variant === 'ginger' ? 0.15 * (2 * vv[3] - 1) : l))(0.12 * g()),
      coatSeed: Math.floor(R() * 1e6),
      stripeP: 1 + 0.1 * g(),
      stripeW: 1 + 0.15 * g(),
      // stripe contrast (some tabbies boldly barred, some faint), the ghost tabby of a solid coat (faint on most
      // adults, clearer on some and on kittens), the locket's size, the legs' thickness (the cobby blue)
      stripeC: 0.8 + 0.4 * vv[4],
      ghost: juv ? 1.3 : vv[5] < 0.3 ? 0.9 + 0.4 * vv[6] : 0.25 + 0.4 * vv[6],
      locketSize: 0.85 + 0.6 * vv[7],
      limb: 1 + 0.12 * cob,
      classic: variant === 'ginger' && M() < 0.35,
      // white spotting (tuxedo, calico); a calico without white is a tortoiseshell
      white: variant === 'tuxedo' ? 0.3 + 0.3 * wR : variant === 'calico' ? (wR < 0.3 ? 0 : 0.35 + 0.3 * M()) : 0,
      // sock tops off the joints (a pattern edge on a joint stretches): the front at mid-forearm
      // (5.5-8 cm, the carpus bends most), the hind below the hock or over the lower shin
      sockF: 0.055 + 0.025 * M(),
      sockH: 0.02 + 0.045 * M(),
      blaze: M() < 0.4 ? 0.3 + 0.7 * M() : 0,
      pinkNose: M() < 0.5,
      tailTip: M() < 0.2,
      locket: (variant === 'black' || variant === 'grey') && M() < 0.35, // a small white locket on the chest
      minThick: 0.0011,
      warps: [
        // (legs +-5 % per individual; no extra shortening of the average adult)
        // (the cobby blue's legs only a little shorter: its thickness makes it cobby; shorter still, the skin at the
        // armpits and the stifles stretched > 3x in more poses)
        { type: 'legs', k: 1 + 0.05 * g() - 0.1 * juv - 0.02 * cob, top: 0.13 },
        { type: 'length', k: 0.97 + 0.03 * g() - 0.06 * juv, z0: -0.15, z1: 0.08 },
        { type: 'girth', k: 1 + 0.06 * g() + 0.18 * cob + 0.02 * male - 0.03 * juv, cy: 0.16, z0: -0.19, z1: 0.12, fade: 0.04 }, // (lean to heavy)
        // (a kitten's big head fades out over the neck: a short fade squeezed the skin round the face into a
        // steep ring that the fluffy coat stood up on, a bonnet round a flat face)
        { type: 'scaleAbout', c: HEAD_O, k: head, r0: 0.035, r1: juv ? 0.11 : 0.075 },
        // ears (about the middle of each pinna)
        ...[1, -1].map((s) => ({ type: 'scaleAbout', c: hl([0.037 * s, 0.041, -0.016]), k: earK, r0: 0.012, r1: 0.03 })),
        // kittens: big paws
        ...(juv ? [[0.027, 0.053], [-0.027, 0.053], [0.03, -0.161], [-0.03, -0.161]].map(([x, z]) => ({ type: 'scaleAbout', c: [x, 0.01, z], k: 1.15, r0: 0.012, r1: 0.028 })) : []),
      ],
    };
    return params;
  },
  rig: (params) => catRig(params),
  sculpt: (m, rig, params) => sculptCat(m, rig, params),
  regions: catRegions,
  coat: catCoat,
  surfaces: catWhiskers,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: eyeOf(params), headOrigin: HEAD_O, bone: 'head', look: eyeLook(params) })),
  motion,
  render: (params = {}) => ({
    markColor: params.variant === 'ginger' ? [0.04, 0.016, 0.008] : params.variant === 'grey' ? [0.03, 0.028, 0.03] : [0.012, 0.009, 0.008],
    strandDensity: 1200,
    // (the cobby blue's plush coat in finer tufts, up to 2x: its 2 cm neck hair clumped like a longhair's ruff round a
    // velvet face; front_sit1's British blue is dense and fine all over)
    clumpDensity: params.longhair ? 0.8 : 1.1 * (1 + 1.0 * (params.cob || 0)),
    raiseLen: [0.006, 0.014],
    leatherTint: 1, // pink / brick / black nose leather and pads in their own colours (core/render/coatMaterial.js)
    leatherRelief: 0.25, // (a finer pebbling: the small nose read speckled in daylight, its sub-pixel bumps sparkling)
    finMask: true, // coat surf.y thins the silhouette fins: none on the head and jaw (coat.js)
  }),
};

// Vertical slit pupil (0.08 of the iris radius in bright sun, nearly round, ~0.85, in the dark or when
// aroused); iris fills the fissure, no sclera; the closing lids in the face's fur colour (the shader
// draws the dark lid margin, the "eyeliner", itself).
export function eyeLook(params = {}) {
  const base = (IRIS[params.eye] || IRIS.green).map((h) => srgb(h));
  // (the individual's shade: toward the neighbouring colour, + the warmer / deeper one, - the paler / cooler one)
  const near = IRIS_NEAR[params.eye];
  const t = params.eyeTone || 0;
  const c = near ? base.map((col, i) => { const o = srgb(IRIS[near[t > 0 ? 0 : 1]][i]); return col.map((x, k) => x + (o[k] - x) * 0.45 * Math.abs(t)); }) : base;
  return {
    pupil: 'slit',
    lids: 'mammal',
    iris: { inner: c[0], mid: c[1], hi: c[2], outer: c[3] },
    sclera: { color: [0.25, 0.2, 0.16], visible: false },
    lidColor: catLidColor(params),
    pupilSize: [0.08, 0.86],
    // big, proud eyes in a flat face: the lids shade the eyeball less than a deep-set eye's (the rim and
    // the upper lid's shadow at about half the default), and a thin limbal ring
    shade: { rim: 0.25, lid: 0.45 },
    limbus: 0.45,
    // the closed lid is furred: no smooth sheen (a black cat's lids mirrored the sky: glossy open eyes)
    lidSpec: 0.03,
    // lit like the fur round it (no sky reflection on a furred lid), less base sheen over the open eye (the sky's
    // glaze washed the copper iris out to beige outdoors), and lids that shut along a curved seam
    lidFur: 1,
    glaze: 0.25,
    ambient: 1,
    lidHair: 1,
    lidArc: true,
    irisLight: 1,
    fill: 0.6,
    lidFlat: 0.8,
    lidSeam: 0.0005,
    lidClump: 1,
    lidFill: 1,
    // an even iris with fine fibres (face1, face2): the stroma's radial bundles and dark crypts at full contrast read
    // as the ticks of a clock face
    irisTexture: 0.4,
    // a shut cat eye is one dark curved line low in the fissure: the upper lid does most of the closing (meeting at 0.7
    // of the half-height, a band of lower lid between the seam and the rim read as a double eyeliner)
    lidMeet: 0.97,
  };
}
