// The sheep's coat: the fleece (crimped wool staples clumped into locks: bright weathered tips on the
// lock crests, dark crevices between the locks, dusty backline, stained britch and belly, matte),
// the clean short-haired face, ears and legs (white, or black in the Suffolk and the black morph),
// pink skin under white hair (nose, lips, inner ears), keratin horns with transverse growth ridges and
// cloven hooves, hair flow following the hair tracts.
// Works in the reference space (see rig.js); seeded variation picks the breed colours.
import { HEAD_O, HZ, HY } from './rig.js';
import { neckS, EYE_PATCH } from './regions.js';
import { hornPath, WOOL_TAGS, stapleFall, lockRadius } from './sculpt.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, smoothField } from '../../core/build/coatKit.js';

// sRGB swatches sampled from the reference photos.
// tip = weathered lock crests, clean = the fleece's inside / fresh wool, crevice = the gaps between
// locks, dust = backline dirt, stain = belly / britch, hair = face and legs, ear = inner ear skin,
// nose = nose leather, hoof.
export const COATS = {
  white: { tip: 0xdccdae, clean: 0xeee7d5, crevice: 0xa39886, dust: 0xcbc1ad, stain: 0xd3c6a6, hair: 0xf0efec, hairShade: 0xdedbd5, muzzle: 0xdccfca, skin: 0xcfb6b0, nose: 0xa88c8a, hoof: 0x9c8a74, earIn: 0xdcaca2, lid: 0xd8c4bf },
  suffolk: { tip: 0xe9e0cb, clean: 0xf5f0e4, crevice: 0xa29479, dust: 0xcdbfa5, stain: 0xd5c39e, hair: 0x4e4a4b, hairShade: 0x3c3839, muzzle: 0x534d4c, skin: 0x2a2626, nose: 0x1a1818, hoof: 0x2a2725, earIn: 0x2e2a2a, lid: 0x4a4542, black: 1 },
  merino: { tip: 0xd8cbad, clean: 0xf0e9d7, crevice: 0x9c8f7a, dust: 0xc4b89f, stain: 0xcdbd98, hair: 0xebe8e2, hairShade: 0xd6d1c8, muzzle: 0xe6d2cc, skin: 0xe8b4a8, nose: 0xc99a92, hoof: 0xc0ad92, earIn: 0xe8b0a4, lid: 0xe0c8c0 },
  black: { tip: 0x5e4c3e, clean: 0x2f2723, crevice: 0x211a16, dust: 0x5e4c3e, stain: 0x4a3c31, hair: 0x463c3a, hairShade: 0x332b29, muzzle: 0x4e4440, skin: 0x2a2424, nose: 0x1c1817, hoof: 0x2a2624, earIn: 0x3a302c, lid: 0x3e3532, black: 1 },
  brown: { tip: 0x7e654c, clean: 0x4a3a2e, crevice: 0x30251d, dust: 0x7a624a, stain: 0x5c4838, hair: 0x4a3a30, hairShade: 0x3a2e26, muzzle: 0x55463c, skin: 0x3a3030, nose: 0x2a2222, hoof: 0x302a26, earIn: 0x4a3a34, lid: 0x5a4a40, black: 1 },
  texel: { tip: 0xc9ab80, clean: 0xe7dbc4, crevice: 0x8f7352, dust: 0xa88a64, stain: 0xa98a60, hair: 0xe8e6e2, hairShade: 0xd2cec6, muzzle: 0xdcd0cc, skin: 0xe0a698, nose: 0x2a2424, hoof: 0x9c8a74, earIn: 0xe0a698, lid: 0xd8c4bf },
};

function palette(p) {
  let C = COATS[p.coat] || COATS.white;
  // most white-faced sheep have a dark, pigmented nose (threequarter1, face2, side2, extra/Lundy); some a
  // pale pink-grey one (front1): three in four dark, by the individual's coat seed (no extra draw from the
  // variation stream, which would reshuffle every seed)
  if (C === COATS.white && (Math.imul(p.coatSeed || 0, 0x9e3779b1) >>> 28) % 4 !== 0) C = { ...C, nose: 0x5a5251, muzzle: 0xd2cac6 };
  const k = p.coatShade || 0, l = p.coatLightness || 0;
  const tw = (hex) => { const c = srgb(hex); return [c[0] * (1 + 0.05 * k + l), c[1] * (1 + l), c[2] * (1 - 0.06 * k + l)]; };
  const out = {};
  for (const [key, v] of Object.entries(C)) out[key] = typeof v === 'number' && key !== 'black' ? tw(v) : v;
  out.horn = srgb(p.hornColor || 0x9c8462); out.hornDark = srgb(0x6e5a42);
  return out;
}

const HOOF_TAGS = new Set(['hoof', 'heelbulb', 'dewclaw']);

