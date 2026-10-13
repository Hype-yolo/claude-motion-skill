// The red fox, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw). The fox is
// a small, light canid made to look bigger by its fur: a slim, narrow-chested body with a tucked
// belly on long thin legs, a long narrow muzzle, big erect ears and a huge cylindrical brush. The
// winter coat is partly sculpted as volume (cheek ruff, chest fluff, the brush), the shells add the
// hair on top of it.
import { HEAD_O, TAIL_SEGS, HS, hlOf } from './rig.js';
import { add, sub, mul, lerp, norm, cross } from '../../core/math/vec.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';

// Eye geometry shared by the sculpt (lids + aperture) and the eyeball shader (head-local, left eye).
// Axial eyeball ~17.6 mm (r 8.8 mm); almond fissure ~17 x 8.5 mm, set obliquely (outer corner higher,
// ~24 deg); the eyes sit high and fairly close (~46 mm apart), diverging ~15 deg each.
export const EYE_BASE = { c: [0.035, 0.022, 0.035], r: 0.0098, back: 0.0021, yaw: 0.2, pitch: 0.05, lid: 0.0012, R: 0.012, d: 0.0062, off: -0.0006, tilt: (24 * Math.PI) / 180, irisZ: 0.006, irisR: 0.0082 };
// per individual: the eye moves with the head width (the muzzle stretch starts in front of it); kits
// have relatively bigger eyes
export const eyeOf = (params = {}) => {
  const k = params.eyeK || 1;
  return { ...EYE_BASE, c: [EYE_BASE.c[0] * (params.headW || 1) * HS, EYE_BASE.c[1] * HS, EYE_BASE.c[2] * HS], r: EYE_BASE.r * k, back: EYE_BASE.back * k, lid: EYE_BASE.lid * k, R: EYE_BASE.R * k, d: EYE_BASE.d * k, off: EYE_BASE.off * k, irisZ: EYE_BASE.irisZ * k, irisR: EYE_BASE.irisR * k };
};

const X = [1, 0, 0];

