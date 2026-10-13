// The chicken sculpted as a signed distance field: the feathered silhouette (contour feathers, the
// fluffy underparts, hackles and saddle are part of the body shape; flight feathers and the tail are
// cards, see core/build/featherCards.js), the bare red head furniture (single comb, wattles,
// earlobes, facial skin), a short stout bill, scaled shanks and toes and, on roosters, spurs.
// Every primitive is attached to a bone and a group (axial / legL / wingL / jaw). Torso primitives are
// written for the reference hen and carried through the individual's torso transform (roosters stand
// more upright); head primitives are head-local (see headLocal) and scale with the head.
import { NECK_SEGS, torsoFn } from './rig.js';
import { add, sub, mul, lerp, norm, cross, dot } from '../../core/math/vec.js';
import { sculptEyeSocket } from '../../core/sdf/eyeSocket.js';
import { wingFK, makeWingFrames, degs, featherFrame, makeFeatherFrame, resolveFeathers } from '../../core/rig/bird.js';
import { vaneWidth } from '../../core/build/featherCards.js';
import { wingFor, feathersFor } from './motion.js';
import { shieldLayout, planFrame } from './coverts.js';

// Eye (head-local, left, reference head): lateral (yaw 66 deg), big (globe r 7 mm), round aperture
// ~9.5 mm, orange iris (see index.js)
export const EYE = { c: [0.0122, 0.0008, 0.0015], r: 0.0068, back: 0.0021, yaw: 1.15, pitch: 0.06, lid: 0.0008, R: 0.0049, d: 0.0003, off: 0.0, tilt: 0, irisZ: 0.0045, irisR: 0.0047 };

export function eyeFor(form = {}) {
  const k = form.headK ?? 1, e = form.eyeK ?? 1;
  return { ...EYE, c: EYE.c.map((x) => x * k), r: EYE.r * k * e, back: EYE.back * k * e, lid: EYE.lid * k, R: EYE.R * k * e, d: EYE.d * k * e, irisZ: EYE.irisZ * k * e, irisR: EYE.irisR * k * e };
}

