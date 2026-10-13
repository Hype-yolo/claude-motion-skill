// Goat skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
// Reference individual: a Saanen-type dairy doe, 0.78 m at the withers, ~65 kg (ADGA standard). Landmarks measured on side3.jpg (4x grid, 1 px = 1.39 mm) and side2.jpg
// (1 px = 1.84 mm), limb segments from published goat osteometry.
//
// Hooves: the standard quadruped bones plus a hoof bone per leg, exactly like the horse:
// fpaw / hpaw = pastern (fetlock -> coffin joint), fhoof / hhoof = the cloven hoof (coffin joint ->
// toe), so the engine keeps the claws flat while the fetlock sinks under load.
//
// The rig depends on the individual only through the ears (erect / lateral in Swiss breeds, long and
// pendulous in the Nubian: params.ear).
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 5;
// a lop ear's root blend: the ear takes the skin up to 3 cm onto the head and down to 5 cm along the ear (it hangs with
// gravity, turning up to 25 deg about its root against the skull: at [-0.006, 0.02] the root and the web between the
// blade and the cheek stretched 3x on 1 % more of the mesh when grazing)
export const LOPBL = [-0.03, 0.05];

// Head frame: modelled along its own axis (poll -> muzzle), pitched 42 degrees nose-down in the
// bind pose. Head-local coordinates: x lateral, y dorsal (forehead side), z along the nasal line toward
// the muzzle; origin on the axis 0.07 m in front of the poll, level with the eyes.
// (side2 and walk1: the eye -> nose-tip line runs 33-34 deg below the horizontal and the forehead
// 51-60 deg; the poll stands ~0.3 SH above the withers, the neck rises at ~55-64 deg. The head was
// carried at 54 deg with the forehead profile at 68 deg, 5-7 cm low: a grazing horse's carriage)
export const HEAD_PITCH = (42 * Math.PI) / 180;
export const HZ = [0, -Math.sin(HEAD_PITCH), Math.cos(HEAD_PITCH)];
export const HY = [0, Math.cos(HEAD_PITCH), Math.sin(HEAD_PITCH)];
const POLL = [0, 0.975, 0.59]; // top of the poll (skin), bind
export const HEAD_O = [0, POLL[1] + 0.07 * HZ[1], POLL[2] + 0.07 * HZ[2]];
export const hl = (v) => [HEAD_O[0] + v[0], HEAD_O[1] + v[1] * HY[1] + v[2] * HZ[1], HEAD_O[2] + v[1] * HY[2] + v[2] * HZ[2]];
// a kid's face is short: in front of the eyes the head-local z (along the nasal line) is compressed by
// KID_FACE (front2, kid_side: a big braincase and eyes over a short, small muzzle; the whole head scaled
// up gave a kid an adult's bulbous muzzle). faceZ maps an adult head-local z to the kid's, unFaceZ back.
export const KID_FACE = 0.78;
export const faceZ = (z, kid) => (kid && z > 0.02 ? 0.02 + (z - 0.02) * KID_FACE : z);
export const unFaceZ = (z, kid) => (kid && z > 0.02 ? 0.02 + (z - 0.02) / KID_FACE : z);
// head-local point (adult coordinates) -> world, with the kid's short face
export const hlk = (v, kid) => hl([v[0], v[1], faceZ(v[2], kid)]);
// head-local direction -> world
export const hdir = (v) => [v[0], v[1] * HY[1] + v[2] * HZ[1], v[1] * HY[2] + v[2] * HZ[2]];
// world point -> head-local
export const toHL = (p) => { const d = [p[0] - HEAD_O[0], p[1] - HEAD_O[1], p[2] - HEAD_O[2]]; return [d[0], d[1] * HY[1] + d[2] * HY[2], d[1] * HZ[1] + d[2] * HZ[2]]; };

// ear tips (head-local, left): Swiss erect / lateral ears point out, a little up and forward;
// Nubian / Boer lop ears hang straight down beside the face (their tip is placed in world space
// below the base, clear of the cheek: see goatJoints)
export const EAR_BASE = [0.048, 0.026, -0.06];
export const EAR_TIP = {
  erect: [0.2, 0.015, -0.02],
};
// the hindquarters (hip joint, hind limb, pelvis, tail root, udder) sit this far further forward than
// the first model: side1 / side2 give a body (point of shoulder -> point of buttock) of 1.06-1.09 SH,
// the model had 1.24 SH, its hip points, tail head and buttock 10-18 cm behind side2's
// (adults 0.07, not 0.095: the hind hooves stood 0.17 SH ahead of the rump's outline at the toe, against
// 0.06-0.12 in side2 / side3; now 0.14 at the toe, 0.05 at the heel, the cannons under the pin bones. Kids keep
// 0.095: their hind legs stand under the short body, kid_side, and with them further back the Nubian kid's
// sprint jittered at the wrist, p99 0.086 % S)
export const hqOf = (params = {}) => (params.age === 'juvenile' ? 0.095 : 0.07);

