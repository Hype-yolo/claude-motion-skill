// Bird motion engine: bipedal walking and hopping, flapping and gliding flight in 3D, take-off,
// landing (on the ground or gripping a perch), and every standard action, for the standard bird
// skeleton of core/rig/bird.js (crow, chicken, eagle, ...).
//
// Ground: a two-leg gait engine (phase-offset table blended by speed: alternating walks and runs,
// two-footed hops with a real flight phase) plants the feet with terrain-aware swing paths; the leg
// IK keeps the femur near its rest angle inside the body and solves tibiotarsus + tarsometatarsus to
// the planted foot (the ankle points back), rolling the foot onto the toes at push-off; toes curl
// in swing and spread before touchdown. The body bobs from the gait phase (walk: highest at mid
// stance; hop: a ballistic arc between two compressions), the head holds still in space and thrusts
// forward once per step (head bob), the tail bobs and sways.
// Air: airspeed, heading (banked, coordinated turns) and climb rate follow the input with the
// species' limits; a power demand (slow flight, climb, acceleration) drives stroke amplitude and
// frequency between cruise and take-off beats, and fades them to a glide when descending; the body
// pitches with the flight path and bobs with each downstroke; wings follow a stroke cycle (elevation,
// sweep, pronation, flexed upstroke) whose feather fan follows the wrist extension; the tail fans and
// steers; the terrain is never closer than the clearance unless landing. A species may opt into a sleek
// cruise-flight carriage (flight.shape, below: off by default): the head carried forward and low on an
// extended neck, the neck, torso and thigh plumage sleeked, the tail fanned; eased in once airborne and
// out for the flare, after touchdown and in a fall.
// Transitions: take-off (crouch, leg jump, first downstroke at toe-off, steep climb with fast deep
// beats, legs tucked back), landing (a guided path to the touch point, flare: body pitched up, wings
// raised and swept forward for braking beats, tail fanned and depressed, legs thrown forward; the
// feet plant where they touch, the body absorbs, wings stay up briefly then fold), perching (land on
// a target point and grip it: toes wrap the branch).
// Neck: the bind neck is fitted with a cubic Bezier (end tangents from the joints); every pose bends
// that curve from the chest to the head (arc length solved from the chord: a short chord folds the S
// and telescopes the neck a little), so the rest pose reproduces the bind neck exactly; part of the
// gaze turns the whole neck. The head is gaze stabilised, moves in quick saccades toward what it
// looks at and cocks to look with one eye.
// Perches: play('perch', { target, axis?, radius? }) or createAnimal({ perches: [points] }) - the bird
// flies there (flying out and back round when the target is inside its turning circle), settles
// facing across the branch and grips it. LOD 2 (crowd): feathers and toes ride rigidly on their
// carrier bones between full solves (every 3rd frame), cheaper neck solve.
//
// Lessons kept from the cheetah: continuous solves (every target is a continuous function of state;
// nothing jumps between frames), soft IK limits, motion from phase (not from events), springs for
// secondary motion, zero-dt safety, no allocations in the per-frame paths.
//
// ------------------------------------------------------------------------------------------------
// species.motion schema (lengths in metres and speeds in m/s at the reference size; the engine scales
// them by params.size (lengths) and sqrt(size) (speeds, frequencies) - dynamic similarity)
// ------------------------------------------------------------------------------------------------
// gears        { walk, hop|run, fly } named speeds (the fastest ground gear < ground.maxSpeed; `fly`
//              is the cruise airspeed). move() above ground.maxSpeed (or climb >= 0.5 m/s) takes off.
// maxSpeed     top airspeed
// ground       { maxSpeed, accel: [slow, fast], decel, turnRate (rad/s) }
// gaits (req.) [{ name, v, f (stride Hz), D (duty), off: [L, R] touchdown phases ([0, 0.5] walk/run,
//              [0, 0] hop), lift (swing height), bob (walk bounce), hop (hop flight height), sway
//              (lateral), pitch (body pitch, deg, - = nose down), headBob (0..1), wings (0..1 half
//              open for balance), tail (0..1 tail bob) }] sorted by v
// feet         { spread: [hallux, inner, middle, outer] extra yaw (deg), curl (swing toe curl, deg),
//              grip (0..1), pad (MTP height above the ground, m), hock (least ankle height above the
//              ground, m, default 0.004: the radius of the intertarsal joint's skin), sole (least MTP
//              height of a free foot (dead, in the air), m, default 0.8 pad), toeClear (m: toe joints
//              kept this far above the terrain, default 0.0012), sitPad (m: MTP lift when sitting on the
//              tarsi, default 0.004) }
// body         { tilt (standing body axis above horizontal, deg), belly: { y, hh, hw } (belly section:
//              centre height, half height, half width, bind) }
// head         { bob (head-bob strength), yaw, pitchUp, pitchDown (look limits, rad), saccade (0..1),
//              cock (head-cock roll when looking with one eye, rad), jawRest (deg: mandible angle
//              that closes the bill at rest, - closes), radius (skull radius, m), bobHold (share of
//              each step the walking head holds still in space, default 0.5) }
// tail         { pitch (rest, deg), walkBob (deg), sway (deg), flick (0..1), fanRest (0..1), flight (share
//              of the tail's rest angle above the body axis given up in flight, default 1), soarFan (0..1
//              extra fan while gliding) }
// wing         { lengths: [humerus, ulna, hand], bind, fold, glide: wing configurations (deg: elev,
//              pitch, alpha, elbow, wrist, bend, twist; see core/rig/bird.js), flap: { freq, amp,
//              mid, down, upFlex, upWrist, sweep, twist } cruise stroke, power: {...} take-off /
//              braking stroke, glideShare (0..1 share of level flight spent gliding), soar (0..1),
//              tilt (deg: the wing root frame follows a body axis pitched this much nose-up from the
//              bind horizontal; upright birds set it to body.tilt so glide chord and stroke plane are
//              level in flight), fingerLift (deg: emarginated primaries bend up while gliding),
//              groundLift (deg: part-open wings on the ground are raised so long wing tips clear it),
//              skin (m: wrist / wing-tip clearance above the terrain, default 0.006) }
// feathers     { primaries, secondaries, rectrices, coverts } (see resolveFeathers in core/rig/bird.js)
// flight       { minSpeed, cruise, maxSpeed, climb: [up, down] (m/s), bankMax (deg), turnRate,
//              clearance (m above the terrain), glideRatio, sustained (false: lands after maxTime),
//              maxTime (s), legTuck { back, down, side } (feet folded back along the body axis in
//              flight, fractions of the leg length; default { back: 0.82, down: 0.04, side: 0.55 }),
//              shape (optional, off by default: the crow and the chicken fly in their standing shape) }
// flight.shape { reach, drop, neck, body, back, legs, fan }: a long-necked, sleek cruise-flight carriage
//              (raptors), eased in once airborne and out for the landing flare, after touchdown and in
//              a fall (a critically damped weight, ~0.5 s):
//              reach, drop  shares of the neck's arc length: the head is carried forward along the
//                           levelled body axis (reach) and lowered toward the belly side (drop) on an
//                           extended neck, from its resting place on the chest (without them the head
//                           keeps its bind offset from the chest in flight, so an upright standing
//                           carriage holds it above the body line)
//              neck         0..1: the neck's cross-section thins by this share (sleeked feathers)
//              body         [width, length, depth]: torso scale in flight (sleeked contour plumage), in
//                           the chest's and the pelvis's own bone frames (lateral, along the bone,
//                           across it), applied with the breathing / fluff scale; default [1, 1, 1]
//              back         m: the torso's flight scale is centred this far dorsal of the synsacrum (on
//                           the back): a depth < 1 lifts the belly toward the back instead of thinning
//                           the body about its middle; default 0
//              legs         0..1: the thigh and trouser feathers sleek in flight: the femur's skin is
//                           drawn in toward the hip and the tibiotarsus's thinned about the bone by this
//                           share (an upright bird's thighs otherwise hang under the levelled belly)
//              fan          0..1: the tail is fanned at least this much in flight
// takeoff      { crouch (s), jump (m/s), angle (deg climb), beats, open (0..1: wings opened and raised
//              during the crouch) }
// individual   optional (params) => { ...top-level keys } per-individual overrides (sex, age)
// landing      { approach (m/s), flare (s), touch (touchdown speed, m/s) }
// variants     { <params.variant>: { <key>: {...} } } per-variant overrides, merged one level deep
// actions      (full list in core/motion/birdActions.js)
//              { attack: { style: 'peck' | 'lunge' | 'talons', mantle }, eat: { style: 'peck' | 'tear', reach, billPitch, bodyPitch, drop (peck pose),
//              rate }, drink: {}, jump: { height, distance }, sleep: { style: 'tuck' | 'sink' } }
// ------------------------------------------------------------------------------------------------
import * as THREE from 'three';
import {
  TAU, DEG, clamp, lerp, smooth, wrap01, d01, angDiff, smin, Spring, tv, tvc, tq, tqc, tqa,
  UP, X1, Z1, ONE, prng, frameQuat, writeFrameC, mulAffine,
} from './common.js';
import { wingFK, makeWingFrames, featherFrame, rectrixFrame, makeFeatherFrame, resolveFeathers, extension, v3 } from '../rig/bird.js';
import { BirdActions } from './birdActions.js';
import { vaneWidth } from '../build/featherCards.js';

