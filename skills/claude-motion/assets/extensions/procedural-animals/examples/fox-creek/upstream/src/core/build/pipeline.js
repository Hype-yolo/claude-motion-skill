// The build pipeline: species data -> seeded individual -> SDF sculpt -> meshed regions -> skin
// weights -> coat -> proportion warp and size -> packed, transferable arrays.
//
// Every stage is deterministic in (species, seed, options), so a worker can redo `prepare` from the
// species id and seed instead of receiving functions.
import { SDFModel } from '../sdf/sdf.js';
import { meshRegion } from './mesh.js';
import { computeWeights } from './weights.js';
import { composeWarps, warpMesh, warpScaleAt } from './warp.js';
import { transformRig } from '../rig/rig.js';
import { rng } from '../math/vec.js';
import { eyeFrameOf } from '../sdf/eyeSocket.js';
import { limitFurSlope, FUR_SLOPE_DEFAULTS } from './furSlope.js';
import { measureSeams } from './seams.js';
import { sharpenFinEdges } from './finEdges.js';

export const FORMAT_VERSION = 1;

// Mesh resolution multiplier and render settings per quality tier.
export const QUALITY = {
  hero: { res: 1.0, shells: 40, fins: true, eyePatches: true },
  high: { res: 1.3, shells: 28, fins: true, eyePatches: true },
  medium: { res: 2.0, shells: 16, fins: false, eyePatches: false },
  low: { res: 3.0, shells: 8, fins: false, eyePatches: false },
  crowd: { res: 4.2, shells: 0, fins: false, eyePatches: false },
};

export function normaliseOptions(opts = {}) {
  const quality = QUALITY[opts.quality] ? opts.quality : 'high';
  return { seed: (opts.seed ?? 1) >>> 0, quality, sex: opts.sex, age: opts.age, variant: opts.variant, overrides: opts.overrides || {} };
}

export function prepare(species, opts) {
  const o = normaliseOptions(opts);
  const R = rng(o.seed * 2654435761 + 12345);
  const params = { ...species.variation(R, o), ...o.overrides };
  params.seed = o.seed;
  const rig = species.rig(params);
  const model = new SDFModel();
  species.sculpt(model, rig, params);
  if (params.minThick) inflateThin(model, QUALITY[o.quality].res, params.minThick);
  const Q = QUALITY[o.quality];
  const reg = species.regions(rig, params, Q);
  return { o, params, rig, model, reg, Q };
}

// primitives tagged thin (ears, tail tips) are inflated at coarse tiers so they do not vanish
function inflateThin(model, res, minThick) {
  if (res < 1.9) return;
  const t = minThick * res;
  for (const p of model.prims) {
    if (!p.thin || p.carve) continue;
    if (p.type === 0) for (let i = 12; i < 15; i++) p.P[i] = Math.max(p.P[i], t);
    if (p.type === 3) { p.P[12] = Math.max(p.P[12], t); p.P[13] = Math.max(p.P[13], Math.min(t, p.P[12])); }
  }
}

export function meshJob(species, opts, jobIndex, prep = prepare(species, opts)) {
  return prep.reg.jobs[jobIndex].map((R) => meshRegion(prep.model, R));
}

export function jobCount(species, opts) {
  return prepare(species, opts).reg.jobs.length;
}

