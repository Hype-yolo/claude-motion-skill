// Cat behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js).
//
//   update(P, dt, layer)   every frame over the built-in actions: mood (annoyed -> the whole tail
//                          lashes side to side at ~1 Hz and the ears turn out sideways, "airplane
//                          ears"), slow blinks (idle, sitting, loafing), the walking head held level,
//                          lapping at ~3.8 laps / s when drinking, the head tilted to shear with the
//                          carnassials when eating, the tail wrapped round the forepaws when sitting and
//                          over the nose when curled asleep, automatic idle variants (grooming, a slow
//                          blink, ear scans)
//   pose(engine, dt)       after the engine's solve: the ears swivel independently toward "sounds" and
//                          flatten sideways when angry; the tail tip twitches while hunting
//   actions                attack (stalk crouch, rear-end wiggle, then the pounce: forepaws strike
//                          down together, bite), hit (flinch, then the arched-back "Halloween" threat:
//                          stiff legs, bristling fur and bottle-brush tail, ears flat, hissing),
//                          loaf (sternal with every paw tucked under), groom (licks a forepaw, wipes it
//                          over the ear and face), knead, stalk (crouched creep with a twitching tail
//                          tip), slowblink
//
// Distances are cat metres at the reference size (x cfg.s); posture offsets the engine multiplies by
// cfg.k (fwd, side, headRaise, neckReach) are divided by cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tqa, tableAt } from '../../core/motion/common.js';
import { mx, mxLeg, ONESHOTS, POSTURES } from '../../core/motion/actions.js';
import { whiskerSamples, WHISKER_BASE, WHISKER_TIP } from './whiskers.js';

const W_SAMPLES = whiskerSamples();

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3(), _a = new THREE.Vector3(), _pOld = new THREE.Vector3(), _pNew = new THREE.Vector3(), _pPrev = new THREE.Vector3(), _d = new THREE.Vector3();
const sm = (w) => w * w * (3 - 2 * w);
const U = (e) => e.cfg.unit; // engine units -> cat metres

// per-engine behaviour state
function B(e) {
  if (!e._cat) {
    e._cat = {
      annoyed: 0, hunt: 0, lashPh: e.rand() * TAU,
      ear: [{ sw: 0, v: 0, target: 0, tNext: 0.4 }, { sw: 0, v: 0, target: 0, tNext: 1.1 }],
      earOut: 0, twitchPh: 0, twitch: 0, whisk: [{ a: 0, v: 0, lift: 0, back: 0 }, { a: 0, v: 0, lift: 0, back: 0 }], wLocal: null, fanT: 0,
      blinkT: -1, blinkIn: 4 + e.rand() * 6, idleT: 8 + e.rand() * 6,
    };
  }
  return e._cat;
}
const busy = (L) => L.postures.some((p) => p.target > 0) || L.oneshots.some((a) => !a.stopping);
const running = (L, name) => L.oneshots.find((a) => a.name === name && a.w > 0);
const posture = (L, name) => L.postures.find((p) => p.name === name && p.w > 0);

