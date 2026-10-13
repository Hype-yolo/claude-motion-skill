// The pig, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / snout / jaw).
// The head is modelled in its own frame (rig.js: hl()), measured from the profile and frontal
// references (face1, front1, face2); the body relative to the joints so the sculpt follows the
// skeleton.
//
// A pig is a barrel on four short legs sunk into it: the shoulders, the back and the hams are one
// smooth fat-covered mass (no visible withers, no waist), the neck is hidden in the jowls, and the
// wedge-shaped head ends in the flat rostral disc with its two nostrils.
//
// Individual knobs (params, see index.js): boar (0 sow .. 1 boar: shoulder shield, crest over the
// neck, bigger jowls, tusks, sheath and testes instead of the teat row), belly (0 lean .. 1 a sow's
// sagging belly), teats (pairs), ear ('erect' | 'semi' | 'lop'), earSize, dish (dished face,
// Berkshire), snoutLen, ham (fullness of the hams), piglet.
import { HEAD_O, HZ, HY, hl, hdir, TAIL_SEGS, SNOUT_K } from './rig.js';
import { add, sub, mul, lerp, norm, cross } from '../../core/math/vec.js';
import { eyeFrameOf, apertureTiltAlong } from '../../core/sdf/eyeSocket.js';
import { earLeaf } from './ears.js';

// Eye (head-local centre -> offset from HEAD_O): globe ~23 mm, visible opening ~20 x 11 mm, under
// a fat-padded brow, at the side of a face that narrows in front of it (face2, front1: both eyes
// show from straight in front). EYE_OUT moves the ball out along its axis so its front sits at the
// skin (the lids are the surface, not a tunnel through the brow and jowl: AUTHORING section 7).
const EYE_LOCAL = [0.058, 0.026, 0.006];
const EYE_FWD = 40; // deg forward of lateral (along the head)
const EYE_OUT = 0.016;
const eyeDir = (() => {
  const a = (EYE_FWD * Math.PI) / 180;
  return norm(add(add([Math.cos(a), 0, 0], mul(HZ, Math.sin(a))), mul(HY, 0.1)));
})();
// (the aperture: 20 x 14 mm, a rounder opening than the 22 x 12 mm almond, which read as a narrow slit: front1,
// face2 show round dark eyes with level lids)
// (the 20 x 14 mm opening showed the whole round iris, a doll's eye; the photos (eye_lwshow_R,
// eye_mochyn, eye_gifu) show a small almond, ~19 x 10.5 mm, with pointed corners, the upper lid hooding the top of
// the iris: R 11.2 / d 6.0 mm)
const EYE_BASE = {
  c: add(sub(hl(EYE_LOCAL), HEAD_O), mul(eyeDir, EYE_OUT)), r: 0.0128, back: 0.003, yaw: Math.atan2(eyeDir[0], eyeDir[2]), pitch: Math.asin(eyeDir[1]),
  lid: 0.0028, R: 0.0112, d: 0.006, off: 0.0006, tilt: 0, irisZ: 0.0074, irisR: 0.0088,
};
// the lid line level in the standing carriage (laid along the head axis, which is carried 35 deg
// nose-down, and rolled 0.12 further, the almond sloped 24 deg down toward the snout: a sly, angry look; the
// untilted frame is level, apertureTiltAlong(EYE_BASE, HEAD_O, HZ) - 0.12 was 0.44)
// (a slight roll, the inner corner a little lower: eye_lwshow_R, eye_mochyn)
EYE_BASE.tilt = 0.1;
void apertureTiltAlong; void HZ;
export const EYE = EYE_BASE;

const X = [1, 0, 0];
const UP = [0, 1, 0];

