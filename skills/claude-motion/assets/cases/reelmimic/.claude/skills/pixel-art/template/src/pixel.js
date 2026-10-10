// pixel.js: ReelMimic's PIXEL-ART drawing library.
//
// Everything is drawn into a 480×270 software framebuffer (FB, one Uint32 per pixel) and upscaled ×4 to 1920×1080
// with nearest-neighbour in ENGINE.end. World units = low-res pixels. The camera and every shape snap to whole pixels,
// so nothing shimmers. Colours come from limited palettes (P = PALS.day / dusk / night) organised as ramps
// (dark → light); shade(c, k) walks a ramp, which is how outlines, shadows and lights stay on-palette.
//
// Why 480×270 ×4: a 40–70 px character is big enough for readable faces (eyes 2–3 px, mouths 3–5 px) and the pixel
// grid still reads as pixel art at phone size (1 art pixel = 4 screen px; ≈0.8 px on a 390-px phone, and characters
// are 160–280 screen px tall). 384×216 ×5 is chunkier but leaves too few pixels for faces and two-character staging.
//
// Pure functions of t: no Math.random, no state between frames. Everything below takes world coordinates unless noted.

const LW = 480, LH = 270, PXS = W / LW;
const LOC = makeCanvas(LW, LH), LOX = LOC.getContext('2d');
const IMG = LOX.createImageData(LW, LH), FB = new Uint32Array(IMG.data.buffer), FB2 = new Uint32Array(LW * LH);
const SB = new Uint32Array(LW * LH), SID = new Uint8Array(LW * LH), PLINE = new Uint8Array(256);
let OX = 0, OY = 0, CAMX = 0, CAMY = 0, SPRM = false, PART = 1, PUNCH = null;
let KX0 = 0, KY0 = 0, KX1 = LW - 1, KY1 = LH - 1;     // clip rect (screen px, inclusive)
let BX0 = LW, BY0 = LH, BX1 = -1, BY1 = -1;            // sprite bbox

// ---------- colour ----------
const _C = new Map();
function C(c) {                                    // '#rrggbb' | u32 → u32 (ABGR, as stored in FB)
  if (typeof c === 'number') return c;
  let v = _C.get(c); if (v !== undefined) return v;
  const n = parseInt(c.slice(1, 7), 16);
  v = (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0; _C.set(c, v); return v;
}
const _b8 = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
const U = (r, g, b) => (0xff000000 | (_b8(b) << 16) | (_b8(g) << 8) | _b8(r)) >>> 0;
const rgbOf = u => [u & 255, (u >>> 8) & 255, (u >>> 16) & 255];
const hexOf = u => { const [r, g, b] = rgbOf(C(u)); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); };
function mixU(a, b, k) { const A = rgbOf(C(a)), B = rgbOf(C(b)); return U(lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)); }

// ramps: every registered ramp lets shade() step along it. Off the end, a hue-shifted darken/lighten takes over
// (shadows drift toward blue-violet, lights toward warm), the classic pixel-art ramp rule.
const RAMP = new Map();
function regRamp(arr) { const us = arr.map(C); us.forEach((u, i) => RAMP.set(u, { r: us, i })); return arr; }
function _shift(u, k) {
  let [r, g, b] = rgbOf(u);
  for (let s = 0; s < Math.abs(k); s++) {
    if (k < 0) { r = r * .72; g = g * .7; b = b * .8 + 10; }
    else { r += (255 - r) * .32 + 6; g += (255 - g) * .28 + 3; b += (255 - b) * .2; }
  }
  return U(r, g, b);
}
const _SH = new Map();
function shade(c, k = -1) {                        // k steps along c's ramp (− darker, + lighter) → u32
  const u = C(c); if (!k) return u;
  const key = u * 32 + k + 16; let v = _SH.get(key); if (v !== undefined) return v;
  const e = RAMP.get(u);
  if (e) { const j = e.i + k, n = e.r.length; v = j >= 0 && j < n ? e.r[j] : _shift(e.r[j < 0 ? 0 : n - 1], j < 0 ? j : j - n + 1); }
  else v = _shift(u, k);
  _SH.set(key, v); return v;
}
const _TN = new Map();
function tintU(u, tc, k) { const key = u + '|' + tc + '|' + k; let v = _TN.get(key); if (v === undefined) { v = mixU(u, tc, k); _TN.set(key, v); } return v; }

// ---------- palettes (~30 colours each, as ramps dark → light; same keys in every palette) ----------
const PALS = {
  day: {
    name: 'day', ink: '#1d1b2e', paper: '#fff8e8',
    sky: ['#3f73c6', '#5a95e0', '#7fb6ee', '#abd6f5', '#dcf1fa'],
    cloud: ['#98b2da', '#cfe0f3', '#f8fbff'],
    far: ['#6d93c8', '#8cb0da'], mid: ['#3f8a78', '#5aa880', '#86c98c'],
    grass: ['#1f4d3c', '#2f7545', '#489c48', '#78c455', '#b9e26c'],
    earth: ['#3e2a30', '#6a4034', '#946140', '#c08b56', '#e4bb86'],
    stone: ['#434563', '#6b6e8e', '#9da2bd'], wood: ['#472a2b', '#744332', '#a36844'],
    light: ['#e89a3c', '#ffd35e', '#fff3b0'], sun: ['#ffd35e', '#fff3b0', '#fffdf0'],
    accent: ['#9c2a48', '#e24a5e', '#ff8f8a'], cool: ['#2c4f8a', '#4f86c6'], rim: '#fff3b0',
    charTint: null,
  },
  dusk: {
    name: 'dusk', ink: '#1a1228', paper: '#fff0dc',
    sky: ['#2c2254', '#512d66', '#8a3d6e', '#cf5b6a', '#f38f5e', '#ffc67a'],
    cloud: ['#6a3566', '#b8546e', '#f39a7e'],
    far: ['#4e3474', '#6c4284'], mid: ['#35285a', '#452f66', '#5a3a72'],
    grass: ['#1c1834', '#2a2246', '#3d2d58', '#5e3f68', '#8a5670'],
    earth: ['#221628', '#35203a', '#4c2c4a'],
    stone: ['#2e2a48', '#48406a'], wood: ['#2c1a2c', '#4a2a3a', '#6c3c46'],
    light: ['#ff8a45', '#ffc862', '#fff0b0'], sun: ['#ffb45a', '#ffe08a', '#fff6d2'],
    accent: ['#a02a4a', '#ff5a6a', '#ff9d8a'], cool: ['#3a3a7a', '#5a5aa0'], rim: '#ffb07a',
    charTint: ['#ff7a5a', .1],
  },
  night: {
    name: 'night', ink: '#08091a', paper: '#e8ecff',
    sky: ['#090b22', '#10173a', '#192655', '#263a72', '#3a5594'],
    cloud: ['#1e2a55', '#2f4278', '#4a64a0'],
    far: ['#172246', '#1f2d58'], mid: ['#111a36', '#172444', '#1f3050'],
    grass: ['#0c1624', '#132536', '#1c3846', '#2a525c', '#3f7474'],
    earth: ['#100c1c', '#1c162e', '#2a2242'],
    stone: ['#1e2240', '#2e3458'], wood: ['#160f1e', '#261a2e', '#3a2a40'],
    light: ['#e0783a', '#ffb44a', '#ffe08a', '#fff6cc'], sun: ['#cfc7a0', '#efe9c8', '#fffbe8'],
    accent: ['#6a2a5a', '#c84a78', '#ff8aa8'], cool: ['#8fa6e0', '#dfe8ff'], rim: '#8fb0ff',
    charTint: ['#3a4a9a', .32],
  },
};
for (const p of Object.values(PALS)) for (const v of Object.values(p)) if (Array.isArray(v) && typeof v[0] === 'string' && v[0][0] === '#') regRamp(v);
let P = PALS.day;
function pal(name) { P = PALS[name] || name; return P; }
function palColours(p = P) { const s = new Set(); for (const [k, v] of Object.entries(p)) if (k !== 'charTint') [].concat(v).forEach(c => typeof c === 'string' && c[0] === '#' && s.add(c)); return [...s]; }

// ---------- ordered (Bayer) dithering ----------
const BAY4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const BAY8 = (() => { const m = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21]; return m.map(v => (v + .5) / 64); })();
// dither test at a WORLD pixel of the current layer (pattern moves with the layer, so it never swims)
const dith = (x, y, d) => BAY4[((Math.round(y) & 3) << 2) | (Math.round(x) & 3)] < d;
const qd = (d, n = 4) => Math.round(clamp(d) * n) / n;   // quantise a level so dithers come in clean bands

