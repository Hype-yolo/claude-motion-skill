// Dog behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js):
//
//   update(P, dt, layer)  every frame over the action layer: mood (happy / alert / angry / afraid) from
//                         what the dog is doing, which sets the tail wag (rate and amplitude), the tail
//                         carriage (raised stiff in an attack, tucked when hit), the ears, hackles and
//                         the snarl; panting after running (jaw, tongue); the head tilt; the curled
//                         sleep (tail over the nose); automatic idle variants (head tilt, sniffing,
//                         pawing the ground, play bow, a happy wag burst)
//   pose(engine, dt)      after the engine's solve: the wag itself (any rate: 2-3 Hz relaxed, 4-6 Hz
//                         excited, whip-like from the root, biased to the dog's right when happy,
//                         Quaranta et al. 2007), the tongue sliding out to pant and lapping when
//                         drinking, and the soft drop ears of retrievers (and pups / button ears)
//                         swinging as pendulums driven by the head's acceleration and gravity
//   actions               greet (wiggling, fast-wagging welcome), playbow, sniff, dig (pawing the
//                         ground), hit (yelp and cower, wraps the built-in flinch)
//
// Distances are dog metres at the reference size x cfg.s; posture offsets that the engine multiplies by
// cfg.k (fwd, headRaise, neckReach) are divided by cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tq, tqa } from '../../core/motion/common.js';
import { mx, mxLeg, ONESHOTS, POSTURES, mouthGroundTarget } from '../../core/motion/actions.js';

const sm = (w) => w * w * (3 - 2 * w);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _a = new THREE.Vector3(), _lat = new THREE.Vector3();
const _hx = new THREE.Vector3(), _hz = new THREE.Vector3(), _g = new THREE.Vector3(), _qi = new THREE.Quaternion();
const TAIL_W = [0.5, 0.45, 0.4, 0.36, 0.32, 0.29, 0.27, 0.25]; // share of the wag per tail segment, root -> tip
const busy = (L) => L.postures.length > 0 || L.oneshots.some((a) => !a.stopping);

// tail carriage offsets per variant (rad): raised stiff in an attack, tucked when afraid
const TAIL_MOOD = { shepherd: { up: 1.25, down: -1.0 }, retriever: { up: 1.0, down: -1.3 }, terrier: { up: 0.3, down: -2.2 } };
// roll of the curled sleep onto the outer hip (rad; the core's is 0.35). The terrier lies further over:
// its chest rests on the ground with the shoulders so low that the elbow on the inside of the curl
// sank 6 mm below its skin's clearance at 0.35 and had to be swung out of the ground (measured:
// at 0.45 both elbows stay clear unswung on seeds 1-4, the lowest 1.4 mm above it)
const CURL_ROLL = { terrier: 0.45 };

function B(e) {
  if (!e._dog) {
    const v = e.params.variant || 'shepherd';
    const earType = e.params.earType || 'prick';
    e._dog = {
      variant: v, mood: TAIL_MOOD[v] || TAIL_MOOD.shepherd,
      happy: 0.4 + 0.3 * e.rand(), wagPh: 0, wagAmp: 0, wagAmpV: 0, wagFreq: 2.4, wagBias: 0, wagOn: 0,
      tongue: 0, tongueV: 0, lap: 0, lapW: 0, pant: 0,
      tilt: null, idleT: 4 + e.rand() * 6,
      swing: earType === 'drop' ? 1 : earType === 'button' ? 0.45 : 0,
      ear: [{ f: 0, vf: 0, s: 0, vs: 0 }, { f: 0, vf: 0, s: 0, vs: 0 }],
      hp: new THREE.Vector3(), hv: new THREE.Vector3(), ha: new THREE.Vector3(), hInit: 0,
    };
  }
  return e._dog;
}