export function goatJoints(params = {}) {
  // (erect ears: carried from level-lateral (face3) to up-and-out (face1), params.earLift 0..1)
  const lop = params.ear === 'lop';
  const kid = params.age === 'juvenile';
  // (kids carry their big ears up and out: front2, kid_side)
  const lift = kid ? Math.max(0.6, params.earLift ?? 0.5) : (params.earLift ?? 0.5);
  const HQ = hqOf(params);
  const J = {
    nose: hlk([0, -0.024, 0.205], kid), // (the front of the nose pad and upper lip: the engine keeps it off the ground)
    occiput: hl([0, -0.045, -0.1]), // (behind the poll and the horn bases: the skull top is all 'head')
    neckMid: [0, 0.8, 0.472],
    neckBase: [0, 0.64, 0.35],
    chestMid: [0, 0.668, 0.17],
    thoraxRear: [0, 0.692, 0.015],
    lumbarMid: [0, 0.702, -0.1],
    lumbosacral: [0, 0.707, -0.215],
    tailBase: [0, 0.71, -0.4],
    // fore: scapula sloping ~65 deg, humerus down and back (45 deg from vertical), radius and cannon
    // vertical, pastern ~50 deg (cloven hoof)
    // (the elbow 1.7 cm further back: with the humerus 40 deg from vertical the shoulder -> wrist span was
    // 93 % of humerus + radius, the engine's reach limit left the foreleg a 0.45 m stance sweep against
    // the hind leg's 0.75 m, and it cut the fore stances short: duty 0.53 / 0.34 / 0.20 at the walk,
    // trot and gallop against the table's 0.65 / 0.42 / 0.29, a high hackney flick and pacing walk)
    scapTopL: [0.055, 0.745, 0.265],
    shoulderL: [0.088, 0.53, 0.372],
    elbowL: [0.083, 0.405, 0.245],
    wristL: [0.07, 0.21, 0.252],
    mcpL: [0.064, 0.07, 0.256],
    fcoffinL: [0.064, 0.03, 0.279],
    ftoeL: [0.064, 0.002, 0.323],
    // hind: hip joint, stifle, hock, fetlock, coffin joint, toe (the cannon vertical: it stood 6 deg
    // forward, sickle-hocked)
    hipL: [0.078, 0.63, -0.36 + HQ],
    kneeL: [0.093, 0.45, -0.24 + HQ],
    hockL: [0.066, 0.25, -0.44 + HQ],
    mtpL: [0.06, 0.075, -0.442 + HQ],
    hcoffinL: [0.06, 0.031, -0.419 + HQ],
    htoeL: [0.06, 0.002, -0.374 + HQ],
    jawHinge: hl([0, -0.045, -0.02]),
    jawTip: hlk([0, -0.078, 0.185], kid),
    // (a lop ear's root sits further back on the skull: hanging from the erect ear's root, the broad blade
    // covered the eye)
    earBaseL: hl(lop ? [EAR_BASE[0], EAR_BASE[1] - 0.006, EAR_BASE[2] - 0.01] : EAR_BASE),
    // udder (does): its own rigid bone below the pelvis, so it can fold up out of the ground when the
    // doe lies down (hooks.pose)
    // beard: its own bone below the chin (hangs from the jaw; hooks.pose swings it out of the ground)
    beardTop: hlk([0, -0.094, 0.115], kid),
    udderTop: [0, 0.44, -0.34 + HQ],
    udderBot: [0, 0.3, -0.325 + HQ],
  };
  // lop ears (Nubian, Boer): long and broad, hanging down beside the face and jaw from the base, flaring out
  // to 9 cm from the root at the tip and a little back of vertical, so the blade stays behind the eye (side_boer,
  // the Nubian standard; hanging straight down with the face pitched 42 deg nose-down it covered the eye) and
  // clear of the throat (within the 2 cm blend of the throat skin it took neck weights and stretched)
  const eb = J.earBaseL;
  // (a kid's lop ears are shorter: its head is scaled up as a whole, and full-length ears hung below its knees)
  // (Nubian ears ~25 cm, reaching below the jaw; a Boer's a little shorter: at 21 cm they ended at the
  // mouth corner, short paddles)
  const le = (kid ? 0.82 : 1) * (params.variant === 'boer' ? 0.9 : 1);
  J.earTipL = lop ? [eb[0] + 0.1 * le, eb[1] - 0.225 * le, eb[2] - 0.05 * le]
    : hl([EAR_TIP.erect[0] - 0.02 * lift, EAR_TIP.erect[1] - 0.03 + 0.11 * lift, EAR_TIP.erect[2] + 0.02 * lift]);
  // (a kid's erect ears are long for its head: as long as its face, front2)
  if (kid && !lop) for (let i = 0; i < 3; i++) J.earTipL[i] = eb[i] + (J.earTipL[i] - eb[i]) * 1.15;
  J.beardTip = [J.beardTop[0], J.beardTop[1] - Math.max(0.03, params.beard || 0), J.beardTop[2] - 0.01];
  // the short flat tail is carried up (research: erect most of the time)
  tailChain(J, 'tailBase', [28, 42, 55, 62, 66], [0.035, 0.032, 0.03, 0.028, 0.026]);
  return J;
}

