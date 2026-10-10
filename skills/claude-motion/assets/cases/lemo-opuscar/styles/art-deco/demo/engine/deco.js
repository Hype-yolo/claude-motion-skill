// Art Deco engine · core drawing primitives (palette, metal gold, gold line, airbrush fills, ornaments).
// Every function takes the 2D context `g` first and never keeps global state, so it can draw into any canvas.
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const eo = t => 1 - Math.pow(1 - clamp(t), 3);
export const ei = t => Math.pow(clamp(t), 3);
export const back = (t, s = 1.7) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
export function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// ---------- palette ----------
export const C = {
  ink: '#060504',        // deepest black (lacquer)
  black: '#0d0b09',      // warm black ground
  night: '#0a0e16',      // night sky black-blue
  gold0: '#6f5220',      // shadow gold
  gold1: '#c9a24b',      // base gold   (brief: #C9A24B → #F3D98B)
  gold2: '#f3d98b',      // light gold
  goldHi: '#fff4d2',     // specular
  ivory: '#f2e8d5',
  ivoryD: '#cbbd9f',
  emerald: '#1d6b57', emeraldD: '#0c3a2f', emeraldL: '#3f9a7f',
  burg: '#8e1b2e', burgD: '#4a0c17', burgL: '#c23a4e',
  plum: '#2b2130', plumL: '#51405a',
  skin: '#eebd92', skinD: '#c48762', skinL: '#fbd8b4',
  bulb: '#ffe6a3', bulbCore: '#fffaf0', bulbGlow: '255,196,92',
};

const hx = h => { h = h.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return parseInt(h, 16); };
export function rgba(hex, a) {
  const n = hx(hex);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
export function mix(h1, h2, t) {
  const a = hx(h1), b = hx(h2);
  const r = Math.round(lerp(a >> 16 & 255, b >> 16 & 255, t)), gg = Math.round(lerp(a >> 8 & 255, b >> 8 & 255, t)), bb = Math.round(lerp(a & 255, b & 255, t));
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | bb).toString(16).slice(1);
}

// ---------- metal gold ----------
// Banded metallic gradient along the segment (x0,y0)->(x1,y1). `sheen` (0..1) slides the bright band (animate it for a glint sweep).
export function goldGrad(g, x0, y0, x1, y1, { sheen = .38, hot = 1, tint = null } = {}) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  const G0 = tint ? mix(C.gold0, tint, .55) : C.gold0, G1 = tint ? mix(C.gold1, tint, .45) : C.gold1, G2 = tint ? mix(C.gold2, tint, .3) : C.gold2;
  const s = clamp(sheen, .08, .92);
  gr.addColorStop(0, G0);
  gr.addColorStop(clamp(s - .3), G1);
  gr.addColorStop(clamp(s - .08), G2);
  gr.addColorStop(s, hot > .5 ? C.goldHi : G2);
  gr.addColorStop(clamp(s + .1), G1);
  gr.addColorStop(clamp(s + .32), G0);
  gr.addColorStop(1, G1);
  return gr;
}
// Solid-ish gold for small things (keeps the metal feel without a per-shape gradient).
export function goldFlat(g, x, y, r, sheen = .35) { return goldGrad(g, x - r, y - r, x + r, y + r, { sheen }); }

