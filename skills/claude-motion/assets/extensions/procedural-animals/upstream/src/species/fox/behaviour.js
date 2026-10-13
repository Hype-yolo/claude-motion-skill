// Red fox behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js).
//
//   update(P, dt, layer)  every frame over the action layer: the listening pose (freeze, head cocked
//                         from side to side, ears forward and turning), the brush as a counterweight
//                         (raised against a nose-down dive, level / low when trotting: the carriage
//                         table), sitting upright with the brush wrapped round the forefeet, the curled
//                         sleep with the brush drawn over the nose, the tail tucked when hit, ears
//                         laid back when dying; idle variants (listen, listen with a forepaw raised)
//   pose(engine, dt)      after the engine's solve: the ears swivel independently toward "sounds"
//                         (each on its own, fast), locked forward on the prey while listening
//   actions               attack / pounce: the mousing pounce (listen with the head cocked, crouch,
//                         a high arcing leap, the body turning nose-down in the air, forelegs
//                         together, brush up as a counterweight, landing forepaws first to pin the
//                         prey with the muzzle plunged into the ground); running: the built-in
//                         bite-lunge. listen: freeze and listen (head tilts, ear swivels, sometimes a
//                         forepaw raised). hit: the built-in flinch, tail clamped low.
//
// Distances are fox metres at the reference size x cfg.s; posture offsets that the engine multiplies
// by cfg.k (fwd, side, headRaise, neckReach) are divided by cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tqa } from '../../core/motion/common.js';
import { mx, mxLeg, ONESHOTS, POSTURES, mouthGroundTarget } from '../../core/motion/actions.js';

const _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3(), _a = new THREE.Vector3();
const sm = (w) => w * w * (3 - 2 * w);
const U = (e) => e.cfg.unit; // engine units -> fox metres
const busy = (L) => L.postures.some((p) => p.target > 0) || L.oneshots.some((a) => !a.stopping);
const posture = (L, name) => L.postures.find((p) => p.name === name && p.w > 0);

function B(e) {
  if (!e._fox) {
    e._fox = {
      ear: [{ sw: 0, v: 0, target: 0, tNext: 0.5 }, { sw: 0, v: 0, target: 0, tNext: 1.3 }],
      listen: 0, tiltPh: e.rand() * TAU, idleT: 6 + e.rand() * 6,
    };
  }
  return e._fox;
}

// head cocked from side to side while listening (~0.8 s per side, held, then swung over)
function tiltOf(t, ph) {
  const x = (t * 0.55 + ph) % 2;
  const side = x < 1 ? 1 : -1;
  const u = x % 1;
  // swing over in the first 30 % of each half cycle, then hold
  const k = smooth(0, 0.3, u);
  return lerp(-side, side, k);
}

// the listening pose (shared by the idle 'listen' action and the pounce's lead-in): head low and
// forward over the ground ahead, cocked to one side then the other, ears pricked forward
function applyListen(P, w, t, e, b, ph) {
  if (w <= 0) return;
  const tilt = tiltOf(t, ph);
  mx(P, 'lookW', 0, w);
  mx(P, 'headPitch', 0.4, w);
  mx(P, 'headRaise', -0.008 / U(e), w); mx(P, 'neckReach', 0.014 / U(e), w);
  P.headRoll += 0.42 * tilt * w;
  P.headYaw += 0.1 * tilt * w;
  mx(P, 'earFlat', -0.25, w); mx(P, 'earTwitch', 0, w);
  mx(P, 'tailIdle', 0.2, w);
  b.listen = Math.max(b.listen, w);
}