// ------------------------------------------------------------------------------------------------
// update: body language on top of every action
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg;
  const vn = e.speed / cfg.sq;
  const t = e.time;

  // ---- mood: annoyed (hit, attacked, or asked for), hunting (stalk, pounce crouch)
  let annoyedT = e.input.mood === 'annoyed' ? 1 : 0, huntT = 0;
  for (const a of L.oneshots) {
    if (a.name === 'hit' && a.w > 0) annoyedT = Math.max(annoyedT, 1);
    if (a.name === 'attack' && a.w > 0 && a.phase !== 'air') huntT = Math.max(huntT, a.w);
    if (a.name === 'stalk' && a.w > 0) huntT = Math.max(huntT, a.w);
  }
  if (b.hitAfter > 0) { b.hitAfter -= dt; annoyedT = Math.max(annoyedT, clamp(b.hitAfter / 2, 0, 1)); }
  b.annoyed += (annoyedT - b.annoyed) * (1 - Math.exp(-dt * (annoyedT > b.annoyed ? 4 : 0.8)));
  b.hunt += (huntT - b.hunt) * (1 - Math.exp(-dt * 5));
  // lashing: the whole tail sweeps side to side (~1 Hz), faster and wider the angrier
  if (b.annoyed > 0.01) {
    b.lashPh += dt * TAU * lerp(0.7, 1.3, b.annoyed);
    const k = b.annoyed * (1 - P.tailGround * 0.7);
    P.tailSide += Math.sin(b.lashPh) * 0.85 * k;
    mx(P, 'tailIdle', 0, k);
    mx(P, 'earFlat', Math.max(P.earFlat, 0.35), k);
  }
  b.earOut = b.annoyed;

  // ---- walking: the head held level and steady (a cat's gaze locks on)
  const walk = smooth(0.05, 0.4, vn) * (1 - smooth(1.2, 2.2, vn)) * P.gaitW;
  if (walk > 0) P.headPitch -= 0.04 * walk;

  // ---- sitting upright: the tail curls round the forepaws on the ground
  const sit = posture(L, 'sit');
  if (sit) {
    const w = sm(clamp(sit.w, 0, 1)) * smooth(0.4, 1.4, sit.t);
    mx(P, 'tailSide', sit.side * 1.6, w); mx(P, 'tailCurl', sit.side * 3.2, w); mx(P, 'tailStiff', 0.8, w); mx(P, 'tailGround', 0.7, w);
    mx(P, 'headRaise', 0.03 / U(e) * 0.35, w);
  }
  // ---- lying on its side (dead): the big round head rests on its cheek, higher than the engine's
  // (cheetah-proportioned) default
  for (const p of L.postures) {
    if (p.name === 'death') {
      const w = sm(clamp(p.w, 0, 1)) * smooth(0.35, 1.0, p.t); P.headPos.y += 0.035 * cfg.s * w;
      // (lying on its side the lower paws rest tilted on their edge: carry the body a few mm higher)
      // (6.5 mm: a blue cat's hind paw on its edge still pressed 2.9 mm into the ground at 5)
      P.lift += (0.009 / cfg.unit) * sm(clamp(p.w, 0, 1)) * smooth(0.5, 0.9, p.t);
      // the limp tail: the engine lays it 'down' in the pelvis frame, which points sideways on a body lying on
      // its side (it floated 7-10 cm up); swept round toward the ground side it drapes onto the ground
      // (tail joints 20 -> 91 mm root to tip, both fall sides)
      mx(P, 'tailSide', -p.side * 2.1, sm(clamp(p.w, 0, 1)) * smooth(0.6, 1.4, p.t));
    }
  }
  // ---- curled asleep: a tight ring, the tail wrapped round along the body toward the head, head on the forepaws
  const sleep = posture(L, 'sleep');
  if (sleep && sleep.tune.style !== 'lateral') {
    const c = sm(clamp(sleep.w, 0, 1)) * smooth(1.2, 3.2, sleep.t);
    mx(P, 'bend', sleep.side * 1.02, c); mx(P, 'tailCurl', sleep.side * 3.0, c); mx(P, 'tailStiff', 0.6, c); mx(P, 'tailGround', 0.9, c);
    mx(P, 'headYaw', sleep.side * 0.75, c); mx(P, 'flex', 0.25, c);
    // (the head resting on the forepaws a little higher: a big round head's lower cheek went into the ground)
    P.headPos.y += 0.005 * cfg.s * c;
  }
  // ---- drinking: lapping (the tongue flicks up a column of water ~3.8 times a second)
  const dr = running(L, 'drink');
  if (dr) {
    const w = sm(dr.w);
    P.jaw = lerp(P.jaw, 0.06 + 0.09 * Math.max(0, Math.sin(dr.t * 3.8 * TAU)), w);
    mx(P, 'tailLift', -0.45, w); mx(P, 'tailGround', 0.45, w); // (crouched: the tail low, its tip on the ground)
    mx(P, 'jawOmega', 40, w);
    mx(P, 'earFlat', 0.1, w);
  }
  // ---- eating: head tilted to shear with the carnassials, with little head shakes
  const eat = running(L, 'eat');
  if (eat) {
    const w = sm(eat.w);
    P.headRoll += w * (0.35 * Math.sin(eat.t * 0.9) + 0.08 * Math.sin(eat.t * 11) * smooth(0.6, 0.9, Math.sin(eat.t * 1.7)));
    mx(P, 'tailLift', -0.45, w); mx(P, 'tailGround', 0.45, w);
  }

  // ---- the upper lids rest a little over the iris (a flatter, heavier upper lid: face1, face2, lying1);
  // wide open when hunting or startled
  P.eyelid = Math.max(P.eyelid, 0.12 * (1 - b.hunt) * (1 - 0.6 * b.annoyed));

  // ---- slow blink ("cat kiss"): idle standing, sitting, loafing; or on demand (the slowblink action)
  const calm = (L.idle.w > 0.9 && !busy(L)) || posture(L, 'sit') || posture(L, 'loaf') || posture(L, 'lie');
  if (b.blinkT < 0) {
    if (calm && !b.annoyed) b.blinkIn -= dt;
    if (b.blinkIn <= 0) { b.blinkT = 0; b.blinkIn = 6 + e.rand() * 10; }
  }
  if (b.blinkT >= 0) {
    b.blinkT += dt;
    const bt = b.blinkT;
    const lid = smooth(0, 0.55, bt) * (1 - smooth(1.4, 2.1, bt));
    P.eyelid = Math.max(P.eyelid, 0.88 * lid);
    P.headPitch += 0.06 * lid; // a small nod with it
    if (bt > 2.2) b.blinkT = -1;
  }

  // ---- idle variants: grooming, an ear scan, a slow blink
  if (e.idleVariants !== false && L.idle.w > 0.98 && !busy(L) && !e.input.look && !e.input.follow) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 7 + e.rand() * 9;
      const r = e.rand();
      if (r < 0.4) L.play('groom');
      else if (r < 0.7) b.blinkIn = 0;
      else { b.ear[0].tNext = 0; b.ear[1].tNext = 0.15; }
    }
  } else if (busy(L)) b.idleT = Math.max(b.idleT, 3);

  // ---- hunting: tail low and straight, its tip twitching; ears pricked forward
  if (b.hunt > 0.01) {
    mx(P, 'tailLift', -0.35, b.hunt); mx(P, 'tailIdle', 0, b.hunt); mx(P, 'tailStiff', 1.3, b.hunt);
    mx(P, 'earFlat', -0.15, b.hunt);
  }
  b.twitch = b.hunt;
  // whisker fan (pose hook): forward when hunting or walking, back when eating, drinking, angry, asleep
  const eatW = Math.max(dr ? dr.w : 0, eat ? eat.w : 0);
  b.fanT = 0.4 * b.hunt + 0.12 * walk - 0.5 * b.annoyed - 0.4 * eatW - 0.3 * clamp(P.eyelid, 0, 1);
  void t;
}

