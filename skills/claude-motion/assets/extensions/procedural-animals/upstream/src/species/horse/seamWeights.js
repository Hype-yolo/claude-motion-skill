// One set of skin weights for the head and body copies of the throat and upper neck.
//
// The head (fine cells) and the body (coarse cells) both mesh the upper neck and cross-fade across the
// neck cut (regions.js). The core weighs every surface on its own: the axial coordinate is relaxed
// over each mesh separately and the weights are smoothed over each mesh's own neighbours, so at the
// same point of skin the two copies took weights up to 0.17 (medium) apart, inside the occiput blend
// where the head weight changes fastest. Standing still that is invisible, but when the poll flexes
// (grazing, drinking, a head turned, lying flat) the two copies swing apart along the skin's normal
// by up to 10 mm, ~5x the seam skirt's depth: one surface rises out of the other and its edge reads
// as a dark crease across the throat latch.
//
// Here both copies take the same field across the band: at a point p with head fade f(p) (the neck
// cut's cross-fade alone, without the eyelid patches),
//   W(p) = (1 - f) * W_body(p) + f * W_head(p),
// where W_body / W_head are each surface's own weights, read off the other surface at its closest
// point (barycentric on the nearest triangle). Each copy keeps its own weights where it takes over
// (f -> 0 on the body side, f -> 1 on the head side), so neither copy steps within itself, and across
// the middle of the band, where both are drawn, the two copies of a point move as one.
import { neckBand, neckS, H_BODY } from './regions.js';
import { smoothstep } from '../../core/math/vec.js';

const K = 4;

