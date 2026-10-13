// White-tailed deer behaviour layer for the quadruped engine (species.motion.hooks, see
// core/motion/actions.js):
//
//   pose(engine, dt)      after the engine's solve: the ears swivel on their own, constantly (each
//                         pinna turns toward a new "sound" every 0.6-3 s, faster when alarmed); the
//                         tail flag (raised vertically, white underside showing, waving a little from
//                         side to side) blended over the engine's tail chain
//   update(P, dt, layer)  every frame over the action layer: alarm level (fleeing, hit, stomping,
//                         jumping) -> tail flag; the walk's head nod; grazing with frequent head-up
//                         alert checks (chewing, ears pricked, looking round); zig-zag escape
//                         steering; idle variants (the suspicious foot stomp with head bob, the alert
//                         stare, tail swishes); sternal sleep with the head laid back
//   actions               stomp, alert, flee, attack (buck: antler thrust; doe / fawn: rears and
//                         flails with the forefeet), hit (engine stagger + tail flag), jump (slower
//                         tuck, forelegs reaching for the landing; opts.height / distance), death
//                         (hooves planted while the legs buckle), lie / sleep (staged kneel, rise hind
//                         first), sit (sternal bedding, head up and alert)
//
// Distances are deer metres at the reference size (x cfg.s); posture offsets the engine multiplies
// by cfg.k (fwd, side, headRaise, neckReach) are divided by cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tqa } from '../../core/motion/common.js';
import { mx, mxLeg, ONESHOTS, POSTURES } from '../../core/motion/actions.js';
import { antlerCurves } from './sculpt.js';
import { deerJoints } from './rig.js';

const _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const sm = (w) => w * w * (3 - 2 * w);

// per-engine behaviour state
function B(e) {
  if (!e._deer) {
    e._deer = {
      ear: [{ sw: 0, v: 0, target: 0, tNext: 0.4 }, { sw: 0, v: 0, target: 0, tNext: 1.1 }],
      alarm: 0, flag: 0, flagV: 0, flagT: 0,
      idleT: 6 + e.rand() * 6, graze: { checkIn: 2 + e.rand() * 3, t: -1, dur: 2, look: new THREE.Vector3() },
      flee: null, dirs: null,
    };
  }
  return e._deer;
}
const busy = (L) => L.postures.length > 0 || L.oneshots.some((a) => !a.stopping);

// antler sample points (beam and tine tips) relative to the occiput, bind pose, reference size
const _AJ = deerJoints();
function antlerSamples(A) {
  const o = _AJ.occiput, out = [];
  for (const side of antlerCurves(A)) {
    for (let i = 2; i < side.beam.length; i += 2) out.push(side.beam[i]);
    out.push(side.beam[side.beam.length - 1]);
    for (const t of side.tines) out.push(t.pts[t.pts.length - 1], t.pts[Math.floor(t.pts.length / 2)]);
  }
  return out.map((p) => new THREE.Vector3(p[0] - o[0], p[1] - o[1], p[2] - o[2]));
}
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _m = new THREE.Matrix4();

