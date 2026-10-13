// Goat behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js):
//
//   pose(engine, dt)        after the engine's solve: the ruminant's sideways grinding of the lower
//                           jaw while chewing the cud, quick ear flicks (fly flicks, one ear at a time)
//   update(P, dt, layer)    every frame over the action layer: cud chewing bouts (standing or lying),
//                           the short tail flicking up, automatic idle variants (browsing, rearing to
//                           browse, bleating, head shake, pawing, ear flicks), the buck's raised mane
//                           in a threat
//   actions                 browse (reach up, or rear onto the hind legs: opts.rear), bleat, headshake,
//                           paw (scrape the ground with a foreleg), attack (rear up, twist the head,
//                           drop and clash head-down), sleep (sternal, head turned back to the flank)
//
// Posture lengths (headRaise, neckReach, fwd) are engine units (x cfg.k): species metres / cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tqa } from '../../core/motion/common.js';
import { mx, mxLeg, POSTURES, ONESHOTS } from '../../core/motion/actions.js';

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qh = new THREE.Quaternion(), _qI = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4();
const PI = Math.PI;
// lop ears hang with gravity: the share of the way to the standing hang and the largest turn about the root (25 deg:
// a lop ear's root lies in the head / neck skin blend, and turned further the skin round the root stretched 3x)
export const HANG = { f: 0.8, max: 0.44 };
const sm = (w) => w * w * (3 - 2 * w);

function B(e) {
  if (!e._goat) {
    e._goat = {
      cud: 0, cudOn: e.rand() < 0.6, cudT: 6 + e.rand() * 10, chewPh: 0, grind: 0,
      ear: [{ a: 0, age: 9, next: 2 + e.rand() * 4 }, { a: 0, age: 9, next: 3 + e.rand() * 5 }],
      tailT: 1 + e.rand() * 2, tailAge: 9,
      idleT: 5 + e.rand() * 6,
    };
  }
  return e._goat;
}
const busy = (L) => L.postures.length > 0 || L.oneshots.some((a) => !a.stopping);

