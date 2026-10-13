// Cow behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js):
//
//   update(P, dt, layer)  every frame over the action layer: the walk's head bob, rumination (chewing
//                         the cud with a sideways grinding jaw, 40-60 chews per bolus at ~1 Hz, one
//                         side per bolus; while idle standing and above all while lying), fly swishes
//                         of the tail, ear flicks, automatic idle variants (nose licks, a moo now and
//                         then), grazing with the tongue, the bull's charge steering
//   pose(engine, dt)      after the engine's solve: the jaw's lateral grinding, the tongue (out of the
//                         mouth: wrapping grass, licking the nostrils), fast ear flicks
//   actions               attack (bull: paws the ground, then charges head down and tosses; cow: the
//                         sideways "cow kick" with one hind leg, or { kick: 'back' }), lick (nose),
//                         chew (ruminate), moo, swish, shake (head shake), lie / sleep (sternal, rising
//                         hind end first; sleep: head turned back)
//
// Distances are cow metres at the reference size (x cfg.s); posture offsets the engine multiplies by
// cfg.k (fwd, side, headRaise, neckReach) are divided by cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tqa, angDiff } from '../../core/motion/common.js';
import { mx, mxLeg, ONESHOTS, POSTURES } from '../../core/motion/actions.js';

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _pv = new THREE.Vector3();

// per-engine behaviour state
function B(e) {
  if (!e._cow) {
    const idx = (n) => e.sk.bones.indexOf(e.bone[n]);
    const J = e.J;
    const iJaw = idx('jaw'), iTg = idx('tongue');
    const tDir = J.tongueTip.clone().sub(J.tongueBase).normalize();
    const hz = J.nose.clone().sub(J.occiput).normalize();
    const hy = hz.clone().cross(new THREE.Vector3(1, 0, 0)).normalize();
    e._cow = {
      idleT: 0, lickT: 8 + e.rand() * 10, mooT: 40 + e.rand() * 60, swishT: 2 + e.rand() * 4, swishAge: 9, swishAmp: 0.6,
      chew: { on: false, t: 0, next: 3 + e.rand() * 4, ph: 0, side: 1, chews: 0, bolus: 50, pause: 0, force: 0 },
      chewW: 0, jawLat: 0, jawLatV: 0,
      flick: [{ t: 9, dur: 0.3, amp: 0 }, { t: 9, dur: 0.3, amp: 0 }], flickT: 1.5 + e.rand() * 3,
      tg: { ext: 0, up: 0, yaw: 0, curl: 0 }, tgT: { ext: 0, up: 0, yaw: 0, curl: 0 }, tgV: { ext: 0, up: 0, yaw: 0, curl: 0 },
      charge: null, shakeR: 0, shakeY: 0,
      // bind data for the tongue (final, warped + scaled space)
      iJaw, iTg, invJaw: iJaw >= 0 ? e.sk.bind[iJaw].clone().invert() : null, bindTg: iTg >= 0 ? e.sk.bind[iTg].clone() : null,
      tgRel: iTg >= 0 && iJaw >= 0 ? e.sk.bind[iJaw].clone().invert().multiply(e.sk.bind[iTg]) : null,
      tDir, hy, hz, lat: new THREE.Vector3(1, 0, 0),
      mouth: J.jawTip.clone().lerp(J.nose, 0.12), // the mouth opening: pivot of the tongue
      tLen: J.tongueTip.distanceTo(J.tongueBase),
      earAxis: [0, 1].map((k) => { const S = k === 0 ? 'L' : 'R'; return J['earTip' + S].clone().sub(J['earBase' + S]).normalize(); }),
      earLen: J.earTipL.distanceTo(J.earBaseL),
    };
  }
  return e._cow;
}
const busy = (L) => L.oneshots.some((a) => !a.stopping && a.name !== 'swish' && a.name !== 'chew');
const find = (L, n) => L.oneshots.find((a) => a.name === n && a.w > 0);

