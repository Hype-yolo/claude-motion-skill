// Heads for the silent-film rig: realistic proportions, silent-era make-up (pale skin, dark lids and lips).
// Features live on a 3D head (x forward, y down, z left; 1 = head height) and are projected with the head yaw,
// so front, 3/4, profile and back views come from the same data.
import { form, stroke, ink, wash, hatch, catmull, ellipsePts, grey, pathOf, INK, shade } from './ink.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// head spec fields: skin, jaw (0.8..1.1), chin, brow (thickness), lip (value), nose (size), hair(g,H) , hat(g,H), back(g,H), age, beard(g,H)
export function drawHead(g, cx, cy, s, yawDeg, roll, spec, ex = {}, lw = 2, t = 0) {
  const yw = yawDeg * Math.PI / 180, sy = Math.sin(yw), cyw = Math.cos(yw);
  const f = sy >= 0 ? 1 : -1, p = Math.abs(sy), front = cyw;           // front>0 facing camera, <0 back of head
  const sc = s * (spec.scale ?? 1);
  g.save(); g.translate(cx, cy); g.rotate(roll || 0);
  // projection of a head-local 3D point (x fwd, y down, z left) → 2D (px)
  const P = (x, y, z) => [(x * sy + z * cyw) * sc, y * sc];
  const D = (x, z) => x * cyw - z * sy;                                 // depth (+ = toward camera)
  const H = { P, D, f, p, front, sc, sy, cy: cyw, lw, spec, ex, t };
  const jaw = spec.jaw ?? 1, skin = spec.skin ?? .78;
  if (spec.hatBack) spec.hatBack(g, H);
  if (spec.hairBack) spec.hairBack(g, H);
  // ---- silhouette ----
  const outline = headOutline(H, jaw, spec); H.outline = outline;
  form(g, outline, { v: skin, line: lw, grad: .2, hatch: 0, seed: 101, lineLight: .5 });
  // form shadow: crescent on the side away from the light + a soft shadow under the brow line
  shade(g, outline, { off: sc * .085, a: .17, hatch: 0, seed: 102, soft: sc * .03 });
  if (spec.hairMass) hairMass(g, H, outline, spec.hairMass);
  if (front > -.25) face(g, H, spec, ex);
  // ear (on the visible side)
  const ez = -f * .41 * Math.sign(cyw || 1);
  if (p > .35) {
    const zE = f > 0 ? -.4 : .4;          // the ear facing the camera
    const e = P(-.03, .04, zE);
    if (D(-.03, zE) > -.05 || p > .8) {
      const ew = .085 * sc * Math.max(.35, p), eh = .19 * sc;
      const ept = catmull([[e[0] - ew * .7, e[1] - eh * .5], [e[0] + ew * .6, e[1] - eh * .55], [e[0] + ew * .9, e[1] - eh * .1], [e[0] + ew * .5, e[1] + eh * .45], [e[0] - ew * .2, e[1] + eh * .5], [e[0] - ew * .6, e[1] + eh * .1]], true, 5);
      form(g, ept, { v: skin - .05, line: lw * .8, grad: .1, hatch: 0, seed: 111 });
      stroke(g, [[e[0] - ew * .1, e[1] - eh * .3], [e[0] + ew * .4, e[1] - eh * .15], [e[0] + ew * .3, e[1] + eh * .2], [e[0], e[1] + eh * .28]], lw * .5, { seed: 112 });
    }
  }
  if (spec.hair) spec.hair(g, H);
  if (spec.beard) spec.beard(g, H);
  if (spec.hat) spec.hat(g, H);
  g.restore();
}

// outline: front contour and profile contour (same point count, crown first, clockwise) blended by yaw
export const FRONT_ADULT = [[0, -.5], [.18, -.47], [.29, -.38], [.335, -.24], [.35, -.12], [.357, -.02], [.365, .06], [.362, .12], [.35, .17], [.338, .21], [.326, .25],
  [.314, .29], [.305, .33], [.285, .37], [.24, .42], [.17, .47], [.09, .5], [0, .51], [-.09, .5], [-.17, .47], [-.25, .4], [-.3, .34], [-.325, .24], [-.358, .12],
  [-.36, .0], [-.345, -.2], [-.29, -.36], [-.17, -.47]];
