// Test / model-sheet pages (lightbox lighting through the real compositor).
import { Pass, COL } from './glass.js';
import { drawKnight, POSE } from './knight.js';
import { drawDragon, DPOSE } from './dragon.js';

export function knightTest(Lc, comp, L, t) {
  const { G, S, R, O } = Lc;
  for (const c of [G, S, R, O]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1920, 1080); }
  S.fillStyle = '#2a2a2e'; S.fillRect(0, 0, 1920, 1080);
  // glass panes behind each figure (so figures sit on a cobalt field like in the window)
  const P = new Pass(G, S);
  const poses = ['raise', 'walkA', 'guard', 'strike', 'blow', 'kneel'];
  poses.forEach((k, i) => {
    const x = 170 + i * 300, y = 560;
    S.clearRect(x - 140, 140, 280, 800);
    G.fillStyle = COL.cobalt; G.fillRect(x - 140, 140, 280, 800);
    const p = POSE[k];
    const base = new DOMMatrix().translate(x, y + (p.rootDy || 0)).scale(1.35);
    drawKnight(P, base, p);
    G.setTransform(1, 0, 0, 1, 0, 0); S.setTransform(1, 0, 0, 1, 0, 0);
    O.fillStyle = '#ddd'; O.font = '28px Cinzel'; O.textAlign = 'center'; O.fillText(k, x, 1010);
  });
  comp.render(L, { cam: [960, 540, 1], lb: 1, amb: .6, haze: .05, bloom: .25, expo: 1.2 });
}

export function dragonTest(Lc, comp, L, t) {
  const { G, S, R, O } = Lc;
  for (const c of [G, S, R, O]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1920, 1080); }
  S.fillStyle = '#2a2a2e'; S.fillRect(0, 0, 1920, 1080);
  const P = new Pass(G, S);
  ['rear', 'coil', 'reveal'].forEach((k, i) => {
    const x = 330 + i * 630, y = 600;
    S.clearRect(x - 300, 120, 600, 860); G.fillStyle = COL.cobalt; G.fillRect(x - 300, 120, 600, 860);
    const base = new DOMMatrix().translate(x, y).scale(1.6);
    drawDragon(P, base, DPOSE[k], { ember: k === 'rear' ? null : { r: 15, lit: k === 'reveal' ? 1 : 0 } });
    G.setTransform(1, 0, 0, 1, 0, 0); S.setTransform(1, 0, 0, 1, 0, 0);
    O.fillStyle = '#ddd'; O.font = '28px Cinzel'; O.textAlign = 'center'; O.fillText(k, x, 1030);
  });
  comp.render(L, { cam: [960, 540, 1], lb: 1, amb: .6, haze: .05, bloom: .25, expo: 1.2 });
}

