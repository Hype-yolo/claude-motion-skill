// The East Window: four lancets + a rose, set in a splayed stone wall. World units, y down.
import { mulberry, hash, vnoise } from '/core/lib.js';
import { COL, Pass, smooth, circle, ellipse, brush, line, voronoi, seedsIn, softPoly, INK } from './glass.js';
import { drawKnight } from './knight.js';
import { drawDragon } from './dragon.js';

export const FLOOR = 900;
export const LW = 300, PITCH = 340, BOT = 640, SPR = -60;
export const LX = [-510, -170, 170, 510];
export const APEX = SPR - LW * Math.sqrt(3) / 2;       // -319.8
export const ROSE = { x: 0, y: -560, r: 175 };
export const ARCH = { spr: SPR - 20, half: 2 * PITCH + LW / 2 + 70 };   // enclosing arch
const BORDER = 34, RUBY = 20;

// ---------- lancet outlines ----------
export function lancetPath(cx, inset = 0) {
  const x0 = cx - LW / 2 + inset, x1 = cx + LW / 2 - inset, R = LW - inset;
  const p = new Path2D();
  p.moveTo(x0, BOT - inset); p.lineTo(x0, SPR);
  const th = Math.acos((LW / 2) / R);
  p.arc(cx + LW / 2, SPR, R, Math.PI, Math.PI + th);
  p.arc(cx - LW / 2, SPR, R, -th, 0);
  p.lineTo(x1, BOT - inset); p.closePath(); return p;
}
function lancetSamples(cx, inset, step) {   // points along the outline (for pearls)
  const out = [], x0 = cx - LW / 2 + inset, x1 = cx + LW / 2 - inset, R = LW - inset;
  for (let y = BOT - inset - step * .6; y > SPR; y -= step) out.push([x0, y]);
  const th = Math.acos((LW / 2) / R), arcLen = R * th, n = Math.max(2, Math.round(arcLen / step));
  for (let i = 0; i < n; i++) { const a = Math.PI + (i + .5) / n * th; out.push([cx + LW / 2 + Math.cos(a) * R, SPR + Math.sin(a) * R]); }
  for (let i = 0; i < n; i++) { const a = -th + (i + .5) / n * th; out.push([cx - LW / 2 + Math.cos(a) * R, SPR + Math.sin(a) * R]); }
  for (let y = SPR + step * .4; y < BOT - inset - step * .3; y += step) out.push([x1, y]);
  return out;
}

