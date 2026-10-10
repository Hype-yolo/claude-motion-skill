// The Bell Founder · exterior world: the snowbound valley, village and bell tower (plate coordinates 1848×912)
import * as WC from './engine/index.js';
import { mulberry, clamp } from '/core/lib.js';

export const PW = 1848, PH = 912;
export const HOR = 560;                 // horizon line (the first cut)
export const TOWER = { x: 1180, base: 700, top: 150, w: 118 };   // bell tower
export const BELFRY = { x: 1180, y: 300, w: 64, h: 92 };          // arched opening (bell hangs here)

const L_MOON = WC.light(-.55, -.6, .58);     // cold light from upper left
const KS = {};
let CARVE = false;
const rv = (t0, t1, key, speed = 1100) => CARVE ? { t0, t1, key, speed, jit: .12 } : undefined;
const W_ = o => CARVE ? { ...o, white: false, reveal: o.reveal } : o;   // white areas are cleared by wide cuts on the block

function mountainPoly(x0, x1, base, peaks, seed) {
  const r = mulberry(seed), P = [[x0, base]];
  for (const [px, py] of peaks) P.push([px + (r() - .5) * 20, py]);
  P.push([x1, base]);
  return WC.resample(P, 20).map(([x, y], i, A) => (i === 0 || i === A.length - 1) ? [x, y] : [x, y + (r() - .5) * 10]);
}
// facet shading for a mountain range: every peak has a spine; left of it is lit, right is in shadow
function spineX(p, y, base) { const u = clamp((y - p[1]) / (base - p[1])); return p[0] + 40 * u * u; }
function whichPeak(pk, x, y, base) { let best = null, bd = 1e9; for (const p of pk) { if (y < p[1] - 5) continue; const d = Math.abs(x - spineX(p, y, base)) - (base - p[1]) * .15; if (d < bd) { bd = d; best = p; } } return best; }
function facetTone(pk, base, lit, dark) {
  return (x, y) => { const p = whichPeak(pk, x, y, base); if (!p) return dark; const sx = spineX(p, y, base), u = clamp((y - p[1]) / (base - p[1]));
    if (x < sx) return clamp(lit - .55 * u * u + .08 * Math.sin(x * .05 + y * .03) - .5 * clamp(1 - (sx - x) / 10) * 0);
    return clamp(dark + .5 * Math.max(0, Math.sin((x - sx) * .045 + y * .02) - .75) * (1 - u)); };
}
function facetDir(pk, base) {
  return (x, y) => { const p = whichPeak(pk, x, y, base); if (!p) return 0; const sx = spineX(p, y, base); return x < sx ? Math.PI - .62 : .55; };
}
function peak(px, py, hw, base, lit, dark, sp, seed, reveal) {
  const r = mulberry(seed), L = [[px, py]], R = [[px, py]];
  // jagged flanks: a shoulder or two on each side
  const nl = 6; for (let k = 1; k <= nl; k++) { const u = k / nl; L.push([px - hw * u + (r() - .5) * 26, py + (base - py) * Math.pow(u, 1.25) + (r() - .5) * 18]); R.push([px + hw * u * 1.1 + (r() - .5) * 26, py + (base - py) * Math.pow(u, 1.15) + (r() - .5) * 18]); }
  const poly = [...L.reverse(), ...R.slice(1), [px + hw * 1.1, base + 60], [px - hw, base + 60]];
  const spine = y => px + 30 * clamp((y - py) / (base - py)) ** 2 + 8 * Math.sin(y * .05);
  const tone = () => (x, y) => { const u = clamp((y - py) / (base - py)), sx = spine(y);
    if (x < sx) return clamp(lit - .6 * u * u + .12 * Math.sin(x * .04 - y * .06) * u);
    return clamp(dark + .6 * Math.max(0, Math.sin((x - sx) * .05 + y * .025) - .8) * (1 - u)); };
  const dir = (x, y) => x < spine(y) ? Math.PI - .7 + .15 * Math.sin(y * .01) : .62;
  return WC.shape([poly], { tone, dir, sp, lo: .3, hi: .95, halo: 4, seed, seg: [24, 100], jit: .06, res: 3, reveal, kind: CARVE && sp > 8 ? 'u' : 'v' });
}
function house(x, base, w, h, roofH, flip, seed) {
  const r = mulberry(seed);
  const wall = [[x, base], [x, base - h], [x + w, base - h], [x + w, base]];
  const ov = 14;
  const roof = [[x - ov, base - h + 4], [x + w * (flip ? .38 : .62), base - h - roofH], [x + w + ov, base - h + 4], [x + w + ov, base - h + 18], [x - ov, base - h + 18]];
  const wins = [];
  const nw = w > 110 ? 2 : 1;
  for (let i = 0; i < nw; i++) { const wx = x + w * (nw === 1 ? .5 : (.3 + .4 * i)) - 11, wy = base - h * .62; if (r() < .8) wins.push(WC.rect(wx, wy, 22, 28)); }
  const chim = r() < .6 ? WC.rect(x + w * (flip ? .7 : .2), base - h - roofH * .75, 16, roofH * .55) : null;
  return { wall, roof, wins, chim, x, w, base, h, roofH, flip };
}

