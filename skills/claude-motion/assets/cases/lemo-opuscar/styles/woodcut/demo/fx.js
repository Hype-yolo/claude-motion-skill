// The Bell Founder · props & effects: the bell, bellows, gifts, heap, villagers, door, sound rings
import * as WC from './engine/index.js';
import { clamp, lerp, mulberry } from '/core/lib.js';
import { part, drawPart, put, mul, T, R, S } from './rig.js';

const PI = Math.PI;
const cache = new Map();
const memo = (k, f) => cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k));

// ---------------------------------------------------------------- the bell (unit height 1, mouth at y = 0, crown at -1)
const HALF = [[0, -1], [.13, -1], [.18, -.975], [.24, -.92], [.28, -.8], [.3, -.6], [.32, -.42], [.37, -.22], [.45, -.08], [.53, -.015], [.55, .02]];
export function bellPoly(cx, cy, h) {
  const P = HALF.map(([x, y]) => [cx + x * h, cy + y * h]);
  const bot = []; for (let i = 1; i < 12; i++) { const u = i / 12; bot.push([cx + (.55 - 1.1 * u) * h, cy + (.02 + .05 * Math.sin(u * PI)) * h]); }
  return [...P, ...bot, ...HALF.slice().reverse().map(([x, y]) => [cx - x * h, cy + y * h])];
}
// o: { sp, light, crack (0..1), glow (plate alpha on highlight), key, halo }
export function bell(m, c, cx, cy, h, o = {}) {
  const sp = o.sp ?? Math.max(1.2, h / 55);
  const key = `bell${Math.round(cx)}_${Math.round(cy)}_${Math.round(h)}_${sp.toFixed(2)}_${o.lightSide || 'r'}`;
  const B = memo(key, () => {
    const poly = bellPoly(cx, cy, h), side = o.lightSide === 'l' ? -1 : 1;
    // Doré wrap: long cuts ringing the body; a broad lit band on the light side, a thin rim light on the shadow side
    const S1 = WC.shape([poly], { tone: () => (x, y) => { const u = (x - cx) / (h * .55) * side, v = (y - cy) / h;
        const key = Math.exp(-(((u - .38) / .42) ** 2)), rim = Math.exp(-(((u + .86) / .1) ** 2)) * .55; return clamp(.08 + .9 * key + rim + .08 * (1 + v)); },
      dir: WC.dirRing(cx, cy + h * 1.6, 3.2), sp: sp * 1.25, lo: .22, hi: .98, gamma: .9, halo: Math.max(2.5, h / 34), haloSeg: [h * .8, h * 2], seed: 5, seg: [sp * 14, sp * 50], gap: [0, sp * .8], jit: .04, res: Math.max(.5, h / 400) });
    const crown = WC.shape([WC.rect(cx - .07 * h, cy - 1.13 * h, .14 * h, .14 * h)], { tone: () => () => .4, dir: 0, sp: sp * .8, halo: Math.max(2, h / 70), seed: 6, res: Math.max(.5, h / 400) });
    const BW = { '-0.86': .25, '-0.2': .34, '-0.1': .39 }, bands = [-.86, -.2, -.1].map((v, i) => WC.cutAlong(WC.spline([[cx - BW[String(v)] * h, cy + v * h], [cx, cy + (v + .025) * h], [cx + BW[String(v)] * h, cy + v * h]], Math.max(1, h / 150)), { w: Math.max(1.4, h / 110), kind: 'k', seg: [h * 2, h * 3], seed: 20 + i }));
    const hl = [[cx + .22 * side * h, cy - .9 * h], [cx + .26 * side * h, cy - .6 * h], [cx + .3 * side * h, cy - .35 * h], [cx + .4 * side * h, cy - .12 * h]];
    const hi = WC.mkStroke(WC.spline(hl, Math.max(1, h / 120)), Math.max(2, h / 28), { kind: 'v', seed: 9 });
    // crack: jagged path from the lip upward
    const r = mulberry(13), cp = []; let x = cx - .2 * side * h, y = cy + .05 * h;
    for (let i = 0; i < 16; i++) { cp.push([x, y]); y -= h * .055; x += (r() - .45) * h * .06; }
    const crack = WC.mkStroke(WC.resample(cp, Math.max(1, h / 100)), Math.max(3, h / 28), { kind: 'v', seed: 3, chip: .45 });
    const branches = [4, 8, 11].map((i, j) => WC.mkStroke(WC.resample([cp[i], [cp[i][0] + (j % 2 ? 1 : -1) * h * .08, cp[i][1] - h * .07], [cp[i][0] + (j % 2 ? 1 : -1) * h * .12, cp[i][1] - h * .09]], Math.max(1, h / 100)), Math.max(2, h / 50), { kind: 'v', seed: 30 + j }));
    const rimP = HALF.slice(3).map(([x, y]) => [cx - side * (x * h - Math.max(2, h / 40)), cy + y * h]);
    const rimCut = WC.cutAlong(rimP, { w: Math.max(1.4, h / 90), kind: 'k', seg: [h * 2, h * 3], seed: 41 });
    return { poly, S1, crown, bands, hi, crack, branches, hlPoly: hl, rimCut };
  });
  if (o.clapper != null) clapper(m, cx, cy, h, o.clapper);
  B.crown.draw(m); B.S1.draw(m);
  for (const b of B.bands) WC.drawStrokes(m, b);
  WC.drawStrokes(m, B.rimCut);
  WC.drawStrokes(m, [B.hi]);
  if (o.glow > 0) { c.save(); c.lineCap = 'round'; c.strokeStyle = `rgba(0,0,0,${o.glow})`; c.lineWidth = h / 12; c.beginPath(); c.moveTo(...B.hlPoly[0]); for (const p of B.hlPoly.slice(1)) c.lineTo(...p); c.stroke(); c.restore(); }
  if (o.warm > 0) WC.plate(c, [B.poly], o.warm);
  if (o.crack > 0) {
    m.fillStyle = '#fff'; m.beginPath(); WC.strokePath(m, B.crack, o.crack); m.fill();
    B.branches.forEach((b, j) => { const p = clamp((o.crack - [.3, .55, .75][j]) / .2); if (p > 0) { m.beginPath(); WC.strokePath(m, b, p); m.fill(); } });
    // black gap inside the crack (it is a split, not a highlight)
    m.strokeStyle = '#000'; m.lineWidth = Math.max(1, h / 160);
  }
  return B;
}
function clapper(m, cx, cy, h, a) {
  const L = h * .9, px = cx, py = cy - .88 * h, ex = px + Math.sin(a) * L, ey = py + Math.cos(a) * L;
  m.strokeStyle = '#000'; m.lineWidth = h * .05; m.beginPath(); m.moveTo(px, py); m.lineTo(ex, ey); m.stroke();
  WC.fillPoly(m, [WC.ellipse(ex, ey, h * .07, h * .09, 16, -a)], '#000');
  WC.drawStrokes(m, WC.cutAlong(WC.ellipse(ex, ey, h * .075, h * .095, 16, -a).slice(2, 9), { w: Math.max(1.2, h / 90), kind: 'k', seed: 4 }));
}

