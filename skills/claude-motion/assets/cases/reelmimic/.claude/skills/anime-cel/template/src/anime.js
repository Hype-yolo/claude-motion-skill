// anime.js — the anime-cel drawing library (Canvas 2D, draws into the kit's G).
// Look: modern TV anime. Tapered line art on characters, flat cel colour + one hard shadow tone + a highlight,
// painted backgrounds with no line art (gradient skies, cumulus with bright rims), and anime effects.
//
// Sections: light · curves & tapered strokes · cel fills & line groups · palettes (time of day) · layer cache ·
// sky & clouds · sets (street, classroom, rooftop) · props · effects · transitions · captions · grade.

// ======================================================================================= light
// LIGHT points TOWARD the key light, in screen space (default: upper left). Shadows fall on the far side of every
// shape; outlines get thicker on the shadow side. Characters convert it into their local frame (_L).
let LIGHT = [-.55, -.83], _L = LIGHT;
function setLight(x, y) { const l = Math.hypot(x, y) || 1; LIGHT = _L = [x / l, y / l]; }

// ======================================================================================= curves
// Catmull-Rom through control points. A point may carry extra numbers (e.g. [x, y, w]): they are interpolated
// linearly. Mark a point sharp with the flag S=true in the 4th slot: [x, y, w, true] (tangents stop at it: a corner).
function crPts(P, closed = false, n = 7) {
  const N = P.length; if (N < 3) return P.map(p => p.slice());
  const get = i => closed ? P[(i % N + N) % N] : P[clamp(i, 0, N - 1)];
  const out = [], segs = closed ? N : N - 1, dims = P[0].length > 2 && typeof P[0][2] === 'number' ? 3 : 2;
  for (let i = 0; i < segs; i++) {
    const p1 = get(i), p2 = get(i + 1);
    const p0 = p1[3] ? p1 : get(i - 1), p3 = p2[3] ? p2 : get(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t, q = [];
      for (let d = 0; d < 2; d++) q.push(.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3));
      if (dims === 3) q.push(lerp(p1[2], p2[2], t));
      out.push(q);
    }
  }
  if (!closed) out.push(P[N - 1].slice(0, dims));
  return out;
}
function polyPath(P, closed = true, into) {
  const p = into || new Path2D(); if (!P.length) return p;
  p.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) p.lineTo(P[i][0], P[i][1]);
  if (closed) p.closePath(); return p;
}
const sArea = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const ccw = P => sArea(P) < 0 ? P.slice().reverse() : P;       // one winding for every shape, so unions fill cleanly
const smooth = (P, closed = true, n = 7) => polyPath(ccw(crPts(P, closed, n)), closed);
const shifted = (path, dx, dy) => { const p = new Path2D(); p.addPath(path, new DOMMatrix([1, 0, 0, 1, dx, dy])); return p; };
const xform = (P, m) => P.map(([x, y, ...r]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5], ...r]);
const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
function ellPts(cx, cy, rx, ry, n = 24, a0 = 0) { const o = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; }
function cumLen(P) { const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return L; }

