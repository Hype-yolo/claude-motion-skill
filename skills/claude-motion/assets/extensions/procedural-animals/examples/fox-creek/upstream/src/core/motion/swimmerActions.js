// Action layer for the swimmer engine (core/motion/swimmer.js). Same contract as the quadruped layer:
// every frame it fills a parameter set P that the engine reads on top of the swimming.
//
//   postures  sit (hover still), lie (rest on the bed), sleep (rest, slow breathing, fins still;
//             style 'bottom' | 'hover' | 'side'), death (loses balance, rolls onto its side, sinks and
//             settles on the uneven bed): replace the swimming until 'stand' or a move request.
//   one-shots burst (C-start fast start), jump (rise, leap out of the water, splash back), eat (lunge +
//             suction bite; style 'bottom' picks food from the bed), drink (a gulp at the surface when
//             it is close, else the same suction gulp as eat), attack (turn, burst and bite: emits
//             attackHit at the mouth), hit (C-start away from the blow and a short dart).
//   idle      automatic: hovering, fin sculling and breathing come from the engine; the layer adds
//             looking around, small reorientations and a slow vertical bob.
//
// play(name, opts) returns a Promise resolved when the action ends (postures: when the pose is
// reached). opts: target (Vector3: attack / eat / look), direction (Vector3: hit = the direction the blow
// travels, burst = the escape direction), heading (burst), side (+1 left / -1 right), speed (time scale).
// The promise resolves with how the action ended: 'done' | 'interrupted' | 'stopped' | 'refused'.
//
// Arbitration (the rule of every body plan): a new one-shot
// interrupts the running ones (they fade out, 'interrupted'); a leap out of the water (jump while in
// the air) is committed: only a hit layers over it, anything else is refused. A posture cross-fades
// from the current one and ends the one-shots (not a hit). stop(name) ends that action, stop() every
// one-shot and posture but death. Dead: only hit is taken, moving does not revive; a dead swimmer
// loses way (it coasts to a stop), rolls over and sinks to the bed.
import * as THREE from 'three';
import { clamp, lerp, smooth, angDiff } from './common.js';

export function createSwimParams() {
  return {
    speed: 0, speedW: 0, brake: 0, accelK: 0, heading: 0, headingW: 0, turnK: 0, yawRate: 0,
    pitch: 0, pitchW: 0, pitchK: 0, breach: 0, surfaceOK: 0, vy: 0, vyW: 0, push: new THREE.Vector3(),
    groundW: 0, conform: 0, roll: 0, rollW: 0, rollK: 0,
    freqK: 1, freqAdd: 0, ampK: 1, pectK: 1, pectAmp: 1, fold: 0, flare: 0, pectAb: 0, pelvicAb: 0,
    bend: 0, bendK: 0, bendHold: 0, arch: 0, droop: 0, headWave: 0,
    breathRate: 1, breathAmp: 1, stress: 0, opFlare: 0, gape: 0, gapeFast: 0, protrude: 0,
    look: null, lookW: 1, alive: 1, headLift: 0, headShake: 0, eyeRoll: 0, nictitate: 0,
  };
}

function resetParams(P, stress) {
  P.speed = 0; P.speedW = 0; P.brake = 0; P.accelK = 0; P.heading = 0; P.headingW = 0; P.turnK = 0; P.yawRate = 0;
  P.pitch = 0; P.pitchW = 0; P.pitchK = 0; P.breach = 0; P.surfaceOK = 0; P.vy = 0; P.vyW = 0; P.push.set(0, 0, 0);
  P.groundW = 0; P.conform = 0; P.roll = 0; P.rollW = 0; P.rollK = 0;
  P.freqK = 1; P.freqAdd = 0; P.ampK = 1; P.pectK = 1; P.pectAmp = 1; P.fold = 0; P.flare = 0; P.pectAb = 0; P.pelvicAb = 0;
  P.bend = 0; P.bendK = 0; P.bendHold = 0; P.arch = 0; P.droop = 0; P.headWave = 0;
  P.breathRate = 1; P.breathAmp = 1; P.stress = stress; P.opFlare = 0; P.gape = 0; P.gapeFast = 0; P.protrude = 0;
  P.look = null; P.lookW = 1; P.alive = 1; P.headLift = 0; P.headShake = 0; P.eyeRoll = 0; P.nictitate = 0;
}

