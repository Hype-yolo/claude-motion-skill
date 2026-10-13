// Action layer for the bird engine (core/motion/bird.js).
//
// Every frame the layer fills a parameter set P (createBirdParams) that the engine reads on top of
// locomotion and flight. Actions are time-parameterised and blend in / out with weights:
//
//   postures  sit (crouch / brood on the tarsi), lie (belly down), sleep (fluffed, head turned back
//             and tucked into the scapulars, or sunk into the shoulders), death (collapse onto the
//             side, wings splayed, toes clenched), perch (fly to a perch and grip it)
//             replace locomotion until 'stand' (or until the bird is asked to move: it stands up first)
//   one-shots jump (hop up with wing beats), attack (peck lunge / wing-beat lunge / talon strike),
//             hit, eat (pecking), drink (dip, then tilt the head back), takeoff, land, glide, flap
//   idle      automatic when standing: saccadic looking around, head cocking, preening, wing and tail
//             flicks, feather shake (rouse), wing-and-leg stretch, weight shifts
//
// play(name, opts) returns a Promise resolved when the action ends (postures: once the pose is
// reached; takeoff: when airborne; land / perch: on touchdown). opts: { target (Vector3), direction
// (Vector3, hit), duration, loop, side, strength, radius / axis (perch branch) }. The promise resolves
// with how the action ended: 'done' | 'interrupted' | 'stopped' | 'refused'.
//
// Arbitration (the rule of every body plan): a new body
// one-shot (jump, attack, hit, eat, drink) interrupts the running ones (fade out, 'interrupted');
// a hop in the air (jump, lunge, spur kick) is committed: only a hit layers over it, anything else is
// refused; eat / drink / jump need the ground and are refused in the air. Flight commands (takeoff,
// land, glide, flap) steer the locomotion: they neither interrupt nor are interrupted by body
// one-shots (glide and flap replace each other). A posture cross-fades from the current one and ends
// the body one-shots (not a hit); stop(name) ends that action, stop() every one-shot and posture but
// death. Dead: only hit is taken; moving does not stand a dead bird up. Death in the air or on a
// perch: the bird falls limp and collapses where it hits the ground.
//
// Species tuning: species.motion.actions = { attack: { style: 'peck' | 'lunge' | 'talons' | 'spur', mantle (0..1:
//   talon strike on the ground throws the wings open and mantles them over the prey) },
//   lie: { wings (0..1, default 1: the sunning droop and part spread; 0 keeps them folded) },
//   death: { wings (0..1, default 1: the splay of the wings of a bird dead on the ground; 0 folded) },
//   eat: { style: 'peck' | 'tear' | 'scratch', rate, reach (tear: food distance ahead of the feet, leg
//   lengths), mantle }, jump: { height, distance }, sleep: { style: 'tuck' | 'sink', fluff (0..1, default 1:
//   how far the plumage fluffs up; a bird whose folded wing lies in a bed on the flank fluffs less) },
//   preen: { spot: [x, y, z] (m at the reference size, body frame from the hip pivot), pitch (rad) },
//   idle: { crow: weight } (extra idle behaviours) }
//   'spur': a flapping jump-kick, both feet thrown forward at the top of the jump (roosters);
//   'tear': raptor: grip and pull with the bill between the feet, wings mantled;
//   'scratch': rakes the ground with one foot and then the other, then pecks at the cleared spot
//   (ground-feeding fowl). Idle extra 'crow': wing clap, neck stretched up, bill open (event
//   'vocalize' { kind: 'crow' }). play('idle', { behaviour: 'crow' }) starts an idle behaviour now.
import * as THREE from 'three';
import { clamp, lerp, smooth, DEG, tv, angDiff } from './common.js';

export function createBirdParams() {
  return {
    gaitW: 1, legGait: 1, speedScale: 1, turnScale: 1, restep: 1, bodyOmega: 1, headOmega: 1, wingOmega: 1,
    drop: 0, lift: 0, pitch: 0, roll: 0, rollAxisK: 0, side: 0, fwd: 0, chestPitch: 0, groundW: 0, sit: 0, fluff: 0, toeCurl: 0,
    legFree: 0, legReach: 0, legUp: [0, 0], scratchW: [0, 0], scratchU: [0, 0],
    wingOpen: 0, wingElev: 0, wingElevS: [0, 0], wingAlpha: 0, wingPitch: 0, wingExtend: 0, wingFoldExtra: 0, wingDroop: 0,
    fanExtra: 0, flap: 0, flapAmp: 1,
    tailPitch: 0, tailYaw: 0, tailFan: 0,
    headW: 0, headPos: new THREE.Vector3(), headFwd: 0, headUp: 0, headSide: 0, neckReach: 0, neckExtend: 0,
    headYaw: 0, headPitch: 0, headRoll: 0, headLimp: 0, look: null, lookW: 1, cock: 0, jaw: 0,
    eyelid: 0, breathRate: 1, breathAmp: 1, busyGround: false,
  };
}

function resetParams(P) {
  P.gaitW = 1; P.legGait = 1; P.speedScale = 1; P.turnScale = 1; P.restep = 1; P.bodyOmega = 1; P.headOmega = 1; P.wingOmega = 1;
  P.drop = P.lift = P.pitch = P.roll = P.rollAxisK = P.side = P.fwd = P.chestPitch = P.groundW = P.sit = P.fluff = P.toeCurl = 0;
  P.legFree = P.legReach = 0; P.legUp[0] = P.legUp[1] = 0;
  P.scratchW[0] = P.scratchW[1] = 0; P.scratchU[0] = P.scratchU[1] = 0;
  P.wingOpen = P.wingElev = P.wingAlpha = P.wingPitch = P.wingExtend = P.wingFoldExtra = P.wingDroop = 0;
  P.wingElevS[0] = P.wingElevS[1] = 0;
  P.fanExtra = P.flap = 0; P.flapAmp = 1;
  P.tailPitch = P.tailYaw = P.tailFan = 0;
  P.headW = P.headFwd = P.headUp = P.headSide = P.neckReach = P.neckExtend = 0;
  P.headYaw = P.headPitch = P.headRoll = P.headLimp = 0; P.look = null; P.lookW = 1; P.cock = 0; P.jaw = 0;
  P.eyelid = 0; P.breathRate = 1; P.breathAmp = 1; P.busyGround = false;
}

const mx = (P, k, v, w) => { P[k] += (v - P[k]) * w; };
const pulse = (t, a, b, c) => smooth(a, b, t) * (1 - smooth(b, c, t));

// occiput position that puts the bill tip on a point with the head pitched by `pitch` (+ = bill down)
function billTo(e, point, pitch, yaw, out) {
  const q = tv(); void q;
  const bl = e.cfg.billLocal;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // bill vector in the heading frame, pitched about the lateral axis
  const y = bl.y * cp - bl.z * sp, z = bl.y * sp + bl.z * cp;
  const h = e.heading + yaw;
  return out.set(point.x - Math.sin(h) * z - Math.cos(h) * bl.x, point.y - y, point.z - Math.cos(h) * z + Math.sin(h) * bl.x);
}
// a ground point ahead of the feet (for pecking / drinking)
function groundAhead(e, k, out, water) {
  const cfg = e.cfg;
  out.copy(e.legs[0].plant).add(e.legs[1].plant).multiplyScalar(0.5).addScaledVector(e.F, k * cfg.legLen);
  let y = e.terrainH(out.x, out.z);
  if (water && e.water) { const w = e.water(out.x, out.z); if (Number.isFinite(w)) y = Math.max(y, w); }
  if (e.mode === 'perch' && e.perch) y = Math.min(e.perch.top + 0.02 * cfg.s, y + 1e9);
  out.y = y;
  return out;
}

// Peck fit: the carriage that lets the neck reach a peck (eat, drink, bill wipe, the pecks between
// scratches) at a comfortable stretch. Species tune a peck (reach ahead of the feet, bill pitch, body
// pitch, crouch) at their reference proportions; a neck short for its legs (a chick: 0.4 of the hen's)
// or a target out of reach (a hen raking 1.25 leg lengths ahead with a neck a quarter of that) pulled
// the neck straight - its bones stretched - with the bill still short of the ground. In order: the body
// tips forward (to 50 deg), crouches, the peck comes closer to the feet (to half the reach), and only
// then tips further (to 63 deg), until the occiput target (bill tip on the ground `reach` leg lengths
// ahead of the feet, head pitched `billPitch`, `hover` above it) lies within the neck's reach.
const _fit = { pitch: 0, drop: 0, reach: 0 };
function fitPeck(e, reach0, billPitch, pitch0, drop0, hover = 0, water = false) {
  const cfg = e.cfg;
  const maxD = 0.95 * Math.min(cfg.neckArc, cfg.neckChord0 * 1.08);
  const g0 = e.terrainH(e.pos.x, e.pos.z), sitH = e.sitHeight();
  const h = e.heading, sh = Math.sin(h), ch = Math.cos(h), nb = cfg.neckBaseLocal;
  const pt = tv(), hp = tv();
  const dist = (phi, drop, reach) => {
    groundAhead(e, reach, pt, water);
    billTo(e, pt, billPitch, 0, hp);
    const c = Math.cos(phi), sn = -Math.sin(phi); // (the body frame turns by -pitch about its lateral axis)
    const ly = nb.y * c - nb.z * sn, lz = nb.y * sn + nb.z * c;
    const y = g0 + cfg.pivotY - drop * (cfg.pivotY - sitH) + ly;
    return Math.hypot(hp.x - (e.pos.x + ch * nb.x + sh * lz), hp.y + hover - y, hp.z - (e.pos.z - sh * nb.x + ch * lz));
  };
  let phi = Math.min(pitch0, 0), drop = drop0, reach = reach0;
  for (let i = 0; i < 48 && dist(phi, drop, reach) > maxD; i++) {
    if (phi > -0.87) phi = Math.max(-0.87, phi - 0.06);
    else if (drop < 0.55) drop = Math.min(0.55, drop + 0.05);
    else if (reach > 0.5 * reach0) reach = Math.max(0.5 * reach0, reach - 0.05 * reach0);
    else if (phi > -1.1) phi = Math.max(-1.1, phi - 0.05);
    else break;
  }
  _fit.pitch = phi; _fit.drop = drop; _fit.reach = reach;
  return _fit;
}

