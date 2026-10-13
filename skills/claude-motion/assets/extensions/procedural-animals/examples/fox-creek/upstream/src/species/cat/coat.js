// The domestic cat's coat, baked per vertex in reference space.
//
// One groom (fur length and flow) serves every coat; the variant picks the colours and the pattern:
//   mackerel  brown mackerel tabby: narrow wavy stripes down the flanks from a dorsal stripe, barred
//             legs, ringed tail with a dark tip, necklaces, the forehead "M", cheek swirls
//   classic   blotched tabby: a bull's-eye whorl on each flank, the "butterfly" over the shoulders,
//             three spine lines; same head, legs and tail
//   ginger    red tabby: cream-orange ground, low-contrast rust stripes (mackerel or classic by seed),
//             pink nose leather and pads
//   black     solid black with a rusty undertone and faint ghost stripes, black leather
//   tuxedo    black and white bicolour: white bib, belly, paws and muzzle (layout seeded)
//   calico    white with patches of orange and black (params.white = 0: tortoiseshell, a brindle of
//             black and orange without white)
//   grey      solid blue-grey ("blue"), plush, blue-grey leather, faint ghost markings
// params.longhair gives the long coat (ruff, britches, plumed tail, toe tufts); kittens are fluffier.
//
// Channels: tint (base colour + material), pattern (crisp SDF in patternColor: tabby stripes, the
// white of a tuxedo, the orange patches of a calico), mark (crisp SDF in the species mark colour: eye
// rims, lips, nose outline, the black patches of a calico). Stripes are a few millimetres wide, so
// their distances are stored x PS (the coat shader's edge jitter and antialiasing widths are metres
// tuned on the cheetah's 15 mm spots).
import { HEAD_O } from './rig.js';
import { neckS, harmonizeSeamWeights } from './regions.js';
import { earFrame, eyeOf } from './sculpt.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, projectToSurface, distPolyline, MAT } from '../../core/build/coatKit.js';
import { limitFurSlope, FUR_SLOPE_DEFAULTS } from '../../core/build/furSlope.js';

export const PS = 2.5; // stored pattern / mark distance per metre of skin

// ------------------------------------------------------------------------------------------------
// palettes (sRGB hex sampled from reference photos in neutral light)
export function catPalette(p) {
  const v = p.variant || 'mackerel';
  const k = p.coatWarmth || 0, l = p.coatLightness || 0;
  const tw = (c) => [c[0] * (1 + 0.08 * k + l), c[1] * (1 + 0.02 * k + l), c[2] * (1 - 0.08 * k + l)];
  const C = (h) => srgb(h);
  const base = {
    stripeInt: 1, agouti: 0, gloss: 0.35, under: 0.3, ghost: 0,
    pad: C(0x2e2322), padMat: MAT.NOSE, nose: C(0xa0645a), noseMat: MAT.NOSE, noseRim: true,
    earInner: C(0xbfa196), nict: C(0x9c7f7a), white: C(0xebe8e2),
  };
  if (v === 'mackerel' || v === 'classic') {
    // (a cool, grey-brown agouti ground as in side1 / threequarter1 / face1, not a yellow khaki; a darker back)
    return { ...base, ground: tw(C(0x857a6d)), dorsal: tw(C(0x655a4e)), belly: tw(C(0xc4b7a6)), chin: C(0xe4ded4), stripe: C(0x221b17), agouti: 0.8, under: 0.4, legGround: tw(C(0x908475)), nose: C(0xb47268) };
  }
  if (v === 'ginger') {
    return { ...base, ground: tw(C(0xcf8b4c)), dorsal: tw(C(0xc07a3e)), belly: tw(C(0xecc79a)), chin: C(0xf2dfc4), stripe: tw(C(0x9c5028)), stripeInt: 0.85, agouti: 0.15, under: 0.35, legGround: tw(C(0xd79a5e)),
      pad: C(0xc8908a), nose: C(0xc98e88), noseRim: false, earInner: C(0xe6b0a4) };
  }
  if (v === 'black') {
    // (a black lifted a little and glossier than coal: in studio light the face read as a flat black silhouette; then
    // a little more again, warmer, with a greyer undercoat, as black fur reads in diffuse light)
    return { ...base, ground: tw(C(0x28231f)), dorsal: tw(C(0x1f1b19)), belly: tw(C(0x2d2825)), chin: tw(C(0x2a2522)), stripe: C(0x100d0c), stripeInt: 0.35, ghost: 1, gloss: 0.62, under: 0.22, legGround: tw(C(0x28231f)),
      rust: C(0x3a2a20), pad: C(0x221d1d), padMat: MAT.NOSE, nose: C(0x262021), noseMat: MAT.NOSE, noseRim: false, earInner: C(0x5a4a4a), nict: C(0x8a7470) };
  }
  if (v === 'grey') {
    return { ...base, ground: tw(C(0x7c7e83)), dorsal: tw(C(0x707277)), belly: tw(C(0x8a8c91)), chin: tw(C(0x8c8e93)), stripe: C(0x5c5d62), stripeInt: 0.3, ghost: 1, gloss: 0.3, under: 0.55, legGround: tw(C(0x7f8186)),
      pad: C(0x6a6166), nose: C(0x6a6068), noseRim: false, earInner: C(0x9a8a8e), nict: C(0xb8a8a8) };
  }
  if (v === 'tuxedo') {
    return { ...base, ground: tw(C(0x1d1a19)), dorsal: tw(C(0x181615)), belly: tw(C(0x1f1c1b)), chin: tw(C(0x1f1c1b)), stripe: C(0x100d0c), stripeInt: 0, gloss: 0.5, under: 0.12, legGround: tw(C(0x1d1a19)),
      rust: C(0x33251c), white: C(0xece9e3), pad: p.pinkNose ? C(0xc8928c) : C(0x2a2323), nose: p.pinkNose ? C(0xca918b) : C(0x262021), noseMat: MAT.NOSE, noseRim: false, earInner: C(0x6a5656) };
  }
  // calico / tortoiseshell
  return { ...base, ground: C(0xebe8e2), dorsal: C(0xe6e2da), belly: C(0xefece6), chin: C(0xefece6), stripe: C(0x1c1918), orange: tw(C(0xd08a46)), orangeDark: tw(C(0xb46e32)), black: C(0x1c1918), gloss: 0.4, under: 0.3, legGround: C(0xebe8e2),
    pad: C(0xc8928c), nose: C(0xca918b), noseRim: false, earInner: C(0xdcaaa0) };
}

// ------------------------------------------------------------------------------------------------
// The colour of the fur on the upper lids (linear rgb): the eye shader paints a closing lid in it (blinks,
// the slow blink, sleep, death), so it must be the face's own colour, not black; the dark lid margin is
// drawn by the shader. A calico takes the colour of the patch over its lids (white, orange or black: the
// same fields as catCoat's, sampled on both upper lids; one colour serves both eyes).
export function catLidColor(params = {}) {
  const v = params.variant || 'mackerel';
  const COL = catPalette(params);
  // The shader draws the closing lid as a smooth shell over the eyeball, lit like the fur round it (eyeLook lidFur,
  // lidFill: the scene's lights with the coat's wrapped diffuse, camera-side fill and back-scatter, no environment
  // map). The shells render a coat darker-than-tint for pale coats and brighter for dark ones, and more saturated:
  // fitted on shut eyes in the showcase against the fur ring round each eye (sun in front, behind, to the side), the
  // lid is L' = 0.56 L^0.8 in luminance with the chroma x1.4 (lid / fur ring 0.7-1.2 for ginger, blue, the tabbies
  // in the three lights). A tabby's lids carry the pale fur of its eye ring.
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const dim = (c) => { const L = Math.max(1e-5, lum(c)), L2 = 0.56 * Math.pow(L, 0.8); return c.map((x) => Math.max(0, L2 * (1 + 1.4 * (x / L - 1)))); };
  const tabbyLid = v === 'mackerel' || v === 'classic' || v === 'ginger';
  if (v !== 'calico') return dim(tabbyLid ? mix3(COL.ground, COL.chin, 0.22) : COL.ground);
  const seedOff = rng(1337 + (params.coatSeed || 0))() * 100;
  const f3 = (p, k, o = 0) => fbm3(p[0] * k + seedOff + o, p[1] * k - o, p[2] * k + seedOff * 0.5, 3);
  const wAmt = params.white ?? 0.5;
  const E = eyeOf(params);
  const votes = { white: 0, orange: 0, black: 0 };
  for (const side of [1, -1]) {
    const ef = eyeFrameOf(E, HEAD_O, side);
    for (const u of [-0.004, 0, 0.004]) for (const vv of [0.0075, 0.009]) {
      const p = [0, 1, 2].map((k) => ef.c[k] + ef.x[k] * u + ef.y[k] * vv + ef.z[k] * 0.0085);
      const h = sub(p, HEAD_O);
      const nz = (f3(p, 18, 3.1) - 0.5) * 0.9 + (f3(p, 42, 7.7) - 0.5) * 0.2; // (low-frequency: solid patches, no flecks)
      const mz = Math.hypot(h[0] / (0.02 + 0.012 * wAmt), (h[1] + 0.03) / (0.016 + 0.01 * wAmt), (h[2] - 0.03) / 0.03);
      const white = wAmt < 0.05 ? 0 : smoothstep(1.2, 0.9, mz) + nz * 0.3 * (0.3 + wAmt);
      const nO = ((f3(p, 16, 11.3) - 0.5) + 0.25 * (f3(p, 55, 5.1) - 0.5)) * 0.03;
      votes[white > 0.5 ? 'white' : nO > 0 ? 'orange' : 'black']++;
    }
  }
  const best = Object.keys(votes).reduce((a, b) => (votes[b] > votes[a] ? b : a));
  return dim(best === 'white' ? COL.white : best === 'orange' ? COL.orange : COL.black);
}

