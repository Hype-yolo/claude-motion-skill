// Skin weights from the SDF sculpt.
//
//  * Axial skin (spine, neck, tail) gets smooth chain weights from a soft arc-length coordinate
//    along the axial polyline, relaxed over the surface so it never jumps where the chain bends.
//  * Each limb's share is a harmonic field on the mesh between two cores: the limb below its
//    proximal joint (1) and body skin clearly away from it (0). The whole hip or shoulder blends, so
//    the stretch of a swinging leg spreads over a wide region instead of creasing at the outline.
//    Inside the limb, bones blend by SDF distance to their primitives; thin distal joints blend
//    narrowly.
//  * Appendages (ears, horns...) blend by SDF distance; rigid parts (a separately meshed jaw) take
//    one bone.
// All distances scale with rig.unit (1 = cheetah-sized).
import { SDFModel } from '../sdf/sdf.js';
import { sub, dot, len, clamp, smoothstep } from '../math/vec.js';

export function buildNeighbors(index, nV) {
  const sets = new Array(nV);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    (sets[a] ||= new Set()).add(b).add(c);
    (sets[b] ||= new Set()).add(a).add(c);
    (sets[c] ||= new Set()).add(a).add(b);
  }
  return Array.from(sets, (s) => (s ? [...s] : []));
}

export function axialLengths(rig) {
  const P = rig.AXIAL.points;
  const L = [0];
  for (let i = 0; i < P.length - 1; i++) L.push(L[i] + len(sub(P[i + 1], P[i])));
  return L;
}

// Nearest-segment projection onto the axial polyline, plus a *soft* arc-length coordinate: where the
// polyline bends, points below the bend are nearly equidistant from two segments and the hard
// projection would jump by centimetres.
function makeProjector(rig) {
  const pts = rig.AXIAL.points;
  const AXP = pts.flat();
  const AXL = axialLengths(rig);
  const n = pts.length - 1;
  const soft = 0.018 * rig.unit;
  const ds = new Float64Array(n), ss = new Float64Array(n);
  return (px, py, pz) => {
    let best = 1e9, bi = 0, bt = 0;
    for (let i = 0; i < n; i++) {
      const ax = AXP[i * 3], ay = AXP[i * 3 + 1], az = AXP[i * 3 + 2];
      const bx = AXP[i * 3 + 3] - ax, by = AXP[i * 3 + 4] - ay, bz = AXP[i * 3 + 5] - az;
      let t = ((px - ax) * bx + (py - ay) * by + (pz - az) * bz) / (bx * bx + by * by + bz * bz);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - ax - bx * t, dy = py - ay - by * t, dz = pz - az - bz * t;
      const d = dx * dx + dy * dy + dz * dz;
      ds[i] = Math.sqrt(d);
      ss[i] = AXL[i] + t * (AXL[i + 1] - AXL[i]);
      if (d < best) { best = d; bi = i; bt = t; }
    }
    const dmin = Math.sqrt(best);
    let sw = 0, s = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.exp(-(ds[i] - dmin) / soft);
      if (w < 1e-4) continue;
      sw += w;
      s += w * ss[i];
    }
    return { seg: bi, t: bt, d: dmin, s: s / sw };
  };
}