// antlers never enter the ground (a buck lying dead, sleeping, grazing on a bank): the skull (with
// the jaw and ears) turns about the occiput just enough to lift the lowest antler point, smoothly
function antlerClear(e, b, dt) {
  const A = e.params.antlers;
  if (!A) return;
  const cfg = e.cfg, head = e.bone.head;
  if (!head || !e.bindQ || !e.bindQ.head) return;
  if (e.lod >= 2 && e.P.groundW < 0.01 && !(b.aLift > 0)) return; // (crowd: only resting on the ground)
  if (!b.aPts) { b.aPts = antlerSamples(A); b.aLift = 0; b.aReach = Math.max(...b.aPts.map((v) => v.length())); }
  const occ = tv().setFromMatrixPosition(head.matrixWorld);
  const s = cfg.s;
  if (occ.y - e.terrainH(occ.x, occ.z) > b.aReach * s + 0.05 && b.aLift < 1e-4) return;
  _qa.setFromRotationMatrix(head.matrixWorld).multiply(_qb.copy(e.bindQ.head).invert());
  let need = 0, ax = null, deep = 0;
  const clr = (A.base * 0.8 + 0.01) * s;
  for (const v of b.aPts) {
    const r = tv().copy(v).multiplyScalar(s).applyQuaternion(_qa);
    const p = tv().copy(occ).add(r);
    const depth = e.terrainH(p.x, p.z) + clr - p.y;
    if (depth <= deep) continue;
    const hor = Math.hypot(r.x, r.z);
    if (hor < 1e-3) continue;
    deep = depth; ax = tv().crossVectors(r, tv(0, 1, 0)).normalize();
    need = Math.asin(clamp(depth / Math.max(hor, depth + 1e-3), 0, 1)) * 1.05;
  }
  // (rises at once when needed, relaxes slowly)
  b.aLift = need > b.aLift ? need : Math.max(need, b.aLift - dt * 1.2);
  if (!ax) { if (b.aLift < 1e-4) return; ax = b.aAx || tv(1, 0, 0); } else { b.aAx = (b.aAx || new THREE.Vector3()).copy(ax); }
  if (b.aLift < 1e-4) return;
  const R = tqa(b.aAx, b.aLift);
  for (const name of ['head', 'jaw', 'earL', 'earR']) {
    const bn = e.bone[name];
    if (!bn) continue;
    const p = tv().setFromMatrixPosition(bn.matrixWorld).sub(occ).applyQuaternion(R).add(occ);
    _q.setFromRotationMatrix(bn.matrixWorld).premultiply(R);
    bn.matrixWorld.compose(p, _q, _s);
  }
  void _m;
}

// ------------------------------------------------------------------------------------------------
// pose: antler ground clearance, ear swivels and the tail flag
function pose(e, dt) {
  const b = B(e), P = e.P, cfg = e.cfg;
  antlerClear(e, b, dt);
  const awake = 1 - P.eyelid;
  // ---- ears
  if (cfg.hasEars && e.lod < 2) {
    const alert = clamp(b.alarm + (P.lookW > 0 && P.look ? 0.3 : 0), 0, 1);
    for (let k = 0; k < 2; k++) {
      const E = b.ear[k], s = k === 0 ? 1 : -1;
      const bone = k === 0 ? e.bone.earL : e.bone.earR;
      if (!bone) continue;
      E.tNext -= dt * (1 + 1.5 * alert);
      if (E.tNext <= 0) {
        E.tNext = 0.6 + e.rand() * 2.4;
        // mostly out to the side and back (sounds behind), sometimes forward; independent per ear
        const r = e.rand();
        E.target = r < 0.25 ? -0.25 * s : r < 0.5 ? 0 : (0.3 + 0.9 * e.rand()) * s;
      }
      const want = E.target * awake * (1 - clamp(P.earFlat, 0, 1));
      const om = 14; // quick, critically damped swivel
      E.v += (om * om * (want - E.sw) - 2 * om * E.v) * dt;
      E.sw += E.v * dt;
      if (Math.abs(E.sw) < 1e-4) continue;
      const base = tv().setFromMatrixPosition(bone.matrixWorld);
      _q.setFromRotationMatrix(bone.matrixWorld);
      const ax = tv(0, 1, 0).applyQuaternion(_q);
      _q.premultiply(tqa(ax, E.sw));
      bone.matrixWorld.compose(base, _q, _s);
    }
  }
  // ---- tail flag: each segment turned toward vertical (a little back at the root, the tip
  // leaning forward over the rump), with a slow side-to-side wave
  const f = b.flag;
  if (f < 1e-3) return;
  const tl = e.tail, n = tl.n, fr = e.fr;
  const up = tv(0, 1, 0).applyQuaternion(fr.qPel), back = tv(0, 0, -1).applyQuaternion(fr.qPel), latP = tv(1, 0, 0).applyQuaternion(fr.qPel);
  // (the bone roll is parallel-transported along the chain exactly as the engine does it, so the
  // flag blends in without a twist)
  const latRef = tv().copy(latP);
  const p = tv().copy(tl.p[0]);
  const wave = e.lod >= 2 ? 0 : Math.sin(e.time * TAU * 1.3) * 0.35;
  for (let i = 0; i < n; i++) {
    const r = i / Math.max(1, n - 1);
    const a = lerp(0.95, 1.75, Math.pow(r, 0.8)); // target angle from "back" toward "up" (rad)
    // the segment swings up through the horizontal behind the rump (an angle blend in the
    // back / up plane: the hanging tail and the flag point in nearly opposite directions)
    const cur = tv().subVectors(tl.p[i + 1], tl.p[i]).normalize();
    const cb = cur.dot(back), cu = cur.dot(up), cl = cur.dot(latP);
    const th0 = Math.atan2(cu, cb), th = th0 + (a - th0) * f;
    const lt = cl * (1 - f) + wave * r * 0.5 * f;
    const h = Math.sqrt(Math.max(0, 1 - lt * lt));
    const d = tv().copy(back).multiplyScalar(Math.cos(th) * h).addScaledVector(up, Math.sin(th) * h).addScaledVector(latP, lt).normalize();
    const q0 = tv().copy(p);
    p.addScaledVector(d, tl.len[i]);
    latRef.addScaledVector(d, -latRef.dot(d)).normalize();
    e.setBoneF(e.tailNames[i], q0, d, latRef);
  }
}

