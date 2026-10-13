// Action layer for the quadruped engine.
//
// Every frame the layer fills a posture parameter set P (createPostureParams) that the engine reads
// on top of the locomotion. Actions are time-parameterised and blend in / out with weights:
//
//   postures  sit, lie, sleep, death    replace the locomotion until 'stand' (or until the animal is
//                                       asked to move: it stands up first). Cross-fade between them.
//   one-shots jump, attack, hit, eat,   blend over whatever runs underneath (an attack can be
//             drink                     played while galloping), fade in and out.
//   idle      automatic when standing with nothing else running: weight shifts with occasional
//             re-steps, looking around, ear twitches, tail flicks (blinks: the eye rig).
//
// play(name, opts) returns a Promise resolved when the action ends (postures: when the transition
// into the pose is complete; looping actions: when stopped). opts: { target (Vector3), direction
// (Vector3, hit: direction the blow travels), loop, speed (time scale) }. The promise resolves with
// how the action ended: 'done' | 'interrupted' | 'stopped' | 'refused'.
//
// Arbitration (the same rule in every body plan):
//   - a new one-shot interrupts the running one-shots: they fade out over their own fade and resolve
//     'interrupted' (the new one fades in over the same time: a cross-fade);
//   - a one-shot committed to the air (a jump or pounce between push-off and touchdown) cannot be cut:
//     while it runs a new one-shot is refused, except `hit`, which layers over it;
//   - a posture cross-fades from the current posture and ends the running one-shots (except a hit
//     flinch); jump / attack (and hook actions with needsStand) stand the animal up first;
//   - stop(name) ends that action (a posture: the animal stands up); stop() ends every one-shot and
//     posture except death (only play('stand') or stop('death') revives), and never cuts a jump in the
//     air (it lands first);
//   - dead: every one-shot except hit is refused; moving does not stand a dead animal up.
//   Hook one-shots may set overlay: true (a tail swish, a vocalisation): they neither interrupt nor
//   are interrupted by other one-shots.
//
// Species tuning: species.motion.actions = {
//   attack: { style: 'bite-lunge' | 'pounce' | 'charge' | 'headbutt' | 'kick', kick: 'double' | 'rear',
//             kickReach: [back, up] leg lengths ([1, 0.45]) } (play('attack', { kick: 'rear' }) picks
//           the kick per call),
//   eat:    { style: 'tear' | 'graze', dropF, dropH, ahead: mouth ahead of the forefeet (leg lengths, 0.5) },
//   drink:  { dropF, dropH, ahead },
//   jump:   { height (m), distance (m), land: [front, hind] landing crouch, give: landing sink
//             speed handed to the girdle springs (x the body's, 1) },    sleep: { style: 'curl' | 'lateral' },
//   sit / lie / death: { dropF, dropH, ... } overrides of the pose values below,
//   lie / sleep: { down, up: 'front' | 'hind' } which end kneels first / gets up first,
//   idle:   { shift: weight-shift amount (1), restep: false disables idle re-steps },
//   fold:   { front: { z, k, beta } } forelegs folded under the chest when lying (hoofed animals kneel) }
//
// ------------------------------------------------------------------------------------------------
// Species hooks: species.motion.hooks = { actions, update, pose } (all optional). The one place a
// species adds behaviour to the quadruped engine; everything else is data.
//
//   actions: { name: def }  extra actions, or replacements of built-ins of the same name. def =
//     { kind: 'oneshot' | 'posture',
//       start(inst, layer), update(inst, dt, layer) -> true when done, apply(P, w, inst, layer),
//       onLand?(inst, layer)                        (one-shots; apply is called with the faded weight)
//       fadeIn, fadeOut, apply(P, w, inst, layer)   (postures: held until 'stand')
//       fade?: s (one-shot fade in / out, 0.12), airborne?: true (it calls engine.takeOff: no second
//       jump while in the air, fast fade-out), needsStand?: true (a sitting / lying animal stands up
//       first, like jump and attack) }
//     inst: { name, t, w, dur, opts (play options), tune (species.motion.actions[name]), side, ... }
//     The built-in definitions are exported (ONESHOTS, POSTURES) so a species can wrap them.
//   update(P, dt, layer)  every frame after the built-in postures and one-shots have filled P and before
//     finished actions are resolved: body language and style on top of everything (tail by mood,
//     ears, hackles P.furRaise, a walk's head nod, dozing, idle variants that layer.play() actions).
//     It may also steer (engine.wantSpeed / wantHeading). layer: { engine, idle: { w, stepT },
//     postures: [inst], oneshots: [inst], play(name, opts) }.
//   pose(engine, dt)  after the engine has written every bone (legs, head, ears, tail and the species'
//     extra bones): direct bone edits (a twitching snout, independent ear swivels). engine.bone[name]
//     .matrixWorld is world space; keep the change continuous from frame to frame.
//
// Units in P: angles in radians; dropF / dropH are fractions of the girdle height; posture lengths
// (fwd, side, lift, headRaise, neckReach, headLocal) are in engine units, multiplied by cfg.k = size x
// unit (the individual's size relative to the cheetah): a hook that means species metres divides by
// cfg.unit. World points (headPos, legs[i].target) are metres. Helpers: mx(P, key, value, w) blends
// P[key] toward value with weight w; mxLeg(P, i, key, value, w), mxLegs(P, key, front, hind, w);
// mouthGroundTarget(engine, out, pitch, levelFn). Engine state a hook may read: speed, heading, pos,
// phase, gait, legs[i] ({ state, plant, contact, def }), fr (body frames), cfg, params (the
// individual's build params), rand(), input, air.
import * as THREE from 'three';
import { clamp, lerp, smooth, envelope, DEG, tv, angDiff } from './common.js';

const LEG_FIELDS = ['fold', 'sit', 'side', 'tuck', 'reach'];
const KICK_REACH = [1.0, 0.45];

export function createPostureParams() {
  return {
    gaitW: 1, legGait: 1, holdFeet: 0, bodyOmega: 1, speedScale: 1,
    frontH: 0, frontHW: 0, // absolute shoulder-joint height above the ground (m) and its weight
    dropF: 0, dropH: 0, pitch: 0, roll: 0, flex: 0, bend: 0, lift: 0, fwd: 0, side: 0, groundW: 0,
    headW: 0, headPos: new THREE.Vector3(), headLocalW: 0, headLocal: new THREE.Vector3(), headReach: 0,
    headRaise: 0, neckReach: 0, headPitch: 0, headYaw: 0, headRoll: 0, headLimp: 0, headOmega: 1,
    look: null, lookW: 1, jaw: 0, jawOmega: 12,
    legs: [0, 1, 2, 3].map(() => ({ fold: 0, sit: 0, side: 0, spread: 0, tuck: 0, extend: 0, reach: 0, target: new THREE.Vector3() })),
    tailLift: 0, tailGround: 0, tailSide: 0, tailCurl: 0, tailWag: 0, tailIdle: 1, tailStiff: 1,
    earFlat: 0, earTwitch: 1, earSwivel: 0, eyelid: 0, breathRate: 1, breathAmp: 1, furRaise: 0,
  };
}

