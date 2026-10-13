// Rat behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js):
//
//   pose(engine, dt)        after the engine's solve: sniffing (the snout bone twitches at 6-10 Hz in
//                           bursts), whisking (both whisker fans sweep forward and back in step with
//                           the sniffs, fanned forward when exploring, swept back when eating,
//                           grooming, fighting or asleep, and kept clear of the ground), small
//                           independent ear swivels
//   update(P, dt, layer)    every frame over the action layer: the scurrying style (body low and
//                           flattened, head stretched forward, ears back at speed), sniffing / whisking
//                           rates, the scurry-and-freeze steering, rearing to look at a far target,
//                           automatic idle variants (sniff scans, rearing, face grooming)
//   actions                 rear (stands up on the hind feet to look around), groom (the face-washing
//                           syntactic chain: nose strokes, face strokes, then body licking), eat (sits
//                           up holding food in the forepaws and gnaws it), scurry (a fast burst along
//                           the heading, a sudden stop, a freeze and a sniff), box (rears and pushes
//                           with the forepaws), attack (lunge bite, or boxing on the hind legs), hit
//                           (flinch, then a freeze)
//
// All distances are rat metres at the reference size, multiplied by cfg.s; posture offsets that the
// engine multiplies by cfg.k (fwd, side, headRaise, neckReach) are divided by cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tqa } from '../../core/motion/common.js';
import { mx, mxLeg, ONESHOTS } from '../../core/motion/actions.js';
import { whiskerSamples, WHISKER_BASE, WHISKER_TIP } from './whiskers.js';
import { HK } from './rig.js';

const W_SAMPLES = whiskerSamples();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3(), _a = new THREE.Vector3(), _d = new THREE.Vector3();
const _M = new THREE.Matrix4(), _sv = new THREE.Vector3();
const _w = Array.from({ length: 64 }, () => new THREE.Vector3());
const PI = Math.PI;

// per-engine behaviour state
function B(e) {
  if (!e._ratb) {
    e._ratb = {
      sniffPh: 0, sniffRate: 7, sniffAmp: 1, sniffT: 0, whiskPh: 0, whiskAmp: 0.6, fanT: 0.1,
      whisk: [{ a: 0, v: 0, back: 0, lift: 0 }, { a: 0, v: 0, back: 0, lift: 0 }],
      ear: [{ sw: 0, target: 0, tNext: 0.7, v: 0 }, { sw: 0, target: 0, tNext: 1.6, v: 0 }],
      idleT: 3 + e.rand() * 4, scanPh: 0, scanW: 0, scurry: null, freezeT: 0, rearFor: null,
    };
  }
  return e._ratb;
}
const busy = (L) => L.postures.length > 0 || L.oneshots.some((a) => !a.stopping);
const oneshotW = (L, name) => L.oneshots.reduce((m, a) => (a.name === name ? Math.max(m, a.w) : m), 0);

// whisker samples in the whisker bone's bind-local frame, mapped from the reference head (whiskers.js)
function whiskerLocal(e, kk) {
  const s = kk ? -1 : 1, S = kk ? 'R' : 'L';
  const i = e.sk.bones.indexOf(e.bone['whisker' + S]);
  const inv = e.sk.bind[i].clone().invert();
  const Jb = e.J['whiskerBase' + S], Jt = e.J['whiskerTip' + S];
  const refLen = HK * Math.hypot(WHISKER_TIP[0] - WHISKER_BASE[0], WHISKER_TIP[1] - WHISKER_BASE[1], WHISKER_TIP[2] - WHISKER_BASE[2]);
  const k = Jb.distanceTo(Jt) / refLen;
  // (the sample points were laid out with head-local offsets scaled by HK; the strand lengths are not)
  return W_SAMPLES.map((p) => new THREE.Vector3(Jb.x + (p[0] - WHISKER_BASE[0]) * s * k * HK, Jb.y + (p[1] - WHISKER_BASE[1]) * k * HK, Jb.z + (p[2] - WHISKER_BASE[2]) * k * HK).applyMatrix4(inv));
}

