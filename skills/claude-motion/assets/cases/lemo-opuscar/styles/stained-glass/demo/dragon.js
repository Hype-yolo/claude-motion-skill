// The Dragon: a banded glass serpent (spine chain cut into dorsal/belly pieces), jointed head + jaw,
// two legs, two ribbed wings. Faces right; mirror the base matrix to face left.
import { COL, INK, smooth, circle, ellipse, brush, line, sampleCurve } from './glass.js';

const D2R = Math.PI / 180;
const cs = a => [Math.cos(a), Math.sin(a)];

export function spine(p) {
  const NL = p.neckL || 25, TL = p.tailL || 25;
  const nb = p.neck || [0, 0, 0, 0], tb = p.tail || new Array(10).fill(0);
  const root = p.root || [0, 0];
  const neck = [root.slice()], tail = [root.slice()];
  let a = p.rootA * D2R, q = root.slice();
  for (let i = 0; i < nb.length; i++) { a += nb[i] * D2R; const d = cs(a); q = [q[0] + d[0] * NL, q[1] + d[1] * NL]; neck.push(q); }
  const headA = a + (p.head || 0) * D2R;
  a = p.rootA * D2R + Math.PI; q = root.slice();
  for (let i = 0; i < tb.length; i++) { a += tb[i] * D2R; const d = cs(a); q = [q[0] + d[0] * TL, q[1] + d[1] * TL]; tail.push(q); }
  const tailA = a;
  // centreline tail-tip -> root -> head base, with widths
  const pts = tail.slice().reverse().concat(neck.slice(1));
  const nT = tail.length - 1, nN = neck.length - 1;
  const body = p.body || 50;
  const wid = pts.map((_, i) => {
    if (i <= nT) { const u = i / nT; return 5 + (body - 5) * Math.pow(u, 1.2); }
    const u = (i - nT) / nN; return body - (body - 30) * u;
  });
  return { pts, wid, nT, nN, headA, tailA, head: neck[neck.length - 1], root };
}

// outline curves of the body (dorsal edge, belly line, ventral edge), densely sampled
function outline(sp, per = 6) {
  const c = sampleCurve(sp.pts, per), n = c.length, W = [];
  for (let i = 0; i < n; i++) { const f = i / per, k = Math.min(sp.wid.length - 2, Math.floor(f)), u = f - k; W.push(sp.wid[k] * (1 - u) + sp.wid[k + 1] * u); }
  const dor = [], bel = [], ven = [], nor = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const nx = dy, ny = -dx; nor.push([nx, ny, dx, dy]);   // dorsal normal (up when facing right)
    dor.push([c[i][0] + nx * W[i] * .5, c[i][1] + ny * W[i] * .5]);
    bel.push([c[i][0] - nx * W[i] * .14, c[i][1] - ny * W[i] * .14]);
    ven.push([c[i][0] - nx * W[i] * .5, c[i][1] - ny * W[i] * .5]);
  }
  return { c, W, dor, bel, ven, nor, per };
}
const pathOf = pts => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; };

function scales(g, O, i0, i1) {   // grisaille scale arcs on a dorsal band, following the spine
  g.strokeStyle = 'rgba(30,40,14,.55)'; g.lineWidth = 1.3; g.beginPath();
  for (let i = i0; i <= i1; i += 1) {
    const [nx, ny, dx, dy] = O.nor[i], c = O.c[i], w = O.W[i];
    const rows = Math.max(1, Math.round(w / 12));
    for (let r = 0; r < rows; r++) {
      const off = w * (.42 - (r + .5) / rows * .52) ; const sh = (r % 2) * .5;
      if ((i + (r % 2 ? 0 : 2)) % 2 !== 0) continue;
      const x = c[0] + nx * off + dx * sh * 4, y = c[1] + ny * off + dy * sh * 4, rr = Math.max(2, w * .1);
      const a0 = Math.atan2(dy, dx);
      g.moveTo(x + Math.cos(a0 + Math.PI * .5) * rr, y + Math.sin(a0 + Math.PI * .5) * rr);
      g.arc(x, y, rr, a0 + Math.PI * .5, a0 - Math.PI * .5, true);
    }
  }
  g.stroke();
}
function plates(g, O, i0, i1) {   // transverse belly plates
  for (let i = i0 + 1; i < i1; i += 2) { brush(g, [O.bel[i], [(O.bel[i][0] + O.ven[i][0]) / 2, (O.bel[i][1] + O.ven[i][1]) / 2], O.ven[i]], 1.6, { w0: .4, w1: .4, color: 'rgba(60,34,10,.6)' }); }
}