function resetParams(P) {
  P.gaitW = 1; P.legGait = 1; P.holdFeet = 0; P.bodyOmega = 1; P.speedScale = 1; P.frontH = 0; P.frontHW = 0;
  P.dropF = P.dropH = P.pitch = P.roll = P.flex = P.bend = P.lift = P.fwd = P.side = P.groundW = 0;
  P.headW = P.headLocalW = P.headReach = P.headRaise = P.neckReach = P.headPitch = P.headYaw = P.headRoll = P.headLimp = 0;
  P.headOmega = 1; P.look = null; P.lookW = 1; P.jaw = 0; P.jawOmega = 12;
  for (const l of P.legs) { l.fold = l.sit = l.side = l.spread = l.tuck = l.extend = l.reach = 0; }
  P.tailLift = P.tailGround = P.tailSide = P.tailCurl = P.tailWag = 0; P.tailIdle = 1; P.tailStiff = 1;
  P.earFlat = 0; P.earTwitch = 1; P.earSwivel = 0; P.eyelid = 0; P.breathRate = 1; P.breathAmp = 1; P.furRaise = 0;
}

// P.key = lerp(P.key, value, w)
const mx = (P, k, v, w) => { P[k] += (v - P[k]) * w; };
const mxLeg = (P, i, k, v, w) => { const l = P.legs[i]; l[k] += (v - l[k]) * w; };
const mxLegs = (P, k, vF, vH, w) => { for (let i = 0; i < 4; i++) mxLeg(P, i, k, i < 2 ? vF : vH, w); };

// ------------------------------------------------------------------------------------------------
// Posture poses: value sets applied with the posture weight (a function of time for sequences)
// ------------------------------------------------------------------------------------------------
const POSTURES = {
  // haunches down, forelegs straight, tail on the ground curled to one side
  sit: {
    fadeIn: 1.0, fadeOut: 0.8,
    apply(P, w, inst, L) {
      const o = inst.tune;
      const wH = smooth(0, 0.7, w), wF = smooth(0.25, 1, w);
      mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
      mx(P, 'dropH', o.dropH ?? 1.0, wH); mx(P, 'dropF', o.dropF ?? -0.04, wF);
      // forelegs straight: the shoulders sit at the straight foreleg's height (metacarpus near
      // vertical, radius + humerus at 96 % of their length: just inside the IK's soft reach limit)
      const Lf = L.engine.cfg.legs[0];
      mx(P, 'frontH', o.frontH ?? Lf.M.y + Lf.Lmc * Math.cos(0.6 * Lf.a0) + 0.955 * (Lf.Lh + Lf.Lr), wF); mx(P, 'frontHW', 1, wF);
      mxLegs(P, 'sit', 1, 1, w);
      mx(P, 'tailGround', 1, wH); mx(P, 'tailSide', inst.side * 1.3, wH);
      mx(P, 'headRaise', 0.02, w); mx(P, 'groundW', 1, w); // (full ground fit: the rump rests on the ground)
    },
  },
  // sternal: legs folded, belly down, head up
  lie: {
    fadeIn: 1.3, fadeOut: 1.0,
    apply(P, w, inst) {
      const o = inst.tune;
      let wH = smooth(0.1, 0.9, w), wF = smooth(0, 0.8, w), fF = smooth(0, 0.6, w), fH = fF;
      if (o.down || o.up) {
        // which end goes down / gets up first (tune.down, tune.up: 'front' | 'hind'); horses kneel
        // and rise forelegs first, cattle kneel first but rise hind first. Followed by a spring so a
        // reversal half way through does not jump. (The spring lags the posture weight: the folded
        // legs release behind the rising girdle, which a staging without the lag outran - the foreleg
        // folded up into a Z and its elbow flipped over. The posture therefore ends, and is reported
        // reached, only once these springs have settled: see stageSettled.)
        const lead = inst.target > 0 ? o.down : o.up;
        const a = inst.target > 0 ? smooth(0, 0.6, w) : smooth(0.35, 1, w), b = inst.target > 0 ? smooth(0.35, 1, w) : smooth(0, 0.65, w);
        const tF = lead === 'front' ? a : lead === 'hind' ? b : wF, tH = lead === 'front' ? b : lead === 'hind' ? a : wH;
        const dt = clamp(inst.t - (inst.tk ?? inst.t), 0, 0.1);
        inst.tk = inst.t;
        if (inst.kF === undefined) { inst.kF = tF; inst.kH = tH; inst.vF = 0; inst.vH = 0; }
        const om = 9, st = (x, v, g) => { const a2 = om * om * (g - x) - 2 * om * v; return v + a2 * dt; };
        inst.vF = st(inst.kF, inst.vF, tF); inst.kF += inst.vF * dt;
        inst.vH = st(inst.kH, inst.vH, tH); inst.kH += inst.vH * dt;
        // (held at the ends: a clamped weight keeps no speed, or it stuck there and then kicked)
        if (inst.kF < 0 || inst.kF > 1) { inst.kF = clamp(inst.kF, 0, 1); inst.vF = 0; }
        if (inst.kH < 0 || inst.kH > 1) { inst.kH = clamp(inst.kH, 0, 1); inst.vH = 0; }
        wF = inst.kF; wH = inst.kH; fF = smooth(0, 0.8, wF); fH = smooth(0, 0.8, wH);
      }
      mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
      mx(P, 'dropF', o.dropF ?? 1, wF); mx(P, 'dropH', o.dropH ?? 1, wH);
      for (let i = 0; i < 4; i++) mxLeg(P, i, 'fold', 1, i < 2 ? fF : fH);
      mx(P, 'groundW', 1, w);
      mx(P, 'tailGround', 1, wH); mx(P, 'tailSide', inst.side * 1.0, wH);
      mx(P, 'headRaise', -0.03, w); mx(P, 'breathRate', 0.8, w);
    },
  },
  // lie, then curl (or roll onto the side), head down, eyes closed, slow breathing
  sleep: {
    fadeIn: 1.3, fadeOut: 1.2,
    apply(P, w, inst, L) {
      POSTURES.lie.apply(P, w, inst, L);
      const c = smooth(1.0, 3.0, inst.t) * w;
      const side = inst.side;
      const e = L.engine, cfg = e.cfg;
      if (inst.tune.style === 'lateral') {
        mx(P, 'roll', side * 1.35, c);
        mxLegs(P, 'side', 1, 1, c); mxLegs(P, 'spread', 0.3, 0.3, c);
        mxLegs(P, 'fold', 0, 0, c);
        mx(P, 'bend', side * 0.15, c);
      } else {
        mx(P, 'roll', side * 0.35, c);
        mx(P, 'bend', side * 0.9, c);
        // the tail wraps tightly round the rump and runs forward along the flank on the inside of
        // the curl (tailSide swept it out sideways from the rump instead)
        mx(P, 'tailSide', 0, c); mx(P, 'tailCurl', side * 3.0, c);
      }
      // head resting on the ground beside the forepaws (turned toward the curl)
      const fr = e.fr, s = cfg.k;
      const lat = inst.tune.style === 'lateral';
      const hp = tv().copy(fr.neckBase).addScaledVector(fr.F, cfg.neckLen * (lat ? 0.75 : 0.45)).addScaledVector(fr.Lf, side * cfg.neckLen * (lat ? 0.1 : 0.9));
      // (curled: the head rests on the forepaws, a little above the ground: the neck slopes instead of
      // hanging straight down from the withers with the skull levered 100 deg against it)
      hp.y = e.terrainH(hp.x, hp.z) + (lat ? 0.085 : 0.12) * s;
      P.headPos.lerp(hp, c / Math.max(1e-3, P.headW + c)); mx(P, 'headW', 1, c);
      mx(P, 'headYaw', side * (lat ? 0.1 : 1.1), c); mx(P, 'headPitch', lat ? 0.2 : 0.35, c);
      mx(P, 'headRoll', side * (inst.tune.style === 'lateral' ? 1.2 : 0.5), c); mx(P, 'headLimp', 0.3, c);
      mx(P, 'eyelid', 1, smooth(1.5, 3.2, inst.t) * w);
      mx(P, 'breathRate', 0.45, c); mx(P, 'breathAmp', 1.4, c);
      mx(P, 'earFlat', 0.25, c); mx(P, 'earTwitch', 0.35, c); mx(P, 'tailIdle', 0.1, c);
      mx(P, 'lookW', 0, c);
    },
  },
  // legs buckle, falls on its side, settles on the terrain; stays down until 'stand'
  death: {
    fadeIn: 0.25, fadeOut: 1.6,
    apply(P, w, inst, L) {
      const t = inst.t, side = inst.side, e = L.engine, cfg = e.cfg, s = cfg.k;
      const buckle = smooth(0, 0.35, t);
      const fall = clamp((t - 0.3) / 0.55, 0, 1);
      const fallE = fall * fall; // accelerating topple
      const settle = fall >= 1 ? Math.exp(-(t - 0.85) * 6) * Math.sin((t - 0.85) * 18) * 0.06 : 0;
      // killed on the move: the body carries its momentum (it brakes like the living animal) and the
      // legs keep striding under it while it buckles, folding once it is down (no dragged feet)
      const mv = e.air.active ? 0 : smooth(0.08, 0.45, e.speed / cfg.sk) * (1 - smooth(0.3, 0.7, t));
      mx(P, 'gaitW', 0, w * (1 - mv)); mx(P, 'legGait', 0, w * (1 - mv)); mx(P, 'bodyOmega', 1.6, w);
      const kb = 1 - mv; // (the body does not buckle while the legs still stride under it)
      mx(P, 'dropF', lerp(0.55 * buckle * kb, 1, fallE), w); mx(P, 'dropH', lerp(0.45 * buckle * kb, 1, fallE), w);
      mx(P, 'roll', side * (1.42 * fallE - settle), w);
      mx(P, 'groundW', fallE, w);
      mxLegs(P, 'fold', 0.6 * buckle * (1 - fallE), 0.6 * buckle * (1 - fallE), w);
      mxLegs(P, 'side', fallE, fallE, w); mxLegs(P, 'spread', smooth(0.8, 1.6, t), smooth(0.8, 1.6, t), w);
      // head and neck lie on the terrain
      const fr = e.fr;
      const hp = tv().copy(fr.neckBase).addScaledVector(fr.F, cfg.neckLen * 0.8);
      hp.y = e.terrainH(hp.x, hp.z) + 0.092 * s; // occiput height with the skull on its side (half-width ~7 cm + cheek)
      const hw = smooth(0.35, 1.0, t);
      P.headPos.lerp(hp, hw / Math.max(1e-3, P.headW + hw)); mx(P, 'headW', 1, hw * w);
      mx(P, 'headRoll', side * 1.3, hw * w); mx(P, 'headPitch', 0.15, hw * w); mx(P, 'headLimp', 0.5, hw * w);
      mx(P, 'headOmega', 1.8, w);
      mx(P, 'jaw', 0.1, hw * w); mx(P, 'eyelid', 0.55, smooth(0.2, 1.2, t) * w);
      mx(P, 'tailGround', 1, w); mx(P, 'tailIdle', 0, w); mx(P, 'tailSide', side * 0.6, w); mx(P, 'tailStiff', 0.5, w);
      mx(P, 'breathAmp', 0, w); mx(P, 'breathRate', 0, w);
      mx(P, 'earFlat', 0.4, w); mx(P, 'earTwitch', 0, w); mx(P, 'lookW', 0, w);
    },
  },
};

