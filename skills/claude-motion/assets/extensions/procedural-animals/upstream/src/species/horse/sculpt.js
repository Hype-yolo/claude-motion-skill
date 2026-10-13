// The horse, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw).
// The head is modelled in its own frame (see rig.js: hl()), measured from the profile and frontal
// references; the body relative to the joints so the sculpt follows the skeleton.
import { HEAD_O, HZ, HY, hl, TAIL_SEGS, DOCK_SEGS } from './rig.js';
import { add, sub, mul, lerp, norm, cross, len, rng } from '../../core/math/vec.js';
import { sculptEyeSocket, apertureTiltAlong } from '../../core/sdf/eyeSocket.js';
import { SDFModel } from '../../core/sdf/sdf.js';

// Eye (head-local centre -> world offset from HEAD_O). The horse eye is among the largest of land
// mammals: globe ~50 mm across, palpebral opening ~45 x 30 mm, set on the side of the head and
// looking out and a little forward and down.
const EYE_LOCAL = [0.092, -0.004, -0.01]; // (large, high on the head; bulging a little under the brow)
const eyeDir = (() => {
  // lateral, 22 degrees forward along the nasal line
  const a = (22 * Math.PI) / 180;
  return norm(add([Math.cos(a), 0, 0], mul(HZ, Math.sin(a))));
})();
const EYE_BASE = {
  c: sub(hl(EYE_LOCAL), HEAD_O), r: 0.026, back: 0.005, yaw: Math.atan2(eyeDir[0], eyeDir[2]), pitch: Math.asin(eyeDir[1]),
  lid: 0.0026, R: 0.0262, d: 0.0133, off: -0.0015, tilt: 0, irisZ: 0.0137, irisR: 0.0182,
};
// roll the almond so its long axis follows the nasal line with the upper lid up (a search over a
// limited range stood the almond on end: -99 deg, lids and blinks facing the ear), inner corner a
// little lower: the slit runs ~27 deg below horizontal toward the nose, as in head_profile.jpg
EYE_BASE.tilt = apertureTiltAlong(EYE_BASE, HEAD_O, HZ) - 0.12;
export const EYE = EYE_BASE;

const X = [1, 0, 0];