// ---------- paths ----------
export function toPath(pts, closed = false) {
  if (pts instanceof Path2D) return pts;
  const p = new Path2D();
  pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]));
  if (closed) p.closePath();
  return p;
}
// Mitred parallel offset of a polyline (positive d = left of travel direction).
export function offsetPoly(pts, d, closed = false) {
  const n = pts.length, out = [];
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
  for (let i = 0; i < n; i++) {
    const pv = i > 0 ? pts[i - 1] : (closed ? pts[n - 2] : null), nx = i < n - 1 ? pts[i + 1] : (closed ? pts[1] : null);
    let m;
    if (pv && nx) { const a = nrm(pv, pts[i]), b = nrm(pts[i], nx); const s = [a[0] + b[0], a[1] + b[1]], L = Math.hypot(s[0], s[1]) || 1; const cos = (s[0] * a[0] + s[1] * a[1]) / L; m = [s[0] / L / Math.max(.25, cos), s[1] / L / Math.max(.25, cos)]; }
    else m = pv ? nrm(pv, pts[i]) : nrm(pts[i], nx);
    out.push([pts[i][0] + m[0] * d, pts[i][1] + m[1] * d]);
  }
  return out;
}
export function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
// Leading part of a polyline (0..1 of its length) — "the gold line draws itself".
export function polyPart(pts, f) {
  if (f >= 1) return pts; if (f <= 0) return [pts[0]];
  const L = polyLen(pts) * f; let acc = 0; const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= L) { const k = (L - acc) / d; out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]); return out; }
    acc += d; out.push(pts[i]);
  }
  return out;
}
export function arcPts(cx, cy, r, a0, a1, n = 48, ry = r) { const o = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * ry]); } return o; }
export function rectPts(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]; }

// ---------- gold line ----------
// The signature stroke: a thin gold line with an engraved dark underline and a hairline highlight.
// opts: w (px), part (0..1 draw-on), double (gap px: a parallel twin line), glow (0..1), sheen, closed, alpha, color (override: any hex = "the one colour").
export function gline(g, pts, o = {}) {
  const { w = 2.4, part = 1, closed = false, glow = 0, sheen = .38, alpha = 1, color = null, cap = 'butt', bb = null } = o;
  let P = pts;
  if (!(pts instanceof Path2D) && part < 1) P = polyPart(closed ? [...pts, pts[0]] : pts, part);
  const path = P instanceof Path2D ? P : toPath(P, closed && part >= 1);
  g.save(); g.globalAlpha *= alpha; g.lineCap = cap; g.lineJoin = 'miter'; g.miterLimit = 6;
  // gradient extent
  let x0 = 0, y0 = 0, x1 = g.canvas.width, y1 = g.canvas.height;
  if (bb) [x0, y0, x1, y1] = bb;
  if (glow > 0) {
    g.shadowColor = color ? rgba(color, .8 * glow) : `rgba(255,205,110,${.75 * glow})`; g.shadowBlur = 14 * glow + w * 2;
    g.strokeStyle = color || C.gold1; g.lineWidth = w; g.stroke(path); g.shadowBlur = 0;
  }
  g.strokeStyle = color ? mix(color, '#000000', .55) : C.gold0; g.lineWidth = w + 1.6; g.globalAlpha *= .85; g.stroke(path); g.globalAlpha /= .85;
  g.strokeStyle = color ? color : goldGrad(g, x0, y0, x1, y1, { sheen }); g.lineWidth = w; g.stroke(path);
  if (w >= 2) { g.strokeStyle = color ? mix(color, '#ffffff', .55) : 'rgba(255,246,214,.55)'; g.lineWidth = Math.max(.6, w * .28); g.stroke(path); }
  if (o.double && !(pts instanceof Path2D)) {  // parallel twin lines at ±gap (mitred offsets)
    const gap = o.double; const base = part < 1 ? P : pts;
    for (const d of [-gap, gap]) { const q = offsetPoly(base, d, closed && part >= 1); const qp = toPath(q, closed && part >= 1);
      g.strokeStyle = color || goldGrad(g, x0, y0, x1, y1, { sheen: sheen + .15 }); g.lineWidth = w * .6; g.stroke(qp); }
  }
  g.restore();
}
// Cheap multi-line: n parallel offsets of a straight segment (for piers, rules and bands).
export function rules(g, x0, y0, x1, y1, n = 3, gap = 6, w = 1.6, o = {}) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 0; i < n; i++) { const k = (i - (n - 1) / 2) * gap; gline(g, [[x0 + nx * k, y0 + ny * k], [x1 + nx * k, y1 + ny * k]], { w: i === (n - 1) / 2 ? w * 1.4 : w, ...o }); }
}

