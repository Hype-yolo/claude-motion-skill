// Domestic dog (Canis familiaris). Digitigrade trotter with three variants (opts.variant):
// 'shepherd' (the default: a medium shepherd / mixed type), 'retriever' (Labrador type) and 'terrier'
// (a small Jack Russell type). One canid rig; the variants differ in size, proportions, head, ears,
// tail, coat and colours.
import { dogRig, HEAD_O } from './rig.js';
import { sculptDog, eyeOf } from './sculpt.js';
import { dogRegions } from './regions.js';
import { dogCoat } from './coat.js';
import { motion } from './motion.js';
import { rng } from '../../core/math/vec.js';

export const VARIANTS = {
  shepherd: { name: 'Shepherd dog', latin: 'Canis familiaris (shepherd type)' },
  retriever: { name: 'Retriever', latin: 'Canis familiaris (Labrador type)' },
  terrier: { name: 'Terrier', latin: 'Canis familiaris (Jack Russell type)' },
};
const COLOURS = {
  shepherd: [['blackTan', 0.68], ['sable', 0.27], ['black', 0.05]],
  retriever: [['yellow', 0.45], ['black', 0.4], ['chocolate', 0.15]],
  terrier: [['tricolour', 0.45], ['tan', 0.4], ['white', 0.15]],
};
const pick = (R, table) => {
  let x = R(), acc = 0;
  for (const [k, w] of table) { acc += w; if (x < acc) return k; }
  return table[table.length - 1][0];
};

export default {
  id: 'dog',
  name: 'Dog',
  latin: 'Canis familiaris',
  group: 'paws',
  plan: 'quadruped',
  covering: 'fur',
  variants: Object.entries(VARIANTS).map(([id, v]) => ({ id, name: v.name, latin: v.latin })),

  // Seeded individual: variant (from opts.variant, default 'shepherd'), colour within the
  // variant, sex (males larger, broader head, heavier neck and ruff), puppies (age 'juvenile', 8-12
  // weeks: ~half size, big domed head, short muzzle, big paws, short legs, soft ears, fluffy coat),
  // and individual proportions: leg length, body length, head size, muzzle, ears, tail, colour tones,
  // saddle extent, mask, the terrier's patch layout and blaze.
  variation(R, o) {
    const variant = o.variant && VARIANTS[o.variant] ? o.variant : 'shepherd';
    R();
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || 'adult';
    const juv = age === 'juvenile' ? 1 : 0;
    const male = sex === 'male';
    const g = () => (R() + R() + R() - 1.5) / 1.5; // ~[-1, 1], peaked
    // colour from its own hashed stream (consecutive seeds must not correlate)
    const M = rng(Math.imul((o.seed ?? 1) + 0x2b7e1516, 0x9e3779b1) ^ 0x68e31da4);
    for (let i = 0; i < 3; i++) M();
    const colour = pick(M, COLOURS[variant]);
    const shep = variant === 'shepherd', ret = variant === 'retriever', ter = variant === 'terrier';
    // withers height relative to the 0.60 m reference: shepherd M 0.62 / F 0.575, Labrador M 0.57 /
    // F 0.55, Jack Russell 0.25-0.30; pups (10 weeks) about half
    const base = shep ? (male ? 1.035 : 0.96) : ret ? (male ? 0.95 : 0.915) : 0.46 * (male ? 1.02 : 0.98);
    const size = base * (1 + (ter ? 0.06 : 0.03) * g()) * (juv ? (ter ? 0.6 : 0.5) : 1);
    const legs = 1 + 0.03 * g() - 0.16 * juv + (ret ? -0.04 : ter ? 0.1 : 0);
    const head = (male ? 1.03 : 0.985) * (1 + 0.02 * g()) * (ret ? 1.15 : ter ? 1.12 : 1) * (juv ? 1.3 : 1);
    const earType = ret ? 'drop' : ter ? 'button' : juv ? 'button' : 'prick';
    const tailK = (1 + 0.05 * g()) * (juv ? 0.7 : 1) * (ter ? (M() < 0.35 ? 0.62 : 0.9 + 0.1 * g()) : 1);
    const warps = [
      { type: 'legs', k: legs, top: 0.36 },
      { type: 'length', k: 1 + 0.03 * g() - 0.05 * juv + (ret ? -0.09 : ter ? -0.03 : 0), z0: -0.26, z1: 0.3 },
      { type: 'scaleAbout', c: HEAD_O, k: head, r0: 0.075, r1: 0.19 },
    ];
    // a shorter, thicker-looking neck (the head sits closer over the forechest)
    if (ret || ter) warps.push({ type: 'length', k: ret ? 0.78 : 0.78, z0: 0.3, z1: 0.44 });
    if (ret) warps.push({ type: 'girth', k: (male ? 1.1 : 1.07) * (1 + 0.03 * g()), cy: 0.42, z0: -0.3, z1: 0.42, fade: 0.1 });
    if (ter) warps.push({ type: 'girth', k: 0.95 * (1 + 0.03 * g()), cy: 0.42, z0: -0.3, z1: 0.42, fade: 0.1 });
    if (shep) warps.push({ type: 'girth', k: (male ? 1.02 : 0.98) * (1 + 0.02 * g()), cy: 0.42, z0: -0.3, z1: 0.42, fade: 0.1 });
    // chubby pups
    if (juv) warps.push({ type: 'girth', k: 1.12, cy: 0.42, z0: -0.3, z1: 0.42, fade: 0.1 });
    // big pup paws
    if (juv) for (const [x, z] of [[0.046, 0.26], [-0.046, 0.26], [0.052, -0.28], [-0.052, -0.28]]) warps.push({ type: 'scaleAbout', c: [x, 0.025, z], k: 1.22, r0: 0.03, r1: 0.06 });
    return {
      sex, age, size, variant, colour, juv, headScale: head,
      earType, tailType: shep ? 'brush' : ret ? 'otter' : 'thin',
      muzzle: (1 + 0.04 * g()) * (ret ? 0.96 : ter ? 0.88 : 1.02) * (juv ? 0.72 : 1),
      headW: (male ? 1.04 : 0.99) * (1 + 0.02 * g()) * (ret ? 1.12 : ter ? 1.12 : 1.05) * (juv ? 1.05 : 1),
      stop: shep ? 0.35 + 0.1 * g() : ret ? 0.75 : 1.0,
      flews: ret ? 0.8 + 0.2 * g() : 0,
      muzzleDepth: ret ? 1.15 : ter ? 1.08 : 1,
      zyg: ret ? 0.7 : 1,
      dome: ret ? 0.6 : ter ? 0.2 : 0,
      ruff: shep ? (male ? 0.7 : 0.5) + 0.1 * g() : ret ? 0.12 : 0,
      neckK: (ret ? 1.22 : ter ? 1.04 : 1) * (male ? 1.03 : 0.98),
      chestK: ret ? 1.06 : 1,
      boneK: (ret ? 1.35 : ter ? 1.1 : 1) * (juv ? 1.1 : 1),
      pawK: (ret ? 1.1 : ter ? 0.92 : 1),
      tuck: shep ? 1 : ter ? 1.0 : 0.2,
      eyeK: (ter ? 1.3 : 1) * (juv ? 1.25 : 1),
      eyeRound: ret ? 0.6 : ter ? 0.5 : 0.1 * juv,
      ear: (1 + 0.05 * g()) * (juv ? 1.08 : 1) * (shep && !juv ? 0.95 : ter ? 1.35 : 1),
      tail: tailK,
      tailBrush: (1 + 0.06 * g()) * (juv ? 0.85 : 1) * (ret ? 1.2 : 1),
      furK: (shep ? 1 : ret ? 0.32 : 0.3) * (1 + 0.06 * g()),
      saddle: 1.1 * g(),
      mask: 1 + 0.15 * g(),
      coatWarmth: 0.9 * g(),
      coatLightness: 0.1 * g(),
      noseFade: ret && colour === 'yellow' ? M() : 0,
      patches: 0.7 + 0.6 * M(),
      blaze: 0.2 + 0.8 * M(),
      blazeEnd: -0.05 + 0.08 * M(),
      maskSide: 2 * M() - 1,
      coatSeed: Math.floor(R() * 1e6),
      minThick: 0.003,
      warps,
    };
  },
  rig: (params) => dogRig(params),
  sculpt: (m, rig, params) => sculptDog(m, rig, params),
  regions: dogRegions,
  coat: dogCoat,
  eyeSpecs: (params) => [1, -1].map((side) => ({ side, spec: eyeOf(params), headOrigin: HEAD_O, bone: 'head', look: eyeLook(params) })),
  motion,
  render: (params) => ({
    markColor: params.colour === 'chocolate' ? [0.06, 0.028, 0.02] : [0.012, 0.01, 0.009],
    strandDensity: params.variant === 'shepherd' ? 720 : 1200,
    clumpDensity: params.variant === 'shepherd' ? 0.8 : 0.3,
  }),
};

