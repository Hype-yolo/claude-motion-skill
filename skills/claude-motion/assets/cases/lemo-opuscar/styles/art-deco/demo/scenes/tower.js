// TOWER — the Starlight Hotel seen from outside in true 3-point perspective: setback facade with gold piers, lit windows,
// stepped entrance arch + revolving door + facade clock, and the bulb sign on the crown. Used for the street crane-down
// (camera at the kerb, tilting from the dark sign down to Pip) and the finale pull-back (camera flies back from the sign).
import * as D from '../engine/deco.js';
import * as T from '../engine/type.js';
import * as B from '../engine/bulbs.js';
import { makeCam, cardTransform } from '../engine/cam.js';
import { sky } from './roof.js';
const { C } = D;

export const Z0 = 34;                        // front facade plane
export const TIERS = [[0, 72, 17], [72, 88, 12], [88, 100, 8.5], [100, 103, 6], [103, 106, 4]];   // [y0, y1, halfWidth]
export const SIGN_Y = 106.4, SIGN_H = 3.9;   // sign glyph box base & height (metres)
let signCache = null;
export function towerSign() { return signCache || (signCache = B.buildSign('THE STARLIGHT', { font: 'Poiret', size: 240, spacing: 17, track: .16 })); }
export function signGeom() { const S = towerSign(), k = SIGN_H / S.size, L = S.w * k; return { S, k, L, x0: -L / 2, zS: Z0 + 4, y0: SIGN_Y }; }

const R0 = D.mulberry(77); const WIN = Array.from({ length: 4000 }, () => R0());