// tusk centre line (head-local, left): the lower canine grows out of the jaw beside the snout and
// curves up and back outside the upper lip
// (rooted in the jaw a third of the way from the disc to the eye, out through the mouth line at the
// side, then up and back clear of the lip)
export function tuskPath(params, s) {
  const L = params.tusks || 0;
  const a = [0.03 * s, -0.078, 0.128];
  const b = [0.066 * s, -0.066, 0.132];
  const m = [0.077 * s, -0.052 + 0.014 * L, 0.13 - 0.008 * L];
  const c = [0.082 * s, -0.05 + 0.04 * L, 0.127 - 0.04 * L];
  return [a, b, m, c];
}
// the tusk as a smooth arched cone (reference space, the bind pose): a chain of round cones along a cubic Bezier
// from just inside the lower lip (a little way from the root toward b) over b and m to the tip c, tapering from
// 4.5-7 mm to a 1.2 mm point. Its own part, meshed finely (regions.js): in the jaw's 3 mm cells the 2-6 mm cone
// meshed as a crumpled, faceted blade, and the lip crease painted round it.
export const TUSK_N = 8;
export function tuskCones(params, s) {
  const T = tuskPath(params, s).map(hl), L = params.tusks || 0;
  const P0 = lerp(T[0], T[1], 0.55), P1 = T[1], P2 = T[2], P3 = T[3];
  const at = (t) => { const u = 1 - t; return add(add(mul(P0, u * u * u), mul(P1, 3 * u * u * t)), add(mul(P2, 3 * u * t * t), mul(P3, t * t * t))); };
  const r0 = 0.0045 + 0.0025 * L, r1 = 0.0012;
  const rad = (t) => r1 + (r0 - r1) * (1 - Math.pow(t, 1.3));
  const out = [];
  for (let i = 0; i < TUSK_N; i++) { const t0 = i / TUSK_N, t1 = (i + 1) / TUSK_N; out.push({ a: at(t0), b: at(t1), ra: rad(t0), rb: rad(t1) }); }
  return out;
}

// Ear leaves (ears.js): the tiles of one smooth curved sheet, thick at the root and thinning to a round rim.
// (Exported under the old name for the meshing plan and the tools.)
export function earShape(J, params, S) {
  return earLeaf(J['earBase' + S], S, params);
}

// The eye in its socket (core sculptEyeSocket, plus the lids): an orbit hollow, the lid shell over the ball, a soft
// roll of the upper lid along the top of the opening and a thinner lower lid, then the almond cut through them, so
// the lid margins stand as rounded rims round the eye instead of a hole cut in a smooth shell (which read as a
// ragged dark speck; eye_lwshow_R, eye_mochyn, eye_gifu: a thick, rounded upper lid with a fold above it, a
// slim lower lid). The rolls are straight along the opening, so they sink into the ball toward the corners.
function pigEye(m, s) {
  const E = EYE, ef = eyeFrameOf(E, HEAD_O, s), bone = 'head';
  const at = (u, v, w) => add(add(add(ef.c, mul(ef.x, u)), mul(ef.y, v)), mul(ef.z, w));
  m.ell({ bone, tag: 'orbit', c: at(0, 0.0015, 0.014), axis: ef.z, up: ef.y, r: [0.016, 0.0115, 0.008], k: 0.011, carve: true });
  m.sphere({ bone, tag: 'eyelid', c: ef.c, rad: E.r + E.lid, k: E.r * 0.4 });
  const h = E.R - E.d, rl = E.r + E.lid;
  const onShell = (y) => Math.sqrt(Math.max(0, rl * rl - y * y));
  // upper lid: a roll ~2 mm proud of the shell over the top of the opening
  const yu = E.off + h + 0.0016;
  m.ell({ bone, tag: 'lidroll', c: at(0, yu, onShell(yu) - 0.0012), axis: ef.z, up: ef.y, r: [0.0105, 0.0032, 0.0028], k: 0.003 });
  // lower lid: slimmer, ~1 mm proud
  const yl = E.off - h - 0.0012;
  // (soft and broad: a thinner roll meshed a droplet-shaped knot under the lid at medium's 2.1 mm eyelid cells)
  m.ell({ bone, tag: 'lidroll', c: at(0, yl, onShell(yl) - 0.0017), axis: ef.z, up: ef.y, r: [0.0088, 0.0028, 0.0026], k: 0.0035 });
  m.lens({ bone, tag: 'eyesocket', c: add(ef.c, mul(ef.y, E.off)), x: ef.x, y: ef.y, z: ef.z, R: E.R, d: E.d, zMin: -E.r * 0.16, zMax: E.r * 2, k: E.r * 0.18, carve: true });
  return ef;
}

