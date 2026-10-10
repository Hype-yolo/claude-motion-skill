// Characters v2 — Art Deco figure language (Cassandre / Erté / Lempicka): elongated streamlined bodies, small egg heads,
// faceted lacquer volumes (hard terminator between a lit plane and a shadow plane, airbrushed inside each plane),
// thin gold rim on the lit edge, geometric faces (almond or arc eyes, one-stroke nose, small bow mouth).
// Rig: FK skeleton, hip at (0,0), y down; limb angle 0 = pointing down, + = swings forward (toward facing direction).
import { C, TAU, clamp, lerp, mix, goldGrad, gline, toPath } from './engine/deco.js';

export const PIP_H = 148;       // units from cap top to sole (hip at 0, sole at +67)
export const PIP_SOLE = 67;
export const PIP_M = 1.55;      // metres (for sizing in perspective scenes: s = scaleAt * PIP_M / PIP_H)
const LIGHT = [-.6, -.8];       // world light: from upper-left

const STY = {
  pip: {
    jacket: '#8e1b2e', jacketL: '#d4485c', jacketD: '#35060f', pants: '#2b2233', pantsL: '#6b5880', pantsD: '#0c090f',
    skin: '#eab88c', skinL: '#ffe0bd', skinD: '#a8684a', hair: '#0b0807', hairL: '#2c211b', glove: '#f4ecdc', gloveD: '#b09c7c',
    shoe: '#120d0a', trim: true, cap: true, strap: true, buttons: 'v', tails: 0, bow: false, mustache: false,
    sh: 12.5, waist: 5.8, thigh: 33, shin: 32, uarm: 26, farm: 23, neck: 6,
  },
  conductor: {
    jacket: '#efe6d2', jacketL: '#ffffff', jacketD: '#9a8d74', pants: '#18141a', pantsL: '#4a4250', pantsD: '#050405',
    skin: '#e3ae86', skinL: '#fbd6b2', skinD: '#9a5e42', hair: '#e9e4da', hairL: '#ffffff', glove: '#f4ecdc', gloveD: '#b09c7c',
    shoe: '#0c0a08', trim: true, cap: false, strap: false, buttons: 'pair', tails: 1, bow: true, mustache: true,
    sh: 13, waist: 6.6, thigh: 31, shin: 30, uarm: 25.5, farm: 23, neck: 6.5, older: true,
  },
  waiter: {
    jacket: '#f0e8d6', jacketL: '#ffffff', jacketD: '#a09378', pants: '#15121a', pantsL: '#433a4c', pantsD: '#050405',
    skin: '#dca57c', skinL: '#f5cfa9', skinD: '#935a3e', hair: '#0d0908', hairL: '#4a3528', glove: '#f4ecdc', gloveD: '#b09c7c',
    shoe: '#0c0a08', trim: true, cap: false, strap: false, buttons: 'single', tails: 0, bow: true, mustache: false,
    sh: 12.5, waist: 6.2, thigh: 30, shin: 29, uarm: 24.5, farm: 22, neck: 6,
  },
};
export { STY };

// ---------- geometry ----------
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
function capsulePath(x0, y0, r0, x1, y1, r1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || .001, a = Math.atan2(dy, dx);
  const s = clamp((r0 - r1) / L, -.99, .99), b = Math.acos(s);
  const p = new Path2D(); p.arc(x0, y0, r0, a + b, a - b + TAU, false); p.arc(x1, y1, r1, a - b, a + b, false); p.closePath(); return p;
}
function smoothPath(pts, closed = true) {
  const p = new Path2D(), n = pts.length, P = i => pts[closed ? (i + n) % n : clamp(i, 0, n - 1)];
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2); p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); }
  if (closed) p.closePath(); return p;
}
function bbox(pts) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; }
function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }

// Faceted fill: whole shape in the shadow plane, then the lit plane (half-plane on the light side of the split line) on top — hard terminator.
// split: [[ax,ay],[bx,by]] line; L: light dir in local coords.
function facet(g, path, bb, split, base, light, dark, L, rim = 1, rimCol = 'rgba(243,217,139,.85)') {
  const [x0, y0, x1, y1] = bb, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) * .6;
  g.fillStyle = lin(g, cx + L[0] * R, cy + L[1] * R, cx - L[0] * R, cy - L[1] * R, [[0, base], [.55, mix(base, dark, .55)], [1, dark]]); g.fill(path);
  if (split) {
    const [[ax, ay], [bx, by]] = split, dx = bx - ax, dy = by - ay; let nx = -dy, ny = dx; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    if (nx * L[0] + ny * L[1] < 0) { nx = -nx; ny = -ny; }
    const E = 400; g.save(); g.clip(path);
    g.beginPath(); g.moveTo(ax - dx * E, ay - dy * E); g.lineTo(bx + dx * E, by + dy * E); g.lineTo(bx + dx * E + nx * E, by + dy * E + ny * E); g.lineTo(ax - dx * E + nx * E, ay - dy * E + ny * E); g.closePath();
    g.fillStyle = lin(g, cx + L[0] * R, cy + L[1] * R, cx, cy, [[0, light], [1, base]]); g.fill();
    g.restore();
  }
  if (rim) { g.save(); g.clip(path); g.translate(-L[0] * 1.1, -L[1] * 1.1); g.strokeStyle = rimCol; g.lineWidth = rim; g.stroke(path); g.restore(); }
}
function limb(g, x0, y0, r0, x1, y1, r1, base, light, dark, L, rim = 1) {
  const p = capsulePath(x0, y0, r0, x1, y1, r1);
  // split along the limb axis, nudged toward the shadow side so the lit plane is ~55%
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1; let nx = -dy / l, ny = dx / l; if (nx * L[0] + ny * L[1] < 0) { nx = -nx; ny = -ny; }
  const k = -Math.min(r0, r1) * .18;
  facet(g, p, [Math.min(x0, x1) - r0, Math.min(y0, y1) - r0, Math.max(x0, x1) + r0, Math.max(y0, y1) + r0], [[x0 + nx * k, y0 + ny * k], [x1 + nx * k, y1 + ny * k]], base, light, dark, L, rim);
  return p;
}

// ---------- faces ----------
export const FACES = {
  neutral: { open: .8, lid: .3, look: [0, 0], brow: 0, browAng: 0, mouth: 'bow' },
  panic: { open: 1.4, lid: 0, pupil: .3, look: [0, 0], brow: -1.8, browAng: -.35, mouth: 'o', mOpen: .8 },
  worry: { open: .95, lid: .1, look: [-.5, .1], brow: -1, browAng: -.4, mouth: 'down' },
  determined: { open: .62, lid: .6, look: [.5, 0], brow: .7, browAng: .38, mouth: 'line' },
  calm: { open: 0, arc: 'down', brow: -.8, browAng: -.05, mouth: 'smile' },
  effort: { open: .22, lid: .8, brow: .9, browAng: .45, mouth: 'grit', mOpen: .6 },
  awe: { open: 1.1, lid: 0, look: [0, -.7], brow: -1.6, browAng: -.15, mouth: 'o', mOpen: .45 },
  joy: { open: 0, arc: 'up', brow: -1.3, browAng: -.1, mouth: 'grin', mOpen: .7 },
  shout: { open: 1.05, lid: .1, look: [.3, .2], brow: -.8, browAng: .1, mouth: 'o', mOpen: 1 },
};
const faceP = f => typeof f === 'string' ? { ...FACES.neutral, ...FACES[f] } : { ...FACES.neutral, ...(f || {}) };