export function finish(species, opts, meshedJobs, prep = prepare(species, opts), onProgress = () => {}) {
  const t0 = now();
  const { rig, model, reg, params, o, Q } = prep;
  const order = reg.jobs.flat().map((r) => r.name);
  const regDef = Object.fromEntries(reg.jobs.flat().map((r) => [r.name, r]));
  const parts = meshedJobs.flat().sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  let nV = 0, nI = 0;
  for (const p of parts) { p.v0 = nV; nV += p.count; nI += p.indices.length; }
  let pos = new Float32Array(nV * 3), nrm = new Float32Array(nV * 3);
  let index = new Uint32Array(nI);
  const lists = new Array(nV);
  const regionOf = new Uint8Array(nV);
  const patchOf = new Uint8Array(nV);
  const rigidBone = new Int16Array(nV).fill(-1);
  let io = 0;
  parts.forEach((p, pi) => {
    pos.set(p.positions, p.v0 * 3);
    nrm.set(p.normals, p.v0 * 3);
    if (p.patch) patchOf.set(p.patch, p.v0);
    for (let i = 0; i < p.indices.length; i++) index[io++] = p.indices[i] + p.v0;
    const L = p.listIds.map((ids) => Array.from(ids, (id) => model.prims[id]));
    const rb = regDef[p.name].rigidBone ? rig.BONE[regDef[p.name].rigidBone].index : -1;
    for (let i = 0; i < p.count; i++) { lists[p.v0 + i] = L[p.listIndex[i]]; regionOf[p.v0 + i] = pi; rigidBone[p.v0 + i] = rb; }
  });
  const regionNames = parts.map((p) => p.name);
  // fin slabs tagged `sharpen` get knife edges below the cell size (finEdges.js; opt-in)
  if (model.prims.some((pr) => pr.sharpen)) sharpenFinEdges({ pos, nrm, index, lists, nV, regionOf }, parts.map((p) => regDef[p.name].h));
  onProgress('weights');
  const weights = computeWeights({ pos, nrm, index, lists, rigidBone, nV }, rig);
  const t1 = now();
  // cross-fade of overlapping regions
  let fade = new Float32Array(nV).fill(1);
  if (reg.fade) for (let v = 0; v < nV; v++) fade[v] = reg.fade(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], regionNames[regionOf[v]], patchOf[v]);
  // how far the overlapping surfaces lie apart at their hand-over: the depth of the renderer's seam
  // skirt (seams.js)
  const seams = measureSeams({ pos, nrm, index, nV, fade, regionOf, patchOf, hOf: parts.map((p) => regDef[p.name].h) });
  onProgress('coat');
  const coat = species.coat({ model, rig, params, pos, nrm, index, lists, regionOf, regionNames, patchOf, rigidBone, weights, nV, fade, rng: rng(o.seed * 7919 + 17), quality: o.quality, Q });
  // (species.render may be a function of the individual: a mark colour that follows the morph)
  const hints = (typeof species.render === 'function' ? species.render(params) : species.render) || {};
  // no fur walls: hair may not rise faster than the render hint's slope above the hair around it
  // (furSlope.js; the crowd tier draws no shells)
  let furSlope = null;
  if (Q.shells > 0 && coat.furLen && coat.tint && hints.furSlope !== false) {
    furSlope = limitFurSlope(coat.furLen, pos, index, nV, coat.tint, {
      slope: hints.furSlope ?? FUR_SLOPE_DEFAULTS.slope, free: hints.furSlopeFree ?? FUR_SLOPE_DEFAULTS.free, perVertex: coat.furSlope || null,
    });
  }
  if (Q.shells <= 0) prefilterPattern(coat, index, nV, pos, hints.markColor || [0.016, 0.0105, 0.0075]);
  const t2 = now();

  // ---- extra (non-SDF) surfaces: feather cards etc., rigidly skinned, with their own attributes
  const extra = species.surfaces ? species.surfaces({ rig, params, Q, quality: o.quality, model }) : null;
  let skinIndex = weights.skinIndex, skinWeight = weights.skinWeight;
  if (extra && extra.nV) {
    const n0 = nV, n1 = nV + extra.nV;
    const cat = (a, b, k, T = Float32Array) => { const r = new T(n1 * k); r.set(a.subarray(0, n0 * k)); r.set(b, n0 * k); return r; };
    const idx = new Uint32Array(index.length + extra.index.length);
    idx.set(index); for (let i = 0; i < extra.index.length; i++) idx[index.length + i] = extra.index[i] + n0;
    pos = cat(pos, extra.pos, 3); nrm = cat(nrm, extra.nrm, 3); index = idx;
    skinIndex = cat(skinIndex, extra.skinIndex, 4, Uint16Array); skinWeight = cat(skinWeight, extra.skinWeight, 4);
    coat.comb = cat(coat.comb, extra.comb, 3); coat.tint = cat(coat.tint, extra.tint, 4);
    coat.pattern = cat(coat.pattern || new Float32Array(n0).fill(1), extra.pattern, 1);
    coat.mark = cat(coat.mark || new Float32Array(n0).fill(1), extra.mark, 1);
    coat.furLen = cat(coat.furLen || new Float32Array(n0), extra.furLen, 1);
    coat.patternColor = cat(coat.patternColor || constant4(n0, [0.016, 0.0105, 0.0075, 1]), extra.patternColor, 4);
    coat.surf = cat(coat.surf || new Float32Array(n0 * 4), extra.surf, 4);
    fade = cat(fade, new Float32Array(extra.nV).fill(1), 1);
    nV = n1; nI = index.length;
  }

  // ---- proportion warps and size, applied to the finished surface and the skeleton
  const size = params.size || 1;
  const warps = [...(params.warps || [])];
  if (size !== 1) warps.push({ type: 'scale', k: size });
  const W = composeWarps(warps);
  let rigOut = rig;
  let eyes = (species.eyeSpecs ? species.eyeSpecs(params, rig) : []).map((e) => {
    const f = eyeFrameOf(e.spec, e.headOrigin, e.side);
    return { ...e, frame: f, scale: 1 };
  });
  const scaleLen = (arr, k) => { if (arr && k !== 1) for (let i = 0; i < arr.length; i++) arr[i] *= k; };
  if (W) {
    warpMesh(pos, nrm, W);
    rigOut = transformRig(rig, W);
    eyes = eyes.map((e) => ({ ...e, frame: { ...e.frame, c: W(e.frame.c) }, scale: warpScaleAt(W, e.frame.c) }));
    scaleLen(coat.pattern, size);
    scaleLen(coat.mark, size);
    scaleLen(coat.furLen, Math.pow(size, 0.35));
  }

  const out = {
    version: FORMAT_VERSION,
    species: species.id,
    seed: o.seed,
    quality: o.quality,
    params: jsonSafe(params),
    nV,
    pos, nrm, index,
    skinIndex,
    skinWeight,
    comb: coat.comb,
    tint: coat.tint,
    coat: interleave(nV, coat.pattern, coat.mark, coat.furLen, fade),
    pat: coat.patternColor || constant4(nV, [0.016, 0.0105, 0.0075, 1]),
    surf: coat.surf || new Float32Array(nV * 4),
    // seam skirt depth (m, final size; the warps are within ~15 %): coatMaterial sinks the handed-over
    // half of every cross-fade band by up to this much under the surface taking over
    seamSink: +(seams.sink * size * 1.15).toFixed(6),
    joints: rigOut.J,
    bones: rigOut.BONES.map((b) => ({ name: b.name, parent: b.parent, headJ: b.headJ, tailJ: b.tailJ, region: b.region, group: b.group })),
    refJoints: rig.J,
    eyes: eyes.map((e) => ({ side: e.side, bone: e.bone || 'head', c: e.frame.c, x: e.frame.x, y: e.frame.y, z: e.frame.z, scale: e.scale * (size !== 1 && !W ? size : 1), spec: e.spec, look: e.look || {} })),
    prims: model.prims.map((p) => ({ type: p.type, P: Array.from(p.P), bone: p.bone, group: p.group, part: p.part, carve: p.carve, tag: p.tag, k: p.k })),
    stats: {
      nV, tris: nI / 3, prims: model.prims.length, bones: rig.BONES.length, weightsMs: Math.round(t1 - t0), coatMs: Math.round(t2 - t1),
      ...(furSlope ? { furSlopeShortened: furSlope.shortened, furSlopeMaxCutMm: +(furSlope.maxCut * 1000).toFixed(1) } : {}),
      ...(seams.samples ? { seamMaxMm: +(seams.max * 1000).toFixed(2), seamSinkMm: +(seams.sink * 1000).toFixed(2) } : {}),
      ...(coat.stats || {}),
    },
  };
  return out;
}

