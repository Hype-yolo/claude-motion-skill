// The wolf's coat: a dense double coat painted per vertex in reference space.
//
// Colour fields follow the grey wolf's pattern (Mech 1974): a dark
// saddle of black-tipped guard hair from the withers into the tail top, a dark cape / "V" across the
// shoulders, a pale patch in front of it, grizzled mane, cinnamon brow, tawny legs and ear backs,
// pale cream mask on the muzzle sides, cheeks and throat, cream belly and inner legs, a dark tail
// gland spot a third of the way down the tail and a black tip, black lip line and nose. The grizzle
// is the shader's agouti band (surf.z): light roots, a dark band below a light tip.
// Morphs: grey (agouti), black (melanistic, grey frosting on muzzle and chest), pale (arctic-type
// cream) and tawny (brown Eurasian type); pups are a sooty uniform grey-brown and fluffy.
// Fur length: long ruff / hackles / cape, long breeches and brush, short sleek face and lower legs.
import { HEAD_O, MUZZLE_Z0, HS } from './rig.js';
import { neckS, eyePatchOf } from './regions.js';
import { noseAt, noseFrame, nostrilSDF, NOSTRIL } from './sculpt.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, smoothField } from '../../core/build/coatKit.js';

const P3 = {
  // sRGB swatches, neutral-light albedo
  grey: {
    saddle: 0x3a3330, flank: 0xae9a86, lowFlank: 0xc0ad97, cape: 0x4e4744, capePale: 0xd6cbbb, mane: 0x8a7f76, maneDark: 0x514842,
    legOuter: 0xc4a888, legInner: 0xe2d8c8, belly: 0xe2d8c8, throat: 0xd9cfbe, cheek: 0xdbd2c3, brow: 0x6a635b, crown: 0x6c6660,
    muzzleTop: 0x837262, earBack: 0x9a8068, earRim: 0x2e2724, earInner: 0xc2b8aa, tailTop: 0x6e6152, tailTip: 0x141110, tailUnder: 0xcdbca4,
    rump: 0xcfc0aa, paw: 0xcfb99c, gland: 0x1a1614, legLine: 0x5a4a3c,
    ag: { saddle: 0.85, flank: 0.45, cape: 0.7, mane: 0.6, head: 0.35, leg: 0.1, tail: 0.45 },
  },
  // (side2: charcoal shoulders, neck and face #20-2f, the brown-grey undercoat showing on the flanks and
  // thighs #45-6c, black legs. The render's tone curve crushes dark albedos: the old palette (#221e1b
  // saddle) rendered as a featureless #02-0b silhouette; these land ~2x under the photo in sRGB, the
  // same ratio as the grey morph against side1, whose light is brighter than the studio's)
  black: {
    saddle: 0x3e3632, flank: 0x6e6053, lowFlank: 0x766757, cape: 0x3a3330, capePale: 0x564b42, mane: 0x4a413a, maneDark: 0x3a3330,
    legOuter: 0x3a3330, legInner: 0x443c36, belly: 0x62574e, throat: 0x544a42, cheek: 0x4a423c, brow: 0x3a332e, crown: 0x403833,
    muzzleTop: 0x3e3632, earBack: 0x3a3330, earRim: 0x1e1a18, earInner: 0x4a423c, tailTop: 0x3a3330, tailTip: 0x1c1816, tailUnder: 0x4e453e,
    rump: 0x6e6053, paw: 0x3a3330, gland: 0x1c1816, legLine: 0x2a2522,
    ag: { saddle: 0.45, flank: 0.35, cape: 0.4, mane: 0.45, head: 0.2, leg: 0.1, tail: 0.35 },
  },
  pale: {
    saddle: 0xc6b797, flank: 0xd9d0bb, lowFlank: 0xe2dac7, cape: 0xcdbf9f, capePale: 0xebe5d6, mane: 0xddd4c0, maneDark: 0xc9bc9f,
    legOuter: 0xe2d9c6, legInner: 0xece6d8, belly: 0xece6d8, throat: 0xefe9dd, cheek: 0xefe9dd, brow: 0xcab897, crown: 0xd1c5ab,
    muzzleTop: 0xd2c19f, earBack: 0xcdbb9a, earRim: 0x9d8c70, earInner: 0xe8e1d2, tailTop: 0xc0af8d, tailTip: 0x8c7b62, tailUnder: 0xe6dfcd,
    rump: 0xe6dfcd, paw: 0xe2d9c6, gland: 0x9a886c, legLine: 0xd2c5a8,
    ag: { saddle: 0.3, flank: 0.12, cape: 0.2, mane: 0.15, head: 0.08, leg: 0, tail: 0.3 },
  },
  tawny: {
    saddle: 0x4d3d30, flank: 0xa88a68, lowFlank: 0xb89a78, cape: 0x62503f, capePale: 0xd2bf9f, mane: 0x8a7258, maneDark: 0x5c4a3a,
    legOuter: 0xc09a70, legInner: 0xd8c4a8, belly: 0xd8c4a8, throat: 0xdecbb0, cheek: 0xd9c7ad, brow: 0x8c6444, crown: 0x7e6650,
    muzzleTop: 0x927052, earBack: 0xa67448, earRim: 0x3a2c22, earInner: 0xc6b69c, tailTop: 0x6a5440, tailTip: 0x1c1612, tailUnder: 0xc6ad8a,
    rump: 0xcdb592, paw: 0xc9ab86, gland: 0x221a14, legLine: 0x5e4834,
    ag: { saddle: 0.65, flank: 0.35, cape: 0.5, mane: 0.45, head: 0.25, leg: 0.08, tail: 0.4 },
  },
};
const PUP = 0x5b534c; // sooty grey-brown natal coat

function palette(p) {
  const base = P3[p.variant] || P3.grey;
  const k = p.coatWarmth || 0, l = p.coatLightness || 0, juv = p.juv || 0;
  const pup = srgb(PUP).map((c) => c * (p.variant === 'black' ? 0.45 : p.variant === 'pale' ? 1.9 : 1));
  // grey individuals: a seeded tone from cream-grey (toward the pale palette, up to 35 %, less grizzle:
  // threequarter1, front1) to dark grizzled (the dorsal colours up to 25 % toward the black palette and
  // more black-tipped guard hair, the cream mask, throat and belly kept: face1, threequarter2)
  const tone = p.variant === 'grey' || !P3[p.variant] ? p.greyTone || 0 : 0;
  const KEEP_PALE = /cheek|throat|belly|legInner|earInner|capePale|rump|tailUnder/;
  const ag = {};
  for (const [key, a] of Object.entries(base.ag)) ag[key] = tone > 0 ? mix(a, P3.pale.ag[key], 0.35 * tone) : Math.min(1, a * (1 - 0.3 * tone));
  const out = { ag };
  for (const [key, hex] of Object.entries(base)) {
    if (key === 'ag') continue;
    let c = srgb(hex);
    if (tone > 0 && P3.pale[key] !== undefined) c = mix3(c, srgb(P3.pale[key]), 0.35 * tone);
    else if (tone < 0 && P3.black[key] !== undefined && !KEEP_PALE.test(key)) c = mix3(c, srgb(P3.black[key]), -0.25 * tone);
    c = [c[0] * (1 + 0.1 * k + l), c[1] * (1 + 0.02 * k + l), c[2] * (1 - 0.1 * k + l)];
    // pups: most of the pattern is washed into the uniform natal coat (face mask stays a little paler)
    const keep = /cheek|throat|belly|legInner|earInner/.test(key) ? 0.35 : /tailTip|earRim|gland/.test(key) ? 0.5 : 0.12;
    if (juv > 0) c = mix3(c, pup.map((v, i) => v * (0.9 + 0.2 * (c[i] > v ? 1 : 0))), juv * (1 - keep));
    out[key] = c;
  }
  return out;
}

