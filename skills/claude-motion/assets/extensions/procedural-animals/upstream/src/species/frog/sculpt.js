// The frog, sculpted as a signed distance field around the sitting bind pose (rig.js).
// Every primitive is attached to a bone (skinning) and a group (axial / limb / eye / throat / jaw /
// tongue). Head primitives are placed in head-local coordinates (HEAD_O: midline, level with the eye
// centres), measured from the profile, front and dorsal reference photos.
//
// Anatomy: no neck; a broad flat head wider than long with a huge mouth line running back to below
// the tympanum; large bulging eyes on top of the head; a big round tympanum behind each eye (larger
// than the eye in males) under the supratympanic fold; a plump trunk rising from the vent to the
// sacral hump; short forelimbs with four slender fingers; very long hind limbs (heavy thigh,
// tibiofibula, elongated tarsus, long foot with five webbed toes). Common frog variant: dorsolateral
// folds along the back.
import { HEAD_O, hl, EYE_C } from './rig.js';
import { add, sub, mul, lerp, norm, cross, dot } from '../../core/math/vec.js';
import { sculptEyeSocket } from '../../core/sdf/eyeSocket.js';
import { SDFModel } from '../../core/sdf/sdf.js';

// Large bulging eye: globe radius 7.2 mm (visible eye ~14-15 mm at SVL 140 mm), looking out ~57 deg
// and up ~24 deg; a wide, nearly round aperture (no sclera), thick upper lid.
export const EYE = {
  c: EYE_C, r: 0.0079, back: 0, yaw: 1.0, pitch: 0.42, lid: 0.0013,
  R: 0.0081, d: 0.0009, off: 0.0006, tilt: (6 * Math.PI) / 180, irisZ: 0.0052, irisR: 0.0071,
};

const X = [1, 0, 0];

// A carved slot in the fold of a joint J between the segments toward A and toward B: a thin slab in
// the plane of the joint's hinge axis and the bisector of the two segments, from `start` (m from the
// joint) out to `len`.
function foldSlot(m, Jt, A, Bp, start, len, tag, bone, group) {
  const a = norm(sub(A, Jt)), b = norm(sub(Bp, Jt));
  const bis = norm(add(a, b)), axis = norm(cross(a, b));
  m.fin({ tag, bone, group, o: add(Jt, mul(bis, start)), u: bis, v: axis, poly: [[0, -0.02], [len, -0.02], [len, 0.02], [0, 0.02]], t: 0.0026, round: 0.0012, k: 0.0006, carve: true });
}

// point where the ray p + t dir (t in -2..2 cm) crosses the body surface sculpted so far
function surfaceAlong(m, p, dir) {
  const prims = m.prims.filter((q) => q.part === 'body');
  const f = (t) => SDFModel.evalList(prims, p[0] + dir[0] * t, p[1] + dir[1] * t, p[2] + dir[2] * t);
  let lo = -0.02, hi = 0.02;
  for (let i = 0; i < 40; i++) { const mid = 0.5 * (lo + hi); if (f(mid) < 0) lo = mid; else hi = mid; }
  return add(p, mul(dir, 0.5 * (lo + hi)));
}

// tympanum (head-local, left): centre, outward normal, radius by sex
export function tympanum(params = {}) {
  const male = params.sex === 'male';
  const r = (params.tympanum || (male ? 0.0105 : 0.0074)) * (params.variant === 'common-frog' ? 0.78 : 1);
  return { c: [0.0262, -0.0085, -0.0235], n: norm([1, 0.12, -0.25]), r };
}

