// Rabbit behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js):
//
//   pose(engine, dt)        after the engine's solve: nose twitch (the snout bone: nose leather and
//                           split upper lip), independent ear swivels (each pinna turns on its own
//                           toward "sounds"), ears kept out of the ground (lying, dead)
//   update(P, dt, layer)    every frame over the action layer: the hopping style (the crouched rest
//                           stance opens up: hips rise, heels lift, head reaches forward), nose
//                           twitch rate, the zig-zag escape steering, automatic idle variants
//                           (grooming, periscope, thumping, ear scans)
//   actions                 hop (single hop), jump, binky, groom, periscope, thump, flee (zig-zag
//                           escape), attack (boxing: rears up, forepaw strikes, lunge-bite), hit
//                           (startle, then often an alarm thump)
//
// All distances are rabbit metres at the reference size, multiplied by cfg.s; posture offsets that
// the engine multiplies by cfg.k (fwd, side, headRaise, neckReach) are divided by cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, smin, TAU, tv, tqa, angDiff } from '../../core/motion/common.js';
import { mx, mxLeg, ONESHOTS, POSTURES } from '../../core/motion/actions.js';

// The loaf, made from the half-extended bind pose (rig.js):
//  LOAF_DROP  hip drop below the bind (m at size 1; a little less than the sculpt's rear lift: the rump
//             rounds under, LOAF_FLEX, and rests just clear of the ground)
//  LOAF_FWD   forward shift of the body (m at size 1), cancelling the pitch-back of the girdles
//  LOAF_FLEX  spine flexion: the back rounded over the loins
const LOAF_DROP = 0.031;
const LOAF_FWD = 0.034;
const LOAF_FLEX = 0.15;

const _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const PI = Math.PI;

// per-engine behaviour state
function B(e) {
  if (!e._rb) {
    e._rb = {
      twitchPh: 0, twitchRate: 2.2, twitchAmp: 1, twitchT: 0,
      ear: [{ sw: 0, target: 0, tNext: 0.5, v: 0 }, { sw: 0, target: 0, tNext: 1.3, v: 0 }],
      earLift: [0, 0], earLen: [undefined, undefined], earNear: [true, true],
      idleT: 7 + e.rand() * 6, thumpAfter: 0, flee: null, scan: 1,
    };
  }
  return e._rb;
}
const busy = (L) => L.postures.length > 0 || L.oneshots.some((a) => !a.stopping);

// ------------------------------------------------------------------------------------------------
// pose: snout twitch and ear swivels (runs after the engine wrote the head, ears and extra bones)
function pose(e, dt) {
  const b = B(e), P = e.P, cfg = e.cfg;
  const sn = e.bone.snout;
  const awake = 1 - P.eyelid;
  // nose twitch: small fast up-down wiggles in bursts; faster when moving / alert, none asleep
  b.twitchPh += dt * TAU * b.twitchRate;
  const tw = Math.pow(Math.max(0, Math.sin(b.twitchPh)), 2) * b.twitchAmp * awake * (e.lod >= 2 ? 0 : 1);
  if (sn && tw > 1e-4) {
    const base = tv().setFromMatrixPosition(sn.matrixWorld);
    _q.setFromRotationMatrix(sn.matrixWorld);
    const lat = tv(1, 0, 0).applyQuaternion(_q);
    const back = tv(0, 1, 0).applyQuaternion(_q).multiplyScalar(-0.0012 * tw * cfg.s);
    sn.matrixWorld.compose(base.add(back), tqa(lat, -0.2 * tw).multiply(_q), _s);
  }
  if (!cfg.hasEars) return;
  const lop = !!e.params.lop;
  const still = 1 - smooth(0.5, 3, e.speed / cfg.sq);
  for (let k = 0; k < 2; k++) {
    const E = b.ear[k], S = k === 0 ? 'L' : 'R', s = k === 0 ? 1 : -1;
    const bone = k === 0 ? e.bone.earL : e.bone.earR;
    if (!bone) continue;
    // a new "sound" every 1-4 s: mostly outward / backward, sometimes straight ahead
    E.tNext -= dt;
    if (E.tNext <= 0) {
      E.tNext = (1 + e.rand() * 3) / (0.6 + 0.4 * b.scan);
      E.target = e.rand() < 0.3 ? 0 : (e.rand() - 0.3) * 1.0 * s;
    }
    const want = E.target * still * (1 - P.earFlat) * awake * (lop ? 0.12 : 1) * b.scan;
    const om = 13; // critically damped swivel
    E.v += (om * om * (want - E.sw) - 2 * om * E.v) * dt;
    E.sw += E.v * dt;
    // (cheap exit: nothing to add to the engine's ear this frame)
    if (Math.abs(E.sw) < 1e-4 && b.earLift[k] < 1e-4 && !b.earNear[k]) continue;
    const base = tv().setFromMatrixPosition(bone.matrixWorld);
    _q.setFromRotationMatrix(bone.matrixWorld);
    const ax = tv(0, 1, 0).applyQuaternion(_q);
    _q.premultiply(tqa(ax, E.sw));
    // keep the long pinna out of the ground (lying on the side, dead, grazing): swing it up about
    // its base just enough, smoothly (a spring on the correction angle)
    const len = b.earLen[k] ?? (b.earLen[k] = e.J['earBase' + S].distanceTo(e.J['earTip' + S]));
    const dir = tv(0, 1, 0).applyQuaternion(_q);
    // sample the pinna at its tip and at both edges of its broad middle (it lies flat when the head
    // rests on its side); only when the ear base is within reach of the ground
    const latE = tv(1, 0, 0).applyQuaternion(_q);
    let need = 0;
    b.earNear[k] = base.y - e.terrainH(base.x, base.z) < len + 0.03 * cfg.s;
    for (let j = 0; j < 3 && b.earNear[k]; j++) {
      const pt = tv().copy(base).addScaledVector(dir, len * (j === 0 ? 1 : 0.6));
      if (j) pt.addScaledVector(latE, (j === 1 ? 1 : -1) * 0.02 * cfg.s);
      const floor = e.terrainH(pt.x, pt.z) + 0.014 * cfg.s;
      if (pt.y < floor) need = Math.max(need, Math.asin(clamp((floor - pt.y) / pt.distanceTo(base), 0, 1)) * 1.15);
    }
    b.earLift[k] += (need - b.earLift[k]) * (1 - Math.exp(-dt * 25));
    if (b.earLift[k] > 1e-4) {
      const axis = tv().crossVectors(dir, tv(0, 1, 0));
      if (axis.lengthSq() > 1e-8) _q.premultiply(tqa(axis.normalize(), b.earLift[k]));
    }
    bone.matrixWorld.compose(base, _q, _s);
  }
}

