// The eagle sculpted as a signed distance field (the feathered silhouette: contour feathers are part
// of the body shape; flight feathers are cards, see core/build/featherCards.js). Every primitive is
// attached to a bone and a group (axial / legL / wingL / jaw). The torso is laid out in the upright
// body-axis frame (rig.js AX); the head in head-local coordinates (HEAD_O, between the eyes).
import { HEAD_O, NECK_SEGS, AX, U_AX, TILT } from './rig.js';
import { add, sub, mul, lerp, norm, cross, dot } from '../../core/math/vec.js';
import { sculptEyeSocket } from '../../core/sdf/eyeSocket.js';

// Eye (head-local, left): large, set under the supraorbital shelf, fairly forward (yaw 52 deg: raptor
// binocular overlap), visible iris ~15 mm, round aperture slightly flattened from above.
export const EYE = { c: [0.0242, 0.0, 0.004], r: 0.0118, back: 0.0038, yaw: 0.9, pitch: 0.06, lid: 0.0014, R: 0.0096, d: 0.0012, off: -0.0005, tilt: 0.12, irisZ: 0.0074, irisR: 0.0082 };

const hl = (v) => [v[0] + HEAD_O[0], v[1] + HEAD_O[1], v[2] + HEAD_O[2]];
const rad = (d) => (d * Math.PI) / 180;
const axisAt = (deg) => [0, Math.sin(rad(deg)), Math.cos(rad(deg))];

