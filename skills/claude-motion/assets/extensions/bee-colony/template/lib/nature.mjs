// nature.mjs — plants and small creatures in the textured-editorial style.
// Every function draws at the current transform; place with at(ctx, x, y, s, rot, () => ...).
import { lerp, clamp, rad, eBack, ellipse, stroke, fill, line, at, poly, smooth, hatch, INK } from "./core.mjs";

// a sprout: stem + two cotyledons with midribs; droop 0..1 wilts them, shine 0..1 adds dew highlights
export function sprout(ctx, { droop = 0, shine = 0, sway = 0, h = 158 } = {}) {
  const top = [sway * 8 + droop * 18, -h + droop * 20];
  smooth(ctx, [[0, 4], [-2, -h * .5], top], false); stroke(ctx, 16); smooth(ctx, [[0, 4], [-2, -h * .5], top], false); stroke(ctx, 11, "#7CC95A");
  line(ctx, [[-3, -10], [-4, -h * .6]], 2.4, "rgba(220,255,200,.55)");
  const leaf = (sg) => at(ctx, top[0], top[1], 1, sg * rad(18 + droop * 55) + (sg < 0 ? Math.PI : 0) + sway * .08, () => {
    ellipse(ctx, 70, 0, 70, 38); fill(ctx, "#94D46C"); hatch(ctx, () => ellipse(ctx, 70, 0, 70, 38), rad(30), 5, "#6DB04D", 1, .5, [0, -40, 140, 40]); ellipse(ctx, 70, 0, 70, 38); stroke(ctx, 3);
    line(ctx, [[6, 0], [128, 0]], 2, "#4F8C39"); for (let i = 1; i < 4; i++) { line(ctx, [[i * 30, 0], [i * 30 + 16, -18 + i]], 1.2, "#4F8C39"); line(ctx, [[i * 30, 0], [i * 30 + 16, 18 - i]], 1.2, "#4F8C39"); }
    if (shine > 0) { ctx.save(); ctx.globalAlpha *= shine; ellipse(ctx, 60, -12, 9, 9); fill(ctx, "#fff"); ellipse(ctx, 84, -4, 5, 5); fill(ctx, "#fff"); ctx.restore(); } });
  leaf(-1); leaf(1);
}
// a watermelon (cucurbit) leaf: five deep pointed lobes with serrated edges and pale veins
export function melonLeaf(ctx, s = 1) {
  ctx.save(); ctx.scale(s, s); const pts = [];
  for (let i = 0; i <= 90; i++) { const a = i / 90 * Math.PI * 2, main = Math.pow(Math.abs(Math.cos(a * 2.5)), 1.3), sub = .16 * Math.abs(Math.sin(a * 15)) * (.4 + main);
    pts.push([Math.cos(a) * 64 * (.3 + .7 * main + sub), Math.sin(a) * 60 * (.3 + .7 * main + sub)]); }
  poly(ctx, pts); fill(ctx, "#5EAA4E"); hatch(ctx, () => poly(ctx, pts), rad(40), 5, "#3E8A3A", 1, .5, [-70, -70, 70, 70]); poly(ctx, pts); stroke(ctx, 2.6);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; line(ctx, [[0, 0], [Math.cos(a) * 54, Math.sin(a) * 50]], 1.6, "#CFE8B4"); }
  ctx.restore();
}
// a tendril that rises and ends in a small curl-loop; k 0..1 grows it
export function tendril(ctx, k = 1, s = 1) {
  const n = Math.max(2, Math.round(24 * k)), pts = [];
  for (let i = 0; i <= n; i++) { const q = i / 24; if (q < .6) pts.push([Math.sin(q * 5) * 8, -q * 110]); else { const a = (q - .6) / .4 * Math.PI * 1.8; pts.push([Math.sin(3) * 8 + 16 - Math.cos(a) * 16, -66 - Math.sin(a) * 16]); } }
  ctx.save(); ctx.scale(s, s); smooth(ctx, pts, false); stroke(ctx, 6.5); smooth(ctx, pts, false); stroke(ctx, 4, "#6CC05A");
  if (k > .95) { ellipse(ctx, pts[n][0], pts[n][1], 9, 9); stroke(ctx, 6.5); ellipse(ctx, pts[n][0], pts[n][1], 9, 9); stroke(ctx, 3.5, "#9BE07C"); } ctx.restore();
}
// a vine along points (already sliced to its grown length): outline, body, highlight, little hairs
export function vine(ctx, pts, w = 18) {
  smooth(ctx, pts, false); stroke(ctx, w + 6); smooth(ctx, pts, false); stroke(ctx, w, "#4E9E47");
  ctx.save(); ctx.translate(-3, -3); smooth(ctx, pts, false); stroke(ctx, w * .28, "rgba(190,235,160,.6)"); ctx.restore();
  for (let i = 3; i < pts.length; i += 5) { const [x, y] = pts[i]; line(ctx, [[x, y - w * .65], [x + 4, y - w * 1.1]], 1.2); }
}
// a five-petal flower (yellow cucurbit blossom); open 0..1
export function blossom(ctx, open = 1, color = "#F5CF3A") {
  const k = eBack(clamp(open)); ctx.save(); ctx.scale(k, k);
  for (let i = 0; i < 5; i++) at(ctx, 0, 0, 1, i / 5 * Math.PI * 2, () => { ellipse(ctx, 0, -52, 36, 48); fill(ctx, color); stroke(ctx, 2.6); line(ctx, [[0, -14], [0, -84]], 1.4, "#D9A92A"); line(ctx, [[0, -40], [-12, -70]], 1, "#D9A92A"); line(ctx, [[0, -40], [12, -70]], 1, "#D9A92A"); });
  ellipse(ctx, 0, 0, 20, 20); fill(ctx, "#B87A2A"); stroke(ctx, 2); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ellipse(ctx, Math.cos(a) * 11, Math.sin(a) * 11, 2.2, 2.2); fill(ctx, "#7A4A18"); }
  ctx.restore();
}
// a bee: striped body, fuzz, wing blur that flaps with t
export function bee(ctx, t, s = 1) {
  ctx.save(); ctx.scale(s, s);
  ctx.save(); ctx.globalAlpha *= .7; ellipse(ctx, -6, -34, 20, 14, -.4 + Math.sin(t * 60) * .3); fill(ctx, "#E9F4FA"); stroke(ctx, 1.6); ellipse(ctx, 8, -30, 16, 11, .3 + Math.sin(t * 60 + 1) * .3); fill(ctx, "#E9F4FA"); stroke(ctx, 1.4); ctx.restore();
  ellipse(ctx, 0, 0, 44, 28); fill(ctx, "#F2C230"); ctx.save(); ellipse(ctx, 0, 0, 44, 28); ctx.clip(); for (const x of [-20, 2, 24]) { ctx.fillStyle = INK; ctx.fillRect(x, -30, 11, 60); } ctx.restore();
  ellipse(ctx, 0, 0, 44, 28); stroke(ctx, 2.6); for (let i = 0; i < 14; i++) { const a = Math.PI * 1.1 + i / 13 * Math.PI * .8; line(ctx, [[Math.cos(a) * 44, Math.sin(a) * 28], [Math.cos(a) * 50, Math.sin(a) * 33]], 1); }
  line(ctx, [[42, 4], [52, 6]], 2.2); ellipse(ctx, -44, -2, 14, 14); fill(ctx, INK); ellipse(ctx, -48, -6, 3, 3); fill(ctx, "#fff");
  line(ctx, [[-50, -12], [-60, -30]], 1.6); line(ctx, [[-44, -14], [-48, -32]], 1.6);
  ctx.restore();
}
// a water drop (sweat, dew, rain)
export function drop(ctx, s = 1, color = "#9CCBEA") { ctx.save(); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(10, 0, 0, 6); ctx.quadraticCurveTo(-10, 0, 0, -16); fill(ctx, color); stroke(ctx, 2); ellipse(ctx, -3, -2, 2, 3); fill(ctx, "#fff"); ctx.restore(); }