// ------------------------------------------------------------------------------------------------
// update: gait style, rumination, idle life
function update(P, dt, L) {
  const e = L.engine, cfg = e.cfg, b = B(e), u = 1 / cfg.unit;
  const vn = e.speed / cfg.sq, g = e.gait;
  // ---- walk: the head and neck bob once per forelimb stance (twice per stride), low amplitude
  const walkW = smooth(0.15, 0.6, vn) * (1 - smooth(1.5, 2.0, vn)) * P.gaitW;
  if (walkW > 0.001 && g) {
    const ph = e.phase - g.off[0];
    const c = 0.5 + 0.5 * Math.cos(4 * Math.PI * (ph - 0.1));
    P.headRaise -= 0.05 * u * walkW * c;
    P.headPitch += 0.05 * walkW * (c - 0.5);
  }

  // ---- idle bookkeeping
  const idleW = L.idle.w;
  const lying = L.postures.find((p) => (p.name === 'lie') && p.target > 0 && p.w > 0.95);
  const resting = L.postures.find((p) => (p.name === 'lie' || p.name === 'sleep') && p.target > 0 && p.w > 0.95);
  const calm = (idleW > 0.9 && !L.postures.length && !busy(L)) || (!!lying && !busy(L));

  // ---- dead on its side: the sideways ears laid back along the neck (not into the ground), the
  // head on its cheek
  for (const p of L.postures) {
    if (p.name !== 'death') continue;
    const w = p.w * p.w * (3 - 2 * p.w) * smooth(0.3, 0.9, p.t);
    mx(P, 'earFlat', 1, w); mx(P, 'earTwitch', 0, w);
    P.headPos.y += 0.08 * cfg.s * w;
    // a horned head cannot lie flat on its cheek: it rests on the ground-side horn and the jaw, rolled
    // less (0.9 rad instead of the engine's 1.3) with the occiput higher by about the horn's reach
    // below it (without this the engine's clearance could keep either the horn or the jaw out of the
    // ground, not both: a Highland's jaw 20-27 mm and a Hereford's 21-32 mm deep)
    if (e.params.horns) {
      const hw = p.w * smooth(0.35, 1.0, p.t);
      mx(P, 'headRoll', p.side * 0.9, hw);
      P.headPos.y += 0.1 * cfg.s * hw;
    }
    // the long cannons are spread out from under the falling body early, so the lower foreleg does
    // not fold into the ground under the chest
    const sp = smooth(0.35, 0.9, p.t) * p.w;
    for (let i = 0; i < 4; i++) P.legs[i].spread = Math.max(P.legs[i].spread, sp);
    // the long tail follows the rolling rump stiffly while it falls (a loose one is slapped onto the
    // ground by the roll and kinks at the contact)
    mx(P, 'tailStiff', 1.6, (1 - smooth(1.0, 1.6, p.t)) * p.w);
  }

  // ---- rumination: bouts of chewing the cud (mostly lying, often standing idle)
  const ch = b.chew;
  if (ch.force > 0) ch.force -= dt;
  const wantChew = ch.force > 0 || calm;
  if (wantChew) {
    ch.next -= dt;
    if (ch.next <= 0) {
      ch.on = !ch.on;
      ch.next = ch.on ? (lying ? 50 + e.rand() * 60 : 25 + e.rand() * 30) : (lying ? 4 + e.rand() * 5 : 8 + e.rand() * 12);
      if (ch.on) { ch.chews = 0; ch.bolus = 40 + Math.floor(e.rand() * 20); ch.side = e.rand() < 0.5 ? -1 : 1; ch.pause = 0; }
    }
    if (ch.force > 0 && !ch.on) { ch.on = true; ch.chews = 0; ch.pause = 0; ch.next = Math.max(ch.next, ch.force); }
  } else { ch.on = false; ch.next = Math.min(ch.next, 2 + e.rand()); }
  let chewing = ch.on && wantChew;
  if (chewing && ch.pause > 0) { ch.pause -= dt; chewing = false; }
  b.chewW = clamp(b.chewW + (chewing ? dt * 2.5 : -dt * 3), 0, 1);
  const cw = b.chewW * b.chewW * (3 - 2 * b.chewW);
  if (b.chewW > 0) {
    const rate = 1.05; // chews per second
    const prev = ch.ph;
    ch.ph += dt * rate * (0.4 + 0.6 * cw);
    if (Math.floor(ch.ph) !== Math.floor(prev)) {
      ch.chews++;
      if (ch.chews >= ch.bolus) { ch.chews = 0; ch.bolus = 40 + Math.floor(e.rand() * 20); ch.side = -ch.side; ch.pause = 3 + e.rand() * 2; }
    }
    const c = ch.ph % 1;
    // grinding: the jaw drops, swings to the chewing side, closes, and grinds back across
    const open = 0.5 - 0.5 * Math.cos(TAU * c);
    mx(P, 'jaw', 0.02 + 0.075 * open, cw); mx(P, 'jawOmega', 22, cw);
    b.jawLatT = ch.side * 0.06 * Math.sin(TAU * c + 0.9) * cw;
  } else b.jawLatT = 0;

  // ---- grazing: bite cycle with the tongue wrapping the grass (the built-in 'eat' holds the head)
  const eat = find(L, 'eat');
  const tg = b.tgT; // (targets: set by the actions and here, consumed and cleared by pose)
  if (eat) {
    const w = eat.w * eat.w * (3 - 2 * eat.w);
    const c = (eat.t * 0.9) % 1;
    const open = smooth(0.0, 0.1, c) * (1 - smooth(0.32, 0.44, c));
    const chew2 = Math.max(0, Math.sin(TAU * 2 * (c - 0.45) / 0.55)) * smooth(0.45, 0.5, c);
    mx(P, 'jaw', 0.05 + 0.2 * open + 0.06 * chew2, w);
    const side = Math.floor(eat.t * 0.9) % 2 ? 1 : -1;
    const out = smooth(0.04, 0.18, c) * (1 - smooth(0.26, 0.4, c));
    tg.ext += 0.75 * out * w;
    tg.up += -0.35 * out * w; // tip down toward the sward
    tg.yaw += side * 0.45 * smooth(0.12, 0.3, c) * out * w; // sweeps round the tuft
    tg.curl += 0.6 * smooth(0.18, 0.32, c) * out * w;
    b.jawLatT += 0.03 * side * chew2 * w;
  }

  // ---- idle variants: nose licks, now and then a moo
  if (calm && idleW > 0.9 && !L.postures.length) {
    b.lickT -= dt; b.mooT -= dt;
    if (b.lickT <= 0) { b.lickT = 14 + e.rand() * 20; if (!b.chew.on || e.rand() < 0.3) L.play('lick'); }
    if (b.mooT <= 0) { b.mooT = 60 + e.rand() * 90; L.play('moo'); }
    b.shakeT = (b.shakeT ?? 12 + e.rand() * 20) - dt;
    if (b.shakeT <= 0) { b.shakeT = 20 + e.rand() * 30; L.play('shake'); }
  }

  // ---- fly swish: bursts of tail lashing (standing, walking slowly, lying)
  const swishOk = (idleW > 0.5 || vn < 1.4 || resting) && !L.postures.some((p) => p.name === 'death');
  if (swishOk) {
    b.swishT -= dt;
    if (b.swishT <= 0) { b.swishT = 3 + e.rand() * 8; b.swishAge = 0; b.swishAmp = 0.45 + 0.4 * e.rand(); }
  }
  const sw = find(L, 'swish');
  if (sw && sw.t < 0.05) { b.swishAge = 0; b.swishAmp = 0.9; }
  b.swishAge += dt;
  const sa = Math.sin(Math.PI * clamp(b.swishAge / 2.2, 0, 1));
  if (sa > 0.001) { P.tailWag = Math.max(P.tailWag, b.swishAmp * sa * (resting ? 0.5 : 1)); mx(P, 'tailLift', 0.12, sa * 0.5); }

  // ---- ear flicks (against flies): one ear at a time, fast
  b.flickT -= dt;
  if (b.flickT <= 0) {
    b.flickT = 1.2 + e.rand() * 4;
    const k = e.rand() < 0.5 ? 0 : 1, f = b.flick[k];
    if (f.t > f.dur) { f.t = 0; f.dur = 0.22 + 0.12 * e.rand(); f.amp = (0.35 + 0.35 * e.rand()) * (e.rand() < 0.5 ? 1 : -1) * (1 - P.eyelid * 0.8); }
  }
  for (const f of b.flick) f.t += dt;

  // ---- bull charge steering (attack)
  const cg = b.charge;
  if (cg) {
    if (cg.run) {
      e.wantSpeed = Math.max(e.wantSpeed, cg.speed * smooth(0, 0.5, cg.tRun));
      e.wantHeading = cg.heading;
    } else if (cg.brake) e.wantSpeed = Math.min(e.wantSpeed, 0);
  }
}

