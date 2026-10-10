// Magnified details of the honeybee, each drawn for a roundel of radius 500 local units (centre 0,0).
// buildDetail(name) → { ink, regions: { name: {path, polys} }, specimen: polys (for the ruled ground to avoid) }
// ink groups: 'ol' outlines, 'h1', 'h2', 'h3' as on the main figure, plus 'rule' (the ruled ground of the roundel).
import * as B from '../engine/burin.js';
const { ring, shape, clamp, hatch, outline, stroke, stipple, RNG, noise2, sphereTone, inPoly, ellipsePts } = B;
const L = { x: -0.55, y: -0.62, z: 0.56 }, LV = [L.x, L.y];

export const DETAILS = { eye: buildEye, hamuli: buildHamuli, corbicula: buildCorbicula };
export function buildDetail(name, o = {}) { return (DETAILS[name] || buildEye)(o); }

// the ruled ground: fine horizontal lines laid by a ruling machine, stopped at the specimen
function ruled(ink, excl, { spacing = 11, w = 1.5 } = {}) {
  ink.group('rule');
  const circ = ring(ellipsePts(0, 0, 486, 486, 0, 96));
  hatch(ink, circ.polys, { angle: 0, spacing, tone: () => 0.6, thr: 0, wMin: w, wMax: w, jitter: 0, wobble: 0.08, taper: 3, excl });
}

// ---------------- Fig. 1 · the compound eye: a lattice of hexagonal facets on a curved surface ----------------
function buildEye({ seed = 3 } = {}) {
  const ink = new B.Ink(), cx = -70, cy = 10, rx = 360, ry = 430, rot = -0.12;
  const eyeRing = ring(ellipsePts(cx, cy, rx, ry, rot, 120));
  // the head capsule on the right: a band of hairy cuticle curving round the eye
  const head = ring(ellipsePts(0, 0, 492, 492, 0, 120));
  const hTone = (x, y) => clamp(0.25 + 0.4 * clamp((x - 200) / 300) + 0.15 * noise2(x / 60, y / 60, 4));
  ink.group('h1'); hatch(ink, head.polys, { angle: 1.1, spacing: 10, tone: hTone, thr: 0.2, wMax: 3.4, wMin: 0.8, excl: eyeRing.polys, seed, step: 3, taper: 14 });
  ink.group('h2'); hatch(ink, head.polys, { angle: -0.4, spacing: 12, tone: hTone, thr: 0.5, wMax: 2.6, wMin: 0.8, excl: eyeRing.polys, seed: seed + 1, step: 3, taper: 10 });
  ink.group('h3'); B.fur(ink, head.polys, { density: 0.0014, len: 70, w: 2.4, seed: seed + 2, dir: (x, y) => { const d = Math.hypot(x - cx, y - cy) || 1; return [(x - cx) / d, (y - cy) / d - 0.3]; }, tone: () => 0.6, curl: 0.5, excl: eyeRing.polys });
  // the eye's rim
  ink.group('ol'); outline(ink, eyeRing.polys[0], { w: 4.2, light: LV, vary: 0.9 });
  // facets: a flat hex lattice wrapped onto a sphere (orthographic), so facets foreshorten toward the rim
  const a = 0.105, TH = Math.PI / 2 * 0.93, c = Math.cos(rot), s = Math.sin(rot);
  const toScreen = (qx, qy) => { const r = Math.hypot(qx, qy); if (r < 1e-9) return [cx, cy, 1, 0, 0]; const th = r * TH, k = Math.sin(th) / r; const X = qx * k, Y = qy * k, nz = Math.cos(th); return [cx + (X * rx) * c - (Y * ry) * s, cy + (X * rx) * s + (Y * ry) * c, nz, X, Y]; };
  const facets = [];
  for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) {
    const qx = (i + (j & 1) * 0.5) * a * Math.sqrt(3), qy = j * a * 1.5;
    if (Math.hypot(qx, qy) > 0.98) continue;
    const pts = []; let ok = true;
    for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + k * Math.PI / 3, vx = qx + Math.cos(an) * a * 0.99, vy = qy + Math.sin(an) * a * 0.99; if (Math.hypot(vx, vy) > 1.0) { ok = false; break; } const p = toScreen(vx, vy); pts.push([p[0], p[1]]); }
    if (!ok) continue;
    const C = toScreen(qx, qy); facets.push({ pts, c: C });
  }
  facets.sort((p, q) => p.c[1] - q.c[1] || p.c[0] - q.c[0]);
  const Ln = Math.hypot(L.x, L.y, L.z);
  for (const [n, f] of facets.entries()) {
    const nz = f.c[2], nx = f.c[3], ny = f.c[4], lam = clamp((nx * L.x + ny * L.y + nz * L.z) / Ln), tone = clamp(0.95 - lam * 1.05 + 0.08 * (noise2(f.c[0] / 90, f.c[1] / 90, 7) - 0.5));
    const hx = ring(f.pts);
    ink.group('ol'); outline(ink, f.pts, { w: 2.2 + 1.2 * (1 - nz), light: LV, vary: 0.9, seed: n, grain: 0.1 });
    ink.group('h1'); hatch(ink, hx.polys, { angle: 0.75, spacing: 7.2, tone: () => tone, thr: 0.22, wMax: 2.6, wMin: 0.7, seed: n + 3, taper: 4, jitter: 0.05, wobble: 0.1, step: 2 });
    ink.group('h2'); hatch(ink, hx.polys, { angle: -0.6, spacing: 7.8, tone: () => tone, thr: 0.58, wMax: 2.0, wMin: 0.7, seed: n + 5, taper: 3, jitter: 0.05, wobble: 0.1, step: 2 });
    // a small curl of highlight, the lens catching the window
    if (tone < 0.72) { ink.group('h3'); const r0 = Math.hypot(f.pts[0][0] - f.c[0], f.pts[0][1] - f.c[1]) * 0.45; stroke(ink, ellipsePts(f.c[0], f.c[1], r0, r0, 0, 8, Math.PI * 0.95, Math.PI * 1.55), 1.3, { taper: 4 }); }
  }
  // hairs standing between the facets (a honeybee's eyes are hairy)
  ink.group('h3');
  const R = RNG(seed + 9);
  for (let k = 0; k < 34; k++) { const f = facets[Math.floor(R() * facets.length)], p = f.pts[Math.floor(R() * 6)], d = [p[0] - cx, p[1] - cy], dl = Math.hypot(...d) || 1, ln = 40 + R() * 60, bend = (R() - 0.5) * 0.8;
    stroke(ink, [p, [p[0] + d[0] / dl * ln * 0.5 + d[1] / dl * bend * 12, p[1] + d[1] / dl * ln * 0.5 - d[0] / dl * bend * 12], [p[0] + d[0] / dl * ln + d[1] / dl * bend * 30, p[1] + d[1] / dl * ln - d[0] / dl * bend * 30]], 2.0, { taper: 10 }); }
  const holed = B.toPath([{ pts: head.polys[0], closed: true }, { pts: eyeRing.polys[0].slice().reverse(), closed: true }]);
  return { ink, regions: { eyes: { path: eyeRing.path, polys: eyeRing.polys }, head: { path: holed, polys: head.polys } }, specimen: head.polys, noRule: true };
}

