// The cheetah's coat: Poisson-disc spots grown on the actual surface, tear marks, lips, eye rims,
// ear backs, tail rings, countershading and fur length / comb fields, all baked per vertex.
// Works in the cheetah's reference space (see rig.js); seeded variation shifts the base colours
// and re-seeds the spot layout.
import { HEAD_O } from './rig.js';
import { neckS } from './regions.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3 } from '../../core/build/coatKit.js';

function coatColours(p) {
  // calibrated against sampled reference photos (buff/tawny, fairly desaturated); `hue` shifts
  // individuals between paler / more golden coats
  const k = p.coatWarmth || 0, l = p.coatLightness || 0;
  const tweak = (c) => [c[0] * (1 + 0.1 * k + l), c[1] * (1 + 0.02 * k + l), c[2] * (1 - 0.12 * k + l)];
  return {
    dorsal: tweak(srgb(0xae8558)),
    flank: tweak(srgb(0xc29d72)),
    lowFlank: tweak(srgb(0xd2b690)),
    white: srgb(0xebe5d9),
    cream: srgb(0xdccbae),
    legOuter: tweak(srgb(0xc6a479)),
    face: tweak(srgb(0xc19668)),
    muzzle: srgb(0xefe9df),
    nose: srgb(0x2c2624),
    black: srgb(0x15110f),
    mouth: srgb(0x7a3a3a),
    earInner: srgb(0xcbb699),
  };
}

