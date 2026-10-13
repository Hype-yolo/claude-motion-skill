// Cross-fade seams: how far two overlapping surfaces lie apart where they hand over.
//
// Regions overlap and cross-fade (a fine head over the coarse neck, eyelid patches over the face):
// the base of each surface is drawn where its fade >= 0.5, the two halves meeting at the midline of
// the band. The surfaces approximate the same SDF at different cell sizes, so at the midline they do
// not coincide: the coarse one bridges creases and cuts chords inside convex skin, by up to ~0.4 of
// its cell in a crease. Seen at a grazing angle the step between them is a thin slit into the body
// (a red line in the 'holes' debug view).
//
// The renderer closes it with a skirt (render/coatMaterial.js): past the midline, down to fade 0.1,
// the base sinks along its normal (quadratically, by up to `sink` metres) instead of stopping, so the
// surface that is handing over dives under the one taking over (which wins the depth test) and every
// ray through the step lands on skin. `measureSeams` sizes the sink from the real mismatch of this individual's
// surfaces (bind pose, reference space): rays along the normal of every band vertex against the
// other surfaces' band triangles. Shells and fins keep cross-fading on the true surfaces.
import { smoothstep } from '../math/vec.js';

// groups: a region's main surface and its eyelid patches are separate surfaces
const groupOf = (regionOf, patchOf, v) => regionOf[v] * 2 + (patchOf && patchOf[v] ? 1 : 0);

/**
 * @param {object} m { pos, nrm, index, nV, fade, regionOf, patchOf, hOf: region index -> cell size (m) }
 * @returns {{ sink: number, max: number, p99: number, samples: number, hBand: number }} metres (reference space)
 */
export function measureSeams({ pos, nrm, index, nV, fade, regionOf, patchOf, hOf }) {
  const res = { sink: 0, max: 0, p99: 0, samples: 0, hBand: 0 };
  // band triangles (some vertex fades, some vertex shows) and the coarsest cell of a banded region
  const tri = [];
  let hBand = 0;
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    if (a >= nV || b >= nV || c >= nV) continue;
    const fm = Math.min(fade[a], fade[b], fade[c]), fM = Math.max(fade[a], fade[b], fade[c]);
    if (fM <= 0.02 || fm >= 0.98) continue;
    tri.push(i);
    hBand = Math.max(hBand, hOf[regionOf[a]] || 0);
  }
  if (!tri.length || !(hBand > 0)) return res;
  res.hBand = hBand;
  const range = 0.75 * hBand; // search depth along the normal
  // hash grid of band triangles
  const G = Math.max(range, 0.004), grid = new Map();
  const key = (x, y, z) => (Math.floor(x / G) + 4096) * 67108864 + (Math.floor(y / G) + 4096) * 8192 + (Math.floor(z / G) + 4096);
  for (let t = 0; t < tri.length; t++) {
    const i = tri[t], a = index[i], b = index[i + 1], c = index[i + 2];
    const x0 = Math.floor(Math.min(pos[a * 3], pos[b * 3], pos[c * 3]) / G), x1 = Math.floor(Math.max(pos[a * 3], pos[b * 3], pos[c * 3]) / G);
    const y0 = Math.floor(Math.min(pos[a * 3 + 1], pos[b * 3 + 1], pos[c * 3 + 1]) / G), y1 = Math.floor(Math.max(pos[a * 3 + 1], pos[b * 3 + 1], pos[c * 3 + 1]) / G);
    const z0 = Math.floor(Math.min(pos[a * 3 + 2], pos[b * 3 + 2], pos[c * 3 + 2]) / G), z1 = Math.floor(Math.max(pos[a * 3 + 2], pos[b * 3 + 2], pos[c * 3 + 2]) / G);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const k = (x + 4096) * 67108864 + (y + 4096) * 8192 + (z + 4096);
      let l = grid.get(k);
      if (!l) grid.set(k, (l = []));
      l.push(t);
    }
  }
  const offs = [];
  const seen = new Set();
  for (let v = 0; v < nV; v++) {
    const f = fade[v];
    if (!(f > 0.3 && f < 0.7)) continue;
    const g = groupOf(regionOf, patchOf, v);
    const ox = pos[v * 3], oy = pos[v * 3 + 1], oz = pos[v * 3 + 2], nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
    seen.clear();
    let best = Infinity;
    for (let s = -1; s <= 1.001; s += 0.25) {
      const k = key(ox + nx * s * range, oy + ny * s * range, oz + nz * s * range);
      const l = grid.get(k);
      if (!l) continue;
      for (const t of l) {
        if (seen.has(t)) continue;
        seen.add(t);
        const i = tri[t], a = index[i], b = index[i + 1], c = index[i + 2];
        if (groupOf(regionOf, patchOf, a) === g) continue;
        // Moller-Trumbore, both directions along the normal
        const e1x = pos[b * 3] - pos[a * 3], e1y = pos[b * 3 + 1] - pos[a * 3 + 1], e1z = pos[b * 3 + 2] - pos[a * 3 + 2];
        const e2x = pos[c * 3] - pos[a * 3], e2y = pos[c * 3 + 1] - pos[a * 3 + 1], e2z = pos[c * 3 + 2] - pos[a * 3 + 2];
        const px = ny * e2z - nz * e2y, py = nz * e2x - nx * e2z, pz = nx * e2y - ny * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-14) continue;
        const tx = ox - pos[a * 3], ty = oy - pos[a * 3 + 1], tz = oz - pos[a * 3 + 2];
        const u = (tx * px + ty * py + tz * pz) / det;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const w = (nx * qx + ny * qy + nz * qz) / det;
        if (w < 0 || u + w > 1) continue;
        const d = (e2x * qx + e2y * qy + e2z * qz) / det;
        if (Math.abs(d) > range || Math.abs(d) >= Math.abs(best)) continue;
        // the surface taking over here: its fade complements this one (not the far side of a thin part)
        const fo = fade[a] * (1 - u - w) + fade[b] * u + fade[c] * w;
        if (Math.abs(f + fo - 1) > 0.3) continue;
        best = d;
      }
    }
    if (Number.isFinite(best)) offs.push(Math.abs(best));
  }
  res.samples = offs.length;
  if (!offs.length) { res.sink = 0.1 * hBand; return res; }
  offs.sort((x, y) => x - y);
  res.max = offs[offs.length - 1];
  res.p99 = offs[Math.min(offs.length - 1, Math.floor(0.99 * offs.length))];
  // cover the creases (99th percentile: a few hits land on another fold of the skin) with room for
  // skinning differences in motion; never deeper than 0.4 of the coarse cell
  res.sink = Math.min(0.4 * hBand, Math.max(0.1 * hBand, 1.5 * res.p99));
  return res;
}

