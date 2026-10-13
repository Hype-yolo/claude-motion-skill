// Pig behaviour layer for the quadruped engine (species.motion.hooks, see core/motion/actions.js):
//
//   update(P, dt, layer)  every frame over the action layer: the corkscrew tail (curled and wagging
//                         when active or feeding, uncurled and hanging when resting, dead or afraid),
//                         the waddle (the heavy trunk rolls from side to side at the walk and trot,
//                         the head nods), piglets' springy bounce, grunting (jaw pulses, a vocalize
//                         event), rooting while eating (the disc pushed into the soil in forward-up
//                         nudges, the jaw working, tail wagging), idle variants (sniffing with the head
//                         up, grunts, piglets' frolics)
//   pose(engine, dt)      after the engine's solve: the rostral disc wiggles and twitches (sniffing)
//   actions               lie (kneels, drops the hindquarters, then flops onto its side), sleep
//                         (lateral, eyes shut), wallow (rocking on the side), attack (sow: a shoulder
//                         shove with a sideways bite; boar: head low, then an upward tusk slash),
//                         hit (a squeal, tail uncurls), grunt, sniff, root (looping eat), frolic
//                         (piglet: two stiff-legged bounces in place with a head toss)
//
// Distances are pig metres at the reference size (x cfg.s); posture offsets the engine multiplies by
// cfg.k (fwd, side, headRaise, neckReach) are divided by cfg.unit.
import * as THREE from 'three';
import { clamp, lerp, smooth, TAU, tv, tqa } from '../../core/motion/common.js';
import { mx, ONESHOTS, POSTURES } from '../../core/motion/actions.js';
import { earSpine, earLeaf } from './ears.js';
import { HZ, HY, pigJoints } from './rig.js';
import { composeWarps } from '../../core/build/warp.js';

const _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
// extra height of the occiput over the ground when the head lies on its side (m at the reference
// size): the engine's value fits a slim skull, a pig's jowls are ~5 cm wider
const HEAD_REST = 0.085;
// lying on the side (lie, sleep, wallow, death): the forelegs only partly laid out on the ground and not
// far forward (full, the upper foreleg was pulled down across the chest and its armpit skin folded over on
// itself: a maroon patch, red in the holes view)
const PIG_FRONT_SPREAD = 0.15, PIG_FRONT_SIDE = 0.3;
// lying on the side: the spine's lateral bend (a little toward the up side; see flop)
const PIG_LIE_BEND = 0.08;

function B(e) {
  if (!e._pig) {
    e._pig = {
      curl: 1, fear: 0, wagT: 3 + e.rand() * 5, wagAge: 9, wagAmp: 0,
      gruntT: 2 + e.rand() * 5, grunt: null,
      sniff: 0, sniffPh: 0, twitchPh: 0,
      idleT: 6 + e.rand() * 8,
      rootPh: 0, wag: 0, wagPh: 0, tail: null,
    };
  }
  return e._pig;
}
const busy = (L) => L.oneshots.some((a) => !a.stopping && a.name !== 'grunt');
const find = (L, n) => L.oneshots.find((a) => a.name === n && a.w > 0);
// turning on the spot (0 .. 1): a pivot keeps the core's idle layer on (it looks at the speed only), and
// its look-around target and the sniff variant turned the head 6-12 deg away from the turn
const turning = (e) => {
  const err = Math.abs(Math.atan2(Math.sin((e.wantHeading ?? e.heading) - e.heading), Math.cos((e.wantHeading ?? e.heading) - e.heading)));
  return Math.max(smooth(0.1, 0.3, Math.abs(e.yawRate || 0)), smooth(0.15, 0.4, err));
};