// ---------- precomputed mosaic ----------
// hand-cut lozenge quarries: shared, jittered lattice vertices (no gaps), each quarry painted with a vine curl
export function lozenges(box, d, seed) {
  const J = (k, m) => [k * d + (hash(k * 12.9 + m * 78.2 + seed) - .5) * d * .34, m * d + (hash(k * 39.3 + m * 11.1 + seed * 3) - .5) * d * .34];
  const out = [];
  for (let b = Math.floor(box[1] / d) - 1; b <= Math.ceil(box[3] / d) + 1; b++)
    for (let a = Math.floor(box[0] / d) - 1; a <= Math.ceil(box[2] / d) + 1; a++) {
      if ((a + b) & 1) continue;
      const pts = [J(a - 1, b), J(a, b - 1), J(a + 1, b), J(a, b + 1)];
      const h = hash(a * 3.3 + b * 7.9 + seed);
      out.push({ pts, path: softPoly(pts, .12), c: [a * d, b * d], col: h < .1 ? COL.blue2 : h < .2 ? COL.deepblue : COL.cobalt, id: seed * 1000 + (a + 500) * 97 + b, curl: hash(a * 5.1 + b * 2.3 + seed) });
    }
  return out;
}
export function vineCurl(g, c, d, h) {
  const [x, y] = c, s = h > .5 ? 1 : -1, r = d * .32;
  brush(g, [[x - r * s, y + r * .6], [x - r * .2 * s, y - r * .4], [x + r * .5 * s, y - r * .2], [x + r * .35 * s, y + r * .35], [x, y + r * .15]], d * .09, { w0: .3, w1: .15, color: 'rgba(30,24,40,.42)' });
  g.fillStyle = 'rgba(30,24,40,.38)'; g.beginPath(); g.arc(x - r * s, y + r * .6, d * .06, 0, 7); g.fill();
}
const MOS = LX.map((cx, i) => {
  const box = [cx - LW / 2 + BORDER - 4, APEX - 4, cx + LW / 2 - BORDER + 4, BOT - BORDER + 4];
  const cells = lozenges(box, 23, 11 + i * 7).filter(c => c.c[0] > box[0] - 30 && c.c[0] < box[2] + 30);
  const pearls = lancetSamples(cx, RUBY / 2, 21);
  const band = lancetSamples(cx, (RUBY + BORDER) / 2, 3.2);
  return { cells, pearls, band, outer: lancetPath(cx, 0), mid: lancetPath(cx, RUBY), inner: lancetPath(cx, BORDER) };
});
const ROSEG = (() => {
  const { x, y, r } = ROSE, parts = [];
  parts.push({ p: circle(x, y, r * .26), c: COL.gold, id: 5001, kind: 'sun' });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, a0 = a - Math.PI / 12 * .82, a1 = a + Math.PI / 12 * .82, r0 = r * .33, r1 = r * .78;
    parts.push({ p: smooth([[x + Math.cos(a0) * r0, y + Math.sin(a0) * r0, 1], [x + Math.cos(a0) * r1 * .92, y + Math.sin(a0) * r1 * .92], [x + Math.cos(a) * r1, y + Math.sin(a) * r1], [x + Math.cos(a1) * r1 * .92, y + Math.sin(a1) * r1 * .92], [x + Math.cos(a1) * r0, y + Math.sin(a1) * r0, 1]]), c: i % 2 ? COL.ruby : COL.cobalt, id: 5010 + i });
    const b = a + Math.PI / 12, rr = r * .88;
    parts.push({ p: circle(x + Math.cos(b) * rr, y + Math.sin(b) * rr, r * .075), c: i % 2 ? COL.gold : COL.white, id: 5030 + i });
    parts.push({ p: circle(x + Math.cos(a) * r * .9, y + Math.sin(a) * r * .9, r * .055), c: COL.green, id: 5050 + i });
  }
  return parts;
})();

// ---------- stone texture (pattern) ----------
let stoneTex = null;
function stonePattern(ctx) {
  if (!stoneTex) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); const im = x.createImageData(512, 512);
    const rnd = mulberry(9);
    const N = (u, v, f) => { const X = u * f, Y = v * f; const i = Math.floor(X), j = Math.floor(Y), a = X - i, b = Y - j; const h = (p, q) => hash((p % f + f) % f * 57.1 + (q % f + f) % f * 131.7); const s = t => t * t * (3 - 2 * t);
      return (h(i, j) * (1 - s(a)) + h(i + 1, j) * s(a)) * (1 - s(b)) + (h(i, j + 1) * (1 - s(a)) + h(i + 1, j + 1) * s(a)) * s(b); };
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const u = i / 512, v = j / 512;
      let n = N(u, v, 4) * .45 + N(u, v, 16) * .3 + N(u, v, 64) * .17 + rnd() * .08;
      const k = (i + j * 512) * 4, val = 150 + (n - .5) * 120;
      im.data[k] = val; im.data[k + 1] = val * .96; im.data[k + 2] = val * .9; im.data[k + 3] = 255;
    }
    x.putImageData(im, 0, 0); stoneTex = c;
  }
  return ctx.createPattern(stoneTex, 'repeat');
}