// ------------------------------------------------------------------------------------------------
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg;
  b.listen = 0;
  for (const a of L.oneshots) {
    const w = sm(a.w);
    if (w <= 0) continue;
    if (a.name === 'hit') {
      // flinch: the brush clamped low, ears flat (core), body drops (core)
      const k = w * (1 - smooth(0.45, 0.75, a.t) * 0.6);
      mx(P, 'tailLift', -0.7, k); mx(P, 'tailStiff', 1.5, k); mx(P, 'tailIdle', 0, k);
    }
  }
  // dying / dead: ears folded back, head rolled onto its cheek
  for (const p of L.postures) {
    if (p.name === 'death') { const w = sm(clamp(p.w, 0, 1)) * smooth(0.3, 1.0, p.t); mx(P, 'earFlat', 1.1, w); mx(P, 'earTwitch', 0, w); mx(P, 'headRoll', p.side * 0.8, w); P.headPos.y += 0.035 * cfg.s * w; }
  }
  // sitting upright on the haunches: the brush wrapped round the forefeet, head up
  const sit = posture(L, 'sit');
  if (sit) {
    const w = sm(clamp(sit.w, 0, 1)) * smooth(0.4, 1.4, sit.t);
    mx(P, 'tailSide', sit.side * 1.5, w); mx(P, 'tailCurl', sit.side * 2.2, w); mx(P, 'tailStiff', 0.8, w);
    mx(P, 'headRaise', 0.012 / U(e), w);
  }
  // curled asleep: a tight ring, the brush drawn round over the nose and forepaws
  const sleep = posture(L, 'sleep');
  if (sleep && sleep.tune.style !== 'lateral') {
    const c = sm(clamp(sleep.w, 0, 1)) * smooth(1.2, 3.2, sleep.t);
    mx(P, 'bend', sleep.side * 1.8, c); mx(P, 'tailSide', sleep.side * 3.6, c); mx(P, 'tailCurl', 0, c); mx(P, 'tailStiff', 0.6, c);
    mx(P, 'headYaw', sleep.side * 1.5, c); mx(P, 'flex', 0.25, c);
    P.headPos.y += 0.032 * cfg.s * c;
    // the head tucked back along the flank toward the hind feet, nose into the brush
    P.headPos.addScaledVector(e.fr.F, -0.1 * cfg.s * c).addScaledVector(e.fr.Lf, sleep.side * 0.05 * cfg.s * c);
  }

  // idle variants: stop and listen (sometimes with a forepaw raised)
  if (e.idleVariants !== false && L.idle.w > 0.98 && !busy(L) && !e.input.look && !e.input.follow) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 8 + e.rand() * 10;
      L.play('listen', { paw: e.rand() < 0.45 });
    }
  } else if (busy(L)) b.idleT = Math.max(b.idleT, 4);
}

// ------------------------------------------------------------------------------------------------
// pose: independent ear swivels ("radar" ears), both locked forward while listening
function pose(e, dt) {
  const b = B(e), P = e.P, cfg = e.cfg;
  if (e.lod >= 2 || !cfg.hasEars) return;
  const awake = 1 - P.eyelid * 0.8;
  const still = 1 - smooth(0.5, 3, e.speed / cfg.sq);
  const lis = b.listen;
  for (let k = 0; k < 2; k++) {
    const E = b.ear[k], s = k === 0 ? 1 : -1;
    const bone = k === 0 ? e.bone.earL : e.bone.earR;
    if (!bone) continue;
    E.tNext -= dt * (1 + 1.5 * lis);
    if (E.tNext <= 0) {
      E.tNext = 0.8 + e.rand() * 3;
      // a new "sound": often sideways or back, sometimes straight ahead; listening: small scans
      // around straight ahead (the ears pinpoint the prey)
      E.target = lis > 0.3 ? (e.rand() - 0.5) * 0.5 : e.rand() < 0.35 ? 0 : (e.rand() - 0.2) * 1.4 * s;
    }
    const want = E.target * still * awake * (1 - Math.max(0, P.earFlat) * (1 - lis)) * (1 - smooth(0.25, 0.7, Math.abs(P.roll))) * (1 - clamp(P.headW, 0, 1));
    const om = 17; // fast, critically damped swivel
    E.v += (om * om * (want - E.sw) - 2 * om * E.v) * dt;
    E.sw += E.v * dt;
    if (Math.abs(E.sw) < 1e-4) continue;
    const base = _p.setFromMatrixPosition(bone.matrixWorld);
    _q.setFromRotationMatrix(bone.matrixWorld);
    _a.set(0, 1, 0).applyQuaternion(_q);
    _q.premultiply(tqa(_a, E.sw));
    bone.matrixWorld.compose(base, _q, _s);
  }
}

// ------------------------------------------------------------------------------------------------
// listen: freeze, head low and cocked from side to side, ears pricked; optionally a forepaw raised
const listen = {
  kind: 'oneshot', fade: 0.35,
  start(inst, L) {
    inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 3.2 + L.engine.rand() * 1.6);
    inst.ph = L.engine.rand() * 2;
    inst.paw = inst.opts.paw ? (L.engine.rand() < 0.5 ? 0 : 1) : -1;
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, b = B(e), s = e.cfg.s;
    applyListen(P, w, inst.t, e, b, inst.ph);
    mx(P, 'speedScale', 0.3, w);
    if (inst.paw >= 0) {
      // one forepaw held up, the carpus folded (alert)
      const k = w * smooth(0.3, 0.8, inst.t) * (1 - smooth(inst.dur - 0.7, inst.dur - 0.2, inst.t));
      const i = inst.paw, leg = e.legs[i];
      const tp = tv().copy(leg.plant).addScaledVector(e.forward(e.heading, tv()), -0.012 * s);
      tp.y += 0.07 * s;
      P.legs[i].target.lerp(tp, k / Math.max(1e-3, P.legs[i].reach + k));
      mxLeg(P, i, 'reach', 1, k);
      mx(P, 'side', -(i === 0 ? 1 : -1) * 0.004 / U(e), k);
    }
  },
};

