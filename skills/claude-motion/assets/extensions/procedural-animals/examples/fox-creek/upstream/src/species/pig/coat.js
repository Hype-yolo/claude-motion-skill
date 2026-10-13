// The pig's covering: bare skin (material 4, subsurface-lit) under sparse bristles (short thin hair
// shells: 10-30 mm on the body, longer along the dorsal midline, the jowls and the tail tip, fine on
// the ears), per breed:
//   largewhite / landrace  pink skin, white bristles, flushed ears, snout and belly
//   duroc                  red (golden to mahogany) skin and bristles
//   hampshire              black with a white belt over the shoulders and both forelegs
//   berkshire              black with six white points (feet, face blaze and snout, tail tip)
//   spotted                pink with seeded black spots (Gloucester Old Spot / Pietrain)
// the rostral disc (moist pink or slate skin, dark nostrils), long lashes on the upper lids, pale or
// dark horn claws, ivory tusks, the teats, skin creases on the neck and behind the joints (darkened
// tint), seeded mud on outdoor pigs, and bristle flow nose -> tail, down the legs, back from the
// snout on the face.
import { HEAD_O, HZ, HY, TAIL_SEGS, SNOUT_K } from './rig.js';
import { neckS } from './regions.js';
import { EYE, tuskCones } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, smoothField, projectToSurface } from '../../core/build/coatKit.js';

// sRGB swatches sampled from the reference photos. Pink skin is
// given as albedo (a little deeper than the lit photo values).
// (the white breeds paler and less saturated, s 0.15 (was 0.20, #ECC4BC): lw_belagro3 in sun reads
// s 0.11-0.14 lit and a mauve grey in shade; the showcase's tone mapping saturates a dim pink, and the old albedo
// turned terracotta to maroon wherever the sun did not reach)
export const COATS = {
  pink: { body: 0xf2d6ce, dorsal: 0xf4ddd6, belly: 0xf0cdc5, flush: 0xeab2aa, ear: 0xeec2ba, disc: 0xe4aca6, hoof: 0xc8ab98, bristle: 0xf2ece2, dark: false },
  // (the Duroc less saturated, s 0.49 (was 0.58), a touch lighter: lit it still matches du_boar7 /
  // du_belagro1 / head_duroc_sau (133-153, 89-116, 73-108; s 0.29-0.45), and in shade, where the showcase's tone
  // mapping crushes a dim red, the face under the ear read a near-black maroon, s 0.8, v 0.13, the eye lost in it)
  red: { body: 0x9e6a58, dorsal: 0x94604f, belly: 0xa87462, flush: 0x9e6250, ear: 0x98604f, disc: 0xa87a6a, hoof: 0x4a3a32, bristle: 0xb87a48, dark: false },
  // (the black breeds' charcoal skin, bk_porco / bk_boar: (30-80) sRGB over the body in daylight, median
  // ~(50, 45, 50); #201D1D rendered (3-8) lit in the showcase, #3A3434 (18), a black hole of a face with the eye lost in it)
  black: { body: 0x504847, dorsal: 0x413a3a, belly: 0x524948, flush: 0x524544, ear: 0x4a3f3f, disc: 0x5a4e4e, hoof: 0x3a3330, bristle: 0x2c2727, dark: true },
};
const WHITE = 0xe8d6cc; // white points / belt: white bristles over pink skin
// (tusks: ivory, the tip whitest (khaki in studio light at #F2EADB / #D9C9A8 under the keratin striations);
// mud: a warm grey-brown, wet #857060 to dry #A89C8C (threequarter2, face3; #8F8068 read olive))
const NOSTRIL = 0x5a3230, TEAT = 0xd49a8e, TUSK = 0xfbf6ec, TUSK_ROOT = 0xece2cc, MUD = 0x857060, MUD_DRY = 0xa89c8c;
// the mouth line (head-local): its half width on each surface, and where it starts to fade toward the corner
const LIP_W = 0.0008, LIP_Z0 = 0.045;
// inside the mouth (palate, gums, the inside of the lips): moist pink-red mucosa
// (a little less saturated: the inside of the lower lip read as a lipstick-red ring round the open mouth)
const MUCOSA = srgb(0x9a5552), TONGUE = 0xc47a72;

const BASE_OF = { largewhite: 'pink', landrace: 'pink', duroc: 'red', hampshire: 'black', berkshire: 'black', spotted: 'pink' };
// meshing cell per surface at the hero tier (regions.js)
const CELL = { body: 0.0078, head: 0.0041, feet: 0.0035, jaw: 0.003, tail: 0.002 };

function palette(p) {
  const C = COATS[BASE_OF[p.variant] || 'pink'];
  const k = p.coatShade || 0, l = p.coatLightness || 0;
  const tw = (hex) => { const c = srgb(hex); return [c[0] * (1 + 0.06 * k + l), c[1] * (1 + l), c[2] * (1 - 0.05 * k + l)]; };
  const out = {};
  for (const [key, v] of Object.entries(C)) out[key] = typeof v === 'number' ? tw(v) : v;
  out.white = srgb(WHITE);
  out.spot = srgb(0x3a3436); // (Gloucester Old Spot: slate-black skin under black hair)
  return out;
}

const mul3 = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const segSD2 = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return [Math.hypot(px - ax - dx * t, py - ay - dy * t), t];
};
// The veins on the back of an ear leaf, in leaf units (u 0 root .. 1 tip along the ear bone, w across, out from the
// midrib, both / the bone's length): signed distance to the nearest vein's edge (< 0 inside). A central vein and two
// marginal ones fanning out from the root, each with one or two branches toward the rim; widths 1.8 -> 0.5 % of the
// length (3.6 -> 1 mm wide on a 0.2 m ear), tapering; a little seeded variation per pig.
const VEINS = [
  // [u0, w0, u1, w1, width0, width1]
  [0.04, 0.0, 0.5, 0.02, 0.009, 0.006], [0.5, 0.02, 0.88, 0.0, 0.006, 0.0025],
  [0.06, 0.05, 0.42, 0.17, 0.008, 0.0055], [0.42, 0.17, 0.8, 0.22, 0.0055, 0.0025],
  [0.06, -0.05, 0.4, -0.15, 0.008, 0.0055], [0.4, -0.15, 0.78, -0.2, 0.0055, 0.0025],
  [0.28, 0.12, 0.5, 0.29, 0.004, 0.002], [0.55, 0.19, 0.7, 0.31, 0.0035, 0.0018],
  [0.3, -0.12, 0.52, -0.27, 0.004, 0.002], [0.6, -0.18, 0.72, -0.29, 0.0035, 0.0018],
  [0.62, 0.015, 0.8, 0.11, 0.003, 0.0016], [0.66, 0.01, 0.82, -0.1, 0.003, 0.0016],
];
function earVeinSD(u, w, seed) {
  const j = ((seed % 13) / 13 - 0.5) * 0.04;
  let d = 1;
  for (const [u0, w0, u1, w1, r0, r1] of VEINS) {
    const [dd, t] = segSD2(u, w, u0, w0 * (1 + j * 3), u1, w1 * (1 + j * 3) + j);
    d = Math.min(d, dd - 0.8 * (r0 + (r1 - r0) * t));
  }
  return d;
}