// ------------------------------------------------------------------------------------------------
// pose: sniffing snout, whisking fans, ear swivels (after the engine wrote the head and its children)
function pose(e, dt) {
  const b = B(e), P = e.P, cfg = e.cfg;
  if (e.lod >= 2) return;
  const awake = 1 - clamp(P.eyelid, 0, 1);
  // ---- sniffing: the nose and whisker pads twitch up and back at the sniff rate
  // (rates and amplitudes change in bursts: eased so the snout and the fans never jump)
  const ka = 1 - Math.exp(-dt * 8);
  b.sRate = (b.sRate ?? b.sniffRate) + (b.sniffRate - (b.sRate ?? b.sniffRate)) * ka;
  b.sAmp = (b.sAmp ?? 0) + (b.sniffAmp - (b.sAmp ?? 0)) * ka;
  b.wAmp = (b.wAmp ?? 0) + (b.whiskAmp - (b.wAmp ?? 0)) * ka;
  b.sniffPh += dt * TAU * b.sRate;
  const sn = e.bone.snout;
  const tw = (0.5 - 0.5 * Math.cos(b.sniffPh)) * b.sAmp * awake;
  if (sn && tw > 1e-4) {
    const base = _p.setFromMatrixPosition(sn.matrixWorld);
    _q.setFromRotationMatrix(sn.matrixWorld);
    const lat = _a.set(1, 0, 0).applyQuaternion(_q);
    const back = _d.set(0, 1, 0).applyQuaternion(_q).multiplyScalar(-0.0005 * tw * cfg.s);
    sn.matrixWorld.compose(base.add(back), tqa(lat, -0.1 * tw).multiply(_q), _s);
  }
  // ---- whiskers: whisked in step with the sniffs (protraction as the nose rises), fanned forward
  // (exploring) or swept back (b.fanT), lifted clear of the ground
  b.whiskPh = b.sniffPh;
  for (let k = 0; k < 2; k++) {
    const S = k ? 'R' : 'L', s = k ? -1 : 1;
    const bone = e.bone['whisker' + S];
    if (!bone) break;
    const W = b.whisk[k];
    const om = 22;
    W.v += (om * om * (b.fanT - W.a) - 2 * om * W.v) * dt;
    W.a += W.v * dt;
    const whisk = b.wAmp * awake * (0.5 - 0.5 * Math.cos(b.whiskPh)) * (1 - 0.2 * k * Math.sin(b.whiskPh * 0.13));
    const ang = W.a + whisk - 0.35 * b.wAmp * awake;
    if (!b.wLocal) b.wLocal = [0, 1].map((kk) => whiskerLocal(e, kk));
    const base = _p.setFromMatrixPosition(bone.matrixWorld);
    _q.setFromRotationMatrix(bone.matrixWorld);
    _a.set(0, 1, 0).applyQuaternion(e.headPose.quaternion);
    _q.premultiply(tqa(_a, -s * ang));
    // ground: sweep the fan back along the cheek just enough, then lift it about its root
    const vDown = W.y0 === undefined || dt <= 0 ? 0 : Math.max(0, (W.y0 - base.y) / dt);
    W.y0 = base.y;
    const margin = 0.003 * cfg.s + Math.min(0.02 * cfg.s, vDown * 0.12);
    const near = base.y - e.terrainH(base.x, base.z) < 0.07 * cfg.s + margin * 2;
    let needB = 0, needL = 0;
    if (near) {
      const pts = b.wLocal[k];
      const M = _w[0];
      const mw = bone.matrixWorld.clone().compose(base, _q, _s);
      for (let i = 0; i < pts.length; i++) _w[i + 1].copy(pts[i]).applyMatrix4(mw).sub(base);
      const nP = pts.length;
      const clearAt = (phi) => {
        let worst = 0;
        _q2.setFromAxisAngle(_a, s * phi);
        for (let i = 1; i <= nP; i++) {
          const p = _d.copy(_w[i]).applyQuaternion(_q2).add(base);
          worst = Math.min(worst, p.y - (e.terrainH(p.x, p.z) + margin));
        }
        return worst;
      };
      let pw = clearAt(0);
      if (pw < 0) {
        needB = 1.4;
        for (let i = 1; i <= 7; i++) {
          const w = clearAt(i * 0.2);
          if (w >= 0) { needB = (i - 1 + -pw / Math.max(1e-6, w - pw)) * 0.2; break; }
          pw = w;
        }
      }
      const rest = clearAt(needB);
      if (rest < 0) needL = Math.asin(clamp(-rest / (0.035 * cfg.s), 0, 1)) * 1.3;
      void M;
    }
    const omb = 40;
    W.vb = (W.vb || 0) + (omb * omb * (needB - W.back) - 2 * omb * (W.vb || 0)) * dt; W.back = Math.max(0, W.back + W.vb * dt);
    W.vl = (W.vl || 0) + (omb * omb * (needL - W.lift) - 2 * omb * (W.vl || 0)) * dt; W.lift = Math.max(0, W.lift + W.vl * dt);
    if (W.back > 1e-4) _q.premultiply(tqa(_a, s * W.back));
    if (W.lift > 1e-4) {
      const tip = _d.copy(b.wLocal[k][0]).applyMatrix4(bone.matrixWorld).sub(base).applyQuaternion(tqa(_a, s * W.back)).normalize();
      const ax = _w[0].crossVectors(tip, THREE.Object3D.DEFAULT_UP);
      if (ax.lengthSq() > 1e-8) _q.premultiply(tqa(ax.normalize(), W.lift));
    }
    // what still reaches the ground (a head lying on its side): the strands bend against it, the fan
    // shortens about its root just enough
    let need = 1;
    if (near) {
      _M.compose(base, _q, _s);
      for (const pt of b.wLocal[k]) {
        const p = _d.copy(pt).applyMatrix4(_M);
        const dy = p.y - base.y, floor = e.terrainH(p.x, p.z) + 0.6 * margin;
        if (p.y < floor && dy < -1e-5) need = Math.min(need, Math.max(0, base.y - floor) / -dy);
      }
    }
    need = clamp(need, 0.15, 1);
    const oms = 40;
    W.vs = (W.vs || 0) + (oms * oms * (need - (W.sc ?? 1)) - 2 * oms * (W.vs || 0)) * dt;
    W.sc = clamp((W.sc ?? 1) + W.vs * dt, 0.15, 1);
    if (W.sc > need) { W.sc = need; W.vs = Math.min(0, W.vs); }
    bone.matrixWorld.compose(base, _q, _sv.set(W.sc, W.sc, W.sc));
  }
  // ---- ears: small independent swivels toward "sounds"
  if (!cfg.hasEars) return;
  const still = 1 - smooth(0.2, 1, e.speed / cfg.sq);
  for (let k = 0; k < 2; k++) {
    const E = b.ear[k], s = k === 0 ? 1 : -1;
    const bone = k === 0 ? e.bone.earL : e.bone.earR;
    if (!bone) continue;
    E.tNext -= dt;
    if (E.tNext <= 0) { E.tNext = 1 + e.rand() * 3; E.target = e.rand() < 0.4 ? 0 : (e.rand() - 0.3) * 0.6 * s; }
    const want = E.target * still * awake * (1 - clamp(P.earFlat, 0, 1)) * (1 - smooth(0.25, 0.7, Math.abs(P.roll)));
    const om = 14;
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
// update: locomotion style and idle life over the action layer's parameters
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg;
  const vn = e.speed / cfg.sq;
  const run = smooth(0.4, 1.3, vn) * P.gaitW;
  // a head lying on its side (dead, a flop) rests on the cheek and the whisker pad, not in the ground
  const dying = L.postures.reduce((m, p) => (p.name === 'death' ? Math.max(m, p.w) : m), 0);
  const sleeping = L.postures.reduce((m, p) => (p.name === 'sleep' ? Math.max(m, p.w) : m), 0);
  if (P.headW > 0) P.headPos.y += (0.01 * dying + 0.008 * sleeping) * cfg.s;
  P.headPitch -= 0.25 * sleeping;
  // (the small body lying on its side rests on the fur of the flank and the curled paws, not in the ground)
  P.lift += (0.0015 * dying) / cfg.unit;
  // scurrying: the body flattens and stretches, the head reaches forward and low, the ears go back,
  // the tail trails straight out behind
  P.dropF += 0.14 * run; P.dropH += 0.1 * run;
  P.neckReach += (0.004 * run) / cfg.unit;
  P.headRaise -= (0.003 * run) / cfg.unit;
  P.headPitch -= 0.1 * run;
  // sniff / whisk rates: exploratory 6-9 Hz in bursts with pauses; fast whisking while moving slowly
  // and exploring, little when running (whiskers held forward), none asleep
  b.sniffT -= dt;
  if (b.sniffT <= 0) {
    b.sniffT = 0.6 + e.rand() * 1.8;
    const pause = e.rand() < 0.25;
    b.sniffBase = pause ? 0.15 : 0.7 + 0.4 * e.rand();
    b.sniffRate = 6 + e.rand() * 3;
    b.whiskBase = pause ? 0.08 : 0.35 + 0.25 * e.rand();
  }
  const eatW = Math.max(oneshotW(L, 'eat'), oneshotW(L, 'drink'));
  const groomW = oneshotW(L, 'groom');
  const fight = Math.max(oneshotW(L, 'attack'), oneshotW(L, 'box'));
  const lying = L.postures.reduce((m, p) => (p.name === 'sleep' || p.name === 'death' || p.name === 'lie' ? Math.max(m, p.w) : m), 0);
  const quiet = Math.max(eatW, groomW, fight, lying * 0.8, clamp(P.eyelid, 0, 1));
  // (the pose hook reads these)
  b.freezeK = b.freezeT > 0 ? smooth(0, 0.15, b.freezeT) : 0;
  b.whiskAmp = (b.whiskBase ?? 0.5) * (1 - quiet) * (1 - 0.6 * run) * (1 - b.freezeK);
  b.fanT = 0.12 + 0.18 * run - 0.45 * eatW - 0.45 * groomW - 0.5 * fight - 0.3 * lying;
  b.sniffAmp = (b.sniffBase ?? 1) * (1 - quiet * 0.85) * (1 - 0.8 * b.freezeK);
  // head scanning while sniffing at rest (sweeps side to side with the sniffs)
  const idle = L.idle.w * (busy(L) ? 0 : 1);
  b.scanW += ((b.scanOn ? 1 : 0) * idle - b.scanW) * (1 - Math.exp(-dt * 3));
  if (b.scanW > 0.01) {
    b.scanPh += dt * 0.6;
    mx(P, 'headYaw', 0.45 * Math.sin(b.scanPh * TAU) + 0.1 * Math.sin(b.scanPh * TAU * 3.1), b.scanW);
    mx(P, 'headPitch', 0.2 + 0.12 * Math.sin(b.scanPh * TAU * 1.7), b.scanW);
    P.headRaise += (0.0015 * Math.sin(b.sniffPh) * b.sniffAmp * b.scanW) / cfg.unit;
  }
  // scurry steering: a burst along the heading, then a sudden stop and a freeze
  const f = b.scurry;
  if (f) {
    f.t += dt;
    if (f.phase === 'run') {
      e.wantSpeed = f.speed * cfg.sq;
      e.wantHeading = f.h;
      f.dist += e.speed * dt;
      if (f.dist >= f.len || f.t > 4) { f.phase = 'stop'; f.tStop = f.t; e.wantSpeed = 0; }
    } else if (f.phase === 'stop') {
      e.wantSpeed = 0;
      if (e.speed < 0.05 * cfg.sq) { f.phase = 'done'; b.freezeT = 0.5 + e.rand() * 0.8; b.sniffT = b.freezeT; }
      if (f.t - f.tStop > 2) f.phase = 'done';
    }
    if (f.phase === 'done') b.scurry = null;
  }
  if (b.freezeT > 0) {
    b.freezeT -= dt;
    const fz = smooth(0, 0.15, b.freezeT) * P.gaitW;
    mx(P, 'breathRate', 2.5, fz); mx(P, 'earFlat', -0.1, fz); mx(P, 'lookW', 0, fz);
    if (b.freezeT <= 0) { b.sniffBase = 1.2; b.sniffRate = 9; b.whiskBase = 0.6; b.sniffT = 1.2; }
  }
  // rearing to look at a far, raised target (input.look)
  const look = e.input.look;
  if (look && !busy(L) && L.idle.w > 0.9) {
    const dx = look.x - e.pos.x, dz = look.z - e.pos.z, dy = look.y - e.headPose.position.y;
    const far = Math.hypot(dx, dz) > 1.2 * cfg.s && dy > 0.06 * cfg.s;
    if (far) L.play('rear', { loop: true, follow: true });
  }
  // automatic idle variants (standing still, nothing else running, nobody steering the gaze)
  if (e.idleVariants !== false && L.idle.w > 0.98 && !busy(L) && !e.input.look && !e.input.follow) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 4 + e.rand() * 6;
      const r = e.rand();
      b.scanOn = false;
      if (r < 0.28) L.play('groom');
      else if (r < 0.5) L.play('rear');
      else if (r < 0.85) { b.scanOn = true; b.sniffBase = 1.2; b.sniffRate = 8.5; b.whiskBase = 0.6; b.sniffT = 2.5; }
    }
  } else if (busy(L)) { b.idleT = Math.max(b.idleT, 2.5); b.scanOn = false; }
}