// ---------- camera & layers ----------
// camAt(cx, cy): world point at screen centre, snapped to whole pixels. layer(f) = parallax factor for what follows
// (0 = fixed to screen, 1 = world). screenSpace() = draw in screen pixels (HUD, transitions).
function camAt(cx = LW / 2, cy = LH / 2) {
  CAMX = Math.round(cx - LW / 2); CAMY = Math.round(cy - LH / 2); layer(1);
  LAST_CAM = { cx: CAMX + LW / 2, cy: CAMY + LH / 2, zoom: PXS, rot: 0 };
}
function layer(f = 1, fy = f) { OX = Math.round(CAMX * f); OY = Math.round(CAMY * fy); }
function screenSpace() { OX = 0; OY = 0; }
const shake = (t, amt) => shakeXY(onStep(t, 12), amt).map(Math.round);
// integer punch-in: z = 2 or 3 magnifies around a world point (pixels just get bigger, still crisp)
function punch(z, x, y) {
  z = Math.max(1, Math.round(z)); if (z === 1) { PUNCH = null; return; }
  const sx = clamp(Math.round(x - CAMX - LW / z / 2), 0, LW - LW / z), sy = clamp(Math.round(y - CAMY - LH / z / 2), 0, LH - LH / z);
  PUNCH = { z, sx, sy }; LAST_CAM = { cx: CAMX + sx + LW / z / 2, cy: CAMY + sy + LH / z / 2, zoom: PXS * z, rot: 0 };
}
// world → screen px of the current layer, and back
const scr = (x, y) => [Math.round(x) - OX, Math.round(y) - OY];
function clip(x, y, w, h) { KX0 = Math.max(0, Math.round(x) - OX); KY0 = Math.max(0, Math.round(y) - OY); KX1 = Math.min(LW - 1, Math.round(x + w) - OX - 1); KY1 = Math.min(LH - 1, Math.round(y + h) - OY - 1); }
function noclip() { KX0 = 0; KY0 = 0; KX1 = LW - 1; KY1 = LH - 1; }

// ---------- raster core (screen px) ----------
function _p(x, y, u) {
  if (x < KX0 || x > KX1 || y < KY0 || y > KY1) return;
  const i = y * LW + x;
  if (SPRM) { SB[i] = u; SID[i] = PART; if (x < BX0) BX0 = x; if (x > BX1) BX1 = x; if (y < BY0) BY0 = y; if (y > BY1) BY1 = y; }
  else FB[i] = u;
}
function _span(y, x0, x1, u, d = 1) {
  if (y < KY0 || y > KY1) return; if (x0 < KX0) x0 = KX0; if (x1 > KX1) x1 = KX1; if (x0 > x1) return;
  const row = y * LW, by = ((y + OY) & 3) << 2;
  if (SPRM) {
    if (x0 < BX0) BX0 = x0; if (x1 > BX1) BX1 = x1; if (y < BY0) BY0 = y; if (y > BY1) BY1 = y;
    for (let x = x0; x <= x1; x++) if (d >= 1 || BAY4[by | ((x + OX) & 3)] < d) { SB[row + x] = u; SID[row + x] = PART; }
  } else if (d >= 1) FB.fill(u, row + x0, row + x1 + 1);
  else for (let x = x0; x <= x1; x++) if (BAY4[by | ((x + OX) & 3)] < d) FB[row + x] = u;
}

// ---------- primitives (world coords; c = '#hex' or u32; d = dither density 0..1, 1 = solid) ----------
function fill(c) { FB.fill(C(c)); }
function px(x, y, c) { _p(Math.round(x) - OX, Math.round(y) - OY, C(c)); }
function rect(x, y, w, h, c, d = 1) {
  const u = C(c), sx = Math.round(x) - OX, sy = Math.round(y) - OY, ww = Math.round(w), hh = Math.round(h);
  for (let j = 0; j < hh; j++) _span(sy + j, sx, sx + ww - 1, u, d);
}
const _ST = {};
function _stamp(w) {
  if (_ST[w]) return _ST[w];
  const o = [], a = -Math.floor((w - 1) / 2), c = (w - 1) / 2 + a, th = (w / 2) ** 2 - (w === 3 ? 1 : 0);
  for (let j = a; j < a + w; j++) for (let i = a; i < a + w; i++) if (w <= 2 || (i - c) ** 2 + (j - c) ** 2 <= th) o.push(i, j);
  return (_ST[w] = o);
}
function line(x0, y0, x1, y1, c, w = 1) {        // Bresenham, w = brush width in px (round brush)
  const u = C(c), st = _stamp(Math.max(1, Math.round(w)));
  let ax = Math.round(x0) - OX, ay = Math.round(y0) - OY; const bx = Math.round(x1) - OX, by = Math.round(y1) - OY;
  const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1; let e = dx + dy;
  for (let n = 0; n < 2000; n++) {
    for (let k = 0; k < st.length; k += 2) _p(ax + st[k], ay + st[k + 1], u);
    if (ax === bx && ay === by) break;
    const e2 = 2 * e; if (e2 >= dy) { e += dy; ax += sx; } if (e2 <= dx) { e += dx; ay += sy; }
  }
}
function pline(pts, c, w = 1) { for (let i = 1; i < pts.length; i++) line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, w); }
// smooth curve through control points (quadratic B-spline sampled per pixel) — ropes, strings, tails
function curve(pts, c, w = 1, n = 0) {
  const out = []; n = n || Math.max(4, Math.round(pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0) / 3));
  for (let i = 0; i <= n; i++) { const k = i / n, q = k * (pts.length - 1), a = Math.min(pts.length - 2, Math.floor(q)), f = q - a; out.push([lerp(pts[a][0], pts[a + 1][0], f), lerp(pts[a][1], pts[a + 1][1], f)]); }
  pline(out, c, w);
}
function disc(cx, cy, r, c, d = 1) {                // filled circle, diameter 2r+1, centred on pixel (cx, cy)
  const u = C(c), sx = Math.round(cx) - OX, sy = Math.round(cy) - OY, R = r + .4, R2 = R * R;
  for (let j = -Math.floor(R); j <= Math.floor(R); j++) { const h = Math.floor(Math.sqrt(R2 - j * j)); _span(sy + j, sx - h, sx + h, u, d); }
}
function oval(cx, cy, rx, ry, c, d = 1) {           // filled ellipse centred on pixel (cx, cy)
  if (rx < .5 && ry < .5) return px(cx, cy, c);
  const u = C(c), sx = Math.round(cx) - OX, sy = Math.round(cy) - OY, Ry = ry + .4, Rx = rx + .4;
  for (let j = -Math.floor(Ry); j <= Math.floor(Ry); j++) { const t = 1 - (j / Ry) ** 2; if (t < 0) continue; const h = Math.floor(Rx * Math.sqrt(t)); _span(sy + j, sx - h, sx + h, u, d); }
}
function ring(cx, cy, r, c, w = 1) {                // circle outline
  const u = C(c), sx = Math.round(cx) - OX, sy = Math.round(cy) - OY, R = r + .4, Ri = Math.max(0, r - w + .4);
  for (let j = -Math.floor(R); j <= Math.floor(R); j++) for (let i = -Math.floor(R); i <= Math.floor(R); i++) { const d2 = i * i + j * j; if (d2 <= R * R && d2 > Ri * Ri) _p(sx + i, sy + j, u); }
}
function poly(pts, c, d = 1) {                      // scanline polygon fill (even-odd), vertices snapped to pixels
  const u = C(c), n = pts.length; if (n < 3) return;
  const xs = new Array(n), ys = new Array(n); let y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) { xs[i] = Math.round(pts[i][0]) - OX; ys[i] = Math.round(pts[i][1]) - OY; if (ys[i] < y0) y0 = ys[i]; if (ys[i] > y1) y1 = ys[i]; }
  y0 = Math.max(y0, KY0); y1 = Math.min(y1, KY1 + 1);
  const hit = [];
  for (let y = y0; y < y1; y++) {
    const yc = y + .5; hit.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) { const ya = ys[j], yb = ys[i]; if ((ya <= yc && yc < yb) || (yb <= yc && yc < ya)) hit.push(xs[j] + (yc - ya) * (xs[i] - xs[j]) / (yb - ya)); }
    hit.sort((a, b) => a - b);
    for (let k = 0; k + 1 < hit.length; k += 2) _span(y, Math.ceil(hit[k] - .5), Math.floor(hit[k + 1] - .5), u, d);
  }
}
// shaded ball: dark crescent bottom-right, base, highlight top-left (volume in three tones of one ramp)
function ball(cx, cy, rx, ry, c, o = {}) {
  const b = C(c); oval(cx, cy, rx, ry, o.dark ?? shade(b, -1));
  oval(cx - 1, cy - 1, Math.max(0, rx - 1.2), Math.max(0, ry - 1.2), b);
  if (o.hi !== false && rx > 2) oval(cx - rx * .38, cy - ry * .42, Math.max(.4, rx * .28), Math.max(.4, ry * .2), o.light ?? shade(b, 1));
}