// ------------------------------------------------------------------------------------------------
// update: mood, tail, ears, panting, head tilt, idle variants
function update(P, dt, L) {
  const e = L.engine, b = B(e), cfg = e.cfg;
  const vn = e.speed / cfg.sq;
  const moving = smooth(0.05, 0.8, vn) * P.gaitW;
  let attack = 0, hit = 0, greet = 0, bow = 0, eat = 0, drink = 0, sniff = 0;
  for (const a of L.oneshots) {
    const w = sm(a.w);
    if (w <= 0) continue;
    if (a.name === 'attack') {
      attack = Math.max(attack, w);
      const t = a.t;
      // threat -> lunge: hackles up, tail raised stiff, lips drawn back (the jaw opens a little on the
      // crouch so the canines show), a growl
      const snarl = smooth(0.0, 0.12, t) * (1 - smooth(0.24, 0.32, t));
      P.jaw = Math.max(P.jaw, 0.16 * snarl * w);
      mx(P, 'headRaise', -0.03 / cfg.unit, snarl * w);
      if (!a._voc) { a._voc = true; e.emit('vocalize', { kind: 'snarl' }); }
    } else if (a.name === 'hit') hit = Math.max(hit, w * (1 - smooth(0.9, 1.5, a.t)));
    else if (a.name === 'greet') greet = Math.max(greet, w);
    else if (a.name === 'playbow') bow = Math.max(bow, w);
    else if (a.name === 'eat') eat = Math.max(eat, w);
    else if (a.name === 'drink') { drink = Math.max(drink, w); b.lapT = a.t; }
    else if (a.name === 'sniff' || a.name === 'dig') sniff = Math.max(sniff, w);
  }
  let asleep = 0, dead = 0, lying = 0, sitting = 0;
  for (const p of L.postures) {
    const w = sm(clamp(p.w, 0, 1));
    if (p.name === 'sleep') asleep = Math.max(asleep, w * smooth(1.0, 3.0, p.t));
    if (p.name === 'death') dead = Math.max(dead, w);
    if (p.name === 'lie' || p.name === 'sleep') lying = Math.max(lying, w);
    if (p.name === 'sit') sitting = Math.max(sitting, w);
    // curled sleep: the tail is drawn round over the nose and forepaws
    if (p.name === 'sleep' && p.tune.style !== 'lateral') {
      const c = w * smooth(1.2, 3.2, p.t);
      mx(P, 'tailSide', p.side * 3.0, c); mx(P, 'tailStiff', 0.7, c); mx(P, 'bend', p.side * 1.35, c); mx(P, 'headYaw', p.side * 0.9, c); mx(P, 'headRoll', p.side * 0.3, c);
      if (CURL_ROLL[b.variant]) mx(P, 'roll', p.side * CURL_ROLL[b.variant], c);
    }
    // (the head lies on its side on the cheek and the lower ear: the occiput rests higher than the core's)
    if (p.name === 'death') { const c = w * smooth(0.3, 1.0, p.t); mx(P, 'earFlat', 1.1, c); mx(P, 'earTwitch', 0, c); P.headPos.y += (0.035 + 0.1 * Math.max(0, (e.params.headScale || 1) * (e.params.headW || 1) - 1)) * cfg.s * c; }
    if (p.name === 'sleep') { const c = w * smooth(1.0, 3.0, p.t); P.headPos.y += (0.03 + 0.22 * Math.max(0, (e.params.headScale || 1) * (e.params.headW || 1) - 1)) * cfg.s * c; mx(P, 'headPitch', 0.55, c); }
  }

  // eating: the mouth works just above the food (the jaw opens below the closed-mouth target)
  if (eat > 0) { P.headPos.y += 0.02 * cfg.s * eat; P.jaw = Math.min(P.jaw, 0.22); }

  // ---- mood: happiness rises when greeting / playing, fades slowly; fear and anger override it
  b.happy = clamp(b.happy + dt * (0.5 * Math.max(greet, bow) - 0.012) - dt * 0.6 * (attack + hit), 0.15, 1);

  // ---- tail carriage by mood
  mx(P, 'tailLift', b.mood.up, attack); mx(P, 'tailStiff', 2.0, attack); mx(P, 'tailIdle', 0.2, attack);
  mx(P, 'tailLift', b.mood.down, hit); mx(P, 'tailStiff', 1.6, hit); mx(P, 'tailIdle', 0, hit);
  // happy: carried a little higher (never above the back in a shepherd)
  const up = Math.max(greet, bow) * (b.variant === 'terrier' ? 0.1 : 0.55);
  if (up > 0) P.tailLift += up;
  P.furRaise = Math.max(P.furRaise || 0, attack * 0.8);

  // ---- wag: target amplitude (rad at the root segment) and rate
  let amp = 0, freq = 2.4;
  const idleW = L.idle.w;
  // relaxed: a loose wag while standing about, faster and wider the happier the dog is
  amp = idleW * (0.1 + 0.35 * b.happy) * (b.wagOn > 0 ? 1 : 0.35);
  freq = lerp(2.0, 3.0, b.happy);
  // on the move: a small wag at walk and trot, none at the gallop
  amp = Math.max(amp, moving * (1 - smooth(1.5, 4, vn)) * 0.12 * b.happy);
  // sitting: the tail sweeps the ground
  amp = Math.max(amp, sitting * 0.25 * b.happy);
  // greeting / play bow: fast, wide, whole-rear wag
  if (greet + bow > 0) { amp = lerp(amp, 0.62, Math.max(greet, bow)); freq = lerp(freq, 5.2, Math.max(greet, bow)); }
  if (sniff > 0) { amp = lerp(amp, 0.18, sniff); freq = lerp(freq, 3.2, sniff); }
  amp *= (1 - attack) * (1 - hit) * (1 - asleep) * (1 - dead) * (1 - 0.8 * lying) * (1 - 0.6 * eat);
  // attack: the raised tail quivers ("flagging")
  amp += attack * 0.05; if (attack > 0.3) freq = lerp(freq, 7, attack);
  b.wagAmpT = amp; b.wagFreqT = freq;
  // occasional bursts of wagging while idle
  b.wagOn -= dt;
  if (b.wagOn < -3 - 6 * (1 - b.happy) && idleW > 0.5) b.wagOn = 1.5 + 3 * e.rand();

  // ---- panting after running (the engine's heat), jaw wider, tongue out
  const hot = smooth(0.12, 0.45, e.heat) * (1 - smooth(5, 8, vn));
  b.pant = hot * (1 - attack) * (1 - asleep) * (1 - dead) * (1 - eat) * (1 - drink) * (1 - sniff);
  if (b.pant > 0.01) { P.jaw += 0.13 * b.pant; mx(P, 'breathAmp', 1.5, b.pant); }
  // tongue: panting, a happy greeting, lapping
  b.tongueT = Math.max(b.pant, 0.35 * greet * b.happy, 0.25 * bow);
  b.lapW = drink;

  // ---- ears
  // alert (a look target or sniffing): pricked forward; greeting: laid softly back; attack: core flattens
  if (e.input.look && attack < 0.01) mx(P, 'earFlat', -0.2, clamp(P.lookW, 0, 1));
  mx(P, 'earFlat', 0.45, greet); mx(P, 'earFlat', -0.15, bow + sniff);
  mx(P, 'earFlat', 1.1, hit);

  // ---- head tilt (idle variant): the head rolls 20-25 deg to one side, ears pricked, sometimes twice
  const tl = b.tilt;
  if (tl) {
    tl.t += dt;
    const k = smooth(0, 0.35, tl.t) * (1 - smooth(tl.dur, tl.dur + 0.4, tl.t)) * idleW;
    mx(P, 'headRoll', tl.side * 0.42, k); mx(P, 'headYaw', -tl.side * 0.12, k); mx(P, 'headPitch', -0.08, k);
    mx(P, 'earFlat', -0.25, k);
    if (tl.t > tl.dur + 0.4) b.tilt = tl.again ? { t: -0.2, dur: 0.8 + 0.6 * e.rand(), side: -tl.side, again: false } : null;
    if (idleW < 0.3) b.tilt = null;
  }

  // ---- automatic idle variants (standing still, nothing else running, nobody steering the gaze)
  if (e.idleVariants !== false && idleW > 0.98 && !busy(L) && !e.input.look && !e.input.follow && !b.tilt) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 5 + e.rand() * 9;
      const r = e.rand();
      if (r < 0.34) b.tilt = { t: 0, dur: 1.0 + 1.2 * e.rand(), side: e.rand() < 0.5 ? -1 : 1, again: e.rand() < 0.4 };
      else if (r < 0.54) L.play('sniff', { duration: 2.5 + 2 * e.rand() });
      else if (r < 0.66) L.play('playbow');
      else if (r < 0.76) L.play('dig', { duration: 1.8 + e.rand() });
      else b.wagOn = 2 + 2 * e.rand(), b.happy = Math.min(1, b.happy + 0.2);
    }
  } else if (busy(L)) b.idleT = Math.max(b.idleT, 3);
}

