import { Gfx, rng, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { bounds, mix, smooth } from "./gallery";
import { clamp01, fibres, onGrid, path, scissor, staged, tear, type Step } from "./scrapbookKit";

// A SEASIDE TOWN IN A TOY THEATRE · mixed-media paper collage, stop-motion on twos.
//
// MEDIUM, physically. A cardboard toy theatre stood on a kraft-paper table, built from three
// kinds of paper. (1) COLOURED AND PATTERNED PAPERS, scissor-cut or torn: plain sugar paper for
// the deep sea, printed papers for the rest (a wave print, a dot print for the headland, a stone
// print for the quay, a diamond print on the proscenium, newsprint for the boat). (2) GOUACHE
// CUT-OUTS: flat opaque paint laid in visible brush strokes on white card, cut out with a white
// margin left round them like a sticker (the sun, the lighthouse, the houses, the gull). (3) Card
// itself: every piece has THICKNESS, a darker cut edge showing down-right of its face, and it
// stands a finger's width in front of the flat behind it, so it throws a soft shadow whose
// distance says how far apart the flats are.
// MARK / EDGE / ORDER. Mark: the brush stroke of gouache and the printed motif, never a drawn
// line. Edge: scissor-crisp or torn, then the card's own cut edge, then the white sticker margin.
// Order: the theatre is set on the table, then the scene is built from the back: the sky drop is
// flown in, the sun lowered on its stick, clouds hung, the headland slid in from the wing, the
// lighthouse pushed up, the sea rows and the quay slid in, the houses stood up one by one, the
// boat pushed on along its wave, the gull set on its post, the ground row, the curtains and the
// valance last.
// MOTION GRAMMAR. Stop-motion ON TWOS: every pose is held for two frames. Each piece is moved by
// hand: it travels held above the stack (its shadow wide and far), then lands with a small
// damped jiggle (a few degrees, a pixel or two of bounce) and is still. The final second is the
// still.
// NOT fox (cut paper): fox has no paint, no pattern and no depth between layers; this is painted
// and printed paper in a stage space with real gaps between flats. Light: the sun, upper left.
// Reference, from memory: Pollock's and Webb's Victorian toy theatres (proscenium, wings, ground
// rows, flown drops), a herring gull's side profile, the folded-newspaper boat.

const N = 390;
const PEN: Medium = { nib: 1, taper: 0.3, pressure: 0.3, retrace: false, wobble: 0.4, rough: 0.3 };
const WHITE = "#fbf9f2";

// ---------------------------------------------------------------- paint and print (all clipped to the piece)
type R = () => number;
const gouache = (c: Ctx, shape: P[], color: string, seed: number, o: { dir?: number; len?: number; w?: number; vary?: number; dens?: number } = {}) => {
  const { dir = 0, len = 44, w = 13, vary = 0.1, dens = 1 } = o, r = rng(seed), b = bounds(shape), area = (b.x1 - b.x0) * (b.y1 - b.y0);
  c.fillStyle = color; path(c, shape); c.fill();
  c.save(); path(c, shape); c.clip(); c.lineCap = "round";
  const n = Math.max(6, Math.round((area / (len * w)) * 1.6 * dens));
  for (let i = 0; i < n; i++) { const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0), a = dir + (r() - 0.5) * 0.35, l = len * (0.6 + r() * 0.7), k = r(); c.strokeStyle = k < 0.5 ? mix(color, "#ffffff", vary * (0.5 + r())) : mix(color, "#1d2430", vary * (0.4 + r())); c.globalAlpha = 0.28 + r() * 0.25; c.lineWidth = w * (0.6 + r() * 0.6); c.beginPath(); c.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); c.quadraticCurveTo(x + (r() - 0.5) * 6, y + (r() - 0.5) * 6, x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); c.stroke(); }
  c.restore(); c.globalAlpha = 1;
};
// painted shade: darker strokes laid along one side of a shape (the side away from the sun)
const shadeSide = (c: Ctx, shape: P[], color: string, seed: number, side: P, depth: number, dir = Math.PI / 2) => {
  const b = bounds(shape), r = rng(seed); c.save(); path(c, shape); c.clip(); c.lineCap = "round";
  for (let i = 0; i < 16; i++) { const u = r(), x = side[0] > 0 ? b.x1 - r() * depth : side[0] < 0 ? b.x0 + r() * depth : b.x0 + u * (b.x1 - b.x0), y = side[1] > 0 ? b.y1 - r() * depth : side[1] < 0 ? b.y0 + r() * depth : b.y0 + u * (b.y1 - b.y0), l = 16 + r() * 26; c.strokeStyle = color; c.globalAlpha = 0.3 + r() * 0.25; c.lineWidth = 5 + r() * 7; c.beginPath(); c.moveTo(x - Math.cos(dir) * l / 2, y - Math.sin(dir) * l / 2); c.lineTo(x + Math.cos(dir) * l / 2, y + Math.sin(dir) * l / 2); c.stroke(); }
  c.restore(); c.globalAlpha = 1;
};
const print = (c: Ctx, shape: P[], fn: (b: { x0: number; y0: number; x1: number; y1: number }) => void) => { c.save(); path(c, shape); c.clip(); fn(bounds(shape)); c.restore(); c.globalAlpha = 1; };
// a printed wave motif in rows: rows of small arcs, a little misregistered like cheap printing
const wavePrint = (c: Ctx, shape: P[], col: string, gap = 22, sw = 2) => print(c, shape, (b) => { c.strokeStyle = col; c.lineWidth = sw; c.globalAlpha = 0.55; for (let y = b.y0 + 8, row = 0; y < b.y1 + 10; y += gap, row++) { c.beginPath(); for (let x = b.x0 - 30 + (row % 2) * 15; x < b.x1 + 30; x += 30) { c.moveTo(x, y); c.quadraticCurveTo(x + 7.5, y - 7, x + 15, y); } c.stroke(); } });
const dotPrint = (c: Ctx, shape: P[], col: string, gap = 14, rad = 2.2) => print(c, shape, (b) => { c.fillStyle = col; c.globalAlpha = 0.8; for (let y = b.y0, row = 0; y < b.y1 + gap; y += gap * 0.87, row++) for (let x = b.x0 + (row % 2) * gap * 0.5; x < b.x1 + gap; x += gap) { c.beginPath(); c.arc(x, y, rad, 0, 6.28); c.fill(); } });
const diamondPrint = (c: Ctx, shape: P[], col: string, gap = 26) => print(c, shape, (b) => { c.fillStyle = col; c.globalAlpha = 0.5; for (let y = b.y0, row = 0; y < b.y1 + gap; y += gap / 2, row++) for (let x = b.x0 + (row % 2) * gap / 2; x < b.x1 + gap; x += gap) { c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 3, y); c.lineTo(x, y + 4); c.lineTo(x - 3, y); c.closePath(); c.fill(); } c.globalAlpha = 0.18; c.strokeStyle = col; c.lineWidth = 0.8; for (let d = b.x0 - (b.y1 - b.y0); d < b.x1; d += gap) { c.beginPath(); c.moveTo(d, b.y0); c.lineTo(d + (b.y1 - b.y0), b.y1); c.stroke(); c.beginPath(); c.moveTo(d + (b.y1 - b.y0), b.y0); c.lineTo(d, b.y1); c.stroke(); } });
const stonePrint = (c: Ctx, shape: P[], base: string, seed: number) => print(c, shape, (b) => { const r = rng(seed); for (let y = b.y0, row = 0; y < b.y1; y += 17, row++) for (let x = b.x0 - (row % 2) * 16; x < b.x1; ) { const w = 26 + r() * 16; c.fillStyle = mix(base, r() < 0.5 ? "#ffffff" : "#3b3226", 0.06 + r() * 0.14); c.globalAlpha = 1; c.beginPath(); c.roundRect(x + 1.5, y + 1.5, w - 3, 14, 4); c.fill(); x += w; } });
const newsPrint = (c: Ctx, shape: P[], seed: number) => print(c, shape, (b) => { const r = rng(seed); c.fillStyle = "#4a4640"; c.globalAlpha = 0.5; for (let col = b.x0 + 4; col < b.x1; col += 36) for (let y = b.y0 + 4; y < b.y1; y += 4.2) { if (r() < 0.06) { y += 6; continue; } const l = 20 + r() * 12; c.fillRect(col, y, l, 1.3); } c.globalAlpha = 0.7; c.fillRect(b.x0 + 16, b.y0 + 30, 60, 5); });
const woodPrint = (c: Ctx, shape: P[], col: string, seed: number) => print(c, shape, (b) => { const r = rng(seed); c.strokeStyle = col; c.lineWidth = 1; c.globalAlpha = 0.35; for (let y = b.y0; y < b.y1; y += 3 + r() * 4) { c.beginPath(); c.moveTo(b.x0, y); for (let x = b.x0; x <= b.x1; x += 40) c.lineTo(x, y + Math.sin(x * 0.013 + y) * 1.6); c.stroke(); } c.globalAlpha = 0.5; c.strokeStyle = mix(col, "#000000", 0.2); for (let x = b.x0 + 60 + r() * 60; x < b.x1; x += 90 + r() * 90) { c.beginPath(); c.moveTo(x, b.y0); c.lineTo(x, b.y1); c.stroke(); } });

