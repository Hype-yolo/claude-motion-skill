// Brown bear behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js):
//
//   update(P, dt, layer)   every frame over the action layer: the lumbering walk (head swinging with
//                          the forelegs, shoulders and hump rolling), nose working while idle, automatic
//                          idle variants (sniffing the air, standing up to look, digging), standing up
//                          on the hind legs to look at a far target (input.look)
//   pose(engine, dt)       nostril / muzzle twitch while sniffing (a small head-bone nod is enough)
//   actions                standup (bipedal: looks and sniffs), sniff, dig (alternate forepaw rakes),
//                          sit (on the rump like a person, hind legs forward, forepaws in the lap),
//                          sleep (curled on the side, or prone with the head on the forepaws),
//                          attack (charge, rear up, swat with a forepaw, come down biting),
//                          hit (flinch, huff and a head swing, jaw popping), eat (rooting / grazing)
//
// Distances are bear metres at the reference size (x cfg.s); posture lengths that the engine
// multiplies by cfg.k (fwd, side, lift, headRaise, neckReach) are divided by cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tableAt } from '../../core/motion/common.js';
import { mx, mxLeg, ONESHOTS, POSTURES } from '../../core/motion/actions.js';

const PI = Math.PI;

function B(e) {
  if (!e._bear) e._bear = { idleT: 8 + e.rand() * 8, lookStandT: 0, sniff: 0, sway: 0, huffT: -1, standW: 0 };
  return e._bear;
}
// A bear looking at something keeps its muzzle below its line of sight (face1 / face2 / tq1 / front1: looking at
// the camera, the nose pad's bottom 0.91-0.98 eye separations under the eye line; face3_profile: the nose centre
// 0.48 of the eye-nose distance under it). The engine aims the head bone's long axis at a look target and so
// replaced the nose-down carriage with a level head whenever the bear looked at anything, ~70 % of a standing
// bear's time (the nose pad then sat 0.19 / 0.58 eye separations under the eyes). The look pitch gets this offset.
const GAZE = 0.25;
// A bear looking to the side bends its short, thick neck toward the look as well as turning its head (m of lateral
// neck bend at the poll per rad of head yaw, reference size). The engine carries the neck with the chest and yaws the
// head bone alone: a 45 deg look turned the head ~40 deg about the poll, the skin behind the ear on the look side
// folded into a crease and the nape's ruff stood along it as a hard edge over a bald-looking trench
const NECK_SWAY = 0.18;
const busy = (L) => L.postures.length > 0 || L.oneshots.some((a) => !a.stopping);

// ------------------------------------------------------------------------------------------------
// bipedal stand: the body rotates up about the hips (hind feet flat), forelegs hang in front of the
// chest, head up and looking, nose working. `w` is the rise (0..1).
const STAND_PITCH = 1.2; // torso pitch standing up (rad, ~69 deg)
const SIT_PITCH = 0.95; // sitting on the rump
const HEAD_SIDE = 0.09; // extra height of the occiput of a head lying on its side (m)

// Pitches the torso up about the hips to pT (body frame pitch) with the hips displaced dispH (m) from
// their bind height and carried to body-local z hipZt. The girdle height targets are set to agree
// with that pitch (the engine pitches the body by atan2(shoulder - hip displacement, girdle distance)
// + P.pitch), and the body is carried forward (P.fwd) so the hips land where asked.
function tiltBody(P, g, e, pT, dispH, hipZt) {
  const cfg = e.cfg;
  const dz = cfg.zS - cfg.zH;
  const restH = cfg.pelvis.hh - (cfg.pelvis.y - cfg.yH);
  const dispS = dispH + (cfg.yS - cfg.yH) * (Math.cos(pT) - 1) + dz * Math.sin(pT);
  if (dispH !== null) mx(P, 'dropH', -dispH / (cfg.yH - restH), g);
  // (the shoulders by absolute height: the engine's resting height behind dropF changes with the pitch)
  mx(P, 'frontH', cfg.yS + dispS, g / Math.max(1e-3, P.frontHW + g)); mx(P, 'frontHW', 1, g);
  mx(P, 'pitch', pT - Math.atan2(dispS - dispH, dz), g);
  const hipZ = cfg.zH * Math.cos(pT) - (cfg.yH + dispH) * Math.sin(pT);
  mx(P, 'fwd', (hipZt - hipZ) / cfg.k, g);
}