// ------------------------------------------------------------------------------------------------
// pose: jaw grinding (lateral swing of the mandible) and ear flicks
function pose(e, dt) {
  const b = B(e);
  // udder / scrotum: drawn up out of the ground when the body rests on it (lying, sleeping, dead)
  const ud = e.bone.udder;
  if (ud) {
    // (a buck's scrotum hangs 12.5 cm below the udder bone's top, its bottom 0.325 m in the bind pose; held up until the
    // hindquarters have risen)
    const male = e.params?.sex === 'male';
    const m = ud.matrixWorld.elements, sY = e.J.udderTop.y / 0.44;
    const drop = (male ? 0.125 : 0.168 + 0.065 * (e.params?.udder || 0)) * sY;
    const dl = Math.hypot(m[4], m[5], m[6]) || 1;
    // (lying on its side the udder's axis is level: a lift toward the sky moved it out of the flank, and the rigid bag
    // stood out sideways from the belly like a ball, floating beside the rump. There it hangs toward the ground about
    // its attachment and draws up into the belly along its own axis, against the belly and the lower thigh)
    const side = smooth(0.2, 0.75, 1 + m[5] / dl);
    b.udSide = (b.udSide || 0) + (side - (b.udSide || 0)) * (1 - Math.exp(-dt * 6));
    const top = tv().setFromMatrixPosition(ud.matrixWorld);
    _q.setFromRotationMatrix(ud.matrixWorld);
    if (b.udSide > 1e-3) {
      _qh.setFromUnitVectors(tv(0, 1, 0).applyQuaternion(_q), tv(0, -1, 0)).slerp(_qI, 1 - 0.55 * b.udSide);
      _q.premultiply(_qh);
      top.addScaledVector(tv(0, 1, 0).applyQuaternion(_q), -(0.05 + 0.05 * (e.params?.udder || 0)) * sY * b.udSide);
    }
    // (the udder is its own rigid surface: all of it must clear the ground, up to 20 cm for a doe in milk; a buck's scrotum,
    // 18 cm from the groin, 8 cm: lifted 14.5 cm it vanished into the body when he sat or lay down)
    let want = Math.max(e.P.groundW, e.P.dropH > 0 ? 0.6 * Math.min(1, e.P.dropH) : 0) * (male ? 0.08 : 0.1 + 0.14 * (e.params?.udder || 0)) * e.cfg.s * (1 - b.udSide);
    // ... and at least as much as its lowest point (the teat tips, the scrotum) needs to clear the ground: rising
    // hind end first the posture's weights fell faster than the hindquarters rose, and the udder dipped 7 mm
    // into the ground
    const low = top.y + tv(0, 1, 0).applyQuaternion(_q).y * drop;
    want = Math.max(want, e.terrainH(top.x, top.z) + 0.02 * e.cfg.s - low);
    b.udLift = (b.udLift || 0) + (want - (b.udLift || 0)) * (1 - Math.exp(-dt * 12));
    if (b.udLift > 1e-5 || b.udSide > 1e-3) {
      top.y += Math.max(0, b.udLift);
      ud.matrixWorld.compose(top, _q, _s);
    }
  }
  // beard: a long beard that would reach into the ground (grazing, drinking, lying) swings back
  // about the chin just enough, smoothly
  const bd = e.bone.beard;
  if (bd && (e.params?.beard || 0) > 0.01) {
    const base = tv().setFromMatrixPosition(bd.matrixWorld);
    _q.setFromRotationMatrix(bd.matrixWorld);
    // the beard hangs from the chin skin: it follows the skull more than the opening jaw (the long
    // lock amplified every jaw movement into a whip at its tip)
    if (e.bone.head) { _q2.setFromRotationMatrix(e.bone.head.matrixWorld).multiply(b.beardRel || (b.beardRel = beardRelQ(e))); _q.slerp(_q2, 0.75); }
    const len = b.beardLen ?? (b.beardLen = e.J.beardTop.distanceTo(e.J.beardTip));
    liftOut(e, b.beardSt || (b.beardSt = {}), base, _q, len, dt, 0.04 * e.cfg.s);
    bd.matrixWorld.compose(base, _q, _s);
  }
  // long lop ears (Nubian, Boer) hang below the muzzle: swung forward and out of the ground when
  // grazing or lying
  if (e.params?.ear === 'lop' && e.lod < 2) {
    // ... and they hang with gravity: turned about the root toward the ear's standing hang (turned with the head's yaw),
    // most of the way, while the head is upright (a rigid ear kept its standing angle to the skull, so with the head
    // down to graze or drink it stood out behind the jaw like a plate; the Nubian standard: pendulous ears fall along
    // the face). A head rolled onto its side (dead, lying flat) leaves the ears to the posture.
    const qRel = _q2.setFromRotationMatrix(e.bone.head.matrixWorld).multiply(b.headInv || (b.headInv = e.bindQ.head.clone().invert()));
    const lat = tv(1, 0, 0).applyQuaternion(qRel);
    const psi = Math.atan2(-lat.z, lat.x);
    const hang = HANG.f * (1 - smooth(0.35, 0.7, Math.abs(lat.y)));
    for (let k = 0; k < 2 && hang > 1e-3; k++) {
      const S = k === 0 ? 'L' : 'R', bone = e.bone['ear' + S];
      if (!bone) continue;
      const d0 = b['hang' + S] || (b['hang' + S] = tv(0, 1, 0).applyQuaternion(e.bindQ['ear' + S]).clone());
      const want = tv().copy(d0).applyAxisAngle(tv(0, 1, 0), psi);
      _q.setFromRotationMatrix(bone.matrixWorld);
      const now = tv(0, 1, 0).applyQuaternion(_q);
      _qh.setFromUnitVectors(now, want);
      const ang = 2 * Math.acos(Math.min(1, Math.abs(_qh.w)));
      _qh.slerp(_qI, 1 - Math.min(hang, ang > 1e-4 ? HANG.max / ang : 1));
      bone.matrixWorld.compose(tv().setFromMatrixPosition(bone.matrixWorld), _q.premultiply(_qh), _s);
    }
    for (let k = 0; k < 2; k++) {
      const S = k === 0 ? 'L' : 'R', bone = e.bone['ear' + S];
      if (!bone) continue;
      const st = b['lop' + S] || (b['lop' + S] = {});
      const base = tv().setFromMatrixPosition(bone.matrixWorld);
      _q.setFromRotationMatrix(bone.matrixWorld);
      const len = st.len ?? (st.len = e.J['earBase' + S].distanceTo(e.J['earTip' + S]));
      if (liftOut(e, st, base, _q, len, dt, 0.02 * e.cfg.s)) bone.matrixWorld.compose(base, _q, _s);
    }
  }
  if (e.lod >= 2) return;
  const jaw = e.bone.jaw;
  if (jaw && b.grind > 1e-3) {
    const base = tv().setFromMatrixPosition(jaw.matrixWorld);
    _q.setFromRotationMatrix(jaw.matrixWorld);
    const ax = tv(0, 0, 1).applyQuaternion(_q); // perpendicular to the jaw and to the lateral axis
    const a = 0.07 * b.grind * Math.sin(b.chewPh);
    jaw.matrixWorld.compose(base, tqa(ax, a).multiply(_q), _s);
  }
  for (let k = 0; k < 2; k++) {
    const E = b.ear[k];
    if (E.age > 0.5) continue;
    const bone = k === 0 ? e.bone.earL : e.bone.earR;
    if (!bone) continue;
    // a flick: fast twist about the ear's long axis and a flap, decaying in ~0.4 s
    const f = Math.sin(Math.min(1, E.age / 0.45) * PI * 2) * Math.exp(-E.age * 5) * (k === 0 ? 1 : -1);
    const base = tv().setFromMatrixPosition(bone.matrixWorld);
    _q.setFromRotationMatrix(bone.matrixWorld);
    const along = tv(0, 1, 0).applyQuaternion(_q), flap = tv(0, 0, 1).applyQuaternion(_q);
    _q.premultiply(tqa(along, 0.5 * f * E.a)).premultiply(tqa(flap, 0.35 * f * E.a));
    bone.matrixWorld.compose(base, _q, _s);
  }
}

