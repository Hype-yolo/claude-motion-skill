// The cow, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw). The head
// is modelled in its own frame (rig.js: hl()), measured from the profile and frontal references; the
// body relative to the joints so the sculpt follows the skeleton.
//
// Individual knobs (params, see index.js): dairy (0 beef .. 1 dairy: angular frame, prominent hooks
// and pins, visible ribs, big udder), bull (0 cow .. 1 bull: crest over the neck and shoulders, deep
// forehead, sheath and scrotum instead of an udder), udder (size), dewlap, horns ({ style, len, r }),
// polled peak, ear tags, nose ring, shaggy (Highland coat volume).
import { HEAD_O, HZ, HY, hl, TAIL_SEGS, BONE_SEGS } from './rig.js';
import { add, sub, mul, lerp, norm, cross, rng } from '../../core/math/vec.js';
import { sculptEyeSocket, apertureTiltAlong } from '../../core/sdf/eyeSocket.js';

// Eye (head-local centre -> offset from HEAD_O). Globe ~34 mm axial, visible opening ~35 x 22 mm,
// set at the edge of the broad flat forehead and bulging out of the head's outline in front view.
const EYE_LOCAL = [0.111, 0.004, 0.0];
const eyeDir = (() => {
  // lateral, 18 degrees forward along the nasal line, a little up
  const a = (18 * Math.PI) / 180;
  return norm(add(add([Math.cos(a), 0, 0], mul(HZ, Math.sin(a))), mul(HY, 0.12)));
})();
const EYE_BASE = {
  c: sub(hl(EYE_LOCAL), HEAD_O), r: 0.02, back: 0.004, yaw: Math.atan2(eyeDir[0], eyeDir[2]), pitch: Math.asin(eyeDir[1]),
  lid: 0.0024, R: 0.0215, d: 0.0094, off: -0.0008, tilt: 0, irisZ: 0.011, irisR: 0.0146,
};
// the almond's roll: in the relaxed carriage (nasal line 50 deg below horizontal) the slit is about
// level, the inner corner a little lower (side1_holstein.jpg, head raised to ~30 deg: the slit rises
// ~20 deg toward the nose); i.e. 0.85 rad up from the nasal line, the upper lid up
EYE_BASE.tilt = apertureTiltAlong(EYE_BASE, HEAD_O, HZ) - 0.85;
export const EYE = EYE_BASE;

const X = [1, 0, 0];
const UP = [0, 1, 0];
const FWD = [0, 0, 1];

// horn base on the poll (head-local) and the horn's centre line (world, bind), per side
export function hornPath(params, s) {
  const H = params.horns;
  if (!H) return null;
  const base = hl([0.082 * s, 0.035, -0.158]);
  const out = [s, 0, 0];
  // the second direction the horn curls toward: lyre (cow: up and forward), 'down' (Hereford:
  // forward and down), 'bull' (short, forward), 'wide' (Highland: out, then up)
  const tw = {
    lyre: norm([0, 0.8, 0.55]), down: norm([0, -0.55, 0.85]), bull: norm([0, 0.35, 0.95]), wide: norm([0, 0.95, 0.3]),
  }[H.style] || norm([0, 0.8, 0.55]);
  const a0 = (H.a0 ?? 12) * Math.PI / 180, a1 = (H.a1 ?? 95) * Math.PI / 180;
  const n = 7, pts = [], rads = [];
  let p = add(base, mul(out, -0.03)); // rooted inside the skull
  pts.push(p); rads.push(H.r * 1.05);
  for (let i = 1; i <= n; i++) {
    const t = (i - 0.5) / n;
    const a = a0 + (a1 - a0) * Math.pow(t, H.curlPow ?? 1.3);
    const d = norm(add(mul(out, Math.cos(a)), mul(tw, Math.sin(a))));
    const seg = (H.len + 0.03) / n;
    p = add(p, mul(d, seg));
    pts.push(p);
    const u = i / n;
    rads.push(Math.max(0.004, H.r * (1 - 0.86 * Math.pow(u, 1.25))));
  }
  return { pts, rads, base };
}

