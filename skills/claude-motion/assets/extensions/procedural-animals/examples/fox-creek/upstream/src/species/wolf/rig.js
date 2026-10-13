// Grey wolf skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
//
// Reference individual: an average adult (between the sexes), withers height ~0.75 m, nose to tail
// base ~1.08 m (straight line), tail vertebrae ~0.40 m (+ ~0.08 m of brush beyond the tip).
// Limb segments from wolf long-bone series: scapula 0.19, humerus 0.215,
// radius 0.22, metacarpus 0.09, femur 0.23, tibia 0.245, metatarsus 0.10 m. Standing angles from
// side photos: scapula ~57 deg to horizontal, shoulder ~110 deg, elbow under the withers, metacarpus
// ~80 deg to the ground; hip ~100, stifle ~120, hock ~135 deg with a near-vertical metatarsus.
// The head is modelled level in its own frame (HEAD_O); its carriage comes from the motion data.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 8;
export const HEAD_O = [0, 0.752, 0.6]; // head-local origin (mid cranium, between eyes and ears)
export const HS = 1.11; // head-local scale (landmarks below are for a 0.25 m skull; with skin and coat ~0.27 m)
export const SH = 0.75; // reference withers height
export const MUZZLE_Z0 = 0.035; // head-local z where the muzzle starts (muzzle length variation acts ahead of it)

// head-local -> reference space, with a per-individual muzzle length factor (pups, individuals)
export const hlOf = (m = 1, w = 1) => (v) => [HEAD_O[0] + v[0] * w * HS, HEAD_O[1] + v[1] * HS, HEAD_O[2] + HS * (v[2] > MUZZLE_Z0 ? MUZZLE_Z0 + (v[2] - MUZZLE_Z0) * m : v[2])];

export function wolfJoints(params = {}) {
  const hl = hlOf(params.muzzle || 1);
  const earK = params.ear || 1;
  const J = {
    nose: hl([0, -0.012, 0.155]),
    occiput: hl([0, 0.02, -0.095]),
    neckMid: [0, 0.685, 0.45],
    neckBase: [0, 0.615, 0.4],
    chestMid: [0, 0.635, 0.21],
    thoraxRear: [0, 0.645, 0.03],
    lumbarMid: [0, 0.655, -0.1],
    lumbosacral: [0, 0.65, -0.21],
    tailBase: [0, 0.635, -0.31],
    scapTopL: [0.042, 0.675, 0.315],
    shoulderL: [0.076, 0.516, 0.418],
    elbowL: [0.068, 0.344, 0.29],
    wristL: [0.058, 0.125, 0.305],
    mcpL: [0.056, 0.036, 0.32],
    ftoeL: [0.056, 0.016, 0.37],
    hipL: [0.07, 0.545, -0.255],
    kneeL: [0.088, 0.33, -0.173],
    hockL: [0.068, 0.14, -0.327],
    mtpL: [0.064, 0.037, -0.315],
    htoeL: [0.064, 0.016, -0.268],
    jawHinge: hl([0, -0.035, -0.035]),
    jawTip: hl([0, -0.058, 0.128]),
    // ears set wide, on the upper corners of the skull (bases ~1.7x the eye spacing apart, tips ~2x:
    // face1 / face2), ~0.1 m from notch to tip; 4 mm higher with the raised crown
    earBaseL: hl([0.054, 0.046, -0.048]),
    earTipL: hl([0.054 + 0.03 * earK, 0.046 + 0.084 * earK, -0.048 - 0.006 * earK]),
  };
  // bind tail held out behind (~ the trot carriage), clear of the buttocks so the skin of the rump
  // and the brush do not merge; the relaxed hanging carriage comes from the motion data
  const tk = params.tail || 1;
  // (vertebrae 0.43 m: the research mean is 0.45 m for males, 0.35-0.52 m; with the tip hair the brush
  // hangs to about the hock)
  tailChain(J, 'tailBase', [-14, -24, -31, -37, -41, -44, -45, -45], [0.06, 0.057, 0.054, 0.051, 0.048, 0.045, 0.042, 0.039].map((l) => l * 1.08 * tk));
  return J;
}

export function wolfRig(params = {}) {
  const J = wolfJoints(params);
  return buildRig({
    joints: J,
    unit: SH / 0.76,
    headOrigin: HEAD_O,
    bones: quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true }),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the nape and the cheek ruff, and hands over to the neck
      // over 23 cm (was 17: the tighter sleep curl pushed the throat's stretch > 3x to 3.95 % of 4)
      blend: { 1: [-0.07, 0.16, 2] }, // (3rd value: wider with the distance from the axis: the throat)
      bodyTail: 0, // the brush hangs behind the thighs: their skin blends into it only at the tail base
    },
    limbs: quadrupedLimbs({
      front: { tCore: 0.55, aCore: 0.04, aBody: -0.07, midX: 0.0 },
      hind: { tCore: 0.52, aCore: 0.022, aBody: -0.045, midX: 0.008 },
    }),
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.006, 0.014] },
      { group: 'earR', bone: 'earR', blend: [-0.006, 0.014] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle'],
  });
}