// ---------- sprite passes: auto selective outlines ----------
// beginSpr(); ...draw parts...; endSpr(opts). Everything drawn in between is composited as one sprite with a 1-px
// outline in a darker hue of the neighbouring fill (never flat black). part(line) starts a new part: a part drawn over
// an earlier one gets an inner line on the pixels it covers the edge of (arms over bodies). part(false) = no inner line
// (faces, highlights). opts: { outline: true, k: -2 (outline shade), inner: -1, tint: ['#hex', k], z (integer scale),
// ax, ay (world anchor for z), flash (0..1 white), alpha: false }
function beginSpr() { SPRM = true; PART = 1; PLINE.fill(0); BX0 = LW; BY0 = LH; BX1 = -1; BY1 = -1; }
function part(ln = true) { PART = Math.min(255, PART + 1); PLINE[PART] = ln ? 1 : 0; }
function endSpr(o = {}) {
  SPRM = false; if (BX1 < BX0) return null;
  const x0 = Math.max(0, BX0 - 1), y0 = Math.max(0, BY0 - 1), x1 = Math.min(LW - 1, BX1 + 1), y1 = Math.min(LH - 1, BY1 + 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, R = new Uint32Array(w * h), ok = o.outline !== false, ko = o.k ?? -2, ki = o.inner ?? -2;
  const tint = o.tint === undefined ? P.charTint : o.tint, tc = tint ? C(tint[0]) : 0, tk = tint ? tint[1] : 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * LW + x, c = SB[i]; let out = 0;
    if (c) {
      out = c; const id = SID[i];
      // inner line: this pixel lies under the edge of a later part that wants a line
      if (ki) for (let q = 0; q < 4; q++) {
        const nx = x + (q === 0 ? -1 : q === 1 ? 1 : 0), ny = y + (q === 2 ? -1 : q === 3 ? 1 : 0);
        if (nx < 0 || ny < 0 || nx >= LW || ny >= LH) continue;
        const j = ny * LW + nx, nid = SID[j]; if (SB[j] && nid > id && PLINE[nid]) { out = shade(SB[j], ki); break; }
      }
    } else if (ok) {
      // outer outline: darker hue of a filled 4-neighbour (prefer the one below: shapes read as lit from above)
      let nb = 0;
      if (y + 1 < LH && SB[i + LW]) nb = SB[i + LW]; else if (x > 0 && SB[i - 1]) nb = SB[i - 1];
      else if (x + 1 < LW && SB[i + 1]) nb = SB[i + 1]; else if (y > 0 && SB[i - LW]) nb = SB[i - LW];
      if (nb) out = shade(nb, ko);
    }
    if (out && tk) out = tintU(out, tc, tk);
    if (out && o.flash) out = tintU(out, 0xffffffff, o.flash);
    R[(y - y0) * w + (x - x0)] = out;
  }
  for (let y = y0; y <= y1; y++) { SB.fill(0, y * LW + x0, y * LW + x1 + 1); }
  const z = Math.max(1, Math.round(o.z || 1));
  if (z === 1) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = R[y * w + x]; if (c && x0 + x >= KX0 && x0 + x <= KX1 && y0 + y >= KY0 && y0 + y <= KY1) FB[(y0 + y) * LW + x0 + x] = c; } }
  else {
    const ax = Math.round(o.ax ?? 0) - OX, ay = Math.round(o.ay ?? 0) - OY;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = R[y * w + x]; if (!c) continue; const X = ax + (x0 + x - ax) * z, Y = ay + (y0 + y - ay) * z;
      for (let b = 0; b < z; b++) for (let a = 0; a < z; a++) { const xx = X + a, yy = Y + b; if (xx >= KX0 && xx <= KX1 && yy >= KY0 && yy <= KY1) FB[yy * LW + xx] = c; }
    }
  }
  return [x0 + OX, y0 + OY, w, h];
}
function outlined(fn, o) { beginSpr(); fn(); return endSpr({ tint: null, ...o }); }

// ---------- sprites from string grids ----------
// sprite(rows, map, x, y, { ax=.5, ay=1, flip, z }): rows = array of strings (or one multi-line string); map maps
// each char to a colour; '.' and ' ' are transparent. Anchor (ax, ay) is where (x, y) sits inside the sprite.
const _SP = new Map();
function _parse(rows) {
  let s = _SP.get(rows); if (s) return s;
  const r = typeof rows === 'string' ? rows.split('\n').map(l => l.trim()).filter(Boolean) : rows;
  s = { w: Math.max(...r.map(l => l.length)), h: r.length, r }; _SP.set(rows, s); return s;
}
function sprite(rows, map, x, y, o = {}) {
  const s = _parse(rows), z = o.z || 1, fl = o.flip, bx = Math.round(x - (o.ax ?? .5) * s.w * z), by = Math.round(y - (o.ay ?? 1) * s.h * z);
  const cm = {}; for (const k in map) cm[k] = map[k] == null ? 0 : C(map[k]);
  for (let j = 0; j < s.h; j++) { const l = s.r[j]; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '.' || ch === ' ' || !cm[ch]) continue; const ii = fl ? s.w - 1 - i : i; if (z === 1) px(bx + ii, by + j, cm[ch]); else rect(bx + ii * z, by + j * z, z, z, cm[ch]); } }
}

// ---------- tiles (16×16, generated from the palette, cached per palette) ----------
const TS = 16, _TL = new Map();
const TILE_GEN = {
  grass(p, x, y, r) { const g = p.grass, e = p.earth; const edge = 4 + Math.round(r(x) * 2); if (y === 0) return g[4]; if (y < edge - 1) return g[3]; if (y < edge) return g[2]; if (y === edge) return e[1]; return (hash(x * 7 + y * 31) > .9) ? e[1] : (hash(x * 13 + y * 5) > .93 ? e[3] : e[2]); },
  dirt(p, x, y) { const e = p.earth; return hash(x * 7 + y * 31 + 3) > .9 ? e[1] : hash(x * 17 + y * 3) > .94 ? e[3] : e[2]; },
  brick(p, x, y) { const s = p.stone, row = y >> 2, off = (row & 1) * 4; if ((y & 3) === 3 || ((x + off) & 7) === 7) return s[0]; return (y & 3) === 0 ? s[2] : s[1]; },
  plank(p, x, y) { const w = p.wood; if ((y & 7) === 7) return w[0]; if ((y & 7) === 0) return w[2]; if ((x === 3 || x === 12) && (y & 7) === 3) return w[0]; return hash(x * 3 + (y >> 3) * 17) > .85 ? w[0] : w[1]; },
  water(p, x, y) { const c = p.cool; return ((x + (y >> 2) * 5) % 16 < 3 && (y & 3) === 1) ? (p.sky[p.sky.length - 1]) : (y < 2 ? c[1] : c[0]); },
  stone(p, x, y) { const s = p.stone, d = Math.min(x, y, 15 - x, 15 - y); return d === 0 ? s[0] : (x === 1 || y === 1) ? s[2] : s[1]; },
};
function _tile(kind) {
  const key = P.name + kind; let t = _TL.get(key); if (t) return t;
  t = new Uint32Array(TS * TS); const g = TILE_GEN[kind], r = i => hash(i * 3.7 + kind.length);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = g(P, x, y, r); t[y * TS + x] = c ? C(c) : 0; }
  _TL.set(key, t); return t;
}
function tile(kind, x, y) { const t = _tile(kind), sx = Math.round(x) - OX, sy = Math.round(y) - OY; if (sx > LW || sy > LH || sx < -TS || sy < -TS) return; for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) { const c = t[j * TS + i]; if (c) _p(sx + i, sy + j, c); } }
// tilemap(['..gggg', 'ggdddd'], { g: 'grass', d: 'dirt' }, x0, y0): one char per 16-px tile
function tilemap(rows, legend, x0, y0) { rows.forEach((l, j) => { for (let i = 0; i < l.length; i++) { const k = legend[l[i]]; if (k) tile(k, x0 + i * TS, y0 + j * TS); } }); }