// ------------------------------------------------------------------------------------------------
// One-shot actions
// ------------------------------------------------------------------------------------------------
function mouthGroundTarget(e, out, pitchA, levelFn, ahead) {
  // occiput position that puts the mouth on the ground (or water) ahead of the forefeet
  const cfg = e.cfg, fr = e.fr;
  const g = tv();
  const FL = e.legs[0], FR = e.legs[1];
  // head frame: yaw = heading, pitch = pitchA (nose down); the lower of mouth and nose touches
  const cp = Math.cos(pitchA), sp = Math.sin(pitchA);
  const qm = cfg.mouthLocal, qn = cfg.noseLocal;
  const ym = qm.y * cp - qm.z * sp, yn = qn.y * cp - qn.z * sp;
  const zm = qm.y * sp + qm.z * cp, zn = qn.y * sp + qn.z * cp;
  // the lower of mouth and nose touches; blended over 1 cm of height difference so the target does
  // not jump from one point to the other as the head pitches (tearing jerks)
  const k = smooth(-0.01 * cfg.k, 0.01 * cfg.k, ym - yn); // 0: mouth lower, 1: nose lower
  const x = lerp(qm.x, qn.x, k), y = lerp(ym, yn, k), z = lerp(zm, zn, k);
  // the mouth `ahead` leg lengths ahead of the forefeet (0.5; nearer, the neck had to fold back under
  // itself to reach it and the head bent 80-140 deg against the neck; a short neck on long legs
  // (wolf) needs more, or the neck hangs vertically with the head levered against it)
  g.copy(FL.plant).add(FR.plant).multiplyScalar(0.5).addScaledVector(fr.F, (ahead ?? 0.5) * cfg.legLen);
  g.y = levelFn(g.x, g.z);
  const sh = Math.sin(e.heading), ch = Math.cos(e.heading);
  out.set(g.x - (x * ch + z * sh), g.y - y + 0.015 * cfg.k, g.z - (-x * sh + z * ch));
  return out;
}