// whisker samples in the whisker bone's bind-local frame, mapped from the reference head (whiskers.js)
// onto this individual's bone (scaled by the bone's length)
const _w = Array.from({ length: 40 }, () => new THREE.Vector3());
function whiskerLocal(e, kk) {
  const s = kk ? -1 : 1, S = kk ? 'R' : 'L';
  const i = e.sk.bones.indexOf(e.bone['whisker' + S]);
  const inv = e.sk.bind[i].clone().invert();
  const Jb = e.J['whiskerBase' + S], Jt = e.J['whiskerTip' + S];
  const refLen = Math.hypot(WHISKER_TIP[0] - WHISKER_BASE[0], WHISKER_TIP[1] - WHISKER_BASE[1], WHISKER_TIP[2] - WHISKER_BASE[2]);
  const k = Jb.distanceTo(Jt) / refLen;
  return W_SAMPLES.map((p) => new THREE.Vector3(Jb.x + (p[0] - WHISKER_BASE[0]) * s * k, Jb.y + (p[1] - WHISKER_BASE[1]) * k, Jb.z + (p[2] - WHISKER_BASE[2]) * k).applyMatrix4(inv));
}

// ------------------------------------------------------------------------------------------------
// pose: independent ear swivels, airplane ears, whiskers, tail-tip twitch
function pose(e, dt) {
  const b = B(e), P = e.P, cfg = e.cfg;
  if (e.lod >= 2) return;
  const awake = 1 - P.eyelid * 0.8;
  const still = 1 - smooth(0.5, 3, e.speed / cfg.sq);
  // ---- ears
  if (cfg.hasEars) {
    for (let k = 0; k < 2; k++) {
      const E = b.ear[k], s = k === 0 ? 1 : -1;
      const bone = k === 0 ? e.bone.earL : e.bone.earR;
      if (!bone) continue;
      // a new "sound" every 1-4 s: often sideways or back, sometimes straight ahead; each ear on its own
      E.tNext -= dt;
      if (E.tNext <= 0) {
        E.tNext = 1 + e.rand() * 3.5;
        E.target = e.rand() < 0.35 ? 0 : (e.rand() - 0.3) * 0.86 * s; // (up to ~35 deg out, ~15 in: the skin of the crown between the ears stretched > 3x beyond)
      }
      // (none lying on the side or with the head on the ground: the engine keeps the pinnae out of it)
      const want = E.target * still * awake * (1 - Math.max(0, P.earFlat)) * (1 - b.hunt) * (1 - smooth(0.25, 0.7, Math.abs(P.roll))) * (1 - clamp(P.headW, 0, 1));
      const om = 16; // fast, critically damped swivel (~0.1 s)
      E.v += (om * om * (want - E.sw) - 2 * om * E.v) * dt;
      E.sw += E.v * dt;
      const out = b.earOut;
      if (Math.abs(E.sw) < 1e-4 && out < 1e-3) continue;
      const base = _p.setFromMatrixPosition(bone.matrixWorld);
      _q.setFromRotationMatrix(bone.matrixWorld);
      // swivel about the pinna's own axis
      _a.set(0, 1, 0).applyQuaternion(_q);
      _q.premultiply(tqa(_a, E.sw + out * 0.42 * s));
      // airplane ears: turned out and down to the side, openings facing back
      if (out > 1e-3) {
        const hq = e.headPose.quaternion;
        _d.set(0, 0, 1).applyQuaternion(hq);
        _q.premultiply(tqa(_d, -s * 0.36 * out)); // (0.55 / 0.45: the crown between the ears stretched > 3x)
      }
      bone.matrixWorld.compose(base, _q, _s);
    }
  }
  // ---- whiskers: fanned / swept (b.fanT), and lifted clear of the ground
  for (let k = 0; k < 2; k++) {
    const S = k ? 'R' : 'L', s = k ? -1 : 1;
    const bone = e.bone['whisker' + S];
    if (!bone) break;
    const W = b.whisk[k];
    const om = 12;
    W.v += (om * om * (b.fanT - W.a) - 2 * om * W.v) * dt;
    W.a += W.v * dt;
    if (!b.wLocal) b.wLocal = [0, 1].map((kk) => whiskerLocal(e, kk));
    const base = _p.setFromMatrixPosition(bone.matrixWorld);
    _q.setFromRotationMatrix(bone.matrixWorld);
    _a.set(0, 1, 0).applyQuaternion(e.headPose.quaternion);
    _q.premultiply(tqa(_a, -s * W.a));
    bone.matrixWorld.compose(base, _q, _s);
    // ground: sweep the fan back along the cheek (about the head's up axis) just enough, the way a cat
    // lays its whiskers back against a surface; lift it about its root for what remains. Rises at once,
    // relaxes slowly.
    // (look ahead by the head's fall: a collapsing body drops the face 0.5 m/s)
    const vDown = W.y0 === undefined || dt <= 0 ? 0 : Math.max(0, (W.y0 - base.y) / dt);
    W.y0 = base.y;
    const margin = 0.009 * cfg.s + Math.min(0.06 * cfg.s, vDown * 0.12);
    const near = base.y - e.terrainH(base.x, base.z) < 0.09 * cfg.s + margin * 2;
    let needB = 0, needL = 0;
    if (near) {
      const pts = b.wLocal[k];
      for (let i = 0; i < pts.length; i++) _w[i + 1].copy(pts[i]).applyMatrix4(bone.matrixWorld).sub(base);
      const nP = pts.length;
      const clearAt = (phi) => {
        let worst = 0;
        _q2.setFromAxisAngle(_a, s * phi);
        for (let i = 1; i <= nP; i++) {
          const p = _d.copy(_w[i]).applyQuaternion(_q2).add(base);
          worst = Math.min(worst, p.y - (e.terrainH(p.x, p.z) + margin)); // (margin: the fan follows on a spring)
        }
        return worst;
      };
      // smallest sweep that clears, interpolated between steps (continuous in the pose)
      let pw = clearAt(0);
      needB = 0;
      if (pw < 0) {
        needB = 1.7;
        for (let i = 1; i <= 8; i++) {
          const w = clearAt(i * 0.2125);
          if (w >= 0) { needB = (i - 1 + -pw / Math.max(1e-6, w - pw)) * 0.2125; break; }
          pw = w;
        }
      }
      const rest = clearAt(needB);
      if (rest < 0) needL = Math.asin(clamp(-rest / (0.05 * cfg.s), 0, 1)) * 1.2;
    }
    // critically damped springs (fast: ~0.1 s), so the fan never snaps
    const omb = 40;
    W.vb = (W.vb || 0) + (omb * omb * (needB - W.back) - 2 * omb * (W.vb || 0)) * dt; W.back = Math.max(0, W.back + W.vb * dt);
    W.vl = (W.vl || 0) + (omb * omb * (needL - W.lift) - 2 * omb * (W.vl || 0)) * dt; W.lift = Math.max(0, W.lift + W.vl * dt);
    if (W.back > 1e-4) _q.premultiply(tqa(_a, s * W.back));
    if (W.lift > 1e-4) {
      const tip = _d.copy(b.wLocal[k][0]).applyMatrix4(bone.matrixWorld).sub(base).applyQuaternion(tqa(_a, s * W.back)).normalize();
      const ax = _w[0].crossVectors(tip, THREE.Object3D.DEFAULT_UP);
      if (ax.lengthSq() > 1e-8) _q.premultiply(tqa(ax.normalize(), W.lift));
    }
    if (W.back > 1e-4 || W.lift > 1e-4) bone.matrixWorld.compose(base, _q, _s);
  }
  // ---- tail tip twitch (hunting / focused): the last third flicks side to side
  const tw = b.twitch;
  if (tw > 0.01 && cfg.tailN) {
    b.twitchPh += dt * TAU * 2.2;
    const n = cfg.tailN, i0 = Math.floor(n * 0.62);
    const amp = tw * (0.2 * Math.sin(b.twitchPh) + 0.12 * Math.sin(b.twitchPh * 2.3 + 1));
    _q2.identity();
    for (let j = i0; j < n; j++) {
      const bone = e.bone[e.tailNames[j]];
      if (!bone) continue;
      _pOld.setFromMatrixPosition(bone.matrixWorld);
      if (j === i0) _pNew.copy(_pOld);
      else _pNew.add(_d.copy(_pOld).sub(_pPrev).applyQuaternion(_q2));
      _pPrev.copy(_pOld);
      _q2.premultiply(tqa(THREE.Object3D.DEFAULT_UP, amp * (j - i0 + 1) / (n - i0)));
      _q.setFromRotationMatrix(bone.matrixWorld).premultiply(_q2);
      bone.matrixWorld.compose(_pNew, _q, _s);
    }
  }
}