// ------------------------------------------------------------------------------------------------
// pose: wag, tongue, swinging ears (after the engine wrote every bone)
function pose(e, dt) {
  const b = B(e), cfg = e.cfg;
  // wag state (critically damped amplitude, soft rate changes)
  const om = 7;
  b.wagAmpV += (om * om * ((b.wagAmpT || 0) - b.wagAmp) - 2 * om * b.wagAmpV) * dt;
  b.wagAmp += b.wagAmpV * dt;
  b.wagFreq += ((b.wagFreqT || 2.4) - b.wagFreq) * (1 - Math.exp(-dt * 3));
  b.wagPh = (b.wagPh + dt * TAU * b.wagFreq) % (TAU * 1000);
  // right-biased when positive (the dog's right = -x: negative yaw), smoothed (no steps)
  const biasT = -0.18 * b.happy * Math.max(0, b.wagAmp);
  b.biasV = (b.biasV || 0) + (om * om * (biasT - b.wagBias) - 2 * om * (b.biasV || 0)) * dt;
  b.wagBias += b.biasV * dt;
  const A = b.wagAmp;
  const lod = e.lod;
  // (crowds: only a real wag, not the relaxed idle sway)
  const minA = lod >= 2 ? 0.12 : 1e-4;
  if ((Math.abs(A) > minA || Math.abs(b.wagBias) > minA) && e.tail && e.tail.n) wagTail(e, b, A);
  // tongue (not in crowds)
  if (lod < 2) { clearJaw(e, b, dt); tongue(e, b, dt); }
  if (b.swing > 0 && lod < 2) swingEars(e, b, dt);
  void cfg;
}

