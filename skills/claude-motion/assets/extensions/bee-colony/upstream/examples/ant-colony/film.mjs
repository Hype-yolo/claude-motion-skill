// film.mjs — "The leaf and the colony": a 32 s, 16:9 showcase of the claude-animation skill.
//   node film.mjs sheet 0.5,3,5,8,12,18 | strip 9.5 12 | verify | cues | render
//
// STYLE BIBLE (verbatim): textured editorial storybook. Paper #F3EEDD + grain + 40° light bands in skies.
// Ink #1E1612, heroes 2.6–3.4 px. Ant browns; leaf greens #8CCB6A→#4E9A42; soil #7A5234→#3E2616 with lit
// chambers #F0CC98→#8E6342; brood whites; fungus #FFFFFF→#DCD6C8; construction blue #5E80CC only for the
// cut line and the process section. No text between 7 s and the end card: the pictures carry it.
//
// BEATS
//  0.0– 2.2  HOOK: the ant's face, huge. "This is code." + the line that draws it.
//  2.2– 7.0  PROCESS: sketch → ink → colour → polish (sweeps), then it walks out.
//  7.0–10.8  LEAF: a fallen leaf; a blue cut-line; the ant chews along it; the piece goes up like a sail.
// 10.8–15.4  TRAIL: tracking shot with parallax, a column of leaf-carriers, morning into gold, the mound.
// 15.4–15.9  DIVE into the hole.
// 15.9–26.6  COLONY in cross-section: down the shaft, the leaf goes onto the fungus garden, the nursery
//            (magnifier on a larva), the queen lays an egg, pull back to the whole nest while day turns to night.
// 26.6–32.0  END CARD: every frame is code + repo.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = process.env.CLAUDE_ANIMATION_LIB || path.join(HERE, "../../plugins/claude-animation/skills/claude-animation/lib");
const { clamp, lerp, ss, eOut, eIn, eIO, eBack, popS, at, line, ellipse, stroke, fill, poly, smooth, hatch, burst, speedLines, rrect, rng, rad, hash, pathOf, createCanvas, INK } = await import(path.join(LIB, "core.mjs"));
const { paper, lightBands, sun, moon, star4, grass } = await import(path.join(LIB, "textures.mjs"));
const { sprout, drop, blossom } = await import(path.join(LIB, "nature.mjs"));
const { leaf, leafPiece, egg, larva, cocoon, seedGrain, fungus, roots, nestCanvas } = await import(path.join(LIB, "colony.mjs"));
const { ant, antGuides } = await import(path.join(LIB, "rigs/ant.mjs"));
const { run } = await import(path.join(LIB, "film.mjs"));
const { GlobalFonts } = await import(path.join(LIB, "../node_modules/@napi-rs/canvas/index.js"));
const FD = process.env.FONT_DIR || path.join(process.env.HOME, ".claude/skills/tesseract-edit/assets/fonts");
const reg = (f, n) => { if (fs.existsSync(f)) GlobalFonts.registerFromPath(f, n); };
reg(path.join(FD, "Inter/Inter_28pt-Bold.ttf"), "IBold"); reg(path.join(FD, "Inter/Inter_28pt-SemiBold.ttf"), "ISemi"); reg("/System/Library/Fonts/Menlo.ttc", "Mono");

const W = 1920, H = 1080, FPS = 24, DUR = 32;
const CUT = { process: 2.2, leaf: 7.0, trail: 10.8, dive: 15.4, colony: 15.9, end: 26.6 };
const RENDER_SECONDS = process.env.RENDER_SECONDS || "20";
const BLUE = "#5E80CC";

// ---------------------------------------------------------------- type helpers
function typed(ctx, str, x, y, t0, t1, t, { font = "76px IBold", color = INK, align = "left", caret = false } = {}) {
  const n = Math.floor(str.length * clamp((t - t0) / (t1 - t0))); if (n <= 0 && !caret) return;
  ctx.save(); ctx.font = font; ctx.fillStyle = color; const full = ctx.measureText(str).width, x0 = align === "center" ? x - full / 2 : x, s = str.slice(0, n); ctx.fillText(s, x0, y);
  if (caret && (t < t1 + .6 || Math.floor(t * 2.5) % 2 === 0)) { const cw = ctx.measureText(s).width, fs_ = parseInt(font); ctx.fillRect(x0 + cw + 4, y - fs_ * .78, fs_ * .08, fs_ * .9); }
  ctx.restore();
}
function codeChip(ctx, str, x, y, t0, t1, t, size = 32, align = "left") {
  ctx.save(); ctx.font = `${size}px Mono`; const w = ctx.measureText(str).width + 56, h = size * 1.9, k = clamp((t - t0 + .15) / .2); if (k <= 0) { ctx.restore(); return; }
  const x0 = align === "center" ? x - w / 2 : x; ctx.globalAlpha = k; poly(ctx, rrect(x0, y - h / 2, w, h, 20)); fill(ctx, "#1E1612"); ctx.restore();
  typed(ctx, str, x0 + 28, y + size * .35, t0, t1, t, { font: `${size}px Mono`, color: "#F3EEDD", caret: true });
}

