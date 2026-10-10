// Data Storytelling engine — "a pencil-annotated chart on cream paper".
// Everything visual in this style lives here; film.js only calls these functions.
// World units = chart pixels at zoom 1. A 2D camera {x, y, zoom, roll, sx, sy} looks at the paper.
import { clamp, lerp, hash, vnoise, mulberry } from '/core/lib.js';

export const W = 1920, H = 1080;

// ---------- palette ----------
export const P = {
  paper: '#F6F3EC', dotgrid: '#E4DDCF', ink: '#2B2723', inkSoft: '#6E665C', rule: '#DDD6C9',
  blue: '#2F5D8A', red: '#A8283A', graphite: '#3A3733', wood: '#E3C79C', woodDark: '#C9A774',
  shadow: 'rgba(70,50,30,1)',
};
// Diverging "warming stripes" ramp (ColorBrewer RdBu family), u = (v - center) / half.
export const RAMP = [[-1, '#2166AC'], [-.72, '#4393C3'], [-.45, '#92C5DE'], [-.2, '#D1E5F0'], [0, '#F2EEE8'],
  [.2, '#FDDBC7'], [.45, '#F4A582'], [.72, '#D6604D'], [1, '#B2182B'], [1.4, '#7A0F1E']];
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const RAMPC = RAMP.map(([u, h]) => [u, hex2(h)]);
export function rampRGB(u) {
  if (u <= RAMPC[0][0]) return RAMPC[0][1];
  for (let i = 0; i < RAMPC.length - 1; i++) {
    const [a, ca] = RAMPC[i], [b, cb] = RAMPC[i + 1];
    if (u <= b) { const f = (u - a) / (b - a); return ca.map((c, j) => c + (cb[j] - c) * f); }
  }
  return RAMPC[RAMPC.length - 1][1];
}
export const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
// value → colour string. center/half follow the stripes convention (reference-period mean, symmetric span).
export function valueColor(v, { center = .22, half = .85, alpha = 1 } = {}) { return rgb(rampRGB((v - center) / half), alpha); }

// ---------- camera ----------
export function applyCam(g, c) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(W / 2 + (c.sx || 0), H / 2 + (c.sy || 0)); g.rotate(c.roll || 0); g.scale(c.zoom, c.zoom); g.translate(-c.x, -c.y);
}
export function w2s(c, x, y) {
  const dx = (x - c.x) * c.zoom, dy = (y - c.y) * c.zoom, r = c.roll || 0, cs = Math.cos(r), sn = Math.sin(r);
  return [W / 2 + (c.sx || 0) + dx * cs - dy * sn, H / 2 + (c.sy || 0) + dx * sn + dy * cs];
}
export function s2w(c, X, Y) {
  const dx = X - W / 2 - (c.sx || 0), dy = Y - H / 2 - (c.sy || 0), r = -(c.roll || 0), cs = Math.cos(r), sn = Math.sin(r);
  return [c.x + (dx * cs - dy * sn) / c.zoom, c.y + (dx * sn + dy * cs) / c.zoom];
}
export function viewRect(c, pad = 40) {
  const pts = [[-pad, -pad], [W + pad, -pad], [W + pad, H + pad], [-pad, H + pad]].map(([a, b]) => s2w(c, a, b));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// ---------- paper ----------
let _tile = null, _grain = null;
function paperTile() {
  if (_tile) return _tile;
  const S = 512, c = new OffscreenCanvas(S, S), g = c.getContext('2d'), R = mulberry(7);
  g.fillStyle = P.paper; g.fillRect(0, 0, S, S);
  const id = g.getImageData(0, 0, S, S), d = id.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {       // soft cloudy tone + fine tooth, tileable
    const u = x / S * 8, v = y / S * 8;
    const lo = Math.sin(u * .785 + Math.sin(v * .785) * 1.3) * .5 + Math.sin(v * 1.57 + 1.3) * .3;
    const n = (R() - .5) * 5 + lo * 2.2, i = (y * S + x) * 4;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * .9;
  }
  g.putImageData(id, 0, 0);
  for (let k = 0; k < 900; k++) {                                   // fibres
    const x = R() * S, y = R() * S, a = R() * Math.PI * 2, l = 3 + R() * 14;
    g.strokeStyle = R() < .5 ? 'rgba(120,100,70,.07)' : 'rgba(255,255,255,.35)'; g.lineWidth = .6 + R() * .6;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return (_tile = c);
}
// graphite grain mask (used with destination-out)
function grainTile() {
  if (_grain) return _grain;
  const S = 256, c = new OffscreenCanvas(S, S), g = c.getContext('2d'), R = mulberry(11), id = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const r = R(); id.data[i * 4 + 3] = r < .16 ? 255 * (.35 + R() * .65) : 0; }
  g.putImageData(id, 0, 0); return (_grain = c);
}
export function drawPaper(g, c, { dots = 1, dotStep = 24 } = {}) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = P.paper; g.fillRect(0, 0, W, H);
  applyCam(g, c);
  const [x0, y0, x1, y1] = viewRect(c, 60), pat = g.createPattern(paperTile(), 'repeat');
  g.fillStyle = pat; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (dots > 0) {                                                   // faint dot grid (reference for camera motion)
    g.fillStyle = P.dotgrid; g.globalAlpha = dots;
    const r = 1.1 / Math.sqrt(c.zoom) * 1.3;
    for (let x = Math.floor(x0 / dotStep) * dotStep; x < x1; x += dotStep)
      for (let y = Math.floor(y0 / dotStep) * dotStep; y < y1; y += dotStep) g.fillRect(x - r, y - r, 2 * r, 2 * r);
    g.globalAlpha = 1;
  }
}

