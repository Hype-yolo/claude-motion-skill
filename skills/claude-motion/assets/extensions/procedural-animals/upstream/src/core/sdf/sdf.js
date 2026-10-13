// Signed distance field built from bone-attached primitives, combined with smooth unions
// (polynomial smooth-min, per-primitive blend radius) and smooth subtractions (carvers).
import { frameZY, sub, norm } from '../math/vec.js';

export const T_ELL = 0;
export const T_CONE = 1;
export const T_LENS = 2; // almond (vesica) prism along a view axis, clipped to a depth slab: eye apertures
export const T_FIN = 3; // thin slab: a planar polygon extruded to a thickness, rim rounded (fin membranes)

function sminf(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const d = a - b;
  const h = Math.max(k - Math.abs(d), 0) / k;
  return (a < b ? a : b) - h * h * k * 0.25;
}

export class SDFModel {
  constructor() {
    this.prims = [];
  }

  // Ellipsoid. axis = direction of local Z (radius r[2]), up = hint for local Y (radius r[1]).
  ell(o) {
    const [ax, ay, az] = frameZY(o.axis || [0, 0, 1], o.up || [0, 1, 0]);
    const P = new Float64Array(15);
    P.set(o.c, 0);
    P.set(ax, 3);
    P.set(ay, 6);
    P.set(az, 9);
    P[12] = o.r[0];
    P[13] = o.r[1];
    P[14] = o.r[2];
    return this._push(T_ELL, P, o);
  }

  sphere(o) {
    return this.ell({ ...o, r: [o.rad, o.rad, o.rad] });
  }

  // Round cone (tapered capsule) between a and b with radii ra, rb.
  cone(o) {
    const P = new Float64Array(12);
    const ba = sub(o.b, o.a);
    const l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
    const rr = o.ra - o.rb;
    P.set(o.a, 0);
    P.set(ba, 3);
    P[6] = l2;
    P[7] = rr;
    P[8] = l2 - rr * rr;
    P[9] = 1 / l2;
    P[10] = o.ra;
    P[11] = o.rb;
    return this._push(T_CONE, P, o);
  }

  // Almond-shaped aperture: the intersection of two cylinders of radius R whose axes run along the
  // frame's Z and are offset by -/+d along its Y (upper / lower lid arcs), clipped to zMin..zMax.
  lens(o) {
    const P = new Float64Array(16);
    P.set(o.c, 0);
    P.set(o.x, 3);
    P.set(o.y, 6);
    P.set(o.z, 9);
    P[12] = o.R;
    P[13] = o.d;
    P[14] = o.zMin;
    P[15] = o.zMax;
    return this._push(T_LENS, P, o);
  }

  // Fin membrane: a planar polygon (2D points in the plane spanned by u, v from origin o) extruded
  // to thickness t along n = u x v, with a rounded rim (radius min(round, t/2)). Exact distance, so
  // thin membranes mesh cleanly with a constant thickness right to the edge. `poly` is a closed
  // outline [[u, v], ...] (either winding).
  // Optional, for tiles of a curved sheet of varying thickness (a thick ear root thinning to its rim):
  // - `grad: [gu, gv]`: the thickness tapers linearly in the plane (t at the origin, the half thickness
  //   changing by gu / gv per metre along u / v, the rim radius in proportion);
  // - `curve: [m0, mu, mv, muu, muv, mvv]`: the slab's mid-surface is the quadric patch
  //   n = m0 + mu u + mv v + (muu u^2 + 2 muv u v + mvv v^2) / 2 over the polygon instead of the plane, so
  //   neighbouring tiles fitted to one smooth sheet join with continuous tangents (no facets).
  // The distance is then divided by sqrt(1 + (|grad| + |slope of the patch|)^2), a local Lipschitz bound
  // (approximate: exact for the plane). Without them the slab and its distance are exactly as before.
  fin(o) {
    const u = norm(o.u), n = norm(crossV(o.u, o.v)), v = crossV(n, u);
    const pts = o.poly;
    const c = o.curve && o.curve.some((x) => x) ? o.curve : null;
    const g = c || (o.grad && (o.grad[0] || o.grad[1])) ? o.grad || [0, 0] : null;
    const P = new Float64Array(15 + pts.length * 2 + (g ? 2 : 0) + (c ? 6 : 0));
    P.set(o.o, 0);
    P.set(u, 3);
    P.set(v, 6);
    P.set(n, 9);
    P[12] = o.t / 2;
    P[13] = Math.min(o.round ?? o.t / 2, o.t / 2);
    P[14] = pts.length;
    for (let i = 0; i < pts.length; i++) { P[15 + i * 2] = pts[i][0]; P[16 + i * 2] = pts[i][1]; }
    if (g) { P[15 + pts.length * 2] = g[0]; P[16 + pts.length * 2] = g[1]; }
    if (c) for (let i = 0; i < 6; i++) P[17 + pts.length * 2 + i] = c[i];
    return this._push(T_FIN, P, o);
  }

