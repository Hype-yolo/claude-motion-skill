// Domestic dog skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
//
// Reference individual: a medium shepherd-type dog between the sexes, withers height 0.60 m
// (German shepherd M 0.60-0.65 / F 0.55-0.60, FCI 166), body (point of shoulder -> buttock)
// ~1.15 x withers height, head 0.25 m (~40 % of the withers height).
// Limb segments (Fischer & Lilje 2011, Miller's Anatomy; shepherd ratios to SH):
// scapula 0.25, humerus 0.29, radius 0.30, metacarpus 0.11, femur 0.31, tibia 0.32, metatarsus 0.12.
//
// Every variant is modelled at this reference scale and brought to its own size by params.size
// (retriever ~0.93, terrier ~0.47): the variant changes the skeleton here (topline, hind angulation,
// tail set and length, ears) and the sculpt; broader or shorter-legged builds and head size are
// proportion warps (index.js). The head is modelled level in its own frame (HEAD_O); its carriage
// comes from the motion data.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 8;
export const HEAD_O = [0, 0.622, 0.562]; // head-local origin (mid cranium, between eyes and ears)
export const HS = 1.0; // head-local scale (landmarks below are for a 0.25 m skull)
export const SH = 0.6; // reference withers height
export const MUZZLE_Z0 = 0.04; // head-local z where the muzzle starts (muzzle length variation acts ahead of it)

// head-local -> reference space, with per-individual muzzle length and head width factors
export const hlOf = (m = 1, w = 1) => (v) => [HEAD_O[0] + v[0] * w * HS, HEAD_O[1] + v[1] * HS, HEAD_O[2] + HS * (v[2] > MUZZLE_Z0 ? MUZZLE_Z0 + (v[2] - MUZZLE_Z0) * m : v[2])];

// ear bone (base -> tip, head-local) by ear type:
//  prick  (shepherd): tall erect triangle, slightly outward and back
//  drop   (retriever): pendant flap hanging from the fold at the top of the skull down the cheek
//  button (terrier, shepherd pups): rises a little, the flap folds forward over the ear opening
export const EAR = {
  prick: { base: [0.04, 0.045, -0.037], dir: [0.034, 0.116, -0.012] },
  drop: { base: [0.05, 0.036, -0.026], dir: [0.026, -0.08, 0.034] },
  button: { base: [0.043, 0.047, -0.036], dir: [0.028, -0.004, 0.04] },
};

// per-variant skeleton changes (reference scale): axial heights and hind limb
const BODY = {
  // sloping topline, long well-angulated hind legs (hock well behind the croup), low-set tail
  shepherd: {
    lumbarMid: [0, 0.505, -0.1], lumbosacral: [0, 0.488, -0.205], tailBase: [0, 0.468, -0.285],
    hip: [0.056, 0.41, -0.24], knee: [0.07, 0.245, -0.165], hock: [0.055, 0.105, -0.318], mtp: [0.052, 0.03, -0.305], htoe: [0.052, 0.012, -0.267],
    tail: { ang: [-20, -32, -40, -45, -47, -47, -45, -41], len: 0.39 },
  },
  // level topline, moderate angulation, thick otter tail set on level with the back
  retriever: {
    lumbarMid: [0, 0.512, -0.095], lumbosacral: [0, 0.505, -0.195], tailBase: [0, 0.498, -0.27],
    hip: [0.058, 0.425, -0.23], knee: [0.072, 0.252, -0.158], hock: [0.056, 0.105, -0.295], mtp: [0.053, 0.03, -0.283], htoe: [0.053, 0.012, -0.245],
    tail: { ang: [-10, -16, -20, -23, -25, -26, -26, -25], len: 0.36 },
  },
  // square, level, straight hind legs, tail set high and carried erect
  terrier: {
    lumbarMid: [0, 0.515, -0.09], lumbosacral: [0, 0.51, -0.185], tailBase: [0, 0.505, -0.255],
    hip: [0.056, 0.43, -0.215], knee: [0.068, 0.26, -0.145], hock: [0.054, 0.108, -0.268], mtp: [0.051, 0.03, -0.258], htoe: [0.051, 0.012, -0.22],
    tail: { ang: [38, 52, 62, 68, 70, 70, 68, 64], len: 0.3 },
    // (a little more bend in the standing foreleg: reach to spare for the quick steps of a small dog)
    scapTop: [0.034, 0.53, 0.255], shoulder: [0.06, 0.398, 0.333], elbow: [0.054, 0.264, 0.232],
  },
};