export function sculptPig(m, rig, params = {}) {
  const J = rig.J;
  const piglet = params.age === 'juvenile';
  const boar = params.boar ?? 0;
  const belly = params.belly ?? 0.3;
  const hamK = params.ham ?? 1;
  const fat = params.fat ?? 1;
  const snoutK = (params.snoutLen ?? 1) * SNOUT_K;
  const dish = params.dish ?? 0.2;

  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };
  // ellipsoid in head-local coordinates: r = [lateral, dorsal, along the head]
  const H = { bone: 'head' };
  const hell = (o) => m.ell({ ...H, ...o, c: hl(o.c), axis: o.axisL ? norm(hdir(o.axisL)) : HZ, up: o.upL ? norm(hdir(o.upL)) : HY });
  const SN = { bone: 'snout', group: 'snout' };
  // snout-local along coordinate: the snout is longer or shorter per breed / individual (the
  // rostral end moves, the eyes stay)
  const sz = (z) => (z > 0.06 ? 0.06 + (z - 0.06) * snoutK : z);

  // ---------------------------------------------------------------- TORSO
  // one long barrel: shoulders, back and hams blend into a single fat-covered mass; a level (or
  // slightly arched) top line 0.72-0.74 m, belly 0.30 m above the ground, half width ~0.18 m
  const wB = (1 + 0.05 * boar) * fat;
  // (a piglet's underline tucked up: side1 / research 2, a young gilt's chest 0.53 withers heights deep and its
  // belly 0.47 above the ground, against 0.58-0.60 and 0.38 on a finisher; the top line stays)
  const tuck = piglet ? 0.03 : 0;
  // (side2: the chest 0.58 withers heights deep behind the elbow, the belly 0.39 above the ground; the
  // barrel as wide in the middle as over the shoulders and hams from above, front2)
  m.ell({ tag: 'barrel', bone: 'spine2', c: [0, 0.525 + tuck / 2, -0.08], r: [0.186 * wB, 0.2 - tuck / 2, 0.5], k: 0 });
  // (the ribs and the fat over them: as wide over the middle as over the shoulder and thigh muscles, a finisher is
  // straight-sided from above; the barrel alone was 5-6 cm narrower a side than the hams there, which showed as a
  // saddle in the back when the pig lay on its side. Only over the middle: a wider barrel
  // also pushed the flank by the thigh out, and a dead pig's lower thigh into a slope)
  m.ell({ tag: 'ribs', bone: 'spine2', c: [0, 0.535 + tuck / 2, -0.055], r: [0.21 * wB, 0.15, 0.295], k: 0.07 });
  // (the chest floor behind the elbows level with the belly line: side2, chest depth ~0.58 withers heights)
  m.ell({ tag: 'shoulder', bone: 'spine3', c: [0, 0.535 + tuck / 2, 0.21], r: [0.166 * wB + 0.012 * boar, 0.178 + 0.01 * boar - tuck / 2, 0.2], k: 0.08 });
  m.ell({ tag: 'hamball', bone: 'pelvis', c: [0, 0.53 + tuck / 3, -0.43], r: [0.172 * wB * (0.94 + 0.06 * hamK), 0.195 - tuck / 3, 0.2 * (0.95 + 0.05 * hamK)], k: 0.08 });
  m.ell({ tag: 'back', bone: 'spine2', c: [0, 0.665, -0.08], r: [0.132 * wB, 0.07, 0.44], k: 0.1 });
  m.ell({ tag: 'rump', bone: 'pelvis', c: [0, 0.665, -0.4], r: [0.13 * wB, 0.07, 0.18], axis: norm([0, -0.1, 1]), k: 0.08 });
  // belly: a flat underline, sagging in older sows
  m.ell({ tag: 'belly', bone: 'spine2', c: [0, 0.398 - 0.04 * belly + tuck, -0.1], r: [0.148 * wB, 0.08 + 0.022 * belly, 0.33], k: 0.1 });
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.445 + tuck * 0.8, 0.3], r: [0.105, 0.095, 0.11], k: 0.06 });
  // hind end: the rounded buttocks over the hams; the tail is set on high between them
  m.ell({ tag: 'buttock', bone: 'pelvis', c: [0, 0.6, -0.54], r: [0.12 * wB, 0.11, 0.08], k: 0.08 });
  m.ell({ tag: 'tailroot', bone: 'pelvis', c: [0, 0.675, -0.575], r: [0.04, 0.035, 0.035], k: 0.05 });
  if (boar >= 0.5 && !piglet) {
    // testes: two large rounded bulges under the tail, between the hams
    for (const s of [1, -1]) m.ell({ tag: 'scrotum', bone: 'pelvis', c: [0.038 * s, 0.5, -0.585], r: [0.045, 0.06, 0.045], k: 0.04 });
    // sheath: the preputial pouch in front of the navel
    m.ell({ tag: 'sheath', bone: 'spine2', c: [0, 0.305, -0.02], r: [0.028, 0.03, 0.07], axis: norm([0, 0.25, 1]), k: 0.05 });
  }

  // ---------------------------------------------------------------- NECK (short, thick, hidden in the jowls)
  const nk = 1 + 0.25 * boar;
  m.ell({ tag: 'neck', bone: 'neck1', c: [0, 0.54, 0.38], r: [0.14 * nk * fat, 0.16, 0.13], axis: norm([0, 0.3, 1]), k: 0.1 });
  m.ell({ tag: 'neck', bone: 'neck2', c: [0, 0.56, 0.45], r: [0.12 * nk * fat, 0.13, 0.1], axis: norm([0, 0.4, 1]), k: 0.08 });
  // the top line runs almost straight from the withers to the poll (a crest / shield in boars)
  m.ell({ tag: 'nape', bone: 'neck1', c: [0, 0.655 + 0.012 * boar, 0.39], r: [0.1 * nk, 0.065 + 0.012 * boar, 0.14], axis: norm([0, -0.12, 1]), k: 0.09 });
  // throat / double chin: from under the jaw into the brisket
  m.cone({ tag: 'throat', bone: 'neck1', a: [0, 0.43, 0.36], b: [0, 0.46, 0.44], ra: 0.085 * fat, rb: 0.08, k: 0.09 });
  m.cone({ tag: 'throat', bone: 'neck2', a: [0, 0.46, 0.44], b: hl([0, -0.115, -0.03]), ra: 0.075, rb: 0.06, k: 0.08 });

  // ---------------------------------------------------------------- HEAD (head-local, see rig.js)
  // landmarks (face1 / side1): skull top y 0.085 at z -0.1, forehead 0.075 at z 0, a slightly dished
  // nasal bridge, the disc (centre y -0.012, z 0.19) 7 cm wide and 5.5 cm high, mouth corner below
  // the front of the eye, heavy jowls down to y -0.15 behind the jaw angle
  const hb = 1 + 0.08 * boar;
  hell({ tag: 'cranium', c: [0, 0.008, -0.06], r: [0.088 * hb, 0.064, 0.085], k: 0.05 });
  hell({ tag: 'poll', c: [0, 0.042, -0.08], r: [0.075 * hb, 0.04, 0.05], k: 0.04 });
  // (the boar's broader skull stays behind and below the eyes: a wider forehead and cheek would bury them)
  hell({ tag: 'forehead', c: [0, 0.036, 0.01], r: [0.074, 0.03, 0.08], k: 0.04 });
  // snout: a tapering cylinder from the face to the disc
  // (tapering a little more toward the disc, so the disc's rim stands a touch proud of the snout behind it: lw_show,
  // head_hausschwein5, side1)
  m.cone({ ...H, tag: 'snout', a: hl([0, -0.004, 0.05]), b: hl([0, -0.007, sz(0.16)]), ra: 0.057, rb: 0.05, k: 0.04 });
  hell({ tag: 'nasal', c: [0, 0.018, sz(0.1)], r: [0.05, 0.022, 0.07 * snoutK], k: 0.03 });
  // the dished profile (params.dish: Berkshire ~0.9, Large White ~0.35, Landrace 0 straight): the bridge sags in front
  // of the eyes between the forehead and the disc (side1, lw_show, bk_sow; an earlier sculpt ignored the knob and
  // every breed had the same straight, slightly Roman line)
  // (broad across the bridge, 0.11 half width: at 0.075 the carve's side walls ran from the inner eye corners
  // down to the snout as two ridges, a V that read as a frown from the front; face2, head_mochyn: a broad, flat bridge)
  if (dish > 0.01) hell({ tag: 'dish', c: [0, 0.089 - 0.02 * dish, sz(0.11)], r: [0.11, 0.04, 0.075 * snoutK], k: 0.03, carve: true });
  // the full face under and in front of the eyes (the maxilla under the cheek fat): no waist between the snout
  // and the jowls (face2, front1, threequarter2)
  hell({ tag: 'muzzle', c: [0, -0.03, 0.05], r: [0.064 * hb, 0.05, 0.09], k: 0.04 });
  for (const s of [1, -1]) {
    // jowls / cheeks: the big fat pads behind and below the eyes
    hell({ tag: 'jowl', c: [0.066 * s * hb, -0.075, -0.035], r: [0.06 * hb * fat, 0.08, 0.085], k: 0.05 });
    // cheek: the zygomatic arch and the masseter under their fat, behind and below the eye: the face's
    // outline beside the eyes (face2, front1, face3: the eyes set in from it by a third of their spacing)
    hell({ tag: 'cheek', c: [0.07 * s, -0.01, -0.05], r: [0.05 * fat, 0.055, 0.07], k: 0.03 });
    // upper lip along the side of the snout (the flews), rising to the disc; the mouth corner lies a
    // third of the way from the disc to the eye (face1, side1)
    m.cone({ ...H, tag: 'lip', a: hl([0.058 * s, -0.058, 0.045]), b: hl([0.042 * s, -0.042, sz(0.155)]), ra: 0.03, rb: 0.02, k: 0.03 });
    // heavy fat-padded brow over the small eye
    hell({ tag: 'brow', c: [0.058 * s, 0.05, 0.0], r: [0.022, 0.012, 0.03], k: 0.025 });
    // eye: orbit hollow, lids, almond aperture
    pigEye(m, s);
    // ear base muscles on the side of the poll
    // (a soft swelling, not a knob: a lying pig's lop ear swings off it)
    m.sphere({ ...H, tag: 'earbase', c: add(J['earBase' + (s > 0 ? 'L' : 'R')], [-0.014 * s, -0.006, 0]), rad: 0.02, k: 0.045 });
  }
  if (boar > 0) {
    // boar: the heavy cheeks and the ridge over the snout where the tusks' sockets bulge
    for (const s of [1, -1]) hell({ tag: 'jowl', c: [0.06 * s, -0.09, -0.06], r: [0.04 * boar, 0.05 * boar, 0.06], k: 0.05 });
    for (const s of [1, -1]) hell({ tag: 'lip', c: [0.036 * s, -0.04, sz(0.105)], r: [0.014, 0.018, 0.026], k: 0.025 });
  }
  // the soft floor between the mandibles: the chin's underside runs back into the throat (face1: a heavy rounded
  // chin tucked under the upper lip, no step behind it). The skin over the back half of the chin is the head's
  // surface, riding on the jaw (rig appendage 'jawskin') and blending into the throat, so it follows the mouth
  // as it opens; it meets the jaw part's underside almost tangentially a third of the way from the disc to the
  // eye, and only the chin's front and the lower lip are the jaw part (a jaw part exposed from the throat to
  // the lip read as a separate plate from below, outlined by the crease where it met the head)
  hell({ tag: 'underjaw', c: [0, -0.083, 0.0], r: [0.05, 0.028, 0.06], k: 0.04 });
  {
    // (a flat sheet under the chin: it ends 2.5 cm past the crossing at the mouth corner, sz(0.105), where it
    // runs into the chin's underside at a shallow angle; its top stays ~1.5 cm below the snout's underside and
    // its blend is tighter than the head's, so that in front of the corner it barely joins the upper lip: a
    // thicker sheet with a 4 cm blend fused with the snout there, and that skin from the upper lip to the jaw
    // stretched 3x when the mouth opened wide)
    const zx = sz(0.105), zc = 0.02, rz = zx + 0.025 - zc, u = (zx - zc) / rz, ry = 0.018;
    hell({ tag: 'underjaw', bone: 'jaw', group: 'jawskin', c: [0, -0.1045 + ry * Math.sqrt(1 - u * u), zc], r: [0.054, ry, rz], k: 0.03 });
  }
  // mouth line: the lower lip is tucked inside the upper lip (no slit: where the two surfaces overlap the coat
  // paints the mouth, which shows when the jaw drops; a carved slit's sharp lip margin meshed as a sawtooth)

  // snout disc (rostral plate on its own bone): a flat oval plate with a raised rim
  const dz = sz(0.178);
  // (the plate is cut close to its widest section: its flat face spans almost the whole snout end,
  // with a rounded rim standing a little proud of the snout behind it)
  m.ell({ ...SN, tag: 'disc', c: hl([0, -0.006, dz]), r: [0.058, 0.045, 0.026], axis: HZ, up: HY, k: 0.012 });
  m.cone({ ...SN, tag: 'snoutend', a: hl([0, -0.006, sz(0.13)]), b: hl([0, -0.006, dz - 0.008]), ra: 0.049, rb: 0.048, k: 0.02 });
  // flat face of the disc: a big carving sphere in front of it
  m.sphere({ ...SN, tag: 'discface', c: hl([0, -0.006, dz + 0.012 + 0.4]), rad: 0.4, k: 0.004, carve: true });
  for (const s of [1, -1]) {
    // nostrils: two large vertical ovals in the lower middle of the disc (each about a quarter of its
    // width), a septum between them (face2, front1, front2)
    // (smaller, flatter ovals tilted outer end down (front1, face2: two tilted ovals about a sixth
    // of the disc's width each, deepest at their inner upper end); the 2.6 x 3.6 cm round pits read as two black
    // buttons with a lit floor)
    const a = 0.4 * s, up = [-Math.sin(a), Math.cos(a) * HY[1], Math.cos(a) * HY[2]];
    m.ell({ ...SN, tag: 'nostril', c: hl([0.025 * s, -0.009, dz + 0.012]), r: [0.0135, 0.0088, 0.017], axis: HZ, up, k: 0.005, carve: true });
  }

  // ---------------------------------------------------------------- JAW (lower lip and chin: the mouth opens)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  // (the chin's front 1 cm further back and a little higher, and the lower lip tucked further under the upper lip:
  // from the side and below they read as a thin pale ledge under the snout)
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.077, sz(0.09)]), r: [0.04, 0.027, 0.064 * snoutK], axis: HZ, up: HY, k: 0 });
  m.ell({ ...JW, tag: 'lowerlip', c: hl([0, -0.067, sz(0.122)]), r: [0.026, 0.015, 0.02], axis: HZ, up: HY, k: 0.015 });
  // the tongue on the floor of the mouth, inside the closed mouth (shows when the jaw drops: squeal, bite)
  m.ell({ ...JW, tag: 'tongue', c: hl([0, -0.053, sz(0.085)]), r: [0.024, 0.011, 0.05 * snoutK], axis: HZ, up: HY, k: 0.012 });
  for (const s of [1, -1]) {
    m.cone({ ...JW, tag: 'mandible', a: hl([0.032 * s, -0.08, 0.02]), b: hl([0.026 * s, -0.076, sz(0.13)]), ra: 0.02, rb: 0.016, k: 0.02 });
  }
  if ((params.tusks || 0) > 0.05) {
    // tusks: the lower canines, ivory, riding rigidly on the jaw (coat paints them keratin): their own part and
    // surface, meshed at ~1 mm (tuskCones above, regions.js)
    for (const s of [1, -1]) for (const c of tuskCones(params, s)) m.cone({ bone: 'jaw', group: 'jaw', part: 'tusk', tag: 'tusk', ...c, k: 0 });
  }

  // ---------------------------------------------------------------- EARS (leaves)
  // Each pinna is a curved sheet tiled with exact slabs (m.fin), thick at the root and thinning to a round rim
  // (ears.js): an erect ear curls its tip forward, a semi-lop tips its outer half forward and down, a lop ear
  // rises from the poll and droops forward over the eyes like a hood. (Exact slab distances keep the ears'
  // skin weights off the neck. The leaf's base rolls into the funnel of the ear canal inside the head's
  // 'earbase' swelling; no root cone in the ear part: a lying pig's ear turns on its bone about the base,
  // and a cone reaching into the skull stood out of it as a peg.)
  for (const S of ['L', 'R']) {
    const E = earShape(J, params, S);
    const ear = { bone: 'ear' + S, group: 'ear' + S, part: 'ear' + S, tag: 'ear' };
    // (the thickness at the coarse tiers is the leaf's own business, ears.js: tiles are not marked thin)
    for (const g of E.segs) m.fin({ ...ear, o: g.o, u: g.u, v: g.v, poly: g.poly, t: g.t, round: g.t / 2, grad: g.grad, curve: g.curve, k: 0 });
  }

  // ---------------------------------------------------------------- LEGS (short, sunk in the body)
  // (a piglet's legs as thick for its size as a finisher's, a touch thicker: threequarter3, side1)
  const legK = (1 + 0.1 * boar) * (piglet ? 1.05 : 1);
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    // front
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], C = J['fcoffin' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.5), sx([0.055, 0, -0.01])), ydir: sub(Sh, Sc), lateral: lat, r: [0.06 + 0.02 * boar, 0.15, 0.11], k: 0.1, bias: 0.006 });
    m.sphere({ tag: 'shoulderpoint', bone: 'humerus' + S, group: g, c: add(Sh, sx([0.02, 0.0, 0.01])), rad: 0.06 * legK, k: 0.08 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.072 * legK, rb: 0.058 * legK, k: 0.08 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), sx([0.012, 0.0, -0.055])), ydir: sub(E, Sh), lateral: lat, r: [0.062 * legK, 0.1, 0.075], k: 0.08 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.015, -0.04]), rad: 0.035, k: 0.04 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: add(E, [0, 0, -0.005]), b: W, ra: 0.05 * legK, rb: 0.029 * legK, k: 0.04 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.25), sx([0.006, 0, 0.008])), ydir: sub(W, E), lateral: lat, r: [0.045 * legK, 0.075, 0.048 * legK], k: 0.04 });
    // (the web from the chest wall onto the forearm, 0.3 of its length: at 0.2 the raised upper foreleg of a pig
    // lying on its side pulled a long thin sheet of skin to the chest with folded back faces in its crease,
    // red back faces in the armpit 560 -> 278 px over three views; at 0.4, 946)
    m.cone({ tag: 'forearmweb', bone: 'radius' + S, group: g, a: add(E, sx([-0.03, 0.05, -0.01])), b: add(lerp(E, W, 0.3), sx([-0.012, 0, 0])), ra: 0.045, rb: 0.03, k: 0.05 });
    // knee (carpus), cannon, fetlock
    ellY({ tag: 'knee', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0.0, 0.002]), ydir: UP, lateral: lat, r: [0.03 * legK, 0.033, 0.029 * legK], k: 0.02 });
    m.cone({ tag: 'cannon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.012, 0.0]), b: add(M, [0, 0.01, -0.002]), ra: 0.024 * legK, rb: 0.022 * legK, k: 0.015 });
    ellY({ tag: 'fetlock', bone: 'metacarpus' + S, group: g, c: add(M, [0, 0.0, -0.006]), ydir: [0, 1, 0.3], lateral: lat, r: [0.026 * legK, 0.026, 0.028], k: 0.015 });
    sculptDigits(m, 'fpaw' + S, 'fhoof' + S, g, M, C, T, s, legK);

    // hind: the ham (the biggest muscle mass of the pig) sweeps down to the stifle and the hock
    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Ch = J['hcoffin' + S], Tt = J['htoe' + S];
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.45), sx([0.035, 0, -0.045])), ydir: sub(K, Hp), lateral: lat, r: [0.075 * hamK, 0.18, 0.15 * hamK], k: 0.1, bias: 0.006 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.13, 0.6, -0.3]), b: add(K, sx([0.0, 0.04, 0.03])), ra: 0.08, rb: 0.055, k: 0.08 });
    m.cone({ tag: 'ham', bone: 'femur' + S, group: h, a: sx([0.08, 0.6, -0.56]), b: add(lerp(K, Hk, 0.35), [0, 0, -0.045]), ra: 0.1 * hamK, rb: 0.048, k: 0.08 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.13, 0.4, -0.2]), ydir: [-0.1, 0.3, 0.12], lateral: lat, r: [0.04, 0.09, 0.06], k: 0.08 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.008, 0.01, 0.02])), rad: 0.045, k: 0.06 });
    ellY({ tag: 'gaskin', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.35), sx([0.004, 0, -0.03])), ydir: sub(Hk, K), lateral: lat, r: [0.048 * legK, 0.095, 0.06 * legK], k: 0.05 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: lerp(K, Hk, 0.1), b: Hk, ra: 0.042 * legK, rb: 0.029 * legK, k: 0.04 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.45), [0, 0, -0.045]), b: add(Hk, [0, 0.04, -0.04]), ra: 0.02, rb: 0.016, k: 0.025 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.04, -0.038]), rad: 0.021, k: 0.02 });
    ellY({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.006, -0.004]), ydir: [0, 1, 0.25], lateral: lat, r: [0.031 * legK, 0.042, 0.033], k: 0.02 });
    m.cone({ tag: 'cannon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.022, 0.003]), b: add(Mt, [0, 0.01, 0.0]), ra: 0.024 * legK, rb: 0.022 * legK, k: 0.015 });
    ellY({ tag: 'fetlock', bone: 'metatarsus' + S, group: h, c: add(Mt, [0, 0.0, -0.006]), ydir: [0, 1, 0.3], lateral: lat, r: [0.026 * legK, 0.026, 0.028], k: 0.015 });
    sculptDigits(m, 'hpaw' + S, 'hhoof' + S, h, Mt, Ch, Tt, s, legK * 0.98);
  }

  // ---------------------------------------------------------------- TEATS (two rows along the belly)
  const pairs = params.teats ?? 7;
  const teatK = boar >= 0.5 ? 0.45 : piglet ? 0.5 : 0.8 + 0.6 * belly;
  for (let i = 0; i < pairs; i++) {
    const z = lerp([0, 0, 0.2], [0, 0, -0.34], i / Math.max(1, pairs - 1))[2];
    const yb = 0.3 - 0.03 * belly + 0.008 * Math.abs(z + 0.08) * 4 * 0.3 + tuck;
    const x = 0.052 + 0.01 * Math.cos(((i / (pairs - 1)) - 0.5) * 2);
    for (const s of [1, -1]) {
      const a = [x * s, yb + 0.02, z], b = [x * s * 1.02, yb - 0.012 * teatK, z];
      m.cone({ tag: 'teat', bone: z > 0.05 ? 'spine3' : z < -0.2 ? 'spine1' : 'spine2', a, b, ra: 0.0085 * Math.max(0.6, teatK), rb: 0.006 * Math.max(0.6, teatK), k: 0.008 });
    }
  }

  // ---------------------------------------------------------------- TAIL (thin, corkscrew, a small tuft)
  const n = TAIL_SEGS;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const r = (t) => 0.0115 - 0.0065 * Math.pow(t, 0.8);
    m.cone({ tag: i >= n - 1 ? 'tailtip' : 'tail', part: 'tail', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: r(t0), rb: r(t1), k: i === 0 ? 0.03 : 0.004, thin: i > n / 2 });
  }
  return m;
}

