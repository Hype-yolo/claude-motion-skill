// Seeded proportion variation as smooth spatial warps.
//
// Species sculpt and paint in their own reference space. Per-individual proportions (longer legs,
// a bigger head, a longer body) are applied afterwards as a smooth warp of the finished, skinned,
// painted mesh and of the skeleton, so one sculpt serves every individual and the coat pattern is
// carried along with the skin instead of being re-grown. Warps are small (a few to ~15 %).
//
// Warp specs (all optional, composed in order):
//  { type: 'legs', k, top }                  stretch y below `top` by k (everything above moves up)
//  { type: 'length', k, z0, z1 }             stretch z between z0 and z1 (torso length)
//  { type: 'scaleAbout', c, k, r0, r1 }      scale by k about c, fading out between radius r0 and r1
//  { type: 'girth', k, y0, y1, zRange }      scale x (and y about the torso centre) inside a region
//  { type: 'scale', k }                      uniform size
//  { type: 'shift', a, b, d }                move by d, ramping in along a -> b (smoothstep of the projection: 0
//                                            before a, 1 beyond b): a part beyond b (a head) moves rigidly and
//                                            what lies between a and b (a neck) shortens or lengthens
import { smoothstep } from '../math/vec.js';

// Integral of smoothstep(a, b, x) from -inf to z: a C2 ramp used to build C1 clamps.
const S = (z, a, b) => {
  if (z <= a) return 0;
  const w = b - a;
  if (z >= b) return w * 0.5 + (z - b);
  const u = (z - a) / w;
  return w * (u * u * u - 0.5 * u * u * u * u);
};
function one(w) {
  switch (w.type) {
    case 'scale': return (p) => [p[0] * w.k, p[1] * w.k, p[2] * w.k];
    case 'legs': {
      // y' = y + (k-1) * c(y), c' = 1 below the belly line, easing to 0 above it
      const top = w.top, k = w.k, bw = top * 0.15;
      return (p) => [p[0], p[1] + (k - 1) * (Math.max(p[1], 0) - S(p[1], top - bw, top + bw)), p[2]];
    }
    case 'length': {
      // stretches the span z0..z1 about its middle; the ends move rigidly
      const { k, z0, z1 } = w, bw = (z1 - z0) * 0.12, zc = (z0 + z1) * 0.5;
      const t = (z) => S(z, z0 - bw, z0 + bw) - S(z, z1 - bw, z1 + bw);
      const tc = t(zc);
      return (p) => [p[0], p[1], p[2] + (k - 1) * (t(p[2]) - tc)];
    }
    case 'scaleAbout': {
      const { c, k, r0, r1 } = w;
      return (p) => {
        const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2];
        const r = Math.hypot(dx, dy, dz);
        const f = 1 + (k - 1) * (1 - smoothstep(r0, r1, r));
        return [c[0] + dx * f, c[1] + dy * f, c[2] + dz * f];
      };
    }
    case 'girth': {
      const { k, cy, z0, z1, fade = 0.08 } = w;
      return (p) => {
        const f = 1 + (k - 1) * smoothstep(z0 - fade, z0 + fade, p[2]) * (1 - smoothstep(z1 - fade, z1 + fade, p[2])) * smoothstep(cy * 0.35, cy * 0.7, p[1]);
        return [p[0] * f, cy + (p[1] - cy) * f, p[2]];
      };
    }
    case 'shift': {
      const { a, b, d } = w;
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
      return (p) => {
        const f = smoothstep(0, 1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2);
        return [p[0] + d[0] * f, p[1] + d[1] * f, p[2] + d[2] * f];
      };
    }
    default: throw new Error('unknown warp ' + w.type);
  }
}

export function composeWarps(list = []) {
  const fs = list.filter(Boolean).map(one);
  if (!fs.length) return null;
  return (p) => { for (const f of fs) p = f(p); return p; };
}

// Applies a warp to positions (in place) and re-orients normals with the warp's Jacobian
// (finite differences, inverse transpose).
export function warpMesh(pos, nrm, f, eps = 0.002) {
  const n = pos.length / 3;
  for (let v = 0; v < n; v++) {
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    const q = f(p);
    const jx = f([p[0] + eps, p[1], p[2]]), jy = f([p[0], p[1] + eps, p[2]]), jz = f([p[0], p[1], p[2] + eps]);
    // columns of the Jacobian
    const a = [(jx[0] - q[0]) / eps, (jx[1] - q[1]) / eps, (jx[2] - q[2]) / eps];
    const b = [(jy[0] - q[0]) / eps, (jy[1] - q[1]) / eps, (jy[2] - q[2]) / eps];
    const c = [(jz[0] - q[0]) / eps, (jz[1] - q[1]) / eps, (jz[2] - q[2]) / eps];
    // inverse transpose applied to n = cofactor matrix * n (up to scale)
    const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
    const bc = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
    const ca = [c[1] * a[2] - c[2] * a[1], c[2] * a[0] - c[0] * a[2], c[0] * a[1] - c[1] * a[0]];
    const ab = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    let mx = bc[0] * nx + ca[0] * ny + ab[0] * nz;
    let my = bc[1] * nx + ca[1] * ny + ab[1] * nz;
    let mz = bc[2] * nx + ca[2] * ny + ab[2] * nz;
    const l = Math.hypot(mx, my, mz) || 1;
    pos[v * 3] = q[0]; pos[v * 3 + 1] = q[1]; pos[v * 3 + 2] = q[2];
    nrm[v * 3] = mx / l; nrm[v * 3 + 1] = my / l; nrm[v * 3 + 2] = mz / l;
  }
}

// local isotropic scale of the warp at p (cube root of the Jacobian determinant)
export function warpScaleAt(f, p, eps = 0.002) {
  const q = f(p);
  const jx = f([p[0] + eps, p[1], p[2]]), jy = f([p[0], p[1] + eps, p[2]]), jz = f([p[0], p[1], p[2] + eps]);
  const a = [(jx[0] - q[0]) / eps, (jx[1] - q[1]) / eps, (jx[2] - q[2]) / eps];
  const b = [(jy[0] - q[0]) / eps, (jy[1] - q[1]) / eps, (jy[2] - q[2]) / eps];
  const c = [(jz[0] - q[0]) / eps, (jz[1] - q[1]) / eps, (jz[2] - q[2]) / eps];
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  return Math.cbrt(Math.abs(det));
}