// ---------- head (local: neck end at origin, facing +x) ----------
const HEAD = {
  skull: smooth([[-12, -14], [-2, -30], [18, -38], [38, -33], [52, -26], [64, -25], [74, -30], [84, -27, 1], [80, -15], [66, -7], [42, -3], [16, 3], [-10, 6]]),
  jaw: smooth([[-8, 2], [20, 5], [48, 5], [68, 2], [74, 7, 1], [58, 17], [30, 21], [10, 28, 1], [2, 16]]),
  mouth: smooth([[2, 2], [70, -2], [74, 7], [36, 12], [6, 10]]),
  horn: smooth([[2, -28], [14, -34], [-6, -50], [-34, -60], [-50, -52, 1], [-30, -50], [-12, -40]]),
  horn2: smooth([[16, -35], [26, -38], [14, -56], [-4, -72, 1], [4, -52]]),
  frill: smooth([[-6, -12], [-14, -28], [-32, -34, 1], [-24, -20], [-38, -12, 1], [-22, -4], [-30, 10, 1], [-10, 6]]),
  eye: ellipse(34, -21, 8.5, 6.2, -.1),
  tooth: [smooth([[46, 0, 1], [52, -1, 1], [49, 8, 1]]), smooth([[58, -1, 1], [64, -2, 1], [61, 7, 1]])],
};
function headPaint(g) {
  brush(g, [[18, -30], [32, -31], [46, -25]], 3, { w0: .3, w1: .4 });                // brow ridge
  brush(g, [[74, -22], [79, -24], [81, -20], [77, -18]], 2, { w0: .5, w1: .5 });     // nostril curl
  brush(g, [[4, -4], [30, -6], [56, -8], [74, -12]], 1.5, { color: 'rgba(30,40,14,.5)' });
  brush(g, [[8, -12], [14, -20], [22, -26]], 1.3, { color: 'rgba(30,40,14,.45)' });  // cheek
  g.strokeStyle = 'rgba(30,40,14,.5)'; g.lineWidth = 1.3; g.beginPath();
  for (let x = 44; x < 70; x += 8) { g.moveTo(x, -18); g.arc(x + 3, -18, 3, Math.PI, 0); }
  for (let x = -2; x < 24; x += 8) { g.moveTo(x, -8); g.arc(x + 3, -8, 3, Math.PI, 0); }
  g.stroke();
}

