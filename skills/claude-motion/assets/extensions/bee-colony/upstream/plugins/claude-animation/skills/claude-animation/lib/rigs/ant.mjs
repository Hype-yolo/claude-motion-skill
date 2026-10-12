// ant.mjs — a detailed, poseable ant in the textured-editorial style (glossy chitin, hatching,
// setae, compound eye with two highlights, elbowed beaded antennae, toothed mandibles, 3-segment legs
// with tarsi and claws, a real tripod gait).
//
// LOCAL SPACE (read this before placing it): facing +x, origin = the point ON THE GROUND under the
// petiole (waist). Feet land on y = 0. So `ant(ctx, x, groundY, s, pose)` always stands on groundY —
// there is no "ground" knob to get out of sync (that knob once gave the ant stilt legs).
// Body length ≈ 300 * s px, standing height ≈ 150 * s px.
//
// pose: {
//   flip        face -x instead of +x
//   rot         body pitch in radians, about `pivot` (default: the rear feet) — climb, stand up, fall
//   pivot       [x, y] local pivot for rot
//   gait        phase (radians); advance it by ~speed*t*9. undefined = standing still
//   stride      step length (default 26)
//   rear        0..1: stand up on the hind legs (front + mid legs lift, body pitches back)
//   headDip     px the head drops (sniff, dig)
//   ant         antenna sway -1..1
//   jaw         mandible open 0..1
//   carry       fn(ctx) drawn at the mandibles (small object), or
//   overhead    fn(ctx) drawn above the head, held by the raised front legs
//   sweat       0..1 a drop on the head
//   blink       true = eye closed line
//   dust        0..1 little dust puffs at the feet
//   gaster      abdomen scale (queen ≈ 1.7): bigger, paler bands
//   look        { ink, fill, tex } 0..1 each: draw only some layers (build-up reveals)
// }
import { clamp, lerp, rad, ellipse, stroke as _stroke, fill as _fill, line as _line, at, hatch as _hatch, INK } from "../core.mjs";

const C = { hi: "#A2653F", mid: "#5A301D", lo: "#26130B", leg: "#2B1810", legFar: "#4A2C1E", rim: "rgba(214,150,108,.55)", spec: "rgba(255,244,232,.72)" };

// LAYERS. pose.look = { ink, fill, tex } (each 0..1) draws the ant as a build-up: ink = outlines, eye,
// antennae, tarsi; fill = flat body colour; tex = gradient, hatching, gloss, rim light, setae, shadow.
// Default all 1. Every draw call below goes through these wrappers, classed by its colour.
let LK = { ink: 1, fill: 1, tex: 1 };
const TEXC = new Set([C.spec, C.rim, "#fff", "shadow"]);
const kind = (c) => c === INK || c === "#0E0806" ? "ink" : (typeof c === "string" && (c.startsWith("rgba") || TEXC.has(c))) ? "tex" : "fill";
function withA(ctx, a, fn) { if (a <= 0) return; if (a >= 1) return fn(); ctx.save(); ctx.globalAlpha *= a; fn(); ctx.restore(); }
const stroke = (ctx, w, c = INK) => withA(ctx, LK[kind(c)], () => _stroke(ctx, w, c));
const line = (ctx, pts, w, c = INK) => withA(ctx, LK[kind(c)], () => _line(ctx, pts, w, c));
const fill = (ctx, c) => withA(ctx, LK[kind(c)], () => _fill(ctx, c));
const hatch = (ctx, ...a) => withA(ctx, LK.tex, () => _hatch(ctx, ...a));

// hips on the mesosoma underside (x, y) and neutral foot positions, near side. Far side is offset.
const LEGS = [
  // each leg is an inverted V: a short femur out to the knee, a long tibia down to the tarsus
  { hip: [64, -60], knee: [104, -80], foot: [140, 0], tar: 20, dir: 1 },    // front: knee forward and up
  { hip: [42, -58], knee: [52, -86], foot: [60, 0], tar: 18, dir: 1 },      // mid: knee up
  { hip: [22, -56], knee: [-24, -84], foot: [-72, 0], tar: 22, dir: -1 },   // hind: knee back and up, tibia crosses the gaster
];
// tripod gait: legs move in two alternating sets of three
const TRIPOD = [[0, 0], [1, 1], [0, 0]];   // [nearSet, farSet] for front, mid, hind  -> near front+hind with far mid