// o: { cam: {...}, t, lit(li,bi,gi), dark (0..1 window dimming), fireworks: [{x,y,z,t0,col}], pip: fn(g, cam, sg) }
export function drawTower(g, o = {}) {
  const t = o.t || 0, cam = makeCam({ f: 1000, ...(o.cam || {}) }), P = cam.P;
  sky(g, t, { moon: o.moon ?? true, moonX: 1540, moonY: 170, moonR: 60, beams: o.beams });
  const q = p => P(...p).slice(0, 2);
  const poly = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = q(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fillStyle = fill; g.fill(); };
  const ln = (a, b, opt) => { const A = P(...a), Bq = P(...b); if (A[2] < .2 || Bq[2] < .2) return; D.gline(g, [A.slice(0, 2), Bq.slice(0, 2)], opt); };
  // distant skyline behind (other towers)
  const Rk = D.mulberry(12);
  for (let i = 0; i < 14; i++) {
    const x = -140 + i * 22 + Rk() * 8, w = 10 + Rk() * 10, h = 25 + Rk() * 55, z = 140 + Rk() * 60;
    if (Math.abs(x) < 26) continue;
    poly([[x, 0, z], [x + w, 0, z], [x + w, h, z], [x + w * .7, h, z], [x + w * .7, h + 4, z], [x + w * .3, h + 4, z], [x + w * .3, h, z], [x, h, z]], '#0a0c0e');
  }
  // ground: street + city lights + kerb + deco lamp posts
  {
    const hz = P(0, 0, 5000)[1];
    if (hz < 1080) {
      const sg2 = g.createLinearGradient(0, Math.max(0, hz), 0, 1080); sg2.addColorStop(0, '#0d0f10'); sg2.addColorStop(1, '#050403');
      g.fillStyle = sg2; g.fillRect(0, Math.max(0, hz), 1920, 1080 - Math.max(0, hz));
      const Rc = D.mulberry(31);
      for (let i = 0; i < 700; i++) {
        const x = (Rc() - .5) * 700, z = Z0 + 20 + Rc() * 700, zz = Rc() < .5 ? z : -z * .6 - 40;
        if (Math.abs(x) < 22 && zz > 0 && zz < Z0 + 14) continue;
        const p = P(x, 0, zz); if (p[2] < 5 || p[1] < hz) continue;
        const r = Math.max(.6, 900 / p[2]); g.fillStyle = `rgba(255,${190 + (Rc() * 50 | 0)},110,${.25 + Rc() * .5})`; g.fillRect(p[0], p[1], r, r * .6);
      }
    }
  }
  // side faces (a sliver of the returns, darker) + front faces per tier
  for (const [y0, y1, hw] of TIERS) {
    const depth = 12;
    for (const sx of [-1, 1]) {
      const pts = [[sx * hw, y0, Z0], [sx * hw, y1, Z0], [sx * hw, y1, Z0 + depth], [sx * hw, y0, Z0 + depth]];
      const A = P(...pts[0]), Bq = P(...pts[2]);
      if ((sx < 0 && Bq[0] < A[0]) || (sx > 0 && Bq[0] > A[0])) poly(pts, '#07060a');
    }
    const top = q([0, y1, Z0]), bot = q([0, y0, Z0]);
    const gr = g.createLinearGradient(0, bot[1], 0, top[1]); gr.addColorStop(0, '#2a1f10'); gr.addColorStop(.25, '#15110b'); gr.addColorStop(1, '#0b0908');
    poly([[-hw, y0, Z0], [hw, y0, Z0], [hw, y1, Z0], [-hw, y1, Z0]], gr);
    // setback terrace edge
    ln([-hw, y1, Z0], [hw, y1, Z0], { w: 2 });
  }
  // windows (lit at random, dimmed by o.dark), piers
  const dark = o.dark ?? 0;
  for (const [y0, y1, hw] of TIERS.slice(0, 3)) {
    const cols = Math.floor(hw * 2 / 2.8);
    for (let fy = Math.max(y0, 12); fy < y1 - 1; fy += 3.2) {
      for (let c = 0; c < cols; c++) {
        const x = -hw + 1.4 + c * 2.8, idx = (Math.floor(fy) * 31 + c * 7) % 4000, r = WIN[idx];
        const a = q([x - .55, fy + 2.2, Z0]), b = q([x + .55, fy + .4, Z0]);
        const w = b[0] - a[0], h = b[1] - a[1]; if (Math.abs(w) < .5) continue;
        const on = r < .62, lv = on ? (.35 + r * .6) * (1 - dark) : 0;
        g.fillStyle = on ? `rgba(255,${180 + (r * 80 | 0)},${100 + (r * 40 | 0)},${lv})` : 'rgba(30,24,18,.8)'; g.fillRect(a[0], a[1], w, h);
      }
    }
    for (let x = -hw; x <= hw + .01; x += 2.8) ln([x, y0, Z0], [x, y1, Z0], { w: Math.abs(x) < .1 ? 2.4 : 1.2, alpha: .85 });
  }
  // crown: stepped fan/sunburst crest on the top tiers
  {
    const c = P(0, 100, Z0), s = cam.scaleAt(0, 100, Z0);
    if (c[2] > 1) D.sunburst(g, c[0], c[1], { rays: 22, r0: s * 2, r1: s * 8.4, a0: Math.PI, a1: D.TAU, mode: 'lines', w: 1.6, alpha: .8 });
  }
  // entrance: stepped arch, revolving door, canopy, clock
  {
    const b = P(0, 0, Z0), s = cam.scaleAt(0, 0, Z0);
    if (b[2] > 1) {
      D.glow(g, b[0], b[1] - s * 3, s * 12, '#ffc36a', .35, .8);
      D.archFrame(g, b[0], b[1], 9 * s, 11.5 * s, { rings: 3, gap: .3 * s, steps: 3, crown: 'round', fill: '#1a120a', lw: Math.max(1, s * .08) });
      // revolving door glass + wings
      const dw = 4.2 * s, dh = 3.4 * s;
      g.fillStyle = 'rgba(255,205,130,.55)'; g.fillRect(b[0] - dw / 2, b[1] - dh, dw, dh);
      D.gline(g, D.rectPts(b[0] - dw / 2, b[1] - dh, dw, dh), { w: Math.max(1, s * .06) });
      for (let k = -1; k <= 1; k++) { const x = b[0] + k * dw * .33 * Math.cos(t * 2); D.gline(g, [[x, b[1] - dh], [x, b[1]]], { w: Math.max(1, s * .05) }); }
      // canopy
      const cy0 = b[1] - 4.6 * s; g.fillStyle = '#0a0806'; g.beginPath(); g.moveTo(b[0] - 6 * s, cy0); g.lineTo(b[0] + 6 * s, cy0); g.lineTo(b[0] + 5 * s, cy0 + .7 * s); g.lineTo(b[0] - 5 * s, cy0 + .7 * s); g.closePath(); g.fill();
      D.gline(g, [[b[0] - 6 * s, cy0], [b[0] + 6 * s, cy0]], { w: Math.max(1, s * .08) });
      T.goldText(g, 'THE STARLIGHT', b[0], cy0 + .55 * s, { size: .5 * s, font: 'Poiret', track: .12 * s, shadow: false });
      // facade clock
      const ck = P(0, 13, Z0); T.clockFace(g, ck[0], ck[1], 1.4 * s, o.clock || { h: 11, m: 55, s: 0 });
    }
  }
  // the sign on the crown (letters as perspective cards) + catwalk
  const sg = signGeom(), { S, k, L, x0, zS, y0 } = sg;
  const at = (u, y) => [x0 + u, y0 + y, zS];
  ln(at(-1, SIGN_H * 1.15), at(L + 1, SIGN_H * 1.15), { w: 1.2, alpha: .7 });
  for (let u = -1; u <= L + 1; u += L / 12) ln(at(u, -1.4), at(u, SIGN_H * 1.15), { w: 1.1, alpha: .6 });
  const lit = o.lit || (() => 0);
  S.letters.forEach((le, li) => {
    const A = P(...at(le.x * k, SIGN_H)); if (A[2] < .5) return;
    g.save(); cardTransform(g, cam, at(le.x * k, S.h * k), at((le.x + le.w) * k, S.h * k), at(le.x * k, 0), le.w, S.h);
    g.translate(-le.x, 0); B.drawSign(g, S, 0, 0, 1, { lit, only: li, haloK: 1.2 }); g.restore();
  });
  ln(at(-1, -.1), at(L + 1, -.1), { w: 2 });
  if (o.pip) o.pip(g, cam, sg);
  ln(at(-1, 1.0), at(L + 1, 1.0), { w: 1.6 });
  // fireworks: gold sunbursts in the sky (drawn in world space)
  for (const fw of (o.fireworks || [])) {
    const age = t - fw.t0; if (age < 0 || age > 1.8) continue;
    const c = P(fw.x, fw.y, fw.z), s = cam.scaleAt(fw.x, fw.y, fw.z); if (c[2] < 1) continue;
    const r = s * fw.r * D.eo(age / .9), a = 1 - D.ss(D.seg(age, .7, 1.8));
    g.save(); g.globalCompositeOperation = 'lighter';
    D.sunburst(g, c[0], c[1] + age * age * s * 1.5, { rays: 28, r0: r * .25, r1: r, mode: 'lines', w: Math.max(1, s * .12), alpha: a, sheen: .6 });
    D.glow(g, c[0], c[1], r * 1.2, fw.col || '#ffd27a', .3 * a);
    for (let i = 0; i < 28; i++) { const an = i / 28 * D.TAU; D.sparkle(g, c[0] + Math.cos(an) * r, c[1] + Math.sin(an) * r + age * age * s * 2, s * .5 * a, { alpha: a, glow: 0 }); }
    g.restore();
  }
  {
    const hz = P(0, 0, 5000)[1];
    if (hz < 1080) {
      for (const x of [-12, 12]) {
        const a = P(x, 0, Z0 - 6), bq = P(x, 5.5, Z0 - 6); if (a[2] < 1) continue;
        D.gline(g, [a.slice(0, 2), bq.slice(0, 2)], { w: Math.max(1, cam.scaleAt(x, 0, Z0 - 6) * .12) });
        D.glow(g, bq[0], bq[1], cam.scaleAt(x, 5.5, Z0 - 6) * 3, '#ffd08a', .55);
        D.fan(g, bq[0], bq[1], cam.scaleAt(x, 5.5, Z0 - 6) * .5, { a0: Math.PI, a1: D.TAU, ribs: 5, fill: '#c9a24b' });
      }
      for (let z = 4; z < Z0 - 1; z += 3) { const a = P(-30, 0, z), bq = P(30, 0, z); if (a[2] > .5 && bq[2] > .5) D.gline(g, [a.slice(0, 2), bq.slice(0, 2)], { w: 1, alpha: .25 }); }
      // entrance light spilling onto the pavement
      const e = P(0, 0, Z0 - 3); if (e[2] > 1) { g.save(); g.translate(e[0], e[1]); g.scale(1, .25); D.glow(g, 0, 0, cam.scaleAt(0, 0, Z0 - 3) * 14, '#ffc36a', .35); g.restore(); }
    }
  }
  return { cam, sg };
}
