// Sheep behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js):
//
//   pose(engine, dt)        after the engine's solve: the ruminant's sideways grinding of the lower
//                           jaw (cud chewing, and the constant chewing between bites while grazing),
//                           quick ear flicks (one ear at a time), the udder / scrotum drawn up when
//                           the body rests on the ground
//   update(P, dt, layer)    every frame over the action layer: the fleece added to the torso sections
//                           (ground contact), the walk's head nod, cud chewing bouts (standing or
//                           lying), grazing (bite and tear jerks, chewing in between, a step now and
//                           then), tail flicks (a docked stump wiggles, a long tail swishes), ear flicks,
//                           automatic idle variants of a flock animal (heads up in alarm, bleating,
//                           grazing, a head shake, the ewe's warning stamp, the lamb's pronk)
//   actions                 alert (head up, ears forward, freeze and stare; a stamp), bleat, headshake,
//                           stamp (foreleg stamp), pronk (lambs: stiff-legged bounce), attack (ram:
//                           walks off, turns, charges and clashes head-down; ewe: stamps and butts), lie
//                           (kneels first, rises hind end first), sleep (sternal, head back on the
//                           flank)
//
// Posture lengths (headRaise, neckReach, fwd, side) are engine units (x cfg.k): species metres /
// cfg.unit. World points are metres.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tqa, angDiff } from '../../core/motion/common.js';
import { mx, mxLeg, POSTURES, ONESHOTS } from '../../core/motion/actions.js';

const _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4();
const PI = Math.PI;
const sm = (w) => w * w * (3 - 2 * w);

function B(e) {
  if (!e._sheep) {
    // the fleece of this individual widens and deepens the torso sections the engine rests on the
    // ground (lying, sleeping, dead); motion.body holds the shorn body
    const F = (e.params?.wool || 0) * e.cfg.s;
    if (F > 0) {
      for (const k of ['chest', 'mid', 'pelvis', 'rump']) { const S = e.cfg[k]; if (S) { S.hh += 0.62 * F; S.hw += 1.2 * F + (F > 0.02 * e.cfg.s ? 0.02 * e.cfg.s : 0); S.hw *= 1 + 0.06 * (e.params?.heavy || 0); } }
      e.cfg.back += 0.9 * F;
    }
    e._sheep = {
      cud: 0, cudOn: e.rand() < 0.5, cudT: 6 + e.rand() * 10, chewPh: 0, grind: 0,
      ear: [{ a: 0, age: 9, next: 2 + e.rand() * 4 }, { a: 0, age: 9, next: 3 + e.rand() * 5 }],
      tailT: 1 + e.rand() * 3, tailAge: 9, tailAmp: 0.6,
      idleT: 3 + e.rand() * 5,
      steer: null,
      long: (e.params?.tailLen ?? 0.3) > 0.15,
      ram: e.params?.sex === 'male' && e.params?.age !== 'juvenile',
      lamb: e.params?.age === 'juvenile',
    };
  }
  return e._sheep;
}
const busy = (L) => L.postures.length > 0 || L.oneshots.some((a) => !a.stopping);
const find = (L, n) => L.oneshots.find((a) => a.name === n && a.w > 0);

