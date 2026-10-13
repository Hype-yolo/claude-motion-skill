// The snake sculpted as a signed distance field: a tube of round cones along the spine with a flat,
// carved belly (loaf cross-section), a head modelled in head-local coordinates (origin at v0,
// +Z forward), a separately meshed lower jaw, a forked tongue in two rigid pieces, hinged fangs
// (rattlesnake) and a rattle.
import { SPINE, bodyPlan } from './rig.js';
import { add, sub, mul, norm, lerp } from '../../core/math/vec.js';
import { sculptEyeSocket } from '../../core/sdf/eyeSocket.js';

// Eye spec (core/sdf/eyeSocket.js) for this individual: round aperture (no lids: a spectacle),
// iris filling the whole visible eye.
export function eyeSpec(params) {
  const B = bodyPlan(params);
  const e = B.P.eye, k = B.kH * (params.age === 'juvenile' ? 1.15 : 1);
  const r = e.r * k;
  return {
    c: [e.at[0] * B.kH, e.at[1] * B.kH, e.at[2] * B.kH], r, back: 0.0002 * B.kH, yaw: e.yaw, pitch: e.pitch,
    lid: 0.00015 * B.kH, R: r * 0.96, d: 0, off: 0, tilt: 0, irisZ: r * 0.62, irisR: r * 0.9,
  };
}