const ONESHOTS = {
  jump: {
    start(inst, L) {
      const e = L.engine, cfg = e.cfg, o = inst.tune;
      inst.run = smooth(1.5, 5, e.speed / cfg.sk);
      inst.tc = lerp(0.3, 0.1, inst.run) * cfg.sk;
      const h = (o.height ?? 0.6 * cfg.unit) * cfg.s * lerp(1, 0.7, inst.run);
      inst.vy = Math.sqrt(2 * 9.81 * h);
      let T = (2 * inst.vy) / 9.81;
      let dist = (o.distance ?? 2.5 * cfg.unit) * cfg.s;
      const target = inst.opts.target;
      if (target) dist = clamp(Math.hypot(target.x - e.pos.x, target.z - e.pos.z), 0.3 * cfg.k, dist * 2);
      // (a target the run-up would overshoot: a lower, shorter flight, down to 0.35x the height)
      if (target && e.speed * T > dist) { T = Math.max(Math.sqrt(0.35) * T, dist / e.speed); inst.vy = 4.905 * T; }
      // the flight covers at least the species' jump distance (or the target's): a run-up slower than
      // that is sped up in the push-off, a faster one carries its speed (a longer, flatter running
      // jump). (It was lerp(distance / T, speed, run): from a trot the jump fell short of a standing
      // jump, and from a canter on the distance was ignored.)
      inst.vh = Math.max(e.speed, dist / T);
      // push-off: the crouched body extends and gains its launch speed over tp before it leaves the
      // ground (an instant launch from the crouch yanked every leg in one frame)
      inst.tp = lerp(0.14, 0.08, inst.run) * cfg.sk;
      inst.v0 = e.speed;
      inst.phase = 'crouch';
      inst.dur = Infinity;
    },
    update(inst, dt, L) {
      const e = L.engine;
      if (inst.phase === 'crouch' && inst.t >= inst.tc) inst.phase = 'push';
      if (inst.phase === 'push') {
        const x = clamp((inst.t - inst.tc) / inst.tp, 0, 1);
        e.speedOverride = lerp(inst.v0, inst.vh, x * x * (3 - 2 * x));
        if (x >= 1) { e.speedOverride = null; inst.phase = 'air'; inst.tAir = inst.t; e.takeOff(inst.vy, inst.vh); }
      }
      if (inst.phase === 'land' && inst.t - inst.tLand > 0.45) return true;
      if (inst.phase === 'air' && inst.t - inst.tAir > 4) { e.touchDown(); }
      return false;
    },
    onLand(inst) { inst.phase = 'land'; inst.tLand = inst.t; },
    apply(P, w, inst, L) {
      const e = L.engine;
      if (inst.phase === 'crouch' || inst.phase === 'push') {
        const c = smooth(0, inst.tc, inst.t) * (1 - inst.run * 0.6);
        // push: from the crouch to an extended body (dropF / dropH < 0 raise the girdles)
        const x = inst.phase === 'push' ? smooth(0, 1, (inst.t - inst.tc) / inst.tp) : 0;
        mx(P, 'dropF', lerp(0.35, -0.1, x), c); mx(P, 'dropH', lerp(0.45, -0.12, x), c); mx(P, 'pitch', lerp(-0.05, 0.12, x), c);
        mx(P, 'bodyOmega', lerp(1, 2.2, x), c);
        // standing: the planted feet stay planted while it pushes off (holdFeet: no catch-up steps
        // either, the legs extend over them); from a run the gait steps on until take-off (held
        // at c (1 - run), a canter's push-off dragged a bear's planted forefoot 45 cm behind)
        if (inst.phase === 'push') { const hold = c * (1 - smooth(0, 0.3, inst.run)); mx(P, 'legGait', 0, hold); mx(P, 'holdFeet', 1, hold); }
        mx(P, 'earFlat', 0.3, c);
      } else if (inst.phase === 'air') {
        const T = (2 * inst.vy) / 9.81, x = clamp((inst.t - inst.tAir) / T, 0, 1);
        const k0 = smooth(0, 0.12, inst.t - inst.tAir);
        // (legGait continues from the push-off, where it was already held down)
        mx(P, 'gaitW', 0, k0); mx(P, 'legGait', 0, Math.max(k0, (1 - inst.run * 0.6) * (1 - smooth(0, 0.3, inst.run))));
        const ext = x < 0.25 ? 1 - smooth(0, 0.25, x) * 0.9 : x < 0.65 ? 0.1 : 0.1 + smooth(0.65, 1, x) * 0.7;
        mxLegs(P, 'tuck', 1, 1, k0);
        for (const l of P.legs) l.extend = ext;
        // body pitch in flight, continuous with the push-off's (0.12 at take-off) and held into the
        // landing (inst.pitchAir): a step in P.pitch moves the girdle-height correction of the body
        // frame, which dropped a horse 3 cm in the touchdown frame (and lifted it at take-off)
        const pf = lerp(0.22, -0.18, smooth(0.1, 0.95, x)) * (1 - inst.run * 0.5);
        inst.pitchAir = lerp(0.12 * (1 - inst.run * 0.6), pf, smooth(0, 0.2, x));
        mx(P, 'pitch', inst.pitchAir, 1);
        mx(P, 'tailLift', 0.25, 1); mx(P, 'headPitch', lerp(-0.1, 0.15, x), 1);
      } else {
        const x = (inst.t - inst.tLand) / 0.45;
        const a = Math.sin(Math.PI * Math.min(1, x * 1.6)) * (1 - x);
        const ld = inst.tune.land || [0.3, 0.25]; // landing crouch [front, hind] (jump tuning: long-legged runners land straighter)
        mx(P, 'dropF', ld[0], a); mx(P, 'dropH', ld[1], a);
        const k = 1 - smooth(0, 0.35, x);
        mxLegs(P, 'tuck', 1, 1, k);
        for (const l of P.legs) l.extend = lerp(l.extend, 0.8, k);
        mx(P, 'legGait', 0, k); mx(P, 'gaitW', 0, k);
        // (the flight's pitch eases out over the landing)
        mx(P, 'pitch', (inst.pitchAir || 0) * (1 - smooth(0, 0.6, x)), 1);
      }
      void e;
    },
  },

  attack: {
    start(inst, L) {
      const e = L.engine, o = inst.tune;
      inst.style = o.style || 'bite-lunge';
      inst.kick = inst.opts.kick || o.kick || 'double'; // play('attack', { kick: 'rear' }) picks per call
      inst.run = smooth(1.5, 4, e.speed / e.cfg.sk);
      if (inst.style === 'pounce' && inst.run > 0.5) inst.style = 'bite-lunge';
      inst.dur = { 'bite-lunge': 0.95, pounce: 1.8, charge: 1.1, headbutt: 1.1, kick: inst.kick === 'rear' ? 1.8 : 1.2 }[inst.style] || 1;
      inst.hitAt = { 'bite-lunge': 0.5, pounce: 0, charge: 0.55, headbutt: 0.55, kick: inst.kick === 'rear' ? 1.05 : 0.5 }[inst.style];
      inst.hit = false;
      inst.target = inst.opts.target ? inst.opts.target.clone() : null;
      if (inst.style === 'pounce') inst.jumped = false;
    },
    update(inst, dt, L) {
      const e = L.engine, cfg = e.cfg;
      if (inst.style === 'pounce' && !inst.jumped && inst.t >= 0.6) {
        inst.jumped = true;
        const h = 0.3 * cfg.k, vy = Math.sqrt(2 * 9.81 * h), T = 2 * vy / 9.81;
        let dist = 1.6 * cfg.k;
        if (inst.target) dist = clamp(Math.hypot(inst.target.x - e.pos.x, inst.target.z - e.pos.z) - 0.35 * cfg.legLen, 0.4 * cfg.k, 3.5 * cfg.k);
        inst.T = T;
        e.takeOff(vy, Math.max(e.speed, dist / T));
      }
      if (inst.style === 'pounce' && inst.landT !== undefined && inst.t - inst.landT > 0.7) return true;
      if (inst.style === 'pounce' && inst.jumped && inst.landT === undefined && inst.t > 4) e.touchDown();
      if (!inst.hit && inst.hitAt && inst.t >= inst.hitAt) this.strike(inst, L);
      return inst.style !== 'pounce' && inst.t >= inst.dur;
    },
    onLand(inst, L) {
      if (inst.style !== 'pounce') return;
      inst.landT = inst.t;
      L.engine.speed *= 0.25; // pins the prey: no run-out
      this.strike(inst, L);
    },
    strike(inst, L) {
      const e = L.engine;
      inst.hit = true;
      let p;
      if (inst.style === 'kick') p = inst.kick === 'rear' ? e.legs[0].contact.clone() : e.legs[2].contact.clone().lerp(e.legs[3].contact, 0.5);
      else p = new THREE.Vector3().copy(e.cfg.mouthLocal).applyQuaternion(e.headPose.quaternion).add(e.headPose.position);
      const dir = inst.target ? inst.target.clone().sub(e.headPose.position).setY(0).normalize() : e.forward(e.heading, new THREE.Vector3());
      if (inst.style === 'kick' && inst.kick !== 'rear') dir.negate();
      e.emit('attackHit', { position: p, direction: dir, style: inst.style });
    },
    apply(P, w, inst, L) {
      const e = L.engine, cfg = e.cfg, fr = e.fr, s = cfg.k, t = inst.t, run = inst.run, still = 1 - run;
      const lookAt = inst.target;
      if (lookAt) { P.look = lookAt; mx(P, 'lookW', 1, w); }
      mx(P, 'earFlat', 1, w * smooth(0, 0.15, t)); mx(P, 'earTwitch', 0, w);
      const reachF = (x, amount, fwd, up) => {
        // forepaws strike ahead (toward the target when given)
        for (let i = 0; i < 2; i++) {
          const leg = e.legs[i], Ld = leg.def, pl = P.legs[i];
          const tp = tv();
          if (lookAt) tp.copy(lookAt).addScaledVector(fr.Lf, Ld.s * Ld.cx * 1.2);
          else e.bodyToWorld(Ld.cx * Ld.s * 1.2, 0, cfg.zS + fwd * Ld.len, e.heading, e.pos, tp);
          tp.y = Math.max(tp.y, e.terrainH(tp.x, tp.z)) + up * Ld.len;
          const k = amount * x;
          pl.target.lerp(tp, k / Math.max(1e-3, pl.reach + k));
          mxLeg(P, i, 'reach', 1, k);
        }
      };
      if (inst.style === 'bite-lunge') {
        const crouch = smooth(0, 0.3, t) * (1 - smooth(0.32, 0.45, t)) * still;
        const lunge = smooth(0.3, 0.48, t) * (1 - smooth(0.6, 0.95, t));
        mx(P, 'dropF', 0.35, crouch * w); mx(P, 'dropH', 0.3, crouch * w); mx(P, 'fwd', -0.06, crouch * w);
        mx(P, 'fwd', 0.22 * (1 - run * 0.5), lunge * w); mx(P, 'neckReach', 0.1, lunge * w); mx(P, 'headRaise', -0.03, lunge * w);
        mx(P, 'jaw', 0.65, w * smooth(0.25, 0.42, t) * (1 - smooth(0.46, 0.52, t)));
        mx(P, 'jawOmega', 30, w);
        mx(P, 'gaitW', 1 - 0.7 * still, w * (crouch + lunge > 0 ? 1 : 0));
        // (tune.paws: false for canids, whose forefeet stay planted while the head and neck drive the
        // bite; felids and rodents reach and grab with the forepaws)
        if (inst.tune.paws === false) {
          const snap = smooth(0.55, 0.7, t) * (1 - smooth(0.75, 0.95, t));
          mx(P, 'neckReach', 0.17, lunge * w); mx(P, 'headRaise', -0.07, lunge * w); mx(P, 'headPitch', 0.18, lunge * w);
          mx(P, 'dropF', 0.18, lunge * w * still); mx(P, 'fwd', -0.05, snap * w * still);
        } else if (still > 0.2) reachF(lunge * w, 0.8 * still, 0.55, 0.35);
      } else if (inst.style === 'pounce') {
        const crouch = smooth(0, 0.35, t) * (inst.jumped ? 0 : 1);
        const wig = inst.jumped ? 0 : Math.sin(t * 28) * smooth(0.25, 0.4, t) * 0.02;
        mx(P, 'dropF', 0.55, crouch * w); mx(P, 'dropH', 0.4, crouch * w); mx(P, 'side', wig, w);
        mx(P, 'headRaise', -0.04, crouch * w); mx(P, 'tailLift', -0.2, crouch * w);
        if (inst.jumped && inst.landT === undefined) {
          const x = clamp((t - 0.6) / (inst.T || 0.5), 0, 1);
          const k0 = smooth(0, 0.12, t - 0.6) * w;
          mx(P, 'gaitW', 0, k0); mx(P, 'legGait', 0, k0);
          mxLeg(P, 2, 'tuck', 1, k0); mxLeg(P, 3, 'tuck', 1, k0);
          P.legs[2].extend = P.legs[3].extend = 1 - smooth(0, 0.4, x);
          reachF(k0, 1, 0.6, lerp(0.35, 0.05, x));
          // (flight pitch, held into the landing: see the jump)
          inst.pitchAir = lerp(0.2, -0.15, x);
          mx(P, 'pitch', inst.pitchAir, w); mx(P, 'jaw', 0.5, w * smooth(0.3, 0.8, x));
        } else if (inst.landT !== undefined) {
          const x = (t - inst.landT) / 0.7;
          const k = 1 - smooth(0.3, 1, x);
          mx(P, 'pitch', (inst.pitchAir || 0) * (1 - smooth(0, 0.4, x)), w);
          reachF(k * w, 1, 0.55, 0);
          mx(P, 'dropF', 0.5, k * w); mx(P, 'dropH', 0.2, k * w);
          mx(P, 'jaw', 0.55 * (1 - smooth(0, 0.15, x)), w); mx(P, 'jawOmega', 30, w);
          mx(P, 'headRaise', -0.06, k * w); mx(P, 'neckReach', 0.06, k * w);
        }
      } else if (inst.style === 'charge' || inst.style === 'headbutt') {
        const low = smooth(0, 0.35, t) * (1 - smooth(0.7, 1.1, t));
        const lunge = smooth(0.35, 0.55, t) * (1 - smooth(0.6, 1.0, t));
        mx(P, 'headPitch', 0.7, low * w); mx(P, 'headRaise', -0.12, low * w); mx(P, 'dropF', 0.2, low * w * still);
        mx(P, 'fwd', 0.3, lunge * w); mx(P, 'neckReach', 0.08, lunge * w);
        mx(P, 'fwd', -0.08, low * (1 - lunge) * w * still);
      } else if (inst.style === 'kick') {
        if (inst.kick === 'rear') {
          const up = smooth(0.1, 0.7, t) * (1 - smooth(1.2, 1.75, t));
          const strike = smooth(0.7, 1.05, t) * (1 - smooth(1.15, 1.65, t));
          mx(P, 'dropF', -1.4, up * w); mx(P, 'dropH', 0.25, up * w); mx(P, 'legGait', 0, up * w); mx(P, 'gaitW', 0, up * w);
          mxLegs(P, 'tuck', 1, 0, up * w);
          for (let i = 0; i < 2; i++) P.legs[i].extend = lerp(0.1, 1, strike);
          mx(P, 'headRaise', 0.1, up * w);
        } else {
          const buck = smooth(0.15, 0.4, t) * (1 - smooth(0.6, 1.1, t));
          const kick = smooth(0.35, 0.5, t) * (1 - smooth(0.6, 0.9, t));
          mx(P, 'dropF', 0.15, buck * w); mx(P, 'dropH', -0.25, buck * w); mx(P, 'headPitch', 0.4, buck * w);
          for (let i = 2; i < 4; i++) {
            const leg = e.legs[i], Ld = leg.def, pl = P.legs[i];
            // (tune.kickReach: [back, up] in leg lengths behind the hip / above the ground)
            const kr = inst.tune.kickReach || KICK_REACH;
            const tp = e.bodyToWorld(Ld.cx * Ld.s, 0, cfg.zH - Ld.len * kr[0], e.heading, e.pos, tv());
            tp.y = e.terrainH(tp.x, tp.z) + Ld.len * kr[1];
            pl.target.copy(tp);
            mxLeg(P, i, 'reach', 1, kick * w);
          }
          mx(P, 'legGait', 0.4, buck * w);
        }
      }
      void s;
    },
  },

  hit: {
    start(inst, L) {
      const e = L.engine;
      const d = inst.opts.direction ? inst.opts.direction.clone().setY(0) : e.forward(e.heading, new THREE.Vector3()).negate();
      if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
      d.normalize();
      inst.dir = d;
      inst.dur = 0.75;
      // body-local components: + left, + forward
      inst.lx = d.dot(e.left(e.heading, new THREE.Vector3()));
      inst.lz = d.dot(e.forward(e.heading, new THREE.Vector3()));
      e.push.addScaledVector(d, 0.9 * e.cfg.sk * (inst.opts.strength ?? 1));
    },
    update(inst) { return inst.t >= inst.dur; },
    apply(P, w, inst) {
      const t = inst.t;
      // recoil: peak at ~0.12 s, a held 35 % until 0.3 s, then decays (continuous: the old
      // sin-then-exp form jumped from 0 to 0.35 at t = 0.3 s)
      const f = smooth(0, 0.12, t) * (t < 0.12 ? 1 : 0.35 + 0.65 * Math.exp(-(t - 0.12) / 0.06)) * Math.exp(-Math.max(0, t - 0.3) * 6);
      const k = f * w;
      mx(P, 'roll', inst.lx * 0.16, k); mx(P, 'bend', -inst.lx * 0.25, k);
      mx(P, 'pitch', inst.lz * 0.08, k); mx(P, 'dropF', 0.18, k); mx(P, 'dropH', 0.12, k);
      P.headLocal.set(inst.lx * 0.06, 0.02, inst.lz * 0.06 - 0.03); mx(P, 'headLocalW', 1, k);
      mx(P, 'headYaw', -inst.lx * 0.35, k); mx(P, 'headPitch', -0.15, k);
      mx(P, 'earFlat', 1, w * (1 - smooth(0.4, 0.75, t))); mx(P, 'eyelid', 0.7, k);
      mx(P, 'jaw', 0.18, k); mx(P, 'tailLift', -0.15, k);
    },
  },

  eat: {
    start(inst, L) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 6); inst.fade = 0.8; },
    update(inst) { return inst.t >= inst.dur; },
    apply(P, w, inst, L) { applyGround(P, w, inst, L, 'eat'); },
  },
  drink: {
    start(inst, L) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 5); inst.fade = 0.8; },
    update(inst) { return inst.t >= inst.dur; },
    apply(P, w, inst, L) { applyGround(P, w, inst, L, 'drink'); },
  },
};