// ---------------------------------------------------------------- pieces
// `cut` = the outline of the piece's card (with `border` for a sticker's white margin, made by
// stroking the outline round, which is the true margin a pair of scissors leaves); `face` paints
// it at rest; `depth` = the gap to the flat behind, which sets the shadow.
type Piece = { hole?: boolean; id: string; at: [number, number]; from: P; pivot: P; cut: P[][]; border?: number; edge: string; depth: number; face: (c: Ctx) => void };
const cutPath = (c: Ctx, pc: Piece, dx = 0, dy = 0, grow = 0) => { c.save(); c.translate(dx, dy); c.beginPath(); pc.cut.forEach((s) => { s.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }); c.fill(pc.hole ? "evenodd" : "nonzero"); if (pc.border || grow) { c.lineJoin = "round"; c.lineWidth = 2 * ((pc.border ?? 0) + grow); c.strokeStyle = c.fillStyle; c.stroke(); } c.restore(); };
// pose of a hand-moved piece on twos: travel held high, land, a damped jiggle, rest
type Pose = { dx: number; dy: number; rot: number; lift: number };
const REST: Pose = { dx: 0, dy: 0, rot: 0, lift: 0 };
const poseAt = (pc: Piece, f: number): Pose => {
  const [s, d] = pc.at, f2 = f - (f % 2); if (f >= s + d) return REST;
  const u = clamp01((f2 - s) / d), r = rng(pc.id.length * 131 + Math.round(f2)), seed = pc.id.charCodeAt(0) + pc.id.length;
  if (u < 0.62) { const v = u / 0.62, e = 1 - (1 - v) ** 2; return { dx: pc.from[0] * (1 - e) + (r() - 0.5) * 1.4, dy: pc.from[1] * (1 - e) + (r() - 0.5) * 1.4, rot: (seed % 2 ? 1 : -1) * 0.04 * (1 - e), lift: 1 - 0.6 * e }; }
  const v = (u - 0.62) / 0.38, damp = Math.exp(-4 * v) * (1 - v);
  return { dx: 0, dy: -2.2 * Math.abs(Math.sin(v * 9)) * damp, rot: (seed % 2 ? 1 : -1) * 0.035 * Math.sin(v * 13 + 0.6) * damp, lift: 0.4 * (1 - v) };
};
const drawPiece = (ctx: Ctx, env: Env, pc: Piece, f: number, p: number) => {
  const q = p >= 1 ? REST : poseAt(pc, f), xf = (c: Ctx) => { c.translate(pc.pivot[0] + q.dx, pc.pivot[1] + q.dy); c.rotate(q.rot); c.translate(-pc.pivot[0], -pc.pivot[1]); };
  // the shadow on the flat behind: wider and farther while the piece is held up
  const g = new Gfx(ctx, env, 0, PEN), sd = pc.depth * (1 + 2.2 * q.lift), all = pc.cut.flat();
  const box = (c: Ctx) => { if (pc.hole) return; c.beginPath(); c.rect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0); c.clip(); };   // the theatre's side walls hide a flat until it is on stage
  g.group("plain", () => { const c = g.cur; c.save(); box(c); xf(c); c.fillStyle = "#2a1c10"; cutPath(c, pc, sd * 0.6, sd); c.restore(); const b = bounds(all), m = (pc.border ?? 0) + sd * 2 + 60; g.touch(b.x0 - m, b.y0 - m, b.x1 + m, b.y1 + m); }, { blur: 2 + sd * 0.5, alpha: 0.36 - 0.1 * q.lift });
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.save(); box(ctx); xf(ctx);
  ctx.fillStyle = pc.edge; cutPath(ctx, pc, 1.2, 1.9);                         // the card's cut edge, down-right
  if (pc.border) { ctx.fillStyle = WHITE; cutPath(ctx, pc); ctx.fillStyle = "rgba(120,110,90,0.25)"; ctx.save(); ctx.lineWidth = 0.8; ctx.strokeStyle = "rgba(120,110,90,0.3)"; ctx.restore(); }
  pc.face(ctx); ctx.restore();
};

