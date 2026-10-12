// colony.mjs — an ant colony in cross-section, and what a leafcutter carries into it.
// Everything draws at the current transform (place with at()). All in the textured-editorial style:
// base → texture → edge on every surface (references/detail.md).
import { clamp, lerp, rad, rng, hash, ellipse, stroke, fill, line, poly, smooth, hatch, at, pathOf, INK, createCanvas, grainCanvas } from "./core.mjs";

// ---------------------------------------------------------------- leaves
// a broad leaf lying flat, seen from the side-above: serrated edge, midrib, side veins, hatch
export function leaf(ctx, len = 600, { color = "#6DB352", cut = null } = {}) {
  const P = []; for (let i = 0; i <= 80; i++) { const u = i / 80, a = u * Math.PI * 2, x = Math.cos(a) * len / 2, w = Math.sin(a) * len * .2 * (1 - .25 * Math.cos(a));
    const serr = (i % 4 < 2 ? 1 : .94); P.push([x, w * serr]); }
  ctx.save(); poly(ctx, P);
  if (cut) { ctx.clip(); ctx.beginPath(); ctx.rect(-len, -len, len * 2, len * 2); ctx.arc(cut[0], cut[1], cut[2], 0, Math.PI * 2, true); ctx.clip(); poly(ctx, P); }
  const g = ctx.createLinearGradient(0, -len * .2, 0, len * .2); g.addColorStop(0, "#8CCB6A"); g.addColorStop(1, "#4E9A42"); fill(ctx, g);
  hatch(ctx, () => poly(ctx, P), rad(35), 6, "#3E8A3A", 1, .4, [-len / 2, -len * .25, len / 2, len * .25]);
  line(ctx, [[-len / 2 + 10, 0], [len / 2 - 8, 0]], 4, "#3D7A34"); for (let i = 1; i < 8; i++) { const x = -len / 2 + i * len / 8; line(ctx, [[x, 0], [x + len * .07, -len * .13]], 1.8, "#CFE8B4"); line(ctx, [[x, 0], [x + len * .07, len * .13]], 1.8, "#CFE8B4"); }
  poly(ctx, P); stroke(ctx, 3);
  if (cut) { ctx.beginPath(); ctx.arc(cut[0], cut[1], cut[2], 0, Math.PI * 2); stroke(ctx, 3); }
  ctx.restore();
}
// the half-moon piece a leafcutter carries; `bite` 0..1 nibbles its straight edge
export function leafPiece(ctx, r = 70) {
  const P = []; for (let i = 0; i <= 30; i++) { const a = Math.PI + i / 30 * Math.PI; P.push([Math.cos(a) * r, Math.sin(a) * r * .9]); }
  for (let i = 0; i <= 10; i++) P.push([r - i * r * .2, (i % 2 ? 6 : 0)]);
  const g = ctx.createLinearGradient(0, -r, 0, 0); g.addColorStop(0, "#9AD47A"); g.addColorStop(1, "#58A74A"); poly(ctx, P); fill(ctx, g);
  hatch(ctx, () => poly(ctx, P), rad(35), 5, "#3E8A3A", 1, .45, [-r, -r, r, 4]);
  line(ctx, [[0, 0], [0, -r * .85]], 2.6, "#3D7A34"); line(ctx, [[0, -r * .3], [-r * .45, -r * .6]], 1.4, "#CFE8B4"); line(ctx, [[0, -r * .3], [r * .45, -r * .6]], 1.4, "#CFE8B4");
  poly(ctx, P); stroke(ctx, 2.8);
}