// ---------- wing ----------
function wingGeo(S, p) {
  const hA = p.humA * D2R, E = [S[0] + Math.cos(hA) * p.humL, S[1] + Math.sin(hA) * p.humL];
  const fA = hA + p.foreA * D2R, W = [E[0] + Math.cos(fA) * p.foreL, E[1] + Math.sin(fA) * p.foreL];
  const L = p.fingL || [132, 142, 122, 96];
  const F = p.fing.map((a, i) => [W[0] + Math.cos(a * D2R) * L[i] * (p.fingS || 1), W[1] + Math.sin(a * D2R) * L[i] * (p.fingS || 1)]);
  return { S, E, W, F };
}
function bone(P, a, b, w0, w1, id, lead = 3.4) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  const pth = smooth([[a[0] + nx * w0, a[1] + ny * w0], [b[0] + nx * w1, b[1] + ny * w1], [b[0] - nx * w1, b[1] - ny * w1], [a[0] - nx * w0, a[1] - ny * w0]]);
  P.piece(pth, COL.gold, { id, lead, mat: false });
}
function drawWing(P, geo, B, far, id, folded) {
  const { S, E, W, F } = geo;
  const cols = far ? [COL.purple2, COL.purple] : [COL.ruby, COL.ruby2];
  if (folded && geo.fold) {   // classic folded wing: wrist knuckle up, pleated blade sweeping back over the body
    const [sx, sy] = S, L = geo.fold, K = [sx - 6, sy - 50], T = [sx - L, sy - 4];
    const bands = [[K, [sx - L * .55, sy - 58], T, [sx - L * .6, sy - 30]], [K, [sx - L * .6, sy - 30], T, [sx - L * .5, sy - 12]], [K, [sx - L * .5, sy - 12], T, [sx - 10, sy - 8]]];
    bands.forEach((b, j) => P.piece(smooth([[b[0][0], b[0][1], 1], b[1], [b[2][0], b[2][1], 1], b[3]]), cols[j % 2], { id: id + j, lead: 4.5, matW: 8, shade: [K[0], K[1], T[0], T[1], .25] }));
    bone(P, S, K, 5, 4, id + 10, 3.4); bone(P, K, [sx - L * .55, sy - 58], 3.6, 2, id + 11, 3);
    P.solder(K[0], K[1], 5);
    return;
  }
  if (folded) {   // wing closed along the back: a draped membrane with pleat leads
    const d = [W[0] - E[0], W[1] - E[1]], L = Math.hypot(d[0], d[1]) || 1, n = [-d[1] / L, d[0] / L];
    const drop = folded, k = [E, W, [W[0] + n[0] * drop * .4 + d[0] * .25, W[1] + n[1] * drop * .4 + d[1] * .25], [W[0] + n[0] * drop, W[1] + n[1] * drop], [S[0] + n[0] * drop * .7, S[1] + n[1] * drop * .7]];
    for (let j = 0; j < 3; j++) {
      const u0 = j / 3, u1 = (j + 1) / 3, L0 = [E[0] + d[0] * u0, E[1] + d[1] * u0], L1 = [E[0] + d[0] * u1, E[1] + d[1] * u1];
      const dp = drop * (.75 + j * .12);
      P.piece(smooth([[L0[0], L0[1], 1], [L1[0], L1[1], 1], [L1[0] + n[0] * dp, L1[1] + n[1] * dp, 1], [(L0[0] + L1[0]) / 2 + n[0] * dp * .86, (L0[1] + L1[1]) / 2 + n[1] * dp * .86], [L0[0] + n[0] * dp * .95, L0[1] + n[1] * dp * .95, 1]]), cols[j % 2], { id: id + j, lead: 5, matW: 10, shade: [L0[0], L0[1], L0[0] + n[0] * dp, L0[1] + n[1] * dp, .3] });
    }
    bone(P, S, E, 5.5, 4.5, id + 10, 3.6); bone(P, E, W, 4.5, 3.6, id + 11, 3.6);
    P.solder(W[0], W[1], 5); P.solder(E[0], E[1], 4.5);
    return;
  }
  const mem = (a, b, k = .2) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], q = [m[0] + (W[0] - m[0]) * k, m[1] + (W[1] - m[1]) * k]; return q; };
  // front membrane S-E-W-F0 then between fingers, last back to body
  const seq = [];
  seq.push(smooth([[S[0], S[1], 1], [E[0], E[1], 1], [W[0], W[1], 1], [F[0][0], F[0][1], 1], mem(S, F[0], .1)]));
  for (let i = 0; i < 3; i++) seq.push(smooth([[W[0], W[1], 1], [F[i][0], F[i][1], 1], mem(F[i], F[i + 1]), [F[i + 1][0], F[i + 1][1], 1]]));
  seq.push(smooth([[W[0], W[1], 1], [F[3][0], F[3][1], 1], mem(F[3], B), [B[0], B[1], 1], [S[0], S[1], 1]]));
  const tips = [E].concat(F);
  seq.forEach((pth, i) => P.piece(pth, cols[i % 2], { id: id + i, lead: 5, matW: 12, paint: g => {
    // membrane veins: fine grisaille lines from the wrist
    const a = tips[Math.min(i, 4)], b = i < 4 ? tips[i + 1] || B : B;
    for (let k = 1; k < 3; k++) { const u = k / 3, q = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; brush(g, [W, [(W[0] + q[0]) / 2 + 4, (W[1] + q[1]) / 2], q], 1.4, { w0: .6, w1: .1, color: 'rgba(60,10,16,.45)' }); }
  } }));
  bone(P, S, E, 5.5, 4.5, id + 10, 3.6); bone(P, E, W, 4.5, 3.6, id + 11, 3.6);
  F.forEach((f, i) => bone(P, W, f, 3, .9, id + 12 + i, 2.6));
  P.solder(W[0], W[1], 5); P.solder(E[0], E[1], 4.5);
}