function chitin(ctx, cx, cy, r, pathFn) {
  const g = ctx.createRadialGradient(cx - r * .35, cy - r * .45, r * .08, cx, cy, r * 1.15);
  g.addColorStop(0, C.hi); g.addColorStop(.5, C.mid); g.addColorStop(1, C.lo); pathFn();
  withA(ctx, LK.fill * (1 - LK.tex), () => _fill(ctx, C.mid));          // flat colour stage
  withA(ctx, LK.fill * LK.tex, () => _fill(ctx, g));                     // modelled chitin
}
function setae(ctx, cx, cy, rx, ry, rot, a0, a1, n, len, w = 1.1) {
  for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / Math.max(1, n - 1), c = Math.cos(a), s = Math.sin(a);
    const x = cx + (c * rx * Math.cos(rot) - s * ry * Math.sin(rot)), y = cy + (c * rx * Math.sin(rot) + s * ry * Math.cos(rot));
    const nx = Math.cos(a + rot), ny = Math.sin(a + rot); withA(ctx, LK.tex, () => _line(ctx, [[x, y], [x + nx * len, y + ny * len + 1]], w, INK)); }
}

function leg(ctx, L, footOff, lift, far, rear, i) {
  const hip = [L.hip[0] + (far ? 8 : 0), L.hip[1] + (far ? -4 : 0)];
  let fx = L.foot[0] + footOff + (far ? 12 : 0), fy = -lift;
  if (rear > 0 && i < 2) { fx = lerp(fx, L.hip[0] + 30 + i * 10, rear); fy = lerp(fy, L.hip[1] - 50 + i * 30, rear); }   // arms up
  const ankle = [fx - L.dir * L.tar * .7, fy - L.tar * .55];
  const knee = [L.knee[0] + (far ? 8 : 0) + footOff * .5 + (rear > 0 && i < 2 ? (fx - L.foot[0]) * .5 : 0), L.knee[1] + (far ? -4 : 0) - lift * .5 + (rear > 0 && i < 2 ? fy * .5 : 0)];
  const col = far ? C.legFar : C.leg, k = far ? .8 : 1;
  ctx.save(); ctx.globalAlpha *= far ? .9 : 1;
  ellipse(ctx, hip[0], hip[1] + 2, 7 * k, 5.5 * k); fill(ctx, col); stroke(ctx, 1.4);                                  // coxa
  // femur: thick, tapering; tibia: thinner; both drawn as outline + fill so the joint reads
  for (const [a, b, w0] of [[hip, knee, 5.6], [knee, ankle, 3.8]]) {
    line(ctx, [a, b], w0 * k + 2.6, INK); line(ctx, [a, b], w0 * k, col);
    line(ctx, [[lerp(a[0], b[0], .15), lerp(a[1], b[1], .15) - 1.5], [lerp(a[0], b[0], .8), lerp(a[1], b[1], .8) - 1.5]], 1.4, "rgba(230,170,130,.45)");   // leg gloss
  }
  ellipse(ctx, knee[0], knee[1], 3.6 * k, 3.6 * k); fill(ctx, col); stroke(ctx, 1.3);                 // knee
  // tarsus: 3 small beads to the claw
  const tip = [fx + L.dir * L.tar * .25, fy];
  for (let j = 0; j < 3; j++) { const u0 = j / 3, u1 = (j + 1) / 3; line(ctx, [[lerp(ankle[0], tip[0], u0), lerp(ankle[1], tip[1], u0)], [lerp(ankle[0], tip[0], u1 - .07), lerp(ankle[1], tip[1], u1 - .07)]], 2.3 * k, INK); }
  line(ctx, [tip, [tip[0] + L.dir * 6, tip[1] - 3]], 1.6, INK); line(ctx, [tip, [tip[0] + L.dir * 6, tip[1] + 2]], 1.6, INK);   // claw
  ctx.restore();
}