// rotate the tail chain from the root: each segment turns about its own dorsal axis (lateral bending)
function wagTail(e, b, A) {
  const n = e.tail.n, T = e.cfg.tail;
  const rad0 = T.radius[0] * e.cfg.s, rad1 = T.radius[1] * e.cfg.s;
  _lat.set(1, 0, 0).applyQuaternion(e.fr.qPel);
  _q2.identity(); // cumulative rotation
  let px = 0, py = 0, pz = 0; // accumulated new head position
  for (let i = 0; i < n; i++) {
    const bone = e.bone['tail' + i];
    if (!bone) return;
    const m = bone.matrixWorld;
    _p.setFromMatrixPosition(m);
    _q.setFromRotationMatrix(m);
    if (i === 0) { px = _p.x; py = _p.y; pz = _p.z; }
    _d.set(0, 1, 0).applyQuaternion(_q); // original direction
    // the segment's dorsal axis: lat x dir, plus the pelvis' up axis orthogonal to the segment (never
    // zero together, and both point the same way: continuous for a hanging, level, erect or curled tail)
    const ax = tv().crossVectors(_lat, _d);
    const upx = tv(0, 1, 0).applyQuaternion(e.fr.qPel);
    ax.add(upx.addScaledVector(_d, -upx.dot(_d))).normalize();
    const a = (A * Math.sin(b.wagPh - 0.38 * i) + b.wagBias) * TAIL_W[Math.min(i, TAIL_W.length - 1)];
    _q2.multiply(tqa(ax, a));
    const len = e.tail.len[i];
    const newQ = tqa(ax, 0).copy(_q2).multiply(_q);
    const dn = tv(0, 1, 0).applyQuaternion(newQ);
    // the wag never swings a segment into the ground (a tail lying on it when sitting or lying):
    // raise the segment's slope just enough, keeping its heading; the rest of the tail follows
    const floor = e.terrainH(px + dn.x * len, pz + dn.z * len) + lerp(rad0, rad1, (i + 1) / n);
    if (py + dn.y * len < floor) {
      const dy = clamp((floor - py) / len, -1, 1), hl = Math.hypot(dn.x, dn.z) || 1, c = Math.sqrt(1 - dy * dy);
      const d2 = tv(dn.x / hl * c, dy, dn.z / hl * c);
      const fix = tq().setFromUnitVectors(dn, d2);
      newQ.premultiply(fix); _q2.premultiply(fix);
      dn.copy(d2);
    }
    m.compose(tv(px, py, pz), newQ, _s);
    px += dn.x * len; py += dn.y * len; pz += dn.z * len;
  }
}

