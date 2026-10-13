// The rabbit, sculpted as a signed distance field around the half-extended bind pose (rig.js; the
// rear of the torso is raised with the hips, RL).
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / snout / jaw).
// Head primitives are placed in head-local coordinates (HEAD_O: midline, level with the eye
// centres), measured from the profile and three-quarter reference photos.
import { HEAD_O, TAIL_SEGS, RL } from './rig.js';
import { add, sub, mul, lerp, norm, cross } from '../../core/math/vec.js';
import { sculptEyeSocket, eyeFrameOf } from '../../core/sdf/eyeSocket.js';

const hl = (v) => [v[0] + HEAD_O[0], v[1] + HEAD_O[1], v[2] + HEAD_O[2]];

// Large, lateral, slightly raised eyes: globe ~17 mm, visible opening ~13 x 11 mm, looking ~65
// degrees out to the side and a little up; a round, nearly lid-free aperture (no sclera shows).
export const EYE = {
  c: [0.0172, 0.001, 0.0015], r: 0.0102, back: 0.0012, yaw: 1.1, pitch: 0.12, lid: 0.0011,
  R: 0.0088, d: 0.0014, off: 0.0, tilt: (8 * Math.PI) / 180, irisZ: 0.0058, irisR: 0.0083,
};

const X = [1, 0, 0];

