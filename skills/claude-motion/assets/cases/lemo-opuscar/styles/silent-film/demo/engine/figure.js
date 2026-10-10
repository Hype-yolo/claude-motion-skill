// Realistic-proportion human rig for the silent-film style.
// 2.5D: joints are solved in 3D body space (x forward, y up, z = character's left), projected orthographically
// with a yaw (0 = facing camera, 90 = facing screen-right, -90 = screen-left, 180 = back), then every part is drawn
// as an ink + silver-wash form, far parts first.
// Units: 1 = head height. Otto is 7.5 heads tall. Pose angles in radians.
import { form, stroke, ink, wash, hatch, catmull, ellipsePts, grey, pathOf, INK, V, S as IS } from './ink.js';
import { drawHead } from './heads.js';

const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotZ = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------------- body proportions ----------------
export const BODY = {
  adult: { neck: 2.42, headUp: .56, shoulderZ: .66, shoulderY: 1.98, hipZ: .36, thigh: 1.78, shin: 1.72, ankleH: .28, foot: .95, heel: .22,
    upper: 1.4, fore: 1.18, hand: .68,
    // torso rows: [y, half-width (front view), front edge (side view), back edge (side view)]
    rows: [[2.44, .21, .17, -.2], [2.36, .44, .22, -.27], [2.26, .64, .3, -.34], [2.1, .8, .4, -.39], [1.9, .82, .46, -.4], [1.62, .72, .47, -.37],
      [1.3, .67, .42, -.31], [.95, .59, .36, -.25], [.55, .67, .38, -.34], [.15, .73, .41, -.43], [-.14, .69, .36, -.4]],
    torso: [[0, 1.46, .84], [1.0, 1.2, .64], [2.2, 1.5, .76]] },
  child: { neck: 1.64, headUp: .54, shoulderZ: .48, shoulderY: 1.38, hipZ: .28, thigh: 1.08, shin: 1.0, ankleH: .2, foot: .66, heel: .16,
    upper: .92, fore: .8, hand: .48,
    rows: [[1.66, .19, .17, -.19], [1.58, .4, .22, -.24], [1.5, .58, .3, -.3], [1.36, .64, .36, -.34], [1.16, .62, .4, -.34], [.9, .6, .42, -.32],
      [.6, .6, .42, -.3], [.3, .6, .4, -.32], [0, .6, .38, -.36], [-.1, .56, .34, -.34]],
    torso: [[0, 1.2, .76], [.9, 1.1, .7], [1.5, 1.2, .66]] },
};

// ---------------- pose ----------------
// pose: { lean, twist, pelvisTilt, nod, headTurn, headTilt,
//         L:{hip,abd,knee,ankle}, R:{...}, aL:{fl,abd,el,wr,hand}, aR:{...}, expr:{}, flutter }
export const P0 = () => ({ lean: .02, twist: 0, nod: .03, headTurn: 0, headTilt: .03,
  L: { hip: .04, abd: .07, knee: .1, ankle: 0 }, R: { hip: -.02, abd: .03, knee: .02, ankle: 0 },
  aL: { fl: .06, abd: .03, el: .28, wr: .12, hand: 'relax' }, aR: { fl: -.02, abd: .02, el: .2, wr: .1, hand: 'relax' }, expr: {}, flutter: 0 });
export function mixPose(a, b, t) {
  const o = {};
  for (const k in a) {
    const va = a[k], vb = b[k] ?? va;
    if (typeof va === 'number') o[k] = lerp(va, vb, t);
    else if (va && typeof va === 'object' && !Array.isArray(va)) o[k] = mixPose(va, vb, t);
    else o[k] = t < .5 ? va : vb;
  }
  for (const k in b) if (!(k in o)) o[k] = b[k];
  return o;
}

