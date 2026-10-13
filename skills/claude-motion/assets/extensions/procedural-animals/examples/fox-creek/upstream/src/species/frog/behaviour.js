// Frog behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js):
//
//   pose(engine, dt)        after the engine's solve: the eyes retract into the head (blinks,
//                           swallowing, leaps), the throat pumps (buccal breathing) and balloons into
//                           the vocal sac (croak), the tongue flips out of the mouth (feeding strike)
//   update(P, dt, layer)    every frame over the action layer: automatic blinks, throat pumping rate,
//                           the head held still on the trunk (no neck), croaking bouts as an idle
//                           variant (males), long motionless sits
//   actions                 hop (a single short hop), jump (the long jump: take-off extension, legs
//                           trailing fully extended in flight, forelimbs land first, then the body,
//                           then the hind legs fold forward into the sit), croak, blink, attack and eat
//                           (the tongue strike), sit (alert upright sit), lie (flattened crouch), sleep,
//                           drink (sits with its belly pressed down: frogs soak water through the skin),
//                           hit (flinch, eyes pulled in, then often hops away), death (limp, belly
//                           down, legs sprawled)
//
// All distances are frog metres at the reference size (bullfrog SVL 140 mm), multiplied by cfg.s;
// posture offsets that the engine multiplies by cfg.k (fwd, side, headRaise, neckReach) are divided by
// cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, smin, TAU, tv, tqa } from '../../core/motion/common.js';
import { mx, mxLeg, ONESHOTS } from '../../core/motion/actions.js';

const PI = Math.PI;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
const _X = new THREE.Vector3(1, 0, 0), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);
const bell = (t, a, b, c, d) => smooth(a, b, t) * (1 - smooth(c, d, t));

// eye retraction depth (m at size 1) and the tongue's extension (x its rest length)
const EYE_DROP = 0.0048;
const TONGUE_EXT = 1.9;

// per-engine behaviour state; `f` holds this frame's requests from the actions (reset after pose)
function B(e) {
  if (!e._fb) {
    e._fb = {
      blinkWait: 2 + e.rand() * 4, blinkAge: -1, blink: 0,
      pumpPh: 0, pumpRate: 1.6, pumpAmp: 1, sac: 0, retract: 0, tongueX: 0,
      croakT: 12 + e.rand() * 20, idleT: 10 + e.rand() * 10,
      f: { retract: 0, lid: 0, sac: 0, pump: 1, tongue: 0, flip: 0, aim: new THREE.Vector3(), aimW: 0 },
      eyeLen: null,
    };
  }
  return e._fb;
}
const busy = (L) => L.postures.length > 0 || L.oneshots.some((a) => !a.stopping);