// ------------------------------------------------------------------------------------------------
// attack: stalk crouch with the rear-end wiggle, then the pounce: a short leap (the engine's jump
// mechanics, with its push-off) with the forepaws reaching forward, landing forepaws first to pin the
// prey with both paws, and a bite. Running: the built-in bite-lunge.
const WIGGLE = 1.25; // s of crouch + wiggle before the leap
const POUNCE = { height: 0.12, distance: 0.55, land: [0.5, 0.3] };
const attack = {
  kind: 'oneshot', fade: 0.15, needsStand: true, airborne: true,
  start(inst, L) {
    const e = L.engine;
    inst.run = smooth(1.2, 3, e.speed / e.cfg.sq);
    inst.delay = inst.run > 0.5 ? 0 : (inst.opts.wiggle ?? WIGGLE) * e.cfg.sq;
    inst.dur = Infinity;
    if (inst.run > 0.5) {
      inst.lunge = { ...inst, tune: { style: 'bite-lunge' } };
      ONESHOTS.attack.start(inst.lunge, L);
    }
  },
  update(inst, dt, L) {
    const e = L.engine;
    if (inst.lunge) { inst.lunge.t = inst.t; return ONESHOTS.attack.update.call(ONESHOTS.attack, inst.lunge, dt, L); }
    if (inst.t < inst.delay) return false;
    if (!inst.leap) {
      inst.leap = { ...inst, t: 0, tune: POUNCE, opts: { target: inst.opts.target } };
      ONESHOTS.jump.start(inst.leap, L);
    }
    const J = inst.leap;
    J.t = inst.t - inst.delay;
    const done = ONESHOTS.jump.update(J, dt, L);
    inst.phase = J.phase;
    if (inst.landT !== undefined && inst.t - inst.landT > 0.75) return true;
    void done; void e;
    return false;
  },
  onLand(inst, L) {
    if (inst.lunge) return ONESHOTS.attack.onLand.call(ONESHOTS.attack, inst.lunge, L);
    if (!inst.leap) return;
    ONESHOTS.jump.onLand(inst.leap, L);
    inst.landT = inst.t;
    // the strike: both forepaws pin, then the bite
    const e = L.engine;
    const p = e.legs[0].contact.clone().lerp(e.legs[1].contact, 0.5);
    const dir = inst.opts.target ? inst.opts.target.clone().sub(e.pos).setY(0).normalize() : e.forward(e.heading, new THREE.Vector3());
    e.emit('attackHit', { position: p, direction: dir, style: 'pounce' });
  },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t, cfg = e.cfg, s = cfg.s;
    if (inst.lunge) return ONESHOTS.attack.apply(P, w, inst.lunge, L);
    if (inst.opts.target) { P.look = inst.opts.target; mx(P, 'lookW', 1, w); }
    // the stalk crouch: chest low, elbows up, head low and forward, gaze locked; the hindquarters
    // tread from foot to foot (the butt wiggle) before the leap
    const c = smooth(0, 0.35, t) * (1 - smooth(inst.delay - 0.1, inst.delay + 0.15, t)) * w;
    mx(P, 'dropF', 0.52, c); mx(P, 'dropH', 0.5, c); mx(P, 'fwd', -0.01 / U(e), c);
    mx(P, 'headRaise', -0.014 / U(e), c); mx(P, 'neckReach', 0.012 / U(e), c); mx(P, 'headPitch', -0.1, c);
    const ears = w * (inst.landT === undefined ? 1 : 1 - smooth(0.3, 0.7, t - inst.landT));
    mx(P, 'earFlat', -0.2, ears); mx(P, 'earTwitch', 0, ears);
    const wig = smooth(0.3, 0.55, t) * (1 - smooth(inst.delay - 0.2, inst.delay - 0.05, t));
    const ph = Math.sin(t * TAU * 3.2);
    P.side += 0.006 / U(e) * ph * wig * w;
    P.roll += 0.06 * ph * wig * w;
    mx(P, 'dropH', 0.42 - 0.12 * Math.abs(ph), wig * w);
    const J = inst.leap;
    if (!J) return;
    ONESHOTS.jump.apply(P, w, J, L);
    // forepaws: reach forward in the flight, strike down together and pin on landing
    const fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
    let reach = 0, ahead = 0, up = 0;
    if (J.phase === 'air') {
      const T = (2 * J.vy) / 9.81, x = clamp((J.t - J.tAir) / T, 0, 1);
      reach = smooth(0, 0.3, x); ahead = 0.065; up = 0.05 * (1 - smooth(0, 1, x));
      mx(P, 'jaw', 0.35, w * smooth(0.4, 0.9, x)); mx(P, 'jawOmega', 25, w);
    } else if (J.phase === 'land') {
      const x = J.t - J.tLand;
      reach = 1 - smooth(0.35, 0.7, x); ahead = 0.065; up = 0;
      mx(P, 'jaw', 0.45 * (1 - smooth(0.1, 0.3, x)), w); mx(P, 'jawOmega', 30, w);
      const bite = smooth(0.05, 0.2, x) * (1 - smooth(0.4, 0.7, x));
      mx(P, 'headRaise', -0.02 / U(e), bite * w); mx(P, 'headPitch', 0.35, bite * w);
    }
    if (reach > 0) {
      for (let i = 0; i < 2; i++) {
        const Ld = e.legs[i].def;
        const tp = tv().copy(e.fr.shC).addScaledVector(fwd, ahead * s).addScaledVector(lat, Ld.s * Ld.cx);
        tp.y = e.terrainH(tp.x, tp.z) + up * s;
        const k = reach * w;
        P.legs[i].target.lerp(tp, k / Math.max(1e-3, P.legs[i].reach + k));
        mxLeg(P, i, 'reach', 1, k);
      }
    }
  },
};