// ------------------------------------------------------------------------------------------------
// posture helpers: sitting up on the haunches (hind feet flat, the body upright, forepaws free)
// upright: 0 (on all fours) .. 1 (reared, ~70 degrees); the hips sit down onto the heels, the chest
// rises and the body pitches back over the hind feet
function sitUp(P, w, e, upright) {
  mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
  mx(P, 'dropF', -2.3 * upright, w);
  mx(P, 'dropH', 0.12, w);
  mx(P, 'flex', -0.35 * upright, w);
  mx(P, 'pitch', 0.12 * upright, w);
  mx(P, 'fwd', (-0.01 * upright * e.cfg.s) / e.cfg.unit, w);
  mx(P, 'groundW', 1, w);
  mx(P, 'tailGround', 0.5, w);
}
// envelopes of a sit-up action: up (rising), body (up, but coming down over the last 0.9 s of a timed
// action) and hands (the forepaws stay off the ground until the chest is down again, so they are never
// handed back to their plants out of reach)
function env(inst, w, e, rise = 0.45, t0 = 0, dur = inst.dur) {
  const t = inst.t - t0, cfg = e.cfg;
  const up = w * smooth(0, rise, t);
  const end = Number.isFinite(dur) ? 1 - smooth(dur - 0.95, dur - 0.4, t) : 1;
  const body = up * end;
  const raise = e.fr.shC.y - e.terrainH(e.fr.shC.x, e.fr.shC.z) - cfg.yS;
  const want = Math.min(up, Math.max(body, w * smooth(0.002 * cfg.s, 0.016 * cfg.s, raise)));
  // (eased: a forepaw let go of all at once flicked down to its plant)
  const dt = clamp(inst.t - (inst._ht ?? inst.t), 0, 0.1);
  inst._ht = inst.t;
  if (inst._h === undefined) { inst._h = want; inst._hv = 0; }
  const om = 12;
  inst._hv += (om * om * (want - inst._h) - 2 * om * inst._hv) * dt;
  inst._h = clamp(inst._h + inst._hv * dt, 0, 1);
  const hands = Math.min(up, inst._h);
  return { up, body, hands };
}
// forepaw i toward a world point (weight k)
function paw(P, i, tp, k) {
  const pl = P.legs[i];
  pl.target.lerp(tp, k / Math.max(1e-3, pl.reach + k));
  mxLeg(P, i, 'reach', 1, k);
}
// a point in front of the mouth (head frame): fwd / down / side in species metres
function nearMouth(e, fwd, down, side, out) {
  const s = e.cfg.s;
  const hq = e.headPose.quaternion;
  out.copy(e.cfg.mouthLocal).applyQuaternion(hq).add(e.headPose.position);
  const f = e.forward(e.heading, _d), lat = e.left(e.heading, _a);
  out.addScaledVector(f, fwd * s).addScaledVector(lat, side * s);
  out.y -= down * s;
  return out;
}
const stopWhenMoving = (inst, L) => {
  // asked to move: end now (the one-shot fades out; the forepaws come down with the body)
  if (L.engine.wantSpeed > 0.05 && !inst.opts.hold) return true;
  return false;
};

