// The wild boar, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw). The head is
// modelled in its own frame (rig.js: hl()), measured from the profile and frontal references (side1,
// side2, front2, face1); the body relative to the joints so the sculpt follows the skeleton.
// Silhouette: a wedge. Massive high forequarters (the male's subcutaneous shoulder "shield"), a thick
// neck merged into the shoulders, a long wedge head ending in the flat snout disc, a laterally
// compressed barrel on short slim legs, narrow sloping hindquarters, a thin hanging tail with a tassel.
// Separate surfaces ("parts"): 'jaw' (lower lip and chin: the mouth opens), 'tusk' (the lower canines,
// rigid on the jaw) and 'tuskup' (the upper canines / whetters, rigid on the skull).
import { HEAD_O, HZ, HY, hl, hdir, TAIL_SEGS } from './rig.js';
import { add, sub, mul, lerp, norm, cross } from '../../core/math/vec.js';
import { sculptEyeSocket, apertureTiltAlong } from '../../core/sdf/eyeSocket.js';

// Eye: small (globe ~23 mm, visible opening ~16 x 10 mm), set high and far back
// on the side of the head, deep in bristly lids, looking out and a little forward.
const EYE_LOCAL = [0.082, 0.024, 0.005];
const eyeDir = (() => {
  const a = (30 * Math.PI) / 180;
  return norm(add(add([Math.cos(a), 0, 0], mul(HZ, Math.sin(a))), mul(HY, 0.12)));
})();
const EYE_BASE = {
  c: sub(hl(EYE_LOCAL), HEAD_O), r: 0.0125, back: 0.0025, yaw: Math.atan2(eyeDir[0], eyeDir[2]), pitch: Math.asin(eyeDir[1]),
  lid: 0.0016, R: 0.0118, d: 0.0066, off: 0.0, tilt: 0, irisZ: 0.007, irisR: 0.0094,
};
// roll the almond so its long axis follows the head, the upper lid up (a search for the largest
// dot(x, HZ) stood the left eye's almond on end: its untilted x points backward)
EYE_BASE.tilt = apertureTiltAlong(EYE_BASE, HEAD_O, HZ) - 0.05;
export const EYE = EYE_BASE;

const X = [1, 0, 0];

// Tusk centre lines (reference space), shared by the sculpt, the regions and the coat.
// Lower tusk (jaw): leaves the lower lip behind the disc, rises, then curves back and out along the
// side of the snout (triangular in section in life; round here). Upper tusk (whetter, skull): leaves the
// upper lip sideways, then curves up so its tip hones the lower tusk. Returns [{ p, r, t }].
export function tuskPath(params, s, which) {
  const T = params.tusks;
  if (!T) return [];
  const lower = which === 'lower';
  const len = lower ? T.lower : T.upper;
  if (!(len > 0.004)) return [];
  const base = lower ? [0.04 * s, -0.086, 0.215] : [0.04 * s, -0.052, 0.185];
  // start / end directions (head-local) and the total turning (rad)
  const d0 = lower ? norm([0.55 * s, 1, 0.1]) : norm([1 * s, -0.25, 0.25]);
  const d1 = lower ? norm([0.9 * s, 0.5, -0.5]) : norm([0.35 * s, 1, -0.15]);
  const curve = lower ? 0.7 * T.curve : 1;
  const n = Math.max(4, Math.round(10 * Math.min(1.4, len / 0.09)));
  const out = [];
  let p = base.slice();
  const ds = len / n;
  const rb = lower ? T.r : T.r * 0.9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = Math.min(1, Math.pow(t, 1.1) * curve);
    const d = norm(add(mul(d0, 1 - u), mul(d1, u)));
    const r = rb * Math.pow(1 - 0.88 * t, 0.7) + 0.0008;
    out.push({ p: hl(p), r, t });
    p = add(p, mul(d, ds));
  }
  return out;
}