// ------------------------------------------------------------------------------------------------
function update(P, dt, L) {
  const e = L.engine, cfg = e.cfg, b = B(e), u = 1 / cfg.unit, s = cfg.s;
  const vn = e.speed / cfg.sq, g = e.gait;
  const piglet = e.params.age === 'juvenile';
  const side = e.params.tailSide ?? 1;
  const dead = L.postures.some((p) => p.name === 'death' && p.w > 0);
  const resting = L.postures.find((p) => (p.name === 'lie' || p.name === 'sleep' || p.name === 'wallow') && p.target > 0);
  const eat = find(L, 'eat') || find(L, 'root') || find(L, 'drink');

  // ---- tail: curled when active, uncurled (hanging) when resting, dead or afraid
  b.fear = Math.max(0, b.fear - dt);
  let want = 1;
  if (resting) want = 0;
  if (b.fear > 0) want = 0;
  if (dead) want = 0.1;
  if (piglet && !dead && b.fear <= 0) want = Math.max(want, 0.7);
  b.curl += (want - b.curl) * (1 - Math.exp(-dt * (want > b.curl ? 1.5 : 3)));
  const c = b.curl;
  void side;
  // wagging: bursts when feeding, excited (moving off), and now and then standing
  b.wagT -= dt;
  if (b.wagT <= 0) {
    b.wagT = (eat ? 1.5 : 4) + e.rand() * (eat ? 3 : 8);
    if (!resting && !dead) { b.wagAge = 0; b.wagAmp = (eat ? 0.8 : 0.5) + 0.3 * e.rand(); }
  }
  b.wagAge += dt;
  const wa = Math.sin(Math.PI * clamp(b.wagAge / 2.4, 0, 1)) * b.wagAmp;
  b.wag = wa * c; // (the curled tail wags in pose(); the hanging one through the engine)
  b.wagPh += dt * TAU * 3.2;
  if (wa > 0.001) P.tailWag = Math.max(P.tailWag, wa * (1 - c));

  // ---- waddle: the heavy trunk rolls over the stance legs, the head nods at the walk
  const walkW = smooth(0.1, 0.5, vn) * (1 - smooth(3.0, 4.0, vn)) * P.gaitW;
  if (walkW > 0.001 && g) {
    const trotK = smooth(1.3, 1.9, vn);
    const ph = TAU * (e.phase - (g.off ? g.off[2] : 0));
    const amp = lerp(0.045, 0.03, trotK) * (piglet ? 0.7 : 1);
    P.roll += amp * Math.sin(ph) * walkW;
    P.side += 0.006 * u * Math.sin(ph) * walkW;
    const nod = 0.5 + 0.5 * Math.cos(2 * ph);
    P.headRaise -= 0.018 * u * walkW * nod * (1 - trotK);
    // piglets: a springy, bouncing trot
    if (piglet) P.lift += 0.012 * u * Math.pow(Math.sin(2 * ph), 2) * walkW * trotK;
  }
  // ---- a piglet carries its head higher than a finisher (side1, threequarter3, front2: the snout 15-20 deg below
  // level against 35 deg, the ears standing up over the poll), except while it eats, rests or lies dead
  if (piglet) {
    let busyW = dead ? 1 : eat ? eat.w : 0;
    for (const p of L.postures) busyW = Math.max(busyW, p.w);
    const k = 1 - clamp(busyW, 0, 1);
    P.headPitch -= 0.26 * k;
    P.headRaise += 0.025 * u * k;
  }

  // ---- grunting: short bursts of 1-3 grunts (jaw pulses and a flank pulse)
  const calm = !dead && !L.postures.some((p) => p.name === 'sleep' && p.w > 0.5);
  b.gruntT -= dt * (eat ? 1.6 : 1);
  if (b.gruntT <= 0 && calm && !L.oneshots.some((a) => a.name === 'grunt')) { b.gruntT = 3 + e.rand() * 9; L.play('grunt'); }

  // ---- rooting: the disc pushed into the soil in forward-up nudges, the head swinging slowly
  const root = find(L, 'eat') || find(L, 'root');
  if (root) {
    const w = root.w * root.w * (3 - 2 * root.w);
    b.rootPh += dt * 1.6;
    const c1 = b.rootPh % 1;
    const push = smooth(0.0, 0.35, c1) * (1 - smooth(0.45, 0.75, c1));
    const flick = smooth(0.4, 0.6, c1) * (1 - smooth(0.7, 0.95, c1));
    const fw = e.forward(e.heading, tv());
    P.headPos.addScaledVector(fw, 0.04 * s * push * w);
    P.headPos.y += (-0.012 * push + 0.035 * flick) * s * w;
    P.headPitch += (0.12 * push - 0.18 * flick) * w;
    P.headYaw += 0.12 * Math.sin(b.rootPh * 0.37 * TAU) * w;
    P.fwd += 0.015 * u * push * w;
    mx(P, 'jaw', 0.03 + 0.05 * flick, w);
    b.sniff = Math.max(b.sniff, w);
  }

  // ---- a pivot: the head leads the turn (the engine's steer lead) without the idle look pulling it back
  // to a point picked before the turn; a new point is picked after it
  const turnK = e.input.follow ? 0 : turning(e);
  if (turnK > 0.001 && !e.input.look && L.idle.w > 0.001 && P.look && P.look === L.idle.look) {
    P.lookW *= 1 - turnK;
    if (turnK > 0.5) { L.idle.hasLook = false; L.idle.lookT = Math.max(L.idle.lookT, 1.2); }
  }

  // ---- idle variants (not while pivoting)
  const idle = L.idle.w > 0.9 && !L.postures.length && !busy(L) && turnK < 0.05;
  if (idle) {
    b.idleT -= dt;
    if (b.idleT <= 0) {
      b.idleT = 6 + e.rand() * 10;
      if (piglet && e.rand() < 0.45) L.play('frolic');
      else L.play('sniff');
    }
  }
  // sniffing between: a quick disc twitch now and then, stronger when idle
  b.sniff = Math.max(b.sniff * Math.exp(-dt * 1.5), idle ? 0.35 : 0.15);
}