export function sheepCoat(ctx) {
  const { model, rig, pos, nrm, regionOf, regionNames, weights, nV, params, lists } = ctx;
  const { BONES } = rig;
  const J = rig.J;
  const R = rng(7331 + (params.coatSeed || 0));
  const COL = palette(params);
  const lamb = params.age === 'juvenile';
  const merino = params.variant === 'merino';
  const staple = params.staple ?? 0.014; // shell length on the fleece (crimped staple tips)
  const woolD = params.wool ?? 0.07; // sculpted wool depth
  const { dominant, axialS, skinIndex, skinWeight, limbMember } = weights;
  const AX_LEN = weights.axialLengths;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8];
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const jawPrims = model.forPart('jaw');
  const headPrims = model.forPart('body').filter((p) => p.bone === 'head' && !p.carve);
  const preorb = model.prims.filter((q) => q.tag === 'preorbital');
  const nostrilPrims = model.prims.filter((p) => p.tag === 'nostril' || p.tag === 'philtrum');
  const fleeceBase = model.prims.filter((p) => WOOL_TAGS.has(p.tag) && p.tag !== 'lock' && p.tag !== 'lockleg' && !p.carve);
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof|femur|tibia|metatarsus|hpaw|hhoof)/.test(b.name));
  const isFront = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof)/.test(b.name));
  const HL = (p) => { const d = sub(p, HEAD_O); return [d[0], dot(d, HY), dot(d, HZ)]; };
  const partName = (v) => regionNames[regionOf[v]];
  const horns = [hornPath(params, 1), hornPath(params, -1)];
  const rl = lockRadius(woolD, merino); // lock radius (sculpt.js)

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

  // --- regions: 0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw, 7 horn
  const region = new Uint8Array(nV);
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  for (let v = 0; v < nV; v++) {
    const bn = BONES[dominant[v]].name, p = P(v), pn = partName(v);
    let lb = -1, lw = 0;
    for (let k = 0; k < 4; k++) {
      const b = skinIndex[v * 4 + k], w = skinWeight[v * 4 + k];
      if (isLimb[b] && w > lw) { lw = w; lb = b; }
    }
    legBone[v] = lb;
    legness[v] = lb >= 0 ? smoothstep(0.15, 0.85, limbMember[v]) : 0;
    if (pn === 'horn') region[v] = 7;
    else if (pn === 'jaw') region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (bn.startsWith('tail') && axialS[v] > sTailBase + 0.01) region[v] = 4;
    else if (axialS[v] < sOcc + 0.01 || (pn === 'head' && neckS(p[0], p[1], p[2]) > 0.02)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) legness[v] = 0;
  }

  // --- wool: which vertices grow fleece, and where they sit on a lock (crest 1 .. crevice 0)
  const wool = new Float32Array(nV);
  const crest = new Float32Array(nV);
  const fleeceOn = fleeceBase.length > 0;
  // away from any lock (a smooth stretch of fleece) the surface is a crest, not a crevice
  const lockPrims = model.prims.filter((q) => q.tag === 'lock' || q.tag === 'lockleg');
  const lockNear = (p) => {
    let dm = 1e9;
    for (const q of lockPrims) { const dx = p[0] - q.P[0], dy = p[1] - q.P[1], dz = p[2] - q.P[2]; const d = dx * dx + dy * dy + dz * dz; if (d < dm) dm = d; }
    return smoothstep(1.4 * rl, 2.4 * rl, Math.sqrt(dm)) * 4;
  };
  for (let v = 0; v < nV; v++) {
    const t = tagOf[v];
    const r = region[v];
    if (r === 7 || r === 5 || r === 6) continue;
    if (fleeceOn) {
      const p = P(v);
      const d = SDFModel.evalList(fleeceBase, p[0], p[1], p[2]);
      // (skin that pokes through a thin fleece between wool primitives is wool too)
      if (!WOOL_TAGS.has(t) && !(r <= 1 && d < 0.012 && legness[v] < 0.5)) continue;
      wool[v] = 1;
      crest[v] = smoothstep(-0.08 * rl, 0.3 * rl, d + 0.09 * rl * lockNear(p));
    } else if (r <= 1 || r === 4) {
      // shorn / lamb: the whole body skin is the (short) fleece, except the lower legs
      const p = P(v), L = legness[v];
      const lb = legBone[v];
      const kneeY = lb >= 0 && isFront[lb] ? 0.3 : 0.26;
      wool[v] = 1 - L * smoothstep(kneeY + 0.03, kneeY - 0.03, p[1]);
      crest[v] = 0.5 + 0.5 * (fbm3(p[0] * 40, p[1] * 40, p[2] * 40, 2) - 0.5) * 2;
    }
  }
  // the face's edge: the wool starts on a line across the head's axis just behind the ears and
  // the angle of the jaw (side2, side3_texel, threequarter1); the poll and the throat behind it are wool, the face
  // in front of it short white hair. (The throat and the back of the poll carried the face's hair back into the
  // collar: the white face ran on into the neck with no edge.)
  // (not on a black face: the Suffolk's black runs back over a clean poll and down the throat, its own edge)
  for (let v = 0; v < (COL.black ? 0 : nV); v++) {
    const r = region[v];
    if (r !== 1 && r !== 2) continue;
    const p = P(v), h = HL(p);
    const rag = 0.006 * (vnoise3(p[0] * 120, p[1] * 120, p[2] * 120) - 0.5);
    // (and below the lower edge of the mandible: the throat runs down and forward in the head's frame)
    const yJaw = -0.14 + 0.387 * (h[2] + 0.03);
    const wl = Math.max(smoothstep(-0.061, -0.071, h[2] + rag), smoothstep(-0.006, -0.016, h[1] - yJaw + rag));
    if (wl <= wool[v]) continue;
    if (wool[v] <= 0) crest[v] = 0.5 + 0.5 * (fbm3(p[0] * 40, p[1] * 40, p[2] * 40, 2) - 0.5) * 2;
    wool[v] = wl;
  }
  // the wool line is a little ragged
  smoothField(wool, weights.neighbors, 1);
  // (and on the head, where the poll's topknot meets the face, a soft edge rather than a line)
  // (only round the topknot: smoothed at the collar it lit white tufts at the ear roots of a Suffolk)
  smoothField(wool, weights.neighbors, 8, (v) => region[v] !== 2 || !lists[v].some((q) => q.tag === 'woolpoll'));

  // --- comb (hair flow). Fleece: the staples fall down the sides and back along the top, each lock
  // crimped its own way (a disordered flow at the lock scale); hair: nose -> tail, down the legs,
  // outward from the forehead whorl on the face
  const comb = new Float32Array(nV * 3);
  const whorl = [0, 0.03, -0.02]; // forehead whorl, head-local
  // the face's hair flow before its fine jitter: out from the forehead whorl, down the face to the nose
  const faceFlow = (p) => {
    const h = HL(p);
    const rel = [h[0] - whorl[0], (h[1] - whorl[1]) * 0.4, h[2] - whorl[2] + 0.05];
    let d = norm(add(mul(HY, rel[1] - 0.03), add(mul(HZ, rel[2]), [rel[0], 0, 0])));
    if (h[2] < -0.05) d = norm(add(d, [0, -0.6, -0.8]));
    return d;
  };
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const bone = BONES[dominant[v]];
    let d;
    if (r === 5) d = norm(sub(bone.tail, bone.head));
    else if (r === 7) d = [0, 1, 0];
    else if (r === 2 || r === 6) {
      d = faceFlow(p);
      // (the hairs lie a little unevenly: breaks the sheen of a short coat into hair texture)
      const f = 220;
      d = norm(add(d, [vnoise3(p[0] * f, p[1] * f, p[2] * f) - 0.5, vnoise3(p[0] * f + 7, p[1] * f + 3, p[2] * f) - 0.5, vnoise3(p[0] * f + 3, p[1] * f + 11, p[2] * f + 5) - 0.5].map((x) => x * 0.9)));
    } else if (r === 4) {
      d = norm(sub(bone.tail, bone.head));
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = rig.AXIAL.points[seg], b = rig.AXIAL.points[Math.min(seg + 1, rig.AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.8 * Math.abs(n[0]), 0]));
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
    if (wool[v] <= 0.5 && legness[v] > 0.3) {
      // short leg hair lies a little unevenly too (matte, not a sheen)
      const f = 220;
      d = norm(add(d, [vnoise3(p[0] * f, p[1] * f, p[2] * f) - 0.5, vnoise3(p[0] * f + 7, p[1] * f + 3, p[2] * f) - 0.5, vnoise3(p[0] * f + 3, p[1] * f + 11, p[2] * f + 5) - 0.5].map((x) => x * 0.8)));
    }
    if (wool[v] > 0.5) {
      // the staples' fibres fall together: one continuous field over the whole fleece (sculpt.js
      // stapleFall: away from the head and down). (An earlier field turned it a little lock by lock: the fur
      // shading follows the hair direction, and under a low sun the fleece lit in grey blotches the size of
      // a few locks; the locks now show as the crevices between them, below.) The fine crimp is added after
      // smoothing.
      d = stapleFall(n, p, J);
    }
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];
  }

  // fleece flow: smoothed, then the fine crimp (the fibres wave every few millimetres)
  {
    const cx = new Float32Array(nV), cy = new Float32Array(nV), cz = new Float32Array(nV);
    for (let v = 0; v < nV; v++) { cx[v] = comb[v * 3]; cy[v] = comb[v * 3 + 1]; cz[v] = comb[v * 3 + 2]; }
    const keep = (v) => wool[v] <= 0.5;
    for (const f of [cx, cy, cz]) smoothField(f, weights.neighbors, 3, keep);
    for (let v = 0; v < nV; v++) {
      if (wool[v] <= 0.5) continue;
      const p = P(v), n = N(v), f = 140;
      let d = add([cx[v], cy[v], cz[v]], mul([vnoise3(p[0] * f, p[1] * f, p[2] * f) - 0.5, vnoise3(p[0] * f + 17, p[1] * f + 3, p[2] * f) - 0.5, vnoise3(p[0] * f + 5, p[1] * f + 31, p[2] * f + 9) - 0.5], 0.3));
      let t = sub(d, mul(n, dot(d, n)));
      if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
      t = norm(t);
      comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];
    }
  }

  // --- per-vertex fields
  const pattern = new Float32Array(nV).fill(0.02);
  const patternColor = new Float32Array(nV * 4);
  const markSDF = new Float32Array(nV).fill(1);
  const furLen = new Float32Array(nV);
  const tint = new Float32Array(nV * 4);
  const surf = new Float32Array(nV * 4);
  const hairLen = lamb ? 0.007 : 0.0045;

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v], tag = tagOf[v];
    // (short hair: matte; 0.45 gave the black face a plastic sheen)
    let col, mat = MAT.FUR, fl = hairLen, mark = 1, gloss = 0.22, undercoat = 0;
    const lb = legBone[v];
    const lbName = lb >= 0 ? BONES[lb].name : '';
    const cv = fbm3(p[0] * 6, p[1] * 6, p[2] * 6, 3) - 0.5;
    if (r === 0 || r === 1 || r === 4) {
      // clean hair (legs below the wool, and wherever the fleece stops)
      col = mix3(COL.hair, COL.hairShade, smoothstep(0.2, -0.6, n[1]) * 0.6);
      const L = legness[v];
      // (neck skin showing between the wool primitives behind the head is the fleece's colour, not the
      // face's: on a Suffolk it showed as black tufts in the white throat wool)
      if (fleeceOn && r === 1 && L < 0.3) col = mix3(col, COL.clean, 1 - L / 0.3);
      fl = mix(0.006, 0.004, L);
      if (tag === 'udder' || tag === 'teat') {
        mat = MAT.SKIN; fl = tag === 'teat' ? 0 : 0.002; gloss = 0.35;
        col = COL.black ? mix3(COL.skin, [0.1, 0.08, 0.08], 0.3) : COL.skin;
      }
      if (tag === 'scrotum') { fl = 0.005; col = mix3(col, COL.skin, 0.25); }
      if (/hoof|paw/.test(lbName) && HOOF_TAGS.has(tag)) {
        const Cj = J[(lbName[0] === 'f' ? 'fcoffin' : 'hcoffin') + BONES[lb].side];
        if (tag === 'dewclaw' || p[1] < Cj[1] + 0.006 + 0.35 * (p[2] - Cj[2])) {
          mat = MAT.KERATIN; fl = 0; gloss = 0.45;
          col = COL.hoof;
          // unpigmented hooves are often striped (a dark vertical band in a pale wall)
          if (!COL.black) col = mix3(col, [0.06, 0.05, 0.045], smoothstep(0.3, 0.7, vnoise3(p[0] * 300, 3.1, p[2] * 90)) * 0.7 * (params.hoofStripe ?? 0.5));
          if (tag === 'heelbulb') col = mix3(col, [0.1, 0.08, 0.07], 0.4);
        }
      }
    } else if (r === 5) {
      // ears: short hair outside, sparse inside with the skin showing
      const earP = model.prims.find((q) => q.tag === 'ear' && (q.bone === (p[0] > 0 ? 'earL' : 'earR')));
      const faceDir = [earP.P[9], earP.P[10], earP.P[11]];
      const front = dot(n, faceDir);
      col = COL.hair;
      fl = 0.0035;
      // (the inside of the cup: on the carved hollow, whichever way its walls face)
      const cup = model.prims.find((q) => q.tag === 'earinner' && q.bone === earP.bone);
      const dc = cup ? Math.abs(SDFModel.dist(cup, p[0], p[1], p[2])) : 1;
      // (pink skin inside the cup; the face of the leaf round it and its rim keep their white hair, so the
      // ear seen from the side or above reads as a white leaf, not a pink saucer)
      const inner = Math.max(0.2 * smoothstep(0.35, 0.8, front), smoothstep(0.0025, 0.0005, dc) * smoothstep(-0.3, 0.0, front));
      fl = mix(fl, 0.002, inner); col = mix3(col, COL.earIn, 0.55 * inner);
    } else if (r === 7) {
      // horn: pale ridged keratin, darker toward the base, transverse growth ridges (the "corrugations")
      const S = p[0] >= 0 ? 0 : 1, Hh = horns[S];
      let bt = 0, bd = 1e9;
      for (let i = 0; i + 1 < Hh.length; i++) {
        const a = Hh[i].p, b = Hh[i + 1].p, ab = sub(b, a);
        const u = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0, 1);
        const q = add(a, mul(ab, u)), dd = len(sub(p, q));
        if (dd < bd) { bd = dd; bt = Hh[i].t + (Hh[i + 1].t - Hh[i].t) * u; }
      }
      mat = MAT.KERATIN; fl = 0; gloss = 0.3;
      col = mix3(COL.hornDark, COL.horn, smoothstep(0.0, 0.35, bt));
      col = mix3(col, mul(COL.horn, 1.12), smoothstep(0.75, 1, bt) * 0.5);
      const hlen = (params.horns?.turns || 1) * 0.5 * bt;
      const ring = 0.5 + 0.5 * Math.sin(hlen * 2 * Math.PI / 0.012);
      col = mul(col, 1 - 0.14 * ring * (1 - smoothstep(0.8, 1, bt)));
      col = mul(col, 0.9 + 0.2 * vnoise3(p[0] * 300, p[1] * 60, p[2] * 300));
    } else {
      // head & jaw: short, fine, matte hair (5-7 mm on the skull and cheeks, 3 mm on the muzzle and round
      // the eyes); a black face is charcoal rather than ink, greyer round the muzzle and the eyes (face1,
      // extra/Tete_de_brebie_Suffolk), with a fine, uneven tone that keeps it from reading as plastic
      const h = HL(p);
      col = mix3(COL.hair, COL.hairShade, smoothstep(0.1, -0.7, dot(n, HY)) * 0.5);
      fl = (lamb ? 0.0065 : 0.0055) * (1 + 0.25 * smoothstep(0.02, -0.06, h[2]));
      const muz = smoothstep(0.12, 0.175, h[2]);
      col = mix3(col, COL.muzzle, muz * 0.7);
      fl = mix(fl, 0.0018, muz);
      const eyeD = EYE_PATCH.centres.reduce((a, c) => Math.min(a, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])), 1);
      col = mix3(col, COL.muzzle, smoothstep(0.024, 0.012, eyeD) * 0.2);
      fl = Math.min(fl, mix(0.003, fl, smoothstep(0.012, 0.022, eyeD)));
      const tn = vnoise3(p[0] * 160, p[1] * 160, p[2] * 160) - 0.5;
      col = mul(col, 1 + 0.16 * tn + 0.08 * (fbm3(p[0] * 30, p[1] * 30, p[2] * 30, 2) - 0.5));
      // the short coat's texture: streaks drawn out along the hair flow (partings and tufts lying together a
      // few millimetres wide, a centimetre or two long), so the face reads as short hair, not a smooth skin
      // (without it: smooth white or black rubber, hard to tell from the fleece)
      {
        const c = faceFlow(p), al = dot(p, c);
        const q = [p[0] - c[0] * al * 0.85, p[1] - c[1] * al * 0.85, p[2] - c[2] * al * 0.85];
        const st = vnoise3(q[0] * 230 + 5, q[1] * 230, q[2] * 230 + 9) - 0.5;
        col = mul(col, 1 + (COL.black ? 0.5 : 0.22) * st * smoothstep(0.0025, 0.004, fl));
      }
      // a white face is a little mottled grey where the skin shows through the short hair (threequarter1)
      if (!COL.black) col = mul(col, 1 - 0.1 * smoothstep(0.55, 0.8, fbm3(p[0] * 22 + 3, p[1] * 22, p[2] * 22 + 1, 2)));
      const nearEye = eyeD < 0.019;
      // the lids: a thin dark margin (the lash line) and round it a few millimetres of pale, almost bare lid
      // skin (threequarter1, face2, extra/Lundy: the eye reads as an almond in a pale rim, not a black bead)
      // (only on the lids themselves, the skin over the globe (r + lid 16.2 mm from its centre): the almond's cut
      // runs on outward and passes close to the brow, and the margin drawn there was a dark frown line over the eye)
      const onLid = smoothstep(0.0205, 0.0178, eyeD);
      for (const e of nearEye ? eyePrims : []) {
        const de = Math.abs(SDFModel.dist(e, p[0], p[1], p[2]));
        if (de < 0.0026 && eyeD < 0.0178) mark = Math.min(mark, de - 0.0011);
        if (de < 0.001 && eyeD < 0.0178) { mat = MAT.DARK_SKIN; fl = 0; }
        else if (de < 0.005) {
          const lid = smoothstep(0.005, 0.0025, de) * onLid;
          col = mix3(col, COL.lid, lid);
          fl = Math.min(fl, mix(0.0018, 0.0006, lid));
        }
      }
      // nostrils: comma slits in a deeper shade of the nose, soft-edged; the philtrum a fine groove (front1: on a
      // pink nose the slits are a deeper pink-mauve, the philtrum a pink line). The front of the nose is meshed at
      // ~1.2 mm (regions.js NOSE_PATCH), so the carved slits come out clean. (the dark leather
      // material and a black mark inside them, on the 4-5 mm face cells, read as ragged black blotches with a
      // glint, and the philtrum as a black T)
      const paleNose = COL.nose[0] + COL.nose[1] + COL.nose[2] > 0.45;
      for (const e of nostrilPrims) {
        const dn = SDFModel.dist(e, p[0], p[1], p[2]);
        if (e.tag === 'philtrum') continue;
        if (dn < 0.005) {
          // (how deep the skin here lies inside the nose's uncarved form: the slit's walls; the carve's own distance
          // is loose for so thin an ellipsoid)
          const depth = -SDFModel.evalList(headPrims, p[0], p[1], p[2]), inside = smoothstep(0.0002, 0.0012, depth);
          const ins = Math.max(inside, 0.5 * smoothstep(0.002, 0, dn));
          col = mix3(col, paleNose ? [COL.nose[0] * 0.36, COL.nose[1] * 0.22, COL.nose[2] * 0.26] : mul(COL.nose, COL.black ? 0.4 : 0.28), ins);
          // (bare inside the slit: the 1 mm hair's lit tips drew pale streaks there; the fine hair runs on to its
          // edge: a bare band round it showed the fur base, shaded as if under the coat, as a ragged dark ring)
          fl = Math.min(fl, 0.0012 * (1 - smoothstep(0.25, 0.6, inside)));
        }
      }
      // the philtrum: a fine line from between the nostrils down to the lip (front1, face2, threequarter1)
      {
        const pl = smoothstep(0.0012, 0.0004, Math.abs(h[0])) * smoothstep(-0.026, -0.03, h[1]) * smoothstep(0.19, 0.196, h[2]) * smoothstep(0.1, 0.4, dot(n, HZ));
        if (pl > 0) { col = mix3(col, mul(COL.nose, paleNose ? 0.75 : 0.7), pl * 0.85); fl = Math.min(fl, mix(fl, 0.0004, pl)); }
      }
      // the small bare nose pad between the slit nostrils (soft-edged; covered in very fine hair: only
      // the nostrils are bare)
      // (a rounded pad over the nose front between the nostrils, running down the philtrum, its edge soft and
      // mottled into the muzzle hair: a square block of colour read as a rubber cap)
      const fwdN = smoothstep(0.15, 0.5, dot(n, HZ)) * smoothstep(0.17, 0.182, h[2]);
      const dpad = Math.hypot(h[0] / 0.021, (h[1] + 0.017) / 0.014);
      const phil = smoothstep(0.006, 0.003, Math.abs(h[0])) * smoothstep(-0.04, -0.033, h[1]) * smoothstep(-0.012, -0.02, h[1]);
      const mott = vnoise3(p[0] * 260, p[1] * 260, p[2] * 260);
      const pad = fwdN * Math.max(smoothstep(1.2 + 0.25 * mott, 0.7, dpad), phil);
      if (pad > 0) { col = mix3(col, COL.nose, pad); fl = mix(fl, Math.min(fl, 0.0012), pad); }
      // (a dark nose dusts the muzzle round it grey)
      if (!COL.black) col = mix3(col, mix3(COL.nose, col, 0.5), muz * smoothstep(1.9, 1.1, dpad) * smoothstep(0.35, 0.75, mott) * 0.5 * (1 - pad));
      // the lips meet in a dark line; the pink inside of the mouth only where it faces into the mouth
      const into = dot(n, HY);
      // (the line only along the front of the mouth, fading out 4 cm back from the nose: drawn round the rear
      // of the lower jaw it turned down at the corner, a sharply down-turned mouth (side2: the mouth is short,
      // its corner level or a little up))
      const lipF = smoothstep(0.15, 0.165, h[2]);
      // (the lips overlap: what one lip hides is lip skin, so a chewing jaw that slides aside shows lip,
      // not a hole; the line where they meet is a dark mark)
      // (a dark line where the lips meet, as in the photos; not a pink gash)
      // (on a white face the hidden lip skin is a pale pink-grey: a dark lip surface showed as a dark gap wherever
      // chewing parted the lips)
      const lipCol = COL.black ? mul(COL.muzzle, 0.7) : mix3(COL.muzzle, mix3(COL.skin, COL.nose, 0.3), 0.3);
      if (regionNames[regionOf[v]] !== 'jaw') {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (h[2] > 0.135 && dj < 0.004) {
          mark = Math.min(mark, Math.abs(dj) - 0.0014 * lipF);
          fl = Math.min(fl, 0.0012);
          if (dj < 0) { col = lipCol; fl = 0; if (dj < -0.004 && into < -0.6) mat = MAT.MOUTH; }
        }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (dh < 0.0035) {
          mark = Math.min(mark, Math.abs(dh) - 0.0014 * lipF);
          fl = Math.min(fl, 0.0012);
          if (dh < 0) { col = lipCol; fl = 0; if (dh < -0.004 && into > 0.6) mat = MAT.MOUTH; }
        }
      }
      // the preorbital gland: a bare dark slit
      const dp = preorb.reduce((a, q) => Math.min(a, SDFModel.dist(q, p[0], p[1], p[2])), 1);
      if (dp < 0.003) { col = mul(col, COL.black ? 0.8 : 0.75); fl = Math.min(fl, 0.002); } // (0.55 drew a dark stroke like a frowning brow)
    }

    // ---- fleece
    const w = wool[v];
    if (w > 0.01 && mat === MAT.FUR) {
      const c = crest[v];
      const up = clamp(n[1], -1, 1);
      // clean wool inside, weathered tips on the lock crests, the crevices between the locks only a little
      // darker (the shells' own depth shading darkens them further): an even, creamy fleece
      let wc = mix3(mix3(COL.crevice, COL.clean, 0.62), COL.clean, smoothstep(0.0, 0.45, c));
      wc = mix3(wc, COL.tip, smoothstep(0.3, 1, c) * (COL.black ? 0.35 : 0.55));
      // a faint dusting along the top line, light stains on the belly and the britch
      wc = mix3(wc, COL.dust, smoothstep(0.6, 0.95, up) * 0.22 * smoothstep(0.2, 0.8, c));
      const low = smoothstep(0.34, 0.2, p[1]) * (1 - legness[v] * 0.5);
      const britch = smoothstep(-0.35, -0.5, p[2]) * smoothstep(0.55, 0.35, p[1]);
      wc = mix3(wc, COL.stain, Math.max(low, britch) * 0.3);
      // (no large-scale grey blotches: the tone varies a little from staple to staple only)
      const sn = vnoise3(p[0] * 45, p[1] * 45, p[2] * 45) - 0.5;
      wc = [wc[0] * (1 + 0.035 * cv + 0.05 * sn), wc[1] * (1 + 0.03 * cv + 0.05 * sn), wc[2] * (1 + 0.025 * cv + 0.045 * sn)];
      col = mix3(col, wc, w);
      // staple tips: crests longer, crevices short (the gaps open between the locks)
      // (shorter close behind the head, where the poll and the throat fold the wool in every pose)
      const nearHead = smoothstep(-0.09, -0.01, neckS(p[0], p[1], p[2]));
      const flW = staple * mix(0.75, 1.1, c) * (1 - 0.3 * nearHead);
      fl = mix(fl, flW, w);
      gloss = mix(gloss, merino ? 0.22 : 0.15, w);
      undercoat = w * 0.08; // (greyer roots greyed the cream)
    } else if (mat === MAT.FUR) {
      const tn = r <= 1 ? vnoise3(p[0] * 160, p[1] * 160, p[2] * 160) - 0.5 : 0;
      col = [col[0] * (1 + 0.08 * cv + 0.14 * tn), col[1] * (1 + 0.07 * cv + 0.14 * tn), col[2] * (1 + 0.06 * cv + 0.14 * tn)];
    }
    markSDF[v] = mark;
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    surf[v * 4] = gloss;
    surf[v * 4 + 3] = undercoat;
  }
  smoothField(furLen, weights.neighbors, 2, (v) => tint[v * 4 + 3] !== MAT.FUR);

  // --- the head's form in the coat: the hollows of the face (round the eye, the groove
  // between cheek and muzzle, under the jaw, the throat behind it and the face's edge where the wool collar
  // stands over it) lie in the shadow of the forms round them, and on a black face the short hair of the
  // ridges (nasal bone, brow, cheek, the edge of the jaw) catches the sky's light. Lit only by the sky (the
  // shade side, a low sun), a uniform black face read as one featureless shape and a white face ran into the
  // neck with no break at the jaw. Occlusion from the sculpt (SDF samples 5-30 mm out along the normal), the
  // ridges from samples inside (a form thinner than ~1-2 cm), the sheen from the hair facing up and forward.
  {
    const occl = model.prims.filter((q) => !q.carve && q.part !== 'horn' && (q.bone === 'head' || q.bone === 'jaw' || q.bone === 'neck2' || (q.bone === 'neck1' && /neck|throat/.test(q.tag))));
    // (at the mouth each lip is shaded by its own part's form only: the other lip's occlusion drew the crease
    // where they meet as a dark gap at the corner of the mouth, an open mouth)
    const occlUpper = occl.filter((q) => q.part !== 'jaw'), occlLower = occl.filter((q) => q.part === 'jaw');
    const skull = model.prims.filter((q) => !q.carve && (q.bone === 'head' || q.bone === 'jaw') && q.part !== 'horn');
    const dark = !!COL.black;
    for (let v = 0; v < nV; v++) {
      const r = region[v];
      if ((r !== 2 && r !== 6) || tint[v * 4 + 3] !== MAT.FUR || wool[v] > 0.5) continue;
      const p = P(v), n = N(v);
      const hm = HL(p), atMouth = hm[2] > 0.1 && hm[1] < -0.025;
      const ol = r === 6 ? occlLower : atMouth ? occlUpper : occl;
      let occ = 0;
      for (const [i, d] of [[1, 0.005], [2, 0.011], [3, 0.019], [4, 0.03]]) {
        const sd = SDFModel.evalList(ol, p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d);
        occ += (Math.max(0, d - sd) / d) / i;
      }
      let ridge = 0;
      for (const d of [0.007, 0.014]) {
        const si = SDFModel.evalList(skull, p[0] - n[0] * d, p[1] - n[1] * d, p[2] - n[2] * d);
        ridge += 0.5 * clamp((d + si) / d, 0, 1);
      }
      const h = HL(p);
      const nh = [n[0], dot(n, HY), dot(n, HZ)];
      // (the forehead and the nasal bone face the sky; the underside of the jaw does not)
      const sky = smoothstep(-0.2, 0.8, nh[1] * 0.8 + nh[2] * 0.35);
      const ao = clamp(1 - (dark ? 0.75 : 0.6) * occ, dark ? 0.45 : 0.6, 1);
      const lift = dark ? 1 + 0.9 * smoothstep(0.08, 0.5, ridge) + 0.9 * sky : 1 + 0.04 * smoothstep(0.1, 0.5, ridge);
      // (the muzzle and nose keep their own tone)
      const k = ao * mix(lift, 1, smoothstep(0.165, 0.185, h[2]));
      tint[v * 4] *= k; tint[v * 4 + 1] *= k; tint[v * 4 + 2] *= k;
    }
  }

  // --- the locks: thin, broken dark crevices between the staple blocks (a crisp pattern line along the
  // border of each lock's cell; the cells are the sculpted locks, stretched down the fall), so the fleece
  // reads as locks by its texture rather than by big soft bumps (whose shading under a low sun made the
  // grey blotches)
  if (lockPrims.length) {
    // (on a dark fleece the gaps between the locks hardly show: the tips are the lighter part)
    // (COL.black marks a black face; the fleece is dark only in the black / brown morph)
    const darkFleece = COL.clean[0] + COL.clean[1] + COL.clean[2] < 0.6;
    const crev = darkFleece ? mix3(COL.crevice, COL.clean, 0.4) : mix3(COL.crevice, COL.clean, 0.15);
    for (let v = 0; v < nV; v++) {
      if (wool[v] < 0.5 || tint[v * 4 + 3] !== MAT.FUR) continue;
      const p = P(v);
      let d1 = 1e9, d2 = 1e9;
      for (const q of lists[v]) {
        if (q.tag !== 'lock' && q.tag !== 'lockleg') continue;
        const dx = p[0] - q.P[0], dy = p[1] - q.P[1], dz = p[2] - q.P[2];
        const al = dx * q.P[9] + dy * q.P[10] + dz * q.P[11];
        const dd = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - 0.55 * al * al));
        if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
      }
      if (d2 > 1e8) continue;
      const brk = vnoise3(p[0] * 30 + 3, p[1] * 30, p[2] * 30 + 7);
      const wdt = 0.0011 + 0.0012 * vnoise3(p[0] * 90, p[1] * 90 + 5, p[2] * 90);
      pattern[v] = clamp((d2 - d1) * 0.5 - wdt, -0.02, 0.02);
      const k = wool[v] * smoothstep(0.3, 0.6, brk) * (merino ? 0.4 : darkFleece ? 0.35 : 0.5);
      patternColor[v * 4] = crev[0]; patternColor[v * 4 + 1] = crev[1]; patternColor[v * 4 + 2] = crev[2]; patternColor[v * 4 + 3] = k;
    }
  }
  if (globalThis.__sheepDbg) globalThis.__sheepDbg.push({ region, wool, tint, furLen, pos, HL, nV });
  void R; void mix;
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, stats: {}, region, wool };
}