// ---------- legs ----------
const LEG = {
  thigh: smooth([[-16, -10], [14, -12], [14, 20], [8, 44], [-8, 44], [-17, 14]]),
  shin: smooth([[-7, -3], [7, -3], [6, 38], [-5, 38]]),
  foot: smooth([[-8, -4], [9, -4], [20, 3], [33, 6, 1], [22, 10], [29, 15, 1], [16, 13], [17, 20, 1], [5, 15], [-8, 9]]),
};
function drawLeg(P, base, at, a1, a2, a3, far, id) {
  const col = far ? COL.green2 : COL.green;
  const m0 = base.translate(at[0], at[1]).rotate(a1);
  P.setTransform(m0); P.piece(LEG.thigh, col, { id, lead: 4.5, matW: 8 });
  const m1 = m0.translate(0, 42).rotate(a2);
  P.setTransform(m1); P.piece(LEG.shin, col, { id: id + 1, lead: 4.5, matW: 6 });
  const m2 = m1.translate(0, 36).rotate(a3);
  P.setTransform(m2); P.piece(LEG.foot, COL.gold, { id: id + 2, lead: 4, mat: false, paint: g => { brush(g, [[2, 4], [12, 6], [20, 9]], 1.3); brush(g, [[0, 8], [8, 12], [14, 15]], 1.3); } });
  P.setTransform(m0); P.piece(LEG.thigh, col, { id: id + 3, lead: 4.5, matW: 8, paint: g => { g.strokeStyle = 'rgba(30,40,14,.5)'; g.lineWidth = 1.3; g.beginPath(); for (let y = -2; y < 36; y += 8) for (let x = -10; x < 12; x += 8) { g.moveTo(x - 3.5, y); g.arc(x, y, 3.5, Math.PI, 0, true); } g.stroke(); } });
}

