// Silent-film "redrawn photoplay" drawing primitives (Canvas2D).
// Everything is drawn in grey values; film.js adds the silver tone, sepia, grain and damage.
// Look: warm-black ink contour (heavier on the side away from the light) + silver wash with a soft light gradient
//       + 45° hatching in the shadows + a faint wash mottle.
export const INK = '#15120f';
export const V = [0.10, 0.24, 0.43, 0.65, 0.90];            // the five wash values (dark → light)
export const grey = (v, a = 1) => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return a >= 1 ? `rgb(${c},${c},${c})` : `rgba(${c},${c},${c},${a})`; };

// global drawing state (per frame)
// mode 'tonal': draw values only (soft shading + thin separation lines); the Redraw pass (redraw.js) then inks,
//               hatches and posterises the whole frame — this is the house style.
// mode 'ink'  : draw finished ink + hatching directly (for use without the Redraw pass).
export const S = { t: 0, boil: 1, light: [-0.62, -0.78], lineScale: 1, hatchScale: 1, seedBase: 0, mode: 'tonal', sepLine: .5 };
export function setFrame(t, { boil = 1, light, lineScale = 1 } = {}) {
  S.t = t; S.boil = boil; S.lineScale = lineScale; if (light) S.light = light;
}
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const vn = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
export const H = hash, VN = vn;
const boilKey = () => Math.floor(S.t * 12);                  // line boil on twos

// ---------- geometry helpers ----------
export function catmull(pts, closed = true, n = 8) {          // Catmull-Rom through control points → dense polyline
  const out = [], L = pts.length, cnt = closed ? L : L - 1;
  for (let i = 0; i < cnt; i++) {
    const p0 = pts[closed ? (i - 1 + L) % L : Math.max(0, i - 1)], p1 = pts[i], p2 = pts[(i + 1) % L], p3 = pts[closed ? (i + 2) % L : Math.min(L - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        .5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  if (!closed) out.push(pts[L - 1].slice());
  return out;
}
export function bez(p0, p1, p2, p3, n = 12) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return o; }
export function ellipsePts(cx, cy, rx, ry, rot = 0, n = 36) { const o = [], c = Math.cos(rot), s = Math.sin(rot); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; o.push([cx + x * c - y * s, cy + x * s + y * c]); } return o; }
export function rectPts(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
export function xform(pts, m) { return pts.map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]); }
export function bbox(pts) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of pts) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; }
export function pathOf(g, pts, closed = true) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); if (closed) g.closePath(); }
function resample(pts, closed, step) {
  const P = closed ? pts.concat([pts[0]]) : pts, out = [];
  let acc = 0; out.push(P[0]);
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1], [x1, y1] = P[i], d = Math.hypot(x1 - x0, y1 - y0);
    let s = step - acc;
    while (s <= d) { const t = s / d; out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); s += step; }
    acc = d - (s - step);
  }
  if (!closed) { const l = P[P.length - 1]; const o = out[out.length - 1]; if (Math.hypot(l[0] - o[0], l[1] - o[1]) > step * .3) out.push(l); }
  else if (out.length > 2) { const o = out[out.length - 1]; if (Math.hypot(P[0][0] - o[0], P[0][1] - o[1]) < step * .3) out.pop(); }
  return out;
}