// ------------------------------------------------------------------------------------------------
export function catCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, weights, nV, params } = ctx;
  const { BONES, AXIAL, J } = rig;
  const AX = weights.axialLengths;
  const variant = params.variant || 'mackerel';
  const R = rng(1337 + (params.coatSeed || 0));
  const seedOff = R() * 100;
  const COL = catPalette(params);
  const tabby = variant === 'mackerel' || variant === 'classic' || variant === 'ginger';
  const classic = variant === 'classic' || (variant === 'ginger' && params.classic);
  const lh = params.longhair ? 1 : 0;
  const juv = params.age === 'juvenile' ? 1 : 0;
  const { dominant, axialS, skinIndex, skinWeight, limbMember, limbWhich } = weights;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX[1], sNeckBase = AX[3], sChest = AX[4], sTailBase = AX[8], sTip = AX[AX.length - 1];
  const tailLen = sTip - sTailBase;
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const nosePrim = model.prims.find((p) => p.tag === 'nose');
  const nictPrims = model.prims.filter((p) => p.tag === 'nictitans');
  const padPrims = model.prims.filter((p) => p.tag === 'pad' || p.tag === 'toe' || p.tag === 'carpalpad');
  const jawPrims = model.forPart('jaw');
  const bodyPrims = model.forPart('body');
  const headPrims = bodyPrims.filter((p) => p.bone === 'head' && !p.carve && p.tag !== 'nictitans');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|femur|tibia|metatarsus|hpaw)/.test(b.name));
  const isPaw = BONES.map((b) => /^(fpaw|hpaw)/.test(b.name));
  const ears = { L: earFrame(J, 'L'), R: earFrame(J, 'R') };
  const n2 = (a, b) => vnoise3(a + seedOff, b - seedOff * 0.7, seedOff * 1.3);
  const f3 = (p, k, o = 0) => fbm3(p[0] * k + seedOff + o, p[1] * k - o, p[2] * k + seedOff * 0.5, 3);

  // ---- regions per vertex; legs are a continuous blend (legness) following the limb skin field
  const region = new Uint8Array(nV); // 0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
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
    legness[v] = lb >= 0 ? smoothstep(0.15, 0.85, limbMember[v]) : 0;
    if (partOf[v] === 2) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (axialS[v] > sTailBase + 0.01 && bn.startsWith('tail')) { region[v] = 4; tailT[v] = clamp((axialS[v] - sTailBase) / tailLen, 0, 1); }
    else if (axialS[v] < sOcc + 0.004 || (partOf[v] === 1 && neckS(p[0], p[1], p[2]) > 0.006)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) legness[v] = 0;
  }

  // ---- body coordinates: arc along the axis (s) and around it (angle from the dorsal midline)
  const bodyTheta = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const seg = weights.segT[v * 2] | 0, t = weights.segT[v * 2 + 1];
    const a = AXIAL.points[seg], b = AXIAL.points[Math.min(seg + 1, AXIAL.points.length - 1)];
    const c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const p = P(v);
    bodyTheta[v] = Math.atan2(Math.abs(p[0] - c[0]), p[1] - c[1]); // 0 top, pi/2 side, pi belly
  }

  // ---- the head / neck hand-over: the head's look (short face fur combed back from the nose, its colours
  // and markings) and the neck's (the ruff combed down toward the chest, the body's stripes and
  // countershading) are both evaluated across a wide band round the neck cut and blended by position, so
  // hair length, flow, colour and pattern change gradually from the cheek into the neck. (Switching at the
  // region boundary drew a crisp line from under the ear round the jaw: the cheek read as a smooth
  // dome with a rim against the streaky neck fur.)
  const headW = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const r = region[v];
    if (r === 6) headW[v] = 1;
    else if (r === 1 || r === 2) { const p = P(v); headW[v] = smoothstep(-0.012, 0.014, neckS(p[0], p[1], p[2])); }
  }
  const inBand = (v) => (region[v] === 1 || region[v] === 2) && headW[v] > 0.002 && headW[v] < 0.998;
  // the look (colour, hair, flow) a vertex takes outside the band: the skin under the jaw that lies in front of the occiput
  // along the axis (region 2) but behind the band (headW 0: the throat 1.5-3 cm below the chin, on the body mesh) is neck,
  // not face: as face it took the short face hair and the chin's colour, while its neighbours a cell further up, inside
  // the band, were nearly all neck: a pale, short-haired crescent with a crisp edge under the chin, seen from the front
  // and below (the throat's hair rose 4.5 -> 16 mm over 2.5 cm; blue tom seed 12)
  const lookR = Uint8Array.from(region, (r, v) => (r === 2 && headW[v] <= 0.002 ? 1 : r));

  // the chin's pale colour keeps to the midline: ~2 cm wide under the chin and the lower lip, widening to ~3 cm under
  // the throat as it runs back into the neck's pale throat strip (head-local h)
  // the front of the chin (the jaw's own pale patch, seen under the lip from the front), not its sides and underside behind
  const jawFront = (h) => smoothstep(0.008, 0.017, h[2]);
  const chinMid = (h) => { const e = mix(0.017, 0.022, smoothstep(-0.004, -0.03, h[2])); return smoothstep(e, e - 0.009, Math.abs(h[0])); };

  // ---- ventral / countershading factor
  const ventral = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    ventral[v] = inBand(v) ? mix(ventralAt(v, 1), ventralAt(v, 2), headW[v]) : ventralAt(v, lookR[v]);
  }
  function ventralAt(v, r) {
    const p = P(v), n = N(v);
    let w = 0;
    if (r === 0) {
      w = smoothstep(1.75, 2.45, bodyTheta[v]);
      // chest front between the forelegs
      if (p[2] > 0.07) w = Math.max(w, smoothstep(0.16, 0.12, p[1]) * smoothstep(0.03, 0.012, Math.abs(p[0])) * smoothstep(-0.2, 0.4, n[2]));
    } else if (r === 1) {
      // (the pale throat narrows toward the jaw into the chin's ~2 cm strip: at full width, 2/3 of the way up the side
      // of the neck, it showed under the jowl from below and behind the mouth corner as a pale crescent in a low front view)
      const nk = smoothstep(-0.05, -0.008, neckS(p[0], p[1], p[2]));
      w = smoothstep(mix(1.6, 2.25, nk), mix(2.4, 2.85, nk), bodyTheta[v]);
    } else if (r === 4) {
      w = smoothstep(0.0, -0.7, n[1]) * 0.8;
    } else if (r === 2 || r === 6) {
      const h = sub(p, HEAD_O);
      // (only along the midline: the chin and the throat under it, ~2 cm wide, widening back into the neck's throat;
      // every downward-facing head vertex took it, and the throat fill turned the jowl's side down: a pale crescent
      // from the mouth corner along the jowl)
      w = Math.min(1, smoothstep(-0.022, -0.034, h[1]) * smoothstep(-0.1, -0.6, n[1]) + (r === 6 ? 0.8 * jawFront(h) : 0)) * chinMid(h);
    }
    const L = legness[v];
    if (L > 0) {
      const side = p[0] >= 0 ? 1 : -1;
      const inner = smoothstep(0.1, -0.6, n[0] * side);
      const wl = inner * 0.75 * smoothstep(0.04, 0.12, p[1]) + smoothstep(-0.3, -0.85, n[1]) * 0.4;
      w = mix(w, wl, L);
    }
    return clamp(w, 0, 1);
  }

  // ---- comb (hair flow) direction, in bind space
  const comb = new Float32Array(nV * 3);
  // the axial chain's direction, continuous along it: each joint's tangent is the mean of its two segments',
  // interpolated along the segment (the segment's own direction kinked the flow by up to 60 deg where the
  // chain bends: at the occiput the neck's hair turned from 'back' to 'down' across one line)
  const nAx = AXIAL.points.length;
  const segDir = Array.from({ length: nAx - 1 }, (_, i) => norm(sub(AXIAL.points[i + 1], AXIAL.points[i])));
  const jointTan = Array.from({ length: nAx }, (_, j) => (j === 0 ? segDir[0] : j === nAx - 1 ? segDir[nAx - 2] : norm(add(segDir[j - 1], segDir[j]))));
  const axialDir = (v) => {
    const seg = Math.min(weights.segT[v * 2] | 0, nAx - 2), t = clamp(weights.segT[v * 2 + 1], 0, 1);
    return norm(add(mul(jointTan[seg], 1 - t), mul(jointTan[seg + 1], t)));
  };
  const combAt = (v, r) => {
    const p = P(v), n = N(v);
    let d;
    const bone = BONES[dominant[v]];
    if (r === 5) {
      d = norm(sub(bone.tail, bone.head));
    } else if (r === 2 || r === 6) {
      const h = sub(p, HEAD_O);
      // outward from the nose, back over the crown, down and back on the cheeks
      const fromNose = norm(sub(h, [0, -0.016, 0.042]));
      // (the lower cheek and jowl comb back and down into the ruff, and out: the cheek fur flares, its tips standing out
      // of the contour)
      const jowl = smoothstep(0.0, -0.02, h[1]) * smoothstep(0.02, 0.035, Math.abs(h[0]));
      const flare = smoothstep(0.022, 0.036, Math.abs(h[0])) * smoothstep(0.004, -0.012, h[1]);
      d = norm(add(fromNose, [0.35 * flare * (h[0] >= 0 ? 1 : -1), -0.15 - 0.25 * jowl, -0.55]));
      if (h[1] > 0.004 && h[2] < 0.015) d = norm(add(d, [0, 0, -0.8]));
    } else {
      d = axialDir(v);
      if (r === 0) d = norm(add(d, [0, -0.45 * Math.abs(n[0]), 0]));
      // the neck's hair flows back and down toward the shoulders and chest (~35-45 deg below the horizontal
      // on its sides), not straight down the steep neck axis: combed down, it lay along a light from above
      // and the side of the neck behind the cheek went dark, a rim round the face
      if (r === 1) d = norm(add(d, [0, -0.12, -0.45]));
      const L = legness[v];
      if (L > 0 && legBone[v] >= 0) {
        const lbn = BONES[legBone[v]];
        let dl = norm(sub(lbn.tail, lbn.head));
        if (isPaw[legBone[v]]) dl = norm(add(dl, [0, 0, 0.4]));
        else dl = norm(add(dl, [0, -0.2, -0.2]));
        d = norm(add(mul(d, 1 - L), mul(dl, L)));
      }
    }
    return d;
  };
  for (let v = 0; v < nV; v++) {
    const n = N(v);
    let d = combAt(v, lookR[v]);
    // (across the head / neck band the flow turns gradually from the face's (back from the nose) to the
    // neck's (down toward the chest): a 55-60 deg switch at the cut drew a line in the fur)
    if (inBand(v)) d = norm(add(mul(combAt(v, 1), 1 - headW[v]), mul(combAt(v, 2), headW[v])));
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];
  }

  // ---- head marking polylines (head-local), projected onto the skin
  const proj = (q) => projectToSurface(headPrims, [HEAD_O[0] + q[0], HEAD_O[1] + q[1], HEAD_O[2] + q[2]]);
  const mk = (pts, w) => ({ pts: pts.map(proj), w });
  const headLines = [];
  const L3 = (pts, w) => headLines.push(mk(pts.map((q) => q.map((x) => x / 1000)), w.map((x) => x / 1000))); // mm
  if (tabby || COL.ghost) {
    // the "M" on the forehead: bold bars (3-4 mm) rising from the brows and the stop over the crown, where
    // they run on as parallel lines to the nape; the outer pair hooks down over the inner brows, and a
    // short stroke over each eye makes the M's outer legs
    for (const s of [1, -1]) {
      L3([[2.6 * s, 9, 17.5], [3.2 * s, 17, 12], [3.6 * s, 23, 3], [4.2 * s, 27, -10], [4.8 * s, 27, -25], [5.2 * s, 22, -40]], [1.2, 1.6, 1.8, 1.9, 2.0, 1.8]);
      L3([[7.5 * s, 6, 18], [9 * s, 12, 15.5], [10 * s, 19, 9], [11 * s, 25, -4], [12 * s, 26, -20], [12.5 * s, 21, -37]], [1.1, 1.5, 1.7, 1.8, 1.8, 1.6]);
      L3([[12.5 * s, 12, 14.5], [18 * s, 14, 11], [23 * s, 12, 6]], [0.9, 1.1, 0.7]);
      // cheek lines (bold, face1 / face2): from the outer corner of the eye back across the cheek and curving
      // down behind it, a second one from below the eye back along the jowl
      L3([[26 * s, 1, 9], [32 * s, 0, 1], [37 * s, -4, -10], [38 * s, -11, -21], [35 * s, -17, -29]], [1.3, 1.9, 2.1, 1.9, 1.4]);
      L3([[22 * s, -11, 12], [29 * s, -15, 4], [35 * s, -19, -7], [36 * s, -24, -17]], [1.1, 1.6, 1.7, 1.3]);
      // the line down from the inner corner of the eye (the "mascara" line)
      L3([[11.5 * s, -4, 19.5], [10.8 * s, -9, 22.5], [10 * s, -13, 24.5]], [1.0, 0.9, 0.6]);
    }
    L3([[0, 22, 6], [0, 27, -10], [0, 26, -26], [0, 21, -42]], [0.9, 1.5, 1.7, 1.6]);
  }

  // the philtrum cleft (mark channel), from the point of the nose leather down to the upper lip
  const philtrum = mk([[0, -0.0226, 0.0345], [0, -0.0258, 0.033], [0, -0.0285, 0.031]], [0.00032, 0.0003, 0.00026]);
  // the tear line: a fine dark crease from the inner corner of each eye down toward the nose (face1)
  const tearLines = [1, -1].map((s) => mk([[11.6 * s, -1.4, 18.6], [11.0 * s, -4.2, 20.4], [10.3 * s, -7.0, 22.0]].map((q) => q.map((x) => x / 1000)), [0.00034, 0.00028, 0.00012]));

  // ---- white spotting (tuxedo / calico) and calico patch fields
  const white = new Float32Array(nV); // 0..1 field, > 0.5 white
  const spotting = variant === 'tuxedo' || variant === 'calico';
  const wAmt = params.white ?? (variant === 'tuxedo' ? 0.45 : variant === 'calico' ? 0.5 : 0);
  const sockF = params.sockF ?? 0.035, sockH = params.sockH ?? 0.05, blaze = params.blaze ?? 0;
  const whiteAt = (v, r) => {
    const p = P(v), n = N(v);
    const h = sub(p, HEAD_O);
    let w = 0;
    const nz = (f3(p, 18, 3.1) - 0.5) * 0.9 + (f3(p, 42, 7.7) - 0.5) * 0.2; // (low-frequency: solid patches, no flecks)
    if (variant === 'tuxedo' && (r === 0 || r === 1)) {
      // the tuxedo's shirt front: a white bib on the front of the chest between the forelegs and below the
      // throat, wider with more white. (No belly strip or throat strip: their edges ran through the armpits,
      // the flank folds, the groin and the underside of the neck, where the skin stretches most, 60-100 % of
      // the triangles there > 1.5x in the metrics' poses; the front of the chest stretches 0-16 %.)
      const bx = Math.abs(p[0]) + 0.004 * nz;
      w = smoothstep(0.086, 0.102, p[2]) * smoothstep(0.128, 0.142, p[1]) * smoothstep(0.2 + 0.006 * wAmt, 0.188 + 0.006 * wAmt, p[1])
        * smoothstep(0.03 + 0.016 * wAmt, 0.018 + 0.016 * wAmt, bx) * smoothstep(-0.35, 0.1, n[2]);
    } else if (r === 0 || r === 1) {
      // bib on the throat and chest, the belly strip, widening with the amount of white
      const vt = bodyTheta[v];
      const front = smoothstep(sChest + 0.04, sChest - 0.03, axialS[v]);
      w = smoothstep(2.55 - 0.9 * wAmt - 0.35 * front, 2.95 - 0.9 * wAmt - 0.35 * front, vt);
      // the bib: wide on the front of the chest; up the neck only a strip on the throat (its edges along the
      // sides of the neck lay in the skin that stretches most in sleep and the sit)
      const neckK = smoothstep(sNeckBase + 0.01, sNeckBase - 0.025, axialS[v]);
      w = Math.max(w, front * smoothstep(1.7 - 0.6 * wAmt + 0.55 * neckK, 2.2 - 0.6 * wAmt + 0.35 * neckK, vt));
    } else if (r === 2 || r === 6) {
      // muzzle, chin and lower cheeks; an optional blaze up the nose bridge
      const mz = Math.hypot(h[0] / (0.02 + 0.012 * wAmt), (h[1] + 0.03) / (0.016 + 0.01 * wAmt), (h[2] - 0.03) / 0.03);
      w = smoothstep(1.2, 0.9, mz);
      if (r === 6) w = Math.max(w, 0.85);
      // (the tuxedo's white under the jaw stops at the chin: back toward the throat it ran into the head / neck
      // junction, the most stretched skin)
      // (not limited to the midline like the chin colour: a white chin's side edges would run into the skin under the
      // jaw that stretches when the head curls in sleep)
      w = Math.max(w, smoothstep(-0.028, -0.036, h[1]) * smoothstep(-0.1, -0.5, n[1]) * (variant === 'tuxedo' ? smoothstep(0.004, 0.016, h[2]) : 1));
      if (blaze > 0) w = Math.max(w, smoothstep(0.004 + 0.004 * blaze, 0.0015, Math.abs(h[0]) - 0.15 * Math.max(0, -h[1])) * smoothstep(0.012 + 0.012 * blaze, 0.0, h[1]) * smoothstep(0.0, 0.02, h[2]));
    } else if (r === 4) {
      w = variant === 'tuxedo' && params.tailTip ? smoothstep(0.9, 0.94, tailT[v]) : 0;
    }
    const L = legness[v];
    if (L > 0) {
      const front = legBone[v] >= 0 && /^(scapula|humerus|radius|metacarpus|fpaw)/.test(BONES[legBone[v]].name);
      const top = front ? sockF : sockH;
      // (a tuxedo's legs: white socks only; the white inside of the legs ran an edge down every leg)
      const wl = Math.max(smoothstep(top + 0.006, top - 0.006, p[1] + 0.006 * nz), variant === 'tuxedo' ? 0 : ventral[v] * smoothstep(0.5, 0.9, wAmt + 0.3));
      w = mix(w, wl, L);
    }
    return clamp(w + nz * 0.3 * (0.3 + wAmt), 0, 1.5);
  };
  // (not blended across the head / neck band: a tuxedo's white edges stay out of the throat's junction skin, which
  // stretches most: blended, the chin's white faded out across it, +16 near-edge vertices, 31 % > 1.5x)
  if (spotting) for (let v = 0; v < nV; v++) white[v] = whiteAt(v, region[v]);

  // ---- per-vertex fields
  const pattern = new Float32Array(nV).fill(1);
  const patternColor = new Float32Array(nV * 4);
  const markSDF = new Float32Array(nV).fill(1);
  // mouth lining measure (m, > 0 inside the lining) and the width of its ramp (~2 head cells at this tier)
  const lin = new Float32Array(nV).fill(-1);
  const linW = 0.002 * ((ctx.Q && ctx.Q.res) || 1);
  const LINING = [0.42, 0.135, 0.13], LIP = variant === 'ginger' ? [0.085, 0.04, 0.03] : [0.035, 0.025, 0.022];
  const furLen = new Float32Array(nV);
  const capLen = new Float32Array(nV).fill(Infinity);
  const tint = new Float32Array(nV * 4);
  const surf = new Float32Array(nV * 4);

  // tabby stripe geometry (varies by individual)
  // (stripes 8.5 mm wide every 19 mm: ~45 % coverage, gaps 1-1.3 x the stripe width and
  // the photos' 24-34 % dark flank; 7.2 every 21 read pale and sparse)
  const P0 = (params.stripeP || 1) * 0.019, wD = 0.0085 * (params.stripeW || 1), tilt = 0.28;
  const ringP = 0.024, legP = 0.019;
  const sBull = AX[6] + 0.01; // classic bull's-eye centre along the axis (mid flank)
  const phOff = (seedOff * 0.617) % 1; // the stripes' phase along the body, per individual
  const sFly = AX[4] - 0.005; // butterfly centre (over the shoulder blades)

  // the look of a vertex as region r (the head / neck band evaluates both and blends them): base colour and
  // fur length, locket, tabby pattern, white spotting, and the longhair / kitten groom (applied at the end)
  const look = (v, r) => {
    const p = P(v), n = N(v);
    const h = sub(p, HEAD_O), ax = Math.abs(h[0]);
    const L = legness[v];
    const vt = bodyTheta[v];
    let col, fl = 0.012, mark = 1, pat = 1, patC = COL.stripe, patI = COL.stripeInt, patK = PS;
    let agouti = COL.agouti, gloss = COL.gloss, under = COL.under;

    // ================= base colour and fur length by region
    if (r === 0 || r === 1) {
      col = mix3(COL.ground, COL.dorsal, smoothstep(0.9, 0.2, vt));
      col = mix3(col, COL.belly, ventral[v]);
      // coat: back 12.5 mm, flanks 10.5, belly fringe 12.5, chest / neck ruff 13 (shorthair, as laid)
      fl = mix(mix(0.0105, 0.0125, smoothstep(1.0, 0.3, vt)), 0.0125, smoothstep(0.3, 0.9, ventral[v]));
      if (r === 1) fl = Math.max(fl, 0.013);
      if (L > 0) {
        let lc = mix3(COL.legGround, COL.belly, ventral[v] * 0.8);
        // legs: 9 mm on the upper leg to 5 mm at the wrist, 3 mm on the paws; britches on the hind thighs
        let lf = mix(0.0075, 0.0135, smoothstep(0.03, 0.14, p[1]));
        if (p[2] < -0.12) lf = Math.max(lf, 0.013 * smoothstep(-0.2, -0.8, n[2]) * smoothstep(0.08, 0.14, p[1]));
        if (legBone[v] >= 0 && isPaw[legBone[v]]) lf = 0.0035;
        col = mix3(col, lc, L);
        fl = mix(fl, lf, L);
      }
      agouti *= 1 - ventral[v] * 0.7;
    } else if (r === 4) {
      const t = tailT[v];
      col = mix3(COL.ground, COL.belly, ventral[v] * 0.6);
      col = mix3(col, COL.dorsal, smoothstep(0.3, 0.9, n[1]) * 0.5);
      fl = mix(0.016, 0.018, t);
    } else if (r === 5) {
      // the pinna: the back (convex) in the coat colour, darker toward the tip; the front a cup of pink skin
      // through short sparse hair, rosier deep in the concha; long pale furnishings grow only from the inner
      // (medial) margin and the base of the concha (on the whole front, the thin ear's silhouette hair cards
      // painted its back pale from behind); the back's fur wraps over the rim (a 2-3 mm band of the back colour)
      const S = p[0] >= 0 ? 'L' : 'R', E = ears[S];
      const front = smoothstep(0.05, 0.4, dot(n, E.f));
      const ht = dot(sub(p, E.base), E.up) / E.h; // 0 base .. 1 tip
      const u = dot(sub(p, E.base), E.across);
      const hw = 0.022 * (1 - 0.8 * clamp(ht, 0, 1)) + 1e-4;
      const edge = Math.abs(u) / hw;
      const medial = smoothstep(0.35, 0.95, (-u * (dot(E.across, [E.s, 0, 0]) >= 0 ? 1 : -1)) / hw);
      const back = mix3(mix3(COL.dorsal, COL.ground, 0.3), COL.dorsal, smoothstep(0.5, 1.0, ht) * 0.5);
      let inner = mix3(COL.earInner, mix3(COL.earInner, COL.nose, 0.3), smoothstep(0.65, 0.15, ht) * smoothstep(0.9, 0.3, edge) * 0.7);
      // (the furnishings: wisps from the inner margin, thinning toward the tip; at the base of the concha only a few
      // near that margin: a dense band all along the bottom of the opening read as pale fleece)
      const medialSoft = smoothstep(0.0, 0.9, (-u * (dot(E.across, [E.s, 0, 0]) >= 0 ? 1 : -1)) / hw);
      const furnish = Math.max(medial * smoothstep(0.8, 0.35, ht), smoothstep(0.22, 0.0, ht) * 0.4 * medialSoft);
      inner = mix3(inner, COL.chin, 0.12 + 0.45 * furnish);
      const rim = smoothstep(0.8, 1.0, edge) * 0.85;
      col = mix3(back, mix3(inner, back, rim), front);
      fl = mix(0.003, mix(0.0016, 0.0095, furnish), front * (1 - rim));
      if (front > 0.5) { agouti = 0; under = 0; }
      if (ht > 0.88 && lh) fl = Math.max(fl, 0.008); // lynx tips on longhairs
    } else {
      // head & jaw: short on the face (3 mm on the nose bridge and the whisker pads, shorter still round
      // the eyes), 5 mm on the crown, lengthening smoothly into the cheek ruff below and behind the eyes
      // (10.5 mm at the angle of the jaw) and into the neck fur behind the skull. Every change runs over
      // 1-2 cm of skin (and the head's hair may not rise faster than 0.4 mm per mm, furSlope below): no
      // pad with a rim, no ring of long fur round a sunken eye.
      col = mix3(COL.ground, COL.dorsal, smoothstep(0.3, 0.9, n[1]) * smoothstep(0.0, -0.03, h[2]) * 0.5);
      const g3 = (c, rr) => Math.exp(-(((Math.abs(h[0]) - c[0]) / rr[0]) ** 2 + ((h[1] - c[1]) / rr[1]) ** 2 + ((h[2] - c[2]) / rr[2]) ** 2));
      const muzzle = Math.max(g3([0.009, -0.024, 0.027], [0.011, 0.008, 0.012]), g3([0, -0.032, 0.021], [0.012, 0.006, 0.012]));
      // (the lower jaw takes the head's rule, pale on the underside along the midline, and its own pale only at the front of
      // the chin: all pale, the open jaw of a dead cat seen from below was a pale oval with a crisp rim on the darker throat)
      const chinW = Math.max(smoothstep(-0.026, -0.036, h[1]) * smoothstep(-0.1, -0.6, n[1]), r === 6 ? 0.9 * jawFront(h) : 0) * chinMid(h);
      // the pale fur round the eye hugs the lid margin, a band ~1-4 mm outside the aperture and a little wider
      // below the eye (a round blob of it outlined a goggle round every eye)
      let dEye = 1;
      for (const e of eyePrims) dEye = Math.min(dEye, Math.abs(SDFModel.dist(e, p[0], p[1], p[2])));
      const eyeRing = Math.exp(-(((dEye - 0.0015) / (0.0022 + 0.0014 * smoothstep(0.002, -0.006, h[1]))) ** 2)) * 0.26;
      col = mix3(col, COL.chin, clamp(Math.max(muzzle * 0.9, chinW, eyeRing * (tabby ? 1 : 0.3)), 0, 1));
      fl = mix(0.0052, 0.003, smoothstep(0.004, 0.024, h[2]));
      // the cheek fur flares: 11 mm on a queen's widest cheek and jowl, ~13 on a tom's, 14.5 on a heavy jowled tom
      // (research 6: 15-20 mm, more in toms), rising from the face's 4-5 mm over ~18 mm of skin below and behind the
      // outer corner of the eye, and running on into the ruff, a little longer still (no local maximum of the fur
      // surface at the cheek). (6 mm there drew the face as a smooth short-haired dome with a clean contour;
      // the fur-inclusive face 2.2 x the inter-pupil distance at the cheeks, photos 2.45-2.6)
      const tomK = clamp(((params.jowl || 1) - 0.97) / 0.21, 0, 1);
      // (a kitten's round face has no flaring jowls yet: 7.5 mm, which its fluff multiplier makes ~10.5; its adult's
      // 11-14.5 framed the kitten's face in a ruff like a lion's mane)
      const cheekL = juv ? 0.0075 : mix(0.011, 0.0145, tomK);
      // (the whole side of the head behind the eye, not only the jowl: the temple at 90 % of the cheek's length. With 6-10
      // mm there the shells drew a sleek, untufted dome whose edge, where the tufted 12-16 mm ruff began, was the crisp
      // outline)
      // (not up to the eye: the long cheek hair starts 5 mm from the eye's aperture and is full 1.6 cm away; it reached the
      // lid margin's short hair at the outer corner and below the eye, and the slope limit made a 0.4-0.65 mm-per-mm bevel
      // ring round every eye: raised goggles with their own outline in the death pose)
      const sideW = smoothstep(0.02, 0.034, ax) * smoothstep(0.016, 0.0, h[1]) * smoothstep(0.016, 0.0, h[2]) * smoothstep(0.005, 0.016, dEye);
      fl = mix(fl, cheekL * (0.9 + 0.1 * smoothstep(0.004, -0.012, h[1])), sideW);
      // (the cheek just below and behind the eye a little paler, as in face1 / face2: the longer cheek fur renders darker
      // than the short face fur, its deep shells in shadow, which ringed the face like a frame; not along the jowl, where
      // a paler band drew a pale crescent from the mouth corner in a backlit close-up)
      col = mix3(col, COL.chin, sideW * 0.1 * smoothstep(0.004, -0.006, h[1]) * smoothstep(-0.026, -0.016, h[1]) * smoothstep(-0.008, 0.004, h[2]) * (tabby ? 1 : 0.4));
      const lateral = smoothstep(0.018, 0.03, ax) * smoothstep(0.012, -0.004, h[1]);
      // (a longhair's ruff climbs from the crown over 5 cm: multiplied up to 3.6x, the adult's 2.4 cm ramp rose 1.5 mm per mm)
      // (the ruff stays behind the mouth corner: the neck's cut plane is tilted, and its ramp put 8-10 mm of hair (longhair
      // 15-17) on the lower lip and the mouth corner below the short-haired face, a pale groove between them, a sunken pocket)
      const ruff = mix(smoothstep(lh ? 0.05 : 0.028, 0.004, neckS(p[0], p[1], p[2])) * smoothstep(0.016, -0.006, h[2]), smoothstep(-0.012, lh ? -0.055 : -0.04, h[2]), lateral);
      fl = mix(fl, Math.max(0.012, cheekL + 0.001), ruff);
      // the lower jaw (its own mesh) takes the head's fur lengths at the same place, short only at the front
      // of the chin: its own shorter hair (3-6.5 mm among the throat's 5-12) sank it into a pale pocket
      // between the jowls, seen from below and at the corner of the mouth
      if (r === 6) fl = Math.min(fl, mix(0.0034, 0.012, smoothstep(0.014, -0.016, h[2])));
      agouti *= 0.7;
    }

    // ================= a small white locket on the chest (some black and blue cats)
    if (params.locket && (r === 0 || r === 1)) {
      const ls = params.locketSize ?? 1;
      const lk = Math.hypot(p[0] / (0.015 * ls), (p[1] - 0.16) / (0.022 * ls), (p[2] - 0.13) / 0.03) + 0.35 * (f3(p, 60, 4.4) - 0.5);
      const lw = smoothstep(1.0, 0.75, lk) * smoothstep(-0.2, 0.3, n[2]);
      if (lw > 0) { col = mix3(col, COL.white, lw); agouti *= 1 - lw; }
    }

    // ================= tabby pattern
    if (tabby || COL.ghost) {
      let d = 1;
      if (r === 0 || r === 1) {
        const s = axialS[v];
        const varc = vt * 0.048; // arc down from the dorsal midline (m)
        if (!classic) {
          // mackerel: wavy stripes leaning back as they run down; they break into dashes low on the flank
          const wob = 0.9 * (f3([s * 1.2, varc, 0], 26, 1.7) - 0.5) + 0.25 * (n2(s * 90, varc * 40) - 0.5);
          const ph = (s - AX[3]) / P0 + tilt * varc / P0 + wob + phOff;
          const fi = ph - Math.round(ph);
          const ww = wD * (0.8 + 0.5 * n2(Math.round(ph) * 3.1, varc * 30));
          d = Math.abs(fi) * P0 - ww / 2;
          const brk = smoothstep(0.045, 0.09, varc) * smoothstep(0.4, 0.8, n2(s * 160 + Math.round(ph) * 7, varc * 70));
          d += brk * 0.01;
          // dorsal stripe
          d = Math.min(d, varc - (0.0065 + 0.0025 * n2(s * 60, 1.3)));
        } else {
          // classic: three spine lines, the bull's-eye on each flank, the butterfly on the shoulders
          const spine = Math.min(Math.abs(varc) - 0.0028, Math.abs(varc - 0.0105) - 0.0026);
          // (the bull's-eye centred mid-flank and bold: a dark centre and two broad rings, warped; a small crisp
          // target high on the flank read as a stamped logo)
          // (an irregular 'oyster': the ring radius swings with the angle and winds outward a little, a spiral,
          // not a target)
          const ds = s - sBull, dv = varc - 0.07, th = Math.atan2(dv, ds);
          const rr = Math.hypot(ds * 0.95, dv * 1.1) * (1 + 0.16 * Math.sin(th + seedOff) + 0.1 * Math.sin(2 * th + 1.3 * seedOff) + 0.45 * (f3(p, 32, 2.2) - 0.5))
            + 0.0045 * (th / Math.PI) + 0.008 * (f3(p, 80, 6.1) - 0.5);
          const bull = Math.min(rr - 0.02, Math.abs(rr - 0.045) - 0.0058, Math.abs(rr - 0.07) - 0.0062);
          const fs = s - sFly, fv = varc - 0.028;
          const rf = Math.hypot(fs * 1.4, fv * 1.1);
          const fly = Math.min(Math.abs(rf - 0.014) - 0.0035, rf - 0.004);
          // stripes on the neck, the lower flanks and toward the rump continue as mackerel-like bars
          const ph = (s - AX[3]) / P0 + 0.6 * (f3([s, varc, 0], 30, 4.4) - 0.5) + phOff;
          const bars = (Math.abs(ph - Math.round(ph)) * P0 - wD * 0.6) + smoothstep(0.07, 0.04, varc) * smoothstep(sNeckBase + 0.03, sNeckBase + 0.06, s) * 0.02;
          // (the bars stop short of the whorl: a ground gap round its outer ring)
          d = Math.min(spine, bull, fly, Math.max(bars, 0.0035 * smoothstep(0.092, 0.078, rr)));
        }
        // behind the hips the skin faces back and the axial arc barely changes over it, so one stripe filled
        // each buttock (a dark oval): there the phase runs by height, the bars curling down the thigh
        const rumpW = smoothstep(-0.25, -0.65, n[2]) * smoothstep(AX[7] - 0.012, AX[8] - 0.002, s);
        if (rumpW > 0.001) {
          const phR = p[1] / (P0 * 0.95) + 0.35 * (n2(p[0] * 60, p[1] * 60) - 0.5);
          d = mix(d, Math.abs(phR - Math.round(phR)) * P0 * 0.95 - wD * 0.42, rumpW);
        }
        // underside: the belly is plain with a few spots; the throat and the front of the chest carry two or
        // three thin "necklace" rings instead of the flank stripes (the axial arc is compressed round the
        // neck), fading out toward the sides and back along the chest (a ring on a plane ran as a straight
        // line along the side of the chest and stopped abruptly)
        const vent = smoothstep(1.9, 2.5, vt);
        if (s > sChest + 0.02) {
          d += vent * 0.02;
          if (vent > 0.5) d = Math.min(d, (n2(p[0] * 300, p[2] * 300) > 0.82 ? -0.001 : 1));
        } else {
          const ny = p[1] + 0.25 * (p[2] - 0.12);
          const neck = Math.min(Math.abs(ny - 0.177) - 0.0022, Math.abs(ny - 0.152) - 0.0025, Math.abs(ny - 0.129) - 0.002 + 0.004 * n2(p[0] * 200, 3.3));
          const nw = smoothstep(1.2, 2.0, vt) * smoothstep(-0.15, 0.4, n[2]) * smoothstep(sChest + 0.02, sChest - 0.02, s);
          d += vent * 0.02 * (1 - nw);
          d = mix(d, neck, nw);
        }
      } else if (r === 4) {
        const st = tailT[v] * tailLen;
        const ph = st / ringP + 0.25 * (n2(st * 40, 2.2) - 0.5);
        d = Math.abs(ph - Math.round(ph)) * ringP - 0.0045 * (0.9 + 0.3 * tailT[v]);
        d += ventral[v] * 0.004;
        if (st < 0.02) d = Math.max(d, 0.02 - st); // no ring right at the root
        d = Math.min(d, (tailLen - 0.038) - st); // dark tip
      } else if (r === 2) {
        for (const ln of headLines) d = Math.min(d, distPolyline(p, ln.pts, ln.w));
        patK = PS * 2; // (the face's short hair: half the strand raggedness of the body stripes on these bars)
      }
      if (L > 0) {
        // leg bars on the front and outside of the legs, the inside plain; plain paws
        const side = p[0] >= 0 ? 1 : -1;
        const outer = smoothstep(-0.5, 0.2, n[0] * side + 0.6 * n[2]);
        const ph = p[1] / legP + 0.3 * (n2(p[1] * 80, p[2] * 80) - 0.5) + 0.25 * (p[2] > 0 ? 1 : -1);
        let dl = Math.abs(ph - Math.round(ph)) * legP - 0.0038;
        dl += (1 - outer) * 0.012 + smoothstep(0.03, 0.015, p[1]) * 0.02;
        d = mix(d, dl, L);
      }
      pat = d;
      if (COL.ghost) patI = Math.min(1, COL.stripeInt * (params.ghost ?? 1)) * (0.6 + 0.4 * smoothstep(0.4, 0.9, n[1]));
      else patI = Math.min(1, COL.stripeInt * (params.stripeC ?? 1));
    }

    // ================= spotting / calico
    if (spotting) {
      const w = white[v];
      const dW = (0.5 - w) * 0.018; // < 0 inside the white
      if (variant === 'tuxedo') {
        col = w > 0.5 ? COL.white : col;
        pat = dW; patC = COL.white; patI = 1;
        if (w > 0.3) { agouti = 0; under = 0.1; }
      } else {
        // calico: white base; orange patches in the pattern channel, black patches in the mark channel
        const big = f3(p, 16, 11.3) - 0.5, fine = f3(p, 55, 5.1) - 0.5;
        const nO = (big + 0.25 * fine) * 0.03;
        if (wAmt < 0.05) {
          // tortoiseshell: black and orange brindle all over
          col = mix3(COL.black, COL.orangeDark, smoothstep(0.62, 0.8, f3(p, 140, 2.9)) * 0.7);
          pat = -nO - 0.003 + 0.004 * (f3(p, 90, 8.8) - 0.5) * 3; patC = COL.orange; patI = 1;
          agouti = 0.1;
        } else {
          col = COL.white;
          // (the orange runs on under the black by ~2 mm (nO changes ~0.33 per metre at the patch edges): both switched
          // at nO = 0 over the white base, and their edge jitter let the white show as a spiky fringe along every
          // orange / black border; the black, in the mark channel, is drawn over the orange)
          pat = Math.max(-dW, -nO - 0.0008); patC = mix3(COL.orange, COL.orangeDark, smoothstep(0.4, 0.8, f3(p, 60, 1.1)) * 0.6); patI = 1;
          mark = Math.min(mark, Math.max(-dW, nO));
          agouti = 0.08;
        }
      }
    }

    // ================= longhair / kitten groom (a multiplier and an addition on the final length)
    let kMul = 1, kAdd = 0;
    if (lh) {
      let k = 3.2;
      // (the short face and the long ruff framing it meet gradually: the multiplier grows with the adult's own
      // face-to-ruff length ramp, 1.4x on the face to 3.6x where the head meets the neck; a hard gate stepped
      // the hair from 1.4x to 2.4x across one line, and 2.4x -> 3.8x at the neck, a flat mask set in the ruff)
      // (up to 2.6x on the head, whose cheeks now carry 11-15 mm themselves: 3.6x made them 4-5 cm, a fur wall
      // round the face; the neck's ruff stays 3.8x)
      if (r === 2) k = mix(1.4, 2.6, smoothstep(0.0045, 0.012, fl));
      if (r === 6) k = 2.2;
      if (r === 5) k = 1.3;
      if (L > 0) k = mix(k, p[1] < 0.03 ? 2.2 : 2.8, L); // toe tufts, feathered legs
      if (r === 4) k = 3.8; // plume
      if (r === 1) k = 3.8; // ruff
      kMul = k;
    }
    // the cobby blue's dense plush coat stands off the body (British type): up to 30 % deeper on the trunk, neck and
    // the ruff behind the cheeks, not on the face or the lower legs (nor on a longhair's head: on top of its own 2.6x)
    if (params.cob) {
      const plush = 1 + 0.3 * params.cob;
      const where = r === 0 || r === 1 ? 1 - smoothstep(0.3, 0.9, L) : r === 2 ? smoothstep(0.006, 0.011, fl) * (lh ? 0 : 1) : r === 4 ? 0.6 : 0;
      kMul *= mix(1, plush, where);
    }
    if (juv) {
      // a kitten's face (muzzle, nose bridge, round the eyes, forehead: the adult's short face fur) stays
      // short; its cheeks, throat and the back of the head take the body's fluff, ramping with the adult's
      // own face-to-ruff length (a short-haired disc in a fluffy coat read as a mask)
      const face = r === 2 || r === 6 ? smoothstep(0.0072, 0.0038, fl) : 0;
      kMul *= mix(1.15, 1.1, face); kAdd = mix(0.002, 0.0013, face); // (the face a little fluffier too: 0.8 mm left a short-haired disc in the fluff)
    }
    return { col, fl, mark, pat: pat * patK, patC, patI, agouti, gloss, under, kMul, kAdd };
  };

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    const h = sub(p, HEAD_O), ax = Math.abs(h[0]);
    const L = legness[v];
    let o = look(v, lookR[v]);
    if (inBand(v)) {
      const a = look(v, 2), b = look(v, 1), w = headW[v];
      o = {
        col: mix3(b.col, a.col, w), fl: mix(b.fl, a.fl, w), mark: mix(b.mark, a.mark, w), pat: mix(b.pat, a.pat, w),
        patC: mix3(b.patC, a.patC, w), patI: mix(b.patI, a.patI, w), agouti: mix(b.agouti, a.agouti, w),
        gloss: mix(b.gloss, a.gloss, w), under: mix(b.under, a.under, w), kMul: mix(b.kMul, a.kMul, w), kAdd: mix(b.kAdd, a.kAdd, w),
      };
    }
    let { col, fl, mark, pat, patC, patI, agouti, gloss, under } = o;
    let mat = MAT.FUR, zone = false; // (zone: the lid margin's or the mouth's short hair, kept through the rounding below)

    // ================= skin: eye rims, nose leather, lips, third eyelid, pads
    if (r === 2 || r === 6) {
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        // the lids' hair very short up to the margin (the dark lid margin itself is the eye shader's, on the
        // moving lids: see sculpt.js); (no bare band at the rim: furred skin without shells renders as the dark
        // skin under the coat and ringed the eye, a shut one like a coin)
        if (Math.abs(de) < 0.004) { fl = Math.min(fl, mix(0.0008, 0.005, smoothstep(0.0, 0.004, Math.abs(de)))); zone = true; }
      }
      for (const e of nictPrims) if (SDFModel.dist(e, p[0], p[1], p[2]) < 0.0003) { mat = MAT.NOSE; col = COL.nict; fl = 0; mark = 1; pat = 1; }
      // nose leather: an inverted triangle on the front of the nose (its top edge ~13 mm wide where the
      // bridge fur ends, the sides running down to a point in the philtrum), nostrils at the lower corners
      const dn = SDFModel.dist(nosePrim, p[0], p[1], p[2]);
      // (10.8 mm wide, 8.2 tall: 0.29 x 0.22 of the inter-pupil distance in face1 / face2; 13 mm drew a big
      // pink nose)
      const nyTop = -0.015, nyBot = -0.0232, nW = 0.0054, nH = nyTop - nyBot;
      const dSide = (ax * nH - (h[1] - nyBot) * nW) / Math.hypot(nH, nW);
      const dTri = Math.max(dSide, h[1] - nyTop + 0.0015 * (ax / nW) ** 2);
      const onNose = dn < 0.0016 && h[2] > 0.029 && n[2] > -0.2;
      if (onNose && dTri < 0) { mat = COL.noseMat; col = COL.nose; fl = 0; pat = 1; mark = 1; }
      else if (onNose && dTri < 0.0008 && COL.noseRim) mark = Math.min(mark, dTri - 0.0004);
      // the philtrum: a fine dark cleft from the point of the leather down to the lip
      if (r === 2 && ax < 0.002 && h[2] > 0.025) mark = Math.min(mark, distPolyline(p, philtrum.pts, philtrum.w));
      if (r === 2 && ax > 0.007 && ax < 0.015 && h[1] < 0.002 && h[1] > -0.01 && h[2] > 0.014) mark = Math.min(mark, distPolyline(p, tearLines[h[0] > 0 ? 0 : 1].pts, tearLines[h[0] > 0 ? 0 : 1].w));
      // the mouth: skin the closed jaw hides (the palate over the lower jaw, the jaw's top inside the lips:
      // the part in front of the skin, 1.5 mm out along its normal, is inside the other surface) is mouth
      // lining; a fine dark lip line runs only along the mouth slit (above the chin's lower edge), not round
      // the chin where the lower jaw meets the throat and the jowls
      // (only skin well inside the other surface, or facing it across the mouth slit, is lining: every vertex whose
      // normal-offset point lay inside the other part took it, which drew a jagged dark-red ring round the chin wherever
      // the jaw met the head's underside, seen from below)
      // (the lining's edge is a smooth signed measure, lin > 0 inside: as a per-vertex material switch its rim followed the
      // mesh triangles, and an open mouth (death, hiss) showed a jagged black and white saw edge along the lips: see below)
      const q = [p[0] + n[0] * 0.0015, p[1] + n[1] * 0.0015, p[2] + n[2] * 0.0015];
      const slit = h[1] > -0.0305;
      if (partOf[v] !== 2) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (dj < 0.0025) {
          const lv = Math.min(Math.max(-0.0006 - dj, Math.min(-SDFModel.evalList(jawPrims, q[0], q[1], q[2]), h[1] + 0.0305)), h[2] + 0.004, h[1] + 0.04);
          lin[v] = lv;
          if (lv <= 0 && dj < 0.0012 && h[2] > 0.0 && slit) { mark = Math.min(mark, dj - 0.0006); fl = Math.min(fl, 0.0012); zone = true; }
        }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        const lv = Math.min(Math.max(-0.0006 - dh, Math.min(-SDFModel.evalList(headPrims, q[0], q[1], q[2]), h[1] + 0.0305)), h[2] + 0.004);
        lin[v] = lv;
        if (lv <= 0 && dh < 0.001 && slit) { mark = Math.min(mark, dh - 0.0005); fl = Math.min(fl, 0.0012); zone = true; }
      }
    }
    if (L > 0.5 && legBone[v] >= 0 && isPaw[legBone[v]]) {
      // paw pads: bare leather on the soles (the metacarpal / metatarsal pad and the four toe beans)
      let dp = 1;
      for (const pp of padPrims) dp = Math.min(dp, SDFModel.dist(pp, p[0], p[1], p[2]));
      if (dp < 0.0007 && n[1] < -0.25 && p[1] < 0.012) { mat = COL.padMat; col = COL.pad; fl = 0; pat = 1; mark = 1; }
    }

    // ================= low-frequency colour variation (and the rusty cast of a black coat in the sun)
    const cv = fbm3(p[0] * 30, p[1] * 30, p[2] * 30, 3) - 0.5;
    const cvh = fbm3(p[0] * 12 + 5, p[1] * 12, p[2] * 12, 2) - 0.5;
    if (mat === MAT.FUR) {
      col = [col[0] * (1 + 0.14 * cv + 0.08 * cvh), col[1] * (1 + 0.12 * cv), col[2] * (1 + 0.1 * cv - 0.06 * cvh)];
      if (COL.rust && (variant === 'black' || white[v] < 0.5)) col = mix3(col, COL.rust, clamp(0.25 + 0.5 * cvh, 0, 0.5) * smoothstep(0.2, 0.9, n[1]));
    }

    // ================= longhair / kitten groom
    if (mat === MAT.FUR && fl > 0) fl = fl * o.kMul + o.kAdd;

    // ================= mouth lining: wet pink skin inside the lips, a dark lip margin at its edge
    // The material id is interpolated across each triangle and rounded in the shader, so a lining that switched per vertex
    // drew its rim along the mesh triangles; and as MOUTH (3) next to FUR (0) the rim passed through ids 1 and 2 (a black
    // band). An open mouth (the death pose, the hiss) showed it as a jagged black and white saw edge along the lips (the
    // white teeth were the chin fur's shells, cut off at the same zigzag). The lining is now tinted leather (1: no id
    // between it and fur) with a fractional id that ramps with the smooth measure lin across ~2 cells, so the 0.5 crossing
    // (the lip margin) runs smoothly through the triangles; the fur shortens into it, and its colour darkens toward it.
    let matOut = mat;
    if (mat === MAT.FUR && lin[v] > -0.5 * linW) {
      const a = clamp(0.5 + lin[v] / linW, 0, 1);
      matOut = a;
      fl = Math.min(fl, 0.0007 + 1.2 * Math.max(0, -lin[v])); zone = true;
      col = lin[v] > 0 ? mix3(LIP, LINING, smoothstep(0.0, 0.0012, lin[v])) : mix3(col, LIP, 0.35 * smoothstep(-0.5 * linW, 0, lin[v])); pat = 1;
    }

    markSDF[v] = mark * PS;
    pattern[v] = pat; // (look() stores it x patK)
    furLen[v] = fl;
    if (zone) capLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = matOut;
    patternColor[v * 4] = patC[0]; patternColor[v * 4 + 1] = patC[1]; patternColor[v * 4 + 2] = patC[2]; patternColor[v * 4 + 3] = patI;
    // no silhouette fins on the head, the jaw and the neck, fading in over the front of the chest behind the neck base (render
    // hint finMask, surf.y = 1 = none); the legs, the body and the tail keep theirs. A fin is drawn after every shell and is
    // depth-tested only against the skin, so a fin on fur that lies BEHIND a nearer furry contour is painted over that
    // contour's soft fringe of outer shells, and the fringe ends in a crisp line at the nearer skin's silhouette: the neck's
    // fins behind the cheek drew the face's outline from below the ear round the jaw (the blue's round disc with its own
    // outline in a low front view; a render without them has a soft fringe where the cheek's hair lies over the neck), and the
    // head's own fins (the head's ring of 1-2 cm dark-rooted cards: the kitten's hood, the longhair's mask and crest, the
    // blue's cheek plate; 70 % on the lower back of the cheek: a dark band along the jowl) drew a rim of their own
    const isFur = mat === MAT.FUR && matOut < 0.5;
    const finOff = !isFur ? 0 : r === 6 || r === 2 || r === 1 ? 1 : r === 0 ? (1 - smoothstep(sNeckBase, sChest + 0.01, axialS[v])) * (1 - legness[v]) : 0;
    surf[v * 4] = gloss; surf[v * 4 + 1] = finOff; surf[v * 4 + 2] = isFur ? agouti : 0; surf[v * 4 + 3] = isFur ? under : 0;
  }

  // clamp far-away distances (a huge value blows up the shader's antialiasing width)
  for (let v = 0; v < nV; v++) {
    pattern[v] = clamp(pattern[v], -0.05, 0.05);
    markSDF[v] = clamp(markSDF[v], -0.05, 0.05);
  }

  // smooth fur length a little so shells do not step
  const nb = weights.neighbors;
  const tmp = new Float32Array(nV);
  for (let it = 0; it < 2; it++) {
    for (let v = 0; v < nV; v++) {
      const ns = nb[v];
      if (!ns.length || tint[v * 4 + 3] > 0) { tmp[v] = furLen[v]; continue; }
      let a = 0;
      for (const u of ns) a += furLen[u];
      tmp[v] = 0.5 * furLen[v] + (0.5 * a) / ns.length;
    }
    furLen.set(tmp);
  }
  // the pipeline's fur-slope limit (core/build/furSlope.js): on the face hair may rise at most 0.4 mm per
  // mm of skin above the hair around it (lids, nose, whisker pads -> cheek ruff and crown), so the coat
  // surface round the eyes and cheeks stays smooth; 1 (the default) elsewhere
  // (the side of the head behind and below the outer corner of the eye, 0.65: at 0.4 the flaring cheek fur could not
  // rise from the face's 4-5 mm to its 11-15 mm within the cheek, and stayed a sleek 6-10 mm dome)
  const furSlope = new Float32Array(nV).fill(1);
  for (let v = 0; v < nV; v++) {
    if (lookR[v] !== 2 && lookR[v] !== 6) continue;
    const h = sub(P(v), HEAD_O);
    furSlope[v] = mix(0.4, 0.65, smoothstep(0.02, 0.03, Math.abs(h[0])) * smoothstep(0.016, 0.004, h[1]) * smoothstep(0.016, 0.004, h[2]));
  }
  // The face's hair rounded after the slope limit. Where the painted length rises faster than the limit allows (the lid
  // margin -> the cheek, the whisker pad and the mouth corner -> the jowl, the chin -> the throat) the limit leaves a bevel
  // of straight slope with a crease where it meets the longer hair, and the shells draw that crease as a line on the coat:
  // a ring round each eye (goggles), a straight edge across the lower cheek of the dead blue tom (seed 12, the cheek's long
  // hair ending at 0.65 mm per mm toward the face), a rim round the chin from below. The limit is applied here (as the
  // pipeline does after the coat) and the head's lengths are then averaged over ~4 mm of skin (the lid margins and the
  // mouth keep their short hair), so every change of length runs into its neighbours without a crease; the pipeline's
  // limit then finds (almost) nothing left to cut.
  limitFurSlope(furLen, ctx.pos, ctx.index, nV, tint, { slope: FUR_SLOPE_DEFAULTS.slope, free: FUR_SLOPE_DEFAULTS.free, perVertex: furSlope });
  {
    const hres = (ctx.Q && ctx.Q.res) || 1;
    const its = Math.max(3, Math.round(32 / (hres * hres)));
    const face = new Uint8Array(nV);
    for (let v = 0; v < nV; v++) face[v] = (lookR[v] === 2 || lookR[v] === 6 || headW[v] > 0.002) && tint[v * 4 + 3] === 0 && furLen[v] > 0 ? 1 : 0;
    for (let it = 0; it < its; it++) {
      for (let v = 0; v < nV; v++) {
        if (!face[v]) { tmp[v] = furLen[v]; continue; }
        let a = 0, c = 0;
        for (const u of nb[v]) if (tint[u * 4 + 3] === 0 && furLen[u] > 0) { a += furLen[u]; c++; }
        tmp[v] = c ? Math.min(capLen[v], 0.5 * furLen[v] + (0.5 * a) / c) : furLen[v];
      }
      furLen.set(tmp);
    }
  }
  // the head and body surfaces' skin weights made equal across the neck cut (regions.js): posed, they parted at the
  // hand-over (the core passes the weights to the coat and uses them after it)
  harmonizeSeamWeights(ctx);
  void limbWhich;
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, furSlope, stats: { variant }, region, ventral, tailT, headW };
}
