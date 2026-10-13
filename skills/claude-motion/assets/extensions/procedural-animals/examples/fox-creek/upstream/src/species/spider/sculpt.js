// The spider, sculpted as a signed distance field (reference space, metres).
//
// Parts (meshed separately, see regions.js): 'body' (prosoma, pedicel, abdomen, spinnerets, palps,
// coxae and trochanters), one part per leg ('legL1' .. 'legR4': coxa -> tarsus, the coxa and
// trochanter duplicated so both surfaces agree across the cut), 'chelL'/'chelR' (rigid chelicerae)
// and 'fangL'/'fangR' (rigid fangs). Eyes are glossy domes (look.lids 'simple') set in shallow
// sockets on the head.
import { spiderDims } from './rig.js';
import { legJoints, legBones, palpJoints, palpBones } from '../../core/rig/spider.js';
import { add, sub, mul, lerp, norm, cross, len } from '../../core/math/vec.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { QUALITY } from '../../core/build/pipeline.js';

const M = 0.001;
const mm = (v) => v.map((x) => x * M);

// Eyes per variant (mm, head-local: relative to the ceph joint; left side). r: radius; yaw: outward
// divergence of the view axis (rad, > PI/2 looks backward); pitch: upward tilt; back: how far the
// dome centre sits inside the surface point.
export const EYES = {
  // Lycosidae 4-2-2: a straight anterior row of 4 small eyes above the chelicerae, 2 huge posterior
  // median eyes looking forward, 2 posterior lateral eyes on top looking up and back
  wolf: [
    // (set into the carapace surface: the domes bulge ~0.4 r; the PME sit on the front of the face)
    { name: 'PME', c: [1.02, 1.2, 4.57], r: 0.47, yaw: 0.14, pitch: 0.02, back: 0.2 },
    { name: 'PLE', c: [1.78, 1.54, 2.72], r: 0.3, yaw: 2.1, pitch: 0.75, back: 0.14 },
    { name: 'AME', c: [0.42, 0.3, 5.26], r: 0.22, yaw: 0.05, pitch: -0.05, back: 0.07 },
    { name: 'ALE', c: [1.0, 0.3, 5.05], r: 0.17, yaw: 0.55, pitch: -0.05, back: 0.05 },
  ],
  // Theraphosidae: 8 small eyes clustered on a raised ocular tubercle
  tarantula: [
    { name: 'AME', c: [0.62, 2.55, 6.1], r: 0.5, yaw: 0.08, pitch: 0.5, back: 0.2 },
    { name: 'ALE', c: [1.62, 2.05, 6.25], r: 0.52, yaw: 0.6, pitch: 0.25, back: 0.2 },
    { name: 'PME', c: [0.85, 2.6, 5.05], r: 0.3, yaw: 0.5, pitch: 1.0, back: 0.12 },
    { name: 'PLE', c: [1.72, 2.2, 4.75], r: 0.42, yaw: 1.7, pitch: 0.45, back: 0.16 },
  ],
};

export function eyeSpec(e) {
  const r = e.r * M;
  return { c: mm(e.c), r, back: e.back * M, yaw: e.yaw, pitch: e.pitch, tilt: 0, lid: 0, R: r * 1.1, d: r * 0.6, off: 0, irisZ: r * 0.6, irisR: r * 0.8, name: e.name };
}

// minimum radius of thin parts per quality tier (coarse meshes would lose the tarsi otherwise)
const MIN_R = { hero: 0, high: 0, medium: 0.26, low: 0.4, crowd: 0.58 }; // ~ one cell: legs stay >= 2 voxels thick