// ------------------------------------------------------------------------------------------------
// update: alarm / flag, walk nod, grazing alert checks, idle variants, escape steering
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg, u = 1 / cfg.unit;
  const vn = e.speed / cfg.sq;
  // ---- alarm: fleeing at a gallop, hit, stomping, jumping, an attack
  let alarmT = smooth(4.2, 6.5, vn) * P.gaitW;
  for (const a of L.oneshots) {
    if (a.stopping && a.w < 0.3) continue;
    if (a.name === 'hit' || a.name === 'flee' || a.name === 'jump') alarmT = 1;
    else if (a.name === 'stomp') alarmT = Math.max(alarmT, smooth(0.6, 1.2, a.t) * 0.9);
    else if (a.name === 'attack') alarmT = Math.max(alarmT, 0.6);
  }
  if (e.air.active) alarmT = 1;
  if (e.input.alarm) alarmT = 1; // (games: motion.input.alarm = true keeps the flag up)
  // the flag stays up for a moment after the danger (the tail comes down while slowing)
  b.alarm = alarmT > b.alarm ? alarmT : Math.max(alarmT, b.alarm - dt * 0.5);
  // lying / dead: tail down
  const down = L.postures.reduce((m, p) => Math.max(m, p.w), 0);
  const flagT = clamp(b.alarm, 0, 1) * (1 - down);
  // critically damped spring (fast up, slower down)
  const om = flagT > b.flag ? 9 : 5;
  b.flagV += (om * om * (flagT - b.flag) - 2 * om * b.flagV) * dt;
  b.flag = clamp(b.flag + b.flagV * dt, 0, 1);
  if (b.flag > 0.3) { mx(P, 'earFlat', 0.25, smooth(5, 9, vn) * b.flag); mx(P, 'tailIdle', 0, b.flag); }

  // ---- walk: the head and neck nod once per forelimb stance
  const g = e.gait;
  const walkW = smooth(0.12, 0.6, vn) * (1 - smooth(1.4, 1.9, vn)) * P.gaitW;
  if (walkW > 0.001) {
    const ph = e.phase - g.off[0];
    const c = 0.5 + 0.5 * Math.cos(4 * Math.PI * (ph - 0.1));
    P.headRaise -= 0.03 * u * walkW * c;
    P.headPitch += 0.05 * walkW * (c - 0.5);
  }

  // ---- grazing: frequent head-up alert checks (chewing, ears pricked, looking round)
  const eat = L.oneshots.find((a) => a.name === 'eat' || a.name === 'drink');
  const gz = b.graze;
  if (eat && !eat.stopping && eat.w > 0.9) {
    if (gz.t < 0) {
      gz.checkIn -= dt;
      if (gz.checkIn <= 0) {
        gz.t = 0; gz.dur = 1.4 + e.rand() * 1.8;
        const a = e.heading + (e.rand() - 0.5) * 2.6, d = 10 * cfg.k;
        gz.look.set(e.pos.x + Math.sin(a) * d, e.pos.y + 0.8 * cfg.s, e.pos.z + Math.cos(a) * d);
      }
    }
  } else if (!eat) { gz.t = -1; gz.checkIn = 1.5 + e.rand() * 2; }
  if (gz.t >= 0) {
    // (a check under way runs to its end, also while the grazing fades out)
    gz.t += dt;
    if (gz.t > gz.dur) { gz.t = -1; gz.checkIn = (eat && eat.name === 'drink' ? 3 : 2.2) + e.rand() * 4; }
  }
  if (gz.t >= 0 && eat) {
    const c = sm(smooth(0, 0.35, gz.t) * (1 - smooth(gz.dur - 0.45, gz.dur, gz.t))) * sm(eat.w);
    mx(P, 'headW', 0, c); mx(P, 'headReach', 0, c); mx(P, 'headPitch', -0.05, c); mx(P, 'headYaw', 0, c);
    mx(P, 'headOmega', 1.4, c);
    mx(P, 'headRaise', 0.02 * u, c);
    P.look = gz.look; mx(P, 'lookW', 1, c);
    mx(P, 'earFlat', -0.12, c); mx(P, 'earTwitch', 0.3, c);
    if (eat.name === 'eat') { mx(P, 'jaw', 0.05 + 0.05 * Math.max(0, Math.sin(gz.t * 7.5)), c); }
    else mx(P, 'jaw', 0.02, c);
  }

  // ---- escape steering (flee): zig-zags at speed
  const f = b.flee;
  if (f) {
    f.t += dt;
    if (f.t >= f.dur) b.flee = null;
    else {
      f.next -= dt;
      if (f.next <= 0) { f.side = -f.side; f.next = 0.9 + e.rand() * 0.7; }
      e.wantSpeed = Math.max(e.wantSpeed, f.speed * cfg.sq * smooth(0, 0.4, f.t));
      e.wantHeading = f.h0 + f.side * f.amp * smooth(0.5, 1.2, f.t);
    }
  }

  // ---- sleep (sternal, curled): the body stays upright, the head is laid back along the flank
  for (const p of L.postures) {
    if (p.name !== 'sleep') continue;
    const c = sm(clamp(p.w, 0, 1)) * smooth(1.0, 3.0, p.t);
    mx(P, 'roll', p.side * 0.1, c); mx(P, 'bend', p.side * 0.45, c);
    mx(P, 'tailCurl', 0, c); mx(P, 'tailSide', p.side * 0.3, c);
    mx(P, 'earFlat', 0.6, c);
  }
  // dying / dead: ears laid back; a buck's head stays upright on its chin, the antlers clear of
  // the ground (a head on its cheek would drive the lower beam into the ground)
  for (const p of L.postures) {
    if (p.name !== 'death') continue;
    const w = sm(clamp(p.w, 0, 1)) * smooth(0.3, 1.0, p.t);
    mx(P, 'earFlat', 1, w); mx(P, 'earTwitch', 0, w);
    if (!e.params.antlers) P.headPos.y += 0.018 * cfg.s * w; // (the broad pinnae lie on the ground, not in it)
    else {
      mx(P, 'headRoll', 0, w); mx(P, 'headPitch', 0.05, w);
      P.headPos.y += 0.09 * cfg.s * w;
    }
  }

  // any other action interrupts grazing / drinking
  if (L.oneshots.some((a) => !a.stopping && a.name !== 'eat' && a.name !== 'drink' && a.name !== 'hit')) for (const a of L.oneshots) if (a.name === 'eat' || a.name === 'drink') a.stopping = true;

  // ---- idle variants (standing still, nothing else running, nobody steering the gaze)
  if (e.idleVariants !== false && L.idle.w > 0.98 && !busy(L) && !e.input.look && !e.input.follow) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 7 + e.rand() * 9;
      const r = e.rand();
      if (r < 0.35) L.play('stomp');
      else if (r < 0.7) L.play('alert');
    }
  } else if (busy(L)) b.idleT = Math.max(b.idleT, 4);
}

