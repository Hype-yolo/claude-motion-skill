// Snake motion engine: path-following lateral undulation over uneven terrain, a curvature-space pose
// layer for everything that leaves the path (raised forebody, strike S-coil, flinch, writhing), a
// scripted-path coil, head / jaw / tongue / fang / rattle control, and the snake action set.
//
// Locomotion. A virtual leader (the occiput, joint v0) moves along a serpentine path: a centre point
// C travels at the commanded speed and heading, and the leader swings about it,
//   leader = C + left(heading) * A * sin(phi),   phi += 2 pi dx / lambda
// with amplitude A and wavelength lambda from the gait table (springs in the travelled distance, so
// the path is C1 whatever the speed does; A starts from 0 when a snake sets off, so the new path
// leaves exactly along its neck). The leader lays a trail on the terrain (a ring buffer of ground
// points parameterised by arc length); every spine joint sits on the trail at its arc distance behind
// the leader (non-uniform Catmull-Rom interpolation), lifted along the ground normal by its axis
// height. So the body follows the head's path exactly (no lateral slip), hugs the ground and cannot
// float or sink. Turns are rate limited (min radius, and so the leader never moves backwards).
// state.position is C (the smooth centre of the wave, the point games follow / steer).
//
// Pose layer. Actions write, per joint, a lift above the ground, a yaw offset per segment and a roll.
// The body is then re-integrated segment by segment from the head in the horizontal plane (exact
// segment lengths: a lifted segment gets shorter horizontally) and translated so that the joints the
// actions leave alone stay exactly on the trail (weighted fit). Heights always come from the terrain:
// y = ground + axis height (+ lift), so lifted parts never go below it. A coil is not a pose but a
// scripted path: the leader crawls an inward Archimedean spiral (curvature integrated along arc
// length) and the body follows it into a flat coil. When a posture that changed the body shape ends
// ('stand'), the current shape is baked into the trail, so the snake crawls off along its own body.
// Self-contact: a part of the body that crosses over another rides on top of it (anterior over
// posterior), with a smooth ramp along the chain.
//
// Lessons kept from the cheetah: continuous solves (nothing jumps between frames; weights and poses
// are smooth functions of time), motion from phase (the wave is a function of travelled distance),
// springs for secondary motion (head, jaw), zero-dt safety, no allocations in hot paths.
//
// Bones (core/rig/snake.js): head (v0 -> nose), jaw, tongue, tongueTip, fang, spine0..spineN-1
// (v0 -> vN). Joint vi's bind height is its axis height above the belly.
//
// ------------------------------------------------------------------------------------------------
// species.motion schema (reference size; lengths x total length TL where marked)
// ------------------------------------------------------------------------------------------------
// maxSpeed m/s, accel m/s^2, decel m/s^2, turnRate rad/s, minTurnRadius (x TL)
// gears   { name: speed }  named speeds (crawl, slither, dash ...)
// gaits   [{ name, v, wave (x TL), amp (x TL), headLift (m), stab (0..1 head yaw stabilisation) }]
//         sorted by v; rows are blended by speed
// body    { neck: x TL (part raised to look around), forebody: x TL (part used by strikes) }
// tongue  { rate: flicks per s at idle, length: extension (x head length), flicks: [min, max] tip
//         oscillations per flick, freq: tip oscillation Hz }
// breath  { rate Hz, roll rad }
// actions { strike: { reach (x TL), speed (m/s), gape (deg), coilHeight (x TL), rise (x TL) },
//           coil: { pitch (ring spacing / body width), speed (m/s) }, sit: { raise (x TL) },
//           eat: { swallow (s) }, drink: { pumps } }
// variants { <params.variant>: { speedK, ampK, strike: {...}, rattle: bool } }  per-variant overrides
// ------------------------------------------------------------------------------------------------
// Contract extras: state.contacts = [{ key: 'v<i>', contact, position }] (ground contact of every
// spine joint; contact = lying on the ground), motion.chain (spine bone indices, head -> tail),
// state.stats.freq (undulation frequency), state.posture, events attackHit / actionStart /
// actionEnd / death / arrive. Actions: idle, stand, sit (alert coil, head raised), lie (stretch out),
// sleep (resting coil), coil, strike = attack, jump (a forward lunge), eat (strike + swallow), drink,
// hit (flinch and whip away), death (writhe, go limp, roll half belly-up).
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, angDiff, Spring, prng, writeFrame } from './common.js';

const DEFAULTS = {
  maxSpeed: 0.8, accel: 0.9, decel: 1.6, turnRate: 2.2, minTurnRadius: 0.1,
  body: { neck: 0.12, forebody: 0.3 },
  tongue: { rate: 0.6, length: 0.6, flicks: [3, 6], freq: 7.5 },
  breath: { rate: 0.28, roll: 0.03 },
};
const STRIKE = { reach: 0.33, speed: 2.8, gape: 75, coilHeight: 0.07, rise: 0.12 };
const POSTURES = ['sit', 'lie', 'sleep', 'death', 'coil'];
const COILED = { sit: 1, sleep: 1, coil: 1 };

const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const h2 = (a, b) => Math.sqrt(a * a + b * b);
const h3 = (a, b, c) => Math.sqrt(a * a + b * b + c * c);
const _X = new THREE.Vector3(1, 0, 0), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------------------------------------------
// Trail: ground points by arc length (ring buffer), newest point = the leader
// ------------------------------------------------------------------------------------------------
class Trail {
  constructor(cap) {
    this.cap = cap;
    this.x = new Float64Array(cap); this.y = new Float64Array(cap); this.z = new Float64Array(cap); this.s = new Float64Array(cap);
    this.o = 0; this.n = 0; this.ver = 0; this.hit = 0;
  }
  clear() { this.o = 0; this.n = 0; this.ver++; }
  // linear storage: logical k lives at o + k; when the end is reached the newest half moves to the front
  idx(k) { return this.o + k; }
  push(x, y, z, s) {
    this.ver++;
    if (this.o + this.n === this.cap) {
      const keep = this.n >> 1, from = this.o + this.n - keep;
      this.x.copyWithin(0, from, from + keep); this.y.copyWithin(0, from, from + keep);
      this.z.copyWithin(0, from, from + keep); this.s.copyWithin(0, from, from + keep);
      this.o = 0; this.n = keep;
    }
    const i = this.o + this.n;
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.s[i] = s;
    this.n++;
  }
  get lastS() { return this.s[this.o + this.n - 1]; }
  // leader moved: update the provisional newest point, commit it once it is `spacing` from the one before
  lead(x, y, z, spacing) {
    const a = this.o + this.n - 1, b = a - 1;
    const ax = x - this.x[a], ay = y - this.y[a], az = z - this.z[a];
    if (ax * ax + ay * ay + az * az < 1e-18) return;
    const bx = x - this.x[b], by = y - this.y[b], bz = z - this.z[b];
    const db = Math.sqrt(bx * bx + by * by + bz * bz);
    if (db >= spacing) this.push(x, y, z, this.s[a] + Math.sqrt(ax * ax + ay * ay + az * az));
    else { this.x[a] = x; this.y[a] = y; this.z[a] = z; this.s[a] = this.s[b] + db; this.ver++; }
  }
  // position at arc s (Hermite with finite-difference tangents: C1 for any spacing); beyond the
  // oldest point the trail is extended straight. `hint`: a nearby logical segment (walk from it).
  sample(s, out, hint = -1) {
    const n = this.n, o = this.o, X = this.x, Y = this.y, Z = this.z, S = this.s;
    this.hit = 0;
    if (s <= S[o]) {
      const i0 = o, i1 = o + 1, k = (s - S[i0]) / (S[i1] - S[i0] || 1e-9);
      out[0] = X[i0] + (X[i1] - X[i0]) * k; out[1] = Y[i0] + (Y[i1] - Y[i0]) * k; out[2] = Z[i0] + (Z[i1] - Z[i0]) * k;
      return out;
    }
    const iN = o + n - 1;
    if (s >= S[iN]) { out[0] = X[iN]; out[1] = Y[iN]; out[2] = Z[iN]; this.hit = n - 2; return out; }
    let lo;
    if (hint >= 0 && hint < n - 1) {
      lo = hint;
      while (lo > 0 && S[o + lo] > s) lo--;
      while (lo < n - 2 && S[o + lo + 1] <= s) lo++;
    } else {
      lo = 0; let hi = n - 1;
      while (hi - lo > 1) { const md = (lo + hi) >> 1; if (S[o + md] <= s) lo = md; else hi = md; }
    }
    this.hit = lo;
    const a = o + lo, b = a + 1;
    const h = S[b] - S[a] || 1e-9, u = (s - S[a]) / h;
    // tangents per unit arc at a and b from their neighbours
    const a0 = lo > 0 ? a - 1 : a, b1 = lo + 2 < n ? b + 1 : b;
    const da = S[b] - S[a0] || 1e-9, db = S[b1] - S[a] || 1e-9;
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = ((u3 - 2 * u2 + u) * h) / da, h01 = -2 * u3 + 3 * u2, h11 = ((u3 - u2) * h) / db;
    out[0] = h00 * X[a] + h10 * (X[b] - X[a0]) + h01 * X[b] + h11 * (X[b1] - X[a]);
    out[1] = h00 * Y[a] + h10 * (Y[b] - Y[a0]) + h01 * Y[b] + h11 * (Y[b1] - Y[a]);
    out[2] = h00 * Z[a] + h10 * (Z[b] - Z[a0]) + h01 * Z[b] + h11 * (Z[b1] - Z[a]);
    return out;
  }
}
const S3 = new Float64Array(3);

// ------------------------------------------------------------------------------------------------
export function createSnakeMotion(ctx) { return new SnakeMotion(ctx); }