// ------------------------------------------------------------------------------------------------
// pose: the rostral disc wiggles (sniffing): small fast up-down and sideways twitches
function pose(e, dt) {
  const b = B(e), P = e.P, cfg = e.cfg;
  poseTail(e, b);
  if (e.lod >= 2) return;
  poseEars(e, b, dt);
  const sn = e.bone.snout;
  if (!sn) return;
  const awake = 1 - P.eyelid;
  b.twitchPh += dt * TAU * (2.5 + 3.5 * b.sniff);
  const a = b.sniff * awake;
  if (a < 1e-3) return;
  const tw = Math.pow(Math.max(0, Math.sin(b.twitchPh)), 2) * a;
  const lat = Math.sin(b.twitchPh * 0.43 + 1.3) * a;
  const base = tv().setFromMatrixPosition(sn.matrixWorld);
  _q.setFromRotationMatrix(sn.matrixWorld);
  const ax = tv(1, 0, 0).applyQuaternion(_q), up = tv(0, 0, 1).applyQuaternion(_q);
  const along = tv(0, 1, 0).applyQuaternion(_q);
  base.addScaledVector(along, -0.003 * tw * cfg.s);
  sn.matrixWorld.compose(base, tqa(ax, -0.12 * tw).multiply(tqa(up, 0.06 * lat)).multiply(_q), _s);
}

// the corkscrew tail: the engine has written a hanging spring chain (E); the curled tail is the rest
// helix carried rigidly by the root bone (C). Per joint, the relative rotation is slerped from the
// engine's toward the rest helix's by the curl amount, and the chain is rebuilt from the root; the
// curled tail wags about the root.
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3();
function poseTail(e, b) {
  let T = b.tail;
  if (!T) {
    const bones = [];
    for (let i = 0; ; i++) { const bn = e.bone['tail' + i]; if (!bn) break; bones.push(bn); }
    const idx = bones.map((bn) => e.sk.bones.indexOf(bn));
    const rest = idx.map((i) => new THREE.Quaternion().setFromRotationMatrix(e.sk.bind[i]));
    const rel = rest.map((q, i) => (i ? rest[i - 1].clone().invert().multiply(q) : null));
    const len = idx.map((i, k) => (k < idx.length - 1 ? new THREE.Vector3().setFromMatrixPosition(e.sk.bind[idx[k + 1]]).distanceTo(new THREE.Vector3().setFromMatrixPosition(e.sk.bind[i])) : 0));
    // rigid curl (crowd tier, fully curled): bone_i = root * inv(rest_0) * rest_i
    const inv0 = e.sk.bind[idx[0]].clone().invert();
    const R = idx.map((i) => inv0.clone().multiply(e.sk.bind[i]));
    T = b.tail = { bones, rel, len, R, q: bones.map(() => new THREE.Quaternion()), e: bones.map(() => new THREE.Quaternion()) };
  }
  const c = b.curl, n = T.bones.length;
  if (c < 1e-3 && Math.abs(b.wag) < 1e-4) return;
  if (e.lod >= 2 || (c > 0.995 && Math.abs(b.wag) < 1e-4)) {
    if (c < 0.5) return;
    const m0 = T.bones[0].matrixWorld;
    for (let i = 1; i < n; i++) T.bones[i].matrixWorld.multiplyMatrices(m0, T.R[i]);
    return;
  }
  for (let i = 0; i < n; i++) T.e[i].setFromRotationMatrix(T.bones[i].matrixWorld);
  // root: the engine's, wagged about the pelvis' up axis
  const q0 = T.q[0].copy(T.e[0]);
  if (Math.abs(b.wag) > 1e-4) {
    _up.set(0, 0, 1).applyQuaternion(T.e[0]); // (the root's dorsal axis)
    q0.premultiply(_qp.setFromAxisAngle(_up.normalize(), 0.45 * b.wag * Math.sin(b.wagPh)));
    _p.setFromMatrixPosition(T.bones[0].matrixWorld);
    T.bones[0].matrixWorld.compose(_p, q0, _s);
  }
  _p.setFromMatrixPosition(T.bones[0].matrixWorld);
  for (let i = 1; i < n; i++) {
    _qa.copy(T.e[i - 1]).invert().multiply(T.e[i]); // engine relative rotation
    _qb.copy(_qa).slerp(T.rel[i], c);
    T.q[i].copy(T.q[i - 1]).multiply(_qb);
    _d.set(0, T.len[i - 1], 0).applyQuaternion(T.q[i - 1]);
    _p.add(_d);
    T.bones[i].matrixWorld.compose(_p, T.q[i], _s);
  }
  void _qc;
}