  _push(type, P, o) {
    const prim = {
      type,
      P,
      k: o.k ?? 0.02,
      bone: o.bone,
      group: o.group || 'axial',
      part: o.part || 'body',
      carve: !!o.carve,
      tag: o.tag || '',
      bias: o.bias || 0,
      id: this.prims.length,
    };
    this.prims.push(prim);
    return prim;
  }

  // Raw distance to a single primitive
  static dist(pr, x, y, z) {
    const P = pr.P;
    if (pr.type === T_ELL) {
      const dx = x - P[0], dy = y - P[1], dz = z - P[2];
      const lx = dx * P[3] + dy * P[4] + dz * P[5];
      const ly = dx * P[6] + dy * P[7] + dz * P[8];
      const lz = dx * P[9] + dy * P[10] + dz * P[11];
      const rx = P[12], ry = P[13], rz = P[14];
      const qx = lx / rx, qy = ly / ry, qz = lz / rz;
      const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
      const sx = qx / rx, sy = qy / ry, sz = qz / rz;
      const k1 = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (k1 < 1e-12) return -Math.min(rx, ry, rz);
      return (k0 * (k0 - 1)) / k1;
    } else if (pr.type === T_LENS) {
      const dx = x - P[0], dy = y - P[1], dz = z - P[2];
      const lx = dx * P[3] + dy * P[4] + dz * P[5];
      const ly = dx * P[6] + dy * P[7] + dz * P[8];
      const lz = dx * P[9] + dy * P[10] + dz * P[11];
      const R = P[12], d = P[13];
      const lens = Math.max(Math.hypot(lx, ly + d) - R, Math.hypot(lx, ly - d) - R);
      return Math.max(lens, P[14] - lz, lz - P[15]);
    } else if (pr.type === T_FIN) {
      const dx = x - P[0], dy = y - P[1], dz = z - P[2];
      const pu = dx * P[3] + dy * P[4] + dz * P[5];
      const pv = dx * P[6] + dy * P[7] + dz * P[8];
      const pn = dx * P[9] + dy * P[10] + dz * P[11];
      const gi = 15 + 2 * P[14];
      if (P.length > gi) {
        // tapered (fin({ grad })) and curved (fin({ curve })) slab: half thickness and rim radius vary linearly
        // in the plane, the mid-surface is a quadric patch over it
        const gu = P[gi], gv = P[gi + 1];
        const hh = Math.max(0.2 * P[12], P[12] + gu * pu + gv * pv), rho = Math.min(hh, (P[13] * hh) / P[12]);
        let q = pn, sl = 0;
        if (P.length > gi + 2) {
          const su = P[gi + 3] + P[gi + 5] * pu + P[gi + 6] * pv, sv = P[gi + 4] + P[gi + 6] * pu + P[gi + 7] * pv;
          q = pn - (P[gi + 2] + P[gi + 3] * pu + P[gi + 4] * pv + 0.5 * (P[gi + 5] * pu * pu + 2 * P[gi + 6] * pu * pv + P[gi + 7] * pv * pv));
          sl = Math.sqrt(su * su + sv * sv);
        }
        const ex = polySD(P, pu, pv) + rho, ey = Math.abs(q) - (hh - rho);
        const ox = ex > 0 ? ex : 0, oy = ey > 0 ? ey : 0;
        const L = Math.sqrt(gu * gu + gv * gv) + sl;
        return (Math.min(Math.max(ex, ey), 0) + Math.sqrt(ox * ox + oy * oy) - rho) / Math.sqrt(1 + L * L);
      }
      const rho = P[13];
      const ex = polySD(P, pu, pv) + rho, ey = Math.abs(pn) - (P[12] - rho);
      const ox = ex > 0 ? ex : 0, oy = ey > 0 ? ey : 0;
      return Math.min(Math.max(ex, ey), 0) + Math.sqrt(ox * ox + oy * oy) - rho;
    } else {
      // IQ exact round cone
      const pax = x - P[0], pay = y - P[1], paz = z - P[2];
      const bax = P[3], bay = P[4], baz = P[5];
      const l2 = P[6], rr = P[7], a2 = P[8], il2 = P[9], r1 = P[10], r2 = P[11];
      const yy = pax * bax + pay * bay + paz * baz;
      const zz = yy - l2;
      const vx = pax * l2 - bax * yy, vy = pay * l2 - bay * yy, vz = paz * l2 - baz * yy;
      const x2 = vx * vx + vy * vy + vz * vz;
      const y2 = yy * yy * l2;
      const z2 = zz * zz * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
    }
  }

