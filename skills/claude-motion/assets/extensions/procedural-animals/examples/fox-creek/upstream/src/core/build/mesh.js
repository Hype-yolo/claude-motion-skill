// Meshing stage: turns a species' SDF sculpt into surface pieces ("regions").
//
// A species describes its regions as jobs (each job can run in its own worker):
//   { name, part, bmin, bmax, h, F?, clip?(x,y,z), patches?: [{ c, R, B, h }], rigidBone? }
//  part:     which primitives to mesh (primitives carry part: 'body' | 'jaw' | ...)
//  h:        cell size in metres (quality tiers multiply it)
//  clip:     keep only cells whose centre passes (used for overlapping regions that cross-fade)
//  patches:  balls re-meshed at a finer cell size (eyelid margins); the region itself is clipped
//            to exclude the inner ball and the two cross-fade in a thin shell
//  rigidBone: the whole region follows one bone (a separately meshed jaw)
import { meshSDF } from '../sdf/mesher.js';

export function meshRegion(model, R) {
  const prims = model.forPart(R.part || 'body');
  if (!prims.length) throw new Error(`region ${R.name}: no primitives in part ${R.part}`);
  const d2 = (x, y, z, c) => (x - c[0]) * (x - c[0]) + (y - c[1]) * (y - c[1]) + (z - c[2]) * (z - c[2]);
  const patches = R.patches || [];
  const baseClip = R.clip || null;
  // The region stops one of its own cells inside the patch's inner radius: its cut is as ragged as its
  // cells, and a cut that pokes past the middle of the cross-fade band (a cell wider than the band B) left
  // a slit there that neither surface covered; one cell further in, the cut lies where the patch shows
  // alone and the region's fade is ~0 (drawn nowhere).
  const clip = patches.length
    ? (x, y, z) => (!baseClip || baseClip(x, y, z)) && patches.every((p) => d2(x, y, z, p.c) > Math.max(0, p.R - p.B - R.h) ** 2)
    : baseClip;
  const parts = [meshSDF(prims, R.bmin, R.bmax, R.h, R.F || 6, null, clip)];
  for (const p of patches) {
    const rOut = p.R + p.B, pad = rOut + 3 * p.h;
    parts.push(meshSDF(prims, [p.c[0] - pad, p.c[1] - pad, p.c[2] - pad], [p.c[0] + pad, p.c[1] + pad, p.c[2] + pad], p.h, 4, null, (x, y, z) => d2(x, y, z, p.c) < rOut * rOut && (!baseClip || baseClip(x, y, z))));
  }
  const m = parts.length > 1 ? mergeMeshes(parts) : { ...parts[0], patch: null };
  return serialiseLists({ name: R.name, ...m });
}

export function mergeMeshes(meshes) {
  let n = 0, ni = 0;
  for (const m of meshes) { n += m.count; ni += m.indices.length; }
  const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3), indices = new Uint32Array(ni), patch = new Uint8Array(n);
  const lists = new Array(n);
  let v0 = 0, i0 = 0;
  meshes.forEach((m, k) => {
    positions.set(m.positions, v0 * 3);
    normals.set(m.normals, v0 * 3);
    for (let i = 0; i < m.indices.length; i++) indices[i0 + i] = m.indices[i] + v0;
    for (let i = 0; i < m.count; i++) { lists[v0 + i] = m.lists[i]; patch[v0 + i] = k > 0 ? 1 : 0; }
    v0 += m.count; i0 += m.indices.length;
  });
  return { positions, normals, indices, lists, count: n, patch };
}

// replace per-vertex primitive lists by ids so a region can cross a worker boundary
function serialiseLists(p) {
  const uniq = new Map();
  const listIndex = new Uint32Array(p.count);
  const listIds = [];
  for (let v = 0; v < p.count; v++) {
    const l = p.lists[v];
    let k = uniq.get(l);
    if (k === undefined) { k = listIds.length; uniq.set(l, k); listIds.push(Int16Array.from(l.map((q) => q.id))); }
    listIndex[v] = k;
  }
  return { name: p.name, positions: p.positions, normals: p.normals, indices: p.indices, count: p.count, listIndex, listIds, patch: p.patch || null };
}

export function regionTransferables(parts) {
  return parts.flatMap((p) => [p.positions.buffer, p.normals.buffer, p.indices.buffer, p.listIndex.buffer]);
}