// the lower jaw never enters the ground (the core clears the closed mouth; an open jaw reaches lower
// when tearing food or panting with the head down): close it about the hinge just enough, springy
function clearJaw(e, b, dt) {
  const jaw = e.bone.jaw;
  if (!jaw) return;
  const s = e.cfg.s, m = jaw.matrixWorld;
  _p.setFromMatrixPosition(m);
  _q.setFromRotationMatrix(m);
  _d.set(0, 1, 0).applyQuaternion(_q);
  const len = b.jawLen || (b.jawLen = e.J.jawHinge.distanceTo(e.J.jawTip));
  let need = 0;
  // chin (under the jaw tip) and the middle of the mandible's lower edge
  for (const [t, r] of [[1, 0.012], [0.55, 0.02]]) {
    const pt = tv().copy(_p).addScaledVector(_d, len * t);
    const lack = e.terrainH(pt.x, pt.z) + r * s - pt.y;
    if (lack > 0) need = Math.max(need, Math.asin(clamp(lack / (len * t), 0, 1)));
  }
  // rate-limited release (no snap back when the head lifts)
  b.jawClr = Math.max(need, (b.jawClr || 0) - dt * 2);
  if (b.jawClr < 1e-4) return;
  _hx.set(1, 0, 0).applyQuaternion(_q);
  // (closing = rotating the jaw's +Y up about its lateral axis: toward the skull)
  _q.premultiply(tqa(_hx, -b.jawClr));
  m.compose(_p, _q, _s);
  // the tongue rides on the jaw: re-derive it from the corrected jaw
  const tb = e.bone.tongue;
  if (tb) for (const x of e.extraBones) if (x.bone === tb) tb.matrixWorld.multiplyMatrices(m, x.rel);
}

// tongue: slides out over the lower incisors and hangs (panting), or ladles in and out (lapping)
function tongue(e, b, dt) {
  const bone = e.bone.tongue;
  if (!bone) return;
  // lapping: ~3 laps / s in phase with the built-in drink's jaw (tongue curled back into a ladle)
  let tgt = b.tongueT || 0, droop = 0.55;
  if (b.lapW > 0.01) {
    const lap = Math.max(0, Math.sin((b.lapT || 0) * 3 * TAU));
    tgt = lerp(tgt, 0.3 + 0.45 * lap, b.lapW);
    droop = lerp(droop, 0.15 + 0.35 * lap, b.lapW);
  }
  const om = b.lapW > 0.01 ? 30 : 9;
  b.tongueV += (om * om * (tgt - b.tongue) - 2 * om * b.tongueV) * dt;
  b.tongue += b.tongueV * dt;
  const out = clamp(b.tongue, 0, 1.2);
  if (out < 1e-3) return;
  const s = e.cfg.s;
  const m = bone.matrixWorld;
  _p.setFromMatrixPosition(m);
  _q.setFromRotationMatrix(m);
  _d.set(0, 1, 0).applyQuaternion(_q);
  _hx.set(1, 0, 0).applyQuaternion(_q);
  // slide forward, then droop about the lower incisors; the hanging part bobs with the breath
  const slide = 0.058 * s * out;
  const pivotAlong = 0.11 * s;
  const ang = droop * smooth(0, 0.6, out) * (1 + 0.12 * Math.sin(e.breath));
  const base0 = tv().copy(_p), pivot = tv().copy(_p).addScaledVector(_d, pivotAlong);
  // (the tip never enters the ground: the tongue first slides back in just enough (the tip's height is
  // linear in the slide, well conditioned while the tongue points down, as when lapping with the head
  // low), then the droop is reduced, down to curling the tongue up; both by bisection, continuous in
  // the pose. Reducing only the droop near the bottom of its arc swung the tongue ~0.6 rad in 10 ms.)
  const len = e.J.tongueBase.distanceTo(e.J.tongueTip), p0 = tv();
  const tipY = (a, sl) => {
    const R = tqa(_hx, a);
    p0.copy(base0).addScaledVector(_d, sl);
    const base = tv().subVectors(p0, pivot).applyQuaternion(R).add(pivot);
    const tip = tv().copy(_d).applyQuaternion(R).multiplyScalar(len).add(base);
    return tip.y - (e.terrainH(tip.x, tip.z) + 0.004 * s); // (it may dip into water: lapping)
  };
  let A = ang, sl = slide;
  if (tipY(A, sl) < 0) {
    if (tipY(A, 0) >= 0) {
      // the longest feasible slide
      let lo = 0, hi = sl;
      for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (tipY(A, mid) >= 0) lo = mid; else hi = mid; }
      sl = lo;
    } else {
      // fully in, and the largest feasible droop below A: scan down, then refine between the last two samples
      sl = 0;
      let hi = A, lo = A;
      const step = (A + 0.9) / 24;
      for (let i = 1; i <= 24; i++) { lo = A - step * i; if (tipY(lo, 0) >= 0) break; hi = lo; }
      for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (tipY(mid, 0) >= 0) lo = mid; else hi = mid; }
      A = lo;
    }
  }
  p0.copy(base0).addScaledVector(_d, sl);
  A *= smooth(0, 0.25, out); // (retracted: rigid on the jaw, whatever the clamp says)
  const R = tqa(_hx, A);
  const rel = tv().subVectors(p0, pivot).applyQuaternion(R);
  _p.copy(pivot).add(rel);
  _q.premultiply(R);
  m.compose(_p, _q, _s);
}

