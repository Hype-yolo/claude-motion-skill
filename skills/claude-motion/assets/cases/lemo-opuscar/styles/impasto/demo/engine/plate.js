// Reference illustration -> palette-knife strokes.
// You draw a clean, flat, value-planned illustration with Canvas2D (Ref.fill / Ref.line),
// every shape tagged with props (stroke direction, max stroke size, stroke type, group).
// paintRef() lays strokes coarse -> fine (Hertzmann-style): big knife planes first, smaller
// strokes only where the painting still differs from the reference, i.e. at edges and details.
// Strokes are never allowed to cross into a different shape group, so silhouettes stay crisp.
import { Strokes, KNIFE, BRUSH, DAB } from './impasto.js';

let _rng = 1;
const rnd = () => { _rng |= 0; _rng = _rng + 0x6D2B79F5 | 0; let t = Math.imul(_rng ^ _rng >>> 15, 1 | _rng); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const seedRng = s => { _rng = s * 7919 + 13; };

export class Ref {
  // w,h in units; scale = ref pixels per unit
  constructor(w, h, scale = 1) {
    this.w = w; this.h = h; this.scale = scale;
    this.pw = Math.ceil(w * scale); this.ph = Math.ceil(h * scale);
    const mk = () => { const c = document.createElement('canvas'); c.width = this.pw; c.height = this.ph; const x = c.getContext('2d', { willReadFrequently: true }); x.setTransform(scale, 0, 0, scale, 0, 0); return x; };
    this.ctx = mk(); this.idc = mk();
    this.props = [null];
  }
  _id(props) { this.props.push({ dir: 'edge', maxR: 1e9, type: KNIFE, hgt: 1, jit: .06, len: 1, wid: 1, ...props }); const k = this.props.length - 1; return k; }
  _idStyle(k) { return `rgb(${k & 255},${(k >> 8) & 255},${(k >> 16) & 255})`; }
  // path(ctx) builds a path; fill = css colour | gradient | (ctx)=>style
  fill(path, fill, props = {}) {
    const k = this._id(props), c = this.ctx, d = this.idc;
    c.beginPath(); path(c); c.fillStyle = typeof fill === 'function' ? fill(c) : fill; c.fill(props.rule || 'nonzero');
    d.beginPath(); path(d); d.fillStyle = this._idStyle(k); d.fill(props.rule || 'nonzero');
    return k;
  }
  line(path, style, width, props = {}) {
    const k = this._id(props), c = this.ctx, d = this.idc;
    for (const x of [c, d]) { x.beginPath(); path(x); x.lineWidth = width; x.lineCap = props.cap || 'round'; x.lineJoin = 'round'; }
    c.strokeStyle = typeof style === 'function' ? style(c) : style; c.stroke();
    d.strokeStyle = this._idStyle(k); d.stroke();
    return k;
  }
  text(str, x, y, font, fill, props = {}) {
    const k = this._id(props), c = this.ctx, d = this.idc;
    for (const q of [c, d]) { q.font = font; q.textAlign = props.align || 'center'; q.textBaseline = 'alphabetic'; }
    c.fillStyle = typeof fill === 'function' ? fill(c) : fill; c.fillText(str, x, y);
    d.fillStyle = this._idStyle(k); d.fillText(str, x, y);
    return k;
  }
  // paint only colour inside an existing shape (texture / light), keeps its id
  tint(path, fill, comp = 'source-atop') {
    const c = this.ctx; c.save(); c.globalCompositeOperation = comp; c.beginPath(); path(c); c.fillStyle = typeof fill === 'function' ? fill(c) : fill; c.fill(); c.restore();
  }
}

// integral image helpers
function integral(src, W, H, ch, stride = 4) {
  const I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += src[(y * W + x) * stride + ch]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
  return I;
}
const boxSum = (I, W, x0, y0, x1, y1) => I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0];