export function sculptChicken(m, rig, params = {}) {
  const J = rig.J, form = params.form || {};
  const T = torsoFn(form);
  const HO = rig.headOrigin, hk = form.headK ?? 1;
  const hl = (v) => [HO[0] + v[0] * hk, HO[1] + v[1] * hk, HO[2] + v[2] * hk];
  // bill: scaled about its base (a chick's is short)
  const bk = form.billK ?? 1;
  const hb = (v) => hl([v[0] * bk, v[1] * bk, 0.017 + (v[2] - 0.017) * bk]);
  const tv = (v) => { const a = T([0, 0, 0]), b = T(v); return norm(sub(b, a)); };
  // ellipsoid whose local Y follows ydir and local X follows (roughly) xdir; r = [x, y, z]
  const ellY = (o) => {
    const y = norm(o.ydir);
    let x = o.xdir || [1, 0, 0];
    x = norm(sub(x, mul(y, dot(x, y))));
    const z = cross(x, y);
    return m.ell({ ...o, axis: z, up: y });
  };
  const A = { bone: 'chest' }, Pv = { bone: 'pelvis' };
  const juv = !!form.chick, male = params.sex === 'male' && !juv;
  const fl = form.fluff ?? 1; // loose-feathered breeds are bulkier underneath

  if (juv) {
    sculptChickBody(m, J, form);
    // (its folded wing lies on the ball in a shallow bed: folded inside the ball, every wing beat brought
    // the feathers out through its down)
    flankUnderWing(m, J, form, FLANK_CHICK);
    wingPocket(m, J, form);
  }
  else {
    // ------------------------------------------------------------ TORSO (feathered)
    const E = (o) => m.ell({ ...o, c: T(o.c), axis: tv(o.axis || [0, 0, 1]), up: tv(o.up || [0, 1, 0]) });
    E({ ...A, tag: 'breast', c: [0, 0.184, 0.06], r: [0.066, 0.078, 0.074], axis: [0, 0.3, 1], k: 0 });
    E({ ...A, tag: 'keel', c: [0, 0.142, 0.036], r: [0.054, 0.054, 0.064], k: 0.03 });
    E({ ...A, tag: 'mantle', c: [0, 0.236, -0.012], r: [0.064, 0.048, 0.108], axis: [0, 0.03, 1], k: 0.03 });
    E({ ...Pv, tag: 'belly', c: [0, 0.136 - 0.006 * (fl - 1), -0.055], r: [0.064 * fl, 0.066 * fl, 0.086], k: 0.035 });
    E({ ...Pv, tag: 'cushion', c: [0, 0.246, -0.108], r: [0.052, 0.052, 0.062], axis: [0, 0.5, -1], k: 0.035 });
    E({ ...Pv, tag: 'vent', c: [0, 0.165, -0.128], r: [0.052 * fl, 0.062, 0.052], k: 0.03 });
    E({ ...A, tag: 'crop', c: [0, 0.222, 0.092], r: [0.034, 0.034, 0.03], k: 0.03 });
    for (const s of [1, -1]) {
      E({ ...Pv, tag: 'flankfold', c: [0.048 * s * fl, 0.15, -0.025], r: [0.03, 0.058, 0.08], k: 0.03 });
      E({ ...A, tag: 'scapular', c: [0.04 * s, 0.25, 0.008], r: [0.026, 0.018, 0.06], axis: [0, 0.08, 1], k: 0.025 });
      E({ ...Pv, tag: 'fluff', c: [0.034 * s * fl, 0.1, -0.062], r: [0.03 * fl, 0.034, 0.058], k: 0.03 });
    }
    if (male) {
      // saddle hackles: long pointed feathers hanging from the back over the wing tips and thighs
      for (const s of [1, -1]) E({ ...Pv, tag: 'saddle', c: [0.034 * s, 0.22, -0.09], r: [0.028, 0.052, 0.055], axis: [0, -0.6, -1], k: 0.03 });
    }
    flankPad(m, J, form);
    flankUnderWing(m, J, form);
    wingPocket(m, J, form);
    wingBend(m, J, form);
    // tail coverts (the base of the roof-shaped tail; the rectrices are cards)
    const tb = J.tailBase, tt = J.tailTip;
    const td = norm(sub(tt, tb));
    m.ell({ bone: 'tail', tag: 'uppertail', c: add(lerp(tb, tt, 0.6), mul(td, 0.012)), r: [0.024, 0.034, 0.03], axis: td, up: [0, 1, 0], k: 0.025 });
    m.ell({ bone: 'tail', tag: 'undertail', c: add(lerp(tb, tt, 0.3), [0, -0.022, -0.01]), r: [0.028, 0.03, 0.03], k: 0.025 });
  }

  // ---------------------------------------------------------------- NECK (hackles)
  const nj = ['neckBase', ...Array.from({ length: NECK_SEGS - 1 }, (_, i) => 'neck' + (i + 1)), 'occiput'];
  const r0 = (juv ? 0.03 : 0.036) * (male ? 1.08 : 1), r1 = 0.0175 * hk;
  const nr = nj.map((_, i) => { const u = i / NECK_SEGS; return r0 + (r1 - r0) * Math.pow(u, 0.75); });
  for (let i = 0; i < NECK_SEGS; i++) m.cone({ bone: 'neck' + i, tag: 'neck', a: J[nj[i]], b: J[nj[i + 1]], ra: nr[i], rb: nr[i + 1], k: 0.02 });
  if (!juv) {
    // the hackle cape: neck feathers flowing down over the shoulders (long and full on roosters)
    const nb = J.neckBase, n1 = J.neck1, n2 = J.neck2;
    const back = [0, 0.004, -0.018];
    m.ell({ bone: 'neck0', tag: 'hackle', c: add(lerp(nb, n1, 0.4), back), r: [0.042 * (male ? 1.12 : 1), 0.04, 0.036], k: 0.025 });
    m.ell({ bone: 'neck1', tag: 'hackle', c: add(lerp(n1, n2, 0.5), [0, 0, -0.01]), r: [0.03 * (male ? 1.1 : 1), 0.03, 0.028], k: 0.02 });
    if (male) m.ell({ bone: 'neck0', tag: 'hackle', c: add(nb, [0, -0.01, -0.03]), r: [0.05, 0.04, 0.04], k: 0.03 });
  }

  // ---------------------------------------------------------------- HEAD (head-local, see HO)
  const H = { bone: 'head' };
  m.ell({ ...H, tag: 'cranium', c: hl([0, 0.003, -0.006]), r: [0.0142 * hk, 0.0152 * hk, 0.02 * hk], k: 0.01 });
  m.ell({ ...H, tag: 'crown', c: hl([0, 0.0095, 0.007]), r: [0.0105 * hk, 0.0078 * hk, 0.016 * hk], axis: norm([0, -0.25, 1]), k: 0.008 });
  m.ell({ ...H, tag: 'nape', c: hl([0, -0.005, -0.017]), r: [0.0135 * hk, 0.0165 * hk, 0.016 * hk], k: 0.01 });
  m.ell({ ...H, tag: 'chin', c: hl([0, -0.0135, 0.008]), r: [0.0085 * hk, 0.0085 * hk, 0.017 * hk], axis: norm([0, 0.2, 1]), k: 0.008 });
  const EYEI = eyeFor(form);
  for (const s of [1, -1]) {
    m.ell({ ...H, tag: 'face', c: hl([0.0074 * s, -0.0058, 0.0075]), r: [0.006 * hk, 0.0092 * hk, 0.013 * hk], k: 0.007 });
    m.ell({ ...H, tag: 'brow', c: hl([0.0095 * s, 0.0082, 0.003]), r: [0.0058 * hk, 0.0045 * hk, 0.011 * hk], k: 0.005 });
    sculptEyeSocket(m, EYEI, HO, s, { bone: 'head' });
  }
  // upper mandible: stout, triangular in profile, the culmen continuing the forehead down to the tip;
  // the lores taper the face into it
  for (const s of [1, -1]) m.ell({ ...H, tag: 'lores', c: hl([0.0042 * s, -0.0025, 0.017]), r: [0.0048 * hk, 0.0078 * hk, 0.009 * hk], k: 0.006 });
  m.ell({ ...H, tag: 'bill', c: hb([0, -0.0025, 0.027]), r: [0.0048 * hk * bk, 0.0068 * hk * bk, 0.0115 * hk * bk], axis: norm([0, -0.16, 1]), k: 0.005 });
  m.cone({ ...H, tag: 'bill', a: hb([0, -0.0004, 0.031]), b: hb([0, -0.0072, 0.0452]), ra: 0.0042 * hk * bk, rb: 0.0007 * hk * bk, k: 0.004 });
  m.cone({ ...H, tag: 'bill', a: hb([0, -0.006, 0.03]), b: hb([0, -0.0075, 0.043]), ra: 0.0035 * hk * bk, rb: 0.0008 * hk * bk, k: 0.003 });
  for (const s of [1, -1]) m.ell({ ...H, tag: 'nostril', c: hb([0.0038 * s, 0.0006, 0.0262]), r: [0.001 * hk * bk, 0.0008 * hk * bk, 0.0022 * hk * bk], k: 0.0006, carve: true });
  // lower mandible (own surface so the bill can open)
  const Jw = { bone: 'jaw', part: 'jaw' };
  m.ell({ ...Jw, tag: 'mandible', c: hb([0, -0.0082, 0.026]), r: [0.0052 * hk * bk, 0.0028 * hk * bk, 0.013 * hk * bk], axis: norm([0, 0.05, 1]), k: 0.003 });
  m.cone({ ...Jw, tag: 'mandible', a: hb([0, -0.0082, 0.033]), b: hb([0, -0.0078, 0.0418]), ra: 0.0034 * hk * bk, rb: 0.0007 * hk * bk, k: 0.003 });

  if (!juv) {
    // single comb: a thin serrated blade along the crown from the bill base back over the nape
    const cb = form.comb ?? 1, ch = form.combH ?? 1, flop = form.combFlop ?? 0;
    const C = (v) => {
      // a large hen's comb (leghorn) flops over to one side: bend the blade about the crown line
      let [x, y, z] = v;
      if (flop) { const a = flop * Math.max(0, y - 0.012) / 0.03; x += Math.sin(a) * (y - 0.012) * 0.9; y = 0.012 + (y - 0.012) * Math.cos(a); }
      return hl([x, y, z]);
    };
    const bladeZ = [0.024 * 1, -0.016 - 0.012 * (cb - 1)];
    const zs = (u) => bladeZ[0] + (bladeZ[1] - bladeZ[0]) * u;
    m.ell({ ...H, tag: 'comb', thin: true, c: C([0, 0.0165, zs(0.45)]), r: [0.0021 * hk, 0.0075 * Math.sqrt(ch) * hk, 0.024 * cb * hk], axis: norm([0, 0.08, 1]), k: 0.004 });
    // the leader: the blade continues back over the nape
    m.ell({ ...H, tag: 'comb', thin: true, c: C([0, 0.018 + 0.004 * ch, zs(0.98)]), r: [0.0019 * hk, 0.0075 * ch * hk, 0.009 * cb * hk], axis: norm([0, 0.3, -1]), k: 0.004 });
    const nPts = 5;
    for (let i = 0; i < nPts; i++) {
      const u = (i + 0.5) / nPts;
      const h = (0.012 + 0.009 * Math.sin(Math.PI * (0.15 + 0.8 * u))) * ch;
      const z = zs(0.08 + 0.78 * u);
      const tilt = -0.3 + 0.6 * u; // front points lean forward, rear points back
      m.ell({ ...H, tag: 'comb', thin: true, c: C([0, 0.021 + h * 0.52, z]), r: [0.0019 * hk, h * 0.6 * hk, 0.0036 * cb * hk], axis: norm([0, tilt, 1]), up: norm([0, 1, -tilt]), k: 0.0016 });
    }
    // wattles: two rounded lobes hanging under the bill
    const wl = form.wattle ?? 1;
    for (const s of [1, -1]) {
      m.ell({ ...H, tag: 'wattle', thin: true, c: hl([0.0024 * s, -0.0145 - 0.0068 * wl, 0.0225]), r: [0.0022 * hk, 0.0082 * wl * hk, 0.0096 * Math.sqrt(wl) * hk], axis: norm([0, 0.15, 1]), k: 0.005 });
    }
    // earlobes: flat ovals below and behind the eye
    const el = form.earlobe ?? 1;
    for (const s of [1, -1]) {
      m.ell({ ...H, tag: 'earlobe', c: hl([0.0118 * s, -0.0105 - 0.002 * (el - 1), -0.009]), r: [0.0024 * hk, 0.0052 * el * hk, 0.0042 * el * hk], axis: norm([0, 0.3, 1]), k: 0.0025 });
    }
  }

  // ---------------------------------------------------------------- LEGS
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', g = 'leg' + S;
    const j = (n) => J[n + S];
    const kn = j('knee'), an = j('ankle'), mt = j('mtp');
    // drumstick: feathered almost to the hock, blended into the belly fluff
    ellY({ bone: 'tibia' + S, group: g, tag: 'thigh', c: lerp(kn, an, 0.22), ydir: sub(an, kn), r: [0.026 * fl, 0.046, 0.03 * fl], k: 0.03 });
    m.cone({ bone: 'tibia' + S, group: g, tag: 'trousers', a: lerp(kn, an, 0.3), b: lerp(kn, an, 0.84), ra: 0.02 * fl, rb: 0.0095, k: 0.014 });
    m.cone({ bone: 'tibia' + S, group: g, tag: 'shank', a: lerp(kn, an, 0.78), b: an, ra: 0.0068, rb: 0.0064, k: 0.004 });
    m.sphere({ bone: 'tarsus' + S, group: g, tag: 'hock', c: add(an, [0, 0, -0.0012]), rad: 0.0074, k: 0.004 });
    // shank: oval (deeper front to back), scaled
    m.cone({ bone: 'tarsus' + S, group: g, tag: 'tarsus', a: an, b: mt, ra: 0.0062, rb: 0.0056, k: 0.003 });
    m.sphere({ bone: 'tarsus' + S, group: g, tag: 'pad', c: add(mt, [0, -0.0004, 0.001]), rad: 0.0052, k: 0.003 });
    // spur: on the inner rear of the shank, a third of the way up, curving up and back
    const sp = form.spur ?? 0;
    if (sp > 0) {
      const base = lerp(mt, an, 0.3);
      const dir = norm([-0.45 * s, 0.25, -1]);
      const tip = add(add(base, mul(dir, 0.02 * sp)), [0, 0.004 * sp, 0]);
      m.cone({ bone: 'tarsus' + S, group: g, tag: 'spur', a: add(base, mul(dir, 0.003)), b: tip, ra: 0.0036 * Math.min(1.2, sp + 0.3), rb: 0.0009, k: 0.0025 });
    }
    for (const t of [1, 2, 3, 4]) {
      const a = mt, b = J[`t${t}m${S}`], c = J[`t${t}t${S}`];
      const tk = form.toeR ?? 1;
      const r0 = (t === 1 ? 0.0038 : 0.0044) * tk;
      m.cone({ bone: `toe${t}a${S}`, group: g, tag: 'toe', a, b, ra: r0, rb: 0.0036 * tk, k: 0.003 });
      m.cone({ bone: `toe${t}b${S}`, group: g, tag: 'toe', a: b, b: lerp(b, c, 0.7), ra: 0.0036 * tk, rb: 0.0027 * tk, k: 0.0025 });
      m.cone({ bone: `toe${t}b${S}`, group: g, tag: 'claw', a: lerp(b, c, 0.62), b: add(c, [0, -0.0012, 0]), ra: 0.0021 * tk, rb: 0.0005, k: 0.0012 });
    }
  }

  // ---------------------------------------------------------------- WINGS (arm; flight feathers are cards)
  const wk = form.wingK ?? 1;
  // the arm's flesh hangs below the bones (ventral) and is thin above them, so the coverts lie on its
  // dorsal side (a 9-12 mm arm above the bone line buried the covert cards: they cut out through it)
  // (a chick's arm hangs further below its bones and blends into the ball over less: the folded pin
  // feathers lie on it with the ball close under it, and a wider web stretched as the wing beat)
  const AV = form.chick ? 1.4 : 0.8, AT = 0.75;
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', g = 'wing' + S;
    const sh = J['shoulder' + S], el = J['elbow' + S], wr = J['wrist' + S], tp = J['handTip' + S];
    let n = norm(cross(sub(el, sh), sub(wr, el)));
    if (n[1] < 0) n = mul(n, -1);
    const seg = (a, b, bone, thick, chord, back, tag, k = 0.01) => {
      const d = norm(sub(b, a));
      const t = mul(norm(cross(n, d)), s); // trailing side
      const c = add(add(lerp(a, b, 0.5), mul(t, back)), mul(n, -thick * AV));
      return ellY({ bone, group: g, tag, c, ydir: d, xdir: n, r: [thick, Math.hypot(...sub(b, a)) * 0.58, chord], k });
    };
    seg(sh, el, 'humerus' + S, 0.012 * wk * AT, 0.02 * wk, 0.005 * wk, 'arm', form.chick ? 0.006 : 0.014);
    seg(el, wr, 'ulna' + S, 0.009 * wk * AT, 0.018 * wk, 0.006 * wk, 'arm');
    seg(wr, tp, 'hand' + S, 0.0065 * wk, 0.016 * wk, 0.005 * wk, 'hand', 0.007);
    // the bend of the wing: one rounded, feathered knob from the patagium to the wrist that the covert
    // roots grow from (the feather stack stands ~1 cm above the bones there; a thin knob left a hollow
    // ringed by the coverts' roots)
    const pa = lerp(sh, el, 0.3);
    ellY({ bone: 'ulna' + S, group: g, tag: 'patagium', c: add(lerp(pa, wr, 0.55), mul(n, 0.0005 * wk)), ydir: sub(wr, pa), xdir: n, r: [0.0085 * wk, Math.hypot(...sub(wr, pa)) * 0.62 + 0.004 * wk, 0.0085 * wk], k: 0.009 });
    m.sphere({ bone: 'hand' + S, group: g, tag: 'wrist', c: wr, rad: 0.0085 * wk, k: 0.007 });
    coverts(m, J, form, s);
  }
}

