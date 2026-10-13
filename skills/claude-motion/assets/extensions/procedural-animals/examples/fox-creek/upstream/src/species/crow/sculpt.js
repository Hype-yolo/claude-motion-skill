// The crow sculpted as a signed distance field (the feathered silhouette: contour feathers are part
// of the body shape; flight feathers are cards, see core/build/featherCards.js).
// Every primitive is attached to a bone and a group (axial / legL / wingL / jaw).
import { HEAD_O, NECK_SEGS } from './rig.js';
import { add, sub, mul, lerp, norm, cross, dot } from '../../core/math/vec.js';
import { sculptEyeSocket } from '../../core/sdf/eyeSocket.js';

// Eye (head-local, left): lateral-frontal (yaw 62 deg), visible iris ~7.5 mm, round aperture.
export const EYE = { c: [0.0185, 0.0005, 0.003], r: 0.0056, back: 0.0016, yaw: 1.08, pitch: 0.05, lid: 0.00045, R: 0.0047, d: 0.0006, off: 0.0, tilt: 0, irisZ: 0.0036, irisR: 0.0044 };

const hl = (v) => [v[0] + HEAD_O[0], v[1] + HEAD_O[1], v[2] + HEAD_O[2]];

export function sculptCrow(m, rig) {
  const J = rig.J;
  // ellipsoid whose local Y follows ydir and local X follows (roughly) xdir; r = [x, y, z]
  const ellY = (o) => {
    const y = norm(o.ydir);
    let x = o.xdir || [1, 0, 0];
    x = norm(sub(x, mul(y, dot(x, y))));
    const z = cross(x, y);
    return m.ell({ ...o, axis: z, up: y });
  };
  const A = { bone: 'chest' }, Pv = { bone: 'pelvis' };

  // ---------------------------------------------------------------- TORSO (feathered)
  const tilt = norm([0, 0.5, 0.866]);
  m.ell({ ...A, tag: 'breast', c: [0, 0.182, 0.048], r: [0.044, 0.053, 0.07], axis: tilt, k: 0 });
  m.ell({ ...A, tag: 'mantle', c: [0, 0.2, 0.0], r: [0.043, 0.038, 0.07], axis: tilt, k: 0.02 });
  // straight underside from breast to vent (no sagging belly)
  m.ell({ ...Pv, tag: 'belly', c: [0, 0.14, -0.012], r: [0.041, 0.036, 0.07], axis: norm([0, 0.35, 1]), k: 0.022 });
  m.ell({ ...Pv, tag: 'rump', c: [0, 0.163, -0.07], r: [0.03, 0.03, 0.045], axis: norm([0, 0.3, 1]), k: 0.02 });
  m.ell({ bone: 'tail', tag: 'undertail', c: [0, 0.147, -0.108], r: [0.019, 0.015, 0.055], axis: norm([0, 0.18, 1]), k: 0.016 });
  m.ell({ bone: 'tail', tag: 'uppertail', c: [0, 0.172, -0.096], r: [0.019, 0.011, 0.032], axis: norm([0, 0.1, 1]), k: 0.012 });
  for (const s of [1, -1]) {
    m.ell({ ...Pv, tag: 'flankfold', c: [0.026 * s, 0.145, -0.02], r: [0.02, 0.03, 0.06], k: 0.02 });
    // sides under the folded wing: the wing's lower edge is the silhouette
    m.ell({ ...Pv, tag: 'sides', c: [0.03 * s, 0.162, -0.012], r: [0.017, 0.026, 0.066], axis: norm([0, 0.2, 1]), k: 0.02 });
    m.ell({ ...A, tag: 'scapular', c: [0.026 * s, 0.211, 0.004], r: [0.02, 0.014, 0.05], axis: tilt, k: 0.018 });
  }

  // ---------------------------------------------------------------- NECK
  const nj = ['neckBase', ...Array.from({ length: NECK_SEGS - 1 }, (_, i) => 'neck' + (i + 1)), 'occiput'];
  // radius tapers from the base (30 mm) to the skull (19 mm)
  const nr = nj.map((_, i) => { const u = i / NECK_SEGS; return 0.03 - 0.011 * Math.pow(u, 0.8); });
  for (let i = 0; i < NECK_SEGS; i++) m.cone({ bone: 'neck' + i, tag: 'neck', a: J[nj[i]], b: J[nj[i + 1]], ra: nr[i], rb: nr[i + 1], k: 0.02 });
  // throat filled out: bill, chin, throat and breast in one convex line
  m.ell({ bone: 'neck' + Math.round(NECK_SEGS * 0.3), tag: 'throat', c: [0, 0.232, 0.087], r: [0.021, 0.028, 0.027], axis: norm([0, 0.6, 1]), k: 0.021 });
  m.ell({ bone: 'neck' + Math.round(NECK_SEGS * 0.55), tag: 'nape', c: [0, 0.248, 0.04], r: [0.0166, 0.02, 0.0204], k: 0.022 });

  // ---------------------------------------------------------------- HEAD (head-local, see HEAD_O)
  // landmarks from side1 / face1: bill tip (0, 0.005, 0.081), bill base at z 0.031 (19 mm deep),
  // eyes (+-0.0185, 0, 0.003), crown 0.029 above the eyes, occiput (0, -0.019, -0.042)
  const H = { bone: 'head' };
  // one smooth dome from the forehead over the crown to the nape (no double hump)
  m.ell({ ...H, tag: 'cranium', c: hl([0, 0.004, -0.01]), r: [0.0185, 0.021, 0.031], k: 0.014 });
  m.ell({ ...H, tag: 'crown', c: hl([0, 0.012, 0.006]), r: [0.0145, 0.0105, 0.022], axis: norm([0, -0.25, 1]), k: 0.016 });
  m.ell({ ...H, tag: 'forehead', c: hl([0, 0.0115, 0.022]), r: [0.0115, 0.0115, 0.016], axis: norm([0, -0.45, 1]), k: 0.012 });
  m.ell({ ...H, tag: 'chin', c: hl([0, -0.02, 0.006]), r: [0.012, 0.012, 0.026], axis: norm([0, 0.25, 1]), k: 0.012 });
  for (const s of [1, -1]) {
    m.ell({ ...H, tag: 'cheek', c: hl([0.011 * s, -0.009, 0.01]), r: [0.009, 0.012, 0.02], k: 0.008 });
    m.ell({ ...H, tag: 'brow', c: hl([0.013 * s, 0.009, 0.004]), r: [0.007, 0.006, 0.014], k: 0.006 });
    sculptEyeSocket(m, EYE, HEAD_O, s, { bone: 'head' });
  }
  // upper mandible: deep at the base, culmen curving down to a sharp tip; nasal bristles cover the
  // basal third
  // massive bill: ~18 mm deep at the base (about as deep as the forehead), strongly curved culmen
  m.ell({ ...H, tag: 'bill', c: hl([0, 0.001, 0.042]), r: [0.0085, 0.0105, 0.022], axis: norm([0, -0.08, 1]), k: 0.007 });
  m.cone({ ...H, tag: 'bill', a: hl([0, 0.004, 0.054]), b: hl([0, 0.0028, 0.0808]), ra: 0.0068, rb: 0.001, k: 0.007 });
  m.cone({ ...H, tag: 'bill', a: hl([0, -0.004, 0.05]), b: hl([0, 0.0018, 0.0802]), ra: 0.0052, rb: 0.001, k: 0.006 });
  // nasal bristles lie flat along the top of the bill base
  m.ell({ ...H, tag: 'bristles', c: hl([0, 0.0098, 0.035]), r: [0.0078, 0.004, 0.013], axis: norm([0, -0.2, 1]), k: 0.005 });
  // lower mandible (own surface so the bill can open)
  const Jw = { bone: 'jaw', part: 'jaw' };
  m.ell({ ...Jw, tag: 'mandible', c: hl([0, -0.0098, 0.038]), r: [0.0075, 0.0052, 0.028], axis: norm([0, 0.08, 1]), k: 0.004 });
  m.cone({ ...Jw, tag: 'mandible', a: hl([0, -0.0082, 0.05]), b: hl([0, -0.0006, 0.0772]), ra: 0.0052, rb: 0.0009, k: 0.004 });
  m.ell({ ...Jw, tag: 'gonys', c: hl([0, -0.0135, 0.02]), r: [0.0095, 0.0068, 0.02], k: 0.006 });

  // ---------------------------------------------------------------- LEGS
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', g = 'leg' + S;
    const j = (n) => J[n + S];
    // drumstick: feathered "trousers" down to ~1 cm above the ankle, then the bare lower tibiotarsus
    const kn = j('knee'), an = j('ankle');
    ellY({ bone: 'tibia' + S, group: g, tag: 'thigh', c: lerp(kn, an, 0.22), ydir: sub(an, kn), r: [0.017, 0.03, 0.02], k: 0.02 });
    m.cone({ bone: 'tibia' + S, group: g, tag: 'trousers', a: lerp(kn, an, 0.3), b: lerp(kn, an, 0.8), ra: 0.014, rb: 0.0075, k: 0.01 });
    m.cone({ bone: 'tibia' + S, group: g, tag: 'shank', a: lerp(kn, an, 0.7), b: an, ra: 0.0055, rb: 0.0045, k: 0.004 });
    m.cone({ bone: 'tarsus' + S, group: g, tag: 'tarsus', a: an, b: j('mtp'), ra: 0.0044, rb: 0.0036, k: 0.003 });
    m.sphere({ bone: 'tarsus' + S, group: g, tag: 'pad', c: add(j('mtp'), [0, -0.0015, 0.001]), rad: 0.0045, k: 0.003 });
    for (const t of [1, 2, 3, 4]) {
      const a = j('mtp'), b = J[`t${t}m${S}`], c = J[`t${t}t${S}`];
      const r0 = t === 1 ? 0.0032 : 0.0028;
      m.cone({ bone: `toe${t}a${S}`, group: g, tag: 'toe', a, b, ra: r0, rb: 0.0024, k: 0.0025 });
      m.cone({ bone: `toe${t}b${S}`, group: g, tag: 'toe', a: b, b: lerp(b, c, 0.72), ra: 0.0024, rb: 0.0017, k: 0.002 });
      m.cone({ bone: `toe${t}b${S}`, group: g, tag: 'claw', a: lerp(b, c, 0.65), b: c, ra: 0.0015, rb: 0.0003, k: 0.001 });
    }
  }

  // ---------------------------------------------------------------- WINGS (arm; flight feathers are cards)
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', g = 'wing' + S;
    const sh = J['shoulder' + S], el = J['elbow' + S], wr = J['wrist' + S], tp = J['handTip' + S];
    let n = norm(cross(sub(el, sh), sub(wr, el)));
    if (n[1] < 0) n = mul(n, -1);
    const seg = (a, b, bone, thick, chord, back, tag, k = 0.008) => {
      const d = norm(sub(b, a));
      const t = mul(norm(cross(n, d)), s); // trailing side
      const c = add(lerp(a, b, 0.5), mul(t, back));
      return ellY({ bone, group: g, tag, c, ydir: d, xdir: n, r: [thick, Math.hypot(...sub(b, a)) * 0.58, chord], k });
    };
    seg(sh, el, 'humerus' + S, 0.01, 0.026, 0.009, 'arm', 0.012);
    seg(el, wr, 'ulna' + S, 0.0085, 0.026, 0.011, 'arm');
    seg(wr, tp, 'hand' + S, 0.0055, 0.012, 0.004, 'hand', 0.006);
    // leading-edge roll (propatagium, marginal coverts) on the forearm only: it stays on the arm when
    // the elbow opens (a web spanning shoulder -> wrist swings forward as a loop)
    seg(lerp(el, wr, 0.08), wr, 'ulna' + S, 0.0065, 0.009, -0.009, 'patagium', 0.009);
    m.sphere({ bone: 'hand' + S, group: g, tag: 'wrist', c: wr, rad: 0.0065, k: 0.006 });
  }
}