export function sculptBoar(m, rig, params = {}) {
  const J = rig.J;
  const young = params.age === 'juvenile';
  const piglet = young && (params.stage === 'piglet');
  const male = params.sex === 'male' && !young;
  const shield = params.shield ?? (male ? 1 : 0); // 0 sow .. 1 heavy boar
  const snoutL = params.snout ?? 1; // snout length factor (piglets short)

  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };
  const H = { bone: 'head' };
  const hell = (o) => m.ell({ ...H, ...o, c: hl(o.c), axis: o.axisL ? norm(hdir(o.axisL)) : HZ, up: o.upL ? norm(hdir(o.upL)) : HY });
  const hz = (z) => (z > 0.12 ? 0.12 + (z - 0.12) * snoutL : z); // snout length variation

  // ---------------------------------------------------------------- TORSO
  // wedge: deep high forequarters, laterally compressed barrel, narrow sloping hindquarters
  const sw = 1 + 0.12 * shield;
  m.ell({ tag: 'forequarter', bone: 'chest', c: [0, 0.51, 0.11], r: [0.15 * sw, 0.222, 0.25], axis: norm([0, 0.12, 1]), k: 0 });
  m.ell({ tag: 'barrel', bone: 'spine3', c: [0, 0.45, -0.03], r: [0.155, 0.205, 0.25], axis: norm([0, 0.05, 1]), k: 0.06 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.44, -0.22], r: [0.145, 0.17, 0.18], k: 0.06 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 0.48, -0.3], r: [0.115, 0.125, 0.13], k: 0.06 });
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.672, 0.1], r: [0.08 * sw, 0.07, 0.2], axis: norm([0, 0.1, 1]), k: 0.07 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 0.62, -0.08], r: [0.095, 0.05, 0.2], axis: norm([0, 0.14, 1]), k: 0.07 });
  m.ell({ tag: 'back', bone: 'spine1', c: [0, 0.555, -0.3], r: [0.088, 0.045, 0.15], axis: norm([0, 0.12, 1]), k: 0.07 });
  // hindquarters: narrow, rounded croup sloping to the tail root, hams behind
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 0.455, -0.42], r: [0.102, 0.15, 0.14], k: 0.05 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 0.52, -0.42], r: [0.085, 0.06, 0.14], axis: norm([0, -0.35, 1]), k: 0.05 });
  for (const s of [1, -1]) {
    m.ell({ tag: 'ham', bone: 'pelvis', c: [0.05 * s, 0.43, -0.47], r: [0.06, 0.11, 0.07], k: 0.05 });
  }
  // male shield: thick subcutaneous armour over the shoulders and flanks of the chest
  if (shield > 0.05) {
    for (const s of [1, -1]) m.ell({ tag: 'shield', bone: 'chest', c: [0.085 * s, 0.53, 0.1], r: [0.07 * shield + 0.01, 0.15, 0.17], k: 0.07 });
  }
  // chest floor: a narrow keel between the forelegs
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.33, 0.19], r: [0.085, 0.075, 0.1], k: 0.05 });
  for (const s of [1, -1]) m.ell({ tag: 'pectoral', bone: 'chest', c: [0.05 * s, 0.32, 0.24], r: [0.045, 0.06, 0.045], k: 0.04 });
  // teats (sows: a double row of small teats along the belly), sheath with its tuft (boars)
  if (params.sex === 'female' && !young) {
    for (const s of [1, -1]) for (let i = 0; i < 5; i++) m.sphere({ tag: 'teat', bone: i < 2 ? 'spine3' : 'spine2', c: [0.035 * s, 0.25 + 0.004 * i, 0.02 - 0.075 * i], rad: 0.007, k: 0.01 });
  }
  if (male) m.ell({ tag: 'sheath', bone: 'spine2', c: [0, 0.255, -0.17], r: [0.018, 0.02, 0.04], axis: norm([0, 0.3, 1]), k: 0.03 });

  // ---------------------------------------------------------------- NECK: short, thick, merged into the shoulders
  const nk = 1 + 0.12 * shield;
  m.ell({ tag: 'neck', bone: 'neck1', c: [0, 0.49, 0.27], r: [0.13 * nk, 0.17, 0.13], axis: norm([0, -0.25, 1]), k: 0.06 });
  m.ell({ tag: 'neck', bone: 'neck2', c: [0, 0.5, 0.36], r: [0.105 * nk, 0.14, 0.1], axis: norm([0, -0.5, 1]), k: 0.06 });
  m.ell({ tag: 'crest', bone: 'neck1', c: [0, 0.625, 0.28], r: [0.07 * nk, 0.06, 0.14], axis: norm([0, 0.2, 1]), k: 0.06 });
  // throat: the jaw line runs on into the jowls and the throat slopes evenly down to the brisket (side1,
  // side2: no dewlap or bag under the jaw)
  m.cone({ tag: 'throat', bone: 'neck1', a: [0, 0.37, 0.2], b: [0, 0.37, 0.32], ra: 0.08, rb: 0.075, k: 0.05 });
  m.cone({ tag: 'throat', bone: 'neck2', a: [0, 0.38, 0.33], b: hl([0, -0.12, -0.02]), ra: 0.075, rb: 0.065, k: 0.05 });
  m.ell({ tag: 'throat', bone: 'head', c: hl([0, -0.115, -0.075]), r: [0.068, 0.07, 0.115], axis: HZ, up: HY, k: 0.05 });
  m.ell({ tag: 'throat', bone: 'neck1', c: [0, 0.36, 0.36], r: [0.085, 0.075, 0.1], axis: norm([0, -0.2, 1]), k: 0.05 });

  // ---------------------------------------------------------------- HEAD (head-local, see rig.js)
  // Profile (head-local, skin; side1, keiler_doze, dzik_bnp in refcache/boar/extra): not a cone. The
  // crown is high and domed (poll y 0.10, still 0.075 above the eyes), the forehead falls steeply in
  // front of the eyes into a concave saddle (y ~0.03 by z 0.09), then the long snout runs on as a tube of
  // almost even depth (top y 0.026-0.032) to the flat disc. Below: the deep jowls (y -0.14 under and
  // behind the eye) rise into a shallow lower jaw set back under the disc. From above: widest across the
  // cheekbones and ear bases, narrowing quickly in front of the eyes into the snout.
  hell({ tag: 'cranium', c: [0, 0.02, -0.08], r: [0.092, 0.078, 0.105], k: 0.03 });
  hell({ tag: 'poll', c: [0, 0.04, -0.14], r: [0.084, 0.062, 0.065], k: 0.04 });
  // the domed forehead, falling steeply in front of the eyes
  hell({ tag: 'forehead', c: [0, 0.03, -0.005], r: [0.068, 0.045, 0.075], k: 0.032 });
  for (const s of [1, -1]) {
    hell({ tag: 'jowl', c: [0.058 * s, -0.07, -0.06], r: [0.058, 0.095, 0.1], k: 0.045 });
    // cheekbone (zygomatic arch) below and behind the eye: the head is widest across the cheekbones and
    // the ear bases (a wedge from the front, front2), not at the jowls
    hell({ tag: 'zygoma', c: [0.074 * s, -0.012, -0.03], r: [0.028, 0.034, 0.075], k: 0.03 });
    hell({ tag: 'cheek', c: [0.044 * s, -0.045, 0.055], r: [0.038, 0.05, 0.075], k: 0.035 });
    hell({ tag: 'brow', c: [0.066 * s, 0.043, 0.005], r: [0.018, 0.012, 0.026], k: 0.015 });
    sculptEyeSocket(m, EYE, HEAD_O, s, { orbit: { r: [0.013, 0.01, 0.009], at: [0.0, 0.001, 0.014], k: 0.006 } });
  }
  // the long snout: a tube of almost even depth from the saddle to the disc (not a taper)
  hell({ tag: 'face', c: [0, -0.01, hz(0.135)], r: [0.045, 0.045, 0.12 * (0.6 + 0.4 * snoutL)], k: 0.03 });
  hell({ tag: 'snout', c: [0, -0.016, hz(0.22)], r: [0.04, 0.042, 0.075 * snoutL + 0.01], k: 0.025 });
  // upper lip: flares where the canines come out (the tusk bosses), lip line running back to below
  // the eye
  for (const s of [1, -1]) {
    hell({ tag: 'upperlip', c: [0.034 * s, -0.056, hz(0.13)], r: [0.026, 0.029, 0.085 * snoutL + 0.01], k: 0.02 });
    hell({ tag: 'tuskboss', c: [0.034 * s, -0.045, hz(0.175)], r: [0.018 + 0.006 * shield, 0.018, 0.022], k: 0.02 });
  }
  // snout disc: a flat round plate facing forward and a little down, with its rim
  const discC = [0, -0.021, hz(0.287)];
  hell({ tag: 'disc', c: discC, r: [0.043, 0.039, 0.016], k: 0.01 });
  for (const s of [1, -1]) {
    // nostrils: two ovals in the disc face
    hell({ tag: 'nostril', c: [0.014 * s, -0.024, hz(0.307)], r: [0.0075, 0.011, 0.012], axisL: [0.15 * s, 0, 1], k: 0.003, carve: true });
  }
  // the underside of the snout above the mouth
  hell({ tag: 'rostrum', c: [0, -0.055, hz(0.2)], r: [0.032, 0.022, 0.07 * snoutL + 0.01], k: 0.02 });

  // ---------------------------------------------------------------- JAW (lower lip, chin)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  const jel = (o) => m.ell({ ...JW, ...o, c: hl(o.c), axis: HZ, up: HY });
  jel({ tag: 'chin', c: [0, -0.094, hz(0.12)], r: [0.038, 0.025, 0.075 * snoutL + 0.02], k: 0 });
  jel({ tag: 'lowerlip', c: [0, -0.08, hz(0.205)], r: [0.027, 0.015, 0.042 * snoutL + 0.008], k: 0.012 });
  for (const s of [1, -1]) m.cone({ ...JW, tag: 'mandible', a: hl([0.035 * s, -0.1, hz(0.04)]), b: hl([0.025 * s, -0.085, hz(0.19)]), ra: 0.022, rb: 0.018, k: 0.015 });

  // ---------------------------------------------------------------- TUSKS (own rigid surfaces)
  for (const s of [1, -1]) {
    for (const which of ['lower', 'upper']) {
      const pth = tuskPath(params, s, which);
      const part = which === 'lower' ? 'tusk' : 'tuskup';
      const bone = which === 'lower' ? 'jaw' : 'head';
      const group = which === 'lower' ? 'jaw' : 'axial';
      for (let i = 0; i + 1 < pth.length; i++) {
        m.cone({ bone, part, group, tag: 'tusk', a: pth[i].p, b: pth[i + 1].p, ra: pth[i].r, rb: pth[i + 1].r, k: 0.002 });
      }
    }
  }

  // ---------------------------------------------------------------- EARS: erect, pointed, hairy
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const up = norm(sub(tip, base));
    const len = Math.hypot(...sub(tip, base));
    // the cup opens forward and outward
    const facing = norm(add(add(mul(hdir([0, 0, 1]), 0.9), [0.32 * s, 0, 0]), [0, -0.2, 0]));
    const lat = norm(cross(up, facing));
    const fc = norm(cross(lat, up));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    const wd = 0.054;
    ellY({ ...ear, tag: 'ear', c: lerp(base, tip, 0.38), ydir: up, lateral: lat, r: [wd, len * 0.42, 0.009], k: 0.012 });
    ellY({ ...ear, tag: 'eartip', c: lerp(base, tip, 0.74), ydir: up, lateral: lat, r: [wd * 0.52, len * 0.26, 0.0065], k: 0.014 });
    ellY({ ...ear, tag: 'earinner', c: add(lerp(base, tip, 0.45), mul(fc, 0.0072)), ydir: up, lateral: lat, r: [wd * 0.72, len * 0.38, 0.0062], k: 0.004, carve: true });
    m.sphere({ ...H, tag: 'earbase', c: add(base, mul(up, -0.008)), rad: 0.022, k: 0.025 });
  }

  // ---------------------------------------------------------------- LEGS: short and slim, on the claw tips
  const lk = 1 + 0.1 * shield;
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], C = J['fcoffin' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.45), sx([0.035, 0, -0.01])), ydir: sub(Sh, Sc), lateral: lat, r: [0.03 * lk, 0.11, 0.075], k: 0.06 });
    m.sphere({ tag: 'shoulderpoint', bone: 'humerus' + S, group: g, c: add(Sh, sx([0.012, 0.0, 0.01])), rad: 0.035, k: 0.045 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.048 * lk, rb: 0.04 * lk, k: 0.045 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), sx([0.008, 0.01, -0.05])), ydir: sub(E, Sh), lateral: lat, r: [0.04 * lk, 0.08, 0.055], k: 0.05 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.012, -0.034]), rad: 0.026, k: 0.025 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: add(E, [0, 0, -0.005]), b: W, ra: 0.043 * lk, rb: 0.023, k: 0.025 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.28), sx([0.004, 0, 0.006])), ydir: sub(W, E), lateral: lat, r: [0.04 * lk, 0.07, 0.043 * lk], k: 0.025 });
    m.cone({ tag: 'forearmweb', bone: 'radius' + S, group: g, a: add(E, sx([-0.025, 0.035, -0.01])), b: add(lerp(E, W, 0.3), sx([-0.01, 0, 0])), ra: 0.03, rb: 0.022, k: 0.03 });
    ellY({ tag: 'knee', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0.0, 0.002]), ydir: [0, 1, 0], lateral: lat, r: [0.022, 0.025, 0.022], k: 0.012 });
    m.cone({ tag: 'cannon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.01, 0.0]), b: add(M, [0, 0.01, 0.0]), ra: 0.02, rb: 0.019, k: 0.01 });
    m.cone({ tag: 'tendon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.015, -0.012]), b: add(M, [0, 0.012, -0.013]), ra: 0.01, rb: 0.012, k: 0.01 });
    ellY({ tag: 'fetlock', bone: 'metacarpus' + S, group: g, c: add(M, [0, 0.0, -0.004]), ydir: [0, 1, 0.3], lateral: lat, r: [0.021, 0.021, 0.022], k: 0.01 });
    sculptDewclaws(m, 'fpaw' + S, g, M, s);
    m.cone({ tag: 'pastern', bone: 'fpaw' + S, group: g, a: M, b: C, ra: 0.017, rb: 0.017, k: 0.01 });
    sculptHoof(m, 'fhoof' + S, g, C, T, 1.0, s);

    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Ch = J['hcoffin' + S], Tt = J['htoe' + S];
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.42), sx([0.02, 0, -0.03])), ydir: sub(K, Hp), lateral: lat, r: [0.04 * lk, 0.13, 0.1], k: 0.06 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.08, 0.53, -0.31]), b: add(K, sx([0.0, 0.03, 0.02])), ra: 0.05, rb: 0.034, k: 0.05 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.05, 0.48, -0.52]), b: add(lerp(K, Hk, 0.3), [0, 0, -0.045]), ra: 0.055, rb: 0.03, k: 0.045 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.095, 0.34, -0.21]), ydir: [-0.1, 0.3, 0.12], lateral: lat, r: [0.026, 0.07, 0.04], k: 0.05 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.004, 0.005, 0.014])), rad: 0.03, k: 0.035 });
    ellY({ tag: 'gaskin', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.004, 0, -0.024])), ydir: sub(Hk, K), lateral: lat, r: [0.042 * lk, 0.08, 0.052], k: 0.03 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: lerp(K, Hk, 0.1), b: Hk, ra: 0.03, rb: 0.02, k: 0.025 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.45), [0, 0, -0.038]), b: add(Hk, [0, 0.03, -0.03]), ra: 0.014, rb: 0.011, k: 0.015 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.026, -0.028]), rad: 0.015, k: 0.012 });
    ellY({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.004, -0.002]), ydir: [0, 1, 0.25], lateral: lat, r: [0.021, 0.03, 0.023], k: 0.015 });
    m.cone({ tag: 'cannon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.016, 0.002]), b: add(Mt, [0, 0.01, 0.0]), ra: 0.02, rb: 0.019, k: 0.01 });
    m.cone({ tag: 'tendon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.016, -0.013]), b: add(Mt, [0, 0.012, -0.013]), ra: 0.01, rb: 0.012, k: 0.01 });
    ellY({ tag: 'fetlock', bone: 'metatarsus' + S, group: h, c: add(Mt, [0, 0.0, -0.004]), ydir: [0, 1, 0.3], lateral: lat, r: [0.021, 0.021, 0.022], k: 0.01 });
    sculptDewclaws(m, 'hpaw' + S, h, Mt, s);
    m.cone({ tag: 'pastern', bone: 'hpaw' + S, group: h, a: Mt, b: Ch, ra: 0.017, rb: 0.017, k: 0.01 });
    sculptHoof(m, 'hhoof' + S, h, Ch, Tt, 0.95, s);
  }

  // ---------------------------------------------------------------- TAIL: thin, hanging, flattened tassel
  for (let i = 0; i < TAIL_SEGS; i++) {
    const t0 = i / TAIL_SEGS, t1 = (i + 1) / TAIL_SEGS;
    const a = J['tail' + i], b = J['tail' + (i + 1)];
    const r0 = 0.016 - 0.009 * t0, r1 = 0.016 - 0.009 * t1;
    m.cone({ tag: i === 0 ? 'tailhead' : 'tail', bone: 'tail' + i, a, b, ra: r0, rb: r1, k: i === 0 ? 0.018 : 0.006, thin: i > 2 });
    if (i >= TAIL_SEGS - 2) {
      // tassel: long bristles flattened side to side
      const d = norm(sub(b, a));
      m.ell({ tag: 'tassel', bone: 'tail' + i, c: lerp(a, b, 0.6), r: [0.009, 0.016 + 0.004 * (i - TAIL_SEGS + 2), Math.hypot(...sub(b, a)) * 0.62], axis: d, up: norm(cross(d, X)), k: 0.008, thin: true });
    }
  }
  void piglet;
  return m;
}

// Dewclaws: two horny claws behind the fetlock, larger and lower than a domestic pig's (they print
// in soft ground)
function sculptDewclaws(m, bone, group, M, s) {
  for (const k of [1, -1]) {
    const a = add(M, [0.012 * k * s, -0.006, -0.02]);
    m.cone({ tag: 'dewclaw', bone, group, a, b: add(a, [0.003 * k * s, -0.022, -0.01]), ra: 0.0075, rb: 0.004, k: 0.004 });
  }
}

// Cloven hoof: two pointed claws (digits III and IV) with a cleft between them, heel bulbs behind,
// flat on the ground.
function sculptHoof(m, bone, group, C, T, w, s) {
  const zc = (C[2] + T[2]) * 0.5;
  for (const k of [1, -1]) {
    const x = C[0] + 0.0105 * k * w;
    const top = [x, C[1] + 0.008, C[2] - 0.004];
    const toe = [x - 0.003 * k, 0.005, T[2] - 0.003];
    const heel = [x, 0.008, C[2] - 0.014];
    m.cone({ tag: 'hoof', bone, group, a: top, b: toe, ra: 0.0112 * w, rb: 0.0045 * w, k: 0.006 });
    m.cone({ tag: 'hoof', bone, group, a: heel, b: [toe[0], 0.006, zc + 0.006], ra: 0.0105 * w, rb: 0.008 * w, k: 0.008 });
    m.sphere({ tag: 'heelbulb', bone, group, c: [x, 0.012, C[2] - 0.017], rad: 0.0095 * w, k: 0.008 });
  }
  m.cone({ tag: 'coronet', bone, group, a: add(C, [0, 0.012, -0.01]), b: add(C, [0, 0.006, 0.008]), ra: 0.0165 * w, rb: 0.0165 * w, k: 0.008 });
  m.ell({ tag: 'cleft', bone, group, c: [C[0], 0.006, zc + 0.013], r: [0.0022, 0.02, 0.03], k: 0.002, carve: true });
  m.ell({ tag: 'sole', bone, group, c: [C[0], -0.1 + 0.001, zc], r: [0.1, 0.1, 0.1], k: 0.002, carve: true });
  void s;
}