// ---------------- Fig. 2 · the wing hooks: hamuli on the hindwing's leading edge, caught in the forewing's fold ----------------
function buildHamuli({ seed = 5 } = {}) {
  const ink = new B.Ink();
  const yF = x => -95 + x * 0.1, yH = x => 62 + x * 0.1, FT = 62, VT = 46;            // centre lines: forewing fold, hindwing costa
  const xs = []; for (let x = -560; x <= 560; x += 8) xs.push(x);
  const band = (f, a, b) => ring([...xs.map(x => [x, f(x) + a]), ...xs.slice().reverse().map(x => [x, f(x) + b])]);
  const foreM = ring([...xs.map(x => [x, yF(x) - FT]), [560, -600], [-560, -600]]);
  const fold = band(yF, -FT, FT), gap = band(x => 0, 0, 0);
  const hindM = ring([...xs.map(x => [x, yH(x) + VT]), [560, 600], [-560, 600]]);
  const vein = band(yH, -VT, VT), slit = ring([...xs.map(x => [x, yF(x) + FT]), ...xs.slice().reverse().map(x => [x, yH(x) - VT])]);
  const memT = (x, y) => clamp(0.28 + 0.25 * noise2(x / 160, y / 160, seed));
  for (const [m, ang] of [[foreM, 0.32], [hindM, -0.22]]) {
    ink.group('h1'); hatch(ink, m.polys, { angle: ang, spacing: 12, tone: memT, thr: 0.15, wMax: 1.6, wMin: 0.8, seed: seed + 1, step: 3, taper: 20 });
    ink.group('h3'); stipple(ink, m.polys, { density: 0.0011, tone: () => 0.6, r: 1.9, seed: seed + 2, thr: 0 });
  }
  // the dark slit between the two wings
  ink.group('h2'); hatch(ink, slit.polys, { angle: 0.1, spacing: 5.5, tone: () => 0.85, thr: 0.1, wMax: 2.8, wMin: 0.8, seed: seed + 9, taper: 30, step: 3 });
  // a cross-vein in each membrane
  ink.group('ol');
  stroke(ink, [[250, yF(250) - FT], [285, -330], [320, -600]], 5.5, { taper: 30 });
  stroke(ink, [[-280, yH(-280) + VT], [-310, 330], [-345, 600]], 5.5, { taper: 30 });
  // the forewing's rolled trailing edge: a tube, lit above, dark beneath
  const foldT = (x, y) => { const v = clamp((y - (yF(x) - FT)) / (2 * FT)); return clamp(0.1 + 0.9 * v * v); };
  ink.group('ol'); stroke(ink, xs.map(x => [x, yF(x) - FT]), 3.4, { taper: 40 }); stroke(ink, xs.map(x => [x, yF(x) + FT]), 5, { taper: 40 });
  ink.group('h1'); hatch(ink, fold.polys, { angle: Math.atan(0.1), spacing: 6.5, tone: foldT, thr: 0.18, wMax: 3.2, wMin: 0.8, seed: seed + 3, taper: 20, step: 3 });
  ink.group('h2'); hatch(ink, fold.polys, { angle: 1.35, spacing: 7.5, tone: foldT, thr: 0.55, wMax: 2.4, wMin: 0.8, seed: seed + 4, taper: 8, step: 3 });
  // the hindwing's costal vein: a stout tube
  const veinT = (x, y) => { const v = (y - yH(x)) / VT; return clamp(0.18 + 0.72 * (v * 0.5 + 0.5) ** 1.4); };
  ink.group('ol'); stroke(ink, xs.map(x => [x, yH(x) - VT]), 3.6, { taper: 40 }); stroke(ink, xs.map(x => [x, yH(x) + VT]), 5, { taper: 40 });
  ink.group('h1'); hatch(ink, vein.polys, { angle: Math.atan(0.1), spacing: 6, tone: veinT, thr: 0.22, wMax: 3, wMin: 0.8, seed: seed + 5, taper: 20, step: 3 });
  ink.group('h2'); hatch(ink, vein.polys, { angle: 1.45, spacing: 8.5, tone: veinT, thr: 0.6, wMax: 2.2, wMin: 0.8, seed: seed + 6, taper: 6, step: 3 });
  // the hooks: short stems rise from the vein, arch over the fold and hook down behind it
  const hooks = [];
  for (let k = 0; k < 10; k++) {
    const x0 = -380 + k * 78, yb = yH(x0) - VT + 4, yt = yF(x0) - FT - 10;
    const P = [], n = 30;
    for (let i = 0; i <= n; i++) { const u = i / n; let x, y;
      if (u < 0.55) { const v = u / 0.55; x = x0 + 6 * Math.sin(v * 1.6); y = yb + (yt + 14 - yb) * v; }
      else { const v = (u - 0.55) / 0.45, an = Math.PI * (1.0 + v * 1.15), R0 = 30; x = x0 + 6 * Math.sin(1.6) + R0 + Math.cos(an) * R0; y = yt + 14 + Math.sin(an) * R0 * 1.25; }
      P.push([x, y]); }
    const N = B.normals(P, false), wd = i => (17 - 9 * (i / n)) / 2;
    const poly = ring([...P.map((p, i) => [p[0] + N[i][0] * wd(i), p[1] + N[i][1] * wd(i)]), ...P.slice().reverse().map((p, j) => { const i = n - j; return [p[0] - N[i][0] * wd(i), p[1] - N[i][1] * wd(i)]; })]);
    hooks.push(poly);
    ink.group('ol'); outline(ink, poly.polys[0], { w: 2.5, light: LV, vary: 1, seed: k });
    ink.group('h2'); hatch(ink, poly.polys, { angle: 0.1, spacing: 5, tone: (x) => clamp((x - x0) / 20 + 0.45), thr: 0.45, wMax: 2.2, wMin: 0.6, seed: k + 20, taper: 2, step: 1.5 });
  }
  const whole = ring(ellipsePts(0, 0, 490, 490, 0, 96));
  const hp = new Path2D(); for (const h of hooks) hp.addPath(h.path);
  return { ink, regions: { wings: { path: whole.path, polys: whole.polys }, hooks: { path: hp, polys: hooks.flatMap(h => h.polys) } }, specimen: whole.polys, noRule: true };
}

