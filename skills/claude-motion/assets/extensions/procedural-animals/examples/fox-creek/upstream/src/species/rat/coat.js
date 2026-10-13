// The brown rat's coat: coarse agouti fur (grey base, buff band, black tip; long sparse dark guard
// hairs on the back), countershaded to a grey-buff belly with a fairly sharp flank line; short sleek
// fur on the face; nearly bare pink-brown ears (skin with a haze of fine hair); pink feet (bare skin,
// sparse pale hair on top, keratin claws); the long tail as ring scales (material 6 scutes across the
// tail axis), dark above, paler below; pink nose leather; yellow-orange incisors.
// Colour variants: agouti (wild), dark (urban melanic), albino (white, pink skin), hooded (black hood
// over head and shoulders plus a dorsal stripe on white, grown as a pattern SDF on the surface).
// Works in the reference space of rig.js; colours sampled from the reference photos.
import { HEAD_O, HK } from './rig.js';
import { neckS } from './regions.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, fbm3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT } from '../../core/build/coatKit.js';

// palette per colour variant (sRGB hex, literature + photo samples)
const PALETTES = {
  agouti: {
    back: 0x615446, flank: 0x5a4f45, low: 0x756b61, belly: 0xa39a8c, head: 0x605244, cheek: 0x6b5e50,
    muzzle: 0x716558, earSkin: 0xa07c6e, earIn: 0xb88c80, feet: 0xcfaea2, tailTop: 0x4a3e38, tailUnder: 0x7e6e66,
    nose: 0xb9868a, claw: 0xd8c8b4, agouti: 0.95, undercoat: 0.55,
  },
  dark: {
    back: 0x3e3833, flank: 0x3a3430, low: 0x4a433d, belly: 0x7a746c, head: 0x3c3632, cheek: 0x423b36,
    muzzle: 0x4a423c, earSkin: 0x6e5a56, earIn: 0x86706a, feet: 0xb89a92, tailTop: 0x36302c, tailUnder: 0x5a504a,
    nose: 0x9a7276, claw: 0xc8b8a8, agouti: 0.45, undercoat: 0.35,
  },
  albino: {
    back: 0xf0ece4, flank: 0xf2eee6, low: 0xf2eee8, belly: 0xf5f2ec, head: 0xf2eee6, cheek: 0xf4f0ea,
    muzzle: 0xf4efe8, earSkin: 0xe8b9b0, earIn: 0xeab4ac, feet: 0xebbfb6, tailTop: 0xe4b8ae, tailUnder: 0xe8c2b8,
    nose: 0xeaafaf, claw: 0xf0e6dc, agouti: 0.0, undercoat: 0.1,
  },
  hooded: {
    // base white; the hood / stripe colour is the pattern colour
    back: 0xf0ede6, flank: 0xf0ede6, low: 0xf2efe8, belly: 0xf2efe8, head: 0xf0ede6, cheek: 0xf0ede6,
    muzzle: 0xf2eee8, earSkin: 0xa88480, earIn: 0xc49a94, feet: 0xebbfb6, tailTop: 0x8a7872, tailUnder: 0xd8b4aa,
    nose: 0xd89a9a, claw: 0xf0e6dc, agouti: 0.0, undercoat: 0.15,
  },
};
const HOOD = 0x221e1e;

function coatColours(p) {
  const base = PALETTES[p.colour] || PALETTES.agouti;
  const k = p.coatWarmth || 0, l = p.coatLightness || 0;
  const fixed = ['belly', 'earSkin', 'earIn', 'feet', 'nose', 'claw', 'tailUnder'];
  const tweak = (h) => { const c = srgb(h); return [c[0] * (1 + 0.12 * k + l), c[1] * (1 + 0.03 * k + l), c[2] * (1 - 0.12 * k + l)]; };
  const C = {};
  for (const [key, v] of Object.entries(base)) {
    if (key === 'agouti' || key === 'undercoat') C[key] = v;
    else C[key] = p.colour === 'albino' || p.colour === 'hooded' || fixed.includes(key) ? srgb(v) : tweak(v);
  }
  // juveniles: softer, greyer (less rufous) fur
  if (p.juv && p.colour !== 'albino' && p.colour !== 'hooded') for (const key of ['back', 'flank', 'low', 'head', 'cheek']) { const c = C[key], g = (c[0] + c[1] + c[2]) / 3; C[key] = mix3(c, [g, g, g * 1.03], 0.35); }
  return C;
}

