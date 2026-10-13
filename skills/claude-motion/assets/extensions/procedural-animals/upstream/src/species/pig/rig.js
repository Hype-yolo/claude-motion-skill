// Pig skeleton in bind pose (metres). Forward = +Z, up = +Y, the animal's left = +X.
// Reference individual: a Large White finisher / young gilt, 0.72 m at the withers, ~120 kg.
// Landmarks from side1.jpg / side2.jpg (normalised to the withers height) and the
// porcine limb table: point of shoulder 0.48 m, elbow 0.31, carpus 0.15, fore fetlock
// 0.065, stifle 0.36, hock 0.17 (point of hock 0.21), hind fetlock 0.065; snout tip -> buttock
// 1.35 m (1.87 x withers), belly 0.30 m above the ground.
//
// Hooves: like the cow, a hoof bone per leg below the pastern (fpaw / hpaw = pastern: fetlock ->
// coffin joint; fhoof / hhoof = the two main claws: coffin joint -> toe), the dew claws ride on the
// pastern. A snout bone carries the rostral disc (twitches and wiggles while sniffing).
//
// The tail is a corkscrew (pigTail below): the rest chain is the curled tail, which the behaviour
// hook holds rigidly on the root bone at runtime (no stretch); uncurling (resting, fear) blends to
// the engine's hanging tail.
import { buildRig } from '../../core/rig/rig.js';
import { quadrupedBones, quadrupedLimbs } from '../../core/rig/quadruped.js';
import { EAR_BASE, earSpine } from './ears.js';

export const TAIL_SEGS = 10;
export const TAIL_LENS = [0.052, 0.03, 0.025, 0.023, 0.022, 0.021, 0.02, 0.019, 0.018, 0.017];
// Head frame: modelled along its own axis (poll -> snout disc), pitched 35 degrees nose-down in the
// bind pose (relaxed standing carriage, research 3: snout 30-45 deg below horizontal). Head-local
// coordinates: x lateral, y dorsal (forehead side), z along the head toward the disc; origin on the
// axis level with the eyes.
export const HEAD_PITCH = (35 * Math.PI) / 180;
export const HZ = [0, -Math.sin(HEAD_PITCH), Math.cos(HEAD_PITCH)];
export const HY = [0, Math.cos(HEAD_PITCH), Math.sin(HEAD_PITCH)];
export const HEAD_O = [0, 0.585, 0.59];
export const SNOUT_K = 1.15; // (the sculpt's snout length factor at params.snoutLen = 1)
export const hl = (v) => [HEAD_O[0] + v[0], HEAD_O[1] + v[1] * HY[1] + v[2] * HZ[1], HEAD_O[2] + v[1] * HY[2] + v[2] * HZ[2]];
export const hdir = (v) => [v[0], v[1] * HY[1] + v[2] * HZ[1], v[1] * HY[2] + v[2] * HZ[2]];

// ears: the root on the head and the leaf geometry are in ears.js (the ear bone runs from the root to the
// leaf's tip, wherever the leaf's bend puts it)
export function pigJoints(params = {}) {
  const K = (params.snoutLen ?? 1) * SNOUT_K;
  const sz = (z) => (z > 0.06 ? 0.06 + (z - 0.06) * K : z);
  const eb = hl(EAR_BASE);
  const J = {
    nose: hl([0, -0.012, sz(0.198)]),
    snoutBase: hl([0, 0.0, sz(0.12)]),
    occiput: hl([0, -0.015, -0.115]),
    neckMid: [0, 0.59, 0.415],
    neckBase: [0, 0.56, 0.33],
    chestMid: [0, 0.625, 0.16],
    thoraxRear: [0, 0.645, -0.02],
    lumbarMid: [0, 0.655, -0.19],
    lumbosacral: [0, 0.66, -0.36],
    tailBase: [0, 0.69, -0.59],
    // fore: scapula sloping ~65 deg, the humerus down and back, radius and cannon near vertical,
    // an upright pastern (pigs stand on the tips of the claws)
    scapTopL: [0.065, 0.66, 0.255],
    shoulderL: [0.105, 0.48, 0.395],
    elbowL: [0.1, 0.31, 0.29],
    wristL: [0.088, 0.15, 0.305],
    mcpL: [0.083, 0.064, 0.322],
    fcoffinL: [0.083, 0.028, 0.345],
    ftoeL: [0.083, 0.002, 0.388],
    // hind: hip joint, stifle, hock, fetlock, coffin joint, toe
    hipL: [0.09, 0.55, -0.4],
    kneeL: [0.11, 0.36, -0.27],
    hockL: [0.086, 0.17, -0.395],
    mtpL: [0.082, 0.064, -0.362],
    hcoffinL: [0.082, 0.028, -0.338],
    htoeL: [0.082, 0.002, -0.296],
    jawHinge: hl([0, -0.052, -0.06]),
    jawTip: hl([0, -0.085, sz(0.15)]),
    earBaseL: eb,
    earTipL: earSpine(eb, 'L', params).tip,
  };
  pigTail(J, params);
  return J;
}