// hit: the built-in flinch (and push), then the arched-back threat with bristling fur and a hiss
const hit = {
  kind: 'oneshot', fade: 0.12,
  start(inst, L) {
    ONESHOTS.hit.start(inst, L);
    inst.dur = 2.6;
    B(L.engine).hitAfter = 6;
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t;
    ONESHOTS.hit.apply(P, w, inst, L);
    // the arch: back humped high, legs stiff and straight, body raised, head low with the ears flat
    // back, mouth open in a hiss, fur (and the tail: bottle brush) standing on end
    const a = smooth(0.18, 0.55, t) * (1 - smooth(2.0, 2.6, t)) * w;
    mx(P, 'flex', 0.82, a); mx(P, 'dropF', -0.12, a); mx(P, 'dropH', -0.16, a);
    mx(P, 'fwd', -0.012 / U(e), a);
    mx(P, 'headRaise', -0.03 / U(e) * 0.5, a); mx(P, 'headPitch', 0.05, a); mx(P, 'lookW', 0.6, a);
    mx(P, 'tailLift', 0.85, a); mx(P, 'tailStiff', 2.0, a); mx(P, 'tailIdle', 0, a); mx(P, 'tailGround', 0, a); // (the tail upright: 2.2 swung it forward over the back and tore the skin under its root)
    mx(P, 'earFlat', 0.55, a); mx(P, 'earTwitch', 0, a); // (0.65 stretched the crown between the ears > 3x)
    const hiss = smooth(0.45, 0.6, t) * (1 - smooth(1.3, 1.55, t));
    mx(P, 'jaw', 0.42, hiss * w); mx(P, 'jawOmega', 30, w);
    mx(P, 'eyelid', 0.15, a);
    P.furRaise = Math.max(P.furRaise, smooth(0.15, 0.4, t) * (1 - smooth(2.1, 2.6, t)) * w);
    mx(P, 'legGait', 0, a * 0.6);
  },
};

