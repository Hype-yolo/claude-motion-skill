// Tiny allocation-light vector helpers used by the procedural modelling code.
// Vectors are plain [x, y, z] arrays.

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mirror = (a) => [-a[0], a[1], a[2]];
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const mix = (a, b, t) => a + (b - a) * t;

// Orthonormal frame from a primary axis (becomes local Z) and an up hint (local Y).
export function frameZY(zDir, upHint = [0, 1, 0]) {
  const z = norm(zDir);
  let x = cross(upHint, z);
  if (len(x) < 1e-6) x = cross([1, 0, 0], z);
  x = norm(x);
  const y = cross(z, x);
  return [x, y, z];
}

// Deterministic PRNG (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer hash based value noise (identical implementation exists in GLSL: see noise.glsl in shaders.js)
export function ihash(x, y, z) {
  let h = (Math.imul(x | 0, 0x8da6b343) ^ Math.imul(y | 0, 0xd8163841) ^ Math.imul(z | 0, 0xcb1ab31f)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967296;
}

export function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c000 = ihash(xi, yi, zi), c100 = ihash(xi + 1, yi, zi);
  const c010 = ihash(xi, yi + 1, zi), c110 = ihash(xi + 1, yi + 1, zi);
  const c001 = ihash(xi, yi, zi + 1), c101 = ihash(xi + 1, yi, zi + 1);
  const c011 = ihash(xi, yi + 1, zi + 1), c111 = ihash(xi + 1, yi + 1, zi + 1);
  const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

export function fbm3(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise3(x * f + i * 17.3, y * f - i * 9.1, z * f + i * 3.7);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}
