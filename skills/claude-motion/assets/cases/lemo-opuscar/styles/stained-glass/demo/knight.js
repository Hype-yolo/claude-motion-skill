// The Knight: a glass figure cut into ~30 pieces, rigid parts on a 2D skeleton (facing right; mirror to face left).
// Units = window units (lancet is 260 wide). Pelvis at origin, feet at y≈+182, top of coif ≈ -186.
import { COL, INK, MAT, smooth, circle, ellipse, brush, line } from './glass.js';

const R = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];

// ---------- shapes (part-local) ----------
const SH = {
  torso: smooth([[-25, 0], [-30, -36], [-28, -78], [-22, -102], [-8, -114], [12, -114], [26, -100], [30, -72], [27, -34], [24, 0]]),
  cape: smooth([[-27, -90], [-19, -110], [-5, -123], [14, -123], [28, -107], [32, -89], [17, -83], [2, -88], [-13, -83]]),
  belt: smooth([[-28, -13, 1], [26, -13, 1], [26, -3, 1], [-28, -3, 1]]),
  buckle: smooth([[14, -15, 1], [22, -15, 1], [22, -1, 1], [14, -1, 1]]),
  skirtB: smooth([[-27, -4, 1], [3, -4, 1], [5, 112, 1], [-10, 118], [-26, 113], [-38, 120], [-50, 111, 1], [-38, 48]]),
  skirtF: smooth([[3, -4, 1], [25, -4, 1], [33, 46], [46, 104, 1], [34, 113], [20, 108], [5, 112, 1]]),
  cloak: smooth([[-20, -104], [-6, -100], [-12, -40], [-22, 50], [-30, 142, 1], [-50, 136], [-72, 146, 1], [-60, 50], [-44, -40], [-32, -92]]),
  coif: smooth([[-16, 6], [-25, -18], [-25, -42], [-15, -61], [3, -67], [21, -61], [29, -45], [31, -27], [27, -6], [14, 7]]),
  face: smooth([[1, -50], [13, -57], [25, -53], [31, -42], [35, -28, 1], [31, -24], [32, -18], [28, -10], [18, -4], [6, -7], [-1, -26]]),
  upper: smooth([[-11, -6], [10, -7], [11.5, 28], [9.5, 58], [-8.5, 59], [-11.5, 30]]),
  fore: smooth([[-9, -3], [9, -3], [9.5, 26], [7.5, 52], [-7.5, 52], [-9.5, 26]]),
  fist: smooth([[-8, -2], [7, -3], [12.5, 5], [12.5, 16], [6, 22.5], [-5, 21.5], [-9.5, 10]]),
  thigh: smooth([[-13, -4], [12, -4], [12.5, 40], [10, 84], [-9.5, 84], [-12.5, 40]]),
  shin: smooth([[-10, -2], [10, -2], [9.5, 40], [7.5, 78], [-7.5, 78], [-9.5, 40]]),
  foot: smooth([[-9, -5], [7, -5], [16, 2], [32, 7], [35, 13.5, 1], [-10, 13.5, 1]]),
  blade: smooth([[-5.5, 15, 1], [5.5, 15, 1], [4.5, 140], [0, 164, 1], [-4.5, 140]]),
  guard: smooth([[-24, 8, 1], [24, 8, 1], [22, 15, 1], [-22, 15, 1]]),
  grip: smooth([[-3.8, -14, 1], [3.8, -14, 1], [3.8, 8, 1], [-3.8, 8, 1]]),
  pommel: circle(0, -19, 7),
  hemB: smooth([[5, 104, 1], [5, 112, 1], [-10, 118], [-26, 113], [-38, 120], [-50, 111, 1], [-47, 103, 1], [-37, 111], [-26, 105], [-10, 110], [5, 104, 1]]),
  hemF: smooth([[5, 104, 1], [20, 100], [34, 105], [44, 96, 1], [46, 104, 1], [34, 113], [20, 108], [5, 112, 1]]),
  neck: smooth([[-12, -110], [2, -104], [16, -110, 1], [14, -102], [2, -96], [-10, -102, 1]]),
  cloakEdge: smooth([[-6, -100], [-12, -40], [-22, 50], [-30, 142, 1], [-38, 140, 1], [-30, 50], [-20, -40], [-13, -100]]),
  thumb: smooth([[6, -1], [12, 2], [14, 9, 1], [9, 8], [4, 4]]),
  shieldO: smooth([[-37, -45], [0, -51], [37, -45], [35, 0], [21, 45], [0, 84, 1], [-21, 45], [-35, 0]]),
  shieldI: smooth([[-30, -39], [0, -44], [30, -39], [28.5, 0], [16.5, 40], [0, 73, 1], [-16.5, 40], [-28.5, 0]]),
  sun: circle(0, 2, 13),
};
const RAYS = [];
for (let i = 0; i < 8; i++) {
  const a = i / 8 * Math.PI * 2 + Math.PI / 8, c = Math.cos(a), s = Math.sin(a), n = [-s, c];
  const r0 = 16.5, r1 = i % 2 ? 24 : 27, w = 5.6;
  RAYS.push(smooth([[c * r0 + n[0] * w, 2 + s * r0 + n[1] * w, 1], [c * r1, 2 + s * r1, 1], [c * r0 - n[0] * w, 2 + s * r0 - n[1] * w, 1]]));
}