// ------------------------------------------------------------------------------------------------
// pose: eyes, throat, tongue (runs after the engine wrote the head, jaw and the extra bones)
function pose(e, dt) {
  const b = B(e), f = b.f, cfg = e.cfg, s = cfg.s;
  const crowd = e.lod >= 2;
  // eye retraction: the globes and lids sink into the head (blink, swallow, flight), lower lid rises
  const want = clamp(Math.max(f.retract, b.blink), 0, 1);
  b.retract += (want - b.retract) * (1 - Math.exp(-dt * 30));
  if (b.retract > 1e-4) {
    for (const S of ['L', 'R']) {
      const eb = e.bone['eye' + S];
      if (!eb) continue;
      _q.setFromRotationMatrix(eb.matrixWorld);
      _p.setFromMatrixPosition(eb.matrixWorld);
      // down along the eye bone (the head's up) and a little back
      _p.addScaledVector(tv(0, 1, 0).applyQuaternion(_q), -EYE_DROP * s * b.retract).addScaledVector(tv(0, 0, 1).applyQuaternion(_q), -0.0012 * s * b.retract);
      eb.matrixWorld.compose(_p, _q, _s);
    }
  }
  // throat: buccal pumping (the floor of the mouth rises and falls ~1.5 Hz) and the vocal sac
  const th = e.bone.throat;
  if (th) {
    b.pumpPh += dt * TAU * b.pumpRate;
    const pump = crowd ? 0 : (0.5 + 0.5 * Math.sin(b.pumpPh)) * b.pumpAmp * f.pump;
    b.sac += (f.sac - b.sac) * (1 - Math.exp(-dt * (f.sac > b.sac ? 9 : 6)));
    const sc = b.sac;
    if (pump > 1e-4 || sc > 1e-4) {
      _q.setFromRotationMatrix(th.matrixWorld);
      _p.setFromMatrixPosition(th.matrixWorld);
      // (bone Y points down and forward out of the head: the floor of the mouth drops along it)
      _s.set(1 + 0.05 * pump + 0.35 * sc, 1 + 0.14 * pump + 0.8 * sc, 1 + 0.05 * pump + 0.3 * sc);
      th.matrixWorld.compose(_p, _q, _s);
      _s.set(1, 1, 1);
    }
  }
  // tongue: flips forward out of the mouth about its front attachment and stretches
  const tg = e.bone.tongue;
  if (tg && (f.flip > 1e-4 || f.tongue > 1e-4)) {
    _q.setFromRotationMatrix(tg.matrixWorld);
    _p.setFromMatrixPosition(tg.matrixWorld);
    const lat = tv(1, 0, 0).applyQuaternion(_q);
    _q2.copy(tqa(lat, f.flip * PI)).multiply(_q);
    // aim: once flipped out, the tongue turns toward the prey (default: just ahead of the mouth, never
    // into the ground) and stretches to reach it
    const L0 = e.J.tongueBase.distanceTo(e.J.tongueTip);
    const hf = tv(0, 0, 1).applyQuaternion(e.headPose.quaternion);
    hf.y = Math.min(hf.y, 0) - 0.25; hf.normalize();
    const aim = tv().copy(_p).addScaledVector(hf, L0 * 2.2);
    if (f.aimW > 0) {
      // (prey the frog has already passed, or far off to the side, is out of the tongue's reach)
      const to = tv().subVectors(f.aim, _p), dl = to.length();
      const ok = smooth(0.35, 0.7, to.dot(hf) / Math.max(dl, 1e-6)) * f.aimW;
      aim.lerp(f.aim, ok);
    }
    aim.y = Math.max(aim.y, e.terrainH(aim.x, aim.z) + 0.009 * s);
    const want = tv().subVectors(aim, _p);
    const dist = want.length();
    want.multiplyScalar(1 / Math.max(dist, 1e-6));
    const d1 = tv(0, 1, 0).applyQuaternion(_q2);
    const k = smooth(0.5, 0.95, f.flip);
    if (k > 0) {
      // (bounded, about a stable axis: the tongue can only bend so far off the head's midline)
      const ax = tv().crossVectors(d1, want);
      const sn = ax.length(), ang = Math.atan2(sn, d1.dot(want));
      if (sn > 1e-3) ax.multiplyScalar(1 / sn); else ax.copy(lat);
      _q2.premultiply(tqa(ax, Math.min(ang, 1.0) * k));
    }
    const ext = clamp(dist / L0, 1, TONGUE_EXT);
    _s.set(1 - 0.25 * f.tongue, 1 + (ext - 1) * f.tongue, 1 - 0.2 * f.tongue);
    tg.matrixWorld.compose(_p, _q2, _s);
    _s.set(1, 1, 1);
  }
  b.tongueX = f.tongue;
  f.retract = 0; f.lid = 0; f.sac = 0; f.pump = 1; f.tongue = 0; f.flip = 0; f.aimW = 0;
}

// world position of the tongue tip (after pose)
function tongueTip(e, out) {
  const tg = e.bone.tongue;
  const J = e.J;
  const L = J.tongueBase.distanceTo(J.tongueTip);
  const el = tg.matrixWorld.elements;
  return out.set(el[12] + el[4] * L, el[13] + el[5] * L, el[14] + el[6] * L);
}