// ------------------------------------------------------------------------------------------------
// Postures (value sets applied with the posture weight)
// ------------------------------------------------------------------------------------------------
const POSTURES = {
  // settled on the tarsi (resting, brooding): the body as upright as it stands, belly on the ground,
  // lightly fluffed, the head up and alert (it keeps looking about) - the three resting postures read
  // apart at a glance: sit upright and alert, lie flat and spread, sleep a fluffed ball with no neck
  sit: {
    fadeIn: 0.8, fadeOut: 0.6,
    apply(P, w, inst) {
      mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w); mx(P, 'restep', 0, w);
      mx(P, 'drop', 1, w); mx(P, 'sit', 1, smooth(0.1, 0.8, w)); mx(P, 'groundW', 1, w);
      mx(P, 'pitch', -0.08, w); mx(P, 'fluff', 0.4, w); mx(P, 'neckReach', -0.004, w); mx(P, 'headUp', 0.004, w);
      mx(P, 'tailPitch', 0.12, w); mx(P, 'breathRate', 0.8, w);
      void inst;
    },
  },
  // lying at rest, sunning: flat on the belly and level, leaning a little onto one side, both wings
  // drooped onto the ground and part spread, the tail fanned, feathers raised, the neck relaxed forward
  // and low, the head tilted, eyes half closed
  lie: {
    fadeIn: 1.1, fadeOut: 0.9,
    apply(P, w, inst, L) {
      const e = L.engine, cfg = e.cfg, s = cfg.s, side = inst.side;
      POSTURES.sit.apply(P, w, inst);
      const c = smooth(0.25, 1.5, inst.t) * w;
      mx(P, 'drop', 1.12, w); mx(P, 'pitch', -Math.max(0.3, cfg.tilt - 0.15), w); mx(P, 'roll', side * 0.2, c);
      mx(P, 'fluff', 0.75, c);
      // (actions.lie.wings: 0..1 scales the drooped, part-spread wings; 0 keeps them folded on the body)
      const ww = c * (inst.tune.wings ?? 1);
      mx(P, 'wingOpen', 0.35, ww); mx(P, 'wingElev', -20 * DEG, ww); mx(P, 'wingAlpha', 10 * DEG, ww);
      mx(P, 'tailFan', 0.55, c); mx(P, 'tailPitch', -0.05, c);
      mx(P, 'headUp', -0.14 * cfg.neckLen / s, c); mx(P, 'neckReach', 0.1 * cfg.neckLen / s, c); mx(P, 'headPitch', 0.15, c);
      mx(P, 'headRoll', side * 0.35, c); mx(P, 'eyelid', 0.45, c); mx(P, 'breathRate', 0.7, c);
    },
  },
  // asleep: fluffed into a ball, eyes closed, the head turned back with the bill in the scapulars
  // ('tuck') or drawn down into the shoulders with the bill in the breast feathers ('sink'). Ground
  // birds sit; upright birds (raptors: standing carriage >= 40 deg) sleep standing on one leg, the other
  // drawn up into the belly feathers, the body over the standing foot (actions.sleep.stance: 'sit' |
  // 'oneLeg')
  sleep: {
    fadeIn: 1.2, fadeOut: 1.0,
    apply(P, w, inst, L) {
      const e = L.engine, cfg = e.cfg, s = cfg.s, side = inst.side;
      const perched = e.mode === 'perch';
      const oneLeg = !perched && (inst.tune.stance ? inst.tune.stance === 'oneLeg' : cfg.tilt >= 40 * DEG);
      if (perched) { mx(P, 'drop', 0.45, w); mx(P, 'fluff', 0.6, w); mx(P, 'gaitW', 0, w); mx(P, 'restep', 0, w); }
      else if (!oneLeg) POSTURES.sit.apply(P, w, inst);
      else {
        mx(P, 'gaitW', 0, w); mx(P, 'legGait', 0, w); mx(P, 'restep', 0, w); mx(P, 'drop', 0.16, w);
        // (the leg comes up once the body is over the other foot)
        const k = smooth(0.4, 1.6, inst.t) * w, i = side > 0 ? 0 : 1;
        P.legUp[i] += (1 - P.legUp[i]) * smooth(0.5, 1, k);
        mx(P, 'side', -side * 0.8 * cfg.legs[0].cx / s, k);
      }
      const c = smooth(0.6, 2.2, inst.t) * w;
      mx(P, 'fluff', inst.tune.fluff ?? 1, c);
      if ((inst.tune.style || 'tuck') === 'tuck') {
        // head over the shoulder, bill into the back feathers
        const back = tv(side * 0.012 * cfg.s, cfg.headH - cfg.pivotY - 0.035 * cfg.s, -0.01 * cfg.s);
        const hp = e.B(back, tv());
        P.headPos.lerp(hp, c / Math.max(1e-3, P.headW + c)); mx(P, 'headW', 1, c);
        mx(P, 'headYaw', side * 2.3, c); mx(P, 'headPitch', 0.35, c); mx(P, 'headRoll', side * 0.3, c);
      } else {
        // head drawn down into the shoulders (the neck folded away in the fluffed plumage), the bill
        // resting in the breast feathers
        mx(P, 'headUp', -0.3 * cfg.neckLen / s, c); mx(P, 'neckReach', -0.2 * cfg.neckLen / s, c); mx(P, 'headPitch', 0.6, c);
        mx(P, 'headYaw', side * 0.2, c);
      }
      mx(P, 'lookW', 0, c); mx(P, 'eyelid', 1, smooth(1.2, 2.6, inst.t) * w);
      mx(P, 'breathRate', 0.5, c); mx(P, 'breathAmp', 1.6, c); mx(P, 'headOmega', 0.5, c);
    },
  },
  // collapse: legs buckle, falls on its side, wings splayed, toes clenched, head limp on the ground.
  // Killed in the air (or on a perch): a limp fall - wings half open, lifted and swept back by the
  // airflow, fluttering; head limp; legs trailing; the body tumbling nose-down and rolling from its
  // flight attitude - then the collapse on its own clock from the impact, eased over from the fall
  death: {
    fadeIn: 0.2, fadeOut: 1.4,
    apply(P, w, inst, L) {
      const side = inst.side, e = L.engine, cfg = e.cfg, s = cfg.s;
      const falling = !!(e.to && e.to.dead);
      // kA: weight of the falling pose (1 in the air, easing out over 0.35 s after the impact)
      let t = inst.t, kA = 0, kR = 0;
      if (inst.fell) {
        if (falling) { inst.tLand = undefined; kA = 1; kR = 1; t = 0; } else {
          if (inst.tLand === undefined) inst.tLand = inst.t;
          const tg = inst.t - inst.tLand;
          kA = 1 - smooth(0, 0.35, tg);
          // (the roll axis turns back to the body's own axis slowly: within the collapse's 0.35 s the
          // rolling body swung a wing lying on the ground up and back, the primaries jittered)
          kR = 1 - smooth(0, 1.2, tg);
          t = 0.22 + tg; // (the legs are already limp: the collapse starts at the fall onto the side)
        }
      }
      // the legs give and the body topples onto its side at once: the roll leads (from 0.1 s), the head
      // follows it down (it used to drop first, the body still upright: a nose-dive with the rump up);
      // the body ends level along the ground whatever its standing carriage (an eagle's upright body
      // pitched by a fixed 20 deg lay tail-up)
      // (killed on the move the topple waits up to 0.2 s longer, while the legs still stride: taken from
      // the speed at the death, so the timing cannot shift as the body brakes)
      if (inst.mv0 === undefined) inst.mv0 = e.mode === 'ground' && !inst.fell ? smooth(0.1, 0.5, e.speed / cfg.sq) : 0;
      const tD = 0.2 * inst.mv0;
      const buckle = smooth(0, 0.28, t);
      const fall = smooth(0.1 + tD, 0.7 + tD, t), fallE = fall;
      const settle = t > 0.7 + tD ? Math.exp(-(t - 0.7 - tD) * 6) * Math.sin((t - 0.7 - tD) * 16) * 0.05 : 0;
      const pitchD = -Math.max(0.3, cfg.tilt - 0.12);
      // killed on the move (walking, hopping, running): the legs keep stepping under the body while it
      // brakes and only then go limp; no crouch onto the tarsi over a swinging foot
      // (not a bird that fell dead from the air: it hits the ground limp and slides, legs free)
      const mv = e.mode === 'ground' && !inst.fell ? smooth(0.1, 0.5, e.speed / cfg.sq) * (1 - smooth(0.25, 0.6, t)) : 0;
      // (actions.death.wings 0..1 scales the splay of the wings on the ground, default 1; 0 leaves them
      // folded on the body)
      const wo = smooth(0.1, 0.7, t) * (inst.tune.wings ?? 1);
      // the ground pose, blended from the falling one (tf: time since the death)
      const tf = inst.t, A = kA;
      const aRoll = side * 0.5 * smooth(0, 1.2, tf), aPitch = -0.55 * smooth(0, 1.0, tf);
      // (in the air the body pose is relative to the attitude at the death, see bird.js fall())
      const pitch0 = e._fallPitch0 ?? 0, bank0 = e._fallBank0 ?? 0;
      const flutter = Math.sin(tf * 11 + side) * 0.5 + Math.sin(tf * 17.3) * 0.5;
      mx(P, 'gaitW', 0, w * (1 - mv)); mx(P, 'legGait', 0, w * (1 - mv)); mx(P, 'restep', 0, w); mx(P, 'bodyOmega', 1.4, w);
      mx(P, 'drop', lerp(lerp(0.6 * buckle * (1 - mv), 1.25, fallE), 0.6, A), w);
      mx(P, 'sit', buckle * (1 - fallE) * (1 - mv) * (1 - A), w);
      mx(P, 'roll', lerp(side * (1.42 * fallE - settle), falling ? aRoll : bank0 + aRoll, A), w);
      mx(P, 'pitch', lerp(pitchD * fallE, falling ? aPitch : pitch0 + aPitch, A), w);
      mx(P, 'rollAxisK', kR, w);
      mx(P, 'groundW', 1, w);
      mx(P, 'legFree', lerp(smooth(0.2, 0.85, t), smooth(0, 0.25, tf), A), w); mx(P, 'legReach', 0.15 * (1 - A), w);
      mx(P, 'toeCurl', lerp(85 * DEG * smooth(0.3, 1, t), 40 * DEG * smooth(0.2, 0.8, tf), A), w); // feet clenched
      // wings: the upper one half open, drooping over / behind the body; the lower one folded under
      // (falling: both half open, raised and swept back by the air, fluttering)
      mx(P, 'wingOpen', lerp(0.5 * wo, 0.62, A), w);
      // (fallen from the air the wings settle splayed on the ground - the lower one is not driven down
      // under the body as it lands on it: jammed against the ground at impact speed it was flung back up,
      // the primaries jittered)
      const eL0 = inst.fell ? -28 : -70;
      const eU = lerp(-35 * DEG * wo, (22 + 5 * flutter) * DEG, A), eL = lerp(eL0 * DEG * wo, (22 - 5 * flutter) * DEG, A);
      P.wingElevS[side > 0 ? 1 : 0] += (eU - P.wingElevS[side > 0 ? 1 : 0]) * w;
      P.wingElevS[side > 0 ? 0 : 1] += (eL - P.wingElevS[side > 0 ? 0 : 1]) * w;
      mx(P, 'wingAlpha', lerp(35 * DEG * wo, 24 * DEG, A), w);
      mx(P, 'fanExtra', 0.12 * A, w);
      mx(P, 'tailFan', lerp(0.35 * wo, 0.45, A), w); mx(P, 'tailPitch', 0.15 * A, w);
      // head and neck lie on the terrain, limp: where the resting head falls with the rolled body, well
      // forward of the breast (the neck lies along the ground instead of folding the head under the chest)
      const hp = e.B(cfg.occLocal, tv()).addScaledVector(e.F, cfg.neckLen * 0.42);
      const hg = e.terrainH(hp.x, hp.z) + Math.max(0.02 * s, 1.3 * cfg.headR);
      hp.y = Math.max(hg, lerp(hp.y, hg, 0.75));
      // (falling dead from the air the head is limp on the neck - the ground pose's head target, pulled
      // toward terrain far below, stretched the neck base - and goes to the ground after the impact)
      const dtt = Math.max(0, inst.t - (inst.tPrev ?? inst.t)); inst.tPrev = inst.t;
      if (inst.gw === undefined) inst.gw = falling || e.airborne ? 0 : 1;
      inst.gw += ((falling ? 0 : 1) - inst.gw) * (1 - Math.exp(-dtt / 0.15));
      const hw = smooth(0.3, 0.85, t) * inst.gw;
      P.headPos.lerp(hp, hw / Math.max(1e-3, P.headW + hw)); mx(P, 'headW', 1, hw * w);
      mx(P, 'headLimp', lerp(0.85 * hw, 0.9 * smooth(0, 0.3, tf), A), w); mx(P, 'headUp', -0.02 * A, w);
      mx(P, 'eyelid', 0.6, lerp(smooth(0.2, 1.2, t), smooth(0.05, 0.5, tf), A) * w);
      mx(P, 'breathAmp', 0, w); mx(P, 'breathRate', 0, w); mx(P, 'lookW', 0, w); mx(P, 'headOmega', 1.6, w);
    },
  },
  // gripping a perch (or the ground): a slight crouch, toes closed round the branch
  perch: {
    fadeIn: 0.5, fadeOut: 0.4,
    apply(P, w, inst, L) {
      const e = L.engine;
      if (inst.phase === 'fly') return;
      const k = e.mode === 'perch' ? 1 : 0.5;
      mx(P, 'drop', 0.18 * k, w); mx(P, 'restep', 0, w); mx(P, 'gaitW', 0.5, w);
      mx(P, 'toeCurl', e.mode === 'perch' ? 0 : 12 * DEG, w);
      mx(P, 'pitch', 0.06, w);
    },
  },
};