// ---------------------------------------------------------------- the scene, back to front
const OPEN = { x0: 150, y0: 200, x1: 930, y1: 852 }, BOX = { x0: 72, y0: 100, x1: 1008, y1: 948 };
const scallop = (x0: number, x1: number, y: number, amp: number, per: number, ph: number, bottom: number, seed: number): P[] => { const r = rng(seed), top: P[] = []; for (let x = x0; x <= x1 + 1; x += per / 8) top.push([x, y - amp * Math.abs(Math.sin(((x - x0) / per) * Math.PI + ph)) + (r() - 0.5) * 1.2]); return [...top, [x1, bottom], [x0, bottom]]; };

const sky: Piece = { id: "sky", at: [30, 20], from: [0, -420], pivot: [540, 520], edge: "#3f6f86", depth: 3, cut: [[[OPEN.x0 - 10, OPEN.y0 - 30], [OPEN.x1 + 10, OPEN.y0 - 30], [OPEN.x1 + 10, OPEN.y1], [OPEN.x0 - 10, OPEN.y1]]],
  face: (c) => { const s = sky.cut[0]; const gr = c.createLinearGradient(0, OPEN.y0, 0, 600); gr.addColorStop(0, "#5f9dc4"); gr.addColorStop(1, "#cfe3e6"); c.fillStyle = gr; path(c, s); c.fill(); const r = rng(5); c.save(); path(c, s); c.clip(); c.lineCap = "round"; for (let i = 0; i < 150; i++) { const y = OPEN.y0 - 20 + r() * 420, x = OPEN.x0 + r() * (OPEN.x1 - OPEN.x0), t = clamp01((y - OPEN.y0) / 400); c.strokeStyle = mix(mix("#5f9dc4", "#cfe3e6", t), r() < 0.5 ? "#ffffff" : "#2d5f86", 0.12 + r() * 0.1); c.globalAlpha = 0.35; c.lineWidth = 12 + r() * 14; c.beginPath(); c.moveTo(x - 50, y + (r() - 0.5) * 4); c.quadraticCurveTo(x, y + (r() - 0.5) * 8, x + 50 + r() * 40, y + (r() - 0.5) * 4); c.stroke(); } c.restore(); c.globalAlpha = 1; } };

const SUN: P = [470, 336];
const stick: Piece = { id: "stick", at: [50, 16], from: [0, -300], pivot: [SUN[0], 200], edge: "#8a6a40", depth: 6, cut: [[[SUN[0] - 4, 150], [SUN[0] + 4, 150], [SUN[0] + 4, SUN[1] - 40], [SUN[0] - 4, SUN[1] - 40]]], face: (c) => { c.fillStyle = "#d8b37a"; path(c, stick.cut[0]); c.fill(); c.fillStyle = "#b88c52"; c.fillRect(SUN[0] + 1, 150, 3, SUN[1] - 190); } };
const sunRays = (k: number): P[] => Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 50 : 76 - (i % 4 === 0 ? 0 : 8); return [SUN[0] + Math.cos(a) * rr * k, SUN[1] + Math.sin(a) * rr * k] as P; });
const sun: Piece = { id: "sun", at: [50, 16], from: [0, -300], pivot: [SUN[0], 200], edge: "#c9b99a", depth: 6, border: 7, cut: [sunRays(1)],
  face: (c) => { gouache(c, sunRays(1), "#f29a2e", 11, { dir: 0.3, len: 30, w: 10, vary: 0.14 }); const disc: P[] = Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * 6.28; return [SUN[0] + Math.cos(a) * 46, SUN[1] + Math.sin(a) * 46] as P; }); gouache(c, disc, "#f7c343", 12, { dir: -0.6, len: 26, w: 9, vary: 0.12 }); const hi: P[] = Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * 6.28; return [SUN[0] - 14 + Math.cos(a) * 16, SUN[1] - 14 + Math.sin(a) * 12] as P; }); gouache(c, hi, "#fde39a", 13, { dir: -0.6, len: 14, w: 6, vary: 0.05 }); shadeSide(c, disc, "#e0822a", 14, [1, 1], 16, -0.6); } };
// a scissor-cut cloud: flat underside, a run of rounded bumps on top
const cloudShape = (cx: number, cy: number, w: number, h: number, seed: number): P[] => { const r = rng(seed), pts: P[] = [[cx + w / 2, cy]], n = 4 + Math.floor(r() * 2); for (let i = 0; i <= n; i++) { const x = cx + w / 2 - (w * i) / n, hh = h * (0.45 + 0.55 * Math.sin((Math.PI * (i + 0.5)) / (n + 1))) * (0.8 + r() * 0.3); for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI, rr = w / n / 2; pts.push([x - rr + Math.cos(a) * rr, cy - hh * 0.5 - Math.sin(a) * hh * 0.55]); } } pts.push([cx - w / 2, cy]); return pts.map(([x, y], i) => [x, i === 0 || i === pts.length - 1 ? y : y]) as P[]; };
const cloud = (id: string, cx: number, cy: number, w: number, h: number, seed: number, at: [number, number]): Piece => { const s = scissor(cloudShape(cx, cy, w, h, seed), seed, 0.7); return { id, at, from: [0, -260], pivot: [cx, cy], edge: "#b9c4c8", depth: 7, cut: [s], face: (c) => { gouache(c, s, "#f6f4ec", seed, { len: 30, w: 10, vary: 0.05 }); shadeSide(c, s, "#b9c7d3", seed + 1, [0, 1], h * 0.28, 0.1); } }; };
const cloud1 = cloud("cloud1", 640, 336, 170, 70, 21, [65, 12]), cloud2 = cloud("cloud2", 812, 400, 110, 48, 22, [75, 12]);