// ------------------------------------------------------------------------------------------------
// update: locomotion style and idle life, over the action layer's parameters
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg;
  const vn = e.speed / cfg.sq;
  // the scut stays pressed to the rump in every posture (never laid on the ground like a long tail)
  P.tailGround = 0; P.tailSide = 0;
  // the loaf: at rest the hips sit down onto the folded hind legs (the bind pose stands with them
  // half extended). Offsets the actions add are relative to the loaf; postures that rest the body on
  // the ground (lie, sleep, death: groundW) place it themselves.
  const hipRest = cfg.pelvis.hh - (cfg.pelvis.y - cfg.yH);
  // (an action that lowers the hips itself, dropH 0..1 toward the resting height, takes the loaf's share
  // with it: dropH 1 is the rump on the ground either way. The rabbit's own actions are tuned relative
  // to the loaf: 0.1 of dropH ~ 6 mm)
  const loaf = (1 - clamp(P.dropH, 0, 1)) * (1 - P.groundW);
  P.dropH += (LOAF_DROP * cfg.s) / Math.max(1e-4, cfg.yH - hipRest) * loaf;
  // ... the body pitches back about its ground-level origin as the rump sits down, which carried the
  // shoulders ~35 mm back over the planted forefeet (forelegs slanting forward): shift it forward again
  // (only standing still: in motion the gait places the feet under the girdles itself; eased in and
  // out so starting and stopping do not jerk the body over its feet)
  b.sitting = (b.sitting ?? 1) + (loaf * (1 - smooth(0.0, 0.08, vn) * P.gaitW) - (b.sitting ?? 1)) * (1 - Math.exp(-dt * 4));
  const sitting = b.sitting;
  P.fwd += (LOAF_FWD / cfg.unit) * sitting;
  // ... and the back rounds over the loins, the rump tucked under (the egg-shaped loaf)
  P.flex += LOAF_FLEX * Math.min(sitting, loaf);
  if (!b.seated) {
    // a new rabbit starts in its loaf (the engine's girdle springs start at the bind heights)
    b.seated = true;
    const dy = LOAF_DROP * cfg.s;
    e.hipY.reset(e.hipY.x - dy);
    e.height.reset(e.height.x - dy * cfg.zS / (cfg.zS - cfg.zH));
    e.pitch.reset(e.pitch.x + Math.atan2(dy, cfg.zS - cfg.zH));
  }
  // lying on the side (dead, a flop): the long ears fold back along the neck
  const lying = smooth(0.3, 1.1, Math.abs(P.roll));
  P.earFlat = Math.max(P.earFlat, lying);
  // (the short neck hardly twists: the head rolls over with the body as it goes down, carried by the
  // chest rather than held level, and rests on its side; the skull turning on the atlas stretched
  // the skin of the short neck)
  const dying = L.postures.reduce((m, p) => (p.name === 'death' ? Math.max(m, p.w) : m), 0);
  const tip = Math.max(smooth(0.4, 1.0, Math.abs(P.roll)), dying);
  P.headLimp = lerp(P.headLimp, 1, tip);
  P.headRoll *= 1 - tip;
  P.headYaw *= 1 - 0.7 * tip;
  // ... and the head rests on the lower ear's root, a little higher than a short-eared head would
  if (P.headW > 0) P.headPos.y += 0.014 * cfg.s * lying;
  P.headW *= 1 - 0.5 * tip;
  // hopping: the crouched rest stance opens up. The hips rise (the hind limb unfolds, the heels leave
  // the ground: plantigrade at rest, on the toes in motion), the back lengthens and the head reaches
  // forward and down; at escape speed the ears go back along the neck (ears table).
  const run = smooth(0.08, 1.6, vn) * P.gaitW;
  const fast = smooth(1.5, 6, vn) * P.gaitW;
  P.dropH -= 0.25 * run + 0.08 * fast + 0.05 * smooth(0, 0.15, vn) * P.gaitW; // (any step lifts the rump off the ground a little: uneven ground)
  // the chest drops so the short forelegs can reach forward and back (they are nearly straight at rest)
  P.dropF += 0.45 * run;
  P.neckReach += (0.004 * run + 0.003 * fast) / cfg.unit;
  // the head leads a turn only a little (the short neck: the engine's lead of the gaze into a turn
  // twisted the skull on the atlas in the zig-zag escape)
  P.headYaw -= 0.75 * clamp(e.yawRate * 0.22, -0.4, 0.4);
  P.headRaise -= (0.004 * run + 0.002 * fast) / cfg.unit;
  // nose twitch rate: calm 1.5-3 Hz in bursts with pauses, faster when moving
  b.twitchT -= dt;
  if (b.twitchT <= 0) { b.twitchT = 0.8 + e.rand() * 2.5; b.twitchAmp = e.rand() < 0.2 ? 0 : 0.6 + 0.5 * e.rand(); b.twitchRate = 1.6 + e.rand() * 1.4; }
  b.twitchRate += (lerp(b.twitchRate, 4.5, run) - b.twitchRate) * 0.1;
  b.scan = lerp(1, 1.6, P.lookW > 0 && P.look ? 0.5 : 0);
  // zig-zag escape steering (the flee action)
  const f = b.flee;
  if (f) {
    f.t += dt;
    if (f.t >= f.dur) b.flee = null;
    else {
      f.next -= dt;
      if (f.next <= 0) { f.side = -f.side; f.next = 0.3 + e.rand() * 0.35; }
      e.wantSpeed = Math.max(e.wantSpeed, f.speed * cfg.sq * smooth(0, 0.3, f.t));
      e.wantHeading = f.h0 + f.side * f.amp * smooth(0.2, 0.6, f.t);
    }
  }
  // any other action interrupts grazing / drinking
  if (L.oneshots.some((a) => !a.stopping && a.name !== 'eat' && a.name !== 'drink' && a.name !== 'hit')) for (const a of L.oneshots) if (a.name === 'eat' || a.name === 'drink') a.stopping = true;
  // alarm thump after being startled
  if (b.thumpAfter > 0) {
    b.thumpAfter -= dt;
    if (b.thumpAfter <= 0) {
      if (!busy(L) && e.speed < 0.05 && e.legs.every((l) => l.state === 'stance')) L.play('thump');
      else if (!busy(L)) b.thumpAfter = 0.1; // wait until it stands still on all four
    }
  }
  // automatic idle variants (standing still, nothing else running, nobody steering the gaze)
  if (e.idleVariants !== false && L.idle.w > 0.98 && !busy(L) && !e.input.look && !e.input.follow) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 6 + e.rand() * 9;
      const r = e.rand();
      if (r < 0.35) L.play('groom');
      else if (r < 0.6) L.play('periscope');
      else if (r < 0.7) L.play('thump');
      else b.twitchAmp = 1.2; // a sniffing burst
    }
  } else if (busy(L)) b.idleT = Math.max(b.idleT, 3);
}