// Round pupil; brown iris (dark brown in shepherds and terriers, hazel / amber in chocolates), no
// visible sclera at rest; black lid margins (liver in chocolates); pups blue-grey.
const IRIS = {
  dark: { inner: [0.08, 0.035, 0.012], mid: [0.16, 0.075, 0.025], hi: [0.3, 0.16, 0.06], outer: [0.035, 0.016, 0.006] },
  brown: { inner: [0.12, 0.055, 0.018], mid: [0.24, 0.12, 0.04], hi: [0.42, 0.24, 0.08], outer: [0.05, 0.022, 0.008] },
  amber: { inner: [0.22, 0.11, 0.03], mid: [0.42, 0.24, 0.07], hi: [0.6, 0.38, 0.12], outer: [0.1, 0.05, 0.015] },
  pup: { inner: [0.1, 0.12, 0.15], mid: [0.2, 0.24, 0.3], hi: [0.34, 0.4, 0.48], outer: [0.06, 0.07, 0.09] },
};
function eyeLook(params) {
  const iris = params.juv ? IRIS.pup : params.colour === 'chocolate' ? IRIS.amber : params.variant === 'retriever' ? IRIS.brown : IRIS.dark;
  return {
    pupil: 'round',
    lids: 'mammal',
    iris,
    sclera: { color: [0.55, 0.45, 0.38], visible: false },
    lidColor: params.colour === 'chocolate' ? [0.08, 0.04, 0.03] : [0.02, 0.017, 0.015],
    pupilSize: [0.3, 0.6],
  };
}