const HEAD: P[] = smooth([[130, 640], [130, 468], [196, 446], [268, 436], [334, 452], [404, 490], [470, 540], [540, 600], [560, 640]], false, 6);
const headland: Piece = { id: "headland", at: [85, 16], from: [-440, 0], pivot: [300, 540], edge: "#4e6e38", depth: 8, cut: [tear(HEAD, 1.6, 31)],
  face: (c) => { const s = headland.cut[0]; c.fillStyle = "#7fa25a"; path(c, s); c.fill(); fibres(c, s, "#7fa25a", 32, 0.6, 0.2); dotPrint(c, s, "#a6c77a", 13, 2); const band = tear(smooth([[130, 640], [130, 530], [240, 520], [360, 540], [470, 580], [560, 640]], false, 5), 2, 33); c.fillStyle = "#5c8546"; path(c, band); c.fill(); fibres(c, band, "#5c8546", 34, 0.6, 0.2); } };
const LH: P = [318, 478];
const lhTower: P[] = [[LH[0] - 18, LH[1]], [LH[0] + 18, LH[1]], [LH[0] + 12, LH[1] - 86], [LH[0] - 12, LH[1] - 86]];
const lhCut: P[] = [[LH[0] - 20, LH[1] + 2], [LH[0] + 20, LH[1] + 2], [LH[0] + 14, LH[1] - 88], [LH[0] + 16, LH[1] - 90], [LH[0] + 12, LH[1] - 112], [LH[0] + 2, LH[1] - 126], [LH[0] - 2, LH[1] - 126], [LH[0] - 12, LH[1] - 112], [LH[0] - 16, LH[1] - 90], [LH[0] - 14, LH[1] - 88]];
const lighthouse: Piece = { id: "lighthouse", at: [100, 12], from: [0, 150], pivot: LH, edge: "#b9ad94", depth: 5, border: 5, cut: [lhCut],
  face: (c) => { gouache(c, lhTower, "#f3efe6", 41, { dir: Math.PI / 2, len: 20, w: 7, vary: 0.05 }); [[0.18, 0.36], [0.56, 0.74]].forEach(([a, b], i) => { const band: P[] = [[LH[0] - 18 + 6 * a, LH[1] - 86 * a], [LH[0] + 18 - 6 * a, LH[1] - 86 * a], [LH[0] + 18 - 6 * b, LH[1] - 86 * b], [LH[0] - 18 + 6 * b, LH[1] - 86 * b]]; gouache(c, band, "#cf3b2e", 42 + i, { len: 14, w: 6, vary: 0.1 }); }); shadeSide(c, lhTower, "#8f8a80", 44, [1, 0], 10, Math.PI / 2);
    c.fillStyle = "#2c2c30"; c.fillRect(LH[0] - 16, LH[1] - 92, 32, 5); gouache(c, [[LH[0] - 10, LH[1] - 110], [LH[0] + 10, LH[1] - 110], [LH[0] + 10, LH[1] - 92], [LH[0] - 10, LH[1] - 92]], "#f7d35c", 45, { len: 8, w: 4 }); c.strokeStyle = "#2c2c30"; c.lineWidth = 2; for (const x of [-10, -3, 4, 10]) { c.beginPath(); c.moveTo(LH[0] + x, LH[1] - 110); c.lineTo(LH[0] + x, LH[1] - 92); c.stroke(); }
    gouache(c, [[LH[0] - 13, LH[1] - 110], [LH[0] + 13, LH[1] - 110], [LH[0] + 3, LH[1] - 124], [LH[0] - 3, LH[1] - 124]], "#cf3b2e", 46, { len: 10, w: 5 }); c.fillStyle = "#2c2c30"; c.fillRect(LH[0] - 5, LH[1] - 22, 10, 22); c.fillStyle = "#6b8fb0"; c.fillRect(LH[0] - 3, LH[1] - 60, 6, 9); } };

const sea = (id: string, y: number, amp: number, per: number, color: string, seed: number, at: [number, number], fromX: number, depth: number, decorate?: (c: Ctx, s: P[]) => void): Piece => { const s = scissor(scallop(OPEN.x0 - 14, OPEN.x1 + 14, y, amp, per, seed * 0.7, OPEN.y1 + 4, seed), seed, 0.5); return { id, at, from: [fromX, 0], pivot: [540, y + 60], edge: mix(color, "#0b1a2a", 0.45), depth, cut: [s], face: (c) => { c.fillStyle = color; path(c, s); c.fill(); fibres(c, s, color, seed + 1, 0.7, 0.18); decorate?.(c, s); } }; };
const seaBack = sea("seaBack", 580, 5, 44, "#2c5d8a", 51, [110, 16], 900, 6);

// the quay and its houses
const quay: Piece = { id: "quay", at: [125, 14], from: [520, 0], pivot: [750, 640], edge: "#6d6150", depth: 9, cut: [[[590, 588], [900, 588], [900, 720], [590, 720]]],
  face: (c) => { const s = quay.cut[0]; c.fillStyle = "#b5a791"; path(c, s); c.fill(); stonePrint(c, s, "#b5a791", 61); c.fillStyle = "#8a7d69"; c.fillRect(590, 588, 310, 9); fibres(c, s, "#b5a791", 62, 0.6, 0.15); } };
