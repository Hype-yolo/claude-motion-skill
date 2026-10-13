// Runtime skeleton: bones are not parented in the scene graph; the motion engine writes their world
// matrices directly (frames built from joint positions + lateral references), using the same
// convention as the bind pose (origin = head joint, +Y along the bone, +X lateral).
import * as THREE from 'three';

export function frameMatrix(target, o, y, xRef) {
  const Y = new THREE.Vector3(y[0], y[1], y[2]).normalize();
  const X = new THREE.Vector3(xRef[0], xRef[1], xRef[2]);
  X.addScaledVector(Y, -X.dot(Y));
  if (X.lengthSq() < 1e-10) X.set(0, 0, 1).addScaledVector(Y, -Y.z);
  X.normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  target.set(X.x, Y.x, Z.x, o[0], X.y, Y.y, Z.y, o[1], X.z, Y.z, Z.z, o[2], 0, 0, 0, 1);
  return target;
}

// data: packed build data (bones + joints)
export function createSkeleton(data) {
  const J = data.joints;
  const bones = data.bones.map((b) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    bone.matrixAutoUpdate = false;
    bone.matrixWorldAutoUpdate = false;
    return bone;
  });
  const bind = data.bones.map((b) => {
    const h = J[b.headJ], t = J[b.tailJ];
    return frameMatrix(new THREE.Matrix4(), h, [t[0] - h[0], t[1] - h[1], t[2] - h[2]], [1, 0, 0]);
  });
  const inverses = bind.map((m) => m.clone().invert());
  bones.forEach((bone, i) => bone.matrixWorld.copy(bind[i]));
  const skeleton = new THREE.Skeleton(bones, inverses);
  const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
  const index = Object.fromEntries(data.bones.map((b, i) => [b.name, i]));
  return { bones, bind, inverses, skeleton, byName, index, defs: data.bones, joints: J };
}

export function resetToBind(sk) {
  sk.bones.forEach((b, i) => b.matrixWorld.copy(sk.bind[i]));
}
