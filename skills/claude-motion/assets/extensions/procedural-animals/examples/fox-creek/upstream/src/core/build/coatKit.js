// Helpers for species coat painters.
import { SDFModel } from '../sdf/sdf.js';
import { sub, add, mul, dot, len, clamp, mix } from '../math/vec.js';

// sRGB hex -> linear rgb
export const srgb = (hex) => {
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => v / 255);
  return c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
};
export const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
export const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// Material ids stored in tint.w (see render/coatMaterial.js)
export const MAT = { FUR: 0, NOSE: 1, DARK_SKIN: 2, MOUTH: 3, SKIN: 4, KERATIN: 5, SCALES: 6, WET_SKIN: 7, CHITIN: 8, FEATHER: 9, VANE: 10, FIN: 11 }; // 10: flight-feather vane (featherCards.js), 11: fin membrane (render/membranes.js)

// Newton-project a point onto the zero set of a primitive list
export function projectToSurface(prims, q, iters = 6) {
  let x = q.slice();
  for (let i = 0; i < iters; i++) {
    const d = SDFModel.evalList(prims, x[0], x[1], x[2]);
    const e = 0.0005;
    const g = [
      SDFModel.evalList(prims, x[0] + e, x[1], x[2]) - d,
      SDFModel.evalList(prims, x[0], x[1] + e, x[2]) - d,
      SDFModel.evalList(prims, x[0], x[1], x[2] + e) - d,
    ].map((c) => c / e);
    const gl = len(g) || 1;
    x = sub(x, mul(g, d / (gl * gl)));
  }
  return x;
}

// distance from p to a polyline with per-vertex half widths (negative inside)
export function distPolyline(p, poly, widths) {
  let best = 1e9;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1], ab = sub(b, a);
    const t = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0, 1);
    const d = len(sub(p, add(a, mul(ab, t)))) - mix(widths[i], widths[i + 1], t);
    if (d < best) best = d;
  }
  return best;
}

// Laplacian smoothing of a scalar field over the mesh graph; `lock(v)` keeps a vertex fixed
export function smoothField(f, neighbors, iters = 2, lock = null) {
  const n = f.length, tmp = new Float32Array(n);
  for (let it = 0; it < iters; it++) {
    for (let v = 0; v < n; v++) {
      const ns = neighbors[v];
      if (!ns.length || (lock && lock(v))) { tmp[v] = f[v]; continue; }
      let a = 0;
      for (const u of ns) a += f[u];
      tmp[v] = 0.5 * f[v] + (0.5 * a) / ns.length;
    }
    f.set(tmp);
  }
  return f;
}

// Poisson-disc features grown on the surface. radius(v) -> r (0 = no feature here);
// returns { spots, grid, cell, key } for use with featureField.
export function poissonFeatures({ pos, nrm, nV, radius, R, spacing = 1.52, gap = 0.0025, cell = 0.03, skip = null, extra = null }) {
  const order = new Uint32Array(nV);
  for (let i = 0; i < nV; i++) order[i] = i;
  for (let i = nV - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  const grid = new Map();
  const key = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  const spots = [];
  for (let k = 0; k < nV; k++) {
    const v = order[k];
    if (skip && skip(v)) continue;
    let r = radius(v);
    if (!(r > 0)) continue;
    r *= 0.78 + 0.44 * R();
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), gz = Math.floor(p[2] / cell);
    let ok = true;
    for (let dz = -1; dz <= 1 && ok; dz++)
      for (let dy = -1; dy <= 1 && ok; dy++)
        for (let dx = -1; dx <= 1 && ok; dx++) {
          const arr = grid.get(key(gx + dx, gy + dy, gz + dz));
          if (!arr) continue;
          for (const s of arr) {
            const minD = spacing * (r + s.r) + gap;
            const ddx = p[0] - s.p[0], ddy = p[1] - s.p[1], ddz = p[2] - s.p[2];
            if (ddx * ddx + ddy * ddy + ddz * ddz < minD * minD) { ok = false; break; }
          }
        }
    if (!ok) continue;
    const s = { v, p, r, n: [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]], ...(extra ? extra(v, R) : {}) };
    spots.push(s);
    const kk = key(gx, gy, gz);
    (grid.get(kk) || grid.set(kk, []).get(kk)).push(s);
  }
  return { spots, grid, cell, key };
}

// Signed distance to the nearest feature of a poissonFeatures() set, elongated along each
// feature's comb direction `c` by `el`. Returns [sdf, feature].
export function featureDistance(F, p, n, wob = 1) {
  const { grid, cell, key } = F;
  let best = 1e9, bs = null;
  const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), gz = Math.floor(p[2] / cell);
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const arr = grid.get(key(gx + dx, gy + dy, gz + dz));
        if (!arr) continue;
        for (const s of arr) {
          if (dot(s.n, n) < 0.2) continue;
          const d = sub(p, s.p);
          const el = s.el || 1;
          const along = s.c ? dot(d, s.c) : 0;
          const dd = Math.sqrt(Math.max(0, dot(d, d) - along * along * (1 - 1 / (el * el))));
          const sd = dd - s.r * wob;
          if (sd < best) { best = sd; bs = s; }
        }
      }
  return [best, bs];
}
