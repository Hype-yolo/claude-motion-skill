// The Bell Founder · close-up maquettes: a tiny height-field sculptor (capsules, blobs, planks) → lit grayscale
// image → woodcutFilter. Used for the long close-up of the old founder's hands (fine engraving density).
import * as WC from './engine/index.js';
import { clamp, mulberry } from '/core/lib.js';

// height-field canvas
export class Sculpt {
  constructor(w, h) { this.w = w; this.h = h; this.H = new Float32Array(w * h).fill(-1); this.id = new Int16Array(w * h).fill(-1); this.mat = []; }
  // tapered capsule a→b, radii ra→rb, zs = height scale, z0 = base height offset
  capsule(a, b, ra, rb, { zs = 1, z0 = 0, mat = 0, smooth = 6 } = {}) {
    const [ax, ay] = a, [bx, by] = b, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const x0 = Math.max(0, Math.floor(Math.min(ax - ra, bx - rb))), x1 = Math.min(this.w - 1, Math.ceil(Math.max(ax + ra, bx + rb)));
    const y0 = Math.max(0, Math.floor(Math.min(ay - ra, by - rb))), y1 = Math.min(this.h - 1, Math.ceil(Math.max(ay + ra, by + rb)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = clamp(((x - ax) * dx + (y - ay) * dy) / L2), px = ax + dx * u - x, py = ay + dy * u - y, d = Math.hypot(px, py), r = ra + (rb - ra) * u;
      if (d >= r) continue;
      this.put(x, y, z0 + Math.sqrt(r * r - d * d) * zs, mat, smooth);
    }
  }
  blob(cx, cy, rx, ry, rot, { zs = 1, z0 = 0, mat = 0, smooth = 8 } = {}) {
    const c = Math.cos(rot), s = Math.sin(rot), R = Math.max(rx, ry);
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(this.h - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(this.w - 1, Math.ceil(cx + R)); x++) {
      const u = ((x - cx) * c + (y - cy) * s) / rx, v = (-(x - cx) * s + (y - cy) * c) / ry, q = u * u + v * v;
      if (q >= 1) continue;
      this.put(x, y, z0 + Math.sqrt(1 - q) * Math.min(rx, ry) * zs, mat, smooth);
    }
  }
  // a plank: polygon with a bevelled edge of width bev, flat top at z
  plank(P, z, bev = 10, mat = 2) {
    const [cv, q] = WC.canvas(this.w, this.h); q.fillStyle = '#fff'; q.beginPath(); WC.pathOf(q, P); q.fill();
    const reg = new WC.Region([P], { res: 1 });
    const a = q.getImageData(0, 0, this.w, this.h).data;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { if (a[(y * this.w + x) * 4 + 3] < 128) continue; const d = reg.dist(x, y); this.put(x, y, z * Math.min(1, Math.sqrt(clamp(d / bev))), mat, 0, true); }
  }
  put(x, y, z, mat, smooth, hard = false) {
    const i = y * this.w + x, o = this.H[i];
    if (o < 0 || hard) { if (hard && o > z) return; this.H[i] = z; this.id[i] = mat; return; }
    if (smooth > 0) { const k = smooth, h = clamp(.5 + .5 * (z - o) / k); const v = o * (1 - h) + z * h + k * h * (1 - h); if (v > o) { this.H[i] = v; if (z > o) this.id[i] = mat; } }
    else if (z > o) { this.H[i] = z; this.id[i] = mat; }
  }
  // ripple creases across a joint (lines perpendicular to dir), dents the surface
  creases(cx, cy, dir, rad, n = 4, depth = 1.6, gap = 4.5) {
    const c = Math.cos(dir), s = Math.sin(dir);
    for (let y = Math.max(0, Math.floor(cy - rad)); y < Math.min(this.h, cy + rad); y++) for (let x = Math.max(0, Math.floor(cx - rad)); x < Math.min(this.w, cx + rad); x++) {
      const i = y * this.w + x; if (this.H[i] < 0) continue;
      const along = (x - cx) * c + (y - cy) * s, across = -(x - cx) * s + (y - cy) * c, f = clamp(1 - Math.hypot(along * 1.4, across) / rad);
      if (Math.abs(along) > n * gap * .5) continue;
      this.H[i] -= depth * f * Math.max(0, Math.cos(along / gap * Math.PI * 2)) ** 3 * (1 + .4 * Math.sin(across * .3));
    }
  }
  noise(amp, seed = 1) { const r = mulberry(seed); for (let i = 0; i < this.H.length; i++) if (this.H[i] >= 0) this.H[i] += (r() - .5) * amp; }
  // light it → grayscale canvas (alpha = inside)
  shade(L, { amb = .08, spec = .25, mats = {} } = {}) {
    const { w, h, H } = this, [cv, q] = WC.canvas(w, h), img = q.createImageData(w, h), d = img.data;
    const Hs = H;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (Hs[i] < 0) continue;
      const hx = (Math.max(0, Hs[i + 1]) - Math.max(0, Hs[i - 1])) * .5, hy = (Math.max(0, Hs[i + w]) - Math.max(0, Hs[i - w])) * .5;
      const l = Math.hypot(hx, hy, 1), nx = -hx / l, ny = -hy / l, nz = 1 / l;
      const m = mats[this.id[i]] || {}, dif = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const hv = [L[0], L[1], L[2] + 1], hl = Math.hypot(...hv), sp = Math.pow(Math.max(0, (nx * hv[0] + ny * hv[1] + nz * hv[2]) / hl), m.shin ?? 18) * (m.spec ?? spec);
      const v = clamp((m.amb ?? amb) + (m.k ?? 1) * dif * (m.alb ?? 1) + sp);
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v * 255; d[i * 4 + 3] = 255;
    }
    q.putImageData(img, 0, 0);
    return cv;
  }
}

