// Swimmer motion engine (fish, sharks): a travelling body wave on a spine chain, steering by body
// bends, paired fins that scull and fold, gill covers and mouth that pump, 3D swimming inside the
// water volume between the bed `ground(x, z)` and the surface `water(x, z)`.
//
// Model. The spine chain (snout -> spine0 .. spineN -> caudal tip, core/rig/swimmer.js) is rebuilt
// every frame from segment angles, so segment lengths never change (no stretch):
//   * body wave: lateral displacement y(u, t) = A(u) sin(2 pi (phi - u / lambda)), u = arc length /
//     body length; the phase phi integrates the tail-beat frequency (motion from phase, continuous
//     when the frequency changes); A(u) = amp/2 * L * envelope(u) with envelope exp(k (u - 1))
//     (carangiform) or u^p (thunniform: stiff front, all motion in the peduncle and tail);
//   * steering: the body bends into an arc (C-bend) proportional to the yaw rate and inversely to
//     the speed (it follows its own path), distributed along the flexible part of the body;
//   * recoil: the mass-weighted mean orientation of the body is the heading and the mass-weighted
//     centre is state.position, so the head yaws against the tail beat as in real fish;
//   * vertical plane: rest pitch of every segment from the bind pose (an up-turned heterocercal
//     shark tail just works), plus action arches (leap, death droop), plus the path pitch.
// Fins: pectorals scull at low speed (flap + row + feather from a fin phase) and fold flat against
// the body as the speed rises; they flare to brake and on the inside of turns; pelvic fins spread when
// slow; gill covers flare with each breath while the mouth opens in counter-phase (buccal pump).
// The water column: the fish keeps a clearance above the bed and below the surface (soft steering)
// and a hard skin-extent clamp (bone-local skin extents measured from the mesh at start) so the skin
// never cuts the bed or breaks the surface unless it is leaping. Out of the water it flies
// ballistically and splashes back ('takeoff' / 'land' events).
// Shores (water(x, z) null or shallower than the body: a lake in a landscape): the fish turns away from
// water too shallow ahead and never swims into it; a leap is aimed short enough to come down in deep
// water; a body that still comes down on dry ground (or is placed there) is beached: it flops and
// slides back toward the nearest water ('beach' event, state.beached, gait 'flop') and swims on there.
// Lessons from the cheetah: continuous solves, soft limits, springs for secondary motion, zero-dt
// safety, no allocations in the hot path.
//
// ------------------------------------------------------------------------------------------------
// species.motion schema (all optional; speeds in body lengths per second, BL/s; L = snout -> caudal
// tip along the chain of this individual; `variants: { key: { ...overrides } }` merges per
// params.variant, e.g. fish trout / goldfish, shark white / blacktip)
// ------------------------------------------------------------------------------------------------
// speeds      { name: BL/s } named speeds (default { scull: 0.4, cruise: 1.5, sprint: 4 }); the engine
//             exposes them in m/s for this individual (animal.gears)
// maxSpeed    BL/s top sustained speed from move();  burstSpeed BL/s peak of burst / attack / hit
// minSpeed    BL/s: obligate ram ventilators (sharks) never drop below it: they patrol in slow circles
// patrolRadius BL: radius of that patrol circle (default 0 = the tightest turn)
// accel, decel  BL/s^2 (decel is also the drag of a gliding fish)
// turnRate    rad/s yaw rate at rest; turnRadius: minimum turning radius at speed (BL)
// wave        rows [v BL/s, f Hz, amp (tail-tip peak-to-peak / L), lambda (L), pect 0..1 (pectoral
//             sculling activity), pf Hz (pectoral beat), fold 0..1 (pectorals folded)], sorted by v.
//             From Bainbridge (1958): f = (U/L + 1) / 0.75 above ~2 BL/s, amp ~0.2 L.
// envelope    { exp: k } (a = e^(k (u-1)), carangiform, default k = 3.5) or { pow: p } (thunniform,
//             p ~ 2.5); head: 0..1 extra head yaw (added to recoil)
// flex        [u0, u1]: where the body can bend for steering (fraction of L), default [0.15, 0.95]
// caudalStiff 0..1: how much the caudal fin stays a flat plate continuing the peduncle (default 0.6)
// bend        max total C-bend of a turn (rad), cBend: max C-start bend (rad)
// bank        max roll in turns (rad);  bankGain: roll per unit of lateral acceleration (default 0.12;
//             sharks bank into turns ~1-1.4);  pitchMax: max climb pitch (rad);  hover: vertical hover speed (BL/s)
// strandRoll  rad: the roll of a body stranded on dry ground (default 1.3: a bony fish lies on its side;
//             a broad shark ~0.25, on its belly)
// clearance   distance kept from the bed and the surface (BL); cruiseDepth: preferred height above
//             the bed when spawned (BL)
// pectoral    { rest: [abduct, row, feather] deg, flap, row, feather: sculling amplitudes (deg),
//               fold: deg against the body at speed, flare: deg when braking, alternate: 0..1
//               (0 = both fins in phase, 1 = alternating, hovering goldfish), stiff: 0..1 (sharks:
//               hydrofoils that do not scull) }
// pelvic      { rest: deg abduct, spread: deg when slow, fold: deg at speed }
// breath      { rate Hz, operculum deg flare, mouth 0..1 buccal gape, ram: BL/s above which the
//               pumping fades (ram ventilation), slits: true for sharks (no gill covers) }
// jaw         { gape deg (max mouth opening), protrude (BL, upper jaw protrusion), protrudeDir: [x, y, z]
//               bind-space direction of the protrusion (default [0, -0.3, 1]; sharks forward and down) }
// actions     { burst: { turn deg, speed BL/s }, jump: { height BL }, eat: { style 'suction' |
//               'bottom', lunge BL }, drink: { reach BL (surface gulp if the surface is closer) },
//               attack: { lunge BL, headLift rad (snout lift on the bite), shake (head shakes after the
//               bite), eye: 'roll' | 'nictitate' (eye protection on the bite) }, eat: { style 'tear' too
//               (bite, head lift, shakes: sharks) }, jump: { bite: bool (breach with a bite), roll rad
//               (rotation in the air) }, sleep: { style 'bottom' | 'hover' | 'side' }, lie: { style },
//               death: { float: bool, roll rad (final roll, default pi/2 = on its side) } }
// state extras: eyeRoll 0..1 (white shark: the eye rolls back on the bite), nictitate 0..1 (membrane)
// ------------------------------------------------------------------------------------------------
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, angDiff, Spring, writeFrame, prng, tv } from './common.js';
import { SwimmerActions, createSwimParams } from './swimmerActions.js';

const DEFAULTS = {
  speeds: { scull: 0.4, cruise: 1.5, sprint: 4 },
  maxSpeed: 6, burstSpeed: 10, minSpeed: 0, patrolRadius: 0, accel: 12, decel: 5, turnRate: 3.2, turnRadius: 0.35,
  wave: [
    [0, 0.8, 0.03, 1.0, 1.0, 1.5, 0],
    [0.5, 1.9, 0.1, 0.95, 0.6, 1.8, 0.3],
    [1.5, 3.3, 0.17, 0.9, 0.15, 2.0, 0.75],
    [3, 5.3, 0.2, 0.85, 0, 2, 1],
    [6, 9.3, 0.2, 0.8, 0, 2, 1],
    [10, 14.7, 0.21, 0.75, 0, 2, 1],
  ],
  envelope: { exp: 3.5 }, flex: [0.15, 0.97], bend: 1.4, cBend: 2.6, bank: 0.35, bankGain: 0.12, pitchMax: 0.9, hover: 0.35,
  clearance: 0.12, cruiseDepth: 0.6,
  pectoral: { rest: [0, 0, 0], flap: 22, row: 18, feather: 25, fold: 26, flare: 55, alternate: 0.3, stiff: 0 },
  pelvic: { rest: 0, spread: 10, fold: 14 },
  breath: { rate: 1.2, operculum: 9, mouth: 0.18, ram: 2.5, slits: false },
  jaw: { gape: 28, protrude: 0.02 },
  actions: {},
};

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
function merge(a, b) {
  if (!isObj(b)) return b === undefined ? a : b;
  const o = { ...(isObj(a) ? a : {}) };
  for (const [k, v] of Object.entries(b)) o[k] = isObj(v) && isObj(o[k]) ? merge(o[k], v) : v;
  return o;
}

