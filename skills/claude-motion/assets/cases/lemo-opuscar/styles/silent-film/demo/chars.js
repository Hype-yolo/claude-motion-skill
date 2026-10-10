// Cast of The Runaway Loaf (all original). Values are print densities (0 = black, 1 = white).
import { form, stroke, ink, catmull, grey, pathOf, ellipsePts, INK, hatch } from './engine/ink.js';
import { torsoPoint } from './engine/figure.js';
import { PROFILE_ADULT, PROFILE_CHILD, FRONT_ADULT, FRONT_CHILD } from './engine/heads.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// blend a head-local shape between front / profile / back sets (same point count). pts in head units.
export function headShape(H, frontPts, profPts, backPts) {
  const w = ss(.35, .95, H.p);
  const base = H.front >= 0 ? frontPts : (backPts || frontPts);
  const fm = H.front >= 0 ? H.f : -H.f;          // asymmetric front shapes follow the facing side
  return base.map((q, i) => { const r = profPts[i]; return [lerp(q[0] * fm, r[0] * H.f, w) * H.sc, lerp(q[1], r[1], w) * H.sc]; });
}
const loop = (pts, n = 5) => catmull(pts, true, n);

// ---------------- OTTO, apprentice baker ----------------
const ottoHairF = [[-.36, -.08], [-.37, -.3], [-.25, -.46], [0, -.52], [.25, -.46], [.37, -.3], [.36, -.08], [.3, -.2], [.18, -.27], [.05, -.24], [-.1, -.28], [-.25, -.24]];
const ottoHairP = [[-.38, .18], [-.44, -.1], [-.32, -.42], [-.05, -.52], [.2, -.47], [.33, -.33], [.3, -.26], [.2, -.3], [.12, -.22], [.02, -.14], [-.02, .02], [-.2, .2]];
const ottoHairB = [[-.36, .1], [-.4, -.2], [-.28, -.44], [0, -.52], [.28, -.44], [.4, -.2], [.36, .1], [.25, .22], [.12, .25], [0, .26], [-.12, .25], [-.25, .22]];
// soft pleated baker's cap, flopped to the character's right
const capF = [[-.38, -.33], [-.41, -.41], [-.34, -.5], [-.14, -.55], [.1, -.55], [.3, -.52], [.44, -.46], [.45, -.4], [.4, -.34], [0, -.36]];
const capP = [[-.44, -.24], [-.5, -.34], [-.45, -.46], [-.24, -.55], [0, -.57], [.22, -.54], [.36, -.46], [.4, -.39], [.37, -.31], [0, -.35]];
const capBandF = [[-.37, -.22], [0, -.25], [.37, -.22], [.4, -.28], [.39, -.35], [0, -.37], [-.39, -.35], [-.4, -.28]];
const capBandP = [[-.44, -.14], [0, -.24], [.37, -.21], [.39, -.27], [.38, -.33], [0, -.36], [-.45, -.26], [-.46, -.19]];
export const OTTO = {
  name: 'Otto', body: 'adult', line: .028,
  skin: { v: .8 }, handW: .3, neckW: .4,
  leg: { v: .3, w: [.56, .44, .38], folds: true, patch: true, gap: 5.5 },
  shoe: { v: .12 },
  arm: { v: .9, w: [.36, .31, .27], sleeve: .5, foreW: [.26, .19] },
  torso: { v: .9, grad: .2 },
  vest: { v: .24, shoulder: .6, bottom: .72 },
  torsoW: 1.0, torsoD: 1.0,
  skirt: { front: true, v: .95, top: .98, len: 3.3, wz: .62, fx: .44, topW: 1, hemW: 1.42, hatch: 0, tie: true },
  torsoDetail(g, J, pr, s, lw, face) {
    if (s < 14) return;
    const T = (xf, y, xs) => torsoPoint(J, pr, xf, y, xs);
    const fv = pr.cy > -.25, ps = Math.abs(pr.sy);
    if (fv) {
      // shirt showing in the waistcoat's V + the waistcoat's front edges, buttons and a watch chain
      const v = [T(-.3, 2.3, .14), T(0, 1.62, .42), T(.3, 2.3, .3), T(.12, 2.36, .24), T(-.12, 2.36, .1)];
      form(g, loop(v, 3), { v: .9, line: lw * .8, grad: .1, seed: 236 });
      stroke(g, [T(0, 1.62, .42), T(ps > .85 ? .02 : .02, .8, .4)], lw * .8, { seed: 237 });
      for (let i = 0; i < 4; i++) { const q = T(.06, 1.5 - i * .2, .43); g.fillStyle = grey(.62); g.beginPath(); g.arc(q[0], q[1], s * .02, 0, 7); g.fill(); }
      const w0 = T(.06, 1.3, .43), w1 = T(-.35, 1.18, .3), w2 = T(-.45, 1.32, .12);
      stroke(g, catmull([w0, [lerp(w0[0], w1[0], .5), lerp(w0[1], w1[1], .5) + s * .06], w1, w2], false, 5), lw * .55, { color: grey(.82), seed: 238, alpha: .9 });
      // pocket welts
      if (ps < .8) { stroke(g, [T(-.52, 1.28), T(-.26, 1.3)], lw * .6, { color: grey(.5), seed: 239 }); stroke(g, [T(.26, 1.3), T(.52, 1.28)], lw * .6, { color: grey(.5), seed: 240 }); }
    } else {
      stroke(g, [T(-.3, 1.9, 0), T(.3, 1.9, 0)], lw * .6, { seed: 244, alpha: .6 });   // back strap
      stroke(g, [T(0, 1.4, 0), T(0, .8, 0)], lw * .5, { seed: 245, alpha: .6 });
    }
  },
  collar(g, J, pr, s, lw, face) {
    const T = (xf, y, xs) => torsoPoint(J, pr, xf, y, xs);
    // neckerchief (dark) tucked into a white stand collar
    if (pr.cy > -.3) {
      const k = T(0, 2.3, .2);
      const knot = loop([[k[0] - s * .09, k[1] - s * .06], [k[0] + s * .09, k[1] - s * .06], [k[0] + s * .07, k[1] + s * .07], [k[0] - s * .07, k[1] + s * .07]], 4);
      const tails = loop([[k[0] - s * .05, k[1] + s * .04], [k[0] + s * .06, k[1] + s * .04], [k[0] + s * .11 * face, k[1] + s * .3], [k[0] - s * .02, k[1] + s * .26]], 4);
      form(g, tails, { v: .2, line: lw * .8, hatch: .3, seed: 241 }); form(g, knot, { v: .17, line: lw * .8, hatch: .3, seed: 242 });
    }
    // stand collar: hugs the neck, open in a small V at the front
    const c = pr.cy > -.3 ? loop([T(-.26, 2.33, -.22), T(-.05, 2.28, .16), T(0, 2.4, .22), T(.05, 2.28, .2), T(.26, 2.33, .24), T(.24, 2.5, .2), T(0, 2.47, -.03), T(-.24, 2.5, -.24)], 4)
      : loop([T(-.26, 2.33, -.22), T(.26, 2.33, .24), T(.24, 2.5, .2), T(-.24, 2.5, -.24)], 4);
    form(g, c, { v: .92, line: lw * .85, grad: .18, hatch: 0, seed: 243 });
  },
  head: {
    skin: .82, jaw: 1, chinW: .44, brow: 2.1, lip: .36, profile: PROFILE_ADULT,
    hairMass: { v: .13, top: -.2, nape: .22, temple: .2, fringe: true },
    _oldHair(g, H) {
      const pts = loop(headShape(H, ottoHairF, ottoHairP, ottoHairB));
      form(g, pts, { v: .13, line: H.lw * .8, grad: .1, hatch: .2, seed: 211 });
      // hair texture: lighter combed strokes
      for (let i = 0; i < 7; i++) {
        const u = i / 6, a = headShape(H, [[lerp(-.3, .3, u), -.34]], [[lerp(-.3, .25, u), -.36]])[0], b = headShape(H, [[lerp(-.34, .34, u) + .04, -.12 - Math.abs(u - .5) * .1]], [[lerp(-.38, .1, u), -.08 + u * .06]])[0];
        stroke(g, [a, b], H.lw * .45, { color: grey(.42), seed: 212 + i, alpha: .8 });
      }
    },
    hat(g, H) {
      const band = loop(headShape(H, capBandF, capBandP, capBandF), 4);
      const pouf = loop(headShape(H, capF, capP, capF), 5);
      form(g, pouf, { v: .93, line: H.lw, grad: .26, hatch: 0, seed: 221, shade: { off: H.sc * .08, a: .14, hatch: .25, seed: 229 } });
      for (let i = 0; i < 6; i++) {
        const u = (i + .5) / 6, a = headShape(H, [[lerp(-.36, .4, u), -.36]], [[lerp(-.36, .36, u), -.35]])[0], b = headShape(H, [[lerp(-.3, .44, u), -.55 - Math.sin(u * 3) * .03]], [[lerp(-.34, .4, u), -.57]])[0];
        stroke(g, [a, [lerp(a[0], b[0], .5) + .01 * H.sc, lerp(a[1], b[1], .5)], b], H.lw * .45, { seed: 223 + i, alpha: .55 });
      }
      form(g, band, { v: .9, line: H.lw, grad: .2, hatch: 0, seed: 222 });
      // soft shadow of the band on the forehead
      const sh = headShape(H, [[-.35, -.23], [0, -.26], [.35, -.23], [.32, -.17], [0, -.2], [-.32, -.17]], [[-.3, -.15], [0, -.25], [.37, -.21], [.34, -.16], [0, -.2], [-.3, -.1]]);
      g.fillStyle = 'rgba(30,24,20,.2)'; pathOf(g, loop(sh, 3)); g.fill();
    },
  },
};