function applyGround(P, w, inst, L, kind) {
  const e = L.engine, t = inst.t, o = inst.tune;
  const water = e.water;
  const level = kind === 'drink' && water ? (x, z) => { const wl = water(x, z); const g = e.terrainH(x, z); return Number.isFinite(wl) ? Math.max(g, wl) : g; } : (x, z) => e.terrainH(x, z);
  let pitchA = o.pitch ?? 1.3; // nose down, roughly in line with the lowered neck (tune.pitch: rad from the head's bind pose)
  let bob = 0, jaw = 0, yaw = 0;
  if (kind === 'eat') {
    if ((o.style || 'tear') === 'graze') {
      // grazing: bite, a small pull, chew with the head down
      const c = (t * 0.9) % 1;
      bob = -0.02 * Math.sin(Math.PI * smooth(0, 0.25, c));
      jaw = 0.12 + 0.1 * Math.sin(t * 9.5);
      yaw = 0.12 * Math.sin(t * 0.7);
    } else {
      // predators: tearing jerks (pull up and back, twist), jaw clamps, then reset
      const c = (t * 0.75) % 1;
      const jerk = smooth(0.35, 0.5, c) * (1 - smooth(0.6, 0.95, c));
      bob = 0.07 * jerk;
      pitchA -= 0.35 * jerk;
      jaw = 0.05 + 0.3 * smooth(0, 0.15, c) * (1 - smooth(0.25, 0.4, c));
      yaw = 0.25 * jerk * Math.sin(Math.floor(t * 0.75) * 2.3);
    }
  } else {
    // lapping
    jaw = 0.1 + 0.08 * Math.max(0, Math.sin(t * 3 * 6.283));
    bob = 0.006 * Math.sin(t * 3 * 6.283);
    pitchA = o.pitch ?? 1.3;
  }
  const hp = mouthGroundTarget(e, tv(), pitchA, level, o.ahead);
  hp.y += bob * e.cfg.k;
  P.headPos.copy(hp);
  const k = w;
  mx(P, 'headW', 1, k); mx(P, 'headReach', 1, k); mx(P, 'headPitch', pitchA, k); mx(P, 'headYaw', yaw, k);
  mx(P, 'lookW', 0, k); mx(P, 'headOmega', 2.2, k);
  mx(P, 'jaw', jaw, k); mx(P, 'jawOmega', 25, k);
  mx(P, 'gaitW', 0, k);
  mx(P, 'dropF', o.dropF ?? 0.1, k); mx(P, 'dropH', o.dropH ?? 0, k);
  mx(P, 'earTwitch', 1.5, k);
  mx(P, 'speedScale', 0, k);
  void L;
}

