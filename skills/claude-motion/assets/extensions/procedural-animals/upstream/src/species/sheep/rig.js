// Sheep skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
// Reference individual: a white-faced medium-wool ewe (Dorset / Cheviot / Texel type), 0.70 m at the
// withers (skeleton, without the fleece), ~70 kg. Landmarks measured on
// side2.jpg (1 px = 1.67 mm), side3_texel.jpg (shorn: nose -> buttock 1.73 SH, belly 0.39 SH, head
// 0.37 SH) and the research limb table (sheep have long cannons, short forearms).
//
// Hooves: the standard quadruped bones plus a hoof bone per leg, exactly like the horse and the goat:
// fpaw / hpaw = pastern (fetlock -> coffin joint), fhoof / hhoof = the cloven hoof (coffin joint ->
// toe), so the engine keeps the claws flat while the fetlock sinks under load.
//
// The rig depends on the individual through the ears (lateral and horizontal; long and drooping in
// the Suffolk: params.ear) and the tail (long, hanging to the hocks, or docked: params.tail).
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs, tailChain } from '../../core/rig/quadruped.js';

export const TAIL_SEGS = 6;

// Head frame: modelled along its own axis (poll -> muzzle), pitched 37 degrees nose-down in the
// bind pose; the dorsal line falls a further 11 degrees from the axis toward the nose (sculpt.js topY),
// so the nasal line stands 48 degrees to the ground (side2: 46 deg). (At 48 degrees for the axis, the
// nasal line stood at 59: a face hanging straight down from a high dome, the "boot".) Head-local
// coordinates: x lateral, y dorsal (forehead side), z along the axis toward the muzzle; origin on the
// axis 0.07 m in front of the poll, level with the eyes.
export const HEAD_PITCH = (33 * Math.PI) / 180;
export const HZ = [0, -Math.sin(HEAD_PITCH), Math.cos(HEAD_PITCH)];
export const HY = [0, Math.cos(HEAD_PITCH), Math.sin(HEAD_PITCH)];
const POLL = [0, 0.895, 0.54]; // top of the poll (skin), bind
export const HEAD_O = [0, POLL[1] + 0.07 * HZ[1], POLL[2] + 0.07 * HZ[2]];
export const hl = (v) => [HEAD_O[0] + v[0], HEAD_O[1] + v[1] * HY[1] + v[2] * HZ[1], HEAD_O[2] + v[1] * HY[2] + v[2] * HZ[2]];
// head-local direction -> world
export const hdir = (v) => [v[0], v[1] * HY[1] + v[2] * HZ[1], v[1] * HY[2] + v[2] * HZ[2]];

// ears (head-local, left): carried out to the sides and swept back, so the leaf reads from the side as well
// as from the front (front1, face1, side4_suffolk, extra/Suffolk_sheep_20790901685, Tete_de_brebie_Suffolk:
// "aeroplane" ears seen from the front, a long blade reaching back past the poll seen from the side). Given
// as a world direction in the bind pose (back = degrees swept back from straight out, down = degrees below
// level) and a length; the Suffolk's are longer and hang a little; the Merino's smaller. (Straight out to
// the sides, an ear seen from the side was only its foreshortened stalk: a stub against the poll.)
// (At 40-46 deg back with the blade on edge, the ear read as a pink cup standing up from the side and a
// paddle behind the poll. At 32-36 deg back the near ear, seen from the side, was still a short
// pink cup over the poll (its length foreshortened) and the far ear a paddle; now 46-48 deg back (Suffolk 40)
// and 20 deg below level (side2: the ear a leaf held level, pointing back, its inside showing), the blade's
// turn in sculpt.js.)
export const EAR_BASE = [0.056, 0.006, -0.058]; // (at the top corners of the head, behind the eyes)
export const EAR_SET = {
  lateral: { back: 46, down: 20, len: 0.135 },
  droop: { back: 40, down: 28, len: 0.152 },
  small: { back: 48, down: 14, len: 0.112 },
};
// world direction (bind) -> head-local
const toLocal = (d) => [d[0], d[1] * HY[1] + d[2] * HY[2], d[1] * HZ[1] + d[2] * HZ[2]];
export function earTip(params = {}, base = EAR_BASE) {
  const E = EAR_SET[params.ear] || EAR_SET.lateral;
  // (a horned ram's ear comes out under the horn's sweep: less swept back, or it runs into the coil)
  const back = (params.horns && params.horns.turns > 0.3 ? 0.35 : 1) * E.back * Math.PI / 180;
  const down = (E.down + 14 * ((params.earLift ?? 0.5) - 0.5)) * Math.PI / 180;
  const d = toLocal([Math.cos(down) * Math.cos(back), -Math.sin(down), -Math.cos(down) * Math.sin(back)]);
  const L = E.len;
  return [base[0] + d[0] * L, base[1] + d[1] * L, base[2] + d[2] * L];
}

// tail: long (undocked, to the hocks) or docked (a short stump)
export function tailSpec(params = {}) {
  const L = params.tailLen ?? 0.34;
  const w = [0.2, 0.19, 0.17, 0.16, 0.14, 0.14];
  const long = L > 0.15;
  return {
    len: L,
    lens: w.map((f) => f * L),
    pitch: long ? [-38, -64, -76, -82, -86, -88] : [-28, -45, -55, -60, -62, -64],
  };
}

