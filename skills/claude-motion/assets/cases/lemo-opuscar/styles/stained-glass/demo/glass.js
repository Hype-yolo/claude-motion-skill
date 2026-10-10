// Stained-glass drawing core: smooth cut pieces, lead cames, grisaille painting.
// Everything is drawn through a Pass, which mirrors transforms on the glass canvas (g: transmittance colours)
// and the surface canvas (s: lead, iron, stone). In 'proj' mode (floor light patch) both are the same canvas.
import { hash } from '/core/lib.js';

export const COL = {
  cobalt: '#1d3a9c', deepblue: '#142a70', blue2: '#2a52b0', ruby: '#a8101c', ruby2: '#860c18', gold: '#dc9a22', gold2: '#eab640',
  green: '#2f7f36', green2: '#22602e', olive: '#6b7a22', purple: '#632a63', purple2: '#4c2a5e', flesh: '#d2a288', white: '#cfdac6',
  sky: '#7fa2cf', brown: '#7a4e24', amber: '#ff9a2a', steel: '#a9b7b2', steel2: '#8d9e9c', red2: '#c8452a', teal: '#2f7f86', rose: '#c25a78'
};
export const LEAD = '#1d1f23';
export const INK = 'rgba(44,26,12,.88)';
export const MAT = 'rgba(62,38,18,.30)';

const cache = new Map();
export function rgb(hex) {
  let c = cache.get(hex); if (c) return c;
  const n = parseInt(hex.slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; cache.set(hex, c); return c;
}
// per-piece thickness variation (thicker glass = darker, slightly more saturated)
export function vary(hex, id, amt = .09) {
  const [r, g, b] = rgb(hex); const v = 1 + (hash(id * 3.17 + .5) - .5) * 2 * amt, w = (hash(id * 1.9 + 7) - .5) * amt * .6;
  const f = x => Math.max(0, Math.min(255, Math.round(x)));
  return `rgb(${f(r * v * (1 + w))},${f(g * v)},${f(b * v * (1 - w))})`;
}

// Closed/open Catmull-Rom path through points. A point [x,y,1] is a hard corner.
export function smooth(pts, closed = true, k = .5) {
  const p = new Path2D(), n = pts.length;
  if (n < 2) return p;
  const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  p.moveTo(pts[0][0], pts[0][1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = P(i), b = P(i + 1), a0 = P(i - 1), b1 = P(i + 2);
    const ka = a[2] ? 0 : k / 3 * 1.0, kb = b[2] ? 0 : k / 3 * 1.0;
    const c1 = [a[0] + (b[0] - a0[0]) * ka, a[1] + (b[1] - a0[1]) * ka], c2 = [b[0] - (b1[0] - a[0]) * kb, b[1] - (b1[1] - a[1]) * kb];
    p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]);
  }
  if (closed) p.closePath();
  return p;
}
export function poly(pts) { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; }
export function circle(x, y, r) { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; }
export function ellipse(x, y, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; }

// sample a Catmull-Rom curve (open) into dense points
export function sampleCurve(pts, per = 8) {
  const out = [], n = pts.length; const P = i => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[n - 1].slice(0, 2)); return out;
}
// tapered brush stroke (grisaille trace line): width profile w0 -> peak w -> w1
export function brush(ctx, pts, w, { w0 = .25, w1 = .25, color = INK, per = 8 } = {}) {
  const s = sampleCurve(pts, per), n = s.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const u = i / (n - 1); const prof = u < .5 ? w0 + (1 - w0) * Math.sin(u * Math.PI) : w1 + (1 - w1) * Math.sin(u * Math.PI);
    const hw = w * prof * .5;
    L.push([s[i][0] - dy * hw, s[i][1] + dx * hw]); R.push([s[i][0] + dy * hw, s[i][1] - dx * hw]);
  }
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
  for (const q of L) ctx.lineTo(q[0], q[1]); for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath(); ctx.fill();
}
export function line(ctx, pts, w, color = INK, closed = false) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(smooth(pts, closed));
}

