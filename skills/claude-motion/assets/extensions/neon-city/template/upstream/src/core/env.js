// A painted HDR environment of the city at night, for glossy things (the car, glass). The photographic HDR
// is warm daylight-sodium; this one carries the street's actual palette: dark sky, a band of neon at
// eye level and its smear in the wet road below.
import * as THREE from 'three/webgpu';
import { mulberry32, range, pick } from './rng.js';

const NEON = ['#ff2a6d', '#05d9e8', '#ff3df2', '#ffb03a', '#7a5cff', '#3dff8b', '#ff2a3c', '#d1f7ff', '#ffd34d'];

export function makeNeonEnv(w = 1024, h = 512) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const rng = mulberry32(77);
  const horizon = h * 0.5;
  // sky: near-black zenith, a violet glow of light pollution at the horizon
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#030308');
  sky.addColorStop(0.55, '#0d0a1c');
  sky.addColorStop(1, '#2b1a3d');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, horizon);
  // skyline silhouettes with lit windows
  for (let x = 0; x < w;) {
    const bw = range(rng, 14, 46);
    const bh = range(rng, 0.08, 0.42) * horizon;
    g.fillStyle = '#07060c';
    g.fillRect(x, horizon - bh, bw, bh);
    for (let y = horizon - bh + 4; y < horizon - 3; y += 5) {
      for (let xx = x + 3; xx < x + bw - 3; xx += 4) {
        if (rng() < 0.3) {
          g.fillStyle = rng() < 0.6 ? 'rgba(255,214,160,0.55)' : 'rgba(190,220,255,0.5)';
          g.fillRect(xx, y, 2, 2);
        }
      }
    }
    x += bw + range(rng, 0, 6);
  }
  // neon signs: tall blades and wide boards around the horizon
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const c = pick(rng, NEON);
    const x = range(rng, 0, w);
    const tall = rng() < 0.55;
    const sw = tall ? range(rng, 4, 9) : range(rng, 18, 46);
    const sh = tall ? range(rng, 24, 70) : range(rng, 5, 11);
    const y = horizon - range(rng, 6, horizon * 0.42) - sh / 2;
    g.shadowColor = c;
    g.shadowBlur = 14;
    g.fillStyle = c;
    g.fillRect(x, y, sw, sh);
  }
  g.shadowBlur = 0;
  // ground: wet asphalt carrying a stretched, dimmer reflection of the band above
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#050407';
  g.fillRect(0, horizon, w, h - horizon);
  g.save();
  g.globalAlpha = 0.45;
  g.translate(0, horizon * 2);
  g.scale(1, -1);
  g.filter = 'blur(3px)';
  g.drawImage(cv, 0, 0, w, horizon, 0, 0, w, horizon);
  g.restore();
  const fade = g.createLinearGradient(0, horizon, 0, h);
  fade.addColorStop(0, 'rgba(5,4,7,0)');
  fade.addColorStop(0.5, 'rgba(5,4,7,0.85)');
  fade.addColorStop(1, 'rgba(5,4,7,1)');
  g.fillStyle = fade;
  g.fillRect(0, horizon, w, h - horizon);

  // to linear HDR: saturated, bright pixels are light sources and get pushed well above 1
  const px = g.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h * 4);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  for (let i = 0; i < w * h; i++) {
    const r = lin(px[i * 4]), gg = lin(px[i * 4 + 1]), b = lin(px[i * 4 + 2]);
    const m = Math.max(r, gg, b);
    const boost = 1 + 7 * m * m * m;
    // canvas rows run top-down; flip so +y is up in the equirect
    const o = ((h - 1 - Math.floor(i / w)) * w + (i % w)) * 4;
    data[o] = r * boost; data[o + 1] = gg * boost; data[o + 2] = b * boost; data[o + 3] = 1;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