// ---------- grisaille ----------
function mail(g, x0, y0, x1, y1, sp = 5.2) {   // staggered ring arcs
  g.strokeStyle = 'rgba(40,26,14,.62)'; g.lineWidth = 1.25; g.beginPath();
  let row = 0;
  for (let y = y0; y < y1; y += sp * .72, row++) for (let x = x0 + (row % 2) * sp * .5; x < x1; x += sp) { g.moveTo(x - sp * .38, y); g.arc(x, y, sp * .38, Math.PI, 0, true); }
  g.stroke();
}
function folds(g, list, w = 2.2, hi) {
  for (const f of list) { brush(g, f, w * 4.2, { w0: .2, w1: .3, color: 'rgba(52,30,14,.2)' }); }
  if (hi) for (const f of list) { const o = f.map(q => [q[0] + 3.4, q[1]]); brush(g, o, w * 1.5, { w0: .2, w1: .2, color: g.__col }); }   // highlight scraped out of the mat beside each fold
  for (const f of list) { brush(g, f, w, { w0: .15, w1: .1 }); const n = f.length, a = f[n - 2], b = f[n - 1]; brush(g, [b, [b[0] + (b[0] - a[0]) * .15 - 4, b[1] + (b[1] - a[1]) * .15 + 2]], w * .9, { w0: .9, w1: .2 }); }   // hooked fold ends
}
function hatch(g, x0, y0, x1, y1, sp = 3.4, a = .35) { g.strokeStyle = `rgba(44,26,12,${a})`; g.lineWidth = .9; g.beginPath(); for (let x = x0; x < x1; x += sp) { g.moveTo(x, y0); g.lineTo(x + (y1 - y0) * .35, y1); } g.stroke(); }