// ---------- hand-drawn pencil stroke: the core "draw anything in this style" primitive ----------
// pts: [[x,y],...] polyline in current coordinates. Returns the pencil tip position at `progress`.
export function resample(pts, step = 3) {
  const out = [pts[0]], L = [0]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k <= n; k++) { acc += d / n; out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); L.push(acc); }
  }
  return { pts: out, len: L, total: acc };
}
export function pencilStroke(g, pts, o = {}) {
  const { color = P.graphite, width = 2, progress = 1, seed = 1, wobble = .6, passes = 2, alpha = .92, grain = .5, taper = true } = o;
  if (progress <= 0 || pts.length < 2) return pts[0];
  const R = resample(pts, 2.5), n = R.pts.length, end = R.total * clamp(progress);
  const P2 = R.pts.map((p, i) => {                                  // low-frequency wobble perpendicular to the path
    const a = R.pts[Math.max(0, i - 1)], b = R.pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const w = (vnoise(R.len[i] * .02 + seed * 13.1) - .5) * 2 * wobble * width;
    return [p[0] - dy / l * w, p[1] + dx / l * w];
  });
  const a0 = g.globalAlpha;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color;
  let tip = P2[0];
  for (let pass = 0; pass < passes; pass++) {
    const off = pass ? (hash(seed + pass) - .5) * width * .5 : 0;
    for (let i = 1; i < n; i++) {
      if (R.len[i - 1] > end) break;
      const f = R.len[i] / Math.max(1, R.total);
      const tp = taper ? Math.min(1, f * 8, (1 - f) * 8 + .35) : 1;
      const gr = 1 - grain * hash(i * 1.7 + seed * 31 + pass * 7);   // graphite: alpha breaks up along the stroke
      g.globalAlpha = a0 * alpha * gr * (pass ? .45 : 1);
      g.lineWidth = width * (.75 + .25 * tp) * (pass ? .6 : 1);
      let [bx, by] = P2[i];
      if (R.len[i] > end) { const [ax, ay] = P2[i - 1], k = (end - R.len[i - 1]) / (R.len[i] - R.len[i - 1]); bx = ax + (bx - ax) * k; by = ay + (by - ay) * k; }
      g.beginPath(); g.moveTo(P2[i - 1][0] + off, P2[i - 1][1] + off); g.lineTo(bx + off, by + off); g.stroke();
      tip = [bx, by];
    }
  }
  g.restore(); return tip;
}
// helpers to build paths
export const quadPath = (a, c, b, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
export function leader(g, a, b, o = {}) {                            // curved annotation leader from a (text) to b (mark)
  const bend = o.bend ?? .22, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
  return pencilStroke(g, quadPath(a, [mx - dy * bend, my + dx * bend], b), { width: 1.4, wobble: .4, passes: 1, ...o });
}
export function ringPath(x, y, r, seed = 1, turns = 1.12, a0 = -2.2) {  // an un-closed hand-drawn circle
  const n = 48, out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + t * turns * Math.PI * 2, rr = r * (1 + .08 * Math.sin(t * 5 + seed) + t * .06); out.push([x + Math.cos(a) * rr * 1.08, y + Math.sin(a) * rr]); }
  return out;
}
export function wavePath(x, y, s = 1) {                               // tiny sea doodle: three curls
  const out = [];
  for (let i = 0; i <= 90; i++) { const t = i / 90, X = x + t * 66 * s, ph = t * Math.PI * 6; out.push([X + Math.sin(ph) * 3 * s, y - Math.abs(Math.sin(ph / 2)) * 9 * s + Math.cos(ph) * 2 * s]); }
  return out;
}
export function heartPath(x, y, s = 1) {
  const out = [];
  for (let i = 0; i <= 60; i++) { const t = -Math.PI + i / 60 * Math.PI * 2 + .15; out.push([x + 16 * Math.pow(Math.sin(t), 3) * s * .55, y - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s * .55]); }
  return out;
}
export function bracketPath(x0, x1, y, h = 14) {                      // curly-ish underline bracket
  const m = (x0 + x1) / 2;
  return [[x0, y - h], ...quadPath([x0, y - h], [x0, y], [x0 + h, y], 6).slice(1), [m - h, y], ...quadPath([m - h, y], [m, y], [m, y + h], 6).slice(1),
    ...quadPath([m, y + h], [m, y], [m + h, y], 6).slice(1), [x1 - h, y], ...quadPath([x1 - h, y], [x1, y], [x1, y - h], 6).slice(1)];
}

