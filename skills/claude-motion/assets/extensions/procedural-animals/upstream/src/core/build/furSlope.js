// Fur-length slope limit (shorten only), applied by the pipeline to every coat.
//
// The coat shells are offset copies of the skin at hair height x (0..1) x furLen, so where the hair
// length jumps from one vertex to the next the shells stand up as a wall: a round pad with a hard
// rim (a cheek switched from 5 to 11 mm across a plane), an eye sunk in a ring of long fur, a strand
// pattern smeared into a smooth plate over the steep triangles. Real hair changes length gradually
// and lies over the shorter hair around it, so the coat surface has no cliffs.
//
// The limit: hair may grow no faster than `slope` metres of hair per metre of skin above the hair
// around it, U(v) = min(L(v), min_u U(u) + s(v) |p_u - p_v|) over the furred, hairy vertices of the
// same surface (a Dijkstra sweep from the shortest hair outward: exact, one pass). Long hair may rise
// proportionally faster, s(v) = slope x max(1, L(v) / free): every boundary then bevels over at most
// ~free / slope of skin whatever the hair length, so manes, ruffs, forelocks and fleeces keep
// standing off (their edge is beveled, not flattened) while a face loses its walls.
//
// Species control (optional):
//   species.render.furSlope      slope for hair up to `furSlopeFree` long (default 1); false / 0: off
//   species.render.furSlopeFree  hair length (m) above which the allowed slope grows (default 0.025)
//   coat().furSlope              per-vertex slope (Float32Array) replacing the default at that vertex;
//                                Infinity (or <= 0) leaves that vertex's hair as painted (a crest meant
//                                to stand up as a wall)
// Bare vertices (no hair, or a material without shells) neither limit nor get limited: fur may meet a
// lid margin, the nose leather or a hoof at full length.

export const FUR_SLOPE_DEFAULTS = { slope: 1.0, free: 0.025 };

const HAIRY = (m) => m === 0 || m === 4 || m === 8 || m === 9; // materials that grow shells (coatMaterial.js hairy())

/**
 * Shortens furLen in place so that no hair rises faster than the slope above its neighbours.
 * @param {Float32Array} furLen per-vertex hair length (m), modified in place
 * @param {Float32Array} pos    per-vertex positions (reference space)
 * @param {Uint32Array} index   triangle indices
 * @param {number} nV           vertex count (vertices >= nV are ignored)
 * @param {Float32Array} tint   per-vertex rgba, a = material id
 * @param {object} o            { slope, free, perVertex }
 * @returns {{ shortened: number, maxCut: number }} vertices shortened by more than 0.1 mm, the largest cut (m)
 */
export function limitFurSlope(furLen, pos, index, nV, tint, { slope = FUR_SLOPE_DEFAULTS.slope, free = FUR_SLOPE_DEFAULTS.free, perVertex = null } = {}) {
  const res = { shortened: 0, maxCut: 0 };
  if (!furLen || !(slope > 0) || !(free > 0)) return res;
  const L0 = Float32Array.from(furLen.subarray(0, nV));
  const active = new Uint8Array(nV);
  let any = false;
  for (let v = 0; v < nV; v++) {
    if (L0[v] > 0 && HAIRY(Math.round(tint[v * 4 + 3]))) { active[v] = 1; any = true; }
  }
  if (!any) return res;
  // the allowed slope of each vertex's hair (0 = unlimited)
  const sOf = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    if (!active[v]) continue;
    let s = perVertex ? perVertex[v] : slope;
    if (perVertex && !(s > 0)) s = Infinity; // a species' explicit "leave as painted"
    sOf[v] = Number.isFinite(s) ? s * Math.max(1, L0[v] / free) : 0;
  }
  // adjacency (CSR) over the active vertices
  const deg = new Uint32Array(nV + 1);
  for (let i = 0; i < index.length; i += 3) {
    for (let e = 0; e < 3; e++) {
      const u = index[i + e], v = index[i + ((e + 1) % 3)];
      if (u < nV && v < nV && active[u] && active[v]) { deg[u + 1]++; deg[v + 1]++; }
    }
  }
  for (let v = 0; v < nV; v++) deg[v + 1] += deg[v];
  const adj = new Uint32Array(deg[nV]), fill = deg.slice(0, nV);
  for (let i = 0; i < index.length; i += 3) {
    for (let e = 0; e < 3; e++) {
      const u = index[i + e], v = index[i + ((e + 1) % 3)];
      if (u < nV && v < nV && active[u] && active[v]) { adj[fill[u]++] = v; adj[fill[v]++] = u; }
    }
  }
  // Dijkstra: settle vertices in increasing (limited) length; a settled vertex bounds its neighbours
  const U = furLen;
  let hk = new Float64Array(4096), hv = new Int32Array(4096), n = 0;
  const push = (k, v) => {
    if (n === hk.length) { const k2 = new Float64Array(n * 2); k2.set(hk); hk = k2; const v2 = new Int32Array(n * 2); v2.set(hv); hv = v2; }
    let i = n++;
    while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; }
    hk[i] = k; hv[i] = v;
  };
  const pop = () => {
    const top = hv[0], k = hk[--n], v = hv[n];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= n) break;
      const r = l + 1, m = r < n && hk[r] < hk[l] ? r : l;
      if (hk[m] >= k) break;
      hk[i] = hk[m]; hv[i] = hv[m]; i = m;
    }
    hk[i] = k; hv[i] = v;
    return top;
  };
  const done = new Uint8Array(nV);
  for (let v = 0; v < nV; v++) if (active[v]) push(U[v], v);
  while (n) {
    const v = pop();
    if (done[v]) continue;
    done[v] = 1;
    const Uv = U[v], px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2];
    for (let k = deg[v]; k < deg[v + 1]; k++) {
      const u = adj[k];
      if (done[u] || sOf[u] === 0) continue;
      const cand = Uv + sOf[u] * Math.hypot(pos[u * 3] - px, pos[u * 3 + 1] - py, pos[u * 3 + 2] - pz);
      if (cand < U[u]) { U[u] = cand; push(cand, u); }
    }
  }
  for (let v = 0; v < nV; v++) {
    const cut = L0[v] - U[v];
    if (cut > 0.0001) res.shortened++;
    if (cut > res.maxCut) res.maxCut = cut;
  }
  return res;
}