function fingers(g) {
  for (const y of [6, 11, 16]) brush(g, [[-2, y + 1], [6, y], [12, y + 1.5]], 1.3, { w0: .5, w1: .6 });
  brush(g, [[-7, 4], [-8, 12], [-5, 20]], 1.2, { color: 'rgba(44,26,12,.5)' });
  g.fillStyle = 'rgba(92,52,28,.22)'; g.fill(ellipse(-4, 12, 5, 10));
}
export const EXPR = {
  resolute: { bi: 1.2, bo: -.6, bh: 0, lid: .9, px: .6, py: 0, mouth: 'line' },
  fierce: { bi: 4.6, bo: -2, bh: .8, lid: .6, px: 1.2, py: -.3, mouth: 'grim' },
  wonder: { bi: -3.4, bo: -2.6, bh: -3, lid: 1.2, px: .4, py: .3, mouth: 'open' },
  gentle: { bi: -2.6, bo: 1.2, bh: -.2, lid: .5, px: .2, py: 1.3, mouth: 'soft' },
};
function faceGrisaille(g, e) {
  // soft mat along the back of the face and under the jaw (modelling)
  const gr = g.createLinearGradient(-2, 0, 22, 0); gr.addColorStop(0, 'rgba(80,44,22,.42)'); gr.addColorStop(1, 'rgba(80,44,22,0)'); g.fillStyle = gr; g.fillRect(-4, -60, 30, 60);
  g.fillStyle = 'rgba(80,44,22,.25)'; g.fill(ellipse(20, -6, 12, 4.5)); g.fill(ellipse(14, -46, 10, 5));
  g.fillStyle = 'rgba(170,70,60,.12)'; g.fill(ellipse(20, -24, 4.5, 3.4));   // faint cheek
  const bh = e.bh;
  // brows: near brow + far brow flowing into the nose line (medieval brow-nose line)
  brush(g, [[11.5, -40.5 + bh + e.bo], [17.5, -42.8 + bh], [23.4, -41.4 + bh + e.bi]], 3.8, { w0: .35, w1: .55 });
  brush(g, [[26.2, -41.2 + bh + e.bi * .8], [30, -42.2 + bh], [32.6, -39.5 + bh * .5], [33.4, -33], [34.4, -28.4]], 3.0, { w0: .5, w1: .6 });
  brush(g, [[30.2, -25.2], [32.4, -24.3], [34, -26.2]], 1.3, { w0: .5, w1: .5 });  // nostril
  // eyes (almond): upper lid heavy, lower lid light, big dark pupil
  const eye = (cx, cy, w, h, pr) => {
    const L = e.lid;
    brush(g, [[cx - w * .55, cy + .3], [cx - w * .1, cy - h * L], [cx + w * .55, cy - .1]], 3.0, { w0: .45, w1: .35 });
    brush(g, [[cx - w * .45, cy + .9], [cx, cy + h * .62], [cx + w * .45, cy + .5]], .8, { w0: .3, w1: .3, color: 'rgba(44,26,12,.6)' });
    g.save(); g.beginPath(); g.moveTo(cx - w * .5, cy + .3); g.quadraticCurveTo(cx - w * .1, cy - h * L * 1.9, cx + w * .5, cy);
    g.quadraticCurveTo(cx, cy + h * 1.2, cx - w * .5, cy + .3); g.clip();
    g.fillStyle = INK; g.beginPath(); g.arc(cx + e.px, cy - .4 + e.py, pr, 0, 7); g.fill(); g.restore();
  };
  eye(17.8, -35.2, 10.5, 3.7, 2.6);
  eye(28.7, -35.4, 6.6, 3.2, 2.1);
  // mouth
  const m = e.mouth;
  if (m === 'line') brush(g, [[24.2, -18.2], [27.4, -18.6], [30.6, -18.4]], 2.6, { w0: .4, w1: .4 });
  if (m === 'grim') brush(g, [[23.8, -17.2], [27.4, -18.8], [30.6, -17.9]], 2.9, { w0: .4, w1: .4 });
  if (m === 'soft') brush(g, [[24.2, -18.9], [27.4, -17.9], [30.4, -18.9]], 2.5, { w0: .4, w1: .4 });
  if (m === 'open') { g.fillStyle = 'rgba(44,26,12,.8)'; g.fill(ellipse(27.8, -17.4, 2.5, 3)); }
  brush(g, [[12.5, -33], [18, -31], [23, -33.2]], .8, { w0: .3, w1: .3, color: 'rgba(44,26,12,.45)' });   // lower lid crease
  brush(g, [[13, -26], [16, -22], [21, -20.5]], .9, { w0: .2, w1: .3, color: 'rgba(44,26,12,.4)' });   // cheek line
  brush(g, [[22.4, -11.6], [25.2, -10.6], [28, -11.4]], 1.0, { w0: .3, w1: .3, color: 'rgba(44,26,12,.55)' });   // chin
  brush(g, [[9.2, -15], [14, -9.8], [20, -8.2]], 1.0, { w0: .2, w1: .2, color: 'rgba(44,26,12,.45)' });   // jaw
}

// ---------- forward kinematics ----------
export function fk(p) {
  const L = p.lean || 0, J = {};
  J.torso = [0, 0, L];
  const neck = R(4, -118, L); J.head = [neck[0], neck[1], L + (p.neck || 0)];
  const sh = (loc, s, e, h) => {
    const S = R(loc[0], loc[1], L), aU = L + s, E = add(S, R(0, 58, aU)), aL = aU + e, W = add(E, R(0, 52, aL)), aH = aL + (h || 0);
    return { up: [S[0], S[1], aU], fo: [E[0], E[1], aL], ha: [W[0], W[1], aH] };
  };
  const F = sh([12, -100], p.sF || 0, p.eF || 0, p.hF), B = sh([-8, -102], p.sB || 0, p.eB || 0, 0);
  J.upF = F.up; J.foF = F.fo; J.haF = F.ha; J.upB = B.up; J.foB = B.fo; J.haB = B.ha;
  const leg = (hx, h, k, a) => { const H = [hx, 6], K = add(H, R(0, 84, h)), aS = h + k, A = add(K, R(0, 78, aS)); return { th: [H[0], H[1], h], sh: [K[0], K[1], aS], ft: [A[0], A[1], aS + (a || 0)] }; };
  const LB = leg(-7, p.hB || 0, p.kB || 0, p.aB), LF = leg(7, p.hF || 0, p.kF || 0, p.aF);
  J.thB = LB.th; J.shB = LB.sh; J.ftB = LB.ft; J.thF = LF.th; J.shF = LF.sh; J.ftF = LF.ft;
  J.skirt = [0, 0, L * .35 + ((p.hB || 0) + (p.hF || 0)) * .28 + (p.skirt || 0)];
  J.cloak = [0, 0, L + (p.cloak || 0)];
  // sword (in hand, or free on the ground)
  if (p.sword && p.sword.free) J.sword = [p.sword.x, p.sword.y, p.sword.a];
  else { const g = add([J.haF[0], J.haF[1]], R(2.5, 10, J.haF[2])); J.sword = [g[0], g[1], J.haF[2] + (p.wF || 0)]; }
  // shield rides on the far forearm, kept nearly upright
  const sp = add([J.foB[0], J.foB[1]], R(4, 30, J.foB[2])); J.shield = [sp[0] + (p.shX || 0), sp[1] + (p.shY || 0), L + (p.shA || 0)];
  return J;
}

