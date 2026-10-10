// The honeybee (Apis mellifera, worker), dorsal view, wings spread as on a 19th-century natural-history plate.
// Built entirely from the burin engine. Local frame: plate px at scale 1, thorax/abdomen junction at (0,0), head up (−y).
//   buildBee({ x, y, s }) → { ink, regions, focus, groups }
//   ink groups, in cutting order: 'ol' (outlines + veins), 'h1' (first hatch families), 'h2' (cross-hatching),
//   'h3' (deep darks, stipple, hair).
//   regions: named Path2D + polys for hand-colouring (abdomen, thorax, head, eyes, wings, legs, pollen).
//   focus: named world points for the magnified details (eye, hamuli, corbicula) + which side of the plate they sit.
import * as B from '../engine/burin.js';
const { shape, ring, xf, clamp, ellipsePts, sphereTone, cylTone, hatch, engraveTone, outline, stroke, stipple, fur, RNG, noise2, inPoly, addT } = B;

const L = { x: -0.55, y: -0.62, z: 0.56 };               // light from the upper left, as on every plate of the period
const LV = [L.x, L.y];

// a tapered capsule between two points (leg and antenna segments)
function capsule(a, b, w0, w1, n = 10) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, px = -uy, py = ux, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, w = (w0 + (w1 - w0) * t) / 2, bulge = 1 + 0.12 * Math.sin(Math.PI * t); pts.push([a[0] + dx * t + px * w * bulge, a[1] + dy * t + py * w * bulge]); }
  for (let i = 0; i <= 8; i++) { const th = -Math.PI / 2 + Math.PI * i / 8; pts.push([b[0] + (ux * Math.cos(th) - px * Math.sin(th)) * w1 / 2 * 0.9, b[1] + (uy * Math.cos(th) - py * Math.sin(th)) * w1 / 2 * 0.9]); }
  for (let i = n; i >= 0; i--) { const t = i / n, w = (w0 + (w1 - w0) * t) / 2, bulge = 1 + 0.12 * Math.sin(Math.PI * t); pts.push([a[0] + dx * t - px * w * bulge, a[1] + dy * t - py * w * bulge]); }
  for (let i = 0; i <= 8; i++) { const th = Math.PI / 2 + Math.PI * i / 8; pts.push([a[0] + (ux * Math.cos(th) - px * Math.sin(th)) * w0 / 2 * 0.9, a[1] + (uy * Math.cos(th) - py * Math.sin(th)) * w0 / 2 * 0.9]); }
  return { ...ring(pts), a, b, ang: Math.atan2(dy, dx), len, w0, w1 };
}
const mid = (a, b, t = 0.5) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// engrave a tube-like segment: outline, hatching along its axis in the shadow, rings across it in the deep dark
function tube(ink, c, { w = 1.3, spacing = 3.2, dark = 0, seed = 1, hairs = 0, hairLen = 9, hairSide = 1, excl = null } = {}) {
  const r = Math.max(c.w0, c.w1) / 2, cm = mid(c.a, c.b);
  // cylinder shading along the segment, deepened at both joints (where the next segment's rim shadows it)
  const joint = (x, y) => { const ux = Math.cos(c.ang), uy = Math.sin(c.ang), along = (x - c.a[0]) * ux + (y - c.a[1]) * uy, e = Math.min(along, c.len - along); return 0.38 * Math.exp(-((e / (r * 0.9)) ** 2)); };
  const tone = addT(cylTone(cm[0], cm[1], r * 1.05, c.ang, { L }), dark, 0.12, joint);
  ink.group('ol'); outline(ink, c.polys[0], { w, light: LV, vary: 0.9, seed, excl });
  ink.group('h1'); hatch(ink, c.polys, { angle: c.ang, spacing: spacing * 0.8, tone, thr: 0.16, wMax: 1.3, wMin: 0.16, seed, taper: 5, excl });
  ink.group('h2'); hatch(ink, c.polys, { angle: c.ang + Math.PI / 2 - 0.25, spacing: spacing * 1.05, tone, thr: 0.5, wMax: 1.0, wMin: 0.16, seed: seed + 3, taper: 3, excl });
  if (hairs) {
    ink.group('h3');
    const R = RNG(seed + 40), ux = Math.cos(c.ang), uy = Math.sin(c.ang), px = -uy, py = ux;
    for (let i = 0; i < hairs; i++) {
      const t = 0.08 + 0.84 * R(), side = R() < 0.72 ? hairSide : -hairSide, ww = (c.w0 + (c.w1 - c.w0) * t) / 2;
      const bx = c.a[0] + (c.b[0] - c.a[0]) * t + px * ww * side * 0.92, by = c.a[1] + (c.b[1] - c.a[1]) * t + py * ww * side * 0.92;
      const ln = hairLen * (0.6 + R() * 0.7), lean = 0.55 + R() * 0.3;
      if (excl && B.inAny(excl, bx, by)) continue;
      stroke(ink, [[bx, by], [bx + (px * side * (1 - lean) + ux * lean) * ln * 0.5, by + (py * side * (1 - lean) + uy * lean) * ln * 0.5], [bx + (px * side * (1 - lean) * 0.8 + ux * lean) * ln, by + (py * side * (1 - lean) * 0.8 + uy * lean) * ln]], 0.75, { taper: 5 });
    }
  }
  return c;
}