function applyStand(P, w, e, headUp = 1) {
  if (w <= 1e-4) return;
  const cfg = e.cfg, s = cfg.s;
  const g = smooth(0, 0.2, w);
  mx(P, 'gaitW', 0, g); mx(P, 'legGait', 0, g);
  // the hips stay over the planted hind feet (heels down), the torso rises toward vertical
  const r = smooth(0.3, 1, w);
  // (over where the hind feet actually stand: the midpoint of their plants in the heading frame)
  const zPl = 0.5 * (e.worldToBody(e.legs[2].plant, tv()).z + e.worldToBody(e.legs[3].plant, tv()).z);
  // (the hips a little behind the heels: the knees flex slightly and the hip does not over-extend)
  tiltBody(P, g, e, STAND_PITCH * r, -0.02 * s * r, zPl - (0.04 + 0.08 * r) * s);
  mx(P, 'bodyOmega', 1.4, g);
  // forelegs hang in front of the chest, paws at the belly; they leave from and come back down to
  // their plants (the reach target starts and ends there, so nothing slides when the gait takes the
  // feet back)
  const hang = smooth(0.45, 0.9, w), kR = smooth(0, 0.3, w);
  const fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
  for (let i = 0; i < 2; i++) {
    const Ld = e.legs[i].def;
    const tp = tv().copy(e.fr.shC).addScaledVector(fwd, 0.26 * s).addScaledVector(lat, Ld.s * 0.1 * s);
    tp.y -= 0.34 * s;
    tp.lerp(e.legs[i].plant, 1 - hang);
    P.legs[i].target.lerp(tp, kR / Math.max(1e-3, P.legs[i].reach + kR));
    mxLeg(P, i, 'reach', 1, kR);
  }
  // head held up and level, looking ahead (detail_bipedal); the neck carries it forward of the chest
  // (at a 0.85 rad nose-down pitch the chin was tucked to the chest and the nape stretched over the poll)
  // (the stand sets its own head pitch: the gaze offset of a look is taken back while it rises, update())
  mx(P, 'headRaise', 0.03 / cfg.unit * headUp, w); mx(P, 'headPitch', 0.35 * headUp, w);
  const b = B(e); b.standW = Math.max(b.standW, w);
  mx(P, 'earFlat', -0.1, w); mx(P, 'tailIdle', 0.2, w);
}

const standup = {
  kind: 'oneshot', fade: 0.6, needsStand: true,
  start(inst, L) {
    const e = L.engine;
    inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 4 + e.rand() * 3);
    const a = e.heading + (e.rand() - 0.5) * 1.4, d = 25 * e.cfg.s;
    inst.look = inst.opts.target ? inst.opts.target.clone() : new THREE.Vector3(e.pos.x + Math.sin(a) * d, e.pos.y + 1.5 * e.cfg.s, e.pos.z + Math.cos(a) * d);
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t;
    const up = w * smooth(0, 1.1, t) * (1 - smooth(inst.dur - 0.9, inst.dur, t));
    applyStand(P, up, e);
    if (!e.input.look) { P.look = inst.look; mx(P, 'lookW', 1, up); }
    // scenting: short nose-up sniffs
    const sn = Math.max(0, Math.sin(t * TAU * 0.45)) * up;
    mx(P, 'headPitch', P.headPitch - 0.25, sn);
    mx(P, 'breathRate', 3, sn); mx(P, 'breathAmp', 0.5, sn);
    B(e).sniff = Math.max(B(e).sniff, sn);
  },
};

