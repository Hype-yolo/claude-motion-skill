// Brown bear skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
//
// Reference individual: an average adult (between the sexes, ~200 kg), hump height with the coat
// ~1.0 m, nose to rump ~1.7 m, head ~0.36 m (occiput -> nose with soft tissue). Graviportal,
// plantigrade limbs with long proximal and short distal segments: scapula 0.30,
// humerus 0.30, radius 0.28, carpus + metacarpus 0.12 (lying almost flat: the palm is on the
// ground), femur 0.38, tibia 0.30, tarsus + metatarsus 0.18 (flat: heel on the ground). The
// forelegs stand as near-vertical columns under the hump, elbows under the chest; the hind legs
// are straight-ish (stifle ~150 deg). The head is modelled level in its own frame (HEAD_O); the
// low head carriage comes from the motion data.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 2;
export const HEAD_O = [0, 0.78, 0.72]; // head-local origin (mid cranium, between the eyes and the ears)
export const SH = 1.0; // reference hump height (with the coat)
export const MUZZLE_Z0 = 0.06; // head-local z where the muzzle starts (muzzle length variation acts ahead of it)

// head-local -> reference space, with per-individual muzzle length and head width factors
export const hlOf = (m = 1, w = 1) => (v) => [HEAD_O[0] + v[0] * w, HEAD_O[1] + v[1], HEAD_O[2] + (v[2] > MUZZLE_Z0 ? MUZZLE_Z0 + (v[2] - MUZZLE_Z0) * m : v[2])];

export function bearJoints(params = {}) {
  const hl = hlOf(params.muzzle || 1);
  const earK = params.ear || 1, hw = params.headW || 1;
  const J = {
    nose: hl([0, -0.012, 0.215]),
    occiput: hl([0, 0.025, -0.125]),
    neckMid: [0, 0.79, 0.49],
    neckBase: [0, 0.81, 0.35],
    chestMid: [0, 0.845, 0.14],
    thoraxRear: [0, 0.835, -0.04],
    lumbarMid: [0, 0.825, -0.2],
    lumbosacral: [0, 0.815, -0.34],
    tailBase: [0, 0.78, -0.48],
    // forelimb: the point of the shoulder low at the front of the chest (~0.64 of the hump height), the
    // humerus sloping back ~35 deg to the elbow at the bottom of the chest, the forearm a column leaning
    // a little forward to the flat palm. Standing, the leg is at 0.915 of its length (elbow ~132 deg,
    // like the other quadrupeds' 0.94 / 140 deg): at 0.98 (158 deg) the shoulder stood higher above the
    // wrist than the IK's 95 % reach and a planted forepaw was out of reach at once (fore stance 7 % of
    // a walking stride, 3 % of a gallop)
    scapTopL: [0.075, 0.9, 0.2],
    // (fore stance 0.31 m centre to centre, research 2.2: 0.30-0.38 m; at 0.29 the forelegs stood close
    // together under a chest ~20 % narrower than tq2's)
    shoulderL: [0.152, 0.635, 0.38],
    elbowL: [0.167, 0.38, 0.205],
    wristL: [0.157, 0.078, 0.275],
    mcpL: [0.157, 0.034, 0.395],
    ftoeL: [0.157, 0.012, 0.515],
    // hind limb: long near-vertical femur, tibia sloping back, heel (hock) close to the ground
    // (the heel stands under the back of the rump, side1 / side2 / side3: 5 cm further back than before,
    // when the rump overhung the hind feet by a fifth of the body length)
    hipL: [0.115, 0.77, -0.32],
    kneeL: [0.175, 0.4, -0.195],
    hockL: [0.157, 0.09, -0.41],
    mtpL: [0.157, 0.034, -0.24],
    htoeL: [0.157, 0.012, -0.145],
    jawHinge: hl([0, -0.045, -0.04]),
    jawTip: hl([0, -0.08, 0.172]),
    // ears on the top corners of the head, wide apart (face1 / face2: ear centres 1.0-1.3 x the eye
    // separation from the midline), over the back of the zygomatic arches; they follow the head's width
    // (1 cm further out and lower, leaning out more: face1 / face2 / tq2 show the ears on the outer corners of a broad,
    // flat forehead; on top of the skull they framed a round ball of a head)
    earBaseL: hl([0.122 * hw, 0.082, -0.05]),
    // (the tip 1 cm lower than before: in profile the ears stood tall over the head line, side1 / face3_profile show them
    // short and round)
    earTipL: hl([0.122 * hw + 0.03 * earK, 0.082 + 0.062 * earK, -0.05 - 0.012 * earK]),
  };
  // the stubby tail hangs down over the anus, hidden in the rump fur
  tailChain(J, 'tailBase', [-40, -62], [0.055, 0.05].map((l) => l * (params.tail || 1)));
  return J;
}

// the thick wrist of a plantigrade forefoot blends over a wide region (the carpus flexes 60-90 deg
// in the swing; a narrow distal blend creased the skin behind it). The foreleg's field ends 8 cm from
// the body (aBody): at -0.14 it spread humerus weight up the short neck to the head / neck cut, where
// the head's own copy of the skin has none, and the two copies split apart whenever the head moved
// (sniff 53 mm; now <= 9 mm).
function bearLimbs() {
  const L = quadrupedLimbs({
    front: { tCore: 0.68, aCore: 0.08, aBody: -0.06, midX: 0.0 },
    hind: { tCore: 0.75, aCore: 0.07, aBody: -0.14, midX: 0.008 },
  });
  for (const S of ['L', 'R']) L['F' + S].distal = ['fpaw' + S];
  return L;
}

export function bearRig(params = {}) {
  const J = bearJoints(params);
  return buildRig({
    joints: J,
    unit: SH / 0.76,
    headOrigin: HEAD_O,
    bones: quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true }),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the thick nape and the cheek ruff; the throat
      // stretches most when the head goes down (rooting, drinking, sleeping on the paws). The blend
      // starts at the occiput: the skin at the lips must move with the head alone, like the rigid
      // lower jaw below it (an earlier start with a longer lever gave the mouth corners 17 % neck
      // weight, and the lips opened 3 cm off the jaw when the head turned)
      blend: { 1: [0.0, 0.16, 1.5] },
      bodyTail: 0,
    },
    limbs: bearLimbs(),
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.012, 0.018] },
      { group: 'earR', bone: 'earR', blend: [-0.012, 0.018] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle', 'armpit'],
  });
}