// A ribbon along a dense centreline C with full width wf(s, i) (s = 0..1 by arc length) → closed outline points.
// caps: round the ends where the width is > 0.
function ribbonPts(C, wf, caps = true) {
  const N = C.length; if (N < 2) return [];
  const L = cumLen(C), tot = L[N - 1] || 1, left = [], right = [], nrm = [];
  for (let i = 0; i < N; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(N - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const w = Math.max(0, wf(L[i] / tot, i)) / 2; nrm.push([tx, ty, w]);
    left.push([C[i][0] - ty * w, C[i][1] + tx * w]); right.push([C[i][0] + ty * w, C[i][1] - tx * w]);
  }
  const out = left.slice(), cap = (c, t, w, from) => {           // semicircle from side `from` (+1 left) round the tip
    for (let k = 1; k < 6; k++) { const a = k / 6 * Math.PI, nx = -t[1] * from, ny = t[0] * from, fx = t[0] * from, fy = t[1] * from;
      out.push([c[0] + (nx * Math.cos(a) + fx * Math.sin(a)) * w, c[1] + (ny * Math.cos(a) + fy * Math.sin(a)) * w]); }
  };
  if (caps && nrm[N - 1][2] > 0) cap(C[N - 1], nrm[N - 1], nrm[N - 1][2], 1);
  for (let i = N - 1; i >= 0; i--) out.push(right[i]);
  if (caps && nrm[0][2] > 0) cap(C[0], nrm[0], nrm[0][2], -1);
  return out;
}
// width profiles for tapered lines (s = 0..1 along the line)
const TAPER = {
  both: s => Math.pow(Math.max(0, Math.sin(Math.PI * s)), .55),          // pointed at both ends
  soft: s => .35 + .65 * Math.pow(Math.max(0, Math.sin(Math.PI * s)), .7), // thinner ends, never zero
  head: s => Math.pow(1 - s, .7),                                          // thick start → point
  tail: s => Math.pow(s, .7),                                              // point → thick end
  flat: s => 1,
  lash: s => s < .82 ? .45 + .55 * Math.pow(s / .82, 1.4) : Math.pow((1 - s) / .18, .8), // eyeliner: thickens to the outer corner, flicks to a point
};
// tube: control points [x, y, w] (w = full width) → smooth closed outline points (round caps)
function tubePts(P, n = 6, caps = true) { const C = crPts(P, false, n); return ribbonPts(C, (s, i) => C[i][2], caps); }
// ink(P, w, col, prof): a tapered line through control points (px or local units), filled as one polygon
function ink(P, w, col, prof = TAPER.both, o = {}) {
  if (P.length < 2) return;
  let C = o.raw ? P : crPts(P, !!o.closed, o.n || 7);
  if (C.length < 8) { const D = []; for (let i = 0; i < C.length - 1; i++) for (let k = 0; k < 6; k++) D.push([lerp(C[i][0], C[i + 1][0], k / 6), lerp(C[i][1], C[i + 1][1], k / 6)]); D.push(C[C.length - 1]); C = D; }
  if (o.closed) C.push(C[0]);
  const pts = ribbonPts(C, s => w * prof(s), !!o.caps);
  G.fillStyle = col; G.fill(polyPath(pts));
}
// a hard little line cluster (blush hatching, shading strokes)
function hatch(x, y, n, len, ang, gap, w, col) {
  for (let i = 0; i < n; i++) {
    const cx = x + (i - (n - 1) / 2) * gap, dx = Math.sin(ang) * len / 2, dy = Math.cos(ang) * len / 2;
    ink([[cx + dx, y - dy], [cx - dx, y + dy]], w, col, TAPER.both, { raw: true });
  }
}

// ======================================================================================= cel fill & line groups
// cel(path, base, shade, hi, d, r): flat base; a hard-edged shadow where the shape, pushed d toward the light,
// no longer covers it (the far side); a rim highlight r wide on the lit side. Works for any path (unions too).
function cel(path, b, s, h, d = .08, r = 0) {
  G.fillStyle = b; G.fill(path);
  if (!(s && d) && !(h && r)) return;
  G.save(); G.clip(path);
  if (s && d) { G.fillStyle = s; G.fill(path); G.clip(shifted(path, _L[0] * d, _L[1] * d)); }
  if (h && r) { G.fillStyle = h; G.fill(path); G.clip(shifted(path, -_L[0] * r, -_L[1] * r)); }
  G.fillStyle = b; G.fill(path); G.restore();
}
// drawGroup(parts, line, lw): parts that form ONE silhouette. Every part's outline is stroked first (2×lw, and
// once more nudged toward the shadow side, so lines are heavier away from the light), then every part is filled on
// top: joins between parts vanish and only the outer silhouette keeps its line. Part:
//   { path, b, s, h, d, r, lw, join, noLine, clip (fn: extra detail drawn clipped to this part), after (fn) }
function drawGroup(parts, line, lw, o = {}) {
  G.save(); G.strokeStyle = line; G.lineCap = 'round'; G.miterLimit = 8;
  const k = o.thick ?? .6;
  for (const p of parts) {
    if (!p || p.noLine) continue;
    G.lineJoin = p.join || 'round'; const w = p.lw ?? lw; G.lineWidth = 2 * w; G.stroke(p.path);
    if (k) { G.save(); G.translate(-_L[0] * w * k, -_L[1] * w * k); G.stroke(p.path); G.restore(); }
  }
  G.restore();
  for (const p of parts) if (p) {
    cel(p.path, p.b, p.s, p.h, p.d ?? .08, p.r ?? 0);
    if (p.clip) { G.save(); G.clip(p.path); p.clip(); G.restore(); }
  }
  for (const p of parts) if (p && p.after) p.after();
}
const union = paths => { const u = new Path2D(); for (const p of paths) u.addPath(p); return u; };

// ======================================================================================= palettes (time of day)
// TOD[name] = sky gradient, cloud tones, sun, ambient tint for characters (tintK), light direction.
const TOD = {
  day: { sky: ['#3f86d8', '#7fb6ec', '#cfe6f6'], haze: '#e9f3f8', cloud: ['#ffffff', '#bdc9e8', '#fffdf6'], sun: '#fff6d8', tint: '#ffffff', tintK: 0, light: [-.55, -.83], bgTint: '#ffffff', grade: '#fff7e8' },
  morning: { sky: ['#5f9fe0', '#a9d0f0', '#f6e6d4'], haze: '#f8efe4', cloud: ['#fffaf2', '#c8c3e0', '#fff6e0'], sun: '#fff0cc', tint: '#fff2dd', tintK: .08, light: [-.8, -.6], bgTint: '#fff4e4', grade: '#fff2dc' },
  evening: { sky: ['#4b4f9a', '#d9829a', '#ffc98e'], haze: '#ffd7a8', cloud: ['#ffd9b8', '#9a6f9e', '#fff0c8'], sun: '#ffe2a8', tint: '#ff9a6a', tintK: .22, light: [.85, -.35], bgTint: '#ffb38a', grade: '#ffcf9e' },
  night: { sky: ['#0f1638', '#263a72', '#4f5f9a'], haze: '#5a6aa6', cloud: ['#56608f', '#2a3160', '#8e9ad0'], sun: '#dfe8ff', tint: '#5d6fb8', tintK: .38, light: [.3, -.9], bgTint: '#5a68a8', grade: '#9fb0ff' },
};
let TODN = 'day', _tone = {};
function setTOD(name) { if (TODN !== name) { TODN = name; _tone = {}; } setLight(...TOD[name].light); }
// tone(hex): a character/prop colour under the current time-of-day light
function tone(c) { if (!c || c[0] !== '#') return c; const k = TOD[TODN].tintK; if (!k) return c; return _tone[c] || (_tone[c] = mixCol(c, TOD[TODN].tint, k)); }

// ======================================================================================= layer cache
// Static paintings (sets, clouds, trees) are painted once into an offscreen canvas and reused: fast and still pure.
const LAYERS = {};
function layer(key, w, h, fn, scale = 1) {
  if (LAYERS[key]) return LAYERS[key];
  const c = makeCanvas(Math.ceil(w * scale), Math.ceil(h * scale)), g = c.getContext('2d'), keep = G, keepL = _L;
  G = g; G.scale(scale, scale); fn(g); G = keep; _L = keepL;
  c.lw = w; c.lh = h; return (LAYERS[key] = c);
}
const blit = (c, x, y, w = c.lw, h = c.lh) => G.drawImage(c, x, y, w, h);

// ======================================================================================= sky & clouds
function skyGrad(x, y, w, h, pal = TOD[TODN]) {
  const g = G.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, pal.sky[0]); g.addColorStop(.55, pal.sky[1]); g.addColorStop(1, pal.sky[2]);
  G.fillStyle = g; G.fillRect(x, y, w, h);
}
// a cumulus cloud as a cached painting: flat-ish base, bumpy top, hard cel shadow under every puff, bright rim
function cloudCanvas(seed, w, h, tod = TODN) {
  return layer(`cloud:${seed}:${w}:${h}:${tod}`, w + 80, h + 60, g => {
    const pal = TOD[tod], r = rnd('cloud' + seed), path = new Path2D(), puffs = [];
    const cx = (w + 80) / 2, base = h + 30, n = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const k = (i + .5) / n, peak = h * (.42 + .58 * Math.pow(Math.sin(Math.PI * k), .8)) * (.8 + .3 * r());
      const rad = Math.min(w / n * (.62 + .3 * r()), peak * .55);
      puffs.push([cx + (k - .5) * w * .82, base - peak + rad, rad]);
    }
    for (let i = 0; i < n - 1; i++) { const a = puffs[i], b = puffs[i + 1]; if (r() < .8) puffs.push([(a[0] + b[0]) / 2 + (r() - .5) * 20, Math.min(a[1], b[1]) - Math.min(a[2], b[2]) * .35, Math.min(a[2], b[2]) * (.55 + .2 * r())]); }
    for (const [x, y, rr] of puffs) { path.moveTo(x + rr, y); path.arc(x, y, rr, 0, TAU); }
    const hull = puffs.slice(0, n).map(([x, y]) => [x, y]); hull.push([cx + w * .44, base - h * .1], [cx - w * .44, base - h * .1]);   // fill the gaps between puffs
    polyPath(sArea(hull) > 0 ? hull : hull.slice().reverse(), true, path);   // same winding as the arcs
    path.moveTo(cx + w * .46, base - h * .16); path.ellipse(cx, base - h * .16, w * .46, h * .16, 0, 0, TAU);
    const L = [pal.light[0] * .6, -.8]; const l = Math.hypot(...L); _L = [L[0] / l, L[1] / l];
    const gr = G.createLinearGradient(0, base - h, 0, base); gr.addColorStop(0, pal.cloud[2]); gr.addColorStop(1, pal.cloud[0]);
    G.fillStyle = gr; G.fill(path);
    G.save(); G.clip(path);
    const sh = G.createLinearGradient(0, base - h, 0, base); sh.addColorStop(0, mixCol(pal.cloud[1], pal.cloud[0], .35)); sh.addColorStop(1, pal.cloud[1]);
    G.fillStyle = sh; G.fill(path);
    G.clip(shifted(path, _L[0] * h * .16, _L[1] * h * .16));
    G.fillStyle = pal.cloud[2]; G.fill(path);
    G.clip(shifted(path, -_L[0] * h * .035, -_L[1] * h * .035));
    G.fillStyle = gr; G.fill(path);
    G.restore();
    G.save(); G.clip(path); G.globalAlpha = .35; G.fillStyle = pal.cloud[1]; G.fillRect(0, base - h * .12, w + 80, h);   // flat grey underside
    G.restore();
  });
}
function cloud(x, y, w, h, seed, alpha = 1) { const c = cloudCanvas(seed, w, h); G.save(); G.globalAlpha = alpha; blit(c, x - c.lw / 2, y - c.lh + 30); G.restore(); }