// ------------------------------------------------------------------------------------------------
// stomp: suspicious. Head up and ears forward, a head bob (a feint: the head dips as if to feed
// and snaps back up), then 2-3 hard stomps with one forefoot; tail half raised.
const stomp = {
  kind: 'oneshot', fade: 0.25,
  start(inst, L) {
    const e = L.engine;
    inst.leg = inst.opts.leg ?? (e.rand() < 0.5 ? 0 : 1);
    const n = inst.opts.count ?? (e.rand() < 0.5 ? 2 : 3);
    inst.hits = Array.from({ length: n }, (_, i) => 1.15 + i * 0.42);
    inst.done = inst.hits.map(() => false);
    inst.dur = inst.hits[n - 1] + 0.75;
    const a = e.heading + (e.rand() - 0.5) * 1.2, d = 8 * e.cfg.k;
    inst.look = inst.opts.target ? inst.opts.target.clone() : new THREE.Vector3(e.pos.x + Math.sin(a) * d, e.pos.y + 0.6 * e.cfg.s, e.pos.z + Math.cos(a) * d);
  },
  update(inst, dt, L) {
    const e = L.engine;
    inst.hits.forEach((tt, j) => {
      if (!inst.done[j] && inst.t >= tt) {
        inst.done[j] = true;
        const leg = e.legs[inst.leg];
        e.emit('footstep', { foot: leg.def.key, position: leg.plant.clone(), speed: 0, strength: 1, stomp: true });
      }
    });
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, s = e.cfg.s, u = 1 / e.cfg.unit, t = inst.t;
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    P.look = inst.look; mx(P, 'lookW', 1, w);
    mx(P, 'earFlat', -0.15, w); mx(P, 'earTwitch', 0.2, w);
    mx(P, 'headRaise', 0.035 * u, w);
    // head bob: dips toward the ground and snaps back up
    const bob = Math.sin(Math.PI * clamp((t - 0.25) / 0.6, 0, 1));
    mx(P, 'headRaise', -0.22 * u, w * bob * bob); mx(P, 'headPitch', 0.35, w * bob);
    mx(P, 'lookW', 0, w * bob);
    // stomps: the foot is lifted (knee flexed) and slammed down on its own spot
    let lift = 0;
    for (const tt of inst.hits) lift = Math.max(lift, smooth(tt - 0.3, tt - 0.1, t) * (1 - smooth(tt - 0.07, tt, t)));
    const leg = e.legs[inst.leg];
    const k = w * smooth(0.8, 0.95, t) * (1 - smooth(inst.hits[inst.hits.length - 1], inst.hits[inst.hits.length - 1] + 0.3, t));
    const tp = tv().copy(leg.plant);
    tp.y += 0.13 * s * lift;
    tp.addScaledVector(e.forward(e.heading, tv()), 0.02 * s * lift);
    P.legs[inst.leg].target.copy(tp);
    mxLeg(P, inst.leg, 'reach', 1, k);
    // the body leans back a little onto the other legs, the forehand drops at each strike
    mx(P, 'dropF', 0.04 + 0.05 * (1 - lift), k);
  },
};