// ------------------------------------------------------------------------------------------------
// update: blinks, breathing, idle life
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg;
  const vn = e.speed / cfg.sq;
  P.tailGround = 0; P.tailSide = 0; P.tailLift = 0;
  // Foot placement: stance.sprawl turns the knees and elbows out (the IK poles); the feet themselves
  // stand where the sitting bind pose puts them (the sprawl is sculpted), so the engine's extra sprawl
  // width is taken back out: the resting frog is exactly its bind pose
  for (const leg of e.legs) { const Ld = leg.def; leg.idleOff.x = -Ld.s * cfg.stance.sprawl * Ld.len * 0.35; }
  if (!b.planted) {
    // (a new frog starts with its feet at that placement: the engine planted them before this hook ran)
    b.planted = true;
    for (const leg of e.legs) if (leg.state === 'stance') { e.neutralContact(leg.def, 0, 0, leg.plant, leg); leg.contact.copy(leg.plant); }
  }
  // the resting sit: forelegs a little straighter, chest and head raised, the body sloping to the rump
  mx(P, 'dropF', -0.3, L.idle.w); mx(P, 'headPitch', -0.05, L.idle.w);
  // no neck: the head turns only a few degrees on the trunk and leads turns very little
  P.headYaw -= 0.8 * clamp(e.yawRate * 0.22, -0.4, 0.4);
  // automatic blinks: the eyes are pulled down into the head for ~0.3 s, the lower lid rises
  const asleep = P.eyelid > 0.9;
  if (!asleep && e.lod < 2) {
    b.blinkWait -= dt;
    if (b.blinkAge < 0 && b.blinkWait <= 0) { b.blinkAge = 0; b.blinkWait = 3 + e.rand() * 7; }
  }
  if (b.blinkAge >= 0) {
    b.blinkAge += dt;
    const t = b.blinkAge;
    b.blink = t < 0.09 ? smooth(0, 0.09, t) : t < 0.16 ? 1 : 1 - smooth(0.16, 0.36, t);
    if (t > 0.36) { b.blinkAge = -1; b.blink = 0; }
  } else b.blink = 0;
  P.eyelid = Math.max(P.eyelid, 0.85 * Math.max(b.blink, b.f.retract * 0.8));
  // buccal pumping: ~1.5 Hz at rest, faster after exertion, none in flight
  const air = e.air.active ? 1 : 0;
  b.pumpRate = lerp(1.5, 2.6, smooth(0.2, 1.2, vn)) * (0.9 + 0.2 * Math.sin(e.time * 0.13));
  b.pumpAmp = (1 - air) * (1 - 0.6 * smooth(0.2, 1.0, vn)) * (P.breathRate > 0.1 ? 1 : 0);
  // hopping: the eyes half close / sink with every landing
  if (P.gaitW > 0.5 && vn > 0.25 && e.legs[0].state === 'swing' && e.legs[2].state === 'swing') b.f.retract = Math.max(b.f.retract, 0.35);
  // idle life: long motionless sits; males call in bouts
  if (e.idleVariants !== false && L.idle.w > 0.98 && !busy(L) && !e.input.look && !e.input.follow) {
    b.croakT -= dt;
    if (b.croakT <= 0) {
      b.croakT = 18 + e.rand() * 30;
      if (e.params.sex === 'male' && e.params.age !== 'juvenile') L.play('croak');
    }
  } else if (busy(L)) b.croakT = Math.max(b.croakT, 6);
  // any other action interrupts eating and croaking
  if (L.oneshots.some((a) => !a.stopping && !['eat', 'croak', 'hit', 'blink'].includes(a.name))) for (const a of L.oneshots) if (a.name === 'eat' || a.name === 'croak') a.stopping = true;
  // a startled frog often hops away
  if (b.fleeAfter > 0) {
    b.fleeAfter -= dt;
    if (b.fleeAfter <= 0 && !busy(L)) L.play('hop', { distance: 0.35 });
  }
}

