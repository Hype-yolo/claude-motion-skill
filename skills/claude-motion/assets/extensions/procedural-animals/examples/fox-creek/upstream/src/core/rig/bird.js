// Standard bird skeleton and the wing / feather geometry shared by the build (bind pose, feather
// cards) and the bird motion engine (core/motion/bird.js).
//
// Bones (names the bird engine expects; {S} = L / R):
//   axial   pelvis (synsacrum -> tailBase, root), chest (synsacrum -> neckBase), neck0..neckN-1
//           (neckBase -> neck1 -> ... -> occiput), head (occiput -> bill), jaw (jawHinge -> jawTip,
//           lower mandible), tail (tailBase -> tailTip, the pygostyle)
//   legs    femur{S} (hip -> knee, hidden in the body), tibia{S} (knee -> ankle: tibiotarsus, the
//           feathered drumstick), tarsus{S} (ankle -> mtp: tarsometatarsus), toes toe{j}a{S} (mtp ->
//           t{j}m{S}) and toe{j}b{S} (t{j}m{S} -> t{j}t{S}) for j = 1 (hallux, points back), 2 (inner),
//           3 (middle: region 'foot', the canonical foot), 4 (outer)
//   wings   humerus{S} (shoulder -> elbow), ulna{S} (elbow -> wrist), hand{S} (wrist -> handTip:
//           carpometacarpus + digits)
//   feathers pri{k}{S} (primaries, on the hand, k = 1 innermost .. n outermost), sec{k}{S}
//           (secondaries + tertials, on the ulna, k = 1 at the wrist .. n at the elbow), rec{k}{S}
//           (rectrices, on the tail, k = 1 central .. n outer); joint names <bone>r{S} (root) and
//           <bone>t{S} (tip). Feather bones carry rigid feather cards (core/build/featherCards.js).
//
// Wing model. A wing is three segments in a plane that the shoulder orients: `elev` rotates the
// plane about the body's long axis (+ raises the tip, the fold is about -85), `pitch` tilts it about
// the span (+ leading edge up), `alpha` swings the humerus inside the plane (+ backwards), `elbow`
// flexes the ulna forward, `wrist` flexes the hand backwards (both 0 = straight), `bend` lifts the
// hand out of the plane (+ up), `twist` pronates it (+ leading edge down). Folding the elbow and wrist
// Z-folds the wing against the flank exactly like a bird's (humerus back, ulna forward, hand back).
// Feather directions are in-plane angles from their segment toward the trailing edge, interpolated
// between a folded and a spread value by the segment's extension (the ligament "drawing" mechanism
// that fans the flight feathers when the wing opens).
//
// All functions work on plain {x, y, z} objects (THREE.Vector3 qualifies) and never allocate when
// given output objects, so the engine can call them every frame.

export const DEG = Math.PI / 180;