// sniffing the air on all fours: head raised, nose up, working
const sniff = {
  kind: 'oneshot', fade: 0.4,
  start(inst, L) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 3 + L.engine.rand() * 2); inst.yaw = (L.engine.rand() - 0.5) * 0.8; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t;
    const k = w * smooth(0, 0.6, t);
    mx(P, 'headRaise', 0.1 / e.cfg.unit, k); mx(P, 'headPitch', -0.35 + 0.08 * Math.sin(t * 2.3), k);
    mx(P, 'headYaw', inst.yaw + 0.25 * Math.sin(t * 0.9), k); mx(P, 'lookW', 0, k);
    mx(P, 'breathRate', 3.5, k); mx(P, 'breathAmp', 0.5, k);
    mx(P, 'jaw', 0.02 + 0.02 * Math.max(0, Math.sin(t * 17)), k);
    B(e).sniff = Math.max(B(e).sniff, k);
  },
};

// digging / rooting: head low, alternate forepaw rakes toward the body (1.4 Hz), nose in the hole.
// The paws stay in reach mode for the whole dig (claws down, wrist raised): between strokes a paw rests
// where its rake ended. (Fading the reach out after every stroke swung the metacarpus from the claws-
// down rake to the flat plantigrade palm, 93 deg in 55 ms: an 84 rad/s* pop.)
function rakeTargets(P, k, e, t, rate) {
  const cfg = e.cfg, s = cfg.s;
  const fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
  for (let i = 0; i < 2; i++) {
    const L = e.legs[i];
    // each paw in turn: reach forward and up, strike down, rake back along the ground; the path is
    // continuous from stroke to stroke (it starts and ends at the resting point 2 cm ahead of the plant)
    const ph = (t * rate + (i === 0 ? 0 : 0.5)) % 1;
    const u = Math.min(1, ph / 0.55);
    const z = 0.02 + 0.3 * (smooth(0, 0.35, u) - smooth(0.45, 1, u));
    const y = 0.13 * smooth(0, 0.22, u) * (1 - smooth(0.28, 0.55, u));
    const tp = tv().copy(e.legs[i].plant).addScaledVector(fwd, z * s).addScaledVector(lat, -L.def.s * 0.03 * s);
    tp.y = e.terrainH(tp.x, tp.z) + (y + 0.025) * s;
    P.legs[i].target.lerp(tp, k / Math.max(1e-3, P.legs[i].reach + k));
    mxLeg(P, i, 'reach', 1, k);
  }
}
const dig = {
  kind: 'oneshot', fade: 0.5,
  start(inst, L) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 5); },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t;
    const k = w * smooth(0, 0.6, t);
    mx(P, 'gaitW', 0, k); mx(P, 'legGait', 0, k);
    mx(P, 'dropF', 0.25, k); mx(P, 'dropH', -0.05, k);
    mx(P, 'headRaise', -0.2 / e.cfg.unit, k); mx(P, 'headPitch', 0.9, k); mx(P, 'lookW', 0, k);
    mx(P, 'headYaw', 0.15 * Math.sin(t * 1.4 * PI), k);
    const ks = k * smooth(0.5, 1.0, t);
    if (ks > 0) rakeTargets(P, ks, e, Math.max(0, t - 0.5), 1.4);
    mx(P, 'breathRate', 2, k);
  },
};

