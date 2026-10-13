// Generic rig description. A species supplies joints (left side only for paired joints; the right
// side is mirrored), a bone list and a few chains; this module turns that into the structures the
// build pipeline and the motion engines use.
//
// Coordinates: metres, forward = +Z, up = +Y, the animal's left = +X. Bind pose stands on y = 0.
//
// Bone convention (shared with the skinning and the motion code): a bone's frame has its origin at
// its head joint, +Y along the bone (head -> tail joint) and +X as close as possible to world +X.
import { mirror, sub, norm, cross, len, dot } from '../math/vec.js';

/**
 * @param {object} spec
 *  joints: { name: [x,y,z] }            names ending in L are mirrored to R
 *  bones:  [[name, headJoint, tailJoint, parent|null, { region, group }?], ...]
 *          names containing '{S}' are expanded for S in L,R
 *  axial:  { points: [jointNames nose -> tail tip], bones: [boneNames between them] }
 *  limbs:  { FL: { side:'L', bones:[...], proximal:[...], distal:[...], field:{...} }, ... }
 *  unit:   characteristic length relative to the cheetah (shoulder height / 0.76 m)
 */
export function buildRig(spec) {
  const J = {};
  for (const [k, v] of Object.entries(spec.joints)) J[k] = v.slice();
  for (const k of Object.keys(J)) if (k.endsWith('L') && !J[k.slice(0, -1) + 'R']) J[k.slice(0, -1) + 'R'] = mirror(J[k]);
  const defs = [];
  for (const d of spec.bones) {
    const [name, h, t, parent, meta = {}] = d;
    if (name.includes('{S}')) {
      for (const S of ['L', 'R']) {
        const r = (s) => (s ? s.replaceAll('{S}', S) : s);
        defs.push([r(name), r(h), r(t), r(parent), { ...meta, group: r(meta.group), side: S }]);
      }
    } else defs.push([name, h, t, parent, meta]);
  }
  const BONES = defs.map(([name, h, t, parent, meta], index) => {
    if (!J[h] || !J[t]) throw new Error(`bone ${name}: missing joint ${!J[h] ? h : t}`);
    return {
      name, index, headJ: h, tailJ: t, head: J[h], tail: J[t], parent,
      length: len(sub(J[t], J[h])),
      region: meta.region || 'torso',
      group: meta.group || 'axial',
      side: meta.side || null,
    };
  });
  const BONE = Object.fromEntries(BONES.map((b) => [b.name, b]));
  for (const b of BONES) if (b.parent && !BONE[b.parent]) throw new Error(`bone ${b.name}: unknown parent ${b.parent}`);
  const axial = spec.axial ? { points: spec.axial.points.map((p) => J[p]), names: spec.axial.points, bones: spec.axial.bones, blend: spec.axial.blend || {}, bodyTail: spec.axial.bodyTail, cascade: spec.axial.cascade || false } : null;
  const limbs = spec.limbs || {};
  return {
    J, BONES, BONE, AXIAL: axial, LIMBS: limbs,
    unit: spec.unit || 1,
    headOrigin: spec.headOrigin || null,
    meta: spec.meta || {},
    appendages: spec.appendages || [],
    webTags: spec.webTags || [],
  };
}

// Bone frame: origin at head joint, +Y along the bone, +X = lateral reference.
export function boneFrame(head, tail, lateralRef = [1, 0, 0]) {
  const y = norm(sub(tail, head));
  let x = sub(lateralRef, [y[0] * dot(lateralRef, y), y[1] * dot(lateralRef, y), y[2] * dot(lateralRef, y)]);
  if (len(x) < 1e-6) x = [0, 0, 1];
  x = norm(x);
  const z = cross(x, y);
  return { x, y, z, o: head };
}

// Apply a point transform to every joint of a rig (used by the variation warps and by size scaling).
export function transformRig(rig, f) {
  const J = {};
  for (const [k, v] of Object.entries(rig.J)) J[k] = f(v);
  const BONES = rig.BONES.map((b) => ({ ...b, head: J[b.headJ], tail: J[b.tailJ], length: len(sub(J[b.tailJ], J[b.headJ])) }));
  return {
    ...rig, J, BONES,
    BONE: Object.fromEntries(BONES.map((b) => [b.name, b])),
    AXIAL: rig.AXIAL ? { ...rig.AXIAL, points: rig.AXIAL.names.map((n) => J[n]) } : null,
    headOrigin: rig.headOrigin ? f(rig.headOrigin) : null,
  };
}