// ---------------------------------------------------------------- bones
export function birdBones({ neckSegs = 4, jaw = true, primaries = 10, secondaries = 9, rectrices = 6, extra = [] } = {}) {
  const b = [
    ['pelvis', 'synsacrum', 'tailBase', null, { region: 'torso' }],
    ['chest', 'synsacrum', 'neckBase', 'pelvis', { region: 'torso' }],
  ];
  const nj = (i) => (i === 0 ? 'neckBase' : i === neckSegs ? 'occiput' : 'neck' + i);
  for (let i = 0; i < neckSegs; i++) b.push(['neck' + i, nj(i), nj(i + 1), i ? 'neck' + (i - 1) : 'chest', { region: 'neck' }]);
  b.push(['head', 'occiput', 'bill', 'neck' + (neckSegs - 1), { region: 'head' }]);
  if (jaw) b.push(['jaw', 'jawHinge', 'jawTip', 'head', { region: 'jaw', group: 'jaw' }]);
  b.push(['tail', 'tailBase', 'tailTip', 'pelvis', { region: 'tail' }]);
  b.push(
    ['humerus{S}', 'shoulder{S}', 'elbow{S}', 'chest', { region: 'wing', group: 'wing{S}' }],
    ['ulna{S}', 'elbow{S}', 'wrist{S}', 'humerus{S}', { region: 'wing', group: 'wing{S}' }],
    ['hand{S}', 'wrist{S}', 'handTip{S}', 'ulna{S}', { region: 'wing', group: 'wing{S}' }],
    ['femur{S}', 'hip{S}', 'knee{S}', 'pelvis', { region: 'limb', group: 'leg{S}' }],
    ['tibia{S}', 'knee{S}', 'ankle{S}', 'femur{S}', { region: 'limb', group: 'leg{S}' }],
    ['tarsus{S}', 'ankle{S}', 'mtp{S}', 'tibia{S}', { region: 'limb', group: 'leg{S}' }],
  );
  for (const j of [1, 2, 3, 4]) {
    const region = j === 3 ? 'foot' : 'toe';
    b.push([`toe${j}a{S}`, 'mtp{S}', `t${j}m{S}`, 'tarsus{S}', { region, group: 'leg{S}' }]);
    b.push([`toe${j}b{S}`, `t${j}m{S}`, `t${j}t{S}`, `toe${j}a{S}`, { region, group: 'leg{S}' }]);
  }
  for (let k = 1; k <= primaries; k++) b.push([`pri${k}{S}`, `pri${k}r{S}`, `pri${k}t{S}`, 'hand{S}', { region: 'feather', group: 'wing{S}' }]);
  for (let k = 1; k <= secondaries; k++) b.push([`sec${k}{S}`, `sec${k}r{S}`, `sec${k}t{S}`, 'ulna{S}', { region: 'feather', group: 'wing{S}' }]);
  for (let k = 1; k <= rectrices; k++) b.push([`rec${k}{S}`, `rec${k}r{S}`, `rec${k}t{S}`, 'tail', { region: 'feather', group: 'tailfan' }]);
  return b.concat(extra);
}

// Limb descriptions for the harmonic skin weights (see core/build/weights.js). Legs blend from the
// hip (the femur lives inside the body, only the drumstick below the knee is limb skin); wings from
// the shoulder.
export function birdLimbs({ leg = {}, wing = {} } = {}) {
  const L = {};
  for (const S of ['L', 'R']) {
    const side = S === 'L' ? 1 : -1;
    const toes = [1, 2, 3, 4].flatMap((j) => [`toe${j}a${S}`, `toe${j}b${S}`]);
    L['leg' + S] = {
      side, S, front: false,
      bones: ['femur' + S, 'tibia' + S, 'tarsus' + S, ...toes],
      proximal: ['femur' + S], distal: ['tarsus' + S, ...toes],
      field: { a: 'hip' + S, b: 'knee' + S, top: 'femur' + S, tCore: 0.9, aCore: 0.012, aBody: -0.01, midX: 0.004, ...leg },
    };
    L['wing' + S] = {
      side, S, front: true,
      bones: ['humerus' + S, 'ulna' + S, 'hand' + S],
      proximal: ['humerus' + S], distal: ['hand' + S],
      field: { a: 'shoulder' + S, b: 'elbow' + S, top: 'humerus' + S, tCore: 0.45, aCore: 0.01, aBody: -0.012, midX: 0.01, ...wing },
    };
  }
  return L;
}