type House = { x: number; w: number; h: number; wall: string; roof: string; kind: "gable" | "step" | "hip"; win: number; chim?: number };
const HOUSES: House[] = [
  { x: 626, w: 64, h: 118, wall: "#e9a19c", roof: "#b9412f", kind: "gable", win: 2, chim: 0.7 }, { x: 686, w: 58, h: 152, wall: "#e8b54a", roof: "#56606b", kind: "gable", win: 3 },
  { x: 746, w: 66, h: 108, wall: "#9ec4d6", roof: "#c0643c", kind: "hip", win: 2, chim: 0.25 }, { x: 806, w: 58, h: 140, wall: "#f0ebdf", roof: "#56606b", kind: "step", win: 3 },
  { x: 862, w: 54, h: 100, wall: "#a9c08d", roof: "#b9412f", kind: "gable", win: 2 },
];
const houseParts = (hs: House) => {
  const y0 = 590, wy = y0 - hs.h, x0 = hs.x - hs.w / 2, x1 = hs.x + hs.w / 2, rh = hs.kind === "hip" ? 26 : 38;
  const wall: P[] = [[x0, y0], [x1, y0], [x1, wy], [x0, wy]];
  const roof: P[] = hs.kind === "step" ? [[x0, wy], [x0, wy - 10], [x0 + 9, wy - 10], [x0 + 9, wy - 20], [x0 + 18, wy - 20], [x0 + 18, wy - 30], [hs.x - 5, wy - 30], [hs.x - 5, wy - 40], [hs.x + 5, wy - 40], [hs.x + 5, wy - 30], [x1 - 18, wy - 30], [x1 - 18, wy - 20], [x1 - 9, wy - 20], [x1 - 9, wy - 10], [x1, wy - 10], [x1, wy]] : hs.kind === "hip" ? [[x0 - 4, wy + 2], [x1 + 4, wy + 2], [x1 - 12, wy - rh], [x0 + 12, wy - rh]] : [[x0 - 5, wy + 2], [x1 + 5, wy + 2], [hs.x, wy - rh]];
  const chim: P[] | null = hs.chim !== undefined ? (() => { const cx = x0 + hs.w * hs.chim, top = wy - rh * 0.8 - 14; return [[cx - 5, wy - 6], [cx + 5, wy - 6], [cx + 5, top], [cx - 5, top]] as P[]; })() : null;
  return { wall, roof, chim, y0, wy, x0, x1 };
};
const house = (hs: House, i: number): Piece => {
  const pt = houseParts(hs), sil: P[] = [...pt.wall.slice(0, 2), ...pt.roof.slice().reverse().filter((_, k, a) => k < a.length), ...[]];
  const cut: P[][] = [[[pt.x0, pt.y0], [pt.x1, pt.y0], [pt.x1, pt.wy]], pt.roof, ...(pt.chim ? [pt.chim] : [])]; void sil;
  const body: P[] = [[pt.x0, pt.y0], [pt.x1, pt.y0], [pt.x1, pt.wy], [pt.x0, pt.wy]];
  return { id: `house${i}`, at: [140 + i * 10, 14], from: [0, 170], pivot: [hs.x, 590], edge: "#bdb29a", depth: 5, border: 5, cut: [body, pt.roof, ...(pt.chim ? [pt.chim] : [])],
    face: (c) => {
      if (pt.chim) gouache(c, pt.chim, "#a8553a", 70 + i, { dir: Math.PI / 2, len: 10, w: 5 });
      gouache(c, body, hs.wall, 71 + i, { dir: Math.PI / 2, len: 30, w: 9, vary: 0.1 });
      shadeSide(c, body, mix(hs.wall, "#2b2a40", 0.35), 72 + i, [1, 0], 11, Math.PI / 2);
      gouache(c, pt.roof, hs.roof, 73 + i, { dir: 0.2, len: 20, w: 7, vary: 0.14 });
      c.save(); path(c, body); c.clip(); c.globalAlpha = 0.35; c.fillStyle = "#2b2a40"; c.fillRect(pt.x0, pt.wy, hs.w, 7); c.restore(); c.globalAlpha = 1;   // the eave's shadow on the wall
      // windows: painted panes with white frames, a door at the foot
      const r = rng(80 + i), cols = 2, rows = hs.win, ww = hs.w * 0.24, wh = 17, gx = hs.w / (cols + 1), gy = (hs.h - 48) / rows;
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) { const x = pt.x0 + gx * (cc + 1) - ww / 2, y = pt.wy + 12 + gy * rr + (gy - wh) / 2; c.fillStyle = WHITE; c.fillRect(x - 2, y - 2, ww + 4, wh + 4); c.fillStyle = r() < 0.2 ? "#f3d27a" : "#35506b"; c.fillRect(x, y, ww, wh); c.fillStyle = WHITE; c.fillRect(x + ww / 2 - 0.8, y, 1.6, wh); c.fillRect(x, y + wh / 2 - 0.8, ww, 1.6); }
      const dx = i % 2 ? pt.x0 + hs.w * 0.62 : pt.x0 + hs.w * 0.3; c.fillStyle = WHITE; c.fillRect(dx - 9, pt.y0 - 32, 18, 32); gouache(c, [[dx - 7, pt.y0], [dx + 7, pt.y0], [dx + 7, pt.y0 - 30], [dx - 7, pt.y0 - 30]], ["#2f5f8a", "#7a3b2e", "#3d6b4f", "#b8412f", "#2f5f8a"][i], 90 + i, { dir: Math.PI / 2, len: 10, w: 4 });
    } };
};
const houses = HOUSES.map(house);
const seaMid = sea("seaMid", 700, 10, 74, "#3d7db0", 55, [205, 16], -900, 8, (c, s) => wavePrint(c, s, "#cfe6f2", 22, 2));

// the newspaper boat: hull and sail folded from one sheet; fold facets catch the light differently
const BT: P = [470, 700];
const boatHullL: P[] = [[BT[0] - 86, BT[1] - 2], [BT[0], BT[1] - 2], [BT[0], BT[1] + 40], [BT[0] - 56, BT[1] + 40]];
const boatHullR: P[] = [[BT[0], BT[1] - 2], [BT[0] + 86, BT[1] - 2], [BT[0] + 56, BT[1] + 40], [BT[0], BT[1] + 40]];
const sailL: P[] = [[BT[0] - 50, BT[1] - 2], [BT[0], BT[1] - 94], [BT[0], BT[1] - 2]], sailR: P[] = [[BT[0], BT[1] - 94], [BT[0] + 50, BT[1] - 2], [BT[0], BT[1] - 2]];
const boat: Piece = { id: "boat", at: [225, 22], from: [-420, 6], pivot: [BT[0], BT[1] + 30], edge: "#a39a86", depth: 7, cut: [[...boatHullL.slice(0, 1), [BT[0] - 50, BT[1] - 2], [BT[0], BT[1] - 94], [BT[0] + 50, BT[1] - 2], boatHullR[1], boatHullR[2], boatHullL[3]]],
  face: (c) => { const r = rng(9); [[sailL, "#efe9d8"], [sailR, "#cfc7b2"], [boatHullL, "#e6dfcb"], [boatHullR, "#c4bba5"]].forEach(([s, col], i) => { c.fillStyle = col as string; path(c, s as P[]); c.fill(); newsPrint(c, s as P[], 100 + i); c.globalAlpha = 1; }); c.strokeStyle = "rgba(90,80,60,0.45)"; c.lineWidth = 1; [[[BT[0], BT[1] - 94], [BT[0], BT[1] + 40]], [[BT[0] - 86, BT[1] - 2], [BT[0] + 86, BT[1] - 2]]].forEach(([a, b]) => { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }); c.fillStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.moveTo(BT[0] - 48, BT[1] - 6); c.lineTo(BT[0] - 3, BT[1] - 88); c.lineTo(BT[0] - 3, BT[1] - 70); c.closePath(); c.fill(); void r; } };