// rear: stands up on the hind feet (soles flat), forepaws tucked against the chest, head high,
// nose up and sniffing, tail on the ground as a prop; looks around or at the look target
const rear = {
  kind: 'oneshot', fade: 0.3,
  start(inst, L) {
    const e = L.engine;
    inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 2.8 + e.rand() * 2.5);
    const a = e.heading + (e.rand() - 0.5) * 1.8, d = 3 * e.cfg.s;
    inst.look = inst.opts.target ? inst.opts.target.clone() : new THREE.Vector3(e.pos.x + Math.sin(a) * d, e.pos.y + 0.4 * e.cfg.s, e.pos.z + Math.cos(a) * d);
  },
  update(inst, dt, L) {
    const e = L.engine;
    // following the look input: comes down when the target goes away or comes down / near
    if (inst.opts.follow && !Number.isFinite(inst.dur) && inst.t > 0.8) {
      const lk = e.input.look;
      const ok = lk && Math.hypot(lk.x - e.pos.x, lk.z - e.pos.z) > 1.0 * e.cfg.s && lk.y - e.headPose.position.y > 0.03 * e.cfg.s;
      if (!ok) inst.dur = inst.t + 1.0;
    }
    return inst.t >= inst.dur || stopWhenMoving(inst, L);
  },
  apply(P, w, inst, L) {
    const e = L.engine;
    const { up, body, hands } = env(inst, w, e);
    sitUp(P, body, e, 1);
    for (let i = 0; i < 2; i++) { mxLeg(P, i, 'tuck', 1, hands); P.legs[i].extend = lerp(P.legs[i].extend, 0.2, hands); }
    mx(P, 'headRaise', 0.006 / e.cfg.unit, body); mx(P, 'headPitch', -0.12, body);
    if (!e.input.look) { P.look = inst.look; mx(P, 'lookW', 1, body); }
    mx(P, 'earFlat', -0.15, up);
    mx(P, 'breathRate', 1.6, up);
  },
};