// ------------------------------------------------------------------------------------------------
// Leaps: a real ballistic flight (engine.takeOff) with scripted foot paths in world space. The hind
// feet stay planted while the legs extend (knee, hip, then ankle) and push the body off; in flight
// the hind legs trail fully extended behind the body and the forelimbs reach forward; the body pitches
// nose down so the hands touch first, then the belly lands and the hind legs are drawn forward and
// folded back into the sit.
function leapDef(o) {
  return {
    kind: 'oneshot', airborne: true, fade: 0.08,
    start(inst, L) {
      const e = L.engine, cfg = e.cfg, s = cfg.s;
      // (a frog's leap is a discrete act: from a hop it gathers and leaps like from the sit, keeping its speed)
      inst.run = 0;
      inst.v0 = e.speed;
      inst.tc = lerp(o.crouch, 0.08, inst.run) * cfg.sq;
      const h = (inst.opts.height ?? o.height) * s * lerp(1, 0.7, inst.run);
      inst.vy = Math.sqrt(2 * 9.81 * h);
      inst.T = (2 * inst.vy) / 9.81;
      let dist = (inst.opts.distance ?? o.distance) * s;
      if (inst.opts.target) { const t = inst.opts.target; dist = clamp(Math.hypot(t.x - e.pos.x, t.z - e.pos.z), 0.05 * s, dist * 2); }
      inst.vh = Math.max(e.speed, lerp(dist / inst.T, e.speed, inst.run));
      // push-off: the legs extend over tp (knee, hip, ankle) and launch the body
      inst.tp = Math.min(o.push * cfg.sq, inst.tc * 0.7);
      inst.LD = lerp(o.land, 0.2, inst.run) * cfg.sq; // landing: hands, belly, then the hind legs fold
      inst.L0 = (inst.vy * inst.tp) / 2;
      // (played while hopping: the frog first comes to a stop on all fours, then gathers and leaps)
      inst.phase = e.speed / cfg.sq > 0.08 ? 'settle' : 'crouch';
      inst.ts = 0;
      inst.dur = Infinity;
      inst.A = [0, 1, 2, 3].map(() => new THREE.Vector3());
      inst.Bp = [0, 1, 2, 3].map(() => new THREE.Vector3());
      inst.end = [0, 1, 2, 3].map(() => new THREE.Vector3());
      inst.last = [0, 1, 2, 3].map(() => new THREE.Vector3());
    },
    update(inst, dt, L) {
      inst.dt = dt;
      const e = L.engine;
      if (inst.phase === 'settle') {
        // (all four feet down for a moment: the re-steps after stopping are done)
        inst.still = e.speed < 0.02 * e.cfg.sq && e.legs.every((l) => l.state === 'stance') ? (inst.still || 0) + dt : 0;
        if (inst.still > 0.35 || inst.t > 2) { inst.phase = 'crouch'; inst.ts = inst.t; inst.C = null; }
        return false;
      }
      if (inst.phase === 'crouch' && inst.t - inst.ts >= inst.tc) {
        inst.phase = 'air'; inst.tAir = inst.t;
        { const u = Math.max(0, inst.t - inst.ts - dt - (inst.tc - inst.tp)); inst.L0 = u <= inst.tp ? (inst.vy * u * u) / (2 * inst.tp) : inst.vy * (inst.tp / 2 + u - inst.tp); }
        e.takeOff(inst.vy, inst.vh);
        if (inst.run > 0.5) e.phase = ((-e.gait.f * inst.T) % 1 + 1) % 1;
        const land = tv().copy(e.pos).addScaledVector(e.forward(e.heading, tv()), inst.vh * inst.T);
        inst.P0 = e.pos.clone(); inst.Pl = land.clone(); inst.F = e.forward(e.heading, new THREE.Vector3()); inst.Lf = e.left(e.heading, new THREE.Vector3());
        for (let i = 0; i < 4; i++) {
          const Ld = e.legs[i].def;
          inst.A[i].copy(inst.C ? inst.C[i] : e.legs[i].contact);
          e.neutralContact(Ld, 0, 0, inst.Bp[i], e.legs[i]);
          inst.Bp[i].sub(e.pos).add(land);
          if (inst.run > 0.5) {
            const g = e.gait, half = Math.min(e.speed * g.D / g.f * 0.5, Ld.leadMax);
            if (!Ld.front) inst.Bp[i].addScaledVector(inst.F, half);
          }
          inst.Bp[i].y = e.terrainH(inst.Bp[i].x, inst.Bp[i].z);
        }
      }
      // after landing the frog slides a little on its belly and stops (a continuous braking: a sudden
      // change of speed switched the head carriage in one frame)
      if (inst.phase === 'land') {
        e.speed *= Math.exp(-dt * 16);
        // (the planted feet the landing hands back to are the sitting placement under the sliding body)
        const lgw = 1 - smooth(0.35 * inst.LD, 0.95 * inst.LD, inst.t - inst.tLand);
        if (lgw > 0.02) for (const leg of e.legs) if (leg.state === 'stance') { e.neutralContact(leg.def, 0, 0, leg.plant, leg); leg.contact.copy(leg.plant); }
      }
      if (inst.phase === 'land' && inst.t - inst.tLand > inst.LD) return true;
      if (inst.phase === 'air' && inst.t - inst.tAir > 3) e.touchDown();
      return false;
    },
    onLand(inst, L) {
      inst.phase = 'land'; inst.tLand = inst.t;
      const e = L.engine;
      e.hipY.v *= 0.3; e.shY.v *= 0.4;
      for (let i = 0; i < 4; i++) inst.end[i].copy(inst.last[i]);
    },
    apply(P, w, inst, L) {
      const e = L.engine, cfg = e.cfg, s = cfg.s, b = B(e);
      let t = inst.t;
      if (inst.phase === 'settle') { mx(P, 'speedScale', 0, w); return; }
      if (inst.phase === 'crouch') {
        t -= inst.ts;
        // a brief crouch, then the push: the forequarters rise first, the hind legs extend
        const c = smooth(0, inst.tc, t) * (1 - inst.run * 0.7) * w;
        const u0 = clamp(t - (inst.tc - inst.tp), 0, inst.tp), x = u0 / inst.tp;
        mx(P, 'dropF', lerp(0.15, -0.3, x), c); mx(P, 'dropH', lerp(0.1, -0.2, x), c);
        const r = smooth(lerp(0.2, 0, inst.run) * inst.tc, 0.9 * inst.tc, t) * w;
        const push = (inst.vy * u0 * u0) / (2 * inst.tp);
        // (the feet stay planted flat through the crouch; the scripted foot paths take over as the push
        // starts: the forefeet leave with the body, the hind feet roll up onto their toes)
        const rr = smooth(inst.tc - inst.tp - 0.1 * cfg.sq, inst.tc - 0.3 * inst.tp, t) * w;
        // (the feet push from where they stood when the crouch began, whatever the gait does meanwhile)
        if (!inst.C) inst.C = e.legs.map((l) => l.contact.clone());
        for (let i = 0; i < 4; i++) { P.legs[i].target.copy(inst.C[i]); if (i < 2) P.legs[i].target.y += push * 0.9; mxLeg(P, i, 'reach', 1, rr); }
        mx(P, 'pitch', o.pitch * 0.3 * x * (1 - 0.5 * inst.run), r);
        mx(P, 'flex', -0.12 * x, r);
        mx(P, 'gaitW', 0, r); mx(P, 'legGait', 0, r); mx(P, 'speedScale', 0, w * (1 - smooth(0, 0.2, x)));
        P.lift += push * w;
        if (inst.run < 0.5 && u0 > 0) e.speed = Math.max(e.speed, inst.vh * x);
        b.f.retract = Math.max(b.f.retract, 0.6 * x * w);
        return;
      }
      P.lift += inst.L0 * w * (inst.phase === 'land' ? 1 - smooth(0, 0.6 * inst.LD, t - inst.tLand) : 1);
      const x = (t - inst.tAir + (inst.dt || 1 / 60)) / inst.T;
      let hand = 0;
      if (inst.phase === 'land') hand = smooth(0.0, 0.8 * inst.LD, t - inst.tLand);
      const lg = inst.phase === 'land' ? 1 - smooth(0.35 * inst.LD, 0.95 * inst.LD, t - inst.tLand) : 1;
      mx(P, 'gaitW', 0, w * lg); mx(P, 'legGait', 0, w * lg);
      const lift = flightLift(inst, e) + inst.L0 * (1 - smooth(0.55, 0.95, x));
      for (let i = 0; i < 4; i++) {
        const pl = P.legs[i];
        const p = inst.phase === 'land' ? landTarget(inst, e, i, hand) : pathAt(inst, e, i, x, lift);
        pl.target.copy(p);
        if (inst.phase === 'air') inst.last[i].copy(p);
        mxLeg(P, i, 'reach', 1, w * lg);
      }
      const xp = clamp(x, 0, 1);
      if (inst.phase === 'air') {
        // stretched in flight: nose up off the ground, then down to land on the hands
        mx(P, 'pitch', lerp(0.3, -0.28, smooth(0.1, 0.95, xp)) * o.pitch * (1 - 0.5 * inst.run), w);
        mx(P, 'flex', -0.12 * Math.sin(PI * xp), w);
        b.f.retract = Math.max(b.f.retract, 0.7 * w);
      } else {
        const xl = (t - inst.tLand) / inst.LD;
        // hands, then belly: the chest takes the landing, the rump settles last
        const a = Math.sin(PI * Math.min(1, xl * 1.4)) * (1 - xl) * w;
        // (it settles into the sit before moving on)
        mx(P, 'speedScale', 0, w * (1 - smooth(0.7, 1, xl)));
        mx(P, 'dropF', 0.35, a); mx(P, 'dropH', 0.2, a);
        mx(P, 'pitch', -0.28 * o.pitch * (1 - smooth(0, 0.6, xl)) * (1 - 0.5 * inst.run), w);
        b.f.retract = Math.max(b.f.retract, 0.7 * (1 - smooth(0.3, 0.8, xl)) * w);
      }
      void s;
    },
  };
  function landTarget(inst, e, i, hand) {
    const p = tv().copy(inst.end[i]).sub(inst.Pl).add(e.pos).addScaledVector(inst.F, e.speed * (inst.dt || 1 / 60));
    // (from the height the foot had at touchdown down to the ground, continuously)
    const above = inst.end[i].y - e.terrainH(inst.end[i].x, inst.end[i].z);
    // (toward the sitting placement under the body: the gait's own contact point jumps when a swing it
    // was running lands)
    const q = p.lerp(e.neutralContact(e.legs[i].def, 0, 0, tv(), e.legs[i]), hand);
    q.y = e.terrainH(q.x, q.z) + Math.max(0, above) * (1 - smooth(0, 1, hand));
    // the hind feet are drawn forward just clear of the ground (a step, not a drag)
    if (i >= 2) q.y += Math.sin(PI * hand) * 0.01 * e.cfg.s * (1 - inst.run);
    return q;
  }
  function flightLift(inst, e) {
    if (!e.air.active) return 0;
    const ta = e.air.t + (inst.dt || 1 / 60);
    return Math.max(0, inst.vy * ta - 4.905 * ta * ta);
  }
  function pathAt(inst, e, i, x, lift) {
    const front = i < 2, s = e.cfg.s, Ld = e.legs[i].def;
    const A = inst.A[i], Bq = inst.Bp[i];
    if (inst.run > 0.5) {
      const c = tv().copy(e.legs[i].contact);
      c.y += lift * (front ? 0.9 : 0.75 * smooth(0, 0.3, x));
      const gy = (front ? e.fr.shC.y : e.fr.hipC.y) - (front ? 0.62 : 0.55) * Ld.len;
      c.y = smin(c.y, gy, 0.05 * e.cfg.k);
      return c;
    }
    const xb = clamp(x, 0, 1);
    const Pb = tv().copy(inst.P0).lerp(inst.Pl, xb);
    if (front) {
      // forelimbs: leave with the body, reach forward and down, and meet the ground at the landing spot
      const u = smooth(0.0, 0.92, x);
      const rel = tv().subVectors(A, inst.P0).lerp(tv().subVectors(Bq, inst.Pl), u);
      const p = tv().copy(Pb).add(rel).addScaledVector(inst.F, o.reachF * s * Math.sin(PI * u));
      p.y = lerp(A.y, Bq.y, u) + lift * 0.9 * (1 - smooth(0.7, 1.0, x)) + Math.sin(PI * u) * o.arcF * s;
      return p;
    }
    // hind limbs: planted until the body has left, then trailing fully extended behind the hip in
    // line with the body; they swing forward and fold only in the last part of the flight
    const hip = tv().copy(e.fr.hipC).addScaledVector(inst.Lf, Ld.s * Ld.cx * 0.6);
    const back = tv().copy(inst.F).multiplyScalar(-1);
    const ext = tv().copy(hip).addScaledVector(back, Ld.len * o.ext).addScaledVector(inst.Lf, Ld.s * 0.12 * Ld.len);
    ext.y = hip.y - Ld.len * 0.28;
    const land = tv().copy(Bq); land.y += lift * 0.6 + 0.02 * s;
    const p = tv().copy(A).lerp(ext, smooth(0.0, 0.3, x)).lerp(land, smooth(o.fold, 1.0, x));
    p.y = Math.max(p.y, e.terrainH(p.x, p.z) + 0.004 * s * smooth(0, 0.25, x));
    return p;
  }
}