export function cheetahCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, weights, nV, patchOf, params } = ctx;
  const { BONES, AXIAL } = rig;
  const AX_LEN = weights.axialLengths;
  const R = rng(1337 + (params.coatSeed || 0));
  const COL = coatColours(params);
  const { dominant, axialS, skinIndex, skinWeight, limbMember, limbWhich } = weights;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8], sTip = AX_LEN[AX_LEN.length - 1];
  const tailLen = sTip - sTailBase;
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const nosePrim = model.prims.find((p) => p.tag === 'nose');
  const jawPrims = model.forPart('jaw');
  const bodyPrims = model.forPart('body');
  const headPrims = bodyPrims.filter((p) => p.bone === 'head' && !p.carve);
  const earPrims = model.prims.filter((p) => p.tag === 'ear');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|femur|tibia|metatarsus|hpaw)/.test(b.name));

  // --- regions per vertex. Legs are not a region but a continuous blend (legness) that follows the
  // harmonic limb field used for skinning, so coat colour, spot size, fur length and hair flow all
  // change smoothly from flank to thigh and from chest to upper arm.
  const region = new Uint8Array(nV); // 0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1); // strongest limb bone of the vertex
  const legH = new Float32Array(nV); // normalised height on the limb (0 paw .. 1 body)
  const junction = new Float32Array(nV); // 1 in the middle of a limb/body blend (armpit, groin, fold)
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
    legH[v] = clamp(p[1] / 0.55, 0, 1);
    if (partOf[v] === 2) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (axialS[v] > sTailBase + 0.03 && bn.startsWith('tail')) { region[v] = 4; tailT[v] = clamp((axialS[v] - sTailBase) / tailLen, 0, 1); }
    else if (axialS[v] < sOcc + 0.01 || partOf[v] === 1 && neckS(p[0], p[1], p[2]) > 0.02) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] === 2 || region[v] === 5 || region[v] === 6 || region[v] === 4) { legness[v] = 0; junction[v] = 0; }
  }

  // skin tucked between limb and body: armpit (behind/below the upper arm) and groin/flank fold
  const underFactor = (v) => {
    const n = N(v), p = P(v), li = limbWhich[v];
    if (li < 0 || junction[v] <= 0) return 0;
    if (li <= 1) return junction[v] * Math.max(smoothstep(0.15, -0.55, n[2]) * smoothstep(0.55, 0.42, p[1]), smoothstep(0.2, -0.6, n[1]));
    return junction[v] * smoothstep(0.35, -0.45, n[1] + 0.35 * Math.abs(n[2]));
  };

  // --- ventral / countershading factor
  const ventral = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let w = 0;
    if (r === 0) {
      w = smoothstep(-0.15, -0.7, n[1]);
      // chest front & between forelegs (midline bib only)
      if (p[2] > 0.22 && p[1] < 0.58) w = Math.max(w, smoothstep(0.58, 0.46, p[1]) * smoothstep(0.075, 0.03, Math.abs(p[0])) * smoothstep(-0.2, 0.4, n[2]));
      w *= smoothstep(0.6, 0.5, p[1]) * 0.6 + 0.4;
    } else if (r === 1) {
      w = smoothstep(0.15, -0.55, n[1]);
    } else if (r === 4) {
      w = smoothstep(0.0, -0.7, n[1]) * 0.8;
    } else if (r === 2 || r === 6) {
      const h = sub(p, HEAD_O);
      w = smoothstep(-0.045, -0.07, h[1]) * smoothstep(-0.2, -0.7, n[1]) * 0.9 + (r === 6 ? 0.7 : 0);
    }
    const L = legness[v];
    if (L > 0) {
      const side = p[0] >= 0 ? 1 : -1;
      const inner = smoothstep(0.0, -0.7, n[0] * side);
      const wl = inner * 0.45 * smoothstep(0.15, 0.45, p[1]) + smoothstep(-0.3, -0.85, n[1]) * 0.45;
      w = mix(w, wl, L);
    }
    // armpits, groin and the flank fold are pale, like the belly they continue
    w = Math.max(w, underFactor(v) * 0.9);
    ventral[v] = clamp(w, 0, 1);
  }

  // --- comb (hair flow) direction, in bind space
  const comb = new Float32Array(nV * 3);
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let d;
    const bone = BONES[dominant[v]];
    if (r === 5) {
      d = norm(sub(bone.tail, bone.head));
    } else if (r === 2 || r === 6) {
      const h = sub(p, HEAD_O);
      const fromNose = norm(sub(h, [0, -0.012, 0.1]));
      d = norm(add(mul(fromNose, 1.0), [0, -0.25, -0.6]));
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = AXIAL.points[seg], b = AXIAL.points[Math.min(seg + 1, AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.35 * Math.abs(n[0]), 0]));
      if (r === 1) d = norm(add(d, [0, -0.2, 0]));
      const L = legness[v];
      if (L > 0 && legBone[v] >= 0) {
        const lbn = BONES[legBone[v]];
        let dl = norm(sub(lbn.tail, lbn.head));
        if (/fpaw|hpaw/.test(lbn.name)) dl = norm(add(dl, [0, 0, 0.4]));
        else dl = norm(add(dl, [0, -0.2, -0.25]));
        d = norm(add(mul(d, 1 - L), mul(dl, L)));
      }
    }
    // project to tangent plane
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];
  }

  // --- Poisson-disc spot centres on the surface
  // A cheetah carries ~2000 solid round spots 2-3 cm across; on the flank ~15 lie on a line from
  // shoulder to hip and they cover ~27 % of the coat (side / three-quarter photos). The neck, throat
  // and chest carry smaller, denser spots, the lower legs smaller still.
  const spotRadius = (v) => {
    const p = P(v), r = region[v];
    const L = legness[v];
    if (r === 0 || r === 1) {
      const onTorso = smoothstep(sNeckBase - 0.1, sNeckBase + 0.05, axialS[v]);
      const ax = mix(0.007, 0.0111 * mix(1, 0.74, ventral[v]), onTorso);
      const lg = mix(0.0035, 0.0099, smoothstep(0.05, 0.55, legH[v]));
      return mix(ax, lg, L);
    }
    if (r === 2) {
      const h = sub(p, HEAD_O);
      if (h[2] > 0.03 && Math.abs(h[0]) < 0.02) return 0; // nose bridge: no spots
      if (h[1] < -0.012 && h[2] > 0.02) return 0; // muzzle
      if (h[2] > 0.05) return 0;
      return mix(0.0031, 0.0052, smoothstep(0.04, -0.06, h[2]));
    }
    if (r === 4) return 0.0104;
    return 0;
  };
  const order = new Uint32Array(nV);
  for (let i = 0; i < nV; i++) order[i] = i;
  for (let i = nV - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  // (the grid cell is at least the largest Poisson distance, so the 3x3x3 search sees every conflict)
  const cell = 0.042;
  const grid = new Map();
  const key = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  const spots = [];
  for (let k = 0; k < nV; k++) {
    const v = order[k];
    if (partOf[v] === 1 && neckS(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]) < 0) continue; // avoid duplicates in overlap band
    if (partOf[v] === 0 && neckS(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]) > 0) continue;
    let r = spotRadius(v);
    if (r <= 0) continue;
    if (region[v] === 4 && tailT[v] > 0.58) continue;
    r *= 0.78 + 0.44 * R();
    // armpits and groin (skin that stretches most in a gallop) carry smaller, fainter spots
    const under = underFactor(v);
    r *= 1 - 0.35 * under;
    const p = P(v);
    // the belly behind the chest is white with sparse, faded spots; the chest and throat keep dense
    // black ones (front / side photos)
    const belly = region[v] === 0 ? smoothstep(0.45, 0.95, ventral[v]) * smoothstep(0.2, 0.06, p[2]) * (1 - legness[v]) : 0;
    const rs = r * (1 + 0.7 * belly); // spacing radius
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), gz = Math.floor(p[2] / cell);
    let ok = true;
    for (let dz = -1; dz <= 1 && ok; dz++)
      for (let dy = -1; dy <= 1 && ok; dy++)
        for (let dx = -1; dx <= 1 && ok; dx++) {
          const arr = grid.get(key(gx + dx, gy + dy, gz + dz));
          if (!arr) continue;
          for (const s of arr) {
            const minD = 1.34 * (rs + s.rs) + 0.002;
            const ddx = p[0] - s.p[0], ddy = p[1] - s.p[1], ddz = p[2] - s.p[2];
            if (ddx * ddx + ddy * ddy + ddz * ddz < minD * minD) { ok = false; break; }
          }
        }
    if (!ok) continue;
    const s = { p, r, rs, n: N(v), c: [comb[v * 3], comb[v * 3 + 1], comb[v * 3 + 2]], el: 1.05 + 0.25 * R(), pale: belly, under };
    spots.push(s);
    const kk = key(gx, gy, gz);
    (grid.get(kk) || grid.set(kk, []).get(kk)).push(s);
  }

  // --- per-vertex fields
  const spotSDF = new Float32Array(nV).fill(1);
  const spotInt = new Float32Array(nV);
  const markSDF = new Float32Array(nV).fill(1);
  const furLen = new Float32Array(nV);
  const tint = new Float32Array(nV * 4);

  // tear line polylines (head-local), projected to the surface
  // The tear line starts at the inner corner of the eye (where the lower lid's black rim runs into it)
  // and runs down the junction of muzzle and cheek to the corner of the mouth, ~25-35 mm off the
  // midline and only 13-23 mm in front of the eye (face-on and profile photos). There the skin faces
  // forward and sideways, so the line reads from the front as well as from the side.
  const tearPts = [[0.018, 0.0219, 0.0335], [0.0191, 0.0111, 0.0357], [0.0222, 0.0011, 0.0395], [0.0262, -0.0086, 0.0426], [0.0285, -0.0198, 0.0441], [0.0305, -0.028, 0.043], [0.0335, -0.0355, 0.0425], [0.0355, -0.0435, 0.0415]];
  const headList = bodyPrims;
  const projectToSurface = (q) => {
    let x = q.slice();
    for (let i = 0; i < 6; i++) {
      const d = SDFModel.evalList(headList, x[0], x[1], x[2]);
      const e = 0.0005;
      const g = [
        SDFModel.evalList(headList, x[0] + e, x[1], x[2]) - d,
        SDFModel.evalList(headList, x[0], x[1] + e, x[2]) - d,
        SDFModel.evalList(headList, x[0], x[1], x[2] + e) - d,
      ].map((c) => c / e);
      const gl = len(g) || 1;
      x = sub(x, mul(g, d / (gl * gl)));
    }
    return x;
  };
  const tears = [1, -1].map((s) => tearPts.map((q) => projectToSurface(add(HEAD_O, [q[0] * s, q[1], q[2]]))));
  const tearW = [0.0022, 0.0031, 0.0037, 0.0041, 0.0043, 0.0043, 0.004, 0.0034];
  const distPoly = (p, poly) => {
    let best = 1e9;
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1], ab = sub(b, a);
      const t = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0, 1);
      const d = len(sub(p, add(a, mul(ab, t)))) - mix(tearW[i], tearW[i + 1], t);
      if (d < best) best = d;
    }
    return best;
  };

  const ringTs = [0.61, 0.685, 0.755, 0.82, 0.88, 0.935];
  const spotGrid = grid;

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const h = sub(p, HEAD_O);

    // ---- spots
    let best = 1, bestInt = 0;
    const wob = 1 + 0.22 * (vnoise3(p[0] * 180, p[1] * 180, p[2] * 180) - 0.5);
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), gz = Math.floor(p[2] / cell);
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const arr = spotGrid.get(key(gx + dx, gy + dy, gz + dz));
          if (!arr) continue;
          for (const s of arr) {
            if (dot(s.n, n) < 0.2) continue; // do not bleed through thin parts
            const d = sub(p, s.p);
            const along = dot(d, s.c);
            const dd = Math.sqrt(Math.max(0, dot(d, d) - along * along * (1 - 1 / (s.el * s.el))));
            const sd = dd - s.r * wob;
            if (sd < best) { best = sd; bestInt = (1 - 0.55 * s.pale) * (1 - 0.55 * s.under); }
          }
        }
    spotSDF[v] = best;
    spotInt[v] = bestInt;

    // ---- base colour
    let col;
    const skinFlag = { v: 0 };
    let fl = 0.009;
    let mark = 1;
    if (r === 0 || r === 1) {
      const up = clamp(n[1], -1, 1);
      col = mix3(COL.lowFlank, COL.flank, smoothstep(-0.2, 0.4, up));
      col = mix3(col, COL.dorsal, smoothstep(0.55, 0.95, up) * 0.85);
      col = mix3(col, COL.white, ventral[v]);
      // coarse short body coat, a longer soft fringe along the belly and chest
      // (the chest in front of the forelegs keeps a shorter, flatter bib than the belly fringe)
      fl = mix(0.0135, r === 0 ? mix(0.032, 0.017, smoothstep(0.12, 0.3, p[2])) : 0.0135, smoothstep(0.25, 0.9, ventral[v]));
      fl = Math.max(fl, 0.017 * smoothstep(0.8, 0.97, n[1])); // dorsal line
      if (r === 1) {
        // nape crest (mane) — longer fur along the top of the neck
        fl = Math.max(fl, 0.031 * smoothstep(0.45, 0.95, n[1]));
      } else if (p[2] > 0.12) {
        // the mantle runs on over the withers and fades out behind the shoulders
        fl = Math.max(fl, 0.026 * smoothstep(0.55, 0.95, n[1]) * smoothstep(0.12, 0.3, p[2]));
      }
      const L = legness[v];
      if (L > 0) {
        let lc = mix3(COL.legOuter, COL.cream, ventral[v] * 0.8);
        lc = mix3(lc, COL.dorsal, smoothstep(0.6, 1.0, n[1]) * 0.3);
        let lf = mix(0.0045, 0.013, smoothstep(0.1, 0.7, legH[v]));
        // "breeches": longer hair on the back of the thighs
        if (p[2] < -0.3) lf = Math.max(lf, 0.019 * smoothstep(-0.3, -0.75, n[2]) * smoothstep(0.35, 0.7, legH[v]));
        if (legBone[v] >= 0 && /fpaw|hpaw/.test(BONES[legBone[v]].name)) { lf = 0.003; lc = mix3(lc, COL.cream, 0.3); }
        col = mix3(col, lc, L);
        fl = mix(fl, lf, L);
      }
    } else if (r === 4) {
      const t = tailT[v];
      col = mix3(COL.flank, COL.white, ventral[v]);
      col = mix3(col, COL.white, smoothstep(0.55, 0.9, t) * 0.55);
      fl = mix(0.016, 0.03, smoothstep(0.45, 1.0, t));
      // rings
      const s = t * tailLen;
      let rs = 1;
      for (let k = 0; k < ringTs.length; k++) {
        const hw = 0.012 + 0.003 * (k / ringTs.length);
        rs = Math.min(rs, Math.abs(s - ringTs[k] * tailLen) - hw);
      }
      rs += 0.006 * ventral[v];
      if (t > 0.965) rs = 1; // white tip
      if (t > 0.965) col = COL.white;
      mark = Math.min(mark, rs);
    } else if (r === 5) {
      // ears: back mostly black at base, inner light
      const earP = earPrims[p[0] > 0 ? 0 : 1];
      const faceDir = [earP.P[9], earP.P[10], earP.P[11]]; // local z of ear ellipsoid = facing
      const front = dot(n, faceDir);
      const upE = [earP.P[6], earP.P[7], earP.P[8]];
      const ht = dot(sub(p, [earP.P[0], earP.P[1], earP.P[2]]), upE) / 0.02; // -1 base .. 1 tip
      if (front > 0.35) { col = mix3(COL.face, COL.earInner, smoothstep(0.35, 0.8, front)); fl = 0.007; }
      else {
        col = COL.face;
        fl = 0.004;
        mark = Math.min(mark, (ht - 0.25) * 0.01 + (front + 0.6) * 0.01);
      }
    } else {
      // head & jaw
      col = COL.face;
      fl = 0.005;
      // muzzle / chin / cheeks white
      const g3 = (c, r) => Math.exp(-(((Math.abs(h[0]) - c[0]) / r[0]) ** 2 + ((h[1] - c[1]) / r[1]) ** 2 + ((h[2] - c[2]) / r[2]) ** 2));
      // whisker pads pale buff, white only along the upper lip margin ("moustache"), the chin and throat
      const whisker = g3([0.015, -0.035, 0.08], [0.02, 0.016, 0.024]) * 0.5;
      const moustache = g3([0.017, -0.047, 0.07], [0.024, 0.0085, 0.034]);
      const lip = g3([0.0, -0.042, 0.088], [0.014, 0.01, 0.016]);
      const underEye = g3([0.031, 0.009, 0.033], [0.011, 0.0075, 0.016]) * 0.8;
      const aboveEye = g3([0.03, 0.044, 0.025], [0.012, 0.006, 0.015]) * 0.45;
      const chinW = partOf[v] === 2 ? smoothstep(-0.02, 0.03, h[2]) * 0.9 + smoothstep(-0.2, -0.7, n[1]) * 0.6 : 0;
      const throatW = smoothstep(-0.045, -0.065, h[1]) * smoothstep(-0.3, -0.8, n[1]) * 0.9;
      const w = clamp(Math.max(whisker, moustache, lip, underEye, aboveEye, chinW, throatW), 0, 1);
      col = mix3(col, COL.muzzle, w);
      fl = mix(0.0045, 0.003, smoothstep(0.03, 0.07, h[2]));
      if (Math.abs(h[0]) > 0.035 && h[1] < 0.0) fl = 0.009; // cheek ruff
      if (h[1] > 0.04) fl = 0.005;
      // tear marks
      for (const poly of tears) mark = Math.min(mark, distPoly(p, poly));
      // eye rims
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.004) mark = Math.min(mark, Math.abs(de) - 0.0021);
        if (Math.abs(de) < 0.0016) { skinFlag.v = 2; fl = 0; }
        else if (Math.abs(de) < 0.004) fl = Math.min(fl, 0.0015);
      }
      // nose leather
      const dn = SDFModel.dist(nosePrim, p[0], p[1], p[2]);
      if (dn < 0.0022 && h[2] > 0.085) { skinFlag.v = 1; col = COL.nose; fl = 0; }
      // lips: head vertices near the jaw surface, jaw vertices near the head surface
      if (partOf[v] !== 2) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (dj < 0.0015) { skinFlag.v = 3; col = COL.mouth; fl = 0; }
        else if (dj < 0.004 && h[2] > 0.0) { mark = Math.min(mark, dj - 0.0038); fl = Math.min(fl, 0.002); }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (dh < 0.0) { skinFlag.v = 3; col = COL.mouth; fl = 0; }
        else if (dh < 0.0035) { mark = Math.min(mark, dh - 0.003); fl = Math.min(fl, 0.002); }
      }
      if (r === 2 && h[2] < -0.04) {
        // back of head blends to neck colour
        col = mix3(col, COL.dorsal, smoothstep(-0.04, -0.09, h[2]) * smoothstep(0.0, 0.6, n[1]) * 0.6);
      }
    }
    // low frequency colour variation
    const cv = fbm3(p[0] * 9, p[1] * 9, p[2] * 9, 3) - 0.5;
    const cvh = fbm3(p[0] * 4 + 5, p[1] * 4, p[2] * 4, 2) - 0.5;
    col = [col[0] * (1 + 0.16 * cv + 0.1 * cvh), col[1] * (1 + 0.14 * cv), col[2] * (1 + 0.1 * cv - 0.08 * cvh)];

    markSDF[v] = mark;
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = skinFlag.v;
  }

  // smooth fur length a little so shells do not step
  const nb = weights.neighbors;
  const tmp = new Float32Array(nV);
  for (let it = 0; it < 2; it++) {
    for (let v = 0; v < nV; v++) {
      const ns = nb[v];
      if (!ns.length || tint[v * 4 + 3] > 0) { tmp[v] = furLen[v]; continue; }
      let a = 0;
      for (const n of ns) a += furLen[n];
      tmp[v] = 0.5 * furLen[v] + (0.5 * a) / ns.length;
    }
    furLen.set(tmp);
  }

  void skinIndex; void skinWeight; void patchOf;
  const patternColor = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) { patternColor[v * 4] = 0.016; patternColor[v * 4 + 1] = 0.0105; patternColor[v * 4 + 2] = 0.0075; patternColor[v * 4 + 3] = spotInt[v]; }
  return { comb, tint, pattern: spotSDF, mark: markSDF, furLen, patternColor, stats: { spots: spots.length }, region, ventral, tailT };
}