// The wing's coverts as skin: the folded wing's shield on the forearm (coverts.js: its outline, its top
// fitted just above the flight-feather stack, the row of greater covert cards along its rim, the lid over
// its upper rear corner). A chick has none: its arm is down-covered skin and its pin feathers leave it at
// their roots (its old covert plate stood up through its folded feathers once the wing lay on the ball).
function coverts(m, J, form, s) {
  if (form.chick) return;
  const S = s > 0 ? 'L' : 'R';
  const F = planFrame(J, s);
  // the shield: a slab whose top is the fitted plane (plan mm, heights mm), reaching below the wing plane
  const L = shieldLayout(form).core, [h0, hx, hy] = L.plane;
  const q0 = F.Q(0, 0, h0);
  const U = norm(sub(F.Q(1, 0, h0 + hx), q0));
  let V = sub(F.Q(0, 1, h0 + hy), q0);
  V = norm(sub(V, mul(U, dot(V, U))));
  let Np = cross(U, V);
  if (dot(Np, F.n) < 0) Np = mul(Np, -1);
  const th = L.t * 0.001;
  const o = add(q0, mul(Np, -th / 2));
  const poly = L.poly.map(([x, y]) => { const q = sub(F.Q(x, y, h0 + hx * x + hy * y), q0); return [dot(q, U), dot(q, V)]; });
  m.fin({ bone: 'ulna' + S, group: 'wing' + S, tag: 'coverts', o, u: U, v: V, poly, t: th, round: Math.min(th / 2, L.round * 0.001), k: 0.003, bias: 0.008 });
  const Ld = shieldLayout(form).lid;
  if (Ld) {
    // the lid over the upper rear corner: a plate whose underside is its fitted plane (above the stack)
    const [l0, lx, ly] = Ld.plane;
    const r0 = F.Q(0, 0, l0);
    const LU = norm(sub(F.Q(1, 0, l0 + lx), r0));
    let LV = sub(F.Q(0, 1, l0 + ly), r0);
    LV = norm(sub(LV, mul(LU, dot(LV, LU))));
    let LN = cross(LU, LV);
    if (dot(LN, F.n) < 0) LN = mul(LN, -1);
    const lt = Ld.t * 0.001;
    const lpoly = Ld.poly.map(([x, y]) => { const q = sub(F.Q(x, y, l0 + lx * x + ly * y), r0); return [dot(q, LU), dot(q, LV)]; });
    m.fin({ bone: 'ulna' + S, group: 'wing' + S, tag: 'coverts', o: add(r0, mul(LN, lt / 2)), u: LU, v: LV, poly: lpoly, t: lt, round: Math.min(lt / 2, Ld.round * 0.001), k: Ld.k, bias: 0.008 });
  }
}
// chick: a round ball of down with a big head on a short neck (reference space of a scaled-up chick)
function sculptChickBody(m, J, form) {
  const A = { bone: 'chest' }, Pv = { bone: 'pelvis' };
  const hy = J.hipL[1];
  m.ell({ ...A, tag: 'breast', c: [0, hy + 0.03, 0.03], r: [0.07, 0.07, 0.07], k: 0 });
  m.ell({ ...Pv, tag: 'belly', c: [0, hy - 0.005, -0.025], r: [0.072, 0.065, 0.08], k: 0.04 });
  m.ell({ ...Pv, tag: 'cushion', c: [0, hy + 0.035, -0.06], r: [0.055, 0.05, 0.05], k: 0.04 });
  m.ell({ bone: 'tail', tag: 'uppertail', c: lerp(J.tailBase, J.tailTip, 0.6), r: [0.02, 0.02, 0.02], k: 0.03 });
  for (const s of [1, -1]) {
    m.ell({ ...Pv, tag: 'flankfold', c: [0.05 * s, hy - 0.01, -0.02], r: [0.03, 0.05, 0.06], k: 0.035 });
    m.ell({ ...A, tag: 'scapular', c: [0.045 * s, hy + 0.045, 0.01], r: [0.028, 0.022, 0.045], k: 0.03 });
    m.ell({ ...Pv, tag: 'fluff', c: [0.035 * s, hy - 0.045, -0.035], r: [0.03, 0.03, 0.045], k: 0.03 });
  }
  void form;
}