// sit on the rump like a person: hips down on the ground, the torso up at ~55 deg, the hind legs
// stretched forward along the ground, the forepaws resting in the lap between them
const sit = {
  kind: 'posture', fadeIn: 1.6, fadeOut: 1.3,
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, s = cfg.s;
    const wH = smooth(0, 0.7, w), wF = smooth(0.3, 1, w);
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    // the rump goes down first, then the torso comes up (the hips roll back a little onto the rump)
    const restH = cfg.pelvis.hh - (cfg.pelvis.y - cfg.yH);
    const pT = SIT_PITCH * wF;
    tiltBody(P, w, e, pT, -(cfg.yH - restH) * wH + 0.08 * s * Math.sin(pT), cfg.zH - 0.06 * s * wH);
    mx(P, 'groundW', 1, wH);
    const fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
    // hind feet: forward of the hips, soles facing forward-up (heels on the ground)
    const wl = smooth(0.1, 0.8, w);
    for (let i = 2; i < 4; i++) {
      const Ld = e.legs[i].def;
      const tp = e.bodyToWorld(Ld.cx * Ld.s * 1.25, 0, cfg.zH + Ld.len * 0.95, e.heading, e.pos, tv());
      tp.y = e.terrainH(tp.x, tp.z) + 0.03 * s;
      P.legs[i].target.copy(tp);
      mxLeg(P, i, 'reach', 1, wl);
    }
    // forepaws in the lap
    const wp = smooth(0.45, 1, w);
    for (let i = 0; i < 2; i++) {
      const Ld = e.legs[i].def;
      const tp = e.bodyToWorld(Ld.cx * Ld.s * 0.7, 0, cfg.zH + Ld.len * 0.55, e.heading, e.pos, tv());
      tp.y = e.terrainH(tp.x, tp.z) + 0.28 * s;
      P.legs[i].target.lerp(tp, wp / Math.max(1e-3, P.legs[i].reach + wp));
      mxLeg(P, i, 'reach', 1, wp);
    }
    void fwd; void lat;
    mx(P, 'headRaise', 0.02 / cfg.unit, wF); mx(P, 'headPitch', 0.45, wF);
    mx(P, 'tailGround', 1, wH);
  },
};

// sleep: curled on the side (built-in curl), or prone on the belly with the chin on the forepaws
const sleep = {
  kind: 'posture', fadeIn: 1.4, fadeOut: 1.2,
  apply(P, w, inst, L) {
    if (inst.style === undefined) inst.style = inst.opts.style || (L.engine.rand() < 0.5 ? 'curl' : 'prone');
    if (inst.style === 'curl') { POSTURES.sleep.apply(P, w, { ...inst, tune: { ...inst.tune, style: 'curl' } }, L); return; }
    POSTURES.lie.apply(P, w, inst, L);
    const e = L.engine, cfg = e.cfg, s = cfg.k, fr = e.fr;
    const c = smooth(0.8, 2.6, inst.t) * w;
    // chin resting on the crossed forepaws in front of the chest
    const hp = tv().copy(fr.neckBase).addScaledVector(fr.F, cfg.neckLen * 0.8);
    hp.y = e.terrainH(hp.x, hp.z) + 0.1 * s;
    P.headPos.lerp(hp, c / Math.max(1e-3, P.headW + c)); mx(P, 'headW', 1, c);
    mx(P, 'headPitch', 0.3, c); mx(P, 'headYaw', 0, c); mx(P, 'headLimp', 0.2, c);
    mx(P, 'eyelid', 1, smooth(1.6, 3.2, inst.t) * w);
    mx(P, 'breathRate', 0.45, c); mx(P, 'breathAmp', 1.4, c);
    mx(P, 'earFlat', 0.2, c); mx(P, 'earTwitch', 0.3, c); mx(P, 'lookW', 0, c);
  },
};