export function buildSync(species, opts, onProgress = () => {}) {
  const t0 = now();
  const prep = prepare(species, opts);
  const jobs = prep.reg.jobs.map((_, i) => { onProgress('mesh ' + i); return meshJob(species, opts, i, prep); });
  const d = finish(species, opts, jobs, prep, onProgress);
  d.stats.buildMs = Math.round(now() - t0);
  return d;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Crowd tier (no shells, ~2 cm cells): the pattern and mark fields are signed distances sampled per
// vertex, and features are about the size of a cell (spot centres even sit on vertices), so the
// crisp zero level aliases: dense small spots (paws, lower legs) cover every vertex and turn whole
// paws black, spots become polygons, a tail tip ring swallows the white tip. Prefilter like a mip
// level: per vertex, the fraction of its surrounding triangles the (linearly interpolated) field
// covers. Spots are then drawn as that coverage (pattern inside everywhere, the pattern colour's
// intensity scaled by the coverage: soft blobs of the right size and tone); crisp marks (tear lines,
// tail rings) are mixed into the base colour by their coverage.
function prefilterPattern(coat, index, nV, pos, markColor) {
  // per vertex: area-weighted fraction of the incident triangles the linear field covers, capped by
  // the size of the features around it (a vertex on a 4 mm spot centre, with neighbours on other
  // small spots, reads fully covered although the spots cover ~15 % of its area): the deepest
  // inside value in its 1-ring is taken as the local feature radius r, coverage <= (r / (h / 2))^2
  const coverage = (f) => {
    const acc = new Float64Array(nV), wsum = new Float64Array(nV), deep = new Float64Array(nV), hsum = new Float64Array(nV), hn = new Float64Array(nV);
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i], b = index[i + 1], c = index[i + 2];
      const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      const fr = negFraction(f[a], f[b], f[c]);
      const d = Math.max(0, -f[a], -f[b], -f[c]), h = Math.hypot(ux, uy, uz) + Math.hypot(vx, vy, vz);
      for (const v of [a, b, c]) { acc[v] += area * fr; wsum[v] += area; deep[v] = Math.max(deep[v], d); hsum[v] += h; hn[v] += 2; }
    }
    return Float32Array.from(acc, (x, v) => {
      if (!(wsum[v] > 0)) return 0;
      const h = hsum[v] / hn[v];
      return Math.min(x / wsum[v], Math.min(1, (deep[v] / (0.5 * h)) ** 2));
    });
  };
  if (coat.pattern) {
    const cov = coverage(coat.pattern);
    const pc = coat.patternColor || (coat.patternColor = new Float32Array(nV * 4).map((_, i) => [0.016, 0.0105, 0.0075, 1][i % 4]));
    // (a contrast curve keeps the blobs reading as spots rather than a stain)
    for (let v = 0; v < nV; v++) { const k = Math.min(1, Math.max(0, (cov[v] - 0.12) / 0.43)); pc[v * 4 + 3] *= k * k * (3 - 2 * k); coat.pattern[v] = -1; }
  }
  if (coat.mark && coat.tint) {
    // crisp marks have no intensity channel: their coverage goes into the base colour instead
    const cov = coverage(coat.mark), t = coat.tint;
    for (let v = 0; v < nV; v++) {
      const k = cov[v];
      for (let i = 0; i < 3; i++) t[v * 4 + i] += (markColor[i] - t[v * 4 + i]) * k;
      coat.mark[v] = 1;
    }
  }
}
// area fraction of a triangle where the linear interpolation of the vertex values is negative
function negFraction(a, b, c) {
  const neg = (a < 0) + (b < 0) + (c < 0);
  if (neg === 0) return 0;
  if (neg === 3) return 1;
  let n, p1, p2;
  if (neg === 1) { [n, p1, p2] = a < 0 ? [a, b, c] : b < 0 ? [b, a, c] : [c, a, b]; return (n * n) / ((n - p1) * (n - p2)); }
  [n, p1, p2] = a >= 0 ? [a, b, c] : b >= 0 ? [b, a, c] : [c, a, b]; // n: the single non-negative one
  return 1 - (n * n) / ((n - p1) * (n - p2));
}

function interleave(n, a, b, c, d) {
  const out = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) { out[v * 4] = a ? a[v] : 1; out[v * 4 + 1] = b ? b[v] : 1; out[v * 4 + 2] = c ? c[v] : 0; out[v * 4 + 3] = d ? d[v] : 1; }
  return out;
}
function constant4(n, c) {
  const out = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) out.set(c, v * 4);
  return out;
}
function jsonSafe(o) { return JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v))); }

// Arrays that can be transferred from a worker (or written to a bake file).
export const ARRAY_KEYS = ['pos', 'nrm', 'index', 'skinIndex', 'skinWeight', 'comb', 'tint', 'coat', 'pat', 'surf'];
export function transferables(d) { return ARRAY_KEYS.map((k) => d[k].buffer); }