// ---------------------------------------------------------------- bellows (leather, pleated), hinge at (x,y), open = 0..1
export function bellows(m, x, y, sc, open, t) {
  const a = lerp(.05, .42, open), L = 250 * sc;
  const top = [[x, y], [x + L, y - 20 * sc], [x + L + 10 * sc, y - 6 * sc]];
  const tipY = y + Math.sin(a) * 0;
  const upper = [[x - 30 * sc, y - 8 * sc], [x + L * Math.cos(-a), y + L * Math.sin(-a) - 30 * sc], [x + L * Math.cos(-a) + 8 * sc, y + L * Math.sin(-a) - 10 * sc], [x - 30 * sc, y + 6 * sc]];
  const lower = [[x - 30 * sc, y + 10 * sc], [x + L, y + 26 * sc], [x + L, y + 44 * sc], [x - 30 * sc, y + 30 * sc]];
  const nozzle = [[x - 30 * sc, y + 4 * sc], [x - 110 * sc, y + 12 * sc], [x - 110 * sc, y + 22 * sc], [x - 30 * sc, y + 26 * sc]];
  // leather between the boards: pleats
  const leather = [upper[1], upper[2], lower[1], lower[0], upper[3]];
  WC.fillPoly(m, [leather], '#000');
  const ls = []; for (let i = 1; i < 6; i++) { const u = i / 6; const p0 = [lerp(upper[3][0], upper[2][0], u), lerp(upper[3][1], upper[2][1], u)], p1 = [lerp(lower[0][0], lower[1][0], u), lerp(lower[0][1], lower[1][1], u)]; ls.push(WC.mkStroke(WC.resample([p0, [(p0[0] + p1[0]) / 2 + 10 * sc, (p0[1] + p1[1]) / 2], p1], 3), 3 * sc, { kind: 'v', seed: i })); }
  WC.drawStrokes(m, ls);
  for (const [P, k] of [[lower, 'lo'], [upper, 'up'], [nozzle, 'no']]) {
    WC.drawStrokes(m, WC.cutAlong(WC.offsetPoly(P, 2.5 * sc), { closed: true, w: 4 * sc, seg: [300, 900], seed: 3 }));
    WC.fillPoly(m, [P], '#000');
    WC.drawStrokes(m, WC.cutAlong([P[0], P[1]], { w: 3 * sc, kind: 'k', seed: 5 }));
  }
  return { handle: upper[1] };
}