// ------------------------------------------------------------------------------------------------
// hops and jumps: a real ballistic flight (engine.takeOff) with scripted foot paths in world space.
// Each foot leaves from where it stood (A) and lands where the stance after the hop will put it (B),
// so handing the feet back to the gait at the end is continuous. Hind feet push off together, trail
// extended behind, swing forward outside the forelegs and land together just after the forefeet.
function hopDef(o) {
  return {
    kind: 'oneshot', airborne: true, fade: 0.1,
    start(inst, L) {
      const e = L.engine, cfg = e.cfg, s = cfg.s;
      inst.run = smooth(0.8, 2.5, e.speed / cfg.sq);
      inst.tc = lerp(o.crouch, 0.16, inst.run) * cfg.sq;
      const h = (inst.opts.height ?? o.height) * s * lerp(1, 0.6, inst.run);
      inst.vy = Math.sqrt(2 * 9.81 * h);
      inst.T = (2 * inst.vy) / 9.81;
      let dist = (inst.opts.distance ?? o.distance) * s;
      if (inst.opts.target) { const t = inst.opts.target; dist = clamp(Math.hypot(t.x - e.pos.x, t.z - e.pos.z), 0.05 * s, dist * 2.5); }
      inst.vh = Math.max(e.speed, lerp(dist / inst.T, e.speed, inst.run));
      inst.tp = Math.min(0.08 * cfg.sq, inst.tc * 0.6);
      inst.LD = lerp(0.42, 0.2, inst.run) * cfg.sq; // landing hand-back time
      inst.L0 = (inst.vy * inst.tp) / 2;
      inst.phase = 'crouch';
      inst.dur = Infinity;
      inst.side = inst.opts.side ?? (e.rand() < 0.5 ? -1 : 1);
      inst.A = [0, 1, 2, 3].map(() => new THREE.Vector3());
      inst.Bp = [0, 1, 2, 3].map(() => new THREE.Vector3());
      inst.end = [0, 1, 2, 3].map(() => new THREE.Vector3());
      inst.last = [0, 1, 2, 3].map(() => new THREE.Vector3());
    },
    update(inst, dt, L) {
      inst.dt = dt;
      const e = L.engine, cfg = e.cfg;
      if (inst.phase === 'crouch' && inst.t >= inst.tc) {
        inst.phase = 'air'; inst.tAir = inst.t;
        // the push's height so far (last frame): the engine's flight adds this frame's rise
        { const u = Math.max(0, inst.t - dt - (inst.tc - inst.tp)); inst.L0 = u <= inst.tp ? (inst.vy * u * u) / (2 * inst.tp) : inst.vy * (inst.tp / 2 + u - inst.tp); }
        e.takeOff(inst.vy, inst.vh);
        if (inst.run > 0.5) e.phase = ((-e.gait.f * inst.T) % 1 + 1) % 1;
        // landing: body ground point after the flight (heading is held in the air)
        const land = tv().copy(e.pos).addScaledVector(e.forward(e.heading, tv()), inst.vh * inst.T);
        for (let i = 0; i < 4; i++) {
          const Ld = e.legs[i].def;
          inst.A[i].copy(e.legs[i].contact);
          if (i === 0) { inst.P0 = e.pos.clone(); inst.Pl = land.clone(); inst.F = e.forward(e.heading, new THREE.Vector3()); }
          e.bodyToWorld(Ld.cx * Ld.s, 0, Ld.cz, e.heading, land, inst.Bp[i]);
          if (inst.run > 0.5) {
            // running: land in step with the stride (hind feet plant together as it lands), so the
            // gait carries on without hurried catch-up swings
            const g = e.gait, half = Math.min(e.speed * g.D / g.f * 0.5, Ld.leadMax);
            if (!Ld.front) inst.Bp[i].addScaledVector(e.forward(e.heading, tv()), half);
          }
          inst.Bp[i].y = e.terrainH(inst.Bp[i].x, inst.Bp[i].z);
        }
      }
      if (inst.phase === 'land' && inst.t - inst.tLand > inst.LD) return true;
      if (inst.phase === 'air' && inst.t - inst.tAir > 3) e.touchDown();
      return false;
    },
    onLand(inst, L) {
      inst.phase = 'land'; inst.tLand = inst.t;
      const e = L.engine;
      if (inst.run < 0.5) e.speed *= 0.3; // a single hop stops; a running hop runs on
      // the legs take the landing (the crouching rump rides millimetres above the ground)
      e.hipY.v *= 0.25; e.shY.v *= 0.5;
      for (let i = 0; i < 4; i++) inst.end[i].copy(inst.last[i]);
    },
    apply(P, w, inst, L) {
      const e = L.engine, cfg = e.cfg, s = cfg.s, t = inst.t;
      if (inst.phase === 'crouch') {
        const c = smooth(0, inst.tc, t) * (1 - inst.run * 0.7) * w;
        mx(P, 'dropF', 0.2, c); mx(P, 'dropH', 0.03 + 0.1 * o.crouchH, c); mx(P, 'earFlat', 0.25, c);
        // the feet are taken over by the scripted paths already while they still stand (target =
        // where they are), so nothing jumps at take-off
        const r = smooth(lerp(0.2, 0, inst.run) * inst.tc, 0.9 * inst.tc, t) * w;
        const u0 = clamp(t - (inst.tc - inst.tp), 0, inst.tp), push = (inst.vy * u0 * u0) / (2 * inst.tp);
        for (let i = 0; i < 4; i++) { P.legs[i].target.copy(e.legs[i].contact); if (i < 2) P.legs[i].target.y += push * o.follow[0]; mxLeg(P, i, 'reach', 1, r); }
        // push-off: the forequarters rise first (P.pitch is applied unfiltered: ramp it here)
        mx(P, 'pitch', 0.22 * o.pitch * (1 - 0.5 * inst.run), r);
        mx(P, 'gaitW', 0, r); mx(P, 'legGait', 0, r);
        // push: the body accelerates up (and forward) over the last few frames, so the ballistic
        // take-off does not start with a velocity step
        const u = clamp(t - (inst.tc - inst.tp), 0, inst.tp);
        P.lift += (inst.vy * u * u) / (2 * inst.tp) * w;
        if (inst.run < 0.5 && u > 0) e.speed = Math.max(e.speed, inst.vh * (u / inst.tp));
        return;
      }
      // the push's height is carried through the flight and given back while landing
      P.lift += inst.L0 * w * (inst.phase === 'land' ? 1 - smooth(0, 0.7 * inst.LD, t - inst.tLand) : 1);
      const x = (t - inst.tAir + (inst.dt || 1 / 60)) / inst.T; // after this frame's step
      const k0 = w;
      let hand = 0; // 0 = scripted foot paths, 1 = back to the gait's own contacts
      if (inst.phase === 'land') hand = smooth(0.0, 0.7 * inst.LD, t - inst.tLand);
      const lg = inst.phase === 'land' ? 1 - smooth(0.3 * inst.LD, 0.95 * inst.LD, t - inst.tLand) : 1;
      mx(P, 'gaitW', 0, k0 * lg); mx(P, 'legGait', 0, k0 * lg);
      for (let i = 0; i < 4; i++) {
        const pl = P.legs[i];
        const p = inst.phase === 'land' ? landTarget(inst, e, i, hand) : pathAt(inst, e, i, x, flightLift(inst, e) + inst.L0 * (1 - smooth(0.55, 0.95, x)));
        pl.target.copy(p);
        if (inst.phase === 'air') inst.last[i].copy(p);
        mxLeg(P, i, 'reach', 1, k0 * lg);
      }
      // body: nose up at take-off, level in flight, nose down to land on the forefeet
      const xp = clamp(x, 0, 1);
      if (inst.phase === 'air') {
        mx(P, 'pitch', lerp(0.22, -0.2, smooth(0.05, 0.95, xp)) * o.pitch * (1 - 0.5 * inst.run), k0);
        mx(P, 'earFlat', 0.45, k0); mx(P, 'tailLift', 0.5, k0);
        if (o.twist) {
          // binky: the body twists in mid-air and the hind end flicks to the side
          const tw = Math.sin(PI * xp) * inst.side;
          mx(P, 'bend', 0.45 * tw, k0); mx(P, 'roll', 0.3 * Math.sin(TAU * xp) * inst.side, k0);
          mx(P, 'headYaw', -0.4 * tw, k0);
        }
      } else {
        // lands on extended legs, then settles back into the crouch (the rump sits millimetres above
        // the ground at rest, so the landing is absorbed by the legs, not by dropping the body)
        const xl = (t - inst.tLand) / inst.LD;
        const a = Math.sin(PI * Math.min(1, xl * 1.5)) * (1 - xl) * w;
        mx(P, 'dropF', 0.2, a);
        mx(P, 'dropH', -0.09 * (1 - smooth(0, 1, xl)), w);
      }
      void s;
    },
  };
  // after landing: the feet ride with the body (a running landing carries on) and blend into the
  // gait's own contacts
  function landTarget(inst, e, i, hand) {
    const p = tv().copy(inst.end[i]).sub(inst.Pl).add(e.pos).addScaledVector(inst.F, e.speed * (inst.dt || 1 / 60));
    p.y = inst.end[i].y;
    return p.lerp(e.legs[i].contact, hand);
  }
  // body height in flight as the engine will have it after this frame's simulation step (the action
  // layer runs before the step, so e.lift is one frame old)
  function flightLift(inst, e) {
    if (!e.air.active) return 0;
    const ta = e.air.t + (inst.dt || 1 / 60);
    return Math.max(0, inst.vy * ta - 4.905 * ta * ta);
  }
  // foot path in world space at flight fraction x (body lift `lift` above the ground)
  function pathAt(inst, e, i, x, lift) {
    const front = i < 2, s = e.cfg.s;
    const A = inst.A[i], Bq = inst.Bp[i];
    if (inst.run > 0.5) {
      // running: the feet keep cycling as in the stride, carried up with the body
      const c = tv().copy(e.legs[i].contact);
      c.y += lift * (front ? o.follow[0] : o.follow[1] * smooth(0, 0.3, x));
      // ... but never folded up into the girdle (the leg chain would flip through its minimum length)
      const Ld = e.legs[i].def, gy = (front ? e.fr.shC.y : e.fr.hipC.y) - (front ? 0.62 : 0.55) * Ld.len;
      c.y = smin(c.y, gy, 0.05 * e.cfg.k);
      return c;
    }
    // feet are carried with the body (ground point Pb, known in advance: constant horizontal speed)
    // and move from their take-off to their landing offset; the hind feet first stay where they
    // pushed off (the extended phase) and are then swung forward under the body
    const xb = clamp(x, 0, 1);
    const Pb = tv().copy(inst.P0).lerp(inst.Pl, xb);
    const u = front ? smooth(0.0, 0.9, x) : smooth(0.3, 1.0, x);
    const rel = tv().subVectors(A, inst.P0).lerp(tv().subVectors(Bq, inst.Pl), u);
    const p = tv().copy(Pb).add(rel);
    if (front) p.addScaledVector(inst.F, o.reachF * s * Math.sin(PI * u));
    else p.lerp(tv().copy(A), 1 - smooth(0.08, 0.5, x));
    const arc = Math.sin(PI * clamp(u, 0, 1)) * (front ? o.arcF : o.arcH) * s;
    // forefeet leave with the body; the hind feet push until the body has left, then follow
    p.y = lerp(A.y, Bq.y, u) + lift * (front ? o.follow[0] : o.follow[1] * smooth(0, 0.3, x)) + arc;
    if (o.twist && !front) {
      const Ld = e.legs[i].def;
      const lat = e.left(e.heading, tv());
      p.addScaledVector(lat, inst.side * 0.05 * s * Math.sin(PI * clamp(x, 0, 1)) * (Ld.s > 0 ? 1 : 0.8));
    }
    return p;
  }
}

