// True frog (Ranidae) skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
//
// Reference individual: adult female American bullfrog (Lithobates catesbeianus), snout-vent length
// (SVL) 140 mm. The bind pose IS the classic sitting frog (the resting stance of the
// quadruped engine): forelegs upright on flat hands, hind legs folded in a Z beside the body (femur
// forward and out, tibiofibula back alongside it, tarsus and the long webbed foot flat on the ground
// pointing forward and out), the trunk rising from the vent to the sacral hump and on to the flat
// head. No neck: the neck joints sit packed behind the skull. No tail (the urostyle is the pelvis
// bone, lumbosacral -> tailBase).
//
// Frog bones mapped onto the standard quadruped set (core/rig/quadruped.js):
//   pelvis (lumbosacral -> tailBase)  ilia + urostyle: the ilio-sacral hinge is the sacral hump
//   femur / tibia                     femur / tibiofibula
//   metatarsus (hock -> mtp)          the elongated tarsus (astragalus + calcaneum)
//   hpaw (mtp -> htoe)                metatarsals + toes (toe IV), webbed
//   humerus / radius                  humerus / radio-ulna
//   metacarpus / fpaw                 palm / fingers (4)
// Extra bones: eyeL / eyeR (the eyes retract into the head to blink and swallow), throat (buccal
// floor and vocal sac: pumping and croaking), tongue (attached at the front of the lower jaw, flips
// out forward).
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs } from '../../core/rig/quadruped.js';
import { sub, add, mul, norm, cross, dot, len } from '../../core/math/vec.js';

// head-local origin: on the midline, level with the eye centres
export const HEAD_O = [0, 0.06, 0.049];
export const hl = (v) => [v[0] + HEAD_O[0], v[1] + HEAD_O[1], v[2] + HEAD_O[2]];

// limb segment lengths at SVL 140 mm (ranid ratios)
export const SEG = { hum: 0.026, rad: 0.022, fem: 0.064, tib: 0.071 };
// stance.sprawl of motion.js: the engine places the feet sprawl x leg length x 0.35 further out than
// the bind, and bends knees / elbows toward poles turned out by sprawl x 1.6; the bind is built with
// the same poles and its feet that much further in, so the resting stance reproduces it
export const SPRAWL = 0.25;

// Knee / elbow of a two-bone chain a -> c (lengths l1, l2) bent toward the pole direction (the
// engine's IK solve, so the bind limb lies in the plane the engine bends it in)
export function solve2(a, c, l1, l2, pole) {
  const d = sub(c, a), D = len(d), e1 = norm(d);
  let e2 = sub(pole, mul(e1, dot(pole, e1)));
  e2 = norm(e2);
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D)));
  return add(a, add(mul(e1, cosA * l1), mul(e2, Math.sqrt(1 - cosA * cosA) * l1)));
}

// the sitting foot (left): heel beside the vent, tarsus and foot forward (tarsus pitched ~4.4 deg)
const FOOT = { x: 0.035, hockBack: 0.0175, tilt: 4.4 };

// the eye centre (the eye bone's head) of the left eye, see sculpt.js EYE
export const EYE_C = [0.0152, 0.0012, -0.0002];

export function frogJoints(params = {}) {
  const J = {
    // axial: vent -> sacral hump -> back -> skull
    tailBase: [0, 0.021, -0.052],
    lumbosacral: [0, 0.037, -0.03],
    lumbarMid: [0, 0.042, -0.017],
    thoraxRear: [0, 0.045, -0.004],
    chestMid: [0, 0.047, 0.009],
    neckBase: [0, 0.049, 0.018],
    neckMid: [0, 0.0505, 0.023],
    occiput: [0, 0.052, 0.028],
    nose: [0, 0.0505, 0.088],
    jawHinge: [0, 0.0395, 0.03],
    jawTip: [0, 0.0405, 0.086],
    // forelimb: shoulder behind the jaw angle, humerus back and down along the flank, radio-ulna
    // nearly upright, palm flat, fingers pointing forward and in
    scapTopL: [0.013, 0.054, 0.012],
    shoulderL: [0.0175, 0.034, 0.016],
    wristL: [0.025, 0.0055, 0.011],
    mcpL: [0.025, 0.0036, 0.0225],
    ftoeL: [0.025, 0.0011, 0.0395],
    // hind limb: the Z-fold of the sit: femur forward and out, tibiofibula back alongside it, the heel
    // beside the vent, tarsus and the long foot forward on the ground
    hipL: [0.0105, 0.028, -0.044],
  };
  // (the engine keeps a foot in the plane of its forward axis and places it by its joints' y / z only:
  // the bind hands and feet run straight ahead, the fingers and toes fan out from them in the sculpt:
  // fingers turned in, the long toes turned out)
  const tt = (FOOT.tilt * Math.PI) / 180;
  J.hockL = [FOOT.x, 0.0056 + 0.0377 * Math.sin(tt), J.hipL[2] - FOOT.hockBack];
  J.mtpL = [FOOT.x, 0.0056, J.hockL[2] + 0.0377 * Math.cos(tt)];
  J.htoeL = [FOOT.x, 0.0012, J.mtpL[2] + 0.0606];
  // knee and elbow from the engine's poles (sprawl)
  J.kneeL = solve2(J.hipL, J.hockL, SEG.fem, SEG.tib, [0.12 + SPRAWL * 1.6, 0, 1]);
  J.elbowL = solve2(J.shoulderL, J.wristL, SEG.hum, SEG.rad, [0.08 + SPRAWL * 1.6, 0, -1]);
  // extra bones
  const ec = hl(EYE_C);
  J.eyeBaseL = ec;
  J.eyeTopL = [ec[0], ec[1] + 0.008, ec[2]];
  J.throatBase = [0, 0.044, 0.036];
  J.throatTip = [0, 0.03, 0.046];
  J.tongueBase = [0, 0.0425, 0.079];
  J.tongueTip = [0, 0.0435, 0.046];
  void params;
  return J;
}