export class SnakeMotion {
  constructor({ species, data, skeleton, ground, water, position, heading = 0, emit }) {
    this.species = species;
    this.sk = skeleton;
    this.ground = ground || (() => 0);
    this.water = water || null;
    this.emit = emit || (() => {});
    this.rand = prng((data.seed || 1) * 7919 + 29);
    this.seed = data.seed || 1;
    const params = data.params || {};
    const spec = species.motion || {};
    const vk = (spec.variants && spec.variants[params.variant]) || {};
    this.viper = params.variant === 'rattlesnake';
    // ---- skeleton
    const J = {};
    for (const [k, v] of Object.entries(data.joints)) J[k] = new THREE.Vector3(v[0], v[1], v[2]);
    this.J = J;
    let N = 0;
    while (J['v' + (N + 1)]) N++;
    this.N = N;
    const bi = {};
    data.bones.forEach((b, i) => { bi[b.name] = i; });
    this.bi = bi;
    this.spine = Array.from({ length: N }, (_, i) => skeleton.bones[bi['spine' + i]]);
    this.chain = Array.from({ length: N }, (_, i) => bi['spine' + i]);
    this.bHead = skeleton.bones[bi.head]; this.bJaw = skeleton.bones[bi.jaw];
    this.bTongue = skeleton.bones[bi.tongue]; this.bTip = skeleton.bones[bi.tongueTip]; this.bFang = skeleton.bones[bi.fang];
    const bind = (n) => skeleton.bind[bi[n]];
    this.bindHead = bind('head'); this.bindJaw = bind('jaw'); this.bindTongue = bind('tongue'); this.bindTip = bind('tongueTip'); this.bindFang = bind('fang');
    // ---- dimensions
    const s = params.size || 1;
    this.s = s;
    this.sq = Math.sqrt(s);
    this.len = new Float64Array(N); this.sig = new Float64Array(N + 1); this.r = new Float64Array(N + 1); this.hw = new Float64Array(N + 1);
    const flat = spec.flat || (params.variant === 'rattlesnake' ? 0.64 : 0.74);
    for (let i = 0; i < N; i++) { this.len[i] = J['v' + i].distanceTo(J['v' + (i + 1)]); this.sig[i + 1] = this.sig[i] + this.len[i]; }
    for (let i = 0; i <= N; i++) { this.r[i] = J['v' + i].y; this.hw[i] = this.r[i] / flat; }
    this.bodyLen = this.sig[N];
    // support of each body cross-section toward the ground as a function of roll, measured on the
    // bind mesh (vertices skinned mostly to the bone that starts at the joint): the body can lie on its
    // side or back on any terrain without sinking in or floating
    {
      const NA = (this.supN = 48), tab = (this.supTab = new Float32Array((N + 1) * NA)), idx = new Int16Array(data.bones.length).fill(-1);
      for (let i = 0; i < N; i++) idx[bi['spine' + i]] = i;
      for (let v = 0; v < data.nV; v++) {
        if (data.skinWeight[v * 4] < 0.4) continue;
        const i = idx[data.skinIndex[v * 4]];
        if (i < 0) continue;
        const z = data.pos[v * 3 + 2];
        // only the body's own section (not a rattle or other rigid ornament beyond the joints)
        if (z > J['v' + i].z + 0.3 * this.len[i] || z < J['v' + (i + 1)].z - 0.3 * this.len[i]) continue;
        const x = data.pos[v * 3], y = data.pos[v * 3 + 1] - J['v' + i].y;
        for (let k = 0; k < NA; k++) {
          const ro = -Math.PI + (TAU * k) / NA;
          const d = -(x * Math.sin(ro) + y * Math.cos(ro));
          if (d > tab[i * NA + k]) tab[i * NA + k] = d;
        }
      }
      for (let k = 0; k < NA; k++) tab[N * NA + k] = tab[(N - 1) * NA + k];
      // sections with no data (none expected): the analytic loaf
      for (let i = 0; i <= N; i++) if (tab[i * NA + (NA >> 1)] <= 0) for (let k = 0; k < NA; k++) tab[i * NA + k] = J['v' + i].y;
    }
    this.headLen = J.nose.distanceTo(J.v0);
    this.TL = this.bodyLen + this.headLen;
    let hwMax = 0; for (let i = 0; i <= N; i++) hwMax = Math.max(hwMax, this.hw[i]);
    this.hwMax = hwMax;
    this.restCurl = spec.restCurl ?? 1;
    // ---- config
    const m = (a, b) => ({ ...a, ...(b || {}) });
    const speedK = (vk.speedK ?? 1) * this.sq;
    this.cfg = {
      maxSpeed: vk.maxSpeed !== undefined ? vk.maxSpeed * this.sq : (spec.maxSpeed ?? DEFAULTS.maxSpeed) * speedK,
      accel: (spec.accel ?? DEFAULTS.accel) * this.sq, decel: (spec.decel ?? DEFAULTS.decel) * this.sq,
      turnRate: (spec.turnRate ?? DEFAULTS.turnRate) / this.sq,
      minR: (spec.minTurnRadius ?? DEFAULTS.minTurnRadius) * this.TL,
      body: m(DEFAULTS.body, spec.body), tongue: m(m(DEFAULTS.tongue, spec.tongue), vk.tongue), breath: m(DEFAULTS.breath, spec.breath),
      actions: spec.actions || {},
      strike: m(m(STRIKE, spec.actions?.strike), vk.strike),
      rattle: !!vk.rattle,
      ampK: vk.ampK ?? 1,
    };
    // a variant may bring its own gait table / gears (reference speeds, not scaled by speedK)
    const G = vk.gaits || (spec.gaits && spec.gaits.length ? spec.gaits : [{ name: 'slither', v: 0, wave: 0.42, amp: 0.07, headLift: 0.008, stab: 0.6 }]);
    const gK = vk.gaits ? this.sq : speedK, aK = vk.gaits ? 1 : this.cfg.ampK;
    this.gaitRows = G.map((g) => [g.v * gK, g.wave, g.amp * aK, g.headLift * s, g.stab ?? 0.6]);
    this.gaitNames = G.map((g) => g.name);
    this.gaits = [...new Set(this.gaitNames)];
    this.gears = vk.gears ? Object.fromEntries(Object.entries(vk.gears).map(([k, v]) => [k, v * this.sq])) : spec.gears ? Object.fromEntries(Object.entries(spec.gears).map(([k, v]) => [k, v * speedK])) : { slither: 0.25 * speedK };
    this.cfg.tailCarry = (vk.tailCarry ?? 0) * s;
    this._row = [0, 0, 0, 0];
    // ---- bind-space head landmarks (for ground clearance and attachments)
    this.v0b = J.v0.clone();
    this.noseB = J.nose.clone();
    this.chinB = J.jawTip.clone(); this.chinB.y = 0.0005 * s;
    this.hingeB = J.jawHinge.clone();
    // outer corner of the lower jaw (bind), for ground clearance when the head rolls
    this.jawCorner = new THREE.Vector3(0, 0.0005 * s, J.jawHinge.z);
    this.jawMid = new THREE.Vector3(0, 0.0005 * s, lerp(J.jawHinge.z, J.jawTip.z, 0.55));
    { const jb = bi.jaw; let mx = 0; for (let v = 0; v < data.nV; v++) if (data.skinIndex[v * 4] === jb && data.skinWeight[v * 4] > 0.5 && Math.abs(data.pos[v * 3]) > mx) { mx = Math.abs(data.pos[v * 3]); this.jawCorner.z = data.pos[v * 3 + 2]; } this.jawCorner.x = mx; this.jawMid.x = 0.5 * mx; }
    this.tongueBaseB = J.tongueBase.clone(); this.tongueForkB = J.tongueFork.clone();
    this.tongueDirB = J.tongueFork.clone().sub(J.tongueBase).normalize();
    this.fangBaseB = J.fangBase.clone();
    this.tipLen = J.tongueTip.distanceTo(J.tongueFork);
    // ---- public contract
    this.input = { speed: 0, heading, climb: 0, look: null, follow: null, target: null, targetSpeed: 0.3, crouch: 0, gait: null };
    this.pos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = heading;
    this.speed = 0;
    this.yawRate = 0;
    this.time = 0;
    this.lod = 0;
    this.frame = 0; this._acc = 0; this._posed = false;
    this.lookTarget = new THREE.Vector3();
    this.state = {
      position: this.pos, heading, speed: 0, velocity: this.velocity, gait: 'stand', grounded: true,
      action: null, posture: 'stand', eyelid: 0, lookTarget: null,
      stats: { gait: 'stand', freq: 0, duty: 1 },
      legs: [],
      contacts: Array.from({ length: N + 1 }, (_, i) => ({ key: 'v' + i, contact: true, position: new THREE.Vector3() })),
    };
    this.headPose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
    this.debug = { targets: Array.from({ length: 6 }, () => new THREE.Vector3()) };
    this.actions = ['idle', 'stand', 'sit', 'lie', 'sleep', 'coil', 'eat', 'drink', 'attack', 'strike', 'jump', 'hit', 'death'];
    // ---- locomotion state
    this.trail = new Trail(2048);
    this.C = new THREE.Vector3();
    this.leader = new THREE.Vector3();
    this.x = 0; this.phi = 0;
    this.A = new Spring(0); this.lam = new Spring(0.42 * this.TL);
    this.reseed = true;
    this.script = null; // scripted leader path (coil)
    this.follow = { init: false, p: new THREE.Vector3() };
    this.pursuit = { on: false, psi: 0, dx: 0, dz: 0, follow: false };
    // ---- per-joint arrays
    const F = (n) => new Float64Array(n);
    this.gx = F(N + 1); this.gy = F(N + 1); this.gz = F(N + 1); // base ground points (trail)
    this.nx = F(N + 1); this.ny = F(N + 1); this.nz = F(N + 1); // ground normals
    this.px = F(N + 1); this.py = F(N + 1); this.pz = F(N + 1); // final axis points
    this.hx = F(N + 1); this.hz = F(N + 1);
    this.byaw = F(N); this.byawU = F(N); this.blh = F(N); this.bch = F(N); this.bsin = F(N); // base segment yaw, horizontal length, chord, elevation sine
    this.lift = F(N + 1); this.dyaw = F(N); this.roll = F(N + 1); this.affect = F(N + 1); this.stack = F(N + 1); this.stackTmp = F(N + 1);
    this.grid = { head: new Int16Array(256), next: new Int16Array(N + 1) };
    this.lat = Array.from({ length: N }, () => new THREE.Vector3());
    this.contact = new Uint8Array(N + 1);
    // ---- head & secondary springs
    this.hYaw = new Spring(0); this.hPitch = new Spring(0); this.hRoll = new Spring(0);
    this.gape = new Spring(0); this.fang = new Spring(0);
    this.tongue = { t: 0, dur: 0, next: 1 + this.rand() * 2, osc: 4, ext: new Spring(0), tipS: new Spring(0), pitchS: new Spring(0), pitch: 0, tip: 0, extD: 0 };
    this.qHead = new THREE.Quaternion();
    this.Tm = new THREE.Matrix4(); // head-rigid transform: bind space -> world
    this._headInit = false;
    // ---- actions
    this.P = makePose(N);
    this.layer = new SnakeActions(this);
    this.attachmentPoints = this._attachments(data);
    this.reset(position || new THREE.Vector3(), heading);
  }