export function sculptSpider(m, rig, params) {
  const J = rig.J, d = spiderDims(params);
  const F = d.unit / 0.013; // size relative to the wolf spider
  const minR = (MIN_R[params.quality] ?? 0) * M * F;
  const R = (r) => Math.max(r * M, minR);
  const HO = J.ceph;
  const hl = (v) => add(HO, mm(v));
  const X = [1, 0, 0];
  const ellY = (o) => {
    const y = norm(o.ydir);
    const z = norm(cross(o.lateral || X, y));
    return m.ell({ ...o, axis: z, up: y });
  };
  const wolf = d.variant === 'wolf';
  const C = d.carapace;
  const z0 = J.pedA[2] / M, z1 = J.front[2] / M, Lc = z1 - z0;
  const B = { bone: 'prosoma', group: 'axial', part: 'body' };
  const H = { bone: 'head', group: 'axial', part: 'body' };

  // ------------------------------------------------------------------ PROSOMA
  // carapace: thoracic dome, raised cephalic region, sloping rear; sternum below
  const thTop = C.rearTop + (C.top - C.rearTop) * (wolf ? 0.55 : 0.75);
  m.ell({ ...B, tag: 'thorax', c: mm([0, (thTop + C.bottom) / 2, z0 + 0.42 * Lc]), r: mm([C.wid / 2, (thTop - C.bottom) / 2, 0.41 * Lc]), k: 0 });
  m.ell({ ...B, tag: 'thoraxRear', c: mm([0, (C.rearTop + C.bottom) / 2 + 0.2 * F, z0 + 0.2 * Lc]), r: mm([C.wid * 0.36, (C.rearTop - C.bottom) / 2, 0.2 * Lc]), k: 0.9 * M * F });
  m.ell({ ...H, tag: 'cephalic', c: mm([0, C.top - (wolf ? 2.3 : 3.2) * F, z0 + 0.78 * Lc]), r: mm([C.headW / 2, (wolf ? 2.3 : 3.2) * F, 0.26 * Lc]), axis: norm([0, wolf ? 0.18 : 0.05, 1]), k: 1.2 * M * F });
  // clypeus: the face between the anterior eyes and the chelicerae
  m.ell({ ...H, tag: 'clypeus', c: add(J.front, mm([0, -0.2 * F, -0.9 * F])), r: mm([C.headW * 0.36, 1.1 * F, 0.9 * F]), k: 0.8 * M * F });
  m.ell({ ...B, tag: 'sternum', c: mm([0, C.bottom + 0.45 * F, z0 + 0.5 * Lc]), r: mm([C.wid * 0.27, 0.7 * F, 0.3 * Lc]), k: 0.8 * M * F });
  // labium and endites (mouthparts between the palp coxae)
  m.ell({ ...B, tag: 'labium', c: mm([0, C.bottom + 0.6 * F, z0 + 0.86 * Lc]), r: mm([0.9 * F, 0.55 * F, 0.9 * F]), k: 0.5 * M * F });
  // fovea: a short median groove on the thoracic dome, and the cephalic groove
  m.ell({ ...B, tag: 'fovea', c: mm([0, thTop + 0.02 * F, z0 + 0.36 * Lc]), r: mm([0.16 * F, 0.3 * F, 0.9 * F]), k: 0.25 * M * F, carve: true });
  if (!wolf) {
    // tarantula: low wide carapace with a raised ocular tubercle
    m.ell({ ...H, tag: 'tubercle', c: hl([0, 1.7, 5.4]), r: mm([2.3, 1.3, 1.9]), k: 1.1 * M * F });
  }

  // ------------------------------------------------------------------ EYES (sockets; the domes are eye meshes)
  for (const e of EYES[d.variant]) {
    const E = eyeSpec(e);
    for (const s of [1, -1]) {
      const ef = eyeFrameOf(E, HO, s);
      // a raised rim around the lens, cut open by the socket the dome sits in
      m.sphere({ ...H, tag: 'eyerim', c: add(ef.c, mul(ef.z, -E.r * 0.25)), rad: E.r * 1.05, k: E.r * 0.6 });
      m.sphere({ ...H, tag: 'eyesocket', c: add(ef.c, mul(ef.z, E.r * 0.1)), rad: E.r * 0.98, k: E.r * 0.15, carve: true });
    }
  }

  // ------------------------------------------------------------------ PEDICEL, ABDOMEN, SPINNERETS
  const A = { bone: 'abdomen', group: 'axial', part: 'body' };
  m.cone({ bone: 'pedicel', group: 'axial', part: 'body', tag: 'pedicel', a: J.pedA, b: J.pedB, ra: (wolf ? 0.75 : 1.9) * M * F / F * (wolf ? 1 : 1), rb: (wolf ? 0.7 : 1.8) * M, k: 0.3 * M * F });
  const ac = mm(d.abdomen.c), ar = mm(d.abdomen.r);
  m.ell({ ...A, tag: 'abdomen', c: ac, r: ar, axis: norm([0, 0.06, 1]), k: 0 });
  m.ell({ ...A, tag: 'abdomenFront', c: add(ac, [0, -ar[1] * 0.05, ar[2] * 0.52]), r: [ar[0] * 0.7, ar[1] * 0.72, ar[2] * 0.45], k: 1.0 * M * F });
  m.ell({ ...A, tag: 'abdomenRear', c: add(ac, [0, -ar[1] * 0.12, -ar[2] * 0.6]), r: [ar[0] * 0.72, ar[1] * 0.72, ar[2] * 0.42], k: 1.2 * M * F });
  // spinnerets: wolf 3 short pairs; tarantula 2 visible pairs, the posterior pair long and finger-like
  const SP = { bone: 'spinnerets', group: 'axial', part: 'body', tag: 'spinneret' };
  const st = J.abdEnd, sd = norm(sub(J.spinTip, J.abdEnd)), sl = len(sub(J.spinTip, J.abdEnd));
  for (const s of [1, -1]) {
    if (wolf) {
      m.cone({ ...SP, a: add(st, mm([0.45 * s, -0.25, 0.3])), b: add(add(st, mul(sd, sl * 0.9)), mm([0.5 * s, -0.2, 0])), ra: d.spinR * M, rb: d.spinR * 0.7 * M, k: 0.25 * M });
      m.cone({ ...SP, a: add(st, mm([0.2 * s, -0.6, 0.3])), b: add(add(st, mul(sd, sl * 0.7)), mm([0.2 * s, -0.55, 0])), ra: d.spinR * 0.8 * M, rb: d.spinR * 0.55 * M, k: 0.25 * M });
    } else {
      m.cone({ ...SP, a: add(st, mm([1.1 * s, -0.4, 0.8])), b: add(add(st, mul(sd, sl * 1.15)), mm([1.9 * s, 0.9, 0])), ra: d.spinR * M, rb: d.spinR * 0.62 * M, k: 0.8 * M });
      m.cone({ ...SP, a: add(st, mm([0.55 * s, -1.2, 0.8])), b: add(add(st, mul(sd, sl * 0.45)), mm([0.6 * s, -1.4, 0])), ra: d.spinR * 0.6 * M, rb: d.spinR * 0.45 * M, k: 0.6 * M });
    }
  }

  // ------------------------------------------------------------------ CHELICERAE AND FANGS (rigid parts)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const b0 = J['cheBase' + S], b1 = J['cheTip' + S], ft = J['fangTip' + S];
    const CH = { bone: 'chelicera' + S, group: 'chel' + S, part: 'chel' + S };
    const cr = d.chel.r.map((r) => r * M);
    const dir = norm(sub(b1, b0));
    m.cone({ ...CH, tag: 'chelicera', a: b0, b: add(b1, mul(dir, -cr[1] * 0.4)), ra: cr[0], rb: cr[1], k: 0 });
    // the stout basal boss bulging forward (wolf) / the long forward-projecting paturon (tarantula)
    ellY({ ...CH, tag: 'chelicera', c: add(lerp(b0, b1, 0.35), mm([0.1 * s * F, 0, (wolf ? 0.35 : 0.8) * F])), ydir: dir, r: [cr[0] * 0.92, len(sub(b1, b0)) * 0.4, cr[0] * 0.95], k: 0.5 * M * F });
    // fang groove with its row of teeth: a shallow furrow on the inner face
    ellY({ ...CH, tag: 'fangGroove', c: add(lerp(b0, b1, 0.8), mm([-0.55 * s * F, 0, 0.1 * F])), ydir: dir, r: [cr[1] * 0.35, len(sub(b1, b0)) * 0.22, cr[1] * 0.4], k: 0.2 * M * F, carve: true });
    const FG = { bone: 'fang' + S, group: 'fang' + S, part: 'fang' + S, tag: 'fang' };
    const fr = d.chel.fangR * M;
    // a curved fang: base, then bending toward the tip
    const fd = norm(sub(ft, b1)), fl = len(sub(ft, b1));
    const bend = norm(cross(fd, [s, 0, 0]));
    const mid = add(lerp(b1, ft, 0.5), mul(bend, fl * 0.12));
    m.cone({ ...FG, a: add(b1, mul(fd, -fr * 0.5)), b: mid, ra: fr, rb: fr * 0.62, k: 0.08 * M * F });
    m.cone({ ...FG, a: mid, b: ft, ra: fr * 0.62, rb: fr * 0.12, k: 0.08 * M * F });
  }

  // ------------------------------------------------------------------ PALPS (body part)
  for (const S of ['L', 'R']) {
    const pj = palpJoints(S), pb = palpBones(S);
    const g = { group: 'P' + S, part: 'body' };
    for (let k = 0; k < pb.length; k++) {
      const [ra, rb] = d.palp.r[k];
      const a = J[pj[k]], b = J[pj[k + 1]];
      m.cone({ ...g, bone: pb[k], tag: k === 0 ? 'palpcoxa' : 'palp', a, b, ra: R(ra * F / F), rb: R(rb), k: (k === 0 ? 0.6 : 0.09) * M * F });
      if (k > 0 && k < pb.length - 1) m.sphere({ ...g, bone: pb[k], tag: 'knuckle', c: b, rad: R(rb * 1.08), k: 0.08 * M * F });
    }
    if (d.palpBulb > 0) {
      // male: the swollen cymbium / palpal bulb ("boxing gloves")
      const a = J[pj[5]], b = J[pj[6]];
      // (swollen but compact: about the width of the palp tibia plus a third)
      ellY({ ...g, bone: pb[5], tag: 'palpbulb', c: lerp(a, b, 0.5), ydir: sub(b, a), r: mm([0.65 * (0.62 * F * d.palpBulb + 0.3 * F), len(sub(b, a)) / M * 0.36, 0.65 * (0.7 * F * d.palpBulb + 0.3 * F)]), k: 0.2 * M * F });
    }
  }

  // ------------------------------------------------------------------ LEGS
  for (const S of ['L', 'R']) {
    for (let i = 1; i <= 4; i++) {
      const lj = legJoints(i, S), lb = legBones(i, S), key = S + i;
      const thick = i === 4 ? d.hindR : i === 3 ? (1 + d.hindR) / 2 : 1;
      for (let k = 0; k < 7; k++) {
        const [ra, rb] = d.legR[k];
        const a = J[lj[k]], b = J[lj[k + 1]];
        const parts = k <= 2 ? ['body', 'leg' + key] : ['leg' + key];
        for (const part of parts) {
          const g = { group: key, part, bone: lb[k] };
          if (k === 0) {
            // coxa: a stout cylinder set into the prosoma between carapace margin and sternum
            m.cone({ ...g, tag: 'coxa', a: add(a, mul(norm(sub(b, a)), -0.6 * M * F)), b, ra: R(ra * thick), rb: R(rb * thick), k: part === 'body' ? 0.55 * M * F : 0.1 * M * F });
          } else {
            m.cone({ ...g, tag: ['coxa', 'troch', 'femur', 'patella', 'tibia', 'meta', 'tarsus'][k], a, b, ra: R(ra * thick), rb: R(rb * thick), k: 0.07 * M * F });
            // swollen joint condyles: the knee (femur-patella) is the biggest
            if (k < 6) m.sphere({ ...g, tag: 'knuckle', c: add(b, mul(norm(sub(b, a)), -rb * 0.25 * M)), rad: R(rb * thick * (k === 2 ? 1.12 : 1.06)), k: 0.07 * M * F });
          }
        }
      }
      // claw tuft: the rounded tarsus tip
      const tip = J[lj[7]], ta = J[lj[6]];
      m.sphere({ group: key, part: 'leg' + key, bone: lb[6], tag: 'claws', c: add(tip, mul(norm(sub(ta, tip)), d.legR[6][1] * 0.3 * M)), rad: R(d.legR[6][1] * thick * 1.02), k: 0.06 * M * F });
    }
  }
  return m;
}