// ---------------- THE GIRL ----------------
const beretF = [[-.42, -.2], [-.5, -.34], [-.44, -.5], [-.2, -.62], [.12, -.64], [.4, -.56], [.55, -.42], [.5, -.28], [.36, -.22], [0, -.3]];
const beretP = [[-.4, -.14], [-.5, -.3], [-.44, -.48], [-.2, -.62], [.1, -.64], [.35, -.56], [.48, -.42], [.44, -.28], [.34, -.24], [0, -.3]];
const gHairF = [[-.42, .3], [-.4, -.1], [-.3, -.32], [0, -.38], [.3, -.32], [.4, -.1], [.42, .3], [.34, .1], [.3, -.12], [.1, -.2], [-.1, -.2], [-.3, -.12], [-.34, .1]];
const gHairP = [[-.3, .36], [-.44, .05], [-.38, -.3], [-.05, -.4], [.25, -.34], [.34, -.2], [.3, -.14], [.18, -.18], [.08, -.1], [0, 0], [-.05, .12], [-.12, .3], [-.2, .38]];
export const GIRL = {
  name: 'Girl', body: 'child', line: .034,
  skin: { v: .82 }, handW: .36, neckW: .3,
  leg: { v: .8, w: [.34, .27, .24], folds: false },          // bare knees / pale stockings
  shoe: { v: .16 },
  arm: { v: .3, w: [.36, .33, .3], sleeve: 1 },
  torso: { v: .3, grad: .18 },
  torsoW: 1.08,
  skirt: { front: true, v: .3, top: .95, len: 1.55, wz: .72, fx: .48, topW: 1, hemW: 1.35, hatch: .35 },
  collar(g, J, pr, s, lw) {       // scarf
    const n = pr.P(J.neck);
    const pts = loop([[n[0] - s * .36, n[1] - s * .12], [n[0] + s * .36, n[1] - s * .12], [n[0] + s * .38, n[1] + s * .08], [n[0], n[1] + s * .14], [n[0] - s * .38, n[1] + s * .08]], 4);
    form(g, pts, { v: .6, line: lw * .8, hatch: .1, seed: 301 });
    for (let i = -1; i <= 1; i++) stroke(g, [[n[0] + i * s * .2 - s * .05, n[1] - s * .1], [n[0] + i * s * .2 + s * .03, n[1] + s * .1]], lw * 1.1, { seed: 302 + i, alpha: .6 });
  },
  head: {
    skin: .82, jaw: .92, chinW: .5, brow: 1.2, lip: .45, profile: PROFILE_CHILD, front: FRONT_CHILD, eyeH: 1.35, eyeY: .0, makeup: .7, nose: .85,
    hairBack(g, H) { const pts = loop(headShape(H, gHairF, gHairP)); form(g, pts, { v: .22, line: H.lw * .8, grad: .12, hatch: .3, seed: 311 }); },
    hat(g, H) {
      const pts = loop(headShape(H, beretF, beretP), 5);
      form(g, pts, { v: .2, line: H.lw, grad: .2, hatch: .45, seed: 321 });
      const c = headShape(H, [[.08, -.64]], [[.05, -.64]])[0];
      stroke(g, [c, [c[0] + .02 * H.sc, c[1] - .07 * H.sc]], H.lw * 1.4, { seed: 322 });
    },
  },
};