export function buildWorld(mode = 'print') {
  if (KS[mode]) return KS[mode];
  CARVE = mode === 'carve';
  const K = KS[mode] = {};
  const dH = (x, y) => clamp(Math.hypot(x - PW * .5, (y - HOR) * 1.6) / 1100);
  // ---- sky: horizontal cuts, denser + wider towards the horizon glow ----
  const sky = new WC.Region([WC.rect(-400, -600, PW + 800, HOR + 640)], { res: 4 });
  K.sky = WC.hatch(sky, { reveal: rv(5.0, 6.1, (x, y) => clamp((HOR - y) / (HOR + 200)), 1600), dir: (x, y) => .012 * Math.sin(x * .002), tone: (x, y) => clamp(.08 + .78 * Math.pow(clamp((y + 100) / (HOR + 100)), 2.4)), sp: 12, lo: .22, hi: 1, gamma: 1.2, seed: 21, seg: [90, 340], gap: [4, 30], jit: .05, kind: 'v' });
  // ---- mountain ranges: every peak is its own carved block (lit left flank, shadow right flank), back to front ----
  K.far = [[-60, 300, 360], [300, 250, 330], [700, 180, 380], [1000, 300, 300], [1380, 140, 400], [1720, 230, 360], [2000, 330, 300]].map(([px, py, hw], i) => peak(px, py, hw, HOR + 30, .95, .1, 7, 300 + i, rv(3.0, 4.2, dH, 900)));
  K.near = [[80, 440, 300], [520, 470, 260], [860, 450, 300], [1560, 430, 320], [1900, 470, 280]].map(([px, py, hw], i) => peak(px, py, hw, HOR + 90, .75, .03, 9, 400 + i, rv(3.3, 4.5, dH, 900)));
  // ---- snowfield: cleared white, with black drift lines; a dark drift bank in the foreground ----
  const fieldP = [[-400, HOR + 10], ...WC.resample([[-400, HOR + 10], [PW + 400, HOR + 10]], 40).map(([x, y], i) => [x, y + Math.sin(x * .004) * 6]), [PW + 400, HOR + 10], [PW + 400, PH + 400], [-400, PH + 400]];
  K.field = WC.shape([fieldP], W_({ reveal: rv(3.0, 4.8, (x, y) => clamp((y - HOR) / 330) * .7 + .3 * clamp(Math.abs(x - PW / 2) / 1200), 1400), kind: CARVE ? 'u' : 'v', white: true, tone: reg => (x, y) => { const d = (y - HOR) / 360; return clamp(.99 - .9 * clamp(d) ** 1.1 * (.55 + .45 * Math.sin(x * .005 + y * .03 + Math.sin(x * .011) * 2)) - .3 * Math.exp(-((y - HOR - 14) ** 2) / 160)); }, dir: (x, y) => .05 * Math.sin(x * .004 + y * .01), sp: 12, lo: .38, hi: 1, gamma: 1.1, seed: 8, seg: [30, 160], gap: [14, 70], res: 4 }));
  if (CARVE) K.field = WC.shape([fieldP], { reveal: rv(3.0, 4.8, (x, y) => clamp((y - HOR) / 330) * .7 + .3 * clamp(Math.abs(x - PW / 2) / 1200), 1400), kind: 'u', tone: () => (x, y) => .97 - .45 * clamp((y - HOR) / 360), dir: (x, y) => .05 * Math.sin(x * .004 + y * .01), sp: 11, wmax: 13, lo: .2, seed: 8, seg: [60, 220], gap: [2, 10], res: 4 });
  const bank = [[-400, PH + 400], [-400, 800], ...WC.spline([[-300, 790], [200, 830], [620, 868], [1000, 880], [1400, 856], [1800, 812], [2200, 790]], 12), [PW + 400, 790], [PW + 400, PH + 400]];
  K.bank = WC.shape([bank], { reveal: rv(4.6, 5.6, (x, y) => clamp(Math.abs(x - PW / 2) / 1100)), tone: reg => (x, y) => clamp(.8 - (y - 800) / 140), dir: (x, y) => .08 * Math.sin(x * .003), sp: 10, lo: .3, hi: 1, halo: 0, seed: 12, seg: [40, 180], res: 4 });
  // footprints: two trudging tracks from the foreground to the village
  const rf = mulberry(17); K.steps = [];
  for (let i = 0; i < 26; i++) { const u = i / 25, x = 760 + 180 * Math.sin(u * 2.2) * (1 - u) + (i % 2 ? 9 : -9) * (1 - u * .7), y = 880 - u * 260, r = 7 * (1 - u * .7); K.steps.push(WC.mkStroke(WC.resample([[x - r, y], [x + r, y + .5]], 2), r * 1.1, { kind: 'u', seed: rf() * 99 })); }
  // ---- houses ----
  const r = mulberry(33), H = [];
  const spots = [[160, 610, 150, 90, 70], [330, 596, 120, 76, 60], [470, 618, 170, 96, 78], [700, 606, 130, 80, 62], [860, 628, 190, 104, 86], [1330, 612, 150, 88, 68], [1500, 598, 120, 72, 58], [1640, 622, 170, 98, 76], [1010, 640, 120, 78, 60]];
  for (const [x, b, w, h, rh] of spots) H.push(house(x, b, w, h, rh, r() < .5, (r() * 1000) | 0));
  K.houses = H.map((h, i) => ({
    h,
    wall: WC.shape([h.wall], { reveal: rv(4.0 + i * .08, 4.5 + i * .08, (x, y) => clamp((h.base - y) / 120)), light: L_MOON, R: 20, amb: 0, k: .9, sp: 7, lo: .55, hi: 1, dir: 0, halo: 4, seed: 40 + i, seg: [20, 70], res: 2 }),
    roof: WC.shape([h.roof], W_({ reveal: rv(4.1 + i * .08, 4.7 + i * .08, (x, y) => clamp((y - h.base + h.h + h.roofH) / 120)), kind: CARVE ? 'u' : 'v', white: true, light: L_MOON, tone: reg => (x, y) => clamp(.96 - .6 * clamp((y - (h.base - h.h - h.roofH)) / (h.roofH + 18)) ** 2 - (h.flip ? (x < h.x + h.w * .38 ? .0 : .25) : (x > h.x + h.w * .62 ? .25 : 0))), dir: h.flip ? -.9 : .9, sp: 6, lo: .5, hi: 1, seed: 60 + i, seg: [14, 40], res: 2, ...(CARVE ? { tone: () => () => 1, sp: 6, wmax: 7.5 } : {}) })),
    eave: WC.cutAlong([[h.roof[0][0], h.roof[0][1] + 12], [h.roof[2][0], h.roof[2][1] + 12]], { w: 5, kind: 'k', seg: [200, 400], seed: 80 + i }),
    chim: h.chim ? WC.shape([h.chim], { reveal: rv(4.4 + i * .08, 4.6 + i * .08, () => .5), light: L_MOON, R: 8, sp: 5, lo: .6, dir: Math.PI / 2, halo: 3, seed: 90 + i }) : null,
  }));
  // ---- bell tower ----
  const T = TOWER, tx = T.x, hw = T.w / 2;
  const body = [[tx - hw, T.base], [tx - hw + 4, T.top + 150], [tx + hw - 4, T.top + 150], [tx + hw, T.base]];
  const belfryBox = [[tx - hw - 8, T.top + 160], [tx - hw - 8, T.top + 40], [tx + hw + 8, T.top + 40], [tx + hw + 8, T.top + 160]];
  const spire = [[tx - hw - 22, T.top + 44], [tx, T.top - 150], [tx + hw + 22, T.top + 44]];
  K.tower = {
    body: WC.shape([body], { reveal: rv(4.3, 5.2, (x, y) => clamp((T.base - y) / 560)), light: L_MOON, R: 30, amb: 0, k: 1, sp: 7, lo: .42, hi: 1, dir: 0, halo: 5, seed: 101, seg: [18, 46], gap: [3, 8], res: 2 }),
    belfry: WC.shape([belfryBox], { reveal: rv(4.9, 5.3, (x, y) => .5), light: L_MOON, R: 26, amb: 0, k: 1, sp: 6, lo: .42, dir: Math.PI / 2, halo: 5, seed: 102, res: 2 }),
    spire: WC.shape([spire], W_({ reveal: rv(5.1, 5.6, (x, y) => clamp((T.top + 44 - y) / 200)), white: true, tone: reg => (x, y) => x < tx ? clamp(.95 - .3 * ((y - T.top + 150) / 200)) : .25, dir: (x, y) => x < tx ? -1.18 : 1.18, sp: 6, lo: .3, hi: 1, seed: 103, seg: [20, 60], res: 2 })),
    spireOutline: WC.cutAlong(spire.slice(0, 3), { w: 3, kind: 'k', seed: 104 }),
    arch: archPoly(BELFRY.x, BELFRY.y, BELFRY.w, BELFRY.h),
    finial: WC.ellipse(tx, T.top - 160, 9, 9, 16),
  };
  // ---- pines (foreground framing) ----
  K.pines = [pine(60, 900, 380, 1), pine(210, 930, 300, 2), pine(1760, 910, 420, 3), pine(1620, 950, 260, 4)];
  if (CARVE) { let i = 0; for (const P of K.pines) for (const s of P.caps) { s.t0 = 5.4 + (i++ % 12) * .04; s.dur = .12; } K.steps.forEach((s, i) => { s.t0 = 4.8 + i * .02; s.dur = .06; }); }
  // ---- snowfall layers (world-anchored seeds; animated in draw) ----
  const rs = mulberry(71); K.snow = []; CARVE = false;
  for (let i = 0; i < 900; i++) K.snow.push({ x: rs() * (PW + 400) - 200, y: rs() * (PH + 400) - 200, z: rs() < .6 ? 0 : rs() < .7 ? 1 : 2, ph: rs() * 6.28, s: rs() });
  return K;
}
function archPoly(cx, cy, w, h) {
  const P = [[cx - w / 2, cy + h / 2]];
  for (let i = 0; i <= 16; i++) { const a = Math.PI + i / 16 * Math.PI; P.push([cx + Math.cos(a) * w / 2, cy - h / 2 + w / 2 + Math.sin(a) * w / 2]); }
  P.push([cx + w / 2, cy + h / 2]);
  return P;
}
function pine(x, base, h, seed) {
  const r = mulberry(seed), tiers = 6, polys = [], caps = [];
  for (let i = 0; i < tiers; i++) {
    const u = i / tiers, y0 = base - h * (u * .82), top = base - h * (u * .82 + .3), wd = h * .3 * (1 - u * .75);
    const P = [[x, top]];
    const nT = 7;
    for (let k = 0; k <= nT; k++) { const f = k / nT; P.push([x + wd * f + (k % 2 ? -4 : 3), top + (y0 - top) * (.5 + .5 * f) + (k % 2 ? -10 : 5)]); }
    for (let k = nT; k >= 0; k--) { const f = k / nT; P.push([x - wd * f + (k % 2 ? 4 : -3), top + (y0 - top) * (.5 + .5 * f) + (k % 2 ? -10 : 5)]); }
    polys.push(P);
    // snow lying on the upper edge of each tier: thick U-cuts following the tier edge
    for (const sd of [-1, 1]) {
      const pts = []; for (let k = 0; k <= 8; k++) { const f = .08 + .84 * k / 8; pts.push([x + sd * wd * f, top + (y0 - top) * (.5 + .5 * f) - 3 + (k % 2 ? -5 : 2)]); }
      caps.push(WC.mkStroke(pts, pts.map((_, k) => (sd < 0 ? 11 : 6) * (1 - k / 10)), { kind: 'u', seed: r() * 99 }));
    }
  }
  const trunk = WC.rect(x - 8, base - 24, 16, 44);
  const tree = WC.shape([...polys, trunk], { reveal: rv(4.6, 5.5, (xx, yy) => clamp((base - yy) / h)), tone: () => (xx, yy) => (xx < x ? .62 : .3) + .15 * Math.sin(yy * .09), dir: (xx, yy) => (xx < x ? 2.55 : .6), sp: 8, lo: .38, hi: 1, halo: 5, seed: 200 + seed, seg: [10, 30], gap: [2, 6], res: 2, fill: true });
  return { tree, caps };
}
// snow positions at time t (falling since `t0`; frozen at `freeze`)
export function snowAt(K, t, { t0 = 0, freeze = 1e9, wind = 1, fall = 1 } = {}) {
  const tt = Math.min(t, freeze) - t0, q = Math.floor(tt * 12) / 12;   // flakes step at 12 fps (like re-printed)
  const out = [];
  for (const f of K.snow) {
    const sp = [26, 44, 70][f.z] * fall, dx = [10, 18, 30][f.z] * wind;
    let y = f.y + q * sp, x = f.x + q * dx + Math.sin(q * 1.3 + f.ph) * 6;
    y = ((y + 200) % (PH + 400) + (PH + 400)) % (PH + 400) - 200; x = ((x + 200) % (PW + 400) + (PW + 400)) % (PW + 400) - 200;
    out.push([x, y, [3, 5, 8][f.z] * (.8 + .4 * f.s), f]);
  }
  return out;
}

