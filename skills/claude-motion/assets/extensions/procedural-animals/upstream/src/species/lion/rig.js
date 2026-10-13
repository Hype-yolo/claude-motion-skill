// Lion skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
//
// Reference individual: an average adult between the sexes: withers ~1.07 m over the
// coat, head-body ~1.8 m along the curve, tail ~0.85 m (plus the tuft), skull ~0.32 m.
// Limb segments (museum long bones, x ~0.95 for the reference individual):
// scapula 0.29, humerus 0.32, radius 0.28, metacarpus 0.10, fore digits 0.075; femur 0.37,
// tibia 0.32, tarsus + metatarsus 0.17, hind digits 0.075. Standing angles from side photos
// (side_walk_male3, side_male1): scapula ~60 deg, elbow close under the front of the chest, radius
// near vertical, hock ~0.2 x withers height, metatarsus nearly vertical. Compared with the cheetah the
// lion is shorter in the leg (elbow ~0.39 x withers height vs 0.46), deeper in the chest (brisket at
// ~0.42 x withers height), shorter in the back relative to its height and much heavier in the head.
// The head is modelled level in its own frame (HEAD_O); its carriage comes from the motion data.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';
import { WHISKER_BASE_F, WHISKER_TIP_F } from './whiskers.js';

export const TAIL_SEGS = 10;
export const SH = 1.07; // reference withers height (top of the coat)
export const HEAD_O = [0, 0.95, 0.8]; // head-local origin (mid cranium, between eyes and ears)
export const HS = 1.15; // head-local scale: landmarks below are for a 0.3 m head (x1.15: ~0.35 m over the skin)
export const hl = (v) => [HEAD_O[0] + v[0] * HS, HEAD_O[1] + v[1] * HS, HEAD_O[2] + v[2] * HS];
// Face units (sculpt, rig and coat share them): landmarks measured on the photos are given in units of
// the eye separation E (0.112 head units = 0.129 m on the reference head) from the eye midpoint, in the
// head frame (gaze +Z); X is in units of 0.1 head units times the head width hw (1.12 for a lioness:
// X = 0.5 is the eye), so a male's broader face widens with hw.
export const FACE = { E: 0.112, X: 0.1, EY: 0.047, EZ: 0.05 };
export const fe = (X, Y, Z, hw = 1.12) => hl([X * FACE.X * hw, FACE.EY + Y * FACE.E, FACE.EZ + Z * FACE.E]);
// head-local (x already divided by hw) -> face units
export const toFace = (h) => [h[0] / FACE.X, (h[1] - FACE.EY) / FACE.E, (h[2] - FACE.EZ) / FACE.E];

export function lionJoints() {
  const J = {
    nose: fe(0, -1.0, 1.2),
    occiput: hl([0, 0.02, -0.135]),
    neckMid: [0, 0.949, 0.575],
    neckBase: [0, 0.915, 0.4],
    chestMid: [0, 0.895, 0.22],
    thoraxRear: [0, 0.915, -0.03],
    lumbarMid: [0, 0.925, -0.28],
    lumbosacral: [0, 0.915, -0.52],
    tailBase: [0, 0.915, -0.765], // (high on the croup: the croup curves into the tail, side_walk_male3)
    scapTopL: [0.065, 0.93, 0.29],
    // (elbow ~0.43 x withers, brisket ~0.44: the legs read short for the chest with the elbow at 0.39;
    // the humerus keeps its length, the forearm is longer)
    shoulderL: [0.105, 0.7, 0.43],
    elbowL: [0.1, 0.46, 0.225],
    wristL: [0.08, 0.14, 0.27],
    mcpL: [0.078, 0.05, 0.315],
    ftoeL: [0.078, 0.024, 0.39],
    hipL: [0.09, 0.8, -0.6],
    kneeL: [0.11, 0.46, -0.45],
    hockL: [0.09, 0.215, -0.66],
    mtpL: [0.086, 0.05, -0.62],
    htoeL: [0.086, 0.024, -0.548],
    jawHinge: hl([0, -0.062, -0.04]),
    jawTip: fe(0, -1.42, 0.78),
    // (set out on the side of the crown, so the pinna's outer edge carries on the head's outline down to ~0.3 E above the
    // eye line (face_female1); further in, the ears stood on top of the dome with a notch below them)
    // (the tip ~1.05-1.15 E out and ~1.2 E above the eye line, face_female1 / face_male1: at 1.3-1.4 E out the ears stood on
    // the corners of the head like a mouse's)
    earBaseL: hl([0.106, 0.1, -0.068]),
    // (lower, ~0.25 E: the pinnae stood 1.4 E above the eye line against the photos' 1.1-1.15 with their fur
    // (ffront_*, fprof_*, f34_*), tall round ears on a dome, a plush toy's)
    earTipL: hl([0.152, 0.192, -0.095]), // (the pinna ~9 cm above the skull's side, a little lower than wide at the base)
    // the whisker fan's bone (whiskers.js): from the middle of the pad out to the side
    whiskerBaseL: fe(...WHISKER_BASE_F),
    whiskerTipL: fe(...WHISKER_TIP_F),
    // the upper lip's lower edge from the canine back to the corner of the mouth: drawn back and up with the gape
    // (behaviour.js pose hook), so a roaring or yawning lion bares its upper canines
    lipBaseL: fe(0.42, -1.4, 0.3),
    lipTipL: fe(0.52, -1.4, -0.1),
  };
  // bind tail held out behind and down (clear of the thighs and buttocks so the SDF does not merge
  // them); the relaxed J-hang with the tuft curled up comes from the motion data
  tailChain(J, 'tailBase', [-22, -34, -44, -51, -56, -58, -58, -55, -48, -38], [0.088, 0.088, 0.087, 0.086, 0.085, 0.084, 0.083, 0.082, 0.081, 0.08]);
  return J;
}

export function lionRig() {
  const J = lionJoints();
  return buildRig({
    joints: J,
    unit: SH / 0.76,
    headOrigin: HEAD_O,
    // (+ a whisker bone per side: the whisker fans ride on it, whiskers.js)
    bones: quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true, extra: [['whisker{S}', 'whiskerBase{S}', 'whiskerTip{S}', 'head', { region: 'head', group: 'whisk{S}' }], ['lip{S}', 'lipBase{S}', 'lipTip{S}', 'head', { region: 'head', group: 'lip{S}' }]] }),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the nape, the mane and the throat (3rd value: wider
      // with the skin's distance from the axis under the throat)
      blend: { 1: [-0.09, 0.2, 2.6] },
      bodyTail: 0, // the tail hangs behind the buttocks: their skin blends into it only at the root
    },
    limbs: quadrupedLimbs({
      front: { tCore: 0.55, aCore: 0.05, aBody: -0.12, midX: 0.0 },
      hind: { tCore: 0.52, aCore: 0.035, aBody: -0.11, midX: 0.008 },
    }),
    appendages: [
      // (a wide hand-over from the pinna to the skull: the broad ear base stretched > 3x round its rim
      // when the ear flattened or swivelled)
      { group: 'earL', bone: 'earL', blend: [-0.008, 0.022] },
      { group: 'earR', bone: 'earR', blend: [-0.008, 0.022] },
      // the upper lip's edge (sculpt.js 'lipedge', inside the lip): full weight within ~6 mm of it, none beyond ~3 cm
      { group: 'lipL', bone: 'lipL', blend: [-0.0213, -0.0043] },
      { group: 'lipR', bone: 'lipR', blend: [-0.0213, -0.0043] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle', 'elbowtuft'],
  });
}