// ---------------- THE CONSTABLE ----------------
const helmF = [[-.4, -.22], [-.42, -.42], [-.3, -.7], [-.1, -.86], [0, -.9], [.1, -.86], [.3, -.7], [.42, -.42], [.4, -.22], [0, -.26]];
const helmP = [[-.44, -.12], [-.46, -.36], [-.36, -.66], [-.14, -.86], [0, -.9], [.16, -.84], [.36, -.64], [.44, -.38], [.52, -.2], [0, -.24]];
export const COP = {
  name: 'Constable', body: 'adult', line: .03,
  skin: { v: .72 }, handW: .36, neckW: .4,
  leg: { v: .15, w: [.66, .5, .44], folds: true },
  shoe: { v: .08 },
  arm: { v: .15, w: [.48, .42, .36], sleeve: 1 },
  torso: { v: .15, grad: .2 },
  torsoW: 1.12, torsoD: 1.25,
  skirt: { front: false, v: .14, top: 1.3, len: 2.9, wz: .8, fx: -.3, hemW: 1.2 },
  torsoDetail(g, J, pr, s, lw) {
    if (s < 16 || pr.cy < -.3) return;
    const c = J.spine[0].c, up = J.up;
    for (let i = 0; i < 5; i++) for (const z of [.2, -.2]) {
      const h = .55 + i * .38, p3 = [c[0] + up[0] * h + .56, c[1] + up[1] * h, z];
      if (pr.D(p3) < -.15) continue;
      const q = pr.P(p3); g.fillStyle = grey(.88); g.beginPath(); g.arc(q[0], q[1], s * .03, 0, 7); g.fill();
    }
    // belt
    const a = pr.P([c[0] + up[0] * .45 + .5, c[1] + up[1] * .45, .7]), b = pr.P([c[0] + up[0] * .45 + .5, c[1] + up[1] * .45, -.7]);
    stroke(g, [a, b], s * .1, { color: grey(.08), seed: 401 });
  },
  head: {
    skin: .72, jaw: 1.12, chinW: .55, brow: 2.2, lip: .4, profile: PROFILE_ADULT, nose: 1.1,
    beard(g, H) {       // walrus moustache
      const pts = headShape(H, [[-.2, .23], [-.08, .19], [0, .2], [.08, .19], [.2, .23], [.23, .3], [.1, .27], [0, .26], [-.1, .27], [-.23, .3]],
        [[.1, .23], [.3, .18], [.4, .19], [.44, .21], [.46, .25], [.43, .3], [.38, .28], [.33, .27], [.22, .29], [.08, .3]]);
      form(g, loop(pts, 4), { v: .22, line: H.lw * .8, hatch: .4, seed: 411 });
    },
    hat(g, H) {
      const pts = loop(headShape(H, helmF, helmP), 5);
      form(g, pts, { v: .13, line: H.lw, grad: .22, hatch: .3, seed: 421 });
      const band = headShape(H, [[-.4, -.26], [0, -.3], [.4, -.26]], [[-.44, -.16], [0, -.28], [.5, -.22]]);
      stroke(g, catmull(band, false, 5), H.lw * 1.6, { color: grey(.3), seed: 422 });
      // star badge
      const c = headShape(H, [[0, -.5]], [[.34, -.5]])[0];
      if (H.front > -.2) { const r = .07 * H.sc; const st = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .45 : r; st.push([c[0] + Math.cos(a) * rr * (H.p > .8 ? .5 : 1), c[1] + Math.sin(a) * rr]); } g.fillStyle = grey(.85); pathOf(g, st); g.fill(); }
    },
  },
};