const seaFront = sea("seaFront", 776, 15, 118, "#4ba2a3", 57, [250, 16], 900, 9, (c, s) => { const r = rng(58); c.save(); path(c, s); c.clip(); c.lineCap = "round"; const top = s.slice(0, -2); for (let i = 0; i < top.length; i++) { const [x, y] = top[i]; if (r() > 0.42) continue; const k = 1 + Math.floor(r() * 3); for (let j = 0; j < k; j++) { const ox = (r() - 0.5) * 14, oy = 3 + r() * 9, l = 4 + r() * 10; c.strokeStyle = WHITE; c.globalAlpha = 0.55 + r() * 0.35; c.lineWidth = 3 + r() * 4; c.beginPath(); c.moveTo(x + ox, y + oy); c.lineTo(x + ox + l, y + oy + (r() - 0.5) * 3); c.stroke(); } } c.restore(); c.globalAlpha = 1; });

// the gull on a mooring post, front right
const POST: P = [790, 742];
const post: Piece = { id: "post", at: [270, 12], from: [0, 200], pivot: [POST[0], 860], edge: "#5a4028", depth: 6, border: 4, cut: [[[POST[0] - 11, POST[1]], [POST[0] + 11, POST[1] - 2], [POST[0] + 12, 862], [POST[0] - 12, 862]]],
  face: (c) => { const s = post.cut[0]; gouache(c, s, "#8b6440", 111, { dir: Math.PI / 2, len: 40, w: 6, vary: 0.15 }); shadeSide(c, s, "#4b3320", 112, [1, 0], 7, Math.PI / 2); c.fillStyle = "#d9c08a"; c.fillRect(POST[0] - 12, POST[1] + 34, 24, 5); c.fillRect(POST[0] - 12, POST[1] + 42, 24, 4); } };
// herring gull, left profile: bill, forehead, crown, nape, mantle, folded wing with black
// primaries, tail, belly, breast, throat; legs from the belly to the post top
const GS = 1.05, G = ([x, y]: P): P => [POST[0] + x * GS, POST[1] + y * GS];
const gullBody = smooth(([[-30, -54], [-26, -66], [-17, -74], [-6, -73], [2, -64], [12, -55], [30, -46], [50, -38], [36, -30], [16, -21], [-4, -22], [-18, -30], [-26, -42]] as P[]).map(G), true, 5);
const gullWing = smooth(([[-6, -57], [14, -54], [34, -46], [56, -37], [44, -35], [26, -33], [6, -37], [-6, -46]] as P[]).map(G), true, 4);
const gullTips: P[] = ([[36, -45], [56, -37], [44, -35], [34, -36]] as P[]).map(G);
const gullBill: P[] = ([[-27, -63], [-48, -57], [-44, -54], [-28, -55]] as P[]).map(G);
const gull: Piece = { id: "gull", at: [280, 12], from: [30, -220], pivot: POST, edge: "#bdb7aa", depth: 5, border: 5, cut: [gullBody, gullBill, ([[-3, -24], [3, -24], [4, 0], [-4, 0]] as P[]).map(G)],
  face: (c) => {
    c.strokeStyle = "#e28a6f"; c.lineWidth = 2.6; c.lineCap = "round"; [[-2, 5], [4, 9]].forEach(([a, b]) => { const p = G([a, -24]), q = G([b * 0.3, 0]); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); c.beginPath(); c.moveTo(q[0] - 4, q[1]); c.lineTo(q[0] + 4, q[1]); c.stroke(); });
    gouache(c, gullBody, "#f6f5f0", 121, { dir: 0.3, len: 14, w: 5, vary: 0.04 }); shadeSide(c, gullBody, "#c9cdd2", 122, [0, 1], 10, 0.25);
    gouache(c, gullWing, "#9aa3ad", 123, { dir: 0.35, len: 14, w: 5, vary: 0.1 }); gouache(c, gullTips, "#25262a", 124, { dir: 0.4, len: 8, w: 4, vary: 0.05 });
    c.fillStyle = WHITE; [[46, -38], [40, -40]].forEach(([x, y]) => { const q = G([x, y]); c.beginPath(); c.arc(q[0], q[1], 1.6, 0, 6.28); c.fill(); });
    gouache(c, gullBill, "#f0c23a", 125, { len: 6, w: 3 }); const sp = G([-40, -55.5]); c.fillStyle = "#d8412f"; c.beginPath(); c.arc(sp[0], sp[1], 2, 0, 6.28); c.fill();
    const e = G([-18, -66]); c.fillStyle = "#f3d25a"; c.beginPath(); c.arc(e[0], e[1], 2.6, 0, 6.28); c.fill(); c.fillStyle = "#16161a"; c.beginPath(); c.arc(e[0], e[1], 1.3, 0, 6.28); c.fill();
  } };

