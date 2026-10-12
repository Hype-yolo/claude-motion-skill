// Top of whatever covers each ground cell: roofs, signs, awnings. Rain stops there.
import * as THREE from 'three/webgpu';
import { vec2 } from 'three/tsl';

export const HM = { extent: 1750, size: 2048 };

export function buildHeightmap(city) {
  const { extent, size } = HM;
  const data = new Float32Array(size * size);
  const k = size / (extent * 2);
  const raster = (x0, z0, x1, z1, y) => {
    const i0 = Math.max(0, Math.floor((x0 + extent) * k)), i1 = Math.min(size - 1, Math.floor((x1 + extent) * k));
    const j0 = Math.max(0, Math.floor((z0 + extent) * k)), j1 = Math.min(size - 1, Math.floor((z1 + extent) * k));
    for (let j = j0; j <= j1; j++) {
      const row = j * size;
      for (let i = i0; i <= i1; i++) if (data[row + i] < y) data[row + i] = y;
    }
  };
  for (const b of [...city.buildings, ...city.outer]) for (const t of b.tiers) raster(t.x0, t.z0, t.x1, t.z1, t.y1);
  for (const a of city.awnings) {
    const across = Math.abs(Math.sin(a.rotY)) > 0.5;
    const hw = a.w / 2, hd = a.depth / 2;
    raster(a.x - (across ? hd : hw), a.z - (across ? hw : hd), a.x + (across ? hd : hw), a.z + (across ? hw : hd), a.y);
  }
  for (const s of city.signs) {
    if (s.kind !== 'over') continue;
    const across = Math.abs(Math.sin(s.rotY)) > 0.5;
    const hw = s.w / 2;
    raster(s.x - (across ? 0.2 : hw), s.z - (across ? hw : 0.2), s.x + (across ? 0.2 : hw), s.z + (across ? hw : 0.2), s.y + s.h / 2);
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.FloatType);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const hmUV = (xz) => xz.add(HM.extent).div(HM.extent * 2);
export const hmUVc = (xz) => vec2(xz.x, xz.y).add(HM.extent).div(HM.extent * 2);