// ---------- airbrush fill (Cassandre) ----------
// A hard-edged shape with a soft gradient inside. `light` = direction the light comes from (radians, 0 = from the right, -PI/2 = from the top).
// stops: [dark, base, light] colours; `rim` adds a thin gold edge on the lit side.
export function airbrush(g, pts, { base = C.burg, dark = null, light = null, dir = -2.3, rim = 0, rimColor = null, spread = 1, closed = true, bbox = null, radial = null, alpha = 1 } = {}) {
  const path = pts instanceof Path2D ? pts : toPath(pts, closed);
  let x0, y0, x1, y1;
  if (bbox) [x0, y0, x1, y1] = bbox; else if (!(pts instanceof Path2D)) { x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } } else { x0 = 0; y0 = 0; x1 = 100; y1 = 100; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) * .5 * spread;
  const D = dark || mix(base, '#000000', .62), L = light || mix(base, '#ffffff', .38);
  let gr;
  if (radial) { const [rx, ry, rr] = radial; gr = g.createRadialGradient(rx, ry, 0, rx, ry, rr); gr.addColorStop(0, L); gr.addColorStop(.45, base); gr.addColorStop(1, D); }
  else { const ux = Math.cos(dir), uy = Math.sin(dir); gr = g.createLinearGradient(cx + ux * R, cy + uy * R, cx - ux * R, cy - uy * R); gr.addColorStop(0, L); gr.addColorStop(.42, base); gr.addColorStop(1, D); }
  g.save(); g.globalAlpha *= alpha; g.fillStyle = gr; g.fill(path);
  if (rim) {
    g.save(); g.clip(path);
    const ux = Math.cos(dir), uy = Math.sin(dir);
    g.translate(-ux * rim * 1.6, -uy * rim * 1.6);
    g.strokeStyle = rimColor || C.gold2; g.lineWidth = rim * 2; g.globalAlpha *= .9; g.stroke(path);
    g.restore();
  }
  g.restore();
  return path;
}

// ---------- ornaments ----------
// Sunburst: rays from (cx,cy). mode 'lines' (gold hairlines) | 'wedges' (alternating tone wedges) | 'both'.
export function sunburst(g, cx, cy, o = {}) {
  const { rays = 48, r0 = 0, r1 = 2400, rot = 0, mode = 'lines', w = 1.6, alpha = 1, part = 1, a0 = 0, a1 = TAU, colorA = 'rgba(201,162,75,.10)', colorB = 'rgba(0,0,0,0)', glow = 0, taper = true, sheen = .4 } = o;
  g.save(); g.globalAlpha *= alpha;
  const full = Math.abs(a1 - a0 - TAU) < 1e-6, n = rays, step = (a1 - a0) / (full ? n : n - 1 || 1);
  if (mode !== 'lines') {
    for (let i = 0; i < n; i++) {
      if (i % 2) continue;
      const a = a0 + rot + i * step, b = a + step;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(b) * r1, cy + Math.sin(b) * r1);
      g.lineTo(cx + Math.cos(b) * r0, cy + Math.sin(b) * r0); g.closePath();
      g.fillStyle = colorA; g.fill();
    }
  }
  if (mode !== 'wedges') {
    const gr = goldGrad(g, cx - r1, cy - r1, cx + r1, cy + r1, { sheen });
    if (glow) { g.shadowColor = `rgba(255,205,110,${.6 * glow})`; g.shadowBlur = 10 * glow; }
    for (let i = 0; i < n; i++) {
      const a = a0 + rot + i * step, rr = lerp(r0, r1, clamp(part * (1 + hash(i) * .0)));
      const long = i % 2 === 0;
      const re = long ? rr : lerp(r0, rr, .72);
      if (taper) {
        const half = w * .5 / Math.max(40, r0 + 40), ww = long ? 1 : .6;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        const pa = w * ww * .5, nx = -Math.sin(a), ny = Math.cos(a);
        g.lineTo(cx + Math.cos(a) * re + nx * pa * 1.8, cy + Math.sin(a) * re + ny * pa * 1.8);
        g.lineTo(cx + Math.cos(a) * re - nx * pa * 1.8, cy + Math.sin(a) * re - ny * pa * 1.8); g.closePath();
        g.fillStyle = gr; g.fill();
      } else {
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * re, cy + Math.sin(a) * re);
        g.strokeStyle = gr; g.lineWidth = long ? w : w * .6; g.stroke();
      }
    }
  }
  g.restore();
}

