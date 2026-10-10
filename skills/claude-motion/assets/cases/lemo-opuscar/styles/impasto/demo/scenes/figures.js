// Procedural painted figures, rebuilt every frame from fixed seeds (so paint never "boils").
import { KNIFE, BRUSH, DAB, LINE, hex, mixc, shade } from '../engine/impasto.js';
import { hash, clamp, lerp } from './common.js';

const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export const UMB = {
  red: ['#dc2f28', '#b8201e'], yellow: ['#f4bc2a', '#e09a18'], cobalt: ['#2f62c0', '#1f468e'], viridian: ['#23906c', '#18704f'],
  magenta: ['#cc3a82', '#a02866'], orange: ['#ee7a2a', '#cc5a18'], turq: ['#26aab4', '#1a8088'], violet: ['#6e4cc0', '#523494'],
  cream: ['#f2ead6', '#d8cdb4'], lime: ['#9cc83a', '#78a024'], black: ['#2a2830', '#1c1a22'], grey: ['#4a4854', '#383640'],
};
// pattern: array of colour pairs cycling per panel
export const pat = (...names) => names.map(n => UMB[n]);

// ---- umbrella, side view. (x,y) = hand; open 0..1; tilt radians; r canopy radius
export function umbrellaSide(out, x, y, r, { open = 1, tilt = 0, cols = pat('black'), seed = 1, alpha = 1, rev = 0, shaft = 1.05 } = {}) {
  const ap = [x + Math.sin(tilt) * r * shaft, y - Math.cos(tilt) * r * shaft];   // apex
  const T = (px, py) => { const [a, b] = rot(px, py, tilt); return [ap[0] + a, ap[1] + b]; };
  // shaft + handle
  const hx = x, hy = y + r * .12;
  out.push({ x: (ap[0] + hx) / 2, y: (ap[1] + hy) / 2, ang: Math.atan2(hy - ap[1], hx - ap[0]), len: Math.hypot(hx - ap[0], hy - ap[1]), wid: Math.max(2.5, r * .045), c: hex('#2a2224'), seed: seed + .1, type: LINE, alpha, rev });
  const o = clamp(open), n = 6;
  const rimW = lerp(.13, 1, o), rimY = lerp(r * .95, 0, o), domeH = lerp(-r * .05, r * .62, o);
  for (let k = 0; k < n; k++) {
    const u0 = -1 + 2 * k / n, u1 = -1 + 2 * (k + 1) / n, um = (u0 + u1) / 2;
    const rim = T(um * r * rimW, rimY - Math.cos(um * 1.2) * r * .06 * o), top = T(um * r * .12 * o, -domeH);
    const pc = cols[k % cols.length];
    const lit = 1.12 - (um + 1) * .2;
    const c1 = shade(hex(pc[0]), lit), c2 = shade(hex(pc[1]), lit);
    out.push({ x: (rim[0] + top[0]) / 2, y: (rim[1] + top[1]) / 2, ang: Math.atan2(rim[1] - top[1], rim[0] - top[0]), len: Math.hypot(rim[0] - top[0], rim[1] - top[1]) * 1.02,
      wid: (u1 - u0) * r * rimW * 1.3 + r * .05, c: c1, c2, seed: seed * 10 + k, type: KNIFE, taper: .78 * o, bend: -.22 * Math.sign(um) * Math.min(1, Math.abs(um) * 2.2) * o, alpha, rev, hgt: 1.1 });
  }
  // scalloped rim: short dark-ish knife edge between rib tips gives the canopy a crisp lower silhouette
  for (let k = 0; k < n; k++) {
    const u0 = -1 + 2 * k / n, u1 = -1 + 2 * (k + 1) / n;
    const a = T(u0 * r * rimW, rimY - Math.cos(u0 * 1.2) * r * .06 * o), b = T(u1 * r * rimW, rimY - Math.cos(u1 * 1.2) * r * .06 * o);
    const pc = cols[k % cols.length];
    out.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 - r * .02, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), len: Math.hypot(b[0] - a[0], b[1] - a[1]), wid: r * .06 * o + 1, c: shade(hex(pc[1]), .7), seed: seed * 10 + k + 5, type: KNIFE, bend: .12, alpha, rev });
  }
  // wet sheen on the lit shoulder of the dome
  if (o > .5) { const a = T(-r * .45, -domeH * .72), b = T(-r * .1, -domeH * .98); out.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), len: r * .45, wid: r * .09, c: [1, 1, 1], c2: [.9, .92, 1], seed: seed + .7, type: KNIFE, alpha: alpha * .35 * o, rev, hgt: 1.3 }); }
  // rib tips + ferrule
  for (let k = 0; k <= n; k++) { const u = -1 + 2 * k / n, p = T(u * r * rimW, rimY - Math.cos(u * 1.2) * r * .06 * o); out.push({ x: p[0], y: p[1], ang: 0, len: r * .07, wid: r * .06, c: hex('#1e1a1c'), seed: seed + k * .3, type: DAB, alpha, rev }); }
  const f = T(0, -domeH - r * .06); out.push({ x: f[0], y: f[1], ang: tilt - Math.PI / 2, len: r * .1, wid: r * .04, c: hex('#2a2224'), seed: seed + .2, type: LINE, alpha, rev });
  return ap;
}