export function sculptHorse(m, rig, params = {}) {
  const J = rig.J;
  const crest = params.crest ?? 0.3; // 0 mare .. 1 stallion
  const foal = params.age === 'juvenile';
  const R = rng(9173 + (params.coatSeed || 0));

  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };
  // ellipsoid in head-local coordinates: r = [lateral, dorsal, along the head]
  const H = { bone: 'head' };
  const hell = (o) => m.ell({ ...H, ...o, c: hl(o.c), axis: o.axisL ? norm(hdir(o.axisL)) : HZ, up: o.upL ? norm(hdir(o.upL)) : HY });
  const hdir = (v) => [v[0], v[1] * HY[1] + v[2] * HZ[1], v[1] * HY[2] + v[2] * HZ[2]];

  // ---------------------------------------------------------------- TORSO
  // barrel: deep chest (girth ~1.95 m), sternum ~0.88 m above the ground, belly slightly lower
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 1.26, 0.14], r: [0.285, 0.345, 0.56], axis: norm([0, 0.06, 1]), k: 0 });
  m.ell({ tag: 'girth', bone: 'chest', c: [0, 1.22, 0.46], r: [0.24, 0.29, 0.2], k: 0.08 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 1.25, -0.16], r: [0.29, 0.29, 0.32], axis: norm([0, 0.16, -1]), k: 0.1 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 1.32, -0.38], r: [0.26, 0.22, 0.22], k: 0.1 });
  // withers: the dorsal spines of T3-T9 make a sharp ridge between the scapulae
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 1.5, 0.44], r: [0.075, 0.12, 0.22], axis: norm([0, -0.2, 1]), k: 0.1 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 1.46, 0.08], r: [0.17, 0.085, 0.36], k: 0.1 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 1.48, -0.3], r: [0.2, 0.08, 0.22], k: 0.1 });
  // hindquarters: croup, points of hip, buttocks
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 1.41, -0.6], r: [0.27, 0.21, 0.26], k: 0.08 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 1.5, -0.58], r: [0.2, 0.09, 0.27], axis: norm([0, -0.12, 1]), k: 0.08 });
  for (const s of [1, -1]) {
    m.sphere({ tag: 'hippoint', bone: 'pelvis', c: [0.235 * s, 1.44, -0.43], rad: 0.065, k: 0.08 });
    m.ell({ tag: 'rump', bone: 'pelvis', c: [0.13 * s, 1.33, -0.72], r: [0.13, 0.19, 0.12], k: 0.08 });
  }
  // chest front: the pectorals make a broad, rounded breast between the forelegs
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 1.08, 0.64], r: [0.17, 0.16, 0.17], k: 0.08 });
  for (const s of [1, -1]) {
    m.ell({ tag: 'pectoral', bone: 'chest', c: [0.105 * s, 1.07, 0.75], r: [0.1, 0.14, 0.09], k: 0.07 });
  }
  if (params.sex === 'male') {
    // sheath between the hind legs
    m.ell({ tag: 'sheath', bone: 'spine1', c: [0, 0.94, -0.2], r: [0.045, 0.055, 0.1], axis: norm([0, 0.3, 1]), k: 0.05 });
  }

  // ---------------------------------------------------------------- NECK
  // laterally flattened, deep at the base, rising to the poll; crest heavier in stallions
  // The neck runs from its base (withers top 1.63 m / chest front 0.86 m) to the head (poll /
  // throat latch), arched along the crest, deep at the base and narrow at the throat latch.
  const WITHERS = [0, 1.64, 0.5], CHESTF = [0, 1.15, 0.86], POLLT = hl([0, 0, -0.2]), LATCH = hl([0, -0.17, 0.07]);
  const cBase = lerp(WITHERS, CHESTF, 0.5), cTop = lerp(POLLT, LATCH, 0.5);
  const nAx = norm(sub(cTop, cBase)), nUp = norm([0, nAx[2], -nAx[1]]); // dorsal side of the neck
  const neckAt = (t) => lerp(cBase, cTop, t);
  // [t along the neck, half width, half depth, half length, bone]
  for (const [t, hw, hd, hlen, bone] of [[0.12, 0.2, 0.27, 0.2, 'neck1'], [0.38, 0.155, 0.215, 0.2, 'neck1'], [0.62, 0.12, 0.17, 0.18, 'neck2'], [0.84, 0.095, 0.13, 0.14, 'neck2']]) {
    m.ell({ tag: 'neck', bone, c: neckAt(t), r: [hw, hd, hlen], axis: nAx, up: nUp, k: 0.09 });
  }
  // crest: an arch along the top of the neck from the withers to the poll (heavier in stallions)
  const crestTop = (t) => { const q = lerp(WITHERS, POLLT, t); return add(q, mul(nUp, 0.045 * Math.sin(Math.PI * t))); };
  const cd = norm(sub(POLLT, WITHERS));
  for (const [t, r0, bone] of [[0.3, 0.075, 'neck1'], [0.62, 0.06, 'neck2'], [0.86, 0.05, 'neck2']]) {
    const c = add(crestTop(t), mul(nUp, -(r0 + 0.012)));
    m.ell({ tag: 'crest', bone, c, r: [r0 + 0.035 * crest, r0 + 0.025 * crest, 0.2], axis: cd, up: nUp, k: 0.08 });
  }
  // underline of the neck (trachea, jugular groove) to a narrow throat latch
  const ud = norm(sub(LATCH, CHESTF)), inU = mul(norm([0, ud[2], -ud[1]]), 1);
  m.cone({ tag: 'throat', bone: 'neck1', a: add(lerp(CHESTF, LATCH, 0.08), mul(inU, 0.08)), b: add(lerp(CHESTF, LATCH, 0.55), mul(inU, 0.06)), ra: 0.08, rb: 0.06, k: 0.08 });
  m.cone({ tag: 'throat', bone: 'neck2', a: add(lerp(CHESTF, LATCH, 0.55), mul(inU, 0.06)), b: hl([0, -0.13, -0.03]), ra: 0.06, rb: 0.045, k: 0.07 });

  // ---------------------------------------------------------------- HEAD (head-local, see rig.js)
  // landmarks from head_profile.jpg: forehead top y 0.087 at z -0.05, nasal bridge y 0.058 at 0.15,
  // muzzle top 0.028 at 0.36, nostril (0.035, -0.019, 0.355), chin y -0.1 at 0.4, jowl bottom
  // y -0.176 at z 0.11, throat latch (-0.17, 0.07), eyes (+-0.083, -0.012, 0)
  hell({ tag: 'cranium', c: [0, 0.02, -0.1], r: [0.085, 0.075, 0.11], k: 0.05 });
  hell({ tag: 'poll', c: [0, -0.01, -0.17], r: [0.065, 0.065, 0.06], k: 0.05 });
  hell({ tag: 'forehead', c: [0, 0.045, 0.0], r: [0.095, 0.042, 0.12], k: 0.04 });
  hell({ tag: 'face', c: [0, 0.008, 0.2], r: [0.056, 0.042, 0.19], k: 0.04 }); // (a slightly dished nasal line)
  hell({ tag: 'lowerface', c: [0, -0.055, 0.21], r: [0.052, 0.062, 0.15], k: 0.05 });
  hell({ tag: 'muzzle', c: [0, -0.026, 0.35], r: [0.05, 0.048, 0.06], k: 0.04 });
  hell({ tag: 'upperlip', c: [0, -0.066, 0.372], r: [0.044, 0.026, 0.046], k: 0.025 });
  for (const s of [1, -1]) {
    // masseter: the big round cheek; mandible's lower border from the jowl to the chin
    hell({ tag: 'cheek', c: [0.055 * s, -0.075, 0.07], r: [0.048, 0.095, 0.11], k: 0.05 });
    m.cone({ ...H, tag: 'mandible', a: hl([0.05 * s, -0.145, 0.07]), b: hl([0.028 * s, -0.108, 0.3]), ra: 0.03, rb: 0.02, k: 0.04 });
    hell({ tag: 'facialcrest', c: [0.075 * s, -0.04, 0.08], r: [0.016, 0.018, 0.08], k: 0.03 });
    hell({ tag: 'brow', c: [0.076 * s, 0.034, -0.008], r: [0.03, 0.022, 0.04], k: 0.03 }); // (bony orbital ridge over the eye)
    hell({ tag: 'nostrilwing', c: [0.036 * s, -0.02, 0.352], r: [0.02, 0.026, 0.032], k: 0.02 });
    // eye: orbit hollow, lids, almond aperture
    sculptEyeSocket(m, EYE, HEAD_O, s, { orbit: { r: [0.03, 0.022, 0.018], at: [0.0, 0.002, 0.03], k: 0.012 } });
  }
  // nostrils: a large comma on each side of the muzzle, facing forward and out, the round opening
  // low and its tail (the false nostril) rising up and out. The carves sit a measured depth under
  // the skin, so they cut the surface at a steep angle (a carve grazing the skin cut a ragged sliver).
  {
    const muzPrims = m.prims.filter((q) => q.bone === 'head' && q.part !== 'jaw');
    for (const s of [1, -1]) {
      const nL = norm([0.6 * s, 0.05, 0.8]); // head-local opening direction
      const skinAt = (o) => { // head-local point where the ray o + t nL leaves the muzzle
        let lo = 0, hi = 0.12;
        for (let i = 0; i < 30; i++) { const t = 0.5 * (lo + hi), q = hl(add(o, mul(nL, t))); if (SDFModel.evalList(muzPrims, q[0], q[1], q[2]) < 0) lo = t; else hi = t; }
        return add(o, mul(nL, 0.5 * (lo + hi)));
      };
      const low = skinAt([0.02 * s, -0.03, 0.34]), high = skinAt([0.03 * s, -0.004, 0.33]);
      const up = norm(sub(high, low));
      // opening: round low part, narrower tail above (merged into one comma)
      hell({ tag: 'nostril', c: sub(low, mul(nL, 0.011)), r: [0.013, 0.017, 0.028], axisL: nL, upL: up, k: 0.006, carve: true });
      hell({ tag: 'nostril', c: sub(add(low, mul(up, 0.022)), mul(nL, 0.012)), r: [0.0085, 0.014, 0.024], axisL: nL, upL: up, k: 0.008, carve: true });
    }
  }

  // ---------------------------------------------------------------- JAW (lower lip and chin: the mouth opens)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.104, 0.345]), r: [0.036, 0.03, 0.052], axis: HZ, up: HY, k: 0 });
  m.ell({ ...JW, tag: 'lowerlip', c: hl([0, -0.09, 0.39]), r: [0.038, 0.022, 0.034], axis: HZ, up: HY, k: 0.02 });
  for (const s of [1, -1]) {
    m.cone({ ...JW, tag: 'mandible', a: hl([0.026 * s, -0.104, 0.29]), b: hl([0.018 * s, -0.102, 0.35]), ra: 0.018, rb: 0.022, k: 0.03 });
  }

  // ---------------------------------------------------------------- EARS (long, cupped, pointed)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const up = norm(sub(tip, base));
    const facing = norm(add(mul(hdir([0, 0, 1]), 0.9), [0.55 * s, 0, 0])); // cup opens forward and out
    const lat = norm(cross(up, facing));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    ellY({ ...ear, tag: 'ear', c: lerp(base, tip, 0.42), ydir: up, lateral: lat, r: [0.034, 0.083, 0.02], k: 0.02 });
    ellY({ ...ear, tag: 'eartip', c: lerp(base, tip, 0.8), ydir: up, lateral: lat, r: [0.019, 0.045, 0.013], k: 0.02 });
    ellY({ ...ear, tag: 'earinner', c: add(add(lerp(base, tip, 0.5), mul(facing, 0.016)), mul(up, 0.0)), ydir: up, lateral: lat, r: [0.024, 0.075, 0.014], k: 0.006, carve: true });
    // ear base muscle mass on the poll
    m.sphere({ ...H, tag: 'earbase', c: add(base, mul(up, -0.01)), rad: 0.035, k: 0.035 });
  }

  // ---------------------------------------------------------------- FORELOCK AND MANE
  // mane: a ridge of hair on the crest, and the hair falling from it down one side of the neck
  // (usually the right) as one sheet, 14-26 cm long with a ragged lower edge. Shells cannot make long
  // hair, so the sheet is geometry: at each station along the crest two flat ellipsoids laid on the
  // neck's skin (found in the field), overlapping their neighbours so they merge into one sheet; the
  // coat gives it short hair combed straight down with lock-to-lock streaks. (22 round lock cones
  // under 5 cm shells read as a row of curls, and as a braid without the fur.)
  const side = params.maneSide ?? -1;
  const maneLen = foal ? 0.05 : params.maneLen ?? 0.2;
  const neckPrims = m.prims.filter((q) => q.part !== 'jaw' && q.bone !== 'head' && !q.carve);
  const skinX = (q) => { // the neck's skin on the mane side at the height and depth of q (x ignored)
    let lo = 0, hi = 0.45;
    for (let i = 0; i < 28; i++) { const x = 0.5 * (lo + hi); if (SDFModel.evalList(neckPrims, side * x, q[1], q[2]) < 0) lo = x; else hi = x; }
    return [side * 0.5 * (lo + hi), q[1], q[2]];
  };
  const NL = 22;
  for (let i = 0; i < NL; i++) {
    const t = 0.03 + 0.94 * (i + 0.5) / NL;
    const lift = mul(nUp, 0.028 * crest * Math.sin(Math.PI * Math.min(1, t * 1.15)));
    const p = add(crestTop(t), lift), p2 = add(crestTop(Math.min(1, t + 0.04)), lift), dir = norm(sub(p2, p));
    const bone = t < 0.45 ? 'neck1' : 'neck2';
    // (the ridge thins out over the last 15 % toward the poll: the mane runs into the forelock
    // there, a full ridge stood between the ears as a cushion)
    const toPoll = 1 - 0.6 * Math.max(0, Math.min(1, (t - 0.82) / 0.15));
    m.ell({ tag: 'manecrest', bone, c: add(p, mul(nUp, -0.01 - 0.008 * (1 - toPoll))), r: [(0.03 + 0.03 * crest) * (0.6 + 0.4 * toPoll), (foal ? 0.045 : 0.028) * toPoll, 0.06], axis: dir, up: nUp, k: 0.04 });
  }
  if (!foal) {
    const NS = 16, down = norm(add(mul(nUp, -1), [0, 0, -0.15]));
    const tAt = (i) => 0.03 + 0.94 * (i + 0.5) / NS;
    for (let i = 0; i < NS; i++) {
      const t = tAt(i);
      const lift = mul(nUp, 0.028 * crest * Math.sin(Math.PI * Math.min(1, t * 1.15)));
      const p = add(crestTop(t), lift);
      const spacing = len(sub(crestTop(tAt(i + 1)), crestTop(t)));
      const along = norm(sub(crestTop(Math.min(1, t + 0.02)), crestTop(Math.max(0, t - 0.02))));
      const L = maneLen * (0.75 + 0.5 * R()) * (0.65 + 0.35 * Math.sin(Math.PI * Math.min(1, t * 1.25)));
      const bone = t < 0.45 ? 'neck1' : 'neck2';
      const th = 0.0085;
      // the hair leaves the crest over its top: the sheet starts on the crest's far edge
      const depths = [0.02, 0.02 + (L - 0.02) * 0.5, L];
      const sk = depths.map((d) => skinX(add(p, mul(down, d))));
      for (let j = 0; j < 2; j++) {
        const a0 = sk[j], a1 = sk[j + 1];
        const ax = norm(sub(a1, a0));
        const nrm = norm(cross(ax, along)); // out of the skin on the mane side
        const out = nrm[0] * side >= 0 ? nrm : mul(nrm, -1);
        const c = add(lerp(a0, a1, 0.5), mul(out, th * 0.35));
        m.ell({ tag: 'mane', bone, c, r: [spacing * 0.85, th, len(sub(a1, a0)) * 0.58 + 0.01], axis: ax, up: out, k: 0.022 });
      }
    }
  }
  if (!foal) {
    // forelock: a thin lock of long hair lying flat from the poll down the forehead, ending above the
    // eyes (a chain of flat ellipsoids laid on the skin: shells cannot make long hair, so the
    // geometry carries the lock and the coat keeps its hair short). Two raised pads read as a fur
    // cushion with a hard rim that hid the star.
    const headPrims = m.prims.filter((q) => q.bone === 'head' && q.part !== 'jaw');
    const skinY = (z) => { // forehead skin height (head-local y) on the midline at head-local z
      let lo = 0.0, hi = 0.2; // (y 0 lies inside the cranium / poll from the poll to the eyes)
      for (let i = 0; i < 30; i++) { const y = 0.5 * (lo + hi), q = hl([0, y, z]); if (SDFModel.evalList(headPrims, q[0], q[1], q[2]) < 0) lo = y; else hi = y; }
      return 0.5 * (lo + hi);
    };
    const n = 7, z0 = -0.2, z1 = -0.035;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), z = z0 + (z1 - z0) * t;
      const zb = z + 0.3 * (z1 - z0) / (n - 1);
      const y = skinY(z), yb = skinY(zb);
      const half = 0.03 - 0.014 * t; // wide at the poll, narrowing to the tip
      const thick = 0.0085 - 0.0035 * t;
      const sway = 0.006 * Math.sin(3.1 * t + (params.coatSeed || 0)); // not ruler straight
      hell({ tag: 'forelock', c: [sway, y - 0.15 * thick, z], r: [half, thick, 0.034], axisL: [0, yb - y, zb - z], upL: cross(X, [0, yb - y, zb - z]).map((v) => -v), k: 0.012 });
    }
  }

  // ---------------------------------------------------------------- LEGS
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    // front
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], C = J['fcoffin' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.45), sx([0.07, 0, -0.02])), ydir: sub(Sh, Sc), lateral: lat, r: [0.08, 0.26, 0.15], k: 0.1, bias: 0.006 });
    m.sphere({ tag: 'shoulderpoint', bone: 'humerus' + S, group: g, c: add(Sh, sx([0.02, 0.0, 0.03])), rad: 0.07, k: 0.08 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.1, rb: 0.085, k: 0.08 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), sx([0.01, 0.02, -0.1])), ydir: sub(E, Sh), lateral: lat, r: [0.1, 0.17, 0.12], k: 0.08 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.02, -0.075]), rad: 0.055, k: 0.05 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: add(E, [0, 0, -0.01]), b: W, ra: 0.085, rb: 0.047, k: 0.05 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.22), sx([0.008, 0, 0.012])), ydir: sub(W, E), lateral: lat, r: [0.078, 0.16, 0.085], k: 0.05 });
    m.cone({ tag: 'forearmweb', bone: 'radius' + S, group: g, a: add(E, sx([-0.04, 0.06, -0.02])), b: add(lerp(E, W, 0.3), sx([-0.02, 0, 0])), ra: 0.06, rb: 0.045, k: 0.06 });
    // knee (carpus): broad and flat in front, accessory carpal bone behind
    ellY({ tag: 'knee', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0.0, 0.004]), ydir: [0, 1, 0], lateral: lat, r: [0.05, 0.06, 0.047], k: 0.025 });
    m.sphere({ tag: 'accessory', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0.03, -0.04]), rad: 0.024, k: 0.02 });
    // cannon: flat bone in front, flexor tendons behind
    m.cone({ tag: 'cannon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.02, 0.0]), b: add(M, [0, 0.02, 0.0]), ra: 0.034, rb: 0.032, k: 0.02 });
    m.cone({ tag: 'tendon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.03, -0.03]), b: add(M, [0, 0.03, -0.034]), ra: 0.022, rb: 0.026, k: 0.02 });
    // fetlock, ergot, pastern, coronet, hoof
    ellY({ tag: 'fetlock', bone: 'metacarpus' + S, group: g, c: add(M, [0, 0.0, -0.012]), ydir: [0, 1, 0.3], lateral: lat, r: [0.044, 0.05, 0.05], k: 0.02 });
    m.sphere({ tag: 'ergot', bone: 'fpaw' + S, group: g, c: add(M, [0, -0.02, -0.052]), rad: 0.018, k: 0.018 });
    m.cone({ tag: 'pastern', bone: 'fpaw' + S, group: g, a: M, b: C, ra: 0.036, rb: 0.037, k: 0.02 });
    sculptHoof(m, 'fhoof' + S, g, C, T, 1.0);

    // hind
    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Ch = J['hcoffin' + S], Tt = J['htoe' + S];
    // the thigh fills the whole quarter from the point of hip to the stifle and the gaskin
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.42), sx([0.04, 0, -0.05])), ydir: sub(K, Hp), lateral: lat, r: [0.1, 0.3, 0.22], k: 0.1, bias: 0.006 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.2, 1.32, -0.45]), b: add(K, sx([0.0, 0.06, 0.04])), ra: 0.12, rb: 0.07, k: 0.1 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.12, 1.3, -0.74]), b: add(lerp(K, Hk, 0.3), [0, 0, -0.09]), ra: 0.12, rb: 0.065, k: 0.08 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.2, 1.03, -0.3]), ydir: [-0.1, 0.3, 0.12], lateral: lat, r: [0.05, 0.15, 0.08], k: 0.1 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.01, 0.01, 0.03])), rad: 0.06, k: 0.07 });
    ellY({ tag: 'gaskin', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.32), sx([0.008, 0, -0.05])), ydir: sub(Hk, K), lateral: lat, r: [0.078, 0.17, 0.095], k: 0.06 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: lerp(K, Hk, 0.1), b: Hk, ra: 0.06, rb: 0.045, k: 0.05 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.45), [0, 0, -0.08]), b: add(Hk, [0, 0.07, -0.07]), ra: 0.03, rb: 0.024, k: 0.03 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.07, -0.068]), rad: 0.033, k: 0.025 });
    ellY({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.01, -0.005]), ydir: [0, 1, 0.25], lateral: lat, r: [0.05, 0.075, 0.055], k: 0.03 });
    m.cone({ tag: 'cannon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.04, 0.005]), b: add(Mt, [0, 0.02, 0.0]), ra: 0.036, rb: 0.033, k: 0.02 });
    m.cone({ tag: 'tendon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.04, -0.035]), b: add(Mt, [0, 0.03, -0.035]), ra: 0.022, rb: 0.026, k: 0.02 });
    ellY({ tag: 'fetlock', bone: 'metatarsus' + S, group: h, c: add(Mt, [0, 0.0, -0.012]), ydir: [0, 1, 0.3], lateral: lat, r: [0.043, 0.05, 0.05], k: 0.02 });
    m.sphere({ tag: 'ergot', bone: 'hpaw' + S, group: h, c: add(Mt, [0, -0.02, -0.052]), rad: 0.018, k: 0.018 });
    m.cone({ tag: 'pastern', bone: 'hpaw' + S, group: h, a: Mt, b: Ch, ra: 0.035, rb: 0.036, k: 0.02 });
    sculptHoof(m, 'hhoof' + S, h, Ch, Tt, 0.93);
  }

  // ---------------------------------------------------------------- TAIL: dock + hair
  const tailLen = foal ? 0.45 : 1;
  for (let i = 0; i < DOCK_SEGS; i++) {
    const t0 = i / DOCK_SEGS, t1 = (i + 1) / DOCK_SEGS;
    m.cone({ tag: 'dock', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: 0.062 - 0.03 * t0, rb: 0.062 - 0.03 * t1, k: i === 0 ? 0.06 : 0.01 });
  }
  // hair: one continuous tapered volume from the tail head to the hocks (foal: short fluffy brush)
  const hairR = (i) => {
    if (foal) return [0.06, 0.068, 0.072, 0.07, 0.06, 0.045, 0.03][Math.min(6, i)];
    const t = i / TAIL_SEGS;
    return t < 0.55 ? 0.066 + 0.018 * (t / 0.55) : 0.084 - 0.05 * ((t - 0.55) / 0.45) ** 1.5;
  };
  const nHair = foal ? DOCK_SEGS : TAIL_SEGS;
  for (let i = 0; i < nHair; i++) {
    m.cone({ tag: 'tailhair', bone: 'tail' + i, a: i === 0 ? lerp(J.tail0, J.tail1, 0.4) : J['tail' + i], b: J['tail' + (i + 1)], ra: hairR(i) * (i === 0 ? 0.8 : 1), rb: hairR(i + 1), k: i === 0 ? 0.03 : 0.015 });
  }
  void tailLen;
  return m;
}

// Hoof: a truncated cone with its front wall parallel to the pastern, a coronet band on top, the
// heel bulbs behind, flat on the ground (carved at y = 0).
function sculptHoof(m, bone, group, C, T, w) {
  const base = [C[0], 0.0, (C[2] + T[2]) * 0.5 - 0.012];
  const top = add(C, [0, 0.02, -0.012]);
  m.cone({ tag: 'hoof', bone, group, a: top, b: base, ra: 0.045 * w, rb: 0.064 * w, k: 0.012 });
  m.cone({ tag: 'coronet', bone, group, a: add(C, [0, 0.022, -0.018]), b: add(C, [0, 0.008, 0.02]), ra: 0.042 * w, rb: 0.042 * w, k: 0.015 });
  m.sphere({ tag: 'heelbulb', bone, group, c: add(C, [0, -0.028, -0.05]), rad: 0.03 * w, k: 0.02 });
  m.ell({ tag: 'sole', bone, group, c: [C[0], -0.2 + 0.002, base[2]], r: [0.2, 0.2, 0.2], k: 0.004, carve: true });
}
