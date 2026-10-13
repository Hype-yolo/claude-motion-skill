// Lion behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js).
//
//   actions   roar     idle variant: a bout of 2 long moans then a run of grunts; the neck stretches,
//                      head up and forward, jaw wide, the belly and flanks pump with every call
//             yawn     huge gape showing the canines, head tipped up, eyes shut, ears back
//             attack   stalk -> charge -> pounce -> grab: a crouched creep with the head low in line
//                      with the back and the tail tip twitching, a short burst to a gallop, a leap
//                      with the forelegs reaching out, then the forepaws grab high (the prey's
//                      shoulders) while the hind feet stay down and the bite goes to the neck
//                      (attackHit at the mouth). Played while running it skips the stalk.
//             eat      lying sternal over the food between the forepaws, tearing jerks with a twist
//             death    the core collapse, eased in over 0.45 s
//   pose      the whisker fans sweep back and lift clear of the ground (and lie back when lying)
//   update    the heavy walk (head low, a nod at each forefoot contact), lapping at ~1.8 Hz when
//             drinking, tail-tip flick bursts (irritated, lying, stalking), and the idle life: lions
//             rest ~20 h a day, so a lion left standing lies down (sphinx) after 12-27 s, later
//             stretches out on its side to sleep, and after a long sleep gets up again; roars and yawns now and
//             then, standing or lying. `animal.motion.idleVariants = false` turns the automatic
//             resting and calls off; `animal.motion.input.roar = true` asks for a roar.
//
// Posture lengths the engine multiplies by cfg.k (fwd, side, headRaise, neckReach) are given in
// cheetah-reference units like the core's own actions.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tqa, angDiff } from '../../core/motion/common.js';
import { whiskerSamples, WHISKER_BASE_F, WHISKER_TIP_F } from './whiskers.js';
import { fe } from './rig.js';
import { mx, mxLeg, mxLegs, POSTURES } from '../../core/motion/actions.js';

const sm = (w) => w * w * (3 - 2 * w);
const _lat = new THREE.Vector3();
const busy = (L) => L.oneshots.some((a) => !a.stopping && a.name !== 'hit');

function S(e) {
  if (!e._lion) {
    e._lion = {
      idleT: 0, restAt: 12 + e.rand() * 15, variantIn: 9 + e.rand() * 8,
      auto: null, autoT: 0, nextIn: 30, lieT: 0,
      burst: 0, burstT: 0,
    };
  }
  return e._lion;
}

// ------------------------------------------------------------------------------------------------
// roar: 2 long moans, then 8-14 grunts slowing down; v(t) is the vocal effort 0..1
const ROAR = {
  kind: 'oneshot', fade: 0.6,
  start(inst, L) {
    const e = L.engine;
    inst.n = 8 + Math.floor(e.rand() * 7);
    inst.calls = [[0.7, 1.7], [2.2, 3.3]];
    let t = 3.9;
    for (let i = 0; i < inst.n; i++) { const d = 0.32 + 0.02 * i; inst.calls.push([t, t + d * 0.55]); t += d; }
    inst.dur = t + 0.6;
    e.emit('vocalize', { kind: 'roar' });
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst) {
    const t = inst.t;
    let v = 0;
    for (const [a, b] of inst.calls) {
      if (t < a - 0.2 || t > b + 0.3) continue;
      const long = b - a > 0.5;
      v = Math.max(v, smooth(a - (long ? 0.2 : 0.06), a + (long ? 0.25 : 0.06), t) * (1 - smooth(b - (long ? 0.2 : 0.05), b + (long ? 0.3 : 0.12), t)) * (long ? 1 : 0.7));
    }
    const pose = smooth(0, 0.6, t) * (1 - smooth(inst.dur - 0.7, inst.dur, t)) * w;
    mx(P, 'lookW', 0, pose);
    // neck stretched forward, head up, nose up
    // (a wide gape, ~47 deg on the long moans: side_roar_male5; 0.65 rad read as a pant)
    mx(P, 'neckReach', 0.05, pose); mx(P, 'headRaise', 0.035, pose); mx(P, 'headPitch', -0.3 - 0.16 * v, pose);
    mx(P, 'jaw', 0.1 + 0.72 * v, pose); mx(P, 'jawOmega', 16, pose);
    // belly and flanks contract with every call (spine arches, chest drops a little)
    P.flex += 0.07 * v * pose;
    P.dropF += 0.06 * v * pose;
    mx(P, 'breathAmp', 0.2, pose);
    mx(P, 'earFlat', 0.35, pose); mx(P, 'earTwitch', 0, pose);
    mx(P, 'eyelid', 0.4 * v, pose);
    mx(P, 'tailLift', 0.12 * v, pose);
  },
};

