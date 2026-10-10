// Hero close-ups in the flat infographic language: the palm (opening and ending, identical pose), the picking fingers,
// the coffee branch and the cup. All drawn in world units (billboards) with origin = where the object rests on the palm.
import { PAL, tri, hex, mix, TAU, clamp, lerp, seg, ss, eo } from './engine.js';

const poly = (g, pts, c) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = c; g.fill(); };
const cap = (g, x0, y0, x1, y1, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
const curve = (g, pts, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } const l = pts[pts.length - 1]; g.lineTo(l[0], l[1]); g.stroke(); };

// o: {skin, sleeve, cuff, close: 0..1 (fingers curl in), col: colour fn}
export function palm(g, o = {}) {
  const C = o.col || (c => c), S = tri(o.skin || '#A86F4C', .2, .2), SL = tri(o.sleeve || PAL.red[1], .18, .22), cl = o.close || 0;
  // forearm + sleeve from lower-left
  poly(g, [[-1.5, 1.2], [-0.95, 1.45], [-0.36, 0.56], [-0.72, 0.30]], C(SL[1]));
  poly(g, [[-0.95, 1.45], [-0.62, 1.52], [-0.22, 0.66], [-0.36, 0.56]], C(SL[2]));
  poly(g, [[-0.72, 0.30], [-0.36, 0.56], [-0.30, 0.47], [-0.64, 0.22]], C(o.cuff || hex(mix(SL[0], '#FFF7E6', .35))));
  poly(g, [[-0.64, 0.22], [-0.30, 0.47], [-0.16, 0.34], [-0.44, 0.10]], C(S[1]));
  // hand thickness (underside, dark) then palm (light, facing up)
  const hand = [[-0.46, 0.10], [-0.20, 0.36], [0.14, 0.34], [0.40, 0.19], [0.47, 0.02], [0.40, -0.13], [0.16, -0.20], [-0.10, -0.18], [-0.34, -0.06]];
  poly(g, hand.map(p => [p[0] + .015, p[1] + .075]), C(S[2]));
  poly(g, hand, C(S[1]));
  poly(g, [[-0.36, 0.06], [-0.16, 0.26], [0.12, 0.24], [0.32, 0.12], [0.36, -0.02], [0.28, -0.12], [0.08, -0.15], [-0.14, -0.12], [-0.30, -0.02]], C(S[0]));
  // palm creases
  g.globalAlpha *= .5; curve(g, [[-0.26, 0.10], [-0.05, 0.02], [0.2, 0.06]], .014, C(S[2])); curve(g, [[-0.18, -0.06], [0.04, -0.07], [0.22, -0.02]], .012, C(S[2])); g.globalAlpha *= 2;
  if (o.inside) o.inside(g);
  // fingers curling up over the far (right) edge: little → index, then thumb along the near-left edge
  const F = [[0.40, 0.14, .078], [0.45, 0.03, .085], [0.44, -0.08, .088], [0.36, -0.16, .082]];
  F.forEach(([x, y, w], i) => {
    const a1 = -1.5 - i * .12 - cl * .3, L1 = .15 + (i === 1 || i === 2 ? .025 : 0), a2 = a1 - .95 - cl * .4, L2 = .09;
    const mx = x + Math.cos(a1) * L1, my = y + Math.sin(a1) * L1, tx = mx + Math.cos(a2) * L2, ty = my + Math.sin(a2) * L2;
    const sh = C(S[2]), mid = C(i % 2 ? S[1] : hex(mix(S[1], S[0], .3)));
    cap(g, x + .012, y + .02, mx + .012, my + .02, w + .01, sh); cap(g, mx + .012, my + .02, tx + .012, ty + .02, w * .92, sh);
    cap(g, x, y, mx, my, w, mid); cap(g, mx, my, tx, ty, w * .9, mid);
    g.beginPath(); g.arc(tx, ty, w * .3, 0, TAU); g.fillStyle = C(S[0]); g.fill();
  });
  // thumb (lies along the near-left side, tip up-right)
  cap(g, -0.30, -0.02, -0.14, -0.24 + cl * .04, .12, C(S[2]));
  cap(g, -0.31, -0.04, -0.15, -0.25 + cl * .04, .105, C(S[1]));
  cap(g, -0.15, -0.25 + cl * .04, -0.02, -0.30 + cl * .06, .095, C(hex(mix(S[1], S[0], .4))));
}
// picking hand from the top-right: thumb and index pinch at (0,0) = the stem
export function pinch(g, o = {}) {
  const C = o.col || (c => c), S = tri(o.skin || '#A86F4C', .2, .2), SL = tri(o.sleeve || PAL.red[1], .18, .22), tw = o.twist || 0;
  g.save(); g.rotate(tw * .35);
  poly(g, [[1.35, -1.25], [1.7, -0.8], [0.92, -0.26], [0.66, -0.56]], C(SL[1]));
  poly(g, [[1.7, -0.8], [1.8, -0.62], [1.02, -0.16], [0.92, -0.26]], C(SL[2]));
  poly(g, [[0.66, -0.56], [0.92, -0.26], [0.82, -0.18], [0.58, -0.46]], C(hex(mix(SL[0], '#FFF7E6', .35))));
  // back of the hand
  poly(g, [[0.58, -0.46], [0.84, -0.16], [0.52, 0.06], [0.24, -0.02], [0.2, -0.26], [0.38, -0.44]], C(S[1]));
  poly(g, [[0.84, -0.16], [0.52, 0.06], [0.44, 0.02], [0.72, -0.2]], C(S[2]));
  // curled fingers (knuckles)
  [[0.46, 0.04], [0.54, 0.0], [0.6, -0.06]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y + .04, .06, 0, TAU); g.fillStyle = C(S[2]); g.fill(); });
  // index and thumb reaching to the stem
  cap(g, 0.26, -0.06, 0.05, 0.02, .085, C(S[1])); g.beginPath(); g.arc(0.04, 0.02, .045, 0, TAU); g.fillStyle = C(S[0]); g.fill();
  cap(g, 0.26, -0.3, 0.04, -0.07, .095, C(hex(mix(S[1], S[0], .3)))); g.beginPath(); g.arc(0.03, -0.06, .048, 0, TAU); g.fillStyle = C(S[0]); g.fill();
  g.restore();
}
// coffee branch: stem, faceted two-tone leaves, a cherry cluster. picked: position of the picked cherry (or null)
export function branch(g, o = {}) {
  const C = o.col || (c => c), sway = o.sway || 0;
  g.save(); g.rotate(sway * .02);
  const stem = [[-1.9, -1.35], [-0.6, -0.95], [0.3, -0.82], [1.9, -0.5]];
  curve(g, stem, .07, C('#6E4B30')); curve(g, stem.map(p => [p[0], p[1] - .02]), .03, C('#8C6443'));
  const leaf = (x, y, a, L, W) => {
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * .45, -W, L, 0); g.lineTo(0, 0); g.fillStyle = C('#7BA75F'); g.fill();
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * .45, W, L, 0); g.lineTo(0, 0); g.fillStyle = C('#4E7D3E'); g.fill();
    g.strokeStyle = C('#3F6A31'); g.lineWidth = .012; g.beginPath(); g.moveTo(0, 0); g.lineTo(L * .95, 0); g.stroke(); g.restore();
  };
  leaf(-1.3, -1.17, -2.3, .75, .22); leaf(-0.9, -1.05, .5, .8, .24); leaf(-0.35, -0.9, -2.0, .7, .2); leaf(0.55, -0.78, .75, .72, .22); leaf(0.95, -0.7, -1.6, .8, .23); leaf(1.45, -0.6, .35, .75, .22);
  // cluster at the node
  const cl = [[0.05, -0.74, .105], [0.26, -0.72, .1], [0.16, -0.62, .11], [-0.12, -0.7, .095], [0.38, -0.64, .09]];
  cl.forEach(([x, y, r], i) => cherry(g, x, y, r, i === 4 ? '#8FA24E' : null, C));
  if (o.picked) { const [x, y] = o.picked; if (o.attached) curve(g, [[0.1, -0.8], [0.04, -0.72], [x, y - .1]], .018, C('#6E4B30')); }
  g.restore();
}
export function cherry(g, x, y, r, col, C = (c => c), rot = 0) {
  const T = col ? tri(col) : PAL.red;
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = C(T[1]); g.fill(); g.save(); g.clip();
  g.beginPath(); g.arc(r * .55, r * .3, r, 0, TAU); g.fillStyle = C(T[2]); g.fill();
  g.beginPath(); g.arc(-r * .3, -r * .45, r * .78, 0, TAU); g.fillStyle = C(T[0]); g.fill(); g.restore();
  g.beginPath(); g.ellipse(-r * .36, -r * .46, r * .2, r * .11, -.5, 0, TAU); g.fillStyle = C('rgba(255,248,236,.75)'); g.fill();
  g.beginPath(); g.arc(0, -r * .92, r * .12, 0, TAU); g.fillStyle = C('#5E3C25'); g.fill();
  g.restore();
}
// cup of coffee sitting on the palm; steam animated by t; fill 0..1
export function cup(g, t, o = {}) {
  const C = o.col || (c => c), T = tri('#F4ECDC', .15, .2), r = .21, h = .24, y0 = -.02, f = o.fill ?? 1;
  // body (tapered), right side dark
  poly(g, [[-r, y0 - h], [r, y0 - h], [r * .78, y0], [-r * .78, y0]], C(T[1]));
  poly(g, [[r * .15, y0 - h], [r, y0 - h], [r * .78, y0], [r * .12, y0]], C(T[2]));
  g.beginPath(); g.ellipse(0, y0, r * .78, r * .22, 0, 0, Math.PI); g.fillStyle = C(T[2]); g.fill();
  // handle
  g.strokeStyle = C(T[2]); g.lineWidth = .045; g.beginPath(); g.ellipse(r * 1.02, y0 - h * .55, r * .3, r * .38, 0, -Math.PI / 2, Math.PI / 2); g.stroke();
  // rim + coffee
  g.beginPath(); g.ellipse(0, y0 - h, r, r * .3, 0, 0, TAU); g.fillStyle = C(T[0]); g.fill();
  if (f > 0) { const rr = r * (.86 - (1 - f) * .12); g.beginPath(); g.ellipse(0, y0 - h + (1 - f) * .06, rr, rr * .3, 0, 0, TAU); g.fillStyle = C('#5A301C'); g.fill(); g.beginPath(); g.ellipse(0, y0 - h + (1 - f) * .06, rr * .74, rr * .21, 0, 0, TAU); g.fillStyle = C('#B9804F'); g.fill(); g.beginPath(); g.ellipse(-rr * .05, y0 - h - .005 + (1 - f) * .06, rr * .35, rr * .09, 0, 0, TAU); g.fillStyle = C('#D8AA78'); g.fill(); }
  // steam
  if (o.steam !== false) { g.save(); g.strokeStyle = C('rgba(46,37,34,.45)'); g.lineWidth = .016; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const x0 = (i - 1) * .09, ph = t * 1.6 + i * 2.1; g.globalAlpha = .5 + .4 * Math.sin(t * 1.3 + i); g.beginPath(); for (let k = 0; k <= 20; k++) { const q = k / 20, yy = y0 - h - .08 - q * .38, xx = x0 + Math.sin(q * 6 + ph) * .03 * (1 + q); k ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); } g.restore(); }
}
// the "0 km / 11,000 km" tag: dot on the object → leader up-right → text. Same pixel geometry both times.
export function kmTag(g, x, y, text, a, ink = PAL.ink) {
  if (a <= 0) return; g.save(); g.globalAlpha = a; g.strokeStyle = ink; g.lineWidth = 2.5; g.lineCap = 'round';
  const s1 = eo(seg(a, 0, .4)), s2 = eo(seg(a, .3, .7));
  g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fillStyle = PAL.paper; g.fill(); g.stroke(); g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fillStyle = ink; g.fill();
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + 170 * s1, y - 170 * s1); if (s2 > 0) g.lineTo(x + 170 + 330 * s2, y - 170); g.stroke();
  if (s2 > 0) { g.save(); g.beginPath(); g.rect(x + 170, y - 290, 700 * ss(seg(a, .5, 1)), 200); g.clip(); g.font = `400 84px Jost`; g.lineJoin = 'round'; g.strokeStyle = 'rgba(251,244,230,.95)'; g.lineWidth = 10; g.strokeText(text, x + 186, y - 190); g.fillStyle = ink; g.fillText(text, x + 186, y - 190); g.restore(); }
  g.restore();
}
