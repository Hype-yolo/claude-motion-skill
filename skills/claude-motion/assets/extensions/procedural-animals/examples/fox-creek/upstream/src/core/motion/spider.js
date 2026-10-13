// Spider motion engine: eight legs of seven segments, pedipalps, chelicerae with fangs and a hanging
// abdomen, on uneven ground. Drives the bones of core/rig/spider.js.
//
// Locomotion: a phase-offset gait table (alternating tetrapod: L1 R2 L3 R4 against R1 L2 R3 L4, with
// the metachronal lag inside each tetrapod) blended by speed. Stance claws stay planted where they
// touched down; swing claws travel on a "ballistic" path (short speed ramps, straight cruise, a
// rounded apex) whose height clears the terrain sampled along the way, so legs step over bumps.
// Standing still, legs that end up away from their neutral foothold re-step one tetrapod at a time;
// turning on the spot runs the gait from the yaw rate. The body height, pitch and roll follow a
// least-squares plane through the terrain under the eight neutral footholds (springs), and the
// sternum / abdomen never touch a bump. The abdomen hangs from the pedicel on a spring (lags in turns
// and speed changes) and breathes (bone scale).
//
// Leg solver (body frame, per frame, continuous): the tarsus lies along the leg's azimuth at its
// bind slope (steeper while the "heel" lifts), which gives the metatarsus-tarsus joint; the coxa
// yaws part of the way toward it and the trochanter the rest; in the vertical leg plane the
// metatarsus takes a preferred slope that flattens as the leg stretches, and femur + (patella +
// tibia, a rigid pair) solve as a two-link chain, knee up, with a soft reach limit. Every bone is
// written as a rotation from its bind frame: body rotation x yaw about the body's up axis x pitch
// about the bind leg-plane normal, so the bone roll never flips. Action poses (raised threat legs,
// held prey, the death curl, the in-air tuck) are blended in the same joint-angle space.
//
// Actions: idle (breathing, leg and palp twitches, looking around), jump (a pounce: crouch, hydraulic
// push-off, front legs raised to grab, landing), sit / lie / sleep (crouch low with the legs drawn
// in), eat (chelicerae working, palps manipulating, prey held by legs I), drink (mouthparts down),
// attack (threat pose: front legs raised, fangs out; then a lunge and attackHit), hit (flinch and
// scuttle back), death (hydraulic leg collapse: the legs curl under the body and it settles on its
// back or side on whatever ground is there), stand.
//
// Lessons from the cheetah engine kept here: continuous solves (no state jumps between frames),
// soft reach limits, motion from phase not events, springs for secondary motion, zero-dt safety,
// no allocations in the hot path.
//
// ------------------------------------------------------------------------------------------------
// species.motion schema (all lengths in metres at the reference size; per-variant overrides in
// `variants: { name: { ...same fields } }`, chosen by params.variant)
// ------------------------------------------------------------------------------------------------
// maxSpeed m/s, accel / decel m/s^2, turnRate rad/s, latAccelMax m/s^2 (cornering: wider arcs at speed)
// gears      { name: speed } named speeds (walk, run, sprint)
// gaits (req.) [{ name, v, f, D, off: [L1 L2 L3 L4 R1 R2 R3 R4], lift, bob, sway }] sorted by v.
//            v: speed of the row, f: stride Hz, D: duty factor, off: touchdown phase per leg, lift:
//            swing height (m), bob: body bounce (m, twice per stride), sway: body yaw sway (rad).
// stance     { reach: [I, II, III, IV] neutral claw distance from the coxa as a fraction of the
//            bind pose, height: stance height factor, width: lateral spread factor }
// feet       { heelLift: tarsus heel lift at push-off (deg) }
// abdomen    { stiffness: spring rate (1/s), lag: how far it swings in accelerations (rad per
//            m/s^2 x s), droop: pitch it sags by when relaxed (rad) }
// breath     { rate Hz, amp: abdomen scale amplitude }
// chelicerae { fang: 'labidognath' (fangs close sideways: wolf spiders) | 'orthognath' (fangs
//            strike down: tarantulas), fangOpen: rad, spread: rad, pitch: rad }
// palps      { twitch 0..1, tap 0..1 }       idle { twitch, raiseFront (rad), look (rad) }
// look       { yaw, pitch }: how far the body turns / rears toward a look target (rad)
// actions    { jump: { height, distance, crouch (s) }, attack: { rear (rad), lunge (m),
//            threat (s) }, sleep: { tuck 0..1 } }
// ------------------------------------------------------------------------------------------------
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, smin, wrap01, d01, angDiff, Spring, prng, envelope, tv } from './common.js';
import { LEG_KEYS, legBones, legJoints, palpBones, palpJoints } from '../rig/spider.js';

const DEG = Math.PI / 180;
// swing shaping (exported for tuning tools)
export const TUNE = { bf: 1.15, bp: 0.25, bm: 0.2, ramp: 0.22, path: 'joint' };
const G_ACC = 9.81;
const PUSH = 0.07; // jump push-off duration (s)
const COAST = 1 / 50; // constant-velocity moments between push, flight and landing (s)
const Y_AXIS = Object.freeze(new THREE.Vector3(0, 1, 0));
const X_AXIS = Object.freeze(new THREE.Vector3(1, 0, 0));
const Z_AXIS = Object.freeze(new THREE.Vector3(0, 0, 1));
const ONE = Object.freeze(new THREE.Vector3(1, 1, 1));
const SET_A = [1, 0, 1, 0, 0, 1, 0, 1]; // tetrapod A: L1 R2 L3 R4
// action leg poses: bends (deg) of patella, tibia, metatarsus, tarsus relative to the previous segment
const P_AIR_F = [-40, -25, -30, -20], P_AIR_H = [-15, -12, -10, -8];
const P_RAISE = [-18, -12, -14, -6], P_HOLD = [-78, -30, -52, -28], P_CURL = [-120, -65, -55, -45], P_TUCK = [-105, -35, -115, -40];
const STAG = [null, null, null, [0.2, 0.85], [0.1, 0.7], [0, 0.55], [0, 0.45]];
const softMin = (x, lim, w) => (x < lim - w ? x : lim - w * Math.exp((lim - w - x) / w)); // smooth clamp from above
const expTo = (x, target, dt, tau) => x + (target - x) * (1 - Math.exp(-dt / tau));

// ------------------------------------------------------------------------------------------------
// configuration
function mergeSpec(base, over) {
  if (!over) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = mergeSpec(base[k], v);
    else out[k] = v;
  }
  return out;
}

function resolveConfig(species, data, skeleton) {
  const base = species.motion || {};
  const variant = data.params?.variant;
  const spec = mergeSpec(base, base.variants && variant ? base.variants[variant] : null);
  const J = {};
  for (const [k, v] of Object.entries(data.joints)) J[k] = new THREE.Vector3(v[0], v[1], v[2]);
  const s = data.params?.size || 1, sq = Math.sqrt(s);
  const boneIndex = Object.fromEntries(data.bones.map((b, i) => [b.name, i]));
  const bindQ = skeleton.bind.map((m) => new THREE.Quaternion().setFromRotationMatrix(m));
  // body root: centre of the coxa bases (sternum level), on the midline
  const root = new THREE.Vector3();
  for (const key of LEG_KEYS) root.add(J['coxa' + key[1] + key[0]]);
  root.multiplyScalar(1 / 8); root.x = 0;
  const loc = (v) => v.clone().sub(root);
  const cfg = {
    spec, s, sq, J, root, boneIndex, bindQ,
    rootH: root.y,
    maxSpeed: (spec.maxSpeed ?? 0.3) * sq,
    accel: (spec.accel ?? 2) * sq, decel: (spec.decel ?? 3) * sq,
    turnRate: (spec.turnRate ?? 4) / sq,
    latAccelMax: (spec.latAccelMax ?? 0.4) * sq,
    gears: Object.fromEntries(Object.entries(spec.gears || { walk: 0.05, run: 0.15 }).map(([k, v]) => [k, v * sq])),
    gaits: (spec.gaits || []).map((g) => ({ lift: 0.003, bob: 0, sway: 0, ...g })),
    stance: { reach: [0.9, 0.93, 0.93, 0.9], height: 1, width: 1, ...(spec.stance || {}) },
    heelLift: (spec.feet?.heelLift ?? 12) * DEG,
    abd: { stiffness: 16, lag: 0.12, droop: 0.05, ...(spec.abdomen || {}) },
    breath: { rate: 0.5, amp: 0.015, ...(spec.breath || {}) },
    chel: { fang: 'labidognath', fangOpen: 1.2, spread: 0.3, pitch: 0.45, ...(spec.chelicerae || {}) },
    palps: { twitch: 1, tap: 0.5, ...(spec.palps || {}) },
    idle: { twitch: 1, raiseFront: 0.1, look: 0.3, ...(spec.idle || {}) },
    look: { yaw: 0.45, pitch: 0.3, ...(spec.look || {}) },
    actions: spec.actions || {},
  };
  if (!cfg.gaits.length) throw new Error('procedural-animals spider: species.motion.gaits is required');
  // ---- legs
  cfg.legs = LEG_KEYS.map((key, idx) => {
    const S = key[0], i = +key[1], side = S === 'L' ? 1 : -1;
    const jn = legJoints(i, S), bn = legBones(i, S);
    const P = jn.map((n) => loc(J[n]));
    const len = [], az = [], el = [];
    for (let k = 0; k < 7; k++) {
      const d = P[k + 1].clone().sub(P[k]);
      len.push(d.length());
      d.normalize();
      az.push(Math.atan2(d.x * side, d.z));
      el.push(Math.asin(clamp(d.y, -1, 1)));
    }
    const phi0 = az[2];
    const u0 = new THREE.Vector3(Math.sin(phi0) * side, 0, Math.cos(phi0));
    const n0 = new THREE.Vector3().crossVectors(u0, Y_AXIS).normalize();
    // patella + tibia as one rigid link from the knee to the tibia end
    const pt = P[5].clone().sub(P[3]);
    const ptH = pt.x * u0.x + pt.z * u0.z;
    const ept0 = Math.atan2(pt.y, ptH);
    const L = {
      key, idx, i, S, side, front: i <= 2,
      bones: bn.map((b) => cfg.boneIndex[b]), bindQ: bn.map((b) => bindQ[cfg.boneIndex[b]]),
      P0: P, len, az0: az, el0: el, phi0, u0, n0,
      Lpt: Math.hypot(ptH, pt.y), dp: el[3] - ept0, dt: el[4] - ept0,
      total: len.reduce((a, b) => a + b, 0),
      tipY: J[jn[7]].y, // claw tip height above the ground at bind
      set: SET_A[idx],
    };
    L.reach2 = L.len[2] + L.Lpt;
    const F0 = P[2], A0 = P[6];
    L.D0 = Math.hypot((A0.x - F0.x) * u0.x + (A0.z - F0.z) * u0.z, A0.y - F0.y);
    // neutral foothold (body frame, horizontal): the bind claw pulled toward the coxa
    const rk = cfg.stance.reach[i - 1] ?? 0.9;
    L.neutral = new THREE.Vector3(P[0].x + (P[7].x - P[0].x) * rk * cfg.stance.width, 0, P[0].z + (P[7].z - P[0].z) * rk);
    // workspace: horizontal distance of the claw from the coxa base (too close folds the leg over
    // itself, too far cannot be reached)
    L.rN = Math.hypot(L.neutral.x - P[0].x, L.neutral.z - P[0].z);
    L.rMin = 0.64 * L.rN;
    L.rMax = Math.min(1.18 * L.rN, 0.95 * (L.total - len[0] - len[1]));
    L.azN = Math.atan2((L.neutral.x - P[0].x) * side, L.neutral.z - P[0].z);
    L.azMax = 0.7;
    return L;
  });
  cfg.legLen = cfg.legs.reduce((a, L) => a + L.total, 0) / 8;
  // least-squares plane through the neutral footholds: rows of (X^T X)^-1 X^T for y = a + b x + c z
  {
    const X = cfg.legs.map((L) => [1, L.neutral.x, L.neutral.z]);
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const r of X) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) A[a][b] += r[a] * r[b];
    const inv = new THREE.Matrix3().set(...A[0], ...A[1], ...A[2]).invert().elements; // column-major
    const Ai = (a, b) => inv[b * 3 + a];
    cfg.fitW = [0, 1, 2].map((a) => X.map((r) => Ai(a, 0) * r[0] + Ai(a, 1) * r[1] + Ai(a, 2) * r[2]));
  }
  cfg.turnR = cfg.legs.reduce((a, L) => a + Math.hypot(L.neutral.x, L.neutral.z), 0) / 8;
  // ---- palps
  cfg.palpDefs = ['L', 'R'].map((S) => {
    const side = S === 'L' ? 1 : -1, jn = palpJoints(S), bn = palpBones(S);
    const P = jn.map((n) => loc(J[n]));
    const len = [], az = [], el = [];
    for (let k = 0; k < 6; k++) {
      const d = P[k + 1].clone().sub(P[k]);
      len.push(d.length()); d.normalize();
      az.push(Math.atan2(d.x * side, d.z)); el.push(Math.asin(clamp(d.y, -1, 1)));
    }
    const phi0 = az[2];
    const u0 = new THREE.Vector3(Math.sin(phi0) * side, 0, Math.cos(phi0));
    return { S, side, bones: bn.map((b) => cfg.boneIndex[b]), bindQ: bn.map((b) => bindQ[cfg.boneIndex[b]]), P0: P, len, az0: az, el0: el, phi0, n0: new THREE.Vector3().crossVectors(u0, Y_AXIS).normalize(), tipR: 0.0004 * s };
  });
  // ---- chelicerae and fangs
  cfg.chels = ['L', 'R'].map((S) => {
    const side = S === 'L' ? 1 : -1;
    const base = loc(J['cheBase' + S]), tip = loc(J['cheTip' + S]), ft = loc(J['fangTip' + S]);
    const fangVec = ft.clone().sub(tip);
    // fang hinge: labidognath fangs swing sideways (about the forward axis), orthognath fangs swing
    // down and forward (about the lateral axis); the sign is chosen so that opening moves the tip down
    const axis = cfg.chel.fang === 'orthognath' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const test = fangVec.clone().applyAxisAngle(axis, 0.2);
    if (test.y > fangVec.y) axis.negate();
    return { S, side, base, tip, fangVec, fangAxis: axis, bc: cfg.boneIndex['chelicera' + S], bf: cfg.boneIndex['fang' + S] };
  });
  cfg.ax = {};
  for (const n of ['front', 'ceph', 'pedA', 'pedB', 'abdEnd', 'spinTip']) cfg.ax[n] = loc(J[n]);
  cfg.bone = {};
  for (const n of ['prosoma', 'head', 'pedicel', 'abdomen', 'spinnerets']) cfg.bone[n] = cfg.boneIndex[n] ?? -1;
  // support points for ground contact of the body: extreme vertices of the bind mesh in 26
  // directions, for the parts rigid with the prosoma and with the abdomen
  const abdC = cfg.ax.pedB.clone().lerp(cfg.ax.abdEnd, 0.5);
  cfg.abdC = abdC; cfg.abdL = cfg.ax.pedB.distanceTo(cfg.ax.abdEnd) * 0.5;
  cfg.abdR = cfg.abdL * 0.62;
  {
    const dirs = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) dirs.push(new THREE.Vector3(x, y, z).normalize());
    const grp = data.bones.map((b) => (b.name === 'prosoma' || b.name === 'head' ? 0 : b.name === 'abdomen' || b.name === 'spinnerets' ? 1 : -1));
    const best = [dirs.map(() => ({ d: -1e9, p: null })), dirs.map(() => ({ d: -1e9, p: null }))];
    const pos = data.pos, si = data.skinIndex, sw = data.skinWeight;
    const c0 = [cfg.ax.pedA.clone().lerp(cfg.ax.front, 0.5), abdC];
    for (let v = 0; v < data.nV; v++) {
      if (sw[v * 4] < 0.9) continue;
      const gI = grp[si[v * 4]];
      if (gI < 0) continue;
      const x = pos[v * 3] - root.x, y = pos[v * 3 + 1] - root.y, z = pos[v * 3 + 2] - root.z;
      const c = c0[gI];
      for (let k = 0; k < dirs.length; k++) {
        const dd = (x - c.x) * dirs[k].x + (y - c.y) * dirs[k].y + (z - c.z) * dirs[k].z;
        if (dd > best[gI][k].d) best[gI][k] = { d: dd, p: [x, y, z] };
      }
    }
    cfg.supPro = best[0].filter((b) => b.p).map((b) => new THREE.Vector3(...b.p));
    cfg.supAbd = best[1].filter((b) => b.p).map((b) => new THREE.Vector3(...b.p).sub(cfg.ax.pedB));
    // the abdomen's lowest bind point (for resting it on the ground)
    let lo = null;
    for (const p of cfg.supAbd) if (!lo || p.y < lo.y) lo = p;
    cfg.abdLow = lo || new THREE.Vector3(0, -cfg.abdR, -cfg.abdL);
  }
  cfg.bodyLen = cfg.ax.front.distanceTo(cfg.ax.spinTip);
  // ---- death curl, per leg: every joint flexed ventrally so the leg folds under the sternum and no
  // joint sticks out beyond the carapace top or the body's flanks (a dead spider on its back or side
  // rests on its body, never propped on its knees). Solved once here in joint space (femur
  // elevation + four flexions) by coordinate descent.
  {
    let yTop = -1e9, yBot = 1e9, halfW = 0;
    for (const p of cfg.supPro) { yTop = Math.max(yTop, p.y); yBot = Math.min(yBot, p.y); halfW = Math.max(halfW, Math.abs(p.x)); }
    for (const p of cfg.supAbd) halfW = Math.max(halfW, Math.abs(p.x + cfg.ax.pedB.x));
    cfg.bodyTop = yTop; cfg.bodyHalfW = halfW;
    // two curls per leg: 'back' (a loose fist over the sternum: on its back, or the upper legs on its
    // side) and 'side' (the legs underneath when it lies on its side: folded straight down so no
    // joint reaches beyond the flank it rests on)
    const solve = (L, mode) => {
      const m = 1.6 * L.tipY, s = L.side, side = mode === 'side', up = mode === 'up';
      const out = [Math.sin(L.phi0) * s, Math.cos(L.phi0)];
      const tgt = side ? [s * 0.35 * halfW, yBot - 0.15 * L.total, L.P0[0].z * 0.7]
        : up ? [L.P0[0].x + out[0] * 0.28 * L.total, yBot + L.tipY, L.P0[0].z + out[1] * 0.28 * L.total]
        : [s * 0.12 * halfW, yBot - 0.1 * L.total, L.P0[0].z * 0.5];
      const deep = yBot - 0.3 * L.total;
      const jp = [];
      const fk = (x) => {
        // x = [femur, b1, b2, b3, b4, coxa] (rad); leg plane at phi0
        let px = L.P0[0].x, py = L.P0[0].y, pz = L.P0[0].z;
        const segs = [[L.az0[0], x[5]], [L.phi0, x[5]]];
        let e = x[0];
        segs.push([L.phi0, e]);
        for (let k = 1; k < 5; k++) { e += x[k]; segs.push([L.phi0, e]); }
        jp.length = 0;
        for (let k = 0; k < 7; k++) {
          const [a, el] = segs[k], ce = Math.cos(el);
          px += L.len[k] * Math.sin(a) * ce * s; py += L.len[k] * Math.sin(el); pz += L.len[k] * Math.cos(a) * ce;
          jp.push(px, py, pz);
        }
      };
      const cost = (x) => {
        fk(x);
        const n = jp.length;
        let c = ((jp[n - 3] - tgt[0]) ** 2 + (jp[n - 2] - tgt[1]) ** 2 + (jp[n - 1] - tgt[2]) ** 2) / (L.total * L.total);
        for (let k = 0; k < 7; k++) {
          const x_ = jp[k * 3], y_ = jp[k * 3 + 1];
          const over = up ? Math.max(0, yBot + m - y_) : Math.max(0, y_ - (yTop - m)) + (side ? Math.max(0, Math.abs(x_) - (halfW - m)) : Math.max(0, deep - y_));
          c += 400 * (over / L.total) ** 2;
        }
        // even flexions (a curl, not one sharp fold), within anatomical limits
        const mean = (x[1] + x[2] + x[3] + x[4]) / 4;
        for (let k = 1; k < 5; k++) c += 0.02 * (x[k] - mean) ** 2 + 50 * Math.max(0, x[k] + 0.1) ** 2 + 50 * Math.max(0, -x[k] - 2.6) ** 2;
        c += 50 * Math.max(0, x[0] - (up ? 1.3 : 0.2)) ** 2 + 50 * Math.max(0, -x[0] - 1.6) ** 2 + (side ? 0 : up ? 0.05 * (x[0] - 0.8) ** 2 : 0.05 * (x[0] + 0.8) ** 2);
        // the coxa and trochanter may swing down (ventrally) in their sockets, not up
        c += 50 * Math.max(0, x[5] - L.el0[0]) ** 2 + 50 * Math.max(0, -x[5] - 1.4) ** 2 + 0.05 * (x[5] - L.el0[0]) ** 2;
        return c;
      };
      const x = up ? [0.8, -1.6, -0.6, -0.6, -0.4, L.el0[0]] : [-1.0, -1.4, -0.8, -0.8, -0.6, L.el0[0]];
      let best = cost(x), step = 0.4;
      for (let it = 0; it < 400 && step > 1e-3; it++) {
        let improved = false;
        for (let k = 0; k < 6; k++) for (const d of [step, -step]) {
          x[k] += d;
          const c = cost(x);
          if (c < best) { best = c; improved = true; } else x[k] -= d;
        }
        if (!improved) step *= 0.5;
      }
      return { F: x[0], C: x[5], B: [x[1], x[2], x[3], x[4]] };
    };
    for (const L of cfg.legs) { L.curlBack = solve(L, 'back'); L.curlSide = solve(L, 'side'); L.curlUp = solve(L, 'up'); }
  }
  // mouth: between the chelicera tips
  cfg.mouth = cfg.chels[0].tip.clone().add(cfg.chels[1].tip).multiplyScalar(0.5);
  return cfg;
}