function emberCol(lit, k) {   // cold dark stone -> glowing ember
  const A = [[70, 38, 20], [60, 30, 16], [96, 60, 30]][k], B = [[255, 120, 30], [255, 150, 40], [255, 236, 170]][k];
  const f = x => Math.round(x);
  return `rgb(${f(A[0] + (B[0] - A[0]) * lit)},${f(A[1] + (B[1] - A[1]) * lit)},${f(A[2] + (B[2] - A[2]) * lit)})`;
}
// ---------- main draw ----------
export function drawDragon(P, base, p, o = {}) {
  const sp = spine(p), O = outline(sp, 6), per = O.per, ID = o.id || 400;
  const nSeg = sp.pts.length - 1, rootIdx = sp.nT;
  const at = k => O.c[Math.min(O.c.length - 1, Math.round(k * per))];
  const nrm = k => O.nor[Math.min(O.nor.length - 1, Math.round(k * per))];
  // shoulder (wing root) on the dorsal side near the chest
  const ci = rootIdx + .3, C = at(ci), N = nrm(ci), wC = O.W[Math.round(ci * per)];
  const Snear = [C[0] + N[0] * wC * .25, C[1] + N[1] * wC * .25], Sfar = [Snear[0] - 10, Snear[1] - 6];
  const Bk = at(rootIdx - 2.6), Nb = nrm(rootIdx - 2.6), wB = O.W[Math.round((rootIdx - 2.6) * per)];
  const B = [Bk[0] + Nb[0] * wB * .45, Bk[1] + Nb[1] * wB * .45];
  const wFar = wingGeo(Sfar, { ...p.wing, ...(p.wingFar || {}) }), wNear = wingGeo(Snear, p.wing);
  P.setTransform(base);
  if ((p.wingFar || {}).fold) wFar.fold = p.wingFar.fold;
  if (!o.noFarWing) drawWing(P, wFar, [B[0] - 8, B[1] - 4], true, ID + 60, (p.wingFar || {}).folded);
  // far legs
  const hip = at(rootIdx - (p.hipAt ?? 2.4));
  const lg = p.legs || {};
  drawLeg(P, base, [hip[0] - 8, hip[1] - 2], (lg.hF1 ?? 10) * D2R, (lg.hF2 ?? -30) * D2R, (lg.hF3 ?? 20) * D2R, true, ID + 80);

  // ember (in the hollow of the coil, behind the body)
  if (o.ember) {
    const e = o.ember; let ea = p.emberAt || [30, 40];
    if (ea === 'auto') { let x = 0, y = 0, n = 0; for (let k = 1; k < sp.nT - 1; k++) { x += sp.pts[k][0]; y += sp.pts[k][1]; n++; } ea = [x / n, y / n]; }
    const ex = ea[0] + (e.dx || 0), ey = ea[1] + (e.dy || 0), r = e.r || 17;
    P.setTransform(base);
    P.piece(circle(ex, ey, r * 1.45), COL.gold, { id: ID + 90, lead: 4, mat: false });
    for (let i = 0; i < 8; i++) {
      const a0 = i / 8 * Math.PI * 2, a1 = a0 + Math.PI / 8, a2 = a0 + Math.PI / 4;
      P.piece(smooth([[ex + Math.cos(a0) * r, ey + Math.sin(a0) * r, 1], [ex + Math.cos(a1) * r * 1.45, ey + Math.sin(a1) * r * 1.45, 1], [ex + Math.cos(a2) * r, ey + Math.sin(a2) * r, 1]]), emberCol(e.lit ?? 1, 0), { id: ID + 92 + i, lead: 2.6, mat: false });
    }
    P.piece(circle(ex, ey, r), emberCol(e.lit ?? 1, 1), { id: ID + 91, lead: 3.6, mat: false, flat: true, body: false });
    P.piece(circle(ex - r * .15, ey - r * .15, r * .45), emberCol(e.lit ?? 1, 2), { id: ID + 99, lead: 2.4, mat: false, flat: true, body: false });
    o.emberPos = [ex, ey];
  }
  P.setTransform(base);
  // body bands
  for (let k = 0; k < nSeg; k++) {
    const i0 = k * per, i1 = (k + 1) * per;
    const dor = O.dor.slice(i0, i1 + 1), bel = O.bel.slice(i0, i1 + 1), ven = O.ven.slice(i0, i1 + 1);
    P.piece(pathOf(dor.concat(bel.slice().reverse())), COL.green, { id: ID + k, lead: 5, matW: 7, paint: g => scales(g, O, i0, i1) });
    P.piece(pathOf(bel.concat(ven.slice().reverse())), COL.gold, { id: ID + 30 + k, lead: 4.5, matW: 5, paint: g => plates(g, O, i0, i1) });
  }
  // dorsal spikes
  for (let k = 2; k < nSeg - 1; k += 1) {
    if (k === rootIdx) continue;
    const i = k * per + (per >> 1), c = O.dor[i], [nx, ny, dx, dy] = O.nor[i], h = Math.min(16, O.W[i] * .38) + 3;
    if (h < 6) continue;
    const pth = smooth([[c[0] - dx * h * .5, c[1] - dy * h * .5, 1], [c[0] + nx * h - dx * h * .35, c[1] + ny * h - dy * h * .35, 1], [c[0] + dx * h * .5, c[1] + dy * h * .5, 1]]);
    P.piece(pth, COL.ruby, { id: ID + 50 + k, lead: 3.5, mat: false });
  }
  // tail spade
  { const tip = O.c[0], [nx, ny, dx, dy] = O.nor[0], s = 16;
    const pth = smooth([[tip[0] + dx * 4, tip[1] + dy * 4, 1], [tip[0] - dx * s + nx * s * .8, tip[1] - dy * s + ny * s * .8], [tip[0] - dx * s * 2.1, tip[1] - dy * s * 2.1, 1], [tip[0] - dx * s - nx * s * .8, tip[1] - dy * s - ny * s * .8]]);
    P.piece(pth, COL.ruby, { id: ID + 58, lead: 4.5, matW: 5 }); }
  // near hind leg
  drawLeg(P, base, [hip[0] + 4, hip[1] + 4], (lg.h1 ?? 0) * D2R, (lg.h2 ?? -30) * D2R, (lg.h3 ?? 30) * D2R, false, ID + 88);

  // head
  const hb = sp.head, hm = base.translate(hb[0], hb[1]).rotate(sp.headA / D2R).scale(p.headS || 1);
  P.setTransform(hm);
  P.piece(HEAD.frill, COL.ruby, { id: ID + 100, lead: 4, mat: false });
  P.piece(HEAD.horn2, COL.white, { id: ID + 111, lead: 4, matW: 5, paint: g => { for (let k = 0; k < 3; k++) brush(g, [[18 - k * 6, -40 - k * 8], [24 - k * 6, -42 - k * 8]], 1.2); } });
  P.piece(HEAD.horn, COL.white, { id: ID + 101, lead: 4, matW: 5, paint: g => { for (let k = 0; k < 4; k++) brush(g, [[4 - k * 10, -38 - k * 4], [8 - k * 10, -44 - k * 4]], 1.2); } });
  const jm = hm.translate(4, 4).rotate(p.jaw || 0).translate(-4, -4);
  if ((p.jaw || 0) > 4) { P.setTransform(hm); P.piece(HEAD.mouth, COL.ruby2, { id: ID + 102, lead: 3.5, mat: false }); P.setTransform(jm); HEAD.tooth.forEach((t, i) => P.piece(t, COL.white, { id: ID + 106 + i, lead: 2.2, mat: false })); }
  P.setTransform(jm); P.piece(HEAD.jaw, COL.green, { id: ID + 103, lead: 4.5, matW: 6, paint: g => brush(g, [[8, 7], [34, 8], [58, 5]], 1.3, { color: 'rgba(30,40,14,.5)' }) });
  P.setTransform(hm);
  if ((p.jaw || 0) > 4) HEAD.tooth.forEach((t, i) => P.piece(t, COL.white, { id: ID + 108 + i, lead: 2.2, mat: false }));
  P.piece(HEAD.skull, COL.green, { id: ID + 104, lead: 4.8, matW: 7, shade: [0, -24, 0, 6, .25], paint: g => headPaint(g) });
  P.piece(HEAD.eye, COL.gold2, { id: ID + 105, lead: 3, mat: false, paint: g => {
    const lid = p.eyeLid ?? 1; g.fillStyle = INK; g.fill(ellipse(35 + (p.look || 0), -21 + (1 - lid) * 2, 2.6, 5 * Math.max(.35, lid)));
    g.fillStyle = 'rgba(44,26,12,.6)'; g.fillRect(24, -28, 22, 7 * (1 - lid) + .5);
    brush(g, [[25, -21 - 6 * lid], [34, -27.5 * (.6 + .4 * lid)], [43, -22 - 5 * lid]], 1.6, { w0: .4, w1: .4 });
  } });
  // near wing
  P.setTransform(base);
  if (!o.noNearWing && !p.wing.hide) drawWing(P, wNear, B, false, ID + 120, p.wing.folded);
  return { sp, O, emberPos: o.emberPos };
}