// Keeps a hanging part (beard, lop ear) out of the ground: the smallest swing up about its root that
// lifts sample points along it (fractions of its length) above the terrain, followed by a critically
// damped spring (st: { lift, v }). Returns the rotated quaternion in _q (world) for the bone at base.
function liftOut(e, st, base, q, len, dt, margin) {
  const dir = tv(0, 1, 0).applyQuaternion(q);
  let need = 0;
  if (base.y - e.terrainH(base.x, base.z) < len + margin + 0.02 * e.cfg.s) {
    for (const f of [1.12, 0.8, 0.5]) {
      const pt = tv().copy(base).addScaledVector(dir, len * f);
      const floor = e.terrainH(pt.x, pt.z) + margin;
      if (pt.y < floor) need = Math.max(need, Math.asin(clamp((floor - pt.y) / (len * f), 0, 1)) * 1.35);
    }
  }
  const om = 28, h = Math.min(dt, 0.05);
  st.v = (st.v || 0) + (om * om * (need - (st.lift || 0)) - 2 * om * (st.v || 0)) * h;
  st.lift = Math.max(0, (st.lift || 0) + st.v * h);
  if (st.lift > 1e-4) {
    const axis = tv().crossVectors(dir, tv(0, 1, 0));
    if (axis.lengthSq() > 1e-8) q.premultiply(tqa(axis.normalize(), st.lift));
  }
  return st.lift > 1e-4;
}

// the beard bone's bind rotation relative to the head bone's (so the head-following beard keeps its
// bind hang)
function beardRelQ(e) {
  return e.bindQ.head.clone().invert().multiply(e.bindQ.beard);
}