// ---------- stone wall (surface canvas) ----------
export function drawStone(S, M, view, o = {}) {
  S.setTransform(M);
  const pat = stonePattern(S); pat.setTransform(new DOMMatrix().scale(.55));
  const [vx0, vy0, vx1, vy1] = view;
  // ashlar courses
  const rnd = mulberry(4);
  for (let row = -30; row < 30; row++) {
    const CH = 86, y0 = FLOOR - (row + 1) * CH, y1 = y0 + CH; if (y1 < vy0 - 10 || y0 > vy1 + 10 || y0 >= FLOOR) continue;
    let x = -2600 + hash(row * 7.3) * 160;
    while (x < 2600) {
      const w = 140 + hash(row * 13.1 + x * .01) * 130;
      if (x + w > vx0 - 10 && x < vx1 + 10) {
        const t = .78 + hash(row * 3.7 + x * .13) * .3;
        S.fillStyle = `rgb(${(128 * t) | 0},${(118 * t) | 0},${(104 * t) | 0})`; S.fillRect(x + 2, y0 + 2, w - 4, CH - 4);
      }
      x += w;
    }
  }
  // mortar colour under the blocks
  S.globalCompositeOperation = 'destination-over'; S.fillStyle = '#403a33'; S.fillRect(vx0 - 20, vy0 - 20, vx1 - vx0 + 40, Math.min(FLOOR, vy1 + 20) - vy0 + 20);
  S.globalCompositeOperation = 'source-over';
  // enclosing arch: smooth dressed stone (moulded bands)
  const ah = ARCH.half, as = ARCH.spr, R2 = ah * 2;
  const archPath = (ins) => { const p = new Path2D(); const x0 = -ah + ins, x1 = ah - ins, R = R2 - ins, th = Math.acos(ah / R); p.moveTo(x0, BOT + 60); p.lineTo(x0, as); p.arc(ah, as, R, Math.PI, Math.PI + th); p.arc(-ah, as, R, -th, 0); p.lineTo(x1, BOT + 60); p.closePath(); return p; };
  const bands = [[0, '#9a8f7c'], [26, '#7a705f'], [40, '#a39883'], [66, '#6c6354'], [80, '#958a76']];
  for (const [ins, col] of bands) { S.fillStyle = col; S.fill(archPath(ins)); }
  // tympanum (wall inside the arch, around rose and lancets): darker recessed plane
  S.fillStyle = '#5f574a'; S.fill(archPath(100));
  // rose surround (splay ring)
  S.fillStyle = '#8c826f'; S.beginPath(); S.arc(ROSE.x, ROSE.y, ROSE.r + 30, 0, 7); S.fill();
  S.fillStyle = '#b0a58f'; S.beginPath(); S.arc(ROSE.x, ROSE.y, ROSE.r + 14, 0, 7); S.fill();
  // lancet splays + mullion shafts
  for (let i = 0; i < 4; i++) { const cx = LX[i];
    S.fillStyle = '#857b69'; S.fill(lancetPath(cx, -30)); S.fillStyle = '#a79c86'; S.fill(lancetPath(cx, -14)); }
  for (let i = 0; i < 3; i++) { const mx = (LX[i] + LX[i + 1]) / 2;
    S.fillStyle = '#b3a892'; S.fillRect(mx - 9, SPR - 20, 18, BOT - SPR + 20);
    S.fillStyle = 'rgba(40,34,28,.35)'; S.fillRect(mx + 3, SPR - 20, 6, BOT - SPR + 20);
    S.fillStyle = '#c2b7a0'; S.fillRect(mx - 16, SPR - 36, 32, 16); S.fillRect(mx - 14, BOT - 4, 28, 14); }
  // sill + string course with inscription band
  S.fillStyle = '#9d927d'; S.fillRect(-ah - 40, BOT + 14, 2 * ah + 80, 34);
  S.fillStyle = '#6e6556'; S.fillRect(-ah - 40, BOT + 48, 2 * ah + 80, 8);
  S.fillStyle = '#a89d87'; S.fillRect(-860, BOT + 118, 1720, 96);
  S.fillStyle = '#6e6556'; S.fillRect(-860, BOT + 214, 1720, 8); S.fillRect(-860, BOT + 112, 1720, 6);
  // texture overlay on everything stone
  S.globalCompositeOperation = 'multiply'; S.globalAlpha = .55; S.fillStyle = pat; S.fillRect(vx0, vy0, vx1 - vx0, Math.min(FLOOR, vy1) - vy0);
  S.globalAlpha = 1; S.globalCompositeOperation = 'source-over';
  // carved inscription
  if (o.inscription) carve(S, o.inscription, o.gild ?? 0);
  // cut out the glass openings
  S.globalCompositeOperation = 'destination-out'; S.fillStyle = '#000';
  for (const cx of LX) S.fill(lancetPath(cx, 0));
  S.beginPath(); S.arc(ROSE.x, ROSE.y, ROSE.r, 0, 7); S.fill();
  S.globalCompositeOperation = 'source-over';
}
export function drawTracery(S, M) {
  S.setTransform(M);
  S.fillStyle = '#9f947f';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + Math.PI / 12; S.save(); S.translate(ROSE.x, ROSE.y); S.rotate(a); S.fillRect(ROSE.r * .3, -6, ROSE.r * .72, 12); S.restore(); }
  S.lineWidth = 12; S.strokeStyle = '#a3987f'; S.beginPath(); S.arc(ROSE.x, ROSE.y, ROSE.r * .3, 0, 7); S.stroke(); S.beginPath(); S.arc(ROSE.x, ROSE.y, ROSE.r * .995, 0, 7); S.stroke();
}
function carve(S, ins, gild) {
  const y = BOT + 166;
  for (const [text, size, dy, al = 1] of ins) {
    if (al <= .01) continue; S.globalAlpha = al;
    S.font = `600 ${size}px Cinzel`; S.textAlign = 'center'; S.textBaseline = 'middle';
    // incised letter: dark cut, light lower lip
    S.fillStyle = 'rgba(255,245,220,.35)'; S.fillText(text, 0, y + dy + 2);
    S.fillStyle = 'rgba(38,30,22,.85)'; S.fillText(text, 0, y + dy);
    if (gild > 0) { S.fillStyle = `rgba(214,168,74,${gild})`; S.fillText(text, 0, y + dy); }
  }
  S.globalAlpha = 1;
}