// ------------------------------------------------------------------------------------------------
// pose: jaw grinding, tongue, ear flicks (after the engine wrote every bone)
function pose(e, dt) {
  const b = B(e);
  if (e.lod === 2) {
    // crowd tier: no grinding jaw, tongue, head shake or ear flicks (not visible, and cheap)
    b.tgT.ext = b.tgT.up = b.tgT.yaw = b.tgT.curl = 0; b.shakeR = b.shakeY = 0;
    return;
  }
  // jaw: critically damped spring on the lateral grinding angle
  const om = 26;
  b.jawLatV += (om * om * ((b.jawLatT || 0) - b.jawLat) - 2 * om * b.jawLatV) * dt;
  b.jawLat += b.jawLatV * dt;
  // tongue springs
  let tongueOut = false;
  for (const k of ['ext', 'up', 'yaw', 'curl']) {
    const o2 = 16;
    b.tgV[k] += (o2 * o2 * (b.tgT[k] - b.tg[k]) - 2 * o2 * b.tgV[k]) * dt;
    b.tg[k] += b.tgV[k] * dt;
    if (Math.abs(b.tg[k]) > 1e-4) tongueOut = true;
    b.tgT[k] = 0;
  }
  const jaw = e.bone.jaw, tongue = e.bone.tongue;
  if (!jaw) return;
  const moveJaw = Math.abs(b.jawLat) > 1e-5;
  if (moveJaw) {
    // swing the jaw sideways about the head's dorsal axis through the hinge
    _q.setFromRotationMatrix(e.bone.head.matrixWorld).multiply(_q2.copy(e.bindQ.head).invert());
    const axis = _v.copy(b.hy).applyQuaternion(_q).normalize();
    const hinge = _pv.setFromMatrixPosition(jaw.matrixWorld);
    _q2.setFromRotationMatrix(jaw.matrixWorld);
    _q2.premultiply(tqa(axis, b.jawLat));
    _s.set(1, 1, 1);
    jaw.matrixWorld.compose(hinge, _q2, _s);
  }
  if (tongue && b.tgRel) {
    if (moveJaw || tongueOut) tongue.matrixWorld.multiplyMatrices(jaw.matrixWorld, b.tgRel);
    if (tongueOut) {
      // X (bind space): slide out along the tongue, then turn about the mouth opening: up / down
      // (about the lateral axis), sideways (about the dorsal axis) and curl
      const t = b.tg, s = e.cfg.s;
      const X = _m.makeTranslation(b.tDir.x * t.ext * 0.13 * s, b.tDir.y * t.ext * 0.13 * s, b.tDir.z * t.ext * 0.13 * s);
      const piv = b.mouth;
      _q.setFromAxisAngle(b.hy, t.yaw).multiply(tqa(b.lat, -t.up - t.curl * 0.5));
      _m2.makeTranslation(-piv.x, -piv.y, -piv.z);
      const R = new THREE.Matrix4().makeRotationFromQuaternion(_q);
      R.multiply(_m2); R.premultiply(_m2.makeTranslation(piv.x, piv.y, piv.z));
      X.premultiply(R);
      // world = jaw * inv(bindJaw) * X * bindTongue
      tongue.matrixWorld.multiplyMatrices(jaw.matrixWorld, b.invJaw).multiply(X).multiply(b.bindTg);
    }
  }
  // head shake: rotate the head and everything riding on it about the occiput (roll about the
  // head's long axis, a little yaw). (It runs after the engine's ground clearance: faded out as the
  // occiput comes down toward the ground, a head lowered to graze or resting on the ground.)
  if (b.shakeR || b.shakeY) {
    const head = e.bone.head;
    const piv = _pv.setFromMatrixPosition(head.matrixWorld);
    const kc = smooth(0.35, 0.6, (piv.y - e.terrainH(piv.x, piv.z)) / e.cfg.s);
    _q.setFromRotationMatrix(head.matrixWorld).multiply(_q2.copy(e.bindQ.head).invert());
    const ax = _v.copy(b.hz).applyQuaternion(_q).normalize();
    _q2.setFromAxisAngle(ax, b.shakeR * kc).premultiply(tqa(tv(0, 1, 0), b.shakeY * kc));
    _m.makeTranslation(-piv.x, -piv.y, -piv.z).premultiply(_m2.makeRotationFromQuaternion(_q2)).premultiply(new THREE.Matrix4().makeTranslation(piv.x, piv.y, piv.z));
    for (const n of ['head', 'jaw', 'tongue', 'earL', 'earR']) { const bn = e.bone[n]; if (bn) bn.matrixWorld.premultiply(_m); }
    b.shakeR = b.shakeY = 0;
  }
  // ear flicks (none when dead; faded out as the ear tip nears the ground: the flick runs after the
  // engine's ground clearance, and an ear on the ground side of a head lying on its side, sleeping or
  // grazing, would be swung into it)
  if (e.lod < 2 && e.actionsLayer.posture !== 'dead') {
    for (let k = 0; k < 2; k++) {
      const f = b.flick[k];
      if (f.t > f.dur || !f.amp) continue;
      const bone = k === 0 ? e.bone.earL : e.bone.earR;
      if (!bone) continue;
      const base = _pv.setFromMatrixPosition(bone.matrixWorld);
      _q2.setFromRotationMatrix(bone.matrixWorld);
      const along = _v.set(0, 1, 0).applyQuaternion(_q2);
      const tx = base.x + along.x * b.earLen, tz = base.z + along.z * b.earLen;
      const clear = smooth(0.12, 0.3, (base.y + along.y * b.earLen - e.terrainH(tx, tz)) / e.cfg.s);
      if (clear <= 0) continue;
      const x = f.t / f.dur, a = f.amp * Math.sin(Math.PI * x) * Math.sin(Math.PI * x) * clear;
      const axis = tv().crossVectors(along, tv(0, 1, 0));
      if (axis.lengthSq() < 1e-8) continue;
      _q2.premultiply(tqa(axis.normalize(), a)).premultiply(tqa(along, a * 0.8));
      bone.matrixWorld.compose(base, _q2, _s.set(1, 1, 1));
    }
  }
}