// ---------------- MODEL SHEET ----------------
import { voronoi, seedsIn, softPoly, circle as circ, smooth as sm } from './glass.js';
import { mulberry } from '/core/lib.js';
import { lozenges, vineCurl } from './window.js';
const panelCache = new Map();
function archPanel(x, y, w, h, seed) {
  const key = [x, y, w, h, seed].join(); let c = panelCache.get(key); if (c) return c;
  const outer = new Path2D(), inner = new Path2D(), b = 14, R = w * .62;
  const mk = (p, ins) => { const x0 = x + ins, x1 = x + w - ins, cy = y + R * .8, r = R - ins, cx = x + w / 2, th = Math.acos(Math.min(1, (w / 2) / (R))); 
    p.moveTo(x0, y + h - ins); p.lineTo(x0, cy); p.quadraticCurveTo(x0, y + ins + 10, cx, y + ins); p.quadraticCurveTo(x1, y + ins + 10, x1, cy); p.lineTo(x1, y + h - ins); p.closePath(); };
  mk(outer, 0); mk(inner, b);
  const rnd = mulberry(seed), box = [x + b - 4, y + b - 4, x + w - b + 4, y + h - b + 4];
  const cells = lozenges(box, 22, seed);
  c = { outer, inner, cells }; panelCache.set(key, c); return c;
}
function drawPanel(P, pn) {
  P.piece(pn.outer, COL.ruby, { id: 1, lead: 6, mat: false });
  P.g.save(); P.g.clip(pn.inner); P.s.save(); P.s.clip(pn.inner);
  for (const c of pn.cells) P.piece(c.path, c.col, { id: c.id, lead: 4, mat: false, edge: 6, paint: g => vineCurl(g, c.c, 44, c.curl) });
  P.g.restore(); P.s.restore(); P.lead(pn.inner, 6);
}
function label(O, x, y, t1, t2) {
  O.textAlign = 'center'; O.fillStyle = '#e9dcc0'; O.font = '600 22px Cinzel'; O.fillText(t1, x, y);
  if (t2) { O.fillStyle = 'rgba(233,220,192,.72)'; O.font = 'italic 19px "IM Fell English"'; O.fillText(t2, x, y + 25); }
}
export function modelSheet(Lc, comp, L, t) {
  const { G, S, R, O } = Lc;
  for (const c of [G, S, R, O]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1920, 1080); }
  S.fillStyle = '#3a3733'; S.fillRect(0, 0, 1920, 1080);
  S.strokeStyle = 'rgba(0,0,0,.25)'; S.lineWidth = 1; for (let x = 0; x < 1920; x += 48) { S.beginPath(); S.moveTo(x, 0); S.lineTo(x, 1080); S.stroke(); } for (let y = 0; y < 1080; y += 48) { S.beginPath(); S.moveTo(0, y); S.lineTo(1920, y); S.stroke(); }
  const P = new Pass(G, S); const I = new DOMMatrix();
  // header
  O.textAlign = 'left'; O.fillStyle = '#efe2c4'; O.font = '700 34px Cinzel'; O.fillText('THE DRAGON OF THE EAST WINDOW', 44, 52);
  O.font = 'italic 22px "IM Fell English"'; O.fillStyle = 'rgba(239,226,196,.75)'; O.fillText('Model sheet v2 · glass figures cut in pieces, leaded, grisaille-painted · lit from behind as on a glazier’s light table', 44, 82);
  // knight poses
  const kp = [['raise', 'I · The Quest', 'sword raised at dawn'], ['walkA', 'II · The Journey', 'steps piece by piece'], ['guard', 'III · The Battle', 'shield up, fierce'], ['strike', 'IV · The Blow', 'overhead, before the crack'], ['kneel', 'IV · Re-leaded', 'kneels, sword laid down']];
  kp.forEach(([k, t1, t2], i) => {
    const x = 36 + i * 238, y = 104, w = 222, h = 440;
    P.setTransform(I); drawPanel(P, archPanel(x, y, w, h, 11 + i));
    P.g.save(); P.s.save(); P.g.clip(archPanel(x, y, w, h, 11 + i).inner); P.s.clip(archPanel(x, y, w, h, 11 + i).inner);
    const p = k === 'kneel' ? { ...POSE[k], sword: { free: true, x: 34, y: 108, a: -90 * Math.PI / 180 } } : POSE[k], sc = k === 'raise' ? .82 : .96, dx = k === 'kneel' ? -22 : -6;
    drawKnight(P, I.translate(x + w / 2 + dx, y + h - 22 - 182 * sc + (p.rootDy || 0) * sc).scale(sc), p);
    P.setTransform(I); P.g.restore(); P.s.restore();
    label(O, x + w / 2, y + h + 30, t1, t2);
  });
  // faces
  const ex = [['resolute', 'resolute'], ['fierce', 'fierce'], ['wonder', 'wonder'], ['gentle', 'gentle']];
  ex.forEach(([e, n], i) => {
    const cx = 1370 + (i % 2) * 250, cy = 214 + Math.floor(i / 2) * 250, r = 96;
    P.setTransform(I); P.piece(circ(cx, cy, r + 12), COL.ruby, { id: 60 + i, lead: 6, mat: false });
    P.piece(circ(cx, cy, r), COL.cobalt, { id: 70 + i, lead: 6, matW: 14 });
    P.g.save(); P.s.save(); P.g.clip(circ(cx, cy, r)); P.s.clip(circ(cx, cy, r));
    const sc = 3.0; drawKnight(P, I.translate(cx - 25 * sc, cy + 154 * sc).scale(sc), { ...POSE.stand, face: e, neck: 0 }, { noShield: true, noSword: true });
    P.setTransform(I); P.g.restore(); P.s.restore();
    O.textAlign = 'center'; O.fillStyle = 'rgba(233,220,192,.8)'; O.font = 'italic 21px "IM Fell English"'; O.fillText(n, cx, cy + r + 38);
  });
  O.textAlign = 'left'; O.fillStyle = 'rgba(233,220,192,.62)'; O.font = 'italic 18px "IM Fell English"';

  // dragon poses
  const dp = [['rear', 'III · Rearing', 'wings spread, jaws open', null], ['coil', 'IV · Guarding', 'coiled around a dark stone, head low', { r: 15, lit: 0 }], ['reveal', 'IV · The Ember', 'the sun\u2019s last ember, kept warm', { r: 15, lit: 1 }]];
  dp.forEach(([k, t1, t2, em], i) => {
    const x = 36 + i * 400, y = 612, w = 384, h = 392;
    P.setTransform(I); drawPanel(P, archPanel(x, y, w, h, 31 + i));
    P.g.save(); P.s.save(); P.g.clip(archPanel(x, y, w, h, 31 + i).inner); P.s.clip(archPanel(x, y, w, h, 31 + i).inner);
    const sc = k === 'rear' ? 1.0 : 1.12;
    drawDragon(P, I.translate(x + w / 2 + (k === 'rear' ? 40 : 40), y + h - (k === 'rear' ? 150 : 130) * sc).scale(sc), DPOSE[k], { ember: em });
    P.setTransform(I); P.g.restore(); P.s.restore();
    label(O, x + w / 2, y + h + 30, t1, t2);
  });
  // palette
  const pal = [['cobalt', 'Cobalt'], ['ruby', 'Ruby'], ['gold', 'Gold'], ['green', 'Emerald'], ['olive', 'Olive'], ['purple', 'Murrey'], ['flesh', 'Flesh'], ['white', 'White'], ['steel', 'Mail'], ['sky', 'Sky'], ['brown', 'Umber'], ['amber', 'Ember']];
  O.textAlign = 'left'; O.fillStyle = '#e9dcc0'; O.font = '600 22px Cinzel'; O.fillText('GLASS', 1250, 630);
  pal.forEach(([k, n], i) => {
    const x = 1250 + (i % 4) * 160, y = 648 + Math.floor(i / 4) * 118;
    P.setTransform(I); P.piece(sm([[x, y + 8], [x + 70, y], [x + 118, y + 12], [x + 112, y + 74], [x + 50, y + 82], [x + 4, y + 70]]), COL[k], { id: 80 + i, lead: 6, matW: 10, flat: k === 'amber' });
    O.fillStyle = 'rgba(233,220,192,.8)'; O.font = 'italic 18px "IM Fell English"'; O.fillText(n, x + 4, y + 104);
  });
  comp.render(L, { cam: [960, 540, 1], lb: 1, amb: .45, ambCol: [.9, .86, .8], haze: .04, bloom: .22, thr: .7, expo: 1.0, vign: .25, texK: 1 });
}
