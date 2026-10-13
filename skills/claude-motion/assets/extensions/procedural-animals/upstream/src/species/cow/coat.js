// The cow's coat: breed colours (Holstein black-and-white piebald, Red Holstein, Hereford red with a
// white face, crest and underline, black Angus, fawn Jersey with a dark face and a pale muzzle ring,
// Highland ginger / black / dun with a long shaggy coat), Holstein patches grown as a seeded signed
// distance field on the skin (unique per individual, crisp slightly ragged edges), white socks and
// switch, pink skin and pale hooves under white hair, the moist pebbled muzzle (pink or black), long
// lashes on the upper lids, the udder's bare pink skin, keratin claws and horns (pale base, dark tip),
// yellow ear tags, a steel nose ring, and hair flow along the bovine hair tracts (forehead whorl,
// down the face, backward and down the barrel, down the legs).
import { HEAD_O, HZ, HY, BONE_SEGS } from './rig.js';
import { neckS } from './regions.js';
import { EYE } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, smoothField } from '../../core/build/coatKit.js';

// sRGB swatches sampled from the reference photos
export const BREEDS = {
  holstein: { body: 0x141312, dorsal: 0x121110, belly: 0x1c1a19, head: 0x141312, white: 0xf1efe9, muzzleDark: 0x1e1a1a, pied: 1 },
  redholstein: { body: 0x7e2e1c, dorsal: 0x72291a, belly: 0x8a3824, head: 0x7a2c1b, white: 0xf1efe9, muzzleDark: 0x9a6a5a, pied: 1 },
  hereford: { body: 0x7e3a20, dorsal: 0x70321b, belly: 0x8a4428, head: 0x7e3a20, white: 0xefe9df, muzzleDark: 0xd8a090 },
  angus: { body: 0x161413, dorsal: 0x141211, belly: 0x1e1a18, head: 0x161413, white: 0x161413, muzzleDark: 0x1a1818 },
  redangus: { body: 0x6a2a18, dorsal: 0x5e2515, belly: 0x72301c, head: 0x6a2a18, white: 0x6a2a18, muzzleDark: 0x4a3028 },
  jersey: { body: 0x9a7652, dorsal: 0x856444, belly: 0xae8c66, head: 0x5e4533, white: 0xd6c7a8, muzzleDark: 0x1e1a18, dark: 0x5e4533 },
  highland: { body: 0xa0522d, dorsal: 0x96492a, belly: 0xae6238, head: 0xa0522d, white: 0xa0522d, muzzleDark: 0x2a2220 },
  highlandblack: { body: 0x1c1816, dorsal: 0x181412, belly: 0x241e1a, head: 0x1c1816, white: 0x1c1816, muzzleDark: 0x1a1616 },
  highlanddun: { body: 0xb89a6e, dorsal: 0xac8e62, belly: 0xc4a87c, head: 0xb09268, white: 0xb89a6e, muzzleDark: 0x3a3028 },
};
const PINK = 0xd99a8e, UDDER = 0xe0b0a0, HOOF = 0x2a2522, HOOF_PALE = 0x8c8174, HORN_BASE = 0xd8cbb0, HORN_TIP = 0x3a3530;
const TAG = 0xe8c020, RING = 0x8a8a86;
const LID_DARK = srgb(0x3a302b), LID_PINK = srgb(0xc8847a), LID_RING = srgb(0x2c2826);

function palette(p) {
  const C = BREEDS[p.coat] || BREEDS.holstein;
  const k = p.coatShade || 0, l = p.coatLightness || 0;
  const tw = (hex) => { const c = srgb(hex); return [c[0] * (1 + 0.08 * k + l), c[1] * (1 + l), c[2] * (1 - 0.08 * k + l)]; };
  const out = { body: tw(C.body), dorsal: tw(C.dorsal), belly: tw(C.belly), head: tw(C.head), white: srgb(C.white), muzzleDark: srgb(C.muzzleDark), pied: !!C.pied };
  if (C.dark) out.dark = tw(C.dark);
  out.pink = srgb(PINK); out.udder = srgb(UDDER); out.hoof = srgb(HOOF); out.hoofPale = srgb(HOOF_PALE);
  out.hornBase = srgb(HORN_BASE); out.hornTip = srgb(HORN_TIP);
  return out;
}

