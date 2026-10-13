// The horse's coat: base colours (bay, dark bay, chestnut, black, grey, palomino, dun, buckskin),
// black points, dorsal stripe and leg bars (dun), dapples (grey), white face and leg markings with
// pink skin and pale hooves under them, long mane / forelock / tail hair, hair flow following the
// equine hair tracts (forehead whorl, down the face, backward and down the barrel, down the legs),
// bare muzzle skin with whiskers, keratin hooves.
// Works in the reference space (see rig.js); seeded variation picks the colour and the markings.
import { HEAD_O, HZ, HY, DOCK_SEGS } from './rig.js';
import { neckS } from './regions.js';
import { unifyNeckWeights, spreadThroatWeights } from './seamWeights.js';
import { blendHeadNeckCoat } from './coatSeam.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, poissonFeatures, featureDistance, smoothField } from '../../core/build/coatKit.js';

// sRGB swatches sampled from the reference photos
export const COATS = {
  bay: { body: 0x6b3a1f, dorsal: 0x57301a, belly: 0x7a4527, head: 0x62351d, points: 0x17120f, mane: 0x121010, blackPoints: 1 },
  darkbay: { body: 0x3e2418, dorsal: 0x2e1b13, belly: 0x5a3421, head: 0x3a2217, points: 0x141010, mane: 0x100d0c, blackPoints: 1 },
  // (chestnut: #8A4A22 desaturated ~25 % and lifted a little: rendered flanks read as brick red otherwise)
  chestnut: { body: 0x845231, dorsal: 0x77492b, belly: 0x93613a, head: 0x7d4d2e, points: 0x74452a, mane: 0x70432a, blackPoints: 0 },
  black: { body: 0x1f1b1a, dorsal: 0x1a1716, belly: 0x2a221e, head: 0x1f1b1a, points: 0x131010, mane: 0x100e0d, blackPoints: 0 },
  grey: { body: 0x9a9893, dorsal: 0x8e8c87, belly: 0xb4b2ac, head: 0xa8a6a0, points: 0x5a5856, mane: 0xcfcdc7, blackPoints: 0, dapple: 0xc9c7c1 },
  palomino: { body: 0xd4a95a, dorsal: 0xc99d50, belly: 0xdcb46a, head: 0xcfa355, points: 0xc09450, mane: 0xefe3c2, blackPoints: 0 },
  dun: { body: 0xb89a6a, dorsal: 0xa98c5e, belly: 0xc6aa7c, head: 0x7a6040, points: 0x1c1712, mane: 0x16120f, blackPoints: 1, dunFactor: 1 },
  buckskin: { body: 0xb98a4f, dorsal: 0xac7e46, belly: 0xc49a60, head: 0xa87c45, points: 0x1a1410, mane: 0x141110, blackPoints: 1 },
};
const WHITE = 0xf0ece4, PINK = 0xc9a09a, MUZZLE = 0x2c2a2a, HOOF = 0x3a3029, HOOF_PALE = 0xb8a88a;

function palette(p) {
  const C = COATS[p.coat] || COATS.bay;
  const k = p.coatShade || 0, l = p.coatLightness || 0;
  const tw = (hex) => { const c = srgb(hex); return [c[0] * (1 + 0.08 * k + l), c[1] * (1 + l), c[2] * (1 - 0.08 * k + l)]; };
  const out = { body: tw(C.body), dorsal: tw(C.dorsal), belly: tw(C.belly), head: tw(C.head), points: srgb(C.points), mane: srgb(C.mane), blackPoints: C.blackPoints, dunFactor: C.dunFactor || 0 };
  if (p.coat === 'chestnut' && p.flaxen) out.mane = srgb(0xcfb37e);
  if (p.coat === 'grey') {
    // greys whiten with age: 0 = dark dapple grey, 1 = almost white
    const g = p.greyLevel ?? 0.4;
    const lift = (c, t) => mix3(c, srgb(0xe4e2dc), t);
    out.body = lift(out.body, g * 0.8); out.dorsal = lift(out.dorsal, g * 0.75); out.belly = lift(out.belly, g * 0.8); out.head = lift(out.head, g * 0.85);
    out.points = lift(out.points, g * 0.6); out.mane = lift(out.mane, g * 0.5);
    out.dapple = lift(srgb(C.dapple), g * 0.6);
  }
  out.white = srgb(WHITE); out.pink = srgb(PINK); out.muzzle = srgb(MUZZLE); out.hoof = srgb(HOOF); out.hoofPale = srgb(HOOF_PALE);
  return out;
}