// The engine turns only the head bone to look aside (up to 0.85 rad, plus a lead into turns), so all of
// that yaw fell into the head / neck skin blends: the thick wool collar sheared and its fur shells (15-20
// mm staples) tore open in a crack down the side and front of the neck. A sheep looks aside with its
// neck: here the neck swings toward the look (neck1 about the neck base, neck2 about its own base, 30 %
// of the head's yaw each), carrying the head along, and the head turns back by the same amount about the
// occiput, so it keeps the orientation the engine gave it and only 40 % of the yaw is left between the
// head and the neck.
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qr = new THREE.Quaternion();
const _p = new THREE.Vector3(), _sc = new THREE.Vector3(), _c = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const SWING = [0.22, 0.42];
function rotAbout(bone, c, Q) {
  bone.matrixWorld.decompose(_p, _qa, _sc);
  _p.sub(c).applyQuaternion(Q).add(c);
  _qa.premultiply(Q);
  bone.matrixWorld.compose(_p, _qa, _sc);
}
function neckSwing(e) {
  const H = e.bone.head, N2 = e.bone.neck2, N1 = e.bone.neck1;
  if (!H || !N2 || !N1 || !e.bindQ.head) return;
  const b = e._sheepSwing || (e._sheepSwing = {
    a2: new THREE.Vector3().subVectors(e.J.occiput, e.J.neckMid).normalize(),
    iH: e.bindQ.head.clone().invert(), i2: e.bindQ.neck2.clone().invert(),
    kids: ['jaw', 'earL', 'earR'].map((k) => e.bone[k]).filter(Boolean),
  });
  // the head's yaw relative to neck2: the twist of their relative rotation (posed from bind) about the
  // neck2 axis (near vertical in the standing pose)
  H.matrixWorld.decompose(_p, _qa, _sc); _qa.multiply(b.iH);
  N2.matrixWorld.decompose(_p, _qb, _sc); _qb.multiply(b.i2);
  _qb.invert().multiply(_qa);
  const a = b.a2, d = _qb.x * a.x + _qb.y * a.y + _qb.z * a.z;
  let th = 2 * Math.atan2(d, _qb.w);
  if (th > Math.PI) th -= 2 * Math.PI; else if (th < -Math.PI) th += 2 * Math.PI;
  // (the twist about the neck axis maps onto a swing about the vertical only while the neck stands up)
  _c.setFromMatrixPosition(H.matrixWorld).sub(_p.setFromMatrixPosition(N2.matrixWorld));
  th *= sm(clamp((_c.y / Math.max(_c.length(), 1e-6) - 0.25) / 0.45, 0, 1));
  if (!(Math.abs(th) > 1e-4)) return;
  const head = [H, ...b.kids];
  _c.setFromMatrixPosition(N1.matrixWorld);
  _qr.setFromAxisAngle(_up, SWING[0] * th);
  for (const B of [N1, N2, ...head]) rotAbout(B, _c, _qr);
  _c.setFromMatrixPosition(N2.matrixWorld);
  _qr.setFromAxisAngle(_up, SWING[1] * th);
  for (const B of [N2, ...head]) rotAbout(B, _c, _qr);
  _c.setFromMatrixPosition(H.matrixWorld);
  _qr.setFromAxisAngle(_up, -(SWING[0] + SWING[1]) * th);
  for (const B of head) rotAbout(B, _c, _qr);
}

// ------------------------------------------------------------------------------------------------
// pose: jaw grinding, ear flicks, udder lift
function pose(e, dt) {
  const b = B(e);
  const ud = e.bone.udder;
  if (ud) {
    const want = e.P.groundW * (0.05 + 0.05 * (e.params?.udder || 0)) * e.cfg.s;
    b.udLift = (b.udLift || 0) + (want - (b.udLift || 0)) * (1 - Math.exp(-dt * 12));
    if (b.udLift > 1e-5) {
      _m.copy(ud.matrixWorld);
      _m.elements[13] += b.udLift;
      ud.matrixWorld.copy(_m);
    }
  }
  if (e.lod >= 2) return;
  neckSwing(e);
  const jaw = e.bone.jaw;
  if (jaw && b.grind > 1e-3) {
    const base = tv().setFromMatrixPosition(jaw.matrixWorld);
    _q.setFromRotationMatrix(jaw.matrixWorld);
    const ax = tv(0, 0, 1).applyQuaternion(_q);
    // (~4 mm sideways at the incisors: the lower lip stays under the upper; 7 mm with the jaw opened 6 mm slid the
    // lower lip out from under the upper at the corner, a dark gap)
    const a = 0.026 * b.grind * Math.sin(b.chewPh + (b.chewSide || 0));
    jaw.matrixWorld.compose(base, tqa(ax, a).multiply(_q), _s);
  }
  for (let k = 0; k < 2; k++) {
    const E = b.ear[k];
    if (E.age > 0.5) continue;
    const bone = k === 0 ? e.bone.earL : e.bone.earR;
    if (!bone) continue;
    // a flick: fast twist about the ear's long axis and a flap, decaying in ~0.4 s
    const f = Math.sin(Math.min(1, E.age / 0.4) * PI * 2) * Math.exp(-E.age * 5.5) * (k === 0 ? 1 : -1);
    const base = tv().setFromMatrixPosition(bone.matrixWorld);
    _q.setFromRotationMatrix(bone.matrixWorld);
    const along = tv(0, 1, 0).applyQuaternion(_q), flap = tv(0, 0, 1).applyQuaternion(_q);
    _q.premultiply(tqa(along, 0.45 * f * E.a)).premultiply(tqa(flap, 0.4 * f * E.a));
    bone.matrixWorld.compose(base, _q, _s);
  }
}