// ------------------------------------------------------------------------------------------------
// swing path profiles (see the header): horizontal progress with short linear speed ramps; vertical
// hump: constant climb, a rounded apex, constant descent
function progress(u, a) {
  const vm = 1 / (1 - a);
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < a) return (vm * u * u) / (2 * a);
  if (u > 1 - a) { const r = 1 - u; return 1 - (vm * r * r) / (2 * a); }
  return vm * (u - a / 2);
}
function hump(u) {
  // vertical speed +c on [0, u1], easing linearly to -c2 over [u1, u2], -c2 on [u2, 1]; c2 makes the
  // path end at 0; normalised to a peak of 1
  if (u <= 0 || u >= 1) return 0;
  const u1 = 0.3, u2 = 0.6, T = u2 - u1;
  const c2 = (u1 + 0.5 * T) / (0.5 * T + (1 - u2));
  const peak = u1 + (0.5 * T) / (1 + c2);
  let y;
  if (u < u1) y = u;
  else if (u < u2) { const t = u - u1; y = u1 + t - ((1 + c2) * t * t) / (2 * T); }
  else y = c2 * (1 - u);
  return y / peak;
}

// ------------------------------------------------------------------------------------------------
// actions
const POSTURES = new Set(['sit', 'lie', 'sleep', 'death']);
const ONESHOTS = new Set(['jump', 'attack', 'hit', 'eat', 'drink']);
export const SPIDER_ACTIONS = ['idle', 'jump', 'sit', 'lie', 'sleep', 'eat', 'drink', 'attack', 'hit', 'death', 'stand'];

function createParams() {
  return {
    gaitW: 1, speedScale: 1, crouch: 0, drop: 0, pitch: 0, roll: 0, fwd: 0, side: 0, yaw: 0,
    legIn: 0, drawIn: 0, tuck: 0, curl2: 0, raise: new Float32Array(8), hold: new Float32Array(8), curl: 0, air: 0, lean: 0,
    palpRaise: 0, palpReach: 0, palpWork: 0, palpDown: 0, palpFold: 0,
    chelOpen: 0, chelWork: 0, fangOpen: 0, abdPitch: 0, abdDown: 0, breathRate: 1, breathAmp: 1,
    flip: 0, reviving: 0, pullIn: 0, flipSide: 1, flipAngle: Math.PI, dead: 0, lookW: 1, look: null, twitch: 1,
  };
}
function resetParams(P) {
  P.gaitW = 1; P.speedScale = 1; P.crouch = P.drop = P.pitch = P.roll = P.fwd = P.side = P.yaw = 0;
  P.legIn = 0; P.drawIn = 0; P.tuck = 0; P.curl2 = 0; P.raise.fill(0); P.hold.fill(0); P.curl = P.tuck = P.air = P.lean = 0;
  P.palpRaise = P.palpReach = P.palpWork = P.palpDown = P.palpFold = 0;
  P.chelOpen = P.chelWork = P.fangOpen = P.abdPitch = P.abdDown = 0; P.breathRate = 1; P.breathAmp = 1;
  P.flip = 0; P.reviving = 0; P.pullIn = 0; P.dead = 0; P.lookW = 1; P.look = null; P.twitch = 1;
}
const mx = (P, k, v, w) => { P[k] += (v - P[k]) * w; };
const mxA = (arr, i, v, w) => { arr[i] += (v - arr[i]) * w; };

const POSTURE_DEFS = {
  // body lowered, abdomen resting on the ground, legs a little drawn in
  sit: {
    fadeIn: 0.7, fadeOut: 0.6,
    apply(P, w) { mx(P, 'gaitW', 0, w); mx(P, 'crouch', 0.5, w); mx(P, 'legIn', 0.25, w); mx(P, 'abdDown', 1, w); mx(P, 'palpDown', 0.4, w); mx(P, 'pitch', 0.14, w); },
  },
  // flat on the ground, legs drawn in
  lie: {
    fadeIn: 0.9, fadeOut: 0.8,
    apply(P, w) { mx(P, 'gaitW', 0, w); mx(P, 'crouch', 0.8, w); mx(P, 'legIn', 0.5, w); mx(P, 'abdDown', 1, w); mx(P, 'palpDown', 0.8, w); mx(P, 'breathRate', 0.8, w); },
  },
  // lie with the legs pulled in tight, palps folded, slow breathing
  sleep: {
    fadeIn: 1.1, fadeOut: 1.0,
    apply(P, w, inst, e) {
      POSTURE_DEFS.lie.apply(P, w);
      const c = smooth(0.4, 2.0, inst.t) * w;
      const tuck = e.cfg.actions.sleep?.tuck ?? 0.8;
      mx(P, 'crouch', 0.92, c); mx(P, 'legIn', 0.5 + 0.35 * tuck, c); mx(P, 'palpFold', 1, c);
      // the claws are drawn in along the ground, the front legs folded against the chelicerae
      mx(P, 'drawIn', tuck, c); mx(P, 'pullIn', tuck, c);
      mx(P, 'breathRate', 0.45, c); mx(P, 'breathAmp', 1.3, c); mx(P, 'twitch', 0.1, c); mx(P, 'lookW', 0, c);
      for (let i = 0; i < 8; i++) if (e.legs[i].def.i === 1) mxA(P.hold, i, 0.3 * tuck, c);
    },
  },
  // hydraulic collapse: the legs curl under the body, it drops, then rolls onto its back or side
  death: {
    fadeIn: 0.2, fadeOut: 3.0,
    apply(P, w, inst) {
      const t = inst.t;
      mx(P, 'gaitW', 0, w); mx(P, 'dead', 1, w);
      // the legs lose pressure: the body sinks and the claws are drawn in, then the legs fold up
      // (reviving runs the other way round: it rolls back first, then uncurls, then stands up)
      mx(P, 'drawIn', smooth(0.05, 0.6, t), smooth(0, 0.35, w));
      // (no dorsal tuck any more: the legs flex ventrally at once, the body hunches on them and tips over)
      // on its back the legs contract further, ventrally (over the sternum)
      mx(P, 'curl2', smooth(0.3, 1.3, t), smooth(0.3, 0.8, w));
      mx(P, 'crouch', smooth(0, 0.35, t), smooth(0, 0.45, w));
      const f = smooth(1.0, 2.0, t);
      const settle = t > 2.0 ? Math.exp(-(t - 2.0) * 5) * Math.sin((t - 2.0) * 14) * 0.05 : 0;
      mx(P, 'flip', clamp(f - settle, 0, 1.05), smooth(0.6, 1, w));
      P.flipSide = inst.side; P.flipAngle = inst.flipAngle;
      if (inst.target < 0.5) P.reviving = 1;
      mx(P, 'palpFold', 1, w); mx(P, 'fangOpen', 0.3, w); mx(P, 'breathAmp', 0, w); mx(P, 'breathRate', 0, w);
      mx(P, 'twitch', 0, w); mx(P, 'lookW', 0, w); mx(P, 'abdDown', 0, w);
    },
  },
};

