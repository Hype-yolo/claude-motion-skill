// chibi.mjs — a big-head cartoon person with real joints (front / three-quarter view), built to be styled
// into a specific character with a preset: hair, glasses, shirt, pocket, pants, shoes, skin.
//
// LOCAL SPACE: origin on the ground between the feet, y up negative. Height ≈ 310 × s px (head ≈ 40 %).
//   chibi(ctx, x, groundY, s, pose, look)          look = a preset object (see HANIF_LOOK in the examples)
// pose: {
//   t          time (blinks, idle breathing)
//   flip       mirror (faces the other way: head turn, pocket side)
//   gait       walk/run phase (radians); omit to stand.  run: true = bigger stride + arm swing
//   air        airborne: knees tuck
//   sq         squash (>1) / stretch (<1) about the feet
//   rot        whole-body tilt about the hips
//   armL/armR  [shoulder, elbow] degrees: 0 = hanging down, 90 = straight out sideways, 180 = straight up;
//              elbow bends the forearm further the same way. Presets via arms: "rest" | "up" | "cheer" |
//              "wave" | "pointR" | "pointL" | "hips" | "shrug" | "carry"
//   holdR/holdL fn(ctx) drawn at that hand (a bag, a map, a coin)
//   eyes       "neutral" | "happy" | "wide" | "closed" | "side" | "star"
//   brows      "neutral" | "raised" | "worried" | "furrowed"
//   mouth      "rest" | "smile" | "open" | "O" | "flat" | "frown" | "A" | "E" | "U" | "M"
//   headTilt   radians; look [dx, dy] pupil offset; blush 0..1; sweat 0..1; flash 0..1
// }
import { clamp, lerp, rad, ellipse, stroke, fill, line, at, poly, smooth, rrect, INK } from "../core.mjs";

export const ARM_PRESETS = {
  rest: [[12, 10], [12, 10]], up: [[150, 15], [150, 15]], cheer: [[128, 34], [128, 34]], wave: [[12, 10], [145, 30]],
  pointR: [[12, 10], [92, -4]], pointL: [[92, -4], [12, 10]], hips: [[40, 110], [40, 110]], shrug: [[55, 80], [55, 80]], carry: [[20, 60], [20, 60]],
};

function shade(hex, k) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(clamp(k > 0 ? v + (255 - v) * k : v * (1 + k), 0, 255))); return `rgb(${c.join(",")})`; }
const O = (w = 4) => w;

function limb(ctx, a, b, c, w1, w2, col, outline = 3.6) {    // two segments with round joints, outlined
  line(ctx, [a, b, c], w1 + outline * 2, INK); line(ctx, [a, b], w1, col); line(ctx, [b, c], w2, col);
  ellipse(ctx, b[0], b[1], w1 / 2, w1 / 2); fill(ctx, col);
}
const dirFrom = (deg, side) => [Math.sin(rad(deg)) * side, Math.cos(rad(deg))];