// attack: a charge, then it rears up, swats with one forepaw, comes down and bites
const attack = {
  kind: 'oneshot', fade: 0.15, needsStand: true,
  start(inst, L) {
    const e = L.engine;
    inst.run = smooth(1.5, 3.5, e.speed / e.cfg.sq);
    inst.target = inst.opts.target ? inst.opts.target.clone() : null;
    // (from standing a lunge on the spot, the forefeet planted, then straight up: a rush from standing cost
    // 1.5-2 s of stepping to a stop before the rear-up could start, and the swat came 3.4 s after the
    // command; now ~1.2 s. Already running: it brakes and rears, ~1.7 s)
    inst.charge = inst.run > 0.5 ? 0.2 : 0;
    inst.lunge = inst.run > 0.5 ? 0 : 1;
    inst.dur = Infinity;
    inst.T0 = Infinity; // rear-up start: once the charge has stopped
    inst.side = e.rand() < 0.5 ? 0 : 1; // swatting paw
    inst.swat = false; inst.bit = false;
  },
  update(inst, dt, L) {
    const e = L.engine, cfg = e.cfg, t = inst.t;
    // (a short lumbering rush at the amble: the canter's footfall order would have to change twice)
    const vC = cfg.gears.amble || 2.4 * cfg.sq;
    if (t < inst.charge) e.wantSpeed = Math.max(e.wantSpeed, vC);
    else {
      // the charge brakes hard; it rears up once it has (nearly) stopped
      // (braking over ~0.4 s from the rush: the feet keep up; from a run it stops like stop())
      if (inst.v0 === undefined) inst.v0 = Math.max(vC, e.speed);
      e.wantSpeed = inst.run > 0.5 || inst.lunge ? 0 : inst.v0 * (1 - smooth(inst.charge, inst.charge + 0.4, t));
      // (standing, all four feet down: the gait has gathered the feet under the body first; the reach that
      // lifts the forepaws starts from their plants, so a forefoot still in the air snapped to it: a
      // 160-320 rad/s* pop. A quarter second of stillness is not needed: 0.08 s)
      if (e.speed > 0.08 * cfg.sq || !e.legs.every((l) => l.state === 'stance')) inst.still = 0;
      else inst.still = (inst.still || 0) + dt;
      if (inst.T0 === Infinity && inst.still > 0.08 && t > 0.3 * inst.lunge) inst.T0 = t;
      if (inst.T0 === Infinity && t > inst.charge + 4) inst.T0 = t;
    }
    const T0 = inst.T0;
    if (t >= T0 + 2.6) return true;
    if (!inst.swat && t >= T0 + 0.85) {
      inst.swat = true;
      const p = e.legs[inst.side].contact.clone();
      const dir = inst.target ? inst.target.clone().sub(e.pos).setY(0).normalize() : e.forward(e.heading, new THREE.Vector3());
      e.emit('attackHit', { position: p, direction: dir, style: 'swat' });
    }
    if (!inst.bit && t >= T0 + 1.85) {
      inst.bit = true;
      const p = new THREE.Vector3().copy(cfg.mouthLocal).applyQuaternion(e.headPose.quaternion).add(e.headPose.position);
      e.emit('attackHit', { position: p, direction: e.forward(e.heading, new THREE.Vector3()), style: 'bite' });
    }
    return false;
  },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, s = cfg.s, t = inst.t, T0 = inst.T0;
    if (inst.target) { P.look = inst.target; mx(P, 'lookW', 1, w); }
    mx(P, 'earFlat', 1, w * smooth(0, 0.2, t)); mx(P, 'earTwitch', 0, w);
    // charge: head low, ears back
    const ch = w * (1 - smooth(inst.charge - 0.1, inst.charge + 0.4, t));
    mx(P, 'headRaise', -0.06 / cfg.unit, ch); mx(P, 'headPitch', 0.2, ch);
    // lunge from standing: the body surges forward over the planted feet, head low, a huff
    if (inst.lunge) {
      const lg = w * smooth(0, 0.25, t) * (1 - smooth(0.35, 0.7, t));
      mx(P, 'fwd', 0.1 / cfg.unit, lg); mx(P, 'dropF', 0.08, lg); mx(P, 'headRaise', -0.06 / cfg.unit, lg); mx(P, 'headPitch', 0.25, lg);
      mx(P, 'jaw', 0.2, lg * smooth(0.1, 0.25, t)); mx(P, 'breathAmp', 2.5, lg);
    }
    // rear up (not as high as the bipedal stand), swat, come down into the bite
    const u = Number.isFinite(T0) ? t - T0 : -10;
    const rear = w * smooth(0.1, 0.6, u) * (1 - smooth(1.0, 1.8, u));
    applyStand(P, rear * 0.8, e, 0.4);
    mx(P, 'jaw', 0.35, rear * smooth(0.3, 0.6, u));
    // the swat: the paw goes out and up to the side, then sweeps across and down
    const sw = rear * smooth(0.45, 0.7, u) * (1 - smooth(0.95, 1.15, u));
    if (sw > 0) {
      const i = inst.side, Ld = e.legs[i].def, sd = Ld.s;
      const fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
      const a = smooth(0.6, 0.9, u); // 0 wound up to the side .. 1 swept across
      const tp = tv().copy(e.fr.shC).addScaledVector(fwd, lerp(0.25, 0.55, a) * s).addScaledVector(lat, sd * lerp(0.4, -0.15, a) * s);
      tp.y += lerp(0.25, -0.2, a) * s;
      P.legs[i].target.lerp(tp, sw / Math.max(1e-3, P.legs[i].reach + sw));
      mxLeg(P, i, 'reach', 1, sw);
      mx(P, 'bend', -sd * 0.25 * (a - 0.5), sw); mx(P, 'headYaw', sd * 0.3 * (0.5 - a), sw);
    }
    // bite: lunge forward and down, jaws open then snap shut, a shake of the head
    const bite = w * smooth(1.5, 1.75, u) * (1 - smooth(2.0, 2.5, u));
    mx(P, 'fwd', 0.18 / cfg.unit * 0.3, bite); mx(P, 'neckReach', 0.06 / cfg.unit, bite); mx(P, 'headRaise', -0.05 / cfg.unit, bite);
    mx(P, 'jaw', 0.55 * (1 - smooth(1.8, 1.9, u)), bite); mx(P, 'jawOmega', 30, w);
    mx(P, 'headRoll', 0.25 * Math.sin((u - 1.85) * 22) * smooth(1.85, 1.95, u), bite);
    void s;
  },
};