const beach: Piece = { id: "beach", at: [295, 14], from: [-380, 0], pivot: [320, 840], edge: "#9c8154", depth: 7, cut: [tear(smooth([[170, 870], [170, 806], [236, 790], [316, 798], [392, 822], [460, 856], [470, 870]], false, 5), 1.8, 131)],
  face: (c) => { const s = beach.cut[0]; c.fillStyle = "#e1c996"; path(c, s); c.fill(); fibres(c, s, "#e1c996", 132, 0.7, 0.2); print(c, s, (b) => { const r = rng(133); for (let i = 0; i < 260; i++) { c.fillStyle = r() < 0.5 ? "#b99a62" : "#f4e6c4"; c.globalAlpha = 0.7; c.fillRect(b.x0 + r() * (b.x1 - b.x0), b.y0 + r() * (b.y1 - b.y0), 1.6, 1.6); } }); [[246, 814, 13, 8, "#9aa0a3"], [284, 822, 9, 6, "#c7b8a4"], [330, 826, 11, 7, "#8d8278"]].forEach(([x, y, rx, ry, col], i) => { const peb: P[] = Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * 6.28; return [(x as number) + Math.cos(a) * (rx as number), (y as number) + Math.sin(a) * (ry as number)] as P; }); gouache(c, peb, col as string, 134 + i, { len: 8, w: 4 }); shadeSide(c, peb, "#5b5650", 137 + i, [1, 1], 5, 0.3); }); } };
const floor: Piece = { id: "floor", at: [5, 20], from: [0, -120], pivot: [540, 900], edge: "#6b4424", depth: 4, cut: [[[OPEN.x0 - 20, 832], [OPEN.x1 + 20, 832], [OPEN.x1 + 20, 870], [OPEN.x0 - 20, 870]]], face: (c) => { const s = floor.cut[0]; c.fillStyle = "#b07a45"; path(c, s); c.fill(); woodPrint(c, s, "#6d4524", 141); } };

// curtains and valance: red paper painted in folds, a gold cord
const curtainShape = (sg: number): P[] => { const x0 = sg < 0 ? OPEN.x0 - 6 : OPEN.x1 + 6, k = sg < 0 ? 1 : -1; return smooth([[x0, OPEN.y0 - 6], [x0 + k * 104, OPEN.y0 - 6], [x0 + k * 84, 380], [x0 + k * 46, 560], [x0 + k * 22, 610], [x0 + k * 40, 700], [x0 + k * 62, OPEN.y1 + 4], [x0, OPEN.y1 + 4]], false, 6); };
const curtain = (sg: number): Piece => { const s = curtainShape(sg); return { id: sg < 0 ? "curtainL" : "curtainR", at: [sg < 0 ? 315 : 320, 18], from: [sg * 220, 0], pivot: [sg < 0 ? OPEN.x0 : OPEN.x1, 400], edge: "#6b1a18", depth: 10, cut: [s],
  face: (c) => { gouache(c, s, "#b8302c", sg < 0 ? 151 : 152, { dir: Math.PI / 2, len: 70, w: 10, vary: 0.18, dens: 1.4 }); c.save(); path(c, s); c.clip(); const r = rng(153 + sg); for (let i = 0; i < 5; i++) { const x = (sg < 0 ? OPEN.x0 : OPEN.x1) + sg * -1 * (12 + i * 18); c.strokeStyle = i % 2 ? "#7c1c1a" : "#d9574a"; c.globalAlpha = 0.45; c.lineWidth = 6 + r() * 4; c.beginPath(); c.moveTo(x, OPEN.y0); c.quadraticCurveTo(x + sg * (18 + i * 6), 500, (sg < 0 ? OPEN.x0 : OPEN.x1) + sg * -1 * (30 + i * 4), 610); c.lineTo((sg < 0 ? OPEN.x0 : OPEN.x1) + sg * -1 * (36 + i * 8), OPEN.y1); c.stroke(); } c.restore(); c.globalAlpha = 1; const tie: P = [(sg < 0 ? OPEN.x0 : OPEN.x1) - sg * 36, 604]; c.strokeStyle = "#e1b54a"; c.lineWidth = 6; c.lineCap = "round"; c.beginPath(); c.moveTo(tie[0] - 26, tie[1] - 8); c.quadraticCurveTo(tie[0], tie[1] + 10, tie[0] + 28, tie[1] - 6); c.stroke(); c.fillStyle = "#e1b54a"; c.beginPath(); c.arc(tie[0] + sg * 6, tie[1] + 14, 6, 0, 6.28); c.fill(); } }; };
const valShape = (): P[] => { const pts: P[] = [[OPEN.x0 - 10, OPEN.y0 - 30], [OPEN.x1 + 10, OPEN.y0 - 30]]; const n = 9, w = (OPEN.x1 - OPEN.x0 + 20) / n; for (let i = n; i >= 1; i--) { const x1 = OPEN.x0 - 10 + i * w; for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; pts.push([x1 - w / 2 + Math.cos(a) * w / 2, OPEN.y0 + 44 + Math.sin(a) * 18]); } } return pts; };
const valance: Piece = { id: "valance", at: [335, 16], from: [0, -200], pivot: [540, OPEN.y0], edge: "#6b1a18", depth: 10, cut: [valShape()],
  face: (c) => { const s = valance.cut[0]; gouache(c, s, "#b8302c", 161, { dir: 0, len: 60, w: 10, vary: 0.16, dens: 1.2 }); c.save(); path(c, s); c.clip(); c.strokeStyle = "#e1b54a"; c.lineWidth = 5; c.beginPath(); path(c, s.map(([x, y]) => [x, y - 5] as P), true); c.stroke(); c.restore(); c.fillStyle = "#e1b54a"; const n = 9, w = (OPEN.x1 - OPEN.x0 + 20) / n; for (let i = 0; i < n - 1; i++) { const x = OPEN.x0 - 10 + (i + 1) * w; c.beginPath(); c.arc(x, OPEN.y0 + 48, 6, 0, 6.28); c.fill(); } } };