// ------------------------------------------------------------------------------------------------
// One-shot actions
// ------------------------------------------------------------------------------------------------
const ONESHOTS = {
  jump: {
    start(inst, L) {
      const e = L.engine, cfg = e.cfg, o = inst.tune;
      if (e.mode !== 'ground' && e.mode !== 'perch') { inst.dur = 0; return; }
      const h = (inst.opts.height ?? o.height ?? 0.35) * cfg.s;
      const vy = Math.sqrt(2 * 9.81 * 0.75 * h);
      const T = (2 * vy) / (9.81 * 0.75);
      let dist = (o.distance ?? 0.6) * cfg.s;
      if (inst.opts.target) { const t = inst.opts.target; dist = clamp(Math.hypot(t.x - e.pos.x, t.z - e.pos.z), 0.05, dist * 3); }
      e.startTakeoff({ hopOnly: true, vy, vh: Math.max(e.speed, dist / T), quick: true });
      inst.dur = Infinity; inst.phase = 'go';
    },
    update(inst, dt, L) {
      const e = L.engine;
      if (inst.phase === 'land' && inst.t - inst.tLand > 0.4) return true;
      if (inst.dur === 0) return true;
      if (inst.t > 5 && inst.phase !== 'land') return true;
      void e;
      return false;
    },
    onLand(inst) { if (inst.phase !== 'land') { inst.phase = 'land'; inst.tLand = inst.t; } },
    apply(P, w, inst, L) {
      const e = L.engine;
      const airUp = e.to && e.to.hopOnly && e.to.air;
      if (e.to && e.to.hopOnly && !e.to.air) {
        // crouch with wings lifting
        mx(P, 'wingOpen', 0.4, w); mx(P, 'wingElev', 25 * DEG, w); mx(P, 'tailFan', 0.3, w);
      } else if (airUp) {
        // beat on the way up, then hold the wings raised and open to brake the descent
        const up = smooth(-0.6, 0.4, e.vy);
        mx(P, 'wingOpen', 1, w); mx(P, 'flap', 1, w * up); mx(P, 'flapAmp', 0.9, w); mx(P, 'tailFan', 0.6, w);
        mx(P, 'wingElev', 35 * DEG, w * (1 - up));
      } else if (inst.phase === 'land') {
        // wings (raised and open at touchdown) fold over ~0.35 s
        const k = 1 - smooth(0, 1, (inst.t - inst.tLand) / 0.35);
        mx(P, 'wingOpen', 1, w * k); mx(P, 'wingElev', 35 * DEG, w * k); mx(P, 'tailFan', 0.6, w * k);
      }
    },
  },

  attack: {
    start(inst, L) {
      const e = L.engine, cfg = e.cfg;
      inst.style = inst.opts.style || inst.tune.style || 'peck';
      inst.target = inst.opts.target ? new THREE.Vector3(inst.opts.target.x, inst.opts.target.y, inst.opts.target.z) : null;
      inst.hit = false;
      if (e.airborne) inst.style = 'talons';
      else if (inst.target) {
        const d = Math.hypot(inst.target.x - e.pos.x, inst.target.z - e.pos.z);
        if (inst.style === 'peck' && d > 1.4 * cfg.legLen) inst.style = 'lunge';
      }
      if (inst.style === 'spur') {
        // face off (hackles up, head low) for a moment, then a flapping jump-kick
        inst.dur = 4; inst.hitAt = -1; inst.windup = 0.3 * cfg.sq;
        if (inst.target) e.input.heading = Math.atan2(inst.target.x - e.pos.x, inst.target.z - e.pos.z);
        return;
      }
      inst.dur = inst.style === 'peck' ? 0.75 : inst.style === 'talons' ? 0.9 : 1.4;
      inst.hitAt = inst.style === 'peck' ? 0.34 : inst.style === 'talons' ? 0.45 : -1;
      if (inst.style === 'lunge') {
        let dist = 0.8 * cfg.legLen * 2;
        if (inst.target) dist = clamp(Math.hypot(inst.target.x - e.pos.x, inst.target.z - e.pos.z) - 0.8 * cfg.legLen, 0.05, 4 * cfg.legLen);
        const vy = Math.sqrt(2 * 9.81 * 0.75 * 0.12 * cfg.s), T = 2 * vy / (9.81 * 0.75);
        if (inst.target) e.input.heading = Math.atan2(inst.target.x - e.pos.x, inst.target.z - e.pos.z);
        e.startTakeoff({ hopOnly: true, vy, vh: Math.max(e.speed, dist / T), quick: true });
        inst.jumped = true;
      }
    },
    update(inst, dt, L) {
      if (!inst.hit && inst.hitAt > 0 && inst.t >= inst.hitAt) this.strike(inst, L);
      if (inst.style === 'spur') {
        const e = L.engine, cfg = e.cfg;
        if (!inst.jumped && inst.t >= inst.windup) {
          inst.jumped = true;
          if (e.mode !== 'ground') return true;
          let dist = 0.9 * cfg.legLen;
          if (inst.target) dist = clamp(Math.hypot(inst.target.x - e.pos.x, inst.target.z - e.pos.z) - 0.9 * cfg.legLen, 0.03, 3 * cfg.legLen);
          const h = (inst.tune.height ?? 0.3) * cfg.s, vy = Math.sqrt(2 * 9.81 * 0.8 * h), T = 2 * vy / (9.81 * 0.7);
          e.startTakeoff({ hopOnly: true, vy, vh: Math.max(e.speed, dist / T), quick: true });
        }
        // the kick lands at the top of the jump
        if (inst.jumped && !inst.hit && e.to && e.to.hopOnly && e.to.air && e.vy <= 0.15) this.strike(inst, L);
        if (inst.landT !== undefined && inst.t - inst.landT > 0.5) return true;
        return inst.t > inst.dur;
      }
      if (inst.style === 'lunge') {
        if (inst.landT !== undefined && inst.t - inst.landT > 0.45) return true;
        return inst.t > 4;
      }
      return inst.t >= inst.dur;
    },
    onLand(inst, L) {
      if (inst.style === 'spur' && inst.jumped && inst.landT === undefined) { inst.landT = inst.t; return; }
      if (inst.style !== 'lunge' || inst.landT !== undefined) return;
      inst.landT = inst.t;
      inst.hitAt = inst.t + 0.12;
      void L;
    },
    strike(inst, L) {
      const e = L.engine;
      inst.hit = true;
      let p;
      if (inst.style === 'talons' || inst.style === 'spur') p = e.legs[0].mtp.clone().lerp(e.legs[1].mtp, 0.5);
      else p = new THREE.Vector3().copy(e.cfg.billLocal).applyQuaternion(e.headPose.quaternion).add(e.headPose.position);
      const dir = inst.target ? inst.target.clone().sub(e.headPose.position).setY(0).normalize() : e.forward(e.heading, new THREE.Vector3());
      e.emit('attackHit', { position: p, direction: dir, style: inst.style });
    },
    apply(P, w, inst, L) {
      const e = L.engine, cfg = e.cfg, t = inst.t, s = cfg.s;
      if (inst.target) { P.look = inst.target; mx(P, 'lookW', 1, w); }
      if (inst.style === 'peck') {
        const draw = pulse(t, 0.0, 0.2, 0.3), strike = pulse(t, 0.24, 0.34, 0.6);
        mx(P, 'headUp', 0.02, draw * w); mx(P, 'neckReach', -0.02, draw * w);
        mx(P, 'fwd', 0.035, strike * w); mx(P, 'pitch', -0.35, strike * w);
        mx(P, 'neckReach', 0.05, strike * w); mx(P, 'headUp', -0.035, strike * w); mx(P, 'headPitch', 0.55, strike * w);
        mx(P, 'jaw', 0.35, w * pulse(t, 0.18, 0.28, 0.36));
        mx(P, 'wingOpen', 0.35, w * pulse(t, 0.05, 0.3, 0.7)); mx(P, 'wingElev', 25 * DEG, w * pulse(t, 0.05, 0.3, 0.7));
        mx(P, 'tailFan', 0.6, w * pulse(t, 0.05, 0.3, 0.75)); mx(P, 'fluff', 0.5, w * pulse(t, 0, 0.2, 0.7));
        mx(P, 'headOmega', 1.6, w);
        void s;
      } else if (inst.style === 'lunge') {
        const air = e.to && e.to.hopOnly;
        const k = air ? 1 : inst.landT !== undefined ? 1 - smooth(0, 0.45, t - inst.landT) : smooth(0, 0.1, t);
        // (wings raised: the open wing tips stay clear of the ground through the landing crouch)
        mx(P, 'wingOpen', 1, k * w); mx(P, 'wingElev', 30 * DEG, k * w); mx(P, 'flap', air ? 1 : 0, w); mx(P, 'tailFan', 0.8, k * w);
        mx(P, 'neckReach', 0.04, k * w); mx(P, 'headPitch', 0.35, k * w);
        if (inst.landT !== undefined) mx(P, 'headPitch', 0.6, pulse(t - inst.landT, 0, 0.12, 0.3) * w);
        mx(P, 'jaw', 0.3, w * (inst.landT !== undefined ? pulse(t - inst.landT, 0, 0.08, 0.2) : 0));
      } else if (inst.style === 'spur') {
        const air = e.to && e.to.hopOnly;
        const wind = inst.jumped ? 1 : smooth(0, inst.windup, t);
        const fold = inst.landT !== undefined ? 1 - smooth(0, 0.45, t - inst.landT) : 1;
        // face-off: hackles and body feathers raised, head low and forward, wings slightly out
        mx(P, 'fluff', 1, w * fold); mx(P, 'headUp', -0.03, w * wind * (air ? 0.3 : 1) * fold); mx(P, 'neckReach', 0.02, w * wind * fold);
        mx(P, 'headPitch', 0.25, w * fold); mx(P, 'tailFan', 0.7, w * fold);
        mx(P, 'wingOpen', air ? 1 : 0.25 + 0.75 * (inst.landT !== undefined ? fold : 0), w);
        mx(P, 'wingElev', 30 * DEG, w * (air ? 1 : fold * (inst.landT !== undefined ? 1 : 0)));
        mx(P, 'flap', air ? 1 : 0, w); mx(P, 'flapAmp', 0.95, w);
        if (air) {
          // both feet thrown forward and up, toes open, chest back, until just after the top
          const kick = smooth(0.02, 0.12, e.to.tAir || 0) * (1 - smooth(-0.2, -0.9, e.vy));
          mx(P, 'legFree', 1, w * kick); mx(P, 'legReach', 1, w * kick); mx(P, 'toeCurl', -30 * DEG, w * kick);
          mx(P, 'pitch', 0.45, w * kick);
        }
        void s;
      } else {
        // talons: feet thrown forward and down, head up
        const k = pulse(t, 0.05, 0.4, 0.85);
        mx(P, 'legFree', 1, k * w); mx(P, 'legReach', 1, k * w); mx(P, 'toeCurl', -25 * DEG, k * w);
        mx(P, 'tailFan', 0.8, k * w); mx(P, 'pitch', 0.5, k * w);
        if (inst.tune.mantle && !e.airborne) {
          // raptor strike on the ground: wings thrown open and forward (balance), then mantled over
          // the prey (drooped and spread forward), head low over the feet
          const m = inst.tune.mantle, open = smooth(0.0, 0.25, t) * w, hold = smooth(0.45, 0.8, t) * w;
          mx(P, 'wingOpen', 0.95 * m, open); mx(P, 'wingElev', 22 * DEG, open * (1 - hold)); mx(P, 'wingAlpha', -18 * DEG * m, open);
          mx(P, 'wingDroop', 0.45 * m, hold); mx(P, 'headUp', -0.03, hold); mx(P, 'neckReach', 0.02, hold); mx(P, 'headPitch', 0.5, hold);
          mx(P, 'fluff', 0.6, open); mx(P, 'jaw', 0.25, open * (1 - hold));
        }
      }
    },
  },

  hit: {
    start(inst, L) {
      const e = L.engine;
      const d = inst.opts.direction ? new THREE.Vector3(inst.opts.direction.x, 0, inst.opts.direction.z) : e.forward(e.heading, new THREE.Vector3()).negate();
      if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
      d.normalize();
      inst.dur = 0.8;
      inst.lx = d.dot(e.left(e.heading, new THREE.Vector3()));
      inst.lz = d.dot(e.forward(e.heading, new THREE.Vector3()));
      e.push.addScaledVector(d, 0.9 * e.cfg.sq * (inst.opts.strength ?? 1));
    },
    update(inst) { return inst.t >= inst.dur; },
    apply(P, w, inst) {
      const t = inst.t;
      const k = pulse(t, 0, 0.08, 0.6) * w;
      mx(P, 'roll', -inst.lx * 0.3, k); mx(P, 'pitch', inst.lz * 0.2, k);
      mx(P, 'fluff', 1, k); mx(P, 'wingOpen', 0.55, k); mx(P, 'wingElev', 35 * DEG, k); mx(P, 'flap', 0.6, pulse(t, 0.05, 0.15, 0.45) * w);
      mx(P, 'tailFan', 0.8, k); mx(P, 'headSide', inst.lx * 0.02, k); mx(P, 'headUp', 0.015, k);
      mx(P, 'headYaw', -inst.lx * 0.5, k); mx(P, 'eyelid', 0.5, pulse(t, 0, 0.05, 0.25) * w); mx(P, 'jaw', 0.25, k);
    },
  },

  eat: {
    tear(P, w, inst, L) {
      // (eat style 'tear'): raptors pin the food under the feet and tear it with the bill: the bill
      // grips between the feet, the head pulls up and back, the wings mantle (spread and drooped
      // forward over the food), the tail fans; short looks around between bites
      const e = L.engine, s = e.cfg.s;
      const rate = inst.tune.rate ?? 0.8;
      const burst = Math.sin(inst.t * 0.45) > -0.7 ? 1 : 0;
      const c = (inst.t * rate) % 1;
      // grip (0 .. 0.35), pull up and back (0.35 .. 0.7), swallow / hold (0.7 .. 1)
      const down = burst * smooth(0.0, 0.3, c) * (1 - smooth(0.4, 0.75, c));
      const pull = burst * smooth(0.35, 0.6, c) * (1 - smooth(0.75, 1.0, c));
      // (the food lies just ahead of the breast: an upright raptor leans well forward over it)
      const pt = groundAhead(e, inst.tune.reach ?? 0.95, tv(), false);
      const hp = billTo(e, pt, 1.2, 0, tv());
      hp.y += (1 - down) * 0.07 * s + pull * 0.03 * s;
      hp.addScaledVector(e.F, -pull * 0.03 * s);
      P.headPos.copy(hp);
      mx(P, 'headW', 1, w); mx(P, 'headPitch', 1.25 - 0.45 * pull, w); mx(P, 'lookW', 0, w); mx(P, 'headOmega', 1.2, w);
      mx(P, 'pitch', -0.72, w); mx(P, 'drop', 0.1, w); mx(P, 'gaitW', 0.3, w); mx(P, 'speedScale', 0, w); mx(P, 'restep', 0, w);
      mx(P, 'jaw', 0.22, w * smooth(0.1, 0.3, c) * (1 - smooth(0.33, 0.4, c)) * burst);
      // mantle
      const mw = w * (inst.tune.mantle ?? 1);
      mx(P, 'wingOpen', 0.9, mw); mx(P, 'wingDroop', 1.4, mw); mx(P, 'wingAlpha', -20 * DEG, mw); mx(P, 'wingElev', -4 * DEG, mw);
      mx(P, 'tailFan', 0.5, mw); mx(P, 'tailPitch', 0.1, w); mx(P, 'fluff', 0.35, w);
      P.busyGround = true;
    },
    start(inst) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 6); inst.fade = 0.35; },
    update(inst) { return inst.t >= inst.dur; },
    apply(P, w, inst, L) {
      if (inst.tune.style === 'scratch') { scratchFeed(P, w, inst, L); return; }
      const e = L.engine, cfg = e.cfg, s = cfg.s;
      if (inst.tune.style === 'tear') { this.tear(P, w, inst, L); return; }
      const rate = inst.tune.rate ?? 2.4;
      // bursts of pecks separated by short looks around
      const burst = Math.sin(inst.t * 0.9) > -0.55 ? 1 : 0;
      const c = (inst.t * rate) % 1;
      const strike = burst * (smooth(0.3, 0.5, c) * (1 - smooth(0.55, 0.85, c)));
      // (a peck strikes with a steep bill: at least 0.95 rad down - a flatter one put the head on the
      // ground with the neck folded over it)
      const pitch = Math.max(0.95, inst.tune.billPitch ?? 1.05);
      const fit = fitPeck(e, inst.tune.reach ?? 1.12, pitch, inst.tune.bodyPitch ?? -0.45, inst.tune.drop ?? 0.32);
      const pt = groundAhead(e, fit.reach * (1 + 0.05 * Math.sin(Math.floor(inst.t * rate) * 2.3)), tv(), false);
      pt.addScaledVector(e.Lf, 0.02 * s * Math.sin(Math.floor(inst.t * rate) * 1.7));
      const hp = billTo(e, pt, pitch, 0, tv());
      hp.y += (1 - strike) * 0.035 * s;
      P.headPos.copy(hp);
      mx(P, 'headW', 1, w); mx(P, 'headPitch', pitch, w); mx(P, 'lookW', 0, w); mx(P, 'headOmega', 2.6, w);
      // body tipped forward moderately (detail_feeding: near horizontal), the neck reaches down
      mx(P, 'pitch', fit.pitch, w); mx(P, 'drop', fit.drop, w); mx(P, 'gaitW', 0.3, w); mx(P, 'speedScale', 0, w); mx(P, 'restep', 0, w);
      mx(P, 'jaw', 0.18, w * smooth(0.25, 0.42, c) * (1 - smooth(0.45, 0.6, c)) * burst);
      mx(P, 'tailPitch', -0.35, w); // counter-pitched: the tail stays near level
      P.busyGround = true;
    },
  },

  drink: {
    start(inst) { inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 5.4); inst.fade = 0.4; },
    update(inst) { return inst.t >= inst.dur; },
    apply(P, w, inst, L) {
      const e = L.engine, s = e.cfg.s;
      // dip the bill (0 .. 0.45 of a cycle), then lift the head and tilt it back to swallow
      const T = 1.8, c = (inst.t % T) / T;
      const dip = smooth(0.0, 0.18, c) * (1 - smooth(0.42, 0.58, c));
      const tilt = smooth(0.52, 0.66, c) * (1 - smooth(0.9, 1.0, c));
      const et = L.tuning.eat || {};
      const bp = et.billPitch !== undefined ? et.billPitch + 0.15 : 1.15;
      const fit = fitPeck(e, et.reach ?? 1.12, bp, et.bodyPitch ?? -0.45, et.drop ?? 0.3, 0, true);
      const pt = groundAhead(e, fit.reach, tv(), true);
      const hp = billTo(e, pt, bp, 0, tv());
      hp.y += 0.004 * s;
      P.headPos.copy(hp);
      mx(P, 'headW', 1, w * dip); mx(P, 'headPitch', bp, w * dip);
      mx(P, 'pitch', fit.pitch, w * Math.max(dip, 0.3)); mx(P, 'drop', fit.drop, w); mx(P, 'tailPitch', -0.3, w * Math.max(dip, 0.3));
      mx(P, 'headPitch', -0.75, w * tilt); mx(P, 'headUp', 0.02, w * tilt); mx(P, 'neckReach', -0.01, w * tilt);
      mx(P, 'jaw', 0.08, w * tilt);
      mx(P, 'lookW', 0, w); mx(P, 'headOmega', 1.8, w); mx(P, 'gaitW', 0.3, w); mx(P, 'speedScale', 0, w); mx(P, 'restep', 0, w);
      P.busyGround = true;
    },
  },

  takeoff: {
    start(inst, L) {
      const e = L.engine;
      inst.dur = Infinity;
      if (e.airborne) { inst.done = true; return; }
      e.startTakeoff({});
      L.loiter = true;
    },
    update(inst, dt, L) { return inst.done || L.engine.mode === 'air' || inst.t > 6; },
    apply(P, w) { void P; void w; },
  },

  land: {
    start(inst, L) {
      const e = L.engine;
      inst.dur = Infinity;
      L.loiter = false;
      if (e.mode === 'takeoff' && !e.to.air) { e.mode = 'ground'; e.to = null; inst.done = true; return; }
      if (!e.airborne && e.mode !== 'takeoff') { inst.done = true; return; }
      if (e.mode === 'takeoff' && e.to && e.to.hopOnly) { inst.done = false; return; }
      e.startLanding(inst.opts.target || null, 'land');
    },
    update(inst, dt, L) { return inst.done || (!L.engine.airborne && L.engine.mode !== 'takeoff') || inst.t > 30; },
    onLand(inst) { inst.done = true; },
    apply() {},
  },

  glide: {
    start(inst, L) {
      const e = L.engine;
      inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? 3);
      if (e.mode === 'ground' || e.mode === 'perch') { e.startTakeoff({}); L.loiter = true; inst.wait = true; }
    },
    update(inst, dt, L) {
      const e = L.engine;
      if (inst.wait) { if (e.mode === 'air') { inst.wait = false; inst.t0 = inst.t; } else if (inst.t > 6) return true; return false; }
      e.fl.forceGlide = 1;
      if (inst.t - (inst.t0 || 0) >= inst.dur || !e.airborne) { e.fl.forceGlide = 0; return true; }
      return false;
    },
    end(inst, L) { L.engine.fl.forceGlide = 0; },
    apply() {},
  },

  flap: {
    start(inst, L) {
      const e = L.engine;
      inst.air = e.airborne;
      inst.dur = inst.opts.loop ? Infinity : (inst.opts.duration ?? (inst.air ? 1.6 : 1.3));
    },
    update(inst, dt, L) {
      const e = L.engine;
      if (inst.air) { e.fl.forceFlap = 1; if (inst.t >= inst.dur || !e.airborne) { e.fl.forceFlap = 0; return true; } return false; }
      return inst.t >= inst.dur;
    },
    end(inst, L) { L.engine.fl.forceFlap = 0; },
    apply(P, w, inst, L) {
      if (inst.air) return;
      // wing display on the ground: open, raise and beat (drying, threat, stretching the wings)
      const k = smooth(0, 0.2, inst.t) * (1 - smooth(inst.dur - 0.3, inst.dur, inst.t)) * w;
      mx(P, 'wingOpen', 1, k); mx(P, 'flap', 1, k); mx(P, 'flapAmp', 0.8, k); mx(P, 'wingElev', 15 * DEG, k);
      mx(P, 'tailFan', 0.5, k); mx(P, 'pitch', 0.15, k); mx(P, 'fluff', 0.3, k); P.busyGround = true;
      void L;
    },
  },
};

