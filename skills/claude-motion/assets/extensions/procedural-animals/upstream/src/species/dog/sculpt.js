// The domestic dog, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw / tongue).
// The torso is placed relative to the axial joints so the variants' toplines (the shepherd's slope,
// the level retriever and terrier) carry the body with them. The head is modelled in head-local
// coordinates (HEAD_O) and shaped per individual by params: stop, skull width, muzzle length and
// depth, flews (the retriever's pendulous upper lips), cheek fur; ears by type (prick, drop,
// button); tail by type (the shepherd's bushy saber, the retriever's thick otter tail, the
// terrier's short erect tail).
import { HEAD_O, TAIL_SEGS, HS, hlOf } from './rig.js';
import { add, sub, mul, lerp, norm, cross } from '../../core/math/vec.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';

// Eye geometry shared by the sculpt (lids + aperture) and the eyeball shader (head-local, left eye).
// Axial eyeball ~21.5 mm (r 10.8 mm) for a 30 kg dog (Miller & Murphy 1995); almond fissure
// ~20 x 10 mm set a little obliquely (shepherd); rounder and more forward-facing in retrievers and
// terriers (params.eyeRound); eyes ~62 mm apart. Small dogs and pups have relatively larger eyes
// (params.eyeK).
export const EYE_BASE = { c: [0.033, 0.022, 0.038], r: 0.0108, back: 0.0023, yaw: 0.2, pitch: 0.04, lid: 0.0014, R: 0.0131, d: 0.0081, off: -0.0006, tilt: (12 * Math.PI) / 180, irisZ: 0.0066, irisR: 0.0089 };
export const eyeOf = (params = {}) => {
  const k = params.eyeK || 1, rd = params.eyeRound || 0;
  const R = EYE_BASE.R * k, d = EYE_BASE.d * k * (1 - 0.3 * rd);
  return {
    ...EYE_BASE,
    c: [EYE_BASE.c[0] * (params.headW || 1) * HS, (EYE_BASE.c[1] + 0.002 * (k - 1)) * HS, EYE_BASE.c[2] * HS],
    r: EYE_BASE.r * k, back: EYE_BASE.back * k, lid: EYE_BASE.lid * k, R, d, irisZ: EYE_BASE.irisZ * k, irisR: EYE_BASE.irisR * k,
    yaw: EYE_BASE.yaw - 0.05 * rd, tilt: EYE_BASE.tilt * (1 - 0.6 * rd),
  };
};

const X = [1, 0, 0];

