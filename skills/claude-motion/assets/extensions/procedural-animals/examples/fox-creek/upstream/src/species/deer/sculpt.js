// The white-tailed deer, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw).
// The head is modelled in its own frame (rig.js: hl()), measured from the profile and face
// references; the body relative to the joints so the sculpt follows the skeleton. Antlers are rigid
// bone-coloured geometry on the head bone, meshed as their own region ('antler' part).
import { HEAD_O, HZ, HY, hl, hdir, TAIL_SEGS, bz } from './rig.js';
import { add, sub, mul, lerp, norm, cross, rng } from '../../core/math/vec.js';
import { eyeFrameOf, sculptEyeSocket } from '../../core/sdf/eyeSocket.js';

// Eye (head-local centre -> offset from HEAD_O): globe ~27 mm, palpebral opening ~30 x 18 mm, set
// high on the side of the skull, looking out and a little forward.
const EYE_LOCAL = [0.05, 0.006, 0.0];
const eyeDir = (() => {
  const a = (18 * Math.PI) / 180;
  return norm(add([Math.cos(a), 0, 0], mul(HZ, Math.sin(a))));
})();
const EYE_BASE = {
  c: sub(hl(EYE_LOCAL), HEAD_O), r: 0.015, back: 0.003, yaw: Math.atan2(eyeDir[0], eyeDir[2]), pitch: Math.asin(eyeDir[1]),
  lid: 0.0017, R: 0.019, d: 0.009, off: -0.0006, tilt: 0, irisZ: 0.0082, irisR: 0.0116,
};
// roll the almond so its long axis follows the nasal line (inner corner toward the nose, lower)
EYE_BASE.tilt = (() => {
  let best = 0, bd = -2;
  for (let t = -1.6; t <= 1.6; t += 0.005) {
    const f = eyeFrameOf({ ...EYE_BASE, tilt: t }, HEAD_O, 1);
    const d = f.x[0] * HZ[0] + f.x[1] * HZ[1] + f.x[2] * HZ[2];
    if (d > bd) { bd = d; best = t; }
  }
  return best - 0.18;
})();
export const EYE = EYE_BASE;

const X = [1, 0, 0];