// ------------------------------------------------------------------------------------------------
// actions

// lick: the tongue comes out and up into one nostril, then the other
const lick = {
  kind: 'oneshot', fade: 0.25,
  start(inst, L) { inst.dur = 2.4; inst.side = L.engine.rand() < 0.5 ? 1 : -1; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const b = B(L.engine), t = inst.t;
    const out = smooth(0.15, 0.45, t) * (1 - smooth(1.85, 2.25, t));
    mx(P, 'jaw', 0.14, out * w); mx(P, 'jawOmega', 18, w);
    mx(P, 'headPitch', -0.08, out * w);
    const tg = b.tgT;
    tg.ext += 0.85 * out * w;
    tg.up += 1.05 * smooth(0.35, 0.65, t) * (1 - smooth(1.7, 2.05, t)) * w;
    const sweep = lerp(inst.side, -inst.side, smooth(0.95, 1.35, t));
    tg.yaw += 0.32 * sweep * smooth(0.45, 0.7, t) * (1 - smooth(1.6, 1.9, t)) * w;
    tg.curl += 0.25 * out * w;
  },
};

// shake: a quick head shake against flies (the head rolls and yaws about 3 times a second, the
// ears flap with it)
const shake = {
  kind: 'oneshot', fade: 0.15,
  start(inst, L) { inst.dur = 1.3; inst.dir = L.engine.rand() < 0.5 ? 1 : -1; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const t = inst.t, env = smooth(0.0, 0.15, t) * (1 - smooth(0.8, 1.25, t)) * w;
    const osc = Math.sin(TAU * 3.1 * t) * inst.dir;
    // (too fast for the head's carriage springs: applied to the head's bones in pose())
    const b = B(L.engine);
    b.shakeR += 0.42 * osc * env; b.shakeY += 0.16 * osc * env;
    P.headPitch += 0.08 * env;
    mx(P, 'earFlat', 0.35 + 0.35 * osc, env); mx(P, 'earTwitch', 0, env); mx(P, 'eyelid', 0.5, env);
  },
};