// d: the vertex's depth on the ventral side of the axial chain. A blend override [a, b, lever] widens
// by lever x d on both sides: ventral skin far from the axis (a horse's throat under the jaw) swings
// further for the same joint angle, so it needs a proportionally longer blend to spread the stretch.
//
// By default a vertex blends only across the two joints of the segment it projects on, so a blend that
// reaches past the next joint (a long throat lever) is cut there: the skull's share drops from ~0.2-0.4
// to 0 across the mid-neck joint, and the neck creases along that line whenever the head pitches or turns.
// The weighting is a cascade: with a_j the share of the chain past joint j (its smoothstep), bone k takes
// a_1 ... a_k (1 - a_(k+1)), where the default clamps a_j to 1 once s is past joint j + 1 and to 0 before
// joint j - 1 (the cut). `axial.cascade` (opt-in) lets the blends of the joints listed run on into the next
// segment on either side and fade out there instead: `{ j: fade }` fades joint j's blend out over `fade` x
// rig.unit metres past joint j + 1 (to 1) and before joint j - 1 (to 0), at most the whole segment; an array
// of joint indices (or true for all) fades over the whole next segment. Continuous everywhere, and never
// further than one more segment, however long the lever (a deep breast does not follow the skull). Where a
// blend stays inside its two segments nothing changes.
export function chainWeights(rig, s, AXL = axialLengths(rig), d = 0) {
  const bones = rig.AXIAL.bones;
  const n = bones.length;
  const blend = (j) => {
    const ov = rig.AXIAL.blend[j];
    if (ov) { const e = (ov[2] || 0) * d; return smoothstep(AXL[j] + ov[0] * rig.unit - e, AXL[j] + ov[1] * rig.unit + e, s); }
    const l0 = AXL[j] - AXL[j - 1], l1 = AXL[j + 1] - AXL[j];
    const w = Math.min(0.4 * l0, 0.4 * l1, 0.07 * rig.unit);
    return smoothstep(AXL[j] - w, AXL[j] + w, s);
  };
  let i = 0;
  while (i < n - 1 && s > AXL[i + 1]) i++;
  const cas = rig.AXIAL.cascade;
  if (cas && (cas === true || Object.keys(cas).length)) {
    // fade length past the neighbouring joint (Infinity: the whole segment), 0 = cut (the default weighting)
    const fadeOf = (j) => (cas === true ? Infinity : Array.isArray(cas) ? (cas.includes(j) ? Infinity : 0) : (cas[j] ?? 0) * rig.unit);
    const share = (j) => {
      const f = fadeOf(j);
      if (j >= i + 2) return i === j - 2 && f > 0 && j >= 2 ? blend(j) * smoothstep(Math.max(AXL[j - 2], AXL[j - 1] - f), AXL[j - 1], s) : 0;
      if (j <= i - 1) return i === j + 1 && f > 0 && j + 2 <= n ? 1 - (1 - blend(j)) * (1 - smoothstep(AXL[j + 1], Math.min(AXL[j + 2], AXL[j + 1] + f), s)) : 1;
      return blend(j);
    };
    const out = new Map();
    let past = 1; // share of the chain beyond the joints so far
    for (let k = 0; k < n && past > 1e-6; k++) {
      const j = k + 1;
      const a = j > n - 1 ? 0 : share(j);
      const w = past * (1 - a);
      if (w > 1e-6) out.set(bones[k], w);
      past *= a;
    }
    return out;
  }
  const out = new Map([[bones[i], 1]]);
  if (i > 0) {
    const a = blend(i);
    if (a < 1) { out.set(bones[i], a); out.set(bones[i - 1], 1 - a); }
  }
  if (i < n - 1) {
    const a = blend(i + 1);
    if (a > 0) {
      const cur = out.get(bones[i]);
      out.set(bones[i], cur * (1 - a));
      out.set(bones[i + 1], (out.get(bones[i + 1]) || 0) + cur * a);
    }
  }
  return out;
}

/**
 * @param mesh { pos, nrm, index, lists (per-vertex prim lists), rigidBone (per-vertex bone index or -1), nV }
 */