// ------------------------------------------------------------------------------------------------
// posture helpers
const raiseFront = (P, w, amount, pitch = 0) => { mx(P, 'dropF', -amount, w); if (pitch) mx(P, 'pitch', pitch, w); };

// grooming: sits up and washes the face with both forepaws, licking them between strokes
const groom = {
  kind: 'oneshot', fade: 0.35,
  start(inst) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 4.2); },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, s = cfg.s, t = inst.t;
    const up = w * smooth(0, 0.5, t);
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    raiseFront(P, up, 0.35, 0.02); mx(P, 'dropH', -0.02, up);
    // the forepaws are held up under the chin and the face is rubbed down over them (the head does
    // the wiping: nose down to lick the paws, then the cheeks drawn over them)
    const wipe = 0.5 - 0.5 * Math.cos(t * TAU * 1.1);
    mx(P, 'headPitch', 0.9 + 0.3 * wipe, up); mx(P, 'headRaise', -0.03 / cfg.unit, up); mx(P, 'lookW', 0, up);
    mx(P, 'earFlat', 0.15, up);
    const fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
    const pawIn = up * smooth(0.25, 0.7, t);
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? 1 : -1;
      const tp = tv().copy(e.fr.shC).addScaledVector(fwd, (0.05 - 0.008 * wipe) * s).addScaledVector(lat, sd * 0.012 * s);
      tp.y += (-0.012 + 0.008 * wipe) * s;
      P.legs[i].target.lerp(tp, pawIn / Math.max(1e-3, P.legs[i].reach + pawIn));
      mxLeg(P, i, 'reach', 1, pawIn);
    }
    mx(P, 'jaw', 0.14 * Math.max(0, Math.sin(t * TAU * 2.2)) * (1 - wipe), up); mx(P, 'jawOmega', 25, up);
  },
};

