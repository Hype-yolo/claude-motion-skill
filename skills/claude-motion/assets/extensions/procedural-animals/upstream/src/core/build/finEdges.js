// Knife-thin fin edges below the mesh cell size.
//
// A fin slab (SDFModel.fin) meshes with a rim no thinner than ~2 cells (thinner slabs alias into
// holes), so at 1 cm cells a shark's fins end in 2 cm rounded, rubbery edges. A fin primitive tagged
// `sharpen: { edge, band, rim }` has its meshed surface squeezed toward its mid-plane near its free
// outline: every vertex whose nearest fin slab is that primitive has its distance from the plane
// scaled by `edge` (e.g. 0.15) at the outline, easing back to 1 at `band` mesh cells (of the vertex's
// region, so every quality tier) inside it; the rounded rim beyond the outline is drawn in toward it
// by `rim` (0.4: to 0.4 of its width), so the squeezed edge runs straight instead of following the
// cells' sampling of the round cap. Where the fin grows out of the body (the field of the non-fin
// primitives within ~1.5-4 cells of the vertex) nothing moves, so the root fillet keeps its shape.
// Same vertex count; the field's analytic normals are carried through the squeeze (inverse transpose
// of its Jacobian), so the shading stays as smooth as the field's. Opt-in: no tagged primitive, no
// change.
import { SDFModel, T_FIN, polySD } from '../sdf/sdf.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const dsmooth = (a, b, x) => { if (x <= a || x >= b) return 0; const t = (x - a) / (b - a); return (6 * t * (1 - t)) / (b - a); };

/** @returns the number of vertices moved */
export function sharpenFinEdges({ pos, nrm, lists, nV, regionOf }, hOfRegion) {
  let n = 0;
  for (let v = 0; v < nV; v++) {
    const L = lists[v];
    if (!L) continue;
    const h = hOfRegion[regionOf[v]];
    let fin = null, best = Infinity;
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    for (const pr of L) {
      if (pr.type !== T_FIN || !pr.sharpen || pr.carve) continue;
      const d = Math.abs(SDFModel.dist(pr, x, y, z));
      if (d < best) { best = d; fin = pr; }
    }
    if (!fin) continue;
    const P = fin.P, S = fin.sharpen, e = S.edge, B = S.band * h, c = S.rim ?? 1;
    const dx = x - P[0], dy = y - P[1], dz = z - P[2];
    const pu = dx * P[3] + dy * P[4] + dz * P[5], pv = dx * P[6] + dy * P[7] + dz * P[8];
    const pn = dx * P[9] + dy * P[10] + dz * P[11];
    // depth inside the outline (< 0 on the rounded rim beyond it)
    const din = -polySD(P, pu, pv);
    if (din >= B) continue;
    // the body around the root: the field of every non-fin primitive near the vertex
    const rest = L.filter((pr) => pr.type !== T_FIN && !pr.carve);
    const dBody = rest.length ? SDFModel.evalList(rest, x, y, z) : 1e9;
    const wr = smooth(1.5 * h, 4 * h, dBody);
    if (wr < 1e-3) continue;
    // squeeze factor s(din) = 1 - wr (1 - k(din)), k = e + (1 - e) smooth(0, B, din)
    const s = 1 - wr * (1 - e) * (1 - smooth(0, B, din));
    const ds = wr * (1 - e) * dsmooth(0, B, din);
    // in-plane gradient of din (unit, pointing into the fin)
    const eps = 0.25 * h;
    let gu = -(polySD(P, pu + eps, pv) - polySD(P, pu - eps, pv)) / (2 * eps);
    let gv = -(polySD(P, pu, pv + eps) - polySD(P, pu, pv - eps)) / (2 * eps);
    const gl = Math.hypot(gu, gv) || 1;
    gu /= gl; gv /= gl;
    const gx = P[3] * gu + P[6] * gv, gy = P[4] * gu + P[7] * gv, gz = P[5] * gu + P[8] * gv;
    // the rim beyond the outline drawn in toward it (to c of its width)
    const pull = din < 0 ? (1 - c) * -din * wr : 0;
    const off = pn * (s - 1);
    pos[v * 3] += P[9] * off + gx * pull; pos[v * 3 + 1] += P[10] * off + gy * pull; pos[v * 3 + 2] += P[11] * off + gz * pull;
    // normal: J = I + nf a^T (a = (s - 1) nf + pn ds g) -> J^-T n0 = n0 - a (nf . n0) / s; the rim pull
    // scales along g by c' = 1 - (1 - c) wr -> divide the g component by c'
    let nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
    const fn = (nx * P[9] + ny * P[10] + nz * P[11]) / s;
    const ax = (s - 1) * P[9] + pn * ds * gx, ay = (s - 1) * P[10] + pn * ds * gy, az = (s - 1) * P[11] + pn * ds * gz;
    nx -= ax * fn; ny -= ay * fn; nz -= az * fn;
    if (din < 0 && c < 1) {
      const cc = 1 - (1 - c) * wr, gn = (nx * gx + ny * gy + nz * gz) * (1 / cc - 1);
      nx += gx * gn; ny += gy * gn; nz += gz * gn;
    }
    // at the knife edge itself the faces above and below meet: a vertex there (on the field's rounded
    // cap, close to the mid-plane) takes the edge's in-plane normal; otherwise vertices a hair above and
    // below the plane along the rim would alternate up / down normals (stripes across the edge)
    const q = Math.abs(pn) / Math.max(1e-9, P[12]);
    const fq = smooth(0.15, 0.7, q);
    if (fq < 1) {
      const nfc = (nx * P[9] + ny * P[10] + nz * P[11]) * (1 - fq);
      nx -= P[9] * nfc; ny -= P[10] * nfc; nz -= P[11] * nfc;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm[v * 3] = nx / l; nrm[v * 3 + 1] = ny / l; nrm[v * 3 + 2] = nz / l;
    n++;
  }
  return n;
}