// ------------------------------------------------------------------------------------------------
// update
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg, u = 1 / cfg.unit;
  const vn = e.speed / cfg.sq;
  const still = 1 - smooth(0.1, 0.6, vn);
  const g = e.gait;
  // --- walk: a gentle head nod with each forefoot (+-2-3 cm)
  const walkW = smooth(0.15, 0.6, vn) * (1 - smooth(1.4, 1.9, vn)) * P.gaitW;
  if (walkW > 0.001 && g) {
    const c = 0.5 + 0.5 * Math.cos(4 * PI * (e.phase - g.off[0] - 0.1));
    P.headRaise -= 0.025 * u * walkW * c;
    P.headPitch += 0.04 * walkW * (c - 0.5);
  }
  const lying = L.postures.some((p) => p.name === 'lie') ? 1 : 0;
  const asleep = L.postures.some((p) => p.name === 'sleep' || p.name === 'death') ? 1 : 0;

  // --- grazing: bite and tear (a short jerk of the head up and to the side) about once a second,
  // chewing all the time in between, the jaw grinding sideways; now and then a step forward
  const eat = find(L, 'eat');
  let chewW = 0, chewRate = 1.25;
  if (eat) {
    const w = sm(clamp(eat.w, 0, 1)) * smooth(0.5, 1.2, eat.t);
    // one cycle per ~1.05 s: the mouth opens and bites (0 - 0.3), a jerk up and to the side tears the
    // grass (0.3 - 0.55), then chewing; every part starts and ends at rest (continuous)
    const c = (eat.t * 0.95) % 1;
    const bite = c < 0.3 ? Math.sin(PI * c / 0.3) : 0;
    const tear = c > 0.3 && c < 0.55 ? Math.sin(PI * (c - 0.3) / 0.25) ** 2 : 0;
    const side = Math.floor(eat.t * 0.95) % 2 ? 1 : -1;
    P.headPos.y += 0.022 * cfg.s * tear * w;
    P.headPitch -= 0.12 * tear * w;
    P.headYaw += side * 0.08 * tear * w;
    mx(P, 'jaw', 0.05 + 0.12 * bite, w);
    chewW = Math.max(chewW, w * (c < 0.55 ? 0 : Math.sin(PI * (c - 0.55) / 0.45))); chewRate = 1.6;
    mx(P, 'earFlat', -0.15, w); mx(P, 'earTwitch', 0.6, w);
  }
  // --- rumination: bouts of 20-40 s (standing idle, above all lying)
  b.cudT -= dt;
  if (b.cudT <= 0) { b.cudOn = !b.cudOn; b.cudT = b.cudOn ? 18 + e.rand() * 22 : 8 + e.rand() * 14; }
  const quiet = L.oneshots.some((a) => !a.stopping && a.name !== 'hit' && a.name !== 'headshake' && a.name !== 'eat') ? 0 : 1;
  const want = b.cudOn && quiet && !asleep ? Math.max(still * L.idle.w, lying) : 0;
  b.cud += (Math.max(want, chewW) - b.cud) * (1 - Math.exp(-dt * 4));
  // chew rate ~1.2 Hz; every ~50 chews a bolus is swallowed (a short pause, then the other side)
  const rate = chewRate * (1 - 0.85 * smooth(0.88, 1, (b.chewPh / TAU) % 50 / 50));
  const prev = b.chewPh;
  b.chewPh += dt * TAU * rate;
  if (Math.floor(prev / TAU / 50) !== Math.floor(b.chewPh / TAU / 50)) b.chewSide = (b.chewSide || 0) + PI;
  b.grind = b.cud;
  if (b.cud > 1e-3 && !eat) {
    const chew = 0.5 + 0.5 * Math.sin(b.chewPh);
    // (the lips stay closed: the lower jaw grinds sideways more than it opens, ~2.5 mm at the lips)
    P.jaw = Math.max(P.jaw, 0.013 * chew * b.cud); P.jawOmega = Math.max(P.jawOmega, 18);
    mx(P, 'eyelid', 0.2, b.cud * 0.5 * (1 - chewW));
  } else if (eat) { P.jawOmega = Math.max(P.jawOmega, 20); P.jaw += 0.03 * chewW * (0.5 + 0.5 * Math.sin(b.chewPh)); }

  // --- tail: a docked stump wiggles in quick bursts, a long tail swishes (flies), both clamp down
  // when alarmed
  b.tailT -= dt;
  if (b.tailT <= 0) { b.tailT = (b.long ? 3 : 2) + e.rand() * 6; b.tailAge = 0; b.tailAmp = 0.5 + 0.5 * e.rand(); }
  b.tailAge += dt;
  const tdur = b.long ? 1.6 : 0.7;
  const tw = b.tailAge < tdur ? Math.sin(PI * b.tailAge / tdur) : 0;
  if (tw > 0 && !asleep) {
    P.tailWag = Math.max(P.tailWag, b.tailAmp * tw * (b.long ? 0.7 : 1) * (1 - 0.6 * P.groundW));
    if (!b.long) mx(P, 'tailLift', 0.2, tw * 0.5);
  }
  // --- ear flicks (one ear at a time, more often standing)
  for (const E of b.ear) {
    E.age += dt; E.next -= dt * (0.5 + 0.5 * still);
    if (E.next <= 0) { E.next = 2.5 + e.rand() * 7; E.age = 0; E.a = (0.7 + 0.5 * e.rand()) * (1 - P.eyelid * 0.8) * (e.params?.ear === 'droop' ? 0.5 : 1); }
  }
  // --- dead: the ears fold back along the neck
  const dead = L.postures.reduce((m, p) => (p.name === 'death' ? Math.max(m, p.w) : m), 0);
  const flat = Math.max(smooth(0.3, 1.0, Math.abs(P.roll)), dead * smooth(0.3, 1, dead));
  if (flat > 0) { mx(P, 'earFlat', 0.6, flat); mx(P, 'earTwitch', 0, flat); }
  if (dead > 0 && P.headW > 0) P.headPos.y += (0.11 + 0.1 * (e.params?.horns?.turns || 0) * (e.params?.horns?.base || 0) / 0.035) * cfg.s * flat * (b.lamb ? 1.3 : 1);
  // (0.5: with the broader, blunter nose a head tucked 0.6 put a nostril corner into uneven
  // ground: the engine keeps only the nose's centre and the widest skin of the cheeks clear)
  if (dead > 0) { P.headRoll *= 1 - 0.45 * dead; P.headPitch += 0.5 * dead; }
  // --- a sheep's ears drop back rather than flatten (and the thin ear base does not tear)
  if (P.earFlat > 0.45 && dead < 0.01) P.earFlat = 0.45 + 0.25 * (P.earFlat - 0.45);
  // --- lying / sleeping: the tail lies flat
  P.tailSide *= 0.3;
  // --- any other action interrupts grazing
  if (L.oneshots.some((a) => !a.stopping && ['attack', 'jump', 'bleat', 'alert', 'stamp', 'pronk'].includes(a.name))) for (const a of L.oneshots) if (a.name === 'eat' || a.name === 'drink') a.stopping = true;

  // --- attack steering (the ram walks off, turns and charges)
  const st = b.steer;
  if (st && !L.oneshots.some((a) => a.name === 'attack' && !a.stopping)) b.steer = null;
  else if (st) { e.wantSpeed = st.speed; e.wantHeading = st.heading; }

  // --- idle variants of a flock animal
  if (e.idleVariants !== false && L.idle.w > 0.98 && !busy(L) && !e.input.look && !e.input.follow) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 5 + e.rand() * 8;
      const r = e.rand();
      if (r < 0.26) L.play('alert');
      else if (r < 0.46) L.play('bleat');
      else if (r < 0.64) L.play('eat', { duration: 4 + e.rand() * 6 });
      else if (r < 0.74) L.play('headshake');
      else if (r < 0.82 && !b.ram) L.play('stamp');
      else if (r < 0.9 && b.lamb) L.play('pronk');
      else { b.ear[0].next = 0; b.ear[1].next = 0.3; }
    }
  } else if (busy(L)) b.idleT = Math.max(b.idleT, 3);
}