// Neck joints neck1..neckN-1 on a planar S-curve between neckBase and occiput (bind helper): a cubic
// Bezier with the given start / end tangents (unit, in the y-z plane), sampled at equal arc length.
export function neckChain(J, neckSegs, t0, t1, bulge = 0.4) {
  const A = J.neckBase, B = J.occiput;
  const d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
  const P1 = [A[0] + t0[0] * d * bulge, A[1] + t0[1] * d * bulge, A[2] + t0[2] * d * bulge];
  const P2 = [B[0] - t1[0] * d * bulge, B[1] - t1[1] * d * bulge, B[2] - t1[2] * d * bulge];
  const bez = (t) => {
    const u = 1 - t;
    return [0, 1, 2].map((k) => u * u * u * A[k] + 3 * u * u * t * P1[k] + 3 * u * t * t * P2[k] + t * t * t * B[k]);
  };
  const N = 200, pts = [], s = [0];
  for (let i = 0; i <= N; i++) pts.push(bez(i / N));
  for (let i = 1; i <= N; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  for (let j = 1; j < neckSegs; j++) {
    const target = (s[N] * j) / neckSegs;
    let i = 1;
    while (i < N && s[i] < target) i++;
    const f = (target - s[i - 1]) / (s[i] - s[i - 1] || 1);
    J['neck' + j] = [0, 1, 2].map((k) => pts[i - 1][k] + (pts[i][k] - pts[i - 1][k]) * f);
  }
  return J;
}

// ---------------------------------------------------------------- tiny vector helpers ({x,y,z})
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const set = (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; };
const cp = (o, a) => { o.x = a.x; o.y = a.y; o.z = a.z; return o; };
const nrm = (o) => { const l = Math.hypot(o.x, o.y, o.z) || 1; o.x /= l; o.y /= l; o.z /= l; return o; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
// o = a x b (o may alias a or b)
const crs = (o, a, b) => set(o, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
// o = v rotated about the unit axis k by angle a (Rodrigues; o may alias v)
export function rot(o, v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), d = (k.x * v.x + k.y * v.y + k.z * v.z) * (1 - c);
  return set(o,
    v.x * c + (k.y * v.z - k.z * v.y) * s + k.x * d,
    v.y * c + (k.z * v.x - k.x * v.z) * s + k.y * d,
    v.z * c + (k.x * v.y - k.y * v.x) * s + k.z * d);
}

// ---------------------------------------------------------------- wing kinematics
const XAX = { x: 1, y: 0, z: 0 };
const TILTED = ['xw', 'n', 'dH', 'nH', 'dU', 'nU', 'dM', 'nM'];
// Output container for wingFK (preallocate once per wing).
export function makeWingFrames() {
  return {
    xw: v3(), n: v3(), dH: v3(), nH: v3(), dU: v3(), nU: v3(), dM: v3(), nM: v3(),
    elbow: v3(), wrist: v3(), tip: v3(), k: v3(), t: v3(),
  };
}

/**
 * Wing forward kinematics in body-local coordinates (x = left, y = up, z = forward), relative to the
 * shoulder (which is at the origin of the result positions).
 * @param o     makeWingFrames() output
 * @param side  +1 left, -1 right
 * @param L     { h, u, m } segment lengths (humerus, ulna, hand)
 * @param a     { elev, pitch, alpha, elbow, wrist, bend, twist, uTwist? } radians
 */
export function wingFK(o, side, L, a) {
  const s = side, k = o.k;
  // spread frame: outward, dorsal; elevation about the body's long axis
  const ce = Math.cos(a.elev), se = Math.sin(a.elev);
  set(o.xw, s * ce, se, 0);
  set(o.n, -s * se, ce, 0);
  // pitch about the span axis (+ leading edge up)
  rot(o.n, o.n, o.xw, -s * a.pitch);
  // in-plane rotations about s * n (positive = toward the trailing edge)
  set(k, o.n.x * s, o.n.y * s, o.n.z * s);
  rot(o.dH, o.xw, k, a.alpha);
  cp(o.nH, o.n);
  rot(o.dU, o.dH, k, -a.elbow);
  cp(o.nU, o.n);
  if (a.uTwist) rot(o.nU, o.nU, o.dU, s * a.uTwist);
  rot(o.dM, o.dU, k, a.wrist);
  // out-of-plane bend of the hand (tip up), then pronation about the hand axis
  const cb = Math.cos(a.bend), sb = Math.sin(a.bend);
  const mx = o.dM.x * cb + o.nU.x * sb, my = o.dM.y * cb + o.nU.y * sb, mz = o.dM.z * cb + o.nU.z * sb;
  set(o.nM, o.nU.x * cb - o.dM.x * sb, o.nU.y * cb - o.dM.y * sb, o.nU.z * cb - o.dM.z * sb);
  set(o.dM, mx, my, mz);
  if (a.twist) rot(o.nM, o.nM, o.dM, s * a.twist);
  // optional wing-root tilt: the wing frame follows a body axis pitched `tilt` nose-up from the bind
  // frame's horizontal (upright birds such as raptors: the stroke plane and the glide chord stay level
  // in flight when the body is levelled by the standing tilt)
  if (a.tilt) for (const v of TILTED) rot(o[v], o[v], XAX, -a.tilt);
  // joints
  set(o.elbow, o.dH.x * L.h, o.dH.y * L.h, o.dH.z * L.h);
  set(o.wrist, o.elbow.x + o.dU.x * L.u, o.elbow.y + o.dU.y * L.u, o.elbow.z + o.dU.z * L.u);
  set(o.tip, o.wrist.x + o.dM.x * L.m, o.wrist.y + o.dM.y * L.m, o.wrist.z + o.dM.z * L.m);
  return o;
}

// Extension of a wing segment for the feather fan: 0 folded .. 1 spread.
export const extension = (flex, foldFlex, spreadFlex) => {
  const t = (foldFlex - flex) / (foldFlex - spreadFlex);
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/**
 * One flight feather on a wing segment. Segment frame: P0 (proximal joint of the feather row: the
 * wrist for both rows), d (segment axis pointing outward), n (dorsal normal), length Ls, side.
 * f: { u (root along the row, 0 at P0), a (in-plane angle from d toward the trailing edge, rad),
 *      lift (dorsal root offset, m), back (root offset toward the trailing edge, m), bend (out of plane,
 *      + up, rad), twist (about its own axis, rad) }; `inward` = the row runs from P0 back along -d
 *      (secondaries along the ulna from the wrist to the elbow).
 * Writes root, axis (unit) and normal (unit, dorsal side of the vane).
 */
export function featherFrame(out, P0, d, n, Ls, side, f, a, inward) {
  const s = side;
  // trailing direction in the segment plane
  const tx = s * (n.y * d.z - n.z * d.y), ty = s * (n.z * d.x - n.x * d.z), tz = s * (n.x * d.y - n.y * d.x);
  const along = (inward ? -1 : 1) * Ls * f.u;
  set(out.root,
    P0.x + d.x * along + tx * f.back + n.x * f.lift,
    P0.y + d.y * along + ty * f.back + n.y * f.lift,
    P0.z + d.z * along + tz * f.back + n.z * f.lift);
  const ca = Math.cos(a), sa = Math.sin(a);
  let ax = d.x * ca + tx * sa, ay = d.y * ca + ty * sa, az = d.z * ca + tz * sa;
  const cb = Math.cos(f.bend || 0), sb = Math.sin(f.bend || 0);
  ax = ax * cb + n.x * sb; ay = ay * cb + n.y * sb; az = az * cb + n.z * sb;
  set(out.axis, ax, ay, az); nrm(out.axis);
  const dn = dot(n, out.axis);
  set(out.normal, n.x - out.axis.x * dn, n.y - out.axis.y * dn, n.z - out.axis.z * dn); nrm(out.normal);
  if (f.twist) rot(out.normal, out.normal, out.axis, s * f.twist);
  return out;
}

/**
 * One rectrix on the tail. Tail frame: P0 (tail tip joint), d (tail axis, backwards), n (dorsal),
 * lat (the bird's left). f: { x (lateral root offset, m, >0 = own side), lift, a (fan angle, rad,
 * outward), bend, twist }.
 */
export function rectrixFrame(out, P0, d, n, lat, side, f, a) {
  const s = side;
  set(out.root, P0.x + lat.x * s * f.x + n.x * f.lift, P0.y + lat.y * s * f.x + n.y * f.lift, P0.z + lat.z * s * f.x + n.z * f.lift);
  const ca = Math.cos(a), sa = Math.sin(a);
  let ax = d.x * ca + lat.x * s * sa, ay = d.y * ca + lat.y * s * sa, az = d.z * ca + lat.z * s * sa;
  const cb = Math.cos(f.bend || 0), sb = Math.sin(f.bend || 0);
  ax = ax * cb + n.x * sb; ay = ay * cb + n.y * sb; az = az * cb + n.z * sb;
  set(out.axis, ax, ay, az); nrm(out.axis);
  const dn = dot(n, out.axis);
  set(out.normal, n.x - out.axis.x * dn, n.y - out.axis.y * dn, n.z - out.axis.z * dn); nrm(out.normal);
  if (f.twist) rot(out.normal, out.normal, out.axis, -s * f.twist);
  return out;
}

export const makeFeatherFrame = () => ({ root: v3(), axis: v3(), normal: v3() });

// ---------------------------------------------------------------- species feather spec helpers
// Resolves species.motion.feathers into per-feather records (angles in radians, lengths in metres at
// the reference size). Spec:
//   primaries:   [{ len, width, u, spread, fold, emarg?, lift?, bend?, twist? }]  inner -> outer
//   secondaries: [{ len, width, u, spread, fold, lift?, ... }]                  wrist -> elbow
//   (any feather: arch? = vane edges below the rachis as a fraction of the half-width, default 0.12;
//   base0? = vane width at the root as a fraction of the full width, default 0.3; cov? = overrides of
//   its covert card: { lift, shift, lenK, widthK, shape }, see core/build/featherCards.js)
//   rectrices:   [{ len, width, x, fan, lift?, arc? (deg: rachis bent on a circular arc toward the
//                inner vane, e.g. a rooster's sickles), ... }]                  central -> outer
//   coverts:     { primary: len fraction, secondary: len fraction, tail: len fraction, rows? }
export function resolveFeathers(spec = {}) {
  const P = (spec.primaries || []).map((f, i, arr) => ({
    kind: 'pri', i, n: arr.length, len: f.len, width: f.width, u: f.u, spread: f.spread * DEG, fold: f.fold * DEG,
    lift: f.lift ?? (arr.length - 1 - i) * 0.0006, back: f.back ?? 0.002, bend: (f.bend || 0) * DEG, twist: (f.twist ?? 4) * DEG,
    emarg: f.emarg || 0, outer: f.outer ?? 0.32, curve: f.curve ?? 0.05, droop: f.droop ?? 0.02, tipRound: f.tipRound ?? 0.35, arch: f.arch,
    finger: f.finger ?? 0, cov: f.cov, base0: f.base0,
  }));
  const nP = P.length;
  const Sd = (spec.secondaries || []).map((f, i, arr) => ({
    kind: 'sec', i, n: arr.length, len: f.len, width: f.width, u: f.u, spread: f.spread * DEG, fold: f.fold * DEG,
    lift: f.lift ?? (nP + i) * 0.0006, back: f.back ?? 0.002, bend: (f.bend || 0) * DEG, twist: (f.twist ?? 3) * DEG,
    emarg: 0, outer: f.outer ?? 0.42, curve: f.curve ?? 0.03, droop: f.droop ?? 0.015, tipRound: f.tipRound ?? 0.5, finger: 0, arch: f.arch,
    cov: f.cov, base0: f.base0,
  }));
  const R = (spec.rectrices || []).map((f, i, arr) => ({
    kind: 'rec', i, n: arr.length, len: f.len, width: f.width, x: f.x, fan: f.fan * DEG, fold: (f.fold || 0) * DEG,
    lift: f.lift ?? (arr.length - 1 - i) * 0.0008, bend: (f.bend || 0) * DEG, twist: (f.twist ?? 2) * DEG,
    outer: f.outer ?? (i === 0 ? 0.5 : 0.4), curve: f.curve ?? 0.0, droop: f.droop ?? 0.01, tipRound: f.tipRound ?? 0.55, emarg: 0, finger: 0,
    arc: (f.arc || 0) * DEG, arch: f.arch, cov: f.cov, base0: f.base0,
  }));
  return { primaries: P, secondaries: Sd, rectrices: R, coverts: { primary: 0.36, secondary: 0.46, tail: 0.42, ...(spec.coverts || {}) } };
}

// Bind-pose feather joints for one side from the bind wing configuration. Writes J[`pri{k}rL`] etc.
// (left side; buildRig mirrors). Returns the per-feather bind frames (used by the card builder).
export function featherJoints(J, wingSpec, feathers, tailSpec) {
  const F = resolveFeathers(feathers);
  const sh = J.shoulderL;
  const L = wingLengths(J, wingSpec);
  const fr = wingFK(makeWingFrames(), 1, L, degs({ ...wingSpec.bind, tilt: wingSpec.tilt }));
  const P0 = v3(sh[0] + fr.wrist.x, sh[1] + fr.wrist.y, sh[2] + fr.wrist.z);
  const out = { pri: [], sec: [], rec: [] };
  const eH = extension(wingSpec.bind.wrist * DEG, wingSpec.fold.wrist * DEG, (wingSpec.open || wingSpec.glide).wrist * DEG);
  const eU = extension(wingSpec.bind.elbow * DEG, wingSpec.fold.elbow * DEG, (wingSpec.open || wingSpec.glide).elbow * DEG);
  for (const f of F.primaries) {
    const o = featherFrame(makeFeatherFrame(), P0, fr.dM, fr.nM, L.m, 1, f, f.fold + (f.spread - f.fold) * eH, false);
    J[`pri${f.i + 1}rL`] = [o.root.x, o.root.y, o.root.z];
    J[`pri${f.i + 1}tL`] = [o.root.x + o.axis.x * f.len, o.root.y + o.axis.y * f.len, o.root.z + o.axis.z * f.len];
    out.pri.push({ f, ...o });
  }
  for (const f of F.secondaries) {
    const o = featherFrame(makeFeatherFrame(), P0, fr.dU, fr.nU, L.u, 1, f, f.fold + (f.spread - f.fold) * eU, true);
    J[`sec${f.i + 1}rL`] = [o.root.x, o.root.y, o.root.z];
    J[`sec${f.i + 1}tL`] = [o.root.x + o.axis.x * f.len, o.root.y + o.axis.y * f.len, o.root.z + o.axis.z * f.len];
    out.sec.push({ f, ...o });
  }
  // tail: the bind tail frame follows the pygostyle (tailBase -> tailTip), dorsal = up
  const tb = J.tailBase, tt = J.tailTip;
  const d = nrm(v3(tt[0] - tb[0], tt[1] - tb[1], tt[2] - tb[2]));
  const lat = v3(1, 0, 0);
  const n = nrm(crs(v3(), d, lat)); // d x left = up for a backward-pointing d
  if (n.y < 0) set(n, -n.x, -n.y, -n.z);
  const fan = (tailSpec && tailSpec.bindFan) ?? 0.2;
  for (const f of F.rectrices) {
    const o = rectrixFrame(makeFeatherFrame(), v3(tt[0], tt[1], tt[2]), d, n, lat, 1, f, f.fold + (f.fan - f.fold) * fan);
    J[`rec${f.i + 1}rL`] = [o.root.x, o.root.y, o.root.z];
    J[`rec${f.i + 1}tL`] = [o.root.x + o.axis.x * f.len, o.root.y + o.axis.y * f.len, o.root.z + o.axis.z * f.len];
    out.rec.push({ f, ...o });
  }
  return { J, frames: out, F, wing: fr, lengths: L };
}

// Segment lengths: from the species wing spec (reference size).
export function wingLengths(J, w) { return { h: w.lengths[0], u: w.lengths[1], m: w.lengths[2] }; }

export function degs(a) {
  return { elev: (a.elev || 0) * DEG, pitch: (a.pitch || 0) * DEG, alpha: (a.alpha || 0) * DEG, elbow: (a.elbow || 0) * DEG, wrist: (a.wrist || 0) * DEG, bend: (a.bend || 0) * DEG, twist: (a.twist || 0) * DEG, uTwist: (a.uTwist || 0) * DEG, tilt: (a.tilt || 0) * DEG };
}

// Wing joints (left) from the bind configuration.
export function wingJoints(J, wingSpec) {
  const L = wingLengths(J, wingSpec);
  const fr = wingFK(makeWingFrames(), 1, L, degs({ ...wingSpec.bind, tilt: wingSpec.tilt }));
  const sh = J.shoulderL;
  J.elbowL = [sh[0] + fr.elbow.x, sh[1] + fr.elbow.y, sh[2] + fr.elbow.z];
  J.wristL = [sh[0] + fr.wrist.x, sh[1] + fr.wrist.y, sh[2] + fr.wrist.z];
  J.handTipL = [sh[0] + fr.tip.x, sh[1] + fr.tip.y, sh[2] + fr.tip.z];
  return fr;
}