export function sculptEagle(m, rig, params = {}) {
  const J = rig.J;
  const booted = params.variant === 'golden';
  const ellY = (o) => {
    const y = norm(o.ydir);
    let x = o.xdir || [1, 0, 0];
    x = norm(sub(x, mul(y, dot(x, y))));
    const z = cross(x, y);
    return m.ell({ ...o, axis: z, up: y });
  };
  const A = { bone: 'chest' }, Pv = { bone: 'pelvis' };
  const tilt = U_AX;

  // ---------------------------------------------------------------- TORSO (feathered)
  // A streamlined spindle in the body-axis frame (AX: a along the axis, b dorsal): deepest at the breast
  // under the wing roots, the belly and flanks tapering into the tail. Depth ~0.19 m and width ~0.16 m
  // at the breast (a 4-6 kg bird: ~6 L torso with its feathers; flight photos:
  // body depth ~0.18-0.2 of the bill-to-tail length, the back flat, the belly line rising to the vent).
  m.ell({ ...A, tag: 'breast', c: AX(0.13, -0.02), r: [0.077, 0.074, 0.135], axis: tilt, k: 0 });
  m.ell({ ...A, tag: 'mantle', c: AX(0.08, 0.032), r: [0.076, 0.058, 0.15], axis: tilt, k: 0.04 });
  m.ell({ ...Pv, tag: 'belly', c: AX(-0.01, -0.03), r: [0.062, 0.058, 0.13], axis: axisAt(TILT - 8), k: 0.04 });
  m.ell({ ...Pv, tag: 'rump', c: AX(-0.07, 0.03), r: [0.052, 0.046, 0.085], axis: axisAt(TILT - 6), k: 0.035 });
  const td = norm(sub(J.tailTip, J.tailBase));
  m.ell({ bone: 'tail', tag: 'undertail', c: add(J.tailTip, [0, -0.018, 0.01]), r: [0.038, 0.026, 0.1], axis: mul(td, -1), k: 0.03 });
  m.ell({ bone: 'tail', tag: 'uppertail', c: add(J.tailTip, [0, 0.012, -0.004]), r: [0.038, 0.018, 0.07], axis: mul(td, -1), k: 0.024 });
  for (const s of [1, -1]) {
    m.ell({ ...Pv, tag: 'flankfold', c: AX(0.01, -0.036, 0.042 * s), r: [0.032, 0.054, 0.1], axis: tilt, k: 0.04 });
    m.ell({ ...A, tag: 'scapular', c: AX(0.13, 0.045, 0.05 * s), r: [0.036, 0.028, 0.11], axis: tilt, k: 0.032 });
  }

  // ---------------------------------------------------------------- NECK (thick, hackled)
  const nj = ['neckBase', ...Array.from({ length: NECK_SEGS - 1 }, (_, i) => 'neck' + (i + 1)), 'occiput'];
  const nr = nj.map((_, i) => { const u = i / NECK_SEGS; return 0.054 - 0.012 * Math.pow(u, 0.8); });
  for (let i = 0; i < NECK_SEGS; i++) m.cone({ bone: 'neck' + i, tag: 'neck', a: J[nj[i]], b: J[nj[i + 1]], ra: nr[i], rb: nr[i + 1], k: 0.04 });
  // (neck landmarks by fraction of the neck: throat ~40 %, nape ~60 %)
  const nAt = (f) => { const x = f * NECK_SEGS, i = Math.min(NECK_SEGS - 1, Math.floor(x)); return { bone: 'neck' + i, p: lerp(J[nj[i]], J[nj[i + 1]], x - i) }; };
  const th = nAt(0.4), np = nAt(0.6);
  m.ell({ bone: th.bone, tag: 'throat', c: add(th.p, [0, -0.004, 0.024]), r: [0.04, 0.05, 0.034], axis: norm([0, 0.6, 1]), k: 0.04 });
  m.ell({ bone: np.bone, tag: 'nape', c: add(np.p, [0, 0.01, -0.026]), r: [0.04, 0.046, 0.038], k: 0.04 });

  // ---------------------------------------------------------------- HEAD (head-local, see HEAD_O)
  // landmarks from face1 / face2 (profile): eyes at (+-0.0235, 0, 0.004), crown 0.04 above the eyes,
  // occiput (0, -0.026, -0.058), cere 0.03-0.052 ahead of the eye, hook tip (0, -0.036, 0.104)
  const H = { bone: 'head' };
  m.ell({ ...H, tag: 'cranium', c: hl([0, -0.005, -0.028]), r: [0.035, 0.032, 0.05], k: 0.02 });
  m.ell({ ...H, tag: 'crown', c: hl([0, 0.013, -0.006]), r: [0.026, 0.012, 0.042], axis: norm([0, -0.12, 1]), k: 0.016 });
  m.ell({ ...H, tag: 'hackles', c: hl([0, -0.008, -0.062]), r: [0.034, 0.03, 0.032], k: 0.02 });
  m.ell({ ...H, tag: 'forehead', c: hl([0, 0.014, 0.022]), r: [0.019, 0.015, 0.024], axis: norm([0, -0.35, 1]), k: 0.012 });
  m.ell({ ...H, tag: 'chin', c: hl([0, -0.034, -0.012]), r: [0.026, 0.024, 0.044], axis: norm([0, 0.15, 1]), k: 0.02 });
  for (const s of [1, -1]) {
    m.ell({ ...H, tag: 'cheek', c: hl([0.019 * s, -0.016, -0.008]), r: [0.017, 0.02, 0.032], k: 0.014 });
    m.ell({ ...H, tag: 'lore', c: hl([0.013 * s, -0.008, 0.026]), r: [0.011, 0.013, 0.02], axis: norm([0, -0.1, 1]), k: 0.01 });
    // supraorbital ridge: a hard shelf over the front of the eye (the fierce frown)
    ellY({ ...H, tag: 'brow', c: hl([0.0225 * s, 0.0138, 0.01]), ydir: [0.25 * s, 1, 0.12], xdir: [1, 0, 0], r: [0.0095, 0.0055, 0.023], k: 0.005 });
    sculptEyeSocket(m, EYE, HEAD_O, s, { bone: 'head' });
  }
  // upper mandible: deep at the base, laterally compressed, culmen curving into a strong hook; the
  // cere (bare waxy skin with the nostril) covers its base
  m.ell({ ...H, tag: 'cere', c: hl([0, 0.003, 0.036]), r: [0.0148, 0.0135, 0.016], axis: norm([0, -0.1, 1]), k: 0.008 });
  m.ell({ ...H, tag: 'bill', c: hl([0, -0.0095, 0.055]), r: [0.0128, 0.0205, 0.036], axis: norm([0, -0.1, 1]), k: 0.008 });
  m.ell({ ...H, tag: 'bill', c: hl([0, -0.012, 0.082]), r: [0.0095, 0.018, 0.021], axis: norm([0, -0.45, 1]), k: 0.008 });
  m.ell({ ...H, tag: 'bill', c: hl([0, -0.02, 0.1]), r: [0.0074, 0.016, 0.012], axis: norm([0, -0.95, 0.3]), k: 0.006 });
  m.cone({ ...H, tag: 'bill', a: hl([0, -0.029, 0.1055]), b: hl([0, -0.0465, 0.108]), ra: 0.006, rb: 0.0012, k: 0.004 });
  for (const s of [1, -1]) m.ell({ ...H, tag: 'nostril', c: hl([0.0118 * s, 0.003, 0.044]), r: [0.003, 0.0028, 0.005], axis: norm([0, 0.2, 1]), k: 0.002, carve: true });
  // lower mandible (own surface so the bill can open), tucked inside the hook
  const Jw = { bone: 'jaw', part: 'jaw' };
  m.ell({ ...Jw, tag: 'mandible', c: hl([0, -0.035, 0.045]), r: [0.0125, 0.0072, 0.046], axis: norm([0, -0.08, 1]), k: 0.006 });
  m.cone({ ...Jw, tag: 'mandible', a: hl([0, -0.036, 0.072]), b: hl([0, -0.0395, 0.095]), ra: 0.007, rb: 0.0018, k: 0.005 });
  m.ell({ ...Jw, tag: 'gonys', c: hl([0, -0.039, 0.02]), r: [0.016, 0.008, 0.03], k: 0.008 });

  // ---------------------------------------------------------------- LEGS
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', g = 'leg' + S;
    const j = (n) => J[n + S];
    const kn = j('knee'), an = j('ankle'), mt = j('mtp');
    // feathered "trousers": long loose tibial feathers hanging over the ankle
    ellY({ bone: 'tibia' + S, group: g, tag: 'thigh', c: lerp(kn, an, 0.25), ydir: sub(an, kn), r: [0.036, 0.058, 0.032], k: 0.04 });
    m.cone({ bone: 'tibia' + S, group: g, tag: 'trousers', a: lerp(kn, an, 0.3), b: lerp(kn, an, 0.96), ra: 0.029, rb: 0.021, k: 0.02 });
    if (booted) {
      // golden eagle: feathered to the toes
      m.cone({ bone: 'tarsus' + S, group: g, tag: 'boot', a: lerp(an, mt, 0.05), b: lerp(an, mt, 0.66), ra: 0.017, rb: 0.0115, k: 0.006 });
    } else {
      m.cone({ bone: 'tarsus' + S, group: g, tag: 'cuff', a: an, b: lerp(an, mt, 0.42), ra: 0.02, rb: 0.0135, k: 0.01 });
    }
    m.cone({ bone: 'tarsus' + S, group: g, tag: 'tarsus', a: an, b: mt, ra: 0.0115, rb: 0.0098, k: 0.006 });
    m.sphere({ bone: 'tarsus' + S, group: g, tag: 'pad', c: add(mt, [0, -0.001, 0.003]), rad: 0.0105, k: 0.005 });
    for (const t of [1, 2, 3, 4]) {
      const a = mt, b = J[`t${t}m${S}`], c = J[`t${t}t${S}`];
      const big = t === 1 || t === 2; // hallux and inner toe carry the largest talons
      const r0 = t === 1 ? 0.0105 : 0.0092;
      m.cone({ bone: `toe${t}a${S}`, group: g, tag: 'toe', a, b, ra: r0, rb: 0.0082, k: 0.005 });
      m.cone({ bone: `toe${t}b${S}`, group: g, tag: 'toe', a: b, b: lerp(b, c, 0.5), ra: 0.0082, rb: 0.0068, k: 0.004 });
      // talon: thick at the base, strongly curved down to a needle point
      const q0 = add(lerp(b, c, 0.42), [0, 0.004, 0]), q1 = add(lerp(b, c, 0.78), [0, 0.0035, 0]), q2 = add(c, [0, -0.0035, 0]);
      const tr = big ? 0.0062 : 0.0054;
      m.cone({ bone: `toe${t}b${S}`, group: g, tag: 'claw', a: q0, b: q1, ra: tr, rb: tr * 0.62, k: 0.002 });
      m.cone({ bone: `toe${t}b${S}`, group: g, tag: 'claw', a: q1, b: q2, ra: tr * 0.62, rb: 0.0008, k: 0.0015 });
    }
  }

  // ---------------------------------------------------------------- WINGS (arm; flight feathers are cards)
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', g = 'wing' + S;
    const sh = J['shoulder' + S], el = J['elbow' + S], wr = J['wrist' + S], tp = J['handTip' + S];
    let n = norm(cross(sub(el, sh), sub(wr, el)));
    if (n[1] < 0) n = mul(n, -1);
    const seg = (a, b, bone, thick, chord, back, tag, k = 0.016) => {
      const d = norm(sub(b, a));
      const t = mul(norm(cross(n, d)), s); // trailing side
      const c = add(lerp(a, b, 0.5), mul(t, back));
      return ellY({ bone, group: g, tag, c, ydir: d, xdir: n, r: [thick, Math.hypot(...sub(b, a)) * 0.58, chord], k });
    };
    seg(sh, el, 'humerus' + S, 0.019, 0.05, 0.018, 'arm', 0.024);
    seg(el, wr, 'ulna' + S, 0.015, 0.052, 0.022, 'arm');
    seg(wr, tp, 'hand' + S, 0.012, 0.026, 0.008, 'hand', 0.012);
    // leading-edge roll (propatagium) along the forearm: on the ulna only, so it stays on the arm
    // when the elbow opens (a web spanning shoulder -> wrist would swing forward as a loop)
    seg(lerp(el, wr, 0.08), wr, 'ulna' + S, 0.011, 0.016, -0.02, 'patagium', 0.014);
    m.sphere({ bone: 'hand' + S, group: g, tag: 'wrist', c: wr, rad: 0.0135, k: 0.012 });
  }
}