// soft drop ears: two damped pendulum angles per ear in the head frame (fore-aft about the head's
// lateral axis, outward about its long axis), driven by the head's acceleration and by gravity
function swingEars(e, b, dt) {
  if (!(dt > 1e-5)) return;
  const hp = e.headPose.position, hq = e.headPose.quaternion;
  if (b.hInit < 2) {
    if (b.hInit === 1) b.hv.subVectors(hp, b.hp).multiplyScalar(1 / dt);
    b.hp.copy(hp); b.hInit++;
    return;
  }
  const v = tv().subVectors(hp, b.hp).multiplyScalar(1 / dt);
  const acc = tv().subVectors(v, b.hv).multiplyScalar(1 / dt);
  b.hp.copy(hp); b.hv.copy(v);
  // low-pass the acceleration (finite differences of a stepped body are noisy)
  b.ha.lerp(acc.clampLength(0, 60), 1 - Math.exp(-dt * 30));
  _qi.copy(hq).invert();
  _a.copy(b.ha).applyQuaternion(_qi); // head-local acceleration
  _g.set(0, -1, 0).applyQuaternion(_qi); // gravity direction in the head frame
  const s = e.cfg.s;
  const lenE = 0.09 * s;
  const om = 13 / Math.sqrt(s), z = 0.28;
  const K = b.swing;
  _hx.set(1, 0, 0).applyQuaternion(hq); _hz.set(0, 0, 1).applyQuaternion(hq);
  const sub = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / sub;
  for (let k = 0; k < 2; k++) {
    const E = b.ear[k], side = k === 0 ? 1 : -1;
    // equilibrium: hang along gravity (a lowered or tilted head swings the flaps), outward flop when the
    // head drops fast (trot bounce)
    const tf = -0.8 * Math.asin(clamp(_g.z, -1, 1));
    let ts = 0.8 * Math.asin(clamp(_g.x, -1, 1));
    for (let i = 0; i < sub; i++) {
      const af = om * om * (tf - E.f) - 2 * z * om * E.vf + (_a.z / lenE) * 0.9;
      const as = om * om * (ts - E.s) - 2 * z * om * E.vs - (_a.x / lenE) * 0.9 - side * Math.min(0, _a.y) / lenE * 0.35;
      E.vf += af * h; E.f += E.vf * h;
      E.vs += as * h; E.s += E.vs * h;
      // the flap cannot swing into the cheek; limits
      if (side * E.s < -0.04) { E.s = -0.04 * side; if (side * E.vs < 0) E.vs = 0; }
      E.f = clamp(E.f, -0.55, 0.55); E.s = clamp(E.s, -0.65, 0.65);
    }
    const bone = e.bone[k === 0 ? 'earL' : 'earR'];
    if (!bone) continue;
    const m = bone.matrixWorld;
    _p.setFromMatrixPosition(m);
    _q.setFromRotationMatrix(m);
    // the flap never swings into the ground (a head lowered or lying on its side): keep the largest
    // share of the swing that leaves its tip and its broad middle clear (the core cleared the unswung ear)
    const L = b.earLen || (b.earLen = e.J.earBaseL.distanceTo(e.J.earTipL));
    const clear = (f) => {
      const q = tqa(_hz, E.s * K * f).multiply(tqa(_hx, E.f * K * f)).multiply(_q);
      const dy = tv(0, 1, 0).applyQuaternion(q);
      let worst = 1;
      for (const t of [1, 0.6]) {
        const pt = tv().copy(_p).addScaledVector(dy, L * t);
        worst = Math.min(worst, pt.y - (e.terrainH(pt.x, pt.z) + 0.012 * s));
      }
      return worst;
    };
    let f = 1;
    if (clear(1) < 0) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2; if (clear(mid) >= 0) lo = mid; else hi = mid; }
      f = lo;
      E.vf *= 0.5; E.vs *= 0.5;
    }
    _q.premultiply(tqa(_hx, E.f * K * f)).premultiply(tqa(_hz, E.s * K * f));
    m.compose(_p, _q, _s);
  }
}