function resolveConfig(species, data) {
  const base = species.motion || {};
  const variant = data.params?.variant;
  let spec = merge(DEFAULTS, { ...base, variants: undefined });
  if (variant && base.variants && base.variants[variant]) spec = merge(spec, base.variants[variant]);
  // named speeds replace the defaults (a species' gears are its own, e.g. a shark has no 'scull')
  spec.speeds = (variant && base.variants?.[variant]?.speeds) || base.speeds || DEFAULTS.speeds;
  const J = {};
  for (const [k, v] of Object.entries(data.joints)) J[k] = new THREE.Vector3(v[0], v[1], v[2]);
  const names = data.bones.map((b) => b.name);
  const spine = names.filter((n) => /^spine\d+$/.test(n)).sort((a, b) => +a.slice(5) - +b.slice(5));
  const caudal = names.filter((n) => /^caudal\d+$/.test(n)).sort((a, b) => +a.slice(6) - +b.slice(6));
  if (!spine.length || !J.snout) throw new Error('procedural-animals swimmer: the rig needs snout, spine0..N (core/rig/swimmer.js)');
  const chainBones = [...spine, ...caudal];
  const bIndex = Object.fromEntries(names.map((n, i) => [n, i]));
  const chainJ = chainBones.map((n) => J[data.bones[bIndex[n]].headJ]);
  chainJ.push(J[data.bones[bIndex[chainBones[chainBones.length - 1]]].tailJ]);
  const n = chainBones.length;
  const segLen = new Float64Array(n), restPitch = new Float64Array(n), restYaw = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const d = _v1.copy(chainJ[i + 1]).sub(chainJ[i]);
    segLen[i] = d.length();
    restPitch[i] = Math.atan2(d.y, Math.hypot(d.x, d.z));
    restYaw[i] = Math.atan2(d.x, -d.z);
  }
  const hd = _v1.copy(J.snout).sub(chainJ[0]);
  const headLen = hd.length(), headPitch = Math.atan2(hd.y, Math.hypot(hd.x, hd.z));
  // arc positions (from the snout) and body length
  const sJ = new Float64Array(n + 1);
  sJ[0] = headLen;
  for (let i = 0; i < n; i++) sJ[i + 1] = sJ[i] + segLen[i];
  const L = sJ[n];
  const cfg = {
    caudalStart: spine.length,
    spec, J, L, n, chainBones, chainJ, segLen, restPitch, restYaw, headLen, headPitch, sJ, bIndex,
    uJ: Float64Array.from(sJ, (s) => s / L),
    gears: Object.fromEntries(Object.entries(spec.speeds).map(([k, v]) => [k, v * L])),
    maxSpeed: spec.maxSpeed * L, burstSpeed: spec.burstSpeed * L, minSpeed: spec.minSpeed * L,
    accel: spec.accel * L, decel: spec.decel * L,
    hover: spec.hover * L, clearance: spec.clearance * L,
    actions: spec.actions || {},
  };
  // amplitude envelope and bend distribution per joint
  const env = spec.envelope || {};
  const envAt = (u) => (env.pow ? Math.pow(Math.max(0, u), env.pow) : Math.exp((env.exp ?? 3.5) * (u - 1)));
  cfg.envJ = Float64Array.from(cfg.uJ, envAt);
  const [f0, f1] = spec.flex || [0.15, 0.97];
  const bw = new Float64Array(n);
  let bs = 0;
  for (let i = 0; i < n; i++) {
    const u = (cfg.uJ[i] + cfg.uJ[i + 1]) / 2;
    bw[i] = smooth(f0 - 0.1, f0 + 0.1, u) * (1 - smooth(f1 - 0.05, f1 + 0.08, u)) * (0.5 + 0.5 * Math.sqrt(envAt(u)));
    bs += bw[i];
  }
  for (let i = 0; i < n; i++) bw[i] /= bs || 1;
  cfg.bendW = bw;
  return cfg;
}

export function createSwimmerMotion(ctx) { return new SwimmerMotion(ctx); }

export class SwimmerMotion {
  constructor({ species, data, skeleton, ground, water, position, heading = 0, emit }) {
    this.species = species;
    this.cfg = resolveConfig(species, data);
    const cfg = this.cfg;
    this.sk = skeleton;
    this.data = data;
    this.ground = ground || (() => 0);
    this.water = typeof water === 'function' ? water : null;
    this.emit = emit || (() => {});
    this.rand = prng((data.seed || 1) * 7919 + 29);
    this.bone = {};
    for (let i = 0; i < data.bones.length; i++) this.bone[data.bones[i].name] = skeleton.bones[i];
    this.chainBoneObjs = cfg.chainBones.map((nm) => this.bone[nm]);
    this.isChain = new Uint8Array(data.bones.length);
    for (const nm of [...cfg.chainBones, 'head']) this.isChain[cfg.bIndex[nm]] = 1;
    // ---- public contract
    this.input = { speed: 0, heading, climb: 0, look: null, follow: null, target: null, targetSpeed: cfg.gears.cruise ?? cfg.L, crouch: 0, gait: null };
    this.pos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = heading;
    this.speed = 0;
    this.lookTarget = new THREE.Vector3();
    this.state = {
      position: this.pos, heading, speed: 0, velocity: this.velocity, gait: 'stand', grounded: true,
      action: null, posture: 'stand', eyelid: 0, eyeRoll: 0, nictitate: 0, lookTarget: null, inWater: true, depth: 0, pitch: 0, roll: 0,
      stats: { gait: 'stand', freq: 0, duty: 0 },
      legs: [],
    };
    this.headPose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
    this.debug = { targets: Array.from({ length: 6 }, () => new THREE.Vector3()) };
    this.gears = cfg.gears;
    this.gaits = Object.keys(cfg.gears);
    this.lod = 0;
    this.frame = 0;
    this.time = 0;
    // ---- dynamic state
    this.pitch = 0; this.roll = 0; this.yawRate = 0; this.accS = 0;
    this.pitchS = new Spring(0); this.rollS = new Spring(0); this.yawS = new Spring(0);
    this.bendS = new Spring(0); this.archS = new Spring(0);
    this.ampS = new Spring(0); this.freqS = new Spring(0.8); this.lamS = new Spring(1);
    this.pectS = new Spring(1); this.pfS = new Spring(1.5); this.foldS = new Spring(0); this.flareS = new Spring(0);
    this.pelS = new Spring(0);
    this.gapeS = new Spring(0); this.protS = new Spring(0); this.opS = new Spring(0);
    this.lookYawS = new Spring(0); this.lookPitchS = new Spring(0);
    this.headLiftS = new Spring(0); this.eyeRollS = new Spring(0); this.nictS = new Spring(0);
    this.turnSideS = new Spring(0);
    this.phase = this.rand(); this.pPhase = this.rand(); this.bPhase = this.rand();
    this.vy = 0; // vertical velocity (m/s) beyond the path pitch: hovering, sinking, ballistic flight
    this.vh = 0; // horizontal speed in flight
    this.air = false;
    this.beached = false; // out of the water on dry ground: flopping back toward the nearest water
    this.surfaceY = Infinity; // last known water surface (null callbacks keep the last value)
    this.lift = 0; // hard clamp correction carried to the next frame
    this.P = createSwimParams();
    // ---- preallocated pose buffers
    const n = cfg.n;
    this.th = new Float64Array(n); this.ph = new Float64Array(n); this.yw = new Float64Array(n + 1);
    this.Q = Array.from({ length: n + 2 }, () => new THREE.Vector3()); // Q[0] = spine0 ... Q[n] = tail tip, Q[n+1] = snout (local)
    this.W = Array.from({ length: n + 2 }, () => new THREE.Vector3()); // world
    this.D = Array.from({ length: n + 1 }, () => new THREE.Vector3()); // world bone directions (last = head)
    this.X = Array.from({ length: n + 1 }, () => new THREE.Vector3()); // world lateral axes
    this.basis = { F: new THREE.Vector3(), U: new THREE.Vector3(), Lf: new THREE.Vector3() };
    this.gh = new Float64Array(3); // ground samples (snout, middle, tail)
    // ---- mass weights, skin extents, children
    this._measure(data);
    this._children(data);
    this.attachmentPoints = this._attachments(data);
    this.actionsLayer = new SwimmerActions(this);
    this.actions = this.actionsLayer.names;
    this.reset(position || new THREE.Vector3(), heading);
  }

