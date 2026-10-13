// Red fox skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
//
// Reference individual: an average adult between the sexes, withers height 0.40 m (M 0.42 / F 0.39),
// nose -> tail base ~0.64 m straight (head-body 0.60-0.68 m), tail vertebrae 0.40 m (+ ~6 cm of brush
// beyond the tip), head 0.165 m occiput -> nose with skin and coat (condylobasal 135-160 mm).
// Limb segments (von den Driesch 1976 / Iberian red fox series): scapula 95, humerus 120,
// radius 122, metacarpus 50, femur 130, tibia 140, metatarsus 62 mm. Standing angles from the side
// photos: elbow under the front of the withers, near-vertical metacarpus, straight thin forelegs,
// moderately angled hind legs with the hock a hand behind the hip. Very narrow front: the forefeet
// stand ~6 cm apart centre to centre (a single-file track), the chest is narrow and keeled.
// The head is modelled level in its own frame (HEAD_O); its carriage comes from the motion data.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 10;
export const HEAD_O = [0, 0.418, 0.352]; // head-local origin (mid cranium, between eyes and ears)
export const HS = 0.66; // head-local scale (landmarks in sculpt.js are for a 0.25 m skull -> 0.165 m)
export const SH = 0.4; // reference withers height
export const MUZZLE_Z0 = 0.035; // head-local z where the muzzle starts (muzzle length variation acts ahead of it)

// head-local -> reference space, with per-individual muzzle length and head width factors
export const hlOf = (m = 1, w = 1) => (v) => [HEAD_O[0] + v[0] * w * HS, HEAD_O[1] + v[1] * HS, HEAD_O[2] + HS * (v[2] > MUZZLE_Z0 ? MUZZLE_Z0 + (v[2] - MUZZLE_Z0) * m : v[2])];

// ear (head-local): big erect triangle (85-110 mm, ~60 % of the head length), set high and fairly
// close, pointing up and a little out, the opening forward
export const EAR = { base: [0.046, 0.048, -0.034], dir: [0.05, 0.118, -0.006] };

export function foxJoints(params = {}) {
  const hl = hlOf(params.muzzle || 1, params.headW || 1);
  const earK = params.ear || 1;
  const ear = hl(EAR.base);
  const hw = params.headW || 1;
  const J = {
    nose: hl([0, -0.014, 0.16]),
    occiput: hl([0, 0.02, -0.095]),
    neckMid: [0, 0.378, 0.27],
    neckBase: [0, 0.335, 0.245],
    chestMid: [0, 0.338, 0.14],
    thoraxRear: [0, 0.345, 0.03],
    lumbarMid: [0, 0.35, -0.065],
    lumbosacral: [0, 0.345, -0.135],
    tailBase: [0, 0.336, -0.19],
    scapTopL: [0.022, 0.372, 0.2],
    shoulderL: [0.038, 0.283, 0.252],
    elbowL: [0.034, 0.19, 0.184],
    wristL: [0.029, 0.067, 0.19],
    mcpL: [0.028, 0.019, 0.197],
    ftoeL: [0.028, 0.0085, 0.222],
    hipL: [0.036, 0.3, -0.168],
    kneeL: [0.046, 0.18, -0.118],
    hockL: [0.035, 0.078, -0.212],
    mtpL: [0.033, 0.019, -0.205],
    htoeL: [0.033, 0.0085, -0.18],
    jawHinge: hl([0, -0.034, -0.03]),
    jawTip: hl([0, -0.057, 0.127]),
    earBaseL: ear,
    earTipL: [ear[0] + EAR.dir[0] * earK * HS * hw, ear[1] + EAR.dir[1] * earK * HS, ear[2] + EAR.dir[2] * earK * HS],
  };
  // bind tail held out behind in a shallow downward curve (the trotting carriage), clear of the
  // hocks; the resting droop and every behaviour come from the motion data
  const tk = (params.tail || 1) * 0.4;
  const w = [1.06, 1.06, 1.05, 1.03, 1.01, 0.99, 0.97, 0.95, 0.94, 0.94], ws = w.reduce((a, b) => a + b, 0);
  tailChain(J, 'tailBase', [-12, -18, -23, -26, -28, -29, -29, -28, -27, -26], w.map((x) => (x / ws) * tk));
  return J;
}

export function foxRig(params = {}) {
  const J = foxJoints(params);
  return buildRig({
    joints: J,
    unit: SH / 0.76,
    headOrigin: HEAD_O,
    bones: quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true }),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the nape and the cheek ruff; wider on the throat
      blend: { 1: [-0.08, 0.17, 3] },
      bodyTail: 0, // the brush hangs behind the thighs: their skin blends into it only at the tail base
    },
    limbs: quadrupedLimbs({
      front: { tCore: 0.55, aCore: 0.04, aBody: -0.07, midX: 0.0 },
      hind: { tCore: 0.52, aCore: 0.022, aBody: -0.045, midX: 0.008 },
    }),
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.003, 0.006] },
      { group: 'earR', bone: 'earR', blend: [-0.003, 0.006] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle'],
  });
}