const INK = '#1a0f0c';
function eyeAlmond(g, x, y, w, F, sq = 1, flip = 1, blink = 0) {
  const open = (F.open ?? .8) * (1 - blink);
  g.save(); g.translate(x, y); g.scale(sq * flip, 1);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (open <= .05) {             // closed: a single arc (serene 'down' or smiling 'up')
    const up = F.arc === 'up';
    g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(0, up ? -w * .75 : w * .55, w, up ? 0 : -.2);
    g.strokeStyle = INK; g.lineWidth = .62; g.stroke();
    // long lash flick at outer corner (deco)
    g.restore(); return;
  }
  const h = w * .52 * open;
  const al = new Path2D(); al.moveTo(-w, .1); al.bezierCurveTo(-w * .45, -h * 1.25, w * .45, -h * 1.25, w, -.15); al.bezierCurveTo(w * .45, h * .85, -w * .45, h * .85, -w, .1); al.closePath();
  g.fillStyle = '#f6efe2'; g.fill(al);
  g.save(); g.clip(al);
  const pr = w * (F.pupil ?? .5) * .75 + w * .12, px = (F.look?.[0] || 0) * w * .45, py = (F.look?.[1] || 0) * h * .5;
  g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fillStyle = '#2a1810'; g.fill();
  g.beginPath(); g.arc(px, py, pr * .55, 0, TAU); g.fillStyle = '#0a0605'; g.fill();
  // upper lid (heaviness) as skin plane
  const lid = F.lid || 0; if (lid > 0) { g.fillStyle = '#b8795a'; g.fillRect(-w * 1.2, -h * 1.4, w * 2.4, h * (.4 + lid * 1.05)); }
  g.restore();
  // lid line: heavy upper stroke + outer flick; faint lower line
  g.beginPath(); g.moveTo(-w * 1.02, .05); g.bezierCurveTo(-w * .45, -h * 1.28 + lid * h * .9, w * .45, -h * 1.28 + lid * h * .9, w * 1.02, -.2);
  g.strokeStyle = INK; g.lineWidth = .62; g.stroke();
  g.beginPath(); g.moveTo(-w * .7, h * .55); g.quadraticCurveTo(0, h * .95, w * .8, h * .45); g.strokeStyle = 'rgba(90,40,30,.35)'; g.lineWidth = .35; g.stroke();
  g.restore();
}
function browArc(g, x, y, w, F, inner = 1, sq = 1) {  // inner = +1 if the inner end is toward +x
  g.save(); g.translate(x, y + (F.brow || 0) * .7); g.rotate((F.browAng || 0) * inner); g.scale(sq, 1);
  g.beginPath(); g.moveTo(-w, .25); g.quadraticCurveTo(-w * .1, -.45, w, .05);
  g.strokeStyle = STYhair; g.lineWidth = .7; g.lineCap = 'round'; g.stroke(); g.restore();
}
let STYhair = '#0d0908';
function mouthShape(g, x, y, w, F, sq = 1) {
  g.save(); g.translate(x, y); g.scale(sq, 1); g.lineCap = 'round';
  const m = F.mouth, o = F.mOpen || 0, lip = '#8a4034';
  if (m === 'bow') {   // closed mouth: one firm stroke with a small lower-lip shade
    g.beginPath(); g.moveTo(-w * .9, 0); g.quadraticCurveTo(0, -w * .12, w * .9, 0); g.strokeStyle = lip; g.lineWidth = .5; g.stroke();
    g.beginPath(); g.moveTo(-w * .45, w * .42); g.quadraticCurveTo(0, w * .6, w * .45, w * .42); g.strokeStyle = 'rgba(120,60,44,.4)'; g.lineWidth = .35; g.stroke();
  } else if (m === 'smile') { g.beginPath(); g.moveTo(-w, -.1); g.quadraticCurveTo(0, w * .6, w * 1.05, -.35); g.strokeStyle = lip; g.lineWidth = .6; g.stroke(); }
  else if (m === 'line') { g.beginPath(); g.moveTo(-w * .9, 0); g.lineTo(w * .9, -.05); g.strokeStyle = lip; g.lineWidth = .6; g.stroke(); }
  else if (m === 'down') { g.beginPath(); g.moveTo(-w * .85, .3); g.quadraticCurveTo(0, -w * .35, w * .85, .3); g.strokeStyle = lip; g.lineWidth = .55; g.stroke(); }
  else if (m === 'o') { g.beginPath(); g.ellipse(0, .3, w * (.45 + o * .2), w * (.4 + o * .55), 0, 0, TAU); g.fillStyle = '#4a1414'; g.fill(); g.strokeStyle = lip; g.lineWidth = .35; g.stroke(); }
  else if (m === 'grin') { const p = new Path2D(); p.moveTo(-w * 1.1, -.2); p.quadraticCurveTo(0, .2, w * 1.1, -.2); p.quadraticCurveTo(0, w * (.5 + o), -w * 1.1, -.2); p.closePath(); g.fillStyle = '#4a1414'; g.fill(p); g.save(); g.clip(p); g.fillStyle = '#f6efe2'; g.fillRect(-w * 1.2, -.4, w * 2.4, w * .32); g.restore(); }
  else if (m === 'grit') { g.fillStyle = '#f6efe2'; g.fillRect(-w * .9, -w * .25, w * 1.8, w * .5); g.strokeStyle = lip; g.lineWidth = .35; g.strokeRect(-w * .9, -w * .25, w * 1.8, w * .5); g.beginPath(); g.moveTo(-w * .9, 0); g.lineTo(w * .9, 0); g.stroke(); }
  g.restore();
}

