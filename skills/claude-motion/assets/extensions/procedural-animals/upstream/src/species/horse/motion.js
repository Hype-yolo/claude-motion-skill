// Horse motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, 1.63 m at the withers); the engine
// scales them by dynamic similarity for ponies, foals and big horses.
//
// Gaits: lateral-sequence 4-beat walk, 2-beat diagonal trot (hind lands
// ~2 % before its diagonal fore), 3-beat canter (right lead: LH, then RH + LF, then RF) and 4-beat
// transverse gallop (LH, RH, LF, RF, one gathered suspension). Rows sit so the table's crossover
// speeds are the measured transitions: walk -> trot 2.1 m/s (Froude 0.35), trot -> canter ~5 m/s,
// canter -> gallop ~8.8 m/s. Stride frequency rises only slowly in the gallop; stride length does
// the work.
import { HEAD_PITCH } from './rig.js';
import { ONESHOTS, POSTURES } from '../../core/motion/actions.js';
// the bind pose carries the head less flexed at the poll than the resting horse (the throat skin is
// meshed at mid-range between grazing and an alert head): the carriage table adds the difference
const DP = (55 * Math.PI) / 180 - HEAD_PITCH;
const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });
const DEG = Math.PI / 180;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mx = (P, k, v, w) => { P[k] += (v - P[k]) * w; };