// chew: a bout of rumination on demand (the automatic idle does it by itself)
const chew = {
  kind: 'oneshot', fade: 0.3,
  start(inst, L) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 12); const c = B(L.engine).chew; c.force = Math.min(inst.dur, 1e6); c.on = true; c.next = Math.max(c.next, 1); c.pause = 0; },
  update(inst, dt, L) { if (inst.t >= inst.dur) { B(L.engine).chew.force = 0; return true; } return false; },
  apply() {},
};

// swish: one burst of tail lashing
const swish = {
  kind: 'oneshot', fade: 0.2,
  start(inst) { inst.dur = 2.2; },
  update(inst) { return inst.t >= inst.dur; },
  apply() {},
};

// moo: the head stretches forward and up, the mouth opens and the jaw trembles
const moo = {
  kind: 'oneshot', fade: 0.35,
  start(inst) { inst.dur = 2.4; inst.said = false; },
  update(inst, dt, L) {
    if (!inst.said && inst.t > 0.45) { inst.said = true; L.engine.emit('vocalize', { kind: 'moo', position: L.engine.headPose.position.clone() }); }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const u = 1 / L.engine.cfg.unit, t = inst.t;
    const k = smooth(0.1, 0.55, t) * (1 - smooth(1.8, 2.35, t)) * w;
    mx(P, 'neckReach', 0.12 * u, k); mx(P, 'headRaise', 0.12 * u, k); mx(P, 'headPitch', -0.62, k);
    mx(P, 'jaw', 0.28 + 0.04 * Math.sin(t * 40), k * smooth(0.4, 0.6, t)); mx(P, 'jawOmega', 20, w);
    mx(P, 'lookW', 0, k); mx(P, 'earFlat', 0.3, k);
  },
};