// ---- umbrella, top view (overhead shot). (x,y) centre, r radius, rot spin, open 0..1
export function umbrellaTop(out, x, y, r, { rot: sp = 0, cols = pat('red'), seed = 1, open = 1, light = -2.3, alpha = 1, rev = 0 } = {}) {
  const n = 8, R = r * (.25 + .75 * clamp(open));
  for (let k = 0; k < n; k++) {
    const th = sp + (k + .5) * Math.PI * 2 / n;
    const pc = cols[k % cols.length], l = .78 + .32 * Math.cos(th - light);
    const cx = x + Math.cos(th) * R * .5, cy = y + Math.sin(th) * R * .5;
    out.push({ x: cx, y: cy, ang: th, len: R * 1.02, wid: 2 * R * Math.sin(Math.PI / n) * 1.12, c: shade(hex(pc[0]), l), c2: shade(hex(pc[1]), l), seed: seed * 10 + k, type: KNIFE, taper: .92, alpha, rev, hgt: 1.15 });
  }
  for (let k = 0; k < n; k++) {
    const th = sp + k * Math.PI * 2 / n;
    out.push({ x: x + Math.cos(th) * R * .5, y: y + Math.sin(th) * R * .5, ang: th, len: R * .98, wid: Math.max(1.5, R * .03), c: shade(hex(cols[0][1]), .55), seed: seed + k, type: LINE, alpha: alpha * .6, rev });
    out.push({ x: x + Math.cos(th) * R, y: y + Math.sin(th) * R, ang: th, len: R * .08, wid: R * .07, c: hex('#1e1a1c'), seed: seed + k * .7, type: DAB, alpha, rev });
  }
  // wet highlight arc toward the light + ferrule
  out.push({ x: x + Math.cos(light) * R * .45, y: y + Math.sin(light) * R * .45, ang: light + Math.PI / 2, len: R * .7, wid: R * .1, c: [1, 1, 1], seed: seed + .5, type: KNIFE, alpha: alpha * .3, rev, bend: .12 });
  out.push({ x, y, ang: 0, len: R * .14, wid: R * .14, c: hex('#2a2224'), seed: seed + .9, type: DAB, alpha, rev });
}