// Shark bite (attack / eat 'tear' / breach): the snout lifts, the lower jaw drops, the upper jaw
// protrudes a moment later, the eye rolls back (white shark) or the nictitating membrane closes
// (carcharhinids), the jaws close and the head shakes side to side to saw off a piece. t0 = start
// of the bite, tune = { headLift, shake, eye }; returns the time the jaws close.
function sharkBite(P, w, t, t0, tune, side) {
  const lift = tune.headLift || 0;
  const b = (a, bb, c, d) => bump(t - t0, a, bb, c, d);
  mx(P, 'headLift', lift, w * b(-0.04, 0.1, 0.26, 0.42));
  const open = b(0.0, 0.12, 0.22, 0.3);
  mx(P, 'gape', 1.1 * open, w); mx(P, 'gapeFast', 1, w);
  mx(P, 'protrude', b(0.06, 0.16, 0.3, 0.42), w);
  const nS = tune.shake || 0, per = 0.34;
  const eyeEnd = 0.36 + nS * per;
  const eye = b(0.06, 0.12, eyeEnd, eyeEnd + 0.15);
  if (tune.eye === 'roll') mx(P, 'eyeRoll', 1, w * eye);
  else if (tune.eye === 'nictitate') mx(P, 'nictitate', 1, w * eye);
  if (nS > 0) {
    // hold the bite (jaws nearly shut on the prey) and shake the head
    const ts = t - t0 - 0.3;
    const env = smooth(0, 0.12, ts) * (1 - smooth(nS * per - 0.1, nS * per + 0.05, ts));
    const sh = Math.sin((Math.max(0, ts) / per) * Math.PI * 2) * env * side;
    mx(P, 'headShake', 0.3 * sh, w);
    mx(P, 'bend', -0.25 * sh, w); mx(P, 'bendK', 2, w);
    mx(P, 'gape', P.gape + 0.12 * env, w);
    mx(P, 'protrude', P.protrude + 0.5 * env, w);
  }
  return t0 + 0.3;
}


const mx = (P, k, v, w) => { P[k] += (v - P[k]) * w; };
// angle-aware blend of the heading target
const mxH = (P, v, w) => {
  if (P.headingW <= 0) { P.heading = v; P.headingW = w; return; }
  P.heading += angDiff(P.heading, v) * w; P.headingW += (1 - P.headingW) * w;
};
const bump = (t, a, b, c, d) => smooth(a, b, t) * (1 - smooth(c, d, t));

// height of the fish's centre when its lowest skin rests on the bed here
function restY(e) { return e.groundAt(e.pos.x, e.pos.z) + e.cBelow; }
// slope of the bed along / across the heading
function bedSlope(e, out) {
  const L = e.cfg.L, h = e.heading;
  const fx = Math.sin(h) * L * 0.4, fz = Math.cos(h) * L * 0.4, lx = Math.cos(h) * L * 0.2, lz = -Math.sin(h) * L * 0.2;
  const x = e.pos.x, z = e.pos.z;
  out.pitch = Math.atan2(e.groundAt(x + fx, z + fz) - e.groundAt(x - fx, z - fz), L * 0.8);
  out.roll = Math.atan2(e.groundAt(x + lx, z + lz) - e.groundAt(x - lx, z - lz), L * 0.4);
  return out;
}

// ------------------------------------------------------------------------------------------------
// Postures
// ------------------------------------------------------------------------------------------------
const POSTURES = {
  // hover still where it is: fins keep sculling slowly, the tail barely moves
  sit: {
    fadeIn: 0.9, fadeOut: 0.7,
    apply(P, w, inst, A) {
      const e = A.engine;
      if (e.cfg.minSpeed > 0) { mx(P, 'breathRate', 0.8, w); return; }
      mx(P, 'speed', 0, 1); mx(P, 'speedW', 1, w); mx(P, 'brake', 0.6, w * (1 - smooth(0.4, 1, inst.t)));
      mx(P, 'vy', 0, 1); mx(P, 'vyW', 1, w);
      mx(P, 'ampK', 0.45, w); mx(P, 'pectAmp', 0.55, w); mx(P, 'breathRate', 0.9, w);
      void e;
    },
  },
  // settle onto the bed: sink gently, level the body on the bed, fins as props
  lie: {
    fadeIn: 1.6, fadeOut: 1.2,
    apply(P, w, inst, A) {
      const e = A.engine, L = e.cfg.L, tune = inst.tune;
      if (e.cfg.minSpeed > 0) { inst.near = 1; mx(P, 'breathRate', 0.7, w); return; }
      const h = e.pos.y - restY(e);
      const near = smooth(0.25 * L, 0.02 * L, h);
      inst.near = near;
      mx(P, 'speed', 0, 1); mx(P, 'speedW', 1, w); mx(P, 'brake', 0.4, w);
      mx(P, 'vy', -clamp(h * 2.5, 0.06 * L, 0.5 * L), 1); mx(P, 'vyW', 1, w);
      mx(P, 'groundW', 1, w);
      const sl = bedSlope(e, A._slope);
      mx(P, 'pitch', sl.pitch, 1); mx(P, 'pitchW', near, w);
      const side = tune.style === 'side' || inst.style === 'side' ? inst.side * 0.42 : 0;
      mx(P, 'roll', -sl.roll + side, 1); mx(P, 'rollW', near, w);
      mx(P, 'conform', 0, w);
      mx(P, 'ampK', 0.3, w); mx(P, 'freqK', 0.6, w); mx(P, 'pectAmp', 0.35, w); mx(P, 'pelvicAb', 12, w * near);
      mx(P, 'breathRate', 0.85, w);
    },
  },
  sleep: {
    fadeIn: 1.8, fadeOut: 1.3,
    apply(P, w, inst, A) {
      const style = inst.tune.style || 'bottom';
      if (style === 'hover') POSTURES.sit.apply(P, w, inst, A);
      else POSTURES.lie.apply(P, w, inst, A);
      const c = smooth(0.8, 3, inst.t) * w;
      mx(P, 'breathRate', 0.55, c); mx(P, 'breathAmp', 0.7, c); mx(P, 'pectAmp', 0.08, c); mx(P, 'ampK', 0.12, c);
      mx(P, 'lookW', 0, c);
      if (style !== 'hover') mx(P, 'pitch', P.pitch - 0.06, c);
    },
  },
  // loses balance (wobbling roll, flared fins, twitching tail), rolls onto its side, sinks and settles
  death: {
    fadeIn: 0.3, fadeOut: 1.6,
    apply(P, w, inst, A) {
      const e = A.engine, L = e.cfg.L, t = inst.t, side = inst.side;
      const h = e.pos.y - restY(e);
      const near = smooth(0.3 * L, 0.03 * L, h);
      const wob = smooth(0, 0.4, t) * (1 - smooth(1.0, 1.8, t));
      const over = smooth(0.6, 2.2, t);
      mx(P, 'alive', 0, w);
      mx(P, 'speed', 0, 1); mx(P, 'speedW', 1, w); mx(P, 'brake', 0.3, w);
      mx(P, 'roll', side * (0.45 * wob * Math.sin(t * 7.5) + over * (inst.tune.roll ?? Math.PI * 0.5)), 1); mx(P, 'rollW', 1, w); mx(P, 'rollK', 0.6, w);
      // sinks once it is over, faster at first, then settles
      const sink = -clamp(h * 1.2, 0.03 * L, 0.45 * L) * smooth(0.4, 1.4, t);
      mx(P, 'vy', sink, 1); mx(P, 'vyW', 1, w);
      mx(P, 'groundW', 1, w);
      mx(P, 'pitch', -0.12 * over * (1 - near), 1); mx(P, 'pitchW', w, 1);
      mx(P, 'conform', near * smooth(1.2, 2.6, t), w);
      // tail twitches, then stillness; fins flare; mouth gapes, gill covers flare
      const twitch = wob * (0.8 + 0.6 * Math.sin(t * 13));
      mx(P, 'ampK', twitch, w); mx(P, 'freqK', 0.6, w);
      mx(P, 'pectAmp', 0.4 * wob, w); mx(P, 'flare', 0.8 * wob + 0.2 * (1 - over), w);
      // once over on its side the paired fins fall flat against the body
      mx(P, 'fold', 1, w * over);
      mx(P, 'breathAmp', 0, w); mx(P, 'breathRate', 0.1, w);
      mx(P, 'gape', 0.55 * smooth(0.5, 1.6, t), w); mx(P, 'opFlare', 0.9 * smooth(0.3, 1.2, t), w);
      mx(P, 'droop', -0.06 * over, w);
      mx(P, 'lookW', 0, w);
      mx(P, 'stress', 0, w);
    },
  },
};