// ---------------- solve ----------------
export function solve(pose, B) {
  const J = {};
  J.pelvis = [0, 0, 0];
  const legs = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const q = pose[side], hipP = [0, 0, s * B.hipZ];
    const flex = q.hip, abd = q.abd ?? 0, knee = q.knee ?? 0;
    const d1 = rotX(rotZ([0, -1, 0], flex), -s * abd);
    const K = add(hipP, mul(d1, B.thigh));
    const d2 = rotX(rotZ([0, -1, 0], flex - knee), -s * abd);
    const A = add(K, mul(d2, B.shin));
    const th = flex - knee + (q.ankle ?? 0);
    const fdir = rotX(rotZ([1, 0, 0], th), -s * abd * .5);
    const sole = add(A, mul(rotZ([0, -1, 0], th), B.ankleH));
    const toe = add(sole, mul(fdir, B.foot)), heel = add(sole, mul(fdir, -B.heel));
    legs[side] = { hip: hipP, knee: K, ankle: A, toe, heel, sole, fdir };
  }
  J.legs = legs;
  // upper body in chest frame, then twist + lean around the pelvis
  const tl = p => rotZ(rotY(p, pose.twist || 0), -(pose.lean || 0));    // lean>0 = forward (towards +x)
  const up = tl([0, 1, 0]);
  J.up = up;
  J.neck = tl([0, B.neck, 0]);
  J.spine = B.torso.map(([h, w, d]) => ({ c: tl([0, h, 0]), w, d, h }));
  const arms = {};
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const q = pose['a' + side];
    // abduction first (spread sideways), then flexion (swing forward/up): 'out' stays out even with the arm overhead
    const armDir = (fl, ab) => rotZ(rotX([0, -1, 0], -s * ab), fl);
    const d1 = armDir(q.fl, q.abd ?? 0);
    // shoulder girdle: the clavicle lifts as the arm goes above ~horizontal, and swings forward when it reaches
    const raise = Math.max(0, Math.min(1, (d1[1] + .25) / 1.15)), reachF = Math.max(0, d1[0]);
    const S0 = [-.05 + .07 * reachF, B.shoulderY + .2 * raise * raise, s * (B.shoulderZ + .03 * raise)];
    const E = add(S0, mul(d1, B.upper));
    const d2 = armDir(q.fl + (q.el ?? 0), (q.abd ?? 0) * .8);
    const W = add(E, mul(d2, B.fore));
    const d3 = armDir(q.fl + (q.el ?? 0) + (q.wr ?? 0), (q.abd ?? 0) * .8);
    const Hd = add(W, mul(d3, B.hand));
    arms[side] = { sh: tl(S0), el: tl(E), wr: tl(W), hand: tl(Hd), handDir: tl(d3), raise };
  }
  J.arms = arms;
  const nod = pose.nod || 0;
  J.head = add(J.neck, tl(rotZ([0, B.headUp, 0], -nod)));
  J.headRoll = -(pose.lean || 0) * .5 - nod * .6 + (pose.headTilt || 0);
  return J;
}

// ---------------- projection ----------------
export function projector(x, y, scale, yawDeg) {
  const yw = yawDeg * Math.PI / 180, sy = Math.sin(yw), cy = Math.cos(yw);
  return {
    P: p => [x + (p[0] * sy + p[2] * cy) * scale, y - p[1] * scale],
    D: p => p[0] * cy - p[2] * sy,
    sy, cy, scale, yaw: yawDeg,
  };
}

// ---------------- part builders (2D outlines) ----------------
// strip along a polyline of 2D points with half-width profile (px)
function strip(pts2, widths, capA = true, capB = true) {
  // round the joints: insert quadratic points at interior vertices
  const P = [pts2[0]]; const Wd = [widths[0]];
  for (let i = 1; i < pts2.length - 1; i++) {
    const a = pts2[i - 1], b = pts2[i], c = pts2[i + 1];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6, u0 = [lerp(a[0], b[0], .72), lerp(a[1], b[1], .72)], u1 = [lerp(b[0], c[0], .28), lerp(b[1], c[1], .28)];
      const q = [(1 - t) * (1 - t) * u0[0] + 2 * (1 - t) * t * b[0] + t * t * u1[0], (1 - t) * (1 - t) * u0[1] + 2 * (1 - t) * t * b[1] + t * t * u1[1]];
      P.push(q); Wd.push(lerp(widths[i] * 1.0, widths[i], t));
    }
  }
  P.push(pts2[pts2.length - 1]); Wd.push(widths[widths.length - 1]);
  // densify
  const Q = [], QW = [];
  for (let i = 0; i < P.length - 1; i++) {
    const n = Math.max(1, Math.ceil(Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]) / 5));
    for (let k = 0; k < n; k++) { const t = k / n; Q.push([lerp(P[i][0], P[i + 1][0], t), lerp(P[i][1], P[i + 1][1], t)]); QW.push(lerp(Wd[i], Wd[i + 1], t)); }
  }
  Q.push(P[P.length - 1]); QW.push(Wd[Wd.length - 1]);
  const Lf = [], Rt = [];
  for (let i = 0; i < Q.length; i++) {
    const a = Q[Math.max(0, i - 2)], b = Q[Math.min(Q.length - 1, i + 2)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    Lf.push([Q[i][0] - ty * QW[i], Q[i][1] + tx * QW[i]]); Rt.push([Q[i][0] + ty * QW[i], Q[i][1] - tx * QW[i]]);
  }
  const out = [];
  const cap = (c, w, a0, dir) => { for (let k = 1; k < 8; k++) { const a = a0 + dir * k / 8 * Math.PI; out.push([c[0] + Math.cos(a) * w, c[1] + Math.sin(a) * w]); } };
  out.push(...Lf);
  if (capB) { const n = Q.length - 1, a = Q[n - 1], b = Q[n]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); cap(b, QW[n], ang + Math.PI / 2, -1); }
  out.push(...Rt.reverse());
  if (capA) { const a = Q[1], b = Q[0]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); cap(b, QW[0], ang + Math.PI / 2, -1); }
  return out;
}
// width profile sampler: [[u, w], ...] → width at u
const prof = (pairs, u) => { for (let i = 1; i < pairs.length; i++) if (u <= pairs[i][0]) { const [u0, w0] = pairs[i - 1], [u1, w1] = pairs[i]; return lerp(w0, w1, (u - u0) / (u1 - u0 || 1)); } return pairs[pairs.length - 1][1]; };