// ---- wing outlines and venation in wing-local units (x along the wing, −y = leading edge) ----
// Apis forewing, after the classic honeybee venation diagrams (Snodgrass 1910/1925, public domain; reference only):
// a long narrow marginal cell along the leading edge beyond the stigma, three submarginal cells beneath it
// (the 2nd narrowest, the 3rd oblique), the long medial (basal) cell, two discoidal cells, and bare membrane
// beyond about 85 % of the length — the veins never reach the tip.
export const FORE = 'M0 -7 C70 -22 200 -31 288 -23 C327 -19 339 6 322 27 C296 51 218 64 150 58 C96 52 46 37 0 11 Z';
// long veins as named curves; cross-veins are snapped onto them so every cell closes
const FV = {
  R: ['M3 -4 C40 -12 80 -17 104 -18 C124 -19 140 -20 150 -21', 2.3],   // Sc + R, the heavy leading vein
  C: ['M150 -23 C190 -26 250 -25 297 -13', 1.35],                       // marginal cell, costal side
  Rs: ['M152 -18 C196 -13 250 -9 297 -13', 1.3],                        // marginal cell, lower side
  S1: ['M104 -18 C122 -17.5 140 -17.5 152 -18', 1.15],                  // roof of the 1st submarginal cell
  Ms: ['M4 5 C40 8 70 10 96 13', 1.7],                                   // M + Cu stem
  M: ['M96 13 C130 9 160 7 176 7 C200 7 230 9 262 11', 1.25],           // floor of the submarginal cells
  Cu: ['M96 13 C120 22 150 28 180 31 C206 33 228 32 244 29', 1.3],      // floor of the discoidal cells
  A: ['M8 13 C30 26 58 36 86 42', 1.15],                                // 1st anal vein
  Sp: ['M244 29 C256 32 266 36 274 41', 0.7],                           // spectral vein, fading
};
const FX = [['R', 104, 'Ms', 96, 1.45], ['Rs', 172, 'M', 176, 1.05], ['Rs', 204, 'M', 214, 1.05], ['Rs', 248, 'M', 262, 1.0],
  ['M', 150, 'Cu', 153, 1.05], ['M', 214, 'Cu', 217, 1.0], ['Ms', 60, 'A', 64, 0.95]];
function yOn(d, x) { const P = B.parseD(d, 1)[0].pts; let best = P[0], bd = Infinity; for (const p of P) { const e = Math.abs(p[0] - x); if (e < bd) { bd = e; best = p; } } return best[1]; }
export const FORE_VEINS = [...Object.values(FV), ['M138 -21 C146 -22 152 -21 156 -17', 2.6],
  ...FX.map(([a, xa, b, xb, w]) => { const ya = yOn(FV[a][0], xa), yb = yOn(FV[b][0], xb); return [`M${xa} ${ya} C${xa + (xb - xa) * 0.33} ${ya + (yb - ya) * 0.33} ${xa + (xb - xa) * 0.66} ${ya + (yb - ya) * 0.66} ${xb} ${yb}`, w]; })];