// ---------------------------------------------------------------- gifts: metal things dropped into the crucible
export const GIFT = {
  pot: s => ({ body: [...Array.from({ length: 13 }, (_, i) => { const a = PI * i / 12; return [Math.cos(a) * 70 * s, Math.sin(a) * 48 * s]; })], rim: WC.ellipse(0, 0, 74 * s, 14 * s, 24), handle: [[60 * s, -4 * s], [150 * s, -18 * s], [150 * s, -6 * s], [62 * s, 8 * s]] }),
  candle: s => ({ body: [[-8 * s, -120 * s], [8 * s, -120 * s], [10 * s, 20 * s], [40 * s, 36 * s], [-40 * s, 36 * s], [-10 * s, 20 * s]], rim: WC.ellipse(0, -120 * s, 20 * s, 6 * s, 16) }),
  keys: s => ({ ring: [0, 0, 26 * s], keys: [0, 1, 2].map(i => ({ a: -1.2 + i * .9, L: (70 + i * 14) * s })) }),
  ring: s => ({ ring: [0, 0, 16 * s], stone: true }),
  spoon: s => ({ body: [...WC.ellipse(0, -52 * s, 22 * s, 32 * s, 16), [4 * s, -20 * s], [6 * s, 70 * s], [-6 * s, 70 * s], [-4 * s, -20 * s]] }),
  bracelet: s => ({ ring: [0, 0, 34 * s], thick: 8 * s }),
};
// a metal object: white metal with black edges and a few carved glints (drawn in its own local space)
export function drawGift(m, name, s = 1, t = 1e9) {
  const G = GIFT[name](s);
  const outline = P => { WC.fillPoly(m, [P], '#fff'); WC.drawStrokes(m, WC.cutAlong(P, { closed: true, w: 3.2 * Math.sqrt(s), kind: 'k', seed: 2, seg: [200, 600], gap: [0, 1] }), { color: '#000' }); };
  const ring = (cx, cy, r, w) => { m.strokeStyle = '#000'; m.lineWidth = w + 7 * Math.sqrt(s); m.beginPath(); m.arc(cx, cy, r, 0, PI * 2); m.stroke(); m.strokeStyle = '#fff'; m.lineWidth = w; m.beginPath(); m.arc(cx, cy, r, 0, PI * 2); m.stroke(); };
  if (name === 'pot') {
    outline(G.handle); outline(G.body); WC.fillPoly(m, [G.rim], '#000'); WC.fillPoly(m, [WC.ellipse(0, 1 * s, 62 * s, 9 * s, 24)], '#000');
    const sh = []; for (let i = 0; i < 6; i++) { const x = -54 * s + i * 16 * s; sh.push(WC.mkStroke(WC.resample([[x, 10 * s], [x + 6 * s, 30 * s + Math.sin(i) * 6 * s]], 2), 2.5 * s, { kind: 'k', seed: i })); }
    WC.drawStrokes(m, sh, { color: '#000' });
  } else if (name === 'candle') { outline(G.body); WC.fillPoly(m, [G.rim], '#fff'); WC.drawStrokes(m, WC.cutAlong(G.rim, { closed: true, w: 3, kind: 'k', seed: 4 }), { color: '#000' }); m.fillStyle = '#000'; m.fillRect(-2 * s, -110 * s, 4 * s, 110 * s); }
  else if (name === 'keys') {
    ring(0, 0, G.ring[2], 6 * s);
    for (const k of G.keys) { m.save(); m.rotate(k.a); const P = [[-5 * s, G.ring[2]], [5 * s, G.ring[2]], [5 * s, G.ring[2] + k.L], [16 * s, G.ring[2] + k.L], [16 * s, G.ring[2] + k.L + 10 * s], [5 * s, G.ring[2] + k.L + 10 * s], [5 * s, G.ring[2] + k.L + 18 * s], [-5 * s, G.ring[2] + k.L + 18 * s]]; outline(P); ring(0, G.ring[2] - 2 * s, 10 * s, 5 * s); m.restore(); }
  } else if (name === 'ring') { ring(0, 0, G.ring[2], 7 * s); WC.fillPoly(m, [WC.ellipse(0, -G.ring[2] - 6 * s, 9 * s, 8 * s, 12)], '#fff'); WC.drawStrokes(m, WC.cutAlong(WC.ellipse(0, -G.ring[2] - 6 * s, 9 * s, 8 * s, 12), { closed: true, w: 2.4, kind: 'k', seed: 1 }), { color: '#000' }); }
  else if (name === 'spoon') { outline(G.body); WC.fillPoly(m, [WC.ellipse(-4 * s, -56 * s, 10 * s, 18 * s, 12)], '#000'); }
  else if (name === 'bracelet') { ring(0, 0, G.ring[2], G.thick); for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; m.fillStyle = '#000'; m.fillRect(Math.cos(a) * G.ring[2] - 1.5 * s, Math.sin(a) * G.ring[2] - 4 * s, 3 * s, 8 * s); } }
}
// the heap of metal inside the crucible mouth: grows with every gift. (cx, cy, rx) in plate space
export function heap(m, cx, cy, rx, n) {
  const r = mulberry(21), items = [];
  for (let i = 0; i < n; i++) items.push([cx + (r() - .5) * rx * 1.4, cy - (r() * 40 + i * 1.5) * rx / 380, r() * PI * 2, (0.45 + r() * .35) * rx / 380, ['pot', 'spoon', 'keys', 'bracelet', 'candle', 'ring'][i % 6]]);
  WC.fillPoly(m, [WC.ellipse(cx, cy, rx, rx * .28, 32)], '#000');
  m.save(); m.beginPath(); m.rect(cx - rx - 20, cy - 400, rx * 2 + 40, 400 + rx * .22); m.clip();
  for (const [x, y, a, s, nm] of items) { m.save(); m.translate(x, y); m.rotate(a); drawGift(m, nm, s); m.restore(); }
  m.restore();
}
// the crucible seen from above-front (rim ellipse + body), heap inside
export function crucibleTop(m, cx, cy, rx, heapN = 0) {
  const body = [[cx - rx, cy], [cx - rx * .8, cy + rx * .9], [cx + rx * .8, cy + rx * .9], [cx + rx, cy]];
  const sh = WC.shape([body], { light: WC.light(.7, -.3, .3), R: rx * .4, sp: rx / 22, dir: WC.dirRing(cx, cy - rx * 2, 1), halo: 5, seed: 8, lo: .35 });
  sh.draw(m);
  if (heapN > 0) heap(m, cx, cy, rx * .92, heapN);
  WC.drawStrokes(m, WC.cutAlong(WC.ellipse(cx, cy, rx, rx * .28, 40), { closed: true, w: rx / 24, kind: 'u', seed: 3, seg: [300, 700], gap: [0, 1] }));
}

