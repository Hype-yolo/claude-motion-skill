// ROOF — the bulb sign "THE STARLIGHT" on the tower crown, seen from below in steep two-point perspective (Cassandre).
import * as D from '../engine/deco.js';
import * as T from '../engine/type.js';
import * as B from '../engine/bulbs.js';
import { makeCam, cardTransform } from '../engine/cam.js';
const { C } = D;

export const SIGN_TEXT = 'THE STARLIGHT';
export function sign() { return B.buildSign(SIGN_TEXT, { font: 'Poiret', size: 240, spacing: 17, track: .16 }); }

// Night sky with deco moon, stars and searchlights
export function sky(g, t = 0, o = {}) {
  const gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#04060b'); gr.addColorStop(.6, '#0a1119'); gr.addColorStop(1, '#10231f');
  g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
  const R = D.mulberry(11);
  for (let i = 0; i < 140; i++) {
    const x = R() * 1920, y = R() * 760, r = R() < .08 ? 7 + R() * 5 : .8 + R() * 1.4, tw = .6 + .4 * Math.sin(t * (1 + R() * 3) + i);
    if (r > 5) D.sparkle(g, x, y, r * tw, { alpha: .8 }); else { g.beginPath(); g.arc(x, y, r, 0, D.TAU); g.fillStyle = `rgba(255,240,210,${.35 + .5 * R() * tw})`; g.fill(); }
  }
  if (o.moon !== false) {
    const mx = o.moonX ?? 330, my = o.moonY ?? 190, mr = o.moonR ?? 70;
    D.glow(g, mx, my, mr * 3.2, '#f6e8c4', .18);
    for (let k = 1; k <= 3; k++) D.gline(g, D.arcPts(mx, my, mr + k * 16, 0, D.TAU, 90), { w: .8, alpha: .5 - k * .12 });
    g.save(); g.beginPath(); g.arc(mx, my, mr, 0, D.TAU); const mg = g.createRadialGradient(mx - mr * .3, my - mr * .3, 0, mx, my, mr); mg.addColorStop(0, '#fff8e6'); mg.addColorStop(1, '#d8c69c'); g.fillStyle = mg; g.fill();
    g.beginPath(); g.arc(mx + mr * .42, my - mr * .15, mr * .92, 0, D.TAU); g.fillStyle = '#070a10'; g.fill(); g.restore();
  }
  // searchlights from below, slowly sweeping
  const beams = o.beams ?? [[260, 1180, -1.25 + .12 * Math.sin(t * .6)], [1650, 1180, -1.95 + .1 * Math.sin(t * .5 + 1)], [980, 1200, -1.62 + .16 * Math.sin(t * .4 + 2)]];
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [x, y, a] of beams) D.beam(g, x, y, a, 1500, 260, .16, '#f4ecd6');
  g.restore();
}

// distant stepped towers (skyline) with lit window dots
export function skyline(g, y0, o = {}) {
  const R = D.mulberry(o.seed ?? 5), n = o.n ?? 12;
  for (let i = 0; i < n; i++) {
    const x = (o.x0 ?? 0) + i * ((o.w ?? 1920) / n) + R() * 60, w = 60 + R() * 110, h = (o.h ?? 260) * (.4 + R() * .9);
    const top = y0 - h;
    g.fillStyle = '#070809'; g.beginPath(); g.moveTo(x, y0 + 400); g.lineTo(x, top + 40); g.lineTo(x + w * .15, top + 40); g.lineTo(x + w * .15, top + 16); g.lineTo(x + w * .32, top + 16); g.lineTo(x + w * .32, top); g.lineTo(x + w * .68, top); g.lineTo(x + w * .68, top + 16); g.lineTo(x + w * .85, top + 16); g.lineTo(x + w * .85, top + 40); g.lineTo(x + w, top + 40); g.lineTo(x + w, y0 + 400); g.closePath(); g.fill();
    D.gline(g, [[x + w * .32, top], [x + w * .68, top]], { w: 1, alpha: .5 });
    for (let yy = top + 50; yy < y0 + 380; yy += 14) for (let xx = x + 8; xx < x + w - 8; xx += 12) if (R() < .28) { g.fillStyle = `rgba(255,${190 + R() * 40 | 0},110,${.35 + R() * .4})`; g.fillRect(xx, yy, 4, 6); }
  }
  const hz = g.createLinearGradient(0, y0 - 200, 0, y0 + 200); hz.addColorStop(0, 'rgba(16,35,31,0)'); hz.addColorStop(1, 'rgba(16,35,31,.8)'); g.fillStyle = hz; g.fillRect(0, y0 - 200, 1920, 600);
}

