// The white-tailed deer's coat: summer red-brown or winter grey-brown (hollow guard hair, longer),
// darker along the back and on the forehead, white belly / inner legs / groin, white throat patch,
// white eye ring, white band behind the black nose, white chin and lower lip with dark lip-corner
// spots, ears grey-brown outside with a dark rim and white hair inside, the tail brown above with a
// white fringe and a white underside, tan lower legs with dark hooves, the tarsal gland tuft (dark in
// bucks) and the fawn's rows of white spots. Hair flow follows the cervid hair tracts. Antlers:
// bone-coloured keratin, dark at the burr, polished pale tips (velvet when growing).
// Works in the reference space (see rig.js); seeded variation picks the season, shade and spots.
import { HEAD_O, HZ, HY, hl, bz } from './rig.js';
import { neckS } from './regions.js';
import { SDFModel } from '../../core/sdf/sdf.js';
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, poissonFeatures, featureDistance, smoothField, distPolyline } from '../../core/build/coatKit.js';

// sRGB swatches sampled from the reference photos in neutral light
export const COATS = {
  summer: { body: 0x9a6f50, dorsal: 0x825a3e, side: 0xa87e5e, head: 0x8e6c50, forehead: 0x684a34, face: 0x8e7a68, legs: 0x9e7c5c, fur: 0.007 },
  winter: { body: 0x988670, dorsal: 0x7a6a56, side: 0xa8977f, head: 0x928675, forehead: 0x645240, face: 0xa39d94, legs: 0x9e8a6e, fur: 0.012 },
  fawn: { body: 0x93603e, dorsal: 0x7c5034, side: 0xa06e4c, head: 0x8c6646, forehead: 0x6e4a30, face: 0x8c7462, legs: 0x9a7656, fur: 0.008 },
};
const WHITE = 0xefeae0, SPOT = 0xeee4d0, NOSE = 0x1a1a1a, BAND = 0x1e1a18, HOOF = 0x262220, EAR_RIM = 0x3a2e26, EAR_IN = 0xede7dc;
const ANTLER = { burr: 0x5e4a36, beam: 0x7e6650, tip: 0xd8ccb4, velvet: 0x6b5445 };

function palette(p) {
  const C = COATS[p.age === 'juvenile' ? 'fawn' : p.coat] || COATS.winter;
  const k = p.coatShade || 0, l = p.coatLightness || 0;
  // shade: - greyer / + redder, lightness +-
  const tw = (hex) => { const c = srgb(hex); return [c[0] * (1 + 0.07 * k + l), c[1] * (1 + 0.01 * k + l), c[2] * (1 - 0.08 * k + l)]; };
  const out = {};
  for (const key of ['body', 'dorsal', 'side', 'head', 'forehead', 'face', 'legs']) out[key] = tw(C[key]);
  out.fur = C.fur;
  out.white = srgb(WHITE); out.spot = srgb(SPOT); out.nose = srgb(NOSE); out.band = srgb(BAND); out.hoof = srgb(HOOF);
  out.earRim = srgb(EAR_RIM); out.earIn = srgb(EAR_IN);
  return out;
}

const HOOF_TAGS = new Set(['hoof', 'heelbulb', 'dewclaw']);