// alert: stands tall and stares, ears forward, neck stretched up, tail twitching half-raised
const alert = {
  kind: 'oneshot', fade: 0.35,
  start(inst, L) {
    const e = L.engine;
    inst.dur = inst.opts.duration ?? 2.5 + e.rand() * 2;
    const a = e.heading + (e.rand() - 0.5) * 2.0, d = 12 * e.cfg.k;
    inst.look = inst.opts.target ? inst.opts.target.clone() : new THREE.Vector3(e.pos.x + Math.sin(a) * d, e.pos.y + 0.5 * e.cfg.s, e.pos.z + Math.cos(a) * d);
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const u = 1 / L.engine.cfg.unit;
    const k = w * smooth(0, 0.3, inst.t);
    mx(P, 'headRaise', 0.07 * u, k); mx(P, 'neckReach', -0.02 * u, k); mx(P, 'headPitch', -0.12, k);
    P.look = inst.look; mx(P, 'lookW', 1, k);
    mx(P, 'earFlat', -0.2, k); mx(P, 'earTwitch', 0.2, k);
    mx(P, 'tailLift', 0.35, k); mx(P, 'breathRate', 1.4, k);
  },
};

// flee: bounds away with long zig-zags, tail flagged, ears back
const flee = {
  kind: 'oneshot', fade: 0.25,
  start(inst, L) {
    const e = L.engine, b = B(e);
    inst.dur = inst.opts.duration ?? 4;
    let h0 = e.heading;
    if (inst.opts.from) h0 = Math.atan2(e.pos.x - inst.opts.from.x, e.pos.z - inst.opts.from.z);
    if (inst.opts.heading !== undefined) h0 = inst.opts.heading;
    b.flee = { t: 0, dur: inst.dur, h0, side: e.rand() < 0.5 ? -1 : 1, next: 1.0, amp: 0.35, speed: inst.opts.speed ?? (e.cfg.gears.bound || 11 * e.cfg.sq) / e.cfg.sq };
  },
  update(inst, dt, L) { if (inst.t >= inst.dur) { B(L.engine).flee = null; return true; } return false; },
  apply(P, w) { mx(P, 'earFlat', 0.5, w); },
};