// torso silhouette: front-view and side-view contours blended by yaw, rotated by the projected lean
function torsoOutline(J, pr, B, wk = 1, dk = 1, rowsIn = null, shK = null) {
  const rows = rowsIn || B.rows, f = pr.sy >= 0 ? 1 : -1, w = Math.abs(pr.sy);
  const L = [], R = [];
  const top = y => { const u = Math.max(0, Math.min(1, (y - 1.72) / .45)); return u * u * (3 - 2 * u); };
  for (const r of rows) {
    const [y, hw, fr, bk] = r;
    const kl = shK ? 1 - (1 - shK[0]) * top(y) : 1, kr = shK ? 1 - (1 - shK[1]) * top(y) : 1;
    const fl = -hw * wk * kl, frt = hw * wk * kr;        // front view: left / right edge (a raised arm slims its shoulder corner)
    const sl = (f > 0 ? bk : -fr) * dk, sr = (f > 0 ? fr : -bk) * dk;   // side view (mirrored when facing left)
    L.push([lerp(fl, sl, w), y]); R.push([lerp(frt, sr, w), y]);
  }
  const pc = pr.P([0, 0, 0]);
  const ang = Math.atan2(J.up[0] * pr.sy, J.up[1]);   // projected lean
  const c = Math.cos(ang), s = Math.sin(ang), sc = pr.scale;
  const tf = ([x, y]) => [pc[0] + (x * c + y * s) * sc, pc[1] + (x * s - y * c) * sc];
  const loopPts = [...L.map(tf), ...R.slice().reverse().map(tf)];
  return catmull(loopPts, true, 4);
}
export function torsoPoint(J, pr, xf, y, xs = null) {   // screen point on the torso: xf = x in front view, xs = x in side view (forward +)
  const f = pr.sy >= 0 ? 1 : -1, x = xs == null ? xf : lerp(xf * (pr.cy >= 0 ? 1 : -1), xs * f, Math.abs(pr.sy));
  const pc = pr.P([0, 0, 0]); const ang = Math.atan2(J.up[0] * pr.sy, J.up[1]); const c = Math.cos(ang), s = Math.sin(ang), sc = pr.scale;
  return [pc[0] + (x * c + y * s) * sc, pc[1] + (x * s - y * c) * sc];
}