// ------------------------------------------------------------------------------------------------
// alert: the flock's alarm. The head comes up high, ears forward, the body freezes (breath held),
// staring at something; ewes may stamp a foreleg at the end
const alert = {
  kind: 'oneshot', fade: 0.3,
  start(inst, L) {
    const e = L.engine;
    inst.dur = inst.opts.duration ?? 3.2 + e.rand() * 1.5;
    const a = e.heading + (e.rand() - 0.5) * 1.4;
    inst.look = inst.opts.target ? inst.opts.target.clone() : new THREE.Vector3(e.pos.x + Math.sin(a) * 12 * e.cfg.s, e.pos.y + 0.6 * e.cfg.s, e.pos.z + Math.cos(a) * 12 * e.cfg.s);
    inst.stamp = !B(e).ram && e.rand() < 0.35;
  },
  update(inst, dt, L) {
    if (inst.stamp && !inst.stamped && inst.t > inst.dur - 1.4) { inst.stamped = true; L.play('stamp', { quick: true }); }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, u = 1 / e.cfg.unit, t = inst.t;
    const up = w * smooth(0, 0.35, t);
    P.look = inst.look; mx(P, 'lookW', 1, up);
    mx(P, 'headPitch', -0.3, up); mx(P, 'headRaise', 0.05 * u, up); mx(P, 'neckReach', -0.01 * u, up);
    mx(P, 'earFlat', -0.25, up); mx(P, 'earTwitch', 0.1, up); mx(P, 'earSwivel', 0, up);
    mx(P, 'breathAmp', 0.2, up); mx(P, 'eyelid', -0.3, up);
    mx(P, 'tailLift', -0.2, up); mx(P, 'tailIdle', 0, up);
  },
};

