// lowpoly.mjs — faceted flat-vector illustration (the "poster landscape" look): every mass is cut into
// triangles, each triangle lit as a flat plane from one light direction and coloured from a gradient ramp.
// No outlines. Depth comes from layers that fade toward the sky colour (atmospheric perspective).
//
//   const rock = facetMass(W, H, polygon, { ramp: RAMPS.canyon, light: [-.7, -.5, .5], cell: 38, dome: [cx, halfWidth] })
//   ctx.drawImage(rock, 0, 0)                 // bake once in setup(), blit every frame
//
// ramp: colours from shadow to lit. The shading value is (normal · light), bent by `contrast`, darkened
// toward the bottom by `bottomDark`, and pulled toward `haze` by `fade` for distant layers.
import { createCanvas, clamp, lerp, hash } from "./core.mjs";

export const RAMPS = {
  canyon: ["#2A0F2E", "#5A1840", "#9C2A4A", "#D8452F", "#F2702A", "#FF9A3C"],
  dusk: ["#2B1B45", "#4B2A63", "#7A3A78", "#B14E7A", "#E07A6E", "#F7B18A"],
  mesa: ["#3A1A2A", "#6B2A3A", "#A8434A", "#D46A4A", "#EE9A5E", "#F9C88A"],
  forest: ["#0F2A2A", "#18423A", "#24604A", "#3C8A5A", "#6BB06A", "#A8D48A"],
  ice: ["#1E2A4A", "#2E4A7A", "#4A76A8", "#7AA8D0", "#B8D8EC", "#EEF6FA"],
  water: ["#1A2450", "#2A3C78", "#3E5E9C", "#5E86BC", "#9CB8DA", "#DCE8F4"],
  balloon: ["#6A2A1E", "#A8452E", "#D2633E", "#E8835A", "#F4A97E", "#FFD0B0"],
  cloud: ["#B88A9C", "#D2A6B0", "#E8C4C4", "#F6DCD4", "#FFEDE4", "#FFF8F2"],
};
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export function rampColor(ramp, v) { const k = clamp(v) * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(k)), f = k - i, a = hexRgb(ramp[i]), b = hexRgb(ramp[i + 1]); return a.map((c, j) => Math.round(lerp(c, b[j], f))); }
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const mix = (a, b, k) => a.map((v, i) => Math.round(lerp(v, b[i], k)));

// 2-D value noise, fractal
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash(a * 157.31 + b * 311.7 + s * 17.17); return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v); }
export const fbm = (x, y, s = 1) => (vnoise(x, y, s) * .6 + vnoise(x * 2.1, y * 2.1, s + 3) * .3 + vnoise(x * 4.3, y * 4.3, s + 7) * .1);