// ---- walking figure, side view, standing on (x,y), height H. f = facing (+1 right, -1 left)
export function walker(out, x, y, H, { phase = 0, f = 1, stride = 1, coat = '#2c2c3a', legs = '#1e1c24', skin = '#8a6a5a', hat = null, umb = null, reflect = true, alpha = 1, rev = 0, seed = 1, sway = 0 } = {}) {
  const bob = -Math.abs(Math.sin(phase)) * H * .018 * stride;
  const hip = [x, y - H * .47 + bob];
  const sw = Math.sin(phase) * .38 * stride;
  const C = hex(coat), Lg = hex(legs);
  // legs
  for (const s of [1, -1]) {
    const a = sw * s, fx = hip[0] + Math.sin(a) * H * .47 * f, fy = y;
    out.push({ x: (hip[0] + fx) / 2, y: (hip[1] + fy) / 2, ang: Math.atan2(fy - hip[1], fx - hip[0]), len: H * .5, wid: H * .075, c: shade(Lg, s > 0 ? 1.2 : .8), seed: seed + s, type: KNIFE, alpha, rev, taper: -.2 });
    out.push({ x: fx + f * H * .03, y: fy - H * .01, ang: 0, len: H * .09, wid: H * .04, c: hex('#141214'), seed: seed + s * 2, type: DAB, alpha, rev });
  }
  // coat (lit edge toward the left / light)
  const sh = [x + f * H * .02 + sway * H * .05, y - H * .8 + bob];
  out.push({ x: (sh[0] + x) / 2, y: (sh[1] + y - H * .3) / 2, ang: Math.atan2(y - H * .3 - sh[1], x - sh[0]), len: H * .54, wid: H * .21, c: C, c2: shade(C, .8), seed: seed + 3, type: KNIFE, alpha, rev, taper: .38 });
  out.push({ x: (sh[0] + x) / 2 - H * .055, y: (sh[1] + y - H * .3) / 2 + H * .02, ang: Math.PI / 2, len: H * .42, wid: H * .05, c: shade(C, 1.5), seed: seed + 4, type: KNIFE, alpha: alpha * .9, rev, taper: .3 });
  out.push({ x: sh[0], y: sh[1] + H * .02, ang: 0, len: H * .15, wid: H * .08, c: shade(C, 1.1), seed: seed + 8, type: DAB, alpha, rev });
  // head
  const hd = [sh[0] + f * H * .02, sh[1] - H * .09];
  out.push({ x: hd[0], y: hd[1], ang: 0, len: H * .085, wid: H * .1, c: hex(skin), c2: shade(hex(skin), .8), seed: seed + 5, type: DAB, alpha, rev });
  out.push({ x: hd[0] - f * H * .012, y: hd[1] - H * .03, ang: 0, len: H * .09, wid: H * .05, c: hex('#2a2024'), seed: seed + 9, type: DAB, alpha, rev });
  if (hat) out.push({ x: hd[0], y: hd[1] - H * .05, ang: 0, len: H * .16, wid: H * .05, c: hex(hat), seed: seed + 6, type: KNIFE, alpha, rev });
  // arm up to the umbrella
  const hand = [sh[0] + f * H * .12, sh[1] + H * .12];
  out.push({ x: (sh[0] + hand[0]) / 2, y: (sh[1] + hand[1]) / 2 + H * .03, ang: Math.atan2(hand[1] - sh[1], hand[0] - sh[0]), len: H * .2, wid: H * .07, c: shade(C, 1.1), seed: seed + 7, type: KNIFE, alpha, rev });
  let ap = null;
  if (umb) { const hang = umb.hang || 0; ap = umbrellaSide(out, hand[0] + hang * f * H * .02, hand[1] + hang * H * .1, H * (umb.r ?? .34), { ...umb, tilt: lerp(umb.tilt || 0, f * 2.9, hang), seed: seed + 20, alpha, rev: umb.rev ?? rev }); }
  // reflection in the wet stone: broken horizontal dabs
  if (reflect) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const yy = y + H * (.04 + i * .07), w = H * (.2 - i * .012);
      out.push({ x: x + (hash(seed * 3 + i) - .5) * H * .06, y: yy, ang: 0, len: w, wid: H * .045, c: shade(C, .75), seed: seed + 40 + i, type: KNIFE, alpha: alpha * (.5 - i * .05), rev });
    }
    if (umb && umb.open > .5 && !umb.hang) {
      const col = hex(umb.cols[0][0]);
      for (let i = 0; i < 4; i++) out.push({ x: x + f * H * .1 + (hash(seed + i) - .5) * H * .1, y: y + H * (.75 + i * .09), ang: 0, len: H * (.5 - i * .08), wid: H * .05, c: shade(col, .75), seed: seed + 50 + i, type: KNIFE, alpha: alpha * (.42 - i * .08), rev });
    }
  }
  return { hand, head: hd, apex: ap };
}