  _attachments(data) {
    const J = this.J;
    const at = (bone, p) => {
      const i = data.bones.findIndex((b) => b.name === bone);
      if (i < 0) return null;
      const inv = this.sk.inverses ? this.sk.inverses[i] : this.sk.bind[i].clone().invert();
      return { bone, local: new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).premultiply(inv) };
    };
    let headP = J.v0.clone().lerp(J.nose, 0.55);
    if (data.eyes?.length) { headP = new THREE.Vector3(); for (const e of data.eyes) headP.add(new THREE.Vector3(...e.c)); headP.multiplyScalar(1 / data.eyes.length); }
    const mid = this.N >> 1;
    const back = J['v' + mid].clone(); back.y += this.hw[mid];
    const out = { mouth: at('head', J.nose.clone().lerp(J.jawTip, 0.5)), head: at('head', headP), back: at('spine' + mid, back) };
    for (const k of Object.keys(out)) if (!out[k]) delete out[k];
    return out;
  }

  // ----------------------------------------------------------------- terrain
  terrainH(x, z) { const h = this.ground(x, z); return Number.isFinite(h) ? h : 0; }
  terrainN(x, z, out) {
    const e = 0.05 * this.s, h0 = this.terrainH(x, z);
    out[0] = h0 - this.terrainH(x + e, z); out[1] = e; out[2] = h0 - this.terrainH(x, z + e);
    const l = h3(out[0], out[1], out[2]);
    out[0] /= l; out[1] /= l; out[2] /= l;
    return out;
  }

  /** Lay the body straight behind p along `heading` (bind layout). */
  reset(p, heading = this.heading) {
    const N = this.N, tr = this.trail;
    tr.clear();
    // rest in a loose S behind the head (curvature integrated backwards along the body)
    const extra = 0.25 * this.TL;
    const total = this.bodyLen + extra;
    const step = 0.01 * this.s;
    const nPts = Math.ceil(total / step) + 1;
    const X = new Float64Array(nPts), Z = new Float64Array(nPts);
    let x = p.x, z = p.z, psi = heading;
    const rr = prng(Math.imul(this.seed || 1, 2654435761) ^ 0x5bd1e995), ph = rr() * TAU;
    const lam = (0.42 + 0.16 * rr()) * this.TL, amp = (0.3 + 0.45 * rr()) * this.restCurl;
    for (let k = 0; k < nPts; k++) {
      X[k] = x; Z[k] = z;
      const d = k * step;
      const a = heading + amp * (Math.sin((TAU * d) / lam + ph) - Math.sin(ph)) * smooth(0.02 * this.TL, 0.15 * this.TL, d) * (1 - smooth(this.bodyLen, total, d));
      psi = a;
      x -= Math.sin(psi) * step; z -= Math.cos(psi) * step;
    }
    let s = 0, lx = 0, ly = 0, lz = 0;
    for (let k = nPts - 1; k >= 0; k--) {
      const y = this.terrainH(X[k], Z[k]);
      if (k < nPts - 1) s += h3(X[k] - lx, y - ly, Z[k] - lz);
      tr.push(X[k], y, Z[k], s);
      lx = X[k]; ly = y; lz = Z[k];
    }
    this.heading = heading; this.input.heading = heading;
    this.speed = 0; this.yawRate = 0; this.velocity.set(0, 0, 0);
    this.C.set(p.x, this.terrainH(p.x, p.z), p.z);
    this.leader.copy(this.C);
    this.pos.copy(this.C);
    this.x = 0; this.phi = 0; this.A.reset(0); this.lam.reset(0.42 * this.TL);
    this.reseed = true;
    this.script = null;
    this._headInit = false;
    this.follow.init = false;
    this.pursuit.on = false;
  }

  // ----------------------------------------------------------------- public API
  play(name, opts) { return this.layer.play(name, opts || {}); }
  stop(name) { this.layer.stop(name); }
  setLod(level) { this.lod = clamp(level | 0, 0, 2); return this; }
  dispose() { this.layer.clear(); }

  update(dt) {
    if (!(dt > 1e-4) || !Number.isFinite(dt)) dt = 1e-4;
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    this.drive(dt);
    this.locomote(dt);
    // crowd LOD: the pose is solved at half rate (the simulation still runs every frame)
    this.frame = (this.frame + 1) | 0;
    if (this.lod < 2 || (this.frame & 1) === 0 || !this._posed) {
      this.basePose();
      this.layer.update(dt + this._acc);
      this.solveBody();
      this.solveHead(this._acc + dt);
      this._acc = 0;
      this._posed = true;
    } else { this._acc += dt; }
    this.publish();
  }

  // ----------------------------------------------------------------- steering
  drive(dt) {
    const inp = this.input, cfg = this.cfg;
    this.wantSpeed = clamp(inp.speed || 0, 0, cfg.maxSpeed);
    this.wantHeading = inp.heading ?? this.heading;
    if (inp.target && !inp.follow) {
      const dx = inp.target.x - this.pos.x, dz = inp.target.z - this.pos.z;
      const d = h2(dx, dz);
      const stopR = 0.08 * this.TL + 0.1 * this.speed;
      if (d < stopR) { inp.target = null; inp.speed = 0; this.wantSpeed = 0; this.emit('arrive', {}); }
      else {
        const want = Math.atan2(dx, dz);
        inp.heading = want; this.wantHeading = want;
        const brake = Math.sqrt(Math.max(0, 2 * cfg.decel * 0.7 * (d - stopR)));
        this.wantSpeed = Math.min(inp.targetSpeed || 0.3, cfg.maxSpeed, brake + 0.03);
      }
    }
    if (this.layer.holdsStill()) {
      if ((this.wantSpeed > 0.01 || inp.follow) && !this.layer.dead()) this.layer.requestStand();
      this.wantSpeed = 0;
    }
  }

  gaitAt(v) {
    const R = this.gaitRows;
    let i = 0;
    while (i < R.length - 2 && v > R[i + 1][0]) i++;
    const a = R[i], b = R[Math.min(i + 1, R.length - 1)];
    const t = a === b ? 0 : smooth(0, 1, (v - a[0]) / (b[0] - a[0]));
    const o = this._row;
    for (let k = 0; k < 4; k++) o[k] = lerp(a[k + 1], b[k + 1], t);
    this.gaitName = t < 0.5 ? this.gaitNames[i] : this.gaitNames[Math.min(i + 1, R.length - 1)];
    return o;
  }

  // ----------------------------------------------------------------- locomotion
  locomote(dt) {
    const inp = this.input, cfg = this.cfg, P = this.P;
    const tr = this.trail;
    const spacing = 0.005 * this.s;
    if (this.script) { this.runScript(dt, spacing); return; }
    const following = !!inp.follow && !this.layer.holdsStill();
    let v, dx;
    if (following) {
      const f = inp.follow, fv = f.velocity;
      const vx = fv ? fv.x : 0, vz = fv ? fv.z : 0;
      const sp = h2(vx, vz);
      const fp = this.follow.p;
      if (!this.follow.init) { fp.set(f.position.x, 0, f.position.z); this.follow.init = true; this.reseed = false; this.A.reset(0); }
      // alpha-beta filter: the given velocity carries it, the position pulls gently (physics jitter)
      const ox = fp.x, oz = fp.z;
      fp.x += vx * dt; fp.z += vz * dt;
      const k = 1 - Math.exp(-dt / 0.06);
      fp.x += (f.position.x - fp.x) * k; fp.z += (f.position.z - fp.z) * k;
      v = sp;
      let hT = f.heading ?? (sp > 0.02 * this.sq ? Math.atan2(vx, vz) : this.heading);
      this.turn(hT, v, dt);
      const Fx = Math.sin(this.heading), Fz = Math.cos(this.heading);
      dx = Math.max(0, (fp.x - ox) * Fx + (fp.z - oz) * Fz);
      this.C.x = fp.x; this.C.z = fp.z;
      this.speed = v;
      this.velocity.set(vx, 0, vz);
    } else {
      this.follow.init = false;
      const vT = this.wantSpeed * P.speedScale;
      const acc = vT > this.speed ? cfg.accel : cfg.decel;
      this.speed += clamp(vT - this.speed, -acc * dt, acc * dt);
      if (this.speed < 1e-4 && vT <= 0) this.speed = 0;
      v = this.speed;
      if (v > 0 && this.reseed) this.startMoving();
      this.turn(this.wantHeading, v, dt);
      dx = v * dt;
      const Fx = Math.sin(this.heading), Fz = Math.cos(this.heading);
      this.C.x += Fx * dx; this.C.z += Fz * dx;
      this.velocity.set(Fx * v, 0, Fz * v);
    }
    this.C.y = this.terrainH(this.C.x, this.C.z);
    this.pos.copy(this.C);
    const row = this.gaitAt(v / this.sq);
    this.gait = row;
    if (dx > 0 || following) {
      const lamT = row[0] * this.TL, ampT = row[1] * this.TL;
      if (dx > 0) {
        const wd = TAU / Math.max(0.05, this.lam.x);
        this.A.step(ampT, 1.6 * wd, dx);
        this.lam.step(lamT, 1.6 * wd, dx);
        this.phi += (TAU * dx) / this.lam.x;
        this.x += dx;
      }
      const y = this.A.x * Math.sin(this.phi);
      const Lx = Math.cos(this.heading), Lz = -Math.sin(this.heading);
      const Dx = this.C.x + Lx * y, Dz = this.C.z + Lz * y;
      // The head tracks its ideal place D on the wave with a curvature-bounded steering law (heading
      // relaxes toward the ideal path's tangent over a short distance, plus lateral and along-track
      // corrections), so the laid path is smooth and never tighter than the body can bend, whatever
      // the input does (sharp turns, a misaligned follow start, physics jitter).
      const pu = this.pursuit;
      if (!pu.on) { pu.on = true; pu.psi = this.neckYaw(); pu.k = 0; pu.dx = Dx; pu.dz = Dz; }
      const tdx = Dx - pu.dx, tdz = Dz - pu.dz;
      pu.dx = Dx; pu.dz = Dz;
      const dD = h2(tdx, tdz);
      const psiD = dD > 1e-7 ? Math.atan2(tdx, tdz) : pu.psi;
      const ex = Dx - this.leader.x, ez = Dz - this.leader.z;
      const Fx = Math.sin(pu.psi), Fz = Math.cos(pu.psi);
      const lat = ex * Fz - ez * Fx, along = ex * Fx + ez * Fz;
      const TL = this.TL;
      const psiT = psiD + clamp(lat / (0.05 * TL), -0.7, 0.7);
      const ds = Math.max(0, dD * clamp(Math.cos(angDiff(pu.psi, psiD)), 0.25, 1) + clamp(along, -0.03 * TL, 0.06 * TL) * 0.12);
      const kMax = 1 / (0.036 * TL), kRate = kMax / (0.035 * TL);
      const nSub = Math.max(1, Math.ceil(ds / (0.004 * this.s)));
      let lx = this.leader.x, lz = this.leader.z;
      for (let k = 0; k < nSub; k++) {
        const h = ds / nSub;
        // curvature command with a smooth saturation, and a bounded rate of change along the path
        const kc = kMax * Math.tanh(angDiff(pu.psi, psiT) / (0.03 * TL * kMax));
        pu.k += clamp(kc - pu.k, -kRate * h, kRate * h);
        pu.psi += pu.k * h;
        lx += Math.sin(pu.psi) * h; lz += Math.cos(pu.psi) * h;
      }
      this.leader.set(lx, this.terrainH(lx, lz), lz);
      if (!following && pu.follow) { pu.follow = false; }
      pu.follow = following;
      tr.lead(this.leader.x, this.leader.y, this.leader.z, spacing);
    }
    this.freq = v > 1e-3 ? v / this.lam.x : 0;
  }

  // limited yaw rate: never tighter than the minimum radius, and slow enough that the leader keeps
  // moving forward along its path (the wave offset swings with the heading)
  turn(hT, v, dt) {
    const cfg = this.cfg;
    const wMax = Math.min(cfg.turnRate, v / cfg.minR, (0.35 * v) / Math.max(1e-3, Math.abs(this.A.x)));
    const wT = clamp(angDiff(this.heading, hT) * 2.2, -wMax, wMax);
    this.yawRate += clamp(wT - this.yawRate, -4 * dt, 4 * dt);
    this.yawRate = clamp(this.yawRate, -wMax, wMax);
    this.heading += this.yawRate * dt;
  }

  neckYaw() {
    const tr = this.trail, sl = tr.lastS;
    tr.sample(sl, S3); const ax = S3[0], az = S3[2];
    tr.sample(sl - 0.04 * this.TL, S3);
    return Math.atan2(ax - S3[0], az - S3[2]);
  }

  // a new path leaves exactly along the neck: centre on the leader, heading along the neck, no wave yet
  startMoving() {
    const tr = this.trail, sl = tr.lastS;
    tr.sample(sl, S3); const ax = S3[0], ay = S3[1], az = S3[2];
    tr.sample(sl - 0.04 * this.TL, S3);
    this.heading = Math.atan2(ax - S3[0], az - S3[2]);
    this.yawRate = 0;
    this.C.set(ax, ay, az);
    this.leader.set(ax, ay, az);
    this.A.reset(0);
    this.phi = 0;
    this.reseed = false;
    this.pursuit.on = false;
  }

  // scripted leader path (coil): curvature integrated along arc length
  startScript(sc) {
    const tr = this.trail, sl = tr.lastS;
    tr.sample(sl, S3); const ax = S3[0], az = S3[2];
    tr.sample(sl - 0.03 * this.TL, S3); const bx = S3[0], bz = S3[2];
    tr.sample(sl - 0.06 * this.TL, S3); const cx = S3[0], cz = S3[2];
    const y1 = Math.atan2(ax - bx, az - bz), y0 = Math.atan2(bx - cx, bz - cz);
    sc.psi = y1;
    sc.k0 = clamp(angDiff(y0, y1) / (0.03 * this.TL), -30, 30);
    sc.u = 0;
    sc.x = ax; sc.z = az;
    this.script = sc;
    this.speed = 0; this.yawRate = 0;
  }

  runScript(dt, spacing) {
    const sc = this.script;
    const rem = sc.total - sc.u;
    const v = sc.speed * (0.25 + 0.75 * smooth(0, 0.05 * this.TL, sc.u)) * Math.max(0.12, smooth(0, 0.08 * this.TL, rem));
    const du = Math.min(rem, v * dt);
    const n = Math.max(1, Math.ceil(du / (0.004 * this.s)));
    for (let k = 0; k < n; k++) {
      const h = du / n;
      const kap = lerp(sc.k0, sc.kappa(sc.u + h * 0.5), smooth(0, 0.07 * this.TL, sc.u));
      sc.psi += kap * h;
      sc.x += Math.sin(sc.psi) * h; sc.z += Math.cos(sc.psi) * h;
      sc.u += h;
    }
    this.leader.set(sc.x, this.terrainH(sc.x, sc.z), sc.z);
    // the head leads: the reported position follows it while the snake coils up
    this.C.copy(this.leader); this.pos.copy(this.C);
    this.trail.lead(this.leader.x, this.leader.y, this.leader.z, spacing);
    this.velocity.set(0, 0, 0);
    this.freq = 0;
    if (sc.u >= sc.total - 1e-6) { this.script = null; sc.done = true; this.reseed = true; this.pursuit.on = false; }
  }

  // ----------------------------------------------------------------- base pose: joints on the trail
  basePose() {
    const N = this.N, tr = this.trail, sl = tr.lastS, lod = this.lod;
    // nothing moved (the trail is unchanged and the terrain is static): the base pose stands
    if (tr.ver === this._baseVer && lod === this._baseLod) return;
    this._baseVer = tr.ver; this._baseLod = lod;
    let hint = tr.n - 2;
    const gx = this.gx, gy = this.gy, gz = this.gz, sig = this.sig;
    // crowd LOD: every other joint from the trail, the ones between at the chord midpoint
    const stepI = lod >= 2 ? 2 : 1;
    for (let i = 0; i <= N; i += stepI) {
      tr.sample(sl - sig[i], S3, hint);
      hint = tr.hit;
      gx[i] = S3[0]; gz[i] = S3[2];
      gy[i] = this.terrainH(S3[0], S3[2]);
      if (lod >= 2) { this.nx[i] = 0; this.ny[i] = 1; this.nz[i] = 0; }
      else { this.terrainN(S3[0], S3[2], S3); this.nx[i] = S3[0]; this.ny[i] = S3[1]; this.nz[i] = S3[2]; }
      if (stepI === 2 && i === N - 1) i--; // make sure the tail tip is sampled
    }
    if (stepI === 2) {
      for (let i = 1; i < N; i += 2) {
        if (i + 1 > N) break;
        const t = (sig[i] - sig[i - 1]) / (sig[i + 1] - sig[i - 1]);
        gx[i] = gx[i - 1] + (gx[i + 1] - gx[i - 1]) * t; gz[i] = gz[i - 1] + (gz[i + 1] - gz[i - 1]) * t;
        gy[i] = this.terrainH(gx[i], gz[i]);
        this.nx[i] = 0; this.ny[i] = 1; this.nz[i] = 0;
      }
    }
    for (let i = 0; i < N; i++) {
      const dx = this.gx[i] - this.gx[i + 1], dz = this.gz[i] - this.gz[i + 1], dy = this.gy[i] - this.gy[i + 1];
      const lh = h2(dx, dz);
      this.byaw[i] = lh > 1e-9 ? Math.atan2(dx, dz) : i > 0 ? this.byaw[i - 1] : this.heading;
      this.blh[i] = lh;
      const c = h2(lh, dy);
      this.bch[i] = c;
      this.bsin[i] = c > 1e-9 ? dy / c : 0;
      // yaw unwrapped along the chain (a coiled body turns through more than pi)
      this.byawU[i] = i === 0 ? this.byaw[0] : this.byawU[i - 1] + angDiff(this.byaw[i - 1], this.byaw[i]);
    }
  }

  // ----------------------------------------------------------------- pose integration and frames
  solveBody() {
    const N = this.N, P = this.P;
    const lift = P.lift, dyaw = P.dyaw, roll = P.roll;
    let any = false;
    for (let i = 0; i < N; i++) if (Math.abs(dyaw[i]) > 1e-7) { any = true; break; }
    if (!any) for (let i = 0; i <= N; i++) if (lift[i] > 1e-7) { any = true; break; }
    const hx = this.hx, hz = this.hz;
    if (any) {
      hx[0] = this.gx[0]; hz[0] = this.gz[0];
      for (let i = 0; i < N; i++) {
        const c = this.bch[i];
        const sn = clamp(this.bsin[i] + (lift[i] - lift[i + 1]) / Math.max(c, 1e-9), -0.995, 0.995);
        const lh = c * Math.sqrt(1 - sn * sn);
        const yw = this.byaw[i] + dyaw[i];
        hx[i + 1] = hx[i] - Math.sin(yw) * lh;
        hz[i + 1] = hz[i] - Math.cos(yw) * lh;
      }
      // keep the joints the actions leave alone where they were
      let sw = 0, tx = 0, tz = 0;
      for (let i = 0; i <= N; i++) {
        const w = Math.max(1e-3, 1 - clamp(this.affect[i], 0, 1));
        sw += w; tx += w * (this.gx[i] - hx[i]); tz += w * (this.gz[i] - hz[i]);
      }
      tx /= sw; tz /= sw;
      for (let i = 0; i <= N; i++) { hx[i] += tx; hz[i] += tz; }
    } else {
      for (let i = 0; i <= N; i++) { hx[i] = this.gx[i]; hz[i] = this.gz[i]; }
    }
    // heights from the terrain, axis offset along the ground normal (grows toward the half width
    // when the body is rolled onto its back)
    const lod = this.lod;
    for (let i = 0; i <= N; i++) {
      const x = hx[i], z = hz[i];
      let gy, nx, ny, nz;
      if (any) {
        gy = this.terrainH(x, z);
        if (lod >= 2) { nx = 0; ny = 1; nz = 0; } else { this.terrainN(x, z, S3); nx = S3[0]; ny = S3[1]; nz = S3[2]; }
      } else { gy = this.gy[i]; nx = this.nx[i]; ny = this.ny[i]; nz = this.nz[i]; }
      const ro = roll[i];
      // support of the cross-section toward the ground when rolled: flat belly (axis height r) when
      // upright, the half width on its side, the round back (~half width) when belly-up
      const rr = ro === 0 ? this.r[i] : this.support(i, ro);
      this.px[i] = x + nx * rr; this.pz[i] = z + nz * rr;
      this.py[i] = gy + ny * rr + lift[i];
      this.stack[i] = 0;
    }
    if (lod < 2 && P.stackW > 0) this.selfContact();
    for (let i = 0; i <= N; i++) this.py[i] += this.stack[i];
    // on the ground: this joint and its neighbours are not lifted (a joint next to a raised one is
    // the start of the rise)
    const tol = 0.0015 * this.s;
    for (let i = 0; i <= N; i++) {
      const a = lift[i] + this.stack[i], b = i > 0 ? lift[i - 1] + this.stack[i - 1] : 0, c = i < N ? lift[i + 1] + this.stack[i + 1] : 0;
      this.contact[i] = a < tol && b < tol && c < tol && !(this.affect[i] > 0.05 && lift[i] > 1e-5) ? 1 : 0;
    }
    // frames: lateral axis from the ground normal (belly down), transported where a segment stands
    // up steeply, then rolled
    const up = S3;
    let plx = 0, ply = 0, plz = 0, havePrev = false;
    for (let i = N - 1; i >= 0; i--) {
      const fx = this.px[i] - this.px[i + 1], fy = this.py[i] - this.py[i + 1], fz = this.pz[i] - this.pz[i + 1];
      const fl = h3(fx, fy, fz) || 1;
      const ux = fx / fl, uy = fy / fl, uz = fz / fl;
      const gnx = (this.nx[i] + this.nx[i + 1]) * 0.5, gny = (this.ny[i] + this.ny[i + 1]) * 0.5, gnz = (this.nz[i] + this.nz[i + 1]) * 0.5;
      // left = up x forward
      let lx = gny * uz - gnz * uy, ly = gnz * ux - gnx * uz, lz = gnx * uy - gny * ux;
      let ll = h3(lx, ly, lz);
      if (havePrev) {
        const d = plx * ux + ply * uy + plz * uz;
        let tx = plx - ux * d, ty = ply - uy * d, tz = plz - uz * d;
        const tl = h3(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        const w = smooth(0.25, 0.6, ll);
        if (ll > 1e-9) { lx /= ll; ly /= ll; lz /= ll; }
        lx = lerp(tx, lx, w); ly = lerp(ty, ly, w); lz = lerp(tz, lz, w);
        ll = h3(lx, ly, lz);
      }
      if (ll < 1e-9) { lx = Math.cos(this.heading); ly = 0; lz = -Math.sin(this.heading); ll = 1; }
      lx /= ll; ly /= ll; lz /= ll;
      plx = lx; ply = ly; plz = lz; havePrev = true;
      // roll about the bone (forward axis)
      const ro = (roll[i] + roll[i + 1]) * 0.5;
      const L = this.lat[i];
      if (Math.abs(ro) > 1e-6) {
        const c = Math.cos(ro), s = Math.sin(ro);
        // rotate lat about u by ro (Rodrigues; lat is perpendicular to u)
        const cxv = uy * lz - uz * ly, cyv = uz * lx - ux * lz, czv = ux * ly - uy * lx;
        L.set(lx * c + cxv * s, ly * c + cyv * s, lz * c + czv * s);
      } else L.set(lx, ly, lz);
    }
    for (let i = 0; i < N; i++) {
      _v.set(this.px[i], this.py[i], this.pz[i]);
      _v2.set(this.px[i + 1] - this.px[i], this.py[i + 1] - this.py[i], this.pz[i + 1] - this.pz[i]);
      writeFrame(this.spine[i].matrixWorld, _v, _v2, this.lat[i]);
    }
    void up;
  }

  // cross-section support toward the ground for roll ro (table, linear in angle)
  support(i, ro) {
    const NA = this.supN;
    let a = ((ro + Math.PI) / TAU) * NA;
    a -= Math.floor(a / NA) * NA;
    const k0 = Math.floor(a), k1 = (k0 + 1) % NA, t = a - k0;
    const T = this.supTab, o = i * NA;
    return T[o + k0] + (T[o + k1] - T[o + k0]) * t;
  }

  // a part of the body lying across another rides on top of it (anterior over posterior)
  selfContact() {
    const N = this.N, px = this.px, pz = this.pz, py = this.py, st = this.stack, hw = this.hw, sig = this.sig;
    // spatial hash of the joints already processed (posterior ones), cell >= the widest contact
    const G = this.grid, cs = 2 * this.hwMax, inv = 1 / cs;
    G.head.fill(-1);
    let anyHit = false;
    const gap = 0.02 * this.TL;
    for (let i = N; i >= 0; i--) {
      let need = 0;
      const cx = Math.floor(px[i] * inv), cz = Math.floor(pz[i] * inv);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        for (let j = G.head[((cx + ox) * 73856093 ^ (cz + oz) * 19349663) & 255]; j >= 0; j = G.next[j]) {
          if (sig[j] - sig[i] < 2.5 * (hw[i] + hw[j]) + gap) continue;
          const D = (hw[i] + hw[j]) * 0.92;
          const dx = px[i] - px[j], dz = pz[i] - pz[j];
          const d2 = dx * dx + dz * dz;
          if (d2 >= D * D) continue;
          const q = 1 - d2 / (D * D);
          const h = (py[j] + st[j] + (this.r[i] + hw[j]) * q * (2 - q) - py[i]) * 1.3;
          if (h > need) need = h;
        }
      }
      st[i] = need;
      if (need > 0) anyHit = true;
      const k = (cx * 73856093 ^ cz * 19349663) & 255;
      G.next[i] = G.head[k]; G.head[k] = i;
    }
    if (!anyHit) return;
    // ramps along the chain so the climbing part forms an arch, not a step: max-plus dilation, then
    // a light smoothing (the requirement was padded for it)
    const slope = 0.2;
    for (let i = 1; i <= N; i++) st[i] = Math.max(st[i], st[i - 1] - slope * this.len[i - 1]);
    for (let i = N - 1; i >= 0; i--) st[i] = Math.max(st[i], st[i + 1] - slope * this.len[i]);
    const tmp = this.stackTmp;
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i <= N; i++) tmp[i] = 0.25 * st[Math.max(0, i - 1)] + 0.5 * st[i] + 0.25 * st[Math.min(N, i + 1)];
      for (let i = 0; i <= N; i++) st[i] = tmp[i];
    }
    const k = this.P.stackW;
    for (let i = 0; i <= N; i++) st[i] *= k;
  }

  // ----------------------------------------------------------------- head, jaw, tongue, fangs
  solveHead(dt) {
    const P = this.P, inp = this.input;
    const px = this.px, py = this.py, pz = this.pz;
    const s = this.s;
    // neck direction (segment 0) and base head orientation
    const fx = px[0] - px[1], fy = py[0] - py[1], fz = pz[0] - pz[1];
    const fh = h2(fx, fz);
    const segYaw = fh > 1e-9 ? Math.atan2(fx, fz) : this.heading;
    const segEl = Math.atan2(fy, Math.max(fh, 1e-9));
    const moving = smooth(0.005, 0.05, this.speed / this.sq) * (this.script ? 0 : 1);
    const stab = (this.gait ? this.gait[3] : 0.6) * moving * P.stabW;
    let yawT = segYaw + clamp(angDiff(segYaw, this.heading), -0.8, 0.8) * stab;
    // look target: turn the head the rest of the way
    const look = inp.look || P.look;
    if (look && P.lookW > 0.01) {
      const want = Math.atan2(look.x - px[0], look.z - pz[0]);
      yawT += clamp(angDiff(yawT, want), -0.7, 0.7) * P.lookW;
      this.lookTarget.copy(look);
      this.state.lookTarget = this.lookTarget;
    } else this.state.lookTarget = null;
    yawT += P.headYaw;
    // elevation: level with the ground under the head when lying, level in space when raised
    const cyaw = Math.cos(yawT), syaw = Math.sin(yawT);
    const g0 = this.terrainH(px[0], pz[0]);
    const gN = this.terrainH(px[0] + syaw * this.headLen, pz[0] + cyaw * this.headLen);
    const groundEl = Math.atan2(gN - g0, this.headLen);
    const raised = smooth(0.003 * s, 0.02 * s, py[0] - g0 - this.r[0]);
    let elT = lerp(groundEl, lerp(segEl, 0, 0.75), raised) + P.headPitch;
    if (look && P.lookW > 0.01) {
      const dy = look.y - (py[0] + 0.3 * this.headLen), dd = h2(look.x - px[0], look.z - pz[0]);
      elT += clamp(Math.atan2(dy, dd) * 0.6, -0.4, 0.5) * P.lookW * raised;
    }
    if (!this._headInit) { this.hYaw.reset(0); this.hPitch.reset(elT); this.hRoll.reset(0); this._headInit = true; }
    // yaw spring works on the offset from the neck direction (no wrap-around)
    const yawOff = this.hYaw.step(angDiff(segYaw, yawT), P.headOmega, dt);
    const yaw = segYaw + yawOff;
    let el = this.hPitch.step(elT, P.headOmega, dt);
    const rollT = (P.roll[0] + P.roll[1]) * 0.5 + P.headRoll;
    const rl = this.hRoll.step(rollT, P.headOmega, dt);
    // head rotation (bind space faces +Z)
    const q = this.qHead;
    q.setFromAxisAngle(_Y, yaw);
    _q.setFromAxisAngle(_X, -el); q.multiply(_q);
    _q.setFromAxisAngle(_Z, rl); q.multiply(_q);
    const ga = this.gape.step(P.gape, P.gapeOmega, dt);
    // snout and chin (with the jaw's gape) never enter the ground: pitch up about v0 just enough
    for (let k = 0; k < 4; k++) {
      const b = k === 0 ? this.noseB : k === 1 ? this.chinB : this.jawMid;
      _v.copy(b);
      if (k === 3) _v.x = -_v.x;
      if (k >= 1) { rotAbout(_m1, this.hingeB, _X, ga); _v.applyMatrix4(_m1); }
      _v.sub(this.v0b).applyQuaternion(q);
      const wy = py[0] + _v.y, floor = this.terrainH(px[0] + _v.x, pz[0] + _v.z) + (k === 0 ? 0.001 * s : 0.0003 * s);
      if (wy < floor) {
        const hl = h2(_v.x, _v.z) || 1e-6;
        const add = Math.atan2(floor - wy, hl);
        el += add;
        q.setFromAxisAngle(_Y, yaw); _q.setFromAxisAngle(_X, -el); q.multiply(_q); _q.setFromAxisAngle(_Z, rl); q.multiply(_q);
      }
    }
    if (el > this.hPitch.x) { this.hPitch.x = el; this.hPitch.v = Math.max(0, this.hPitch.v); }
    // a rolled head (limp, dead) must not push the corners of its open jaw into the ground
    let rr = rl;
    for (let it = 0; it < 5 && Math.abs(rr) > 1e-3; it++) {
      let pen = false;
      for (let k = 0; k < 2 && !pen; k++) {
        _v.copy(this.jawCorner).setX(k ? -this.jawCorner.x : this.jawCorner.x);
        rotAbout(_m1, this.hingeB, _X, ga); _v.applyMatrix4(_m1);
        _v.sub(this.v0b).applyQuaternion(q);
        if (py[0] + _v.y < this.terrainH(px[0] + _v.x, pz[0] + _v.z)) pen = true;
      }
      if (!pen) break;
      rr *= 0.6;
      q.setFromAxisAngle(_Y, yaw); _q.setFromAxisAngle(_X, -el); q.multiply(_q); _q.setFromAxisAngle(_Z, rr); q.multiply(_q);
    }
    // head-rigid transform T = translate(v0 world) * R * translate(-v0 bind)
    const T = this.Tm;
    T.makeRotationFromQuaternion(q);
    _v.copy(this.v0b).applyQuaternion(q);
    T.setPosition(px[0] - _v.x, py[0] - _v.y, pz[0] - _v.z);
    this.bHead.matrixWorld.multiplyMatrices(T, this.bindHead);
    this.headPose.position.set(px[0], py[0], pz[0]);
    this.headPose.quaternion.copy(q);
    // jaw: gape about the quadrate hinge (bind X axis)
    rotAbout(_m1, this.hingeB, _X, ga);
    _m2.multiplyMatrices(T, _m1);
    this.bJaw.matrixWorld.multiplyMatrices(_m2, this.bindJaw);
    // fangs swing forward from the palate as the mouth opens (vipers)
    const fe = this.fang.step(this.viper ? smooth(0.35, 0.9, ga / Math.max(0.3, this.cfg.strike.gape * Math.PI / 180)) * 1.75 + P.fang : 0, 18, dt);
    rotAbout(_m1, this.fangBaseB, _X, -fe);
    _m3.multiplyMatrices(T, _m1);
    this.bFang.matrixWorld.multiplyMatrices(_m3, this.bindFang);
    // tongue: slides out of its sheath (with the jaw), dips, the fork tips oscillate
    this.solveTongue(dt, ga);
    const tg = this.tongue;
    _m3.makeTranslation(this.tongueDirB.x * tg.extD, this.tongueDirB.y * tg.extD, this.tongueDirB.z * tg.extD);
    rotAbout(_m1, this.tongueBaseB, _X, tg.pitch);
    _m3.multiply(_m1);
    _m2.multiply(_m3); // T * jaw * tongue
    this.bTongue.matrixWorld.multiplyMatrices(_m2, this.bindTongue);
    rotAbout(_m1, this.tongueForkB, _X, tg.tip);
    _m2.multiply(_m1);
    this.bTip.matrixWorld.multiplyMatrices(_m2, this.bindTip);
    // the flicking tips may brush the ground but never go through it: lift the whole tongue
    const e = this.bTip.matrixWorld.elements, Lt = this.tipLen;
    const tx = e[12] + e[4] * Lt, ty = e[13] + e[5] * Lt, tz = e[14] + e[6] * Lt;
    const lo = Math.min(ty, e[13]) - this.terrainH(tx, tz) - 0.0008 * this.s;
    // the lift is kept (it only relaxes slowly), so the tongue never snaps back into the ground
    const need = lo < 0 && tg.extD > 1e-5 ? -lo : 0;
    tg.lift = Math.max(need, (tg.lift || 0) * Math.exp(-dt * 6));
    if (tg.lift > 0) {
      this.bTongue.matrixWorld.elements[13] += tg.lift;
      e[13] += tg.lift;
    }
  }

  solveTongue(dt, gape) {
    const tg = this.tongue, P = this.P, cfg = this.cfg.tongue;
    const allow = P.tongue * (gape < 0.25 ? 1 : 0);
    tg.next -= dt * (0.4 + 0.6 * P.tongueRate);
    if (tg.dur <= 0 && tg.next <= 0 && allow > 0.5) {
      tg.dur = 0.35 + this.rand() * 0.45;
      tg.t = 0;
      tg.osc = cfg.flicks[0] + this.rand() * (cfg.flicks[1] - cfg.flicks[0]);
      tg.next = (1 / Math.max(0.05, cfg.rate)) * (0.5 + this.rand());
    }
    let ext = 0, tip = 0, pitch = 0;
    const amp = cfg.amp ?? 1; // a longer tongue whips its tips farther for the same angle
    if (tg.dur > 0) {
      tg.t += dt;
      const t = tg.t, d = tg.dur;
      ext = smooth(0, 0.09, t) * (1 - smooth(d - 0.09, d, t));
      // tips oscillate at the species' flick frequency, ramped in and out over the flick
      const env = Math.sin(clamp((t - 0.05) / (d - 0.1), 0, 1) * Math.PI);
      const osc = Math.sin(TAU * cfg.freq * Math.max(0, t - 0.05)) * env;
      tip = 0.45 * amp * osc * ext;
      pitch = (0.16 + 0.18 * amp * osc) * ext;
      if (t >= d) tg.dur = 0;
      if (allow < 0.5 && t < d - 0.09) tg.t = Math.max(t, d - 0.09); // cut short: retract now
    }
    ext = Math.max(ext, P.tongueOut);
    // springs keep the tongue's own motion smooth whatever starts or cuts a flick
    const w = 55;
    tg.ext.step(ext, w, dt);
    tg.tipS.step(tip, w, dt);
    tg.pitchS.step(pitch + 0.25 * P.tongueOut + 0.08 * (amp < 1 ? 1 : 0) * ext, w, dt);
    const e = clamp(tg.ext.x, 0, 1);
    tg.extD = e * cfg.length * this.headLen;
    tg.tip = tg.tipS.x;
    tg.pitch = tg.pitchS.x;
  }

  // ----------------------------------------------------------------- state
  publish() {
    const st = this.state, N = this.N;
    st.heading = this.heading;
    st.speed = this.speed;
    const moving = this.speed > 0.004 * this.sq || this.script;
    st.gait = moving ? (this.script ? 'slither' : this.gaitName) : 'stand';
    st.stats.gait = st.gait; st.stats.freq = this.freq || 0; st.stats.duty = 1;
    st.action = this.layer.current();
    st.posture = this.layer.posture;
    for (let i = 0; i <= N; i++) {
      const c = st.contacts[i];
      c.contact = !!this.contact[i];
      c.position.set(this.hx[i], this.terrainH(this.hx[i], this.hz[i]), this.hz[i]);
    }
    const dbg = this.debug.targets;
    dbg[0].copy(this.leader); dbg[1].copy(this.C);
  }
}