// The flank under the folded wing is flatter than the barrel of the body around it (the folded wing
// makes the side of a resting bird flat, photos): one broad, soft carver whose inner face is the folded
// wing's plane under its stack (the bottom of the folded primaries), so the body narrows smoothly under
// the wing and the slab bed below (wingPocket) only takes the last few millimetres. Smooth everywhere:
// in flight the flank under the open wing is flattened, not dented. FLANK: centre in the wing's plan
// frame (mm, as coverts.js), radii (along, across, depth, mm), the bed's depth under the wing plane
// (mm) and the blend (m).
export const FLANK = { c: [90, 22], r: [100, 50, 30], under: 1, fluff: 35, k: 0.02 };
// a chick's bed: broad and shallow on its round ball
export const FLANK_CHICK = { c: [80, 8], r: [140, 120, 30], under: 2.5, fluff: 0, k: 0.008 };
function flankUnderWing(m, J, form, C = FLANK) {
  const W = wingFor(form), wk = form.wingK ?? 1;
  const L = { h: W.lengths[0], u: W.lengths[1], m: W.lengths[2] };
  const fr = wingFK(makeWingFrames(), 1, L, degs(W.fold));
  const sh = J.shoulderL;
  const V = (o) => [o.x, o.y, o.z];
  const wr = add(sh, V(fr.wrist)), d = V(fr.dU), n = V(fr.nU), t = norm(cross(n, d));
  const k = 0.001 * wk;
  // (loose-feathered breeds bulge more under the wing: the flank flattens deeper with the fluff)
  const under = C.under + C.fluff * Math.max(0, (form.fluff ?? 1) - 1);
  const c0 = add(add(add(wr, mul(d, -C.c[0] * k)), mul(t, C.c[1] * k)), mul(n, (C.r[2] - under) * k));
  for (const s of [1, -1]) {
    const mr = (p) => [p[0] * s, p[1], p[2]];
    m.ell({ bone: 'chest', tag: 'flankFlat', carve: true, c: mr(c0), r: [C.r[1] * k, C.r[2] * k, C.r[0] * k], axis: mr(mul(d, -1)), up: mr(n), k: C.k * wk });
  }
}