export const HIND = 'M0 -5 C60 -15 150 -19 208 -9 C236 -3 241 20 222 34 C190 52 120 50 70 36 C36 26 12 14 0 7 Z';
export const HIND_VEINS = [
  ['M4 -3 C40 -9 80 -12 118 -12', 1.6],                              // R
  ['M6 5 C40 8 70 11 96 13', 1.4],                                   // M + Cu
  ['M96 13 C130 15 160 18 190 20', 0.95],                            // M
  ['M96 13 C116 22 136 30 156 36', 0.95],                            // Cu
  ['M112 -12 C109 -3 103 6 96 13', 1.0],                             // r-m cross-vein
  ['M8 12 C28 20 48 27 70 31', 1.0],                                 // anal
];
export const HAMULI_U = [118, 152];                          // hooks along the hindwing leading edge (wing-local x)

export function wing(ink, d, veins, f, seed, { hamuli = false, excl = null } = {}) {
  const sh = shape(d, f, 1.5);
  ink.group('ol'); outline(ink, sh.polys[0], { w: 1.15, light: LV, vary: 0.5, seed, excl });
  for (const [vd, w] of veins) { const v = shape(vd, f, 1.5); for (const l of v.lines) stroke(ink, l, w * 0.85, { taper: 2.5, swell: false, w0: 1.15, w1: 0.8, excl }); }
  // membrane: a very pale, open hatching near the root, fading to bare paper toward the tip (the wing is glass)
  const [rx, ry] = f([0, 0]), [tx, ty] = f([300, 0]);
  const tone = (x, y) => { const u = ((x - rx) * (tx - rx) + (y - ry) * (ty - ry)) / ((tx - rx) ** 2 + (ty - ry) ** 2); return clamp(0.5 - u * 0.55 + 0.12 * (noise2(x / 30, y / 30, seed) - 0.5)); };
  ink.group('h1'); hatch(ink, sh.polys, { angle: Math.atan2(ty - ry, tx - rx) + 0.55, spacing: 4.4, tone, thr: 0.14, wMax: 0.75, wMin: 0.182, gamma: 0.9, seed, taper: 6, wobble: 0.25, excl });
  ink.group('h3'); stipple(ink, sh.polys, { density: 0.006, tone: (x, y) => 0.25 + tone(x, y) * 0.6, r: 0.45, seed: seed + 5, thr: 0.1, excl });
  if (hamuli) {
    ink.group('h3');
    for (let u = HAMULI_U[0]; u <= HAMULI_U[1]; u += 6) { const a = f([u, -13]), b = f([u + 1, -15.5]), c = f([u - 0.6, -16.4]); stroke(ink, [a, b, c], 0.45, { taper: 1.5 }); }
  }
  return sh;
}

