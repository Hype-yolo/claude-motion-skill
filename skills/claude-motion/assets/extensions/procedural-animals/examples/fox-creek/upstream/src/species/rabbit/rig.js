// European rabbit (Oryctolagus cuniculus) skeleton in bind pose (metres). Forward = +Z, up = +Y,
// the animal's left = +X.
//
// The bind pose stands with the hind legs half extended (see REAR_LIFT below); the rabbit's resting
// crouch (the loaf: sitting on the haunches, forelegs upright, long hind feet flat on the ground) is
// produced by the engine from it (behaviour.js). When the rabbit moves the hips rise and the heels
// lift (the hind limb pantograph extends), so it hops on its toes.
//
// Wild adult ~1.8 kg, head-body 38 cm: femur 80 mm, tibia 92 mm, tarsus+metatarsus
// 52 mm, hind digits 28 mm (hind foot heel -> claw ~88 mm); scapula 60 mm, humerus 59 mm, radius
// 56 mm, metacarpus 22 mm; head 9 cm; ear 7.5-8.5 cm; tail (scut) ~5 cm.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 3;
// head-local origin: on the midline at the height of the eye centres, level with them
export const HEAD_O = [0, 0.219, 0.15];

// ear pose per variant: erect (wild / most domestic) or lop (hanging beside the cheeks)
export function earTip(params = {}) {
  if (params.lop) return [0.05, 0.15, 0.136];
  const e = params.earLen || 1;
  const base = [0.012, 0.238, 0.122];
  const d = [0.017 * e, 0.087 * e, -0.02 * e];
  return [base[0] + d[0], base[1] + d[1], base[2] + d[2]];
}

// The bind pose stands with the hind legs half extended (knee ~77 deg, hips up, back level): the
// halfway point between the folded loaf and the extended push-off, so neither end of the hind
// limb's range stretches the skin far. The rabbit's resting loaf is produced by the engine (the
// hips are lowered at rest, behaviour.js). REAR_LIFT raises the rear of the body with the hips.
export const REAR_LIFT = 0.037;
export const rearW = (z) => { const t = Math.min(1, Math.max(0, (0.03 - z) / 0.12)); return t * t * (3 - 2 * t); };
export const RL = (p) => [p[0], p[1] + REAR_LIFT * rearW(p[2]), p[2]];

export function rabbitJoints(params = {}) {
  const J = {
    nose: [0, 0.2, 0.191],
    occiput: [0, 0.23, 0.115],
    neckMid: [0, 0.205, 0.097],
    neckBase: [0, 0.184, 0.076],
    chestMid: [0, 0.17, 0.05],
    thoraxRear: [0, 0.171, -0.003],
    lumbarMid: RL([0, 0.163, -0.052]),
    lumbosacral: RL([0, 0.135, -0.092]),
    tailBase: RL([0, 0.084, -0.146]),
    // forelimb: upright, the elbow tucked against the lower chest
    scapTopL: [0.024, 0.178, 0.058],
    shoulderL: [0.036, 0.126, 0.1],
    elbowL: [0.05, 0.076, 0.064],
    wristL: [0.045, 0.022, 0.079],
    mcpL: [0.043, 0.0075, 0.094],
    ftoeL: [0.043, 0.004, 0.111],
    // hind limb half extended: femur 76 mm, tibia 88 mm, knee ~77 deg, heel lifted 16.5 deg (the
    // femur's rotation between this pose and the loaf, so the hind-limb pantograph lands the foot
    // flat when the hips sit down); toes forward
    hipL: [0.031, 0.125, -0.086],
    kneeL: [0.05, 0.0762, -0.0277],
    hockL: [0.044, 0.0234, -0.0981],
    mtpL: [0.044, 0.0085, -0.048],
    htoeL: [0.043, 0.0045, -0.02],
    snoutBase: [0, 0.208, 0.174],
    jawHinge: [0, 0.206, 0.13],
    jawTip: [0, 0.185, 0.171],
    earBaseL: [0.012, 0.238, 0.122],
    earTipL: earTip(params),
  };
  // the scut: pressed down against the rump (dark upper side out, white underside hidden)
  tailChain(J, 'tailBase', [-12, -24, -36], [0.016, 0.016, 0.014]);
  return J;
}

export function rabbitRig(params = {}) {
  const J = rabbitJoints(params);
  return buildRig({
    joints: J,
    // characteristic length relative to the cheetah: shoulder height ~0.135 m / 0.76 m
    unit: 0.18,
    headOrigin: HEAD_O,
    bones: quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true, extra: [['snout', 'snoutBase', 'nose', 'head', { region: 'head', group: 'snout' }]] }),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull reaches back into the nape; the scut takes only its own tuft, not the rump
      blend: { 1: [-0.25, 0.3, 1.0], 2: [-0.12, 0.12], 8: [0.03, 0.09] },
    },
    limbs: quadrupedLimbs({
      front: { tCore: 0.9, aCore: 0.07, aBody: 0.05, midX: 0.0 },
      hind: params.hindField || { tCore: 1.0, aCore: 0.12, aBody: 0.1, midX: 0.01 },
    }),
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.06, 0.08] },
      { group: 'earR', bone: 'earR', blend: [-0.06, 0.08] },
      { group: 'snout', bone: 'snout', blend: [-0.004, 0.01] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle'],
  });
}