// hit: flinch back, then a loud huff with the head swung and the jaw popping
const hit = {
  ...ONESHOTS.hit,
  kind: 'oneshot',
  start(inst, L) {
    ONESHOTS.hit.start(inst, L);
    inst.dur = 1.5;
    inst.opts = { ...inst.opts, strength: (inst.opts.strength ?? 1) * 0.6 };
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const t = inst.t;
    const k = smooth(0, 0.1, t) * Math.exp(-Math.max(0, t - 0.1) * 4) * w;
    mx(P, 'roll', inst.lx * 0.12, k); mx(P, 'bend', -inst.lx * 0.2, k);
    mx(P, 'pitch', inst.lz * 0.06, k); mx(P, 'dropF', 0.15, k); mx(P, 'dropH', 0.1, k);
    P.headLocal.set(inst.lx * 0.06, 0.02, inst.lz * 0.06 - 0.03); mx(P, 'headLocalW', 1, k);
    mx(P, 'eyelid', 0.6, k);
    // huff: head swings side to side (the swing that follows the blow), jaw pops twice
    const hs = w * smooth(0.25, 0.45, t) * (1 - smooth(1.1, 1.5, t));
    mx(P, 'headYaw', 0.45 * Math.sin((t - 0.25) * 7.5) * (inst.lx >= 0 ? -1 : 1), hs);
    mx(P, 'headRaise', -0.02, hs); mx(P, 'headPitch', 0.3, hs); mx(P, 'lookW', 0, hs);
    const pop = Math.max(smooth(0.35, 0.42, t) * (1 - smooth(0.46, 0.55, t)), smooth(0.7, 0.77, t) * (1 - smooth(0.81, 0.9, t)));
    mx(P, 'jaw', 0.3 * pop, w); mx(P, 'jawOmega', 28, w);
    mx(P, 'earFlat', 1, w * (1 - smooth(0.9, 1.5, t)));
    mx(P, 'breathAmp', 3, hs); mx(P, 'breathRate', 2.5, hs);
  },
};