// ---------- head (head-local units, centre of the egg at 0,0; ry = 10) ----------
function capShape(g, cx, cy, ang, view, st) {
  g.save(); g.translate(cx, cy); g.rotate(ang);
  const w = 4.2, h = 6.2, e = view === 'side' ? 1.0 : 1.35;
  const body = new Path2D(); body.moveTo(-w, -h / 2); body.lineTo(w, -h / 2); body.lineTo(w * .97, h / 2); body.ellipse(0, h / 2, w * .97, e, 0, 0, Math.PI, false); body.closePath();
  facet(g, body, [-w, -h / 2, w, h / 2 + e], [[-w * .1, -h], [-w * .1, h]], st.jacket, st.jacketL, st.jacketD, [-1, -.2], .8);
  const band = new Path2D(); band.moveTo(-w * .98, h / 2 - 1.8); band.ellipse(0, h / 2 - 1.8, w * .98, e, 0, Math.PI, 0, true); band.lineTo(w * .97, h / 2); band.ellipse(0, h / 2, w * .97, e, 0, 0, Math.PI, false); band.closePath();
  g.fillStyle = goldGrad(g, -w, 0, w, 0, { sheen: .3 }); g.fill(band);
  g.beginPath(); g.ellipse(0, -h / 2, w, e, 0, 0, TAU); g.fillStyle = lin(g, -w, 0, w, 0, [[0, st.jacketL], [1, st.jacket]]); g.fill(); g.strokeStyle = C.gold2; g.lineWidth = .45; g.stroke();
  g.restore();
}
function head(g, view, F, st, o) {
  const L = o.L; STYhair = st.hair; const blink = o.blink || 0;
  if (view === 'side') {
    // profile facing +x: Greek nose continuing the forehead line, small chin
    const FP = [[1.5, -10], [5.4, -7.6], [6.5, -3.6], [7, -1.6], [8.7, 2.5], [7.2, 3.3], [7.25, 4.7], [6.7, 5.3], [6.95, 6.1], [6.3, 8.5], [3.4, 10.1], [-1.6, 8.4], [-5.6, 3.4], [-7.2, -2], [-5.4, -8.2]];
    const face = smoothPath(FP);
    facet(g, face, [-7.2, -10, 8.7, 10.1], [[1.2, -12], [4.2, 12]], st.skin, st.skinL, st.skinD, [L[0], L[1]], .7, 'rgba(255,228,180,.9)');
    // cheekbone shadow plane (hard)
    g.save(); g.clip(face); g.fillStyle = 'rgba(120,60,40,.28)'; g.beginPath(); g.moveTo(.6, 1.2); g.lineTo(5.6, 3.6); g.lineTo(5.4, 9.6); g.lineTo(-1, 9.6); g.closePath(); g.fill(); g.restore();
    // lacquer hair cap with one deco wave at the temple
    const HP = [[5.6, -6.8], [3.6, -9.8], [-2.4, -10.8], [-6.8, -7.8], [-7.6, -1.6], [-6.4, 3.6], [-4.4, 5.8], [-3.2, 3.2], [-1.6, -1.2], [.6, -2.6], [2.6, -4.6], [4.2, -5.4]];
    const hair = smoothPath(HP);
    facet(g, hair, [-7.6, -10.8, 5.6, 5.8], [[-6, -12], [2, 6]], st.hair, st.hairL, '#000000', [L[0], L[1]], .5, 'rgba(243,217,139,.32)');
    g.save(); g.clip(hair); g.beginPath(); g.moveTo(-6, 1); g.bezierCurveTo(-5.5, -5, -2, -8.6, 4, -8.4); g.strokeStyle = 'rgba(220,185,140,.28)'; g.lineWidth = .45; g.stroke(); g.restore();
    if (st.older) { g.save(); g.clip(face); g.strokeStyle = 'rgba(90,50,40,.4)'; g.lineWidth = .3; g.beginPath(); g.moveTo(4.6, 3.4); g.quadraticCurveTo(5.4, 5.4, 5, 7); g.stroke(); g.restore(); }
    // ear
    const ear = new Path2D(); ear.ellipse(-1.9, 1, 1.35, 2.1, .12, 0, TAU); facet(g, ear, [-3.3, -1.1, -.5, 3.1], null, st.skin, st.skinL, st.skinD, [L[0], L[1]], .4);
    // eye (side almond wedge), brow, nose line, mouth
    g.save(); g.translate(4.5, -.9);
    const open = (F.open ?? .8) * (1 - blink);
    g.lineCap = 'round';
    if (open <= .05) { g.beginPath(); g.moveTo(-1.2, 0); g.quadraticCurveTo(0, F.arc === 'up' ? -.9 : .7, 1.2, 0); g.strokeStyle = INK; g.lineWidth = .55; g.stroke(); }
    else {
      const h = .95 * open; const al = new Path2D(); al.moveTo(-1.3, 0); al.quadraticCurveTo(.2, -h * 1.1, 1.35, -.1); al.quadraticCurveTo(.3, h * .6, -1.3, 0); al.closePath();
      g.fillStyle = '#f6efe2'; g.fill(al); g.save(); g.clip(al); g.beginPath(); g.arc(.55 + (F.look?.[0] || 0) * .3, (F.look?.[1] || 0) * .3, .62 * (F.pupil ? .7 + F.pupil * .5 : 1), 0, TAU); g.fillStyle = '#120a07'; g.fill();
      if (F.lid) { g.fillStyle = '#b8795a'; g.fillRect(-1.5, -2, 3, 1.4 * F.lid + .2); } g.restore();
      g.beginPath(); g.moveTo(-1.35, 0); g.quadraticCurveTo(.2, -h * 1.15 + (F.lid || 0) * .8, 1.4, -.15); g.strokeStyle = INK; g.lineWidth = .55; g.stroke();
    }
    g.restore();
    g.save(); g.translate(4.4, -3.3 + (F.brow || 0) * .6); g.rotate((F.browAng || 0) * .9); g.beginPath(); g.moveTo(-1.8, .2); g.quadraticCurveTo(.2, -.7, 2.2, .1); g.strokeStyle = st.hair; g.lineWidth = .5; g.stroke(); g.restore();
    g.beginPath(); g.moveTo(6.6, -2.4); g.lineTo(8.3, 2.3); g.lineTo(7.1, 2.9); g.strokeStyle = 'rgba(130,70,48,.55)'; g.lineWidth = .35; g.stroke();
    // mouth in profile
    const m = F.mouth; g.save(); g.translate(6.5, 5.5);
    if (m === 'o' || m === 'grin' || m === 'grit') { g.beginPath(); g.ellipse(.2, .2, .6, .5 + (F.mOpen || 0) * .6, 0, 0, TAU); g.fillStyle = '#4a1414'; g.fill(); }
    else { g.beginPath(); g.moveTo(-.9, m === 'smile' ? -.3 : m === 'down' ? .3 : 0); g.lineTo(.6, 0); g.strokeStyle = '#9a3a36'; g.lineWidth = .5; g.stroke(); }
    g.restore();
    if (st.mustache) { g.beginPath(); g.moveTo(7.4, 3.9); g.quadraticCurveTo(5.8, 4.3, 4.6, 5.3); g.quadraticCurveTo(6.2, 4.7, 7.5, 4.6); g.closePath(); g.fillStyle = st.hair; g.fill(); }
    if (st.strap) { g.beginPath(); g.moveTo(-.4, -2); g.quadraticCurveTo(.6, 7.4, 5.6, 9.4); g.strokeStyle = '#1a0c0c'; g.lineWidth = .6; g.stroke(); g.strokeStyle = 'rgba(243,217,139,.5)'; g.lineWidth = .22; g.stroke(); }
    if (st.cap && !o.noCap) capShape(g, -.4 + (o.capDx || 0), -10.8 + (o.capDy || 0), .12 + (o.capRot || 0), 'side', st);
  } else if (view === 'front' || view === 'q') {
    const q = view === 'q' ? 1 : 0, fx = q * 2.2;
    const rx = 7, ry = 10;
    const FP = q ? [[0, -ry], [5.4, -8], [7.2, -2.6], [6.9, 2.6], [5.6, 6.6], [3.2, 9.4], [1.6, 10.2], [-1.6, 9.4], [-4.8, 6.4], [-6.6, 2], [-6.9, -3], [-5, -8]]
      : [[0, -ry], [5.2, -8.2], [rx, -3], [6.8, 2.6], [5.6, 7], [2.8, 9.6], [0, 10], [-2.8, 9.6], [-5.6, 7], [-6.8, 2.6], [-rx, -3], [-5.2, -8.2]];
    const face = smoothPath(FP);
    // ears
    for (const sx of q ? [-1] : [-1, 1]) { const e = new Path2D(); e.ellipse(sx * (6.9 - (sx < 0 ? q * .3 : 0)), .6, 1.2, 1.9, 0, 0, TAU); facet(g, e, [sx * 6.9 - 1.2, -1.3, sx * 6.9 + 1.2, 2.5], null, st.skin, st.skinL, st.skinD, [L[0], L[1]], .3); }
    // faceted face: shadow plane on the far side of the nose line (Lempicka)
    const nx0 = fx + .3, nx1 = fx + 1.1;
    facet(g, face, [-7, -10, 7.2, 10.2], [[nx0, -6], [nx1, 12]], st.skin, st.skinL, st.skinD, [L[0], L[1]], .75, 'rgba(255,228,180,.9)');
    g.save(); g.clip(face); g.fillStyle = 'rgba(200,90,80,.035)'; g.beginPath(); g.ellipse(fx - 4.2, 4.2, 2, 1.1, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(fx + 4.4 - q * .8, 4.2, 1.8, 1, 0, 0, TAU); g.fill(); g.restore();
    // lacquer hair cap with side part + finger wave
    const HP = q ? [[-7.3, 1.4], [-7.4, -5.6], [-4.4, -10.6], [1.6, -11.4], [6.2, -9.2], [7.5, -4.4], [7.3, 0], [6.3, -3], [4.6, -5.2], [2.6, -6.4], [.4, -5.4], [-2.2, -6.6], [-4.8, -5], [-6.2, -1.8], [-6.4, 1.6]]
      : [[-7.3, 1.4], [-7.4, -5.6], [-4.4, -10.6], [1.6, -11.4], [6.2, -9.2], [7.4, -4.4], [7.3, 1.4], [6.3, 1.6], [6.2, -3], [4.4, -5.4], [1.8, -6.6], [-.6, -5.4], [-3, -6.4], [-5.4, -4.8], [-6.4, -1.8], [-6.4, 1.6]];
    const hair = smoothPath(HP);
    facet(g, hair, [-7.4, -11.4, 7.5, 1.6], [[-2.8, -13], [-2.2, 3]], st.hair, st.hairL, '#000000', [L[0], L[1]], .5, 'rgba(243,217,139,.32)');
    g.save(); g.clip(hair); g.beginPath(); g.moveTo(-6.6, -2); g.bezierCurveTo(-5.8, -8, -1, -10.4, 4.8, -9.4); g.strokeStyle = 'rgba(220,185,140,.28)'; g.lineWidth = .45; g.stroke(); g.restore();
    // features
    const ey = -.2, exN = fx - 2.9, exF = fx + 2.9 * (1 - q * .18);
    eyeAlmond(g, exN, ey, 1.75, F, 1, 1, blink);
    eyeAlmond(g, exF, ey, 1.75, F, 1 - q * .25, 1, blink);
    browArc(g, exN, -3.1, 2.1, F, 1);
    browArc(g, exF, -3.1, 2.1, F, -1, 1 - q * .2);
    // one-stroke nose: from the inner brow down to the tip, tiny nostril hook
    g.beginPath(); g.moveTo(fx + .1, -2.4); g.quadraticCurveTo(fx + .9, .8, fx + 1.1, 2.9); g.quadraticCurveTo(fx + .5, 3.5, fx - .5, 3.2);
    g.strokeStyle = 'rgba(120,62,44,.75)'; g.lineWidth = .38; g.lineCap = 'round'; g.stroke();
    mouthShape(g, fx + .15, 5.9, 1.35, F, 1 - q * .15);
    if (st.mustache) { g.beginPath(); g.moveTo(fx, 4.4); g.quadraticCurveTo(fx - 2, 4.2, fx - 3.2, 5.4); g.quadraticCurveTo(fx - 1.6, 4.9, fx, 5.1); g.quadraticCurveTo(fx + 1.6, 4.9, fx + 3.2, 5.4); g.quadraticCurveTo(fx + 2, 4.2, fx, 4.4); g.fillStyle = st.hair; g.fill(); }
    if (st.older) { g.strokeStyle = 'rgba(90,50,40,.35)'; g.lineWidth = .28; g.beginPath(); g.moveTo(fx - 2.2, 4); g.quadraticCurveTo(fx - 3, 5.6, fx - 2.6, 7); g.stroke(); }
    if (st.strap) {
      const j0 = [-6.3 + q * 1.2, 2.6], j1 = [6.4 + q * .3, 2.6], ch = [fx * .6, 10.7];
      g.beginPath(); g.moveTo(j0[0], j0[1]); g.quadraticCurveTo(j0[0] + .6, 9.4, ch[0], ch[1]); g.quadraticCurveTo(j1[0] - .6, 9.4, j1[0], j1[1]);
      g.strokeStyle = 'rgba(26,12,12,.8)'; g.lineWidth = .45; g.stroke();
    }
    if (F.sweat) { g.save(); g.translate(fx + 6, -4.5); g.beginPath(); g.moveTo(0, -1.5); g.quadraticCurveTo(1, .3, 0, .9); g.quadraticCurveTo(-1, .3, 0, -1.5); g.fillStyle = 'rgba(210,230,255,.9)'; g.fill(); g.restore(); }
    if (st.cap && !o.noCap) capShape(g, 2.4 + q * 1.2 + (o.capDx || 0), -10.4 + (o.capDy || 0), .3 + (o.capRot || 0), 'front', st);
  } else {
    const hb = smoothPath([[-7.2, -3], [-6.2, -8.6], [0, -11.2], [6.2, -8.6], [7.2, -3], [6.4, 4], [3, 7.6], [-3, 7.6], [-6.4, 4]]);
    for (const sx of [-1, 1]) { const e = new Path2D(); e.ellipse(sx * 7, .8, 1.2, 1.9, 0, 0, TAU); facet(g, e, [sx * 7 - 1.2, -1.1, sx * 7 + 1.2, 2.7], null, st.skin, st.skinL, st.skinD, [L[0], L[1]], .3); }
    facet(g, hb, [-7.2, -11.2, 7.2, 7.6], [[-1, -12], [-.5, 8]], st.hair, st.hairL, '#000000', [L[0], L[1]], .6, 'rgba(243,217,139,.5)');
    if (st.cap && !o.noCap) capShape(g, -1.6 + (o.capDx || 0), -10.4 + (o.capDy || 0), -.22 + (o.capRot || 0), 'front', st);
  }
}

// ---------- torso ----------
function torso(g, view, st, L, dir) {
  const sh = st.sh, wa = st.waist;
  if (view === 'side') {
    const seat = smoothPath([[-5, -9], [5, -9], [6, -1.5], [4.6, 5], [-4.6, 5.2], [-6.4, -1]]);
    facet(g, seat, [-6.4, -9, 6, 5.2], [[0, -10], [0, 6]], st.pants, st.pantsL, st.pantsD, L, .8);
    if (st.tails) { const tp = smoothPath([[-5.8, -10], [-3.6, -10], [-4.2, 12], [-7.2, 26], [-8.8, 24], [-7.4, 6]]); facet(g, tp, [-8.8, -10, -3.6, 26], [[-6, -10], [-7, 26]], st.jacket, st.jacketL, st.jacketD, L, .8); }
    const J = [[-3.4, -47.6], [3, -47.6], [6.4, -42.6], [7.2, -34], [5.6, -22], [4.4, -12], [5.4, -4], [3.2, -1.2], [-4.6, -5.8], [-4.8, -14], [-5.6, -26], [-6.6, -36], [-5.6, -44]];
    const jp = toPath(J, true);
    facet(g, jp, bbox(J), [[.6, -50], [-.2, 0]], st.jacket, st.jacketL, st.jacketD, L, 1.1);
    if (st.trim) gline(g, [[4.6, -46.8], [6.9, -39], [7, -33], [5.5, -22], [4.4, -12], [5.4, -4], [3.2, -1.2], [-4.6, -5.8]], { w: .7, bb: [-8, -50, 8, 0] });
    if (st.buttons === 'v' || st.buttons === 'single') for (let i = 0; i < 5; i++) { const y = -40 + i * 7, x = [6.4, 6.6, 5.6, 4.7, 4.5][i]; g.beginPath(); g.arc(x, y, .9, 0, TAU); g.fillStyle = goldGrad(g, x - 1, y - 1, x + 1, y + 1, { sheen: .3 }); g.fill(); }
    const col = toPath([[-3.4, -48.6], [3.2, -48.6], [4, -46], [-3, -45.6]], true); g.fillStyle = st.cap ? goldGrad(g, -4, -49, 4, -45, { sheen: .35 }) : st.jacketD; g.fill(col);
    if (st.cap) { const ep = toPath([[-4.6, -47.8], [2.4, -48.2], [2.6, -46], [-4.4, -45.4]], true); g.fillStyle = goldGrad(g, -5, -48, 3, -45, { sheen: .5 }); g.fill(ep); }
    if (st.bow) { g.fillStyle = '#0a0808'; g.beginPath(); g.moveTo(3.2, -47.6); g.lineTo(5.6, -49); g.lineTo(5.6, -45.8); g.closePath(); g.fill(); }
  } else {
    const back = view === 'back', q = view === 'q' ? 1 : 0, cx = q * 2.4;
    const seat = smoothPath([[-7.2, -9], [7.2, -9], [7.4, -1], [6, 5], [-6, 5], [-7.4, -1]]);
    facet(g, seat, [-7.4, -9, 7.4, 5], [[cx, -10], [cx, 6]], st.pants, st.pantsL, st.pantsD, L, .8);
    const J = back
      ? [[-4.2, -48], [4.2, -48], [sh, -46], [sh + 1, -42], [sh * .78, -30], [wa + 1, -14], [wa + 1.4, -4.4], [-wa - 1.4, -4.4], [-wa - 1, -14], [-sh * .78, -30], [-sh - 1, -42], [-sh, -46]]
      : [[-4.2 + cx * .4, -48], [4.2 + cx * .6, -48], [sh - q, -46], [sh + 1 - q * 1.4, -42], [sh * .78 - q, -30], [wa + 1 - q * .6, -14], [wa + 1.4 - q * .6, -4.4], [cx, -.4], [-wa - 1.4 + q * .4, -4.4], [-wa - 1 + q * .4, -14], [-sh * .78 + q * .8, -30], [-sh - 1 + q, -42], [-sh + q, -46]];
    const jp = toPath(J, true);
    facet(g, jp, bbox(J), [[cx + .2, -50], [cx - .4, 0]], st.jacket, st.jacketL, st.jacketD, L, 1.1);
    if (st.tails && !back) { }
    if (st.trim) {
      if (back) gline(g, [[-wa - 1.4, -4.4], [wa + 1.4, -4.4]], { w: .7, bb: [-14, -50, 14, 0] });
      else { gline(g, [[-wa - 1.4 + q * .4, -4.4], [cx, -.4], [wa + 1.4 - q * .6, -4.4]], { w: .7, bb: [-14, -50, 14, 0] }); gline(g, [[cx, -46.6], [cx, -.8]], { w: .5, bb: [-14, -50, 14, 0] }); }
    }
    if (!back) {
      if (st.buttons === 'v') for (let i = 0; i < 5; i++) { const y = -40 + i * 7, sp = lerp(5.4, 1.8, i / 4); for (const sd of [-1, 1]) { const x = cx + sd * sp * (q ? (sd < 0 ? 1.05 : .75) : 1); g.beginPath(); g.arc(x, y, .9, 0, TAU); g.fillStyle = goldGrad(g, x - 1, y - 1, x + 1, y + 1, { sheen: .3 }); g.fill(); } }
      else if (st.buttons === 'single') for (let i = 0; i < 4; i++) { const y = -38 + i * 8; g.beginPath(); g.arc(cx + 1.2, y, .85, 0, TAU); g.fillStyle = goldGrad(g, cx, y - 1, cx + 2, y + 1, { sheen: .3 }); g.fill(); }
      else if (st.buttons === 'pair') { // tailcoat: open front, white waistcoat V + shirt
        const v = toPath([[cx - 3.6, -46], [cx + 3.6, -46], [cx + 2.2, -18], [cx, -14], [cx - 2.2, -18]], true); g.fillStyle = '#fbf7ee'; g.fill(v);
        g.strokeStyle = st.jacketD; g.lineWidth = .5; g.stroke(v);
      }
    }
    if (st.cap) for (const sd of [-1, 1]) { const x = sd < 0 ? -sh + 1.2 + q : sh - 1.2 - q * 1.4; const ep = toPath([[x - 3, -47.6], [x + 3, -47.6], [x + 2.7, -45.4], [x - 2.7, -45.4]], true); g.fillStyle = goldGrad(g, x - 3, -48, x + 3, -45, { sheen: .5 }); g.fill(ep); }
    const col = toPath([[-4.2 + cx * .4, -49.2], [4.2 + cx * .6, -49.2], [3.8 + cx * .6, -46.4], [-3.8 + cx * .4, -46.4]], true);
    g.fillStyle = st.cap ? goldGrad(g, -4, -49, 4, -46, { sheen: .35 }) : '#fbf7ee'; g.fill(col);
    if (st.bow && !back) { g.fillStyle = '#0a0808'; g.beginPath(); g.moveTo(cx, -47.4); g.lineTo(cx - 3.2, -49); g.lineTo(cx - 3.2, -45.8); g.closePath(); g.moveTo(cx, -47.4); g.lineTo(cx + 3.2, -49); g.lineTo(cx + 3.2, -45.8); g.closePath(); g.fill(); }
  }
}

// ---------- limbs ----------
function leg(g, st, hx, hy, a1, a2, near, view, L) {
  const kx = hx + Math.sin(a1) * st.thigh, ky = hy + Math.cos(a1) * st.thigh;
  const a = a1 + a2, ax = kx + Math.sin(a) * st.shin, ay = ky + Math.cos(a) * st.shin;
  const dk = near ? 0 : .3, base = mix(st.pants, '#000000', dk), light = mix(st.pantsL, '#000000', dk);
  limb(g, kx, ky, 3.1, ax, ay, 2.3, base, light, st.pantsD, L, near ? .9 : .4);
  limb(g, hx, hy, 4.4, kx, ky, 3.3, base, light, st.pantsD, L, near ? 1 : .4);
  if (view === 'side' && near && st.cap) { g.strokeStyle = 'rgba(201,162,75,.9)'; g.lineWidth = .65; g.beginPath(); g.moveTo(hx, hy + 2); g.lineTo(kx, ky); g.lineTo(ax, ay - 1.5); g.stroke(); }
  // pointed shoe
  g.save(); g.translate(ax, ay); if (view === 'side') g.rotate(a * .3);
  const sp = view === 'side' ? smoothPath([[-2.4, -1.4], [2, -1.6], [7.6, .6], [7.2, 1.9], [-2.6, 2.1]]) : view === 'back' ? smoothPath([[-2.4, -1.2], [2.4, -1.2], [2.6, 2], [-2.6, 2]]) : smoothPath([[-2.4, -1], [2.4, -1], [2.2, 2.4], [0, 3.6], [-2.2, 2.4]]);
  facet(g, sp, [-2.6, -1.6, 7.6, 3.6], [[-3, -.2], [8, -.2]], st.shoe, '#6a5a4a', '#000000', [L[0], -1], .6, 'rgba(243,217,139,.6)');
  g.restore();
  return { knee: [kx, ky], ankle: [ax, ay] };
}
function glove(g, st, x, y, ang, L, o = {}) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const p = new Path2D(); p.ellipse(0, .6, 2.1, 3, 0, 0, TAU); p.ellipse(-1.7, -.4, .8, 1.4, -.5, 0, TAU);
  facet(g, p, [-2.5, -2.4, 2.1, 3.6], [[0, -4], [.3, 4]], st.glove, '#ffffff', st.gloveD, [L[0], L[1]], .5, 'rgba(255,240,200,.9)');
  g.fillStyle = st.gloveD; g.fillRect(-1.9, -2.6, 3.8, .9);
  g.restore();
}
function arm(g, st, sx, sy, a1, a2, near, L, o = {}) {
  const ex = sx + Math.sin(a1) * st.uarm, ey = sy + Math.cos(a1) * st.uarm;
  const a = a1 + a2, wx = ex + Math.sin(a) * st.farm, wy = ey + Math.cos(a) * st.farm;
  const dk = near ? 0 : .3, base = mix(st.jacket, '#000000', dk), light = mix(st.jacketL, '#000000', dk);
  limb(g, sx, sy, 3.3, ex, ey, 2.6, base, light, st.jacketD, L, near ? 1 : .4);
  limb(g, ex, ey, 2.7, wx, wy, 2.2, base, light, st.jacketD, L, near ? .9 : .4);
  if (st.trim) { const cx = ex + Math.sin(a) * st.farm * .85, cy = ey + Math.cos(a) * st.farm * .85; g.save(); g.translate(cx, cy); g.rotate(-a); g.fillStyle = st.cap ? goldGrad(g, -3, 0, 3, 0, { sheen: .4 }) : '#fbf7ee'; g.fillRect(-2.5, -.7, 5, 1.4); g.restore(); }
  const hx = wx + Math.sin(a) * 2.2, hy = wy + Math.cos(a) * 2.2;
  if (o.item && o.itemBehind) o.item(g, hx, hy, a);
  glove(g, st, hx, hy, -a + (o.handRot || 0), L);
  if (o.item && !o.itemBehind) o.item(g, hx, hy, a);
  return { elbow: [ex, ey], hand: [hx, hy] };
}

