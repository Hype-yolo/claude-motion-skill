// Domestic chicken (Gallus gallus domesticus): hen, rooster and chick; breeds as variants (brown/red
// layer, white Leghorn, black Australorp, barred Plymouth Rock, buff Orpington, speckled Sussex).
// Body plan 'bird' (core/motion/bird.js): a ground bird with burst flight only.
import { chickenRig, chickenJoints } from './rig.js';
import { sculptChicken, eyeFor } from './sculpt.js';
import { chickenRegions } from './regions.js';
import { chickenCoat, chickenFeatherColour, chickenWingCovertLook, chickenTertialLook, chickWingDownLook } from './coat.js';
import { motion, wingFor, feathersFor } from './motion.js';
import { featherCards } from '../../core/build/featherCards.js';
import { covertCards, joinSurfaces } from './coverts.js';
import { restyleWing, downyWing } from './wingLook.js';
import { srgb } from '../../core/build/coatKit.js';

const FEATHER_EDGE = { red: 0.55, leghorn: 0.35, australorp: 1, barred: 0.4, buff: 0.4, speckled: 0.6 };
const BREEDS = ['red', 'leghorn', 'australorp', 'barred', 'buff', 'speckled'];
// body mass (kg) hen / cock per breed (breed standards); lengths scale with mass^(1/3)
const MASS = { red: [2.0, 3.0], leghorn: [1.8, 2.5], australorp: [2.6, 3.6], barred: [2.8, 3.6], buff: [3.0, 3.8], speckled: [3.0, 3.8] };
// loose-feathered heavy breeds carry part of their bulk as fluff
const FLUFF = { red: 1, leghorn: 0.95, australorp: 1.06, barred: 1.05, buff: 1.14, speckled: 1.05 };

// individual form (read by rig, sculpt, regions, coat and motion.individual)
function formOf(sex, age, breed, g) {
  if (age === 'juvenile') {
    // chick (~1-2 weeks, ~0.3 of the hen's size): big head, short neck, short legs, stubby wings with
    // narrow pin feathers (wider ones swept through its round body opening and folding)
    return {
      chick: true, billK: 0.6, legK: 0.72, femurK: 0.7, tarK: 0.72, hipK: 0.74, neckK: 0.42, headK: 1.75, eyeK: 1.05, toeK: 0.85, toeR: 1.15,
      wingK: 0.52, priK: 0.25, recK: 0.08, fwK: 0.45, fluff: 1.1,
      headO: [0, 0.225, 0.085],
    };
  }
  const f = { fluff: FLUFF[breed] * (1 + 0.03 * g()), headK: 1.12 };
  if (sex === 'male') {
    Object.assign(f, {
      legK: 1.07, hipK: 1.06, neckK: 1.14, headK: 1.18, up: 13, tailUp: 30, spur: 0.8 + 0.4 * Math.abs(g()), sickles: (breed === 'leghorn' ? 1.08 : 1) * (1 + 0.06 * g()), recK: 1.25,
      comb: 1.45 * (breed === 'leghorn' ? 1.12 : 1), combH: 2.2 * (breed === 'leghorn' ? 1.15 : 1) * (1 + 0.08 * g()), wattle: 2.1 * (1 + 0.1 * g()), earlobe: 1.4,
    });
  } else {
    Object.assign(f, {
      comb: breed === 'leghorn' ? 1.3 : 1, combH: (breed === 'leghorn' ? 1.9 : 1) * (1 + 0.12 * g()), combFlop: breed === 'leghorn' ? 0.9 : 0,
      wattle: (breed === 'leghorn' ? 1.3 : 1) * (1 + 0.12 * g()), earlobe: breed === 'leghorn' ? 1.25 : 1, spur: 0,
      up: breed === 'leghorn' ? 5 : 0,
    });
  }
  return f;
}