export function goatBones() {
  const b = quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true });
  for (const d of b) {
    if (d[0] === 'fpaw{S}') { d[2] = 'fcoffin{S}'; d[4] = { region: 'limb', group: 'F{S}' }; }
    if (d[0] === 'hpaw{S}') { d[2] = 'hcoffin{S}'; d[4] = { region: 'limb', group: 'H{S}' }; }
  }
  b.push(['udder', 'udderTop', 'udderBot', 'pelvis', { region: 'torso', group: 'udder' }]);
  b.push(['beard', 'beardTop', 'beardTip', 'jaw', { region: 'jaw', group: 'jaw' }]);
  b.push(
    ['fhoof{S}', 'fcoffin{S}', 'ftoe{S}', 'fpaw{S}', { region: 'foot', group: 'F{S}' }],
    ['hhoof{S}', 'hcoffin{S}', 'htoe{S}', 'hpaw{S}', { region: 'foot', group: 'H{S}' }],
  );
  return b;
}

export function goatRig(params = {}, J = goatJoints(params)) {
  const limbs = quadrupedLimbs({
    front: { tCore: 0.5, aCore: 0.05, aBody: -0.15, midX: 0.0 },
    hind: { tCore: 0.45, aCore: 0.022, aBody: -0.11, midX: 0.008 },
  });
  for (const L of Object.values(limbs)) { L.bones.push((L.front ? 'fhoof' : 'hhoof') + L.S); L.distal.push((L.front ? 'fhoof' : 'hhoof') + L.S); }
  return buildRig({
    joints: J,
    unit: 1.03,
    headOrigin: HEAD_O,
    bones: goatBones(),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the throat (widening with the depth below the axis)
      // (a narrower lever, 0.5, kept the cheek out of the blend but gathered the stretch at the jaw angle:
      // fewer triangles over 2x, more over 3x; the throat stretch is cured in the poses instead, the grazing
      // head pitch and a kid's short face, see motion.js and rig.js faceZ)
      // (the neck base blends over 8 cm each side: the skin over the withers stretched 3x when the head went
      // down or round to the flank)
      // (15 cm: at 8 cm the skin over the withers bent over a ridge when the neck went down to graze; the Boer
      // keeps 11 cm: wider, its broad chest front took neck weights, and lying dead it rested 11 mm in the
      // ground, and its red / white border across the lower neck stretched)
      blend: { 1: [-0.05, 0.14, 4.5], 3: params.variant === 'boer' ? [-0.11, 0.11, 0] : [-0.15, 0.15, 0] },
      bodyTail: 0, // (the rump and buttocks do not blend into the tail: they tore when the thighs folded to lie down)
    },
    limbs,
    appendages: [
      // (a long lop ear swings about its root as the head moves: its root blends over 2.6 cm, where an
      // erect ear's took 6 mm and tore; reaching 1 cm onto the head it dragged the skin behind the root)
      { group: 'earL', bone: 'earL', blend: params.ear === 'lop' ? LOPBL : [-0.002, 0.004] },
      { group: 'earR', bone: 'earR', blend: params.ear === 'lop' ? LOPBL : [-0.002, 0.004] },
      { group: 'udder', bone: 'udder', blend: [-0.004, 0.02] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle', 'pectoral', 'forearmweb'],
  });
}