export function sculptSnake(m, rig, params) {
  const J = rig.J, B = rig.plan, P = B.P, viper = params.variant === 'rattlesnake';
  const HO = J.v0;
  const hL = B.headLen, W = P.headW * B.kH, H = P.headH * B.kH;
  const yB = -HO[1]; // head-local height of the belly / jaw underside (y = 0 in the world)
  const hl = (v) => [HO[0] + v[0], HO[1] + v[1], HO[2] + v[2]];
  const HB = { bone: 'head' };
  const sym = (f) => { f(1); f(-1); };

  // ---------------------------------------------------------------- BODY
  // round cones of radius = half width; the axis sits at flat * hw, so the circle's lower part is
  // carved off by the belly plane (flat belly with ventrolateral angles, rounded back)
  const hwAt = [];
  let total = 0;
  const sig = [0];
  for (let i = 0; i < SPINE; i++) { total += Math.hypot(...sub(J['v' + (i + 1)], J['v' + i])); sig.push(total); }
  for (let i = 0; i <= SPINE; i++) hwAt.push(B.hw(sig[i] / total));
  for (let i = 0; i < SPINE; i++) {
    m.cone({ tag: i >= SPINE * (1 - B.tailFrac) ? 'tail' : i < 3 ? 'neck' : 'body', bone: 'spine' + i, a: J['v' + i], b: J['v' + (i + 1)], ra: hwAt[i], rb: hwAt[i + 1], k: 0 });
  }
  // thin tail tip: overlapping ellipsoids that the pipeline inflates at coarse tiers (minThick)
  for (let i = SPINE - 12; i < SPINE; i++) {
    const a = J['v' + i], b = J['v' + (i + 1)], rr = (hwAt[i] + hwAt[i + 1]) * 0.5;
    m.ell({ tag: 'tailtip', bone: 'spine' + i, c: lerp(a, b, 0.5), axis: norm(sub(a, b)), r: [rr * 0.98, rr * 0.98, Math.hypot(...sub(a, b)) * 0.62], k: 0, thin: true });
  }
  // ---------------------------------------------------------------- HEAD (upper jaw + braincase)
  if (viper) {
    // broad, triangular: venom-gland bulges at the back, flat crown, blunt canthus, narrow neck
    m.ell({ ...HB, tag: 'cranium', c: hl([0, yB + 0.62 * H, 0.36 * hL]), r: [0.33 * W, 0.34 * H, 0.36 * hL], k: 0.004 });
    sym((s) => m.ell({ ...HB, tag: 'gland', c: hl([0.31 * W * s, yB + 0.5 * H, 0.22 * hL]), r: [0.28 * W, 0.34 * H, 0.27 * hL], axis: norm([0.35 * s, 0, 1]), k: 0.005 }));
    sym((s) => m.ell({ ...HB, tag: 'cheek', c: hl([0.2 * W * s, yB + 0.5 * H, 0.52 * hL]), r: [0.22 * W, 0.3 * H, 0.3 * hL], axis: norm([-0.25 * s, 0, 1]), k: 0.005 }));
    m.ell({ ...HB, tag: 'snout', c: hl([0, yB + 0.58 * H, 0.7 * hL]), r: [0.29 * W, 0.28 * H, 0.25 * hL], k: 0.005 });
    sym((s) => m.ell({ ...HB, tag: 'lip', c: hl([0.26 * W * s, yB + 0.38 * H, 0.5 * hL]), r: [0.16 * W, 0.16 * H, 0.44 * hL], axis: norm([-0.28 * s, 0, 1]), k: 0.004 }));
    m.sphere({ ...HB, tag: 'rostral', c: hl([0, yB + 0.5 * H, 0.94 * hL]), rad: 0.13 * W, k: 0.004 });
    // supraocular scales: a brow shelf over each eye
    const E = eyeSpec(params);
    sym((s) => m.ell({ ...HB, tag: 'brow', c: hl([E.c[0] * s * 0.95, E.c[1] + E.r * 0.95, E.c[2]]), r: [E.r * 1.25, E.r * 0.5, E.r * 1.5], k: 0.0015 }));
  } else {
    // corn snake: barely wider than the neck, long rounded snout, domed crown
    m.ell({ ...HB, tag: 'cranium', c: hl([0, yB + 0.6 * H, 0.34 * hL]), r: [0.42 * W, 0.4 * H, 0.4 * hL], k: 0.004 });
    sym((s) => m.ell({ ...HB, tag: 'temporal', c: hl([0.2 * W * s, yB + 0.5 * H, 0.2 * hL]), r: [0.28 * W, 0.36 * H, 0.3 * hL], k: 0.004 }));
    m.ell({ ...HB, tag: 'snout', c: hl([0, yB + 0.56 * H, 0.72 * hL]), r: [0.29 * W, 0.34 * H, 0.3 * hL], axis: norm([0, -0.08, 1]), k: 0.005 });
    sym((s) => m.ell({ ...HB, tag: 'lip', c: hl([0.24 * W * s, yB + 0.4 * H, 0.52 * hL]), r: [0.19 * W, 0.2 * H, 0.42 * hL], axis: norm([-0.22 * s, 0, 1]), k: 0.004 }));
    m.sphere({ ...HB, tag: 'rostral', c: hl([0, yB + 0.5 * H, 0.92 * hL]), rad: 0.17 * W, k: 0.004 });
  }
  // neck: blend the cranium into the first body cone
  m.cone({ ...HB, tag: 'nape', a: hl([0, 0, 0.18 * hL]), b: hl([0, 0, -0.25 * hL]), ra: 0.3 * W, rb: hwAt[0] * 1.02, k: 0.01 });
  // eyes in round sockets (the spectacle sits flush), nostrils, rostral notch for the tongue
  const E = eyeSpec(params);
  sym((s) => sculptEyeSocket(m, E, HO, s, { bone: 'head', orbit: { r: [E.r * 0.95, E.r * 0.8, E.r * 0.45], at: [0, 0, E.r * 1.0], k: E.r * 0.35 } }));
  sym((s) => m.sphere({ ...HB, tag: 'nostril', c: hl([0.17 * W * s, yB + 0.62 * H, 0.95 * hL]), rad: 0.04 * W, k: 0.0006, carve: true }));
  if (viper) sym((s) => m.sphere({ ...HB, tag: 'pit', c: hl([0.33 * W * s, yB + 0.48 * H, 0.8 * hL]), rad: 0.05 * W, k: 0.0006, carve: true }));
  m.ell({ ...HB, tag: 'notch', c: hl([0, yB + 0.36 * H, 0.99 * hL]), r: [0.07 * W, 0.07 * H, 0.05 * hL], k: 0.0006, carve: true });

  // palate: the upper jaw ends at the lip line (the lower jaw is its own surface)
  m.ell({ ...HB, tag: 'palate', c: hl([0, yB + 0.1 * H, 0.62 * hL]), r: [0.33 * W, 0.26 * H, 0.5 * hL], k: 0.0012, carve: true });
  // belly plane: a very flat carving ellipsoid whose top is y = 0 (sag < 0.2 mm over the body)
  const zMid = (J.v0[2] + J['v' + SPINE][2]) * 0.5;
  m.ell({ tag: 'belly', bone: 'spine' + (SPINE >> 1), c: [0, -0.012, zMid], r: [0.4, 0.012, 3.2], k: 0.18 * hwAt[SPINE >> 1], carve: true });

  // ---------------------------------------------------------------- LOWER JAW (own surface)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  sym((s) => m.cone({ ...JW, tag: 'mandible', a: hl([(viper ? 0.34 : 0.3) * W * s, yB + 0.22 * H, 0.08 * hL]), b: hl([0.07 * W * s, yB + 0.17 * H, 0.88 * hL]), ra: viper ? 0.14 * H + 0.05 * W : 0.11 * H + 0.03 * W, rb: viper ? 0.1 * H : 0.085 * H, k: 0.003 }));
  m.ell({ ...JW, tag: 'jawfloor', c: hl([0, yB + 0.19 * H, 0.46 * hL]), r: [0.3 * W, 0.18 * H, 0.42 * hL], k: 0.003 });
  m.sphere({ ...JW, tag: 'chin', c: hl([0, yB + 0.2 * H, 0.9 * hL]), rad: 0.14 * H, k: 0.003 });

  // ---------------------------------------------------------------- TONGUE (two rigid pieces)
  const tb = J.tongueBase, tf = J.tongueFork, tt = J.tongueTip;
  const tr = 0.0007 * B.kH * (viper ? 1.25 : 1);
  m.cone({ bone: 'tongue', group: 'tongue', part: 'tongue', tag: 'tongue', a: tb, b: add(tf, [0, 0, tr]), ra: tr * 1.1, rb: tr * 0.85, k: 0 });
  const forkLen = Math.hypot(...sub(tt, tf));
  sym((s) => m.cone({ bone: 'tongueTip', group: 'tongue', part: 'fork', tag: 'fork', a: add(tf, [0, 0, -tr * 0.5]), b: add(tt, [s * forkLen * 0.28, 0, 0]), ra: tr * 0.8, rb: tr * 0.32, k: tr * 0.6 }));

  // ---------------------------------------------------------------- FANGS (rattlesnake)
  if (viper) {
    const fb = J.fangBase, ft = J.fangTip;
    sym((s) => m.cone({ bone: 'fang', group: 'fang', part: 'fang', tag: 'fang', a: add(fb, [0.2 * W * s, 0, 0]), b: add(ft, [0.2 * W * s, 0, 0]), ra: 0.0009 * B.kH, rb: 0.00015, k: 0 }));
  }

  // ---------------------------------------------------------------- RATTLE
  if (P.rattle) {
    const last = 'spine' + (SPINE - 1);
    const a = J['v' + (SPINE - 1)], b = J['v' + SPINE];
    const d = norm(sub(b, a));
    const nSeg = params.rattleSegs ?? P.rattle.segs;
    const tip = hwAt[SPINE];
    const segL = (P.rattle.len / P.rattle.segs) * (params.shape?.girth ?? 1);
    for (let k = 0; k < nSeg; k++) {
      const t = k / Math.max(1, P.rattle.segs - 1);
      const w = tip * (1.35 - 0.3 * t);
      const c0 = add(b, mul(d, segL * (k + 0.55)));
      // the rattle rests on (not in) the ground: lift a segment whose half height exceeds the tip's axis height
      const c = [c0[0], Math.max(c0[1], w * 0.78 + 0.0003), c0[2]];
      // each segment: a flattened, bi-lobed bell overlapping the next
      m.ell({ bone: last, part: 'rattle', group: 'rattle', tag: 'rattle', c, axis: d, r: [w, w * 0.78, segL * 0.62], k: segL * 0.25 });
      m.ell({ bone: last, part: 'rattle', group: 'rattle', tag: 'rattle', c: add(c, mul(d, segL * 0.35)), axis: d, r: [w * 0.82, w * 0.62, segL * 0.38], k: segL * 0.2 });
    }
    // the tail tip plugs into the button
    m.ell({ bone: last, part: 'rattle', group: 'rattle', tag: 'button', c: ((q) => [q[0], Math.max(q[1], tip * 0.9 + 0.0003), q[2]])(add(b, mul(d, -segL * 0.2))), axis: d, r: [tip * 1.05, tip * 0.9, segL * 0.7], k: 0 });
  }
  return m;
}