// Stepped (ziggurat) arch: nested outlines, each with `steps` setbacks and a round or pointed crown.
// Returns the inner opening polygon (use it as a clip / window).
export function stepArchPts(cx, base, w, h, { steps = 3, stepW = null, stepH = null, crown = 'round' } = {}) {
  const sw = stepW ?? w * .09, sh = stepH ?? h * .085;
  const pts = []; const half = w / 2;
  pts.push([cx - half, base]);
  let x = cx - half, y = base - (h - steps * sh - (crown === 'round' ? (half - steps * sw) : (half - steps * sw) * .9));
  pts.push([x, y]);
  for (let i = 0; i < steps; i++) { x += sw; pts.push([x, y]); y -= sh; pts.push([x, y]); }
  const r = cx - x;
  if (crown === 'round') { for (let i = 1; i < 32; i++) { const a = Math.PI + Math.PI * i / 32; pts.push([cx + Math.cos(a) * r, y + Math.sin(a) * r]); } }
  else if (crown === 'point') { pts.push([cx, y - r * .9]); }
  else if (crown === 'flat') { pts.push([x, y - r * .25]); pts.push([cx + r, y - r * .25]); }
  const R = []; for (let i = pts.length - 1; i >= 0; i--) R.push([2 * cx - pts[i][0], pts[i][1]]);
  // mirror right half (skip duplicate top)
  const out = pts.concat(crown === 'point' ? R.slice(1) : R);
  return out;
}
// Arch frame = several nested stepped arches in gold + optional sunburst in the lunette.
export function archFrame(g, cx, base, w, h, o = {}) {
  const { rings = 3, gap = 14, steps = 3, crown = 'round', part = 1, fill = null, burst = true, glow = 0, sheen = .4, lw = 2.4 } = o;
  const inner = stepArchPts(cx, base, w - rings * gap * 2, h - rings * gap, { steps, crown });
  if (fill) { g.save(); g.fillStyle = fill; g.fill(toPath(inner, true)); g.restore(); }
  if (burst) {
    g.save(); g.clip(toPath(inner, true));
    const top = Math.min(...inner.map(p => p[1]));
    sunburst(g, cx, base, { rays: 36, r0: 0, r1: (base - top) * 1.2 * part, a0: Math.PI, a1: TAU, mode: 'lines', w: 1.4, alpha: .45 * part, sheen });
    g.restore();
  }
  for (let i = 0; i <= rings; i++) {
    const pts = stepArchPts(cx, base, w - i * gap * 2, h - i * gap, { steps, crown });
    gline(g, pts, { w: i === 0 ? lw * 1.3 : lw * .8, part, glow: i === 0 ? glow : 0, sheen: sheen + i * .05 });
  }
  return inner;
}