function pointInPoly(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
// ---------------- hands ----------------
// wr, hd: wrist / fingertip screen points; w = palm half-width (px) already scaled by how much of the palm faces us
const HANDS = {
  relax: [[0, -.72], [.45, -.9], [.8, -.72], [1.0, -.32], [.97, .18], [.8, .52], [.62, 1.0], [.36, 1.12], [.15, .88], [0, .72]],
  fist: [[0, -.75], [.35, -.95], [.62, -.86], [.72, -.3], [.68, .45], [.52, .88], [.4, 1.05], [.15, .95], [0, .75]],
  open: [[0, -.72], [.4, -.95], [.98, -.78], [1.04, -.3], [1.0, .15], [.9, .5], [.6, .72], [.7, 1.3], [.5, 1.35], [.3, .95], [0, .72]],
  grip: [[0, -.75], [.42, -1.0], [.76, -.8], [.84, -.2], [.72, .35], [.6, .75], [.42, 1.12], [.18, 1.0], [0, .75]],
  point: [[0, -.72], [.4, -.95], [.62, -.85], [1.25, -.62], [1.27, -.38], [.66, -.3], [.62, .5], [.45, .95], [.18, .9], [0, .72]],
};
function drawHand(g, wr, hd, w, type, v, seed, flip, lw) {
  const dx = hd[0] - wr[0], dy = hd[1] - wr[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy * flip, ny = ux * flip;
  const P = (a, b) => [wr[0] + ux * a * L + nx * b * w, wr[1] + uy * a * L + ny * b * w];
  const sp = catmull((HANDS[type] || HANDS.relax).map(([a, b]) => P(a, b)), true, 5);
  form(g, sp, { v, line: lw * .9, grad: .12, hatch: 0, seed, shade: w * .5 });
  if (w > 5 && type !== 'fist') for (const b of [-.4, 0, .36]) stroke(g, [P(.52, b), P(type === 'open' ? 1.0 : .9, b * .85)], Math.max(.7, lw * .45), { seed: seed + b * 10, alpha: .8 });
  if (w > 5 && type === 'fist') for (const b of [-.45, 0, .4]) stroke(g, [P(.55, b), P(.7, b)], Math.max(.7, lw * .45), { seed: seed + b * 10, alpha: .8 });
}

// ---------------- the figure ----------------
// ch: character definition (see chars.js); opt: {x, y (pelvis screen pos), scale (px per head), yaw (deg), pose, t, props}
export function drawFigure(g, ch, opt) {
  const B = BODY[ch.body || 'adult'], pose = opt.pose, s = opt.scale;
  const J = solve(pose, B);
  // place: y given as ground → lift pelvis so the lowest sole touches it
  let px = opt.x, py = opt.y;
  if (opt.ground != null) {
    const low = Math.min(J.legs.L.sole[1], J.legs.R.sole[1], J.legs.L.toe[1], J.legs.R.toe[1], J.legs.L.heel[1], J.legs.R.heel[1]);
    py = opt.ground + low * s;
  }
  const pr = projector(px, py, s, opt.yaw ?? 90);
  const parts = [];
  const lw = Math.max(1.1, s * (ch.line ?? .028));
  const face = pr.sy >= 0 ? 1 : -1;     // screen facing sign
  // --- legs (trousers / stockings) + shoes
  for (const side of ['L', 'R']) {
    const lg = J.legs[side], dep = (pr.D(lg.hip) + pr.D(lg.knee) + pr.D(lg.ankle)) / 3;
    parts.push({ d: dep - .001, draw: () => {
      const lp = ch.leg;
      const pts = [pr.P(lg.hip), pr.P(lerp3(lg.hip, lg.knee, .5)), pr.P(lg.knee), pr.P(lerp3(lg.knee, lg.ankle, .33)), pr.P(lg.ankle)];
      const ws = [lp.w[0], lp.w[0] * .9, lp.w[1], lp.w[1] * 1.03, lp.w[2]].map(w => w * s / 2);
      const outl = strip(pts, ws, false, true);
      form(g, outl, { v: lp.v, line: lw, grad: lp.grad ?? .14, seed: side === 'L' ? 11 : 12, hatch: lp.hatch, gap: lp.gap, shade: s * .1, cyl: Math.atan2(pts[4][1] - pts[0][1], pts[4][0] - pts[0][0]) });
      // trouser crease + knee fold
      if (lp.folds && s > 30) {
        const k = pr.P(lg.knee), a = pr.P(lg.hip), b = pr.P(lg.ankle); ws[1] = ws[2];
        stroke(g, [[lerp(k[0], a[0], .18) + ws[1] * .3, lerp(k[1], a[1], .18)], [k[0] - ws[1] * .1, k[1] + ws[1] * .2], [lerp(k[0], b[0], .15) + ws[1] * .35, lerp(k[1], b[1], .15)]], lw * .55, { seed: 21 });
        stroke(g, [[lerp(a[0], k[0], .45), lerp(a[1], k[1], .45)], [lerp(a[0], k[0], .62) - ws[0] * .3, lerp(a[1], k[1], .62)]], lw * .45, { seed: 22 });
      }
      if (lp.folds && s > 30) {
        const a = pr.P(lg.hip), k = pr.P(lg.knee), b = pr.P(lg.ankle), w0 = ws[0];
        stroke(g, [[lerp(a[0], k[0], .12) + w0 * .35, lerp(a[1], k[1], .12)], [lerp(a[0], k[0], .3) - w0 * .1, lerp(a[1], k[1], .3)]], lw * .42, { seed: 23, alpha: .8 });
        stroke(g, [[lerp(k[0], b[0], .82) - ws[4] * .6, lerp(k[1], b[1], .82)], [lerp(k[0], b[0], .88), lerp(k[1], b[1], .9)], [lerp(k[0], b[0], .84) + ws[4] * .6, lerp(k[1], b[1], .86)]], lw * .45, { seed: 24, alpha: .8 });
        stroke(g, [[lerp(k[0], b[0], .92) - ws[4] * .7, lerp(k[1], b[1], .93)], [lerp(k[0], b[0], .96) + ws[4] * .5, lerp(k[1], b[1], .95)]], lw * .4, { seed: 25, alpha: .7 });
      }
      if (lp.patch && s > 30) { // flour handprint
        const m = pr.P(lerp3(lg.hip, lg.knee, .45));
        g.save(); g.fillStyle = grey(.66, .45); g.beginPath(); g.ellipse(m[0], m[1], ws[0] * .32, ws[0] * .24, .4, 0, 7); g.fill();
        g.strokeStyle = grey(.66, .4); g.lineWidth = ws[0] * .09; g.lineCap = 'round';
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(m[0] - ws[0] * .15 + k * ws[0] * .1, m[1] - ws[0] * .15); g.lineTo(m[0] - ws[0] * .2 + k * ws[0] * .14, m[1] - ws[0] * .55); g.stroke(); }
        g.restore();
      }
      // shoe
      const sh = ch.shoe, toe = pr.P(lg.toe), heel = pr.P(lg.heel), an = pr.P(lg.ankle), so = pr.P(lg.sole);
      const fwd = [toe[0] - heel[0], toe[1] - heel[1]]; const fl = Math.hypot(...fwd) || 1;
      const upv = [an[0] - so[0], an[1] - so[1]];
      const Pp = (a, b) => [heel[0] + fwd[0] * a + upv[0] * b, heel[1] + fwd[1] * a + upv[1] * b];
      let shoePts;
      if (fl < s * .25) {   // front/back view: foot foreshortened → oval
        const w = s * .22, h = s * .2; shoePts = ellipsePts(so[0], so[1] - h * .35, w, h * .6, 0, 20);
      } else shoePts = catmull([Pp(-.02, .05), Pp(.1, 1.25), Pp(.42, 1.1), Pp(.7, .75), Pp(.96, .45), Pp(1.04, .12), Pp(.95, -.08), Pp(.1, -.12)], true, 5);
      form(g, shoePts, { v: sh.v, line: lw, grad: .1, seed: 31, hatch: sh.v < .3 ? .2 : 0, shade: s * .05 });
      if (sh.v < .3 && fl >= s * .25) { const hl = [Pp(.62, .72), Pp(.86, .4)]; stroke(g, hl, lw * .7, { color: grey(.55), seed: 33 }); }
    } });
  }
  // --- torso (jacket / coat) including skirt of coat or apron
  // which character side is on screen-left in the front view: facing camera → R, back view → L
  const scrL = pr.cy >= 0 ? 'R' : 'L', scrR = scrL === 'R' ? 'L' : 'R';
  const shK = [1 - .3 * J.arms[scrL].raise, 1 - .3 * J.arms[scrR].raise];
  const torsoPoly = torsoOutline(J, pr, B, ch.torsoW ?? 1, ch.torsoD ?? 1, null, shK);
  parts.push({ d: 0, draw: () => {
    const outl = torsoPoly;
    form(g, outl, { v: ch.torso.v, line: lw, grad: ch.torso.grad ?? .16, seed: 41, hatch: ch.torso.hatch, shade: s * .13, cyl: Math.PI / 2 + Math.atan2(J.up[0] * pr.sy, J.up[1]) });
    if (ch.vest) {       // sleeveless waistcoat over the shirt: narrower at the shoulders, ends just below the waist
      const vr = B.rows.filter(r => r[0] >= ch.vest.bottom - .01).map(([y, hw, fr, bk]) => { const k = y > 1.95 ? lerp(1, ch.vest.shoulder ?? .7, Math.min(1, (y - 1.95) / .3)) : 1; return [y, hw * k * 1.02, fr * 1.03, bk * 1.03]; });
      vr.push([ch.vest.bottom - .12, B.rows[B.rows.length - 3][1] * 1.02, .38, -.34]);
      const vo = torsoOutline(J, pr, B, ch.torsoW ?? 1, ch.torsoD ?? 1, vr, shK);
      form(g, vo, { v: ch.vest.v, line: lw, grad: .18, seed: 45, shade: s * .12, cyl: Math.PI / 2 + Math.atan2(J.up[0] * pr.sy, J.up[1]), cylK: .2 });
    }
    if (ch.torsoDetail) ch.torsoDetail(g, J, pr, s, lw, face);
  } });
  // --- skirt/coat tail/apron: a sheet hanging from the waist, pushed by the forward knee, blown by flutter
  if (ch.skirt) {
    const sk = ch.skirt;
    const dep = () => { let m = -9; for (const z of [-sk.wz, sk.wz]) m = Math.max(m, pr.D([sk.fx, 0, z])); return sk.front ? m : -.2; };
    parts.push({ d: sk.front ? Math.max(dep(), .5) : -.05, draw: () => drawSkirt(g, ch, J, pr, s, lw, pose, opt.t ?? 0) });
  }
  // --- arms
  const armDep = {};
  for (const side of ['L', 'R']) { const a = J.arms[side]; armDep[side] = (pr.D(a.sh) + pr.D(a.el) * 2 + pr.D(a.wr) * 2) / 5 + (ch.armBias ?? 0); }
  // a prop held between both hands sits between the arms in depth: the near hand wraps over it, the far hand is behind it
  if (opt.props && opt.props.between) parts.push({ d: (armDep.L + armDep.R) / 2 + .001, draw: () => opt.props.between(g, J, pr, s) });
  for (const side of ['L', 'R']) {
    const a = J.arms[side];
    const dep = armDep[side];
    parts.push({ d: dep, draw: () => {
      // the arm root starts inside the torso (so there is never a gap) and carries the deltoid's mass
      const shTop = [a.sh[0] + (a.sh[0] - a.el[0]) * .12, a.sh[1] + (a.sh[1] - a.el[1]) * .12 + .04, a.sh[2] + (a.sh[2] - a.el[2]) * .12];
      const S_ = pr.P(shTop), E_ = pr.P(a.el), W_ = pr.P(a.wr), mid = (A, B2, u) => [lerp(A[0], B2[0], u), lerp(A[1], B2[1], u)];
      const pts = [S_, E_, W_];
      const ap = ch.arm, upperLen = Math.hypot(E_[0] - S_[0], E_[1] - S_[1]);
      const shP = pr.P(a.sh);
      // outline mask: skip contour points that lie over the torso close to the shoulder (that seam is what reads as a puppet joint)
      const hide = q2 => pointInPoly(q2, torsoPoly) && Math.hypot(q2[0] - shP[0], q2[1] - shP[1]) < Math.max(upperLen * .62, s * .5);
      const armForm = (outl, st) => {
        form(g, outl, { ...st, line: 0 });
        const vis = []; let run = [];
        for (const q2 of outl) { if (hide(q2)) { if (run.length > 1) vis.push(run); run = []; } else run.push(q2); }
        if (run.length > 1) vis.push(run);
        const w = (st.line ?? lw) * (IS.mode === 'tonal' ? IS.sepLine : 1), col = IS.mode === 'tonal' ? grey(Math.max(0, st.v - .45)) : undefined;
        for (const r of vis) ink(g, r, { w, closed: false, taper: .06, light: .5, seed: st.seed, color: col });
      };
      const sl = ap.sleeve ?? 1;      // 1 = full sleeve to wrist, .5 = rolled to elbow
      const w0 = ap.w[0] * s / 2, w1 = ap.w[1] * s / 2, w2 = ap.w[2] * s / 2;
      if (sl >= .99) {
        // shoulder cap → biceps → elbow → forearm swell → wrist
        const P5 = [S_, mid(S_, E_, .45), E_, mid(E_, W_, .3), W_], Wd = [w0 * 1.12, w0 * 1.04, w1 * .95, w1 * 1.04, w2];
        armForm(strip(P5, Wd, false, true), { v: ap.v, line: lw, grad: .15, seed: 51, hatch: ap.hatch, shade: s * .08, cyl: Math.atan2(W_[1] - S_[1], W_[0] - S_[0]) });
      } else {
        // bare forearm first (with the forearm muscle near the elbow), then the rolled sleeve over the upper arm
        const e = E_, w = W_, fw0 = ap.foreW[0] * s / 2, fw1 = ap.foreW[1] * s / 2;
        armForm(strip([mid(S_, e, .6), e, mid(e, w, .28), mid(e, w, .7), w], [fw0 * 1.05, fw0, fw0 * 1.1, fw0 * .9, fw1], false, true), { v: ch.skin.v, line: lw * .9, grad: .14, seed: 52, hatch: 0, shade: s * .06, cyl: Math.atan2(w[1] - e[1], w[0] - e[0]) });
        const cuff = mid(e, w, .22);
        armForm(strip([S_, mid(S_, e, .45), e, cuff], [w0 * 1.12, w0 * 1.05, w1, w1 * 1.14], false, true), { v: ap.v, line: lw, grad: .15, seed: 53, hatch: ap.hatch, shade: s * .08, cyl: Math.atan2(e[1] - S_[1], e[0] - S_[0]) });
        // sleeve folds (upper arm) + roll bands
        if (s > 30) {
          const sh0 = mid(S_, e, .12), wd = w0, dx = e[0] - sh0[0], dy = e[1] - sh0[1], L2 = Math.hypot(dx, dy) || 1, nx = -dy / L2 * wd, ny = dx / L2 * wd;
          stroke(g, [[lerp(sh0[0], e[0], .3) + nx * .3, lerp(sh0[1], e[1], .3) + ny * .3], [lerp(sh0[0], e[0], .72) + nx * .05, lerp(sh0[1], e[1], .72) + ny * .05]], lw * .5, { seed: 57, alpha: .7 });
          stroke(g, [[lerp(sh0[0], e[0], .82) - nx * .6, lerp(sh0[1], e[1], .82) - ny * .6], [lerp(sh0[0], e[0], .95) - nx * .1, lerp(sh0[1], e[1], .95) - ny * .1]], lw * .5, { seed: 58, alpha: .7 });
        }
        const cb = mid(e, w, .12), dx = w[0] - e[0], dy = w[1] - e[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * w1 * 1.1, ny = dx / L * w1 * 1.1;
        stroke(g, [[cb[0] - nx, cb[1] - ny], [cb[0] + nx, cb[1] + ny]], lw * .6, { seed: 54 });
      }
      const q = pose['a' + side];
      const edge = q.edge ?? lerp(.5, 1, Math.abs(pr.sy));
      drawHand(g, pr.P(a.wr), pr.P(a.hand), ch.handW * s / 2 * edge, q.hand || 'relax', ch.skin.v, 55 + (side === 'L' ? 1 : 0), face * (side === 'L' ? 1 : -1) * (pr.cy < -.3 ? -1 : 1), lw);
      if (opt.props && opt.props['hold' + side]) opt.props['hold' + side](g, pr.P(a.wr), pr.P(a.hand), s);
    } });
  }
  // --- neck + head
  parts.push({ d: .2 + (ch.headBias ?? 0), draw: () => {
    const n0 = pr.P(J.neck), h0 = pr.P(J.head);
    const nk = strip([n0, [lerp(n0[0], h0[0], .75), lerp(n0[1], h0[1], .75)]], [ch.neckW * s / 2, ch.neckW * s / 2 * .92], false, false);
    form(g, nk, { v: ch.skin.v - .04, line: lw * .9, grad: .18, seed: 61, hatch: 0, shade: s * .08 });
    if (ch.collar) ch.collar(g, J, pr, s, lw, face);
    const yawH = (opt.yaw ?? 90) + (pose.twist || 0) * 57.3 + (pose.headTurn || 0) * 57.3;
    const roll = J.headRoll * (pr.sy >= 0 ? 1 : -1) * Math.abs(pr.sy) + (pose.headTilt || 0) * (1 - Math.abs(pr.sy));
    drawHead(g, h0[0], h0[1], s, yawH, roll, ch.head, pose.expr || {}, lw, opt.t ?? 0);
  } });
  // --- extra props in front (e.g. the loaf held with both hands)
  if (opt.props && opt.props.front) parts.push({ d: 5, draw: () => opt.props.front(g, J, pr, s) });
  parts.sort((a, b) => a.d - b.d);
  for (const p of parts) p.draw();
  return { J, pr };
}

// hanging sheet from the waist (apron front / coat back / skirt)
function drawSkirt(g, ch, J, pr, s, lw, pose, t) {
  const sk = ch.skirt, n = 7;
  const waistH = sk.top, len = sk.len;
  const top = [], hem = [];
  const kneeL = J.legs.L.knee, kneeR = J.legs.R.knee;
  const fl = pose.flutter || 0;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), z = lerp(-sk.wz, sk.wz, u);
    const x = sk.front ? sk.fx * Math.cos((u - .5) * Math.PI * .92) : sk.fx * Math.cos((u - .5) * 2.2);   // wraps round the front (or the back)
    const tp = add([0, 0, 0], rotZ([x, waistH, z * (sk.topW ?? 1)], -(pose.lean || 0) * .6));
    let hx = x, hy = waistH - len;
    // pushed by the forward knee (front sheet) — take the max forward extent of the knees at this side
    if (sk.front) { const kn = z > 0 ? kneeL : kneeR; const kx = Math.max(kneeL[0], kneeR[0]) * .5 + kn[0] * .5; hx = Math.max(hx, kx + sk.fx * .5); }
    else { const kx = Math.min(kneeL[0], kneeR[0]); hx = Math.min(hx, kx - .15); }
    // flutter: blown backwards and up, with a travelling wave
    const wave = Math.sin(t * 17 + u * 4.2) * .12 + Math.sin(t * 29 + u * 7.1) * .05;
    hx -= fl * (sk.front ? 1.1 : 1.35) * (1 + wave);
    hy += fl * (.35 + wave * .8);
    hy += Math.sin(u * 9.3 + (sk.seed ?? 1)) * .035 + Math.sin(u * 23.1) * .012;       // uneven hem
    top.push(pr.P(tp)); hem.push(pr.P([hx, hy, z * (sk.hemW ?? 1.25)]));
  }
  const pts = [...catmull(top, false, 4), ...catmull(hem.slice().reverse(), false, 4)];
  form(g, pts, { v: sk.v, line: lw, grad: .16, seed: 71, hatch: sk.hatch, shade: s * .12, cyl: Math.PI / 2, cylK: .16 });
  if (sk.tie) {
    // waist band across the top + tie strings dangling at the back (they flutter when running)
    const bandTop = top.map(q => [q[0], q[1] - s * .05]), bandBot = top.map(q => [q[0], q[1] + s * .1]);
    form(g, [...catmull(bandTop, false, 4), ...catmull(bandBot.slice().reverse(), false, 4)], { v: sk.v - .03, line: lw * .8, grad: .1, hatch: 0, seed: 75 });
    if (Math.abs(pr.sy) > .3) {
      const back = pr.P(rotZ([-.34, waistH, 0], -(pose.lean || 0) * .6));
      for (let k = 0; k < 2; k++) {
        const pts = []; for (let j = 0; j <= 8; j++) { const u = j / 8; const lx = -u * (.25 + fl * .9) - k * .08, ly = -u * (1.0 - fl * .55) + Math.sin(t * 19 + u * 5 + k) * .06 * fl; pts.push(pr.P(rotZ([-.34 + lx, waistH + ly, 0], -(pose.lean || 0) * .6))); }
        stroke(g, pts, lw * 1.3, { seed: 76 + k });
      }
    }
  }
  // gathers at the waist: short folds fanning out below the band
  if (s > 25 && sk.gathers !== false) for (let k = 0; k < 9; k++) {
    const u = (k + .5) / 9, i0 = Math.min(n - 2, Math.floor(u * (n - 1))), fr = u * (n - 1) - i0;
    const tx = lerp(top[i0][0], top[i0 + 1][0], fr), ty = lerp(top[i0][1], top[i0 + 1][1], fr), hx2 = lerp(hem[i0][0], hem[i0 + 1][0], fr), hy2 = lerp(hem[i0][1], hem[i0 + 1][1], fr);
    const len = .18 + ((k * 37) % 7) / 7 * .22;
    stroke(g, [[lerp(tx, hx2, .04), lerp(ty, hy2, .04)], [lerp(tx, hx2, len) + ((k % 3) - 1) * s * .02, lerp(ty, hy2, len)]], lw * .42, { seed: 90 + k, alpha: .75 });
  }
  // vertical folds
  if (s > 25) for (let i = 1; i < n - 1; i += 2) stroke(g, [[lerp(top[i][0], hem[i][0], .25), lerp(top[i][1], hem[i][1], .25)], [lerp(top[i][0], hem[i][0], .95), lerp(top[i][1], hem[i][1], .95)]], lw * .45, { seed: 72 + i, alpha: .8 });
  if (sk.stripes && s > 25) for (let k = 1; k < 6; k++) { const u = k / 6; stroke(g, [[lerp(top[0][0], hem[0][0], u), lerp(top[0][1], hem[0][1], u)], [lerp(top[n - 1][0], hem[n - 1][0], u), lerp(top[n - 1][1], hem[n - 1][1], u)]], lw * 1.4, { seed: 80 + k, alpha: .5 }); }
}