// ------------------------------------------------------------------------------------------------
// update: cud chewing, tail flicks, ear flicks, idle variants
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg;
  // a kid runs slower than dynamic similarity would give it (a 20 kg kid: ~5.2 m/s, not 6.5): requests
  // above 0.8 of its scaled top speed are capped there (a cap on every speed also slowed the trot it jumps
  // from, and the jump's crouch caught a foreleg mid-stride)
  if (e.params?.age === 'juvenile' && e.wantSpeed > 0.8 * cfg.maxSpeed) P.speedScale *= 0.8 * cfg.maxSpeed / e.wantSpeed;
  // a kid carries its head lower and further forward, on a less upright neck (kid_side, front2: with the
  // adult's high, alert carriage its long legs and upright neck read as a llama); not in actions
  if (e.params?.age === 'juvenile') {
    let act = 0;
    for (const a of L.oneshots) act = Math.max(act, a.w || 0);
    for (const p of L.postures) act = Math.max(act, p.w || 0);
    const kw = 1 - act;
    P.headRaise -= (0.045 / cfg.unit) * kw;
    P.neckReach += (0.025 / cfg.unit) * kw;
    P.headPitch += 0.1 * kw;
  }
  const vn = e.speed / cfg.sq;
  const still = 1 - smooth(0.1, 0.6, vn);
  // --- rumination: chewing bouts of 20-40 s with pauses, standing or lying (not while asleep,
  // eating, bleating or fighting)
  b.cudT -= dt;
  if (b.cudT <= 0) { b.cudOn = !b.cudOn; b.cudT = b.cudOn ? 18 + e.rand() * 22 : 8 + e.rand() * 14; }
  const lying = L.postures.some((p) => p.name === 'lie') ? 1 : 0;
  const quiet = L.oneshots.some((a) => !a.stopping && a.name !== 'hit' && a.name !== 'headshake') ? 0 : 1;
  const asleep = L.postures.some((p) => p.name === 'sleep' || p.name === 'death') ? 1 : 0;
  const want = b.cudOn && quiet && !asleep ? Math.max(still * L.idle.w, lying) : 0;
  b.cud += (want - b.cud) * (1 - Math.exp(-dt * 3));
  // chew rate ~1.3 Hz; every ~40 chews a bolus is swallowed (a short pause)
  const rate = 1.3 * (1 - 0.8 * smooth(0.85, 1, (b.chewPh / TAU) % 40 / 40));
  b.chewPh += dt * TAU * rate;
  const chew = b.cud * (0.5 + 0.5 * Math.sin(b.chewPh));
  b.grind = b.cud;
  // (ruminating goats chew with the lips closed: a small drop of the jaw under the sideways grind, less
  // than the lips' overlap; 0.1 rad opened the mouth 2 cm at the lips for most of an idle goat's time)
  if (b.cud > 1e-3) { P.jaw = Math.max(P.jaw, 0.015 * chew); P.jawOmega = Math.max(P.jawOmega, 18); mx(P, 'eyelid', 0.25, b.cud * 0.6); }
  // --- tail: held up, flicks in quick bursts (a few rapid side flicks)
  b.tailT -= dt;
  if (b.tailT <= 0) { b.tailT = 2 + e.rand() * 5; b.tailAge = 0; }
  b.tailAge += dt;
  const tw = b.tailAge < 0.8 ? Math.sin(PI * b.tailAge / 0.8) : 0;
  if (tw > 0) { P.tailWag = Math.max(P.tailWag, 0.9 * tw * (1 - P.groundW)); mx(P, 'tailLift', 0.25, tw * 0.5); }
  // --- ear flicks (one ear at a time, more often standing)
  for (const E of b.ear) {
    E.age += dt; E.next -= dt * (0.5 + 0.5 * still);
    if (E.next <= 0) { E.next = 2.5 + e.rand() * 7; E.age = 0; E.a = (0.7 + 0.5 * e.rand()) * (1 - P.eyelid * 0.8) * (e.params?.ear === 'lop' ? 0.3 : 1); }
  }
  // --- lying on the side (dead): the ears fold back along the neck, out of the ground
  const dead = L.postures.reduce((m, p) => (p.name === 'death' ? Math.max(m, p.w) : m), 0);
  const flat = Math.max(smooth(0.3, 1.0, Math.abs(P.roll)), dead * smooth(0.3, 1, dead));
  if (flat > 0) { mx(P, 'earFlat', 1.1, flat); mx(P, 'earTwitch', 0, flat); }
  // ... and the head rests on the lower horn and ear, a little higher than a bare skull would
  // (a long lop ear lies flat under the cheek: without the lift it was folded sharply about its root, out of
  // the ground, and its root tore)
  const lopLift = e.params?.ear === 'lop' ? 0.03 : 0;
  if (dead > 0 && P.headW > 0) P.headPos.y += (0.035 + lopLift + 0.12 * (e.params?.horns?.len || 0)) * cfg.s * flat;
  // (the head rolls over with the body rather than twisting on the atlas: the long throat stretched)
  if (dead > 0) P.headRoll *= 1 - 0.45 * dead;
  // --- lop ears hang: they hardly swivel, prick or flatten
  if (e.params?.ear === 'lop') { P.earTwitch *= 0.25; P.earSwivel *= 0.3; P.earFlat *= 0.3; }
  // --- lying / sleeping: the short tail lies flat, not curled round on the ground like a long tail
  P.tailSide *= 0.2;
  // --- grazing / drinking: the head pitches down ahead of the neck as it goes down (with both blended by
  // the action's fade the neck was down before the nose had turned, and the poll opened 25 deg further than
  // in the pose itself for a moment: the throat stretched)
  for (const a of L.oneshots) {
    if ((a.name !== 'eat' && a.name !== 'drink') || a.stopping || !(a.w > 0 && a.w < 1)) continue;
    const pitch = a.tune?.pitch ?? 1.3;
    const lead = Math.min(1, 3 * a.w) - a.w;
    P.headPitch += lead * (pitch - P.headPitch);
  }
  // --- any other action interrupts grazing
  if (L.oneshots.some((a) => !a.stopping && ['attack', 'jump', 'bleat', 'browse', 'paw'].includes(a.name))) for (const a of L.oneshots) if (a.name === 'eat' || a.name === 'drink') a.stopping = true;
  // --- idle variants
  if (e.idleVariants !== false && L.idle.w > 0.98 && !busy(L) && !e.input.look && !e.input.follow) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 7 + e.rand() * 10;
      const r = e.rand();
      if (r < 0.22) L.play('browse', { rear: e.rand() < 0.55 });
      else if (r < 0.4) L.play('bleat');
      else if (r < 0.58) L.play('headshake');
      else if (r < 0.7) L.play('paw');
      else if (r < 0.85) { b.ear[0].next = 0; b.ear[1].next = 0.25; }
    }
  } else if (busy(L)) b.idleT = Math.max(b.idleT, 3);
}

