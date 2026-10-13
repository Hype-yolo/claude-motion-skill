// Spider skeleton in bind pose (metres; dimensions below are written in millimetres).
// Forward = +Z, up = +Y, the animal's left = +X. Two variants share the rig: the wolf spider
// (Lycosidae, reference female Hogna carolinensis, body 25 mm) and the tarantula (Theraphosidae,
// reference female Brachypelma hamorii, body 60 mm).
import { buildRig } from '../../core/rig/rig.js';
import { spiderBones, spiderLimbs, planarChain, solveBindElevations, legJoints, palpJoints, AXIAL_POINTS, AXIAL_BONES } from '../../core/rig/spider.js';

const D2R = Math.PI / 180;
const mm = (v) => v.map((x) => x * 0.001);

// Per-variant anatomy (mm, degrees). leg: [I, II, III, IV] total lengths; seg: segment fractions
// coxa, trochanter, femur, patella, tibia, metatarsus, tarsus; el: bind elevations of the segments
// (the metatarsus is solved so the claw rests on the ground); r: segment radii (base, end).
export const VARIANTS = {
  wolf: {
    unit: 0.013,
    bodyLen: 25,
    axial: { front: [0, 7.4, 6.5], ceph: [0, 7.6, 1.6], pedA: [0, 6.3, -4.5], pedB: [0, 6.1, -5.7], abdEnd: [0, 5.4, -17.2], spinTip: [0, 4.7, -18.5] },
    carapace: { len: 11, wid: 8.6, top: 9.9, rearTop: 7.3, bottom: 4.5, headW: 5.2 },
    abdomen: { c: [0, 6.5, -11.4], r: [3.9, 3.35, 6.1] },
    chel: { base: [0.95, 7.0, 6.1], tip: [0.9, 3.8, 7.0], fang: [0.15, 4.25, 6.75], r: [0.95, 0.72], fangR: 0.2 },
    coxa: { y: 5.1, x: [2.35, 2.75, 2.75, 2.45], z: [3.3, 1.4, -0.6, -2.6], az: [30, 66, 112, 150] },
    leg: [35, 33, 31, 43],
    seg: [0.08, 0.05, 0.26, 0.12, 0.2, 0.19, 0.1],
    el: [-14, 4, 30, -6, -28, 0, -14],
    legR: [[1.05, 0.95], [0.84, 0.8], [0.8, 0.68], [0.7, 0.63], [0.63, 0.53], [0.5, 0.4], [0.39, 0.29]],
    hindR: 1.06,
    tipY: 0.32,
    palp: { base: [1.75, 5.2, 5.4], az: 14, len: 16, seg: [0.12, 0.08, 0.3, 0.15, 0.18, 0.17], el: [-30, -10, 15, -30, 0, -50], r: [[0.62, 0.55], [0.5, 0.48], [0.46, 0.42], [0.42, 0.4], [0.4, 0.37], [0.37, 0.28]], tipY: 0.55 },
    spinR: 0.45,
  },
  tarantula: {
    unit: 0.028,
    bodyLen: 60,
    axial: { front: [0, 13.2, 12.8], ceph: [0, 14.2, 3.5], pedA: [0, 12.0, -11.6], pedB: [0, 11.8, -13.6], abdEnd: [0, 10.8, -41.5], spinTip: [0, 9.2, -46] },
    carapace: { len: 25, wid: 23.5, top: 16.2, rearTop: 14.0, bottom: 7.4, headW: 13 },
    abdomen: { c: [0, 12.4, -27.6], r: [12.0, 9.6, 14.4] },
    chel: { base: [3.0, 12.6, 11.2], tip: [2.9, 9.4, 18.0], fang: [2.6, 4.9, 16.4], r: [3.1, 2.4], fangR: 0.75 },
    coxa: { y: 8.6, x: [5.8, 6.7, 6.7, 6.0], z: [6.2, 2.0, -2.6, -7.0], az: [26, 60, 114, 150] },
    leg: [65, 60, 55, 72.5],
    seg: [0.09, 0.06, 0.25, 0.14, 0.2, 0.16, 0.1],
    el: [-10, 6, 34, -4, -30, 0, -13],
    legR: [[3.0, 2.7], [2.4, 2.3], [2.3, 2.0], [2.05, 1.95], [1.95, 1.75], [1.65, 1.45], [1.45, 1.25]],
    hindR: 1.04,
    tipY: 1.3,
    palp: { base: [4.6, 8.4, 10.8], az: 16, len: 37, seg: [0.14, 0.08, 0.28, 0.16, 0.18, 0.16], el: [-30, -10, 15, -30, 0, -40], r: [[2.2, 2.0], [1.9, 1.8], [1.8, 1.65], [1.65, 1.55], [1.55, 1.45], [1.45, 1.2]], tipY: 1.3 },
    spinR: 1.3,
  },
};

