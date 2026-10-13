// Translucent fin membranes (material 11). The meshed surface stays one skinned geometry; triangles
// whose three vertices are membrane are moved out of the opaque base draw into a second, transparent
// draw that shares every vertex buffer (and the dual-quaternion texture) with the base. At the crowd
// tier (one draw call) the membranes go back into the opaque base.
//
// Draw calls for a fish: hero / high / medium / low = base + membranes + eyes; crowd = base.
// Shells and hair fins are hidden for builds without any hairy vertex (render/animalObject.js).
import * as THREE from 'three';

export const MEMBRANE_MAT = 11;

/** Splits the index into opaque and membrane triangles; null when there is no membrane. */
export function splitMembranes(data, mat = MEMBRANE_MAT) {
  const idx = data.index, tint = data.tint, nT = idx.length / 3;
  const isM = (v) => Math.round(tint[v * 4 + 3]) === mat;
  let nM = 0;
  const flag = new Uint8Array(nT);
  for (let t = 0; t < nT; t++) if (isM(idx[t * 3]) && isM(idx[t * 3 + 1]) && isM(idx[t * 3 + 2])) { flag[t] = 1; nM++; }
  if (!nM) return null;
  const opaque = new Uint32Array((nT - nM) * 3), membrane = new Uint32Array(nM * 3);
  let o = 0, m = 0;
  for (let t = 0; t < nT; t++) {
    const dst = flag[t] ? membrane : opaque;
    const k = flag[t] ? m : o;
    dst[k] = idx[t * 3]; dst[k + 1] = idx[t * 3 + 1]; dst[k + 2] = idx[t * 3 + 2];
    if (flag[t]) m += 3; else o += 3;
  }
  return { opaque, membrane };
}

/** True when any vertex grows hair (fur 0, bristly skin 4 with fur length, feathers 9). */
export function hasHair(data) {
  const tint = data.tint, coat = data.coat;
  for (let v = 0; v < data.nV; v++) {
    const m = Math.round(tint[v * 4 + 3]);
    if ((m === 0 || m === 4 || m === 8 || m === 9) && coat[v * 4 + 2] > 0.0005) return true;
  }
  return false;
}

/**
 * @param data  packed build data
 * @param geometry  the base BufferGeometry (its index is swapped between opaque-only and full)
 * @param material  the membrane ShaderMaterial (coatMaterial.js createCoatMaterials().membrane)
 * @param shadowMats { depth, distance } dual-quaternion shadow materials
 * @returns { mesh, setCrowd(on), dispose() } or null when the build has no membranes
 */
export function createMembranes(data, geometry, material, shadowMats, { castShadow = true, receiveShadow = true } = {}) {
  const split = splitMembranes(data);
  if (!split) return null;
  const full = geometry.index;
  const opaque = new THREE.BufferAttribute(split.opaque, 1);
  const mg = new THREE.BufferGeometry();
  for (const k of Object.keys(geometry.attributes)) mg.setAttribute(k, geometry.attributes[k]);
  mg.setIndex(new THREE.BufferAttribute(split.membrane, 1));
  mg.boundingSphere = geometry.boundingSphere;
  const mesh = new THREE.Mesh(mg, material);
  mesh.name = 'membranes';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.customDepthMaterial = shadowMats.depth;
  mesh.customDistanceMaterial = shadowMats.distance;
  geometry.setIndex(opaque);
  let crowd = false;
  return {
    mesh,
    setCrowd(on) {
      if (on === crowd) return;
      crowd = on;
      geometry.setIndex(on ? full : opaque);
      mesh.visible = !on;
    },
    dispose() { mg.dispose(); },
  };
}