// ------------------------------------------------------------------------------------------------
// browse: stretches the neck up to strip leaves (opts.rear: rises onto the hind legs, forelegs
// raised as if resting on a trunk). Lips work, the head pulls back after each bite.
const browse = {
  kind: 'oneshot', fade: 0.5, needsStand: true,
  start(inst, L) {
    const e = L.engine;
    inst.rear = inst.opts.rear ?? true;
    inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? (inst.rear ? 5 : 4.5));
    inst.yaw = (e.rand() - 0.5) * 0.5;
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, t = inst.t, u = 1 / cfg.unit;
    const up = w * smooth(0, 0.9, t);
    // reach and bite cycle (~0.9 s): stretch, bite, pull back and chew
    const c = (t * 1.1) % 1;
    const bite = smooth(0.2, 0.35, c) * (1 - smooth(0.4, 0.7, c));
    mx(P, 'lookW', 0, up);
    mx(P, 'headPitch', -0.75 - 0.12 * bite, up); mx(P, 'headRaise', (0.1 + 0.015 * bite) * u, up); mx(P, 'neckReach', 0.03 * u, up);
    mx(P, 'headYaw', inst.yaw + 0.1 * Math.sin(t * 0.8), up);
    mx(P, 'jaw', 0.05 + 0.18 * bite, up); mx(P, 'jawOmega', 16, up);
    mx(P, 'earFlat', -0.1, up); mx(P, 'tailLift', 0.15, up);
    if (inst.rear) {
      // up on the hind legs: the body comes down first, then the forefeet reach the ground again
      const body = w * smooth(0.2, 1.3, t) * (1 - smooth(inst.dur - 1.2, inst.dur - 0.2, t));
      const legs = Math.min(w * smooth(0.2, 0.7, t), w * smooth(0.004 * cfg.k, 0.04 * cfg.k, e.shY.x) + body);
      mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
      // (body ~55 deg up: the neck still reaches up and forward, the forelegs half folded as if
      // resting on a trunk)
      mx(P, 'dropF', -1.2, body); mx(P, 'dropH', 0.15, body);
      for (let i = 0; i < 2; i++) { mxLeg(P, i, 'tuck', 1, legs); P.legs[i].extend = lerp(P.legs[i].extend, 0.3, legs); }
      mx(P, 'headPitch', 0.1 - 0.1 * bite, body); mx(P, 'headRaise', 0.0, body); mx(P, 'neckReach', 0.045 * u, body);
    }
  },
};

// bleat: head up, mouth open, jaw quiver, ears back a little
const bleat = {
  kind: 'oneshot', fade: 0.25,
  start(inst) { inst.dur = inst.opts.duration ?? 1.7; inst.said = false; },
  update(inst, dt, L) {
    if (!inst.said && inst.t > 0.4) { inst.said = true; L.engine.emit('vocalize', { kind: 'bleat' }); }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t, u = 1 / e.cfg.unit;
    const up = w * smooth(0, 0.35, t);
    const call = smooth(0.35, 0.5, t) * (1 - smooth(inst.dur - 0.45, inst.dur - 0.15, t));
    mx(P, 'lookW', 0.3, up);
    mx(P, 'headPitch', -0.55, up); mx(P, 'headRaise', 0.04 * u, up); mx(P, 'neckReach', 0.015 * u, up);
    mx(P, 'jaw', 0.42 + 0.07 * Math.sin(t * TAU * 11), call * w); mx(P, 'jawOmega', 30, w);
    mx(P, 'earFlat', 0.3, up); mx(P, 'breathAmp', 2.2, call * w); mx(P, 'tailLift', 0.2, up);
  },
};