// rotation by angle a about an axis through point c (bind space) -> out
function rotAbout(out, c, axis, a) {
  _q2.setFromAxisAngle(axis, a);
  out.makeRotationFromQuaternion(_q2);
  _v4.copy(c).applyQuaternion(_q2);
  out.setPosition(c.x - _v4.x, c.y - _v4.y, c.z - _v4.z);
  return out;
}

// ------------------------------------------------------------------------------------------------
// Pose parameters (filled by the action layer every frame)
// ------------------------------------------------------------------------------------------------
function makePose(N) {
  return {
    lift: new Float64Array(N + 1), dyaw: new Float64Array(N), roll: new Float64Array(N + 1),
    speedScale: 1, headYaw: 0, headPitch: 0, headRoll: 0, headOmega: 9, stabW: 1,
    gape: 0, gapeOmega: 14, fang: 0, tongue: 1, tongueRate: 1, tongueOut: 0,
    look: null, lookW: 1, stackW: 1,
  };
}
function resetPose(P, affect) {
  P.lift.fill(0); P.dyaw.fill(0); P.roll.fill(0); affect.fill(0);
  P.speedScale = 1; P.headYaw = 0; P.headPitch = 0; P.headRoll = 0; P.headOmega = 9; P.stabW = 1;
  P.gape = 0; P.gapeOmega = 14; P.fang = 0; P.tongue = 1; P.tongueRate = 1; P.tongueOut = 0;
  P.look = null; P.lookW = 1; P.stackW = 1;
}