// ---------------------------------------------------------------- brood
export function egg(ctx, s = 1) { ctx.save(); ctx.scale(s, s); ellipse(ctx, 0, 0, 9, 13); const g = ctx.createRadialGradient(-3, -5, 1, 0, 0, 14); g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#E6E0D0"); fill(ctx, g); stroke(ctx, 1.8); ellipse(ctx, -3, -5, 2.4, 3.4); fill(ctx, "#fff"); ctx.restore(); }
// a C-shaped grub; wiggle 0..1 animates it
export function larva(ctx, s = 1, wiggle = 0) {
  ctx.save(); ctx.scale(s, s); const P = [], Q = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * (.2 + i / 12 * 1.4) + wiggle * .15 * Math.sin(i), r = 22 + wiggle * 2; P.push([Math.cos(a) * r, Math.sin(a) * r]); Q.push([Math.cos(a) * (r - 13 + i * .4), Math.sin(a) * (r - 13 + i * .4)]); }
  const S = [...P, ...Q.reverse()]; poly(ctx, S); const g = ctx.createLinearGradient(-20, -20, 20, 20); g.addColorStop(0, "#FFFDF6"); g.addColorStop(1, "#E3DAC4"); fill(ctx, g);
  for (let i = 1; i < 12; i++) { const a = Math.PI * (.2 + i / 12 * 1.4); line(ctx, [[Math.cos(a) * 9.5, Math.sin(a) * 9.5], [Math.cos(a) * 22, Math.sin(a) * 22]], 1, "rgba(120,100,70,.55)"); }
  poly(ctx, S); stroke(ctx, 2); const h = P[P.length - 1]; ellipse(ctx, h[0], h[1], 5, 5); fill(ctx, "#C8A878"); stroke(ctx, 1.4); ctx.restore();
}
export function cocoon(ctx, s = 1) { ctx.save(); ctx.scale(s, s); ellipse(ctx, 0, 0, 14, 26); const g = ctx.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, "#E8D2A6"); g.addColorStop(1, "#B8966A"); fill(ctx, g);
  for (let i = -2; i <= 2; i++) line(ctx, [[-12, i * 9], [12, i * 9 + 3]], 1, "rgba(110,80,40,.5)"); ellipse(ctx, 0, 0, 14, 26); stroke(ctx, 2); ellipse(ctx, -5, -10, 3, 7); fill(ctx, "rgba(255,255,255,.6)"); ctx.restore(); }
export function seedGrain(ctx, s = 1, r = 0) { at(ctx, 0, 0, s, r, () => { ellipse(ctx, 0, 0, 16, 9); fill(ctx, "#C9A45E"); line(ctx, [[-10, -2], [8, -4]], 1.6, "rgba(255,255,255,.6)"); ellipse(ctx, 0, 0, 16, 9); stroke(ctx, 1.8); }); }

// ---------------------------------------------------------------- fungus garden: a spongy white mass that grows
export function fungus(ctx, w, h, grow = 1, seed = 4) {
  const r = rng(seed), n = Math.round(46 * clamp(grow)); ctx.save();
  for (let i = 0; i < n; i++) { const x = (r() - .5) * w, y = -Math.abs(r()) * h * Math.sqrt(1 - Math.pow(2 * x / w, 2)), rr = 16 + r() * 22;
    ellipse(ctx, x, y, rr, rr * .8); const g = ctx.createRadialGradient(x - rr * .3, y - rr * .3, 1, x, y, rr); g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#DCD6C8"); fill(ctx, g); stroke(ctx, 1.4, "#8C8472");
    for (let k = 0; k < 3; k++) { ellipse(ctx, x + (r() - .5) * rr, y + (r() - .5) * rr * .6, 1.6, 1.6); fill(ctx, "#A89E86"); } }
  ctx.restore();
}

// ---------------------------------------------------------------- roots hanging from the surface
export function roots(ctx, x, y, len, seed = 1, w = 7) {
  const r = rng(seed); const branch = (x0, y0, L, a, ww, d) => { if (d > 3 || L < 30) return; const pts = [[x0, y0]]; let px = x0, py = y0, ang = a;
    for (let i = 0; i < 8; i++) { ang += (r() - .5) * .35; px += Math.cos(ang) * L / 8; py += Math.sin(ang) * L / 8; pts.push([px, py]); }
    smooth(ctx, pts, false); stroke(ctx, ww + 2.4); smooth(ctx, pts, false); stroke(ctx, ww, "#C9A77A");
    for (let i = 2; i < pts.length; i += 2) for (let k = 0; k < 3; k++) { const [hx, hy] = pts[i], ha = r() * Math.PI * 2; line(ctx, [[hx, hy], [hx + Math.cos(ha) * 10, hy + Math.sin(ha) * 10]], .9, "rgba(220,200,160,.8)"); }
    for (let i = 3; i < pts.length - 1; i += 3) branch(pts[i][0], pts[i][1], L * .5, ang + (r() > .5 ? .7 : -.7), ww * .6, d + 1); };
  branch(x, y, len, Math.PI / 2, w, 0);
}