export function unifyNeckWeights(ctx) {
  const { pos, index, regionOf, regionNames, patchOf, weights, nV, Q } = ctx;
  const { skinIndex: SI, skinWeight: SW } = weights;
  const hR = regionNames.indexOf('head'), bR = regionNames.indexOf('body');
  if (hR < 0 || bR < 0) return { changed: 0 };
  const r = Q?.res ?? 1;
  const { B, OV, clipBody, clipHead } = neckBand(r);
  // The head copy takes the body's weights wherever the body copy is drawn (body fade >= 0.1, the
  // seam skirt's floor: neck coordinate < OV + 0.6 B) and hands over to its own weights past it,
  // where it is the only surface, finishing 1.5 body cells before the body copy's clip edge. The body
  // copy keeps its own (smooth at its coarse cell, so a head vertex reads it exactly off the body's
  // triangle).
  const s0 = OV + 0.6 * B, s1 = clipBody - 1.5 * H_BODY * r;
  const share = (g, s) => (g === hR ? 1 - smoothstep(s0, s1, s) : 0); // share of the other copy's weights
  const S = (v) => neckS(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
  const inBand = (v) => { const s = S(v); return s > -clipHead - 0.01 && s < clipBody + 0.01; };
  const own = (v) => (patchOf && patchOf[v] ? -1 : regionOf[v]);

  // triangles of each copy near the band, in a hash grid
  const G = 0.02;
  const key = (x, y, z) => `${Math.floor(x / G)},${Math.floor(y / G)},${Math.floor(z / G)}`;
  const grids = { [hR]: new Map(), [bR]: new Map() };
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    if (a >= nV || b >= nV || c >= nV) continue;
    const g = own(a);
    if ((g !== hR && g !== bR) || own(b) !== g || own(c) !== g) continue;
    if (!inBand(a) && !inBand(b) && !inBand(c)) continue;
    const mn = [0, 1, 2].map((k) => Math.min(pos[a * 3 + k], pos[b * 3 + k], pos[c * 3 + k]));
    const mx = [0, 1, 2].map((k) => Math.max(pos[a * 3 + k], pos[b * 3 + k], pos[c * 3 + k]));
    for (let x = Math.floor(mn[0] / G); x <= Math.floor(mx[0] / G); x++)
      for (let y = Math.floor(mn[1] / G); y <= Math.floor(mx[1] / G); y++)
        for (let z = Math.floor(mn[2] / G); z <= Math.floor(mx[2] / G); z++) {
          const k = `${x},${y},${z}`;
          let l = grids[g].get(k);
          if (!l) grids[g].set(k, (l = []));
          l.push(i);
        }
  }

  // closest point of the other copy: [a, b, c, u, v, w] or null (within maxD)
  const maxD = 0.03;
  const closest = (g, px, py, pz) => {
    let best = null, bd = maxD * maxD;
    const seen = new Set();
    const cx = Math.floor(px / G), cy = Math.floor(py / G), cz = Math.floor(pz / G);
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (let z = cz - 1; z <= cz + 1; z++) {
      const l = grids[g].get(`${x},${y},${z}`);
      if (!l) continue;
      for (const i of l) {
        if (seen.has(i)) continue;
        seen.add(i);
        const r3 = closestOnTri(pos, index[i], index[i + 1], index[i + 2], px, py, pz);
        if (r3.d2 < bd) { bd = r3.d2; best = [index[i], index[i + 1], index[i + 2], r3.u, r3.v, r3.w]; }
      }
    }
    return best;
  };

  // new weights, computed from the original ones (the two copies read each other's)
  const nSI = new Map(), nSW = new Map();
  const acc = new Map();
  const add = (v, f) => { for (let k = 0; k < K; k++) { const w = SW[v * K + k]; if (w > 0) acc.set(SI[v * K + k], (acc.get(SI[v * K + k]) || 0) + w * f); } };
  let changed = 0;
  for (let v = 0; v < nV; v++) {
    const g = own(v);
    if (g !== hR && g !== bR) continue;
    // (the hidden run of each copy past the band follows the other copy all the way to its clip edge)
    const a = share(g, S(v));
    if (a < 1e-3) continue;
    const o = closest(g === hR ? bR : hR, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    if (!o) continue;
    acc.clear();
    add(v, 1 - a);
    add(o[0], a * o[3]); add(o[1], a * o[4]); add(o[2], a * o[5]);
    const top = [...acc.entries()].filter((e) => e[1] > 1e-5).sort((x, y) => y[1] - x[1]).slice(0, K);
    const sum = top.reduce((t, e) => t + e[1], 0) || 1;
    nSI.set(v, top.map((e) => e[0]));
    nSW.set(v, top.map((e) => e[1] / sum));
    changed++;
  }
  for (const [v, bs] of nSI) {
    const ws = nSW.get(v);
    for (let k = 0; k < K; k++) { SI[v * K + k] = k < bs.length ? bs[k] : 0; SW[v * K + k] = k < ws.length ? ws[k] : 0; }
  }
  return { changed };
}

// closest point on triangle (a, b, c) to p: squared distance and barycentrics (Ericson, RTCD 5.1.5)
function closestOnTri(P, a, b, c, px, py, pz) {
  const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
  const abx = P[b * 3] - ax, aby = P[b * 3 + 1] - ay, abz = P[b * 3 + 2] - az;
  const acx = P[c * 3] - ax, acy = P[c * 3 + 1] - ay, acz = P[c * 3 + 2] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let u, v, w;
  if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0; } else {
    const bpx = px - P[b * 3], bpy = py - P[b * 3 + 1], bpz = pz - P[b * 3 + 2];
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    const cpx = px - P[c * 3], cpy = py - P[c * 3 + 1], cpz = pz - P[c * 3 + 2];
    const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0; }
    else if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1; }
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); u = 1 - t; v = t; w = 0; }
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); u = 1 - t; v = 0; w = t; }
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / (d4 - d3 + (d5 - d6)); u = 0; v = 1 - t; w = t; }
    else { const den = 1 / (va + vb + vc); v = vb * den; w = vc * den; u = 1 - v - w; }
  }
  const qx = ax + abx * v + acx * w, qy = ay + aby * v + acy * w, qz = az + abz * v + acz * w;
  return { d2: (qx - px) ** 2 + (qy - py) ** 2 + (qz - pz) ** 2, u, v, w };
}