// ---------- full figure ----------
// P: { x, y (hip px), s (px/unit), view: 'side'|'front'|'q'|'back', dir (1 faces screen-right, -1 left), lean, headTilt, face, blink,
//      armN/armF/legN/legF [a1,a2] (side), fl: [[a1,a2],[a1,a2]] front legs (+ = outward), armsOver, letter:'N'|'F', cap:{dx,dy,rot,off},
//      item: fn(g, hx, hy, ang) drawn at the near hand (tray, baton…), squash, style: 'pip'|'conductor'|'waiter' }
export function drawFigure(g, P) {
  const st = typeof P.style === 'object' ? P.style : STY[P.style || 'pip'];
  const { x, y, s = 3, view = 'side', dir = 1, lean = 0, headTilt = 0, blink = 0, squash = 1 } = P;
  const F = faceP(P.face || 'neutral');
  const armN = P.armN || [.06, .12], armF = P.armF || [-.06, .1], legN = P.legN || [.03, 0], legF = P.legF || [-.03, 0];
  const L = [LIGHT[0] * dir, LIGHT[1]];
  g.save(); g.translate(x, y); g.scale(s * dir, s * squash); g.lineJoin = 'round';
  const T = (px, py) => rot(px, py, lean);
  const shY = -45, nk = T(0, -46.5 - st.neck * .2), hd = T(0, -47 - st.neck - 7.6);
  const hO = { L, blink, capDx: P.cap?.dx || 0, capDy: P.cap?.dy || 0, capRot: P.cap?.rot || 0, noCap: P.cap?.off };
  const drawHead = () => {
    g.save(); g.translate(nk[0], nk[1]); g.rotate(lean);
    limb(g, 0, 1.2, 2.3, 0, -st.neck - 2, 2.1, st.skin, st.skinL, st.skinD, L, .4);
    g.restore();
    g.save(); g.translate(hd[0], hd[1]); g.rotate(lean * .5 + headTilt); head(g, view, F, st, hO); g.restore();
  };
  const letterItem = (hx, hy, a) => envelope(g, hx + 1.6, hy + 1.8, .9, -a + .35);
  const itemN = P.letter === 'N' ? letterItem : (P.item || null), itemF = P.letter === 'F' ? letterItem : (P.itemF || null);
  if (view === 'side') {
    const S = T(0, shY);
    arm(g, st, S[0] - 1.4, S[1] + .6, armF[0] + lean, armF[1], false, L, { item: itemF });
    leg(g, st, -.8, 0, legF[0], legF[1], false, view, L);
    leg(g, st, .8, 0, legN[0], legN[1], true, view, L);
    g.save(); g.rotate(lean); torso(g, view, st, L, dir); g.restore();
    drawHead();
    arm(g, st, S[0] + .4, S[1] + 1, armN[0] + lean, armN[1], true, L, { item: itemN });
  } else {
    const q = view === 'q' ? 1 : 0, back = view === 'back';
    const fl = P.fl || [[legF[0] * .6 + .025, 0], [legN[0] * .6 + .025, 0]];
    leg(g, st, -3.6 + q, 0, -fl[0][0], -fl[0][1], true, view, L);
    leg(g, st, 3.6 - q * .6, 0, fl[1][0], fl[1][1], !q, view, L);
    const Ls = T(-st.sh + 1 + q, shY + .6), Rs = T(st.sh - 1 - q * 1.4, shY + .6);
    const armL = () => arm(g, st, Ls[0], Ls[1], -armF[0], -armF[1], true, L, { item: itemF, itemBehind: back });
    const armR = (near = true) => arm(g, st, Rs[0] - (near ? 0 : 1), Rs[1], armN[0], armN[1], near, L, { item: itemN, itemBehind: back });
    if (back) { armL(); armR(); g.save(); g.rotate(lean); torso(g, view, st, L, dir); g.restore(); drawHead(); }
    else if (P.armsOver) { g.save(); g.rotate(lean); torso(g, view, st, L, dir); g.restore(); drawHead(); armL(); armR(); }
    else {
      if (q) armR(false);
      g.save(); g.rotate(lean); torso(g, view, st, L, dir); g.restore();
      armL(); if (!q) armR();
      drawHead();
    }
  }
  g.restore();
}
export const drawPip = (g, P) => drawFigure(g, P);