// attack: bucks lower the head and thrust the antlers (with a twist); does and fawns rear up on the
// hind legs and flail with the forefeet, striking down alternately, then come down on their own
// hoofprints (running, they butt with the head instead). play('attack', { style: 'strike' |
// 'antler' }) picks one.
const STRIKES = [0.5, 0.66, 0.82, 0.98];
const attack = {
  ...ONESHOTS.attack,
  kind: 'oneshot', needsStand: true,
  start(inst, L) {
    const e = L.engine;
    const run = smooth(1.5, 4, e.speed / e.cfg.sk);
    const want = inst.opts.style || (e.params.antlers ? 'antler' : 'strike');
    inst.strikeMode = want !== 'antler' && run < 0.3;
    if (inst.strikeMode) {
      inst.style = 'strike'; inst.dur = 1.72; inst.run = run; inst.hits = STRIKES.map(() => false);
      inst.target = inst.opts.target ? inst.opts.target.clone() : null;
      return;
    }
    inst.tune = { ...inst.tune, style: 'headbutt' };
    ONESHOTS.attack.start.call(this, inst, L);
  },
  update(inst, dt, L) {
    if (!inst.strikeMode) return ONESHOTS.attack.update.call(this, inst, dt, L);
    const e = L.engine;
    STRIKES.forEach((t0, j) => {
      if (!inst.hits[j] && inst.t >= t0 + 0.08) {
        inst.hits[j] = true;
        const leg = e.legs[j & 1];
        const p = new THREE.Vector3().setFromMatrixPosition(e.bone['fhoof' + leg.def.S].matrixWorld);
        const dir = inst.target ? inst.target.clone().sub(e.pos).setY(0).normalize() : e.forward(e.heading, new THREE.Vector3());
        e.emit('attackHit', { position: p, direction: dir, style: 'strike' });
      }
    });
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const t = inst.t;
    if (!inst.strikeMode) {
      ONESHOTS.attack.apply.call(this, P, w, inst, L);
      // antler thrust: the head goes low, antlers forward; a twisting shove at contact
      const low = smooth(0, 0.35, t) * (1 - smooth(0.75, 1.1, t));
      const thrust = smooth(0.35, 0.55, t) * (1 - smooth(0.65, 1.0, t));
      mx(P, 'headPitch', 0.95, low * w);
      mx(P, 'headRoll', 0.2 * Math.sin((t - 0.4) * 8), thrust * w);
      mx(P, 'earFlat', 1, w);
      // (a shorter lunge than the engine's charge: the planted hooves stay within reach)
      P.fwd *= 1 - 0.65 * w;
      return;
    }
    const e = L.engine, cfg = e.cfg;
    if (inst.target) { P.look = inst.target; mx(P, 'lookW', 1, w); }
    mx(P, 'earFlat', 1, w * smooth(0, 0.15, t)); mx(P, 'earTwitch', 0, w);
    // up on the hind legs, forehand raised; the gait is held until the forefeet are down again
    const up = smooth(0.05, 0.42, t) * (1 - smooth(1.05, 1.42, t));
    const hold = Math.min(1, smooth(0.0, 0.2, t) * (1 - smooth(1.5, 1.7, t)));
    mx(P, 'gaitW', 0, hold * w); mx(P, 'legGait', 0, hold * w);
    mx(P, 'dropF', -1.0, up * w); mx(P, 'dropH', 0.22, up * w); mx(P, 'headRaise', 0.03 / cfg.unit, up * w);
    const fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
    for (let i = 0; i < 2; i++) {
      const leg = e.legs[i], Ld = leg.def;
      // between strikes the forelegs are folded; each strike reaches forward and down
      let k = 0;
      for (let j = i; j < STRIKES.length; j += 2) k = Math.max(k, Math.pow(Math.sin(Math.PI * clamp((t - STRIKES[j] + 0.06) / 0.22, 0, 1)), 2));
      mxLeg(P, i, 'tuck', 1, up * (1 - k) * w); P.legs[i].extend = 0.2;
      const tp = tv().copy(e.fr.shC).addScaledVector(fwd, 0.42 * Ld.len).addScaledVector(lat, Ld.s * Ld.cx);
      tp.y -= 0.55 * Ld.len;
      const ks = k * up * w;
      // coming down: each forefoot is set back on the hoofprint it rose from
      const down = (1 - up) * hold * w;
      P.legs[i].target.copy(leg.plant).lerp(tp, ks / Math.max(1e-3, ks + down));
      mxLeg(P, i, 'reach', 1, Math.max(ks, down));
    }
  },
};