export function sculptFox(m, rig, params = {}) {
  const J = rig.J;
  const EYE = eyeOf(params);
  const mz = params.muzzle || 1, hw = params.headW || 1, ruff = params.ruff ?? 1, juv = params.juv || 0;
  const slim = params.slim ?? 1; // body girth factor (males a little heavier)
  // head-local -> reference space: width factor, and the muzzle stretched ahead of MUZZLE_Z0
  const hl = hlOf(mz, hw);
  const hr = (r) => [r[0] * hw * HS, r[1] * HS, r[2] * HS]; // radii in head space
  const eyeFrame = (s) => eyeFrameOf(EYE, HEAD_O, s);

  // Ellipsoid whose local Y follows `ydir`; radii = [lateral, along ydir, third axis]
  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };
  const sw = (r) => [r[0] * slim, r[1], r[2]];

  // ---------------------------------------------------------------- TORSO
  // narrow, keeled chest (the elbows almost touch), level back, belly tucked up behind the ribs
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 0.296, 0.1], r: sw([0.048, 0.082, 0.125]), axis: norm([0, 0.12, -1]), k: 0 });
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.24, 0.185], r: sw([0.031, 0.042, 0.065]), axis: norm([0, -0.35, 1]), k: 0.035 });
  m.ell({ tag: 'pectoral', bone: 'chest', c: [0, 0.272, 0.25], r: sw([0.034, 0.042, 0.034]), k: 0.03 });
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.372, 0.172], r: sw([0.026, 0.03, 0.075]), axis: norm([0, -0.1, 1]), k: 0.035 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 0.37, 0.03], r: sw([0.034, 0.028, 0.1]), k: 0.035 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.308, -0.045], r: sw([0.04, 0.05, 0.095]), axis: norm([0, 0.3, -1]), k: 0.04 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 0.362, -0.085], r: sw([0.031, 0.027, 0.085]), k: 0.03 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 0.318, -0.115], r: sw([0.033, 0.034, 0.055]), k: 0.03 });
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 0.333, -0.17], r: sw([0.036, 0.046, 0.065]), k: 0.035 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 0.36, -0.165], r: sw([0.028, 0.022, 0.06]), k: 0.025 });
  for (const s of [1, -1]) {
    m.ell({ tag: 'rump', bone: 'pelvis', c: [0.022 * s * slim, 0.31, -0.212], r: [0.022, 0.038, 0.028], k: 0.025 });
  }
  // shoulder fluff over the withers (sculpted coat volume)
  m.ell({ tag: 'cape', bone: 'chest', c: [0, 0.362, 0.2], r: [0.04 * slim, 0.036, 0.075], axis: norm([0, 0.25, 1]), k: 0.04 });

  // ---------------------------------------------------------------- NECK (slim, wrapped in the ruff)
  m.cone({ tag: 'neck', bone: 'neck1', a: [0, 0.312, 0.228], b: [0, 0.37, 0.278], ra: 0.043, rb: 0.035, k: 0.035 });
  m.cone({ tag: 'neck', bone: 'neck2', a: [0, 0.37, 0.278], b: [0, 0.41, 0.315], ra: 0.035, rb: 0.03, k: 0.025 });
  m.ell({ tag: 'nape', bone: 'neck1', c: [0, 0.4, 0.265], r: [0.024, 0.018, 0.058], axis: norm([0, 0.55, 1]), k: 0.025 });
  m.ell({ tag: 'throat', bone: 'neck2', c: [0, 0.34, 0.31], r: [0.025, 0.032, 0.036], axis: norm([0, 0.8, 0.6]), k: 0.04 });
  // the ruff: a fluffy collar, fullest on the white throat and chest (the "bib")
  const rf = 0.8 + 0.2 * ruff;
  m.ell({ tag: 'ruff', bone: 'neck1', c: [0, 0.335, 0.27], r: [0.042 * rf, 0.048 * rf, 0.05], axis: norm([0, 0.6, 1]), k: 0.045 });
  m.ell({ tag: 'ruff', bone: 'neck2', c: [0, 0.36, 0.312], r: [0.028 * rf, 0.026 * rf, 0.03], axis: norm([0, 0.8, 1]), k: 0.042 });

  // ---------------------------------------------------------------- HEAD (head-local coords, see HEAD_O)
  // landmarks from the profile / frontal photos (0.165 m occiput -> nose; local units x HS): nose tip
  // (0,-0.014,0.16), eyes (+-0.035, 0.022, 0.035), shallow stop ~z 0.045, chin (0,-0.058,0.13),
  // flat skull top 0.058, occiput -0.1; wide cheeks (the white cheek ruff) narrowing sharply into a
  // long, slender, pointed muzzle. Kits: domed skull, short muzzle (params)
  const H = { bone: 'head' };
  m.ell({ ...H, tag: 'cranium', c: hl([0, 0.016 + 0.008 * juv, -0.035]), r: hr([0.05 + 0.004 * juv, 0.047 + 0.01 * juv, 0.065]), k: 0.04 });
  m.ell({ ...H, tag: 'forehead', c: hl([0, 0.03 + 0.005 * juv, 0.018]), r: hr([0.033, 0.028, 0.04]), axis: norm([0, -0.3, 1]), k: 0.025 });
  for (const s of [1, -1]) {
    m.ell({ ...H, tag: 'brow', c: hl([0.029 * s, 0.036, 0.03]), r: hr([0.015, 0.008, 0.014]), k: 0.012 });
    m.ell({ ...H, tag: 'zygomatic', c: hl([0.052 * s, 0.0, -0.004]), r: hr([0.016, 0.022, 0.042]), axis: norm([-0.3 * s, 0, 1]), k: 0.025 });
    m.ell({ ...H, tag: 'cheek', c: hl([0.038 * s, -0.026, -0.004]), r: hr([0.024, 0.027, 0.04]), k: 0.025 });
    // cheek ruff: the white hair flares sideways and back below the ears (the fox's triangular face)
    m.ell({ ...H, tag: 'cheekruff', c: hl([0.064 * s, -0.034, -0.035]), r: hr([0.036 * rf, 0.044, 0.05]), axis: norm([0.4 * s, -0.1, 1]), k: 0.03 });
    m.ell({ ...H, tag: 'mastoid', c: hl([0.034 * s, -0.018, -0.064]), r: hr([0.024, 0.03, 0.03]), k: 0.03 });
    m.ell({ ...H, tag: 'lip', c: hl([0.0145 * s, -0.0435, 0.083]), r: hr([0.0088, 0.0118, 0.058]), axis: norm([-0.17 * s, -0.06, 1]), k: 0.012 });
    m.ell({ ...H, tag: 'whisker', c: hl([0.012 * s, -0.026, 0.125]), r: hr([0.0105, 0.011, 0.022]), k: 0.012 });
    // jowl: the cheek's skin runs on down over the side of the lower jaw behind the mouth corner, flush
    // with the jaw's lower line, and forward into the lip's back end (the commissure). Without it the
    // cheek ended in a flat floor above the narrow jaw, and a dark pocket ran from the mouth corner back
    // under the white cheek fur (a "hollow cheek" look)
    m.ell({ ...H, tag: 'jowl', c: hl([0.021 * s, -0.0485, 0.006]), r: hr([0.0105, 0.0095, 0.036]), axis: norm([-0.2 * s, -0.06, 1]), k: 0.014 });
    // buccal: the side of the face tapers from the cheek into the upper lip (the cheek's front met the
    // narrow lip in a tight crease right behind the mouth corner: a shadowed pocket)
    m.ell({ ...H, tag: 'buccal', c: hl([0.027 * s, -0.036, 0.035]), r: hr([0.011, 0.014, 0.036]), axis: norm([-0.35 * s, -0.05, 1]), k: 0.014 });
  }
  // long, slender muzzle with a straight nasal bridge
  m.cone({ ...H, tag: 'nasal', a: hl([0, 0.027, 0.052]), b: hl([0, 0.004, 0.145]), ra: 0.0125 * hw, rb: 0.0078 * hw, k: 0.014 });
  m.ell({ ...H, tag: 'muzzle', c: hl([0, -0.018, 0.088]), r: hr([0.02, 0.023, 0.064]), axis: norm([0, -0.12, 1]), k: 0.016 });
  m.ell({ ...H, tag: 'nose', c: hl([0, -0.006, 0.152]), r: hr([0.0135, 0.0105, 0.01]), axis: norm([0, 0.4, 1]), k: 0.006 });
  m.ell({ ...H, tag: 'philtrum', c: hl([0, -0.029, 0.147]), r: hr([0.008, 0.011, 0.008]), k: 0.007 });
  for (const s of [1, -1]) {
    const ef = eyeFrame(s);
    const at = (u, v, w) => add(add(add(ef.c, mul(ef.x, u)), mul(ef.y, v)), mul(ef.z, w));
    // orbit: a soft hollow so brow, cheek and bridge fall away to the lids
    ellY({ ...H, tag: 'orbit', c: at(-0.0015 * s, -0.0004, 0.0142), ydir: ef.y, lateral: ef.x, r: [0.0135, 0.0094, 0.0068], k: 0.006, carve: true });
    m.sphere({ ...H, tag: 'eyelid', c: ef.c, rad: EYE.r + EYE.lid, k: 0.004 });
    m.lens({ ...H, tag: 'eyesocket', c: add(ef.c, mul(ef.y, EYE.off)), x: ef.x, y: ef.y, z: ef.z, R: EYE.R, d: EYE.d, zMin: -0.0015, zMax: 0.018, k: 0.0016, carve: true });
    m.sphere({ ...H, tag: 'nostril', c: hl([0.0072 * s, -0.009, 0.161]), rad: 0.0023, k: 0.0014, carve: true });
    // upper canine, hidden behind the lip and inside the closed jaw; shows when the mouth opens
    m.cone({ ...H, tag: 'canine', a: hl([0.0085 * s, -0.036, 0.118]), b: hl([0.008 * s, -0.047, 0.116]), ra: 0.0022, rb: 0.0007, k: 0.0014 });
  }

  // ---------------------------------------------------------------- JAW (separate surface so the mouth can open)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  m.cone({ ...JW, tag: 'mandible', a: hl([0, -0.05, -0.015]), b: hl([0, -0.054, 0.108]), ra: 0.0078, rb: 0.0038, k: 0 });
  for (const s of [1, -1]) {
    m.cone({ ...JW, tag: 'mandible', a: hl([0.025 * s, -0.044, -0.03]), b: hl([0.004 * s, -0.052, 0.105]), ra: 0.0058, rb: 0.0033, k: 0.013 });
  }
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.055, 0.1]), r: hr([0.0085, 0.0068, 0.011]), k: 0.01 });

  // ---------------------------------------------------------------- EARS
  // big, erect, triangular: broad at the base, pointed tip, deeply cupped front; thin
  const ek = params.ear || 1;
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const up = norm(sub(tip, base));
    const facing = norm([0.45 * s, 0.1, 1]);
    const lat = norm(cross(up, facing));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    const at = (t) => lerp(base, tip, t);
    const w = ek * (1 + 0.1 * juv);
    ellY({ ...ear, tag: 'ear', c: at(0.2), ydir: up, lateral: lat, r: [0.034 * w, 0.032 * ek, 0.0068], k: 0.009 });
    ellY({ ...ear, tag: 'ear', c: at(0.52), ydir: up, lateral: lat, r: [0.023 * w, 0.03 * ek, 0.0048], k: 0.009 });
    ellY({ ...ear, tag: 'ear', c: at(0.83), ydir: up, lateral: lat, r: [0.009 * w, 0.021 * ek, 0.0034], k: 0.007 });
    ellY({ ...ear, tag: 'earinner', c: add(at(0.34), mul(facing, 0.0062)), ydir: up, lateral: lat, r: [0.023 * w, 0.031 * ek, 0.0045], k: 0.003, carve: true });
    ellY({ ...ear, tag: 'earinner', c: add(at(0.66), mul(facing, 0.0045)), ydir: up, lateral: lat, r: [0.012 * w, 0.023 * ek, 0.0032], k: 0.0022, carve: true });
  }

  // ---------------------------------------------------------------- LEGS
  // long, thin legs; small neat paws; elbows tucked in under the narrow chest
  const bk = params.boneK || 1;
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.5), sx([0.004, 0, 0])), ydir: sub(Sh, Sc), lateral: lat, r: [0.014, 0.055, 0.032], k: 0.035, bias: 0.002 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.021, rb: 0.015, k: 0.035 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), [0, 0, -0.016]), ydir: sub(E, Sh), lateral: lat, r: [0.016, 0.04, 0.019], k: 0.028 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.004, -0.012]), rad: 0.0095, k: 0.011 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: E, b: W, ra: 0.0155 * bk, rb: 0.0095 * bk, k: 0.014 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.25), sx([0.0015, 0, 0.002])), ydir: sub(W, E), lateral: lat, r: [0.0135, 0.036, 0.0155], k: 0.016 });
    m.sphere({ tag: 'wrist', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0, -0.0015]), rad: 0.0095 * bk, k: 0.007 });
    m.sphere({ tag: 'carpalpad', bone: 'metacarpus' + S, group: g, c: add(W, [0, -0.004, -0.0095]), rad: 0.0045, k: 0.005 });
    m.cone({ tag: 'pastern', bone: 'metacarpus' + S, group: g, a: W, b: M, ra: 0.0088 * bk, rb: 0.009 * bk, k: 0.007 });
    m.sphere({ tag: 'dewclaw', bone: 'metacarpus' + S, group: g, c: add(lerp(W, M, 0.3), sx([-0.008, 0, 0.001])), rad: 0.003, k: 0.003 });
    const dp = norm(sub(T, M));
    const pk = params.pawK || 1;
    // small oval forefoot (print ~5.5 x 4.5 cm)
    ellY({ tag: 'paw', bone: 'fpaw' + S, group: g, c: add(add(M, mul(dp, 0.011)), [0, -0.003, 0]), ydir: dp, lateral: lat, r: [0.0145 * pk, 0.02 * pk, 0.0095], k: 0.008 });
    m.sphere({ tag: 'pad', bone: 'fpaw' + S, group: g, c: add(M, [0, -0.0125, 0.006]), rad: 0.0065 * pk, k: 0.006 });
    const toeX = [-0.0105, -0.0036, 0.0036, 0.0105].map((x) => x * pk), toeZ = [-0.0055, 0, 0, -0.0055].map((z) => z * pk);
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'fpaw' + S, group: g, c: [T[0] + toeX[i] * s, 0.0061 * pk, T[2] - 0.0045 + toeZ[i]], rad: 0.0058 * pk, k: 0.004 });
    for (let i = 0; i < 4; i++) m.cone({ tag: 'claw', bone: 'fpaw' + S, group: g, a: [T[0] + toeX[i] * s * 0.95, 0.0055, T[2] + toeZ[i]], b: [T[0] + toeX[i] * s * 0.95, 0.002, T[2] + 0.0055 + toeZ[i]], ra: 0.0016, rb: 0.0006, k: 0.001 });

    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Tt = J['htoe' + S];
    // muscular thigh (the fox's hind legs are its jumping engine), long hair behind
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.4), sx([0.002, 0, -0.016])), ydir: sub(K, Hp), lateral: lat, r: [0.022, 0.078, 0.05], k: 0.03, bias: 0.002 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.021, 0.325, -0.1]), b: add(K, sx([-0.002, 0.029, 0.0])), ra: 0.02, rb: 0.0125, k: 0.035 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.024, 0.325, -0.212]), b: add(lerp(K, Hk, 0.28), [0, 0, -0.016]), ra: 0.024, rb: 0.0145, k: 0.024 });
    ellY({ tag: 'breeches', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.62), sx([0.003, -0.005, -0.045])), ydir: sub(K, Hp), lateral: lat, r: [0.016, 0.043, 0.016], k: 0.02 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.026, 0.26, -0.08]), ydir: [-0.03, 0.16, 0.1], lateral: lat, r: [0.0105, 0.043, 0.021], k: 0.035 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.001, 0.004, 0.003])), rad: 0.009, k: 0.022 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.06), sx([0.0, 0.0, 0.002])), b: Hk, ra: 0.0122 * bk, rb: 0.0085 * bk, k: 0.017 });
    ellY({ tag: 'calf', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.001, 0.005, -0.0145])), ydir: sub(Hk, K), lateral: lat, r: [0.0132, 0.038, 0.016], k: 0.019 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.5), [0, 0.005, -0.018]), b: add(Hk, [0, 0.006, -0.0155]), ra: 0.0062, rb: 0.0058, k: 0.008 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.006, -0.013]), rad: 0.0078, k: 0.0065 });
    m.sphere({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: Hk, rad: 0.0102 * bk, k: 0.0065 });
    m.cone({ tag: 'metatarsus', bone: 'metatarsus' + S, group: h, a: Hk, b: Mt, ra: 0.0088 * bk, rb: 0.0086 * bk, k: 0.0065 });
    const dh = norm(sub(Tt, Mt));
    ellY({ tag: 'paw', bone: 'hpaw' + S, group: h, c: add(add(Mt, mul(dh, 0.01)), [0, -0.003, 0]), ydir: dh, lateral: lat, r: [0.013 * pk, 0.0185 * pk, 0.009], k: 0.008 });
    m.sphere({ tag: 'pad', bone: 'hpaw' + S, group: h, c: add(Mt, [0, -0.0125, 0.005]), rad: 0.006 * pk, k: 0.006 });
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'hpaw' + S, group: h, c: [Tt[0] + toeX[i] * 0.92 * s, 0.0058 * pk, Tt[2] - 0.0045 + toeZ[i]], rad: 0.0054 * pk, k: 0.004 });
    for (let i = 0; i < 4; i++) m.cone({ tag: 'claw', bone: 'hpaw' + S, group: h, a: [Tt[0] + toeX[i] * 0.88 * s, 0.005, Tt[2] + toeZ[i]], b: [Tt[0] + toeX[i] * 0.88 * s, 0.002, Tt[2] + 0.005 + toeZ[i]], ra: 0.0015, rb: 0.0006, k: 0.001 });
  }

  // ---------------------------------------------------------------- TAIL
  // the brush: a huge, round, cylindrical tail, thick almost to the end and rounded off at the white
  // tip (the long guard hair is carried partly by this volume, partly by the shells)
  const tb = params.tailBrush ?? 1;
  const tailR = (t) => tb * (t < 0.15 ? 0.021 + (0.027 - 0.021) * (t / 0.15) : t < 0.55 ? 0.027 + (0.033 - 0.027) * ((t - 0.15) / 0.4) : 0.033 - 0.017 * Math.pow((t - 0.55) / 0.45, 1.8));
  m.cone({ tag: 'tailroot', bone: 'tail0', a: [0, 0.342, -0.175], b: J.tail1, ra: 0.02, rb: tailR(0.1), k: 0.022 });
  for (let i = 0; i < TAIL_SEGS; i++) {
    m.cone({ tag: 'tail', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: tailR(i / TAIL_SEGS), rb: tailR((i + 1) / TAIL_SEGS), k: 0.008, thin: i >= TAIL_SEGS - 1 });
  }

  return m;
}