// ---------------- THE FRUIT SELLER ----------------
const scarfF = [[-.42, .05], [-.46, -.25], [-.36, -.48], [0, -.58], [.36, -.48], [.46, -.25], [.42, .05], [.3, -.1], [.22, -.26], [0, -.3], [-.22, -.26], [-.3, -.1]];
const scarfP = [[-.45, .25], [-.5, -.1], [-.4, -.42], [-.08, -.58], [.22, -.5], [.35, -.34], [.3, -.28], [.2, -.3], [.1, -.24], [0, -.16], [-.06, .02], [-.2, .28]];
export const SELLER = {
  name: 'Seller', body: 'adult', line: .03,
  skin: { v: .74 }, handW: .38, neckW: .4,
  leg: { v: .5, w: [.5, .4, .34] },
  shoe: { v: .15 },
  arm: { v: .45, w: [.5, .44, .36], sleeve: .5, foreW: [.34, .26] },
  torso: { v: .45, grad: .18 },
  torsoW: 1.3, torsoD: 1.5,
  skirt: { front: true, v: .82, top: .9, len: 3.4, wz: 1.0, fx: .7, hemW: 1.3, stripes: true },
  head: {
    skin: .74, jaw: 1.15, chinW: .6, brow: 1.8, lip: .42, profile: PROFILE_ADULT,
    hat(g, H) { const pts = loop(headShape(H, scarfF, scarfP), 5); form(g, pts, { v: .62, line: H.lw, grad: .2, hatch: .1, seed: 511 });
      for (let i = 0; i < 6; i++) { const q = headShape(H, [[-.3 + i * .12, -.4 + Math.sin(i) * .06]], [[-.35 + i * .1, -.42 + Math.cos(i) * .05]])[0]; g.fillStyle = grey(.35); g.beginPath(); g.arc(q[0], q[1], .025 * H.sc, 0, 7); g.fill(); } },
  },
};