// draw the valley on mask m (already transformed into plate space). opts: {t, noTower, bell, snow}
export function drawValley(m, c, t, o = {}) {
  const K = buildWorld(o.mode || 'print');
  m.fillStyle = '#000'; m.fillRect(-2000, -2000, PW + 4000, PH + 4000);
  WC.drawStrokes(m, K.sky, { t: o.skyT ?? t });
  for (const p of K.far) p.draw(m, o.farT ?? t);
  for (const p of K.near) p.draw(m, o.nearT ?? t);
  K.field.draw(m, o.fieldT ?? t);
  WC.drawStrokes(m, K.steps, { t: o.fieldT ?? t, color: '#000' });
  // tower behind the front houses
  const T = K.tower, tt = o.towerT ?? t;
  T.body.draw(m, tt); T.belfry.draw(m, tt);
  // belfry arch opening: black void, carved rim
  WC.fillPoly(m, [T.arch], '#000');
  if (tt > 5.25) WC.drawStrokes(m, K.archRim || (K.archRim = WC.cutAlong(WC.offsetPoly(T.arch, 4), { closed: true, w: 4, kind: 'k', seed: 5 })), { t: tt });
  if (o.bell) o.bell(m, c);
  T.spire.draw(m, tt); WC.drawStrokes(m, T.spireOutline, { t: tt, color: '#000' });
  if (tt > 5.5) WC.fillPoly(m, [T.finial], '#fff');
  for (const H of K.houses) {
    const ht = o.houseT ?? t;
    H.wall.draw(m, ht);
    if (ht > 5.0) for (const w of H.h.wins) { WC.fillPoly(m, [w], '#fff'); m.fillStyle = '#000'; m.fillRect(w[0][0] + 9.5, w[0][1], 3, 28); m.fillRect(w[0][0], w[0][1] + 11, 22, 3); }
    if (H.chim) H.chim.draw(m, ht);
    H.roof.draw(m, ht); WC.drawStrokes(m, H.eave, { t: ht, color: '#000' });
  }
  if (o.figures) o.figures(m, c);
  K.bank.draw(m, o.fieldT ?? t);
  for (const P of K.pines) { P.tree.draw(m, o.pineT ?? t); WC.drawStrokes(m, P.caps, { t: o.pineT ?? t }); }
}