export function drawPipHead(g, x, y, s, view = 'q', face = 'neutral', o = {}) {
  const st = STY[o.style || 'pip'], dir = o.dir || 1, L = [LIGHT[0] * dir, LIGHT[1]];
  g.save(); g.translate(x, y); g.scale(s * dir, s); g.rotate(o.tilt || 0);
  g.save(); g.translate(0, 9.5); limb(g, 0, 5.2, 2.5, 0, -2, 2.2, st.skin, st.skinL, st.skinD, L, .4);
  const col = toPath([[-4.6, 3.8], [4.6, 3.8], [4.2, 7.2], [-4.2, 7.2]], true); g.fillStyle = st.cap ? goldGrad(g, -5, 3, 5, 7, { sheen: .35 }) : '#fbf7ee'; g.fill(col);
  g.restore();
  head(g, view, faceP(face), st, { L, blink: o.blink || 0, capRot: o.capRot || 0, capDx: o.capDx || 0, capDy: o.capDy || 0, noCap: o.noCap });
  g.restore();
}

// ---------- envelope + clef ----------
export function envelope(g, x, y, s, ang = 0, { seal = true } = {}) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  const w = 11, h = 7;
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 3; g.shadowOffsetY = 1.2;
  g.fillStyle = lin(g, -w / 2, -h / 2, w / 2, h / 2, [[0, '#fffaf0'], [1, '#d9ccb2']]); g.fillRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.strokeStyle = 'rgba(120,90,50,.55)'; g.lineWidth = .35; g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(0, h * .12); g.lineTo(w / 2, -h / 2); g.stroke();
  g.strokeStyle = C.gold1; g.lineWidth = .45; g.strokeRect(-w / 2 + .7, -h / 2 + .7, w - 1.4, h - 1.4);
  if (seal) { g.beginPath(); g.arc(0, h * .12, 1.8, 0, TAU); g.fillStyle = goldGrad(g, -2, -2, 2, 2, { sheen: .4 }); g.fill(); clef(g, 0, h * .12, .5, '#6b4b18'); }
  g.restore();
}
export function clef(g, x, y, s, col = C.gold1, lw = null) {
  g.save(); g.translate(x, y); g.scale(s, s); g.beginPath();
  g.moveTo(.9, 1.1); g.bezierCurveTo(2.1, .1, 1.5, -1.7, 0, -1.3); g.bezierCurveTo(-1.8, -.8, -1.9, 1.9, .1, 2.2);
  g.bezierCurveTo(2.2, 2.4, 2.9, -.4, 1.2, -2.2); g.bezierCurveTo(-.2, -3.6, 1.6, -5.6, 1.3, -4.9); g.lineTo(.3, 3.6); g.bezierCurveTo(.2, 4.6, -1.1, 4.5, -1, 3.7);
  g.strokeStyle = col; g.lineWidth = lw ?? .55; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.restore();
}