// ------------------------------------------------------------------------------------------------
// One-shots
// ------------------------------------------------------------------------------------------------
// fast start: stage 1 bends the body into a C (the head swings round), stage 2 is the return stroke
// that throws the fish forward, then a short sprint that fades back to the requested speed
function startCStart(inst, A, turn) {
  const e = A.engine, L = e.cfg.L;
  inst.h0 = e.heading;
  inst.turn = turn;
  const t1 = clamp(0.24 * L + 0.012, 0.035, 0.2);
  inst.t1 = t1; inst.t2 = t1 * 1.1;
  inst.dur = t1 + inst.t2 + (inst.tune.coast ?? 0.9);
  inst.side = Math.sign(turn) || 1;
  e.input.heading = e.heading + turn;
  A.stress = 1;
}
function applyCStart(P, w, a, A, speedK = 1) {
  const e = A.engine, cfg = e.cfg, t = a.t, t1 = a.t1, t2 = a.t2, T = t1 + t2;
  const turnW = smooth(0, T * 0.85, t);
  // C-bend: up during stage 1, reversed during stage 2, relaxed after
  const s1 = Math.sin(Math.min(1, t / t1) * Math.PI * 0.5);
  const cb = cfg.spec.cBend * clamp(Math.abs(a.turn) / 1.6, 0.45, 1) * a.side;
  const bend = t < t1 ? cb * s1 * s1 : t < T + 0.25 ? lerp(cb, -0.3 * cb, smooth(t1, t1 + t2 * 0.8, t)) * (1 - smooth(T, T + 0.25, t)) : 0;
  mx(P, 'bend', bend, w); mx(P, 'bendK', 5, w); mx(P, 'bendHold', 1, w * (1 - smooth(T, T + 0.4, t)));
  mxH(P, a.h0 + a.turn * turnW, w * (1 - smooth(T + 0.2, T + 0.5, t)));
  mx(P, 'turnK', 12, w);
  const dEase = t < T * 0.85 ? (6 * (t / (T * 0.85)) * (1 - t / (T * 0.85))) / (T * 0.85) : 0;
  mx(P, 'yawRate', a.turn * dEase, w);
  // the sprint
  const go = smooth(t1 * 0.5, T, t) * (1 - smooth(a.dur - 0.45, a.dur, t));
  mx(P, 'speed', cfg.burstSpeed * speedK, 1); mx(P, 'speedW', go, w); mx(P, 'accelK', 7, w);
  mx(P, 'fold', 1, w * (1 - smooth(a.dur - 0.5, a.dur, t)));
  mx(P, 'ampK', 1.15, w);
}