// ---------- draw ----------
// P: Pass; base: DOMMatrix for the figure root (position/scale/mirror); p: pose; o: {detach: 0..1 per part map, hide}
export function drawKnight(P, base, p, o = {}) {
  const J = fk(p), e = EXPR[p.face || 'resolute'] || EXPR.resolute;
  const off = o.off || {};   // per-part extra offsets during re-leading: {name:[dx,dy,da]}
  const at = (name, j, sc = 1) => { const d = off[name]; let m = base.translate(j[0] + (d ? d[0] : 0), j[1] + (d ? d[1] : 0)).rotate(((j[2] + (d ? d[2] : 0)) * 180 / Math.PI)); if (sc !== 1) m = m.scale(sc); P.setTransform(m); };
  const LW = 6.2, ID = o.id || 100;
  // cloak (behind)
  at('cloak', J.cloak);
  P.piece(SH.cloak, COL.purple, { id: ID + 1, lead: LW, wash: .45, shade: [-70, 0, -10, 0, .45], paint: g => { folds(g, [[[-30, -60], [-38, 30], [-46, 132]], [[-22, -40], [-28, 50], [-36, 136]], [[-44, -20], [-54, 70], [-62, 138]]], 2.6, true); hatch(g, -72, 60, -48, 146); } });
  P.piece(SH.cloakEdge, COL.gold, { id: ID + 40, lead: LW * .7, mat: false, paint: g => { g.fillStyle = 'rgba(60,34,10,.55)'; for (let k = 0; k < 9; k++) { const u = k / 8; g.beginPath(); g.arc(-9 - u * 24, -90 + u * 226, 1.5, 0, 7); g.fill(); } } });
  // far arm (upper + fore + hand)
  at('upB', J.upB); P.piece(SH.upper, COL.steel2, { id: ID + 2, lead: LW, paint: g => mail(g, -12, -4, 12, 60) });
  at('foB', J.foB); P.piece(SH.fore, COL.steel2, { id: ID + 3, lead: LW, paint: g => mail(g, -10, -2, 10, 52) });
  at('haB', J.haB, 1.15); P.piece(SH.fist, COL.flesh, { id: ID + 4, lead: LW * .8, matW: 5, paint: fingers });
  // legs: far then near
  for (const [s, k] of [['B', 0], ['F', 1]]) {
    at('th' + s, J['th' + s]); P.piece(SH.thigh, k ? COL.steel : COL.steel2, { id: ID + 5 + k * 3, lead: LW, shade: [-13, 0, 13, 0, .38], paint: g => mail(g, -13, -2, 13, 84) });
    at('sh' + s, J['sh' + s]); P.piece(SH.shin, k ? COL.steel : COL.steel2, { id: ID + 6 + k * 3, lead: LW, shade: [-10, 0, 10, 0, .38], paint: g => { mail(g, -10, 8, 10, 78); line(g, [[-8, 4], [0, 9], [8, 4]], 1.8); } });
    at('ft' + s, J['ft' + s]); P.piece(SH.foot, COL.brown, { id: ID + 7 + k * 3, lead: LW, paint: g => { folds(g, [[[-4, -2], [4, 6], [10, 12]], [[6, 1], [14, 7], [20, 12]]], 1.4); } });
  }
  // torso group
  at('skirt', J.skirt);
  P.piece(SH.skirtB, COL.ruby, { id: ID + 12, lead: LW, wash: .4, shade: [-50, 0, 5, 0, .4], paint: g => { folds(g, [[[-6, 10], [-8, 60], [-10, 106]], [[-18, 12], [-24, 60], [-27, 104]], [[-28, 20], [-38, 70], [-44, 106]]], 2.5, true); hatch(g, -50, 70, -30, 112); } });
  P.piece(SH.skirtF, COL.ruby, { id: ID + 13, lead: LW, wash: .35, shade: [5, 0, 45, 0, .2], paint: g => folds(g, [[[14, 10], [20, 60], [24, 100]], [[24, 20], [32, 64], [38, 98]]], 2.5, true) });
  P.piece(SH.hemB, COL.gold, { id: ID + 41, lead: LW * .7, mat: false, paint: g => { g.fillStyle = 'rgba(60,34,10,.55)'; for (let x = -44; x < 2; x += 7) { g.beginPath(); g.arc(x, 110 + Math.sin(x * .3) * 2, 1.4, 0, 7); g.fill(); } } });
  P.piece(SH.hemF, COL.gold, { id: ID + 42, lead: LW * .7, mat: false });
  at('torso', J.torso);
  P.piece(SH.torso, COL.ruby, { id: ID + 14, lead: LW, wash: .4, shade: [-30, 0, 20, 0, .4], paint: g => { folds(g, [[[-14, -20], [-18, -60], [-12, -96]], [[6, -24], [10, -60], [8, -90]], [[-24, -26], [-2, -38], [22, -26]], [[-20, -12], [0, -22], [20, -14]]], 2.3, true); hatch(g, -32, -90, -18, -20); } });
  P.piece(SH.neck, COL.gold, { id: ID + 43, lead: LW * .7, mat: false });
  P.piece(SH.belt, COL.gold, { id: ID + 15, lead: LW * .8, mat: false, paint: g => { g.fillStyle = 'rgba(44,26,12,.5)'; for (let x = -22; x < 12; x += 6) { g.beginPath(); g.arc(x, -8, 1.2, 0, 7); g.fill(); } } });
  P.piece(SH.cape, COL.steel, { id: ID + 16, lead: LW, paint: g => mail(g, -28, -124, 34, -82, 4.8) });
  // head
  at('head', J.head, 1.16);
  P.piece(SH.coif, COL.steel, { id: ID + 17, lead: LW / 1.16, shade: [-25, 0, 20, 0, .42], paint: g => { mail(g, -26, -68, 32, 8, 4.6); line(g, [[-2, -64], [-12, -40], [-12, -14]], 1.6, 'rgba(44,26,12,.6)'); brush(g, [[4, -52], [18, -56], [28, -50]], 3.4, { color: 'rgba(44,26,12,.4)' }); } });
  const faceID = o.faceId ?? ID + 18;
  P.piece(SH.face, COL.flesh, { id: faceID, vary: .04, lead: LW * .75, matW: 5, matA: .9, paint: g => faceGrisaille(g, e) });
  // shield (held forward on far arm)
  if (!o.noShield) {
    at('shield', J.shield);
    P.piece(SH.shieldO, COL.steel, { id: ID + 19, lead: LW, mat: false });
    P.piece(SH.shieldI, COL.gold, { id: ID + 20, lead: LW * .9, matW: 10, shade: [-30, -40, 30, 60, .3], paint: g => { g.strokeStyle = 'rgba(80,40,10,.35)'; g.lineWidth = 1; for (let y = -34; y < 70; y += 9) for (let x = -28 + ((y / 9) & 1) * 4.5; x < 30; x += 9) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.stroke(); } g.fillStyle = 'rgba(44,26,12,.6)'; for (const [x, y] of [[-22, -33], [22, -33], [-22, 10], [22, 10], [0, 50]]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); } } });
    RAYS.forEach((r, i) => P.piece(r, COL.ruby, { id: ID + 30 + i, lead: LW * .7, mat: false }));
    P.piece(SH.sun, COL.ruby, { id: ID + 21, lead: LW * .8, matW: 6, paint: g => { brush(g, [[-6, 0], [-2, 4], [3, 3]], 1.2, { color: 'rgba(44,26,12,.5)' }); } });
  }
  // sword then near arm (fist wraps the grip)
  if (!o.noSword) {
    at('sword', J.sword);
    P.piece(SH.blade, COL.white, { id: ID + 22, lead: LW * .85, matW: 5, paint: g => line(g, [[0, 22], [0, 132]], 1.3, 'rgba(44,26,12,.55)') });
    P.piece(SH.guard, COL.gold, { id: ID + 23, lead: LW * .8, mat: false });
    P.piece(SH.grip, COL.brown, { id: ID + 24, lead: LW * .7, mat: false, paint: g => { for (let y = -12; y < 8; y += 4) line(g, [[-4, y], [4, y + 2]], .9, 'rgba(44,26,12,.6)'); } });
    P.piece(SH.pommel, COL.gold, { id: ID + 25, lead: LW * .8, mat: false });
  }
  at('upF', J.upF); P.piece(SH.upper, COL.steel, { id: ID + 26, lead: LW, shade: [-12, 0, 12, 0, .35], paint: g => mail(g, -12, -4, 12, 60) });
  at('foF', J.foF); P.piece(SH.fore, COL.steel, { id: ID + 27, lead: LW, shade: [-10, 0, 10, 0, .35], paint: g => mail(g, -10, -2, 10, 52) });
  at('haF', J.haF, 1.15); P.piece(SH.fist, COL.flesh, { id: ID + 28, lead: LW * .8, matW: 5, paint: fingers }); P.piece(SH.thumb, COL.flesh, { id: ID + 44, lead: LW * .6, mat: false, paint: g => brush(g, [[8, 3], [12, 6]], 1, {}) });
  return J;
}