// ------------------------------------------------------------------------------------------------
// Actions
// ------------------------------------------------------------------------------------------------
// Postures (sit, lie, sleep, coil, death) hold until 'stand' or a move request. Coil-family postures
// (coil = resting coil, sleep = coil + stillness, sit = alert coil with the forebody raised in an S)
// crawl into a spiral first. One-shots (strike / attack, jump, eat, drink, hit) blend over whatever
// runs and end by themselves. play() returns a Promise (postures: resolved once in the pose).
class SnakeActions {
  constructor(e) {
    this.e = e;
    this.postures = []; // { name, t, w, target, shapeW, reached, resolveIn, side, ... }
    this.oneshots = [];
    this.posture = 'stand';
    this.standReq = null;
    this.idle = { w: 0, t: 0, lookT: 2, look: new THREE.Vector3(), has: false, raise: 0, raiseT: 3, raiseS: new Spring(0), yawS: new Spring(0), bend: 0 };
    this.lookS = { raise: new Spring(0), bend: new Spring(0), w: new Spring(0) };
    this.coiled = false;
    this._t = new THREE.Vector3();
  }
  holdsStill() {
    if (this.postures.length) return true;
    for (let i = 0; i < this.oneshots.length; i++) { const a = this.oneshots[i]; if (a.still && !a.stopping) return true; }
    return false;
  }
  dead() { for (let i = 0; i < this.postures.length; i++) { const p = this.postures[i]; if (p.name === 'death' && p.target > 0) return true; } return false; }
  // automatic stand-up (asked to move): never revives a dead snake
  requestStand() { if (!this.standReq && !this.dead()) this.play('stand'); }
  // arbitration: a new one-shot interrupts the running
  // ones (fade out, the promise resolves 'interrupted'); a posture ends them (except a hit); stop()
  // ends everything but death; dead: only hit is taken. Promises resolve 'done' | 'interrupted' |
  // 'stopped' | 'refused'.
  end(a, reason) { if (a.stopping) return; a.stopping = true; a.reason = reason; }
  current() {
    for (let i = 0; i < this.oneshots.length; i++) if (!this.oneshots[i].stopping) return this.oneshots[i].name;
    for (let i = 0; i < this.postures.length; i++) if (this.postures[i].target > 0) return this.postures[i].name;
    return this.standReq ? 'stand' : null;
  }
  clear() {
    for (const a of [...this.postures, ...this.oneshots]) { a.resolveIn?.('stopped'); a.resolve?.('stopped'); }
    this.postures.length = 0; this.oneshots.length = 0;
    if (this.standReq) { this.standReq.resolve('stopped'); this.standReq = null; }
  }