export const PROFILE_ADULT = [[0, -.5], [.2, -.47], [.33, -.36], [.39, -.2], [.41, -.06], [.39, .02], [.43, .08], [.495, .17], [.455, .21], [.41, .23], [.42, .28],
  [.405, .32], [.415, .35], [.37, .39], [.39, .45], [.35, .49], [.26, .52], [.12, .5], [-.02, .45], [-.12, .37], [-.22, .3], [-.34, .22], [-.46, .06], [-.5, -.1],
  [-.47, -.28], [-.38, -.41], [-.24, -.48], [-.12, -.5]];
export const FRONT_CHILD = FRONT_ADULT.map(([x, y]) => [x * (y > .1 ? 1.06 : 1.04), y]);
export const PROFILE_CHILD = [[0, -.5], [.22, -.47], [.35, -.36], [.41, -.2], [.42, -.06], [.4, .02], [.42, .08], [.455, .15], [.43, .19], [.4, .21], [.405, .26],
  [.395, .3], [.4, .33], [.37, .37], [.38, .43], [.34, .47], [.26, .5], [.12, .49], [-.02, .44], [-.12, .36], [-.22, .3], [-.36, .22], [-.48, .06], [-.52, -.1],
  [-.49, -.3], [-.4, -.42], [-.25, -.49], [-.12, -.5]];
