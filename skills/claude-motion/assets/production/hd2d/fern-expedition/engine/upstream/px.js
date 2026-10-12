// 像素工具：低分辨率画布 → NearestFilter 贴图；抖动、噪声、描边；像素公告板（受光 + 投影）
import * as THREE from 'three';

export const PPM = 24;   // 场景贴图：每米像素数
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + .5) / 16;
export function h2(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vn2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y, s = 0, o = 4) => { let a = 0, f = 1, w = .5, t = 0; for (let i = 0; i < o; i++) { a += vn2(x * f, y * f, s + i * 17) * w; t += w; f *= 2; w *= .5; } return a / t; };
export function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export const mixc = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));

// 像素画布：直接操作 ImageData
export class PX {
  constructor(w, h) { this.w = w; this.h = h; this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.g = this.c.getContext('2d', { willReadFrequently: true }); this.d = this.g.createImageData(w, h); }
  set(x, y, col, a = 255) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4, c = typeof col === 'string' ? hex(col) : col; this.d.data[i] = c[0]; this.d.data[i + 1] = c[1]; this.d.data[i + 2] = c[2]; this.d.data[i + 3] = a; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; const i = (y * this.w + x) * 4, D = this.d.data; return D[i + 3] ? [D[i], D[i + 1], D[i + 2], D[i + 3]] : null; }
  rect(x, y, w, h, col) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col); }
  // 按函数逐像素填色：f(x,y) → 颜色或 null
  fill(f) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = f(x, y); if (c) this.set(x, y, c); } }
  ellipse(cx, cy, rx, ry, col) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.set(x, y, typeof col === 'function' ? col(x, y, dx, dy) : col); } }
  poly(pts, col) {   // 扫描线填多边形
    const ys = pts.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [], yc = y + .5;
      for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax)); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, typeof col === 'function' ? col(x, y) : col);
    }
  }
  line(x0, y0, x1, y1, col) { x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (; ;) { this.set(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
  // 描边：透明且与不透明相邻的像素 → 邻居颜色压暗（selout）
  outline(k = .32, tint = [22, 14, 30]) {
    const src = new Uint8ClampedArray(this.d.data), W = this.w, H = this.h, add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (src[(y * W + x) * 4 + 3]) continue;
      let n = null;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const i = (Y * W + X) * 4; if (src[i + 3] > 128 && !src.__skip) { n = [src[i], src[i + 1], src[i + 2]]; break; } }
      if (n) add.push([x, y, mixc(tint, n, k)]);
    }
    for (const [x, y, c] of add) this.set(x, y, c);
  }
  done() { this.g.putImageData(this.d, 0, 0); return this.c; }
}

export function texOf(canvas, o = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter; t.minFilter = o.mip ? THREE.NearestMipmapLinearFilter : THREE.LinearFilter; t.generateMipmaps = !!o.mip;
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  t.anisotropy = 4;
  return t;
}

// 调色：按亮度在色带里选色 + Bayer 抖动（像素画的"手绘色阶"感）
export function ramp(cols, dz = .45) { const C = cols.map(c => typeof c === 'string' ? hex(c) : c); return (v, x, y) => { v = Math.max(0, Math.min(.9999, v)) * (C.length - 1); const i = Math.floor(v); let f = v - i; f = dz >= 1 ? f : Math.max(0, Math.min(1, (f - .5) / dz + .5)); return C[Math.min(C.length - 1, i + (bayer(x, y) < f ? 1 : 0))]; }; }

