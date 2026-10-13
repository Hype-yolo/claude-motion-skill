// Cheetah skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
// Proportions from reference photos and cheetah limb osteometry
// (humerus ~0.23 m, radius ~0.22 m, femur ~0.26 m, tibia ~0.255 m, metatarsus ~0.13 m,
//  shoulder height ~0.76 m, head-body ~1.36 m, tail ~0.72 m).
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 10;
export const HEAD_O = [0, 0.79, 0.6]; // head-local origin (between eyes and ears)

export function cheetahJoints() {
  const J = {
    nose: [0, 0.772, 0.7],
    occiput: [0, 0.79, 0.525],
    neckMid: [0, 0.716, 0.45],
    neckBase: [0, 0.63, 0.34],
    chestMid: [0, 0.648, 0.16],
    thoraxRear: [0, 0.668, -0.03],
    lumbarMid: [0, 0.68, -0.225],
    lumbosacral: [0, 0.668, -0.41],
    tailBase: [0, 0.655, -0.595],
    scapTopL: [0.045, 0.706, 0.286],
    shoulderL: [0.08, 0.536, 0.386],
    elbowL: [0.078, 0.346, 0.256],
    wristL: [0.068, 0.126, 0.276],
    mcpL: [0.066, 0.038, 0.306],
    ftoeL: [0.066, 0.016, 0.353],
    hipL: [0.072, 0.572, -0.46],
    kneeL: [0.09, 0.34, -0.345],
    hockL: [0.078, 0.172, -0.54],
    mtpL: [0.074, 0.038, -0.51],
    htoeL: [0.074, 0.016, -0.46],
    jawHinge: [0, 0.755, 0.58],
    jawTip: [0, 0.73, 0.66],
    earBaseL: [0.052, 0.83, 0.552],
    earTipL: [0.08, 0.853, 0.548],
  };
  // relaxed tail: droops then flicks up at the tip (J-curve seen in walking references)
  tailChain(J, 'tailBase', [-22, -38, -52, -60, -62, -58, -48, -32, -12, 10], [0.07, 0.074, 0.075, 0.075, 0.074, 0.073, 0.071, 0.069, 0.067, 0.065]);
  return J;
}

export function cheetahRig() {
  const J = cheetahJoints();
  return buildRig({
    joints: J,
    unit: 1,
    headOrigin: HEAD_O,
    bones: quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true }),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches well back into the nape and throat
      blend: { 1: [-0.035, 0.08] },
    },
    limbs: quadrupedLimbs({
      front: { tCore: 0.55, aCore: 0.04, aBody: -0.07, midX: 0.0 },
      hind: { tCore: 0.52, aCore: 0.022, aBody: -0.045, midX: 0.008 },
    }),
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.003, 0.005] },
      { group: 'earR', bone: 'earR', blend: [-0.003, 0.005] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle'],
  });
}