// ---------- backgrounds & parallax ----------
// sky(stops, { y0, y1, soft, par }): vertical bands of palette colours with ordered-dither seams (screen space)
function sky(stops = P.sky, o = {}) {
  const y0 = o.y0 ?? 0, y1 = o.y1 ?? LH, soft = o.soft ?? .55, us = stops.map(C), n = us.length - 1, oy = Math.round(CAMY * (o.par ?? 0));
  for (let y = 0; y < LH; y++) {
    const p = clamp((y + oy - y0) / (y1 - y0)) * n, i = Math.min(n - 1, Math.floor(p)), f = p - i, g = clamp((f - .5) / soft + .5), row = y * LW, by = ((y + oy) & 3) << 2;
    const a = us[i], b = us[i + 1];
    if (g <= 0) FB.fill(a, row, row + LW); else if (g >= 1) FB.fill(b, row, row + LW);
    else for (let x = 0; x < LW; x++) FB[row + x] = BAY4[by | (x & 3)] < g ? b : a;
  }
}
// dithered radial light blob in banded rings (glows, halos, lamp pools)
function glow(x, y, r, c, k = 1, o = {}) {
  const u = C(c), sx = Math.round(x) - OX, sy = Math.round(y) - OY, bands = o.bands ?? 4, pw = o.pow ?? 1.3;
  for (let j = -r; j <= r; j++) { const yy = sy + j; if (yy < KY0 || yy > KY1) continue; const by = ((yy + OY) & 3) << 2;
    for (let i = -r; i <= r; i++) { const xx = sx + i; if (xx < KX0 || xx > KX1) continue; const d = Math.sqrt(i * i + j * j) / r; if (d >= 1) continue;
      const lv = Math.ceil(k * Math.pow(1 - d, pw) * bands) / bands; if (BAY4[by | ((xx + OX) & 3)] < lv) _p(xx, yy, u); } }
}
// light(x, y, r, k): brighten whatever is already there one or two steps along its own ramp (on-palette lighting)
function light(x, y, r, k = 1, o = {}) {
  const sx = Math.round(x) - OX, sy = Math.round(y) - OY, ry = o.ry ?? r;
  for (let j = -ry; j <= ry; j++) { const yy = sy + j; if (yy < 0 || yy >= LH) continue; const by = ((yy + OY) & 3) << 2;
    for (let i = -r; i <= r; i++) { const xx = sx + i; if (xx < 0 || xx >= LW) continue; const d = Math.sqrt((i / r) ** 2 + (j / ry) ** 2); if (d >= 1) continue;
      const lv = Math.ceil(k * (1 - d) * 4) / 4, n = Math.floor(lv) + (BAY4[by | ((xx + OX) & 3)] < lv - Math.floor(lv) ? 1 : 0);
      if (n > 0) { const ii = yy * LW + xx; FB[ii] = shade(FB[ii], Math.min(n, 2)); } } }
}
// shadowAt(x, y, rx, ry, k): darken what's there (contact shadows, vignettes); dithered edge
function shadowAt(x, y, rx, ry = rx * .3, k = 1) {
  const sx = Math.round(x) - OX, sy = Math.round(y) - OY;
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) { const yy = sy + j; if (yy < 0 || yy >= LH) continue; const by = ((yy + OY) & 3) << 2;
    for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++) { const xx = sx + i; if (xx < 0 || xx >= LW) continue; const d = (i / (rx + .4)) ** 2 + (j / (ry + .4)) ** 2; if (d > 1) continue;
      if (BAY4[by | ((xx + OX) & 3)] < k * (d < .55 ? 1 : .5)) { const ii = yy * LW + xx; FB[ii] = shade(FB[ii], -1); } } }
}
// vignette(k): darkened, dithered corners (screen space) — use lightly for mood
function vignette(k = .5) { for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) { const dx = (x - LW / 2) / (LW / 2), dy = (y - LH / 2) / (LH / 2), d = (dx * dx * .8 + dy * dy) - (1 - k * .6); if (d > 0 && BAY4[((y & 3) << 2) | (x & 3)] < d * 2.2) { const i = y * LW + x; FB[i] = shade(FB[i], -1); } } }

