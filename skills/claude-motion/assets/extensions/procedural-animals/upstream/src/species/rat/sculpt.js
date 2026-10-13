// The brown rat, sculpted as a signed distance field around the crouched bind pose (rig.js).
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / snout / jaw).
// Head primitives are placed in head-local coordinates (HEAD_O: midline, level with the eye
// centres), measured from the profile and face reference photos.
import { HEAD_O, TAIL_SEGS, hl, HK, T as TM } from './rig.js';
import { add, sub, mul, lerp, norm, cross, dot } from '../../core/math/vec.js';
import { sculptEyeSocket } from '../../core/sdf/eyeSocket.js';

// Dark, bulging, round eyes set high on the side of the head: globe ~6 mm, visible opening ~5 mm,
// looking ~60 degrees out to the side and a little up; the globe protrudes beyond the lids.
export const EYE = {
  c: [0.0092 * HK, 0.0008 * HK, 0.0], r: 0.0039, back: -0.0002, yaw: 1.05, pitch: 0.14, lid: 0.00035,
  R: 0.0036, d: 0.0003, off: 0.0, tilt: (6 * Math.PI) / 180, irisZ: 0.0022, irisR: 0.0034,
};
export const eyeOf = (params = {}) => (params.juv ? { ...EYE, r: EYE.r * 1.08, R: EYE.R * 1.08, irisZ: EYE.irisZ * 1.08, irisR: EYE.irisR * 1.08 } : EYE);

const X = [1, 0, 0];