export function paintRef(ref, o = {}) {
  const R0 = o.R || [36, 18, 9, 4.5, 2.5];      // stroke radii in ref pixels, coarse -> fine
  const T = o.T ?? 16;                          // error threshold (0..255 per channel, mean)
  const out = o.out || new Strokes(20000);
  const W = ref.pw, H = ref.ph, sc = ref.scale;
  seedRng(o.seed ?? 1);
  // clean id map: snap anti-aliased pixels to a valid neighbour id
  const idd = ref.idc.getImageData(0, 0, W, H).data, ids = new Int32Array(W * H), np = ref.props.length;
  for (let i = 0; i < W * H; i++) { const k = idd[i * 4] | idd[i * 4 + 1] << 8 | idd[i * 4 + 2] << 16; ids[i] = (idd[i * 4 + 3] > 200 && k < np) ? k : -1; }
  for (let pass = 0; pass < 2; pass++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (ids[i] >= 0) continue; if (x > 0 && ids[i - 1] >= 0) ids[i] = ids[i - 1]; else if (y > 0 && ids[i - W] >= 0) ids[i] = ids[i - W]; else if (x < W - 1 && ids[i + 1] >= 0) ids[i] = ids[i + 1]; else if (y < H - 1 && ids[i + W] >= 0) ids[i] = ids[i + W]; }
  for (let i = 0; i < W * H; i++) if (ids[i] < 0 || idd[i * 4 + 3] < 100) ids[i] = 0;
  const grp = ref.props.map((p, k) => p ? (p.group ?? k) : 0);
  const G = (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return -1; return grp[ids[y * W + x]]; };
  const refd = ref.ctx.getImageData(0, 0, W, H).data;
  const Ir = integral(refd, W, H, 0), Ig = integral(refd, W, H, 1), Ib = integral(refd, W, H, 2);
  const lum = new Float32Array(W * H); for (let i = 0; i < W * H; i++) lum[i] = refd[i * 4] * .3 + refd[i * 4 + 1] * .59 + refd[i * 4 + 2] * .11;
  const Il = integral(lum, W, H, 0, 1);
  const mean = (I, x, y, r) => { const x0 = Math.max(0, Math.floor(x - r)), y0 = Math.max(0, Math.floor(y - r)), x1 = Math.min(W, Math.ceil(x + r + 1)), y1 = Math.min(H, Math.ceil(y + r + 1)); return boxSum(I, W, x0, y0, x1, y1) / Math.max(1, (x1 - x0) * (y1 - y0)); };
  // colour mean restricted to own group (so edge strokes don't pick up the neighbour's colour)
  const gmean = (x, y, r, g) => { let s0 = 0, s1 = 0, s2 = 0, n = 0; const st = Math.max(1, r / 3); for (let yy = -r; yy <= r; yy += st) for (let xx = -r; xx <= r; xx += st) { const px = x + xx | 0, py = y + yy | 0; if (G(px, py) !== g) continue; const i = (py * W + px) * 4; s0 += refd[i]; s1 += refd[i + 1]; s2 += refd[i + 2]; n++; } if (!n) { const i = ((y | 0) * W + (x | 0)) * 4; return [refd[i], refd[i + 1], refd[i + 2]]; } return [s0 / n, s1 / n, s2 / n]; };
  const pc = document.createElement('canvas'); pc.width = W; pc.height = H; const px = pc.getContext('2d', { willReadFrequently: true });
  let level = 0;
  for (const R of R0) {
    const cur = px.getImageData(0, 0, W, H).data;
    const step = Math.max(1, R * .8), list = [];
    for (let gy = 0; gy < H; gy += step) for (let gx = 0; gx < W; gx += step) {
      // cell error
      let err = 0, n = 0, best = -1, bx = 0, by = 0;
      const x0 = gx | 0, y0 = gy | 0, x1 = Math.min(W, (gx + step) | 0), y1 = Math.min(H, (gy + step) | 0);
      const sub = Math.max(1, (step / 5) | 0);
      for (let y = y0; y < y1; y += sub) for (let x = x0; x < x1; x += sub) {
        const i = y * W + x; if (!ids[i]) continue;
        const j = i * 4; let e;
        if (cur[j + 3] < 128) e = 255; else e = (Math.abs(cur[j] - refd[j]) + Math.abs(cur[j + 1] - refd[j + 1]) + Math.abs(cur[j + 2] - refd[j + 2])) / 3;
        err += e; n++; if (e > best) { best = e; bx = x; by = y; }
      }
      if (!n) continue;
      err /= n;
      const k = ids[(by | 0) * W + (bx | 0)]; const p = ref.props[k]; if (!p) continue;
      if (R > p.maxR * sc + .01 && R !== R0[R0.length - 1]) continue;
      const thr = T * (p.detail ?? 1);
      if (err < thr && level > 0) continue;
      if (level === 0 && n < 3) continue;
      // centre: blend between cell centre and max-error point
      let cx = level === 0 ? (gx + step * (.3 + rnd() * .4)) : (bx * .7 + (gx + step / 2) * .3);
      let cy = level === 0 ? (gy + step * (.3 + rnd() * .4)) : (by * .7 + (gy + step / 2) * .3);
      if (G(cx, cy) !== grp[k]) { cx = bx; cy = by; }
      list.push([cx, cy, k]);
    }
    // shuffle
    for (let i = list.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
    for (const [cx, cy, k] of list) {
      const p = ref.props[k], g = grp[k];
      let r = Math.min(R, p.maxR * sc) * (level === 0 ? .75 + rnd() * .7 : .8 + rnd() * .45);
      // direction
      let ang;
      const d = p.dir;
      const edgeAng = () => { const s = Math.max(1.5, r * .8); const gx = mean(Il, cx + s, cy, s) - mean(Il, cx - s, cy, s), gy = mean(Il, cx, cy + s, s) - mean(Il, cx, cy - s, s); return { a: Math.atan2(gy, gx) + Math.PI / 2, m: Math.hypot(gx, gy) }; };
      const base = typeof d === 'number' ? d * Math.PI / 180 : d && d.radial ? Math.atan2(cy / sc - d.radial[1], cx / sc - d.radial[0]) + (d.off || 0) * Math.PI / 180 : d && d.fn ? d.fn(cx / sc, cy / sc) : null;
      if (base === null) { const e = edgeAng(); ang = e.m > 2 ? e.a : (p.fallback ?? 0) * Math.PI / 180 + (rnd() - .5) * 1.2; }
      else { ang = base; if (p.follow) { const e = edgeAng(); if (e.m > p.follow) ang = e.a; } }
      ang += (rnd() - .5) * (p.aj ?? .45);
      const type = p.type;
      let len = r * (type === DAB ? 1.3 : 1.7 + rnd() * 1.4) * p.len, wid = r * (type === DAB ? 1.1 : .95 + rnd() * .5) * p.wid;
      // confinement: shrink until the footprint stays inside the group
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const inside = (L, Wd) => { for (const [a, b] of [[.5, .5], [.5, -.5], [-.5, .5], [-.5, -.5], [0, .5], [0, -.5], [.5, 0], [-.5, 0], [.25, .5], [-.25, -.5], [.25, -.5], [-.25, .5]]) { const x = cx + ca * a * L * .92 - sa * b * Wd * .9, y = cy + sa * a * L * .92 + ca * b * Wd * .9; const gg = G(x, y); if (gg !== g && !(p.bleed && gg === -1)) return false; } return true; };
      let ok = inside(len, wid), tries = 0;
      while (!ok && tries < 6) { if (len > wid * 1.2) len *= .72; else wid *= .78; tries++; ok = inside(len, wid); }
      if (!ok && r > R0[R0.length - 1] * 1.01) continue;
      if (!ok) { len = Math.max(len, 2); wid = Math.max(wid, 1.6); }
      // colours
      const cr = Math.max(1, Math.min(len, wid) * .35);
      let c1 = gmean(cx, cy, cr, g);
      const ex = cx + ca * len * .45, ey = cy + sa * len * .45;
      let c2 = G(ex, ey) === g ? gmean(ex, ey, cr, g) : c1;
      const j = 1 + (rnd() - .5) * p.jit * 2, hj = [(rnd() - .5) * .025, (rnd() - .5) * .025, (rnd() - .5) * .025];
      c1 = c1.map((v, i) => Math.min(1, Math.max(0, v / 255 * j + hj[i])));
      c2 = c2.map((v, i) => Math.min(1, Math.max(0, v / 255 * (j + (rnd() - .5) * p.jit) + hj[i])));
      // approx paint for the next level's error
      px.save(); px.translate(cx, cy); px.rotate(ang); px.fillStyle = `rgb(${c1[0] * 255},${c1[1] * 255},${c1[2] * 255})`;
      if (type === DAB) { px.beginPath(); px.ellipse(0, 0, len / 2, wid / 2, 0, 0, 6.3); px.fill(); } else px.fillRect(-len / 2, -wid / 2, len * .95, wid * .92);
      px.restore();
      const ux = cx / sc, uy = cy / sc;
      out.push({ x: ux, y: uy, ang, len: len / sc, wid: wid / sc, c: c1, c2, seed: rnd() * 1000, type, hgt: p.hgt * (.8 + rnd() * .4) * (1 - level * .06),
        rev: typeof p.rev === 'function' ? p.rev(ux, uy) : (p.rev ?? (o.rev ? o.rev(ux, uy) : 0)),
        app: o.app ? o.app(ux, uy, level) : 0, skew: p.type === KNIFE ? (rnd() - .5) * 1.1 : 0, bend: p.bend ? (rnd() - .5) * p.bend : 0, alpha: p.alpha ?? 1 });
    }
    level++;
  }
  return out;
}

// convenience: extra hand-placed strokes along a polyline (outlines, hair, ribs, ribbons)
export function strokePath(out, pts, o) {
  const step = o.step || 14;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) {
      const a = k / n, b = (k + 1) / n, xa = x0 + (x1 - x0) * a, ya = y0 + (y1 - y0) * a, xb = x0 + (x1 - x0) * b, yb = y0 + (y1 - y0) * b;
      out.push({ ...o, x: (xa + xb) / 2, y: (ya + yb) / 2, ang: Math.atan2(yb - ya, xb - xa), len: Math.hypot(xb - xa, yb - ya) * (o.over ?? 1.35), wid: o.wid, seed: o.seed ?? rnd() * 1000 });
    }
  }
  return out;
}
export { rnd };
