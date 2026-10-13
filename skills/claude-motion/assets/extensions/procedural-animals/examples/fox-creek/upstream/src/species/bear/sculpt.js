// The brown bear, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw). A bear's
// silhouette is mostly coat over fat and muscle: the barrel, the shoulder hump (trapezius /
// rhomboid digging muscle plus fat and the long guard hair of the ruff), the heavy "trousers" of the
// forearms and thighs are sculpted as volume, the shells add the hair on top.
// params: hump (0 black bear .. 1.3 big grizzly male), dish (dished facial profile 0..1), headW,
// muzzle, ear, juv (cub: domed head), girth, claw (claw length factor).
import { HEAD_O, TAIL_SEGS, hlOf } from './rig.js';
import { add, sub, mul, lerp, norm, cross } from '../../core/math/vec.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';

// Eye geometry shared by the sculpt (lids + aperture) and the eyeball shader (head-local, left eye).
// Small eyes (~16 x 11 mm palpebral fissure, eyeball r 12 mm), set forward (diverging ~20 deg),
// ~90 mm apart (x headW; face1 / face2: the nose pad's bottom 0.91-0.98 eye separations under the eye line);
// the eyeball front flush with the skin (1.08 r: at 0.043 / 0.0668 the brow, bridge and cheek stood 5 mm in
// front of it, 1.36 r, and the lids were buried in a tunnel).
export const EYE_BASE = { c: [0.045, 0.03, 0.0698], r: 0.014, back: 0.003, yaw: 0.36, pitch: 0.06, lid: 0.0018, R: 0.0116, d: 0.0049, off: -0.0014, tilt: (10 * Math.PI) / 180, irisZ: 0.0086, irisR: 0.0108 };
export const eyeOf = (params = {}) => ({ ...EYE_BASE, c: [EYE_BASE.c[0] * (params.headW || 1), EYE_BASE.c[1], EYE_BASE.c[2]] });

const X = [1, 0, 0];
// the toe joints (ftoe / htoe) sit at the claw tips: the paw rolls about them at push-off, so the
// claws never dig into the ground (m ahead of the toe pads)
export const TOE_F = 0.05, TOE_H = 0.035;