export function sculptDog(m, rig, params = {}) {
  const J = rig.J;
  const EYE = eyeOf(params);
  const mz = params.muzzle || 1, hw = params.headW || 1, juv = params.juv || 0;
  const stop = params.stop ?? 0.5, flews = params.flews || 0, mzD = params.muzzleDepth || 1;
  const ruff = params.ruff ?? 0.5, neckK = params.neckK || 1, chestK = params.chestK || 1;
  const hl = hlOf(mz, hw);
  // short muzzles (pups, terrier) shorten the muzzle pads with the muzzle, so they never swallow the nose
  const mzS = Math.min(1, mz);
  const hr = (r) => [r[0] * hw * HS, r[1] * HS, r[2] * HS];
  const eyeFrame = (s) => eyeFrameOf(EYE, HEAD_O, s);
  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };
  const cm = J.chestMid, tr = J.thoraxRear, lm = J.lumbarMid, ls = J.lumbosacral, nb = J.neckBase, nm = J.neckMid;
  const P = (x, y, z) => [x, y, z];

  // ---------------------------------------------------------------- TORSO
  // deep chest reaching the elbow, prominent forechest, firm back, belly tucked up behind the ribs
  const ribY = (cm[1] + tr[1]) / 2;
  m.ell({ tag: 'ribcage', bone: 'spine3', c: P(0, ribY - 0.077, lerp(cm, tr, 0.4)[2]), r: [0.077 * chestK, 0.128 * chestK, 0.165], axis: norm([0, 0.1, -1]), k: 0 });
  m.ell({ tag: 'brisket', bone: 'chest', c: P(0, cm[1] - 0.148, cm[2] + 0.07), r: [0.048 * chestK, 0.062, 0.085], axis: norm([0, -0.35, 1]), k: 0.05 });
  m.ell({ tag: 'pectoral', bone: 'chest', c: P(0, nb[1] - 0.095, nb[2] + 0.008), r: [0.056 * chestK, 0.066, 0.052], k: 0.045 });
  m.ell({ tag: 'withers', bone: 'chest', c: P(0, J.scapTopL[1] + 0.012, J.scapTopL[2] - 0.045), r: [0.044, 0.046, 0.105], axis: norm([0, -0.1, 1]), k: 0.05 });
  m.ell({ tag: 'back', bone: 'spine3', c: P(0, tr[1] + 0.036, tr[2] + 0.01), r: [0.055, 0.042, 0.13], k: 0.05 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: P(0, lm[1] - 0.048 + 0.012 * (params.tuck || 0), lm[2] + 0.035), r: [0.06 * chestK, 0.06 - 0.008 * (params.tuck || 0), 0.13], axis: norm([0, 0.34 * Math.max(0, params.tuck ?? 1), -1]), k: 0.055 });
  const lo = lerp(lm, ls, 0.4);
  m.ell({ tag: 'loin', bone: 'spine1', c: P(0, lo[1] + 0.022, lo[2]), r: [0.05, 0.041, 0.115], k: 0.045 });
  m.ell({ tag: 'flank', bone: 'spine1', c: P(0, ls[1] - 0.05 - 0.01 * Math.max(0, -(params.tuck || 0)), ls[2] + 0.02), r: [0.053 * chestK, 0.053 + 0.012 * Math.max(0, -(params.tuck || 0)), 0.075], k: 0.045 });
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: P(0, ls[1] - 0.02, ls[2] - 0.058), r: [0.058, 0.07, 0.09], k: 0.05 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: P(0, ls[1] + 0.02, ls[2] - 0.048), r: [0.046, 0.034, 0.085], axis: norm([0, (J.tailBase[1] - ls[1]) * 3, -0.25]), k: 0.035 });
  for (const s of [1, -1]) {
    m.ell({ tag: 'rump', bone: 'pelvis', c: P(0.035 * s, ls[1] - 0.052, ls[2] - 0.118), r: [0.036, 0.058, 0.042], k: 0.035 });
  }
  // shepherd: the thicker coat over the shoulders and neck (sculpted coat volume)
  if (ruff > 0.3) m.ell({ tag: 'cape', bone: 'chest', c: P(0, J.scapTopL[1] + 0.005, J.scapTopL[2] + 0.04), r: [0.06 * (0.7 + 0.3 * ruff), 0.055, 0.1], axis: norm([0, 0.25, 1]), k: 0.06 });

  // ---------------------------------------------------------------- NECK
  const occ = J.occiput;
  const nTop = lerp(nm, occ, 0.55);
  m.cone({ tag: 'neck', bone: 'neck1', a: P(0, nb[1] - 0.02, nb[2] - 0.03), b: nm, ra: 0.072 * neckK, rb: 0.058 * neckK, k: 0.05 });
  m.cone({ tag: 'neck', bone: 'neck2', a: nm, b: P(0, nTop[1], nTop[2]), ra: 0.056 * neckK, rb: 0.049 * neckK, k: 0.04 });
  // crest: the top line runs in one convex arc from the occiput to the withers
  const cr = lerp(nm, occ, 0.3);
  m.ell({ tag: 'nape', bone: 'neck1', c: P(0, cr[1] + 0.046, cr[2] - 0.025), r: [0.042 * neckK, 0.034, 0.1], axis: norm([0, 0.55, 1]), k: 0.045 });
  // throat: a straight line from under the jaw to the forechest (no dewlap)
  const hl0 = hlOf(mz, hw);
  m.cone({ tag: 'throat', bone: 'neck1', a: hl0([0, -0.05, -0.03]), b: P(0, nb[1] - 0.085, nb[2] + 0.035), ra: 0.034 * neckK, rb: 0.05 * neckK, k: 0.05 });
  // ruff (shepherd): the longer hair of the neck sides
  const rf = 0.7 + 0.3 * ruff;
  if (ruff > 0.3) m.ell({ tag: 'ruff', bone: 'neck1', c: P(0, nm[1] - 0.03, nm[2] - 0.035), r: [0.058 * rf * neckK, 0.052 * rf, 0.07], axis: norm([0, 0.6, 1]), k: 0.05 });

  // ---------------------------------------------------------------- HEAD (head-local coords, see HEAD_O)
  // landmarks (adult ~0.25 m occiput -> nose): nose tip (0, -0.014, 0.158), eyes (+-0.033, 0.022, 0.038),
  // stop ~z 0.045 (deeper with params.stop), chin (0, -0.062, 0.125), skull top 0.064, occiput -0.095
  const H = { bone: 'head' };
  const dome = 0.004 * juv + 0.003 * (params.dome || 0);
  m.ell({ ...H, tag: 'cranium', c: hl([0, 0.016 + dome, -0.034]), r: hr([0.05 + 0.004 * juv, 0.048 + 0.008 * juv + 0.003 * (params.dome || 0), 0.064]), k: 0.035 });
  m.ell({ ...H, tag: 'forehead', c: hl([0, 0.027 + 0.011 * stop + dome, 0.008 + 0.008 * stop]), r: hr([0.034, 0.03, 0.042]), axis: norm([0, -0.35 + 0.35 * stop, 1]), k: 0.026 });
  m.ell({ ...H, tag: 'crest', c: hl([0, 0.05, -0.055]), r: hr([0.016, 0.013, 0.048]), k: 0.03 });
  for (const s of [1, -1]) {
    m.ell({ ...H, tag: 'brow', c: hl([0.028 * s, 0.037 + 0.006 * stop, 0.034]), r: hr([0.016, 0.008 + 0.002 * stop, 0.014]), k: 0.012 });
    m.ell({ ...H, tag: 'zygomatic', c: hl([0.05 * s, 0.002, -0.006]), r: hr([0.015 * (params.zyg ?? 1), 0.02, 0.042]), axis: norm([-0.3 * s, 0, 1]), k: 0.024 });
    m.ell({ ...H, tag: 'cheek', c: hl([0.034 * s, -0.022, -0.006]), r: hr([0.021, 0.027, 0.04]), k: 0.03 });
    // maxilla: carries the cheek forward into the side of the muzzle under the eye (a wedge from above,
    // no crease or pit between the cheek and the muzzle)
    m.ell({ ...H, tag: 'maxilla', c: hl([0.029 * s, -0.02, 0.046]), r: hr([0.021, 0.025, 0.038]), k: 0.03 });
    if (ruff > 0.2) m.ell({ ...H, tag: 'cheekruff', c: hl([0.046 * s, -0.026, -0.046]), r: hr([0.014 * ruff, 0.036, 0.04]), axis: norm([0.3 * s, 0, 1]), k: 0.03 });
    m.ell({ ...H, tag: 'mastoid', c: hl([0.034 * s, -0.02, -0.062]), r: hr([0.023, 0.03, 0.03]), k: 0.03 });
    // upper lip; the retriever's flews hang lower and fuller behind the canines
    m.ell({ ...H, tag: 'lip', c: hl([0.025 * s, -0.045 - 0.006 * flews, 0.078]), r: hr([0.015 + 0.002 * flews, 0.013 + 0.005 * flews, 0.058]), axis: norm([-0.2 * s, -0.06, 1]), k: 0.016 });
    m.ell({ ...H, tag: 'whisker', c: hl([0.021 * s, -0.027 - 0.003 * flews, 0.121]), r: hr([0.015 + 0.002 * flews, 0.015 * mzD, 0.026 * mzS]), k: 0.016 });
  }
  // muzzle: straight nasal bridge (shepherd) to a broad, deeper muzzle (retriever)
  m.cone({ ...H, tag: 'nasal', a: hl([0, 0.033 - 0.004 * stop - 0.023 * hw, 0.055]), b: hl([0, 0.007 - 0.016 * hw, 0.1505 - 0.0145 / mz]), ra: 0.023 * hw, rb: 0.016 * hw, k: 0.016 });
  m.ell({ ...H, tag: 'muzzle', c: hl([0, -0.02, 0.084]), r: hr([0.033, 0.027 * mzD, 0.064 * mzS]), axis: norm([0, -0.1, 1]), k: 0.02 });
  m.ell({ ...H, tag: 'nose', c: hl([0, -0.006, 0.1505]), r: hr([0.02, 0.0135, 0.0095]), axis: norm([0, 0.4, 1]), k: 0.008 });
  m.ell({ ...H, tag: 'philtrum', c: hl([0, -0.031, 0.146]), r: hr([0.01, 0.012, 0.008]), k: 0.01 });
  for (const s of [1, -1]) {
    const ef = eyeFrame(s);
    const at = (u, v, w) => add(add(add(ef.c, mul(ef.x, u)), mul(ef.y, v)), mul(ef.z, w));
    ellY({ ...H, tag: 'orbit', c: at(-0.002 * s, -0.0005, 0.018), ydir: ef.y, lateral: ef.x, r: [0.017 * EYE.r / 0.0108, 0.012 * EYE.r / 0.0108, 0.0085], k: 0.008, carve: true });
    m.sphere({ ...H, tag: 'eyelid', c: ef.c, rad: EYE.r + EYE.lid, k: 0.005 });
    m.lens({ ...H, tag: 'eyesocket', c: add(ef.c, mul(ef.y, EYE.off)), x: ef.x, y: ef.y, z: ef.z, R: EYE.R, d: EYE.d, zMin: -0.002, zMax: 0.024, k: 0.0021, carve: true });
    m.sphere({ ...H, tag: 'nostril', c: hl([0.0078 * s, -0.009, 0.16]), rad: 0.0035, k: 0.002, carve: true });
    // upper canine, hidden behind the lip; shows when the mouth opens (snarl, pant)
    m.cone({ ...H, tag: 'canine', a: hl([0.014 * s, -0.043, 0.118]), b: hl([0.013 * s, -0.057 - 0.004 * flews, 0.115]), ra: 0.0038, rb: 0.0011, k: 0.002 });
  }

  // ---------------------------------------------------------------- JAW (separate surface so the mouth can open)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  m.cone({ ...JW, tag: 'mandible', a: hl([0, -0.05, -0.015]), b: hl([0, -0.058, 0.11]), ra: 0.016, rb: 0.0085, k: 0 });
  for (const s of [1, -1]) {
    m.cone({ ...JW, tag: 'mandible', a: hl([0.03 * s * hw, -0.044, -0.03]), b: hl([0.0065 * s, -0.056, 0.108]), ra: 0.012, rb: 0.007, k: 0.02 });
    m.cone({ ...JW, tag: 'lowercanine', a: hl([0.0105 * s, -0.05, 0.112]), b: hl([0.0115 * s, -0.038, 0.109]), ra: 0.0032, rb: 0.001, k: 0.001 });
  }
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.06, 0.104]), r: hr([0.0105, 0.0085, 0.012]), k: 0.015 });

  // ---------------------------------------------------------------- TONGUE (rigid, slides out)
  // a long flat tongue in the floor of the mouth, just under the jaw's top surface when retracted
  const TG = { bone: 'tongue', group: 'jaw', part: 'tongue' };
  const tb = J.tongueBase, tt = J.tongueTip;
  const tdir = norm(sub(tt, tb)), tl = Math.hypot(...sub(tt, tb));
  ellY({ ...TG, tag: 'tongue', c: lerp(tb, tt, 0.45), ydir: tdir, lateral: X, r: [0.018 * hw, tl * 0.56, 0.0055], k: 0 });
  ellY({ ...TG, tag: 'tongue', c: lerp(tb, tt, 0.86), ydir: tdir, lateral: X, r: [0.019 * hw, tl * 0.2, 0.0045], k: 0.01 });

  // ---------------------------------------------------------------- EARS
  const earType = params.earType || 'prick';
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const dir = norm(sub(tip, base));
    const L = Math.hypot(...sub(tip, base));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    const at = (t) => lerp(base, tip, t);
    if (earType === 'prick') {
      // erect, broad at the base, pointed, the opening facing forward and a little out
      const facing = norm([0.5 * s, 0.05, 1]);
      const lat = norm(cross(dir, facing));
      const k = L / 0.125;
      ellY({ ...ear, tag: 'ear', c: at(0.22), ydir: dir, lateral: lat, r: [0.031 * k, 0.042 * k, 0.0085], k: 0.012 });
      ellY({ ...ear, tag: 'ear', c: at(0.55), ydir: dir, lateral: lat, r: [0.02 * k, 0.042 * k, 0.006], k: 0.012 });
      ellY({ ...ear, tag: 'ear', c: at(0.85), ydir: dir, lateral: lat, r: [0.0085 * k, 0.026 * k, 0.0042], k: 0.01 });
      // the cup: a deep hollow on the front of the pinna, open toward the skull at its base
      ellY({ ...ear, tag: 'earinner', c: add(at(0.34), mul(facing, 0.0075)), ydir: dir, lateral: lat, r: [0.022 * k, 0.044 * k, 0.0075], k: 0.004, carve: true });
      ellY({ ...ear, tag: 'earinner', c: add(at(0.67), mul(facing, 0.0055)), ydir: dir, lateral: lat, r: [0.011 * k, 0.03 * k, 0.0048], k: 0.003, carve: true });
    } else if (earType === 'drop') {
      // pendant flap: thin, broadest just below the fold, rounded tip, lying against the cheek
      const fwd = norm(cross(X.map((v) => v * s), dir).map((v) => -v));
      const k = L / 0.09;
      ellY({ ...ear, tag: 'ear', c: at(0.12), ydir: dir, lateral: fwd, r: [0.022 * k, 0.02 * k, 0.008], k: 0.012 });
      ellY({ ...ear, tag: 'ear', c: at(0.45), ydir: dir, lateral: fwd, r: [0.033 * k, 0.04 * k, 0.0055], k: 0.012 });
      ellY({ ...ear, tag: 'ear', c: at(0.8), ydir: dir, lateral: fwd, r: [0.026 * k, 0.026 * k, 0.005], k: 0.012 });
    } else {
      // button: a short upright root, then the flap folded forward and down over the opening
      const k = L / 0.05;
      ellY({ ...ear, tag: 'ear', c: add(base, [0.004 * s, 0.006, 0]), ydir: [0, 1, 0], lateral: [0, 0, 1], r: [0.019 * k, 0.013 * k, 0.008], k: 0.01 });
      // the flap lies tangent to the skull: its plane faces out and up
      const n = norm([0.8 * s, 0.6, 0.1]);
      const bend = norm(add(dir, [0, -0.6, 0]));
      ellY({ ...ear, tag: 'ear', c: at(0.5), ydir: dir, lateral: norm(cross(n, dir)), r: [0.022 * k, 0.026 * k, 0.005], k: 0.01 });
      ellY({ ...ear, tag: 'ear', c: add(at(0.88), mul(bend, 0.008 * k)), ydir: bend, lateral: norm(cross(n, bend)), r: [0.017 * k, 0.014 * k, 0.0045], k: 0.01 });
    }
  }

  // ---------------------------------------------------------------- LEGS
  const legK = params.boneK || 1; // bone / paw substance (retriever heavier, terrier finer)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.5), sx([0.007, 0, 0])), ydir: sub(Sh, Sc), lateral: lat, r: [0.022, 0.085, 0.05], k: 0.05, bias: 0.003 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.034, rb: 0.025, k: 0.05 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), [0, 0, -0.025]), ydir: sub(E, Sh), lateral: lat, r: [0.026, 0.063, 0.031], k: 0.042 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.006, -0.02]), rad: 0.015, k: 0.018 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: E, b: W, ra: 0.025 * legK, rb: 0.0155 * legK, k: 0.022 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.25), sx([0.0025, 0, 0.003])), ydir: sub(W, E), lateral: lat, r: [0.023 * legK, 0.056, 0.027 * legK], k: 0.026 });
    ellY({ tag: 'feather', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.45), [0, 0, -0.014]), ydir: sub(W, E), lateral: lat, r: [0.012, 0.05, 0.014 * (0.6 + 0.6 * ruff)], k: 0.018 });
    m.sphere({ tag: 'wrist', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0, -0.0025]), rad: 0.016 * legK, k: 0.01 });
    m.sphere({ tag: 'carpalpad', bone: 'metacarpus' + S, group: g, c: add(W, [0, -0.007, -0.016]), rad: 0.0075, k: 0.009 });
    m.cone({ tag: 'pastern', bone: 'metacarpus' + S, group: g, a: W, b: M, ra: 0.0155 * legK, rb: 0.0155 * legK, k: 0.01 });
    m.sphere({ tag: 'dewclaw', bone: 'metacarpus' + S, group: g, c: add(lerp(W, M, 0.3), sx([-0.0135, 0, 0.002])), rad: 0.005, k: 0.004 });
    const dp = norm(sub(T, M));
    const pk = params.pawK || 1;
    ellY({ tag: 'paw', bone: 'fpaw' + S, group: g, c: add(add(M, mul(dp, 0.018)), [0, -0.005, 0]), ydir: dp, lateral: lat, r: [0.025 * pk, 0.033 * pk, 0.016], k: 0.012 });
    m.sphere({ tag: 'pad', bone: 'fpaw' + S, group: g, c: add(M, [0, -0.016, 0.01]), rad: 0.011 * pk, k: 0.009 });
    const toeX = [-0.0175, -0.006, 0.006, 0.0175].map((x) => x * pk), toeZ = [-0.009, 0, 0, -0.009].map((z) => z * pk);
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'fpaw' + S, group: g, c: [T[0] + toeX[i] * s, 0.0102 * pk, T[2] - 0.0075 * pk + toeZ[i]], rad: 0.0096 * pk, k: 0.006 });
    for (let i = 0; i < 4; i++) m.cone({ tag: 'claw', bone: 'fpaw' + S, group: g, a: [T[0] + toeX[i] * s * 0.95, 0.0092 * pk, T[2] + toeZ[i]], b: [T[0] + toeX[i] * s * 0.95, 0.0035, T[2] + 0.009 * pk + toeZ[i]], ra: 0.0027, rb: 0.001, k: 0.002 });

    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Tt = J['htoe' + S];
    const hip = (d) => add(Hp, sx(d));
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.4), sx([0.003, 0, -0.024])), ydir: sub(K, Hp), lateral: lat, r: [0.035, 0.118, 0.078], k: 0.045, bias: 0.003 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: hip([-0.024, 0.044, 0.084]), b: add(K, sx([-0.003, 0.045, 0.0])), ra: 0.031, rb: 0.02, k: 0.05 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: hip([-0.02, 0.044, -0.084]), b: add(lerp(K, Hk, 0.28), [0, 0, -0.025]), ra: 0.037, rb: 0.023, k: 0.035 });
    ellY({ tag: 'breeches', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.62), sx([0.005, -0.008, -0.068])), ydir: sub(K, Hp), lateral: lat, r: [0.024, 0.064, 0.018 + 0.012 * ruff], k: 0.03 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: hip([-0.016, -0.052, 0.1]), ydir: [-0.03, 0.16, 0.1], lateral: lat, r: [0.017, 0.066, 0.033], k: 0.05 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.002, 0.007, 0.005])), rad: 0.014, k: 0.035 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.06), sx([0.0, 0.0, 0.003])), b: Hk, ra: 0.019 * legK, rb: 0.014 * legK, k: 0.025 });
    ellY({ tag: 'calf', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.002, 0.008, -0.022])), ydir: sub(Hk, K), lateral: lat, r: [0.021, 0.058, 0.025], k: 0.03 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.5), [0, 0.008, -0.028]), b: add(Hk, [0, 0.01, -0.024]), ra: 0.01, rb: 0.009, k: 0.013 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.01, -0.02]), rad: 0.0125, k: 0.01 });
    m.sphere({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: Hk, rad: 0.0165 * legK, k: 0.01 });
    m.cone({ tag: 'metatarsus', bone: 'metatarsus' + S, group: h, a: Hk, b: Mt, ra: 0.015 * legK, rb: 0.014 * legK, k: 0.01 });
    const dh = norm(sub(Tt, Mt));
    ellY({ tag: 'paw', bone: 'hpaw' + S, group: h, c: add(add(Mt, mul(dh, 0.016)), [0, -0.005, 0]), ydir: dh, lateral: lat, r: [0.022 * pk, 0.03 * pk, 0.015], k: 0.012 });
    m.sphere({ tag: 'pad', bone: 'hpaw' + S, group: h, c: add(Mt, [0, -0.018, 0.008]), rad: 0.01 * pk, k: 0.009 });
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'hpaw' + S, group: h, c: [Tt[0] + toeX[i] * 0.92 * s, 0.0096 * pk, Tt[2] - 0.0075 * pk + toeZ[i]], rad: 0.0088 * pk, k: 0.006 });
    for (let i = 0; i < 4; i++) m.cone({ tag: 'claw', bone: 'hpaw' + S, group: h, a: [Tt[0] + toeX[i] * 0.88 * s, 0.0085 * pk, Tt[2] + toeZ[i]], b: [Tt[0] + toeX[i] * 0.88 * s, 0.0035, Tt[2] + 0.0085 * pk + toeZ[i]], ra: 0.0025, rb: 0.0009, k: 0.002 });
  }

  // ---------------------------------------------------------------- TAIL
  const tailType = params.tailType || 'brush';
  const tb2 = params.tailBrush ?? 1;
  const tailR = tailType === 'otter'
    // thick at the root, tapering evenly to a rounded tip ("otter tail", FCI 122)
    ? (t) => tb2 * (0.034 - 0.022 * Math.pow(t, 1.1))
    : tailType === 'thin'
      ? (t) => tb2 * (0.019 - 0.008 * t)
      // bushy saber: thickest at a third of its length
      : (t) => tb2 * (t < 0.12 ? 0.024 + 0.004 * (t / 0.12) : t < 0.45 ? 0.028 + 0.004 * ((t - 0.12) / 0.33) : 0.032 - 0.016 * Math.pow((t - 0.45) / 0.55, 1.6));
  const rootR = tailType === 'thin' ? 0.024 : 0.03;
  m.cone({ tag: 'tailroot', bone: 'tail0', a: lerp(J.tailBase, ls, 0.3), b: J.tail1, ra: rootR, rb: tailR(0.1), k: 0.035 });
  for (let i = 0; i < TAIL_SEGS; i++) {
    m.cone({ tag: 'tail', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: tailR(i / TAIL_SEGS), rb: tailR((i + 1) / TAIL_SEGS), k: tailType === 'brush' ? 0.012 : 0.022, thin: i >= TAIL_SEGS - 1 });
  }

  return m;
}