// short hair: the head silhouette clipped to (behind the ear line & above the nape) ∪ (above the hairline) ∪ temples
function hairMass(g, H, outline, hm) {
  const { f, p, sc, front } = H;
  const top = (hm.top ?? -.27) * sc, nape = (hm.nape ?? .24) * sc;
  g.save(); pathOf(g, outline); g.clip();
  g.beginPath();
  // region above the hairline: a gentle arc, lower at the temples
  const n = 24;
  for (let i = 0; i <= n; i++) { const u = i / n * 2 - 1, x = u * .6 * sc, y = top + Math.pow(Math.abs(u), 2.2) * (hm.temple ?? .2) * sc * (1 - p * .6) + (hm.fringe ? Math.sin(u * 9) * .012 * sc : 0); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.lineTo(.6 * sc, -sc); g.lineTo(-.6 * sc, -sc); g.closePath();
  if (front < 0) { g.rect(-sc, -sc, 2 * sc, sc + nape); }               // back view: all hair down to the nape
  else if (p > .25) {                                                     // behind the ear line (profile / 3q)
    const ex = (-.03 * H.sy + (f > 0 ? -.4 : .4) * H.cy) * sc;           // ear screen x
    const bx = ex - f * .03 * sc;
    g.moveTo(bx, -sc); g.lineTo(bx + f * .02 * sc, -.05 * sc); g.quadraticCurveTo(bx - f * .02 * sc, nape * .7, bx - f * .1 * sc, nape);
    g.lineTo(-f * sc, nape + .05 * sc); g.lineTo(-f * sc, -sc); g.closePath();
  }
  g.clip(); g.fillStyle = grey(hm.v ?? .13); g.fillRect(-sc, -sc, 2 * sc, 2 * sc);
  // combed strands
  g.strokeStyle = grey((hm.v ?? .13) + .28); g.lineWidth = Math.max(.7, sc * .006); g.lineCap = 'round';
  for (let i = 0; i < 14; i++) { const a = i / 14; const x0 = (a - .5) * .9 * sc, y0 = -.5 * sc; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 - f * .12 * sc, y0 + .3 * sc, x0 - f * .2 * sc + (a - .5) * .1 * sc, nape * .9); g.stroke(); }
  g.restore();
}
// 3D-ish outline: every height row is an egg-shaped cross-section (width from the front contour, front/back depth from
// the profile contour); projected with the yaw, the extremes give the silhouette. The nose bump is added where it sticks out.
function edgeAt(pts, y, side) {        // x of a contour at height y on one side (side>0: x>=0 half, side<0: x<0 half)
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
    const t = (y - a[1]) / (b[1] - a[1]), x = a[0] + (b[0] - a[0]) * t;
    if (side > 0 ? x >= -.02 : x <= .02) if (best == null || (side > 0 ? x > best : x < best)) best = x;
  }
  return best;
}
function headOutline(H, jaw, spec) {
  const { sy, cy, sc } = H;
  const Fr = spec.front || FRONT_ADULT, Pr = spec.profile || PROFILE_ADULT, jw = spec.jaw ?? 1;
  const R = [], L = [];
  const ys = []; for (let y = -.5; y <= .52; y += .03) ys.push(Math.min(y, .515));
  for (const y of ys) {
    const yy = Math.max(-.498, Math.min(.508, y));
    let w = edgeAt(Fr, yy, 1) ?? 0; if (yy > .15) w *= jw;
    let fd = edgeAt(Pr, yy, 1) ?? 0, bd = -(edgeAt(Pr, yy, -1) ?? 0);
    if (yy > -.02 && yy < .235) fd = Math.min(fd, .405 + (yy - .02) * .02);   // nose handled separately
    let mx = -9, mn = 9;
    for (let k = 0; k <= 32; k++) {
      const th = k / 32 * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const x = c >= 0 ? fd * c : bd * c, z = w * sn;
      const X = x * sy + z * cy;
      if (X > mx) mx = X; if (X < mn) mn = X;
    }
    if (yy > -.02 && yy < .235) {           // nose protrusion (z = 0 profile of the nose)
      const nx = (edgeAt(Pr, yy, 1) ?? fd) * (spec.nose ?? 1), X = nx * sy;
      if (X > mx) mx = X; if (X < mn) mn = X;
    }
    R.push([mx * sc, y * sc]); L.push([mn * sc, y * sc]);
  }
  return catmull([...R, ...L.reverse()], true, 2);
}
function sampleLoop(pts, u) {
  // arc-length-free param: index based (points are roughly evenly spread)
  const n = pts.length, x = u * n, i = Math.floor(x) % n, t = x - Math.floor(x), a = pts[i], b = pts[(i + 1) % n];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

// ---- features ----
// region hatching (for small shadow shapes on the face): parallel lines clipped to pts
function hatchArea(g, pts, ang, gap, w, alpha, seed = 1) {
  if (alpha <= .02) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0) / 2 + 2, c = Math.cos(ang), s = Math.sin(ang);
  g.save(); pathOf(g, pts); g.clip(); g.strokeStyle = `rgba(21,18,15,${alpha})`; g.lineWidth = w; g.lineCap = 'round'; g.beginPath();
  for (let d = -r, i = 0; d <= r; d += gap, i++) { const j = (Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453 % 1) * gap * .3; const px = cx - s * (d + j), py = cy + c * (d + j); g.moveTo(px - c * r, py - s * r); g.lineTo(px + c * r, py + s * r); }
  g.stroke(); g.restore();
}
function softSpot(g, x, y, rx, ry, a, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, `rgba(28,22,18,${a})`); gr.addColorStop(1, 'rgba(28,22,18,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore();
}
function face(g, H, spec, ex) {
  const { P, D, f, p, front, sc, lw } = H;
  const eyeY = spec.eyeY ?? .045, eyeZ = spec.eyeZ ?? .155, eyeX = .35;
  const look = ex.look ?? [0, 0], open = ex.open ?? .85, brow = ex.brow ?? 0, browA = ex.browA ?? 0;
  const prof = p > .86;
  const hw = Math.max(.6, lw * .45);                       // hatch line width
  const sideSign = f;                                       // the shadow side is the one turned away from the upper-left light
  // ---------- nose shadow (3/4 & front): a hatched plane on the shadow side of the bridge ----------
  const ns = spec.nose ?? 1;
  if (!prof) {
    const s2 = f >= 0 ? 1 : -1;     // shadow side of the nose (away from the light, which is upper-left)
    const top = P(.4, eyeY + .03, -s2 * .015), tip = P(.48 * ns, .175, -s2 * .01), wing = P(.42, .215, -s2 * .06), mid = P(.43, .12, -s2 * .045);
    const plane = catmull([top, mid, [wing[0], wing[1]], [tip[0], tip[1] + .02 * sc], [tip[0], tip[1] - .02 * sc], [lerp(top[0], tip[0], .5), lerp(top[1], tip[1], .5)]], true, 4);
    g.fillStyle = 'rgba(28,22,18,.1)'; pathOf(g, plane); g.fill();
  }
  // ---------- key-light shadow shapes (crisp, so the Redraw posterises them into clean hatched planes) ----------
  // light comes from screen-left and above → the character's LEFT side (z > 0) of the face is the shadow side
  {
    const Sd = (x, y, z) => P(x, y, z);
    const term = [[.3, -.38, .25], [.36, -.14, .23], [.35, .06, .27], [.36, .18, .22], [.37, .3, .16], [.34, .42, .1], [.24, .5, .06]];
    const back = [[.05, .48, .3], [-.08, .3, .37], [-.06, .0, .38], [.05, -.25, .36], [.15, -.42, .28]];
    const poly = [...term, ...back].map(q => Sd(...q));
    if (!prof || f < 0) {
      g.save(); pathOf(g, H.outline); g.clip();
      g.fillStyle = `rgba(26,21,17,${.26 * (spec.shadowK ?? 1)})`; pathOf(g, catmull(poly, true, 3)); g.fill();
      g.restore();
    }
    // nose cast shadow (falls down-right) + the shadow under the lower lip + under the brow ridge
    if (!prof) {
      const ns = spec.nose ?? 1;
      g.fillStyle = 'rgba(26,21,17,.28)'; pathOf(g, catmull([Sd(.46 * ns, .2, .01), Sd(.43, .238, .02), Sd(.415, .232, .075), Sd(.44, .205, .05)], true, 3)); g.fill();
      g.fillStyle = 'rgba(26,21,17,.22)'; pathOf(g, catmull([Sd(.41, .352, -.06), Sd(.41, .352, .07), Sd(.39, .39, .05), Sd(.39, .39, -.04)], true, 3)); g.fill();
    }
    for (const zs of [1, -1]) {      // brow-ridge shadow over each eye (make-up + top light)
      const z = zs * (spec.eyeZ ?? .155); if (D(.36, z) < -.03 || (prof && (-z * f) < 0)) continue;
      const pts = [Sd(.37, .0, z - zs * .08), Sd(.4, -.02, z), Sd(.36, .0, z + zs * .09), Sd(.35, .045, z + zs * .07), Sd(.37, .03, z - zs * .07)];
      g.fillStyle = `rgba(26,21,17,${.3 * (spec.makeup ?? 1)})`; pathOf(g, catmull(pts, true, 3)); g.fill();
    }
  }
  // ---------- eyes ----------
  for (const zs of [1, -1]) {
    const z = zs * eyeZ, d = D(eyeX, z);
    if (prof && (-z * f) < 0) continue;
    if (d < -.05) continue;
    const c = P(eyeX, eyeY, z);
    const vis = Math.max(.25, Math.min(1, (d + .08) * 4));
    const squash = prof ? .5 : Math.max(.3, 1 - p * .5) * vis;
    const ew = .09 * sc * squash, eh = .036 * sc * (spec.eyeH ?? 1);
    const wink = ex.wink && ((ex.wink > 0) === (zs > 0)) ? Math.max(0, Math.min(1, ex.winkAmt ?? 1)) : 0;
    const k = open * (1 - wink);
    const ix = c[0] + look[0] * ew * .45 + (prof ? f * ew * .35 : f * p * ew * .3), iy = c[1] + look[1] * eh * .35;
    if (prof) {
      const tip = [c[0] - f * ew * 1.15, c[1] + eh * .1], up = [c[0] + f * ew * .8, c[1] - eh * 1.2 * Math.max(.2, k)], lo = [c[0] + f * ew * .75, c[1] + eh * .85];
      if (k > .15) {
        g.save(); pathOf(g, [tip, up, [c[0] + f * ew * .95, c[1]], lo]); g.fillStyle = grey(.9); g.fill(); g.clip();
        g.fillStyle = grey(.18); g.beginPath(); g.ellipse(ix, iy, ew * .4, eh * 1.0, 0, 0, 7); g.fill(); g.restore();
      }
      ink(g, [tip, [lerp(tip[0], up[0], .5), c[1] - eh * 1.3 * Math.max(.2, k)], up, [up[0] + f * ew * .2, up[1] + eh * .2]], { w: lw * 1.2, closed: false, taper: .3, light: 0, seed: 121 });
      stroke(g, [tip, lo], lw * .45, { seed: 122 });
      stroke(g, [[tip[0] + f * ew * .1, c[1] - eh * 1.9], [c[0] + f * ew * .6, c[1] - eh * 2.1]], lw * .4, { seed: 123, alpha: .7 });   // lid crease
      continue;
    }
    // front / 3q eye
    const upA = [c[0] - ew, c[1] + eh * .15], upB = [c[0] - ew * .35, c[1] - eh * 1.15 * k], upC = [c[0] + ew * .4, c[1] - eh * 1.1 * k], upD = [c[0] + ew, c[1] - eh * .05];
    const loB = [c[0] + ew * .4, c[1] + eh * .75], loC = [c[0] - ew * .45, c[1] + eh * .72];
    if (k > .1) {
      const almond = catmull([upA, upB, upC, upD, loB, loC], true, 5);
      g.save(); pathOf(g, almond); g.fillStyle = grey(.9); g.fill(); g.clip();
      g.fillStyle = grey(.3); g.beginPath(); g.arc(ix, iy, eh * 1.0, 0, 7); g.fill();          // iris
      g.fillStyle = INK; g.beginPath(); g.arc(ix, iy, eh * .48, 0, 7); g.fill();                 // pupil
      // upper lid shadow over the eyeball (heavy-lidded deadpan)
      g.fillStyle = 'rgba(20,16,12,.18)'; g.beginPath(); g.ellipse(c[0], c[1] - eh * 1.3 * k, ew * 1.1, eh * .55, 0, 0, 7); g.fill();
      g.fillStyle = grey(.97); g.beginPath(); g.arc(ix - eh * .38, iy - eh * .35, eh * .2, 0, 7); g.fill();   // catch-light
      g.restore();
      ink(g, catmull([upA, upB, upC, upD], false, 6), { w: lw * 1.45, closed: false, taper: .22, light: 0, seed: 124 + zs });   // lash line
      stroke(g, catmull([upD, loB, loC, [upA[0] + ew * .1, upA[1]]], false, 5), lw * .4, { seed: 126 + zs, alpha: .75, dry: .4 });
      // lid crease + under-eye
      stroke(g, catmull([[c[0] - ew * .85, c[1] - eh * 1.2], [c[0] - ew * .1, c[1] - eh * 2.05 + brow * eh * .3], [c[0] + ew * .8, c[1] - eh * 1.55]], false, 5), lw * .5, { seed: 128 + zs, alpha: .75 });
      stroke(g, [[c[0] - ew * .5, c[1] + eh * 1.55], [c[0] + ew * .45, c[1] + eh * 1.4]], lw * .35, { seed: 130 + zs, alpha: .45 });
      // inner corner
      const inner = zs > 0 ? upA : upD; stroke(g, [[inner[0], inner[1]], [inner[0] + (zs > 0 ? -1 : 1) * ew * .18, inner[1] + eh * .3]], lw * .5, { seed: 132 + zs });
    } else {
      const sm = wink ? 1 : .35;
      ink(g, catmull([[c[0] - ew, c[1] - eh * .1], [c[0], c[1] + eh * .55 * sm], [c[0] + ew, c[1] - eh * .1]], false, 5), { w: lw * 1.4, closed: false, taper: .3, light: 0, seed: 133 });
      stroke(g, catmull([[c[0] - ew * .8, c[1] - eh * 1.1], [c[0], c[1] - eh * 1.4], [c[0] + ew * .8, c[1] - eh * 1.0]], false, 4), lw * .45, { seed: 134, alpha: .6 });
      if (wink) { stroke(g, [[c[0] - ew * .7, c[1] + eh * 1.5], [c[0] + ew * .5, c[1] + eh * 1.9]], lw * .5, { seed: 135, alpha: .7 }); stroke(g, [[c[0] - ew * .4, c[1] + eh * 2.2], [c[0] + ew * .6, c[1] + eh * 2.4]], lw * .4, { seed: 136, alpha: .5 }); }
    }
  }
  // ---------- brows ----------
  for (const zs of [1, -1]) {
    const z = zs * (eyeZ + .005), d = D(.39, z);
    if ((prof && (-z * f) < 0) || d < -.06) continue;
    const vis = Math.max(.5, Math.min(1, (d + .1) * 3));
    const inner = P(.405, eyeY - .085 - brow * .04 + browA * .035, z * .4), mid = P(.41, eyeY - .115 - brow * .045, z * .95), outer = P(.37, eyeY - .1 - brow * .035 - browA * .02, z * 1.45);
    const bw = lw * (spec.brow ?? 1.8) * vis * .8;
    ink(g, catmull(prof ? [[inner[0] + f * .012 * sc, inner[1] + .005 * sc], mid, outer] : [inner, mid, outer], false, 6), { w: bw, closed: false, taper: .5, light: 0, seed: 137 + zs, dry: .25 });
    // brow hairs
    for (let i = 0; i < 4; i++) { const u = (i + .5) / 4, q = [lerp(inner[0], outer[0], u), lerp(inner[1], outer[1], u) - Math.sin(u * Math.PI) * .012 * sc]; stroke(g, [[q[0] - .012 * sc * zs * f, q[1] + .006 * sc], [q[0] + .01 * sc * zs * f, q[1] - .008 * sc]], lw * .35, { seed: 139 + i + zs, alpha: .7 }); }
  }
  // ---------- nose lines ----------
  if (!prof) {
    const s2 = f >= 0 ? 1 : -1;
    const tip = P(.48 * ns, .18, 0), wL = P(.415, .21, .07), wR = P(.415, .21, -.07), base = P(.43, .228, 0);
    const bridge = P(.42, .09, -s2 * .035);
    stroke(g, catmull([P(.4, eyeY + .02, -s2 * .03), bridge, [lerp(bridge[0], tip[0], .7) - s2 * .005 * sc, lerp(bridge[1], tip[1], .7)]], false, 4), lw * .6, { seed: 141, alpha: .85 });
    // nostrils + the soft underside of the tip (no wing outlines: they read as brackets)
    for (const sg of [1, -1]) {
      if (D(.415, sg * .07) < -.08) continue;
      const nn = P(.43, .222, sg * .038);
      g.fillStyle = grey(.22); g.beginPath(); g.ellipse(nn[0], nn[1], .017 * sc * (1 - p * .4), .008 * sc, sg * .25, 0, 7); g.fill();
    }
    const wS = P(.42, .205, -s2 * .07);
    stroke(g, catmull([[wS[0], wS[1] - .03 * sc], [wS[0] - s2 * .012 * sc, wS[1] - .004 * sc], [wS[0] + s2 * .01 * sc, wS[1] + .016 * sc]], false, 4), lw * .6, { seed: 144, alpha: .8 });
    stroke(g, catmull([[tip[0] - .03 * sc, tip[1] + .03 * sc], [tip[0], tip[1] + .045 * sc], [tip[0] + .03 * sc, tip[1] + .03 * sc]], false, 4), lw * .5, { seed: 145, alpha: .55 });
  } else {
    const n = P(.43, .2, 0); stroke(g, catmull([[n[0] - f * .025 * sc, n[1] - .018 * sc], [n[0] - f * .005 * sc, n[1] + .004 * sc], [n[0] + f * .012 * sc, n[1] + .012 * sc]], false, 4), lw * .65, { seed: 146 });
    g.fillStyle = grey(.2); g.beginPath(); g.ellipse(n[0] + f * .005 * sc, n[1] + .014 * sc, .016 * sc, .006 * sc, 0, 0, 7); g.fill();
  }
  // ---------- mouth (dark make-up lips) ----------
  const mw = (ex.mouthW ?? 1) * .115, curve = ex.smile ?? 0, om = ex.mouthOpen ?? 0, lipV = (spec.lip ?? .36) - .06;
  if (prof) {
    const corner = P(.355, 0.332 - curve * .022, f > 0 ? -mw : mw);
    const ul = P(.42, 0.275, 0), ulm = P(.415, 0.300, 0), st = P(.4, 0.318 + om * .02, 0), ll = P(.415, 0.345 + om * .03, 0), llb = P(.39, 0.370 + om * .03, 0);
    g.fillStyle = grey(lipV); pathOf(g, catmull([corner, ul, ulm, st], true, 3)); g.fill();
    g.fillStyle = grey(lipV + .14); pathOf(g, catmull([corner, st, ll, llb], true, 3)); g.fill();
    ink(g, [corner, [lerp(corner[0], st[0], .6), st[1] + .003 * sc], st], { w: lw * .9, closed: false, taper: .3, light: 0, seed: 151 });
    if (curve > .2) stroke(g, [[corner[0] - f * .01 * sc, corner[1] - .03 * sc], [corner[0] - f * .025 * sc, corner[1] + .005 * sc]], lw * .4, { seed: 152, alpha: .6 });
    const chin = P(.37, 0.410, 0); softSpot(g, chin[0], chin[1], .035 * sc, .02 * sc, .25);
  } else {
    const L = P(.365, 0.332 - curve * .028, mw), R = P(.365, 0.332 - curve * .028, -mw);
    const cL = P(.415, 0.308, mw * .38), cR = P(.415, 0.308, -mw * .38), cm = P(.42, 0.316, 0);
    const st = P(.415, 0.328 + om * .015 - curve * .004, 0), low = P(.415, 0.362 + om * .045, 0);
    g.fillStyle = grey(lipV); pathOf(g, catmull([L, cL, cm, cR, R, st], true, 4)); g.fill();                                   // upper lip
    g.fillStyle = grey(lipV + .15); pathOf(g, catmull([L, st, R, [low[0] + (R[0] - L[0]) * .2, low[1] - .006 * sc], low, [low[0] - (R[0] - L[0]) * .2, low[1] - .006 * sc]], true, 4)); g.fill();   // lower lip
    g.fillStyle = grey(.95, .5); g.beginPath(); g.ellipse(low[0] - (R[0] - L[0]) * .05, low[1] - .014 * sc, Math.abs(R[0] - L[0]) * .16 + .5, .006 * sc, 0, 0, 7); g.fill();   // lip highlight
    if (om > .2) { g.fillStyle = INK; pathOf(g, catmull([L, [st[0], st[1] - .01 * sc], R, [st[0], st[1] + om * .04 * sc]], true, 4)); g.fill(); }
    ink(g, catmull([L, [lerp(L[0], st[0], .5), st[1] + .004 * sc - curve * .006 * sc], st, [lerp(st[0], R[0], .5), st[1] + .004 * sc - curve * .006 * sc], R], false, 4), { w: lw * .85, closed: false, taper: .35, light: 0, seed: 155 });
    // corners + shadow under the lower lip
    for (const [m, sg] of [[L, 1], [R, -1]]) stroke(g, [[m[0] + sg * .006 * sc, m[1] - .01 * sc], [m[0] - sg * .004 * sc, m[1] + .012 * sc]], lw * .45, { seed: 156 + sg, alpha: .7 });
    const ch = P(.39, 0.400, 0); softSpot(g, ch[0], ch[1], .05 * sc, .018 * sc, .28);
    // nasolabial hints
    if (curve > .15 || (spec.age ?? 0) > .5) for (const sg of [1, -1]) { const a = P(.4, 0.220, sg * .09), b = P(.36, 0.340, sg * .13); if (D(.38, sg * .11) > -.05) stroke(g, [a, [lerp(a[0], b[0], .5) + sg * .004 * sc, lerp(a[1], b[1], .5)], b], lw * .4, { seed: 158 + sg, alpha: .55 * Math.max(curve, .5) }); }
  }
  // ---------- jaw shadow line (3q / profile): a hatched strip under the jaw ----------
  if (p > .3) {
    const j0 = P(-.06, .38, f > 0 ? -.33 : .33), j1 = P(.18, .49, 0), j2 = P(.3, .515, 0);
    g.fillStyle = 'rgba(28,22,18,.12)'; pathOf(g, catmull([j0, j1, j2, [j2[0], j2[1] + .05 * sc], [j0[0], j0[1] + .07 * sc]], true, 3)); g.fill();
  }
}