export function sculptBear(m, rig, params = {}) {
  const J = rig.J;
  const EYE = eyeOf(params);
  const mz = params.muzzle || 1, hw = params.headW || 1, juv = params.juv || 0;
  const hump = params.hump ?? 1, dish = params.dish ?? 1, girth = params.girth ?? 1;
  const hl = hlOf(mz, hw);
  const hr = (r) => [r[0] * hw, r[1], r[2]]; // radii in head space
  const eyeFrame = (s) => eyeFrameOf(EYE, HEAD_O, s);

  // Ellipsoid whose local Y follows `ydir`; radii = [lateral, along ydir, third axis]
  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };
  const G = girth;
  // the barrel is broad: from the front a brown bear's body with its coat is ~2x its head and ~3x its
  // stance wide (tq2, front3); the torso's lateral radii carry this factor (1: the body read narrow,
  // 1.3x its head, under an oversized head)
  const GW = G * 1.12;

  // ---------------------------------------------------------------- TORSO
  // a deep, very broad barrel; the back line dips a little behind the hump and rises to the rump;
  // the belly hangs low with its fringe of long hair
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 0.665, 0.06], r: [0.235 * GW, 0.22, 0.32], axis: norm([0, 0.05, -1]), k: 0 });
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.58, 0.29], r: [0.175 * GW, 0.17, 0.14], axis: norm([0, -0.3, 1]), k: 0.08 });
  m.ell({ tag: 'pectoral', bone: 'chest', c: [0, 0.645, 0.38], r: [0.165 * GW, 0.15, 0.09], k: 0.07 });
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.84, 0.17], r: [0.15 * GW, 0.09, 0.18], axis: norm([0, -0.1, 1]), k: 0.08 });
  // the hump: a mass of muscle and fat over the shoulder blades (absent in the black bear), a broad
  // swell from the nape well back over the shoulders that runs into the back line (side1, side2, tq4);
  // (a 32 cm long, 14 cm tall mound stood up on big males like a camel's hump)
  // (moderate: the back's highest point over the shoulders, ~4-6 % of the height above the back behind it, side1 / side2;
  // 12 cm above it, blended with k 0.12, the render's was 10-13 % and read as a big mound)
  if (hump > 0.05) {
    const ry = 0.03 * hump + 0.035;
    m.ell({ tag: 'hump', bone: 'chest', c: [0, 0.905 + 0.03 * hump - ry, 0.225], r: [0.13 * GW * (0.7 + 0.3 * hump), ry, 0.24], axis: norm([0, 0.08, 1]), k: 0.07 });
  }
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 0.82, -0.04], r: [0.17 * GW, 0.08, 0.18], k: 0.08 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.655, -0.14], r: [0.195 * GW, 0.19, 0.22], axis: norm([0, 0.08, -1]), k: 0.08 });
  // (4 cm lower and longer than before: the belly line hangs at 0.23-0.30 of the hump height in side1-3, the
  // render's was 0.34-0.36)
  // (its front end stays 5 cm behind the elbows: reaching them, it took forearm weight and the lying forearm
  // pressed 11 mm into the ground as the bear rose from sleep)
  m.ell({ tag: 'belly', bone: 'spine2', c: [0, 0.475, -0.05], r: [0.12 * GW, 0.09, 0.2], k: 0.08 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 0.81, -0.21], r: [0.17 * GW, 0.08, 0.15], k: 0.07 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 0.665, -0.28], r: [0.19 * GW, 0.17, 0.14], k: 0.07 });
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 0.73, -0.4], r: [0.19 * GW, 0.155, 0.15], k: 0.07 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 0.82, -0.38], r: [0.15 * GW, 0.07, 0.14], k: 0.06 });
  // the crotch between the thighs belongs to the body (anchors the midline skin: the thighs fold
  // forward when lying and pulled it apart)
  m.ell({ tag: 'perineum', bone: 'pelvis', c: [0, 0.6, -0.45], r: [0.07, 0.07, 0.13], k: 0.06 });
  for (const s of [1, -1]) {
    // round heavy buttocks behind the thighs
    m.ell({ tag: 'rump', bone: 'pelvis', c: [0.09 * s * GW, 0.7, -0.5], r: [0.105 * GW, 0.14, 0.1], k: 0.06 });
  }

  // ---------------------------------------------------------------- NECK (short, as thick as the head)
  m.cone({ tag: 'neck', bone: 'neck1', a: [0, 0.72, 0.32], b: [0, 0.775, 0.49], ra: 0.17 * G, rb: 0.135, k: 0.08 });
  m.cone({ tag: 'neck', bone: 'neck2', a: [0, 0.775, 0.49], b: [0, 0.785, 0.58], ra: 0.125, rb: 0.1, k: 0.07 });
  m.ell({ tag: 'nape', bone: 'neck1', c: [0, 0.83, 0.37], r: [0.11 * G, 0.06, 0.13], axis: norm([0, 0.25, 1]), k: 0.07 });
  m.ell({ tag: 'throat', bone: 'neck2', c: [0, 0.67, 0.51], r: [0.095, 0.09, 0.1], axis: norm([0, 0.6, 0.8]), k: 0.08 });
  // ruff: long hair down the sides of the neck and under the throat
  m.ell({ tag: 'ruff', bone: 'neck1', c: [0, 0.7, 0.42], r: [0.15 * G, 0.14, 0.12], axis: norm([0, 0.4, 1]), k: 0.07 });

  // ---------------------------------------------------------------- HEAD (head-local coords, see HEAD_O)
  // landmarks from profile / frontal photos (adult ~0.36 m occiput -> nose): nose tip
  // (0, -0.012, 0.215), eyes (+-0.047, 0.03, 0.058), stop z ~0.085, chin (0, -0.085, 0.16), skull top
  // ~0.1 (the forehead rises steeply from the muzzle: the "dished" profile), occiput -0.125,
  // cheek width ~0.3 m with the cheek ruff. A cub has a domed skull and a short muzzle (params).
  const H = { bone: 'head' };
  // Profile (side2, face3_profile, the head levelled): the top line rises ~13 deg along the bridge from
  // the nose pad to the eyes, then ~23 deg up a long forehead to a low crown between the ears (y ~0.11):
  // a shallow dish at the stop, not a dome (a forehead climbing 8 cm within 4 cm in front of the eyes
  // stood up as a cap). Straighter in the black bear (dish 0.15); a cub's skull is domed.
  // braincase: long, broad, low-crowned
  // (broad: at 8.8 cm wide the braincase with the crest read as a ball between ears on top of it)
  m.ell({ ...H, tag: 'cranium', c: hl([0, 0.028 + 0.014 * juv, -0.04]), r: hr([0.094, 0.076 + 0.016 * juv, 0.1]), k: 0.05 });
  // forehead: a broad slope from the stop between the eyes back and up to the crown
  m.cone({ ...H, tag: 'forehead', a: hl([0, 0.02 + 0.006 * (1 - dish) + 0.008 * juv, 0.045]), b: hl([0, 0.042 + 0.012 * juv, -0.07]), ra: 0.041 * hw, rb: 0.068 * hw, k: 0.05 });
  // crown between the ears (temporal muscles over the sagittal crest)
  // (broad and flat between the ears: the temporal muscles fill the skull's top out to the ear bases)
  m.ell({ ...H, tag: 'crest', c: hl([0, 0.068 + 0.012 * juv, -0.066]), r: hr([0.1, 0.04, 0.075]), k: 0.05 });
  for (const s of [1, -1]) {
    // (over the upper lid: face2 / face3_profile show hooded eyes under a brow; 5 mm higher and 4 mm further back
    // the eyes were round beads with nothing over them)
    m.ell({ ...H, tag: 'brow', c: hl([0.042 * s, 0.0475, 0.056]), r: hr([0.021, 0.0095, 0.017]), k: 0.012 });
    // the widest part of the skull: the zygomatic arches at and behind the eyes
    // (wider: the face is broadest across the cheekbones, face1 / face2)
    m.ell({ ...H, tag: 'zygomatic', c: hl([0.079 * s, 0.004, -0.014]), r: hr([0.043, 0.043, 0.066]), axis: norm([-0.25 * s, 0, 1]), k: 0.06 });
    // fleshy cheek over the upper jaw below the eye (no jowl: nothing hangs below the jaw line)
    m.ell({ ...H, tag: 'cheek', c: hl([0.05 * s, -0.014, 0.035]), r: hr([0.036, 0.03, 0.052]), k: 0.05 });
    // skin under the cheek ruff behind the zygoma (the broad face is hair: coat.js)
    // (heavy and low, down beside the jaw: the cheeks run on into the neck, face1 / tq1 / front1)
    m.ell({ ...H, tag: 'cheekruff', c: hl([0.076 * s, -0.016, -0.078]), r: hr([0.045, 0.056, 0.06]), axis: norm([0.3 * s, 0, 1]), k: 0.07 });
    m.ell({ ...H, tag: 'masseter', c: hl([0.055 * s, -0.03, -0.04]), r: hr([0.032, 0.036, 0.048]), k: 0.06 });
    // the upper lip hangs a little over the lower jaw
    // (reaching back to the mouth corner below the front of the eye: the lip line runs straight back from
    // the chin; a gap between the lip and the masseter bowed it up into a smile)
    // (its rear end 1 cm lower: the mouth line runs straight back and a little down to the corner, face3_profile /
    // tq1 / front1; rising toward the cheek it read as a smile)
    m.ell({ ...H, tag: 'lip', c: hl([0.029 * s, -0.058, 0.112]), r: hr([0.018, 0.026, 0.09]), axis: norm([-0.2 * s, 0.06, 1]), k: 0.02 });
    // (the upper lip's rear, back to the mouth corner below the front of the eye: the lip above tapered there and the head's
    // lower outline rose ~2 cm over its last 4 cm, so the mouth line turned up toward the cheek, a smile in the low 3/4;
    // tq1 / front1 / face3_profile: the line runs straight back and a little down to the corner)
    m.ell({ ...H, tag: 'lip', c: hl([0.04 * s, -0.07, 0.035]), r: hr([0.017, 0.017, 0.048]), axis: norm([-0.3 * s, 0.14, 1]), k: 0.018 });
    m.ell({ ...H, tag: 'whisker', c: hl([0.022 * s, -0.035, 0.172]), r: hr([0.017, 0.019, 0.03]), k: 0.018 });
  }
  // long, broad muzzle; a shallow concave line from the stop to the nose (straighter in the
  // black bear), a big black nose pad standing proud of the muzzle
  // (the bridge runs down to the nose pad's top edge: the pad is the tip of the muzzle)
  // (the bridge runs straight down onto the top edge of the nose pad, side2: 1.4 cm above it the pad sat on the
  // front of a round snout like a teddy's button nose)
  m.cone({ ...H, tag: 'nasal', a: hl([0, 0.016 + 0.012 * (1 - dish), 0.07]), b: hl([0, -0.008, 0.19]), ra: 0.038 * hw, rb: 0.024 * hw, k: 0.03 });
  // (narrower in front: face2 shows the muzzle 1.4 x the nose pad wide at the pad, the render was 1.8 x)
  m.ell({ ...H, tag: 'muzzle', c: hl([0, -0.028, 0.13]), r: hr([0.04, 0.048, 0.08]), axis: norm([0, -0.1, 1]), k: 0.03 });
  // (0.57 x the eye separation wide, as face1 / face2; flat in front, its top edge rolling back into the
  // bridge; a ball-shaped pad read as a clown's nose)
  // The pad (face2, face1, front3, tq1): a rounded trapezoid ~1.3 x as wide as tall (0.44-0.51 eye separations), its
  // top edge broad and nearly straight, its front flat, the bottom straight across with the nostrils at its corners;
  // two lobes (one smooth oval read as a rubber button)
  // (flat-fronted: the old 14 mm deep lobes, the lower one narrowing to a point between the nostrils, made a glossy dome
  // over a downward beak)
  m.ell({ ...H, tag: 'nose', c: hl([0, 0.0078, 0.2105]), r: hr([0.0238, 0.0135, 0.0118]), axis: norm([0, -0.12, 1]), k: 0.006 });
  m.ell({ ...H, tag: 'nose', c: hl([0, -0.009, 0.2105]), r: hr([0.0218, 0.0125, 0.0115]), axis: norm([0, -0.2, 1]), k: 0.008 });
  // (the upper lip hangs as low in the middle as at the sides: a notch there showed the chin as a pout)
  m.ell({ ...H, tag: 'philtrum', c: hl([0, -0.049, 0.194]), r: hr([0.018, 0.025, 0.013]), k: 0.014 });
  for (const s of [1, -1]) {
    const ef = eyeFrame(s);
    const at = (u, v, w) => add(add(add(ef.c, mul(ef.x, u)), mul(ef.y, v)), mul(ef.z, w));
    // orbit: a soft hollow so the brow, cheek and bridge fall away to the lids
    ellY({ ...H, tag: 'orbit', c: at(-0.002 * s, 0.0, 0.02), ydir: ef.y, lateral: ef.x, r: [0.02, 0.014, 0.012], k: 0.01, carve: true });
    m.sphere({ ...H, tag: 'eyelid', c: ef.c, rad: EYE.r + EYE.lid, k: 0.006 });
    m.lens({ ...H, tag: 'eyesocket', c: add(ef.c, mul(ef.y, EYE.off)), x: ef.x, y: ef.y, z: ef.z, R: EYE.R, d: EYE.d, zMin: -0.002, zMax: 0.024, k: 0.0022, carve: true });
    // nostrils (face2 / face1 / face3_profile / tq1): comma-shaped openings at the lower corners of the pad, a round
    // opening that faces down and out (it is drilled along the pad's normal there) and a slit curving up and back along
    // the side of the pad; from the front each reads as a dark crescent at the side, the wide septum between them
    // (6.8 x 3.4 mm dimples were invisible from the front; round holes facing forward beside the midline
    // read as the holes of a button)
    m.ell({ ...H, tag: 'nostril', c: hl([0.0135 * s, -0.0138, 0.2172]), r: [0.0064, 0.0045, 0.009], axis: norm([0.35 * s, -0.5, 0.8]), up: [0, 1, 0], k: 0.002, carve: true });
    m.ell({ ...H, tag: 'nostril', c: hl([0.0198 * s, -0.0078, 0.2132]), r: [0.0026, 0.0068, 0.0058], axis: norm([0.8 * s, -0.15, 0.6]), up: norm([0.5 * s, 1, 0]), k: 0.002, carve: true });
    // canines, hidden behind the lips until the mouth opens
    m.cone({ ...H, tag: 'canine', a: hl([0.019 * s, -0.052, 0.148]), b: hl([0.018 * s, -0.066, 0.146]), ra: 0.0055, rb: 0.002, k: 0.002 });
  }
  // the groove down the middle of the pad's lower half, between the nostrils (it runs on as the philtrum, coat.js)
  // (ending above the pad's lower edge: cut through it, it left a lit cusp under the pad, a pale tick)
  m.ell({ ...H, tag: 'nosegroove', c: hl([0, -0.0132, 0.2228]), r: [0.0021, 0.0056, 0.0032], axis: norm([0, -0.3, 1]), k: 0.0015, carve: true });

  // ---------------------------------------------------------------- JAW (separate surface so the mouth can open)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  // (shallow in front, its top lower toward the mouth corner: face3_profile / side2 show a small receding chin, the
  // nose pad : upper lip : chin ~1 : 0.95 : 0.3 in depth, and a mouth line running straight back and a little down;
  // a 3 cm deep jaw whose top rose toward the hinge bulged below a mouth line curving up into a smile)
  m.cone({ ...JW, tag: 'mandible', a: hl([0, -0.07, -0.02]), b: hl([0, -0.076, 0.152]), ra: 0.026, rb: 0.012, k: 0 });
  for (const s of [1, -1]) {
    m.cone({ ...JW, tag: 'mandible', a: hl([0.05 * s, -0.066, -0.035]), b: hl([0.014 * s, -0.073, 0.152]), ra: 0.02, rb: 0.011, k: 0.025 });
  }
  // a small chin set back under the upper lip
  // (small: a chin standing 2 cm below the upper lip, painted pale, read as a pout)
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.079, 0.1]), r: hr([0.016, 0.01, 0.02]), k: 0.02 });
  m.cone({ ...JW, tag: 'canine', a: hl([0.017, -0.078, 0.155]), b: hl([0.018, -0.068, 0.157]), ra: 0.005, rb: 0.0018, k: 0.002 });
  m.cone({ ...JW, tag: 'canine', a: hl([-0.017, -0.078, 0.155]), b: hl([-0.018, -0.068, 0.157]), ra: 0.005, rb: 0.0018, k: 0.002 });

  // ---------------------------------------------------------------- EARS
  // small, round, furred, set wide on the top corners of the head
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const up = norm(sub(tip, base));
    // (turned a little more outward than before, 0.45: in profile the thin pinna was seen edge-on and its fur drew a
    // tall, pointed ear; side1 / face3_profile show a short round ear from the side)
    const facing = norm([0.6 * s, 0.05, 1]);
    const lat = norm(cross(up, facing));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    const at = (t) => lerp(base, tip, t);
    const ek = params.ear || 1;
    // (a thin pinna, 9 cm wide before the head warp, its bulk the hair: an 11 cm, 4 cm thick paddle with a
    // round dish carved in front read as a teddy's cup ear with a thick rim; tq2, front2, face1 / face2 show
    // small ears 0.6-0.9 x the eye separation wide with their fur)
    ellY({ ...ear, tag: 'ear', c: at(0.3), ydir: up, lateral: lat, r: [0.045 * ek, 0.043 * ek, 0.012], k: 0.016 });
    // (the top a little flatter: face2 / tq2 show a broad rounded top, not a disc)
    ellY({ ...ear, tag: 'ear', c: at(0.7), ydir: up, lateral: lat, r: [0.045 * ek, 0.029 * ek, 0.0095], k: 0.016 });
    ellY({ ...ear, tag: 'earinner', c: add(at(0.45), mul(facing, 0.0105)), ydir: up, lateral: lat, r: [0.026 * ek, 0.03 * ek, 0.0065], k: 0.006, carve: true });
  }

  // ---------------------------------------------------------------- LEGS
  // massive columns; broad plantigrade feet with five toes (the long, curved, non-retractile claws: claws.js)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.5), sx([0.02, 0, 0])), ydir: sub(Sh, Sc), lateral: lat, r: [0.07, 0.17, 0.13], k: 0.08, bias: 0.004 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.11, rb: 0.085, k: 0.08 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.5), [0, 0, -0.06]), ydir: sub(E, Sh), lateral: lat, r: [0.085, 0.15, 0.08], k: 0.07 });
    ellY({ tag: 'armpit', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.75), sx([-0.035, 0.02, 0.02])), ydir: sub(E, Sh), lateral: lat, r: [0.06, 0.1, 0.08], k: 0.08 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.02, -0.035]), rad: 0.045, k: 0.04 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: E, b: W, ra: 0.08, rb: 0.056, k: 0.04 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.3), sx([0.008, 0, 0.012])), ydir: sub(W, E), lateral: lat, r: [0.075, 0.13, 0.075], k: 0.05 });
    // "sleeves": the long hair behind the forearm
    ellY({ tag: 'feather', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.4), [0, 0, -0.045]), ydir: sub(W, E), lateral: lat, r: [0.055, 0.13, 0.045], k: 0.04 });
    m.sphere({ tag: 'wrist', bone: 'metacarpus' + S, group: g, c: add(W, [0, -0.002, 0.0]), rad: 0.05, k: 0.03 });
    // the forepaw: a broad pad of a hand, the palm flat on the ground
    const dp = norm(sub(T, M));
    // (flat: a flexed paw shows a flat palm, not a ball)
    ellY({ tag: 'palm', bone: 'metacarpus' + S, group: g, c: add(lerp(W, M, 0.55), [0, -0.016, 0]), ydir: sub(M, W), lateral: lat, r: [0.07, 0.07, 0.027], k: 0.03 });
    m.sphere({ tag: 'carpalpad', bone: 'metacarpus' + S, group: g, c: add(W, [0, -0.052, -0.02]), rad: 0.017, k: 0.015 });
    ellY({ tag: 'paw', bone: 'fpaw' + S, group: g, c: add(add(M, mul(dp, 0.01)), [0, 0.003, 0]), ydir: dp, lateral: lat, r: [0.075, 0.045, 0.03], k: 0.022 });
    // five toes in an arc (the claws are their own surfaces, claws.js)
    const toeX = [-0.056, -0.028, 0.0, 0.028, 0.056], toeZ = [-0.02, -0.004, 0.002, -0.004, -0.02];
    for (let i = 0; i < 5; i++) {
      const tp = [T[0] + toeX[i] * s, 0.024, T[2] - TOE_F - 0.012 + toeZ[i]];
      m.sphere({ tag: 'toe', bone: 'fpaw' + S, group: g, c: tp, rad: 0.019, k: 0.012 });
    }

    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Tt = J['htoe' + S];
    // broad heavy thighs ("trousers" of long hair behind), the flank fold running into the belly
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.42), sx([0.02, 0, -0.03])), ydir: sub(K, Hp), lateral: lat, r: [0.1, 0.24, 0.16], k: 0.08, bias: 0.004 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.12, 0.7, -0.22]), b: add(K, sx([-0.01, 0.07, 0.02])), ra: 0.1, rb: 0.07, k: 0.08 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.13, 0.74, -0.46]), b: add(lerp(K, Hk, 0.3), [0, 0, -0.05]), ra: 0.1, rb: 0.07, k: 0.07 });
    ellY({ tag: 'breeches', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.65), sx([0.015, -0.02, -0.12])), ydir: sub(K, Hp), lateral: lat, r: [0.075, 0.13, 0.06], k: 0.05 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.13, 0.56, -0.16]), ydir: [-0.05, 0.2, 0.12], lateral: lat, r: [0.05, 0.13, 0.08], k: 0.08 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.005, 0.01, 0.015])), rad: 0.055, k: 0.05 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: lerp(K, Hk, 0.05), b: Hk, ra: 0.065, rb: 0.052, k: 0.04 });
    ellY({ tag: 'calf', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.004, 0.01, -0.045])), ydir: sub(Hk, K), lateral: lat, r: [0.065, 0.12, 0.06], k: 0.05 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, -0.02, -0.035]), rad: 0.045, k: 0.03 });
    m.sphere({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: Hk, rad: 0.056, k: 0.03 });
    // the long flat sole: heel pad on the ground behind the hock
    const dh = norm(sub(Tt, Mt));
    ellY({ tag: 'sole', bone: 'metatarsus' + S, group: h, c: add(lerp(Hk, Mt, 0.5), [0, -0.006, 0]), ydir: sub(Mt, Hk), lateral: lat, r: [0.062, 0.12, 0.032], k: 0.03 });
    ellY({ tag: 'paw', bone: 'hpaw' + S, group: h, c: add(add(Mt, mul(dh, 0.012)), [0, 0.004, 0]), ydir: dh, lateral: lat, r: [0.066, 0.042, 0.03], k: 0.022 });
    const hx = [-0.048, -0.024, 0.0, 0.024, 0.048], hz = [-0.018, -0.004, 0.002, -0.004, -0.016];
    for (let i = 0; i < 5; i++) {
      const tp = [Tt[0] + hx[i] * s, 0.022, Tt[2] - TOE_H - 0.012 + hz[i]];
      m.sphere({ tag: 'toe', bone: 'hpaw' + S, group: h, c: tp, rad: 0.017, k: 0.011 });
    }
  }

  // ---------------------------------------------------------------- TAIL
  // a stubby tail (~10 cm with its hair), hidden in the rump fur
  m.cone({ tag: 'tailroot', bone: 'tail0', a: [0, 0.77, -0.46], b: J.tail1, ra: 0.045, rb: 0.035, k: 0.04 });
  for (let i = 0; i < TAIL_SEGS; i++) {
    m.cone({ tag: 'tail', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: 0.035 - 0.01 * i, rb: 0.025 - 0.01 * i, k: 0.02, thin: i === TAIL_SEGS - 1 });
  }
  return m;
}
