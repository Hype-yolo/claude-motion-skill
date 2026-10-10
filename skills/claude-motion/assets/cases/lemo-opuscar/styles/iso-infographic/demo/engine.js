// Isometric Infographic engine — Canvas 2D, true isometric (axes at 30°), flat 3-tone faces, no outlines.
// World: x → screen down-right, y → screen down-left, z → up.  Depth toward viewer = x + y + z.
// Usage: const iso = new Iso(ctx); iso.cam = {x,y,z,k}; iso.box(...); iso.prism(...); ...; iso.flush();
export const C30 = Math.cos(Math.PI / 6), S30 = 0.5, TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const eo = t => 1 - Math.pow(1 - clamp(t), 3);
export const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const back = (t, s = 1.7) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
export const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// ---------- colour ----------
const _rgb = {};
export function rgb(c) {
  if (typeof c !== 'string') return c;
  if (_rgb[c]) return _rgb[c];
  let h = c.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join('');
  return (_rgb[c] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
}
export const css = (r, a = 1) => a >= 1 ? `rgb(${r[0] | 0},${r[1] | 0},${r[2] | 0})` : `rgba(${r[0] | 0},${r[1] | 0},${r[2] | 0},${a})`;
export const mix = (a, b, t) => { a = rgb(a); b = rgb(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
export const hex = r => '#' + r.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
// A "tri" is [top, left(+y face, mid), right(+x face, dark)].
export function tri(c, lift = .2, drop = .22) { return [hex(mix(c, '#FFF7E6', lift)), hex(rgb(c)), hex(mix(c, '#231A2C', drop))]; }
export const PAL = {
  red: ['#CF5140', '#B3352B', '#8C2620'],
  green: ['#7BA75F', '#5E8C4A', '#476F37'],
  blue: ['#5A9BCB', '#3C7FB1', '#2D6390'],
  cream: ['#FBF4E6', '#F2E6D0', '#D9C8A9'],
  soil: ['#A77850', '#8A5B3A', '#6A432A'],
  stone: ['#CFCABF', '#B8B2A6', '#948E83'],
  mustard: ['#E9BE5C', '#D9A53A', '#B0832A'],
  ink: '#2E2522', bg: '#F2E6D0', paper: '#FBF4E6',
};

// ---------- the engine ----------
export class Iso {
  constructor(g, W = 1920, H = 1080) {
    this.g = g; this.W = W; this.H = H;
    this.cam = { x: 0, y: 0, z: 0, k: 10 };
    this.items = []; this.T = null; this.stack = [];
    this.desat = 0; this.keep = false; this.alpha = 1; this.seq = 0;
    this.light = [0, 0, 1];
  }
  // local transform: translate + rotate about z (+ uniform scale). Applies to every primitive.
  push(ox = 0, oy = 0, oz = 0, rot = 0, s = 1) {
    this.stack.push(this.T);
    const p = this.T, c = Math.cos(rot), sn = Math.sin(rot);
    this.T = { ox, oy, oz, c, s: sn, k: s, parent: p };
  }
  pop() { this.T = this.stack.pop(); }
  w(x, y, z) { // local → world
    let T = this.T;
    while (T) { const X = (x * T.c - y * T.s) * T.k + T.ox, Y = (x * T.s + y * T.c) * T.k + T.oy; z = z * T.k + T.oz; x = X; y = Y; T = T.parent; }
    return [x, y, z];
  }
  wn(nx, ny, nz) { let T = this.T; while (T) { const X = nx * T.c - ny * T.s, Y = nx * T.s + ny * T.c; nx = X; ny = Y; T = T.parent; } return [nx, ny, nz]; }
  // world → screen
  P(x, y, z) { const c = this.cam, k = c.k, X = x - c.x, Y = y - c.y; return [this.W / 2 + (X - Y) * C30 * k, this.H / 2 + ((X + Y) * S30 - (z - c.z)) * k]; }
  L(x, y, z) { const [a, b, c] = this.w(x, y, z); return this.P(a, b, c); } // local → screen
  // inverse of P on plane z
  unP(sx, sy, z = 0) { const c = this.cam, k = c.k; const u = (sx - this.W / 2) / (C30 * k), v = (sy - this.H / 2) / k + (z - c.z); const X = v + u / 2, Y = v - u / 2; return [X + c.x, Y + c.y]; }
  vis(x, y, z, r) { const [sx, sy] = this.P(x, y, z), R = r * this.cam.k * 1.2 + 4; return sx > -R && sx < this.W + R && sy > -R && sy < this.H + R; }
  // ---- colour pipeline (desaturation with one-colour exception) ----
  col(c, a = 1) {
    let r = rgb(c);
    if (this.desat > 0 && !this.keep) { const l = r[0] * .3 + r[1] * .55 + r[2] * .15; const gr = mix([l, l, l], '#E9DFCB', .45); r = mix(r, gr, this.desat); }
    return css(r, a * this.alpha);
  }
  shadeN(t3, n) { // tri + world normal → colour
    if (typeof t3 === 'string') return t3;
    const wt = Math.max(n[2], 0), wl = Math.max(n[1], 0), wr = Math.max(n[0], 0), s = wt + wl + wr || 1;
    const A = rgb(t3[0]), B = rgb(t3[1]), C = rgb(t3[2]);
    return [(A[0] * wt + B[0] * wl + C[0] * wr) / s, (A[1] * wt + B[1] * wl + C[1] * wr) / s, (A[2] * wt + B[2] * wl + C[2] * wr) / s];
  }
  // ---- queue ----
  add(depth, fn, layer = 1) { const st = { T: this.T, keep: this.keep, alpha: this.alpha }; this.items.push({ d: depth, l: layer, s: this.seq++, fn, st }); }
  flush() {
    const it = this.items; this.items = [];
    it.sort((a, b) => a.l - b.l || a.d - b.d || a.s - b.s);
    const T0 = this.T, K0 = this.keep, A0 = this.alpha;
    for (const i of it) { this.T = i.st.T; this.keep = i.st.keep; this.alpha = i.st.alpha; i.fn(); }
    this.T = T0; this.keep = K0; this.alpha = A0;
  }
  // run fn with its own sorted sub-queue (for interiors drawn between back and front walls)
  sub(fn) { const saved = this.items; this.items = []; fn(); const mine = this.items; this.items = saved; const T0 = this.T; mine.sort((a, b) => a.l - b.l || a.d - b.d || a.s - b.s); for (const i of mine) { this.T = i.st.T; this.keep = i.st.keep; this.alpha = i.st.alpha; i.fn(); } this.T = T0; }
  // ---- raw drawing ----
  poly(pts, fill, a = 1) { const g = this.g; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = typeof fill === 'string' && fill.startsWith('rgb') ? fill : this.col(fill, a); g.fill(); }
  face3(pts3, t3, opt = {}) { // local 3D polygon, shaded by its normal; skips back faces unless opt.both
    const W = pts3.map(p => this.w(p[0], p[1], p[2]));
    let n = normal(W);
    if (opt.out) { const o = this.wn(opt.out[0], opt.out[1], opt.out[2]); if (n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0) n = [-n[0], -n[1], -n[2]]; }
    if (!opt.both && n[0] + n[1] + n[2] <= 1e-6) return false;
    const c = opt.color ? opt.color : this.shadeN(t3, n[0] + n[1] + n[2] < 0 ? [-n[0], -n[1], -n[2]] : n);
    this.poly(W.map(p => this.P(p[0], p[1], p[2])), c, opt.a ?? 1); return true;
  }
  // ---- primitives (queued, auto depth) ----
  box(x, y, z, w, d, h, t3, o = {}) {
    const [cx, cy, cz] = this.w(x + w / 2, y + d / 2, z + h / 2);
    if (o.cull !== false && !this.vis(cx, cy, cz, Math.hypot(w, d, h) * (this.T ? this.scale() : 1))) return;
    this.add(cx + cy + cz + (o.bias || 0), () => this.boxNow(x, y, z, w, d, h, t3, o), o.layer ?? 1);
  }
  scale() { let k = 1, T = this.T; while (T) { k *= T.k; T = T.parent; } return k; }
  boxNow(x, y, z, w, d, h, t3, o = {}) {
    if (typeof t3 === 'string') t3 = tri(t3);
    const X = x + w, Y = y + d, Z = z + h, F = [];
    F.push([[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]]);          // top
    F.push([[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]]);          // +y (left)
    F.push([[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]]);          // +x (right)
    F.push([[x, y, z], [x, y, Z], [X, y, Z], [X, y, z]]);          // -y
    F.push([[x, y, z], [x, Y, z], [x, Y, Z], [x, y, Z]]);          // -x
    // order faces far→near by their centre depth
    const order = F.map((f, i) => { const c = f.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]); const W = this.w(c[0], c[1], c[2]); return [W[0] + W[1] + W[2], i]; }).sort((a, b) => a[0] - b[0]);
    const OUT = [[0, 0, 1], [0, 1, 0], [1, 0, 0], [0, -1, 0], [-1, 0, 0]];
    for (const [, i] of order) { if (o.skip && o.skip.includes(i)) continue; this.face3(F[i], t3, { color: o.faceColor?.[i], out: OUT[i] }); }
    if (o.decal) o.decal(this, { x, y, z, w, d, h });
  }
  // extruded footprint polygon (local XY), from z to z+h
  prism(pts, z, h, t3, o = {}) {
    let cx = 0, cy = 0; pts.forEach(p => { cx += p[0] / pts.length; cy += p[1] / pts.length; });
    const W = this.w(cx, cy, z + h / 2), r = Math.max(...pts.map(p => Math.hypot(p[0] - cx, p[1] - cy)), h) * this.scale();
    if (o.cull !== false && !this.vis(W[0], W[1], W[2], r)) return;
    this.add(W[0] + W[1] + W[2] + (o.bias || 0), () => this.prismNow(pts, z, h, t3, o), o.layer ?? 1);
  }
  prismNow(pts, z, h, t3, o = {}) {
    if (typeof t3 === 'string') t3 = tri(t3);
    const n = pts.length, Z = z + h, sides = [];
    let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const sg = area >= 0 ? 1 : -1;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const f = [[a[0], a[1], z], [b[0], b[1], z], [b[0], b[1], Z], [a[0], a[1], Z]]; const m = this.w((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0); sides.push([m[0] + m[1], f, [(b[1] - a[1]) * sg, -(b[0] - a[0]) * sg, 0]]); }
    sides.sort((A, B) => A[0] - B[0]);
    if (h > 0) for (const [, f, out] of sides) this.face3(f, t3, { color: o.sideColor, out });
    if (o.top !== false) this.face3(pts.map(p => [p[0], p[1], Z]), t3, { both: true, color: o.topColor });
    if (o.decal) o.decal(this);
  }
  // cylinder: vertical (axis 'z') or lying along 'x' / 'y'
  cyl(x, y, z, r, h, t3, o = {}) {
    const n = o.n || 24, axis = o.axis || 'z';
    if (axis === 'z') { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } return this.prism(pts, z, h, t3, o); }
    const [cx, cy, cz] = axis === 'x' ? [x + h / 2, y, z] : [x, y + h / 2, z];
    const W = this.w(cx, cy, cz); if (o.cull !== false && !this.vis(W[0], W[1], W[2], Math.max(r, h) * this.scale())) return;
    this.add(W[0] + W[1] + W[2] + (o.bias || 0), () => this.cylNow(x, y, z, r, h, t3, o), o.layer ?? 1);
  }
  cylNow(x, y, z, r, h, t3, o = {}) {
    if (typeof t3 === 'string') t3 = tri(t3);
    const n = o.n || 24, axis = o.axis, ring = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + (o.spin || 0), u = Math.cos(a) * r, v = Math.sin(a) * r; ring.push(axis === 'x' ? [0, u, v] : [u, 0, v]); }
    const off = axis === 'x' ? [h, 0, 0] : [0, h, 0], base = [x, y, z];
    const A = ring.map(p => [p[0] + base[0], p[1] + base[1], p[2] + base[2]]), B = A.map(p => [p[0] + off[0], p[1] + off[1], p[2] + off[2]]);
    const sides = [];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; const f = [A[i], A[j], B[j], B[i]]; const W = this.w((A[i][0] + B[j][0]) / 2, (A[i][1] + B[j][1]) / 2, (A[i][2] + B[j][2]) / 2); sides.push([W[0] + W[1] + W[2], f, i]); }
    sides.sort((P, Q) => P[0] - Q[0]);
    const ax = axis === 'x' ? [1, 0, 0] : [0, 1, 0];
    this.face3(A, t3, { out: [-ax[0], -ax[1], 0] });
    for (const [, f, i] of sides) this.face3(f, t3, { color: o.stripe && o.stripe(i), out: ring[i].map((v, q) => v + ring[(i + 1) % n][q]) });
    this.face3(B, t3, { color: o.capColor, out: ax });
    if (o.decal) o.decal(this);
  }
  cone(x, y, z, r, h, t3, o = {}) { // vertical cone / pyramid (n sides)
    const n = o.n || 20;
    const W = this.w(x, y, z + h / 3); if (o.cull !== false && !this.vis(W[0], W[1], W[2], Math.max(r, h) * this.scale())) return;
    this.add(W[0] + W[1] + W[2] + (o.bias || 0), () => this.coneNow(x, y, z, r, h, t3, o), o.layer ?? 1);
  }
  coneNow(x, y, z, r, h, t3, o = {}) {
    const n = o.n || 20; {
      const tt = typeof t3 === 'string' ? tri(t3) : t3, fs = [];
      for (let i = 0; i < n; i++) { const a = i / n * TAU + (o.rot || 0), b = (i + 1) / n * TAU + (o.rot || 0); const f = [[x + Math.cos(a) * r, y + Math.sin(a) * r, z], [x + Math.cos(b) * r, y + Math.sin(b) * r, z], [x, y, z + h]]; const m = this.w(x + Math.cos((a + b) / 2) * r, y + Math.sin((a + b) / 2) * r, z); fs.push([m[0] + m[1], f, [Math.cos((a + b) / 2), Math.sin((a + b) / 2), r / h]]); }
      fs.sort((A, B) => A[0] - B[0]); for (const [, f, out] of fs) this.face3(f, tt, { out });
    }
  }
  // gable roof along x (ridge parallel to x) or y
  roof(x, y, z, w, d, h, t3, o = {}) {
    const W = this.w(x + w / 2, y + d / 2, z + h / 2); if (!this.vis(W[0], W[1], W[2], Math.hypot(w, d) * this.scale())) return;
    this.add(W[0] + W[1] + W[2] + (o.bias || 0), () => {
      const tt = typeof t3 === 'string' ? tri(t3) : t3, X = x + w, Y = y + d, Z = z + h, ov = o.over || 0;
      if ((o.ridge || 'x') === 'x') {
        const m = y + d / 2;
        this.face3([[x, y, z], [x, m, Z], [x, Y, z]], o.gable || tt, { out: [-1, 0, 0] }); this.face3([[X, Y, z], [X, m, Z], [X, y, z]], o.gable || tt, { out: [1, 0, 0] });
        this.face3([[x - ov, y - ov, z], [X + ov, y - ov, z], [X + ov, m, Z], [x - ov, m, Z]], tt, { out: [0, -1, 1] }); this.face3([[x - ov, m, Z], [X + ov, m, Z], [X + ov, Y + ov, z], [x - ov, Y + ov, z]], tt, { out: [0, 1, 1] });
      } else {
        const m = x + w / 2;
        this.face3([[x, y, z], [X, y, z], [m, y, Z]], o.gable || tt, { out: [0, -1, 0] }); this.face3([[X, Y, z], [x, Y, z], [m, Y, Z]], o.gable || tt, { out: [0, 1, 0] });
        this.face3([[x - ov, y - ov, z], [m, y - ov, Z], [m, Y + ov, Z], [x - ov, Y + ov, z]], tt, { out: [-1, 0, 1] }); this.face3([[m, y - ov, Z], [X + ov, y - ov, z], [X + ov, Y + ov, z], [m, Y + ov, Z]], tt, { out: [1, 0, 1] });
      }
    }, o.layer ?? 1);
  }
  // sphere: flat disc with a lit cap (upper-left) and a dark crescent (right)
  sphere(x, y, z, r, t3, o = {}) {
    const W = this.w(x, y, z); if (o.cull !== false && !this.vis(W[0], W[1], W[2], r * this.scale())) return;
    this.add(W[0] + W[1] + W[2] + (o.bias || 0), () => this.sphereNow(x, y, z, r, t3, o), o.layer ?? 1);
  }
  sphereNow(x, y, z, r, t3, o = {}) {
    if (typeof t3 === 'string') t3 = tri(t3);
    const g = this.g, [sx, sy] = this.L(x, y, z), R = r * this.cam.k * this.scale();
    if (R < .4) return;
    g.save(); g.beginPath(); g.ellipse(sx, sy, R, R * (o.squash || 1), o.rot || 0, 0, TAU); g.fillStyle = this.col(t3[1]); g.fill(); g.clip();
    g.beginPath(); g.ellipse(sx + R * .62, sy + R * .28, R * 1.02, R * 1.1, 0, 0, TAU); g.fillStyle = this.col(t3[2]); g.fill();
    g.beginPath(); g.ellipse(sx - R * .28, sy - R * .55, R * .9, R * .72, 0, 0, TAU); g.fillStyle = this.col(t3[0]); g.fill();
    if (o.hi !== false && R > 6) { g.beginPath(); g.ellipse(sx - R * .38, sy - R * .52, R * .2, R * .12, -.5, 0, TAU); g.fillStyle = this.col('#FFF8EC', .7); g.fill(); }
    g.restore();
  }
  // flat polygon on plane z (ground decal); layer default 0
  flat(pts, z, c, o = {}) {
    const W = this.w(pts[0][0], pts[0][1], z);
    this.add(o.depth ?? (W[0] + W[1] + W[2] - 1e3 + (o.bias || 0)), () => { this.poly(pts.map(p => this.L(p[0], p[1], z)), c, o.a ?? 1); }, o.layer ?? 0);
  }
  // 3D polyline (world-local), screen-width px
  line3(pts, c, lw = 2, o = {}) {
    const f = () => { const g = this.g; g.save(); g.beginPath(); pts.forEach((p, i) => { const s = this.L(p[0], p[1], p[2]); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); g.strokeStyle = this.col(c, o.a ?? 1); g.lineWidth = o.world ? lw * this.cam.k * this.scale() : lw; g.lineCap = o.cap || 'round'; g.lineJoin = 'round'; if (o.dash) g.setLineDash(o.dash); g.lineDashOffset = o.off || 0; g.stroke(); g.restore(); };
    if (o.now) return f();
    const m = this.w(...pts[pts.length >> 1]); this.add(o.depth ?? (m[0] + m[1] + m[2] + (o.bias || 0)), f, o.layer ?? 1);
  }
  // billboard: a 2D drawing in screen space anchored at a world point, scaled by zoom (unit = 1 world unit)
  bill(x, y, z, fn, o = {}) {
    const W = this.w(x, y, z); if (o.cull !== false && !this.vis(W[0], W[1], W[2], (o.r || 3) * this.scale())) return;
    this.add(W[0] + W[1] + W[2] + (o.bias || 0), () => { const g = this.g, [sx, sy] = this.L(x, y, z), k = this.cam.k * this.scale(); g.save(); g.translate(sx, sy); g.scale(k, k); fn(g, this, k); g.restore(); }, o.layer ?? 1);
  }
  // ---- isometric text: glyphs on a world plane, optionally extruded ----
  // plane 'xy' (lying, reads up-right), 'xz' (standing, faces +y, reads down-right), 'yz' (standing, faces +x, reads up-right)
  text3(str, x, y, z, o = {}) {
    const W = this.w(x, y, z); this.add(o.depth ?? (W[0] + W[1] + W[2] + (o.bias || 0)), () => this.text3Now(str, x, y, z, o), o.layer ?? 1);
  }
  text3Now(str, x, y, z, o = {}) {
    const g = this.g, k = this.cam.k * this.scale(), size = o.size || 2, plane = o.plane || 'xy', ex = o.extrude || 0;
    const t3 = typeof o.tri === 'string' ? tri(o.tri) : (o.tri || PAL.cream);
    let u, v, e;
    if (plane === 'xy') { u = [C30, -S30]; v = [C30, S30]; e = [0, -1]; }       // u = −y, v = +x, extrude +z
    else if (plane === 'xz') { u = [C30, S30]; v = [0, 1]; e = [-C30, S30]; }  // u = +x, v = −z, extrude +y
    else { u = [C30, -S30]; v = [0, 1]; e = [C30, S30]; }                       // 'yz': u = −y, v = −z, extrude +x
    const [sx, sy] = this.L(x, y, z);
    g.save(); g.font = `${o.weight || 700} 100px ${o.font || 'Jost'}`; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
    if (o.track) g.letterSpacing = o.track + 'px';
    const sc = size * k / 100, steps = Math.max(1, Math.ceil(ex * k / 1.2));
    for (let i = 0; i <= steps; i++) {
      const f = i / steps * ex * k;
      g.setTransform(u[0] * sc, u[1] * sc, v[0] * sc, v[1] * sc, sx + e[0] * f, sy + e[1] * f);
      g.fillStyle = this.col(i === steps ? (o.face || t3[0]) : (i < steps * .5 ? t3[2] : t3[1]), o.a ?? 1);
      g.fillText(str, 0, 0);
    }
    g.restore();
  }
}
export function normal(W) { // Newell
  let nx = 0, ny = 0, nz = 0; for (let i = 0; i < W.length; i++) { const a = W[i], b = W[(i + 1) % W.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
}

// ---------- infographic layer (screen space) ----------
export const FONT = 'Jost';
export function haloText(g, s, x, y, o = {}) {
  g.save(); g.font = o.font || `600 26px ${FONT}`; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
  if (o.track) g.letterSpacing = o.track + 'px';
  if (o.halo !== false) { g.lineJoin = 'round'; g.strokeStyle = o.haloColor || 'rgba(251,244,230,.92)'; g.lineWidth = o.hw || 7; g.strokeText(s, x, y); }
  g.fillStyle = o.color || PAL.ink; g.fillText(s, x, y); const w = g.measureText(s).width; g.restore(); return w;
}
// label pin: dot on the object → vertical leader → horizontal rule → title / number / icon row.  a ∈ [0,1] reveal
export function pin(iso, x, y, z, o = {}) {
  const g = iso.g, a = o.a ?? 1; if (a <= 0) return;
  const [ax, ay] = iso.P(x, y, z), up = o.up ?? 130, dir = o.dir ?? 1, len = o.len ?? 60;
  const s1 = eo(seg(a, 0, .18)), s2 = eo(seg(a, .12, .42)), s3 = eo(seg(a, .36, .55)), s4 = seg(a, .45, 1);
  g.save(); g.globalAlpha = o.fade ?? 1;
  g.strokeStyle = PAL.ink; g.lineWidth = 2; g.lineCap = 'round';
  // leader
  if (s2 > 0) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax, ay - up * s2); if (s3 > 0) g.lineTo(ax + dir * len * s3, ay - up); g.stroke(); }
  // dot
  const R = 7 * back(s1, 2.2); g.beginPath(); g.arc(ax, ay, Math.max(0, R), 0, TAU); g.fillStyle = PAL.paper; g.fill(); g.stroke();
  g.beginPath(); g.arc(ax, ay, Math.max(0, R * .42), 0, TAU); g.fillStyle = o.dot || PAL.ink; g.fill();
  // text
  if (s4 > 0) {
    const tx = ax + dir * (len + 12), ty = ay - up;
    g.save(); g.beginPath(); const wv = 900 * ss(s4); if (dir > 0) g.rect(tx - 4, ty - 80, wv, 220); else g.rect(tx + 4 - wv, ty - 80, wv, 220); g.clip();
    const al = dir > 0 ? 'left' : 'right', ns = o.ns || 44, uf = `500 ${Math.round(ns * .5)}px ${FONT}`;
    haloText(g, o.title || '', tx, ty - 10, { font: `600 ${o.ts || 25}px ${FONT}`, track: 3.5, align: al });
    let uw = 0; if (o.unit) { g.font = uf; g.letterSpacing = '2px'; uw = g.measureText(o.unit).width + 10; g.letterSpacing = '0px'; }
    let nw = 0; if (o.num) { g.font = `400 ${ns}px ${FONT}`; nw = g.measureText(o.num).width; }
    if (o.num) haloText(g, o.num, dir > 0 ? tx : tx - uw, ty + ns + 2, { font: `400 ${ns}px ${FONT}`, align: al, track: .5 });
    if (o.unit) haloText(g, o.unit, dir > 0 ? tx + nw + 10 : tx, ty + ns + 2, { font: uf, align: al, track: 2 });
    g.restore();
    if (o.icons) o.icons(g, tx, ty + (o.num ? ns + 18 : 12), dir);
  }
  g.restore();
}
// circular detail inset (frame within the frame), leader from anchor. drawIn(g, cx, cy, r) draws inside the clipped disc
export function inset(iso, ax, ay, cx, cy, r, a, drawIn, o = {}) {
  const g = iso.g; if (a <= 0) return;
  const l = eo(seg(a, 0, .35)), c = back(seg(a, .25, .8), 1.4), R = r * c;
  const ang = Math.atan2(cy - ay, cx - ax), ex = cx - Math.cos(ang) * R, ey = cy - Math.sin(ang) * R;
  g.save(); g.strokeStyle = PAL.ink; g.lineWidth = 2;
  g.beginPath(); g.moveTo(ax, ay); g.lineTo(lerp(ax, ex, l), lerp(ay, ey, l)); g.stroke();
  g.beginPath(); g.arc(ax, ay, 6, 0, TAU); g.fillStyle = PAL.paper; g.fill(); g.stroke(); g.beginPath(); g.arc(ax, ay, 2.6, 0, TAU); g.fillStyle = PAL.ink; g.fill();
  if (R > 1) {
    g.beginPath(); g.arc(cx + 6, cy + 9, R, 0, TAU); g.fillStyle = 'rgba(46,37,34,.14)'; g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip(); g.fillStyle = o.bg || PAL.paper; g.fillRect(cx - R, cy - R, 2 * R, 2 * R); drawIn(g, cx, cy, R, c); g.restore();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(cx, cy, R + 7, 0, TAU); g.lineWidth = 1; g.setLineDash([3, 5]); g.stroke(); g.setLineDash([]);
  }
  g.restore();
}
// tracking ring ("you are here"): dashed ring that slowly turns + optional tag
export function ring(g, x, y, r, a = 1, t = 0, tag = null, o = {}) {
  if (a <= 0) return; g.save(); g.globalAlpha = a; g.strokeStyle = o.color || PAL.ink; g.lineWidth = o.lw || 2.5; g.setLineDash([r * .35, r * .22]); g.lineDashOffset = -t * r * .6;
  g.beginPath(); g.arc(x, y, r * eo(seg(a, 0, 1)), 0, TAU); g.stroke(); g.setLineDash([]);
  if (tag) { const ang = o.ang ?? -.8, px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r, qx = px + 26, qy = py - 26; g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.lineTo(qx + 18, qy); g.stroke(); haloText(g, tag, qx + 24, qy + 9, { font: `600 ${o.ts || 26}px ${FONT}`, track: 2 }); }
  g.restore();
}
// cut line: dashed ink line with a small scissor-tick at the head, drawn to fraction a
export function cutLine(g, pts, a, o = {}) {
  if (a <= 0) return; let L = 0; const d = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); d.push(l); L += l; }
  let rem = L * clamp(a); g.save(); g.strokeStyle = o.color || PAL.ink; g.lineWidth = o.lw || 2.5; g.setLineDash(o.dash || [10, 7]); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); let hx = pts[0][0], hy = pts[0][1];
  for (let i = 1; i < pts.length && rem > 0; i++) { const f = Math.min(1, rem / d[i - 1]); hx = lerp(pts[i - 1][0], pts[i][0], f); hy = lerp(pts[i - 1][1], pts[i][1], f); g.lineTo(hx, hy); rem -= d[i - 1]; }
  g.stroke(); g.setLineDash([]); if (a < 1) { g.beginPath(); g.arc(hx, hy, 5, 0, TAU); g.fillStyle = o.color || PAL.ink; g.fill(); } g.restore();
}
// section hatch fill for cut faces (cream + 45° ink hatching), pts in screen space
export function hatch(g, pts, o = {}) {
  g.save(); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = o.fill || PAL.paper; g.fill(); g.clip();
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), sp = o.sp || 7;
  g.strokeStyle = o.color || 'rgba(46,37,34,.55)'; g.lineWidth = o.lw || 1.2; g.beginPath();
  for (let s = x0 - (y1 - y0); s < x1; s += sp) { g.moveTo(s, y1); g.lineTo(s + (y1 - y0), y0); } g.stroke(); g.restore();
  g.save(); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.strokeStyle = PAL.ink; g.lineWidth = o.edge || 1.5; g.stroke(); g.restore();
}