export const motion = {
  maxSpeed: 18,
  accel: [3.5, 6],
  decel: 6.5,
  // school figures: a trot circle of ~6-10 m, lean below ~15 deg (lateral acceleration ~2.8 m/s^2)
  turnRate: 1.0,
  latAccelMax: 2.8,
  gears: { walk: 1.5, trot: 3.6, canter: 6.2, gallop: 13 },
  gallopBlend: [5, 10],
  // (drop: the girdles carried 1-2 cm low from the fast walk up. A horse stands on nearly straight
  // forelegs: at the standing height the foreleg's forward reach is at the edge of its range, where
  // the reach grows as a square root, and a trot braking through that height moved the landing of a
  // swinging forefoot 8 cm in one frame. The top gallop row: 6 cm drop and 2.2 Hz (were 8 cm and
  // 2.35 Hz, which left 2-frame fore stances dragged in sprint turns and jerking elbows at the sprint)
  //    name      v     f     D     [FL,   FR,   HL,  HR]
  gaits: [
    G('walk', 0.0, 0.75, 0.72, [0.25, 0.75, 0.0, 0.5], { liftF: 0.08, liftH: 0.07, bobF: 0.03, bobH: 0.03, flex: 0, lat: 0.02, fold: 0.3, heel: 30, tail: 0, drop: 0 }),
    G('walk', 1.7, 0.98, 0.63, [0.25, 0.75, 0.0, 0.5], { liftF: 0.1, liftH: 0.085, bobF: 0.08, bobH: 0.08, flex: 0, lat: 0.025, fold: 0.42, heel: 40, tail: 0.1, drop: 0.01 }),
    G('trot', 2.5, 1.3, 0.5, [0.52, 0.02, 0.0, 0.5], { liftF: 0.15, liftH: 0.12, bobF: 0.07, bobH: 0.07, flex: 0.01, lat: 0.0, fold: 1.0, heel: 50, tail: 0.35, drop: 0.02 }),
    G('trot', 4.2, 1.5, 0.42, [0.52, 0.02, 0.0, 0.5], { liftF: 0.18, liftH: 0.15, bobF: 0.08, bobH: 0.08, flex: 0.015, lat: 0.0, fold: 1.1, heel: 55, tail: 0.45, drop: 0.02 }),
    G('canter', 5.8, 1.75, 0.45, [0.3, 0.55, 0.0, 0.27], { liftF: 0.2, liftH: 0.16, bobF: 0.035, bobH: 0.05, flex: 0.05, lat: 0, fold: 1.15, heel: 55, tail: 0.55, drop: 0.03 }),
    G('canter', 7.5, 1.9, 0.38, [0.3, 0.55, 0.0, 0.25], { liftF: 0.22, liftH: 0.18, bobF: 0.04, bobH: 0.055, flex: 0.07, lat: 0, fold: 1.2, heel: 45, tail: 0.65, drop: 0.035 }),
    G('gallop', 10, 2.1, 0.28, [0.38, 0.52, 0.0, 0.12], { liftF: 0.25, liftH: 0.21, bobF: 0.045, bobH: 0.06, flex: 0.1, lat: 0, fold: 1.3, heel: 40, tail: 0.8, drop: 0.06 }),
    G('gallop', 17, 2.2, 0.21, [0.4, 0.52, 0.0, 0.13], { liftF: 0.28, liftH: 0.24, bobF: 0.045, bobH: 0.065, flex: 0.13, lat: 0, fold: 1.4, heel: 40, tail: 1.0, drop: 0.06 }),
  ],
  feet: {
    // hoof: fetlock sinks under load (the suspensory apparatus), the hoof flips in swing,
    // breakover about the toe at push-off
    front: { type: 'unguligrade', contact: 0.95, curl: 70, flex: 4, sink: 20, hoofFlex: 25, swingBack: 0.25 },
    hind: { type: 'unguligrade', contact: 0.95, curl: 70, flex: 4, sink: 16, hoofFlex: 25, swingBack: 0.05 },
  },
  stance: { width: 1, gallopWidth: 0.8, sprawl: 0, crouch: 0, scuff: [14, 24, 0] },
  // torso cross-sections (bind pose, reference size): centre height, half height, half width
  body: {
    // (half heights include the legs folded under the chest and thighs when lying down)
    chest: { y: 1.25, hh: 0.45, hw: 0.31 },
    mid: { y: 1.24, hh: 0.37, hw: 0.3 },
    pelvis: { y: 1.32, hh: 0.5, hw: 0.38 }, // (hw: the thigh muscles a horse lying flat rests on)
    back: 0.15,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: the head goes down and forward
    // at the walk, is carried higher at the trot and stretched forward in the gallop
    carriage: [[0, 0, 0, DP], [1.5, -0.06, 0.06, 0.05 + DP], [3.5, -0.02, 0.04, 0.02 + DP], [6.5, -0.14, 0.12, 0.1 + DP], [14, -0.28, 0.2, 0.12 + DP]],
    // walk: the head nods (see hooks), trot: steady, canter / gallop: swings with the stride
    stab: [[0, 0], [1.5, 0.1], [3.5, 0.45], [6.5, 0.3], [14, 0.35]],
    neckBend: 50, neckPivot: 0.5, yaw: 0.55, pitchUp: 0.6, pitchDown: 0.9, mouth: 'jawTip',
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), dock -> hair tip]
    carriage: [
      [0.0, [-25, -50, -66, -76, -82, -86, -88, -89, -89, -89]],
      [1.5, [-20, -45, -62, -74, -80, -85, -87, -88, -88, -88]],
      [3.5, [-5, -26, -46, -60, -70, -76, -79, -81, -83, -84]],
      [6.5, [8, -10, -28, -42, -52, -58, -62, -64, -66, -68]],
      [14, [14, 0, -12, -22, -28, -30, -30, -30, -31, -32]],
    ],
    stiffness: 0.8, sway: 5, flick: 0, wag: 0, swish: 1, curl: 0, balance: 0,
    radius: [0.07, 0.09], // (dock, then the hair switch)
  },
  ears: { rest: [0, 0], mobility: 1.25, speedFlatten: 0.25, twitch: 1.2, prick: 0.45 },
  breath: { rate: 0.2, amp: 0.008, pant: false, pantRate: 1.2, pantAmp: 0.02, heatSpeed: 10 },
  actions: {
    attack: { style: 'kick', kick: 'double', kickReach: [0.6, 0.45] }, // play('attack', { kick: 'rear' }) rears and strikes
    // grazing / drinking: the long head hangs near vertical (the default pitch 1.3 curls a cat's head
    // under; a horse's head is already carried 55 deg nose-down in the bind pose)
    eat: { style: 'graze', dropF: 0, dropH: 0, pitch: DP + 0.7, ahead: 0.45 },
    drink: { dropF: 0, dropH: 0, pitch: DP + 0.7, ahead: 0.45 },
    // a 1 m jump (0.7 m flight from the canter) lands the forelegs in step with the canter; the landing
    // sink comes from the engine's landing springs, the crouch adds a little knee give
    jump: { height: 1.0, distance: 3.6, land: [0.15, 0.12] },
    sit: { dropH: 1.0 }, // (the hind cannons fold flat under the haunches and the rump rests on the ground)
    // kneels on the forelegs first, then lowers the hindquarters; gets up forelegs first
    lie: { down: 'front', up: 'front' },
    sleep: { style: 'lateral', down: 'front', up: 'front' },
    // lying sternal: forelegs folded under the chest (carpus flexed, cannons back along the ground)
    fold: { front: { z: -0.26, k: 1.5, beta: 0.9 } },
  },
  // tack: saddle seat on the back (T12-T14, ~0.30 m behind the withers, from the research),
  // rider's seat above it, stirrup treads, bit rings at the mouth corners
  attachments: {
    back: { bone: 'spine3', from: 'saddle' },
    seat: { bone: 'spine3', from: 'seat' },
    stirrupL: { bone: 'spine3', from: 'stirrupL' },
    stirrupR: { bone: 'spine3', from: 'stirrupR' },
    bitL: { bone: 'head', from: 'jawHinge', to: 'jawTip', t: 0.76, offset: [0.047, 0, 0] },
    bitR: { bone: 'head', from: 'jawHinge', to: 'jawTip', t: 0.76, offset: [-0.047, 0, 0] },
  },
  hooks: { update: horseBehaviour, actions: { attack: horseAttack(), lie: rising(POSTURES.lie), sleep: rising(POSTURES.sleep) } },
};