// ======================================================================================= sets
// A set is painted in its own world (SET_W × SET_H px) as parallax layers and leaves the camera OPEN at the end,
// so the scene draws characters in the same world coords and calls camEnd() (drawWorld does it if you forget).
//   setView(cam) → { cx, cy, zoom } ; cam = { x, y, zoom, rot } in set coords.
// Layers use depth k: 0 = infinitely far (sky), 1 = the character plane.
function parallax(cam, k, ref = [960, 540]) {
  camBegin(ref[0] + (cam.x - ref[0]) * k, ref[1] + (cam.y - ref[1]) * k, 1 + ((cam.zoom || 1) - 1) * k, (cam.rot || 0));
}
function skyLayer(cam, t, o = {}) {
  const pal = TOD[TODN];
  parallax(cam, .08); skyGrad(-1200, -1200, 4400, 3200, pal);
  if (TODN === 'night') {       // stars + moon
    const q = rnd('stars'); G.fillStyle = '#fff8e0';
    for (let i = 0; i < 160; i++) { const x = -1200 + q() * 4400, y = -1200 + q() * 2000, r = .8 + q() * 2.2, tw = .5 + .5 * Math.sin((t || 0) * (1 + q() * 3) + i); G.globalAlpha = .4 + .6 * tw; G.beginPath(); G.arc(x, y, r, 0, TAU); G.fill(); }
    G.globalAlpha = 1; const [mx, my] = o.moon || [1500, 180], g = G.createRadialGradient(mx, my, 0, mx, my, 220); g.addColorStop(0, 'rgba(255,248,220,.5)'); g.addColorStop(1, 'rgba(255,248,220,0)'); G.fillStyle = g; G.fillRect(mx - 220, my - 220, 440, 440);
    G.fillStyle = '#fff6da'; G.beginPath(); G.arc(mx, my, 56, 0, TAU); G.fill(); G.fillStyle = '#efe4c2'; G.beginPath(); G.arc(mx - 14, my + 10, 12, 0, TAU); G.arc(mx + 18, my - 16, 8, 0, TAU); G.fill();
  }
  if (o.sun) { const [sx, sy] = o.sun, g = G.createRadialGradient(sx, sy, 0, sx, sy, 520); g.addColorStop(0, pal.sun); g.addColorStop(.25, mixCol(pal.sun, pal.sky[2], .5) + 'aa'); g.addColorStop(1, pal.sky[2] + '00'); G.fillStyle = g; G.fillRect(sx - 600, sy - 600, 1200, 1200); }
  camEnd();
  parallax(cam, .18);
  const drift = (t || 0) * (o.wind ?? 6);
  for (const [x, y, w, h, s] of (o.clouds || [[300, 360, 520, 230, 1], [1250, 250, 700, 300, 2], [1850, 420, 420, 170, 3], [-300, 300, 420, 180, 4]]))
    cloud(x + drift, y, w, h, s);
  camEnd();
}
// helpers for painted (line-free) set pieces: flat colour + a soft vertical gradient
function paintPoly(P, top, bottom = top) {
  const ys = P.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (top !== bottom) { const g = G.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bottom); G.fillStyle = g; } else G.fillStyle = top;
  G.fill(polyPath(P));
}
function blossomClump(x, y, r, seed, pal) {   // sakura foliage: puffs with a hard shade under and a light top
  const q = rnd('bl' + seed), p = new Path2D();
  for (let i = 0; i < 9; i++) { const a = q() * TAU, d = Math.sqrt(q()) * r * .7, rr = r * (.35 + .3 * q()); const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * .7; p.moveTo(cx + rr, cy); p.arc(cx, cy, rr, 0, TAU); }
  const keep = _L; _L = [-.5, -.86]; cel(p, pal[0], pal[1], pal[2], r * .22, r * .09); _L = keep;
  G.fillStyle = pal[3]; for (let i = 0; i < 7; i++) { const a = q() * TAU, d = q() * r * .8; G.beginPath(); G.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * .7, r * .05, r * .035, a, 0, TAU); G.fill(); }
}
function sakuraTree(x, y, s, seed) {   // (x, y) = trunk base, s = scale (~1 = 600 px tall)
  const q = rnd('tree' + seed), bark = mixCol('#5a3a3e', TOD[TODN].bgTint, .15), pal = ['#f7c3cf', '#e592a8', '#fff0f2', '#fbe2e8'].map(c => mixCol(c, TOD[TODN].bgTint, TOD[TODN].tintK));
  const br = (x0, y0, a, len, w, d) => {
    const x1 = x0 + Math.sin(a) * len, y1 = y0 - Math.cos(a) * len;
    ink([[x0, y0], [(x0 + x1) / 2 + (q() - .5) * len * .2, (y0 + y1) / 2], [x1, y1]], w, bark, s2 => 1 - s2 * .45, { caps: true });
    if (d > 0) { br(x1, y1, a - .35 - q() * .3, len * .72, w * .62, d - 1); br(x1, y1, a + .35 + q() * .3, len * .7, w * .6, d - 1); }
    else blossomClump(x1, y1, 95 * s, seed + ':' + x1.toFixed(0), pal);
  };
  br(x, y, (q() - .5) * .2, 190 * s, 34 * s, 3);
}
function pole(x, yb, h, col) {     // utility pole with crossbar
  paintPoly([[x - 9, yb], [x - 6, yb - h], [x + 6, yb - h], [x + 9, yb]], col, mixCol(col, '#000000', .25));
  G.fillStyle = col; G.fillRect(x - 60, yb - h + 40, 120, 9); G.fillRect(x - 45, yb - h + 80, 90, 7);
}
function wire(x0, y0, x1, y1, sag, col, w = 2.2) { G.strokeStyle = col; G.lineWidth = w; G.beginPath(); G.moveTo(x0, y0); G.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1); G.stroke(); }
function windowGrid(x, y, cols, rows, w, h, gx, gy, glass, frame) {
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const X = x + i * (w + gx), Y = y + j * (h + gy); G.fillStyle = frame; G.fillRect(X - 3, Y - 3, w + 6, h + 6);
    const g = G.createLinearGradient(X, Y, X + w, Y + h); g.addColorStop(0, glass[0]); g.addColorStop(1, glass[1]); G.fillStyle = g; G.fillRect(X, Y, w, h);
    G.fillStyle = 'rgba(255,255,255,.35)'; G.beginPath(); G.moveTo(X + w * .15, Y + h); G.lineTo(X + w * .45, Y); G.lineTo(X + w * .6, Y); G.lineTo(X + w * .3, Y + h); G.fill();
  }
}
const SET = {};
// ---- street: a school-route street in one-point perspective, sakura on the left, houses right, school at the end.
// World 1920×1080 around (960, 540); ground line of the character plane ≈ y 900. Horizon y 560.
SET.street = (cam, t, o = {}) => {
  skyLayer(cam, t, { clouds: [[260, 330, 560, 240, 11], [1200, 230, 760, 320, 12], [1800, 400, 440, 170, 13], [-420, 380, 480, 200, 14], [2400, 300, 520, 220, 15]], sun: o.sun, wind: o.wind });
  const tn = TODN, tintK = TOD[tn].tintK, bt = c => mixCol(c, TOD[tn].bgTint, tintK * 1.2);
  parallax(cam, .45);
  blit(layer('street-far:' + tn, 3000, 1400, () => {
    G.translate(1040, 0);
    const hz = 560;
    paintPoly([[-1100, hz + 10], [-700, hz - 90], [-300, hz - 40], [100, hz - 120], [600, hz - 60], [1100, hz - 110], [2000, hz - 30], [2000, hz + 20], [-1100, hz + 20]], bt('#9fb7d6'), bt('#c3d3e6'));
    // the school at the end of the road
    paintPoly([[640, hz - 190], [1290, hz - 190], [1290, hz + 20], [640, hz + 20]], bt('#f3eee4'), bt('#d9d2c6'));
    paintPoly([[900, hz - 260], [1030, hz - 260], [1030, hz - 190], [900, hz - 190]], bt('#efe9de'), bt('#dcd4c8'));
    G.fillStyle = bt('#ffffff'); G.beginPath(); G.arc(965, hz - 225, 22, 0, TAU); G.fill(); G.strokeStyle = bt('#6b6f86'); G.lineWidth = 3; G.stroke();
    G.beginPath(); G.moveTo(965, hz - 225); G.lineTo(965, hz - 240); G.moveTo(965, hz - 225); G.lineTo(976, hz - 222); G.stroke();
    windowGrid(660, hz - 176, 12, 3, 36, 30, 14, 26, [bt('#8fb4d8'), bt('#d8e8f4')], bt('#e6e0d4'));
    G.fillStyle = bt('#c6bfb2'); G.fillRect(640, hz - 196, 650, 8);
    for (let i = 0; i < 9; i++) blossomClump(560 + i * 90 + ((i * 37) % 30), hz - 10 + ((i * 53) % 20), 42, 'far' + i, ['#f2c6d2', '#dca0b8', '#fbe4ea', '#fff'].map(bt));
  }), -1040, 0);
  camEnd();
  parallax(cam, 1);
  blit(layer('street-mid:' + tn, 3200, 1500, () => {
    G.translate(1200, 200);
    const hz = 560, vp = [960, hz];
    // road + sidewalks in perspective
    paintPoly([[vp[0] - 30, hz], [vp[0] + 30, hz], [2600, 1400], [-700, 1400]], bt('#8a8fa3'), bt('#6d7288'));
    paintPoly([[vp[0] - 30, hz], [vp[0] - 55, hz], [-900, 1400], [-700, 1400]], bt('#c9c3bc'), bt('#b3aca6'));
    paintPoly([[vp[0] + 30, hz], [vp[0] + 55, hz], [2900, 1400], [2600, 1400]], bt('#c9c3bc'), bt('#b3aca6'));
    for (let i = 0; i < 9; i++) { const k0 = Math.pow(i / 9, 2.2), k1 = Math.pow((i + .45) / 9, 2.2); const y0 = lerp(hz, 1400, k0), y1 = lerp(hz, 1400, k1); const w0 = lerp(1.5, 26, k0), w1 = lerp(1.5, 26, k1);
      G.fillStyle = bt('#f4f1ea'); G.beginPath(); G.moveTo(vp[0] - w0 / 2, y0); G.lineTo(vp[0] + w0 / 2, y0); G.lineTo(vp[0] + w1 / 2, y1); G.lineTo(vp[0] - w1 / 2, y1); G.fill(); }
    // left: long wall with sakura behind it
    for (let i = 0; i < 6; i++) sakuraTree(lerp(-500, 820, Math.pow(i / 6, .8)), lerp(760, 575, Math.pow(i / 6, .6)), lerp(1.25, .28, Math.pow(i / 6, .6)), 'L' + i);
    paintPoly([[-900, 700], [vp[0] - 60, hz - 12], [vp[0] - 60, hz + 4], [-900, 1010]], bt('#e8e0d6'), bt('#cfc5bb'));
    paintPoly([[-900, 690], [vp[0] - 60, hz - 14], [vp[0] - 60, hz - 10], [-900, 715]], bt('#b9aea6'));
    // right: houses with roofs, receding
    for (let i = 0; i < 5; i++) {
      const k = Math.pow(i / 5, .75), x = lerp(2500, 1080, k), s = lerp(1.5, .22, k), y = lerp(1000, hz + 8, Math.pow(k, .8));
      const hw = 330 * s, hh = 300 * s, roof = [bt('#50638f'), bt('#8d5a57'), bt('#5d7a6c'), bt('#7a6a9a'), bt('#9a6a50')][i];
      paintPoly([[x - hw, y], [x - hw, y - hh], [x + hw, y - hh], [x + hw, y]], bt('#f2ece2'), bt('#dcd3c6'));
      paintPoly([[x - hw * 1.12, y - hh], [x - hw * .6, y - hh * 1.55], [x + hw * .6, y - hh * 1.55], [x + hw * 1.12, y - hh]], roof, mixCol(roof, '#000000', .2));
      windowGrid(x - hw * .7, y - hh * .78, 2, 1, hw * .45, hh * .38, hw * .35, 0, [bt('#7fa6cf'), bt('#dbe9f5')], bt('#ebe4d8'));
      paintPoly([[x - hw * 1.05, y + 4], [x - hw * 1.05, y - hh * .38], [x + hw * 1.05, y - hh * .38], [x + hw * 1.05, y + 4]], bt('#d8cfc2'), bt('#c2b8aa'));
    }
    // utility poles + wires (the anime street staple)
    const P = [[1180, 590, 150], [1460, 700, 330], [2000, 900, 700]], Q = [[640, 585, 130], [300, 660, 300], [-420, 860, 690]];
    for (const [x, y, h] of [...P, ...Q]) pole(x, y, h, bt('#6e6a78'));
    const wc = bt('#3d3a4c');
    for (const S of [P, Q]) for (let i = 0; i < S.length - 1; i++) for (const dy of [44, 84]) { const a = S[i], b = S[i + 1]; wire(a[0], a[1] - a[2] + dy * a[2] / 700, b[0], b[1] - b[2] + dy * b[2] / 700, 40 + b[2] * .08, wc, 1 + b[2] / 400); }
  }), -1200, -200);
};
// ---- classroom: one-point perspective, windows on the left with sky, desks, warm light patches on the floor.
SET.classroom = (cam, t, o = {}) => {
  skyLayer(cam, t, { clouds: [[-100, 300, 460, 200, 21], [520, 240, 600, 250, 22], [-500, 420, 380, 150, 23]], wind: 3 });
  const tn = TODN, bt = c => mixCol(c, TOD[tn].bgTint, TOD[tn].tintK * 1.2);
  parallax(cam, 1);
  blit(layer('classroom:' + tn, 3000, 1600, () => {
    G.translate(1000, 250);
    const vp = [1000, 470], wallTop = -250, fl = 780;
    const toVP = (x, y, k) => [lerp(x, vp[0], k), lerp(y, vp[1], k)];
    // back wall
    const bw = [toVP(-1000, wallTop, .62), toVP(3000, wallTop, .62), toVP(3000, 1350, .62), toVP(-1000, 1350, .62)];
    paintPoly(bw, bt('#ece3d2'), bt('#dccfbb'));
    // blackboard on the back wall
    const bb = [toVP(-200, 200, .62), toVP(2200, 200, .62), toVP(2200, 700, .62), toVP(-200, 700, .62)];
    paintPoly(bb.map(([x, y]) => [x - 8, y - 8 * (y < 600 ? 1 : -1)]), bt('#9a7a58')); paintPoly(bb, bt('#3f6456'), bt('#2f4d43'));
    G.strokeStyle = 'rgba(255,255,255,.25)'; G.lineWidth = 3; G.beginPath(); G.moveTo(bb[0][0] + 60, bb[0][1] + 60); G.bezierCurveTo(bb[0][0] + 160, bb[0][1] + 20, bb[0][0] + 200, bb[0][1] + 110, bb[0][0] + 300, bb[0][1] + 70); G.stroke();
    // left wall with windows (sky shows through: cut the glass out of the wall)
    const lw = [[-1000, wallTop - 900], bw[0], bw[3], [-1000, 2400]];
    G.save(); const wallPath = polyPath(lw), holes = new Path2D();
    for (let i = 0; i < 3; i++) { const x0 = -1000 + i * 520, k0 = 0, pts = [[-1000, -60], [-560, 60], [-560, 700], [-1000, 900]].map(([x, y]) => [x, y]);
      const ka = i / 3 * .62, kb = (i + .82) / 3 * .62; const a0 = toVP(-1000, 20, ka), a1 = toVP(-1000, 20, kb), b1 = toVP(-1000, 820, kb), b0 = toVP(-1000, 820, ka);
      polyPath([a0, a1, b1, b0], true, holes); }
    const wp = new Path2D(); wp.addPath(wallPath); wp.addPath(holes);
    G.fillStyle = bt('#e3d8c5'); G.fill(wp, 'evenodd');
    // window frames + curtains
    G.strokeStyle = bt('#f7f2e8'); G.lineWidth = 16; G.stroke(holes);
    for (let i = 0; i < 3; i++) { const ka = i / 3 * .62, kb = (i + .82) / 3 * .62, km = (ka + kb) / 2, a = toVP(-1000, 20, km), b = toVP(-1000, 820, km), c = toVP(-1000, 420, ka), d = toVP(-1000, 420, kb);
      G.lineWidth = 9; G.beginPath(); G.moveTo(...a); G.lineTo(...b); G.moveTo(...c); G.lineTo(...d); G.stroke();
      const cu = [toVP(-1000, 10, ka), toVP(-1000, 10, ka + .05), toVP(-1000, 840, ka + .04), toVP(-1000, 840, ka - .01)]; paintPoly(cu, bt('#f4ead2'), bt('#e0d2b4')); }
    G.restore();
    // floor
    paintPoly([bw[3], bw[2], [3000, 1500], [-1000, 1500]], bt('#b98e62'), bt('#9c7250'));
    G.strokeStyle = bt('#8a6244'); G.lineWidth = 2;
    for (let i = -14; i <= 22; i++) { G.beginPath(); G.moveTo(vp[0] + (i * 60) * .38, bw[3][1]); G.lineTo(vp[0] + i * 170, 1500); G.stroke(); }
    // sunlight patches on the floor from the windows
    G.fillStyle = 'rgba(255,236,190,.35)';
    for (let i = 0; i < 3; i++) { const x = -200 + i * 480; G.beginPath(); G.moveTo(x, 1500); G.lineTo(x + 330, 1500); G.lineTo(x + 690, bw[3][1] + 90); G.lineTo(x + 520, bw[3][1] + 90); G.fill(); }
    // desks in rows
    const desk = (x, y, s) => {
      const top = [[x - 110 * s, y - 120 * s], [x + 110 * s, y - 120 * s], [x + 95 * s, y - 160 * s], [x - 95 * s, y - 160 * s]];
      G.fillStyle = bt('#5f5b66'); G.fillRect(x - 100 * s, y - 120 * s, 8 * s, 120 * s); G.fillRect(x + 92 * s, y - 120 * s, 8 * s, 120 * s);
      paintPoly([[x - 110 * s, y - 120 * s], [x + 110 * s, y - 120 * s], [x + 110 * s, y - 100 * s], [x - 110 * s, y - 100 * s]], bt('#8a6446'));
      paintPoly(top, bt('#e0b784'), bt('#c99d6c')); G.fillStyle = bt('#b0b3c2'); G.fillRect(x - 90 * s, y - 100 * s, 180 * s, 34 * s);
    };
    for (let r = 3; r >= 0; r--) for (let c = -2; c <= 3; c++) { const k = r / 4, s = lerp(1.25, .55, k), y = lerp(1320, 860, k); desk(lerp(vp[0] + c * 480, vp[0] + c * 200, k), y, s); }
  }), -1000, -250);
};
// ---- rooftop: big sky, chain-link fence and railing, tiled floor. Horizon low.
SET.rooftop = (cam, t, o = {}) => {
  skyLayer(cam, t, { clouds: [[200, 420, 700, 300, 31], [1300, 330, 900, 380, 32], [2100, 500, 500, 200, 33], [-500, 500, 560, 220, 34]], sun: o.sun, wind: 8 });
  const tn = TODN, bt = c => mixCol(c, TOD[tn].bgTint, TOD[tn].tintK * 1.2);
  parallax(cam, .6);
  blit(layer('roof-far:' + tn, 3400, 1200, () => {
    G.translate(1100, 0);
    for (let i = 0; i < 26; i++) { const x = -1100 + i * 130 + ((i * 71) % 60), h = 60 + ((i * 97) % 140); paintPoly([[x, 760], [x, 760 - h], [x + 110, 760 - h], [x + 110, 760]], bt('#b6c6dc'), bt('#cad6e6')); }
  }), -1100, 0);
  camEnd();
  parallax(cam, 1);
  blit(layer('roof-near:' + tn, 3400, 1500, () => {
    G.translate(1100, 200);
    paintPoly([[-1100, 760], [2300, 760], [2300, 1300], [-1100, 1300]], bt('#c8c2bc'), bt('#a79f9a'));
    G.strokeStyle = bt('#9d958f'); G.lineWidth = 2; for (let i = -20; i < 40; i++) { G.beginPath(); G.moveTo(960 + i * 40, 760); G.lineTo(960 + i * 150, 1300); G.stroke(); }
    for (let j = 0; j < 7; j++) { const y = 760 + Math.pow(j / 7, 1.6) * 540; G.beginPath(); G.moveTo(-1100, y); G.lineTo(2300, y); G.stroke(); }
    // fence: posts + mesh + rail
    G.strokeStyle = bt('#7d8a93'); G.lineWidth = 1.6; G.globalAlpha = .7;
    for (let i = -80; i < 120; i++) { G.beginPath(); G.moveTo(i * 30, 470); G.lineTo(i * 30 + 290, 760); G.stroke(); G.beginPath(); G.moveTo(i * 30 + 290, 470); G.lineTo(i * 30, 760); G.stroke(); }
    G.globalAlpha = 1; G.fillStyle = bt('#5f6b76');
    for (let i = -8; i < 12; i++) G.fillRect(i * 240, 440, 12, 330);
    G.fillRect(-1100, 440, 3400, 14); G.fillRect(-1100, 600, 3400, 8);
  }), -1100, -200);
};

