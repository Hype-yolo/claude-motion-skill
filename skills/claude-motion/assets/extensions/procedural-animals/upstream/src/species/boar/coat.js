// The wild boar's coat: coarse, grizzled bristles (pale tips, dark band, brown woolly roots) over a
// dark grey-brown body, a mane of long bristles from the nape to mid-back (it rises when the boar is
// alarmed: P.furRaise with render.raiseLen), flaring grizzled "sideburns" on the cheeks, a paler
// grizzled snout, near-black legs, a bare dark snout disc, hairy erect ears with a fringe, a thin tail
// with a long tassel, ivory tusks and dark cloven hooves.
// Age classes: striped piglets ("humbugs": crisp cream stripes on rufous-brown, dark bands between
// them, running from the shoulder to the rump, broken lines on the face and the thighs) and the
// uniform red-brown yearling coat. Colour morphs of adults: dark (default), black, pale grey-fawn.
// Works in the reference space (see rig.js).
import { HEAD_O, HZ, HY } from './rig.js';
import { neckS } from './regions.js';
import { tuskPath } from './sculpt.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, smoothField } from '../../core/build/coatKit.js';

// sRGB swatches sampled from the reference photos. The shells darken
// hair roots and add a dark agouti band, so the albedo here is the bristle colour, lighter than the
// animal reads in photos (#3C3B41 overall on side2).
export const COATS = {
  dark: { base: 0x6c625a, dorsal: 0x4a423c, belly: 0x524842, face: 0x857c72, snout: 0x948a80, legs: 0x2a2826, mane: 0x2e2a27, agouti: 0.6, under: 0.35 },
  black: { base: 0x4a4542, dorsal: 0x33302e, belly: 0x433e3a, face: 0x68625c, snout: 0x7a746c, legs: 0x1c1a1a, mane: 0x1e1c1b, agouti: 0.55, under: 0.25 },
  pale: { base: 0x948a7e, dorsal: 0x72695f, belly: 0x867c70, face: 0xa39a8e, snout: 0x9e968c, legs: 0x2e2a28, mane: 0x3a3430, agouti: 0.8, under: 0.45 },
  brown: { base: 0x7e6654, dorsal: 0x5a4a3c, belly: 0x6a5646, face: 0x8e7e6c, snout: 0x8e806e, legs: 0x2a2420, mane: 0x352b24, agouti: 0.7, under: 0.35 },
  yearling: { base: 0x86603e, dorsal: 0x6c4a30, belly: 0x8a6444, face: 0x8e6644, snout: 0x7e5c40, legs: 0x4a3222, mane: 0x6a4428, agouti: 0.25, under: 0.2 },
  piglet: { base: 0xb07a4a, dorsal: 0x7a4e2c, belly: 0xd8b088, face: 0xa8764a, snout: 0x94683e, legs: 0x8a5a36, mane: 0x6e4526, agouti: 0, under: 0.1, stripe: 0xe4bf8e, band: 0x6e4526 },
};
const DISC = 0x3a3440, DISC_PIG = 0x5a4038, HOOF = 0x26221f, TUSK = 0xede6d2, TUSK_BASE = 0xb7a585;

function palette(p) {
  const C = COATS[p.coat] || COATS.dark;
  const k = p.coatShade || 0, l = p.coatLightness || 0;
  const tw = (hex) => { const c = srgb(hex); return [c[0] * (1 + 0.1 * k + l), c[1] * (1 + 0.03 * k + l), c[2] * (1 - 0.07 * k + l)]; };
  const out = {};
  for (const key of ['base', 'dorsal', 'belly', 'face', 'snout', 'legs', 'mane']) out[key] = tw(C[key]);
  out.agouti = C.agouti; out.under = C.under;
  out.stripe = C.stripe ? srgb(C.stripe) : null; out.band = C.band ? tw(C.band) : null;
  out.disc = srgb(p.coat === 'piglet' ? DISC_PIG : DISC); out.hoof = srgb(HOOF);
  out.tusk = srgb(TUSK); out.tuskBase = srgb(TUSK_BASE);
  return out;
}

