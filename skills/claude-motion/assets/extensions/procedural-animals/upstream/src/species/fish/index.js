// Fish (teleosts): rainbow trout, goldfish, ocellaris clownfish and bluegill as seeded / explicit
// variants (createAnimal('fish', { variant: 'trout' })). Swimmer body plan (core/motion/swimmer.js).
import { fishRig, fishGeo } from './rig.js';
import { sculptFish, CELL } from './sculpt.js';
import { fishRegions } from './regions.js';
import { fishCoat } from './coat.js';
import { motion } from './motion.js';
import { VARIANTS, VARIANT_KEYS } from './variants.js';
import { srgb } from '../../core/build/coatKit.js';
import { rng } from '../../core/math/vec.js';

const pick = (R, table) => {
  let x = R(), acc = 0;
  for (const [k, w] of table) { acc += w; if (x < acc) return k; }
  return table[table.length - 1][0];
};

export default {
  id: 'fish',
  name: 'Fish',
  latin: 'Teleostei',
  group: 'swimmers',
  plan: 'swimmer',
  covering: 'scales',
  variants: VARIANT_KEYS.map((id) => ({ id, name: VARIANTS[id].name, latin: VARIANTS[id].latin })),

  // Seeded individual. The variant (species) comes from opts.variant or from the seed; within a
  // variant: size, body depth, head size, colour morph, sex (bluegill breeding colours, clownfish
  // females larger), juveniles smaller with bigger heads and eyes.
  variation(R, o) {
    const variant = o.variant && VARIANTS[o.variant] ? o.variant : VARIANT_KEYS[Math.floor(R() * VARIANT_KEYS.length) % VARIANT_KEYS.length];
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const juv = age === 'juvenile';
    const g = () => (R() + R() + R() - 1.5) / 1.5;
    const G = fishGeo({ variant });
    let sexK = 1;
    if (variant === 'clownfish') sexK = sex === 'female' ? 1.1 : 0.86;
    if (variant === 'trout') sexK = sex === 'male' ? 1.04 : 0.97;
    const size = sexK * (1 + 0.1 * g()) * (juv ? 0.45 : 1);
    // colour morphs from their own hashed stream: consecutive seeds must not correlate
    const M = rng(Math.imul((o.seed ?? 1) + 0x632be5ab, 0x9e3779b1) ^ 0x5bd1e995);
    for (let i = 0; i < 4; i++) M();
    let morph = '';
    if (variant === 'trout') morph = pick(M, [['stream', 0.72], ['silver', 0.28]]);
    if (variant === 'goldfish') morph = pick(M, [['common', 0.55], ['red', 0.17], ['sarasa', 0.2], ['white', 0.08]]);
    if (variant === 'clownfish') morph = pick(M, [['orange', 0.9], ['black', 0.1]]);
    const shadeM = M();
    const SL = G.SL;
    const depthK = 1 + 0.05 * g() + (variant === 'trout' && sex === 'female' ? 0.02 : 0);
    return {
      variant, sex, age, size, morph,
      warps: [
        { type: 'girth', k: depthK, cy: G.axisY, z0: G.z(0.95), z1: G.z(0.15), fade: 0.12 * SL },
        { type: 'scaleAbout', c: G.headO, k: (1 + 0.035 * g()) * (juv ? 1.14 : 1), r0: 0.12 * SL, r1: 0.3 * SL },
      ],
      coatShade: 0.6 * g(),
      hueShift: variant === 'goldfish' && morph === 'common' ? shadeM : 0.5,
      coatSeed: Math.floor(R() * 1e6),
      bandK: variant === 'trout' ? (morph === 'silver' ? 0.3 : 0.8 + 0.25 * R()) * (sex === 'male' ? 1.15 : 0.9) : 1,
      barK: variant === 'bluegill' ? (sex === 'male' ? 0.8 : 1.1) * (0.8 + 0.4 * R()) : 1,
      edgeK: variant === 'clownfish' ? 0.8 + 0.5 * R() : 1,
      spotScale: 0.8 + 0.4 * R(),
      tailK: (variant === 'goldfish' && morph !== 'common' && R() < 0.5 ? 1.3 : 1) * (1 + 0.06 * g()),
      finK: 1 + 0.07 * g() + (juv ? 0.08 : 0),
      minThick: SL * CELL * (VARIANTS[variant].cellK || 1) * 1.15,
    };
  },
  rig: (params) => fishRig(params),
  sculpt: (m, rig, params) => sculptFish(m, rig, params),
  regions: fishRegions,
  coat: fishCoat,
  eyeSpecs(params) {
    const G = fishGeo(params);
    const E = G.eye, V = G.V;
    const spec = { c: [E.x, 0, 0], r: E.r, back: 0, yaw: 1.28, pitch: 0.1, lid: 0, R: E.r * 1.0, d: 0, off: 0, tilt: 0, irisZ: E.r * 0.42, irisR: E.r * 0.86 };
    const iris = V.eye.iris.map((h) => srgb(h));
    const look = {
      pupil: 'round', lids: 'none', pupilSize: [0.34, 0.42],
      iris: { inner: iris[0], mid: iris[1], hi: iris[2], outer: iris[3] },
      sclera: { color: [0.05, 0.05, 0.05], visible: false },
    };
    return [1, -1].map((side) => ({ side, spec, headOrigin: G.headO, bone: 'head', look }));
  },
  motion,
  // scale rim contrast per variant: the goldfish's big scales read as a fine lattice, not outlined cells
  render: (params) => ({ markColor: [0.008, 0.008, 0.009], scaleEdge: VARIANTS[params?.variant]?.scaleEdge ?? 0.15 }),
};