export function ant(ctx, x, y, s = 1, pose = {}) {
  const { flip = false, rot = 0, pivot: pv, gait, stride = 26, rear = 0, headDip = 0, jaw = 0, carry, overhead, sweat = 0, blink = false, dust = 0 } = pose;
  const antA = pose.ant ?? 0, pivot = pv ?? (pose.rear ? [-84, -26] : [-70, 0]);
  LK = { ink: 1, fill: 1, tex: 1, ...(pose.look || {}) };
  const walking = gait !== undefined, ph = gait ?? 0;
  const bob = walking ? -Math.abs(Math.sin(ph)) * 3 : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (flip ? -1 : 1), s);
  if (rot || rear) { ctx.translate(pivot[0], pivot[1]); ctx.rotate(rot - rear * rad(34)); ctx.translate(-pivot[0], -pivot[1]); }
  ctx.translate(0, bob);

  // contact shadow on the ground
  if (!rot && !rear) withA(ctx, LK.tex * .22, () => { ellipse(ctx, 10, 2, 150, 8); _fill(ctx, "#2A1A10"); });

  const footOff = (i, far) => { if (!walking) return 0; const set = TRIPOD[i][far ? 1 : 0], p = ph + (set ? Math.PI : 0); return Math.sin(p) * stride * .5; };
  const liftOf = (i, far) => { if (!walking) return 0; const set = TRIPOD[i][far ? 1 : 0], p = ph + (set ? Math.PI : 0); return Math.max(0, Math.cos(p)) * 12; };
  // far-side legs first
  LEGS.forEach((L, i) => leg(ctx, L, footOff(i, true), liftOf(i, true), true, rear, i));

  // ---------------- gaster (abdomen): segmented, glossy, hairy
  const gs = pose.gaster || 1, GRX = 66 * gs, GRY = 50 * gs, GX = -84 - (gs - 1) * 62, GY = -74 - (gs - 1) * 22, GR = rad(-12);
  chitin(ctx, GX, GY, GRX, () => ellipse(ctx, GX, GY, GRX, GRY, GR));
  ctx.save(); ellipse(ctx, GX, GY, GRX, GRY, GR); ctx.clip();
  for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(GX + GRX * (.9 - k * .38), GY, 14, GRY * 1.05, GR, -1.35, 1.35); stroke(ctx, 1.8, "rgba(20,8,4,.6)"); }   // tergite bands
  hatch(ctx, () => ellipse(ctx, GX, GY + 10, GRX, GRY * .7, GR), rad(-60), 5, "#1A0B06", 1, .35, [GX - 70, GY - 50, GX + 70, GY + 50]);             // form shading
  ctx.beginPath(); ctx.ellipse(GX, GY, GRX - 3, GRY - 3, GR, .2, 2.4); stroke(ctx, 3, C.rim);                                                  // bounce rim light
  ctx.restore();
  ellipse(ctx, GX, GY, GRX, GRY, GR); stroke(ctx, 3.4);
  at(ctx, GX - 16, GY - 30, 1, rad(-22), () => { ellipse(ctx, 0, 0, 24, 7); fill(ctx, C.spec); ellipse(ctx, 22, 5, 4, 3); fill(ctx, C.spec); });   // specular streak + dot
  setae(ctx, GX, GY, GRX, GRY, GR, Math.PI * .55, Math.PI * 1.35, 16, 7);

  // ---------------- petiole: the narrow waist with one node
  line(ctx, [[-22, -70], [0, -68]], 9, INK); line(ctx, [[-22, -70], [0, -68]], 6, C.mid);
  chitin(ctx, -8, -80, 12, () => { ctx.beginPath(); ctx.moveTo(-18, -70); ctx.quadraticCurveTo(-10, -96, 2, -72); ctx.closePath(); });
  ctx.beginPath(); ctx.moveTo(-18, -70); ctx.quadraticCurveTo(-10, -96, 2, -72); stroke(ctx, 2.4);

  // ---------------- mesosoma (thorax): pronotum hump, mesonotum, propodeum with a tiny spine
  const meso = () => { ctx.beginPath(); ctx.moveTo(0, -66); ctx.bezierCurveTo(4, -86, 22, -84, 30, -80); ctx.bezierCurveTo(38, -92, 58, -100, 76, -88);
    ctx.bezierCurveTo(86, -80, 84, -64, 72, -58); ctx.bezierCurveTo(48, -52, 18, -54, 0, -66); ctx.closePath(); };
  chitin(ctx, 44, -76, 40, meso);
  ctx.save(); meso(); ctx.clip(); hatch(ctx, () => ellipse(ctx, 44, -60, 50, 12), rad(-50), 4.5, "#1A0B06", 1, .35, [0, -100, 90, -50]); ctx.restore();
  meso(); stroke(ctx, 2.8);
  line(ctx, [[30, -80], [34, -60]], 1.4, "rgba(20,8,4,.55)");                               // segment suture
  line(ctx, [[46, -94], [66, -95]], 2, C.spec);                                              // gloss
  line(ctx, [[4, -80], [-2, -88]], 2, INK);                                                  // propodeal spine

  // near-side legs over the body
  LEGS.forEach((L, i) => leg(ctx, L, footOff(i, false), liftOf(i, false), false, rear, i));

  // ---------------- head
  ctx.save(); ctx.translate(96, -96 + headDip); ctx.rotate(rad(headDip * .5));
  const head = () => { ctx.beginPath(); ctx.moveTo(-18, 2); ctx.bezierCurveTo(-20, -24, 12, -34, 30, -20); ctx.bezierCurveTo(42, -10, 40, 14, 26, 20); ctx.bezierCurveTo(8, 26, -14, 20, -18, 2); ctx.closePath(); };
  chitin(ctx, 8, -6, 32, head);
  ctx.save(); head(); ctx.clip(); hatch(ctx, () => ellipse(ctx, 10, 10, 30, 14), rad(-40), 4, "#1A0B06", 1, .3, [-20, -30, 40, 30]); ctx.restore();
  head(); stroke(ctx, 3);
  // mandibles (open with `jaw`), with teeth
  for (const [sg, far] of [[1, true], [1, false]]) at(ctx, 34, 10, 1, rad(far ? 10 + jaw * 26 : -8 - jaw * 18), () => {
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(18, -6, 22, 6); ctx.lineTo(16, 4); ctx.lineTo(14, 8); ctx.lineTo(9, 4); ctx.lineTo(6, 7); ctx.quadraticCurveTo(2, 4, 0, 4); ctx.closePath();
    fill(ctx, far ? C.legFar : "#3A2014"); stroke(ctx, 1.8); });
  line(ctx, [[22, -4], [30, 4]], 1.4, "rgba(20,8,4,.6)");                                      // clypeus
  // compound eye: dark, a faceted sheen, two highlights
  if (blink) line(ctx, [[10, -12], [24, -10]], 2.6);
  else { ellipse(ctx, 17, -11, 9, 8, rad(-15)); fill(ctx, "#0E0806"); ctx.save(); ellipse(ctx, 17, -11, 9, 8, rad(-15)); ctx.clip(); hatch(ctx, () => ellipse(ctx, 17, -11, 9, 8), rad(45), 2.2, "#4A3A34", .8, .5, [6, -20, 28, -2]); ctx.restore();
    ellipse(ctx, 14, -14, 3.2, 2.6); fill(ctx, "#fff"); ellipse(ctx, 20, -8, 1.4, 1.4); fill(ctx, "#fff"); }
  // antennae: long scape to the elbow, then a beaded funiculus ending in a club
  const antenna = (far) => { const sw = antA * (far ? .7 : 1), base = far ? [6, -26] : [12, -24];
    const elbow = [base[0] + 10 + sw * 8, base[1] - 50], tipA = rad(-58 + sw * 22 + (far ? -8 : 0));
    line(ctx, [base, elbow], far ? 3 : 3.6, far ? C.legFar : INK);
    let p = elbow; for (let j = 0; j < 10; j++) { const l = 6.2, a = tipA + j * .03 * (1 + sw); const q = [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l];
      line(ctx, [p, q], (far ? 2.2 : 2.8) + j * .12, far ? C.legFar : INK); ellipse(ctx, q[0], q[1], (1.6 + j * .12) * (far ? .8 : 1), (1.6 + j * .12) * (far ? .8 : 1)); fill(ctx, far ? C.legFar : INK); p = q; }
    ellipse(ctx, p[0], p[1], far ? 3 : 3.6, far ? 3 : 3.6); fill(ctx, far ? C.legFar : INK); };
  ctx.save(); ctx.globalCompositeOperation = "destination-over"; antenna(true); ctx.restore(); antenna(false);
  setae(ctx, 8, -6, 30, 22, 0, Math.PI * 1.1, Math.PI * 1.5, 5, 4, .9);
  // sweat drop
  if (sweat > 0) { const dy = -54 - sweat * 8; ctx.save(); ctx.globalAlpha *= clamp(sweat * 3); ctx.beginPath(); ctx.moveTo(34, dy - 14); ctx.quadraticCurveTo(43, dy, 34, dy + 5); ctx.quadraticCurveTo(25, dy, 34, dy - 14); fill(ctx, "#9CCBEA"); stroke(ctx, 2); ellipse(ctx, 31, dy - 2, 2, 3); fill(ctx, "#fff"); ctx.restore(); }
  if (carry) at(ctx, 52, 12, 1, 0, () => carry(ctx));
  ctx.restore();
  if (overhead) at(ctx, 90, -196, 1, 0, () => overhead(ctx));
  if (dust > 0) { ctx.save(); ctx.globalAlpha *= dust; for (const fx of [-60, 40, 128]) { ellipse(ctx, fx - 8, -3, 7, 4); fill(ctx, "rgba(150,120,90,.5)"); ellipse(ctx, fx + 6, -5, 5, 3); fill(ctx, "rgba(150,120,90,.4)"); } ctx.restore(); }
  ctx.restore();
}

