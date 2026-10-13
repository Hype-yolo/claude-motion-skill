// The cheetah, sculpted as a signed distance field.
// Every primitive is attached to a bone (for skinning) and a group (axial / limb / ear / jaw).
import { HEAD_O, TAIL_SEGS } from './rig.js';
import { add, sub, mul, lerp, norm, cross } from '../../core/math/vec.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';

const hl = (v) => [v[0] + HEAD_O[0], v[1] + HEAD_O[1], v[2] + HEAD_O[2]];

// Eye geometry shared by the sculpt (lids + aperture) and the eyeball shader.
//  c: head-local eye centre (left); r: eyeball radius; yaw: outward divergence of each eye;
//  lid: eyelid skin thickness; R, d: almond aperture (two circular arcs) -> 22 mm wide, 10.5 mm
//  tall, set 1.3 mm low (off) so the upper lid hoods the top of the iris; tilt: inner corner lower.
export const EYE = { c: [0.027, 0.026, 0.024], r: 0.0122, back: 0.0025, yaw: 0.16, lid: 0.0014, R: 0.014149, d: 0.008899, off: -0.0013, tilt: (12 * Math.PI) / 180, irisZ: 0.00727, irisR: 0.0098 };

const X = [1, 0, 0];

export function sculptCheetah(m, rig) {
  const J = rig.J;
  const eyeFrame = (s) => eyeFrameOf(EYE, HEAD_O, s);

  // Ellipsoid whose local Y follows `ydir`; radii = [lateral, along ydir, third axis]
  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };

  // ---------------------------------------------------------------- TORSO
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 0.575, 0.13], r: [0.1, 0.18, 0.22], axis: norm([0, 0.15, -1]), k: 0 });
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.478, 0.3], r: [0.075, 0.095, 0.1], axis: norm([0, -0.35, 1]), k: 0.06 });
  m.ell({ tag: 'pectoral', bone: 'chest', c: [0, 0.49, 0.35], r: [0.08, 0.08, 0.075], k: 0.05 });
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.705, 0.24], r: [0.055, 0.058, 0.13], axis: norm([0, -0.08, 1]), k: 0.06 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 0.7, 0.0], r: [0.07, 0.05, 0.17], k: 0.06 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.628, -0.17], r: [0.076, 0.1, 0.2], axis: norm([0, 0.3, -1]), k: 0.07 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 0.695, -0.24], r: [0.064, 0.055, 0.19], k: 0.05 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 0.605, -0.31], r: [0.068, 0.07, 0.1], k: 0.05 });
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 0.665, -0.47], r: [0.078, 0.095, 0.135], k: 0.06 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 0.715, -0.46], r: [0.06, 0.045, 0.125], k: 0.04 });
  for (const s of [1, -1]) {
    m.ell({ tag: 'rump', bone: 'pelvis', c: [0.045 * s, 0.625, -0.575], r: [0.044, 0.075, 0.055], k: 0.04 });
  }

  // ---------------------------------------------------------------- NECK
  m.cone({ tag: 'neck', bone: 'neck1', a: [0, 0.61, 0.33], b: [0, 0.705, 0.455], ra: 0.088, rb: 0.064, k: 0.06 });
  m.cone({ tag: 'neck', bone: 'neck2', a: [0, 0.705, 0.455], b: [0, 0.772, 0.53], ra: 0.064, rb: 0.052, k: 0.04 });
  m.ell({ tag: 'nape', bone: 'neck1', c: [0, 0.765, 0.43], r: [0.038, 0.028, 0.12], axis: norm([0, 0.35, 1]), k: 0.04 });
  m.ell({ tag: 'throat', bone: 'neck1', c: [0, 0.655, 0.47], r: [0.046, 0.055, 0.09], axis: norm([0, 0.8, 0.6]), k: 0.05 });
  m.ell({ tag: 'throat', bone: 'neck2', c: hl([0, -0.054, -0.042]), r: [0.035, 0.028, 0.062], k: 0.03 });

  // ---------------------------------------------------------------- HEAD (modelled in head-local coords, see HEAD_O)
  // landmarks measured from profile/frontal references: nose tip (0,-0.018,0.10), eyes (+-0.029,0.026,0.021),
  // chin (0,-0.068,0.058), skull top 0.066, occiput -0.09
  const H = { bone: 'head' };
  m.ell({ ...H, tag: 'cranium', c: hl([0, 0.02, -0.03]), r: [0.047, 0.046, 0.062], k: 0.04 });
  m.ell({ ...H, tag: 'forehead', c: hl([0, 0.034, 0.018]), r: [0.021, 0.03, 0.034], axis: norm([0, -0.6, 1]), k: 0.02 });
  for (const s of [1, -1]) {
    m.ell({ ...H, tag: 'brow', c: hl([0.028 * s, 0.042, 0.022]), r: [0.014, 0.007, 0.012], k: 0.012 });
    m.ell({ ...H, tag: 'zygomatic', c: hl([0.047 * s, 0.006, -0.002]), r: [0.013, 0.02, 0.04], axis: norm([-0.35 * s, 0, 1]), k: 0.025 });
    m.ell({ ...H, tag: 'cheek', c: hl([0.035 * s, -0.027, 0.004]), r: [0.021, 0.026, 0.036], k: 0.025 });
    m.ell({ ...H, tag: 'lip', c: hl([0.023 * s, -0.047, 0.05]), r: [0.011, 0.009, 0.03], axis: norm([-0.45 * s, -0.15, 1]), k: 0.012 });
    m.ell({ ...H, tag: 'mastoid', c: hl([0.034 * s, -0.02, -0.05]), r: [0.022, 0.03, 0.03], k: 0.03 });
    m.ell({ ...H, tag: 'whisker', c: hl([0.0135 * s, -0.037, 0.078]), r: [0.0145, 0.0135, 0.016], k: 0.012 });
  }
  m.ell({ ...H, tag: 'muzzle', c: hl([0, -0.022, 0.058]), r: [0.024, 0.024, 0.032], axis: norm([0, -0.4, 1]), k: 0.02 });
  m.cone({ ...H, tag: 'nasal', a: hl([0, 0.036, 0.042]), b: hl([0, 0.002, 0.083]), ra: 0.019, rb: 0.014, k: 0.015 });
  m.ell({ ...H, tag: 'nose', c: hl([0, -0.012, 0.091]), r: [0.0142, 0.0086, 0.0082], axis: norm([0, 0.5, 1]), k: 0.008 });
  m.ell({ ...H, tag: 'philtrum', c: hl([0, -0.034, 0.088]), r: [0.01, 0.011, 0.008], k: 0.01 });
  for (const s of [1, -1]) {
    // eyelids: a thin skin shell hugging the eyeball, cut open along an almond-shaped aperture that
    // reaches only down to the eyeball, so the eye sits flush in its lids with no cavity around it
    const ef = eyeFrame(s);
    const at = (u, v, w) => add(add(add(ef.c, mul(ef.x, u)), mul(ef.y, v)), mul(ef.z, w));
    // orbit: a soft hollow around the eye so the brow, cheek and nose bridge fall away to the lids
    // (the inner corner opens toward the tear line instead of being buried under the bridge)
    ellY({ ...H, tag: 'orbit', c: at(-0.002 * s, -0.0005, 0.019), ydir: ef.y, lateral: ef.x, r: [0.018, 0.0125, 0.009], k: 0.008, carve: true });
    m.sphere({ ...H, tag: 'eyelid', c: ef.c, rad: EYE.r + EYE.lid, k: 0.005 });
    m.lens({ ...H, tag: 'eyesocket', c: add(ef.c, mul(ef.y, EYE.off)), x: ef.x, y: ef.y, z: ef.z, R: EYE.R, d: EYE.d, zMin: -0.002, zMax: 0.024, k: 0.0022, carve: true });
    m.sphere({ ...H, tag: 'nostril', c: hl([0.0065 * s, -0.015, 0.1]), rad: 0.003, k: 0.002, carve: true });
  }

  // ---------------------------------------------------------------- JAW (separate surface so the mouth can open)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  m.cone({ ...JW, tag: 'mandible', a: hl([0, -0.045, -0.012]), b: hl([0, -0.052, 0.044]), ra: 0.018, rb: 0.012, k: 0 });
  for (const s of [1, -1]) {
    m.cone({ ...JW, tag: 'mandible', a: hl([0.032 * s, -0.039, -0.028]), b: hl([0.01 * s, -0.051, 0.048]), ra: 0.014, rb: 0.01, k: 0.02 });
  }
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.053, 0.05]), r: [0.015, 0.011, 0.011], k: 0.015 });

  // ---------------------------------------------------------------- EARS
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const up = norm(sub(tip, base));
    const facing = norm([1.0 * s, 0.1, 1]);
    const c = lerp(base, tip, 0.3);
    const lat = norm(cross(up, facing));
    const ear = { bone: 'ear' + S, group: 'ear' + S };
    ellY({ ...ear, tag: 'ear', c, ydir: up, lateral: lat, r: [0.0165, 0.0185, 0.0062], k: 0.012 });
    ellY({ ...ear, tag: 'earinner', c: add(add(c, mul(facing, 0.0068)), mul(up, 0.003)), ydir: up, lateral: lat, r: [0.0112, 0.0132, 0.0044], k: 0.003, carve: true });
  }

  // ---------------------------------------------------------------- LEGS
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    // front
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.5), sx([0.006, 0, 0])), ydir: sub(Sh, Sc), lateral: lat, r: [0.022, 0.1, 0.055], k: 0.06, bias: 0.004 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.037, rb: 0.031, k: 0.06 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), [0, 0, -0.03]), ydir: sub(E, Sh), lateral: lat, r: [0.03, 0.075, 0.036], k: 0.05 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.01, -0.028]), rad: 0.019, k: 0.02 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: E, b: W, ra: 0.032, rb: 0.019, k: 0.025 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.25), sx([0.004, 0, 0.004])), ydir: sub(W, E), lateral: lat, r: [0.03, 0.07, 0.034], k: 0.03 });
    m.sphere({ tag: 'wrist', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0, -0.004]), rad: 0.0195, k: 0.012 });
    m.sphere({ tag: 'carpalpad', bone: 'metacarpus' + S, group: g, c: add(W, [0, -0.01, -0.02]), rad: 0.009, k: 0.01 });
    m.cone({ tag: 'pastern', bone: 'metacarpus' + S, group: g, a: W, b: M, ra: 0.018, rb: 0.017, k: 0.012 });
    m.sphere({ tag: 'dewclaw', bone: 'metacarpus' + S, group: g, c: add(lerp(W, M, 0.35), sx([-0.016, 0, 0.004])), rad: 0.007, k: 0.006 });
    const dp = norm(sub(T, M));
    ellY({ tag: 'paw', bone: 'fpaw' + S, group: g, c: add(add(M, mul(dp, 0.02)), [0, -0.006, 0]), ydir: dp, lateral: lat, r: [0.026, 0.036, 0.018], k: 0.014 });
    m.sphere({ tag: 'pad', bone: 'fpaw' + S, group: g, c: add(M, [0, -0.026, 0.012]), rad: 0.012, k: 0.01 });
    const toeX = [-0.019, -0.0065, 0.0065, 0.019], toeZ = [-0.009, 0, 0, -0.009];
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'fpaw' + S, group: g, c: [T[0] + toeX[i] * s, 0.0115, T[2] - 0.008 + toeZ[i]], rad: 0.0105, k: 0.007 });

    // hind
    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Tt = J['htoe' + S];
    // The thigh is a broad teardrop in side view: wide where it rises into the flank and croup,
    // narrowing to the stifle. Its cranial edge climbs all the way up to the iliac wing and the
    // flank fold webs the stifle to the belly, so there is no notch between belly and thigh.
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.4), sx([0.004, 0, -0.035])), ydir: sub(K, Hp), lateral: lat, r: [0.041, 0.15, 0.1], k: 0.05, bias: 0.004 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.04, 0.625, -0.33]), b: add(K, sx([-0.004, 0.055, 0.0])), ra: 0.04, rb: 0.025, k: 0.06 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.046, 0.625, -0.595]), b: add(lerp(K, Hk, 0.28), [0, 0, -0.028]), ra: 0.045, rb: 0.028, k: 0.04 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.05, 0.475, -0.29]), ydir: [-0.03, 0.16, 0.1], lateral: lat, r: [0.02, 0.085, 0.04], k: 0.06 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.002, 0.008, 0.006])), rad: 0.0175, k: 0.04 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.06), sx([0.0, 0.0, 0.004])), b: Hk, ra: 0.024, rb: 0.018, k: 0.03 });
    ellY({ tag: 'calf', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.002, 0.01, -0.027])), ydir: sub(Hk, K), lateral: lat, r: [0.025, 0.065, 0.029], k: 0.035 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.5), [0, 0.01, -0.035]), b: add(Hk, [0, 0.012, -0.03]), ra: 0.012, rb: 0.011, k: 0.015 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.012, -0.026]), rad: 0.015, k: 0.012 });
    m.sphere({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: Hk, rad: 0.021, k: 0.012 });
    m.cone({ tag: 'metatarsus', bone: 'metatarsus' + S, group: h, a: Hk, b: Mt, ra: 0.018, rb: 0.016, k: 0.012 });
    const dh = norm(sub(Tt, Mt));
    ellY({ tag: 'paw', bone: 'hpaw' + S, group: h, c: add(add(Mt, mul(dh, 0.02)), [0, -0.006, 0]), ydir: dh, lateral: lat, r: [0.024, 0.034, 0.017], k: 0.014 });
    m.sphere({ tag: 'pad', bone: 'hpaw' + S, group: h, c: add(Mt, [0, -0.026, 0.01]), rad: 0.011, k: 0.01 });
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'hpaw' + S, group: h, c: [Tt[0] + toeX[i] * 0.95 * s, 0.011, Tt[2] - 0.008 + toeZ[i]], rad: 0.0098, k: 0.007 });
  }

  // ---------------------------------------------------------------- TAIL
  const tailR = (t) => (t < 0.4 ? 0.034 + (0.024 - 0.034) * (t / 0.4) : t < 0.8 ? 0.024 + (0.021 - 0.024) * ((t - 0.4) / 0.4) : 0.021 - 0.002 * ((t - 0.8) / 0.2));
  m.cone({ tag: 'tailroot', bone: 'tail0', a: [0, 0.672, -0.545], b: J.tail1, ra: 0.05, rb: tailR(0.1), k: 0.04 });
  for (let i = 0; i < TAIL_SEGS; i++) {
    m.cone({ tag: 'tail', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: tailR(i / TAIL_SEGS), rb: tailR((i + 1) / TAIL_SEGS), k: 0 });
  }

  return m;
}