// yawn: gape up to ~1 rad (the canines show), head tipped up and eyes closed
const YAWN = {
  kind: 'oneshot', fade: 0.4,
  start(inst, L) { inst.dur = 3.4 + L.engine.rand() * 0.6; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst) {
    const t = inst.t, D = inst.dur;
    const open = smooth(0.35, 1.4, t) * (1 - smooth(D - 1.2, D - 0.35, t));
    const pose = smooth(0, 0.8, t) * (1 - smooth(D - 0.9, D, t)) * w;
    mx(P, 'lookW', 0, pose);
    mx(P, 'headPitch', -0.3 - 0.12 * open, pose); mx(P, 'headRaise', 0.02, pose); mx(P, 'neckReach', -0.015, pose);
    mx(P, 'jaw', 0.05 + 0.95 * open, pose); mx(P, 'jawOmega', 7, pose);
    mx(P, 'eyelid', 0.9 * open, pose);
    mx(P, 'earFlat', 0.7 * open, pose); mx(P, 'earTwitch', 0, pose);
    mx(P, 'breathAmp', 2.2, pose * open); mx(P, 'breathRate', 0.4, pose);
  },
};

// ------------------------------------------------------------------------------------------------
// attack: stalk -> charge -> pounce -> grab and neck bite
const T_STALK = 1.7, T_CHARGE = 1.1, T_GRAB = 1.2;
const reachF = (P, e, x, fwd, up, target) => {
  // forepaws reach ahead (toward the target when given); up / fwd in leg lengths
  const cfg = e.cfg, fr = e.fr;
  for (let i = 0; i < 2; i++) {
    const leg = e.legs[i], Ld = leg.def, pl = P.legs[i];
    const tp = tv();
    if (target) tp.copy(target).addScaledVector(fr.Lf, Ld.s * Ld.cx * 1.3);
    else e.bodyToWorld(Ld.cx * Ld.s * 1.3, 0, cfg.zS + fwd * Ld.len, e.heading, e.pos, tp);
    tp.y = Math.max(tp.y, e.terrainH(tp.x, tp.z)) + up * Ld.len;
    pl.target.lerp(tp, x / Math.max(1e-3, pl.reach + x));
    mxLeg(P, i, 'reach', 1, x);
  }
};
const ATTACK = {
  kind: 'oneshot', airborne: true, fade: 0.25,
  start(inst, L) {
    const e = L.engine, cfg = e.cfg;
    inst.run = smooth(1.5, 4, e.speed / cfg.sk);
    inst.target = inst.opts.target ? inst.opts.target.clone() : null;
    inst.phase = inst.run > 0.5 ? 'charge' : 'stalk';
    inst.tPhase = 0;
    inst.v0 = e.speed;
    inst.vStalk = 0.45 * cfg.sq;
    inst.vCharge = Math.max(e.speed, 8.5 * cfg.sq);
    inst.dur = Infinity;
    inst.hit = false;
    inst.env = 1;
  },
  update(inst, dt, L) {
    const e = L.engine, cfg = e.cfg;
    const tp = inst.t - inst.tPhase;
    if (inst.target && (inst.phase === 'stalk' || inst.phase === 'charge')) e.wantHeading = Math.atan2(inst.target.x - e.pos.x, inst.target.z - e.pos.z);
    if (inst.phase === 'stalk') {
      // creep: speed eases up to the stalk speed and back down before the burst
      e.wantSpeed = inst.vStalk * (1 - smooth(T_STALK - 0.5, T_STALK, tp) * 0.5);
      if (tp >= T_STALK) { inst.phase = 'charge'; inst.tPhase = inst.t; inst.v0 = e.speed; }
    } else if (inst.phase === 'charge') {
      // burst: ~9 m/s^2 up to the charge speed, then leap (at the target's distance when given)
      e.wantSpeed = inst.vCharge;
      let leap = tp >= T_CHARGE && e.speed > 0.9 * inst.vCharge || tp > T_CHARGE + 0.6;
      if (inst.target) {
        const d = Math.hypot(inst.target.x - e.pos.x, inst.target.z - e.pos.z);
        leap = (tp > 0.35 && d < 0.55 * e.speed + 0.8 * cfg.legLen) || tp > 3;
      }
      if (leap) {
        const h = 0.32 * cfg.s, vy = Math.sqrt(2 * 9.81 * h);
        inst.T = (2 * vy) / 9.81;
        inst.phase = 'air'; inst.tPhase = inst.t;
        e.takeOff(vy, e.speed);
      }
    } else if (inst.phase === 'air') {
      if (tp > 3) e.touchDown();
    } else if (inst.phase === 'grab') {
      e.speedOverride = tp < 0.8 ? inst.vLand * Math.exp(-tp / 0.14) : null;
      if (!inst.hit && tp > 0.25) {
        inst.hit = true;
        const p = new THREE.Vector3().copy(cfg.mouthLocal).applyQuaternion(e.headPose.quaternion).add(e.headPose.position);
        const dir = inst.target ? inst.target.clone().sub(e.headPose.position).setY(0).normalize() : e.forward(e.heading, new THREE.Vector3());
        e.emit('attackHit', { position: p, direction: dir, style: 'pounce' });
      }
      if (tp >= T_GRAB) return true;
    }
    return false;
  },
  onLand(inst, L) {
    if (inst.phase !== 'air') return;
    const e = L.engine;
    inst.phase = 'grab'; inst.tPhase = inst.t;
    inst.vLand = e.speed; // the prey stops it: a hard brake, no run-out (see update)
    S(e).brake = true;
  },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t, tp = t - inst.tPhase;
    const target = inst.target;
    if (target) { P.look = target; mx(P, 'lookW', 1, w); }
    mx(P, 'earTwitch', 0, w);
    // the stalking crouch: belly low, shoulders (scapulae) up, head low in line with the back, eyes
    // fixed forward, tail low and stiff; it eases in over the stalk and out over the first half
    // second of the charge (continuous across the switch)
    const crouch = (c) => {
      mx(P, 'dropF', 0.4, c); mx(P, 'dropH', 0.38, c);
      mx(P, 'headRaise', -0.1, c); mx(P, 'headPitch', -0.08, c); mx(P, 'neckReach', 0.03, c);
      mx(P, 'earFlat', -0.15, c);
      mx(P, 'tailLift', -0.25, c); mx(P, 'tailStiff', 1.3, c);
      mx(P, 'lookW', 0, c * (target ? 0 : 1));
    };
    if (inst.phase === 'stalk') {
      crouch(smooth(0, 0.6, tp) * w);
    } else if (inst.phase === 'charge') {
      const k = w * smooth(0, 0.4, tp + inst.run);
      mx(P, 'headRaise', -0.06, k); mx(P, 'earFlat', 0.45, k); mx(P, 'tailLift', 0.25, k);
      crouch((1 - smooth(0, 0.5, tp)) * (1 - inst.run) * w);
    } else if (inst.phase === 'air') {
      const x = clamp(tp / (inst.T || 0.5), 0, 1);
      const k0 = smooth(0, 0.12, tp) * w;
      mx(P, 'headRaise', -0.06, w); mx(P, 'tailLift', 0.25, w); // (the charge's carriage, carried on)
      mx(P, 'gaitW', 0, k0); mx(P, 'legGait', 0, k0);
      mxLeg(P, 2, 'tuck', 1, k0); mxLeg(P, 3, 'tuck', 1, k0);
      // (blended by the phase weight like every other posture value: set outright, the gait took the leg
      // back in one step when the grab faded, a 94 rad/s* pop of the metatarsus)
      for (const i of [2, 3]) P.legs[i].extend = lerp(P.legs[i].extend || 0, 1 - smooth(0, 0.4, x), k0);
      // (a reach out and a little up: 0.45 leg lengths up stretched the armpits > 3x)
      reachF(P, e, k0, 0.58, lerp(0.28, 0.18, x), null);
      const k1 = smooth(0, 0.2, tp) * w;
      mx(P, 'pitch', lerp(0.18, -0.12, x), k1);
      mx(P, 'jaw', 0.55, w * smooth(0.2, 0.7, x)); mx(P, 'jawOmega', 20, w);
      mx(P, 'earFlat', 0.7, w); mx(P, 'tailLift', 0.35, lerp(1, k1, 0.5 * (1 - inst.run)));
      mx(P, 'headRaise', 0.02, k1); mx(P, 'headPitch', -0.15, k1);
    } else if (inst.phase === 'grab') {
      // forepaws hook the prey's shoulders (high and ahead), hind feet planted, bite to the neck
      // (the flight pose carries over into the landing: tucked hind legs come down, the forepaws
      // go on reaching, and rise from the flight's reach to the grab)
      const land = 1 - smooth(0, 0.3, tp);
      const g = Math.max(land, smooth(0, 0.25, tp)) * (1 - smooth(T_GRAB - 0.7, T_GRAB, tp));
      const k = g * w;
      reachF(P, e, k, lerp(0.58, 0.48, 1 - land), lerp(0.18, 0.13, smooth(0, 0.35, tp)), null);
      mxLeg(P, 2, 'tuck', 1, land * w); mxLeg(P, 3, 'tuck', 1, land * w);
      for (const i of [2, 3]) P.legs[i].extend = lerp(P.legs[i].extend || 0, 0.8 * smooth(0, 0.3, tp), land * w);
      mx(P, 'legGait', 0, k); mx(P, 'gaitW', 0, k);
      const kr = w * smooth(0, 0.35, tp) * (1 - smooth(T_GRAB - 0.7, T_GRAB, tp));
      mx(P, 'pitch', -0.12, k);
      mx(P, 'headRaise', 0.02, w * land); mx(P, 'headPitch', -0.15, w * land); mx(P, 'tailLift', 0.35, w * land);
      mx(P, 'dropH', 0.3, kr); mx(P, 'dropF', -0.15, kr);
      mx(P, 'headRaise', 0.07, kr); mx(P, 'neckReach', 0.065, kr); mx(P, 'headPitch', -0.22, kr);
      // jaw: open on the grab, clamps shut on the neck and holds, then lets go
      const bite = smooth(0.15, 0.3, tp) * (1 - smooth(T_GRAB - 0.6, T_GRAB - 0.3, tp));
      mx(P, 'jaw', lerp(0.6, 0.22, bite), k); mx(P, 'jawOmega', 25, k);
      mx(P, 'earFlat', 0.7, k); mx(P, 'eyelid', 0.3 * bite, k);
      mx(P, 'tailLift', 0.3, k);
    }
  },
};

