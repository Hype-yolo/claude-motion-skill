// Domestic cat skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
//
// Reference individual: an average adult domestic shorthair (~4 kg), withers (skin) ~0.245 m, nose to
// tail base ~0.46 m along the body, tail ~0.29 m. Limb segments scaled from cat osteometry:
// scapula ~0.065, humerus ~0.08, radius ~0.083, metacarpus ~0.025 (joint centres), femur ~0.088,
// tibia ~0.1, metatarsus ~0.048 m; the hind limb is ~20 % longer than the fore limb. A cat stands on
// sprung, half-flexed legs: elbow at the chest floor (~0.12 m), heel ~0.058 m above the ground,
// stifle tucked forward under the flank. The head is modelled level in its own frame (HEAD_O); its
// carriage comes from the motion data.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';
import { WHISKER_BASE, WHISKER_TIP } from './whiskers.js';

export const TAIL_SEGS = 10;
export const SH = 0.245; // reference withers height (skin)
export const HEAD_O = [0, 0.238, 0.184]; // head-local origin: between the eyes, at eye level, just behind them
export const hl = (v) => [HEAD_O[0] + v[0], HEAD_O[1] + v[1], HEAD_O[2] + v[2]];

export function catJoints(params = {}) {
  const tk = params.tail || 1;
  const J = {
    nose: hl([0, -0.019, 0.046]),
    occiput: hl([0, -0.004, -0.038]),
    neckMid: [0, 0.21, 0.13],
    neckBase: [0, 0.186, 0.102],
    chestMid: [0, 0.19, 0.052],
    thoraxRear: [0, 0.194, -0.012],
    lumbarMid: [0, 0.197, -0.07],
    lumbosacral: [0, 0.195, -0.122],
    tailBase: [0, 0.188, -0.172],
    scapTopL: [0.021, 0.221, 0.074],
    shoulderL: [0.033, 0.166, 0.103],
    // (standing, the forearm is a vertical column under the elbow and the paw sits under the chest, ~5 cm behind
    // the shoulder joint (side1, side3; the paw 2.9 cm ahead of the elbow stood the forelegs like a sawhorse's);
    // the humerus 7.8 cm at ~54 deg from the vertical (research: 10 cm): the foreleg reaches far enough to carry
    // the walk's stance (with a 7.5 cm humerus the standing leg was nearly straight and swept ~17 of 27 cm; with the
    // elbow 0.5 cm further back still, the armpit skin stretched more in walking turns for no more stance)
    elbowL: [0.03, 0.12, 0.04],
    wristL: [0.027, 0.037, 0.043],
    mcpL: [0.027, 0.0125, 0.051],
    ftoeL: [0.027, 0.005, 0.068],
    hipL: [0.032, 0.176, -0.134],
    kneeL: [0.0396, 0.1062, -0.08], // (femur 8.9, tibia 10.2 cm: +5 %)
    hockL: [0.033, 0.058, -0.17],
    // (the cannon nearly vertical under the hock: side1)
    mtpL: [0.03, 0.0125, -0.165],
    htoeL: [0.03, 0.005, -0.148],
    jawHinge: hl([0, -0.019, -0.012]),
    jawTip: hl([0, -0.031, 0.03]),
    // the pinna sits on the upper corner of the skull: its base runs from beside the crown (~11 mm from
    // the midline, ~30 mm above the eyes) down to the side of the head (~45 mm out, ~12 mm up), the tip
    // ~44 mm above the middle of the base (the pinna 4.5-5 cm tall: research, face1 ~1.2 IPD), leaning out
    // ~27 deg (frontal photos: tips ~45 mm out, ~57 up)
    earBaseL: hl([0.0275, 0.022, -0.012]),
    earTipL: hl([0.047, 0.061, -0.0195]),
    whiskerBaseL: hl(WHISKER_BASE),
    whiskerTipL: hl(WHISKER_TIP),
  };
  // bind tail: carried out behind with a gentle droop and a slight lift at the tip, clear of the
  // hocks and the buttocks (the carriage tables pose it: question mark, low hang, wrapped round the feet)
  tailChain(J, 'tailBase', [-9, -18, -24, -27, -28, -26, -22, -15, -8, 0], [0.033, 0.032, 0.031, 0.03, 0.029, 0.029, 0.028, 0.027, 0.026, 0.025].map((l) => l * tk));
  return J;
}

export function catRig(params = {}) {
  const J = catJoints(params);
  return buildRig({
    joints: J,
    unit: SH / 0.76,
    headOrigin: HEAD_O,
    // (+ a whisker bone per side: the whisker fans ride on it, see whiskers.js)
    bones: quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true, extra: [['whisker{S}', 'whiskerBase{S}', 'whiskerTip{S}', 'head', { region: 'head', group: 'whisk{S}' }]] }),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the big round skull's influence reaches back into the nape and the throat
      // (a kitten: a blend that ends at neckMid. The core applies a joint's blend only inside its two segments, so the
      // adult's lever-widened occiput blend stops at neckMid: the throat's head share drops from ~0.4 to 0 along the
      // neckMid line, and the kitten's big head on its short, S-carried neck folded the throat skin there, under the chin
      // in view (back faces in the 'holes' view). On adults the same fold lies under the jaw, out of view, and the wide
      // throat blend keeps the throat's stretch in sleep and death in budget.)
      blend: params.juv ? { 1: [-0.07, 0.085, 0], 2: [-0.035, 0.035, 0.3] } : { 1: [-0.1, 0.16, 4] },
      bodyTail: 0, // the tail hangs down behind the hocks: thigh skin blends into it only at the root
    },
    limbs: quadrupedLimbs({
      front: { tCore: 0.55, aCore: 0.07, aBody: -0.24, midX: 0.0 },
      hind: { tCore: 0.5, aCore: 0.05, aBody: -0.13, midX: 0.008 },
    }),
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.005, 0.011] },
      { group: 'earR', bone: 'earR', blend: [-0.005, 0.011] },
      // (sculpt.js LIPS: the lips and jowls ride on the head with the jaw; blended over [-32, 19] mm x unit: with [-16, 10] the
      // head / neck2 shares behind the jowl changed by ~0.08 per 2 mm, the head and body surfaces' smoothed weights differed
      // there by 0.05-0.07, and in the death pose and sleep they parted by 2.8-3.6 mm at the hand-over (regions.js
      // harmonizeSeamWeights): a hard edge across the cheek)
      { group: 'lips', bone: 'head', blend: [-0.1, 0.06] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle'],
  });
}