  play(name, opts = {}) {
    const e = this.e;
    if (name === 'idle') name = 'stand';
    if (name === 'attack') name = 'strike';
    if (name === 'stand') {
      if (!this.postures.some((p) => p.target > 0) && !this.postures.length) return Promise.resolve('done');
      for (const p of this.postures) if (p.target > 0) { p.target = 0; p.resolveIn?.('interrupted'); }
      e.emit('actionStart', { name: 'stand' });
      if (this.standReq) return this.standReq.promise;
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      this.standReq = { promise, resolve };
      return promise;
    }
    if (POSTURES.includes(name)) {
      const cur = this.postures.find((p) => p.target > 0);
      if (cur && cur.name === 'death' && name !== 'death') return Promise.resolve('refused');
      if (cur && cur.name === name) return cur.promiseIn;
      for (const p of this.postures) if (p.target > 0) { p.target = 0; p.resolveIn?.('interrupted'); }
      if (this.standReq) { this.standReq.resolve('interrupted'); this.standReq = null; }
      for (const a of this.oneshots) if (a.name !== 'hit') this.end(a, 'interrupted');
      let side = opts.side ?? (e.rand() < 0.5 ? -1 : 1);
      if (opts.direction && name === 'death') {
        const d = opts.direction;
        side = d.x * Math.cos(e.heading) - d.z * Math.sin(e.heading) > 0 ? 1 : -1;
      }
      const inst = { name, t: 0, w: 0, target: 1, side, opts, reached: false, baked: false, phase0: e.rand() * TAU };
      inst.promiseIn = new Promise((r) => { inst.resolveIn = r; });
      if (COILED[name]) {
        // already lying in a coil (the body winds through more than ~300 degrees): stay put
        const wound = Math.abs(e.byawU[0] - e.byawU[e.N - 1]) > 1.7 * Math.PI;
        if (!this.coiled && !wound) this.startCoil(inst);
        else { inst.coilDone = true; this.coiled = true; }
      }
      this.postures.push(inst);
      e.emit('actionStart', { name });
      if (name === 'death') e.emit('death', { position: e.pos.clone() });
      return inst.promiseIn;
    }
    const def = ONESHOTS[name];
    if (!def) return Promise.reject(new Error(`procedural-animals: unknown action "${name}"`));
    if (this.dead() && name !== 'hit') return Promise.resolve('refused');
    if (this.postures.some((p) => p.target > 0) && (name === 'jump' || name === 'strike') && !this.postures.some((p) => p.name === 'sit' && p.target > 0)) {
      return this.play('stand').then((r) => (r === 'refused' ? r : this.play(name, opts)));
    }
    // a new one-shot interrupts the running ones (they fade out, their promises resolve)
    for (const a of this.oneshots) this.end(a, 'interrupted');
    const inst = { name, t: 0, w: 0, dur: 1, stopping: false, opts, fade: 0.15, still: false, side: e.rand() < 0.5 ? -1 : 1 };
    def.start(inst, this);
    inst.promise = new Promise((r) => { inst.resolve = r; });
    this.oneshots.push(inst);
    e.emit('actionStart', { name });
    return inst.promise;
  }

  stop(name) {
    if (name === 'attack') name = 'strike';
    for (const a of this.oneshots) if (!name || a.name === name) this.end(a, 'stopped');
    if (!name || POSTURES.includes(name)) if (this.postures.some((p) => p.target > 0 && (name ? p.name === name : p.name !== 'death'))) this.play('stand');
  }

  startCoil(inst) {
    const e = this.e, tune = e.cfg.actions.coil || {};
    // a real resting coil is not a machined spiral: the ring spacing is a little tighter than the body
    // (inner turns ride up onto the outer ones), the curvature wanders (seeded), the centre is small
    // and the whole body, tail tip included, ends up in the coil
    const pitch = 2 * e.hwMax * (tune.pitch ?? 0.88);
    const rin = Math.max(0.022 * e.TL, 1.8 * e.hw[0] + 0.008 * e.s);
    const total = e.bodyLen * 1.08;
    const dir = inst.side;
    const f1 = 0.16 * e.TL * (0.8 + 0.4 * e.rand()), f2 = 0.07 * e.TL * (0.8 + 0.4 * e.rand()), p1 = e.rand() * TAU, p2 = e.rand() * TAU;
    const sc = {
      total, speed: (tune.speed ?? 0.34) * e.sq,
      kappa: (u) => (dir * (1 + 0.13 * Math.sin((TAU * u) / f1 + p1) + 0.06 * Math.sin((TAU * u) / f2 + p2))) / Math.sqrt(rin * rin + (pitch * Math.max(0, total - u)) / Math.PI),
      done: false,
    };
    e.startScript(sc);
    inst.script = sc;
    this.coiled = true;
  }

  update(dt) {
    const e = this.e, P = e.P, N = e.N;
    resetPose(P, e.affect);
    // ---- postures
    for (const p of this.postures) {
      p.t += dt;
      const coilWait = p.script && !p.script.done;
      if (p.target > 0) p.w = Math.min(1, p.w + dt / (p.name === 'death' ? 0.2 : 0.8));
      else p.w = Math.max(0, p.w - dt / (p.name === 'death' ? 1.0 : 0.7));
      if (!p.reached && p.target > 0 && p.w >= 1 && !coilWait && p.t > (p.name === 'death' ? 1.8 : p.name === 'lie' ? 1.6 : 0.6)) {
        p.reached = true; p.resolveIn('done'); e.emit('actionEnd', { name: p.name });
      }
      // leaving the posture: once lifts and rolls are gone, bake the body shape into the trail
      if (p.target === 0 && p.w <= 0 && !p.baked) {
        if (p.script && !p.script.done) { e.script = null; e.reseed = true; }
        p.baked = true;
        p.bakeNow = true;
      }
    }
    // any posture that changed the shape (death, lie) is baked when it ends
    let bake = false;
    for (let i = 0; i < this.postures.length; i++) { const p = this.postures[i]; if (p.bakeNow && (p.name === 'death' || p.name === 'lie')) bake = true; }
    if (bake) this.coiled = false; // the body shape changed (death, lie)
    compact(this.postures, notBaked);
    if (bake) this.bake();
    let active = null;
    for (let i = 0; i < this.postures.length; i++) if (this.postures[i].target > 0) { active = this.postures[i]; break; }
    this.posture = active ? (active.name === 'death' ? 'dead' : active.name) : this.postures.length ? 'standing-up' : 'stand';
    if (this.standReq && !this.postures.length) { this.standReq.resolve('done'); this.standReq = null; e.emit('actionEnd', { name: 'stand' }); }
    if (!active && e.speed > 0.01) this.coiled = false;

    // ---- idle and look-at
    const still = e.speed < 0.01 * e.sq && !e.input.follow && !e.script;
    let busy = false;
    for (let i = 0; i < this.oneshots.length; i++) if (!this.oneshots[i].stopping) busy = true;
    const idleT = still && !this.postures.length && !busy ? 1 : 0;
    const id = this.idle;
    id.w += clamp(idleT - id.w, -dt * 1.5, dt * 0.6);
    this.applyIdle(dt, id.w);
    this.applyLook(dt);
    // rattlesnakes carry the rattle just off the ground while they travel
    if (e.cfg.tailCarry > 0) {
      this.carry = (this.carry || 0) + (smooth(0.003, 0.03, e.speed / e.sq) * (this.postures.length ? 0 : 1) - (this.carry || 0)) * (1 - Math.exp(-dt * 3));
      if (this.carry > 1e-3) {
        const Lt = 0.07 * e.TL;
        for (let i = e.N; i >= 0 && e.bodyLen - e.sig[i] < Lt; i--) {
          const q = 1 - (e.bodyLen - e.sig[i]) / Lt;
          P.lift[i] += this.carry * e.cfg.tailCarry * q * q;
          e.affect[i] += this.carry * q;
        }
      }
    }
    // ---- postures
    for (const p of this.postures) {
      const w = p.w * p.w * (3 - 2 * p.w);
      if (w <= 0) continue;
      POSES[p.name](P, w, p, this, dt);
    }
    // ---- one-shots
    const wantsToMove = e.wantSpeed > 0.01 || !!e.input.follow;
    for (const a of this.oneshots) {
      if (wantsToMove && (a.name === 'eat' || a.name === 'drink')) this.end(a, 'interrupted');
      a.t += dt;
      const def = ONESHOTS[a.name];
      if (!a.stopping && def.update(a, dt, this)) this.end(a, 'done');
      if (a.stopping) a.w = Math.max(0, a.w - dt / a.fade);
      else a.w = Math.min(1, a.w + dt / a.fade);
      const w = a.w * a.w * (3 - 2 * a.w);
      if (w > 0) def.apply(P, w, a, this);
    }
    for (const a of this.oneshots) if (a.stopping && a.w <= 0) { a.resolve(a.reason || 'done'); e.emit('actionEnd', { name: a.name, reason: a.reason || 'done' }); }
    compact(this.oneshots, stillRunning);
    // the neck never kinks: cap the per-segment yaw change of the posed body
    void N;
  }