// periscope: rises on the hind feet (metatarsi flat), forelegs dangling, head high, looking far
const periscope = {
  kind: 'oneshot', fade: 0.45,
  start(inst, L) {
    inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 3.2);
    const e = L.engine;
    const a = e.heading + (e.rand() - 0.5) * 1.6, d = 8 * e.cfg.s;
    inst.look = inst.opts.target ? inst.opts.target.clone() : new THREE.Vector3(e.pos.x + Math.sin(a) * d, e.pos.y + 0.35 * e.cfg.s, e.pos.z + Math.cos(a) * d);
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t;
    const up = w * smooth(0, 0.6, t);
    // the body comes down first, then the forepaws reach for the ground (handed back to their plants
    // while the chest was still up, they hung in the air out of reach)
    const body = up * (1 - smooth(inst.dur - 0.8, inst.dur - 0.15, t));
    const legs = Math.min(up, w * smooth(0.004 * e.cfg.k, 0.03 * e.cfg.k, e.shY.x) + body);
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    raiseFront(P, body, 2.3, 0.1);
    mx(P, 'dropH', -0.8, body);
    for (let i = 0; i < 2; i++) { mxLeg(P, i, 'tuck', 1, legs); P.legs[i].extend = 0.35; }
    mx(P, 'headRaise', 0.012 / e.cfg.unit, up); mx(P, 'headPitch', -0.15, up);
    if (!e.input.look) { P.look = inst.look; mx(P, 'lookW', 1, up); }
    mx(P, 'earFlat', 0, up);
    mx(P, 'breathRate', 1.5, up);
  },
};