// ------------------------------------------------------------------------------------------------
// The tongue strike: the mouth opens, the sticky tongue flips out forward (about its attachment at the
// front of the lower jaw) and stretches to the prey, and is pulled back in; the frog lunges a little.
// Returns the strike envelope pieces for apply(): jaw gape, tongue flip and extension.
function strikeAt(t, t0) {
  const u = t - t0;
  const gape = bell(u, -0.04, 0.02, 0.2, 0.28);
  const flip = bell(u, 0.0, 0.07, 0.13, 0.22);
  const ext = bell(u, 0.03, 0.08, 0.11, 0.2);
  return { gape, flip, ext };
}

const attack = {
  kind: 'oneshot', fade: 0.1, needsStand: true,
  start(inst, L) {
    const e = L.engine;
    inst.dur = 0.9; inst.hit = false; inst.t0 = 0.28;
    inst.target = inst.opts.target ? inst.opts.target.clone() : null;
    inst.run = smooth(0.3, 0.8, e.speed / e.cfg.sq);
  },
  update(inst, dt, L) {
    const e = L.engine;
    if (!inst.hit && inst.t >= inst.t0 + 0.09) {
      inst.hit = true;
      const p = tongueTip(e, new THREE.Vector3());
      const dir = inst.target ? inst.target.clone().sub(e.headPose.position).normalize() : e.forward(e.heading, new THREE.Vector3());
      e.emit('attackHit', { position: p, direction: dir, style: 'tongue' });
    }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, t = inst.t, b = B(e);
    if (inst.target) { P.look = inst.target; mx(P, 'lookW', 1, w); }
    // a short lunge: the forequarters rise and the body pitches toward the prey
    const lunge = bell(t, 0.12, 0.3, 0.42, 0.75) * w * (1 - inst.run);
    mx(P, 'fwd', 0.012 / cfg.unit, lunge); mx(P, 'dropF', -0.25, lunge); mx(P, 'pitch', -0.06, lunge);
    const k = strikeAt(t, inst.t0);
    mx(P, 'jaw', 0.42, k.gape * w); mx(P, 'jawOmega', 45, w);
    b.f.flip = Math.max(b.f.flip, k.flip * w); b.f.tongue = Math.max(b.f.tongue, k.ext * w);
    aimTongue(e, b, inst.target, w);
    b.f.retract = Math.max(b.f.retract, 0.5 * bell(t, 0.2, 0.28, 0.4, 0.55) * w);
  },
};