// ---------- ink line: variable width, tapered, heavier away from the light, boiling ----------
// opts: w (px), taper (0..1 of ends), closed, light (weight by normal·(-light)), seed, dry (0..1 breaks), boil (px)
export function ink(g, pts, o = {}) {
  if (!pts || pts.length < 2) return;
  const closed = !!o.closed, w = (o.w ?? 2.5) * S.lineScale, seed = o.seed ?? 1;
  const step = Math.max(1.2, Math.min(6, w * 1.1));
  let P = resample(pts, closed, step);
  const n = P.length; if (n < 2) return;
  const bk = boilKey(), bamp = (o.boil ?? 0.6) * S.boil;
  // boil: low-frequency wobble along the line, re-rolled on twos
  if (bamp > 0) P = P.map((p, i) => { const u = i * step / 40; return [p[0] + (vn(u + seed * 7.1 + bk * 13.7) - .5) * 2 * bamp, p[1] + (vn(u + seed * 3.3 + bk * 9.1 + 50) - .5) * 2 * bamp]; });
  const [lx, ly] = S.light, L = [], R = [];
  const lightK = o.light ?? 0.55, taper = o.taper ?? (closed ? 0 : 0.18);
  for (let i = 0; i < n; i++) {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nx = ty, ny = -tx;                                   // outward normal for clockwise(screen) paths
    let wk = 1;
    if (lightK) { const d = -(nx * lx + ny * ly); wk *= 1 - lightK * .5 + lightK * Math.max(0, d); }   // heavier on the shadow side
    if (!closed && taper > 0) { const u = i / (n - 1), e = Math.min(u, 1 - u) / taper; wk *= Math.min(1, .25 + .75 * Math.sqrt(Math.min(1, e))); }
    wk *= .82 + .36 * vn(i * step / 55 + seed * 5.7);             // pressure
    if (o.dry) { const d = vn(i * step / 18 + seed * 11.3); if (d < o.dry * .55) wk *= Math.max(0, (d / (o.dry * .55)) * 1.4 - .4); }
    const hw = w * wk * .5, p = P[i];
    L.push([p[0] + nx * hw, p[1] + ny * hw]); R.push([p[0] - nx * hw, p[1] - ny * hw]);
  }
  g.save(); g.fillStyle = o.color || INK; if (o.alpha != null) g.globalAlpha *= o.alpha;
  g.beginPath();
  if (closed) {
    g.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]); g.closePath();
    g.moveTo(R[n - 1][0], R[n - 1][1]); for (let i = n - 2; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath();
    g.fill('evenodd');
  } else {
    g.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); g.fill();
  }
  g.restore();
}

// ---------- silver wash: fill with a soft light gradient + mottle ----------
export function wash(g, pts, v, o = {}) {
  const [x0, y0, x1, y1] = bbox(pts), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.max(x1 - x0, y1 - y0) * .5 + 1;
  const [lx, ly] = o.lightDir || S.light, k = o.grad ?? 0.16;
  pathOf(g, pts, true);
  if (k > 0) {
    const gr = g.createLinearGradient(cx + lx * r, cy + ly * r, cx - lx * r, cy - ly * r);
    gr.addColorStop(0, grey(v + k * .55)); gr.addColorStop(.55, grey(v)); gr.addColorStop(1, grey(v - k * .6));
    g.fillStyle = gr;
  } else g.fillStyle = grey(v);
  g.fill();
}

// ---------- hatching: 45° parallel lines, fading from the shadow side ----------
// o: angle (rad), gap (px), w, strength(0..1), cross(0..1), side (true = only on shadow side)
export function hatch(g, pts, o = {}) {
  const strength = o.strength ?? 0.6; if (strength <= 0.02) return;
  const [x0, y0, x1, y1] = bbox(pts), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0) * .5 + 2;
  const ang = o.angle ?? -Math.PI / 4, gap = (o.gap ?? 6) * S.lineScale, w = (o.w ?? 1.1) * S.lineScale, seed = o.seed ?? 3;
  g.save(); pathOf(g, pts, true); g.clip();
  const [lx, ly] = S.light;
  let style = INK;
  if (o.side !== false) {
    const gr = g.createLinearGradient(cx + lx * r, cy + ly * r, cx - lx * r, cy - ly * r);
    const s0 = o.sideStart ?? .35;
    gr.addColorStop(0, 'rgba(21,18,15,0)'); gr.addColorStop(s0, 'rgba(21,18,15,0)'); gr.addColorStop(1, `rgba(21,18,15,${Math.min(1, strength * 1.2)})`);
    style = gr;
  } else g.globalAlpha *= strength;
  g.strokeStyle = style; g.lineWidth = w; g.lineCap = 'round';
  const pass = (a, off) => {
    const c = Math.cos(a), s = Math.sin(a);
    g.beginPath();
    for (let d = -r; d <= r; d += gap) {
      const j = (H(d * .37 + seed + off) - .5) * gap * .35, jj = (H(d * .71 + seed * 2 + off) - .5) * .06;
      const px = cx - s * (d + j), py = cy + c * (d + j);
      g.moveTo(px - c * r, py - s * r - jj * r); g.lineTo(px + c * r, py + s * r + jj * r);
    }
    g.stroke();
  };
  pass(ang, 0);
  if ((o.cross ?? 0) > 0.02) { g.globalAlpha *= o.cross; pass(ang + Math.PI / 2.3, 9); }
  g.restore();
}