// ------------------------------------------------------------------------------------------------
// actions

// greeting: fast wide wag that swings the whole rear, body wiggles, ears back, head a little low
const greet = {
  kind: 'oneshot', fade: 0.3,
  start(inst, L) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 3); L.engine.emit('vocalize', { kind: 'whine' }); },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t, b = B(e);
    const k = w * smooth(0, 0.4, t);
    // the rear swings with the wag ("wiggle"): a lateral spine bend in phase with the tail
    mx(P, 'bend', 0.14 * Math.sin(b.wagPh + 0.6), k);
    mx(P, 'roll', 0.03 * Math.sin(b.wagPh), k);
    mx(P, 'headRaise', -0.015 / e.cfg.unit, k); mx(P, 'headPitch', -0.1, k);
    // small bounces on the forelegs
    mx(P, 'dropF', 0.06 + 0.05 * Math.sin(t * TAU * 2.2), k);
    mx(P, 'eyelid', 0.2, k);
  },
};

// play bow: forequarters down on the elbows, forelegs stretched forward, rear up, tail up and wagging
const playbow = {
  kind: 'oneshot', fade: 0.3, needsStand: true,
  start(inst, L) {
    inst.dur = inst.opts.duration ?? 2.4;
    const e = L.engine;
    if (e.rand() < 0.5) e.emit('vocalize', { kind: 'bark' });
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t;
    const down = w * smooth(0.0, 0.5, t) * (1 - smooth(inst.dur - 0.5, inst.dur, t));
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    // the forelegs fold forward along the ground as in the sphinx (the core's lying fold), the chest
    // drops to the elbows while the hind legs stay straight, rear up
    mx(P, 'dropF', 0.88, down); mx(P, 'dropH', -0.06, down);
    for (let i = 0; i < 2; i++) mxLeg(P, i, 'fold', 1, smooth(0.1, 0.8, down));
    mx(P, 'headRaise', 0.03 / e.cfg.unit, down); mx(P, 'headPitch', -0.3, down); mx(P, 'neckReach', 0.02 / e.cfg.unit, down);
    mx(P, 'lookW', 0, down);
  },
};