// The flank under the front of the folded wing filled out to its bed (the barrel curves in under the
// wing's front and the stack's lower edge stood off it over a dark hollow, deepest on an upright rooster);
// carved to the bed by flankUnderWing / wingPocket after it. PAD: centre in the wing's plan (mm), radii
// (along, across, depth), the centre's height above the wing plane (mm), blend (m).
export const PAD = { c: [10, 20], r: [45, 22, 14], h: -11, k: 0.016 };
function flankPad(m, J, form) {
  const W = wingFor(form), wk = form.wingK ?? 1, C = PAD;
  const L = { h: W.lengths[0], u: W.lengths[1], m: W.lengths[2] };
  const fr = wingFK(makeWingFrames(), 1, L, degs(W.fold));
  const V = (o) => [o.x, o.y, o.z];
  const wr = add(J.shoulderL, V(fr.wrist)), d = V(fr.dU), n = V(fr.nU), t = norm(cross(n, d));
  const c0 = add(add(add(wr, mul(d, -C.c[0] * 0.001 * wk)), mul(t, C.c[1] * 0.001 * wk)), mul(n, C.h * 0.001));
  for (const s of [1, -1]) {
    const mr = (p) => [p[0] * s, p[1], p[2]];
    m.ell({ bone: 'chest', tag: 'flankPad', c: mr(c0), r: [C.r[1] * 0.001 * wk, C.r[2] * 0.001, C.r[0] * 0.001 * wk], axis: mr(mul(d, -1)), up: mr(n), k: C.k });
  }
}