// attack. Bull (or { style: 'charge' }): threat with the head low, paws the ground with one
// forefoot (three scrapes, dirt thrown back), then charges head down and butts / tosses at the
// target. Cow (or { style: 'kick' }): the "cow kick", one hind leg sweeping forward and out to the
// side; { kick: 'back' } kicks straight back.
const attack = {
  kind: 'oneshot', fade: 0.18, needsStand: true,
  start(inst, L) {
    const e = L.engine, b = B(e);
    const bull = (e.params.bull || 0) >= 0.5;
    inst.run = smooth(1.2, 3.5, e.speed / e.cfg.sq);
    // (a running cow does not kick: she butts with the head on the move, like a bull)
    inst.style = inst.opts.style || (inst.opts.kick ? 'kick' : bull || inst.run > 0.3 ? 'charge' : 'kick');
    inst.target = inst.opts.target ? inst.opts.target.clone() : null;
    inst.hit = false;
    if (inst.style === 'charge') {
      inst.paw = inst.run < 0.3 && inst.opts.paw !== false;
      inst.tPaw = inst.paw ? 2.3 : 0.2;
      inst.pawLeg = e.rand() < 0.5 ? 0 : 1;
      let h = e.heading;
      if (inst.target) h = Math.atan2(inst.target.x - e.pos.x, inst.target.z - e.pos.z);
      const dist = inst.target ? Math.hypot(inst.target.x - e.pos.x, inst.target.z - e.pos.z) : 5 * e.cfg.s;
      inst.speed = clamp(dist * 0.9, 3.5, 6.5) * e.cfg.sq;
      inst.tRun = clamp(dist / (inst.speed * 0.8) + 0.6, 1.4, 3.2);
      b.charge = { run: false, brake: false, heading: h, speed: inst.speed, tRun: 0 };
      inst.dur = inst.tPaw + inst.tRun + 1.3;
      inst.hitAt = inst.tPaw + inst.tRun;
      inst.scrapes = [false, false, false];
    } else {
      inst.back = inst.opts.kick === 'back';
      inst.leg = 2 + (e.rand() < 0.5 ? 0 : 1);
      if (inst.target) {
        const lx = (inst.target.x - e.pos.x) * Math.cos(e.heading) - (inst.target.z - e.pos.z) * Math.sin(e.heading);
        inst.leg = lx > 0 ? 2 : 3;
      }
      inst.dur = 1.25; inst.hitAt = 0.52;
    }
  },
  update(inst, dt, L) {
    const e = L.engine, b = B(e);
    if (inst.style === 'charge') {
      const cg = b.charge;
      if (cg) {
        if (inst.target) cg.heading = Math.atan2(inst.target.x - e.pos.x, inst.target.z - e.pos.z) * 0.0 + cg.heading; // (committed once it runs)
        cg.run = inst.t >= inst.tPaw && inst.t < inst.hitAt + 0.15;
        cg.brake = inst.t >= inst.hitAt + 0.15;
        if (cg.run) cg.tRun += dt;
        // look at the target during the threat
      }
      if (inst.paw) {
        for (let j = 0; j < 3; j++) {
          const tt = 0.55 + j * 0.55 + 0.32;
          if (!inst.scrapes[j] && inst.t >= tt) {
            inst.scrapes[j] = true;
            const leg = e.legs[inst.pawLeg];
            e.emit('footstep', { foot: leg.def.key, position: leg.plant.clone(), speed: 0, strength: 0.8, paw: true });
          }
        }
      }
      if (!inst.hit && inst.t >= inst.hitAt) this.strike(inst, L);
      if (inst.t >= inst.dur) { b.charge = null; return true; }
      return false;
    }
    if (!inst.hit && inst.t >= inst.hitAt) this.strike(inst, L);
    return inst.t >= inst.dur;
  },
  strike(inst, L) {
    const e = L.engine;
    inst.hit = true;
    let p, dir;
    if (inst.style === 'charge') {
      p = new THREE.Vector3().copy(e.headPose.position);
      dir = e.forward(e.heading, new THREE.Vector3());
    } else {
      const leg = e.legs[inst.leg];
      p = leg.contact.clone();
      dir = inst.back ? e.forward(e.heading, new THREE.Vector3()).negate() : e.left(e.heading, new THREE.Vector3()).multiplyScalar(leg.def.s).addScaledVector(e.forward(e.heading, new THREE.Vector3()), 0.5).normalize();
    }
    e.emit('attackHit', { position: p, direction: dir, style: inst.style === 'charge' ? 'butt' : 'kick' });
  },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, u = 1 / cfg.unit, s = cfg.s, t = inst.t;
    if (inst.target) { P.look = inst.target; mx(P, 'lookW', 1, w); }
    if (inst.style === 'charge') {
      // head low, forehead / horns forward, ears back
      const low = smooth(0, 0.5, t) * (1 - smooth(inst.hitAt + 0.05, inst.hitAt + 0.9, t));
      mx(P, 'headRaise', -0.2 * u, low * w); mx(P, 'headPitch', 0.3, low * w); mx(P, 'neckReach', 0.04 * u, low * w);
      mx(P, 'earFlat', 0.7, low * w); mx(P, 'tailLift', 0.3, low * w);
      // toss: the head swings up at the hit
      const toss = smooth(inst.hitAt - 0.1, inst.hitAt + 0.12, t) * (1 - smooth(inst.hitAt + 0.25, inst.hitAt + 0.8, t));
      mx(P, 'headPitch', -0.35, toss * w); mx(P, 'headRaise', 0.02 * u, toss * w);
      if (inst.paw && t < inst.tPaw) {
        // pawing: one forefoot lifts, reaches forward and scrapes back along the ground
        const k = smooth(0.35, 0.55, t) * (1 - smooth(inst.tPaw - 0.4, inst.tPaw - 0.1, t)) * w;
        mx(P, 'legGait', 0, k); mx(P, 'gaitW', 0, k);
        const i = inst.pawLeg, leg = e.legs[i];
        const c = clamp((t - 0.55) / 0.55, 0, 3);
        const ph = c - Math.floor(c);
        const on = c < 3 ? 1 : 0;
        // path: lift and reach forward (0 - 0.4), touch down ahead (0.45), scrape back (0.45 - 0.9)
        const fwd = on * (ph < 0.45 ? smooth(0, 0.4, ph) : 1 - smooth(0.45, 0.9, ph)) * 0.2 * s;
        const up = on * (ph < 0.45 ? Math.sin(Math.PI * clamp(ph / 0.45, 0, 1)) * 0.12 * s : 0.004 * s);
        const tp = tv().copy(leg.plant).addScaledVector(e.forward(e.heading, tv()), fwd - 0.03 * s * on);
        tp.y += up;
        P.legs[i].target.copy(tp);
        mxLeg(P, i, 'reach', 1, k);
        mx(P, 'side', -leg.def.s * 0.02 * u, k); mx(P, 'dropF', 0.04, k);
      }
    } else {
      const i = inst.leg, leg = e.legs[i], Ld = leg.def, pl = P.legs[i];
      const lift = smooth(0.08, 0.3, t) * (1 - smooth(0.78, 1.15, t));
      const sweep = smooth(0.3, 0.52, t) * (1 - smooth(0.62, 0.95, t));
      // weight onto the other three legs
      mx(P, 'side', -Ld.s * 0.035 * u, lift * w); mx(P, 'roll', Ld.s * 0.04, lift * w);
      mx(P, 'legGait', 0, lift * w); mx(P, 'gaitW', 0, lift * w);
      mx(P, 'earFlat', 0.6, lift * w); mx(P, 'headYaw', Ld.s * 0.25, lift * w);
      const base = tv().copy(leg.plant);
      let tp;
      if (inst.back) tp = e.bodyToWorld(Ld.cx * Ld.s, 0, cfg.zH - Ld.len * 0.55, e.heading, e.pos, tv());
      else tp = e.bodyToWorld(Ld.s * (Ld.cx + Ld.len * 0.28), 0, cfg.zH + Ld.len * 0.12, e.heading, e.pos, tv());
      tp.y = e.terrainH(tp.x, tp.z) + Ld.len * (inst.back ? 0.35 : 0.3);
      const mid = tv().copy(base).lerp(tp, 0.35); mid.y = base.y + Ld.len * 0.22;
      const q = tv().copy(base).lerp(mid, smooth(0, 1, lift)).lerp(tp, sweep);
      pl.target.copy(q);
      mxLeg(P, i, 'reach', 1, lift * w);
    }
  },
};