// ======================================================================================= props
// A prop is drawn in hand-local coords: origin = grip point, +x = along the fingers, s = size (usually u).
// Every prop has an ink outline in the holder's line colour and cel shading.
const PROPS = {
  envelope(s, line) {       // held by its short edge: extends along +x from the grip
    const w = .62 * s, h = .42 * s; G.save(); G.translate(w / 2 - .08 * s, 0); G.rotate(Math.PI / 2); G.translate(0, 0);
    const P = polyPath([[-h / 2, -w / 2], [h / 2, -w / 2], [h / 2, w / 2], [-h / 2, w / 2]]);
    drawGroup([{ path: P, b: tone('#fbd7e0'), s: tone('#eeb0c2'), h: tone('#fff4f6'), d: .06 * s, r: .02 * s }], line, .018 * s);
    ink([[-h / 2 + .02 * s, -w / 2 + .02 * s], [0, -w * .12], [h / 2 - .02 * s, -w / 2 + .02 * s]], .016 * s, line, TAPER.soft);
    heart(0, -w * .08, .075 * s, tone('#e0485f'), line); G.restore();
  },
  envelopeFlat(s, line) {
    const w = .62 * s, h = .42 * s, P = polyPath([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]);
    drawGroup([{ path: P, b: tone('#fbd7e0'), s: tone('#eeb0c2'), h: tone('#fff4f6'), d: .06 * s, r: .02 * s }], line, .018 * s);
    ink([[-w / 2 + .02 * s, -h / 2 + .02 * s], [0, h * .08], [w / 2 - .02 * s, -h / 2 + .02 * s]], .016 * s, line, TAPER.soft);
    heart(0, h * .1, .075 * s, tone('#e0485f'), line);
  },
  phone(s, line) {
    const P = polyPath(ccw(ellPts(0, 0, .001, .001, 4))), r = new Path2D(); r.roundRect(-.14 * s, -.26 * s, .28 * s, .52 * s, .05 * s);
    drawGroup([{ path: r, b: tone('#3a3f5c'), s: tone('#262a40'), d: .04 * s }], line, .016 * s);
    const g = G.createLinearGradient(0, -.22 * s, 0, .22 * s); g.addColorStop(0, '#9fd6ff'); g.addColorStop(1, '#e8c6ff'); G.fillStyle = g; G.fillRect(-.11 * s, -.22 * s, .22 * s, .43 * s);
  },
  book(s, line) {
    const r = new Path2D(); r.roundRect(-.3 * s, -.2 * s, .6 * s, .4 * s, .02 * s);
    drawGroup([{ path: r, b: tone('#4f7fc8'), s: tone('#3a5f9c'), h: tone('#86b0ea'), d: .05 * s, r: .02 * s }], line, .018 * s);
    G.fillStyle = tone('#f5efe0'); G.fillRect(-.28 * s, .15 * s, .56 * s, .04 * s);
  },
  can(s, line) {
    const r = new Path2D(); r.roundRect(-.1 * s, -.19 * s, .2 * s, .38 * s, .04 * s);
    drawGroup([{ path: r, b: tone('#ff7a59'), s: tone('#d8553f'), h: tone('#ffd0b8'), d: .05 * s, r: .025 * s }], line, .016 * s);
    G.fillStyle = tone('#fff3d6'); G.fillRect(-.1 * s, -.05 * s, .2 * s, .08 * s);
  },
  flower(s, line) {
    ink([[0, .3 * s], [.02 * s, 0], [0, -.2 * s]], .03 * s, tone('#4f8a4a'), TAPER.flat, { caps: true });
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const p = polyPath(ccw(ellPts(Math.cos(a) * .07 * s, -.26 * s + Math.sin(a) * .07 * s, .06 * s, .045 * s, 12, a)));
      drawGroup([{ path: p, b: tone('#ffc2d6'), s: tone('#f090b0'), d: .02 * s }], line, .01 * s); }
    G.fillStyle = tone('#ffd65a'); G.beginPath(); G.arc(0, -.26 * s, .035 * s, 0, TAU); G.fill();
  },
};
function heart(x, y, r, col, line) {
  const P = [[x, y + r * .9], [x - r, y - r * .1], [x - r * .55, y - r * .8], [x, y - r * .35, 0, true], [x + r * .55, y - r * .8], [x + r, y - r * .1]];
  P[0][3] = true; P[0][2] = 0;
  const path = polyPath(ccw(crPts(P.map(p => [p[0], p[1], 0, p[3]]), true, 6)));
  if (line) { G.strokeStyle = line; G.lineWidth = r * .25; G.lineJoin = 'round'; G.stroke(path); }
  G.fillStyle = col; G.fill(path);
}

