// 夜林像素美术：树皮、树冠团簇、蕨、草丛、蘑菇、林地地面
import { PX, ramp, hex, h2, fbm, mulberry } from './px.js';

export const pathZ = x => Math.sin(x * .23) * .55 + Math.sin(x * .07 + 1) * .4;   // 小径中线（世界 z）

export function bark(w = 48, h = 96, seed = 3) {
  const P = new PX(w, h), R = ramp(['#0a0808', '#171210', '#241c17', '#33291f', '#463829', '#5a4a36'], .35);
  P.fill((x, y) => {
    const n = fbm(x * .35, y * .045, seed, 4), groove = Math.abs(Math.sin(x * .9 + fbm(x * .1, y * .03, seed + 2) * 5));
    let v = .25 + n * .55 - (groove < .18 ? .25 : 0) + (groove > .9 ? .08 : 0);
    const kx = (x - w * .5), ky = (y - h * .4); if (kx * kx / 9 + ky * ky / 25 < 1) v -= .3;   // 树疤
    if (fbm(x * .2, y * .2, seed + 5) > .66) return ramp(['#0e1a12', '#1a2e1c', '#28442a'], .3)(n, x, y);   // 苔
    return R(v, x, y);
  });
  return P.done();
}

// 树冠团簇：若干圆团叠加，左上受光，边缘锯齿叶片
export function canopy(w, h, seed = 1, o = {}) {
  const P = new PX(w, h), R = mulberry(seed), G = ramp(o.cols ?? ['#03070a', '#081210', '#0e1f19', '#163024', '#21432f', '#2f5a3c'], .3);
  const blobs = [];
  const n = o.n ?? 9;
  for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, r = R() * .32; blobs.push([w * (.5 + Math.cos(a) * r), h * (.52 + Math.sin(a) * r * .8), (.16 + R() * .14) * w]); }
  blobs.sort((a, b) => a[1] - b[1]);
  P.fill((x, y) => {
    let best = null;
    for (const [cx, cy, r] of blobs) {
      const jag = (h2(Math.floor(x / 2), Math.floor(y / 2), seed + 9) - .5) * 3.2;
      const dx = x - cx, dy = (y - cy) * 1.15, d = Math.hypot(dx, dy);
      if (d < r + jag) { const lit = (-dx * .6 - dy) / r; best = { v: .4 + lit * .28 - d / r * .18 + (fbm(x * .3, y * .3, seed) - .5) * .35 }; }
    }
    if (!best) return null;
    let v = best.v; if (h2(x, y, seed + 3) > .96) v += .25;
    return G(v, x, y);
  });
  P.outline(.5, [2, 4, 6]);
  return P.done();
}

export function fern(w = 44, h = 26, seed = 2) {
  const P = new PX(w, h), R = mulberry(seed), G = ramp(['#07120d', '#10261a', '#1c3d26', '#2d5a34', '#447a44'], .3);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ang = Math.PI * (.12 + .76 * i / (n - 1)) + (R() - .5) * .15, len = h * (.7 + R() * .35);
    for (let s = 0; s < len; s += .5) {
      const u = s / len, bend = u * u * .5 * Math.sign(Math.cos(ang));
      const x = w / 2 + Math.cos(ang + bend) * s * 1.1, y = h - Math.sin(ang + bend) * s * .9;
      P.set(x, y, G(.35 + u * .2, x | 0, y | 0));
      const lf = (1 - u) * 3.2 + .6;
      for (let k = 1; k < lf; k++) { if ((s * 2 | 0) % 2) continue; P.set(x + k * Math.sin(ang), y + k * .5, G(.55 + u * .3 - k * .06, x | 0, y | 0)); P.set(x - k * Math.sin(ang) * .6, y - k * .6, G(.45 + u * .2, x | 0, y | 0)); }
    }
  }
  P.outline(.45, [2, 5, 4]);
  return P.done();
}