// death: the core collapse, eased in over 0.45 s instead of 0.25 s (a heavy body; a paw finishing its
// swing inside a faster collapse snapped to the ground on some slopes)
const DEATH = { ...POSTURES.death, kind: 'posture', fadeIn: 0.45 };

// eat: lions eat lying sternal with the carcass between the forepaws (the standing
// crouch read as a dog at a bowl). The sphinx lie (tune actions.lie) under the action's weight, then the
// head down to the food at the forepaws: tearing jerks up and back with a twist, the jaw clamping (the core
// eat's rhythm); the update hook keeps the head up over a long mane.
const EAT = {
  kind: 'oneshot', fade: 1.3,
  start(inst, L) {
    inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 7);
    inst.side = L.engine.rand() < 0.5 ? 1 : -1;
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t;
    const tune = inst.tune;
    inst.tune = e.cfg.actions.lie || {};
    POSTURES.lie.apply(P, w, inst, L);
    inst.tune = tune;
    // (the head lowered and pitched down over the food by the neck, not placed at a ground target: the
    // core's reach target follows the forefeet's plants, which jump as the legs fold under a lying body)
    const hw = smooth(0.4, 1, w);
    const c = (t * 0.75) % 1;
    const jerk = smooth(0.35, 0.5, c) * (1 - smooth(0.6, 0.95, c));
    mx(P, 'headRaise', -0.06 + 0.03 * jerk, hw); mx(P, 'neckReach', 0.03, hw);
    mx(P, 'headPitch', 0.75 - 0.3 * jerk, hw);
    mx(P, 'headYaw', 0.2 * jerk * Math.sin(Math.floor(t * 0.75) * 2.3), hw);
    mx(P, 'lookW', 0, hw); mx(P, 'headOmega', 2.2, hw);
    mx(P, 'jaw', 0.05 + 0.3 * smooth(0, 0.15, c) * (1 - smooth(0.25, 0.4, c)), hw); mx(P, 'jawOmega', 12, hw);
    mx(P, 'earTwitch', 1.5, hw);
    mx(P, 'speedScale', 0, w);
  },
};