// loaf: sternal, every paw tucked out of sight under the body, tail along the flank, eyes half shut
const o_ = { foreBack: 0.09, hindFwd: 0.28, hindIn: 0.35 };
const loaf = {
  kind: 'posture', fadeIn: 1.3, fadeOut: 1.0,
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, fr = e.fr;
    POSTURES.lie.apply(P, w, inst, L);
    // forepaws tucked back under the chest, the hind paws under the thighs: nothing shows but a round loaf
    // (the forepaws 5 % of a leg behind the shoulder showed under the chest front, the hind paws beside the flank)
    const k = smooth(0.2, 0.9, w);
    for (let i = 0; i < 4; i++) {
      const Ld = e.legs[i].def, front = i < 2;
      const tp = front ? e.bodyToWorld(Ld.cx * Ld.s * 0.75, 0, cfg.zS - o_.foreBack * Ld.len, e.heading, e.pos, tv())
        : e.bodyToWorld(Ld.cx * Ld.s * 1.1, 0, cfg.zH + o_.hindFwd * Ld.len, e.heading, e.pos, tv());
      tp.y = e.terrainH(tp.x, tp.z) + 0.01 * cfg.s;
      P.legs[i].target.copy(tp);
      // (the hind legs keep the lie's fold, the metatarsus flat on the ground, and draw their paws half way in:
      // reaching all the way, the free hock stood out of the flank)
      mxLeg(P, i, 'reach', front ? 1 : o_.hindIn, k);
      if (front) mxLeg(P, i, 'fold', 0, k);
    }
    const c = smooth(0.6, 1.8, inst.t) * w;
    // the tail wrapped forward along the flank (swept out sideways it lay out behind with the tip up)
    mx(P, 'tailSide', 0, c); mx(P, 'tailCurl', inst.side * 3.2, c); mx(P, 'tailStiff', 0.6, c); mx(P, 'tailGround', 0.9, c);
    mx(P, 'headRaise', -0.01 / U(e), c); mx(P, 'headPitch', 0.12, c);
    mx(P, 'eyelid', 0.45, smooth(2, 4, inst.t) * w);
    mx(P, 'breathRate', 0.7, c);
    void fr;
  },
};