  // skin extents of every bone in its own bind frame (from the mesh), and a mass per chain segment
  _measure(data) {
    const cfg = this.cfg, sk = this.sk, nB = data.bones.length;
    const ext = new Float64Array(nB * 6);
    for (let b = 0; b < nB; b++) { ext[b * 6] = ext[b * 6 + 2] = ext[b * 6 + 4] = Infinity; ext[b * 6 + 1] = ext[b * 6 + 3] = ext[b * 6 + 5] = -Infinity; }
    const massA = new Float64Array(nB * 4); // body-only lateral / dorsoventral extents (no fins)
    for (let b = 0; b < nB; b++) { massA[b * 4] = massA[b * 4 + 2] = Infinity; massA[b * 4 + 1] = massA[b * 4 + 3] = -Infinity; }
    const inv = sk.inverses || sk.bind.map((m) => m.clone().invert());
    const p = new THREE.Vector3();
    for (let v = 0; v < data.nV; v++) {
      if (data.coat[v * 4 + 3] < 0.5) continue;
      let bb = data.skinIndex[v * 4], bw = data.skinWeight[v * 4];
      for (let k = 1; k < 4; k++) if (data.skinWeight[v * 4 + k] > bw) { bw = data.skinWeight[v * 4 + k]; bb = data.skinIndex[v * 4 + k]; }
      p.set(data.pos[v * 3], data.pos[v * 3 + 1], data.pos[v * 3 + 2]).applyMatrix4(inv[bb]);
      const o = bb * 6;
      if (p.x < ext[o]) ext[o] = p.x; if (p.x > ext[o + 1]) ext[o + 1] = p.x;
      if (p.y < ext[o + 2]) ext[o + 2] = p.y; if (p.y > ext[o + 3]) ext[o + 3] = p.y;
      if (p.z < ext[o + 4]) ext[o + 4] = p.z; if (p.z > ext[o + 5]) ext[o + 5] = p.z;
      if (Math.round(data.tint[v * 4 + 3]) !== 11) {
        const q = bb * 4;
        if (p.x < massA[q]) massA[q] = p.x; if (p.x > massA[q + 1]) massA[q + 1] = p.x;
        if (p.z < massA[q + 2]) massA[q + 2] = p.z; if (p.z > massA[q + 3]) massA[q + 3] = p.z;
      }
    }
    // the bone itself (head .. tail joint) is part of the body: fin tips are joints too
    for (let b = 0; b < nB; b++) {
      const bl = data.bones[b], h = data.joints[bl.headJ], t = data.joints[bl.tailJ];
      const len = Math.hypot(t[0] - h[0], t[1] - h[1], t[2] - h[2]);
      const o = b * 6;
      if (!Number.isFinite(ext[o])) { ext[o] = ext[o + 1] = ext[o + 4] = ext[o + 5] = 0; ext[o + 2] = ext[o + 3] = 0; }
      ext[o] = Math.min(ext[o], 0); ext[o + 1] = Math.max(ext[o + 1], 0);
      ext[o + 2] = Math.min(ext[o + 2], 0); ext[o + 3] = Math.max(ext[o + 3], len);
      ext[o + 4] = Math.min(ext[o + 4], 0); ext[o + 5] = Math.max(ext[o + 5], 0);
    }
    // ellipse / box extents: centre + half size per bone, local X (lateral), Y (along), Z (third)
    this.ext = new Float64Array(nB * 6);
    for (let b = 0; b < nB; b++) {
      const o = b * 6;
      this.ext[o] = (ext[o] + ext[o + 1]) / 2; this.ext[o + 1] = (ext[o + 1] - ext[o]) / 2;
      this.ext[o + 2] = (ext[o + 2] + ext[o + 3]) / 2; this.ext[o + 3] = (ext[o + 3] - ext[o + 2]) / 2;
      this.ext[o + 4] = (ext[o + 4] + ext[o + 5]) / 2; this.ext[o + 5] = (ext[o + 5] - ext[o + 4]) / 2;
    }
    // mass per chain segment (+ head as the last entry): cross-section area x length
    const n = cfg.n;
    this.mass = new Float64Array(n + 1);
    const area = (b) => {
      const q = b * 4;
      const hx = Number.isFinite(massA[q]) ? (massA[q + 1] - massA[q]) / 2 : 0, hz = Number.isFinite(massA[q + 2]) ? (massA[q + 3] - massA[q + 2]) / 2 : 0;
      return Math.max(1e-8, hx * hz);
    };
    let tot = 0;
    for (let i = 0; i < n; i++) { this.mass[i] = area(cfg.bIndex[cfg.chainBones[i]]) * cfg.segLen[i]; tot += this.mass[i]; }
    this.mass[n] = area(cfg.bIndex.head) * cfg.headLen * 1.3; tot += this.mass[n];
    for (let i = 0; i <= n; i++) this.mass[i] /= tot;
    // extents of the whole bind body below / above the centre (for spawning and clearance)
    let lo = Infinity, hi = -Infinity;
    for (let v = 0; v < data.nV; v++) { const y = data.pos[v * 3 + 1]; if (y < lo) lo = y; if (y > hi) hi = y; }
    this.bindLow = lo; this.bindHigh = hi;
    this.nB = nB;
  }

  // children of the chain: jaw, upper jaw, gill covers, paired fins (bind-space rotation axes)
  _children(data) {
    const J = this.cfg.J, sk = this.sk, bi = this.cfg.bIndex;
    const V = (a) => (J[a] ? J[a].clone() : null);
    const mk = (name, pivotJ, axes) => {
      const i = bi[name];
      if (i === undefined) return null;
      const b = data.bones[i];
      const pi = bi[b.parent];
      const base = J[pivotJ || b.headJ];
      const A = new THREE.Matrix4().copy(sk.inverses ? sk.inverses[pi] : sk.bind[pi].clone().invert()).multiply(new THREE.Matrix4().makeTranslation(base.x, base.y, base.z));
      const C0 = sk.bind[i].clone().setPosition(0, 0, 0);
      return { name, i, pi, bone: sk.bones[i], parent: sk.bones[pi], A, C0, axes, q: new THREE.Quaternion(), t: new THREE.Vector3(), M: new THREE.Matrix4() };
    };
    const axis = (a, b) => a && b ? new THREE.Vector3().copy(a).cross(b).normalize() : null;
    this.kids = [];
    // lower jaw: rotates down about the hinge
    if (J.jawHinge && J.jawTip && bi.jaw !== undefined) {
      const j = V('jawTip').sub(J.jawHinge).normalize();
      this.kids.push(this.jaw = mk('jaw', 'jawHinge', { open: axis(j, new THREE.Vector3(0, -1, 0)) }));
    }
    if (bi.upperJaw !== undefined) this.kids.push(this.upperJaw = mk('upperJaw', null, {}));
    this.opercula = [];
    this.pecs = [];
    this.pels = [];
    for (const [S, s] of [['L', 1], ['R', -1]]) {
      const out = new THREE.Vector3(s, 0, 0);
      if (bi['operculum' + S] !== undefined) {
        const e = V('opEdge' + S).sub(J['opHinge' + S]).normalize();
        const k = mk('operculum' + S, null, { flare: axis(e, out) });
        this.kids.push(k); this.opercula.push(k);
      }
      if (bi['pectoral' + S] !== undefined) {
        const d = V('pecTip' + S).sub(J['pecBase' + S]).normalize();
        const k = mk('pectoral' + S, null, { ab: axis(d, out), row: axis(d, new THREE.Vector3(0, 0, 1)), long: d.clone(), s });
        this.kids.push(k); this.pecs.push(k);
      }
      if (bi['pelvic' + S] !== undefined) {
        const d = V('pelTip' + S).sub(J['pelBase' + S]).normalize();
        const k = mk('pelvic' + S, null, { ab: axis(d, out), long: d.clone(), s });
        this.kids.push(k); this.pels.push(k);
      }
    }
    this.kids = this.kids.filter(Boolean);
    // children of the head must be posed after it; others after their spine bone (chain first)
  }