// the bind tail: a corkscrew. The root runs back from the tail head, then every joint turns by the
// same relative rotation (TAIL_BETA about the local axis cos(TAU) lateral + sin(TAU) along), which
// makes a helix: the loops roll down behind the buttocks and progress to one side (params.tailSide).
// The behaviour hook keeps this shape rigid on the root bone when the tail is curled, and blends
// toward the engine's hanging chain when it uncurls.
export const TAIL_ROOT_PITCH = 4; // deg above horizontal
export const TAIL_BETA = 58; // deg per joint (curling up)
export const TAIL_TAU = 0.45; // rad (helix lead)
const rot = (v, a, ang) => {
  const c = Math.cos(ang), s = Math.sin(ang), d = a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
  const cr = [a[1] * v[2] - a[2] * v[1], a[2] * v[0] - a[0] * v[2], a[0] * v[1] - a[1] * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + cr[i] * s + a[i] * d * (1 - c));
};
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export function pigTail(J, params = {}) {
  const n = TAIL_SEGS, side = params.tailSide ?? 1;
  const docked = params.docked ? 0.35 : 1;
  const r0 = (TAIL_ROOT_PITCH * Math.PI) / 180;
  let y = [0, Math.sin(r0), -Math.cos(r0)], x = [1, 0, 0];
  const beta = (TAIL_BETA * Math.PI) / 180, tau = TAIL_TAU * side;
  let p = J.tailBase.slice();
  J.tail0 = p.slice();
  for (let i = 0; i < n; i++) {
    const l = TAIL_LENS[i] * (i < 2 ? 1 : docked);
    p = [p[0] + y[0] * l, p[1] + y[1] * l, p[2] + y[2] * l];
    J['tail' + (i + 1)] = p;
    const ax = norm3([x[0] * Math.cos(tau) + y[0] * Math.sin(tau), x[1] * Math.cos(tau) + y[1] * Math.sin(tau), x[2] * Math.cos(tau) + y[2] * Math.sin(tau)]);
    // (the root bends less into the first loop)
    const b = beta * (i === 0 ? 0.6 : 1);
    y = rot(y, ax, b); x = rot(x, ax, b);
  }
  return J;
}

export function pigBones() {
  const b = quadrupedBones({ tailSegs: TAIL_SEGS, ears: true, jaw: true, extra: [['snout', 'snoutBase', 'nose', 'head', { region: 'head', group: 'snout' }]] });
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

export function pigRig(params = {}, J = pigJoints(params)) {
  const limbs = quadrupedLimbs({
    // (the short legs are sunk deep in the fat body: the limb cores stop well below the girdles)
    front: { tCore: 0.62, aCore: 0.05, aBody: -0.09, midX: 0.05 },
    hind: { tCore: 0.55, aCore: 0.022, aBody: -0.08, midX: 0.02 },
  });
  for (const L of Object.values(limbs)) { L.bones.push((L.front ? 'fhoof' : 'hhoof') + L.S); L.distal.push((L.front ? 'fhoof' : 'hhoof') + L.S); }
  return buildRig({
    joints: J,
    unit: 0.72 / 0.76,
    headOrigin: HEAD_O,
    bones: pigBones(),
    axial: {
      points: ['nose', 'occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + (i + 1))],
      bones: ['head', 'neck2', 'neck1', 'chest', 'spine3', 'spine2', 'spine1', 'pelvis', ...Array.from({ length: TAIL_SEGS }, (_, i) => 'tail' + i)],
      // the heavy jowl hangs far below the axis: the skull's influence runs back into the throat;
      // the short thick neck blends broadly into the shoulders
      blend: { 1: [-0.05, 0.1, 2], 2: [-0.05, 0.05, 1], 3: [-0.08, 0.08, 1] },
      bodyTail: 0, // the thin tail is set on the rump: body skin blends into it only at the root
    },
    limbs,
    appendages: [
      { group: 'earL', bone: 'earL', blend: [-0.002, 0.005] },
      { group: 'earR', bone: 'earR', blend: [-0.002, 0.005] },
      { group: 'snout', bone: 'snout', blend: [-0.01, 0.02] },
      // the skin under the chin rides on the jaw and blends into the throat (sculpt.js 'jawskin')
      { group: 'jawskin', bone: 'jaw', blend: [-0.004, 0.012] },
    ],
    webTags: ['flankfold', 'thighfront', 'scapmuscle', 'pectoral', 'forearmweb', 'ham'],
  });
}