// ears, after the engine's solve:
// - a head lying on its side (lie, sleep, wallow, death) folds the ground-side ear back and up into the jowl
//   and the neck, where it is hidden, as a lying pig's lower ear is squashed under its head (Landrace photos;
//   swung up out of the ground it stuck out along the ground as a rigid blade; laid level beside the
//   neck it still showed as one); the upper ear falls onto the head: an erect or semi-lop leaf back over the
//   neck, its hollow down, a lop leaf forward over the face and the eye (lr1-lr3). The target is a whole frame
//   (the ear's direction and its leaf's hollow side, from the bind leaf, ears.js), so the leaf lies flat rather
//   than edge-on;
// - then any pinna still reaching into the ground (rooting) is swung up about its base, just enough (a spring
//   on the correction angle keeps it smooth).
const _eb = new THREE.Vector3(), _ed = new THREE.Vector3(), _el = new THREE.Vector3(), _ep = new THREE.Vector3(), _ea = new THREE.Vector3();
const _hx = new THREE.Vector3(), _hy = new THREE.Vector3() /* back along the neck, level */, _hz = new THREE.Vector3(), _dT = new THREE.Vector3(), _nT = new THREE.Vector3();
const _hv = new THREE.Vector3(), _dC = new THREE.Vector3(), _nC = new THREE.Vector3(), _w3 = new THREE.Vector3(), _mA = new THREE.Matrix4(), _mB = new THREE.Matrix4();
const _qt = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qr = new THREE.Quaternion();
// rotation taking the frame (d, n) onto (d2, n2) (n, n2 made orthogonal to d, d2)
function frameRot(d, n, d2, n2, out) {
  _w3.copy(n).addScaledVector(d, -n.dot(d)).normalize();
  _mA.makeBasis(d, _w3, _ea.crossVectors(d, _w3));
  _w3.copy(n2).addScaledVector(d2, -n2.dot(d2)).normalize();
  _mB.makeBasis(d2, _w3, _ea.crossVectors(d2, _w3));
  return out.setFromRotationMatrix(_mB.multiply(_mA.transpose()));
}
function poseEars(e, b, dt) {
  const cfg = e.cfg;
  if (!b.ear) {
    b.ear = [0, 1].map((k) => {
      // (the leaf in the bind pose: the ear bone's direction and the hollow side at mid-length)
      // (and its first third: a tucked ear is aimed by it, since a drooping leaf's chord runs well below its root)
      // (the bind leaf as the mesh has it: the reference leaf through the individual's warps and size, as the pipeline
      // warps the mesh and the joints; the head scale fades out along a long leaf and tilts its chord several degrees)
      const S = k ? 'R' : 'L', P0 = e.params;
      const W = composeWarps([...(P0.warps || []), ...(P0.size && P0.size !== 1 ? [{ type: 'scale', k: P0.size }] : [])]) || ((p) => p);
      // (rig.js gives the left side; the rig mirrors it)
      const bl = pigJoints(P0).earBaseL, rb = S === 'L' ? bl : [-bl[0], bl[1], bl[2]], wb = W(rb);
      const off = (p) => { const q = W(p); return new THREE.Vector3(q[0] - wb[0], q[1] - wb[1], q[2] - wb[2]); };
      const dirAt = (p, v) => { const a = W(p), q = W([p[0] + 0.01 * v[0], p[1] + 0.01 * v[1], p[2] + 0.01 * v[2]]); return new THREE.Vector3(q[0] - a[0], q[1] - a[1], q[2] - a[2]).normalize(); };
      const sp = earSpine(rb, S, P0), q3 = sp.steps / 3 | 0, mid = sp.steps >> 1;
      const leaf = earLeaf(rb, S, P0);
      // (points on the leaf: the ground check; a drooping leaf's belly hangs 4-5 cm off the bone's chord)
      const pts = [];
      for (const u of [0.3, 0.55, 0.8, 1]) for (const a of [-0.85, 0, 0.85]) pts.push(off(leaf.mid(u, a).p));
      return {
        lift: 0, tuck: 0, relax: 0, len: e.J['earBase' + S].distanceTo(e.J['earTip' + S]), pts,
        d: off(sp.tip).normalize(), h: dirAt(sp.pts[mid], sp.fr[mid].h),
        d1: off(sp.pts[q3]).normalize(), h1: dirAt(sp.pts[q3 >> 1], sp.fr[q3 >> 1].h),
      };
    });
  }
  const qH = e.headPose.quaternion;
  // (the head's lateral axis and its long axis toward the disc, HZ, in the world)
  _hx.set(1, 0, 0).applyQuaternion(qH); _hz.set(HZ[0], HZ[1], HZ[2]).applyQuaternion(qH);
  // back along the neck, level (the neck lies on the ground beside it)
  _hy.set(-_hz.x, 0, -_hz.z);
  if (_hy.lengthSq() < 1e-6) _hy.set(0, 0, -1);
  _hy.normalize();
  // toward the throat, level (the head's ventral side: -HY)
  _hv.set(HY[0], HY[1], HY[2]).applyQuaternion(qH).multiplyScalar(-1); _hv.y = 0;
  if (_hv.lengthSq() < 1e-6) _hv.set(0, 0, 0); else _hv.normalize();
  const lop = e.params.ear === 'lop', relaxK = 0.85;
  const ke = 1 - Math.exp(-dt * 5);
  for (let k = 0; k < 2; k++) {
    const name = k === 0 ? 'earL' : 'earR', bone = e.bone[name], E = b.ear[k], s = k === 0 ? 1 : -1;
    if (!bone) continue;
    // (how far this ear's side of the head faces the ground: the head on its side)
    const side = s * _hx.y;
    E.tuck += (smooth(0.35, 0.75, -side) - E.tuck) * ke;
    E.relax += (relaxK * smooth(0.35, 0.75, side) - E.relax) * ke;
    _eb.setFromMatrixPosition(bone.matrixWorld);
    const w = Math.max(E.tuck, E.relax);
    if (w > 1e-3 && e.bindQ?.[name]) {
      _q.setFromRotationMatrix(bone.matrixWorld);
      // current leaf: the bind leaf carried by the bone's rotation from its bind orientation
      _qr.copy(e.bindQ[name]).invert().premultiply(_q);
      const tuck = E.tuck >= E.relax;
      _dC.copy(tuck ? E.d1 : E.d).applyQuaternion(_qr); _nC.copy(tuck ? E.h1 : E.h).applyQuaternion(_qr);
      if (tuck) {
        // folded under: back along the neck, a little up and toward the throat, into the jowl and the neck (which
        // lie on the ground over it), the hollow toward the throat: a lying neck is thickest from its back to the
        // throat, and the drooping leaf curls that way (its hollow up, it curled out of the neck's upper side)
        _dT.copy(_hy).addScaledVector(tv(0, 1, 0), 0.35).addScaledVector(_hv, 0.3).normalize();
        _nT.copy(_hv);
      } else if (lop) {
        // a lop ear keeps lying along the head and falls across it onto the cheek and the eye, its hollow on them
        // (gravity across the head's long axis)
        _w3.set(0, -1, 0).addScaledVector(_hz, _hz.y);
        _dT.copy(_dC).addScaledVector(_w3, 0.45).normalize();
        _nT.set(0, -1, 0);
      } else {
        // fallen back over the neck and draped down its side, the hollow on it
        _dT.copy(_hy).addScaledVector(tv(0, 1, 0), -0.45).normalize();
        _nT.copy(_hv).multiplyScalar(0.5).addScaledVector(tv(0, 1, 0), -1).normalize();
      }
      frameRot(_dC, _nC, _dT, _nT, _qt);
      // (the part w of that rotation, continuous in time: of q and -q the one nearer last frame's, then its
      // axis-angle scaled; a shortest-arc slerp switched sides where the rotation passed 180 deg and the ear
      // flipped through the ground in one frame)
      if (E.qs ? _qt.dot(E.qs) < 0 : _qt.w < 0) _qt.set(-_qt.x, -_qt.y, -_qt.z, -_qt.w);
      (E.qs || (E.qs = new THREE.Quaternion())).copy(_qt);
      const th = 2 * Math.acos(clamp(_qt.w, -1, 1)), sn = Math.sqrt(Math.max(0, 1 - _qt.w * _qt.w));
      if (sn > 1e-6) { _ea.set(_qt.x / sn, _qt.y / sn, _qt.z / sn); _qi.setFromAxisAngle(_ea, th * w); _q.premultiply(_qi); }
      bone.matrixWorld.compose(_eb, _q, _s);
    } else if (E.qs) E.qs = null;
    // the ground: a pinna reaching into it is swung up about its base, just enough: the swing about the horizontal
    // axis across the bone that lifts each point of the leaf above the floor (its height gain per radian is
    // (axis x offset).y), the largest of them; fast to rise (the head falls fast in a collapse: a spring lagged and
    // the leaf's belly went 29 mm into the ground), slow to let go
    const near = _eb.y - e.terrainH(_eb.x, _eb.z) < E.len * 1.2 + 0.03 * cfg.s;
    let need = 0;
    _q.setFromRotationMatrix(bone.matrixWorld);
    _ed.set(0, 1, 0).applyQuaternion(_q);
    _ea.crossVectors(_ed, tv(0, 1, 0));
    const axOk = _ea.lengthSq() > 1e-8;
    if (near && axOk && e.bindQ?.[name]) {
      _ea.normalize();
      _qr.copy(e.bindQ[name]).invert().premultiply(_q);
      for (const pt of E.pts) {
        _ep.copy(pt).applyQuaternion(_qr);
        const floor = e.terrainH(_eb.x + _ep.x, _eb.z + _ep.z) + 0.012 * cfg.s;
        const lack = floor - (_eb.y + _ep.y);
        if (lack <= 0) continue;
        const gain = _ea.z * _ep.x - _ea.x * _ep.z;
        need = Math.max(need, gain > 0.02 * E.len ? lack / gain : 1.2);
      }
      need = Math.min(1.2, need * 1.1);
    }
    E.lift = need > E.lift ? Math.min(need, E.lift + 25 * dt) : E.lift + (need - E.lift) * (1 - Math.exp(-dt * 10));
    if (E.lift < 1e-4 || !axOk) continue;
    _q.premultiply(tqa(_ea, E.lift));
    bone.matrixWorld.compose(_eb, _q, _s);
  }
}