  _attachments(data) {
    const J = this.cfg.J, sk = this.sk, bi = this.cfg.bIndex;
    const at = (bone, p) => {
      const i = bi[bone];
      if (i === undefined || !p) return null;
      const inv = sk.inverses ? sk.inverses[i] : sk.bind[i].clone().invert();
      return { bone, local: new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).premultiply(inv) };
    };
    let headP = J.snout.clone().lerp(this.cfg.chainJ[0], 0.5);
    if (data.eyes?.length) { headP = new THREE.Vector3(); for (const e of data.eyes) headP.add(new THREE.Vector3(...e.c)); headP.multiplyScalar(1 / data.eyes.length); }
    const k = Math.min(this.cfg.n - 1, Math.round(this.cfg.n * 0.3));
    const back = this.cfg.chainJ[k].clone();
    back.y = this.bindHigh;
    const out = { mouth: at('head', J.snout), head: at('head', headP), back: at(this.cfg.chainBones[k], back) };
    for (const kk of Object.keys(out)) if (!out[kk]) delete out[kk];
    this._headLocal = at('head', headP)?.local || new THREE.Matrix4();
    return out;
  }

  // ----------------------------------------------------------------- environment
  groundAt(x, z) { const h = this.ground(x, z); return Number.isFinite(h) ? h : 0; }
  surfaceAt(x, z) {
    if (!this.water) return Infinity;
    const w = this.water(x, z);
    if (w !== null && w !== undefined && Number.isFinite(w)) this.surfaceY = w;
    return this.surfaceY;
  }
  // depth of the water column at (x, z): 0 where water(x, z) gives no surface (dry land); Infinity
  // without a water callback
  waterDepth(x, z) {
    if (!this.water) return Infinity;
    const w = this.water(x, z);
    if (w === null || w === undefined || !Number.isFinite(w)) return 0;
    return w - this.groundAt(x, z);
  }
  // the water a body of this size can swim in: deeper than its own height (centre to belly + back)
  swimDepth() { return 0.8 * (this.cBelow + this.cAbove) + this.cfg.clearance; }
  // heading (rad) toward water at least `need` deep: the candidate nearest to `h0` among 24 directions
  // at distance r (null when none)
  wetHeading(h0, r, need) {
    for (let k = 0; k <= 12; k++) {
      for (const sgn of k === 0 || k === 12 ? [1] : [1, -1]) {
        const h = h0 + sgn * k * (Math.PI / 12);
        if (this.waterDepth(this.pos.x + Math.sin(h) * r, this.pos.z + Math.cos(h) * r) >= need) return h;
      }
    }
    return null;
  }
  // the nearest water at least `need` deep: rings of 16 directions out to `rMax` (null when none)
  nearestWater(need, rMax) {
    const L = this.cfg.L;
    for (let r = 0.25 * L; r <= rMax; r *= 1.3) {
      let best = null, bd = -1;
      for (let k = 0; k < 16; k++) {
        const h = (k / 16) * Math.PI * 2;
        const d = this.waterDepth(this.pos.x + Math.sin(h) * r, this.pos.z + Math.cos(h) * r);
        if (d >= need && d > bd) { bd = d; best = h; }
      }
      if (best !== null) return { heading: best, dist: r };
    }
    return null;
  }

  // allowed range of the centre height at (x, z): bed + below-extent + clearance .. surface - above-extent - clearance
  depthRange(x, z, out) {
    const c = this.cfg, cl = c.clearance;
    const g = this.groundAt(x, z), s = this.surfaceAt(x, z);
    const below = this.cBelow, above = this.cAbove;
    out.lo = g + below + cl;
    out.hi = s - above - cl * 0.8;
    if (out.hi < out.lo) out.hi = out.lo = Math.max(g + below + cl * 0.2, Math.min(out.lo, s - above));
    return out;
  }

  reset(p, heading = this.heading) {
    const cfg = this.cfg;
    this.heading = heading; this.input.heading = heading;
    this.speed = 0; this.velocity.set(0, 0, 0); this.vy = 0; this.yawRate = 0;
    // centre of mass of the bind pose relative to the bind root, and the body's vertical extents
    this.poseLocal(0);
    let cy = 0;
    for (let i = 0; i < cfg.n; i++) cy += this.mass[i] * (cfg.chainJ[i].y + cfg.chainJ[i + 1].y) / 2;
    cy += this.mass[cfg.n] * (cfg.chainJ[0].y + cfg.J.snout.y) / 2;
    this.cBelow = cy - this.bindLow; this.cAbove = this.bindHigh - cy;
    this.pos.copy(p);
    const r = this.depthRange(p.x, p.z, {});
    const want = this.groundAt(p.x, p.z) + this.cBelow + cfg.spec.cruiseDepth * cfg.L;
    if (!(p.y > r.lo && p.y < r.hi)) this.pos.y = clamp(Math.min(want, r.hi), r.lo, Math.max(r.lo, r.hi));
    this.wantY = this.pos.y;
    this.pitchS.reset(0); this.rollS.reset(0); this.yawS.reset(0); this.bendS.reset(0); this.archS.reset(0);
    this.lift = 0; this.air = false;
    this.beached = !!this.water && this.waterDepth(p.x, p.z) < 0.5 * (this.cBelow + this.cAbove);
    if (this.beached) { this.pos.y = this.groundAt(p.x, p.z) + this.cBelow; this._strandSide = 1; }
    this._init = true;
  }

  // ----------------------------------------------------------------- public API
  play(name, opts) { return this.actionsLayer.play(name, opts || {}); }
  stop(name) { this.actionsLayer.stop(name); }
  setLod(level) { this.lod = clamp(level | 0, 0, 2); return this; }
  dispose() { this.actionsLayer.clear(); }

  update(dt) {
    if (!(dt > 1e-4) || !Number.isFinite(dt)) dt = 1e-4;
    dt = Math.min(dt, 1 / 20);
    this.frame++;
    this.time += dt;
    this.drive(dt);
    this.actionsLayer.update(dt);
    this.step(dt);
    this.pose(dt);
    this.publish();
  }

  // steering input -> wanted speed, heading and height
  drive(dt) {
    const inp = this.input, cfg = this.cfg, L = cfg.L;
    this.wantSpeed = clamp(inp.speed || 0, 0, cfg.maxSpeed);
    this.wantHeading = inp.heading ?? this.heading;
    this.wantPitch = clamp(inp.climb || 0, -1, 1) * cfg.spec.pitchMax;
    this.wantVy = clamp(inp.climb || 0, -1, 1) * cfg.hover;
    this.targetY = null;
    if (inp.target && !inp.follow) {
      const t = inp.target;
      const dx = t.x - this.pos.x, dz = t.z - this.pos.z, dy = t.y - this.pos.y;
      const d = Math.hypot(dx, dz, dy);
      const stopR = 0.4 * L + 0.05 * this.speed;
      if (d < stopR) { inp.target = null; inp.speed = 0; this.wantSpeed = 0; this.emit('arrive', {}); }
      else {
        const want = Math.atan2(dx, dz);
        inp.heading = want;
        this.wantHeading = want;
        this.wantPitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -cfg.spec.pitchMax, cfg.spec.pitchMax);
        this.targetY = t.y;
        const brake = Math.sqrt(Math.max(0, 2 * cfg.decel * 0.7 * (d - stopR)));
        this.wantSpeed = Math.min(inp.targetSpeed || cfg.gears.cruise || L, cfg.maxSpeed, brake + 0.1 * L);
      }
    }
    if (this.actionsLayer.holdsStill()) {
      if (this.wantSpeed > 0.05 * L && !inp.follow) this.actionsLayer.requestStand();
      this.wantSpeed = 0; this.wantPitch = 0; this.wantVy = 0;
      this.wantHeading = this.heading;
    } else if (!inp.follow && this.wantSpeed < 0.05 * L) {
      // turn toward a look target behind
      const lt = inp.look;
      if (lt) {
        const want = Math.atan2(lt.x - this.pos.x, lt.z - this.pos.z);
        const off = angDiff(this.heading, want);
        if (Math.abs(off) > 0.7) this._turnTo = want;
        else if (this._turnTo !== undefined && Math.abs(off) < 0.2) this._turnTo = undefined;
        if (this._turnTo !== undefined) { this.wantHeading = this._turnTo; inp.heading = this._turnTo; }
      } else this._turnTo = undefined;
    }
    // obligate ram ventilators keep swimming: slow circles when asked to stop
    if (cfg.minSpeed > 0 && this.wantSpeed < cfg.minSpeed && !inp.follow && this.P.alive > 0.5) {
      this.wantSpeed = cfg.minSpeed;
      // circle at patrolRadius (the heading controller turns at 5 x the heading error)
      if (!inp.target) this.wantHeading = this.heading + (cfg.spec.patrolRadius > 0 ? Math.max(this.speed, cfg.minSpeed) / (cfg.spec.patrolRadius * L * 5) : 0.25);
    }
    this.avoidShore();
  }

  // shores: water too shallow for the body ahead (or dry land) turns the fish toward deep water and,
  // close in, slows it down so it can turn inside its turning radius. Only where water(x, z) ends or
  // the bed rises into the body's height (an open water column never triggers it).
  avoidShore() {
    if (!this.water || this.air || this.beached || this.input.follow) return;
    const L = this.cfg.L, need = this.swimDepth();
    const v = Math.max(this.speed, this.wantSpeed);
    const h = this.heading;
    const near = 0.6 * L + v * 0.6, far = 1.0 * L + v * 1.5;
    const dNear = this.waterDepth(this.pos.x + Math.sin(h) * near, this.pos.z + Math.cos(h) * near);
    const dFar = this.waterDepth(this.pos.x + Math.sin(h) * far, this.pos.z + Math.cos(h) * far);
    // also where the fish is asked to go
    const hw = this.wantHeading;
    const dWant = this.waterDepth(this.pos.x + Math.sin(hw) * far, this.pos.z + Math.cos(hw) * far);
    this.shore = 0;
    if (dFar >= need && dNear >= need && dWant >= need) return;
    const okWant = dWant >= need && this.waterDepth(this.pos.x + Math.sin(hw) * near, this.pos.z + Math.cos(hw) * near) >= need;
    const hNew = okWant ? hw : this.wetHeading(hw, far, need) ?? this.wetHeading(hw, near, need) ?? this.nearestWater(need, 6 * L)?.heading;
    if (hNew === null || hNew === undefined) return;
    this.wantHeading = hNew;
    this.input.heading = hNew;
    // close to the shore and still heading at it: brake to turn tighter
    const urgency = dNear < need ? 1 : dFar < need ? 0.5 : 0;
    this.shore = urgency;
    if (urgency > 0) this.wantSpeed = Math.min(this.wantSpeed, Math.max(this.cfg.minSpeed || 0, (urgency > 0.9 ? 0.4 : 0.9) * L));
  }

  // ----------------------------------------------------------------- simulation
  step(dt) {
    const cfg = this.cfg, inp = this.input, P = this.P, L = cfg.L, sp = cfg.spec;
    const rng = this._rng || (this._rng = {});
    // ---- follow: an external body places the fish
    if (inp.follow) {
      const fv = inp.follow.velocity, fp = inp.follow.position;
      const v3 = Math.hypot(fv.x, fv.y, fv.z);
      this.speed = v3;
      if (Math.hypot(fv.x, fv.z) > 0.02 * L) this.wantHeading = inp.follow.heading ?? Math.atan2(fv.x, fv.z);
      else if (inp.follow.heading !== null && inp.follow.heading !== undefined) this.wantHeading = inp.follow.heading;
      const err = angDiff(this.heading, this.wantHeading);
      const yr = clamp(err * 8, -sp.turnRate * 2, sp.turnRate * 2);
      this.yawRate = this.yawS.step(yr, 18, dt);
      this.heading += this.yawRate * dt;
      this.pitch = this.pitchS.step(v3 > 0.05 * L ? clamp(Math.atan2(fv.y, Math.hypot(fv.x, fv.z)), -sp.pitchMax, sp.pitchMax) : 0, 6, dt);
      // velocity feed-forward + a stiff pull toward the followed point (smooths a jittery body)
      const r = this.depthRange(fp.x, fp.z, rng);
      const ty = fp.y > r.lo && fp.y < r.hi ? fp.y : clamp(this.pos.y, r.lo, Math.max(r.lo, r.hi));
      const k = 1 - Math.exp(-dt * 25);
      this.pos.x += fv.x * dt; this.pos.z += fv.z * dt; this.pos.y += fv.y * dt;
      this.pos.x += (fp.x - this.pos.x) * k; this.pos.z += (fp.z - this.pos.z) * k; this.pos.y += (ty - this.pos.y) * (1 - Math.exp(-dt * 6));
      this.velocity.copy(fv);
      this.air = false;
      this.advancePhases(dt);
      return;
    }
    if (this.beached) { this.stepBeached(dt); return; }
    // ---- speed (with a smoothed acceleration: no jerk pops)
    const want = lerp(this.wantSpeed, P.speed, P.speedW);
    if (!this.air) {
      const dv = want - this.speed;
      const aCmd = clamp(dv * 6, -cfg.decel * (1 + 2 * P.brake), cfg.accel * (1 + P.accelK));
      this.accS += (aCmd - this.accS) * (1 - Math.exp(-dt * 14));
      this.speed = Math.max(0, this.speed + this.accS * dt);
      if (this.speed < 1e-4 && want <= 0) { this.speed = 0; if (this.accS < 0) this.accS = 0; }
    }
    // ---- heading: wanted yaw rate from the heading error, limited by the turning radius at speed
    let wantH = this.wantHeading;
    if (P.headingW > 0) wantH = this.wantHeading + angDiff(this.wantHeading, P.heading) * P.headingW;
    const err = angDiff(this.heading, wantH);
    const vmin = 0.6 * L;
    const yMax = Math.min(sp.turnRate * (1 + P.turnK), (Math.max(this.speed, vmin) / (sp.turnRadius * L)));
    const yr = clamp(err * 5, -yMax, yMax) + P.yawRate;
    this.yawRate = this.yawS.step(yr, 12 * (1 + P.turnK), dt);
    if (!this.air) this.heading += this.yawRate * dt;
    // ---- pitch and height: climb input, targets, clearance to the bed and the surface
    const r = this.depthRange(this.pos.x, this.pos.z, rng);
    let wantP = this.wantPitch;
    // look ahead: the bed rising in front makes the fish climb
    const la = L * 0.8 + this.speed * 0.5;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const r2 = this.depthRange(this.pos.x + fx * la, this.pos.z + fz * la, this._r2 || (this._r2 = {}));
    const lo = Math.max(r.lo, r2.lo), hi = Math.min(r.hi, r2.hi) < lo ? lo : Math.min(r.hi, r2.hi);
    if (this.targetY !== null) this.wantY = clamp(this.targetY, lo, hi);
    else if (Math.abs(this.wantVy) > 1e-4 || Math.abs(this.wantPitch) > 1e-3) this.wantY = this.pos.y;
    this.wantY = clamp(this.wantY ?? this.pos.y, lo, hi);
    // keep the height: pitch toward the wanted height at speed, hover up / down when slow
    const dyW = this.wantY - this.pos.y;
    const fast = smooth(0.15 * L, 0.8 * L, this.speed);
    if (Math.abs(this.wantPitch) < 1e-3) wantP = clamp(Math.atan2(dyW * 2, Math.max(L, this.speed * 1.2)), -0.5, 0.5) * fast;
    wantP = lerp(wantP, P.pitch, P.pitchW);
    // near the bed / surface limits, only allow pitching away from them
    if (this.pos.y <= lo + 0.02 * L) wantP = Math.max(wantP, 0);
    if (this.pos.y >= hi - 0.02 * L && !P.breach) wantP = Math.min(wantP, 0);
    this.pitch = this.air ? this.pitch : this.pitchS.step(wantP, 5 * (1 + P.pitchK), dt);
    // ---- velocity
    const cp = Math.cos(this.pitch), spn = Math.sin(this.pitch);
    const surf = this.surfaceAt(this.pos.x, this.pos.z);
    if (this.air) {
      // ballistic: the horizontal speed is kept, gravity bends the path, the body follows it
      this.vy -= 9.81 * dt;
      this.pitch = this.pitchS.step(Math.atan2(this.vy, Math.max(0.1 * L, this.vh)), 7, dt);
    } else {
      // hover: slow vertical swimming toward the wanted height (climb input when slow); settle / sink
      const hoverV = clamp(this.wantVy + dyW * 1.5 * (1 - fast), -cfg.hover, cfg.hover) * (1 - fast);
      const vyT = lerp(hoverV, P.vy, P.vyW);
      this.vy += (vyT - this.vy) * (1 - Math.exp(-dt * 4));
    }
    const hs = this.air ? this.vh : this.speed * cp;
    this.velocity.set(fx * hs, this.air ? this.vy : this.speed * spn + this.vy, fz * hs);
    this.velocity.x += P.push.x; this.velocity.z += P.push.z; this.velocity.y += P.push.y;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.addScaledVector(this.velocity, dt);
    // ---- shores: never swim into water shallower than the body (the move is undone; a push or an
    // action may still drive the fish there, it then stops at the edge)
    if (!this.air && this.water) {
      const need = this.swimDepth();
      const dN = this.waterDepth(this.pos.x, this.pos.z);
      if (dN < need && dN < this.waterDepth(ox, oz)) {
        this.pos.x = ox; this.pos.z = oz;
        this.speed *= Math.exp(-dt * 6);
      }
    }
    // ---- in / out of the water
    const top = this.pos.y + this.cAbove * 0.2;
    const gNow = this.groundAt(this.pos.x, this.pos.z);
    const wetNow = this.waterDepth(this.pos.x, this.pos.z);
    if (!this.air && top > surf && (P.breach || this.vy + this.speed * spn > 0.8 * L) && this.water) {
      this.air = true;
      this.vy = this.speed * spn + this.vy;
      this.vh = this.speed * cp;
      this.aimLeap(surf);
      this.emit('takeoff', { position: this.pos.clone(), speed: this.speed });
    } else if (this.air && this.pos.y - this.cBelow < gNow + 0.02 * L && wetNow < 0.5 * (this.cBelow + this.cAbove)) {
      // came down on dry ground (or in water too shallow to swim): beached
      this.air = false;
      this.beached = true;
      this.pos.y = Math.max(this.pos.y, gNow + this.cBelow);
      this.emit('beach', { position: this.pos.clone(), speed: Math.hypot(this.vy, this.vh) });
      this.speed = 0; this.vy = 0; this.vh = 0; this.accS = 0;
      this.actionsLayer.onLand?.();
      this._toWater = null; this._toWaterT = 0; this._strandSide = this.rand() < 0.5 ? -1 : 1;
      this.advancePhases(dt);
      return;
    } else if (this.air && this.pos.y < surf - this.cBelow * 0.3 && wetNow > 0) {
      this.air = false;
      this.emit('land', { position: this.pos.clone(), speed: Math.abs(this.vy), splash: true });
      this.actionsLayer.onLand?.();
      // continue along the current pitch with the same velocity; the water drag slows it (actions brake)
      const c2 = Math.max(0.3, Math.cos(this.pitch));
      this.speed = this.vh / c2;
      this.vy = this.vy - this.speed * Math.sin(this.pitch);
      this.accS = 0;
    }
    if (!this.air) {
      // soft limits: the controller should never get here, but a sinking corpse or a strong push can
      const rr = this.depthRange(this.pos.x, this.pos.z, rng);
      const loY = P.groundW > 0 ? lerp(rr.lo, rr.lo - cfg.clearance, P.groundW) : rr.lo;
      if (this.pos.y < loY) { this.pos.y += (loY - this.pos.y) * (1 - Math.exp(-dt * 10)); this.vy = Math.max(this.vy, 0); }
      if (this.pos.y > rr.hi && !P.breach && !P.surfaceOK) { this.pos.y += (rr.hi - this.pos.y) * (1 - Math.exp(-dt * 10)); this.vy = Math.min(this.vy, 0); }
    }
    // ---- bank into turns (+ action roll)
    const bank = clamp(-this.yawRate * Math.max(this.speed, 0.3 * L) / L * (sp.bankGain ?? 0.12), -sp.bank, sp.bank);
    this.roll = this.rollS.step(lerp(bank, P.roll, P.rollW), 4 * (1 + P.rollK), dt);
    this.advancePhases(dt);
  }

  // a leap out of the water comes down in water deep enough: the horizontal speed is cut so the
  // landing point (and half a body length past it) stays over deep water along the heading
  aimLeap(surf) {
    const L = this.cfg.L, g = 9.81, need = this.swimDepth();
    const yLand = surf - 0.3 * this.cBelow;
    const tF = (this.vy + Math.sqrt(Math.max(0, this.vy * this.vy + 2 * g * Math.max(0, this.pos.y - yLand)))) / g;
    if (!(tF > 1e-3) || !(this.vh > 0)) return;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const D = this.vh * tF, step = 0.2 * L;
    let ok = 0;
    for (let d = 0; d <= D + 1e-6; d += step) {
      if (this.waterDepth(this.pos.x + fx * (d + 0.5 * L), this.pos.z + fz * (d + 0.5 * L)) < need) break;
      ok = d;
    }
    if (ok < D) this.vh = Math.max(0, ok) / tF;
  }

  // beached: the body lies on the ground and flops (strong, slow tail beats, a rocking roll) while it
  // slides toward the nearest water; deep enough there, it swims on
  stepBeached(dt) {
    const cfg = this.cfg, L = cfg.L;
    const need = 0.6 * (this.cBelow + this.cAbove);
    this._toWaterT = (this._toWaterT || 0) - dt;
    if (!this._toWater || this._toWaterT <= 0) {
      this._toWater = this.nearestWater(need, 30 * L);
      this._toWaterT = 0.5;
    }
    const to = this._toWater;
    const alive = this.P.alive > 0.5;
    const flop = alive ? clamp(0.3 * L, 0.3, 1.2) : 0;
    if (to && alive) {
      const err = angDiff(this.heading, to.heading);
      this.yawRate = this.yawS.step(clamp(err * 2, -0.9, 0.9), 8, dt);
      this.heading += this.yawRate * dt;
      // slides toward the water (not only along the body: it flips and rolls its way there)
      this.pos.x += Math.sin(to.heading) * flop * dt;
      this.pos.z += Math.cos(to.heading) * flop * dt;
    } else this.yawRate = this.yawS.step(0, 8, dt);
    this.speed = flop;
    this.wantSpeed = 0;
    // lying on the ground (the skin clamp keeps it on the bed), level, rocking with the beats
    const g = this.groundAt(this.pos.x, this.pos.z);
    this.vy -= 9.81 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y < g + this.cBelow) { this.pos.y = g + this.cBelow; this.vy = 0; }
    this.pitch = this.pitchS.step(0, 5, dt);
    const side = (cfg.spec.strandRoll ?? 1.3) * this._strandSide;
    this.roll = this.rollS.step(side + (alive ? 0.3 * Math.sin(this.phase * Math.PI * 2) : 0), 6, dt);
    this.velocity.set(to && alive ? Math.sin(to.heading) * flop : 0, 0, to && alive ? Math.cos(to.heading) * flop : 0);
    // back in the water
    if (this.waterDepth(this.pos.x, this.pos.z) >= need) {
      this.beached = false;
      this.speed = flop; this.vy = 0; this.accS = 0;
      this.wantY = this.pos.y;
      this.emit('land', { position: this.pos.clone(), speed: flop, splash: true });
    }
    this.advancePhases(dt);
  }

  advancePhases(dt) {
    const cfg = this.cfg, P = this.P, L = cfg.L, sp = cfg.spec;
    const vbl = this.speed / L;
    const row = this._row || (this._row = new Float64Array(6));
    tableAt6(sp.wave, vbl, row);
    const fl = this.beached && P.alive > 0.5 ? 1 : 0;
    const f = row[0] * P.freqK + P.freqAdd + fl * 1.2;
    this.freqS.step(f, 8, dt);
    this.ampS.step(fl ? Math.max(row[1] * 2.2, 0.45) : row[1] * P.ampK * (this.air ? 0.6 : 1), 6, dt);
    this.lamS.step(row[2], 4, dt);
    this.pectS.step(row[3] * P.pectK, 5, dt);
    this.pfS.step(row[4], 4, dt);
    this.foldS.step(clamp(row[5] + P.fold, 0, 1), 6, dt);
    this.phase += Math.max(0, this.freqS.x) * dt;
    if (this.phase > 1e4) this.phase -= 1e4;
    this.pPhase += this.pfS.x * dt * (0.4 + 0.6 * this.pectS.x);
    const bRate = sp.breath.rate * P.breathRate * (1 + P.stress * 0.9);
    this.bPhase += bRate * dt;
    this.stressDecay(dt);
  }
  stressDecay(dt) { this.P.stress *= 1; void dt; }

  // ----------------------------------------------------------------- pose
  // Local chain: segment angles -> joint positions (spine0 at the origin; body frame x = left, y = up,
  // z = forward) -> centred on the mass centre.
  poseLocal(dt) {
    const cfg = this.cfg, n = cfg.n, P = this.P, L = cfg.L, sp = cfg.spec;
    const th = this.th, ph = this.ph, yw = this.yw, Q = this.Q, m = this.mass;
    const amp = dt > 0 ? this.ampS.x : 0, lam = Math.max(0.3, this.lamS.x);
    const phi = this.phase;
    // lateral wave displacement at each joint (0 = spine0 ... n = tail tip)
    for (let j = 0; j <= n; j++) {
      const u = cfg.uJ[j];
      yw[j] = 0.5 * amp * L * cfg.envJ[j] * Math.sin(TAU * (phi - u / lam));
    }
    // the caudal fin is a fairly stiff plate hinged at the peduncle: past the caudal base the wave
    // gives way to the peduncle's own slope (a thunniform tail is fully stiff)
    const jb = cfg.caudalStart, cs = sp.caudalStiff ?? 0.6;
    if (jb > 0 && jb < n && cs > 0) {
      const slope = (yw[jb] - yw[jb - 1]) / cfg.segLen[jb - 1];
      for (let j = jb + 1; j <= n; j++) yw[j] += (yw[jb] + slope * (cfg.sJ[j] - cfg.sJ[jb]) - yw[j]) * cs;
    }
    // steering bend (+ action C-bend) distributed over the flexible body, and the action arch
    const bend = dt > 0 ? this.bendS.x : 0, arch = dt > 0 ? this.archS.x : 0;
    let cum = 0, mean = 0;
    for (let i = 0; i < n; i++) {
      const dy = (yw[i + 1] - yw[i]) / cfg.segLen[i];
      th[i] = Math.asin(clamp(dy, -0.95, 0.95)) + cfg.restYaw[i];
      cum += bend * cfg.bendW[i];
      th[i] += cum - bend * cfg.bendW[i] * 0.5;
      ph[i] = cfg.restPitch[i] - arch * cfg.bendW[i] * n * (cfg.uJ[i] - 0.45) * 1.2 + P.droop * cfg.bendW[i] * n * Math.max(0, cfg.uJ[i] - 0.5);
      mean += th[i] * m[i];
    }
    // head: continues the first trunk segment, turned by the look yaw
    const headTh0 = th[0] - (P.headWave * (yw[1] - yw[0])) / cfg.segLen[0];
    mean += headTh0 * m[n];
    for (let i = 0; i < n; i++) th[i] -= mean;
    this.headTh = headTh0 - mean + (dt > 0 ? this.lookYawS.x + P.headShake : 0);
    this.headPh = cfg.headPitch + (dt > 0 ? this.lookPitchS.x + this.headLiftS.x : 0) + arch * 0.15;
    // integrate joint positions (backward from spine0)
    Q[0].set(0, 0, 0);
    for (let i = 0; i < n; i++) {
      const c = Math.cos(ph[i]);
      Q[i + 1].set(Q[i].x + cfg.segLen[i] * Math.sin(th[i]) * c, Q[i].y + cfg.segLen[i] * Math.sin(ph[i]), Q[i].z - cfg.segLen[i] * Math.cos(th[i]) * c);
    }
    const hc = Math.cos(this.headPh);
    Q[n + 1].set(-cfg.headLen * Math.sin(this.headTh) * hc, cfg.headLen * Math.sin(this.headPh), cfg.headLen * Math.cos(this.headTh) * hc);
    // mass centre
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += m[i] * (Q[i].x + Q[i + 1].x) * 0.5; cy += m[i] * (Q[i].y + Q[i + 1].y) * 0.5; cz += m[i] * (Q[i].z + Q[i + 1].z) * 0.5; }
    cx += m[n] * Q[n + 1].x * 0.5; cy += m[n] * Q[n + 1].y * 0.5; cz += m[n] * Q[n + 1].z * 0.5;
    for (let j = 0; j <= n + 1; j++) Q[j].set(Q[j].x - cx, Q[j].y - cy, Q[j].z - cz);
    this.bindCom = this.bindCom || new THREE.Vector3(cfg.chainJ[0].x + cx, cfg.chainJ[0].y + cy, cfg.chainJ[0].z + cz);
    void sp;
  }

  pose(dt) {
    const cfg = this.cfg, n = cfg.n, P = this.P, sp = cfg.spec, L = cfg.L;
    // ---- secondary springs
    const turnBend = clamp(this.yawRate / Math.max(this.speed, 0.5 * L) * L * 0.75, -sp.bend, sp.bend);
    this.bendS.step(turnBend * (1 - P.bendHold) + P.bend, 14 * (1 + P.bendK), dt);
    this.archS.step(P.arch, 7, dt);
    // look: the head turns only with the body; a little yaw from a slight bend, pitch from the body
    const lt = this.input.look || P.look;
    let lyaw = 0, lpit = 0;
    if (lt && P.lookW > 0) {
      const dx = lt.x - this.pos.x, dz = lt.z - this.pos.z, dy = lt.y - this.pos.y;
      lyaw = clamp(angDiff(this.heading, Math.atan2(dx, dz)), -0.6, 0.6) * 0.22 * P.lookW;
      lpit = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.5) * 0.15 * P.lookW;
      this.lookTarget.copy(lt);
      this.state.lookTarget = this.lookTarget;
    } else this.state.lookTarget = null;
    this.lookYawS.step(lyaw, 5, dt); this.lookPitchS.step(lpit, 5, dt);
    this.headLiftS.step(P.headLift, 14, dt);
    this.eyeRollS.step(P.eyeRoll, 22, dt); this.nictS.step(P.nictitate, 22, dt);
    this.poseLocal(dt);
    // ---- world basis: heading, pitch, roll
    const B = this.basis, h = this.heading, p = this.pitch, r = this.roll;
    const ch = Math.cos(h), shh = Math.sin(h), cp = Math.cos(p), spp = Math.sin(p);
    const F = B.F.set(shh * cp, spp, ch * cp);
    const L0 = _v1.set(ch, 0, -shh);
    const U0 = _v2.crossVectors(F, L0);
    const cr = Math.cos(r), sr = Math.sin(r);
    B.Lf.copy(L0).multiplyScalar(cr).addScaledVector(U0, sr);
    B.U.copy(U0).multiplyScalar(cr).addScaledVector(L0, -sr);
    const Q = this.Q, W = this.W, o = this.pos;
    for (let j = 0; j <= n + 1; j++) {
      const q = Q[j];
      W[j].set(o.x + q.x * B.Lf.x + q.y * B.U.x + q.z * F.x, o.y + q.x * B.Lf.y + q.y * B.U.y + q.z * F.y, o.z + q.x * B.Lf.z + q.y * B.U.z + q.z * F.z);
    }
    // lateral axes of the segments (body-local (cos th, 0, sin th)) and of the head
    for (let i = 0; i < n; i++) {
      const c = Math.cos(this.th[i]), s = Math.sin(this.th[i]);
      this.X[i].set(c * B.Lf.x + s * F.x, c * B.Lf.y + s * F.y, c * B.Lf.z + s * F.z);
    }
    {
      const c = Math.cos(this.headTh), s = Math.sin(this.headTh);
      this.X[n].set(c * B.Lf.x + s * F.x, c * B.Lf.y + s * F.y, c * B.Lf.z + s * F.z);
    }
    // ---- bed contact (lying, dead): conform the chain to the uneven bed
    if (P.conform > 0.001) this.conform(P.conform);
    // ---- write the chain
    for (let i = 0; i < n; i++) {
      this.D[i].copy(W[i + 1]).sub(W[i]);
      writeFrame(this.chainBoneObjs[i].matrixWorld, W[i], this.D[i], this.X[i]);
    }
    this.D[n].copy(W[n + 1]).sub(W[0]);
    writeFrame(this.bone.head.matrixWorld, W[0], this.D[n], this.X[n]);
    // ---- children: jaw, gill covers, fins
    this.poseChildren(dt);
    // ---- hard clamp: skin extents against the bed and the surface
    this.clampToWater();
    // ---- head pose (eyes, attachments)
    _m.multiplyMatrices(this.bone.head.matrixWorld, this._headLocal);
    this.headPose.position.setFromMatrixPosition(_m);
    this.headPose.quaternion.setFromRotationMatrix(this.bone.head.matrixWorld);
    const dbg = this.debug.targets;
    dbg[0].copy(W[n]); dbg[1].copy(W[n + 1]); dbg[2].copy(this.pos);
    if (this.state.lookTarget) dbg[3].copy(this.state.lookTarget);
  }

  conform(w) {
    const cfg = this.cfg, n = cfg.n, W = this.W;
    const dl = this._dl || (this._dl = new Float64Array(n + 2)), d2 = this._d2 || (this._d2 = new Float64Array(n + 2));
    // the body's lowest skin under each joint, from the bone extents in the current orientation
    for (let j = 0; j <= n + 1; j++) {
      const bi = j === n + 1 ? cfg.bIndex.head : cfg.bIndex[cfg.chainBones[Math.min(n - 1, j)]];
      const e = this.ext, oo = bi * 6;
      const X = j === n + 1 ? this.X[n] : this.X[Math.min(n - 1, j)];
      // local Z of the bone frame ~ X x Y; use the body up rotated with the roll
      const Z = _v3.crossVectors(X, j === n + 1 ? _v1.copy(W[n + 1]).sub(W[0]).normalize() : _v1.copy(W[Math.min(n, j + 1)]).sub(W[Math.min(n - 1, j)]).normalize());
      const below = Math.sqrt((e[oo + 1] * X.y) ** 2 + (e[oo + 5] * Z.y) ** 2) - (e[oo] * X.y + e[oo + 4] * Z.y);
      const g = this.groundAt(W[j].x, W[j].z);
      dl[j] = g + below + 0.004 * cfg.L - W[j].y;
    }
    // smooth the corrections along the chain (snout = n + 1 sits before spine0): no kinks
    for (let it = 0; it < 3; it++) {
      for (let j = 0; j <= n; j++) {
        const prev = j === 0 ? dl[n + 1] : dl[j - 1], next = j === n ? dl[n] : dl[j + 1];
        d2[j] = 0.25 * prev + 0.5 * dl[j] + 0.25 * next;
      }
      d2[n + 1] = 0.5 * dl[n + 1] + 0.5 * dl[0];
      for (let j = 0; j <= n + 1; j++) dl[j] = d2[j];
    }
    for (let j = 0; j <= n + 1; j++) W[j].y += dl[j] * w;
  }

  poseChildren(dt) {
    const cfg = this.cfg, P = this.P, sp = cfg.spec, L = cfg.L;
    const vbl = this.speed / L;
    // breathing: gill covers out, mouth open in counter-phase; fades with ram ventilation
    const ram = 1 - smooth(sp.breath.ram * 0.5, sp.breath.ram * 1.2, vbl) * 0.8;
    const b = Math.sin(TAU * this.bPhase);
    const bAmp = P.breathAmp * ram * (1 + P.stress * 0.8);
    const opT = (0.5 + 0.5 * b) * bAmp + P.opFlare;
    this.opS.step(opT, 18, dt);
    const gapeT = clamp((0.5 - 0.5 * b) * sp.breath.mouth * bAmp + P.gape, 0, 1.2);
    this.gapeS.step(gapeT, P.gapeFast ? 45 : 16, dt);
    this.protS.step(P.protrude, 30, dt);
    const D2R = Math.PI / 180;
    for (const k of this.kids) {
      const q = k.q.identity();
      k.t.set(0, 0, 0);
      if (k === this.jaw) {
        q.setFromAxisAngle(k.axes.open, this.gapeS.x * sp.jaw.gape * D2R);
      } else if (k === this.upperJaw) {
        const pd = sp.jaw.protrudeDir;
        if (pd) k.t.set(pd[0], pd[1], pd[2]); else k.t.set(0, -0.3, 1);
        k.t.normalize().multiplyScalar(this.protS.x * sp.jaw.protrude * L);
      } else if (k.axes.flare) {
        q.setFromAxisAngle(k.axes.flare, this.opS.x * sp.breath.operculum * D2R);
      } else if (k.axes.row) {
        // pectoral: sculling (flap + row + feather) when slow, folded at speed, flared to brake
        const pc = sp.pectoral, s = k.axes.s;
        const alt = s > 0 ? 0 : pc.alternate * 0.5;
        const ph = TAU * (this.pPhase + alt);
        const act = this.pectS.x * (1 - pc.stiff) * P.pectAmp;
        const fold = this.foldS.x;
        const turnIn = clamp(this.yawRate * s * 0.5, -1, 1); // inside fin of a turn flares
        const flare = clamp(this.flareS.step(Math.max(P.flare, P.brake * 0.9, turnIn * 0.5 * (1 - fold)), 10, dt), 0, 1.2);
        const ab = (pc.rest[0] * (1 - fold) - pc.fold * fold + pc.flap * act * Math.sin(ph) + (pc.flare - pc.rest[0]) * flare + P.pectAb) * D2R;
        const row = (pc.rest[1] + pc.row * act * Math.sin(ph + 1.3) + 20 * flare) * D2R;
        const fe = (pc.rest[2] + pc.feather * act * Math.cos(ph) + 30 * flare) * D2R;
        q.setFromAxisAngle(k.axes.ab, ab);
        q.multiply(_q.setFromAxisAngle(k.axes.row, row));
        q.multiply(_q.setFromAxisAngle(k.axes.long, fe * s));
      } else if (k.axes.ab) {
        // pelvic: spread when slow and braking, folded at speed
        const pv = sp.pelvic;
        const fold = this.foldS.x;
        if (k.axes.s > 0) this.pelS.step(20 * P.flare + P.pelvicAb, 8, dt);
        const ab = (pv.rest + pv.spread * (1 - fold) - pv.fold * fold + this.pelS.x + 3 * Math.sin(TAU * this.pPhase * 0.5) * this.pectS.x) * D2R;
        q.setFromAxisAngle(k.axes.ab, ab);
      }
      // M = parentWorld * A * T(t) * R * C0
      _m.makeRotationFromQuaternion(q);
      _m.multiply(k.C0);
      _m.setPosition(_m.elements[12] + k.t.x, _m.elements[13] + k.t.y, _m.elements[14] + k.t.z);
      k.bone.matrixWorld.multiplyMatrices(k.parent.matrixWorld, k.A).multiply(_m);
    }
  }

  // skin extents of every bone against the bed (and the surface when swimming)
  clampToWater() {
    const cfg = this.cfg, n = cfg.n, W = this.W, sk = this.sk, e = this.ext;
    if (this.lod >= 2 && (this.frame & 1)) { if (this.liftCarry) this.shiftAll(this.liftCarry); return; }
    // ground under the snout, the middle and the tail; interpolated along the body
    const gS = this.groundAt(W[n + 1].x, W[n + 1].z), gT = this.groundAt(W[n].x, W[n].z), gM = this.groundAt(this.pos.x, this.pos.z);
    const surf = this.air || this.beached ? Infinity : this.surfaceAt(this.pos.x, this.pos.z);
    const fx = W[n + 1].x - W[n].x, fz = W[n + 1].z - W[n].z;
    const fl2 = fx * fx + fz * fz || 1e-9;
    let need = -Infinity, over = -Infinity;
    const nb = this.nB;
    const margin = 0.002 * cfg.L;
    for (let b = 0; b < nb; b++) {
      const me = sk.bones[b].matrixWorld.elements, oo = b * 6;
      if (e[oo + 1] === 0 && e[oo + 5] === 0) continue;
      // centre of the skin box in world, and the vertical half extent (elliptic in X/Z, box along Y)
      const cx = e[oo], cy = e[oo + 2], cz = e[oo + 4];
      const wy = me[13] + cx * me[1] + cy * me[5] + cz * me[9];
      // chain bones: elliptic cross-section; fins and head parts: box (flat fans reach their corners)
      const half = this.isChain[b] ? Math.sqrt((e[oo + 1] * me[1]) ** 2 + (e[oo + 5] * me[9]) ** 2) + Math.abs(e[oo + 3] * me[5])
        : Math.abs(e[oo + 1] * me[1]) + Math.abs(e[oo + 3] * me[5]) + Math.abs(e[oo + 5] * me[9]);
      const wx = me[12] + cx * me[0] + cy * me[4] + cz * me[8], wz = me[14] + cx * me[2] + cy * me[6] + cz * me[10];
      const t = clamp(((wx - W[n].x) * fx + (wz - W[n].z) * fz) / fl2, 0, 1);
      // along the body the bed is interpolated from three samples; fins and head parts stick out
      // sideways (on a slope that matters when lying on the side), so they sample their own spot
      const g = !this.isChain[b] && this.lod === 0 ? this.groundAt(wx, wz) : t < 0.5 ? lerp(gT, gM, t * 2) : lerp(gM, gS, t * 2 - 1);
      const d = g + margin - (wy - half);
      if (d > need) need = d;
      const u = wy + half - (surf - margin);
      if (u > over) over = u;
    }
    let shift = 0;
    if (need > 0) shift = need;
    else if (over > 0 && !this.P.breach && !this.P.surfaceOK) shift = -Math.min(over, -need);
    this.liftCarry = shift;
    if (shift !== 0) {
      this.shiftAll(shift);
      this.pos.y += shift;
      if (shift > 0) this.vy = Math.max(this.vy, 0); else this.vy = Math.min(this.vy, 0);
    }
  }
  shiftAll(dy) {
    for (const b of this.sk.bones) b.matrixWorld.elements[13] += dy;
    for (const w of this.W) w.y += dy;
  }

  // ----------------------------------------------------------------- state
  publish() {
    const st = this.state, cfg = this.cfg, L = cfg.L;
    st.heading = this.heading;
    st.speed = this.speed;
    st.pitch = this.pitch; st.roll = this.roll;
    const vbl = this.speed / L;
    let g = 'stand';
    if (vbl > 0.08) {
      const G = cfg.gears;
      const names = this.gaits;
      g = names[0];
      for (let i = 1; i < names.length; i++) if (this.speed > (G[names[i - 1]] + G[names[i]]) / 2) g = names[i];
    }
    st.stats.gait = g;
    st.stats.freq = Math.max(0.05, this.freqS.x);
    st.gait = this.air ? 'jump' : this.beached ? 'flop' : g;
    st.grounded = !this.air;
    st.inWater = !this.air && !this.beached;
    st.beached = this.beached;
    const s = this.surfaceY;
    st.depth = Number.isFinite(s) ? s - this.pos.y : Infinity;
    st.breaching = this.air || this.P.breach > 0.01 || this.P.surfaceOK > 0.01;
    st.eyelid = 0;
    st.eyeRoll = clamp(this.eyeRollS.x, 0, 1);
    st.nictitate = clamp(this.nictS.x, 0, 1);
    st.action = this.actionsLayer.current();
    st.posture = this.actionsLayer.posture;
  }
}

// row lookup: rows [v, a, b, c, d, e, f] -> out[0..5], smoothstep blend
function tableAt6(rows, v, out) {
  let i = 0;
  while (i < rows.length - 2 && v > rows[i + 1][0]) i++;
  const a = rows[i], b = rows[Math.min(i + 1, rows.length - 1)];
  const t = b === a ? 0 : clamp((v - a[0]) / (b[0] - a[0]), 0, 1);
  const s = t * t * (3 - 2 * t);
  for (let k = 0; k < 6; k++) out[k] = lerp(a[k + 1], b[k + 1], k === 0 ? t : s);
  return out;
}
void tv; void _v3; void _m2; void _q2;