function aimTongue(e, b, target, w) {
  if (!target || w <= 0) return;
  b.f.aim.copy(target); b.f.aimW = 1;
}

// eat: the frog strikes at prey on the ground just ahead, swallows (eyes pulled in twice, pushing the
// food down) and pumps its throat
const eat = {
  kind: 'oneshot', fade: 0.2,
  start(inst) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 2.6); inst.fade = 0.3; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, b = B(e);
    const t = inst.opts.loop ? inst.t % 2.6 : inst.t;
    const lean = bell(t, 0.05, 0.3, 0.55, 0.9) * w;
    mx(P, 'fwd', 0.01 / cfg.unit, lean); mx(P, 'dropF', 0.3, lean); mx(P, 'headPitch', 0.12, lean);
    const k = strikeAt(t, 0.35);
    mx(P, 'jaw', 0.45, k.gape * w); mx(P, 'jawOmega', 45, w);
    b.f.flip = Math.max(b.f.flip, k.flip * w); b.f.tongue = Math.max(b.f.tongue, 0.7 * k.ext * w);
    // prey on the ground a little ahead of the mouth
    const hf = e.forward(e.heading, tv());
    const pt = tv().copy(e.headPose.position).addScaledVector(hf, 0.1 * cfg.s);
    pt.y = e.terrainH(pt.x, pt.z);
    aimTongue(e, b, pt, 1);
    // swallowing: the eyes sink into the head twice, the throat works
    const gulp = Math.max(bell(t, 0.9, 1.05, 1.25, 1.45), bell(t, 1.6, 1.75, 1.95, 2.15));
    b.f.retract = Math.max(b.f.retract, gulp * w);
    mx(P, 'jaw', 0.05, bell(t, 0.7, 0.8, 2.2, 2.4) * w * 0.5);
    b.f.pump = lerp(1, 1.8, bell(t, 0.8, 1.0, 2.2, 2.5) * w);
    mx(P, 'lookW', 0, w);
  },
};