// ---------- procedural glass body textures (lazy, shared) ----------
let TEX = null;
function makeTex() {
  const N = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const [r, g, b, a] = fn(i, j), k = (i + j * w) * 4; im.data[k] = r; im.data[k + 1] = g; im.data[k + 2] = b; im.data[k + 3] = a; }
    x.putImageData(im, 0, 0); return c; };
  const vn = (x, y, P) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, s = t => t * t * (3 - 2 * t), h = (a, b) => hash(((a % P) + P) % P * 71.3 + ((b % P) + P) % P * 17.9);
    return (h(i, j) * (1 - s(u)) + h(i + 1, j) * s(u)) * (1 - s(v)) + (h(i, j + 1) * (1 - s(u)) + h(i + 1, j + 1) * s(u)) * s(v); };
  // streaks: long horizontal density variations of hand-blown/pot-metal glass (tileable 256)
  const streak = N(256, 256, (i, j) => { const y = j / 256; let n = vn(i / 256 * 2, y * 24, 24) * .55 + vn(i / 256 * 4, y * 64, 64) * .3 + vn(i / 256 * 8, y * 128, 128) * .15; const v = 255 * (.72 + .28 * n); return [v, v, v * (.97 + .03 * n), 255]; });
  // stipple: mottled grisaille matting (brown, alpha varies)
  const stip = N(256, 256, (i, j) => { const n = vn(i / 8, j / 8, 32) * .5 + vn(i / 3, j / 3, 85.3 | 0) * .3 + hash(i * 13.1 + j * 7.7) * .2; return [58, 34, 16, Math.round(255 * Math.max(0, Math.min(1, (n - .2) * 1.25)))]; });
  TEX = { streak, stip, pats: new WeakMap() };
}
function pat(g, name) {
  if (!TEX) makeTex();
  let m = TEX.pats.get(g); if (!m) { m = {}; TEX.pats.set(g, m); }
  if (!m[name]) m[name] = g.createPattern(TEX[name], 'repeat');
  return m[name];
}

// ---------- Pass: draw the same geometry into glass + surface canvases ----------
export class Pass {
  constructor(g, s, mode = 'full') { this.g = g; this.s = s; this.mode = mode; this.cx = s === g ? [g] : [g, s]; this.lit = 1; this.leadScale = 1; this.id = 0; }
  save() { for (const c of this.cx) c.save(); }
  restore() { for (const c of this.cx) c.restore(); }
  translate(x, y) { for (const c of this.cx) c.translate(x, y); }
  rotate(a) { for (const c of this.cx) c.rotate(a); }
  scale(x, y = x) { for (const c of this.cx) c.scale(x, y); }
  setTransform(m) { for (const c of this.cx) c.setTransform(m); }
  // one cut piece of glass
  piece(path, color, o = {}) {
    const g = this.g, id = o.id ?? (this.id++);
    g.fillStyle = o.flat ? color : vary(color, id, o.vary ?? .09); g.fill(path);
    if (this.mode === 'full' && o.erase !== false) {   // hide leads of pieces underneath (lead is one planar network)
      const s = this.s; s.save(); s.globalCompositeOperation = 'destination-out'; s.fillStyle = '#000'; s.fill(path); s.restore();
    }
    if (this.mode === 'full') {
      const col = g.fillStyle;
      g.save(); g.clip(path); g.__col = col;
      if (o.body !== false) {   // the glass itself: streaks, hue drift across the sheet, darker (aged) edges by the lead
        const h1 = hash(id * 5.31 + 2), h2 = hash(id * 2.77 + 9), a = h1 * Math.PI * 2, ca = Math.cos(a) * 60, sa = Math.sin(a) * 60;
        g.globalCompositeOperation = 'multiply';
        const sp = pat(g, 'streak'); sp.setTransform(new DOMMatrix().rotate(h2 * 360).scale(.55 + h1 * .5, .7));
        g.fillStyle = sp; g.fill(path);
        const gr = g.createLinearGradient(-ca, -sa, ca, sa);
        gr.addColorStop(0, h2 > .5 ? 'rgb(255,238,214)' : 'rgb(222,232,255)'); gr.addColorStop(.5, 'rgb(255,255,255)'); gr.addColorStop(1, `rgb(${190 + h1 * 30 | 0},${188 + h2 * 30 | 0},${200 | 0})`);
        g.fillStyle = gr; g.fill(path);
        g.lineJoin = 'round'; const ew = o.edge ?? 9;
        g.strokeStyle = 'rgb(206,204,200)'; g.lineWidth = ew * 2.4; g.stroke(path);
        g.strokeStyle = 'rgb(168,164,160)'; g.lineWidth = ew; g.stroke(path);
        g.globalCompositeOperation = 'source-over';
      }
      if (o.paint || o.mat !== false || o.wash) {
        if (o.shade) {   // modelling mat: graded wash across the piece (dark side -> clear side)
          const [x0, y0, x1, y1, a] = o.shade; const gr = g.createLinearGradient(x0, y0, x1, y1);
          gr.addColorStop(0, `rgba(52,30,14,${a})`); gr.addColorStop(.55, `rgba(52,30,14,${a * .35})`); gr.addColorStop(1, 'rgba(52,30,14,0)');
          g.fillStyle = gr; g.fill(path);
        }
        if (o.mat !== false) {   // grisaille matting: a soft wash inside the lead line (medieval edge shading)
          const m = o.matW ?? 14, A = o.matA ?? 1; g.lineJoin = 'round';
          g.strokeStyle = `rgba(52,30,14,${.14 * A})`; g.lineWidth = m * 2.6; g.stroke(path);
          g.strokeStyle = `rgba(52,30,14,${.16 * A})`; g.lineWidth = m * 1.3; g.stroke(path);
          g.strokeStyle = `rgba(52,30,14,${.22 * A})`; g.lineWidth = m * .5; g.stroke(path);
        }
        if (o.wash) {   // stippled matting over the whole piece; paint callbacks scrape highlights back with g.__col
          const st = pat(g, 'stip'); st.setTransform(new DOMMatrix().rotate(hash(id) * 90).scale(.5));
          g.globalAlpha = o.wash; g.fillStyle = st; g.fill(path); g.globalAlpha = 1;
        }
        if (o.paint) o.paint(g);
      }
      g.restore();
    } else if (o.paint && o.projPaint) { g.save(); g.clip(path); o.paint(g); g.restore(); }
    if (o.lead !== 0) this.lead(path, o.lead ?? 6);
  }
  lead(path, w = 6) {
    const s = this.s; s.lineJoin = 'round'; s.lineCap = 'round';
    s.strokeStyle = this.mode === 'proj' ? '#000' : LEAD; s.lineWidth = w * this.leadScale; s.stroke(path);
    if (this.mode === 'full' && w >= 5) { s.strokeStyle = 'rgba(120,128,138,.22)'; s.lineWidth = w * .22 * this.leadScale; s.stroke(path); }
  }
  leadLine(pts, w = 6, closed = false) { this.lead(smooth(pts, closed), w); }
  solder(x, y, r = 4.5) {
    const s = this.s; s.fillStyle = this.mode === 'proj' ? '#000' : '#26282d'; s.beginPath(); s.ellipse(x, y, r * 1.15, r, .4, 0, 7); s.fill();
    if (this.mode === 'full') { s.fillStyle = 'rgba(150,158,168,.28)'; s.beginPath(); s.arc(x - r * .3, y - r * .35, r * .35, 0, 7); s.fill(); }
  }
  // opaque surface fill (iron bar, stone) on surface canvas
  surf(path, fill) { this.s.fillStyle = this.mode === 'proj' ? '#000' : fill; this.s.fill(path); }
}

