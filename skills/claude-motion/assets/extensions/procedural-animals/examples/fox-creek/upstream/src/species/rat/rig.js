// Brown rat (Rattus norvegicus) skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's
// left = +X.
//
// Reference individual: an average adult (~330 g), head-body 22 cm along the curved back (nose to
// tail base 19 cm straight in the hunched stance), tail 19 cm, back peaking ~8.5 cm over the loins
// (skin), measured from the side reference photos (side1: hind foot 44 mm gives the scale). Limb
// segments from rat osteometry: scapula 22, humerus 28, radius 29, manus 18 (MC 8 +
// digits 10); femur 36, tibia 41, pes 40 (tarsus + MT 27, digits 13) mm. The rat stands crouched:
// knee deeply flexed and tucked against the belly, femur near horizontal, the whole hind sole flat
// on the ground (plantigrade), elbows close to the chest floor, forefeet on the palms.
// The head is modelled level in its own frame (HEAD_O); its low carriage comes from the motion data.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';
import { WHISKER_BASE, WHISKER_TIP } from './whiskers.js';

export const TAIL_SEGS = 12;
export const SH = 0.075; // reference withers height (skin), for rig.unit
// head-local origin: midline, level with the eye centres, above them
// head-local units are scaled by HK (the head was first measured on a smaller skull)
export const HK = 1.12;
export const UP = 0.006; // the torso stands this much higher than the first sculpt (legs show below it)
export const HEAD_O = [0, 0.06 + UP, 0.077];
export const hl = (v) => [HEAD_O[0] + v[0] * HK, HEAD_O[1] + v[1] * HK, HEAD_O[2] + v[2] * HK];
// torso map: raised by UP and shortened behind the withers (the rat's body is compact)
export const T = (p) => [p[0], p[1] + UP, p[2] < 0.019 ? 0.019 + (p[2] - 0.019) * 0.92 : p[2]];
// two-bone joint: the middle joint between a and c with segment lengths l1, l2, bending toward `pole`
function mid(a, c, l1, l2, pole) {
  const d = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const L = Math.min(Math.hypot(...d), (l1 + l2) * 0.999);
  const u = d.map((x) => x / Math.hypot(...d));
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  let q = pole.map((v, i) => v - u[i] * (pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2]));
  const ql = Math.hypot(...q);
  q = q.map((v) => v / ql);
  return [0, 1, 2].map((i) => a[i] + u[i] * x + q[i] * h);
}

export function ratJoints(params = {}) {
  const tk = params.tail || 1;
  const ek = params.ear || 1;
  const J = {
    nose: hl([0, -0.0125, 0.0235]),
    occiput: hl([0, 0.004, -0.026]),
    neckMid: T([0, 0.058, 0.034]),
    neckBase: T([0, 0.06, 0.019]),
    chestMid: T([0, 0.07, 0.0]),
    thoraxRear: T([0, 0.062, -0.03]),
    lumbarMid: T([0, 0.064, -0.055]),
    lumbosacral: T([0, 0.066, -0.071]),
    tailBase: T([0, 0.047, -0.087]),
    // forelimb: scapula sloping forward-down, humerus back-down to the elbow at the chest floor,
    // forearm slanting forward to the wrist just above the ground, palm on the ground
    scapTopL: T([0.013, 0.066, 0.008]),
    shoulderL: T([0.0175, 0.048, 0.033]),
    wristL: [0.019, 0.0065, 0.029],
    mcpL: [0.019, 0.0042, 0.037],
    ftoeL: [0.0195, 0.0018, 0.047],
    // hind limb: femur near horizontal forward-down, knee against the belly, tibia back-down to the
    // heel on the ground, the long sole flat
    hipL: T([0.018, 0.054, -0.055]),
    hockL: [0.0235, 0.0062, -0.042],
    mtpL: [0.024, 0.0045, -0.015],
    htoeL: [0.0245, 0.0018, -0.002],
    snoutBase: hl([0, -0.009, 0.012]),
    jawHinge: hl([0, -0.011, -0.012]),
    jawTip: hl([0, -0.0215, 0.0175]),
    earBaseL: hl([0.0115, 0.009, -0.0195]),
    earTipL: hl([0.0115 + 0.0085 * ek, 0.009 + 0.0185 * ek, -0.0195 - 0.0045 * ek]),
    whiskerBaseL: hl(WHISKER_BASE),
    whiskerTipL: hl(WHISKER_TIP),
  };
  // elbow and knee from the segment lengths (humerus 28, radius 29, femur 36, tibia 41 mm)
  J.elbowL = mid(J.shoulderL, J.wristL, 0.028, 0.029, [0.1, 0, -1]);
  J.kneeL = mid(J.hipL, J.hockL, 0.036, 0.041, [0.12, 0, 1]);
  // bind tail: slopes down from the rump and trails along just above the ground
  tailChain(J, 'tailBase', [-52, -45, -32, -19, -10, -4, -1.5, 0, 0, 0, 0, 1], [0.0145, 0.0148, 0.015, 0.0155, 0.016, 0.016, 0.016, 0.016, 0.016, 0.016, 0.016, 0.0155].map((l) => l * tk));
  return J;
}

export function ratRig(params = {}) {
  const J = ratJoints(params);
  return buildRig({
    joints: J,
    unit: SH / 0.76,
    headOrigin: HEAD_O,
    // + snout (nose leather, whisker pads: the sniffing twitch) and a whisker bone per side
    bones: quadrupedBones({
      tailSegs: TAIL_SEGS, ears: true, jaw: true,
      extra: [
        ['snout', 'snoutBase', 'nose', 'head', { region: 'head', group: 'snout' }],
        ['whisker{S}', 'whiskerBase{S}', 'whiskerTip{S}', 'head', { region: 'head', group: 'whisk{S}' }],
      ],
    }),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull reaches back into the thick nape (no visible neck), wider under the throat
      blend: { 1: [-0.2, 0.3, 2.5], 2: [-0.12, 0.12] },
      bodyTail: 0,
    },
    limbs: quadrupedLimbs({
      front: params.frontField || { tCore: 0.9, aCore: 0.07, aBody: 0.05, midX: 0.0 },
      hind: params.hindField || { tCore: 1.0, aCore: 0.12, aBody: 0.1, midX: 0.01 },
    }),
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.03, 0.05] },
      { group: 'earR', bone: 'earR', blend: [-0.03, 0.05] },
      { group: 'snout', bone: 'snout', blend: [-0.004, 0.01] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle'],
  });
}