// ------------------------------------------------------------------------------------------------
// attack: the mousing pounce. Stands and listens with the head cocked (~1.4 s), crouches, launches a
// high arcing leap (the engine's jump mechanics with its push-off; ~0.55 m high, ~1.2 m long at the
// reference size, or to opts.target), the body turning nose-down on the way up and diving steeply,
// forelegs held together and pointing down at the prey, the brush raised behind as a counterweight;
// lands forepaws first together to pin the prey, the muzzle plunging into the ground. Running: the
// built-in bite-lunge.
const LISTEN = 1.4; // s of listening before the leap
const POUNCE = { height: 0.55, distance: 1.2, land: [0.55, 0.3] };
function makePounce(forcePounce) {
  return {
    kind: 'oneshot', fade: 0.15, needsStand: true, airborne: true,
    start(inst, L) {
      const e = L.engine;
      inst.run = forcePounce ? 0 : smooth(1.2, 3, e.speed / e.cfg.sq);
      inst.delay = inst.run > 0.5 ? 0 : (inst.opts.listen ?? LISTEN) * e.cfg.sq;
      inst.ph = e.rand() * 2;
      inst.dur = Infinity;
      if (inst.run > 0.5) {
        inst.lunge = { ...inst, tune: { style: 'bite-lunge' } };
        ONESHOTS.attack.start(inst.lunge, L);
      }
    },
    update(inst, dt, L) {
      if (inst.lunge) { inst.lunge.t = inst.t; return ONESHOTS.attack.update.call(ONESHOTS.attack, inst.lunge, dt, L); }
      if (inst.t < inst.delay) return false;
      if (!inst.leap) {
        inst.leap = { ...inst, t: 0, tune: POUNCE, opts: { target: inst.opts.target } };
        ONESHOTS.jump.start(inst.leap, L);
      }
      const J = inst.leap;
      J.t = inst.t - inst.delay;
      ONESHOTS.jump.update(J, dt, L);
      inst.phase = J.phase;
      if (inst.landT !== undefined && inst.t - inst.landT > 1.25) return true;
      return false;
    },
    onLand(inst, L) {
      if (inst.lunge) return ONESHOTS.attack.onLand.call(ONESHOTS.attack, inst.lunge, L);
      if (!inst.leap) return;
      ONESHOTS.jump.onLand(inst.leap, L);
      inst.landT = inst.t;
      const e = L.engine;
      // (no speed cut here: a sudden drop of the speed jumps the head carriage; the engine decelerates)
      const p = e.legs[0].contact.clone().lerp(e.legs[1].contact, 0.5);
      const dir = inst.opts.target ? inst.opts.target.clone().sub(e.pos).setY(0).normalize() : e.forward(e.heading, new THREE.Vector3());
      e.emit('attackHit', { position: p, direction: dir, style: 'pounce' });
    },
    apply(P, w, inst, L) {
      const e = L.engine, t = inst.t, cfg = e.cfg, s = cfg.s;
      if (inst.lunge) return ONESHOTS.attack.apply(P, w, inst.lunge, L);
      const b = B(e);
      // listening: frozen, head cocked, ears pricked on the prey
      const lw = w * (1 - smooth(inst.delay - 0.35, inst.delay - 0.05, t));
      applyListen(P, lw, t, e, b, inst.ph);
      if (inst.opts.target) { P.look = inst.opts.target; mx(P, 'lookW', 0.5, w * (1 - lw)); }
      // the gathering crouch on the hind legs just before the leap
      const c = smooth(inst.delay - 0.45, inst.delay - 0.1, t) * (inst.leap && inst.leap.phase !== 'crouch' ? 0 : 1) * w;
      mx(P, 'dropH', 0.3, c); mx(P, 'dropF', 0.12, c); mx(P, 'headPitch', 0.35, c);
      mx(P, 'earFlat', -0.2, w * (inst.landT === undefined ? 1 : 1 - smooth(0.4, 0.9, t - inst.landT)));
      const J = inst.leap;
      if (!J) return;
      ONESHOTS.jump.apply(P, w, J, L);
      if (J.phase === 'air') {
        const T = (2 * J.vy) / 9.81, x = clamp((J.t - J.tAir) / T, 0, 1);
        // body: nose up leaving the ground, turning over to a steep nose-down dive
        const k0 = smooth(0, 0.1, J.t - J.tAir) * w;
        // (kept for the landing, which fades them out: the touchdown comes whenever the forepaws
        // meet the ground, not at a fixed point of the flight)
        const A = inst.air || (inst.air = {});
        A.pitch = lerp(0.35, -0.8, smooth(0.1, 0.7, x)); A.flex = lerp(-0.15, 0.25, smooth(0.2, 0.8, x));
        A.tail = lerp(0.2, 1.1, smooth(0.2, 0.85, x)); A.head = lerp(-0.1, 0.35, smooth(0.2, 0.75, x)) - 0.9 * A.pitch; // (the head is levelled in space: follow the body into the dive)
        A.ext = smooth(0.1, 0.5, x) * (1 - smooth(0.8, 1, x)); A.jaw = 0.3 * smooth(0.6, 0.95, x); A.x = x;
        airPose(P, A, k0);
        mx(P, 'jawOmega', 25, w);
        // forelegs: reach forward together, then down at the prey
        foreReach(P, e, smooth(0.05, 0.4, x) * k0, x);
      } else if (J.phase === 'land') {
        // forepaws pin together; the muzzle plunges into the ground between them, then comes up
        const x = J.t - J.tLand;
        if (inst.air) airPose(P, inst.air, w * (1 - smooth(0, 0.3, x)));
        const pin = (1 - smooth(0.45, 0.8, x)) * w;
        foreReach(P, e, pin, 1);
        const plunge = smooth(0.03, 0.42, x) * (1 - smooth(0.7, 1.15, x)) * w;
        // (the spot is fixed at the landing: the forepaws may still settle)
        // (from the shoulders, not the leg plants: a paw still finishing its swing keeps the take-off spot)
        if (!inst.plungeAt) {
          const g = new THREE.Vector3().copy(e.fr.shC).addScaledVector(e.forward(e.heading, tv()), 0.1 * s);
          const pseudo = { cfg, fr: e.fr, heading: e.heading, legs: [{ plant: g }, { plant: g }] };
          inst.plungeAt = mouthGroundTarget(pseudo, new THREE.Vector3(), 1.1, (px, pz) => e.terrainH(px, pz), 0.55);
          inst.plungeAt.y += 0.012 * s; // (the open lower jaw clears the ground)
        }
        if (plunge > 0) {
          const hp = inst.plungeAt;
          P.headPos.lerp(hp, plunge / Math.max(1e-3, P.headW + plunge));
          mx(P, 'headW', 1, plunge); mx(P, 'headReach', 1, plunge); mx(P, 'headPitch', 1.1, plunge);
          mx(P, 'headOmega', 2.2, plunge);
        }
        mx(P, 'jaw', 0.3 * (1 - smooth(0.1, 0.3, x)) + 0.05 * smooth(0.35, 0.6, x) * (1 - smooth(0.9, 1.1, x)), w); mx(P, 'jawOmega', 30, w);
        mx(P, 'dropF', 0.45, pin); mx(P, 'dropH', 0.15, pin);
        mx(P, 'tailLift', 0.5, (1 - smooth(0.2, 0.8, x)) * w);
      }
    },
  };
}
const attack = makePounce(false);
const pounce = makePounce(true);