// ---------- Voronoi quarries (background mosaic) ----------
export function voronoi(seeds, box) {
  // box = [x0,y0,x1,y1]; brute-force half-plane clipping, fine for ~200 seeds (precomputed once)
  const cells = [];
  for (let i = 0; i < seeds.length; i++) {
    const [px, py] = seeds[i];
    let pg = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]];
    // only nearby seeds matter
    const near = seeds.map((q, j) => [j, (q[0] - px) ** 2 + (q[1] - py) ** 2]).filter(e => e[0] !== i).sort((a, b) => a[1] - b[1]).slice(0, 18);
    for (const [j] of near) {
      const [qx, qy] = seeds[j]; const mx = (px + qx) / 2, my = (py + qy) / 2, nx = qx - px, ny = qy - py;
      const inside = p => (p[0] - mx) * nx + (p[1] - my) * ny <= 0;
      const out = [];
      for (let k = 0; k < pg.length; k++) {
        const a = pg[k], b = pg[(k + 1) % pg.length], ia = inside(a), ib = inside(b);
        if (ia) out.push(a);
        if (ia !== ib) { const da = (a[0] - mx) * nx + (a[1] - my) * ny, db = (b[0] - mx) * nx + (b[1] - my) * ny, t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      pg = out; if (pg.length < 3) break;
    }
    if (pg.length >= 3) cells.push({ pts: pg, c: [px, py], i });
  }
  return cells;
}
// jittered + relaxed seeds in a box
export function seedsIn(box, n, rnd) {
  const s = []; for (let i = 0; i < n; i++) s.push([box[0] + rnd() * (box[2] - box[0]), box[1] + rnd() * (box[3] - box[1])]);
  for (let it = 0; it < 2; it++) { const c = voronoi(s, box); c.forEach(cell => { let x = 0, y = 0; cell.pts.forEach(p => { x += p[0]; y += p[1]; }); s[cell.i] = [x / cell.pts.length, y / cell.pts.length]; }); }
  return s;
}
// slightly rounded polygon path for a quarry (glass cuts are never razor-sharp at corners)
export function softPoly(pts, r = .18) {
  const p = new Path2D(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const p1 = [b[0] + (a[0] - b[0]) * r, b[1] + (a[1] - b[1]) * r], p2 = [b[0] + (c[0] - b[0]) * r, b[1] + (c[1] - b[1]) * r];
    if (i === 0) p.moveTo(p1[0], p1[1]); else p.lineTo(p1[0], p1[1]);
    p.quadraticCurveTo(b[0], b[1], p2[0], p2[1]);
  }
  p.closePath(); return p;
}