// Getting up (lie / sleep with tune.up): the core staged rise follows its front / hind weights with a
// spring, which still held ~4 % of the lying drop when the posture's weight reached zero and the
// posture ended, so the body stepped 2.5 cm up in the last frame (a 3.07 % S jitter at the hind
// fetlocks). The staged weights are held under the posture weight as it fades out, so both reach
// zero together.
function rising(core) {
  return {
    ...core, kind: 'posture',
    apply(P, w, inst, L) {
      if (inst.target === 0 && inst.kF !== undefined) {
        const cap = smooth(0, 0.3, w);
        inst.kF = Math.min(inst.kF, cap); inst.kH = Math.min(inst.kH, cap);
      }
      core.apply.call(this, P, w, inst, L);
    },
  };
}

// Attack on the move: a horse does not kick out of a canter; it props to a halt (the stride runs
// on while it brakes) and kicks from the stand. The core's kick holds the legs out of the gait
// (legGait 0.4), so started at speed it dragged the planted forefeet ~1.9 leg lengths behind and
// then snapped them forward (a 120 rad/s* forearm pop). Braking first keeps every stride stepped.
function horseAttack() {
  const core = ONESHOTS.attack;
  const HALT = 0.7; // m/s x sk: kick below this speed
  return {
    ...core,
    start(inst, L) {
      const e = L.engine;
      inst.brake = e.speed > HALT * e.cfg.sk;
      inst.t0 = 0;
      core.start.call(this, inst, L);
    },
    update(inst, dt, L) {
      const e = L.engine;
      if (inst.brake) {
        if (e.speed <= HALT * e.cfg.sk || inst.t > 3) { inst.brake = false; inst.t0 = inst.t; core.start.call(this, inst, L); }
        return false;
      }
      const t = inst.t; inst.t = t - inst.t0;
      const r = core.update.call(this, inst, dt, L);
      inst.t = t;
      return r;
    },
    apply(P, w, inst, L) {
      // (held to a halt through the kick; the speed request comes back as the attack fades out)
      mx(P, 'speedScale', 0, w);
      if (inst.brake) { mx(P, 'earFlat', 1, w * smooth(0, 0.3, inst.t)); return; }
      const t = inst.t; inst.t = t - inst.t0;
      core.apply.call(this, P, w, inst, L);
      inst.t = t;
    },
  };
}