// groom: the face-washing chain (Berridge et al. 1987): sits up, small fast elliptical strokes of
// both forepaws over the nose, larger strokes over the face and behind the ears, then the head turns
// down to lick the flank
const GROOM = 4.6;
const groom = {
  kind: 'oneshot', fade: 0.35,
  start(inst, L) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? GROOM); inst.side = L.engine.rand() < 0.5 ? -1 : 1; },
  update(inst, dt, L) { return inst.t >= inst.dur || stopWhenMoving(inst, L); },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.opts.loop ? inst.t % GROOM : inst.t;
    const { body, hands } = env(inst, w, e);
    // (looped: the chain restarts; the licking phase eases back into the face strokes)
    const lick = smooth(2.9, 3.3, t) * (1 - smooth(4.0, 4.5, t));
    sitUp(P, body, e, lerp(0.72, 0.35, lick));
    // head: bobs down into the paws with every stroke; turns to the flank for licking
    const big = smooth(1.2, 1.6, t) * (1 - smooth(4.2, 4.5, t));
    const ph = TAU * (5.5 * t - 2.9 * Math.max(0, Math.min(t, 1.6) - 1.2) - 2.9 * Math.max(0, t - 1.6)); // 5.5 -> 2.6 strokes/s, continuous phase
    const face = body * (1 - lick);
    mx(P, 'headPitch', 0.55 + 0.16 * Math.sin(ph), face); mx(P, 'headRaise', -0.004 / e.cfg.unit, face);
    mx(P, 'lookW', 0, body); mx(P, 'eyelid', 0.55, face); mx(P, 'earFlat', 0.3 * big, face);
    const sd = inst.side;
    mx(P, 'headYaw', 1.0 * sd, lick * body); mx(P, 'headPitch', 0.8, lick * body); mx(P, 'bend', 0.3 * sd, lick * body);
    mx(P, 'jaw', 0.12 * Math.max(0, Math.sin(ph * 0.5)), lick * body); mx(P, 'jawOmega', 25, body);
    // forepaws: ellipses over the snout (small, both together), then bigger alternating face strokes;
    // during the licking they rest under the chest
    const tp = tv();
    for (let i = 0; i < 2; i++) {
      const sdI = i === 0 ? 1 : -1;
      const phi = ph + i * PI * big;
      const amp = lerp(0.003, 0.008, big);
      nearMouth(e, 0.004 + 0.3 * amp * Math.cos(phi) - 0.01 * big, 0.004 - amp * Math.sin(phi) - 0.008 * big, sdI * lerp(0.004, 0.008, big), tp);
      const onFace = smooth(0.15, 0.55, inst.t) * (1 - 0.7 * lick);
      paw(P, i, tp, hands * onFace);
      mxLeg(P, i, 'tuck', 1, hands * (1 - onFace));
    }
  },
};