const HOOF_TAGS = new Set(['hoof', 'heelbulb', 'dewclaw']);

export function boarCoat(ctx) {
  const { model, rig, pos, nrm, regionOf, regionNames, weights, nV, params, lists } = ctx;
  const { BONES } = rig;
  const J = rig.J;
  const R = rng(9173 + (params.coatSeed || 0));
  const COL = palette(params);
  const piglet = params.coat === 'piglet';
  const young = params.age === 'juvenile';
  const winter = params.winter ?? 0.5; // 0 sparse summer bristles .. 1 long winter coat
  const maneK = params.mane ?? 1;
  const { dominant, axialS, skinIndex, skinWeight, limbMember } = weights;
  const AX_LEN = weights.axialLengths;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8];
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const jawPrims = model.forPart('jaw');
  const headPrims = model.forPart('body').filter((p) => p.bone === 'head' && !p.carve);
  const nostrilPrims = model.prims.filter((p) => p.tag === 'nostril');
  const discPrims = model.prims.filter((p) => p.tag === 'disc');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof|femur|tibia|metatarsus|hpaw|hhoof)/.test(b.name));
  const isFront = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|fhoof)/.test(b.name));
  const HL = (p) => { const d = sub(p, HEAD_O); return [d[0], dot(d, HY), dot(d, HZ)]; };
  // the snout's length varies (sculpt.js hz(): piglets short): landmarks along it move with it
  const snoutL = params.snout ?? 1;
  const hz = (z) => (z > 0.12 ? 0.12 + (z - 0.12) * snoutL : z);
  const partName = (v) => regionNames[regionOf[v]];
  const tusks = [['lower', 1], ['lower', -1], ['upper', 1], ['upper', -1]].map(([w, s]) => tuskPath(params, s, w));

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

  // --- regions: 0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw, 7 tusk
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
    if (pn === 'tusk' || pn === 'tuskup') region[v] = 7;
    else if (pn === 'jaw') region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (bn.startsWith('tail') && axialS[v] > sTailBase + 0.01) region[v] = 4;
    else if (axialS[v] < sOcc + 0.01 || (pn === 'head' && neckS(p[0], p[1], p[2]) > 0.02)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) legness[v] = 0;
  }

  // --- piglet stripes: longitudinal bands around the body axis (angle from the dorsal midline in the
  // cross-section), seeded wobble and breaks. Returns the signed distance (m) to the pale stripes.
  const axisY = (z) => mix(0.47, 0.45, smoothstep(0.2, -0.4, z));
  const stripeAng = [0.26, 0.52, 0.79, 1.06, 1.33, 1.62]; // radians from the dorsal midline (pale stripes)
  const stripeW = [0.06, 0.055, 0.055, 0.055, 0.06, 0.07];
  const stripeSeed = R() * 100;
  const stripeSDF = (p, r) => {
    if (r === 7 || r === 5 || r === 4) return 1;
    let yc = axisY(p[2]);
    let ang = Math.atan2(Math.abs(p[0]), p[1] - yc);
    let rad = Math.hypot(p[0], p[1] - yc);
    // the stripes run from behind the ears to the rump, fading out on the legs
    const zf = smoothstep(0.42, 0.3, p[2]) * smoothstep(-0.6, -0.5, p[2]);
    if (r === 2 || r === 6) {
      // face: a stripe from the eye along the side of the snout (broken lines on the head)
      const h = HL(p);
      const ay = Math.atan2(Math.abs(h[0]), h[1] + 0.02);
      const d = (Math.abs(ay - 1.05) - 0.07) * Math.hypot(h[0], h[1] + 0.02);
      return Math.max(d, (h[2] - 0.2) * 0.3, (-0.08 - h[2]) * 0.3) + (fbm3(h[0] * 60 + stripeSeed, h[1] * 60, h[2] * 30, 2) - 0.5) * 0.008;
    }
    let d = 1;
    const wob = (fbm3(p[0] * 9 + stripeSeed, p[1] * 9, p[2] * 5, 3) - 0.5) * 0.12;
    for (let i = 0; i < stripeAng.length; i++) {
      const a = stripeAng[i] + wob + 0.05 * Math.sin(p[2] * 6 + i);
      d = Math.min(d, (Math.abs(ang - a) - stripeW[i] * 0.5) * rad);
    }
    // breaks: stripes split into dashes here and there
    const br = vnoise3(p[2] * 18 + stripeSeed, ang * 6, 3.1);
    d = Math.max(d, (br - 0.8) * 0.05);
    d = d * zf + (1 - zf) * Math.max(d, 0.01 + 0.02 * (1 - zf));
    return d;
  };

  // --- ventral factor
  const ventral = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const n = N(v), r = region[v], p = P(v);
    let w = 0;
    if (r === 0) w = smoothstep(-0.2, -0.8, n[1]) * smoothstep(0.4, 0.28, p[1]);
    else if (r === 1) w = smoothstep(0.0, -0.7, n[1]) * 0.5;
    const L = legness[v];
    if (L > 0) { const side = p[0] >= 0 ? 1 : -1; w = mix(w, smoothstep(0.1, -0.7, n[0] * side) * 0.5 * smoothstep(0.2, 0.35, p[1]), L); }
    ventral[v] = w;
  }

  // --- mane: the dorsal strip from the crown between the ears (world z ~0.45) down the nape to mid-back
  // (0..1); the head mesh paints it too, so the crest runs on over the crown instead of starting at the
  // neck seam
  const maneOf = (p, n) => {
    const along = smoothstep(0.52, 0.38, p[2]) * smoothstep(-0.22, -0.02, p[2]);
    const across = 1 - smoothstep(0.025, 0.07, Math.abs(p[0]));
    return along * across * smoothstep(0.3, 0.7, n[1] + 0.2);
  };

  // --- comb (hair flow)
  const comb = new Float32Array(nV * 3);
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v], tag = tagOf[v];
    const bone = BONES[dominant[v]];
    let d;
    if (r === 5) d = norm(sub(bone.tail, bone.head));
    else if (r === 7) d = [0, 1, 0];
    else if (r === 2 || r === 6) {
      // face: from the disc back along the snout; the cheek bristles flare back and down
      // ("sideburns"), the crown hair runs back to the nape
      const h = HL(p);
      d = norm(add(mul(HZ, -1), [0, 0, 0]));
      if (h[1] < 0.01 && Math.abs(h[0]) > 0.03) d = norm(add(mul(HZ, -1), add(mul(HY, -0.7), [Math.sign(h[0]) * 0.4, 0, 0])));
      // the crest over the crown stands up and back like the mane it runs into
      const mn = r === 2 ? maneOf(p, n) : 0;
      if (mn > 0) d = norm(add(mul(d, 1 - 0.4 * mn), [Math.sign(p[0] || 1) * 0.25 * mn, 0.6 * mn, 0]));
    } else if (r === 4) {
      d = norm(sub(bone.tail, bone.head));
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = rig.AXIAL.points[seg], b = rig.AXIAL.points[Math.min(seg + 1, rig.AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.6 * Math.abs(n[0]), 0]));
      if (r === 1) d = norm(add(d, [0, -0.5, 0.1]));
      // mane bristles stand up and back, parted along the spine
      const mn = maneOf(p, n);
      if (mn > 0) d = norm(add(mul(d, 1 - 0.4 * mn), [Math.sign(p[0] || 1) * 0.25 * mn, 0.6 * mn, 0]));
      const L = legness[v];
      if (L > 0 && legBone[v] >= 0) {
        const lbn = BONES[legBone[v]];
        let dl = norm(sub(lbn.tail, lbn.head));
        if (/hoof/.test(lbn.name)) dl = [0, -1, 0.1];
        else dl = norm(add(dl, [0, -0.3, 0]));
        d = norm(add(mul(d, 1 - L), mul(dl, L)));
      }
    }
    void tag;
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
  const bodyFl = mix(0.022, 0.04, winter) * (young ? 0.6 : 1);

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v], tag = tagOf[v];
    let col, mat = MAT.FUR, fl = bodyFl, mark = 1, gloss = 0.45, agouti = COL.agouti, under = COL.under, finOff = 0;
    let pd = 0.02;
    const lb = legBone[v];
    const lbName = lb >= 0 ? BONES[lb].name : '';
    if (r === 0 || r === 1) {
      const up = clamp(n[1], -1, 1);
      col = mix3(COL.base, COL.dorsal, smoothstep(0.2, 0.95, up) * 0.8);
      col = mix3(col, COL.belly, ventral[v]);
      fl = mix(bodyFl, bodyFl * 0.6, ventral[v]);
      // neck and shoulders: longer, coarser bristles
      fl *= (1 + 0.2 * smoothstep(0.0, 0.3, p[2])) * (1 - 0.3 * smoothstep(-0.15, -0.45, p[2]));
      const mn = maneOf(p, n) * maneK;
      if (mn > 0) { fl = mix(fl, (young ? 0.045 : 0.11 + 0.04 * winter), mn); col = mix3(col, COL.mane, mn * 0.8); }
      if (tag === 'teat') { mat = MAT.SKIN; fl = 0.002; col = [0.12, 0.08, 0.07]; }
      if (tag === 'sheath') fl = 0.05; // (the tuft)
      const L = legness[v];
      if (L > 0) {
        const lfl = mix(0.012, 0.03, smoothstep(0.08, 0.3, p[1])) * (young ? 0.8 : 1);
        fl = mix(fl, lfl, L);
        // legs darken to near-black below the elbows / stifles
        col = mix3(col, COL.legs, L * smoothstep(0.34, 0.2, p[1]) + (piglet ? 0 : 0.3 * L));
      }
      if (/hoof|paw/.test(lbName) && HOOF_TAGS.has(tag)) {
        const Cj = J[(lbName[0] === 'f' ? 'fcoffin' : 'hcoffin') + BONES[lb].side];
        if (tag === 'dewclaw' || p[1] < Cj[1] + 0.006 + 0.35 * (p[2] - Cj[2])) {
          mat = MAT.KERATIN; fl = 0; gloss = 0.45;
          col = COL.hoof;
          if (tag === 'heelbulb') col = mix3(col, [0.06, 0.05, 0.045], 0.5);
        }
      }
      if (piglet && mat === MAT.FUR) {
        pd = stripeSDF(p, r);
        // dark bands between the pale stripes (a second, wider field)
        const band = clamp(-pd / 0.012 + 1.6, 0, 1);
        col = mix3(col, COL.band, 0.55 * (1 - band) * smoothstep(0.28, 0.45, p[1]) * (1 - L));
        pd = pd + 0.4 * L * smoothstep(0.32, 0.2, p[1]); // (not on the lower legs)
      }
    } else if (r === 4) {
      col = mix3(COL.dorsal, COL.legs, 0.3);
      fl = 0.012;
      if (tag === 'tassel') { fl = young ? 0.035 : 0.075; col = COL.mane; }
    } else if (r === 5) {
      // ears: densely haired, with a long fringe along the edges and tip
      const earP = model.prims.find((q) => q.tag === 'ear' && (q.bone === (p[0] > 0 ? 'earL' : 'earR')));
      const faceDir = [earP.P[9], earP.P[10], earP.P[11]];
      const front = dot(n, faceDir);
      col = mix3(COL.dorsal, COL.face, 0.2);
      fl = young ? 0.012 : 0.02;
      const eb = BONES[dominant[v]], ab = sub(eb.tail, eb.head);
      const t = dot(sub(p, eb.head), ab) / dot(ab, ab);
      if (front > 0.3) { fl = 0.016; col = mix3(col, [0.05, 0.045, 0.04], 0.3); }
      const edge = 1 - Math.abs(front);
      fl += (young ? 0.01 : 0.03) * smoothstep(0.3, 0.9, edge) * smoothstep(0.3, 0.9, t);
      if (piglet) pd = 1;
    } else if (r === 7) {
      // tusk: ivory, stained brownish at the base, a sharp whetted edge
      let bt = 0, bd = 1e9;
      for (const H of tusks) for (let i = 0; i + 1 < H.length; i++) {
        const a = H[i].p, b = H[i + 1].p, ab = sub(b, a);
        const u = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0, 1);
        const q = add(a, mul(ab, u)), dd = len(sub(p, q));
        if (dd < bd) { bd = dd; bt = H[i].t + (H[i + 1].t - H[i].t) * u; }
      }
      mat = MAT.KERATIN; fl = 0; gloss = 0.7;
      col = mix3(COL.tuskBase, COL.tusk, smoothstep(0.1, 0.5, bt));
      col = mul(col, 0.92 + 0.12 * vnoise3(p[0] * 400, p[1] * 400, p[2] * 400));
      pd = 1;
    } else {
      // head & jaw: grizzled face, paler along the snout and cheeks, short bristles on the snout,
      // long flaring cheek bristles, bare dark disc
      // (no silhouette fins on the head (render finMask): its sparse cards drew a see-through fringe round
      // the face, the skin's outline showing inside it; the shells carry the face's coat)
      const h = HL(p);
      col = mix3(COL.dorsal, COL.face, smoothstep(-0.02, 0.1, h[2]) * 0.8);
      const side = smoothstep(0.02, 0.05, Math.abs(h[0]));
      col = mix3(col, COL.snout, smoothstep(0.08, hz(0.2), h[2]) * (1 - smoothstep(hz(0.24), hz(0.28), h[2])) * (0.5 + 0.5 * side));
      // dark crown and around the eyes
      col = mix3(col, COL.dorsal, smoothstep(0.01, 0.06, h[1]) * smoothstep(0.1, -0.02, h[2]) * 0.6);
      fl = mix(0.03, 0.012, smoothstep(0.05, hz(0.22), h[2])) * (young ? 0.7 : 1);
      // sideburns: long bristles on the jowls flaring back
      const jowl = smoothstep(0.0, -0.05, h[1]) * smoothstep(0.09, -0.02, h[2]) * smoothstep(0.03, 0.06, Math.abs(h[0]));
      fl = mix(fl, young ? 0.03 : 0.06 + 0.02 * winter, jowl);
      // (the face and jowls only: the crest at the back of the skull keeps its fins with the mane)
      finOff = Math.max(smoothstep(-0.03, 0.04, h[2]), jowl);
      col = mix3(col, COL.face, jowl * 0.5);
      // the bristly crest from the crown on into the mane
      if (r === 2) {
        const mn = maneOf(p, n) * maneK;
        if (mn > 0) { fl = mix(fl, (young ? 0.045 : 0.11 + 0.04 * winter), mn); col = mix3(col, COL.mane, mn * 0.8); }
      }
      // the jaw underside darker
      if (r === 6) col = mix3(col, COL.dorsal, 0.35);
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.0035) mark = Math.min(mark, Math.abs(de) - 0.0018);
        if (Math.abs(de) < 0.0014) { mat = MAT.DARK_SKIN; fl = 0; }
        else if (Math.abs(de) < 0.005) fl = Math.min(fl, 0.004);
        else if (de < 0.016) fl = Math.min(fl, mix(0.004, 0.014, (de - 0.005) / 0.011));
      }
      // snout disc: bare, dark, moist; its rim a crisp mark
      let dd = 1e9;
      for (const e of discPrims) dd = Math.min(dd, SDFModel.dist(e, p[0], p[1], p[2]));
      const discFace = dot(n, HZ);
      if (h[2] > hz(0.265) && dd < 0.004 && discFace > 0.25) { mat = MAT.NOSE; fl = 0; col = COL.disc; gloss = 0.7; }
      else if (h[2] > hz(0.25)) { fl = Math.min(fl, 0.006); col = mix3(col, COL.disc, 0.5 * smoothstep(hz(0.25), hz(0.28), h[2])); }
      for (const e of nostrilPrims) {
        const dn = SDFModel.dist(e, p[0], p[1], p[2]);
        if (dn < 0.003) { mat = MAT.NOSE; col = mul(COL.disc, 0.4); fl = 0; mark = Math.min(mark, dn - 0.0015); }
      }
      // lips and mouth
      // (the closed mouth shows only a dark lip line: the red mouth lining is painted where the two
      // surfaces lie inside each other, which shows only when the jaw opens)
      if (regionNames[regionOf[v]] !== 'jaw') {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        if (dj < -0.001 && h[2] > 0.0) { mat = MAT.MOUTH; fl = 0; }
        else if (dj < 0.002 && h[2] > 0.0) { mat = MAT.DARK_SKIN; fl = 0; col = [0.03, 0.026, 0.024]; }
        else if (dj < 0.006 && h[2] > 0.0) { mark = Math.min(mark, dj - 0.004); fl = Math.min(fl, 0.004); }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        if (dh < -0.001) { mat = MAT.MOUTH; fl = 0; }
        else if (dh < 0.002) { mat = MAT.DARK_SKIN; fl = 0; col = [0.03, 0.026, 0.024]; }
        else if (dh < 0.0045) { mark = Math.min(mark, dh - 0.0035); fl = Math.min(fl, 0.003); }
      }
      // short hair where the tusks come out of the lips (the tusks stay visible)
      if (tag === 'tuskboss' || tag === 'upperlip') fl = Math.min(fl, 0.006);
      if (piglet && mat === MAT.FUR) pd = stripeSDF(p, r);
      agouti *= 0.7;
    }
    // low-frequency colour variation
    const cv = fbm3(p[0] * 6, p[1] * 6, p[2] * 6, 3) - 0.5;
    if (mat === MAT.FUR) col = [col[0] * (1 + 0.16 * cv), col[1] * (1 + 0.13 * cv), col[2] * (1 + 0.1 * cv)];
    // coarse bristles: lock-to-lock shade streaks
    if (mat === MAT.FUR && fl > 0.02) {
      const c = [comb[v * 3], comb[v * 3 + 1], comb[v * 3 + 2]];
      const along = dot(p, c), q = sub(p, mul(c, along));
      const st = vnoise3(q[0] * 120, q[1] * 120, q[2] * 120 + along * 3);
      col = mul(col, 0.84 + 0.32 * st);
    }
    if (mat !== MAT.FUR) pd = Math.max(pd, 0.02);
    pattern[v] = piglet ? Math.min(0.02, pd) : 0.02;
    patInt[v] = piglet ? 1 : 0;
    if (piglet) { patCol[v * 3] = COL.stripe[0]; patCol[v * 3 + 1] = COL.stripe[1]; patCol[v * 3 + 2] = COL.stripe[2]; }
    markSDF[v] = mark;
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    surf[v * 4] = gloss; surf[v * 4 + 1] = mat === MAT.FUR ? finOff : 0; surf[v * 4 + 2] = mat === MAT.FUR ? agouti : 0; surf[v * 4 + 3] = mat === MAT.FUR ? under : 0;
  }
  smoothField(furLen, weights.neighbors, 2, (v) => tint[v * 4 + 3] !== MAT.FUR);

  const patternColor = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) { patternColor[v * 4] = patCol[v * 3]; patternColor[v * 4 + 1] = patCol[v * 3 + 1]; patternColor[v * 4 + 2] = patCol[v * 3 + 2]; patternColor[v * 4 + 3] = patInt[v]; }
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, stats: {}, region, ventral };
}