// ---------- lancet contents ----------
function mosaic(P, i, cullRect) {
  const m = MOS[i];
  P.piece(m.outer, COL.ruby, { id: 900 + i, lead: 6, mat: false, edge: 5 });
  P.piece(m.mid, COL.white, { id: 910 + i, lead: 5, mat: false, edge: 4, paint: g => {   // running vine scroll painted on the white fillet
    const b = m.band; g.lineCap = 'round';
    for (let k = 2; k < b.length - 2; k += 1) {
      const p = b[k], q = b[k + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const ph = k * .9, o1 = Math.sin(ph) * 3.2, o2 = Math.sin(ph + .9) * 3.2;
      g.strokeStyle = 'rgba(44,26,12,.75)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p[0] + nx * o1, p[1] + ny * o1); g.lineTo(q[0] + nx * o2, q[1] + ny * o2); g.stroke();
      if (k % 4 === 0) { const s = Math.sin(ph) > 0 ? -1 : 1; g.fillStyle = 'rgba(44,26,12,.6)'; g.beginPath(); g.ellipse(p[0] + nx * s * 3.4, p[1] + ny * s * 3.4, 2.4, 1.2, Math.atan2(dy, dx) + s * .6, 0, 7); g.fill(); }
    }
  } });
  P.save(); P.g.clip(m.inner); if (P.s !== P.g) P.s.clip(m.inner);
  for (const c of m.cells) P.piece(c.path, c.col, { id: c.id, lead: 4.2, mat: false, edge: 6, paint: g => vineCurl(g, c.c, 46, c.curl) });
  P.restore();
  P.lead(m.inner, 6);
  for (const [x, y] of m.pearls) P.piece(circle(x, y, 6), COL.gold, { id: 700 + x * 3 + y, lead: 3, mat: false });
}
function roundel(P, cx, cy, r, sky, id) {
  P.piece(circle(cx, cy, r + 12), COL.gold, { id, lead: 6, mat: false });
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; P.piece(circle(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6), 4), COL.white, { id: id + 1 + k, lead: 2.6, mat: false }); }
  P.piece(circle(cx, cy, r), sky, { id: id + 20, lead: 6, matW: 16 });
}
function sunDisc(P, x, y, r, col, id, rays = 12) {
  for (let k = 0; k < rays; k++) { const a = k / rays * Math.PI * 2, a0 = a - .16, a1 = a + .16, r1 = r * (k % 2 ? 1.5 : 1.75);
    P.piece(smooth([[x + Math.cos(a0) * r * 1.06, y + Math.sin(a0) * r * 1.06, 1], [x + Math.cos(a) * r1, y + Math.sin(a) * r1, 1], [x + Math.cos(a1) * r * 1.06, y + Math.sin(a1) * r * 1.06, 1]]), COL.gold, { id: id + 1 + k, lead: 3, mat: false }); }
  P.piece(circle(x, y, r), col, { id, lead: 4.5, matW: 7 });
}
function hills(P, cx, y0, spec, id) {
  spec.forEach((h, k) => {
    const pts = [[cx - 150, BOT + 10, 1]]; for (let j = 0; j <= 6; j++) { const x = cx - 150 + j * 50; pts.push([x, y0 + h.y + Math.sin(j * 1.3 + h.ph) * h.a]); } pts.push([cx + 150, BOT + 10, 1]);
    P.piece(smooth(pts), h.c, { id: id + k, lead: 5.5, matW: 12, paint: g => { for (let j = 0; j < 5; j++) brush(g, [[cx - 120 + j * 60, y0 + h.y + 20], [cx - 110 + j * 60, y0 + h.y + 34], [cx - 96 + j * 60, y0 + h.y + 40]], 1.6, { color: 'rgba(30,40,14,.45)' }); } });
  });
}
function tree(P, x, y, s, id) {
  P.piece(smooth([[x - 5 * s, y, 1], [x + 5 * s, y, 1], [x + 4 * s, y - 40 * s, 1], [x - 4 * s, y - 40 * s, 1]]), COL.brown, { id, lead: 4, mat: false });
  const crown = smooth([[x, y - 92 * s], [x + 26 * s, y - 72 * s], [x + 30 * s, y - 46 * s], [x + 8 * s, y - 34 * s], [x - 22 * s, y - 38 * s], [x - 30 * s, y - 62 * s]]);
  P.piece(crown, COL.green, { id: id + 1, lead: 5, matW: 10, paint: g => { for (let k = 0; k < 6; k++) { const a = k * 1.1; brush(g, [[x + Math.cos(a) * 16 * s, y - 62 * s + Math.sin(a) * 14 * s], [x + Math.cos(a) * 8 * s, y - 60 * s + Math.sin(a) * 8 * s]], 2, { color: 'rgba(20,40,14,.5)' }); } } });
}
function castle(P, cx, id) {
  const y = 470;
  const wall = [[cx - 150, BOT + 10, 1], [cx - 150, y, 1]];
  for (let k = 0; k < 7; k++) { const x = cx - 150 + k * 44; wall.push([x, y, 1], [x, y - 24, 1], [x + 24, y - 24, 1], [x + 24, y, 1]); }
  wall.push([cx + 150, y, 1], [cx + 150, BOT + 10, 1]);
  P.piece(smooth(wall), COL.gold, { id, lead: 5.5, matW: 10, paint: g => {
    g.strokeStyle = 'rgba(60,34,10,.55)'; g.lineWidth = 1.6; g.beginPath();
    for (let r = 0; r < 5; r++) { const yy = y + 12 + r * 30; g.moveTo(cx - 150, yy); g.lineTo(cx + 150, yy); for (let x = cx - 150 + (r % 2) * 24; x < cx + 150; x += 48) { g.moveTo(x, yy); g.lineTo(x, yy + 30); } }
    g.stroke(); } });
  P.piece(smooth([[cx - 26, y + 60, 1], [cx - 26, y + 14], [cx, y - 6], [cx + 26, y + 14], [cx + 26, y + 60, 1]]), COL.brown, { id: id + 1, lead: 5, matW: 8 });   // gate
  // tower
  P.piece(smooth([[cx + 66, y, 1], [cx + 66, y - 150, 1], [cx + 126, y - 150, 1], [cx + 126, y, 1]]), COL.white, { id: id + 2, lead: 5.5, matW: 10, paint: g => { g.fillStyle = 'rgba(44,26,12,.7)'; g.fill(ellipse(cx + 96, y - 100, 7, 13)); g.fill(ellipse(cx + 96, y - 44, 6, 11)); } });
  P.piece(smooth([[cx + 58, y - 150, 1], [cx + 96, y - 226, 1], [cx + 134, y - 150, 1]]), COL.ruby, { id: id + 3, lead: 5.5, matW: 8 });
}
function miniDragonSun(P, cx, cy, id) {   // "the dragon that ate the sun": the folk tale inside the dawn roundel
  sunDisc(P, cx + 22, cy + 16, 22, COL.gold2, id, 10);
  P.piece(smooth([[cx - 64, cy + 30], [cx - 40, cy - 6], [cx - 8, cy - 22], [cx + 20, cy - 26], [cx + 34, cy - 14, 1], [cx + 10, cy - 8], [cx + 30, cy + 2, 1], [cx - 4, cy + 4], [cx - 30, cy + 20], [cx - 50, cy + 44]]), COL.green, { id: id + 20, lead: 4.5, matW: 6, paint: g => { g.fillStyle = INK; g.beginPath(); g.arc(cx + 14, cy - 17, 2.4, 0, 7); g.fill(); } });
  P.piece(smooth([[cx - 30, cy - 4], [cx - 44, cy - 50], [cx - 16, cy - 36], [cx - 6, cy - 60], [cx + 2, cy - 22]]), COL.ruby, { id: id + 21, lead: 4, mat: false });
}
function dove(P, x, y, flap, id) {
  const wy = flap ? -22 : 14;
  P.piece(smooth([[x - 24, y + 2], [x - 6, y - 8], [x + 16, y - 8], [x + 26, y - 2, 1], [x + 14, y + 6], [x - 10, y + 8], [x - 30, y + 14, 1]]), COL.white, { id, lead: 4, matW: 5, paint: g => { g.fillStyle = INK; g.beginPath(); g.arc(x + 18, y - 3, 1.6, 0, 7); g.fill(); } });
  P.piece(smooth([[x - 8, y - 4], [x - 2, y + wy - 18], [x + 12, y + wy - 12], [x + 8, y - 4]]), COL.white, { id: id + 1, lead: 4, matW: 5 });
}