export function deerCoat(ctx) {
  const { model, rig, pos, nrm, regionOf, regionNames, weights, nV, params, lists } = ctx;
  const { BONES } = rig;
  const J = rig.J;
  const R = rng(4243 + (params.coatSeed || 0));
  const COL = palette(params);
  const fawn = params.age === 'juvenile';
  const buck = params.sex === 'male' && !fawn;
  const { dominant, axialS, skinIndex, skinWeight, limbMember } = weights;
  const AX_LEN = weights.axialLengths;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8];
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const jawPrims = model.forPart('jaw');
  const headPrims = model.forPart('body').filter((p) => p.bone === 'head' && !p.carve);
  const nostrilPrims = model.prims.filter((p) => p.tag === 'nostril');
  const glandPrims = model.prims.filter((p) => p.tag === 'preorbital');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof|femur|tibia|metatarsus|hpaw|hhoof)/.test(b.name));
  const tailIdx = (name) => (name.startsWith('tail') ? +name.slice(4) : -1);
  const HL = (p) => { const d = sub(p, HEAD_O); return [d[0], dot(d, HY), dot(d, HZ)]; };
  const rn = regionNames.map((n) => n);
  const JAW_R = rn.indexOf('jaw'), ANT_R = rn.indexOf('antler'), HEAD_R = rn.indexOf('head');

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

  // --- regions: 0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw, 8 antler
  const region = new Uint8Array(nV);
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  for (let v = 0; v < nV; v++) {
    const bn = BONES[dominant[v]].name, p = P(v);
    let lb = -1, lw = 0;
    for (let k = 0; k < 4; k++) {
      const b = skinIndex[v * 4 + k], w = skinWeight[v * 4 + k];
      if (isLimb[b] && w > lw) { lw = w; lb = b; }
    }
    legBone[v] = lb;
    legness[v] = lb >= 0 ? smoothstep(0.15, 0.85, limbMember[v]) : 0;
    const ti = tailIdx(bn);
    if (regionOf[v] === ANT_R) region[v] = 8;
    else if (regionOf[v] === JAW_R) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (ti >= 0 && axialS[v] > sTailBase + 0.01 || tagOf[v] === 'tail') region[v] = 4;
    else if (axialS[v] < sOcc + 0.01 || (regionOf[v] === HEAD_R && neckS(p[0], p[1], p[2]) > 0.015)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) legness[v] = 0;
  }

  // --- tail frame: which side of the flat tail a vertex is on (dorsal = brown, ventral = white)
  const tailSide = (v) => {
    const bone = BONES[dominant[v]];
    const d = norm(sub(bone.tail, bone.head));
    const lat = [1, 0, 0];
    const back = norm(cross(lat, d)); // points away from the rump (the tail's outer / dorsal face)
    return dot(N(v), back);
  };

  // --- white areas as one signed field (< 0 inside), with softly jagged edges
  const throatC = lerp3(hl([0, -0.068, -0.045]), [0, 0.64, 0.39], 0.45); // white throat patch on the upper throat, below the jaw
  const throatN = norm([0, -0.35, 1]);
  const throatD = (p, n, rx, ry) => (dot(n, throatN) < 0.1 ? 1 : Math.hypot(p[0] / rx, (p[1] - throatC[1]) / ry, (p[2] - throatC[2]) / 0.06) * 0.03 - 0.03);
  const whiteSDF = (v) => {
    const p = P(v), r = region[v], n = N(v);
    const jag = (fbm3(p[0] * 70, p[1] * 70, p[2] * 70, 2) - 0.5) * 0.012;
    let d = 1;
    if (r === 2 || r === 6) {
      const h = HL(p), ax = Math.abs(h[0]);
      // chin and lower lip (the jaw), the white band behind the nose, around the muzzle
      if (r === 6) d = -0.006;
      const band = Math.max(Math.abs(h[2] - 0.158) - 0.011 - 0.004 * smoothstep(0.0, -0.03, h[1]), -0.03 - h[1]);
      d = Math.min(d, band);
      // lower lip line / under the chin on the head surface too
      if (h[1] < -0.036 && h[2] > 0.12) d = Math.min(d, (h[1] + 0.036) * 0.5 - 0.002);
      // eye ring
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        d = Math.min(d, Math.abs(de + 0.0005) - 0.0075);
      }
      // throat patch continues under the jaw angle (head region skin of the throat latch)
      d = Math.min(d, throatD(p, n, 0.034, 0.04));
      if (ax > 0.05 && h[2] < 0.1) d = Math.max(d, 0.02);
      return d + jag * 0.5;
    }
    if (r === 1 || r === 0) {
      // throat patch: an oval bib on the upper throat
      d = Math.min(d, throatD(p, n, 0.036, 0.045));
      // belly, groin and the insides of the legs: below the flank line on the underside
      const belly = r === 0 ? (p[1] - (0.5 + 0.05 * smoothstep(0.1, bz(-0.35), p[2]) + 0.06 * smoothstep(bz(-0.2), bz(-0.45), p[2]))) + 0.06 * (n[1] + 0.5) + 0.12 * smoothstep(0.1, 0.24, p[2]) : 1;
      if (legness[v] < 0.5) d = Math.min(d, belly);
      // buttocks: a white band along the inside of the thighs under the tail
      if (r === 0 && p[2] < bz(-0.5)) d = Math.min(d, Math.abs(p[0]) - 0.04 * smoothstep(0.72, 0.6, p[1]) + (p[1] > 0.72 ? 1 : 0));
      const L = legness[v];
      if (L > 0) {
        const side = p[0] >= 0 ? 1 : -1;
        const inner = n[0] * side; // < 0: faces the other leg
        const lbn = BONES[legBone[v]].name;
        const hind = /femur|tibia|metatarsus|hpaw|hhoof/.test(lbn);
        // inside of the upper legs white down to the knee / hock
        // (hind: the inner thigh down to the hock; fore: only the inside of the cannon, below the
        // carpus: a white edge over the elbow crease smeared as the elbow folds)
        const top = hind ? 0.5 : 0.26, bottom = hind ? 0.36 : 0.12;
        const dIn = inner + 0.35;
        d = Math.min(d, mix(1, dIn * 0.05, L) + (p[1] > top ? (p[1] - top) * 0.5 : 0) + (p[1] < bottom ? (bottom - p[1]) * 0.5 : 0));
        // white fetlock band above the hooves (front of the pasterns)
        if (/metacarpus|metatarsus|fpaw|hpaw/.test(lbn) && p[1] < 0.075 && p[1] > 0.035) d = Math.min(d, 0.012 - (0.075 - p[1]) * 0.5 * smoothstep(-0.2, 0.3, n[2]));
      }
      return d + jag;
    }
    if (r === 4) {
      // tail: white underside and a white fringe on the edges
      const ts = tailSide(v);
      return Math.min(ts + 0.25, 0.012 - Math.abs(n[0]) * 0.02) + jag * 0.5;
    }
    return 1;
  };

  // --- fawn spots: rows along the spine, scattered on the flanks
  let spots = null;
  if (fawn) {
    spots = poissonFeatures({
      pos, nrm, nV, R, cell: 0.05, spacing: 2.6, gap: 0.006,
      radius: (v) => {
        const p = P(v), n = N(v);
        if (region[v] > 0 || legness[v] > 0.3 || n[1] < 0.0 || p[2] < bz(-0.52) || p[2] > 0.3) return 0;
        // rows either side of the spine, thinning out down the flanks
        const ax = Math.abs(p[0]);
        const row = Math.min(Math.abs(ax - 0.035), Math.abs(ax - 0.075));
        if (p[1] < 0.66 || (row > 0.012 && R() < 0.55)) return 0;
        return 0.006 + 0.002 * R();
      },
    });
  }

  // --- comb (hair flow)
  const comb = new Float32Array(nV * 3);
  const whorl = [0, 0.03, 0.02]; // forehead whorl, head-local
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const bone = BONES[dominant[v]];
    let d;
    if (r === 5 || r === 8) d = norm(sub(bone.tail, bone.head));
    else if (r === 2 || r === 6) {
      const h = HL(p);
      const rel = [h[0] - whorl[0], (h[1] - whorl[1]) * 0.4 - 0.04, h[2] - whorl[2] + 0.05];
      d = norm(add(mul(HY, rel[1]), add(mul(HZ, rel[2]), [rel[0], 0, 0])));
      if (h[2] < -0.06) d = norm(add(d, [0, -0.6, -0.8]));
    } else if (r === 4) {
      d = norm(sub(bone.tail, bone.head));
      d = norm(add(d, [0, 0, 0]));
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = rig.AXIAL.points[seg], b = rig.AXIAL.points[Math.min(seg + 1, rig.AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.45 * Math.abs(n[0]), 0]));
      if (r === 1) d = norm(add(d, [0, -0.6, 0.05]));
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

  // --- antler colour along its length (distance from the burr)
  const A = params.antlers;
  const burrs = A ? [1, -1].map((s) => hl([A.burr[0] * s, A.burr[1], A.burr[2]])) : [];

  // --- per-vertex fields
  const pattern = new Float32Array(nV).fill(1);
  const patInt = new Float32Array(nV);
  const patCol = new Float32Array(nV * 3);
  const markSDF = new Float32Array(nV).fill(1);
  const furLen = new Float32Array(nV);
  const tint = new Float32Array(nV * 4);
  const surf = new Float32Array(nV * 4);
  const coatFur = COL.fur;

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v], tag = tagOf[v];
    let col, mat = MAT.FUR, fl = coatFur, mark = 1, gloss = 0.5;
    let wsdf = whiteSDF(v);
    const lb = legBone[v];
    const lbName = lb >= 0 ? BONES[lb].name : '';
    if (r === 0 || r === 1) {
      const up = clamp(n[1], -1, 1);
      // countershading: dark along the spine, lighter low on the flanks
      col = mix3(COL.body, COL.dorsal, smoothstep(0.35, 0.95, up) * 0.85);
      col = mix3(col, COL.side, smoothstep(0.0, -0.6, up) * 0.6);
      if (r === 1) col = mix3(col, COL.head, 0.25);
      fl = coatFur * (r === 1 ? 1.1 : 1);
      // chest between the forelegs: darker
      if (r === 0 && p[2] > 0.3 && p[1] < 0.66) col = mix3(col, COL.dorsal, 0.35 * smoothstep(0.3, 0.42, p[2]));
      const L = legness[v];
      if (L > 0) {
        let lc = mix3(col, COL.legs, smoothstep(0.55, 0.3, p[1]));
        // front of the cannons a little darker, backs of the legs paler
        if (p[1] < 0.35) lc = mix3(lc, COL.dorsal, 0.25 * smoothstep(0.1, 0.8, n[2]));
        col = mix3(col, lc, L);
        fl = mix(fl, mix(0.004, coatFur * 0.8, smoothstep(0.2, 0.55, p[1])), L);
        // tarsal gland: a tuft on the inside of the hock, stained dark in bucks
        const hind = /tibia|metatarsus/.test(lbName);
        if (hind) {
          const side = p[0] >= 0 ? 1 : -1;
          const Hk = J['hock' + BONES[lb].side];
          const dg = Math.hypot((p[1] - Hk[1] - 0.015) / 0.028, (p[2] - Hk[2] + 0.012) / 0.02);
          if (dg < 1.2 && n[0] * side < -0.2) { col = mix3(col, buck ? srgb(0x2e2218) : srgb(0x6a5440), smoothstep(1.2, 0.7, dg)); fl = Math.max(fl, 0.02 * smoothstep(1.2, 0.5, dg)); }
          // metatarsal gland: a small pale-rimmed tuft on the outside of the hind cannon
          const dm = Math.hypot((p[1] - (Hk[1] - 0.12)) / 0.018, (p[2] - Hk[2] - 0.004) / 0.012);
          if (dm < 1.3 && n[0] * side > 0.3) { col = mix3(col, dm < 0.7 ? srgb(0x4a3a2a) : srgb(0xd8d0c0), smoothstep(1.3, 0.9, dm)); fl = Math.max(fl, 0.012); }
        }
      }
      // hoof wall, dew claws
      const Cj = /hoof|paw/.test(lbName) ? J[(lbName[0] === 'f' ? 'fcoffin' : 'hcoffin') + BONES[lb].side] : null;
      if (Cj && HOOF_TAGS.has(tag) && (tag === 'dewclaw' || p[1] < Cj[1] + 0.006 + 0.35 * (p[2] - Cj[2]))) {
        mat = MAT.KERATIN; fl = 0; gloss = 0.5; col = COL.hoof;
        if (tag === 'heelbulb') col = mix3(col, srgb(0x3a3430), 0.5);
        wsdf = 1;
      }
    } else if (r === 4) {
      // tail: brown on top (darker along the midline), long white hair on the edges and below
      const ts = tailSide(v);
      col = mix3(COL.dorsal, COL.body, smoothstep(0.3, 0.9, Math.abs(n[0])));
      fl = 0.02 + 0.03 * smoothstep(0.2, 0.9, Math.abs(n[0])) + 0.015 * smoothstep(0.2, -0.5, ts);
      const ti = tailIdx(BONES[dominant[v]].name);
      if (ti >= 4) col = mix3(col, srgb(0x3a2c20), 0.4 * smoothstep(0.2, 0.9, ts)); // dark tip above
    } else if (r === 5) {
      // ears: coat colour outside with a dark rim, white hair inside
      const earP = model.prims.find((q) => q.tag === 'ear' && (q.bone === (p[0] > 0 ? 'earL' : 'earR')));
      const faceDir = [earP.P[9], earP.P[10], earP.P[11]];
      const front = dot(n, faceDir);
      col = mix3(COL.head, COL.face, 0.4);
      fl = 0.005;
      // rim: distance from the pinna's edge ~ where the normal turns sideways
      const bone = BONES[dominant[v]];
      const ax = norm(sub(bone.tail, bone.head));
      const along = dot(sub(p, bone.head), ax) / Math.max(1e-4, len(sub(bone.tail, bone.head)));
      const edge = 1 - Math.abs(front);
      col = mix3(col, COL.earRim, smoothstep(0.55, 0.9, edge) * 0.7 + 0.5 * smoothstep(0.8, 1.0, along));
      if (front > 0.25) { fl = 0.011 * smoothstep(0.95, 0.5, along); col = mix3(col, COL.earIn, smoothstep(0.25, 0.6, front) * 0.85 * smoothstep(1.0, 0.75, along)); }
    } else if (r === 8) {
      // antler: dark rough burr and beam base, lighter beam, polished pale tips
      mat = MAT.KERATIN; fl = 0; gloss = 0.35;
      let db = 1e9;
      for (const b of burrs) db = Math.min(db, len(sub(p, b)));
      const tipness = smoothstep(0.02, 0.01, SDFModel.evalList(model.forPart('antler').filter((q) => q.tag === 'tine' || q.tag === 'beam'), p[0], p[1], p[2]) + 0.012);
      col = mix3(srgb(ANTLER.burr), srgb(ANTLER.beam), smoothstep(0.012, 0.05, db));
      const tipT = smoothstep(0.1, 0.35, db);
      col = mix3(col, srgb(ANTLER.tip), tipT * 0.45);
      if (tag === 'tine') col = mix3(col, srgb(ANTLER.tip), 0.2);
      void tipness;
      if (A && A.velvet) { mat = MAT.FUR; fl = 0.003; col = srgb(ANTLER.velvet); gloss = 0.3; }
      // grooves / pearling: fine dark streaks along the beam
      const st = vnoise3(p[0] * 300, p[1] * 90, p[2] * 300);
      col = mul(col, 0.85 + 0.3 * st);
      wsdf = 1;
    } else {
      // head & jaw
      const h = HL(p);
      col = mix3(COL.head, COL.face, smoothstep(-0.02, 0.1, h[2]) * 0.6);
      fl = 0.0045;
      // darker forehead patch (bucks especially) and the dark bridge of the nose
      const fh = smoothstep(0.015, 0.035, h[1]) * smoothstep(0.09, 0.0, h[2]) * smoothstep(-0.1, -0.04, h[2]);
      col = mix3(col, COL.forehead, fh * (buck ? 0.9 : 0.55));
      col = mix3(col, COL.forehead, smoothstep(0.012, 0.024, h[1]) * smoothstep(0.02, 0.1, h[2]) * smoothstep(0.17, 0.12, h[2]) * 0.35 * smoothstep(0.02, 0.0, Math.abs(h[0])));
      if (h[2] < -0.07) col = mix3(col, COL.body, smoothstep(-0.07, -0.11, h[2]));
      // black nose leather (rhinarium)
      if (h[2] > 0.168 && h[1] > -0.03 && tag !== 'upperlip' || (tag === 'nose' && h[2] > 0.16)) {
        const nz = smoothstep(0.168, 0.176, h[2]);
        if (nz > 0.5) { mat = MAT.NOSE; fl = 0; col = COL.nose; gloss = 0.8; wsdf = 1; }
        else col = mix3(col, COL.band, nz * 2);
      }
      // dark spots at the corners of the lower lip / chin sides
      if (r === 6 || h[1] < -0.035) {
        const dc = Math.hypot((Math.abs(h[0]) - 0.014) / 0.01, (h[2] - 0.145) / 0.014);
        if (dc < 1 && Math.abs(h[0]) > 0.006) { col = mix3(col, COL.band, smoothstep(1, 0.6, dc)); wsdf = Math.max(wsdf, 0.004); }
      }
      // eye rims (dark skin), preorbital gland
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.0035) mark = Math.min(mark, Math.abs(de) - 0.002);
        if (Math.abs(de) < 0.0014) { mat = MAT.DARK_SKIN; fl = 0; wsdf = Math.max(wsdf, 0.003); }
        else if (Math.abs(de) < 0.0035) fl = Math.min(fl, 0.0015);
        // upper lashes
      }
      for (const g of glandPrims) {
        const dg = SDFModel.dist(g, p[0], p[1], p[2]);
        if (dg < 0.003) { col = srgb(0x2e2622); fl = 0.001; mark = Math.min(mark, dg - 0.002); wsdf = Math.max(wsdf, 0.003); }
      }
      // nostrils: dark rims
      for (const e of nostrilPrims) {
        const dn = SDFModel.dist(e, p[0], p[1], p[2]);
        if (dn < 0.0025) { mat = MAT.NOSE; col = COL.nose; fl = 0; mark = Math.min(mark, dn - 0.0015); wsdf = 1; }
      }
      // lips
      if (r !== 6) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (dj < 0.0012 && h[2] > 0.1) { mat = MAT.MOUTH; fl = 0; wsdf = 1; }
        else if (dj < 0.0035 && h[2] > 0.1) { mark = Math.min(mark, dj - 0.0028); fl = Math.min(fl, 0.0015); }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (dh < 0.0) { mat = MAT.MOUTH; fl = 0; wsdf = 1; }
        else if (dh < 0.003) { mark = Math.min(mark, dh - 0.0025); fl = Math.min(fl, 0.0015); }
      }
      // whiskers area on the muzzle: very short hair
      if (h[2] > 0.13) fl = Math.min(fl, 0.003);
    }
    // white areas and fawn spots through the crisp pattern field (continuous: capped just above 0)
    const CAP = 0.02;
    let pc = COL.white, pi = 1, pd = CAP;
    if (mat === MAT.FUR && r !== 8) pd = Math.min(CAP, wsdf);
    if (spots && (r === 0 || r === 1) && mat === MAT.FUR) {
      const [sd] = featureDistance(spots, p, n, 1 + 0.2 * (vnoise3(p[0] * 60, p[1] * 60, p[2] * 60) - 0.5));
      if (sd < pd) { pd = Math.min(CAP, sd); pc = COL.spot; pi = 0.92; }
    }
    // white hair is longer on the belly, the tail and the throat patch
    if (pd < 0 && mat === MAT.FUR && r !== 2 && r !== 6) fl = Math.max(fl, r === 4 ? fl : coatFur * 1.3);
    // low-frequency colour variation
    const cv = fbm3(p[0] * 7, p[1] * 7, p[2] * 7, 3) - 0.5;
    if (mat === MAT.FUR && r !== 8) col = [col[0] * (1 + 0.14 * cv), col[1] * (1 + 0.12 * cv), col[2] * (1 + 0.1 * cv)];
    pattern[v] = pd; patInt[v] = pi;
    patCol[v * 3] = pc[0]; patCol[v * 3 + 1] = pc[1]; patCol[v * 3 + 2] = pc[2];
    markSDF[v] = mark;
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    surf[v * 4] = gloss;
  }
  smoothField(furLen, weights.neighbors, 2, (v) => tint[v * 4 + 3] !== MAT.FUR);

  const patternColor = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) { patternColor[v * 4] = patCol[v * 3]; patternColor[v * 4 + 1] = patCol[v * 3 + 1]; patternColor[v * 4 + 2] = patCol[v * 3 + 2]; patternColor[v * 4 + 3] = patInt[v]; }
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, stats: { spots: spots ? spots.spots.length : 0 }, region, ventral: new Float32Array(nV) };
}