// rig.unit: the frog is short at the shoulder (0.054 m / 0.76 m = 0.07 of the cheetah) but its limbs are
// long (hind limb 0.17 m, ~0.3 of the cheetah's). The core scales its skin-blend widths by the unit, and
// the knee and ankle of the Z-folded hind leg swing ~150 deg between the sit and a leap: they need
// blends as wide as the limb's scale, so the limb scale is used. The species' own blend distances
// below are given in metres (u()).
export const UNIT = 0.3;
const u = (m) => m / UNIT;

export function frogRig(params = {}) {
  const J = frogJoints(params);
  const rig = buildRig({
    joints: J,
    // characteristic length relative to the cheetah: shoulder (scapula top) height 0.054 m / 0.76 m
    unit: UNIT,
    headOrigin: HEAD_O,
    bones: quadrupedBones({
      tailSegs: 0, ears: false, jaw: true,
      extra: [
        ['eye{S}', 'eyeBase{S}', 'eyeTop{S}', 'head', { region: 'head', group: 'eye{S}' }],
        ['throat', 'throatBase', 'throatTip', 'head', { region: 'head', group: 'throat' }],
        ['tongue', 'tongueBase', 'tongueTip', 'jaw', { region: 'jaw', group: 'tongue' }],
      ],
    }),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase'],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis'],
      // no neck: the skull's skin blends into the shoulders over a wide band
      blend: { 1: [u(-0.0084), u(0.0084), 0.5], 2: [u(-0.0042), u(0.0042)], 3: [u(-0.0042), u(0.0042)] },
    },
    limbs: frogLimbs(params),
    appendages: [
      { group: 'eyeL', bone: 'eyeL', blend: [u(-0.0014), u(0.0021)] },
      { group: 'eyeR', bone: 'eyeR', blend: [u(-0.0014), u(0.0021)] },
      { group: 'throat', bone: 'throat', blend: [u(-0.00105), u(0.0021)] },
    ],
    webTags: ['groin', 'thighweb', 'armpit'],
  });
  return rig;
}

// Skin-weight limbs: the standard ones; in the hind limb only the rigid webbed foot is 'distal' (the
// ankle of the frog's Z-folded leg swings as far as its knee and blends as widely).
export function frogLimbs(params = {}) {
  const L = quadrupedLimbs({ front: { tCore: 0.75, aCore: u(0.0035), aBody: u(0.0021), midX: u(0.00028) }, hind: {} });
  const hf = params.hindField || { tCore: 0.15, aCore: u(0.0035), aBody: u(0.0007), midX: u(0.00028) };
  const seg = params.segField || { tCore: 0, aCore: u(0.003), aBody: u(0.0005), midX: u(0.00028) };
  for (const S of ['L', 'R']) {
    const side = S === 'L' ? 1 : -1;
    if (params.splitHind !== true) {
      L['H' + S] = { side, S, front: false, bones: ['femur' + S, 'tibia' + S, 'metatarsus' + S, 'hpaw' + S], proximal: ['femur' + S], distal: ['hpaw' + S], field: { a: 'hip' + S, b: 'knee' + S, top: 'femur' + S, ...hf } };
      continue;
    }
    L['H' + S] = { side, S, front: false, bones: ['femur' + S], proximal: ['femur' + S], distal: [], field: { a: 'hip' + S, b: 'knee' + S, top: 'femur' + S, ...hf } };
    L['H' + S + 's'] = { side, S, front: false, bones: ['tibia' + S], proximal: ['tibia' + S], distal: [], field: { a: 'knee' + S, b: 'hock' + S, top: 'tibia' + S, ...seg } };
    L['H' + S + 'f'] = { side, S, front: false, bones: ['metatarsus' + S, 'hpaw' + S], proximal: ['metatarsus' + S], distal: ['hpaw' + S], field: { a: 'hock' + S, b: 'mtp' + S, top: 'metatarsus' + S, ...seg } };
  }
  return L;
}