// in-place filter (no per-frame allocation)
function compact(arr, keep) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i];
  arr.length = j;
}
// a staged kneel (POSTURES.lie with tune.down / up) has settled when its fore / hind springs have
// reached the posture's end (1 lying, 0 standing) and stopped: the posture ends, and is reported
// reached, only then (released earlier, the springs' last few per cent of the lying drop and of the
// folded legs vanished in one frame: a pop of the forelegs as a cow finished getting up)
const stageSettled = (p) => p.kF === undefined || ((p.target > 0 ? 2 - p.kF - p.kH : p.kF + p.kH) < 2e-3 && Math.abs(p.vF) + Math.abs(p.vH) < 2e-2);
const keepPosture = (p) => p.target > 0 || p.w > 0 || !stageSettled(p);
const keepOneshot = (a) => !(a.stopping && a.w <= 0);
const isHolding = (p) => p.target > 0 || p.w > 0.02;
const isRunning = (a) => !a.stopping;
const isTargeted = (p) => p.target > 0;
const isBusy = (a) => !a.stopping && a.name !== 'hit';
const isAirborneAction = (a) => a.name === 'jump' || a.name === 'attack' || !!a.airborne;
const isDead = (p) => p.name === 'death' && p.target > 0;

// ------------------------------------------------------------------------------------------------
export class ActionLayer {
  constructor(engine) {
    this.engine = engine;
    this.tuning = engine.cfg.actions || {};
    this.names = ['idle', 'jump', 'sit', 'lie', 'sleep', 'eat', 'drink', 'attack', 'hit', 'death', 'stand'];
    // species actions (species.motion.hooks.actions): { name: { kind: 'oneshot' | 'posture', airborne?,
    // needsStand?, fade?, start, update, apply, onLand } }; they may replace built-ins of the same name
    this.hooks = engine.hooks || {};
    this.oneshotDefs = { ...ONESHOTS };
    this.postureDefs = { ...POSTURES };
    for (const [n, d] of Object.entries(this.hooks.actions || {})) {
      if (d.kind === 'posture') this.postureDefs[n] = d; else this.oneshotDefs[n] = d;
      if (!this.names.includes(n)) this.names.push(n);
    }
    this.postures = []; // { name, t, w, target, fadeIn, fadeOut, resolve, side }
    this.oneshots = []; // { name, t, dur, w, stopping, resolve }
    this.posture = 'stand';
    this.standReq = null;
    this.idle = { t: 0, lookT: 0, look: new THREE.Vector3(), hasLook: false, stepT: 4, w: 0, shiftPh: 0 };
  }