export function sculptDeer(m, rig, params = {}) {
  const J = rig.J;
  const fawn = params.age === 'juvenile';
  const neckK = params.neck ?? 0; // 0 doe .. 1 buck in rut (swollen neck)

  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };
  const H = { bone: 'head' };
  const hell = (o) => m.ell({ ...H, ...o, c: hl(o.c), axis: o.axisL ? norm(hdir(o.axisL)) : HZ, up: o.upL ? norm(hdir(o.upL)) : HY });

  // ---------------------------------------------------------------- TORSO
  // slim barrel, deep narrow chest (sternum ~0.47 m), belly tucked up toward the flank; a long loin
  // and flank (rig.js: bz), a straight back and a smooth flank with the shoulder and hip only hinted
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 0.665, 0.055], r: [0.155, 0.195, 0.345], axis: norm([0, 0.05, 1]), k: 0 });
  m.ell({ tag: 'girth', bone: 'chest', c: [0, 0.64, 0.26], r: [0.13, 0.165, 0.13], k: 0.05 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.67, -0.19], r: [0.16, 0.165, 0.25], axis: norm([0, 0.14, -1]), k: 0.06 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 0.73, bz(-0.29)], r: [0.14, 0.125, 0.16], k: 0.07 });
  // withers: the dorsal spines make a low ridge between the scapulae
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.86, 0.24], r: [0.035, 0.055, 0.14], axis: norm([0, -0.2, 1]), k: 0.08 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 0.845, -0.02], r: [0.085, 0.045, 0.27], k: 0.07 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 0.855, -0.25], r: [0.095, 0.045, 0.2], k: 0.07 });
  // hindquarters: croup (a little higher than the withers), points of hip, buttocks
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 0.8, bz(-0.41)], r: [0.138, 0.12, 0.15], k: 0.05 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 0.855, bz(-0.4)], r: [0.095, 0.05, 0.16], axis: norm([0, -0.1, 1]), k: 0.06 });
  for (const s of [1, -1]) {
    m.sphere({ tag: 'hippoint', bone: 'pelvis', c: [0.105 * s, 0.835, bz(-0.29)], rad: 0.025, k: 0.07 });
    m.ell({ tag: 'rump', bone: 'pelvis', c: [0.065 * s, 0.77, bz(-0.5)], r: [0.07, 0.11, 0.07], k: 0.05 });
  }
  // chest front: narrow breast between the forelegs (no pouter-pigeon bulge in front of them)
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.575, 0.31], r: [0.075, 0.085, 0.08], k: 0.05 });
  for (const s of [1, -1]) m.ell({ tag: 'pectoral', bone: 'chest', c: [0.048 * s, 0.585, 0.365], r: [0.04, 0.06, 0.035], k: 0.045 });

  // ---------------------------------------------------------------- NECK
  // slender and laterally flattened in does, swollen in rutting bucks
  const nb = J.neckBase, nm = J.neckMid, occ = J.occiput;
  const nd1 = norm(sub(nm, nb)), nd2 = norm(sub(occ, nm));
  const nk = 1 + 0.3 * neckK;
  const up1 = [0, 0.6, -1];
  m.ell({ tag: 'neck', bone: 'neck1', c: add(lerp(nb, nm, 0.15), [0, 0.012, -0.012]), r: [0.07 * nk, 0.1 * nk, 0.1], axis: nd1, up: up1, k: 0.06 });
  m.ell({ tag: 'neck', bone: 'neck1', c: add(lerp(nb, nm, 0.65), [0, -0.01, 0.005]), r: [0.05 * nk, 0.085 * nk, 0.1], axis: nd1, up: up1, k: 0.05 });
  m.ell({ tag: 'neck', bone: 'neck2', c: add(lerp(nm, occ, 0.5), [0, -0.02, 0.01]), r: [0.043 * (1 + 0.2 * neckK), 0.066 * (1 + 0.2 * neckK), 0.075], axis: nd2, up: up1, k: 0.045 });
  m.ell({ tag: 'crest', bone: 'neck1', c: add(lerp(nb, nm, 0.55), [0, 0.03 + 0.01 * neckK, -0.04]), r: [0.03 + 0.02 * neckK, 0.03 + 0.015 * neckK, 0.12], axis: nd1, k: 0.05 });
  // underline of the neck (trachea) from the breast to the throat latch
  const thr = hl([0, -0.068, -0.045]);
  m.cone({ tag: 'throat', bone: 'neck1', a: [0, 0.67, 0.36], b: add(lerp([0, 0.67, 0.36], thr, 0.55), [0, 0, 0.0]), ra: 0.04 * nk, rb: 0.04 * nk, k: 0.05 });
  m.cone({ tag: 'throat', bone: 'neck2', a: lerp([0, 0.67, 0.36], thr, 0.5), b: thr, ra: 0.04 * nk, rb: 0.032, k: 0.045 });

  // ---------------------------------------------------------------- HEAD (head-local, see rig.js)
  // landmarks (doe, poll -> nose 0.28 m): forehead y 0.035 at z 0, nasal bridge 0.022 at 0.12,
  // nose top 0.012 at 0.17, nose tip z 0.195; jaw angle y -0.075 at z -0.045, chin y -0.05 at 0.16;
  // eyes (+-0.047, 0.006, 0); skull 0.105 wide across the orbits, muzzle 0.045
  hell({ tag: 'cranium', c: [0, 0.0, -0.035], r: [0.049, 0.04, 0.062], k: 0.03 });
  hell({ tag: 'poll', c: [0, -0.005, -0.07], r: [0.036, 0.038, 0.035], k: 0.03 });
  hell({ tag: 'forehead', c: [0, 0.014, 0.02], r: [0.046, 0.022, 0.058], k: 0.025 });
  hell({ tag: 'face', c: [0, 0.006, 0.1], r: [0.031, 0.021, 0.09], k: 0.025 });
  hell({ tag: 'lowerface', c: [0, -0.024, 0.085], r: [0.034, 0.037, 0.085], k: 0.03 });
  hell({ tag: 'muzzle', c: [0, -0.014, 0.16], r: [0.027, 0.027, 0.032], k: 0.02 });
  hell({ tag: 'nose', c: [0, -0.006, 0.182], r: [0.024, 0.021, 0.015], k: 0.012 });
  hell({ tag: 'upperlip', c: [0, -0.034, 0.17], r: [0.018, 0.012, 0.022], k: 0.012 });
  for (const s of [1, -1]) {
    // masseter (cheek) and the mandible's lower border from the jaw angle to the chin
    hell({ tag: 'cheek', c: [0.031 * s, -0.04, -0.01], r: [0.024, 0.036, 0.05], k: 0.025 });
    m.cone({ ...H, tag: 'mandible', a: hl([0.027 * s, -0.068, -0.045]), b: hl([0.017 * s, -0.052, 0.12]), ra: 0.014, rb: 0.01, k: 0.02 });
    hell({ tag: 'brow', c: [0.043 * s, 0.022, -0.002], r: [0.014, 0.01, 0.022], k: 0.015 });
    hell({ tag: 'nostrilwing', c: [0.019 * s, -0.012, 0.18], r: [0.011, 0.015, 0.016], k: 0.01 });
    sculptEyeSocket(m, EYE, HEAD_O, s, { orbit: { r: [0.017, 0.012, 0.01], at: [0.0, 0.001, 0.016], k: 0.007 } });
    // preorbital (lacrimal) gland: a dark slit in front of the inner corner
    hell({ tag: 'preorbital', c: [0.045 * s, -0.004, 0.034], r: [0.004, 0.0035, 0.011], axisL: [-0.35 * s, -0.15, 1], k: 0.004, carve: true });
    // nostrils: comma-shaped, opening forward and out
    hell({ tag: 'nostril', c: [0.014 * s, -0.01, 0.194], r: [0.0045, 0.009, 0.007], axisL: [0.3 * s, -0.2, 1], upL: [0.5 * s, 1, 0], k: 0.003, carve: true });
  }

  // ---------------------------------------------------------------- JAW (lower lip and chin)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.051, 0.15]), r: [0.02, 0.014, 0.028], axis: HZ, up: HY, k: 0 });
  m.ell({ ...JW, tag: 'lowerlip', c: hl([0, -0.043, 0.172]), r: [0.019, 0.01, 0.018], axis: HZ, up: HY, k: 0.01 });
  for (const s of [1, -1]) m.cone({ ...JW, tag: 'mandible', a: hl([0.014 * s, -0.051, 0.115]), b: hl([0.01 * s, -0.047, 0.158]), ra: 0.009, rb: 0.011, k: 0.012 });

  // ---------------------------------------------------------------- EARS (large, broad, cupped)
  const earK = fawn ? 1.0 : 1.0; // (fawn ears are big by the head scale warp)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const up = norm(sub(tip, base));
    const facing = norm(add(mul(hdir([0, 0.3, 1]), 0.8), [0.5 * s, 0, 0])); // cup opens forward and out
    const lat = norm(cross(up, facing));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    ellY({ ...ear, tag: 'ear', c: lerp(base, tip, 0.45), ydir: up, lateral: lat, r: [0.045 * earK, 0.074, 0.011], k: 0.012 });
    ellY({ ...ear, tag: 'eartip', c: lerp(base, tip, 0.8), ydir: up, lateral: lat, r: [0.028, 0.035, 0.008], k: 0.012 });
    ellY({ ...ear, tag: 'earinner', c: add(lerp(base, tip, 0.5), mul(facing, 0.009)), ydir: up, lateral: lat, r: [0.036, 0.068, 0.008], k: 0.004, carve: true });
    m.sphere({ ...H, tag: 'earbase', c: add(base, mul(up, -0.006)), rad: 0.017, k: 0.02 });
  }

  // ---------------------------------------------------------------- LEGS (very slender)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    // front
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], C = J['fcoffin' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.45), sx([0.032, 0, -0.01])), ydir: sub(Sh, Sc), lateral: lat, r: [0.04, 0.14, 0.08], k: 0.08, bias: 0.002 });
    m.sphere({ tag: 'shoulderpoint', bone: 'humerus' + S, group: g, c: add(Sh, sx([0.008, 0.0, 0.0])), rad: 0.032, k: 0.05 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: add(Sh, [0, 0, -0.01]), b: E, ra: 0.043, rb: 0.042, k: 0.05 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), sx([0.005, 0.01, -0.05])), ydir: sub(E, Sh), lateral: lat, r: [0.05, 0.09, 0.06], k: 0.05 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.012, -0.038]), rad: 0.027, k: 0.03 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: add(E, [0, 0, -0.005]), b: W, ra: 0.04, rb: 0.02, k: 0.03 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.22), sx([0.004, 0, 0.006])), ydir: sub(W, E), lateral: lat, r: [0.04, 0.094, 0.044], k: 0.03 });
    m.cone({ tag: 'forearmweb', bone: 'radius' + S, group: g, a: add(E, sx([-0.02, 0.035, -0.01])), b: add(lerp(E, W, 0.3), sx([-0.01, 0, 0])), ra: 0.03, rb: 0.022, k: 0.035 });
    // knee (carpus), cannon (flat bone in front, tendons behind), fetlock, dew claws, pastern, hoof
    ellY({ tag: 'knee', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0.0, 0.002]), ydir: [0, 1, 0], lateral: lat, r: [0.021, 0.028, 0.02], k: 0.012 });
    m.sphere({ tag: 'accessory', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0.014, -0.017]), rad: 0.011, k: 0.01 });
    m.cone({ tag: 'cannon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.01, 0.0]), b: add(M, [0, 0.01, 0.0]), ra: 0.0135, rb: 0.012, k: 0.01 });
    m.cone({ tag: 'tendon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.015, -0.012]), b: add(M, [0, 0.015, -0.013]), ra: 0.009, rb: 0.01, k: 0.01 });
    ellY({ tag: 'fetlock', bone: 'metacarpus' + S, group: g, c: add(M, [0, 0.0, -0.004]), ydir: [0, 1, 0.3], lateral: lat, r: [0.016, 0.02, 0.019], k: 0.01 });
    sculptDigit(m, 'fpaw' + S, 'fhoof' + S, g, M, C, T, 1.0);
    // hind
    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Ch = J['hcoffin' + S], Tt = J['htoe' + S];
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.42), sx([0.02, 0, -0.03])), ydir: sub(K, Hp), lateral: lat, r: [0.055, 0.17, 0.11], k: 0.06, bias: 0.004 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.1, 0.8, bz(-0.28)]), b: add(K, sx([0.0, 0.03, 0.02])), ra: 0.06, rb: 0.038, k: 0.06 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.06, 0.79, bz(-0.53)]), b: add(lerp(K, Hk, 0.3), [0, 0, -0.045]), ra: 0.06, rb: 0.032, k: 0.05 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.1, 0.6, bz(-0.23)]), ydir: [-0.1, 0.3, 0.12], lateral: lat, r: [0.03, 0.08, 0.045], k: 0.06 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.005, 0.005, 0.016])), rad: 0.032, k: 0.04 });
    ellY({ tag: 'gaskin', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.004, 0, -0.022])), ydir: sub(Hk, K), lateral: lat, r: [0.04, 0.094, 0.05], k: 0.035 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: lerp(K, Hk, 0.1), b: Hk, ra: 0.03, rb: 0.018, k: 0.03 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.45), [0, 0, -0.04]), b: add(Hk, [0, 0.035, -0.032]), ra: 0.014, rb: 0.011, k: 0.018 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.035, -0.031]), rad: 0.015, k: 0.014 });
    ellY({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.005, -0.004]), ydir: [0, 1, 0.2], lateral: lat, r: [0.02, 0.034, 0.024], k: 0.014 });
    m.cone({ tag: 'cannon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.02, 0.002]), b: add(Mt, [0, 0.01, 0.0]), ra: 0.0145, rb: 0.012, k: 0.01 });
    m.cone({ tag: 'tendon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.02, -0.014]), b: add(Mt, [0, 0.015, -0.013]), ra: 0.009, rb: 0.01, k: 0.01 });
    ellY({ tag: 'fetlock', bone: 'metatarsus' + S, group: h, c: add(Mt, [0, 0.0, -0.004]), ydir: [0, 1, 0.3], lateral: lat, r: [0.016, 0.02, 0.019], k: 0.01 });
    sculptDigit(m, 'hpaw' + S, 'hhoof' + S, h, Mt, Ch, Tt, 0.95);
  }

  // ---------------------------------------------------------------- TAIL: broad, flat, hairy
  for (let i = 0; i < TAIL_SEGS; i++) {
    const a = J['tail' + i], b = J['tail' + (i + 1)];
    const t0 = i / TAIL_SEGS;
    const d = norm(sub(b, a));
    const w = 0.03 + 0.018 * Math.sin(Math.PI * Math.min(1, 0.25 + t0 * 0.95)); // broadest in the middle
    ellY({ tag: 'tail', bone: 'tail' + i, c: lerp(a, b, 0.5), ydir: d, lateral: X, r: [w, 0.034, 0.016 - 0.004 * t0], k: i === 0 ? 0.04 : 0.012, thin: true });
  }
  m.cone({ tag: 'tailroot', bone: 'tail0', a: J.tail0, b: J.tail2, ra: 0.03, rb: 0.022, k: 0.04 });

  if (params.antlers) sculptAntlers(m, params.antlers);
  return m;
}

// Pastern, dew claws and a small cloven hoof: two pointed claws with a cleft between them, the sole
// flat on the ground (carved at y = 0).
function sculptDigit(m, paw, hoof, group, M, C, T, w) {
  m.cone({ tag: 'pastern', bone: paw, group, a: M, b: C, ra: 0.013 * w, rb: 0.014 * w, k: 0.008 });
  // dew claws: two small horny points behind the fetlock
  for (const s of [1, -1]) m.cone({ tag: 'dewclaw', bone: paw, group, a: add(M, [0.009 * s, -0.012, -0.012]), b: add(M, [0.011 * s, -0.03, -0.022]), ra: 0.0055, rb: 0.003, k: 0.004 });
  const dir = norm(sub(T, C));
  const heel = add(C, [0, -0.012, -0.012]);
  for (const s of [1, -1]) {
    // each claw: a round cone from the heel bulb to the pointed toe
    m.cone({ tag: 'hoof', bone: hoof, group, a: add(heel, [0.0085 * s * w, 0.004, 0]), b: add(T, [0.006 * s * w, 0.002, -0.004]), ra: 0.0135 * w, rb: 0.005 * w, k: 0.006 });
  }
  m.cone({ tag: 'coronet', bone: hoof, group, a: add(C, [0, 0.008, -0.006]), b: add(C, mul(dir, 0.01)), ra: 0.016 * w, rb: 0.015 * w, k: 0.008 });
  m.sphere({ tag: 'heelbulb', bone: hoof, group, c: add(C, [0, -0.012, -0.018]), rad: 0.012 * w, k: 0.008 });
  // cleft between the claws, and the flat sole
  m.ell({ tag: 'cleft', bone: hoof, group, c: add(lerp(C, T, 0.75), [0, -0.006, 0]), r: [0.0012, 0.02, 0.035], axis: dir, k: 0.002, carve: true });
  m.ell({ tag: 'sole', bone: hoof, group, c: [C[0], -0.2 + 0.0015, (C[2] + T[2]) * 0.5], r: [0.2, 0.2, 0.2], k: 0.002, carve: true });
}

// ------------------------------------------------------------------------------------------------
// Antlers. A = params.antlers: { burr: [x, y, z] head-local, beam (m), spread (0..1), rise, curl,
// tines: [[t along the beam, length, lean], ...] per side, spike: bool, seed }. The main beam leaves
// the burr up, out and back, then sweeps forward and in; the tines rise near-vertically from its top
// (not forked as in mule deer). Geometry is in the bind-pose world frame relative to the burr.
export function antlerCurves(A) {
  const sides = [];
  for (const s of [1, -1]) {
    const Rr = rng((A.seed || 1) * 31 + (s > 0 ? 7 : 13));
    const jit = () => 1 + (Rr() - 0.5) * 0.12; // left / right asymmetry
    const burr = hl([A.burr[0] * s, A.burr[1], A.burr[2]]);
    const L = A.beam * jit();
    let pts;
    if (A.spike) {
      // yearling spike: a near-straight point, up and a little out and back
      pts = [[0, 0, 0], [0.12 * s, 0.5, -0.12], [0.2 * s, 0.97, -0.08]].map((p) => mul(p, L));
    } else {
      // main beam in fractions of its length: [out, up, forward]
      const sp = A.spread * jit(), ri = A.rise, cu = A.curl;
      pts = [
        [0, 0, 0],
        [0.13 * sp * s, 0.24 * ri, -0.12],
        [0.38 * sp * s, 0.33 * ri, -0.08],
        [0.54 * sp * s, 0.37 * ri, 0.08 * cu],
        [0.5 * sp * s, 0.4 * ri, 0.28 * cu],
        [0.32 * sp * s, 0.43 * ri, 0.44 * cu],
      ].map((p) => mul(p, L));
    }
    pts = pts.map((p) => add(burr, p));
    // Catmull-Rom resampling
    const beam = catmull(pts, A.spike ? 8 : 16);
    const tines = [];
    if (!A.spike) {
      for (const [t, len, lean] of A.tines) {
        const b = sampleAt(beam, t);
        const tangent = norm(sub(sampleAt(beam, Math.min(1, t + 0.03)), sampleAt(beam, Math.max(0, t - 0.03))));
        // up, a little outward from the beam's curve and forward at the tip
        const out = norm(cross(tangent, [0, 1, 0]));
        const flip = out[0] * s < 0 ? -1 : 1;
        const l = len * jit();
        const p1 = add(b, [0, 0.5 * l, 0]);
        const p2 = add(add(b, [0, 0.95 * l, 0]), mul(out, flip * lean * l * 0.25));
        const p3 = add(p2, [0, 0.05 * l, 0.12 * l]);
        tines.push({ pts: catmull([b, p1, p2, p3], 6), t });
      }
    }
    sides.push({ s, burr, beam, tines });
  }
  return sides;
}

function catmull(P, n) {
  const out = [];
  const seg = P.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * seg, k = Math.min(seg - 1, Math.floor(u)), t = u - k;
    const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(seg, k + 2)];
    const t2 = t * t, t3 = t2 * t;
    out.push([0, 1, 2].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
  }
  return out;
}
function sampleAt(pts, t) {
  const u = Math.max(0, Math.min(1, t)) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(u));
  return lerp(pts[k], pts[k + 1], u - k);
}