// groom: sits back, lifts a forepaw to the mouth and licks it, then wipes it over the ear and face
const groom = {
  kind: 'oneshot', fade: 0.4,
  start(inst, L) {
    inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 6.5);
    inst.side = inst.opts.side ?? (L.engine.rand() < 0.5 ? 1 : -1);
    inst.sitTune = { ...(L.engine.cfg.actions.sit || {}) };
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, cfg = e.cfg, t = inst.t, s = cfg.s;
    // sit down for it (unless already sitting)
    const sitW = smooth(0, 1.0, t) * (1 - smooth(inst.dur - 0.9, inst.dur, t)) * w;
    if (!posture(L, 'sit')) POSTURES.sit.apply(P, sitW, { tune: inst.sitTune, side: -inst.side, t }, L);
    const up = smooth(0.8, 1.4, t) * (1 - smooth(inst.dur - 1.2, inst.dur - 0.6, t)) * w;
    if (up <= 0) return;
    const i = inst.side > 0 ? 0 : 1; // the paw on this side
    // cycle: lick the paw 4 times (~0.3 s each), then 2 wipes over the ear and down the cheek
    const cyc = (t - 1.4) % 2.6, lick = cyc < 1.3, wipe = !lick ? (cyc - 1.3) / 1.3 : 0;
    const fwd = e.forward(e.heading, tv()), lat = e.left(e.heading, tv());
    const hp = e.headPose.position;
    const tp = tv().copy(hp).addScaledVector(fwd, 0.062 * s).addScaledVector(lat, inst.side * 0.006 * s);
    tp.y = hp.y - 0.068 * s;
    if (!lick) {
      // wipe: the paw rises past the ear and draws down over the cheek (the head turns into it)
      const u = Math.sin(Math.PI * wipe);
      tp.addScaledVector(lat, inst.side * 0.012 * s * u).addScaledVector(fwd, -0.006 * s * u);
      tp.y += 0.014 * s * u;
    }
    P.legs[i].target.lerp(tp, up / Math.max(1e-3, P.legs[i].reach + up));
    mxLeg(P, i, 'reach', 1, up * 0.7);
    mx(P, 'lookW', 0, up);
    if (lick) {
      // head down to the paw, the tongue (jaw) flicking
      mx(P, 'headPitch', 0.7 + 0.1 * Math.sin(t * TAU * 3.2), up); mx(P, 'headYaw', inst.side * 0.25, up);
      mx(P, 'jaw', 0.05 + 0.1 * Math.max(0, Math.sin(t * TAU * 3.2)), up); mx(P, 'jawOmega', 30, up);
      mx(P, 'eyelid', 0.55, up);
    } else {
      mx(P, 'headPitch', 0.35, up); mx(P, 'headYaw', inst.side * 0.45 * Math.sin(Math.PI * wipe), up);
      mx(P, 'headRoll', inst.side * 0.28 * Math.sin(Math.PI * wipe), up);
      mx(P, 'earFlat', 0.4 * Math.sin(Math.PI * wipe), up);
      mx(P, 'eyelid', 0.8, up);
    }
    mx(P, 'headRaise', -0.004 / U(e), up);
  },
};