// bleat: head up and forward, mouth open, the jaw trembling (the vibrato of a "baa"), ears back a
// little
const bleat = {
  kind: 'oneshot', fade: 0.22,
  start(inst, L) { inst.dur = inst.opts.duration ?? 1.3 + 0.7 * L.engine.rand(); inst.said = false; },
  update(inst, dt, L) {
    if (!inst.said && inst.t > 0.35) { inst.said = true; L.engine.emit('vocalize', { kind: 'bleat' }); }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t, u = 1 / e.cfg.unit;
    const up = w * smooth(0, 0.3, t);
    const call = smooth(0.3, 0.45, t) * (1 - smooth(inst.dur - 0.4, inst.dur - 0.12, t));
    mx(P, 'lookW', 0.3, up);
    mx(P, 'headPitch', -0.4, up); mx(P, 'headRaise', 0.03 * u, up); mx(P, 'neckReach', 0.02 * u, up);
    mx(P, 'jaw', 0.34 + 0.06 * Math.sin(t * TAU * 9), call * w); mx(P, 'jawOmega', 30, w);
    mx(P, 'earFlat', 0.25, up); mx(P, 'breathAmp', 2.2, call * w);
  },
};

// head shake: fast rotations about the nose axis (flies, rain), ears flapping
const headshake = {
  kind: 'oneshot', fade: 0.12,
  start(inst) { inst.dur = 1.0; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst) {
    const t = inst.t;
    const env = smooth(0, 0.12, t) * (1 - smooth(0.55, 0.95, t)) * w;
    const s = Math.sin(t * TAU * 4.4);
    mx(P, 'headOmega', 5, env);
    mx(P, 'headRoll', 0.45 * s, env); mx(P, 'headYaw', 0.14 * s, env); mx(P, 'headPitch', -0.05, env);
    mx(P, 'earTwitch', 2.5, env); mx(P, 'eyelid', 0.5, env); mx(P, 'lookW', 0, env);
  },
};