// eat: sits up on the haunches holding the food in both forepaws in front of the mouth, gnawing it
// with fast incisor strokes (~6 Hz) and turning it; now and then lowers it and looks around
const eat = {
  kind: 'oneshot', fade: 0.4,
  start(inst) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 6); },
  update(inst, dt, L) { return inst.t >= inst.dur || stopWhenMoving(inst, L); },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t;
    const { up, body, hands } = env(inst, w, e, 0.5);
    // pauses: every ~2.7 s the paws drop a little and the head comes up to look around
    const cyc = t % 2.7, pause = smooth(1.9, 2.1, cyc) * (1 - smooth(2.45, 2.65, cyc));
    sitUp(P, body, e, 0.72);
    mx(P, 'headPitch', lerp(0.45, 0.05, pause), body); mx(P, 'lookW', 0, body * (1 - pause));
    const g = Math.max(0, Math.sin(t * TAU * 6)) * (1 - pause);
    mx(P, 'jaw', 0.16 * g, body); mx(P, 'jawOmega', 40, up);
    mx(P, 'earFlat', 0.1, up);
    const tp = tv();
    const turn = Math.sin(t * TAU * 0.4);
    for (let i = 0; i < 2; i++) {
      const sdI = i === 0 ? 1 : -1;
      nearMouth(e, 0.006, 0.006 + 0.008 * pause + 0.0015 * turn * sdI, sdI * 0.0045, tp);
      const k = smooth(0.25, 0.7, t);
      paw(P, i, tp, hands * k);
      mxLeg(P, i, 'tuck', 1, hands * (1 - k));
    }
  },
};