export function dogJoints(params = {}) {
  const V = BODY[params.variant] || BODY.shepherd;
  const hl = hlOf(params.muzzle || 1, params.headW || 1);
  const earK = params.ear || 1;
  const E = EAR[params.earType || 'prick'];
  const ear = hl(E.base);
  const J = {
    nose: hl([0, -0.014, 0.158]),
    occiput: hl([0, 0.02, -0.095]),
    neckMid: [0, 0.556, 0.405],
    neckBase: [0, 0.5, 0.33],
    chestMid: [0, 0.51, 0.17],
    thoraxRear: [0, 0.514, 0.02],
    lumbarMid: V.lumbarMid,
    lumbosacral: V.lumbosacral,
    tailBase: V.tailBase,
    scapTopL: V.scapTop || [0.034, 0.54, 0.255],
    shoulderL: V.shoulder || [0.06, 0.41, 0.335],
    elbowL: V.elbow || [0.054, 0.27, 0.238],
    wristL: [0.047, 0.1, 0.247],
    mcpL: [0.046, 0.029, 0.259],
    ftoeL: [0.046, 0.012, 0.299],
    hipL: V.hip,
    kneeL: V.knee,
    hockL: V.hock,
    mtpL: V.mtp,
    htoeL: V.htoe,
    jawHinge: hl([0, -0.034, -0.03]),
    jawTip: hl([0, -0.06, 0.13]),
    // tongue (rigid, rides on the jaw): lies in the floor of the mouth, slides out to pant and lap
    tongueBase: hl([0, -0.046, 0.02]),
    tongueTip: hl([0, -0.05, 0.118]),
    earBaseL: ear,
    earTipL: [ear[0] + E.dir[0] * earK * HS * (params.headW || 1), ear[1] + E.dir[1] * earK * HS, ear[2] + E.dir[2] * earK * HS],
  };
  const tk = (params.tail || 1) * V.tail.len;
  // segment lengths taper toward the tip (sum = tk)
  const w = [1.14, 1.09, 1.04, 0.99, 0.95, 0.91, 0.86, 0.82], ws = w.reduce((a, b) => a + b, 0);
  tailChain(J, 'tailBase', V.tail.ang, w.map((x) => (x / ws) * tk));
  return J;
}

export function dogRig(params = {}) {
  const J = dogJoints(params);
  return buildRig({
    joints: J,
    unit: SH / 0.76,
    headOrigin: HEAD_O,
    bones: quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true, extra: [['tongue', 'tongueBase', 'tongueTip', 'jaw', { region: 'jaw', group: 'jaw' }]] }),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the nape; wider on the throat side (3rd value)
      blend: { 1: [-0.09, 0.18, 3] },
      // (core weights.js `cascade`: the skull's throat lever reaches past the mid-neck joint, where the default cut its
      // share off: carried high, the head bunched the throat skin into a fold along that line, and the ruff's shells
      // drew it as a crisp line round the throat. Faded out over the next segment instead)
      cascade: { 1: 0.25 },
      // a hanging tail (shepherd) lies behind the thighs: body skin blends into it only at its base
      bodyTail: params.variant === 'terrier' ? 1 : 0,
    },
    limbs: quadrupedLimbs({
      front: { tCore: 0.55, aCore: 0.04, aBody: -0.07, midX: 0.0 },
      hind: { tCore: 0.52, aCore: 0.022, aBody: -0.045, midX: 0.008 },
    }),
    // (soft drop / button ears hinge over a wider fold)
    appendages: ['L', 'R'].map((S) => ({ group: 'ear' + S, bone: 'ear' + S, blend: params.earType === 'prick' || !params.earType ? [-0.003, 0.006] : [-0.006, 0.01] })),
    webTags: ['flankfold', 'thighfront', 'scapmuscle'],
  });
}
