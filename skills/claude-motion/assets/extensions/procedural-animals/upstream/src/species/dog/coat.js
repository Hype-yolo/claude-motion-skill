// The dog's coat, painted per vertex in reference space, by variant and colour.
//
// shepherd  black-and-tan saddle (FCI 166): black saddle from the withers over the back and into the
//           tail top, reaching down the flanks; black mask on the muzzle and round the eyes, dark
//           forehead and ear backs; rich tan legs, cheeks, chest and breeches; pale cream inner
//           thighs and belly. Sable: grey-tan hair with black tips (the shader's agouti band) over
//           the whole body, darker along the back, a dark mask. Solid black (rare). Medium double
//           coat: ruff, breeches and a bushy tail are longer.
// retriever solid yellow (cream to fox red), black or chocolate (FCI 122); a little darker on the
//           ears and along the back, paler on the belly and the feathering in yellows. Short, dense,
//           glossy coat; liver nose and lids in chocolates.
// terrier   white ground with crisp patches (pattern SDF): a tan head mask over the eyes and ears split
//           by a white blaze, and in tricolours black body patches (saddle spot, tail root) with a tan
//           rim. Smooth short coat.
// Pups: softer, fluffier, a little paler; shepherd pups are darker (sooty) until the tan comes in.
import { HEAD_O, MUZZLE_Z0, HS } from './rig.js';
import { neckS, NECK_CUT } from './regions.js';
import { harmonizeSeamWeights } from '../../core/build/seams.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, smoothField } from '../../core/build/coatKit.js';

// sRGB swatches, neutral-light albedo
const PAL = {
  blackTan: {
    saddle: 0x221b1a, tan: 0xb57a45, tanLight: 0xcb9d6c, cream: 0xd9c2a0, mask: 0x1c1615, headTop: 0x3c2a22,
    earBack: 0x1d1715, earInner: 0xa07e5c, tailTop: 0x201a19, tailUnder: 0xc39a6c, paw: 0xc99a66,
    ag: { back: 0.15, side: 0.1, head: 0.1, leg: 0, tail: 0.1 }, gloss: 0.25,
  },
  sable: {
    saddle: 0x4a3d33, tan: 0x9c7f5e, tanLight: 0xb89c78, cream: 0xcfbd9f, mask: 0x241d19, headTop: 0x5a4a3c,
    earBack: 0x2a221e, earInner: 0x9c8468, tailTop: 0x3a302a, tailUnder: 0xb49e80, paw: 0xb39776,
    ag: { back: 0.85, side: 0.6, head: 0.45, leg: 0.15, tail: 0.75 }, gloss: 0.15,
  },
  black: {
    saddle: 0x1b1817, tan: 0x221e1c, tanLight: 0x2a2522, cream: 0x332d29, mask: 0x171413, headTop: 0x1d1a18,
    earBack: 0x171413, earInner: 0x2a2522, tailTop: 0x1a1716, tailUnder: 0x26221f, paw: 0x221e1c,
    ag: { back: 0, side: 0, head: 0, leg: 0, tail: 0 }, gloss: 0.35,
  },
  yellow: {
    saddle: 0xcfae78, tan: 0xd9bb88, tanLight: 0xe2c89c, cream: 0xebdcbc, mask: 0xd6b886, headTop: 0xd2b27e,
    earBack: 0xbf9a64, earInner: 0xdcc094, tailTop: 0xcfae78, tailUnder: 0xe2caa0, paw: 0xe0c79c,
    ag: { back: 0, side: 0, head: 0, leg: 0, tail: 0 }, gloss: 0.3,
  },
  choc: {
    saddle: 0x5c3626, tan: 0x683f2b, tanLight: 0x734a34, cream: 0x7c5340, mask: 0x5f3828, headTop: 0x5d3727,
    earBack: 0x4f2e20, earInner: 0x6c4634, tailTop: 0x5c3626, tailUnder: 0x6e4533, paw: 0x6c4533,
    ag: { back: 0, side: 0, head: 0, leg: 0, tail: 0 }, gloss: 0.45, liver: 0x6e4234,
  },
  labBlack: {
    saddle: 0x19191b, tan: 0x1c1c1f, tanLight: 0x202023, cream: 0x232327, mask: 0x1a1a1d, headTop: 0x19191b,
    earBack: 0x161618, earInner: 0x202023, tailTop: 0x19191b, tailUnder: 0x1e1e21, paw: 0x1e1e21,
    ag: { back: 0, side: 0, head: 0, leg: 0, tail: 0 }, gloss: 0.6,
  },
  terrier: {
    saddle: 0xf0ede5, tan: 0xefece4, tanLight: 0xf2efe8, cream: 0xf4f1ea, mask: 0xefebe2, headTop: 0xeeeae1,
    earBack: 0xefebe2, earInner: 0xe8dcd2, tailTop: 0xf0ede5, tailUnder: 0xf2efe8, paw: 0xeeebe3,
    ag: { back: 0, side: 0, head: 0, leg: 0, tail: 0 }, gloss: 0.2,
    patchTan: 0xa35f2c, patchBlack: 0x1d1b1d,
  },
};
const PAL_OF = { shepherd: { blackTan: 'blackTan', sable: 'sable', black: 'black' }, retriever: { yellow: 'yellow', black: 'labBlack', chocolate: 'choc' }, terrier: { white: 'terrier', tan: 'terrier', tricolour: 'terrier' } };