export function pigCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, regionNames, weights, nV, params, lists } = ctx;
  // lashes only where the shells are fine enough to draw them (hero, high): at medium and low 8-16
  // shells draw a pale halo over the eye
  const lashes = !ctx.Q || ctx.Q.res <= 1.35;
  const { BONES } = rig;
  const J = rig.J;
  const COL = palette(params);
  const piglet = params.age === 'juvenile';
  const breed = params.variant || 'largewhite';
  const { dominant, axialS, skinIndex, skinWeight, limbMember } = weights;
  const AX_LEN = weights.axialLengths;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8];
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const eyeFrames = [1, -1].map((s) => eyeFrameOf(EYE, HEAD_O, s));
  const jawPrims = model.forPart('jaw');
  const headPrims = model.forPart('body').filter((p) => (p.bone === 'head' || p.bone === 'snout') && !p.carve);
  const nostrilPrims = model.prims.filter((p) => p.tag === 'nostril');
  // tusks: root and tip per side (the colour runs from a creamy base to the white point along the tusk)
  const tuskSegs = (params.tusks || 0) > 0.05 ? [1, -1].map((s) => tuskCones(params, s)) : [];
  const tuskEnds = (params.tusks || 0) > 0.05 ? [1, -1].map((s) => { const C = tuskCones(params, s); return { root: C[0].a, tip: C[C.length - 1].b }; }) : [];
  const JAW_BONE = rig.BONE.jaw ? rig.BONE.jaw.index : -1;
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof|femur|tibia|metatarsus|hpaw|hhoof)/.test(b.name));
  const isFront = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof)/.test(b.name));
  const HL = (p) => { const d = sub(p, HEAD_O); return [d[0], dot(d, HY), dot(d, HZ)]; };
  const rname = regionNames;

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

  // --- regions: 0 torso / legs, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw, 7 snout disc
  const region = new Uint8Array(nV);
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  const tailT = new Float32Array(nV); // 0 root .. 1 tip
  for (let v = 0; v < nV; v++) {
    const bn = BONES[dominant[v]].name, p = P(v), rn = rname[partOf[v]];
    let lb = -1, lw = 0;
    for (let k = 0; k < 4; k++) {
      const b = skinIndex[v * 4 + k], w = skinWeight[v * 4 + k];
      if (isLimb[b] && w > lw) { lw = w; lb = b; }
    }
    legBone[v] = lb;
    legness[v] = lb >= 0 ? smoothstep(0.15, 0.85, limbMember[v]) : 0;
    if (rn === 'jaw' || rn === 'tuskL' || rn === 'tuskR') region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    // (and the floor of the nostrils, which the snout cone's vertices form under the head bone: painted as head skin
    // it showed as pink patches deep in the Berkshire's nostrils)
    else if (bn === 'snout' || tagOf[v] === 'disc' || tagOf[v] === 'snoutend' || nostrilPrims.some((e) => SDFModel.dist(e, p[0], p[1], p[2]) < 0.003)) region[v] = 7;
    else if (rn === 'tail' || (bn.startsWith('tail') && axialS[v] > sTailBase + 0.015)) region[v] = 4;
    else if (rn === 'feet' || (lb >= 0 && limbMember[v] > 0.5 && p[1] < 0.5)) region[v] = 0;
    else if (axialS[v] < sOcc + 0.02 || (rn === 'head' && neckS(p[0], p[1], p[2]) > 0.03)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) legness[v] = 0;
    if (rn === 'feet') legness[v] = 1;
    if (region[v] === 4) tailT[v] = clamp((axialS[v] - sTailBase) / Math.max(1e-3, AX_LEN[AX_LEN.length - 1] - sTailBase), 0, 1);
  }

  // --- pattern: signed distance (m) to the second colour (< 0 inside), per breed
  const R = rng(7717 + (params.coatSeed || 0));
  const off = [R() * 100, R() * 100, R() * 100];
  const toSD = (fn, p) => {
    const e = 0.01, f0 = fn(p);
    const gx = (fn([p[0] + e, p[1], p[2]]) - f0) / e, gy = (fn([p[0], p[1] + e, p[2]]) - f0) / e, gz = (fn([p[0], p[1], p[2] + e]) - f0) / e;
    const g = Math.max(0.5, Math.hypot(gx, gy, gz));
    return -f0 / g;
  };
  const rag = (p, f, a) => (fbm3(p[0] * f + off[0], p[1] * f + off[1], p[2] * f + off[2], 2) - 0.5) * a;
  // spotted: seeded black blotches on the body, neck and head (Gloucester Old Spot: 4-12 spots, 5-15 cm;
  // Pietrain: more, smaller): each one 2-3 overlapping lobes with a ragged, hairy outline, none on the snout.
  // The centres are drawn in space and projected onto the sculpt, with a fixed number of random draws per
  // candidate, so every quality tier gets the same spots (drawn from the mesh's vertex list, they moved
  // when the tier changed); the nearest vertex only says whether a place may carry one.
  const spots = [];
  const offSnout = (v) => { if (region[v] === 7 || region[v] === 6) return false; if (region[v] !== 2) return true; return HL(P(v))[2] < 0.06; };
  if (breed === 'spotted') {
    const nSpots = params.spotCount ?? 8;
    const body = model.forPart('body').filter((q) => !q.carve);
    const cell = 0.025, grid = new Map(), gk = (x, y, z) => (Math.floor(x / cell) + 64) * 16384 + (Math.floor(y / cell) + 64) * 128 + (Math.floor(z / cell) + 64);
    for (let v = 0; v < nV; v++) { const k = gk(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(v); }
    const nearest = (p) => {
      let best = -1, bd = 1e9;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const a = grid.get(gk(p[0] + dx * cell, p[1] + dy * cell, p[2] + dz * cell));
        if (a) for (const v of a) { const d = (pos[v * 3] - p[0]) ** 2 + (pos[v * 3 + 1] - p[1]) ** 2 + (pos[v * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = v; } }
      }
      return best;
    };
    // (off the neck and the limb junctions, whose skin stretches most when the legs swing and the head
    // moves: a spot's edge there smeared; keep-outs from the joints, the same on every tier)
    const allowed = (v) => v >= 0 && (region[v] === 0 || region[v] === 2) && legness[v] < 0.08 && tagOf[v] !== 'teat' && offSnout(v);
    const segD = (p, a, b) => { const ab = sub(b, a), t = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0, 1); return len(sub(p, add(a, mul(ab, t)))); };
    const clearOf = (p, r) => {
      if (p[2] > J.neckBase[2] - 0.03 && HL(p)[2] < -0.1) return false;
      for (const S of ['L', 'R']) {
        if (segD(p, J['scapTop' + S], J['elbow' + S]) < r + 0.1) return false;
        if (segD(p, J['elbow' + S], add(J['elbow' + S], [0, 0.05, -0.16])) < r + 0.07) return false;
        if (segD(p, J['hip' + S], J['knee' + S]) < r + 0.07) return false;
        if (Math.hypot(...sub(p, J['knee' + S])) < r + 0.12) return false;
      }
      return true;
    };
    for (let i = 0; i < 400 && spots.length < nSpots; i++) {
      const q = [(R() - 0.5) * 0.5, 0.3 + 0.55 * R(), -0.62 + 1.3 * R()];
      const rr = R(), nl = 1 + Math.floor(R() * 2.2), L = Array.from({ length: 12 }, () => R());
      const p = projectToSurface(body, q);
      const v = nearest(p);
      if (!allowed(v)) continue;
      const r = (0.045 + 0.07 * rr) * (params.spotSize ?? 1) * (region[v] === 2 ? 0.55 : 1);
      if (region[v] !== 2 && !clearOf(p, 1.3 * r)) continue;
      if (spots.some((s) => Math.hypot(p[0] - s.p[0], p[1] - s.p[1], p[2] - s.p[2]) < (r + s.r) * 1.15)) continue;
      const lobes = [{ c: p, r }];
      for (let j = 0; j < nl; j++) {
        const d = [L[j * 4] - 0.5, L[j * 4 + 1] - 0.5, L[j * 4 + 2] - 0.5], dl = Math.hypot(...d) || 1;
        lobes.push({ c: add(p, mul(d, (0.55 * r) / dl)), r: r * (0.45 + 0.3 * L[j * 4 + 3]) });
      }
      spots.push({ p, r, lobes });
    }
  }
  const beltF = params.belt ? params.belt[0] : -0.055, beltB = params.belt ? params.belt[1] : 0.02;
  // patternSD(v) < 0: the second colour (spots: black; belt / points: white)
  const patternSD = (v) => {
    const p = P(v), r = region[v], lb = legBone[v];
    if (breed === 'spotted') {
      // (none on the ears either: a spot running onto the pink leaf's root read as a dark smudge above the eye)
      if (!offSnout(v) || tagOf[v] === 'teat' || r === 5) return 1;
      let d = 1;
      for (const s of spots) for (const l of s.lobes) d = Math.min(d, Math.hypot(p[0] - l.c[0], p[1] - l.c[1], p[2] - l.c[2]) - l.r);
      // (a coarse wander of the outline and a fine hairy fray)
      return d + rag(p, 12, 0.06) + rag(p, 45, 0.012);
    }
    if (breed === 'hampshire') {
      if (r === 7 || r === 6 || r === 5 || r === 4) return 1;
      // white belt: over the shoulders, down both forelegs and the chest, forward up the neck to the head
      // (the head and ears black): the front edge is a plane across the head behind the eyes (head-local
      // z = beltF), where the skin rides on the skull. On the neck, any edge sat in the skin that
      // stretches most (a lying pig's neck bends sideways to lay its head down: 65-78 % of the edge
      // triangles stretched > 1.5x, against 15 % here); the back edge at mid-ribcage (none stretched)
      if (lb >= 0 && isFront[lb] && legness[v] > 0.4) return -0.03;
      const zb = beltB + 0.05 * (p[1] - 0.45);
      const h = HL(p);
      // (and a black cap over the poll to behind the ears, so the ears stand in black skin)
      const cap = Math.min(h[1] - 0.025, h[2] + 0.115);
      const d = Math.max(Math.max(h[2] - beltF, cap), zb - p[2]);
      return d + rag(p, 18, 0.03);
    }
    if (breed === 'berkshire') {
      if (r === 7) return -0.02;
      const h = r === 2 || r === 6 ? HL(p) : null;
      if (h) {
        // blaze: a white stripe down the face widening onto the snout
        const w = 0.012 + 0.03 * smoothstep(0.05, 0.16, h[2]) * (params.blaze ?? 1);
        // (the white snout's rear edge slants forward toward the chin: the jaw behind the mouth corner stays black)
        const snoutEdge = 0.08 + 0.5 * Math.max(0, -0.03 - h[1]);
        // (the blaze on the face only: on the jaw its midline drew a white bar down the chin)
        return Math.min(r === 6 ? 1 : Math.abs(h[0]) - w, snoutEdge - h[2]) + rag(p, 30, 0.012);
      }
      if (r === 4) return (0.55 - tailT[v]) * 0.05 + rag(p, 40, 0.004);
      if (lb >= 0 && legness[v] > 0.2) {
        const top = isFront[lb] ? 0.13 : 0.14;
        return p[1] - top * (params.socks ?? 1) + rag(p, 25, 0.03);
      }
      return 1;
    }
    return 1;
  };

  // --- ventral factor (lighter belly, inner legs)
  const ventral = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const n = N(v), r = region[v], p = P(v);
    let w = 0;
    if (r <= 2 || r === 6) w = smoothstep(-0.2, -0.8, n[1]) * smoothstep(0.55, 0.35, p[1]);
    ventral[v] = w;
  }

  // --- comb (bristle flow)
  const comb = new Float32Array(nV * 3);
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const bone = BONES[dominant[v]];
    let d;
    if (r === 5) d = norm(sub(bone.tail, bone.head));
    else if (r === 2 || r === 6 || r === 7) {
      // face: back from the snout, then down and back over the jowls
      const h = HL(p);
      d = norm(add(mul(HZ, -1), add(mul(HY, -0.35 * Math.sign(h[1] + 0.02)), [Math.sign(h[0]) * 0.25, 0, 0])));
      if (h[2] < -0.04) d = norm(add(d, [0, -0.4, -0.5]));
    } else if (r === 4) {
      d = norm(sub(bone.tail, bone.head));
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = rig.AXIAL.points[seg], b = rig.AXIAL.points[Math.min(seg + 1, rig.AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.5 * Math.abs(n[0]), 0]));
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
    // tusks: combed along the tusk (the keratin shader's striations run along the comb: combed like the face they
    // ran across the tusk as crinkled bark rings)
    const rnv = rname[partOf[v]];
    if ((rnv === 'tuskL' || rnv === 'tuskR') && tuskSegs.length) {
      let best = Infinity;
      for (const sg of tuskSegs[rnv === 'tuskL' ? 0 : 1] || tuskSegs[0]) {
        const ab = sub(sg.b, sg.a), u = clamp(dot(sub(p, sg.a), ab) / Math.max(1e-9, dot(ab, ab)), 0, 1);
        const dd = len(sub(p, add(sg.a, mul(ab, u))));
        if (dd < best) { best = dd; d = norm(ab); }
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
  const mud = params.mud || 0;
  // (bristles: at medium and low 8-16 shells draw each one as a dot, a pepper over the skin: shorter there)
  // (a piglet's fine hair about as long as an adult's bristles: at 0.45x, 1.3-1.5 mm, every shell drew it at the
  // same place and it piled up into a crisp white speck: 9.5 % bright specks on a piglet's cheek; it
  // is also finer and denser, index.js render())
  const bristleK = (params.bristle ?? 1) * (piglet ? 0.9 : 1) * (breed === 'duroc' ? 1.15 : 1) * (ctx.Q && ctx.Q.res > 1.5 ? 0.5 : 1);
  const dark = COL.dark;
  const pink = !dark && BASE_OF[breed] === 'pink';
  // satin-matte skin under the bristles (0.3 read as vinyl on pink and latex on black skin; black 0.08 still
  // made bright specular sheets in the sun)
  // (black skin below 0: the shader reads a bare skin's gloss only for its roughness, mix(0.62, 0.3, gloss), so
  // -0.4 is roughness 0.75, a dull matte black; at 0.03 (0.61) a Berkshire in the sun showed two broad grey sheen
  // patches on shoulder and rump)
  // (pink and red skin smooth and slightly glossy)
  const SKIN_GLOSS = dark ? -0.4 : pink ? 0.24 : 0.2;
  const SPOT_GLOSS = -0.3; // (the Old Spot's dark spots: the black breeds' matte, roughness 0.71) // (the Duroc's red skin under its denser red hair: satin, 0.24 read as leather)
  // the rostral disc: its colour blends in along the head axis over the last 2 cm before the plate's face
  // (a per-vertex switch at the snout bone's region drew a jagged edge)
  const snoutK = (params.snoutLen ?? 1) * SNOUT_K;
  const DZ = 0.06 + (0.178 - 0.06) * snoutK;
  const discOf = (h) => smoothstep(DZ - 0.02, DZ - 0.002, h[2]);

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v], tag = tagOf[v];
    // (sy: surf.y, for bare skin the share of the light that shines through when lit from behind: index.js
    // render.skinTrans; 0 on the thick body)
    let col, mat = MAT.SKIN, fl = 0.012, gloss = SKIN_GLOSS, sy = 0, lashW = 0, nostrilK = 0, nostrilCol = null, veinSD = 1, veinCol = null, earRimK = 0;
    const lb = legBone[v];
    const lbName = lb >= 0 ? BONES[lb].name : '';
    const up = clamp(n[1], -1, 1);
    if (r === 0 || r === 1) {
      col = mix3(COL.body, COL.dorsal, smoothstep(0.3, 0.95, up) * 0.7);
      col = mix3(col, COL.belly, ventral[v]);
      // bristles: longer along the dorsal midline (the "mane" of the back), shorter low down
      // (fine bristles lying along the skin, long enough for the silhouette fins (>= 5.8 mm):
      // fine sparse pale bristles visible mostly in silhouette and up close)
      fl = mix(0.0065, 0.01, smoothstep(0.75, 0.97, up) * smoothstep(0.05, 0.015, Math.abs(p[0])));
      fl = mix(fl, 0.004, ventral[v]);
      const L = legness[v];
      if (L > 0) {
        fl = mix(fl, mix(0.0025, 0.004, smoothstep(0.12, 0.4, p[1])), L);
        // lower legs a touch more flushed (thin skin over the tendons)
        if (pink) col = mix3(col, COL.flush, 0.25 * smoothstep(0.3, 0.1, p[1]) * L);
      }
      // hooves, heel bulbs and dew claws below the coronet line
      const Cj = /hoof|paw/.test(lbName) ? J[(lbName[0] === 'f' ? 'fcoffin' : 'hcoffin') + BONES[lb].side] : null;
      if (Cj && (tag === 'hoof' || tag === 'heelbulb' || tag === 'dewclaw') && (tag === 'dewclaw' || p[1] < Cj[1] + 0.009 + 0.3 * (p[2] - Cj[2]) * (lbName[0] === 'f' ? 1 : 1))) {
        mat = MAT.KERATIN; fl = 0; gloss = -0.3;
        const streak = smoothstep(0.45, 0.65, fbm3(p[0] * 140 + (params.coatSeed % 97), p[1] * 9, p[2] * 140, 2));
        col = pink ? mix3(COL.hoof, mul(COL.hoof, 0.55), 0.35 * streak) : mix3(COL.hoof, mul(COL.hoof, 1.5), 0.3 * streak);
        if (tag === 'heelbulb') col = mix3(col, pink ? srgb(0xc89c8a) : mul(col, 0.8), 0.5);
      }
      if (tag === 'teat') { col = pink ? srgb(TEAT) : mix3(COL.body, srgb(0x6a5050), 0.3); fl = 0; gloss = 0.4; }
      if (tag === 'scrotum' || tag === 'sheath') { col = mix3(col, COL.flush, pink ? 0.35 : 0.1); fl = 0.005; }
    } else if (r === 4) {
      col = mix3(COL.body, COL.dorsal, 0.4);
      fl = 0.004 + 0.02 * smoothstep(0.8, 1, tailT[v]); // the terminal tuft
      sy = 0.3 + 0.3 * tailT[v]; // (thin: the light shines through it, render.skinTrans)
      if (pink) col = mix3(col, COL.flush, 0.15);
    } else if (r === 5) {
      // ears: thin skin, flushed and translucent in pink pigs (inner pinna redder), fine short hair
      // (the hollow side: the nearest leaf tile's normal, which earShape points into the hollow)
      let dn = 1e9, tile = null;
      for (const q of lists[v]) if (q.tag === 'ear') { const d = Math.abs(SDFModel.dist(q, p[0], p[1], p[2])); if (d < dn) { dn = d; tile = q; } }
      const faceDir = tile ? [tile.P[9], tile.P[10], tile.P[11]] : [0, 0, 1];
      const inner = dot(n, faceDir) > 0.2;
      // how far out along the ear (0 root .. 1 tip)
      const eb = BONES[dominant[v]], ev = sub(eb.tail, eb.head);
      const sE = clamp(dot(sub(p, eb.head), ev) / Math.max(1e-6, dot(ev, ev)), 0, 1);
      // (pink ears, face1 / front1 / face2: the inner pinna a light, bright pink, redder deep in the hollow at
      // the base (the research's backlit #E8998C); the renderer's red subsurface darkens it in shade, so the
      // albedo is kept light: sampled #E8998C everywhere rendered brick red)
      // (the colour switched at a fixed angle on the rim, which drew the rim as a cut edge round a
      // slab; now graded across the rounded rim, so the two faces turn into each other)
      const inCol = pink ? mix3(srgb(0xe8a098), srgb(0xf2bcb2), smoothstep(0.08, 0.55, sE)) : mul(mix3(COL.ear, COL.flush, 0.1), dark ? 1 : 1.06);
      const outCol = mix3(COL.ear, COL.body, 0.5);
      const kin = smoothstep(-0.45, 0.6, dot(n, faceDir));
      col = mix3(outCol, inCol, kin);
      // (short, skin-coloured hair in the hollow: longer pale hair there frosted the pink hollow with white
      // specks in the studio light, hero)
      // (and almost none in the hollow itself: at hero the key light's strand glints frosted the pink hollow white, and the
      // Duroc's sparser, coarser hair drew a grey speckle over it; the rim fringe below stays)
      fl = mix(0.003, 0.0022, kin) * (1 - 0.85 * kin);
      // (a soft fringe of longer hair along the rim, where the leaf's surface turns edge-on: a thin hard outline
      // read as cut paper; face3's Duroc ears are hairy at the edge)
      const rimK = 1 - smoothstep(0.3, 0.7, Math.abs(dot(n, faceDir)));
      // (a shorter fringe; the 5.5 mm rim hair drew the edge as a frayed slab)
      // (shorter again, 3 / 4.5 mm: the Duroc's 6.5 mm red-gold fringe and hollow hair drew a frosted, torn edge)
      // (the Duroc's 4.5 mm fringe, in strands darker than the skin, drew the rim as a torn edge with a
      // dark speckle in the showcase; 3.2 mm in the body's red-gold)
      // (almost none on the pink ears: their fine pale fringe, seen against a shaded head or the sky, drew a
      // speckled frayed rim on the Large White and Landrace in the showcase; lw_show / head_gifu show a clean rim)
      fl = mix(fl, breed === 'duroc' ? 0.0032 : pink ? 0.0012 : 0.003, rimK);
      earRimK = rimK;
      // veins on the back of the leaf (pink ears: head_gifu, head_hausschwein5, lw_show: a few dark-pink veins from
      // the root toward the tip, branching outward; they show most against the light, render.skinTrans): drawn in
      // the pattern channel (per pixel: per-vertex paint on the 3 mm ear cells came out as blobs)
      if (pink && kin < 0.2 && rimK < 0.3) {
        const evn = norm(ev), Le = len(ev), lat = norm(cross(evn, faceDir));
        const q = sub(p, eb.head), u = dot(q, evn) / Le;
        const w = dot(q, lat) / Le + 0.008 * (fbm3(p[0] * 35 + off[0], p[1] * 35, p[2] * 35, 2) - 0.5);
        veinSD = earVeinSD(u, w * (p[0] > 0 ? 1 : -1), params.coatSeed || 0) * Le;
        veinCol = mul3(col, [0.9, 0.74, 0.78]);
        // (the back of the leaf nearly hairless: the tint here is the vein's colour, and the shells draw hair in it)
        fl = 0;
      }
      gloss = dark ? 0.08 : 0.12;
      // thin skin: the light shines through the leaf, most toward the tip (render.skinTrans; research 6: "ears
      // are thin and translucent, strong red backlight")
      // (above 0.9 the skin shader also passes the light that falls on the other face through the leaf,
      // tinted by render.skinScatter: an ear turned away from the sun glows pink instead of the dark maroon of the
      // shade; at 0.35-0.8 only the view-dependent back-light term applied)
      // (only the pink ears: the Duroc's red and the black breeds' pigmented leaves passed the sun through
      // as a pale grey-pink hollow, a pale speckled strip along the rim seen edge-on; they keep the back-light glow only)
      sy = pink ? mix(0.92, 1.0, smoothstep(0.1, 0.8, sE)) : mix(dark ? 0.3 : 0.5, dark ? 0.5 : 0.75, smoothstep(0.1, 0.8, sE));
    } else if (r === 7) {
      // rostral disc: moist, glossy, finely pitted; the snout skin behind it blends in along the head axis.
      // Skin material throughout (nose leather next to skin interpolated through the lid and mouth ids:
      // a red ring round a dark disc)
      const h = HL(p);
      const dw = discOf(h);
      const face = dw * smoothstep(0.2, 0.6, dot(n, HZ));
      const snoutCol = mix3(mix3(COL.body, COL.dorsal, smoothstep(0.3, 0.95, up) * 0.7), COL.belly, ventral[v]);
      col = mix3(pink ? mix3(snoutCol, COL.flush, 0.25) : snoutCol, mix3(COL.disc, pink ? COL.flush : COL.disc, 0.2), dw);
      fl = mix(0.003, 0, dw);
      gloss = mix(SKIN_GLOSS, 0.6, face);
      let nk = 0;
      for (const e of nostrilPrims) {
        const dn = SDFModel.dist(e, p[0], p[1], p[2]);
        if (dn < 0.002) nk = Math.max(nk, smoothstep(0.002, 0.0002, dn));
        // (and whatever lies recessed beside it: the carve's fillet at the inner upper end left a patch of disc colour
        // inside the opening)
        if (dn < 0.006) nk = Math.max(nk, smoothstep(0.001, 0.004, DZ + 0.012 - h[2]) * smoothstep(0.006, 0.002, dn));
      }
      if (nk > 0) {
        // (darker with depth: the floor of a nostril, lit straight on, read as the pale centre of a dark ring; the
        // nostril's colour also goes into the marking tint below, the Berkshire's white snout covered them as
        // pale lilac dimples)
        const depth = DZ + 0.012 - h[2];
        const deep = smoothstep(0.002, 0.014, depth);
        nostrilCol = mix3(dark ? mul(COL.disc, 0.4) : srgb(NOSTRIL), dark ? srgb(0x140a0a) : srgb(0x2a1214), deep);
        // (matt in the depth: a glossy floor caught the light as a pale glint in the middle of the pit)
        col = mix3(col, nostrilCol, nk); gloss = mix(gloss, dark ? -0.4 : mix(0.1, -0.2, deep), nk); fl *= 1 - nk; nostrilK = nk;
      }
    } else {
      // head & jaw
      const h = HL(p);
      col = mix3(mix3(COL.body, COL.dorsal, smoothstep(0.3, 0.95, up) * 0.7), COL.belly, ventral[v]);
      fl = 0.003; // (fine short hair on the face)
      // bristly jowls and cheeks; short hair on the snout
      if (h[2] < 0.02 && h[1] < -0.02) fl = mix(fl, 0.007, smoothstep(-0.02, -0.07, h[1]));
      fl = mix(fl, 0.003, smoothstep(0.08, 0.16, h[2]));
      if (pink) col = mix3(col, COL.flush, 0.25 * smoothstep(0.06, 0.17, h[2]));
      if (r === 2) col = mix3(col, mix3(COL.disc, pink ? COL.flush : COL.disc, 0.2), discOf(h));
      // eye rims (lid skin, no hair: a pink or dark margin, face1) and the pale lashes of the upper lid
      for (let e = 0; e < eyePrims.length; e++) {
        const pr = eyePrims[e], ec = eyeFrames[e].c;
        if (Math.hypot(p[0] - ec[0], p[1] - ec[1], p[2] - ec[2]) > 0.03) continue;
        const de = Math.abs(SDFModel.dist(pr, p[0], p[1], p[2]));
        // (the lid margin a pink rim and the skin round the eye a little flushed on the pink breeds: front1, face2)
        if (pink && de < 0.014) col = mix3(col, COL.flush, 0.42 * (1 - smoothstep(0.003, 0.014, de)));
        if (de < 0.003) { fl = 0; col = dark ? mul(COL.body, 0.6) : mix3(col, COL.flush, 0.55 * (1 - smoothstep(0.002, 0.003, de)) + 0.25); gloss = 0.5; }
        else if (de < 0.0115) {
          const ef = eyeFrames[p[0] > 0 ? 0 : 1];
          const rel = sub(p, ef.c);
          const upAmt = dot(rel, ef.y) / 0.011;
          // short fine hair on the lids, growing from the margin (no step at the rim)
          fl = Math.min(fl, mix(0.0012, 0.004, smoothstep(0.002, 0.0095, de)));
          if (lashes && upAmt > 0.15) {
            // lashes: a pale fringe standing up and out from the upper lid (face1), longest mid-lid and
            // tapered to both corners; they rise from the margin no faster than the skin runs (shells
            // cannot draw single lashes: a long band combed over the eye read as a fuzzy blob). They
            // stay bristles on the skin material (a fur-material band drew a black stepped outline: the
            // interpolated material id passes 1-3 between fur 0 and skin 4), their colour from the tint
            // (also tapered toward the corners across the eye: past the corners the lid patch rises
            // above upAmt 0.15 too, and a tuft of long pale lashes there caught the back light as a white fleck)
            const xc = Math.abs(dot(rel, ef.x));
            const along = smoothstep(0.15, 0.55, upAmt) * (1 - smoothstep(0.004, 0.0095, xc));
            // (up to 7.5 mm mid-lid, a clear pale fringe; the band ends 2 mm inside the eyelid patch and
            // fades back to the lid hair over 3 mm, no faster than the skin runs)
            const L = Math.min(0.0075, 0.95 * (de - 0.0018)) * along;
            const k = smoothstep(0.0085, 0.0115, de);
            const Lf = mix(L, fl, k);
            if (Lf > fl) {
              fl = Lf; lashW = along * (1 - k);
              const lash = norm(add(add(mul(ef.y, 0.7), mul(norm(rel), 0.5)), mul(ef.z, 0.3)));
              let t = sub(lash, mul(n, dot(lash, n)));
              if (len(t) > 1e-4) { t = norm(t); comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2]; }
            }
          }
          // the lid folds (eye_lwshow_R, eye_mochyn: a soft crease above the upper lid's roll and a
          // fainter one under the lower lid, running out past the corners): darker skin in thin bands, painted on the
          // fine eyelid patch
          const xr = Math.abs(dot(rel, ef.x)), along = smoothstep(0.0125, 0.006, xr);
          const fold = upAmt > 0 ? Math.exp(-(((de - 0.0045) / 0.0011) ** 2)) * 0.2 : Math.exp(-(((de - 0.0036) / 0.0009) ** 2)) * 0.1;
          col = mul(col, 1 - fold * along);
          // (at medium and low, where no lashes are drawn, a pale lash line along the upper lid's margin)
          if (!lashes && !dark && upAmt > 0.2) col = mix3(col, srgb(0xf6efe6), 0.45 * smoothstep(0.2, 0.5, upAmt) * (1 - smoothstep(0.0032, 0.0048, de)));
        }
      }
      // lips: head vertices near the jaw surface, jaw vertices near the head surface. Only the mouth line is
      // drawn: where the upper lip overhangs the lower one (the other surface lies above / below this vertex),
      // in front of the mouth corner and fading out over the last 2 cm to it (face1: a short crease rising a
      // little to the corner). The line is the mark channel (interpolated per pixel: a crease painted per
      // vertex in a band narrower than a face cell drew a sawtooth), with a soft flush of lip skin beside it.
      // Where the chin's sides and underside meet the throat nothing is painted (a dark crease all round the
      // jaw outlined it as a separate slab). The mucosa only on the underside of the upper lip, facing the jaw.
      if (r !== 6) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (h[2] > 0.03 && h[1] < -0.04 && dj < 0.008) {
          const q = sub(p, mul(HY, 0.006));
          const lipK = (SDFModel.evalList(jawPrims, q[0], q[1], q[2]) < dj ? 1 : 0) * smoothstep(-0.086, -0.078, h[1]) * smoothstep(LIP_Z0, LIP_Z0 + 0.02, h[2]);
          fl = mix(fl, Math.min(fl, 0.002 * smoothstep(0.001, 0.005, dj)), lipK);
          if (pink) col = mix3(col, COL.flush, 0.3 * lipK * smoothstep(0.008, 0.002, dj));
          // (a line along the lip margin, dj = 0, not the whole overlap under the lip: a filled mark showed as dark
          // scribbles at the mouth corners when the mouth opened)
          if (lipK > 0) markSDF[v] = mix(0.003, Math.abs(dj) - LIP_W, lipK);
          // the roof of the mouth (hidden by the lower lip until the mouth opens): mucosa, graded in by the depth
          // inside the lower lip, in the skin material (a switch to the mouth material drew its boundary in steps,
          // and its wet coat mirrored the sky: a white plate in an open mouth)
          // (deeper in, the roof a darker, matte red: it faces down into the mouth, which no light reaches;
          // a glossy roof mirrored the sky blue-white, the mouth material's clear coat included). The roof also
          // where the jaw lies just below the skin (not inside it), in front of the mouth corner: it shows when
          // the mouth opens (painted skin there read as a pale plate)
          let jb = 1;
          if (-dot(n, HY) > 0.3 && h[2] > LIP_Z0) for (const dd of [0.004, 0.009, 0.015, 0.022]) { const q2 = sub(p, mul(HY, dd)); if (SDFModel.evalList(jawPrims, q2[0], q2[1], q2[2]) < 0) { jb = dd; break; } }
          const roof = jb < 1 ? smoothstep(0.024, 0.012, jb) * smoothstep(LIP_Z0, LIP_Z0 + 0.015, h[2]) * smoothstep(0.3, 0.6, -dot(n, HY)) : 0;
          // (and the upper face of the skin sheet under the chin that rides on the jaw, sculpt.js 'underjaw': it is
          // the floor of the open mouth behind the lower lip)
          let wj = 0;
          for (let k = 0; k < 4; k++) if (skinIndex[v * 4 + k] === JAW_BONE) wj += skinWeight[v * 4 + k];
          const floor = smoothstep(0.3, 0.7, wj) * smoothstep(0.1, 0.4, dot(n, HY));
          const mu = Math.max(smoothstep(-0.001, -0.007, dj), roof, floor), deep = Math.max(smoothstep(-0.006, -0.016, dj), 0.6 * roof, 0.8 * floor);
          // (the palate deeper in a ridged dusky pink rather than near black: it faces down into the mouth, which little
          // light reaches, and read as a flat black slot when the mouth opened)
          if (mu > 0) { col = mix3(col, mix3(MUCOSA, mul(MUCOSA, 0.6), deep), mu); fl *= 1 - mu; gloss = mix(gloss, mix(0.3, 0.05, deep), mu); }
        }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (tag === 'tongue') { mat = MAT.SKIN; fl = 0; gloss = 0.45; col = mix3(srgb(TONGUE), mul(srgb(TONGUE), 0.75), smoothstep(0.03, 0.1, -h[2] + 0.12)); }
        else if (tag === 'tusk') {
          mat = MAT.SKIN; fl = 0; gloss = 0.85; // (smooth enamel: skin material with no hair; the keratin shader's growth rings and striations, made for horn and hoof, crinkled the thin tusk like bark)
          const E = tuskEnds[p[0] > 0 ? 0 : 1] || tuskEnds[0];
          const t = E ? clamp(1 - len(sub(p, E.tip)) / Math.max(1e-4, len(sub(E.root, E.tip))), 0, 1) : 1;
          col = mix3(srgb(TUSK_ROOT), srgb(TUSK), smoothstep(0.25, 0.85, t));
        }
        // the floor of the mouth and the inside of the lower lip: mucosa on the jaw's upper face, graded in by the
        // depth inside the upper lip (skin material, as above); where the chin's sides and underside run into the
        // head it stays skin (red there bled along the whole intersection and outlined the jaw as a slab)
        else if (dh < 0.0) {
          const mu = smoothstep(-0.001, -0.007, dh) * smoothstep(0.1, 0.4, dot(n, HY));
          fl = Math.min(fl, 0.002) * (1 - mu);
          if (mu > 0) { col = mix3(col, MUCOSA, mu); gloss = mix(gloss, 0.3, mu); }
        } else if (dh < 0.008) {
          const q = add(p, mul(HY, 0.006));
          const lipK = (SDFModel.evalList(headPrims, q[0], q[1], q[2]) < dh ? 1 : 0) * smoothstep(-0.086, -0.078, h[1]) * smoothstep(LIP_Z0, LIP_Z0 + 0.02, h[2]);
          fl = mix(fl, Math.min(fl, 0.002), lipK * smoothstep(0.008, 0.004, dh));
          if (pink) col = mix3(col, COL.flush, 0.3 * lipK * smoothstep(0.008, 0.002, dh));
        }
      }
    }
    // skin creases: folds across the neck behind the jowls, over the knees and hocks (darkened tint
    // in thin lines, deeper in older / fatter pigs)
    if (mat === MAT.SKIN && (r === 1 || r === 0 || r === 2 || r === 7) && !piglet) {
      let crease = 0;
      // (wrinkles kept only where real (snout base, neck); drawn only where the cells are fine enough for a
      // fold a few mm wide: hero and high)
      const fineK = !ctx.Q || ctx.Q.res <= 1.35 ? 1 : 0;
      const wr = 0.6 + 0.6 * (params.wrinkles ?? 0.5);
      if (fineK && r === 1 && mat === MAT.SKIN) {
        // neck folds: two or three soft folds round the side and underside of the neck behind the jowls (lw_show,
        // head_pietrain), ~3 cm apart, fading out over the top of the neck
        const sN = axialS[v] - sOcc;
        const ph = (sN + 0.012 * (fbm3(p[0] * 25 + off[1], p[1] * 25, p[2] * 25, 2) - 0.5)) / 0.03;
        const fr = Math.abs(ph - Math.round(ph));
        crease = Math.exp(-(((fr * 0.03) / 0.0045) ** 2)) * smoothstep(0.015, 0.035, sN) * smoothstep(0.13, 0.08, sN) * smoothstep(0.5, -0.1, n[1]) * 0.55 * wr;
      }
      if (fineK && (r === 2 || r === 7) && mat === MAT.SKIN && nostrilK === 0) {
        // the snout base: three or four transverse folds over the top of the snout a few cm behind the disc (face1,
        // lw_show, head_hausschwein5), slightly arched, fading out down the sides
        const h = HL(p), dz = DZ - h[2] + 6 * h[0] * h[0];
        const ph = (dz + 0.003 * (fbm3(p[0] * 40 + off[0], p[1] * 40, p[2] * 40, 2) - 0.5)) / 0.0095;
        const fr = Math.abs(ph - Math.round(ph));
        crease = Math.exp(-(((fr * 0.0095) / 0.0018) ** 2)) * smoothstep(0.015, 0.025, dz) * smoothstep(0.065, 0.04, dz) * smoothstep(0.15, 0.55, dot(n, HY)) * 0.5 * wr;
      }
      if (legness[v] > 0.5 && lb >= 0) {
        const jn = isFront[lb] ? J['wrist' + BONES[lb].side] : J['hock' + BONES[lb].side];
        const dy = p[1] - jn[1];
        const ph = Math.abs((dy / 0.012) % 1);
        crease = Math.max(crease, smoothstep(0.2, 0.0, Math.min(ph, 1 - ph)) * smoothstep(0.03, 0.01, Math.abs(dy)) * 0.7 * (params.wrinkles ?? 0.5));
      }
      if (crease > 0) col = mul(col, 1 - 0.28 * Math.min(1, crease));
    }
    // Colours. The shells draw a bristle in 70 % of the vertex tint and 30 % of the albedo under it, so the
    // skin itself is carried by the pattern channel and the tint is the BRISTLE colour: pale bristles on pink
    // skin (face1: a soft white haze, not a dark pepper), golden on the Duroc, black on black skin, white on
    // white markings. pattern < 0 (inside) shows patternColor = the skin; outside a marking's edge (belt,
    // points, spots: pdRaw < 0) the tint shows, so near a marking the tint is the marking's colour (its
    // bristles fray over the edge: a hairy boundary) and the crisp edge still comes from the distance field.
    const CAP = 0.02;
    let pdRaw = 1;
    let second = breed === 'spotted' ? COL.spot : COL.white;
    if ((mat === MAT.SKIN || mat === MAT.FUR) && breed !== 'largewhite' && breed !== 'landrace' && breed !== 'duroc') pdRaw = patternSD(v);
    if (breed === 'berkshire' && (r === 7 || r === 2)) second = mix3(second, srgb(0xe2b4aa), 0.7 * discOf(HL(p)));
    if (nostrilK > 0) second = mix3(second, nostrilCol, nostrilK);
    // (the Old Spot's spots and the Hampshire's belt are painted per vertex in the skin's own colour channel,
    // graded over 2-3 cm (gos_1: the spots' edges are soft, the pale hair over the dark skin), with the bristles following
    // the skin under them. Drawn as a crisp per-pixel pattern edge, with the marking's colour in the tint that also colours
    // the bristles, the spots read as holes cut in the skin, ringed by a halo of grey and white bristles: the tint changes
    // over a whole cell beside an edge 1 mm wide. The spots also matte (the pink skin's satin over a dark albedo mirrored
    // the sky as a grey sheen))
    const col0 = col;
    let softK = -1;
    if (pdRaw < 1 && (breed === 'spotted' || breed === 'hampshire')) {
      const cellM = (CELL[rname[partOf[v]]] || 0.0078) * (ctx.Q ? ctx.Q.res : 1);
      const Wv = Math.max(r === 2 || r === 6 ? 0.007 : 0.011, Math.min(1.1 * cellM, 0.016)); // (capped: at low and crowd a ramp of a whole cell blurred the spots into grey blobs)
      softK = smoothstep(Wv, -Wv, pdRaw);
      col = mix3(col, second, softK);
      if (breed === 'spotted') gloss = mix(gloss, SPOT_GLOSS, softK);
    }
    // (the bristle a little paler than the skin it grows from, not a white dot: at 1-3 m they blend into a
    // faint pale haze over pink skin, face1; 1.6 mm white dots on a 5.5 mm grid read as frost)
    // (a piglet's fine hair the same: on its finer strand grid, index.js render(), it is a pale velvet, front2)
    // (the Duroc's red-gold hair, face3: redder than the skin is dark: a fine pale speckle like sandpaper)
    // (the pale tint, mix 0.4 toward #F4EFE6, covered the face in white speckle; the shells draw a
    // bristle in 0.7 x (tint x 1.1 + 0.03) + 0.3 x the skin, so this tint makes it the skin's colour a few per cent
    // paler: the bristles show in the silhouette fins and against the light, not as dots over the lit skin)
    const skinMatch = (c, k) => mix3([Math.max(0, 0.93 * c[0] - 0.027), Math.max(0, 0.93 * c[1] - 0.027), Math.max(0, 0.93 * c[2] - 0.027)], srgb(0xf4efe6), k);
    // (the hair shader draws a bristle at ~0.85 of its albedo (strand shade 0.8-0.98, root 0.9) and lights it
    // as hair, so a tint at the skin's own colour drew dark dashes over the lit face; 1.22 x the skin puts the lit bristle a
    // touch paler than the skin under it: pale hairs up close, no pepper)
    const paleMatch = (c) => mix3([Math.min(0.97, 1.22 * c[0] - 0.027), Math.min(0.97, 1.22 * c[1] - 0.027), Math.min(0.97, 1.22 * c[2] - 0.027)], srgb(0xf8f4ee), 0.12);
    // (the Duroc's ear hair the body's red-gold too: the darker skin-matched strands specked the rim)
    // (the pink ears' rim fringe in the pale body tint: skin-matched strands, drawn a little darker than the skin by
  // the hair shader, outlined the Large White's and Landrace's rims with a speckled reddish fringe in the showcase)
    let bristle = pink ? (r === 5 ? mix3(skinMatch(col0, 0.05), paleMatch(col0), earRimK) : paleMatch(col0)) : dark ? COL.bristle : mix3(skinMatch(col0, 0), srgb(0xc89064), 0.3);
    // (in a spot, black hair a little darker than its skin, as on the black breeds; in the belt, white hair)
    if (softK > 0) bristle = mix3(bristle, breed === 'spotted' ? mul(second, 0.6) : second, softK);
    // (the lashes whiter than the body bristles: a pale fringe on the upper lid, face1)
    if (lashW > 0 && !dark) bristle = mix3(bristle, srgb(pink ? 0xf2eae2 : 0xd8b890), lashW);
    // mud (threequarter2, face3): only caked on the hooves and pasterns, dried pale grey or still wet and dark
    // (the blotches and splashes on the belly, flanks and snout read as a dirty, blotchy skin; a
    // clean pig's skin is an even pink)
    if (mud > 0 && mat !== MAT.MOUTH && tag !== 'tusk' && r !== 5 && r !== 4 && r !== 7 && r !== 2 && r !== 6) {
      const nz = (f, o) => fbm3(p[0] * f + off[0] + o, p[1] * f + off[1], p[2] * f + off[2] - o, 3);
      const caked = smoothstep(0.075, 0.035, p[1] + 0.02 * (nz(9, 3) - 0.5));
      const mk = clamp(caked * Math.min(1, 1.6 * mud), 0, 0.85);
      if (mk > 0) {
        const mc = mix3(srgb(MUD), srgb(MUD_DRY), smoothstep(0.4, 0.65, nz(5, 9)));
        // (the bristles caked faster than the skin and flattened: black ones drew a black pepper over pale mud)
        col = mix3(col, mc, mk); second = mix3(second, mc, mk); bristle = mix3(bristle, mul(mc, 0.9), Math.min(1, 1.6 * mk));
        gloss = mix(gloss, 0.05, mk); fl *= 1 - 0.65 * mk;
      }
    }
    // (black bristles on black skin read as a glitter of strand highlights: shorter)
    if (dark && mat === MAT.SKIN && softK >= 0) fl *= mix(0.26, 1, softK);
    else if (dark && mat === MAT.SKIN && pdRaw > 0) fl *= 0.26;
    // (and the spots' black hair shorter, sparse on the dark skin: a glitter of strand highlights otherwise)
    if (breed === 'spotted' && softK > 0) fl *= mix(1, 0.5, softK); // (0.3 on the 6000 /m grid: a grey glitter of strand highlights over the black skin; 0.18 left it bare like latex)
    // faint, broad warm variation of the skin (a +-10 % red fbm at 17 cm read as dirty blotches)
    const cv = fbm3(p[0] * 3 + off[2], p[1] * 3, p[2] * 3, 2) - 0.5;
    if (mat === MAT.SKIN && r !== 7) col = [col[0] * (1 + 0.035 * cv), col[1] * (1 + 0.012 * cv), col[2] * (1 + 0.012 * cv)];
    if (mat === MAT.SKIN && fl > 0) fl *= bristleK;
    // (the tint turns to the marking's colour a body cell before its edge: the triangles across the edge
    // show it whole on the marking's side)
    // (one cell of the vertex's own surface: the face's 4 mm, not the body's 8: a white fringe 8-11 mm wide round the
    // Berkshire's blaze read as overspray at hero; outside the marking, where that tint lies over
    // the other skin, the bristles are almost gone: the skin's own pattern edge stays crisp and the per-vertex tint
    // cannot be narrower than a cell)
    // (Berkshire only: the spots and the belt are painted per vertex above, softK)
    if (softK >= 0) pdRaw = 1;
    const margin = (CELL[rname[partOf[v]]] || 0.0078) * 1.05 * (ctx.Q ? ctx.Q.res : 1);
    const mw = smoothstep(1.4 * margin, margin, pdRaw);
    // (none at all there: at 15 % length the white bristles of that band still sprinkled the black round the
    // Berkshire's blaze and the Hampshire's belt with white specks at hero)
    // (and fading in over the next cell out: the triangles from those vertices to the next ring blended the white tint
    // into the black skin's bristles, a grey halo)
    if (pdRaw < 1) fl *= 1 - smoothstep(2.6 * margin, 1.4 * margin, pdRaw) * smoothstep(-0.002, 0.002, pdRaw);
    // (and the marking's own bristles short in its last cell: the white ones there are drawn over the black pixels
    // just past the crisp edge, a sparkling halo)
    if (pdRaw < 0) fl *= mix(0.25, 1, smoothstep(-0.2 * margin, -1.2 * margin, pdRaw));
    const tc = mat === MAT.SKIN || mat === MAT.FUR ? mix3(bristle, second, mw) : col;
    pattern[v] = clamp(-pdRaw, -CAP, CAP); patInt[v] = 1;
    patCol[v * 3] = col[0]; patCol[v * 3 + 1] = col[1]; patCol[v * 3 + 2] = col[2];
    furLen[v] = fl;
    tint[v * 4] = tc[0]; tint[v * 4 + 1] = tc[1]; tint[v * 4 + 2] = tc[2]; tint[v * 4 + 3] = mat;
    // ear veins: the vein is the 'marking' (pattern > 0 shows the tint), the skin round it the pattern colour
    if (veinCol && pdRaw > 0.02 && !(softK > 0.05)) { pattern[v] = clamp(-veinSD, -CAP, CAP); tint[v * 4] = veinCol[0]; tint[v * 4 + 1] = veinCol[1]; tint[v * 4 + 2] = veinCol[2]; }
    surf[v * 4] = gloss; surf[v * 4 + 1] = sy;
  }
  smoothField(furLen, weights.neighbors, 2, (v) => tint[v * 4 + 3] !== MAT.SKIN);

  const patternColor = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) { patternColor[v * 4] = patCol[v * 3]; patternColor[v * 4 + 1] = patCol[v * 3 + 1]; patternColor[v * 4 + 2] = patCol[v * 3 + 2]; patternColor[v * 4 + 3] = patInt[v]; }
  void vnoise3; void TAIL_SEGS; void add;
  const perRegion = {};
  for (let v = 0; v < nV; v++) perRegion[rname[partOf[v]]] = (perRegion[rname[partOf[v]]] || 0) + 1;
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, stats: { spots: spots.length, perRegion }, region, ventral };
}