// ================================================================ 1. HOOK
function hook(ctx, t, S) {
  ctx.drawImage(S.paper, 0, 0); lightBands(ctx, W, H, t, { alpha: .45 });
  const Z = lerp(3.1, 2.75, eOut(t / 2.2)), fx = 1330, fy = 650;
  ctx.save(); ctx.translate(1560, 600); ctx.scale(Z, Z); ctx.translate(-fx, -fy);
  ant(ctx, 1200, 780, 1.3, { jaw: ss(.75, .9, t) * (1 - ss(1.4, 1.55, t)), ant: Math.sin(t * 4) * .5, blink: t > 1.2 && t < 1.3 });
  ctx.restore();
  typed(ctx, "This is code.", 100, 250, .12, .7, t, { font: "150px IBold" });
  codeChip(ctx, "ant(ctx, x, ground, 1.3, { jaw: .6 })", 100, 370, .6, 1.5, t, 34);
}

// ================================================================ 2. PROCESS: sketch → ink → colour → polish
const LOOKS = [null, { ink: 1, fill: 0, tex: 0 }, { ink: 1, fill: 1, tex: 0 }, { ink: 1, fill: 1, tex: 1 }];
const SWEEP = [3.05, 4.05, 5.05], SW = .42, STAGE = ["sketch", "ink", "colour", "polish"];
function process_(ctx, t, S) {
  ctx.drawImage(S.paper, 0, 0);
  ctx.save(); ctx.strokeStyle = "rgba(94,128,204,.13)"; ctx.lineWidth = 1.4; for (let x = 20; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore();
  const GY = 820, SC = 2.3, walk = t > 6.2, AX = 950 + (walk ? eIn((t - 6.2) / .8) * 1300 : 0);
  line(ctx, [[260, GY], [1660, GY]], 2.4, walk ? INK : BLUE);
  const stage = SWEEP.filter((s) => t >= s + SW).length, sw = SWEEP.findIndex((s) => t >= s && t < s + SW);
  const pose = { ant: Math.sin(t * 4) * .4, gait: walk ? t * 11 : undefined, blink: t > 5.8 && t < 5.9 }, guidesA = 1 - ss(5.05, 5.7, t);
  const draw = (k) => { if (k >= 1) ant(ctx, AX, GY, SC, { ...pose, look: LOOKS[k] }); };
  if (guidesA > 0) antGuides(ctx, AX, GY, SC, ss(2.25, 2.95, t), { color: stage >= 1 ? `rgba(94,128,204,${.45 * guidesA})` : BLUE, w: 2.4 });
  if (sw >= 0) { const k = (t - SWEEP[sw]) / SW, sx = lerp(100, 1820, eIO(k));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sx, H); ctx.clip(); draw(sw + 1); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, W - sx, H); ctx.clip(); draw(sw); ctx.restore();
    ctx.save(); const gl = ctx.createLinearGradient(sx - 50, 0, sx + 50, 0); gl.addColorStop(0, "rgba(94,128,204,0)"); gl.addColorStop(.5, "rgba(94,128,204,.35)"); gl.addColorStop(1, "rgba(94,128,204,0)"); ctx.fillStyle = gl; ctx.fillRect(sx - 50, 200, 100, 700); ctx.restore();
    line(ctx, [[sx, 200], [sx, 900]], 3, BLUE); } else draw(stage);
  // the stage strip: sketch · ink · colour · polish, the current one lit
  const cur = sw >= 0 ? sw + (t > SWEEP[sw] + SW * .5 ? 1 : 0) : stage;
  ctx.save(); ctx.font = "52px IBold"; ctx.textAlign = "center";
  STAGE.forEach((s, i) => { const x = 560 + i * 270, on = i === cur, k = on ? popS(t, i === 0 ? 2.25 : SWEEP[i - 1] + SW * .5, .3, 1.8) : 1;
    ctx.fillStyle = on ? INK : "rgba(30,22,18,.28)"; at(ctx, x, 150, on ? .9 + .2 * k : 1, 0, () => ctx.fillText(s, 0, 0)); if (i < 3) { ctx.fillStyle = "rgba(30,22,18,.28)"; ctx.fillText("→", x + 135, 150); } });
  ctx.restore();
  if (t > 5.45 && t < 5.85) burst(ctx, AX + 240, GY - 350, 70, 110, 9, 4, INK, Math.PI * 1.1, Math.PI * .8);
}