function palette(p) {
  const key = (PAL_OF[p.variant] || PAL_OF.shepherd)[p.colour] || 'blackTan';
  const base = PAL[key];
  const k = p.coatWarmth || 0, l = p.coatLightness || 0, juv = p.juv || 0;
  const out = { ag: base.ag, gloss: base.gloss, key };
  for (const [name, hex] of Object.entries(base)) {
    if (name === 'ag' || name === 'gloss') continue;
    let c = srgb(hex);
    // warmth / lightness within the colour's range (yellow labs: cream to fox red)
    const kk = key === 'yellow' ? 2.2 * k : key === 'terrier' && !/patch/.test(name) ? 0.15 * k : k;
    c = [c[0] * (1 + 0.1 * kk + l), c[1] * (1 + 0.01 * kk + l), c[2] * (1 - 0.14 * kk + l)];
    // shepherd pups: sooty until the tan comes in
    if (juv > 0 && key === 'blackTan' && /tan|cream|paw/.test(name)) c = mix3(c, srgb(0x6a5040), 0.45 * juv);
    out[name] = c;
  }
  return out;
}

export function dogCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, weights, nV, params } = ctx;
  const { BONES, AXIAL } = rig;
  const AX_LEN = weights.axialLengths;
  const C = palette(params);
  const AG = C.ag;
  const key = C.key;
  const juv = params.juv || 0;
  const hw = params.headW || 1, mz = params.muzzle || 1;
  const variant = params.variant || 'shepherd';
  const saddleExt = params.saddle ?? 0; // how far the saddle reaches down the flanks (-1..1)
  const maskK = params.mask ?? 1;
  const FK = params.furK || 1; // fur length factor of the variant
  const nOff = (params.coatSeed || 0) % 997;
  const R = rng(9173 + (params.coatSeed || 0));
  const { dominant, axialS, skinIndex, skinWeight, limbMember, limbWhich } = weights;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8], sTip = AX_LEN[AX_LEN.length - 1];
  const tailLen = sTip - sTailBase;
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const nosePrim = model.prims.find((p) => p.tag === 'nose');
  const toothPrims = model.prims.filter((p) => p.tag === 'canine' || p.tag === 'lowercanine');
  const jawPrims = model.forPart('jaw').filter((p) => p.tag !== 'lowercanine');
  const bodyPrims = model.forPart('body');
  const headPrims = bodyPrims.filter((p) => p.bone === 'head' && !p.carve && p.tag !== 'canine');
  const clawPrims = model.prims.filter((p) => p.tag === 'claw');
  const padPrims = model.prims.filter((p) => p.tag === 'pad' || p.tag === 'carpalpad');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|femur|tibia|metatarsus|hpaw)/.test(b.name));
  const isPaw = BONES.map((b) => /^(fpaw|hpaw)/.test(b.name));
  const isFront = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw)/.test(b.name));
  const regionNames = ctx.regionNames;
  const jawRegion = regionNames.indexOf('jaw'), tongueRegion = regionNames.indexOf('tongue');
  const liver = key === 'choc';
  const noseCol = liver ? srgb(PAL.choc.liver) : key === 'yellow' && (params.noseFade || 0) > 0.5 ? srgb(0x5a4238) : srgb(0x161414);
  const headLocal = (p) => {
    const x = (p[0] - HEAD_O[0]) / hw / HS, y = (p[1] - HEAD_O[1]) / HS;
    let z = (p[2] - HEAD_O[2]) / HS;
    if (z > MUZZLE_Z0) z = MUZZLE_Z0 + (z - MUZZLE_Z0) / mz;
    return [x, y, z];
  };

  // --- regions per vertex (0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw, 7 tongue) and limb blend
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
    if (partOf[v] === tongueRegion) region[v] = 7;
    else if (partOf[v] === jawRegion) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (axialS[v] > sTailBase + 0.015 && bn.startsWith('tail')) { region[v] = 4; tailT[v] = clamp((axialS[v] - sTailBase) / tailLen, 0, 1); }
    else if (axialS[v] < sOcc + 0.01 || (partOf[v] === 1 && neckS(p[0], p[1], p[2]) > 0.02)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) { legness[v] = 0; junction[v] = 0; }
  }
  const underFactor = (v) => {
    const n = N(v), p = P(v), li = limbWhich[v];
    if (li < 0 || junction[v] <= 0) return 0;
    if (li <= 1) return junction[v] * Math.max(smoothstep(0.15, -0.55, n[2]) * smoothstep(0.42, 0.32, p[1]), smoothstep(0.2, -0.6, n[1]));
    return junction[v] * smoothstep(0.35, -0.45, n[1] + 0.35 * Math.abs(n[2]));
  };

  // --- ventral (pale underside) factor
  const ventral = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let w = 0;
    if (r === 0) {
      w = smoothstep(-0.05, -0.65, n[1]);
      // chest front between the forelegs
      if (p[2] > 0.2) w = Math.max(w, smoothstep(0.46, 0.36, p[1]) * smoothstep(0.07, 0.03, Math.abs(p[0])) * smoothstep(-0.3, 0.4, n[2]));
      w *= smoothstep(0.5, 0.4, p[1]) * 0.55 + 0.45;
    } else if (r === 1) {
      w = smoothstep(0.1, -0.5, n[1]) * smoothstep(-0.4, 0.3, n[2]) + smoothstep(0.52, 0.44, p[1]) * 0.6;
    } else if (r === 2 || r === 6) {
      const h = headLocal(p);
      w = smoothstep(-0.03, -0.06, h[1]) * smoothstep(-0.2, -0.7, n[1]) + (r === 6 ? 0.7 : 0);
    }
    const L = legness[v];
    if (L > 0) {
      const side = p[0] >= 0 ? 1 : -1;
      const inner = smoothstep(0.1, -0.6, n[0] * side);
      const wl = inner * 0.8 * smoothstep(0.06, 0.25, p[1]) + smoothstep(-0.3, -0.85, n[1]) * 0.5;
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
    if (r === 5 || r === 7) {
      d = norm(sub(bone.tail, bone.head));
    } else if (r === 2 || r === 6) {
      const h = headLocal(p);
      // out from the nose over the face, back over the skull and down the cheeks
      const fromNose = norm(sub(h, [0, -0.01, 0.16]));
      d = norm(add(fromNose, [0, -0.2, -0.5]));
      if (h[2] < 0.0 && Math.abs(h[0]) > 0.035) d = norm(add(d, [Math.sign(h[0]) * 0.4, -0.5, -0.8]));
    } else {
      // axial direction, blended across the joints (a per-segment direction steps at every joint:
      // visible as bands in the fur of a bent tail)
      const seg = weights.segT[v * 2] | 0, st = weights.segT[v * 2 + 1];
      const nP = AXIAL.points.length;
      const dirOf = (i) => { i = clamp(i, 0, nP - 2); return norm(sub(AXIAL.points[i + 1], AXIAL.points[i])); };
      const d0 = dirOf(seg);
      d = st < 0.5 ? norm(add(mul(norm(add(dirOf(seg - 1), d0)), 0.5 - st), mul(d0, 0.5 + st))) : norm(add(mul(d0, 1.5 - st), mul(norm(add(d0, dirOf(seg + 1))), st - 0.5)));
      if (r === 0) d = norm(add(d, [0, -0.45 * Math.abs(n[0]), 0]));
      if (r === 1) d = norm(add(d, [0, -0.5, 0]));
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

  // --- terrier patches (crisp pattern): tan head mask split by a white blaze, black body patches
  //     (tricolour) with a tan rim; seeded layout. Distances are approximate metres.
  const patches = [];
  if (variant === 'terrier') {
    const J = rig.J;
    const tri = params.colour === 'tricolour';
    const nb = params.patches ?? 1;
    // body patches, in reference space: saddle spot over the back / flank, tail-root patch, head
    if (tri || R() < 0.35) {
      const z0 = mix(J.thoraxRear[2], J.lumbarMid[2], R()), side = R() < 0.5 ? 1 : -1;
      patches.push({ c: [0.03 * side * R(), J.thoraxRear[1] + 0.02, z0], r: [0.09 + 0.05 * R() * nb, 0.1 + 0.05 * R(), 0.07 + 0.06 * R() * nb], black: tri });
    }
    if (tri ? R() < 0.85 : R() < 0.4) patches.push({ c: [0, J.tailBase[1] + 0.01, J.tailBase[2] + 0.015], r: [0.07 + 0.02 * R(), 0.06, 0.06 + 0.03 * R()], black: tri });
    if (R() < 0.3 * nb) patches.push({ c: [0.06 * (R() < 0.5 ? 1 : -1), J.chestMid[1] - 0.02, mix(J.chestMid[2], J.thoraxRear[2], R())], r: [0.05, 0.06 + 0.03 * R(), 0.06 + 0.03 * R()], black: tri && R() < 0.6 });
  }
  const blaze = params.blaze ?? 0.5; // width of the white blaze (terrier)
  const maskSide = params.maskSide ?? 0; // asymmetric head mask (-1..1)
  const patchD = (p) => {
    let d = 1, black = 0, dB = 1;
    for (const q of patches) {
      const u = [(p[0] - q.c[0]) / q.r[0], (p[1] - q.c[1]) / q.r[1], (p[2] - q.c[2]) / q.r[2]];
      const nz = fbm3(p[0] * 18 + nOff, p[1] * 18, p[2] * 18, 2) - 0.5;
      const di = (Math.hypot(...u) - 1 + 0.5 * nz) * Math.min(...q.r) * 0.8;
      if (di < d) d = di;
      if (q.black && di < dB) { dB = di; }
    }
    // tricolour: black patches carry a thin tan rim (~5 mm)
    if (dB < 0.02) black = smoothstep(-0.002, -0.009, dB);
    return { d, black };
  };

  // --- per-vertex paint
  const furLen = new Float32Array(nV);
  const tint = new Float32Array(nV * 4);
  const markSDF = new Float32Array(nV).fill(1);
  const surf = new Float32Array(nV * 4);
  const pattern = new Float32Array(nV).fill(1);
  const patCol = new Float32Array(nV * 4);
  const g3 = (h, c, rr) => Math.exp(-(((Math.abs(h[0]) - c[0]) / rr[0]) ** 2 + ((h[1] - c[1]) / rr[1]) ** 2 + ((h[2] - c[2]) / rr[2]) ** 2));
  // (the tail direction blended by the skin weights: no colour step at the joints)
  const tailSegDorsal = (v) => {
    let d = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const bone = BONES[skinIndex[v * 4 + k]], w = skinWeight[v * 4 + k];
      if (w > 0 && bone.name.startsWith('tail')) d = add(d, mul(norm(sub(bone.tail, bone.head)), w));
    }
    if (len(d) < 1e-6) { const bone = BONES[dominant[v]]; d = sub(bone.tail, bone.head); }
    d = norm(d);
    return norm([0, -d[2], d[1]]);
  };
  const tan = C.tan, black = C.saddle;
  const shep = key === 'blackTan' || key === 'sable';

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let col, fl = 0.02, ag = 0, mat = MAT.FUR, mark = 1, under = 0.35, gloss = C.gloss;
    const nz = fbm3(p[0] * 7 + nOff, p[1] * 7, p[2] * 7, 3) - 0.5;
    const nz2 = vnoise3(p[0] * 38 + nOff, p[1] * 38, p[2] * 38) - 0.5;
    if (r === 0 || r === 1) {
      const up = n[1];
      const vent = ventral[v];
      col = mix3(C.tan, C.tanLight, smoothstep(0.2, -0.4, up + 0.2 * nz) * 0.5);
      ag = mix(AG.side * 0.7, AG.side, smoothstep(-0.3, 0.3, up));
      if (r === 0) {
        // saddle: from the withers over the back into the tail top, down the flanks (ragged edge)
        const dors = smoothstep(-0.08, 0.12, up + 0.3 * nz + 0.22 * saddleExt + 0.2 * smoothstep(0.42, 0.55, p[1]));
        const along = smoothstep(0.3, 0.2, p[2]) * smoothstep(-0.36, -0.26, p[2]);
        if (key === 'blackTan') {
          col = mix3(col, black, dors * along);
          // the tan runs up in front of the thigh and on the shoulder
        } else {
          col = mix3(col, C.saddle, dors * along * (key === 'sable' ? 0.7 : 0.25));
          ag = mix(ag, AG.back, dors * along);
        }
        col = mix3(col, C.cream, vent);
        ag *= 1 - vent;
        fl = mix(0.02, 0.027, smoothstep(0.2, 0.85, up)) * (1 + 0.1 * nz2);
        fl = mix(fl, 0.02, smoothstep(0.3, 0.9, vent));
        // longer hair behind the thighs (breeches) and over the withers
        if (p[2] < -0.28) fl = Math.max(fl, 0.036 * smoothstep(-0.2, -0.7, n[2]));
      } else {
        // neck: dark nape (saddle into the neck top in black-and-tans), tan / cream throat
        const top = smoothstep(0.2, 0.85, up + 0.25 * nz);
        if (key === 'blackTan') col = mix3(col, mix3(black, C.headTop, 0.5), top * 0.9);
        else col = mix3(col, C.saddle, top * (key === 'sable' ? 0.55 : 0.2));
        ag = mix(AG.side * 0.7, AG.back, top);
        col = mix3(col, C.cream, smoothstep(0.35, 0.8, vent) * (shep ? 0.8 : 0.6));
        ag *= 1 - smoothstep(0.3, 0.7, vent);
        fl = mix(0.03, 0.026, vent) * (1 + 0.12 * nz2);
      }
      const L = legness[v];
      if (L > 0) {
        const lb = legBone[v];
        const front = lb >= 0 && isFront[lb];
        let lc = mix3(C.tan, C.cream, smoothstep(0.2, 0.8, ventral[v]) * 0.6);
        lc = mix3(lc, col, smoothstep(0.26, 0.42, p[1]) * 0.6);
        let lf = mix(0.008, 0.018, smoothstep(0.08, 0.34, p[1]));
        if (!front) lf = Math.max(lf, 0.04 * smoothstep(-0.1, -0.7, n[2]) * smoothstep(0.2, 0.38, p[1]));
        else lf = Math.max(lf, 0.02 * smoothstep(-0.2, -0.8, n[2]) * smoothstep(0.12, 0.24, p[1]));
        if (lb >= 0 && isPaw[lb]) { lf = 0.004; lc = C.paw; }
        col = mix3(col, lc, L);
        ag = mix(ag, AG.leg * smoothstep(0.12, 0.35, p[1]), L);
        fl = mix(fl, lf, L);
      }
    } else if (r === 4) {
      const t = tailT[v];
      const dors = dot(n, tailSegDorsal(v));
      const top = smoothstep(-0.35, 0.55, dors + 0.3 * nz);
      col = mix3(C.tailUnder, C.tailTop, top);
      ag = AG.tail * top;
      if (key === 'blackTan') col = mix3(col, black, smoothstep(0.75, 0.92, t + 0.05 * nz));
      if (key === 'sable') col = mix3(col, srgb(0x1c1716), smoothstep(0.82, 0.95, t));
      fl = variant === 'shepherd' ? mix(0.03, 0.045, smoothstep(0.05, 0.4, t)) * (1 - 0.25 * smoothstep(0.85, 1, t)) : mix(0.016, 0.02, t);
      under = 0.4;
    } else if (r === 5) {
      // ears: short fine hair, dark backs (shepherd), inner pinna paler with fine hair
      const facing = params.earType === 'prick' ? dot(n, norm([0.5 * Math.sign(p[0]), 0.05, 1])) : -n[0] * Math.sign(p[0]);
      col = C.earBack;
      if (facing > 0.3) { col = mix3(C.earBack, C.earInner, smoothstep(0.3, 0.75, facing)); fl = 0.006; }
      else fl = params.earType === 'drop' ? 0.009 : 0.006;
      ag = AG.head * 0.5;
    } else if (r === 7) {
      mat = MAT.MOUTH; col = srgb(0xc86070); fl = 0;
    } else {
      // ---------------- head & jaw
      const h = headLocal(p);
      col = mix3(C.headTop, C.tan, smoothstep(0.03, -0.02, h[1] + 0.1 * nz));
      ag = AG.head;
      // mask: muzzle and round the eyes (shepherds), darker forehead line
      const muzzle = smoothstep(0.035, 0.075, h[2]);
      const eyeRing = g3(h, [0.033, 0.022, 0.038], [0.02, 0.014, 0.02]);
      const cheek = g3(h, [0.04, -0.02, 0.0], [0.022, 0.022, 0.035]);
      const brow = g3(h, [0.025, 0.04, 0.036], [0.01, 0.007, 0.01]); // tan "eyebrow" spots
      if (key === 'blackTan' || key === 'sable') {
        let mk = clamp(Math.max(muzzle * (0.9 - 0.4 * smoothstep(-0.03, -0.06, h[1])), eyeRing * 0.9) * maskK, 0, 1);
        col = mix3(col, C.tan, cheek * 0.9);
        col = mix3(col, C.mask, mk);
        col = mix3(col, C.tanLight, brow * 0.6 * (1 - juv));
        ag *= 1 - 0.6 * mk;
        // pale chin / lower lips
        col = mix3(col, C.cream, smoothstep(-0.05, -0.07, h[1]) * smoothstep(-0.2, -0.6, n[1]) * 0.5);
      } else if (key === 'yellow') {
        col = mix3(col, C.tanLight, cheek * 0.4);
        col = mix3(col, C.cream, smoothstep(-0.04, -0.065, h[1]) * 0.4);
      }
      // fur length: sleek muzzle and face, longer at the back of the head
      fl = mix(0.009, 0.004, smoothstep(0.02, 0.1, h[2]));
      if (r === 6) fl = mix(0.005, 0.01, smoothstep(0.08, 0.0, h[2]));
      if (r === 2 && h[2] < -0.07) {
        const b = smoothstep(-0.07, -0.11, h[2]);
        fl = mix(fl, 0.03, b);
      }
      if (r === 2 && (params.ruff || 0) > 0.2) fl = Math.max(fl, 0.022 * params.ruff * smoothstep(-0.02, -0.06, h[2]) * smoothstep(0.035, 0.055, Math.abs(h[0])) * smoothstep(0.02, -0.01, h[1]));
      // eye rims (dark lid margins; liver in chocolates)
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.0042) mark = Math.min(mark, Math.abs(de) - 0.0017);
        if (Math.abs(de) < 0.0015) { mat = liver ? MAT.SKIN : MAT.DARK_SKIN; col = srgb(0x4a2a22); fl = 0; }
        else if (Math.abs(de) < 0.0042) fl = Math.min(fl, 0.0015);
      }
      // nose leather (liver in chocolates: bare skin with the liver colour)
      const dn = SDFModel.dist(nosePrim, p[0], p[1], p[2]);
      if (dn < 0.0022 && h[2] > 0.135) { mat = liver || key === 'yellow' ? MAT.SKIN : MAT.NOSE; col = noseCol; fl = 0; gloss = 0.55; }
      else if (dn < 0.005 && h[2] > 0.13) { mark = Math.min(mark, dn - 0.0032); fl = Math.min(fl, 0.002); }
      // lips: head vertices near the jaw surface, jaw vertices near the head surface (dark lip line)
      if (r !== 6) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (dj < -0.0005) { mat = MAT.MOUTH; col = srgb(0x6e3438); fl = 0; }
        else if (dj < 0.0045 && h[2] > -0.02) { mark = Math.min(mark, dj - 0.0032); fl = Math.min(fl, 0.002); }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (dh < 0.0) { mat = MAT.MOUTH; col = srgb(0x6e3438); fl = 0; }
        else if (dh < 0.0035) { mark = Math.min(mark, dh - 0.0026); fl = Math.min(fl, 0.002); }
      }
      for (const c of toothPrims) if (SDFModel.dist(c, p[0], p[1], p[2]) < 0.0012) { mat = MAT.KERATIN; col = srgb(0xe8e0cc); fl = 0; mark = 1; }
      under = 0.25;
    }
    // claws and pads (keratin claws; dark pads)
    if (legness[v] > 0.5 && legBone[v] >= 0 && isPaw[legBone[v]]) {
      for (const c of clawPrims) if (SDFModel.dist(c, p[0], p[1], p[2]) < 0.0009) { mat = MAT.KERATIN; col = key === 'terrier' || key === 'yellow' ? srgb(0xb8a894) : srgb(0x2a2420); fl = 0; }
      if (mat === MAT.FUR) for (const c of padPrims) if (SDFModel.dist(c, p[0], p[1], p[2]) < 0.0012 && n[1] < -0.3) { mat = MAT.SKIN; col = liver ? srgb(0x5a3a30) : srgb(0x2a2524); fl = 0; gloss = 0.2; }
    }
    // terrier patches
    if (patches.length || variant === 'terrier') {
      let pd = 1, pc = C.patchTan, blackK = 0;
      if (patches.length && (r === 0 || r === 1 || r === 4)) { const q = patchD(p); pd = q.d; blackK = q.black; }
      if (r === 2 || r === 5) {
        // tan head mask: the ears, round the eyes, the cheeks and the skull; the muzzle, chin and
        // throat stay white, and a white blaze runs up the middle from the nose (seeded width, length
        // and asymmetry). 'white' terriers keep tan only on the ears and round one or both eyes.
        const h = headLocal(p);
        const side = Math.sign(h[0]) || 1;
        const ext = 1 + 0.35 * maskSide * side;
        const wob = 0.005 * (fbm3(p[0] * 30 + nOff, p[1] * 30, p[2] * 30, 2) - 0.5);
        const mostlyWhite = params.colour === 'white';
        const zFront = (mostlyWhite ? 0.03 : 0.068) * ext, yLow = mostlyWhite ? 0.0 : -0.022 - 0.006 * ext;
        const dMask = Math.max(h[2] - zFront, yLow - h[1], -0.09 - h[2]) + wob;
        const bw = (0.004 + 0.01 * blaze) * (0.5 + 0.8 * smoothstep(0.0, 0.07, h[2]));
        const dBlaze = Math.max(Math.abs(h[0]) - bw, (params.blazeEnd ?? -0.02) - h[2]);
        pd = r === 5 ? -0.02 : Math.max(dMask, -dBlaze);
        if (mostlyWhite && r === 2 && maskSide * side < -0.3) pd = Math.max(pd, 0.01); // one eye patch only
      }
      if (pd < 1) {
        pattern[v] = pd;
        pc = mix3(C.patchTan, C.patchBlack, blackK);
        patCol[v * 4] = pc[0]; patCol[v * 4 + 1] = pc[1]; patCol[v * 4 + 2] = pc[2]; patCol[v * 4 + 3] = mat === MAT.FUR ? 1 : 0;
      }
    }
    // pups: fluffy and soft
    if (juv > 0 && mat === MAT.FUR) {
      fl = mix(fl, Math.max(fl * 0.8, r === 2 || r === 6 ? 0.01 : 0.018), juv);
      ag *= 1 - 0.6 * juv;
    }
    if (mat === MAT.FUR) fl *= FK;
    // low-frequency colour variation
    const cvh = fbm3(p[0] * 4 + 5 + nOff, p[1] * 4, p[2] * 4, 2) - 0.5;
    if (mat === MAT.FUR) {
      const a = key === 'terrier' ? 0.25 : 1;
      col = [col[0] * (1 + a * (0.12 * nz + 0.08 * cvh + 0.06 * nz2)), col[1] * (1 + a * (0.1 * nz + 0.06 * nz2)), col[2] * (1 + a * (0.08 * nz - 0.06 * cvh + 0.06 * nz2))];
    }
    markSDF[v] = mark;
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    surf[v * 4] = mat === MAT.FUR ? gloss : mat === MAT.KERATIN ? 0.7 : mat === MAT.NOSE || mat === MAT.SKIN ? gloss : 0;
    surf[v * 4 + 2] = mat === MAT.FUR ? clamp(ag * (0.85 + 0.3 * nz2), 0, 1) : 0;
    surf[v * 4 + 3] = mat === MAT.FUR ? under : 0;
  }

  smoothField(furLen, weights.neighbors, 3, (v) => tint[v * 4 + 3] > 0);
  // the neck's long ruff and the head's short throat coat meet at the neck cut, where the head and body surfaces
  // overlap and the coat's regions switch: the hair went from 25 to 9 mm within 15 mm of the cut, and the two
  // surfaces took different lengths at one place, so the ruff ended in a crisp collar line round the throat. Near the
  // cut the hair length and the colour (the head's and the neck's colour rules also stepped there, 3 mm wide) are
  // averaged in space over both surfaces (Gaussian, 13 mm): one field, fading over a few cm
  {
    const R = 0.013, cell = 2 * R, grid = new Map(), near = [];
    const ck = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    for (let v = 0; v < nV; v++) {
      if (tint[v * 4 + 3] !== MAT.FUR) continue;
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      if (Math.abs(neckS(x, y, z)) > 0.09) continue;
      const k = ck(x, y, z); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(v);
      if (Math.abs(neckS(x, y, z)) < 0.06) near.push(v);
    }
    const out = new Float32Array(near.length), outC = new Float32Array(near.length * 3);
    near.forEach((v, i) => {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell), gz = Math.floor(z / cell);
      let a = 0, w = 0, cr = 0, cg = 0, cb = 0;
      for (let ia = -1; ia <= 1; ia++) for (let ib = -1; ib <= 1; ib++) for (let ic = -1; ic <= 1; ic++) {
        const l = grid.get(`${gx + ia},${gy + ib},${gz + ic}`); if (!l) continue;
        for (const u of l) {
          const d2 = (pos[u * 3] - x) ** 2 + (pos[u * 3 + 1] - y) ** 2 + (pos[u * 3 + 2] - z) ** 2;
          if (d2 > 4 * R * R) continue;
          const wt = Math.exp(-d2 / (2 * R * R)); a += wt * furLen[u]; w += wt;
          cr += wt * tint[u * 4]; cg += wt * tint[u * 4 + 1]; cb += wt * tint[u * 4 + 2];
        }
      }
      out[i] = w > 0 ? a / w : furLen[v];
      if (w > 0) { outC[i * 3] = cr / w; outC[i * 3 + 1] = cg / w; outC[i * 3 + 2] = cb / w; } else { outC[i * 3] = tint[v * 4]; outC[i * 3 + 1] = tint[v * 4 + 1]; outC[i * 3 + 2] = tint[v * 4 + 2]; }
    });
    near.forEach((v, i) => {
      const k = 1 - smoothstep(0.035, 0.06, Math.abs(neckS(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])));
      furLen[v] = furLen[v] + (out[i] - furLen[v]) * k;
      for (let c = 0; c < 3; c++) tint[v * 4 + c] += (outC[i * 3 + c] - tint[v * 4 + c]) * k;
    });
  }
  // the head and body surfaces' skin weights made equal across the neck cut (regions.js): they parted at the throat
  // and the fur rooted on the hidden surface drew a crisp line across the ruff
  harmonizeSeamWeights(ctx, neckS, NECK_CUT.band);
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor: patCol, surf, region, ventral, tailT };
}