  // the current body shape becomes the trail (the snake then crawls off along its own body)
  bake() {
    const e = this.e, N = e.N, tr = e.trail;
    // current ground points, tail -> head, parameterised by the rest arc lengths
    const sl = tr.lastS;
    const tail = tr.lastS - e.sig[N];
    // keep the trail behind the tail: extend straight from the posed tail
    const tx = e.hx[N] - e.hx[N - 1], tz = e.hz[N] - e.hz[N - 1], tl = h2(tx, tz) || 1;
    tr.clear();
    const ext = 0.2 * e.TL;
    for (let k = 4; k >= 1; k--) {
      const d = (ext * k) / 4, x = e.hx[N] + (tx / tl) * d, z = e.hz[N] + (tz / tl) * d;
      tr.push(x, e.terrainH(x, z), z, tail - d);
    }
    for (let i = N; i >= 0; i--) tr.push(e.hx[i], e.terrainH(e.hx[i], e.hz[i]), e.hz[i], sl - e.sig[i]);
    e.reseed = true;
    e.leader.set(e.hx[0], e.terrainH(e.hx[0], e.hz[0]), e.hz[0]);
    e.C.copy(e.leader); e.pos.copy(e.C);
  }

  applyIdle(dt, w) {
    const e = this.e, P = e.P, id = this.idle, t = e.time, s = e.s;
    if (w <= 0.001) { id.has = false; id.raiseS.step(0, 3, dt); id.yawS.step(0, 3, dt); return; }
    id.t += dt;
    // gentle head sway and breathing (a slow roll of the trunk)
    P.headYaw += w * (0.05 * Math.sin(t * 0.7) + 0.03 * Math.sin(t * 1.9 + 1));
    P.headPitch += w * 0.03 * Math.sin(t * 0.43 + 2);
    const br = e.cfg.breath;
    const b = Math.sin(t * TAU * br.rate) * br.roll * w;
    for (let i = 0; i <= e.N; i++) { const q = e.sig[i] / e.bodyLen; P.roll[i] += b * smooth(0.1, 0.3, q) * (1 - smooth(0.6, 0.85, q)); }
    // now and then: raise the head and look about
    id.raiseT -= dt;
    if (id.raiseT <= 0) {
      id.raiseT = 2.5 + e.rand() * 4;
      id.raise = e.rand() < 0.45 ? 0.02 + e.rand() * 0.035 : 0;
      id.bend = (e.rand() - 0.5) * 1.1;
    }
    const rz = id.raiseS.step(id.raise * w, 1.6, dt), bd = id.yawS.step(id.bend * (id.raise > 0 ? 1 : 0.3) * w, 1.4, dt);
    if (!e.input.look) this.raiseNeck(P, rz * e.TL, bd, e.cfg.body.neck * e.TL * 1.4, 1);
    void s;
  }

  // raise the forebody to height h (m) over arc length Ln, and bend the neck by yaw b (rad)
  raiseNeck(P, h, b, Ln, w) {
    const e = this.e, N = e.N;
    Ln = Math.max(Ln, 2.3 * Math.abs(h));
    for (let i = 0; i <= N; i++) {
      const sg = e.sig[i];
      if (sg > Ln) break;
      const q = sg / Ln; // 0 head .. 1 base of the raised part
      // the neck rises straight up to the head and flattens into the ground at its base
      const f = Math.pow(1 - q, 1.7);
      P.lift[i] += w * h * f;
      if (i < N) {
        const qm = (sg + e.len[i] * 0.5) / Ln;
        P.dyaw[i] += w * b * (1 - smooth(0, 1, qm));
      }
      e.affect[i] += w * f;
    }
  }

  applyLook(dt) {
    const e = this.e, P = e.P, L = this.lookS;
    const look = e.input.look;
    let posed = false;
    for (let i = 0; i < this.postures.length; i++) { const p = this.postures[i]; if (p.target > 0 && (p.name === 'death' || p.name === 'sleep')) posed = true; }
    for (let i = 0; i < this.oneshots.length; i++) { const a = this.oneshots[i]; if (!a.stopping && (a.name === 'strike' || a.name === 'eat' || a.name === 'jump')) posed = true; }
    let raise = 0, bend = 0, wT = 0;
    if (look && !posed) {
      wT = 1;
      const hx = e.hx[0], hz = e.hz[0];
      const to = Math.atan2(look.x - hx, look.z - hz);
      bend = clamp(angDiff(e.byaw[0], to), -1.5, 1.5) * (e.speed > 0.02 ? 0.3 : 1);
      const d = h2(look.x - hx, look.z - hz);
      const dy = look.y - e.terrainH(hx, hz);
      raise = clamp(0.03 * e.TL + Math.max(0, dy) * 0.25 + 0.04 * e.TL * smooth(3, 0.5, d / e.TL), 0.02 * e.TL, 0.14 * e.TL) * (e.speed > 0.02 ? 0.3 : 1);
    }
    const w = L.w.step(wT, 3, dt);
    const r = L.raise.step(raise, 2.5, dt), b = L.bend.step(bend, 2.5, dt);
    if (w > 0.001) this.raiseNeck(P, r, b, e.cfg.body.neck * e.TL * (1.2 + Math.abs(b) * 0.6), w);
  }
}

// ---------------------------------------------------------------- forebody shapes (strike family)
// S-coil in the horizontal plane, raised at the front; extension e (0..1) straightens it toward the
// target. Writes yaw offsets and lifts with weight w.
function strikeShape(P, a, L, w, e, beta, hS, aimYaw, aimLift, curl) {
  const E = L.e, N = E.N;
  const Ls = a.Ls, ia = a.ia;
  const baseA = E.byawU[Math.min(N - 1, ia)];
  for (let i = 0; i < N && E.sig[i] <= Ls; i++) {
    const q = (E.sig[i] + E.len[i] * 0.5) / Ls; // 0 head .. 1 anchor
    const envS = Math.sin(Math.PI * Math.min(1, q * 1.05));
    // S-coil yaw about the aim direction (two bends), aim ramp near the anchor
    const aimRamp = 1 - smooth(0.55, 1, q);
    const ySx = aimYaw * aimRamp + beta * Math.sin(TAU * q * curl) * envS;
    const yE = aimYaw * (1 - smooth(0.55, 1, q));
    const yaw = baseA + lerp(ySx, yE, e);
    // hand over to the body's own curvature toward the anchor (no curvature step there)
    P.dyaw[i] += w * (yaw - E.byawU[i]) * (1 - smooth(0.5, 1, q));
  }
  for (let i = 0; i <= N && E.sig[i] <= Ls; i++) {
    const q = E.sig[i] / Ls;
    const lS = hS * Math.pow(1 - smooth(0, 1, q), 1.2);
    const lE = aimLift * (1 - smooth(0.05, 1, q));
    P.lift[i] += w * lerp(lS, lE, e);
    E.affect[i] += w * (1 - smooth(0.85, 1, q));
  }
}

function setupStrike(a, L, target, reachK) {
  const E = L.e, N = E.N;
  const t = target || L._t.set(E.hx[0] + Math.sin(E.byaw[0]) * 0.3 * E.TL, E.terrainH(E.hx[0], E.hz[0]) + 0.02 * E.TL, E.hz[0] + Math.cos(E.byaw[0]) * 0.3 * E.TL);
  a.target = new THREE.Vector3().copy(t);
  const maxL = reachK * E.TL;
  // forebody length: enough to reach the target from the anchor, within limits
  let Ls = maxL;
  for (let it = 0; it < 3; it++) {
    let ia = 0; while (ia < N && E.sig[ia] < Ls) ia++;
    const d = h2(a.target.x - E.hx[ia], a.target.z - E.hz[ia]);
    Ls = clamp(d * 1.04, 0.14 * E.TL, maxL);
  }
  let ia = 0; while (ia < N && E.sig[ia] < Ls) ia++;
  a.Ls = E.sig[ia]; a.ia = ia;
  const ax = E.hx[ia], az = E.hz[ia];
  const to = Math.atan2(a.target.x - ax, a.target.z - az);
  a.aimYaw = clamp(angDiff(E.byaw[Math.min(N - 1, ia)], to), -1.2, 1.2);
  const dh = h2(a.target.x - ax, a.target.z - az);
  const gy = E.terrainH(a.target.x, a.target.z);
  a.aimLift = clamp(a.target.y - gy - E.r[0], 0, 0.6 * a.Ls) * smooth(0, 1, a.Ls / Math.max(dh, 1e-3));
}