// ---------------------------------------------------------------- the nest: chambers and tunnels baked into a soil canvas
// spec: { W, H, ground, chambers: [{ id, x, y, rx, ry }], tunnels: [[[x,y],...], ...], seed }
// returns { canvas, paths } — paths are pathOf() samplers for walking ants along each tunnel
export function nestCanvas(spec) {
  const { W, H, ground, chambers, tunnels, seed = 7 } = spec, c = createCanvas(W, H), x = c.getContext("2d"), r = rng(seed);
  // soil: base gradient deeper = darker, grain, hatch, strata, pebbles, specks
  const g = x.createLinearGradient(0, ground, 0, H); g.addColorStop(0, "#7A5234"); g.addColorStop(1, "#3E2616"); x.fillStyle = g; x.fillRect(0, ground, W, H - ground);
  x.globalCompositeOperation = "multiply"; x.globalAlpha = .5; x.fillStyle = x.createPattern(grainCanvas(256, 80, 13), "repeat"); x.fillRect(0, ground, W, H - ground); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  hatch(x, () => { x.beginPath(); x.rect(0, ground, W, H - ground); }, rad(-30), 8, "#2A180C", 1, .25, [0, ground, W, H]);
  x.strokeStyle = "rgba(210,170,120,.25)"; x.lineWidth = 2; for (let yy = ground + 220; yy < H; yy += 260 + r() * 120) { x.beginPath(); for (let px = 0; px <= W; px += 40) { const py = yy + Math.sin(px * .004 + yy) * 18 + Math.sin(px * .017) * 6; px ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  for (let i = 0; i < W * (H - ground) / 9000; i++) { const px = r() * W, py = ground + 30 + r() * (H - ground - 30), s = r();
    if (s > .92) { ellipse(x, px, py, 14 + r() * 20, 10 + r() * 12, r() * 3); fill(x, s > .97 ? "#8C7E70" : "#A08262"); stroke(x, 2, "#2A180C"); }
    else { x.fillStyle = s > .6 ? "rgba(230,200,160,.45)" : "rgba(30,15,8,.5)"; x.beginPath(); x.arc(px, py, 1 + s * 2.5, 0, 7); x.fill(); } }
  // tunnels first (so chambers sit on top), then chambers: warm lit interiors with a darker rim and a floor
  const T = tunnels.map((p) => pathOf(p));
  for (const t of T) { const pts = t.points; smooth(x, pts, false); stroke(x, 58, "#2A180C"); smooth(x, pts, false); stroke(x, 50, "#B98C62"); smooth(x, pts, false); stroke(x, 26, "rgba(236,200,150,.35)"); }
  for (const ch of chambers) { const { x: cx, y: cy, rx, ry } = ch;
    ellipse(x, cx, cy, rx + 6, ry + 6); fill(x, "#2A180C");
    ellipse(x, cx, cy, rx, ry); const cg = x.createRadialGradient(cx, cy - ry * .3, rx * .1, cx, cy, rx * 1.05); cg.addColorStop(0, "#F0CC98"); cg.addColorStop(.7, "#C9976A"); cg.addColorStop(1, "#8E6342"); fill(x, cg);
    hatch(x, () => ellipse(x, cx, cy, rx, ry), rad(20), 7, "#8E6342", 1, .3, [cx - rx, cy - ry, cx + rx, cy + ry]);
    x.save(); ellipse(x, cx, cy, rx, ry); x.clip(); x.fillStyle = "rgba(120,80,45,.55)"; x.fillRect(cx - rx, cy + ry * .55, rx * 2, ry); x.restore();   // floor
    ellipse(x, cx, cy, rx, ry); stroke(x, 3.4); }
  // the surface line
  x.fillStyle = "#6E4A2C"; x.fillRect(0, ground - 2, W, 8); line(x, [[0, ground], [W, ground]], 3.4);
  return { canvas: c, paths: T };
}
