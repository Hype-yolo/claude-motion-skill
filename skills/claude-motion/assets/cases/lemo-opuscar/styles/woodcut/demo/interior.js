// The Bell Founder · the foundry workshop: walls, furnace, the loam mould, crucible, the pour (plate coords 1848×912)
import * as WC from './engine/index.js';
import { mulberry, clamp, lerp } from '/core/lib.js';
import { part, drawPart, put, mul, T, R, about } from './rig.js';

const PI = Math.PI;
const LFIRE = WC.light(-.8, .1, .35);          // the furnace light comes from the left/below
let K = null;
function build() {
  if (K) return K;
  K = {};
  // back wall: vertical planks, faint, lit toward the furnace
  const wall = new WC.Region([WC.rect(-300, -200, 2450, 1000)], { res: 4 });
  K.wall = WC.hatch(wall, { dir: WC.dirAngle(PI / 2), tone: (x, y) => clamp(.62 - Math.hypot(x - 260, y - 560) / 1500 - .1 * (Math.sin(x * .021) > .92 ? 1 : 0)), sp: 11, lo: .3, hi: 1, seed: 31, seg: [60, 220], gap: [6, 30], jit: .03 });
  // roof beams
  K.beams = [[-300, 40, 2450, 46], [-300, 170, 2450, 22]].map(([x, y, w, h], i) => WC.shape([WC.rect(x, y, w, h)], { light: WC.light(0, 1, .3), R: 12, sp: 5, dir: 0, halo: 4, seed: 40 + i, lo: .35, seg: [40, 160] }));
  // furnace (left): brick mass with an arched mouth
  const fx = 180, fy = 720;
  K.furnace = WC.shape([[[fx - 200, fy + 200], [fx - 190, fy - 330], [fx - 120, fy - 420], [fx + 120, fy - 420], [fx + 190, fy - 330], [fx + 200, fy + 200]]], { light: WC.light(.7, -.2, .3), R: 40, sp: 7, dir: 0, halo: 5, seed: 50, lo: .38, seg: [16, 34], gap: [3, 8] });
  K.mouth = [[fx - 90, fy + 10], [fx - 90, fy - 120], ...Array.from({ length: 13 }, (_, i) => { const a = PI + i / 12 * PI; return [fx + Math.cos(a) * 90, fy - 120 + Math.sin(a) * 80]; }), [fx + 90, fy + 10]];
  K.fx = fx; K.fy = fy;
  // floor
  K.floor = WC.shape([WC.rect(-300, 800, 2450, 300)], { tone: () => (x, y) => clamp(.75 - Math.abs(x - 1180) / 900 - (y - 800) / 500), dir: 0, sp: 9, lo: .3, seed: 60, seg: [40, 200], halo: 0 });
  // the loam mould, buried to the shoulder in the casting pit (right of centre)
  const mx = 1250, my = 800;
  const mould = [[mx - 230, my + 20], [mx - 214, my - 120], [mx - 170, my - 250], [mx - 90, my - 330], [mx - 30, my - 352], [mx + 30, my - 352], [mx + 90, my - 330], [mx + 170, my - 250], [mx + 214, my - 120], [mx + 230, my + 20]];
  K.mould = WC.shape([WC.spline(mould, 6, true)], { light: WC.light(-.75, -.35, .45), R: 90, sp: 7, dir: WC.dirRing(mx, my + 60, 1.4), halo: 5, seed: 70, lo: .32, seg: [20, 70], gap: [2, 7] });
  K.cup = WC.shape([[[mx - 40, my - 350], [mx - 30, my - 400], [mx + 30, my - 400], [mx + 40, my - 350]]], { light: WC.light(-.8, -.3, .4), R: 14, sp: 4, dir: 0, halo: 4, seed: 71 });
  K.cupMouth = WC.ellipse(mx, my - 400, 30, 8, 20);
  K.mx = mx; K.my = my;
  // bands of rope/iron around the mould
  K.bands = [-140, -230].map((dy, i) => WC.cutAlong(WC.spline([[mx - 212 + (i ? 40 : 0), my + dy], [mx, my + dy + 26], [mx + 212 - (i ? 40 : 0), my + dy]], 4), { w: 5, kind: 'u', seg: [60, 160], seed: 80 + i }));
  // tools on the wall (silhouettes)
  K.tools = [[560, 300, 16, 220], [610, 280, 12, 250], [660, 320, 14, 190]].map(([x, y, w, h], i) => WC.shape([WC.rect(x, y, w, h), WC.rect(x - 18, y + h - 10, w + 36, 26)], { light: LFIRE, R: 6, sp: 4, dir: PI / 2, halo: 4, seed: 90 + i, lo: .5 }));
  return K;
}