export function sculptCow(m, rig, params = {}) {
  const J = rig.J;
  const calf = params.age === 'juvenile';
  const dairy = params.dairy ?? 1;
  const bull = params.bull ?? 0;
  const beef = 1 - dairy;
  const R = rng(5113 + (params.coatSeed || 0));

  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };
  // ellipsoid in head-local coordinates: r = [lateral, dorsal, along the head]
  const H = { bone: 'head' };
  const hdir = (v) => [v[0], v[1] * HY[1] + v[2] * HZ[1], v[1] * HY[2] + v[2] * HZ[2]];
  const hell = (o) => m.ell({ ...H, ...o, c: hl(o.c), axis: o.axisL ? norm(hdir(o.axisL)) : HZ, up: o.upL ? norm(hdir(o.upL)) : HY });

  // ---------------------------------------------------------------- TORSO
  // the barrel: deep (chest depth ~0.8 m, belly ~0.63 m above the ground), wide (0.62 m), deepest
  // behind the ribs; the dairy wedge: the body gets deeper and wider toward the rear
  const wB = 1 + 0.06 * beef + 0.04 * bull;
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 1.04, 0.12], r: [0.3 * wB, 0.4, 0.56], axis: norm([0, 0.04, 1]), k: 0 });
  m.ell({ tag: 'girth', bone: 'chest', c: [0, 1.02, 0.44], r: [0.25 * wB, 0.33, 0.24], k: 0.1 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 1.0, -0.22], r: [0.33 * wB, 0.37, 0.36], axis: norm([0, 0.1, -1]), k: 0.12 });
  m.ell({ tag: 'belly', bone: 'spine2', c: [0, 0.84, -0.08], r: [0.27 * wB, 0.2, 0.42], k: 0.16 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 1.17, -0.45], r: [0.28 * wB, 0.24, 0.24], k: 0.12 });
  // withers: the dorsal spines of T2-T6 between the scapulae, sharper in dairy cows
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 1.36, 0.4], r: [0.085 + 0.03 * beef, 0.1, 0.24], axis: norm([0, -0.12, 1]), k: 0.1 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 1.35, 0.04], r: [0.17 + 0.05 * beef, 0.08, 0.42], k: 0.12 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 1.38, -0.28], r: [0.21 + 0.04 * beef, 0.07, 0.24], k: 0.12 });
  // hindquarters: the rump runs level from the hooks (tuber coxae) to the pins (tuber ischii); the
  // tail head sits between the pins
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 1.25, -0.68], r: [0.25 * wB, 0.2, 0.28], k: 0.1 });
  m.ell({ tag: 'rump', bone: 'pelvis', c: [0, 1.38, -0.67], r: [0.2 + 0.05 * beef, 0.08, 0.28], axis: norm([0, -0.06, 1]), k: 0.1 });
  for (const s of [1, -1]) {
    m.sphere({ tag: 'hook', bone: 'pelvis', c: [0.27 * s, 1.37 + 0.012 * dairy, -0.46], rad: 0.055, k: 0.07 + 0.04 * beef });
    m.sphere({ tag: 'pin', bone: 'pelvis', c: [0.095 * s, 1.34, -0.915], rad: 0.05, k: 0.07 + 0.03 * beef });
    // quarters: the muscle between hook, pin and stifle (full and round in beef breeds)
    m.ell({ tag: 'quarter', bone: 'pelvis', c: [0.14 * s, 1.2, -0.78], r: [0.13 + 0.03 * beef, 0.2, 0.14 + 0.02 * beef], k: 0.1 });
  }
  m.ell({ tag: 'tailhead', bone: 'pelvis', c: [0, 1.39, -0.86], r: [0.06, 0.055, 0.08], k: 0.06 });
  // chest front: the brisket (sternum and its fat pad) between and in front of the forelegs
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.83, 0.6], r: [0.17 * wB, 0.17, 0.17], k: 0.1 });
  for (const s of [1, -1]) {
    m.ell({ tag: 'pectoral', bone: 'chest', c: [0.1 * s, 0.86, 0.7], r: [0.1, 0.15, 0.1], k: 0.08 });
  }
  if (!calf && bull < 0.5 && (params.udder ?? 1) > 0.05) sculptUdder(m, params.udder ?? 1);
  if (bull >= 0.5) {
    // sheath (prepuce) under the belly, scrotum between the hind legs
    m.ell({ tag: 'sheath', bone: 'spine2', c: [0, 0.66, -0.05], r: [0.045, 0.06, 0.14], axis: norm([0, 0.35, 1]), k: 0.06 });
    m.ell({ tag: 'sheath', bone: 'spine2', c: [0, 0.6, 0.08], r: [0.03, 0.04, 0.05], k: 0.04 });
    if (!calf) m.ell({ tag: 'scrotum', bone: 'pelvis', c: [0, 0.66, -0.66], r: [0.075, 0.13, 0.08], axis: norm([0, 0.1, 1]), k: 0.05 });
  }

  // ---------------------------------------------------------------- NECK
  // thin and long in dairy cows, short and thick in beef breeds, massive with a crest in bulls
  const nb = J.neckBase, nm = J.neckMid, occ = J.occiput;
  const nd1 = norm(sub(nm, nb)), nd2 = norm(sub(occ, nm));
  const nk = 1 + 0.1 * beef + 0.45 * bull;
  m.ell({ tag: 'neck', bone: 'neck1', c: [0, 1.16 + 0.03 * bull, 0.64], r: [0.2 * nk, 0.27 * (1 + 0.15 * bull), 0.24], axis: nd1, up: [0, 1, -0.3], k: 0.12 });
  m.ell({ tag: 'neck', bone: 'neck1', c: [0, 1.25, 0.84], r: [0.14 * nk, 0.21 * (1 + 0.1 * bull), 0.2], axis: nd1, up: [0, 1, -0.3], k: 0.1 });
  m.ell({ tag: 'neck', bone: 'neck2', c: [0, 1.31, 1.0], r: [0.11 * (1 + 0.15 * bull), 0.16, 0.14], axis: nd2, up: [0, 1, -0.2], k: 0.09 });
  // top of the neck from the withers to the poll; the bull's crest rises over the shoulders
  m.ell({ tag: 'crest', bone: 'neck1', c: [0, 1.37 + 0.07 * bull, 0.72], r: [0.08 + 0.12 * bull, 0.07 + 0.11 * bull, 0.3 + 0.04 * bull], axis: norm([0, 0.02, 1]), k: 0.1 + 0.04 * bull });
  m.ell({ tag: 'crest', bone: 'neck2', c: [0, 1.41 + 0.02 * bull, 0.98], r: [0.06 + 0.04 * bull, 0.05 + 0.03 * bull, 0.14], axis: FWD, k: 0.08 });
  if (bull > 0) m.ell({ tag: 'crest', bone: 'chest', c: [0, 1.37 + 0.03 * bull, 0.5], r: [0.2 * bull + 0.02, 0.13 * bull + 0.01, 0.28], k: 0.14 });
  // underline: trachea, then the dewlap, a hanging fold of skin from the throat to the brisket
  m.cone({ tag: 'throat', bone: 'neck1', a: [0, 1.02, 0.76], b: [0, 1.16, 0.98], ra: 0.09, rb: 0.075, k: 0.1 });
  m.cone({ tag: 'throat', bone: 'neck2', a: [0, 1.15, 0.98], b: hl([0, -0.16, -0.06]), ra: 0.07, rb: 0.06, k: 0.08 });
  const dw = params.dewlap ?? 0.5;
  if (dw > 0.02) {
    const a = [0, 0.99, 0.95], b = [0, 0.76, 0.66], mid = lerp(a, b, 0.55);
    const dd = norm(sub(b, a));
    m.ell({ tag: 'dewlap', bone: 'neck1', c: add(mid, [0, -0.04 * dw, 0.02 * dw]), r: [0.035 + 0.015 * dw, 0.07 + 0.08 * dw, 0.2], axis: dd, up: norm([0, 1, 0.9]), k: 0.07 });
  }

  // ---------------------------------------------------------------- HEAD (head-local, see rig.js)
  // landmarks (head_profile of face.jpg / side photos): poll ridge top y 0.06 at z -0.16, flat
  // forehead y 0.075 at z 0, nasal bridge 0.055 at 0.18, muzzle top 0.03 at 0.33, nose tip z 0.39,
  // chin y -0.14 at 0.3, jaw angle y -0.2 at z -0.03, eyes (+-0.098, 0.004, 0)
  const hb = 1 + 0.08 * bull; // broader, deeper bull head
  hell({ tag: 'poll', c: [0, 0.015, -0.14], r: [0.095 * hb, 0.055, 0.055], k: 0.05 });
  hell({ tag: 'cranium', c: [0, 0.0, -0.06], r: [0.1 * hb, 0.075, 0.11], k: 0.05 });
  hell({ tag: 'forehead', c: [0, 0.035, 0.0], r: [0.104 * hb, 0.04, 0.12], k: 0.04 });
  hell({ tag: 'face', c: [0, 0.01, 0.2], r: [0.08 * hb, 0.045, 0.19], k: 0.05 });
  hell({ tag: 'lowerface', c: [0, -0.07, 0.18], r: [0.078 * hb, 0.08, 0.17], k: 0.05 });
  hell({ tag: 'muzzle', c: [0, -0.04, 0.33], r: [0.086 * hb, 0.066, 0.064], k: 0.05 });
  hell({ tag: 'upperlip', c: [0, -0.1, 0.345], r: [0.068 * hb, 0.032, 0.046], k: 0.03 });
  if (params.polledPeak) hell({ tag: 'polltop', c: [0, 0.05, -0.15], r: [0.04, 0.035 + 0.01 * params.polledPeak, 0.04], k: 0.04 });
  if (bull > 0) hell({ tag: 'forehead', c: [0, 0.045, -0.06], r: [0.09, 0.03 * bull + 0.01, 0.1], k: 0.05 }); // curly bull forehead mat
  if (params.dished) hell({ tag: 'face', c: [0, 0.035, 0.1], r: [0.05, 0.02, 0.05], k: 0.03, carve: true });
  for (const s of [1, -1]) {
    // masseter: the big flat cheek; the mandible's lower border from the jaw angle to the chin
    hell({ tag: 'cheek', c: [0.06 * s * hb, -0.105, -0.0], r: [0.048, 0.1, 0.11], k: 0.05 });
    m.cone({ ...H, tag: 'mandible', a: hl([0.052 * s, -0.19, -0.04]), b: hl([0.036 * s, -0.135, 0.27]), ra: 0.036, rb: 0.024, k: 0.05 });
    // bony eye arch (the orbit rim stands out of the forehead's outline) and the temporal fossa
    hell({ tag: 'brow', c: [0.1 * s, 0.03, -0.006], r: [0.03, 0.022, 0.04], k: 0.03 });
    hell({ tag: 'nostrilwing', c: [0.055 * s, -0.03, 0.35], r: [0.03, 0.035, 0.038], k: 0.03 });
    // eye: orbit hollow, lids, almond aperture
    sculptEyeSocket(m, EYE, HEAD_O, s, { orbit: { r: [0.022, 0.016, 0.012], at: [0.0, 0.002, 0.022], k: 0.01 } });
    // nostrils: comma-shaped openings on the front corners of the moist muzzle plate
    hell({ tag: 'nostril', c: [0.043 * s, -0.035, 0.392], r: [0.011, 0.022, 0.02], axisL: [-0.35 * s, 0.1, 1], upL: [0.35 * s, 1, 0], k: 0.006, carve: true });
    // ear base muscles on the side of the poll
    m.sphere({ ...H, tag: 'earbase', c: add(J['earBase' + (s > 0 ? 'L' : 'R')], [-0.012 * s, 0, 0]), rad: 0.032, k: 0.03 });
  }
  // philtrum groove down the middle of the muzzle plate
  hell({ tag: 'philtrum', c: [0, -0.07, 0.405], r: [0.004, 0.03, 0.012], k: 0.006, carve: true });
  // mouth line: a shallow slit under the upper lip (the jaw part fills it)
  hell({ tag: 'mouthcut', c: [0, -0.13, 0.31], r: [0.06, 0.012, 0.07], k: 0.008, carve: true });

  // ---------------------------------------------------------------- JAW (lower lip and chin: the mouth opens, chews sideways)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.138, 0.3]), r: [0.05, 0.038, 0.06], axis: HZ, up: HY, k: 0 });
  m.ell({ ...JW, tag: 'lowerlip', c: hl([0, -0.125, 0.345]), r: [0.056, 0.026, 0.035], axis: HZ, up: HY, k: 0.02 });
  for (const s of [1, -1]) {
    m.cone({ ...JW, tag: 'mandible', a: hl([0.036 * s, -0.14, 0.2]), b: hl([0.03 * s, -0.135, 0.3]), ra: 0.022, rb: 0.028, k: 0.03 });
  }
  // tongue: its own rigid surface in the mouth (see regions.js); it wraps grass and licks the nose
  const TG = { bone: 'tongue', group: 'jaw', part: 'tongue' };
  m.cone({ ...TG, tag: 'tongue', a: J.tongueBase, b: J.tongueTip, ra: 0.03, rb: 0.024, k: 0.02 });
  m.ell({ ...TG, tag: 'tongue', c: lerp(J.tongueBase, J.tongueTip, 0.7), r: [0.036, 0.016, 0.07], axis: norm(sub(J.tongueTip, J.tongueBase)), up: HY, k: 0.02 });

  // ---------------------------------------------------------------- EARS (broad leaves, carried sideways)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const along = norm(sub(tip, base));
    // the pinna opens forward and a little down
    const facing = norm([0, -0.25, 1]);
    const lat = norm(cross(along, facing));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    const eK = calf ? 1.1 : 1;
    ellY({ ...ear, tag: 'ear', c: lerp(base, tip, 0.5), ydir: along, lateral: lat, r: [0.056 * eK, 0.108 * eK, 0.018], k: 0.02 });
    ellY({ ...ear, tag: 'ear', c: lerp(base, tip, 0.15), ydir: along, lateral: lat, r: [0.03, 0.05, 0.026], k: 0.02 });
    ellY({ ...ear, tag: 'earinner', c: add(lerp(base, tip, 0.55), mul(facing, 0.016)), ydir: along, lateral: lat, r: [0.042 * eK, 0.09 * eK, 0.013], k: 0.006, carve: true });
  }

  // ---------------------------------------------------------------- LEGS
  const legK = 1 + 0.08 * beef + 0.1 * bull; // bone and muscle thickness
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    // front
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], C = J['fcoffin' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.45), sx([0.06, 0, -0.02])), ydir: sub(Sh, Sc), lateral: lat, r: [0.08 + 0.03 * bull, 0.25, 0.15], k: 0.12, bias: 0.006 });
    m.sphere({ tag: 'shoulderpoint', bone: 'humerus' + S, group: g, c: add(Sh, sx([0.015, 0.0, 0.03])), rad: 0.075 * legK, k: 0.09 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.1 * legK, rb: 0.085 * legK, k: 0.09 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), sx([0.01, 0.02, -0.09])), ydir: sub(E, Sh), lateral: lat, r: [0.1 * legK, 0.17, 0.12], k: 0.09 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.02, -0.07]), rad: 0.055, k: 0.05 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: add(E, [0, 0, -0.01]), b: W, ra: 0.08 * legK, rb: 0.048 * legK, k: 0.05 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.25), sx([0.008, 0, 0.012])), ydir: sub(W, E), lateral: lat, r: [0.074 * legK, 0.14, 0.08 * legK], k: 0.05 });
    m.cone({ tag: 'forearmweb', bone: 'radius' + S, group: g, a: add(E, sx([-0.04, 0.06, -0.02])), b: add(lerp(E, W, 0.3), sx([-0.02, 0, 0])), ra: 0.06, rb: 0.045, k: 0.06 });
    // knee (carpus): broad, the accessory carpal bone behind
    ellY({ tag: 'knee', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0.0, 0.004]), ydir: UP, lateral: lat, r: [0.053 * legK, 0.058, 0.048 * legK], k: 0.025 });
    m.sphere({ tag: 'accessory', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0.03, -0.042]), rad: 0.024, k: 0.02 });
    // cannon (fused metacarpals III+IV): short, broad, flat in front
    m.cone({ tag: 'cannon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.02, 0.0]), b: add(M, [0, 0.02, 0.0]), ra: 0.036 * legK, rb: 0.034 * legK, k: 0.02 });
    m.cone({ tag: 'tendon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.03, -0.028]), b: add(M, [0, 0.03, -0.03]), ra: 0.022 * legK, rb: 0.026 * legK, k: 0.02 });
    ellY({ tag: 'fetlock', bone: 'metacarpus' + S, group: g, c: add(M, [0, 0.0, -0.01]), ydir: [0, 1, 0.3], lateral: lat, r: [0.048 * legK, 0.048, 0.05], k: 0.02 });
    sculptDigits(m, 'fpaw' + S, 'fhoof' + S, g, M, C, T, s, 1.0 * legK);

    // hind
    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Ch = J['hcoffin' + S], Tt = J['htoe' + S];
    // thigh: flat and lean in dairy cows (the "incurving thigh"), full and round in beef breeds
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.42), sx([0.02 + 0.02 * beef, 0, -0.05])), ydir: sub(K, Hp), lateral: lat, r: [0.08 + 0.04 * beef, 0.3, 0.2 + 0.03 * beef], k: 0.1, bias: 0.006 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.22, 1.25, -0.46]), b: add(K, sx([0.0, 0.06, 0.04])), ra: 0.11, rb: 0.07, k: 0.1 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.11, 1.26, -0.84]), b: add(lerp(K, Hk, 0.3), [0, 0, -0.08]), ra: 0.1 + 0.02 * beef, rb: 0.06, k: 0.08 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.22, 0.92, -0.3]), ydir: [-0.1, 0.3, 0.12], lateral: lat, r: [0.05, 0.15, 0.08], k: 0.1 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.01, 0.01, 0.03])), rad: 0.06, k: 0.07 });
    ellY({ tag: 'gaskin', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.32), sx([0.006, 0, -0.045])), ydir: sub(Hk, K), lateral: lat, r: [0.072 * legK, 0.16, 0.09 * legK], k: 0.06 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: lerp(K, Hk, 0.1), b: Hk, ra: 0.06 * legK, rb: 0.046 * legK, k: 0.05 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.45), [0, 0, -0.075]), b: add(Hk, [0, 0.07, -0.07]), ra: 0.03, rb: 0.024, k: 0.03 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.07, -0.066]), rad: 0.034, k: 0.025 });
    ellY({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.01, -0.005]), ydir: [0, 1, 0.25], lateral: lat, r: [0.052 * legK, 0.075, 0.055], k: 0.03 });
    m.cone({ tag: 'cannon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.04, 0.005]), b: add(Mt, [0, 0.02, 0.0]), ra: 0.036 * legK, rb: 0.033 * legK, k: 0.02 });
    m.cone({ tag: 'tendon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.04, -0.034]), b: add(Mt, [0, 0.03, -0.032]), ra: 0.022 * legK, rb: 0.026 * legK, k: 0.02 });
    ellY({ tag: 'fetlock', bone: 'metatarsus' + S, group: h, c: add(Mt, [0, 0.0, -0.01]), ydir: [0, 1, 0.3], lateral: lat, r: [0.047 * legK, 0.048, 0.05], k: 0.02 });
    sculptDigits(m, 'hpaw' + S, 'hhoof' + S, h, Mt, Ch, Tt, s, 0.97 * legK);
  }

  // ---------------------------------------------------------------- TAIL: tail head, bony tail, switch
  const tailK = calf ? 0.9 : 1;
  for (let i = 0; i < BONE_SEGS; i++) {
    const t0 = i / BONE_SEGS, t1 = (i + 1) / BONE_SEGS;
    const r = (t) => (0.05 - 0.032 * Math.pow(t, 0.7)) * tailK;
    m.cone({ tag: 'tail', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: r(t0), rb: r(t1), k: i === 0 ? 0.06 : 0.01 });
  }
  // switch: a long tassel of hair from the end of the bony tail
  const sw = (params.switchLen ?? 1) * (calf ? 0.4 : 1);
  const b10 = J['tail' + BONE_SEGS], b11 = J['tail' + (BONE_SEGS + 1)], b12 = J['tail' + TAIL_SEGS];
  const sw1 = lerp(b10, b11, Math.min(1, sw)), sw2 = lerp(b11, b12, Math.max(0, Math.min(1, sw * 1.0)));
  m.cone({ tag: 'switch', bone: 'tail' + (BONE_SEGS - 1), a: lerp(J['tail' + (BONE_SEGS - 1)], b10, 0.3), b: b10, ra: 0.022, rb: 0.04, k: 0.015 });
  m.cone({ tag: 'switch', bone: 'tail' + BONE_SEGS, a: b10, b: sw1, ra: 0.042, rb: 0.048 * Math.max(0.6, sw), k: 0.015 });
  if (sw > 0.5) m.cone({ tag: 'switch', bone: 'tail' + (BONE_SEGS + 1), a: sw1, b: sw2, ra: 0.048, rb: 0.012, k: 0.015 });

  // ---------------------------------------------------------------- HORNS (own rigid surface on the head)
  if (params.horns) {
    for (const s of [1, -1]) {
      const hp = hornPath(params, s);
      for (let i = 0; i < hp.pts.length - 1; i++) {
        m.cone({ bone: 'head', group: 'axial', part: 'horn', tag: 'horn', a: hp.pts[i], b: hp.pts[i + 1], ra: hp.rads[i], rb: hp.rads[i + 1], k: 0.01 });
      }
      // horn base boss on the poll (skin)
      m.sphere({ ...H, tag: 'hornbase', c: add(hp.base, [0.006 * s, 0, 0]), rad: params.horns.r * 1.05, k: 0.03 });
    }
  }

  // ---------------------------------------------------------------- EAR TAGS, NOSE RING (own rigid surfaces)
  if (params.earTags) {
    for (const S of ['L', 'R']) {
      const s = S === 'L' ? 1 : -1;
      const base = J['earBase' + S], tip = J['earTip' + S];
      const q = add(lerp(base, tip, 0.42), [0, -0.01, 0.02]);
      m.cone({ bone: 'ear' + S, group: 'ear' + S, part: 'tag' + S, tag: 'eartag', a: add(q, [0, 0.012, 0]), b: add(q, [0, 0.012, 0.012]), ra: 0.007, rb: 0.007, k: 0.002 });
      m.ell({ bone: 'ear' + S, group: 'ear' + S, part: 'tag' + S, tag: 'eartag', c: add(q, [0, -0.028, 0.017]), r: [0.028, 0.034, 0.0028], axis: norm([0, 0.1, 1]), k: 0.004 });
    }
  }
  if (params.noseRing) {
    const c = hl([0, -0.078, 0.402]), rr = 0.03, n = 14;
    const pt = (i) => { const a = (i / n) * Math.PI * 2; return add(c, add(mul(HY, Math.cos(a) * rr), mul(HZ, Math.sin(a) * rr * 0.85))); };
    for (let i = 0; i < n; i++) m.cone({ bone: 'head', part: 'ring', tag: 'ring', a: pt(i), b: pt(i + 1), ra: 0.0042, rb: 0.0042, k: 0.001 });
  }
  void R;
  return m;
}

// Udder: four quarters under the pelvis between the thighs, rear attachment high up between the
// thighs, fore udder blending forward into the belly, four teats.
function sculptUdder(m, k) {
  const U = { bone: 'spine1', tag: 'udder' };
  const sz = 0.75 + 0.35 * k;
  m.ell({ ...U, c: [0, 0.73 + 0.04 * (1 - k), -0.55], r: [0.15 * sz, 0.15 * sz, 0.22 * sz], k: 0.06 });
  m.ell({ ...U, bone: 'pelvis', c: [0, 0.92, -0.74], r: [0.12 * sz, 0.2, 0.1], k: 0.08 });
  m.ell({ ...U, c: [0, 0.76, -0.36], r: [0.13 * sz, 0.1 * sz, 0.18 * sz], k: 0.1 });
  const bottom = 0.73 + 0.04 * (1 - k) - 0.15 * sz;
  for (const s of [1, -1]) {
    // quarters bulge a little on each side (the median suspensory ligament makes a groove)
    m.ell({ ...U, c: [0.075 * s, bottom + 0.1, -0.62], r: [0.085 * sz, 0.1 * sz, 0.12 * sz], k: 0.05 });
    m.ell({ ...U, c: [0.07 * s, bottom + 0.1, -0.45], r: [0.075 * sz, 0.09 * sz, 0.1 * sz], k: 0.05 });
    for (const z of [-0.64, -0.44]) {
      m.cone({ tag: 'teat', bone: 'spine1', c: undefined, a: [0.06 * s, bottom + 0.03, z], b: [0.062 * s, bottom - 0.05, z + 0.005], ra: 0.017, rb: 0.013, k: 0.02 });
    }
  }
}

// Cloven hoof: pastern with two dew claws behind the fetlock, then two claws (digits III and IV),
// each a hoof-wall half-cone with its front wall parallel to the pastern, heel bulbs behind, flat on
// the ground (carved at y = 0); the interdigital cleft is carved between them.
function sculptDigits(m, paw, hoof, group, M, C, T, s, w) {
  m.cone({ tag: 'pastern', bone: paw, group, a: M, b: C, ra: 0.038 * w, rb: 0.04 * w, k: 0.02 });
  // dew claws: two small horny nubs behind and above the fetlock... (cattle: just above the heels)
  for (const d of [1, -1]) {
    m.ell({ tag: 'dewclaw', bone: paw, group, c: add(M, [0.022 * d, -0.035, -0.05]), r: [0.013, 0.017, 0.016], axis: norm([0, -0.5, -1]), k: 0.012 });
  }
  const zMid = (C[2] + T[2]) * 0.5;
  const dir = Math.sign(T[2] - C[2]);
  for (const d of [1, -1]) {
    const off = 0.026 * d * w;
    const top = add(C, [off, 0.018, -0.012 * dir]);
    const base = [C[0] + off * 1.1, 0.0, zMid - 0.004 * dir];
    m.cone({ tag: 'hoof', bone: hoof, group, a: top, b: base, ra: 0.026 * w, rb: 0.036 * w, k: 0.012 });
    // the toe: a pointed front of each claw
    m.ell({ tag: 'hoof', bone: hoof, group, c: [C[0] + off * 0.9, 0.022, T[2] - 0.028 * dir], r: [0.024 * w, 0.022, 0.034], axis: norm([0, -0.25, dir]), k: 0.012 });
    m.sphere({ tag: 'heelbulb', bone: hoof, group, c: add(C, [off * 0.9, -0.026, -0.042 * dir]), rad: 0.026 * w, k: 0.02 });
  }
  m.cone({ tag: 'coronet', bone: hoof, group, a: add(C, [0, 0.024, -0.02 * dir]), b: add(C, [0, 0.012, 0.02 * dir]), ra: 0.043 * w, rb: 0.043 * w, k: 0.015 });
  // interdigital cleft: a V opening toward the front and the ground
  m.ell({ tag: 'cleft', bone: hoof, group, c: [C[0], 0.0, T[2] - 0.004 * dir], r: [0.005, 0.045, 0.075], k: 0.004, carve: true });
  m.ell({ tag: 'cleft', bone: hoof, group, c: [C[0], -0.005, zMid], r: [0.004, 0.03, 0.08], k: 0.003, carve: true });
  m.ell({ tag: 'sole', bone: hoof, group, c: [C[0], -0.2 + 0.002, zMid], r: [0.2, 0.2, 0.2], k: 0.004, carve: true });
}