// The bend of the folded wing tucks under the breast and shoulder feathers (photos: the wrist does not
// show; the front of the folded wing disappears into the side of the breast): a soft mound of the body
// over the folded wrist and the front of the covert shield, from the folded wing's pose (plan mm as
// coverts.js: centre, radii along x / y / the wing's normal, the centre's height above the wing plane).
export const BEND = { c: [-9, -3], r: [19, 20, 14], h: -1.5, k: 0.014 };
function wingBend(m, J, form) {
  const W = wingFor(form), wk = form.wingK ?? 1, C = BEND;
  const L = { h: W.lengths[0], u: W.lengths[1], m: W.lengths[2] };
  const fr = wingFK(makeWingFrames(), 1, L, degs(W.fold));
  const V = (o) => [o.x, o.y, o.z];
  const wr = add(J.shoulderL, V(fr.wrist)), d = V(fr.dU), n = V(fr.nU), t = norm(cross(n, d));
  const c0 = add(add(add(wr, mul(d, -C.c[0] * 0.001 * wk)), mul(t, C.c[1] * 0.001 * wk)), mul(n, C.h * 0.001));
  for (const s of [1, -1]) {
    const mr = (p) => [p[0] * s, p[1], p[2]];
    m.ell({ bone: 'chest', tag: 'wingBend', c: mr(c0), r: [C.r[1] * 0.001 * wk, C.r[2] * 0.001, C.r[0] * 0.001 * wk], axis: mr(mul(d, -1)), up: mr(n), k: C.k });
  }
}