export function sculptRat(m, rig, params = {}) {
  const J = rig.J;
  const male = params.sex === 'male';

  // Ellipsoid whose local Y follows `ydir`; radii = [lateral, along ydir, third axis]
  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };

  // ---------------------------------------------------------------- TORSO (pear-shaped, highest over the loins)
  m.ell({ tag: 'ribcage', bone: 'spine3', c: TM([0, 0.048, -0.006]), r: [0.0265, 0.022, 0.034 * 0.92], axis: norm([0, 0.25, 1]), k: 0 });
  m.ell({ tag: 'brisket', bone: 'chest', c: TM([0, 0.037, 0.02]), r: [0.018, 0.02, 0.02 * 0.92], axis: norm([0, -0.4, 1]), k: 0.012 });
  m.ell({ tag: 'withers', bone: 'chest', c: TM([0, 0.056, 0.006]), r: [0.019, 0.011, 0.022 * 0.92], axis: norm([0, 0.3, 1]), k: 0.018 });
  m.ell({ tag: 'back', bone: 'spine2', c: TM([0, 0.052, -0.037]), r: [0.029, 0.016, 0.035 * 0.92], axis: norm([0, 0.15, 1]), k: 0.022 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: TM([0, 0.045, -0.036]), r: [0.031, 0.021, 0.037 * 0.92], k: 0.022 });
  m.ell({ tag: 'loin', bone: 'spine1', c: TM([0, 0.055, -0.054]), r: [0.029, 0.018, 0.029 * 0.92], axis: norm([0, -0.5, 1]), k: 0.02 });
  m.ell({ tag: 'rump', bone: 'pelvis', c: TM([0, 0.046, -0.067]), r: [0.028, 0.0195, 0.027 * 0.92], k: 0.02 });
  m.ell({ tag: 'rumpback', bone: 'pelvis', c: TM([0, 0.045, -0.079]), r: [0.021, 0.017, 0.018 * 0.92], k: 0.012 });
  if (male) m.ell({ tag: 'scrotum', bone: 'pelvis', c: TM([0, 0.03, -0.084]), r: [0.012, 0.012, 0.011 * 0.92], k: 0.008 });

  // ---------------------------------------------------------------- NECK (none visible: the head merges into the shoulders)
  m.cone({ tag: 'neck', bone: 'neck1', a: TM([0, 0.047, 0.018]), b: J.neckMid, ra: 0.019, rb: 0.0155, k: 0.012 });
  m.cone({ tag: 'neck', bone: 'neck2', a: J.neckMid, b: hl([0, -0.001, -0.014]), ra: 0.0155, rb: 0.0135, k: 0.01 });
  m.ell({ tag: 'throat', bone: 'neck1', c: TM([0, 0.041, 0.037]), r: [0.014, 0.012, 0.016 * 0.92], k: 0.012 });

  // ---------------------------------------------------------------- HEAD (head-local, see HEAD_O)
  const H = { bone: 'head' };
  const hw = params.headWidth || 1;
  const mz = params.muzzle || 1;
  const hz = (v) => hl([v[0], v[1], v[2] > 0.004 ? 0.004 + (v[2] - 0.004) * mz : v[2]]);
  m.ell({ ...H, tag: 'cranium', c: hl([0, 0.0005, -0.0125]), r: [0.0108 * hw * HK, 0.0098 * HK, 0.0165 * HK], k: 0.008 });
  m.cone({ ...H, tag: 'nasal', a: hl([0, 0.0015, -0.004]), b: hz([0, -0.0075, 0.0185]), ra: 0.0082 * hw * HK, rb: 0.0041 * HK, k: 0.006 });
  for (const s of [1, -1]) {
    // masseter cheeks (broad in the brown rat), the brow over the eye, the jowl
    m.ell({ ...H, tag: 'cheek', c: hl([0.0072 * s * hw, -0.0095, -0.0085]), r: [0.0058 * HK, 0.0074 * HK, 0.0105 * HK], k: 0.007 });
    m.ell({ ...H, tag: 'brow', c: hl([0.0062 * s, 0.0052, 0.0005]), r: [0.004 * HK, 0.0028 * HK, 0.0065 * HK], k: 0.004 });
    m.ell({ ...H, tag: 'jowl', c: hl([0.0058 * s, -0.0135, -0.016]), r: [0.0056 * HK, 0.0064 * HK, 0.0085 * HK], k: 0.007 });
  }
  m.ell({ ...H, tag: 'muzzle', c: hz([0, -0.0098, 0.0095]), r: [0.0058 * hw * HK, 0.0064 * HK, 0.009 * HK], k: 0.005 });
  for (const s of [1, -1]) sculptEyeSocket(m, eyeOf(params), HEAD_O, s, { orbit: { r: [0.0036 * HK, 0.003 * HK, 0.0018 * HK], at: [0.0, 0.0, 0.0028 * HK], k: 0.0014 } });

  // snout: pink nose leather, whisker pads and the split upper lip (twitch with the snout bone)
  const SN = { bone: 'snout', group: 'snout' };
  for (const s of [1, -1]) {
    m.ell({ ...SN, tag: 'whisker', c: hz([0.0037 * s, -0.0124, 0.0148]), r: [0.0041 * HK, 0.0042 * HK, 0.0062 * HK], k: 0.003 });
    m.sphere({ ...SN, tag: 'nostril', c: hz([0.0014 * s, -0.0113, 0.0238]), rad: 0.0005 * HK, k: 0.0005, carve: true });
  }
  m.ell({ ...SN, tag: 'nose', c: hz([0, -0.0112, 0.0222]), r: [0.0027 * HK, 0.0021 * HK, 0.002 * HK], axis: norm([0, 0.5, 1]), k: 0.002 });
  // the cleft of the upper lip: a groove down from the nose pad that shows the upper incisors
  m.cone({ ...SN, tag: 'lipcleft', a: hz([0, -0.0142, 0.0222]), b: hz([0, -0.0168, 0.0196]), ra: 0.0004 * HK, rb: 0.0007 * HK, k: 0.0006, carve: true });

  // ---------------------------------------------------------------- JAW (short, set back under the upper lip)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  m.cone({ ...JW, tag: 'mandible', a: hl([0, -0.0145, -0.012]), b: hz([0, -0.0178, 0.0135]), ra: 0.0055 * HK, rb: 0.0032 * HK, k: 0 });
  m.ell({ ...JW, tag: 'chin', c: hz([0, -0.0188, 0.0128]), r: [0.0034 * HK, 0.0026 * HK, 0.0036 * HK], k: 0.002 });

  // ---------------------------------------------------------------- INCISORS (own rigid parts, keratin coloured in the coat)
  // uppers: two short curved chisels emerging under the split lip; lowers: longer, behind them
  const UT = { bone: 'head', group: 'teeth', part: 'uteeth' }, LT = { bone: 'jaw', group: 'teeth', part: 'lteeth' };
  for (const s of [1, -1]) {
    m.cone({ ...UT, tag: 'incisor', a: hz([0.0008 * s, -0.0146, 0.0178]), b: hz([0.0008 * s, -0.0167, 0.0177]), ra: 0.00058 * HK, rb: 0.0005 * HK, k: 0 });
    m.cone({ ...LT, tag: 'incisor', a: hz([0.00072 * s, -0.019, 0.0146]), b: hz([0.00072 * s, -0.0172, 0.0164]), ra: 0.0005 * HK, rb: 0.00043 * HK, k: 0 });
  }

  // ---------------------------------------------------------------- EARS (thin, rounded, nearly bare; cup facing forward and out)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const L = Math.hypot(tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]);
    const up = norm(sub(tip, base));
    const facing0 = norm([0.55 * s, 0.05, 0.85]);
    const facing = norm(sub(facing0, mul(up, dot(facing0, up))));
    const lat = norm(cross(up, facing));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    const w = params.earWidth || 1;
    m.cone({ ...ear, tag: 'earbase', a: lerp(base, tip, -0.15), b: lerp(base, tip, 0.18), ra: 0.0042, rb: 0.0036, k: 0.004 });
    ellY({ ...ear, tag: 'ear', c: lerp(base, tip, 0.5), ydir: up, lateral: lat, r: [0.0086 * w, 0.52 * L, 0.0015], k: 0.003 });
    ellY({ ...ear, tag: 'earinner', c: add(lerp(base, tip, 0.52), mul(facing, 0.0017)), ydir: up, lateral: lat, r: [0.0073 * w, 0.45 * L, 0.0013], k: 0.001, carve: true });
  }

  // ---------------------------------------------------------------- LEGS
  const toes = (g, bone, Wr, Mp, Tp, s, spec, claw) => {
    // digits fanned from the metapodial head; spec: [yaw deg, length, radius]
    const fwd = norm([Tp[0] - Mp[0], 0, Tp[2] - Mp[2]]);
    for (const [a, len, r, drop] of spec) {
      const ang = (a * Math.PI) / 180 * s;
      const d = norm([fwd[0] * Math.cos(ang) + fwd[2] * Math.sin(ang), 0, -fwd[0] * Math.sin(ang) + fwd[2] * Math.cos(ang)]);
      const root = [Mp[0] + d[0] * 0.0012 + Math.sin(ang) * 0.0018, Mp[1] + 0.0003, Mp[2] + d[2] * 0.0012];
      const tip = [root[0] + d[0] * len, (drop ?? r * 0.9), root[2] + d[2] * len];
      m.cone({ tag: 'toe', bone, group: g, a: root, b: tip, ra: r, rb: r * 0.78, k: 0.0006 });
      m.sphere({ tag: 'pad', bone, group: g, c: [tip[0] - d[0] * 0.0008, r * 0.85, tip[2] - d[2] * 0.0008], rad: r * 0.95, k: 0.0005 });
      m.cone({ tag: 'claw', bone, group: g, a: [tip[0] - d[0] * 0.0004, r * 1.05, tip[2] - d[2] * 0.0004], b: [tip[0] + d[0] * claw, 0.0003, tip[2] + d[2] * claw], ra: r * 0.55, rb: 0.00015, k: 0.0003 });
    }
    void Wr;
  };
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    // front: short, slim; plantigrade hand with 4 long fingers and a thumb stub
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.5), sx([0.002, 0, 0])), ydir: sub(Sh, Sc), lateral: lat, r: [0.0065, 0.016, 0.012], k: 0.01, bias: 0.0005 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.0075, rb: 0.0055, k: 0.008 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), [0, 0, -0.003]), ydir: sub(E, Sh), lateral: lat, r: [0.0055, 0.011, 0.0065], k: 0.006 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: E, b: W, ra: 0.0044, rb: 0.0024, k: 0.002 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: lerp(E, W, 0.3), ydir: sub(W, E), lateral: lat, r: [0.0038, 0.008, 0.0042], k: 0.002 });
    m.sphere({ tag: 'wrist', bone: 'metacarpus' + S, group: g, c: W, rad: 0.0025, k: 0.0015 });
    const dp = norm(sub(M, W));
    ellY({ tag: 'palm', bone: 'metacarpus' + S, group: g, c: add(lerp(W, M, 0.55), [0, -0.0004, 0]), ydir: dp, lateral: lat, r: [0.0032, 0.0062, 0.0018], k: 0.0015 });
    toes(g, 'fpaw' + S, W, M, T, s, [[-38, 0.0056, 0.00078], [-11, 0.0078, 0.0008], [10, 0.0082, 0.0008], [34, 0.0068, 0.00076]], 0.0017);
    // thumb stub on the inside of the wrist
    m.sphere({ tag: 'toe', bone: 'metacarpus' + S, group: g, c: add(W, sx([-0.0026, -0.002, 0.004])), rad: 0.0011, k: 0.0006 });

    // hind: thigh hidden in the body, slim shank, long bare sole with 5 toes
    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Tt = J['htoe' + S];
    ellY({ tag: 'haunch', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.4), sx([0.004, 0.002, -0.004])), ydir: sub(K, Hp), lateral: lat, r: [0.013, 0.021, 0.018], k: 0.012, bias: 0.0005 });
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.65), sx([0.004, -0.002, 0.0])), ydir: sub(K, Hp), lateral: lat, r: [0.009, 0.014, 0.011], k: 0.008 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: TM(sx([0.023, 0.042, -0.03])), ydir: [0, 0.3, 0.1], lateral: lat, r: [0.006, 0.013, 0.011], k: 0.01 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.001, 0, 0.001])), rad: 0.0052, k: 0.005 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: K, b: Hk, ra: 0.0052, rb: 0.0027, k: 0.002 });
    ellY({ tag: 'calf', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.35), sx([0.0008, 0.0015, -0.0022])), ydir: sub(Hk, K), lateral: lat, r: [0.0045, 0.011, 0.0055], k: 0.002 });
    m.sphere({ tag: 'heel', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, -0.0008, -0.001]), rad: 0.0028, k: 0.0015 });
    const dh = norm(sub(Mt, Hk));
    ellY({ tag: 'sole', bone: 'metatarsus' + S, group: h, c: add(lerp(Hk, Mt, 0.55), [0, -0.0006, 0]), ydir: dh, lateral: lat, r: [0.0034, 0.0148, 0.0019], k: 0.0015 });
    toes(h, 'hpaw' + S, Hk, Mt, Tt, s, [[-40, 0.0058, 0.00085, 0.0008], [-15, 0.0098, 0.0009], [2, 0.0108, 0.0009], [18, 0.0102, 0.0009], [40, 0.0086, 0.00086]], 0.0018);
  }

  // ---------------------------------------------------------------- TAIL (long, thick at the root, tapering, scaly)
  const tailR = (i) => 0.0042 * Math.pow(1 - i / (TAIL_SEGS + 1.5), 0.85) * (params.tailThick || 1);
  m.cone({ tag: 'tailroot', bone: 'tail0', a: lerp(J.tail0, J.tail1, -0.3), b: J.tail1, ra: 0.0062, rb: tailR(1), k: 0.008 });
  for (let i = 1; i < TAIL_SEGS; i++) {
    const a = J['tail' + i], b = J['tail' + (i + 1)];
    const ra = tailR(i), rb = i === TAIL_SEGS - 1 ? 0.0008 : tailR(i + 1);
    m.cone({ tag: 'tail', bone: 'tail' + i, a, b, ra, rb, k: 0.0006 });
    // a thin core ellipsoid per segment: inflated at the coarse tiers so the tail never breaks up
    const d = sub(b, a), l = Math.hypot(...d);
    m.ell({ tag: 'tailcore', bone: 'tail' + i, c: lerp(a, b, 0.5), axis: norm(d), up: norm(cross(norm(d), X)), r: [ra * 0.6, ra * 0.6, l * 0.62], k: 0.0006, thin: true });
  }
  return m;
}