export default {
  id: 'chicken',
  name: 'Chicken',
  latin: 'Gallus gallus domesticus',
  group: 'birds',
  plan: 'bird',
  covering: 'feathers',
  variants: BREEDS,

  // Seeded individual: breed (variant), sex (a flock is mostly hens), age (chick when asked, or now
  // and then), size by breed and sex (mass^(1/3)), leg length, head and comb size, fluff and colour tone.
  variation(R, o) {
    const g = () => (R() + R() + R() - 1.5) / 1.5;
    for (let i = 0; i < 5; i++) R(); // (decorrelates the first draws from the seed)
    const r0 = R(), r1 = R(), r2 = R();
    const breed = o.variant && BREEDS.includes(o.variant) ? o.variant : BREEDS[[0.3, 0.48, 0.63, 0.78, 0.9, 1].findIndex((x) => r0 < x)];
    const sex = o.sex || (r1 < 0.34 ? 'male' : 'female');
    const age = o.age || (r2 < 0.08 ? 'juvenile' : 'adult');
    const juv = age === 'juvenile';
    const m = MASS[breed][sex === 'male' ? 1 : 0] * (1 + 0.1 * g());
    const size = juv ? 0.3 * (1 + 0.06 * g()) : Math.cbrt(m / 2.0);
    const form = formOf(sex, age, breed, g);
    const J = chickenJoints(form), HO = J._headO;
    return {
      sex, age, size, breed, variant: breed, form,
      tone: 1 + 0.08 * g(),
      warps: juv ? [] : [
        { type: 'legs', k: 1 + 0.035 * g(), top: 0.09 },
        { type: 'scaleAbout', c: HO, k: 1 + 0.03 * g(), r0: 0.03, r1: 0.06 },
        { type: 'girth', k: 1 + 0.04 * g(), cy: 0.18, z0: -0.12, z1: 0.1, fade: 0.04 },
      ],
    };
  },
  rig: (params) => chickenRig(params.form),
  sculpt: (m, rig, params) => sculptChicken(m, rig, params),
  regions: chickenRegions,
  coat: chickenCoat,
  // flight-feather cards, and the folded wing's greater coverts along the covert shield's rim (coverts.js)
  surfaces: (ctx) => {
    const colour = chickenFeatherColour(ctx.params);
    const fc = featherCards({ ...ctx, wing: wingFor(ctx.params.form), feathers: feathersFor(ctx.params.form), tail: { bindFan: 0.2 }, colour });
    // (the folded wing's tertials read as contour feathers: shaded like the shield, with its down)
    if (!ctx.params.form?.chick) restyleWing(fc, ctx.rig, chickenTertialLook(ctx.params));
    // (a chick's wing is downy: its pin-feather cards wear the down around them)
    else downyWing(fc, ctx.rig, chickWingDownLook(ctx.params));
    return joinSurfaces(fc, covertCards(ctx, colour, chickenWingCovertLook(ctx.params)));
  },
  eyeSpecs: (params, rig) => [1, -1].map((side) => ({ side, spec: eyeFor(params.form), headOrigin: rig.headOrigin, bone: 'head', look: params.age === 'juvenile' ? EYE_JUV : EYE_LOOK })),
  motion,
  // pale plumage shows the shingle shading more than black: lower feather-edge contrast
  render: (p) => ({ markColor: srgb(0x2a1a12), strandDensity: 700, clumpDensity: 1.2, shellScale: 1, finWidth: 0.3, featherEdge: FEATHER_EDGE[p.breed] ?? 0.6 }),
};

// Round pupil, orange (reddish-bay) iris, bird lids with a nictitating membrane.
export const EYE_LOOK = {
  pupil: 'round',
  lids: 'bird',
  iris: { inner: srgb(0xe07a22), mid: srgb(0xeb9a30), hi: srgb(0xf6c050), outer: srgb(0xc8641c) },
  sclera: { visible: false, color: [0.02, 0.02, 0.02] },
  lidColor: srgb(0x8a3a34),
  pupilSize: [0.3, 0.44],
};
export const EYE_JUV = { ...EYE_LOOK, iris: { inner: srgb(0x201a16), mid: srgb(0x3a2e26), hi: srgb(0x5a4838), outer: srgb(0x181410) }, lidColor: srgb(0x5a4a3a), pupilSize: [0.5, 0.62] };