// ---------- form = wash + hatching + contour (the basic "drawn object") ----------
// style: { v, grad, line (px, 0 = none), hatch (auto from v if undefined), cross, lineLight, dry, seed, color }
export function form(g, pts, st = {}) {
  const v = st.v ?? V[3];
  if (S.mode === 'tonal') {
    if (st.fill !== false) wash(g, pts, v, st);
    if (st.cyl != null) cylShade(g, pts, st.cyl, st.cylK ?? .13);
    if (st.texture) st.texture(g, pts);
    if (st.shade) shade(g, pts, typeof st.shade === 'number' ? { off: st.shade, hatch: 0, a: v > .7 ? .2 : .3, seed: st.seed, soft: st.shade * .25 } : { ...st.shade, hatch: 0 });
    if ((st.line ?? 2.6) > 0) {
      const o = { w: (st.line ?? 2.6) * S.sepLine, closed: !st.openEnd, taper: .04, light: .5, seed: st.seed ?? 1, color: st.lineColor || grey(Math.max(0, v - .45)), boil: st.boil };
      ink(g, pts, o);
    }
    return;
  }
  if (st.fill !== false) wash(g, pts, v, st);
  if (st.texture) st.texture(g, pts);
  if (st.shade) shade(g, pts, typeof st.shade === 'number' ? { off: st.shade, hatch: v < .5 ? .7 : .45, a: v > .7 ? .16 : .26, seed: st.seed } : st.shade);
  const hs = st.hatch ?? Math.max(0, Math.min(1, (0.62 - v) * 1.9));
  if (hs > 0.02) hatch(g, pts, { strength: hs, gap: st.gap ?? (v < .25 ? 4.5 : 6), cross: st.cross ?? (v < .2 ? .6 : 0), seed: st.seed, side: st.hatchSide ?? (v > .22), angle: st.hatchAngle, sideStart: st.sideStart });
  if ((st.line ?? 2.6) > 0) {
    if (st.openEnd) ink(g, pts, { w: st.line ?? 2.6, closed: false, taper: .04, light: st.lineLight ?? .6, seed: st.seed ?? 1, dry: st.dry, color: st.lineColor, boil: st.boil });
    else ink(g, pts, { w: st.line ?? 2.6, closed: true, light: st.lineLight ?? .6, seed: st.seed ?? 1, dry: st.dry, color: st.lineColor, boil: st.boil });
  }
}

// open strokes (folds, details)
export function stroke(g, pts, w = 1.6, o = {}) { ink(g, pts, { w, closed: false, taper: o.taper ?? .3, light: o.light ?? 0, seed: o.seed ?? 5, dry: o.dry, alpha: o.alpha, boil: o.boil, color: o.color }); }

// ---------- drawShape: draw ANY path in this style ----------
// shape: array of points (closed) or {pts, closed}. style: form() style plus { color: '#D97757' } to keep a hue
// (a coloured shape is drawn in colour; film.js keeps its hue if it is also painted into the colour mask — see film.js).
export function drawShape(g, shape, style = {}) {
  const pts = Array.isArray(shape) ? shape : shape.pts, closed = Array.isArray(shape) ? true : shape.closed !== false;
  if (!closed) { stroke(g, pts, style.line ?? 2.6, style); return; }
  if (style.color) {                                           // coloured element: hue fill, ink contour kept
    pathOf(g, pts); g.fillStyle = style.color; g.fill();
    if (style.hatch) hatch(g, pts, { strength: style.hatch, seed: style.seed });
    ink(g, pts, { w: style.line ?? 2.6, closed: true, light: .6, seed: style.seed ?? 1 });
    return;
  }
  form(g, pts, style);
}

// four-pointed star with a cursor tail (example shape for §10)
export function sparkPts(cx, cy, r, tail = 0) {
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .28 : r; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  const star = catmull(pts, true, 4);
  return { star, tail: tail > 0 ? [[cx - r * .3, cy + r * .9], [cx - r * .3 - tail * .2, cy + r * .9 + tail]] : null };
}

