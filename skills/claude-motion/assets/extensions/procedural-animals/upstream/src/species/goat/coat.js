// The goat's coat: breed colours (white Saanen, Alpine chamoisee / cou blanc / Toggenburg / British
// Alpine with the Swiss face stripes, pied, Nubian, Boer), countershading, the buck's long hair (mane,
// "pants" on the thighs), the beard and wattles, pink skin under white (nose, ears, udder), keratin
// horns with growth rings and cloven hooves, hair flow following the hair tracts.
// Works in the reference space (see rig.js); seeded variation picks the breed pattern and colours.
import { HEAD_O, HZ, HY, unFaceZ } from './rig.js';
import { hornPath, hornRidges, earFacing } from './sculpt.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, smoothField } from '../../core/build/coatKit.js';

// sRGB swatches sampled from the reference photos.
// base = body colour, dorsal / belly = countershading, head, mark = the breed's second colour
// (face stripes, points, patches), markRegions = which masks carry it.
export const COATS = {
  saanen: { base: 0xeeebdd, dorsal: 0xe8e4d4, belly: 0xf3f0e6, head: 0xefece0, mark: 0xeeebdd, masks: [], pink: 1 },
  chamoisee: { base: 0x906f4e, dorsal: 0x7e5f40, belly: 0x2a2320, head: 0x8a6848, mark: 0x221d1b, masks: ['stripes', 'facecentre', 'dorsal', 'legs', 'belly', 'ears', 'muzzle'] },
  coublanc: { base: 0xe2d9c6, dorsal: 0xd8ceb8, belly: 0xe6dfcf, head: 0x9a8c7c, mark: 0x1e1c1c, masks: ['rear', 'stripes', 'legsHind'] },
  toggenburg: { base: 0x8a5a2b, dorsal: 0x7a4f26, belly: 0x9a6a3a, head: 0x7e5327, mark: 0xe9e3d6, masks: ['stripes', 'legs', 'ears', 'muzzle', 'tailpatch'] },
  britishalpine: { base: 0x2d3035, dorsal: 0x282b2f, belly: 0x323336, head: 0x2d3035, mark: 0xe9e4d8, masks: ['stripes', 'legs', 'ears', 'muzzle', 'tailpatch'] },
  pied: { base: 0xefebe0, dorsal: 0xe9e5d8, belly: 0xf3f0e7, head: 0xefebe0, mark: 0x1f1c1b, masks: ['patches'], pink: 0.7 },
  piedbrown: { base: 0xefebe0, dorsal: 0xe9e5d8, belly: 0xf3f0e7, head: 0xefebe0, mark: 0x7a4a26, masks: ['patches'], pink: 0.7 },
  // (Nubian red: a deep mahogany, not orange: 0x8a4f2a rendered a bright orange; saturation ~20 % lower, a little darker)
  nubianred: { base: 0x7c4a30, dorsal: 0x6e4129, belly: 0x93613f, head: 0x7c4a30, mark: 0xe6ddcc, masks: ['spots'] },
  nubiantan: { base: 0xb08a5c, dorsal: 0x9e7b50, belly: 0xc3a174, head: 0xa98458, mark: 0x2b2420, masks: ['dorsal'] },
  nubianblack: { base: 0x2a2624, dorsal: 0x24201f, belly: 0x322d2a, head: 0x2a2624, mark: 0xd8cbb4, masks: ['spots'] },
  boer: { base: 0xf0ede6, dorsal: 0xebe7de, belly: 0xf3f1ea, head: 0xf0ede6, mark: 0x74391f, masks: ['boerhead'], pink: 0.4 },
};
const PINK = 0xd9a08a, NOSE_DARK = 0x3a302c, HOOF = 0x3b3632, HOOF_PALE = 0xc8b394;

function palette(p) {
  const C = COATS[p.coat] || COATS.saanen;
  const k = p.coatShade || 0, l = p.coatLightness || 0;
  const tw = (hex) => { const c = srgb(hex); return [c[0] * (1 + 0.06 * k + l), c[1] * (1 + l), c[2] * (1 - 0.06 * k + l)]; };
  return {
    base: tw(C.base), dorsal: tw(C.dorsal), belly: tw(C.belly), head: tw(C.head), mark: srgb(C.mark),
    masks: new Set(C.masks), pink: C.pink || 0,
    skinPink: srgb(PINK), noseDark: srgb(NOSE_DARK), hoof: srgb(HOOF), hoofPale: srgb(HOOF_PALE),
    horn: srgb(p.hornColor || 0x9e8058), hornDark: srgb(0x5a4a36),
  };
}

const HOOF_TAGS = new Set(['hoof', 'heelbulb', 'dewclaw']);

