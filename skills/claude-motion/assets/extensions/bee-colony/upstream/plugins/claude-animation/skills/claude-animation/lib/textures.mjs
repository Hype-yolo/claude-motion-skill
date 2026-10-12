// textures.mjs — surfaces. Heavy ones are built ONCE (per scene) into an offscreen canvas and blitted
// every frame; only what moves is drawn per frame. Each material gets three layers:
//   base colour  ->  texture (grain / hatch / cells / fibre)  ->  edge (outline, rim light, pooled edge)
import { createCanvas, rng, hash, lerp, rad, ellipse, stroke, fill, line, hatch, fibre, grainCanvas, INK } from "./core.mjs";

// warm paper with printed grain
export function paper(W, H, color = "#F3EEDD", grain = .35) {
  const c = createCanvas(W, H), x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "multiply"; x.globalAlpha = grain; x.fillStyle = x.createPattern(grainCanvas(256, 40, 7), "repeat"); x.fillRect(0, 0, W, H);
  return c;
}
// warm paper with fibres, blotches and a soft vignette (the brush-ink look)
export function fibrePaper(W, H, color = "#F3EBDA") {
  const c = createCanvas(W, H), x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, W, H);
  x.globalAlpha = .05; x.strokeStyle = "#8A7456"; x.lineWidth = 1;
  for (let i = 0; i < W * H / 800; i++) { const px = hash(i * 3.1) * W, py = hash(i * 5.7) * H, a = hash(i * 7.3) * Math.PI, l = 6 + hash(i * 1.9) * 22;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * .5 + 3, py + Math.sin(a) * l * .5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  x.globalAlpha = 1;
  for (let i = 0; i < 26; i++) { const px = hash(i * 11.1) * W, py = hash(i * 13.3) * H, r = 80 + hash(i * 2.2) * 260, g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "rgba(150,120,80,0.035)"); g.addColorStop(1, "rgba(150,120,80,0)"); x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r); }
  x.globalCompositeOperation = "multiply"; x.globalAlpha = .55; x.fillStyle = x.createPattern(grainCanvas(256, 26, 5), "repeat"); x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  const v = x.createRadialGradient(W / 2, H * .46, H * .35, W / 2, H / 2, Math.max(W, H) * .75); v.addColorStop(0, "rgba(90,70,40,0)"); v.addColorStop(1, "rgba(90,70,40,0.16)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
  return c;
}
// wide diagonal light bands drifting across the sky (textured-editorial signature)
export function lightBands(ctx, W, H, t, { alpha = .55, color = "#EEDDB4", angle = 40, width = 78, gap = 250, drift = 14 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.translate(W / 2, H / 2); ctx.rotate(rad(angle));
  const R = Math.hypot(W, H), off = (t * drift) % gap; for (let d = -R; d < R; d += gap) ctx.fillRect(-R, d + off, R * 2, width); ctx.restore();
}
// a textured sun: warm gradient, two crossing fibre hatches, outline, rays
export function sun(ctx, x, y, r, { rays = 12, rayColor = "#D9A035", len = [1.25, 1.6], rayW = 3 } = {}) {
  ctx.save(); ellipse(ctx, x, y, r, r); const g = ctx.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r); g.addColorStop(0, "#F6C35A"); g.addColorStop(1, "#EFA43A"); fill(ctx, g);
  fibre(ctx, () => ellipse(ctx, x, y, r, r), [x - r, y - r, x + r, y + r], Math.round(r * 5), rad(-60), r * .22, ["#E07D22", "#D9661B", "#F8D27A"], Math.max(1, r / 45), .55, 5);
  ellipse(ctx, x, y, r, r); stroke(ctx, Math.max(1.5, r / 36));
  for (let i = 0; i < rays; i++) { const a = i / rays * Math.PI * 2 + .12; line(ctx, [[x + Math.cos(a) * r * len[0], y + Math.sin(a) * r * len[0]], [x + Math.cos(a) * r * len[1], y + Math.sin(a) * r * len[1]]], rayW, rayColor); }
  ctx.restore();
}
export function moon(ctx, x, y, r) { ellipse(ctx, x, y, r, r); fill(ctx, "#D9D9DE"); ctx.save(); ellipse(ctx, x, y, r, r); ctx.clip(); ellipse(ctx, x + r * .5, y - r * .25, r * .95, r); fill(ctx, "#A8A8B6"); ctx.restore(); ellipse(ctx, x, y, r, r); stroke(ctx, 2.2); }
export function star4(ctx, x, y, r, color = "#EDEBFF") { ctx.fillStyle = color; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .23 : r; i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
// a row of grass blades along a ground line
export function grass(ctx, y, x0, x1, h = 18, seed = 3, cols = ["#6FA45A", "#8DB872"]) {
  const r = rng(seed); ctx.save(); ctx.lineCap = "round";
  for (let x = x0; x < x1; x += 6 + r() * 6) { const hh = h * (.4 + r() * .8), lean = (r() - .5) * 8; ctx.strokeStyle = cols[r() > .5 ? 0 : 1]; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * .3, y - hh * .6, x + lean, y - hh); ctx.stroke(); }
  ctx.restore();
}
// soil cross-section: "dig" (warm, pebbles), "day" (lighter, blotches), "night" (dark, star-like specks)
export function soil(W, H, kind = "day") {
  const c = createCanvas(W, H), x = c.getContext("2d"), r = rng({ dig: 11, night: 21, day: 31 }[kind] || 7);
  x.fillStyle = { dig: "#8C5E3D", night: "#3A2519", day: "#9A6A45" }[kind]; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "multiply"; x.globalAlpha = .5; x.fillStyle = x.createPattern(grainCanvas(256, 70, 5 + kind.length), "repeat"); x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  if (kind !== "night") hatch(x, () => { x.beginPath(); x.rect(0, 0, W, H); }, rad(-32), 7, "#5E3C24", 1, .25, [0, 0, W, H]);
  x.strokeStyle = kind === "night" ? "rgba(200,170,140,.35)" : "rgba(70,40,20,.55)"; x.lineWidth = 1.6;
  for (const f of [.24, .44, .65]) { const yy = f * H; x.beginPath(); for (let i = 0; i <= 40; i++) { const px = i / 40 * W, py = yy + Math.sin(i * .7 + yy) * 7 + Math.sin(i * 1.9) * 3; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  for (let i = 0; i < W * H / (kind === "night" ? 3000 : 4400); i++) { const px = r() * W, py = r() * H, s = r();
    if (kind === "night") { x.fillStyle = s > .7 ? "rgba(240,225,200,.8)" : "rgba(160,120,90,.6)"; x.beginPath(); x.arc(px, py, .8 + s * 1.8, 0, 7); x.fill();
      if (s > .93) { ellipse(x, px, py, 9 + 6 * s, 6 + 4 * s, s * 3); stroke(x, 1, "rgba(200,170,140,.5)"); } }
    else if (s > .88 && kind === "dig") { ellipse(x, px, py, 12 + 8 * r(), 9 + 5 * r(), r() * 3); fill(x, "#E7D2A6"); stroke(x, 1.6, "#3B2414"); }
    else { x.fillStyle = s > .5 ? "#6E4529" : "#7E5233"; ellipse(x, px, py, 3 + s * 9, 2.5 + s * 6, r() * 3); x.fill(); } }
  return c;
}
// a night sky strip: navy, fine hatch, dots and four-point stars
export function nightSky(W, H, seed = 9) {
  const c = createCanvas(W, H), x = c.getContext("2d"), r = rng(seed); x.fillStyle = "#1C2458"; x.fillRect(0, 0, W, H);
  hatch(x, () => { x.beginPath(); x.rect(0, 0, W, H); }, rad(-20), 4, "#2A3470", 1, .6, [0, 0, W, H]);
  for (let i = 0; i < W * H / 6000; i++) { const px = r() * W, py = r() * H, s = r(); if (s > .82) star4(x, px, py, 7); else { x.fillStyle = "#EDEBFF"; x.beginPath(); x.arc(px, py, 1 + s, 0, 7); x.fill(); } }
  return c;
}
// fruit flesh as packed juice cells (watermelon, citrus with other colours)
export function fleshCells(w, h, { base = "#D02A3B", cell = [200, 30, 50], line = "rgba(120,10,25,.55)", hi = "rgba(255,200,205,.6)", size = 17 } = {}) {
  const c = createCanvas(w, h), x = c.getContext("2d"), r = rng(17); x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let yy = size / 2; yy < h; yy += size) for (let xx = (yy / size % 2) * size / 2; xx < w; xx += size + 1) {
    const px = xx + (r() - .5) * 6, py = yy + (r() - .5) * 5, rr = size * .42 + r() * 3;
    x.fillStyle = `rgba(${cell[0] + r() * 40 | 0},${cell[1] + r() * 25 | 0},${cell[2] + r() * 20 | 0},.9)`; ellipse(x, px, py, rr, rr * .85, r() * 3); x.fill(); x.strokeStyle = line; x.lineWidth = 1.4; x.stroke();
    if (r() > .6) { x.fillStyle = hi; x.beginPath(); x.arc(px - 2, py - 2, 1.4, 0, 7); x.fill(); } }
  return c;
}
// film finish: a few precomputed grain tiles cycled per frame + tiny exposure flicker + vignette
export function filmFinish(W, H, { tiles = 4, grain = .12, flicker = .025, vignette = .18 } = {}) {
  const T = Array.from({ length: tiles }, (_, i) => grainCanvas(256, 90, 101 + i * 7));
  const v = createCanvas(W, H), vx = v.getContext("2d"), g = vx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .55);
  g.addColorStop(0, "rgba(40,30,20,0)"); g.addColorStop(1, `rgba(40,30,20,${vignette})`); vx.fillStyle = g; vx.fillRect(0, 0, W, H);
  return (ctx, frame) => { ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = grain; const tile = T[frame % tiles];
    const ox = Math.floor(hash(frame) * 256), oy = Math.floor(hash(frame + 5) * 256); ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(tile, "repeat"); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
    ctx.drawImage(v, 0, 0);
    const f = (hash(frame * 1.3) - .5) * 2 * flicker; if (f) { ctx.save(); ctx.globalCompositeOperation = f > 0 ? "screen" : "multiply"; ctx.fillStyle = f > 0 ? `rgba(255,250,240,${f})` : `rgba(0,0,0,${-f})`; ctx.fillRect(0, 0, W, H); ctx.restore(); } };
}