// Anatomy of one individual: the variant's reference numbers with the seeded proportions of
// params (legK: leg length factor, abdK: abdomen size, palpBulb: male palpal bulbs).
export function spiderDims(params = {}) {
  const V = VARIANTS[params.variant] || VARIANTS.wolf;
  const legK = params.legK || 1, abdK = params.abdK || 1;
  const d = JSON.parse(JSON.stringify(V));
  d.variant = VARIANTS[params.variant] ? params.variant : 'wolf';
  d.leg = V.leg.map((l) => l * legK);
  d.palp.len = V.palp.len * (0.5 + 0.5 * legK);
  d.abdomen.r = V.abdomen.r.map((r) => r * abdK);
  // a bigger abdomen hangs further back from the pedicel
  d.abdomen.c = [0, V.abdomen.c[1] + (abdK - 1) * 0.4 * V.abdomen.r[1], V.abdomen.c[2] - (abdK - 1) * V.abdomen.r[2]];
  d.axial.abdEnd = [0, V.axial.abdEnd[1] - (abdK - 1) * 0.3 * V.abdomen.r[1], V.axial.abdEnd[2] - 2 * (abdK - 1) * V.abdomen.r[2]];
  d.axial.spinTip = [0, V.axial.spinTip[1] - (abdK - 1) * 0.3 * V.abdomen.r[1], V.axial.spinTip[2] - 2 * (abdK - 1) * V.abdomen.r[2]];
  d.palpBulb = params.palpBulb || 0;
  return d;
}

export function spiderJoints(params = {}) {
  const d = spiderDims(params);
  const J = {};
  for (const [k, v] of Object.entries(d.axial)) J[k] = mm(v);
  J.cheBaseL = mm(d.chel.base);
  J.cheTipL = mm(d.chel.tip);
  J.fangTipL = mm(d.chel.fang);
  for (let i = 1; i <= 4; i++) {
    const L = d.leg[i - 1];
    const lens = d.seg.map((f) => f * L * 0.001);
    const base = mm([d.coxa.x[i - 1], d.coxa.y, d.coxa.z[i - 1]]);
    const el = solveBindElevations(base[1], lens, d.el.map((e) => e * D2R), 5, d.tipY * 0.001);
    planarChain(J, legJoints(i, 'L'), base, d.coxa.az[i - 1] * D2R, el, lens, 1);
  }
  {
    const P = d.palp;
    const lens = P.seg.map((f) => f * P.len * 0.001);
    const base = mm(P.base);
    // the tibia takes up the height so the tarsus meets the ground slanting forward
    const el = solveBindElevations(base[1], lens, P.el.map((e) => e * D2R), 4, P.tipY * 0.001);
    planarChain(J, palpJoints('L'), base, P.az * D2R, el, lens, 1);
  }
  return J;
}

export function spiderRig(params = {}) {
  const d = spiderDims(params);
  const J = spiderJoints(params);
  const U = d.unit;
  return buildRig({
    joints: J,
    unit: U,
    headOrigin: J.ceph,
    meta: { dims: d },
    bones: spiderBones(),
    axial: {
      points: AXIAL_POINTS,
      bones: AXIAL_BONES,
      // the carapace is rigid: head and prosoma share it (the engine never bends them apart); the
      // pedicel is a short stalk, blended narrowly into the abdomen
      blend: { 1: [-0.1, 0.1], 2: [-0.012, 0.004], 3: [-0.004, 0.02] },
    },
    limbs: spiderLimbs({
      leg: { tCore: 0.5, aCore: 0.05, aBody: -0.05, midX: 0.06 },
      palp: { tCore: 0.45, aCore: 0.04, aBody: -0.05, midX: 0.04 },
    }),
    appendages: [],
    webTags: [],
  });
}