// Spread the head -> neck hand-over across the whole throat latch.
//
// The core weighs the throat by its axial coordinate, but the throat lies in the acute wedge between
// the head and the neck (82 deg at the occiput in the bind pose), where the projection onto the chain
// crowds: on the skin from the back of the jowl down to the windpipe the head weight fell from 0.85
// to 0.15 within ~10 cm (12 deg about the poll). The poll flexes up to ~60 deg past the bind pose
// (a head looking down at the forefeet, on the vertical with the neck up; rearing; a head turned to
// the flank), and a point 25 cm from the occiput then moves ~25 cm relative to the neck: across a
// 10 cm hand-over the skin folds over itself, and the folded fur reads as a dark crease from the
// throat latch up behind the jowl.
//
// Here the weights in the throat wedge are blurred over the surface (both copies together, splatted
// into a grid by vertex area and fade, Gaussian sigma SIGMA, sampled back), so the hand-over runs over
// ~3 sigma of skin, from the back of the jowl into the upper third of the neck. The mask keeps the
// face, the poll and ear bases, and the neck beyond ~0.5 m from the occiput as they
// were; only the share on head / neck2 / neck1 is redistributed (ears keep theirs).
const SIGMA = 0.1;
export function spreadThroatWeights(ctx, sigma = SIGMA) {
  const { pos, index, regionOf, regionNames, rigidBone, weights, nV, fade, rig } = ctx;
  const { skinIndex: SI, skinWeight: SW } = weights;
  const hR = regionNames.indexOf('head'), bR = regionNames.indexOf('body');
  const O = rig.J.occiput, N = rig.J.nose;
  const ha = Math.atan2(N[1] - O[1], N[2] - O[2]);
  const DEG = Math.PI / 180;
  const bones = ['head', 'neck2', 'neck1'].map((n) => rig.BONE[n].index);
  const NBc = bones.length;
  const bslot = new Map(bones.map((b, i) => [b, i]));
  // mask: phi, the angle about the occiput (sagittal plane) from the head axis toward the throat: the
  // whole wedge to the neck axis (82 deg) and on round the sides and top of the upper neck (a head
  // turned or rolled, lying flat or grazing, bends the upper neck there too), and the back of the
  // jowl (phi 0-12 deg: a rigid jowl margin creased against the throat when the head tucked in to
  // rear), but not the face (phi < -5: eyes, forehead, nasal bone; the jowl keeps >= 0.85 of the head)
  // or the skin round the occiput itself (r < 9-16 cm: poll, ear bases)
  const mask = (v) => {
    const y = pos[v * 3 + 1] - O[1], z = pos[v * 3 + 2] - O[2];
    const r = Math.hypot(y, z);
    let phi = ha - Math.atan2(y, z);
    phi = ((phi / DEG + 540) % 360) - 180;
    return smoothstep(-5, 12, phi) * (1 - smoothstep(140, 180, phi)) * smoothstep(0.09, 0.16, r) * (1 - smoothstep(0.5, 0.6, r));
  };
  const usable = (v) => (regionOf[v] === hR || regionOf[v] === bR) && !(rigidBone && rigidBone[v] >= 0);
  const M = new Float32Array(nV);
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], any = false;
  for (let v = 0; v < nV; v++) {
    if (!usable(v)) continue;
    const m = mask(v);
    if (m <= 0) continue;
    M[v] = m; any = true;
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[v * 3 + k]); mx[k] = Math.max(mx[k], pos[v * 3 + k]); }
  }
  if (!any) return { changed: 0 };
  const pad = 3 * sigma, c = sigma / 2;
  mn = mn.map((x) => x - pad); mx = mx.map((x) => x + pad);
  const G = mn.map((x, k) => Math.ceil((mx[k] - x) / c) + 2);
  const NC = NBc + 1, cells = G[0] * G[1] * G[2];
  const grid = new Float32Array(cells * NC);
  // vertex areas
  const area = new Float32Array(nV);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], d = index[i + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const wx = pos[d * 3] - pos[a * 3], wy = pos[d * 3 + 1] - pos[a * 3 + 1], wz = pos[d * 3 + 2] - pos[a * 3 + 2];
    const A = 0.5 * Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 3;
    area[a] += A; area[b] += A; area[d] += A;
  }
  const cellOf = (v) => [0, 1, 2].map((k) => (pos[v * 3 + k] - mn[k]) / c);
  const at = (i, j, k) => (i + G[0] * (j + G[1] * k)) * NC;
  const tmp = new Float32Array(NC);
  for (let v = 0; v < nV; v++) {
    if (!usable(v)) continue;
    const g = cellOf(v);
    if (g.some((x, k) => x < 0 || x > G[k] - 2)) continue;
    const a = area[v] * Math.max(0, fade ? fade[v] : 1);
    if (!(a > 0)) continue;
    // the vertex's weights on head / neck2 / neck1 (other bones: the nearest of these by the chain)
    tmp.fill(0);
    let s = 0;
    for (let k = 0; k < 4; k++) { const w = SW[v * 4 + k]; const sl = bslot.get(SI[v * 4 + k]); if (w > 0 && sl !== undefined) { tmp[sl] += w; s += w; } }
    if (s < 0.5) continue; // skin of a limb / ear: not a source
    for (let k = 0; k < NBc; k++) tmp[k] /= s;
    tmp[NBc] = 1;
    const i0 = Math.floor(g[0]), j0 = Math.floor(g[1]), k0 = Math.floor(g[2]);
    const fx = g[0] - i0, fy = g[1] - j0, fz = g[2] - k0;
    for (let dk = 0; dk < 2; dk++) for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
      const t = a * (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fz : 1 - fz);
      const o = at(i0 + di, j0 + dj, k0 + dk);
      for (let q = 0; q < NC; q++) grid[o + q] += t * tmp[q];
    }
  }
  // separable Gaussian blur
  const R = Math.ceil(3 * sigma / c), ker = [];
  for (let d = -R; d <= R; d++) ker.push(Math.exp(-0.5 * ((d * c) / sigma) ** 2));
  const buf = new Float32Array(grid.length);
  for (let ax = 0; ax < 3; ax++) {
    buf.fill(0);
    for (let k = 0; k < G[2]; k++) for (let j = 0; j < G[1]; j++) for (let i = 0; i < G[0]; i++) {
      const o = at(i, j, k);
      if (grid[o + NBc] === 0 && !grid.subarray(o, o + NC).some((x) => x)) continue;
      for (let d = -R; d <= R; d++) {
        const ii = i + (ax === 0 ? d : 0), jj = j + (ax === 1 ? d : 0), kk = k + (ax === 2 ? d : 0);
        if (ii < 0 || jj < 0 || kk < 0 || ii >= G[0] || jj >= G[1] || kk >= G[2]) continue;
        const o2 = at(ii, jj, kk), w = ker[d + R];
        for (let q = 0; q < NC; q++) buf[o2 + q] += w * grid[o + q];
      }
    }
    grid.set(buf);
  }
  // sample back and mix in by the mask
  let changed = 0;
  const acc = new Map();
  for (let v = 0; v < nV; v++) {
    const m = M[v];
    if (!(m > 0)) continue;
    const g = cellOf(v);
    const i0 = Math.floor(g[0]), j0 = Math.floor(g[1]), k0 = Math.floor(g[2]);
    const fx = g[0] - i0, fy = g[1] - j0, fz = g[2] - k0;
    tmp.fill(0);
    for (let dk = 0; dk < 2; dk++) for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
      const t = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fz : 1 - fz);
      const o = at(i0 + di, j0 + dj, k0 + dk);
      for (let q = 0; q < NC; q++) tmp[q] += t * grid[o + q];
    }
    if (!(tmp[NBc] > 1e-9)) continue;
    // only the share on the head / neck bones is redistributed: an ear's or a foreleg's share stays
    acc.clear();
    let ax = 0;
    for (let k = 0; k < 4; k++) { const w = SW[v * 4 + k]; if (w > 0 && bslot.has(SI[v * 4 + k])) ax += w; }
    for (let k = 0; k < 4; k++) { const w = SW[v * 4 + k]; if (w > 0) acc.set(SI[v * 4 + k], (acc.get(SI[v * 4 + k]) || 0) + w * (bslot.has(SI[v * 4 + k]) ? 1 - m : 1)); }
    for (let q = 0; q < NBc; q++) { const w = (tmp[q] / tmp[NBc]) * m * ax; if (w > 0) acc.set(bones[q], (acc.get(bones[q]) || 0) + w); }
    const top = [...acc.entries()].filter((e) => e[1] > 1e-4).sort((x, y) => y[1] - x[1]).slice(0, K);
    const sum = top.reduce((t, e) => t + e[1], 0) || 1;
    for (let k = 0; k < K; k++) { SI[v * K + k] = k < top.length ? top[k][0] : 0; SW[v * K + k] = k < top.length ? top[k][1] / sum : 0; }
    changed++;
  }
  return { changed };
}
