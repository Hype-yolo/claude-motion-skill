// Instances are drawn as plain Meshes over an InstancedBufferGeometry, transformed in the vertex shader from
// per-instance (x, y, z, rotY) and (sx, sy, sz). three keys an InstancedMesh's shader build by its uuid, so
// every chunk would pay for a fresh node build the first time it comes into view; plain meshes over the
// same attribute layout share one build per material. Chunks keep frustum culling effective.
import * as THREE from 'three/webgpu';
import { attribute, positionGeometry, normalGeometry, vec3, cos, sin, Fn, transformNormalToView } from 'three/tsl';

const rotY = (v, a) => {
  const c = cos(a), s = sin(a);
  return vec3(v.x.mul(c).add(v.z.mul(s)), v.y, v.z.mul(c).sub(v.x.mul(s)));
};

export const iPR = attribute('iPR', 'vec4');
export const iS = attribute('iS', 'vec3');

// world position of the vertex, for use as material.positionNode (chunk meshes sit at the origin)
export const instancePosition = Fn(() => rotY(positionGeometry.mul(iS), iPR.w).add(iPR.xyz));

export function useInstancing(material, { rotated = true } = {}) {
  if (material.userData.instanced) return material;
  material.positionNode = instancePosition();
  // a box keeps its face normals under axis scaling; only the yaw has to be applied
  if (rotated) material.normalNode = transformNormalToView(rotY(normalGeometry, iPR.w)).normalize();
  material.userData.instanced = true;
  return material;
}

export function chunkedInstances({ items, geometry, material, chunk = 300, attrs = {}, place, name = '', layer = null, maxDist = Infinity, rotated = true }) {
  useInstancing(material, { rotated });
  const groups = new Map();
  for (const it of items) {
    const k = `${Math.floor(it.x / chunk)},${Math.floor(it.z / chunk)}`;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(it);
  }
  const group = new THREE.Group();
  group.name = name;
  group.userData.maxDist = maxDist;
  geometry.computeBoundingSphere();
  const baseR = geometry.boundingSphere.radius + geometry.boundingSphere.center.length();
  for (const list of groups.values()) {
    const n = list.length;
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = geometry.index;
    for (const [k, a] of Object.entries(geometry.attributes)) geo.setAttribute(k, a);
    geo.instanceCount = n;
    const pr = new Float32Array(n * 4), sc = new Float32Array(n * 3);
    const arrays = {};
    for (const [key, { size }] of Object.entries(attrs)) arrays[key] = new Float32Array(n * size);
    const box = new THREE.Box3();
    const _p = new THREE.Vector3();
    let maxS = 0;
    list.forEach((it, i) => {
      const t = place(it);
      pr[i * 4] = t[0]; pr[i * 4 + 1] = t[1]; pr[i * 4 + 2] = t[2]; pr[i * 4 + 3] = t[3];
      sc[i * 3] = t[4]; sc[i * 3 + 1] = t[5]; sc[i * 3 + 2] = t[6];
      box.expandByPoint(_p.set(t[0], t[1], t[2]));
      maxS = Math.max(maxS, t[4], t[5], t[6]);
      for (const [key, { size, fn }] of Object.entries(attrs)) {
        const v = fn(it);
        if (size === 1) arrays[key][i] = v;
        else arrays[key].set(v, i * size);
      }
    });
    geo.setAttribute('iPR', new THREE.InstancedBufferAttribute(pr, 4));
    geo.setAttribute('iS', new THREE.InstancedBufferAttribute(sc, 3));
    for (const [key, { size }] of Object.entries(attrs)) geo.setAttribute(key, new THREE.InstancedBufferAttribute(arrays[key], size));
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    sphere.radius += baseR * maxS;
    geo.boundingSphere = sphere;
    geo.boundingBox = box.clone().expandByScalar(baseR * maxS);
    const mesh = new THREE.Mesh(geo, material);
    if (layer !== null) mesh.layers.set(layer);
    group.add(mesh);
  }
  return group;
}

// Small props are invisible beyond a few hundred metres; skip their chunks entirely.
export function cullChunks(root, camPos) {
  root.traverse((g) => {
    const d = g.userData.maxDist;
    if (!d || d === Infinity) return;
    for (const m of g.children) {
      const bs = m.geometry.boundingSphere;
      m.visible = camPos.distanceTo(bs.center) - bs.radius < d;
    }
  });
}