// ---------- dancers (fan dancers) ----------
// Side / oblique view: slim column gown, bob hair, huge ostrich-plume fan. fan: 0 closed … 1 open; raise: arm height 0..1.
export function drawDancer(g, x, y, s, { dir = 1, fan = 1, raise = .6, sway = 0, gown = '#efe3c6', fanCol = '#f3e4c0', rim = 1 } = {}) {
  const L = [LIGHT[0] * dir, LIGHT[1]];
  g.save(); g.translate(x, y); g.scale(s * dir, s); g.rotate(sway * .08);
  const st = { skin: '#e8b48c', skinL: '#ffdcbc', skinD: '#a06646', hair: '#0a0706', hairL: '#3a2a20' };
  // gown: long tapered column flaring at the hem
  const G = [[-4.2, -44], [4.6, -44], [5.4, -36], [3.8, -20], [4.2, 0], [7.4, 30], [12, 60], [-12, 60], [-6.6, 30], [-3.8, 0], [-3.4, -20], [-5, -36]];
  facet(g, smoothPath(G), bbox(G), [[.4, -46], [-.6, 62]], gown, '#ffffff', '#8c7a58', L, 1, 'rgba(243,217,139,.9)');
  for (let k = 0; k < 3; k++) gline(g, [[-3.6 + k * .2, -36 + k * 3], [3.9 - k * .2, -36 + k * 3]], { w: .5, alpha: .8 });
  // bare shoulders / neck / head (bob)
  limb(g, 0, -43, 2, 0, -49, 1.8, st.skin, st.skinL, st.skinD, L, .3);
  g.save(); g.translate(0, -56); g.rotate(-.08);
  const face = smoothPath([[0, -7.6], [4.4, -5.6], [5.2, -1], [5.8, 1.8], [4.6, 2.6], [4.3, 4.8], [2.6, 7], [-1.4, 6.4], [-4.8, 1.6], [-5.2, -4]]);
  facet(g, face, [-5.2, -7.6, 5.8, 7], [[1, -9], [2.6, 9]], st.skin, st.skinL, st.skinD, L, .5);
  const bob = smoothPath([[4.6, -4.4], [1.6, -8.6], [-4.4, -7.6], [-6.6, -2], [-6.4, 4.2], [-2.6, 5.6], [-1.6, 1], [.4, -2.6], [3, -3.2]]);
  facet(g, bob, [-6.6, -8.6, 4.6, 5.6], [[-2, -9], [0, 6]], st.hair, st.hairL, '#000', L, .6, 'rgba(243,217,139,.6)');
  g.fillStyle = C.gold2; g.fillRect(-4.8, -6.4, 9, .8);
  g.beginPath(); g.moveTo(2.2, -1); g.quadraticCurveTo(3.2, -1.8, 4.2, -1.2); g.strokeStyle = INK; g.lineWidth = .45; g.stroke();
  g.fillStyle = '#9a2a30'; g.beginPath(); g.ellipse(4, 3.8, .7, .4, 0, 0, TAU); g.fill();
  g.restore();
  // arm holding the fan up and out
  const sx = 2.4, sy = -42, a1 = lerp(.6, 2.3, raise), a2 = lerp(.3, -.4, raise);
  const ex = sx + Math.sin(a1) * 16, ey = sy + Math.cos(a1) * 16, a = a1 + a2, hx = ex + Math.sin(a) * 15, hy = ey + Math.cos(a) * 15;
  limb(g, sx, sy, 1.8, ex, ey, 1.4, st.skin, st.skinL, st.skinD, L, .4); limb(g, ex, ey, 1.4, hx, hy, 1.1, st.skin, st.skinL, st.skinD, L, .4);
  plumeFan(g, hx, hy, 30, a - Math.PI, fan, fanCol);
  g.restore();
}
// Ostrich-plume fan: ribs radiating from the pivot, scalloped plume tips; `ang` = direction the fan points.
export function plumeFan(g, x, y, r, ang, open = 1, col = '#f3e4c0') {
  if (open <= 0) return;
  g.save(); g.translate(x, y); g.rotate(ang);
  const half = Math.PI * .5 * open, n = 11;
  const p = new Path2D(); p.moveTo(0, 0);
  for (let i = 0; i <= n; i++) { const a = -half + 2 * half * i / n; const am = a + half / n; p.lineTo(Math.cos(a) * r, Math.sin(a) * r); if (i < n) p.quadraticCurveTo(Math.cos(am) * r * 1.16, Math.sin(am) * r * 1.16, Math.cos(a + 2 * half / n) * r, Math.sin(a + 2 * half / n) * r); }
  p.closePath();
  const gr = g.createRadialGradient(0, 0, r * .1, 0, 0, r * 1.1); gr.addColorStop(0, '#5a4424'); gr.addColorStop(.35, mix(col, '#8a6a3a', .4)); gr.addColorStop(1, col);
  g.fillStyle = gr; g.fill(p);
  for (let i = 0; i <= n; i++) { const a = -half + 2 * half * i / n; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * .96, Math.sin(a) * r * .96); g.strokeStyle = 'rgba(201,162,75,.85)'; g.lineWidth = r * .018; g.stroke(); }
  g.strokeStyle = 'rgba(243,217,139,.9)'; g.lineWidth = r * .02; g.stroke(p);
  g.restore();
}
// Overhead view of a dancer (Busby Berkeley): gown disc, shoulders, bob, and the fan held outward (radially).
export function drawDancerTop(g, x, y, s, ang, { fan = 1, fanCol = '#f3e4c0', spin = 0 } = {}) {
  // straight overhead: the dancer holds her fan high and out, so the frame reads as fans (Berkeley) with a head at each pivot
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  // dark gown hem just visible around her (velvet with gold pleat tips)
  const n = 12, R = 12, p = new Path2D();
  for (let i = 0; i <= n; i++) { const a = i / n * TAU + spin, am = a + Math.PI / n; const P0 = [Math.cos(a) * R, Math.sin(a) * R]; if (!i) p.moveTo(...P0); else p.lineTo(...P0); p.quadraticCurveTo(Math.cos(am) * R * 1.14, Math.sin(am) * R * 1.14, Math.cos(a + TAU / n) * R, Math.sin(a + TAU / n) * R); }
  g.fillStyle = '#120d08'; g.fill(p); g.strokeStyle = 'rgba(243,217,139,.7)'; g.lineWidth = .6; g.stroke(p);
  // two fans: the big one outward, a smaller one back toward the centre (opens with the beat)
  plumeFan(g, 4, 0, 36, 0, fan, fanCol);
  plumeFan(g, -3, 0, 14, Math.PI, fan * .8, '#e8d6ae');
  // arms
  g.strokeStyle = '#e8b48c'; g.lineCap = 'round'; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(3, -4.5, 5, -.8); g.moveTo(0, 4); g.quadraticCurveTo(3, 4.5, 5, .8); g.stroke();
  // head: black bob, gold headband, a glint
  g.beginPath(); g.arc(-1, 0, 4.3, 0, TAU); const hg = g.createRadialGradient(-2.4, -1.4, .4, -1, 0, 4.4); hg.addColorStop(0, '#6a4e3a'); hg.addColorStop(1, '#050303'); g.fillStyle = hg; g.fill();
  g.beginPath(); g.arc(-1, 0, 3.5, 0, TAU); g.strokeStyle = C.gold2; g.lineWidth = .9; g.stroke();
  g.restore();
}