// —— 常用表面贴图 ——（w,h 为像素；每米 PPM 像素）
export function woodPlanks(w, h, o = {}) {
  const P = new PX(w, h), pw = o.pw ?? 6, R = ramp(o.cols ?? ['#2b1a14', '#4a2c1c', '#6b4127', '#8a5a35', '#a8764a']), s = o.seed ?? 1;
  P.fill((x, y) => {
    const row = Math.floor(y / pw), yy = y % pw, off = h2(row, 0, s) * 40 | 0, seg = Math.floor((x + off) / (o.len ?? 40)), xx = (x + off) % (o.len ?? 40);
    let v = .55 + (h2(row, seg, s) - .5) * .35 + (fbm(x * .5, row * 3 + yy * .15, s) - .5) * .35;
    if (yy === 0) v = .08; else if (yy === pw - 1) v -= .18; else if (yy === 1) v += .1;
    if (xx === 0) v = .12;
    if ((xx === 3 || xx === (o.len ?? 40) - 4) && (yy === 2 || yy === pw - 3) && o.nails !== false) v = .95;
    return R(v, x, y);
  });
  return P.done();
}
export function cobbles(w, h, o = {}) {
  const P = new PX(w, h), s = o.seed ?? 3, cell = o.cell ?? 7, R = ramp(o.cols ?? ['#1d1c24', '#34323d', '#4c4955', '#67636c', '#858089']);
  P.fill((x, y) => {   // Worley：最近/次近距离差 → 石缝
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell); let d1 = 1e9, d2 = 1e9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = cx + i, Y = cy + j, px = (X + .15 + h2(X, Y, s) * .7) * cell, py = (Y + .15 + h2(Y, X, s + 5) * .7) * cell, d = Math.hypot(x - px, y - py); if (d < d1) { d2 = d1; d1 = d; id = h2(X, Y, s + 9); } else if (d < d2) d2 = d; }
    const edge = d2 - d1; let v = .45 + id * .3 - d1 / cell * .25 + (fbm(x * .3, y * .3, s) - .5) * .2;
    if (edge < 1.2) v = .06; else if (edge < 2.2) v -= .15;
    return R(v, x, y);
  });
  return P.done();
}
export function rock(w, h, o = {}) {
  const P = new PX(w, h), s = o.seed ?? 5, R = ramp(o.cols ?? ['#15141c', '#2a2832', '#403d47', '#5a5660', '#77727a', '#96918f']);
  P.fill((x, y) => {
    const n = fbm(x * .06, y * .09, s, 5), cr = Math.abs(fbm(x * .03 + 7, y * .05, s + 3, 3) - .5);
    let v = .25 + n * .75; if (cr < .025) v *= .3;
    const strata = Math.sin(y * .35 + fbm(x * .05, y * .02, s + 1) * 6); if (strata > .92) v -= .2; if (strata < -.9) v += .08;
    return R(v, x, y);
  });
  return P.done();
}
export function plaster(w, h, o = {}) {   // 木筋灰泥墙（窗户另贴）
  const P = new PX(w, h), s = o.seed ?? 7, W = ramp(o.wall ?? ['#6f6658', '#8d8373', '#a89c88', '#c2b59d']), T = ramp(o.beam ?? ['#1e1310', '#35211a', '#4d3223']);
  const beams = o.beams ?? [];
  P.fill((x, y) => {
    for (const b of beams) { if (b.t === 'h' && y >= b.y && y < b.y + 3) return T(y === b.y ? .9 : .4 + h2(x, y, s) * .3, x, y); if (b.t === 'v' && x >= b.x && x < b.x + 3) return T(x === b.x ? .8 : .35 + h2(x, y, s) * .3, x, y); if (b.t === 'd') { const d = Math.abs((x - b.x) - (y - b.y) * b.k); if (d < 1.6 && y >= b.y && y < b.y + b.h) return T(.5, x, y); } }
    let v = .5 + (fbm(x * .15, y * .15, s) - .5) * .6; if (h2(x, y, s) > .985) v -= .35;
    return W(v, x, y);
  });
  return P.done();
}
export function shingles(w, h, o = {}) {
  const P = new PX(w, h), s = o.seed ?? 11, R = ramp(o.cols ?? ['#1c1418', '#3b2226', '#5a2f2c', '#7a3f33', '#94553f']), rh = o.rh ?? 5, cw = o.cw ?? 5;
  P.fill((x, y) => {
    const row = Math.floor(y / rh), yy = y % rh, xx = (x + (row % 2) * (cw >> 1)) % cw, id = h2(Math.floor((x + (row % 2) * (cw >> 1)) / cw), row, s);
    let v = .35 + id * .35 + (yy / rh) * .3; if (yy === rh - 1) v = .1; if (xx === 0) v -= .25;
    if (o.snow) { const sn = fbm(x * .1, y * .2, s) + (yy < 2 ? .25 : 0); if (sn > .62) return hex(sn > .75 ? '#e6eef5' : '#b9c7d6'); }
    return R(v, x, y);
  });
  return P.done();
}
export function ground(w, h, o = {}) {   // 泥土/草地混合
  const P = new PX(w, h), s = o.seed ?? 13, G = ramp(o.grass ?? ['#0f1a14', '#1a2b1c', '#27402a', '#3a5a36', '#557a46']), D = ramp(o.dirt ?? ['#1d1611', '#33271c', '#4d3b28', '#6a5236']);
  const mask = o.mask ?? (() => 1);
  P.fill((x, y) => {
    const m = mask(x / w, y / h) + (fbm(x * .08, y * .08, s) - .5) * .8;
    const n = fbm(x * .25, y * .25, s + 2);
    if (m > .5) { let v = .3 + n * .6; if (h2(x, y, s) > .93) v += .25; return G(v, x, y); }
    let v = .3 + n * .5; if (h2(x, y, s + 1) > .96) v += .3; return D(v, x, y);
  });
  return P.done();
}

// —— 像素公告板：受光的 Lambert 平面 + 镂空阴影 ——
const _depthCache = new Map();
export function spriteMats(tex, emTex, o = {}) {
  const m = new THREE.MeshLambertMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, emissiveMap: emTex || null, emissive: emTex ? new THREE.Color(o.emCol ?? '#ffffff') : new THREE.Color(0), emissiveIntensity: o.emI ?? 1 });
  if (o.color) m.color.set(o.color);
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .5, side: THREE.DoubleSide });
  const dist = new THREE.MeshDistanceMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide });
  return { m, depth, dist };
}
// 竖立平面；锚点在底边中点（ax=0.5, ay=0）
export function billboard(tex, wM, hM, o = {}) {
  const geo = new THREE.PlaneGeometry(wM, hM); geo.translate((.5 - (o.ax ?? .5)) * wM, hM / 2 - (o.ay ?? 0) * hM, 0);
  const M = spriteMats(tex, o.em, o);
  const mesh = new THREE.Mesh(geo, M.m); mesh.castShadow = o.shadow ?? true; mesh.receiveShadow = o.receive ?? false;
  mesh.customDepthMaterial = M.depth; mesh.customDistanceMaterial = M.dist;
  return mesh;
}

// 柔软的径向贴图（光晕、影子、光斑）
const _radial = {};
export function radialTex(key = 'soft', stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) {
  if (_radial[key]) return _radial[key];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [p, col] of stops) g.addColorStop(p, col); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (_radial[key] = t);
}
export function blob(r, a = .5, col = '#0a0608') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 1.2), new THREE.MeshBasicMaterial({ map: radialTex('blob', [[0, 'rgba(255,255,255,1)'], [.5, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]), color: col, transparent: true, opacity: a, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1; m.material.polygonOffset = true; m.material.polygonOffsetFactor = -2; return m;
}
// 加色光晕公告板（总是面向相机）
export function glow(col, size, i = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('glow', [[0, 'rgba(255,255,255,1)'], [.18, 'rgba(255,255,255,.55)'], [.45, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]), color: new THREE.Color(col).multiplyScalar(i), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(size, size, 1); return s;
}
