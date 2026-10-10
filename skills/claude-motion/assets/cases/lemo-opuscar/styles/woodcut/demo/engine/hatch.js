// Woodcut engine · regions + flow-aligned hatching (white-line technique)
// A Region is a rasterised shape (mask + exact distance-to-edge field). From it we derive
//  - an "inflated" normal (the shape read as a soft relief) → tone from a light direction
//  - a contour direction (lines that wrap around the form, Doré-style)
// hatch() traces evenly spaced streamlines (Jobard–Lefer) along a direction field and turns them into
// knife strokes whose width follows the tone: bright = wide white cuts, dark = no cut (solid ink).
import { clamp, mulberry } from '/core/lib.js';
import { mkStroke } from './knife.js';

// ---------- exact Euclidean distance transform (Felzenszwalb) ----------
function edt1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
function edt(grid, W, H) {   // grid: 0 at sources, INF elsewhere → squared distances (in place)
  const n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = grid[y * W + x]; edt1(f, H, d, v, z); for (let y = 0; y < H; y++) grid[y * W + x] = d[y]; }
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = grid[y * W + x]; edt1(f, W, d, v, z); for (let x = 0; x < W; x++) grid[y * W + x] = d[x]; }
}

let _cv = null;
function scratch(w, h) { if (!_cv) _cv = document.createElement('canvas'); if (_cv.width < w || _cv.height < h) { _cv.width = Math.max(w, _cv.width); _cv.height = Math.max(h, _cv.height); } const q = _cv.getContext('2d', { willReadFrequently: true }); q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, _cv.width, _cv.height); return q; }