const ONESHOT_DEFS = {
  // pounce: crouch, push off with legs III-IV, fly with the front legs raised to grab, land
  jump: {
    start(inst, e) {
      const cfg = e.cfg, o = cfg.actions.jump || {};
      inst.tc = (o.crouch ?? 0.22) * cfg.sq;
      const h = (o.height ?? 0.014) * cfg.s;
      // apex h above the take-off height, counting the push-off and coast rise (vy (PUSH / 2 + COAST))
      const k = PUSH / 2 + COAST;
      inst.vy = G_ACC * (-k + Math.sqrt(k * k + (2 * h) / G_ACC));
      const T = (2 * inst.vy) / G_ACC + PUSH * 0.5 + 2 * COAST;
      let dist = (o.distance ?? 0.05) * cfg.s;
      if (inst.opts.target) { const t = inst.opts.target; dist = clamp(Math.hypot(t.x - e.pos.x, t.z - e.pos.z), 0.3 * dist, dist * 2); }
      inst.vh = Math.max(e.speed, dist / T);
      inst.phase = 'crouch'; inst.dur = Infinity;
    },
    update(inst, dt, e) {
      if (inst.phase === 'crouch' && inst.t >= inst.tc) { inst.phase = 'air'; inst.tAir = inst.t; e.takeOff(inst.vy, inst.vh); }
      if (inst.phase === 'air' && inst.t - inst.tAir > 3) e.touchDown();
      // pose weights are states with finite rates (the flight of a small spider lasts ~0.1 s)
      inst.aw = clamp((inst.aw || 0) + (inst.phase === 'air' ? dt / 0.1 : inst.phase === 'land' ? -dt / 0.25 : 0), 0, 1);
      return inst.phase === 'land' && inst.t - inst.tLand > 0.45;
    },
    onLand(inst) { inst.phase = 'land'; inst.tLand = inst.t; },
    apply(P, w, inst, e) {
      const aw = (inst.aw || 0) * w;
      const pre = inst.phase === 'crouch' ? smooth(0, inst.tc, inst.t) : inst.phase === 'air' ? 1 : 1 - smooth(0, 0.3, inst.t - inst.tLand);
      const land = inst.phase === 'land' ? envelope(inst.t - inst.tLand, 0.45, 0.06, 0.35) : 0;
      const cr = inst.phase === 'crouch' ? smooth(0, inst.tc, inst.t) : inst.phase === 'air' ? 1 - smooth(0, PUSH + 0.03, inst.t - inst.tAir) : 0;
      mx(P, 'crouch', 0.55, cr * w); mx(P, 'crouch', 0.4, land * w); mx(P, 'pitch', 0.1, pre * w * (1 - aw));
      mx(P, 'air', 1, aw);
      // landing contacts are not gait contacts (the claws settle while the body brakes)
      if (inst.phase === 'land') mx(P, 'gaitW', 0, (1 - smooth(0.3, 0.45, inst.t - inst.tLand)) * w);
      mx(P, 'palpRaise', 1, Math.max(smooth(0, 1, aw), 0.5 * pre) * w); mx(P, 'fangOpen', 1, Math.max(aw, 0.4 * pre) * w); mx(P, 'chelOpen', 0.8, aw);
      for (let i = 0; i < 8; i++) {
        const li = e.legs[i].def.i;
        // front legs lift already in the crouch and reach up and forward to grab; after landing they
        // come down onto the prey
        if (li === 1) { mxA(P.raise, i, 1, Math.max(aw, 0.35 * pre) * w); mxA(P.hold, i, 0.6, land * (1 - aw) * w); }
        else if (li === 2) mxA(P.raise, i, 0.6, aw);
      }
    },
  },
  // threat display (front legs raised, fangs out, body reared), then a lunge with a fang strike
  attack: {
    start(inst, e) {
      const o = e.cfg.actions.attack || {};
      inst.threat = (o.threat ?? 0.7) * (inst.opts.duration ? inst.opts.duration / 1.7 : 1);
      inst.dur = inst.threat + 1.0;
      inst.hit = false;
      if (inst.opts.target && !e.input.follow) {
        const t = inst.opts.target;
        const want = Math.atan2(t.x - e.pos.x, t.z - e.pos.z);
        if (Math.abs(angDiff(e.heading, want)) > 0.2) e._turnTo = want;
      }
    },
    update(inst, dt, e) {
      const tl = inst.t - inst.threat;
      if (!inst.hit && tl >= 0.16) {
        inst.hit = true;
        const cfg = e.cfg;
        const p = e.localToWorld(cfg.mouth.x, cfg.mouth.y - 0.002 * cfg.s, cfg.mouth.z + 0.003 * cfg.s, new THREE.Vector3());
        e.emit('attackHit', { position: p, direction: e.forward(e.heading, new THREE.Vector3()), style: 'bite' });
      }
      return inst.t >= inst.dur;
    },
    apply(P, w, inst, e) {
      const o = e.cfg.actions.attack || {}, cfg = e.cfg;
      const t = inst.t, T = inst.threat, tl = t - T;
      const rear = smooth(0, Math.min(0.35, T), t) * (1 - smooth(0.05, 0.2, tl) * 0.8) * (1 - smooth(0.45, 0.95, tl));
      const lunge = smooth(0, 0.14, tl) * (1 - smooth(0.4, 0.9, tl));
      const still = 1 - 0.75 * smooth(0, 0.3 * cfg.maxSpeed, e.speed); // on the run it rears less
      mx(P, 'pitch', ((o.rear ?? 0.32) * rear - 0.12 * lunge) * still, w);
      mx(P, 'crouch', 0.15 * rear + 0.25 * lunge, w);
      // the lunge is a body thrust over planted claws (smaller on the run: the gait carries it)
      mx(P, 'fwd', (o.lunge ?? 0.012) * cfg.s * lunge * (1 - smooth(0, 0.3 * cfg.maxSpeed, e.speed)), w);
      mx(P, 'fangOpen', smooth(0.1, 0.4, t) * (1 - smooth(0.3, 0.6, tl) * 0.7) * (1 - smooth(0.7, 0.95, tl)), w);
      mx(P, 'chelOpen', 0.8 * rear + 0.3 * lunge, w);
      mx(P, 'palpRaise', 0.9 * rear, w);
      mx(P, 'abdPitch', -0.15 * rear, w);
      const strike = lunge * (1 - smooth(0.2, 0.5, tl));
      for (let i = 0; i < 8; i++) {
        const li = e.legs[i].def.i;
        if (li === 1) { mxA(P.raise, i, rear, w); mxA(P.hold, i, strike, w); }
        else if (li === 2) mxA(P.raise, i, (o.raise2 ?? 0.45) * rear, w);
      }
    },
  },
  // flinch, then scuttle back
  hit: {
    start(inst, e) {
      const cfg = e.cfg;
      inst.dur = 0.9;
      const d = inst.opts.direction;
      const dir = tv();
      if (d && d.lengthSq() > 1e-8) dir.set(d.x, 0, d.z).normalize(); else e.forward(e.heading, dir).negate();
      // scuttle away from the blow, mostly backwards
      const back = e.forward(e.heading, tv()).negate();
      dir.lerp(back, 0.5).normalize();
      e.push.addScaledVector(dir, 5.5 * cfg.bodyLen / Math.max(0.5, cfg.sq));
    },
    update(inst) { return inst.t >= inst.dur; },
    apply(P, w, inst, e) {
      const t = inst.t;
      const fl = envelope(t, 0.9, 0.05, 0.55);
      const jerk = smooth(0, 0.12, t) * (1 - smooth(0.15, 0.45, t));
      mx(P, 'crouch', 0.3 * fl, w); mx(P, 'pitch', 0.18 * jerk, w); mx(P, 'fwd', -0.06 * e.cfg.bodyLen * jerk, w);
      mx(P, 'palpRaise', 0.6 * fl, w); mx(P, 'abdPitch', 0.12 * jerk, w);
      for (let i = 0; i < 8; i++) if (e.legs[i].def.i === 1) mxA(P.raise, i, 0.45 * jerk, w);
    },
  },
  // prey held under the chelicerae by legs I and the palps; chelicerae working
  eat: {
    start(inst) { inst.dur = inst.opts.duration ?? (inst.opts.loop ? Infinity : 4); },
    update(inst) { return inst.t >= inst.dur; },
    apply(P, w, inst, e) {
      const a = smooth(0, 0.5, inst.t) * w;
      mx(P, 'crouch', 0.3, a); mx(P, 'pitch', -0.06, a);
      mx(P, 'palpWork', 1, a); mx(P, 'chelWork', 1, a); mx(P, 'fangOpen', 0.35, a); mx(P, 'palpReach', 0.3, a);
      for (let i = 0; i < 8; i++) if (e.legs[i].def.i === 1) mxA(P.hold, i, 0.7, a);
    },
  },
  // mouthparts down to the ground / water
  drink: {
    start(inst) { inst.dur = inst.opts.duration ?? (inst.opts.loop ? Infinity : 3); },
    update(inst) { return inst.t >= inst.dur; },
    apply(P, w, inst) {
      const a = smooth(0, 0.6, inst.t) * w;
      mx(P, 'crouch', 0.35, a); mx(P, 'pitch', -0.2, a); mx(P, 'palpRaise', -0.2, a); mx(P, 'palpReach', 0.5, a);
      mx(P, 'chelWork', 0.25, a); mx(P, 'chelOpen', 0.2, a); mx(P, 'abdPitch', 0.05, a);
    },
  },
};

class SpiderActions {
  constructor(engine) {
    this.e = engine;
    this.names = SPIDER_ACTIONS.slice();
    this.postures = [];
    this.oneshots = [];
    this.posture = 'stand';
    this.standReq = null;
    this.idle = { w: 0, lookT: 1, look: new THREE.Vector3(), hasLook: false, twitchT: 2, palpT: 1 };
  }
  holdsStill() { for (const p of this.postures) if (p.target > 0 || p.w > 0.02) return true; return false; }
  // automatic stand-up (asked to move): never revives a dead spider
  requestStand() { if (!this.standReq && !this.dead()) this.play('stand'); }
  // arbitration: a new one-shot interrupts the running
  // ones (fade out, 'interrupted'); a jump in the air is committed (only a hit layers over it); a
  // posture ends the one-shots (except a hit); stop() ends everything but death and never cuts a
  // jump in the air; dead: only hit is taken. Promises resolve 'done' | 'interrupted' | 'stopped' |
  // 'refused'.
  committed(a) { return !a.stopping && a.name === 'jump' && this.e.air.active; }
  end(a, reason) { if (a.stopping) return; a.stopping = true; a.reason = reason; }
  current() {
    for (const a of this.oneshots) if (!a.stopping) return a.name;
    for (const p of this.postures) if (p.target > 0) return p.name;
    return this.standReq ? 'stand' : null;
  }
  clear() { for (const a of [...this.postures, ...this.oneshots]) { a.resolve?.('stopped'); a.resolveIn?.('stopped'); } this.postures.length = 0; this.oneshots.length = 0; }
  dead() { for (const p of this.postures) if (p.name === 'death' && p.target > 0) return true; return false; }

  play(name, opts = {}) {
    const e = this.e;
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
    if (POSTURES.has(name)) {
      const cur = this.postures.find((p) => p.target > 0);
      if (cur && cur.name === 'death' && name !== 'death') return Promise.resolve('refused');
      if (cur && cur.name === name) return cur.promiseIn;
      if (name !== 'death' && this.oneshots.some((a) => this.committed(a))) return Promise.resolve('refused');
      for (const p of this.postures) if (p.target > 0) { p.target = 0; p.resolveIn?.('interrupted'); }
      if (this.standReq) { this.standReq.resolve('interrupted'); this.standReq = null; }
      for (const a of this.oneshots) if (a.name !== 'hit' && !this.committed(a)) this.end(a, 'interrupted');
      const def = POSTURE_DEFS[name];
      let side = opts.side ?? (e.rand() < 0.5 ? -1 : 1);
      if (opts.direction && name === 'death') { const d = opts.direction; side = (d.x * Math.cos(e.heading) - d.z * Math.sin(e.heading)) > 0 ? 1 : -1; }
      const inst = { name, t: 0, w: 0, target: 1, fadeIn: def.fadeIn / (opts.speed || 1), fadeOut: def.fadeOut, side, opts, reached: false };
      // death: on its back most of the time, sometimes on its side
      inst.flipAngle = opts.onSide ?? (e.rand() < 0.35) ? Math.PI * 0.52 : Math.PI * (0.9 + 0.08 * e.rand());
      const prev = this.postures.find((p) => p.name === 'lie');
      if (prev && name === 'sleep') { inst.w = prev.w; prev.w = 0; this.postures = this.postures.filter((p) => p !== prev); }
      inst.promiseIn = new Promise((r) => { inst.resolveIn = r; });
      this.postures.push(inst);
      e.emit('actionStart', { name });
      if (name === 'death') e.emit('death', { position: e.pos.clone() });
      return inst.promiseIn;
    }
    if (!ONESHOTS.has(name)) return Promise.reject(new Error(`procedural-animals: unknown action "${name}"`));
    if (this.dead() && name !== 'hit') return Promise.resolve('refused');
    if (this.holdsStill() && (name === 'jump' || name === 'attack')) return this.play('stand').then((r) => (r === 'refused' ? r : this.play(name, opts)));
    // arbitration: a new one-shot interrupts the running ones; in the air only a hit is taken
    if (e.air.active || this.oneshots.some((a) => this.committed(a))) {
      if (name !== 'hit') return Promise.resolve('refused');
      for (const a of this.oneshots) if (a.name === 'hit') this.end(a, 'interrupted');
    } else for (const a of this.oneshots) this.end(a, 'interrupted');
    const inst = { name, t: 0, w: 0, dur: 1, stopping: false, opts, fade: name === 'hit' ? 0.06 : 0.15, speed: opts.speed || 1 };
    ONESHOT_DEFS[name].start(inst, e);
    inst.promise = new Promise((r) => { inst.resolve = r; });
    this.oneshots.push(inst);
    e.emit('actionStart', { name });
    return inst.promise;
  }

  stop(name) {
    for (const a of this.oneshots) if ((!name || a.name === name) && !this.committed(a)) this.end(a, 'stopped');
    if (!name || POSTURES.has(name)) if (this.postures.some((p) => p.target > 0 && (name ? p.name === name : p.name !== 'death'))) this.play('stand');
  }
  onLand() { for (const a of this.oneshots) if (ONESHOT_DEFS[a.name].onLand) ONESHOT_DEFS[a.name].onLand(a, this.e); }

  update(dt) {
    const e = this.e, P = e.P;
    resetParams(P);
    for (const p of this.postures) {
      p.t += dt;
      const rate = p.target > p.w ? 1 / p.fadeIn : 1 / p.fadeOut;
      p.w = clamp(p.w + clamp(p.target - p.w, -rate * dt, rate * dt), 0, 1);
      if (!p.reached && p.target > 0 && p.w >= 1 && (p.name !== 'death' || p.t > 2.0) && (p.name !== 'sleep' || p.t > 2.0)) { p.reached = true; p.resolveIn('done'); e.emit('actionEnd', { name: p.name }); }
    }
    for (let i = this.postures.length - 1; i >= 0; i--) { const p = this.postures[i]; if (!(p.target > 0 || p.w > 0)) this.postures.splice(i, 1); }
    let active = null;
    for (const p of this.postures) if (p.target > 0) active = p;
    this.posture = active ? (active.name === 'death' ? 'dead' : active.name) : this.postures.length ? 'standing-up' : 'stand';
    if (this.standReq && !this.postures.length) { this.standReq.resolve('done'); this.standReq = null; e.emit('actionEnd', { name: 'stand' }); }
    // idle
    const still = e.speed < 0.08 * e.cfg.maxSpeed && !e.input.follow && e.push.lengthSq() < 1e-6 && e.pushV.lengthSq() < 1e-6;
    let busy = false;
    for (const a of this.oneshots) if (!a.stopping && a.name !== 'hit') busy = true;
    const idleT = still && !this.postures.length && !busy ? 1 : 0;
    const id = this.idle;
    id.w += clamp(idleT - id.w, -dt * 2, dt * 0.8);
    this.applyIdle(P, id.w, dt);
    for (const p of this.postures) { const w = p.w * p.w * (3 - 2 * p.w); POSTURE_DEFS[p.name].apply(P, w, p, e); }
    const wantsToMove = e.wantSpeed > 0.02 * e.cfg.maxSpeed || !!e.input.follow;
    for (const a of this.oneshots) {
      if (wantsToMove && (a.name === 'eat' || a.name === 'drink')) this.end(a, 'interrupted');
      a.t += dt * a.speed;
      if (!a.stopping && ONESHOT_DEFS[a.name].update(a, dt * a.speed, e)) this.end(a, 'done');
      const fadeOut = a.name === 'jump' && a.reason === 'done' ? 0.05 : a.name === 'attack' ? 0.25 : a.fade;
      if (a.stopping) a.w = Math.max(0, a.w - dt / fadeOut); else a.w = Math.min(1, a.w + dt / a.fade);
      const w = a.w * a.w * (3 - 2 * a.w);
      if (w > 0) ONESHOT_DEFS[a.name].apply(P, w, a, e);
    }
    for (let i = this.oneshots.length - 1; i >= 0; i--) {
      const a = this.oneshots[i];
      if (a.stopping && a.w <= 0) { this.oneshots.splice(i, 1); a.resolve(a.reason || 'done'); e.emit('actionEnd', { name: a.name, reason: a.reason || 'done' }); }
    }
    if (e.air.active) { let air = false; for (const a of this.oneshots) if (a.name === 'jump') air = true; if (!air) e.touchDown(); }
  }