// thump: alert, then slams both hind feet on the ground (twice), scut up
const THUMPS = [0.45, 0.95];
const thump = {
  kind: 'oneshot', fade: 0.2,
  start(inst) { inst.dur = 1.45; inst.hit = [false, false]; },
  update(inst, dt, L) {
    const e = L.engine;
    THUMPS.forEach((tt, j) => {
      if (!inst.hit[j] && inst.t >= tt + 0.12) {
        inst.hit[j] = true;
        for (const i of [2, 3]) e.emit('footstep', { foot: e.legs[i].def.key, position: e.legs[i].plant.clone(), speed: 0, strength: 1, thump: true });
      }
    });
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, s = e.cfg.s, t = inst.t;
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    mx(P, 'dropF', -0.2, w); mx(P, 'tailLift', 0.9, w); mx(P, 'headRaise', 0.008 / e.cfg.unit, w);
    let lift = 0;
    for (const tt of THUMPS) lift = Math.max(lift, smooth(tt - 0.14, tt, t) * (1 - smooth(tt + 0.04, tt + 0.12, t)));
    const k = w * smooth(0.15, 0.35, t) * (1 - smooth(1.1, 1.35, t));
    for (const i of [2, 3]) {
      const leg = e.legs[i];
      const tp = tv().copy(leg.plant);
      tp.y += 0.022 * s * lift;
      tp.addScaledVector(e.forward(e.heading, tv()), -0.01 * s * lift);
      P.legs[i].target.copy(tp);
      mxLeg(P, i, 'reach', 1, k);
    }
    mx(P, 'pitch', 0.05 * lift, w);
  },
};