// ---- rain in screen space
export function rain(out, t, { W = 1920, H = 1080, n = 220, ang = 1.74, col = [.82, .85, .92], alpha = .5, speed = 1, near = .25, seed = 1, xmax = 1e9 } = {}) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let i = 0; i < n; i++) {
    const r1 = hash(i * 1.37 + seed), r2 = hash(i * 7.11 + seed), r3 = hash(i * 3.3 + seed);
    const isNear = r3 < near, v = (isNear ? 2600 : 1500 + r2 * 700) * speed;
    const len = isNear ? 140 + r1 * 80 : 45 + r2 * 60;
    const span = H * 1.4;
    const d = ((r2 * span + v * t) % span) - H * .2;
    const x = r1 * W * 1.25 - W * .1 + dx * d, y = d * dy;
    if (x > xmax) continue;
    out.push({ x, y, ang, len, wid: isNear ? 3.4 : 1.4 + r1 * 1.2, c: col, c2: col.map(c => c * .9), seed: i, type: LINE, alpha: alpha * (isNear ? .45 : .6 + r3 * .4), hgt: .2 });
  }
}
// ---- splashes on a ground rect (scene space), scale by fs(y)
export function splashes(out, t, { x0, x1, y0, y1, n = 40, fs = () => 1, col = [.85, .87, .93], alpha = .6, seed = 3 } = {}) {
  for (let i = 0; i < n; i++) {
    const per = .45 + hash(i + seed) * .3, ph = ((t + hash(i * 3.1 + seed) * per) % per) / per;
    const cyc = Math.floor((t + hash(i * 3.1 + seed) * per) / per);
    const x = lerp(x0, x1, hash(i * 5.3 + cyc * 1.7 + seed)), y = lerp(y0, y1, Math.pow(hash(i * 9.1 + cyc * .7 + seed), 1.6));
    const s = fs(y) * 14;
    if (ph < .6) out.push({ x, y, ang: 0, len: s * (1 + ph * 2.2), wid: s * (.3 + ph * .5), c: col, seed: i, type: DAB, alpha: alpha * (1 - ph / .6), hgt: .4 });
    if (ph < .3) for (const k of [-1, 1]) out.push({ x: x + k * s * ph * 3, y: y - s * (1.2 * ph - ph * ph * 2) * 3, ang: 0, len: s * .35, wid: s * .3, c: col, seed: i + k, type: DAB, alpha: alpha * .8, hgt: .3 });
  }
}

// ---- a music ribbon: brush strokes laid along path(u) (u 0..1), appearing over `dur`, colour cycling
export function ribbon(out, path, t, t0, dur, { cols = ['#f0b040'], wid = 22, n = 26, life = 2.5, drip = 0, alpha = 1, seed = 1, fade = .8 } = {}) {
  if (t < t0) return;
  for (let k = 0; k < n; k++) {
    const u0 = k / n, u1 = (k + 1) / n, ta = t0 + u0 * dur;
    if (t < ta) break;
    const age = t - ta, a = alpha * clamp(1 - (age - life) / fade);
    if (a <= .01) continue;
    const grow = clamp((t - ta) / (dur / n) ), u1g = u0 + (u1 - u0) * grow;
    const [xa, ya] = path(u0), [xb, yb] = path(u1g);
    const dy = drip * age * age * 40;
    const w = wid * Math.sin(Math.PI * clamp(.08 + u0 * .92)) * (1 - drip * clamp(age / 3) * .4);
    const c = hex(cols[k % cols.length]), c2 = hex(cols[(k + 1) % cols.length]);
    out.push({ x: (xa + xb) / 2, y: (ya + yb) / 2 + dy, ang: Math.atan2(yb - ya, xb - xa), len: Math.hypot(xb - xa, yb - ya) * 1.9 + w * .6, wid: Math.max(2, w), c, c2, seed: seed * 50 + k, type: BRUSH, alpha: a, hgt: 1.2 });
    if (drip > 0 && age > .6 && hash(k + seed) > .55) {        // rain washes the colour down in thin runs
      const L = Math.min(90, (age - .6) * 70) * drip;
      out.push({ x: (xa + xb) / 2, y: (ya + yb) / 2 + dy + L / 2, ang: Math.PI / 2, len: L, wid: Math.max(2, w * .25), c, seed: seed * 70 + k, type: BRUSH, alpha: a * .7, hgt: .8 });
    }
  }
}