  holdsStill() {
    return this.postures.some(isHolding);
  }
  dead() { return this.postures.some(isDead); }
  // automatic stand-up (the animal is asked to move): never revives a dead animal
  requestStand() { if (!this.standReq && !this.dead()) this.play('stand'); }
  // a one-shot committed to the air (between push-off and touchdown): not interrupted, not stopped
  committed(a) {
    const e = this.engine;
    return !a.stopping && ((e.air.active && isAirborneAction(a)) || (a.name === 'jump' && a.phase === 'push'));
  }
  // end a one-shot: it fades out, then its promise resolves with the reason
  end(a, reason) {
    if (a.stopping) return;
    a.stopping = true; a.reason = reason;
    this.oneshotDefs[a.name]?.end?.(a, this);
  }
  current() {
    const o = this.oneshots.find(isRunning);
    if (o) return o.name;
    const p = this.postures.find(isTargeted);
    return p ? p.name : this.standReq ? 'stand' : null;
  }
  clear() {
    for (const a of [...this.postures, ...this.oneshots]) { a.resolve?.('stopped'); a.resolveIn?.('stopped'); }
    this.postures.length = 0; this.oneshots.length = 0;
  }

  play(name, opts = {}) {
    const e = this.engine;
    if (name === 'idle') name = 'stand';
    if (name === 'stand') {
      if (!this.postures.length) return Promise.resolve('done');
      for (const p of this.postures) { if (p.target > 0) { p.target = 0; p.resolveIn?.('interrupted'); } }
      e.emit('actionStart', { name: 'stand' });
      if (this.standReq) return this.standReq.promise;
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      this.standReq = { promise, resolve };
      return promise;
    }
    if (this.postureDefs[name]) {
      const cur = this.postures.find((p) => p.target > 0);
      if (cur && cur.name === 'death' && name !== 'death') return Promise.resolve('refused');
      if (cur && cur.name === name) return cur.promiseIn;
      // (in the air only death is taken: the jump lands first, the body collapses as it comes down)
      if (name !== 'death' && this.oneshots.some((a) => this.committed(a))) return Promise.resolve('refused');
      for (const p of this.postures) { if (p.target > 0) { p.target = 0; p.resolveIn?.('interrupted'); } }
      if (this.standReq) { this.standReq.resolve('interrupted'); this.standReq = null; }
      // one-shots other than hit end when the animal lies down
      for (const a of this.oneshots) if (a.name !== 'hit' && !this.committed(a) && !this.oneshotDefs[a.name]?.overlay) this.end(a, 'interrupted');
      const def = this.postureDefs[name];
      let side = opts.side ?? (e.rand() < 0.5 ? -1 : 1);
      if (opts.direction && name === 'death') {
        // fall away from the blow
        const d = opts.direction;
        side = (d.x * Math.cos(e.heading) - d.z * Math.sin(e.heading)) > 0 ? -1 : 1;
      }
      // continue a lying curl side when going lie -> sleep
      const prev = this.postures.find((p) => p.name === 'lie' || p.name === 'sleep');
      if (prev && opts.side === undefined) side = prev.side;
      const inst = { name, t: 0, w: 0, target: 1, fadeIn: def.fadeIn / (opts.speed || 1), fadeOut: def.fadeOut, side, opts, tune: this.tuning[name] || {}, reached: false };
      // a posture of the same family keeps its time (lie -> sleep keeps lying)
      if (prev && name === 'sleep') {
        inst.w = prev.w; prev.w = 0; prev.target = 0; this.postures = this.postures.filter((p) => p !== prev);
        // (the staged kneel carries on: its springs' state, see POSTURES.lie)
        if (prev.kF !== undefined) { inst.kF = prev.kF; inst.kH = prev.kH; inst.vF = prev.vF; inst.vH = prev.vH; }
      }
      inst.promiseIn = new Promise((r) => { inst.resolveIn = r; });
      this.postures.push(inst);
      e.emit('actionStart', { name });
      if (name === 'death') e.emit('death', { position: e.pos.clone() });
      return inst.promiseIn;
    }
    const def = this.oneshotDefs[name];
    if (!def) return Promise.reject(new Error(`procedural-animals: unknown action "${name}"`));
    if (this.dead() && name !== 'hit') return Promise.resolve('refused');
    const leaves = name === 'jump' || name === 'attack' || !!def.airborne || !!def.needsStand;
    if (this.holdsStill() && leaves) return this.play('stand').then((r) => (r === 'refused' ? r : this.play(name, opts)));
    // arbitration: a new one-shot interrupts the running ones (overlays excepted); nothing but a hit
    // is taken while a one-shot is committed to the air
    if (this.oneshots.some((a) => this.committed(a))) { if (name !== 'hit') return Promise.resolve('refused'); }
    else if (!def.overlay) for (const a of this.oneshots) if (!this.oneshotDefs[a.name]?.overlay || a.name === name) this.end(a, 'interrupted');
    for (const a of this.oneshots) if (a.name === name) this.end(a, 'interrupted');
    const inst = { name, t: 0, w: 0, dur: 1, stopping: false, opts, tune: this.tuning[name] || {}, fade: def.fade ?? 0.12, speed: opts.speed || 1, airborne: !!def.airborne };
    def.start(inst, this);
    inst.promise = new Promise((r) => { inst.resolve = r; });
    this.oneshots.push(inst);
    e.emit('actionStart', { name });
    return inst.promise;
  }