// ---------- wash mottle (painted-sheet feel), cached noise tile ----------
let mottleTile = null;
export function mottle(g, x, y, w, h, a = .08, seed = 0) {
  if (!mottleTile) {
    mottleTile = document.createElement('canvas'); mottleTile.width = mottleTile.height = 512;
    const c = mottleTile.getContext('2d'), im = c.createImageData(512, 512);
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const n = .5 * vn2(i / 64, j / 64, 8) + .3 * vn2(i / 16, j / 16 + 3, 32) + .2 * vn2(i / 8, j / 8 + 5, 64);
      const k = (i + j * 512) * 4, c8 = Math.round(n * 255); im.data[k] = im.data[k + 1] = im.data[k + 2] = c8; im.data[k + 3] = 255;
    }
    c.putImageData(im, 0, 0);
  }
  g.save(); g.globalAlpha *= a; g.globalCompositeOperation = 'overlay';
  const p = g.createPattern(mottleTile, 'repeat'); p.setTransform(new DOMMatrix().translate(seed * 97 % 512, seed * 61 % 512));
  g.fillStyle = p; g.fillRect(x, y, w, h); g.restore();
}
function vn2(x, y, P) { // periodic value noise, period P lattice cells (tileable)
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash(((a % P) + P) % P * 57 + ((b % P) + P) % P * 131 + P);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}

// ---------- form shadow: the crescent on the side away from the light (outline minus itself shifted toward the light)
// o: off (px shift), v (shadow wash value), a (wash alpha), hatch (0..1), gap, soft (px blur of the terminator)
export function shade(g, pts, o = {}) {
  const off = o.off ?? 8; if (off <= .3) return;
  const [lx, ly] = o.lightDir || S.light, dx = lx * off, dy = ly * off;
  const [x0, y0, x1, y1] = bbox(pts);
  g.save(); pathOf(g, pts, true); g.clip();
  const crescent = () => {
    g.beginPath(); g.rect(x0 - off * 3, y0 - off * 3, x1 - x0 + off * 6, y1 - y0 + off * 6);
    g.moveTo(pts[0][0] + dx, pts[0][1] + dy); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + dx, pts[i][1] + dy); g.closePath();
  };
  if (o.soft) g.filter = `blur(${o.soft}px)`;
  crescent(); g.fillStyle = `rgba(22,18,14,${o.a ?? .22})`; g.fill('evenodd');
  g.filter = 'none';
  if ((o.hatch ?? .5) > .02) {
    crescent(); g.clip('evenodd');
    const gap = (o.gap ?? 5) * S.lineScale, ang = o.angle ?? -Math.PI / 4, c = Math.cos(ang), s = Math.sin(ang), r = Math.hypot(x1 - x0, y1 - y0) / 2 + off * 3, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    g.strokeStyle = `rgba(21,18,15,${Math.min(1, o.hatch ?? .5)})`; g.lineWidth = (o.hw ?? .9) * S.lineScale; g.beginPath();
    for (let d = -r; d <= r; d += gap) { const j = (H(d * .31 + (o.seed ?? 1)) - .5) * gap * .3, px = cx - s * (d + j), py = cy + c * (d + j); g.moveTo(px - c * r, py - s * r); g.lineTo(px + c * r, py + s * r); }
    g.stroke();
  }
  g.restore();
}

// cylindrical form shading: darker at both edges across the axis (angle, rad), lighter core shifted toward the light
export function cylShade(g, pts, axis, k = .13) {
  const [x0, y0, x1, y1] = bbox(pts), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const nx = -Math.sin(axis), ny = Math.cos(axis);                 // across the form
  const ext = Math.abs(nx) * (x1 - x0) / 2 + Math.abs(ny) * (y1 - y0) / 2 + 1;
  const [lx, ly] = S.light, sh = (nx * lx + ny * ly) > 0 ? -1 : 1;  // which edge faces the light
  const gr = g.createLinearGradient(cx - nx * ext, cy - ny * ext, cx + nx * ext, cy + ny * ext);
  const a = `rgba(20,16,12,${k})`, a2 = `rgba(20,16,12,${k * 1.6})`, z = 'rgba(20,16,12,0)';
  if (sh > 0) { gr.addColorStop(0, a); gr.addColorStop(.3, z); gr.addColorStop(.62, z); gr.addColorStop(1, a2); }
  else { gr.addColorStop(0, a2); gr.addColorStop(.38, z); gr.addColorStop(.7, z); gr.addColorStop(1, a); }
  g.save(); pathOf(g, pts); g.clip(); g.fillStyle = gr; g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4); g.restore();
}