export function computeWeights(mesh, rig) {
  const { pos, index, lists, nV } = mesh;
  const rigid = mesh.rigidBone;
  const U = rig.unit;
  const { BONES, BONE } = rig;
  const NB = BONES.length;
  const limbIds = Object.keys(rig.LIMBS);
  const limbs = limbIds.map((id) => rig.LIMBS[id]);
  const NL = limbs.length;
  const groupsOf = ['axial', ...limbIds, ...rig.appendages.map((a) => a.group)];
  const NG = groupsOf.length;
  const W = new Float32Array(nV * NB);
  const axialS = new Float32Array(nV);
  const segT = new Float32Array(nV * 2);
  const axD = new Float32Array(nV);
  const GD = new Float32Array(nV * NG).fill(1e9);
  const bd = new Float64Array(NB);
  const sigB = 0.011 * U, sigBDistal = 0.0035 * U;
  const DISTAL = new Uint8Array(NB), PROXIMAL = new Uint8Array(NB);
  for (const L of limbs) {
    for (const n of L.distal || []) DISTAL[BONE[n].index] = 1;
    for (const n of L.proximal || []) PROXIMAL[BONE[n].index] = 1;
  }
  const limbBW = Array.from({ length: NL }, () => new Array(nV));
  // skin of the tail (nearest primitive on a tail bone) never belongs to a limb: a tail hanging close
  // to the hocks (a wolf's brush, a horse's hair) otherwise took thigh weights and tore when the
  // legs moved
  const tailSkin = new Uint8Array(nV);
  const TAILB = new Uint8Array(NB);
  for (const b of BONES) if (/^tail\d+$/.test(b.name)) TAILB[b.index] = 1;
  const topBone = new Int8Array(nV * NL);
  const webTag = new Int8Array(nV * NL);
  const nbr = buildNeighbors(index, nV);
  const project = makeProjector(rig);
  const webTags = new Set(rig.webTags);
  const gIndex = (g) => groupsOf.indexOf(g);

  for (let v = 0; v < nV; v++) {
    const px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2];
    const pr = project(px, py, pz);
    axialS[v] = pr.s;
    {
      // depth on the ventral side of the axial chain (throat, belly): the lever of a blend override.
      // Ventral = the segment direction (nose -> tail) turned 90 deg down in the sagittal plane
      const P = rig.AXIAL.points, a0 = P[pr.seg], a1 = P[pr.seg + 1];
      const dy = a1[1] - a0[1], dz = a1[2] - a0[2], dl = Math.hypot(dy, dz) || 1;
      const oy = py - (a0[1] + dy * pr.t), oz = pz - (a0[2] + dz * pr.t);
      axD[v] = Math.max(0, (oy * dz - oz * dy) / dl);
    }
    segT[v * 2] = pr.seg;
    segT[v * 2 + 1] = pr.t;
    if (rigid[v] >= 0) continue;
    bd.fill(1e9);
    for (const prim of lists[v]) {
      if (prim.carve) continue;
      if (prim._gi === undefined) {
        prim._gi = gIndex(prim.group);
        if (!BONE[prim.bone]) throw new Error(`primitive ${prim.tag} uses unknown bone ${prim.bone}`);
        prim._bi = BONE[prim.bone].index;
      }
      const gi = prim._gi;
      if (gi < 0) continue;
      const d = SDFModel.dist(prim, px, py, pz) - prim.bias;
      if (d < GD[v * NG + gi]) GD[v * NG + gi] = d;
      if (d < bd[prim._bi]) bd[prim._bi] = d;
    }
    {
      let dm = 1e9, bm = -1;
      for (let bi = 0; bi < NB; bi++) if (bd[bi] < dm) { dm = bd[bi]; bm = bi; }
      if (bm >= 0 && TAILB[bm]) tailSkin[v] = 1;
    }
    for (let li = 0; li < NL; li++) {
      const g = li + 1;
      if (GD[v * NG + g] > 1e8) continue;
      const uniq = [];
      for (const prim of lists[v]) if (prim._gi === g && !prim.carve && !uniq.includes(prim._bi)) uniq.push(prim._bi);
      let bmin = 1e9, bestB = -1;
      for (const bi of uniq) if (bd[bi] < bmin) { bmin = bd[bi]; bestB = bi; }
      // webs and sheet muscles that span limb and body never anchor the limb core
      let pmin = 1e9, ptag = '';
      for (const prim of lists[v]) {
        if (prim._gi !== g || prim.carve) continue;
        const dp = SDFModel.dist(prim, px, py, pz) - prim.bias;
        if (dp < pmin) { pmin = dp; ptag = prim.tag; }
      }
      webTag[v * NL + li] = webTags.has(ptag) ? 1 : 0;
      // thin distal joints fold 100+ degrees: keep their blend narrow
      let distal = false;
      for (const bi of uniq) if (DISTAL[bi] && bd[bi] - bmin < 0.02 * U) distal = true;
      const sig = distal ? sigBDistal : sigB;
      let sum = 0;
      const tmp = uniq.map((bi) => { const w = Math.exp(-(bd[bi] - bmin) / sig); sum += w; return [bi, w]; });
      limbBW[li][v] = tmp.map(([bi, w]) => [bi, w / sum]);
      topBone[v * NL + li] = bestB === BONE[limbs[li].field.top].index ? 1 : 0;
    }
  }

  // relax the axial coordinate over the surface
  {
    const tmpS = new Float32Array(nV);
    for (let it = 0; it < 24; it++) {
      for (let v = 0; v < nV; v++) {
        const ns = nbr[v];
        if (!ns.length || rigid[v] >= 0) { tmpS[v] = axialS[v]; continue; }
        let a = 0;
        for (const n of ns) a += axialS[n];
        tmpS[v] = 0.5 * axialS[v] + (0.5 * a) / ns.length;
      }
      axialS.set(tmpS);
    }
  }

  // body skin never takes the weights of the tail beyond its root: skin at the back of a thigh or
  // buttock lies nearer to a hanging tail's segments than to the pelvis and projected onto them (it
  // swung with the tail). axial.bodyTail: tail segments body skin may still blend into (1: up to the
  // tail1 joint; 0: only across the tail base, for a tail that hangs down behind the buttocks)
  {
    const k = rig.AXIAL.bones.indexOf('tail0');
    if (k >= 0) {
      const sMax = axialLengths(rig)[k + (rig.AXIAL.bodyTail ?? 1)];
      for (let v = 0; v < nV; v++) if (!tailSkin[v] && axialS[v] > sMax) axialS[v] = sMax;
    }
  }

  // harmonic limb membership fields
  const limbM = Array.from({ length: NL }, () => new Float32Array(nV));
  const J = rig.J;
  for (let li = 0; li < NL; li++) {
    const L = limbs[li], F = L.field, g = li + 1, m = limbM[li];
    const A = J[F.a], B = J[F.b], AB = sub(B, A), ab2 = dot(AB, AB);
    const free = [];
    const aCore = F.aCore * U, aBody = F.aBody * U, midX = (F.midX || 0) * U;
    const e0 = (F.soft0 ?? -0.006) * U, e1 = (F.soft1 ?? 0.01) * U;
    const lateralAxis = F.lateralAxis || [L.side, 0, 0];
    for (let v = 0; v < nV; v++) {
      const dG = GD[v * NG + g];
      if (rigid[v] >= 0 || dG > 1e8 || tailSkin[v]) { m[v] = 0; continue; }
      // > 0: closer to the limb than to the body and than to any other limb (a big plantigrade hind
      // foot is further from the body than from the forefoot: it must not join the foreleg)
      let dO = GD[v * NG];
      for (let l2 = 0; l2 < NL; l2++) if (l2 !== li && GD[v * NG + l2 + 1] < dO) dO = GD[v * NG + l2 + 1];
      const a = dO - dG;
      const mb = smoothstep(e0, e1, a);
      const px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2];
      const t = ((px - A[0]) * AB[0] + (py - A[1]) * AB[1] + (pz - A[2]) * AB[2]) / ab2;
      // never let a limb pull skin across the midline (chest floor, groin)
      const lateral = F.noMidline ? 1 : px * lateralAxis[0] + py * lateralAxis[1] + pz * lateralAxis[2];
      if (a > aCore && (t > F.tCore || !topBone[v * NL + li]) && !webTag[v * NL + li] && lateral > 0.0) { m[v] = 1; }
      else if (a < aBody || lateral < midX) { m[v] = 0; }
      else { m[v] = mb * clamp(t / F.tCore, 0, 1); free.push(v); }
    }
    const omega = 1.85;
    for (let it = 0; it < 320; it++) {
      for (let i = 0; i < free.length; i++) {
        const v = free[i], ns = nbr[v];
        if (!ns.length) continue;
        let a = 0;
        for (const n of ns) a += m[n];
        m[v] = m[v] + omega * (a / ns.length - m[v]);
      }
    }
    for (const v of free) m[v] = clamp(m[v], 0, 1);
  }

  // assemble
  const AXL = axialLengths(rig);
  for (let v = 0; v < nV; v++) {
    const o = v * NB;
    if (rigid[v] >= 0) { W[o + rigid[v]] = 1; continue; }
    let rest = 1;
    for (let li = 0; li < NL; li++) {
      const mv = limbM[li][v];
      const mm = mv * rest;
      if (mm <= 1e-4) continue;
      const bw = limbBW[li][v];
      const topI = BONE[limbs[li].field.top].index;
      // in the blend zone only the proximal bones may pull body skin; distal bones take over as m -> 1
      const kd = mv * mv * mv * mv;
      let prox = 0;
      if (bw) for (const [bi, w] of bw) if (PROXIMAL[bi]) prox += w;
      if (bw && bw.length) {
        for (const [bi, w] of bw) {
          const wp = PROXIMAL[bi] && prox > 1e-6 ? w / prox : 0;
          W[o + bi] += mm * (kd * w + (1 - kd) * wp);
        }
        if (prox <= 1e-6) W[o + topI] += mm * (1 - kd);
      } else W[o + topI] += mm;
      rest -= mm;
    }
    for (const ap of rig.appendages) {
      const gi = gIndex(ap.group);
      const dE = GD[v * NG + gi];
      if (dE > 1e8) continue;
      const bl = ap.blend || [-0.003, 0.005];
      // nearer to this appendage than to the body AND than to any other appendage (long ears: the
      // tip of one ear is far from the body, so the body test alone let the first ear take it)
      let dO = 1e9;
      for (const ap2 of rig.appendages) if (ap2 !== ap) dO = Math.min(dO, GD[v * NG + gIndex(ap2.group)]);
      const e = smoothstep(bl[0] * U, bl[1] * U, Math.min(GD[v * NG], dO) - dE) * rest;
      if (e > 1e-4) { W[o + BONE[ap.bone].index] += e; rest -= e; }
    }
    if (rest > 1e-5) for (const [bn, w] of chainWeights(rig, axialS[v], AXL, axD[v])) W[o + BONE[bn].index] += rest * w;
  }
  const limbMember = new Float32Array(nV), limbWhich = new Int8Array(nV).fill(-1);
  for (let v = 0; v < nV; v++) for (let li = 0; li < NL; li++) if (limbM[li][v] > limbMember[v]) { limbMember[v] = limbM[li][v]; limbWhich[v] = li; }

  // sparse Laplacian smoothing
  const K = 8;
  let SB = new Int16Array(nV * K).fill(-1), SW = new Float32Array(nV * K);
  for (let v = 0; v < nV; v++) {
    const o = v * NB;
    let c = 0;
    for (let b = 0; b < NB && c < K; b++) if (W[o + b] > 1e-4) { SB[v * K + c] = b; SW[v * K + c] = W[o + b]; c++; }
  }
  const acc = new Float32Array(NB);
  const touched = [];
  for (let it = 0; it < 3; it++) {
    const NBw = new Int16Array(nV * K).fill(-1), NWw = new Float32Array(nV * K);
    for (let v = 0; v < nV; v++) {
      const ns = nbr[v];
      touched.length = 0;
      const addW = (u, f) => {
        for (let k = 0; k < K; k++) {
          const b = SB[u * K + k];
          if (b < 0) break;
          if (acc[b] === 0) touched.push(b);
          acc[b] += SW[u * K + k] * f;
        }
      };
      if (!ns.length || rigid[v] >= 0 || DISTAL[SB[v * K]]) addW(v, 1);
      else {
        addW(v, 0.5);
        const f = 0.5 / ns.length;
        for (const n of ns) addW(n, f);
      }
      touched.sort((a, b) => acc[b] - acc[a]);
      const m = Math.min(K, touched.length);
      for (let k = 0; k < m; k++) { NBw[v * K + k] = touched[k]; NWw[v * K + k] = acc[touched[k]]; }
      for (const b of touched) acc[b] = 0;
    }
    SB = NBw; SW = NWw;
  }
  const skinIndex = new Uint16Array(nV * 4), skinWeight = new Float32Array(nV * 4);
  const dominant = new Uint16Array(nV);
  for (let v = 0; v < nV; v++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) if (SB[v * K + k] >= 0) sum += SW[v * K + k];
    sum = sum || 1;
    for (let k = 0; k < 4; k++) {
      const b = SB[v * K + k];
      if (b < 0) break;
      skinIndex[v * 4 + k] = b;
      skinWeight[v * 4 + k] = SW[v * K + k] / sum;
    }
    dominant[v] = Math.max(0, SB[v * K]);
  }
  return { skinIndex, skinWeight, dominant, axialS, segT, neighbors: nbr, limbMember, limbWhich, axialLengths: AXL };
}