// ---------- handwriting (Caveat) with graphite grain and write-on reveal ----------
const _txt = new Map();
function textImage(text, size, color, weight, font, scale) {
  const key = [text, size, color, weight, font, scale].join('|');
  if (_txt.has(key)) return _txt.get(key);
  const m = new OffscreenCanvas(8, 8).getContext('2d'); m.font = `${weight} ${size * scale}px ${font}`;
  const w = Math.ceil(m.measureText(text).width + size * scale * .6), h = Math.ceil(size * scale * 1.7);
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
  g.font = m.font; g.fillStyle = color; g.textBaseline = 'alphabetic';
  let x = size * scale * .3; const R = mulberry(text.length * 97 + size);
  for (const ch of text) {                                           // per-glyph jitter = hand
    g.save(); g.translate(x, h * .72 + (R() - .5) * size * scale * .05); g.rotate((R() - .5) * .06); g.fillText(ch, 0, 0); g.restore();
    x += g.measureText(ch).width;
  }
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(grainTile(), 'repeat'); g.fillRect(0, 0, w, h);
  const r = { c, w: w / scale, h: h / scale, pad: size * .3, base: h * .72 / scale };
  if (_txt.size > 400) _txt.clear(); _txt.set(key, r); return r;
}
// Draw handwriting at baseline (x, y). progress 0..1 reveals left→right. Returns {tip, w}.
export function handText(g, text, x, y, o = {}) {
  const { size = 30, color = P.blue, progress = 1, weight = 500, align = 'left', font = 'Caveat', zoom = 1, alpha = 1 } = o;
  const sc = clamp(Math.ceil(zoom * 2) / 2, 1, 5), im = textImage(text, size, color, weight, font, sc);
  const tw = im.w - im.pad * 2, left = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
  const X = left - im.pad, Y = y - im.base, pr = clamp(progress);
  if (pr > 0) {
    g.save(); g.globalAlpha *= alpha; g.beginPath(); g.rect(X, Y, im.pad + tw * pr + (pr >= 1 ? im.pad : 0), im.h); g.clip();
    g.drawImage(im.c, X, Y, im.w, im.h); g.restore();
  }
  const f = pr * tw, wig = Math.sin(f * .55) * .5 + Math.sin(f * 1.31 + 1) * .3;   // tip dances over x-height while writing
  return { tip: [left + f, y - size * (.28 + .22 * wig)], w: tw, left };
}
export function measureHand(g, text, size = 30, weight = 500, font = 'Caveat') { g.save(); g.font = `${weight} ${size}px ${font}`; const w = g.measureText(text).width; g.restore(); return w; }