const HAIR_TAGS = new Set(['mane', 'manecrest', 'forelock']);
const HOOF_TAGS = new Set(['hoof', 'heelbulb']);

export function horseCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, weights, nV, params, lists } = ctx;
  const { BONES } = rig;
  const J = rig.J;
  const R = rng(4242 + (params.coatSeed || 0));
  const COL = palette(params);
  const foal = params.age === 'juvenile';
  const { dominant, axialS, skinIndex, skinWeight, limbMember } = weights;
  const AX_LEN = weights.axialLengths;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8];
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const jawPrims = model.forPart('jaw');
  const headPrims = model.forPart('body').filter((p) => p.bone === 'head' && !p.carve);
  const nostrilPrims = model.prims.filter((p) => p.tag === 'nostril');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof|femur|tibia|metatarsus|hpaw|hhoof)/.test(b.name));
  const legOf = BONES.map((b) => (/^(scapula|humerus|radius|metacarpus|fpaw|fhoof)/.test(b.name) ? 'F' : /^(femur|tibia|metatarsus|hpaw|hhoof)/.test(b.name) ? 'H' : '') + (b.side || ''));
  const tailIdx = (name) => (name.startsWith('tail') ? +name.slice(4) : -1);
  // head-local coordinates (x lateral, y dorsal, z along the nasal line)
  const HL = (p) => { const d = sub(p, HEAD_O); return [d[0], dot(d, HY), dot(d, HZ)]; };

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

  // --- regions: 0 torso, 1 neck, 2 head, 3 mane / forelock, 4 dock, 5 ear, 6 jaw, 7 tail hair
  const region = new Uint8Array(nV);
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  for (let v = 0; v < nV; v++) {
    const bn = BONES[dominant[v]].name, p = P(v), tag = tagOf[v];
    let lb = -1, lw = 0;
    for (let k = 0; k < 4; k++) {
      const b = skinIndex[v * 4 + k], w = skinWeight[v * 4 + k];
      if (isLimb[b] && w > lw) { lw = w; lb = b; }
    }
    legBone[v] = lb;
    legness[v] = lb >= 0 ? smoothstep(0.15, 0.85, limbMember[v]) : 0;
    const ti = tailIdx(bn);
    if (partOf[v] === 2) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (HAIR_TAGS.has(tag)) region[v] = 3;
    else if (tag === 'tailhair') region[v] = 7;
    else if (ti >= 0 && axialS[v] > sTailBase + 0.02) region[v] = ti >= DOCK_SEGS ? 7 : 4;
    else if (axialS[v] < sOcc + 0.02 || (partOf[v] === 1 && neckS(p[0], p[1], p[2]) > 0.03)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) legness[v] = 0;
  }

  // --- white markings (face + legs), jagged edges
  const face = params.face || 'none';
  const socks = params.socks || [0, 0, 0, 0]; // FL FR HL HR marking height above ground (m), 0 = none
  const LEGI = { FL: 0, FR: 1, HL: 2, HR: 3 };
  const whiteSDF = (v) => {
    const p = P(v), r = region[v];
    const jag = (fbm3(p[0] * 60, p[1] * 60, p[2] * 60, 2) - 0.5) * 0.02;
    let d = 1;
    if (r === 2 || r === 6) {
      const h = HL(p), ax = Math.abs(h[0]);
      const front = (dot(N(v), HY) > -0.2 && h[1] > -0.07 + 0.12 * smoothstep(0.1, -0.1, h[2])) || h[2] > 0.3;
      if (!front) return 1;
      // (star: on the forehead at the eyes' level, just below the forelock's tip, which ends at z ~0)
      if (face === 'star' || face === 'starsnip' || face === 'stripe') d = Math.min(d, Math.hypot(ax / 0.028, (h[2] - 0.028) / 0.034) * 0.028 - 0.028);
      if (face === 'stripe') d = Math.min(d, Math.max(ax - 0.014 - 0.006 * smoothstep(0, 0.3, h[2]), -0.02 - h[2], h[2] - 0.3));
      if (face === 'blaze') d = Math.min(d, Math.max(ax - (0.03 + 0.03 * smoothstep(0.15, 0.4, h[2])), -0.07 - h[2]));
      if (face === 'snip' || face === 'starsnip') d = Math.min(d, Math.hypot(ax / 0.022, (h[2] - 0.36) / 0.035) * 0.022 - 0.022);
      return d + jag;
    }
    const lb = legBone[v];
    if (lb >= 0 && legness[v] > 0.3) {
      const hgt = socks[LEGI[legOf[lb]]] || 0;
      if (hgt > 0) d = p[1] - hgt + jag * 1.5;
    }
    return d;
  };

  // --- ventral factor (lighter belly, inner legs, flank)
  const ventral = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const n = N(v), r = region[v], p = P(v);
    let w = 0;
    if (r === 0) w = smoothstep(-0.2, -0.8, n[1]) * smoothstep(1.25, 1.0, p[1]);
    else if (r === 1) w = smoothstep(0.0, -0.7, n[1]) * 0.5;
    const L = legness[v];
    if (L > 0) { const side = p[0] >= 0 ? 1 : -1; w = mix(w, smoothstep(0.1, -0.7, n[0] * side) * 0.6 * smoothstep(0.5, 0.9, p[1]), L); }
    ventral[v] = w;
  }

  // --- comb (hair flow)
  const comb = new Float32Array(nV * 3);
  const whorl = [0, 0.055, -0.02]; // forehead whorl, head-local
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const bone = BONES[dominant[v]];
    let d;
    if (r === 5) d = norm(sub(bone.tail, bone.head));
    else if (r === 2 || r === 6) {
      const h = HL(p);
      // from the whorl: down the face toward the muzzle, back and down on the cheeks and jowl
      const rel = [h[0] - whorl[0], h[1] - whorl[1], h[2] - whorl[2]];
      const lh = [rel[0], rel[1] * 0.4, rel[2] + 0.08];
      const w = [lh[0], lh[1] - 0.05, lh[2]];
      d = norm(add(mul(HY, w[1]), add(mul(HZ, w[2]), [w[0], 0, 0])));
      if (h[2] < -0.1) d = norm(add(d, [0, -0.6, -0.8]));
    } else if (r === 3) {
      // mane falls down the side of the neck; the forelock down the face; foal mane stands up
      if (tagOf[v] === 'forelock') d = HZ;
      else if (foal) d = [0, 1, 0.2];
      else {
        // straight down the mane side; on the far side of the crest up and over to the mane side
        const ms = params.maneSide ?? -1;
        d = p[0] * ms >= 0 ? norm([ms * 0.35, -1, -0.2]) : norm([ms * 0.6, 0.8, -0.2]);
      }
    } else if (r === 7 || r === 4) {
      d = norm(sub(bone.tail, bone.head));
      if (r === 4) d = norm(add(d, [0, 0, -0.2]));
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = rig.AXIAL.points[seg], b = rig.AXIAL.points[Math.min(seg + 1, rig.AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.45 * Math.abs(n[0]), 0]));
      if (r === 1) d = norm(add(d, [0, -0.5, 0.1]));
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

  // --- dapples (grey): light rounded spots with a darker network between them
  let dapples = null;
  if (params.coat === 'grey') {
    dapples = poissonFeatures({
      pos, nrm, nV, R, cell: 0.08, spacing: 1.25, gap: 0.004,
      radius: (v) => (region[v] <= 1 && legness[v] < 0.6 && ventral[v] < 0.7 ? 0.028 : 0),
    });
  }

  // --- per-vertex fields
  const pattern = new Float32Array(nV).fill(1);
  const patInt = new Float32Array(nV);
  const patCol = new Float32Array(nV * 3);
  const markSDF = new Float32Array(nV).fill(1);
  const furLen = new Float32Array(nV);
  const tint = new Float32Array(nV * 4);
  const surf = new Float32Array(nV * 4);
  const lipLocal = (h) => h[1] + 0.078 - 0.02 * smoothstep(0.26, 0.4, h[2]);

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v], tag = tagOf[v];
    let col, mat = MAT.FUR, fl = 0.008, mark = 1, gloss = 0.6;
    const wsdf = whiteSDF(v);
    const lb = legBone[v];
    const lbName = lb >= 0 ? BONES[lb].name : '';
    if (r === 0 || r === 1) {
      const up = clamp(n[1], -1, 1);
      col = mix3(COL.body, COL.dorsal, smoothstep(0.3, 0.95, up) * 0.8);
      col = mix3(col, COL.belly, ventral[v]);
      fl = mix(0.008, 0.011, ventral[v]);
      if (r === 1) fl = 0.008;
      // dun: dorsal stripe from the mane to the tail
      if (COL.dunFactor && r === 0) mark = Math.min(mark, Math.abs(p[0]) - 0.022 - 0.01 * smoothstep(0.3, -0.6, p[2]) + (1 - smoothstep(0.85, 0.97, up)) * 0.1);
      const L = legness[v];
      if (L > 0) {
        // legs: coat colour above, black points below the knees / hocks (bay, dun, buckskin)
        let lc = col;
        const knee = /^(scapula|humerus|radius|metacarpus|fpaw|fhoof)/.test(lbName) ? 0.52 : 0.6;
        const pts = COL.blackPoints ? smoothstep(knee + 0.18, knee - 0.02, p[1] + (fbm3(p[0] * 20, p[1] * 8, p[2] * 20, 2) - 0.5) * 0.12) : 0;
        lc = mix3(lc, COL.points, pts);
        if (!COL.blackPoints && params.coat === 'grey') lc = mix3(lc, COL.points, smoothstep(0.6, 0.2, p[1]) * 0.8);
        // dun: faint zebra bars on the forearms and gaskins
        if (COL.dunFactor && p[1] > 0.5 && p[1] < 0.95) { const bar = Math.sin(p[1] * 70); lc = mix3(lc, COL.points, 0.22 * smoothstep(0.82, 0.95, bar) * smoothstep(0.95, 0.75, p[1])); }
        col = mix3(col, lc, L);
        fl = mix(fl, mix(0.004, 0.008, smoothstep(0.3, 0.9, p[1])), L);
        // fetlock feathers
        if (/metacarpus|metatarsus|fpaw|hpaw/.test(lbName) && p[1] < 0.24 && p[1] > 0.1) fl = Math.max(fl, 0.018 * smoothstep(0.0, -0.8, n[2]));
        // chestnuts (horny callosities) inside the forearm above the knee and below the hock
        const side = p[0] >= 0 ? 1 : -1;
        const chestnutY = /radius/.test(lbName) ? 0.62 : /metatarsus/.test(lbName) ? 0.46 : -1;
        if (chestnutY > 0 && n[0] * side < -0.6) { const J0 = lbName.startsWith("radius") ? J["wrist" + BONES[lb].side] : J["hock" + BONES[lb].side]; if (Math.hypot((p[1] - chestnutY) / 0.024, (p[2] - J0[2]) / 0.014) < 1) { mat = MAT.KERATIN; col = srgb(0x3a302a); fl = 0; } }
      }
      // hoof wall below the coronet line (higher at the toe than at the heel)
      const Cj = /hoof|paw/.test(lbName) ? J[(lbName[0] === 'f' ? 'fcoffin' : 'hcoffin') + BONES[lb].side] : null;
      if (Cj && HOOF_TAGS.has(tag) && p[1] < Cj[1] + 0.012 + 0.45 * (p[2] - Cj[2])) {
        mat = MAT.KERATIN; fl = 0; gloss = 0.55;
        col = wsdf < 0 ? COL.hoofPale : COL.hoof;
        if (tag === 'heelbulb') col = mix3(col, COL.muzzle, 0.5);
      }
    } else if (r === 3) {
      col = COL.mane;
      // (the forelock lies flat: its lock is geometry, the shells only add short hair along it)
      // (mane: the sheet is geometry; its hair stays under the 25 mm long-hair bevel, so every edge of
      // it - the poll, the forelock - tapers at the fur slope limit instead of standing as a wall)
      fl = tag === 'manecrest' ? (foal ? 0.03 : 0.022) : tag === 'forelock' ? 0.012 : 0.018;
      if (foal) fl = 0.03;
    } else if (r === 4) {
      col = mix3(COL.body, COL.mane, 0.6 + 0.4 * smoothstep(-0.2, 0.6, n[1]));
      fl = 0.035;
    } else if (r === 7) {
      col = COL.mane;
      fl = foal ? 0.04 : 0.055;
    } else if (r === 5) {
      // ears: coat colour, dark rims / tips on bays, hairy inside
      const earP = model.prims.find((q) => q.tag === 'ear' && (q.bone === (p[0] > 0 ? 'earL' : 'earR')));
      const faceDir = [earP.P[9], earP.P[10], earP.P[11]];
      const front = dot(n, faceDir);
      col = COL.head;
      if (COL.blackPoints) col = mix3(col, COL.points, 0.5);
      fl = 0.005;
      if (front > 0.3) { fl = 0.016; col = mix3(col, srgb(0xb0a090), 0.25); }
    } else {
      // head & jaw
      col = COL.head;
      fl = 0.005;
      const h = HL(p);
      // dark soft muzzle skin with whiskers (pink under a white snip / blaze)
      // muzzle: fine short hair over dark skin (pink under a white snip)
      const muz = smoothstep(0.25, 0.36, h[2]);
      if (muz > 0) { col = mix3(col, wsdf < 0 ? COL.pink : COL.muzzle, muz * 0.75); fl = mix(fl, 0.0025, muz); }
      // bays and duns have a black-edged muzzle; duns a dark face
      if (COL.blackPoints && h[2] > 0.25) col = mix3(col, COL.points, smoothstep(0.25, 0.32, h[2]) * 0.6);
      if (h[2] < -0.13) col = mix3(col, COL.body, smoothstep(-0.13, -0.2, h[2]));
      // eye rims (dark skin)
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.006) mark = Math.min(mark, Math.abs(de) - 0.0035);
        if (Math.abs(de) < 0.0024) { mat = MAT.DARK_SKIN; fl = 0; }
        else if (Math.abs(de) < 0.006) fl = Math.min(fl, 0.002);
      }
      // nostrils: dark rims
      // (dark, moist lining; SKIN's subsurface scattering read as a pink rim)
      for (const e of nostrilPrims) {
        const dn = SDFModel.dist(e, p[0], p[1], p[2]);
        if (dn < 0.004) { mat = MAT.DARK_SKIN; col = COL.muzzle; fl = 0; mark = Math.min(mark, dn - 0.003); }
      }
      // lips: head vertices near the jaw surface, jaw vertices near the head surface
      // (the closed mouth shows a dark crease where the lips meet; the pink mucosa only on the surfaces
      // the other lip hides, which show when the mouth opens)
      if (partOf[v] !== 2) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (dj < -0.002 && h[2] > 0.2) { mat = MAT.MOUTH; fl = 0; }
        else if (dj < 0.008 && h[2] > 0.2) { mark = Math.min(mark, dj - 0.0045); fl = Math.min(fl, 0.0015); }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (dh < -0.002) { mat = MAT.MOUTH; fl = 0; }
        else if (dh < 0.008) { mark = Math.min(mark, dh - 0.0045); fl = Math.min(fl, 0.0015); }
      }
      void lipLocal;
    }
    // white markings (not on keratin / mouth / eye skin)
    // (the pattern field stays continuous: capped just above zero where there is nothing, so a
    // triangle never interpolates across a jump and grows a stray edge line)
    const CAP = 0.02;
    let pc = COL.white, pi = 1, pd = CAP;
    if ((mat === MAT.FUR || mat === MAT.SKIN) && params.coat !== 'grey') pd = Math.min(CAP, wsdf);
    if (dapples && (r === 0 || r === 1)) {
      const [sd] = featureDistance(dapples, p, n, 1 + 0.25 * (vnoise3(p[0] * 40, p[1] * 40, p[2] * 40) - 0.5));
      pd = Math.min(CAP, sd); pi = 0.75 * (1 - legness[v]) * (1 - ventral[v]); pc = COL.dapple;
    }
    // low-frequency colour variation (and sheen dapples on solid coats)
    const cv = fbm3(p[0] * 5, p[1] * 5, p[2] * 5, 3) - 0.5;
    if (mat === MAT.FUR) col = [col[0] * (1 + 0.14 * cv), col[1] * (1 + 0.12 * cv), col[2] * (1 + 0.1 * cv)];
    // long hair: lock-to-lock shade streaks along the hair
    if (r === 3 || r === 7) {
      const c = [comb[v * 3], comb[v * 3 + 1], comb[v * 3 + 2]];
      const along = dot(p, c), q = sub(p, mul(c, along));
      const st = vnoise3(q[0] * 90, q[1] * 90, q[2] * 90 + along * 3), lk = vnoise3(q[0] * 24 + 7.1, q[1] * 24, q[2] * 24 + along * 1.5);
      col = mul(col, (0.75 + 0.5 * st) * (0.82 + 0.36 * lk));
    }
    pattern[v] = pd; patInt[v] = pi;
    patCol[v * 3] = pc[0]; patCol[v * 3 + 1] = pc[1]; patCol[v * 3 + 2] = pc[2];
    markSDF[v] = mark;
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    surf[v * 4] = gloss;
  }
  // foals: fluffy body coat
  if (foal) for (let v = 0; v < nV; v++) if (tint[v * 4 + 3] === MAT.FUR && region[v] <= 1) furLen[v] = Math.max(furLen[v], 0.016);
  // smooth fur length a little so shells do not step (hair, skin and keratin keep their own)
  smoothField(furLen, weights.neighbors, 2, (v) => tint[v * 4 + 3] !== MAT.FUR);
  // one coat across the head / neck boundary: no parting in the hair flow along the jowl margin and
  // behind the poll (coatSeam.js)
  const coatSeam = blendHeadNeckCoat(ctx, { comb, furLen, tint, region });

  const patternColor = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) { patternColor[v * 4] = patCol[v * 3]; patternColor[v * 4 + 1] = patCol[v * 3 + 1]; patternColor[v * 4 + 2] = patCol[v * 3 + 2]; patternColor[v * 4 + 3] = patInt[v]; }
  // the head -> neck hand-over is spread across the throat latch (no fold when the poll flexes), and
  // the head and body copies of the throat / upper neck take one set of skin weights across the
  // cross-fade band (seamWeights.js; after the coat, which reads each copy's own weights)
  const throat = spreadThroatWeights(ctx);
  const seam = unifyNeckWeights(ctx);
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, stats: { dapples: dapples ? dapples.spots.length : 0, neckWeightsShared: seam.changed, coatSeamBlended: coatSeam.changed, throatWeightsSpread: throat.changed }, region, ventral };
}