// ================================================================ 3–4. LEAF + TRAIL (world A)
const GA = 860, WA = 6400, MOUND = 5600;
function buildWorldA() {
  const hills = createCanvas(3600, H), h = hills.getContext("2d"), r = rng(3);
  for (const [base, col, amp] of [[640, "#BFD7A8", 60], [720, "#A8CB8E", 45]]) { h.beginPath(); h.moveTo(0, H); for (let x = 0; x <= 3600; x += 40) h.lineTo(x, base - amp * Math.sin(x * .002 + base) - 25 * Math.sin(x * .007)); h.lineTo(3600, H); h.closePath(); h.fillStyle = col; h.fill(); h.strokeStyle = "rgba(30,22,18,.35)"; h.lineWidth = 2; h.stroke(); }
  hatch(h, () => { h.beginPath(); h.rect(0, 560, 3600, 520); }, rad(-30), 9, "#7FA86A", 1, .25, [0, 560, 3600, H]);
  for (let i = 0; i < 26; i++) { const x = 80 + i * 140 + r() * 60, y = 690 - r() * 40; line(h, [[x, y], [x, y - 60]], 3, "rgba(60,90,50,.5)"); ellipse(h, x, y - 80, 26, 34); fill(h, "rgba(110,160,90,.55)"); }
  const mid = createCanvas(WA, H), m = mid.getContext("2d"), r2 = rng(8);
  // ground strip with path and pebbles
  const gg = m.createLinearGradient(0, GA, 0, H); gg.addColorStop(0, "#A2744C"); gg.addColorStop(1, "#6E4A2C"); m.fillStyle = gg; m.fillRect(0, GA, WA, H - GA);
  hatch(m, () => { m.beginPath(); m.rect(0, GA, WA, H - GA); }, rad(-30), 7, "#4E321C", 1, .3, [0, GA, WA, H]);
  for (let i = 0; i < 380; i++) { const x = r2() * WA, y = GA + 8 + r2() * (H - GA - 8), s = r2(); if (s > .9) { ellipse(m, x, y, 10 + r2() * 12, 7 + r2() * 7, r2() * 3); fill(m, "#D9C09A"); stroke(m, 1.6, "#3B2414"); } else { m.fillStyle = s > .5 ? "#5E3E24" : "#B88B5E"; ellipse(m, x, y, 2 + s * 5, 1.6 + s * 3); m.fill(); } }
  line(m, [[0, GA], [WA, GA]], 3.2);
  // meadow: grass tufts, clover and small flowers behind the path
  for (let x = 0; x < WA; x += 90 + r2() * 120) { if (x > 650 && x < 1700) continue; const hgt = 60 + r2() * 110; for (let k = 0; k < 7; k++) { const bx = x + k * 7, lean = (r2() - .5) * 40; smooth(m, [[bx, GA], [bx + lean * .3, GA - hgt * .6], [bx + lean, GA - hgt]], false); stroke(m, 3.4); smooth(m, [[bx, GA], [bx + lean * .3, GA - hgt * .6], [bx + lean, GA - hgt]], false); stroke(m, 2, k % 2 ? "#6FA45A" : "#8DB872"); }
    if (r2() > .6) { const fxx = x + 30, fh = 240 + r2() * 110; line(m, [[fxx, GA], [fxx + 6, GA - fh]], 4, "#4E8A3A"); at(m, fxx + 6, GA - fh, .42 + r2() * .2, 0, () => blossom(m, 1, r2() > .5 ? "#F5CF3A" : "#F4F0E6")); } }
  // the mound and its hole
  m.save(); m.beginPath(); m.moveTo(MOUND - 360, GA); m.quadraticCurveTo(MOUND - 200, GA - 150, MOUND, GA - 170); m.quadraticCurveTo(MOUND + 200, GA - 150, MOUND + 360, GA); m.closePath();
  const mg = m.createLinearGradient(0, GA - 170, 0, GA); mg.addColorStop(0, "#B6865A"); mg.addColorStop(1, "#8A5E3B"); m.fillStyle = mg; m.fill(); m.restore();
  hatch(m, () => { m.beginPath(); m.moveTo(MOUND - 360, GA); m.quadraticCurveTo(MOUND - 200, GA - 150, MOUND, GA - 170); m.quadraticCurveTo(MOUND + 200, GA - 150, MOUND + 360, GA); m.closePath(); }, rad(-40), 6, "#5E3E24", 1, .35, [MOUND - 360, GA - 180, MOUND + 360, GA]);
  for (let i = 0; i < 70; i++) { const a = r2(), x = MOUND - 330 + a * 660, y = GA - Math.sin(a * Math.PI) * 150 + r2() * 30; ellipse(m, x, y, 4 + r2() * 5, 3 + r2() * 3); fill(m, "#E0C49A"); stroke(m, 1.2, "#3B2414"); }
  m.beginPath(); m.moveTo(MOUND - 360, GA); m.quadraticCurveTo(MOUND - 200, GA - 150, MOUND, GA - 170); m.quadraticCurveTo(MOUND + 200, GA - 150, MOUND + 360, GA); stroke(m, 3.4);
  ellipse(m, MOUND, GA - 162, 56, 18); fill(m, "#1E120A"); stroke(m, 3);
  return { hills, mid };
}
// hero on the surface
function heroA(t) {
  if (t < 7.9) return { x: lerp(-200, 930, eOut((t - 7.0) / .9)), walk: true };
  if (t < 10.2) return { x: 930, walk: false, chew: t > 8.35 && t < 9.65 };
  if (t < 14.95) return { x: lerp(930, MOUND - 260, eIO((t - 10.2) / 4.75)), walk: true, leaf: true };
  return { x: lerp(MOUND - 260, MOUND - 60, eIO((t - 14.95) / .45)), walk: true, leaf: true, climb: true };
}
const LEAF_AT = [1260, GA - 6], CUTC = [-190, -20, 78];
function leafAndTrail(ctx, t, S) {
  const h = heroA(t), camX = t < 10.2 ? 0 : clamp(h.x - 760, 0, WA - W), dive = ss(15.35, 15.9, t);
  // sky: morning to gold
  const gold = ss(10.5, 15.4, t), sky = ctx.createLinearGradient(0, 0, 0, GA);
  sky.addColorStop(0, gold < .5 ? "#CFE6EE" : "#F2D9A8"); sky.addColorStop(1, "#F6EEDC"); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  sun(ctx, 1500 - camX * .05, lerp(180, 260, gold), 90, { rayColor: gold > .5 ? "#E08A3A" : "#D9A035" });
  lightBands(ctx, W, H, t, { alpha: .35 + .2 * gold });
  ctx.drawImage(S.A.hills, -camX * .35, 0);
  ctx.save(); ctx.translate(960, GA - 160); ctx.scale(1 + dive * 2.4, 1 + dive * 2.4); ctx.translate(-960 - (dive ? (MOUND - camX - 960) * dive * .95 : 0), -(GA - 160) + (dive ? 0 : 0));
  ctx.translate(-camX, 0);
  ctx.drawImage(S.A.mid, 0, 0);
  // the fallen leaf: squashed into perspective, with the blue cut-line and the bite that follows it
  const cutP = ss(8.35, 9.65, t), piece = t > 9.65;
  at(ctx, LEAF_AT[0], LEAF_AT[1], 1, 0, () => { ctx.save(); ctx.scale(1, .5); leaf(ctx, 660, { cut: piece ? CUTC : null });
    if (t > 7.95 && !piece) { ctx.save(); ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.arc(CUTC[0], CUTC[1], CUTC[2], 0, Math.PI * 2 * ss(7.95, 8.3, t)); stroke(ctx, 3.4, BLUE); ctx.restore();
      if (cutP > 0) { ctx.beginPath(); ctx.arc(CUTC[0], CUTC[1], CUTC[2], -Math.PI * .5, -Math.PI * .5 + Math.PI * 2 * cutP); stroke(ctx, 5); } }
    ctx.restore(); });
  // leaf bits flying while chewing
  if (h.chew) { const r = rng(Math.floor(t * 12)); for (let i = 0; i < 3; i++) at(ctx, 1080 + r() * 80, GA - 60 - r() * 90, 1, r() * 3, () => { ellipse(ctx, 0, 0, 7, 4); fill(ctx, "#7CC05A"); stroke(ctx, 1.4); }); }
  // the column of leaf-carriers ahead and behind
  if (t > 10.2) for (let k = -2; k <= 4; k++) { if (k === 0) continue; const x = h.x + k * 520 + Math.sin(k) * 60, back = k === -2 || k === 3;
    if (x > MOUND - 300 && !back) continue;
    ant(ctx, back ? h.x + 200 + k * 380 - (t - 10.2) * 380 : x, GA, .95, { flip: back, gait: t * 11 + k, ant: Math.sin(t * 5 + k) * .5, carry: back ? undefined : (c) => at(c, 30, -70, .85 + (k % 2) * .15, -1.25 + k * .06, () => leafPiece(c, 80)) }); }
  // the hero
  const lift = ss(9.65, 10.1, t);
  const climbY = h.climb ? -150 * ss(0, 1, (h.x - (MOUND - 260)) / 200) : 0, sink = ss(15.25, 15.6, t);
  ctx.save(); if (sink > 0) { ctx.beginPath(); ctx.rect(-99999, -99999, 999999, 99999 + GA - 162 + 4); ctx.clip(); }
  ant(ctx, h.x, GA + climbY + sink * 120, 1.1, { gait: h.walk ? t * (h.leaf ? 10 : 12) : undefined, ant: Math.sin(t * 5) * .5 + (h.chew ? .4 : 0), headDip: h.chew ? 10 + Math.sin(t * 30) * 5 : 0, jaw: h.chew ? .5 + .5 * Math.sin(t * 30) : 0,
    rot: h.climb ? -.35 * (1 - sink) : 0, pivot: [0, 0],
    carry: lift > 0 ? (c) => at(c, lerp(40, 30, lift), lerp(10, -70, lift), 1, lerp(0, -1.25, lift), () => leafPiece(c, 80)) : undefined });
  ctx.restore();
  if (t > 9.65 && t < 10.05) burst(ctx, 1100, GA - 230, 60, 100, 9, 3.4, INK, Math.PI * 1.1, Math.PI * .8);
  ctx.restore();
  // foreground grass, fast parallax, soft and dark
  const r = rng(21); ctx.save(); ctx.globalAlpha = .85;
  for (let i = 0; i < (t < 10.2 ? 9 : 26); i++) { const x = ((i * 460 + r() * 200 - camX * 1.35) % (W + 600) + W + 600) % (W + 600) - 300, hh = 180 + r() * 220;
    for (let k = 0; k < 5; k++) { const bx = x + k * 14, lean = (r() - .5) * 60; smooth(ctx, [[bx, H + 20], [bx + lean * .3, H - hh * .6], [bx + lean, H - hh]], false); stroke(ctx, 9, "#2F5A28"); } }
  ctx.restore();
  if (dive > 0) { ctx.save(); ctx.globalAlpha = ss(.55, 1, dive); ctx.fillStyle = "#1E120A"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

// ================================================================ 5. COLONY (world B)
const WB = 3800, HB = 2800, GB = 420, ENT = 1900;
const CH = {
  fungus: { x: 1350, y: 1050, rx: 270, ry: 135 }, nursery: { x: 2480, y: 1010, rx: 230, ry: 115 }, queen: { x: 1900, y: 1660, rx: 320, ry: 150 },
  food: { x: 1060, y: 1640, rx: 200, ry: 100 }, cocoons: { x: 2700, y: 1600, rx: 220, ry: 105 }, dig: { x: 2240, y: 2210, rx: 180, ry: 90 }, rest: { x: 1420, y: 2250, rx: 170, ry: 85 },
};
const TUN = [
  [[ENT, GB - 10], [1860, 560], [1940, 720], [1900, 880]],                                 // 0 shaft
  [[1900, 880], [1700, 950], [1560, 1010], [1440, 1080]],                                   // 1 hub → fungus
  [[1900, 880], [2140, 930], [2290, 990], [2380, 1040]],                                    // 2 hub → nursery
  [[1900, 880], [1860, 1160], [1940, 1420], [1900, 1600]],                                  // 3 hub → queen
  [[1620, 1680], [1400, 1680], [1280, 1660], [1140, 1660]],                                 // 4 queen → food
  [[2180, 1690], [2400, 1650], [2520, 1630], [2600, 1620]],                                 // 5 queen → cocoons
  [[2000, 1800], [2100, 1990], [2180, 2130], [2200, 2200]],                                 // 6 queen → dig
  [[1780, 1800], [1600, 2010], [1500, 2170], [1460, 2240]],                                 // 7 queen → rest
];
function buildWorldB() {
  const { canvas, paths } = nestCanvas({ W: WB, H: HB, ground: GB, chambers: Object.values(CH), tunnels: TUN, seed: 11 });
  const x = canvas.getContext("2d");
  for (const [rx, len, sd] of [[700, 520, 3], [3100, 600, 5], [3350, 380, 9], [420, 460, 13]]) roots(x, rx, GB, len, sd, 7);
  // an earthworm in its own pocket
  ellipse(x, 560, 1320, 120, 60); fill(x, "#5A3A22"); const wp = []; for (let i = 0; i <= 20; i++) wp.push([480 + i * 8, 1320 + Math.sin(i * .6) * 22]);
  smooth(x, wp, false); stroke(x, 26); smooth(x, wp, false); stroke(x, 20, "#D98A8A"); for (let i = 2; i < 20; i += 2) line(x, [[wp[i][0], wp[i][1] - 9], [wp[i][0], wp[i][1] + 9]], 1.2, "rgba(120,50,50,.6)");
  // stores and brood that don't move
  const r = rng(4); for (let i = 0; i < 16; i++) at(x, CH.food.x - 120 + (i % 6) * 46 + r() * 10, CH.food.y + 60 - Math.floor(i / 6) * 22, 1.2, r() * .6 - .3, () => seedGrain(x, 1));
  for (let i = 0; i < 7; i++) at(x, CH.cocoons.x - 150 + i * 50, CH.cocoons.y + 50, 1.3, (r() - .5) * .3, () => cocoon(x, 1));
  return { canvas, paths };
}
function sky(ctx, t, x0, w, top, h) {   // the surface strip over the nest: day → dusk → night
  const n = ss(23.6, 26.2, t), g = ctx.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0, n < .5 ? lerpC("#CFE6EE", "#E8A86A", n * 2) : lerpC("#E8A86A", "#1C2458", n * 2 - 1)); g.addColorStop(1, n < .5 ? lerpC("#F6EEDC", "#F2C890", n * 2) : lerpC("#F2C890", "#34306A", n * 2 - 1));
  ctx.fillStyle = g; ctx.fillRect(x0, top, w, h);
  if (n > .6) { const r = rng(5); ctx.save(); ctx.globalAlpha = ss(.6, 1, n); for (let i = 0; i < 60; i++) { const px = x0 + r() * w, py = top + r() * (h - 60); r() > .85 ? star4(ctx, px, py, 9) : (ctx.fillStyle = "#EDEBFF", ctx.beginPath(), ctx.arc(px, py, 1.8, 0, 7), ctx.fill()); } moon(ctx, x0 + w * .75, top + 110, 44); ctx.restore(); }
  else sun(ctx, x0 + w * .72, top + 120 + n * 200, 64, { rays: 12 });
}
function lerpC(a, b, k) { const p = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(",")})`; }
// camera for the colony: [t, cx, cy, Z]
const CAM = [[15.9, ENT, GB + 60, 2.1], [16.4, ENT, 600, 1.35], [19.6, 1460, 1060, 1.3], [20.2, 1460, 1060, 1.3], [21.1, 2480, 1030, 1.45], [22.4, 2480, 1030, 1.45], [23.2, 1900, 1650, 1.3], [24.1, 1900, 1650, 1.3], [26.3, 1900, 1200, .51], [26.6, 1900, 1200, .51]];
function camAt(t) { for (let i = 0; i < CAM.length - 1; i++) { const [t0, x0, y0, z0] = CAM[i], [t1, x1, y1, z1] = CAM[i + 1]; if (t < t1) { const k = eIO((t - t0) / (t1 - t0)); return [lerp(x0, x1, k), lerp(y0, y1, k), lerp(z0, z1, k)]; } } const l = CAM[CAM.length - 1]; return [l[1], l[2], l[3]]; }
const HERO_B = pathOf([[ENT, GB - 10], [1860, 560], [1940, 720], [1900, 880], [1700, 950], [1560, 1010], [1440, 1080], [1400, 1110]]);
function walker(ctx, p, u, s, t, o = {}) {       // an ant walking along a tunnel path at fraction u, facing its travel
  const [x, y, a] = p.at(clamp(u)), back = o.back, ang = back ? a + Math.PI : a, left = Math.cos(ang) < 0;
  ant(ctx, x, y + 14, s, { flip: left, rot: left ? ang - Math.PI : ang, pivot: [0, 0], gait: t * 12 + (o.ph || 0), ant: Math.sin(t * 6 + (o.ph || 0)) * .5, carry: o.carry });
}
function colony(ctx, t, S) {
  const [cx, cy, Z] = camAt(t);
  ctx.fillStyle = "#3E2616"; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(960, 540); ctx.scale(Z, Z); ctx.translate(-cx, -cy);
  sky(ctx, t, 0, WB, 0, GB); lightBands(ctx, WB, GB, t, { alpha: .3 * (1 - ss(23.6, 25, t)) });
  ctx.drawImage(S.B.canvas, 0, 0);
  grass(ctx, GB, 0, WB, 26, 7); ellipse(ctx, ENT, GB - 6, 60, 16); fill(ctx, "#1E120A"); stroke(ctx, 3);
  // fungus garden grows when the leaf goes in
  const leafIn = ss(19.6, 20.0, t), grow = .72 + .28 * ss(19.9, 20.8, t);
  at(ctx, CH.fungus.x, CH.fungus.y + CH.fungus.ry * .55, 1, 0, () => fungus(ctx, 440, 150, grow, 4));
  if (t > 19.95) at(ctx, CH.fungus.x - 40, CH.fungus.y + 5, .9, -.3, () => leafPiece(ctx, 70));
  if (t > 19.95 && t < 20.9) { const k = (t - 19.95) / .95, r = rng(2); for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, d = 60 + k * 140; star4(ctx, CH.fungus.x + Math.cos(a) * d, CH.fungus.y - 30 + Math.sin(a) * d * .5, 10 * (1 - k), "#FFF6C8"); } }
  // nursery: eggs, wriggling larvae, a nurse
  const N = CH.nursery; for (let i = 0; i < 9; i++) at(ctx, N.x - 160 + (i % 5) * 26 + (i > 4 ? 13 : 0), N.y + 70 - (i > 4 ? 22 : 0), 1.3, 0, () => egg(ctx, 1));
  for (let i = 0; i < 4; i++) at(ctx, N.x + 10 + i * 50, N.y + 62, 1.25, (i % 2 ? -.3 : .2), () => larva(ctx, 1, Math.sin(t * 5 + i)));
  ant(ctx, N.x - 10, N.y + 100, .55, { flip: true, headDip: 10 + Math.sin(t * 3) * 6, ant: Math.sin(t * 6) * .6, jaw: .3 + .3 * Math.sin(t * 7) });
  // queen: laying, attended
  const Q = CH.queen, layK = ss(23.3, 23.7, t);
  ant(ctx, Q.x + 60, Q.y + 118, .82, { gaster: 1.8, ant: Math.sin(t * 2) * .3, blink: (t % 3.6) < .12 });
  for (let i = 0; i < 5; i++) at(ctx, Q.x - 250 + i * 26, Q.y + 118 - 10, 1.2, 0, () => egg(ctx, 1));
  if (layK > 0) at(ctx, lerp(Q.x - 130, Q.x - 120, layK), Q.y + 108, 1.2 * eBack(layK), 0, () => egg(ctx, 1));
  if (t > 23.65 && t < 24.0) burst(ctx, Q.x - 120, Q.y + 90, 30, 55, 8, 2.6, "#FFF6C8");
  ant(ctx, Q.x + 250, Q.y + 118, .5, { flip: true, headDip: 6, ant: Math.sin(t * 5) * .7 }); ant(ctx, Q.x - 60, Q.y + 70, .45, { ant: Math.sin(t * 5 + 2) * .7, headDip: 8 });
  // the digger, the sleepers
  const D = CH.dig; ant(ctx, D.x + 60, D.y + 80, .5, { headDip: 14, gait: t * 20, ant: .6, jaw: .5 + .5 * Math.sin(t * 20) }); { const r = rng(Math.floor(t * 8)); for (let i = 0; i < 3; i++) { ellipse(ctx, D.x + 130 + r() * 50, D.y + 20 - r() * 60, 6, 5); fill(ctx, "#8C5E3D"); stroke(ctx, 1.4); } }
  const R = CH.rest; ant(ctx, R.x - 50, R.y + 75, .45, { blink: true, headDip: 10, ant: -.8 }); ant(ctx, R.x + 70, R.y + 75, .45, { flip: true, blink: true, headDip: 10, ant: -.8 });
  // traffic in the tunnels
  S.B.paths.forEach((p, i) => { if (i === 0 && t < 20) return; for (let k = 0; k < 2; k++) { const sp = .11 + (i % 3) * .03, u = (t * sp + k * .5 + i * .17) % 1, back = k === 1; walker(ctx, p, back ? 1 - u : u, .4, t, { back, ph: i + k }); } });
  // the hero: down the shaft with the leaf, into the garden
  const hu = clamp((t - 16.0) / 3.6);
  if (t < 20.0) { const [x, y, a] = HERO_B.at(eIO(hu)), left = Math.cos(a) < 0, done = hu >= 1;
    ant(ctx, x, y + 14, .55, { flip: left, rot: done ? 0 : (left ? a - Math.PI : a), pivot: [0, 0], gait: done ? undefined : t * 12, ant: Math.sin(t * 5) * .5,
      carry: leafIn < 1 ? (c) => at(c, 30, -70, 1 - leafIn, -1.25, () => leafPiece(c, 80)) : undefined }); }
  else ant(ctx, 1450, 1112, .55, { flip: true, ant: Math.sin(t * 5) * .6, headDip: 6 });
  ctx.restore();
  // the magnifier on the nursery: a larva being fed, drawn big in its own circle
  const mg = ss(21.2, 21.5, t) * (1 - ss(22.7, 23.0, t));
  if (mg > 0) { const mx = 1460, my = 330, R2 = 190 * eBack(mg);
    ctx.save(); ctx.beginPath(); ctx.arc(mx, my, R2, 0, Math.PI * 2); ctx.fillStyle = "#E9C08E"; ctx.fill(); ctx.clip();
    const cg = ctx.createRadialGradient(mx, my - 60, 20, mx, my, R2); cg.addColorStop(0, "#F6D8AA"); cg.addColorStop(1, "#B98C62"); ctx.fillStyle = cg; ctx.fillRect(mx - R2, my - R2, R2 * 2, R2 * 2);
    at(ctx, mx - 30, my + 40, 3.2, .1, () => larva(ctx, 1, Math.sin(t * 5))); ant(ctx, mx + 170, my + 150, 1.0, { flip: true, headDip: 16, jaw: .5 + .5 * Math.sin(t * 8), ant: .7 });
    at(ctx, mx + 20, my - 10, 1.6, 0, () => drop(ctx, .8, "#F7E6A8")); ctx.restore();
    ctx.beginPath(); ctx.arc(mx, my, R2, 0, Math.PI * 2); stroke(ctx, 8, "#EDE6D8"); ctx.beginPath(); ctx.arc(mx, my, R2 + 5, 0, Math.PI * 2); stroke(ctx, 3);
    const [ccx, ccy, cz] = camAt(t), sx = 960 + (N.x + 40 - ccx) * cz, sy = 540 + (N.y + 60 - ccy) * cz; line(ctx, [[mx + R2 * .7, my + R2 * .7], [sx, sy]], 2.4, "rgba(237,230,216,.9)"); }
  // the dive lands: fade up from the dark of the hole
  if (t < 16.25) { ctx.save(); ctx.globalAlpha = 1 - ss(15.9, 16.25, t); ctx.fillStyle = "#1E120A"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (t > 26.3) { ctx.save(); ctx.globalAlpha = ss(26.3, 26.6, t); ctx.fillStyle = "#F3EEDD"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

// ================================================================ 6. END CARD
function endCard(ctx, t, S) {
  ctx.drawImage(S.paper, 0, 0); lightBands(ctx, W, H, t, { alpha: .5 });
  typed(ctx, "Every frame is code.", 960, 330, 26.75, 27.4, t, { font: "112px IBold", align: "center" });
  const k1 = popS(t, 27.55, .35, 1.6); if (k1 > 0) at(ctx, 960, 470, k1, 0, () => { ctx.font = "84px IBold"; ctx.textAlign = "center"; ctx.fillStyle = BLUE; ctx.fillText("claude-animation", 0, 0); ctx.textAlign = "left"; });
  const k2 = popS(t, 27.85, .3, 1.6); if (k2 > 0) at(ctx, 960, 560, k2, 0, () => { ctx.font = "44px ISemi"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(30,22,18,.75)"; ctx.fillText(`rendered in ${RENDER_SECONDS} seconds  ·  every sound synthesised  ·  open source`, 0, 0); ctx.textAlign = "left"; });
  codeChip(ctx, "github.com/buildwithhanif/claude-animation-skill", 960, 690, 28.3, 29.4, t, 34, "center");
  const GY = 960; line(ctx, [[0, GY], [W, GY]], 3); grass(ctx, GY, 0, W, 20, 4);
  ant(ctx, lerp(-300, 2200, clamp((t - 26.7) / 5.2)), GY, .95, { gait: t * 10, ant: Math.sin(t * 5) * .5, carry: (c) => at(c, 30, -70, 1, -1.25, () => leafPiece(c, 80)) });
  ctx.save(); ctx.font = "30px ISemi"; ctx.fillStyle = "rgba(30,22,18,.55)"; ctx.textAlign = "right"; ctx.fillText("@hanifproduktif", 1880, 1050); ctx.restore();
}

// ================================================================ sound cues from this timeline
function cues() {
  const Q = [], add = (sfx, t, vol = .45, o = {}) => Q.push({ sfx, t: +(t - .03).toFixed(3), vol, ...o });
  for (let i = 0; i < 13; i++) add("click", .12 + i * (.58 / 13), .22, { pitch: 1 + (i % 3) * .08 });
  for (let i = 0; i < 18; i++) add("click", .6 + i * (.9 / 18), .14, { pitch: .9 });
  add("click", .8, .5, { pitch: .6 }); add("click", 1.45, .4, { pitch: .7 });
  add("whoosh", 2.1, .55, { dur: .45 }); add("thump", 2.2, .5);
  for (let i = 0; i < 6; i++) add("tick", 2.3 + i * .12, .3, { pitch: 1 + i * .06 });
  SWEEP.forEach((s, i) => { add("whip", s, .35, { dur: .4 }); add("pop", s + SW * .5, .45, { pitch: 1 + i * .12 }); });
  add("sparkle", 5.45, .5); for (let t = 6.25; t < 7; t += .09) add("step", t, .2, { pan: .3 });
  add("whoosh", 6.95, .45);
  for (let t = 7.0; t < 7.9; t += .09) add("step", t, .16, { pan: -.3 });
  add("tick", 7.95, .35); add("drip", 8.1, .25);
  for (let t = 8.35; t < 9.65; t += .075) add("click", t, .22, { pitch: .55 + (Math.floor(t * 40) % 3) * .08 });
  add("scratch", 9.6, .45); add("pop", 9.68, .5); add("sparkle", 9.75, .35);
  for (let t = 10.2; t < 15.3; t += .1) add("step", t, .14, { pan: Math.sin(t) * .3 });
  add("riser", 14.0, .3, { dur: 1.4 }); add("whoosh", 15.35, .6, { dur: .6 }); add("thump", 15.9, .45);
  for (let t = 16.1; t < 19.6; t += .11) add("step", t, .12);
  add("pop", 19.62, .45); add("sparkle", 19.95, .5); add("chime", 20.1, .3);
  add("whoosh", 20.25, .35); add("pop", 21.2, .45); add("drip", 21.6, .3); add("drip", 22.1, .25);
  add("whoosh", 22.45, .3); add("pop", 23.5, .5, { pitch: 1.2 }); add("sparkle", 23.65, .35);
  add("riser", 24.2, .3, { dur: 1.8 }); add("chime", 25.8, .45); add("sparkle", 26.0, .3);
  add("whoosh", 26.5, .4);
  for (let i = 0; i < 20; i++) add("click", 26.75 + i * .032, .16);
  add("pop", 27.55, .45); add("pop", 27.85, .35); for (let i = 0; i < 24; i++) add("click", 28.3 + i * .045, .13);
  add("chime", 30.6, .5);
  return Q;
}
if (process.argv[2] === "cues") { const q = cues(); fs.writeFileSync(path.join(HERE, "cues.json"), JSON.stringify(q)); console.log("wrote cues.json", q.length, "cues"); process.exit(0); }

run({
  name: "ant-colony", W, H, fps: FPS, dur: DUR, out: path.join(HERE, "out"),
  setup() { return { paper: paper(W, H), A: buildWorldA(), B: buildWorldB() }; },
  frame(ctx, t, i, S) {
    if (t < CUT.process) hook(ctx, t, S); else if (t < CUT.leaf) process_(ctx, t, S); else if (t < CUT.colony) leafAndTrail(ctx, t, S); else if (t < CUT.end) colony(ctx, t, S); else endCard(ctx, t, S);
  },
});