// croak: the male bullfrog's call, a bout of 3-6 deep notes ("jug-o-rum"): with each note the vocal
// sac under the throat balloons and the flanks draw in, then it sits a moment with the sac deflating
const croak = {
  kind: 'oneshot', fade: 0.4,
  start(inst, L) {
    const e = L.engine;
    inst.notes = inst.opts.notes ?? 3 + Math.floor(e.rand() * 4);
    inst.period = 0.95;
    inst.dur = inst.opts.loop ? Infinity : 0.5 + inst.notes * inst.period + 0.6;
    inst.said = -1;
  },
  update(inst, dt, L) {
    const n = Math.floor((inst.t - 0.5) / inst.period);
    if (inst.t > 0.5 && n > inst.said && (inst.opts.loop || n < inst.notes)) { inst.said = n; L.engine.emit('vocalize', { kind: 'croak' }); }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, b = B(e), t = inst.t;
    const on = smooth(0.2, 0.5, t) * (inst.opts.loop ? 1 : 1 - smooth(inst.dur - 0.7, inst.dur - 0.2, t));
    const u = ((t - 0.5) % inst.period + inst.period) % inst.period;
    const note = t > 0.5 ? smooth(0.0, 0.18, u) * (1 - smooth(0.55, 0.85, u)) : 0;
    // the sac stays partly filled between notes
    b.f.sac = Math.max(b.f.sac, (0.35 + 0.65 * note) * on * w);
    b.f.pump = 0;
    // sits up a little, head raised; the flanks contract as the air goes into the sac
    mx(P, 'dropF', -0.25, on * w); mx(P, 'headPitch', -0.08, on * w);
    mx(P, 'breathRate', 0.01, on * w); mx(P, 'breathAmp', 3, on * w);
    e.breath = lerp(e.breath, -PI / 2, note * on * w * 0.2);
    mx(P, 'lookW', 0, on * w);
  },
};

// blink on demand (the automatic blinks run in update)
const blink = {
  kind: 'oneshot', fade: 0.05,
  start(inst) { inst.dur = 0.4; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) { B(L.engine).f.retract = Math.max(B(L.engine).f.retract, bell(inst.t, 0, 0.09, 0.16, 0.36)); },
};

// sit (posture): the alert, upright sit: forelegs straight, chest and head high, eyes wide
const sit = {
  kind: 'posture', fadeIn: 0.6, fadeOut: 0.5,
  apply(P, w, inst, L) {
    const e = L.engine;
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    mx(P, 'dropF', -0.55, w); mx(P, 'dropH', 0.1, w);
    mx(P, 'headRaise', 0.004 / e.cfg.unit, w); mx(P, 'headPitch', -0.1, w);
  },
};