// Blend fur length and flow across the head (region 2) / neck (region 1) and neck / torso (0) lines: a
// Dijkstra distance from the lines over the mesh graph, then Laplacian smoothing restricted to the band
// within W of them (the band's outer ring and bare skin stay locked), iterated enough to diffuse ~2 cm on
// the finest cells.
function blendCollar(furLen, comb, region, tint, pos, nrm, nb, nV, headCell, W = 0.035) {
  const dist = new Float64Array(nV).fill(Infinity); // (double: the heap keys are doubles)
  const heap = [];
  const push = (v, d) => {
    heap.push([d, v]);
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
    }
    return top;
  };
  const hn = (r) => r <= 2;
  for (let v = 0; v < nV; v++) {
    if (!hn(region[v])) continue;
    for (const u of nb[v]) if (hn(region[u]) && region[u] !== region[v]) { dist[v] = 0; push(v, 0); break; }
  }
  const band = [];
  while (heap.length) {
    const [d, v] = pop();
    if (d > dist[v]) continue;
    band.push(v);
    for (const u of nb[v]) {
      if (!hn(region[u])) continue;
      const e = Math.hypot(pos[u * 3] - pos[v * 3], pos[u * 3 + 1] - pos[v * 3 + 1], pos[u * 3 + 2] - pos[v * 3 + 2]);
      const du = d + e;
      if (du < W && du < dist[u]) { dist[u] = du; push(u, du); }
    }
  }
  if (!band.length) return;
  const free = new Uint8Array(nV);
  for (const v of band) if (tint[v * 4 + 3] === MAT.FUR && dist[v] < W * 0.9) free[v] = 1;
  const iters = Math.min(160, Math.ceil(2 * (0.02 / headCell) ** 2));
  const tmp = new Float32Array(4 * band.length);
  for (let it = 0; it < iters; it++) {
    for (let k = 0; k < band.length; k++) {
      const v = band[k];
      if (!free[v]) { tmp[k * 4] = furLen[v]; tmp[k * 4 + 1] = comb[v * 3]; tmp[k * 4 + 2] = comb[v * 3 + 1]; tmp[k * 4 + 3] = comb[v * 3 + 2]; continue; }
      // (neighbours weighted by 1 / edge length: the ramp comes out even per millimetre of skin, not per
      // hop, so the short edges of the marching-cubes mesh do not end up steeper)
      let a = 0, cx = 0, cy = 0, cz = 0, n = 0;
      for (const u of nb[v]) {
        if (tint[u * 4 + 3] !== MAT.FUR) continue;
        const w = 1 / Math.max(0.0005, Math.hypot(pos[u * 3] - pos[v * 3], pos[u * 3 + 1] - pos[v * 3 + 1], pos[u * 3 + 2] - pos[v * 3 + 2]));
        a += w * furLen[u]; cx += w * comb[u * 3]; cy += w * comb[u * 3 + 1]; cz += w * comb[u * 3 + 2]; n += w;
      }
      if (!n) { tmp[k * 4] = furLen[v]; tmp[k * 4 + 1] = comb[v * 3]; tmp[k * 4 + 2] = comb[v * 3 + 1]; tmp[k * 4 + 3] = comb[v * 3 + 2]; continue; }
      tmp[k * 4] = 0.5 * furLen[v] + (0.5 * a) / n;
      tmp[k * 4 + 1] = 0.5 * comb[v * 3] + (0.5 * cx) / n;
      tmp[k * 4 + 2] = 0.5 * comb[v * 3 + 1] + (0.5 * cy) / n;
      tmp[k * 4 + 3] = 0.5 * comb[v * 3 + 2] + (0.5 * cz) / n;
    }
    for (let k = 0; k < band.length; k++) {
      const v = band[k];
      furLen[v] = tmp[k * 4]; comb[v * 3] = tmp[k * 4 + 1]; comb[v * 3 + 1] = tmp[k * 4 + 2]; comb[v * 3 + 2] = tmp[k * 4 + 3];
    }
  }
  // hair flow back into each vertex's tangent plane, unit length
  for (const v of band) {
    if (!free[v]) continue;
    const n = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    let t = [comb[v * 3], comb[v * 3 + 1], comb[v * 3 + 2]];
    t = sub(t, mul(n, dot(t, n)));
    if (len(t) < 1e-6) continue;
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];
  }
}

// The lip line as a distance over the skin: per vertex of the muzzle, how far (m, along the mesh) the curve lies
// where this surface enters the other part (the head's skin entering the jaw, or the jaw's entering the head), from
// sd = the other part's signed distance at each vertex. The sources are the crossing points on the mesh edges (sd
// interpolated linearly), so the field is linear across the crossing and a band of any width ends where it should,
// even on cells wider than the band. adj: the vertex has a neighbour on the other side of the crossing.
function lipLineDistance(sd, zone, nb, pos, nV, max) {
  const geo = new Float64Array(nV).fill(Infinity);
  const adj = new Uint8Array(nV);
  const heap = [];
  const push = (v, d) => {
    heap.push([d, v]);
    for (let i = heap.length - 1; i > 0;) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
    }
    return top;
  };
  const el = (u, v) => Math.hypot(pos[u * 3] - pos[v * 3], pos[u * 3 + 1] - pos[v * 3 + 1], pos[u * 3 + 2] - pos[v * 3 + 2]);
  for (let v = 0; v < nV; v++) {
    if (!zone[v]) continue;
    for (const u of nb[v]) {
      if (!zone[u] || (sd[u] >= 0) === (sd[v] >= 0)) continue;
      adj[v] = 1;
      const d = (el(u, v) * Math.abs(sd[v])) / (Math.abs(sd[v]) + Math.abs(sd[u]) || 1);
      if (d < geo[v]) { geo[v] = d; push(v, d); }
    }
  }
  while (heap.length) {
    const [d, v] = pop();
    if (d > geo[v]) continue;
    for (const u of nb[v]) {
      if (!zone[u] || (sd[u] >= 0) !== (sd[v] >= 0)) continue;
      const du = d + el(u, v);
      if (du < max && du < geo[u]) { geo[u] = du; push(u, du); }
    }
  }
  return { geo, adj };
}

