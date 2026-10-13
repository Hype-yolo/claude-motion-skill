// The lion's coat, painted per vertex in reference space.
//
// An essentially uniform tawny coat: a
// slightly darker, greyer back, warm flanks grading into the cream belly, inner legs and throat,
// white chin, lips and muzzle sides, pale crescents above and below the eyes, a black lip line with
// a black spot at the corner of the mouth, rows of black whisker-base dots, black ear backs, the
// black tail tuft and pink-to-black freckled nose leather (darker with age). Cubs are woolly and
// greyer with faint dark rosettes and spots, strongest on the legs and belly; adults keep a trace
// of them on the lower legs. The male's mane is long, clumped hair over the sculpted mane volume:
// blond at the face ruff, darkening toward its rear and lower edge (params.maneDark 0 blond .. 1
// black), with a chest bib and elbow tufts.
import { HEAD_O, HS, FACE, toFace, lionJoints } from './rig.js';
import { neckS, splitFor } from './regions.js';
import { whiskerFollicles, follicleRoot } from './whiskers.js';
import { EYE } from './sculpt.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, smoothField, poissonFeatures, featureDistance } from '../../core/build/coatKit.js';

const PAL = {
  // neutral-light photo swatches, hue turned ~4 deg toward red (the photos' tawny is hue 25-30 deg)
  dorsal: 0x9c8066, flank: 0xae9276, lowFlank: 0xbfa58a, belly: 0xd8cab8, legOuter: 0xb09478, legInner: 0xd2c1aa,
  face: 0xb39b7e, crown: 0xa68d71, muzzle: 0xf0e8da, chin: 0xefe6d6, eyePatch: 0xeee2ce, earBack: 0x1c1410, earInner: 0xd6c6ae, earCup: 0x7a6452,
  earBackCentre: 0x9a7b5a, tuft: 0x140e0a, tailTip: 0x5a3e28, paw: 0xb89c80,
  maneBlond: 0xc6a070, maneMid: 0x6b4523, maneDark: 0x2a1b10,
  nosePink: 0x9a7a72, noseDark: 0x2e2220, lipDark: 0x16100e, nostril: 0x140e0d, mouth: 0x4a2426, tongue: 0xa8585c, tooth: 0xe8e0cc, pad: 0x2e2220, tear: 0x4a3526, browMark: 0x7a5a40,
  cubBody: 0xbfa27f, cubSpot: 0x8c6a48, whiskerDot: 0x2a1c14,
  whiteBody: 0xede4d3,
};

function palette(p) {
  const k = p.coatWarmth || 0, l = p.coatLightness || 0, juv = p.juv || 0, white = p.variant === 'white';
  const out = {};
  for (const [key, hex] of Object.entries(PAL)) {
    let c = srgb(hex);
    if (!/nose|nostril|mouth|tongue|tooth|pad|tuft|earBack$|maneDark|tear|lipDark|whiskerDot/.test(key)) {
      c = [c[0] * (1 + 0.18 * k + l), c[1] * (1 + 0.04 * k + l), c[2] * (1 - 0.2 * k + l)];
      // (+7 % saturation: the neutral-light swatches read grey beside the sunlit photos)
      const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      c = c.map((x) => Math.max(0, Y + (x - Y) * 1.07));
    }
    // cubs: greyer, woollier natal coat; the body colours fade toward it
    if (juv > 0 && /dorsal|flank|legOuter|face|crown/.test(key)) c = mix3(c, srgb(PAL.cubBody), 0.6 * juv);
    // leucistic "white lion": cream coat, pale tuft and ear backs, normal dark lips and eye rims
    // (the face's own tones kept faintly, a warm cream on the brow, the bridge and round the eyes, and the tear
    // lines and brow spots a light brown (ffront_African_Lion_*_Female, white_Guylaine2007_*, white_Flickr_*): an even white face read
    // as a plush toy with no structure at all)
    if (white && !/nose|nostril|mouth|tongue|tooth|pad|cubSpot|lipDark|whiskerDot/.test(key)) c = mix3(c, srgb(PAL.whiteBody), /tuft|earBack$|maneDark|maneMid/.test(key) ? 0.72 : /^(tear|browMark)$/.test(key) ? 0.3 : /^(face|crown)$/.test(key) ? 0.5 : 0.85); // (0.45 / 0.64 still cream on cream, ffront_African_Lion_*_Female / white_Flickr_*: warm tan brows and tear lines)
    out[key] = c;
  }
  // white lions keep a pink nose (research 6: #D2968A), mottling only faintly
  // the leather darkens with age: pink-brown in young adults, dusky in old ones (plus the black mottling)
  out.nosePink = mix3(srgb(0xb0877c), srgb(0x7c5e58), clamp(p.noseDark ?? 0.3, 0, 1));
  // (a duller, greyer pink: #d2968a read as a saturated red-pink on the pale face)
  if (white) { out.nosePink = srgb(0xb3928a); out.noseDark = srgb(0x5e4844); } // (darker toward the rim, ffront_African_Lion_*_Female: a dark-rimmed leather)
  return out;
}

// the mane's ruff radiates from the face centre; the ears' bases (reference space) keep the mane short
const MANE_FC = [HEAD_O[0], HEAD_O[1] - 0.035 * HS, HEAD_O[2] + 0.02 * HS];
const EAR_BASES = (() => { const J = lionJoints(); return [J.earBaseL, [-J.earBaseL[0], J.earBaseL[1], J.earBaseL[2]]]; })();
// the lower half of each pinna (base -> half way to the tip): the mane round it rises from the ear's own short fur
const EAR_SEGS = (() => { const J = lionJoints(); return [1, -1].map((s) => { const a = [J.earBaseL[0] * s, J.earBaseL[1], J.earBaseL[2]]; const t = [J.earTipL[0] * s, J.earTipL[1], J.earTipL[2]]; return { a, d: [(t[0] - a[0]) * 0.55, (t[1] - a[1]) * 0.55, (t[2] - a[2]) * 0.55] }; }); })();

// distance from the ear bases (the lower pinna's axis; behind them it counts 0.55 x)
const earDist = (p) => {
  let dEar = 1;
  for (const { a, d } of EAR_SEGS) {
    const t = clamp(((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]), 0, 1);
    const q = [p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t, p[2] - a[2] - d[2] * t];
    dEar = Math.min(dEar, Math.hypot(q[0], q[1], Math.min(0, q[2]) * 0.55 + Math.max(0, q[2])));
  }
  return dEar;
};
// the longest hair at a distance d from the ear base (m): rising from the ear's own short fur at ~0.9 mm per mm to 25 mm within ~2.5 cm,
// then the mane's full length (the fur-slope limit lets hair over 25 mm rise faster: a mane's bevel)
// (the ears sit in the mane; capped over 5-10 cm round them, a maned male's crown hair stood apart from the cheek
// ruff as a cap with the ears on its rim, mfront_*, m34_Lion_head_turned: one ruff from the cheeks over the crown, the pinnae in it)
const earCap = (d) => (d < 0.026 ? 0.011 + 0.9 * Math.max(0, d - 0.008) : 1);