  stop(name) {
    for (const a of this.oneshots) if ((!name || a.name === name) && !this.committed(a)) this.end(a, 'stopped');
    if (!name || this.postureDefs[name]) {
      if (this.postures.some((p) => p.target > 0 && (name ? p.name === name : p.name !== 'death'))) this.play('stand');
    }
  }

  onLand() {
    for (const a of this.oneshots) if (this.oneshotDefs[a.name].onLand) this.oneshotDefs[a.name].onLand(a, this);
  }

  update(dt) {
    const e = this.engine, P = e.P;
    resetParams(P);
    // ---- postures
    for (const p of this.postures) {
      p.t += dt;
      const rate = p.target > p.w ? 1 / p.fadeIn : 1 / p.fadeOut;
      p.w = clamp(p.w + clamp(p.target - p.w, -rate * dt, rate * dt), 0, 1);
      if (!p.reached && p.target > 0 && p.w >= 1 && (p.name !== 'death' || p.t > 1.6) && (p.name !== 'sleep' || p.t > 3.2) && stageSettled(p)) { p.reached = true; p.resolveIn('done'); e.emit('actionEnd', { name: p.name }); }
    }
    compact(this.postures, keepPosture);
    const active = this.postures.find(isTargeted);
    this.posture = active ? (active.name === 'death' ? 'dead' : active.name) : this.postures.length ? 'standing-up' : 'stand';
    if (this.standReq && !this.postures.length) { this.standReq.resolve('done'); this.standReq = null; e.emit('actionEnd', { name: 'stand' }); }

    // ---- idle (automatic when standing still with nothing else running)
    const still = e.speed < 0.05 * e.cfg.sk && !e.input.follow;
    const idleTarget = still && !this.postures.length && !this.oneshots.some(isBusy) ? 1 : 0;
    const id = this.idle;
    id.w += clamp(idleTarget - id.w, -dt * 1.5, dt * 0.7);
    this.applyIdle(P, id.w, dt);

    // ---- postures (smoothstepped weights)
    for (const p of this.postures) {
      const w = p.w * p.w * (3 - 2 * p.w);
      this.postureDefs[p.name].apply(P, w, p, this);
    }
    // ---- one-shots
    const wantsToMove = e.wantSpeed > 0.05 || !!e.input.follow;
    for (const a of this.oneshots) {
      if (wantsToMove && (a.name === 'eat' || a.name === 'drink')) this.end(a, 'interrupted');
      a.t += dt * a.speed;
      const def = this.oneshotDefs[a.name];
      if (!a.stopping && def.update(a, dt * a.speed, this)) this.end(a, 'done');
      // (a jump that has landed ends fast; one interrupted early fades out like any other)
      const fadeIn = a.fade, fadeOut = (a.name === 'jump' || a.airborne) && a.reason === 'done' ? 0.05 : a.fade;
      if (a.stopping) a.w = Math.max(0, a.w - dt / fadeOut);
      else a.w = Math.min(1, a.w + dt / fadeIn);
      const w = a.w * a.w * (3 - 2 * a.w);
      if (w > 0) def.apply(P, w, a, this);
    }
    // species hook: style / behaviour layer on top of everything (may also steer e.wantSpeed / wantHeading)
    if (this.hooks.update) this.hooks.update(P, dt, this);
    for (const a of this.oneshots) {
      if (a.stopping && a.w <= 0) { a.resolve(a.reason || 'done'); e.emit('actionEnd', { name: a.name, reason: a.reason || 'done' }); }
    }
    compact(this.oneshots, keepOneshot);
    if (e.air.active && !this.oneshots.some(isAirborneAction)) e.touchDown();
  }

  applyIdle(P, w, dt) {
    const e = this.engine, id = this.idle, cfg = e.cfg;
    // offsets from idle re-steps relax back once the animal moves
    if (w < 0.5) { for (const leg of e.legs) leg.idleOff.multiplyScalar(Math.exp(-dt * 4)); }
    if (w <= 0.001) { id.hasLook = false; return; }
    id.t += dt;
    // weight shift: slow sway of the body over the feet
    id.shiftPh += dt * 0.23;
    const sh = Math.sin(id.shiftPh * 6.283) * 0.6 + Math.sin(id.shiftPh * 6.283 * 0.37 + 1.1) * 0.4;
    const it = this.tuning.idle || {}, ka = it.shift ?? 1;
    mx(P, 'side', 0.012 * sh * ka, w); mx(P, 'roll', -0.02 * sh * ka, w); mx(P, 'dropH', (0.02 + 0.015 * sh) * ka, w);
    // occasional re-step: nudge one foot's neutral position, the gait engine steps it
    id.stepT -= dt;
    if (id.stepT <= 0 && w > 0.9 && it.restep !== false) {
      id.stepT = 5 + e.rand() * 9;
      const leg = e.legs[Math.floor(e.rand() * 4)];
      const s = cfg.k;
      if (leg.idleOff.lengthSq() > 1e-6) leg.idleOff.set(0, 0, 0);
      else leg.idleOff.set((e.rand() - 0.5) * 0.05 * s, 0, (e.rand() < 0.5 ? -1 : 1) * (0.09 + e.rand() * 0.03) * s);
    }
    // look around at random points (unless the game asked the animal to look at something)
    if (!e.input.look) {
      id.lookT -= dt;
      if (id.lookT <= 0) {
        id.lookT = 1.4 + e.rand() * 2.8;
        if (e.rand() < 0.3) id.hasLook = false;
        else {
          const a = e.heading + (e.rand() - 0.5) * 2.4;
          const d = (6 + e.rand() * 10) * cfg.k;
          const px = e.pos.x + Math.sin(a) * d, pz = e.pos.z + Math.cos(a) * d;
          id.look.set(px, e.terrainH(px, pz) + (0.1 + e.rand() * 0.9) * cfg.k, pz);
          id.hasLook = true;
        }
      }
      if (id.hasLook) { P.look = id.look; P.lookW = w; }
    }
  }
}

export { angDiff, DEG, lerp, envelope, LEG_FIELDS, mx, mxLeg, mxLegs, mouthGroundTarget, ONESHOTS, POSTURES };