// head shake: fast rotations about the nose axis (flies, water), ears flapping
const headshake = {
  kind: 'oneshot', fade: 0.12,
  start(inst) { inst.dur = 1.0; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst) {
    const t = inst.t;
    const env = smooth(0, 0.12, t) * (1 - smooth(0.55, 0.95, t)) * w;
    const s = Math.sin(t * TAU * 4.2);
    mx(P, 'headOmega', 5, env); // (the head springs follow the fast shake)
    mx(P, 'headRoll', 0.42 * s, env); mx(P, 'headYaw', 0.16 * s, env); mx(P, 'headPitch', -0.1, env);
    mx(P, 'earTwitch', 2.5, env); mx(P, 'eyelid', 0.5, env); mx(P, 'lookW', 0, env);
  },
};

// paw: scrapes the ground two or three times with one foreleg (before lying down, or in agitation)
// Each scrape (0.9 s): the hoof comes up and forward and is held there (~0.4 s, so the lifted foreleg reads:
// a continuous 0.55 s loop was never caught lifted in the action strip), strikes down and drags back along
// the ground.
const PAW_T0 = 0.35, PAW_CYC = 0.9, PAW_N = 2;
// hoof path per cycle phase f (0..1): [forward (x 0.07 m), height (x 0.1 m)]
function pawPath(f) {
  const up = smooth(0.0, 0.16, f) * (1 - smooth(0.6, 0.7, f));
  const fwd = -0.15 + 1.15 * smooth(0.0, 0.2, f) - 1.15 * smooth(0.62, 0.98, f); // (periodic: -0.15 at both ends)
  return [fwd, up];
}
const paw = {
  kind: 'oneshot', fade: 0.3, needsStand: true,
  start(inst, L) { const e = L.engine; inst.dur = PAW_T0 + PAW_N * PAW_CYC + 0.45; inst.leg = inst.opts.side === -1 ? 1 : inst.opts.side === 1 ? 0 : (e.rand() < 0.5 ? 0 : 1); inst.hits = 0; },
  update(inst, dt, L) {
    const e = L.engine;
    // the strike lands at 0.68 of each cycle
    const n = Math.floor(clamp((inst.t - PAW_T0 - 0.68 * PAW_CYC) / PAW_CYC + 1, 0, PAW_N));
    if (n > inst.hits && inst.hits < PAW_N) {
      inst.hits = n;
      e.emit('footstep', { foot: e.legs[inst.leg].def.key, position: e.legs[inst.leg].contact.clone(), speed: 0, strength: 0.6, paw: true });
    }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, s = cfg.s, t = inst.t, i = inst.leg;
    const tEnd = PAW_T0 + PAW_N * PAW_CYC;
    const k = w * smooth(0.15, 0.35, t) * (1 - smooth(tEnd + 0.05, tEnd + 0.35, t));
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    mx(P, 'headPitch', 0.35, k); mx(P, 'headRaise', -0.05 / cfg.unit, k); mx(P, 'lookW', 0, k);
    mx(P, 'side', -0.012 * (i === 0 ? 1 : -1) / cfg.unit, k); // weight onto the other three legs
    const u = clamp((t - PAW_T0) / PAW_CYC, 0, PAW_N);
    const f = u >= PAW_N ? 1 : u - Math.floor(u);
    const [pf, pu] = u >= PAW_N ? [-0.15, 0] : pawPath(f);
    const leg = e.legs[i];
    const fwd = e.forward(e.heading, tv());
    // (a clear lift, the hoof raised ~10 cm and brought forward, then struck down and dragged back: a 3.5 cm
    // scrape did not read)
    const tp = tv().copy(leg.plant).addScaledVector(fwd, 0.07 * s * pf);
    tp.y += 0.1 * s * pu + 0.004 * s;
    P.legs[i].target.lerp(tp, k / Math.max(1e-3, P.legs[i].reach + k));
    mxLeg(P, i, 'reach', 1, k);
  },
};