// Scratch feeding (fowl): per cycle two rakes of one foot and one or two of the other (each foot
// reaches forward, rakes back along the ground and returns to its print), the head low watching the
// spot; then the bird leans back a little and pecks 1-3 times at the cleared ground and looks up.
// Everything is a smooth function of the cycle time, so the feet and head move without steps.
const RAKE = 0.34;
function scratchFeed(P, w, inst, L) {
  const e = L.engine, cfg = e.cfg, s = cfg.s, sq = cfg.sq;
  const C = 3.8 * sq; // cycle length
  const n = Math.floor(inst.t / C), tc = inst.t - n * C;
  const h = (k) => { const x = Math.sin((n + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const lead = h(1) < 0.5 ? 0 : 1; // which foot scratches first this cycle
  const rakes = [[0.3, lead], [0.3 + RAKE, lead], [0.3 + 2 * RAKE + 0.06, 1 - lead]];
  if (h(2) < 0.6) rakes.push([0.3 + 3 * RAKE + 0.06, 1 - lead]);
  const rs = sq; // durations scale with sqrt(size)
  const on = smooth(0, 0.15, inst.t); // (the first cycle eases in)
  for (const [t0, leg] of rakes) {
    const u = (tc - t0 * rs) / (RAKE * rs);
    if (u <= 0 || u >= 1) continue;
    P.scratchW[leg] = w * on; P.scratchU[leg] = u;
  }
  // weight over the standing foot, shifting across as the other foot takes over (continuous)
  const shiftEnv = smooth(0.15 * rs, 0.3 * rs, tc) * (1 - smooth((0.3 + rakes.length * RAKE) * rs, (0.5 + rakes.length * RAKE) * rs, tc));
  const swap = smooth((0.3 + 2 * RAKE - 0.05) * rs, (0.3 + 2 * RAKE + 0.11) * rs, tc);
  const sideT = lerp(lead === 0 ? -1 : 1, lead === 0 ? 1 : -1, swap);
  mx(P, 'side', 0.01 * sideT * shiftEnv, w * on);
  // pecking phase after the rakes
  const tp0 = (0.5 + rakes.length * RAKE) * rs, nPeck = 1 + Math.floor(h(3) * 3), pr = 0.36 * rs;
  const peckW = smooth(tp0 - 0.2 * rs, tp0 + 0.05 * rs, tc) * (1 - smooth(tp0 + nPeck * pr, tp0 + nPeck * pr + 0.35 * rs, tc));
  const pc = clamp((tc - tp0) / pr, 0, nPeck);
  const cph = pc - Math.floor(pc);
  const strike = pc < nPeck ? smooth(0.25, 0.5, cph) * (1 - smooth(0.55, 0.9, cph)) : 0;
  // head: low over the scratched spot, striking during the pecks
  // (the pecks reach the ground: the body tips and crouches and the pecks come in as far as the neck
  // needs, see fitPeck; the head hovers over the same spot while the feet rake)
  const fit = fitPeck(e, 1.25, 1.05, -0.8, 0.22);
  const pP = fit.pitch, dP = fit.drop, rP = fit.reach;
  const fitR = fitPeck(e, rP, 0.8, -0.3, 0.14, 0.075 * s); // (raking: the head hovers over the spot)
  const pR = fitR.pitch, dR = fitR.drop, rR = fitR.reach;
  const pt = groundAhead(e, lerp(rR, rP, peckW) * (1 + 0.04 * Math.sin(n * 2.1)), tv(), false);
  pt.addScaledVector(e.Lf, 0.012 * s * Math.sin(n * 1.7 + Math.floor(pc) * 2.3));
  const look = smooth(0, 0.3 * rs, tc) * (1 - smooth(C - 0.45 * rs, C, tc)); // looks up between cycles
  const pitch = lerp(0.8, 1.05, peckW);
  const hp = billTo(e, pt, pitch, 0, tv());
  hp.y += (lerp(0.075, 0.034, peckW) * (1 - strike * peckW)) * s;
  P.headPos.copy(hp);
  const hw = w * lerp(0.35, 1, look) * on;
  mx(P, 'headW', 1, hw); mx(P, 'headPitch', pitch, hw); mx(P, 'lookW', 0, w * look); mx(P, 'headOmega', lerp(1.6, 2.6, peckW), w);
  mx(P, 'pitch', lerp(pR, pP, peckW) * lerp(0.4, 1, look), w * on); mx(P, 'drop', lerp(dR, dP, peckW), w * on);
  mx(P, 'fwd', -0.012 * peckW, w * on);
  mx(P, 'gaitW', 0.3, w); mx(P, 'speedScale', 0, w); mx(P, 'restep', 0, w);
  mx(P, 'jaw', 0.18, w * strike * peckW);
  mx(P, 'tailPitch', 0.12, w);
  P.busyGround = true;
}

function compact(arr, keep) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i];
  arr.length = j;
}
const keepPosture = (p) => p.target > 0 || p.w > 0;
const keepOneshot = (a) => !(a.stopping && a.w <= 0);
const isHolding = (p) => (p.target > 0 || p.w > 0.02) && p.name !== 'perch';
const isRunning = (a) => !a.stopping;
const isTargeted = (p) => p.target > 0;
const isBusy = (a) => !a.stopping && a.name !== 'hit';
const isDead = (p) => p.name === 'death' && p.target > 0;
// flight commands: locomotion, not body actions (see the arbitration rule above)
const FLIGHT = new Set(['takeoff', 'land', 'glide', 'flap']);
const GROUND_ONLY = new Set(['eat', 'drink', 'jump']);

// idle behaviours: [name, weight, duration]
const IDLE = [['preen', 0.2, 2.2], ['wingFlick', 0.18, 0.35], ['tailFlick', 0.14, 0.4], ['shake', 0.1, 0.8], ['cock', 0.25, 1.6], ['stretch', 0.06, 1.8], ['bill', 0.07, 1.2]];
// species extras (species.motion.actions.idle = { name: weight }): durations
const IDLE_EXTRA = { crow: 3.4 };

// ------------------------------------------------------------------------------------------------
export class BirdActions {
  constructor(engine) {
    this.engine = engine;
    this.P = createBirdParams();
    this.tuning = engine.cfg.actions || {};
    this.names = ['idle', 'jump', 'sit', 'lie', 'sleep', 'eat', 'drink', 'attack', 'hit', 'death', 'stand', 'takeoff', 'land', 'perch', 'glide', 'flap'];
    this.postures = [];
    this.oneshots = [];
    this.posture = 'stand';
    this.standReq = null;
    this.loiter = false;
    this.idle = { t: 0, lookT: 0, look: new THREE.Vector3(), hasLook: false, beh: null, behT: 0, behDur: 0, nextT: 3, side: 1, cock: 0, shiftPh: 0, want: null, flag: 0 };
    this.idleList = IDLE.slice();
    for (const [name, wgt] of Object.entries(this.tuning.idle || {})) if (IDLE_EXTRA[name] && wgt > 0) this.idleList.push([name, wgt, IDLE_EXTRA[name]]);
  }

  holdsStill() { return this.postures.some(isHolding); }
  keepsFlying() {
    const e = this.engine;
    if (this.loiter && (e.input.speed || 0) < 0.05) return true;
    return this.oneshots.some((a) => !a.stopping && (a.name === 'glide' || a.name === 'flap' || a.name === 'land' || a.name === 'attack')) || this.postures.some((p) => p.name === 'perch' && p.phase === 'fly');
  }
  dead() { return this.postures.some(isDead); }
  // automatic stand-up (the bird is asked to move): never revives a dead bird
  requestStand() { if (!this.standReq && !this.dead()) this.play('stand'); }
  // a hop under way (jump, lunge, spur kick: the engine is in a hop take-off): cannot be cut
  committed(a) {
    const e = this.engine;
    return !a.stopping && (a.name === 'jump' || a.name === 'attack') && e.mode === 'takeoff' && !!e.to && !!e.to.hopOnly;
  }
  end(a, reason) {
    if (a.stopping) return;
    a.stopping = true; a.reason = reason;
    ONESHOTS[a.name].end?.(a, this);
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
    if (name === 'idle') {
      // an idle behaviour on request (e.g. a rooster's crow), played as soon as the bird stands idle
      const b = opts.behaviour && this.idleList.find((x) => x[0] === opts.behaviour);
      if (b) { this.idle.want = b; if (!this.postures.length) return Promise.resolve(); }
      name = 'stand';
    }
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
    if (POSTURES[name]) return this.playPosture(name, opts);
    const def = ONESHOTS[name];
    if (!def) return Promise.reject(new Error(`procedural-animals: unknown action "${name}"`));
    if (this.dead() && name !== 'hit') return Promise.resolve('refused');
    if (this.holdsStill() && (name === 'jump' || name === 'attack' || name === 'takeoff' || name === 'glide')) {
      return this.play('stand').then((r) => (r === 'refused' ? r : this.play(name, opts)));
    }
    if (GROUND_ONLY.has(name) && (e.airborne || e.mode === 'takeoff')) return Promise.resolve('refused');
    if (FLIGHT.has(name)) {
      // flight commands replace their own kind only (glide <-> flap)
      for (const a of this.oneshots) if (a.name === name || ((name === 'glide' || name === 'flap') && (a.name === 'glide' || a.name === 'flap'))) this.end(a, 'interrupted');
    } else if (this.oneshots.some((a) => this.committed(a))) {
      if (name !== 'hit') return Promise.resolve('refused');
      for (const a of this.oneshots) if (a.name === 'hit') this.end(a, 'interrupted');
    } else {
      for (const a of this.oneshots) if (!FLIGHT.has(a.name)) this.end(a, 'interrupted');
    }
    const inst = { name, t: 0, w: 0, dur: 1, stopping: false, opts, tune: this.tuning[name] || {}, fade: 0.14, speed: opts.speed || 1 };
    def.start(inst, this);
    inst.promise = new Promise((r) => { inst.resolve = r; });
    this.oneshots.push(inst);
    e.emit('actionStart', { name });
    return inst.promise;
  }

  playPosture(name, opts) {
    const e = this.engine;
    const cur = this.postures.find((p) => p.target > 0);
    if (cur && cur.name === 'death' && name !== 'death') return Promise.resolve('refused');
    if (cur && cur.name === name && name !== 'perch') return cur.promiseIn;
    if (name !== 'death' && this.oneshots.some((a) => this.committed(a))) return Promise.resolve('refused');
    for (const p of this.postures) { if (p.target > 0) { p.target = 0; p.resolveIn?.('interrupted'); } }
    if (this.standReq) { this.standReq.resolve('interrupted'); this.standReq = null; }
    for (const a of this.oneshots) if (a.name !== 'hit' && (name === 'death' || !FLIGHT.has(a.name))) this.end(a, 'interrupted');
    const def = POSTURES[name];
    let side = opts.side ?? (e.rand() < 0.5 ? -1 : 1);
    if (opts.direction && name === 'death') side = (opts.direction.x * Math.cos(e.heading) - opts.direction.z * Math.sin(e.heading)) > 0 ? -1 : 1;
    const prev = this.postures.find((p) => p.name === 'lie' || p.name === 'sit' || p.name === 'sleep');
    if (prev && opts.side === undefined) side = prev.side;
    const inst = { name, t: 0, w: 0, target: 1, fadeIn: def.fadeIn, fadeOut: def.fadeOut, side, opts, tune: this.tuning[name] || {}, reached: false, phase: 'hold' };
    if (prev && name === 'sleep') { inst.w = prev.w; prev.w = 0; prev.target = 0; this.postures = this.postures.filter((p) => p !== prev); }
    inst.promiseIn = new Promise((r) => { inst.resolveIn = r; });
    this.postures.push(inst);
    e.emit('actionStart', { name });
    if (name === 'death') {
      e.emit('death', { position: e.pos.clone() });
      // dead in the air or on a perch: falls limp (no lift) and collapses where it hits the ground
      if (e.airborne || e.mode === 'perch' || (e.mode === 'takeoff' && e.to && e.to.air)) { e.fall(); inst.fell = true; }
    }
    if (name === 'perch') this.startPerch(inst);
    return inst.promiseIn;
  }

  // perch: fly to the target (given, or the nearest known perch) and land gripping it
  startPerch(inst) {
    const e = this.engine, cfg = e.cfg;
    let target = inst.opts.target || inst.opts.position || null;
    if (!target && e.perches.length) {
      let bd = Infinity;
      for (const p of e.perches) { const d = p.distanceToSquared(e.pos); if (d < bd) { bd = d; target = p; } }
    }
    if (!target) { inst.phase = 'hold'; return; }
    const perch = e.makePerch(target, inst.opts);
    if (e.mode === 'perch' && e.perch && e.perch.point.distanceTo(perch.point) < 0.05 * cfg.s + 0.02) { inst.phase = 'hold'; return; }
    inst.phase = 'fly';
    inst.perch = perch;
    if (e.airborne) e.startLanding(perch.point, 'perch', perch);
    else e.startTakeoff({ then: { perch } });
  }

  stop(name) {
    for (const a of this.oneshots) if ((!name || a.name === name) && !this.committed(a)) this.end(a, 'stopped');
    if (!name || POSTURES[name]) {
      if (this.postures.some((p) => p.target > 0 && (name ? p.name === name : p.name !== 'death'))) this.play('stand');
    }
  }

  onLand(perch) {
    for (const a of this.oneshots) if (ONESHOTS[a.name].onLand) ONESHOTS[a.name].onLand(a, this);
    for (const p of this.postures) if (p.name === 'perch' && p.phase === 'fly') { p.phase = 'hold'; p.t = 0; p.w = Math.min(p.w, 0.2); }
    if (perch) this.loiter = false;
  }
  onAirborne() {
    const e = this.engine;
    // a pending perch flight continues as a landing on the perch
    for (const p of this.postures) if (p.name === 'perch' && p.phase === 'fly' && p.perch) { e.startLanding(p.perch.point, 'perch', p.perch); return; }
  }

  update(dt) {
    const e = this.engine, P = this.P;
    resetParams(P);
    for (const p of this.postures) {
      p.t += dt;
      const rate = p.target > p.w ? 1 / p.fadeIn : 1 / p.fadeOut;
      const tgt = p.phase === 'fly' ? 0 : p.target;
      p.w = clamp(p.w + clamp(tgt - p.w, -rate * dt, rate * dt), 0, 1);
      if (!p.reached && p.target > 0 && p.phase !== 'fly' && p.w >= 1 && (p.name !== 'death' || (p.t > 1.4 && !e.airborne && e.mode !== 'takeoff')) && (p.name !== 'sleep' || p.t > 2.6)) { p.reached = true; p.resolveIn('done'); e.emit('actionEnd', { name: p.name }); }
      // a perch flight that never lands (e.g. interrupted) gives up
      if (p.name === 'perch' && p.phase === 'fly' && p.t > 40) { p.phase = 'hold'; }
    }
    compact(this.postures, keepPosture);
    const active = this.postures.find(isTargeted);
    this.posture = active ? (active.name === 'death' ? 'dead' : active.name) : this.postures.some((p) => p.w > 0.02) ? 'standing-up' : 'stand';
    if (this.standReq && !this.postures.some((p) => p.w > 0.02 && p.name !== 'perch')) { this.standReq.resolve('done'); this.standReq = null; e.emit('actionEnd', { name: 'stand' }); }
    if (this.standReq) for (const p of this.postures) if (p.name === 'perch' && p.target <= 0) p.w = 0;
    // loiter ends once the game steers the bird itself
    if (this.loiter && (e.input.speed || 0) > 0.05) this.loiter = false;

    // idle
    const still = (e.mode === 'ground' || e.mode === 'perch') && e.speed < 0.05 * e.cfg.sq && !e.input.follow;
    const idleTarget = still && !this.postures.some((p) => p.w > 0.02 && p.name !== 'perch') && !this.oneshots.some(isBusy) ? 1 : 0;
    const id = this.idle;
    id.w = clamp((id.w ?? 0) + clamp(idleTarget - (id.w ?? 0), -dt * 2, dt * 0.8), 0, 1);
    this.applyIdle(P, id.w, dt);

    for (const p of this.postures) {
      const w = p.w * p.w * (3 - 2 * p.w);
      POSTURES[p.name].apply(P, w, p, this);
    }
    const wantsToMove = e.wantSpeed > 0.05 || !!e.input.follow;
    for (const a of this.oneshots) {
      if (wantsToMove && (a.name === 'eat' || a.name === 'drink')) this.end(a, 'interrupted');
      a.t += dt * a.speed;
      const def = ONESHOTS[a.name];
      if (!a.stopping && def.update(a, dt * a.speed, this)) this.end(a, 'done');
      if (a.stopping) a.w = Math.max(0, a.w - dt / (a.fade || 0.14));
      else a.w = Math.min(1, a.w + dt / (a.fade || 0.14));
      const w = a.w * a.w * (3 - 2 * a.w);
      if (w > 0) def.apply(P, w, a, this);
    }
    for (const a of this.oneshots) if (a.stopping && a.w <= 0) { a.resolve(a.reason || 'done'); e.emit('actionEnd', { name: a.name, reason: a.reason || 'done' }); }
    compact(this.oneshots, keepOneshot);
  }

  applyIdle(P, w, dt) {
    const e = this.engine, id = this.idle, cfg = e.cfg, s = cfg.s;
    if (w <= 0.001) { id.hasLook = false; id.beh = null; return; }
    id.t += dt;
    // weight shift
    id.shiftPh += dt * 0.21;
    const sh = Math.sin(id.shiftPh * 6.283) * 0.6 + Math.sin(id.shiftPh * 6.283 * 0.41 + 1.3) * 0.4;
    mx(P, 'side', 0.004 * sh, w); mx(P, 'roll', -0.03 * sh, w);
    // look around: saccades to random points, sometimes cocking the head to look with one eye
    if (!e.input.look) {
      id.lookT -= dt;
      if (id.lookT <= 0) {
        id.lookT = 0.5 + e.rand() * 1.8;
        if (e.rand() < 0.2) id.hasLook = false;
        else {
          const a = e.heading + (e.rand() - 0.5) * 3.4;
          const d = (1.5 + e.rand() * 8) * cfg.legLen * 4;
          const up = e.rand() < 0.2 ? (1 + e.rand() * 6) : (e.rand() - 0.3) * 0.4;
          id.look.set(e.pos.x + Math.sin(a) * d, e.pos.y + up * cfg.legLen * 4, e.pos.z + Math.cos(a) * d);
          id.hasLook = true;
          id.cock = e.rand() < 0.35 ? (e.rand() < 0.5 ? -1 : 1) : 0;
        }
      }
      if (id.hasLook) { P.look = id.look; P.lookW = w; P.cock = id.cock * w; }
    }
    // occasional behaviours (none while it turns on the spot: a wing stretched and the tail fanned
    // through a stepping turn read as a stumble; a running one fades out, tw)
    const turning = !!e.pivot || Math.abs(angDiff(e.heading, e.wantHeading ?? e.heading)) > 0.3;
    id.tw = clamp((id.tw ?? 1) + (turning ? -4 : 2) * dt, 0, 1);
    id.nextT -= dt;
    if (!id.beh && id.want && w > 0.6) {
      id.beh = id.want[0]; id.behDur = id.want[2]; id.want = null;
      id.behT = 0; id.side = e.rand() < 0.5 ? -1 : 1; id.flag = e.rand(); id.nextT = 2.5 + e.rand() * 5;
    }
    if (!id.beh && id.nextT <= 0 && w > 0.95 && !turning) {
      const list = this.idleList;
      let r = e.rand(), tot = 0;
      for (const b of list) tot += b[1];
      r *= tot;
      for (const b of list) { r -= b[1]; if (r <= 0) { id.beh = b[0]; id.behDur = b[2] * (b[0] === 'crow' ? 1 : 0.8 + e.rand() * 0.5); break; } }
      id.behT = 0; id.side = e.rand() < 0.5 ? -1 : 1; id.flag = e.rand();
      id.nextT = 2.5 + e.rand() * 5;
    }
    if (id.beh) {
      id.behT += dt;
      const t = id.behT, T = id.behDur, k = smooth(0, Math.min(0.25, T * 0.3), t) * (1 - smooth(T - Math.min(0.3, T * 0.35), T, t)) * w * smooth(0, 1, id.tw);
      const sd = id.side;
      switch (id.beh) {
        case 'preen': {
          // bill to the shoulder / wing coverts / breast, nibbling
          // (the breast and the front of the shoulder: the neck arches forward and down, the bill turned
          // back into the feathers)
          // (species may place the spot: actions.preen = { spot: [x, y, z] body frame from the hip pivot,
          // m at the reference size, x toward the preened side; pitch: head pitch, rad })
          const pr = this.tuning.preen;
          const ps = e._preen && !(pr && pr.spot) ? e._preen[sd > 0 ? 0 : 1] : null;
          let hp, yaw = sd * 0.5, pitch = pr?.pitch ?? 1.25;
          if (ps) {
            // (default) the bill tip into the feathers at the side of the breast (measured on the skin),
            // nibbling up and down along it; the head turned to that side, bill down. A neck short for its
            // head (a chick's is half the head's length) cannot bend the head down into the breast's side
            // without wrenching the skin between them: it preens the shoulder above instead, the head
            // carried by the neck to a body-frame spot (nr: 0 for a neck under half the head's length, 1
            // from 0.85)
            const nr = clamp((cfg.neckArc / Math.max(1e-4, cfg.billLocal.length()) - 0.45) / 0.4, 0, 1);
            yaw = sd * lerp(1.0, 0.75, nr); pitch = pr?.pitch ?? lerp(0.6, 1.0, nr);
            const w = e.B(tv().copy(ps.p).addScaledVector(ps.n, 0.004 * s).add(tv(0, 0.012 * s * Math.sin(t * 1.3), 0.008 * s * Math.sin(t * 0.9))), tv());
            hp = billTo(e, w, pitch, yaw, tv());
            // (a short neck: the head turned toward the shoulder and lowered a little - 30 % of the way from
            // its rest to a spot on the shoulder - the bill down 34 deg: on a chick, the full reach down
            // into the breast put 2.4 % of its skin over 3x, this 0.2 %)
            if (nr < 1) {
              hp.lerp(e.B(tv(sd * 0.012 * s, cfg.headH - cfg.pivotY - 0.055 * s, 0.075 * s + 0.01 * s * Math.sin(t * 1.3)), tv()), 1 - nr);
              hp.lerp(e.B(tv().copy(cfg.occLocal), tv()), (1 - nr) * 0.7);
            }
          } else {
            const spot = pr && pr.spot ? tv(sd * pr.spot[0] * s, pr.spot[1] * s, pr.spot[2] * s + 0.01 * s * Math.sin(t * 1.3))
              : tv(sd * 0.012 * s, cfg.headH - cfg.pivotY - 0.055 * s, 0.075 * s + 0.01 * s * Math.sin(t * 1.3));
            hp = e.B(spot, tv());
          }
          P.headPos.lerp(hp, k / Math.max(1e-3, P.headW + k)); mx(P, 'headW', 1, k);
          mx(P, 'headYaw', yaw, k); mx(P, 'headPitch', pitch, k); mx(P, 'headRoll', sd * 0.2, k);
          mx(P, 'jaw', 0.12 * (0.5 + 0.5 * Math.sin(t * 22)), k); mx(P, 'lookW', 0, k);
          mx(P, 'fluff', 0.4, k); P.wingElevS[sd > 0 ? 0 : 1] += 8 * DEG * k;
          break;
        }
        case 'wingFlick': mx(P, 'wingOpen', 0.22, k); mx(P, 'wingElev', 12 * DEG, k); mx(P, 'wingOmega', 3, k); break;
        case 'tailFlick': mx(P, 'tailPitch', 0.25 * Math.sin(Math.min(1, t / T) * Math.PI * 2), w * smooth(0, 1, id.tw)); mx(P, 'tailFan', 0.45, k); break;
        case 'shake': {
          const sh2 = Math.sin(t * 38) * k;
          mx(P, 'fluff', 1, k); mx(P, 'roll', 0.12 * sh2, 1); mx(P, 'headRoll', 0.5 * sh2, 1); mx(P, 'wingOpen', 0.12, k); mx(P, 'tailFan', 0.3, k);
          break;
        }
        case 'cock': mx(P, 'headRoll', sd * 0.55, k); mx(P, 'headPitch', -0.15, k); break;
        case 'stretch': {
          // wing-and-leg stretch: one wing down and back
          P.wingElevS[sd > 0 ? 0 : 1] += (-10 * DEG - P.wingElevS[sd > 0 ? 0 : 1]) * k;
          mx(P, 'wingOpen', 0.45, k); mx(P, 'wingAlpha', 50 * DEG, k); mx(P, 'tailFan', 0.5, k); mx(P, 'wingOmega', 0.6, k);
          break;
        }
        case 'crow': {
          // rooster crowing: often a wing clap first, then the neck stretched up and forward, chest
          // out, bill wide open for the call (three syllables), and back
          const wt = w * smooth(0, 1, id.tw);
          const clap = id.flag < 0.6 ? pulse(t, 0.02, 0.18, 0.75) * wt : 0;
          mx(P, 'wingOpen', 0.9, clap); mx(P, 'flap', 1, clap); mx(P, 'flapAmp', 0.7, clap); mx(P, 'wingElev', 10 * DEG, clap);
          const st = smooth(0.55, 1.05, t) * (1 - smooth(T - 0.55, T, t)) * wt;
          mx(P, 'headUp', 0.07, st); mx(P, 'neckReach', 0.028, st); mx(P, 'headPitch', -0.8, st); mx(P, 'headW', 0, st);
          mx(P, 'pitch', 0.28, st); mx(P, 'chestPitch', 0.1, st); mx(P, 'tailPitch', 0.12, st); mx(P, 'fluff', 0.35, st);
          mx(P, 'lookW', 0, st); mx(P, 'cock', 0, st); mx(P, 'headOmega', 0.8, st);
          const call = smooth(1.0, 1.15, t) * (1 - smooth(2.55, 2.75, t));
          const syl = 0.75 + 0.25 * Math.sin(Math.max(0, t - 1.0) * 7.5);
          mx(P, 'jaw', 0.55 * syl, call * wt);
          if (!id.called && t > 1.0) { id.called = true; e.emit('vocalize', { kind: 'crow' }); }
          break;
        }
        case 'bill': {
          // wipe the bill on the ground / perch
          // (reach / bill pitch as the species pecks: actions.eat { reach, billPitch, bodyPitch, drop })
          // (raptors that tear their food wipe the bill just ahead of the breast, as they eat)
          // (the bill steep as in a peck, at least 0.95 rad down: a flatter bill on the ground put the
          // throat - a crow's chin feathers, a hen's wattles - 5-10 mm into it)
          const et = this.tuning.eat || {}, tear = et.style === 'tear';
          const bp = tear ? (et.billPitch ?? 1.2) : Math.max(0.95, et.billPitch ?? 1.05);
          // (a raptor wipes a little further ahead than it tears: the bill down at its feet swung the
          // neck base - and the breast skin blended to it - far forward)
          const fit = fitPeck(e, et.reach ?? (tear ? 1.3 : 1.12), bp, et.bodyPitch ?? (tear ? -0.72 : -0.45), et.drop ?? (tear ? 0.1 : 0.25));
          const pt = groundAhead(e, fit.reach, tv(), false);
          const hp = billTo(e, pt, bp, sd * 0.3 * Math.sin(t * 7), tv());
          P.headPos.lerp(hp, k / Math.max(1e-3, P.headW + k)); mx(P, 'headW', 1, k);
          mx(P, 'headPitch', bp, k); mx(P, 'pitch', fit.pitch, k); mx(P, 'lookW', 0, k);
          mx(P, 'drop', fit.drop, k); mx(P, 'tailPitch', -0.3, k);
          break;
        }
      }
      if (t >= T) { id.beh = null; id.called = false; }
    }
  }
}

export { angDiff };