// ------------------------------------------------------------------------------------------------
// actions

// grunt: 1-3 short jaw pulses with a flank pulse; emits vocalize { kind: 'grunt' }
const grunt = {
  kind: 'oneshot', fade: 0.08, overlay: true, // a vocalisation: it neither cuts nor is cut by a commanded one-shot (eat, root, attack...)
  start(inst, L) { const b = B(L.engine); inst.n = 1 + Math.floor(L.engine.rand() * 3); inst.dur = 0.32 * inst.n + 0.1; b.grunt = inst; inst.said = 0; },
  update(inst, dt, L) {
    const k = Math.floor(inst.t / 0.32);
    if (k >= inst.said && k < inst.n) { inst.said = k + 1; L.engine.emit('vocalize', { kind: 'grunt', position: L.engine.headPose.position.clone() }); }
    if (inst.t >= inst.dur) { B(L.engine).grunt = null; return true; }
    return false;
  },
  apply(P, w, inst) {
    const x = (inst.t % 0.32) / 0.32, on = inst.t < 0.32 * inst.n ? 1 : 0;
    const pulse = Math.sin(Math.PI * clamp(x / 0.6, 0, 1)) * on;
    P.jaw = Math.max(P.jaw, 0.07 * pulse * w);
    P.jawOmega = Math.max(P.jawOmega, 30);
    P.breathAmp += 1.2 * pulse * w;
  },
};

