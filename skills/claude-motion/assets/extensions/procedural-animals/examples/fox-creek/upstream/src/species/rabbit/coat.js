// The rabbit's coat: dense soft agouti fur (banded hair tips), countershading to a white belly, the
// rufous nape patch, pale eye rings, dark-rimmed ears with thinly furred pink insides, the scut
// (dark on top, white underneath), furred feet; domestic colours as seeded variants (fawn, black,
// white / REW albino, Dutch pied pattern grown as a signed distance on the surface).
// Works in the reference space of rig.js; colours sampled from the reference photos.
import { HEAD_O } from './rig.js';
import { neckS } from './regions.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, fbm3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT } from '../../core/build/coatKit.js';

// palette per colour variant (sRGB hex from reference photos)
const PALETTES = {
  agouti: {
    back: 0x7d6c56, flank: 0x8d7a62, low: 0xa4907a, nape: 0x9c6a42, face: 0x937c5e, cheek: 0x9c8a6c,
    eyeRing: 0xcfc2a6, earOut: 0x8a7a64, earRim: 0x3b3024, earIn: 0xc9a193, chest: 0x9a7e5c,
    belly: 0xe8e2d6, tailTop: 0x3e342a, tailUnder: 0xf4f2ee, feet: 0xa8977e, nose: 0x8e6e62, claw: 0x6a5c50,
    agouti: 1.0, undercoat: 0.6,
  },
  fawn: {
    back: 0xc08a4c, flank: 0xc8955a, low: 0xd6a86c, nape: 0xd49a58, face: 0xcc975c, cheek: 0xd2a066,
    eyeRing: 0xe8d0a4, earOut: 0xbc8850, earRim: 0x8a5e32, earIn: 0xd8a898, chest: 0xd4a46a,
    belly: 0xf0e2c8, tailTop: 0xb07a40, tailUnder: 0xf4ecdc, feet: 0xe0c090, nose: 0xc89486, claw: 0xd8ccbc,
    agouti: 0.15, undercoat: 0.35,
  },
  black: {
    back: 0x2c2826, flank: 0x302b28, low: 0x39332f, nape: 0x2f2926, face: 0x302b28, cheek: 0x332d2a,
    eyeRing: 0x39332f, earOut: 0x2c2826, earRim: 0x1c1918, earIn: 0x7a6260, chest: 0x302b28,
    belly: 0x3e3733, tailTop: 0x1a1817, tailUnder: 0x2c2724, feet: 0x2a2522, nose: 0x3a2e2c, claw: 0x2a2624,
    agouti: 0.0, undercoat: 0.2,
  },
  white: {
    back: 0xece8e0, flank: 0xeeeae2, low: 0xf0ece4, nape: 0xece8e0, face: 0xeeeae2, cheek: 0xf0ece6,
    eyeRing: 0xf2eee8, earOut: 0xe8e2da, earRim: 0xe4dcd2, earIn: 0xe8b8b0, chest: 0xf0ece4,
    belly: 0xf4f2ee, tailTop: 0xeeeae2, tailUnder: 0xf6f4f0, feet: 0xf0ece4, nose: 0xd8a0a0, claw: 0xece4da,
    agouti: 0.0, undercoat: 0.1,
  },
};
// Dutch: the coloured parts (cheeks, ears, rear half) take the chosen base; white elsewhere
const DUTCH_WHITE = 0xf2f0ea;

function coatColours(p) {
  const base = PALETTES[p.colour || 'agouti'] || PALETTES.agouti;
  const k = p.coatWarmth || 0, l = p.coatLightness || 0;
  const tweak = (h) => { const c = srgb(h); return [c[0] * (1 + 0.16 * k + l), c[1] * (1 + 0.04 * k + l), c[2] * (1 - 0.16 * k + l)]; };
  const C = {};
  for (const [key, v] of Object.entries(base)) C[key] = typeof v === 'number' && key !== 'agouti' && key !== 'undercoat' ? (['belly', 'tailUnder', 'earIn', 'nose', 'claw'].includes(key) ? srgb(v) : tweak(v)) : v;
  return C;
}