// ---------------- props ----------------
// the loaf (bâtard): length L px, angle a, roll phase (rad) rotates the scoring slashes
export function drawLoaf(g, x, y, L, a = 0, roll = 0, o = {}) {
  const r = L * (o.half ? .36 : .21);
  g.save(); g.translate(x, y); g.rotate(a);
  if (o.half) {            // half loaf: crust on one end, torn crumb face on the other
    const sg = o.half, Lh = L;
    const body = loop([[-sg * Lh * .5, 0], [-sg * Lh * .42, -r * .95], [-sg * Lh * .05, -r * 1.02], [sg * Lh * .38, -r * .9], [sg * Lh * .46, -r * .3], [sg * Lh * .5, r * .2], [sg * Lh * .4, r * .85], [-sg * Lh * .1, r * .98], [-sg * Lh * .44, r * .72]], 6);
    form(g, body, { v: .48, line: Math.max(1.4, L * .03), grad: .34, seed: 602, shade: L * .05 });
    const face = loop([[sg * Lh * .38, -r * .88], [sg * Lh * .5, -r * .35], [sg * Lh * .53, r * .1], [sg * Lh * .45, r * .8], [sg * Lh * .3, r * .5], [sg * Lh * .28, -r * .3]], 5);
    form(g, face, { v: .86, line: Math.max(1, L * .02), grad: .1, seed: 603 });
    for (let i = 0; i < 7; i++) { g.fillStyle = grey(.62); g.beginPath(); g.arc(sg * Lh * (.33 + (i % 3) * .06), r * (-.5 + i * .17), L * .015, 0, 7); g.fill(); }
    g.restore(); return;
  }
  const body = loop([[-L / 2, 0], [-L * .42, -r * .95], [-L * .1, -r * 1.05], [L * .25, -r * 1.02], [L * .47, -r * .7], [L / 2, 0], [L * .45, r * .75], [L * .15, r * .98], [-L * .2, r * .98], [-L * .44, r * .72]], 6);
  form(g, body, { v: o.v ?? .5, line: Math.max(1.4, L * .025), grad: .34, hatch: .25, gap: 4, seed: 601, shade: L * .05 });
  // crust highlight
  g.fillStyle = grey(.78, .55); g.beginPath(); g.ellipse(-L * .05, -r * .55, L * .3, r * .22, -.05, 0, 7); g.fill();
  // scoring slashes: positions rotate around the loaf's long axis as it rolls
  for (let i = 0; i < 3; i++) {
    const ph = roll + i * .0, xx = -L * .28 + i * L * .28;
    const c = Math.cos(ph), sn = Math.sin(ph);
    if (c < -.1) continue;                                   // on the far side
    const yy = -sn * r * .75;
    const k = Math.max(.2, c);
    const sl = [[xx - L * .12, yy + r * .16 * k], [xx, yy - r * .1 * k], [xx + L * .12, yy - r * .22 * k]];
    ink(g, sl, { w: Math.max(1.2, L * .03) * k, closed: false, taper: .4, light: 0, seed: 610 + i });
    stroke(g, sl.map(q => [q[0], q[1] + r * .12 * k]), Math.max(.8, L * .012), { color: grey(.85), seed: 620 + i, alpha: .7 });
  }
  g.restore();
}

