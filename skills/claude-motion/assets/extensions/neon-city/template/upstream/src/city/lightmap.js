// Top-down map of the light that reaches street level: neon spill, shop windows, street lamps.
// Streets, facades, fog and the cloud base sample it, so colour from thousands of emitters costs one texture read.
import * as THREE from 'three/webgpu';
import { texture, vec2, mix, smoothstep } from 'three/tsl';

export const LM = { extent: 1750, size: 2048 };

const toPx = (v) => ((v + LM.extent) / (LM.extent * 2)) * LM.size;
const pxPerM = LM.size / (LM.extent * 2);

function glow(g, x, z, r, color, a) {
  const px = toPx(x), pz = toPx(z), pr = Math.max(1.5, r * pxPerM);
  const grd = g.createRadialGradient(px, pz, 0, px, pz, pr);
  grd.addColorStop(0, rgba(color, a));
  grd.addColorStop(0.35, rgba(color, a * 0.45));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd;
  g.fillRect(px - pr, pz - pr, pr * 2, pr * 2);
}

function rgba(c, a) {
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${Math.min(1, a).toFixed(3)})`;
}

const SHOP = ['#ffd9a8', '#ffe7c4', '#d8f0ff', '#fff1d6', '#ffb87a', '#bfe8ff', '#ff9fd0', '#a8ffe0'].map((h) => new THREE.Color(h));
const SODIUM = new THREE.Color('#ffae55'), LED = new THREE.Color('#cfe2ff');

export function buildLightmap(city) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = LM.size;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, LM.size, LM.size);
  g.globalCompositeOperation = 'lighter';

  for (const l of city.lamps) {
    glow(g, l.x + l.ox * 2.2, l.z + l.oz * 2.2, 13, l.warm ? SODIUM : LED, 0.34);
  }
  for (const s of city.shopfronts) {
    if (!s.open) continue;
    const c = SHOP[Math.floor(s.seed * SHOP.length)];
    const across = Math.abs(Math.sin(s.rotY)) > 0.5;
    const n = Math.max(1, Math.round(s.w / 4));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n - 0.5;
      const ox = across ? Math.sin(s.rotY) * 2.2 : t * s.w;
      const oz = across ? t * s.w : Math.cos(s.rotY) * 2.2;
      glow(g, s.x + ox, s.z + oz, 5.5, c, 0.3);
    }
  }
  const col = city.atlas.map((c) => new THREE.Color(c.col));
  for (const s of city.signs) {
    const c = col[s.cell];
    const fall = 1 / (1 + (s.y / 9) ** 2);
    const area = Math.min(3, (s.w * s.h) / 8);
    glow(g, s.x, s.z, 4 + s.y * 0.45, c, (0.18 + 0.5 * fall) * area * (s.kind === 'roof' ? 0.25 : 1));
  }

  const near = new THREE.CanvasTexture(cv);
  near.colorSpace = THREE.SRGBColorSpace;
  near.wrapS = near.wrapT = THREE.ClampToEdgeWrapping;
  near.anisotropy = 4;
  // canvas rows run with +z; keep them that way so lmUV maps straight onto the canvas
  near.flipY = false;

  // a wide, soft version for fog colour and the glow on the underside of the clouds
  const fc = document.createElement('canvas');
  fc.width = fc.height = 256;
  const fg = fc.getContext('2d');
  fg.filter = 'blur(6px)';
  fg.drawImage(cv, 0, 0, 256, 256);
  fg.filter = 'blur(3px)';
  fg.globalCompositeOperation = 'lighter';
  fg.globalAlpha = 0.6;
  fg.drawImage(fc, 0, 0);
  const far = new THREE.CanvasTexture(fc);
  far.colorSpace = THREE.SRGBColorSpace;
  far.wrapS = far.wrapT = THREE.ClampToEdgeWrapping;
  far.flipY = false;

  return { near, far, canvas: cv };
}

// world xz → lightmap uv
export const lmUV = (xz) => xz.add(LM.extent).div(LM.extent * 2);
export const sampleLM = (tex, xz) => texture(tex, lmUV(xz)).rgb;

// the light at street level: the canvas glow, and inside the Blender district (district.js) its bake, scaled into
// this map's units, faded in over the region's last few metres
export function streetLight(lightmap, xz) {
  const glow = texture(lightmap.near, lmUV(xz)).rgb;
  const d = lightmap.district;
  if (!d) return glow;
  return mix(glow, texture(d.ground, d.uv(xz)).rgb.mul(d.scale), smoothstep(0, 4, d.inside(xz)));
}
export { vec2 };