export const DPOSE = {
  rear: {
    rootA: -82, neck: [14, 22, 30, 34], head: 18, jaw: 24, tail: [4, 10, 22, 34, 36, 30, 18, -14, -40, -52], body: 48, hipAt: 1.6,
    wing: { humA: -126, humL: 60, foreA: 78, foreL: 74, fing: [196, 170, 146, 124] }, wingFar: { humA: -104, foreA: 70, fing: [206, 184, 160, 140], fingS: .9 },
    legs: { h1: -34, h2: 56, h3: -18, hF1: -20, hF2: 50, hF3: -26 }, eyeLid: 1,
  },
  coil: {
    rootA: -90, neck: [14, 28, 40, 30], head: 26, jaw: 0, tailL: 27, tail: [6, 28, 30, 30, 30, 30, 30, 30, 28, 24], body: 50, hipAt: 1.1, emberAt: 'auto',
    wing: { hide: 1, humA: -100, humL: 48, foreA: 200, foreL: 60, fing: [0, 0, 0, 0] }, wingFar: { humA: -112, humL: 50, foreA: 206, foreL: 62, fing: [0, 0, 0, 0], folded: 1, fold: 118 },
    legs: { h1: -76, h2: 118, h3: -40, hF1: -64, hF2: 108, hF3: -40 }, eyeLid: .7, look: 2,
  },
  reveal: {
    rootA: -84, neckL: 30, neck: [-4, -14, -26, -30], head: -84, jaw: 0, tailL: 27, tail: [6, 28, 30, 30, 30, 30, 30, 30, 28, 24], body: 50, hipAt: 1.1, emberAt: 'auto',
    wing: { hide: 1, humA: -100, humL: 48, foreA: 200, foreL: 60, fing: [0, 0, 0, 0] }, wingFar: { humA: -112, humL: 50, foreA: 206, foreL: 62, fing: [0, 0, 0, 0], folded: 1, fold: 118 },
    legs: { h1: -76, h2: 118, h3: -40, hF1: -64, hF2: 108, hF3: -40 }, eyeLid: .45, look: -1,
  },
};
export function lerpD(a, b, t) {
  const L = (x, y) => typeof x === 'number' ? x + ((y ?? x) - x) * t : Array.isArray(x) ? x.map((v, i) => L(v, y ? y[i] : v)) : (x && typeof x === 'object') ? Object.fromEntries(Object.keys({ ...x, ...(y || {}) }).map(k => [k, L(x[k] ?? y[k], y ? y[k] : undefined)])) : (t < .5 ? x : y);
  return L(a, b);
}