// ---------- poses ----------
const D = Math.PI / 180;
export const POSE = {
  stand: { lean: 0, neck: 0, sF: -18 * D, eF: -60 * D, wF: 58 * D, sB: -30 * D, eB: -70 * D, hB: 4 * D, kB: 2 * D, hF: -4 * D, kF: 2 * D, face: 'resolute', shA: 0 },
  raise: { lean: -3 * D, neck: -10 * D, sF: -168 * D, eF: -6 * D, wF: 0, sB: -38 * D, eB: -62 * D, hB: 6 * D, kB: 3 * D, aB: -3 * D, hF: -8 * D, kF: 5 * D, face: 'resolute', shA: 0 },
  walkA: { lean: 3 * D, neck: 0, sF: 10 * D, eF: -40 * D, wF: 10 * D, sB: -40 * D, eB: -60 * D, hB: 22 * D, kB: 18 * D, aB: -8 * D, hF: -24 * D, kF: 12 * D, aF: 4 * D, face: 'resolute', shA: 0 },
  walkB: { lean: 3 * D, neck: 0, sF: -14 * D, eF: -50 * D, wF: 44 * D, sB: -30 * D, eB: -64 * D, hB: -18 * D, kB: 24 * D, aB: 6 * D, hF: 16 * D, kF: 6 * D, aF: -6 * D, face: 'resolute', shA: 0 },
  guard: { lean: -5 * D, neck: -4 * D, sF: -60 * D, eF: -95 * D, wF: 25 * D, sB: -75 * D, eB: -30 * D, hB: 24 * D, kB: 10 * D, aB: -10 * D, hF: -28 * D, kF: 24 * D, aF: 0, face: 'fierce', shA: 8 * D, shX: 16, shY: -14 },
  strike: { lean: -10 * D, neck: -12 * D, sF: -150 * D, eF: -75 * D, wF: 12 * D, sB: -46 * D, eB: -60 * D, hB: 28 * D, kB: 12 * D, aB: -14 * D, hF: -26 * D, kF: 28 * D, face: 'fierce', shA: 6 * D },
  blow: { lean: 12 * D, neck: 6 * D, sF: -70 * D, eF: -10 * D, wF: 22 * D, sB: -30 * D, eB: -60 * D, hB: 30 * D, kB: 14 * D, aB: -14 * D, hF: -36 * D, kF: 36 * D, face: 'fierce', shA: 10 * D },
  kneel: { lean: 10 * D, neck: 16 * D, sF: -34 * D, eF: -40 * D, hF_: 0, sB: -20 * D, eB: -80 * D, hB: 6 * D, kB: 92 * D, aB: -6 * D, hF: -86 * D, kF: 86 * D, aF: 0, face: 'gentle', shA: -4 * D, shX: 6, shY: 10, sword: { free: true, x: 70, y: 106, a: -90 * D }, rootDy: 78 },
};
export const lerpPose = (a, b, t) => {
  const o = {}; for (const k in a) { const va = a[k], vb = b[k] ?? va; o[k] = typeof va === 'number' ? va + (vb - va) * t : (t < .5 ? va : vb); }
  for (const k in b) if (!(k in o)) o[k] = b[k]; return o;
};
