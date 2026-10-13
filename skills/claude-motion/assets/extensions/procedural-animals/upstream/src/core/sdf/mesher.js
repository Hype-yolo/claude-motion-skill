// Narrow-band Surface Nets polygoniser for the SDF model.
// Coarse pass finds cells near the zero set; only those are refined to the fine grid.
// Vertices are projected onto the true surface (Newton steps along the SDF gradient)
// and normals come from the analytic field gradient, so the mesh is smooth and accurate.
import { SDFModel, gradient } from './sdf.js';

export function meshSDF(prims, bmin, bmax, h, F = 6, onProgress, clip = null) {
  const kmax = prims.reduce((m, p) => Math.max(m, p.k), 0);
  // absolute steps tuned for cheetah-sized cells (>= 1 mm), scaled down for finer grids
  const eP = Math.min(0.0006, 0.6 * h), eN = Math.min(0.0008, 0.8 * h), tolP = Math.min(2e-5, 0.02 * h);
  const nx = Math.ceil((bmax[0] - bmin[0]) / h) + 3;
  const ny = Math.ceil((bmax[1] - bmin[1]) / h) + 3;
  const nz = Math.ceil((bmax[2] - bmin[2]) / h) + 3;
  const ox = bmin[0] - h, oy = bmin[1] - h, oz = bmin[2] - h;
  const cnx = Math.ceil((nx - 1) / F), cny = Math.ceil((ny - 1) / F), cnz = Math.ceil((nz - 1) / F);
  const H = h * F;

  // --- coarse samples, evaluated per super-cell with culled primitive lists
  const T0 = performance.now();
  const cv = new Float32Array((cnx + 1) * (cny + 1) * (cnz + 1)).fill(NaN);
  const cidx = (i, j, k) => i + (cnx + 1) * (j + (cny + 1) * k);
  const F2 = 4;
  const snx = Math.ceil(cnx / F2), sny = Math.ceil(cny / F2), snz = Math.ceil(cnz / F2);
  const H2 = H * F2, rho2 = H2 * Math.sqrt(3) * 0.5;
  const superLists = new Map();
  for (let sk = 0; sk < snz; sk++)
    for (let sj = 0; sj < sny; sj++)
      for (let si = 0; si < snx; si++) {
        const list2 = SDFModel.cull(prims, ox + (si + 0.5) * H2, oy + (sj + 0.5) * H2, oz + (sk + 0.5) * H2, rho2, kmax);
        superLists.set(si + snx * (sj + sny * sk), list2);
        for (let k = sk * F2; k <= Math.min(sk * F2 + F2, cnz); k++)
          for (let j = sj * F2; j <= Math.min(sj * F2 + F2, cny); j++)
            for (let i = si * F2; i <= Math.min(si * F2 + F2, cnx); i++) {
              const id = cidx(i, j, k);
              if (cv[id] === cv[id]) continue;
              cv[id] = list2.length ? SDFModel.evalList(list2, ox + i * H, oy + j * H, oz + k * H) : 1;
            }
      }
  const superListFor = (i, j, k) => superLists.get(Math.min(snx - 1, Math.floor(i / F2)) + snx * (Math.min(sny - 1, Math.floor(j / F2)) + sny * Math.min(snz - 1, Math.floor(k / F2))));
  const T1 = performance.now();

  // --- active coarse cells (surface may pass through), dilated by one
  const cellIdx = (i, j, k) => i + cnx * (j + cny * k);
  const active0 = new Uint8Array(cnx * cny * cnz);
  const reach = H * Math.sqrt(3) * 1.15;
  for (let k = 0; k < cnz; k++)
    for (let j = 0; j < cny; j++)
      for (let i = 0; i < cnx; i++) {
        let mn = 1e9, neg = false, pos_ = false;
        for (let c = 0; c < 8; c++) {
          const v = cv[cidx(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          const a = Math.abs(v);
          if (a < mn) mn = a;
          if (v < 0) neg = true; else pos_ = true;
        }
        // a surface point inside the cube is within half a diagonal of some corner
        if ((neg && pos_) || mn < reach * 0.5) active0[cellIdx(i, j, k)] = 1;
      }
  const active = active0; // every cell crossed by the surface is already active (1-Lipschitz bound)

  // --- fine samples inside active coarse cells
  const N = nx * ny * nz;
  const fv = new Float32Array(N).fill(NaN);
  const fidx = (x, y, z) => x + nx * (y + ny * z);
  const cellLists = new Map();
  const rho = H * Math.sqrt(3) * 0.5;
  let cellCount = 0;
  for (let k = 0; k < cnz; k++)
    for (let j = 0; j < cny; j++)
      for (let i = 0; i < cnx; i++) {
        const ci = cellIdx(i, j, k);
        if (!active[ci]) continue;
        cellCount++;
        const cx = ox + (i + 0.5) * H, cy = oy + (j + 0.5) * H, cz = oz + (k + 0.5) * H;
        const list = SDFModel.cull(superListFor(i, j, k), cx, cy, cz, rho, kmax);
        cellLists.set(ci, list);
        const x0 = i * F, y0 = j * F, z0 = k * F;
        for (let z = z0; z <= Math.min(z0 + F, nz - 1); z++)
          for (let y = y0; y <= Math.min(y0 + F, ny - 1); y++)
            for (let x = x0; x <= Math.min(x0 + F, nx - 1); x++) {
              const id = fidx(x, y, z);
              if (fv[id] === fv[id]) continue; // already evaluated
              fv[id] = SDFModel.evalList(list, ox + x * h, oy + y * h, oz + z * h);
            }
      }
  const T2 = performance.now();
  onProgress && onProgress('field', cellCount);

  const listFor = (x, y, z) => {
    const i = Math.min(cnx - 1, Math.floor(x / F)), j = Math.min(cny - 1, Math.floor(y / F)), k = Math.min(cnz - 1, Math.floor(z / F));
    return cellLists.get(cellIdx(i, j, k)) || prims;
  };

  // --- surface nets vertices
  const vmap = new Map();
  const pos = [];
  const cellOf = [];
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const corner = new Float64Array(8);
  for (let k = 0; k < cnz; k++)
    for (let j = 0; j < cny; j++)
      for (let i = 0; i < cnx; i++) {
        if (!active[cellIdx(i, j, k)]) continue;
        const list = cellLists.get(cellIdx(i, j, k));
        const x0 = i * F, y0 = j * F, z0 = k * F;
        for (let z = z0; z < Math.min(z0 + F, nz - 1); z++)
          for (let y = y0; y < Math.min(y0 + F, ny - 1); y++)
            for (let x = x0; x < Math.min(x0 + F, nx - 1); x++) {
              let mask = 0, bad = false;
              for (let c = 0; c < 8; c++) {
                const v = fv[fidx(x + (c & 1), y + ((c >> 1) & 1), z + ((c >> 2) & 1))];
                if (v !== v) { bad = true; break; }
                corner[c] = v;
                if (v < 0) mask |= 1 << c;
              }
              if (bad || mask === 0 || mask === 255) continue;
              if (clip && !clip(ox + (x + 0.5) * h, oy + (y + 0.5) * h, oz + (z + 0.5) * h)) continue;
              // mass point of edge crossings
              let sx = 0, sy = 0, sz = 0, cnt = 0;
              for (const [a, b] of edges) {
                const va = corner[a], vb = corner[b];
                if ((va < 0) === (vb < 0)) continue;
                const t = va / (va - vb);
                const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1;
                const bx = b & 1, by = (b >> 1) & 1, bz = (b >> 2) & 1;
                sx += ax + (bx - ax) * t;
                sy += ay + (by - ay) * t;
                sz += az + (bz - az) * t;
                cnt++;
              }
              let px = ox + (x + sx / cnt) * h, py = oy + (y + sy / cnt) * h, pz = oz + (z + sz / cnt) * h;
              // project onto the surface (tetrahedral samples give value + gradient)
              for (let it = 0; it < 2; it++) {
                const e = eP; // finite-difference step: 0.6 mm, smaller on very fine grids (tiny animals)
                const a = SDFModel.evalList(list, px + e, py - e, pz - e);
                const b = SDFModel.evalList(list, px - e, py - e, pz + e);
                const c2 = SDFModel.evalList(list, px - e, py + e, pz - e);
                const d2 = SDFModel.evalList(list, px + e, py + e, pz + e);
                const d = (a + b + c2 + d2) * 0.25;
                const gx = (a - b - c2 + d2) / (4 * e), gy = (-a - b + c2 + d2) / (4 * e), gz = (-a + b - c2 + d2) / (4 * e);
                const g2 = gx * gx + gy * gy + gz * gz + 1e-12;
                let stx = (-d * gx) / g2, sty = (-d * gy) / g2, stz = (-d * gz) / g2;
                const sl = Math.hypot(stx, sty, stz);
                if (sl > h) { stx *= h / sl; sty *= h / sl; stz *= h / sl; }
                px += stx; py += sty; pz += stz;
                if (Math.abs(d) < tolP) break;
              }
              // keep inside an expanded cell to avoid folding
              const lo = 0.35 * h;
              px = Math.min(Math.max(px, ox + x * h - lo), ox + (x + 1) * h + lo);
              py = Math.min(Math.max(py, oy + y * h - lo), oy + (y + 1) * h + lo);
              pz = Math.min(Math.max(pz, oz + z * h - lo), oz + (z + 1) * h + lo);
              vmap.set(fidx(x, y, z), pos.length / 3);
              pos.push(px, py, pz);
              cellOf.push(fidx(x, y, z));
            }
      }
  const T3 = performance.now();
  onProgress && onProgress('verts', pos.length / 3);

  // --- faces
  const idx = [];
  const nV = pos.length / 3;
  const P = pos;
  const dist2 = (a, b) => {
    const dx = P[a * 3] - P[b * 3], dy = P[a * 3 + 1] - P[b * 3 + 1], dz = P[a * 3 + 2] - P[b * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  };
  const strides = [1, nx, nx * ny];
  for (let v = 0; v < nV; v++) {
    const c = cellOf[v];
    const z = Math.floor(c / (nx * ny));
    const y = Math.floor((c - z * nx * ny) / nx);
    const x = c - z * nx * ny - y * nx;
    const xyz = [x, y, z];
    for (let a = 0; a < 3; a++) {
      const b = (a + 1) % 3, cc = (a + 2) % 3;
      // edge from grid point (cell + e_b + e_c) along axis a
      const p0 = [x, y, z];
      p0[b] += 1;
      p0[cc] += 1;
      if (p0[0] >= nx || p0[1] >= ny || p0[2] >= nz) continue;
      const p1 = p0.slice();
      p1[a] += 1;
      if (p1[a] >= [nx, ny, nz][a]) continue;
      const v0 = fv[fidx(p0[0], p0[1], p0[2])], v1 = fv[fidx(p1[0], p1[1], p1[2])];
      if (v0 !== v0 || v1 !== v1) continue;
      if ((v0 < 0) === (v1 < 0)) continue;
      const cA = c, cB = c + strides[b], cC = c + strides[b] + strides[cc], cD = c + strides[cc];
      const A = vmap.get(cA), B = vmap.get(cB), C = vmap.get(cC), D = vmap.get(cD);
      if (A === undefined || B === undefined || C === undefined || D === undefined) continue;
      // orientation: inside->outside along +a means normal points +a
      const flip = v0 < 0;
      let q = flip ? [A, B, C, D] : [A, D, C, B];
      if (dist2(q[0], q[2]) <= dist2(q[1], q[3])) idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
      else idx.push(q[0], q[1], q[3], q[1], q[2], q[3]);
      void xyz;
    }
  }

  // --- normals from field gradient
  const nrm = new Float32Array(nV * 3);
  for (let v = 0; v < nV; v++) {
    const c = cellOf[v];
    const z = Math.floor(c / (nx * ny));
    const y = Math.floor((c - z * nx * ny) / nx);
    const x = c - z * nx * ny - y * nx;
    const list = listFor(x, y, z);
    const g = gradient(list, P[v * 3], P[v * 3 + 1], P[v * 3 + 2], eN);
    const l = Math.hypot(g[0], g[1], g[2]) || 1;
    nrm[v * 3] = g[0] / l;
    nrm[v * 3 + 1] = g[1] / l;
    nrm[v * 3 + 2] = g[2] / l;
  }

  const lists = new Array(nV);
  for (let v = 0; v < nV; v++) {
    const c = cellOf[v];
    const z = Math.floor(c / (nx * ny));
    const y = Math.floor((c - z * nx * ny) / nx);
    const x = c - z * nx * ny - y * nx;
    lists[v] = listFor(x, y, z);
  }

  const T4 = performance.now();
  if (typeof process !== 'undefined' && process.env && process.env.MESH_TIMING) console.log('coarse', (T1-T0)|0, 'fine', (T2-T1)|0, 'verts', (T3-T2)|0, 'faces+normals', (T4-T3)|0, 'cells', cellCount);
  return {
    positions: new Float32Array(pos),
    normals: nrm,
    indices: nV > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
    lists,
    count: nV,
  };
}