  applyIdle(P, w, dt) {
    const e = this.e, id = this.idle, cfg = e.cfg;
    if (w <= 0.001) { id.hasLook = false; return; }
    // sit-and-wait: front legs a little raised now and then
    const rf = cfg.idle.raiseFront * (0.5 + 0.5 * Math.sin(e.time * 0.21 + 1.3));
    for (let i = 0; i < 8; i++) if (e.legs[i].def.i === 1) mxA(P.raise, i, rf, w);
    // leg twitch: one leg lifts a touch and sets down again
    id.twitchT -= dt;
    if (id.twitchT <= 0 && w > 0.9) {
      id.twitchT = (2.5 + e.rand() * 5) / Math.max(0.05, cfg.idle.twitch);
      e.twitchLeg(Math.floor(e.rand() * 8));
    }
    // look around
    if (!e.input.look) {
      id.lookT -= dt;
      if (id.lookT <= 0) {
        id.lookT = 1.5 + e.rand() * 3;
        if (e.rand() < 0.35) id.hasLook = false;
        else {
          const a = e.heading + (e.rand() - 0.5) * 2 * cfg.idle.look;
          const d = 10 * cfg.bodyLen;
          const px = e.pos.x + Math.sin(a) * d, pz = e.pos.z + Math.cos(a) * d;
          id.look.set(px, e.terrainH(px, pz) + (e.rand() * 3) * cfg.bodyLen, pz);
          id.hasLook = true;
        }
      }
      if (id.hasLook) { P.look = id.look; P.lookW = w; }
    }
  }
}

// ------------------------------------------------------------------------------------------------
export function createSpiderMotion(ctx) { return new SpiderMotion(ctx); }

export class SpiderMotion {
  constructor({ species, data, skeleton, ground, water, position, heading = 0, emit }) {
    this.species = species;
    this.sk = skeleton;
    this.cfg = resolveConfig(species, data, skeleton);
    const cfg = this.cfg;
    this.ground = ground || (() => 0);
    this.water = water || null;
    this.emit = emit || (() => {});
    this.rand = prng((data.seed || 1) * 7919 + 29);
    this.input = { speed: 0, heading, climb: 0, look: null, follow: null, target: null, targetSpeed: cfg.gears.run || 0.1, crouch: 0, gait: null };
    this.pos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = heading; this.speed = 0; this.yawRate = 0; this.phase = 0; this.time = 0; this.lod = 0; this.frame = 0;
    this.wantSpeed = 0; this.wantHeading = heading;
    this.push = new THREE.Vector3(); this.pushV = new THREE.Vector3();
    this.moveDir = new THREE.Vector3(0, 0, 1);
    this.air = { active: false, t: 0, vy: 0, vh: 0, y0: 0, T: 0, dir: new THREE.Vector3() };
    this.state = {
      position: this.pos, heading, speed: 0, velocity: this.velocity, gait: 'stand', grounded: true,
      action: null, posture: 'stand', eyelid: 0, lookTarget: null,
      stats: { gait: 'stand', freq: 0, duty: 1 },
      legs: LEG_KEYS.map((key) => ({ key, stance: true, contact: new THREE.Vector3() })),
    };
    this.headPose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
    this.debug = { targets: Array.from({ length: 8 }, () => new THREE.Vector3()) };
    this.gaits = [...new Set(cfg.gaits.map((g) => g.name))];
    this.gears = cfg.gears;
    this.gait = { name: 'walk', f: 1, D: 0.7, lift: 0.003, bob: 0, sway: 0, off: new Float64Array(8) };
    // springs
    this.hS = new Spring(0); this.pitchS = new Spring(0); this.rollS = new Spring(0);
    this.lookYawS = new Spring(0); this.lookPitchS = new Spring(0);
    this.abdPitchS = new Spring(0); this.abdYawS = new Spring(0);
    this.supportS = new Spring(0); this.speedS = new Spring(0);
    this.breath = 0; this._lift = 0; this.brakeA = 0;
    this.lastVel = new THREE.Vector3(); this.accelV = new THREE.Vector3();
    // legs
    this.legs = cfg.legs.map((L) => ({
      def: L, state: 'stance', mode: 'gait',
      plant: new THREE.Vector3(), lift: new THREE.Vector3(), land: new THREE.Vector3(), landBase: new THREE.Vector3(), tip: new THREE.Vector3(),
      swingT: 0, swingDur: 0.1, liftH: 0.002, hMax: 0, stanceTime: 0, prevPhase: 0, windowUsed: false, heel: 0,
      az: new Float64Array(7), el: new Float64Array(7), jp: Array.from({ length: 8 }, () => new THREE.Vector3()),
      airFrom: new THREE.Vector3(), airRoot: new THREE.Vector3(), airT: 1, carry0: 0, swingInit: false, liftAz: new Float64Array(7), liftEl: new Float64Array(7), rawAz: new Float64Array(7), rawEl: new Float64Array(7), ikEl: new Float64Array(7), ikAz: new Float64Array(7),
    }));
    this.palpState = cfg.palpDefs.map(() => ({ twitch: new Float64Array(6), tgt: new Float64Array(6), twT: 0.5, az: new Float64Array(6), el: new Float64Array(6), jp: Array.from({ length: 7 }, () => new THREE.Vector3()) }));
    // frames (preallocated)
    this.qB = new THREE.Quaternion(); this.qBinv = new THREE.Quaternion(); this.upB = new THREE.Vector3(0, 1, 0); this.root = new THREE.Vector3();
    this.qAbd = new THREE.Quaternion(); this.qPed = new THREE.Quaternion();
    this._e = new THREE.Euler(); this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._q3 = new THREE.Quaternion();
    this._qc1 = new THREE.Quaternion(); this._qc2 = new THREE.Quaternion(); this._qc3 = new THREE.Quaternion();
    this._scale = new THREE.Vector3(1, 1, 1); this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.P = createParams();
    this.actionsLayer = new SpiderActions(this);
    this.actions = this.actionsLayer.names;
    this.attachmentPoints = this._attachments(data);
    this.reset(position || new THREE.Vector3(), heading);
  }