// Named poses (side view). +a1 swings forward; elbows bend +, knees bend −.
export const POSES = {
  stand: { armN: [.06, .14], armF: [-.05, .1], legN: [.02, 0], legF: [-.02, 0] },
  run1: { lean: .22, armN: [.95, 1.35], armF: [-.95, 1.0], legN: [.95, -.3], legF: [-.5, -1.45] },
  run2: { lean: .22, armN: [-.95, 1.0], armF: [.95, 1.35], legN: [-.5, -1.45], legF: [.95, -.3] },
  runPass1: { lean: .2, armN: [.1, 1.3], armF: [-.2, 1.2], legN: [.25, -1.5], legF: [-.05, -.2] },
  climb1: { lean: .3, armN: [.8, 1.2], armF: [-.7, .9], legN: [1.25, -1.4], legF: [-.3, -.6] },
  climb2: { lean: .3, armN: [-.7, .9], armF: [.8, 1.2], legN: [-.3, -.6], legF: [1.25, -1.4] },
  kick: { lean: -.06, armN: [-1.0, .7], armF: [1.35, 1.1], legN: [1.35, -.12], legF: [-.1, -.12] },
  slide: { lean: -.55, headTilt: .25, armN: [-1.2, .2], armF: [1.6, .3], legN: [1.5, -.05], legF: [.3, -1.9] },
  windup: { lean: -.26, headTilt: -.1, armN: [-2.2, -.7], armF: [.9, .9], legN: [.55, -.25], legF: [-.5, -.2] },
  release: { lean: .36, headTilt: -.15, armN: [1.75, .15], armF: [-1.1, .7], legN: [.6, -.55], legF: [-.8, -.2] },
  wobble: { lean: .5, headTilt: .2, armN: [2.6, .3], armF: [-2.4, .4], legN: [.1, -.2], legF: [-.35, -.4] },
  press: { lean: .04, armN: [1.2, .55], armF: [-.05, .12], legN: [.05, 0], legF: [-.08, 0] },
  lookup: { lean: -.08, headTilt: -.35, armN: [.3, 1.3], armF: [.06, .2], legN: [.05, 0], legF: [-.05, 0] },
};
export const FRONT_POSES = {
  stand: { armN: [.1, .1], armF: [.1, .1] },
  panic: { armsOver: true, armN: [2.3, 1.95], armF: [2.3, 1.95] },
  cheer: { armsOver: true, armN: [2.7, .25], armF: [.35, .2] },
  capwave: { armsOver: true, armN: [2.9, .5], armF: [.2, .25] },
  charleston: { lean: .05, armN: [1.25, 1.0], armF: [-.35, .9], fl: [[.05, 0], [-.28, 1.25]] },
  fix: { armsOver: true, armN: [2.1, 2.05], armF: [.15, .3] },              // straightening the cap
};