function sunDisc(x, y, r, o = {}) {                 // sun or moon with banded halo; o.par, o.moon
  layer(o.par ?? 0); const s = o.cols || P.sun;
  if (o.halo !== false) { glow(x, y, Math.round(r * 3.2), s[0], .55); glow(x, y, Math.round(r * 1.9), s[1], .8); }
  disc(x, y, r, s[1]); disc(x - 1, y - 1, r - 1, s[2]);
  if (o.moon) { disc(x + r * .35, y - r * .1, r * .28, s[0]); disc(x - r * .3, y + r * .35, r * .18, s[0]); }
  layer(1);
}
function stars(t, o = {}) {
  layer(o.par ?? .05, 0); const n = o.n ?? 90, sd = o.seed ?? 1, y1 = o.y1 ?? LH * .62, cols = o.cols || P.cool, ts = onStep(t, 6), span = LW + 40;
  for (let i = 0; i < n; i++) {
    const wx = hash(i * 3.13 + sd) * span * 3, sx = ((Math.round(wx - OX) % span) + span) % span - 20, sy = Math.round(hash(i * 7.77 + sd) * y1);
    const big = hash(i * 1.91 + sd) > .86, tw = Math.sin(ts * (2 + hash(i) * 3) + i) > .55;
    const c = C(tw || big ? cols[1] : cols[0]); _p(sx, sy, c);
    if (big && tw) { _p(sx - 1, sy, C(cols[0])); _p(sx + 1, sy, C(cols[0])); _p(sx, sy - 1, C(cols[0])); _p(sx, sy + 1, C(cols[0])); }
  }
  layer(1);
}
// clouds(t, { y, n, seed, par, speed, cols:[shadow, base, light], size }): puffy flat-bottomed pixel clouds that drift
function clouds(t, o = {}) {
  const par = o.par ?? .3; layer(par, par * .5);
  const n = o.n ?? 5, sd = o.seed ?? 3, cols = o.cols || P.cloud, span = o.span ?? LW * 2.4, sp = o.speed ?? 3, sz = o.size ?? 1;
  for (let i = 0; i < n; i++) {
    const r = rnd('cl' + sd + '_' + i), w = (26 + r() * 40) * sz, cy = (o.y ?? 50) + (r() - .5) * (o.dy ?? 40);
    let cx = r() * span + t * sp * (.6 + r() * .6); cx = ((cx - OX + 80) % span + span) % span - 80 + OX;
    const bot = Math.round(cy + 5 * sz), pf = [];
    const k = 3 + Math.floor(r() * 3); for (let j = 0; j < k; j++) { const f = j / (k - 1); pf.push([cx - w / 2 + f * w, cy - Math.sin(f * Math.PI) * 7 * sz - r() * 4 * sz, (6 + Math.sin(f * Math.PI) * 9 + r() * 4) * sz]); }
    clip(-1e5, -1e5, 2e5, bot + 1e5 + 1);
    for (const [x, y, rr] of pf) disc(x + 1, y + 2, rr, cols[0]);
    for (const [x, y, rr] of pf) disc(x, y, rr, cols[1]);
    clip(-1e5, -1e5, 2e5, bot - 2 + 1e5 + 1);
    for (const [x, y, rr] of pf) disc(x - 2, y - 2, rr * .72, cols[2]);
    noclip();
    rect(cx - w / 2 - 6 * sz, bot - 1, w + 12 * sz, 1, cols[0], .5);
  }
  layer(1);
}
// rolling hills silhouette; o: { amp, freq, seed, c, rim (lit top edge colour), rimW, bumps (tree-canopy lumps), par }
function hills(base, o = {}) {
  layer(o.par ?? .4, (o.par ?? .4) * .6);
  const amp = o.amp ?? 16, f = o.freq ?? .012, sd = o.seed ?? 1, u = C(o.c || P.mid[0]), rim = C(o.rim || shade(u, 1)), rw = o.rimW ?? 1, bump = o.bumps || 0, bw = o.bumpW ?? 9;
  for (let sx = 0; sx < LW; sx++) {
    const wx = sx + OX;
    let h = amp * (.6 * Math.sin(wx * f + sd) + .3 * Math.sin(wx * f * 2.3 + sd * 3) + .1 * Math.sin(wx * f * 5.1 + sd * 7));
    if (bump) { const cell = Math.floor(wx / bw), cr = (bw * .5 + hash(cell * 1.3 + sd) * bw * .5) * bump, dx = wx - (cell + .5) * bw; h += Math.sqrt(Math.max(0, cr * cr - dx * dx)) * .9; const c2 = cell + (dx > 0 ? 1 : -1), cr2 = (bw * .5 + hash(c2 * 1.3 + sd) * bw * .5) * bump, dx2 = wx - (c2 + .5) * bw; h = Math.max(h, amp * (.6 * Math.sin(wx * f + sd) + .3 * Math.sin(wx * f * 2.3 + sd * 3)) + Math.sqrt(Math.max(0, cr2 * cr2 - dx2 * dx2)) * .9); }
    const top = Math.round(base - h) - OY;
    for (let y = Math.max(0, top); y < LH; y++) FB[y * LW + sx] = y < top + rw ? rim : u;
  }
  layer(1);
}
// pine forest silhouette; o: { c, rim, par, gap, hmin, hmax, seed }
function forest(base, o = {}) {
  const par = o.par ?? .6; layer(par, par * .6);
  const gap = o.gap ?? 8, sd = o.seed ?? 5, c = o.c || P.mid[0], rim = o.rim, x0 = Math.floor((OX - 20) / gap), x1 = Math.ceil((OX + LW + 20) / gap);
  for (let i = x0; i <= x1; i++) {
    const r = rnd('pine' + sd + '_' + i), h = (o.hmin ?? 16) + r() * ((o.hmax ?? 34) - (o.hmin ?? 16)), x = i * gap + r() * gap * .8, w = h * .42, b = base + r() * 4;
    rect(x - 1, b - 3, 2, 4, c);
    for (let k = 0; k < 3; k++) { const ty = b - h * (.3 + k * .28) - 2, tw = w * (1 - k * .25); poly([[x, ty - h * .34], [x + tw, ty + h * .14], [x - tw, ty + h * .14]], c); if (rim) line(x, ty - h * .34, x - tw + 1, ty + h * .12, rim); }
  }
  rect(OX - 2, base + 2, LW + 4, LH, c);
  layer(1);
}
// city skyline; o: { c, win (lit colour), lit 0..1, par, seed, hmin, hmax }
function city(base, o = {}) {
  const par = o.par ?? .5; layer(par, par * .6);
  const cw = 20, sd = o.seed ?? 7, c = C(o.c || P.far[0]), dk = shade(c, -1), win = C(o.win || P.light[1]), lit = o.lit ?? 0;
  const x0 = Math.floor((OX - 40) / cw), x1 = Math.ceil((OX + LW + 40) / cw);
  for (let i = x0; i <= x1; i++) {
    const r = rnd('bld' + sd + '_' + i), w = 12 + Math.floor(r() * 12), h = (o.hmin ?? 18) + Math.floor(r() * r() * ((o.hmax ?? 70) - (o.hmin ?? 18))), x = i * cw + Math.floor(r() * 6) - 3, y = base - h;
    rect(x, y, w, h + 40, c);
    const roof = r(); if (roof > .7) line(x + 3, y - 1, x + 3, y - 6 - r() * 6, c); else if (roof > .45) rect(x + 2, y - 3, w - 4, 3, c); else if (roof > .3) poly([[x, y], [x + w / 2, y - 6], [x + w, y]], c);
    for (let wy = y + 3; wy < base - 2; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) {
      const on = hash(i * 91 + wx * 7.1 + wy * 3.3 + sd) < lit; px(wx, wy, on ? win : dk); if (on) px(wx, wy + 1, win);
    }
  }
  layer(1);
}
// ground(topY(x), o): grassy ground following a height function (world coords); lit top edge, tufts, dithered depth.
// o: { c: ramp (default P.grass), deep: colour at depth, tufts 0..1, flowers: [colours], par }
function ground(topY, o = {}) {
  layer(o.par ?? 1); const g = (o.c || P.grass).map(C), n = g.length, deep = C(o.deep || g[0]), tf = o.tufts ?? .35, fl = o.flowers;
  for (let sx = 0; sx < LW; sx++) {
    const wx = sx + OX, top = Math.round(topY(wx)) - OY;
    for (let y = Math.max(0, top); y < LH; y++) {
      const d = y - top, wy = y + OY; let c;
      if (d === 0) c = g[n - 1]; else if (d < 3) c = g[n - 2]; else if (d < 7) c = g[n - 3];
      else { const k = clamp((d - 7) / 26); c = BAY4[((wy & 3) << 2) | (wx & 3)] < k ? (k > .7 && n > 3 ? deep : g[Math.max(0, n - 4)]) : g[n - 3]; }
      if (d > 3 && hash(wx * 12.9 + wy * 78.2) > .96) c = shade(c, 1);
      FB[y * LW + sx] = c;
    }
    const hh = hash(wx * 3.7 + 11);
    if (hh < tf && top - 1 >= 0 && top - 1 < LH) { FB[(top - 1) * LW + sx] = g[n - 2]; if (hh < tf * .35 && top - 2 >= 0) FB[(top - 2) * LW + sx] = g[n - 1]; }
    if (fl && hash(wx * 5.3 + 2) > .965 && top - 2 >= 0 && top < LH) { const fc = C(fl[Math.floor(hash(wx) * fl.length)]); FB[(top - 2) * LW + sx] = fc; if (sx > 0) FB[(top - 2) * LW + sx - 1] = shade(fc, 1); FB[(top - 1) * LW + sx] = g[n - 3]; }
  }
  layer(1);
}
// a big leafy tree (drawn as an outlined sprite); returns { canopy: [cx, cy, r] }. o: { h, r, sway, t, leaf, wood, seed }
function tree(x, y, o = {}) {
  const h = o.h ?? 70, R = o.r ?? 42, lf = o.leaf || P.grass, wd = o.wood || P.wood, sd = o.seed ?? 2, sw = Math.round((o.sway ?? 1) * Math.sin(onStep(o.t || 0, 4) * 1.7));
  const cx = x, cy = y - h - R * .35;
  beginSpr();
  poly([[x - 5, y], [x - 9, y + 1], [x - 4, y - h * .5], [x - 3, y - h], [x + 4, y - h], [x + 4, y - h * .5], [x + 8, y + 1], [x + 4, y]], wd[1]);
  line(x + 2, y - 2, x + 3, y - h * .8, wd[0], 2);
  line(x - 2, y - h * .55, x - R * .55, y - h - 4, wd[1], 3); line(x + 2, y - h * .7, x + R * .5, y - h - 8, wd[1], 3);
  part();
  const r = rnd('tree' + sd), blobs = [];
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + r(), d = R * (.35 + r() * .45); blobs.push([cx + Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * .75, R * (.32 + r() * .2)]); }
  blobs.push([cx, cy, R * .55]);
  blobs.sort((a, b) => a[1] - b[1]);
  for (const [bx, by, br] of blobs) oval(bx + sw * (by < cy ? 1 : 0), by + 2, br, br * .85, lf[1]);
  for (const [bx, by, br] of blobs) oval(bx + sw * (by < cy ? 1 : 0) - 1, by - 1, br * .9, br * .75, lf[2]);
  for (const [bx, by, br] of blobs) if (by < cy + R * .2) oval(bx + sw * (by < cy ? 1 : 0) - br * .3, by - br * .35, br * .45, br * .3, lf[3]);
  for (let i = 0; i < 30; i++) { const a = r() * TAU, d = r() * R * .9; px(cx + Math.cos(a) * d * 1.1, cy + Math.sin(a) * d * .7 - 2, lf[4] || lf[3]); }
  endSpr({ tint: null });
  return { canopy: [cx, cy, R] };
}
function bush(x, y, w = 24, o = {}) {
  const lf = o.leaf || P.grass; beginSpr();
  const r = rnd('bush' + x); for (let i = 0; i < 4; i++) { const f = i / 3; oval(x - w / 2 + f * w, y - 5 - Math.sin(f * Math.PI) * 5, w * .28, w * .24, lf[2]); }
  for (let i = 0; i < 4; i++) { const f = i / 3; oval(x - w / 2 + f * w - 1, y - 7 - Math.sin(f * Math.PI) * 5, w * .15, w * .1, lf[3]); }
  rect(x - w / 2 - 2, y - 2, w + 4, 2, lf[1]);
  if (o.berries) for (let i = 0; i < 5; i++) px(x - w / 2 + r() * w, y - 4 - r() * 8, o.berries);
  endSpr({ tint: null });
}