// scurry: a fast burst (0.3-1.5 m) along the heading or away from a point, a sudden stop, a freeze
const scurry = {
  kind: 'oneshot', fade: 0.15,
  start(inst, L) {
    const e = L.engine, b = B(e);
    let h = e.heading + (e.rand() - 0.5) * 0.6;
    if (inst.opts.from) h = Math.atan2(e.pos.x - inst.opts.from.x, e.pos.z - inst.opts.from.z);
    if (inst.opts.heading !== undefined) h = inst.opts.heading;
    const len = (inst.opts.distance ?? 0.4 + e.rand() * 1.0) * e.cfg.s;
    b.scurry = { t: 0, phase: 'run', h, len, dist: 0, speed: inst.opts.speed ?? 1.5 };
    inst.dur = Infinity;
  },
  update(inst, dt, L) { return !B(L.engine).scurry; },
  apply(P, w) { mx(P, 'earFlat', 0.5, w); },
};

// box: rears up on the hind legs facing the opponent and pushes / strikes with the forepaws
const BOX_HITS = [0.5, 0.68, 0.98];
function boxApply(P, w, inst, L, t0, dur) {
  const e = L.engine, t = inst.t - t0;
  const { body, hands } = env(inst, w, e, 0.35, t0, dur);
  sitUp(P, body, e, 0.95);
  mx(P, 'bodyOmega', 1.8, body);
  mx(P, 'headPitch', -0.15, body); mx(P, 'earFlat', 1, body);
  const fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
  for (let i = 0; i < 2; i++) {
    const tt = t - (i === 0 ? 0.38 : 0.56);
    const strike = Math.pow(Math.sin(PI * clamp(tt / 0.3, 0, 1)), 2) + 0.5 * Math.pow(Math.sin(PI * clamp((tt - 0.42) / 0.3, 0, 1)), 2);
    const tp = tv().copy(e.fr.shC).addScaledVector(fwd, (0.024 + 0.02 * strike) * e.cfg.s).addScaledVector(lat, (i === 0 ? 1 : -1) * 0.008 * e.cfg.s);
    tp.y += (-0.012 + 0.012 * strike) * e.cfg.s;
    if (inst.target) tp.lerp(tv().copy(inst.target).setY(Math.max(inst.target.y, tp.y)), 0.15 * strike);
    const k = smooth(0.1, 0.3, t);
    paw(P, i, tp, hands * k);
    mxLeg(P, i, 'tuck', 1, hands * (1 - k));
  }
  mx(P, 'jaw', 0.25, body * smooth(0.1, 0.25, t)); mx(P, 'jawOmega', 30, body);
}
function boxHits(inst, L, t0) {
  const e = L.engine;
  while (inst.hits < BOX_HITS.length && inst.t - t0 >= BOX_HITS[inst.hits]) {
    inst.hits++;
    const p = new THREE.Vector3().copy(e.fr.shC).addScaledVector(e.forward(e.heading, new THREE.Vector3()), 0.04 * e.cfg.s);
    e.emit('attackHit', { position: p, direction: e.forward(e.heading, new THREE.Vector3()), style: 'box' });
  }
}
const box = {
  kind: 'oneshot', fade: 0.2, needsStand: true,
  start(inst) { inst.dur = inst.opts.duration ?? 2.2; inst.hits = 0; inst.target = inst.opts.target ? inst.opts.target.clone() : null; },
  update(inst, dt, L) { boxHits(inst, L, 0); return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    if (inst.target) { P.look = inst.target; mx(P, 'lookW', 1, w); }
    boxApply(P, w, inst, L, 0, inst.dur);
  },
};