// fire in the furnace mouth: flame tongues carved white, re-cut every 2 frames (a living fire)
export function fire(m, t, k = 1) {
  const K = build(), q = Math.floor(t * 12), r = mulberry(1000 + q);
  WC.fillPoly(m, [K.mouth], '#000');
  const st = [];
  for (let i = 0; i < 14; i++) {
    const x0 = K.fx - 70 + i * 10 + (r() - .5) * 10, h = (60 + r() * 90) * k, sway = (r() - .5) * 40;
    st.push(WC.mkStroke(WC.spline([[x0, K.fy + 4], [x0 + sway * .3, K.fy - h * .4], [x0 + sway, K.fy - h]], 3), 6 + r() * 8, { kind: 'v', seed: r() * 99 }));
  }
  WC.drawStrokes(m, st);
}

export function drawWorkshop(m, c, t, o = {}) {
  const K = build();
  m.fillStyle = '#000'; m.fillRect(-2000, -2000, 6000, 6000);
  WC.drawStrokes(m, K.wall, { t });
  for (const b of K.beams) b.draw(m, t);
  for (const x of K.tools) x.draw(m, t);
  K.furnace.draw(m, t); fire(m, t, o.fire ?? 1);
  if (o.rays) o.rays(m, c);
  K.floor.draw(m, t);
  if (!o.noMould) { K.mould.draw(m, t); for (const b of K.bands) WC.drawStrokes(m, b, { t }); K.cup.draw(m, t); WC.fillPoly(m, [K.cupMouth], '#000'); }
}
export const MOULD = () => { const K = build(); return { x: K.mx, y: K.my, cup: [K.mx, K.my - 400] }; };