// ---------- set type (printed chart elements) ----------
export function setType(g, text, x, y, o = {}) {
  const { size = 20, font = 'IBM Plex Mono', weight = 400, color = P.inkSoft, align = 'left', progress = 1, alpha = 1, rise = 0, track = 0 } = o;
  g.save(); g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if (track) g.letterSpacing = `${track}px`;
  const tw = g.measureText(text).width; let cx = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
  const chars = [...text], n = chars.length;
  if (progress >= 1 && !rise) { g.globalAlpha = alpha; g.fillText(text, cx, y); g.restore(); return tw; }
  for (let i = 0; i < n; i++) {                                     // typeset letter by letter: each glyph fades & settles
    const k = clamp(progress * (n + 4) - i, 0, 4) / 4;
    const cw = g.measureText(chars[i]).width;
    if (k > 0) { g.globalAlpha = alpha * k; g.fillText(chars[i], cx, y + (1 - k) * (rise || size * .25)); }
    cx += cw + track;
  }
  g.restore(); return tw;
}

// ---------- data marks ----------
// fresh = seconds since the dot landed (for the pop + ripple), negative = not yet.
export function dataDot(g, x, y, r, fill, o = {}) {
  const { fresh = 9, ring = P.ink, ringW = 1.5, alpha = 1, ripple = 1, accent = null } = o;
  if (fresh < 0) return;
  const pop = fresh < .25 ? 1 + .55 * Math.sin(clamp(fresh / .25) * Math.PI) * (1 - fresh / .25 * .4) : 1;
  const col = accent || fill;
  g.save(); g.globalAlpha = alpha;
  if (ripple && fresh < .6) {                                        // landing ripple
    const k = fresh / .6; g.strokeStyle = col; g.globalAlpha = alpha * (1 - k) * .55; g.lineWidth = 1.2;
    g.beginPath(); g.arc(x, y, r * (1.2 + k * 2.4 * ripple), 0, Math.PI * 2); g.stroke(); g.globalAlpha = alpha;
  }
  g.beginPath(); g.arc(x, y, r * pop, 0, Math.PI * 2); g.fillStyle = col; g.fill();
  g.lineWidth = ringW; g.strokeStyle = ring; g.stroke();
  g.restore();
}
export function inkLine(g, pts, o = {}) {
  const { color = P.ink, width = 2.5, alpha = 1 } = o;
  if (pts.length < 2) return;
  g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]); g.stroke(); g.restore();
}
// Dot → stripe morph. u 0..1. dot {x,y,r}, box {x0,x1,y0,y1}.
export function morphMark(g, u, dot, box, fill, o = {}) {
  const e = u <= 0 ? 0 : u >= 1 ? 1 : u;
  const fall = e < .45 ? (e / .45) : 1, grow = e < .3 ? 0 : (e - .3) / .7;
  const fe = fall * fall * (3 - 2 * fall), ge = 1 - Math.pow(1 - grow, 3);
  const cx = lerp(dot.x, (box.x0 + box.x1) / 2, ge), cy = lerp(dot.y, (box.y0 + box.y1) / 2, fe);
  const w = lerp(dot.r * 2, box.x1 - box.x0 + .6, ge), h = lerp(dot.r * 2, box.y1 - box.y0, ge);
  const rad = lerp(dot.r, 0, Math.min(1, ge * 1.5));
  g.save(); g.fillStyle = fill; g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, rad); g.fill();
  if (ge < 1) { g.globalAlpha = 1 - ge; g.lineWidth = 1.5; g.strokeStyle = P.ink; g.stroke(); }
  g.restore();
}
export function stripe(g, x0, x1, y0, y1, fill) { g.fillStyle = fill; g.fillRect(x0, y0, x1 - x0 + .6, y1 - y0); }
// dashed pencil rectangle (the "empty cell"); progress over the perimeter
export function dashedCell(g, x0, y0, x1, y1, o = {}) {
  const { progress = 1, color = P.red, width = 1.6, dash = 9, gap = 7 } = o;
  const per = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], R = resample(per, 1.5), end = R.total * clamp(progress);
  const a0 = g.globalAlpha;
  g.save(); g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round';
  for (let i = 1; i < R.pts.length; i++) {
    if (R.len[i] > end) break;
    if ((R.len[i] % (dash + gap)) < dash) { g.globalAlpha = a0 * .85 * (1 - .4 * hash(i)); g.beginPath(); g.moveTo(...R.pts[i - 1]); g.lineTo(...R.pts[i]); g.stroke(); }
  }
  g.restore();
}