export function grassTuft(w = 18, h = 12, seed = 4) {
  const P = new PX(w, h), R = mulberry(seed), G = ramp(['#0a160f', '#152a19', '#234226', '#355d34', '#4e7a44'], .3);
  for (let i = 0; i < 11; i++) {
    const x0 = 2 + R() * (w - 4), lean = (R() - .5) * 1.2, hh = h * (.45 + R() * .55);
    for (let y = 0; y < hh; y++) { const u = y / hh; P.set(x0 + lean * u * u * hh * .3, h - 1 - y, G(.3 + u * .6, i, y)); }
  }
  if (R() > .5) { const fx = 3 + R() * (w - 6); P.set(fx, h - 7, '#c9d7f2'); P.set(fx + 1, h - 7, '#9fb0d8'); P.set(fx, h - 8, '#e8eeff'); }
  return P.done();
}

// 蘑菇：返回 {c, e}（颜色 + 发光层）
export function mushroom(seed = 5) {
  const w = 14, h = 12, P = new PX(w, h), E = new PX(w, h), R = mulberry(seed);
  const caps = [[4, 6, 3.2], [9, 7, 2.4], [11.5, 9, 1.6]];
  const C = ramp(['#12304a', '#1f5d7a', '#3fa3b8', '#8fe6e6'], .3), S = ramp(['#6f6a78', '#a8a3b0', '#d6d2da'], .3);
  caps.forEach(([cx, cy, r], i) => {
    for (let y = cy; y < h; y++) { P.set(cx, y, S(.6, cx, y)); if (r > 2) P.set(cx - 1, y, S(.35, cx, y)); }
    P.ellipse(cx, cy, r, r * .62, (x, y, dx, dy) => { const c = C(.62 - dy * .3 - dx * .15, x, y); if (dy < .2) E.set(x, y, c); return c; });
    if (r > 2) { P.set(cx - 1, cy - 1, '#d8ffff'); E.set(cx - 1, cy - 1, [216, 255, 255]); }
  });
  P.outline(.4, [4, 8, 12]);
  return { c: P.done(), e: E.done() };
}

// 地面：小径（泥土、落叶）+ 两侧苔草地 + 月光下的碎石
export function forestGround(w, h, toWorld, seed = 21) {
  const P = new PX(w, h);
  const G = ramp(['#060b09', '#0c1712', '#13241a', '#1c3322', '#284530', '#355a3a'], .3);
  const D = ramp(['#0e0b09', '#1b1511', '#2a2119', '#3a2e22', '#4d3d2c'], .3);
  const L = ramp(['#2a1208', '#4a2410', '#6a3a18', '#8a5424'], .3);
  P.fill((x, y) => {
    const [wx, wz] = toWorld(x / w, y / h);
    const d = Math.abs(wz - pathZ(wx)), edge = .95 + (fbm(wx * .8, wz * .8, seed) - .5) * .7;
    const n = fbm(x * .22, y * .22, seed + 2);
    if (d < edge) {
      if (h2(x, y, seed + 7) > .985 || (fbm(x * .5, y * .5, seed + 8) > .7 && h2(x, y, seed) > .6)) return L(h2(x >> 1, y >> 1, 3), x, y);   // 落叶
      let v = .35 + n * .45 - (d / edge) * .15; if (h2(x, y, seed + 1) > .97) v += .35; return D(v, x, y);
    }
    let v = .25 + n * .6 + (fbm(x * .06, y * .06, seed + 4) - .5) * .4; if (h2(x, y, seed + 3) > .94) v += .2;
    return G(v, x, y);
  });
  return P.done();
}

// 远景树林剪影（一排暗色树冠 + 树干）
export function treeline(w, h, seed = 8) {
  const P = new PX(w, h), c1 = hex('#07100f'), c2 = hex('#0b1715');
  for (let x = 0; x < w; x++) {
    const top = h * (.08 + .35 * fbm(x * .05, 0, seed, 3) + .12 * Math.abs(Math.sin(x * .09)));
    for (let y = Math.floor(top); y < h; y++) P.set(x, y, (y - top < 2) ? c2 : c1);
  }
  for (let i = 0; i < w / 14; i++) { const x0 = (h2(i, 0, seed) * w) | 0, tw = 2 + (h2(i, 1, seed) * 4 | 0); P.rect(x0, h * .4, tw, h, [5, 9, 9]); }
  return P.done();
}