// Bake a faceted mass into its own canvas (size W×H, polygon in that canvas's coordinates).
// opts: ramp, light [x,y,z] (x<0 = lit from the left), cell (facet size px), jitter (0..0.5), zAmp (relief),
//       freq (noise scale), dome [cx, halfWidth] (a rounded pillar), ridge (bias: brighter near the top),
//       bottomDark (0..1), contrast, fade (0..1 toward haze), haze (hex), seed
export function facetMass(W, H, poly, o = {}) {
  const { ramp = RAMPS.canyon, light = [-.7, -.55, .45], cell = 56, jitter = .22, zAmp = 55, freq = .004, dome = null, ridge = .25, bottomDark = .45, contrast = 1.15, fade = 0, haze = "#F4E6D8", seed = 1 } = o;
  const c = createCanvas(W, H), x = c.getContext("2d");
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [px, py] of poly) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
  x0 -= cell; y0 -= cell; x1 += cell; y1 += cell;
  const nx = Math.ceil((x1 - x0) / cell) + 1, ny = Math.ceil((y1 - y0) / cell) + 1, P = [];
  const L = Math.hypot(...light), lx = light[0] / L, ly = light[1] / L, lz = light[2] / L, hz = hexRgb(haze);
  const z = (px, py) => { let v = fbm(px * freq, py * freq, seed) * zAmp; if (dome) { const d = clamp(1 - Math.pow((px - dome[0]) / dome[1], 2), 0, 1); v += Math.sqrt(d) * dome[1] * .9; } return v; };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const jx = (hash(i * 7.1 + j * 13.3 + seed) - .5) * 2 * jitter * cell, jy = (hash(i * 3.7 + j * 5.9 + seed * 2) - .5) * 2 * jitter * cell;
    const px = x0 + i * cell + (j % 2 ? cell / 2 : 0) + jx, py = y0 + j * cell + jy; P.push([px, py, z(px, py)]); }
  x.save(); x.beginPath(); poly.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.clip();
  const tri = (a, b, d) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let Nx = uy * vz - uz * vy, Ny = uz * vx - ux * vz, Nz = ux * vy - uy * vx; if (Nz < 0) { Nx = -Nx; Ny = -Ny; Nz = -Nz; } const n = Math.hypot(Nx, Ny, Nz) || 1;
    let v = (Nx * lx + Ny * ly + Nz * lz) / n; v = clamp((v - .1) * contrast + .45);
    const cy = (a[1] + b[1] + d[1]) / 3, depth = clamp((cy - y0) / (y1 - y0)); v = clamp(v + ridge * (1 - depth) * .5 - bottomDark * depth * .6);
    let col = rampColor(ramp, v); if (fade) col = mix(col, hz, fade);
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(d[0], d[1]); x.closePath(); x.fillStyle = rgb(col); x.fill(); x.strokeStyle = rgb(col); x.lineWidth = 1.2; x.stroke(); };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = P[j * nx + i], b = P[j * nx + i + 1], d = P[(j + 1) * nx + i], e = P[(j + 1) * nx + i + 1];
    if ((i + j) % 2) { tri(a, b, e); tri(a, e, d); } else { tri(a, b, d); tri(b, e, d); } }
  x.restore(); return c;
}
// ridge line helper: a mountain-range outline from control heights, closed down to `base`
export function ridge(x0, x1, base, heights, seed = 1, rough = 18) {
  const P = [[x0, base]], n = heights.length; for (let i = 0; i <= 60; i++) { const u = i / 60, k = u * (n - 1), a = Math.floor(k), f = k - a, h = lerp(heights[a], heights[Math.min(n - 1, a + 1)], f * f * (3 - 2 * f));
    P.push([lerp(x0, x1, u), h + (hash(i * 3.3 + seed) - .5) * rough]); } P.push([x1, base]); return P;
}
// a smooth sky: vertical stops [[0, "#hex"], [1, "#hex"]] plus a sun glow
export function skyGradient(ctx, W, H, stops, sun = null) {
  const g = ctx.createLinearGradient(0, 0, 0, H); for (const [o, c] of stops) g.addColorStop(o, c); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (sun) { const [sx, sy, r, col] = sun, gl = ctx.createRadialGradient(sx, sy, r * .6, sx, sy, r * 5); gl.addColorStop(0, col + "AA"); gl.addColorStop(1, col + "00"); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); }
}
// a faceted cloud baked to its own canvas
export function facetCloud(w, h, seed = 1, ramp = RAMPS.cloud) {
  // a union of 4-5 domes on a flat base, sampled into one outline
  const bumps = Array.from({ length: 5 }, (_, i) => [w * (.14 + i * .18 + (hash(i + seed) - .5) * .06), h * (.28 + .5 * hash(i * 3 + seed)) * (i === 0 || i === 4 ? .6 : 1), w * (.13 + .06 * hash(i * 5 + seed))]);
  const top = (x) => { let y = h; for (const [cx, r, rw] of bumps) { const d = (x - cx) / rw; if (Math.abs(d) < 1) y = Math.min(y, h - r * Math.sqrt(1 - d * d) - h * .12); } return y; };
  const P = [[w * .04, h]]; for (let i = 0; i <= 60; i++) { const x = w * (.04 + .92 * i / 60); P.push([x, top(x)]); } P.push([w * .96, h]);
  return facetMass(w, h + 4, P, { ramp, light: [-.4, -.8, .5], cell: 34, zAmp: 20, dome: [w / 2, w * .46], bottomDark: .05, ridge: .6, contrast: .7, seed });
}