// ---------- Isotype icons (screen space, size s px, drawn in the same 3-tone language) ----------
const mini = (g, s) => ({ P: (x, y, z) => [(x - y) * C30 * s, ((x + y) * S30 - z) * s] });
function mbox(g, M, x, y, z, w, d, h, t3, lit = 1) {
  const f = (pts, c) => { g.beginPath(); pts.forEach((p, i) => { const q = M.P(...p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.fillStyle = c; g.fill(); };
  const X = x + w, Y = y + d, Z = z + h, T = lit ? t3 : PAL.stone.map(c => hex(mix(c, '#F2E6D0', .45)));
  f([[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]], T[1]); f([[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]], T[2]); f([[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]], T[0]);
}
export const ICON = {
  sun(g, x, y, s, lit = 1) { g.save(); g.translate(x, y); const c = lit ? '#E4A93A' : '#D8CCB6'; g.strokeStyle = c; g.lineWidth = s * .09; g.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * s * .36, Math.sin(a) * s * .36); g.lineTo(Math.cos(a) * s * .5, Math.sin(a) * s * .5); g.stroke(); } g.beginPath(); g.arc(0, 0, s * .26, 0, TAU); g.fillStyle = c; g.fill(); if (lit) { g.beginPath(); g.arc(-s * .07, -s * .07, s * .12, 0, TAU); g.fillStyle = '#F4CB6A'; g.fill(); } g.restore(); },
  moon(g, x, y, s, lit = 1) { g.save(); g.translate(x, y); g.beginPath(); g.arc(0, 0, s * .3, 0, TAU); g.fillStyle = lit ? '#3C5A86' : '#D8CCB6'; g.fill(); g.beginPath(); g.arc(s * .12, -s * .08, s * .24, 0, TAU); g.fillStyle = lit ? '#F2E6D0' : '#F2E6D0'; g.fill(); g.restore(); },
  box(g, x, y, s, t3 = PAL.red, lit = 1) { g.save(); g.translate(x, y); const M = mini(g, s * .42); mbox(g, M, -1.1, -.45, -.45, 2.2, .9, .9, t3, lit); g.restore(); },
  sack(g, x, y, s, lit = 1) { g.save(); g.translate(x, y); const c = lit ? ['#E0C79A', '#C9A874', '#A5845A'] : ['#E6DCC8', '#DCD0BA', '#CFC2AA']; g.beginPath(); g.moveTo(-s * .32, s * .4); g.quadraticCurveTo(-s * .44, -s * .05, -s * .24, -s * .32); g.lineTo(s * .24, -s * .32); g.quadraticCurveTo(s * .44, -s * .05, s * .32, s * .4); g.closePath(); g.fillStyle = c[1]; g.fill(); g.beginPath(); g.moveTo(s * .02, s * .4); g.lineTo(s * .32, s * .4); g.quadraticCurveTo(s * .44, -s * .05, s * .24, -s * .32); g.lineTo(s * .06, -s * .32); g.closePath(); g.fillStyle = c[2]; g.fill(); g.beginPath(); g.ellipse(0, -s * .34, s * .24, s * .08, 0, 0, TAU); g.fillStyle = c[0]; g.fill(); g.restore(); },
  bean(g, x, y, s, c = '#6A3B22', lit = 1, rot = -.5) { g.save(); g.translate(x, y); g.rotate(rot); const t3 = tri(lit ? c : '#D8CCB6'); g.beginPath(); g.ellipse(0, 0, s * .42, s * .3, 0, 0, TAU); g.fillStyle = t3[1]; g.fill(); g.save(); g.clip(); g.beginPath(); g.ellipse(-s * .1, -s * .12, s * .36, s * .22, 0, 0, TAU); g.fillStyle = t3[0]; g.fill(); g.restore(); g.beginPath(); g.moveTo(-s * .34, s * .02); g.bezierCurveTo(-s * .1, -s * .1, s * .1, s * .1, s * .34, -s * .02); g.strokeStyle = t3[2]; g.lineWidth = s * .07; g.lineCap = 'round'; g.stroke(); g.restore(); },
  cherry(g, x, y, s, lit = 1) { g.save(); g.translate(x, y); const t3 = lit ? PAL.red : ['#E6DCC8', '#DCD0BA', '#CFC2AA']; g.beginPath(); g.arc(0, 0, s * .38, 0, TAU); g.fillStyle = t3[1]; g.fill(); g.save(); g.clip(); g.beginPath(); g.arc(s * .24, s * .1, s * .38, 0, TAU); g.fillStyle = t3[2]; g.fill(); g.beginPath(); g.arc(-s * .1, -s * .2, s * .3, 0, TAU); g.fillStyle = t3[0]; g.fill(); g.restore(); g.restore(); },
};
// grid of n icons, lit count m (fractional ok): cols, gap in px
export function iconGrid(g, x, y, n, m, cols, gap, draw, dir = 1) {
  for (let i = 0; i < n; i++) { const c = i % cols, r = (i / cols) | 0, px = x + dir * (c * gap + gap / 2) - (dir < 0 ? 0 : 0), py = y + r * gap + gap / 2; const on = i < m, pop = on ? back(clamp(m - i), 2.4) : 1; g.save(); g.translate(px, py); g.scale(pop, pop); draw(g, 0, 0, gap * .86, on ? 1 : 0, i); g.restore(); }
}

// ---------- minimal people (Monument-Valley-like billboards; unit = world units) ----------
// o: {body, hat, skin, pose, t, face:1|-1, h}
export function person(g, o = {}) {
  const h = o.h || 3, B = tri(o.body || PAL.red[1]), sk = o.skin || '#C98B62', f = o.face || 1, bob = o.bob || 0;
  g.save(); g.scale(f, 1); g.translate(0, -bob);
  // legs
  g.fillStyle = o.legs || '#4A3A36'; g.fillRect(-.16 * h, -.26 * h, .12 * h, .26 * h); g.fillRect(.04 * h, -.26 * h, .12 * h, .26 * h);
  // body (tapered) left mid / right dark
  g.beginPath(); g.moveTo(-.26 * h, -.22 * h); g.lineTo(-.16 * h, -.66 * h); g.lineTo(.16 * h, -.66 * h); g.lineTo(.26 * h, -.22 * h); g.closePath(); g.fillStyle = B[1]; g.fill();
  g.beginPath(); g.moveTo(.02 * h, -.22 * h); g.lineTo(.02 * h, -.66 * h); g.lineTo(.16 * h, -.66 * h); g.lineTo(.26 * h, -.22 * h); g.closePath(); g.fillStyle = B[2]; g.fill();
  if (o.apron) { g.beginPath(); g.moveTo(-.2 * h, -.24 * h); g.lineTo(-.12 * h, -.56 * h); g.lineTo(.12 * h, -.56 * h); g.lineTo(.2 * h, -.24 * h); g.closePath(); g.fillStyle = o.apron; g.fill(); }
  // arm
  const arm = o.arm ?? .2; g.strokeStyle = B[2]; g.lineCap = 'round'; g.lineWidth = .09 * h;
  const ax = .12 * h, ay = -.6 * h, al = .34 * h, ex = ax + Math.sin(arm) * al, ey = ay + Math.cos(arm) * al;
  g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey); g.stroke(); g.beginPath(); g.arc(ex, ey, .05 * h, 0, TAU); g.fillStyle = sk; g.fill();
  if (o.tool) o.tool(g, ex, ey, h);
  // head
  g.beginPath(); g.arc(0, -.78 * h, .12 * h, 0, TAU); g.fillStyle = sk; g.fill();
  g.beginPath(); g.arc(.05 * h, -.76 * h, .1 * h, -1.2, 1.9); g.fillStyle = hex(mix(sk, '#231A2C', .2)); g.fill();
  if (o.hat === 'straw') { g.beginPath(); g.ellipse(0, -.86 * h, .26 * h, .07 * h, 0, 0, TAU); g.fillStyle = '#E9D39A'; g.fill(); g.beginPath(); g.ellipse(0, -.92 * h, .12 * h, .08 * h, 0, Math.PI, TAU); g.fill(); g.fillStyle = '#C9AE6E'; g.fillRect(-.12 * h, -.9 * h, .24 * h, .025 * h); }
  else if (o.hat === 'cap') { g.beginPath(); g.arc(0, -.8 * h, .125 * h, Math.PI, TAU); g.fillStyle = o.hatColor || PAL.blue[1]; g.fill(); g.fillRect(0, -.81 * h, .2 * h, .03 * h); }
  else if (o.hair) { g.beginPath(); g.arc(0, -.8 * h, .125 * h, Math.PI * 1.02, TAU * .99); g.fillStyle = o.hair; g.fill(); }
  if (o.basket) { const t3 = tri('#C9A060'); g.beginPath(); g.moveTo(-.34 * h, -.44 * h); g.lineTo(-.3 * h, -.28 * h); g.lineTo(-.1 * h, -.28 * h); g.lineTo(-.06 * h, -.44 * h); g.closePath(); g.fillStyle = t3[1]; g.fill(); g.fillStyle = t3[0]; g.beginPath(); g.ellipse(-.2 * h, -.44 * h, .14 * h, .035 * h, 0, 0, TAU); g.fill(); if (o.basket > 1) { g.fillStyle = PAL.red[1]; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-.29 * h + i * .045 * h, -.455 * h, .022 * h, 0, TAU); g.fill(); } } }
  g.restore();
}