// ---------- the red–blue pencil (the only performer) ----------
// Screen-space. tip = screen point, s = scale (≈ camera zoom), lift 0..1 (height above paper), flip 0..1 (blue→red end),
// blur = extra defocus (foreground), ang = direction the body extends from the tip (screen radians, 0.62 = down-right).
let _pc = null, _pb = null;
function pencilBody(g, s, end, axisScale) {
  // local frame: tip at (0,0), body along +x
  const Lg = 16, Lw = 58, Wd = 24;
  const len = 1400;
  g.save(); g.scale(axisScale, 1);
  // painted hex body: two tones + facet highlights
  const cA = end === 'red' ? P.red : P.blue, cB = end === 'red' ? P.blue : P.red;
  g.fillStyle = cA; g.fillRect(Lg + Lw - 2, -Wd / 2, len * .5, Wd);
  g.fillStyle = cB; g.fillRect(Lg + Lw - 2 + len * .5, -Wd / 2, len * .5, Wd);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(Lg + Lw - 2, -Wd / 2 + 3, len, 5);
  g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(Lg + Lw - 2, Wd / 2 - 6, len, 6);
  // sharpened wood cone with scalloped paint edge
  g.fillStyle = P.wood; g.beginPath(); g.moveTo(Lg * .9, -3.2); g.lineTo(Lg + Lw, -Wd / 2);
  for (let i = 0; i <= 6; i++) g.lineTo(Lg + Lw + (i % 2 ? 5 : 0), -Wd / 2 + Wd * i / 6); g.lineTo(Lg * .9, 3.2); g.closePath(); g.fill();
  g.fillStyle = 'rgba(150,110,60,.25)'; g.beginPath(); g.moveTo(Lg * .9, 1); g.lineTo(Lg + Lw, Wd / 2 - 2); g.lineTo(Lg + Lw, Wd / 2); g.lineTo(Lg * .9, 3.2); g.fill();
  // graphite (tinted by the lead colour)
  g.fillStyle = end === 'red' ? '#8E2232' : '#274E75'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Lg, -3.6); g.lineTo(Lg, 3.6); g.closePath(); g.fill();
  g.restore();
}
export function drawPencil(g, o) {
  const { tip, s = 1, lift = 0, flip = 0, blur = 0, ang = 0.62, alpha = 1, focus = 1 } = o;
  if (alpha <= 0) return;
  if (!_pc) { _pc = new OffscreenCanvas(W, H); _pb = new OffscreenCanvas(W, H); }
  const axisScale = Math.cos(clamp(flip) * Math.PI), end = axisScale >= 0 ? 'blue' : 'red', as = Math.max(.04, Math.abs(axisScale));
  const lz = 1 + lift * .35;                                           // closer to camera = bigger
  const draw = (c, col) => {
    const q = c.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, W, H);
    q.translate(tip[0], tip[1]); q.rotate(ang); q.scale(s * lz, s * lz);
    // pivot for end-over-end flip is ~180px up the body
    q.translate(180 * (1 - as), 0);
    if (col) { q.fillStyle = col; q.globalCompositeOperation = 'source-over'; }
    pencilBody(q, s, end, as);
    if (col) { q.globalCompositeOperation = 'source-in'; q.setTransform(1, 0, 0, 1, 0, 0); q.fillStyle = col; q.fillRect(0, 0, W, H); }
  };
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = alpha;
  // shadow: silhouette offset away from the light (upper-left light), softer & farther with lift
  draw(_pb, 'rgba(70,50,30,1)');
  const sh = 3 + lift * 70 * s, sb = 2 + lift * 16 + blur * .5;
  g.filter = `blur(${sb.toFixed(1)}px)`; g.globalAlpha = alpha * (.2 - lift * .08);
  g.drawImage(_pb, sh * .8, sh * 1.1); g.filter = 'none'; g.globalAlpha = alpha;
  // body with depth of field: sharp near the tip, soft toward the far end
  draw(_pc, null);
  const b = blur + lift * 2.5;
  if (b > .3 || focus < 1) {
    g.filter = `blur(${(b + 4).toFixed(1)}px)`; g.drawImage(_pc, 0, 0); g.filter = 'none';
    if (focus > 0) {                                                 // sharp copy masked to the tip region
      const q = _pb.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, W, H);
      q.filter = b > .3 ? `blur(${b.toFixed(1)}px)` : 'none'; q.drawImage(_pc, 0, 0); q.filter = 'none';
      q.globalCompositeOperation = 'destination-in';
      const gr = q.createLinearGradient(tip[0], tip[1], tip[0] + Math.cos(ang) * 260 * s, tip[1] + Math.sin(ang) * 260 * s);
      gr.addColorStop(0, `rgba(0,0,0,${focus})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = gr; q.fillRect(0, 0, W, H); q.globalCompositeOperation = 'source-over';
      g.drawImage(_pb, 0, 0);
    }
  } else {
    g.drawImage(_pc, 0, 0);
  }
  g.restore();
}

// ---------- figure caption (the subtitle) ----------
// words: [{w, t}] (absolute seconds). Words appear on their time; whole caption flips up when leaving.
export function caption(g, words, t, o = {}) {
  const { x = 180, y = 985, size = 42, maxW = 1380, kicker = '', t0 = 0, t1 = 1e9, color = P.ink } = o;
  if (t < t0 || t > t1 + .3) return;
  const out = t > t1 ? clamp((t - t1) / .3) : 0, inn = clamp((t - t0) / .2);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = (1 - out) * inn; g.translate(0, -out * 26);
  g.font = `400 ${size}px Newsreader`; g.textBaseline = 'alphabetic';
  // wrap
  const lines = [[]]; let lw = 0; const sp = g.measureText(' ').width;
  for (const wd of words) { const ww = g.measureText(wd.w).width; if (lw + ww > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push({ ...wd, ww }); lw += ww + sp; }
  const lh = size * 1.22, top = y - (lines.length - 1) * lh;
  // rule + kicker
  const ruleY = top - size * 1.05;
  const maxLine = Math.max(...lines.map(L => L.reduce((a, b) => a + b.ww + sp, -sp)));
  g.strokeStyle = P.ink; g.lineWidth = 1; g.globalAlpha *= .9;
  g.beginPath(); g.moveTo(x, ruleY); g.lineTo(x + Math.max(260, maxLine) * clamp(inn * 1.2), ruleY); g.stroke();
  if (kicker) setType(g, kicker, x, ruleY - 10, { size: 18, color: P.inkSoft });
  g.fillStyle = color;
  lines.forEach((L, li) => {
    let cx = x;
    for (const wd of L) {
      const k = clamp((t - wd.t) / .125);
      if (k > 0) { g.save(); g.globalAlpha *= k; g.fillText(wd.w, cx, top + li * lh + (1 - k) * 6); g.restore(); }
      cx += wd.ww + sp;
    }
  });
  g.restore();
}

// ---------- generic: draw any path "as data" in this style ----------
// Samples a shape into n points and plots it as a dot-and-line series; values colour the dots.
// accent: colour that bypasses the ramp (the one-colour exception).
export function plotShape(g, path, o = {}) {
  const { n = 24, r = 6, values = null, accent = null, progress = 1, line = true, t = 9, dt = .04 } = o;
  const R = resample(path, 1); const pts = [];
  for (let i = 0; i < n; i++) { const L = R.total * i / (n - 1); let j = 0; while (j < R.len.length - 1 && R.len[j] < L) j++; pts.push(R.pts[j]); }
  const m = Math.floor(clamp(progress) * n);
  if (line) inkLine(g, pts.slice(0, Math.max(1, m)), { width: 2 });
  pts.slice(0, m).forEach((p, i) => dataDot(g, p[0], p[1], r, accent || valueColor(values ? values[i] : (i / (n - 1)) * 1.4 - .4), { fresh: t - i * dt }));
  return pts;
}
// Fill any closed shape with warming stripes: values → vertical bands clipped to the shape.
export function stripesFill(g, path, values, o = {}) {
  const xs = path.map(p => p[0]), ys = path.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  g.save(); g.beginPath(); g.moveTo(...path[0]); for (const p of path.slice(1)) g.lineTo(...p); g.closePath(); g.clip();
  const w = (x1 - x0) / values.length; values.forEach((v, i) => stripe(g, x0 + i * w, x0 + (i + 1) * w, y0, y1, o.accent && o.accentIndex === i ? o.accent : valueColor(v, o)));
  g.restore();
  if (o.outline !== false) pencilStroke(g, [...path, path[0]], { width: 1.4, color: P.ink, passes: 1, wobble: .3 });
}

// ---------- generic shapes in this style ----------
// Four-point sparkle (e.g. the #D97757 "spark"): concave star path.
export function sparklePath(cx, cy, r, k = .14, n = 96) {           // astroid blend: sharp tips, concave sides
  const out = [];
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); out.push([cx + r * (k * c + (1 - k) * c * c * c), cy + r * (k * s + (1 - k) * s * s * s)]); }
  return out;
}
// Any closed path as a pencil-annotated mark: flat fill (accent colour bypasses the ramp) + graphite hatching + hand outline.
export function inkShape(g, path, o = {}) {
  const { fill = null, value = null, stroke = P.ink, hatch = .5, progress = 1, seed = 3, width = 1.6 } = o;
  const col = fill || (value !== null ? valueColor(value) : null);
  if (col && progress > 0) {
    g.save(); g.globalAlpha *= clamp(progress * 1.5); g.beginPath(); g.moveTo(...path[0]); for (const p of path.slice(1)) g.lineTo(...p); g.closePath(); g.fillStyle = col; g.fill();
    if (hatch > 0) {                                                 // light graphite hatching clipped to the shape
      g.clip(); const xs = path.map(p => p[0]), ys = path.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      g.strokeStyle = 'rgba(40,30,20,.12)'; g.lineWidth = 1;
      for (let x = x0 - (y1 - y0); x < x1; x += 7) { g.globalAlpha = hatch * (.5 + .5 * hash(x + seed)); g.beginPath(); g.moveTo(x, y1); g.lineTo(x + (y1 - y0), y0); g.stroke(); }
    }
    g.restore();
  }
  return pencilStroke(g, [...path, path[0]], { color: stroke, width, progress, seed, passes: 2, wobble: .35 });
}
// A trail of data dots behind a moving mark (cursor tail / comet): sizes and alpha taper toward the tail.
export function dotTrail(g, pts, o = {}) {
  const { color = P.ink, r0 = 6, r1 = 1.5, ring = true } = o, n = pts.length;
  pts.forEach((p, i) => { const f = i / Math.max(1, n - 1); dataDot(g, p[0], p[1], lerp(r1, r0, f), color, { alpha: .25 + .75 * f, ring: ring ? P.ink : color, ringW: ring ? 1.2 : 0, ripple: 0 }); });
}