// lie (posture): the flattened crouch: belly and chin pressed to the ground, legs folded tight
const lie = {
  kind: 'posture', fadeIn: 0.8, fadeOut: 0.6,
  apply(P, w, inst, L) {
    const e = L.engine;
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    mx(P, 'dropF', 0.95, w); mx(P, 'dropH', 1.0, w); mx(P, 'groundW', 1, w);
    mx(P, 'headRaise', -0.003 / e.cfg.unit, w); mx(P, 'headPitch', 0.08, w);
    mx(P, 'breathRate', 0.7, w);
  },
};

// sleep (posture): the crouch with the eyes pulled in and closed, slow breathing
const sleep = {
  kind: 'posture', fadeIn: 1.2, fadeOut: 0.8,
  apply(P, w, inst, L) {
    lie.apply(P, w, inst, L);
    const c = smooth(0.8, 2.2, inst.t) * w;
    mx(P, 'eyelid', 1, c);
    B(L.engine).f.retract = Math.max(B(L.engine).f.retract, 0.6 * c);
    B(L.engine).f.pump = lerp(1, 0.5, c);
    mx(P, 'breathRate', 0.5, c); mx(P, 'lookW', 0, c);
  },
};

// drink (one-shot): frogs do not drink; they sit with the pelvic "seat patch" pressed to wet ground
const drink = {
  kind: 'oneshot', fade: 0.6,
  start(inst) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 5); },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    mx(P, 'gaitW', 0, w);
    mx(P, 'dropH', 1, w); mx(P, 'dropF', 0.2, w); mx(P, 'groundW', 1, w);
    mx(P, 'eyelid', 0.3, w);
    B(L.engine).f.pump = lerp(1, 0.6, w);
  },
};

// hit: flinch (the eyes are pulled in, the body ducks), then often hops away
const hit = {
  ...ONESHOTS.hit,
  kind: 'oneshot',
  start(inst, L) {
    inst.opts = { ...inst.opts, strength: (inst.opts.strength ?? 1) * 0.15 };
    ONESHOTS.hit.start(inst, L);
    if (L.engine.rand() < 0.5) B(L.engine).fleeAfter = 0.9;
  },
  apply(P, w, inst, L) {
    const t = inst.t;
    const k = smooth(0, 0.08, t) * Math.exp(-Math.max(0, t - 0.08) * 5) * w;
    mx(P, 'roll', inst.lx * 0.12, k); mx(P, 'bend', -inst.lx * 0.15, k);
    mx(P, 'dropF', 0.4, k); mx(P, 'dropH', 0.15, k);
    mx(P, 'headPitch', 0.08, k);
    B(L.engine).f.retract = Math.max(B(L.engine).f.retract, k);
  },
};

// death (posture): goes limp: the body sinks flat onto its belly between its sprawled legs, the back
// straightens, head down, eyes half closed and pulled in, mouth slack
const death = {
  kind: 'posture', fadeIn: 0.3, fadeOut: 1.6,
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t, cfg = e.cfg;
    const sink = smooth(0, 0.5, t), spread = smooth(0.3, 1.4, t), cfgS = cfg.s;
    void cfgS;
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w); mx(P, 'bodyOmega', 1.4, w);
    mx(P, 'dropF', lerp(0.4, 1, sink), w); mx(P, 'dropH', lerp(0.3, 1, sink), w);
    mx(P, 'groundW', 1, w);
    mx(P, 'flex', -0.1 * spread, w); mx(P, 'headPitch', 0.15, w); mx(P, 'headLimp', 0.6, w);
    mx(P, 'jaw', 0.08, sink * w); mx(P, 'eyelid', 0.6, sink * w);
    mx(P, 'breathAmp', 0, w); mx(P, 'breathRate', 0, w); mx(P, 'lookW', 0, w);
    const b = B(e); b.f.pump = 0; b.f.retract = Math.max(b.f.retract, 0.5 * sink * w);
    // (the feet stay where they stood, flat on the ground: the limp body sinks between them, the legs
    // folding out to the sides)
  },
};

export const hooks = {
  pose,
  update,
  actions: {
    hop: leapDef({ height: 0.06, distance: 0.3, crouch: 0.16, push: 0.09, land: 0.34, pitch: 0.7, ext: 0.65, fold: 0.45, reachF: 0.01, arcF: 0.008 }),
    jump: leapDef({ height: 0.22, distance: 1.0, crouch: 0.22, push: 0.12, land: 0.45, pitch: 1.0, ext: 0.55, fold: 0.62, reachF: 0.03, arcF: 0.01 }),
    croak, blink, attack, eat, sit, lie, sleep, drink, hit, death,
  },
};