export function sculptFrog(m, rig, params = {}) {
  const J = rig.J;
  const male = params.sex === 'male';
  const temporaria = params.variant === 'common-frog';
  const plump = params.plump || 1;

  // Ellipsoid whose local Y follows `ydir`; radii = [lateral, along ydir, third axis]
  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };

  // ---------------------------------------------------------------- TRUNK (vent low, sacral hump, plump belly)
  const bodyAx = norm([0, 0.22, 1]);
  m.ell({ tag: 'trunk', bone: 'spine2', c: ([0, 0.0375, -0.012]), r: [0.032 * plump, 0.0205, 0.037], axis: bodyAx, k: 0 });
  m.ell({ tag: 'chest', bone: 'chest', c: [0, 0.041, 0.012], r: [0.026 * plump, 0.0185, 0.02], axis: bodyAx, k: 0.012 });
  m.ell({ tag: 'shoulders', bone: 'chest', c: [0, 0.049, 0.015], r: [0.024, 0.012, 0.016], k: 0.012 });
  m.ell({ tag: 'belly', bone: 'spine2', c: ([0, 0.027, -0.016]), r: [0.031 * plump, 0.0135, 0.03], axis: norm([0, 0.3, 1]), k: 0.014 });
  m.ell({ tag: 'hump', bone: 'pelvis', c: ([0, 0.041, -0.033]), r: [0.022, 0.0165, 0.017], k: 0.012 });
  m.ell({ tag: 'rump', bone: 'pelvis', c: ([0, 0.027, -0.046]), r: [0.0175, 0.0155, 0.0135], axis: norm([0, 0.5, 1]), k: 0.012 });
  // the vent: a slight crease at the back of the rump
  m.ell({ tag: 'vent', bone: 'pelvis', c: ([0, 0.016, -0.059]), r: [0.004, 0.0022, 0.004], k: 0.002, carve: true });

  // ---------------------------------------------------------------- HEAD (head-local, see HEAD_O)
  const H = { bone: 'head' };
  const hw = params.headWidth || 1;
  m.ell({ ...H, tag: 'cranium', c: hl([0, -0.01, -0.008]), r: [0.0268 * hw, 0.0105, 0.03], k: 0.012 });
  m.ell({ ...H, tag: 'snout', c: hl([0, -0.0115, 0.013]), r: [0.019 * hw, 0.0088, 0.027], k: 0.01 });
  // the canthus: a soft ridge from the eye to the nostril, the flat loreal region below it
  for (const s of [1, -1]) {
    m.cone({ ...H, tag: 'canthus', a: hl([0.0105 * s, -0.0028, 0.006]), b: hl([0.0052 * s, -0.0045, 0.0305]), ra: 0.0028, rb: 0.0018, k: 0.005 });
    // cheeks and the corners of the jaw (the head is widest here)
    m.ell({ ...H, tag: 'cheek', c: hl([0.0205 * s * hw, -0.0145, -0.017]), r: [0.0095, 0.0092, 0.0145], k: 0.009 });
    m.ell({ ...H, tag: 'lipwall', c: hl([0.0165 * s * hw, -0.0142, 0.002]), r: [0.0075, 0.0048, 0.028], axis: norm([-0.32 * s, 0, 1]), k: 0.008 });
    m.ell({ ...H, tag: 'temple', c: hl([0.02 * s * hw, -0.0065, -0.028]), r: [0.009, 0.008, 0.011], k: 0.008 });
    // nostrils: small raised rims with the opening carved
    m.sphere({ ...H, tag: 'naris', c: hl([0.0056 * s, -0.0048, 0.0318]), rad: 0.0019, k: 0.0025 });
    m.sphere({ ...H, tag: 'nostril', c: hl([0.0058 * s, -0.0035, 0.0322]), rad: 0.0009, k: 0.0006, carve: true });
    // tympanum: a flat disc set a little into the side of the head, with a low rim
    const T = tympanum(params);
    const tc = [T.c[0] * s, T.c[1], T.c[2]], tn = [T.n[0] * s, T.n[1], T.n[2]];
    // (placed on the surface sculpted so far: a flat disc 0.35 mm below it at its centre)
    const ts = surfaceAlong(m, hl(tc), tn);
    m.ell({ ...H, tag: 'tympanum', c: add(ts, mul(tn, 0.0019 - 0.00035)), r: [T.r, T.r, 0.0019], axis: tn, k: 0.0012, carve: true });
    // supratympanic fold: from behind the eye over the tympanum and down behind it to the shoulder
    const f0 = hl([0.0142 * s, 0.0012, -0.0095]), f1 = hl([0.0228 * s, -0.001, -0.0245]);
    const f2 = hl([0.0268 * s, -0.0075, -0.037]), f3 = [0.024 * s, 0.037, 0.018];
    m.cone({ ...H, tag: 'stfold', a: f0, b: f1, ra: 0.0017, rb: 0.0021, k: 0.004 });
    m.cone({ ...H, tag: 'stfold', a: f1, b: f2, ra: 0.0021, rb: 0.002, k: 0.004 });
    m.cone({ tag: 'stfold', bone: 'chest', a: f2, b: f3, ra: 0.002, rb: 0.0015, k: 0.005 });
    // eyes: bulging lids on their own bone (they retract into the head to blink)
    const n0 = m.prims.length;
    sculptEyeSocket(m, EYE, HEAD_O, s, { bone: 'eye' + (s > 0 ? 'L' : 'R'), orbit: { r: [0.0085, 0.006, 0.004], at: [0, -0.001, 0.007], k: 0.003 } });
    for (const p of m.prims.slice(n0)) p.group = 'eye' + (s > 0 ? 'L' : 'R');
    // the fleshy base of the eye bulge (a turret the globe sits in), on the eye bone
    const ec = hl([EYE_C[0] * s, EYE_C[1], EYE_C[2]]);
    m.ell({ tag: 'eyebase', bone: 'eye' + (s > 0 ? 'L' : 'R'), group: 'eye' + (s > 0 ? 'L' : 'R'), c: add(ec, [0.0005 * s, -0.004, -0.0005]), r: [0.0075, 0.005, 0.0082], k: 0.006 });
  }
  // the mouth: the upper jaw's underside is cut flat along the lip line (the lower jaw is its own part)
  m.ell({ ...H, tag: 'palate', c: hl([0, -0.028, 0.005]), r: [0.05, 0.0115, 0.06], axis: norm([0, 0.04, 1]), k: 0.0008, carve: true });

  // ---------------------------------------------------------------- LOWER JAW (rigid, meshed separately)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  m.ell({ ...JW, tag: 'mandible', c: hl([0, -0.0185, 0.004]), r: [0.0232 * hw, 0.0066, 0.028], k: 0 });
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.0188, 0.0255]), r: [0.0105, 0.0055, 0.0068], k: 0.006 });
  for (const s of [1, -1]) m.ell({ ...JW, tag: 'jawcorner', c: hl([0.0195 * s * hw, -0.0188, -0.017]), r: [0.0062, 0.0062, 0.0105], k: 0.006 });

  // ---------------------------------------------------------------- THROAT (buccal floor and vocal sac: the throat bone)
  const TH = { bone: 'throat', group: 'throat' };
  m.ell({ ...TH, tag: 'throat', c: [0, 0.0355, 0.036], r: [0.0205, 0.0082, 0.019], k: 0.012 });
  m.ell({ ...TH, tag: 'gular', c: [0, 0.0335, 0.022], r: [0.0195, 0.0095, 0.012], k: 0.012 });

  // ---------------------------------------------------------------- TONGUE (rigid, attached at the front of the jaw)
  m.cone({ bone: 'tongue', group: 'tongue', part: 'tongue', tag: 'tongue', a: J.tongueBase, b: lerp(J.tongueBase, J.tongueTip, 0.82), ra: 0.0028, rb: 0.0048, k: 0 });
  m.ell({ bone: 'tongue', group: 'tongue', part: 'tongue', tag: 'tonguetip', c: lerp(J.tongueBase, J.tongueTip, 0.88), r: [0.0068, 0.0032, 0.0055], k: 0.003 });

  // ---------------------------------------------------------------- DORSOLATERAL FOLDS (common frog)
  if (temporaria) {
    for (const s of [1, -1]) {
      const pts = [hl([0.0125 * s, 0.0005, -0.012]), [0.0165 * s, 0.059, 0.013], [0.0175 * s, 0.0565, -0.008], [0.0165 * s, 0.054, -0.026], [0.0135 * s, 0.047, -0.042]];
      const bones = ['head', 'chest', 'spine3', 'spine2'];
      for (let i = 0; i < 4; i++) m.cone({ tag: 'dlfold', bone: bones[i], a: pts[i], b: pts[i + 1], ra: 0.0016, rb: 0.0016, k: 0.004 });
    }
  }

  // ---------------------------------------------------------------- LEGS
  const arm = (male ? 1.18 : 1) * (params.armK || 1);
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    // ---- front: short, upright, four slender fingers
    const g = 'F' + S;
    const Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], T = J['ftoe' + S];
    ellY({ tag: 'armpit', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.3), sx([-0.003, 0.002, 0.002])), ydir: sub(E, Sh), lateral: lat, r: [0.0075, 0.012, 0.0075], k: 0.01 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.0062 * arm, rb: 0.0048 * arm, k: 0.008 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: E, b: W, ra: 0.0048 * arm, rb: 0.0031, k: 0.003 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: lerp(E, W, 0.3), ydir: sub(W, E), lateral: lat, r: [0.0046 * arm, 0.0085, 0.0048 * arm], k: 0.003 });
    const dp = norm(sub(M, W)), up = [0, 1, 0];
    ellY({ tag: 'palm', bone: 'metacarpus' + S, group: g, c: lerp(W, M, 0.55), ydir: dp, lateral: norm(cross(dp, up)), r: [0.0045, 0.0068, 0.0022], k: 0.003 });
    // fingers fan out from the palm: III longest, pointing forward and in; I (thumb) inside
    const fdir = norm(sub(T, M));
    // [angle from straight ahead (rad, + outward), length]
    const FING = [[-0.95, 0.0105, 1], [-0.62, 0.0135, 1], [-0.3, 0.0184, 1], [0.08, 0.0128, 1]];
    for (let i = 0; i < 4; i++) {
      const [a, L] = FING[i];
      const d = norm([s * Math.sin(a), fdir[1], Math.cos(a)]);
      const base = add(M, mul(d, -0.001));
      const tip = add(base, mul(d, L));
      tip[1] = 0.0014;
      m.cone({ tag: 'finger', bone: 'fpaw' + S, group: g, a: base, b: tip, ra: 0.0017, rb: 0.0011, k: 0.0015 });
      m.sphere({ tag: 'fingertip', bone: 'fpaw' + S, group: g, c: tip, rad: 0.00135, k: 0.001 });
      // male: dark nuptial pad on the thumb
      if (i === 0 && male) m.ell({ tag: 'nuptial', bone: 'fpaw' + S, group: g, c: lerp(base, tip, 0.3), r: [0.0022, 0.0022, 0.003], axis: d, k: 0.002 });
    }

    // ---- hind: heavy thigh, tibiofibula, long tarsus, long webbed foot
    const h = 'H' + S;
    const hs = params.splitHind !== true ? h : h + 's', hf = params.splitHind !== true ? h : h + 'f';
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Tt = J['htoe' + S];
    // web between thigh and body (spans limb and body)
    ellY({ tag: 'groin', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.22), sx([-0.002, 0.004, 0])), ydir: sub(K, Hp), lateral: lat, r: [0.0095, 0.016, 0.0095], k: 0.012, bias: 0.001 });
    // thigh: a thick muscle mass (the widest part of the hind limb), tapering to the knee
    m.cone({ tag: 'thigh', bone: 'femur' + S, group: h, a: Hp, b: K, ra: 0.0105, rb: 0.0058, k: 0.004 });
    ellY({ tag: 'thighmuscle', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.42), sx([0.0015, 0.0022, 0.0])), ydir: sub(K, Hp), lateral: lat, r: [0.0128, 0.026, 0.0118], k: 0.0025 });
    // shank: the calf bulges near the knee, slim toward the ankle (small blend with the thigh so the
    // two stay separate when the leg extends)
    m.sphere({ tag: 'kneecap', bone: 'tibia' + S, group: hs, c: K, rad: 0.0046, k: 0.005 });
    m.cone({ tag: 'shank', bone: 'tibia' + S, group: hs, a: K, b: Hk, ra: 0.0056, rb: 0.0036, k: 0.006 });
    ellY({ tag: 'calf', bone: 'tibia' + S, group: hs, c: add(lerp(K, Hk, 0.36), sx([0.0012, 0.0006, 0])), ydir: sub(Hk, K), lateral: lat, r: [0.0066, 0.0185, 0.0064], k: 0.006 });
    // the folds between thigh and shank and between shank and tarsus: in the Z-folded sit the segments
    // lie pressed together; a narrow slot down to near each joint keeps their skins apart (each wall
    // rides its own bone), so the legs straighten in a leap without stretching a web of skin across
    // the fold
    if (params.foldSlots !== false) foldSlot(m, K, Hp, Hk, 0.0045, 0.038, 'kneefold', 'tibia' + S, h);
    if (params.foldSlots !== false) foldSlot(m, Hk, K, Mt, 0.0035, 0.024, 'anklefold', 'metatarsus' + S, h);
    // tarsus (the frog's extra long segment) and the heel
    m.sphere({ tag: 'heel', bone: 'metatarsus' + S, group: hf, c: Hk, rad: 0.0038, k: 0.004 });
    m.cone({ tag: 'tarsus', bone: 'metatarsus' + S, group: hf, a: Hk, b: Mt, ra: 0.0036, rb: 0.0031, k: 0.004 });
    // foot: five long toes fanning out, IV longest; webbing to near the tips (not IV's last phalanges)
    const fd = norm(sub(Tt, Mt));
    const fl = norm(cross(fd, [0, 1, 0])); // toward the midline for the left foot? (fd x up)
    const inward = mul(fl, dot(fl, [s, 0, 0]) > 0 ? -1 : 1); // unit vector toward the midline
    // [angle from straight ahead (rad, + outward), length from the tarsus (m)]: I-V, IV longest
    const TOES = [[-0.08, 0.021], [0.1, 0.031], [0.28, 0.043], [0.52, 0.07], [0.74, 0.042]];
    const rot = (a) => { // rotate fd about y, + turns outward
      const c = Math.cos(a), sn = Math.sin(a);
      return norm(add(mul(fd, c), mul(inward, -sn)));
    };
    const base0 = add(Mt, mul(fd, 0.004));
    const tips = [];
    m.ell({ tag: 'sole', bone: 'hpaw' + S, group: hf, c: add(Mt, mul(fd, 0.009)), r: [0.0052, 0.0028, 0.0105], axis: fd, k: 0.003 });
    for (let i = 0; i < 5; i++) {
      const [a, lk] = TOES[i];
      const d = rot(a);
      const b = add(base0, mul(d, 0.004));
      const tip = add(b, mul(d, lk - 0.008));
      tip[1] = 0.0017;
      tips.push({ b, tip, d });
      m.cone({ tag: 'toe', bone: 'hpaw' + S, group: hf, a: add(Mt, mul(d, 0.002)), b: tip, ra: 0.0024, rb: 0.0013, k: 0.002 });
      m.sphere({ tag: 'toetip', bone: 'hpaw' + S, group: hf, c: tip, rad: 0.0015, k: 0.0008 });
    }
    // web: a thin membrane in the plane of the foot, its free margin notched between the toes
    {
      const o = [Mt[0], Mt[1] - 0.0024, Mt[2]];
      const un = norm(sub([Tt[0], 0.0019, Tt[2]], o));
      const v = norm(cross([0, 1, 0], un)); // lateral in-plane axis (points to the animal's left for fd forward)
      const to2 = (p) => { const q = sub(p, o); return [dot(q, un), dot(q, v)]; };
      const poly = [to2(add(Mt, mul(fd, -0.002)))];
      const webTo = [0.92, 0.9, 0.86, 0.7, 0.92];
      const P2 = tips.map((t, i) => to2(lerp(t.b, t.tip, webTo[i])));
      // order the toes by their in-plane angle so the outline does not cross itself
      const order = [0, 1, 2, 3, 4].sort((a, b) => Math.atan2(P2[a][1], P2[a][0]) - Math.atan2(P2[b][1], P2[b][0]));
      for (let k = 0; k < order.length; k++) {
        const i = order[k];
        poly.push(P2[i]);
        if (k < order.length - 1) {
          // concave margin between two toes: back toward the base
          const j = order[k + 1];
          const mid = [(P2[i][0] + P2[j][0]) * 0.5, (P2[i][1] + P2[j][1]) * 0.5];
          poly.push([mid[0] * 0.8, mid[1] * 0.8]);
        }
      }
      m.fin({ tag: 'web', bone: 'hpaw' + S, group: hf, o, u: un, v, poly, t: 0.0014, k: 0.0018, thin: true });
    }
  }
  return m;
}