  _attachments(data) {
    const cfg = this.cfg, J = cfg.J;
    const at = (bone, p) => {
      const i = data.bones.findIndex((b) => b.name === bone);
      if (i < 0) return null;
      const inv = this.sk.inverses ? this.sk.inverses[i] : this.sk.bind[i].clone().invert();
      return { bone, local: new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).premultiply(inv) };
    };
    const mouth = cfg.mouth.clone().add(cfg.root);
    let headP = J.ceph.clone().lerp(J.front, 0.6);
    if (data.eyes?.length) { headP = new THREE.Vector3(); for (const e of data.eyes) headP.add(new THREE.Vector3(...e.c)); headP.multiplyScalar(1 / data.eyes.length); }
    this._eyeLocal = headP.clone().sub(cfg.root);
    const back = cfg.abdC.clone().add(cfg.root); back.y += cfg.abdR * 0.9;
    const out = { mouth: at('head', mouth), head: at('head', headP), back: at('abdomen', back) };
    for (const k of Object.keys(out)) if (!out[k]) delete out[k];
    return out;
  }

  // ----------------------------------------------------------------- frames
  forward(h, out) { return out.set(Math.sin(h), 0, Math.cos(h)); }
  left(h, out) { return out.set(Math.cos(h), 0, -Math.sin(h)); }
  terrainH(x, z) { const h = this.ground(x, z); return Number.isFinite(h) ? h : 0; }
  localToWorld(x, y, z, out) { return out.set(x, y, z).applyQuaternion(this.qB).add(this.root); }
  // heading frame (no pitch / roll) about the ground point p
  headingToWorld(lx, lz, h, px, pz, out) {
    const sh = Math.sin(h), ch = Math.cos(h);
    return out.set(px + ch * lx + sh * lz, 0, pz - sh * lx + ch * lz);
  }

  reset(p, heading = this.heading) {
    this.pos.set(p.x, this.terrainH(p.x, p.z), p.z);
    this.heading = heading; this.input.heading = heading; this.wantHeading = heading;
    this.speed = 0; this.yawRate = 0; this.velocity.set(0, 0, 0); this.lastVel.set(0, 0, 0);
    this.gaitAt(0);
    for (const leg of this.legs) {
      this.neutral(leg, 0, 0, 0, leg.plant);
      leg.state = 'stance'; leg.stanceTime = 1;
    }
    this.hS.reset(this.cfg.rootH); this.pitchS.reset(0); this.rollS.reset(0);
    this._fitTerrain();
    this.hS.reset(this._fit.h + this.cfg.rootH * this.cfg.stance.height);
    this.pitchS.reset(this._fit.pitch); this.rollS.reset(this._fit.roll);
  }

  // ----------------------------------------------------------------- gait table
  gaitAt(vn) {
    const T = this.cfg.gaits, g = this.gait;
    let i = 0;
    while (i < T.length - 2 && vn > T[i + 1].v) i++;
    const a = T[i], b = T[Math.min(i + 1, T.length - 1)];
    const t = a === b ? 0 : smooth(0, 1, (vn - a.v) / (b.v - a.v));
    g.name = t < 0.5 ? a.name : b.name;
    g.f = lerp(a.f, b.f, t); g.D = lerp(a.D, b.D, t);
    g.lift = lerp(a.lift, b.lift, t); g.bob = lerp(a.bob, b.bob, t); g.sway = lerp(a.sway, b.sway, t);
    for (let j = 0; j < 8; j++) g.off[j] = wrap01(a.off[j] + d01(a.off[j], b.off[j]) * t);
    if (vn > b.v) g.f = b.f * Math.min(1.3, vn / Math.max(b.v, 1e-6));
    const cfg = this.cfg;
    g.f /= cfg.sq;
    g.lift *= cfg.s; g.bob *= cfg.s;
    return g;
  }

  // neutral claw position (world, on the terrain + tip height) tAhead seconds from now, plus a lead
  // along the velocity (half a stance sweep) and the yaw of the turn
  neutral(leg, tAhead, lead, yawLead, out) {
    const L = leg.def, P = this.P;
    const hp = this.heading + clamp(this.yawRate * tAhead + yawLead, -0.45, 0.45);
    const bx = this.pos.x + this.velocity.x * tAhead, bz = this.pos.z + this.velocity.z * tAhead;
    const k = 1 - 0.22 * P.legIn * (L.i === 1 || L.i === 4 ? 1.2 : 1);
    this.headingToWorld(L.neutral.x * k, L.neutral.z * k, hp, bx, bz, out);
    if (lead) { const vl = Math.hypot(this.velocity.x, this.velocity.z); if (vl > 1e-6) { out.x += (this.velocity.x / vl) * lead; out.z += (this.velocity.z / vl) * lead; } }
    out.y = this.terrainH(out.x, out.z) + L.tipY;
    return out;
  }

  // ----------------------------------------------------------------- public API
  play(name, opts) { return this.actionsLayer.play(name, opts || {}); }
  stop(name) { this.actionsLayer.stop(name); }
  setLod(level) { this.lod = clamp(level | 0, 0, 2); return this; }
  dispose() { this.actionsLayer.clear(); }

  update(dt) {
    if (!(dt > 1e-4) || !Number.isFinite(dt)) dt = 1e-4;
    this.frame++;
    // LOD 2 (crowds): the whole rig runs at half rate (a spider in a crowd is a few pixels tall)
    if (this.lod === 2 && !this.input.follow) {
      this._lodDt = (this._lodDt || 0) + dt;
      if ((this.frame & 1) === 1 && this._lodDt < 1 / 24) return;
      dt = this._lodDt; this._lodDt = 0;
    }
    dt = Math.min(dt, 1 / 20);
    this.drive(dt);
    this.actionsLayer.update(dt);
    const sub = dt > 1 / 70 && this.lod === 0 ? 2 : 1;
    for (let i = 0; i < sub; i++) this.step(dt / sub);
    this.pose(dt);
    this.publish();
  }

  // steering input -> wanted speed / heading
  drive(dt) {
    const inp = this.input, cfg = this.cfg;
    this.wantSpeed = clamp(inp.speed || 0, 0, cfg.maxSpeed);
    this.wantHeading = inp.heading ?? this.heading;
    if (inp.target && !inp.follow) {
      const dx = inp.target.x - this.pos.x, dz = inp.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const stopR = 0.4 * cfg.bodyLen + 0.05 * this.speed;
      if (d < stopR) { inp.target = null; inp.speed = 0; this.wantSpeed = 0; this.emit('arrive', {}); }
      else {
        const want = Math.atan2(dx, dz);
        inp.heading = want; this.wantHeading = want;
        const ang = Math.abs(angDiff(this.heading, want));
        const brake = Math.sqrt(Math.max(0, 2 * cfg.decel * 0.7 * (d - stopR)));
        this.wantSpeed = Math.min(inp.targetSpeed || cfg.gears.run, cfg.maxSpeed, brake + 0.01 * cfg.sq, ang > 1.0 ? cfg.gears.walk || 0.05 : 1e9);
      }
    }
    if (this.actionsLayer.holdsStill()) {
      if (this.wantSpeed > 0.02 * cfg.maxSpeed && !inp.follow) this.actionsLayer.requestStand();
      this.wantSpeed = 0; this.wantHeading = this.heading; this._turnTo = undefined;
    } else if (!inp.follow && this.wantSpeed < 0.02 * cfg.maxSpeed) {
      // turn on the spot toward a look target outside the body's twist range (or an attack target)
      const lt = inp.look;
      if (lt) {
        const want = Math.atan2(lt.x - this.pos.x, lt.z - this.pos.z);
        const off = angDiff(this.heading, want);
        if (Math.abs(off) > cfg.look.yaw * 1.1) this._turnTo = want;
        else if (this._turnTo !== undefined && Math.abs(angDiff(this.heading, this._turnTo)) < 0.15) this._turnTo = undefined;
      } else if (this._turnTo !== undefined && Math.abs(angDiff(this.heading, this._turnTo)) < 0.08) this._turnTo = undefined;
      if (this._turnTo !== undefined) { this.wantHeading = this._turnTo; inp.heading = this._turnTo; }
    }
  }

  // ----------------------------------------------------------------- simulation step
  step(dt) {
    this.time += dt;
    this.landT = (this.landT ?? 9) + dt;
    const cfg = this.cfg, inp = this.input, P = this.P, air = this.air;
    const F = this.forward(this.heading, tv());
    if (inp.follow && !air.active) {
      const fv = inp.follow.velocity;
      const vx = fv ? fv.x : 0, vz = fv ? fv.z : 0;
      const sp = Math.hypot(vx, vz);
      this.speed = Math.max(0, this.speedS.step(sp, 12, dt));
      let hT = inp.follow.heading;
      if (hT === null || hT === undefined) hT = sp > 0.1 * cfg.maxSpeed ? Math.atan2(vx, vz) : this.heading;
      const wMax = cfg.turnRate * 1.5;
      const wT = clamp(angDiff(this.heading, hT) * 6, -wMax, wMax);
      this.yawRate += clamp(wT - this.yawRate, -40 * dt, 40 * dt);
      this.heading += this.yawRate * dt;
      this.pos.x = inp.follow.position.x; this.pos.z = inp.follow.position.z;
      this.velocity.set(vx, 0, vz);
    } else {
      let vT = this.wantSpeed * P.speedScale * P.gaitW;
      if (air.active) vT = this.speed;
      const acc = vT > this.speed ? cfg.accel : this.landT < COAST ? 0 : this.landT < 0.2 ? Math.max(cfg.decel, this.landV / 0.1) : cfg.decel;
      this.speed += clamp(vT - this.speed, -acc * dt, acc * dt);
      if (air.active) this.speed = lerp(air.v0, air.vh, Math.min(1, air.t / PUSH));
      const vn = this.speed / cfg.maxSpeed;
      const wMax = air.active ? 0 : Math.min(cfg.turnRate * lerp(0.7, 1, smooth(0, 0.5, vn)), cfg.latAccelMax / Math.max(this.speed, 1e-3)) * (P.gaitW > 0.5 ? 1 : 0);
      const wT = clamp(angDiff(this.heading, this.wantHeading) * 5, -wMax, wMax);
      this.yawRate += clamp(wT - this.yawRate, -30 * dt, 30 * dt);
      this.heading += this.yawRate * dt;
      this.forward(this.heading, F);
      this.velocity.copy(air.active ? air.dir : F).multiplyScalar(this.speed);
      if (this.push.lengthSq() > 1e-12 || this.pushV.lengthSq() > 1e-12) {
        // a shove: the velocity it adds rises over a few frames and decays (no velocity step)
        this.pushV.lerp(this.push, 1 - Math.exp(-dt / 0.05));
        this.velocity.add(this.pushV);
        this.push.multiplyScalar(Math.exp(-dt * 7));
        if (this.push.lengthSq() < 1e-10) this.push.set(0, 0, 0);
        if (this.pushV.lengthSq() < 1e-10 && this.push.lengthSq() === 0) this.pushV.set(0, 0, 0);
      }
      this.pos.x += this.velocity.x * dt; this.pos.z += this.velocity.z * dt;
    }
    if (this.heading > Math.PI * 64 || this.heading < -Math.PI * 64) this.heading = angDiff(0, this.heading);
    this.pos.y = this.terrainH(this.pos.x, this.pos.z);
    this.accelV.copy(this.velocity).sub(this.lastVel).divideScalar(dt);
    this.lastVel.copy(this.velocity);

    // jump flight
    if (air.active) {
      air.t += dt;
      // push-off: the legs extend over PUSH seconds (body accelerating, claws still planted), then
      // the flight is ballistic
      // (the vertical acceleration never flips sign from one frame to the next: push, a coast
      // frame, free fall, and at touchdown another coast frame before the legs brake the fall)
      const t = air.t, Tp = PUSH, Tc = PUSH + COAST;
      if (t < Tp) this.airY = air.y0 + (air.vy * t * t) / (2 * Tp);
      else if (t < Tc) this.airY = air.y0 + air.vy * Tp * 0.5 + air.vy * (t - Tp);
      else { const u = t - Tc; this.airY = air.y0 + air.vy * (Tp * 0.5 + COAST) + air.vy * u - 0.5 * G_ACC * u * u; }
      if (!air.legsOff && t >= Tp * 0.0) {
        air.legsOff = true;
        for (const leg of this.legs) if (leg.state === 'stance') { leg.carry0 = 0; leg.state = 'air'; this.fkTip(leg, leg.rawAz, leg.rawEl, leg.airFrom); leg.airRoot.copy(this.root); leg.airT = 0; leg.liftAz.set(leg.rawAz); leg.liftEl.set(leg.rawEl); }
      }
      // the legs reach the ground well before the body comes down: it is braked on them
      const yLand = this.pos.y + air.h0 + 4.2 * cfg.rootH;
      if (air.t > PUSH + COAST + 0.02 && air.vy - G_ACC * (air.t - PUSH - COAST) < 0 && this.airY <= yLand) this.touchDown();
    }

    // gait
    const vPlanar = Math.hypot(this.velocity.x, this.velocity.z);
    const vEff = Math.max(vPlanar, Math.abs(this.yawRate) * cfg.turnR * 0.8);
    const g = this.gaitAt(vEff / cfg.sq);
    const moving = vEff > 0.012 * cfg.maxSpeed && P.gaitW > 0.5 && !air.active;
    if (moving) this.phase = wrap01(this.phase + g.f * dt);
    const st = this.state.stats;
    st.gait = moving ? g.name : 'stand'; st.freq = moving ? g.f : 0; st.duty = g.D;
    this._moving = moving;
    let swinging = 0, swingSet = -1;
    for (const leg of this.legs) if (leg.state === 'swing') { swinging++; swingSet = leg.def.set; }
    const tStance = g.D / g.f;
    for (let li = 0; li < 8; li++) {
      const leg = this.legs[li], L = leg.def;
      const p = wrap01(this.phase - g.off[li]);
      if (p < leg.prevPhase - 0.5) leg.windowUsed = false;
      if (air.active) {
        leg.prevPhase = p;
        continue;
      }
      if (leg.state === 'stance') {
        leg.stanceTime += dt;
        if (moving) {
          // lift-off: at the end of the stance window, or early if the claw trails too far
          const nb = this.neutral(leg, 0, 0, 0, tv());
          const fx = leg.plant.x - nb.x, fz = leg.plant.z - nb.z;
          const trail = -(fx * this.velocity.x + fz * this.velocity.z) / Math.max(vPlanar, 1e-6);
          const off = Math.hypot(fx, fz);
          const rr = this.coxaDist(leg, leg.plant);
          const caz = Math.abs(this.coxaAz(leg, leg.plant));
          // early lift-off when the claw drifts out of comfortable range (after a minimum stance), at
          // once when it is about to leave the reachable workspace
          const soft = (vPlanar > 1e-4 && trail > 0.32 * L.total) || off > 0.42 * L.total || rr < L.rMin * 0.92 || rr > L.rMax || caz > L.azMax * 1.15;
          const hard = rr < L.rMin * 0.8 || rr > L.rMax * 1.06 || caz > L.azMax * 1.4;
          const drag = (leg.reachErr || 0) > 0.004 * L.total; // the claw can no longer be held: step at once
          // (while shoved, early lifts are capped at four legs so it scrambles on a tetrapod)
          // (just after a landing the claws are wherever they came down: they re-step one tetrapod at a
          // time instead of all together)
          const settle = this.landT < 0.8 && !((swinging === 0 || swingSet === L.set) && swinging < 4);
          const over = drag || hard || (!settle && soft && leg.stanceTime > 0.4 * tStance && (swinging < 4 || this.pushV.lengthSq() < 1e-8));
          if (((p >= g.D && leg.stanceTime > 0.3 * tStance) || over) && !leg.windowUsed) {
            leg.windowUsed = true;
            const remain = Math.max((1 - p) / g.f, 0.45 * (1 - g.D) / g.f);
            this.startSwing(leg, remain, g.lift, 'gait');
            swinging++; swingSet = L.set;
          }
        } else if (P.gaitW > 0.5 || P.dead < 0.5) {
          // standing: re-step feet that are far from their neutral foothold, one tetrapod at a time
          const nb = this.neutral(leg, 0, 0, 0, tv());
          const err = Math.hypot(nb.x - leg.plant.x, nb.z - leg.plant.z);
          const thr = (P.gaitW > 0.5 ? 0.075 : 0.05) * L.total;
          if (err > thr && leg.stanceTime > 0.12 && this.wantSpeed < 0.02 * cfg.maxSpeed && P.curl < 0.05 && P.dead < 0.02 && P.drawIn < 0.02 && P.raise[li] + P.hold[li] < 0.05 && (swinging === 0 || swingSet === L.set) && swinging < 4) {
            this.startSwing(leg, (0.12 + 0.5 * err / L.total) * cfg.sq, 0.06 * L.total * (P.gaitW > 0.5 ? 1 : 0.6), 'step');
            swinging++; swingSet = L.set;
          }
        }
      } else if (leg.state === 'swing') {
        leg.swingT += dt / leg.swingDur;
        const remain = Math.max(0, (1 - leg.swingT) * leg.swingDur);
        if (leg.mode === 'gait' || leg.mode === 'step') {
          const half = moving ? Math.min(vPlanar * tStance * 0.5, 0.3 * L.total) : 0;
          const yawLead = moving ? this.yawRate * tStance * 0.5 : 0;
          // the landing spot is predicted once, at lift-off (a swing lasts a few frames; a target that
          // moved under a fast claw would make it jerk); the next step corrects any change of course
          if (!leg.targetSet) {
            leg.targetSet = true;
            this.neutral(leg, remain, half, yawLead, leg.landBase);
          }
        }
        // the landing spot stays inside the workspace of where the body will actually be (the clamp
        // moves continuously with the body, so the claw is never yanked)
        if (leg.mode !== 'land') {
          leg.land.copy(leg.landBase);
          this.clampWorkspace(leg, leg.land, remain);
          this._swingClear(leg);
        }
        if (leg.swingT >= 1) {
          leg.state = 'stance'; leg.windowUsed = leg.mode === 'gait' ? leg.windowUsed : false;
          leg.plant.copy(leg.land); leg.stanceTime = 0;
          if (leg.mode === 'gait') leg.windowUsed = false;
          if (leg.mode === 'gait' && P.gaitW > 0.5) this.emit('footstep', { foot: L.key, position: leg.plant.clone(), speed: this.speed, strength: clamp(0.15 + this.speed / cfg.maxSpeed * 0.5, 0, 1) });
        }
      }
      leg.prevPhase = p;
    }
  }

  // horizontal distance of a world point from the leg's coxa base (current body, heading frame)
  coxaDist(leg, w) {
    const L = leg.def, h = this.heading, sh = Math.sin(h), ch = Math.cos(h);
    const dx = w.x - this.pos.x, dz = w.z - this.pos.z;
    const lx = dx * ch - dz * sh, lz = dx * sh + dz * ch;
    return Math.hypot(lx - L.P0[0].x, lz - L.P0[0].z);
  }
  // azimuth of a world point about the coxa base relative to the leg's neutral direction
  coxaAz(leg, w) {
    const L = leg.def, h = this.heading, sh = Math.sin(h), ch = Math.cos(h);
    const dx = w.x - this.pos.x, dz = w.z - this.pos.z;
    const lx = dx * ch - dz * sh - L.P0[0].x, lz = dx * sh + dz * ch - L.P0[0].z;
    return angDiff(L.azN, Math.atan2(lx * L.side, lz));
  }
  // keep a landing target inside the leg's workspace (radially about the coxa base)
  clampWorkspace(leg, w, tAhead = 0) {
    // relative to where the body will be at touchdown
    const L = leg.def, h = this.heading + clamp(this.yawRate * tAhead, -0.45, 0.45), sh = Math.sin(h), ch = Math.cos(h);
    const px = this.pos.x + this.velocity.x * tAhead, pz = this.pos.z + this.velocity.z * tAhead;
    const dx = w.x - px, dz = w.z - pz;
    let lx = dx * ch - dz * sh - L.P0[0].x, lz = dx * sh + dz * ch - L.P0[0].z;
    const r = Math.hypot(lx, lz) || 1e-9;
    const rc = clamp(r, L.rMin * 1.04, L.rMax * 0.96);
    // and within +-L.azMax of the neutral direction
    const a = Math.atan2(lx * L.side, lz), da = angDiff(L.azN, a);
    const ac = L.azN + clamp(da, -L.azMax, L.azMax);
    if (rc === r && ac === L.azN + da) return w;
    lx = Math.sin(ac) * rc * L.side + L.P0[0].x; lz = Math.cos(ac) * rc + L.P0[0].z;
    w.x = px + ch * lx + sh * lz; w.z = pz - sh * lx + ch * lz;
    w.y = this.terrainH(w.x, w.z) + L.tipY;
    return w;
  }

  // swing clearance: sample the terrain along the path so the claw steps over bumps
  _swingClear(leg) {
    let m = -1e9;
    for (let k = 1; k <= 3; k++) {
      const u = k / 4;
      const x = lerp(leg.lift.x, leg.land.x, u), z = lerp(leg.lift.z, leg.land.z, u);
      const base = lerp(leg.lift.y, leg.land.y, u);
      m = Math.max(m, this.terrainH(x, z) + leg.def.tipY - base);
    }
    leg.hMax = Math.max(0, m);
  }

  startSwing(leg, dur, lift, mode) {
    leg.lift.copy(leg.plant);
    leg.land.copy(leg.plant); leg.landBase.copy(leg.plant);
    leg.state = 'swing'; leg.mode = mode;
    leg.swingT = 0; leg.swingDur = Math.max(0.05, dur);
    leg.liftH = lift;
    leg.swingInit = true;
    leg.targetSet = mode === 'twitch';
    this._swingClear(leg);
  }

  // an idle twitch: lift the claw a little and set it down again (almost) in place
  twitchLeg(i) {
    const leg = this.legs[i];
    if (leg.state !== 'stance' || this._moving || this.P.gaitW < 0.5) return;
    this.startSwing(leg, 0.22 * this.cfg.sq, 0.05 * leg.def.total, 'twitch');
    const nb = this.neutral(leg, 0, 0, 0, tv());
    leg.land.lerp(nb, 0.5); leg.land.y = this.terrainH(leg.land.x, leg.land.z) + leg.def.tipY;
    leg.landBase.copy(leg.land);
    this._swingClear(leg);
  }

  takeOff(vy, vh) {
    const a = this.air, cfg = this.cfg;
    a.active = true; a.t = 0; a.vy = vy; a.vh = vh; a.v0 = this.speed;
    this.forward(this.heading, a.dir);
    a.y0 = this.root.y;
    a.h0 = this.root.y - this.pos.y;
    a.T = (2 * vy) / G_ACC;
    this.airY = a.y0;
    a.legsOff = false;
    // legs already in the air (mid-swing) follow the body at once; planted ones push off first
    for (const leg of this.legs) if (leg.state !== 'stance' || leg.def.i <= 2) { leg.carry0 = leg.state === 'stance' ? 0 : 1; leg.state = 'air'; this.fkTip(leg, leg.rawAz, leg.rawEl, leg.airFrom); leg.airRoot.copy(this.root); leg.airT = 0; leg.liftAz.set(leg.rawAz); leg.liftEl.set(leg.rawEl); }
    this.state.grounded = false;
    this.emit('takeoff', {});
    void cfg;
  }
  touchDown() {
    const a = this.air;
    if (!a.active) return;
    a.active = false;
    this.state.grounded = true;
    // every claw comes down near its neutral foothold, the legs reaching out from the tuck
    // (clamped into the workspace around where the body stops: a coast frame, then the brake)
    const tStop = COAST + Math.min(this.speed / (2 * this.cfg.decel), 0.05);
    for (const leg of this.legs) {
      // (the legs reach out to spread footholds as they land: a landing on legs tucked under the
      // body would leave it standing on stilts)
      const nb = this.neutral(leg, tStop, 0, 0, tv());
      leg.plant.set(lerp(leg.tip.x, nb.x, 0.85), 0, lerp(leg.tip.z, nb.z, 0.85));
      leg.plant.y = this.terrainH(leg.plant.x, leg.plant.z) + leg.def.tipY;
      this.clampWorkspace(leg, leg.plant, tStop);
      leg.lift.copy(leg.tip);
      leg.land.copy(leg.plant);
      leg.state = 'swing'; leg.mode = 'land'; leg.swingInit = true; leg.swingT = 0; leg.swingDur = 0.13 * this.cfg.sq; leg.liftH = 0; leg.hMax = 0;
    }
    this.landV = this.speed;
    // the body keeps its falling speed into the landing spring (legs absorb the impact)
    this.hS.x = this.airY; this.hS.v = Math.min(0, a.vy - G_ACC * Math.max(0, a.t - PUSH - COAST));
    {
      const v = -this.hS.v, rest = this.pos.y + this.cfg.rootH * 0.78, d = Math.max(1e-4, this.airY - v * COAST - rest);
      this.brakeA = (v * v) / (2 * d);
      this.landFrames = 0;
    }
    this.actionsLayer.onLand();
    this.landT = 0;
    this.emit('land', {});
  }

  _fitTerrain() {
    const cfg = this.cfg, W = cfg.fitW, h = this.heading;
    let a = 0, b = 0, c = 0;
    const tmp = tv();
    for (let i = 0; i < 8; i++) {
      const L = cfg.legs[i];
      this.headingToWorld(L.neutral.x, L.neutral.z, h, this.pos.x, this.pos.z, tmp);
      const y = this.terrainH(tmp.x, tmp.z);
      a += W[0][i] * y; b += W[1][i] * y; c += W[2][i] * y;
    }
    this._fit = this._fit || { h: 0, pitch: 0, roll: 0 };
    this._fit.h = a; this._fit.pitch = Math.atan(c) * 0.85; this._fit.roll = Math.atan(b) * 0.85;
    return this._fit;
  }

  // ----------------------------------------------------------------- pose
  pose(dt) {
    const cfg = this.cfg, P = this.P, g = this.gait, t = this.time, air = this.air;
    const fit = this._fitTerrain();
    const vn = this.speed / cfg.maxSpeed;
    // look: body twist and rearing toward the look target
    const look = this.input.look || P.look;
    let lyT = 0, lpT = 0;
    if (look && P.lookW > 0.01 && P.dead < 0.5) {
      const dx = look.x - this.pos.x, dz = look.z - this.pos.z;
      const rel = angDiff(this.heading, Math.atan2(dx, dz));
      lyT = clamp(rel, -cfg.look.yaw, cfg.look.yaw) * P.lookW * (1 - smooth(0.2, 0.6, vn) * 0.8);
      const dy = look.y - (this.pos.y + cfg.rootH * 1.5);
      lpT = clamp(Math.atan2(dy, Math.hypot(dx, dz) + 1e-6), 0, cfg.look.pitch) * P.lookW * (1 - smooth(0.1, 0.4, vn));
      this.lookTarget.copy(look); this.state.lookTarget = this.lookTarget;
    } else this.state.lookTarget = null;
    const lookYaw = this.lookYawS.step(lyT, 7, dt), lookPitch = this.lookPitchS.step(lpT, 6, dt);
    // raise the front legs a little when rearing to look up
    if (lookPitch > 0.01) for (let i = 0; i < 8; i++) if (this.legs[i].def.i === 1) P.raise[i] = Math.max(P.raise[i], 0.8 * lookPitch / cfg.look.pitch);
    // body height, pitch and roll from the terrain plane, the posture and the gait
    const moving = this._moving ? smooth(0, 0.15, vn) : 0;
    const bob = g.bob * moving * Math.cos(TAU * 2 * this.phase);
    const sway = g.sway * moving * Math.sin(TAU * this.phase);
    const dropK = 1 - 0.55 * P.crouch;
    const hT = fit.h + cfg.rootH * cfg.stance.height * dropK - P.drop + bob;
    // a stiffer spring for a moment after landing (the legs absorb the fall)
    let h;
    if (this.brakeA > 0 && this.hS.v < 0) {
      // landing: a coast frame, then constant braking on the legs down to the stance height
      // frame 0: the landing height itself; frame 1: coasting; then braking
      const lf = this.landFrames++;
      if (lf >= 2) this.hS.v = Math.min(0, this.hS.v + this.brakeA * dt);
      if (lf >= 1) this.hS.x += this.hS.v * dt;
      h = this.hS.x;
    } else { this.brakeA = 0; h = this.hS.step(hT, 18, dt); }
    if (air.active) { h = this.airY; this.hS.x = h; this.hS.v = 0; }
    const pitch = this.pitchS.step(fit.pitch * (1 - P.dead) + P.pitch + lookPitch, 14, dt);
    const roll = this.rollS.step(fit.roll * (1 - P.dead), 14, dt);
    // body rotation: heading (+ look twist + sway), pitch (nose up), roll, then the death flip about
    // the long axis
    this._e.set(-pitch, this.heading + lookYaw + sway + P.yaw, roll + P.roll, 'YXZ');
    this.qB.setFromEuler(this._e);
    if (P.flip > 1e-4) this.qB.multiply(this._q.setFromAxisAngle(Z_AXIS, P.flip * P.flipAngle * P.flipSide));
    // lunge / side offsets in the heading frame
    const F = this.forward(this.heading, tv()), Lf = this.left(this.heading, tv());
    this.root.set(this.pos.x, h, this.pos.z).addScaledVector(F, P.fwd).addScaledVector(Lf, P.side);
    this.qBinv.copy(this.qB).invert();
    this.upB.set(0, 1, 0).applyQuaternion(this.qBinv); // world up in the body frame

    // abdomen: hangs from the pedicel on a spring; lags in accelerations and turns; rests on the
    // ground in low postures; breathes
    const aLocal = this._v.copy(this.accelV).applyQuaternion(this.qBinv);
    const A = cfg.abd;
    const pT = -A.droop * (1 - moving) + P.abdPitch - clamp(aLocal.z * A.lag * 0.02, -0.2, 0.2) + clamp(aLocal.y * 0.002, -0.1, 0.1);
    const yT = clamp(-aLocal.x * A.lag * 0.02, -0.25, 0.25) - this.yawRate * 0.04 * A.lag * 10;
    let ap = this.abdPitchS.step(pT, A.stiffness, dt);
    const ay = this.abdYawS.step(clamp(yT, -0.3, 0.3), A.stiffness * 0.8, dt);
    const tmp = tv();
    const pb = cfg.ax.pedB, lo = cfg.abdLow;
    const abdLowAt = (a) => {
      // world position of the abdomen's lowest bind point for abdomen pitch a (no yaw)
      const c = Math.cos(a), sn = Math.sin(a);
      return this.localToWorld(pb.x + lo.x, pb.y + lo.y * c - lo.z * sn, pb.z + lo.y * sn + lo.z * c, tmp);
    };
    // (faded out continuously in death, when the body itself lies on the ground)
    const wAl = 1 - smooth(0.25, 0.6, P.dead);
    if (wAl > 0) {
      // keep the abdomen off the ground (or rest it on the ground in low postures)
      const ap0 = ap;
      abdLowAt(ap);
      const gap = tmp.y - this.terrainH(tmp.x, tmp.z) - 0.00025 * cfg.s;
      const L = Math.hypot(lo.y, lo.z);
      if (P.abdDown > 0.01 && gap > 0) ap -= P.abdDown * clamp(gap / L, 0, 0.35);
      if (gap < 0) ap += Math.min(0.6, (-gap / L) * 1.1);
      // every other extreme point too (rearing, the rear end is the lowest)
      const c = Math.cos(ap), sn = Math.sin(ap);
      let fix = 0;
      for (const p of cfg.supAbd) {
        if (p === lo || p.z > 0) continue;
        this.localToWorld(pb.x + p.x, pb.y + p.y * c - p.z * sn, pb.z + p.y * sn + p.z * c, tmp);
        const g = tmp.y - this.terrainH(tmp.x, tmp.z) - 0.00025 * cfg.s;
        if (g < 0) fix = Math.max(fix, Math.min(0.6, (-g / Math.max(1e-6, Math.hypot(p.y, p.z))) * 1.1));
      }
      ap += fix;
      ap = ap0 + (ap - ap0) * wAl;
    }
    this._e.set(ap, ay, 0, 'YXZ');
    this.qAbd.setFromEuler(this._e);
    this.qPed.identity().slerp(this.qAbd, 0.5);
    // body support: nothing of the body goes into the ground (bumps under the sternum or abdomen,
    // a dead spider lying on its back or side); a spring keeps it continuous
    let lift = 0;
    for (const p of cfg.supPro) {
      this.localToWorld(p.x, p.y, p.z, tmp);
      const pen = this.terrainH(tmp.x, tmp.z) + 0.0001 * cfg.s - tmp.y;
      if (pen > lift) lift = pen;
    }
    {
      const qa = this._q2.copy(this.qB).multiply(this.qAbd);
      const ped = this._w.subVectors(pb, cfg.ax.pedA).applyQuaternion(this._q.copy(this.qB).multiply(this.qPed));
      const pA = this.localToWorld(cfg.ax.pedA.x, cfg.ax.pedA.y, cfg.ax.pedA.z, tv()).add(ped);
      for (const p of cfg.supAbd) {
        tmp.copy(p).applyQuaternion(qa).add(pA);
        const pen = this.terrainH(tmp.x, tmp.z) + 0.0001 * cfg.s - tmp.y;
        if (pen > lift) lift = pen;
      }
    }
    // the leg roots (trochanters, femur bases) are as rigid with the body as the carapace: a deep crouch
    // or a steep rear must not push them into the ground either
    for (const leg of this.legs) for (let k = 1; k <= 2; k++) {
      const q = leg.jp[k];
      const pen = this.terrainH(q.x, q.z) + 2.2 * leg.def.tipY - (q.y - this._lift);
      if (pen > lift) lift = pen;
    }
    const wLeg = P.dead * Math.max(smooth(0, 0.08, P.flip), P.curl2); // dying, it rests on its curling legs
    if (wLeg > 1e-3) {
      // rolling over, a dead spider rests on its curled legs as well (folded tight before it rolls);
      // the joints were placed last frame including last frame's lift, so compare without it
      lift = Math.max(lift, this._legSupport(wLeg, this._lift));
    }
    const sup = this.supportS.step(lift, 30, dt);
    // smooth maximum of the spring and the raw depth (never far below the ground, no kinks)
    this._lift = -smin(-sup, -lift, 0.0003 * cfg.s);
    this.root.y += this._lift;
    this.breath += dt * TAU * cfg.breath.rate * P.breathRate;
    const br = Math.sin(this.breath) * cfg.breath.amp * P.breathAmp;

    this.writeAxial(br);
    this.solveLegs(dt);
    if (wLeg > 1e-3) {
      // the legs of a dying spider move fast (curling, rolling over): the support above used last
      // frame's joints, so check this frame's too and lift the whole body clear if any went under
      const extra = this._legSupport(wLeg, 0);
      if (extra > 1e-6) {
        this.root.y += extra; this._lift += extra;
        this.writeAxial(br);
        this.solveLegs(0);
      }
    }
    this.solvePalps(dt);
    this.solveChelicerae(dt);
    // head pose
    const hb = this.sk.bones[cfg.bone.head];
    if (hb) {
      this.localToWorld(this._eyeLocal.x, this._eyeLocal.y, this._eyeLocal.z, this.headPose.position);
      this.headPose.quaternion.copy(this.qB);
    }
  }

  // how far the body must rise so no leg joint is in the ground (joints nearer the knee carry a wider
  // margin: the knuckles are thick): a soft maximum over the joints, so the support does not jerk as
  // the lowest joint changes from one leg to another while it rolls
  _legSupport(w, lifted) {
    const k = 0.00006 * this.cfg.s;
    let mx = -Infinity;
    const pens = this._pens || (this._pens = new Float64Array(48));
    let n = 0;
    for (const leg of this.legs) for (let j = 2; j < 8; j++) {
      const q = leg.jp[j];
      const p = this.terrainH(q.x, q.z) + (j === 7 ? 1.6 : j === 2 ? 2.2 : 5) * leg.def.tipY - (q.y - lifted);
      pens[n++] = p; if (p > mx) mx = p;
    }
    if (mx < -8 * k) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.exp((pens[i] - mx) / k);
    // softplus of the soft maximum: 0 when every joint is clear, the depth when one is under
    const sm = mx + k * Math.log(sum);
    return w * (sm > 8 * k ? sm : k * Math.log1p(Math.exp(sm / k)));
  }

  setBone(i, pos, q, scale) {
    if (i < 0) return;
    const b = this.sk.bones[i];
    b.matrixWorld.compose(pos, this._q3.copy(q).multiply(this.cfg.bindQ[i]), scale || ONE);
  }

  writeAxial(br) {
    const cfg = this.cfg, ax = cfg.ax, B = cfg.bone;
    const p = tv();
    this.localToWorld(ax.pedA.x, ax.pedA.y, ax.pedA.z, p);
    this.setBone(B.prosoma, p, this.qB);
    this.localToWorld(ax.ceph.x, ax.ceph.y, ax.ceph.z, p);
    this.setBone(B.head, p, this.qB);
    // pedicel and abdomen hang from pedA
    const qP = this._q2.copy(this.qB).multiply(this.qPed);
    this.localToWorld(ax.pedA.x, ax.pedA.y, ax.pedA.z, p);
    this.setBone(B.pedicel, p, qP);
    const pedVec = tv().subVectors(ax.pedB, ax.pedA).applyQuaternion(qP);
    const abdHead = tv().copy(p).add(pedVec);
    const qA = tv(); void qA;
    const qAw = this._q2.copy(this.qB).multiply(this.qAbd);
    this._scale.set(1 + br, 1 + br * 0.4, 1 + br);
    this.setBone(B.abdomen, abdHead, qAw, this._scale);
    if (B.spinnerets >= 0) {
      const sv = tv().subVectors(ax.abdEnd, ax.pedB).multiplyScalar(1 + br * 0.4).applyQuaternion(qAw);
      const sp = tv().copy(abdHead).add(sv);
      // spinnerets twitch a little
      this._e.set(0.05 * Math.sin(this.time * 1.7) * this.P.twitch, 0.06 * Math.sin(this.time * 0.9 + 1) * this.P.twitch, 0, 'YXZ');
      this.setBone(B.spinnerets, sp, this._q.copy(qAw).multiply(this._q3.setFromEuler(this._e)));
    }
  }

  // ---------------------------------------------------------------- legs
  solveLegs(dt) {
    const P = this.P, cfg = this.cfg, air = this.air;
    const tipL = tv();
    for (let li = 0; li < 8; li++) {
      const leg = this.legs[li], L = leg.def;
      // world claw target
      const T = tv();
      let heel = 0;
      if (leg.state === 'stance') {
        this.postureTarget(leg, T.copy(leg.plant));
        if (this._moving) heel = smooth(0.5, 1.0, leg.stanceTime * this.gait.f / Math.max(this.gait.D, 0.05));
      } else if (leg.state === 'swing') {
        // swing in joint space: from the lift-off angles to the angles that reach the (moving) landing
        // target, with short speed ramps, plus a femur lift that clears the terrain on the way. Each
        // joint then sweeps a smooth arc instead of folding and unfolding to follow a straight path.
        const u = clamp(leg.swingT, 0, 1);
        const s = progress(u, TUNE.ramp);
        if (leg.swingInit) { leg.liftAz.set(leg.rawAz); leg.liftEl.set(leg.rawEl); leg.liftHeel = leg.heel; leg.swingInit = false; }
        // the landing pose is solved in the body frame predicted for the moment of touchdown (in the
        // current frame a claw landing ahead would look further away than it will be)
        const rem = Math.max(0, (1 - u) * leg.swingDur);
        const qp = this._q2.setFromAxisAngle(Y_AXIS, clamp(this.yawRate * rem, -0.45, 0.45)).multiply(this.qB).invert();
        this.postureTarget(leg, tipL.copy(leg.land));
        tipL.x -= this.root.x + this.velocity.x * rem; tipL.y -= this.root.y; tipL.z -= this.root.z + this.velocity.z * rem;
        tipL.applyQuaternion(qp);
        const az = leg.az, el = leg.el;
        let reach = Math.max(0.3 * L.total, Math.hypot(tipL.x - L.P0[2].x, tipL.z - L.P0[2].z));
        if (TUNE.path === 'polar') {
          // claw path in polar coordinates about the coxa base (radius and azimuth interpolate, so a
          // radial leg neither overshoots nor cuts across), height with the clearance hump
          const B = L.P0[0], sd = L.side;
          const lL = tv().copy(leg.lift).sub(this.root).applyQuaternion(this.qBinv);
          const r0 = Math.hypot(lL.x - B.x, lL.z - B.z), r1 = Math.hypot(tipL.x - B.x, tipL.z - B.z);
          const a0 = Math.atan2((lL.x - B.x) * sd, lL.z - B.z), a1 = Math.atan2((tipL.x - B.x) * sd, tipL.z - B.z);
          const r = lerp(r0, r1, s), a = a0 + angDiff(a0, a1) * s;
          const y = lerp(lL.y, tipL.y, s) + (leg.liftH + leg.hMax) * hump(u);
          tipL.set(B.x + Math.sin(a) * r * sd, y, B.z + Math.cos(a) * r);
          this.solveLeg(leg, tipL, leg.liftHeel * (1 - s) * cfg.heelLift);
        } else {
          this.solveLeg(leg, tipL, 0);
          if (TUNE.debug) leg._landEl = Array.from(el);
          for (let k = 0; k < 7; k++) { az[k] = leg.liftAz[k] + angDiff(leg.liftAz[k], az[k]) * s; el[k] = leg.liftEl[k] + angDiff(leg.liftEl[k], el[k]) * s; }
          const b = ((leg.liftH + leg.hMax) * hump(u)) / reach;
          el[2] += b * TUNE.bf; el[3] -= b * TUNE.bp; el[5] -= b * TUNE.bm;
        }
        this._unwrapIK(leg, li);
        leg.rawAz.set(az); leg.rawEl.set(el);
        T.lerpVectors(leg.lift, leg.land, s);
        const wPose = this.blendLegPose(leg, li);
        this.writeLeg(leg);
        if (wPose > 1e-3 && (P.dead < 0.5 || P.flip < 0.3)) this.groundGuard(leg, (P.dead < 0.5 ? 1 : 1 - smooth(0.02, 0.3, P.flip)) * smooth(0, 0.05, wPose));
        // a joint-space swing can dip toward the ground between lift-off and touchdown: lift the femur
        // by just enough to keep the claw and the tarsus base clear (continuous in the depth)
        {
          // (faded in and out at the ends of the swing, where the claw is on the ground anyway)
          const r = smooth(0, 0.05, u) * (1 - smooth(0.95, 1, u));
          // (the tibia end first: the femur lifts it; then the claw and tarsus: the metatarsus)
          const q5 = leg.jp[5], p5 = this.terrainH(q5.x, q5.z) + L.tipY * 2 - q5.y;
          if (p5 > 0 && r > 0) { const de = r * Math.min(0.6, (p5 * 1.2) / (L.len[2] + L.Lpt)); el[2] += de; leg.rawEl[2] += de; this.writeLeg(leg); }
          let pen = 0;
          for (let k = 6; k <= 7; k++) { const q = leg.jp[k]; pen = Math.max(pen, this.terrainH(q.x, q.z) + L.tipY * (k === 7 ? 1 : 1.5) - q.y); }
          if (pen > 0 && r > 0) { const de = r * Math.min(0.8, (pen * 1.3) / (L.len[5] * Math.max(0.3, Math.cos(el[5])))); el[5] += de; leg.rawEl[5] += de; this.writeLeg(leg); }
        }
        leg.ikEl.set(leg.el); leg.ikAz.set(leg.az);
        if (this.debug.targets[li]) this.debug.targets[li].copy(T);
        continue;
      } else {
        // in the air: the claw leaves the ground picking up the body's motion gradually, then settles
        // on its place relative to the body (the action pose does the rest)
        const nb = tv().copy(L.P0[7]).applyQuaternion(this.qB).add(this.root);
        leg.airT = Math.min(1, leg.airT + dt / 0.25);
        const carry = Math.min(1, leg.carry0 + leg.airT * 2.5);
        T.copy(leg.airFrom).addScaledVector(tv().subVectors(this.root, leg.airRoot), carry);
        T.lerp(nb, smooth(0.2, 1, leg.airT));
      }
      // the heel eases (a leg that has stood for a while must not snap to a lifted heel)
      leg.heel += (heel - leg.heel) * (1 - Math.exp(-dt / 0.045));
      heel = leg.heel;
      // body frame
      tipL.copy(T).sub(this.root).applyQuaternion(this.qBinv);
      this.solveLeg(leg, tipL, heel * cfg.heelLift);
      if (leg.state === 'air' && leg.airT < 0.6) {
        // leaving the ground (possibly mid-swing, whose joint-space pose is not the IK one): the
        // joints ease from their take-off angles into the solved ones
        const w = smooth(0, 0.6, leg.airT), az = leg.az, el = leg.el;
        for (let k = 0; k < 7; k++) { az[k] = leg.liftAz[k] + angDiff(leg.liftAz[k], az[k]) * w; el[k] = leg.liftEl[k] + (el[k] - leg.liftEl[k]) * w; }
      }
      this._unwrapIK(leg, li);
      leg.rawAz.set(leg.az); leg.rawEl.set(leg.el);
      // action poses blended in joint-angle space
      const wPose = this.blendLegPose(leg, li);
      this.writeLeg(leg);
      // a planted claw the leg can no longer reach (body shoved or lunging past it) must step
      leg.reachErr = leg.state === 'stance' && wPose < 1e-3 ? Math.hypot(leg.tip.x - T.x, leg.tip.z - T.z) : 0;
      if (wPose > 1e-3 && (P.dead < 0.5 || P.flip < 0.3)) this.groundGuard(leg, (P.dead < 0.5 ? 1 : 1 - smooth(0.02, 0.3, P.flip)) * smooth(0, 0.05, wPose));
      leg.ikEl.set(leg.el); leg.ikAz.set(leg.az); // the displayed angles: next frame's IK is unwrapped against them
      if (this.debug.targets[li]) this.debug.targets[li].copy(T);
    }
    void air; void P;
  }

  solveLeg(leg, T, heel) {
    const L = leg.def, az = leg.az, el = leg.el, s = L.side;
    const B = L.P0[0];
    // tarsus along the leg azimuth at its bind slope (steeper while the heel lifts)
    // azimuths of points very close to the coxa are ill-defined: fall back to the neutral one
    const rS = L.rMin;
    const azG = (dx, dz, r0) => {
      const a = Math.atan2(dx * s, dz), d = Math.hypot(dx, dz);
      return L.phi0 + angDiff(L.phi0, a) * smooth(0.3 * r0, 0.75 * r0, d);
    };
    const phT = azG(T.x - B.x, T.z - B.z, rS);
    // the tarsus keeps its slope relative to the ground, not the body (a planted tarsus does not roll
    // on its pad when the body pitches or rolls)
    const u = this.upB, tilt = Math.asin(clamp(u.x * Math.sin(phT) * s + u.z * Math.cos(phT), -1, 1));
    const eta = L.el0[6] - heel - clamp(tilt, -0.7, 0.7) * (1 - this.P.dead);
    const cT = Math.cos(eta);
    const Ax = T.x - L.len[6] * Math.sin(phT) * cT * s, Ay = T.y - L.len[6] * Math.sin(eta), Az = T.z - L.len[6] * Math.cos(phT) * cT;
    // coxa yaws part of the way, the trochanter the rest
    const phA = azG(Ax - B.x, Az - B.z, rS);
    const dph = angDiff(L.phi0, phA);
    const phC = L.az0[0] + clamp(0.55 * dph, -0.6, 0.6);
    const eC = L.el0[0];
    let x = B.x + L.len[0] * Math.sin(phC) * Math.cos(eC) * s, y = B.y + L.len[0] * Math.sin(eC), z = B.z + L.len[0] * Math.cos(phC) * Math.cos(eC);
    const phTr = azG(Ax - x, Az - z, rS * 0.7);
    const eTr = L.el0[1];
    x += L.len[1] * Math.sin(phTr) * Math.cos(eTr) * s; y += L.len[1] * Math.sin(eTr); z += L.len[1] * Math.cos(phTr) * Math.cos(eTr);
    // vertical leg plane from the femur base to the metatarsus-tarsus joint
    const phP = azG(Ax - x, Az - z, rS * 0.6);
    const ux = Math.sin(phP) * s, uz = Math.cos(phP);
    const h = (Ax - x) * ux + (Az - z) * uz, v = Ay - y;
    const Lf = L.len[2], Lpt = L.Lpt, Lm = L.len[5];
    const d1 = (Lf + Lpt) * 0.97;
    // metatarsus: preferred slope, flattening as the leg stretches
    const D = Math.hypot(h, v);
    let em = L.el0[5] + clamp(1.1 * (D - L.D0) / L.D0, -0.6, 0.9);
    em = Math.min(em, -0.05);
    let mh = h - Lm * Math.cos(em), mv = v - Lm * Math.sin(em);
    let dm = Math.hypot(mh, mv);
    {
      // too far for femur + patella/tibia with the preferred slope: turn the metatarsus toward the
      // femur base (its straightest, longest reach), smoothly with the reach excess
      const w = smooth(0.84 * d1, 1.0 * d1, dm);
      if (w > 0) {
        em = em + angDiff(em, Math.atan2(v, h)) * w;
        mh = h - Lm * Math.cos(em); mv = v - Lm * Math.sin(em);
        dm = Math.hypot(mh, mv);
      }
    }
    // two-link femur + (patella, tibia), knee up, soft reach limit
    const dr = clamp(softMin(dm, d1, 0.04 * d1), Math.abs(Lf - Lpt) * 1.02 + 1e-7, d1);
    const al = Math.atan2(mv, mh);
    const cb = clamp((Lf * Lf + dr * dr - Lpt * Lpt) / (2 * Lf * dr), -1, 1);
    const ef = al + Math.acos(cb);
    const kh = Lf * Math.cos(ef), kv = Lf * Math.sin(ef);
    const mhr = mh * dr / Math.max(dm, 1e-9), mvr = mv * dr / Math.max(dm, 1e-9);
    const ept = Math.atan2(mvr - kv, mhr - kh);
    az[0] = phC; el[0] = eC;
    az[1] = phTr; el[1] = eTr;
    az[2] = az[3] = az[4] = az[5] = phP;
    el[2] = ef; el[3] = ept + L.dp; el[4] = ept + L.dt; el[5] = em;
    az[6] = phT; el[6] = eta;
  }

  // Action poses in joint-angle space. Relative bends (deg) from the femur outward:
  //   raise (threat / grab): femur up, leg nearly straight, pointing up and forward
  //   hold (prey, sleep tuck): femur up, knee sharply flexed, tip toward the mouth
  //   curl (death): femur down, every joint flexed: the leg folds under the body
  //   air (jump): front legs by raise, the hind legs trailing, all a little flexed
  blendLegPose(leg, li) {
    const P = this.P, L = leg.def, az = leg.az, el = leg.el;
    // the in-air pose takes a leg only once it has left the ground (pushing legs stay planted)
    const r = P.raise[li], hd = P.hold[li], c = P.curl, a = P.air > 0 ? P.air * (leg.state === 'stance' && this.air.active ? 0 : smooth(0, 0.35, leg.airT)) : 0;
    if (r + hd + c + a + P.curl2 < 1e-4) return 0;
    const front = L.i === 1 ? 1 : L.i === 2 ? 0.7 : 0;
    if (a > 0) this.poseBlend(leg, a * (1 - front * 0.7), L.i >= 3 ? 10 : 30, L.i >= 3 ? P_AIR_H : P_AIR_F, L.i >= 3 ? 8 : -6, false);
    if (r > 0) this.poseBlend(leg, r, 62 + 8 * front, P_RAISE, -10 * front, false);
    if (hd > 0) this.poseBlend(leg, hd, 42, P_HOLD, -22 * front - 6, false);
    // death: every joint flexes ventrally, distal joints first (the hydraulic collapse), and the legs
    // gather under the sternum (over it once it lies on its back)
    if (c > 0) this.poseBlend(leg, c, 75, P_TUCK, -10, false);
    if (P.curl2 > 1e-4) {
      // upright, the legs half-flex with the knees up (the dying spider sinks, legs drawn in); as the
      // body rolls over the femurs swing ventrally and every joint flexes fully, so the corpse rests
      // on its back or side inside the cage of its legs. Once curl2 is 1 no angle depends on the IK.
      const cu = P.flipAngle < 2 && L.side === -P.flipSide ? L.curlSide : L.curlBack;
      const down = L.side === -P.flipSide, roll = P.flip * P.flipAngle;
      // (the legs it rolls onto fold ventrally first, the upper ones as they come off the ground)
      const w = P.curl2, fl = down ? smooth(0, 0.3 * Math.PI, roll) : smooth(0.3 * Math.PI, 0.6 * Math.PI, roll), cp = L.curlUp;
      if (P.flip > 1e-4 || (P.reviving && this._lift > 0.4 * this.cfg.rootH)) {
        // rolled over, the claws' stance targets mean nothing: the IK is replaced by the upright
        // curl as the base the pose blends from (the IK comes back only once it is upright)
        const g = Math.max(smooth(0, 0.1, P.flip), P.reviving * smooth(0.4 * this.cfg.rootH, 1.2 * this.cfg.rootH, this._lift));
        el[0] += (cp.C - el[0]) * g; el[1] += (cp.C - el[1]) * g;
        let e0 = cp.F;
        el[2] += (e0 - el[2]) * g;
        for (let k = 3; k < 7; k++) { e0 += cp.B[k - 3]; el[k] += (e0 - el[k]) * g; }
        az[0] += (L.az0[0] - az[0]) * g;
        for (let k = 1; k < 7; k++) az[k] += (L.phi0 - az[k]) * g;
      }
      const cT = lerp(cp.C, cu.C, fl);
      el[0] += (cT - el[0]) * w; el[1] += (cT - el[1]) * w;
      el[2] += (lerp(cp.F, cu.F, fl) - el[2]) * w;
      let e = el[2];
      for (let k = 3; k < 7; k++) { e += lerp(cp.B[k - 3], cu.B[k - 3], fl); el[k] += (e - el[k]) * w; }
      az[0] += (L.az0[0] - az[0]) * w;
      for (let k = 1; k < 7; k++) az[k] += (L.phi0 - az[k]) * w;
    }
    return Math.min(1, r + hd + c + a + P.curl2);
  }

  // posture changes of a claw target (world): drawn in toward the coxa along the ground (a collapsing
  // spider), lifted while the legs curl or uncurl (so the blend never sweeps through the ground),
  // tucked under the sternum; the same for planted claws and for landing targets
  postureTarget(leg, T) {
    const P = this.P, L = leg.def;
    if (P.drawIn > 1e-3) {
      // (sleep pulls them in further than death: the living legs keep their pose)
      const cb = tv().copy(L.P0[0]).applyQuaternion(this.qB).add(this.root);
      const k = 0.3 * P.drawIn + 0.2 * P.pullIn;
      T.x += (cb.x - T.x) * k; T.z += (cb.z - T.z) * k;
      T.y = this.terrainH(T.x, T.z) + L.tipY;
    }
    if (P.dead > 1e-3 && P.curl > 1e-3) T.y += 0.28 * L.total * smooth(0, 0.6, P.curl);
    if (P.tuck > 1e-3) {
      const B = L.P0[0];
      T.lerp(this.localToWorld(B.x * 0.35, B.y - 0.25 * L.len[2], B.z * 0.6, tv()), P.tuck);
    }
    return T;
  }

  // The IK's elevations are defined modulo a turn. Pose blends interpolate them linearly toward fixed
  // targets, so while any pose is blended in they are taken on the turn nearest to what was shown
  // last frame (a leg released from a pose takes the short way back, never a full spin); with no pose
  // active they are brought back to (-pi, pi], which changes nothing visible.
  _unwrapIK(leg, li) {
    const P = this.P, el = leg.el, az = leg.az, pv = leg.ikEl, pa = leg.ikAz;
    const posed = P.raise[li] + P.hold[li] + P.curl + P.air + P.curl2 > 1e-5;
    for (let k = 0; k < 7; k++) {
      el[k] = posed ? pv[k] + angDiff(pv[k], el[k]) : angDiff(0, el[k]);
      az[k] = posed ? pa[k] + angDiff(pa[k], az[k]) : angDiff(0, az[k]);
    }
  }

  // blend one pose into the solved joint angles: femur elevation (deg) and the bends of the following
  // joints relative to it; staggered = distal joints move first
  poseBlend(leg, w, femur, bends, dAz, staggered) {
    if (w < 1e-4) return;
    const L = leg.def, az = leg.az, el = leg.el;
    let e = femur * DEG;
    el[2] += (e - el[2]) * (staggered ? smooth(0.35, 1, w) : w);
    for (let k = 3; k < 7; k++) {
      e += bends[k - 3] * DEG;
      const wk = staggered ? smooth(STAG[k][0], STAG[k][1], w) : w;
      el[k] += (e - el[k]) * wk;
    }
    const tAz = L.phi0 + dAz * DEG;
    az[0] += (L.az0[0] - az[0]) * w;
    for (let k = 1; k < 7; k++) az[k] += (tAz - az[k]) * w;
  }

  // A posed leg (raised, holding, curled, tucked) must not pass through the ground: rotate the chain
  // from the femur outward about its base by just enough to lift the deepest joint clear (the
  // direction that raises that joint, found numerically, so it also works upside down).
  groundGuard(leg, strength = 1) {
    const L = leg.def, el = leg.el, jp = leg.jp, m = L.tipY * 1.1, k2 = (0.1 * L.total) ** 2;
    const pen = this._gpen || (this._gpen = new Float64Array(8)), y0 = this._gy0 || (this._gy0 = new Float64Array(8));
    for (let it = 0; it < 3; it++) {
      let any = false;
      for (let k = 3; k < 8; k++) { const q = jp[k]; pen[k] = Math.max(0, this.terrainH(q.x, q.z) + (k === 7 ? m : 1.8 * m) - q.y); y0[k] = q.y; if (pen[k] > 0) any = true; }
      if (!any) return;
      const e = 0.05;
      for (let k = 2; k < 7; k++) el[k] += e;
      this.writeLeg(leg);
      // least-squares step over every joint in the ground (each enters with zero depth: continuous)
      let num = 0, den = k2;
      for (let k = 3; k < 8; k++) { const sl = (jp[k].y - y0[k]) / e; num += pen[k] * sl; den += pen[k] > 0 ? sl * sl : 0; }
      const dd = clamp((1.05 * num) / den, -0.6, 0.6) * strength - e;
      for (let k = 2; k < 7; k++) el[k] += dd;
      this.writeLeg(leg);
    }
  }




  // claw tip (world) of a leg for joint angles az / el (no bones written)
  fkTip(leg, az, el, out) {
    const L = leg.def, s = L.side;
    let x = L.P0[0].x, y = L.P0[0].y, z = L.P0[0].z;
    for (let k = 0; k < 7; k++) {
      const ce = Math.cos(el[k]);
      x += L.len[k] * Math.sin(az[k]) * ce * s; y += L.len[k] * Math.sin(el[k]); z += L.len[k] * Math.cos(az[k]) * ce;
    }
    return this.localToWorld(x, y, z, out);
  }

  writeLeg(leg) {
    const L = leg.def, az = leg.az, el = leg.el, s = L.side, jp = leg.jp;
    const q = this._q, qy = this._q2;
    const p = tv().copy(L.P0[0]);
    this.localToWorld(p.x, p.y, p.z, jp[0]);
    for (let k = 0; k < 7; k++) {
      // rotation from bind: body x yaw about body up x pitch about the bind leg-plane normal
      qy.setFromAxisAngle(Y_AXIS, s * angDiff(L.az0[k], az[k]));
      q.setFromAxisAngle(L.n0, el[k] - L.el0[k]);
      qy.multiply(q);
      q.copy(this.qB).multiply(qy);
      this.setBone(L.bones[k], jp[k], q);
      const ce = Math.cos(el[k]);
      p.x += L.len[k] * Math.sin(az[k]) * ce * s; p.y += L.len[k] * Math.sin(el[k]); p.z += L.len[k] * Math.cos(az[k]) * ce;
      this.localToWorld(p.x, p.y, p.z, jp[k + 1]);
    }
    leg.tip.copy(jp[7]);
  }

  // ---------------------------------------------------------------- palps
  solvePalps(dt) {
    const cfg = this.cfg, P = this.P, t = this.time;
    // (eased: the gait can switch on and off for a frame, e.g. at a landing)
    this._palpMove = expTo(this._palpMove || 0, this._moving ? 1 : 0, dt, 0.12);
    const moving = this._palpMove;
    for (let k = 0; k < 2; k++) {
      const D = cfg.palpDefs[k], S = this.palpState[k], az = S.az, el = S.el, s = D.side;
      // idle twitches: random small targets, eased
      S.twT -= dt;
      if (S.twT <= 0) {
        S.twT = 0.4 + this.rand() * 2.2;
        const amp = 0.25 * cfg.palps.twitch * P.twitch * (1 - moving * 0.6);
        for (let j = 0; j < 6; j++) S.tgt[j] = (this.rand() - 0.5) * amp;
      }
      const kT = 1 - Math.exp(-dt / 0.07), kD = 1 - Math.exp(-dt / 0.6);
      const work = P.palpWork * Math.sin(t * TAU * 2.2 + k * Math.PI);
      const gaitSwing = moving * cfg.palps.tap * 0.25 * Math.sin(TAU * (this.phase + k * 0.5));
      for (let j = 0; j < 6; j++) {
        S.twitch[j] += (S.tgt[j] - S.twitch[j]) * kT;
        S.tgt[j] -= S.tgt[j] * kD;
        az[j] = D.az0[j] - s * 0; el[j] = D.el0[j];
      }
      const raise = P.palpRaise, reach = P.palpReach, down = P.palpDown, fold = P.palpFold;
      const ftw = S.twitch[2] + S.twitch[3];
      el[2] += 0.85 * raise + 0.2 * reach - 0.35 * down + 0.3 * work + gaitSwing + ftw * 0.6 + 0.5 * fold;
      el[3] += -0.3 * raise - 0.4 * down - 0.2 * work - 0.9 * fold + S.twitch[4] * 0.5;
      el[4] += -0.2 * raise + 0.35 * reach - 0.25 * work - 0.7 * fold;
      el[5] += -0.4 * raise + 0.45 * reach + 0.35 * work - 0.4 * fold + S.twitch[5] * 0.5;
      for (let j = 1; j < 6; j++) az[j] += (-0.12 * raise - 0.05 * work + 0.1 * S.twitch[1]) ;
      this.writePalp(D, S);
      // keep the palp tip above the ground: lift the femur (continuous in the penetration depth)
      const tip = S.jp[6];
      let pen = this._palpPen(D, S);
      for (let it = 0; it < 3 && pen > 0; it++) {
        // lift the palp femur (and flatten the tarsus) until the tip clears
        const reachL = D.len[2] + D.len[3] + D.len[4] + D.len[5];
        el[2] += Math.min(0.9, Math.asin(Math.min(1, pen / reachL)) * 1.4);
        el[5] += Math.min(0.6, pen / D.len[5]);
        this.writePalp(D, S);
        pen = this._palpPen(D, S);
      }
    }
  }
  // deepest ground penetration of the palp tip and of the patella, tibia and tarsus (ends and middles)
  _palpPen(D, S) {
    const tip = S.jp[6];
    let m = this.terrainH(tip.x, tip.z) + D.tipR - tip.y;
    for (let j = 3; j <= 5; j++) {
      const q = S.jp[j], q2 = S.jp[j + 1];
      m = Math.max(m, this.terrainH(q.x, q.z) + D.tipR * 2.4 - q.y);
      const mx_ = (q.x + q2.x) * 0.5, my = (q.y + q2.y) * 0.5, mz = (q.z + q2.z) * 0.5;
      m = Math.max(m, this.terrainH(mx_, mz) + D.tipR * 2.2 - my);
    }
    return m;
  }
  writePalp(D, S) {
    const az = S.az, el = S.el, s = D.side, jp = S.jp;
    const q = this._q, qy = this._q2;
    const p = tv().copy(D.P0[0]);
    this.localToWorld(p.x, p.y, p.z, jp[0]);
    for (let k = 0; k < 6; k++) {
      qy.setFromAxisAngle(Y_AXIS, s * angDiff(D.az0[k], az[k]));
      q.setFromAxisAngle(D.n0, el[k] - D.el0[k]);
      qy.multiply(q);
      q.copy(this.qB).multiply(qy);
      this.setBone(D.bones[k], jp[k], q);
      const ce = Math.cos(el[k]);
      p.x += D.len[k] * Math.sin(az[k]) * ce * s; p.y += D.len[k] * Math.sin(el[k]); p.z += D.len[k] * Math.cos(az[k]) * ce;
      this.localToWorld(p.x, p.y, p.z, jp[k + 1]);
    }
  }

  // ---------------------------------------------------------------- chelicerae and fangs
  solveChelicerae() {
    const cfg = this.cfg, P = this.P, C = cfg.chel, t = this.time;
    const q = this._qc1, qw = this._qc2, qf = this._qc3;
    for (let k = 0; k < 2; k++) {
      const ch = cfg.chels[k], s = ch.side;
      const work = P.chelWork * Math.sin(t * TAU * 2.6 + k * Math.PI);
      const pitch = C.pitch * (0.35 * P.chelOpen + 0.25 * work) - 0.1 * P.dead;
      const spread = C.spread * (P.chelOpen + 0.3 * Math.max(0, work)) * s;
      // chelicera: pitch about the lateral axis (tips forward), spread about the forward axis
      q.setFromAxisAngle(X_AXIS, -pitch).premultiply(qf.setFromAxisAngle(Z_AXIS, spread));
      qw.copy(this.qB).multiply(q);
      const base = this.localToWorld(ch.base.x, ch.base.y, ch.base.z, tv());
      this.setBone(ch.bc, base, qw);
      // fang: unfolds about its hinge
      const tipLocal = tv().subVectors(ch.tip, ch.base).applyQuaternion(q).add(ch.base);
      const tipW = this.localToWorld(tipLocal.x, tipLocal.y, tipLocal.z, tv());
      const open = clamp(P.fangOpen + 0.15 * Math.max(0, work) * P.chelWork, 0, 1.1) * C.fangOpen;
      qw.multiply(qf.setFromAxisAngle(ch.fangAxis, open));
      this.setBone(ch.bf, tipW, qw);
    }
  }

  // ----------------------------------------------------------------- state
  publish() {
    const st = this.state, P = this.P;
    st.heading = this.heading;
    st.speed = Math.hypot(this.velocity.x, this.velocity.z);
    st.gait = this.air.active ? 'jump' : st.stats.gait;
    st.grounded = !this.air.active;
    st.eyelid = 0;
    st.action = this.actionsLayer.current();
    st.posture = this.actionsLayer.posture;
    for (let i = 0; i < 8; i++) {
      const leg = this.legs[i], o = st.legs[i];
      o.stance = leg.state === 'stance' && !this.air.active && P.gaitW > 0.5 && P.raise[i] + P.hold[i] + P.curl + P.curl2 + P.air + P.drawIn + P.tuck + P.dead < 0.004;
      if (leg.state === 'stance') o.contact.copy(leg.plant); else o.contact.copy(leg.tip);
      o.contact.y -= leg.def.tipY;
    }
  }
}