// ---------------- motion helpers ----------------
// run cycle (Keaton: upright torso, big arm pump). ph in cycles.
export function runPose(ph, k = 1) {
  const a = ph * Math.PI * 2, p = P0();
  p.lean = .2 * k; p.nod = -.08; p.headTilt = 0;
  const leg = (o) => {
    const sw = Math.sin(a + o), kn = Math.max(0, Math.sin(a + o + 1.25));
    return { hip: .12 + .72 * sw * k, abd: .05, knee: (.22 + 1.45 * Math.pow(kn, 1.3)) * k, ankle: -.25 * Math.max(0, -sw) + .1 * kn };
  };
  p.L = leg(0); p.R = leg(Math.PI);
  const sw = Math.sin(a);
  p.aL = { fl: -.7 * sw * k + .1, abd: .1, el: 1.45 - .25 * sw, wr: 0, hand: 'fist' };
  p.aR = { fl: .7 * sw * k + .1, abd: .1, el: 1.45 + .25 * sw, wr: 0, hand: 'fist' };
  p.flutter = .8 * k;
  return p;
}
export const runBob = (ph, s) => -Math.abs(Math.sin(ph * Math.PI * 2)) * .12 * s;
export function walkPose(ph, k = 1) {
  const a = ph * Math.PI * 2, p = P0(), sw = Math.sin(a);
  p.lean = .03; p.L.hip = .38 * sw * k; p.R.hip = -.38 * sw * k;
  p.L.knee = .08 + .55 * Math.max(0, Math.sin(a - 1.2)) * k; p.R.knee = .08 + .55 * Math.max(0, Math.sin(a + Math.PI - 1.2)) * k;
  p.aL.fl = -.3 * sw * k; p.aR.fl = .3 * sw * k; p.aL.el = p.aR.el = .35;
  p.flutter = .15 * k;
  return p;
}
export const walkBob = (ph, s) => -Math.abs(Math.cos(ph * Math.PI * 2)) * .05 * s;