// attack: the goat's clash. Rises on the hind legs with the head twisted to one side, then drops
// forward and brings the horns / forehead down onto the opponent (the impact at the forefeet's
// landing). Buck: mane raised.
const attack = {
  kind: 'oneshot', fade: 0.15, needsStand: true,
  start(inst, L) {
    const e = L.engine;
    inst.dur = 2.1; inst.hit = false;
    inst.side = inst.opts.side ?? (e.rand() < 0.5 ? -1 : 1);
    inst.run = smooth(0.8, 2.5, e.speed / e.cfg.sq);
    inst.target = inst.opts.target ? inst.opts.target.clone() : null;
  },
  update(inst, dt, L) {
    const e = L.engine;
    if (!inst.hit && inst.t >= 1.18) {
      inst.hit = true;
      const p = new THREE.Vector3().copy(e.headPose.position);
      const dir = inst.target ? inst.target.clone().sub(e.pos).setY(0).normalize() : e.forward(e.heading, new THREE.Vector3());
      e.emit('attackHit', { position: p, direction: dir, style: 'headbutt' });
    }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, t = inst.t, u = 1 / cfg.unit;
    if (inst.target) { P.look = inst.target; mx(P, 'lookW', 0.6, w); }
    const rise = smooth(0.1, 0.8, t);
    const drop = smooth(0.92, 1.2, t);
    // (running: no rearing, a lowered-head charge into the clash)
    const still = 1 - inst.run;
    const up = rise * (1 - drop) * w * still;
    const clash = smooth(0.98, 1.2, t) * (1 - smooth(1.45, 2.0, t)) * w;
    const legsW = Math.max(up, w * still * smooth(0.1, 0.4, t) * (1 - smooth(1.02, 1.16, t)));
    mx(P, 'gaitW', 0, w * still * (1 - smooth(1.6, 2.05, t))); mx(P, 'legGait', 0, w * still * (1 - smooth(1.5, 2.0, t)));
    if (inst.run > 0) { const low = smooth(0.3, 0.9, t) * (1 - smooth(1.3, 1.9, t)) * w * inst.run; mx(P, 'headPitch', 0.8, low); mx(P, 'headRaise', -0.06 * u, low); }
    // rear
    mx(P, 'dropF', -1.35, up); mx(P, 'dropH', 0.2, up); mx(P, 'pitch', 0.05, up);
    for (let i = 0; i < 2; i++) { mxLeg(P, i, 'tuck', 1, legsW); P.legs[i].extend = lerp(P.legs[i].extend, lerp(0.25, 0.9, smooth(0.85, 1.1, t)), legsW); }
    mx(P, 'headRoll', 0.45 * inst.side, up); mx(P, 'headYaw', -0.2 * inst.side, up); mx(P, 'headPitch', 0.15, up);
    mx(P, 'headRaise', 0.03 * u, up);
    // drop and clash: head down, forehead first, body lunging forward, forequarters low
    mx(P, 'dropF', 0.28 * still, clash); mx(P, 'fwd', 0.07 * u, clash); mx(P, 'headPitch', 0.95, clash);
    mx(P, 'headRaise', -0.07 * u, clash); mx(P, 'neckReach', 0.03 * u, clash);
    mx(P, 'earFlat', 0.8, w * smooth(0, 0.2, t)); mx(P, 'earTwitch', 0, w);
    mx(P, 'tailLift', 0.4, w);
    // (the buck's mane rises in the threat)
    if (e.params?.sex === 'male' && e.params?.age !== 'juvenile') P.furRaise = Math.max(P.furRaise || 0, 0.6 * w);
  },
};

// lie: the engine's kneeling lie (actions.lie: down front, up hind), with the rise finished a little
// before the posture is released: its end-first springs (kF / kH) must settle at zero before the
// posture instance is removed, or the legs jump in the last frame of standing up
function lieApply(P, w, inst, L) {
  const we = inst.target > 0 ? w : smooth(0.3, 1, w);
  POSTURES.lie.apply(P, we, inst, L);
}
const lie = { kind: 'posture', fadeIn: 1.4, fadeOut: 1.3, apply: lieApply };