// sniff: head up, the disc twitching fast, a look around
const sniff = {
  kind: 'oneshot', fade: 0.35,
  start(inst, L) { inst.dur = 2.2 + L.engine.rand() * 1.5; inst.dir = L.engine.rand() < 0.5 ? -1 : 1; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst, L) {
    const u = 1 / L.engine.cfg.unit, t = inst.t;
    const k = smooth(0, 0.5, t) * (1 - smooth(inst.dur - 0.5, inst.dur, t)) * w;
    mx(P, 'headRaise', 0.06 * u, k); mx(P, 'headPitch', -0.3, k); mx(P, 'neckReach', 0.02 * u, k);
    // (no look to the side while the pig turns on the spot)
    inst.turnK = Math.max((inst.turnK ?? 0) * Math.exp(-L.engine.frameDt * 2), turning(L.engine));
    P.headYaw += 0.25 * inst.dir * Math.sin(t * 1.3) * k * (1 - inst.turnK);
    mx(P, 'lookW', 0.2, k);
    B(L.engine).sniff = Math.max(B(L.engine).sniff, k);
  },
};

// root: rooting in the ground (the built-in eat, looped; behaviour adds the nudges)
const root = {
  ...ONESHOTS.eat, kind: 'oneshot',
  start(inst, L) { inst.tune = L.tuning.eat || {}; inst.dur = inst.opts.duration ?? Infinity; inst.fade = 0.8; },
  update(inst, dt, L) { return inst.t >= inst.dur || L.engine.wantSpeed > 0.05 || !!L.engine.input.follow; },
  apply(P, w, inst, L) { ONESHOTS.eat.apply(P, w, inst, L); B(L.engine).sniff = Math.max(B(L.engine).sniff, w); },
};

// lie: kneels on the carpi, drops the hindquarters, then flops onto its side (lateral), head flat,
// awake (eyes open, ears and look alive)
const flop = (P, w, inst, L, sleep) => {
  POSTURES.sleep.apply(P, w, inst, L);
  const c = smooth(1.0, 3.0, inst.t) * w;
  // (the spine a little rounded toward the up side instead of the core's lateral curl: lying on its side, the
  // curl sagged the middle toward the ground and the back read as a saddle between shoulder and ham;
  // with the wider barrel the outline over shoulder, ribs and ham varies by 2 cm, was 6.5)
  mx(P, 'bend', -inst.side * PIG_LIE_BEND, c);
  // the broad head (jowls and cheek) rests on its side higher than the engine's slim skull
  P.headPos.y += HEAD_REST * L.engine.cfg.s * c;
  // (the chin out: the deep double chin under the jaw otherwise ploughs into the ground; while the
  // forequarters go down the head is held up until it is laid on its side)
  mx(P, 'headPitch', -0.1, c);
  if (inst.target > 0) {
    const hold = smooth(0.3, 1.0, inst.t) * (1 - smooth(1.9, 2.9, inst.t)) * w;
    P.headRaise += 0.08 / L.engine.cfg.unit * hold; P.headPitch -= 0.3 * hold;
  }
  // the short legs stretched out from the body (the lower claws otherwise rest in the ground); the
  // forelegs less (PIG_FRONT_*)
  for (let i = 0; i < 4; i++) { P.legs[i].spread = Math.max(P.legs[i].spread, (i < 2 ? PIG_FRONT_SPREAD : 0.55) * c); }
  for (let i = 0; i < 2; i++) P.legs[i].side = lerp(P.legs[i].side, PIG_FRONT_SIDE, c);
  P.lift += 0.03 / L.engine.cfg.unit * c;
  if (!sleep) {
    // awake: eyes open, breathing normal, the head a little raised off the ground now and then
    mx(P, 'eyelid', 0.1, c); mx(P, 'breathRate', 0.8, c); mx(P, 'earTwitch', 0.8, c); mx(P, 'tailIdle', 0.5, c);
    mx(P, 'headLimp', 0.1, c);
  }
};
const lie = { kind: 'posture', fadeIn: 1.6, fadeOut: 1.4, apply(P, w, inst, L) { flop(P, w, inst, L, false); } };
const sleep = { kind: 'posture', fadeIn: 1.6, fadeOut: 1.5, apply(P, w, inst, L) { flop(P, w, inst, L, true); } };