// polys: array of polygons, each [[x,y],...] (even-odd fill → holes allowed), or a function(q) that fills a path on q
export class Region {
  constructor(polys, { res = 2, pad = 6, bbox = null } = {}) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    if (bbox) [x0, y0, x1, y1] = bbox;
    else for (const P of polys) for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 -= pad * res; y0 -= pad * res; x1 += pad * res; y1 += pad * res;
    const W = Math.max(2, Math.ceil((x1 - x0) / res)), H = Math.max(2, Math.ceil((y1 - y0) / res));
    Object.assign(this, { x0, y0, res, W, H, bbox: [x0, y0, x1, y1] });
    const q = scratch(W, H);
    q.setTransform(1 / res, 0, 0, 1 / res, -x0 / res, -y0 / res);
    q.fillStyle = '#fff'; q.beginPath();
    if (typeof polys === 'function') polys(q); else for (const P of polys) { q.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) q.lineTo(P[i][0], P[i][1]); q.closePath(); }
    q.fill('evenodd');
    const id = q.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) m[i] = id[i * 4 + 3] > 127 ? 1 : 0;
    this.m = m;
    // inside distance to the edge (px)
    const g = new Float64Array(W * H); for (let i = 0; i < W * H; i++) g[i] = m[i] ? 1e20 : 0;
    edt(g, W, H); const D = new Float32Array(W * H); for (let i = 0; i < W * H; i++) D[i] = Math.sqrt(g[i]) * res;
    // smooth a little so the gradient is clean
    this.D = blur(D, W, H, 2);
  }
  _i(x, y) { return [(x - this.x0) / this.res, (y - this.y0) / this.res]; }
  inside(x, y) { const i = Math.floor((x - this.x0) / this.res), j = Math.floor((y - this.y0) / this.res); return i >= 0 && j >= 0 && i < this.W && j < this.H && this.m[j * this.W + i] === 1; }
  dist(x, y) {
    let [u, v] = this._i(x, y); u = clamp(u - .5, 0, this.W - 1.001); v = clamp(v - .5, 0, this.H - 1.001);
    const i = Math.floor(u), j = Math.floor(v), f = u - i, e = v - j, W = this.W, D = this.D;
    return (D[j * W + i] * (1 - f) + D[j * W + i + 1] * f) * (1 - e) + (D[(j + 1) * W + i] * (1 - f) + D[(j + 1) * W + i + 1] * f) * e;
  }
  grad(x, y) { const h = this.res * 1.5; const gx = this.dist(x + h, y) - this.dist(x - h, y), gy = this.dist(x, y + h) - this.dist(x, y - h); const l = Math.hypot(gx, gy); return l < 1e-5 ? [0, 0, 0] : [gx / l, gy / l, l / (2 * h)]; }
  // "inflated" relief normal: height h(d) = R·sqrt(1-(1-d/R)^2) → round edges, flat top
  normal(x, y, R = 60) {
    const d = this.dist(x, y), [gx, gy, gl] = this.grad(x, y);
    const u = clamp(d / R), s = Math.max(.08, Math.sqrt(1 - (1 - u) * (1 - u))), dh = clamp((1 - u) / s, 0, 6) * clamp(gl);
    const nx = -gx * dh, ny = -gy * dh, nz = 1, l = Math.hypot(nx, ny, nz);
    return [nx / l, ny / l, nz / l];
  }
}
function blur(A, W, H, r) {
  const B = new Float32Array(W * H), C = new Float32Array(W * H), k = 2 * r + 1;
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += A[y * W + clamp(x, 0, W - 1)]; for (let x = 0; x < W; x++) { B[y * W + x] = s / k; s += A[y * W + Math.min(W - 1, x + r + 1)] - A[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += B[clamp(y, 0, H - 1) * W + x]; for (let y = 0; y < H; y++) { C[y * W + x] = s / k; s += B[Math.min(H - 1, y + r + 1) * W + x] - B[Math.max(0, y - r) * W + x]; } }
  return C;
}

// ---------- tone helpers ----------
export const light = (lx, ly, lz) => { const l = Math.hypot(lx, ly, lz); return [lx / l, ly / l, lz / l]; };
// lambert tone on the inflated relief of a region
export function reliefTone(reg, L, { R = 60, amb = .1, k = 1, rim = 0 } = {}) {
  return (x, y) => { const n = reg.normal(x, y, R); const d = n[0] * L[0] + n[1] * L[1] + n[2] * L[2]; return clamp(amb + k * Math.max(0, d) + rim * (1 - n[2])); };
}

// ---------- direction fields ----------
export const dirAngle = a => () => a;
export const dirRadial = (cx, cy) => (x, y) => Math.atan2(y - cy, x - cx);
export const dirRing = (cx, cy, sy = 1) => (x, y) => Math.atan2((y - cy) / sy, x - cx) + Math.PI / 2;
// lines parallel to the region outline; deep inside, blend towards `a0`
export const dirContour = (reg, a0 = 0, depth = 40) => (x, y) => {
  const [gx, gy, gl] = reg.grad(x, y), w = clamp(1 - reg.dist(x, y) / depth) * clamp(gl * 3);
  const cx = -gy, cy = gx, ax = Math.cos(a0), ay = Math.sin(a0);
  const sgn = cx * ax + cy * ay < 0 ? -1 : 1;
  return Math.atan2(w * cy * sgn + (1 - w) * ay, w * cx * sgn + (1 - w) * ax);
};

// ---------- streamline hatching ----------
// o: { dir(x,y)→angle, tone(x,y)→0..1, sp, wmax, lo, hi, gamma, step, seg:[min,max], gap:[min,max], kind,
//      minLen, maxLen, dtest, seed, reveal:{t0,t1,key(x,y)→0..1,speed,jit} , wmin, jit }
export function hatch(reg, o = {}) {
  const sp = o.sp ?? 9, h = o.step ?? Math.max(1.5, sp * .28), dtest = sp * (o.dtest ?? .6);
  const dir = o.dir || dirAngle(0), tone = o.tone || (() => .5);
  const wmax = o.wmax ?? sp * .95, lo = o.lo ?? .18, hi = o.hi ?? .95, gam = o.gamma ?? 1, wmin = o.wmin ?? Math.max(.8, sp * .08);
  const rnd = mulberry(o.seed ?? 7), minLen = o.minLen ?? sp * 1.2, maxLen = o.maxLen ?? 4000;
  const seg = o.seg || [sp * 4, sp * 16], gap = o.gap || [1.5, sp * .5];
  const [bx0, by0, bx1, by1] = reg.bbox, cs = dtest, GW = Math.ceil((bx1 - bx0) / cs) + 1, GH = Math.ceil((by1 - by0) / cs) + 1;
  const grid = new Array(GW * GH);
  const lines = [];
  const near = (x, y, dd, id) => {
    const gi = Math.floor((x - bx0) / cs), gj = Math.floor((y - by0) / cs), r = Math.ceil(dd / cs), d2 = dd * dd;
    for (let j = gj - r; j <= gj + r; j++) { if (j < 0 || j >= GH) continue; for (let i = gi - r; i <= gi + r; i++) { if (i < 0 || i >= GW) continue; const c = grid[j * GW + i]; if (!c) continue; for (let k = 0; k < c.length; k += 3) { if (c[k + 2] === id) continue; const dx = c[k] - x, dy = c[k + 1] - y; if (dx * dx + dy * dy < d2) return true; } } }
    return false;
  };
  const addPt = (x, y, id) => { const gi = Math.floor((x - bx0) / cs), gj = Math.floor((y - by0) / cs); if (gi < 0 || gj < 0 || gi >= GW || gj >= GH) return; const k = gj * GW + gi; (grid[k] || (grid[k] = [])).push(x, y, id); };
  const jit = o.jit ?? 0;
  const dirAt = (x, y) => dir(x, y) + (jit ? jit * (Math.sin(x * .031 + y * .017) + Math.sin(x * .013 - y * .027)) * .5 : 0);
  const trace = (sx, sy, id) => {
    const half = sgn => {
      const out = []; let x = sx, y = sy, a = dirAt(x, y), px = Math.cos(a) * sgn, py = Math.sin(a) * sgn, len = 0;
      for (let it = 0; it < 20000; it++) {
        let a1 = dirAt(x, y), vx = Math.cos(a1), vy = Math.sin(a1); if (vx * px + vy * py < 0) { vx = -vx; vy = -vy; }
        const mx = x + vx * h * .5, my = y + vy * h * .5; let a2 = dirAt(mx, my), wx = Math.cos(a2), wy = Math.sin(a2); if (wx * vx + wy * vy < 0) { wx = -wx; wy = -wy; }
        const nx = x + wx * h, ny = y + wy * h;
        if (!reg.inside(nx, ny) || near(nx, ny, dtest, id)) break;
        if (len > 30 && Math.hypot(nx - sx, ny - sy) < h * 1.5) break;   // closed loop
        x = nx; y = ny; px = wx; py = wy; len += h; out.push([x, y]); if (len > maxLen * .5) break;
      }
      return out;
    };
    const f = half(1), b = half(-1);
    return [...b.reverse(), [sx, sy], ...f];
  };
  const queue = [];
  const tryLine = (sx, sy) => {
    if (!reg.inside(sx, sy) || near(sx, sy, sp * .92, -1)) return;
    const id = lines.length, L = trace(sx, sy, id);
    if (L.length * h < minLen) return;
    lines.push(L); for (const [x, y] of L) addPt(x, y, id);
    for (let k = 0; k < L.length; k += 3) {
      const i0 = Math.max(0, k - 1), i1 = Math.min(L.length - 1, k + 1); let tx = L[i1][0] - L[i0][0], ty = L[i1][1] - L[i0][1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      queue.push([L[k][0] - ty * sp, L[k][1] + tx * sp], [L[k][0] + ty * sp, L[k][1] - tx * sp]);
    }
  };
  // coarse seed grid (random order) + neighbour seeding
  const seeds = [];
  for (let y = by0 + sp * .5; y < by1; y += sp * 2.2) for (let x = bx0 + sp * .5; x < bx1; x += sp * 2.2) seeds.push([x + (rnd() - .5) * sp, y + (rnd() - .5) * sp]);
  for (let i = seeds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [seeds[i], seeds[j]] = [seeds[j], seeds[i]]; }
  if (o.seedAt) seeds.unshift(...o.seedAt);
  for (const s of seeds) { tryLine(s[0], s[1]); while (queue.length) { const q = queue.shift(); tryLine(q[0], q[1]); } }

  if (o.debug) console.warn('hatch lines', lines.length, seeds.length, lines.reduce((a, l) => a + l.length, 0));
  // lines → knife strokes, width from tone, broken into cut lengths
  const out = [], rv = o.reveal, kind = o.kind || 'v';
  for (const L of lines) {
    let cur = [], cw = [], acc = 0, target = seg[0] + rnd() * (seg[1] - seg[0]), skip = 0;
    const flush = () => {
      if (cur.length >= 3) {
        const s = mkStroke(cur, cw, { kind, seed: rnd() * 1000, chip: o.chip ?? .16 });
        if (rv) {
          const a = cur[0], b = cur[cur.length - 1], ka = rv.key(a[0], a[1]), kb = rv.key(b[0], b[1]);
          if (kb < ka && !rv.keepDir) { s.p = Float32Array.from(cur.slice().reverse().flat()); s.w = Float32Array.from(cw.slice().reverse()); }
          const k0 = Math.min(ka, kb);
          s.t0 = rv.t0 + clamp(k0 + (rnd() - .5) * (rv.jit ?? .08)) * (rv.t1 - rv.t0);
          s.dur = Math.max(.04, acc / (rv.speed ?? 900));
        }
        out.push(s);
      }
      cur = []; cw = []; acc = 0; target = seg[0] + rnd() * (seg[1] - seg[0]);
    };
    for (let i = 0; i < L.length; i++) {
      const [x, y] = L[i];
      if (skip > 0) { skip -= h; continue; }
      const t = tone(x, y), u = clamp((t - lo) / (hi - lo)), w = wmax * Math.pow(u, gam);
      if (w < wmin) { flush(); continue; }
      cur.push([x, y]); cw.push(w); if (cur.length > 1) acc += h;
      if (acc > target) { flush(); skip = gap[0] + rnd() * (gap[1] - gap[0]); }
    }
    flush();
  }
  return out;
}

// straight parallel lines clipped to a region (fast path for skies / planks); widths from tone
export function lines(reg, o = {}) { return hatch(reg, { ...o, dir: dirAngle(o.angle ?? 0) }); }