// Geometry of the sign in the world. Returns helpers to draw letters, structure, and to place figures on the catwalk.
export function signRig(o = {}) {
  const S = sign();
  const k = (o.height ?? 3.9) / S.size;                         // metres per raster px
  const th = o.theta ?? .62, Dv = [Math.cos(th), 0, -Math.sin(th)], Nv = [Math.sin(th), 0, Math.cos(th)];  // along sign (far→near), and "behind"
  const L = S.w * k, near = o.near ?? [4.6, 2.2, 6.6];
  const O = [near[0] - Dv[0] * L, near[1], near[2] - Dv[2] * L];  // far end, baseline of glyph box bottom
  const Hb = S.h * k;
  const at = (u, y = 0, n = 0) => [O[0] + Dv[0] * u + Nv[0] * n, O[1] + y, O[2] + Dv[2] * u + Nv[2] * n];
  return { S, k, L, Hb, O, Dv, Nv, at, th };
}

// Full rooftop view. o: { cam, lit(li,bi,gi), pip(g, cam, rig), t, glowPip }
export function drawRoof(g, o = {}) {
  const t = o.t || 0;
  const cam = makeCam({ x: 0, y: 0, z: 0, f: 1100, oy: 1190, ...(o.cam || {}) });
  const rig = signRig(o.rig || {}), { S, k, L, Hb, at } = rig;
  sky(g, t, o.sky || {});
  // distant towers poking up bottom-left
  g.save(); g.globalAlpha = .9; skyline(g, 1120, { x0: -40, w: 900, n: 6, h: 420, seed: 3 }); g.restore();
  const P = (p) => cam.P(...p);
  const lineW = (a, b, opt) => D.gline(g, [P(a).slice(0, 2), P(b).slice(0, 2)], opt);
  // ---- crown parapet (building mass under the catwalk) ----
  {
    const y0 = -.2, y1 = -6;
    const pts = [at(-2, y0, .4), at(L + 3, y0, .4), at(L + 3, y1, .4), at(-2, y1, .4)].map(p => P(p).slice(0, 2));
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
    const gr = g.createLinearGradient(0, pts[0][1], 0, 1080); gr.addColorStop(0, '#1a140c'); gr.addColorStop(1, '#050403'); g.fillStyle = gr; g.fill();
    for (const y of [-.35, -.6, -.8, -1.6, -1.75]) lineW(at(-2, y, .4), at(L + 3, y, .4), { w: 1.3, alpha: .8 });
    for (let u = -1; u < L + 3; u += 2.2) lineW(at(u, -.8, .4), at(u, -6, .4), { w: 1.1, alpha: .6 });
    // chevron frieze on the parapet face
    for (let u = -1; u < L + 3; u += 1.1) lineW(at(u, -1.0, .4), at(u + .55, -1.4, .4), { w: 1, alpha: .6 }), lineW(at(u + .55, -1.4, .4), at(u + 1.1, -1.0, .4), { w: 1, alpha: .6 });
  }
  // ---- structure behind the letters: posts + X braces + top rail ----
  const back = 1.1;
  for (let u = 0; u <= L + .01; u += L / 12) {
    lineW(at(u, 0, back), at(u, Hb * .95, back), { w: 1.4, alpha: .75 });
  }
  for (let i = 0; i < 12; i++) {
    const u0 = i * L / 12, u1 = (i + 1) * L / 12;
    lineW(at(u0, .1, back), at(u1, Hb * .9, back), { w: .8, alpha: .45 }); lineW(at(u1, .1, back), at(u0, Hb * .9, back), { w: .8, alpha: .45 });
  }
  lineW(at(0, Hb * .95, back), at(L, Hb * .95, back), { w: 1.6, alpha: .8 });
  lineW(at(0, .05, back), at(L, .05, back), { w: 1.6, alpha: .8 });
  // ---- letters (far → near so near ones overlap) ----
  const lit = o.lit || (() => 0);
  S.letters.forEach((le, li) => {
    g.save();
    cardTransform(g, cam, at(le.x * k, Hb), at((le.x + le.w) * k, Hb), at(le.x * k, 0), le.w, S.h);
    g.translate(-le.x, 0);
    B.drawSign(g, S, 0, 0, 1, { lit, only: li, haloK: 1.1 });
    g.restore();
  });
  // ---- catwalk in front of the letters ----
  {
    const n = -.9;
    const deck = [at(-1, 0, n - .5), at(L + 2, 0, n - .5), at(L + 2, 0, .2), at(-1, 0, .2)].map(p => P(p).slice(0, 2));
    g.beginPath(); deck.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = '#0d0a07'; g.fill();
    lineW(at(-1, 0, n - .5), at(L + 2, 0, n - .5), { w: 2 });
    if (o.pip) o.pip(g, cam, rig);
    lineW(at(-1, 1.05, n - .5), at(L + 2, 1.05, n - .5), { w: 2.2 });
    lineW(at(-1, .55, n - .5), at(L + 2, .55, n - .5), { w: 1.2 });
    for (let u = -1; u < L + 2; u += 1.2) lineW(at(u, 0, n - .5), at(u, 1.05, n - .5), { w: 1.3 });
  }
  D.vignette(g, 1920, 1080, .45);
  return { cam, rig };
}