// ======================================================================================= effects (screen or world)
// Drawn with rnd() streams re-seeded per drawing step (on twos), so lines "boil" like hand-drawn effects animation.
const fxStep = (t, fps = 12) => Math.floor(t * fps + 1e-6);
// focusLines: radial concentration lines (集中線) toward (cx, cy); r = clear radius; dense 0..1; col.
function focusLines(t, cx, cy, o = {}) {
  const q = rnd('focus' + fxStep(t, o.fps || 12) + (o.seed || '')), n = o.n || 110, R = 1500, r0 = o.r || 330, col = o.col || 'rgba(30,26,46,.85)';
  G.save(); G.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const a = (i + q() * .8) / n * TAU, ri = r0 * (.75 + q() * .6), w = (o.w || 16) * (.3 + q());
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
    G.beginPath(); G.moveTo(cx + ca * ri, cy + sa * ri); G.lineTo(cx + ca * R + px * w, cy + sa * R + py * w); G.lineTo(cx + ca * R - px * w, cy + sa * R - py * w); G.fill();
  }
  G.restore();
}
// speedLines: parallel streaks along angle `ang` (radians, 0 = moving right), for chases, dashes, BG streaks.
function speedLines(t, ang, o = {}) {
  const q = rnd('speed' + fxStep(t, o.fps || 12) + (o.seed || '')), n = o.n || 60, col = o.col || 'rgba(255,255,255,.85)';
  const [x0, y0, w, h] = o.rect || [0, 0, W, H], ca = Math.cos(ang), sa = Math.sin(ang), cx = x0 + w / 2, cy = y0 + h / 2, D = Math.hypot(w, h);
  G.save(); G.beginPath(); G.rect(x0, y0, w, h); G.clip(); G.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const off = (q() - .5) * D, along = (q() - .5) * D * 1.2, len = (o.len || 500) * (.4 + q()), th = (o.w || 5) * (.4 + q());
    const bx = cx - sa * off + ca * along, by = cy + ca * off + sa * along;
    ink([[bx - ca * len / 2, by - sa * len / 2], [bx + ca * len / 2, by + sa * len / 2]], th, col, TAPER.both, { raw: true });
  }
  G.restore();
}
// sparkle: a four-point anime star (+ soft glow). sparkles(): a twinkling cluster around a point.
function sparkle(x, y, r, a = 0, col = '#fffbe8', glow = true) {
  if (r <= 0) return;
  if (glow) { const g = G.createRadialGradient(x, y, 0, x, y, r * 1.6); g.addColorStop(0, 'rgba(255,250,220,.55)'); g.addColorStop(1, 'rgba(255,250,220,0)'); G.fillStyle = g; G.fillRect(x - r * 2, y - r * 2, r * 4, r * 4); }
  const P = []; for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * .16 : r, an = a + i / 8 * TAU; P.push([x + Math.cos(an) * rr, y + Math.sin(an) * rr]); }
  G.fillStyle = col; G.beginPath(); P.forEach((p, i) => i ? G.lineTo(...p) : G.moveTo(...p)); G.closePath(); G.fill();
}
function sparkles(t, x, y, R, n = 6, seed = 's', minR = .35) {
  for (let i = 0; i < n; i++) { const q = rnd(seed + i), ph = q(), a = q() * TAU, d = R * (minR + (1 - minR) * q()), life = frac(t * .9 + ph), s = Math.sin(Math.PI * life);
    sparkle(x + Math.cos(a) * d, y + Math.sin(a) * d * .8, R * (.08 + .1 * q()) * s, life * .8); }
}
// petals: sakura (or leaves) drifting across a rect: pure function of t (each petal loops through the rect).
function petals(t, o = {}) {
  const [x0, y0, w, h] = o.rect || [-100, -100, W + 200, H + 200], n = o.n || 40, s = o.size || 16, wind = o.wind ?? 90, kind = o.kind || 'sakura';
  for (let i = 0; i < n; i++) {
    const q = rnd('petal' + i + (o.seed || '')), sp = (60 + q() * 70) * (o.speed || 1), life = h / sp, ph = q() * life;
    const k = frac((t + ph) / life), y = y0 + k * h, x = x0 + frac(q() + (wind * (t + ph)) / w) * w + Math.sin((t + ph) * (1 + q()) * 2) * 30;
    const a = (t + ph) * (1.5 + q() * 2), sc = s * (.6 + q() * .7) * (o.depth ? lerp(.6, 1.4, q()) : 1), flip = Math.cos((t + ph) * (2 + q() * 3));
    G.save(); G.translate(x, y); G.rotate(a); G.scale(sc, sc * Math.max(.15, Math.abs(flip)));
    if (kind === 'leaf') { G.fillStyle = flip > 0 ? '#7fb35a' : '#5d8f44'; G.beginPath(); G.moveTo(-1, 0); G.quadraticCurveTo(0, -.6, 1, 0); G.quadraticCurveTo(0, .6, -1, 0); G.fill(); }
    else { G.fillStyle = flip > 0 ? '#ffd3de' : '#f4a9bf'; G.beginPath(); G.moveTo(-.9, 0); G.quadraticCurveTo(-.3, -.7, .7, -.35); G.lineTo(.45, 0); G.lineTo(.7, .35); G.quadraticCurveTo(-.3, .7, -.9, 0); G.fill(); }
    G.restore();
  }
}
// dramaticZoom: a snap zoom-in at t0 with overshoot and a decaying shake → { zoom, dx, dy } to add to a camera.
function dramaticZoom(t, t0, amt = .35, shake = 14) {
  if (t < t0) return { zoom: 1, dx: 0, dy: 0 };
  const a = t - t0, z = 1 + amt * backOut(clamp(a / .18)), s = shake * Math.exp(-a * 5), [dx, dy] = shakeXY(t, s);
  return { zoom: z, dx, dy };
}
// smear: draw a moving thing as multiples/ghosts along its path (fast motion). fn(x, y, alpha) draws it once.
function smear(fn, from, to, n = 3) { for (let i = n; i >= 1; i--) { const k = i / (n + 1); G.save(); G.globalAlpha = .28 * (1 - k); fn(lerp(from[0], to[0], k), lerp(from[1], to[1], k), .3); G.restore(); } fn(to[0], to[1], 1); }
// smearLines: tapered motion lines trailing a fast object (world or screen coords)
function smearLines(x0, y0, x1, y1, spread, col = 'rgba(255,255,255,.9)', n = 5, seed = 'sm') {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, px = -dy / l, py = dx / l, q = rnd(seed);
  for (let i = 0; i < n; i++) { const o = (i / (n - 1) - .5) * spread, k = .5 + q() * .5; ink([[x0 + px * o + dx * (1 - k), y0 + py * o + dy * (1 - k)], [x1 + px * o, y1 + py * o]], 3 + q() * 5, col, TAPER.tail, { raw: true }); }
}
// scratch canvas for full-frame effects
let _tmp = null; const tmpCanvas = () => _tmp || (_tmp = makeCanvas());
// blurBand: re-draw a horizontal band of the current frame motion-blurred (the anime "BG streak" behind a dash).
function blurBand(y, h, o = {}) {
  const c = tmpCanvas(), g = c.getContext('2d'), b = o.blur || 14;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.drawImage(G.canvas, 0, 0);
  G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.beginPath(); G.rect(0, y, W, h); G.clip();
  G.filter = `blur(${b}px)`; G.drawImage(c, 0, y - 20, W, h + 40, -40, y - 20, W + 80, h + 40); G.filter = 'none';
  G.restore();
  speedLines(o.t || 0, o.ang || 0, { rect: [0, y, W, h], n: o.n || 26, len: 700, w: 4, col: o.col || 'rgba(255,255,255,.55)' });
}
// impactFrame: the anime impact flash. mode 'invert' (negative), 'mono' (hard black/white), 'red' (black/red).
// k = 0..1 strength (use a 2–4 frame hold). Optional radial lines from (o.x, o.y).
function impactFrame(k, mode = 'invert', o = {}) {
  if (k <= 0) return;
  const c = tmpCanvas(), g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.filter = mode === 'invert' ? 'grayscale(1) contrast(4) invert(1)' : 'grayscale(1) contrast(9) brightness(1.1)';
  g.drawImage(G.canvas, 0, 0); g.filter = 'none';
  if (mode === 'red') { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#e8283c'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = k; G.drawImage(c, 0, 0);
  if (o.x != null) focusLines(o.t || 0, o.x, o.y, { col: mode === 'invert' ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.9)', r: o.r || 260, n: 90, w: 22 });
  G.restore();
}
function flash(k, col = '#ffffff') { if (k <= 0) return; G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = clamp(k); G.fillStyle = col; G.fillRect(0, 0, W, H); G.restore(); }

// ======================================================================================= transitions (screen space)
// slashWipe(p): diagonal bands slash across (p 0→.5 covers, .5→1 uncovers the other way). Cut to the next shot at .5
// (call it at the end of shot A with p = k/2 and at the start of shot B with p = .5 + k/2).
function slashWipe(p, o = {}) {
  if (p <= 0 || p >= 1) return;
  const cols = o.cols || ['#ff7da0', '#ffd9e2', '#2d2f5a'], a = o.ang ?? -.35, n = cols.length;
  G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.translate(W / 2, H / 2); G.rotate(a);
  const D = 2600;
  for (let i = 0; i < n; i++) {
    const lag = i * .07, k = p < .5 ? easeIn(clamp((p * 2 - lag) / (1 - lag * 2))) : easeOut(clamp(((p - .5) * 2 - (n - 1 - i) * .07) / (1 - .14)));
    const x0 = p < .5 ? -D / 2 - 300 : lerp(-D / 2, D / 2 + 300, k), x1 = p < .5 ? lerp(-D / 2 - 300, D / 2, k) : D / 2 + 300;
    const skew = 260;
    G.fillStyle = cols[i]; G.beginPath(); G.moveTo(x0, -D / 2); G.lineTo(x1 + skew, -D / 2); G.lineTo(x1 - skew, D / 2); G.lineTo(x0 - 2 * skew, D / 2); G.fill();
  }
  G.restore();
}
// irisWipe(p, cx, cy, shape): closes to black (p 0→.5) and opens (p .5→1) around a point; shape 'circle' | 'star'.
function irisWipe(p, cx, cy, o = {}) {
  if (p <= 0 || p >= 1) return;
  const R = Math.hypot(W, H), r = p < .5 ? lerp(R, 0, easeIn(p * 2)) : lerp(0, R, easeOut((p - .5) * 2));
  G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.fillStyle = o.col || '#1a1830'; G.beginPath(); G.rect(0, 0, W, H);
  if (o.shape === 'star') { for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, rr = i % 2 ? r * .45 : r; G[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } }
  else { G.moveTo(cx + r, cy); G.arc(cx, cy, r, 0, TAU, true); }
  G.fill('evenodd'); G.restore();
}

// ======================================================================================= captions
// subtitle(c, txt, o): anime TV subtitle — white text, thick dark outline, soft shadow. Use in window.overlayHook.
//   o: { y, size, fg, line, alpha, font, speaker (colour of a small leading bar) }
function subtitle(c, txt, o = {}) {
  const size = o.size || 58, y = o.y || H - 92;
  c.save(); c.globalAlpha = o.alpha ?? 1;
  c.font = o.font || `800 ${size}px "M PLUS Rounded 1c", "Noto Sans TC", "Noto Sans JP", system-ui, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.shadowColor = 'rgba(10,8,30,.45)'; c.shadowBlur = size * .25; c.shadowOffsetY = size * .06;
  c.strokeStyle = o.line || '#1d1a33'; c.lineWidth = size * .2; c.strokeText(txt, W / 2, y);
  c.shadowColor = 'transparent'; c.fillStyle = o.fg || '#ffffff'; c.fillText(txt, W / 2, y);
  c.restore();
}
window.EXTRA_FONTS = [['800 58px "M PLUS Rounded 1c"', 'あア那個給你請收下'], ['900 58px "Noto Sans TC"', '那個給你請收下']];

// ======================================================================================= grade (ENGINE hooks)
// GRADE is reset every frame; a shot may change it: { bloom 0..1, vignette 0..1, tint }.
let GRADE = {};
let _small = null;
window.ENGINE = {
  begin(t) { GRADE = { bloom: .22, vignette: .22 }; setTOD('day'); },
  end(t) {
    const g = OUT;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (GRADE.bloom) {       // soft diffusion glow of the bright parts (the "compositing" look of TV anime)
      _small = _small || makeCanvas(W / 8, H / 8); const s = _small.getContext('2d');
      s.filter = 'blur(3px) brightness(1.15)'; s.clearRect(0, 0, W / 8, H / 8); s.drawImage(OUTC, 0, 0, W / 8, H / 8); s.filter = 'none';
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = GRADE.bloom * .6; g.drawImage(_small, 0, 0, W, H); g.restore();
    }
    if (GRADE.vignette) { const v = g.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(40,20,60,0)'); v.addColorStop(1, `rgba(40,20,60,${GRADE.vignette})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
  },
};