export function wolfCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, weights, nV, params } = ctx;
  const { BONES, AXIAL } = rig;
  const AX_LEN = weights.axialLengths;
  const R = rng(4241 + (params.coatSeed || 0));
  // whisker follicles (head-local, per side): 4 rows of 5 along the upper lip, each individual's own
  // (offsets of ~1 mm, sizes, a few missing: a regular grid read as a printed pattern)
  const RF = rng(9127 + (params.coatSeed || 0));
  const FOLLICLES = [0, 1].map(() => {
    const out = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
      const zc = 0.1375 - j * 0.0046 - (i & 1) * 0.0023 - i * 0.0012 + (RF() - 0.5) * 0.0018;
      const yc = -0.0045 - i * 0.0047 - 0.12 * (0.1375 - zc) + (RF() - 0.5) * 0.0014;
      const sg = 0.0014 + 0.0006 * RF(), a = RF() < 0.12 ? 0 : 0.75 + 0.25 * RF();
      out.push({ z: zc, y: yc, s2: sg * sg, a });
    }
    return out;
  });
  const C = palette(params);
  const AG = C.ag;
  const juv = params.juv || 0;
  const hw = params.headW || 1, mz = params.muzzle || 1;
  const ruffK = params.ruff ?? 1;
  const saddleExt = params.saddle ?? 0; // how far the saddle reaches down the flanks (-1..1)
  const maskK = params.mask ?? 1; // contrast of the pale facial mask
  const legLine = params.legLine ?? 0; // dark line on the front of the forelegs (0..1)
  const frost = params.frost ?? 0; // black morph: grey frosting on the muzzle and chest (age)
  const nOff = (params.coatSeed || 0) % 997;
  // mark bands at least half a head cell wide (the head is meshed at 2.5 mm x the tier's res)
  const Qt = ctx.Q || { res: 1, eyePatches: true };
  const headCell = 0.0025 * Qt.res;
  const band = (w) => Math.max(w, 0.5 * headCell);
  // (the lid margins are meshed by the eyelid patches where the tier has them)
  const EP = eyePatchOf(Qt);
  const eyeBand = (w) => Math.max(w, 0.5 * (EP ? EP.h : headCell));
  const { dominant, axialS, skinIndex, skinWeight, limbMember, limbWhich } = weights;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8], sTip = AX_LEN[AX_LEN.length - 1];
  const tailLen = sTip - sTailBase;
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  // the leather: the front lobe and the dorsal plate (sculpt.js)
  const leatherPrims = model.prims.filter((p) => p.tag === 'nose' || p.tag === 'nosetop');
  const GROOVE = noseAt(0, -0.0122, 0.0005); // head-local: the philtrum groove under the pad's front lobe
  const caninePrims = model.prims.filter((p) => p.tag === 'canine' || p.tag === 'tooth');
  const jawPrims = model.forPart('jaw').filter((p) => p.tag !== 'canine' && p.tag !== 'tooth');
  const bodyPrims = model.forPart('body');
  const headPrims = bodyPrims.filter((p) => p.bone === 'head' && !p.carve && p.tag !== 'canine' && p.tag !== 'tooth');
  const earPrims = model.prims.filter((p) => p.tag === 'ear');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|femur|tibia|metatarsus|hpaw)/.test(b.name));
  const isPaw = BONES.map((b) => /^(fpaw|hpaw)/.test(b.name));
  const isFront = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw)/.test(b.name));
  // head-local coordinates of a reference-space point (undo head width and muzzle stretch)
  const headLocal = (p) => {
    const x = (p[0] - HEAD_O[0]) / hw / HS, y = (p[1] - HEAD_O[1]) / HS;
    let z = (p[2] - HEAD_O[2]) / HS;
    if (z > MUZZLE_Z0) z = MUZZLE_Z0 + (z - MUZZLE_Z0) / mz;
    return [x, y, z];
  };

  // --- regions per vertex (0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw) and limb blend
  const region = new Uint8Array(nV);
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  const junction = new Float32Array(nV);
  const tailT = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const bn = BONES[dominant[v]].name;
    const p = P(v);
    let lb = -1, lw = 0;
    for (let k = 0; k < 4; k++) {
      const b = skinIndex[v * 4 + k], w = skinWeight[v * 4 + k];
      if (isLimb[b] && w > lw) { lw = w; lb = b; }
    }
    legBone[v] = lb;
    const m = limbMember[v];
    legness[v] = lb >= 0 ? smoothstep(0.15, 0.85, m) : 0;
    junction[v] = lb >= 0 ? 4 * m * (1 - m) : 0;
    if (partOf[v] === 2) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (axialS[v] > sTailBase + 0.02 && bn.startsWith('tail')) { region[v] = 4; tailT[v] = clamp((axialS[v] - sTailBase) / tailLen, 0, 1); }
    else if (axialS[v] < sOcc + 0.01 || (partOf[v] === 1 && neckS(p[0], p[1], p[2]) > 0.02)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) { legness[v] = 0; junction[v] = 0; }
  }
  const underFactor = (v) => {
    const n = N(v), p = P(v), li = limbWhich[v];
    if (li < 0 || junction[v] <= 0) return 0;
    if (li <= 1) return junction[v] * Math.max(smoothstep(0.15, -0.55, n[2]) * smoothstep(0.5, 0.4, p[1]), smoothstep(0.2, -0.6, n[1]));
    return junction[v] * smoothstep(0.35, -0.45, n[1] + 0.35 * Math.abs(n[2]));
  };

  // --- ventral (pale underside) factor
  const ventral = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let w = 0;
    if (r === 0) {
      w = smoothstep(-0.05, -0.65, n[1]);
      // chest front between the forelegs: pale bib
      if (p[2] > 0.25) w = Math.max(w, smoothstep(0.56, 0.44, p[1]) * smoothstep(0.08, 0.035, Math.abs(p[0])) * smoothstep(-0.3, 0.4, n[2]));
      w *= smoothstep(0.6, 0.5, p[1]) * 0.55 + 0.45;
    } else if (r === 1) {
      // throat and the front of the ruff
      w = smoothstep(0.1, -0.5, n[1]) * smoothstep(-0.4, 0.3, n[2]) + smoothstep(0.62, 0.52, p[1]) * 0.6;
    } else if (r === 4) {
      w = 0;
    } else if (r === 2 || r === 6) {
      const h = headLocal(p);
      w = smoothstep(-0.03, -0.06, h[1]) * smoothstep(-0.2, -0.7, n[1]) + (r === 6 ? 0.7 : 0);
    }
    const L = legness[v];
    if (L > 0) {
      const side = p[0] >= 0 ? 1 : -1;
      const inner = smoothstep(0.1, -0.6, n[0] * side);
      const wl = inner * 0.8 * smoothstep(0.08, 0.3, p[1]) + smoothstep(-0.3, -0.85, n[1]) * 0.5;
      w = mix(w, wl, L);
    }
    w = Math.max(w, underFactor(v) * 0.95);
    ventral[v] = clamp(w, 0, 1);
  }

  // --- comb (hair flow), bind space
  const comb = new Float32Array(nV * 3);
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let d;
    const bone = BONES[dominant[v]];
    if (r === 5) {
      d = norm(sub(bone.tail, bone.head));
    } else if (r === 2 || r === 6) {
      const h = headLocal(p);
      // out from the nose over the face; the cheek ruff sweeps back and out
      const fromNose = norm(sub(h, [0, -0.01, 0.16]));
      d = norm(add(fromNose, [0, -0.2, -0.5]));
      if (h[2] < 0.0 && Math.abs(h[0]) > 0.035) d = norm(add(d, [Math.sign(h[0]) * 0.6, -0.5, -0.8]));
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = AXIAL.points[seg], b = AXIAL.points[Math.min(seg + 1, AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.45 * Math.abs(n[0]), 0]));
      if (r === 1) d = norm(add(d, [0, -0.5, 0])); // the ruff hangs down and back
      const L = legness[v];
      if (L > 0 && legBone[v] >= 0) {
        const lbn = BONES[legBone[v]];
        let dl = norm(sub(lbn.tail, lbn.head));
        if (isPaw[legBone[v]]) dl = norm(add(dl, [0, 0, 0.4]));
        else dl = norm(add(dl, [0, -0.2, -0.3]));
        d = norm(add(mul(d, 1 - L), mul(dl, L)));
      }
    }
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];
  }

  // --- per-vertex paint
  // --- the lip line: the distance over the skin from where the head's skin enters the jaw (and the jaw's enters the
  // head), for the black lip margins below (a band of a set width along that curve, see lipLineDistance)
  const lipSd = new Float32Array(nV), lipZone = new Uint8Array(nV);
  for (let v = 0; v < nV; v++) {
    if (partOf[v] !== 1 && partOf[v] !== 2) continue;
    const p = P(v), h = headLocal(p);
    if (h[2] < -0.05 || h[1] > 0.005) continue;
    lipZone[v] = 1;
    lipSd[v] = partOf[v] === 2 ? SDFModel.evalList(headPrims, p[0], p[1], p[2]) : SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
  }
  const LIP = lipLineDistance(lipSd, lipZone, weights.neighbors, pos, nV, 0.02);
  // the band's value at a vertex: its signed distance from the lip line minus the band width w (< 0 = black); next
  // to the crossing the hidden side carries the field on linearly, further inside a dark inner margin 3 mm deep (it
  // shows when the mouth opens), then the mouth's own colour
  const LIP_T = (z) => smoothstep(0.092, 0.108, z); // the share of the band along the crossing (the front of the mouth)
  // (inside, also everything within 1.5 mm of the other surface: where the skin runs just inside the other part, its
  // mouth colours showed through that part's mesh as red specks along the lip)
  const lipBand = (v, w) => {
    const g = LIP.geo[v];
    if (!lipZone[v] || g === Infinity) return 1;
    if (lipSd[v] < 0) return Math.min(LIP.adj[v] ? -g - w : g - 0.003, -lipSd[v] - 0.0015);
    return g - w;
  };

  const furLen = new Float32Array(nV);
  const tint = new Float32Array(nV * 4);
  const markSDF = new Float32Array(nV).fill(1);
  const surf = new Float32Array(nV * 4);
  const g3 = (h, c, rr) => Math.exp(-(((Math.abs(h[0]) - c[0]) / rr[0]) ** 2 + ((h[1] - c[1]) / rr[1]) ** 2 + ((h[2] - c[2]) / rr[2]) ** 2));
  const X = [1, 0, 0];
  const tailSegDorsal = (v) => {
    const bone = BONES[dominant[v]];
    const d = norm(sub(bone.tail, bone.head));
    return norm([0, -d[2], d[1]]);
  };

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let col, fl = 0.02, ag = 0, mat = MAT.FUR, mark = 1, under = 0.4;
    // low-frequency noise (ragged pattern edges) and a finer grizzle field
    const nz = fbm3(p[0] * 7 + nOff, p[1] * 7, p[2] * 7, 3) - 0.5;
    const nz2 = vnoise3(p[0] * 38 + nOff, p[1] * 38, p[2] * 38) - 0.5;
    // (hair-length variation of the long coat at a coarser scale: at 38 / m it stepped 4-7 mm between
    // neighbouring 2-3 mm head cells in the ruff, a field of small fur walls)
    const nzL = vnoise3(p[0] * 16 + nOff, p[1] * 16, p[2] * 16) - 0.5;
    if (r === 0 || r === 1) {
      const up = n[1];
      const vent = ventral[v];
      // flanks -> saddle by the surface normal, ragged
      const dors = smoothstep(-0.2, 0.55, up + 0.35 * nz + 0.3 * saddleExt + 0.15 * smoothstep(0.62, 0.72, p[1]));
      col = mix3(C.lowFlank, C.flank, smoothstep(-0.3, 0.3, up + 0.2 * nz));
      ag = mix(AG.flank * 0.7, AG.flank, smoothstep(-0.3, 0.3, up));
      const alongSaddle = smoothstep(0.34, 0.24, p[2]) * smoothstep(-0.42, -0.3, p[2]);
      if (r === 0) {
        col = mix3(col, C.saddle, dors * 0.92 * alongSaddle);
        ag = mix(ag, AG.saddle, dors * alongSaddle);
        // cape: a dark band from the withers slanting down in front of the shoulder, and a pale
        // patch in front of it (between the mane and the cape)
        const capeLine = p[2] - (0.37 + (0.66 - p[1]) * 0.55);
        const cape = Math.exp(-(((capeLine + 0.04 * nz) / 0.045) ** 2)) * smoothstep(0.45, 0.58, p[1]);
        const pale = Math.exp(-(((capeLine - 0.075) / 0.04) ** 2)) * smoothstep(0.5, 0.6, p[1]) * smoothstep(0.66, 0.6, p[1]);
        col = mix3(col, C.capePale, pale * 0.55 * (1 - dors));
        col = mix3(col, C.cape, cape * 0.75);
        ag = mix(ag, AG.cape, cape);
        // pale buttocks behind the thighs
        const rump = smoothstep(-0.33, -0.4, p[2]) * smoothstep(-0.2, -0.7, n[2]) * smoothstep(0.66, 0.55, p[1]);
        col = mix3(col, C.rump, rump * 0.85);
        ag *= 1 - rump * 0.7;
        col = mix3(col, C.belly, vent);
        ag *= 1 - vent;
        // guard-hair lengths: flanks, long saddle, longest over the cape / hackles, belly fringe
        const withers = smoothstep(0.1, 0.3, p[2]) * smoothstep(0.45, 0.9, up);
        fl = mix(0.03, 0.042, smoothstep(0.2, 0.85, up)) * (1 + 0.14 * nzL);
        fl = Math.max(fl, 0.058 * ruffK * withers);
        fl = mix(fl, 0.022, smoothstep(0.3, 0.9, vent));
        if (p[2] < -0.3) fl = Math.max(fl, 0.04 * rump);
      } else {
        // mane: grizzled, dark-tipped along the top, cream throat
        const top = smoothstep(0.1, 0.85, up + 0.25 * nz);
        col = mix3(C.mane, C.maneDark, top * 0.8);
        ag = mix(AG.mane * 0.7, AG.mane, top);
        // dark collar line down the side of the neck, edging the pale throat
        const collar = Math.exp(-(((vent - 0.35 + 0.2 * nz) / 0.18) ** 2)) * (1 - top);
        col = mix3(col, C.maneDark, collar * 0.45);
        col = mix3(col, C.throat, smoothstep(0.35, 0.8, vent));
        ag *= 1 - smoothstep(0.3, 0.7, vent);
        fl = mix(0.064, 0.05, vent) * ruffK * (1 + 0.16 * nzL);
      }
      const L = legness[v];
      if (L > 0) {
        const lb = legBone[v];
        const front = lb >= 0 && isFront[lb];
        let lc = mix3(C.legOuter, C.legInner, smoothstep(0.1, 0.7, ventral[v]));
        // the upper leg keeps some of the body colour
        lc = mix3(lc, col, smoothstep(0.32, 0.5, p[1]) * 0.6);
        // dark line down the front of the foreleg (many grey wolves)
        if (front && legLine > 0) lc = mix3(lc, C.legLine, legLine * smoothstep(0.35, 0.8, n[2]) * smoothstep(0.08, 0.14, p[1]) * smoothstep(0.34, 0.26, p[1]) * smoothstep(0.3, -0.2, Math.abs(n[0])));
        let lf = mix(0.008, 0.024, smoothstep(0.1, 0.42, p[1]));
        // breeches on the back of the thighs, feathering behind the forearm
        if (!front) lf = Math.max(lf, 0.048 * smoothstep(-0.1, -0.7, n[2]) * smoothstep(0.24, 0.45, p[1]));
        else lf = Math.max(lf, 0.02 * smoothstep(-0.2, -0.8, n[2]) * smoothstep(0.14, 0.3, p[1]));
        if (lb >= 0 && isPaw[lb]) { lf = 0.004; lc = C.paw; }
        col = mix3(col, lc, L);
        ag = mix(ag, AG.leg * smoothstep(0.15, 0.45, p[1]), L);
        fl = mix(fl, lf, L);
      }
      under = 0.45;
    } else if (r === 4) {
      const t = tailT[v];
      const dors = dot(n, tailSegDorsal(v));
      const top = smoothstep(-0.15, 0.35, dors + 0.25 * nz);
      col = mix3(C.tailUnder, C.tailTop, top);
      // the saddle runs into the tail top
      ag = AG.tail * top;
      // tail gland: a dark oval on the top, a third of the way down
      const gl = Math.exp(-(((t - 0.3) / 0.075) ** 2)) * smoothstep(0.2, 0.75, dors);
      col = mix3(col, C.gland, gl * 0.7);
      // black tip
      const tip = smoothstep(0.76, 0.84, t + 0.03 * nz);
      col = mix3(col, C.tailTip, tip);
      ag *= 1 - tip;
      // the longest hair at the tip: a pointed brush beyond the last vertebra
      fl = mix(0.04, 0.05, smoothstep(0.1, 0.5, t)) + 0.016 * smoothstep(0.7, 1, t);
      under = 0.45;
    } else if (r === 5) {
      const earP = earPrims[p[0] > 0 ? 0 : 3];
      const faceDir = [earP.P[9], earP.P[10], earP.P[11]];
      const upE = [earP.P[6], earP.P[7], earP.P[8]];
      const lat = [earP.P[3], earP.P[4], earP.P[5]];
      const front = dot(n, faceDir);
      const rel = sub(p, [earP.P[0], earP.P[1], earP.P[2]]);
      const ht = dot(rel, upE) / 0.075; // ~0 base .. 1 tip
      const edge = Math.abs(dot(rel, lat)) / (0.03 * Math.max(0.3, 1 - ht));
      // (the ear's root is as furry as the head around it: no step in hair length at the ear base)
      const earRoot = 1 - smoothstep(0.0, 0.4, ht);
      if (front > 0.3) {
        col = mix3(C.earBack, C.earInner, smoothstep(0.3, 0.75, front));
        // the dark edge of the pinna frames the pale cup (face1, face2)
        col = mix3(col, C.earRim, smoothstep(0.78, 1.0, edge) * 0.6);
        fl = mix(0.012 * (1 - smoothstep(0.5, 1.0, ht)), 0.02, earRoot);
      } else {
        col = C.earBack;
        // dark rims and tip on the back of the ear
        col = mix3(col, C.earRim, Math.max(smoothstep(0.7, 1.0, edge), smoothstep(0.7, 0.95, ht)) * 0.85);
        fl = mix(0.007, 0.02, earRoot);
      }
      ag = AG.head * 0.5;
    } else {
      // ---------------- head & jaw
      // The mask (face1, face2, threequarter2): a grizzled grey-brown crown, darker along the midline
      // between the eyes; a tawny bridge over the top and upper half of the muzzle; cream on the upper
      // lips and lower muzzle sides that runs back, without a break, into large cream cheek patches under
      // and behind the eyes and down to the throat (the tawny / cream line rises from the nose's lower
      // third to just under the eye); a dark crescent under each eye and a tear line from its inner
      // corner; a dark grizzled temple band from the outer corner back above the cream cheek; the cheek
      // ruff grizzled grey with a dark rim framing the pale cheek; pale spots above the eyes.
      const h = headLocal(p);
      const ax = Math.abs(h[0]), lat = Math.abs(n[0]);
      col = C.crown;
      ag = AG.head;
      const brow = smoothstep(-0.03, 0.02, h[2]) * smoothstep(0.075, 0.03, h[2]) * smoothstep(0.0, 0.03, h[1]);
      col = mix3(col, C.brow, brow * 0.6);
      // (the forehead and the upper bridge are grizzled, salt-and-pepper: face1, face2, front1)
      ag = mix(ag, AG.mane, brow * 0.5);
      // dark midline from the stop up the forehead
      const midDark = Math.exp(-((ax / 0.012) ** 2)) * smoothstep(0.012, 0.032, h[1]) * smoothstep(0.062, 0.03, h[2]) * smoothstep(-0.06, -0.015, h[2]);
      col = mix3(col, C.maneDark, midDark * 0.45 * (1 - juv));
      ag = mix(ag, AG.mane, midDark * 0.6);
      // the cream zone lies under the mask line: just under the eye, falling back along the cheek (the
      // temple band above it); the bridge (medial, above the lip line) stays tawny down to the nose
      const nzl = 0.003 * nz;
      const onMuzzle = smoothstep(0.036, 0.052, h[2]);
      const maskLine = 0.012 + 0.22 * Math.min(0, h[2] - 0.03) + nzl;
      // (the cream blends into the grizzled cheek and the tawny bridge over 1.5-2 cm of skin, through warm tawny and
      // grizzle: threequarter2, lying1; a 1 cm edge read as a husky's crisp mask)
      const below = smoothstep(maskLine + 0.009, maskLine - 0.012, h[1]);
      // (over the last 3-4 cm the cream of the upper lips comes up beside the nose to the middle of the pad,
      // the bridge colour above it: face1, face2, threequarter2)
      const tipK = smoothstep(0.105, 0.145, h[2]);
      const bridgeW = mix(0.036, 0.024, smoothstep(0.05, 0.14, h[2])) + 0.003 * nz;
      const lipLine = mix(-0.012, -0.016, smoothstep(0.06, 0.14, h[2])) + 0.016 * tipK + nzl;
      const medial = smoothstep(bridgeW + 0.005, bridgeW - 0.003, ax);
      const mtop = onMuzzle * Math.max(medial * smoothstep(lipLine - 0.009, lipLine + 0.01, h[1]), 1 - below);
      // (tawny toward the nose, the grizzled crown colour carried down the bridge between the eyes;
      // face1 / face2: the bridge is grizzled, never a flat orange)
      col = mix3(col, C.muzzleTop, mtop * 0.9 * (1 - 0.85 * smoothstep(0.115, 0.07, h[2])));
      ag = mix(ag, AG.head, mtop);
      // cream mask: under the mask line (cheeks, sides of the muzzle, upper lips), the lips and chin, the
      // eyebrow spots
      const face = smoothstep(0.1, 0.35, lat + onMuzzle) * smoothstep(0.018, 0.03, ax + 0.03 * onMuzzle) * smoothstep(-0.075, -0.045, h[2]);
      const cream = below * (1 - mtop) * face;
      const eyebrow = g3(h, [0.03, 0.041, 0.037], [0.013, 0.008, 0.014]) * 0.5; // (soft pale spots, not pips)
      const lowFace = smoothstep(-0.03, -0.055, h[1]) * smoothstep(-0.1, -0.6, n[1]) * (r === 6 ? 0.55 : 1);
      let mask = clamp(Math.max(cream, eyebrow, lowFace * 0.85, r === 6 ? 0.3 : 0) * maskK * 1.05, 0, 1);
      col = mix3(col, C.cheek, mask);
      // the middle of the transition warm (tawny, a little grizzle), on the muzzle and the cheeks
      const midT = 4 * mask * (1 - mask) * smoothstep(-0.02, 0.01, h[2]) * (r === 2 ? 1 : 0);
      col = mix3(col, mix3(C.muzzleTop, C.cheek, 0.35), 0.45 * midT);
      ag *= 1 - 0.95 * mask;
      // dark accents: a crescent under each eye, the tear line from its inner corner down the edge of the
      // bridge, the temple band from the outer corner back along the top of the cheek patch
      const edge = Math.exp(-(((ax - bridgeW) / 0.004) ** 2)) * onMuzzle * smoothstep(0.075, 0.05, h[2]) * smoothstep(-0.01, 0.008, h[1]) * 0.6;
      const crescent = g3(h, [0.036, 0.008, 0.036], [0.012, 0.005, 0.011]) * 0.65;
      const temple = Math.exp(-(((h[1] - maskLine - 0.006) / 0.006) ** 2)) * (1 - onMuzzle) * smoothstep(0.036, 0.05, ax) * smoothstep(-0.06, -0.03, h[2]) * 0.6;
      const eyeRing = g3(h, [0.034, 0.021, 0.036], [0.017, 0.013, 0.015]) * 0.45;
      col = mix3(col, C.maneDark, clamp(Math.max(edge, crescent, temple, eyeRing), 0, 1) * (1 - juv));
      // cheek ruff: grizzled like the mane; its front rim frames the pale cheek
      const ruffW = smoothstep(-0.035, -0.075, h[2]) * smoothstep(0.035, 0.055, ax) * smoothstep(0.02, -0.01, h[1]);
      const ruffRim = Math.exp(-(((h[2] + 0.06 + 0.004 * nz) / 0.01) ** 2)) * smoothstep(0.035, 0.055, ax) * smoothstep(0.03, 0.0, h[1]) * smoothstep(-0.08, -0.04, h[1]);
      col = mix3(col, mix3(C.mane, C.maneDark, 0.35), ruffW * 0.75);
      col = mix3(col, C.maneDark, ruffRim * 0.5 * (1 - juv));
      ag = mix(ag, AG.mane, Math.max(ruffW, ruffRim));
      // whisker follicles: ~4 rows of dark spots along the upper lip, from just behind the leather back
      // ~25 mm (threequarter2, lying1, face1): soft (the dark hair round each follicle), on the tiers whose
      // face mesh can hold them (hero, high: 2.5-3.3 mm cells)
      const wsK = smoothstep(0.0045, 0.003, headCell) * smoothstep(0.25, 0.55, lat) * (1 - juv);
      if (wsK > 0 && r === 2 && h[2] > 0.105 && h[2] < 0.145 && h[1] < 0.002 && h[1] > -0.032) {
        let sp = 0;
        for (const f of FOLLICLES[p[0] >= 0 ? 0 : 1]) sp = Math.max(sp, f.a * Math.exp(-(((h[2] - f.z) ** 2 + (h[1] - f.y) ** 2) / f.s2)));
        col = mix3(col, [0.02, 0.017, 0.015], 0.88 * sp * wsK);
      }
      // black morph: grey frosting on the lips and chin (patchy, with age)
      if (frost > 0) col = mix3(col, [0.2, 0.19, 0.18], frost * 0.55 * smoothstep(0.06, 0.1, h[2]) * smoothstep(-0.015, -0.04, h[1]) * smoothstep(-0.1, 0.25, nz + 0.12));
      // fur length: a 7 mm muzzle (research 8-15 mm, ~60 % sculpted), 9.5 mm under the eyes growing to 12.5 mm
      // behind them, a sleek 8 mm forehead and crown (face1, face2: the hair lies flat, flowing back from the
      // bridge; at 12.5-13 mm the shader clumped it into fleece-like tufts, and under the eye into a honeycomb
      // of scales), longer hair on the temples in front of the ears (the wide wolf face), the flaring cheek ruff
      fl = mix(mix(0.0125, 0.0095, smoothstep(-0.03, 0.01, h[2])), 0.007, smoothstep(0.03, 0.09, h[2]));
      const crown = smoothstep(0.006, 0.022, h[1]) * smoothstep(0.05, 0.036, ax) * smoothstep(-0.085, -0.06, h[2]);
      fl = mix(fl, Math.min(fl, 0.008), crown);
      // (salt-and-pepper: black-banded guard hair tips, as grizzled as the mane)
      if (mat === MAT.FUR) ag = mix(ag, Math.max(ag, AG.mane * (1 - mask)), crown * 0.7);
      const templeHair = smoothstep(0.04, 0.058, ax) * smoothstep(0.02, -0.02, h[2]) * smoothstep(-0.005, 0.015, h[1]) * smoothstep(0.075, 0.05, h[1]);
      fl = Math.max(fl, 0.022 * templeHair);
      // (the cheek ruff's hair grows over wider ramps than its colour: ~1 mm of skin per mm of length)
      const ruffL = smoothstep(-0.02, -0.085, h[2]) * smoothstep(0.03, 0.075, ax) * smoothstep(0.035, -0.035, h[1]);
      fl = Math.max(fl, 0.04 * ruffK * ruffL);
      // (the chin's hair a little longer under the front of the mouth: at 6 mm it read as a bare, pale lobe from the
      // front and below)
      if (r === 6) fl = mix(mix(0.006, 0.0085, smoothstep(0.095, 0.112, h[2]) * smoothstep(-0.03, -0.036, h[1])), 0.014, smoothstep(0.08, 0.0, h[2]));
      // back of the head blends into the mane
      if (r === 2 && h[2] < -0.055) {
        const b = smoothstep(-0.055, -0.12, h[2]);
        col = mix3(col, C.mane, b * 0.6);
        fl = mix(fl, 0.04 * ruffK, b);
      }
      // Crisp marks (lid margins, the nose outline, the black lips) as one continuous distance field:
      // the shader antialiases a mark by its screen-space gradient, so a field that jumps from a few mm
      // to 1 between neighbouring vertices drew a smeared, dashed lip line on the 5 mm cells of the
      // medium tier (a row of "teeth"). Every band is at least half a head cell wide.
      let md = 1e9;
      // eye rims (dark lid margins)
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        md = Math.min(md, Math.abs(de) - eyeBand(0.0019));
        if (Math.abs(de) < 0.0016) { mat = MAT.DARK_SKIN; fl = 0; }
        else fl = Math.min(fl, 0.0015 + 0.8 * Math.max(0, Math.abs(de) - 0.0045)); // (no crater of long brow hair round the lids)
      }
      // nose leather (the front lobe and the dorsal plate), with a thin dark fringe of fur behind its edge.
      // The nostrils are marks on the leather (render hint noseMarks: drawn as dark openings with no sheen),
      // the same comma the sculpt carves: a carved opening alone read as a faint dimple, and its shape is
      // lost on the 5 mm face cells of the medium tier.
      let dn = 1e9;
      for (const q of leatherPrims) dn = Math.min(dn, SDFModel.dist(q, p[0], p[1], p[2]));
      if (dn < 0.0022 && h[2] > 0.135) {
        mat = MAT.NOSE; col = C.nose || srgb(0x3f3a38); fl = 0; // (render hint noseTint: the shader's own leather grey)
        // (dilated by the inward bias of a linearly interpolated distance field on the tier's cells,
        // ~h^2 / 8r: on the 5 mm cells of medium the 4 mm openings otherwise all but vanished)
        const [lx, ly] = noseFrame(h);
        const dN = nostrilSDF(lx, ly) * HS - headCell * headCell / (8 * 0.0038);
        md = Math.min(md, dN);
        // the nostrils' lit rims: a paler band of leather along the upper and outer edge of each opening, and the
        // septum between them (face1, face2: black commas framed by grey leather; dark marks on a uniformly dark
        // pad read as dim ovals from above)
        const rim = smoothstep(0, 0.0008, dN) * smoothstep(0.0032, 0.0012, dN) * smoothstep(NOSTRIL.c[1] - 0.004, NOSTRIL.c[1] + 0.001, ly);
        const septum = smoothstep(0.0045, 0.002, Math.abs(lx)) * smoothstep(NOSTRIL.c[1] - 0.0065, NOSTRIL.c[1] - 0.003, ly) * smoothstep(NOSTRIL.c[1] + 0.006, NOSTRIL.c[1] + 0.002, ly);
        col = mix3(col, [0.17, 0.158, 0.15], 0.9 * Math.max(rim, 0.7 * septum));
      } else {
        if (dn < 0.005 && h[2] > 0.13) fl = Math.min(fl, 0.0035);
        md = Math.min(md, dn - band(0.0012) + 4 * Math.max(0, 0.13 - h[2]));
      }
      // the philtrum: a dark groove splitting the bottom of the pad (face1, threequarter2); only where the
      // face mesh can draw a line this thin (hero, high)
      // (from between the nostrils down the short rostral lip to the lip margin, the centre of the "w": face1,
      // face2; under a 3 cm deep lip, a groove this long drew a black stroke down the lip)
      // (a V cleft in the leather, narrow between the nostrils and widest at the pad's lower edge, running on as a soft
      // dark groove in the hair of the lip that fades toward the mouth. A straight-sided strip of mark ended in a flat
      // edge under the pad: a square tab of leather; the face cells cannot draw a mark narrower than about one cell,
      // so on the lip the groove is a colour and the hair over it is short)
      const yE = GROOVE[1] - 0.0019, dyE = h[1] - yE; // the leather's lower edge on the midline
      if (Qt.res <= 1.3 && h[2] > 0.125 && dyE > 0) md = Math.min(md, ax - 0.0009 * smoothstep(0.0035, 0.0, dyE) - 0.4 * headCell * smoothstep(0.0035, 0.0015, dyE));
      const groove = h[2] > 0.125 && dyE <= 0 ? Math.exp(-((ax / 0.0016) ** 2)) * smoothstep(-0.008, -0.0015, dyE) : 0;
      if (groove > 0.01 && mat === MAT.FUR) { col = mix3(col, [0.035, 0.03, 0.027], 0.85 * groove); fl = Math.min(fl, mix(fl, 0.0025, groove)); }
      // lips: head vertices near the jaw surface, jaw vertices near the head surface (black lip line);
      // the inner lip margin is black too, the mouth behind it dark red
      if (partOf[v] !== 2) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        // (palate and upper gums: dark pigmented skin; the shader's MOUTH albedo is a fixed pink)
        if (dj < -0.0005) { mat = MAT.SKIN; col = srgb(0x3c1c1e); fl = 0; }
        // the roof and the back of the mouth between the mandibles, above the jaw's floor (enclosed at rest):
        // mucosa, not throat fur (it showed as a pale blob at the back of the open mouth)
        else if (n[1] < -0.35 && ax < 0.017 && h[1] < -0.012 && h[2] > -0.05 && h[2] < 0.075 && dj < 0.02 && SDFModel.evalList(jawPrims, p[0], p[1] - 0.005, p[2]) < dj) { mat = MAT.SKIN; col = srgb(0x3c1c1e); fl = 0; }
        else if (dj < 0.0045 && h[2] > -0.02) {
          // (beside the chin at the front of the mouth, where the lip line runs down its sides, the flews' hair stays
          // long enough to fall over the crossing: face1, face2 show the "w" on top of the chin and plain fur beside it)
          const side = smoothstep(0.098, 0.108, h[2]) * smoothstep(0.006, 0.009, ax) * smoothstep(-0.03, -0.033, h[1]);
          fl = Math.min(fl, mix(0.002, 0.0055, side));
        }
        // (narrower toward the front of the mouth, where the rostral lip overhangs the lower lip and a wide band
        // covered the whole underside of the upper lip: from the front and below it read as an open mouth)
        // the black margin of the upper lip: a band of set width along the lip line, measured over the skin (as a
        // 3D distance to the jaw it filled every stretch where the lip runs close over the lower lip: from the front
        // a dark ring round the chin, at medium a thick zigzag), 3 mm toward the mouth corner, 1.3 mm at the front
        // (along the sides, where head and jaw graze, the 3D distance draws the strong line of lying1 and
        // threequarter2 that a band along the crossing alone left thin and broken; the two blend over 2 cm)
        const lipOld = dj >= 0 ? dj - band(mix(0.0032, 0.0018, smoothstep(0.09, 0.12, h[2]))) : -dj - band(0.0015);
        md = Math.min(md, mix(lipOld, lipBand(v, Math.max(0.0016 + 0.0016 * smoothstep(0.016, 0.004, ax) * smoothstep(0.112, 0.12, h[2]), 0.3 * headCell)), LIP_T(h[2])) + 4 * Math.max(0, -0.02 - h[2]));
        // (the margin is bare skin: the hair stops short of it, or the lip's hair hung over a band this thin)
        // (and the hair of the lip shortens toward the margin over ~1 cm: 7 mm hair hung over the line from the front)
        if (lipZone[v] && lipSd[v] >= 0 && LIP.geo[v] < 0.02) fl = Math.min(fl, mix(fl, 0.0006 + 0.5 * Math.max(0, LIP.geo[v] - 0.0012), LIP_T(h[2])));
        // (the short rostral lip between the leather and the mouth line keeps short hair, 4 mm: face1, face2 show the
        // mouth line plainly under the nose; 7 mm hair from under the leather hung down over it)
        fl = Math.min(fl, mix(fl, 0.004, smoothstep(0.026, 0.01, ax) * smoothstep(0.108, 0.122, h[2])));
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        // The part of the lower jaw hidden inside the upper lips at rest shows when the mouth opens. Only
        // its inside is mouth (rest normal up or toward the tongue): the pink tongue down the middle, dark
        // pigmented gums along the tooth rows. Its outer side stays the furred chin, with the black lower
        // lip along the rim (painting the whole hidden band as mouth drew the open jaw as a thin glossy
        // maroon rod, and its colour surfaced as red specks in the closed lip line at medium).
        // (the floor of the mouth between the mandibles at the back lies under the head's underside, not inside
        // it, but is enclosed at rest: it showed as a pale fur blob at the back of the open mouth)
        const floor = n[1] > 0.45 && ax < 0.02 && h[2] < 0.075;
        // the sides of the chin at the front of the mouth, below the mouth line: the lower lip's margin lies under the
        // flews there, and the chin's fur runs up to the crossing (a dark margin and bare skin along it outlined the
        // chin as a pale lobe from the front and below)
        const chinSide = smoothstep(0.1, 0.11, h[2]) * smoothstep(0.005, 0.008, ax) * smoothstep(-0.031, -0.034, h[1]);
        if (dh < 0.0 || floor) {
          const inward = n[0] * Math.sign(p[0] || 1);
          const inside = n[1] > 0.45 || inward < -0.3 || (ax < 0.006 && n[1] > 0.1);
          if (inside) { const tongue = ax < 0.0085 && h[2] < 0.108; mat = tongue ? MAT.MOUTH : MAT.SKIN; col = srgb(0x3a1b1d); fl = 0; }
          else if (n[1] > 0.15) { mat = MAT.DARK_SKIN; fl = 0; }
          else fl = Math.min(fl, 0.003 + 0.5 * Math.max(0, -dh - 0.003));
        } else if (dh < 0.0035) fl = Math.min(fl, mix(0.002, 0.004, chinSide));
        // (a wider band toward the mouth corner, where head and jaw graze and a narrow one broke into dashes)
        // (toward the front, where the lower lip lies under the rostral upper lip, the band narrows: a full band there
        // drew the line as a thick black "U" round the chin, at medium a cartoon mouth; the pigmented lower lip beside
        // the crease is a soft dark tint instead, continuous on the 5 mm cells of medium)
        // (the lower lip's margin along the same curve, narrower toward the front where it lies under the upper lip)
        const jf = smoothstep(0.1, 0.125, h[2]);
        const lipOld = dh >= 0 ? dh - band(h[2] < 0.06 ? 0.0035 : mix(0.0026, 0.0016, smoothstep(0.09, 0.12, h[2]))) : -dh - band(0.0015);
        md = Math.min(md, mix(lipOld, lipBand(v, Math.max(0.0008, 0.25 * headCell)), LIP_T(h[2])) + 0.004 * chinSide);
        if (dh >= 0 && mat === MAT.FUR && lipZone[v]) col = mix3(col, [0.06, 0.052, 0.046], 0.7 * jf * smoothstep(0.003, 0.001, LIP.geo[v]) * smoothstep(0.012, 0.006, ax));
      }
      // (far from every mark the field climbs quickly to 1, the value of unmarked skin)
      mark = Math.min(mark, md < 0.03 ? md : Math.min(1, 0.03 + (md - 0.03) * 20));
      // teeth
      for (const c of caninePrims) if (SDFModel.dist(c, p[0], p[1], p[2]) < 0.0012) { mat = MAT.KERATIN; col = srgb(0xe8e0cc); fl = 0; mark = Math.max(mark, 0.004); }
      under = 0.3;
    }
    // pups: fluffy and uniform
    if (juv > 0 && mat === MAT.FUR) {
      fl = mix(fl, Math.max(fl * 0.8, r === 2 || r === 6 ? 0.012 : 0.03), juv);
      ag *= 1 - 0.8 * juv;
    }
    // low-frequency colour variation and fine grizzle
    const cvh = fbm3(p[0] * 4 + 5 + nOff, p[1] * 4, p[2] * 4, 2) - 0.5;
    if (mat === MAT.FUR) col = [col[0] * (1 + 0.16 * nz + 0.1 * cvh + 0.08 * nz2), col[1] * (1 + 0.14 * nz + 0.08 * nz2), col[2] * (1 + 0.1 * nz - 0.08 * cvh + 0.08 * nz2)];
    markSDF[v] = mark;
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    surf[v * 4 + 2] = mat === MAT.FUR ? clamp(ag * (0.85 + 0.3 * nz2), 0, 1) : 0;
    surf[v * 4 + 3] = mat === MAT.FUR ? under : 0;
    if (mat === MAT.KERATIN) surf[v * 4] = 0.7;
    if (mat === MAT.NOSE) surf[v * 4] = 0.55;
  }

  // The collar: the short face hair met the 50-64 mm ruff at the head / neck region line, a hard hood
  // edge behind the cheeks and a lit rim under the jaw; the ruff met the 30-42 mm
  // body coat at the neck / torso line the same way. Fur length and hair flow are blended across both
  // lines over ~+-3 cm of skin, so the ruff frames the face without standing off it.
  blendCollar(furLen, comb, region, tint, pos, nrm, weights.neighbors, nV, headCell);
  // smooth fur length so the shells do not step (bare skin stays locked)
  smoothField(furLen, weights.neighbors, 3, (v) => tint[v * 4 + 3] > 0);

  void X; void R; void add;
  const pattern = new Float32Array(nV).fill(1);
  const patternColor = new Float32Array(nV * 4);
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, region, ventral, tailT };
}