export function buildBee({ x = 960, y = 560, s = 1, seed = 7 } = {}) {
  const W = xf(x, y, s), P = p => W(p);
  const ink = new B.Ink(), regions = {}, add = (name, sh) => { (regions[name] ||= []).push(sh); };
  const S = v => v * s;
  // the body shapes come first: they occlude wings and legs (the engraver simply stops the lines at them)
  const ABD = null;
  const TH = 'M0 -172 C50 -172 80 -140 80 -92 C80 -44 52 -8 0 -6 C-52 -8 -80 -44 -80 -92 C-80 -140 -50 -172 0 -172 Z';
  const HD = 'M0 -242 C40 -242 70 -230 75 -202 C79 -174 56 -150 0 -148 C-56 -150 -79 -174 -75 -202 C-70 -230 -40 -242 0 -242 Z';
  const CUTS = [32, 84, 134, 182, 224, 258];
  const hwAbd = yy => { const t = clamp((yy - 6) / 284); let h = 93 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.72) * (1 - 0.06 * t);
    if (t > 0.9) h *= 0.55 + 0.45 * Math.cos((t - 0.9) / 0.1 * Math.PI / 2) ** 0.6;
    for (const c of CUTS) h *= 1 - 0.02 * Math.exp(-(((yy - c - 5) / 8) ** 2)) + 0.008 * Math.exp(-(((yy - c + 8) / 12) ** 2));   // each rim overhangs the next segment
    return h; };
  const abdPts = []; for (let yy = 6; yy <= 290; yy += 1.5) abdPts.push([hwAbd(yy), yy]); for (let yy = 290; yy >= 6; yy -= 1.5) abdPts.push([-hwAbd(yy), yy]);
  const abd = ring(abdPts.map(W)), th = shape(TH, W, 1.2), hd = shape(HD, W, 1.2);
  const eyes = [];
  // kidney-shaped compound eyes lying along the sides of the head: their outer edge IS the head's silhouette
  for (const sg of [1, -1]) eyes.push(shape(`M${40 * sg} -238 C${58 * sg} -236 ${73 * sg} -224 ${76 * sg} -202 C${79 * sg} -178 ${66 * sg} -158 ${50 * sg} -151 C${44 * sg} -160 ${47 * sg} -172 ${49 * sg} -186 C${51 * sg} -200 ${47 * sg} -214 ${44 * sg} -224 C${42 * sg} -230 ${40 * sg} -234 ${40 * sg} -238 Z`, W, 1));
  const eyePolys = eyes.flatMap(e => e.polys);
  const pet = B.ellipse(P([0, 2])[0], P([0, 2])[1], S(14), S(8));
  const headX = [...hd.polys, ...eyePolys], bodyX = [...abd.polys, ...th.polys, ...headX, ...pet.polys];
  // ================= wings (drawn first so body and legs sit over their roots) =================
  const wingsSh = [];
  for (const sg of [1, -1]) {
    const mir = p => [p[0] * sg, p[1]];
    const fh0 = xf(54, -76, 1, 0.06), ff0 = xf(58, -118, 1, -0.43);
    const fh = p => W(mir(fh0(p))), ff = p => W(mir(ff0(p))); fh.scale = ff.scale = s;
    wingsSh.push(wing(ink, HIND, HIND_VEINS, fh, seed + 20 + sg, { hamuli: true, excl: bodyX }));
    wingsSh.push(wing(ink, FORE, FORE_VEINS, ff, seed + 30 + sg, { excl: bodyX }));
    if (sg > 0) { regions._hamuliF = fh; }
  }
  for (const w of wingsSh) add('wings', w);

  // ================= legs =================
  const legSeg = [];
  const LEGS = [                                         // right side; mirrored for the left. [points…], widths
    { pts: [[44, -146], [98, -166], [122, -212], [130, -236], [134, -247], [137, -256], [139, -264], [141, -272]], w: [15, 13, 10, 9, 7, 6, 5.5, 5, 4.5], hair: 1 },
    { pts: [[54, -58], [112, -34], [146, 22], [154, 52], [158, 64], [161, 74], [163, 83], [165, 92]], w: [16, 14, 11, 10, 7, 6, 5.5, 5, 4.5], hair: 1 },
    { pts: [[44, 8], [106, 62], [144, 168], [154, 214], [157, 227], [159, 238], [161, 248], [163, 258]], w: [17, 16, 12, 30, 22, 6.5, 6, 5.5, 5], hind: true, hair: 1 },
  ];
  const legsSh = [], pollenSh = [];
  let corb = null;
  for (const sg of [1, -1]) for (const [li, lg] of LEGS.entries()) {
    const Q = lg.pts.map(([px, py]) => P([px * sg, py]));
    for (let k = 0; k < Q.length - 1; k++) {
      let w0 = S(lg.w[k] * (k === 0 ? 1 : 0.95)), w1 = S(lg.w[k + 1]);
      if (lg.hind && k === 1) { w0 = S(13); w1 = S(34); }        // the broad, flattened hind tibia
      if (lg.hind && k === 2) { w0 = S(24); w1 = S(19); }        // the broad basitarsus
      const c = capsule(Q[k], Q[k + 1], w0, w1);
      const segX = k > 0 ? [...bodyX, legsSh[legsSh.length - 1].polys[0]] : bodyX;
      tube(ink, c, { seed: seed + li * 10 + k + (sg > 0 ? 0 : 100), dark: k === 0 ? 0.08 : 0, hairs: k < 3 ? Math.round(c.len / (lg.hind && k === 1 ? 1.6 : 3.2)) : 0, hairLen: lg.hind && k === 1 ? 19 : 11, hairSide: sg * (li === 2 ? 1 : -1), w: k >= 3 ? 1 : 1.35, spacing: k >= 3 ? 2.6 : 3.2, excl: segX });
      legsSh.push(c);
      if (lg.hind && k === 1) {
        // the pollen load packed into the corbicula: a lumpy ball on the outer face of the tibia
        const cm = mid(Q[1], Q[2], 0.56), ang = c.ang, rx = S(31), ry = S(23), R = RNG(seed + (sg > 0 ? 3 : 4)), pts = [];
        for (let i = 0; i < 40; i++) { const th = i / 40 * Math.PI * 2, k2 = 1 + 0.08 * Math.sin(th * 5 + R() * 6) + 0.05 * (R() - 0.5); const lx = Math.cos(th) * rx * k2, ly = Math.sin(th) * ry * k2; pts.push([cm[0] + lx * Math.cos(ang) - ly * Math.sin(ang) + Math.cos(ang + Math.PI / 2) * S(3) * sg, cm[1] + lx * Math.sin(ang) + ly * Math.cos(ang) + Math.sin(ang + Math.PI / 2) * S(3) * sg]); }
        const pl = ring(pts); pollenSh.push(pl);
        ink.group('ol'); outline(ink, pl.polys[0], { w: 1.2, light: LV, vary: 0.9, seed: seed + 60 });
        ink.group('h3'); stipple(ink, pl.polys, { density: 0.09, tone: addT(sphereTone(cm[0], cm[1], rx, ry, { L, rot: ang }), 0.1), r: 0.62, seed: seed + 61, thr: 0.05 });
        if (sg > 0) corb = { x: cm[0], y: cm[1], ang };
      }
    }
    legSeg.push(Q);
  }
  for (const l of legsSh) add('legs', l);
  for (const p of pollenSh) add('pollen', p);

  // ================= abdomen: six tergites, each with a pale felt band in front and a dark shining rim behind =================
  add('abdomen', abd);
  const abdTone = sphereTone(P([0, 140])[0], P([0, 140])[1], S(96), S(165), { L, base: 0.0 });
  const cuts = CUTS, bowOf = i => 12 + i * 3.2;
  ink.group('ol0'); outline(ink, abd.polys[0], { w: 2.3, light: LV, vary: 0.9, seed: seed + 1, run: 170 });   // the first line the burin cuts
  const inAbd = (xx, yy) => inPoly(abd.polys, xx, yy);
  for (let i = 0; i < cuts.length + 1; i++) {
    const y0 = i ? cuts[i - 1] : -14, y1 = i < cuts.length ? cuts[i] : 300, b0 = i ? bowOf(i - 1) : 10, b1 = i < cuts.length ? bowOf(i) : 10;
    const edge = (yy, bw) => { const E = []; for (let k = 0; k <= 30; k++) { const xx = -100 + 200 * k / 30, q = 1 - (xx / 100) ** 2; E.push(P([xx, yy + bw * q])); } return E; };
    const band = ring([...edge(y0, b0), ...edge(y1, b1).reverse()]);
    // within one tergite: dark shadow under the rim of the one in front, a pale felt band, then the bare shining plate, lighter again at its own rim
    const segT = (xx, yy) => {
      if (!inAbd(xx, yy)) return 0;
      const lx = (xx - x) / s, ly = (yy - y) / s, q = 1 - (lx / 100) ** 2, top = y0 + b0 * q, bot = y1 + b1 * q, v = clamp((ly - top) / (bot - top));
      let t = abdTone(xx, yy) * 0.85 + 0.08;
      if (i > 0) t += 0.5 * (1 - B.sstep(0.0, 0.16, v));                           // cast shadow under the overlapping rim
      if (i > 0 && i < 5) t -= 0.32 * B.sstep(0.1, 0.18, v) * (1 - B.sstep(0.38, 0.5, v));   // felt band
      t += 0.22 * B.sstep(0.5, 0.85, v) - 0.18 * B.sstep(0.88, 1, v);               // bare plate, then the lit rim
      return clamp(t);
    };
    const inter = clipPolys(band, abd);
    ink.group('h1'); hatch(ink, inter, { angle: 0, bend: -((b0 + b1) / 2) / (100 * 100 * s), a0: 0, origin: P([0, (y0 + y1) / 2]), spacing: 3.1, tone: segT, thr: 0.14, wMax: 1.9, seed: seed + 70 + i, taper: 8 });
    ink.group('h2'); hatch(ink, inter, { angle: 0.9, spacing: 3.6, tone: segT, thr: 0.48, wMax: 1.4, seed: seed + 80 + i, taper: 5 });
    ink.group('h3'); hatch(ink, inter, { angle: -0.9, spacing: 4.2, tone: segT, thr: 0.74, wMax: 1.05, seed: seed + 90 + i, taper: 4 });
    // the rim of this tergite, cut as one swelling stroke lying over the next
    if (i < cuts.length) { ink.group('ol'); const rim = edge(y1, b1).filter(p => inAbd(p[0], p[1])); stroke(ink, rim, 2.2, { taper: 30 }); }
    // the felt band: short hairs combed back
    if (i > 0 && i < 5) {
      ink.group('h3');
      const felt = clipPolys(ring([...edge(y0 + (y1 - y0) * 0.1, b0), ...edge(y0 + (y1 - y0) * 0.45, (b0 + b1) / 2).reverse()]), abd);
      fur(ink, felt, { density: 0.07, len: 6.5, w: 0.75, seed: seed + 100 + i, dir: (xx, yy) => { const lx = (xx - x) / s; return norm([lx * 0.005, 1]); }, tone: () => 0.45, curl: 0.35 });
    }
  }
  // fringe of hairs along the flanks
  { const R = RNG(seed + 44); ink.group('h3'); for (const [px, py] of B.resample(abd.polys[0], 3.5)) { const ly = (py - y) / s; if (ly < 20 || ly > 250 || R() < 0.4) continue; const d = norm([px - x, (py - (y + 140 * s)) * 0.3]); const ln = (4 + R() * 5) * s; stroke(ink, [[px - d[0] * 2, py - d[1] * 2], [px + d[0] * ln, py + d[1] * ln + ln * 0.4]], 0.6, { taper: 3 }); } }

  // ================= thorax: a hairy dome =================
  add('thorax', th);
  const thC = P([0, -92]), thTone = sphereTone(thC[0], thC[1], S(82), S(86), { L, base: 0.08 });
  ink.group('ol'); outline(ink, th.polys[0], { w: 2.0, light: LV, vary: 0.9, seed: seed + 2, excl: headX });
  ink.group('h1'); hatch(ink, th.polys, { angle: -0.5, bend: 0.0042 / s, spacing: 3.3, tone: thTone, thr: 0.14, wMax: 2.0, wMin: 0.18, seed: seed + 3, excl: headX });
  ink.group('h2'); hatch(ink, th.polys, { angle: 0.6, bend: -0.003 / s, spacing: 3.7, tone: thTone, thr: 0.46, wMax: 1.55, wMin: 0.18, seed: seed + 4, excl: headX });
  ink.group('h3'); hatch(ink, th.polys, { angle: 1.4, spacing: 4.4, tone: thTone, thr: 0.74, wMax: 0.9, wMin: 0.18, seed: seed + 5, excl: headX });
  // scutellum: a lip at the back of the thorax, with the suture line in front of it
  const sc = shape('M-44 -30 C-30 -14 30 -14 44 -30 C40 -8 22 2 0 2 C-22 2 -40 -8 -44 -30 Z', W, 1.2);
  ink.group('ol'); stroke(ink, sc.polys[0].slice(0, Math.floor(sc.polys[0].length * 0.45)), 1.6, { taper: 12 });
  // the pile: dense hairs combed out from the centre, longest at the rim, some standing out past the outline
  ink.group('h3');
  fur(ink, th.polys, { density: 0.045, len: 11 * s, w: 0.85, seed: seed + 6, dir: (xx, yy) => norm([xx - thC[0], yy - thC[1] + 10 * s]), tone: thTone, curl: 0.5, excl: headX });
  { const rimR = RNG(seed + 7), P0 = B.resample(th.polys[0], 2.4 * s);
    for (const [px, py] of P0) { if (rimR() < 0.35) continue; const d = norm([px - thC[0], py - thC[1]]), ln = (7 + rimR() * 9) * s, c = (rimR() - 0.5) * 0.6; if (B.inAny(headX, px + d[0] * ln, py + d[1] * ln) || B.inAny(headX, px, py)) continue; stroke(ink, [[px - d[0] * 4 * s, py - d[1] * 4 * s], [px + d[0] * ln * 0.5 + d[1] * c * ln * 0.3, py + d[1] * ln * 0.5 - d[0] * c * ln * 0.3], [px + d[0] * ln + d[1] * c * ln, py + d[1] * ln - d[0] * c * ln]], 0.7, { taper: 4 }); } }
  // petiole (the waist) — a small dark knot between thorax and abdomen
  ink.group('ol'); outline(ink, pet.polys[0], { w: 1.4, light: LV });
  ink.group('h2'); hatch(ink, pet.polys, { angle: 0, spacing: 2.2, tone: () => 0.8, wMax: 1.1, seed: 5, taper: 2 });

  // ================= head, eyes, ocelli, antennae =================
  add('head', hd);
  const hC = P([0, -194]), hTone = sphereTone(hC[0], hC[1], S(70), S(48), { L, base: 0.1 });
  ink.group('ol'); outline(ink, hd.polys[0], { w: 1.9, light: LV, vary: 0.9, seed: seed + 8, excl: eyePolys });
  ink.group('h1'); hatch(ink, hd.polys, { angle: -0.35, bend: 0.005 / s, spacing: 3.1, tone: hTone, thr: 0.14, wMax: 1.8, wMin: 0.18, seed: seed + 9, excl: eyePolys });
  ink.group('h2'); hatch(ink, hd.polys, { angle: 0.75, spacing: 3.6, tone: hTone, thr: 0.5, wMax: 1.4, wMin: 0.18, seed: seed + 10, excl: eyePolys });
  ink.group('h3'); fur(ink, hd.polys, { density: 0.03, len: 7 * s, w: 0.75, seed: seed + 11, dir: (xx, yy) => norm([(xx - hC[0]) * 0.6, -1]), tone: hTone, curl: 0.4 });
  for (const [k, e] of eyes.entries()) {
    add('eyes', e);
    const ec = [(e.bbox[0] + e.bbox[2]) / 2, (e.bbox[1] + e.bbox[3]) / 2], et = sphereTone(ec[0], ec[1], (e.bbox[2] - e.bbox[0]) / 2, (e.bbox[3] - e.bbox[1]) / 2, { L, base: 0.28 });
    ink.group('ol'); outline(ink, e.polys[0], { w: 1.6, light: LV, vary: 0.8, seed: seed + 12 + k });
    // the faceted surface: tone hatching, then a lattice of tiny hexagonal facets wrapped onto the eye's curve
    const hl = B.ellipse(ec[0] - S(6), ec[1] - S(16), S(7), S(10), -0.4).polys;
    ink.group('h1'); hatch(ink, e.polys, { angle: 0.5, spacing: 2.6, tone: et, thr: 0.3, wMax: 0.95, wMin: 0.18, seed: seed + 13 + k, excl: hl, taper: 3 });
    ink.group('h3'); hatch(ink, e.polys, { angle: -0.55, spacing: 2.8, tone: et, thr: 0.62, wMax: 0.8, wMin: 0.18, seed: seed + 15 + k, excl: hl, taper: 3 });
    { const erx = (e.bbox[2] - e.bbox[0]) / 2, ery = (e.bbox[3] - e.bbox[1]) / 2, a = 0.075, TH = Math.PI / 2 * 0.9;
      const toS = (qx, qy) => { const r = Math.hypot(qx, qy); if (r < 1e-9) return [ec[0], ec[1]]; const kk = Math.sin(r * TH) / r; return [ec[0] + qx * kk * erx, ec[1] + qy * kk * ery]; };
      ink.group('h2');
      for (let j = -16; j <= 16; j++) for (let i = -16; i <= 16; i++) {
        const qx = (i + (j & 1) * 0.5) * a * Math.sqrt(3) * (ery / erx), qy = j * a * 1.5; if (Math.hypot(qx, qy) > 1) continue;
        const pts = []; let ok = true;
        for (let m = 0; m <= 6; m++) { const an = Math.PI / 6 + m * Math.PI / 3, p = toS(qx + Math.cos(an) * a * (ery / erx), qy + Math.sin(an) * a); if (!inPoly(e.polys, p[0], p[1])) { ok = false; break; } pts.push(p); }
        if (!ok) continue;
        const c = toS(qx, qy), tv = et(c[0], c[1]);
        ink.add(pts, 0.28 + 0.3 * tv);
      } }
  }
  // ocelli: three simple eyes on the crown
  ink.group('ol');
  for (const [ox, oy, r] of [[0, -224, 4.6], [-12, -214, 4.2], [12, -214, 4.2]]) { const c = P([ox, oy]); const e = B.ellipse(c[0], c[1], S(r), S(r)); outline(ink, e.polys[0], { w: 1.1, light: LV, vary: 1 }); ink.group('h2'); hatch(ink, e.polys, { angle: 0.7, spacing: 1.6, tone: sphereTone(c[0], c[1], S(r), S(r), { L, base: 0.2 }), thr: 0.4, wMax: 0.8, taper: 1 }); ink.group('ol'); }
  // antennae: elbowed — a long scape, then the flagellum in short beads
  const antSh = [];
  for (const sg of [1, -1]) {
    const pts = [[14, -234], [30, -284], [44, -296], [55, -304], [65, -312], [74, -319], [82, -327], [89, -335], [95, -344], [100, -353], [104, -362], [107, -371]].map(([px, py]) => P([px * sg, py]));
    const ws = [7, 6.5, 6, 6, 5.8, 5.8, 5.6, 5.5, 5.4, 5.3, 5.2, 5];
    for (let k = 0; k < pts.length - 1; k++) { const c = capsule(pts[k], pts[k + 1], S(ws[k]), S(ws[k + 1]) * (k ? 0.92 : 1), 6); tube(ink, c, { seed: seed + 200 + k, w: 1.05, spacing: 2.2, hairs: k === 0 ? 5 : 0, hairLen: 5, excl: headX }); antSh.push(c); }
  }
  for (const a of antSh) add('legs', a);

  // ---------- regions → one Path2D each, for the colourist ----------
  const reg = {};
  for (const [k, list] of Object.entries(regions)) { if (k.startsWith('_')) continue; const p = new Path2D(); for (const sh of list) p.addPath(sh.path); reg[k] = { path: p, polys: list.flatMap(sh => sh.polys), bbox: B.bboxOf(list.flatMap(sh => sh.polys)) }; }
  // focus points for the magnified details
  const fh = regions._hamuliF;
  const focus = {
    eye: { x: P([-62, -194])[0], y: P([-62, -194])[1], r: S(34) },
    hamuli: { x: fh([123, -14])[0], y: fh([123, -14])[1], r: S(36) },
    corbicula: { x: corb.x, y: corb.y, r: S(38) },
  };
  return { ink, regions: reg, focus, center: [x, y], s };
}

// ---------- small helpers ----------
function compose2(outer, inner) { const f = p => outer(inner(p)); f.scale = (outer.scale || 1) * (inner.scale || 1); return f; }
function norm([a, b]) { const l = Math.hypot(a, b) || 1; return [a / l, b / l]; }
// intersection of a band ring with a shape: hatch() clips even-odd, so we return the band only and let tone() mask
// outside points to 0 — here we simply sample the band ring and pull points outside the shape onto its boundary.
function clipPolys(band, sh) {
  const out = band.polys[0].map(p => inPoly(sh.polys, p[0], p[1]) ? p : nearestOn(sh.polys[0], p));
  return [out];
}
function nearestOn(P, [x, y]) {
  let best = null, bd = Infinity;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)), px = a[0] + dx * t, py = a[1] + dy * t, d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; best = [px, py]; } }
  return best;
}