// stamp: a foreleg lifted and brought down hard (alarm / threat), once or twice
const stamp = {
  kind: 'oneshot', fade: 0.2, needsStand: true,
  start(inst, L) {
    const e = L.engine;
    inst.n = inst.opts.count ?? (inst.opts.quick ? 1 : 1 + (e.rand() < 0.5 ? 1 : 0));
    inst.T = 0.62;
    inst.dur = 0.35 + inst.n * inst.T + 0.35;
    inst.leg = inst.opts.side === -1 ? 1 : inst.opts.side === 1 ? 0 : (e.rand() < 0.5 ? 0 : 1);
    inst.hits = 0;
  },
  update(inst, dt, L) {
    const e = L.engine;
    const k = Math.floor((inst.t - 0.35 - 0.34 * inst.T) / inst.T) + 1;
    if (k > inst.hits && inst.hits < inst.n) {
      inst.hits++;
      const leg = e.legs[inst.leg];
      e.emit('footstep', { foot: leg.def.key, position: leg.plant.clone(), speed: 0, strength: 1, stamp: true });
      if (inst.opts.hit) e.emit('attackHit', { position: leg.plant.clone(), direction: e.forward(e.heading, new THREE.Vector3()), style: 'stamp' });
    }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, s = cfg.s, t = inst.t, i = inst.leg;
    const k = w * smooth(0.1, 0.3, t) * (1 - smooth(inst.dur - 0.35, inst.dur - 0.05, t));
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    mx(P, 'headPitch', -0.15, k); mx(P, 'headRaise', 0.02 / cfg.unit, k);
    mx(P, 'earFlat', -0.3, k);
    mx(P, 'side', -0.012 * (i === 0 ? 1 : -1) / cfg.unit, k); // weight onto the other three legs
    // lift high (0 - 0.34 T), strike down fast (0.34 - 0.42 T), rest on the ground
    const c = clamp((t - 0.35) / inst.T, 0, inst.n);
    const ph = c - Math.floor(c);
    const on = c < inst.n ? 1 : 0;
    const lift = on * (ph < 0.34 ? Math.sin(0.5 * PI * ph / 0.34) : 1 - smooth(0.34, 0.42, ph));
    const leg = e.legs[i];
    const tp = tv().copy(leg.plant).addScaledVector(e.forward(e.heading, tv()), 0.02 * s * lift);
    tp.y += 0.1 * s * lift + 0.002 * s;
    P.legs[i].target.copy(tp);
    mxLeg(P, i, 'reach', 1, k);
    mx(P, 'dropF', 0.03, k * lift);
  },
};

// pronk (lambs): a stiff-legged bounce straight up with a twist of the body, landing on four feet
const pronk = {
  kind: 'oneshot', fade: 0.12, needsStand: true, airborne: true,
  start(inst, L) {
    const e = L.engine;
    ONESHOTS.jump.start(inst, L);
    const h = (inst.opts.height ?? 0.35) * e.cfg.s;
    inst.vy = Math.sqrt(2 * 9.81 * h);
    inst.vh = Math.max(e.speed, 0.4 * e.cfg.sq);
    inst.twist = (e.rand() < 0.5 ? -1 : 1) * (0.2 + 0.2 * e.rand());
  },
  update(inst, dt, L) { return ONESHOTS.jump.update.call(ONESHOTS.jump, inst, dt, L); },
  onLand(inst, L) { ONESHOTS.jump.onLand(inst, L); },
  apply(P, w, inst, L) {
    ONESHOTS.jump.apply(P, w, inst, L);
    if (inst.phase === 'air') {
      const T = (2 * inst.vy) / 9.81, x = clamp((inst.t - inst.tAir) / T, 0, 1);
      const a = Math.sin(PI * x);
      // stiff legs (not tucked), the back arched, head down, a twist of the body
      // (only in the first part of the flight: the built-in jump sets the legs up for the landing)
      const st = 1 - smooth(0.45, 0.7, x);
      for (let i = 0; i < 4; i++) { P.legs[i].tuck *= 1 - 0.7 * st; P.legs[i].extend = lerp(P.legs[i].extend, 0.9, 0.7 * st); }
      mx(P, 'pitch', 0.05, 0.8); mx(P, 'roll', inst.twist * a, 1); mx(P, 'bend', -inst.twist * 0.6 * a, 1);
      mx(P, 'headPitch', 0.3, a); mx(P, 'tailLift', 0.4, 1);
    }
  },
};