export function rabbitCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, weights, nV, params } = ctx;
  const { BONES, AXIAL } = rig;
  const COL = coatColours(params);
  const { dominant, axialS, skinIndex, skinWeight, limbMember } = weights;
  const AX = weights.axialLengths;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX[1], sNeckBase = AX[3], sTailBase = AX[8];
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|femur|tibia|metatarsus|hpaw)/.test(b.name));
  const isFoot = BONES.map((b) => /^(fpaw|hpaw|metacarpus)/.test(b.name));
  const isHindFoot = BONES.map((b) => /^(hpaw|metatarsus)/.test(b.name));
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const nosePrim = model.prims.find((p) => p.tag === 'nose');
  const cleftPrim = model.prims.find((p) => p.tag === 'lipcleft');
  const earPrims = model.prims.filter((p) => p.tag === 'ear');
  const jawPrims = model.forPart('jaw');
  const headPrims = model.forPart('body').filter((p) => (p.bone === 'head' || p.bone === 'snout') && !p.carve);
  const dutch = !!params.dutch;
  const albino = params.colour === 'white';

  const region = new Uint8Array(nV); // 0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw, 7 snout
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  for (let v = 0; v < nV; v++) {
    const bn = BONES[dominant[v]].name;
    const p = P(v);
    let lb = -1, lw = 0;
    for (let k = 0; k < 4; k++) {
      const b = skinIndex[v * 4 + k], w = skinWeight[v * 4 + k];
      if (isLimb[b] && w > lw) { lw = w; lb = b; }
    }
    legBone[v] = lb;
    legness[v] = lb >= 0 ? smoothstep(0.15, 0.85, limbMember[v]) : 0;
    if (partOf[v] === 2) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (bn === 'snout') region[v] = 7;
    else if (axialS[v] > sTailBase + 0.004 && bn.startsWith('tail')) region[v] = 4;
    else if (axialS[v] < sOcc + 0.004 || (partOf[v] === 1 && neckS(p[0], p[1], p[2]) > 0.01)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] === 2 || region[v] >= 4) legness[v] = 0;
  }

  // Dutch pattern: signed distance (m, < 0 = white) of the white areas: blaze and muzzle, a collar
  // and the whole forequarters (the "saddle" line behind the shoulders), and the hind feet ("stops")
  const dutchSDF = (p, r, v) => {
    const h = sub(p, HEAD_O);
    if (r === 5 || r === 4) return 1; // ears and scut stay coloured
    if (r === 2 || r === 6 || r === 7) {
      // blaze: a wedge between the eyes widening to the muzzle; muzzle, lips, chin and throat white
      const blaze = Math.abs(h[0]) - (0.003 + 0.3 * Math.max(0, h[2] + 0.004));
      return Math.min(blaze, 0.024 - h[2], h[1] + 0.027);
    }
    // saddle line behind the shoulders, slanting back low on the body
    let d = (-0.02 - 0.25 * (0.12 - p[1]) + 0.003 * Math.sin(p[0] * 70)) - p[2];
    // hind feet: white "stops" from the toes to about mid-foot
    if (legBone[v] >= 0 && isHindFoot[legBone[v]]) d = Math.min(d, -0.072 - p[2]);
    return d;
  };

  const comb = new Float32Array(nV * 3);
  const tint = new Float32Array(nV * 4);
  const furLen = new Float32Array(nV);
  const markSDF = new Float32Array(nV).fill(1);
  const pattern = new Float32Array(nV).fill(1);
  const patternColor = new Float32Array(nV * 4);
  const surf = new Float32Array(nV * 4);
  const white = srgb(DUTCH_WHITE);

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const h = sub(p, HEAD_O);
    const bone = BONES[dominant[v]];
    const L = legness[v];
    let col, fl, mat = MAT.FUR, mark = 1, ag = COL.agouti, uc = COL.undercoat;

    // ---- comb
    let d;
    if (r === 5) d = norm(sub(bone.tail, bone.head));
    else if (r === 2 || r === 6 || r === 7) d = norm(add(norm(sub(h, [0, -0.018, 0.05])), [0, -0.1, -0.5]));
    else if (r === 4) d = norm(add(norm(sub(bone.tail, bone.head)), [0, 0.3, -0.3]));
    else {
      const seg = weights.segT[v * 2] | 0;
      const a = AXIAL.points[seg], b = AXIAL.points[Math.min(seg + 1, AXIAL.points.length - 1)];
      d = norm(add(norm(sub(b, a)), [0, -0.45 * Math.abs(n[0]), 0]));
      if (L > 0 && legBone[v] >= 0) {
        const lbn = BONES[legBone[v]];
        let dl = norm(sub(lbn.tail, lbn.head));
        if (/fpaw|hpaw|metatarsus/.test(lbn.name)) dl = norm(add(dl, [0, 0, 0.5]));
        else dl = norm(add(dl, [0, -0.3, -0.2]));
        d = norm(add(mul(d, 1 - L), mul(dl, L)));
      }
    }
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];

    // ---- colour, fur length, marks
    if (r === 0 || r === 1) {
      const up = clamp(n[1], -1, 1);
      col = mix3(COL.low, COL.flank, smoothstep(-0.3, 0.3, up));
      col = mix3(col, COL.back, smoothstep(0.3, 0.9, up));
      // rufous nape patch behind the ears
      col = mix3(col, COL.nape, smoothstep(0.2, 0.7, up) * (r === 1 ? 1 : smoothstep(0.06, 0.085, p[2])) * 0.8);
      // chest: buff, belly: white (countershading blended by normal and height)
      const ventral = smoothstep(-0.1, -0.6, n[1]) * smoothstep(0.14, 0.07, p[1]);
      const chest = smoothstep(0.03, 0.08, p[2]) * smoothstep(0.1, 0.5, n[2]) * smoothstep(0.15, 0.08, p[1]);
      col = mix3(col, COL.chest, chest * 0.8);
      col = mix3(col, COL.belly, Math.max(ventral, smoothstep(0.35, 0.8, -n[1])));
      fl = mix(0.0105, 0.012, smoothstep(0.3, -0.6, n[1]));
      fl = Math.max(fl, 0.012 * smoothstep(0.6, 0.95, n[1])); // dense back
      // rump fur a touch longer (the rounded loaf outline)
      if (p[2] < -0.1) fl += 0.002 * smoothstep(-0.1, -0.16, p[2]);
      ag *= 1 - smoothstep(0.2, 0.7, -n[1]);
      if (L > 0) {
        let lc = mix3(COL.flank, COL.belly, smoothstep(0.0, -0.8, n[0] * Math.sign(p[0] || 1)) * 0.7);
        const lb = legBone[v] >= 0 ? BONES[legBone[v]].name : '';
        let lf = mix(0.005, 0.0105, smoothstep(0.02, 0.1, p[1]));
        if (/fpaw|hpaw|metacarpus|metatarsus/.test(lb)) { lc = mix3(mix3(COL.feet, COL.flank, 0.35), COL.belly, smoothstep(0.0, -0.7, n[1]) * 0.4); lf = 0.006; }
        else if (/radius/.test(lb)) { lc = mix3(COL.feet, COL.flank, 0.5); lf = 0.005; }
        // the big haunch keeps the body colour on its outside
        if (/femur/.test(lb)) { lc = mix3(col, lc, smoothstep(0.08, 0.03, p[1])); lf = mix(fl, lf, 0.4); }
        col = mix3(col, lc, L);
        fl = mix(fl, lf, L);
        ag *= 1 - 0.6 * L * (/fpaw|hpaw|metacarpus|metatarsus|radius/.test(lb) ? 1 : 0);
      }
    } else if (r === 4) {
      // the scut: dark on top (the side facing out at rest), bright white underneath
      const bb = BONES[dominant[v]];
      const ax = norm(sub(bb.tail, bb.head));
      // "top" of the tail = its dorsal side (toward the back when curled down against the rump)
      const dorsal = norm(cross([1, 0, 0], ax));
      const top = dot(n, dorsal);
      col = mix3(COL.tailUnder, COL.tailTop, smoothstep(-0.1, 0.45, -top));
      fl = 0.016;
      ag *= 0.3;
    } else if (r === 5) {
      // ears: short fur outside with a dark rim, sparse hair on the pink inner skin
      const side = p[0] >= 0 ? 0 : 1;
      const ep = earPrims[side];
      const face = [ep.P[9], ep.P[10], ep.P[11]];
      const upE = [ep.P[6], ep.P[7], ep.P[8]], latE = [ep.P[3], ep.P[4], ep.P[5]];
      const c = [ep.P[0], ep.P[1], ep.P[2]];
      const q = sub(p, c);
      const along = dot(q, upE) / ep.P[13], across = dot(q, latE) / ep.P[12];
      const rim = 1 - Math.hypot(along, across); // 0 at the edge of the pinna
      const front = dot(n, face) * Math.sign(dot(face, [p[0] >= 0 ? 1 : -1, 0, 0]) || 1);
      const inner = smoothstep(0.1, 0.5, dot(n, face)) * smoothstep(0.02, 0.12, rim);
      col = mix3(COL.earOut, COL.earIn, inner);
      fl = mix(0.0022, 0.0009, inner);
      if (inner > 0.6) mat = albino || params.colour === 'black' ? MAT.FUR : MAT.FUR;
      // dark rim along the outer edge and the tip (wild / agouti)
      // a thin dark rim along the upper edge and around the tip only (not at the root)
      if (along > 0.1) mark = Math.min(mark, (rim - 0.035) * 0.03 + 0.003 * (1 - smoothstep(0.1, 0.6, along)));
      if (params.colour !== 'agouti') mark = 1;
      ag *= 0.5 * (1 - inner);
      void front;
    } else {
      // head, snout and jaw
      col = COL.face;
      const g3 = (cc, rr) => Math.exp(-(((Math.abs(h[0]) - cc[0]) / rr[0]) ** 2 + ((h[1] - cc[1]) / rr[1]) ** 2 + ((h[2] - cc[2]) / rr[2]) ** 2));
      col = mix3(col, COL.cheek, g3([0.017, -0.02, -0.005], [0.01, 0.012, 0.02]));
      // pale eye ring (the "spectacles") and pale lips / chin
      let ring = 0;
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        ring = Math.max(ring, smoothstep(0.0055, 0.0015, Math.abs(de)));
      }
      col = mix3(col, COL.eyeRing, ring * 0.6);
      const lips = g3([0.006, -0.03, 0.036], [0.009, 0.006, 0.014]);
      const chinW = r === 6 ? 0.9 : smoothstep(-0.028, -0.036, h[1]) * smoothstep(-0.2, -0.7, n[1]);
      col = mix3(col, COL.belly, clamp(Math.max(lips * 0.7, chinW), 0, 1));
      // nape colour at the back of the head
      col = mix3(col, COL.nape, smoothstep(-0.02, -0.04, h[2]) * smoothstep(0.0, 0.6, n[1]) * 0.6);
      fl = mix(0.0045, 0.0028, smoothstep(0.0, 0.035, h[2]));
      if (Math.abs(h[0]) > 0.016 && h[1] < -0.005) fl = Math.max(fl, 0.0055); // cheek fur
      ag *= 0.7;
      // eye rims: dark bare lid margin
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.0022) mark = Math.min(mark, Math.abs(de) - 0.0009);
        if (Math.abs(de) < 0.0009) { mat = MAT.DARK_SKIN; fl = 0; }
        else if (Math.abs(de) < 0.0025) fl = Math.min(fl, 0.001);
      }
      // nose leather (small, Y-shaped with the lip cleft) and the cleft itself
      if (nosePrim && SDFModel.dist(nosePrim, p[0], p[1], p[2]) < 0.0009 && h[2] > 0.0355 && h[1] > -0.024) { mat = MAT.NOSE; col = COL.nose; fl = 0; }
      if (cleftPrim) {
        const dc = SDFModel.dist(cleftPrim, p[0], p[1], p[2]);
        if (dc < 0.0012) { mark = Math.min(mark, dc - 0.0008); fl = Math.min(fl, 0.0008); }
      }
      // whisker pads: short dense fur
      if (r === 7) fl = Math.min(fl, 0.0032);
      // lips: head vertices touching the jaw surface, jaw vertices touching the head
      if (partOf[v] !== 2) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (dj < 0.0006) { mat = MAT.MOUTH; col = [0.3, 0.12, 0.12]; fl = 0; }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (dh < 0.0) { mat = MAT.MOUTH; col = [0.3, 0.12, 0.12]; fl = 0; }
      }
    }

    // ---- Dutch white areas (pattern SDF, crisp but hair-ragged edges)
    if (dutch) {
      pattern[v] = dutchSDF(p, r, v);
    }

    // low-frequency colour variation
    const cv = fbm3(p[0] * 40, p[1] * 40, p[2] * 40, 3) - 0.5;
    col = [col[0] * (1 + 0.14 * cv), col[1] * (1 + 0.12 * cv), col[2] * (1 + 0.09 * cv)];

    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    furLen[v] = mat === MAT.FUR ? fl : 0;
    markSDF[v] = mark;
    patternColor[v * 4] = white[0]; patternColor[v * 4 + 1] = white[1]; patternColor[v * 4 + 2] = white[2]; patternColor[v * 4 + 3] = dutch ? 1 : 0;
    surf[v * 4] = 0; surf[v * 4 + 1] = 0; surf[v * 4 + 2] = clamp(ag, 0, 1); surf[v * 4 + 3] = uc;
  }

  // smooth fur length so shells do not step
  const nb = weights.neighbors;
  const tmp = new Float32Array(nV);
  for (let it = 0; it < 2; it++) {
    for (let v = 0; v < nV; v++) {
      const ns = nb[v];
      if (!ns.length || tint[v * 4 + 3] > 0) { tmp[v] = furLen[v]; continue; }
      let a = 0;
      for (const q of ns) a += furLen[q];
      tmp[v] = 0.5 * furLen[v] + (0.5 * a) / ns.length;
    }
    furLen.set(tmp);
  }
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, region };
}