// Horse behaviour on top of the actions (see core/motion/actions.js):
//  * walk: the head and neck nod once per forelimb stance (twice per stride);
//  * idle: after a while the horse dozes on its feet (stay apparatus): one hind leg rested on the
//    toe of its hoof with that hip dropped, head lowered to withers level, lower lip slack, ears
//    sideways, eyes half closed; it swaps the resting leg now and then. Flies: tail swishes.
function horseBehaviour(P, dt, layer) {
  const e = layer.engine, cfg = e.cfg, s = cfg.s, u = 1 / cfg.unit; // (posture lengths are in cheetah units: x cfg.k)
  const st = layer.horse || (layer.horse = { idleT: 0, doze: 0, dozeOn: false, dozeT: 10 + e.rand() * 6, restLeg: 2, swishT: 3, swish: 0, swishAge: 9 });
  const vn = e.speed / cfg.sq, g = e.gait;
  // ---- walk head nod
  const walkW = smooth(0.15, 0.7, vn) * (1 - smooth(1.9, 2.4, vn)) * P.gaitW;
  if (walkW > 0.001) {
    const ph = e.phase - g.off[0];
    const c = 0.5 + 0.5 * Math.cos(4 * Math.PI * (ph - 0.12));
    P.headRaise -= 0.07 * u * walkW * c;
    P.headPitch += 0.06 * walkW * (c - 0.5);
  }
  // ---- idle: dozing on its feet
  const idleW = layer.idle.w;
  if (idleW > 0.9 && !layer.postures.length) st.idleT += dt; else { st.idleT = 0; st.dozeOn = false; }
  if (st.idleT > 0) {
    st.dozeT -= dt;
    if (st.dozeT <= 0) {
      st.dozeOn = !st.dozeOn;
      st.dozeT = st.dozeOn ? 14 + e.rand() * 14 : 5 + e.rand() * 6;
      if (st.dozeOn) st.restLeg = e.rand() < 0.5 ? 2 : 3;
    }
  }
  st.doze = clamp(st.doze + (st.dozeOn ? dt * 0.35 : -dt * 0.8), 0, 1);
  const dz = smooth(0, 1, st.doze) * idleW;
  if (dz > 0.001) {
    layer.idle.stepT = Math.max(layer.idle.stepT, 1); // no re-steps while dozing
    const leg = e.legs[st.restLeg], L = leg.def, pl = P.legs[st.restLeg];
    const side = L.s;
    // resting hind hoof tipped on its toe a little forward and under the body
    const tgt = e.bodyToWorld(L.cx * side * 0.85, 0, L.cz + 0.1 * s, e.heading, e.pos, pl.target);
    tgt.y = e.terrainH(tgt.x, tgt.z);
    const w = smooth(0, 0.6, dz);
    pl.reach += (1 - pl.reach) * w;
    mx(P, 'roll', 0.035 * side * -1, dz); // that hip drops
    mx(P, 'dropH', 0.05, dz); mx(P, 'side', -0.012 * u * side, dz);
    mx(P, 'headRaise', -0.3 * u, dz); mx(P, 'headPitch', 0.18, dz); mx(P, 'neckReach', 0.06 * u, dz);
    mx(P, 'eyelid', 0.6, dz); mx(P, 'jaw', 0.05, dz);
    mx(P, 'earFlat', 0.35, dz); mx(P, 'earSwivel', 0.5, dz); mx(P, 'earTwitch', 0.25, dz);
    mx(P, 'lookW', 0, dz); mx(P, 'breathRate', 0.75, dz); mx(P, 'tailIdle', 0.5, dz);
  }
  // ---- grazing / drinking: the trunk stays level on straight forelegs and the long neck does the
  // reaching (the engine would otherwise lower the forehand); one fore hoof is advanced
  let graze = 0;
  for (const o of layer.oneshots) if (o.name === 'eat' || o.name === 'drink') graze = Math.max(graze, o.w * o.w * (3 - 2 * o.w));
  if (graze > 0.001) {
    P.headReach *= 1 - graze;
    mx(P, 'dropF', 0.055, graze); mx(P, 'dropH', 0, graze); // (the withers give ~4 cm: saddle < 2 cm, < 2.5 deg)
    layer.idle.stepT = Math.max(layer.idle.stepT, 1);
  }
  if (graze > 0.5) e.legs[0].idleOff.set(0, 0, 0.22 * s); // (released: the idle layer relaxes it back)
  // ---- flat out (lateral sleep, death): the long head lies on its cheek, the ears laid back along
  // the neck instead of sticking into the ground
  for (const p of layer.postures) {
    if (p.name !== 'sleep' && p.name !== 'death') continue;
    const w = p.w * p.w * (3 - 2 * p.w) * (p.name === 'sleep' ? smooth(1.0, 3.0, p.t) : smooth(0.35, 1.0, p.t));
    P.headPos.y += 0.14 * s * w;
    P.headPitch += 0.5 * w; // (nose tucked: the throat is not stretched open)
    mx(P, 'earFlat', 1, w); mx(P, 'earTwitch', 0.1, w);
    // the forelegs held a little out from the ground, straight (the side pose presses the hooves to
    // the ground and the long cannon sagged into a bump on uneven ground, 35 mm at the knee)
    for (let i = 0; i < 2; i++) { const pl = P.legs[i]; pl.tuck += (1 - pl.tuck) * 0.12 * w; pl.extend = 1; }
  }
  // ---- fly swish: short bursts of tail lashing while standing
  if (idleW > 0.5) {
    st.swishT -= dt;
    if (st.swishT <= 0) { st.swishT = 4 + e.rand() * 8; st.swishAge = 0; }
  }
  st.swishAge += dt;
  const sw = Math.sin(Math.PI * clamp(st.swishAge / 1.6, 0, 1)) * idleW;
  if (sw > 0.001) P.tailWag = Math.max(P.tailWag, 0.55 * sw);
  void DEG;
}