const ONESHOTS = {
  burst: {
    start(inst, A) {
      const e = A.engine, o = inst.opts, tune = inst.tune;
      let turn;
      if (o.direction) turn = angDiff(e.heading, Math.atan2(o.direction.x, o.direction.z));
      else if (o.heading !== undefined) turn = angDiff(e.heading, o.heading);
      else {
        const side = o.side ?? (e.rand() < 0.5 ? -1 : 1);
        turn = side * ((tune.turn ?? 90) + (e.rand() - 0.5) * 50) * Math.PI / 180;
      }
      turn = clamp(turn, -2.6, 2.6);
      startCStart(inst, A, turn);
    },
    update(a) { return a.t >= a.dur; },
    apply(P, w, a, A) { applyCStart(P, w, a, A, 1); },
  },
  hit: {
    start(inst, A) {
      const e = A.engine, o = inst.opts;
      let turn;
      if (o.direction) turn = angDiff(e.heading, Math.atan2(o.direction.x, o.direction.z));
      else turn = (e.rand() < 0.5 ? -1 : 1) * 1.6;
      // escape away from the blow (never more than ~150 degrees)
      turn = clamp(turn, -2.6, 2.6);
      if (Math.abs(turn) < 0.5) turn = Math.sign(turn || 1) * 0.5;
      inst.tune = { coast: 0.7, ...inst.tune };
      startCStart(inst, A, turn);
      inst.wob = e.rand() < 0.5 ? -1 : 1;
    },
    update(a) { return a.t >= a.dur; },
    apply(P, w, a, A) {
      applyCStart(P, w, a, A, 0.85);
      const t = a.t;
      mx(P, 'roll', a.wob * 0.35 * Math.sin(t * 9) * bump(t, 0, 0.1, 0.4, 0.9), 1); mx(P, 'rollW', w, 1);
      mx(P, 'opFlare', 0.6, w * bump(t, 0.05, 0.2, 0.6, 1.2));
      // a visible jolt: the blow shoves the body sideways, every fin flares
      const e = A.engine, L = e.cfg.L, j = bump(t, 0, 0.03, 0.12, 0.35) * w * 1.6 * L;
      if (a.opts.direction) P.push.addScaledVector(a.opts.direction, j / Math.max(1e-6, a.opts.direction.length()));
      mx(P, 'flare', 1, w * bump(t, 0, 0.05, 0.25, 0.6)); mx(P, 'pelvicAb', 18, w * bump(t, 0, 0.05, 0.25, 0.6));
    },
  },
  attack: {
    start(inst, A) {
      const e = A.engine, L = e.cfg.L;
      const tgt = inst.opts.target;
      inst.target = tgt ? tgt.clone() : e.pos.clone().add(new THREE.Vector3(Math.sin(e.heading) * 1.4 * L, 0, Math.cos(e.heading) * 1.4 * L));
      inst.shark = !!(inst.tune.headLift || inst.tune.shake || inst.tune.eye);
      inst.dur = inst.shark ? 1.3 + (inst.tune.shake || 0) * 0.34 : 1.25;
      inst.hit = false;
      const d = inst.target.clone().sub(e.pos);
      inst.turn = angDiff(e.heading, Math.atan2(d.x, d.z));
      inst.pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.6, 0.6);
      inst.side = Math.sign(inst.turn) || 1;
      e.input.heading = e.heading + inst.turn;
      A.stress = 1;
    },
    update(a) { return a.t >= a.dur; },
    apply(P, w, a, A) {
      const e = A.engine, cfg = e.cfg, t = a.t;
      mxH(P, e.input.heading, w); mx(P, 'turnK', 4, w);
      mx(P, 'pitch', a.pitch, 1); mx(P, 'pitchW', w * bump(t, 0, 0.15, 0.35, 0.6), 1);
      // S-start: a small counter-bend, then the lunge
      mx(P, 'bend', -0.5 * a.side * bump(t, 0.0, 0.1, 0.12, 0.25), w); mx(P, 'bendK', 3, w);
      const go = bump(t, 0.1, 0.22, 0.5, 0.9);
      mx(P, 'speed', cfg.burstSpeed * 0.85 * (a.tune.lunge ?? 1), 1); mx(P, 'speedW', go, w); mx(P, 'accelK', 6, w);
      mx(P, 'fold', 1, w * bump(t, 0.05, 0.15, 0.7, 1.0));
      // the bite: open wide just before contact, snap shut
      if (a.shark) sharkBite(P, w, t, 0.16, a.tune, a.side);
      else {
        const open = bump(t, 0.22, 0.34, 0.42, 0.5);
        mx(P, 'gape', 1.1 * open, w); mx(P, 'gapeFast', 1, w); mx(P, 'protrude', open, w);
      }
      mx(P, 'opFlare', 0.8, w * bump(t, 0.45, 0.55, 0.8, 1.1));
      if (!a.hit && t >= 0.44) {
        a.hit = true;
        const mouth = e.W[e.cfg.n + 1].clone();
        const dir = new THREE.Vector3(Math.sin(e.heading), 0, Math.cos(e.heading));
        e.emit('attackHit', { position: mouth, direction: dir, style: 'bite' });
      }
    },
  },
  eat: {
    start(inst, A) {
      const e = A.engine, L = e.cfg.L, tune = inst.tune;
      inst.style = tune.style || 'suction';
      if (inst.style === 'tear') { inst.dur = 1.2 + (tune.shake || 0) * 0.34; inst.side = e.rand() < 0.5 ? -1 : 1; inst.turn = undefined; return; }
      const hBed = e.W[e.cfg.n + 1].y - e.groundAt(e.W[e.cfg.n + 1].x, e.W[e.cfg.n + 1].z);
      if (inst.style === 'bottom' && hBed > 1.6 * L) inst.style = 'suction';
      inst.dur = inst.style === 'bottom' ? 2.8 : 1.5;
      if (inst.opts.target) {
        const d = inst.opts.target.clone().sub(e.pos);
        inst.turn = angDiff(e.heading, Math.atan2(d.x, d.z));
        e.input.heading = e.heading + inst.turn;
      }
      inst.hBed = hBed;
    },
    update(a) { return a.t >= a.dur; },
    apply(P, w, a, A) {
      const e = A.engine, cfg = e.cfg, L = cfg.L, t = a.t;
      if (a.style === 'tear') {
        // sharks: a slow approach, a bite with the head lifted, shakes, release
        mx(P, 'speed', Math.max(e.wantSpeed, 0.4 * L), 1); mx(P, 'speedW', bump(t, 0, 0.2, a.dur - 0.4, a.dur), w); mx(P, 'accelK', 1, w);
        sharkBite(P, w, t, 0.1, a.tune, a.side);
        return;
      }
      if (a.style === 'bottom') {
        // head-down over the bed, two nips, back up
        const down = bump(t, 0.1, 0.7, 2.0, 2.6);
        mx(P, 'pitch', -0.75, 1); mx(P, 'pitchW', down, w); mx(P, 'pitchK', 1, w);
        mx(P, 'speed', 0, 1); mx(P, 'speedW', 1, w);
        const h = e.W[cfg.n + 1].y - e.groundAt(e.W[cfg.n + 1].x, e.W[cfg.n + 1].z);
        mx(P, 'vy', -clamp((h - 0.06 * L) * 1.5, -0.3 * L, 0.35 * L) * bump(t, 0.2, 0.6, 1.8, 2.2), 1); mx(P, 'vyW', w * down, 1);
        mx(P, 'groundW', 0.6, w);
        const nip = bump(t, 0.85, 0.95, 1.05, 1.15) + bump(t, 1.35, 1.45, 1.55, 1.65);
        mx(P, 'gape', 0.9 * nip, w); mx(P, 'gapeFast', 1, w); mx(P, 'protrude', nip, w);
        mx(P, 'opFlare', 0.5, w * (bump(t, 1.1, 1.2, 1.3, 1.4) + bump(t, 1.6, 1.7, 1.8, 1.9)));
        mx(P, 'pectAmp', 1.3, w); mx(P, 'flare', 0.3, w * down);
        return;
      }
      // suction: a short lunge; the mouth snaps open (the buccal cavity expands), closes, then the
      // gill covers flare to push the water out; two chews
      const lunge = bump(t, 0.05, 0.15, 0.3, 0.5);
      mx(P, 'speed', Math.max(e.wantSpeed, 2.2 * L), 1); mx(P, 'speedW', lunge, w); mx(P, 'accelK', 3, w);
      const open = bump(t, 0.16, 0.24, 0.3, 0.4);
      mx(P, 'gape', 1.0 * open, w); mx(P, 'gapeFast', 1, w); mx(P, 'protrude', open, w);
      mx(P, 'opFlare', 0.9, w * bump(t, 0.38, 0.48, 0.62, 0.8));
      const chew = 0.35 * (bump(t, 0.8, 0.88, 0.94, 1.02) + bump(t, 1.08, 1.16, 1.22, 1.3));
      mx(P, 'gape', P.gape + chew, w);
      if (a.turn !== undefined) { mxH(P, e.input.heading, w); mx(P, 'turnK', 2, w); }
    },
  },
  drink: {
    start(inst, A) {
      const e = A.engine, L = e.cfg.L;
      const surf = e.surfaceAt(e.pos.x, e.pos.z);
      const reach = (inst.tune.reach ?? 3) * L;
      inst.gulp = Number.isFinite(surf) && surf - e.pos.y < reach;
      inst.surf = surf;
      inst.dur = inst.gulp ? 3.0 : 1.5;
      if (!inst.gulp) { inst.style = 'suction'; }
    },
    update(a) { return a.t >= a.dur; },
    apply(P, w, a, A) {
      if (!a.gulp) { ONESHOTS.eat.apply(P, w, a, A); return; }
      // rise nose-up until the mouth touches the surface, gulp air / food, sink back
      const e = A.engine, cfg = e.cfg, L = cfg.L, t = a.t;
      const up = bump(t, 0.0, 0.5, 2.2, 2.9);
      mx(P, 'speed', 0, 1); mx(P, 'speedW', 1, w);
      mx(P, 'pitch', 0.5, 1); mx(P, 'pitchW', up, w);
      const snout = e.W[cfg.n + 1];
      const gap = a.surf - snout.y - 0.02 * L;
      const vy = t < 2.1 ? clamp(gap * 3, -0.3 * L, 0.8 * L) : -0.6 * L;
      mx(P, 'vy', vy, 1); mx(P, 'vyW', w * up, 1);
      mx(P, 'surfaceOK', 1, w * up);
      const g = bump(t, 1.1, 1.2, 1.35, 1.5) + bump(t, 1.6, 1.7, 1.85, 2.0);
      mx(P, 'gape', 0.9 * g, w); mx(P, 'gapeFast', 1, w); mx(P, 'protrude', g, w);
      mx(P, 'opFlare', 0.6, w * bump(t, 1.4, 1.5, 1.6, 1.75));
      mx(P, 'pectAmp', 1.4, w);
    },
  },
  jump: {
    start(inst, A) {
      const e = A.engine, L = e.cfg.L, tune = inst.tune;
      const surf = e.surfaceAt(e.pos.x, e.pos.z);
      const h = (tune.height ?? 1.5) * L;
      inst.vBreach = Math.min(Math.sqrt(2 * 9.81 * h) * 1.1, e.cfg.burstSpeed * 1.4);
      inst.surf = Number.isFinite(surf) && surf - e.pos.y < 10 * L ? surf : null;
      inst.phase = 'rise';
      inst.dur = 6;
      inst.tAir = null;
      A.stress = 1;
    },
    update(a, dt, A) {
      const e = A.engine;
      if (a.phase === 'rise' && e.air) { a.phase = 'air'; a.tAir = a.t; }
      if (a.phase === 'air' && !e.air) { a.phase = 'dive'; a.tDive = a.t; }
      if (a.phase === 'rise' && !a.surf && a.t > 0.9) { a.phase = 'dive'; a.tDive = a.t; }
      if (a.phase === 'rise' && a.t > 4) { a.phase = 'dive'; a.tDive = a.t; }
      return a.phase === 'dive' && a.t - a.tDive > 1.0;
    },
    apply(P, w, a, A) {
      const e = A.engine, L = e.cfg.L, t = a.t;
      if (a.phase === 'rise') {
        // steep, fast ascent (from deeper water it first swims up)
        const d = a.surf ? a.surf - e.pos.y : 2 * L;
        const steep = smooth(0, 0.35, t);
        mx(P, 'pitch', d > 3 * L ? 0.75 : 1.0, 1); mx(P, 'pitchW', w * steep, 1); mx(P, 'pitchK', 1.5, w);
        mx(P, 'speed', a.vBreach, 1); mx(P, 'speedW', w * smooth(0.05, 0.3, t), 1); mx(P, 'accelK', 5, w);
        mx(P, 'breach', 1, w); mx(P, 'surfaceOK', 1, w);
        mx(P, 'fold', 1, w);
        if (a.tune.bite && a.surf) {
          // ambush from below: the jaws open on the way up
          const near = smooth(1.4 * L, 0.3 * L, a.surf - e.pos.y);
          mx(P, 'gape', 1.0 * near, w); mx(P, 'protrude', near, w); mx(P, 'headLift', 0.25 * near, w);
          mx(P, 'eyeRoll', 1, w * near);
        }
      } else if (a.phase === 'air') {
        const ta = t - a.tAir;
        // arched in flight, tail still beating for a moment, fins spread
        mx(P, 'arch', 0.5 * Math.sin(Math.min(1, ta / 0.5) * Math.PI), w);
        mx(P, 'breach', 1, w); mx(P, 'surfaceOK', 1, w);
        mx(P, 'ampK', 0.7 * (1 - smooth(0.1, 0.35, ta)), w);
        mx(P, 'flare', 0.5, w); mx(P, 'fold', 0, w);
        mx(P, 'bend', 0.25 * Math.sin(ta * 9) * (1 - smooth(0.1, 0.4, ta)), w);
        if (a.tune.bite) {
          // the bite on the way up, closing in the air
          const cl = 1 - smooth(0.05, 0.35, ta);
          mx(P, 'gape', cl, w); mx(P, 'protrude', cl, w); mx(P, 'headLift', 0.25 * cl, w); mx(P, 'eyeRoll', 1, w * (1 - smooth(0.3, 0.6, ta)));
        }
        if (a.tune.roll) {
          // twists in the air and falls back on its side
          if (a.rollSide === undefined) a.rollSide = e.rand() < 0.5 ? -1 : 1;
          mx(P, 'roll', a.rollSide * a.tune.roll * smooth(0.0, 0.9, ta), 1); mx(P, 'rollW', w, 1); mx(P, 'rollK', 0.8, w);
        }
      } else {
        // back under: level out and slow down to the previous depth
        const td = t - a.tDive;
        mx(P, 'pitch', -0.4 * (1 - smooth(0.2, 0.9, td)), 1); mx(P, 'pitchW', w, 1); mx(P, 'pitchK', 1, w);
        mx(P, 'speed', e.wantSpeed, 1); mx(P, 'speedW', w * (1 - smooth(0.6, 1.0, td)), 1);
        mx(P, 'brake', 1, w * (1 - smooth(0.3, 0.8, td)));
        mx(P, 'surfaceOK', 1, w * (1 - smooth(0.0, 0.5, td)));
        if (a.tune.roll && a.rollSide !== undefined) {
          // rights itself under water
          mx(P, 'roll', a.rollSide * a.tune.roll * (1 - smooth(0.1, 0.9, td)), 1); mx(P, 'rollW', w, 1); mx(P, 'rollK', 0.5, w);
        }
      }
    },
  },
};