// knead: treads the forepaws alternately (~1.5 Hz), eyes half shut
const knead = {
  kind: 'oneshot', fade: 0.3, needsStand: true,
  start(inst) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 4); },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, s = e.cfg.s, t = inst.t;
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    mx(P, 'dropF', 0.25, w); mx(P, 'eyelid', 0.6, w); mx(P, 'tailLift', 0.4, w);
    const k = w * smooth(0.2, 0.5, t) * (1 - smooth(inst.dur - 0.4, inst.dur, t));
    for (let i = 0; i < 2; i++) {
      const ph = t * TAU * 1.5 + (i ? Math.PI : 0);
      const lift = Math.max(0, Math.sin(ph));
      const tp = tv().copy(e.legs[i].plant);
      tp.y += 0.018 * s * lift;
      tp.addScaledVector(e.forward(e.heading, tv()), 0.006 * s * lift);
      P.legs[i].target.copy(tp);
      mxLeg(P, i, 'reach', 1, k);
    }
  },
};

// stalk: the crouched creep (drive it with a slow walk): belly low, shoulders up, head low and
// forward, tail low with its tip twitching, eyes on the target
const stalk = {
  kind: 'oneshot', fade: 0.5,
  start(inst) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 5); },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine;
    // (the rump as low as the chest: a back rising from low shoulders to the loin read as the opposite of
    // the stalking photo's high shoulder blades)
    mx(P, 'dropF', 0.42, w); mx(P, 'dropH', 0.46, w);
    mx(P, 'headRaise', -0.03 / U(e) * 0.45, w); mx(P, 'neckReach', 0.01 / U(e), w); mx(P, 'headPitch', -0.08, w);
    mx(P, 'speedScale', 0.5, w);
    if (inst.opts.target) { P.look = inst.opts.target; mx(P, 'lookW', 1, w); }
  },
};

// slowblink on demand
const slowblink = {
  kind: 'oneshot', fade: 0.2,
  start(inst, L) { inst.dur = 2.3; B(L.engine).blinkT = 0; },
  update(inst) { return inst.t >= inst.dur; },
  apply() {},
};

export const hooks = {
  update, pose,
  actions: {
    attack, hit, loaf, groom, knead, stalk, slowblink,
    // (a light animal gets up from its side quickly: over the default 1.6 s a hind paw re-stepped
    // while the lying leg pose still held it and landed with a jump on a slope)
    death: { ...POSTURES.death, kind: 'posture', fadeOut: 1.2 },
  },
};