// sleep: sternal (goats rarely sleep flat out), head turned back and resting against the flank,
// eyes closed
const sleep = {
  kind: 'posture', fadeIn: 1.3, fadeOut: 1.0,
  apply(P, w, inst, L) {
    lieApply(P, w, inst, L);
    const e = L.engine;
    const c = sm(clamp(w, 0, 1)) * smooth(1.2, 3.2, inst.t);
    mx(P, 'headYaw', inst.side * 0.8, c); mx(P, 'headPitch', 0.45, c); mx(P, 'headRaise', -0.07 / e.cfg.unit, c);
    mx(P, 'bend', inst.side * 0.35, c);
    mx(P, 'earFlat', 0.45, c); mx(P, 'earTwitch', 0.2, c);
    mx(P, 'eyelid', 1, smooth(1.8, 3.2, inst.t) * w);
    mx(P, 'breathRate', 0.6, c); mx(P, 'lookW', 0, c); mx(P, 'tailIdle', 0.2, c);
  },
};

// death: the engine's collapse (legs buckle, topple onto the side, settle), with the body sinking level and
// leaning to its side while the legs buckle (falls onto its side): the forelegs, the
// longer pair, buckled further than the hind ones and the goat pitched onto its nose with its hindquarters
// high before it rolled over
const death = {
  kind: 'posture', fadeIn: POSTURES.death.fadeIn, fadeOut: POSTURES.death.fadeOut,
  apply(P, w, inst, L) {
    POSTURES.death.apply(P, w, inst, L);
    const e = L.engine, cfg = e.cfg, t = inst.t, side = inst.side;
    const buckle = smooth(0, 0.35, t), fall = clamp((t - 0.3) / 0.55, 0, 1), fallE = fall * fall;
    const settle = fall >= 1 ? Math.exp(-(t - 0.85) * 6) * Math.sin((t - 0.85) * 18) * 0.06 : 0;
    const mv = e.air.active ? 0 : smooth(0.08, 0.45, e.speed / cfg.sk) * (1 - smooth(0.3, 0.7, t));
    const kb = 1 - mv;
    mx(P, 'dropF', lerp(0.42 * buckle * kb, 1, fallE), w);
    mx(P, 'roll', side * (1.42 * (fallE + 0.22 * buckle * kb * (1 - fallE)) - settle), w);
    // (the head goes down with the body as it goes over, not ahead of it: the engine drops it to the ground
    // from 0.35 s, and the goat dived onto its nose before it rolled)
    P.headW *= smooth(0.5, 1.05, t);
  },
};

// hit: the engine's flinch (a shove away from the blow and a restep), held long enough to read on a goat: the
// body leans and bends away for ~0.4 s with the head thrown up and away, then the goat shakes it off (the
// engine's 0.12 s recoil barely showed in any frame)
const hit = {
  ...ONESHOTS.hit,
  kind: 'oneshot',
  start(inst, L) {
    ONESHOTS.hit.start(inst, L);
    inst.dur = 1.4;
    inst.dead = L.postures.some((p) => p.name === 'death');
  },
  apply(P, w, inst) {
    const t = inst.t;
    const k = smooth(0, 0.1, t) * (1 - 0.55 * smooth(0.3, 0.75, t)) * (1 - smooth(0.75, 1.25, t)) * w * (inst.dead ? 0.4 : 1);
    mx(P, 'roll', inst.lx * 0.22, k); mx(P, 'bend', -inst.lx * 0.36, k);
    mx(P, 'pitch', inst.lz * 0.1, k); mx(P, 'dropF', 0.2, k); mx(P, 'dropH', 0.13, k);
    P.headLocal.set(inst.lx * 0.08, 0.03, inst.lz * 0.07 - 0.03); mx(P, 'headLocalW', 1, k);
    mx(P, 'headYaw', -inst.lx * 0.5, k); mx(P, 'headPitch', -0.3, k);
    mx(P, 'earFlat', 1, w * (1 - smooth(0.55, 0.95, t))); mx(P, 'eyelid', 0.7, k);
    mx(P, 'jaw', 0.16, k); mx(P, 'tailLift', -0.15, k);
    if (inst.dead) return;
    // shaking it off
    const sh = smooth(0.7, 0.85, t) * (1 - smooth(1.12, 1.32, t)) * w;
    mx(P, 'headOmega', 5, sh); mx(P, 'headRoll', 0.3 * Math.sin((t - 0.7) * TAU * 4.2), sh);
    mx(P, 'earTwitch', 2.5, sh);
  },
};

export const hooks = {
  pose,
  update,
  actions: { browse, bleat, headshake, paw, attack, hit, lie, sleep, death },
};