const G = 9.81;
const LEGS = ['L', 'R'];
const isDeathPosture = (p) => p.name === 'death';
const _m4 = new THREE.Matrix4(), _m4b = new THREE.Matrix4(), _m4c = new THREE.Matrix4(), _qD = new THREE.Quaternion();
const _sp = new THREE.Vector3(), _sq = new THREE.Quaternion(), _ss = new THREE.Vector3(), _st = new THREE.Vector3();
const NECK_GAZE_YAW = 0.35, NECK_GAZE_PITCH = 0.25; // share of the gaze turned by the whole neck
const ELEV_CAP = 60 * Math.PI / 180; // wing elevation above the horizontal: soft cap (see poseWings)
const DEFAULT_TUCK = { back: 0.82, down: 0.04, side: 0.55 }; // flight.legTuck default (see poseLegs)
const TOES = [1, 2, 3, 4];
const WING_KEYS = ['elev', 'pitch', 'alpha', 'elbow', 'wrist', 'bend', 'twist'];
const expTo = (x, target, dt, tau) => x + (target - x) * (1 - Math.exp(-dt / tau));
const smoother = (x) => { const t = clamp(x, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

// Ground support of the body, measured on the built skin (not a hand-entered section): the extreme
// vertices, in ~190 directions that can face the ground, of the skin dominated by the torso (pelvis,
// chest) and the thighs (femurs): the points of the skin's convex hull that a lying, sitting, rolled or
// fluffed body rests on. They keep their skin weights and are skinned like the renderer does (dual
// quaternions with the bind-space scale pre-pass) while the body rests. Cached per build data (a
// flock shares one build).
const SUPPORT_CACHE = new WeakMap();
function groundSupport(data, bi) {
  if (SUPPORT_CACHE.has(data)) return SUPPORT_CACHE.get(data);
  let out = null;
  const pos = data.pos, SI = data.skinIndex, SW = data.skinWeight, coat = data.coat;
  if (pos && SI && SW && bi.pelvis !== undefined && bi.chest !== undefined) {
    const groups = [bi.pelvis, bi.chest, bi.femurL ?? -1, bi.femurR ?? -1];
    const lists = groups.map(() => []);
    for (let v = 0; v < data.nV; v++) {
      if (coat && coat[v * 4 + 3] < 0.5) continue; // hidden half of a cross-fade band
      const g = groups.indexOf(SI[v * 4]);
      if (g >= 0) lists[g].push(v);
    }
    // directions (Fibonacci sphere) that can face the ground in any pose (a body rolled onto its side
    // still has its dorsal half up)
    const dirs = [];
    const ND = 256;
    for (let i = 0; i < ND; i++) {
      const y = 1 - (2 * i + 1) / ND, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653;
      if (y < 0.4) dirs.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    const set = new Set();
    let minY = Infinity;
    for (let g = 0; g < 4; g++) {
      for (const d of dirs) {
        let best = -Infinity, bv = -1;
        for (const v of lists[g]) { const s = pos[v * 3] * d[0] + pos[v * 3 + 1] * d[1] + pos[v * 3 + 2] * d[2]; if (s > best) { best = s; bv = v; } }
        if (bv >= 0) set.add(bv);
      }
      if (g < 2) for (const v of lists[g]) minY = Math.min(minY, pos[v * 3 + 1]);
    }
    const verts = [...set];
    if (verts.length) {
      const n = verts.length, P = new Float64Array(n * 3), I = new Uint16Array(n * 4), W = new Float32Array(n * 4);
      const bones = new Set();
      verts.forEach((v, k) => {
        for (let c = 0; c < 3; c++) P[k * 3 + c] = pos[v * 3 + c];
        for (let c = 0; c < 4; c++) { I[k * 4 + c] = SI[v * 4 + c]; W[k * 4 + c] = SW[v * 4 + c]; if (SW[v * 4 + c] > 0) bones.add(SI[v * 4 + c]); }
      });
      out = { n, P, I, W, bones: Int32Array.from(bones), minY };
    }
  }
  SUPPORT_CACHE.set(data, out);
  return out;
}

const DEFAULTS = {
  ground: { maxSpeed: 2, accel: [2.5, 4], decel: 5, turnRate: 4 },
  feet: { spread: [0, 0, 0, 0], curl: 70, grip: 1, pad: 0.005 },
  body: { tilt: 30 },
  head: { bob: 0.6, yaw: 2.4, pitchUp: 0.9, pitchDown: 1.2, saccade: 1, cock: 0.3 },
  tail: { pitch: 0, walkBob: 5, sway: 4, flick: 1, fanRest: 0.05 },
  flight: { minSpeed: 5, cruise: 10, maxSpeed: 14, climb: [3, -5], bankMax: 55, turnRate: 2.2, clearance: 1.5, glideRatio: 7, sustained: true, maxTime: 6 },
  takeoff: { crouch: 0.16, jump: 2.2, angle: 35, beats: 5 },
  landing: { approach: 7, flare: 0.55, touch: 1.0 },
};

// Wing skin support: per wing bone (humerus, ulna, hand; L and R), the extreme vertices of its skin in
// ~40 directions, in the bone's bind-local frame, and the farthest one from the bone (m). Cached per
// build data.
const WING_SUP_CACHE = new WeakMap();
function wingSupport(data, bi, inverses) {
  if (WING_SUP_CACHE.has(data)) return WING_SUP_CACHE.get(data);
  let out = null;
  const pos = data.pos, SI = data.skinIndex, SW = data.skinWeight, coat = data.coat;
  const names = [['humerusL', 'ulnaL', 'handL'], ['humerusR', 'ulnaR', 'handR']];
  if (pos && SI && names.every((n) => n.every((b) => bi[b] !== undefined))) {
    const dirs = [];
    for (let i = 0; i < 40; i++) { const y = 1 - (2 * i + 1) / 40, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653; dirs.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
    out = names.map((side) => side.map((b) => {
      const ib = bi[b], inv = inverses[ib].elements, list = [];
      for (let v = 0; v < data.nV; v++) if (SI[v * 4] === ib && SW[v * 4] >= 0.5 && !(coat && coat[v * 4 + 3] < 0.5)) list.push(v);
      const set = new Set();
      for (const d of dirs) {
        let best = -Infinity, bv = -1;
        for (const v of list) { const sc = pos[v * 3] * d[0] + pos[v * 3 + 1] * d[1] + pos[v * 3 + 2] * d[2]; if (sc > best) { best = sc; bv = v; } }
        if (bv >= 0) set.add(bv);
      }
      const pts = [];
      let rMax = 0;
      for (const v of set) {
        const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
        const lx = inv[0] * x + inv[4] * y + inv[8] * z + inv[12], ly = inv[1] * x + inv[5] * y + inv[9] * z + inv[13], lz = inv[2] * x + inv[6] * y + inv[10] * z + inv[14];
        pts.push(lx, ly, lz);
        rMax = Math.max(rMax, Math.hypot(lx, lz)); // (bone frame: +Y along the bone)
      }
      // bounding sphere of the points (bone frame): centre of the box, farthest point from it
      const c = [0, 1, 2].map((a) => { let lo = Infinity, hi = -Infinity; for (let k = a; k < pts.length; k += 3) { lo = Math.min(lo, pts[k]); hi = Math.max(hi, pts[k]); } return 0.5 * (lo + hi); });
      let R = 0;
      for (let k = 0; k < pts.length; k += 3) R = Math.max(R, Math.hypot(pts[k] - c[0], pts[k + 1] - c[1], pts[k + 2] - c[2]));
      return { ib, pts: Float64Array.from(pts), rMax, c, R };
    }));
  }
  WING_SUP_CACHE.set(data, out);
  return out;
}

// Head skin support: the skin that can meet the ground when the head is low (pecking, a bill wiped on
// the ground, a dead bird's head on its side): the extreme vertices, in 64 directions, of the skin the
// head and the lower mandible move (head + jaw weight >= 0.3), taken in the bind pose and with the head
// bent against the neck (pitched down and up, rolled, turned): a blended vertex (throat, chin) is not
// on the bind hull, but the neck's share of its weight drags it below the bill when the head bends.
// They keep their skin weights and are skinned like the renderer (dual quaternions). A bill wiped on
// the ground put a hen's wattles 6 mm and a crow's throat 9 mm into it: the fixed bill / chin points
// did not see them. Cached per build data.
const HEAD_SUP_CACHE = new WeakMap();
function headSupport(data, bi) {
  if (HEAD_SUP_CACHE.has(data)) return HEAD_SUP_CACHE.get(data);
  let out = null;
  const pos = data.pos, SI = data.skinIndex, SW = data.skinWeight, coat = data.coat, J = data.joints;
  const ih = bi.head, ij = bi.jaw ?? -1;
  if (pos && SI && SW && ih !== undefined && J.occiput) {
    const list = [], wl = [];
    for (let v = 0; v < data.nV; v++) {
      if (coat && coat[v * 4 + 3] < 0.5) continue;
      let w = 0;
      for (let c = 0; c < 4; c++) { const b = SI[v * 4 + c]; if (b === ih || b === ij) w += SW[v * 4 + c]; }
      if (w >= 0.3) { list.push(v); wl.push(w); }
    }
    const O = J.occiput;
    // configurations of the head (and jaw, rigidly) against the rest: rotations about the occiput
    // (x: pitch, + bill down; z: roll; y: turn), blended with the identity by the head's weight (DQS)
    const confs = [[0, 0, 0], [0.7, 0, 0], [1.4, 0, 0], [-0.7, 0, 0], [0.7, 0, 0.9], [0.7, 0, -0.9], [0.5, 0.9, 0], [0.5, -0.9, 0]];
    const q = new THREE.Quaternion(), e = new THREE.Euler(), o = new THREE.Vector3(), t = new THREE.Vector3(), pp = new THREE.Vector3();
    const qi = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const Xs = new Float64Array(list.length * 3);
    const set = new Set();
    for (const [ax, ay, az] of confs) {
      q.setFromEuler(e.set(ax, ay, az, 'YXZ'));
      // translation of the rotation about O: t = O - q O; dual part d = 0.5 (t, 0) q
      o.set(O[0], O[1], O[2]); t.copy(o).applyQuaternion(q).negate().add(o);
      const dq = [0.5 * (t.x * q.w + t.y * q.z - t.z * q.y), 0.5 * (t.y * q.w + t.z * q.x - t.x * q.z), 0.5 * (t.z * q.w + t.x * q.y - t.y * q.x), -0.5 * (t.x * q.x + t.y * q.y + t.z * q.z)];
      for (let k = 0; k < list.length; k++) {
        const v = list[k], w = wl[k], u = 1 - w;
        // blend (w q + u 1, w dq), normalised; point = rot(p) + translation
        qb.set(w * q.x, w * q.y, w * q.z, w * q.w + u);
        const L = Math.hypot(qb.x, qb.y, qb.z, qb.w);
        const rx = qb.x / L, ry = qb.y / L, rz = qb.z / L, rw = qb.w / L, dx = w * dq[0] / L, dy = w * dq[1] / L, dz = w * dq[2] / L, dw = w * dq[3] / L;
        const tx = 2 * (rw * dx - dw * rx + (ry * dz - rz * dy)), ty = 2 * (rw * dy - dw * ry + (rz * dx - rx * dz)), tz = 2 * (rw * dz - dw * rz + (rx * dy - ry * dx));
        pp.set(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]).applyQuaternion(qi.set(rx, ry, rz, rw));
        Xs[k * 3] = pp.x + tx; Xs[k * 3 + 1] = pp.y + ty; Xs[k * 3 + 2] = pp.z + tz;
      }
      for (let i = 0; i < 64; i++) {
        const y = 1 - (2 * i + 1) / 64, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653, dx = Math.cos(a) * r, dz = Math.sin(a) * r;
        let best = -Infinity, bk = -1;
        for (let k = 0; k < list.length; k++) { const sc = Xs[k * 3] * dx + Xs[k * 3 + 1] * y + Xs[k * 3 + 2] * dz; if (sc > best) { best = sc; bk = k; } }
        if (bk >= 0) set.add(bk);
      }
    }
    const ks = [...set];
    if (ks.length) {
      const n = ks.length, P = new Float64Array(n * 3), I = new Uint16Array(n * 4), W = new Float32Array(n * 4), wH = new Float32Array(n);
      const bones = new Set();
      let rMax = 0;
      ks.forEach((kk, k) => {
        const v = list[kk];
        for (let c = 0; c < 3; c++) P[k * 3 + c] = pos[v * 3 + c];
        for (let c = 0; c < 4; c++) { I[k * 4 + c] = SI[v * 4 + c]; W[k * 4 + c] = SW[v * 4 + c]; if (SW[v * 4 + c] > 0) bones.add(SI[v * 4 + c]); }
        wH[k] = wl[kk];
        rMax = Math.max(rMax, Math.hypot(pos[v * 3] - O[0], pos[v * 3 + 1] - O[1], pos[v * 3 + 2] - O[2]));
      });
      bones.add(ih); if (ij >= 0) bones.add(ij);
      out = { n, P, I, W, wH, bones: Int32Array.from(bones), rMax };
    }
  }
  HEAD_SUP_CACHE.set(data, out);
  return out;
}

// Preening spots: the skin on each side of the breast in front of the wing, measured on the mesh (the
// visible chest skin farthest out in that direction, within the neck's comfortable reach), so the bill
// tip goes to the feathers - a fixed body-frame point put a hen's head inside its breast. Bind world
// positions and outward normals, [left, right]; cached per build data.
const PREEN_CACHE = new WeakMap();
function preenSpots(data, bi, reach) {
  if (PREEN_CACHE.has(data)) return PREEN_CACHE.get(data);
  let out = null;
  const pos = data.pos, nrm = data.nrm, SI = data.skinIndex, SW = data.skinWeight, coat = data.coat, J = data.joints;
  if (pos && nrm && SI && bi.chest !== undefined && J.neckBase && J.synsacrum) {
    const nb = J.neckBase, sy = J.synsacrum;
    const c = [0, 1, 2].map((k) => sy[k] + (nb[k] - sy[k]) * 0.55);
    out = [1, -1].map((side) => {
      const d = [side * 0.8, -0.15, 0.58], dl = Math.hypot(...d);
      let best = -Infinity, bv = -1;
      for (let v = 0; v < data.nV; v++) {
        if (SI[v * 4] !== bi.chest || SW[v * 4] < 0.5 || (coat && coat[v * 4 + 3] < 0.5)) continue;
        const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
        if (Math.hypot(x - nb[0], y - nb[1], z - nb[2]) > reach) continue;
        const sc = ((x - c[0]) * d[0] + (y - c[1]) * d[1] + (z - c[2]) * d[2]) / dl;
        if (sc > best) { best = sc; bv = v; }
      }
      return bv < 0 ? null : { p: [pos[bv * 3], pos[bv * 3 + 1], pos[bv * 3 + 2]], n: [nrm[bv * 3], nrm[bv * 3 + 1], nrm[bv * 3 + 2]] };
    });
    if (!out[0] || !out[1]) out = null;
  }
  PREEN_CACHE.set(data, out);
  return out;
}

// ------------------------------------------------------------------------------------------------
function resolveConfig(spec0, data) {
  // per-variant overrides (species.motion.variants[params.variant]), merged one level deep
  const vo = spec0.variants?.[data.params?.variant];
  let spec = vo ? { ...spec0 } : spec0;
  if (vo) for (const [k, v] of Object.entries(vo)) spec[k] = v && typeof v === 'object' && !Array.isArray(v) && spec0[k] && typeof spec0[k] === 'object' ? { ...spec0[k], ...v } : v;
  // per-individual overrides: species.motion.individual(params) returns top-level keys that replace
  // the species' (e.g. a rooster's attack style, a chick's wing and feathers)
  if (typeof spec.individual === 'function') spec = { ...spec, ...(spec.individual(data.params || {}) || {}) };
  const J = {};
  for (const [k, v] of Object.entries(data.joints)) J[k] = new THREE.Vector3(v[0], v[1], v[2]);
  const s = data.params?.size || 1, sq = Math.sqrt(s);
  const merge = (a, b) => ({ ...a, ...(b || {}) });
  const cfg = {
    J, s, sq,
    maxSpeed: (spec.maxSpeed ?? 14) * sq,
    ground: merge(DEFAULTS.ground, spec.ground),
    feet: merge(DEFAULTS.feet, spec.feet),
    head: merge(DEFAULTS.head, spec.head),
    tail: merge(DEFAULTS.tail, spec.tail),
    flight: merge(DEFAULTS.flight, spec.flight),
    takeoff: merge(DEFAULTS.takeoff, spec.takeoff),
    landing: merge(DEFAULTS.landing, spec.landing),
    actions: spec.actions || {},
    gaits: (spec.gaits || []).map((g) => ({ f: 2, D: 0.65, off: [0, 0.5], lift: 0.02, bob: 0.004, hop: 0, sway: 0, pitch: 0, headBob: 0, wings: 0, tail: 0, ...g })),
  };
  if (!cfg.gaits.length) throw new Error('procedural-animals bird: species.motion.gaits is required');
  cfg.ground.maxSpeed *= sq; cfg.ground.turnRate /= sq;
  cfg.gears = spec.gears ? Object.fromEntries(Object.entries(spec.gears).map(([k, v]) => [k, v * sq])) : { walk: 0.5 * sq, fly: 10 * sq };
  const fl = cfg.flight;
  fl.minSpeed *= sq; fl.cruise *= sq; fl.maxSpeed = Math.min(fl.maxSpeed * sq, cfg.maxSpeed);
  fl.climbUp = fl.climb[0] * sq; fl.climbDown = fl.climb[1] * sq; fl.clearance *= s;
  fl.bankMax *= DEG;
  cfg.takeoff.jump *= sq; cfg.takeoff.angle *= DEG;
  cfg.landing.approach *= sq; cfg.landing.touch *= sq;
  cfg.feet.pad = (cfg.feet.pad ?? J.mtpL.y) * s;
  if (cfg.feet.sole !== undefined) cfg.feet.sole *= s;
  cfg.tilt = (spec.body?.tilt ?? 30) * DEG;
  // flight.shape (opt-in): the standing body axis and its ventral normal (bind frame) carry the head
  // forward and down in flight
  if (spec.flight?.shape) {
    const fs = spec.flight.shape;
    cfg.shape = {
      reach: fs.reach || 0, drop: fs.drop || 0, neck: clamp(fs.neck || 0, 0, 0.9), fan: clamp(fs.fan || 0, 0, 1), back: fs.back || 0, legs: clamp(fs.legs || 0, 0, 0.9),
      body: fs.body ? [fs.body[0] ?? 1, fs.body[1] ?? 1, fs.body[2] ?? 1] : null,
      ax: new THREE.Vector3(0, Math.sin(cfg.tilt), Math.cos(cfg.tilt)), vent: new THREE.Vector3(0, -Math.cos(cfg.tilt), Math.sin(cfg.tilt)),
    };
  } else cfg.shape = null;
  // ---- body pivot (between the hips) and belly section
  cfg.pivot = J.hipL.clone().add(J.hipR).multiplyScalar(0.5);
  cfg.pivotY = cfg.pivot.y;
  const bb = spec.body?.belly || {};
  cfg.belly = {
    c: new THREE.Vector3(0, (bb.y ?? cfg.pivotY) * s, J.synsacrum.z),
    hh: (bb.hh ?? 0.35 * cfg.pivotY) * s, hw: (bb.hw ?? Math.abs(J.hipL.x) * 1.6) * s,
  };
  // ---- legs
  cfg.legs = LEGS.map((S, idx) => {
    const side = S === 'L' ? 1 : -1;
    const hip = J['hip' + S], knee = J['knee' + S], ankle = J['ankle' + S], mtp = J['mtp' + S];
    const L = { S, side, idx, key: 'leg' + S };
    L.L1 = hip.distanceTo(knee); L.L2 = knee.distanceTo(ankle); L.L3 = ankle.distanceTo(mtp);
    L.len = L.L1 + L.L2 + L.L3;
    L.hip = hip.clone().sub(cfg.pivot); // body-local
    L.femur0 = knee.clone().sub(hip).normalize(); // body-local rest femur direction
    L.cx = Math.abs(mtp.x); L.cz = mtp.z - cfg.pivot.z; // neutral foot point (ground, heading frame)
    L.pad = mtp.y;
    // bind tarsus lean (ankle behind the MTP)
    L.tarsus0 = ankle.clone().sub(mtp).normalize();
    // toes in the foot frame (x lateral (own side positive), y up, z forward), per segment
    L.toes = TOES.map((j) => {
      const m = J[`t${j}m${S}`], t = J[`t${j}t${S}`];
      const a = m.clone().sub(mtp), b = t.clone().sub(m);
      a.x *= side; b.x *= side;
      // (eA / eB: bind elevation of each segment in the foot frame, + up: a curl lowers every toe, the
      // hallux included, from there)
      const la = a.length(), lb = b.length();
      return { j, a, b, la, lb, back: j === 1, eA: Math.asin(clamp(a.y / Math.max(la, 1e-9), -1, 1)), eB: Math.asin(clamp(b.y / Math.max(lb, 1e-9), -1, 1)) };
    });
    L.toeLen = L.toes[2].la + L.toes[2].lb;
    L.n = {
      femur: 'femur' + S, tibia: 'tibia' + S, tarsus: 'tarsus' + S,
      toeA: TOES.map((j) => `toe${j}a${S}`), toeB: TOES.map((j) => `toe${j}b${S}`),
    };
    return L;
  });
  cfg.legLen = cfg.legs[0].len;
  cfg.footLen = cfg.legs[0].toeLen;
  // ---- neck & head
  cfg.neckN = 0;
  while (data.bones.some((b) => b.name === 'neck' + cfg.neckN)) cfg.neckN++;
  const nj = (i) => (i === 0 ? 'neckBase' : i === cfg.neckN ? 'occiput' : 'neck' + i);
  cfg.neckJ = Array.from({ length: cfg.neckN + 1 }, (_, i) => J[nj(i)]);
  cfg.neckL = Array.from({ length: cfg.neckN }, (_, i) => cfg.neckJ[i].distanceTo(cfg.neckJ[i + 1]));
  cfg.neckLen = cfg.neckL.reduce((a, b) => a + b, 0);
  cfg.neckBaseLocal = J.neckBase.clone().sub(cfg.pivot);
  cfg.neckSeg0 = cfg.neckJ[1].clone().sub(cfg.neckJ[0]).normalize(); // first segment at bind (body-local)
  cfg.occLocal = J.occiput.clone().sub(cfg.pivot);
  fitNeckCurve(cfg);
  cfg.billLocal = J.bill.clone().sub(J.occiput);
  cfg.mouthLocal = J.jawTip ? J.jawTip.clone().lerp(J.bill, 0.5).sub(J.occiput) : cfg.billLocal.clone();
  cfg.hasJaw = data.bones.some((b) => b.name === 'jaw');
  cfg.jawRest = (cfg.head.jawRest ?? 0) * DEG; // closed-bill rest angle of the mandible (deg, - closes)
  // (head.radius is metres at the reference size, as the schema says: scaled - a chick carried a hen's skull)
  cfg.headR = spec.head?.radius !== undefined ? spec.head.radius * s : 0.2 * J.occiput.distanceTo(J.bill);
  cfg.chinLocal = J.jawHinge ? J.jawHinge.clone().lerp(J.jawTip || J.bill, 0.3).sub(J.occiput).add(new THREE.Vector3(0, -cfg.headR * 0.6, 0)) : new THREE.Vector3(0, -cfg.headR, 0);
  cfg.headH = cfg.occLocal.y + cfg.pivotY; // occiput height standing
  // ---- tail
  cfg.tailLocal = J.tailBase.clone().sub(cfg.pivot);
  cfg.tailLen = J.tailBase.distanceTo(J.tailTip);
  cfg.tailDir0 = J.tailTip.clone().sub(J.tailBase).normalize();
  cfg.tailRel = Math.atan2(cfg.tailDir0.y, -cfg.tailDir0.z) + (spec.body?.tilt ?? 30) * DEG; // tail above the body axis (rad)
  // ---- wings
  const w = spec.wing || {};
  const conf = (a) => { const o = {}; for (const k of WING_KEYS) o[k] = (a?.[k] || 0) * DEG; o.uTwist = (a?.uTwist || 0) * DEG; o.tilt = (w.tilt || 0) * DEG; return o; };
  cfg.wing = {
    L: { h: J.shoulderL.distanceTo(J.elbowL), u: J.elbowL.distanceTo(J.wristL), m: J.wristL.distanceTo(J.handTipL) },
    bind: conf(w.bind), fold: conf(w.fold), glide: conf(w.glide || w.bind),
    flap: { freq: 4, amp: 100, mid: 5, down: 0.55, upFlex: 30, upWrist: 40, sweep: 10, twist: 12, ...(w.flap || {}) },
    power: { freq: 6, amp: 140, mid: 12, down: 0.52, upFlex: 50, upWrist: 65, sweep: 20, twist: 18, ...(w.power || w.flap || {}) },
    glideShare: w.glideShare ?? 0.15, soar: w.soar ?? 0, tilt: (w.tilt || 0) * DEG, fingerLift: (w.fingerLift || 0) * DEG, groundLift: (w.groundLift || 0) * DEG, skin: w.skin ?? 0.006,
    shoulder: LEGS.map((S) => J['shoulder' + S].clone().sub(cfg.pivot)),
  };
  for (const k of ['flap', 'power']) { const f = cfg.wing[k]; f.freq /= sq; f.amp *= DEG; f.mid *= DEG; f.upFlex *= DEG; f.upWrist *= DEG; f.sweep *= DEG; f.twist *= DEG; }
  // ---- feathers (lengths from the final joints)
  const F = resolveFeathers(spec.feathers || {});
  const flen = (n) => J[n + 'rL'] && J[n + 'tL'] ? J[n + 'rL'].distanceTo(J[n + 'tL']) : 0;
  cfg.pri = F.primaries.filter((f) => data.bones.some((b) => b.name === `pri${f.i + 1}L`)).map((f) => ({ ...f, len: flen(`pri${f.i + 1}`), sc: s }));
  cfg.sec = F.secondaries.filter((f) => data.bones.some((b) => b.name === `sec${f.i + 1}L`)).map((f) => ({ ...f, len: flen(`sec${f.i + 1}`), sc: s }));
  cfg.rec = F.rectrices.filter((f) => data.bones.some((b) => b.name === `rec${f.i + 1}L`)).map((f) => ({ ...f, len: flen(`rec${f.i + 1}`), sc: s }));
  for (const f of [...cfg.pri, ...cfg.sec]) { f.u0 = f.u; f.lift *= s; f.back *= s; }
  for (const f of cfg.rec) { f.x *= s; f.lift *= s; }
  // widest half vane of each feather card with its covert (core/build/featherCards.js: coverts up to
  // 1.2x wider), for the engine's vane-edge ground check
  // the card's shape for the engine's ground checks (core/build/featherCards.js): the rachis curves
  // toward the inner vane by curve L t^2 and droops toward -normal by droop L t^2 (m at the tip); the
  // vane half-widths [t, outer, inner] at the checked points (near the root the covert's width too)
  for (const f of [...cfg.pri, ...cfg.sec, ...cfg.rec]) {
    f.vane = (f.width || 0) * s * Math.max(f.outer ?? 0.4, 1 - (f.outer ?? 0.4)) * 1.2;
    f.droopM = (f.droop || 0) * f.len;
    f.curveM = (f.curve || 0) * f.len;
    const vp = [];
    for (const t of [0.22, 0.55, 0.8, 0.92, 1]) {
      if (t <= 0.55) { vp.push(t, f.vane, f.vane); continue; }
      const [wo, wi] = f.width ? vaneWidth({ outer: f.outer ?? 0.4, tipRound: f.tipRound ?? 0.4, emarg: f.emarg || 0 }, t, f.width * s) : [0, 0];
      vp.push(t, wo * 1.05, wi * 1.05);
    }
    f.vp = Float64Array.from(vp);
  }
  cfg.wingExt = {
    fW: cfg.wing.fold.wrist, oW: cfg.wing.glide.wrist, fE: cfg.wing.fold.elbow, oE: cfg.wing.glide.elbow,
  };
  cfg.span = 2 * (cfg.wing.L.h + cfg.wing.L.u + cfg.wing.L.m + (cfg.pri.length ? Math.max(...cfg.pri.map((f) => f.len)) : 0)) + 2 * Math.abs(J.shoulderL.x);
  // roll response in flight (rad/s of a critically damped roll): a crow (0.9 m span) rolls into a turn
  // in ~0.3 s, an eagle (2 m) in ~0.5 s (roll inertia grows with the span; dynamic similarity)
  cfg.rollOmega = 6.5 * Math.sqrt(0.9 / Math.max(0.1, cfg.span));
  // share of the tail's flight alignment a tail without flight feathers gives up: none for a chick's
  // stub (pin feathers 5 % of its leg: swung down 56 deg in flight, it sheared the rump's skin), all for
  // a tail of real rectrices (>= 25 % of the leg)
  cfg.tailFlightK = smooth(0.05, 0.25, (cfg.rec.length ? Math.max(...cfg.rec.map((f) => f.len)) : 0) / Math.max(1e-6, cfg.legLen));
  return cfg;
}

// Bind neck as a cubic Bezier (the shape the engine bends): end tangents from the joints (quadratic
// estimate), tangent length fitted to the bind joints, and the curve's arc length. At rest the engine's
// curve then reproduces the bind neck (no distortion), and every pose bends the same curve.
function bezierArc(A, t0, B, t1, k, pts, S) {
  const M = pts.length - 1;
  let L = 0;
  for (let i = 0; i <= M; i++) {
    const u = i / M, a = 1 - u, b0 = a * a * a, b1 = 3 * a * a * u, b2 = 3 * a * u * u, b3 = u * u * u;
    pts[i].set(
      b0 * A.x + b1 * (A.x + t0.x * k) + b2 * (B.x - t1.x * k) + b3 * B.x,
      b0 * A.y + b1 * (A.y + t0.y * k) + b2 * (B.y - t1.y * k) + b3 * B.y,
      b0 * A.z + b1 * (A.z + t0.z * k) + b2 * (B.z - t1.z * k) + b3 * B.z);
    if (i) L += pts[i].distanceTo(pts[i - 1]);
    S[i] = L;
  }
  return L;
}
function pointAtArc(pts, S, s, out) {
  let j = 1;
  while (j < pts.length - 1 && S[j] < s) j++;
  const f = clamp((s - S[j - 1]) / Math.max(1e-9, S[j] - S[j - 1]), 0, 1);
  return out.copy(pts[j - 1]).lerp(pts[j], f);
}
function fitNeckCurve(cfg) {
  const Jn = cfg.neckJ, N = cfg.neckN, A = Jn[0], B = Jn[N];
  const est = (p0, p1, p2, sgn) => p1.clone().multiplyScalar(4).sub(p0.clone().multiplyScalar(3)).sub(p2).multiplyScalar(sgn).normalize();
  cfg.neckT0 = N >= 2 ? est(A, Jn[1], Jn[2], 1) : B.clone().sub(A).normalize(); // body-local
  cfg.neckT1 = N >= 2 ? est(B, Jn[N - 1], Jn[N - 2], -1) : B.clone().sub(A).normalize(); // head-local (bind head frame = identity)
  const d0 = A.distanceTo(B);
  const pts = Array.from({ length: 65 }, () => new THREE.Vector3()), S = new Float64Array(65), q = new THREE.Vector3();
  let best = Infinity, bk = 0.4 * d0, barc = cfg.neckLen;
  for (let i = 1; i <= 60; i++) {
    const k = d0 * i / 50;
    const arc = bezierArc(A, cfg.neckT0, B, cfg.neckT1, k, pts, S);
    let e = 0;
    for (let j = 1; j < N; j++) e += pointAtArc(pts, S, (arc * j) / N, q).distanceToSquared(Jn[j]);
    if (e < best) { best = e; bk = k; barc = arc; }
  }
  cfg.neckChord0 = d0;
  cfg.neckArc = barc; // arc length of the bind curve
  cfg.neckK0 = bk / d0;
}

// ------------------------------------------------------------------------------------------------
export function createBirdMotion(ctx) { return new BirdMotion(ctx); }

export class BirdMotion {
  constructor({ species, data, skeleton, ground, water, perches, position, heading = 0, emit }) {
    this.species = species;
    this.cfg = resolveConfig(species.motion || {}, data);
    const cfg = this.cfg;
    this.sk = skeleton;
    this.ground = ground || (() => 0);
    this.water = water || null;
    this.perches = (perches || []).map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p.x, p.y, p.z)));
    this.emit = emit || (() => {});
    this.rand = prng((data.seed || 1) * 7919 + 29);
    this.J = cfg.J;
    // ---- bones
    this.bi = {};
    this.bindQ = [];
    for (let i = 0; i < data.bones.length; i++) {
      this.bi[data.bones[i].name] = i;
      this.bindQ.push(new THREE.Quaternion().setFromRotationMatrix(skeleton.bind[i]));
    }
    this.C = data.bones.map(() => new THREE.Quaternion()); // frame -> bone offsets (see setBoneC)
    this._initFrames(data);
    // wing skin support (see wingSupport)
    this._wingSup = wingSupport(data, this.bi, skeleton.inverses || skeleton.bind.map((m) => m.clone().invert()));
    // head skin support (see headSupport)
    this._headSup = headSupport(data, this.bi);
    // preening spots on the breast skin (see preenSpots): body-local (relative to the pivot, bind)
    {
      const ps = preenSpots(data, this.bi, 0.85 * (cfg.neckArc + cfg.billLocal.length()));
      this._preen = ps ? ps.map((o) => ({ p: new THREE.Vector3(...o.p).sub(cfg.pivot), n: new THREE.Vector3(...o.n).normalize() })) : null;
    }
    // body support on the ground, from the skin (see groundSupport): per-bone skinning data of the bones
    // its vertices use (bind rotation, translation and axes, as core/render/dqs.js)
    this.sup = groundSupport(data, this.bi);
    if (this.sup || this._headSup) {
      this._supD = new Float64Array(data.bones.length * 20);
      this._supBind = [];
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      for (const set of [this.sup, this._headSup]) {
        if (!set) continue;
        for (const i of set.bones) {
          if (this._supBind[i]) continue;
          skeleton.bind[i].decompose(p, q, sc);
          this._supBind[i] = { qi: q.clone().invert(), t: p.clone(), R: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)) };
        }
      }
      this._supPrev = new THREE.Matrix4(); this._supPrevOk = false;
    }
    // numeric bone indices for the per-frame writers (-1 = absent)
    const ix = (n) => (this.bi[n] ?? -1);
    this.ix = {
      neck: Array.from({ length: cfg.neckN }, (_, i) => ix('neck' + i)),
      wing: LEGS.map((S) => ({ humerus: ix('humerus' + S), ulna: ix('ulna' + S), hand: ix('hand' + S) })),
      pri: LEGS.map((S) => cfg.pri.map((f) => ix(`pri${f.i + 1}${S}`))),
      sec: LEGS.map((S) => cfg.sec.map((f) => ix(`sec${f.i + 1}${S}`))),
      rec: LEGS.map((S) => cfg.rec.map((f) => ix(`rec${f.i + 1}${S}`))),
      toes: cfg.legs.map((L) => ({ tarsus: ix(L.n.tarsus), toes: [...L.n.toeA, ...L.n.toeB].map(ix) })),
      tail: ix('tail'), pelvis: ix('pelvis'), chest: ix('chest'), head: ix('head'), jaw: ix('jaw'),
    };
    // crowd LOD: feathers follow their carrier bone rigidly between full solves (every 3rd frame)
    this.rel = data.bones.map(() => new THREE.Matrix4());
    this.lodPhase = (data.seed || 0) % 3;
    // ---- public contract
    this.input = { speed: 0, heading, climb: 0, look: null, follow: null, target: null, targetSpeed: 1, crouch: 0, gait: null };
    this.pos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = heading;
    this.speed = 0;
    this.state = {
      position: this.pos, heading, speed: 0, velocity: this.velocity, gait: 'stand', grounded: true,
      action: null, posture: 'stand', eyelid: 0, lookTarget: null, mode: 'ground', altitude: 0,
      stats: { gait: 'stand', freq: 0, duty: 1, flapFreq: 0 },
      legs: LEGS.map((S) => ({ key: 'leg' + S, stance: true, contact: new THREE.Vector3() })),
    };
    this.headPose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
    this.debug = { targets: Array.from({ length: 6 }, () => new THREE.Vector3()) };
    this.gaits = [...new Set(cfg.gaits.map((g) => g.name)), 'fly'];
    this.gears = cfg.gears;
    this.lod = 0; this.frame = 0; this.time = 0;
    // ---- dynamic state
    this.mode = 'ground'; // ground | takeoff | air | landing | perch
    this.yawRate = 0;
    this.phase = 0;
    this.gait = { name: 'walk', f: 0, D: 0.65, off: [0, 0.5], lift: 0, bob: 0, hop: 0, sway: 0, pitch: 0, headBob: 0, wings: 0, tail: 0, hopW: 0 };
    this.body = new THREE.Vector3(); // world pivot
    this.bodyV = new THREE.Vector3();
    this.vy = 0;
    this.hY = new Spring(0); this.pitchS = new Spring(0); this.bankS = new Spring(0); this.swayS = new Spring(0); this.hopS = new Spring(0);
    this.turnBankS = new Spring(0); this.turnBank = 0; this._flying = false; // flight: bank of the turn (+ = left)
    this.qB = new THREE.Quaternion(); this.qH = new THREE.Quaternion();
    this.F = new THREE.Vector3(); this.Lf = new THREE.Vector3();
    this.lastVel = new THREE.Vector3(); this.accel = new THREE.Vector3();
    this.push = new THREE.Vector3();
    // flight
    this.fl = {
      psi: 0, amp: 0, ampS: new Spring(0), freq: 0, power: 0.5, glide: 0, powerS: new Spring(0.5), glideT: 3, gliding: 0, glideS: new Spring(0),
      open: new Spring(0), time: 0, alt: 0, forceGlide: 0, forceFlap: 0, flapBeats: 0, beatCount: 0, lastPsi: 0,
    };
    this.to = null; // takeoff state
    this.ld = null; // landing state
    this.perch = null; // { point, axis (branch direction), radius }
    this.airLeg = new Spring(0); // legs: 0 ground IK .. 1 air targets
    this.shapeW = 0; // flight.shape weight (0 ground .. 1 cruise flight; see pose)
    this.reachLeg = 0; // air leg target: 0 tucked .. 1 thrown forward (landing)
    // legs
    this.legs = cfg.legs.map((L) => ({
      def: L, state: 'stance', plant: new THREE.Vector3(), plantN: new THREE.Vector3(0, 1, 0), yaw: heading,
      liftLocal: new THREE.Vector3(), landLocal: new THREE.Vector3(), land: new THREE.Vector3(), contact: new THREE.Vector3(),
      swingT: 0, swingDur: 0.2, stanceTime: 0, prevPhase: 0, windowUsed: false, u: 0, w: 0, liftH: 0.02, mode: 'gait',
      idleOff: new THREE.Vector3(), roll: new Spring(0), curl: new Spring(0), spread: new Spring(1),
      mtp: new THREE.Vector3(), ankle: new THREE.Vector3(), knee: new THREE.Vector3(), hip: new THREE.Vector3(),
      airT: new THREE.Vector3(), frozen: new THREE.Vector3(), frozenOn: false, lastTarget: new THREE.Vector3(),
      yawS: new Spring(heading),
    }));
    // wings
    this.wf = [makeWingFrames(), makeWingFrames()];
    this.wp = [0, 1].map(() => Object.fromEntries(WING_KEYS.map((k) => [k, 0])));
    this.wingS = [0, 1].map(() => Object.fromEntries(WING_KEYS.map((k) => [k, new Spring(0)])));
    this.wingInit = false;
    this.ff = makeFeatherFrame();
    this._fw = { P0: v3(), d: v3(), n: v3(), lat: v3() };
    // tail
    this.tailS = { pitch: new Spring(0), yaw: new Spring(0), fan: new Spring(cfg.tail.fanRest), twist: new Spring(0) };
    // head / neck
    this.headS = { x: new Spring(0), y: new Spring(0), z: new Spring(0), init: false };
    this.gaze = { yaw: 0, pitch: 0, roll: 0, tyaw: 0, tpitch: 0, troll: 0, hold: 0 };
    this.gazeS = { yaw: new Spring(0), pitch: new Spring(0), roll: new Spring(0) };
    this.bobRef = new THREE.Vector3(); this.bobInit = false;
    this.jaw = new Spring(cfg.jawRest || 0);
    this.breath = 0;
    this.lookTarget = new THREE.Vector3();
    this._neck = { P: Array.from({ length: 4 }, () => new THREE.Vector3()), pts: Array.from({ length: 17 }, () => new THREE.Vector3()), s: new Float64Array(17), J: Array.from({ length: cfg.neckN + 1 }, () => new THREE.Vector3()) };
    // ---- actions
    this.P = null;
    this.actionsLayer = new BirdActions(this);
    this.P = this.actionsLayer.P;
    this.actions = this.actionsLayer.names;
    this.attachmentPoints = this._attachments(data);
    this.reset(position || new THREE.Vector3(), heading);
  }

  // bind frames -> constant offsets C (bone world quaternion = frameQuat(dir, ref) * C)
  _initFrames(data) {
    const cfg = this.cfg, J = this.J;
    const d = new THREE.Vector3(), r = new THREE.Vector3(), q = new THREE.Quaternion();
    const setC = (name, dir, ref) => {
      const i = this.bi[name];
      if (i === undefined) return;
      frameQuat(q, dir, ref);
      this.C[i].copy(q).invert().multiply(this.bindQ[i]);
    };
    // everything defaults to the lateral X reference at bind (C = identity up to rounding)
    data.bones.forEach((b) => {
      d.subVectors(J[b.tailJ], J[b.headJ]);
      setC(b.name, d, X1);
    });
    // wings and feathers: dorsal normals from the bind configuration
    for (let k = 0; k < 2; k++) {
      const S = LEGS[k], side = k === 0 ? 1 : -1, fr = this.wf ? this.wf[k] : makeWingFrames();
      wingFK(fr, side, cfg.wing.L, cfg.wing.bind);
      setC('humerus' + S, d.set(fr.dH.x, fr.dH.y, fr.dH.z), r.set(fr.nH.x, fr.nH.y, fr.nH.z));
      setC('ulna' + S, d.set(fr.dU.x, fr.dU.y, fr.dU.z), r.set(fr.nU.x, fr.nU.y, fr.nU.z));
      setC('hand' + S, d.set(fr.dM.x, fr.dM.y, fr.dM.z), r.set(fr.nM.x, fr.nM.y, fr.nM.z));
      const eH = extension(cfg.wing.bind.wrist, cfg.wingExt.fW, cfg.wingExt.oW);
      const eU = extension(cfg.wing.bind.elbow, cfg.wingExt.fE, cfg.wingExt.oE);
      const P0 = v3(fr.wrist.x, fr.wrist.y, fr.wrist.z), ff = makeFeatherFrame();
      for (const f of cfg.pri) {
        featherFrame(ff, P0, fr.dM, fr.nM, cfg.wing.L.m, side, f, f.fold + (f.spread - f.fold) * eH, false);
        const nm = `pri${f.i + 1}${S}`;
        d.subVectors(J[`pri${f.i + 1}t${S}`], J[`pri${f.i + 1}r${S}`]);
        setC(nm, d, r.set(ff.normal.x, ff.normal.y, ff.normal.z));
      }
      for (const f of cfg.sec) {
        featherFrame(ff, P0, fr.dU, fr.nU, cfg.wing.L.u, side, f, f.fold + (f.spread - f.fold) * eU, true);
        const nm = `sec${f.i + 1}${S}`;
        d.subVectors(J[`sec${f.i + 1}t${S}`], J[`sec${f.i + 1}r${S}`]);
        setC(nm, d, r.set(ff.normal.x, ff.normal.y, ff.normal.z));
      }
      // rectrices: bind tail frame (dorsal = up)
      const td = J.tailTip.clone().sub(J.tailBase).normalize();
      const tn = new THREE.Vector3().crossVectors(td, X1).normalize();
      if (tn.y < 0) tn.negate();
      for (const f of cfg.rec) {
        rectrixFrame(ff, v3(0, 0, 0), td, tn, X1, side, f, f.fold + (f.fan - f.fold) * 0.2);
        const nm = `rec${f.i + 1}${S}`;
        d.subVectors(J[`rec${f.i + 1}t${S}`], J[`rec${f.i + 1}r${S}`]);
        setC(nm, d, r.set(ff.normal.x, ff.normal.y, ff.normal.z));
      }
    }
  }

  _attachments(data) {
    const J = this.J, cfg = this.cfg;
    const at = (bone, p) => {
      const i = this.bi[bone];
      if (i === undefined) return null;
      const inv = this.sk.inverses ? this.sk.inverses[i] : this.sk.bind[i].clone().invert();
      return { bone, local: new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).premultiply(inv) };
    };
    let headP = J.occiput.clone().lerp(J.bill, 0.3);
    if (data.eyes?.length) { headP = new THREE.Vector3(); for (const e of data.eyes) headP.add(new THREE.Vector3(...e.c)); headP.multiplyScalar(1 / data.eyes.length); }
    const back = J.synsacrum.clone().lerp(J.neckBase, 0.4);
    back.y += cfg.belly.hh * 0.5;
    const out = { mouth: at('head', J.occiput.clone().add(cfg.mouthLocal)), head: at('head', headP), back: at('chest', back), footL: at('toe3aL', J.mtpL), footR: at('toe3aR', J.mtpR) };
    for (const k of Object.keys(out)) if (!out[k]) delete out[k];
    return out;
  }

  // ----------------------------------------------------------------- helpers
  forward(h, out) { return out.set(Math.sin(h), 0, Math.cos(h)); }
  left(h, out) { return out.set(Math.cos(h), 0, -Math.sin(h)); }
  bodyToWorld(lx, ly, lz, h, p, out) {
    const sh = Math.sin(h), ch = Math.cos(h);
    return out.set(p.x + ch * lx + sh * lz, p.y + ly, p.z - sh * lx + ch * lz);
  }
  terrainH(x, z) { const h = this.ground(x, z); return Number.isFinite(h) ? h : 0; }
  terrainN(x, z, out) {
    const e = 0.06 * this.cfg.s + 0.02, h0 = this.terrainH(x, z);
    return out.set(h0 - this.terrainH(x + e, z), e, h0 - this.terrainH(x, z + e)).normalize();
  }
  // body-local point (relative to the pivot, bind orientation) -> world
  B(p, out) { return out.copy(p).applyQuaternion(this.qB).add(this.body); }
  Bv(p, out) { return out.copy(p).applyQuaternion(this.qB); }
  setBoneC(name, head, dir, ref, scale) {
    // (the frame's matrix times the bone's constant offset, written directly: the quaternion round
    // trips of frameQuat * C -> compose were a large share of the crowd tier's cost)
    if (!this.Cm) {
      const m = new THREE.Matrix4();
      this.Cm = this.C.map((c) => { const e = m.makeRotationFromQuaternion(c).elements; return new Float64Array([e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]]); });
    }
    const i = typeof name === 'number' ? name : this.bi[name];
    if (i === undefined || i < 0) return;
    writeFrameC(this.sk.bones[i].matrixWorld, head, dir, ref, this.Cm[i], scale || null);
  }
  // children keep their transform relative to a carrier bone (crowd LOD, between full solves)
  store(parent, kids) {
    if (parent < 0) return;
    const inv = _m4.copy(this.sk.bones[parent].matrixWorld).invert();
    for (const k of kids) if (k >= 0) mulAffine(this.rel[k], inv, this.sk.bones[k].matrixWorld);
  }
  follow(parent, kids) {
    if (parent < 0) return;
    const M = this.sk.bones[parent].matrixWorld;
    for (const k of kids) if (k >= 0) mulAffine(this.sk.bones[k].matrixWorld, M, this.rel[k]);
  }
  setBoneQ(name, head, q, scale) {
    const i = typeof name === 'number' ? name : this.bi[name];
    if (i === undefined || i < 0) return;
    this.sk.bones[i].matrixWorld.compose(head, tqc(q).multiply(this.bindQ[i]), scale || ONE);
  }

  reset(p, heading = this.heading) {
    const cfg = this.cfg;
    this.heading = heading; this.input.heading = heading;
    this.pos.set(p.x, this.terrainH(p.x, p.z), p.z);
    this.speed = 0; this.yawRate = 0; this.vy = 0;
    this.velocity.set(0, 0, 0); this.lastVel.set(0, 0, 0);
    this.mode = 'ground';
    this.gaitAt(0);
    for (const leg of this.legs) {
      this.neutralContact(leg.def, 0, 0, leg.plant, leg);
      leg.contact.copy(leg.plant);
      leg.state = 'stance';
      this.terrainN(leg.plant.x, leg.plant.z, leg.plantN);
      leg.yaw = heading; leg.yawS.reset(heading);
    }
    this.body.set(this.pos.x, this.pos.y + cfg.pivotY, this.pos.z);
    this.hY.reset(this.pos.y + cfg.pivotY);
    this.pitchS.reset(0); this.bankS.reset(0);
    this.qH.setFromAxisAngle(UP, heading);
    this.qB.copy(this.qH);
    this.headS.init = false; this.bobInit = false; this.wingInit = false;
    this.airLeg.reset(0);
    if (this.shapeS) this.shapeS.reset(0);
    this.shapeW = 0;
    this.landOff = null; this._touchTime = undefined;
    this.pivot = null; this._standTurn = false;
  }

  // ----------------------------------------------------------------- public API
  play(name, opts) { return this.actionsLayer.play(name, opts || {}); }
  stop(name) { this.actionsLayer.stop(name); }
  setLod(level) { this.lod = clamp(level | 0, 0, 2); return this; }
  dispose() { this.actionsLayer.clear(); }
  get airborne() { return this.mode === 'air' || this.mode === 'landing' || (this.mode === 'takeoff' && this.to && this.to.air); }

  update(dt) {
    if (!(dt > 1e-4) || !Number.isFinite(dt)) dt = 1e-4;
    dt = Math.min(dt, 1 / 20);
    this._dt = dt;
    this.frame++;
    this.time += dt;
    // crowd LOD: the pose is solved every other frame (with the summed dt); in between the whole
    // skeleton moves rigidly with the root. Feathers and toes are re-solved on every 3rd solve.
    const skip = this.lod === 2 && ((this.frame + this.lodPhase) & 1) === 1 && this._rootInit;
    if (!skip) { this._poseN = (this._poseN || 0) + 1; this.fullFrame = this.lod < 2 || (this._poseN + this.lodPhase) % 3 === 0; }
    this.drive(dt);
    this.actionsLayer.update(dt);
    const mode = this.mode;
    if (mode === 'ground' || mode === 'perch' || (mode === 'takeoff' && !this.to.air)) this.stepGround(dt);
    if (mode === 'takeoff') this.stepTakeoff(dt);
    else if (mode === 'air') this.stepAir(dt);
    else if (mode === 'landing') this.stepLanding(dt);
    if (!this.airborne) { this._flying = false; this.turnBank = this.turnBankS.step(0, this.cfg.rollOmega, dt); }
    this.accel.copy(this.velocity).sub(this.lastVel).divideScalar(dt);
    this.lastVel.copy(this.velocity);
    this._pdt = (this._pdt || 0) + dt;
    this.rigidCarry = null; // (set by carryRigid: the render object then carries the skinning data too)
    if (skip) this.carryRigid();
    else { this.pose(this._pdt); this._pdt = 0; this.storeRoot(); }
    this.publish();
  }

  // root frame (ground point or flying body + heading) for the crowd LOD's rigid in-between frames
  rootFrame(out) {
    const r = this.airborne ? this.body : this.pos;
    return out.compose(r, this.qH.setFromAxisAngle(UP, this.heading), ONE);
  }
  storeRoot() {
    if (this.lod !== 2) { this._rootInit = false; return; }
    this._rootM = this.rootFrame(this._rootM || new THREE.Matrix4());
    this._rootInit = true;
  }
  carryRigid() {
    const now = this.rootFrame(_m4b);
    const D = mulAffine(this._carryD || (this._carryD = new THREE.Matrix4()), now, _m4.copy(this._rootM).invert());
    for (const b of this.sk.bones) mulAffine(b.matrixWorld, D, b.matrixWorld);
    if (this._supPrevOk) mulAffine(this._supPrev, D, this._supPrev);
    this.rigidCarry = D;
    this.headPose.position.applyMatrix4(D);
    this.headPose.quaternion.premultiply(_qD.setFromRotationMatrix(D));
    this._rootM.copy(now);
  }

  // ----------------------------------------------------------------- intent: input -> mode changes
  drive(dt) {
    const inp = this.input, cfg = this.cfg, fl = cfg.flight;
    let want = Math.max(0, inp.speed || 0);
    this.wantHeading = inp.heading ?? this.heading;
    this.wantClimb = clamp(inp.climb || 0, fl.climbDown, fl.climbUp);
    const gaitAir = inp.gait === 'fly' || inp.gait === 'glide';
    // (a gait name the ground table does not know - e.g. a tool's 'sprint' at the top speed of a
    // burst flyer - forces nothing: the speed decides between walking and flying)
    const gaitGround = !!inp.gait && !gaitAir && (this._groundGaits || (this._groundGaits = new Set(cfg.gaits.map((g) => g.name)))).has(inp.gait);
    if (inp.target && !inp.follow) {
      const dx = inp.target.x - this.pos.x, dz = inp.target.z - this.pos.z, d = Math.hypot(dx, dz);
      const stopR = 0.3 * cfg.legLen + 0.02 * this.speed;
      if (d < stopR && this.mode === 'ground') { inp.target = null; inp.speed = 0; want = 0; this.emit('arrive', {}); }
      else {
        this.wantHeading = inp.heading = Math.atan2(dx, dz);
        const brake = Math.sqrt(Math.max(0, 2 * cfg.ground.decel * 0.7 * (d - stopR)));
        want = Math.min(inp.targetSpeed || 1, brake + 0.2);
        // far targets are flown to (and landed at)
        if (this.mode === 'ground' && (inp.targetSpeed || 0) > cfg.ground.maxSpeed * 1.05) want = inp.targetSpeed;
      }
    }
    this.wantSpeed = want;
    const P = this.P;
    if (inp.follow) { this.wantSpeed = 0; return; }
    // postures stand up first
    if (this.actionsLayer.holdsStill()) {
      if ((want > 0.05 || this.wantClimb > 0.5) && this.mode !== 'air') this.actionsLayer.requestStand();
      this.wantSpeed = 0; this.wantHeading = this.heading;
      return;
    }
    if (this.mode === 'ground' || this.mode === 'perch') {
      const fly = !gaitGround && (want > cfg.ground.maxSpeed * 1.02 || this.wantClimb >= 0.5 || gaitAir);
      if (fly && !P.busyGround) this.startTakeoff();
      else if (this.mode === 'perch' && want > 0.05) this.startTakeoff(); // hop down / fly off
    } else if (this.mode === 'air') {
      // after an explicit take-off with no steering yet: circle (loiter) at a safe height
      if (this.actionsLayer.loiter && want < 0.05) {
        this.wantSpeed = fl.cruise * 0.85;
        this.wantHeading = this.heading + 0.45;
        this.wantClimb = clamp((fl.clearance * 2.5 - this.altitude()) * 0.8, fl.climbDown, fl.climbUp);
      }
      // slow request, ground gait, or a non-sustained flyer out of time: land ahead
      const tired = !fl.sustained && this.fl.time > (fl.maxTime ?? 5);
      if (!this.actionsLayer.keepsFlying() && ((want < fl.minSpeed * 0.6 && this.wantClimb <= 0.2) || gaitGround || tired)) this.startLanding(null, 'auto');
    }
    // standing still: turn toward a look target behind
    if ((this.mode === 'ground') && this.wantSpeed < 0.05) {
      const lt = inp.look;
      if (lt) {
        const w = Math.atan2(lt.x - this.pos.x, lt.z - this.pos.z);
        const off = angDiff(this.heading, w);
        if (Math.abs(off) > cfg.head.yaw * 0.8) this._turnTo = w;
        else if (this._turnTo !== undefined && Math.abs(off) < 0.4) this._turnTo = undefined;
        if (this._turnTo !== undefined) { this.wantHeading = this._turnTo; inp.heading = this._turnTo; }
      } else this._turnTo = undefined;
    }
  }

  // ----------------------------------------------------------------- ground locomotion
  gaitAt(vn) {
    const Gt = this.cfg.gaits, g = this.gait;
    let i = 0;
    while (i < Gt.length - 2 && vn > Gt[i + 1].v) i++;
    const a = Gt[i], b = Gt[Math.min(i + 1, Gt.length - 1)];
    const t = a === b ? 0 : smooth(0, 1, (vn - a.v) / (b.v - a.v));
    g.name = t < 0.5 ? a.name : b.name;
    g.f = lerp(a.f, b.f, t); g.D = lerp(a.D, b.D, t);
    g.lift = lerp(a.lift, b.lift, t); g.bob = lerp(a.bob, b.bob, t); g.hop = lerp(a.hop, b.hop, t);
    g.sway = lerp(a.sway, b.sway, t); g.pitch = lerp(a.pitch, b.pitch, t) * DEG; g.headBob = lerp(a.headBob, b.headBob, t);
    g.wings = lerp(a.wings, b.wings, t); g.tail = lerp(a.tail, b.tail, t);
    for (let j = 0; j < 2; j++) g.off[j] = wrap01(a.off[j] + d01(a.off[j], b.off[j]) * t);
    if (vn > b.v) g.f = b.f + (vn - b.v) * 0.3;
    const cfg = this.cfg, s = cfg.s;
    g.f /= cfg.sq;
    g.lift *= s; g.bob *= s; g.hop *= s; g.sway *= s;
    // hop weight: both feet land together
    g.hopW = 1 - clamp(Math.abs(d01(g.off[0], g.off[1])) / 0.5, 0, 1);
    return g;
  }

  neutralContact(L, lead, tAhead, out, leg) {
    // (a pivot step lands under the heading the step turns the body to)
    const hp = this.pivot ? this.pivot.h0 + this.pivot.dh : this.heading + this.yawRate * tAhead;
    const hm = this.pivot ? hp : this.heading + this.yawRate * tAhead * 0.5;
    const d = this.speed * tAhead;
    const bx = this.pos.x + Math.sin(hm) * d, bz = this.pos.z + Math.cos(hm) * d;
    let lx = L.cx * L.side, lz = L.cz + lead;
    if (leg) { lx += leg.idleOff.x; lz += leg.idleOff.z; }
    const sh = Math.sin(hp), ch = Math.cos(hp);
    out.set(bx + ch * lx + sh * lz, 0, bz - sh * lx + ch * lz);
    out.y = this.terrainH(out.x, out.z);
    return out;
  }
  worldToBody(w, out) {
    const dx = w.x - this.pos.x, dz = w.z - this.pos.z;
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    return out.set(dx * ch - dz * sh, w.y, dx * sh + dz * ch);
  }

  stepGround(dt) {
    const cfg = this.cfg, inp = this.input, P = this.P, gr = cfg.ground;
    const F = this.forward(this.heading, this.F);
    if (inp.follow && this.mode === 'ground') {
      const fv = inp.follow.velocity;
      const vx = fv ? fv.x : 0, vz = fv ? fv.z : 0, sp = Math.hypot(vx, vz);
      this.speed = expTo(this.speed, Math.min(sp, gr.maxSpeed * 1.5), dt, 0.1);
      let hT = inp.follow.heading;
      if (hT === null || hT === undefined) hT = sp > 0.2 * cfg.sq ? Math.atan2(vx, vz) : this.heading;
      const wMax = gr.turnRate * 2;
      const wT = clamp(angDiff(this.heading, hT) * 6, -wMax, wMax);
      this.yawRate += clamp(wT - this.yawRate, -30 * dt, 30 * dt);
      this.heading += this.yawRate * dt;
      this.pos.x = inp.follow.position.x; this.pos.z = inp.follow.position.z;
      this.forward(this.heading, F);
      this.velocity.set(vx, 0, vz);
    } else if (this.mode === 'ground') {
      const vT = this.wantSpeed > gr.maxSpeed ? gr.maxSpeed : this.wantSpeed * P.speedScale;
      const vn = this.speed / cfg.sq;
      const acc = vT > this.speed ? lerp(gr.accel[0], gr.accel[1], smooth(0.5, 1.5, vn)) : gr.decel;
      this.speed += clamp(vT - this.speed, -acc * dt, acc * dt);
      // standing: the bird turns on the spot in steps (stepLegs: the body turns while a foot swings)
      this._standTurn = vT < 0.05 * cfg.sq && this.speed < 0.08 * cfg.sq && P.legGait > 0.5 && P.restep > 0.5;
      if (this.pivot) {
        const pv = this.pivot;
        pv.t += dt;
        const u = clamp(pv.t / pv.dur, 0, 1), h = pv.h0 + pv.dh * smoother(u);
        this.yawRate = (h - this.heading) / dt;
        this.heading = h;
        if (u >= 1) { this.pivot = null; this.yawRate = 0; }
      } else if (this._standTurn) {
        this.yawRate += clamp(-this.yawRate, -12 * dt, 12 * dt);
        this.heading += this.yawRate * dt;
      } else {
        // turn rate: the species' limit (less when slow), what the legs give (a walking or running bird
        // changes its heading by ~35 deg at most per step: two steps per stride, one per hop) and the
        // lateral acceleration a bird can hold leaning into the turn (~0.5 g); the rate builds up over
        // ~0.2 s. (The body used to swing round at the species' full rate whatever the gait: a walking
        // hen turned 90 deg in half a second, a running one at 0.7 g, the stance feet twisting 70 deg.)
        const g = this.gait, steps = Math.max(1.5, (g.hopW > 0.5 ? 1 : 2) * (g.f || 0));
        const wMax = Math.min(gr.turnRate * lerp(0.5, 1, smooth(0.1, 0.8, vn)), 0.6 * steps, 0.5 * G / Math.max(0.1, this.speed)) * P.turnScale;
        const wT = clamp(angDiff(this.heading, this.wantHeading) * 4, -wMax, wMax);
        this.yawRate += clamp(wT - this.yawRate, -10 * dt / cfg.sq, 10 * dt / cfg.sq);
        this.heading += this.yawRate * dt;
      }
      this.forward(this.heading, F);
      this.velocity.copy(F).multiplyScalar(this.speed);
      this.pos.addScaledVector(F, this.speed * dt);
      if (this.push.lengthSq() > 1e-8) {
        this.pos.addScaledVector(this.push, dt);
        this.velocity.add(this.push);
        this.push.multiplyScalar(Math.exp(-dt * 7));
      }
    } else {
      // perched / taking off: no locomotion
      this.speed = expTo(this.speed, 0, dt, 0.1);
      this.yawRate = expTo(this.yawRate, 0, dt, 0.1);
      this.velocity.set(0, 0, 0);
    }
    if (this.heading > Math.PI * 64 || this.heading < -Math.PI * 64) this.heading = angDiff(0, this.heading);
    if (this.mode !== 'perch') this.pos.y = this.terrainH(this.pos.x, this.pos.z);
    this.stepLegs(dt);
  }

  stepLegs(dt) {
    const cfg = this.cfg, P = this.P;
    const v = this.speed, vn = v / cfg.sq;
    // (turning on the spot is stepped by the pivot below, not by the gait cycle)
    const vEff = this._standTurn || this.pivot ? vn : Math.max(vn, Math.abs(this.yawRate) * 0.12);
    const g = this.gaitAt(vEff);
    // a foot lands turned toward the heading the body will have at mid-stance (a turning body then
    // twists over its planted foot by half as much, both ways, instead of all of it one way)
    this._yawAhead = this.pivot ? 0 : clamp(0.5 * g.D / Math.max(g.f, 0.5), 0.05, 0.25);
    const moving = vEff > 0.04 && this.mode === 'ground';
    if (moving) this.phase = wrap01(this.phase + g.f * dt);
    const st = this.state.stats;
    st.gait = moving ? g.name : 'stand'; st.freq = moving ? g.f : 0; st.duty = g.D;
    const F = this.F;
    const legGait = P.legGait;
    // dead (limp legs) and sliding on (a bird killed in flight): the feet go where the body takes
    // them; their plants follow, so standing up starts from where the feet really are
    // (only while the legs are fully free: the ground targets are then unused, so moving them is invisible)
    if (P.legFree >= 0.995 && this.mode === 'ground' && this.speed > 0.01 * cfg.sq && this.actionsLayer.postures.some(isDeathPosture)) {
      for (const leg of this.legs) {
        if (!leg.mtpReal) continue;
        leg.plant.set(leg.mtpReal.x, 0, leg.mtpReal.z);
        leg.plant.y = this.terrainH(leg.plant.x, leg.plant.z);
        leg.state = 'stance'; leg.stanceTime = 0;
      }
    }
    let swinging = 0;
    for (const leg of this.legs) if (leg.state === 'swing') swinging++;
    // turning on the spot: a foot lifts, the body turns while it swings (the other foot is the pivot)
    // and it lands under the new heading; after a moment on both feet the other foot follows - birds
    // turn round in small steps (the body used to spin at a constant rate over its planted feet)
    // The inside foot opens the turn; each step turns the body by 45 deg at most (3-4 steps to turn round).
    if (this._standTurn && !this.pivot && swinging === 0 && this.mode === 'ground' && legGait > 0.5 && !this.input.follow) {
      const err = angDiff(this.heading, this.wantHeading);
      if (Math.abs(err) > 0.1 && Math.abs(this.yawRate) < 0.3 && this.legs.every((l) => l.state === 'stance' && l.stanceTime > 0.05 * cfg.sq)) {
        const inside = this.legs[err > 0 ? 0 : 1], outside = this.legs[err > 0 ? 1 : 0];
        const tw = (lg) => Math.abs(angDiff(lg.yaw, this.heading));
        const leg = tw(outside) > tw(inside) + 0.15 ? outside : inside;
        const dur = 0.22 * Math.sqrt(cfg.legLen / 0.22);
        this.pivot = { h0: this.heading, dh: clamp(err, -0.8, 0.8), t: 0, dur };
        this.startSwing(leg, dur, g, true);
        swinging++;
      }
    }
    for (const leg of this.legs) {
      const L = leg.def;
      const p = wrap01(this.phase - g.off[L.idx]);
      if (p < leg.prevPhase - 0.5) leg.windowUsed = false;
      if (this.mode === 'perch' || this.mode === 'takeoff') {
        leg.state = 'stance'; leg.u = 0.3;
      } else if (leg.state === 'stance') {
        leg.stanceTime += dt;
        leg.u = clamp(p / g.D, 0, 1);
        if (moving && legGait > 0.5) {
          leg.mode = 'gait';
          const jw = this.bodyToWorld(L.cx * L.side, 0, L.cz, this.heading, this.pos, tv());
          const behind = (leg.plant.x - jw.x) * F.x + (leg.plant.z - jw.z) * F.z;
          const over = behind < -0.62 * cfg.legLen && p > g.D * 0.3;
          if (((p >= g.D && leg.stanceTime > 0.3 * g.D / g.f) || over) && !leg.windowUsed) {
            leg.windowUsed = true;
            const remain = Math.max((1 - p) / g.f, 0.45 * (1 - g.D) / g.f);
            this.startSwing(leg, remain, g, false);
          }
        } else if (legGait > 0.5) {
          leg.u = lerp(leg.u, 0.3, 1 - Math.exp(-dt * 6));
          const nC = this.neutralContact(L, 0, 0, tv(), leg);
          const err = nC.distanceTo(leg.plant) + Math.abs(angDiff(leg.yaw, this.heading)) * 0.25 * cfg.legLen;
          if (err > 0.13 * cfg.legLen && swinging === 0 && leg.stanceTime > 0.22 && P.restep > 0.5) {
            this.startSwing(leg, 0.2 * cfg.sq, g, true);
            swinging++;
          }
        }
      } else {
        leg.swingT += dt / leg.swingDur;
        leg.w = clamp(leg.swingT, 0, 1);
        const remain = (1 - leg.w) * leg.swingDur;
        // (continuous in the speed: no jump of the landing point when the bird stops)
        const stanceDur = g.D / Math.max(g.f, 1e-3);
        const lead = Math.min(v * stanceDur * 0.5, 0.45 * cfg.legLen);
        this.neutralContact(L, lead, remain, leg.land, leg);
        leg.landLocal.set(L.cx * L.side + leg.idleOff.x, 0, L.cz + lead + leg.idleOff.z);
        if (leg.swingT >= 1) {
          leg.state = 'stance'; leg.windowUsed = false;
          leg.plant.copy(leg.land);
          this.terrainN(leg.plant.x, leg.plant.z, leg.plantN);
          leg.yaw = this.heading + this.yawRate * this._yawAhead;
          leg.stanceTime = 0; leg.u = 0;
          if (legGait > 0.3) this.emit('footstep', { foot: L.S, position: leg.plant.clone(), speed: v, strength: clamp(0.3 + vn / 3, 0, 1) * (leg.mode === 'idle' ? 0.5 : 1) });
        }
      }
      leg.prevPhase = p;
    }
  }

  startSwing(leg, dur, g, idle) {
    this.worldToBody(leg.plant, leg.liftLocal);
    leg.state = 'swing';
    leg.mode = idle ? 'idle' : 'gait';
    leg.swingT = 0; leg.w = 0;
    leg.swingDur = Math.max(0.07, dur);
    leg.liftH = idle ? 0.018 * this.cfg.s + 0.25 * this.cfg.footLen : g.lift;
    leg.liftYaw = leg.yaw;
    leg.land.copy(leg.plant);
    leg.landLocal.copy(leg.liftLocal);
  }

  // current ground target of a leg (MTP ground point + foot yaw), swing paths in body space
  groundFoot(leg, out) {
    if (leg.state === 'stance') return out.copy(leg.plant);
    const w = leg.w, a = leg.liftLocal, b = leg.landLocal;
    const s = smooth(0, 1, w * 1.05 - 0.02);
    this.bodyToWorld(lerp(a.x, b.x, s), 0, lerp(a.z, b.z, s), this.heading, this.pos, out);
    const gh = this.terrainH(out.x, out.z);
    const bump = Math.pow(Math.sin(Math.PI * Math.pow(w, 0.9)), 1.2);
    const y0 = lerp(a.y, gh, smooth(0, 0.6, w));
    out.y = Math.max(y0 + leg.liftH * bump, gh + 0.002 * bump);
    return out;
  }

  // ----------------------------------------------------------------- take-off
  startTakeoff(opts = {}) {
    if (this.mode === 'takeoff' || this.mode === 'air' || this.mode === 'landing') return;
    const cfg = this.cfg, t = cfg.takeoff;
    const fromPerch = this.mode === 'perch';
    this.pivot = null;
    this.to = {
      t: 0, crouch: t.crouch * cfg.sq * (opts.quick ? 0.6 : 1), air: false, fromPerch,
      vy: opts.vy ?? t.jump * (fromPerch ? 0.35 : 1), vh: opts.vh ?? Math.max(this.speed, t.jump * Math.cos(t.angle) * 0.9),
      hopOnly: !!opts.hopOnly, target: opts.target || null, then: opts.then || null, flapLift: opts.flapLift ?? true, reach: 0,
      push: 0.12 * cfg.sq, pushing: false, y0: 0,
    };
    if (fromPerch) this.perchLeave = this.perch;
    this.mode = 'takeoff';
    this.emit('actionStart', { name: 'takeoff' });
  }

  stepTakeoff(dt) {
    const T = this.to, cfg = this.cfg;
    T.t += dt;
    if (!T.air) {
      // crouch, then push off: the body rises on extending legs until the feet leave the ground
      if (T.t >= T.crouch && !T.pushing) { T.pushing = true; T.y0 = this.body.y; }
      if (T.pushing) { const tau = clamp((T.t - T.crouch) / T.push, 0, 1); this.pos.addScaledVector(this.F, T.vh * (tau - Math.sin(TAU * tau) / TAU) * dt); }
      if (T.t >= T.crouch + T.push) {
        T.air = true;
        T.pushing = false;
        T.tAir = 0;
        this.bodyV.set(0, T.vy, 0).addScaledVector(this.F, T.vh);
        for (const leg of this.legs) { leg.frozen.copy(leg.mtp); leg.frozenOn = true; }
        if (T.hopOnly) {
          // (the hop's flight time - up with the wing beats carrying 20 % of the weight, down 45 % - and
          // the spots the feet will land on, under the body there: the stance plants glide there)
          const up = T.flapLift ? 0.8 : 1, dn = T.flapLift ? 0.55 : 1;
          const h = (T.vy * T.vy) / (2 * G * up);
          T.tFlight = Math.max(0.05, T.vy / (G * up) + Math.sqrt((2 * h) / (G * dn)));
          const sp0 = this.speed; this.speed = T.vh;
          for (const leg of this.legs) {
            leg.hop0 = (leg.hop0 || new THREE.Vector3()).copy(leg.plant);
            this.neutralContact(leg.def, 0, T.tFlight, leg.hop1 || (leg.hop1 = new THREE.Vector3()), leg);
          }
          this.speed = sp0;
        }
        this.vy = T.vy;
        this.speed = T.vh;
        this.state.grounded = false;
        this.perch = null;
        this.fl.time = 0;
        this.emit('takeoff', {});
      } else return;
    }
    T.tAir += dt;
    if (T.hopOnly) { this.stepHop(dt, T); return; }
    this.stepAir(dt, T);
    const done = T.hopOnly ? false : T.tAir > 0.35 && (this.altitude() > cfg.flight.clearance * 0.7 || T.tAir > 2.5);
    if (done) {
      this.mode = 'air';
      this.to = null;
      this.emit('actionEnd', { name: 'takeoff' });
      this.actionsLayer.onAirborne();
    }
  }

  // ballistic hop (jump): gravity eased by a few wing beats; lands where the feet meet the ground
  stepHop(dt, T) {
    const cfg = this.cfg, F = this.F;
    // wing beats carry part of the weight, more so on the way down (braking the landing)
    const lift = T.flapLift ? (this.bodyV.y < 0 ? 0.55 : 0.8) : 1;
    this.bodyV.y -= G * lift * dt;
    let hDead = Infinity;
    if (T.dead) {
      // a dead bird's fall ends in a crumple, not a one-sample stop: over the last decimetres the
      // impact is absorbed (feathers, folding legs and wings) with a ~60 ms time constant, measured
      // from whichever reaches the ground first, the body or the (limp) feet
      // (the dead body comes to rest at the posture's ground height - the drop clamps at sitting -
      // reached a little above it: the rolled body's breast lies lower than in the settled pose)
      const sitH = this.sitHeight();
      hDead = this.body.y - this.terrainH(this.body.x, this.body.z) - sitH - 0.15 * (cfg.pivotY - sitH);
      let h = hDead;
      for (const leg of this.legs) if (leg.mtpReal) h = Math.min(h, leg.mtpReal.y - cfg.feet.pad - this.terrainH(leg.mtpReal.x, leg.mtpReal.z));
      const vMin = -(0.2 * cfg.sq + Math.max(0, h) / 0.08);
      if (this.bodyV.y < vMin) this.bodyV.y = vMin;
    }
    // the ground plants of the planted legs through the hop (a leg whose air weight is not yet full -
    // a short hop - reaches toward its plant: left at the take-off spot, it dragged the feet back, so
    // they touched down late with the body below sitting height, and it snapped up):
    //  - a hop: the plants glide on a fixed path from the take-off spot to the predicted landing spot
    //    (fed from the feet's own positions frame by frame instead, the toes of a running jump jittered)
    //  - a dead fall: under the limp feet (the touchdown plants each foot where it already is)
    // A leg caught mid-swing keeps its body-relative swing path and its state.
    if (T.tAir > 0.02) {
      for (const leg of this.legs) {
        if (leg.state !== 'stance') continue;
        if (T.dead) { if (leg.mtpReal) { leg.plant.set(leg.mtpReal.x, 0, leg.mtpReal.z); leg.plant.y = this.terrainH(leg.plant.x, leg.plant.z); } }
        else if (leg.hop0 && T.tFlight) {
          const u = smoother(T.tAir / T.tFlight);
          leg.plant.lerpVectors(leg.hop0, leg.hop1, u);
          leg.plant.y = this.terrainH(leg.plant.x, leg.plant.z);
        }
      }
    }
    const vh = Math.hypot(this.bodyV.x, this.bodyV.z);
    this.body.addScaledVector(this.bodyV, dt);
    this.speed = vh; this.vy = this.bodyV.y;
    this.yawRate = expTo(this.yawRate, 0, dt, 0.1);
    this.velocity.copy(this.bodyV);
    this.pos.set(this.body.x, this.body.y - cfg.pivotY, this.body.z);
    this.forward(this.heading, F);
    // (a dead bird does not reach for the ground: its legs stay limp)
    T.reach = T.dead ? 0 : smooth(0.1, -0.6, this.vy) * smooth(0.12, 0.3, T.tAir);
    const L = cfg.legs[0];
    // touchdown when the (last posed) feet reach the ground within this frame's fall
    let feetY = this.body.y - L.len * 0.86 * lerp(0.6, 1, T.reach) - cfg.feet.pad, g0 = this.terrainH(this.body.x, this.body.z);
    if (this.legs[0].mtpReal && this.legs[1].mtpReal) {
      feetY = Infinity;
      for (const leg of this.legs) {
        const m = leg.mtpReal, gh = this.terrainH(m.x, m.z);
        feetY = Math.min(feetY, m.y - cfg.feet.pad - gh + this.vy * dt);
      }
      g0 = 0;
    }
    if (T.tAir > 0.12 && this.vy <= 0 && (feetY <= g0 || hDead <= 0 || T.touch)) {
      this.to = null;
      this.mode = 'air';
      this.ld = null;
      this.touchDown();
    }
  }

  // perch description from a target point (the top of the branch where the feet grip)
  makePerch(target, o = {}) {
    const cfg = this.cfg;
    const point = target.isVector3 ? target.clone() : new THREE.Vector3(target.x, target.y, target.z);
    const r = o.radius ?? 0.02 * cfg.s + 0.006;
    // branch axis: given, else across the approach direction
    let axis;
    if (o.axis) axis = new THREE.Vector3().copy(o.axis).setY(0).normalize();
    else { const dx = point.x - this.pos.x, dz = point.z - this.pos.z; const l = Math.hypot(dx, dz) || 1; axis = new THREE.Vector3(dz / l, 0, -dx / l); }
    // toes wrap the branch: flexion so the toe arcs follow its circumference
    const curl = clamp((cfg.footLen * 0.5) / (r + 0.004 * cfg.s), 0.2, 1.4);
    return { point, top: point.y, axis, radius: r, curl };
  }

  // dead in the air: fall ballistically (no wing lift) and collapse where it hits the ground
  fall() {
    // (the limp body's pose while falling is relative to its attitude now: flight level, or standing)
    this._fallPitch0 = this.pitchS.x; this._fallBank0 = this.bankS.x;
    this.mode = 'takeoff';
    this.ld = null;
    // (tAir 0.3: the legs stay in their air pose, no blend back toward the ground from flight)
    this.to = { t: 1, crouch: 0, air: true, tAir: 0.3, hopOnly: true, flapLift: false, reach: 0, dead: true };
    this.bodyV.copy(this.velocity);
  }

  altitude() { return this.body.y - this.cfg.pivotY - this.terrainH(this.body.x, this.body.z); }

  // ----------------------------------------------------------------- flight
  stepAir(dt, takeoff = null) {
    const cfg = this.cfg, fl = cfg.flight, F = this.F, inp = this.input, P = this.P;
    const air = this.fl;
    air.time += dt;
    if (inp.follow) {
      // an external body carries the bird: animate for its velocity, keep it off the terrain
      const fv = inp.follow.velocity, fp = inp.follow.position;
      const sp = Math.hypot(fv.x, fv.z);
      this.speed = expTo(this.speed, sp, dt, 0.1);
      const hT = sp > 0.3 ? Math.atan2(fv.x, fv.z) : this.heading;
      const wT = clamp(angDiff(this.heading, hT) * 5, -fl.turnRate * 3, fl.turnRate * 3);
      this.yawRate += clamp(wT - this.yawRate, -20 * dt, 20 * dt);
      this.heading += this.yawRate * dt;
      // (the body banks for the turn the carrier makes)
      this.turnBank = this.turnBankS.step(Math.atan(Math.max(this.speed, 1) * this.yawRate / G), cfg.rollOmega, dt);
      this._flying = true;
      this.forward(this.heading, F);
      const gy = this.terrainH(fp.x, fp.z);
      const y = Math.max(fp.y, gy) + cfg.pivotY + Math.max(0, fl.clearance * 0.5);
      this.vy = (y - this.body.y) / dt * 0.2;
      this.body.set(fp.x, expTo(this.body.y, y, dt, 0.25), fp.z);
      this.velocity.set(fv.x, this.vy, fv.z);
      this.pos.set(this.body.x, this.body.y - cfg.pivotY, this.body.z);
      return;
    }
    // take-off weight: 1 right after toe-off, easing to 0 (continuous across the switch to 'air')
    const tw = takeoff ? 1 - smooth(0.35, 1.3, takeoff.tAir) : Math.max(0, (this.toW || 0) - dt / 0.6);
    this.toW = tw;
    // --- airspeed
    let vT = clamp(Math.max(this.wantSpeed, fl.minSpeed), fl.minSpeed, fl.maxSpeed);
    vT = lerp(vT, Math.max(fl.minSpeed, Math.min(vT, fl.cruise)), tw);
    const drag = 0.9 + 0.012 * this.speed * this.speed / cfg.s;
    const accMax = lerp(2.5, 6, air.power) * (1 + 0.4 * tw);
    this.speed += clamp(vT - this.speed, -drag * dt * 2.2, accMax * dt);
    if (takeoff && takeoff.tAir < 0.3) this.speed = Math.max(this.speed, takeoff.vh);
    // --- heading: banked, coordinated turns. The bird rolls first and the tilted lift turns it: the
    // bank follows the one a turn at the wanted rate needs (critically damped roll, faster for small
    // wings), and the yaw rate is what that bank gives at this airspeed, g tan(bank) / v. (The yaw rate
    // used to lead and the body roll to follow it through a slow spring, with the wrong sign: the bird
    // swung out of its turns and stayed tilted after them.)
    const vEff = Math.max(this.speed, fl.minSpeed * 0.6);
    const wMax = Math.min(fl.turnRate, G * Math.tan(fl.bankMax) / vEff);
    // (the roll-out is anticipated: the heading still changes while the bird rolls level)
    const wT = clamp((angDiff(this.heading, this.wantHeading) - this.yawRate * 1.7 / cfg.rollOmega) * 1.8, -wMax, wMax);
    if (!this._flying) { this.turnBankS.reset(Math.atan(vEff * this.yawRate / G)); this._flying = true; }
    this.turnBank = this.turnBankS.step(Math.atan(vEff * wT / G), cfg.rollOmega, dt);
    this.yawRate = G * Math.tan(this.turnBank) / vEff;
    this.heading += this.yawRate * dt;
    if (this.heading > Math.PI * 64 || this.heading < -Math.PI * 64) this.heading = angDiff(0, this.heading);
    this.forward(this.heading, F);
    // --- climb: input, terrain clearance (look ahead), take-off climb
    const alt = this.altitude();
    let vyT = this.wantClimb;
    vyT = lerp(vyT, Math.max(vyT, Math.tan(cfg.takeoff.angle) * Math.max(this.speed, 2)), tw);
    const aheadG = this.terrainH(this.body.x + F.x * this.speed * 0.6, this.body.z + F.z * this.speed * 0.6);
    const altAhead = this.body.y - cfg.pivotY - aheadG;
    const minAlt = Math.min(alt, altAhead);
    const clr = this._clearance ?? fl.clearance;
    if (minAlt < clr) vyT = Math.max(vyT, (clr - minAlt) * 1.8);
    if (this.fl.forceGlide > 0.5 && !takeoff) vyT = Math.min(vyT, -this.speed / fl.glideRatio);
    vyT = clamp(vyT, fl.climbDown, fl.climbUp * (1 + 0.4 * tw));
    this.vy += clamp(vyT - this.vy, -6 * dt, 6 * dt);
    // --- integrate
    this.body.addScaledVector(F, this.speed * dt);
    this.body.y += this.vy * dt;
    if (this.push.lengthSq() > 1e-8) { this.body.addScaledVector(this.push, dt); this.push.multiplyScalar(Math.exp(-dt * 5)); }
    // hard floor: never below the terrain (legs tucked)
    const floor = this.terrainH(this.body.x, this.body.z) + cfg.pivotY * 0.75;
    if (this.body.y < floor) { this.body.y = floor; this.vy = Math.max(this.vy, 0); }
    this.velocity.copy(F).multiplyScalar(this.speed); this.velocity.y = this.vy;
    this.pos.set(this.body.x, this.body.y - cfg.pivotY, this.body.z);
    // --- power demand: slow flight, climbing, accelerating; gliding when descending
    const vr = this.speed / fl.cruise;
    let pw = 0.5 + 0.35 * Math.max(0, 1 - vr) * 2 + 0.2 * Math.max(0, vr - 1.15);
    pw += 0.4 * Math.max(0, this.vy) / fl.climbUp + 0.2 * Math.max(0, vT - this.speed) / 3;
    pw = Math.max(pw, lerp(0, 1, tw));
    pw = clamp(pw, 0, 1);
    air.power = air.powerS.step(pw, 6, dt);
    // intermittent gliding (flap-glide), and gliding when descending
    const w = cfg.wing;
    let glideWant = this.vy < -0.35 * this.speed / fl.glideRatio * 2 && !takeoff ? 1 : 0;
    if (!takeoff && w.glideShare > 0 && this.vy > -0.5 && pw < 0.72 + 0.2 * (w.soar || 0)) {
      air.glideT -= dt;
      if (air.glideT <= 0) {
        air.gliding = air.gliding ? 0 : 1;
        const share = Math.min(0.95, w.glideShare + 0.5 * (w.soar || 0)); // soarers: long glides, few beats
        air.glideT = air.gliding ? (0.6 + this.rand() * 1.4) * (0.5 + share * 3) : (2 + this.rand() * 4) * (1.2 - share);
      }
      glideWant = Math.max(glideWant, air.gliding);
    }
    if (this.fl.forceGlide > 0.5 && !takeoff) glideWant = 1;
    if (this.fl.forceFlap > 0.5) glideWant = 0;
    air.glide = air.glideS.step(glideWant, 4, dt);
  }

  // ----------------------------------------------------------------- landing
  // target: world point where the feet touch (ground or perch top); null = ahead on the ground
  startLanding(target, why, perch = null) {
    const cfg = this.cfg;
    if (this.mode === 'ground' || this.mode === 'perch') return false;
    if (this.mode === 'takeoff') { this.mode = 'air'; this.to = null; }
    const F = this.forward(this.heading, tv());
    const tgt = new THREE.Vector3();
    if (target) tgt.copy(target);
    else {
      const d = Math.max(3 * cfg.legLen, Math.min(this.speed * 1.2 + this.altitude() * 1.5, 12 * cfg.s + this.speed));
      tgt.set(this.body.x + F.x * d, 0, this.body.z + F.z * d);
      tgt.y = this.terrainH(tgt.x, tgt.z);
    }
    const dx = tgt.x - this.body.x, dz = tgt.z - this.body.z;
    const dist = Math.hypot(dx, dz);
    const dy = tgt.y + cfg.pivotY - this.body.y;
    this.ld = {
      target: tgt, perch, why, t: 0, phase: 'approach', p0: this.body.clone(), v0: this.velocity.clone(),
      T: 0, dist, dy, flare: 0, touched: false, reach: 0,
    };
    this.mode = 'landing';
    this.emit('actionStart', { name: perch ? 'perch' : 'land' });
    return true;
  }

  stepLanding(dt) {
    const cfg = this.cfg, fl = cfg.flight, L = this.ld, air = this.fl;
    L.t += dt;
    air.time += dt;
    const tgt = L.target;
    // an automatic landing (slowed down, a burst flyer out of breath) still follows the steering: its
    // touch point stays ahead along the wanted heading, as far as it is (fixed where the landing began,
    // a hen tired of flying ignored a 60 deg turn to the ground)
    if (L.phase === 'approach' && L.why === 'auto' && !L.perch && !this.input.follow) {
      const h = this.input.heading ?? this.heading, d = Math.hypot(tgt.x - this.body.x, tgt.z - this.body.z);
      tgt.set(this.body.x + Math.sin(h) * d, 0, this.body.z + Math.cos(h) * d);
      tgt.y = this.terrainH(tgt.x, tgt.z);
    }
    // aim: the body pivot above the touch point, standing height (a little higher for a perch grip)
    const aimY = tgt.y + cfg.pivotY * (L.perch ? 0.92 : 1.0);
    const dx = tgt.x - this.body.x, dz = tgt.z - this.body.z;
    const dist = Math.hypot(dx, dz);
    const hDes = Math.atan2(dx, dz);
    const vApp = Math.max(cfg.landing.approach, fl.minSpeed * 1.1);
    if (L.phase === 'approach') {
      // fly toward the target on a descending path; start the final (guided) segment when close
      // a target inside the turning circle: fly out straight, then come back round (no endless orbit)
      const R = this.speed * this.speed / (G * Math.tan(fl.bankMax)) + 0.5 * cfg.legLen;
      const err0 = Math.abs(angDiff(this.heading, hDes));
      if (!L.extend && err0 > 1.2 && dist < 2.2 * R) L.extend = true;
      if (L.extend && dist > 3.2 * R) L.extend = false;
      this.wantHeading = L.extend ? this.heading : hDes;
      const wantV = clamp(dist * 0.9, vApp, Math.max(vApp, Math.min(this.speed, fl.cruise)));
      this.wantSpeed = wantV;
      const hdgErr = Math.abs(angDiff(this.heading, hDes));
      const tFinal = Math.max(0.9, 2.2 * dist / Math.max(1, this.speed + cfg.landing.touch));
      const dh = aimY - this.body.y;
      // descend along a glide slope toward the aim point
      const slope = dist > 0.1 ? dh / dist : 0;
      this.wantClimb = clamp(slope * this.speed * 1.2, fl.climbDown, fl.climbUp);
      // terrain clearance gives way to the approach (the target may be low, a perch below it)
      this._clearance = Math.min(fl.clearance, Math.max(tgt.y - this.terrainH(tgt.x, tgt.z), 0) + 0.25 * dist);
      this.stepAirLanding(dt);
      this._clearance = null;
      if ((dist < Math.max(this.speed * 1.15, 2.5 * cfg.legLen) && hdgErr < 0.6) || (dist < 1.2 * cfg.legLen) || L.t > 12) {
        // final segment: cubic Hermite from the current state to the touch point
        L.phase = 'final';
        L.p0.copy(this.body);
        L.v0.copy(this.velocity);
        const vTouch = cfg.landing.touch;
        L.T = clamp((2 * dist) / Math.max(0.5, this.speed + vTouch), 0.55, 2.6);
        if (tFinal < L.T) L.T = Math.max(0.55, tFinal);
        L.tf = 0;
        L.p1 = new THREE.Vector3(tgt.x, aimY, tgt.z);
        const h = dist > 1e-3 ? hDes : this.heading;
        L.v1 = new THREE.Vector3(Math.sin(h) * vTouch * 0.5, -vTouch * 0.25, Math.cos(h) * vTouch * 0.5);
        L.h1 = h;
        // a perch: settle facing across the branch (the side nearer the approach)
        if (L.perch) {
          const a = L.perch.axis, hn = Math.atan2(a.z, -a.x);
          L.h1 = Math.abs(angDiff(h, hn)) < Math.PI / 2 ? hn : hn + Math.PI;
        }
      }
      return;
    }
    // final: follow the Hermite curve exactly (arrives at T); flare in the last part
    L.tf += dt;
    const T = L.T, u = clamp(L.tf / T, 0, 1);
    const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
    const p0 = L.p0, v0 = L.v0, p1 = L.p1, v1 = L.v1;
    const nx = h00 * p0.x + h10 * T * v0.x + h01 * p1.x + h11 * T * v1.x;
    const ny = h00 * p0.y + h10 * T * v0.y + h01 * p1.y + h11 * T * v1.y;
    const nz = h00 * p0.z + h10 * T * v0.z + h01 * p1.z + h11 * T * v1.z;
    // keep clear of the terrain along the way (except at the very end)
    const clearY = this.terrainH(nx, nz) + cfg.pivotY * lerp(1.2, 0.8, smooth(0.7, 1, u));
    const vx = (nx - this.body.x) / dt, vz = (nz - this.body.z) / dt;
    this.body.set(nx, Math.max(ny, u < 0.95 ? clearY : ny), nz);
    const sp = Math.hypot(vx, vz);
    this.velocity.set(vx, 0, vz);
    // derivative of the curve for the vertical speed and the heading
    const d00 = 6 * u * u - 6 * u, d10 = 3 * u * u - 4 * u + 1, d01 = -6 * u * u + 6 * u, d11 = 3 * u * u - 2 * u;
    this.vy = (d00 * p0.y + d10 * T * v0.y + d01 * p1.y + d11 * T * v1.y) / T;
    this.velocity.y = this.vy;
    this.speed = sp;
    if (sp > 0.3 || L.perch) {
      let hT = sp > 0.3 ? Math.atan2(vx, vz) : this.heading;
      if (L.perch) hT = this.heading + angDiff(this.heading, hT) * (1 - smooth(0.4, 0.95, u)) + angDiff(this.heading, L.h1) * smooth(0.4, 0.95, u);
      this.yawRate = clamp(angDiff(this.heading, hT) / Math.max(dt, 1e-3), -6, 6) * 0.3;
      this.heading += this.yawRate * dt;
    } else this.yawRate *= 0.9;
    // (banked for the turn the path makes)
    this.turnBank = this.turnBankS.step(Math.atan(Math.max(sp, 1) * this.yawRate / G) * (1 - smooth(0.5, 0.9, u)), cfg.rollOmega, dt);
    this.forward(this.heading, this.F);
    this.pos.set(this.body.x, this.body.y - cfg.pivotY, this.body.z);
    // flare / braking power
    L.flare = smooth(0.35, 0.8, u);
    L.reach = smooth(0.3, 0.75, u);
    L.feetW = smooth(0.72, 1, u);
    air.power = air.powerS.step(lerp(0.7, 1, L.flare), 6, dt);
    air.glide = air.glideS.step(u < 0.3 && L.dist > 3 ? 0.6 : 0, 4, dt);
    if (u >= 1) this.touchDown();
  }

  // approach phase: normal flight dynamics toward the landing target
  stepAirLanding(dt) {
    const keep = this.mode;
    this.mode = 'air';
    this.stepAir(dt);
    this.mode = keep;
  }

  // touch point of a foot for the current landing (ground beside the target, or the perch top)
  landPlant(leg, out) {
    const L = this.ld, Ld = leg.def, tgt = L.target, perch = L.perch;
    if (perch) {
      const a = perch.axis;
      return out.copy(tgt).addScaledVector(a, Ld.side * Ld.cx * (a.x * Math.cos(this.heading) - a.z * Math.sin(this.heading) >= 0 ? 1 : -1));
    }
    // neutral stance point relative to the touch target (the landing target is the body pivot's ground point)
    this.bodyToWorld(Ld.cx * Ld.side, 0, Ld.cz, this.heading, tgt, out);
    out.y = this.terrainH(out.x, out.z);
    return out;
  }

  touchDown() {
    const cfg = this.cfg, L = this.ld;
    const perch = L ? L.perch : null;
    this.mode = perch ? 'perch' : 'ground';
    this.perch = perch;
    const tgt = L ? L.target : this.pos;
    this.pos.set(tgt.x, perch ? tgt.y : this.terrainH(tgt.x, tgt.z), tgt.z);
    // feet plant where they are (projected on the ground / the perch)
    for (const leg of this.legs) {
      const Ld = leg.def;
      if (L) this.landPlant(leg, leg.plant);
      else {
        // hop: feet plant where they touch (the idle re-step brings them under the body afterwards)
        const mr = leg.mtpReal || leg.mtp;
        leg.plant.set(mr.x, 0, mr.z);
        leg.plant.y = this.terrainH(leg.plant.x, leg.plant.z);
      }
      this.terrainN(leg.plant.x, leg.plant.z, leg.plantN);
      if (perch) leg.plantN.set(0, 1, 0);
      leg.state = 'stance'; leg.stanceTime = 0; leg.u = 0; leg.windowUsed = false; leg.prevPhase = 0;
      leg.yaw = this.heading; leg.yawS.reset(this.heading);
      leg.frozenOn = false;
      this.emit('footstep', { foot: Ld.S, position: leg.plant.clone(), speed: this.speed, strength: 0.8 });
    }
    // the feet are now held by the plants (no blend from the body-relative air pose, which moves with the body)
    // (a dead bird's limp legs ease over: their air pose is where the feet are, and the death pose frees
    // them; a switch pulled the sitting ankle down in one frame when the fall was short)
    const deadTouch = this.actionsLayer.dead();
    if (!deadTouch) this.airLeg.reset(0);
    // body height continues from where it is (absorbs the impact)
    this.hY.x = this.body.y; this.hY.v = this.vy;
    // horizontal momentum is absorbed by the legs (body sways forward over the feet)
    const vh = Math.min(1, 1.2 * this.cfg.sq / Math.max(1e-3, Math.hypot(this.velocity.x, this.velocity.z)));
    this.landOff = { x: 0, z: 0, vx: this.velocity.x * vh, vz: this.velocity.z * vh };
    this._touchFrame = this.frame;
    this._touchTime = this.time;
    // gait cycle restarts with both feet down (stance start)
    this.phase = this.gait.off[0];
    this.input.speed = this.input.speed > cfg.ground.maxSpeed ? 0 : this.input.speed;
    // a hop while moving carries on at the requested ground speed (no stop and restart)
    const vHor = Math.hypot(this.velocity.x, this.velocity.z);
    // (a dead bird hitting the ground keeps part of its momentum: it slides / tumbles to a stop)
    const dead = this.actionsLayer.dead();
    const carry = dead ? 0.4 * vHor : !L && this.input.speed > 0.05 ? Math.min(vHor, this.input.speed) : 0;
    this.speed = carry; this.yawRate = 0; this.vy = 0;
    if (carry > 0) {
      this.velocity.set(Math.sin(this.heading) * carry, 0, Math.cos(this.heading) * carry);
      // only the velocity difference is absorbed by the legs
      this.landOff.vx -= this.velocity.x * vh; this.landOff.vz -= this.velocity.z * vh;
    } else this.velocity.set(0, 0, 0);
    this.input.heading = this.heading;
    this.state.grounded = true;
    this.fl.landT = this.time;
    this.emit('land', { position: this.pos.clone(), speed: 0 });
    this.emit('actionEnd', { name: perch ? 'perch' : 'land' });
    this.ld = null;
    this.actionsLayer.onLand(perch);
  }

  // ----------------------------------------------------------------- pose
  pose(dt) {
    const cfg = this.cfg, P = this.P, s = cfg.s;
    const air = this.mode === 'air' || this.mode === 'landing' || (this.mode === 'takeoff' && this.to.air);
    const hop = this.mode === 'takeoff' && this.to.hopOnly;
    // landing flare, eased out after touchdown (wings stay up briefly, then fold)
    this.flareS = this.flareS || new Spring(0);
    this.flare = clamp(this.flareS.step(this.ld ? this.ld.flare || 0 : 0, this.ld ? 30 : 7, dt), 0, 1);
    const fly = air && !hop;
    // flight.shape weight: 0 on the ground (and in the flare, a fall), 1 in flight; critically damped
    if (cfg.shape) {
      this.shapeS = this.shapeS || new Spring(0);
      this.shapeW = clamp(this.shapeS.step(fly ? 1 - this.flare : 0, 8, dt), 0, 1);
    } else this.shapeW = 0;
    const h = this.heading;
    this.forward(h, this.F); this.left(h, this.Lf);
    this.qH.setFromAxisAngle(UP, h);
    const g = this.gait;
    const vn = this.speed / cfg.sq;
    const t = this.time;
    // breathing (fast in birds)
    this.breath += dt * TAU * lerp(1.1, 2.5, clamp(this.fl.power * (air ? 1 : 0), 0, 1)) * P.breathRate;
    // ---------------- body height, pitch, bank
    let pitchT = 0, bankT = 0, yT;
    const gw = P.gaitW;
    if (!air) {
      // standing height: pivot above the ground (or the perch), posture drops, gait bob / hop arc
      // (turning on the spot steps without the gait's bob: the pivot's yaw comes in pulses)
      const yawMv = this._standTurn || this.pivot ? 0 : Math.abs(this.yawRate);
      const moving = this.mode === 'ground' && (vn > 0.04 || yawMv > 0.3);
      const mv = moving ? smooth(0.02, 0.3, vn + yawMv * 0.1) : 0;
      let bob = 0, hopBob = 0;
      if (mv > 0) {
        // walk: highest at mid-stance (vaulting); hop: ballistic arc between two compressions
        let lw = 0;
        for (const leg of this.legs) {
          const pl = wrap01(this.phase - g.off[leg.def.idx]);
          if (pl < g.D) lw = Math.max(lw, Math.sin(Math.PI * pl / g.D));
        }
        const walkBob = g.bob * (lw - 0.75);
        const ph = wrap01(this.phase - g.off[0]);
        let hop = 0;
        if (g.hopW > 0.01 && g.hop > 0) {
          const Ts = g.D / g.f, Tf = (1 - g.D) / g.f;
          const A = g.hop * 4 * Ts / (Math.PI * Math.max(Tf, 1e-3));
          if (ph < g.D) hop = -Math.min(A, 0.12 * cfg.legLen) * Math.sin(Math.PI * ph / g.D);
          else { const u = (ph - g.D) / (1 - g.D); hop = g.hop * 4 * u * (1 - u); }
        }
        // (the hop arc is exact - added after the height filter so it does not lag the feet)
        bob = walkBob * (1 - g.hopW) * mv * gw;
        hopBob = hop * g.hopW * mv * gw;
      }
      const base = this.mode === 'perch' && this.perch ? this.perch.top : this.terrainH(this.body.x, this.body.z);
      const ground = this.mode === 'perch' ? base : Math.max(this.terrainH(this.legs[0].plant.x, this.legs[0].plant.z), this.terrainH(this.legs[1].plant.x, this.legs[1].plant.z), this.terrainH(this.pos.x, this.pos.z)) * 0.5 + this.terrainH(this.pos.x, this.pos.z) * 0.5;
      const drop = clamp(P.drop + (this.input.crouch || 0) * 0.25, -0.2, 1) * (cfg.pivotY - this.sitHeight());
      yT = ground + cfg.pivotY - drop + bob + P.lift * s;
      // the legs must reach their planted feet
      if (this.mode !== 'takeoff') {
        for (const leg of this.legs) {
          if (leg.state !== 'stance' || P.legGait < 0.3) continue;
          const L = leg.def;
          const hipOff = L.hip.y;
          const dxz = Math.hypot(this.body.x - leg.plant.x, this.body.z - leg.plant.z);
          const reach = (L.L1 + L.L2 + L.L3) * 0.93;
          const maxY = leg.plant.y + cfg.feet.pad + Math.sqrt(Math.max(0.05 * reach * reach, reach * reach - dxz * dxz)) - hipOff;
          yT = lerp(yT, smin(yT, maxY, 0.01 * s), 1 - this.airLeg.x);
        }
      }
      // take-off crouch & push (continuous: crouch, then the body is carried by the jump)
      if (this.mode === 'takeoff' && !this.to.air) {
        const c = smooth(0, this.to.crouch * 0.7, this.to.t);
        yT -= c * 0.28 * (cfg.pivotY - this.sitHeight());
      }
      let om = (this.mode === 'ground' && vn > 0.04 ? 30 : 16) * P.bodyOmega;
      // touchdown: the legs take the impact progressively (no one-frame velocity step)
      if (this._touchTime !== undefined) om *= lerp(0.6, 1, smooth(0, 0.15, this.time - this._touchTime));
      // (on the touchdown frame the air step already moved the body: do not integrate twice)
      if (this._touchFrame === this.frame) { this.hY.x = this.body.y; } else this.body.y = this.hY.step(yT, om, dt) + this.hopS.step(hopBob, 60, dt);
      // a hard landing never crouches lower than sitting on the tarsi (unless a posture drops the body)
      // (faded in with the posture drop, not switched on at drop 0.5: a body still lying low as a
      // posture fades out - standing up after death - was lifted by up to 2 cm in one frame)
      const kFloor = 1 - smooth(0.3, 0.5, P.drop);
      if (kFloor > 0 && this.mode === 'ground') {
        const fl = ground + this.sitHeight() * 1.03, kf = 0.01 * s;
        if (this.body.y < fl + kf) {
          const d = fl + kf - this.body.y;
          const ny = this.body.y + (d >= 2 * kf ? d - kf : d * d / (4 * kf));
          this.body.y = lerp(this.body.y, ny, kFloor);
        }
      }
      // take-off push: the legs extend and accelerate the body to the jump velocity (continuous)
      if (this.mode === 'takeoff' && this.to.pushing) {
        const T = this.to, tau = clamp((T.t - T.crouch) / T.push, 0, 1);
        // sin^2 acceleration profile: velocity 0 -> vy with no acceleration steps
        this.body.y = T.y0 + T.vy * T.push * (0.5 * tau * tau + (Math.cos(TAU * tau) - 1) / (4 * Math.PI * Math.PI));
        this.hY.x = this.body.y; this.hY.v = T.vy * (tau - Math.sin(TAU * tau) / TAU);
      }
      this.body.x = this.pos.x; this.body.z = this.pos.z;
      // pitch: gait (+ = nose up), posture, perched; bank into turns, hop sway
      pitchT = g.pitch * mv * gw + P.pitch;
      bankT = clamp(-this.speed * this.yawRate / G, -0.3, 0.3) * gw + P.roll;
      const sway = g.sway * Math.sin(TAU * (this.phase - g.off[0])) * mv * (1 - g.hopW) * gw;
      this.swayS.step(sway, 20, dt);
    } else {
      // flight: nose along the flight path (relative to the standing tilt), angle of attack at low
      // speed, flare; bank from the turn
      this.hY.x = this.body.y; this.hY.v = this.vy;
      const fl = cfg.flight;
      const gamma = Math.atan2(this.vy, Math.max(this.speed, 0.5));
      const aoa = 0.25 * clamp(1 - this.speed / fl.cruise, 0, 1) + 0.04;
      const flare = this.flare;
      const toPitch = 0.4 * (this.toW || 0);
      pitchT = -cfg.tilt + gamma * 0.7 + aoa + flare * (cfg.tilt + 0.55) + toPitch + P.pitch * 0.5;
      // (into the turn: a left turn (+ yaw rate) rolls the body's top to its left, as on the ground)
      bankT = clamp(-(this.turnBank || 0), -cfg.flight.bankMax, cfg.flight.bankMax) + P.roll * 0.4;
      // a hop (jump) keeps the standing carriage, leaning slightly into the jump; a bird falling dead
      // tumbles from the attitude it had (the death pose's pitch and roll are relative to it)
      if (hop) {
        if (this.to.dead) { pitchT = (this._fallPitch0 ?? 0) + P.pitch; bankT = (this._fallBank0 ?? 0) + P.roll; }
        else { pitchT = P.pitch - 0.12 + 0.2 * clamp(this.vy, -1, 1) * 0.3; bankT = P.roll; }
      }
      this.swayS.step(0, 10, dt);
    }
    // (spring rates ease between air and ground: a rate step is an acceleration step)
    this._pom = expTo(this._pom ?? 14, air ? 7 : 14 * P.bodyOmega, dt, 0.12);
    // (in the air the roll is already smooth - the turn bank is a spring - so the body follows it closely)
    this._bom = expTo(this._bom ?? 12, air ? 16 : 12, dt, 0.12);
    const pitch = this.pitchS.step(pitchT, this._pom, dt);
    const bank = this.bankS.step(bankT, this._bom, dt);
    // stroke-driven body bob in flight
    let flapBob = 0;
    flapBob = -Math.sin(TAU * this.fl.psi) * this.fl.amp * 0.004 * s * (1 - this.fl.glide);
    // (the bank rolls the body about its own long axis - the standing carriage's axis, level in flight
    // and lying: about the bind frame's forward axis, 30-46 deg off an upright bird's body axis, it skewed
    // the body off its path in banked turns - 26 deg for an eagle at 45 deg of bank - and a bird lying
    // dead on its side lay head-down with the tail up; about the horizontal, a falling body pitched nose
    // down cartwheeled onto a wing instead of tumbling about its axis)
    // (P.rollAxisK: a limp body falling from the sky tumbles about the bind frame's forward axis, as it
    // did before, eased back to the body axis after the impact)
    const RA = this._rollAx || (this._rollAx = new THREE.Vector3(0, Math.sin(cfg.tilt), Math.cos(cfg.tilt)));
    const ra = P.rollAxisK > 0 ? tv().copy(RA).lerp(Z1, P.rollAxisK).normalize() : RA;
    this.qB.copy(this.qH).multiply(tqa(X1, -pitch)).multiply(tqa(ra, bank));
    const origin = tv().copy(this.body).addScaledVector(this.Lf, this.swayS.x + P.side * s).addScaledVector(this.F, P.fwd * s);
    origin.y += flapBob;
    // landing momentum: the body carries on over the planted feet and settles back (critically damped)
    const lo = this.landOff;
    if (lo && (lo.x * lo.x + lo.z * lo.z + lo.vx * lo.vx + lo.vz * lo.vz) > 1e-10) {
      if (air) { lo.x = lo.z = lo.vx = lo.vz = 0; } else if (this._touchFrame !== this.frame) {
        const w = 13, e = Math.exp(-w * dt);
        for (const k of ['x', 'z']) {
          const vk = 'v' + k, x = lo[k], v = lo[vk], c = v + w * x;
          lo[k] = (x + c * dt) * e; lo[vk] = (v - w * c * dt) * e;
        }
        origin.x += lo.x; origin.z += lo.z;
      }
    }
    this._origin = origin;
    // ---------------- torso
    const bodyO = this._bodyO || (this._bodyO = new THREE.Vector3());
    bodyO.copy(origin);
    const bs = 1 + Math.sin(this.breath) * 0.012 * P.breathAmp;
    const fluff = 1 + P.fluff * 0.08;
    const qBody = this.qB;
    // (a persistent vector, not a ring temporary: the leg, wing, tail and head solves below can use more
    // temporaries than the ring holds in a busy frame - feathers lifted off the ground while a bird
    // stands up after dying in flight - and the restored body position came back as garbage: a one-frame
    // jump of everything carried by it, the head target first)
    const saveBody = (this._saveBody || (this._saveBody = new THREE.Vector3())).copy(this.body);
    this.body.copy(origin);
    const syn = this.B(tv().copy(this.J.synsacrum).sub(cfg.pivot), tv());
    const qChest = tqc(qBody).multiply(tqa(X1, -P.chestPitch));
    // (the torso scales: kept so a lift off the ground re-writes the bones with the same ones)
    const sP = (this._sclP || (this._sclP = new THREE.Vector3())).set(fluff * bs, fluff, fluff);
    const sC = (this._sclC || (this._sclC = new THREE.Vector3())).set(fluff * bs, fluff * (1 + (bs - 1) * 0.5), fluff);
    // (flight.shape.body: sleeked plumage in flight, eased with the flight weight; scaled about a centre
    // `back` dorsal of the synsacrum: the bone heads move by Q (I - K) c, c the centre in the bone's frame)
    const shP = this._shP || (this._shP = new THREE.Vector3()), shC = this._shC || (this._shC = new THREE.Vector3());
    shP.set(0, 0, 0); shC.set(0, 0, 0);
    if (this.shapeW > 0 && cfg.shape.body) {
      const w = this.shapeW, sb = cfg.shape.body;
      const kx = lerp(1, sb[0], w), ky = lerp(1, sb[1], w), kz = lerp(1, sb[2], w);
      sP.x *= kx; sP.y *= ky; sP.z *= kz; sC.x *= kx; sC.y *= ky; sC.z *= kz;
      if (cfg.shape.back) {
        const iP = this.ix.pelvis, iC = this.ix.chest;
        for (const [sh, i, q] of [[shP, iP, qBody], [shC, iC, qChest]]) {
          const c = tv().copy(cfg.shape.vent).multiplyScalar(-cfg.shape.back * s).applyQuaternion(tqc(this.bindQ[i]).invert());
          sh.set((1 - kx) * c.x, (1 - ky) * c.y, (1 - kz) * c.z).applyQuaternion(tqc(q).multiply(this.bindQ[i]));
        }
      }
    }
    this.setBoneQ('pelvis', tv().addVectors(syn, shP), tqc(qBody), sP);
    this.setBoneQ('chest', tv().addVectors(syn, shC), qChest, sC);
    this.qChest = qChest;
    // ---------------- ground under the body: keep the belly and wings off the terrain
    // (and while a dead bird falls onto it: the belly meets the ground continuously)
    const deadFall = !!(this.to && this.to.dead);
    this._resting = false;
    if (!air || deadFall) this.restOnGround(dt);
    // ---------------- legs, wings, tail, neck & head
    this.poseLegs(dt, air);
    this.poseWings(dt, fly);
    this.poseTail(dt, fly);
    this.poseHead(dt, fly);
    // (the body frame the bones were written in: the ground support carries last frame's thighs with it)
    if (this.sup) { this._supPrev.compose(this.body, this.qB, ONE); this._supPrevOk = true; }
    this.body.copy(saveBody);
    // a dead bird whose belly has reached the ground is held there: the fall ends (see stepHop)
    if (deadFall && this._restPen > 0) { this.body.y += this._restPen; this.bodyV.y = Math.max(this.bodyV.y, 0); this.to.touch = true; }
  }

  sitHeight() {
    // pivot height when sitting on the tarsi: the lowest point of the torso skin (measured on the
    // mesh; the species' belly section when there is none) just above the ground, or the folded legs
    if (this._sitH !== undefined) return this._sitH;
    const cfg = this.cfg, L = cfg.legs[0];
    const belly = this.sup ? cfg.pivotY - this.sup.minY + 0.002 * cfg.s : cfg.belly.hh * 1.05 + (cfg.pivotY - cfg.belly.c.y) + 0.003 * cfg.s;
    this._sitH = Math.max(belly, 0.012 * cfg.s + 0.55 * (L.L1 + L.L2) * 0.8 + 0.003 * cfg.s);
    return this._sitH;
  }

  // lift the body (this frame) where its skin would enter the terrain: the torso (pelvis and chest,
  // with the fluff / breathing scale about the synsacrum) and the thighs (femur skin, posed as in the
  // last frame relative to the body: the femur stays near its rest angle, so it moves with the body)
  restOnGround() {
    const cfg = this.cfg, P = this.P;
    // (also just after a touchdown, when the landing crouch may press the belly down)
    // (skipped while nothing presses the body down, but only once the belly is clear: switching the
    // lift off while it still held the body up dropped it in one frame as a posture faded out)
    if (P.groundW < 0.01 && P.drop < 0.3 && !(this.time - (this._touchTime ?? -9) < 0.8) && !(this._restPen > 0)) { this._resting = false; return; }
    this._resting = true;
    const q = this.qB;
    let pen = 0;
    const sup = this.sup;
    if (sup) {
      const s = cfg.s, b = this.body;
      // candidates against the terrain's tangent plane under the body, the deepest few checked exactly
      const h0 = this.terrainH(b.x, b.z), n = this.terrainN(b.x, b.z, tv());
      const gx = n.x / n.y, gz = n.z / n.y;
      const K = 4, cand = this._supCand || (this._supCand = new Float64Array(K * 4));
      let nc = 0;
      const consider = (x, y, z) => {
        const pp = h0 - gx * (x - b.x) - gz * (z - b.z) - y;
        if (nc < K) { cand[nc * 4] = pp; cand[nc * 4 + 1] = x; cand[nc * 4 + 2] = y; cand[nc * 4 + 3] = z; nc++; return; }
        let mi = 0;
        for (let k = 1; k < K; k++) if (cand[k * 4] < cand[mi * 4]) mi = k;
        if (pp > cand[mi * 4]) { cand[mi * 4] = pp; cand[mi * 4 + 1] = x; cand[mi * 4 + 2] = y; cand[mi * 4 + 3] = z; }
      };
      // skinning data of the bones the support uses: the torso as written this frame, the others (thighs
      // and their blends) as posed last frame, carried by the body's motion since then
      const delta = this._supPrevOk ? _m4b.compose(b, q, ONE).multiply(_m4.copy(this._supPrev).invert()) : null;
      for (const i of sup.bones) {
        const M = this.sk.bones[i].matrixWorld;
        this._supBone(i, delta && i !== this.ix.pelvis && i !== this.ix.chest ? _m4c.multiplyMatrices(delta, M) : M);
      }
      const o3 = this._supOut || (this._supOut = new Float64Array(3));
      for (let k = 0; k < sup.n; k++) { this._supSkin(k, o3); consider(o3[0], o3[1], o3[2]); }
      const clr = 0.0008 * s;
      for (let k = 0; k < nc; k++) pen = Math.max(pen, this.terrainH(cand[k * 4 + 1], cand[k * 4 + 3]) + clr - cand[k * 4 + 2]);
    } else {
      for (let k = -1; k <= 1; k++) {
        const c = tv(0, cfg.belly.c.y - cfg.pivotY, cfg.belly.c.z - cfg.pivot.z + k * cfg.belly.hh * 0.9).applyQuaternion(q).add(this.body);
        const dl = tv(0, -1, 0).applyQuaternion(tqc(q).invert());
        const su = Math.sqrt((cfg.belly.hh * dl.y) ** 2 + (cfg.belly.hw * dl.x) ** 2 + (cfg.belly.hh * 1.3 * dl.z) ** 2);
        const gy = this.terrainH(c.x, c.z);
        pen = Math.max(pen, gy + 0.002 * cfg.s - (c.y - su * (k === 0 ? 1 : 0.8)));
      }
    }
    this._restPen = pen;
    if (pen > 0) {
      this.body.y += pen;
      this._origin.y += pen;
      // re-write the torso bones at the lifted height (same rotations and scales)
      const syn = this.B(tv().copy(this.J.synsacrum).sub(cfg.pivot), tv());
      this.setBoneQ('pelvis', tv().addVectors(syn, this._shP), tqc(q), this._sclP);
      this.setBoneQ('chest', tv().addVectors(syn, this._shC), this.qChest, this._sclC);
      // the height spring carries the support's lift (and stops sinking); only the lift: the body height
      // also holds the sitting floor's soft lift, re-applied every frame - copying the whole height into
      // the spring doubled it (a hen standing up after a fall jumped 5 mm in one frame)
      this.hY.x += pen;
      if (this.hY.v < 0) this.hY.v = 0;
    }
  }

  // dual quaternion + bind-space scale of bone i posed at M (as tools/lib/skin.mjs / core/render/dqs.js)
  _supBone(i, M) {
    const d = this._supD, o = i * 20, B = this._supBind[i];
    M.decompose(_sp, _sq, _ss);
    _sq.multiply(B.qi);
    _st.copy(B.t).applyQuaternion(_sq).negate().add(_sp);
    const qx = _sq.x, qy = _sq.y, qz = _sq.z, qw = _sq.w, tx = _st.x, ty = _st.y, tz = _st.z;
    d[o] = qx; d[o + 1] = qy; d[o + 2] = qz; d[o + 3] = qw;
    d[o + 4] = 0.5 * (qw * tx + ty * qz - tz * qy);
    d[o + 5] = 0.5 * (qw * ty + tz * qx - tx * qz);
    d[o + 6] = 0.5 * (qw * tz + tx * qy - ty * qx);
    d[o + 7] = -0.5 * (tx * qx + ty * qy + tz * qz);
    if (Math.abs(_ss.x - 1) + Math.abs(_ss.y - 1) + Math.abs(_ss.z - 1) < 1e-5) {
      d[o + 8] = 1; d[o + 9] = 0; d[o + 10] = 0; d[o + 11] = 0; d[o + 12] = 0; d[o + 13] = 1; d[o + 14] = 0; d[o + 15] = 0; d[o + 16] = 0; d[o + 17] = 0; d[o + 18] = 1; d[o + 19] = 0;
    } else {
      const R = B.R.elements, sx = _ss.x, sy = _ss.y, sz = _ss.z;
      // A = R S R^T (column-major R), then the offset that keeps the bind head fixed
      for (let r = 0; r < 3; r++) {
        const a0 = R[r] * sx * R[0] + R[r + 3] * sy * R[3] + R[r + 6] * sz * R[6];
        const a1 = R[r] * sx * R[1] + R[r + 3] * sy * R[4] + R[r + 6] * sz * R[7];
        const a2 = R[r] * sx * R[2] + R[r + 3] * sy * R[5] + R[r + 6] * sz * R[8];
        const bt = B.t;
        d[o + 8 + r * 4] = a0; d[o + 9 + r * 4] = a1; d[o + 10 + r * 4] = a2;
        d[o + 11 + r * 4] = (r === 0 ? bt.x : r === 1 ? bt.y : bt.z) - (a0 * bt.x + a1 * bt.y + a2 * bt.z);
      }
    }
  }
  // the same for a bone posed with world rotation q (bone frame incl. its bind rotation) and head p, unscaled
  _supBoneQ(i, q, p) {
    const d = this._supD, o = i * 20, B = this._supBind[i];
    _sq.copy(q).multiply(B.qi);
    _st.copy(B.t).applyQuaternion(_sq).negate().add(p);
    const qx = _sq.x, qy = _sq.y, qz = _sq.z, qw = _sq.w, tx = _st.x, ty = _st.y, tz = _st.z;
    d[o] = qx; d[o + 1] = qy; d[o + 2] = qz; d[o + 3] = qw;
    d[o + 4] = 0.5 * (qw * tx + ty * qz - tz * qy);
    d[o + 5] = 0.5 * (qw * ty + tz * qx - tx * qz);
    d[o + 6] = 0.5 * (qw * tz + tx * qy - ty * qx);
    d[o + 7] = -0.5 * (tx * qx + ty * qy + tz * qz);
    d[o + 8] = 1; d[o + 9] = 0; d[o + 10] = 0; d[o + 11] = 0; d[o + 12] = 0; d[o + 13] = 1; d[o + 14] = 0; d[o + 15] = 0; d[o + 16] = 0; d[o + 17] = 0; d[o + 18] = 1; d[o + 19] = 0;
  }
  // skinned position of support vertex k (bones set by _supBone)
  _supSkin(k, out, sup = this.sup) {
    const D = this._supD, P = sup.P, I = sup.I, W = sup.W;
    const px = P[k * 3], py = P[k * 3 + 1], pz = P[k * 3 + 2];
    let sx = 0, sy = 0, sz = 0, r0 = 0, r1 = 0, r2 = 0, r3 = 0, d0 = 0, d1 = 0, d2 = 0, d3 = 0, ws = 0;
    const b0 = I[k * 4] * 20;
    const a0 = D[b0], a1 = D[b0 + 1], a2 = D[b0 + 2], a3 = D[b0 + 3];
    for (let j = 0; j < 4; j++) {
      const w = W[k * 4 + j];
      if (!(w > 0)) continue;
      const o = I[k * 4 + j] * 20;
      ws += w;
      sx += w * (D[o + 8] * px + D[o + 9] * py + D[o + 10] * pz + D[o + 11]);
      sy += w * (D[o + 12] * px + D[o + 13] * py + D[o + 14] * pz + D[o + 15]);
      sz += w * (D[o + 16] * px + D[o + 17] * py + D[o + 18] * pz + D[o + 19]);
      const sg = D[o] * a0 + D[o + 1] * a1 + D[o + 2] * a2 + D[o + 3] * a3 < 0 ? -w : w;
      r0 += sg * D[o]; r1 += sg * D[o + 1]; r2 += sg * D[o + 2]; r3 += sg * D[o + 3];
      d0 += sg * D[o + 4]; d1 += sg * D[o + 5]; d2 += sg * D[o + 6]; d3 += sg * D[o + 7];
    }
    ws = Math.max(ws, 1e-5);
    sx /= ws; sy /= ws; sz /= ws;
    const L = Math.max(Math.hypot(r0, r1, r2, r3), 1e-6);
    const qx = r0 / L, qy = r1 / L, qz = r2 / L, qw = r3 / L, dx = d0 / L, dy = d1 / L, dz = d2 / L, dw = d3 / L;
    const tx = 2 * (qw * dx - dw * qx + (qy * dz - qz * dy));
    const ty = 2 * (qw * dy - dw * qy + (qz * dx - qx * dz));
    const tz = 2 * (qw * dz - dw * qz + (qx * dy - qy * dx));
    const cx = qy * sz - qz * sy + qw * sx, cy = qz * sx - qx * sz + qw * sy, cz = qx * sy - qy * sx + qw * sz;
    out[0] = sx + 2 * (qy * cz - qz * cy) + tx;
    out[1] = sy + 2 * (qz * cx - qx * cz) + ty;
    out[2] = sz + 2 * (qx * cy - qy * cx) + tz;
    return out;
  }

  // ----------------------------------------------------------------- legs
  poseLegs(dt, air) {
    const cfg = this.cfg, P = this.P, s = cfg.s;
    // air weight of the legs: tucked in flight, thrown forward for landing
    let airT = air ? 1 : 0;
    if (this.mode === 'takeoff' && this.to.air) airT = smooth(0.02, 0.28, this.to.tAir);
    // (legFree: the legs let go of the ground and hang in the body frame - dead, talon strike)
    const aw0 = Math.max(this.airLeg.step(airT, air ? 12 : 30, dt), P.legFree);
    // landing reach: held after touchdown while the legs blend back to the ground
    if (this.ld) this._reach = this.ld.reach || 0;
    else if (this.to && this.to.hopOnly) this._reach = this.to.reach || 0;
    else if (air) this._reach = 0;
    else if (this.airLeg.x < 0.01) this._reach = 0;
    const reach = Math.max(this._reach || 0, P.legReach * P.legFree);
    const bodyF = this.Bv(tv(0, 0, 1), tv()), bodyX = this.Bv(tv(1, 0, 0), tv()), bodyUp = this.Bv(tv(0, 1, 0), tv());
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i], L = leg.def;
      const hip = this.B(L.hip, leg.hip);
      // ---- target MTP (world) and foot frame
      const M = tv();
      const footUp = tv(0, 1, 0);
      let footYaw = leg.yaw;
      let groundY = null;
      // (legUp: this leg alone drawn up into the belly feathers, the bird standing on the other - a
      // raptor asleep; it leaves the ground like a free leg)
      const up = P.legUp[i], aw = Math.max(aw0, up);
      // (the ground target is dropped once the air weight is full: the blend reaches 1 exactly there,
      // so a far-behind planted foot cannot pop the leg when it is dropped)
      const awM = Math.min(1, aw / 0.995);
      if (awM < 1) {
        const c = this.groundFoot(leg, tv());
        leg.contact.copy(c);
        // posture: feet move toward sit / lie targets (tarsus under the body)
        M.copy(c);
        groundY = c.y;
        if (leg.state === 'stance') footUp.copy(leg.plantN);
        else footUp.copy(UP);
        // (to the vertical of the air pose as the leg leaves the ground: the terrain normal switched in
        // when the air weight fell below full, a dead chick's toes jumped 3 mm on the slope)
        if (aw > 0.5) footUp.lerp(UP, smooth(0.5, 0.995, aw)).normalize();
        // (toward the yaw the foot is planted with at touchdown: no twist step in turns)
        if (leg.state === 'swing') footYaw = lerp(leg.liftYaw ?? this.heading, this.heading + this.yawRate * (this._yawAhead ?? 0.05), smooth(0, 1, leg.w));
        M.addScaledVector(footUp, cfg.feet.pad);
        // sitting on the tarsi: the (thick) intertarsal pad rests on the ground, the MTP a little higher
        if (P.sit > 0.001) M.y += P.sit * (cfg.feet.sitPad ?? 0.004) * s;
        // scratching (fowl feeding): the foot reaches forward, rakes back along the ground and returns
        // to its print; C1 in the rake phase u (sin^2 lifts, smoothstep strokes)
        const sw = P.scratchW[i];
        if (sw > 1e-4 && leg.state === 'stance') {
          const u = P.scratchU[i];
          const a = smooth(0, 0.22, u), b = smooth(0.22, 0.72, u), c = smooth(0.72, 1, u);
          const f = (0.28 * a - 0.7 * b + 0.42 * c) * cfg.legLen * sw;
          const lift = (u < 0.22 ? Math.sin(Math.PI * u / 0.22) ** 2 * 0.13 : u > 0.72 ? Math.sin(Math.PI * (u - 0.72) / 0.28) ** 2 * 0.1 : 0) * cfg.legLen * sw;
          M.addScaledVector(this.F, f); M.y += lift;
          leg.scratchLift = lift / (0.13 * cfg.legLen);
        } else leg.scratchLift = 0;
      }
      if (aw > 0.001) {
        // air target in the body frame: folded back along the body axis, the feet under the tail
        // coverts (flight.legTuck { back, down, side }, fractions of the leg length; every bird tucks by
        // default - the old default, half a leg straight down in the standing frame, left an eagle's feet
        // hanging under its belly in cruise), or thrown forward to land
        const lt = cfg.flight.legTuck || DEFAULT_TUCK;
        const ct = Math.cos(cfg.tilt), st = Math.sin(cfg.tilt);
        const tuckLocal = tv(L.cx * L.side * (lt.side ?? 0.7), L.hip.y - L.len * (lt.back * st + (lt.down ?? 0) * ct), L.hip.z - L.len * (lt.back * ct - (lt.down ?? 0) * st));
        const reachLocal = tv(L.cx * L.side * 1.1, L.hip.y - L.len * 0.86, L.hip.z + L.len * 0.18);
        tuckLocal.lerp(reachLocal, reach);
        // drawn up standing: the foot folded under the belly, a little in from the hip
        if (up > 0) tuckLocal.lerp(tv(L.cx * L.side * 0.55, L.hip.y - L.len * 0.4, L.hip.z + L.len * 0.04), up);
        const A = this.B(tuckLocal, tv());
        // take-off: the feet leave from their planted spots and move to the air pose quickly
        if (leg.frozenOn) A.lerp(leg.frozen, 1 - smooth(0, 0.16, this.to && this.to.air ? this.to.tAir : 1));
        // landing: the feet arrive on their touch points exactly as the body does
        if (this.ld && this.ld.phase === 'final' && this.ld.feetW > 0) {
          const lp = this.landPlant(leg, tv());
          lp.y += cfg.feet.pad;
          A.lerp(lp, this.ld.feetW);
        }
        M.lerp(A, awM);
        // (the foot turns to the heading as the leg leaves the ground, continuously: a switch at half air
        // weight snapped every toe by the turn made since the foot was planted - a chick taking off in a
        // turn, 95 rad/s*)
        footYaw += angDiff(footYaw, this.heading) * smooth(0.25, 0.75, aw);
      }
      // perch: feet on the branch top
      // keep the MTP above the terrain
      const gH = this.terrainH(M.x, M.z) + lerp(cfg.feet.pad * 0.8, cfg.feet.sole ?? cfg.feet.pad * 0.8, aw);
      if (M.y < gH) M.y = gH;
      leg.mtp.copy(M);
      // ---- toe roll (heel lift) late in stance and toe curl in swing / flight
      // toe targets on the ground (roll at toe-off, curl in swing) and in the air (curled when tucked,
      // open when reaching), blended continuously by the air weight
      let rollT = 0, curlT = 0, spreadT = 1;
      if (leg.state === 'stance') rollT = leg.mode === 'gait' ? 30 * DEG * smooth(0.7, 1, leg.u) * P.legGait : 0;
      else {
        curlT = cfg.feet.curl * DEG * Math.sin(Math.PI * clamp(leg.w * 1.5, 0, 1));
        spreadT = 1 - 0.5 * Math.sin(Math.PI * leg.w);
      }
      const ka = smooth(0.25, 0.75, aw);
      leg.ka = ka;
      if (ka > 0) {
        rollT *= 1 - ka;
        curlT = lerp(curlT, lerp(cfg.feet.curl * DEG * 1.1, 0, reach), ka);
        spreadT = lerp(spreadT, lerp(0.35, 1.25, reach), ka);
      }
      if (this.mode === 'perch' && this.perch) { curlT = this.perch.curl; spreadT = 1; rollT = 0; }
      curlT += P.toeCurl;
      // scratching: toes close as the foot lifts, spread and rake flat along the ground
      if (leg.scratchLift > 0) { curlT += cfg.feet.curl * DEG * 0.6 * clamp(leg.scratchLift, 0, 1); rollT = 0; }
      let roll = leg.roll.step(rollT, 25, dt), curl = leg.curl.step(curlT, aw < 0.5 && leg.state === 'swing' ? 60 : 30, dt);
      let spread = leg.spread.step(spreadT, 18, dt);
      // a ground swing ends with the foot flat: the toe roll of the last push-off, the swing curl and the
      // closed toe spread are eased out exactly by touchdown (the springs lagged: toes still uncurling and the foot still
      // rolled in the first stance frames moved its ground contact by ~1 % S)
      if (leg.state === 'swing' && aw < 0.5 && this.mode === 'ground') {
        // (on the swing's progress at the next frame: a short swing - a chick's walk is 5 frames - ends
        // before its own w reaches 0.97, and the toes landed curled, uncurling through the stance)
        const wN = Math.min(1, leg.w + (this._dt || 1 / 60) / Math.max(1e-3, leg.swingDur));
        const k = 1 - smooth(0.72, 0.97, wN) * (1 - aw * 2);
        const cBase = P.toeCurl + (this.mode === 'perch' && this.perch ? this.perch.curl : 0);
        roll *= k; curl = cBase + (curl - cBase) * k; spread = 1 + (spread - 1) * k;
        leg.roll.x = roll; leg.roll.v *= k; leg.curl.x = curl; leg.curl.v *= k; leg.spread.x = spread; leg.spread.v *= k;
      }
      // rolling onto the toes raises the MTP about the toe joints
      const la = L.toes[2].la;
      if (roll > 1e-4) M.addScaledVector(footUp, la * Math.sin(roll));
      // ---- leg IK: femur near rest, 2-bone tibia + tarsus to the MTP (ankle points back)
      const ankle = this.solveLeg(leg, hip, M, bodyF, bodyX, bodyUp);
      // sitting: tarsus lies forward along the ground, ankle on the ground behind the foot
      // (only a foot on the ground folds so: one caught mid-swing by a collapse - death on the move -
      // lands first; the weight follows the swing's lift profile, so it is continuous at both ends)
      const onGround = leg.state === 'stance' ? 1 : 1 - Math.pow(Math.sin(Math.PI * Math.pow(clamp(leg.w, 0, 1), 0.9)), 1.2);
      let sitW = P.sit * (1 - smooth(0, 0.6, aw)) * onGround;
      if (sitW > 0.001) {
        const fwd = tv(Math.sin(footYaw), 0, Math.cos(footYaw));
        const ab = tv().copy(M).addScaledVector(fwd, -L.L3 * 0.94);
        ab.y = (groundY ?? this.terrainH(ab.x, ab.z)) + 0.0085 * s + L.L3 * 0.12;
        // (only a foot under the body can be sat on: one left behind by a body still sliding on - death
        // on the move - puts the folded ankle out of the leg's reach; the fold fades out there instead
        // of dragging the ankle round the reach limit)
        sitW *= 1 - smooth(0.92, 1.12, ab.distanceTo(hip) / ((L.L1 + L.L2) * 0.995));
        ankle.lerp(ab, sitW);
        const d = tv().subVectors(ankle, hip);
        const dl = d.length(), mx = (L.L1 + L.L2) * 0.995;
        if (dl > mx) ankle.copy(hip).addScaledVector(d, mx / dl);
      }
      // ankle never in the ground
      const agy = this.terrainH(ankle.x, ankle.z) + (cfg.feet.hock ?? 0.004) * s;
      if (ankle.y < agy) ankle.y = agy;
      // the tarsus keeps its length: an ankle pushed closer to the MTP target than the tarsus is long
      // (the body collapsing onto a foot: death on the move, a crouch over a swinging foot) would put
      // the MTP past its target, into the ground. Then the ankle moves out along the tarsus to its
      // length (above the ground), and the MTP lands on the target
      {
        const d = tv().subVectors(ankle, M), dl = d.length();
        if (dl < L.L3 * 0.999 && dl > 1e-6) {
          const mt = tv().copy(ankle).addScaledVector(d, -L.L3 / dl);
          // (weighted by the depth of the MTP, full at the ground: continuous, no threshold)
          const wFix = smooth(0, 1, (this.terrainH(mt.x, mt.z) + cfg.feet.pad - mt.y) / cfg.feet.pad);
          if (wFix > 0) {
            const a0 = tv().copy(ankle);
            ankle.copy(M).addScaledVector(d, L.L3 / dl);
            const ag = this.terrainH(ankle.x, ankle.z) + (cfg.feet.hock ?? 0.004) * s;
            if (ankle.y < ag) {
              const dy = Math.min(ag - M.y, L.L3 * 0.999), hx = ankle.x - M.x, hz = ankle.z - M.z, hl = Math.hypot(hx, hz) || 1;
              const hor = Math.sqrt(L.L3 * L.L3 - dy * dy);
              ankle.set(M.x + (hx / hl) * hor, M.y + dy, M.z + (hz / hl) * hor);
            }
            // (within the hip's reach)
            const dh = tv().subVectors(ankle, hip), dhl = dh.length(), mxh = (L.L1 + L.L2) * 0.995;
            if (dhl > mxh) ankle.copy(hip).addScaledVector(dh, mxh / dhl);
            ankle.lerp(a0, 1 - wFix);
          }
        }
      }
      // femur + tibia: 2-bone hip -> knee -> ankle, pole = heuristic knee
      const knee = this.twoBone(hip, ankle, L.L1, L.L2, leg.knee, leg.kneePole, leg);
      // tarsus: ankle -> MTP (length kept)
      const tdir = tv().subVectors(M, ankle);
      const tl = tdir.length();
      if (tl > 1e-6) tdir.multiplyScalar(1 / tl); else tdir.copy(bodyUp).negate();
      const mtp = tv().copy(ankle).addScaledVector(tdir, L.L3);
      (leg.mtpReal || (leg.mtpReal = new THREE.Vector3())).copy(mtp);
      // planted: in stance and the foot actually on its target (not still arriving / out of reach). This
      // is the real ground contact (state.legs[].stance). A gait stance counts as soon as the foot is
      // on its target (requiring the toe curl to be at rest too left most walking and running stances
      // unreported - a chicken's run had none - and so unmeasured); standing, toes that an action
      // curls or opens (a strike, a clench) are not a plant until they are still
      const walking = this.mode === 'ground' && this.speed > 0.05 * cfg.sq;
      // (a leg that starts to let go of the ground - its air weight rising, dead or striking - is no
      // longer a plant: its target blends toward the air pose, a leg length away)
      leg.planted = leg.state === 'stance' && aw < 1e-3 && mtp.distanceToSquared(M) < (0.0025 * s) ** 2 && (walking || Math.abs(leg.curl.v) < 0.25);
      leg.ankle.copy(ankle);
      // (flight.shape.legs: the thigh and trouser feathers sleeked in flight - the femur's skin drawn in
      // toward the hip, the tibiotarsus's thinned about the bone)
      const kL = this.shapeW > 0 && cfg.shape.legs ? 1 - cfg.shape.legs * this.shapeW : 1;
      this.setBoneC(L.n.femur, hip, tv().subVectors(knee, hip), bodyX, kL < 1 ? tv(kL, kL, kL) : null);
      this.setBoneC(L.n.tibia, knee, tv().subVectors(ankle, knee), bodyX, kL < 1 ? tv(kL, 1, kL) : null);
      this.setBoneC(L.n.tarsus, ankle, tdir, bodyX);
      // ---- toes in the foot frame
      const yaw = footYaw;
      const fz = tv(Math.sin(yaw), 0, Math.cos(yaw));
      fz.addScaledVector(footUp, -fz.dot(footUp)).normalize();
      const fx = tv().crossVectors(footUp, fz).normalize(); // left of the foot
      // crowd LOD: between full solves the toes ride on the tarsus
      const ti = this.ix.toes[i];
      if (this.fullFrame) {
        this.poseToes(leg, mtp, fx, footUp, fz, roll, curl, spread);
        if (this.lod === 2) this.store(ti.tarsus, ti.toes);
      } else this.follow(ti.tarsus, ti.toes);
      leg.contact.copy(M).addScaledVector(footUp, -cfg.feet.pad);
    }
  }

  // femur heuristic + 2-bone knee -> ankle -> M (ankle bends backward). Returns the ankle (temp).
  solveLeg(leg, hip, M, bodyF, bodyX, bodyUp) {
    const L = leg.def, cfg = this.cfg;
    // femur: rest direction in the body frame, swung a little with the foot's fore-aft offset
    const rel = tv().subVectors(M, hip);
    const fa = rel.dot(bodyF) / cfg.legLen - (L.cz - L.hip.z) / cfg.legLen;
    const fDir = this.Bv(L.femur0, tv());
    fDir.applyAxisAngle(bodyX, -Math.tanh(fa * 0.9 / 0.7) * 0.7);
    const knee0 = tv().copy(hip).addScaledVector(fDir, L.L1);
    leg.kneePole = leg.kneePole || new THREE.Vector3();
    leg.kneePole.copy(knee0);
    // 2-bone knee0 -> ankle -> M
    const d = tv().subVectors(M, knee0);
    let dist = d.length();
    const maxD = (L.L2 + L.L3) * 0.995, soft = (L.L2 + L.L3) * 0.9, minD = Math.abs(L.L2 - L.L3) + 0.01 * cfg.s;
    if (dist > soft) dist = soft + (maxD - soft) * (1 - Math.exp(-(dist - soft) / (maxD - soft)));
    dist = Math.max(dist, minD);
    const e1 = d.normalize();
    const pole = tv().copy(bodyF).negate().addScaledVector(bodyUp, 0.6); // ankle behind (and up when the foot trails)
    const e2 = tv().copy(pole).addScaledVector(e1, -pole.dot(e1));
    if (e2.lengthSq() < 1e-8) e2.copy(bodyUp);
    e2.normalize();
    const c = clamp((L.L2 * L.L2 + dist * dist - L.L3 * L.L3) / (2 * L.L2 * dist), -1, 1);
    return tv().copy(knee0).addScaledVector(e1, c * L.L2).addScaledVector(e2, Math.sqrt(1 - c * c) * L.L2);
  }

  // 2-bone A -> joint -> B with lengths l1, l2 in the plane of the pole point
  twoBone(A, B, l1, l2, out, polePt, leg) {
    const d = tv().subVectors(B, A);
    let dist = d.length();
    const mx = (l1 + l2) * 0.999, mn = Math.abs(l1 - l2) + 1e-4;
    dist = clamp(dist, mn, mx);
    const e1 = d.normalize();
    // pole: toward the heuristic joint, biased forward so a straight limb never flips its plane
    const e2 = tv().subVectors(polePt, A).normalize().addScaledVector(this.Bv(tv(0, 0, 1), tv()), 0.7);
    e2.addScaledVector(e1, -e2.dot(e1));
    if (e2.lengthSq() < 1e-10) e2.copy(this.F);
    e2.normalize();
    const c = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
    out.copy(A).addScaledVector(e1, c * l1).addScaledVector(e2, Math.sqrt(1 - c * c) * l1);
    // B is re-derived by the caller from the solved joint (lengths kept)
    const dB = tv().subVectors(B, out).normalize();
    B.copy(out).addScaledVector(dB, l2);
    return out;
  }

  poseToes(leg, mtp, fx, fy, fz, roll, curl, spread) {
    const L = leg.def, S = L.side, P = this.P;
    const s = this.cfg.s;
    // clearance of the MTP above the ground: curled toes must not reach into it
    const gm = this.terrainH(mtp.x, mtp.z);
    const clear = mtp.y - gm - 0.0015 * s;
    for (let k = 0; k < 4; k++) {
      const T = L.toes[k];
      const la = T.a, lb = T.b;
      // bind directions in the foot frame, spread about the foot axis
      const dA = tv().copy(fx).multiplyScalar(la.x * spread * S).addScaledVector(fy, la.y).addScaledVector(fz, la.z).normalize();
      const dB = tv().copy(fx).multiplyScalar(lb.x * spread * S).addScaledVector(fy, lb.y).addScaledVector(fz, lb.z).normalize();
      // flexion toward the sole (down): toe a takes part of the curl plus the heel-lift roll (so
      // its mid joint stays on the ground), toe b the rest of the curl (flat when only rolled)
      let thA = T.back ? curl * 0.5 - roll * 0.5 : curl * 0.55 + roll;
      let thB = T.back ? curl * 0.9 : curl * 1.0;
      // no segment flexes past ~83 deg below the horizontal from its bind slope (soft cap): a death
      // clench on top of the flight tuck curled the toes 140 deg, past where the drop model below is
      // monotonic - the room limit then jumped as the feet came down (100 rad/s*); a joint cannot flex
      // that far anyway
      thA = smin(thA, T.eA + 1.45, 0.15);
      thB = smin(thB, T.eB + 1.45 - thA + (T.back ? 0 : roll), 0.15);
      // limit the curl to the room under the foot (continuous): tip drop = la sin(a) + lb sin(a + b)
      const base = T.back ? -roll * 0.5 : roll;
      // (angles capped at 90 deg: the drop is then monotonic in the curl, so the limit is continuous;
      // measured from each segment's bind slope - a raised MTP pad has its toes sloping down already,
      // and a clenched toe then dropped further than modelled, into the ground under a dead bird)
      const drop = (ka) => T.la * Math.sin(clamp(base + (thA - base) * ka - T.eA, 0, 1.5708)) + T.lb * Math.sin(clamp(base + (thA - base) * ka + thB * ka - (T.back ? 0 : roll) - T.eB, 0, 1.5708));
      // (the limit is rate-limited: it can release abruptly when the foot rises fast)
      let lo = 1;
      if (drop(1) > clear) {
        lo = 0; let hi = 1;
        for (let it = 0; it < 6; it++) { const mid = 0.5 * (lo + hi); if (drop(mid) > clear) hi = mid; else lo = mid; }
      }
      const ls = leg.toeLo || (leg.toeLo = [1, 2, 3, 4].map(() => new Spring(1)));
      // tightening is immediate (no penetration), releasing follows a spring
      lo = lo < ls[k].x ? (ls[k].reset(lo), lo) : ls[k].step(lo, 14, this._dt || 1 / 60);
      if (lo < 0.9999) { thA = base + (thA - base) * lo; thB *= lo; }
      // flexion axis: across the toe; a toe pointing along the foot's up axis falls back smoothly on the
      // foot's lateral axis (signed as for a level toe) so the axis never flips
      const lat = tv().crossVectors(dA, fy);
      const fl = T.back ? 1 : -1;
      lat.addScaledVector(fx, fl * Math.max(0, 0.35 - lat.length())).normalize();
      dA.applyAxisAngle(lat, -thA);
      const m = tv().copy(mtp).addScaledVector(dA, T.la);
      const latB = tv().crossVectors(dB, fy);
      latB.addScaledVector(fx, fl * Math.max(0, 0.35 - latB.length())).normalize();
      dB.applyAxisAngle(latB, -(thA + thB - (T.back ? 0 : roll)));
      // conform to uneven ground: raise the toe segments whose ends would enter the terrain
      const cl = (this.cfg.feet.toeClear ?? 0.0012) * s;
      const gmid = this.terrainH(m.x, m.z) + cl;
      if (m.y < gmid) {
        const up = Math.asin(clamp((gmid - m.y) / T.la, 0, 1));
        dA.applyAxisAngle(lat, up); m.copy(mtp).addScaledVector(dA, T.la);
        dB.applyAxisAngle(latB, up);
      }
      const tx = m.x + dB.x * T.lb, tz = m.z + dB.z * T.lb, ty = m.y + dB.y * T.lb;
      const gtip = this.terrainH(tx, tz) + cl;
      if (ty < gtip) dB.applyAxisAngle(latB, Math.asin(clamp((gtip - ty) / T.lb, 0, 1)));
      this.setBoneC(L.n.toeA[k], mtp, dA, fx);
      this.setBoneC(L.n.toeB[k], m, dB, fx);
    }
  }

  // ----------------------------------------------------------------- wings & feathers
  poseWings(dt, air) {
    const cfg = this.cfg, P = this.P, W = cfg.wing, fl = this.fl;
    // ---- flap cycle
    let amp = 0, freqK = 0;
    const flap = W.flap, pw = W.power;
    if (air) {
      const pk = smooth(0.5, 1, fl.power);
      freqK = lerp(flap.freq, pw.freq, pk);
      amp = lerp(flap.amp * lerp(0.7, 1, smooth(0.2, 0.5, fl.power)), pw.amp, pk) * (1 - fl.glide);
    }
    // ground flapping (jump, attack, hit, balance)
    // ground flapping (jump, attack, hit, display), eased in and out
    this.flapS = this.flapS || new Spring(0);
    const gf = clamp(this.flapS.step(P.flap, 9, dt), 0, 1);
    if (gf > 0.001) {
      freqK = lerp(freqK, pw.freq * 1.05, gf);
      amp = lerp(amp, pw.amp * P.flapAmp, gf);
    }
    fl.amp = fl.ampS.step(amp, 10, dt);
    fl.freq = freqK || fl.freq;
    const prevPsi = fl.psi;
    if (fl.amp > 0.01 || fl.freq > 0) fl.psi = wrap01(fl.psi + fl.freq * dt);
    if (fl.psi < prevPsi && fl.amp > 0.05) { fl.beatCount++; if (air || P.flap > 0.3) this.emit('wingbeat', { amp: fl.amp }); }
    this.state.stats.flapFreq = fl.amp > 0.05 ? fl.freq : 0;
    // stroke blend between cruise and power parameters
    this.kS = this.kS || new Spring(0);
    const k = clamp(this.kS.step(clamp(smooth(0.5, 1, fl.power) * (air ? 1 : 0) + gf * 0.8, 0, 1), 8, dt), 0, 1);
    const D = lerp(flap.down, pw.down, k), ps = fl.psi;
    let e, up = 0, dn = 0;
    // (sin^2 shaping keeps the flexion / sweep / twist terms C1 across the stroke reversals)
    if (ps < D) { const u = ps / D; e = Math.cos(Math.PI * u); dn = Math.sin(Math.PI * u) ** 2; }
    else { const u = (ps - D) / (1 - D); e = -Math.cos(Math.PI * u); up = Math.sin(Math.PI * u) ** 2; }
    const ampN = fl.amp / Math.max(1e-3, lerp(flap.amp, pw.amp, k));
    const mid = lerp(flap.mid, pw.mid, k) + this.flare * 15 * DEG;
    // ---- openness: folded on the ground, open in the air / for ground actions
    let openT = air ? 1 : clamp(this.gait.wings * P.gaitW * smooth(0.3, 1.5, this.speed / cfg.sq), 0, 1);
    openT = Math.max(openT, P.wingOpen);
    // take-off: wings opened and raised during the crouch, ready for the first downstroke (takeoff.open)
    let preT = 0;
    const TO = this.to, toOpen = cfg.takeoff.open || 0;
    if (toOpen > 0 && this.mode === 'takeoff' && TO && !TO.hopOnly) {
      preT = TO.air ? toOpen * (1 - smooth(0, 0.25, TO.tAir)) : toOpen * smooth(0, Math.max(1e-3, 0.6 * (TO.crouch + TO.push)), TO.t);
      openT = Math.max(openT, preT);
    }
    const flareW = this.flare;
    const open = fl.open.step(openT, air ? 9 : preT > 0 ? 10 : 7, dt);
    // after landing: wings stay up briefly then fold
    // (groundLift only while the body is upright: a bird lying on its side must not lift a wing into the ground)
    const upright = W.groundLift ? smooth(0.5, 0.85, tv(0, 1, 0).applyQuaternion(this.qChest).y) : 0;
    for (let sI = 0; sI < 2; sI++) {
      const side = sI === 0 ? 1 : -1, wp = this.wp[sI], S = this.wingS[sI];
      const fold = W.fold, gl = W.glide;
      const fx = (key) => lerp(fold[key], gl[key], open);
      let elev = fx('elev'), pitch = fx('pitch'), alpha = fx('alpha'), elbow = fx('elbow'), wrist = fx('wrist'), bend = fx('bend'), twist = fx('twist');
      // stroke around the open pose
      if (fl.amp > 1e-3) {
        const flexU = lerp(flap.upFlex, pw.upFlex, k) * ampN, flexW = lerp(flap.upWrist, pw.upWrist, k) * ampN;
        const sweep = lerp(flap.sweep, pw.sweep, k) * ampN, tw = lerp(flap.twist, pw.twist, k) * ampN;
        elev += (mid + e * fl.amp * 0.5) * open;
        elbow += flexU * up; wrist += flexW * up;
        alpha += (-sweep * dn + sweep * 0.7 * up) * open;
        pitch += (-tw * 0.35 * dn + tw * 0.5 * up);
        twist += tw * (dn - 0.7 * up);
        bend += (-8 * dn + 10 * up) * DEG * ampN;
      } else if (air) {
        // glide: slight dihedral breathing and gust response
        elev += (Math.sin(this.time * 1.7 + sI) * 1.5 + Math.sin(this.time * 4.1) * 0.6) * DEG;
      }
      // flare: wings raised, swept forward, high angle of attack
      if (flareW > 0) {
        alpha += -18 * DEG * flareW; pitch += 25 * DEG * flareW; elev += 8 * DEG * flareW;
      }
      // banking: the inner wing slightly lower, outer higher (roll control)
      if (air) elev += side * this.bankS.x * 0.1;
      // posture / action offsets
      elev += P.wingElev + P.wingElevS[sI];
      // long wings part-open on the ground are carried raised so the tips clear the ground (wing.groundLift)
      if (!air && W.groundLift) elev += W.groundLift * 4 * open * (1 - open) * (1 - this.flare) * upright;
      if (preT > 0) elev += 40 * DEG * preT;
      alpha += P.wingAlpha;
      pitch += P.wingPitch;
      elbow = clamp(elbow - P.wingExtend * 60 * DEG, 5 * DEG, 178 * DEG);
      wrist = clamp(wrist - P.wingExtend * 60 * DEG + P.wingFoldExtra, 3 * DEG, 178 * DEG);
      elev += P.wingDroop * -20 * DEG * (1 - open * 0.5);
      // the stroke's top, the landing flare and the take-off lift add up to more than the shoulder can
      // raise the wing (the full power-stroke upstroke on top of a flare lifted it to 77 deg, the skin of
      // the shoulder stretched past 3x): soft cap at ~60 deg above the horizontal (C1, no kink)
      { const a = ELEV_CAP - 18 * DEG; if (elev > a) elev = a + 18 * DEG * Math.tanh((elev - a) / (18 * DEG)); }
      // springs for the non-flapping part (the stroke itself is exact)
      if (!this.wingInit) { S.elev.reset(elev); S.pitch.reset(pitch); S.alpha.reset(alpha); S.elbow.reset(elbow); S.wrist.reset(wrist); S.bend.reset(bend); S.twist.reset(twist); }
      const om = lerp(P.wingOmega * 18, 60, smooth(0, 0.4, fl.amp));
      wp.elev = S.elev.step(elev, om, dt); wp.pitch = S.pitch.step(pitch, om, dt); wp.alpha = S.alpha.step(alpha, om, dt);
      wp.elbow = S.elbow.step(elbow, om, dt); wp.wrist = S.wrist.step(wrist, om, dt); wp.bend = S.bend.step(bend, om, dt); wp.twist = S.twist.step(twist, om, dt);
      wp.uTwist = wp.twist * 0.3; wp.tilt = W.tilt;
      this.solveWing(sI, side, wp, dn, up, ampN);
    }
    this.wingInit = true;
  }

  solveWing(sI, side, wp, dn, up, ampN) {
    const cfg = this.cfg, W = cfg.wing, S = LEGS[sI], P = this.P;
    const fr = this.wf[sI];
    wingFK(fr, side, W.L, wp);
    // body-local -> world
    const q = this.qChest;
    const sh = tv().copy(W.shoulder[sI]).applyQuaternion(q).add(this.body);
    const toW = (v, out) => out.set(v.x, v.y, v.z).applyQuaternion(q);
    const dH = toW(fr.dH, tv()), nH = toW(fr.nH, tv()), dU = toW(fr.dU, tv()), nU = toW(fr.nU, tv()), dM = toW(fr.dM, tv()), nM = toW(fr.nM, tv());
    const elbow = tv().copy(sh).addScaledVector(dH, W.L.h);
    const r = W.skin * cfg.s;
    // the elbow too (a wing folded under a dead bird falling onto it: the forearm met the ground
    // first): the upper arm swings up about the shoulder just enough, with the same smooth ramp
    {
      const ge = this.terrainH(elbow.x, elbow.z) + r, pe = ge - elbow.y, ke = 0.012 * cfg.s;
      if (pe > -ke) {
        elbow.y += pe >= ke ? pe : (pe + ke) * (pe + ke) / (4 * ke);
        dH.subVectors(elbow, sh).normalize();
        elbow.copy(sh).addScaledVector(dH, W.L.h);
      }
    }
    const wrist = tv().copy(elbow).addScaledVector(dU, W.L.u);
    const tip = tv().copy(wrist).addScaledVector(dM, W.L.m);
    // keep the wrist and the hand tip above the terrain (lying, dead): lift the whole wing tip
    const gw = this.terrainH(wrist.x, wrist.z) + r, gt = this.terrainH(tip.x, tip.z) + r;
    const pen = Math.max(gw - wrist.y, gt - tip.y), kr = 0.012 * cfg.s;
    if (pen > -kr) {
      // smooth ramp (continuous in the penetration: no kink when the wing starts touching)
      const ramp = (x) => (x >= kr ? x : x > -kr ? (x + kr) * (x + kr) / (4 * kr) : 0);
      const lift = ramp(pen);
      // (the wrist follows 70 % of the tip's lift, but never stays below its own clearance: a wing
      // folded under a falling dead bird pressed its forearm into the ground)
      wrist.y += Math.max(lift * 0.7, ramp(gw - wrist.y)); tip.y += lift;
      dU.subVectors(wrist, elbow).normalize(); dM.subVectors(tip, wrist).normalize();
    }
    // the wing's skin too (measured on the mesh, see wingSupport): a half-open wing under a body rolling
    // onto it - a bird falling dead lands with its wings raised - put the forearm's trailing skin 4-6
    // cm into the ground with every joint clear. When a wing is near the ground, it swings up about the
    // shoulder, in the vertical plane through its deepest skin point, just enough (soft onset)
    const ws = this._wingSup ? this._wingSup[sI] : null;
    if (ws) {
      // (cheap gate: every skin point lies within reach + R of the shoulder; a lift still releasing
      // continues outside it)
      const reach = W.L.h + W.L.u + W.L.m + Math.max(ws[0].R, ws[1].R, ws[2].R);
      const gS = this.terrainH(sh.x, sh.z);
      const S = this._wsS || (this._wsS = [new Spring(0), new Spring(0)]);
      if (sh.y - reach < Math.max(gS, gw - r, gt - r) + 0.05 * cfg.s || S[sI].x > 1e-5) this.wingSkinLift(ws, sh, elbow, wrist, tip, dH, nH, dU, nU, dM, nM, gS, sI);
    }
    const wi = this.ix.wing[sI];
    this.setBoneC(wi.humerus, sh, dH, nH);
    this.setBoneC(wi.ulna, elbow, dU, nU);
    this.setBoneC(wi.hand, wrist, dM, nM);
    // crowd LOD: between full solves the feathers ride rigidly on the hand / forearm
    if (!this.fullFrame) { this.follow(wi.hand, this.ix.pri[sI]); this.follow(wi.ulna, this.ix.sec[sI]); return; }
    // ---- feathers: fan follows the wrist / elbow extension; primaries separate ("fingers") and
    // bend up under load on the downstroke
    const E = cfg.wingExt;
    const eH = clamp(extension(wp.wrist, E.fW, E.oW) + P.fanExtra, 0, 1.25), eU = clamp(extension(wp.elbow, E.fE, E.oE) + P.fanExtra * 0.5, 0, 1.2);
    const ff = this.ff, fw = this._fw;
    fw.P0.x = wrist.x; fw.P0.y = wrist.y; fw.P0.z = wrist.z;
    const air = this.mode !== 'ground' && this.mode !== 'perch';
    // (feather load eases in / out with the air weight: no bend step at take-off / touchdown)
    const aw = this._featherAirW = expTo(this._featherAirW ?? 0, air ? 1 : 0, sI === 0 ? (this._dt || 1 / 60) : 0, 0.08);
    const load = dn * ampN * aw;
    const sk = this.lod === 2 && (this.frame & 1) === 1;
    for (const f of cfg.pri) {
      const a = f.fold + (f.spread - f.fold) * eH;
      const bend0 = f.bend;
      f.bend = bend0 + (f.emarg > 0 ? load * 10 * DEG * f.emarg : load * 4 * DEG) - up * 3 * DEG * ampN + (f.emarg > 0 ? W.fingerLift * f.emarg * aw * this.fl.glide * eH : 0);
      featherFrame(ff, fw.P0, dM, nM, W.L.m, side, f, a, false);
      f.bend = bend0;
      this.featherBone(this.ix.pri[sI][f.i], ff, f.len, sk, 0, side, f);
    }
    for (const f of cfg.sec) {
      const a = f.fold + (f.spread - f.fold) * eU;
      featherFrame(ff, fw.P0, dU, nU, W.L.u, side, f, a, true);
      this.featherBone(this.ix.sec[sI][f.i], ff, f.len, sk, 0, side, f);
    }
    if (this.lod === 2) { this.store(wi.hand, this.ix.pri[sI]); this.store(wi.ulna, this.ix.sec[sI]); }
  }

  // (see solveWing) the wing's skin against the terrain: every skin point that comes within kr of the
  // ground asks for the rotation of the whole wing about the shoulder, in the vertical plane through
  // it, that lifts it clear (soft onset); the wing turns by the largest of them about the axis blended
  // from them by how much each needs (continuous, as the feather vanes: taking the single deepest point
  // swapped the axis between points lying equally deep - a wing folding off the ground popped its
  // feathers at 250 rad/s*). A bone whose skin's bounding sphere is clear of the ground is skipped
  // (its points could not ask for anything)
  wingSkinLift(ws, sh, elbow, wrist, tip, dH, nH, dU, nU, dM, nM, gS, sI) {
    const cfg = this.cfg, s = cfg.s, kr = 0.008 * s, clr = 0.002 * s;
    if (!this.Cm) this.setBoneC(-1);
    const n = this.terrainN(sh.x, sh.z, tv()), gx = n.x / n.y, gz = n.z / n.y, grad = Math.hypot(gx, gz);
    const heads = [sh, elbow, wrist], ds = [dH, dU, dM], ns = [nH, nU, nM];
    const axis = tv(0, 0, 0);
    let th = 0;
    for (let b = 0; b < 3; b++) {
      const wb = ws[b];
      const e = writeFrameC(_m4c, heads[b], ds[b], ns[b], this.Cm[wb.ib], null).elements, P = wb.pts;
      // (the terrain may bend away from the shoulder's tangent plane: a margin that grows with the distance)
      const cx = e[0] * wb.c[0] + e[4] * wb.c[1] + e[8] * wb.c[2] + e[12], cy = e[1] * wb.c[0] + e[5] * wb.c[1] + e[9] * wb.c[2] + e[13], cz = e[2] * wb.c[0] + e[6] * wb.c[1] + e[10] * wb.c[2] + e[14];
      const dc = Math.hypot(cx - sh.x, cz - sh.z);
      const curv = 0.01 * s + 0.1 * (dc + wb.R);
      if (cy - wb.R - (gS - gx * (cx - sh.x) - gz * (cz - sh.z)) - grad * wb.R > kr + clr + curv) continue;
      for (let k = 0, n3 = P.length / 3; k < n3; k++) {
        const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        if (gS - gx * (wx - sh.x) - gz * (wz - sh.z) + clr - wy <= -(kr + curv)) continue;
        const pe = this.terrainH(wx, wz) + clr - wy;
        if (pe <= -kr) continue;
        const lift = pe >= kr ? pe : (pe + kr) * (pe + kr) / (4 * kr);
        const bx = wx - sh.x, by = wy - sh.y, bz = wz - sh.z;
        const rv = Math.hypot(bx, by, bz), h = Math.hypot(bx, bz);
        if (rv < 1e-6 || h < 1e-6) continue;
        const a = Math.asin(clamp((by + lift) / rv, -1, 1)) - Math.asin(clamp(by / rv, -1, 1));
        if (!(a > 0)) continue;
        th = Math.max(th, a);
        axis.x -= (bz / h) * lift; axis.z += (bx / h) * lift;
      }
    }
    // the lift tightens at once (no skin in the ground) and releases through a spring about the last
    // axis: a wing taking the impact of a falling body was flung up and dropped back within a few
    // samples as the body's descent stopped (a V in its angle: the primaries jittered 6 % S)
    const S = this._wsS[sI], AX = this._wsAx || (this._wsAx = [new THREE.Vector3(), new THREE.Vector3()]);
    th = Math.min(th, 1.2);
    if (th > 1e-6 && axis.lengthSq() > 1e-16) AX[sI].copy(axis.normalize());
    if (th >= S.x) S.reset(th); else S.step(th, 22, this._dt || 1 / 60);
    th = Math.max(0, S.x);
    if (!(th > 1e-6) || AX[sI].lengthSq() < 0.5) return;
    for (const v of [dH, nH, dU, nU, dM, nM]) v.applyAxisAngle(AX[sI], th);
    // (the joints turn with the wing, as they are: the wrist may sit off the ulna's length where the
    // clearance above lifted it - rebuilding it from the lengths snapped it back 5 cm as the lift ended)
    const d = tv();
    for (const p of [elbow, wrist, tip]) { d.subVectors(p, sh).applyAxisAngle(AX[sI], th); p.copy(sh).add(d); }
  }

  // A feather bent on an arc (a rooster's sickle, core/build/featherCards.js `arc`) sweeps down behind
  // its root: swing it up about the bird's lateral axis just enough that no point along the arc is
  // below the terrain. The angle is a soft maximum over points along the arc, so it is continuous.
  liftArcFeather(root, ax, nn, len, arc, side, clr) {
    const s = this.cfg.s, F = this.F, Lf = this.Lf, kr = 0.012 * s;
    const tvv = tv().crossVectors(nn, ax).multiplyScalar(side), R = len / arc, q = tv();
    let th = 0;
    for (let k = 2; k <= 12; k++) {
      const an = (arc * k) / 12;
      q.copy(ax).multiplyScalar(R * Math.sin(an)).addScaledVector(tvv, R * (1 - Math.cos(an)));
      const pen = this.terrainH(root.x + q.x, root.z + q.z) + clr - root.y - q.y;
      if (pen <= -kr) continue;
      // soft (quadratic) onset of the lift: the rotation that lifts a point hanging below the root
      // grows like the square root of the lift, so a linear onset would pop
      const lift = pen >= kr ? pen : (pen + kr) * (pen + kr) / (4 * kr);
      const b = -(q.x * F.x + q.z * F.z), rho = Math.hypot(b, q.y);
      if (rho < 1e-4) continue;
      // elevation behind the root; points below or in front of the root are faded out (swinging the
      // feather back cannot lift them without first lowering them: no continuous solution there)
      const wf = smooth(0.05, 0.4, b / rho);
      if (wf > 0) th = Math.max(th, (Math.asin(clamp((q.y + lift) / rho, -1, 1)) - Math.atan2(q.y, b)) * wf);
    }
    if (th > 1e-5) { th = Math.min(th, 2.4); ax.applyAxisAngle(Lf, th); nn.applyAxisAngle(Lf, th); }
  }

  // A feather's vane edges: the tip and the root alone were kept clear, but a feather lying on the
  // ground or rising from it (a folded wing under a body that rolls back up) dipped a vane edge into it
  // (an eagle's secondaries are 7 cm wide). Both edges near the root, at mid-length and near the tip
  // (the width a covert card reaches) are lifted by pitching the feather up about its root, about the
  // axis the tip clamp uses (horizontal, across the rachis; a steep feather blends in its own lateral
  // axis): it lifts both edges at once. Each point's angle is solved on its circle about that axis; the
  // feather turns by the largest (soft onset). (Each point's own most direct axis cancelled out between
  // the two edges near the root and swung with small imbalances: a hen's primaries jittered.)
  vaneLift(root, ax, nn, len, f, side, clr) {
    const s = this.cfg.s, kr = 0.006 * s;
    const T = tv().crossVectors(nn, ax), tl = T.length();
    if (tl < 1e-6) return;
    T.multiplyScalar(side / tl); // (the inner vane's side, as the card)
    const Np = tv().crossVectors(ax, T).multiplyScalar(side); // (the normal square to the rachis)
    const k = tv().crossVectors(ax, UP), kl = k.length();
    if (kl < 0.35) { const lu = tv().crossVectors(T, ax).y; k.addScaledVector(T, lu * (1 - kl / 0.35)); }
    if (k.lengthSq() < 1e-10) return;
    k.normalize();
    const d = tv(), kd = tv(), vp = f.vp, droop = f.droopM, curve = f.curveM;
    let th = 0;
    for (let i = 0, nP = vp.length / 3 * 2; i < nP; i++) {
      // (the card's shape: the rachis curves toward the inner vane and droops toward -normal, the
      // convex vane's edges sit lower still)
      const j = (i >> 1) * 3, t = vp[j], w = i & 1 ? vp[j + 2] : -vp[j + 1];
      d.copy(ax).multiplyScalar(len * t).addScaledVector(T, curve * t * t + w).addScaledVector(Np, -(droop * t * t + 0.12 * Math.abs(w)));
      const pe = this.terrainH(root.x + d.x, root.z + d.z) + clr - root.y - d.y;
      if (pe <= -kr) continue;
      const lift = pe >= kr ? pe : (pe + kr) * (pe + kr) / (4 * kr);
      // height of the point turned by x about k (through the root): c + A cos x + B sin x
      const A = d.y - d.dot(k) * k.y, B = kd.crossVectors(k, d).y, R = Math.hypot(A, B);
      if (R < 1e-6) continue;
      // (a point the turn lowers first, or barely lifts, is faded out: continuous)
      const wf = smooth(0, 0.25, B / R);
      if (!(wf > 0)) continue;
      const phi = Math.atan2(B, A);
      const x = phi - Math.acos(clamp((A + lift) / R, -1, 1));
      if (x > 0) th = Math.max(th, x * wf);
    }
    if (th > 1e-6) { th = Math.min(th, 1.2); ax.applyAxisAngle(k, th); nn.applyAxisAngle(k, th); }
  }

  // writes a feather bone, lifting it off the terrain (rotating about its root) if needed
  // (wide: the widest half vane, m, for the vane-edge check; 0 = the rachis only)
  featherBone(name, ff, len, skipClamp, arc = 0, side = 1, f = null) {
    const r = ff.root, a = ff.axis, n = ff.normal;
    const root = tv(r.x, r.y, r.z), ax = tv(a.x, a.y, a.z), nn = tv(n.x, n.y, n.z);
    if (!skipClamp) {
      const s = this.cfg.s;
      const clr = 0.004 * s;
      const wide = f ? f.vane : 0, droop = f ? f.droopM : 0, curve = f ? f.curveM : 0;
      if (arc > 1e-3) this.liftArcFeather(root, ax, nn, len, arc, side, clr);
      else {
        // (the tip as the card draws it: curved toward the inner vane and drooped toward -normal)
        const Ti = tv().crossVectors(nn, ax), til = Ti.length();
        if (til > 1e-6) Ti.multiplyScalar(side / til);
        const Np = tv().crossVectors(ax, Ti).multiplyScalar(side);
        // (and the straight tip, the bone's end: whichever needs more lift - a feather upside down has
        // its drooped card tip above the straight one)
        let tipX = root.x + ax.x * len + Ti.x * curve - Np.x * droop, tipZ = root.z + ax.z * len + Ti.z * curve - Np.z * droop, tipY = root.y + ax.y * len + Ti.y * curve - Np.y * droop;
        let gT = this.terrainH(tipX, tipZ) + clr;
        if (curve > 0 || droop > 0) {
          const sx = root.x + ax.x * len, sz = root.z + ax.z * len, sy = root.y + ax.y * len, gs = this.terrainH(sx, sz) + clr;
          if (gs - sy > gT - tipY) { tipX = sx; tipZ = sz; tipY = sy; gT = gs; }
        }
        if (tipY < gT + 0.02 * s) {
          // smooth lift: rotate the axis toward up just enough (continuous in the penetration)
          const need = gT - tipY;
          const pen = smin(-need, 0, 0.012 * s); // <= 0, smooth near zero
          if (pen < 0) {
            const dy = -pen / len;
            const k = tv().crossVectors(ax, UP);
            // a steep feather: blend in its own lateral axis, weighted by how much a rotation about it
            // lifts the tip (latc x ax).y. The product latc * lift does not depend on latc's sign, so
            // the axis is continuous (flipping latc by the sign of the lift popped primaries of a wing
            // folded under a bird lying on its side as that sign crossed zero)
            const kl = k.length();
            if (kl < 0.35) {
              const latc = tv().crossVectors(nn, ax);
              const lift = tv().crossVectors(latc, ax).y;
              k.addScaledVector(latc, lift * (1 - kl / 0.35));
            }
            if (k.lengthSq() > 1e-8) {
              k.normalize();
              const cur = Math.asin(clamp(ax.y, -1, 1));
              const want = Math.asin(clamp(ax.y + dy, -1, 1));
              const ang = want - cur;
              ax.applyAxisAngle(k, ang); nn.applyAxisAngle(k, ang);
              // flatten the vane onto the ground when it lies there: the smaller turn about the rachis
              // that brings the vane level (either face up), faded out for a vane standing on its edge,
              // where both turns are 90 deg (the old one flipped from +72 to -72 deg there). The amount
              // grows over a fifth of the feather's length of penetration (over 2 cm, a wing lifting off
              // the ground at impact speed unrolled an eagle's secondaries 50 deg in 13 ms: 88 rad/s*)
              const lie = clamp(-pen / (0.2 * len), 0, 1);
              const fade = smooth(0.05, 0.3, Math.abs(nn.y));
              if (lie > 0 && fade > 0) {
                const side2 = tv().crossVectors(nn, ax);
                const tilt = Math.atan(side2.y / nn.y) * lie * 0.8 * fade;
                nn.applyAxisAngle(ax, -tilt);
              }
            }
          }
        }
        // the vane edges, when the feather is near the ground at all
        if (wide > 0 && Math.min(root.y, root.y + ax.y * len) - 1.2 * wide - droop - curve < Math.max(gT, this.terrainH(root.x, root.z) + clr) + 0.012 * s) this.vaneLift(root, ax, nn, len, f, side, clr);
      }
      // root above the ground too
      const gR = this.terrainH(root.x, root.z) + clr;
      if (root.y < gR) root.y = gR;
    }
    this.setBoneC(name, root, ax, nn);
  }

  // ----------------------------------------------------------------- tail
  poseTail(dt, air) {
    const cfg = this.cfg, T = cfg.tail, P = this.P, s = cfg.s, g = this.gait;
    const vn = this.speed / cfg.sq;
    let pitchT = P.tailPitch, yawT = P.tailYaw, fanT = T.fanRest + P.tailFan, twistT = 0;
    if (!air) {
      const mv = smooth(0.03, 0.3, vn) * P.gaitW;
      const ph = TAU * (this.phase - g.off[0]);
      pitchT += T.walkBob * DEG * g.tail * mv * Math.sin(2 * ph - 0.6) * (1 - g.hopW) + g.hopW * mv * 12 * DEG * Math.sin(ph + 0.8);
      yawT += T.sway * DEG * mv * Math.sin(ph - 0.5) * (1 - g.hopW);
      yawT += clamp(-this.yawRate * 0.15, -0.3, 0.3);
      // counter-balance while hopping fast / braking
      pitchT += clamp(-this.accel.dot(this.F) * 0.03, -0.25, 0.25);
    } else {
      // flight: closed at cruise, fanned when slow / braking / climbing, depressed in the flare,
      // twisted and yawed into turns
      const fl = cfg.flight;
      const slow = clamp(1 - (this.speed - fl.minSpeed) / Math.max(1, fl.cruise - fl.minSpeed), 0, 1);
      fanT = Math.max(fanT, 0.1 + 0.6 * slow + 0.3 * smooth(0.6, 1, this.fl.power) + (T.soarFan || 0) * this.fl.glide);
      const flare = this.flare;
      fanT = lerp(fanT, 1, flare);
      pitchT += -0.1 * slow - 0.12 * flare + 0.05 * Math.sin(TAU * this.fl.psi) * (1 - this.fl.glide) * this.fl.amp;
      twistT = clamp(this.yawRate * 0.25, -0.5, 0.5);
      yawT += clamp(-this.yawRate * 0.12, -0.25, 0.25);
      // in flight the tail continues the (level) body axis (tail.flight < 1: long display tails, e.g.
      // a rooster's sickles, stay partly raised)
      pitchT -= cfg.tailRel * (T.flight ?? 1) * cfg.tailFlightK;
    }
    // flight.shape.fan: the tail fanned at least this much in flight
    if (this.shapeW > 0) fanT = Math.max(fanT, cfg.shape.fan * this.shapeW);
    const S = this.tailS;
    const om = air ? 10 : 16;
    const tp = S.pitch.step(pitchT, om, dt), ty = S.yaw.step(yawT, om, dt), tf = clamp(S.fan.step(fanT, 12, dt), 0, 1.1), tt = S.twist.step(twistT, 8, dt);
    // pygostyle frame: bind direction in the body, pitched / yawed about the tail base
    const base = this.B(cfg.tailLocal, tv());
    const d = this.Bv(cfg.tailDir0, tv());
    const lat = this.Bv(tv(1, 0, 0), tv());
    d.applyAxisAngle(lat, tp);
    const up = tv().crossVectors(d, lat).normalize();
    if (up.dot(this.Bv(tv(0, 1, 0), tv())) < 0) up.negate();
    d.applyAxisAngle(up, ty);
    lat.applyAxisAngle(up, ty);
    // never curl under the body: keep the tail pointing backward (at most ~70 deg below horizontal)
    const back = tv().copy(this.F).negate();
    const cur = Math.atan2(-d.y, d.dot(back));
    if (cur > 55 * DEG) {
      const want = 55 * DEG + 15 * DEG * Math.tanh((cur - 55 * DEG) / (15 * DEG));
      // rotate about the lateral axis (down -> back), well defined even for a vertical tail
      d.applyAxisAngle(lat, cur - want); up.applyAxisAngle(lat, cur - want);
    }
    // twist (roll about the tail axis)
    lat.applyAxisAngle(d, tt); up.applyAxisAngle(d, tt);
    // keep the tail tip (feathers) off the ground: raise the pitch just enough
    const maxLen = cfg.rec.length ? cfg.rec[0].len : 0;
    const tipP = tv().copy(base).addScaledVector(d, cfg.tailLen + maxLen);
    const gT = this.terrainH(tipP.x, tipP.z) + 0.006 * s;
    const need = gT - tipP.y;
    const kr = 0.01 * s;
    if (need > -kr) {
      // smooth ramp: 0 below -kr, need above +kr
      const lift = need >= kr ? need : (need + kr) * (need + kr) / (4 * kr);
      const ang = Math.asin(clamp(lift / (cfg.tailLen + maxLen), 0, 1));
      d.applyAxisAngle(lat, ang); up.applyAxisAngle(lat, ang);
    }
    this.setBoneC(this.ix.tail, base, d, lat);
    if (!this.fullFrame) { for (let sI = 0; sI < 2; sI++) this.follow(this.ix.tail, this.ix.rec[sI]); return; }
    // rectrices
    const tipJ = tv().copy(base).addScaledVector(d, cfg.tailLen);
    const fw = this._fw, ff = this.ff;
    fw.P0.x = tipJ.x; fw.P0.y = tipJ.y; fw.P0.z = tipJ.z;
    const sk = this.lod === 2 && (this.frame & 1) === 1;
    for (let sI = 0; sI < 2; sI++) {
      const side = sI === 0 ? 1 : -1, SS = LEGS[sI];
      for (const f of cfg.rec) {
        const a = f.fold + (f.fan - f.fold) * tf;
        rectrixFrame(ff, fw.P0, d, up, lat, side, f, a);
        this.featherBone(this.ix.rec[sI][f.i], ff, f.len, sk, f.arc, side, f);
      }
      if (this.lod === 2) this.store(this.ix.tail, this.ix.rec[sI]);
    }
  }

  // ----------------------------------------------------------------- neck & head
  poseHead(dt, air) {
    const cfg = this.cfg, P = this.P, s = cfg.s, g = this.gait, inp = this.input;
    const qC = this.qChest;
    const base = this.B(cfg.neckBaseLocal, tv());
    // ---- head position target: carried by the chest (rest pose), extended in flight
    const occRest = tv().copy(cfg.occLocal).sub(cfg.neckBaseLocal).applyQuaternion(qC).add(base);
    const fwd = this.F;
    const ext = air ? 1 : P.neckExtend;
    // level the head carriage when the body tilts (the neck compensates body pitch)
    const bodyPitch = this.pitchS.x;
    const target = tv().copy(occRest);
    const lvl = tv().copy(cfg.occLocal).sub(cfg.neckBaseLocal).applyQuaternion(this.qH).add(base);
    target.lerp(lvl, 0.5 * clamp(-bodyPitch, 0, 1.2) / 1.2);
    if (air) {
      // flight: head forward of the chest, in line with the body
      // (the neck keeps close to its resting shape on the chest - pitched forward with the body -
      // pushed a little further forward, the head levelled by the atlas joint)
      target.copy(occRest).addScaledVector(fwd, cfg.neckLen * 0.04).addScaledVector(UP, -this.vy * 0.002);
    }
    // flight.shape: the head carried forward along the (levelled) body axis and lowered on an extended
    // neck, eased with the flight weight
    if (this.shapeW > 0) {
      const sh = cfg.shape, w = this.shapeW * cfg.neckArc;
      target.addScaledVector(tv().copy(sh.ax).applyQuaternion(qC), sh.reach * w).addScaledVector(tv().copy(sh.vent).applyQuaternion(qC), sh.drop * w);
    }
    target.addScaledVector(fwd, (P.headFwd + P.neckReach) * s).addScaledVector(UP, P.headUp * s).addScaledVector(this.Lf, P.headSide * s);
    // ---- head bob (walking): hold still in space, then thrust forward once per step
    const moving = this.mode === 'ground' && this.speed > 0.03 * cfg.sq && !air;
    const bobW = cfg.head.bob * g.headBob * smooth(0.03, 0.2, this.speed / cfg.sq) * P.gaitW * (moving ? 1 : 0) * (1 - P.headW);
    let bobOff = 0;
    if (bobW > 1e-3) {
      const stepP = wrap01(2 * (this.phase - g.off[0]) - 0.15);
      const hold = cfg.head.bobHold ?? 0.5;
      const stepLen = this.speed / Math.max(2 * g.f, 0.5);
      const q = clamp((stepP - hold) / (1 - hold), 0, 1);
      bobOff = stepLen * (smoother(q) - stepP + hold * 0.5) * bobW * 0.75;
    }
    target.addScaledVector(fwd, bobOff);
    // the neck turns with the gaze: part of the head's yaw / pitch swings the head position about the
    // neck base, so the rotation is spread along the neck instead of all at the skull
    {
      const gy = this.gazeS.yaw.x * NECK_GAZE_YAW, gp = this.gazeS.pitch.x * NECK_GAZE_PITCH;
      if (Math.abs(gy) + Math.abs(gp) > 1e-4) {
        const off = tv().subVectors(target, base);
        if (gp) off.applyAxisAngle(this.Lf, gp);
        if (gy) off.applyAxisAngle(UP, gy);
        target.copy(base).add(off);
      }
    }
    // posture target (eat, drink, preen, sleep...)
    // (blended about the neck base: direction and distance separately, so the head swings on an arc
    // instead of passing through the neck)
    if (P.headW > 0.001) {
      const a = tv().subVectors(target, base), b = tv().subVectors(P.headPos, base);
      const la = a.length(), lb = b.length();
      if (la > 1e-6 && lb > 1e-6 && P.headW < 0.999) {
        a.multiplyScalar(1 / la); b.multiplyScalar(1 / lb);
        const q = tq().setFromUnitVectors(a, b);
        a.applyQuaternion(tq().identity().slerp(q, P.headW));
        target.copy(base).addScaledVector(a, lerp(la, lb, P.headW));
      } else target.lerp(P.headPos, P.headW);
    }
    // ---- smoothing (not for the bob component, which must be exact)
    const hs = this.headS;
    if (!hs.init) { hs.x.reset(target.x); hs.y.reset(target.y); hs.z.reset(target.z); hs.init = true; }
    const om = (air ? 14 : 22) * P.headOmega;
    // filter relative to the body so locomotion does not lag
    const rx = hs.x.step(target.x - this.body.x, om, dt) + this.body.x;
    const ry = hs.y.step(target.y - this.body.y, om, dt) + this.body.y;
    const rz = hs.z.step(target.z - this.body.z, om, dt) + this.body.z;
    const occT = tv(rx, ry, rz);
    // ---- head orientation: gaze (saccades toward the look target), cocking, posture overrides
    const gz = this.gaze, lk = inp.look || P.look;
    let yawT = 0, pitchT = 0, rollT = 0;
    if (lk && P.lookW > 0.01) {
      const to = tv().subVectors(lk, occT);
      const want = Math.atan2(to.x, to.z);
      const hd = cfg.head;
      // a target (almost) straight below or at the head gives no stable direction: fade the look out
      // (and one behind, past the head's yaw range, would flip sides at +-180 deg)
      const ad = angDiff(this.heading, want);
      const lw = P.lookW * smooth(0.25, 0.6, Math.hypot(to.x, to.z) / Math.max(1e-4, cfg.neckLen)) * (1 - smooth(hd.yaw, hd.yaw + 0.7, Math.abs(ad)));
      yawT = clamp(ad, -hd.yaw, hd.yaw) * lw;
      pitchT = clamp(-Math.atan2(to.y, Math.hypot(to.x, to.z)), -hd.pitchUp, hd.pitchDown) * lw;
      rollT = P.cock * cfg.head.cock * P.lookW;
      this.lookTarget.copy(lk); this.state.lookTarget = this.lookTarget;
    } else this.state.lookTarget = null;
    // the head leads a turn: it turns toward the wanted heading at once (a saccade, with part of the
    // neck) and the body comes round under it (it used to trail the body's yaw rate, swung round last)
    const lead = inp.follow ? 0 : angDiff(this.heading, this.wantHeading ?? this.heading);
    yawT = clamp(yawT + clamp(lead * (air ? 0.4 : 0.75), -1.1, 1.1) * (1 - P.headW), -cfg.head.yaw, cfg.head.yaw) + clamp(this.yawRate * 0.06, -0.2, 0.2) + P.headYaw;
    // in flight the head follows part of the body's pitch away from level flight (flare, climb)
    pitchT += P.headPitch - (air ? (bodyPitch + cfg.tilt) * 0.5 : 0);
    rollT += P.headRoll;
    if (air) rollT += this.bankS.x * 0.2; // the head stays nearly level in banked turns (gaze stabilised)
    // saccades: the gaze jumps (fast) when the target moved far enough, and holds otherwise
    gz.hold -= dt;
    const sacc = cfg.head.saccade * (1 - P.headW * 0.7);
    const err = Math.abs(yawT - gz.tyaw) + Math.abs(pitchT - gz.tpitch) + Math.abs(rollT - gz.troll);
    if (sacc < 0.01 || err > 0.12 || gz.hold <= 0) { gz.tyaw = yawT; gz.tpitch = pitchT; gz.troll = rollT; gz.hold = 0.25 + this.rand() * 0.4; }
    const yT2 = lerp(yawT, gz.tyaw, sacc), pT2 = lerp(pitchT, gz.tpitch, sacc), rT2 = lerp(rollT, gz.troll, sacc);
    const gomg = lerp(9, 26, sacc) * P.headOmega;
    const yaw = this.gazeS.yaw.step(yT2, gomg, dt), hp = this.gazeS.pitch.step(pT2, gomg, dt), hr = this.gazeS.roll.step(rT2, gomg, dt);
    // head frame: heading + yaw, pitch (+ = bill down), roll; blended with the chest when limp
    const qHead = tq().setFromAxisAngle(UP, this.heading + yaw).multiply(tqa(X1, hp)).multiply(tqa(Z1, hr));
    if (P.headLimp > 0) qHead.slerp(tqc(qC).multiply(tqa(X1, 0.3)), P.headLimp);
    // ---- neck: Bezier S-curve with the neck's length from the chest to the head
    let occ = this.solveNeck(base, occT, qHead, qC);
    // the skull never enters the ground: raise the head target and solve again
    const rH = cfg.headR;
    // (the highest terrain under the skull's footprint: on a slope the downhill side of the head)
    let gO = this.terrainH(occ.x, occ.z);
    for (let k = 0; k < 4; k++) gO = Math.max(gO, this.terrainH(occ.x + (k === 0 ? rH : k === 1 ? -rH : 0), occ.z + (k === 2 ? rH : k === 3 ? -rH : 0)));
    gO += rH;
    if (occ.y < gO) { occT.y += gO - occ.y; occ = this.solveNeck(base, occT, qHead, qC); }
    // nor does the rest of the head's skin: swing the head up about the occiput just enough. The points
    // are the head's skin support (measured on the mesh, see headSupport: bill, mandible, wattles, comb,
    // throat, crown) or, without it, the bill tip, mouth, chin and both jaw corners. Each point is
    // lifted in the vertical plane through it (the most direct lift, whatever the head's roll), with a
    // soft onset, one after the other (each rotation is continuous, so their product is): the old pitch
    // about the head's own lateral axis had two roots and jumped between them when that axis stood near
    // vertical (a dead bird's head on its side)
    const hsup = this._headSup, rr = hsup ? hsup.rMax * 1.15 : 0;
    // (the head high above the ground - most frames - is told by the skull footprint's terrain already
    // sampled, with room for a slope over the head's size; only near it is the terrain sampled wider)
    const nearHead = !hsup || (occ.y - rr < gO - rH + 0.5 * rr + 0.01 * s &&
      occ.y - rr < Math.max(gO - rH, this.terrainH(occ.x + rr, occ.z), this.terrainH(occ.x - rr, occ.z), this.terrainH(occ.x, occ.z + rr), this.terrainH(occ.x, occ.z - rr)) + 0.01 * s);
    if (nearHead) {
      const kr = 0.003 * s, clr = hsup ? 0.001 * s : 0.0015 * s, slack = kr + 0.004 * s + 0.12 * rr;
      const n0 = this.terrainN(occ.x, occ.z, tv()), gx = n0.x / n0.y, gz = n0.z / n0.y, h0 = this.terrainH(occ.x, occ.z);
      const v = tv(), o3 = this._hsOut || (this._hsOut = new Float64Array(3));
      const ih = this.ix.head, ij = cfg.hasJaw ? this.ix.jaw : -1;
      const qJ = hsup && ij >= 0 ? tq() : null, hinge = qJ ? tv() : null;
      // (the other bones the head's skin blends with - the neck, as solved this frame - then the head
      // and the mandible as they are posed now)
      if (hsup) for (const i of hsup.bones) if (i !== ih && i !== ij) this._supBone(i, this.sk.bones[i].matrixWorld);
      const setHead = () => {
        this._supBoneQ(ih, tqc(qHead).multiply(this.bindQ[ih]), occ);
        if (qJ) {
          hinge.copy(this.J.jawHinge).sub(this.J.occiput).applyQuaternion(qHead).add(occ);
          qJ.copy(qHead).multiply(tqa(X1, this.jaw.x)).multiply(this.bindQ[ij]);
          this._supBoneQ(ij, qJ, hinge);
        }
      };
      const nP = hsup ? hsup.n : 5;
      for (let pass = 0; pass < 2; pass++) {
        if (hsup) setHead();
        for (let k = 0; k < nP; k++) {
          let wH = 1;
          if (hsup) {
            this._supSkin(k, o3, hsup);
            v.set(o3[0] - occ.x, o3[1] - occ.y, o3[2] - occ.z);
            // (terrain tangent plane prefilter; the exact test for the points near it)
            if (h0 - gx * v.x - gz * v.z + clr - occ.y - v.y <= -slack) continue;
            // (a vertex the neck shares moves with the head by its head weight only)
            wH = Math.max(0.3, hsup.wH[k]);
          } else {
            v.copy(k === 0 ? cfg.billLocal : k === 1 ? cfg.mouthLocal : cfg.chinLocal);
            if (k >= 3) v.x += (k === 3 ? 1 : -1) * cfg.headR * 0.8;
            v.applyQuaternion(qHead);
          }
          const pen = this.terrainH(occ.x + v.x, occ.z + v.z) + clr - occ.y - v.y;
          if (pen <= -kr) continue;
          const lift = (pen >= kr ? pen : (pen + kr) * (pen + kr) / (4 * kr)) / wH;
          const r = v.length(), h = Math.hypot(v.x, v.z);
          if (r < 1e-6) continue;
          const th = Math.asin(clamp((v.y + lift) / r, -1, 1)) - Math.asin(clamp(v.y / r, -1, 1));
          if (th <= 1e-7) continue;
          // axis: horizontal, across the point's direction; a point (almost) straight below the occiput
          // falls back on the head's lateral axis (continuous: the blend weight grows as h vanishes)
          const ax = tv(-v.z, 0, v.x);
          const lw = Math.max(0, 0.25 * r - h);
          if (lw > 0) { const hl = tv(1, 0, 0).applyQuaternion(qHead); hl.y = 0; ax.addScaledVector(hl, -lw * 4); } // (nose up: about the head's right)
          if (ax.lengthSq() < 1e-12) continue;
          ax.normalize();
          qHead.premultiply(tqa(ax, Math.min(th, 1.2)));
          if (hsup) setHead();
        }
      }
    }
    this.setBoneQ('head', occ, qHead);
    this.headPose.position.copy(occ);
    this.headPose.quaternion.copy(qHead);
    // jaw (lower mandible): peck, caw, pant
    const ja = this.jaw.step(P.jaw + (cfg.jawRest || 0) + (air ? 0.02 * this.fl.power : 0), 30, dt);
    if (cfg.hasJaw) {
      const hinge = tv().copy(this.J.jawHinge).sub(this.J.occiput).applyQuaternion(qHead).add(occ);
      this.setBoneQ('jaw', hinge, tqc(qHead).multiply(tqa(X1, ja)));
    }
  }

  // neck chain from `base` to (near) `occT`; returns the actual occiput position (temp)
  solveNeck(base, occT, qHead, qC) {
    const cfg = this.cfg, N = cfg.neckN, nk = this._neck;
    const Ltot = cfg.neckArc;
    // clamp the target distance softly to what the neck can reach
    const dvec = tv().subVectors(occT, base);
    let dist = dvec.length();
    const maxD = Math.max(cfg.neckChord0 * 1.08, Ltot * 0.94), minD = Ltot * 0.5;
    if (dist > maxD * 0.92) { const soft = maxD * 0.92; dist = soft + (maxD - soft) * (1 - Math.exp(-(dist - soft) / (maxD - soft))); }
    dist = Math.max(dist, minD);
    dvec.normalize();
    const end = tv().copy(base).addScaledVector(dvec, dist);
    const t0 = tv().copy(cfg.neckT0).applyQuaternion(qC).normalize();
    const t1 = tv().copy(cfg.neckT1).applyQuaternion(qHead).normalize();
    // a head tilted far back / down must not tie the neck in a loop: keep both tangents within
    // ~80 deg of the chord
    for (const t of [t0, t1]) {
      const c = t.dot(dvec);
      if (c < 0.2) t.addScaledVector(dvec, 0.2 - c).normalize();
    }
    // the neck telescopes: a short chord is taken up partly by folding (S-curve) and partly by the
    // (feathered) neck shortening, so the segments never kink against each other
    // (at the bind chord the arc is the bind arc: the rest pose reproduces the bind neck)
    const Ld = Ltot * clamp(0.62 + 0.38 * dist / cfg.neckChord0, 0.74, 1);
    // find tangent length k so the curve's arc length equals Ld (bisection)
    const P = nk.P, pts = nk.pts, S = nk.s, M = pts.length - 1;
    const arc = (kk) => {
      P[0].copy(base); P[1].copy(base).addScaledVector(t0, kk); P[2].copy(end).addScaledVector(t1, -kk); P[3].copy(end);
      let L = 0;
      for (let i = 0; i <= M; i++) {
        const u = i / M, a = 1 - u;
        const b0 = a * a * a, b1 = 3 * a * a * u, b2 = 3 * a * u * u, b3 = u * u * u;
        pts[i].set(
          b0 * P[0].x + b1 * P[1].x + b2 * P[2].x + b3 * P[3].x,
          b0 * P[0].y + b1 * P[1].y + b2 * P[2].y + b3 * P[3].y,
          b0 * P[0].z + b1 * P[1].z + b2 * P[2].z + b3 * P[3].z);
        if (i) L += pts[i].distanceTo(pts[i - 1]);
        S[i] = L;
      }
      return L;
    };
    // arc length grows monotonically with k: bisection (a continuous function of the targets)
    // (a short chord - the head drawn in close to the neck base: preening the breast, tearing food under
    // the feet, sleeping - is taken up by the neck telescoping, not by a loop: the tangents are capped
    // at 0.6 of the chord (at least the bind neck's own), where longer ones folded the curve into a cusp
    // - an eagle's neck bent 121 deg at one joint, its segment squashed to 37 %)
    let lo = 0, hi = Math.min(Ltot * 1.6, Math.max(0.6, 1.05 * cfg.neckK0) * dist);
    if (arc(hi) <= Ld) lo = hi;
    else {
      const iters = this.lod === 2 ? 6 : 9;
      for (let it = 0; it < iters; it++) {
        const mid = 0.5 * (lo + hi);
        if (arc(mid) > Ld) hi = mid; else lo = mid;
      }
    }
    arc(0.5 * (lo + hi));
    // joints at equal fractions of the arc (scaled to the segment lengths)
    const Jn = nk.J;
    Jn[0].copy(base);
    const Ltot2 = S[M];
    let acc = 0, j = 1;
    for (let i = 0; i < N; i++) {
      acc = (Ltot2 * (i + 1)) / N;
      while (j < M && S[j] < acc) j++;
      const f = (acc - S[j - 1]) / Math.max(1e-9, S[j] - S[j - 1]);
      Jn[i + 1].copy(pts[j - 1]).lerp(pts[j], clamp(f, 0, 1));
    }
    // bones with twist distributed from the chest to the head
    // (parallel transport of the chest's lateral axis along the chain, then the remaining twist to
    // the head spread evenly: no degenerate or flipping frames whatever the head does)
    const dirs = nk.dirs || (nk.dirs = Array.from({ length: N }, () => new THREE.Vector3()));
    const lats = nk.lats || (nk.lats = Array.from({ length: N }, () => new THREE.Vector3()));
    const scl = nk.scl || (nk.scl = new Float64Array(N));
    let dp = tv().copy(cfg.neckSeg0).applyQuaternion(qC).normalize();
    const lp = tv(1, 0, 0).applyQuaternion(qC);
    const qr = tq();
    for (let i = 0; i < N; i++) {
      const d = dirs[i].subVectors(Jn[i + 1], Jn[i]);
      const len = d.length();
      if (len > 1e-9) d.multiplyScalar(1 / len); else d.copy(dp);
      scl[i] = len / cfg.neckL[i];
      qr.setFromUnitVectors(dp, d);
      lp.applyQuaternion(qr);
      lp.addScaledVector(d, -lp.dot(d)).normalize();
      lats[i].copy(lp);
      dp = d;
    }
    const dl = dirs[N - 1];
    const hl = tv(1, 0, 0).applyQuaternion(qHead);
    hl.addScaledVector(dl, -hl.dot(dl));
    let phi = 0;
    if (hl.lengthSq() > 1e-8) { hl.normalize(); phi = Math.atan2(tv().crossVectors(lats[N - 1], hl).dot(dl), clamp(lats[N - 1].dot(hl), -1, 1)); }
    for (let i = 0; i < N; i++) {
      const lat = lats[i].applyAxisAngle(dirs[i], phi * (i + 1) / (N + 1));
      const sc = scl[i], th = Math.pow(sc, -0.35) * (this.shapeW > 0 ? 1 - cfg.shape.neck * this.shapeW : 1);
      this.setBoneC(this.ix.neck[i], Jn[i], dirs[i], lat, tv(th, sc, th));
    }
    return Jn[N];
  }

  // ----------------------------------------------------------------- state
  publish() {
    const st = this.state, P = this.P;
    st.heading = this.heading;
    st.speed = this.speed;
    st.mode = this.mode;
    const air = this.mode === 'air' || this.mode === 'landing' || (this.mode === 'takeoff' && this.to && this.to.air);
    st.grounded = !air;
    st.gait = air ? (this.fl.glide > 0.6 ? 'glide' : 'fly') : st.stats.gait;
    st.altitude = air ? Math.max(0, this.altitude()) : 0;
    st.eyelid = P.eyelid;
    st.action = this.actionsLayer.current();
    st.posture = this.actionsLayer.posture;
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i], o = st.legs[i];
      o.stance = this.mode === 'ground' && leg.state === 'stance' && !!leg.planted && P.legGait > 0.5 && P.sit < 0.05 && this.airLeg.x < 0.01 && P.scratchW[i] < 0.02;
      o.contact.copy(leg.contact);
    }
  }
}