// wallow: lying on the side and rocking back and forth (rubbing the flank and back in the mud),
// the legs paddling in the air as it rolls toward its back
const wallow = {
  kind: 'posture', fadeIn: 1.6, fadeOut: 1.5,
  apply(P, w, inst, L) {
    flop(P, w, inst, L, false);
    // (the rocking starts as soon as the pig is down on its side, ~1.8 s)
    const c = smooth(1.8, 3.0, inst.t) * w;
    const r = 0.5 - 0.5 * Math.cos(TAU * 0.22 * Math.max(0, inst.t - 1.8));
    P.roll += inst.side * 0.35 * r * c;
    for (let i = 0; i < 4; i++) { P.legs[i].spread += 0.25 * r * c; P.legs[i].fold += 0.3 * Math.max(0, Math.sin(TAU * 0.44 * inst.t + i)) * r * c; }
    P.headRoll += inst.side * 0.2 * r * c;
  },
};

// attack. Sow: a shoulder shove with a sideways bite (the head swipes across, mouth open). Boar (or
// { style: 'slash' }): head low and turned, then an upward sideways swipe of the tusks.
const attack = {
  kind: 'oneshot', fade: 0.15, needsStand: true,
  start(inst, L) {
    const e = L.engine;
    inst.style = inst.opts.style || ((e.params.boar || 0) >= 0.5 ? 'slash' : 'shove');
    inst.target = inst.opts.target ? inst.opts.target.clone() : null;
    inst.dir = e.rand() < 0.5 ? -1 : 1;
    if (inst.target) {
      const lx = (inst.target.x - e.pos.x) * Math.cos(e.heading) - (inst.target.z - e.pos.z) * Math.sin(e.heading);
      inst.dir = lx > 0 ? 1 : -1;
    }
    inst.dur = inst.style === 'slash' ? 1.25 : 1.1;
    inst.hitAt = inst.style === 'slash' ? 0.62 : 0.55;
    inst.hit = false;
    B(e).fear = 0;
  },
  update(inst, dt, L) {
    if (!inst.hit && inst.t >= inst.hitAt) {
      inst.hit = true;
      const e = L.engine;
      const p = new THREE.Vector3().copy(e.cfg.mouthLocal).applyQuaternion(e.headPose.quaternion).add(e.headPose.position);
      const dir = e.forward(e.heading, new THREE.Vector3()).addScaledVector(e.left(e.heading, new THREE.Vector3()), inst.dir * 0.6).normalize();
      if (inst.style === 'slash') dir.y = 0.5;
      e.emit('attackHit', { position: p, direction: dir.normalize(), style: inst.style === 'slash' ? 'tusk' : 'bite' });
    }
    return inst.t >= inst.dur;
  },
  apply(P, w, inst, L) {
    const e = L.engine, u = 1 / e.cfg.unit, t = inst.t, d = inst.dir;
    if (inst.target) { P.look = inst.target; mx(P, 'lookW', 1, w); }
    mx(P, 'earFlat', 0.7, w * smooth(0, 0.2, t)); mx(P, 'earTwitch', 0, w);
    const wind = smooth(0, 0.4, t) * (1 - smooth(inst.hitAt - 0.05, inst.hitAt + 0.1, t));
    const strike = smooth(inst.hitAt - 0.18, inst.hitAt, t) * (1 - smooth(inst.hitAt + 0.15, inst.dur - 0.05, t));
    if (inst.style === 'slash') {
      // head low and turned away, then swung up and across: the tusk rips upward
      mx(P, 'headRaise', -0.07 * u, wind * w); mx(P, 'headPitch', 0.45, wind * w); mx(P, 'headYaw', -d * 0.3, wind * w);
      mx(P, 'dropF', 0.15, wind * w); mx(P, 'fwd', -0.03 * u, wind * w);
      mx(P, 'headRaise', 0.06 * u, strike * w); mx(P, 'headPitch', -0.45, strike * w); mx(P, 'headYaw', d * 0.35, strike * w);
      mx(P, 'headRoll', d * 0.35, strike * w); mx(P, 'fwd', 0.06 * u, strike * w); mx(P, 'jaw', 0.25, strike * w);
    } else {
      // shoulder shove: the body lunges forward and into the target, the head swipes across, bites
      mx(P, 'fwd', -0.03 * u, wind * w); mx(P, 'headYaw', -d * 0.25, wind * w); mx(P, 'jaw', 0.3, wind * w);
      mx(P, 'fwd', 0.08 * u, strike * w); mx(P, 'side', d * 0.04 * u, strike * w); mx(P, 'roll', -d * 0.08, strike * w);
      mx(P, 'headYaw', d * 0.35, strike * w); mx(P, 'neckReach', 0.03 * u, strike * w);
      mx(P, 'jaw', 0.4 * (1 - smooth(inst.hitAt - 0.03, inst.hitAt + 0.05, t)) + 0.05, strike * w); mx(P, 'jawOmega', 30, w);
    }
    mx(P, 'gaitW', 0.4, (wind + strike > 0 ? 1 : 0) * w);
  },
};