// sit (posture): the rabbit's resting stance is already a crouch, so 'sit' is the alert upright
// sit on the haunches: forequarters raised on straight forelegs, head high, ears up
const sit = {
  kind: 'posture', fadeIn: 0.7, fadeOut: 0.6,
  apply(P, w, inst, L) {
    const e = L.engine;
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    raiseFront(P, w, 0.9, 0.04);
    mx(P, 'dropH', 0.015, w);
    mxLeg(P, 0, 'sit', 1, w); mxLeg(P, 1, 'sit', 1, w);
    mx(P, 'headRaise', 0.01 / e.cfg.unit, w); mx(P, 'headPitch', -0.08, w);
    mx(P, 'earFlat', 0, w);
  },
};

// sleep (posture): rabbits doze in the loaf (not curled like a cat): lying sternal, head sunk
// between the shoulders, ears laid back along the back, eyes closed, nose twitching stops
const sleep = {
  kind: 'posture', fadeIn: 1.3, fadeOut: 1.0,
  apply(P, w, inst, L) {
    POSTURES.lie.apply(P, w, inst, L);
    const c = smooth(0.8, 2.5, inst.t) * w;
    mx(P, 'headRaise', -0.012 / L.engine.cfg.unit, c); mx(P, 'headPitch', 0.25, c);
    mx(P, 'earFlat', 0.85, c); mx(P, 'earTwitch', 0.3, c);
    mx(P, 'eyelid', 1, smooth(1.5, 3, inst.t) * w);
    mx(P, 'breathRate', 0.5, c); mx(P, 'breathAmp', 1.3, c);
    mx(P, 'lookW', 0, c); mx(P, 'tailIdle', 0.1, c);
  },
};

// flee: bolts with sharp zig-zag turns (45-90 degrees), ears back, white scut raised
const flee = {
  kind: 'oneshot', fade: 0.2,
  start(inst, L) {
    const e = L.engine, b = B(e);
    inst.dur = inst.opts.duration ?? 3;
    let h0 = e.heading;
    if (inst.opts.from) h0 = Math.atan2(e.pos.x - inst.opts.from.x, e.pos.z - inst.opts.from.z);
    if (inst.opts.heading !== undefined) h0 = inst.opts.heading;
    b.flee = { t: 0, dur: inst.dur, h0, side: e.rand() < 0.5 ? -1 : 1, next: 0.35, amp: 0.7, speed: inst.opts.speed ?? (e.cfg.gears.bound || 3 * e.cfg.sq) / e.cfg.sq };
  },
  update(inst, dt, L) { if (inst.t >= inst.dur) { B(L.engine).flee = null; return true; } return false; },
  apply(P, w) { mx(P, 'earFlat', 0.8, w); mx(P, 'tailLift', 0.6, w); },
};