// ---------- weather & particles (all pure functions of t) ----------
function rain(t, o = {}) {
  layer(o.par ?? 0); const n = o.n ?? 140, c = C(o.c || P.cool[1]), c2 = shade(c, 1), ts = onStep(t, o.fps ?? 24), sl = o.slant ?? 2, gy = o.ground;
  for (let i = 0; i < n; i++) {
    const sp = 260 + hash(i * 1.7) * 120, span = LH + 30, y = ((hash(i * 3.3) * span + ts * sp) % span) - 15, x = ((hash(i * 5.1) * (LW + 40) - y * sl / 4 - OX) % (LW + 40) + LW + 40) % (LW + 40) - 20;
    if (gy != null && y > gy - OY) { const a = (hash(i * 9.1) * 3 + ts * 12) % 3 | 0; if (a < 2) { _p(Math.round(x) - 1 - a, gy - OY - 1 - a, c2); _p(Math.round(x) + 1 + a, gy - OY - 1 - a, c2); } continue; }
    line(x + OX, y + OY, x + OX - sl, y + OY + 4, hash(i) > .7 ? c2 : c);
  }
  layer(1);
}
function snow(t, o = {}) {
  layer(o.par ?? .2); const n = o.n ?? 90, c = C(o.c || P.cloud[2]), ts = onStep(t, o.fps ?? 12);
  for (let i = 0; i < n; i++) {
    const sp = 14 + hash(i * 1.7) * 18, span = LH + 10, y = ((hash(i * 3.3) * span + ts * sp) % span) - 5, x = ((hash(i * 5.1) * (LW + 20) + Math.sin(ts * 1.3 + i) * 4 - OX) % (LW + 20) + LW + 20) % (LW + 20) - 10;
    const big = hash(i * 7.3) > .75; _p(Math.round(x), Math.round(y), c); if (big) { _p(Math.round(x) + 1, Math.round(y), c); _p(Math.round(x), Math.round(y) + 1, c); _p(Math.round(x) + 1, Math.round(y) + 1, shade(c, -1)); }
  }
  layer(1);
}
// 4-point twinkles popping inside a box (world): sparkles(t, x, y, w, h, { n, c, seed, rate })
function sparkles(t, x, y, w, h, o = {}) {
  const n = o.n ?? 8, c = o.c || P.light[2], c2 = o.c2 || P.light[1], ts = onStep(t, 12), sd = o.seed ?? 1, per = o.period ?? .7;
  for (let i = 0; i < n; i++) {
    const ph = hash(i * 1.37 + sd) * per, cyc = Math.floor((ts + ph) / per), a = ((ts + ph) % per) / per, r = rnd('sp' + sd + i + '_' + cyc);
    const sx = x + r() * w, sy = y + r() * h, f = Math.floor(a * 7); if (f > 5) continue;
    const s = [0, 1, 2, 3, 2, 1][f];
    px(sx, sy, s >= 2 ? c : c2);
    for (let k = 1; k <= s; k++) { const cc = k === s ? c2 : c; px(sx - k, sy, cc); px(sx + k, sy, cc); px(sx, sy - k, cc); px(sx, sy + k, cc); }
  }
}
function fireflies(t, x, y, w, h, o = {}) {
  const n = o.n ?? 10, c = o.c || '#d8ff7a', ts = onStep(t, 12);
  for (let i = 0; i < n; i++) {
    const r = rnd('ff' + i + (o.seed ?? 0)), fx = x + r() * w + Math.sin(ts * (.6 + r()) + i) * 8, fy = y + r() * h + Math.sin(ts * (.9 + r()) + i * 2) * 5;
    const on = Math.sin(ts * (1.5 + r() * 2) + i * 3) > -.2; if (!on) continue;
    glow(fx, fy, 4, shade(c, -1), .7, { bands: 2 }); px(fx, fy, c);
  }
}
// small birds flapping across: birds(t, { y, n, speed, c, par, seed })
function birds(t, o = {}) {
  layer(o.par ?? .5); const n = o.n ?? 4, c = o.c || P.ink, ts = onStep(t, 8), sp = o.speed ?? 22, sd = o.seed ?? 1;
  for (let i = 0; i < n; i++) {
    const x = (o.x ?? 0) + ts * sp + i * 11 - (i % 2) * 4 + OX * 0, y = (o.y ?? 60) + (i % 3) * 5 + Math.sin(ts * 2 + i) * 2, up = (Math.floor(ts * 8) + i) % 2;
    if (up) { px(x - 2, y - 1, c); px(x - 1, y, c); px(x, y, c); px(x + 1, y, c); px(x + 2, y - 1, c); }
    else { px(x - 2, y + 1, c); px(x - 1, y, c); px(x, y, c); px(x + 1, y, c); px(x + 2, y + 1, c); }
  }
  layer(1);
}
function petals(t, o = {}) {
  layer(o.par ?? .8); const n = o.n ?? 20, cs = o.cols || [P.accent[2], P.accent[1]], ts = onStep(t, 12);
  for (let i = 0; i < n; i++) {
    const sp = 12 + hash(i) * 14, span = LH + 20, y = ((hash(i * 3.3) * span + ts * sp) % span) - 10, x = ((hash(i * 5.1) * (LW + 40) + ts * 18 + Math.sin(ts * 2 + i) * 6) % (LW + 40)) - 20 + OX;
    const c = cs[i % cs.length]; px(x, y + OY, c); if ((Math.floor(ts * 6) + i) % 3) px(x + 1, y + OY, shade(c, -1));
  }
  layer(1);
}

// dust puff (landings, skids, poofs): age in s since the impact; o: { n, c, spread, dir }
function puff(age, x, y, o = {}) {
  if (age < 0 || age > .5) return; const n = o.n ?? 6, c = o.c || P.paper, s = onStep(age, 12), k = s / .5, sp = o.spread ?? 14;
  for (let i = 0; i < n; i++) {
    const side = (i % 2 ? 1 : -1) * (o.dir ? Math.sign(o.dir) * (i % 3 ? 1 : -1) : 1), f = .4 + hash(i * 3.7) * .6;
    const px_ = x + side * sp * f * easeOut(k * 1.4), py_ = y - 1 - 5 * f * easeOut(k) + 3 * k * k;
    disc(px_, py_, Math.max(0, Math.round(1 + 2 * f * Math.sin(Math.min(1, k * 1.6) * Math.PI))), c, qd(1 - k * k, 4));
  }
}
// measure(fn): run a draw call without drawing (e.g. to get a character's hand position at another time)
function measure(fn) { const k = [KX0, KY0, KX1, KY1]; KX0 = 1; KX1 = 0; KY0 = 1; KY1 = 0; const s = SPRM; let r; try { r = fn(); } finally { [KX0, KY0, KX1, KY1] = k; SPRM = s; } return r; }