// ------------------------------------------------------------------------------------------------
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg;
  const vn = e.speed / cfg.sq;
  b.sniff *= Math.exp(-dt * 3);
  // the big broad head (cheeks ~15 cm from the midline with the ruff) rests higher on its side than
  // the engine's default dead-head height; the grazing / drinking mouth works just above the ground
  for (const p of L.postures) {
    if (p.name === 'death' && P.headW > 0) P.headPos.y += HEAD_SIDE * cfg.s * smooth(0.3, 1.0, p.t) * p.w;
    if (p.name === 'death') {
      // the broad paws lie on their sides: the engine's side-lying leg rest (3 cm up) put their edges
      // into the ground; rest them a paw's half width up (same place, reach mode)
      const fr = e.fr;
      for (let i = 0; i < 4; i++) {
        const pl = P.legs[i], k = pl.side;
        if (k < 1e-3) continue;
        const Ld = e.legs[i].def, gy = Ld.front ? cfg.yS : cfg.yH, out = pl.spread;
        const lz = (Ld.front ? cfg.zS + 0.18 * Ld.len : cfg.zH - 0.02 * Ld.len) + (Ld.s * Math.sign(P.roll || 1) > 0 ? 0.12 : 0) * Ld.len * out;
        const tp = tv().set(Ld.cx * Ld.s * 1.2, gy - Ld.len * lerp(0.85, 0.95, out), lz).applyQuaternion(fr.qB).add(fr.origin);
        const gh = e.terrainH(tp.x, tp.z) + 0.09 * cfg.s;
        tp.y = Math.max(gh, lerp(tp.y, gh, 0.85));
        pl.target.copy(tp);
        mxLeg(P, i, 'reach', 1, k);
      }
    }
  }
  for (const a of L.oneshots) {
    if ((a.name === 'eat' || a.name === 'drink') && P.headW > 0) P.headPos.y += 0.02 * cfg.s * a.w;
  }
  // lumbering walk: the head swings with the forelegs, the shoulders and hump roll over each
  // planted foreleg (walk and amble only)
  const walk = smooth(0.1, 0.5, vn) * (1 - smooth(2.4, 3.2, vn)) * P.gaitW;
  if (walk > 1e-3) {
    const ph = TAU * (e.phase - 0.25);
    // (+-6 deg with the forelegs, NOTES: the engine's own head stabilisation takes back half of it)
    mx(P, 'headYaw', P.headYaw + 0.2 * Math.sin(ph), walk);
    P.roll += 0.06 * Math.sin(ph) * walk;
    P.headRoll += 0.05 * Math.sin(ph) * walk;
  }
  // looking up raises the neck with the head: the head hangs low at rest (0.34 rad nose down, 8 cm under its
  // bind height), and a head pitched up about the poll alone to look level extended the poll ~18 deg past its
  // bind angle: the nape skin folded and its long hair stood up as a crack across the crown. The neck rises
  // 0.25 m per rad the look is above the carriage (about the neck's length: the poll keeps its angle)
  // (eased like the head's own pitch: a look target that jumps must not step the neck, 105 rad/s* pops)
  // The look pitch carries the gaze offset (GAZE: the muzzle below the line of sight), except while the bear
  // rises onto its hind legs, whose pose sets the head's pitch itself; the neck rises only for the part of the
  // look above the carriage that the offset leaves
  const look = e.input.look || P.look;
  const standW = b.standW; b.standW = 0;
  let upT = 0;
  if (look && P.lookW > 0.01) {
    const lw = clamp(P.lookW, 0, 1), gz = GAZE * (1 - smooth(0, 0.3, standW));
    P.headPitch += gz * lw;
    const hp = e.headPose.position;
    const lp = -Math.atan2(look.y - hp.y, Math.hypot(look.x - hp.x, look.z - hp.z));
    const cp = tableAt(cfg.headCarry, vn, b.carry || (b.carry = [0, 0, 0]))[2];
    upT = clamp(cp - (Math.max(lp, -cfg.head.pitchUp) + gz), 0, 0.5) * lw;
  }
  b.up = (b.up || 0) + (upT - (b.up || 0)) * (1 - Math.exp(-dt * 3));
  P.headRaise += 0.25 * b.up / cfg.unit;
  // the neck bends toward the head's yaw (the engine's eased head yaw: looks, the walk's head swing, turns), so the turn
  // is shared between the neck and the poll (added to any posture's occiput offset, e.g. the hit's flinch)
  const yawH = e.lookYaw ? e.lookYaw.x : 0;
  if (Math.abs(yawH) > 1e-4) {
    P.headLocal.multiplyScalar(P.headLocalW);
    P.headLocal.x += NECK_SWAY * clamp(yawH, -1.2, 1.2) / cfg.unit;
    P.headLocalW = 1;
  }
  // any other action interrupts grazing / drinking / digging
  if (L.oneshots.some((a) => !a.stopping && !/^(eat|drink|dig|hit|sniff)$/.test(a.name))) for (const a of L.oneshots) if (/^(eat|drink|dig)$/.test(a.name)) a.stopping = true;
  // a far look target: stand up on the hind legs to see over the grass (now and then)
  b.lookStandT -= dt;
  if (e.input.look && L.idle.w > 0.9 && !busy(L) && b.lookStandT <= 0) {
    const d = Math.hypot(e.input.look.x - e.pos.x, e.input.look.z - e.pos.z);
    b.lookStandT = 6 + e.rand() * 6;
    if (d > 12 * cfg.s && e.rand() < 0.7) L.play('standup', { target: e.input.look, duration: 3.5 + e.rand() * 2 });
  }
  // automatic idle variants
  if (e.idleVariants !== false && L.idle.w > 0.98 && !busy(L) && !e.input.look && !e.input.follow) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 9 + e.rand() * 12;
      const r = e.rand();
      if (r < 0.35) L.play('sniff');
      else if (r < 0.6) L.play('standup');
      else if (r < 0.8) L.play('dig', { duration: 3 + e.rand() * 3 });
    }
  } else if (busy(L)) b.idleT = Math.max(b.idleT, 4);
}

