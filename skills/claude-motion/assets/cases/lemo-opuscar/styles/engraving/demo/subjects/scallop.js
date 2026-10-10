// A second built-in specimen: the great scallop (Pecten maximus), left valve seen from above, as on a conchology plate.
// Same contract as bee.js: buildScallop({ x, y, s }) → { ink, regions, focus }.
//   ink groups: 'ol0' (the shell's margin — the first line the burin cuts), 'ol', 'h1', 'h2', 'h3'.
//   regions: shell, bands, ears.   focus: umbo, growth, ribs, ear (world points; no custom drawing → magnified views).
import * as B from '../engine/burin.js';
const { ring, clamp, hatch, outline, stroke, RNG, noise1, noise2, inPoly } = B;
const L = { x: -0.55, y: -0.62, z: 0.56 }, LV = [L.x, L.y];

export function buildScallop({ x = 960, y = 606, s = 1, seed = 12 } = {}) {
  const ink = new B.Ink(), P = ([u, v]) => [x + u * s, y + v * s];
  const H = [0, -250];                                   // the umbo (hinge point), ribs fan out from it
  const NR = 17, A0 = Math.PI * 0.2, A1 = Math.PI * 0.8, R = th => 470 * (0.9 + 0.1 * Math.sin((th - A0) / (A1 - A0) * Math.PI));
  // margin: scalloped by the ribs
  const margin = [];
  for (let i = 0; i <= NR * 12; i++) { const u = i / (NR * 12), th = A0 + (A1 - A0) * u, r = R(th) * (1 + 0.022 * Math.cos(u * NR * Math.PI * 2)); margin.push([H[0] + Math.cos(th) * r, H[1] + Math.sin(th) * r]); }
  const earD = sg => `M${sg * 6} -252 C${sg * 60} -262 ${sg * 130} -266 ${sg * 156} -258 C${sg * 166} -236 ${sg * 160} -200 ${sg * 142} -176 C${sg * 110} -168 ${sg * 70} -180 ${sg * 30} -206 C${sg * 16} -220 ${sg * 8} -236 ${sg * 6} -252 Z`;
  const shellPts = [...margin.reverse(), [0, -250]].map(P);
  const shell = ring(shellPts);
  const earSh = [-1, 1].map(sg => B.shape(earD(sg), B.xf(x, y, s), 1.5));
  ink.group('ol0'); outline(ink, shell.polys[0], { w: 2.4, light: LV, vary: 0.9, seed, run: 170 });
  ink.group('ol'); for (const e of earSh) outline(ink, e.polys[0], { w: 1.8, light: LV, seed: seed + 1 });
  // ribs: rounded ridges; each gets its own crossing lines (lit on its upper-left flank), furrows between stay dark
  const toneAt = (px, py) => {
    const u = (px - x) / s - H[0], v = (py - y) / s - H[1], th = Math.atan2(v, u), r = Math.hypot(u, v), q = (th - A0) / (A1 - A0) * NR;
    const f = q - Math.floor(q), rib = Math.cos((f - 0.5) * Math.PI * 2) * 0.5 + 0.5;         // 1 on the rib crest, 0 in the furrow
    const side = Math.sin((f - 0.5) * Math.PI * 2);                                           // which flank faces the light
    const bulk = clamp(0.1 + 0.35 * (r / 470) + 0.25 * ((th - A0) / (A1 - A0) - 0.3));        // the valve is domed toward the hinge
    return clamp(bulk + 0.45 * (1 - rib) + 0.18 * side + 0.08 * (noise2(px / 40, py / 40, seed) - 0.5));
  };
  for (let k = 0; k < NR; k++) {                                                              // rib crest lines
    const th = A0 + (A1 - A0) * (k + 0.5) / NR, pts = [];
    for (let r = 60; r <= R(th) * 0.99; r += 6) pts.push(P([H[0] + Math.cos(th) * r, H[1] + Math.sin(th) * r]));
    ink.group('ol'); stroke(ink, pts, 1.1, { taper: 60 });
    const th2 = A0 + (A1 - A0) * k / NR, fp = []; for (let r = 40; r <= R(th2) * 0.97; r += 6) fp.push(P([H[0] + Math.cos(th2) * r, H[1] + Math.sin(th2) * r]));
    if (k) { ink.group('h1'); stroke(ink, fp, 1.7, { taper: 80 }); }
  }
  // concentric growth lines: they ride up over each rib and dip into each furrow; every few a stronger check-line
  ink.group('h1');
  const Rg = RNG(seed + 3); let rr = 70;
  for (let g = 0; rr < 460; g++) { rr += 8 + 14 * Math.pow(1 - rr / 470, 1.5) * (0.6 + Rg() * 0.8); const strong = Rg() < 0.18, pts = [];
    for (let i = 0; i <= 240; i++) { const th = A0 + (A1 - A0) * i / 240, q = (th - A0) / (A1 - A0) * NR, wav = 4 * Math.cos((q - Math.floor(q) - 0.5) * Math.PI * 2); const r = Math.min(rr + wav, R(th) * 0.985); pts.push(P([H[0] + Math.cos(th) * r, H[1] + Math.sin(th) * r])); }
    const ws = pts.map(([px, py]) => { const t = toneAt(px, py); return (strong ? 0.5 : 0.18) + (strong ? 1.1 : 0.55) * t; }); ink.add(pts, ws); }
  // the ears carry their own fine ribbing
  for (const [k, e] of earSh.entries()) { const sg = k ? 1 : -1; for (let j = 0; j < 9; j++) { const pts = []; for (let i = 0; i <= 30; i++) { const u = i / 30, px = sg * (14 + u * 140), py = -250 + 8 * j * (1 - u * 0.2) + 6 * Math.sin(u * 3); if (inPoly(e.polys, ...P([px, py]))) pts.push(P([px, py])); } if (pts.length > 2) stroke(ink, pts, 0.8, { taper: 12 }); } }
  ink.group('h2'); hatch(ink, shell.polys, { angle: 0.35, spacing: 3.6, tone: toneAt, thr: 0.42, wMax: 1.5, seed: seed + 4, excl: earSh.flatMap(e => e.polys) });
  ink.group('h3'); hatch(ink, shell.polys, { angle: -0.85, spacing: 4.2, tone: toneAt, thr: 0.7, wMax: 1.1, seed: seed + 5, excl: earSh.flatMap(e => e.polys) });
  for (const [k, e] of earSh.entries()) { const et = (px, py) => clamp(0.3 + 0.3 * (k ? 1 : 0) + 0.2 * noise2(px / 30, py / 30, 3)); ink.group('h2'); hatch(ink, e.polys, { angle: k ? 0.2 : -0.2, spacing: 3.2, tone: et, thr: 0.2, wMax: 1.3, seed: seed + 8 + k }); }
  // colour bands for the colourist: three concentric zones of rose-brown
  const band = (r0, r1) => { const pts = []; for (let i = 0; i <= 80; i++) { const th = A0 + (A1 - A0) * i / 80; pts.push(P([H[0] + Math.cos(th) * Math.min(r0, R(th) * 0.99), H[1] + Math.sin(th) * Math.min(r0, R(th) * 0.99)])); } for (let i = 80; i >= 0; i--) { const th = A0 + (A1 - A0) * i / 80; pts.push(P([H[0] + Math.cos(th) * Math.min(r1, R(th) * 0.99), H[1] + Math.sin(th) * Math.min(r1, R(th) * 0.99)])); } return ring(pts); };
  const bands = [band(150, 205), band(290, 330), band(400, 440)];
  const mk = list => { const p = new Path2D(); for (const sh of list) p.addPath(sh.path); return { path: p, polys: list.flatMap(sh => sh.polys), bbox: B.bboxOf(list.flatMap(sh => sh.polys)) }; };
  const regions = { shell: mk([shell]), bands: mk(bands), ears: mk(earSh) };
  const focus = { umbo: { x: P([0, -212])[0], y: P([0, -212])[1], r: 40 * s }, growth: { x: P([150, 150])[0], y: P([150, 150])[1], r: 44 * s }, ribs: { x: P([-60, 60])[0], y: P([-60, 60])[1], r: 44 * s }, ear: { x: P([-120, -210])[0], y: P([-120, -210])[1], r: 40 * s } };
  return { ink, regions, focus, center: [x, y], s };
}
