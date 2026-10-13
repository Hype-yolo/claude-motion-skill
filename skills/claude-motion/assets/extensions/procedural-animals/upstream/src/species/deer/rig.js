// White-tailed deer skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
// Reference individual: an adult white-tailed deer of 0.92 m at the withers (a doe / young buck,
// ~55 kg). Bucks are built from it by the seeded size (x 1.08), fawns at x 0.5 with long legs.
// Landmarks measured on side_buck2.jpg / side_full.jpg (normalised to the withers height) and the
// limb-bone lengths of OsteoID: point of shoulder 0.64 m, elbow 0.49,
// carpus 0.28, fore fetlock 0.085, stifle 0.54, hock 0.33, hind fetlock 0.085; body length (point
// of shoulder -> point of buttock) 0.98 m.
//
// Hooves as on the horse: the standard quadruped bones plus a hoof bone per leg (fpaw / hpaw =
// pastern, fetlock -> coffin joint; fhoof / hhoof = the cloven hoof, coffin joint -> toe).
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 6;

// Head frame: modelled along its own axis (poll -> nose), pitched 50 degrees nose down in the bind
// pose. Head-local coordinates: x lateral, y dorsal (forehead side), z along the nasal line toward
// the nose; origin on the axis 0.09 m in front of the poll, level with the eyes.
export const HEAD_PITCH = (50 * Math.PI) / 180;
export const HZ = [0, -Math.sin(HEAD_PITCH), Math.cos(HEAD_PITCH)];
export const HY = [0, Math.cos(HEAD_PITCH), Math.sin(HEAD_PITCH)];
export const POLL = [0, 1.2, 0.5]; // top of the poll (skin), bind
export const HEAD_O = [0, POLL[1] + 0.09 * HZ[1] - 0.035 * HY[1], POLL[2] + 0.09 * HZ[2] - 0.035 * HY[2]];
export const hl = (v) => [HEAD_O[0] + v[0], HEAD_O[1] + v[1] * HY[1] + v[2] * HZ[1], HEAD_O[2] + v[1] * HY[2] + v[2] * HZ[2]];
// head-local direction -> world
export const hdir = (v) => [v[0], v[1] * HY[1] + v[2] * HZ[1], v[1] * HY[2] + v[2] * HZ[2]];

// The barrel between the fore and hind legs is long in the photos (point of shoulder -> stifle
// 0.96-1.2 withers heights in side_buck2 / side1, chest front -> rump rear 1.26-1.5): everything from
// the loin back sits LOIN further back than the first build had it (0.75 / 1.14-1.19 WH, a short,
// boxy trunk). bz(z) maps a reference z of that first layout to the lengthened body (the loin and
// flank stretch between z -0.1 and -0.25, the hindquarters move back rigidly).
export const LOIN = 0.1;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const bz = (z) => z - LOIN * sstep(-0.1, -0.25, z);
const B = (v) => [v[0], v[1], bz(v[2])];

export function deerJoints() {
  const J = {
    nose: hl([0, -0.005, 0.19]),
    occiput: hl([0, -0.01, -0.085]),
    // the neck leaves the chest low, at the thoracic inlet in front of the shoulders (not at the
    // withers): a grazing deer swings it down to the ground on straight forelegs
    neckMid: [0, 0.945, 0.425],
    neckBase: [0, 0.7, 0.355],
    chestMid: [0, 0.8, 0.2],
    thoraxRear: [0, 0.81, -0.02],
    lumbarMid: B([0, 0.83, -0.2]),
    lumbosacral: B([0, 0.845, -0.34]),
    tailBase: B([0, 0.83, -0.56]),
    // fore: scapula sloping ~55 deg, humerus down and back, radius and cannon near vertical, the
    // pastern ~50 deg to the ground, a small cloven hoof
    scapTopL: [0.055, 0.87, 0.26],
    shoulderL: [0.095, 0.64, 0.405],
    elbowL: [0.088, 0.495, 0.3],
    wristL: [0.074, 0.28, 0.345],
    mcpL: [0.07, 0.085, 0.35],
    fcoffinL: [0.07, 0.032, 0.385],
    ftoeL: [0.07, 0.003, 0.43],
    // hind: hip joint, stifle, hock, fetlock, coffin joint, toe. Long tibia and metatarsus (the
    // cursorial look), hock well behind the hip
    hipL: B([0.085, 0.745, -0.38]),
    kneeL: B([0.1, 0.54, -0.285]),
    hockL: B([0.074, 0.33, -0.49]),
    mtpL: B([0.068, 0.085, -0.455]),
    hcoffinL: B([0.068, 0.031, -0.42]),
    htoeL: B([0.068, 0.003, -0.377]),
    jawHinge: hl([0, -0.045, -0.035]),
    jawTip: hl([0, -0.062, 0.17]),
    // large mobile ears carried up and out in a wide V (~45 deg above the horizontal)
    earBaseL: hl([0.034, 0.03, -0.055]),
    earTipL: [0, 0, 0],
  };
  // ear direction: lateral + world up (head-local: world up = (0, cos p, -sin p)), a little back
  const up = [0, Math.cos(HEAD_PITCH), -Math.sin(HEAD_PITCH)];
  const d = [0.85, 0.52 * up[1] - 0.1, 0.52 * up[2] - 0.14];
  const n = Math.hypot(...d);
  const b = [0.034, 0.03, -0.055];
  J.earTipL = hl([b[0] + (0.145 * d[0]) / n, b[1] + (0.145 * d[1]) / n, b[2] + (0.145 * d[2]) / n]);
  // tail hangs flat against the rump (brown side out), 0.24 m
  tailChain(J, 'tailBase', [-45, -62, -72, -78, -80, -80], [0.04, 0.04, 0.04, 0.04, 0.04, 0.04]);
  return J;
}

export function deerBones() {
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

export function deerRig(J = deerJoints()) {
  const limbs = quadrupedLimbs({
    front: { tCore: 0.55, aCore: 0.055, aBody: -0.1, midX: 0.0 },
    hind: { tCore: 0.5, aCore: 0.022, aBody: -0.08, midX: 0.008 },
  });
  for (const L of Object.values(limbs)) { L.bones.push((L.front ? 'fhoof' : 'hhoof') + L.S); L.distal.push((L.front ? 'fhoof' : 'hhoof') + L.S); }
  return buildRig({
    joints: J,
    unit: 0.92 / 0.76,
    headOrigin: HEAD_O,
    bones: deerBones(),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the throat latch (3rd value: the blend widens with
      // the skin's distance from the axis on the ventral side, the throat under the jaw)
      blend: { 1: [-0.03, 0.12, 6], 3: [-0.12, 0.12, 2] },
      bodyTail: 0, // the tail lies flat on the rump: body skin blends into it only at the tail base
    },
    limbs,
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.002, 0.004] },
      { group: 'earR', bone: 'earR', blend: [-0.002, 0.004] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle', 'pectoral', 'forearmweb'],
  });
}