// jump: the built-in jump, but the push-off never extends the legs past standing (the flat
// plantigrade feet cannot roll up onto their toes while the gait is held: the knee snapped straight).
// In the air a bear bounds (research 4.2: a poor jumper): the hind legs trail behind after the push-off
// and swing forward only for the landing, the forelegs reach ahead to land first (the built-in flight
// tucked all four feet under the body like a cat)
const jump = {
  ...ONESHOTS.jump,
  kind: 'oneshot', airborne: true,
  apply(P, w, inst, L) {
    ONESHOTS.jump.apply(P, w, inst, L);
    if (inst.phase === 'crouch' || inst.phase === 'push') { P.dropH = Math.max(P.dropH, 0); P.dropF = Math.max(P.dropF, 0); }
    if (inst.phase === 'air') {
      const T = (2 * inst.vy) / 9.81, x = clamp((inst.t - inst.tAir) / T, 0, 1);
      const k = smooth(0, 0.12, inst.t - inst.tAir);
      // (both end at the built-in landing's 0.8, which the landing phase starts from: a hind leg arriving
      // at 0.35 snapped to it, 225 rad/s* at the hind paw)
      const extF = 0.3 + 0.5 * smooth(0.15, 0.85, x);
      const extH = 1 - 0.2 * smooth(0.4, 1, x);
      for (let i = 0; i < 4; i++) P.legs[i].extend = lerp(P.legs[i].extend, i < 2 ? extF : extH, k);
    }
  },
};

export const hooks = {
  update,
  actions: { standup, sniff, dig, sit, sleep, attack, hit, jump },
};