// ---------- pose interpolation & cycles ----------
export function lerpPose(a, b, t) {
  const o = { ...a, ...b };
  for (const k of Object.keys(o)) {
    const x = a[k], y = b[k];
    if (Array.isArray(x) && Array.isArray(y)) o[k] = Array.isArray(x[0]) ? x.map((p, i) => p.map((v, j) => lerp(v, y[i][j], t))) : x.map((v, i) => lerp(v, y[i], t));
    else if (typeof x === 'number' && typeof y === 'number') o[k] = lerp(x, y, t);
    else o[k] = t < .5 ? (x ?? y) : (y ?? x);
  }
  return o;
}
const RUNK = [POSES.run1, { lean: .2, armN: [.1, 1.3], armF: [-.1, 1.2], legN: [.2, -1.6], legF: [-.05, -.15] }, POSES.run2, { lean: .2, armN: [-.1, 1.2], armF: [.1, 1.3], legN: [-.05, -.15], legF: [.2, -1.6] }];
// side-view run cycle; phase in cycles (1 = two steps). Returns { pose, bob } (bob in units, up = negative)
export function runCycle(phase, stepFps = 12, cycleLen = 1) {
  let p = ((phase % 1) + 1) % 1;
  const k = Math.floor(p * 4), f = p * 4 - k;
  const pose = lerpPose(RUNK[k], RUNK[(k + 1) % 4], f);
  return { pose, bob: -Math.abs(Math.sin(p * Math.PI * 2)) * 2.2 };
}
// back / front view run: legs alternate (+ = outward swing reads as stride), arms counter-swing
export function runFront(phase) {
  const p = ((phase % 1) + 1) % 1, s = Math.sin(p * Math.PI * 2);
  return { fl: [[.03 + .05 * Math.max(0, s), -.55 * Math.max(0, s)], [.03 + .05 * Math.max(0, -s), -.55 * Math.max(0, -s)]], armN: [.08 + .1 * s, .2 + .15 * s], armF: [.08 - .1 * s, .2 - .15 * s], bob: -Math.abs(s) * 2.4 };
}

// Two-bone IK in figure units (hip origin). from = shoulder, to = hand target; bend = +1 elbow toward +x, −1 toward −x.
// Returns [a1, a2] in the rig convention (angle from straight down, + toward +x). For the screen-left arm in front views, negate both.
export function armIK(from, to, L1, L2, bend = 1) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const d = Math.min(Math.hypot(dx, dy), L1 + L2 - .01);
  const th = Math.atan2(dx, dy);
  const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const a1 = th + bend * al;
  const ex = from[0] + Math.sin(a1) * L1, ey = from[1] + Math.cos(a1) * L1;
  const a = Math.atan2(to[0] - ex, to[1] - ey);
  return [a1, a - a1];
}
// shoulder positions (figure units) for the right-hand (screen-right) arm by view
export function shoulderR(view = 'front', style = 'pip') { const st = STY[style], q = view === 'q' ? 1 : 0; return [st.sh - 1 - q * 1.4, -44.4]; }

// A white-gloved hand, big (inserts): open (0) … closed grip (1). Drawn pointing up (fingers toward −y) before rotation.
export function gloveHand(g, x, y, s, rot = 0, grip = 0, o = {}) {
  const L = [-.6, -.8];
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const base = '#f4ecdc', lite = '#ffffff', dark = '#a8977a';
  // sleeve + cuff
  if (o.sleeve !== false) { const sv = toPath([[-4.2, 5], [4.2, 5], [4.8, 40], [-4.8, 40]], true); facet(g, sv, [-4.8, 5, 4.8, 40], [[0, 0], [.5, 40]], o.sleeve || '#efe6d2', '#ffffff', '#8c806a', L, .8); g.fillStyle = '#0a0808'; g.fillRect(-4.4, 6.5, 8.8, 1); }
  // palm
  const palm = smoothPath([[-3.8, -1.2], [3.6, -1.6], [3.9, 3], [3, 6], [-3, 6], [-4, 3]]);
  facet(g, palm, [-4, -1.6, 3.9, 6], [[.2, -3], [.6, 7]], base, lite, dark, L, .6, 'rgba(255,240,200,.9)');
  // fingers: straight when open, curled (shorter, tilted) when gripping
  for (let i = 0; i < 4; i++) {
    const fx = -2.8 + i * 1.9, len = (i === 1 || i === 2 ? 5.2 : 4.4) * (1 - grip * .55), ang = (i - 1.5) * .09 * (1 - grip) + grip * .25;
    const tx = fx + Math.sin(ang) * len, ty = -1.2 - Math.cos(ang) * len;
    limb(g, fx, -.8, .95, tx, ty, .85, base, lite, dark, L, .5);
    g.strokeStyle = 'rgba(120,100,70,.5)'; g.lineWidth = .18; g.beginPath(); g.moveTo(fx - .5, -2.2); g.lineTo(fx + .5, -2.2); g.stroke();
  }
  // thumb
  limb(g, -3.4, 2.2, 1.15, -5.6 + grip * 2.2, -1.2 + grip * .6, 1, base, lite, dark, L, .5);
  // stitched lines on the back of the glove (three points)
  g.strokeStyle = 'rgba(120,100,70,.45)'; g.lineWidth = .2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 1.4, 1); g.lineTo(i * 1.2, 4.2); g.stroke(); }
  g.restore();
}

function D_sparkleMini(g, x, y) { g.fillStyle = '#fff4d2'; g.beginPath(); g.moveTo(x, y - 1.6); g.lineTo(x + .4, y); g.lineTo(x, y + 1.6); g.lineTo(x - .4, y); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x - 1.6, y); g.lineTo(x, y + .4); g.lineTo(x + 1.6, y); g.lineTo(x, y - .4); g.closePath(); g.fill(); }