// jump: the engine's leap (the species' everyday obstacle jump; play('jump', { height, distance })
// picks another one: { height: 2 } is the record escape leap). The legs fold up a little more slowly
// after take-off (the long slender forelegs tucked in 0.12 s snapped at the elbow), and the forelegs
// unfold and reach for the ground over the last part of the flight (they were still folded under the
// chest at touchdown)
const jump = {
  ...ONESHOTS.jump, kind: 'oneshot', airborne: true,
  start(inst, L) {
    const o = inst.opts, t = inst.tune || {};
    if (o.height || o.distance) {
      const h = o.height ?? t.height, k = t.height ? h / t.height : 1;
      inst.tune = { ...t, height: h, distance: o.distance ?? (t.distance ?? 3.8) * Math.sqrt(k) * (k > 1 ? 1.3 : 1) };
    }
    ONESHOTS.jump.start.call(this, inst, L);
  },
  apply(P, w, inst, L) {
    ONESHOTS.jump.apply.call(this, P, w, inst, L);
    if (inst.phase === 'air') {
      const k = smooth(0, 0.26, inst.t - inst.tAir);
      const T = (2 * inst.vy) / 9.81, x = clamp((inst.t - inst.tAir) / T, 0, 1);
      const reach = smooth(0.62, 0.92, x);
      P.legs.forEach((l, i) => { l.tuck = Math.min(l.tuck, k) * (1 - (i < 2 ? 0.75 : 0.35) * reach); });
    }
  },
};

// hit: the engine's stagger, the tail flags
const hit = { ...ONESHOTS.hit, kind: 'oneshot' };

// lie / sleep: the engine's kneeling sequence (down forelegs first, up hind end first). Getting up,
// the sequence runs on a weight that reaches zero a little before the posture ends, so the springs
// that stagger the two ends have settled when the posture is removed (no snap of the forelegs).
function staged(def) {
  return {
    ...def, kind: 'posture',
    apply(P, w, inst, L) {
      const dt = clamp(inst.t - (inst.ts ?? inst.t), 0, 0.1);
      inst.ts = inst.t;
      inst.shift = inst.target > 0 ? 0 : Math.min(0.3, (inst.shift || 0) + dt * 0.8);
      const we = clamp((w - inst.shift) / (1 - inst.shift), 0, 1);
      def.apply(P, we, inst, L);
    },
  };
}

// death: the engine's collapse, at its own pace. The legs buckle under the load: the hooves stay
// planted while the carpi and hocks give and the body sinks, and fold up only as the body goes over
// onto its side (the engine folds them from the start: on the deer's long legs all four hooves hung
// 6-8 cm in the air while the body was still near standing height, as if it floated)
const death = {
  ...POSTURES.death, kind: 'posture',
  apply(P, w, inst, L) {
    POSTURES.death.apply(P, w, inst, L);
    // (the legs swing out to the side only once the body is well down: moving the feet to the side
    // pose lifts them in a small step)
    const t = inst.t, fall = clamp((t - 0.3) / 0.55, 0, 1), fallE = fall * fall;
    for (let i = 0; i < 4; i++) { mxLeg(P, i, 'fold', 0, w * (1 - fallE)); P.legs[i].side *= smooth(0.6, 1.15, t); }
  },
};

// sit: a deer beds down sternally with the head up, ears forward and alert (a dog-like sit reads as
// an injured deer); lie is the same bed, relaxed, the head lower
function alertBed(def) {
  const base = staged(def);
  return {
    ...base,
    apply(P, w, inst, L) {
      base.apply(P, w, inst, L);
      const u = 1 / L.engine.cfg.unit;
      const k = sm(clamp(w, 0, 1)) * smooth(0.6, 1.6, inst.t);
      mx(P, 'headRaise', 0.06 * u, k); mx(P, 'headPitch', -0.1, k);
      mx(P, 'earFlat', -0.15, k); mx(P, 'earTwitch', 0.6, k); mx(P, 'tailIdle', 0.4, k);
    },
  };
}

export const hooks = {
  pose,
  update,
  actions: { stomp, alert, flee, attack, hit, jump, death, lie: staged(POSTURES.lie), sit: alertBed(POSTURES.lie), sleep: staged(POSTURES.sleep) },
};