// sleep: lying sternal with the head turned back along the flank / resting beside the forelegs
// Getting up hind end first: the built-in lie lowers the forequarters last (target reached only as
// the posture's weight reaches 0), and its lagging spring would still hold the knees down when the
// posture is removed (a pop). Getting up runs on a remapped weight that finishes 0.3 of the fade
// early and a longer fade, so both ends have settled before the posture ends.
const rise = (w, inst) => (inst.target > 0 ? w : smooth(0.3, 1, w));
const lie = {
  kind: 'posture', fadeIn: 1.3, fadeOut: 1.6,
  apply(P, w, inst, L) { POSTURES.lie.apply(P, rise(w, inst), inst, L); },
};

const sleep = {
  kind: 'posture', fadeIn: 1.3, fadeOut: 1.7,
  apply(P, w0, inst, L) {
    const w = rise(w0, inst);
    POSTURES.sleep.apply(P, w, inst, L);
    const c = smooth(1.0, 3.0, inst.t) * w;
    mx(P, 'roll', inst.side * 0.1, c); mx(P, 'bend', inst.side * 0.35, c);
    // the long head, already carried nose-down, rests on its cheek beside the forelegs instead of
    // being pushed into the ground: occiput higher, nose less tucked
    P.headPos.y += 0.2 * L.engine.cfg.s * c;
    P.headPitch -= 0.45 * c;
  },
};

// hit: the engine's stagger, head up, tail clamped
const hit = {
  ...ONESHOTS.hit,
  kind: 'oneshot',
  apply(P, w, inst, L) {
    ONESHOTS.hit.apply(P, w, inst, L);
    mx(P, 'headPitch', -0.25, w * smooth(0.1, 0.3, inst.t) * (1 - smooth(0.5, 0.75, inst.t)));
  },
};

export const behaviour = {
  update,
  pose,
  actions: { attack, lick, chew, moo, swish, shake, lie, sleep, hit },
};
void angDiff;