// ---------------- the round loaf (a country boule): it rolls like a wheel ----------------
// r = radius px; rot = rolling angle (rad) — pass distance / r for true rolling; o.squash (1 = round) for landings
export function drawBoule(g, x, y, r, rot = 0, o = {}) {
  const sq = o.squash ?? 1;
  g.save(); g.translate(x, y + r * (1 - sq)); g.scale(1 / Math.sqrt(sq), sq); g.rotate(rot);
  // crust: slightly irregular round, dark-baked edge, lighter floured top
  const body = catmull(Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2, k = 1 + Math.sin(a * 3 + 1.3) * .025 + Math.sin(a * 5) * .015; return [Math.cos(a) * r * k, Math.sin(a) * r * k * .97]; }), true, 5);
  form(g, body, { v: o.v ?? .46, line: Math.max(1.4, r * .06), grad: .32, seed: 701, shade: r * .16 });
  // flour dusting
  g.fillStyle = grey(.86, .35);
  for (const [a, d, s] of [[-.6, .45, .38], [2.2, .5, .3], [3.9, .4, .34], [1.0, .2, .26]]) { g.beginPath(); g.ellipse(Math.cos(a) * r * d, Math.sin(a) * r * d, r * s, r * s * .7, a, 0, 7); g.fill(); }
  // the baker's cross: two curved cuts, each with a pale "ear" of opened crumb
  for (const k of [0, 1]) {
    const a = k * Math.PI / 2 + .12, c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
    const cut = [-.72, -.3, 0, .3, .72].map((u, i) => [c * u * r + nx * Math.sin((u + .72) / 1.44 * Math.PI) * r * .1, s * u * r + ny * Math.sin((u + .72) / 1.44 * Math.PI) * r * .1]);
    stroke(g, cut.map(([px, py]) => [px + nx * r * .06, py + ny * r * .06]), Math.max(1.4, r * .14), { color: grey(.84), seed: 710 + k, taper: .5 });
    stroke(g, cut, Math.max(1.1, r * .07), { seed: 712 + k, taper: .5 });
  }
  g.restore();
}
// half a boule: crust arc + the torn crumb face (flat side toward `face` angle)
export function drawBouleHalf(g, x, y, r, rot = 0, o = {}) {
  g.save(); g.translate(x, y); g.rotate(rot);
  const arc = []; for (let i = 0; i <= 14; i++) { const a = -Math.PI / 2 + i / 14 * Math.PI; arc.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const torn = [[0, r], [-r * .08, r * .5], [r * .05, r * .15], [-r * .07, -r * .2], [r * .04, -r * .55], [0, -r]];
  form(g, catmull([...arc, ...torn.slice(1, -1)], true, 3), { v: o.v ?? .46, line: Math.max(1.3, r * .06), grad: .3, seed: 721, shade: r * .14 });
  // crumb: an oval face turned slightly toward us
  const face = catmull([[-r * .02, -r * .95], [r * .3, -r * .6], [r * .38, 0], [r * .3, r * .6], [-r * .02, r * .95], [-r * .1, r * .4], [-r * .05, -r * .3]], true, 4);
  form(g, face, { v: .9, line: Math.max(1, r * .04), grad: .12, seed: 722 });
  g.fillStyle = grey(.66);
  for (let i = 0; i < 9; i++) { const u = Math.sin(i * 7.3) * .5 + .5, w = Math.sin(i * 3.1) * .5 + .5; g.beginPath(); g.ellipse(r * (.02 + .25 * w), r * (-.7 + 1.4 * u), r * .03, r * .05, 0, 0, 7); g.fill(); }
  g.restore();
}