// The head and the body surfaces of a region plan overlap across a cut and cross-fade there, and the core smooths each
// surface's skin weights over its own mesh, so where the weights curve the two surfaces at one place take bone shares a
// few per cent apart. Posed (the head bent against the neck), they part by millimetres, and the fur rooted on the
// surface lying under the other's skin loses its roots: a crisp edge across the coat (a cat's cheek, a dog's throat).
// The body surface near the cut takes the head surface's weights at the same place (the closest point on the finer head
// mesh, barycentric), in full across the cross-fade band and fading back to its own over the next 8 mm on the body side.
// sideOf(x, y, z): signed distance from the cut (> 0 on the head side); band: the cross-fade half-width. Called from a
// species' coat (the core passes it the weights and uses them after it).
export function harmonizeSeamWeights({ pos, index, regionOf, regionNames, weights, nV }, sideOf, band) {
  const { skinIndex, skinWeight } = weights;
  const bodyR = regionNames.indexOf('body'), headR = regionNames.indexOf('head');
  if (bodyR < 0 || headR < 0) return 0;
  const B = band, R = B + 0.008, C = 0.004;
  const sOf = (v) => sideOf(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
  // head triangles near the cut, in a hash grid by centroid
  const grid = new Map(), key = (i, j, k) => `${i},${j},${k}`;
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if (a >= nV || regionOf[a] !== headR || regionOf[b] !== headR || regionOf[c] !== headR) continue;
    if (Math.abs(sOf(a)) > R + 0.006) continue;
    const g = [0, 1, 2].map((k) => Math.floor((pos[a * 3 + k] + pos[b * 3 + k] + pos[c * 3 + k]) / 3 / C));
    const kk = key(...g); let l = grid.get(kk); if (!l) grid.set(kk, (l = [])); l.push(t);
  }
  const W0 = Float32Array.from(skinWeight), I0 = Uint16Array.from(skinIndex);
  const P3 = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  let changed = 0;
  for (let v = 0; v < nV; v++) {
    if (regionOf[v] !== bodyR) continue;
    const s = sOf(v);
    if (s < -R || s > R) continue;
    const kMix = s > -B ? 1 : smoothstep(-R, -B, s);
    if (kMix <= 0) continue;
    const p = P3(v), g = p.map((x) => Math.floor(x / C));
    let best = null, bd = 0.004;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const l = grid.get(key(g[0] + a, g[1] + b, g[2] + c)); if (!l) continue;
      for (const t of l) {
        const q = closestOnTri(p, P3(index[t]), P3(index[t + 1]), P3(index[t + 2]));
        if (q.d < bd) { bd = q.d; best = [t, q.u, q.v, q.w]; }
      }
    }
    if (!best) continue;
    const acc = new Map();
    const add = (u, f) => { for (let k = 0; k < 4; k++) { const w = W0[u * 4 + k]; if (w > 0) acc.set(I0[u * 4 + k], (acc.get(I0[u * 4 + k]) || 0) + w * f); } };
    add(v, 1 - kMix);
    add(index[best[0]], kMix * best[1]); add(index[best[0] + 1], kMix * best[2]); add(index[best[0] + 2], kMix * best[3]);
    const top = [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
    let sum = 0; for (const [, w] of top) sum += w;
    for (let k = 0; k < 4; k++) {
      if (k < top.length) { skinIndex[v * 4 + k] = top[k][0]; skinWeight[v * 4 + k] = top[k][1] / sum; } else { skinIndex[v * 4 + k] = 0; skinWeight[v * 4 + k] = 0; }
    }
    changed++;
  }
  return changed;
}

// closest point on triangle abc to p: distance and barycentric weights (Ericson, Real-Time Collision Detection 5.1.5)
function closestOnTri(p, a, b, c) {
  const sub3 = (x, y) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]], dot3 = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  const ab = sub3(b, a), ac = sub3(c, a), ap = sub3(p, a);
  const d1 = dot3(ab, ap), d2 = dot3(ac, ap);
  let u, v, w;
  if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0; } else {
    const bp = sub3(p, b), d3 = dot3(ab, bp), d4 = dot3(ac, bp);
    const cp = sub3(p, c), d5 = dot3(ab, cp), d6 = dot3(ac, cp);
    const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0; }
    else if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1; }
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); u = 1 - t; v = t; w = 0; }
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); u = 1 - t; v = 0; w = t; }
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / (d4 - d3 + (d5 - d6)); u = 0; v = 1 - t; w = t; }
    else { const den = 1 / (va + vb + vc); v = vb * den; w = vc * den; u = 1 - v - w; }
  }
  const q = [0, 1, 2].map((k) => a[k] * u + b[k] * v + c[k] * w);
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), u, v, w };
}