function sculptAntlers(m, A) {
  const AN = { bone: 'head', group: 'axial', part: 'antler' };
  const r0 = A.base; // beam radius at the burr
  for (const side of antlerCurves(A)) {
    const { beam, tines, burr } = side;
    // burr (coronet): a rough ring at the base, pedicle into the skull
    const d0 = norm(sub(beam[1], beam[0]));
    m.cone({ ...AN, tag: 'burr', a: add(burr, mul(d0, -0.012)), b: add(burr, mul(d0, 0.004)), ra: r0 * 1.12, rb: r0 * 1.1, k: 0.004 });
    const n = beam.length - 1;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const rad = (t) => r0 * (1 - 0.55 * Math.pow(t, 1.3)) * (A.spike ? 1 - 0.55 * t : 1);
      m.cone({ ...AN, tag: 'beam', a: beam[i], b: beam[i + 1], ra: rad(t0), rb: Math.max(0.0025, rad(t1) * (i === n - 1 ? 0.45 : 1)), k: 0.004 });
    }
    for (const tn of tines) {
      const P = tn.pts, k = P.length - 1;
      const rb = r0 * (0.75 - 0.4 * tn.t);
      for (let i = 0; i < k; i++) {
        const u0 = i / k, u1 = (i + 1) / k;
        m.cone({ ...AN, tag: 'tine', a: P[i], b: P[i + 1], ra: Math.max(0.0025, rb * (1 - 0.8 * u0)), rb: Math.max(0.0022, rb * (1 - 0.8 * u1)), k: i === 0 ? 0.008 : 0.003 });
      }
    }
  }
}