// ---------- any shape → isometric solid (the "draw anything in this style" hook) ----------
// pts: 2D outline in local units (x right, y down, like a sketch); lays it on plane 'xy' (ground) or stands it on 'xz'/'yz'.
// extrudes by depth and shades with the 3-tone rule. Example: a 4-point spark with a cursor tail in #D97757.
export function shape(iso, pts, at, o = {}) {
  const [x, y, z] = at, s = o.scale || 1, d = o.depth ?? .5, t3 = typeof o.color === 'string' ? tri(o.color) : (o.color || PAL.red), plane = o.plane || 'xz';
  const P3 = (p, off) => plane === 'xy' ? [x + p[1] * s, y - p[0] * s, z + off] : plane === 'xz' ? [x + p[0] * s, y + off, z - p[1] * s] : [x + off, y - p[0] * s, z - p[1] * s];
  const front = pts.map(p => P3(p, d)), backp = pts.map(p => P3(p, 0));
  let cx = 0, cy = 0, cz = 0; front.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; }); const n = front.length;
  iso.add(cx / n + cy / n + cz / n + (o.bias || 0), () => {
    const sides = [];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, f = [backp[i], backp[j], front[j], front[i]]; const m = [(f[0][0] + f[2][0]) / 2, (f[0][1] + f[2][1]) / 2, (f[0][2] + f[2][2]) / 2]; sides.push([m[0] + m[1] + m[2], f, [m[0] - cx / n, m[1] - cy / n, m[2] - cz / n]]); }
    sides.sort((a, b) => a[0] - b[0]); for (const [, f, out] of sides) iso.face3(f, t3, { out }); iso.face3(front, t3, { both: true, color: o.face });
  }, o.layer ?? 1);
}
export function sparkPath(n = 4, r = 1, inner = .28) { // n-point spark (concave star, curved-in sides approximated)
  const pts = []; for (let i = 0; i < n * 2 * 4; i++) { const a = i / (n * 8) * TAU - Math.PI / 2, k = (i % 8) / 8, tip = Math.pow(Math.abs(Math.cos(k * Math.PI)), 3); pts.push([Math.cos(a) * lerp(r * inner, r, tip), Math.sin(a) * lerp(r * inner, r, tip)]); }
  return pts;
}
export function cursorPath(h = 1.6, w = .32, x = 0, y = 0) { return [[x, y - h / 2], [x + w, y - h / 2], [x + w, y + h / 2], [x, y + h / 2]]; }   // the text-cursor "tail" that follows a spark