// The wing pocket: the folded wing lies ON the flank (photos: the wing is a shield on the side of the
// body, its flight feathers stacked on the contour feathers), so the flank under it is carved to a bed
// just under the folded stack: one flat slab carver per folded card (primaries, secondaries and their
// coverts: exact planar-polygon distance, the card's own outline inset a little), whose inner face is
// the card's underside less a gap (2 mm: lying, the pelvis turns against the chest and the bed came up to the
// lowest primary). The union of the slabs is the stack's underside, so the bed
// follows its outline: no hollow is carved beyond the cards (a single ellipsoid left a trench around
// the wing), and where the folded wing lies on the barrel of the flank the carve fades to nothing at
// its edges. The folded wing comes from motion.js (wing.fold through the rig's shoulder), so the bed
// follows every individual (a rooster's pitched torso, a fluffy breed's wider flanks, short chick
// wings). Carvers only cut what was sculpted before them: the torso, not the wing's own arm, the legs,
// neck or tail coverts.
export function wingPocket(m, J, form = {}) {
  const W = wingFor(form), F = resolveFeathers(feathersFor(form)), cov = F.coverts;
  const L = { h: W.lengths[0], u: W.lengths[1], m: W.lengths[2] };
  const fr = wingFK(makeWingFrames(), 1, L, degs(W.fold));
  const sh = J.shoulderL;
  const P0 = { x: sh[0] + fr.wrist.x, y: sh[1] + fr.wrist.y, z: sh[2] + fr.wrist.z };
  const ff = makeFeatherFrame();
  const g = 0.002, T = 0.03, inset = 0.004, k = 0.008;
  const V = (o) => [o.x, o.y, o.z];
  const slab = (f, o = {}) => {
    const A = V(ff.axis), N = V(ff.normal), Tv = norm(cross(N, A));
    const fo = o.shape ? { ...f, ...o.shape } : f;
    const len = f.len * (o.lenK || 1), w = f.width * (o.widthK || 1);
    const root = add(add(V(ff.root), mul(N, o.lift || 0)), mul(A, o.shift || 0));
    const arch = fo.arch ?? 0.12;
    // the card in pieces along its length (more where it droops more), each slab as low as the piece's lowest point (the
    // droop at its outer end, the vane edges, half the card's thickness)
    const nS = Math.max(2, Math.min(7, Math.ceil((fo.droop || 0) * len / 0.002)));
    const SEG = Array.from({ length: nS + 1 }, (_, j) => 0.04 + 0.96 * Math.sqrt(j / nS));
    for (let q = 0; q < nS; q++) {
      const t0 = SEG[q], t1 = SEG[q + 1];
      const drop = (fo.droop || 0) * len * t1 * t1 + arch * w * 0.66 + 0.00025;
      const poly = [], back = [];
      for (let i = 0; i <= 4; i++) {
        const t = t0 + (t1 - t0) * i / 4, [wo, wi] = vaneWidth(fo, Math.min(t, 0.99), w), cu = (fo.curve || 0) * len * t * t;
        poly.push([t * len, cu + Math.max(0, wi - inset)]);
        back.push([t * len, cu - Math.max(0, wo - inset)]);
      }
      const pts = poly.concat(back.reverse());
      for (const s of [1, -1]) {
        const mr = (p) => [p[0] * s, p[1], p[2]];
        const o0 = add(root, mul(N, T / 2 - g - drop));
        m.fin({ bone: 'chest', tag: 'wingPocket', carve: true, o: mr(o0), u: mr(A), v: mr(Tv), poly: pts, t: T, round: 0.006, k });
      }
    }
  };
  for (const f of F.primaries) {
    featherFrame(ff, P0, fr.dM, fr.nM, L.m, 1, f, f.fold, false);
    slab(f);
    slab(f, { lenK: cov.primary * (1 - 0.25 * f.i / Math.max(1, f.n - 1)), widthK: 1.05, lift: 0.0022, shift: -0.004, shape: { emarg: 0, tipRound: 0.6, outer: 0.45, curve: 0.02 } });
  }
  for (const f of F.secondaries) {
    featherFrame(ff, P0, fr.dU, fr.nU, L.u, 1, f, f.fold, true);
    slab(f);
    if (!f.cov?.skip) slab(f, { lenK: cov.secondary, widthK: 1.15, lift: 0.0028, shift: -0.006, shape: { tipRound: 0.65, outer: 0.45, curve: 0.02 } });
  }
}