export const lionActions = { roar: ROAR, yawn: YAWN, attack: ATTACK, death: DEATH, eat: EAT };

// ------------------------------------------------------------------------------------------------
function update(P, dt, L) {
  const e = L.engine, st = S(e), cfg = e.cfg;
  const vn = e.speed / cfg.sq;
  // the pounce's brake owns the ground speed only while its grab runs
  if (st.brake && !L.oneshots.some((a) => a.name === 'attack' && a.phase === 'grab' && !a.stopping)) { e.speedOverride = null; st.brake = false; }

  // ---- a head lying on its side rests on the cheek and the mane: lift it by its half width beyond
  // what the core assumes (the core's heights were set for the cheetah's small head)
  // (0.19: the broad cheekbones and the pinna's broad base: the ear base 9 mm in the ground at 0.18)
  // (0.2: the flatter cheek plane let the head lie lower on its side, an ear tip 13-15 mm in the ground at 0.19)
  const headHW = (0.2 + 0.15 * (e.params.mane || 0)) * (e.params.juv ? 1.35 : 1) * cfg.s; // (cubs: the big ears, 1.2 left an ear 7 mm in the ground)
  for (const p of L.postures) {
    const lat = p.name === 'sleep' && p.tune.style === 'lateral', dead = p.name === 'death';
    if (!lat && !dead) continue;
    const pw = sm(clamp(p.w, 0, 1));
    const c = lat ? smooth(0.8, 2.0, p.t) * pw : smooth(0.3, 0.9, p.t) * pw;
    P.headPos.y += Math.max(0, headHW - (lat ? 0.085 : 0.092) * cfg.k) * c;
    // (the thick maned neck does not twist as far as the core rolls a cheetah's head)
    P.headRoll *= 1 - 0.4 * c;
    // dead: the jaw slack but closed (the core's 0.1 rad parted the lips, and the lower lip's rim drew a second black arc
    // round the white chin, a "double C" round a white plate)
    // and the head rolled a little less, so the side of the jaw rather than its white underside faces out
    if (dead) { mx(P, 'jaw', 0.02, c); P.headRoll *= 1 - 0.15 * c; }
    // the tail limp on the ground: at rest the tail's frame is the pelvis, rolled onto its side, so the core's ground pose
    // (a pitch toward the pelvis's down) and its side curl lay the tail out sideways at hip height, the tip raised (17-39 cm
    // in the air). Bend it from the root toward the ground instead (the pelvis's lateral axis, which points
    // up or down on a body lying on its side); the tail's ground contact lays it along the ground.
    if (e.fr && e.fr.qPel) {
      _lat.set(1, 0, 0).applyQuaternion(e.fr.qPel);
      const down = _lat.y < 0 ? 1 : -1, k = c * smooth(0.35, 0.75, Math.abs(_lat.y));
      P.tailSide *= 1 - k;
      mx(P, 'tailCurl', down * 1.6, k);
      mx(P, 'tailGround', 0.5, k);
      mx(P, 'tailIdle', 0, k);
    }
    // a maned neck is wider than the chest: on its side the body rests on the mane
    const neckHW = (0.19 + 0.13 * (e.params.mane || 0)) - 0.2; // (incl. the mane's locks)
    // (plus ~1.6 cm for every lion: the thick forearm of the lower foreleg lies under the flank; 1.2 cm left
    // a lioness 1.1-1.2 % S in the ground on her death)
    P.lift += ((Math.max(0, neckHW) + 0.016) / cfg.unit) * (lat ? smooth(0.8, 2.2, p.t) : smooth(0.3, 0.8, p.t)) * pw;
  }

  // ---- getting up: the legs leave their lying / fallen poses early (by the time the gait may
  // re-step a foot the posture no longer holds it up; the core's side pose lifted a paw that then
  // snapped to the ground as its step ended)
  for (const p of L.postures) {
    if (p.target > 0 || p.w >= 1) continue;
    const k = smooth(0.4, 0.8, p.w);
    for (const l of P.legs) { l.side *= k; l.spread *= k; }
  }

  // ---- turning at speed: the head stays nearly in line with the spine (the engine leads a turn with the
  // head by up to 0.5 rad for as long as the heading error lasts; in a heavy cat's slow, wide gallop turn
  // that held the neck at full twist for seconds). At the walk the head keeps its full lead.
  if (!e.input.follow) {
    const lead = clamp(e.yawRate * 0.22 + 0.5 * angDiff(e.heading, e.wantHeading ?? e.heading), -0.5, 0.5);
    P.headYaw -= 0.8 * lead * smooth(2.5, 7, vn) * P.gaitW;
    // (and it rolls with the leaning body: held level against a 30 deg lean the neck twisted 35-37 deg)
    P.headRoll += 0.8 * (e.bank ? e.bank.x : 0) * P.gaitW;
  }

  // ---- the heavy walk: head low (carriage table), a nod at each forefoot contact
  const walkW = smooth(0.15, 0.6, vn) * (1 - smooth(1.8, 2.6, vn)) * P.gaitW;
  if (walkW > 0.01) {
    const nod = 0.5 + 0.5 * Math.cos(2 * TAU * (e.phase - 0.27 - 0.06));
    P.headRaise -= 0.014 * nod * walkW;
    P.headPitch += 0.04 * nod * walkW;
  }

  // ---- eating / drinking: the head stays a little higher over a long mane (the bib under the neck)
  for (const a of L.oneshots) {
    if ((a.name !== 'eat' && a.name !== 'drink') || a.w <= 0) continue;
    // (the core's tearing jerk pulls the head up and back: the mane under a folded neck would dig
    // into the ground, so the head rises further and stays forward through the jerk)
    const c = (a.t * 0.75) % 1, jerk = a.name === 'eat' ? smooth(0.35, 0.5, c) * (1 - smooth(0.6, 0.95, c)) : 0;
    const k = sm(a.w) * P.headW;
    P.headPos.y += ((0.06 + 0.06 * jerk) * (e.params.mane || 0) + (a.name === 'drink' ? 0.045 : 0.045)) * cfg.s * k;
    P.headPos.addScaledVector(e.fr.F, 0.05 * jerk * cfg.s * k);
  }

  // ---- lapping (~1.8 laps / s, tongue curled back: the jaw drops a little each lap)
  for (const a of L.oneshots) {
    if (a.name !== 'drink' || a.w <= 0) continue;
    const w = sm(a.w);
    const lap = Math.max(0, Math.sin(a.t * 1.8 * TAU));
    mx(P, 'jaw', 0.06 + 0.12 * lap * lap, w);
    mx(P, 'earFlat', 0.15, w);
  }

  // ---- tail-tip flick bursts: while lying, stalking, and now and then when standing
  const lying = L.postures.some((p) => (p.name === 'lie' || p.name === 'sleep') && p.target > 0);
  const stalking = L.oneshots.some((a) => a.name === 'attack' && a.phase === 'stalk');
  st.burstT -= dt;
  if (st.burstT <= 0) {
    if (st.burst > 0) { st.burst--; st.burstT = 0.55 + e.rand() * 0.35; e.tail.flickT = 0; }
    else { st.burst = stalking ? 3 : e.rand() < (lying ? 0.5 : 0.3) ? 2 + Math.floor(e.rand() * 3) : 0; st.burstT = stalking ? 0.6 : 6 + e.rand() * 10; }
  }
  if (stalking) P.tailIdle = Math.max(P.tailIdle, 1);

  // ---- idle life: resting, roars, yawns
  const enabled = e.idleVariants !== false;
  if (e.input.roar) { e.input.roar = false; if (!busy(L)) L.play('roar'); }
  const still = L.idle.w > 0.97 && !L.postures.length && !busy(L) && !e.input.follow && !e.input.look;
  // the automatic rest ends when anything else takes over (the game moved it, played a posture)
  const cur = L.postures.find((p) => p.target > 0);
  if (st.auto && (!cur || cur.name !== st.auto)) st.auto = null;
  if (!enabled) { st.idleT = 0; return; }
  if (still) {
    st.idleT += dt;
    st.variantIn -= dt;
    if (st.idleT > st.restAt) {
      st.idleT = 0; st.restAt = 12 + e.rand() * 15;
      L.play('lie'); st.auto = 'lie'; st.autoT = 0; st.nextIn = 30 + e.rand() * 40;
    } else if (st.variantIn <= 0) {
      st.variantIn = 10 + e.rand() * 10;
      const r = e.rand();
      if (r < 0.3) L.play('roar'); else if (r < 0.6) L.play('yawn');
    }
  } else {
    st.idleT = Math.max(0, st.idleT - dt * 2);
    st.variantIn = Math.max(st.variantIn, 4);
  }
  if (st.auto && cur && cur.w >= 1) {
    st.autoT += dt;
    st.variantIn -= dt;
    if (st.autoT > st.nextIn) {
      st.autoT = 0;
      if (st.auto === 'lie') { if (e.rand() < 0.7) { L.play('sleep', { side: cur.side }); st.auto = 'sleep'; st.nextIn = 50 + e.rand() * 60; } else st.nextIn = 20 + e.rand() * 20; }
      else { L.play('stand'); st.auto = null; st.idleT = 0; } // wakes, gets up, and the cycle starts over
    } else if (st.auto === 'lie' && st.variantIn <= 0 && !busy(L)) {
      st.variantIn = 12 + e.rand() * 14;
      const r = e.rand();
      if (r < 0.25) L.play('roar'); else if (r < 0.65) L.play('yawn');
    }
  }
}