export function goatCoat(ctx) {
  const { model, rig, pos, nrm, regionOf, regionNames, weights, nV, params, lists } = ctx;
  const { BONES } = rig;
  const J = rig.J;
  const R = rng(7331 + (params.coatSeed || 0));
  const COL = palette(params);
  // 0 for pale horn (Saanen) .. 1 for the dark Nubian / Boer horn (luminance of the linear horn colour)
  const hornDark = 1 - smoothstep(0.12, 0.3, 0.2126 * COL.horn[0] + 0.7152 * COL.horn[1] + 0.0722 * COL.horn[2]);
  const kid = params.age === 'juvenile';
  const buck = params.sex === 'male' && !kid;
  const shag = params.shaggy || 0; // long-haired landrace coat 0..1
  const { dominant, axialS, skinIndex, skinWeight, limbMember } = weights;
  const AX_LEN = weights.axialLengths;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8];
  // the crest of the neck faces up and back (square to the neck axis, neck base -> occiput)
  const ND = norm(sub(J.occiput, J.neckBase)), CREST_N = norm([0, ND[2], -ND[1]]);
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const jawPrims = model.forPart('jaw').filter((p) => p.tag !== 'beard');
  const headPrims = model.forPart('body').filter((p) => p.bone === 'head' && !p.carve);
  const nostrilPrims = model.prims.filter((p) => p.tag === 'nostril');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof|femur|tibia|metatarsus|hpaw|hhoof)/.test(b.name));
  const isFront = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof)/.test(b.name));
  // (head-local, in adult coordinates: a kid's short face mapped back, rig.js faceZ)
  const HL = (p) => { const d = sub(p, HEAD_O); return [d[0], dot(d, HY), unFaceZ(dot(d, HZ), kid)]; };
  const partName = (v) => regionNames[regionOf[v]];
  // a buck's scrotum (its own surface): the hair length where its neck enters the groin, shared with the body round it
  const SCR = model.forPart('udder').filter((q) => q.tag === 'scrotum' && !q.carve), SCR_JOIN = 0.0065;
  // position along the beard, 0 at its root under the chin, 1 at its tip (< 0: the chin in front of it)
  const bTop = J.beardTop, bDir = sub(J.beardTip, J.beardTop), bLen2 = Math.max(1e-6, dot(bDir, bDir));
  const beardT = (p) => dot(sub(p, bTop), bDir) / bLen2;
  const horns = [hornPath(params, 1), hornPath(params, -1)];
  const RIDGES = hornRidges(params);
  // nearest point of a horn's centre line: t (0 base .. 1 tip) and the line's direction there, blended
  // between the path points (per segment, the keratin's anisotropic sheen lit whole segments as bands)
  const hornTan = horns.map((H) => H.map((q, i) => norm(sub(H[Math.min(i + 1, H.length - 1)].p, H[Math.max(i - 1, 0)].p))));
  const hornAt = (p) => {
    const S = p[0] >= 0 ? 0 : 1, H = horns[S], T = hornTan[S];
    let bt = 0, bd = 1e9, dir = [0, 1, 0];
    for (let i = 0; i + 1 < H.length; i++) {
      const a = H[i].p, b = H[i + 1].p, ab = sub(b, a);
      const u = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0, 1);
      const dd = len(sub(p, add(a, mul(ab, u))));
      if (dd < bd) { bd = dd; bt = H[i].t + (H[i + 1].t - H[i].t) * u; dir = add(mul(T[i], 1 - u), mul(T[i + 1], u)); }
    }
    return { t: bt, dir: norm(dir) };
  };

  // the inner face of an ear: its facing (sculpt.js) square to the ear bone
  const earInner = (v) => {
    const b = BONES[dominant[v]], ax = norm(sub(b.tail, b.head)), f = earFacing(params, pos[v * 3] >= 0 ? 1 : -1);
    return norm(sub(f, mul(ax, dot(f, ax))));
  };

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
    if (pn === 'horn' || pn === 'horntip') region[v] = 7;
    else if (pn === 'jaw' || pn === 'beard') region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (bn.startsWith('tail') && axialS[v] > sTailBase + 0.01) region[v] = 4;
    else if (axialS[v] < sOcc + 0.01) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) legness[v] = 0;
  }

  // --- pied patches: a handful of big irregular blotches (seeded), plus a chance of a dark head
  const patches = [];
  if (COL.masks.has('patches') || COL.masks.has('spots')) {
    const spots = COL.masks.has('spots');
    const n = spots ? 10 + Math.floor(R() * 10) : 4 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      // (on the barrel, the back and the rump: a border across the upper neck or the throat smeared whenever
      // the head went down to graze, one across an elbow or a stifle with every stride)
      if (spots) { patches.push({ c: [(R() * 2 - 1) * 0.18, 0.55 + R() * 0.25, -0.35 + R() * 0.55], r: 0.02 + 0.03 * R() }); continue; }
      // pied: big irregular blotches, a third of them saddles over the back (both sides), the rest on one side,
      // centred on the skin (centres anywhere in the body's box mostly lay inside it, and showed as one small round
      // spot per side or none: the random herd's pied does were nearly all white)
      // (each blotch on the barrel and rump, z -0.44 .. 0.14, above the elbows and stifles: over the shoulder blade a
      // kid's border stretched 2x on 17 % of the triangles near pattern edges, low on the flank 1.5x on 28 %)
      const saddle = R() < 0.35, r = saddle ? 0.1 + 0.05 * R() : 0.07 + 0.06 * R(), ez = 0.75 + 0.25 * R(), ext = r / ez;
      const z = mix(-0.44 + ext, 0.14 - ext, R());
      if (saddle) patches.push({ c: [0, 0.72 + 0.05 * R(), z], r, ez });
      else { const sd = R() < 0.5 ? 1 : -1; patches.push({ c: [sd * (0.11 + 0.04 * R()), 0.56 + 0.2 * R(), z], r, ez }); }
    }
    // a dark head and neck on most (a hood down to the neck base; a round patch on the head ran its border round
    // the eye and across the cheek, which stretches with the throat when the head goes down)
    if (!spots && R() < 0.7) patches.push({ c: hl0([0, 0.02, 0.05]), r: 0.1, head: true, t: 0.3 + 0.35 * R() });
  }
  function hl0(v) { return [HEAD_O[0] + v[0], HEAD_O[1] + v[1] * HY[1] + v[2] * HZ[1], HEAD_O[2] + v[1] * HY[2] + v[2] * HZ[2]]; }

  // --- the breed's second colour as a signed distance field (< 0 inside), jagged edges
  const markSDFof = (v) => {
    const p = P(v), n = N(v), r = region[v], M = COL.masks;
    if (r === 7) return 1;
    const jag = (fbm3(p[0] * 45, p[1] * 45, p[2] * 45, 2) - 0.5) * (r === 2 || r === 5 || r === 6 ? 0.005 : 0.02);
    let d = 1;
    const lb = legBone[v];
    const L = legness[v];
    if (r === 2 || r === 6 || r === 5) {
      const h = HL(p), ax = Math.abs(h[0]);
      // Swiss markings: a stripe from above each eye down the side of the face to the muzzle
      if (M.has('stripes') && (r === 2 || r === 6)) {
        // on the face's cross-section (head-local x, y about the face's centre line), a band at an
        // angle from the dorsal midline: from the inner corner of the eye down the side of the nasal
        // bone to the corner of the muzzle; capped at both ends
        const z0 = -0.015, z1 = 0.165;
        const zc = clamp(h[2], z0, z1), tt = (zc - z0) / (z1 - z0);
        const yC = mix(-0.018, -0.03, tt), rad = Math.hypot(ax, h[1] - yC);
        const ang = Math.atan2(ax, h[1] - yC), angC = mix(0.95, 0.72, tt), wA = mix(0.2, 0.26, tt);
        const dz = Math.max(z0 - h[2], h[2] - z1, 0);
        const across = (Math.abs(ang - angC) - wA) * rad;
        d = Math.min(d, dz > 0 ? Math.hypot(Math.max(across, 0), dz) : across);
      }
      // dark face centre (chamoisee / Oberhasli: a black band from the forehead down the nose)
      if (M.has('facecentre') && r === 2 && h[1] > -0.02) d = Math.min(d, Math.max(ax - 0.016 * (1 - 0.35 * clamp(h[2] / 0.16, 0, 1)), -0.03 - h[2], h[2] - 0.17));
      if (M.has('muzzle') && (r === 2 || r === 6)) d = Math.min(d, 0.155 - h[2] + (h[1] > -0.02 ? 0.01 : 0));
      // ear edges and tip in the second colour (erect ears; a hanging lop ear's outer 38 % was a black disc on
      // the side of a tan Nubian's head, and a black Nubian's light ears a pale oval on a black head: lop ears
      // are the colour of the head)
      if (M.has('ears') && r === 5 && params.ear !== 'lop') {
        const eb = BONES[dominant[v]], ab = sub(eb.tail, eb.head);
        const t = dot(sub(p, eb.head), ab) / dot(ab, ab);
        d = Math.min(d, (0.62 - t) * 0.06);
      }
      if (M.has('boerhead')) d = Math.min(d, -0.02);
    }
    if (M.has('boerhead') && r !== 5) {
      // red-brown head and neck, white body: the border runs round the middle of the lower neck (side_boer:
      // the lower neck and the shoulders are white; at the base of the neck it also lay where the skin
      // stretches most as the head goes down to graze)
      // (the legs stay white below the elbows: a leg's skin sits at chest level along the axis; above the
      // elbows the leg term left white islands in the red of the chest front)
      const s = axialS[v];
      d = Math.min(d, (s - 0.5 * (AX_LEN[2] + sNeckBase)) + (fbm3(p[0] * 20, p[1] * 20, p[2] * 20, 2) - 0.5) * 0.05 + 0.1 * smoothstep(0.1, 0.5, legness[v]) * smoothstep(0.44, 0.38, p[1]));
    }
    if (r === 0 || r === 1) {
      if (M.has('dorsal')) d = Math.min(d, Math.abs(p[0]) - 0.012 - 0.006 * smoothstep(0.3, -0.4, p[2]) + (1 - smoothstep(0.7, 0.95, n[1])) * 0.05);
      // chamoisee: the black belly; where the legs join the body it hands over to the legs' rule (below)
      // over a band of leg membership (a switch at 0.2 stepped the border from 0.43 to 0.5 m: black
      // blocks at the elbows and stifles)
      if (M.has('belly')) {
        const torso = p[1] - 0.43;
        let leg = 1;
        if (lb >= 0) { const front = isFront[lb]; leg = p[1] - 0.5 + 0.12 * smoothstep(-0.2, 0.7, n[2] * (front ? 1 : -1)); }
        d = Math.min(d, mix(torso, leg, smoothstep(0.1, 0.6, L)));
      }
      // cou blanc: the black hindquarters, an irregular slanting border from behind the withers to the
      // flank, grizzled (it was a vertical plane with 5 cm of noise: a straight cut round the barrel)
      if (M.has('rear')) d = Math.min(d, (p[2] + 0.02 + 0.22 * (p[1] - 0.6)) * 0.9 + (fbm3(p[0] * 6, p[1] * 6, p[2] * 6, 3) - 0.5) * 0.12 + (vnoise3(p[0] * 90, p[1] * 90, p[2] * 90) - 0.5) * 0.012);
      // Toggenburg / British Alpine: the light patch either side of the tail, over the pin bones (it was
      // inside only in front of z -0.47: a white bib on the throat and brisket)
      if (M.has('tailpatch')) { const zT = J.tailBase[2]; d = Math.min(d, Math.max(p[1] - 0.72, Math.hypot(p[0] * 1.1, (p[1] - 0.63) * 0.9) - 0.075, p[2] - (zT + 0.07))); }
    }
    if (r === 4) {
      if (M.has('rear') || M.has('dorsal')) d = -0.01;
      if (M.has('tailpatch')) d = Math.min(d, dot(n, [0, 1, 0]) < 0 ? -0.01 : 0.01);
    }
    if (L > 0.2 && lb >= 0) {
      const front = isFront[lb];
      const kneeY = front ? 0.3 : 0.34;
      // points below the knees / hocks (chamoisee: black; Toggenburg / Brit. Alpine: white)
      if (M.has('legs')) d = Math.min(d, p[1] - kneeY);
      // (chamoisee: the black of the belly running down the backs of the legs is blended in above)
      // cou blanc: the black hindquarters run down the hind legs
      if (M.has('rear') && !front) d = Math.min(d, -0.01);
    }
    if (r !== 7 && patches.length) {
      const wob = (fbm3(p[0] * 9, p[1] * 9, p[2] * 9, 3) - 0.5) * 0.08;
      // (lobed, ragged blotches: a low-frequency wobble of +-6 cm and a ragged rim)
      const lobe = (fbm3(p[0] * 4.5 + 3.1, p[1] * 4.5, p[2] * 4.5, 3) - 0.5) * 0.12 + (fbm3(p[0] * 28, p[1] * 28, p[2] * 28, 2) - 0.5) * 0.02;
      // (the hood's border crosses the lower neck, where the skin rides rigidly on neck1)
      for (const q of patches) d = Math.min(d, q.head ? (axialS[v] - mix(AX_LEN[2], sNeckBase, q.t)) * 0.8 + wob * 0.6 : Math.hypot(p[0] - q.c[0], (p[1] - q.c[1]) * 1.1, (p[2] - q.c[2]) * (q.ez || 0.85)) - q.r + (q.ez ? lobe : wob));
    }
    return d + jag;
  };

  // --- ventral factor (lighter belly, inner legs)
  const ventral = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const n = N(v), r = region[v], p = P(v);
    let w = 0;
    if (r === 0) w = smoothstep(-0.2, -0.8, n[1]) * smoothstep(0.55, 0.42, p[1]);
    else if (r === 1) w = smoothstep(0.0, -0.7, n[1]) * 0.5;
    const L = legness[v];
    if (L > 0) { const side = p[0] >= 0 ? 1 : -1; w = mix(w, smoothstep(0.1, -0.7, n[0] * side) * 0.6 * smoothstep(0.25, 0.45, p[1]), L); }
    ventral[v] = w;
  }

  // --- a buck's mane: the crest of the neck and the withers (coarse long hair on the neck crest
  // and the dorsal line), fading out along the back over ~20 cm behind the withers and down the sides of the neck
  // (it ended behind the withers over the span of one axial joint, in a wall of hair)
  const maneW = new Float32Array(nV);
  if (buck && (params.mane || 0) > 0.05) {
    for (let v = 0; v < nV; v++) {
      // (the neck and body skin only: a wattle behind the jaw faces up the crest's way and grew a 27 mm mane)
      if ((region[v] !== 0 && region[v] !== 1) || (partName(v) !== 'body' && partName(v) !== 'head')) continue;
      const n = N(v), s = axialS[v], up = clamp(n[1], -1, 1);
      // across: on the neck down the sides from the crest, behind the neck base a strip ~9 cm either side of the spine
      // (the normal's turn over the withers ended it within 3 cm there: a bevel of 5 cm hair on both sides)
      const wN = smoothstep(sNeckBase + 0.06, sNeckBase - 0.02, s);
      const onNeck = smoothstep(0.12, 0.95, Math.max(up, dot(n, CREST_N)));
      const onBack = (1 - smoothstep(0.02, 0.1, Math.abs(pos[v * 3]))) * smoothstep(-0.1, 0.4, up);
      // (above the shoulders only: a leg's skin sits at the chest's axial position, and the upward faces of the
      // coronets grew a mane)
      maneW[v] = mix(onBack, onNeck, wN) * (1 - smoothstep(AX_LEN[4] - 0.06, AX_LEN[5] + 0.06, s)) * smoothstep(sOcc, sOcc + 0.08, s) * smoothstep(0.58, 0.66, pos[v * 3 + 1]);
    }
  }

  // --- comb (hair flow)
  const comb = new Float32Array(nV * 3);
  const whorl = [0, 0.03, -0.02]; // forehead whorl, head-local
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v], tag = tagOf[v];
    const bone = BONES[dominant[v]];
    let d;
    if (r === 5) d = norm(sub(bone.tail, bone.head));
    // (the horn's comb runs along the horn, base to tip: the keratin shader lays its striations and
    // highlight along the comb and its growth rings across it; world-up ran 48-52 deg off the axis of a
    // horn sweeping back and out, and the streaks swirled into a white net)
    else if (r === 7) d = hornAt(p).dir;
    else if (tag === 'beard' || tag === 'wattle') d = [0, -1, -0.1];
    else if (r === 2 || r === 6) {
      const h = HL(p);
      const rel = [h[0] - whorl[0], (h[1] - whorl[1]) * 0.4, h[2] - whorl[2] + 0.05];
      d = norm(add(mul(HY, rel[1] - 0.03), add(mul(HZ, rel[2]), [rel[0], 0, 0])));
      if (h[2] < -0.05) d = norm(add(d, [0, -0.6, -0.8]));
    } else if (r === 4) {
      d = norm(sub(bone.tail, bone.head));
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = rig.AXIAL.points[seg], b = rig.AXIAL.points[Math.min(seg + 1, rig.AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.5 * Math.abs(n[0]), 0]));
      if (r === 1) d = norm(add(d, [0, -0.6, 0.1]));
      // (a buck's mane falls to both sides from the crest; by the mane's weight, not its sculpt tag: where the last
      // mane primitive ended behind the withers the comb flipped from sideways to backward)
      if (maneW[v] > 0) d = norm(add(d, [(p[0] >= 0 ? 0.45 : -0.45) * maneW[v], 0.1 * maneW[v], 0]));
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

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v], tag = tagOf[v];
    let col, mat = MAT.FUR, fl = 0.012, mark = 1, gloss = 0.5, pint = 1;
    const msd = markSDFof(v);
    const lb = legBone[v];
    const lbName = lb >= 0 ? BONES[lb].name : '';
    const white = COL.pink > 0 && msd > 0; // white-coated areas have pink skin underneath
    if (r === 0 || r === 1) {
      const up = clamp(n[1], -1, 1);
      col = mix3(COL.base, COL.dorsal, smoothstep(0.3, 0.95, up) * 0.8);
      col = mix3(col, COL.belly, ventral[v] * (COL.masks.has('belly') ? 0.5 : 1));
      fl = mix(0.009, 0.011, ventral[v]);
      // (the neck's coat grows in behind the head over a few centimetres; a buck's long hair and mane and a
      // kid's fluffy coat over 8 cm: against the head's 5 mm they stood up as a collar behind the poll)
      // (the upper neck behind the poll, crest and sides: the skin there folds to 0.65 of its length as the poll opens to
      // graze or drink, and its 9 mm hair stood apart in a band of disordered, light fur across the nape; its coat grows
      // in over the next 10 cm instead)
      const nape = r === 1 ? smoothstep(-0.1, 0.5, dot(n, CREST_N)) : 0;
      const collar = smoothstep(sOcc + 0.06 * nape, sOcc + 0.08 + 0.06 * nape, axialS[v]);
      if (r === 1) fl = mix(0.0035 + 0.0015 * (1 - nape), 0.009, smoothstep(sOcc + 0.06 * nape, sOcc + 0.04 + 0.08 * nape, axialS[v]));
      // a buck's body coat is short and sleek like a doe's (15-40 mm; side2, walk1): only the
      // dorsal line carries a ridge of coarser hair (2 cm over the whole side and a 25 % shaggy roll for every buck
      // made every buck's barrel a sheep's fleece); the long-haired landrace (shag) keeps its skirt
      const dorsal = smoothstep(0.7, 0.97, up);
      fl += ((buck ? 0.007 : 0) * dorsal + shag * 0.035 * (0.4 + 0.6 * smoothstep(-0.3, 0.6, -up + 0.8))) * collar;
      const L = legness[v];
      if (L > 0) {
        // (the pants grow in over the gaskin: cut at 0.4 m they ended in a wall round the thigh)
        const pants = !isFront[lb] ? smoothstep(0.1, -0.8, n[2]) * smoothstep(0.33, 0.47, p[1]) : 0;
        const lfl = mix(0.003, 0.008, smoothstep(0.1, 0.45, p[1])) + (buck ? 0.03 : 0.006) * pants + shag * 0.04 * smoothstep(0.15, 0.5, p[1]);
        fl = mix(fl, lfl, L);
        // carpal callus: bare dark patch on the front of the knee in adults
        if (!kid && isFront[lb] && Math.abs(p[1] - 0.21) < 0.022 && n[2] > 0.5) { col = mix3(col, [0.08, 0.065, 0.055], 0.5); fl = Math.min(fl, 0.003); }
      }
      // the mane after the legs' blend (the withers' skin is partly the scapulae's, and their short hair cut the mane
      // off behind the withers: a triangular fin of hair standing on the back)
      if (maneW[v] > 0) fl = mix(fl, Math.max(fl, 0.022 + 0.028 * params.mane), maneW[v]);
      if (tag === 'udder' || tag === 'teat') {
        // the udder: its upper half covered in fine hair of the coat's colour, the lower part and the teats
        // bare pink (or grey) skin (side2, threequarter1; it was a saturated salmon bag)
        const ut = clamp((J.udderTop[1] - p[1]) / (J.udderTop[1] - J.udderBot[1]), 0, 1.3);
        const skinCol = mix3(mix3(COL.skinPink, [0.03, 0.025, 0.022], COL.pink > 0 ? 0.1 : 0.45), [0.8, 0.78, 0.75], COL.pink > 0 ? 0.2 : 0);
        // (the hair line is irregular and the hair thins out onto the skin over ~2 cm, the skin showing through: a level
        // line at 62 % of the bag's height, where the fur met the bare skin, drew a straight, stitched ring round the udder)
        const border = 0.56 + (fbm3(p[0] * 26 + 7.7, p[1] * 26, p[2] * 26, 2) - 0.5) * 0.24;
        const bare = smoothstep(border - 0.04, border + 0.14, ut);
        // (all of the bag is skin, the upper part under fine hair of the coat's colour: a fur / skin material border
        // round the bag was drawn in the stair steps of the mesh)
        // (the breed's second colour baked in: under a dark belly (chamoisee, cou blanc) the hair is dark and so is the
        // skin; as skin the bag took no pattern colour, and black hair stood speckled on pink skin)
        const inPat = smoothstep(0.004, -0.004, msd);
        const hairCol = mix3(col, COL.mark, inPat);
        const skinC = mix3(skinCol, mul(COL.mark, 1.6), inPat * (COL.mark[0] + COL.mark[1] < 0.2 ? 0.75 : 0));
        mat = MAT.SKIN; gloss = mix(0.2, 0.35, bare); pint = 0;
        if (tag === 'teat') { fl = 0; col = skinC; }
        else { col = mix3(hairCol, skinC, 0.3 * smoothstep(0.1, border, ut) + 0.7 * bare); fl = mix(mix(0.006, 0.0025, smoothstep(0.15, border, ut)), 0, bare); }
      }
      // (the scrotum is covered in the coat: the groin's hair on its neck, where it enters the body, thinning to short
      // fine hair over the bag; a fixed 4 mm from the groin down drew the neck's way into the body as a hard line)
      if (tag === 'scrotum') fl = mix(0.005, SCR_JOIN, smoothstep(0.42, 0.49, p[1]));
      if (/hoof|paw/.test(lbName) && HOOF_TAGS.has(tag)) {
        const Cj = J[(lbName[0] === 'f' ? 'fcoffin' : 'hcoffin') + BONES[lb].side];
        if (tag === 'dewclaw' || p[1] < Cj[1] + 0.006 + 0.35 * (p[2] - Cj[2])) {
          mat = MAT.KERATIN; fl = 0; gloss = 0.5;
          const pale = COL.pink > 0 && msd > 0 && params.coat !== 'boer' ? 1 : COL.masks.has('legs') && COL.mark[0] > 0.5 ? 0.7 : 0;
          col = mix3(COL.hoof, COL.hoofPale, pale);
          if (tag === 'heelbulb') col = mix3(col, [0.1, 0.08, 0.07], 0.4);
        }
      }
    } else if (r === 4) {
      col = mix3(COL.base, COL.dorsal, 0.5);
      // the hair lengthens along the tail to a brush at the tip (a 28 mm coat from the root stood up as a
      // ring round it against the rump's 10 mm)
      const tt = clamp((axialS[v] - sTailBase) / Math.max(0.05, AX_LEN[AX_LEN.length - 1] - sTailBase), 0, 1);
      fl = mix(0.012, 0.045, smoothstep(0.05, 0.9, tt)) + 0.02 * shag * tt;
    } else if (r === 5) {
      // ears: short hair outside, sparse inside with pink / dark skin showing
      // (the inner side from the ear's own facing: the first 'ear' primitive's parameters, read as a
      // direction, pointed along +x for both ears, so the right ear was pink on its back)
      const front = dot(n, earInner(v));
      col = COL.head;
      fl = 0.004;
      if (front > 0.3) {
        if (params.ear !== 'lop') { fl = 0.0025; col = white ? mix3(col, COL.skinPink, 0.35) : mix3(col, [0.1, 0.08, 0.07], 0.3); }
        else { fl = 0.003; col = white ? mix3(col, COL.skinPink, 0.2) : col; }
      }
    } else if (r === 7) {
      // horn: dark base, lighter towards the tip, transverse growth ridges
      const ha = hornAt(p), bt = ha.t;
      // (the ridged base is dull, the worn tip polished: a uniform 0.4 lit the broad base as a metallic band)
      // (dark horn is matte: the keratin's highlight and grazing sheen are the same on any albedo, so on the dark
      // Nubian and Boer horns a 0.4 tip read as chrome and the bases as silver; face2 / face4 show a dull sheen.
      // A negative keratin gloss is duller than 0 (core coatMaterial: -1 matte); never 0 itself, the shader's default)
      mat = MAT.KERATIN; fl = 0; gloss = hornDark > 0.5 ? -mix(0.55, 0.25, smoothstep(0.15, 0.85, bt)) : mix(0.08, 0.4, smoothstep(0.15, 0.85, bt)) * (1 - 0.6 * hornDark);
      col = mix3(COL.hornDark, COL.horn, smoothstep(0.0, 0.5, bt));
      col = mix3(col, mul(COL.horn, 1.15), smoothstep(0.7, 1, bt) * 0.5);
      // (narrow dark grooves between the growth ridges, most marked toward the base: side2, face4)
      const hl = (params.horns?.len || 0.2) * bt;
      const ring = Math.pow(0.5 + 0.5 * Math.sin(hl * 2 * Math.PI / 0.009), 3);
      col = mul(col, 1 - 0.1 * ring * (1 - smoothstep(0.5, 0.9, bt)));
      // (the growth ridges' grooves, in phase with the sculpted collars, sculpt.js: dark just before each ridge rises,
      // the crest a little lighter; painted at every tier, the medium and coarser tiers have no sculpted ridges)
      if (RIDGES) {
        const u = (hl - RIDGES.s0) / RIDGES.S, fr = u - Math.floor(u);
        const fade = (u > -0.6 ? 1 : 0) * (1 - smoothstep(0.55 * RIDGES.tEnd, RIDGES.tEnd + 0.08, bt));
        const groove = Math.exp(-(((fr - 0.66) / 0.11) ** 2)), crest = Math.exp(-((Math.min(fr, 1 - fr) / 0.12) ** 2));
        // (softer on pale horn: 0.3 drew a doe's pale horn in regular dark stripes)
        col = mul(col, 1 + fade * (0.06 * crest - mix(0.16, 0.3, hornDark) * groove));
      }
      // (streaky shade along the horn: the noise is stretched along the horn's axis, not world-up)
      const along = dot(p, ha.dir), q = sub(p, mul(ha.dir, along));
      col = mul(col, 0.9 + 0.2 * vnoise3(q[0] * 300, q[1] * 300, q[2] * 300 + along * 60));
    } else {
      // head & jaw
      col = COL.head;
      fl = 0.005;
      const h = HL(p);
      // beard: long coarse hair that grows in from a short root under the chin (a 30 mm coat from the root
      // stood up as a rim against the chin's 5 mm)
      if (tag === 'beard') {
        const bt = beardT(p);
        fl = mix(0.008, 0.028 + 0.1 * Math.min(params.beard || 0, 0.2), smoothstep(-0.15, 0.4, bt));
        col = mix3(COL.head, COL.base, 0.3);
      }
      // a buck's shaggy crown and forelock (face2, face4)
      if (buck && tag !== 'beard') fl = Math.max(fl, 0.005 + 0.012 * smoothstep(0.06, -0.05, h[2]) * smoothstep(-0.005, 0.03, h[1]));
      if (tag === 'wattle') fl = 0.006;
      // nose leather and lips: pink skin under white, dark grey otherwise
      const muz = smoothstep(0.155, 0.185, h[2]) * (tag === 'beard' ? 0 : 1);
      if (muz > 0) { col = mix3(col, white || (COL.pink && msd > 0) ? COL.skinPink : COL.noseDark, muz * 0.45); fl = mix(fl, 0.0025, muz); }
      if (h[2] < -0.08) col = mix3(col, COL.base, smoothstep(-0.08, -0.14, h[2]));
      // eyelids: a thin margin of lid skin (pink-grey under white hair, dark otherwise) and a short lash
      // line; the hair shortens toward the lid over ~10 mm (a 4 mm switch sank the eye in a fur ring)
      for (const e of eyePrims) {
        const de = Math.abs(SDFModel.dist(e, p[0], p[1], p[2]));
        if (de < 0.0025) mark = Math.min(mark, de - (white ? 0.0008 : 0.0016));
        if (de < 0.0014) { if (white) { mat = MAT.SKIN; col = mix3(COL.skinPink, COL.noseDark, 0.45); } else mat = MAT.DARK_SKIN; fl = 0; }
        else if (de < 0.012) fl = Math.min(fl, mix(0.0012, fl, smoothstep(0.0014, 0.012, de)));
      }
      // nose: the bare pad (rhinarium) round the nostrils and down to the lip, pink-grey under white hair,
      // dark grey otherwise; the nostrils are slits whose inside is darker, with no outline
      // (a dark nose is satin skin, not the pebbled leather, ending in a 4 mm ramp of very short dark hair: the
      // leather's fixed black against the red Boer head drew the pad's outline in stair steps of mesh cells, and its
      // nostrils were black holes in black; the nostrils are dark slits on a dark grey-brown pad, as on the Saanen)
      const noseCol = white ? srgb(0xbca59f) : COL.noseDark;
      const noseMat = MAT.SKIN;
      const padIn = white ? 1 : 0.84;
      if (tag !== 'beard' && regionNames[regionOf[v]] !== 'jaw') {
        // (a goat's bare nose is small: round the nostrils and between them; the rest of the muzzle has
        // short fine hair with the skin showing through)
        const pad = Math.hypot(h[0] / 0.025, (h[1] + 0.028) / 0.019);
        const front = h[2] > 0.175 && dot(n, HZ) > 0.2;
        if (front && pad < padIn) { mat = noseMat; fl = 0; col = noseCol; if (!white) { gloss = mix(0.6, 0.3, smoothstep(0.5, padIn, pad)); pint = 0; } }
        else if (!white && h[2] > 0.165 && pad < 1.3) { const t = smoothstep(padIn, 1.3, pad); col = mix3(noseCol, msd < 0 ? COL.mark : col, t); pint = t; fl = Math.min(fl, 0.0008 + 0.0025 * t); }
        else if (h[2] > 0.15 && pad < 1.8) fl = Math.min(fl, 0.0015 + 0.004 * smoothstep(1, 1.8, pad));
      }
      for (const e of nostrilPrims) {
        const dn = SDFModel.dist(e, p[0], p[1], p[2]);
        if (dn < 0.0012) { mat = noseMat; col = white ? srgb(0x7a5e58) : mul(noseCol, 0.35); fl = 0; if (!white) { gloss = 0.3; pint = 0; } }
      }
      // lips: where the head's surface meets the lower jaw (and the jaw's meets the head), a thin band of
      // lip skin; the mouth (red) only where one surface lies inside the other, hidden while the mouth is
      // closed (a red band 1.5 mm into the contact, wide and facing sideways at the corners, and black
      // mark lines either side of it made a torn zigzag of the mouth line)
      // (the mouth colour only 4 mm and more inside the other surface: more than a mesh cell, so no
      // triangle that shows while the mouth is shut reaches it; the lip skin covers the band either side
      // of the contact line)
      const lip = () => { if (white) { mat = MAT.SKIN; col = srgb(0xa89390); } else mat = MAT.DARK_SKIN; fl = 0; };
      // (lip skin only along the mouth line, above the chin: where the chin meets the head's jaw under
      // the lower lip both surfaces keep their hair)
      const mouthLine = h[1] > -0.08;
      if (tag === 'beard') { /* long hair, no lips */ } else if (regionNames[regionOf[v]] !== 'jaw') {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (h[2] > 0.1) {
          if (dj < -0.004) { mat = MAT.MOUTH; fl = 0; }
          else if (!mouthLine) { /* chin seam */ }
          else if (dj < 0.0015) lip();
          else if (dj < 0.006) fl = Math.min(fl, mix(0.0012, fl, (dj - 0.0015) / 0.0045));
        }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (dh < -0.004) { mat = MAT.MOUTH; fl = 0; }
        else if (!mouthLine) { /* chin seam */ }
        // (the rim of the lower lip that shows below the upper lip is bare lip too, not a white tuft)
        else if (dh < 0.0015 || (tag === 'lowerlip' && dh < 0.004)) lip();
        else if (dh < 0.006) fl = Math.min(fl, mix(0.0012, fl, (dh - 0.0015) / 0.0045));
      }
    }
    // the breed's second colour: its distance runs on through the bare features (lids, nostrils, lips,
    // mouth, udder), so their borders are no pattern edges (reset to "outside" inside a coloured head, they
    // were 61 % of the Boer's pattern-edge mesh edges, and stretched with the lips); only fur and
    // hair-covered skin take its colour (intensity), keratin (hooves) stays out of it
    const CAP = 0.02;
    // (clamped on both sides: deep inside a pattern its distance jumped between regions, -0.3 on the head
    // and -0.02 on an ear by the rules, and the shader's antialiasing width (fwidth of the pattern) opened a
    // thin light line of the base colour along the ear root and down the neck behind a Boer's lop ear)
    const pd = mat === MAT.KERATIN ? CAP : clamp(msd, -CAP, CAP);
    const takes = mat === MAT.FUR || (mat === MAT.SKIN && tag !== 'teat');
    // short dark coats shine (a black goat's flanks show a sheen in sun; they read as a flat silhouette)
    // (long dark hair too: a British Alpine buck's back and neck read as a flat black shape in the showcase)
    if (mat === MAT.FUR && col[0] + col[1] + col[2] < 0.12) gloss = fl < 0.02 ? 0.64 : 0.52;
    // low-frequency colour variation
    const cv = fbm3(p[0] * 7, p[1] * 7, p[2] * 7, 3) - 0.5;
    if (mat === MAT.FUR) col = [col[0] * (1 + 0.12 * cv), col[1] * (1 + 0.1 * cv), col[2] * (1 + 0.08 * cv)];
    // long hair: lock-to-lock shade streaks
    if (tag === 'beard' || tag === 'mane' || fl > 0.03) {
      const c = [comb[v * 3], comb[v * 3 + 1], comb[v * 3 + 2]];
      const along = dot(p, c), q = sub(p, mul(c, along));
      const st = vnoise3(q[0] * 160, q[1] * 160, q[2] * 160 + along * 4);
      col = mul(col, 0.82 + 0.36 * st);
    }
    pattern[v] = pd; patInt[v] = takes ? pint : 0;
    patCol[v * 3] = COL.mark[0]; patCol[v * 3 + 1] = COL.mark[1]; patCol[v * 3 + 2] = COL.mark[2];
    markSDF[v] = mark;
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    surf[v * 4] = gloss;
  }
  // cavity shading: the groin, the inner thighs and the top of the udder lie in the shadow of the thighs and the belly
  // (lit as open skin, the inner skin of the groin showed as a light, torn-looking wedge through the crease in front of
  // the stifle when the leg swung forward). Occlusion from the sculpt (SDF samples 1.5-6 cm out along the normal) over
  // the hindquarters' lower half: down to 0.35 between the thighs, 1 on open skin
  {
    const occl = [...model.forPart('body'), ...model.forPart('udder')].filter((q) => !q.carve && (q.group === 'axial' || q.group === 'udder' || q.group[0] === 'H'));
    const near = occl.filter((q) => { const c = q.P; return c[1] < 0.7 && c[2] < 0.1 && c[2] > -0.55; });
    for (let v = 0; v < nV; v++) {
      const p = P(v);
      if (p[1] > 0.56 || p[1] < 0.18 || p[2] > 0.06 || p[2] < -0.5 || Math.abs(p[0]) > 0.16) continue;
      const n = N(v);
      let occ = 0;
      for (let i = 1; i <= 4; i++) {
        const d = 0.015 * i;
        const sd = SDFModel.evalList(near, p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d);
        occ += Math.max(0, d - sd) / d / i;
      }
      const ao = clamp(1 - 0.55 * occ, 0.35, 1);
      for (let k = 0; k < 3; k++) { tint[v * 4 + k] *= ao; patCol[v * 3 + k] *= ao; }
    }
  }
  // the scrotum's neck enters the groin under one coat: the body's hair round it shortens to the neck's own over ~4 cm
  // (the buck's long inner pants and perineum hair stood round the neck as a fringe of cut shell edges, a collar that
  // drew the bag as a separate object pushed into a slot)
  if (SCR.length) {
    for (let v = 0; v < nV; v++) {
      if (partName(v) !== 'body' || tint[v * 4 + 3] !== MAT.FUR || furLen[v] <= SCR_JOIN) continue;
      const p = P(v);
      if (p[1] < 0.3 || p[1] > 0.62 || p[2] > -0.1 || p[2] < -0.5 || Math.abs(p[0]) > 0.12) continue;
      const d = SDFModel.evalList(SCR, p[0], p[1], p[2]);
      furLen[v] = mix(SCR_JOIN, furLen[v], smoothstep(0.006, 0.045, d));
    }
  }
  // kids: a soft, fluffy coat (straight: 16 mm clumped fully and read as a lamb's wool)
  if (kid) for (let v = 0; v < nV; v++) if (tint[v * 4 + 3] === MAT.FUR && region[v] <= 1) furLen[v] = Math.max(furLen[v], mix(0.005, 0.012, smoothstep(sOcc, sOcc + 0.08, axialS[v])));
  smoothField(furLen, weights.neighbors, 2, (v) => tint[v * 4 + 3] !== MAT.FUR);

  const patternColor = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) { patternColor[v * 4] = patCol[v * 3]; patternColor[v * 4 + 1] = patCol[v * 3 + 1]; patternColor[v * 4 + 2] = patCol[v * 3 + 2]; patternColor[v * 4 + 3] = patInt[v]; }
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, stats: { patches: patches.length }, region, ventral };
}