// attack: a lunge bite (the engine's bite-lunge, jaw wide on the incisors), or, standing still and
// about half the time (opts.style 'box' / 'bite'), boxing on the hind legs followed by the bite
const BOX_T = 1.9; // boxing phase (rear, strikes, down on all fours) before the bite
const attack = {
  kind: 'oneshot', fade: 0.15, needsStand: true,
  start(inst, L) {
    const e = L.engine;
    const still = e.speed < 0.3 * e.cfg.sq;
    inst.boxing = inst.opts.style === 'box' || (inst.opts.style !== 'bite' && still && e.rand() < 0.5);
    inst.t0 = inst.boxing ? BOX_T : 0;
    inst.target = inst.opts.target ? inst.opts.target.clone() : null;
    inst.hits = inst.boxing ? 0 : BOX_HITS.length;
    ONESHOTS.attack.start(inst, L);
    inst.style = 'bite-lunge';
    inst.biteDur = inst.dur;
    inst.dur += inst.t0;
  },
  update(inst, dt, L) {
    boxHits(inst, L, 0);
    const t = inst.t;
    if (t < inst.t0) return false;
    inst.t = t - inst.t0;
    const r = ONESHOTS.attack.update.call(ONESHOTS.attack, inst, dt, L);
    inst.t = t;
    return r;
  },
  apply(P, w, inst, L) {
    const t = inst.t;
    if (inst.boxing && t < inst.t0 + 0.2) boxApply(P, w, inst, L, 0, inst.t0);
    if (t > inst.t0 - 0.15) {
      inst.t = Math.max(0, t - inst.t0);
      const r0 = [P.legs[0].reach, P.legs[1].reach];
      ONESHOTS.attack.apply(P, w * smooth(inst.t0 - 0.15, inst.t0 + 0.05, t), inst, L);
      // (the short forelegs only half follow the lunge's forepaw strike: a full reach flicked the paws)
      for (let i = 0; i < 2; i++) P.legs[i].reach = r0[i] + (P.legs[i].reach - r0[i]) * 0.55;
      inst.t = t;
    }
  },
};

// hit: the engine's flinch (a light animal: shoved less), then a freeze
const hit = {
  ...ONESHOTS.hit,
  kind: 'oneshot',
  start(inst, L) {
    inst.opts = { ...inst.opts, strength: (inst.opts.strength ?? 1) * 0.6 };
    ONESHOTS.hit.start(inst, L);
    B(L.engine).freezeT = 1.2;
  },
};

export const hooks = {
  pose,
  update,
  actions: { rear, groom, eat, scurry, box, attack, hit },
};