// attack: territorial boxing. Rears up, strikes with alternating forepaws, then lunges and bites.
const attack = {
  kind: 'oneshot', fade: 0.15, needsStand: true,
  start(inst, L) {
    const e = L.engine;
    inst.dur = 1.55; inst.hit = false;
    inst.run = smooth(0.8, 2.5, e.speed / e.cfg.sq);
    inst.target = inst.opts.target ? inst.opts.target.clone() : null;
  },
  update(inst, dt, L) {
    const e = L.engine;
    if (!inst.hit && inst.t >= 0.5) {
      inst.hit = true;
      const p = e.legs[0].contact.clone().lerp(e.legs[1].contact, 0.5);
      const dir = inst.target ? inst.target.clone().sub(e.pos).setY(0).normalize() : e.forward(e.heading, new THREE.Vector3());
      e.emit('attackHit', { position: p, direction: dir, style: 'box' });
    }
    if (inst.hit && !inst.bit && inst.t >= 1.12) {
      inst.bit = true;
      const p = new THREE.Vector3().copy(e.cfg.mouthLocal).applyQuaternion(e.headPose.quaternion).add(e.headPose.position);
      e.emit('attackHit', { position: p, direction: e.forward(e.heading, new THREE.Vector3()), style: 'bite' });
    }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, s = cfg.s, t = inst.t, still = 1 - inst.run;
    if (inst.target) { P.look = inst.target; mx(P, 'lookW', 1, w); }
    mx(P, 'earFlat', 1, w * smooth(0, 0.12, t)); mx(P, 'earTwitch', 0, w);
    const rear = smooth(0.0, 0.28, t) * (1 - smooth(0.8, 1.15, t)) * w * still;
    const lunge = smooth(0.95, 1.12, t) * (1 - smooth(1.2, 1.5, t)) * w;
    mx(P, 'gaitW', 0, rear); mx(P, 'legGait', 0, rear);
    raiseFront(P, rear, 1.5, 0.05); mx(P, 'dropH', -0.25, rear);
    for (let i = 0; i < 2; i++) { mxLeg(P, i, 'tuck', 1, rear); P.legs[i].extend = 0.25; }
    // forepaw strikes, alternating, toward the opponent's face
    const fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
    const sh = tv().copy(e.fr.shC);
    for (let i = 0; i < 2; i++) {
      const t0 = i === 0 ? 0.35 : 0.55;
      const strike = Math.pow(Math.sin(PI * clamp((t - t0) / 0.24, 0, 1)), 2) * rear;
      const tp = tv().copy(sh).addScaledVector(fwd, 0.1 * s).addScaledVector(lat, (i === 0 ? 1 : -1) * 0.012 * s);
      tp.y += 0.01 * s;
      if (inst.target) tp.lerp(tv().copy(inst.target).setY(Math.max(inst.target.y, tp.y)), 0.2);
      P.legs[i].target.lerp(tp, strike / Math.max(1e-3, P.legs[i].reach + strike));
      mxLeg(P, i, 'reach', 1, strike);
    }
    // lunge and bite
    mx(P, 'fwd', 0.03 * s / cfg.unit, lunge); mx(P, 'neckReach', 0.012 * s / cfg.unit, lunge);
    mx(P, 'jaw', 0.5, w * smooth(0.98, 1.08, t) * (1 - smooth(1.12, 1.2, t))); mx(P, 'jawOmega', 30, w);
  },
};

// hit: the engine's stagger, then (often) an alarm thump
const hit = {
  ...ONESHOTS.hit,
  kind: 'oneshot',
  start(inst, L) {
    // a light animal: the blow shoves it less (fewer recovery steps); often an alarm thump after
    inst.opts = { ...inst.opts, strength: (inst.opts.strength ?? 1) * 0.5 };
    ONESHOTS.hit.start(inst, L);
    if (L.engine.rand() < 0.6) B(L.engine).thumpAfter = 1.0;
  },
  // the engine's flinch with a continuous envelope (sharp rise, exponential settle), ears flat
  apply(P, w, inst) {
    const t = inst.t;
    const k = smooth(0, 0.09, t) * Math.exp(-Math.max(0, t - 0.09) * 5.5) * w;
    mx(P, 'roll', inst.lx * 0.16, k); mx(P, 'bend', -inst.lx * 0.25, k);
    mx(P, 'pitch', inst.lz * 0.08, k); mx(P, 'dropF', 0.18, k); mx(P, 'dropH', 0.012, k);
    P.headLocal.set(inst.lx * 0.06, 0.02, inst.lz * 0.06 - 0.03); mx(P, 'headLocalW', 1, k);
    mx(P, 'headYaw', -inst.lx * 0.35, k); mx(P, 'headPitch', -0.15, k);
    mx(P, 'earFlat', 1, w * (1 - smooth(0.4, 0.75, t))); mx(P, 'eyelid', 0.7, k);
    mx(P, 'tailLift', 0.6, k);
  },
};

export const hooks = {
  pose,
  update,
  actions: {
    hop: hopDef({ height: 0.08, distance: 0.35, crouch: 0.12, crouchH: 0, arcF: 0.02, arcH: 0.02, reachF: 0.03, follow: [0.8, 0.55], pitch: 1, twist: false }),
    jump: hopDef({ height: 0.4, distance: 0.7, crouch: 0.2, crouchH: 0.2, arcF: 0.03, arcH: 0.03, reachF: 0.03, follow: [0.93, 0.8], pitch: 1.3, twist: false }),
    binky: hopDef({ height: 0.22, distance: 0.12, crouch: 0.14, crouchH: 0.1, arcF: 0.03, arcH: 0.03, reachF: 0.01, follow: [0.9, 0.75], pitch: 0.4, twist: true }),
    groom, periscope, thump, flee, attack, hit, sit, sleep,
    death: { ...POSTURES.death, kind: 'posture', fadeOut: 2.0 },
  },
};