export function sheepJoints(params = {}) {
  const earB = params.horns && params.horns.turns > 0.3 ? [0.05, 0.002, -0.066] : EAR_BASE;
  const J = {
    nose: hl([0, -0.014, 0.195]), // (the front of the nose pad and upper lip: the engine keeps it off the ground)
    occiput: hl([0, -0.045, -0.1]), // (behind the poll and horn bases: the skull top is all 'head')
    neckMid: [0, 0.715, 0.425],
    neckBase: [0, 0.555, 0.285],
    chestMid: [0, 0.585, 0.13],
    thoraxRear: [0, 0.61, -0.03],
    lumbarMid: [0, 0.622, -0.17],
    lumbosacral: [0, 0.625, -0.3],
    tailBase: [0, 0.612, -0.47],
    // fore: scapula sloping ~60 deg, humerus down and back, forearm and cannon vertical, pastern ~50
    // deg (research: humerus 0.17, radius 0.18, cannon 0.13)
    scapTopL: [0.056, 0.668, 0.21],
    shoulderL: [0.086, 0.49, 0.305],
    elbowL: [0.08, 0.345, 0.215],
    wristL: [0.068, 0.185, 0.232],
    mcpL: [0.062, 0.064, 0.238],
    fcoffinL: [0.062, 0.028, 0.258],
    ftoeL: [0.062, 0.002, 0.3],
    // hind: hip joint, stifle, hock, fetlock, coffin joint, toe (femur 0.20, tibia 0.23, cannon 0.15)
    hipL: [0.076, 0.555, -0.33],
    kneeL: [0.09, 0.385, -0.215],
    hockL: [0.064, 0.215, -0.385],
    mtpL: [0.058, 0.066, -0.365],
    hcoffinL: [0.058, 0.029, -0.343],
    htoeL: [0.058, 0.002, -0.3],
    jawHinge: hl([0, -0.045, -0.02]),
    jawTip: hl([0, -0.064, 0.189]), // (the front of the lower lip: the mouth the engine puts on the ground)
    // (horned rams: the ears come out below and behind the horn bases)
    earBaseL: hl(earB),
    earTipL: hl(earTip(params, earB)),
    // udder (ewes) / scrotum (rams): its own rigid bone below the pelvis, so it can fold up out of the
    // ground when the sheep lies down (hooks.pose)
    udderTop: [0, 0.4, -0.3],
    udderBot: [0, 0.27, -0.29],
  };
  const T = tailSpec(params);
  tailChain(J, 'tailBase', T.pitch, T.lens);
  return J;
}

export function sheepBones() {
  const b = quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true });
  for (const d of b) {
    if (d[0] === 'fpaw{S}') { d[2] = 'fcoffin{S}'; d[4] = { region: 'limb', group: 'F{S}' }; }
    if (d[0] === 'hpaw{S}') { d[2] = 'hcoffin{S}'; d[4] = { region: 'limb', group: 'H{S}' }; }
  }
  b.push(['udder', 'udderTop', 'udderBot', 'pelvis', { region: 'torso', group: 'udder' }]);
  b.push(
    ['fhoof{S}', 'fcoffin{S}', 'ftoe{S}', 'fpaw{S}', { region: 'foot', group: 'F{S}' }],
    ['hhoof{S}', 'hcoffin{S}', 'htoe{S}', 'hpaw{S}', { region: 'foot', group: 'H{S}' }],
  );
  return b;
}

export function sheepRig(params = {}, J = sheepJoints(params)) {
  const limbs = quadrupedLimbs({
    front: { tCore: 0.5, aCore: 0.05, aBody: -0.15, midX: 0.0 },
    hind: { tCore: 0.45, aCore: 0.022, aBody: -0.2, midX: 0.008 },
  });
  for (const L of Object.values(limbs)) { L.bones.push((L.front ? 'fhoof' : 'hhoof') + L.S); L.distal.push((L.front ? 'fhoof' : 'hhoof') + L.S); }
  return buildRig({
    joints: J,
    unit: 0.92,
    headOrigin: HEAD_O,
    bones: sheepBones(),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the skull's influence reaches back into the throat (widening with the depth below the axis)
      blend: { 1: [-0.01, 0.17, 7], 2: [-0.19, 0.22, 0], 3: [-0.22, 0.17, 0] },
      bodyTail: 0, // (the britch wool does not blend into the tail: it tore when the thighs folded to lie down)
      // (core weights.js `cascade`: the occiput's throat lever reaches past the mid-neck joint, where the default
      // chain weighting cut the skull's share from 0.2-0.4 to 0 within 2 cm of coarse neck: the neck wool creased
      // along that line, a jagged crack, whenever the head dropped or turned. It now fades out over the 7 cm past
      // the joint. Not in the Merino: the fade stretches the neck wool a little more when grazing and sleeping
      // (pattern edges > 1.5x 29.8 -> 31.0 % of 30), and its crease is left to the shells' depth bias, index.js)
      cascade: params.variant === 'merino' ? false : { 1: 0.07 },
    },
    limbs,
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.002, 0.004] },
      { group: 'earR', bone: 'earR', blend: [-0.002, 0.004] },
      { group: 'udder', bone: 'udder', blend: [-0.004, 0.02] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle', 'pectoral', 'forearmweb', 'woolarm', 'woolthigh', 'woolweb'],
  });
}