// attack. Ram: squares up (head high, chin tucked), turns and walks off a few metres, turns back,
// charges and clashes head-on (head lowered in the last strides, forehead / horns first; the
// forequarters thrown up at the impact); the hit at the clash. While running it charges at once. Ewe:
// stamps a foreleg, then a short butt with the forehead. opts.target (Vector3) aims it.
const FAR = 1e6;
const attack = {
  kind: 'oneshot', fade: 0.18, needsStand: true,
  start(inst, L) {
    const e = L.engine, b = B(e), cfg = e.cfg;
    inst.ram = inst.opts.style ? inst.opts.style === 'charge' : b.ram;
    inst.run = smooth(1.2, 3.0, e.speed / cfg.sq);
    inst.target = inst.opts.target ? inst.opts.target.clone() : null;
    inst.hit = false;
    inst.h = inst.target ? Math.atan2(inst.target.x - e.pos.x, inst.target.z - e.pos.z) : e.heading;
    if (inst.ram) {
      inst.phase = inst.run > 0.3 ? 'charge' : 'threat';
      inst.p0 = e.pos.clone();
      inst.dBack = (inst.opts.backOff ?? 2.2) * cfg.s;
      inst.vCharge = 4.2 * cfg.sq;
      inst.hitAt = FAR; inst.tCharge = inst.phase === 'charge' ? 0 : FAR;
      inst.dur = Infinity;
      b.steer = null;
    } else {
      inst.tStamp = inst.run > 0.3 ? 0 : 1.1;
      inst.hitAt = inst.tStamp + 0.55;
      inst.dur = inst.hitAt + 0.7;
      inst.leg = e.rand() < 0.5 ? 0 : 1;
      inst.stamped = false;
    }
  },
  update(inst, dt, L) {
    const e = L.engine, b = B(e), t = inst.t, cfg = e.cfg;
    if (inst.ram) {
      const ph = inst.phase;
      if (ph === 'threat') { b.steer = { speed: 0, heading: e.heading }; if (t > 0.9) inst.phase = 'away'; }
      else if (ph === 'away') {
        // turn round and walk off
        const off = Math.abs(angDiff(e.heading, inst.h + Math.PI));
        b.steer = { speed: 1.0 * cfg.sq * (1 - smooth(0.4, 1.2, off)), heading: inst.h + Math.PI };
        const d = Math.hypot(e.pos.x - inst.p0.x, e.pos.z - inst.p0.z);
        if (d > inst.dBack || t > 12) { inst.phase = 'turn'; inst.tTurn = t; }
      } else if (ph === 'turn') {
        // turn back to face the rival
        const h = inst.target ? Math.atan2(inst.target.x - e.pos.x, inst.target.z - e.pos.z) : inst.h;
        b.steer = { speed: 0, heading: h };
        if ((Math.abs(angDiff(e.heading, h)) < 0.12 && e.speed < 0.2 * cfg.sq && t - inst.tTurn > 0.8) || t - inst.tTurn > 5) {
          inst.phase = 'charge'; inst.tCharge = t; inst.h = h;
        }
      } else if (ph === 'charge') {
        b.steer = { speed: inst.vCharge * smooth(0, 0.5, t - inst.tCharge), heading: inst.h };
        const dist = inst.target ? Math.hypot(inst.target.x - e.pos.x, inst.target.z - e.pos.z) - 0.55 * cfg.s : Math.max(0, inst.dBack + 0.8 * cfg.s - Math.hypot(e.pos.x - inst.p0.x, e.pos.z - inst.p0.z) * 0) - (t - inst.tCharge) * 0.72 * inst.vCharge;
        // (the head goes down in the last 0.55 s: predict the clash)
        const v = Math.max(e.speed, 0.5);
        if (inst.hitAt === FAR && (dist / v < 0.55 || t - inst.tCharge > 4)) inst.hitAt = t + clamp(dist / v, 0.25, 0.55);
        if (t >= inst.hitAt) { inst.phase = 'recover'; inst.dur = t + 1.6; }
      } else b.steer = { speed: 0, heading: e.heading };
    } else if (!inst.stamped && inst.tStamp > 0 && t > 0.62) {
      inst.stamped = true;
      const leg = e.legs[inst.leg];
      e.emit('footstep', { foot: leg.def.key, position: leg.plant.clone(), speed: 0, strength: 1, stamp: true });
    }
    if (!inst.hit && t >= inst.hitAt) {
      inst.hit = true;
      const p = new THREE.Vector3().copy(e.headPose.position);
      const dir = inst.target ? inst.target.clone().sub(e.pos).setY(0).normalize() : e.forward(e.heading, new THREE.Vector3());
      e.emit('attackHit', { position: p, direction: dir, style: 'headbutt' });
    }
    if (t >= inst.dur) { b.steer = null; return true; }
    return false;
  },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, u = 1 / cfg.unit, s = cfg.s, t = inst.t;
    if (inst.target && inst.phase !== 'away') { P.look = inst.target; mx(P, 'lookW', 0.8, w * (1 - smooth(inst.hitAt - 0.6, inst.hitAt - 0.3, t))); }
    if (inst.ram) {
      // threat: head high, chin tucked, ears back; walking off: head low, ears back
      const thr = w * smooth(0, 0.4, t) * (1 - smooth(inst.tCharge, inst.tCharge + 0.4, t));
      mx(P, 'headPitch', 0.15, thr); mx(P, 'headRaise', 0.03 * u, thr);
      mx(P, 'earFlat', 0.7, w); mx(P, 'earTwitch', 0, w); mx(P, 'tailLift', -0.1, w);
      // the charge: head goes down in the last strides, the clash, the rebound
      const low = w * smooth(inst.hitAt - 0.55, inst.hitAt - 0.1, t) * (1 - smooth(inst.hitAt + 0.25, inst.hitAt + 1.1, t));
      mx(P, 'headPitch', 0.75, low); mx(P, 'headRaise', -0.11 * u, low); mx(P, 'neckReach', 0.035 * u, low);
      mx(P, 'dropF', 0.12, low);
      // impact: the forequarters are thrown up and back, the head recoils
      const imp = w * smooth(inst.hitAt - 0.02, inst.hitAt + 0.1, t) * (1 - smooth(inst.hitAt + 0.15, inst.hitAt + 0.7, t));
      mx(P, 'dropF', -0.1, imp); mx(P, 'headPitch', 0.35, imp);
    } else {
      // ewe: stamp (if standing), then a butt: head down and forward, a lunge of the body
      if (inst.tStamp > 0) {
        const i = inst.leg, leg = e.legs[i];
        const k = w * smooth(0.1, 0.25, t) * (1 - smooth(0.85, 1.05, t));
        const lift = t < 0.5 ? Math.sin(0.5 * PI * clamp((t - 0.15) / 0.35, 0, 1)) : 1 - smooth(0.5, 0.62, t);
        mx(P, 'gaitW', 0, k); mx(P, 'legGait', 0, k);
        const tp = tv().copy(leg.plant);
        tp.y += 0.09 * s * lift + 0.002 * s;
        P.legs[i].target.copy(tp);
        mxLeg(P, i, 'reach', 1, k);
        mx(P, 'side', -0.012 * (i === 0 ? 1 : -1) * u, k);
        mx(P, 'headPitch', -0.2, k); mx(P, 'earFlat', -0.2, k);
      }
      const b0 = inst.hitAt - 0.45;
      const butt = w * smooth(b0, inst.hitAt - 0.05, t) * (1 - smooth(inst.hitAt + 0.15, inst.hitAt + 0.65, t));
      mx(P, 'headPitch', 0.7, butt); mx(P, 'headRaise', -0.08 * u, butt); mx(P, 'neckReach', 0.04 * u, butt);
      mx(P, 'fwd', 0.05 * u * (inst.run > 0.3 ? 0 : 1), butt); mx(P, 'dropF', 0.1, butt);
      mx(P, 'earFlat', 0.6, butt);
    }
  },
};