// ---------------------------------------------------------------- the founder's hands on the strickle board
// returns { hands: grayscale canvas with alpha, clay: grayscale canvas } at (w, h)
export function founderHands(w = 924, h = 456) {
  const k = w / 924;
  const L = WC.light(.62, .55, .42);      // forge light from lower right, grazing
  // --- hands + plank
  const S = new Sculpt(w, h);
  const P = (x, y) => [x * k, y * k];
  // plank (strickle board) lying diagonally, its edge scraping the clay
  S.plank([P(80, 300), P(924, 250), P(924, 318), P(80, 372)], 16 * k, 8 * k, 2);
  // right hand (foreground): forearm from upper left, back of hand, four fingers curling over the board edge
  const fore = (a, b, r0, r1) => S.capsule(P(...a), P(...b), r0 * k, r1 * k, { mat: 1, zs: .75, z0: 18 * k });
  fore([250, -60], [420, 150], 70, 50);                       // forearm (sleeve rolled above)
  S.blob(...P(505, 200), 92 * k, 60 * k, .42, { mat: 0, zs: .55, z0: 22 * k, smooth: 18 * k });   // back of hand
  const fingers = [[[540, 150], [600, 190], [640, 250], [650, 292]], [[560, 178], [626, 222], [660, 276], [664, 314]], [[560, 210], [620, 256], [648, 304], [650, 336]], [[544, 238], [592, 282], [612, 322], [614, 350]]];
  const fr = [[27, 23, 19, 16], [28, 24, 20, 17], [26, 22, 18, 15], [22, 19, 16, 13]];
  fingers.forEach((F, j) => {
    for (let s = 0; s < 3; s++) S.capsule(P(...F[s]), P(...F[s + 1]), fr[j][s] * k, fr[j][s + 1] * k, { mat: 0, zs: .8, z0: 26 * k - s * 4 * k, smooth: 7 * k });
    for (let s = 0; s < 3; s++) S.blob(...P(...F[s]), fr[j][s] * 1.08 * k, fr[j][s] * .95 * k, 0, { mat: 0, zs: .8, z0: 27 * k - s * 4 * k, smooth: 6 * k });   // knuckles
    for (let s = 1; s < 3; s++) { const [x, y] = P(...F[s]), [x2, y2] = P(...F[s + 1]); S.creases(x, y, Math.atan2(y2 - y, x2 - x), fr[j][s] * 1.3 * k, 4, 2.2 * k, 3.6 * k); }
  });
  // thumb: along the near side, pressing the board
  S.capsule(P(430, 215), P(470, 280), 30 * k, 24 * k, { mat: 0, zs: .75, z0: 20 * k });
  S.capsule(P(470, 280), P(520, 318), 24 * k, 18 * k, { mat: 0, zs: .75, z0: 20 * k });
  S.creases(...P(470, 280), .8, 30 * k, 4, 2.4 * k, 4 * k);
  // veins on the back of the hand
  const r = mulberry(4);
  for (const [a, b] of [[[430, 170], [540, 170]], [[440, 196], [556, 206]], [[450, 222], [548, 232]]]) S.capsule(P(a[0], a[1] + r() * 8), P(...b), 4.5 * k, 3 * k, { mat: 0, zs: .7, z0: 40 * k, smooth: 5 * k });
  // left hand (further, partly off frame at left) — a fist on the board
  S.capsule(P(-60, 60), P(110, 210), 64 * k, 46 * k, { mat: 1, zs: .7, z0: 12 * k });
  S.blob(...P(170, 262), 70 * k, 52 * k, .5, { mat: 0, zs: .55, z0: 16 * k, smooth: 16 * k });
  for (let j = 0; j < 4; j++) { const a = [200 + j * 14, 228 + j * 20], b = [236 + j * 12, 286 + j * 16]; S.capsule(P(...a), P(...b), 18 * k, 15 * k, { mat: 0, zs: .8, z0: 18 * k, smooth: 6 * k }); S.creases(...P(...b), .3, 16 * k, 3, 2 * k, 3.4 * k); }
  // rolled sleeves: coarse cloth
  for (const [a, b, r0] of [[[190, -80], [330, 60], 92], [[-90, 20], [40, 150], 84]]) S.capsule(P(...a), P(...b), r0 * k, r0 * .92 * k, { mat: 3, zs: .6, z0: 30 * k, smooth: 10 * k });
  S.noise(.28 * k, 7);
  // sleeve folds
  for (let i = 0; i < 5; i++) { S.creases(...P(250 + i * 14, -10 + i * 16), .9, 80 * k, 2, 5 * k, 14 * k); S.creases(...P(-10 + i * 12, 70 + i * 14), .9, 70 * k, 2, 5 * k, 14 * k); }
  const hands = S.shade(L, { mats: { 0: { alb: 1, spec: .22, shin: 14 }, 1: { alb: .95, spec: .15 }, 2: { alb: .8, spec: .05 }, 3: { alb: .62, spec: 0, amb: 0, k: .9 } } });
  // --- clay (the loam of the mould): a vast curved surface with strickled bands
  const C = new Sculpt(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (y - 280 * k) / (300 * k);
    if (u < -.2) continue;
    const band = Math.sin(x * .02 / k + y * .09 / k) * .8 + Math.sin(y * .35 / k + x * .004 / k) * .5;
    C.H[y * w + x] = 140 * k * Math.sqrt(Math.max(0, 1 - ((x - 700 * k) / (900 * k)) ** 2 - (u - .5) ** 2 * .6)) + band * k; C.id[y * w + x] = 4;
  }
  const clay = C.shade(L, { mats: { 4: { alb: .85, spec: .04, amb: .02 } } });
  return { hands, clay };
}