// ------------------------------------------------------------------------------------------------
// pose: the whisker fans (whiskers.js) sweep back along the cheek and lift about their roots just enough
// to stay out of the ground when the head lies on it (sleep, death, drinking with the chin down), the way
// a cat lays its whiskers back against a surface (after the cat's hook), on fast critically damped springs.
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3(), _a = new THREE.Vector3(), _d = new THREE.Vector3(), _ax = new THREE.Vector3();
const _w = Array.from({ length: 160 }, () => new THREE.Vector3());
const WB = fe(...WHISKER_BASE_F), WT = fe(...WHISKER_TIP_F);
function whiskerLocal(e, k) {
  const s = k ? -1 : 1, S = k ? 'R' : 'L';
  const i = e.sk.bones.indexOf(e.bone['whisker' + S]);
  const inv = e.sk.bind[i].clone().invert();
  const Jb = e.J['whiskerBase' + S], Jt = e.J['whiskerTip' + S];
  const kk = Jb.distanceTo(Jt) / Math.hypot(WT[0] - WB[0], WT[1] - WB[1], WT[2] - WB[2]);
  return [WT, ...whiskerSamples(e.params)].map((p) => new THREE.Vector3(Jb.x + (p[0] - WB[0]) * s * kk, Jb.y + (p[1] - WB[1]) * kk, Jb.z + (p[2] - WB[2]) * kk).applyMatrix4(inv));
}
// exact step of a critically damped spring x'' = -om^2 (x - target) - 2 om x'
function crit(x, v, target, om, dt) {
  const d0 = x - target, B = v + om * d0, e = Math.exp(-om * dt);
  return [target + (d0 + B * dt) * e, (v - om * B * dt) * e];
}
const _lip = new THREE.Vector3();
function pose(e, dt) {
  if (e.lod >= 2 || !e.bone.whiskerL) return;
  const st = S(e), cfg = e.cfg;
  // the upper lip's edge draws back and up as the jaw opens (a roar, a yawn, a snarl): the lip corners go back and
  // the upper canines show (the gape stayed a round "O" with the canines hidden behind the lip)
  const gape = smooth(0.1, 0.8, e.jaw ? e.jaw.x : 0);
  if (gape > 1e-4 && e.bone.lipL) {
    for (const S2 of ['L', 'R']) {
      const b = e.bone['lip' + S2];
      _lip.set(0, 0.013, -0.011).multiplyScalar(gape * cfg.s).applyQuaternion(e.headPose.quaternion);
      b.matrixWorld.elements[12] += _lip.x; b.matrixWorld.elements[13] += _lip.y; b.matrixWorld.elements[14] += _lip.z;
    }
  }
  if (!st.whisk) st.whisk = [{ back: 0, lift: 0, vb: 0, vl: 0 }, { back: 0, lift: 0, vb: 0, vl: 0 }];
  if (!st.wLocal) st.wLocal = [0, 1].map((k) => whiskerLocal(e, k));
  let lying = 0;
  for (const p of e.actionsLayer.postures) if (p.name === 'lie' || p.name === 'sleep' || p.name === 'death') lying = Math.max(lying, clamp(p.w, 0, 1));
  for (let k = 0; k < 2; k++) {
    const S2 = k ? 'R' : 'L', s = k ? -1 : 1;
    const bone = e.bone['whisker' + S2], W = st.whisk[k];
    const base = _p.setFromMatrixPosition(bone.matrixWorld);
    _q.setFromRotationMatrix(bone.matrixWorld);
    _a.set(0, 1, 0).applyQuaternion(e.headPose.quaternion);
    // (look ahead by the head's fall: a collapsing body drops the face fast)
    const vDown = W.y0 === undefined || dt <= 0 ? 0 : Math.max(0, (W.y0 - base.y) / dt);
    W.y0 = base.y;
    const margin = 0.018 * cfg.s + Math.min(0.12 * cfg.s, vDown * 0.2);
    const near = base.y - e.terrainH(base.x, base.z) < 0.2 * cfg.s + margin * 2;
    let needB = 0, needL = 0;
    if (near) {
      const pts = st.wLocal[k], nP = pts.length;
      for (let i = 0; i < nP; i++) _w[i].copy(pts[i]).applyMatrix4(bone.matrixWorld).sub(base);
      const clearAt = (phi) => {
        let worst = 0;
        _q2.setFromAxisAngle(_a, s * phi);
        for (let i = 0; i < nP; i++) {
          const q = _d.copy(_w[i]).applyQuaternion(_q2).add(base);
          worst = Math.min(worst, q.y - (e.terrainH(q.x, q.z) + margin));
        }
        return worst;
      };
      // the smallest sweep back that clears, interpolated between steps (continuous in the pose)
      let pw = clearAt(0);
      if (pw < 0) {
        needB = 1.7;
        for (let i = 1; i <= 8; i++) {
          const w = clearAt(i * 0.2125);
          if (w >= 0) { needB = (i - 1 + -pw / Math.max(1e-6, w - pw)) * 0.2125; break; }
          pw = w;
        }
      }
      const rest = clearAt(needB);
      if (rest < 0) needL = Math.asin(clamp(-rest / (0.08 * cfg.s), 0, 1)) * 1.2;
    }
    // lying, asleep or dead the fans lie back against the face (and fold out again as the lion gets up: the
    // head rolling upright swung the lower fan into the ground faster than the clearance could follow)
    needB = Math.max(needB, 1.3 * lying); needL = Math.max(needL, 0.45 * lying);
    // (rises at once, relaxes slowly: a collapsing head pauses and falls on, and a fan that swung back the
    // moment it looked clear dipped into the ground a few frames later)
    needB = Math.max(needB, W.back - 1.0 * dt); needL = Math.max(needL, W.lift - 1.0 * dt);
    // critically damped springs (fast, ~0.05 s), stepped exactly (stable at any frame rate): the fan never snaps
    [W.back, W.vb] = crit(W.back, W.vb, needB, 55, dt); W.back = Math.max(0, W.back);
    [W.lift, W.vl] = crit(W.lift, W.vl, needL, 55, dt); W.lift = Math.max(0, W.lift);
    if (W.back < 1e-4 && W.lift < 1e-4) continue;
    if (W.back > 1e-4) _q.premultiply(tqa(_a, s * W.back));
    if (W.lift > 1e-4) {
      const tip = _d.copy(st.wLocal[k][0]).applyMatrix4(bone.matrixWorld).sub(base).applyQuaternion(tqa(_a, s * W.back)).normalize();
      _ax.crossVectors(tip, THREE.Object3D.DEFAULT_UP);
      if (_ax.lengthSq() > 1e-8) _q.premultiply(tqa(_ax.normalize(), W.lift));
    }
    bone.matrixWorld.compose(base, _q, _s1);
  }
}

export const lionHooks = { actions: lionActions, update, pose };
void mxLegs;