// Fan (scallop) — the deco fan motif. Opens from 0..1.
export function fan(g, cx, cy, r, o = {}) {
  const { a0 = Math.PI, a1 = TAU, ribs = 9, open = 1, fill = C.gold1, line = true, rot = 0, ring = .32 } = o;
  const mid = (a0 + a1) / 2, h = (a1 - a0) / 2 * open, A0 = mid - h + rot, A1 = mid + h + rot;
  g.save();
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, mix(fill, '#000', .5)); gr.addColorStop(.6, fill); gr.addColorStop(1, mix(fill, '#fff', .35));
  g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, A0, A1); g.closePath(); g.fillStyle = gr; g.fill();
  if (line) {
    for (let i = 0; i <= ribs; i++) { const a = lerp(A0, A1, i / ribs); gline(g, [[cx + Math.cos(a) * r * ring, cy + Math.sin(a) * r * ring], [cx + Math.cos(a) * r, cy + Math.sin(a) * r]], { w: 1.2 }); }
    gline(g, arcPts(cx, cy, r, A0, A1, 40), { w: 2 }); gline(g, arcPts(cx, cy, r * ring, A0, A1, 20), { w: 1.4 });
  }
  g.restore();
}

// Fish-scale (imbricated scallops) pattern filling a rect; `r` = scale radius.
export function fishScale(g, x, y, w, h, r, { stroke = 'rgba(201,162,75,.7)', fillA = '#0e0c09', fillB = null, lw = 1.3 } = {}) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const dy = r * .62; let row = 0;
  for (let yy = y - r; yy < y + h + r; yy += dy, row++) {       // later (lower) rows overlap the ones above
    const off = (row % 2) * r;
    for (let xx = x - 2 * r + off; xx < x + w + 2 * r; xx += 2 * r) {
      g.beginPath(); g.arc(xx, yy, r, 0, Math.PI); g.closePath();
      const k = ((row * 7 + Math.round((xx - x) / r) * 3) % 5);
      g.fillStyle = fillB && k === 0 ? fillB : fillA; g.fill();
      g.beginPath(); g.arc(xx, yy, r, 0, Math.PI); g.strokeStyle = stroke; g.lineWidth = lw; g.stroke();
      g.beginPath(); g.arc(xx, yy, r * .62, Math.PI * .15, Math.PI * .85); g.lineWidth = lw * .6; g.stroke();
    }
  }
  g.restore();
}

// Chevron band (V-shapes) between x0..x1 at y, pointing down.
export function chevrons(g, x0, x1, y, { n = 8, h = 20, w = 1.6, rows = 3, gap = 8, color = null } = {}) {
  const step = (x1 - x0) / n;
  for (let r = 0; r < rows; r++) {
    const pts = []; const yy = y + r * gap;
    for (let i = 0; i <= n; i++) pts.push([x0 + i * step, yy + (i % 2 ? h : 0)]);
    gline(g, pts, { w, color });
  }
}

// Four-point glint star (Gatsby sparkle).
export function sparkle(g, x, y, r, { rot = 0, alpha = 1, color = C.goldHi, glow = 1 } = {}) {
  if (r <= 0 || alpha <= 0) return;
  g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.rotate(rot);
  if (glow) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.2); gr.addColorStop(0, rgba(color, .55)); gr.addColorStop(1, rgba(color, 0)); g.fillStyle = gr; g.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4); }
  g.beginPath();
  const k = r * .16;
  g.moveTo(0, -r); g.quadraticCurveTo(k, -k, r, 0); g.quadraticCurveTo(k, k, 0, r); g.quadraticCurveTo(-k, k, -r, 0); g.quadraticCurveTo(-k, -k, 0, -r);
  g.fillStyle = color; g.fill();
  g.restore();
}

// Cassandre speed lines: parallel tapering gold lines trailing behind a moving point along direction `ang`.
export function speedLines(g, x, y, ang, { n = 5, len = 260, spread = 40, w = 2.2, color = null, alpha = 1, seed = 1 } = {}) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux; const R = mulberry(seed);
  g.save(); g.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) / Math.max(1, (n - 1) / 2) * spread * .5, L = len * (.55 + .45 * R()), st = R() * len * .15;
    const sx = x - ux * st + nx * o, sy = y - uy * st + ny * o;
    const gr = g.createLinearGradient(sx, sy, sx - ux * L, sy - uy * L);
    const c = color || C.gold2; gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(1, rgba(c, 0));
    g.beginPath(); g.moveTo(sx + nx * w * .5, sy + ny * w * .5); g.lineTo(sx - ux * L, sy - uy * L); g.lineTo(sx - nx * w * .5, sy - ny * w * .5); g.closePath();
    g.fillStyle = gr; g.fill();
  }
  g.restore();
}