// ---------- emotes & speech bubbles ----------
const EMO_ART = {
  '!': ['.kk.', '.kk.', '.kk.', '.kk.', '....', '.kk.'],
  '?': ['.kkk.', 'kk.kk', '...kk', '..kk.', '..k..', '.....', '..k..'],
  '!?': ['kk.kkk.', 'kkkk.kk', 'kk...kk', 'kk..kk.', 'kk..k..', '.......', 'kk..k..'],
  heart: ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  sweat: ['..b..', '..b..', '.bbb.', 'bbbbb', 'bwbbb', '.bbb.'],
  anger: ['..r.r..', '.rr.rr.', 'rr...rr', '.......', 'rr...rr', '.rr.rr.', '..r.r..'],
  dots: ['.......', '.......', '.......', 'k..k..k'],
  note: ['..kkk', '..k.k', '..k..', '..k..', 'kkk..', 'kkk..'],
  bulb: ['.yyy.', 'yywyy', 'yyyyy', 'yyyyy', '.yyy.', '.kkk.', '.kkk.'],
  star: ['...y...', '..yyy..', 'yyywyyy', '.yyyyy.', '..yyy..', '.yy.yy.', 'y.....y'],
  spiral: ['.kkkk.', 'k....k', 'k.kk.k', 'k.k..k', 'k...k.', '.kkk..'],
};
const EMO_COL = { k: '#2a1f3a', r: '#e8485c', w: '#ffffff', b: '#5fb8f0', y: '#ffd35e' };
// emote(kind, x, y, { age, bubble, out }): pops in over steps (burst → overshoot → settle); x,y = bubble bottom-left
// point (where it attaches to the head). Kinds: ! ? !? heart sweat anger dots note bulb star spiral zzz
function emote(kind, x, y, o = {}) {
  const age = o.age ?? 1, f = Math.floor(onStep(age, 12) * 12); if (age < 0) return;
  if (o.out != null && o.out >= 1) return;
  x = Math.round(x); y = Math.round(y);
  if (f < 1) { beginSpr(); const c = '#fff8e8'; px(x + 4, y - 6, c); px(x + 2, y - 8, c); px(x + 6, y - 8, c); px(x + 4, y - 10, c); endSpr({ tint: null }); return; }
  const bob = f < 2 ? -3 : f < 3 ? -1 : 0, loop = onStep(age, 4);
  if (kind === 'zzz') { beginSpr(); const Z = ['kkkk', '..k.', '.k..', 'kkkk']; for (let i = 0; i < 3; i++) { const a = (loop * .5 + i / 3) % 1; sprite(Z, { k: '#dfe8ff' }, x + 3 + i * 4 + Math.sin(a * 6) * 1, y - 4 - a * 16, { z: 1 }); } endSpr({ tint: null, k: -6 }); return; }
  const art = EMO_ART[kind] || EMO_ART['!'], s = _parse(art), bw = Math.max(11, s.w + 6), bh = s.h + 6;
  const bx = x, by = y - bh - 3 + bob;
  const pump = kind === 'heart' && Math.floor(loop * 2) % 2 ? 1 : 0;
  const dy = kind === 'sweat' ? (Math.floor(loop * 2) % 3) : 0;
  beginSpr();
  if (o.bubble !== false) {
    const wc = o.bg || '#fff8e8'; rect(bx + 1, by, bw - 2, bh, wc); rect(bx, by + 1, bw, bh - 2, wc);
    poly([[bx + 2, by + bh - 1], [bx + 7, by + bh - 1], [bx + 1, by + bh + 3]], wc);
    part(false);
    rect(bx + 1, by + bh - 1, bw - 2, 1, shade(wc, -1));
  }
  part(false);
  sprite(art, EMO_COL, bx + Math.floor(bw / 2), by + 3 + s.h + (o.bubble === false ? 0 : 0) + dy - pump, { ax: .5, ay: 1, z: 1 });
  endSpr({ tint: null, k: o.bubble === false ? -1 : -3 });
}

// ---------- tiny in-world pixel font (3×5, A–Z 0–9 !?.-:/) for signs, scores, SFX ----------
const FONT35 = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '!': '010010010000010', '?': '110001010000010', '.': '000000000000010', '-': '000000111000000', ':': '000010000010000', '/': '001001010100100', ' ': '000000000000000',
};
// tinyText(s, x, y, c, { z, align, shadow }): (x, y) = top-left (align 'center' centres on x). Returns width in px.
function tinyText(s, x, y, c, o = {}) {
  const z = o.z || 1, str = String(s).toUpperCase(), w = (str.length * 4 - 1) * z, x0 = Math.round(o.align === 'center' ? x - w / 2 : x);
  for (const [dd, cc] of o.shadow ? [[z, o.shadow], [0, c]] : [[0, c]])
    for (let n = 0; n < str.length; n++) { const g = FONT35[str[n]] || FONT35['?']; for (let k = 0; k < 15; k++) if (g[k] === '1') rect(x0 + (n * 4 + k % 3) * z + dd, y + Math.floor(k / 3) * z + dd, z, z, cc); }
  return w;
}

// ---------- transitions (screen space; call after drawing the shot) ----------
// dissolve(k, c): ordered-dither fade to colour c (k: 0 = none, 1 = solid), 64 levels
function dissolve(k, c = P.ink) { if (k <= 0) return; const u = C(c); if (k >= 1) return FB.fill(u); for (let y = 0; y < LH; y++) { const r = (y & 7) << 3, row = y * LW; for (let x = 0; x < LW; x++) if (BAY8[r | (x & 7)] < k) FB[row + x] = u; } }
// iris(k, x, y, { c, shape: 'circle'|'diamond'|'square', edge }): k = 0 open, 1 closed around WORLD point (x,y)
function iris(k, x, y, o = {}) {
  if (k <= 0) return; const u = C(o.c || P.ink), sx = Math.round(x) - OX, sy = Math.round(y) - OY, sh = o.shape || 'circle';
  const [vx, vy, vw, vh] = viewRect(), far = Math.max(Math.hypot(Math.max(sx - vx, vx + vw - sx), Math.max(sy - vy, vy + vh - sy)), 1) * (sh === 'diamond' ? 1.45 : 1), R = far * (1 - ease(k)), e = o.edge ?? 4;
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const dx = x - sx, dy = y - sy, d = sh === 'diamond' ? Math.abs(dx) + Math.abs(dy) : sh === 'square' ? Math.max(Math.abs(dx), Math.abs(dy) * 1.78) : Math.sqrt(dx * dx + dy * dy);
    const v = (d - R) / e; if (v > 1 || (v > 0 && BAY4[((y & 3) << 2) | (x & 3)] < v)) FB[y * LW + x] = u;
  }
}
// diamonds(k, { c, size, dir }): grid of diamonds that grow to cover the screen, staggered along dir ('right'|'left'|'down'|'up'|'center')
// visible part of the low-res buffer (the whole buffer, or the punched-in window)
const viewRect = () => PUNCH ? [PUNCH.sx, PUNCH.sy, LW / PUNCH.z, LH / PUNCH.z, PUNCH.z] : [0, 0, LW, LH, 1];
function diamonds(k, o = {}) {
  if (k <= 0) return; const [vx, vy, vw, vh, z] = viewRect(), u = C(o.c || P.ink), s = (o.size ?? 20) / z, dir = o.dir || 'right', sp = .9;
  for (let y = vy; y < vy + vh; y++) for (let x = vx; x < vx + vw; x++) {
    const lx = x - vx, ly = y - vy, cx = Math.floor(lx / s), cy = Math.floor(ly / s), gx = (cx + .5) * s, gy = (cy + .5) * s;
    const f = dir === 'right' ? gx / vw : dir === 'left' ? 1 - gx / vw : dir === 'down' ? gy / vh : dir === 'up' ? 1 - gy / vh : Math.hypot(gx - vw / 2, gy - vh / 2) / Math.hypot(vw / 2, vh / 2);
    const loc = clamp(k * (1 + sp) - f * sp), d = (Math.abs(lx + .5 - gx) + Math.abs(ly + .5 - gy)) / s;
    if (loc > 0 && d <= loc + .001) FB[y * LW + x] = u;
  }
}
// blocks(k, { c, size, dir, stagger }): chunky stair-stepped slide, rows staggered (dir 'right'|'left')
function blocks(k, o = {}) {
  if (k <= 0) return; const [vx, vy, vw, vh, z] = viewRect(), u = C(o.c || P.ink), b = Math.max(2, Math.round((o.size ?? 18) / z)), sp = .5, rows = Math.ceil(vh / b), cols = Math.ceil(vw / b);
  for (let r = 0; r < rows; r++) {
    const sg = o.stagger === 'random' ? hash(r * 3.1) : r / rows, e = Math.min(vw, Math.floor(clamp(k * (1 + sp) - sg * sp) * (cols + 1)) * b);
    for (let y = vy + r * b; y < Math.min(vy + vh, vy + (r + 1) * b); y++) { if (o.dir === 'left') FB.fill(u, y * LW + vx + vw - e, y * LW + vx + vw); else FB.fill(u, y * LW + vx, y * LW + vx + e); }
  }
}
// crossDither(k, drawA, drawB): dither-dissolve from one full drawing to another (both drawn this frame)
function crossDither(k, drawA, drawB) {
  drawA(); FB2.set(FB); drawB();
  for (let y = 0; y < LH; y++) { const r = (y & 7) << 3, row = y * LW; for (let x = 0; x < LW; x++) if (BAY8[r | (x & 7)] >= k) FB[row + x] = FB2[row + x]; }
}