// ---------------- Fig. 3 · the pollen basket: outer face of the hind tibia, its fringe of long hairs, the packed load ----------------
// Drawn the way the old plates show it: the leg upright and a little tilted, the broad tibia widening toward the foot,
// its smooth hollow face walled in on both sides by long hairs that curve in over the load, the basitarsus below.
function buildCorbicula({ seed = 11 } = {}) {
  const ink = new B.Ink(), tilt = -0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
  const T = ([x, y]) => [x * ct - y * st + 10, x * st + y * ct + 10];
  const inv = ([x, y]) => { const X = x - 10, Y = y - 10; return [X * ct + Y * st, -X * st + Y * ct]; };
  const hw = y => 95 + (y + 560) / 760 * 105;                       // half width of the tibia, widening downward (y −560 … 200)
  const side = sg => { const P = []; for (let y = -600; y <= 200; y += 10) P.push([sg * hw(y) * (1 + 0.03 * Math.sin(y / 60)), y]); return P; };
  const bottom = []; for (let i = 1; i < 12; i++) { const x = hw(200) - 2 * hw(200) * i / 12; bottom.push([x, 200 + 18 * Math.sin(Math.PI * i / 12)]); }
  const tibL = [...side(1), ...bottom, ...side(-1).reverse()];
  const tib = ring(tibL.map(T));
  const basL = [[-hw(200) * 0.86, 186], [hw(200) * 0.9, 190], [hw(200) * 0.82, 420], [hw(200) * 0.7, 560], [-hw(200) * 0.62, 560], [-hw(200) * 0.78, 420]]; const basS = B.parseD(`M${basL[0][0]} ${basL[0][1]} L${basL[1][0]} ${basL[1][1]} C${basL[1][0] + 10} 300 ${basL[2][0] + 6} 380 ${basL[2][0]} ${basL[2][1]} C${basL[2][0] - 4} 500 ${basL[3][0] + 10} 560 ${basL[3][0]} 560 L${basL[4][0]} 560 C${basL[4][0] - 12} 540 ${basL[5][0] - 6} 480 ${basL[5][0]} ${basL[5][1]} C${basL[5][0] - 6} 330 ${basL[0][0] - 8} 250 ${basL[0][0]} ${basL[0][1]} Z`, 3)[0].pts; basL.length = 0; basL.push(...basS);
  const bas = ring(basL.map(T));
  const fem = ring([[-80, -700], [80, -700], [70, -560], [-75, -560]].map(T));
  const loadL = ellipsePts(-6, -170, 150, 235, 0.04, 90).map(([x, y], i) => { const k = 1 + 0.03 * Math.sin(i / 90 * Math.PI * 12 + 1) + 0.02 * Math.sin(i / 90 * Math.PI * 22); return [-6 + (x + 6) * k, -170 + (y + 170) * k]; });
  const load = ring(loadL.map(T));
  // tone of the tibia's face: concave — dark at both walls, bright down the middle, the load's shadow falling below-right of it
  const tibT = (x, y) => { const [lx, ly] = inv([x, y]), w = lx / hw(ly); let t = 0.2 + 0.6 * Math.pow(Math.abs(w), 2.2) + 0.2 * (w > 0 ? w : 0);
    const dx = (lx + 6 - 30) / 150, dy = (ly + 150 - 70) / 230; t += 0.4 * Math.max(0, 1 - Math.hypot(dx, dy)); return clamp(t); };
  const femT = () => 0.55;
  ink.group('ol'); outline(ink, fem.polys[0], { w: 4.4, light: LV, vary: 0.8, seed: seed + 20, excl: tib.polys });
  ink.group('h1'); hatch(ink, fem.polys, { angle: tilt + Math.PI / 2, spacing: 8, tone: femT, thr: 0.2, wMax: 2.6, seed: seed + 21, excl: tib.polys, step: 3, taper: 16 });
  ink.group('ol'); outline(ink, tib.polys[0], { w: 5.6, light: LV, vary: 0.9, seed });
  for (const sg of [-1, 1]) { const P = []; for (let y = -560; y <= 190; y += 10) P.push(T([sg * (hw(y) - 26), y])); stroke(ink, P, 2.4, { taper: 80 }); }
  // contour lines running down the face, following its hollow
  ink.group('h1'); hatch(ink, tib.polys, { angle: tilt + Math.PI / 2, spacing: 8.5, tone: tibT, thr: 0.2, wMax: 3.4, seed: seed + 1, excl: load.polys, step: 3, taper: 24 });
  ink.group('h2'); hatch(ink, tib.polys, { angle: tilt + Math.PI / 2 - 0.9, spacing: 10, tone: tibT, thr: 0.5, wMax: 2.6, seed: seed + 2, excl: load.polys, step: 3, taper: 14 });
  // basitarsus with its rows of stiff comb bristles
  const bT = (x, y) => { const [lx, ly] = inv([x, y]); return clamp(0.25 + 0.5 * B.sstep(-40, 150, lx) + 0.2 * B.sstep(420, 560, ly)); };
  ink.group('ol'); outline(ink, bas.polys[0], { w: 4.8, light: LV, vary: 0.9, seed: seed + 3, excl: tib.polys });
  ink.group('h1'); hatch(ink, bas.polys, { angle: tilt + Math.PI / 2, spacing: 8, tone: bT, thr: 0.2, wMax: 3, seed: seed + 4, step: 3, taper: 16, excl: tib.polys });
  ink.group('h3');
  for (let r = 0; r < 7; r++) for (let k = 0; k < 9; k++) { const lx = -110 + k * 26, ly = 270 + r * 36; const p0 = T([lx, ly]); if (!inPoly(bas.polys, ...p0) || inPoly(tib.polys, ...p0)) continue; stroke(ink, [p0, T([lx + 4, ly + 26])], 2.3, { taper: 8 }); }
  // the pollen press at the joint: a small notch and its spur
  ink.group('ol'); stroke(ink, [T([hw(200) - 20, 196]), T([hw(200) + 12, 222]), T([hw(200) - 8, 240])], 3.4, { taper: 10 });
  // the load, modelled as a ball, granular, with the pale dust of the pollen on its lit side
  const lc = T([-6, -170]), lT = sphereTone(lc[0], lc[1], 150, 235, { L, base: 0.02, rot: tilt });
  ink.group('ol'); outline(ink, load.polys[0], { w: 5.2, light: LV, vary: 1, seed: seed + 5 });
  ink.group('h1'); hatch(ink, load.polys, { angle: tilt + 0.25, bend: 0.0016, spacing: 8, tone: lT, thr: 0.25, wMax: 3, seed: seed + 6, step: 3, taper: 16 });
  ink.group('h2'); hatch(ink, load.polys, { angle: tilt - 0.8, spacing: 9, tone: lT, thr: 0.58, wMax: 2.3, seed: seed + 16, step: 3, taper: 10 });
  ink.group('h3'); stipple(ink, load.polys, { density: 0.004, tone: lT, r: 2.3, seed: seed + 7, thr: 0.08 });
  { const R = RNG(seed + 8); for (let k = 0; k < 90; k++) { const p0 = T([-140 + R() * 270, -360 + R() * 420]); if (!inPoly(load.polys, ...p0) || lT(...p0) > 0.6) continue; const r = 4 + R() * 6; outline(ink, ellipsePts(p0[0], p0[1], r, r * 0.85, R() * 3, 12), { w: 1.5, light: LV, vary: 1, run: 0 }); } }
  // the fringe: long hairs rooted along both edges, curving up and in over the rim of the load
  ink.group('h3');
  const R = RNG(seed + 9);
  for (const sg of [-1, 1]) for (let y = -520; y <= 170; y += 20 + R() * 6) {
    // rooted on the edge, the hair leans out, then its tip curls back in over the basket
    const x0 = sg * hw(y) * 0.985, ln = 100 + R() * 50 + 50 * Math.sin(Math.PI * clamp((y + 545) / 725)), out = 0.35 + R() * 0.2;
    const q1 = [x0 + sg * ln * 0.62, y - ln * 0.12], q2 = [x0 + sg * ln * (0.45 - 0.25 * out), y - ln * 0.72];
    stroke(ink, B.parseD(`M${x0 - sg * 4} ${y + 3} Q${q1[0]} ${q1[1]} ${q2[0]} ${q2[1]}`, 4)[0].pts.map(T), 1.8 + R() * 0.5, { taper: 30 });
    // every third hair bends the other way, in over the basket, holding the load
    if (R() < 0.4) { const L2 = 70 + R() * 50; stroke(ink, B.parseD(`M${x0 - sg * 6} ${y} Q${x0 - sg * L2 * 0.5} ${y - L2 * 0.45} ${x0 - sg * L2 * 0.95} ${y - L2 * 0.5}`, 4)[0].pts.map(T), 1.5, { taper: 22 }); }
  }
  const spec = [...tib.polys, ...bas.polys, ...fem.polys];
  const halo = ring([...side(1).map(([x, y]) => [x + 110 * Math.sign(x || 1), y]), ...side(-1).reverse().map(([x, y]) => [x - 110, y])].map(T));
  ruled(ink, [...spec, ...halo.polys]);
  const lp = new Path2D(); lp.addPath(tib.path); lp.addPath(bas.path); lp.addPath(fem.path);
  return { ink, regions: { legs: { path: lp, polys: spec }, pollen: { path: load.path, polys: load.polys } }, specimen: spec };
}