// ---------------------------------------------------------------- villagers in the snow (simple carved silhouettes)
const VIL = [
  { body: [[-8, -150], [22, -148], [40, -110], [50, -40], [56, 0], [-54, 0], [-48, -50], [-36, -116]], head: [6, -168, 20, 22], hat: 'shawl' },
  { body: [[-10, -168], [26, -166], [46, -126], [52, -60], [48, 0], [-46, 0], [-50, -70], [-40, -130]], head: [8, -188, 19, 21], hat: 'cap' },
  { body: [[-8, -118], [18, -116], [32, -86], [36, -30], [36, 0], [-34, 0], [-36, -40], [-26, -90]], head: [4, -134, 16, 17] },
  { body: [[-12, -170], [30, -168], [56, -128], [62, -60], [58, 0], [-56, 0], [-62, -70], [-50, -132]], head: [10, -192, 21, 23], hat: 'brim' },
];
export function villager(m, x, y, s, kind = 0, bow = 0, flip = 1) {
  const V = VIL[kind % 4];
  const P = part('vilb' + kind, { poly: WC.spline(V.body, 5, true), light: WC.light(.3, -.9, .25), R: 20, sp: 5, lo: .4, halo: 5, seed: kind + 3, dir: Math.PI / 2 });
  const [hx, hy, rx, ry] = V.head, hx2 = hx + bow * 12, hy2 = hy + bow * 14;
  const Hd = part('vilh' + kind + bow.toFixed(1), { poly: WC.ellipse(hx2, hy2, rx, ry, 20, bow * .4), light: WC.light(.3, -.9, .3), R: 10, sp: 4, lo: .5, halo: 5, seed: kind + 9 });
  put(m, mul(T(x, y), S(s * flip, s)), () => {
    drawPart(m, P); drawPart(m, Hd);
    if (V.hat === 'cap') drawPart(m, part('vilcap' + bow.toFixed(1), { poly: WC.ellipse(hx2, hy2 - ry * .7, rx * 1.05, ry * .55, 16, bow * .4), sp: 3, R: 8, halo: 4, seed: 4 }));
    if (V.hat === 'brim') drawPart(m, part('vilbrim' + bow.toFixed(1), { poly: [[hx2 - rx * 1.6, hy2 - ry * .5], [hx2 + rx * 1.6, hy2 - ry * .5 + bow * 6], [hx2 + rx * .9, hy2 - ry * 1.4], [hx2 - rx * .9, hy2 - ry * 1.4]], sp: 3, R: 6, halo: 4, seed: 5 }));
  });
}

// ---------------------------------------------------------------- sound: carved concentric rings expanding
export function rings(m, cx, cy, t, { n = 4, speed = 420, gap = .45, w = 5, max = 2400, flat = .55 } = {}) {
  const st = [];
  for (let i = 0; i < n; i++) {
    const tt = t - i * gap; if (tt <= 0) continue;
    const r = tt * speed; if (r > max) continue;
    const a = clamp(1 - r / max);
    const pts = []; for (let k = 0; k <= 80; k++) { const th = PI + k / 80 * PI; pts.push([cx + Math.cos(th) * r, cy + Math.sin(th) * r * flat]); }
    st.push(...WC.cutAlong(pts, { w: w * (.4 + .6 * a), kind: 'v', seg: [60, 180], gap: [6, 30], seed: i * 7 + 1 }));
  }
  WC.drawStrokes(m, st);
}
