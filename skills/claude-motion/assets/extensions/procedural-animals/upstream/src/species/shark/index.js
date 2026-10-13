// Sharks: the great white (default) and the blacktip reef shark as variants
// (createAnimal('shark', { variant: 'blacktip' })). Swimmer body plan (core/motion/swimmer.js):
// thunniform / carangiform tail-driven swimming, stiff pectorals, heterocercal tail, obligate ram
// ventilation (it never stops), upper-jaw protrusion, eye roll (white) / nictitating membrane
// (blacktip) on the bite.
import { sharkRig, sharkGeo } from './rig.js';
import { sculptShark, CELL } from './sculpt.js';
import { sharkRegions } from './regions.js';
import { sharkCoat } from './coat.js';
import { motion } from './motion.js';
import { VARIANTS, VARIANT_KEYS } from './variants.js';
import { srgb } from '../../core/build/coatKit.js';

const pick = (R, table) => {
  let x = R(), acc = 0;
  for (const [k, w] of table) { acc += w; if (x < acc) return k; }
  return table[table.length - 1][0];
};

export default {
  id: 'shark',
  name: 'Shark',
  latin: 'Selachimorpha',
  group: 'swimmers',
  plan: 'swimmer',
  covering: 'scales',
  variants: VARIANT_KEYS,

  // Seeded individual. Variant from opts.variant (default: white shark). Within a variant: sex
  // (females larger in both species; males carry claspers), age (juveniles smaller with relatively
  // bigger heads and fins), girth, fin and tail proportions, dorsal tone, scars.
  variation(R, o) {
    const variant = o.variant && VARIANTS[o.variant] ? o.variant : 'white';
    const V = VARIANTS[variant];
    const sex = o.sex || (R() < 0.5 ? 'male' : 'female');
    const age = o.age || (R() < 0.15 ? 'juvenile' : 'adult');
    const juv = age === 'juvenile';
    const g = () => (R() + R() + R() - 1.5) / 1.5;
    const white = variant === 'white';
    // white: females 4.5-5 m, males 3.4-4 m; juveniles 1.5-2.5 m. Blacktip: 1-1.4 m, pups ~0.5 m
    let size = (sex === 'male' ? (white ? 0.84 : 0.92) : 1) * (1 + (white ? 0.09 : 0.08) * g());
    if (juv) size = white ? 0.36 + 0.14 * R() : 0.42 + 0.12 * R();
    const TL = V.TL;
    const G = sharkGeo({ variant });
    const headK = (1 + 0.03 * g()) * (juv ? 1.1 : 1);
    const tones = V.colour.tones;
    return {
      variant, sex, age, size,
      girthK: (1 + 0.05 * g()) * (juv ? 0.9 : 1) * (sex === 'female' && !juv ? 1.03 : 1),
      finK: (1 + 0.05 * g()) * (juv ? 1.08 : 1),
      pecK: 1 + 0.05 * g(),
      dorsalK: (1 + 0.07 * g()) * (juv ? 1.05 : 1),
      tailK: 1 + 0.04 * g(),
      lowLobeK: 1 + 0.06 * g(),
      warps: [
        { type: 'scaleAbout', c: G.headO, k: headK, r0: 0.1 * TL, r1: 0.26 * TL },
      ],
      tone: pickIdx(R, tones),
      coatShade: 0.9 * g(),
      bndShift: (white ? 0.1 : 0.06) * g(),
      coatSeed: Math.floor(R() * 1e6),
      scarK: (juv ? 0.2 : 1) * (sex === 'female' ? 1.3 : 0.9) * (0.4 + 0.9 * R()),
      minThick: TL * CELL * (V.cellK || 1) * 1.2,
      nicks: finNicks(R, white, juv),
    };
  },
  rig: (params) => sharkRig(params),
  sculpt: (m, rig, params) => sculptShark(m, rig, params),
  regions: sharkRegions,
  coat: sharkCoat,
  eyeSpecs(params) {
    const G = sharkGeo(params);
    const V = G.V, Ey = G.eye;
    const bird = V.eye.lids === 'bird';
    const spec = { c: [Ey.x, 0, 0], r: Ey.r, back: 0, yaw: 1.38, pitch: 0.05, lid: 0, R: Ey.r * (bird ? 1.1 : 1.0), d: bird ? Ey.r * 0.42 : 0, off: 0, tilt: 0, irisZ: Ey.r * (bird ? 0.42 : 0.3), irisR: Ey.r * (bird ? 0.84 : 0.95) };
    // (white shark: the black iris fills the whole aperture: no pale sclera ring at rest; it shows only
    // when the eye rolls back on the bite)
    const iris = V.eye.iris.map((h) => srgb(h));
    const look = {
      pupil: 'round', lids: V.eye.lids, blink: false, pupilSize: V.eye.pupil,
      iris: { inner: iris[0], mid: iris[1], hi: iris[2], outer: iris[3] },
      sclera: { color: srgb(V.eye.sclera), visible: true },
      lidColor: srgb(V.colour.back),
    };
    return [1, -1].map((side) => ({ side, spec, headOrigin: G.headO, bone: 'head', look }));
  },
  motion,
  // denticles: material 6 is drawn as shark skin (matte, a fine grain along the body, a soft broad
  // sheen across the denticle ridges, no clear coat)
  render: { markColor: [0.006, 0.006, 0.007], scaleEdge: 0.18, denticles: 1 },
};

// seeded nicks in the trailing edges of adults' fins (old bites, abrasion): 0-3 on the first dorsal,
// sometimes one on the upper caudal lobe; blacktips and juveniles have fewer
function finNicks(R, white, juv) {
  const n = juv ? (R() < 0.15 ? 1 : 0) : Math.floor(R() * (white ? 3.6 : 2.2));
  const out = [];
  for (let i = 0; i < n; i++) out.push({ fin: R() < 0.2 ? 'caudal' : 'dorsal1', t: 0.1 + 0.8 * R(), r: (white ? 0.0035 : 0.004) + 0.004 * R() });
  return out;
}

function pickIdx(R, tones) {
  return pick(R, tones.map((t, i) => [i, t[1]]));
}