// forelegs held together: reaching ahead of the shoulders, pointing down at the prey through the
// dive (x: 0..1 of the flight; 1 = on the ground, the same target the landing pins)
function foreReach(P, e, k, x) {
  if (k <= 0) return;
  const s = e.cfg.s, fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
  for (let i = 0; i < 2; i++) {
    const Ld = e.legs[i].def;
    const tp = tv().copy(e.fr.shC).addScaledVector(fwd, lerp(0.14, 0.1, x) * s).addScaledVector(lat, Ld.s * Ld.cx * 0.5);
    const g = e.terrainH(tp.x, tp.z);
    tp.y = Math.max(g + 0.004 * s, lerp(e.fr.shC.y - 0.12 * s, g + 0.004 * s, smooth(0.45, 1, x)));
    P.legs[i].target.lerp(tp, k / Math.max(1e-3, P.legs[i].reach + k));
    mxLeg(P, i, 'reach', 1, k);
  }
}

// the flight pose: body nose up leaving the ground turning over into a steep nose-down dive, arched
// over the top; the brush raised behind as a counterweight; head in line with the dive, mouth opening;
// hind legs trailing, stretched out behind
function airPose(P, A, k) {
  if (k <= 0) return;
  mx(P, 'pitch', A.pitch, k); mx(P, 'flex', A.flex, k);
  mx(P, 'tailLift', A.tail, k); mx(P, 'tailStiff', 1.4, k); mx(P, 'tailIdle', 0, k);
  mx(P, 'headPitch', A.head, k); mx(P, 'jaw', A.jaw, k);
  for (let i = 2; i < 4; i++) P.legs[i].extend = lerp(P.legs[i].extend, 1, A.ext * k);
}

// hit: the built-in flinch; the brush is clamped low in update()
const hit = { ...ONESHOTS.hit, kind: 'oneshot', fade: 0.12 };

export const foxHooks = {
  update, pose,
  actions: {
    attack, pounce, listen, hit,
    // (a light animal gets up from its side quickly)
    death: { ...POSTURES.death, kind: 'posture', fadeOut: 1.2 },
  },
};