export function lionCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, regionNames, weights, nV, params } = ctx;
  const canineRegion = regionNames ? regionNames.indexOf('canine') : -1;
  const { BONES, AXIAL } = rig;
  const AX_LEN = weights.axialLengths;
  const R = rng(9173 + (params.coatSeed || 0));
  const C = palette(params);
  const juv = params.juv || 0;
  const male = params.sex === 'male' && !juv ? 1 : 0;
  const whiteV = params.variant === 'white';
  const maneDark = params.maneDark ?? 0.5;
  const maneK = params.mane || 0;
  const noseAge = params.noseDark ?? 0.3;
  const spotsK = juv ? 1 : (params.legSpots ?? 0.2); // faint rosettes (cub) / their trace on adult legs
  const hw = 1.12 + 0.02 * male - 0.04 * juv;
  const nOff = (params.coatSeed || 0) % 997;
  const { dominant, axialS, skinIndex, skinWeight, limbMember, limbWhich } = weights;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8], sTip = AX_LEN[AX_LEN.length - 1];
  const tailLen = sTip - sTailBase;
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const nosePrims = model.prims.filter((p) => p.tag === 'nose');
  const caninePrims = model.prims.filter((p) => p.tag === 'canine');
  const nostrilPrims = model.prims.filter((p) => p.tag === 'nostril');
  const manePrims = model.prims.filter((p) => p.tag === 'mane');
  const tuftPrims = model.prims.filter((p) => p.tag === 'tuft');
  const elbowPrims = model.prims.filter((p) => p.tag === 'elbowtuft');
  const jawPrims = model.forPart('jaw').filter((p) => p.tag !== 'canine');
  // the closed mouth's envelope (the jaw without its trough, and the trough filled): the head skin inside it is
  // the palate and the inside of the lips; the trough (the jaw's mouth carve) and the tongue
  const jawSolid = jawPrims.filter((p) => !p.carve && p.tag !== 'tongue');
  const mouthPrim = jawPrims.find((p) => p.tag === 'mouth' && p.carve);
  const tonguePrim = jawPrims.find((p) => p.tag === 'tongue');
  const envelope = (x, y, z) => Math.min(SDFModel.evalList(jawSolid, x, y, z), mouthPrim ? SDFModel.dist(mouthPrim, x, y, z) : 1);
  const bodyPrims = model.forPart('body');
  const headPrims = bodyPrims.filter((p) => p.bone === 'head' && !p.carve && p.tag !== 'canine' && p.tag !== 'mane');
  const earPrims = model.prims.filter((p) => p.tag === 'ear');
  const earInnerPrims = model.prims.filter((p) => p.tag === 'earinner');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|femur|tibia|metatarsus|hpaw)/.test(b.name));
  const isPaw = BONES.map((b) => /^(fpaw|hpaw)/.test(b.name));
  const isFront = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw)/.test(b.name));
  const headLocal = (p) => [(p[0] - HEAD_O[0]) / hw / HS, (p[1] - HEAD_O[1]) / HS, (p[2] - HEAD_O[2]) / HS];
  // the pinna's frame: 0 at the base joint .. 1 at the tip joint, the bowl's facing direction, the distance to
  // the bowl (the ear's carve)
  const earFrame = (p) => {
    const S = p[0] > 0 ? 'L' : 'R';
    const eb = rig.J['earBase' + S], et = rig.J['earTip' + S];
    const eu = norm(sub(et, eb)), eL = len(sub(et, eb));
    const q = earPrims.find((e) => (e.P[0] > 0) === (p[0] > 0)) || earPrims[0];
    const inner = earInnerPrims.find((e) => (e.P[0] > 0) === (p[0] > 0));
    return { up: eu, ht: dot(sub(p, eb), eu) / eL, facing: [q.P[9], q.P[10], q.P[11]], dIn: inner ? SDFModel.dist(inner, p[0], p[1], p[2]) : 1 };
  };
  // the left eye's corners on the skin (face units): the liner's wing runs back from the outer one, the tear
  // line down from the inner one
  const EF = eyeFrameOf(EYE, HEAD_O, 1), halfW = Math.sqrt(EYE.R * EYE.R - EYE.d * EYE.d);
  const corners = [1, -1].map((g) => toFace(headLocal(add(add(EF.c, mul(EF.x, g * halfW)), mul(EF.z, EYE.r * 1.02)))));
  const eyeOut = Math.abs(corners[0][0]) > Math.abs(corners[1][0]) ? corners[0] : corners[1];
  const EM = FACE.E * HS; // metres per face unit
  // distance (face units) from f to the segment a -> a + d, and the position along it
  const seg = (f, a, d) => {
    const t = clamp(((f[0] - a[0]) * d[0] + (f[1] - a[1]) * d[1] + (f[2] - a[2]) * d[2]) / (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]), 0, 1);
    return [Math.hypot(f[0] - a[0] - d[0] * t, f[1] - a[1] - d[1] * t, f[2] - a[2] - d[2] * t), t];
  };

  // a rounded box's signed distance in the face plane (centre (0, cy), half sizes hx, hy, corner radius r) and a smooth union
  const sdRBox = (x, y, cy, hx, hy, r) => { const qx = Math.abs(x) - hx + r, qy = Math.abs(y - cy) - hy + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
  const sminP = (a, b, k) => { const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };

  // the lowest point of the head's surface in the column at (|X|, Z) (face units): the rim of the upper lip, which the
  // lip line follows (cached on a 0.01 E grid)
  const lipPrims = headPrims.filter((q) => { const c = toFace(headLocal([q.P[0], q.P[1], q.P[2]])); return c[1] < -0.3 && c[2] > -1.4; });
  const lipCache = new Map();
  const lipBottom = (ax, z) => {
    const i = Math.round(ax * 100), j = Math.round(z * 100), key = i * 1000 + j;
    if (lipCache.has(key)) return lipCache.get(key);
    let yb = null;
    const X = (i / 100) * FACE.X * hw * HS, Z = HEAD_O[2] + (FACE.EZ + (j / 100) * FACE.E) * HS;
    for (let Y = -1.75; Y <= -0.95; Y += 0.005) {
      if (SDFModel.evalList(lipPrims, HEAD_O[0] + X, HEAD_O[1] + (FACE.EY + Y * FACE.E) * HS, Z) < 0) { yb = Y; break; }
    }
    lipCache.set(key, yb);
    return yb;
  };

  // --- regions per vertex (0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw) and limb blend
  const region = new Uint8Array(nV);
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  const junction = new Float32Array(nV);
  const tailT = new Float32Array(nV);
  const maneW = new Float32Array(nV);
  const maneD = new Float32Array(nV).fill(1); // distance to the sculpted mane volume (m)
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
    if (partOf[v] === 2) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (axialS[v] > sTailBase + 0.03 && bn.startsWith('tail')) { region[v] = 4; tailT[v] = clamp((axialS[v] - sTailBase) / tailLen, 0, 1); }
    else if (axialS[v] < sOcc + 0.01 || (partOf[v] === 1 && neckS(p[0], p[1], p[2]) > 0.03)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) { legness[v] = 0; junction[v] = 0; }
    // mane: skin on (or just outside) the sculpted mane volume
    if (manePrims.length && region[v] !== 4 && region[v] !== 5 && region[v] !== 6) {
      const dm = SDFModel.evalList(manePrims, p[0], p[1], p[2]);
      maneD[v] = dm;
      // (the edge broken by noise over the shoulders and the chest: a clean offset of the mane volume read
      // as a helmet with a hard rim)
      // (round the face the hair lengthens over ~7 cm: over 3.5 cm it stood as a hood edge showing its dark roots)
      // (over the forehead the short face fur runs up to the ear line, face_male1 / threequarter_youngmale1: a 7 cm
      // margin there drew the crest forward over the brow as a hood edge and hid the ears)
      const edge = p[2] < 0.66 ? 0.025 + 0.06 * fbm3(p[0] * 9 + nOff, p[1] * 9, p[2] * 9, 2) + 0.05 * vnoise3(p[0] * 22 + nOff, p[1] * 22, p[2] * 22) : mix(0.07, 0.012, smoothstep(0.15, 0.55, nrm[v * 3 + 1]));
      maneW[v] = smoothstep(edge, -0.004, dm) * (1 - legness[v] * 0.8);
    }
  }
  smoothField(maneW, weights.neighbors, 3);
  // the face's relief in its paint (a smooth swollen dome, a plush toy, worst in the showcase's soft light and
  // on the pale white lion): an occlusion term from the head's own field (how far the skin a few mm to 2.5 cm out along the normal lies
  // inside the head), so the creases round the eyes, under the brows, beside the bridge, between the pads and the cheeks and under
  // the jaw shade darker as the hair does in the photos (ffront_*, white_Flickr_*: the structure reads in the coat's shading)
  const cav = new Float32Array(nV), curv = new Float32Array(nV);
  {
    const near = (q) => Math.hypot(q.P[0] - HEAD_O[0], q.P[1] - HEAD_O[1], q.P[2] - HEAD_O[2]) < 0.42;
    const cavBody = model.prims.filter((q) => q.part === 'body' && near(q) && q.tag !== 'canine' && q.tag !== 'lipedge' && q.tag !== 'mane'); // (not the mane's volume: hair, not a surface that shades the face)
    const cavJaw = model.forPart('jaw').filter((q) => q.tag !== 'tongue' && q.tag !== 'canine' && !(q.carve && q.tag === 'mouth'));
    const fld = (x, y, z) => Math.min(SDFModel.evalList(cavBody, x, y, z), SDFModel.evalList(cavJaw, x, y, z));
    const H = [0.005, 0.011, 0.02, 0.032, 0.046], Wt = [0.3, 0.26, 0.2, 0.14, 0.1];
    for (let v = 0; v < nV; v++) {
      if (region[v] !== 2 && region[v] !== 6) continue;
      if (partOf[v] === canineRegion) continue;
      const p = P(v), n = N(v);
      let o = 0;
      for (let i = 0; i < H.length; i++) { const h = H[i]; o += Wt[i] * Math.max(0, h - fld(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h)) / h; }
      cav[v] = clamp(o, 0, 1);
      // the field's Laplacian over ~1.6 cm (twice the mean curvature, 1/m: > 0 on ridges and bumps, < 0 in creases and hollows)
      const hL = 0.016, f0 = fld(p[0], p[1], p[2]);
      curv[v] = (fld(p[0] + hL, p[1], p[2]) + fld(p[0] - hL, p[1], p[2]) + fld(p[0], p[1] + hL, p[2]) + fld(p[0], p[1] - hL, p[2]) + fld(p[0], p[1], p[2] + hL) + fld(p[0], p[1], p[2] - hL) - 6 * f0) / (hL * hL);
    }
    smoothField(cav, weights.neighbors, 2);
    smoothField(curv, weights.neighbors, 2);
  }
  if (globalThis.process?.env?.LION_CAV) { const acc = {}; for (let v = 0; v < nV; v++) { if (region[v] !== 2) continue; const f = toFace(headLocal(P(v))); if (f[1] < -1.0 && N(v)[1] < -0.3) continue; const k = `${(Math.round(Math.abs(f[0]) * 4) / 4).toFixed(2)},${(Math.round(f[1] * 4) / 4).toFixed(2)}`; if (f[2] < Math.abs(f[0]) * 0 - 0.6) continue; (acc[k] ||= []).push(globalThis.process.env.LION_CAV === 'curv' ? curv[v] : cav[v]); } const rows = {}; for (const [k, a] of Object.entries(acc)) { const [x, y] = k.split(','); a.sort((p, q) => p - q); (rows[y] ||= {})[x] = a[Math.floor(a.length * 0.5)].toFixed(globalThis.process.env.LION_CAV === 'curv' ? 0 : 2); } for (const y of Object.keys(rows).sort((a, b) => b - a)) console.log(y.padStart(6), Object.keys(rows[y]).sort((a, b) => a - b).map((x) => x + ':' + rows[y][x]).join(' ')); }
  // head / neck paint blend: across the boundary of the head's paint region (3 cm past the neck cut, or the
  // occiput's axial station) the head's colour, hair length and flow hand over to the neck's over ~12 cm (a
  // hard switch drew a seam line down each side of a lioness's neck in the shells)
  const hbw = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const r = region[v];
    if (r === 6) { hbw[v] = 1; continue; }
    if (r !== 1 && r !== 2) continue;
    const p = P(v);
    hbw[v] = Math.max(smoothstep(-0.03, 0.09, neckS(p[0], p[1], p[2])), smoothstep(sOcc + 0.06, sOcc - 0.04, axialS[v]));
  }
  // chest fringe (dark-maned males): 20-25 cm of hair on the brisket below the mane's bib, falling between
  // the forelegs (side_walk_male4, front_walk_male2, threequarter_male2)
  const fringe = new Float32Array(nV);
  if (male && maneK > 0) {
    const fk = smoothstep(0.35, 0.85, maneDark) * smoothstep(0.4, 0.8, maneK);
    for (let v = 0; v < nV && fk > 0; v++) {
      if (region[v] > 1) continue;
      const p = P(v), n = N(v);
      fringe[v] = fk * smoothstep(0.18, 0.3, p[2]) * smoothstep(0.78, 0.66, p[1]) * smoothstep(0.43, 0.52, p[1]) * smoothstep(0.13, 0.04, Math.abs(p[0])) * (1 - legness[v]) * smoothstep(0.2, -0.3, n[1]);
    }
    smoothField(fringe, weights.neighbors, 2);
  }
  const underFactor = (v) => {
    const n = N(v), p = P(v), li = limbWhich[v];
    if (li < 0 || junction[v] <= 0) return 0;
    if (li <= 1) return junction[v] * Math.max(smoothstep(0.15, -0.55, n[2]) * smoothstep(0.66, 0.52, p[1]), smoothstep(0.2, -0.6, n[1]));
    return junction[v] * smoothstep(0.35, -0.45, n[1] + 0.35 * Math.abs(n[2]));
  };

  // --- ventral (pale underside) factor
  const ventral = new Float32Array(nV);
  const ventralNeck = new Float32Array(nV); // (the neck's own formula, for the head / neck blend)
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let w = 0;
    if (r === 0) {
      // (the underside only: from the lower flank on it read as a cream lower third of the body)
      w = smoothstep(-0.25, -0.9, n[1]); // (a soft transition: seen edge-on from the side a narrow one read as a light seam)
      if (p[2] > 0.3) w = Math.max(w, smoothstep(0.7, 0.52, p[1]) * smoothstep(0.1, 0.045, Math.abs(p[0])) * smoothstep(-0.3, 0.4, n[2]));
      w *= smoothstep(0.8, 0.62, p[1]) * 0.55 + 0.45;
    } else if (r === 1 || r === 2) {
      const wN = smoothstep(0.1, -0.5, n[1]) * smoothstep(-0.4, 0.3, n[2]) + smoothstep(0.78, 0.66, p[1]) * 0.5;
      const f = toFace(headLocal(p));
      const wH = smoothstep(-1.13, -1.49, f[1]) * smoothstep(-0.2, -0.7, n[1]);
      ventralNeck[v] = clamp(wN, 0, 1);
      w = mix(wN, wH, hbw[v]);
    } else if (r === 4) {
      w = 0;
    } else if (r === 6) {
      const f = toFace(headLocal(p));
      w = smoothstep(-1.13, -1.49, f[1]) * smoothstep(-0.2, -0.7, n[1]) + 0.6;
    }
    const L = legness[v];
    if (L > 0) {
      const side = p[0] >= 0 ? 1 : -1;
      const inner = smoothstep(0.1, -0.6, n[0] * side);
      const wl = inner * 0.75 * smoothstep(0.12, 0.4, p[1]) + smoothstep(-0.3, -0.85, n[1]) * 0.5;
      w = mix(w, wl, L);
    }
    w = Math.max(w, underFactor(v) * 0.95);
    // (maned males: no pale bib just below the mane: the lower chest there is mane-coloured in the photos)
    if (male && r <= 1) w *= 1 - smoothstep(0.15, 0.02, maneD[v]) * smoothstep(0.25, 0.6, p[2]);
    ventral[v] = clamp(w, 0, 1);
  }

  // the face mask (face units: the front view's half width at height Y): short fur inside it; outside it, on the sides of the
  // head, the cheek ruff: the long hair of the "sideburns" that makes a lion's head broad at the eyes (face_female1: +-1.16 E
  // at the eye line with the fur, the skull +-1.05) and, on maned males, the pale front of the mane framing the face
  // (face_male1: long cream hair from +-0.95 E at the eyes and +-0.75 E beside the whisker pads; a short-furred face out to
  // +-1.35 E read as a suede plate set in the mane)
  // (a male's face is framed tighter: the pale ruff starts just outside the whisker pads, face_male1)
  const MASK = male ? [[0.7, 0.74], [0.3, 0.8], [0.0, 0.78], [-0.3, 0.71], [-0.6, 0.64], [-0.9, 0.6], [-1.2, 0.57], [-1.5, 0.5], [-1.8, 0.44]] // (0.06 E further in, face_male1: the ruff from +-0.95 E at the eyes with its hair)
    : [[0.7, 0.88], [0.3, 0.92], [0.0, 0.92], [-0.5, 0.84], [-0.9, 0.72], [-1.2, 0.64], [-1.5, 0.56], [-1.8, 0.5]]; // (the lioness's sideburns from closer in: her outline was 9 % narrow at the jowls)
  const maskHalf = (Y) => {
    if (Y >= MASK[0][0]) return MASK[0][1];
    for (let i = 1; i < MASK.length; i++) if (Y >= MASK[i][0]) { const [y0, w0] = MASK[i - 1], [y1, w1] = MASK[i]; return w1 + ((w0 - w1) * (Y - y1)) / (y0 - y1); }
    return MASK[MASK.length - 1][1];
  };
  // 0 on the face .. 1 on the ruff, over ~0.25 E (~3 cm); behind the eyes the side of the head is ruff whatever its X
  const ruffOf = (f) => Math.max(male ? smoothstep(-0.14, 0.3, Math.abs(f[0]) - maskHalf(f[1])) : smoothstep(-0.1, 0.32, Math.abs(f[0]) - maskHalf(f[1])), smoothstep(-0.75, -1.05, f[2]) * smoothstep(0.35, 0.6, Math.abs(f[0])) * smoothstep(0.75, 0.45, f[1]));
  const ruffLen = male ? 0.035 + 0.07 * maneK : 0.023; // (a lioness: under the 24 mm at which fins start, render finMinLen)
  // the ruff's hair length at a head point: up to 25 mm no faster than ~1 mm per mm of skin (over ~0.3 E), the long part
  // of a male's ruff after that (the fur-slope limit lets hair over 25 mm rise faster; rising 9 -> 75 mm over 4 cm in one
  // ramp left walls 2.4 mm/mm steep where the limit cut it below 25 mm)
  const ruffFl = (f, lock, jit = 0) => {
    const t = Math.abs(f[0]) - maskHalf(f[1]) + jit;
    const behind = smoothstep(-0.75, -1.05, f[2]) * smoothstep(0.35, 0.6, Math.abs(f[0])) * smoothstep(0.75, 0.45, f[1]);
    // (a male's long stage over ~0.5 E with a ragged inner edge (jit): over 0.32 E along a smooth line the ruff's
    // foot stood as the rim of a mask round the face)
    const u1 = Math.max(male ? smoothstep(-0.2, 0.32, t) : smoothstep(-0.1, 0.22, t), behind), u2 = Math.max(male ? smoothstep(0.02, 0.42, t) : smoothstep(0.08, 0.4, t), behind); // (a male's long stage from just outside the face (from 0.12-0.7 E out the ruff started behind the cheek with an edge, a mask set in a hood)
    // (a lioness's ruff stays one 2.3 cm stage: 3.4 cm at the jowls widened her outline to face_female1's 1.26-1.31 E but stood
    // as two puffs beside the mouth, a hamster's cheeks again)
    return Math.max(Math.min(ruffLen, 0.025) * u1, male ? ruffLen * lock * u2 : 0);
  };
  // (a male's pale only in a band round the face, ~0.45 E: beyond it the mane's own colour, dark on a dark mane; the whole
  // side of the head pale turned a black-fringed mane blond)
  const ruffCol = male ? mix3(C.chin, C.maneBlond, 0.68 + 0.22 * maneDark) : mix3(C.face, C.eyePatch, 0.2);
  const ruffPale = (f) => ruffOf(f) * (male ? 1 - smoothstep(0.3, 0.65, Math.abs(f[0]) - maskHalf(f[1])) : 1);
  // hair flows out from the nose over the face, back over the crown and down the cheeks
  const headFlow = (p) => {
    const f = toFace(headLocal(p));
    const fromNose = norm(sub(f, [0, -0.9, 1.15]));
    let d = norm(add(fromNose, [0, -0.2, -0.55]));
    if (f[2] < -0.27 && Math.abs(f[0]) > 0.6) d = norm(add(d, [Math.sign(f[0]) * 0.5, -0.5, -0.7]));
    return d;
  };
  // --- comb (hair flow), bind space
  const comb = new Float32Array(nV * 3);
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let d;
    const bone = BONES[dominant[v]];
    if (r === 5) {
      const E5 = earFrame(p);
      d = norm(add(E5.up, mul(E5.facing, 0.6 * smoothstep(0.01, -0.003, E5.dIn))));
    } else if (r === 6 || (r === 2 && hbw[v] >= 1)) {
      d = headFlow(p);
      // the chin's tuft and the throat under it: hanging down (the chin's white hair falls over the crease under the jaw)
      const fc = toFace(headLocal(p));
      const hang = partOf[v] === 2 ? smoothstep(-1.36, -1.46, fc[1]) : smoothstep(-1.3, -1.5, fc[1]) * smoothstep(0.2, -0.5, n[1]);
      if (hang > 0) d = norm(add(mul(d, 1 - hang), mul(norm([0, -1, -0.35]), hang)));
      // (under the jaw the hair runs straight back to the throat: hanging "down" projected on the rounded underside fanned
      // out into a herringbone at the midline)
      if (partOf[v] === 2) { const ub = smoothstep(-0.45, -0.8, n[1]); if (ub > 0) d = norm(add(mul(d, 1 - ub), mul(norm([0, -0.25, -1]), ub))); }
      // the cheek ruff flares out and falls back (the sideburns; a male's pale ruff framing the face)
      const rwc = partOf[v] === 2 ? 0 : ruffOf(fc);
      if (rwc > 0) d = norm(add(mul(d, 1 - 0.75 * rwc), mul(norm([Math.sign(fc[0]) * 0.55, -0.5, -0.7]), 0.75 * rwc)));
      // (a maned male's crown hair: back and a little out over the crown, standing up from the hairline)
      if (male && maneK > 0 && partOf[v] !== 2) { const cwc = smoothstep(0.45, 0.85, fc[1]) * smoothstep(0.35, -0.15, fc[2]); if (cwc > 0) { const lk = fbm3(p[0] * 16 + 3.1 + nOff, p[1] * 16, p[2] * 16, 2) - 0.5, lk2 = fbm3(p[0] * 16 + 9.7 + nOff, p[1] * 16, p[2] * 16, 2) - 0.5; d = norm(add(mul(d, 1 - cwc), mul(norm([Math.sign(fc[0]) * 0.35 * Math.min(1, Math.abs(fc[0])) + 1.0 * lk, 0.1 + 0.5 * lk2, -1]), cwc))); } } // (laid back from a lower hairline, not standing up at it: a roll over the forehead)
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = AXIAL.points[seg], b = AXIAL.points[Math.min(seg + 1, AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.4 * Math.abs(n[0]), 0]));
      if (r === 1 || r === 2) d = norm(add(d, [0, -0.45, 0]));
      if ((r === 1 || r === 2) && hbw[v] > 0) d = norm(add(mul(d, 1 - hbw[v]), mul(headFlow(p), hbw[v])));
      const L = legness[v];
      if (L > 0 && legBone[v] >= 0) {
        const lbn = BONES[legBone[v]];
        let dl = norm(sub(lbn.tail, lbn.head));
        if (isPaw[legBone[v]]) dl = norm(add(dl, [0, 0, 0.4]));
        else dl = norm(add(dl, [0, -0.2, -0.3]));
        d = norm(add(mul(d, 1 - L), mul(dl, L)));
      }
    }
    // the mane falls back and down from the face ruff, and hangs down the chest
    const mw = maneW[v];
    if (mw > 0) {
      // the ruff radiates out from the face and then falls back and down; the crest flows back over the
      // crown; over the neck and shoulders it hangs back and down (one comb everywhere read as a helmet)
      const down = norm(add([0, -0.9, -0.55], mul(n, 0.35)));
      // (swept back as well as out: hair laid radially outward over the ruff's front read as a sunflower, a hood
      // round the face; the photos' ruff flows back from the cheeks)
      const radial = norm(add(norm(sub(p, MANE_FC)), [0, -0.3, -0.95]));
      const crest = norm([0, -0.25, -1]);
      const ruffW = smoothstep(0.56, 0.7, p[2]) * (1 - smoothstep(0.35, 0.85, n[1]));
      const crestW = smoothstep(0.3, 0.8, n[1]) * smoothstep(0.5, 0.66, p[2]);
      let dmn = norm(add(add(mul(down, 1 - ruffW - crestW * (1 - ruffW)), mul(radial, ruffW)), mul(crest, crestW * (1 - ruffW))));
      // locks: the direction wanders a little from lock to lock
      // (+-25 deg between clumps a few cm across: +-19 deg at 9 cm left the outline smooth)
      const lk = fbm3(p[0] * 16 + 3.1 + nOff, p[1] * 16, p[2] * 16, 2) - 0.5, lk2 = fbm3(p[0] * 16 + 9.7 + nOff, p[1] * 16, p[2] * 16, 2) - 0.5;
      dmn = norm(add(dmn, [1.0 * lk, 0.55 * lk2, 0.45 * (lk + lk2)]));
      d = norm(add(mul(d, 1 - mw), mul(dmn, mw)));
    }
    if (fringe[v] > 0) d = norm(add(mul(d, 1 - fringe[v]), mul([0, -1, 0.15], fringe[v])));
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];
  }

  // --- faint rosettes and spots: cubs (legs and belly strongest), a trace on adult lower legs
  const spotR = (v) => {
    if (spotsK <= 0.01) return 0;
    const r = region[v], p = P(v);
    if (maneW[v] > 0.3) return 0;
    if (r === 0 || r === 1) {
      const L = legness[v];
      if (!juv && L < 0.5) return 0;
      // (adults: only on the forearm and shin, clear of the joints, where the skin barely stretches)
      if (!juv && (p[1] > 0.34 || p[1] < 0.17 || legBone[v] < 0 || !/^(radius|tibia)/.test(BONES[legBone[v]].name))) return 0;
      return mix(0.024, 0.018, L) * (juv ? 1.6 : 1);
    }
    if (r === 2 && juv) {
      const h = headLocal(p);
      if (h[2] > 0.04 || h[1] < -0.05) return 0;
      return 0.01;
    }
    return 0;
  };
  const splitS = splitFor(params);
  const skipOverlap = (v) => {
    const p = P(v);
    return (partOf[v] === 1 && splitS(p[0], p[1], p[2]) < 0) || (partOf[v] === 0 && splitS(p[0], p[1], p[2]) > 0);
  };
  const SP = poissonFeatures({ pos, nrm, nV, radius: spotR, R, spacing: 1.7, gap: 0.006, cell: 0.1, skip: skipOverlap, extra: (v, RR) => ({ c: [comb[v * 3], comb[v * 3 + 1], comb[v * 3 + 2]], el: 1.1 + 0.3 * RR(), ring: RR() < 0.55 && juv ? 1 : 0, pale: smoothstep(0.4, 0.9, ventral[v]) }) });
  // whisker-base dots: 4 slightly curved rows of small black spots on the upper half of each pad
  // (face_female1: rows 0.93-1.19 E below the eye line, from beside the nose out to ~0.45 E), jittered,
  // on the pad's surface; the whiskers grow from the upper three rows (whiskers.js); [x, y, z, radius]
  const whiskerDots = whiskerFollicles(params.coatSeed || 0).map((f) => [...follicleRoot(headPrims, f, hw), f.r]);

  // --- per-vertex paint
  const furLen = new Float32Array(nV);
  const tint = new Float32Array(nV * 4);
  const markSDF = new Float32Array(nV).fill(0.03);
  const pattern = new Float32Array(nV).fill(0.05);
  const patternColor = new Float32Array(nV * 4);
  const surf = new Float32Array(nV * 4);
  const g3 = (h, c, rr) => Math.exp(-(((Math.abs(h[0]) - c[0]) / rr[0]) ** 2 + ((h[1] - c[1]) / rr[1]) ** 2 + ((h[2] - c[2]) / rr[2]) ** 2));
  // (the tail's dorsal side from its bones' directions blended by the skin weights: from the dominant bone alone it
  // jumped at every joint, rings from behind)
  const tailDorsal = (v) => {
    let d = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const w = skinWeight[v * 4 + k];
      if (w <= 0) continue;
      const bone = BONES[skinIndex[v * 4 + k]];
      d = add(d, mul(norm(sub(bone.tail, bone.head)), w));
    }
    if (len(d) < 1e-6) { const bone = BONES[dominant[v]]; d = sub(bone.tail, bone.head); }
    d = norm(d);
    return norm([0, -d[2], d[1]]);
  };

  // the neck's and the head's base paint (colour, hair length, agouti) for the blend across their boundary
  const neckBase = (v, p, n, nz) => {
    const up = n[1], vn = ventralNeck[v];
    let c = mix3(C.lowFlank, C.flank, smoothstep(-0.35, 0.3, up + 0.15 * nz));
    c = mix3(c, C.dorsal, smoothstep(0.35, 0.95, up + 0.2 * nz) * 0.85);
    c = mix3(c, C.belly, vn);
    c = mix3(c, C.chin, vn * smoothstep(sOcc + 0.22, sOcc + 0.04, axialS[v]) * 0.8);
    let f = mix(0.016, 0.022, smoothstep(0.3, 0.9, up));
    f = mix(f, 0.03, smoothstep(0.35, 0.9, vn) * 0.5);
    return [c, f, 0.15 * smoothstep(0.2, 0.9, up)];
  };
  // cubs: how far a head point lies out of the face (0 on the face .. 1 behind the ears, on the crown and the throat), in
  // face units: the woolly coat grows in over ~0.8 E (~6 cm on a cub)
  const cubWool = (p) => {
    const f = toFace(headLocal(p));
    const q = Math.hypot(f[0], (f[1] + 0.4) / 1.1, Math.min(0, f[2] - 0.2) / 1.1);
    return smoothstep(0.72, 1.5, q);
  };
  const headBase = (p, n) => {
    const f = toFace(headLocal(p)), ax = Math.abs(f[0]);
    let c = mix3(C.face, C.crown, smoothstep(-0.15, 0.56, f[1]) * 0.6);
    c = mix3(c, C.muzzle, clamp(smoothstep(-1.3, -1.55, f[1]) * smoothstep(0.2, -0.45, n[1]) * 0.9, 0, 1));
    let fl = mix(0.012, 0.0075, smoothstep(-0.6, 0.02, f[2]));
    fl = mix(fl, 0.016, smoothstep(0.6, 1.0, ax) * smoothstep(0.09, -0.45, f[2]));
    const rw = ruffOf(f);
    fl = Math.max(fl, ruffFl(f, 1));
    c = mix3(c, ruffCol, ruffPale(f) * 0.7);
    return [c, fl];
  };

  for (let v = 0; v < nV; v++) {
    if (partOf[v] === canineRegion) {
      // the upper canines: ivory, a little yellower at the root
      const f = toFace(headLocal(P(v)));
      const col = mix3(C.tooth, mix3(C.tooth, C.face, 0.35), smoothstep(-1.32, -1.1, f[1]));
      tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = MAT.KERATIN;
      furLen[v] = 0; markSDF[v] = 0.03; surf[v * 4] = 0.7;
      continue;
    }
    const p = P(v), n = N(v), r = region[v];
    let col, fl = 0.02, ag = 0, mat = MAT.FUR, mark = 1, under = 0.5;
    const nz = fbm3(p[0] * 5 + nOff, p[1] * 5, p[2] * 5, 3) - 0.5;
    const nz2 = vnoise3(p[0] * 30 + nOff, p[1] * 30, p[2] * 30) - 0.5;
    let spotI = 0, dotI = 0, lidSkin = 0;
    if (r === 0 || r === 1) {
      const up = n[1];
      col = mix3(C.lowFlank, C.flank, smoothstep(-0.35, 0.3, up + 0.15 * nz));
      col = mix3(col, C.dorsal, smoothstep(0.35, 0.95, up + 0.2 * nz) * 0.85);
      // a faint darker line along the spine from the withers to the tail root (it marks the back of a lion lying
      // on its side; a smooth sausage from behind)
      col = mix3(col, C.crown, smoothstep(0.05, 0.012, Math.abs(p[0])) * smoothstep(0.88, 0.97, up) * smoothstep(0.35, 0.2, p[2]) * smoothstep(-0.8, -0.68, p[2]) * 0.55);
      ag = 0.15 * smoothstep(0.2, 0.9, up);
      col = mix3(col, C.belly, ventral[v]);
      // the white of the chin carries on down the upper throat
      if (r === 1) col = mix3(col, C.chin, ventral[v] * smoothstep(sOcc + 0.22, sOcc + 0.04, axialS[v]) * 0.8);
      // sleek short body coat; slightly longer belly fringe and along the spine
      fl = mix(0.016, 0.022, smoothstep(0.3, 0.9, up));
      fl = mix(fl, 0.03, smoothstep(0.35, 0.9, ventral[v]) * (r === 0 ? 1 : 0.5));
      const L = legness[v];
      if (L > 0) {
        const lb = legBone[v];
        let lc = mix3(C.legOuter, C.legInner, smoothstep(0.1, 0.7, ventral[v]));
        lc = mix3(lc, col, smoothstep(0.45, 0.65, p[1]) * 0.6);
        let lf = mix(0.008, 0.016, smoothstep(0.1, 0.5, p[1]));
        // "breeches": slightly longer hair on the back of the thighs
        if (lb >= 0 && !isFront[lb]) lf = Math.max(lf, 0.024 * smoothstep(-0.1, -0.7, n[2]) * smoothstep(0.35, 0.6, p[1]));
        if (lb >= 0 && isPaw[lb]) { lf = 0.006; lc = C.paw; }
        col = mix3(col, lc, L);
        fl = mix(fl, lf, L);
      }
    } else if (r === 4) {
      const t = tailT[v];
      const dors = dot(n, tailDorsal(v));
      // (only a little paler underneath, the photos; a cream underside read as a sharp stripe)
      col = mix3(mix3(C.flank, C.belly, 0.4), C.flank, smoothstep(-0.7, 0.3, dors + 0.3 * nz));
      col = mix3(col, C.dorsal, smoothstep(0.3, 0.9, dors) * 0.5);
      // the tail darkens toward the tuft, which is black
      col = mix3(col, C.tailTip, smoothstep(0.6, 0.85, t) * 0.6);
      const tuftD = tuftPrims.length ? SDFModel.evalList(tuftPrims, p[0], p[1], p[2]) : 1;
      const tuft = Math.max(smoothstep(0.012, -0.004, tuftD), smoothstep(0.86, 0.93, t + 0.02 * nz));
      col = mix3(col, C.tuft, tuft);
      fl = mix(0.014, 0.018, smoothstep(0.1, 0.6, t));
      fl = mix(fl, 0.065 * (1 - 0.5 * juv), tuft);
      under = 0.25;
    } else if (r === 5) {
      const E5 = earFrame(p);
      const front = dot(n, E5.facing), ht = E5.ht;
      // the front: a tawny rim round a shallow bowl filled with long pale hair rising from its lower part,
      // the skin darker only deep in the bottom of the bowl (face_female1; a dark hollow cup with a hard
      // edge read as a mouse's ear, and drew jagged dark polygons at the medium tier)
      const bowl = smoothstep(0.012, -0.003, E5.dIn) * smoothstep(-0.1, 0.45, front);
      let fc = mix3(C.face, C.earInner, bowl * 0.9);
      // (the bowl shaded: pale hair at its top and outer side, the skin darker deep in its lower middle (face_female1 /
      // face_male1); a uniformly pale bowl read as a mouse's ear; a hard-edged dark cup at 0.45 drew dark
      // crack lines at the medium tier, so the shading is a wide soft gradient of the bowl's own weight)
      // (a male's bowl filled with pale hair, face_male1: the grey cup read as a flat grey plate)
      fc = mix3(fc, C.earCup, bowl * Math.exp(-(((ht - 0.3) / 0.16) ** 2)) * smoothstep(0.35, 0.85, front) * 0.42 * (1 - 0.7 * male));
      // (a male's bowl: deep and shaded, its long hair tawny over dark roots, face_male1; the grey cup read as a flat grey plate)
      if (male) fc = mix3(fc, mix3(C.earCup, C.maneBlond, 0.5), bowl * 0.75);
      // (16-19 mm: 22 mm of hair rising from the 7 mm rim stood as a wall round the bowl)
      const ff = mix(0.007, 0.019 + 0.003 * male, bowl * smoothstep(0.78, 0.3, ht));
      // the back and the rim: black (a tawny patch low in the centre of the back), tawny at the base
      let bc = mix3(C.earBackCentre, C.earBack, 0.55 + 0.45 * (params.earDark ?? 1));
      bc = mix3(bc, C.earBackCentre, Math.exp(-(((ht - 0.3) / 0.2) ** 2)) * smoothstep(-0.2, -0.75, front) * 0.55);
      // (the black starts behind the rim: the rim itself pale like the front (face_female1); from front 0.3 the coarse
      // medium mesh's rim vertices alternated front / back and drew the rim as black dashes)
      const backW = smoothstep(-0.12, -0.48, front) * smoothstep(0.08, 0.22, ht); // (from -0.12: from 0.02 the rim drew a dotted dark line at medium)
      col = mix3(fc, bc, backW);
      // a maned male's ear rim: the dark of the back wraps over the edge of the upper pinna (face_male1: dark-rimmed ears)
      if (male) col = mix3(col, bc, smoothstep(0.32, 0.04, front) * (1 - bowl) * smoothstep(0.3, 0.55, ht) * (0.35 + 0.45 * (params.earDark ?? 1)) * (1 - backW));
      col = mix3(col, C.crown, smoothstep(0.16, 0.04, ht));
      fl = mix(ff, 0.006 + 0.004 * male, backW); // (a male's ear backs furred, face_male1)
      under = 0.3;
      if (male) {
        // a male's pinna: its whole front furred in tawny hair over dark roots, darker deep in the middle (face_male1: a
        // furry ear with a shadowed bowl; short pale suede read as a flat grey plate)
        const fw = smoothstep(-0.05, 0.35, front) * (1 - backW);
        const deep = Math.exp(-(((ht - 0.36) / 0.22) ** 2)) * smoothstep(0.016, -0.003, E5.dIn) * smoothstep(0.3, 0.8, front);
        col = mix3(col, mix3(mix3(C.maneBlond, C.face, 0.2), mix3(C.earCup, C.earBack, 0.5), 0.15 + 0.75 * deep), fw);
        fl = mix(fl, 0.017 * smoothstep(0.92, 0.55, ht) + 0.004, fw);
        under = mix(under, 0.12, fw * (0.4 + 0.6 * deep));
      }
      fl = mix(fl, 0.009 + 0.003 * maneK, smoothstep(0.14, 0.02, ht));
    } else {
      // ---------------- head & jaw (face units: rig.js FACE, E = the eye separation from the eye midpoint)
      const h = headLocal(p);
      const f = toFace(h), ax = Math.abs(f[0]);
      col = C.face;
      col = mix3(col, C.crown, smoothstep(-0.15, 0.56, f[1]) * 0.6);
      // white whisker pads (flanking the nose, below the level of the leather), upper lip and chin, a
      // narrow pale crescent under each eye and a pale brow; the bridge and the upper muzzle stay tawny
      // (face_female1, face_male1: the whole lower face read pale grey-white)
      const padLow = smoothstep(-0.84, -1.02, f[1]);
      // (the pads white over their lower two thirds, face_female1 / face_male1: they read tan)
      // (white right down to the lip line: fading out below the pads' middle, their lower edge was tan over the white chin, which
      // then read as a white lump of a lower lip)
      const whisker = partOf[v] !== 2 ? g3(f, [0.29, Math.max(f[1], -1.16), 0.78], [0.34, 0.26, 0.5]) * padLow : 0; // (the white pads reach back along the lip, f34_*, ffront_*)
      const lip = g3(f, [0.0, -1.3, 1.0], [0.3, 0.14, 0.24]);
      // (the pale under the eye is a thin crescent along the lower lid, added with the lid margins below; a soft
      // blob 0.14 E tall read as a white smudge)
      const underEye = smoothstep(0.12, 0.5, g3(f, [0.47, -0.21, 0.1], [0.25, 0.105, 0.45])) * 0.95; // (bigger: the eye's frame of pale fur makes the eye read as big as the photos' (ffront_*, f34_*)) // (bigger and whiter, the face read as one flat colour in the showcase's shade) // (the white patches below the eyes)
      const aboveEye = smoothstep(0.15, 0.6, g3(f, [0.49, 0.15, 0.1], [0.17, 0.055, 0.42])) * 0.6; // (a pale band over the upper lid, under the brow; 0.38 left the eye small and dark)
      // (the chin's white only on its front and underside, +-0.25 E, no brighter than the pads; the jaw's sides the
      // jowl's cream-tawny: the whole jaw painted white read as a pale pacifier under the mouth)
      const chinG = Math.exp(-((ax / 0.3) ** 2));
      const chinW = partOf[v] === 2 ? 0.95 * chinG * Math.max(smoothstep(0.05, 0.5, f[2]), smoothstep(-0.35, -0.8, n[1]) * smoothstep(-0.45, 0.25, f[2])) : 0;
      // (the white chin carries on down the throat: the jaw's white ended at a hard edge on a tawny throat)
      // (the throat and the jaw's underside pale cream (the pale runs into the throat over a few cm), the white itself
      // only under the chin's front)
      const throatW = smoothstep(-1.3, -1.6, f[1]) * smoothstep(0.1, -0.55, n[1]) * (partOf[v] === 2 ? 0.55 : 0.7 + 0.15 * smoothstep(-0.9, 0.1, f[2]) * Math.exp(-((ax / 0.4) ** 2)));
      if (partOf[v] === 2) col = mix3(col, C.muzzle, 0.28 + 0.4 * smoothstep(-0.2, 0.3, f[2])); // (the lower lip's fur cream-white along the jaw's side under the lip line, f34_*: a tawny-grey jaw read as a heavy dark jowl from below)
      // (the white pads with a defined upper-outer edge: a soft fade read as a plush toy's pale muzzle)
      const w = clamp(Math.max(smoothstep(0.06, 0.5, whisker) * mix(0.72, 1, smoothstep(-0.98, -1.14, f[1])), lip, underEye, aboveEye, chinW, throatW), 0, 1);
      col = mix3(col, mix3(C.muzzle, C.eyePatch, underEye + aboveEye > whisker ? 0.5 : 0), w);
      // (grizzled tips on the face's tawny hair, ffront_* / f34_*: a uniform suede read as a plush toy)
      ag = (whiteV ? 0.1 : 0.26 - 0.1 * juv) * (1 - w); // (0.4 drew the face front a uniform dark brown in the showcase's shade)
      // dark tear streaks: from the inner corner of each eye down along the side of the bridge, fading
      // by the top of the leather (face_male1); the upper muzzle beside them a warmer, darker tawny
      // (a short streak fading ~0.4 E below the eye line, curving a little outward and thinning (face_male1,
      // face_female1): two parallel stripes down to the leather read as the edges of a plank)
      const tq = clamp(-f[1] - 0.08, 0, 0.45);
      const tx = 0.325 + 0.03 * tq + 0.3 * tq * tq;
      const tear = Math.exp(-(((ax - tx) / (0.075 - 0.055 * tq)) ** 2)) * smoothstep(-0.02, -0.12, f[1]) * smoothstep(-0.62, -0.32, f[1]) * smoothstep(-0.15, 0.1, f[2]); // (wider and longer, it did not read at showcase distance)
      col = mix3(col, C.tear, tear * (whiteV ? 1 : 0.95));
      col = mix3(col, C.crown, g3(f, [0.45, -0.6, 0.45], [0.22, 0.25, 0.4]) * (1 - padLow) * 0.55);
      // the lower cheek and the jowl behind the pads paler, cream (f34_*, ffront_*: the face pales from the brow down to the jaw; one
      // flat tawny side read as a plush toy's)
      if (partOf[v] !== 2) col = mix3(col, mix3(C.eyePatch, C.face, 0.3), smoothstep(-0.28, -0.8, f[1]) * smoothstep(0.36, 0.6, ax) * smoothstep(-1.2, -0.6, f[2]) * (1 - whisker) * (whiteV ? 0.3 : 0.35)); // (0.8 painted the whole lower face a pale mask that flattened it, f34_*: tawny cheeks, the white on the pads, the chin and the throat)
      // the dark tan marks above the inner corners of the eyes, and a darker, warmer bridge (face_female1,
      // face_male1, threequarter_youngmale1)
      // (a small dark spot over each eye (the supraorbital whisker spot, mfront_*, ffront_*); the tall streak
      // over the inner corner rose toward the midline like a worried brow)
      col = mix3(col, mix3(C.browMark, C.tear, 0.35), smoothstep(0.08, 0.55, g3(f, [0.36, 0.29, 0.1], [0.085, 0.06, 0.5])) * (whiteV ? 0.9 : 0.9));
      // a male's face darker and more strongly marked than its pale ruff: the forehead and the bridge a deeper tawny (face_male1,
      // threequarter_youngmale1; at low contrast the face and its ruff read as one flat pale shield)
      if (male) col = mix3(col, mix3(C.crown, C.browMark, 0.35), Math.max(g3(f, [0, 0.35, -0.15], [0.42, 0.42, 0.7]), g3(f, [0, -0.35, 0.55], [0.2, 0.36, 0.45]) * (1 - padLow)) * 0.25); // (0.7: a flat brown mask against the mane)
      // a thin dark furrow up the middle of the forehead (face_male1, face_female1)
      col = mix3(col, C.browMark, Math.exp(-((ax / 0.032) ** 2)) * smoothstep(0.12, 0.3, f[1]) * smoothstep(0.9, 0.62, f[1]) * smoothstep(-0.7, -0.4, f[2]) * (whiteV ? 0.8 : 0.65));
      col = mix3(col, C.crown, g3(f, [0.0, -0.3, 0.62], [0.2, 0.34, 0.4]) * (1 - padLow) * 0.6);
      // the liner's wing: a black line from the outer corner of the eye back and a little down (the lid margins
      // alone read as a thin rim; a line down from the inner corner crossed the socket at a grazing angle and
      // drew as a crack: the tear line's tint carries on from there)
      // (measured in the face plane, x-y: the corners lie on the eyeball, under the skin)
      if (f[2] > eyeOut[2] - 0.3) {
        const fL = [ax, f[1], 0];
        const [dw, tw] = seg(fL, [eyeOut[0], eyeOut[1], 0], [0.19, -0.06, 0]);
        mark = Math.min(mark, (dw - 0.03 * (1 - tw)) * EM); // (longer and bolder, f34_*: the eye's liner wing)
      }
      // whisker-base dots: rows of small black spots on the upper half of each pad
      // (small dark-brown dots in the pattern channel, their edges broken by the hair: crisp black marks 4-5 mm across
      // read as stitching)
      if (whisker > 0.15) {
        let dd = 1;
        for (const q of whiskerDots) dd = Math.min(dd, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) - 1.15 * q[3]); // (bigger, the rows read in the showcase)
        if (dd < pattern[v]) { pattern[v] = dd; dotI = 1; }
      }
      // black spot at the corner of the mouth
      // (at the end of the lip line, small: a 9 mm spot above it read as a dot beside the mouth)
      mark = Math.min(mark, Math.hypot(ax - 0.55, f[1] + 1.37, f[2] - 0.1) * FACE.E * HS - 0.0055);
      // fur length (research 6: face 5-10 mm): 5 mm over the front of the face (the muzzle, the bridge, round
      // the eyes: under the 5.8 mm the silhouette fins start at, which drew the muzzle's sides as a dotted
      // dark outline), longer on the cheeks and toward the crown
      // (7.5 mm over the front (no fins on the face since finMinLen 24 mm): at 5 mm the shells drew the face as
      // smooth suede, a plush toy's, with no hair texture in the showcase)
      // (16 mm on the cheeks (was 13): the cheek hair's locks and flow read, f34_* / ffront_*; at 13 mm a velvet plush)
      fl = mix(0.012, 0.0075, smoothstep(-0.6, 0.02, f[2]));
      fl = mix(fl, 0.016, smoothstep(0.6, 1.0, ax) * smoothstep(0.09, -0.45, f[2]));
      // the cheek ruff: long hair on the jowls and the cheeks behind the mouth, flaring out and back (every
      // lion: face_female1 is widest there, 1.24-1.3 E at the level of the mouth, against 1.12 at the eyes)
      // (17 mm on a maneless head over wide ramps: 32 mm from |x| 0.68 E stood as a dark coarse patch pasted on a
      // lioness's cheek, and its inner edge drew a V on the throat; the jowl's sculpt gives the width)
      const rw = r === 6 ? 0 : ruffOf(f);
      // (in locks: +-35 % at ~5 cm, the ruff's outline and surface break up like the mane's)
      // (round the ear bases no faster than the mane's rise there: a male's ruff of 2.4 cm stood as a ring of clumps round them)
      if (r !== 6) fl = Math.max(fl, Math.min(ruffFl(f, 1 + 0.7 * (vnoise3(p[0] * 20 + 4.1 + nOff, p[1] * 20, p[2] * 20) - 0.5), male ? 0.24 * (vnoise3(p[0] * 28 + 6.7 + nOff, p[1] * 28, p[2] * 28) - 0.5) + 0.14 * (fbm3(p[0] * 9 + 2.2 + nOff, p[1] * 9, p[2] * 9, 2) - 0.5) : 0), male ? earCap(earDist(p)) : 1));
      // (a male's ruff only a little paler than the mane: a band of pale colour round the face read as a pale shield set in
      // the mane; the long hair itself frames the face)
      col = mix3(col, ruffCol, (r === 6 ? 0 : ruffPale(f)) * (0.7 - 0.25 * male));
      // (a fluffy white chin whose underside hair hangs long into the throat, face_male1: short, it read as a white
      // bar under the mouth with a crease below it)
      // (up to 25 mm, rising over the chin's curve: longer, it stood as a wall under the chin; a maned lion's
      // long pale hair below it is the mane's)
      // (13-16 mm, combed back toward the throat: up to 25 mm on maned males it outlined the chin as a pad)
      if (r === 6) {
        // (the chin's underside a tuft of longer hair hanging down and back into the throat's, which hides the crease under
        // the chin: the depth of the white chin in face_male1 is hair)
        // (the chin a white tuft of 2 cm hair hanging down over its own lower edge, face_male1 / threequarter_youngmale1;
        // 12 mm on its front read as a smooth pale lens)
        fl = mix(0.013, 0.022, Math.max(smoothstep(0.25, -0.6, n[1]), smoothstep(0.2, 0.6, n[2]) * smoothstep(-1.36, -1.46, f[1])));
        // maned males: behind the chin the jaw's underside and sides carry the ruff's pale front, its hair lengthening toward
        // the mane (a dead male's jaw, seen from below, lay in the mane as a white plate with a crease round it)
        if (maneK > 0) {
          // (the underside and the lower sides only, rising away from the rim: on the jaw's rear end 4 cm of hair stood
          // beside the black rim, a wall)
          const dMr = mouthPrim ? SDFModel.dist(mouthPrim, p[0], p[1], p[2]) : 1;
          // (by height, not by the normal: the normal turns fast round the jaw's side, a 2 -> 4 cm step in 3 mm)
          const rear = maneK * smoothstep(0.35, -0.45, f[2]) * smoothstep(-1.28, -1.52, f[1]) * smoothstep(0.012, 0.04, dMr);
          fl = mix(fl, 0.02, rear);
          col = mix3(col, mix3(C.chin, C.maneBlond, 0.45), rear * 0.8);
          // the chin a fluffy white tuft as long as the pale ruff round it (face_male1: 13-22 mm of chin hair in 5 cm of ruff
          // read as a white disc set in the mane, a pacifier)
          const tuft = smoothstep(-1.34, -1.55, f[1]) * smoothstep(0.004, 0.014, dMr);
          fl = Math.max(fl, 0.02 * tuft);
          col = mix3(col, C.chin, tuft * 0.6);
        }
      }
      // the throat skin under and behind the jaw as long as the jaw's underside (the two surfaces meet there, and 7-9 mm
      // beside the jaw's 16 mm drew the chin's rim)
      else fl = mix(fl, 0.022, smoothstep(-1.15, -1.55, f[1]) * smoothstep(0.35, -0.65, n[1]) * smoothstep(-1.5, -0.5, f[2]));
      // cubs: woolly (before the lids, the leather and the lips shorten it: a woolly ring round the eye read as a crater)
      if (juv > 0) fl = mix(fl, Math.max(fl, 0.012), juv);
      // eye rims: black lid margins; the fur shortens smoothly toward the lids (no ring of long fur)
      for (const e of eyePrims) {
        const de = Math.abs(SDFModel.dist(e, p[0], p[1], p[2]));
        // a thin pale crescent along the lower lid, just outside its black margin (face_male1 / face_female1)
        if (de < 0.014 && f[1] < -0.02 && (e.P[0] > HEAD_O[0]) === (p[0] > HEAD_O[0])) col = mix3(col, C.eyePatch, 0.8 * smoothstep(0.003, 0.0048, de) * smoothstep(0.0125, 0.0075, de) * smoothstep(-0.02, -0.07, f[1]));
        // (cubs: pale fur all round the eye, cub_Alert_cub_* / cub_Krueger_lion_cub; dark rings read as make-up)
        if (juv > 0 && de < 0.02 && (e.P[0] > HEAD_O[0]) === (p[0] > HEAD_O[0])) col = mix3(col, C.eyePatch, 0.7 * juv * smoothstep(0.0025, 0.004, de) * smoothstep(0.02, 0.008, de));
        // (a cub's margins thinner: the 15 % eye warp widened them into a doll's thick black rims; cub_lying1's
        // are thin)
        const lm = 1 - 0.6 * juv; // (thinner still, the cub's margins read as dark eye make-up rings)
        if (de < 0.007) mark = Math.min(mark, de - 0.0034 * lm); // (bolder margins, the eye read small)
        // (the lid margins and the lip band are leather (1) in a near-black tint: bare dark skin (2) next to
        // fur (0) swept the rounded material id through 1, which takes the tint (leatherTint): a light line)
        if (de < 0.0024 * lm) { mat = MAT.NOSE; col = C.lipDark; fl = 0; lidSkin = 1; }
        else fl = Math.min(fl, mix(0.0015, fl, smoothstep(0.0024, 0.016 - 0.007 * juv, de))); // (a cub's woolly fur shortened over 16 mm left a bare dark ring round the eye)
      }
      // nose leather: a broad T (a wide top bar carrying the nostril wings, 0.8 E across at 0.74 E below the eyes, narrowing
      // in concave sides to the stem and its rounded point at 1.06 E; mfront_Lion_Head, face_male1, ffront_Lioness_*) in one
      // smooth dull leather (render hint leatherTint): pink-brown in young lions darkening to near black with age, darker
      // toward its rim and round the nostrils, and a crisp black outline drawn as a mark (an interpolated distance, so it is
      // smooth at every tier)
      // (the per-vertex freckle noise (230 / m) and the furred upper part with a per-vertex fur edge
      // rendered as ragged broken dark-red patches with a jagged rim)
      const dn = Math.min(...nosePrims.map((q) => SDFModel.dist(q, p[0], p[1], p[2])));
      // (the leather still read as a broad rounded triangular blob blended into the bridge, no T and no
      // nostrils (mfront_Lion_Face, ffront_Lioness_*_33161755071: a broad bar whose outer parts are the two big dark nostrils, a narrow
      // stem down to the philtrum between concave fillets, the leather paler pink-brown on the bar's middle above them))
      // the outline in the face plane (ax, f[1]; E units, > 0 inside): a bar with rounded lower corners under a top edge falling a
      // little to the sides, and the stem, joined by a smooth union (the fillets)
      const yTop = -0.79 - 0.12 * ax * ax;
      const bar = Math.max(sdRBox(ax, f[1], -0.89, 0.34, 0.105, 0.08), f[1] - yTop); // (+-0.34 E: face_female1, face_male1, ffront_* +-0.33)
      const stem = sdRBox(ax, f[1], -1.05, 0.058, 0.085, 0.05);
      const dIn = -sminP(bar, stem, 0.075);
      // the nostrils: tilted ellipses on the bar's outer lower parts, the outer end higher (a comma curving up and out)
      const nu = (ax - 0.19) * 0.95 + (f[1] + 0.93) * 0.31, nw = -(ax - 0.19) * 0.31 + (f[1] + 0.93) * 0.95;
      const dNo = Math.hypot(nu / 0.11, nw / 0.058) - 1;
      const nearNose = partOf[v] !== 2 && f[2] > 0.72 && ax < 0.62 && f[1] > -1.3 && f[1] < -0.45;
      if (nearNose && dIn > 0 && dn < 0.014) {
        fl = 0; mat = MAT.NOSE;
        let dns = 1;
        for (const q of nostrilPrims) dns = Math.min(dns, SDFModel.dist(q, p[0], p[1], p[2]));
        col = mix3(C.nosePink, C.noseDark, clamp(0.02 + 0.7 * noseAge, 0, 1));
        // darker toward the rim and down the stem, the bar's middle above the nostrils palest
        col = mix3(col, C.noseDark, clamp(0.7 * smoothstep(0.07, 0.0, dIn) + 0.3 * smoothstep(-0.95, -1.08, f[1]), 0, 1));
        col = mix3(col, mix3(C.nosePink, C.face, 0.15), 0.35 * smoothstep(0.03, 0.09, dIn) * smoothstep(-0.95, -0.84, f[1]) * smoothstep(0.3, 0.1, ax) * (1 - noseAge));
        // the nostrils and a dark rim round their lower outer side
        col = mix3(col, C.nostril, Math.max(smoothstep(0.25, -0.15, dNo), smoothstep(0.009, 0.0015, dns)));
        // the groove down the middle of the stem
        col = mix3(col, C.noseDark, smoothstep(0.03, 0.008, ax) * smoothstep(-0.96, -1.02, f[1]) * 0.8);
      }
      if (nearNose) {
        // the outline: ~3 mm of black round the sides, the nostril wings and the point, thinner (1.5 mm) along the top edge
        const wR = 0.0015 + 0.0022 * smoothstep(0.03, 0.12, yTop - f[1]);
        const dM = dIn * EM;
        mark = Math.min(mark, dM > 0 ? Math.abs(dM - wR / 2) - wR / 2 : -dM);
        // the fur round the leather very short right up to it (no shell edge over the outline)
        // (above the leather over 0.3 E: the bridge's hair, combed down over the nose, hid its upper half under a furry ledge)
        if (dIn <= 0) fl = Math.min(fl, mix(0.0012, fl, smoothstep(0.0, f[1] > yTop - 0.02 ? 0.3 : 0.12, -dIn)));
      }
      // the philtrum: a black line from the leather's lower point down to the lip (face_male1)
      if (partOf[v] !== 2 && ax < 0.08 && f[1] < -1.1 && f[2] > 0.85) mark = Math.min(mark, ax * EM - 0.0016 + 0.004 * smoothstep(-1.33, -1.41, f[1]));
      // lips: head vertices near the jaw surface, jaw vertices near the head surface: a black lip band
      // along the line where they meet (bare dark lip skin where the surfaces overlap, the mouth lining
      // only deep inside), so the line reads as one smooth black band at every tier
      // (one lip line on the closed mouth: the head's upper lip edge is black where it meets the jaw, and the
      // chin's fur runs up to it; the jaw's rim is the lower lip, black, hidden under the upper lip until the
      // mouth opens, and inside it the trough and the tongue; a black band on both surfaces
      // with the chin's pale front between them read as bared teeth)
      if (partOf[v] !== 2) {
        // (only the upper lip's edge, above the jaw's middle: where the jaw's underside meets the throat skin the line ran
        // round it, and a dead lion's head seen from below showed a white disc in a black ring)
        const lipSide = smoothstep(-1.5, -1.4, f[1]);
        const dj = envelope(p[0], p[1], p[2]);
        // (the palate and the inside of the lips matte and dark, bare skin in its tint: the mouth material, a glossy
        // pink-red whatever its tint, read as a second tongue hanging from the upper jaw in the roar)
        // (not the outward-facing skin behind the mouth corner, where the jowl meets the jaw's side: it shows, a dark slit)
        // (and the head's skin at the back of the mouth, facing forward into the gape, below the palate: hidden by the closed
        // jaw; as fur or black lip skin it drew a band across the open mouth)
        const backMouth = f[2] < 0.1 && ax < 0.3 && f[1] > -1.5 && n[2] > 0.2 && n[1] > -0.7 && (f[1] > -1.42 || ax < 0.12) ? 1 : 0;
        // the six upper incisors: the palate's front edge between the canines (inside the closed jaw's envelope)
        if (dj < -0.003 && lipSide > 0.5 && f[2] > 0.5 && ax < 0.22 && n[1] < -0.2) { const g = ax / 0.07 - Math.round(ax / 0.07); mat = MAT.KERATIN; col = mix3(C.tooth, C.mouth, smoothstep(0.2, 0.08, Math.abs(g)) * 0.85); fl = 0; mark = 1; }
        else if (dj < -0.004 && ((lipSide > 0.5 && (ax < 0.36 || f[2] > 0.15 || n[0] * Math.sign(f[0]) < 0.3)) || backMouth)) { mat = MAT.SKIN; col = mix3(mix3(C.mouth, C.tongue, 0.25), C.lipDark, smoothstep(-0.004, -0.012, dj) * 0.35 * smoothstep(-1.45, -1.25, f[1])); fl = 0; }
        else if (dj < 0.0 && backMouth && f[2] < -0.1) { mat = MAT.SKIN; col = mix3(C.mouth, C.lipDark, 0.3); fl = 0; }
        else if (dj < 0.0 && lipSide > 0.5 && (ax < 0.36 || f[2] > 0.15 || n[0] * Math.sign(f[0]) < 0.3)) { mat = MAT.NOSE; col = C.lipDark; fl = 0; }
        else if (dj < 0.012 && f[2] > -0.18) { mark = Math.min(mark, dj - 0.004 + 0.02 * (1 - lipSide)); fl = Math.min(fl, mix(0.001, fl, Math.max(1 - lipSide, smoothstep(0.004, 0.012, dj)))); }
      } else {
        const dT = tonguePrim ? SDFModel.dist(tonguePrim, p[0], p[1], p[2]) : 1;
        const dM = mouthPrim ? SDFModel.dist(mouthPrim, p[0], p[1], p[2]) : 1;
        // (the jaw's top, facing up inside the closed mouth: the rim black where it turns down to the outside,
        // the mouth colour inside it; the chin's top at the front is the lower lip, not fur)
        // (only where the head's skin covers it in the closed mouth: the ramus's upper side behind the mouth corner shows below
        // the jowl, and painted as the mouth's lining it drew a dark slit there)
        const inside = f[1] > -1.4 && n[1] > 0.1 && (f[2] > 0.0 || SDFModel.evalList(headPrims, p[0], p[1], p[2]) < -0.002);
        // the six lower incisors: the rim's top between the canines, hidden in the closed mouth (a smooth band)
        const incis = f[2] > 0.56 && ax < 0.165 && n[1] > 0.5 && dT > 0.003 && SDFModel.evalList(headPrims, p[0], p[1], p[2]) < -0.002;
        if (incis) { const g = ax / 0.066 - Math.round(ax / 0.066); mat = MAT.KERATIN; col = mix3(C.tooth, C.mouth, smoothstep(0.2, 0.08, Math.abs(g)) * 0.85); fl = 0; mark = 1; }
        else if (dT < 0.0025 && dT < dM + 0.002) { mat = MAT.MOUTH; col = C.tongue; fl = 0; }
        else if (dM < 0.0025 || (inside && n[1] > 0.62)) { mat = MAT.SKIN; col = C.mouth; fl = 0; }
        // (a thin rim, 5 mm, its outer edge a smooth mark on the fur beside it: a 9 mm band switched per vertex read as a
        // thick jagged black rim round a pale tray)
        else if ((dM < 0.005 && n[1] > -0.2) || inside) { mat = MAT.NOSE; col = C.lipDark; fl = 0; }
        else {
          // (the rim's mark field continuous over the jaw's outside: cut off by the normal it jumped from ~1 cm to the 3 cm clamp
          // between neighbouring vertices, and the shader's antialiasing smeared a grey band under the lip line)
          mark = Math.min(mark, dM - 0.0045);
          // (short only along the rim: shortened down to 1.46 E below the eyes, the chin's whole front was bare suede, a
          // smooth pale lens)
          // (only right at the rim: shortened over 2 cm the chin's front below the lip line was a smooth bare plate)
          if (dM < 0.008) fl = Math.min(fl, mix(0.002, fl, smoothstep(0.002, 0.008, dM)));
        }
      }
      // the lip line: the black skin of the upper lip's margin, on its underside and the lower part of its rounded rim, from
      // the philtrum back to the corner of the mouth (face_male1 / face_female1: the closed mouth reads by it; drawn by the
      // jaw's distance it vanished wherever the upper lip hung clear of the jaw)
      if (partOf[v] !== 2 && f[1] < -1.12 && f[2] > -0.3 && ax < 0.66 && n[1] < -0.1) {
        const yb = lipBottom(ax, f[2]);
        // (the underside only, n.y below -0.86: from -0.74 the lip's whole rounded lower edge was a black band 12 mm tall
        // under the pads' hair, a grey smear over the chin)
        // (a band on the rounded rim only, n.y -0.96 .. -0.7: the whole underside black drew a black ring round the chin of a
        // dead lion whose head lay on its side, seen from below, a "porthole")
        // (the outer edge of the underside only: n.y below -0.86 and the normal tilted out from the muzzle's axis, so from the
        // front it is a thin line at the lip's lower edge and from below a thin outline, not a black ring)
        const oz = f[2] - 0.35, ol = Math.hypot(f[0], oz) || 1;
        const outw = (n[0] * f[0] + n[2] * oz) / ol;
        // (with the deeper whisker pads, the band (n.y below -0.83 and tilted out) was cut off along the
        // side of the lip where the jaw lies over 5 mm from the lip, and broke into dashes; the threshold eases from -0.78 to -0.65 behind the
        // pads, where the rim's underside is narrow and tilted (only the lowest ~2 mm of skin: wider, it drew a thick bar from below), and the jaw's distance only fades it behind the canines)
        const nT = mix(-0.6, -0.72, smoothstep(0.55, 0.85, f[2])); // (wider, the line did not read at showcase distance)
        if (yb !== null && f[1] - yb < 0.1) mark = Math.min(mark, Math.max(n[1] - nT, 0.43 - outw) * 0.03 + 0.004 * smoothstep(0.0, -0.3, f[2]) + Math.max(0, f[1] - yb - 0.015) * EM * 1.5 + 0.02 * smoothstep(0.008, 0.02, envelope(p[0], p[1], p[2])) * smoothstep(0.3, 0.1, f[2]));
        // (only near the jaw: the rim's whole outward underside, seen from below (a dead lion's head lying rolled), was a thick black C
        // round the white chin)
        // short hair on the lip's lower edge, so the pads' hair does not hang over the black line (the photos show it crisp)
        if (yb !== null) fl = Math.min(fl, mix(0.0015, fl, smoothstep(0.015, 0.07, f[1] - yb)));
        if (mark < 0) fl = Math.min(fl, 0.0006); // (no black hair standing out of the line: from below it drew a thick bar)
      }
      // teeth only where the canine stands clear of the skin it grows from (its base blends into the jaw's
      // front at the lip line: painted there, the coarse tiers drew a white zigzag like bared teeth)
      for (const c of caninePrims) {
        if (SDFModel.dist(c, p[0], p[1], p[2]) >= 0.0018) continue;
        const skin = SDFModel.evalList(partOf[v] === 2 ? jawPrims : headPrims, p[0], p[1], p[2]);
        if (skin > 0.0015) { mat = MAT.KERATIN; col = C.tooth; fl = 0; mark = 1; }
      }
      under = (whiteV ? 0.5 : 0.42) + 0.3 * w; // (pale greyish roots, more under the white: at 0.35 the face front, seen into the coat, read a uniform dark brown in the showcase's shade)
      // the relief shading (cav): the creases darker and a little warmer, like the shadowed hair in them (more on the white lion, whose
      // pale face otherwise carries no structure at all)
      // (the form's curvature in the paint as well, at ~1.6 cm: the hair in the hollows and creases darker (beside the
      // bridge, under the brow and the cheekbone, between the pads and the cheek), on the ridges and bumps lighter (the brow, the
      // cheekbone, the bridge's edges, the pads), as the photos' diffuse light draws the bony face: ffront_*, f34_*, white_*)
      if (mat === MAT.FUR) {
        let dEyeK = 1;
        for (const e of eyePrims) dEyeK = Math.min(dEyeK, Math.abs(SDFModel.dist(e, p[0], p[1], p[2])));
        const away = smoothstep(0.01, 0.026, dEyeK);
        const dk = smoothstep(6, -28, curv[v]) * (whiteV ? 0.5 : 0.42) * away, lt = smoothstep(12, 36, curv[v]) * 0.22 * away;
        col = mix3(col, [col[0] * 0.55, col[1] * 0.48, col[2] * 0.42], dk);
        col = mix3(col, mix3(col, C.eyePatch, 0.6), lt);
      }
      if (mat === MAT.FUR && cav[v] > 0.1) {
        // (not in the crease between the brow and the upper lid: a dark arc there read as a cartoon eyebrow; the lids have their own margins)
        let dEyeC = 1;
        for (const e of eyePrims) dEyeC = Math.min(dEyeC, Math.abs(SDFModel.dist(e, p[0], p[1], p[2])));
        const ck = smoothstep(0.1, 0.6, cav[v]) * (whiteV ? 0.95 : 0.7) * smoothstep(0.012, 0.03, dEyeC);
        col = mix3(col, whiteV ? mix3([col[0] * 0.5, col[1] * 0.44, col[2] * 0.4], C.tear, 0.15) : [col[0] * 0.5, col[1] * 0.43, col[2] * 0.36], ck);
      }
    }
    // the head's paint hands over to the neck's across their boundary
    if ((r === 1 || r === 2) && hbw[v] > 0 && hbw[v] < 1 && mat === MAT.FUR) {
      if (r === 2) { const [c2, f2, a2] = neckBase(v, p, n, nz), k = 1 - hbw[v]; col = mix3(col, c2, k); fl = mix(fl, f2, k); ag = mix(ag, a2, k); under = mix(under, 0.5, k); }
      else { const [c2, f2] = headBase(p, n), k = hbw[v]; col = mix3(col, c2, k); fl = mix(fl, f2, k); ag = mix(ag, 0, k); under = mix(under, 0.35, k); }
    }
    // mane: long clumped hair; blond ruff at the face darkening to the rear and lower fringe
    const mw = maneW[v];
    if (mw > 0 && mat === MAT.FUR) {
      const face = r === 2 ? 1 : 0;
      const h = headLocal(p);
      // 0 at the face ruff .. 1 at the back of the mane (over the shoulders) and its lower edge
      const back = clamp(smoothstep(0.62, 0.3, p[2]) * 0.8 + smoothstep(0.8, 0.55, p[1]) * 0.7 + 0.35 * nz, 0, 1);
      const ruff = face * smoothstep(-0.02, -0.12, h[2]) * 0.5;
      let mc = mix3(C.maneBlond, C.maneMid, clamp((0.3 + 1.1 * maneDark) * back + 0.35 * maneDark - ruff * 0.3, 0, 1));
      mc = mix3(mc, C.maneDark, clamp((maneDark - 0.25) * 1.8 * back + 0.25 * nz2, 0, 1));
      // (pale under the chin: the white of the chin runs into the front of the mane, face_male1)
      const dJw = SDFModel.evalList(jawSolid, p[0], p[1], p[2]);
      // (and round the jaw's sides, where the ruff meets it: orange mane skin beside the jaw's pale sides drew its outline)
      mc = mix3(mc, mix3(C.chin, C.maneBlond, 0.45), (1 - smoothstep(0.015, 0.06, dJw)) * smoothstep(0.35, -0.2, n[1]) * 0.7);
      mc = mix3(mc, mix3(C.chin, C.maneBlond, 0.35), (1 - smoothstep(0.02, 0.11, dJw)) * smoothstep(-0.2, -0.6, n[1]) * 0.85);
      // the pale ruff framing the face carries on into the mane (face_male1: cream at the face, darker behind)
      const rwm = face ? ruffOf(toFace(h)) * smoothstep(-0.35, -0.02, h[2]) : 0;
      mc = mix3(mc, ruffCol, (face ? ruffPale(toFace(h)) * smoothstep(-0.35, -0.02, h[2]) : 0) * 0.5);
      col = mix3(col, mc, mw);
      // long layered locks: +-30 % in 10-20 cm patches; short (<= 2-3 cm) within ~5 cm of each ear base so
      // the ears stand clear of the crown hair (they read as holes in the mane)
      // (+-45 % from lock to lock at 5-8 cm on top of the 10-20 cm patches: the outline breaks into strands,
      // +-30 % in 10-20 cm patches left a smooth ball at the medium tier, which has no fins)
      const lock = 1 + 0.5 * (fbm3(p[0] * 7 + 5.3 + nOff, p[1] * 7, p[2] * 7, 3) - 0.5) + 0.85 * (vnoise3(p[0] * 17 + 2.1 + nOff, p[1] * 17, p[2] * 17) - 0.5) + 0.15 * nz2;
      let ml = (0.07 + 0.12 * maneK) * Math.max(0.45, lock) * mix(0.7, 1.1, back) * (face ? mix(0.5, 1.15, smoothstep(-0.02, -0.11, h[2])) : 1);
      // the crown in front of the ears: short, the crest rising behind the ear line
      if (face) ml *= mix(1, 0.3, smoothstep(0.02, 0.1, h[1]) * smoothstep(-0.1, -0.03, h[2]));
      // short round the ear bases and on the crest behind them, so the pinnae stand clear of the crown hair
      const dEar = earDist(p);
      // (from the ear's own short fur at its base: a step from 9 to 20 mm there stood as a wall round the ear base)
      // (rising from 5 cm at 0.5 mm per mm: from 3 cm at 0.9 mm per mm the foot of the mane's bevel stood as a ring of clumps
      // round the ear base, 72-94 wall edges)
      ml = Math.min(ml, earCap(dEar));
      // (short beside the jaw, rising over ~8 cm: 8 cm of mane hair standing round the jaw's short fur drew it as a plate
      // sunk in the mane)
      if (face) ml = Math.min(ml, mix(0.026, ml, smoothstep(0.0, 0.1, dJw)));
      // (the face ruff keeps its length beside the eyes up to the ears, clear of the ear bases: capped by the ear rule there,
      // the temples read as the corners of a short-furred plate)
      if (rwm > 0) ml = Math.max(ml, Math.min(ruffFl(toFace(h), 1), earCap(dEar)) * smoothstep(-0.35, -0.02, h[2]));
      fl = mix(fl, ml, mw * mw * (1.5 - 0.5 * mw));
      ag = mix(ag, (0.25 + 0.3 * maneDark) * (1 - 0.65 * rwm), mw);
      under = mix(under, mix(0.35, 0.65, rwm), mw); // (the face ruff: pale roots, few dark tips)
      // (the pale hair under and beside the chin light to the roots: with the mane's dark undercoat it drew a grey fringe
      // round the white chin, which then read as a plate)
      under = mix(under, 0.7, (1 - smoothstep(0.02, 0.09, dJw)) * mw);
      ag = mix(ag, 0, (1 - smoothstep(0.02, 0.09, dJw)) * mw);
    }
    // a maned male's crown: the mane grows from a hairline across the top of the forehead (~0.65 E above the eye line) back over
    // the crown and round the ear bases, so it frames the face from above and the ears stand half in it (mfront_*, m34_*,
    // threequarter_male2; the crown and forehead bare and the ears fully clear, the mane only a ruff at the
    // cheeks and the neck). Its length rises no faster than ~1 mm per mm up to 25 mm (the fur-slope limit), then to the mane's.
    if (male && maneK > 0 && r === 2 && mat === MAT.FUR) {
      const fC = toFace(headLocal(p)), axC = Math.abs(fC[0]);
      const hair = 0.56 + 0.1 * axC * axC + 0.26 * (fbm3(p[0] * 12 + 3.3 + nOff, p[1] * 12, p[2] * 12, 2) - 0.5) + 0.22 * (vnoise3(p[0] * 30 + 1.9 + nOff, p[1] * 30, p[2] * 30) - 0.5); // the hairline, higher toward the temples, ragged (lower, the mane's front edge over the brow)
      // (how far behind the hairline over the skin: up the forehead, then back over the crown)
      const tC = fC[1] - hair + 0.8 * Math.max(0, -0.3 - fC[2]);
      const cw = smoothstep(-0.2, 0.3, tC) * smoothstep(-0.45, 0.05, n[1] + 0.25 * fC[2] / 1.5) * smoothstep(0.35, -0.15, fC[2]);
      if (cw > 0) {
        const lockC = Math.max(0.35, 1 + 1.0 * (vnoise3(p[0] * 20 + 7.3 + nOff, p[1] * 20, p[2] * 20) - 0.5) + 0.6 * (fbm3(p[0] * 7 + 1.7 + nOff, p[1] * 7, p[2] * 7, 2) - 0.5));
        const back = smoothstep(-0.1, -1.1, fC[2]);
        // (the first 25 mm over ~0.3 E of skin, then the long part over the back of the crown and round the ears)
        let cl = 0.024 * smoothstep(-0.25, 0.3, tC) * (0.6 + 0.4 * lockC) + (0.04 + 0.1 * maneK) * lockC * smoothstep(0.15, 0.75, tC) * (0.7 + 0.3 * back); // (the long hair over the whole crown between the ears, measured back over it: by height alone it never reached the mane's length on the crown, which read bare) // (the long hair from just behind the hairline: a short-haired band 0.35-0.95 E deep over the forehead read as a cap's brim)
        // (round the ear bases: long enough to bury the lower half of the pinna, rising from the ear's own short fur)
        cl = Math.min(cl, earCap(earDist(p)));
        if (cl * cw > fl) {
          fl = mix(fl, cl, cw);
          const mcC = mix3(mix3(C.maneBlond, ruffCol, 0.35), mix3(C.maneMid, C.maneDark, clamp(maneDark - 0.3, 0, 1)), clamp(0.15 + 0.55 * maneDark * back + 0.2 * nz, 0, 1));
          col = mix3(col, mcC, cw * smoothstep(0.004, 0.02, cl));
          // (pale roots and few dark-banded tips over the crown and round the face: seen side-on along the head's
          // outline the dark roots and the agouti band drew a dark arc round the face, the rim of a cap)
          ag = mix(ag, (0.08 + 0.2 * maneDark) * smoothstep(0.03, 0.08, cl), cw);
          under = mix(under, 0.65, cw);
        }
      }
    }
    // below the mane's lower edge on the chest the coat takes the mane's fringe colour (no pale bib)
    if (male && maneK > 0 && mat === MAT.FUR && maneW[v] < 0.5 && (r === 0 || r === 1) && p[2] > 0.25) {
      const bw = smoothstep(0.12, 0.0, maneD[v]) * (1 - legness[v]) * 0.65;
      if (bw > 0) col = mix3(col, mix3(C.maneMid, C.maneDark, clamp(maneDark * 0.8, 0, 1)), bw * clamp(0.35 + maneDark, 0, 1));
    }
    // chest fringe
    if (fringe[v] > 0.01 && mat === MAT.FUR) {
      const fw = fringe[v];
      {
        fl = mix(fl, 0.22 * (0.8 + 0.4 * vnoise3(p[0] * 17 + nOff, p[1] * 17, p[2] * 17)), fw);
        col = mix3(col, mix3(C.maneMid, C.maneDark, clamp(maneDark * 0.9, 0, 1)), fw * 0.8);
        ag = mix(ag, 0.4, fw);
      }
    }
    // elbow tufts (males)
    if (elbowPrims.length && mat === MAT.FUR) {
      const de = SDFModel.evalList(elbowPrims, p[0], p[1], p[2]);
      const ew = smoothstep(0.02, -0.004, de);
      if (ew > 0) { fl = mix(fl, 0.05, ew); col = mix3(col, mix3(C.maneMid, C.maneBlond, 0.4), ew * 0.5 * maneDark); }
    }
    // spots / rosettes
    if (SP.spots.length && mat === MAT.FUR) {
      const [sd, s] = featureDistance(SP, p, n, 1 + 0.25 * nz2);
      if (s) {
        // rosettes: a dark ring round a slightly darker centre
        pattern[v] = Math.min(pattern[v], s.ring ? Math.max(sd, -(sd + s.r * 0.45)) : sd);
        // cubs: faint rosettes, strongest on the legs and belly and fading out on the back (cub_lying1,
        // research 1: bold dark rosettes all over read as a leopard cub)
        spotI = (juv ? (r === 2 ? 0.55 : 0.36 * (1 - 0.85 * smoothstep(0.1, 0.65, n[1]))) : 0.22 * spotsK / 0.2) * (1 - 0.4 * s.pale); // (a cub's forehead spots stronger: cub_* photos, the rows of dark spots on the brow and crown)
      }
    }
    // pups: woolly
    // (not the ears: 26 mm on the rims stood as a dark spiky fringe)
    // (the head and the jaw too, rising smoothly from the face outward: 12 mm on the face beside 26 mm across the head
    // region's edge read as a smooth mask in a hood of wool with a dark rim)
    // (and shorter: 26 mm round the face stood as a hood whose side-on shells drew a dark rim round the mask; cub_lying1's
    // coat is soft but fairly sleek, the head short-haired with fluffy cheeks)
    if (juv > 0 && mat === MAT.FUR && r !== 5) {
      const wool = r === 2 || r === 6 ? cubWool(p) : 1;
      const woolLen = r === 1 || r === 2 ? mix(0.02, 0.016, hbw[v]) : 0.02;
      fl = mix(fl, Math.max(fl, woolLen), juv * (r === 1 ? mix(1, cubWool(p), hbw[v]) : wool));
    }
    // low-frequency colour variation
    const cvh = fbm3(p[0] * 3 + 5 + nOff, p[1] * 3, p[2] * 3, 2) - 0.5;
    if (mat === MAT.FUR) col = [col[0] * (1 + 0.12 * nz + 0.08 * cvh + 0.06 * nz2), col[1] * (1 + 0.1 * nz + 0.06 * nz2), col[2] * (1 + 0.08 * nz - 0.06 * cvh + 0.06 * nz2)];
    // (clamped: a mark or pattern field jumping from millimetres to metres at a region's edge blew up the
    // shader's antialiasing width there, a dashed outline round the whisker pads)
    markSDF[v] = Math.min(mark, 0.03);
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    const sc = dotI > 0 ? C.whiskerDot : C.cubSpot;
    patternColor[v * 4] = sc[0]; patternColor[v * 4 + 1] = sc[1]; patternColor[v * 4 + 2] = sc[2]; patternColor[v * 4 + 3] = Math.max(spotI, dotI);
    surf[v * 4 + 2] = mat === MAT.FUR ? clamp(ag * (0.85 + 0.3 * nz2), 0, 1) : 0;
    surf[v * 4 + 3] = mat === MAT.FUR ? under : 0;
    if (mat === MAT.KERATIN) surf[v * 4] = 0.7;
    if (mat === MAT.NOSE) surf[v * 4] = lidSkin ? 0.12 : 0.3; // (dull leather: 0.5 read as a wet plastic nose; the lid margins duller still: glossy, a cub's reflected the sky as bluish rings)
  }

  // smooth fur length so the shells do not step (bare skin stays locked)
  smoothField(furLen, weights.neighbors, 3, (v) => tint[v * 4 + 3] > 0);

  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, region, ventral, tailT, stats: { spots: SP.spots.length, cav: (() => { const a = Array.from(cav).filter((x, v) => region[v] === 2 || region[v] === 6).sort((x, y) => x - y); return [0.5, 0.75, 0.9, 0.97, 0.995].map((q) => a[Math.floor(q * (a.length - 1))]?.toFixed(3)); })() } };
}