const ONESHOTS = {
  // S-coil, strike at the target with the jaw wide open (attackHit), retract, relax
  strike: {
    start(a, L) {
      const E = L.e, st = E.cfg.strike;
      setupStrike(a, L, a.opts.target, st.reach);
      a.still = true;
      a.T = { cock: 0.5, hold: 0.62, hit: 0.62 + clamp(a.Ls / (st.speed * E.sq * 0.9), 0.14, 0.22) };
      a.T.stay = a.T.hit + 0.14; a.T.back = a.T.stay + 0.32; a.T.end = a.T.back + 0.6;
      a.dur = a.T.end;
      a.fade = 0.2;
      a.hitDone = false;
    },
    update(a, dt, L) {
      const E = L.e, T = a.T;
      if (!a.hitDone && a.t >= T.hit) {
        a.hitDone = true;
        _v.set(0, 0, 0);
        const m = E.attachmentPoints.mouth;
        const pos = new THREE.Vector3();
        if (m) pos.setFromMatrixPosition(_m1.multiplyMatrices(E.bHead.matrixWorld, m.local)); else pos.set(E.px[0], E.py[0], E.pz[0]);
        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(E.qHead);
        E.emit('attackHit', { position: pos, direction: dir, style: 'strike', target: a.target.clone() });
      }
      return a.t >= a.dur;
    },
    apply(P, w, a, L) {
      const E = L.e, T = a.T, t = a.t, st = E.cfg.strike;
      const cock = smooth(0, T.cock, t) * (1 - smooth(T.back, T.end, t));
      const ext = smootherstep(T.hold, T.hit, t) * (1 - smootherstep(T.stay, T.back, t));
      const hS = st.coilHeight * E.TL;
      strikeShape(P, a, L, w * cock, ext, 1.25, hS, a.aimYaw, a.aimLift, 1);
      P.speedScale *= 1 - w;
      const openT = smooth(0.45, 0.85, ext);
      P.gape += w * openT * st.gape * Math.PI / 180;
      P.gapeOmega = Math.max(P.gapeOmega, 40);
      P.headPitch += w * (0.12 * cock * (1 - ext) + 0.25 * openT);
      P.headOmega = Math.max(P.headOmega, lerp(9, 40, w * ext));
      P.stabW *= 1 - w;
      P.tongue *= 1 - w * cock;
      P.lookW *= 1 - w;
      P.stackW *= 1 - w;
    },
  },
  // a forward lunge (snakes do not jump): a flat, closed-mouth strike straight ahead
  jump: {
    start(a, L) {
      const E = L.e;
      const h = E.byaw[0];
      a.opts.target = new THREE.Vector3(E.hx[0] + Math.sin(h) * 0.22 * E.TL, E.terrainH(E.hx[0], E.hz[0]) + 0.03 * E.TL, E.hz[0] + Math.cos(h) * 0.22 * E.TL);
      setupStrike(a, L, a.opts.target, 0.26);
      a.still = true;
      a.T = { cock: 0.4, hold: 0.45, hit: 0.7, stay: 0.8, back: 1.15, end: 1.6 };
      a.dur = a.T.end; a.fade = 0.2;
    },
    update(a) { return a.t >= a.dur; },
    apply(P, w, a, L) {
      const E = L.e, T = a.T, t = a.t;
      const cock = smooth(0, T.cock, t) * (1 - smooth(T.back, T.end, t));
      const ext = smootherstep(T.hold, T.hit, t) * (1 - smootherstep(T.stay, T.back, t));
      strikeShape(P, a, L, w * cock, ext, 0.5, 0.03 * E.TL, a.aimYaw, a.aimLift, 1);
      P.speedScale *= 1 - w;
      P.headPitch += w * 0.05 * cock;
      P.headOmega = Math.max(P.headOmega, lerp(9, 30, w * ext));
      P.stabW *= 1 - w; P.lookW *= 1 - w; P.tongue *= 1 - w * cock; P.stackW *= 1 - w;
    },
  },
  // strike at prey on the ground ahead, then swallow: jaws walk left and right, the neck works
  eat: {
    start(a, L) {
      const E = L.e, h = E.byaw[0];
      a.opts.target = a.opts.target || new THREE.Vector3(E.hx[0] + Math.sin(h) * 0.12 * E.TL, 0, E.hz[0] + Math.cos(h) * 0.12 * E.TL);
      a.opts.target.y = E.terrainH(a.opts.target.x, a.opts.target.z) + 0.005 * E.s;
      setupStrike(a, L, a.opts.target, 0.22);
      a.still = true;
      const sw = E.cfg.actions.eat?.swallow ?? 3.2;
      a.T = { cock: 0.35, hold: 0.4, hit: 0.62, stay: 0.9, back: 1.3, swallow: 1.3 + sw, yawn: 1.3 + sw + 0.7 };
      a.dur = a.T.yawn + 0.3; a.fade = 0.25;
    },
    update(a) { return a.t >= a.dur; },
    apply(P, w, a, L) {
      const E = L.e, T = a.T, t = a.t;
      const cock = smooth(0, T.cock, t) * (1 - smooth(T.stay, T.back, t));
      const ext = smootherstep(T.hold, T.hit, t) * (1 - smootherstep(T.stay, T.back, t));
      strikeShape(P, a, L, w * cock, ext, 0.3, 0.025 * E.TL, a.aimYaw, 0, 1);
      P.gape += w * smooth(0.3, 0.8, ext) * 0.7;
      P.gapeOmega = Math.max(P.gapeOmega, 25);
      // swallowing: alternate jaw walks, a pulse down the neck
      const sw = smooth(T.back - 0.2, T.back + 0.3, t) * (1 - smooth(T.swallow - 0.3, T.swallow, t));
      const ph = (t - T.back) * TAU * 0.7;
      P.headYaw += w * sw * 0.14 * Math.sin(ph);
      P.headRoll += w * sw * 0.1 * Math.sin(ph);
      P.gape += w * sw * (0.25 + 0.15 * Math.sin(ph * 2));
      P.headPitch += w * sw * 0.06 * Math.sin(ph + 1);
      const pulse = ((t - T.back) * 0.12 * E.TL) % (0.2 * E.TL);
      for (let i = 0; i <= E.N && E.sig[i] < 0.25 * E.TL; i++) {
        const d = (E.sig[i] - pulse) / (0.03 * E.TL);
        P.lift[i] += w * sw * 0.004 * E.s * Math.exp(-d * d);
      }
      // yawn to reset the jaws
      const yw = smooth(T.swallow, T.swallow + 0.3, t) * (1 - smooth(T.yawn - 0.3, T.yawn, t));
      P.gape += w * yw * 1.1;
      P.headPitch += w * yw * 0.25;
      P.speedScale *= 1 - w; P.stabW *= 1 - w; P.lookW *= 1 - w; P.tongue *= 1 - w; void yw;
    },
  },
  // head down, snout to the ground / water surface, buccal pumping
  drink: {
    start(a, L) { a.still = true; a.dur = 1.0 + (L.e.cfg.actions.drink?.pumps ?? 4) * 0.8; a.fade = 0.4; },
    update(a) { return a.t >= a.dur; },
    apply(P, w, a, L) {
      const t = a.t;
      const down = smooth(0, 0.6, t);
      P.headPitch -= w * down * 0.35;
      const pump = Math.max(0, Math.sin((t - 0.6) * TAU * 1.25)) * smooth(0.6, 0.9, t);
      P.gape += w * down * (0.03 + 0.06 * pump);
      P.gapeOmega = Math.max(P.gapeOmega, 20);
      P.tongue *= 1 - w * down;
      P.speedScale *= 1 - w; P.lookW *= 1 - w; P.stabW *= 1 - w;
    },
  },
  // flinch into a curve away from the blow, head withdrawn, tail whipping, then settle back
  hit: {
    start(a, L) {
      const E = L.e;
      const d = a.opts.direction;
      if (d) a.side = d.x * Math.cos(E.heading) - d.z * Math.sin(E.heading) > 0 ? 1 : -1;
      a.dur = 1.4; a.fade = 0.2;
    },
    update(a) { return a.t >= a.dur; },
    apply(P, w, a, L) {
      const E = L.e, t = a.t, N = E.N;
      const k = smootherstep(0, 0.3, t) * (1 - smootherstep(0.45, 1.35, t));
      const ov = 0;
      for (let i = 0; i < N; i++) {
        const q = (E.sig[i] + E.len[i] * 0.5) / E.bodyLen;
        // C-bend: forebody swings with the blow, the tail whips the other way
        const prof = 1.0 * (1 - smooth(0, 0.45, q)) - 0.55 * smooth(0.55, 1, q);
        P.dyaw[i] += w * a.side * (k * 0.75 + 0.2 * ov) * prof;
      }
      for (let i = 0; i <= N; i++) E.affect[i] += w * k;
      L.raiseNeck(P, 0.035 * E.TL * k, -a.side * 0.3 * k, 0.12 * E.TL, w);
      P.headYaw += w * a.side * 0.35 * k;
      P.gape += w * k * (E.viper ? 0.45 : 0.2);
      P.speedScale *= 1 - w * k;
      P.lookW *= 1 - w * k;
      P.stackW *= 1 - w * k;
      if (E.cfg.rattle) rattle(P, E, w * smooth(0, 0.3, t), t);
    },
  },
};

const notBaked = (p) => !p.baked;
const stillRunning = (a) => !(a.stopping && a.w <= 0);
function compact(arr, keep) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i];
  arr.length = j;
}

function smootherstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// tail tip raised and buzzing (rattlesnake)
function rattle(P, E, w, t) {
  if (w <= 0) return;
  const N = E.N, Lt = 0.11 * E.TL;
  const buzz = Math.sin(t * TAU * 27);
  for (let i = N; i >= 0 && E.bodyLen - E.sig[i] < Lt; i--) {
    const q = 1 - (E.bodyLen - E.sig[i]) / Lt; // 0 .. 1 at the tip
    P.lift[i] += w * 0.036 * E.TL * q * q;
    E.affect[i] += w * q;
    if (i < N) P.dyaw[i] += w * 0.03 * buzz * smooth(0.5, 1, q);
  }
}

// ---------------------------------------------------------------- posture poses
const POSES = {
  coil(P, w, p, L) {
    const E = L.e;
    P.speedScale *= 1 - w;
    P.tongueRate *= 1 - 0.4 * w;
    // once coiled, the neck swings out over the inner ring and the head rests on top of the coils
    const done = p.coilDone || (p.script && p.script.done);
    if (done) {
      if (p.restT === undefined) p.restT = p.t;
      const k = w * smooth(0, 1.2, p.t - p.restT);
      L.raiseNeck(P, 1.5 * E.hwMax * k, -p.side * 0.75 * k, 0.14 * E.TL, 1);
      P.headPitch += k * 0.06;
    }
  },
  sleep(P, w, p, L) {
    POSES.coil(P, w, p, L);
    const c = w * smooth(0.5, 2.5, p.t);
    P.tongue *= 1 - c; P.lookW *= 1 - c; P.stabW *= 1 - c;
    P.headPitch += c * 0.04;
    P.headOmega = Math.min(P.headOmega, 4);
  },
  // alert / defensive coil: the forebody rises in an S facing the look target (rattlesnakes rattle)
  sit(P, w, p, L) {
    const E = L.e;
    POSES.coil(P, w, p, L);
    const up = w * (p.script ? smooth(0.6, 1, p.script.u / p.script.total) : 1);
    if (up <= 0) return;
    if (!p.S) p.S = { Ls: 0, ia: 0, aimYaw: 0, aimLift: 0 };
    const S = p.S;
    const Lf = (E.cfg.actions.sit?.raise ?? 0.1) * E.TL * 2.6;
    let ia = 0; while (ia < E.N && E.sig[ia] < Lf) ia++;
    S.Ls = E.sig[ia]; S.ia = ia; S.aimYaw = 0; S.aimLift = 0;
    const look = E.input.look;
    if (look) S.aimYaw = clamp(angDiff(E.byaw[Math.min(E.N - 1, ia)], Math.atan2(look.x - E.hx[ia], look.z - E.hz[ia])), -1.2, 1.2) * 0.6;
    strikeShape(P, S, L, up, 0, 0.9, (E.cfg.actions.sit?.raise ?? 0.1) * E.TL, S.aimYaw, 0, 1);
    P.stackW *= 1 - up;
    P.tongueRate += up * 1.5;
    if (E.cfg.rattle) rattle(P, E, up * smooth(0.5, 1.5, p.t), E.time);
  },
  // stretched out: the wave relaxes toward the body's mean line, head down
  lie(P, w, p, L) {
    const E = L.e, N = E.N;
    P.speedScale *= 1 - w;
    const k = w * smooth(0, 1.4, p.t) * 0.8;
    const win = 0.18 * E.TL;
    // mean line: yaw averaged over a window along the body (unwrapped relative to the local yaw)
    for (let i = 0; i < N; i++) {
      let sum = 0, n = 0;
      for (let j = 0; j < N; j++) {
        if (Math.abs(E.sig[j] - E.sig[i]) > win) continue;
        sum += angDiff(E.byaw[i], E.byaw[j]); n++;
      }
      P.dyaw[i] += k * (sum / Math.max(1, n));
      E.affect[i] += k;
    }
    E.affect[N] += k;
    P.headPitch -= w * 0.02;
    P.tongueRate *= 1 - 0.5 * w;
  },
  // writhe, go limp and roll half onto the back; stays down until 'stand'
  death(P, w, p, L) {
    const E = L.e, N = E.N, t = p.t;
    P.speedScale = 0;
    const writhe = 0.55 * smooth(0, 0.12, t) * Math.exp(-t / 0.55);
    const slack = 0.32 * smooth(0.2, 1.4, t);
    const rollK = smooth(0.35, 1.3, t);
    const lam = 0.36 * E.TL;
    for (let i = 0; i < N; i++) {
      const sg = E.sig[i] + E.len[i] * 0.5;
      const q = sg / E.bodyLen;
      const env = smooth(0, 0.08, q) * (1 - 0.75 * smooth(0.78, 1, q));
      const wv = writhe * Math.sin(TAU * (sg / lam - 1.7 * t) + p.phase0) + slack * Math.sin(TAU * sg / (0.55 * E.TL) + p.phase0 * 1.7) * 0.8;
      P.dyaw[i] += w * wv * env;
    }
    for (let i = 0; i <= N; i++) {
      const q = E.sig[i] / E.bodyLen;
      E.affect[i] += w;
      // only parts turn belly-up: neck upright, mid-body over ~160 deg, a second partial twist behind
      const c1 = 0.4 + 0.1 * Math.sin(p.phase0), c2 = 0.76 + 0.06 * Math.cos(p.phase0 * 1.3);
      const prof = 2.8 * Math.exp(-(((q - c1) / 0.15) ** 2)) + 1.05 * Math.exp(-(((q - c2) / 0.09) ** 2));
      P.roll[i] += w * p.side * rollK * prof;
    }
    P.gape += w * 0.2 * smooth(0.4, 1.2, t);
    P.gapeOmega = 6;
    P.tongueOut += w * 0.45 * smooth(0.8, 1.6, t);
    P.tongue = 0;
    P.headRoll += w * p.side * 0.6 * rollK;
    P.headOmega = lerp(P.headOmega, 5, w);
    P.lookW = 0; P.stabW = 0; P.stackW *= 1 - w;
  },
};