export function sculptRabbit(m, rig, params = {}) {
  const J = rig.J;
  const doe = params.sex === 'female';
  const dom = !!params.domestic;

  // Ellipsoid whose local Y follows `ydir`; radii = [lateral, along ydir, third axis]
  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };

  // ---------------------------------------------------------------- TORSO (egg-shaped, highest over the loins)
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 0.128, 0.03], r: [0.05, 0.054, 0.062], axis: norm([0, 0.35, 1]), k: 0 });
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.09, 0.066], r: [0.035, 0.054, 0.036], axis: norm([0, -0.5, 1]), k: 0.03 });
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.167, 0.048], r: [0.034, 0.024, 0.042], axis: norm([0, 0.35, 1]), k: 0.03 });
  m.ell({ tag: 'back', bone: 'spine2', c: RL([0, 0.162, -0.018]), r: [0.046, 0.03, 0.06], k: 0.035 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: RL([0, 0.082, -0.03]), r: [0.05, 0.062, 0.06], k: 0.035 });
  m.ell({ tag: 'loin', bone: 'spine1', c: RL([0, 0.153, -0.062]), r: [0.05, 0.032, 0.05], axis: norm([0, -0.55, 1]), k: 0.03 });
  m.ell({ tag: 'rump', bone: 'pelvis', c: RL([0, 0.092, -0.094]), r: [0.044, 0.068, 0.053], k: 0.035 });
  m.ell({ tag: 'rumpback', bone: 'pelvis', c: RL([0, 0.066, -0.108]), r: [0.04, 0.04, 0.04], k: 0.03 });

  // ---------------------------------------------------------------- NECK (short: the head sits on the shoulders)
  m.cone({ tag: 'neck', bone: 'neck1', a: [0, 0.155, 0.074], b: J.neckMid, ra: 0.036, rb: 0.03, k: 0.03 });
  m.cone({ tag: 'neck', bone: 'neck2', a: J.neckMid, b: hl([0, 0.0, -0.02]), ra: 0.03, rb: 0.026, k: 0.025 });
  m.ell({ tag: 'throat', bone: 'neck1', c: [0, 0.145, 0.1], r: [0.03, 0.03, 0.03], k: 0.03 });
  // does carry a dewlap (fold of skin under the chin)
  if (doe && dom) m.ell({ tag: 'dewlap', bone: 'neck1', c: [0, 0.14, 0.114], r: [0.024, 0.02, 0.018], k: 0.02 });

  // ---------------------------------------------------------------- HEAD (head-local, see HEAD_O)
  const H = { bone: 'head' };
  const hw = params.headWidth || 1;
  m.ell({ ...H, tag: 'cranium', c: hl([0, 0.005, -0.012]), r: [0.0245 * hw, 0.024, 0.031], k: 0.02 });
  m.cone({ ...H, tag: 'nasal', a: hl([0, 0.012, -0.002]), b: hl([0, -0.009, 0.031]), ra: 0.0175 * hw, rb: 0.0128, k: 0.014 });
  for (const s of [1, -1]) {
    m.ell({ ...H, tag: 'cheek', c: hl([0.0175 * s * hw, -0.02, -0.006]), r: [0.0145, 0.0195, 0.023], k: 0.016 });
    m.ell({ ...H, tag: 'brow', c: hl([0.0125 * s, 0.013, 0.002]), r: [0.009, 0.006, 0.012], k: 0.01 });
    m.ell({ ...H, tag: 'jowl', c: hl([0.013 * s, -0.031, -0.018]), r: [0.013, 0.013, 0.017], k: 0.016 });
  }
  m.ell({ ...H, tag: 'muzzle', c: hl([0, -0.019, 0.023]), r: [0.0168, 0.0158, 0.0158], k: 0.012 });
  // eyes: lids hugging the big globes, an orbit hollow so the cheek and brow fall away to them
  for (const s of [1, -1]) sculptEyeSocket(m, EYE, HEAD_O, s, { orbit: { r: [0.0115, 0.0095, 0.006], at: [0.0, 0.0, 0.0095], k: 0.004 } });

  // snout: nose leather, split upper lip and whisker pads (twitch with the snout bone)
  const SN = { bone: 'snout', group: 'snout' };
  for (const s of [1, -1]) {
    m.ell({ ...SN, tag: 'whisker', c: hl([0.0077 * s, -0.026, 0.0315]), r: [0.0097, 0.0092, 0.0095], k: 0.006 });
    m.sphere({ ...SN, tag: 'nostril', c: hl([0.0036 * s, -0.0185, 0.0412]), rad: 0.0013, k: 0.0012, carve: true });
  }
  m.ell({ ...SN, tag: 'nose', c: hl([0, -0.0185, 0.0372]), r: [0.0064, 0.005, 0.0045], axis: norm([0, 0.45, 1]), k: 0.004 });
  // the cleft of the upper lip (hare lip): a thin groove down from the nose pad
  m.cone({ ...SN, tag: 'lipcleft', a: hl([0, -0.022, 0.0422]), b: hl([0, -0.034, 0.0378]), ra: 0.0011, rb: 0.0013, k: 0.0015, carve: true });

  // ---------------------------------------------------------------- JAW (small, set back under the upper lip)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  m.cone({ ...JW, tag: 'mandible', a: hl([0, -0.029, -0.012]), b: hl([0, -0.032, 0.021]), ra: 0.0105, rb: 0.006, k: 0 });
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.0325, 0.019]), r: [0.0066, 0.0048, 0.0065], k: 0.006 });

  // ---------------------------------------------------------------- EARS (long, spoon-shaped, thin; cup facing out and forward)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const L = Math.hypot(tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]);
    const up = norm(sub(tip, base));
    // the concave side of the pinna faces sideways and forward (lop ears: toward the cheek)
    const facing0 = params.lop ? norm([-0.3 * s, 0.0, 0.9]) : norm([0.75 * s, 0.05, 0.6]);
    const facing = norm(sub(facing0, mul(up, facing0[0] * up[0] + facing0[1] * up[1] + facing0[2] * up[2])));
    const lat = norm(cross(up, facing));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    const w = params.earWidth || 1;
    m.cone({ ...ear, tag: 'earbase', a: lerp(base, tip, -0.05), b: lerp(base, tip, 0.2), ra: 0.009, rb: 0.0085, k: 0.012 });
    ellY({ ...ear, tag: 'ear', c: lerp(base, tip, 0.52), ydir: up, lateral: lat, r: [0.0158 * w, 0.5 * L, 0.0034], k: 0.01 });
    ellY({ ...ear, tag: 'earinner', c: add(add(lerp(base, tip, 0.56), mul(facing, 0.0036)), mul(up, 0.0)), ydir: up, lateral: lat, r: [0.012 * w, 0.44 * L, 0.0028], k: 0.003, carve: true });
  }

  // ---------------------------------------------------------------- LEGS
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    // front (short, slim, digitigrade, furred soles)
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.5), sx([0.004, 0, 0])), ydir: sub(Sh, Sc), lateral: lat, r: [0.012, 0.038, 0.026], k: 0.025, bias: 0.001 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.016, rb: 0.012, k: 0.02 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.5), [0, 0, -0.008]), ydir: sub(E, Sh), lateral: lat, r: [0.012, 0.028, 0.014], k: 0.015 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: E, b: W, ra: 0.0105, rb: 0.0068, k: 0.004 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: lerp(E, W, 0.28), ydir: sub(W, E), lateral: lat, r: [0.0095, 0.02, 0.0105], k: 0.004 });
    m.sphere({ tag: 'wrist', bone: 'metacarpus' + S, group: g, c: W, rad: 0.0072, k: 0.005 });
    m.cone({ tag: 'pastern', bone: 'metacarpus' + S, group: g, a: W, b: M, ra: 0.0068, rb: 0.0066, k: 0.005 });
    const dp = norm(sub(T, M));
    ellY({ tag: 'paw', bone: 'fpaw' + S, group: g, c: add(add(M, mul(dp, 0.004)), [0, -0.0005, 0]), ydir: dp, lateral: lat, r: [0.0085, 0.0125, 0.0055], k: 0.005 });
    for (const [tx, tz] of [[-0.0055, -0.002], [-0.0019, 0.0], [0.0019, 0.0], [0.0055, -0.002]]) {
      m.sphere({ tag: 'toe', bone: 'fpaw' + S, group: g, c: [T[0] + tx * s, 0.004, T[2] - 0.004 + tz], rad: 0.0036, k: 0.003 });
    }

    // hind (long; big haunch, slim shank, long flat foot)
    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Tt = J['htoe' + S];
    // the haunch: the big thigh mass rounding out the rear half of the loaf (webs thigh and body)
    ellY({ tag: 'haunch', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.35), sx([0.006, 0.002, -0.006])), ydir: sub(K, Hp), lateral: lat, r: [0.026, 0.05, 0.038], k: 0.03, bias: 0.001 });
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.6), sx([0.008, 0, 0.0])), ydir: sub(K, Hp), lateral: lat, r: [0.019, 0.034, 0.026], k: 0.02 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: RL(sx([0.036, 0.07, -0.008])), ydir: [0, 0.2, 0.1], lateral: lat, r: [0.012, 0.028, 0.02], k: 0.025 });
    // the lower haunch: gastrocnemius and the thick fur that hides the heel when sitting
    ellY({ tag: 'haunchlow', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.5), sx([0.002, 0.012, 0.008])), ydir: sub(Hk, K), lateral: lat, r: [0.02, 0.036, 0.022], k: 0.008 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.002, 0, 0.002])), rad: 0.011, k: 0.012 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: K, b: Hk, ra: 0.0115, rb: 0.0075, k: 0.005 });
    ellY({ tag: 'calf', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.35), sx([0.002, 0.006, -0.002])), ydir: sub(Hk, K), lateral: lat, r: [0.012, 0.03, 0.014], k: 0.005 });
    m.sphere({ tag: 'heel', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.0, -0.005]), rad: 0.0095, k: 0.006 });
    m.cone({ tag: 'metatarsus', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.002, 0]), b: Mt, ra: 0.0088, rb: 0.0078, k: 0.006 });
    const dh = norm(sub(Tt, Mt));
    ellY({ tag: 'hpaw', bone: 'hpaw' + S, group: h, c: add(Mt, mul(dh, 0.01)), ydir: dh, lateral: lat, r: [0.0095, 0.0205, 0.0058], k: 0.006 });
    for (const [tx, tz] of [[-0.0055, -0.003], [-0.0019, 0.0], [0.0019, 0.0], [0.0055, -0.003]]) {
      m.sphere({ tag: 'toe', bone: 'hpaw' + S, group: h, c: [Tt[0] + tx * s, 0.0042, Tt[2] - 0.003 + tz], rad: 0.0038, k: 0.003 });
    }
  }

  // ---------------------------------------------------------------- TAIL (the scut: short, a round tuft of fur)
  m.cone({ tag: 'tailroot', bone: 'tail0', a: J.tail0, b: J.tail1, ra: 0.0095, rb: 0.0105, k: 0.008 });
  for (let i = 1; i < TAIL_SEGS; i++) {
    m.cone({ tag: 'tail', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: 0.011 - 0.002 * i, rb: 0.01 - 0.002 * i, k: 0.006 });
  }
  m.sphere({ tag: 'scut', bone: 'tail1', c: add(lerp(J.tail1, J.tail2, 0.6), [0, 0, -0.003]), rad: 0.0125, k: 0.006 });

  void eyeFrameOf;
  return m;
}