// sniffing: nose to the ground ahead, sweeping side to side
const sniff = {
  kind: 'oneshot', fade: 0.5,
  start(inst, L) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 4); inst.ph = L.engine.rand() * 6; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t, cfg = e.cfg;
    const pitchA = 0.82;
    const hp = mouthGroundTarget(e, tv(), pitchA, (x, z) => e.terrainH(x, z), 0.95);
    // side to side sweeps, the nose just above the ground; quick sniff bobs
    const sweep = Math.sin(t * 1.3 + inst.ph) * 0.8 + Math.sin(t * 0.47 + 2 * inst.ph) * 0.2;
    hp.addScaledVector(e.left(e.heading, tv()), 0.07 * cfg.s * sweep);
    hp.y += (0.012 + 0.006 * Math.sin(t * TAU * 5)) * cfg.s;
    P.headPos.copy(hp);
    mx(P, 'headW', 1, w); mx(P, 'headReach', 1, w); mx(P, 'headPitch', pitchA, w); mx(P, 'headYaw', 0.3 * sweep, w);
    mx(P, 'lookW', 0, w); mx(P, 'headOmega', 1.6, w);
    mx(P, 'gaitW', 0, w); mx(P, 'dropF', 0.18, w);
    mx(P, 'speedScale', 0, w);
  },
};

// pawing the ground: head down over the spot, the forepaws scrape it alternately, back under the chest
const dig = {
  kind: 'oneshot', fade: 0.3, needsStand: true,
  start(inst, L) {
    inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 2.5);
    const e = L.engine;
    inst.base = [0, 1].map((i) => new THREE.Vector3().copy(e.legs[i].contact));
    inst.fwd = e.forward(e.heading, new THREE.Vector3());
  },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const e = L.engine, t = inst.t, cfg = e.cfg;
    const k = w * smooth(0, 0.3, t);
    mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w);
    mx(P, 'dropF', 0.3, k); mx(P, 'dropH', 0.05, k);
    mx(P, 'headPitch', 0.75, k); mx(P, 'headRaise', -0.06 / cfg.unit, k); mx(P, 'lookW', 0, k);
    mx(P, 'earFlat', -0.1, k);
    const env = smooth(0.15, 0.4, t) * (1 - smooth(inst.dur - 0.35, inst.dur, t));
    for (let i = 0; i < 2; i++) {
      const leg = e.legs[i], len = leg.def.len;
      // one stroke: reach forward high, press down, drag back under the chest, lift (3 Hz, legs alternate)
      const ph = (t * 3.0 + i * 0.5) % 1;
      const u = ph < 0.55 ? 0.28 - 0.4 * smooth(0, 0.55, ph) : -0.12 + 0.4 * smooth(0.55, 1, ph);
      const hgt = ph < 0.55 ? 0.03 : 0.03 + 0.08 * Math.sin(Math.PI * (ph - 0.55) / 0.45);
      const tp = tv().copy(inst.base[i]).addScaledVector(inst.fwd, u * len);
      tp.y = e.terrainH(tp.x, tp.z) + hgt * len;
      // the planted foot stays where it stood outside the strokes
      tp.lerp(inst.base[i], 1 - env);
      const pl = P.legs[i];
      pl.target.copy(tp);
      mxLeg(P, i, 'reach', 1, w);
    }
    if (Math.floor(t * 3) !== inst.lastStroke) { inst.lastStroke = Math.floor(t * 3); }
  },
};

// hit: the built-in flinch, then a yelp and a cower (body low, tail tucked, ears flat, head down)
const hit = {
  kind: 'oneshot', fade: 0.12,
  start(inst, L) { ONESHOTS.hit.start(inst, L); inst.dur = 1.6; L.engine.emit('vocalize', { kind: 'yelp' }); },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    ONESHOTS.hit.apply(P, w, inst, L);
    const t = inst.t, e = L.engine;
    const c = w * smooth(0.12, 0.4, t) * (1 - smooth(1.0, 1.6, t));
    mx(P, 'dropF', 0.3, c); mx(P, 'dropH', 0.42, c);
    mx(P, 'headRaise', -0.035 / e.cfg.unit, c); mx(P, 'headPitch', 0.25, c);
    mx(P, 'eyelid', 0.35, c); mx(P, 'lookW', 0.3, c);
  },
};

// the curled sleep: the core's, unrolling a little more slowly when the dog gets up (the forelegs
// come out from under the curled body)
const sleep = { ...POSTURES.sleep, kind: 'posture', fadeOut: 1.6 };

export const dogHooks = { update, pose, actions: { greet, playbow, sniff, dig, hit, sleep } };