// state: { knight: {pose, x, y, s, flip, off, face}, dragon: {...}, scroll, doveX, flap, ember }
export function drawLancet(P, i, st = {}) {
  const cx = LX[i];
  mosaic(P, i);
  P.save(); P.g.clip(MOS[i].inner); if (P.s !== P.g) P.s.clip(MOS[i].inner);
  const base = P.g.getTransform();
  if (i === 0) {
    roundel(P, cx, -150, 78, COL.sky, 3000);
    miniDragonSun(P, cx, -150, 3100);
    castle(P, cx, 3200);
  } else if (i === 1) {
    roundel(P, cx, -150, 78, COL.sky, 3300);
    sunDisc(P, cx, -150, 30, COL.gold2, 3400, 12);
    const sc = st.scroll || 0;
    hills(P, cx, 500, [{ y: -40, a: 16, ph: sc * .9, c: COL.olive }, { y: 20, a: 12, ph: 2 + sc * 1.3, c: COL.green }], 3500);
    for (let k = 0; k < 4; k++) { const x = cx - 150 + ((k * 110 - sc * 55) % 440 + 440) % 440 - 40; tree(P, x, 488 + (k % 2) * 10, .9 + (k % 2) * .15, 3520 + k * 3); }
    P.piece(smooth([[cx - 150, 590, 1], [cx - 60, 572], [cx + 40, 596], [cx + 150, 578, 1], [cx + 150, 612, 1], [cx + 40, 628], [cx - 60, 606], [cx - 150, 622, 1]]), COL.sky, { id: 3540, lead: 5, matW: 6, paint: g => { for (let k = 0; k < 4; k++) brush(g, [[cx - 130 + k * 70, 600], [cx - 110 + k * 70, 594], [cx - 90 + k * 70, 602]], 1.6, { color: 'rgba(20,30,60,.5)' }); } });
    if (st.doveX != null) dove(P, cx + st.doveX, -10, st.flap, 3560);
  } else if (i === 2) {
    roundel(P, cx, -150, 78, COL.sky, 3600);
    sunDisc(P, cx + 30, -128, 26, COL.gold, 3700, 12);
    hills(P, cx, 540, [{ y: 0, a: 10, ph: 1, c: COL.olive }, { y: 40, a: 8, ph: 3, c: COL.brown }], 3800);
    if (st.rock) {   // crag the dragon rears on (upper right)
      P.piece(smooth([[cx - 10, BOT, 1], [cx + 4, 470], [cx + 20, 380], [cx + 44, 336], [cx + 84, 322], [cx + 120, 330], [cx + 150, 340, 1], [cx + 150, BOT, 1]]), COL.brown, { id: 3850, lead: 5.5, wash: .3, paint: g => { for (let k = 0; k < 6; k++) brush(g, [[cx + 30 + k * 18, 350 + k * 22], [cx + 44 + k * 16, 380 + k * 24], [cx + 40 + k * 18, 420 + k * 20]], 2, { color: 'rgba(44,26,12,.6)' }); } });
      P.piece(smooth([[cx + 40, 420], [cx + 80, 396], [cx + 128, 410], [cx + 150, 430, 1], [cx + 150, BOT, 1], [cx + 30, BOT, 1]]), COL.olive, { id: 3851, lead: 5.5, wash: .2 });
    }
  } else if (i === 3) {
    roundel(P, cx, -150, 78, COL.purple, 3900);
    sunDisc(P, cx + 10, -120, 30, COL.red2, 4000, 12);
    P.save(); P.g.clip(circle(cx, -150, 78));
    P.piece(smooth([[cx - 80, -60, 1], [cx - 80, -130], [cx - 30, -114], [cx + 20, -132], [cx + 80, -118], [cx + 80, -60, 1]]), COL.green2, { id: 4050, lead: 5, matW: 8 });
    P.restore();
    hills(P, cx, 540, [{ y: 0, a: 10, ph: 2, c: COL.green2 }, { y: 40, a: 8, ph: 4, c: COL.brown }], 4100);
  }
  // figures
  if (st.dragon) { const d = st.dragon; const m = base.translate(cx + d.x, d.y).scale(d.flip ? -d.s : d.s, d.s); d.info = drawDragon(P, m, d.pose, d.o || {}); }
  if (st.knight) { const k = st.knight; const m = base.translate(cx + k.x, k.y + (k.pose.rootDy || 0) * k.s).scale(k.flip ? -k.s : k.s, k.s); drawKnight(P, m, k.pose, k.o || {}); }
  if (st.after) st.after(P, base);
  P.setTransform(base);
  P.restore();
  // outside iron saddle bars
  const bars = st.bars || [420, 120, -130];
  for (const y of bars) P.surf(smooth([[cx - LW / 2 - 6, y - 3, 1], [cx + LW / 2 + 6, y - 3, 1], [cx + LW / 2 + 6, y + 3, 1], [cx - LW / 2 - 6, y + 3, 1]]), '#18191c');
}
export function drawRose(P) {
  for (const q of ROSEG) P.piece(q.p, q.c, { id: q.id, lead: 5, matW: 8, paint: q.kind === 'sun' ? g => { for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; brush(g, [[ROSE.x + Math.cos(a) * 12, ROSE.y + Math.sin(a) * 12], [ROSE.x + Math.cos(a) * 36, ROSE.y + Math.sin(a) * 36]], 3, { color: 'rgba(120,50,10,.45)' }); } } : null });
}
// average colour of what each lancet projects (tints the shafts)
export const LTINT = [[.45, .6, 1.0], [.95, .85, .6], [.8, .6, .5], [.95, .45, .3]];