// ------------------------------------------------------------------------------------------------
export class SwimmerActions {
  constructor(engine) {
    this.engine = engine;
    this.tuning = engine.cfg.actions || {};
    this.names = ['idle', 'burst', 'jump', 'sit', 'lie', 'sleep', 'eat', 'drink', 'attack', 'hit', 'death', 'stand'];
    this.postures = [];
    this.oneshots = [];
    this.posture = 'stand';
    this.standReq = null;
    this.stress = 0;
    this._slope = { pitch: 0, roll: 0 };
    this.idle = { t: 0, lookT: 1, look: new THREE.Vector3(), hasLook: false, turnT: 4, w: 0, bob: 0 };
  }

  // obligate ram ventilators (minSpeed > 0: sharks) keep patrolling in their rest postures
  holdsStill() { const ram = this.engine.cfg.minSpeed > 0; return this.postures.some((p) => (p.target > 0 || p.w > 0.05) && (!ram || p.name === 'death')); }
  dead() { return this.postures.some((p) => p.name === 'death' && p.target > 0); }
  // automatic stand-up (asked to move): never revives a dead swimmer
  requestStand() { if (!this.standReq && !this.dead()) this.play('stand'); }
  // a leap out of the water cannot be cut
  committed(a) { return !a.stopping && !!this.engine.air && (a.name === 'jump' || a.name === 'attack' || a.name === 'burst'); }
  end(a, reason) { if (a.stopping) return; a.stopping = true; a.reason = reason; }
  current() {
    const o = this.oneshots.find((a) => !a.stopping);
    if (o) return o.name;
    const p = this.postures.find((x) => x.target > 0);
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
      for (const p of this.postures) if (p.target > 0) { p.target = 0; p.resolveIn?.('interrupted'); }
      e.emit('actionStart', { name: 'stand' });
      if (this.standReq) return this.standReq.promise;
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      this.standReq = { promise, resolve };
      return promise;
    }
    if (POSTURES[name]) {
      const cur = this.postures.find((p) => p.target > 0);
      if (cur && cur.name === 'death' && name !== 'death') return Promise.resolve('refused');
      if (cur && cur.name === name) return cur.promiseIn;
      if (name !== 'death' && this.oneshots.some((a) => this.committed(a))) return Promise.resolve('refused');
      for (const p of this.postures) if (p.target > 0) { p.target = 0; p.resolveIn?.('interrupted'); }
      if (this.standReq) { this.standReq.resolve('interrupted'); this.standReq = null; }
      for (const a of this.oneshots) if (a.name !== 'hit' && !this.committed(a)) this.end(a, 'interrupted');
      let side = opts.side ?? (e.rand() < 0.5 ? -1 : 1);
      if (opts.direction && name === 'death') side = (opts.direction.x * Math.cos(e.heading) - opts.direction.z * Math.sin(e.heading)) > 0 ? -1 : 1;
      const prev = this.postures.find((p) => p.name === 'lie' || p.name === 'sleep');
      if (prev && opts.side === undefined) side = prev.side;
      const def = POSTURES[name];
      const inst = { name, t: 0, w: 0, target: 1, fadeIn: def.fadeIn / (opts.speed || 1), fadeOut: def.fadeOut, side, opts, tune: this.tuning[name] || {}, reached: false };
      if (prev && name === 'sleep') { inst.w = prev.w; inst.t = prev.t; prev.w = 0; prev.target = 0; this.postures = this.postures.filter((p) => p !== prev); }
      inst.promiseIn = new Promise((r) => { inst.resolveIn = r; });
      this.postures.push(inst);
      e.emit('actionStart', { name });
      if (name === 'death') e.emit('death', { position: e.pos.clone() });
      return inst.promiseIn;
    }
    const def = ONESHOTS[name];
    if (!def) return Promise.reject(new Error(`procedural-animals: unknown action "${name}"`));
    if (this.dead() && name !== 'hit') return Promise.resolve('refused');
    if (this.holdsStill() && name !== 'hit') return this.play('stand').then((r) => (r === 'refused' ? r : this.play(name, opts)));
    if (e.air && name !== 'hit') return Promise.resolve('refused');
    // arbitration: a new one-shot interrupts the running ones (a leap in the air only takes a hit)
    if (this.oneshots.some((a) => this.committed(a))) { for (const a of this.oneshots) if (a.name === name) this.end(a, 'interrupted'); }
    else for (const a of this.oneshots) this.end(a, 'interrupted');
    const inst = { name, t: 0, w: 0, dur: 1, stopping: false, opts, tune: { ...(this.tuning[name] || {}) }, fade: name === 'burst' || name === 'hit' ? 0.03 : 0.12, speed: opts.speed || 1 };
    def.start(inst, this);
    inst.promise = new Promise((r) => { inst.resolve = r; });
    this.oneshots.push(inst);
    e.emit('actionStart', { name });
    return inst.promise;
  }

  stop(name) {
    for (const a of this.oneshots) if ((!name || a.name === name) && !this.committed(a)) this.end(a, 'stopped');
    if (!name || POSTURES[name]) if (this.postures.some((p) => p.target > 0 && (name ? p.name === name : p.name !== 'death'))) this.play('stand');
  }

  onLand() {}

  update(dt) {
    const e = this.engine, P = e.P;
    this.stress = Math.max(0, this.stress - dt * 0.15);
    resetParams(P, this.stress);
    // ---- postures
    for (const p of this.postures) {
      p.t += dt;
      const rate = p.target > p.w ? 1 / p.fadeIn : 1 / p.fadeOut;
      p.w = clamp(p.w + clamp(p.target - p.w, -rate * dt, rate * dt), 0, 1);
      const settled = p.name === 'death' ? p.t > 2.6 : p.name === 'lie' || p.name === 'sleep' ? (p.near ?? 1) > 0.9 || p.t > 6 : true;
      if (!p.reached && p.target > 0 && p.w >= 1 && settled) { p.reached = true; p.resolveIn('done'); e.emit('actionEnd', { name: p.name }); }
    }
    this.postures = this.postures.filter((p) => p.target > 0 || p.w > 0);
    const active = this.postures.find((p) => p.target > 0);
    this.posture = active ? (active.name === 'death' ? 'dead' : active.name) : this.postures.length ? 'standing-up' : 'stand';
    if (this.standReq && !this.postures.length) { this.standReq.resolve('done'); this.standReq = null; e.emit('actionEnd', { name: 'stand' }); }
    // ---- idle
    const L = e.cfg.L;
    const still = e.speed < 0.08 * L && !e.input.follow && !e.input.target;
    const idleTarget = still && !this.postures.length && !this.oneshots.some((a) => !a.stopping) ? 1 : 0;
    const id = this.idle;
    id.w += clamp(idleTarget - id.w, -dt * 1.5, dt * 0.7);
    this.applyIdle(P, id.w, dt);
    // ---- postures
    for (const p of this.postures) {
      const w = p.w * p.w * (3 - 2 * p.w);
      POSTURES[p.name].apply(P, w, p, this);
      p.near = p.near ?? 1;
    }
    // ---- one-shots
    // (a ram ventilator's minimum patrol speed is not a request to move)
    const wantsToMove = e.wantSpeed > Math.max(0.1 * L, e.cfg.minSpeed * 1.05) || !!e.input.follow;
    for (const a of this.oneshots) {
      if (wantsToMove && (a.name === 'eat' || a.name === 'drink') && a.t > 0.3) this.end(a, 'interrupted');
      a.t += dt * a.speed;
      const def = ONESHOTS[a.name];
      if (!a.stopping && def.update(a, dt * a.speed, this)) this.end(a, 'done');
      if (a.stopping) a.w = Math.max(0, a.w - dt / Math.max(0.05, a.fade * 2));
      else a.w = Math.min(1, a.w + dt / a.fade);
      const w = a.w * a.w * (3 - 2 * a.w);
      if (w > 0) def.apply(P, w, a, this);
    }
    for (const a of this.oneshots) if (a.stopping && a.w <= 0) { a.resolve(a.reason || 'done'); e.emit('actionEnd', { name: a.name, reason: a.reason || 'done' }); }
    this.oneshots = this.oneshots.filter((a) => !(a.stopping && a.w <= 0));
  }

  applyIdle(P, w, dt) {
    const e = this.engine, id = this.idle, L = e.cfg.L;
    if (w <= 0.001) { id.hasLook = false; return; }
    id.t += dt;
    // slow vertical bob and a little pectoral asymmetry
    id.bob += dt;
    mx(P, 'vy', 0.03 * L * Math.sin(id.bob * 0.9) + 0.015 * L * Math.sin(id.bob * 2.3 + 1), 1); mx(P, 'vyW', w * 0.6, 1);
    // occasional small reorientation (no target, no look request)
    id.turnT -= dt;
    if (id.turnT <= 0 && w > 0.9 && !e.input.look) {
      id.turnT = 5 + e.rand() * 8;
      if (e.rand() < 0.6) e.input.heading = e.heading + (e.rand() - 0.5) * 0.8;
    }
    if (!e.input.look) {
      id.lookT -= dt;
      if (id.lookT <= 0) {
        id.lookT = 1.2 + e.rand() * 2.6;
        if (e.rand() < 0.25) id.hasLook = false;
        else {
          const a = e.heading + (e.rand() - 0.5) * 2.2;
          const d = (3 + e.rand() * 6) * L;
          id.look.set(e.pos.x + Math.sin(a) * d, e.pos.y + (e.rand() - 0.5) * 2 * L, e.pos.z + Math.cos(a) * d);
          id.hasLook = true;
        }
      }
      if (id.hasLook) { P.look = id.look; P.lookW = w; }
    }
  }
}