  // Evaluate the field using only the primitives in `list` (array of prim objects, in model order)
  static evalList(list, x, y, z) {
    let d = 1e9;
    let carving = false;
    for (let i = 0; i < list.length; i++) {
      const pr = list[i];
      const di = SDFModel.dist(pr, x, y, z);
      if (!pr.carve) d = sminf(d, di, pr.k);
      else {
        carving = true;
        d = -sminf(-d, di, pr.k);
      }
    }
    return d;
  }

  forPart(part) {
    return this.prims.filter((p) => p.part === part);
  }

  // Conservative culling: primitives that cannot influence the field inside a cell (center c, radius rho)
  static cull(list, cx, cy, cz, rho, kmax) {
    const n = list.length;
    const dv = new Float64Array(n);
    let best = 1e9;
    for (let i = 0; i < n; i++) {
      dv[i] = SDFModel.dist(list[i], cx, cy, cz);
      if (!list[i].carve && dv[i] < best) best = dv[i];
    }
    const out = [];
    const margin = 2.2 * rho + 0.5 * kmax;
    for (let i = 0; i < n; i++) {
      const pr = list[i];
      if (!pr.carve) {
        if (dv[i] - best < margin + pr.k) out.push(pr);
      } else {
        // carvers only matter close to the surface
        if (dv[i] < pr.k + margin + Math.max(0, -best)) out.push(pr);
      }
    }
    return out;
  }
}

const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// signed distance to a closed 2D polygon stored in P from index 15 (count at P[14]); < 0 inside
export function polySD(P, px, py) {
  const n = P[14];
  let vx = P[15], vy = P[16];
  let d = (px - vx) * (px - vx) + (py - vy) * (py - vy);
  let s = 1;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const ix = P[15 + i * 2], iy = P[16 + i * 2], jx = P[15 + j * 2], jy = P[16 + j * 2];
    const ex = jx - ix, ey = jy - iy, wx = px - ix, wy = py - iy;
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-18)));
    const bx = wx - ex * t, by = wy - ey * t;
    const dd = bx * bx + by * by;
    if (dd < d) d = dd;
    const c1 = py >= iy, c2 = py < jy, c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  void vx; void vy;
  return s * Math.sqrt(d);
}

export function gradient(list, x, y, z, e = 0.0006) {
  // tetrahedral gradient
  const f = SDFModel.evalList;
  const a = f(list, x + e, y - e, z - e);
  const b = f(list, x - e, y - e, z + e);
  const c = f(list, x - e, y + e, z - e);
  const d = f(list, x + e, y + e, z + e);
  return [a - b - c + d, -a - b + c + d, -a + b - c + d].map((v) => v / (4 * e));
}

export { norm };