// hit: the engine's stagger with a squeal (mouth wide), then the tail stays uncurled for a while
const hit = {
  ...ONESHOTS.hit, kind: 'oneshot',
  start(inst, L) { ONESHOTS.hit.start(inst, L); B(L.engine).fear = 5; L.engine.emit('vocalize', { kind: 'squeal', position: L.engine.headPose.position.clone() }); },
  apply(P, w, inst, L) {
    ONESHOTS.hit.apply(P, w, inst, L);
    const k = smooth(0.02, 0.12, inst.t) * (1 - smooth(0.45, 0.7, inst.t)) * w;
    mx(P, 'jaw', 0.35, k); mx(P, 'jawOmega', 30, w); mx(P, 'headPitch', -0.2, k);
  },
};

// frolic (piglets): two quick stiff-legged bounces in place with a head toss and a twist of the
// body (the legs stay planted: a crouch, then the body springs up on extended legs)
const frolic = {
  kind: 'oneshot', fade: 0.1,
  start(inst, L) { inst.dur = 1.0; inst.toss = L.engine.rand() < 0.5 ? -1 : 1; },
  update(inst) { return inst.t >= inst.dur; },
  apply(P, w, inst) {
    const t = inst.t, T = 0.42;
    const ph = clamp(t / T, 0, 2.2);
    const cyc = ph < 2 ? ph % 1 : 1;
    // per bounce: crouch (0 - 0.35), spring up (0.35 - 0.6), settle (0.6 - 1)
    const crouch = smooth(0, 0.3, cyc) * (1 - smooth(0.3, 0.5, cyc));
    const up = smooth(0.32, 0.55, cyc) * (1 - smooth(0.6, 0.95, cyc));
    const env = (1 - smooth(0.85, 1.0, t / inst.dur)) * w;
    P.dropF += (0.14 * crouch - 0.08 * up) * env; P.dropH += (0.16 * crouch - 0.09 * up) * env;
    P.pitch += 0.05 * (up - crouch) * env;
    const k = Math.sin(Math.PI * clamp(t / inst.dur, 0, 1));
    P.headYaw += inst.toss * 0.35 * Math.sin(TAU * t / (2 * T)) * k * w; P.headRoll += inst.toss * 0.2 * up * env;
    P.roll -= inst.toss * 0.06 * up * env; P.headPitch -= 0.15 * up * env;
    mx(P, 'earFlat', 0.2, up * env);
  },
};

// jump: the built-in, with the forelegs tucking up more gradually after take-off (the short legs'
// elbows flipped when they folded within a few frames of leaving the ground)
const JUMP_TUCK = 0.4; // s (the built-in: 0.12)
const jump = {
  ...ONESHOTS.jump, kind: 'oneshot',
  apply(P, w, inst, L) {
    ONESHOTS.jump.apply(P, w, inst, L);
    if (inst.phase === 'air') {
      const x = smooth(0, JUMP_TUCK * L.engine.cfg.sk, inst.t - inst.tAir);
      for (let i = 0; i < 2; i++) P.legs[i].tuck = Math.min(P.legs[i].tuck, x);
    }
  },
};

// death: the engine's collapse onto the side, the broad head resting on its cheek, the tail hanging
const death = {
  ...POSTURES.death, kind: 'posture',
  apply(P, w, inst, L) {
    POSTURES.death.apply(P, w, inst, L);
    P.headPos.y += HEAD_REST * L.engine.cfg.s * smooth(0.35, 1.0, inst.t) * w;
    // the hind legs only partly in the side-lying pose (legs laid out on the ground), slightly flexed:
    // laid out full, the lower leg's foot target pressed the lower thigh's lateral bulge (the stifle)
    // 8-11 mm into bumps on a slope (death-uneven, between the torso sections the rest solver checks)
    const k = smooth(0.8, 1.6, inst.t) * w;
    for (let i = 2; i < 4; i++) P.legs[i].side = lerp(P.legs[i].side, 0.3, k);
    for (let i = 0; i < 2; i++) { P.legs[i].spread = lerp(P.legs[i].spread, PIG_FRONT_SPREAD, k); P.legs[i].side = lerp(P.legs[i].side, PIG_FRONT_SIDE, k); }
  },
};

export const behaviour = {
  update,
  pose,
  actions: { jump, lie, sleep, wallow, death, attack, hit, grunt, sniff, root, frolic },
};