// crucible at (x,y) tilted by a (0 = upright), molten level visible. returns lip point
export function crucible(m, c, x, y, a, glow = 1, sc = 1.7) {
  const loc = [[-44, -40], [44, -40], [40, -10], [30, 40], [-30, 40], [-40, -10]];
  const tr = ([u, v]) => [x + u * sc * Math.cos(a) - v * sc * Math.sin(a), y + u * sc * Math.sin(a) + v * sc * Math.cos(a)];
  const P = WC.spline(loc.map(tr), 4, true);
  WC.drawStrokes(m, WC.cutAlong(WC.offsetPoly(P, 5), { closed: true, w: 8, kind: 'u', seg: [400, 900], gap: [0, 1], seed: 3 }));
  WC.fillPoly(m, [P], '#000');
  // two carved bands + a lit flank facing the glow (below-right)
  for (const v of [-18, 14]) WC.drawStrokes(m, WC.cutAlong([tr([-40, v]), tr([0, v + 4]), tr([38, v])], { w: 3, kind: 'k', seed: 7 + v }));
  WC.drawStrokes(m, WC.cutAlong([tr([36, -30]), tr([34, 0]), tr([26, 34])], { w: 5, kind: 'v', seed: 9 }));
  const mid = tr([0, -40]);
  const surf = WC.ellipse(mid[0], mid[1], 38 * sc, 7 * sc, 24, a);
  WC.fillPoly(m, [surf], '#fff'); WC.plate(c, [WC.ellipse(mid[0], mid[1], 40 * sc, 9 * sc, 24, a)], glow);
  return { lip: tr([44, -40]), mid };
}
// the molten stream from p0 (lip) to p1 (cup): white cut + copper plate + black flow lines
export function stream(m, c, p0, p1, t, w = 16, prog = 1) {
  const cx = lerp(p0[0], p1[0], .75) + 20, cy = p0[1] - 10;
  const pts = WC.spline([p0, [cx, cy + (p1[1] - p0[1]) * .15], [p1[0] + 4, lerp(p0[1], p1[1], .6)], p1], 3);
  const n = Math.max(2, Math.round(pts.length * clamp(prog)));
  const P = pts.slice(0, n);
  const s = WC.mkStroke(P, P.map((_, i) => w * (1 - .35 * i / pts.length)), { kind: 'u', seed: 3 });
  WC.drawStrokes(m, [{ ...s, w: s.w.map(v => v * 1.45 + 5), chip: .05 }], { color: '#000' });   // dark wood left around the stream
  WC.drawStrokes(m, [s]);
  c.fillStyle = '#000'; c.beginPath(); WC.strokePath(c, { ...s, w: s.w.map(v => v * 2.2), kind: 'u', chip: .05 }, 1); c.fill();
  // flow striations (left standing = black) wobbling at 12 fps
  const q = Math.floor(t * 12), r = mulberry(77 + q);
  const fl = [];
  for (let k = 0; k < 3; k++) { const i0 = Math.floor(r() * P.length * .6), i1 = Math.min(P.length - 1, i0 + 8 + Math.floor(r() * 14)); if (i1 - i0 > 3) fl.push(WC.mkStroke(P.slice(i0, i1).map(([x, y]) => [x + (r() - .5) * 3, y]), 1.6, { kind: 'k', seed: r() * 9 })); }
  WC.drawStrokes(m, fl, { color: '#000' });
  return P[P.length - 1];
}
// sparks: short radial stabs + copper
export function sparks(m, c, x, y, t, n = 40, R0 = 260, seed = 1) {
  const q = Math.floor(t * 12), r = mulberry(seed * 100 + q), st = [];
  for (let i = 0; i < n; i++) {
    const a = -PI * .9 + r() * PI * .8 - .2, d = 30 + r() * R0, L = 6 + r() * 16, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + d * d * .0015;
    st.push(WC.mkStroke([[px, py], [px + Math.cos(a) * L, py + Math.sin(a) * L]], 2.5 + r() * 2, { kind: 'stab', seed: r() * 99 }));
  }
  WC.drawStrokes(m, st);
  c.fillStyle = '#000'; c.beginPath(); for (const s of st) WC.strokePath(c, { ...s, w: s.w.map(v => v * 2) }, 1); c.fill();
}

// the mould as separate pieces (for smashing / falling away). phase t since break (s), <0 = intact
export function mouldBreak(m, t, { n = 6, seed = 5, spread = 1 } = {}) {
  const K = build(), r = mulberry(seed), x0 = K.mx - 240, x1 = K.mx + 240;
  for (let i = 0; i < n; i++) {
    const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n, cxp = (a + b) / 2;
    const d = Math.max(0, t - r() * .12), dir = cxp < K.mx ? -1 : 1;
    const dx = dir * (60 + r() * 90) * d * spread, dy = 700 * d * d, rot = dir * (.6 + r() * .8) * d;
    if (dy > 700) continue;
    m.save(); m.translate(cxp + dx, K.my - 200 + dy); m.rotate(rot); m.translate(-cxp, -(K.my - 200));
    m.beginPath(); m.rect(a, K.my - 460, b - a, 480); m.clip();
    K.mould.draw(m); for (const bb of K.bands) WC.drawStrokes(m, bb); if (i === Math.floor(n / 2) || i === Math.floor(n / 2) - 1) { K.cup.draw(m); WC.fillPoly(m, [K.cupMouth], '#000'); }
    m.restore();
  }
}
// steam: soft white curls rising (12 fps re-cut)
export function steam(m, x, y, t, k = 1) {
  const q = Math.floor(t * 12), r = mulberry(300 + q), st = [];
  for (let i = 0; i < 16 * k; i++) {
    const x0 = x + (r() - .5) * 360, h = 120 + r() * 260, ph = r() * 6;
    const pts = []; for (let j = 0; j < 10; j++) { const u = j / 9; pts.push([x0 + Math.sin(u * 5 + ph + t * 3) * 22 * u, y - u * h]); }
    st.push(WC.mkStroke(pts, pts.map((_, j) => 7 * Math.sin(Math.PI * (j + .5) / 10)), { kind: 'v', seed: r() * 99 }));
  }
  WC.drawStrokes(m, st);
}