// a watermelon seed, glossy, tip to the right; ~72 x 52 px at s = 1
export function seed(ctx, s = 1, pale = false) {
  ctx.save(); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(-34, 6); ctx.bezierCurveTo(-30, -26, 18, -30, 38, -2); ctx.bezierCurveTo(24, 22, -26, 28, -34, 6); ctx.closePath();
  if (pale) fill(ctx, "#EFE6CF"); else { const g = ctx.createLinearGradient(0, -28, 0, 24); g.addColorStop(0, "#3E2C24"); g.addColorStop(1, "#110A07"); fill(ctx, g); }
  stroke(ctx, 2.6); line(ctx, [[-18, -8], [2, -16], [22, -12]], 2.4, pale ? "rgba(160,140,110,.6)" : "rgba(255,255,255,.55)"); ctx.restore();
}

// Construction guides for the ant, in blue: the shapes and lines an illustrator blocks in before inking.
// p 0..1 draws them on in order. Same arguments as ant() so the two line up exactly.
export function antGuides(ctx, x, y, s = 1, p = 1, { color = "#5E80CC", flip = false, w = 2 } = {}) {
  const items = [
    ["line", [[-190, 0], [200, 0]]],                                                  // ground
    ["ell", -84, -74, 66, 50, rad(-12)], ["ell", -8, -80, 12, 12, 0], ["ell", 42, -76, 44, 20, rad(-8)], ["ell", 100, -100, 34, 29, rad(-10)],
    ["line", [[-170, -60], [150, -112]]],                                             // body axis
    ...LEGS.flatMap((L) => [["line", [L.hip, L.knee]], ["line", [L.knee, L.foot]], ["ell", L.knee[0], L.knee[1], 4, 4, 0]]),
    ["line", [[108, -122], [118, -170], [150, -205]]],                                // antenna
    ["cross", -84, -74], ["cross", 42, -76], ["cross", 100, -100],
  ];
  const n = items.length, k = clamp(p) * n;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (flip ? -1 : 1), s); ctx.strokeStyle = color; ctx.lineWidth = w / s; ctx.lineCap = "round";
  items.forEach((it, i) => { const u = clamp(k - i); if (u <= 0) return; ctx.beginPath();
    if (it[0] === "line") { const P = it[1]; let tot = 0; for (let j = 1; j < P.length; j++) tot += Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]); let lim = tot * u;
      ctx.moveTo(...P[0]); for (let j = 1; j < P.length && lim > 0; j++) { const l = Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]), q = Math.min(1, lim / l); ctx.lineTo(lerp(P[j - 1][0], P[j][0], q), lerp(P[j - 1][1], P[j][1], q)); lim -= l; } }
    else if (it[0] === "ell") { const [, cx, cy, rx, ry, r] = it, n = Math.max(2, Math.round(48 * u)), cr = Math.cos(r), sr = Math.sin(r);
      for (let j = 0; j <= n; j++) { const a = -Math.PI / 2 + j / 48 * Math.PI * 2, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, px = cx + ex * cr - ey * sr, py = cy + ex * sr + ey * cr; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } }
    else { ctx.moveTo(it[1] - 7 * u, it[2]); ctx.lineTo(it[1] + 7 * u, it[2]); ctx.moveTo(it[1], it[2] - 7 * u); ctx.lineTo(it[1], it[2] + 7 * u); }
    ctx.stroke(); });
  ctx.restore();
}
