// Wild boar skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
// Reference individual: a Central European adult (unsexed build), 0.75 m at the withers (top of the
// skin over the spinous processes, the bristle mane adds 3-5 cm), 1.31 m snout disc -> buttock
// (1.74 SH). Landmarks measured on side1.jpg (2x grid, 1 px = 1.49 mm).
//
// Hooves: the standard quadruped bones plus a hoof bone per leg, exactly like the horse / goat:
// fpaw / hpaw = pastern (fetlock -> coffin joint), fhoof / hhoof = the cloven hoof (coffin joint ->
// toe), so the engine keeps the claws flat while the fetlock sinks under load.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';
import { norm, add, mul } from '../../core/math/vec.js';

export const TAIL_SEGS = 6;

// Head frame: modelled along its own axis (forehead -> snout disc), pitched 40 degrees nose-down in
// the bind pose (the boar carries its long wedge head low, side1: 45 deg walking, side2 standing).
// Head-local coordinates: x lateral, y dorsal, z along the head toward the disc; origin on the axis
// level with the eyes.
export const HEAD_PITCH = (40 * Math.PI) / 180;
export const HZ = [0, -Math.sin(HEAD_PITCH), Math.cos(HEAD_PITCH)];
export const HY = [0, Math.cos(HEAD_PITCH), Math.sin(HEAD_PITCH)];
export const HEAD_O = [0, 0.555, 0.49];
export const hl = (v) => [HEAD_O[0] + v[0], HEAD_O[1] + v[1] * HY[1] + v[2] * HZ[1], HEAD_O[2] + v[1] * HY[2] + v[2] * HZ[2]];
// head-local direction -> world
export const hdir = (v) => [v[0], v[1] * HY[1] + v[2] * HZ[1], v[1] * HY[2] + v[2] * HZ[2]];

export const EAR_BASE = [0.076, 0.066, -0.11];
export const EAR_LEN = 0.125;

export function boarJoints(params = {}) {
  // erect ears on the upper corners of the crown: up and a little out (params.earSpread 0..1)
  const sp = params.earSpread ?? 0.5;
  const earB = hl(EAR_BASE);
  const earD = norm([0.42 + 0.3 * sp, 1, -0.05]);
  const J = {
    nose: hl([0, -0.018, 0.305]), // (the snout disc: the engine keeps it off the ground)
    occiput: hl([0, 0.0, -0.15]),
    neckMid: [0, 0.575, 0.3],
    neckBase: [0, 0.57, 0.2],
    chestMid: [0, 0.575, 0.07],
    thoraxRear: [0, 0.575, -0.1],
    lumbarMid: [0, 0.565, -0.25],
    lumbosacral: [0, 0.55, -0.37],
    tailBase: [0, 0.535, -0.535],
    // fore: scapula sloping ~65 deg, humerus down and back, radius and cannon vertical, short
    // steep pasterns (a boar stands on the tips of its claws)
    scapTopL: [0.062, 0.68, 0.185],
    shoulderL: [0.1, 0.475, 0.27],
    elbowL: [0.1, 0.305, 0.17],
    wristL: [0.085, 0.145, 0.18],
    mcpL: [0.078, 0.058, 0.19],
    fcoffinL: [0.078, 0.027, 0.212],
    ftoeL: [0.078, 0.002, 0.25],
    // hind: hip joint, stifle, hock, fetlock, coffin joint, toe
    hipL: [0.085, 0.5, -0.38],
    kneeL: [0.1, 0.31, -0.27],
    hockL: [0.075, 0.16, -0.42],
    mtpL: [0.07, 0.056, -0.405],
    hcoffinL: [0.07, 0.027, -0.385],
    htoeL: [0.07, 0.002, -0.347],
    jawHinge: hl([0, -0.075, -0.07]),
    jawTip: hl([0, -0.088, 0.255]),
    earBaseL: earB,
    earTipL: add(earB, mul(earD, EAR_LEN)),
  };
  // the thin tail hangs down against the buttocks, its tassel just above the hocks
  tailChain(J, 'tailBase', [-35, -60, -72, -78, -82, -84], [0.04, 0.04, 0.04, 0.038, 0.036, 0.034]);
  return J;
}

export function boarBones() {
  const b = quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true });
  for (const d of b) {
    if (d[0] === 'fpaw{S}') { d[2] = 'fcoffin{S}'; d[4] = { region: 'limb', group: 'F{S}' }; }
    if (d[0] === 'hpaw{S}') { d[2] = 'hcoffin{S}'; d[4] = { region: 'limb', group: 'H{S}' }; }
  }
  b.push(
    ['fhoof{S}', 'fcoffin{S}', 'ftoe{S}', 'fpaw{S}', { region: 'foot', group: 'F{S}' }],
    ['hhoof{S}', 'hcoffin{S}', 'htoe{S}', 'hpaw{S}', { region: 'foot', group: 'H{S}' }],
  );
  return b;
}

export function boarRig(params = {}, J = boarJoints(params)) {
  const limbs = quadrupedLimbs({
    front: { tCore: 0.5, aCore: 0.05, aBody: -0.1, midX: 0.0 },
    hind: { tCore: 0.45, aCore: 0.022, aBody: -0.11, midX: 0.008 },
  });
  for (const L of Object.values(limbs)) { L.bones.push((L.front ? 'fhoof' : 'hhoof') + L.S); L.distal.push((L.front ? 'fhoof' : 'hhoof') + L.S); }
  return buildRig({
    joints: J,
    unit: 0.75 / 0.76,
    headOrigin: HEAD_O,
    bones: boarBones(),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the deep jowls and throat
      blend: { 1: [-0.07, 0.2, 2.5], 2: [-0.07, 0.07, 3], 3: [-0.06, 0.06, 0] },
      bodyTail: 0, // (the tail hangs against the buttocks: body skin blends into it only at the root)
    },
    limbs,
    appendages: [
      // (a 2 cm blend: the skin round the ear base follows the ear a little, so the crown skin is not
      // stretched across a hard hinge when the ears flatten or swivel)
      { group: 'earL', bone: 'earL', blend: [-0.006, 0.02] },
      { group: 'earR', bone: 'earR', blend: [-0.006, 0.02] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle', 'pectoral', 'forearmweb'],
  });
}