export function ratCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, regionNames, weights, nV, params } = ctx;
  const { BONES, AXIAL } = rig;
  const COL = coatColours(params);
  const { dominant, axialS, skinIndex, skinWeight, limbMember } = weights;
  const AX = weights.axialLengths;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX[1], sNeckBase = AX[3], sTailBase = AX[8];
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|femur|tibia|metatarsus|hpaw)/.test(b.name));
  const isFoot = BONES.map((b) => /^(fpaw|hpaw|metacarpus|metatarsus)/.test(b.name));
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const nosePrim = model.prims.find((p) => p.tag === 'nose');
  const cleftPrim = model.prims.find((p) => p.tag === 'lipcleft');
  const earPrims = model.prims.filter((p) => p.tag === 'ear');
  const clawPrims = model.prims.filter((p) => p.tag === 'claw');
  const jawPrims = model.forPart('jaw');
  const headPrims = model.forPart('body').filter((p) => (p.bone === 'head' || p.bone === 'snout') && !p.carve);
  const hooded = params.colour === 'hooded';
  const albino = params.colour === 'albino';
  const teethPart = regionNames.map((n) => n === 'uteeth' || n === 'lteeth');
  const jawPart = regionNames.map((n) => n === 'jaw');
  const headPart = regionNames.map((n) => n === 'head');

  const region = new Uint8Array(nV); // 0 torso, 1 neck, 2 head, 3 teeth, 4 tail, 5 ear, 6 jaw, 7 snout
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
    if (teethPart[partOf[v]]) region[v] = 3;
    else if (jawPart[partOf[v]]) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (bn === 'snout') region[v] = 7;
    else if (axialS[v] > sTailBase + 0.003 && bn.startsWith('tail')) region[v] = 4;
    else if (axialS[v] < sOcc + 0.002 || (headPart[partOf[v]] && neckS(p[0], p[1], p[2]) > 0.006)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] === 2 || region[v] >= 3) legness[v] = 0;
  }

  // hooded pattern: signed distance (m, < 0 = coloured) of the hood (head, neck, shoulders and chest
  // down to the elbows) and the dorsal stripe to the tail root
  const hoodSDF = (p, n, r, v) => {
    if (r === 2 || r === 5 || r === 6 || r === 7) {
      // an optional blaze: a white wedge up the face from the nose (the berkshire / blazed fancy)
      if (params.blaze) {
        const h = mul(sub(p, HEAD_O), 1 / HK);
        const b = Math.abs(h[0]) - (0.0012 + 0.16 * Math.max(0, h[2] + 0.012)) * params.blaze;
        if (h[1] > -0.02) return clamp(-b, -0.004, 0.004) * (h[2] > -0.014 ? 1 : -1) - (h[2] > -0.014 ? 0 : 0.004);
      }
      return -0.006;
    }
    if (r === 4) return 0.006;
    // hood: behind the ears to the shoulders, slanting back over the withers
    const zc = 0.004 + 0.3 * (p[1] - 0.04) + 0.0012 * Math.sin(p[0] * 700);
    let d = zc - p[2];
    // the forelegs below the elbow stay white
    if (legness[v] > 0.5 && legBone[v] >= 0 && /radius|metacarpus|fpaw/.test(BONES[legBone[v]].name)) d = Math.max(d, 0.003);
    // the belly behind the chest stays white
    if (n[1] < -0.3) d = Math.max(d, -0.002 + (0.03 - p[1]) * 0.4);
    // dorsal stripe: ~16 mm wide down the back to the tail root, a little ragged
    const w = 0.0085 * (1 + 0.15 * Math.sin(p[2] * 180)) * smoothstep(-0.095, -0.075, p[2]) + 0.002;
    const up = smoothstep(0.1, 0.5, n[1]);
    const stripe = up > 0 ? Math.abs(p[0]) - w * up : 0.01;
    d = Math.min(d, stripe);
    return clamp(d, -0.006, 0.006);
  };

  const comb = new Float32Array(nV * 3);
  const tint = new Float32Array(nV * 4);
  const furLen = new Float32Array(nV);
  const markSDF = new Float32Array(nV).fill(1);
  const pattern = new Float32Array(nV).fill(1);
  const patternColor = new Float32Array(nV * 4);
  const surf = new Float32Array(nV * 4);
  const hoodC = srgb(params.hoodColour || HOOD);
  const tooth = srgb(0xd4a050), toothTip = srgb(0xeed8a8);
  const juvK = params.juv ? 0.75 : 1;

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const h = mul(sub(p, HEAD_O), 1 / HK);
    const bone = BONES[dominant[v]];
    const L = legness[v];
    let col, fl, mat = MAT.FUR, mark = 1, ag = COL.agouti, uc = COL.undercoat, gloss = 0, feat = 0, sz = 0;

    // ---- comb
    let d;
    if (r === 5) d = norm(sub(bone.tail, bone.head));
    else if (r === 2 || r === 6 || r === 7 || r === 3) d = norm(add(norm(sub(h, [0, -0.008, 0.026])), [0, -0.1, -0.5]));
    else if (r === 4) d = norm(sub(bone.tail, bone.head));
    else {
      const seg = weights.segT[v * 2] | 0;
      const a = AXIAL.points[seg], b = AXIAL.points[Math.min(seg + 1, AXIAL.points.length - 1)];
      d = norm(add(norm(sub(b, a)), [0, -0.5 * Math.abs(n[0]), 0]));
      if (L > 0 && legBone[v] >= 0) {
        const lbn = BONES[legBone[v]];
        let dl = norm(sub(lbn.tail, lbn.head));
        if (isFoot[legBone[v]]) dl = norm(add(dl, [0, 0, 0.4]));
        else dl = norm(add(dl, [0, -0.3, -0.2]));
        d = norm(add(mul(d, 1 - L), mul(dl, L)));
      }
    }
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];

    // ---- colour, fur length, marks
    if (r === 3) {
      // incisors: orange-yellow enamel on the front face, paler toward the chisel tip
      mat = MAT.KERATIN; fl = 0; gloss = 0.8;
      const tipK = partOf[v] >= 0 && regionNames[partOf[v]] === 'uteeth' ? smoothstep(-0.016, -0.019, h[1]) : smoothstep(-0.019, -0.0165, h[1]);
      col = albino ? mix3(tooth, toothTip, 0.5) : mix3(tooth, toothTip, tipK * 0.6);
    } else if (r === 0 || r === 1) {
      const up = clamp(n[1], -1, 1);
      col = mix3(COL.low, COL.flank, smoothstep(-0.35, 0.2, up));
      col = mix3(col, COL.back, smoothstep(0.25, 0.85, up));
      // belly: grey-buff, a fairly sharp flank line (blended by normal and height)
      const ventral = smoothstep(-0.2, -0.55, n[1]) * smoothstep(0.045, 0.02, p[1]);
      const chest = smoothstep(0.0, 0.03, p[2]) * smoothstep(0.2, 0.6, n[2]) * smoothstep(0.045, 0.02, p[1]);
      col = mix3(col, COL.belly, clamp(Math.max(ventral, chest * 0.8, smoothstep(0.4, 0.8, -n[1])), 0, 1));
      // coarse coat: long dorsal guard hairs, shorter on the flanks, dense short belly fur
      fl = mix(0.0068, 0.0095, smoothstep(-0.4, 0.3, n[1]));
      fl = Math.max(fl, 0.0115 * smoothstep(0.5, 0.95, n[1]) * smoothstep(0.02, -0.02, p[2]) + 0.0098 * smoothstep(0.5, 0.95, n[1]) * smoothstep(-0.02, 0.02, p[2])); // longest over the loins
      fl = mix(fl, 0.0055, smoothstep(-0.3, -0.8, n[1]));
      ag *= 1 - smoothstep(0.1, 0.6, -n[1]);
      if (L > 0) {
        const lb = legBone[v] >= 0 ? BONES[legBone[v]].name : '';
        let lc = mix3(COL.flank, COL.belly, smoothstep(0.0, -0.8, n[0] * Math.sign(p[0] || 1)) * 0.6), lf = mix(0.003, 0.006, smoothstep(0.01, 0.04, p[1]));
        if (isFoot[legBone[v]] && p[1] < 0.013) {
          // pink feet: bare skin, sparse short pale hair on the top of the foot
          lc = COL.feet; lf = 0; mat = MAT.SKIN; gloss = 0.25;
        } else if (/radius|tibia/.test(lb)) {
          // lower legs: short fur, pinkish skin showing near the wrist and the heel
          const sk = smoothstep(0.016, 0.006, p[1]);
          lc = mix3(mix3(COL.flank, COL.belly, 0.35), COL.feet, sk * 0.6); lf = mix(0.0035, 0.0016, sk);
        }
        if (/femur/.test(lb)) { lc = mix3(col, lc, smoothstep(0.035, 0.015, p[1])); lf = mix(fl, lf, 0.4); }
        col = mix3(col, lc, L);
        fl = mix(fl, lf, L);
        if (mat === MAT.SKIN) { col = COL.feet; fl = lf; }
        ag *= 1 - 0.8 * L * (/radius|tibia|metacarpus|fpaw|metatarsus|hpaw/.test(lb) ? 1 : 0);
        // claws: pale keratin
        for (const c of clawPrims) if (SDFModel.dist(c, p[0], p[1], p[2]) < 0.00025) { mat = MAT.KERATIN; col = COL.claw; fl = 0; gloss = 0.7; }
        // soles: the bare pads, a little darker and glossier
        if (mat === MAT.SKIN && n[1] < -0.5) { col = mix3(col, [col[0] * 0.85, col[1] * 0.78, col[2] * 0.78], 0.6); fl = 0; gloss = 0.4; }
      }
      // the anus / scrotum region: short sparse hair
      if (p[2] < -0.078 && p[1] < 0.045 && n[2] < -0.3) fl = Math.min(fl, 0.004);
    } else if (r === 4) {
      // tail: ring scales (scutes across the tail axis, ~1 mm), dark above, paler below, a little
      // paler toward the tip; sparse short bristles are the scute relief
      const bb = BONES[dominant[v]];
      const ax = norm(sub(bb.tail, bb.head));
      const dorsal = norm(cross([1, 0, 0], ax));
      const top = dot(n, dorsal);
      const along = clamp((axialS[v] - sTailBase) / Math.max(1e-4, AX[AX.length - 1] - sTailBase), 0, 1);
      col = mix3(COL.tailUnder, COL.tailTop, smoothstep(-0.45, 0.35, top));
      col = mix3(col, COL.tailUnder, 0.25 * along);
      mat = MAT.SCALES; fl = 0; gloss = 0.3;
      sz = 0.00095 * (1 - 0.35 * along) * juvK;
      feat = -1; // scutes: rings across the comb
      // the fur of the rump runs a little way onto the tail root
      if (axialS[v] < sTailBase + 0.009) { mat = MAT.FUR; col = mix3(COL.flank, COL.tailTop, 0.4); fl = 0.004; sz = 0; feat = 0; }
    } else if (r === 5) {
      // ears: thin, nearly bare skin (fine short hair haze), pinker in the cup, a darker rim
      const side = p[0] >= 0 ? 0 : 1;
      const ep = earPrims[side];
      const face = [ep.P[9], ep.P[10], ep.P[11]];
      const upE = [ep.P[6], ep.P[7], ep.P[8]], latE = [ep.P[3], ep.P[4], ep.P[5]];
      const c = [ep.P[0], ep.P[1], ep.P[2]];
      const q = sub(p, c);
      const along = dot(q, upE) / ep.P[13], across = dot(q, latE) / ep.P[12];
      const rim = 1 - Math.hypot(along, across);
      const inner = smoothstep(0.0, 0.4, dot(n, face)) * smoothstep(0.02, 0.12, rim);
      col = mix3(COL.earSkin, COL.earIn, inner);
      mat = MAT.FUR; gloss = 0;
      fl = 0.0004;
      // the ear root is furred like the head
      const root = smoothstep(-0.2, -0.75, along);
      if (root > 0) { col = mix3(col, COL.head, root); fl = mix(fl, 0.003, root); }
      ag = 0; uc = 0.6;
    } else {
      // head, snout and jaw: short sleek fur, paler on the lips and chin
      col = COL.head;
      const g3 = (cc, rr) => Math.exp(-(((Math.abs(h[0]) - cc[0]) / rr[0]) ** 2 + ((h[1] - cc[1]) / rr[1]) ** 2 + ((h[2] - cc[2]) / rr[2]) ** 2));
      col = mix3(col, COL.cheek, g3([0.009, -0.01, -0.006], [0.005, 0.006, 0.01]));
      col = mix3(col, COL.muzzle, smoothstep(0.004, 0.018, h[2]) * 0.8);
      const chinW = r === 6 ? 0.7 : smoothstep(-0.015, -0.019, h[1]) * smoothstep(-0.2, -0.7, n[1]);
      col = mix3(col, COL.belly, clamp(chinW, 0, 1) * 0.8);
      fl = mix(0.0045, 0.0018, smoothstep(-0.01, 0.02, h[2]));
      if (Math.abs(h[0]) > 0.008 && h[1] < -0.004 && h[2] < 0.004) fl = Math.max(fl, 0.0048); // cheek fur
      if (h[2] < -0.02) fl = mix(fl, 0.0068, smoothstep(-0.02, -0.03, h[2])); // nape
      ag *= 0.75;
      // eye rims: dark bare lid margin
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.0008) mark = Math.min(mark, Math.abs(de) - 0.0003);
        if (Math.abs(de) < 0.0003) { mat = MAT.DARK_SKIN; fl = 0; }
        else fl = Math.min(fl, mix(0.0004, fl, smoothstep(0.0009, 0.0045, Math.abs(de))));
      }
      // nose leather (pink rhinarium) and the split upper lip
      if (nosePrim && SDFModel.dist(nosePrim, p[0], p[1], p[2]) < 0.00035 && h[2] > 0.0205 && h[1] > -0.0145) { mat = MAT.SKIN; col = COL.nose; fl = 0; gloss = 0.65; }
      if (cleftPrim) {
        const dc = SDFModel.dist(cleftPrim, p[0], p[1], p[2]);
        if (dc < 0.0005) { mark = Math.min(mark, dc - 0.0003); fl = Math.min(fl, 0.0004); }
      }
      if (r === 7) fl = Math.min(fl, 0.0022); // whisker pads: short dense fur
      // lips / mouth lining: head vertices touching the jaw surface, jaw vertices inside the head
      if (partOf[v] >= 0 && !jawPart[partOf[v]]) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (dj < 0.00025) { mat = MAT.MOUTH; col = [0.3, 0.12, 0.12]; fl = 0; }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (dh < 0.0) { mat = MAT.MOUTH; col = [0.3, 0.12, 0.12]; fl = 0; }
      }
    }
    if (params.juv && mat === MAT.FUR) fl *= 0.8;

    // ---- hooded: hood and dorsal stripe (pattern SDF, crisp but hair-ragged edges)
    if (hooded && (mat === MAT.FUR || mat === MAT.DARK_SKIN)) pattern[v] = hoodSDF(p, n, r, v);

    // low-frequency colour variation
    const cv = fbm3(p[0] * 90, p[1] * 90, p[2] * 90, 3) - 0.5;
    if (mat === MAT.FUR) col = [col[0] * (1 + 0.16 * cv), col[1] * (1 + 0.13 * cv), col[2] * (1 + 0.1 * cv)];

    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    furLen[v] = mat === MAT.FUR || mat === MAT.SKIN ? fl : 0;
    markSDF[v] = mark;
    patternColor[v * 4] = hoodC[0]; patternColor[v * 4 + 1] = hoodC[1]; patternColor[v * 4 + 2] = hoodC[2]; patternColor[v * 4 + 3] = hooded ? 1 : 0;
    if (mat === MAT.SCALES) { surf[v * 4] = gloss; surf[v * 4 + 1] = sz; surf[v * 4 + 2] = feat; surf[v * 4 + 3] = -0.4; }
    else { surf[v * 4] = gloss; surf[v * 4 + 1] = 0; surf[v * 4 + 2] = mat === MAT.FUR ? clamp(ag, 0, 1) : 0; surf[v * 4 + 3] = mat === MAT.FUR ? uc : 0; }
  }

  // smooth fur length, agouti banding and colour across the fur so region boundaries (head / neck,
  // body / legs) never show as a line in the coat
  const nb = weights.neighbors;
  const tmp = new Float32Array(nV), tmpA = new Float32Array(nV), tmpC = new Float32Array(nV * 3);
  for (let it = 0; it < 8; it++) {
    for (let v = 0; v < nV; v++) {
      const ns = nb[v];
      tmp[v] = furLen[v]; tmpA[v] = surf[v * 4 + 2];
      tmpC[v * 3] = tint[v * 4]; tmpC[v * 3 + 1] = tint[v * 4 + 1]; tmpC[v * 3 + 2] = tint[v * 4 + 2];
      if (!ns || !ns.length || tint[v * 4 + 3] !== MAT.FUR) continue;
      let a = 0, g = 0, n = 0, c0 = 0, c1 = 0, c2 = 0;
      for (const q of ns) {
        if (tint[q * 4 + 3] !== MAT.FUR) continue;
        a += furLen[q]; g += surf[q * 4 + 2]; c0 += tint[q * 4]; c1 += tint[q * 4 + 1]; c2 += tint[q * 4 + 2]; n++;
      }
      if (!n) continue;
      tmp[v] = 0.5 * furLen[v] + (0.5 * a) / n;
      tmpA[v] = 0.5 * surf[v * 4 + 2] + (0.5 * g) / n;
      if (it < 3) { tmpC[v * 3] = 0.5 * tint[v * 4] + 0.5 * c0 / n; tmpC[v * 3 + 1] = 0.5 * tint[v * 4 + 1] + 0.5 * c1 / n; tmpC[v * 3 + 2] = 0.5 * tint[v * 4 + 2] + 0.5 * c2 / n; }
    }
    furLen.set(tmp);
    for (let v = 0; v < nV; v++) { surf[v * 4 + 2] = tmpA[v]; tint[v * 4] = tmpC[v * 3]; tint[v * 4 + 1] = tmpC[v * 3 + 1]; tint[v * 4 + 2] = tmpC[v * 3 + 2]; }
  }
  // smooth the hair flow (the axial segment directions change at the joints: no seams in the coat)
  const cb = new Float32Array(nV * 3);
  for (let it = 0; it < 6; it++) {
    for (let v = 0; v < nV; v++) {
      const ns = nb[v];
      let x = comb[v * 3], y = comb[v * 3 + 1], z = comb[v * 3 + 2];
      if (ns && ns.length && tint[v * 4 + 3] === MAT.FUR && region[v] !== 5) {
        for (const q of ns) { if ((region[q] <= 1 ? 0 : region[q]) !== (region[v] <= 1 ? 0 : region[v])) continue; x += comb[q * 3]; y += comb[q * 3 + 1]; z += comb[q * 3 + 2]; }
        const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
        const dn = x * nx + y * ny + z * nz;
        x -= dn * nx; y -= dn * ny; z -= dn * nz;
        const l = Math.hypot(x, y, z) || 1;
        x /= l; y /= l; z /= l;
      }
      cb[v * 3] = x; cb[v * 3 + 1] = y; cb[v * 3 + 2] = z;
    }
    comb.set(cb);
  }
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, region };
}