// Cloven hoof: pastern with two dew claws behind the fetlock, then two claws (digits III and IV),
// each a hoof-wall half-cone, flat on the ground (carved at y = 0), the interdigital cleft between
// them, heel bulbs behind. Pigs walk on the tips of the claws with fairly upright pasterns.
function sculptDigits(m, paw, hoof, group, M, C, T, s, w) {
  m.cone({ tag: 'pastern', bone: paw, group, a: M, b: C, ra: 0.022 * w, rb: 0.024 * w, k: 0.012 });
  // dew claws (digits II and V): small pointed claws behind, 3-5 cm above the ground
  for (const d of [1, -1]) {
    const base = add(M, [0.017 * d * w, -0.012, -0.022]);
    m.cone({ tag: 'dewclaw', bone: paw, group, a: base, b: add(base, [0.004 * d, -0.016, -0.012]), ra: 0.0075 * w, rb: 0.004 * w, k: 0.006 });
  }
  const zMid = (C[2] + T[2]) * 0.5;
  const dir = Math.sign(T[2] - C[2]);
  for (const d of [1, -1]) {
    const off = 0.0145 * d * w;
    const top = add(C, [off, 0.012, -0.008 * dir]);
    const base = [C[0] + off * 1.1, 0.0, zMid - 0.003 * dir];
    m.cone({ tag: 'hoof', bone: hoof, group, a: top, b: base, ra: 0.0145 * w, rb: 0.02 * w, k: 0.007 });
    // the toe: a pointed front of each claw
    m.ell({ tag: 'hoof', bone: hoof, group, c: [C[0] + off * 0.9, 0.013, T[2] - 0.016 * dir], r: [0.0135 * w, 0.0125, 0.02], axis: norm([0, -0.3, dir]), k: 0.007 });
    m.sphere({ tag: 'heelbulb', bone: hoof, group, c: add(C, [off * 0.9, -0.015, -0.024 * dir]), rad: 0.0145 * w, k: 0.011 });
  }
  m.cone({ tag: 'coronet', bone: hoof, group, a: add(C, [0, 0.014, -0.011 * dir]), b: add(C, [0, 0.007, 0.011 * dir]), ra: 0.024 * w, rb: 0.024 * w, k: 0.009 });
  // interdigital cleft: a V opening toward the front and the ground
  m.ell({ tag: 'cleft', bone: hoof, group, c: [C[0], 0.0, T[2] - 0.002 * dir], r: [0.003, 0.026, 0.043], k: 0.0025, carve: true });
  m.ell({ tag: 'cleft', bone: hoof, group, c: [C[0], -0.003, zMid], r: [0.0025, 0.017, 0.046], k: 0.002, carve: true });
  m.ell({ tag: 'sole', bone: hoof, group, c: [C[0], -0.2 + 0.0015, zMid], r: [0.2, 0.2, 0.2], k: 0.003, carve: true });
}