// ---------------------------------------------------------------- the boy's palm holding the compass (turning point insert)
// lid: 'open' (hinged up, dial + needle visible) | 'half' | 'shut'. Returns { hands } grayscale canvas with alpha.
export function boyCompass(w = 924, h = 456, lid = 'open') {
  const k = w / 924, P = (x, y) => [x * k, y * k];
  const L = WC.light(.5, .38, .72);        // forge light, more frontal so the open palm reads
  const S = new Sculpt(w, h);
  const cx = 500 * k, cy = 250 * k, R = 104 * k;
  // oversized coat cuff swallowing the wrist (bottom left), coarse wool
  S.capsule(P(-40, 560), P(250, 420), 150 * k, 128 * k, { mat: 3, zs: .5, z0: 10 * k, smooth: 10 * k });
  // the palm, cupped, fingers toward the upper right and curling up around the compass
  S.blob(...P(430, 330), 175 * k, 118 * k, -.35, { mat: 0, zs: .45, z0: 14 * k, smooth: 20 * k });
  S.blob(...P(330, 360), 90 * k, 70 * k, -.2, { mat: 0, zs: .5, z0: 16 * k, smooth: 18 * k });   // heel of the hand
  // a child's fingers: short, soft, curling back over the rim toward the compass
  const fingers = [[[566, 222], [624, 190], [660, 186], [668, 206]], [[596, 264], [660, 244], [694, 246], [700, 268]], [[602, 310], [664, 302], [694, 310], [696, 332]], [[584, 352], [634, 352], [660, 362], [660, 382]]];
  const fr = [[30, 27, 24, 20], [31, 28, 25, 21], [30, 27, 24, 20], [26, 23, 21, 18]];
  if (lid !== 'grip') fingers.forEach((F, j) => {
    for (let s = 0; s < 3; s++) S.capsule(P(...F[s]), P(...F[s + 1]), fr[j][s] * k, fr[j][s + 1] * k, { mat: 0, zs: .85, z0: 18 * k + s * 6 * k, smooth: 6 * k });
    for (let s = 1; s < 3; s++) { const [x, y] = P(...F[s]), [x2, y2] = P(...F[s + 1]); S.creases(x, y, Math.atan2(y2 - y, x2 - x), fr[j][s] * 1.1 * k, 3, 1.6 * k, 3.4 * k); }
  });
  // palm lines
  for (const [a, b] of [[[330, 300], [520, 380]], [[360, 250], [500, 300]]]) S.creases(...P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2, 90 * k, 1, 3 * k, 6 * k);
  // compass body: a thick brass disc with a bevelled rim (hard-edged, sits on the palm)
  const disc = (x0, y0, rx, ry, z, bev, mat, force = false) => {
    for (let y = Math.max(0, Math.floor(y0 - ry)); y <= Math.min(h - 1, Math.ceil(y0 + ry)); y++) for (let x = Math.max(0, Math.floor(x0 - rx)); x <= Math.min(w - 1, Math.ceil(x0 + rx)); x++) {
      const d = Math.hypot((x - x0) / rx, (y - y0) / ry); if (d >= 1) continue;
      const v = z * Math.min(1, Math.sqrt((1 - d) * Math.min(rx, ry) / bev));
      if (force) { const i = y * w + x; S.H[i] = Math.max(v, z * .85); S.id[i] = mat; } else S.put(x, y, v, mat, 0, true);
    }
  };
  const ring = (x0, y0, r, dz, wid) => {   // engraved groove around the disc
    for (let y = Math.max(0, Math.floor(y0 - r - wid)); y <= Math.min(h - 1, Math.ceil(y0 + r + wid)); y++) for (let x = Math.max(0, Math.floor(x0 - r - wid)); x <= Math.min(w - 1, Math.ceil(x0 + r + wid)); x++) {
      const i = y * w + x, e = Math.abs(Math.hypot(x - x0, y - y0) - r); if (e < wid && S.H[i] >= 0) S.H[i] -= dz * (1 - e / wid);
    }
  };
  disc(cx, cy, R, R, 58 * k, 10 * k, 5);
  // the bow (ring on top) and the cord up out of frame, to his neck
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; S.blob(cx + Math.cos(a) * 26 * k, cy - R - 24 * k + Math.sin(a) * 20 * k, 9 * k, 9 * k, 0, { mat: 5, zs: .9, z0: 50 * k, smooth: 3 * k }); }
  S.capsule([cx + 6 * k, cy - R - 44 * k], [cx + 150 * k, -20 * k], 7 * k, 7 * k, { mat: 3, zs: .9, z0: 50 * k });
  if (lid === 'open') {
    // dial: recessed white face, dark needle and ticks
    disc(cx, cy, R * .8, R * .8, 46 * k, 1 * k, 6, true);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; S.blob(cx + Math.cos(a) * R * .64, cy + Math.sin(a) * R * .64, (i % 2 ? 4 : 7) * k, (i % 2 ? 4 : 7) * k, 0, { mat: 7, zs: .3, z0: 46 * k, smooth: 0 }); }
    const na = -.95, ca = Math.cos(na), sa = Math.sin(na);
    for (let s = -1; s <= 1; s += 2) S.capsule([cx, cy], [cx + ca * R * .62 * s, cy + sa * R * .62 * s], 9 * k, 1.5 * k, { mat: s > 0 ? 7 : 8, zs: .5, z0: 50 * k, smooth: 0 });
    S.blob(cx, cy, 8 * k, 8 * k, 0, { mat: 5, zs: .8, z0: 52 * k, smooth: 0 });
    // lid hinged up behind: its inner face seen as a foreshortened ellipse above the body
    disc(cx, cy - R * 1.45, R * .98, R * .5, 70 * k, 6 * k, 5); ring(cx, cy - R * 1.45, R * .6, 3 * k, 3 * k);
  } else if (lid === 'half') {
    disc(cx, cy - R * .55, R, R * .62, 96 * k, 6 * k, 5); ring(cx, cy - R * .55, R * .62, 3 * k, 3 * k);
  } else {
    disc(cx, cy, R * .99, R * .99, 72 * k, 8 * k, 5);
    ring(cx, cy, R * .82, 4 * k, 3.5 * k); ring(cx, cy, R * .6, 4 * k, 3.5 * k); ring(cx, cy, R * .22, 3 * k, 3 * k);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; S.capsule([cx + Math.cos(a) * R * .3, cy + Math.sin(a) * R * .3], [cx + Math.cos(a) * R * .54, cy + Math.sin(a) * R * .54], 2.5 * k, 2.5 * k, { mat: 5, zs: .6, z0: 72 * k, smooth: 0 }); }   // a compass-rose chased on the lid
  }
  if (lid === 'grip') {    // fingers fold over the lid: he keeps it
    const G = [[[566, 222], [600, 150], [560, 120], [520, 140]], [[596, 264], [640, 200], [600, 170], [556, 186]], [[602, 310], [646, 262], [610, 236], [566, 248]], [[584, 352], [620, 318], [592, 296], [556, 306]]];
    G.forEach((F, j) => { for (let s2 = 0; s2 < 3; s2++) S.capsule(P(...F[s2]), P(...F[s2 + 1]), (30 - s2 * 3) * k, (27 - s2 * 3) * k, { mat: 0, zs: .85, z0: (80 + s2 * 10) * k, smooth: 6 * k });
      S.creases(...P(...F[1]), Math.atan2(F[2][1] - F[1][1], F[2][0] - F[1][0]), 30 * k, 3, 2 * k, 3.6 * k); });
  }
  // thumb: resting aside while open; pressing the lid down on 'half' / 'shut'
  const th = lid === 'open' ? [[330, 250], [330, 170], [360, 120]] : [[330, 250], [370, 180], [440, 150]];
  S.capsule(P(...th[0]), P(...th[1]), 34 * k, 28 * k, { mat: 0, zs: .8, z0: (lid === 'open' ? 20 : 60) * k, smooth: 8 * k });
  S.capsule(P(...th[1]), P(...th[2]), 28 * k, 22 * k, { mat: 0, zs: .8, z0: (lid === 'open' ? 22 : 100) * k, smooth: 6 * k });
  S.creases(...P(...th[1]), Math.atan2(th[2][1] - th[1][1], th[2][0] - th[1][0]), 26 * k, 3, 1.8 * k, 3.6 * k);
  S.noise(.25 * k, 9);
  for (let i = 0; i < 5; i++) S.creases(...P(120 + i * 30, 470 - i * 24), -.6, 90 * k, 2, 6 * k, 16 * k);   // cuff folds
  const hands = S.shade(L, { mats: { 0: { alb: 1, spec: .2, shin: 14 }, 3: { alb: .55, spec: 0, amb: 0, k: .9 }, 5: { alb: .8, spec: .6, shin: 30 }, 6: { alb: 1.1, spec: 0, amb: .5 }, 7: { alb: .05, spec: 0, amb: 0 }, 8: { alb: .5, spec: .3, amb: .2 } } });
  return { hands };
}