const HOOF_TAGS = new Set(['hoof', 'heelbulb', 'dewclaw']);
const UDDER_TAGS = new Set(['udder', 'teat']);

export function cowCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, regionNames, weights, nV, params, lists } = ctx;
  const { BONES } = rig;
  const J = rig.J;
  const COL = palette(params);
  const calf = params.age === 'juvenile';
  const breed = params.variant || 'holstein';
  const { dominant, axialS, skinIndex, skinWeight, limbMember } = weights;
  const AX_LEN = weights.axialLengths;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8];
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const eyeFrames = [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s));
  const jawPrims = model.forPart('jaw');
  const headPrims = model.forPart('body').filter((p) => p.bone === 'head' && !p.carve);
  const nostrilPrims = model.prims.filter((p) => p.tag === 'nostril');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof|femur|tibia|metatarsus|hpaw|hhoof)/.test(b.name));
  const isFront = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof)/.test(b.name));
  const tailIdx = (name) => (name.startsWith('tail') ? +name.slice(4) : -1);
  const HL = (p) => { const d = sub(p, HEAD_O); return [d[0], dot(d, HY), dot(d, HZ)]; };
  const rname = regionNames.map((n) => n);

  // --- nearest primitive tag per vertex
  const tagOf = new Array(nV);
  for (let v = 0; v < nV; v++) {
    const L = lists[v], p = P(v);
    let best = 1e9, t = '';
    for (const pr of L) {
      if (pr.carve) continue;
      const d = SDFModel.dist(pr, p[0], p[1], p[2]);
      if (d < best) { best = d; t = pr.tag; }
    }
    tagOf[v] = t;
  }

  // --- regions: 0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw, 7 switch, 8 horn, 9 ear tag,
  // 10 nose ring, 11 tongue
  const region = new Uint8Array(nV);
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  for (let v = 0; v < nV; v++) {
    const bn = BONES[dominant[v]].name, p = P(v), tag = tagOf[v], rn = rname[partOf[v]];
    let lb = -1, lw = 0;
    for (let k = 0; k < 4; k++) {
      const b = skinIndex[v * 4 + k], w = skinWeight[v * 4 + k];
      if (isLimb[b] && w > lw) { lw = w; lb = b; }
    }
    legBone[v] = lb;
    legness[v] = lb >= 0 ? smoothstep(0.15, 0.85, limbMember[v]) : 0;
    const ti = tailIdx(bn);
    if (rn === 'jaw') region[v] = 6;
    else if (rn === 'horn') region[v] = 8;
    else if (rn === 'tagL' || rn === 'tagR') region[v] = 9;
    else if (rn === 'ring') region[v] = 10;
    else if (rn === 'tongue') region[v] = 11;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (tag === 'switch') region[v] = 7;
    else if (ti >= 0 && axialS[v] > sTailBase + 0.02) region[v] = 4;
    else if (rn === 'feet' || (lb >= 0 && limbMember[v] > 0.5 && p[1] < 1.0)) region[v] = 0; // (legs: never head or neck by the axial coordinate)
    else if (axialS[v] < sOcc + 0.02 || (rn === 'head' && neckS(p[0], p[1], p[2]) > 0.03)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) legness[v] = 0;
    if (rn === 'feet') legness[v] = 1;
  }

  // --- white: a signed distance to the white areas (< 0 white), per breed
  // Holstein: seeded piebald patches (3D noise on the reference skin: unique per individual),
  // biased white on the lower legs, belly, udder and switch; a seeded face (blaze, star, white or
  // black face). Hereford: white face, crest, dewlap, brisket, underline, lower legs and switch.
  const R = rng(9311 + (params.coatSeed || 0));
  const off = [R() * 100, R() * 100, R() * 100];
  const cover = params.blackCover ?? 0.55; // share of the body that is black (Holstein)
  const face = params.face || 'blaze';
  const faceW = params.faceWidth ?? 1;
  const freq = params.patchFreq ?? 2.4;
  const pied = (p) => {
    // low-frequency patches with ragged, slightly jagged edges; value > 0 = white
    const f = fbm3(p[0] * freq * 1.35 + off[0], p[1] * freq + off[1], p[2] * freq * 0.85 + off[2], 3);
    const j = (vnoise3(p[0] * 26 + off[1], p[1] * 26, p[2] * 26 + off[2]) - 0.5) * 0.035;
    return f + j - (0.5 + (cover - 0.55) * 0.55);
  };
  const faceField = (h) => {
    // head-local: > 0 white (front of the face)
    const ax = Math.abs(h[0]);
    const front = h[1] + 0.06 - 0.25 * Math.max(0, -h[2] - 0.05); // dorsal side of the face
    let f = -1;
    const w = faceW;
    if (face === 'blaze') f = Math.min(0.04 * w + 0.03 * smoothstep(0.2, 0.36, h[2]) + 0.02 * smoothstep(-0.05, -0.16, h[2]) - ax, front, 0.44 - h[2]);
    else if (face === 'star') f = 0.035 * w - Math.hypot(ax, (h[2] - 0.0) * 0.6);
    else if (face === 'white') f = Math.min(0.11 - Math.max(0, ax - 0.03) * 0.8 - Math.max(0, -h[1] - 0.05) * 0.8, 0.45 - h[2]);
    else if (face === 'strip') f = Math.min(0.022 * w - ax, front, 0.3 - h[2], h[2] + 0.02);
    return f;
  };
  // gradient-normalised field -> metres (so the shader's edge antialiasing has the right width)
  const toSD = (fn, p) => {
    const e = 0.01, f0 = fn(p);
    const gx = (fn([p[0] + e, p[1], p[2]]) - f0) / e, gy = (fn([p[0], p[1] + e, p[2]]) - f0) / e, gz = (fn([p[0], p[1], p[2] + e]) - f0) / e;
    const g = Math.max(0.5, Math.hypot(gx, gy, gz));
    return -f0 / g;
  };
  const whiteSDF = (v) => {
    const p = P(v), r = region[v], n = N(v);
    const lb = legBone[v];
    if (breed === 'holstein') {
      if (r === 8 || r === 9 || r === 10 || r === 11) return 1;
      if (r === 2 || r === 6 || r === 5) {
        // head: black with the seeded face marking (ears black; patches may reach the cheeks)
        if (r === 5) return toSD((q) => pied(q) - 0.25, p) ;
        const fn = (q) => Math.max(faceField(HL(q)) * 8, pied(q) - 0.3 - 0.25 * smoothstep(-0.1, 0.2, HL(q)[2]));
        return toSD(fn, p);
      }
      if (r === 7) return -0.02; // white switch
      const fn = (q) => {
        let f = pied(q);
        // white lower legs (below the knees / hocks), white belly and udder
        const L = legness[v];
        if (L > 0 || lb >= 0) {
          const knee = lb >= 0 && isFront[lb] ? 0.46 : 0.58;
          f += 0.9 * smoothstep(knee + 0.1, knee - 0.12, q[1]) * Math.max(L, 0.3);
        }
        f += 0.55 * smoothstep(0.8, 0.62, q[1]) * (1 - L * 0.5);
        if (UDDER_TAGS.has(tagOf[v])) f += 0.5;
        // the tail: usually black at the root, white further down
        if (r === 4) f += 0.5 * smoothstep(1.2, 0.8, q[1]);
        return f;
      };
      return toSD(fn, p);
    }
    if (breed === 'hereford') {
      if (r === 8 || r === 9 || r === 10 || r === 11) return 1;
      const jag = (fbm3(p[0] * 40 + off[0], p[1] * 40, p[2] * 40, 2) - 0.5) * 0.03;
      if (r === 2 || r === 6) {
        const h = HL(p);
        // white face; red around the eyes on some ("spectacles"); the white runs over the poll
        let d = -0.02 + Math.max(0, h[2] < -0.15 ? (-0.15 - h[2]) * 0.5 : 0);
        if (params.spectacles) for (const ef of eyeFrames) d = Math.max(d, 0.03 - Math.hypot(p[0] - ef.c[0], p[1] - ef.c[1], p[2] - ef.c[2]));
        return d + jag;
      }
      if (r === 5) return 0.02; // red ears
      if (r === 7) return -0.02;
      if (r === 4) return 0.02;
      let d = 1;
      // crest: white along the top of the neck behind the poll
      if (r === 1) d = Math.min(d, Math.abs(p[0]) - 0.06 - 0.06 * smoothstep(0.85, 1.08, p[2]) + (1.36 - p[1]) * 0.6 + 0.2 * smoothstep(0.85, 0.7, p[2]));
      // underline: throat, dewlap, brisket, belly
      // (the white line along the belly rises into the brisket, dewlap and throat in front)
      const lineY = 0.7 + 0.3 * smoothstep(0.45, 0.8, p[2]) + 0.05 * smoothstep(-0.3, -0.6, p[2]);
      if (legness[v] < 0.5) d = Math.min(d, (p[1] - lineY) + 0.25 * Math.max(0, Math.abs(p[0]) - 0.12) * (p[2] < 0.5 ? 1 : 0));
      // lower legs
      if (legness[v] > 0.3 && lb >= 0) d = Math.min(d, p[1] - (isFront[lb] ? 0.3 : 0.36) + (fbm3(p[0] * 18 + off[1], p[1] * 9, p[2] * 18, 2) - 0.5) * 0.12);
      if (UDDER_TAGS.has(tagOf[v])) d = -0.02;
      return d + jag;
    }
    void n;
    return 1;
  };

  // --- ventral factor (lighter belly, inner legs)
  const ventral = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const n = N(v), r = region[v], p = P(v);
    let w = 0;
    if (r === 0) w = smoothstep(-0.2, -0.8, n[1]) * smoothstep(1.1, 0.85, p[1]);
    else if (r === 1) w = smoothstep(0.0, -0.7, n[1]) * 0.5;
    const L = legness[v];
    if (L > 0) { const side = p[0] >= 0 ? 1 : -1; w = mix(w, smoothstep(0.1, -0.7, n[0] * side) * 0.6 * smoothstep(0.4, 0.8, p[1]), L); }
    ventral[v] = w;
  }

  // --- comb (hair flow)
  const comb = new Float32Array(nV * 3);
  const whorl = [0, 0.06, -0.02]; // forehead whorl, head-local
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const bone = BONES[dominant[v]];
    let d;
    if (r === 5) d = norm(sub(bone.tail, bone.head));
    else if (r === 8) d = norm(sub(p, add(HEAD_O, [0, 0.06, -0.12]))); // horn: along its length
    else if (r === 2 || r === 6 || r === 9 || r === 10 || r === 11) {
      const h = HL(p);
      const rel = [h[0] - whorl[0], h[1] - whorl[1], h[2] - whorl[2]];
      const w = [rel[0], rel[1] * 0.4 - 0.05, rel[2] + 0.08];
      d = norm(add(mul(HY, w[1]), add(mul(HZ, w[2]), [w[0], 0, 0])));
      if (h[2] < -0.1) d = norm(add(d, [0, -0.6, -0.8]));
    } else if (r === 7 || r === 4) {
      d = norm(sub(bone.tail, bone.head));
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = rig.AXIAL.points[seg], b = rig.AXIAL.points[Math.min(seg + 1, rig.AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.45 * Math.abs(n[0]), 0]));
      if (r === 1) d = norm(add(d, [0, -0.6, 0.1]));
      const L = legness[v];
      if (L > 0 && legBone[v] >= 0) {
        const lbn = BONES[legBone[v]];
        let dl = norm(sub(lbn.tail, lbn.head));
        if (/hoof/.test(lbn.name)) dl = [0, -1, 0.1];
        else dl = norm(add(dl, [0, -0.3, 0]));
        d = norm(add(mul(d, 1 - L), mul(dl, L)));
      }
    }
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];
  }

  // --- per-vertex fields
  const pattern = new Float32Array(nV).fill(1);
  const patInt = new Float32Array(nV);
  const patCol = new Float32Array(nV * 3);
  const markSDF = new Float32Array(nV).fill(1);
  const furLen = new Float32Array(nV);
  const tint = new Float32Array(nV * 4);
  const surf = new Float32Array(nV * 4);
  const shag = params.shaggy ? 1 : 0;
  const hornLen = params.horns ? params.horns.len : 0;

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v], tag = tagOf[v];
    let col, mat = MAT.FUR, fl = 0.008, mark = 1, gloss = 0.55, sy = 0;
    const wsdf = whiteSDF(v);
    const white = wsdf < 0;
    const lb = legBone[v];
    const lbName = lb >= 0 ? BONES[lb].name : '';
    if (r === 0 || r === 1) {
      const up = clamp(n[1], -1, 1);
      col = mix3(COL.body, COL.dorsal, smoothstep(0.3, 0.95, up) * 0.8);
      col = mix3(col, COL.belly, ventral[v]);
      if (COL.dark) {
        // Jersey: darker over the neck, shoulders and hips (much darker in bulls)
        const dk = (r === 1 ? 0.55 : 0.25 * smoothstep(0.55, 0.85, p[2]) + 0.3 * smoothstep(-0.55, -0.85, p[2]) * smoothstep(1.0, 1.3, p[1])) * (1 + 0.8 * (params.bull || 0));
        col = mix3(col, COL.dark, clamp(dk, 0, 0.85) * (1 - ventral[v]));
      }
      fl = mix(0.008, 0.011, ventral[v]);
      if (r === 1 && (params.bull || 0) > 0.5) fl = 0.014; // bull: coarser curly neck hair
      const L = legness[v];
      if (L > 0) {
        fl = mix(fl, mix(0.004, 0.008, smoothstep(0.25, 0.8, p[1])), L);
        if (COL.dark) col = mix3(col, COL.dark, 0.5 * smoothstep(0.5, 0.15, p[1]) * L); // Jersey: dark lower legs
      }
      // hooves, heel bulbs and dew claws below the coronet line (higher at the toe than at the heel)
      const Cj = /hoof|paw/.test(lbName) ? J[(lbName[0] === 'f' ? 'fcoffin' : 'hcoffin') + BONES[lb].side] : null;
      if (Cj && HOOF_TAGS.has(tag) && (tag === 'dewclaw' || p[1] < Cj[1] + 0.016 + 0.35 * (p[2] - Cj[2]) * (lbName[0] === 'f' ? 1 : 1))) {
        mat = MAT.KERATIN; fl = 0; gloss = 0.5;
        // (under white hair: slate-horn claws with dark vertical pigment streaks, as in most pied
        // cattle; pure pale claws read as white plastic slippers)
        if (white) {
          const streak = smoothstep(0.45, 0.62, fbm3(p[0] * 90 + (params.coatSeed % 97), p[1] * 6, p[2] * 90, 2));
          col = mix3(COL.hoofPale, COL.hoof, 0.25 + 0.6 * streak);
        } else col = COL.hoof;
        if (tag === 'heelbulb') col = mix3(col, [0.08, 0.06, 0.05], 0.4);
      }
      if (UDDER_TAGS.has(tag)) {
        // udder: bare pink skin with a sparse fine coat; teats bare
        mat = MAT.SKIN; gloss = 0.35;
        col = breed === 'angus' || breed === 'highland' ? [0.05, 0.04, 0.04] : breed === 'jersey' ? mix3(COL.udder, COL.body, 0.45) : COL.udder;
        fl = tag === 'teat' ? 0 : 0.0025;
      }
      if (tag === 'sheath' || tag === 'scrotum') { fl = tag === 'sheath' ? 0.02 : 0.004; }
    } else if (r === 4) {
      col = mix3(COL.body, COL.dorsal, 0.4);
      fl = 0.006;
    } else if (r === 7) {
      // switch: a long tassel (white on Holsteins and Herefords, black on Angus and Jerseys)
      col = breed === 'jersey' ? srgb(0x1a1614) : breed === 'holstein' || breed === 'hereford' ? COL.white : mix3(COL.body, [0.02, 0.02, 0.02], 0.2);
      fl = calf ? 0.03 : 0.05;
    } else if (r === 5) {
      // ears: coat colour outside, long pale hair inside the pinna
      const earP = model.prims.find((q) => q.tag === 'ear' && (q.bone === (p[0] > 0 ? 'earL' : 'earR')));
      const faceDir = [earP.P[9], earP.P[10], earP.P[11]];
      const front = dot(n, faceDir);
      col = COL.head;
      fl = 0.006;
      if (front > 0.3) { fl = 0.016; col = mix3(col, srgb(0x9a8a80), 0.12); }
      else if (front > -0.2) fl = 0.012; // (the fringe of hair around the rim)
    } else if (r === 8) {
      // horn: pale waxy base, dark tip, growth rings
      mat = MAT.KERATIN; fl = 0; gloss = 0.7;
      const hb = [HEAD_O[0] + Math.sign(p[0]) * 0.082, 0, 0];
      const along = clamp((Math.abs(p[0]) - Math.abs(hb[0])) / Math.max(0.08, hornLen * 0.85), 0, 1);
      const hl2 = params.horns && (params.horns.style === 'down' || params.horns.style === 'lyre' || params.horns.style === 'wide') ? along : along;
      col = mix3(COL.hornBase, COL.hornTip, smoothstep(0.55, 0.95, hl2));
      col = mix3(col, mul(COL.hornBase, 0.75), 0.25 * smoothstep(0.15, 0.0, hl2));
    } else if (r === 9) {
      mat = MAT.SKIN; fl = 0; gloss = 0.75; col = srgb(TAG);
    } else if (r === 10) {
      mat = MAT.KERATIN; fl = 0; gloss = 0.95; col = srgb(RING);
    } else if (r === 11) {
      mat = MAT.MOUTH; fl = 0;
      col = [0.3, 0.12, 0.13];
    } else {
      // head & jaw
      col = COL.head;
      fl = 0.006;
      const h = HL(p);
      // Jersey: the dished face darker, a pale ring around the black muzzle, mealy eye rings
      if (COL.dark) col = mix3(col, COL.body, 0.25 * smoothstep(0.05, 0.25, h[2]));
      // poll tuft / curly forehead (bulls, Herefords)
      if (h[1] > 0.02 && h[2] < 0.12) fl = mix(fl, (params.bull || 0) > 0.5 || breed === 'hereford' ? 0.028 : 0.016, smoothstep(0.02, 0.06, h[1]) * smoothstep(0.12, -0.05, h[2]));
      // moist pebbled muzzle plate (planum nasolabiale) with the nostrils; pink under white hair
      const planum = smoothstep(0.33, 0.36, h[2]) * smoothstep(-0.115, -0.1, h[1]) * smoothstep(0.02, 0.0, h[1] - 0.02 * (h[2] - 0.35));
      const muzzleWhite = breed === 'holstein' ? white || faceField(h) > -0.02 : breed === 'hereford';
      const muzCol = muzzleWhite ? COL.pink : COL.muzzleDark;
      if (planum > 0.5) { mat = MAT.WET_SKIN; col = muzCol; fl = 0; gloss = 0.8; sy = 0.0018; }
      else {
        // a fringe of short hair in the muzzle colour around the moist plate (hides the material step)
        const fr = smoothstep(0.29, 0.34, h[2]) * smoothstep(-0.13, -0.105, h[1]);
        if (fr > 0) { fl = mix(fl, 0.002, fr); col = mix3(col, muzCol, fr); }
      }
      if (COL.dark) {
        // Jersey: pale ring around the dark muzzle
        const ring = smoothstep(0.26, 0.3, h[2]) * (1 - smoothstep(0.33, 0.35, h[2]));
        col = mix3(col, COL.white, ring * 0.85);
        for (const ef of eyeFrames) { const de = Math.hypot(p[0] - ef.c[0], p[1] - ef.c[1], p[2] - ef.c[2]); col = mix3(col, mix3(COL.body, COL.white, 0.5), 0.6 * smoothstep(0.045, 0.028, de)); }
      }
      if (h[2] < -0.14) col = mix3(col, COL.body, smoothstep(-0.14, -0.2, h[2]) * 0.6);
      // chin whiskers / tactile hairs are part of the short muzzle hair; lips: fine hair
      // eye rims: the lid margin is bare, moist skin, dark grey-brown (a shade lighter than black hair:
      // the lid line that separates the eye from a black face; pink in white faces, research 7), with no
      // drawn line; lashes along the upper lid, rising from the margin
      for (let e = 0; e < eyePrims.length; e++) {
        const de = Math.abs(SDFModel.dist(eyePrims[e], p[0], p[1], p[2]));
        // the fine short hair round the eye (a shade greyer on a dark face: skin shows through it)
        if (de < 0.016 && !white) col = mix3(col, LID_RING, 0.45 * smoothstep(0.016, 0.005, de));
        if (de < 0.016) fl = Math.min(fl, mix(0.003, fl, smoothstep(0.009, 0.016, de)));
        if (de < 0.0035) { mat = MAT.SKIN; fl = 0; gloss = 0.6; col = white ? LID_PINK : LID_DARK; }
        else if (de < 0.009) {
          const ef = eyeFrames[p[0] > 0 ? 0 : 1];
          const rel = sub(p, ef.c);
          const upAmt = dot(rel, ef.y) / 0.018;
          if (upAmt > 0.2) {
            // lashes: up to 9 mm at the middle of the upper lid, sweeping out, forward and down over
            // the eye; they rise over the 6 mm next to the margin (a longer fringe on a thin band
            // stood up as a wall of fur)
            fl = 0.003 + 0.006 * smoothstep(0.2, 0.55, upAmt) * smoothstep(0.009, 0.0035, de);
            col = white ? mix3(col, [0.6, 0.55, 0.5], 0.3) : [0.012, 0.011, 0.01];
            const lash = norm(add(add(mul(ef.z, 1.0), mul(ef.y, 0.15)), mul(norm(rel), 0.4)));
            let t = sub(lash, mul(n, dot(lash, n)));
            if (len(t) > 1e-4) { t = norm(t); comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2]; }
          } else fl = Math.min(fl, 0.003);
        }
      }
      // nostrils: dark rims
      for (const e of nostrilPrims) {
        const dn = SDFModel.dist(e, p[0], p[1], p[2]);
        if (dn < 0.004) { mat = MAT.WET_SKIN; col = mul(muzCol, 0.35); fl = 0; mark = Math.min(mark, dn - 0.003); gloss = 0.8; sy = 0.0015; }
      }
      // lips: head vertices near the jaw surface, jaw vertices near the head surface
      if (r !== 6) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (dj < 0.002 && h[2] > 0.18) { mat = MAT.MOUTH; fl = 0; }
        else if (dj < 0.006 && h[2] > 0.18) { mark = Math.min(mark, dj - 0.005); fl = Math.min(fl, 0.002); }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (dh < 0.0) { mat = MAT.MOUTH; fl = 0; }
        else if (dh < 0.005) { mark = Math.min(mark, dh - 0.004); fl = Math.min(fl, 0.002); }
        if (mat === MAT.FUR && h[2] > 0.33) { col = mix3(col, muzCol, 0.6); fl = 0.003; }
      }
    }
    // Highland: long shaggy coat over everything but the muzzle, lower legs and horns
    if (shag && mat === MAT.FUR) {
      let sl = 0.075;
      if (r === 2 || r === 6) { const h = HL(p); sl = h[2] < 0.12 ? (h[1] > -0.02 ? 0.11 : 0.06) : mix(0.05, 0.01, smoothstep(0.15, 0.3, h[2])); }
      if (r === 5) sl = 0.05;
      if (r === 7) sl = 0.08;
      if (legness[v] > 0) sl = mix(sl, 0.02, smoothstep(0.7, 0.3, p[1]) * legness[v]);
      fl = Math.max(fl, sl * (calf ? 0.6 : 1));
    }
    // white hair (patches, face, socks): the pattern colour over the base (pink skin under it)
    // (the pattern field stays continuous: capped just above zero where there is nothing)
    // Bare skin, keratin, lids and muzzle lie inside the pattern with their own colour as its colour:
    // at a white-hair / bare-skin border white then blends into pink; outside the pattern the base
    // tint of the white hair beside them (a Holstein's base is black) showed as a dark rim round the
    // udder, the muzzle and the coronets
    const CAP = 0.02;
    const bare = mat !== MAT.FUR;
    const pd = bare ? -CAP : clamp(wsdf, -CAP, CAP);
    // low-frequency colour variation
    const cv = fbm3(p[0] * 5, p[1] * 5, p[2] * 5, 3) - 0.5;
    if (mat === MAT.FUR) col = [col[0] * (1 + 0.14 * cv), col[1] * (1 + 0.12 * cv), col[2] * (1 + 0.1 * cv)];
    if (r === 7 || shag) {
      const c = [comb[v * 3], comb[v * 3 + 1], comb[v * 3 + 2]];
      const along = dot(p, c), q = sub(p, mul(c, along));
      const st = vnoise3(q[0] * 90, q[1] * 90, q[2] * 90 + along * 3);
      col = mul(col, 0.8 + 0.4 * st);
    }
    pattern[v] = pd; patInt[v] = 1;
    const wc = bare ? col : COL.white;
    patCol[v * 3] = wc[0]; patCol[v * 3 + 1] = wc[1]; patCol[v * 3 + 2] = wc[2];
    markSDF[v] = mark;
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    surf[v * 4] = gloss; surf[v * 4 + 1] = sy;
  }
  // hair outside the pattern (black) beside bare skin takes that skin's colour as its pattern colour:
  // across the border the pattern colour then runs from the skin's own colour, not from white (a pale
  // seam round a dark muzzle or hoof)
  const nbr = weights.neighbors;
  for (let v = 0; v < nV; v++) {
    if (tint[v * 4 + 3] !== MAT.FUR || pattern[v] < 0) continue;
    let n = 0, c0 = 0, c1 = 0, c2 = 0;
    for (const u of nbr[v]) if (tint[u * 4 + 3] !== MAT.FUR) { n++; c0 += patCol[u * 3]; c1 += patCol[u * 3 + 1]; c2 += patCol[u * 3 + 2]; }
    if (n) { patCol[v * 3] = c0 / n; patCol[v * 3 + 1] = c1 / n; patCol[v * 3 + 2] = c2 / n; }
  }
  // calves: soft fluffy body coat
  if (calf) for (let v = 0; v < nV; v++) if (tint[v * 4 + 3] === MAT.FUR && region[v] <= 1) furLen[v] = Math.max(furLen[v], 0.014);
  smoothField(furLen, weights.neighbors, 2, (v) => tint[v * 4 + 3] !== MAT.FUR);

  const patternColor = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) { patternColor[v * 4] = patCol[v * 3]; patternColor[v * 4 + 1] = patCol[v * 3 + 1]; patternColor[v * 4 + 2] = patCol[v * 3 + 2]; patternColor[v * 4 + 3] = patInt[v]; }
  void BONE_SEGS; void skinWeight;
  const dbg = {};
  if (globalThis.COWDBG) for (let v = 0; v < nV; v++) { const p = P(v); if (p[1] < 0.06 && p[2] > 0 && p[0] > 0) { const k = region[v] + ' ' + tagOf[v] + ' ' + (legBone[v] >= 0 ? BONES[legBone[v]].name : '-') + ' m' + tint[v * 4 + 3]; dbg[k] = (dbg[k] || 0) + 1; } }
  if (globalThis.COWDBG) console.log(dbg);
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, stats: {}, region, ventral };
}