// lie: the engine's kneeling lie (actions.lie: down front, up hind), with the rise finished a little
// before the posture is released: its end-first springs must settle at zero before the posture
// instance is removed, or the legs jump in the last frame of standing up
function lieApply(P, w, inst, L) {
  const we = inst.target > 0 ? w : smooth(0.3, 1, w);
  POSTURES.lie.apply(P, we, inst, L);
}
const lie = { kind: 'posture', fadeIn: 1.5, fadeOut: 1.4, apply: lieApply };

// sleep: sternal (sheep rarely lie flat out), head turned back and resting against the flank, eyes
// closed
const sleep = {
  kind: 'posture', fadeIn: 1.4, fadeOut: 1.1,
  apply(P, w, inst, L) {
    lieApply(P, w, inst, L);
    const e = L.engine;
    const c = sm(clamp(w, 0, 1)) * smooth(1.2, 3.2, inst.t);
    mx(P, 'headYaw', inst.side * 0.75, c); mx(P, 'headPitch', 0.4, c); mx(P, 'headRaise', -0.07 / e.cfg.unit, c);
    mx(P, 'bend', inst.side * 0.3, c);
    mx(P, 'earFlat', 0.4, c); mx(P, 'earTwitch', 0.2, c);
    mx(P, 'eyelid', 1, smooth(1.8, 3.2, inst.t) * w);
    mx(P, 'breathRate', 0.6, c); mx(P, 'lookW', 0, c); mx(P, 'tailIdle', 0.2, c);
  },
};

void angDiff;
export const hooks = {
  pose,
  update,
  actions: { alert, bleat, headshake, stamp, pronk, attack, lie, sleep },
};
