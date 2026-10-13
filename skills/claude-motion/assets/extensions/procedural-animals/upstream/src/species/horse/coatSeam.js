// One coat across the head / neck boundary: hair flow, hair length and colour run smoothly from the
// face onto the throat and the upper neck.
//
// The coat regions (coat.js) give the head (region 2) its own hair flow, combed from the forehead whorl
// down the face toward the muzzle, and the neck (region 1) the flow down the neck from the axial chain;
// the head's short face hair (5 mm) and the neck's 8 mm coat meet on one line, the boundary of region 2:
// across the throat latch and the back of the jowl (where the axial coordinate passes the occiput) and
// up behind the poll (the neck cut, neckS = 0.03). On that line the hair flow turned by up to ~160 deg
// from one vertex to the next: the jowl's hair points to the muzzle, the throat's down the neck, so the
// two coats parted along the line and the dark roots and the shaded base under the shells showed
// through as a thin dark line. It reads most when the jowl margin turns edge-on (the poll flexed in a
// rear, a head looking down to the side): a dark crease across the throat and up behind the eye.
//
// Here the hair direction, length and colour of both coats are blurred over the surface (both mesh
// copies together, splatted into a grid by vertex area and fade, Gaussian sigma SIGMA) and mixed in
// along the boundary only (by the blurred region indicator: full within ~3 cm of the line, nothing
// past ~9 cm), so the face, the poll and the neck keep their own coat and the hair turns from the
// face's flow to the neck's over ~10 cm of skin instead of between two vertices.
import { smoothstep } from '../../core/math/vec.js';
import { MAT } from '../../core/build/coatKit.js';

const SIGMA = 0.035;

export function blendHeadNeckCoat(ctx, { comb, furLen, tint, region }, sigma = SIGMA) {
  const { pos, nrm, nV, fade } = ctx;
  // fur of the head and the neck, both mesh copies (the jaw, the ears, the mane keep their own)
  const usable = (v) => (region[v] === 1 || region[v] === 2) && tint[v * 4 + 3] === MAT.FUR;
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], any2 = false;
  for (let v = 0; v < nV; v++) {
    if (!usable(v) || region[v] !== 2) continue;
    any2 = true;
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[v * 3 + k]); mx[k] = Math.max(mx[k], pos[v * 3 + k]); }
  }
  if (!any2) return { changed: 0 };
  const c = sigma / 2, pad = 4 * sigma;
  mn = mn.map((x) => x - pad); mx = mx.map((x) => x + pad);
  const G = mn.map((x, k) => Math.ceil((mx[k] - x) / c) + 2);
  // channels: comb xyz, hair length, colour rgb, region-2 indicator, weight
  const NC = 9, cells = G[0] * G[1] * G[2];
  const grid = new Float32Array(cells * NC);
  const at = (i, j, k) => (i + G[0] * (j + G[1] * k)) * NC;
  const cellOf = (v) => [0, 1, 2].map((k) => (pos[v * 3 + k] - mn[k]) / c);
  const inside = (g) => g.every((x, k) => x >= 0 && x <= G[k] - 2);
  // vertex areas
  const area = new Float32Array(nV);
  const { index } = ctx;
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], d = index[i + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const wx = pos[d * 3] - pos[a * 3], wy = pos[d * 3 + 1] - pos[a * 3 + 1], wz = pos[d * 3 + 2] - pos[a * 3 + 2];
    const A = (0.5 * Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx)) / 3;
    area[a] += A; area[b] += A; area[d] += A;
  }
  const tmp = new Float32Array(NC);
  for (let v = 0; v < nV; v++) {
    if (!usable(v)) continue;
    const g = cellOf(v);
    if (!inside(g)) continue;
    const a = area[v] * Math.max(0, fade ? fade[v] : 1);
    if (!(a > 0)) continue;
    tmp[0] = comb[v * 3]; tmp[1] = comb[v * 3 + 1]; tmp[2] = comb[v * 3 + 2];
    tmp[3] = furLen[v];
    tmp[4] = tint[v * 4]; tmp[5] = tint[v * 4 + 1]; tmp[6] = tint[v * 4 + 2];
    tmp[7] = region[v] === 2 ? 1 : 0; tmp[8] = 1;
    const i0 = Math.floor(g[0]), j0 = Math.floor(g[1]), k0 = Math.floor(g[2]);
    const fx = g[0] - i0, fy = g[1] - j0, fz = g[2] - k0;
    for (let dk = 0; dk < 2; dk++) for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
      const t = a * (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fz : 1 - fz);
      const o = at(i0 + di, j0 + dj, k0 + dk);
      for (let q = 0; q < NC; q++) grid[o + q] += t * tmp[q];
    }
  }
  // separable Gaussian blur
  const R = Math.ceil((3 * sigma) / c), ker = [];
  for (let d = -R; d <= R; d++) ker.push(Math.exp(-0.5 * ((d * c) / sigma) ** 2));
  const buf = new Float32Array(grid.length);
  for (let ax = 0; ax < 3; ax++) {
    buf.fill(0);
    for (let k = 0; k < G[2]; k++) for (let j = 0; j < G[1]; j++) for (let i = 0; i < G[0]; i++) {
      const o = at(i, j, k);
      if (grid[o + NC - 1] === 0) continue;
      for (let d = -R; d <= R; d++) {
        const ii = i + (ax === 0 ? d : 0), jj = j + (ax === 1 ? d : 0), kk = k + (ax === 2 ? d : 0);
        if (ii < 0 || jj < 0 || kk < 0 || ii >= G[0] || jj >= G[1] || kk >= G[2]) continue;
        const o2 = at(ii, jj, kk), w = ker[d + R];
        for (let q = 0; q < NC; q++) buf[o2 + q] += w * grid[o + q];
      }
    }
    grid.set(buf);
  }
  // sample back; mix in along the boundary
  let changed = 0;
  for (let v = 0; v < nV; v++) {
    if (!usable(v)) continue;
    const g = cellOf(v);
    if (!inside(g)) continue;
    const i0 = Math.floor(g[0]), j0 = Math.floor(g[1]), k0 = Math.floor(g[2]);
    const fx = g[0] - i0, fy = g[1] - j0, fz = g[2] - k0;
    tmp.fill(0);
    for (let dk = 0; dk < 2; dk++) for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
      const t = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fz : 1 - fz);
      const o = at(i0 + di, j0 + dj, k0 + dk);
      for (let q = 0; q < NC; q++) tmp[q] += t * grid[o + q];
    }
    const W = tmp[NC - 1];
    if (!(W > 1e-9)) continue;
    const gb = tmp[7] / W;
    const m = smoothstep(0.02, 0.25, Math.min(gb, 1 - gb));
    if (m <= 0) continue;
    // hair direction: the blurred flow, mixed in and laid back into the skin's tangent plane
    const n = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    let d = [0, 1, 2].map((k) => comb[v * 3 + k] * (1 - m) + (tmp[k] / W) * m);
    const dn = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
    d = d.map((x, k) => x - dn * n[k]);
    const l = Math.hypot(d[0], d[1], d[2]);
    if (l > 1e-4) for (let k = 0; k < 3; k++) comb[v * 3 + k] = d[k] / l;
    furLen[v] = furLen[v] * (1 - m) + (tmp[3] / W) * m;
    for (let k = 0; k < 3; k++) tint[v * 4 + k] = tint[v * 4 + k] * (1 - m) + (tmp[4 + k] / W) * m;
    changed++;
  }
  return { changed };
}