export function chibi(ctx, x, y, s = 1, p = {}, L = {}) {
  const t = p.t || 0, skin = L.skin || "#FBDDB0", shirt = L.shirt || "#FBF4E2", pants = L.pants || "#23232A", shoe = L.shoes || "#23232A", hair = L.hair || "#1A1A1E";
  const sq = p.sq ?? 1, breathe = p.gait === undefined && !p.air ? Math.sin(t * 2.4) * .012 : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * Math.sqrt(sq) * (p.flip ? -1 : 1), s / Math.sqrt(sq) * (1 + breathe));
  if (!p.air) { ctx.save(); ctx.globalAlpha *= .22; ellipse(ctx, 0, 3, 70, 9); fill(ctx, "#2A1A10"); ctx.restore(); }
  if (p.rot) { ctx.translate(0, -95); ctx.rotate(p.rot); ctx.translate(0, 95); }
  const run = p.gait !== undefined, ph = p.gait || 0, amp = p.run ? 1 : .6;
  // ---------------- legs
  for (const side of [-1, 1]) {
    const hip = [side * 20, -94], swing = run ? Math.sin(ph + (side > 0 ? Math.PI : 0)) : 0, lift = run ? Math.max(0, swing) : 0;
    let foot = [side * 26 + (run ? swing * 10 * amp : 0), -lift * 26 * amp], knee;
    if (p.air) { foot = [side * 30, -34]; knee = [side * 34, -62]; }
    else knee = [lerp(hip[0], foot[0], .5) + side * (4 + lift * 10), lerp(hip[1], foot[1], .5) - lift * 8];
    limb(ctx, hip, knee, [foot[0], foot[1] - 12], 30, 27, pants);
    // sneaker: black upper, white sole and toe, laces
    at(ctx, foot[0] + side * 6, foot[1] - 8, 1, 0, () => { const S = rrect(-26, -12, 52, 22, 10); poly(ctx, S); fill(ctx, shoe); poly(ctx, S); stroke(ctx, 3.4);
      poly(ctx, rrect(-26, 4, 52, 7, 3)); fill(ctx, "#F4F4F2"); stroke(ctx, 2.4); for (const lx of [-6, 3]) line(ctx, [[lx - 5, -6], [lx + 5, -2]], 2.4, "#F4F4F2"); });
    // rolled pant cuff
    poly(ctx, rrect(foot[0] - 17, foot[1] - 24, 34, 9, 3)); fill(ctx, shade(pants, .15)); stroke(ctx, 2.6);
  }
  // ---------------- arms behind the torso edge are drawn after it; compute first
  const preset = ARM_PRESETS[p.arms || "rest"] || ARM_PRESETS.rest;
  let aL = p.armL || preset[0], aR = p.armR || preset[1];
  if (run && !p.armL && !p.armR && (!p.arms || p.arms === "rest")) { const sw = Math.sin(ph) * 32 * amp; aL = [18 + sw, 70]; aR = [18 - sw, 70]; }
  if (p.arms === "wave") aR = [145 + Math.sin(t * 12) * 18, 30];
  // ---------------- torso: shirt with collar, placket, buttons, pocket + pen, rolled hem
  const T = [[-52, -172], [52, -172], [60, -120], [64, -86], [-64, -86], [-60, -120]];
  poly(ctx, [[-30, -94], [30, -94], [34, -80], [-34, -80]]); fill(ctx, pants);                           // belt line under the shirt
  smooth(ctx, T); fill(ctx, shirt); ctx.save(); smooth(ctx, T); ctx.clip(); ellipse(ctx, 50, -110, 34, 70); fill(ctx, shade(shirt, -.08)); ctx.restore(); smooth(ctx, T); stroke(ctx, 3.8);
  line(ctx, [[0, -166], [0, -88]], 2.4); for (const by of [-150, -130, -110]) { ellipse(ctx, 6, by, 2.6, 2.6); stroke(ctx, 2); }
  const pocketX = p.flip ? -34 : 30;
  if (L.pocket) { const Pk = [[pocketX - 16, -150], [pocketX + 16, -150], [pocketX + 16, -126], [pocketX, -118], [pocketX - 16, -126]]; poly(ctx, Pk); fill(ctx, L.pocket); poly(ctx, Pk); stroke(ctx, 2.8);
    if (L.pen) { poly(ctx, rrect(pocketX - 2, -166, 7, 22, 3)); fill(ctx, L.pen); stroke(ctx, 2.2); } }
  // collar
  for (const side of [-1, 1]) { const C = [[0, -168], [side * 26, -176], [side * 30, -160], [side * 8, -154]]; poly(ctx, C); fill(ctx, shirt); poly(ctx, C); stroke(ctx, 3); }
  // ---------------- arms
  const arm = (side, [sh, el], hold) => {
    const S = [side * 50, -164], d1 = dirFrom(sh, side), E = [S[0] + d1[0] * 40, S[1] + d1[1] * 40], d2 = dirFrom(sh + el, side), Hn = [E[0] + d2[0] * 38, E[1] + d2[1] * 38];
    // sleeve (rolled at the elbow), forearm skin, hand
    line(ctx, [S, E], 30 + 7.2, INK); line(ctx, [S, E], 30, shirt); ellipse(ctx, E[0], E[1], 17, 17); fill(ctx, shirt); stroke(ctx, 3);
    line(ctx, [E, Hn], 22 + 7, INK); line(ctx, [E, Hn], 22, skin); ellipse(ctx, E[0], E[1], 14, 14); fill(ctx, shirt);
    ellipse(ctx, Hn[0], Hn[1], 15, 15); fill(ctx, skin); stroke(ctx, 3.2); line(ctx, [[Hn[0] - side * 4, Hn[1] - 6], [Hn[0] + side * 2, Hn[1] + 2]], 1.6, "rgba(140,90,50,.7)");
    if (hold) at(ctx, Hn[0], Hn[1], 1, 0, () => hold(ctx));
  };
  arm(-1, aL, p.flip ? p.holdR : p.holdL); arm(1, aR, p.flip ? p.holdL : p.holdR);
  // ---------------- head
  ctx.save(); ctx.translate(0, -176); ctx.rotate(p.headTilt || 0); ctx.translate(0, -58);
  ellipse(ctx, 0, 12, 12, 12); fill(ctx, skin);                                                          // neck
  for (const side of [-1, 1]) { ellipse(ctx, side * 64, 4, 13, 17); fill(ctx, skin); stroke(ctx, 3.4); ellipse(ctx, side * 64, 4, 5, 8); fill(ctx, shade(skin, -.15)); }
  const F = [[-62, -20], [-58, 20], [-40, 44], [0, 56], [40, 44], [58, 20], [62, -20], [40, -52], [0, -60], [-40, -52]];
  smooth(ctx, F); fill(ctx, skin); ctx.save(); smooth(ctx, F); ctx.clip(); ellipse(ctx, 0, 60, 70, 22); fill(ctx, shade(skin, -.07)); ctx.restore(); smooth(ctx, F); stroke(ctx, 3.8);
  // hair: a messy spiky mass (irregular tufts, swept a little to one side), down to the ears, choppy fringe
  const Hr = [[-66, 6], [-70, -18]]; const spikes = L.spikes || 22;
  for (let i = 0; i <= spikes; i++) { const u = i / spikes, a = Math.PI * (1.08 + u * .84), jit = Math.sin(i * 12.9898) * 43758.5453, j = jit - Math.floor(jit);
    const valley = 80 + 4 * Math.sin(i * 1.7), tip = 93 + 11 * j + (u > .3 && u < .7 ? 5 : 0), sw = .05 + .04 * j;
    Hr.push([Math.cos(a - .04) * valley, -18 + Math.sin(a - .04) * valley * .86]); Hr.push([Math.cos(a + sw) * tip, -18 + Math.sin(a + sw) * tip * .86]); }
  Hr.push([70, -18], [66, 6]);
  const fringe = [[60, -10], [50, 4], [42, -20], [30, -6], [22, -26], [10, -10], [0, -28], [-12, -12], [-22, -30], [-34, -10], [-44, -26], [-54, 0], [-60, -12]];
  poly(ctx, [...Hr, ...fringe]); fill(ctx, hair); poly(ctx, [...Hr, ...fringe]); stroke(ctx, 3.2);
  for (let i = 0; i < 9; i++) { const a = Math.PI * (1.15 + i * .085); line(ctx, [[Math.cos(a) * 40, -20 + Math.sin(a) * 36], [Math.cos(a + .06) * 86, -20 + Math.sin(a + .06) * 80]], 1.8, "rgba(255,255,255,.16)"); }
  // brows, eyes, glasses, mouth
  const ey = 2, lk = p.look || [0, 0], bl = p.eyes === "closed" || (p.eyes !== "wide" && ((t + (L.blinkOffset || 0)) % 3.4) < .12);
  const brow = p.brows || "neutral";
  for (const side of [-1, 1]) { const bx = side * 26, by = -26; const k = brow === "raised" ? -8 : brow === "furrowed" ? 4 : 0, tilt = brow === "worried" ? side * -6 : brow === "furrowed" ? side * 6 : 0;
    ctx.beginPath(); ctx.moveTo(bx - 12, by + k + tilt); ctx.quadraticCurveTo(bx, by + k - 6, bx + 12, by + k - tilt); stroke(ctx, 4.4); }
  for (const side of [-1, 1]) { const ex = side * 26 + lk[0], eyY = ey + lk[1];
    if (bl) { ctx.beginPath(); ctx.moveTo(ex - 8, eyY); ctx.quadraticCurveTo(ex, eyY + 4, ex + 8, eyY); stroke(ctx, 3.6); }
    else if (p.eyes === "happy") { ctx.beginPath(); ctx.moveTo(ex - 9, eyY + 3); ctx.quadraticCurveTo(ex, eyY - 8, ex + 9, eyY + 3); stroke(ctx, 3.8); }
    else if (p.eyes === "star") { ctx.save(); ctx.translate(ex, eyY); ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI * 2, r = i % 2 ? 4 : 10; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); fill(ctx, "#F5B81E"); stroke(ctx, 2); ctx.restore(); }
    else { const big = p.eyes === "wide" ? 1.5 : 1; ellipse(ctx, ex + (p.eyes === "side" ? 5 : 0), eyY, 5.2 * big, 7.2 * big); fill(ctx, INK); ellipse(ctx, ex - 1.5, eyY - 3, 1.8, 1.8); fill(ctx, "#fff"); } }
  if (L.glasses !== false) { for (const side of [-1, 1]) { poly(ctx, rrect(side * 26 - 23, ey - 16, 46, 32, 8)); fill(ctx, "rgba(220,235,245,.18)"); poly(ctx, rrect(side * 26 - 23, ey - 16, 46, 32, 8)); stroke(ctx, 6.4); line(ctx, [[side * 49, ey - 8], [side * 62, ey - 10]], 5); }
    line(ctx, [[-3, ey - 6], [3, ey - 6]], 5); line(ctx, [[-36, ey - 10], [-28, ey - 14]], 2, "rgba(255,255,255,.7)"); }
  if (p.blush) { ctx.save(); ctx.globalAlpha *= p.blush; ellipse(ctx, -40, 26, 11, 6); fill(ctx, "#F2A0A0"); ellipse(ctx, 40, 26, 11, 6); fill(ctx, "#F2A0A0"); ctx.restore(); }
  const my = 30, m = p.mouth || "rest";
  if (m === "rest") { ctx.beginPath(); ctx.moveTo(-10, my); ctx.quadraticCurveTo(0, my + 7, 10, my); stroke(ctx, 3.6); }
  else if (m === "flat" || m === "M") line(ctx, [[-9, my + 2], [9, my + 2]], 3.6);
  else if (m === "frown") { ctx.beginPath(); ctx.moveTo(-10, my + 5); ctx.quadraticCurveTo(0, my - 3, 10, my + 5); stroke(ctx, 3.6); }
  else { const shp = { smile: [16, 12, 1], open: [14, 14, 1], A: [11, 13, 0], E: [13, 8, 0], O: [7, 9, 0], U: [6, 7, 0] }[m] || [12, 10, 0];
    ctx.beginPath(); if (shp[2]) { ctx.moveTo(-shp[0], my - 2); ctx.quadraticCurveTo(0, my - 2 + shp[1] * 2, shp[0], my - 2); ctx.closePath(); } else ctx.ellipse(0, my + 3, shp[0], shp[1], 0, 0, Math.PI * 2);
    fill(ctx, "#7A1E26"); ctx.save(); ctx.clip(); ellipse(ctx, 0, my + shp[1] + 2, shp[0] * .8, shp[1] * .6); fill(ctx, "#E86A74"); ctx.restore(); stroke(ctx, 3.4);
    if (shp[2]) { ctx.beginPath(); ctx.moveTo(-shp[0] + 3, my); ctx.lineTo(shp[0] - 3, my); stroke(ctx, 4, "#FFFFFF"); } }
  if (p.sweat) { ctx.save(); ctx.globalAlpha *= p.sweat; ctx.beginPath(); ctx.moveTo(70, -34); ctx.quadraticCurveTo(80, -18, 70, -12); ctx.quadraticCurveTo(60, -18, 70, -34); fill(ctx, "#9CCBEA"); stroke(ctx, 2.4); ctx.restore(); }
  if (p.flash) { ctx.save(); ctx.globalAlpha *= p.flash; smooth(ctx, F); fill(ctx, "#fff"); ctx.restore(); }
  ctx.restore();
  ctx.restore();
}
