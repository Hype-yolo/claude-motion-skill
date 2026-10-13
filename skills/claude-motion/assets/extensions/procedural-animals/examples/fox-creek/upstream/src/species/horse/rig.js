// Horse skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
// Reference individual: a 16 hh (1.63 m at the withers) warmblood / sport horse, ~560 kg.
// Landmarks measured on the side reference (side1.jpg, 1 px = 2.63 mm at 4x) and equine osteology
//: point of shoulder 1.14 m, elbow 0.90, carpus 0.50, fetlock 0.17, stifle 0.90,
// hock 0.55 (point of hock 0.62), body length (point of shoulder -> point of buttock) 1.70 m.
//
// Hooves: the standard quadruped bones plus a hoof bone per leg. fpaw / hpaw are the pasterns
// (fetlock -> coffin joint) and fhoof / hhoof the hooves (coffin joint -> toe), so the engine can
// keep the hoof flat on the ground while the fetlock sinks under load.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 10; // 6 dock bones + 4 segments of free-hanging tail hair
export const DOCK_SEGS = 6;

// Head frame: the head is modelled along its own axis (poll -> muzzle), pitched 55 degrees nose
// down in the bind pose. Head-local coordinates: x lateral, y dorsal (forehead side), z along the
// nasal line toward the muzzle; origin on the axis 0.20 m in front of the poll (level with the eyes).
// (the bind pose holds the head at 37 deg, less flexed at the poll than at rest (55 deg, restored by the
// head carriage), so the throat skin is meshed at mid-range between grazing and an alert head)
export const HEAD_PITCH = (37 * Math.PI) / 180;
export const HZ = [0, -Math.sin(HEAD_PITCH), Math.cos(HEAD_PITCH)];
export const HY = [0, Math.cos(HEAD_PITCH), Math.sin(HEAD_PITCH)];
// poll ~0.30 x withers height above the withers (side1.jpg), the neck arched and carried high
const POLL = [0, 2.05, 1.2]; // top of the poll (skin), bind
export const HEAD_O = [0, POLL[1] + 0.2 * HZ[1], POLL[2] + 0.2 * HZ[2]];
export const hl = (v) => [HEAD_O[0] + v[0], HEAD_O[1] + v[1] * HY[1] + v[2] * HZ[1], HEAD_O[2] + v[1] * HY[2] + v[2] * HZ[2]];

export function horseJoints() {
  const J = {
    nose: hl([0, 0.0, 0.4]),
    occiput: hl([0, -0.06, -0.19]),
    neckMid: [0, 1.63, 0.97],
    neckBase: [0, 1.19, 0.74], // cervicothoracic junction: the neck hinges low, at about the point of shoulder // cervicothoracic junction, deep at the base of the neck
    chestMid: [0, 1.4, 0.4],
    thoraxRear: [0, 1.43, 0.02],
    lumbarMid: [0, 1.46, -0.24],
    lumbosacral: [0, 1.47, -0.44],
    tailBase: [0, 1.46, -0.8],
    // fore: scapula slopes ~50 deg, humerus down and back, radius and cannon vertical,
    // pastern ~55 deg to the ground
    scapTopL: [0.1, 1.47, 0.5],
    shoulderL: [0.165, 1.14, 0.77],
    elbowL: [0.16, 0.9, 0.6],
    wristL: [0.13, 0.5, 0.63],
    mcpL: [0.125, 0.17, 0.64],
    fcoffinL: [0.125, 0.066, 0.713],
    ftoeL: [0.125, 0.004, 0.8],
    // hind: hip joint, stifle, hock, fetlock, coffin joint, toe
    hipL: [0.155, 1.23, -0.62],
    kneeL: [0.185, 0.94, -0.36],
    hockL: [0.13, 0.55, -0.61],
    mtpL: [0.12, 0.175, -0.585],
    hcoffinL: [0.12, 0.068, -0.515],
    htoeL: [0.12, 0.004, -0.435],
    // tack (not bones: attachment landmarks carried by the variation warps like the skin): saddle
    // base on the skin of the back over T12-T14 (~0.3 m behind the withers point; measured on the
    // sculpt's surface at x 0, z 0.21), rider's seat 0.12 m above it, stirrup treads ~10 cm outside
    // the barrel at ~1.0 m
    saddle: [0, 1.625, 0.21],
    seat: [0, 1.745, 0.19],
    stirrupL: [0.3, 1.02, 0.24],
    jawHinge: hl([0, -0.04, -0.1]),
    jawTip: hl([0, -0.1, 0.39]),
    earBaseL: hl([0.058, 0.06, -0.185]),
    earTipL: hl([0.085, 0.205, -0.225]),
  };
  // dock droops from the croup, the hair hangs to the hocks
  tailChain(J, 'tailBase', [-25, -50, -66, -76, -82, -86, -88, -89, -89, -89], [0.085, 0.08, 0.075, 0.07, 0.065, 0.06, 0.12, 0.12, 0.12, 0.12]);
  return J;
}

export function horseBones() {
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

export function horseRig(J = horseJoints()) {
  const limbs = quadrupedLimbs({
    front: { tCore: 0.55, aCore: 0.07, aBody: -0.13, midX: 0.0 },
    hind: { tCore: 0.5, aCore: 0.022, aBody: -0.08, midX: 0.008 },
  });
  for (const L of Object.values(limbs)) { L.bones.push((L.front ? 'fhoof' : 'hhoof') + L.S); L.distal.push((L.front ? 'fhoof' : 'hhoof') + L.S); }
  return buildRig({
    joints: J,
    unit: 2.14,
    headOrigin: HEAD_O,
    bones: horseBones(),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the throat latch and nape (3rd value: the blend widens
      // with the skin's depth under the axis: the throat under the jaw). The occiput blend must end
      // before the neckMid joint (0.418 m on) for every throat vertex (depth <= 0.22 m): the core
      // applies only the blends at the two ends of a segment, so a blend reaching past neckMid was cut
      // off there and the head weight under the throat jumped from 0.45 to 0 (the head and body copies
      // of the throat then took weights 0.3-0.45 apart and parted when the head moved). Now the
      // throat latch is half head, the crest hands over from the head 5-30 cm behind the poll.
      blend: { 1: [-0.004, 0.139, 0.5], 3: [-0.12, 0.12, 2] },
      bodyTail: 0, // the dock hangs behind the buttocks: their skin blends into it only at the tail base
    },
    limbs,
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.003, 0.005] },
      { group: 'earR', bone: 'earR', blend: [-0.003, 0.005] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle', 'pectoral', 'forearmweb'],
  });
}