// Soft light pool / uplight glow (airbrush).
export function glow(g, x, y, r, color = '#ffc86a', a = .5, sy = 1) {
  g.save(); g.translate(x, y); g.scale(1, sy);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, rgba(color, a)); gr.addColorStop(.4, rgba(color, a * .35)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore();
}
// Searchlight beam (airbrush cone).
export function beam(g, x, y, ang, len, wid, a = .22, color = '#f6ecd0') {
  g.save(); g.translate(x, y); g.rotate(ang);
  const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, rgba(color, a)); gr.addColorStop(1, rgba(color, 0));
  g.beginPath(); g.moveTo(0, -wid * .06); g.lineTo(len, -wid / 2); g.lineTo(len, wid / 2); g.lineTo(0, wid * .06); g.closePath(); g.fillStyle = gr; g.fill();
  g.restore();
}

// Vignette + warm black ground.
export function ground(g, W = 1920, H = 1080, { top = C.black, bot = C.ink, vig = .55 } = {}) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (vig) vignette(g, W, H, vig);
}
export function vignette(g, W = 1920, H = 1080, a = .55) {
  const gr = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}

// ---------- any shape in this style ----------
// Draw an arbitrary path the Art Deco way: airbrushed fill + gold keyline + optional sunburst halo, speed-line trail, glints.
// `color` keeps its own hue (this is the "one colour" door: e.g. '#D97757' stays orange while everything else is gold/black/ivory).
export function drawShape(g, pts, o = {}) {
  const { color = null, gold = true, closed = true, halo = 0, trail = null, glints = 0, lw = 2.6, dir = -2.3, part = 1, sheen = .4 } = o;
  const path = pts instanceof Path2D ? pts : toPath(pts, closed);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  if (!(pts instanceof Path2D)) for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) / 2;
  if (halo) { sunburst(g, cx, cy, { rays: 32, r0: R * 1.1, r1: R * (1.1 + 1.6 * halo), mode: 'lines', w: 2, alpha: .8 }); glow(g, cx, cy, R * 2.4, color || '#ffcf7a', .35 * halo); }
  if (trail) speedLines(g, trail.x ?? cx, trail.y ?? cy, trail.ang ?? Math.PI, { n: trail.n ?? 5, len: trail.len ?? R * 5, spread: trail.spread ?? R * 1.2, w: trail.w ?? R * .22, color: color || C.gold2, seed: trail.seed ?? 3 });
  if (closed && part >= 1) {
    if (color) airbrush(g, path, { base: color, dir, bbox: [x0, y0, x1, y1] });
    else { g.save(); g.fillStyle = goldGrad(g, x0, y0, x1, y1, { sheen }); g.fill(path); g.restore(); }
  }
  if (gold) gline(g, pts instanceof Path2D ? path : pts, { w: lw, closed, part, bb: [x0 - R, y0 - R, x1 + R, y1 + R], sheen });
  for (let i = 0; i < glints; i++) sparkle(g, lerp(x0, x1, hash(i * 3.1 + 1)), lerp(y0, y1, hash(i * 7.7 + 2)), R * .25, { alpha: .9 });
  return path;
}
// Four-pointed star path (handy for the "light point" motif).
export function starPts(cx, cy, r, k = .22, rot = 0, n = 4) {
  const o = [];
  for (let i = 0; i < n * 2; i++) { const a = rot - Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * k : r; o.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return o;
}