// the proscenium: patterned card, gold trim, a painted shell crest; it throws its own shadow into the stage
const PRO_OUT: P[] = smooth([[70, 950], [70, 120], [360, 120], [440, 92], [540, 40], [640, 92], [720, 120], [1010, 120], [1010, 950]], false, 5);
const PRO_IN: P[] = [[OPEN.x0, OPEN.y1], [OPEN.x0, OPEN.y0 + 30], ...smooth([[OPEN.x0, OPEN.y0 + 30], [540, OPEN.y0 - 6], [OPEN.x1, OPEN.y0 + 30]], false, 10).slice(1, -1), [OPEN.x1, OPEN.y0 + 30], [OPEN.x1, OPEN.y1]];
const proscenium: Piece = { hole: true, id: "pros", at: [5, 20], from: [0, -160], pivot: [540, 1000], edge: "#173b3e", depth: 5, cut: [PRO_OUT, PRO_IN],
  face: (c) => {
    // its shadow falls onto the stage behind, along the inner top and left: from the sun, upper left
    c.save(); path(c, PRO_IN); c.clip(); c.fillStyle = "rgba(20,14,8,0.28)"; c.beginPath(); c.rect(OPEN.x0 - 40, OPEN.y0 - 60, OPEN.x1 - OPEN.x0 + 80, OPEN.y1 - OPEN.y0 + 100); path(c, PRO_IN.map(([x, y]) => [x + 16, y + 22] as P)); c.fill("evenodd"); c.restore();
    const ring = () => { c.beginPath(); [PRO_OUT, PRO_IN].forEach((s) => { s.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }); };
    c.fillStyle = "#2f6f73"; ring(); c.fill("evenodd");
    c.save(); ring(); c.clip("evenodd"); diamondPrint(c, PRO_OUT, "#e6c56a", 26); c.restore();
    c.save(); ring(); c.clip("evenodd"); fibres(c, PRO_OUT, "#2f6f73", 171, 0.5, 0.15); c.restore();
    // gold trim round the opening: a strip of metallic paper with painted beads
    c.strokeStyle = "#d9ae4a"; c.lineWidth = 14; c.lineJoin = "round"; path(c, PRO_IN.map(([x, y]) => [x + (x < 540 ? -7 : 7), y + (y > 800 ? 7 : -7)] as P), false); c.stroke();
    c.strokeStyle = "#f2d78a"; c.lineWidth = 3; path(c, PRO_IN.map(([x, y]) => [x + (x < 540 ? -10 : 10), y + (y > 800 ? 10 : -10)] as P), false); c.stroke();
    const r = rng(172); c.fillStyle = "#9c6f22"; for (let y = OPEN.y0 + 40; y < OPEN.y1; y += 22) [OPEN.x0 - 7, OPEN.x1 + 7].forEach((x) => { c.beginPath(); c.arc(x + (r() - 0.5), y, 2.4, 0, 6.28); c.fill(); });
    // the stage-front apron below the opening
    const apron: P[] = [[OPEN.x0 - 30, OPEN.y1 + 18], [OPEN.x1 + 30, OPEN.y1 + 18], [OPEN.x1 + 30, 932], [OPEN.x0 - 30, 932]]; c.fillStyle = "#b8302c"; path(c, apron); c.fill(); fibres(c, apron, "#b8302c", 173, 0.5, 0.2); print(c, apron, (b) => { c.fillStyle = "#f0dcb0"; c.globalAlpha = 0.5; for (let x = b.x0 + 8; x < b.x1; x += 16) c.fillRect(x, b.y0 + 12, 3, b.y1 - b.y0 - 24); }); c.fillStyle = "#e1b54a"; c.fillRect(OPEN.x0 - 30, OPEN.y1 + 18, OPEN.x1 - OPEN.x0 + 60, 6); c.fillRect(OPEN.x0 - 30, 926, OPEN.x1 - OPEN.x0 + 60, 6);
    // the crest: a painted scallop shell on a cream cartouche
    const cart: P[] = Array.from({ length: 30 }, (_, i) => { const a = (i / 30) * 6.28; return [540 + Math.cos(a) * 62, 118 + Math.sin(a) * 44] as P; }); c.fillStyle = WHITE; c.beginPath(); path(c, cart); c.lineWidth = 10; c.strokeStyle = WHITE; c.stroke(); c.fill();
    gouache(c, cart, "#f1e2c2", 174, { len: 16, w: 6, vary: 0.06 }); const shell: P[] = [[540, 146]]; for (let k = 0; k <= 16; k++) { const a = Math.PI + (k / 16) * Math.PI; shell.push([540 + Math.cos(a) * 40, 138 + Math.sin(a) * 40 * (0.85 + 0.15 * Math.abs(Math.sin(k * Math.PI / 2)))]); } gouache(c, shell, "#e58f6f", 175, { dir: -Math.PI / 2, len: 16, w: 5 }); c.strokeStyle = "#b85a44"; c.lineWidth = 2.2; for (let k = 1; k < 8; k++) { const a = Math.PI + (k / 8) * Math.PI; c.beginPath(); c.moveTo(540, 144); c.lineTo(540 + Math.cos(a) * 36, 138 + Math.sin(a) * 34); c.stroke(); }
  } };

// ---------------------------------------------------------------- the table (frame 0) and the order
const table = (ctx: Ctx, env: Env) => { const { W, H } = env; ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = "#b8905f"; ctx.fillRect(0, 0, W, H); fibres(ctx, [[0, 0], [W, 0], [W, H], [0, H]], "#b8905f", 201, 1.2, 0.3); };
const post2 = (ctx: Ctx, env: Env) => { const g = new Gfx(ctx, env, 0, PEN); g.paper("paper", 0.12); g.vignette("rgba(60,36,14,0.32)"); };
const PAINTER: Piece[] = [sky, stick, sun, cloud1, cloud2, lighthouse, headland, seaBack, quay, ...houses, seaMid, boat, seaFront, post, gull, beach, floor, curtain(-1), curtain(1), valance, proscenium];
onGrid("paperCraft", PAINTER.map((p) => p.at[0]), N);
PAINTER.forEach((p) => { if (p.at[0] + p.at[1] > N - 30) throw new Error(`paperCraft: ${p.id} lands inside the hold`); });
const steps: Step[] = [{ id: "table", start: -1, end: 0, draw: (c, e) => table(c, e) }, ...PAINTER.map((pc): Step => ({ id: pc.id, start: pc.at[0], end: pc.at[0] + pc.at[1], draw: (c, e, p, f) => drawPiece(c, e, pc, f, p) }))];

export const drawPaperCraft = staged("paperCraft", steps, post2);
export const paperCraft: Film = {
  meta: { title: "A seaside town in a toy theatre · paper collage on twos", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "paperCraft", start: 0, end: N, draw: (ctx, f, env) => drawPaperCraft(ctx, f, env) }],
};
export const STYLE = { id: "paperCraft", name: "Toy-theatre paper collage", family: "collage", medium: "a cardboard toy theatre: patterned and sugar papers cut and torn, gouache-painted cut-outs with a white sticker margin, every piece with a card edge and a gap to the flat behind", nearest: "fox", hero: "A seaside town on a toy-theatre stage: sea rows, harbour houses, a newspaper boat, a sun on a stick" };