// ---------- pixel captions (drawn at full res on the overlay, but rasterised on a pixel grid) ----------
// Text is rendered at its native pixel size on a tiny canvas, alpha-thresholded (no anti-aliasing), outlined by one
// font pixel and blown up ×k with nearest-neighbour → crisp pixel lettering. Latin runs use "Press Start 2P", CJK runs
// "DotGothic16" (fallback "Noto Sans TC", thresholded so it still reads as pixels). Declare every string you'll show
// with useText('...') at load time so its glyphs are fetched before rendering.
let PXTEXT = 'Aa0!?';
function useText(s) { PXTEXT += s; }
window.EXTRA_FONTS = [['16px "DotGothic16"', '字あA'], ['16px "Press Start 2P"', 'A'], ['16px "Noto Sans TC"', '字']];
const _TXC = makeCanvas(1600, 48), _TXX = _TXC.getContext('2d', { willReadFrequently: true }), _TXCACHE = new Map();
const _isCJK = ch => /[⺀-鿿豈-﫿＀-￯　-〿぀-ヿ가-힯]/.test(ch);
function _runs(s) { const out = []; for (const ch of s) { const cj = _isCJK(ch); if (out.length && out[out.length - 1].cj === cj) out[out.length - 1].s += ch; else out.push({ cj, s: ch }); } return out; }
// → { canvas, w, h } native-size pixel text with outline & drop shadow baked in
function pxTextImg(s, o = {}) {
  const key = s + '|' + (o.fg || '') + (o.ol || '') + (o.sh || ''); let r = _TXCACHE.get(key); if (r) return r;
  const X = _TXX, fs = 24, pad = 3; X.clearRect(0, 0, _TXC.width, _TXC.height); X.textBaseline = 'alphabetic'; X.fillStyle = '#fff';
  let x = pad; for (const run of _runs(s)) { X.font = run.cj ? `${fs}px "DotGothic16", "Noto Sans TC", sans-serif` : `16px "Press Start 2P", "DotGothic16", monospace`; X.fillText(run.s, x, pad + 21); x += X.measureText(run.s).width; }
  const w = Math.ceil(x + pad), h = fs + pad * 2 + 1, id = X.getImageData(0, 0, w, h), d = id.data, m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = d[i * 4 + 3] > 140 ? 1 : 0;
  const cv = makeCanvas(w, h), cx = cv.getContext('2d'), oi = cx.createImageData(w, h), od = new Uint32Array(oi.data.buffer);
  const fg = C(o.fg || '#fff8e8'), ol = C(o.ol || '#1d1b2e'), sh = C(o.sh || '#1d1b2e');
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = y * w + xx; if (m[i]) { od[i] = fg; continue; }
    let n = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const X2 = xx + a, Y2 = y + b; if (X2 >= 0 && Y2 >= 0 && X2 < w && Y2 < h && m[Y2 * w + X2]) n = 1; }
    if (n) od[i] = ol; else if (y > 1 && xx > 0 && m[(y - 2) * w + xx - 1]) od[i] = sh;
  }
  cx.putImageData(oi, 0, 0); r = { canvas: cv, w, h }; _TXCACHE.set(key, r); return r;
}
// pxText(c, s, x, y, { k: 3, align: 'center', fg, ol }) on the full-res overlay canvas c; (x, y) = top anchor in screen px
function pxText(c, s, x, y, o = {}) {
  const k = o.k ?? 2, im = pxTextImg(s, o), w = im.w * k, xx = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2;
  c.save(); c.imageSmoothingEnabled = false; c.drawImage(im.canvas, Math.round(xx / k) * k, Math.round(y / k) * k, w, im.h * k); c.restore(); return w;
}
// say(c, t, t0, t1, text, { name, y, k, cps, box }): RPG dialogue window with typewriter reveal on the overlay.
// k (default 3) keeps text ≈ 5.5% of frame height, readable on a phone; that fits ≈ 20 CJK / 34 Latin chars per line.
// Opens in 3 steps, types at cps chars/s, blinks a ▼ when done, closes in 3 steps at t1.
function say(c, t, t0, t1, s, o = {}) {
  if (t < t0 || t > t1) return; const U4 = PXS, k = o.k ?? 3, cps = o.cps ?? 16, chars = [...s];
  const open = Math.min(1, Math.floor((t - t0) * 24) / 3), close = Math.min(1, Math.floor((t1 - t) * 24) / 3), g = Math.min(open, close);
  const full = pxTextImg(s, o), bw = Math.max(W * .42, full.w * k + 26 * U4), bh = full.h * k + 16 * U4 * .75, cx = W / 2, y = o.y ?? (H - bh - 14 * U4);
  const hh = Math.max(U4 * 3, Math.round(bh * g / U4) * U4), by = Math.round((y + (bh - hh) / 2) / U4) * U4, bx = Math.round((cx - bw / 2) / U4) * U4, bW = Math.round(bw / U4) * U4;
  const box = o.box || ['#1d1b2e', '#3a3560', '#fff8e8'];
  c.save(); c.fillStyle = box[2]; c.fillRect(bx + U4, by, bW - 2 * U4, hh); c.fillRect(bx, by + U4, bW, hh - 2 * U4);
  c.fillStyle = box[0]; c.fillRect(bx + 2 * U4, by + U4, bW - 4 * U4, hh - 2 * U4); c.fillRect(bx + U4, by + 2 * U4, bW - 2 * U4, hh - 4 * U4);
  c.fillStyle = box[1]; c.fillRect(bx + 2 * U4, by + hh - 3 * U4, bW - 4 * U4, U4);
  if (g >= 1) {
    const n = Math.min(chars.length, Math.floor((t - t0 - .12) * cps)), shown = chars.slice(0, Math.max(0, n)).join('');
    if (shown) pxText(c, shown, bx + 7 * U4, by + (hh - full.h * k) / 2, { ...o, k, align: 'left' });
    if (n >= chars.length && Math.floor(t * 3) % 2 === 0) { c.fillStyle = box[2]; const ax = bx + bW - 7 * U4, ay = by + hh - 7 * U4; c.fillRect(ax - U4, ay - U4, 5 * U4, U4); c.fillRect(ax, ay, 3 * U4, U4); c.fillRect(ax + U4, ay + U4, U4, U4); }
    if (o.name) { const nm = pxTextImg(o.name, { fg: o.nameFg || '#ffd35e' }); const nw = Math.round(nm.w * 2 / U4 + 5) * U4, nx = bx + 4 * U4, ny = by - Math.round(nm.h * 2 / U4) * U4 + U4; c.fillStyle = box[2]; c.fillRect(nx, ny, nw, nm.h * 2 + U4); c.fillStyle = box[0]; c.fillRect(nx + U4, ny + U4, nw - 2 * U4, nm.h * 2 - U4); pxText(c, o.name, nx + 3 * U4, ny + U4 * .5, { k: 2, fg: o.nameFg || '#ffd35e', align: 'left' }); }
  }
  c.restore();
}

// ---------- time helpers ----------
const st = t => onStep(t, 12);                     // sprite time: poses, walk frames, blinks change 12×/s
const vel = (f, t, dt = 1 / 12) => (f(t + dt) - f(t - dt)) / (2 * dt);   // velocity of any pure position function

// ---------- engine hooks ----------
window.ENGINE = {
  crisp: true,
  async setup() {
    const fams = ['16px "DotGothic16"', '16px "Noto Sans TC"', '16px "Press Start 2P"'];
    await Promise.all(fams.map(f => document.fonts.load(f, PXTEXT).catch(() => null)));
  },
  begin(t) { P = PALS.day; SPRM = false; PUNCH = null; noclip(); camAt(LW / 2, LH / 2); FB.fill(C(P.ink)); G = LOX; },
  end(t) {
    if (SPRM) endSpr();
    LOX.putImageData(IMG, 0, 0);
    OUT.setTransform(1, 0, 0, 1, 0, 0); OUT.imageSmoothingEnabled = false;
    if (PUNCH) OUT.drawImage(LOC, PUNCH.sx, PUNCH.sy, LW / PUNCH.z, LH / PUNCH.z, 0, 0, W, H);
    else OUT.drawImage(LOC, 0, 0, W, H);
    G = OUT;
  },
};
