// Cow skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
// Reference individual: a Holstein-Friesian cow, 1.45 m at the withers, ~650 kg.
// Landmarks measured on the side references (side1_holstein.jpg: 1 px ~ 2.2 mm; side_natural.jpg for
// the relaxed head carriage) and bovine osteology: point of shoulder 1.00 m, elbow
// 0.72, carpus 0.40, fore fetlock 0.13, stifle 0.80, hock 0.53 (point of hock 0.60), body length
// (point of shoulder -> pin bone) 1.72 m, hooks (tuber coxae) 1.47 m and 0.58 m apart.
//
// Hooves: like the horse, a hoof bone per leg below the pastern (fpaw / hpaw = pastern: fetlock ->
// coffin joint; fhoof / hhoof = the claw pair: coffin joint -> toe), so the engine keeps the claws
// flat while the fetlock sinks under load. Cattle are cloven: the sculpt splits each hoof into two
// claws (digits III and IV) with two dew claws behind the fetlock; they share one hoof bone.
//
// Extra bones: a tongue (on the jaw, meshed as its own rigid surface, hidden in the mouth until it
// wraps grass or licks the nose).
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 12; // 10 caudal segments (the bony tail to the hocks) + 2 of switch hair
export const BONE_SEGS = 10;
export const TAIL_PITCH = [-38, -68, -80, -85, -87, -88, -89, -89, -90, -90, -90, -90];
export const TAIL_LENS = [0.075, 0.072, 0.07, 0.068, 0.066, 0.064, 0.062, 0.06, 0.058, 0.056, 0.16, 0.16];

// Head frame: the head is modelled along its own axis (poll -> muzzle), pitched 50 degrees nose down
// in the bind pose (relaxed standing carriage, research 3: nasal line 50-70 deg below horizontal).
// Head-local coordinates: x lateral, y dorsal (forehead side), z along the nasal line toward the
// muzzle; origin on the axis 0.17 m in front of the poll (level with the eyes).
export const HEAD_PITCH = (50 * Math.PI) / 180;
export const HZ = [0, -Math.sin(HEAD_PITCH), Math.cos(HEAD_PITCH)];
export const HY = [0, Math.cos(HEAD_PITCH), Math.sin(HEAD_PITCH)];
const POLL = [0, 1.46, 1.13]; // top of the poll (skin), bind
export const HEAD_O = [0, POLL[1] + 0.17 * HZ[1], POLL[2] + 0.17 * HZ[2]];
export const hl = (v) => [HEAD_O[0] + v[0], HEAD_O[1] + v[1] * HY[1] + v[2] * HZ[1], HEAD_O[2] + v[1] * HY[2] + v[2] * HZ[2]];

export function cowJoints() {
  const J = {
    nose: hl([0, -0.01, 0.37]),
    occiput: hl([0, -0.035, -0.14]),
    neckMid: [0, 1.3, 0.9],
    neckBase: [0, 1.2, 0.64],
    chestMid: [0, 1.3, 0.34],
    thoraxRear: [0, 1.33, 0.0],
    lumbarMid: [0, 1.355, -0.27],
    lumbosacral: [0, 1.37, -0.5],
    tailBase: [0, 1.37, -0.88],
    // fore: scapula slopes ~55 deg, humerus down and back, radius and cannon near vertical, short
    // pastern ~50 deg to the ground
    scapTopL: [0.12, 1.36, 0.42],
    shoulderL: [0.19, 1.0, 0.74],
    elbowL: [0.18, 0.72, 0.58],
    wristL: [0.155, 0.4, 0.63],
    mcpL: [0.15, 0.13, 0.65],
    fcoffinL: [0.15, 0.052, 0.705],
    ftoeL: [0.15, 0.004, 0.785],
    // hind: hip joint, stifle, hock, fetlock, coffin joint, toe (the stifle well forward under the
    // flank, the straight-ish dairy hock)
    hipL: [0.2, 1.2, -0.6],
    kneeL: [0.235, 0.8, -0.4],
    hockL: [0.17, 0.53, -0.71],
    mtpL: [0.17, 0.13, -0.665],
    hcoffinL: [0.17, 0.052, -0.61],
    htoeL: [0.17, 0.004, -0.53],
    jawHinge: hl([0, -0.065, -0.075]),
    jawTip: hl([0, -0.118, 0.335]),
    tongueBase: hl([0, -0.085, 0.12]),
    tongueTip: hl([0, -0.09, 0.3]),
    // ears stick out sideways below the poll, nearly horizontal, tipped a little down and back
    earBaseL: hl([0.085, 0.01, -0.125]),
  };
  J.earTipL = [J.earBaseL[0] + 0.2, J.earBaseL[1] - 0.025, J.earBaseL[2] - 0.045];
  // the tail head is set high between the pin bones; the tail hangs straight down to the hocks,
  // the switch below it
  tailChain(J, 'tailBase', TAIL_PITCH, TAIL_LENS);
  return J;
}

export function cowBones() {
  const b = quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true });
  for (const d of b) {
    if (d[0] === 'fpaw{S}') { d[2] = 'fcoffin{S}'; d[4] = { region: 'limb', group: 'F{S}' }; }
    if (d[0] === 'hpaw{S}') { d[2] = 'hcoffin{S}'; d[4] = { region: 'limb', group: 'H{S}' }; }
  }
  b.push(
    ['fhoof{S}', 'fcoffin{S}', 'ftoe{S}', 'fpaw{S}', { region: 'foot', group: 'F{S}' }],
    ['hhoof{S}', 'hcoffin{S}', 'htoe{S}', 'hpaw{S}', { region: 'foot', group: 'H{S}' }],
    ['tongue', 'tongueBase', 'tongueTip', 'jaw', { region: 'jaw', group: 'jaw' }],
  );
  return b;
}

export function cowRig(J = cowJoints()) {
  const limbs = quadrupedLimbs({
    front: { tCore: 0.55, aCore: 0.055, aBody: -0.1, midX: 0.0 },
    hind: { tCore: 0.5, aCore: 0.022, aBody: -0.08, midX: 0.02 },
  });
  for (const L of Object.values(limbs)) { L.bones.push((L.front ? 'fhoof' : 'hhoof') + L.S); L.distal.push((L.front ? 'fhoof' : 'hhoof') + L.S); }
  return buildRig({
    joints: J,
    unit: 1.45 / 0.76,
    headOrigin: HEAD_O,
    bones: cowBones(),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the throat (the deep jowl and throat skin), the
      // neck base blends broadly into the chest and the dewlap
      blend: { 1: [-0.06, 0.12, 5], 3: [-0.12, 0.12, 2] },
      bodyTail: 0, // the tail hangs between the pin bones: body skin blends into it only at the tail head
    },
    limbs,
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.003, 0.006] },
      { group: 'earR', bone: 'earR', blend: [-0.003, 0.006] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle', 'pectoral', 'forearmweb'],
  });
}
