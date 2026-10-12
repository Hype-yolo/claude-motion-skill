import * as THREE from 'three/webgpu';
import { uniform, texture } from 'three/tsl';
import { CITY } from '../city/layout.js';

// global uniforms every system reads; written once per frame from main
export const U = {
  time: uniform(0),
  camPos: uniform(new THREE.Vector3()),
  camVel: uniform(new THREE.Vector3()),
  flash: uniform(0), // lightning, 0..1
  flashPos: uniform(new THREE.Vector3()),
  rain: uniform(1), // rain intensity at the camera, 0..1
  cloudBase: uniform(CITY.cloudBase),
  cloudTop: uniform(CITY.cloudTop),
  inCloud: uniform(0),
  carPos: uniform(new THREE.Vector3(0, -100, 0)),
  carFwd: uniform(new THREE.Vector3(0, 0, 1)),
  carGlow: uniform(new THREE.Color(0.1, 0.8, 1.0)),
  carHover: uniform(0), // 0 driving, 1 hovering: thrusters point down and light the ground
  headlights: uniform(1),
  moonDir: uniform(new THREE.Vector3(-0.35, 0.42, -0.84).normalize()),
  // where the facade kit last chose its detailed buildings; boxes and kit both measure from here
  kitCenter: uniform(new THREE.Vector3(0, -1e5, 0)),
};

// tileable 4-channel value-noise fbm: r coarse, g fine grain, b mid, a vertically stretched streaks
export function makeNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const lattice = (n, seed) => {
    const a = new Float32Array(n * n);
    let s = seed;
    for (let i = 0; i < a.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; a[i] = s / 4294967296; }
    return a;
  };
  const sample = (lat, n, x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const i0 = ((xi % n) + n) % n, j0 = ((yi % n) + n) % n, i1 = (i0 + 1) % n, j1 = (j0 + 1) % n;
    const a = lat[j0 * n + i0], b = lat[j0 * n + i1], c = lat[j1 * n + i0], d = lat[j1 * n + i1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const fbm = (base, oct, seed, sx = 1, sy = 1) => {
    const lats = [];
    for (let o = 0; o < oct; o++) lats.push(lattice(base << o, seed + o * 977));
    return (x, y) => {
      let v = 0, amp = 0.5, tot = 0;
      for (let o = 0; o < oct; o++) {
        const n = base << o;
        v += sample(lats[o], n, (x * n * sx) / size, (y * n * sy) / size) * amp;
        tot += amp;
        amp *= 0.5;
      }
      return v / tot;
    };
  };
  const r = fbm(4, 5, 11), g = fbm(32, 3, 23), b = fbm(8, 4, 37), a = fbm(16, 3, 51);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = r(x, y) * 255;
      data[i + 1] = g(x, y) * 255;
      data[i + 2] = b(x, y) * 255;
      // streaks: high frequency across, low frequency along
      data[i + 3] = a(x, y * 0.0625 + x * 0) * 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export const noiseTex = makeNoiseTexture(256);
export const noise = (uvNode) => texture(noiseTex, uvNode);

const loader = new THREE.TextureLoader();
export function loadTex(url, { srgb = false, repeat = true, aniso = 8 } = {}) {
  return new Promise((resolve, reject) => {
    loader.load(url, (t) => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = aniso;
      resolve(t);
    }, undefined, reject);
  });
}

// a vertical strip of square layers -> texture array (RGB data only; see assets-src/facades.mjs)
export async function loadArray(url, size, { srgb = false, aniso = 8 } = {}) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const data = new Uint8Array(ctx.getImageData(0, 0, bmp.width, bmp.height).data.buffer);
  const layers = Math.round(bmp.height / size);
  bmp.close();
  const t = new THREE.DataArrayTexture(data, size, size, layers);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
