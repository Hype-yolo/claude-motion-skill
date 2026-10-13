// Standard quadruped skeleton (the names the quadruped motion engine expects).
//
// Axial: pelvis, spine1 (lumbar), spine2 (thoracolumbar), spine3 (thorax), chest, neck1, neck2, head, jaw
// Front limb: scapula, humerus, radius, metacarpus (cannon in ungulates), fpaw (pastern + hoof in ungulates)
// Hind limb:  femur, tibia, metatarsus (cannon), hpaw
// Joint names: nose, occiput, neckMid, neckBase, chestMid, thoraxRear, lumbarMid, lumbosacral, tailBase,
//   scapTop, shoulder, elbow, wrist, mcp, ftoe | hip, knee, hock, mtp, htoe (suffix L/R),
//   jawHinge, jawTip, earBase, earTip, tail1..tailN.
// Plantigrade (bear, rat, rabbit hind) and unguligrade (hoofed) animals use the same names; only
// the joint positions and the foot settings of the motion plan differ.

export function quadrupedBones({ tailSegs = 10, ears = true, jaw = true, extra = [] } = {}) {
  const b = [
    ['pelvis', 'lumbosacral', 'tailBase', null, { region: 'torso' }],
    ['spine1', 'lumbosacral', 'lumbarMid', 'pelvis', { region: 'torso' }],
    ['spine2', 'lumbarMid', 'thoraxRear', 'spine1', { region: 'torso' }],
    ['spine3', 'thoraxRear', 'chestMid', 'spine2', { region: 'torso' }],
    ['chest', 'chestMid', 'neckBase', 'spine3', { region: 'torso' }],
    ['neck1', 'neckBase', 'neckMid', 'chest', { region: 'neck' }],
    ['neck2', 'neckMid', 'occiput', 'neck1', { region: 'neck' }],
    ['head', 'occiput', 'nose', 'neck2', { region: 'head' }],
  ];
  if (jaw) b.push(['jaw', 'jawHinge', 'jawTip', 'head', { region: 'jaw', group: 'jaw' }]);
  if (ears) b.push(['ear{S}', 'earBase{S}', 'earTip{S}', 'head', { region: 'ear', group: 'ear{S}' }]);
  b.push(
    ['scapula{S}', 'scapTop{S}', 'shoulder{S}', 'chest', { region: 'limb', group: 'F{S}' }],
    ['humerus{S}', 'shoulder{S}', 'elbow{S}', 'scapula{S}', { region: 'limb', group: 'F{S}' }],
    ['radius{S}', 'elbow{S}', 'wrist{S}', 'humerus{S}', { region: 'limb', group: 'F{S}' }],
    ['metacarpus{S}', 'wrist{S}', 'mcp{S}', 'radius{S}', { region: 'limb', group: 'F{S}' }],
    ['fpaw{S}', 'mcp{S}', 'ftoe{S}', 'metacarpus{S}', { region: 'foot', group: 'F{S}' }],
    ['femur{S}', 'hip{S}', 'knee{S}', 'pelvis', { region: 'limb', group: 'H{S}' }],
    ['tibia{S}', 'knee{S}', 'hock{S}', 'femur{S}', { region: 'limb', group: 'H{S}' }],
    ['metatarsus{S}', 'hock{S}', 'mtp{S}', 'tibia{S}', { region: 'limb', group: 'H{S}' }],
    ['hpaw{S}', 'mtp{S}', 'htoe{S}', 'metatarsus{S}', { region: 'foot', group: 'H{S}' }],
  );
  for (let i = 0; i < tailSegs; i++) b.push(['tail' + i, 'tail' + i, 'tail' + (i + 1), i === 0 ? 'pelvis' : 'tail' + (i - 1), { region: 'tail' }]);
  return b.concat(extra);
}

// Limb descriptions for the harmonic limb weights.
//  tCore: fraction of the way from the girdle top (scapTop / hip) to the elbow / knee below which
//         skin belongs rigidly to the limb; aCore / aBody: how much closer to the limb than to the
//         body (SDF distance, metres at unit 1) skin must be to count as limb core / body core;
//  midX:  skin nearer the midline than this never follows the limb.
export function quadrupedLimbs({ front, hind }) {
  const L = {};
  for (const S of ['L', 'R']) {
    const side = S === 'L' ? 1 : -1;
    L['F' + S] = {
      side, S, front: true,
      bones: ['scapula' + S, 'humerus' + S, 'radius' + S, 'metacarpus' + S, 'fpaw' + S],
      proximal: ['scapula' + S, 'humerus' + S], distal: ['metacarpus' + S, 'fpaw' + S],
      field: { a: 'scapTop' + S, b: 'elbow' + S, top: 'scapula' + S, ...front },
    };
    L['H' + S] = {
      side, S, front: false,
      bones: ['femur' + S, 'tibia' + S, 'metatarsus' + S, 'hpaw' + S],
      proximal: ['femur' + S], distal: ['metatarsus' + S, 'hpaw' + S],
      field: { a: 'hip' + S, b: 'knee' + S, top: 'femur' + S, ...hind },
    };
  }
  return L;
}

// Tail joints tail0..tailN from a base joint: per-segment pitch (degrees from horizontal, pointing
// backwards) and lengths. Writes into J.
export function tailChain(J, base, anglesDeg, lens, name = 'tail') {
  let p = J[base].slice();
  J[name + '0'] = p.slice();
  for (let i = 0; i < anglesDeg.length; i++) {
    const a = (anglesDeg[i] * Math.PI) / 180;
    p = [p[0], p[1] + Math.sin(a) * lens[i], p[2] - Math.cos(a) * lens[i]];
    J[name + (i + 1)] = p;
  }
  return J;
}
