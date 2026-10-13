// Quadruped motion engine: a data-driven generalisation of the original procedural cheetah.
//
// Gait engine (phase-offset table blended by speed), foot planting with terrain-aware swing paths,
// pantograph hind-leg IK, foreleg IK with a sliding scapula (best-fit protraction), a flexing spine,
// banking, a one-arc neck with head stabilisation that rises with speed, a spring-chain tail,
// ears, jaw, breathing and panting. Actions (core/motion/actions.js) blend a posture parameter set
// over the locomotion every frame.
//
// Lessons kept from the cheetah: soft IK reach limits, continuous solves (nothing jumps between
// frames), body bounce from the gait phase (not from foot events), one-arc neck, spring-chain tail,
// head stabilisation rising with speed, zero-dt safety.
//
// Every length is read from the packed joints (data.joints: final, warped and scaled) or given in
// species data at the reference size and multiplied by s = params.size. Speeds in tables are at the
// reference size: the gait lookup uses v / sqrt(s), stride frequencies are divided by sqrt(s)
// (dynamic similarity, equal Froude number).
//
// ------------------------------------------------------------------------------------------------
// species.motion schema (every field optional unless marked; defaults in DEFAULTS below)
// ------------------------------------------------------------------------------------------------
// unit          the reference individual's leg length relative to the cheetah's (default: measured from
//               the bind skeleton, see refLegLength): engine constants scale by cfg.k = size x unit
// maxSpeed      m/s top speed (reference size)                          accel [slow, fast] m/s^2, decel m/s^2
// turnRate      rad/s max yaw rate                                       latAccelMax m/s^2 cornering limit
//               (turns: see step and turnCentre; the body leans into them from a trot on)
// gears         { name: speed } named speeds for UIs (walk, trot, ...)
// gaits  (req.) [{ name, v, f, D, off: [FL, FR, HL, HR], liftF, liftH, bobF, bobH, flex, lat, fold,
//                 heel, tail, drop, lead?, width? }]  sorted by v. v: speed where the row applies, f: stride Hz,
//                 D: duty factor, off: touchdown phase per leg, lift*: swing height (m), bob*: girdle
//                 bounce (m), flex: spine flexion amplitude (rad; the table's largest also sets how
//                 far the spine may bend sideways in a turn), lat: lateral spine wave (rad),
//                 width: stance width factor (single-tracking trot < 1, default 1),
//                 fold: carpal fold in swing (rad), heel: heel lift at push-off (deg), tail: tail
//                 activity 0..1, drop: body lowering (m), lead: extra landing lead (m).
//                 Hind pairs landing together (bound, half-bound, frog hop): give HL and HR the same
//                 offset (and FL / FR for a pronk); nothing else is needed.
// gallopBlend   [v0, v1] speeds over which the body style goes from walking to galloping
// flexBlend     [v0, v1] speeds over which the gait's spine flexion fades in ([3.5, 6]; hoppers flex
//               their back in every hop: rabbit [0.3, 1.5])
// bankScale     share of the dynamic lean into a turn (default 1: atan(lateral acceleration / g) x 0.85);
//               a heavy animal that corners hard without leaning like a runner lowers it (bear 0.55)
// reachDuty     1 (default): a leg's stance may not sweep further than it reaches (the duty factor is
//               shortened per leg where v D / f exceeds the reachable sweep); 0 disables, > 1 allows
//               a longer (dragged) stance
// feet          { front, hind }: { type: 'digitigrade' | 'unguligrade' | 'plantigrade',
//                 contact: 0..1 where the ground contact lies between the foot's back joint and the
//                 toe tip, curl: swing toe curl / hoof flip (deg), flex: stance carpal flex (deg),
//                 couple: share of the toe curl / heel lift the metacarpus follows (paws 0.6, hooves 0.2),
//                 swingBack: the swing path bows back by this much (m, reference size) at mid swing,
//                 sink: fetlock sink under load (deg, hooves), hoofFlex: extra coffin-joint flexion
//                 in swing (deg, hooves with a hoof bone), heelStrike: toe-up angle at touchdown
//                 (deg, plantigrade), lead: max landing lead / leg length, liftBehind: early lift-off
//                 distance behind the girdle / leg length, reach: IK reach limit / leg length,
//                 retract: 0..1 swing retraction (the foot meets the ground at ~zero ground speed:
//                 small fast animals whose stance lasts 2-3 frames), plantRest (hind): metatarsus flat
//                 on the ground at rest and in postures, on the toes in motion (rabbit, rodents),
//                 elbowDown (front): tilts the elbow pole down (paws raised to the face: grooming),
//                 toeOut: paw yaw away from the midline (rad, default 0.06; < 0 turns the toes in: bear) }
//               Hooves: a hoof bone per leg (fhoof / hhoof from joint fcoffin / hcoffin to the toe,
//               below fpaw / hpaw = pastern) is picked up automatically: the fetlock sinks about the
//               coffin joint in stance and the hoof flips in swing
// stance        { width: x stance width, gallopWidth: width factor at a gallop, sprawl: 0..1 (limbs
//                 splay out, knees / elbows point sideways: frogs, lizards), crouch: 0..1 permanent
//                 body lowering, scuff: [v0, v1, amount] paw roll at sprint speeds }
// body          { chest: { y, hh, hw }, pelvis: { y, hh, hw } torso sections at the girdles (bind,
//                 ref size: centre height, half height, half width), rump: { z, y, hh, hw } the
//                 section over the tail root, back: saddle height above the spine (m) }
// head          { carriage: [[v, raise m, reach m, pitch rad]], stab: [[v, 0..1]], neckBend: deg,
//                 neckPivot: 0..1 (share of up/down taken at the withers), yaw, pitchUp, pitchDown:
//                 look limits (rad), mouth: joint used as the mouth ('jawTip') }
// tail          { carriage: [[v, [deg per segment base -> tip]]] (resampled to the segment count),
//                 stiffness, sway (deg, stride sway), flick (cat tip flicks), wag (dog: 0..1),
//                 swish (horse / cow: 0..1), curl (curled over the back: deg at the tip), balance
//                 (cheetah turn / acceleration model 0..1), radius [base, tip] (m) }
// ears          { rest: [pitch, roll] offsets (rad), mobility: 0..1, speedFlatten: rad at speed,
//                 flattenSpeeds: [v0, v1] where they go back ([4, 14]), twitch: 0..1, prick: swivel
//                 toward the look target (rad) }
// breath        { rate Hz, amp, pant: bool, pantRate Hz, pantAmp, heatSpeed: speed that heats }
// actions       per-action tuning, see core/motion/actions.js (attack: { style }, eat: { style } ...)
// attachments   extra / overriding attachment points { name: { bone, from: joint, to?: joint, t?,
//                 offset?: [x, y, z] m at the reference size } } (animal.attachments[name])
// variants      { <params.variant>: { <key>: ... } } per-variant overrides, merged one level deep
// hooks         { actions, update(P, dt, layer), pose(engine, dt) }: species behaviour, see the
//                 "Species hooks" section of core/motion/actions.js
// Species bones the engine does not know (a snout, a dewlap, horns on their own bone) follow their
// parent bone rigidly every frame; hooks.pose may move them.
// ------------------------------------------------------------------------------------------------
import * as THREE from 'three';
import {
  TAU, DEG, clamp, lerp, smooth, wrap01, d01, angDiff, smin, Spring, tv, tvc, tq, tqc, tqa,
  UP, X1, Z1, ONE, writeFrame, prng, tableAt,
} from './common.js';
import { ActionLayer, createPostureParams } from './actions.js';

const FOOT_DEFAULTS = {
  digitigrade: { contact: 0.42, curl: 60, flex: 14, sink: 0, heelStrike: 0, couple: 0.6 },
  unguligrade: { contact: 0.8, curl: 110, flex: 6, sink: 16, heelStrike: 0, couple: 0.2 },
  plantigrade: { contact: 0.45, curl: 35, flex: 10, sink: 0, heelStrike: 14, couple: 0.6 },
};

const DEFAULTS = {
  maxSpeed: 12, accel: [6, 8], decel: 10, turnRate: 2.4, latAccelMax: 10, moveCrouch: 0.05, carpusLock: 1,
  // stride styling: bounce gain (spring-mass), stride roll, stride-to-stride variation and the braking /
  // push-off posture (0..1)
  stride: { bob: 0.5, roll: 1, vary: 1, brake: 1, bobSpring: false, gallop: 1 },
  gallopBlend: [4.5, 9],
  stance: { width: 1, gallopWidth: 0.55, sprawl: 0, crouch: 0, scuff: [12, 24, 0] },
  head: {
    carriage: [[0, 0.012, -0.012, 0], [9, -0.05, 0.04, 0.12]],
    stab: [[0, 0], [0.9, 0.22], [1.8, 0.24], [4.5, 0.32], [9, 0.6]],
    neckBend: 36, neckPivot: 0.6, yaw: 1.1, pitchUp: 0.5, pitchDown: 0.6, mouth: 'jawTip',
  },
  tail: { stiffness: 1, sway: 7, flick: 0, wag: 0, swish: 0, curl: 0, balance: 0, radius: [0.03, 0.015] },
  ears: { rest: [0, 0], mobility: 1, speedFlatten: 0.5, twitch: 1, prick: 0.3 },
  breath: { rate: 0.3, amp: 0.012, pant: false, pantRate: 2.4, pantAmp: 0.04, heatSpeed: 9 },
};

const _E = new THREE.Euler();
const FLATTEN_SPEEDS = [4, 14];
const LEG_KEYS = ['FL', 'FR', 'HL', 'HR'];
const LEN_KEYS = ['liftF', 'liftH', 'bobF', 'bobH', 'drop', 'lead'];
const GAIT_KEYS = ['f', 'D', 'liftF', 'liftH', 'bobF', 'bobH', 'flex', 'lat', 'fold', 'lead', 'heel', 'tail', 'drop', 'width'];

// mean fore / hind leg chain length (shoulder -> elbow -> wrist -> mcp, hip -> knee -> hock -> mtp) of
// a joint table ({ name: [x, y, z] }); the cheetah's reference skeleton gives CHEETAH_LEG
const CHEETAH_LEG = 0.5995;
function refLegLength(J) {
  if (!J || !J.shoulderL || !J.mcpL || !J.hipL || !J.mtpL) return CHEETAH_LEG;
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const f = d(J.shoulderL, J.elbowL) + d(J.elbowL, J.wristL) + d(J.wristL, J.mcpL);
  const h = d(J.hipL, J.kneeL) + d(J.kneeL, J.hockL) + d(J.hockL, J.mtpL);
  return (f + h) / 2;
}

// ------------------------------------------------------------------------------------------------
// config: species data + joints -> numbers the engine uses (all lengths final, in metres)
// ------------------------------------------------------------------------------------------------
function resolveConfig(spec0, data) {
  // per-variant overrides (species.motion.variants[params.variant]), merged one level deep, as in the
  // other plans (ARCHITECTURE.md: "species.motion.variants[key] overrides motion data per variant")
  const vo = spec0.variants?.[data.params?.variant];
  const spec = vo ? { ...spec0 } : spec0;
  if (vo) for (const [k, v] of Object.entries(vo)) spec[k] = v && typeof v === 'object' && !Array.isArray(v) && spec0[k] && typeof spec0[k] === 'object' && !Array.isArray(spec0[k]) ? { ...spec0[k], ...v } : v;
  const J = {};
  for (const [k, v] of Object.entries(data.joints)) J[k] = new THREE.Vector3(v[0], v[1], v[2]);
  const s = data.params?.size || (spec.refHeight ? (J.scapTopL.y / spec.refHeight) : 1);
  const sq = Math.sqrt(s);
  // k: this individual's size relative to the cheetah reference that the engine's own absolute
  // constants (clearances, re-step distances, posture offsets in metres, action timings) were tuned
  // on. Species tables are in the species' own metres at its reference size and scale by s; engine
  // constants scale by k = s * unit (lengths) and sqrt(k) (times, and speeds compared with engine
  // speed constants). unit = the reference individual's leg length (shoulder -> mcp and hip -> mtp
  // chains, from data.refJoints) / the cheetah's (CHEETAH_LEG); species.motion.unit overrides it.
  const unit = spec.unit ?? refLegLength(data.refJoints) / CHEETAH_LEG, k = s * unit;
  const merge = (a, b) => ({ ...a, ...(b || {}) });
  const cfg = {
    J, s, sq, unit, k, sk: Math.sqrt(k),
    maxSpeed: (spec.maxSpeed ?? DEFAULTS.maxSpeed) * sq,
    accel: spec.accel || DEFAULTS.accel,
    decel: spec.decel ?? DEFAULTS.decel,
    turnRate: (spec.turnRate ?? DEFAULTS.turnRate) / sq,
    latAccelMax: spec.latAccelMax ?? DEFAULTS.latAccelMax,
    moveCrouch: spec.moveCrouch ?? DEFAULTS.moveCrouch,
    carpusLock: spec.carpusLock ?? DEFAULTS.carpusLock,
    stride: merge(DEFAULTS.stride, spec.stride),
    gears: spec.gears ? Object.fromEntries(Object.entries(spec.gears).map(([k, v]) => [k, v * sq])) : { walk: 1.2 * sq, trot: 3 * sq },
    gallopBlend: spec.gallopBlend || DEFAULTS.gallopBlend,
    flexBlend: spec.flexBlend || [3.5, 6],
    gaits: (spec.gaits || []).map((g) => ({ f: 1, D: 0.6, liftF: 0.06, liftH: 0.06, bobF: 0, bobH: 0, flex: 0, lat: 0, fold: 1, lead: 0, heel: 30, tail: 0, drop: 0, width: 1, ...g })),
    stance: merge(DEFAULTS.stance, spec.stance),
    head: merge(DEFAULTS.head, spec.head),
    tail: merge(DEFAULTS.tail, spec.tail),
    ears: merge(DEFAULTS.ears, spec.ears),
    breath: merge(DEFAULTS.breath, spec.breath),
    actions: spec.actions || {},
    reachDuty: spec.reachDuty ?? 1,
    bankScale: spec.bankScale ?? 1,
  };
  if (!cfg.gaits.length) throw new Error('procedural-animals quadruped: species.motion.gaits is required');
  // lateral spine bend a turn may take (total, pelvis -> chest, rad): in proportion to how far the
  // spine flexes, read from the gait table's largest sagittal flexion (the cheetah's 0.56 rad gives
  // the 0.45 rad it was tuned with; a horse's 0.13 rad gives 0.22)
  cfg.bendMax = 0.45 * clamp(Math.sqrt(Math.max(0, ...cfg.gaits.map((g) => g.flex)) / 0.56), 0.45, 1.1);
  // speed band (reference size) of every named gait: from its first to its last table row, so a
  // forced gait (input.gait) reads a pure row of that gait, never a blend with its neighbours
  cfg.gaitBands = {};
  for (const r of cfg.gaits) { const b = cfg.gaitBands[r.name]; cfg.gaitBands[r.name] = b ? [b[0], r.v] : [r.v, r.v]; }
  // ---- girdles and spine (bind)
  cfg.zS = J.shoulderL.z; cfg.yS = J.shoulderL.y;
  cfg.zH = J.hipL.z; cfg.yH = J.hipL.y;
  const bodyDef = spec.body || {};
  const sec = (d, gy, jx, jElbow) => ({
    y: d?.y !== undefined ? d.y * s : gy - 0.25 * (gy - jElbow),
    hh: d?.hh !== undefined ? d.hh * s : 0.35 * (gy - jElbow),
    hw: d?.hw !== undefined ? d.hw * s : jx * 1.35,
  });
  cfg.chest = sec(bodyDef.chest, cfg.yS, J.shoulderL.x, J.elbowL.y);
  cfg.pelvis = sec(bodyDef.pelvis, cfg.yH, J.hipL.x, J.kneeL.y);
  // rump: the section behind the hips over the tail root (a sitting animal rests on it)
  cfg.rump = bodyDef.rump ? { ...sec(bodyDef.rump, 0, 0, 0), z: bodyDef.rump.z * s }
    : { y: cfg.pelvis.y, hh: cfg.pelvis.hh, hw: cfg.pelvis.hw * 0.8, z: lerp(cfg.zH, J.tailBase ? J.tailBase.z : cfg.zH, 0.85) };
  cfg.mid = bodyDef.mid ? sec(bodyDef.mid, 0, 0, 0) : { y: lerp(cfg.chest.y, cfg.pelvis.y, 0.5), hh: lerp(cfg.chest.hh, cfg.pelvis.hh, 0.4), hw: lerp(cfg.chest.hw, cfg.pelvis.hw, 0.5) };
  cfg.back = (bodyDef.back ?? 0.07) * s;
  // the skin's own support around the torso sections (below and to either side), measured on the mesh:
  // a lying or dead body rests on its skin, not only on the sections' nominal ellipses (a cow's belly
  // hung 124 mm below its middle section and lay that far in the ground)
  cfg.secZ = [cfg.zS, J.chestMid.z, J.thoraxRear.z, J.lumbosacral.z, cfg.zH, cfg.rump.z];
  cfg.secSup = skinMemo(data, 'torso', () => torsoSupport(data, cfg.secZ, [cfg.chest, cfg.chest, cfg.mid, cfg.pelvis, cfg.pelvis, cfg.rump]));
  // spine chain in the ground plane (x, z of the bind joints) for the girdles' offsets under a lateral
  // bend (girdleBend): thorax rear -> chest middle -> shoulder centre; thorax rear -> lumbar middle ->
  // lumbosacral -> hip centre
  cfg.chain = new Float64Array([
    J.chestMid.x - J.thoraxRear.x, J.chestMid.z - J.thoraxRear.z, -J.chestMid.x, cfg.zS - J.chestMid.z,
    J.lumbarMid.x - J.thoraxRear.x, J.lumbarMid.z - J.thoraxRear.z, J.lumbosacral.x - J.lumbarMid.x, J.lumbosacral.z - J.lumbarMid.z,
    -J.lumbosacral.x, cfg.zH - J.lumbosacral.z,
  ]);
  // ---- legs
  const feet = spec.feet || {};
  cfg.legs = LEG_KEYS.map((key, idx) => {
    const front = key[0] === 'F', S = key[1], side = S === 'L' ? 1 : -1;
    const fd = feet[front ? 'front' : 'hind'] || {};
    const type = fd.type || 'digitigrade';
    const foot = { type, ...FOOT_DEFAULTS[type], ...fd };
    const L = { key, idx, front, S, s: side, foot };
    // precomputed names / joints (string concatenation in the hot path would allocate)
    L.n = Object.fromEntries(['femur', 'tibia', 'metatarsus', 'hpaw', 'scapula', 'humerus', 'radius', 'metacarpus', 'fpaw'].map((b) => [b, b + S]));
    L.jHip = J['hip' + S]; L.jShoulder = J['shoulder' + S]; L.jScapTop = J['scapTop' + S];
    let back, M, T;
    if (front) {
      L.Lh = J['shoulder' + S].distanceTo(J['elbow' + S]);
      L.Lr = J['elbow' + S].distanceTo(J['wrist' + S]);
      L.Lmc = J['wrist' + S].distanceTo(J['mcp' + S]);
      L.pivot = J['scapTop' + S].clone().lerp(J['shoulder' + S], 0.22);
      L.len = L.Lh + L.Lr + L.Lmc;
      M = J['mcp' + S]; T = J['ftoe' + S]; back = type === 'plantigrade' ? J['wrist' + S] : M;
      // stance metacarpal tilt behind the normal (from the bind pose)
      const d = J['wrist' + S].clone().sub(M);
      L.a0 = foot.a0 !== undefined ? foot.a0 * DEG : Math.atan2(-d.z, d.y);
      L.reach = foot.reach !== undefined ? foot.reach * L.len : (L.Lh + L.Lr) * 0.95 + L.Lmc + 0.04 * L.len;
    } else {
      const H = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S];
      L.L1 = H.distanceTo(K); L.L2 = K.distanceTo(Hk); L.L3 = Hk.distanceTo(Mt);
      const u0 = K.clone().sub(H).normalize(), m0 = Mt.clone().sub(Hk).normalize();
      const e1 = Mt.clone().sub(H).normalize();
      const e2 = new THREE.Vector3(0, 0, 1).addScaledVector(e1, -e1.z).normalize();
      const n = new THREE.Vector3().crossVectors(e1, e2).normalize();
      L.delta = Math.atan2(new THREE.Vector3().crossVectors(u0, m0).dot(n), u0.dot(m0));
      const Wx = L.L1 + L.L3 * Math.cos(L.delta), Wy = L.L3 * Math.sin(L.delta);
      L.Av = Math.hypot(Wx, Wy);
      L.gamma = Math.atan2(Wy, Wx);
      L.len = L.L1 + L.L2 + L.L3;
      M = Mt; T = J['htoe' + S]; back = type === 'plantigrade' ? Hk : M;
      L.reach = (foot.reach ?? 0.975) * (L.Av + L.L2);
    }
    // ground contact point (bind) and foot points relative to it
    L.cz = lerp(back.z, T.z, foot.contact);
    L.cx = Math.abs(M.x);
    L.M = new THREE.Vector3(0, M.y, M.z - L.cz);
    L.T = new THREE.Vector3(0, T.y, T.z - L.cz);
    L.H = front ? null : new THREE.Vector3(0, J['hock' + S].y, J['hock' + S].z - L.cz);
    // pitch of the metatarsus below the horizontal that plantRest keeps at rest: feet.hind.restTilt
    // (deg), else the bind pose's
    L.mtTilt = front ? 0 : foot.restTilt !== undefined ? foot.restTilt * DEG : Math.atan2(J['hock' + S].y - J['mtp' + S].y, J['mtp' + S].z - J['hock' + S].z);
    L.plant = type === 'plantigrade';
    // hooves (optional): a hoof bone (fhoof / hhoof: coffin joint -> toe) below the pastern (fpaw /
    // hpaw: fetlock -> coffin joint). In stance the hoof stays flat while the fetlock sinks about the
    // coffin joint; breakover and the swing flip rotate the whole digit about the toe.
    const hoofName = (front ? 'fhoof' : 'hhoof') + S, Cj = J[(front ? 'fcoffin' : 'hcoffin') + S];
    if (Cj && data.bones.some((b) => b.name === hoofName)) { L.hoof = hoofName; L.C = new THREE.Vector3(0, Cj.y, Cj.z - L.cz); }
    L.leadMax = (foot.lead ?? (front ? 0.59 : 0.55)) * L.len;
    L.behindMax = (foot.liftBehind ?? (front ? 0.88 : 0.79)) * L.len;
    L.gz = front ? cfg.zS : cfg.zH;
    L.gx = front ? J['shoulder' + S].x : J['hip' + S].x;
    // skin thickness (bind) about the elbow / knee (rE: forearm / shank, the upper arm and thigh are in
    // the body wall) and the wrist / hock (rW): how far above the ground a lying leg's joint centres
    // stay (a bear's forearm is 10 cm thick at the elbow, and the fixed 5 % of the unit put its
    // sleeping forearm 19 mm into the ground)
    const r = skinMemo(data, 'leg' + key, () => (front ? {
      rE: skinRadius(data, 'radius' + S, J['elbow' + S], J['wrist' + S], 0, 0.3),
      rW: Math.max(skinRadius(data, 'radius' + S, J['elbow' + S], J['wrist' + S], 0.75, 1), skinRadius(data, 'metacarpus' + S, J['wrist' + S], J['mcp' + S], 0, 0.25)),
    } : {
      rE: skinRadius(data, 'tibia' + S, J['knee' + S], J['hock' + S], 0, 0.3),
      rW: Math.max(skinRadius(data, 'tibia' + S, J['knee' + S], J['hock' + S], 0.75, 1), skinRadius(data, 'metatarsus' + S, J['hock' + S], J['mtp' + S], 0, 0.25)),
    }));
    L.rE = r.rE; L.rW = r.rW;
    return L;
  });
  cfg.legLen = (cfg.legs[0].len + cfg.legs[2].len) * 0.5;
  // ---- tail
  cfg.tailN = 0;
  while (J['tail' + (cfg.tailN + 1)] && data.bones.some((b) => b.name === 'tail' + cfg.tailN)) cfg.tailN++;
  const n = cfg.tailN;
  const resample = (arr) => Array.from({ length: n }, (_, i) => {
    const x = n > 1 ? (i / (n - 1)) * (arr.length - 1) : 0;
    const a = Math.floor(x), b = Math.min(arr.length - 1, a + 1);
    return lerp(arr[a], arr[b], x - a) * DEG;
  });
  if (n) {
    const bindPitch = Array.from({ length: n }, (_, i) => {
      const d = J['tail' + (i + 1)].clone().sub(J['tail' + i]);
      return Math.atan2(d.y, -d.z) / DEG;
    });
    const rows = cfg.tail.carriage || [[0, bindPitch], [3, bindPitch.map((p) => p * 0.6)], [10, bindPitch.map((p) => p * 0.3)]];
    cfg.tailCarry = rows.map(([v, arr]) => [v, ...resample(arr)]);
  }
  // ---- head
  cfg.headCarry = cfg.head.carriage.map((r) => [r[0], r[1] * s, r[2] * s, r[3]]);
  cfg.headStab = cfg.head.stab;
  // stride nod [walk, trot, gallop, phase shift] (share of the neck length): hoofed animals nod
  // clearly at the walk (a horse ~10 cm) and pump the neck at the gallop; paws carry the head
  // steadier (a cat's hardly moves)
  if (!cfg.head.nod) cfg.head.nod = (spec.feet?.front?.type || 'digitigrade') === 'unguligrade' ? [0.11, 0.05, 0.12, 0.04] : [0.035, 0.025, 0.05, 0.04];
  const mouthJ = J[cfg.head.mouth] || J.jawTip || J.nose;
  cfg.mouthLocal = mouthJ.clone().lerp(J.nose, 0.35).sub(J.occiput); // bind, relative to the occiput
  cfg.noseLocal = J.nose.clone().sub(J.occiput);
  // (the chin, for the head's ground clearance: the lowest skin of the jaw, else the jaw's tip, else
  // the mouth point: a cow's jaw reaches 5 cm below its tip joint, and a dead cow's jaw went 38 mm
  // into the ground)
  cfg.chinLocal = skinMemo(data, 'chin', () => lowestSkin(data, 'jaw', J.occiput)) || (J.jawTip ? J.jawTip.clone().sub(J.occiput) : cfg.mouthLocal);
  cfg.earLocal = J.earBaseL && J.earBaseR ? [J.earBaseL.clone().sub(J.occiput), J.earBaseR.clone().sub(J.occiput)] : null;
  // the head's widest points, left and right (horns, antlers or cheeks: skin on the head bone), bind,
  // relative to the occiput: a head lying on its side keeps them out of the ground like the ear bases
  // (a dead highland cow's horn went 0.31 m into it)
  cfg.headSide = skinMemo(data, 'headSide', () => headSides(data, J.occiput));
  cfg.headSideReach = cfg.headSide ? Math.max(...cfg.headSide.flat().map((p) => p.length())) : 0;
  cfg.neckLen = J.neckBase.distanceTo(J.neckMid) + J.neckMid.distanceTo(J.occiput);
  cfg.hasJaw = data.bones.some((b) => b.name === 'jaw');
  cfg.hasEars = data.bones.some((b) => b.name === 'earL');
  return cfg;
}

// Skin measurements of a built mesh (pure functions of its data: every animal built from it shares
// them, read only; a hero mesh has 140k vertices)
const SKIN = new WeakMap();
function skinMemo(data, key, fn) {
  let m = SKIN.get(data);
  if (!m) SKIN.set(data, (m = new Map()));
  if (!m.has(key)) m.set(key, fn());
  return m.get(key);
}

// Support of the torso's skin about each section (bind centre (0, sec.y, z)): for directions
// d = (sin th, -cos th, 0), th = -90 .. 90 deg in SUP_N steps (straight down at the middle), the largest
// (p - c) . d over the visible skin carried mostly by the torso bones, each vertex counted at the
// section nearest to it along the body
const SUP_N = 13, TORSO_RE = /^(spine[123]|chest|pelvis)$/;
function torsoSupport(data, zs, secs) {
  const bones = data.bones, P = data.pos, SI = data.skinIndex, SW = data.skinWeight, coat = data.coat;
  if (!bones || !P || !SI || !SW) return null;
  const isT = Uint8Array.from(bones, (b) => (TORSO_RE.test(b.name) ? 1 : 0));
  const sup = zs.map(() => new Float64Array(SUP_N).fill(-Infinity));
  const sn = Float64Array.from({ length: SUP_N }, (_, j) => Math.sin((j / (SUP_N - 1) - 0.5) * Math.PI));
  const cs = Float64Array.from({ length: SUP_N }, (_, j) => Math.cos((j / (SUP_N - 1) - 0.5) * Math.PI));
  for (let v = 0, nv = P.length / 3; v < nv; v++) {
    if (coat && coat[v * 4 + 3] < 0.5) continue;
    let w = 0;
    for (let k = 0; k < 4; k++) if (isT[SI[v * 4 + k]]) w += SW[v * 4 + k];
    if (w < 0.5) continue;
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    let kb = 0;
    for (let k = 1; k < zs.length; k++) if (Math.abs(z - zs[k]) < Math.abs(z - zs[kb])) kb = k;
    const T = sup[kb], dy = y - secs[kb].y;
    for (let j = 0; j < SUP_N; j++) { const h = x * sn[j] - dy * cs[j]; if (h > T[j]) T[j] = h; }
  }
  return sup;
}

const EAR_PTS = 13;
// an ear's skin extremes (bind, relative to its base B; visible skin of weight >= 0.5, beyond 0.3 of
// the ear's length): the farthest along the ear, and the farthest to either side across it and front
// / back; reach: the largest distance of them from the base
function earRim(data, bone, B, T) {
  const bi = data.bones ? data.bones.findIndex((b) => b.name === bone) : -1;
  const P = data.pos, SI = data.skinIndex, SW = data.skinWeight, coat = data.coat;
  if (bi < 0 || !P || !SI || !SW) return { pts: null, reach: 0 };
  const a = new THREE.Vector3().subVectors(T, B), L = a.length();
  if (L < 1e-9) return { pts: null, reach: 0 };
  a.multiplyScalar(1 / L);
  const u = new THREE.Vector3(1, 0, 0).addScaledVector(a, -a.x);
  if (u.lengthSq() < 1e-6) u.set(0, 0, 1).addScaledVector(a, -a.z);
  u.normalize();
  const w = new THREE.Vector3().crossVectors(a, u);
  // (along the ear, 8 ways across it, and 4 half way between)
  const dirs = [a];
  for (let j = 0; j < 8; j++) dirs.push(u.clone().multiplyScalar(Math.cos(j * Math.PI / 4)).addScaledVector(w, Math.sin(j * Math.PI / 4)));
  for (let j = 0; j < 4; j++) dirs.push(u.clone().multiplyScalar(Math.cos(j * Math.PI / 2)).addScaledVector(w, Math.sin(j * Math.PI / 2)).add(a).normalize());
  const best = dirs.map(() => -Infinity), pts = dirs.map(() => null);
  const d = new THREE.Vector3();
  for (let v = 0, n = P.length / 3; v < n; v++) {
    if (coat && coat[v * 4 + 3] < 0.5) continue;
    let wt = 0;
    for (let k = 0; k < 4; k++) if (SI[v * 4 + k] === bi) wt += SW[v * 4 + k];
    if (wt < 0.5) continue;
    d.set(P[v * 3] - B.x, P[v * 3 + 1] - B.y, P[v * 3 + 2] - B.z);
    if (d.dot(a) < 0.3 * L) continue;
    for (let j = 0; j < dirs.length; j++) { const x = d.dot(dirs[j]); if (x > best[j]) { best[j] = x; pts[j] = d.clone(); } }
  }
  if (pts.some((p) => !p)) return { pts: null, reach: 0 };
  return { pts, reach: Math.max(...pts.map((p) => p.length())) };
}

// largest distance (bind) of a bone's visible skin (weight >= 0.5) from its axis A -> B, over the part
// of the bone between t0 and t1 (0: A, 1: B)
function skinRadius(data, bone, A, B, t0, t1) {
  const bi = data.bones ? data.bones.findIndex((b) => b.name === bone) : -1;
  const P = data.pos, SI = data.skinIndex, SW = data.skinWeight, coat = data.coat;
  if (bi < 0 || !P || !SI || !SW || !A || !B) return 0;
  const ax = B.x - A.x, ay = B.y - A.y, az = B.z - A.z, l2 = ax * ax + ay * ay + az * az;
  if (l2 < 1e-12) return 0;
  let r = 0;
  for (let v = 0, n = P.length / 3; v < n; v++) {
    if (coat && coat[v * 4 + 3] < 0.5) continue;
    let w = 0;
    for (let k = 0; k < 4; k++) if (SI[v * 4 + k] === bi) w += SW[v * 4 + k];
    if (w < 0.5) continue;
    const px = P[v * 3] - A.x, py = P[v * 3 + 1] - A.y, pz = P[v * 3 + 2] - A.z;
    const t = (px * ax + py * ay + pz * az) / l2;
    if (t < t0 || t > t1) continue;
    r = Math.max(r, Math.hypot(px - t * ax, py - t * ay, pz - t * az));
  }
  return r;
}

// the lowest skin point (bind) of a bone (weight >= 0.9), relative to O
function lowestSkin(data, bone, O) {
  const bi = data.bones ? data.bones.findIndex((b) => b.name === bone) : -1;
  const P = data.pos, SI = data.skinIndex, SW = data.skinWeight;
  if (bi < 0 || !P || !SI || !SW || !O) return null;
  let best = null, by = Infinity;
  for (let v = 0, n = P.length / 3; v < n; v++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (SI[v * 4 + k] === bi) w += SW[v * 4 + k];
    if (w < 0.9 || P[v * 3 + 1] >= by) continue;
    by = P[v * 3 + 1]; best = new THREE.Vector3(P[v * 3] - O.x, P[v * 3 + 1] - O.y, P[v * 3 + 2] - O.z);
  }
  return best;
}

// The skin of the head and jaw that a head lying on its side rests on: for either side, the skin point
// farthest along each of the directions d = (+-sin th, -cos th, 0), th = 60, 90 deg (below and aside,
// and straight out: jaw / cheek, horn / antler), bind, relative to the occiput O ([left, right]).
// (With 45 and 75 deg too a highland cow's jaw and horn points could not all be cleared by a roll and
// its head fell 20 cm into the ground; with only the widest point a hereford's jaw went 34 mm in)
const SIDE_TH = [60, 90].map((d) => d * DEG);
function headSides(data, O) {
  const bones = data.bones, P = data.pos, SI = data.skinIndex, SW = data.skinWeight, coat = data.coat;
  if (!bones || !P || !SI || !SW || !O) return null;
  const isH = Uint8Array.from(bones, (b) => (b.name === 'head' || b.name === 'jaw' ? 1 : 0));
  const out = [0, 1].map(() => SIDE_TH.map(() => ({ h: -Infinity, v: -1 })));
  for (let v = 0, n = P.length / 3; v < n; v++) {
    if (coat && coat[v * 4 + 3] < 0.5) continue;
    let w = 0;
    for (let k = 0; k < 4; k++) if (isH[SI[v * 4 + k]]) w += SW[v * 4 + k];
    if (w < 0.5) continue;
    const x = P[v * 3] - O.x, y = P[v * 3 + 1] - O.y;
    for (let s = 0; s < 2; s++) for (let j = 0; j < SIDE_TH.length; j++) {
      const h = (s === 0 ? x : -x) * Math.sin(SIDE_TH[j]) - y * Math.cos(SIDE_TH[j]);
      if (h > out[s][j].h) { out[s][j].h = h; out[s][j].v = v; }
    }
  }
  if (out.some((side) => side.some((e) => e.v < 0))) return null;
  return out.map((side) => side.map((e) => new THREE.Vector3(P[e.v * 3] - O.x, P[e.v * 3 + 1] - O.y, P[e.v * 3 + 2] - O.z)));
}

// ------------------------------------------------------------------------------------------------
// module-level helpers (no closures in the hot paths: they would allocate every call)
function restHeight(sec, gy, dl) {
  // girdle joint height above the ground when the torso section rests on it (dl: world down in body frame)
  const sup = Math.sqrt((sec.hh * dl.y) ** 2 + (sec.hw * dl.x) ** 2 + (0.3 * sec.hh * dl.z) ** 2);
  return sup - (sec.y - gy) * (-dl.y);
}
function footPoint(out, c, latA, n, fwd, loc) {
  return out.copy(c).addScaledVector(latA, loc.x).addScaledVector(n, loc.y).addScaledVector(fwd, loc.z);
}
// Digit placement for a heel / hoof angle beta: beta >= 0 rolls the foot (M, and the coffin joint C
// of a hoof) up about the toe T; beta < 0 with a coffin joint sinks the fetlock M about C (hoof flat)
function placeDigit(beta, Mflat, Cf, T, latA, M, C) {
  const q = tqa(latA, beta);
  if (beta >= 0 || !Cf) {
    M.copy(Mflat).sub(T).applyQuaternion(q).add(T);
    if (C && Cf) C.copy(Cf).sub(T).applyQuaternion(q).add(T);
  } else {
    if (C) C.copy(Cf);
    M.copy(Mflat).sub(Cf).applyQuaternion(q).add(Cf);
  }
}
// Best-fit scapula protraction: minimise (reach excess)^2 + k (pr - prot0)^2 by golden-section
// search. The optimum moves continuously with the target, so the shoulder cannot jump between frames
// even when the target is out of reach. All scalar math over a Float64Array (no boxing).
const SC = new Float64Array(12);
function scapBestFit(sc, iters) {
  // (cost evaluated inline: a call returning a double would box it)
  const ax = sc[0], ay = sc[1], az = sc[2], bx = sc[3], by = sc[4], bz = sc[5];
  const wx = sc[6], wy = sc[7], wz = sc[8], lim = sc[9], p0 = sc[10], k = sc[11];
  let lo = -0.8, hi = 0.6, f1 = 0, f2 = 0;
  const gr = 0.6180339887;
  let x1 = hi - gr * (hi - lo), x2 = lo + gr * (hi - lo);
  for (let it = -2; it < iters; it++) {
    // it = -2 / -1: initial evaluations of x1 / x2
    // new probe: shrink [lo, hi] to [lo, x2] (probe below x1) or [x1, hi] (probe above x2)
    const x = it === -2 ? x1 : it === -1 ? x2 : f1 < f2 ? x2 - gr * (x2 - lo) : x1 + gr * (hi - x1);
    const co = Math.cos(x), si = Math.sin(x);
    const dx = ax * co + bx * si - wx, dy = ay * co + by * si - wy, dz = az * co + bz * si - wz;
    const e = Math.max(0, Math.sqrt(dx * dx + dy * dy + dz * dz) - lim);
    const f = e * e + k * (x - p0) * (x - p0);
    if (it === -2) f1 = f;
    else if (it === -1) f2 = f;
    else if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = x; f1 = f; }
    else { lo = x1; x1 = x2; f1 = f2; x2 = x; f2 = f; }
  }
  return 0.5 * (lo + hi);
}
function arcPoint(out, base, tB, nC, nCl, th, Ln, sArc) {
  if (th < 1e-4 || nCl < 1e-7) return out.copy(base).addScaledVector(tB, sArc);
  const R = Ln / (2 * th), a = sArc / R;
  return out.copy(base).addScaledVector(tB, R * Math.sin(a)).addScaledVector(nC, (R * (1 - Math.cos(a))) / nCl);
}
const expTo = (x, target, dt, tau) => x + (target - x) * (1 - Math.exp(-dt / tau));
// sqrt(max(0, u)) made well conditioned near u = 0: exact from u0 up; below it the cubic from 0 (zero
// slope) at u = -u0 to sqrt(u0) with the root's own slope at u = u0 (C1, slope <= 0.5 / sqrt(u0),
// within 0.375 sqrt(u0) of the root)
function softRoot(u, u0) {
  if (u >= u0) return Math.sqrt(u);
  if (u <= -u0) return 0;
  const t = (u + u0) / (2 * u0);
  return Math.sqrt(u0) * t * t * (2 - t);
}
// Tail spring chain: each segment is a damped angular spring toward a target bend relative to its
// parent (blended with an absolute target by wAbs), integrated semi-implicitly in sub steps.
const _tq = new THREE.Quaternion(), _ta = new THREE.Vector3(), _tt = new THREE.Vector3();
function integrateTail(D, Wv, U, R, n, sub, h, stiffen, wAbs) {
  const q = _tq, axis = _ta, tgt = _tt, z = 0.72;
  for (let st = 0; st < sub; st++) {
    for (let i = 0; i < n; i++) {
      if (i === 0) tgt.copy(U[0]);
      else tgt.copy(D[i - 1]).applyQuaternion(R[i]).lerp(U[i], wAbs).normalize();
      const d = D[i], w = Wv[i];
      const cosA = clamp(d.x * tgt.x + d.y * tgt.y + d.z * tgt.z, -1, 1);
      axis.crossVectors(d, tgt);
      const sn = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
      const ang = Math.atan2(sn, cosA);
      const k = sn > 1e-8 ? ang / sn : 0;
      const om = (15 + (9 - 15) * (i / Math.max(1, n - 1))) * stiffen;
      const a = om * om * h * k, damp = 1 / (1 + 2 * z * om * h);
      w.x = (w.x + axis.x * a) * damp; w.y = (w.y + axis.y * a) * damp; w.z = (w.z + axis.z * a) * damp;
      const wd = w.x * d.x + w.y * d.y + w.z * d.z; // drop spin about the segment's own axis
      w.x -= d.x * wd; w.y -= d.y * wd; w.z -= d.z * wd;
      const wl = Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z);
      if (wl > 1e-9) { axis.set(w.x / wl, w.y / wl, w.z / wl); q.setFromAxisAngle(axis, wl * h); d.applyQuaternion(q).normalize(); }
    }
  }
}
function tailDir(out, back, up, lat, p, y) {
  const cp = Math.cos(p);
  return out.copy(back).multiplyScalar(cp * Math.cos(y)).addScaledVector(up, Math.sin(p)).addScaledVector(lat, cp * Math.sin(y)).normalize();
}

// ------------------------------------------------------------------------------------------------
export function createQuadrupedMotion(ctx) { return new QuadrupedMotion(ctx); }

export class QuadrupedMotion {
  constructor({ species, data, skeleton, ground, water, position, heading = 0, emit }) {
    this.species = species;
    this.cfg = resolveConfig(species.motion || {}, data);
    const cfg = this.cfg;
    this.sk = skeleton;
    this.ground = ground || (() => 0);
    this.water = water || null;
    this.emit = emit || (() => {});
    this.rand = prng((data.seed || 1) * 7919 + 13);
    // stride-to-stride variation (its own stream, so the tail's idle randomness keeps its sequence):
    // [frequency, front lift, hind lift, bounce], each from the last stride's value to the next one's
    this.randS = prng((data.seed || 1) * 104729 + 7);
    this.sv = { a: [0, 0, 0, 0], b: [0, 0, 0, 0], x: [0, 0, 0, 0] };
    // bone lookups
    this.bone = {};
    this.bindQ = {};
    for (let i = 0; i < data.bones.length; i++) {
      const name = data.bones[i].name;
      this.bone[name] = skeleton.bones[i];
      this.bindQ[name] = new THREE.Quaternion().setFromRotationMatrix(skeleton.bind[i]);
    }
    const J = cfg.J;
    this.J = J;
    // ---- public contract
    // (climb: part of the common motion contract; the quadruped plan follows the terrain and ignores it)
    this.input = { speed: 0, heading, climb: 0, look: null, follow: null, target: null, targetSpeed: 3, crouch: 0, gait: null };
    this.pos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = heading;
    this.speed = 0;
    this.yawRate = 0;
    this.yawAcc = 0;
    // crab angle: direction of the root's motion relative to the heading. Zero when the engine steers
    // itself; in follow mode an external body may carry the animal sideways (a knock, a sharp turn of
    // the followed body) until the heading has caught up, and the feet are placed for the motion the
    // body actually makes (along the heading, a landing forefoot was left out of reach sideways)
    this.crab = 0;
    this.phase = 0;
    this.brake = 0;
    this.time = 0;
    this.heat = 0;
    this.lod = 0;
    this.frame = 0;
    this.frameDt = 1 / 60;
    this.lookTarget = new THREE.Vector3();
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
    // ---- gait sample (reused)
    this.gait = { name: 'walk', blend: 0, gallop: 0, off: [0, 0, 0, 0], DL: [0.6, 0.6, 0.6, 0.6] };
    for (const k of GAIT_KEYS) this.gait[k] = 0;
    // ---- springs
    this.bank = new Spring(0); this.pitch = new Spring(0); this.height = new Spring(0);
    this.hipY = new Spring(0); this.shY = new Spring(0);
    this.flexS = new Spring(0); this.latS = new Spring(0); this.latH = new Spring(0);
    this._latF = 0; this._latH = 0; // the locomotion's lateral spine bend, last pose (front / hind, see buildBody)
    this._poseH = heading; // heading of the last pose
    this._gb = new Float64Array(3); this._fl = new Float64Array(2);
    this.lookYaw = new Spring(0); this.headPitch = new Spring(0); this.headRollS = new Spring(0);
    this.earL = new Spring(0); this.earR = new Spring(0); this.earSwL = new Spring(0); this.earSwR = new Spring(0);
    this.jaw = new Spring(0);
    this.hx = new Spring(0); this.hy = new Spring(0); this.hz = new Spring(0);
    this.speedS = new Spring(0);
    this.breath = 0;
    this.accel = new THREE.Vector3();
    this.lastVel = new THREE.Vector3();
    this.push = new THREE.Vector3(); // external shove (hit stagger), decays
    this.lift = 0; // vertical body offset (jump flight), set by the action layer
    this.speedOverride = null; // ground speed imposed by an action (jump push-off)
    // airborne state (jump)
    this.air = { active: false, t: 0, vy: 0, y0: 0, vh: 0, T: 0 };
    // landing sag of the fore / hind girdles after a touchdown (see touchDown, pose)
    this.sag = { on: false, F: new Spring(0), H: new Spring(0), wF: 17, wH: 17 };
    // ---- legs
    this.legs = cfg.legs.map((L) => ({
      def: L, state: 'stance',
      plant: new THREE.Vector3(), plantN: new THREE.Vector3(0, 1, 0),
      liftLocal: new THREE.Vector3(), liftN: new THREE.Vector3(0, 1, 0),
      land: new THREE.Vector3(), landLocal: new THREE.Vector3(), contact: new THREE.Vector3(),
      swingT: 0, swingDur: 0.3, swingNom: 0.3, stanceTime: 0, prevPhase: 0, windowUsed: false,
      u: 0, w: 0, heelLift: 0, betaLast: 0, betaStart: 0, betaAdd: 0, kStart: -L.a0, protStart: 0, liftH: 0.05, mode: 'gait', track: false, uPace: 3, wPace: 3, betaHeel: 0, swingAmp: 1, bend: [new THREE.Vector3(), new THREE.Vector3()], bendInit: [false, false], plantFwd: new THREE.Vector3(0, 0, 1), fwdInit: false, overreach: 0, ovRate: 0, reachF: 1, reachB: -1, reachBL: -1, sweep: 0,
      idleOff: new THREE.Vector3(),
      // last IK solve: girdle joint and the targets of its stages with their lengths (predicted lift-off)
      ikJ: new THREE.Vector3(), ikT1: new THREE.Vector3(), ikT2: new THREE.Vector3(), ikM1: 0, ikM2: 0,
      protS: new Spring(0), protInit: false, toeS: new Spring(0), strS: new Spring(0), sinkS: new Spring(0), sinkLift: 0,
      // solved joint positions (world) for LOD 2 extrapolation
      jp: Array.from({ length: 7 }, () => new THREE.Vector3()),
      jp0: Array.from({ length: 7 }, () => new THREE.Vector3()),
      jpp: Array.from({ length: 7 }, () => new THREE.Vector3()), sf: [-9, -9, -9],
      solved: 0,
      // blended foot target
      ft: { c: new THREE.Vector3(), n: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(0, 0, 1), beta: 0, k: 0, dirW: 0, dir: new THREE.Vector3(0, 0, 1), free: 0 },
    }));
    // ---- tail
    const n = cfg.tailN;
    this.tail = {
      n, p: Array.from({ length: n + 1 }, () => new THREE.Vector3()),
      len: Array.from({ length: n }, (_, i) => J['tail' + i].distanceTo(J['tail' + (i + 1)])),
      D: Array.from({ length: n }, () => new THREE.Vector3()), W: Array.from({ length: n }, () => new THREE.Vector3()),
      U: Array.from({ length: n }, () => new THREE.Vector3()), rel: Array.from({ length: n }, () => new THREE.Quaternion()),
      pitch: new Float64Array(n), yaw: new Float64Array(n), carry: new Array(n).fill(0),
      init: false, prevV: 0, aFwdS: 0, aLatFast: 0, aLatSlow: 0,
      flickT: 3, flickAmp: 0, flickAge: 10, swishT: 2, swishAmp: 0, swishAge: 10,
    };
    this.tailNames = Array.from({ length: n }, (_, i) => 'tail' + i);
    this.ears = ['L', 'R'].map((S) => ({ name: 'ear' + S, base: J['earBase' + S], tip: J['earTip' + S] }));
    // the pinna's own extremes (its skin tip and rim, bind, from the ear base), kept out of the ground
    // with the tip joint: a dead bear's ear edge lay 13 mm in the ground with its tip joint clear
    for (const E of this.ears) if (E.base && E.tip) Object.assign(E, skinMemo(data, E.name, () => earRim(data, E.name, E.base, E.tip)));
    // (clearMulti's scratch: per point its clear range; the points and their floors)
    this._cm = new Float64Array(2 * (EAR_PTS + 1));
    this._cmV = Array.from({ length: EAR_PTS + 1 }, () => new THREE.Vector3());
    this._cmF = new Float64Array(EAR_PTS + 1);
    // ---- frames (preallocated, written by the body build)
    const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
    this.fr = {
      qB: Q(), qS3: Q(), qCh: Q(), qS2: Q(), qS1: Q(), qPel: Q(), qHeading: Q(),
      origin: V(), root: V(), chestMid: V(), neckBase: V(), lumbarMid: V(), lumbo: V(), tailBase: V(), hipC: V(), shC: V(),
      F: V(), Lf: V(), pos: V(), comp: 0, bs: 1,
    };
    this.qBprev = new THREE.Quaternion();
    this._headInit = false;
    this._hcv = new Float64Array(10);
    this._hc = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // ground-clearance corrections (nose, chin, ear bases, ear tips, head sides, nose / chin again), rad
    this._carry = [0, 0, 0];
    this._stab = [0];
    this._e = new THREE.Euler();
    this._scale = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    // ---- species extra bones (not driven by the engine: e.g. a twitching snout) follow their parent
    // rigidly (bind-relative) every frame; species.motion.hooks.pose(engine, dt) may then move them.
    this.hooks = species.motion?.hooks || {};
    this.params = data.params || {};
    const known = /^(pelvis|spine[123]|chest|neck[12]|head|jaw|ear[LR]|scapula[LR]|humerus[LR]|radius[LR]|metacarpus[LR]|fpaw[LR]|fhoof[LR]|femur[LR]|tibia[LR]|metatarsus[LR]|hpaw[LR]|hhoof[LR]|tail\d+)$/;
    this.extraBones = [];
    for (let i = 0; i < data.bones.length; i++) {
      const b = data.bones[i];
      if (known.test(b.name)) continue;
      const pi = data.bones.findIndex((x) => x.name === b.parent);
      if (pi < 0) continue;
      const inv = skeleton.inverses ? skeleton.inverses[pi] : skeleton.bind[pi].clone().invert();
      this.extraBones.push({ bone: skeleton.bones[i], parent: skeleton.bones[pi], rel: inv.clone().multiply(skeleton.bind[i]) });
    }
    // ---- actions / posture parameters
    this.P = createPostureParams();
    this.actionsLayer = new ActionLayer(this);
    this.actions = this.actionsLayer.names;
    // ---- attachments (bind-relative frames: +Z forward, +Y up at bind)
    this.attachmentPoints = this._attachments(data);
    this.reset(position || new THREE.Vector3(), heading);
  }

  _attachments(data) {
    const J = this.J, cfg = this.cfg;
    const at = (bone, p) => {
      const i = data.bones.findIndex((b) => b.name === bone);
      if (i < 0) return null;
      const inv = this.sk.inverses ? this.sk.inverses[i] : this.sk.bind[i].clone().invert();
      return { bone, local: new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).premultiply(inv) };
    };
    const mouth = J.occiput.clone().add(cfg.mouthLocal);
    let headP = J.occiput.clone().lerp(J.nose, 0.3);
    if (data.eyes?.length) { headP = new THREE.Vector3(); for (const e of data.eyes) headP.add(new THREE.Vector3(...e.c)); headP.multiplyScalar(1 / data.eyes.length); }
    const back = J.thoraxRear.clone().lerp(J.chestMid, 0.35);
    back.y += cfg.back;
    const out = { mouth: at('head', mouth), head: at('head', headP), back: at('spine3', back) };
    // species attachment points (saddle, stirrups, reins ...): { name: { bone, from, to?, t?, offset? } }
    // at lerp(joint from, joint to, t) + offset (m at the reference size, x = left), riding on `bone`
    for (const [k, a] of Object.entries(this.species.motion?.attachments || {})) {
      if (!J[a.from]) continue;
      const p = J[a.from].clone();
      if (a.to && J[a.to]) p.lerp(J[a.to], a.t ?? 0.5);
      if (a.offset) p.add(new THREE.Vector3(a.offset[0], a.offset[1], a.offset[2]).multiplyScalar(cfg.s));
      out[k] = at(a.bone, p);
    }
    for (const k of Object.keys(out)) if (!out[k]) delete out[k];
    return out;
  }

  // ----------------------------------------------------------------- frames
  forward(h, out) { return out.set(Math.sin(h), 0, Math.cos(h)); }
  left(h, out) { return out.set(Math.cos(h), 0, -Math.sin(h)); }
  // body-local (x = left, y = up, z = forward) -> world, about a ground point p with heading h
  bodyToWorld(lx, ly, lz, h, p, out) {
    const sh = Math.sin(h), ch = Math.cos(h);
    return out.set(p.x + ch * lx + sh * lz, p.y + ly, p.z - sh * lx + ch * lz);
  }
  terrainH(x, z) {
    const h = this.ground(x, z);
    return Number.isFinite(h) ? h : 0;
  }
  terrainN(x, z, out) {
    const e = 0.2 * this.cfg.k, h0 = this.terrainH(x, z);
    return out.set(h0 - this.terrainH(x + e, z), e, h0 - this.terrainH(x, z + e)).normalize();
  }

  reset(p, heading = this.heading) {
    const cfg = this.cfg;
    this.pos.set(p.x, 0, p.z);
    this.pos.y = this.terrainH(p.x, p.z);
    this.heading = heading;
    this.input.heading = heading;
    this.speed = 0; this.yawRate = 0; this.yawAcc = 0;
    this.velocity.set(0, 0, 0); this.lastVel.set(0, 0, 0);
    this.gaitAt(0);
    for (const leg of this.legs) {
      this.neutralContact(leg.def, 0, 0, leg.plant, leg);
      leg.contact.copy(leg.plant);
      leg.state = 'stance';
      leg.fwdInit = false;
      this.terrainN(leg.plant.x, leg.plant.z, leg.plantN);
      leg.protInit = false;
    }
    const base = this.pos.y;
    this.height.reset(base); this.hipY.reset(base); this.shY.reset(base);
    this.sag.on = false; this.sag.F.reset(0); this.sag.H.reset(0);
    this.pitch.reset(Math.atan2(this.terrainH(p.x + Math.sin(heading) * cfg.zS, p.z + Math.cos(heading) * cfg.zS) - this.terrainH(p.x + Math.sin(heading) * cfg.zH, p.z + Math.cos(heading) * cfg.zH), cfg.zS - cfg.zH));
    this._headInit = false;
    this.tail.init = false;
    this.qBprev.setFromAxisAngle(UP, heading);
  }

  // ----------------------------------------------------------------- gait
  gaitAt(vn) {
    const G = this.cfg.gaits, g = this.gait;
    let i = 0;
    while (i < G.length - 2 && vn > G[i + 1].v) i++;
    const a = G[i], b = G[Math.min(i + 1, G.length - 1)];
    const t = a === b ? 0 : smooth(0, 1, (vn - a.v) / (b.v - a.v));
    g.name = t < 0.5 ? a.name : b.name;
    g.blend = t;
    // explicit stores (keyed stores of doubles would allocate)
    g.f = lerp(a.f, b.f, t); g.D = lerp(a.D, b.D, t);
    g.liftF = lerp(a.liftF, b.liftF, t); g.liftH = lerp(a.liftH, b.liftH, t);
    g.bobF = lerp(a.bobF, b.bobF, t); g.bobH = lerp(a.bobH, b.bobH, t);
    g.flex = lerp(a.flex, b.flex, t); g.lat = lerp(a.lat, b.lat, t); g.fold = lerp(a.fold, b.fold, t);
    g.lead = lerp(a.lead, b.lead, t); g.heel = lerp(a.heel, b.heel, t); g.tail = lerp(a.tail, b.tail, t); g.drop = lerp(a.drop, b.drop, t);
    g.width = lerp(a.width, b.width, t);
    for (let j = 0; j < 4; j++) g.off[j] = wrap01(a.off[j] + d01(a.off[j], b.off[j]) * t);
    if (vn > b.v) g.f = b.f + (vn - b.v) * 0.02;
    const cfg = this.cfg;
    g.f /= cfg.sq;
    const s = cfg.s;
    g.liftF *= s; g.liftH *= s; g.bobF *= s; g.bobH *= s; g.drop *= s; g.lead *= s;
    g.gallop = smooth(cfg.gallopBlend[0], cfg.gallopBlend[1], vn);
    // moving crouch: a moving quadruped carries its girdles a little lower than it stands, so its legs
    // work from flexed joints and can sweep a full stance without reaching straight
    // (no two strides alike: a few per cent of timing, foot lift and bounce, eased across the stride)
    const sv = this.sv, sw = smooth(0, 1, this.phase), sg = 1 - 0.5 * smooth(cfg.gallopBlend[0], cfg.gallopBlend[1], vn);
    for (let i = 0; i < 4; i++) sv.x[i] = lerp(sv.a[i], sv.b[i], sw) * sg * cfg.stride.vary;
    g.f *= 1 + 0.025 * sv.x[0]; g.liftF *= 1 + 0.1 * sv.x[1]; g.liftH *= 1 + 0.1 * sv.x[2];
    g.bobF *= 1 + 0.12 * sv.x[3]; g.bobH *= 1 + 0.12 * sv.x[3];
    const cr = cfg.moveCrouch;
    g.drop += cr * Math.min(cfg.yS, cfg.yH) * smooth(0.02, 0.5, vn) * lerp(1, lerp(0.6, cfg.legs[0].foot.type === 'unguligrade' ? 1.5 : 0.8, cfg.stride.gallop), g.gallop);
    // per-leg duty factor: a stance may not sweep further than the leg reaches. The table's duty
    // factor asks for a stance sweep of v D / f; where that exceeds the leg's reachable sweep (from
    // its girdle's current height, see reachSpan) the stance is shortened (longer swing / flight),
    // so a planted foot is never dragged and the stance profiles (heel lift, flex) play out in full.
    const v = this.speed;
    for (let j = 0; j < 4; j++) {
      const sw = this.legs && this.cfg.reachDuty ? this.legs[j].sweep * this.cfg.reachDuty * (j < 2 ? 1 + (this.cfg.legs[0].foot.type === 'unguligrade' ? 0.45 : 0) * g.gallop * this.cfg.stride.gallop : 1) : 0;
      g.DL[j] = v > 1e-3 && sw > 0 ? clamp(g.f * sw / v, 0.04, g.D) : g.D;
    }
    return g;
  }

  // sideways part of the landing lead while crabbing: side-steps, only as far as the leg abducts
  crabX(L, lead) {
    if (!this.crab) return 0;
    const m = 0.12 * L.len;
    return clamp(lead * Math.sin(this.crab), -m, m);
  }

  // body-local z of the point the body turns about, the point of its axis that moves along the
  // heading (see step): by the turn's radius R = v / yaw rate against the girdle span d. In a turn
  // tighter than the body (R < 0.8 d: standing, a sharp turn at the walk) the hip joints: the
  // forequarters come round the hindquarters and the hind feet step on their line, a quadruped's turn
  // on the haunches; in a wide turn (R > 2.5 d) the girdles' midpoint, where the forefeet's and hind
  // feet's tracks are one circle. (0 in follow mode: the followed body places the root)
  turnCentre() {
    if (this.input.follow) return 0;
    const cfg = this.cfg, R = this.speed / Math.max(Math.abs(this.yawRate), 1e-4);
    return lerp(cfg.zH, 0.5 * (cfg.zS + cfg.zH), smooth(0.8, 2.5, R / (cfg.zS - cfg.zH)));
  }

  // A girdle under the locomotion's lateral spine bend (last pose): where its centre sits relative to
  // where the unbent body would carry it (heading frame: x left, z forward) and its yaw (rad), from the
  // bend of each spine joint (see buildBody). out = [dx, dz, yaw]
  girdleBend(front, out) {
    const c = this.cfg.chain;
    if (front) {
      const a1 = 0.2 * this._latF, a2 = 0.4 * this._latF;
      const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
      out[0] = c[0] * c1 + c[1] * s1 + c[2] * c2 + c[3] * s2 - c[0] - c[2];
      out[1] = -c[0] * s1 + c[1] * c1 - c[2] * s2 + c[3] * c2 - c[1] - c[3];
      out[2] = a2;
    } else {
      const b1 = -0.15 * this._latH, b2 = -0.35 * this._latH, b3 = -0.6 * this._latH;
      const c1 = Math.cos(b1), s1 = Math.sin(b1), c2 = Math.cos(b2), s2 = Math.sin(b2), c3 = Math.cos(b3), s3 = Math.sin(b3);
      out[0] = c[4] * c1 + c[5] * s1 + c[6] * c2 + c[7] * s2 + c[8] * c3 + c[9] * s3 - c[4] - c[6] - c[8];
      out[1] = -c[4] * s1 + c[5] * c1 - c[6] * s2 + c[7] * c2 - c[8] * s3 + c[9] * c3 - c[5] - c[7] - c[9];
      out[2] = b3;
    }
    return out;
  }

  // body frame turned by the locomotion's lateral bend at a leg's girdle (the chest's yaw for a
  // foreleg, the pelvis's for a hind leg, see girdleBend): the frame its paw and its knee / elbow follow
  girdleFrame(L) {
    return tqc(this.fr.qB).multiply(tqa(UP, L.front ? 0.4 * this._latF : -0.6 * this._latH));
  }

  neutralContact(L, lead, tAhead, out, leg) {
    const g = this.gait, st = this.cfg.stance;
    const width = lerp(L.cx, L.cx * st.gallopWidth, g.gallop) * st.width * g.width + st.sprawl * L.len * 0.35;
    const hp = this.heading + this.yawRate * tAhead;
    // (the body travels along heading + crab: sideways while a followed body carries it so)
    const hm = this.heading + this.crab + this.yawRate * tAhead * 0.5;
    const d = this.speed * tAhead;
    // (... and swings about its turn centre while it turns)
    const zc = this.turnCentre();
    const bx = this.pos.x + Math.sin(hm) * d + zc * (Math.sin(this.heading) - Math.sin(hp)), bz = this.pos.z + Math.cos(hm) * d + zc * (Math.cos(this.heading) - Math.cos(hp));
    // (the lead, half a stance sweep ahead of the girdle, lies along the motion too)
    let lx = width * L.s + this.crabX(L, lead), lz = L.cz + lead * Math.cos(this.crab);
    if (leg) { lx += leg.idleOff.x; lz += leg.idleOff.z; }
    // (under the girdle where the spine's lateral bend carries it, turned with it: a turn bends the
    // chest into it and the pelvis back along the track, and a foot placed in the unbent frame landed
    // up to 0.15 leg lengths to the side of its girdle, the leg slanted)
    const gb = this.girdleBend(L.front, this._gb);
    if (gb[2] !== 0) {
      const rz = lz - L.gz, c = Math.cos(gb[2]), sn = Math.sin(gb[2]);
      lz = L.gz + gb[1] - lx * sn + rz * c;
      lx = gb[0] + lx * c + rz * sn;
    }
    this._fl[0] = lx; this._fl[1] = lz; // (body-local, for the swing's landLocal)
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

  // ----------------------------------------------------------------- public API
  play(name, opts) { return this.actionsLayer.play(name, opts || {}); }
  stop(name) { this.actionsLayer.stop(name); }
  setLod(level) { this.lod = clamp(level | 0, 0, 2); return this; }
  dispose() { this.actionsLayer.clear(); }

  update(dt) {
    // a zero / invalid step (first animation frame, paused tab) would turn finite differences into NaN
    if (!(dt > 1e-4) || !Number.isFinite(dt)) dt = 1e-4;
    dt = Math.min(dt, 1 / 20);
    this.frame++;
    this.frameDt = dt;
    this.drive(dt);
    this.actionsLayer.update(dt);
    const sub = dt > 1 / 70 && this.lod === 0 ? 2 : 1;
    for (let i = 0; i < sub; i++) this.step(dt / sub);
    this.pose(dt);
    this.publish();
  }

  // steering input -> desired speed / heading (moveTo, follow, turn-on-the-spot for look targets)
  drive(dt) {
    const inp = this.input, cfg = this.cfg;
    this.wantSpeed = clamp(inp.speed || 0, 0, cfg.maxSpeed);
    this.wantHeading = inp.heading ?? this.heading;
    if (inp.target && !inp.follow) {
      const dx = inp.target.x - this.pos.x, dz = inp.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const stopR = 0.35 * cfg.k + 0.02 * this.speed;
      if (d < stopR) { inp.target = null; inp.speed = 0; this.wantSpeed = 0; this.emit('arrive', {}); }
      else {
        const want = Math.atan2(dx, dz);
        inp.heading = want;
        this.wantHeading = want;
        const ang = Math.abs(angDiff(this.heading, want));
        const brake = Math.sqrt(Math.max(0, 2 * cfg.decel * 0.8 * (d - stopR)));
        this.wantSpeed = Math.min(inp.targetSpeed || 3, cfg.maxSpeed, brake + 0.25, ang > 1.2 ? 1.5 * cfg.sk : 1e9);
      }
    }
    // posture: sitting / lying / dead animals stand up before they move
    if (this.actionsLayer.holdsStill()) {
      if (this.wantSpeed > 0.05 && !inp.follow) this.actionsLayer.requestStand();
      this.wantSpeed = 0;
      this.wantHeading = this.heading;
    } else if (!inp.follow && this.wantSpeed < 0.05) {
      // turn on the spot toward a look target that is behind
      const lt = inp.look || null;
      if (lt) {
        const want = Math.atan2(lt.x - this.pos.x, lt.z - this.pos.z);
        const off = angDiff(this.heading, want);
        if (Math.abs(off) > cfg.head.yaw * 1.05) this._turnTo = want;
        else if (this._turnTo !== undefined && Math.abs(off) < 0.3) this._turnTo = undefined;
        if (this._turnTo !== undefined) { this.wantHeading = this._turnTo; inp.heading = this._turnTo; }
      } else this._turnTo = undefined;
    }
  }

  // ----------------------------------------------------------------- simulation step
  step(dt) {
    this.time += dt;
    const cfg = this.cfg, inp = this.input, P = this.P;
    const F = this.forward(this.heading, tv());
    if (inp.follow) {
      // root placed from outside; speed and heading from its velocity
      const fv = inp.follow.velocity;
      const vx = fv ? fv.x : 0, vz = fv ? fv.z : 0;
      const sp = Math.hypot(vx, vz);
      this.speed = Math.max(0, this.speedS.step(sp, 10, dt));
      let hT = inp.follow.heading;
      if (hT === null || hT === undefined) hT = sp > 0.25 * cfg.sk ? Math.atan2(vx, vz) : this.heading;
      const wMax = cfg.turnRate * 1.8;
      // feed-forward the turn rate of the followed velocity (a pure P controller lags by
      // yawRate / 6: ~11 deg on a 5 m circle, and the animal crabs sideways over its feet)
      if (this._fH === undefined) {
        this._fH = hT; this._fW = 0;
        // follow starts while the followed body is already moving and the animal stands: the body is
        // carried at that speed from this frame on, so the gait starts at it (the speed filter
        // started from 0 and the feet stayed planted while the body moved away from them), and the
        // animal takes the body's heading, as it takes its position (a standing animal carried
        // sideways at 90 deg dragged its planted forefoot 2.5-4 % S before its heading caught up)
        if (this.speed < 0.05 * cfg.sk && sp > 0.25 * cfg.sk && !this.air.active) {
          if (Math.abs(angDiff(this.heading, hT)) > 0.3) this.reset(tv(inp.follow.position.x, 0, inp.follow.position.z), hT);
          this.speedS.reset(sp); this.speed = sp;
          this._followStart = true;
        }
      }
      this._fW = expTo(this._fW, angDiff(this._fH, hT) / dt, dt, 0.12);
      this._fH = hT;
      const wT = clamp(this._fW + angDiff(this.heading, hT) * 6, -wMax, wMax);
      const dw = clamp(wT - this.yawRate, -20 * dt, 20 * dt);
      this.yawRate += dw; this.yawAcc = dw / dt;
      this.heading += this.yawRate * dt;
      const fp = inp.follow.position;
      this.pos.x = fp.x; this.pos.z = fp.z;
      this.forward(this.heading, F);
      this.velocity.set(vx, fv ? fv.y : 0, vz);
      this.crab = sp > 1e-4 ? angDiff(this.heading, Math.atan2(vx, vz)) * smooth(0.03, 0.25, sp / cfg.sq) : 0;
    } else {
      this.crab = 0;
      // speed & heading dynamics
      let vT = this.wantSpeed * P.speedScale;
      if (this.air.active) vT = this.speed; // no traction in the air
      const vn = this.speed / cfg.sq;
      const acc = vT > this.speed ? lerp(cfg.accel[0], cfg.accel[1], smooth(2, 10, vn)) : cfg.decel;
      this.speed += clamp(vT - this.speed, -acc * dt, acc * dt);
      if (this.speedOverride !== null) this.speed = this.speedOverride; // (jump push-off)
      if (this.air.active) this.speed = this.air.vh;
      const v = this.speed;
      // pivoting on the spot is slower than turning on the move (the feet have to keep up)
      const wMax = Math.min(cfg.turnRate * lerp(0.55, 1, smooth(0.3, 2, vn)), cfg.latAccelMax / Math.max(v, 0.5 * cfg.sk)) * (this.air.active ? 0 : 1);
      // heading: a cascade, heading error -> yaw rate (capped at wMax) -> yaw acceleration (capped) ->
      // the acceleration itself, which follows with a lag (and at most 40 / k^1.5 rad/s^3): a linear
      // third-order response with a triple pole at p = 4.5 / sqrt(k) rad/s (every constant dynamically
      // similar), no overshoot, the yaw acceleration continuous, and saturation (a long turn at the rate
      // limit) settles without ringing. It was a proportional yaw-rate target slewed at a fixed 8 rad/s^2:
      // the yaw acceleration jumped from 0 to 8 in one frame on every heading command (jerk 290-770
      // rad/s^3: the body snapped into a turn), and at the same rate for a rabbit as for a horse
      const pp = 4.5 / cfg.sk, aMax = 8 / cfg.k, jMax = 40 / (cfg.k * cfg.sk);
      const wd = clamp(angDiff(this.heading, this.wantHeading) * pp / 3, -wMax, wMax);
      const ad = clamp((wd - this.yawRate) * pp, -aMax, aMax);
      this.yawAcc += clamp((ad - this.yawAcc) * (1 - Math.exp(-3 * pp * dt)), -jMax * dt, jMax * dt);
      this.yawRate += this.yawAcc * dt;
      const h0 = this.heading;
      this.heading += this.yawRate * dt;
      this.forward(this.heading, F);
      this.velocity.copy(F).multiplyScalar(v);
      this.pos.addScaledVector(F, v * dt);
      // the body turns about a point of its axis (turnCentre): the hindquarters in a turn tighter than
      // the body (standing: the forelegs walk round them, the hind feet step in place), the girdles'
      // midpoint in a wide one. It turned about its middle whatever the turn: a standing pivot swung the
      // hindquarters and tail through a wide arc (a cheetah's hips travelled 1.5 m for a half turn) and
      // a sharp turn at the walk swung them out to the outside of the turn first, like a pendulum
      const zc = this.turnCentre();
      if (zc !== 0) {
        const dx = zc * (Math.sin(h0) - F.x), dz = zc * (Math.cos(h0) - F.z);
        this.pos.x += dx; this.pos.z += dz;
        this.velocity.x += dx / dt; this.velocity.z += dz / dt;
      }
      // shove (hit stagger)
      if (this.push.lengthSq() > 1e-8) {
        this.pos.addScaledVector(this.push, dt);
        this.velocity.add(this.push);
        this.push.multiplyScalar(Math.exp(-dt * 6));
      }
    }
    if (this.heading > Math.PI * 64 || this.heading < -Math.PI * 64) this.heading = angDiff(0, this.heading);
    this.pos.y = this.terrainH(this.pos.x, this.pos.z);
    this.accel.copy(this.velocity).sub(this.lastVel).divideScalar(dt);
    this.lastVel.copy(this.velocity);
    const v = this.speed, vn = v / cfg.sq;
    // exertion
    const hs = cfg.breath.heatSpeed;
    this.heat = clamp(this.heat + dt * (vn > hs ? (vn - hs) * 0.012 : -0.035), 0, 1);

    // jump flight
    const air = this.air;
    if (air.active) {
      air.t += dt;
      const yBody = air.y0 + air.vy * air.t - 4.905 * air.t * air.t;
      this.lift = yBody - this.pos.y;
      if (air.t > 0.05 && this.lift <= 0 && air.vy - 9.81 * air.t < 0) this.touchDown();
    }

    // gait
    if (this.frame > 2) for (const leg of this.legs) this.reachSpan(leg);
    const vEff = Math.max(vn, Math.abs(this.yawRate) * 0.8);
    const moving = vEff > 0.06;
    // input.gait forces a gait: its pattern (stride frequency, duty, phase offsets, body style) at the
    // nearest speed of its band, whatever the actual speed (the stride length makes up the difference)
    // (eased in and out with a 0.12 s time constant: switching the band off in the frame the animal
    // came to a halt snapped the gait parameters - heel lift, carpal fold - of a paw still in its
    // swing from the forced gait's to standing, a 200 rad/s* pop of the metacarpus)
    const band = inp.gait ? cfg.gaitBands[inp.gait] : null;
    this._bandW = expTo(this._bandW || 0, band && moving ? 1 : 0, dt, 0.12);
    if (band) this._band = band;
    const bnd = this._band;
    const g = this.gaitAt(bnd && this._bandW > 1e-4 ? lerp(vEff, clamp(vEff, bnd[0], bnd[1]), this._bandW) : vEff);
    if (moving) {
      const ph0 = this.phase;
      this.phase = wrap01(this.phase + g.f * dt);
      if (this.phase < ph0) { const sv = this.sv; for (let i = 0; i < 4; i++) { sv.a[i] = sv.b[i]; sv.b[i] = this.randS() * 2 - 1; } }
    }
    const st = this.state.stats;
    st.gait = moving ? g.name : 'stand';
    st.freq = moving ? g.f : 0;
    st.duty = g.D;

    const legGait = P.legGait; // < 1 while a posture owns the legs
    if (this._followStart) {
      // (follow start at speed: the legs join the gait where its phase is - a leg past its stance
      // window swings now, instead of every foot holding a standing plant for the first frames)
      this._followStart = false;
      if (moving && legGait > 0.5) {
        for (const leg of this.legs) {
          const D = g.DL[leg.def.idx], p = wrap01(this.phase - g.off[leg.def.idx]);
          if (leg.state !== 'stance' || p < D) continue;
          leg.windowUsed = true;
          const remain = Math.max((1 - p) / g.f, 0.4 * (1 - D) / g.f);
          this.startSwing(leg, remain, g, false);
          leg.track = (1 - p) / g.f >= 0.4 * (1 - D) / g.f;
        }
      }
    }
    let swinging = 0;
    for (const leg of this.legs) if (leg.state === 'swing') swinging++;
    for (const leg of this.legs) {
      const L = leg.def;
      const p = wrap01(this.phase - g.off[L.idx]);
      const D = g.DL[L.idx];
      if (p < leg.prevPhase - 0.5) leg.windowUsed = false;
      if (air.active) {
        // in the air (feet tucked by the action layer): planted feet push off into a swing from
        // where they are, and a swing that ends in the air simply starts over (no footfall)
        if (leg.state === 'stance') { leg.windowUsed = true; this.startSwing(leg, Math.max(0.2, air.T * 0.6), g, false); }
        leg.swingT += dt / leg.swingDur;
        leg.w = clamp(leg.swingT, 0, 1);
        const remain = (1 - leg.w) * leg.swingDur;
        // the landing spot eases to where the stride will want the foot (the same lead as a ground
        // swing; a swing that was under way at take-off keeps its path: its target jumping would
        // snap the paw)
        const leadA = moving ? Math.min(v * (g.D / g.f) * 0.5 + (L.gz - L.cz) * smooth(0.05, 0.6, vn), L.leadMax) + g.lead : 0;
        const ea = 1 - Math.exp(-dt * 5);
        leg.landLocal.x += (L.cx * L.s + leg.idleOff.x - leg.landLocal.x) * ea;
        leg.landLocal.z += (L.cz + leadA + leg.idleOff.z - leg.landLocal.z) * ea;
        leg.landLocal.y = 0;
        this.neutralContact(L, leg.landLocal.z - L.cz - leg.idleOff.z, remain, leg.land, leg);
        if (leg.swingT >= 1) { leg.plant.copy(leg.land); leg.plantN.set(0, 1, 0); leg.betaLast = 0; this.startSwing(leg, Math.max(0.2, air.T * 0.6), g, false); }
      } else if (leg.state === 'stance') {
        leg.stanceTime += dt;
        // stance progress u: 0 at touchdown -> 1 at the expected lift-off. Integrated (continuous and
        // monotone) rather than read from the phase: a swing timed at another stride frequency or
        // gait (speeding up, braking, gait changes) lands off its phase offset, and u = p / D would
        // then start near 1 (a full heel lift in the first stance frame). In a steady gait this
        // equals p / D. ps: signed phase (a foot that landed just before its offset is early, not late)
        const ps = p > (1 + D) * 0.5 ? p - 1 : p;
        // (a stance lasts at least 0.3 D / f, see the lift-off window below)
        const tRem = Math.max((D - ps) / g.f, 0.3 * D / g.f - leg.stanceTime);
        // (at most twice the pace planned at touchdown: when the duty factor or the gait changes
        // under a planted foot, the heel must not snap up)
        if (leg.stanceTime <= dt) leg.uPace = g.f / D;
        leg.u = Math.min(1, leg.u + Math.min(tRem > dt ? (1 - leg.u) * (dt / tRem) : 1, 2 * dt * leg.uPace));
        const sc = cfg.stance.scuff;
        const slide = sc[2] * smooth(sc[0], sc[1], vn);
        if (slide > 0 && moving) {
          leg.plant.addScaledVector(F, v * slide * dt);
          leg.plant.y = this.terrainH(leg.plant.x, leg.plant.z);
        }
        if (moving) {
          // early lift-off once the planted foot trails too far behind its girdle
          const jw = this.bodyToWorld(L.gx, 0, L.gz, this.heading, this.pos, tv());
          const behind = (leg.plant.x - jw.x) * F.x + (leg.plant.z - jw.z) * F.z;
          // ... or once the leg can no longer reach it even with the heel fully raised
          // (predicted to the coming pose from the rate of the last two solves: at a gallop the paw
          // falls ~20 cm behind per frame, so waiting for the overreach itself drags it for a frame)
          // (over a fixed horizon of a 60 Hz frame x sqrt(k), not the frame: at 240 Hz one frame looked
          // 4 ms ahead, and a stance leg pulled toward full extension after a landing reached the IK's
          // singular straight-leg region before it lifted: an elbow snap the 60 Hz run never showed)
          const ovNext = leg.overreach + Math.max(0, leg.ovRate) * Math.max(this.frameDt, cfg.sk / 60);
          // ... or once it is behind the leg's reach with the heel raised (this frame's pose could not
          // reach it: at a sprint the paw falls 45 cm behind per frame)
          const rel = (leg.plant.x - this.pos.x) * F.x + (leg.plant.z - this.pos.z) * F.z - L.cz;
          // (with the heel the paw has now: reachBL, see reachSpan)
          const gone = this.frame > 2 && rel < leg.reachBL && behind < 0;
          // ... or once the leg's last IK solve, its girdle joint carried by the body's motion since
          // then, no longer reaches the planted foot's IK targets (the reach above is a model: a
          // rabbit's forefoot planted under its shoulder at a bound in a banked turn needed 103 % of
          // the leg one frame later while the model still reached it). (Over 1.02: a planted paw rolls
          // up about its toe to meet the last per cent, as a sprinting cheetah's do every stride)
          let ovP = 0;
          if (leg.ikM1 > 0) {
            const dh = this.heading - this._poseH, c = Math.cos(dh), sn = Math.sin(dh), fp = this.fr.pos;
            const jx = leg.ikJ.x - fp.x, jz = leg.ikJ.z - fp.z;
            const px = this.pos.x + jx * c + jz * sn, pz = this.pos.z - jx * sn + jz * c, py = leg.ikJ.y;
            ovP = Math.hypot(leg.ikT1.x - px, leg.ikT1.y - py, leg.ikT1.z - pz) / leg.ikM1;
            if (leg.ikM2 > 0) ovP = Math.max(ovP, Math.hypot(leg.ikT2.x - px, leg.ikT2.y - py, leg.ikT2.z - pz) / leg.ikM2);
          }
          // (a foot the leg cannot reach leaves the ground after two frames of stance at the latest,
          // wherever the phase is: dragging it is worse than an early step; but not before the frame's
          // pose has shown it planted: a sprinting cat's forefoot, planted and lifted within one sub
          // step, never touched the ground in any frame)
          const over = (behind < -L.behindMax || gone || (ovNext > 1.0 && (behind < 0 || Math.abs(this.yawRate) > 0.5)) || (ovP > 1.02 && behind < 0)) && leg.stanceTime > Math.max(Math.min(0.25 * D / g.f, 1.5 * this.frameDt), 0.99 * this.frameDt);
          if (legGait > 0.5) {
            leg.mode = 'gait';
            if (((ps >= D && leg.stanceTime > 0.3 * D / g.f) || over) && !leg.windowUsed) {
              leg.windowUsed = true;
              // never skip a swing (a late window would drag the foot through a whole cycle):
              // a short remainder gets a minimum swing that runs into the next cycle
              const remain = Math.max((1 - p) / g.f, 0.4 * (1 - D) / g.f);
              this.startSwing(leg, remain, g, false);
              // a normal swing lands on its phase offset even if the stride frequency changes meanwhile
              // (speeding up / braking); a forced minimum swing runs on its own clock
              leg.track = (1 - p) / g.f >= 0.4 * (1 - D) / g.f;
            }
          } else if (over && P.holdFeet < 0.5) {
            // a posture or action holds the legs out of the gait (legGait <= 0.5: the push-off and
            // landing of a jump at speed, a kick, dying on the move) while the body still moves: a
            // planted foot it leaves behind catches up with a minimum step instead of being dragged
            // (the bear's forefoot trailed 45 cm behind its wrist through a running jump's push-off,
            // heel raised 74 deg, and snapped forward at take-off: a 104 rad/s* elbow)
            leg.windowUsed = true;
            leg.mode = 'gait';
            this.startSwing(leg, 0.4 * (1 - D) / g.f, g, false);
            leg.track = false;
          }
        } else if (legGait > 0.5) {
          // standing: step to neutral if displaced
          leg.u = lerp(leg.u, 0.3, 1 - Math.exp(-dt * 6));
          const nC = this.neutralContact(L, 0, 0, tv(), leg);
          const err = nC.distanceTo(leg.plant);
          // (or when the planted paw has been left twisted by more than ~35 deg by a turn on the spot)
          const twist = leg.fwdInit ? leg.plantFwd.x * F.x + leg.plantFwd.z * F.z : 1;
          if ((err > 0.085 * cfg.k || twist < 0.82) && swinging === 0 && leg.stanceTime > 0.25) {
            this.startSwing(leg, 0.32 * cfg.sk, g, true);
            swinging++;
          }
        }
      } else {
        if (leg.track && moving && leg.mode === 'gait') {
          // w runs to 1 when the phase reaches the leg's touchdown offset (continuous, monotone). The
          // pace is capped at 1.6x the planned one (when a gait change pulls the offset in, the paw
          // lands a little late instead of being snapped down) and eased over 40 ms (a change of pace
          // is not a kink in the paw's path); a paw still in the air after its offset is overdue
          // (signed remaining phase) and finishes at the capped pace
          if (p < leg.prevPhase - 0.5) leg.overdue = true; // the phase wrapped past the offset
          const pr = leg.overdue ? -p : 1 - p;
          const want = pr > 0 ? Math.min((1 - leg.w) / Math.max(pr / g.f, 1e-4), 1.6 / leg.swingNom) : 1.6 / leg.swingNom;
          leg.wPace = expTo(leg.wPace, want, dt, 0.04);
          leg.swingT = Math.min(1, leg.w + leg.wPace * dt);
          leg.swingDur = 1 / Math.max(leg.wPace, 1e-3); // (remaining time = (1 - w) swingDur)
        } else leg.swingT += dt / leg.swingDur;
        leg.w = clamp(leg.swingT, 0, 1);
        const remain = (1 - leg.w) * leg.swingDur;
        // (centred on the table's stance, not the reach-shortened one: a short stance asked for a short
        // lead, which kept the next stance short; the reach still caps the landing below)
        const stanceDur = lerp(D, Math.max(D, g.D), g.gallop * cfg.stride.gallop * (L.foot.type === 'unguligrade' ? 1 : 0)) / Math.max(g.f, 1e-3);
        // land half a stance sweep ahead of the girdle so the sweep is centred under it
        // ... but never further than the leg reaches from where its girdle is now (a landing out of
        // reach leaves the paw hovering above its plant). Continuous in speed: a switch to zero at
        // the 'moving' threshold made a swinging paw jump back 4 cm as the animal came to a halt.
        let lead = Math.min(v * stanceDur * 0.5 + (L.gz - L.cz) * smooth(0.05, 0.6, vn), L.leadMax * lerp(1, 1.5, g.gallop * cfg.stride.gallop * (L.foot.type === 'unguligrade' ? 1 : 0))) + g.lead * smooth(0, 0.3, vn);
        if (this.frame > 2) lead = Math.min(lead, Math.max(leg.reachF * (L.front ? 1 + (L.foot.type === 'unguligrade' ? 0.3 : 0) * g.gallop * cfg.stride.gallop : 1), 0));
        this.neutralContact(L, lead, remain, leg.land, leg);
        leg.landLocal.set(this._fl[0], 0, this._fl[1]);
        if (leg.swingT >= 1) {
          leg.state = 'stance';
          leg.fwdInit = false; // the paw's heading is taken at the first stance pose
          leg.windowUsed = false; // a new stance always gets its own lift-off window
          leg.plant.copy(leg.land);
          this.terrainN(leg.plant.x, leg.plant.z, leg.plantN);
          leg.stanceTime = 0;
          leg.u = 0;
          if (legGait > 0.3) this.emit('footstep', { foot: L.key, position: leg.plant.clone(), speed: v, strength: clamp(0.25 + vn / 12, 0, 1) * (leg.mode === 'idle' ? 0.5 : 1) });
        }
      }
      leg.prevPhase = p;
    }
  }

  // Reach of a leg from its girdle's last pose, with the IK chain at <= 95 % of its length (the soft
  // reach limit starts at 95.5 %). Body-frame contact z (relative to L.cz, like the landing lead):
  //   leg.reachF: furthest landing point (flat foot)
  //   leg.reachB: furthest point behind at which a planted foot is still reached with the heel raised
  //               to the gait's heel angle + 30 deg of toe-off (the paw rolls up about its toe)
  // leg.sweep = reachF - reachB: the stance sweep the leg can reach.
  reachSpan(leg) {
    const L = leg.def, fr = this.fr, J = this.J, F = fr.F;
    const G = L.front ? tv().copy(L.jShoulder).sub(J.chestMid).applyQuaternion(fr.qCh).add(fr.chestMid)
      : tv().copy(L.jHip).sub(J.lumbosacral).applyQuaternion(fr.qPel).add(fr.lumbo);
    const gzW = (G.x - fr.pos.x) * F.x + (G.z - fr.pos.z) * F.z; // (frames of the last pose)
    // (a jump's landing sag (touchDown, pose) is lifting the girdle back up by its offset: a foot set
    // down now lands under a girdle that much higher, a horse's forefoot at 96 % of its reach whose
    // elbow snapped from straightening to flexing as the body went over it, 86 rad/s*)
    const gh = this.terrainH(G.x, G.z) + (this.sag.on ? Math.min(0, L.front ? this.sag.F.x : this.sag.H.x) : 0);
    // sideways offset of the foot from the girdle joint (banked turns, narrow gallop stance)
    // (a swinging foot: its planned body-frame landing offset, not the predicted world landing point,
    // which moves with the lead computed from this reach and would feed back in a turn)
    const Lf = fr.Lf;
    const lat = leg.state === 'stance' ? (leg.plant.x - G.x) * Lf.x + (leg.plant.z - G.z) * Lf.z
      : leg.landLocal.x - ((G.x - fr.pos.x) * Lf.x + (G.z - fr.pos.z) * Lf.z);
    // (plantigrade hind: the heel / hock is the point the leg must reach, see toeOff)
    const plantH = L.plant && !L.front, Mb = plantH ? L.H : L.M;
    const R0 = 0.95 * (L.front ? L.Lh + L.Lr : plantH ? L.L1 + L.L2 : L.Av + L.L2), R2 = R0 * R0 - lat * lat;
    // (the reach X = sqrt(R2 - h^2) grows as a square root near full extension, where a girdle
    // bouncing by a centimetre moved it by decimetres: a horse's straight forelegs stand there, and a
    // trot braking through that height moved a swinging forefoot's landing 4 cm in one 240 Hz frame.
    // softRoot keeps its slope bounded, dX / dh <= h / (0.15 R0) ~ 7, and is exact wherever the
    // reach exceeds 0.15 R0: a wider blend, biased either way near full extension, misplaced the
    // 2-frame sprint landings of legs that stand nearly straight, a bear's and a horse's forelegs)
    const u0 = 0.0225 * R0 * R0;
    const reach = (beta, back) => {
      // IK target relative to the contact point with the heel raised by beta (M rolls up about T;
      // front: the wrist sits above the metacarpus, tilted back by a0 and forward by 0.6 beta)
      // (beta < 0 on a hoof: the fetlock sinks about the coffin joint C instead)
      const P0 = beta < 0 && L.C ? L.C : L.T;
      const my = Mb.y - P0.y, mz = Mb.z - P0.z, cb = Math.cos(beta), sb = Math.sin(beta);
      let dy = P0.y + my * cb - mz * sb, dz = P0.z + my * sb + mz * cb;
      if (L.front) { const cp = L.foot.couple; dy += L.Lmc * Math.cos(L.a0 - cp * beta); dz += L.Lmc * Math.sin(cp * beta - L.a0); }
      const h = G.y - gh - dy;
      const X = softRoot(R2 - h * h, u0);
      return gzW + (back ? -X : X) - dz - L.cz;
    };
    // (a hoof lands with the fetlock sinking under load: reached with most of that sink, which peaks
    // early in the stance while the foot is still ahead of the girdle)
    const sink = L.C && L.foot.sink ? -0.5 * L.foot.sink * DEG * smooth(0.05, 1, this.speed / this.cfg.sq) : 0;
    leg.reachF = reach(sink, false);
    // (a planted paw whose heel roll is rate-limited has not reached the gait's heel angle yet)
    const heel = leg.state === 'stance' && leg.stanceTime > 0 ? Math.min(this.gait.heel * DEG, leg.betaHeel + 0.1) : this.gait.heel * DEG;
    leg.reachB = reach(Math.min(100 * DEG, heel + 30 * DEG), true);
    leg.sweep = leg.reachF - leg.reachB;
    // leg.reachBL: the same with the heel the paw has now, its gait heel and the toe-off already under
    // way: the toe-off is low-passed and adds 11 % of its lift in a 60 Hz frame, so a stance of a few
    // frames (a gallop) cannot count on the other 30 deg; the lift-off tests this one (a bear's
    // galloping forefoot was dragged 2-4 % S through the last frame of its stance)
    leg.reachBL = reach(Math.min(100 * DEG, heel + Math.max(0, leg.toeS.x)), true);
  }

  startSwing(leg, dur, g, idle) {
    this.worldToBody(leg.plant, leg.liftLocal);
    leg.liftN.copy(leg.plantN);
    leg.protStart = leg.state === 'stance' ? lerp(0.18, -0.25, leg.u) : -0.25;
    leg.state = 'swing';
    leg.track = false; leg.overdue = false;
    leg.mode = idle ? 'idle' : 'gait';
    leg.swingT = 0; leg.w = 0;
    leg.swingDur = leg.swingNom = Math.max(0.06, dur);
    leg.wPace = 1 / leg.swingDur;
    leg.heelLift = (idle ? 20 : g.heel) * DEG;
    // continue from the stance's actual heel angle, carpal angle and scapula protraction (no pop);
    // gait-only values: a posture blended over the gait (landing, lunge) is mixed in again on top
    leg.betaStart = leg.betaGaitLast ?? leg.betaLast ?? 0;
    leg.kStart = leg.def.front ? leg.kGait ?? leg.ft.k : 0;
    leg.toeS.reset(0); leg.betaAdd = 0; leg.sinkS.reset(0); leg.sinkLift = 0;
    leg.liftH = idle ? 0.05 * this.cfg.k : leg.def.front ? g.liftF : g.liftH;
    leg.land.copy(leg.plant);
    leg.landLocal.copy(leg.liftLocal);
  }

  // jump support (called by the action layer)
  takeOff(vy, vh) {
    const a = this.air;
    a.active = true; a.t = 0; a.vy = vy; a.vh = vh;
    a.y0 = this.pos.y + this.lift;
    a.T = (2 * vy) / 9.81;
    this.speed = vh;
    this.state.grounded = false;
    this.emit('takeoff', {});
  }
  touchDown() {
    const a = this.air;
    a.active = false;
    // the landing (see pose): the girdles take over the body's sink speed at touchdown (m/s of this
    // individual, from its own jump height, so it needs no unit factor: the old kick of the girdle
    // springs by min(4, vy) x unit m/s over-kicked every species whose unit is not 1, a horse by
    // 2.6-3.1x its sink speed, and under-kicked a rat to 0.02x) and the flight's overshoot below its
    // landing height in this step; fore 0.9x, hind 1.1x (the hindquarters give more)
    const vLand = Math.min(Math.max(0, 9.81 * a.t - a.vy), 4 * this.cfg.sk) * (this.cfg.actions.jump?.give ?? 1);
    const over = Math.min(0, this.lift), sag = this.sag, cfg = this.cfg;
    sag.F.x += over; sag.F.v -= 0.9 * vLand;
    sag.H.x += over; sag.H.v -= 1.1 * vLand;
    // absorbed by critically damped springs (peak sag = speed / (e rate)) at the rate of the body's
    // springs scaled by 1 / sqrt(k) (dynamic similarity: an animal landing from the same height in
    // leg lengths sinks as far, in leg lengths), stiffer where that would sink a girdle more than 40 %
    // of its clearance above the torso resting on the ground (the section's bottom: a rat, jumping
    // two leg lengths high, would otherwise put its belly 3 cm down on the ground)
    const w0 = 17 / cfg.sk;
    const cF = 0.4 * Math.max(1e-3 * cfg.k, cfg.chest.y - cfg.chest.hh), cH = 0.4 * Math.max(1e-3 * cfg.k, cfg.pelvis.y - cfg.pelvis.hh);
    const wF = Math.max(w0, -sag.F.v / (Math.E * cF)), wH = Math.max(w0, -sag.H.v / (Math.E * cH));
    sag.wF = sag.on ? Math.max(sag.wF, wF) : wF; sag.wH = sag.on ? Math.max(sag.wH, wH) : wH;
    sag.on = true;
    this.lift = 0;
    this.state.grounded = true;
    // resume the gait where its phase is: legs inside their stance window plant now (at the place
    // the stride expects), the others finish a swing from where the tucked foot is
    const g = this.gait, moving = this.speed / this.cfg.sq > 0.06;
    for (const leg of this.legs) {
      const L = leg.def;
      const p = wrap01(this.phase - g.off[L.idx]), D = g.DL[L.idx];
      leg.prevPhase = p;
      if (leg.state === 'swing' && !(p < D * 0.85 && leg.w > 0.6)) {
        // keep the running swing, re-timed to the stride
        leg.windowUsed = true;
        continue;
      }
      if (!moving || p < D * 0.85) {
        const u = moving ? p / D : 0.3;
        const half = moving ? Math.min(this.speed * D / g.f * 0.5, L.leadMax) : 0;
        this.neutralContact(L, half * (1 - 2 * u), 0, leg.plant, leg);
        this.terrainN(leg.plant.x, leg.plant.z, leg.plantN);
        leg.state = 'stance'; leg.stanceTime = 0; leg.u = u; leg.windowUsed = false; leg.fwdInit = false;
        this.emit('footstep', { foot: L.key, position: leg.plant.clone(), speed: this.speed, strength: 1 });
      } else {
        leg.windowUsed = true;
        leg.betaLast = 0;
        this.startSwing(leg, Math.max(0.08, (1 - p) / g.f), g, false);
      }
    }
    this.emit('land', { position: this.pos.clone(), speed: this.speed });
    this.actionsLayer.onLand();
  }

  // current contact point (on / above the ground) of a leg in the gait. Swing paths are
  // interpolated in body space so the paw moves naturally relative to the body at any speed.
  contactPoint(leg, out) {
    if (leg.state === 'stance') return out.copy(leg.plant);
    const w = leg.w, front = leg.def.front, g = this.gait;
    const a = leg.liftLocal, b = leg.landLocal;
    const s = smooth(0, 1, w * 1.05 - 0.02);
    let z = lerp(a.z, b.z, s);
    const rt = leg.def.foot.retract || 0;
    if (rt > 0 && leg.mode === 'gait') {
      // swing retraction (feet.*.retract 0..1): a Hermite path whose end tangents cancel the body's
      // speed, so the foot leaves and meets the ground at (nearly) zero ground speed instead of
      // stopping dead at touchdown; small fast animals otherwise pop in their 2-3 frame stances
      const m = -rt * Math.min(this.speed * leg.swingDur, 1.5 * Math.abs(b.z - a.z) + 0.02 * this.cfg.k);
      const w2 = w * w, w3 = w2 * w;
      z = (2 * w3 - 3 * w2 + 1) * a.z + (w3 - 2 * w2 + w) * m + (-2 * w3 + 3 * w2) * b.z + (w3 - w2) * m;
    }
    const tuck = leg.mode === 'gait' ? g.gallop : 0;
    if (front) z -= 0.12 * this.cfg.k * tuck * Math.sin(Math.PI * clamp(w / 0.55, 0, 1)) * (1 - w);
    // long-footed legs (hooves): the foot trails behind its knee in swing, so its path bows back
    const sb = leg.def.foot.swingBack;
    if (sb && leg.mode === 'gait') z -= sb * this.cfg.s * Math.sin(Math.PI * w);
    this.bodyToWorld(lerp(a.x, b.x, s), 0, z, this.heading, this.pos, out);
    // lift profile: fronts rise early and descend while reaching, hinds peak mid swing. 1 - (1 - w)^q
    // rather than w^p: the same early rise, but a finite lift-off speed (w^p, p < 1, has an infinite
    // slope at w = 0: the paw jumped ~6 cm in the first 1/240 s of a gallop swing)
    const wp = 1 - Math.pow(1 - w, front ? 1 / lerp(0.8, 0.55, tuck) : 1 / 0.85);
    const bump = Math.pow(Math.sin(Math.PI * wp), 1.1);
    const gh = this.terrainH(out.x, out.z);
    const y0 = lerp(a.y, gh, smooth(0, 0.6, w));
    // in flight the feet rise with the body (from zero at take-off), not from the ground
    let y = y0 + leg.liftH * bump + (this.air.active ? Math.max(0, this.lift) : 0);
    // never fold the foot up into the girdle (the chain direction would spin as it passes)
    const L = leg.def, fr = this.fr;
    const gy = (front ? fr.shC.y : fr.hipC.y) - (front ? 0.62 : 0.55) * L.len;
    y = smin(y, gy, 0.05 * this.cfg.k);
    out.y = Math.max(y, gh + 0.004 * bump);
    return out;
  }

  // ----------------------------------------------------------------- pose
  pose(dt) {
    const cfg = this.cfg, g = this.gait, P = this.P, J = this.J;
    const v = this.speed, vn = v / cfg.sq, s = cfg.k;
    const h = this.heading;
    const fr = this.fr;
    this.forward(h, fr.F); this.left(h, fr.Lf); fr.pos.copy(this.pos); this._poseH = h;
    fr.qHeading.setFromAxisAngle(UP, h);
    const gw8 = P.gaitW; // weight of the locomotion styling on the body

    // --- girdle loads -> vertical bounce, from the gait phase so re-timed steps never jolt the body
    // (the load follows each foot's own stance progress u, continuous from touchdown (0) to lift-off
    // (1): with the bounce applied after the body springs, a load read from the gait phase jumped
    // whenever the reach shortened a stance)
    let loadF = 0, loadH = 0;
    for (const leg of this.legs) {
      let sn;
      if (cfg.stride.bobSpring) { const pl = wrap01(this.phase - g.off[leg.def.idx]), D = g.DL[leg.def.idx]; sn = pl < D ? Math.sin(Math.PI * pl / D) : 0; }
      else {
        sn = leg.state === 'stance' && leg.mode === 'gait' ? Math.sin(Math.PI * clamp(leg.u, 0, 1)) : 0;
        // (gallop: from the table's stance window, not the stance the reach allowed: the forequarters
        // come down when the forelegs should bear the weight, and that drop is what lets them stay down)
        if (g.gallop > 0.01 && cfg.stride.gallop > 0) { const pl = wrap01(this.phase - g.off[leg.def.idx]); const sg = pl < g.D ? Math.sin(Math.PI * pl / g.D) : 0; sn = lerp(sn, sg, g.gallop * cfg.stride.gallop); }
      }
      if (leg.def.front) loadF = Math.max(loadF, sn); else loadH = Math.max(loadH, sn);
    }
    const lf = cfg.stride.bobSpring ? 1 : 1 - Math.exp(-dt * lerp(28, 21, g.gallop));
    this._loadF = (this._loadF ?? loadF) + (loadF - (this._loadF ?? loadF)) * lf; loadF = this._loadF;
    this._loadH = (this._loadH ?? loadH) + (loadH - (this._loadH ?? loadH)) * lf; loadH = this._loadH;
    const moving = vn > 0.06 || Math.abs(this.yawRate) > 0.1;
    this._bobGate = expTo(this._bobGate ?? 0, this.air.active ? 0 : 1, dt, 0.05);
    const mv = smooth(0.03, 0.4, vn + Math.abs(this.yawRate) * 0.3) * this._bobGate;
    // (spring-mass: lowest at mid stance under the girdle's load, up in the flight; mostly downward, so
    // a girdle is not raised away from feet landing or pushing off at the ends of their reach)
    // (stride.bobSpring: the bounce goes through the girdle springs as a target instead, smoothed and
    // late: hoppers, whose hops were tuned on it, land their flat hind feet clear of the ground with it)
    const bK = cfg.stride.bob, bO = cfg.stride.bobSpring ? 0.6 : 0.3;
    // (at the gallop the forequarters drop onto the landing forelegs, much more than a trot's bounce:
    // the drop is what lets a galloping foreleg sweep its long stance)
    // (paws: half the drop: their flexible backs bend into the stride, and more stretched the neck)
    const galB = 1 + (cfg.legs[0].foot.type === 'unguligrade' ? 1 : 0.5) * cfg.stride.gallop;
    let bobS = g.bobF * (bO - loadF) * 2 * bK * mv * gw8 * lerp(1, galB, g.gallop);
    let bobH = g.bobH * (bO - loadH) * 2 * bK * mv * gw8 * lerp(1, 1 + (galB - 1) * 0.25, g.gallop);
    const bobT = cfg.stride.bobSpring;
    const crouch = clamp((this.input.crouch || 0) + cfg.stance.crouch, 0, 1);

    // terrain under the girdles (max of two samples along the body when resting on the ground)
    const shG = this.bodyToWorld(0, 0, cfg.zS, h, this.pos, tv());
    const hpG = this.bodyToWorld(0, 0, cfg.zH, h, this.pos, tv());
    let tS = this.terrainH(shG.x, shG.z), tH = this.terrainH(hpG.x, hpG.z);
    if (P.groundW > 0.01) {
      const e = 0.12 * s, sh = Math.sin(h), ch = Math.cos(h);
      const m = (x, z) => Math.max(this.terrainH(x + sh * e, z + ch * e), this.terrainH(x - sh * e, z - ch * e), this.terrainH(x + ch * e * 0.6, z - sh * e * 0.6), this.terrainH(x - ch * e * 0.6, z + sh * e * 0.6));
      tS = lerp(tS, Math.max(tS, m(shG.x, shG.z)), P.groundW);
      tH = lerp(tH, Math.max(tH, m(hpG.x, hpG.z)), P.groundW);
    }
    // resting heights (girdle joint above the ground when the torso touches it), for the current roll
    const dl = tv(0, -1, 0).applyQuaternion(tqc(this.qBprev).invert());
    const restF = restHeight(cfg.chest, cfg.yS, dl), restH = restHeight(cfg.pelvis, cfg.yH, dl);
    const dropF = P.dropF + crouch * 0.3, dropH = P.dropH + crouch * 0.18;
    // (the gait's bounce is added after the body's height and pitch springs, below: through them, a
    // bounce at twice the stride frequency came out at a quarter of its size and a third of a cycle
    // late, the body highest as a trot's feet landed and sinking through the stance)
    let yShT = tS - g.drop * gw8 - dropF * (cfg.yS - restF) + (bobT ? bobS : 0);
    let yHpT = tH - g.drop * gw8 - dropH * (cfg.yH - restH) + (bobT ? bobH : 0);
    if (bobT) { bobS = 0; bobH = 0; }
    // braking and pushing off: hard braking sits the body back on its haunches (hindquarters down,
    // forequarters a little up, the head raised: solveHead), pushing off lowers it into the effort;
    // through the girdle springs, so the body rocks forward and settles as the braking ends
    const aFw = this.accel.x * fr.F.x + this.accel.z * fr.F.z;
    this._aF = expTo(this._aF ?? 0, clamp(aFw, -20 * cfg.sk, 20 * cfg.sk), dt, 0.12);
    this.brake = clamp(-this._aF / 9.81, 0, 0.9) * gw8 * smooth(0.3, 1.5, vn + 0.5) * cfg.stride.brake;
    const push = clamp(this._aF / 9.81, 0, 0.6) * gw8 * cfg.stride.brake;
    yHpT -= (0.12 * this.brake + 0.04 * push) * (cfg.yH - restH);
    yShT += (0.025 * this.brake - 0.04 * push) * (cfg.yS - restF);
    if (P.frontHW > 0) yShT = lerp(yShT, tS + P.frontH - cfg.yS, P.frontHW); // (sit: straight forelegs)
    // head reach: lower the forequarters when the mouth target is below what the neck can reach
    if (P.headReach > 0.01 && P.headW > 0.01) {
      const nbY = yShT + J.neckBase.y;
      // (the neck reaches 0.8 of its length down, less when the target is also far ahead of it)
      const dh = Math.hypot(P.headPos.x - fr.neckBase.x, P.headPos.z - fr.neckBase.z), Ln = cfg.neckLen;
      const need = nbY - (P.headPos.y + Math.min(0.8 * Ln, Math.sqrt(Math.max(0, 0.85 * Ln * Ln - dh * dh))));
      // (never lower than the chest resting on the ground)
      if (need > 0) yShT = Math.max(yShT - need * P.headReach, Math.min(yShT, tS - (cfg.yS - restF)));
    }

    // banked turn: the body leans over its feet, rolling about the ground under it (buildBody), so the
    // girdles come down by their height above the ground x (1 - cos lean) and the legs lean with it,
    // keeping their length. Restoring the upright girdle heights (as the body frame did) sheared the
    // body sideways over its feet instead: at a sprint turn's 34 deg lean a cheetah's shoulders sat
    // 0.36 m inside its feet at full height, and its forelegs could not reach the ground (4 stances in
    // 6 s of turning). In the targets, so the girdle springs and the reach limits below take it
    const bL = this.bank.x * (1 - P.groundW), cbL = Math.cos(bL), sbL = Math.sin(bL);
    yShT = tS + (yShT + cfg.yS - tS) * cbL - cfg.yS; yHpT = tH + (yHpT + cfg.yH - tH) * cbL - cfg.yH;
    // leg reach limits: lower a girdle whose stance feet are too far away (smooth minimum, faded in
    // and out over the first / last bit of stance so it never switches on abruptly)
    const lgw = P.legGait;
    if (lgw > 0.01 && !this.air.active) {
      for (const leg of this.legs) {
        if (leg.state !== 'stance') continue;
        const L = leg.def, c = leg.plant;
        // (the girdle joint where the lean carries it: in toward the turn by its upright height x sin
        // lean, and the outside one up by its half width x sin lean)
        const H0 = (L.front ? yShT + cfg.yS - tS : yHpT + cfg.yH - tH) / cbL;
        const jw = this.bodyToWorld(L.gx * cbL - H0 * sbL, 0, L.gz, h, this.pos, tv());
        const dxz = Math.hypot(jw.x - c.x, jw.z - c.z);
        const jy = L.front ? cfg.yS : cfg.yH;
        let maxY = Math.sqrt(Math.max(0.01 * s * s, L.reach * L.reach - dxz * dxz)) + c.y + 0.03 * s - L.gx * sbL - jy;
        const floor = (L.front ? tS : tH) - g.drop - crouch * 0.14 * s - lerp(0.025, 0.07, g.gallop) * s - (L.front ? dropF * (cfg.yS - restF) : dropH * (cfg.yH - restH));
        maxY = Math.max(maxY, floor);
        const w = smooth(0, 0.12, leg.u) * (1 - smooth(0.9, 1.0, leg.u) * 0.5) * lgw;
        const cur = L.front ? yShT : yHpT;
        const lim = lerp(cur, Math.min(cur, maxY), w);
        if (L.front) yShT = smin(yShT, lim + 0.004 * s, 0.03 * s); else yHpT = smin(yHpT, lim + 0.004 * s, 0.03 * s);
      }
    }
    const gw = moving ? 17 : 9;
    const om = gw * P.bodyOmega;
    let ySh = this.shY.step(yShT, om, dt);
    let yHp = this.hipY.step(yHpT, om, dt);
    const sag = this.sag;
    if (sag.on) {
      // jump landing (touchDown): the girdles start at the flight's height (its overshoot below the
      // landing height in the touchdown frame) and keep moving down at the body's sink speed, then
      // settle on critically damped springs
      ySh += sag.F.x; yHp += sag.H.x;
      sag.F.step(0, sag.wF, dt); sag.H.step(0, sag.wH, dt);
      if (Math.abs(sag.F.x) + Math.abs(sag.H.x) + Math.abs(sag.F.v) / sag.wF + Math.abs(sag.H.v) / sag.wH < 1e-5 * s) { sag.on = false; sag.F.reset(0); sag.H.reset(0); }
    }

    // body frame
    const zS = cfg.zS, zH = cfg.zH;
    const pitchT = Math.atan2(ySh - yHp, zS - zH);
    const pitch = this.pitch.step(pitchT, 16 * P.bodyOmega, dt) + P.pitch + Math.atan2(bobS - bobH, zS - zH);
    const baseY = this.height.step((ySh * -zH + yHp * zS) / (zS - zH), 20 * P.bodyOmega, dt) + (bobS * -zH + bobH * zS) / (zS - zH);
    // (leaning into a turn is dynamic balance: a walking quadruped stands on three legs and turns level,
    // a trot leans a little and a canter or gallop fully, by the Froude number v^2 / (g leg): the walk
    // leaned up to 12 deg into its turns)
    let bankT = clamp(-Math.atan2(v * this.yawRate, 9.81) * 0.85 * cfg.bankScale, -0.6, 0.6) * gw8 * smooth(0.5, 2.5, v * v / (9.81 * cfg.legLen));
    // stride roll (the body rolls toward the supporting side once a stride at the walk and trot), added
    // after the bank spring, which filtered it to a third: hoofed trotters (no lateral spine wave in
    // their table) roll too, a little less
    const rollS = Math.sin(TAU * (this.phase + 0.1)) * (g.lat > 0 ? 0.03 : 0.018) * (1 - g.gallop) * gw8 * mv * cfg.stride.roll;
    if (P.groundW > 0.01) {
      // lie along the terrain's cross slope
      const nrm = this.terrainN(this.pos.x, this.pos.z, tv());
      bankT += P.groundW * Math.atan2(nrm.dot(fr.Lf), nrm.y);
    }
    const bank = this.bank.step(bankT, 10, dt) + P.roll + rollS;

    // spine bending
    let flexT = 0, latT = 0, latTH = 0;
    if (moving && !this.air.active) {
      flexT = g.flex * Math.cos(TAU * (this.phase - 0.95)) * smooth(cfg.flexBlend[0], cfg.flexBlend[1], vn) * gw8;
      latT += g.lat * Math.sin(TAU * this.phase) * (1 - g.gallop) * gw8;
    }
    latTH = latT;
    {
      // turning: each girdle faces the way it moves. The body turns about its turn centre (turnCentre),
      // so a girdle l ahead of it moves at atan(yaw rate x l / v) off the heading (into the turn), one
      // behind it as far out of it: the chest turns into the turn and the pelvis stays back along the
      // track, which in a steady turn is the bend that lays both girdles on one circle (girdle span /
      // radius) and in a changing one follows the track's own lag. Soft-limited by the spine's
      // flexibility (cfg.bendMax; latT / latTH are the front / hind bends of buildBody, which turn the
      // chest by 0.4 and the pelvis by 0.6 of theirs). It was 0.55 x yaw rate / (0.35 v + 0.6) for both
      // halves, saturated at 0.45 rad in every walking turn of every species (a horse bent 26 deg)
      const zc = this.turnCentre(), vE = Math.max(v, 0.6 * cfg.sk), w = this.yawRate;
      let cS = Math.atan2(w * Math.max(0, cfg.zS - zc), vE), cH = Math.atan2(w * Math.max(0, zc - cfg.zH), vE);
      const tot = Math.abs(cS) + Math.abs(cH), bm = cfg.bendMax;
      if (tot > 1e-6) { const k = bm * Math.tanh(tot / bm) / tot; cS *= k; cH *= k; }
      latT += cS / 0.4 * gw8; latTH += cH / 0.6 * gw8;
    }
    const flex = this.flexS.step(flexT, 40, dt) + P.flex;
    const lat = this.latS.step(latT, 18, dt) + P.bend;
    const latH = this.latH.step(latTH, 18, dt) + P.bend;
    // (the locomotion's own bend, without a posture's: the feet follow it, not a sleeping curl)
    this._latF = this.latS.x; this._latH = this.latH.x;
    fr.comp = 0.11 * s * Math.max(-0.5, flex);
    // breathing
    const hb = cfg.breath;
    this.breath += dt * TAU * lerp(hb.rate, hb.pant ? hb.pantRate : hb.rate * 2.5, this.heat) * P.breathRate;
    const bAmp = lerp(hb.amp, hb.pant ? hb.pantAmp : hb.amp * 2, this.heat) * P.breathAmp;
    fr.bs = 1 + Math.sin(this.breath) * bAmp;

    // body origin: ground point + height + posture offsets (lunge, jump flight)
    const origin = fr.origin.set(this.pos.x, baseY + this.lift + P.lift, this.pos.z);
    origin.addScaledVector(fr.F, P.fwd * s).addScaledVector(fr.Lf, P.side * s);
    this.buildBody(origin, pitch, bank, flex, lat, latH);
    // keep the girdles where the legs want them while the spine arches
    // (in a banked turn the girdle targets already hold the leaned heights, see above)
    const eS = ySh + bobS + this.lift + P.lift + cfg.yS - fr.shC.y, eH = yHp + bobH + this.lift + P.lift + cfg.yH - fr.hipC.y;
    origin.y += (eS + eH) * 0.5;
    let pitch2 = pitch + Math.atan2(eS - eH, zS - zH);
    this.buildBody(origin, pitch2, bank, flex, lat, latH);
    // resting on the ground: lift / tilt the torso so its chest, middle and pelvis sections sit on
    // the terrain under them instead of in it
    // (while the body is down: the posture's ground weight fades as soon as it stands up, and a cow
    // rising hind end first, its chest still down, lay 53 mm in the ground half way up)
    const wLie = Math.min(1, Math.max(P.groundW, P.dropF, P.dropH));
    for (let it = 0; it < 2 && wLie > 0.01; it++) {
      // sections along the torso: [section, bind z, frame origin, frame joint, frame quaternion]
      let dF = 0, dH = 0;
      for (let k = 0; k < 6; k++) {
        const sc = k < 2 ? cfg.chest : k === 2 ? cfg.mid : k === 5 ? cfg.rump : cfg.pelvis;
        const z = k === 0 ? zS : k === 1 ? J.chestMid.z : k === 2 ? J.thoraxRear.z : k === 3 ? J.lumbosacral.z : k === 4 ? zH : cfg.rump.z;
        const pen = k < 2 ? this.sectionPen(sc, z, fr.chestMid, J.chestMid, fr.qCh, k)
          : k === 2 ? this.sectionPen(sc, z, fr.root, J.thoraxRear, fr.qS3, k)
            : this.sectionPen(sc, z, fr.lumbo, J.lumbosacral, fr.qPel, k);
        if (pen <= 0) continue;
        // least-norm girdle lifts that raise this point by pen
        const a = clamp((zS - z) / (zS - zH), 0, 1), nn = (1 - a) * (1 - a) + a * a;
        dF = Math.max(dF, pen * (1 - a) / nn); dH = Math.max(dH, pen * a / nn);
      }
      dF *= wLie; dH *= wLie;
      if (dF > 1e-5 || dH > 1e-5) {
        origin.y += (dF * -zH + dH * zS) / (zS - zH);
        pitch2 += Math.atan2(dF - dH, zS - zH);
        this.buildBody(origin, pitch2, bank, flex, lat, latH);
      }
    }
    this.qBprev.copy(fr.qB);
    const bs = fr.bs, l2 = J.thoraxRear.distanceTo(J.lumbarMid);
    this.setBoneQ('spine3', fr.root, fr.qS3, this._scale.set(bs, 1, 1 + (bs - 1) * 0.6));
    this.setBoneQ('chest', fr.chestMid, fr.qCh, this._scale.set(1 + (bs - 1) * 0.6, 1, 1 + (bs - 1) * 0.4));
    this.setBoneQ('spine2', fr.lumbarMid, fr.qS2, this._scale.set(1 + (bs - 1) * 0.5, 1 - fr.comp / l2, 1 + (bs - 1) * 0.5));
    this.setBoneQ('spine1', fr.lumbo, fr.qS1, ONE);
    this.setBoneQ('pelvis', fr.lumbo, fr.qPel, ONE);

    // legs
    const lodSkip = this.lod === 2 && (this.frame & 1) === 1;
    for (let i = 0; i < 4; i++) {
      const leg = this.legs[i];
      // (only swinging legs whose last three solves were exactly two frames apart)
      const f = this.frame, sf = leg.sf;
      if (lodSkip && sf[2] === f - 1 && sf[1] === f - 3 && sf[0] === f - 5 && leg.state === 'swing' && leg.w < 0.9 && this.P.legGait > 0.99) this.extrapolateLeg(leg);
      else this.solveLeg(leg, dt);
    }
    this.solveHead(dt);
    if (cfg.tailN) this.solveTail(dt);
    for (const x of this.extraBones) x.bone.matrixWorld.multiplyMatrices(x.parent.matrixWorld, x.rel);
    if (this.hooks.pose) this.hooks.pose(this, dt);
  }

  // spine chain from an origin (ground point + height), pitch, bank, flexion and lateral bend
  buildBody(origin, pitchA, bank, flex, lat, latH = lat) {
    const fr = this.fr, J = this.J, cfg = this.cfg;
    const bend = this._bend;
    fr.qB.setFromAxisAngle(UP, this.heading).multiply(tqa(X1, -pitchA)).multiply(tqa(Z1, bank));
    fr.root.copy(J.thoraxRear).applyQuaternion(fr.qB).add(origin);
    bend(fr.qS3.copy(fr.qB), flex * 0.07, lat * 0.2, true);
    fr.chestMid.copy(J.chestMid).sub(J.thoraxRear).applyQuaternion(fr.qS3).add(fr.root);
    bend(fr.qCh.copy(fr.qS3), flex * 0.045, lat * 0.2, true);
    fr.neckBase.copy(J.neckBase).sub(J.chestMid).applyQuaternion(fr.qCh).add(fr.chestMid);
    bend(fr.qS2.copy(fr.qB), flex * 0.1, latH * 0.15, false);
    const l2 = J.thoraxRear.distanceTo(J.lumbarMid);
    fr.lumbarMid.copy(J.lumbarMid).sub(J.thoraxRear).multiplyScalar(1 - fr.comp / l2).applyQuaternion(fr.qS2).add(fr.root);
    bend(fr.qS1.copy(fr.qS2), flex * 0.35, latH * 0.2, false);
    fr.lumbo.copy(J.lumbosacral).sub(J.lumbarMid).applyQuaternion(fr.qS1).add(fr.lumbarMid);
    bend(fr.qPel.copy(fr.qS1), flex * 0.35, latH * 0.25, false);
    fr.tailBase.copy(J.tailBase).sub(J.lumbosacral).applyQuaternion(fr.qPel).add(fr.lumbo);
    fr.hipC.set(0, cfg.yH, cfg.zH).sub(J.lumbosacral).applyQuaternion(fr.qPel).add(fr.lumbo);
    fr.shC.set(0, cfg.yS, cfg.zS).sub(J.chestMid).applyQuaternion(fr.qCh).add(fr.chestMid);
  }

  // how far a torso section (bind centre (0, sec.y, z), carried by frame (o, jo, q)) dips into the terrain
  sectionPen(sec, z, o, jo, q, ks) {
    const c = tv(0, sec.y, z).sub(jo).applyQuaternion(q).add(o);
    const dl = tv(0, -1, 0).applyQuaternion(tqc(q).invert());
    let sup = Math.sqrt((sec.hh * dl.y) ** 2 + (sec.hw * dl.x) ** 2), hw = sec.hw;
    // (or the skin's own support there, where it reaches further: cfg.secSup)
    const T = ks !== undefined && this.cfg.secSup ? this.cfg.secSup[ks] : null;
    if (T && T[0] > -Infinity) {
      const rxy = Math.hypot(dl.x, dl.y), u = clamp((Math.atan2(dl.x, -dl.y) / Math.PI + 0.5) * (SUP_N - 1), 0, SUP_N - 1);
      const j = Math.min(SUP_N - 2, Math.floor(u)), f = u - j;
      sup = Math.max(sup, rxy * (T[j] + (T[j + 1] - T[j]) * f));
      hw = Math.max(hw, T[0], T[SUP_N - 1]);
    }
    // the lowest point moves sideways when rolled: sample the terrain there too
    const side = tv(1, 0, 0).applyQuaternion(q);
    const k = hw * clamp(-side.y * 1.2, -1, 1);
    const gx = c.x + side.x * k, gz = c.z + side.z * k;
    const t = Math.max(this.terrainH(c.x, c.z), this.terrainH(gx, gz));
    return Math.max(0, t - (c.y - sup));
  }

  _bend(q, f, l, fwd) { return q.multiply(tq().setFromEuler(_E.set(fwd ? f : -f, fwd ? l : -l, 0, 'XYZ'))); }

  // bone writers: q relative to bind (world = q * bind), or a frame (dirY, latX) directly
  setBoneQ(name, head, q, scale) {
    const b = this.bone[name];
    if (!b) return;
    b.matrixWorld.compose(head, this._q.copy(q).multiply(this.bindQ[name]), scale || ONE);
  }
  setBoneF(name, head, dirY, latX) {
    const b = this.bone[name];
    if (!b) return;
    writeFrame(b.matrixWorld, head, dirY, latX);
  }

  // ----------------------------------------------------------------- legs
  // Gait foot target blended with the posture's leg modes (fold, sit, side, tuck, reach).
  footTarget(leg) {
    const L = leg.def, g = this.gait, ft = leg.ft, fr = this.fr, cfg = this.cfg, s = cfg.k;
    const P = this.P, pl = P.legs[L.idx];
    const c = this.contactPoint(leg, ft.c);
    leg.contact.copy(c);
    const n = ft.n;
    if (leg.state === 'stance') n.copy(leg.plantN);
    else n.copy(leg.liftN).lerp(this.terrainN(leg.land.x, leg.land.z, tv()), smooth(0, 1, leg.w)).normalize();
    // paw frame: along the leg's girdle (the chest / pelvis, which a turn bends out of the heading:
    // along the heading the paws landed up to 15 deg off their girdle; the locomotion's bend only,
    // girdleFrame)
    const bodyF = tv(0, 0, 1).applyQuaternion(this.girdleFrame(L));
    ft.fwd.copy(bodyF).addScaledVector(n, -bodyF.dot(n)).normalize().applyAxisAngle(n, L.s * (L.foot.toeOut ?? 0.06));
    // a paw set down in a turn is set down turned into it by half the turn its stance will see, so the
    // leg twists above it by half as much either way (it twisted through the whole stance's turn, up
    // to 45 deg at a walking turn and 75 deg in a standing pivot)
    if ((leg.state === 'swing' || !leg.fwdInit) && leg.mode === 'gait') {
      const pre = clamp(0.5 * this.yawRate * g.DL[L.idx] / Math.max(g.f, 1e-3), -0.4, 0.4);
      if (Math.abs(pre) > 1e-5) ft.fwd.applyAxisAngle(n, pre);
    }
    // a planted paw keeps the heading it landed with (the leg twists above it when the body turns;
    // a paw yawing about its contact point would scrub its toes and heel over the ground); it turns
    // back to the body's heading early in the swing
    if (leg.state === 'stance') {
      if (leg.fwdInit) ft.fwd.copy(leg.plantFwd).addScaledVector(n, -leg.plantFwd.dot(n)).normalize();
      else { leg.plantFwd.copy(ft.fwd); leg.fwdInit = true; }
    } else if (leg.fwdInit) {
      const k = smooth(0, 0.5, leg.w);
      if (k < 1) ft.fwd.lerp(tv().copy(leg.plantFwd).addScaledVector(n, -leg.plantFwd.dot(n)), 1 - k).normalize();
    }
    // heel lift / toe curl (radians, + raises the heel about the toe tip)
    const foot = L.foot;
    const gaitMode = leg.mode === 'gait' ? 1 : 0;
    let beta = 0;
    if (leg.state === 'stance') {
      beta = g.heel * DEG * smooth(0.55, 1.0, leg.u) * gaitMode;
      // the heel rolls up no faster than the leg pivots over the paw (~ v / leg length): in a very
      // short stance (sprint, tight banked turn) the paw is still rolling as it lifts off
      const rate = Math.max(12, 2.2 * this.speed / L.len) * this.frameDt;
      if (leg.stanceTime > 0 && beta > leg.betaHeel + rate) beta = leg.betaHeel + rate;
      leg.betaHeel = beta;
      if (foot.sink) beta -= foot.sink * DEG * Math.sin(Math.PI * clamp(leg.u / 0.8, 0, 1)) * smooth(0.05, 1, this.speed / cfg.sq) * gaitMode;
      if (foot.heelStrike) beta -= foot.heelStrike * DEG * (1 - smooth(0, 0.15, leg.u)) * gaitMode;
    } else {
      const w = leg.w;
      // a swing shorter than the gait's nominal one (a quick re-step after a landing, a forced
      // minimum swing) folds the paw less, so it does not fold faster
      const nom = (1 - g.DL[L.idx]) / Math.max(g.f, 1e-3);
      leg.swingAmp = gaitMode ? clamp(leg.swingNom / nom, 0.35, 1) : 1;
      // (the toe curl / hoof flip is half at the walk: a walking horse's hoof barely flips, and the
      // full flip, carried into the cannon, folded the knee 100 deg in a tenth of a second)
      const walkC = lerp(0.5, 1, smooth(0.35, 0.6, 1 - g.D));
      beta = leg.betaStart * (1 - smooth(0.0, 0.45, w)) + foot.curl * DEG * walkC * Math.sin(Math.PI * w) * smooth(0.05, 0.3, w) * (1 - smooth(0.75, 1, w)) * (gaitMode ? 1 : 0.4) * leg.swingAmp;
      // (gait steps only, like the stance side: an idle re-step landed toe-up and snapped flat)
      if (foot.heelStrike) beta -= foot.heelStrike * DEG * smooth(0.7, 1, w) * gaitMode;
    }
    ft.beta = beta;
    // front: metacarpal angle from the normal (stance: tilted back, swing: carpal fold)
    if (L.front) {
      if (leg.state === 'stance') ft.k = -(L.a0 + foot.flex * DEG * Math.sin(Math.PI * leg.u) * (gaitMode ? 1 : 0.3));
      else {
        // swing: from the stance's last angle (an early lift-off leaves the carpus flexed) into the
        // fold and back to the landing angle; C1 at both ends (no angular-velocity step at lift-off /
        // touchdown)
        // (hooves: the knee folds through the first half of the swing and opens over the second, into
        // the carpal lock above)
        const hoofS = L.foot.type === 'unguligrade' && cfg.carpusLock > 0;
        const w = leg.w, fold = hoofS ? smooth(0, 0.4, w) * (1 - smooth(0.42, 0.95, w)) : smooth(0, 0.45, w) * (1 - smooth(0.55, 1, w));
        ft.k = lerp(leg.kStart, -L.a0, smooth(0, 0.35, w)) + (g.fold * (gaitMode ? 1 : 0.45) + L.a0) * fold * leg.swingAmp;
      }
    }
    ft.dirW = 0;
    ft.free = 0;
    if (L.plant && !L.front) {
      // plantigrade: the metatarsus lies along the foot in stance
      // (rolled with the heel lift / toe-up like the digits: a metatarsus held flat while the heel
      // rises pulled the whole foot off the ground at push-off)
      // (feet.hind.swingFlat 0..1: share of that direction kept through the swing: a Z-folded frog leg,
      // whose pantograph (metatarsus parallel to the femur) would fold the knee up over the hip)
      ft.dirW = leg.state === 'stance' ? 1 : 1 - Math.sin(Math.PI * leg.w) * (1 - (foot.swingFlat || 0));
      // (at the bind pose's metatarsal pitch: the hock sits above the heel pad)
      ft.dir.copy(ft.fwd).multiplyScalar(Math.cos(L.mtTilt)).addScaledVector(n, -Math.sin(L.mtTilt)).applyAxisAngle(tv().crossVectors(n, ft.fwd).normalize(), beta);
    } else if (foot.plantRest && !L.front) {
      // feet.hind.plantRest (rabbit): flat on the ground at rest and in postures (the heel stays
      // down whatever the body does), on the toes once the animal moves off
      // (fading out over a swing and back in before touchdown, so steps start and end smoothly)
      const rest = (1 - smooth(0.03, 0.35, this.speed / cfg.sq) * gaitMode * this.P.legGait) * (leg.state === 'stance' ? 1 : 1 - Math.sin(Math.PI * leg.w));
      if (rest > 1e-3) {
        ft.dirW = rest;
        ft.dir.copy(ft.fwd).multiplyScalar(Math.cos(L.mtTilt)).addScaledVector(n, -Math.sin(L.mtTilt));
      }
    }
    // gait-only values (before the posture blend below), the swing's starting point at lift-off
    leg.betaGait = ft.beta; leg.kGait = ft.k;
    // ---- posture leg modes
    const wSum = pl.fold + pl.sit + pl.side + pl.tuck + pl.reach;
    if (wSum < 1e-4) return ft;
    const lx = L.cx * L.s, gy = L.front ? cfg.yS : cfg.yH;
    const tmpC = tv(), tmpN = tv(), tmpF = tv(), tmpD = tv();
    const mixIn = (w, beta2, k2, dirW2, wc = w) => {
      if (w < 1e-4) return;
      ft.c.lerp(tmpC, wc); ft.n.lerp(tmpN, w).normalize(); ft.fwd.lerp(tmpF, w);
      ft.fwd.addScaledVector(ft.n, -ft.fwd.dot(ft.n)).normalize();
      ft.beta = lerp(ft.beta, beta2, w); ft.k = lerp(ft.k, k2, w);
      if (dirW2 > 0) { ft.dir.lerp(tmpD, w / Math.max(1e-4, ft.dirW + w)).normalize(); }
      ft.dirW = lerp(ft.dirW, dirW2, w);
    };
    const bw = (lxx, ly, lz, out) => out.set(lxx, ly, lz).applyQuaternion(fr.qB).add(fr.origin);
    // ground placements use the heading frame (a pitched / rolled body must not swing them around)
    const hw = (lxx, lz, out) => this.bodyToWorld(lxx, 0, lz + P.fwd * s, this.heading, this.pos, out);
    const onGround = (p) => { p.y = this.terrainH(p.x, p.z); return p; };
    const hN = (p, out) => this.terrainN(p.x, p.z, out);
    const fwdFlat = (out) => out.copy(fr.F);
    if (pl.fold > 0) {
      // folded under the body (lying sternal): forelegs forward along the ground (sphinx),
      // hind legs folded with the metatarsus flat and the paw beside the elbow
      // (actions.fold.front = { z, k, beta }: folded under the chest instead (hoofed animals kneel):
      //  hoof at zS + z * leg length, metacarpal angle k (rad), hoof flip beta (rad))
      const fo = L.front ? cfg.actions.fold?.front : null;
      if (L.front) onGround(hw(lx * 1.05, fo ? cfg.zS + fo.z * L.len : cfg.zS + 0.5 * L.Lr + L.Lmc, tmpC));
      else onGround(hw(lx * 1.7 + L.s * 0.04 * s, cfg.zH + L.L1 * 0.75 + L.L3 * 0.5, tmpC));
      hN(tmpC, tmpN); fwdFlat(tmpF);
      tmpD.copy(tmpF);
      mixIn(pl.fold, fo ? fo.beta || 0 : 0, L.front ? (fo ? fo.k : -1.45) : 0, L.front ? 0 : 1);
    }
    if (pl.sit > 0) {
      // sitting: forelegs straight under the chest, hind feet flat beside the haunches
      if (L.front) {
        // under the (raised, pitched-back) shoulder
        const shz = (fr.shC.x - this.pos.x) * fr.F.x + (fr.shC.z - this.pos.z) * fr.F.z - P.fwd * s;
        onGround(hw(lx, shz + 0.02 * L.len, tmpC));
      } else onGround(hw(lx * 1.35, cfg.zH + L.L1 * 0.7 + L.L3 * 0.4, tmpC));
      hN(tmpC, tmpN); fwdFlat(tmpF); tmpD.copy(tmpF);
      // (hind: the paw stays where it stood while the haunches go down and the hock folds over it,
      // then steps forward to beside the haunch in a short lifted step; it slid forward along the
      // ground through the whole sit, the legs straightening out ahead of the lowering rump)
      let wc = pl.sit;
      if (!L.front) { wc = smooth(0.4, 0.95, pl.sit); tmpC.y += Math.sin(Math.PI * wc) * 0.1 * L.len; }
      // (hooves: the hind hoof flips back so the cannon and the hock rest on the ground; standing on its
      // toe it held the hock and the cannon in the air and the rump off the ground)
      const flipH = !L.front && L.foot.type === 'unguligrade' && L.C ? -48 * DEG : 0;
      mixIn(pl.sit, flipH, L.front ? -L.a0 * 0.6 : 0, L.front ? 0 : 1, wc);
    }
    if (pl.side > 0) {
      // lying on the side: legs out from the body, resting on the ground
      const out = pl.spread;
      const lz = (L.front ? cfg.zS + 0.18 * L.len : cfg.zH - 0.02 * L.len) + (L.s * Math.sign(P.roll || 1) > 0 ? 0.12 : 0) * L.len * out;
      bw(lx * 1.2, gy - L.len * lerp(0.85, 0.95, out), lz, tmpC);
      const gh = this.terrainH(tmpC.x, tmpC.z) + 0.03 * s;
      tmpC.y = Math.max(gh, lerp(tmpC.y, gh, 0.85));
      tmpN.set(0, 1, 0).applyQuaternion(fr.qB); tmpF.set(0, 0, 1).applyQuaternion(fr.qB);
      tmpD.copy(tmpF);
      mixIn(pl.side, 25 * DEG, L.front ? -0.35 : 0, 0);
    }
    if (pl.tuck > 0) {
      // flight: extended (tuck < 0.5 of the curve) or tucked under the body, relative to the body
      const e = pl.extend;
      // (hooves: the long pastern + hoof below the fetlock counts too: the leg reaches its full length)
      const hoof = L.foot.type === 'unguligrade', Lt = hoof ? L.len + L.M.y : L.len;
      if (L.front) bw(lx, gy - Lt * lerp(0.62, 0.88, e), cfg.zS + L.len * lerp(-0.12, 0.45, e), tmpC);
      else bw(lx, gy - Lt * lerp(0.6, 0.8, e), cfg.zH + L.len * lerp(0.25, -0.45, e), tmpC);
      tmpN.set(0, 1, 0).applyQuaternion(fr.qB); tmpF.set(0, 0, 1).applyQuaternion(fr.qB);
      const gh = this.terrainH(tmpC.x, tmpC.z);
      if (tmpC.y < gh + 0.02 * s) tmpC.y = gh + 0.02 * s;
      // (hooves reach out with the cannon and pastern in line: a straight foreleg to land on)
      mixIn(pl.tuck, lerp(L.front ? 60 : 50, hoof ? 0 : 10, e) * DEG, L.front ? lerp(g.fold || 1.8, hoof ? -L.a0 : 0.1, e) : 0, 0);
    }
    if (pl.reach > 0) {
      // reach for a point (strike, pounce, kick)
      tmpC.copy(pl.target);
      tmpN.set(0, 1, 0).applyQuaternion(fr.qB);
      tmpF.set(0, 0, 1).applyQuaternion(fr.qB);
      const gh = this.terrainH(tmpC.x, tmpC.z);
      if (tmpC.y < gh) tmpC.y = gh;
      mixIn(pl.reach, L.front ? 10 * DEG : 35 * DEG, L.front ? 0.35 : 0, 0);
      ft.free = pl.reach;
    }
    // while a foot moves between the gait and a ground pose it steps (small arc) instead of sliding
    // (measured from the gait's own contact point, continuous through a touchdown: leg.plant jumps to the
    // landing point when a swing ends under a posture blend, and the arc jumped with it)
    const gw = pl.fold + pl.sit + pl.side;
    if (gw > 0 && gw < 1) ft.c.y += 4 * gw * (1 - gw) * 0.05 * s * Math.min(1, ft.c.distanceTo(leg.contact) / (0.08 * s));
    return ft;
  }

  solveLeg(leg, dt) {
    const L = leg.def, S = L.S, J = this.J, fr = this.fr, cfg = this.cfg;
    const ft = this.footTarget(leg);
    leg.betaMixed = ft.beta;
    const c = ft.c, n = ft.n, fwd = ft.fwd;
    const latA = tv().crossVectors(n, fwd).normalize();
    // foot points in the contact frame
    const Mflat = footPoint(tv(), c, latA, n, fwd, L.M), T = footPoint(tv(), c, latA, n, fwd, L.T);
    let M, C = null;
    if (ft.beta >= 0 || L.C) {
      // heel lift / hoof breakover (beta >= 0): the digit rolls about the toe; fetlock sink (beta < 0,
      // hooves): the pastern turns about the coffin joint and the hoof stays flat on the ground
      const Cf = L.C ? footPoint(tv(), c, latA, n, fwd, L.C) : null;
      M = tv(); C = Cf ? tv() : null;
      placeDigit(ft.beta, Mflat, Cf, T, latA, M, C);
      // toe-off on demand: a planted foot that the leg can no longer reach rolls up about the toe
      // (heel rises, a sinking fetlock comes back up first) just enough, so the toe stays where it
      // was planted
      this.toeOff(leg, ft, Mflat, Cf, T, M, latA);
      // low-passed so the toe-off does not pass the body's bounce straight into the wrist
      // (the fetlock's return faster, at 140 rad/s: at 70 it came back 29 % in a frame, and a galloping
      // horse's 2-frame fore stance in a banked turn dragged its hoof 1.1-1.7 % S while it sank)
      const add = Math.max(0, leg.toeS.step(leg.betaAdd, 30, dt)) + (L.C ? Math.max(0, leg.sinkS.step(leg.sinkLift, 140, dt)) : 0);
      if (add > 1e-5) {
        ft.beta += add;
        placeDigit(ft.beta, Mflat, Cf, T, latA, M, C);
        // (a plantigrade metatarsus laid along the foot rolls up with it)
        if (L.plant && !L.front && ft.dirW > 0) ft.dir.applyAxisAngle(latA, add);
      }
    } else {
      // toe-up (heel strike) / fetlock sink: pivot the foot about its back point instead
      const qBeta = tqa(latA, ft.beta);
      M = Mflat;
      if (L.plant && !L.front) { const Hf = footPoint(tv(), c, latA, n, fwd, L.H); T.sub(Hf).applyQuaternion(qBeta).add(Hf); M.sub(Hf).applyQuaternion(qBeta).add(Hf); }
      else if (L.foot.type === 'unguligrade') M = tv().copy(Mflat).sub(T).applyQuaternion(qBeta).add(T);
      else T.sub(M).applyQuaternion(qBeta).add(M);
    }
    leg.betaLast = ft.beta;
    leg.betaGaitLast = leg.betaGait + (ft.beta - (leg.betaMixed ?? ft.beta)); // gait heel angle + toe-off
    // swing: the coffin joint flexes too (the sole turns up and back)
    // (gait swings only: faded out under a posture's leg modes, so a swing that a landing plants
    // mid-flight does not drop its flexion in one frame)
    if (C && leg.state === 'swing' && L.foot.hoofFlex) {
      const pl = this.P.legs[L.idx], wp = Math.min(1, pl.fold + pl.sit + pl.side + pl.tuck + pl.reach);
      const hf = L.foot.hoofFlex * DEG * Math.sin(Math.PI * leg.w) * (leg.mode === 'gait' ? 1 : 0.4) * (1 - wp);
      if (hf > 1e-5) T.sub(C).applyAxisAngle(latA, hf).add(C);
    }
    leg.C = C;
    // (the knee / elbow bend plane follows the leg's own girdle, which a turn bends: the locomotion's
    // bend only, girdleFrame; a sleeping curl's bend of the chest turned a folded foreleg's elbow out
    // and its forearm into the ground)
    const qG = this.girdleFrame(L);
    const bodyF = tv(0, 0, 1).applyQuaternion(qG), bodyX = tv(1, 0, 0).applyQuaternion(qG);
    const sprawl = cfg.stance.sprawl;
    const dbg = this.debug.targets;
    if (!L.front) this.solveHind(leg, dt, ft, M, T, latA, bodyF, bodyX);
    else this.solveFront(leg, dt, ft, M, T, latA, bodyF, bodyX);
  }

  // hind: pantograph IK from hip to the MTP, then 2-bone hip -> hock
  solveHind(leg, dt, ft, M, T, latA, bodyF, bodyX) {
    const L = leg.def, J = this.J, fr = this.fr, cfg = this.cfg;
    const c = ft.c, n = ft.n, fwd = ft.fwd;
    const sprawl = cfg.stance.sprawl;
    const dbg = this.debug.targets;
    // ---------- hind: pantograph IK from hip to the MTP, then 2-bone hip -> hock
    const hip = tv().copy(L.jHip).sub(J.lumbosacral).applyQuaternion(fr.qPel).add(fr.lumbo);
    const pole = tv().copy(bodyF).addScaledVector(bodyX, L.s * (0.12 + sprawl * 1.6));
    const d = tv().subVectors(M, hip);
    let dist = d.length();
    // (feet.hind.zfold: a Z-folded limb whose metatarsus is laid along the foot (frog: plantigrade tarsus)
    // folds far tighter than the pantograph's femur-parallel metatarsus allows: the pantograph's minimum
    // reach fades out with the imposed metatarsus direction; the hip -> hock solve below still limits it)
    const maxD = (L.Av + L.L2) * 0.9995, minD = Math.abs(L.Av - L.L2) * (L.foot.zfold ? 1 - ft.dirW : 1) + 0.01 * cfg.k;
    const ovM = dist / maxD; // (overreach of the pantograph stage; the hip -> hock stage below may be the limit)
    const dSoft = (L.Av + L.L2) * 0.965;
    if (dist > dSoft) dist = dSoft + (maxD - dSoft) * (1 - Math.exp(-(dist - dSoft) / (maxD - dSoft)));
    dist = Math.max(dist, minD);
    const e1 = d.normalize();
    const e2 = this.bendDir(leg, 0, pole, e1);
    const nrm = tv().crossVectors(e1, e2).normalize();
    const cosA = clamp((L.Av * L.Av + dist * dist - L.L2 * L.L2) / (2 * L.Av * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const u = tv().copy(e1).multiplyScalar(cosA).addScaledVector(e2, sinA).applyAxisAngle(nrm, -L.gamma);
    const mt = tv().copy(u).applyAxisAngle(nrm, L.delta);
    const Mreach = tv().copy(hip).addScaledVector(e1, dist);
    // posture / plantigrade: blend the metatarsus toward a prescribed direction (hock -> MTP)
    if (ft.dirW > 1e-4) {
      mt.lerp(ft.dir, ft.dirW).normalize();
      // a metatarsus laid along the ground keeps the hock at its bind height over the terrain under it
      // (bumps under the heel, a body pitched nose-up), so the heel does not sink into the ground
      // (or at its rest height, feet.hind.restTilt, when the bind pose stands with the heel lifted)
      const hx = Mreach.x - mt.x * L.L3, hz = Mreach.z - mt.z * L.L3;
      const floor = this.terrainH(hx, hz) + Math.min(L.H.y, L.M.y + L.L3 * Math.sin(L.mtTilt)) * 0.9;
      const hy = Mreach.y - mt.y * L.L3;
      if (hy < floor && (L.plant || L.foot.plantRest)) {
        const my = clamp((Mreach.y - floor) / L.L3, -0.99, 0.99), hl = Math.hypot(mt.x, mt.z) || 1, r = Math.sqrt(1 - my * my) / hl;
        mt.set(mt.x * r, my, mt.z * r);
      }
    }
    const hock = tv().copy(Mreach).addScaledVector(mt, -L.L3);
    // 2-bone hip -> hock
    const dh = tv().subVectors(hock, hip);
    let dd = dh.length();
    const max2 = (L.L1 + L.L2) * 0.999, soft2 = (L.L1 + L.L2) * 0.97, min2 = Math.abs(L.L1 - L.L2) + 0.01 * cfg.k;
    // overreach for the predictive lift-off: the larger of the two stages. A metatarsus laid along
    // the foot (plantigrade: bear, rat) puts the hock where the foot says, and the hip -> hock stage
    // runs out first: the pantograph read 0.9 while the planted toe was dragged 3 cm up and forward
    this.setOverreach(leg, Math.max(ovM, dd / max2), dt);
    leg.ikJ.copy(hip); leg.ikT1.copy(M); leg.ikM1 = maxD; leg.ikT2.copy(hock); leg.ikM2 = max2;
    if (dd > soft2) dd = soft2 + (max2 - soft2) * (1 - Math.exp(-(dd - soft2) / (max2 - soft2)));
    dd = Math.max(dd, min2);
    const f1 = dh.normalize();
    const f2 = this.bendDir(leg, 1, pole, f1);
    const cB = clamp((L.L1 * L.L1 + dd * dd - L.L2 * L.L2) / (2 * L.L1 * dd), -1, 1);
    this.liftOffGround(hip, f1, f2, cB * L.L1, Math.sqrt(1 - cB * cB) * L.L1, leg, tv().copy(bodyX).multiplyScalar(L.s));
    const knee = tv().copy(hip).addScaledVector(tv().copy(f1).multiplyScalar(cB).addScaledVector(f2, Math.sqrt(1 - cB * cB)), L.L1);
    const hockR = tv().copy(hip).addScaledVector(f1, dd);
    const off = tv().subVectors(hockR, hock);
    const Mr = tv().copy(Mreach).add(off);
    const Tr = tv().copy(T).add(Mreach).sub(M).add(off);
    const lat = tv().crossVectors(f1, f2).negate();
    if (lat.lengthSq() < 1e-8) lat.copy(bodyX);
    this.setBoneF(L.n.femur, hip, tv().subVectors(knee, hip), lat);
    this.setBoneF(L.n.tibia, knee, tv().subVectors(hockR, knee), lat);
    this.setBoneF(L.n.metatarsus, hockR, tv().subVectors(Mr, hockR), lat);
    let Cr = null;
    if (leg.C) {
      Cr = tv().copy(leg.C).add(Mreach).sub(M).add(off);
      this.setBoneF(L.n.hpaw, Mr, tv().subVectors(Cr, Mr), latA);
      this.setBoneF(L.hoof, Cr, tv().subVectors(Tr, Cr), latA);
    } else this.setBoneF(L.n.hpaw, Mr, tv().subVectors(Tr, Mr), latA);
    this.storeLeg(leg, hip, knee, hockR, Mr, Tr, null, Cr);
    dbg[L.idx * 2].copy(c); dbg[L.idx * 2 + 1].copy(M);
  }

  // front: scapula rotation + 2-bone IK to a wrist target
  solveFront(leg, dt, ft, M, T, latA, bodyF, bodyX) {
    const L = leg.def, J = this.J, fr = this.fr, cfg = this.cfg;
    const c = ft.c, n = ft.n, fwd = ft.fwd;
    const sprawl = cfg.stance.sprawl;
    const dbg = this.debug.targets;
    // ---------- front: scapula rotation + 2-bone IK to a wrist target
    const qCh = fr.qCh;
    const vn = this.speed / cfg.sq;
    let prot = 0;
    if (leg.state === 'stance') prot = lerp(0.18, -0.25, leg.u);
    else prot = lerp(leg.protStart, 0.18, smooth(0.1, 0.9, leg.w));
    prot *= smooth(0.05, 1.0, vn) * lerp(0.75, 1, this.gait.gallop) * this.P.legGait;
    const pivotW = tv().copy(L.pivot).sub(J.chestMid).applyQuaternion(qCh).add(fr.chestMid);
    const dir = tv().copy(n).multiplyScalar(Math.cos(ft.k)).addScaledVector(fwd, Math.sin(ft.k));
    dir.applyAxisAngle(latA, ft.beta * L.foot.couple);
    // out of reach: straighten the carpus / pastern toward the shoulder just enough (closed form)
    // before anything else gives, so a planted paw stays planted
    {
      const sh0 = tv().copy(L.jShoulder).sub(L.pivot).applyQuaternion(qCh).add(pivotW);
      const u = tv().subVectors(sh0, M);
      const D = u.length();
      const dS = (L.Lh + L.Lr) * 0.95;
      if (D > 1e-6) {
        u.multiplyScalar(1 / D);
        const c0 = clamp(dir.dot(u), -1, 1);
        const cT = clamp((D * D + L.Lmc * L.Lmc - dS * dS) / (2 * D * L.Lmc), -1, 1);
        const th0 = Math.acos(c0), thT = Math.acos(cT);
        // softplus of the angular deficit: C-infinity onset, so body bob cannot make it chatter
        const wS = 0.2, x = (th0 - thT) / wS;
        const stW = leg.state === 'stance' ? 1 : 1 - smooth(0, 0.25, leg.w) + smooth(0.7, 1, leg.w);
        const rotT = Math.min(th0, wS * (x > 20 ? x : Math.log1p(Math.exp(x)))) * this.P.legGait * stW;
        const rot = Math.min(th0, Math.max(0, leg.strS.step(rotT, 35, dt)));
        if (rot > 1e-5) {
          const ax = tv().crossVectors(dir, u);
          if (ax.lengthSq() > 1e-10) dir.applyAxisAngle(ax.normalize(), rot);
        }
      }
    }
    // lying / sitting / folding (ground poses): the wrist stays its skin's thickness above the ground
    // (L.rW), and, folding under the chest, below the shoulder: half way through a cow's stand-up the
    // blend of the kneeling and the standing cannon lifted the wrist 4 cm over the lowered shoulder,
    // the arm folded flat with the elbow up and the cannon turned over (160 rad/s*). Both soft
    // (softplus onsets, never past the hard limit): the cannon tilts about the fetlock just enough
    const plG = this.P.legs[L.idx], wG = Math.min(1, 4 * (plG.fold + plG.sit + plG.side)), wF = Math.min(1, 4 * plG.fold);
    if (wG > 1e-3) {
      const hz = Math.hypot(dir.x, dir.z);
      const floorW = this.terrainH(M.x + dir.x * L.Lmc, M.z + dir.z * L.Lmc) + L.rW;
      const sh0 = tv().copy(L.jShoulder).sub(L.pivot).applyQuaternion(qCh).add(pivotW);
      // (the ceiling never below the floor: a lion curled up asleep, its shoulder low, had the two
      // cross and its wrist jumped 47 mm when the ceiling let go)
      const lo = (floorW - M.y) / L.Lmc, hi = Math.max(lo + 0.1, (sh0.y - 0.1 * (L.Lh + L.Lr) - M.y) / L.Lmc);
      let dy = dir.y;
      const xl = (lo - dy) / 0.05, xh = (dy - hi) / 0.15;
      dy += wG * 0.05 * (xl > 20 ? xl : Math.log1p(Math.exp(xl))) - wF * 0.15 * (xh > 20 ? xh : Math.log1p(Math.exp(xh)));
      dy = clamp(dy, -1, 1);
      if (hz > 1e-6 && dy !== dir.y) { const k2 = Math.sqrt(Math.max(0, 1 - dy * dy)) / hz; dir.set(dir.x * k2, dy, dir.z * k2); }
    }
    const Wt = tv().copy(M).addScaledVector(dir, L.Lmc);
    // hooves: the carpus locks straight under load (the stay apparatus): through the stance the
    // forearm and cannon are aimed as one piece at the fetlock, the elbow and shoulder taking up the
    // body's height; it bent 30-45 deg in a lowered girdle's stance and snapped straight at each step
    // (it straightens at the end of the swing, so the leg lands as one straight column and the lock
    // runs on into the stance without a step)
    // (eased in and out: switched off at once by a jump's take-off or a posture, the cannon flicked)
    if (L.foot.type === 'unguligrade' && cfg.carpusLock > 0) {
      const wT = leg.mode === 'gait' && !this.air.active ? (leg.state === 'stance' ? 1 - smooth(0.75, 1, leg.u) : smooth(0.45, 0.97, leg.w)) * smooth(0.5, 1, this.P.legGait) * cfg.carpusLock : 0;
      leg.lockW = expTo(leg.lockW ?? 0, wT, dt, wT > (leg.lockW ?? 0) ? 0.02 : 0.06);
      const wl = leg.lockW;
      if (wl > 1e-3) {
        const shP = tv().copy(L.jShoulder).sub(L.pivot).applyQuaternion(tqc(qCh).multiply(tqa(X1, -prot))).add(pivotW);
        const a = L.Lh, bL = L.Lr + L.Lmc, e1 = tv().subVectors(M, shP);
        const d = clamp(e1.length(), Math.abs(a - bL) + 0.01 * cfg.k, (a + bL) * 0.995);
        e1.normalize();
        const e2 = tv().copy(bodyF).negate().addScaledVector(e1, bodyF.dot(e1));
        if (e2.lengthSq() > 1e-8) {
          e2.normalize();
          const cA = clamp((a * a + d * d - bL * bL) / (2 * a * d), -1, 1), sA = Math.sqrt(1 - cA * cA);
          const elbow = tv().copy(shP).addScaledVector(e1, a * cA).addScaledVector(e2, a * sA);
          const wristL = tv().subVectors(M, elbow).normalize().multiplyScalar(L.Lr).add(elbow);
          Wt.lerp(wristL, wl);
        }
      }
    }
    // shoulder position on its arc about the pivot: sh(pr) = pivot + A cos pr + B sin pr + C
    // (rotation about the chest's lateral axis), so the golden-section search is all scalar math
    const r0 = tv().copy(L.jShoulder).sub(L.pivot).applyQuaternion(qCh);
    const ax = tv(1, 0, 0).applyQuaternion(qCh);
    const Cc = tv().copy(ax).multiplyScalar(ax.dot(r0));
    const A = tv().copy(r0).sub(Cc), B = tv().crossVectors(ax, A).negate();
    const wx = Wt.x - pivotW.x - Cc.x, wy = Wt.y - pivotW.y - Cc.y, wz = Wt.z - pivotW.z - Cc.z;
    const lim = (L.Lh + L.Lr) * 0.955;
    const prot0 = prot, kS = 0.0004 * cfg.k * cfg.k;
    const sc = SC;
    sc[0] = A.x; sc[1] = A.y; sc[2] = A.z; sc[3] = B.x; sc[4] = B.y; sc[5] = B.z;
    sc[6] = wx; sc[7] = wy; sc[8] = wz; sc[9] = lim; sc[10] = prot0; sc[11] = kS;
    prot = scapBestFit(sc, this.lod === 0 ? 26 : 16);
    if (!leg.protInit) { leg.protS.reset(prot); leg.protInit = true; }
    prot = leg.protS.step(prot, 24, dt);
    const qSc = tqc(qCh).multiply(tqa(X1, -prot));
    const shoulder = tv().copy(L.jShoulder).sub(L.pivot).applyQuaternion(qSc).add(pivotW);
    const scapTop = tv().copy(L.jScapTop).sub(L.pivot).applyQuaternion(qSc).add(pivotW);
    // elbow pole: backward; feet.front.elbowDown tilts it down (a paw reached straight forward to the
    // face keeps its elbow below instead of flipping through the pole: rabbit grooming, boxing)
    const pole = tv().copy(bodyF).negate().addScaledVector(bodyX, L.s * (0.08 + sprawl * 1.6));
    if (L.foot.elbowDown) pole.addScaledVector(tv(0, 1, 0).applyQuaternion(fr.qB), -L.foot.elbowDown);
    const d = tv().subVectors(Wt, shoulder);
    let dist = d.length();
    const maxD = (L.Lh + L.Lr) * 0.998, minD = Math.abs(L.Lh - L.Lr) + 0.02 * cfg.k;
    this.setOverreach(leg, dist / maxD, dt);
    leg.ikJ.copy(shoulder); leg.ikT1.copy(Wt); leg.ikM1 = maxD; leg.ikM2 = 0;
    const dSoft = (L.Lh + L.Lr) * 0.955;
    if (dist > dSoft) dist = dSoft + (maxD - dSoft) * (1 - Math.exp(-(dist - dSoft) / (maxD - dSoft)));
    dist = Math.max(dist, minD);
    const e1 = d.normalize();
    const e2 = this.bendDir(leg, 0, pole, e1);
    const nrm = tv().crossVectors(e1, e2).normalize();
    const cosA = clamp((L.Lh * L.Lh + dist * dist - L.Lr * L.Lr) / (2 * L.Lh * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    this.liftOffGround(shoulder, e1, e2, cosA * L.Lh, sinA * L.Lh, leg, tv().copy(bodyX).multiplyScalar(L.s));
    nrm.crossVectors(e1, e2).normalize();
    const elbow = tv().copy(shoulder).addScaledVector(tv().copy(e1).multiplyScalar(cosA).addScaledVector(e2, sinA), L.Lh);
    const wrist = tv().copy(shoulder).addScaledVector(e1, dist);
    const off = tv().subVectors(wrist, Wt);
    const Mr = tv().copy(M).add(off), Tr = tv().copy(T).add(off);
    this.setBoneF(L.n.scapula, scapTop, tv().subVectors(shoulder, scapTop), tv(1, 0, 0).applyQuaternion(qSc));
    this.setBoneF(L.n.humerus, shoulder, tv().subVectors(elbow, shoulder), nrm);
    this.setBoneF(L.n.radius, elbow, tv().subVectors(wrist, elbow), nrm);
    // (lateral reference: the arm-plane normal; where it turns parallel to the metacarpus (a forearm
    // held level with the paw hanging, e.g. a paw raised to the face) the foot's lateral axis is blended
    // in continuously so the frame never degenerates)
    const mcD = tv().subVectors(Mr, wrist), mcL = mcD.length();
    const par = mcL > 1e-9 ? Math.abs(nrm.dot(mcD)) / mcL : 0;
    this.setBoneF(L.n.metacarpus, wrist, mcD, par > 0.8 ? tv().copy(nrm).addScaledVector(latA, smooth(0.8, 0.97, par)) : nrm);
    let Cr = null;
    if (leg.C) {
      Cr = tv().copy(leg.C).add(off);
      this.setBoneF(L.n.fpaw, Mr, tv().subVectors(Cr, Mr), latA);
      this.setBoneF(L.hoof, Cr, tv().subVectors(Tr, Cr), latA);
    } else this.setBoneF(L.n.fpaw, Mr, tv().subVectors(Tr, Mr), latA);
    this.storeLeg(leg, shoulder, elbow, wrist, Mr, Tr, scapTop, Cr);
    dbg[L.idx * 2].copy(c); dbg[L.idx * 2 + 1].copy(Wt);
  }

  // Bend direction of a 2-bone chain along axis e1: the pole direction projected off the axis. When
  // the limb points along its pole (a foreleg striking forward: elbow pole = backward) the projection
  // vanishes and its direction flips; there the last frame's bend direction takes over (continuous)
  bendDir(leg, k, pole, e1) {
    const raw = tv().copy(pole).addScaledVector(e1, -pole.dot(e1));
    const m = raw.length() / Math.max(1e-9, pole.length());
    const prev = leg.bend[k];
    const a = leg.bendInit[k] ? smooth(0.12, 0.4, m) : 1;
    raw.normalize();
    if (a < 1) raw.multiplyScalar(a).addScaledVector(tv().copy(prev).addScaledVector(e1, -prev.dot(e1)).normalize(), 1 - a).normalize();
    prev.copy(raw); leg.bendInit[k] = true;
    return raw;
  }

  // Rotation (rad, about unit axis ax through a pivot at height pivotY) that keeps the point pivot + v
  // at or above floor. Of the two just-touching rotations the one nearest the previous correction
  // st[k] wins (no flipping between them); once the point is clear the correction relaxes to zero at
  // 4 rad/s (every angle between the root and zero keeps the point clear), so nothing snaps.
  clearAbout(ax, v, pivotY, floor, st, k, dt) {
    const last = st[k];
    const par = ax.dot(v), perpY = v.y - ax.y * par, crossY = ax.z * v.x - ax.x * v.z; // (ax x v).y
    if (pivotY + v.y >= floor) {
      const step = 4 * dt;
      const phiR = Math.abs(last) <= step ? 0 : last - Math.sign(last) * step;
      // (only as far as the point stays clear: from a large correction the arc back to zero can pass
      // below the floor, and a dead hereford's horn went 41 mm into a slope while it relaxed)
      if (pivotY + ax.y * par + perpY * Math.cos(phiR) + crossY * Math.sin(phiR) >= floor) { st[k] = phiR; return phiR; }
    }
    const R = Math.hypot(perpY, crossY);
    if (R < 1e-6) return last;
    const phi0 = Math.atan2(crossY, perpY), kk = (floor - pivotY - ax.y * par) / R;
    let phi = phi0;
    if (kk < 1) { const d = Math.acos(Math.max(-1, kk)); const p1 = angDiff(0, phi0 + d), p2 = angDiff(0, phi0 - d); phi = Math.abs(angDiff(last, p1)) < Math.abs(angDiff(last, p2)) ? p1 : p2; }
    // (at most 30 / sqrt(k) rad/s: the just-touching rotation grows as the square root of the depth
    // at its onset, and a dead cheetah's ear folded 0.3 rad in a 240 Hz frame as its head came down
    // on a slope, 87 rad/s*; the point may dip a frame's worth under its margin instead)
    const mr = 30 / this.cfg.sk * dt;
    phi = last + clamp(angDiff(last, phi), -mr, mr);
    st[k] = phi;
    return phi;
  }

  // clearAbout for several points turned together (V[i], floors F[i], i < n): of the angles that keep
  // them all clear (the ends of each one's clear range, and zero), the one nearest the previous
  // correction st[k]; relaxing to zero at 4 rad/s while that keeps them all clear, at most
  // 30 / sqrt(k) rad/s; where no angle clears them all, the one that clears the deepest. (One
  // correction per set: each point with its own, relaxing on its own while another took over, a
  // sleeping boar's head rolled 80 deg and its throat went 11 cm into the ground)
  clearMulti(ax, V, F, n, pivotY, st, k, dt, acc = 0) {
    const last = st[k], C = this._cm;
    let clear0 = true, deep = -1, deepD = 0;
    for (let i = 0; i < n; i++) {
      const v = V[i], par = ax.dot(v), perpY = v.y - ax.y * par, crossY = ax.z * v.x - ax.x * v.z;
      const c0 = pivotY + ax.y * par, R = Math.hypot(perpY, crossY), kk = R > 1e-9 ? (F[i] - c0) / R : F[i] <= c0 ? -2 : 2;
      C[2 * i] = Math.atan2(crossY, perpY); C[2 * i + 1] = kk <= -1 ? 9 : kk >= 1 ? -1 : Math.acos(kk);
      const d = F[i] - pivotY - v.y;
      if (d > 0) { clear0 = false; if (d > deepD) { deepD = d; deep = i; } }
    }
    if (clear0) {
      const step = 4 * dt, phiR = Math.abs(last) <= step ? 0 : last - Math.sign(last) * step;
      if (this.clearAll(n, phiR)) { this._hcv[k] = (phiR - last) / dt; st[k] = phiR; return phiR; }
    }
    let phi = NaN, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const hw = C[2 * i + 1];
      if (hw < 0 || hw === 9) continue;
      for (let e = -1; e <= 1; e += 2) {
        const a = angDiff(0, C[2 * i] + e * hw), dd = Math.abs(angDiff(last, a));
        if (dd < bd && this.clearAll(n, a)) { bd = dd; phi = a; }
      }
    }
    if (Number.isNaN(phi)) {
      if (deep < 0) return last;
      const hw = C[2 * deep + 1], p0 = C[2 * deep];
      if (hw < 0) phi = p0;
      else { const p1 = angDiff(0, p0 + hw), p2 = angDiff(0, p0 - hw); phi = Math.abs(angDiff(last, p1)) < Math.abs(angDiff(last, p2)) ? p1 : p2; }
    }
    if (acc > 0) {
      // (acc > 0: the speed is also gained and lost at acc / sqrt(k) rad/s^2, braking in time: a heavy
      // head's side correction, which as a dead hereford's head landed turned 0.13 rad one way for a
      // frame, then the other, and its jaw zig-zagged 7 % S)
      const vm = 30 / this.cfg.sk, A = acc / this.cfg.sk, sv = this._hcv, D = angDiff(last, phi);
      const vt = Math.sign(D) * Math.min(vm, Math.sqrt(2 * A * Math.abs(D)), Math.abs(D) / dt);
      sv[k] = clamp(vt, sv[k] - A * dt, sv[k] + A * dt);
      phi = last + sv[k] * dt;
    } else {
      const mr = 30 / this.cfg.sk * dt;
      phi = last + clamp(angDiff(last, phi), -mr, mr);
    }
    st[k] = phi;
    return phi;
  }
  // (does the angle phi keep every point clear that some angle can? clearMulti's ranges)
  clearAll(n, phi) {
    const C = this._cm;
    for (let i = 0; i < n; i++) {
      const hw = C[2 * i + 1];
      if (hw === 9 || hw < 0) continue;
      if (Math.abs(angDiff(C[2 * i], phi)) > hw + 1e-9) return false;
    }
    return true;
  }

  // overreach (target distance / chain length) and its rate over stance, for the predictive lift-off
  setOverreach(leg, ov, dt) {
    leg.ovRate = leg.state === 'stance' && leg.stanceTime > 0 ? (ov - leg.overreach) / Math.max(dt, 1e-4) : 0;
    leg.overreach = ov;
  }

  // toe-off on demand: a planted foot that the leg can no longer reach rolls up about the toe
  // (heel rises) just enough, so the toe stays where it was planted
  // (hooves: a sinking fetlock is soft tissue under load and only sinks as far as the leg reaches:
  // that part comes back up at once (leg.sinkLift, continuous with the reach), before any toe-off)
  toeOff(leg, ft, Mflat, Cf, T, M, latA) {
    const L = leg.def, J = this.J, fr = this.fr;
    const stance = leg.state === 'stance' && ft.free < 0.5 && leg.mode === 'gait';
    let toeW = stance ? smooth(0.3, 0.55, leg.u) : 0;
    // hooves: a sinking fetlock is soft tissue under load and only sinks as far as the leg reaches; it
    // comes back up (leg.sinkLift, spring-filtered by the caller) before any toe-off
    const sinkW = stance && Cf && ft.beta < 0 ? this.P.legGait : 0;
    leg.betaAdd = 0; leg.sinkLift = 0;
    const G = L.front
      ? tv().copy(L.jShoulder).sub(J.chestMid).applyQuaternion(fr.qCh).add(fr.chestMid)
      : tv().copy(L.jHip).sub(J.lumbosacral).applyQuaternion(fr.qPel).add(fr.lumbo);
    // plantigrade hind: the metatarsus lies along the foot and rolls up with it, so the reach that
    // limits the stance is hip -> hock (the heel) as well as the pantograph's hip -> MTP
    const plantH = L.plant && !L.front;
    if (toeW <= 0 && sinkW <= 0 && !(plantH && stance)) return;
    let needM = 0;
    if (plantH && stance) {
      // (a plantigrade foot planted behind the hip may roll up early in its stance: after a landing
      // or a hard stop the gait can leave it there)
      const behind = (G.x - T.x) * ft.fwd.x + (G.z - T.z) * ft.fwd.z;
      toeW = Math.max(toeW, smooth(0.05 * L.len, 0.2 * L.len, behind));
    }
    if (plantH) {
      const Rm = (L.Av + L.L2) * 0.955;
      if (toeW > 0 && M.distanceToSquared(G) > Rm * Rm) needM = this.digitNeed(ft.beta, Mflat, Cf, T, latA, G, Rm * Rm);
      const Hf = footPoint(tv(), ft.c, latA, ft.n, ft.fwd, L.H);
      Mflat = Hf; M = tv(); placeDigit(ft.beta, Hf, null, T, latA, M, null);
    }
    const Rmax = L.front ? (L.Lh + L.Lr) * 0.95 + L.Lmc * 0.97 + 0.02 * L.len : plantH ? (L.L1 + L.L2) * 0.91 : (L.Av + L.L2) * 0.962; // (plantigrade: a margin for the low-passed roll)
    const rS = Rmax - 0.025 * L.len; // (the sink starts coming up a little before the toe-off)
    const d2 = M.distanceToSquared(G);
    if (needM > 0) leg.betaAdd = Math.min(needM, 45 * DEG) * this.P.legGait * toeW;
    if (d2 <= (sinkW > 0 ? rS * rS : Rmax * Rmax)) return;
    if (sinkW > 0) leg.sinkLift = Math.min(this.digitNeed(ft.beta, Mflat, Cf, T, latA, G, rS * rS), -ft.beta) * sinkW;
    if (toeW > 0 && d2 > Rmax * Rmax) {
      const need = this.digitNeed(ft.beta, Mflat, Cf, T, latA, G, Rmax * Rmax);
      leg.betaAdd = Math.max(leg.betaAdd, Math.max(0, Math.min(need - leg.sinkLift, 45 * DEG)) * this.P.legGait * toeW);
    }
  }

  // smallest raise of the digit angle (from beta, up to 100 deg) that brings the foot's back point M
  // within sqrt(r2) of the girdle joint G (bisection)
  digitNeed(beta, Mflat, Cf, T, latA, G, r2) {
    const Mt = tv();
    let lo = beta, hi = Math.max(beta, 100 * DEG);
    placeDigit(hi, Mflat, Cf, T, latA, Mt, null);
    if (Mt.distanceToSquared(G) > r2) return hi - beta;
    for (let it = 0; it < 14; it++) {
      const mid = 0.5 * (lo + hi);
      placeDigit(mid, Mflat, Cf, T, latA, Mt, null);
      if (Mt.distanceToSquared(G) > r2) lo = mid; else hi = mid;
    }
    return hi - beta;
  }

  // A middle joint (knee / elbow) at A + a e1 + b e2 that would sink into the ground is swung about
  // the limb axis e1 just enough to clear it (elbows / knees turn out, as in a lying cat). Rotates e2
  // in place; continuous (no rotation while the joint is clear).
  liftOffGround(A, e1, e2, a, b, leg, out) {
    // joint centre height that keeps the skin around an elbow / knee clear (at least its thickness)
    const r = Math.max(0.05 * this.cfg.k, 1.05 * leg.def.rE);
    const px = A.x + a * e1.x + b * e2.x, pz = A.z + a * e1.z + b * e2.z;
    const floor = this.terrainH(px, pz) + r;
    const c0 = A.y + a * e1.y;
    const last = leg.liftPhi || 0;
    if (b < 1e-6) { leg.liftPhi = 0; return; }
    const e3 = tv().crossVectors(e1, e2);
    if (c0 + b * e2.y >= floor) {
      // clear without rotating: relax a rotation left from earlier frames back to zero at a limited
      // rate (every angle between the last root and zero keeps the joint clear), no snap
      if (last === 0) return;
      const step = 4 * this.frameDt;
      const phi = Math.abs(last) <= step ? 0 : last - Math.sign(last) * step;
      leg.liftPhi = phi;
      if (phi !== 0) e2.multiplyScalar(Math.cos(phi)).addScaledVector(e3, Math.sin(phi)).normalize();
      return;
    }
    const R = b * Math.hypot(e2.y, e3.y);
    if (R < 1e-9) return;
    const phi0 = Math.atan2(e3.y, e2.y);
    const k = (floor - c0) / R;
    let phi;
    if (k >= 1) phi = phi0;
    else {
      const d = Math.acos(Math.max(-1, k));
      const p1 = angDiff(0, phi0 + d), p2 = angDiff(0, phi0 - d);
      // the side the joint swung to last frame wins (no flipping between the two solutions); from
      // rest, the smaller rotation, unless that swings the joint in under the body (out: the leg's
      // outward side) and the other does not (a lying cow's elbow swung in under its chest, 23 cm
      // across from its shoulder, and turned the cannon over as it stood up: 578 rad/s*)
      if (last !== 0 || !out) phi = Math.abs(angDiff(last, p1)) < Math.abs(angDiff(last, p2)) ? p1 : p2;
      else {
        const o2 = e2.dot(out), o3 = e3.dot(out);
        const l1 = o2 * Math.cos(p1) + o3 * Math.sin(p1), l2 = o2 * Math.cos(p2) + o3 * Math.sin(p2);
        phi = Math.abs(p1) <= Math.abs(p2) ? (l1 < -0.5 && l2 > l1 ? p2 : p1) : (l2 < -0.5 && l1 > l2 ? p1 : p2);
      }
    }
    // (at most 30 / sqrt(k) rad/s: near the highest point the rotation can lift the joint to, the root
    // swings fast with the geometry, and a retriever's elbow, held 42 mm up while it rose from its
    // sleep, swung 0.19 rad in a frame and turned the cannon over, 319 rad/s*)
    // (and at most 2 rad out of the limb's bend plane: further, the rotation that just lifts the
    // joint runs up against the highest point it can reach, where the elbow of that retriever swung
    // about; a curled-up wolf's elbow needs 1.5, and a cap at 1.6 made the retriever's elbow stop
    // dead against it, 3.3 % S of jitter)
    const mr = 30 / this.cfg.sk * this.frameDt;
    phi = clamp(last + clamp(angDiff(last, phi), -mr, mr), -2, 2);
    leg.liftPhi = phi;
    const c = Math.cos(phi), sn = Math.sin(phi);
    e2.multiplyScalar(c).addScaledVector(e3, sn).normalize();
  }

  // keep the last two solved joint chains (world) for LOD 2 half-rate IK
  // (f: scapula top of a foreleg, g: coffin joint of a hoof)
  storeLeg(leg, a, b, c, d, e, f, g) {
    const jp = leg.jp, jp0 = leg.jp0, jpp = leg.jpp;
    for (let i = 0; i < 7; i++) { jpp[i].copy(jp0[i]); jp0[i].copy(jp[i]); }
    jp[0].copy(a); jp[1].copy(b); jp[2].copy(c); jp[3].copy(d); jp[4].copy(e); if (f) jp[5].copy(f); if (g) jp[6].copy(g);
    leg.solved = Math.min(3, leg.solved + 1);
    leg.sf[0] = leg.sf[1]; leg.sf[1] = leg.sf[2]; leg.sf[2] = this.frame;
    leg.latRef = leg.latRef || new THREE.Vector3();
  }

  // LOD 2 in-between frame: extrapolate the chain by one frame and re-anchor it on the girdle
  extrapolateLeg(leg) {
    const L = leg.def, S = L.S, J = this.J, fr = this.fr;
    const jp = leg.jp, jp0 = leg.jp0;
    // quadratic through the last three half-rate solves (frames -4, -2, 0), evaluated one frame on
    const jpp = leg.jpp;
    const P = (i) => tv().copy(jp[i]).multiplyScalar(1.875).addScaledVector(jp0[i], -1.25).addScaledVector(jpp[i], 0.375);
    const top = L.front
      ? tv().copy(L.jShoulder).sub(J.chestMid).applyQuaternion(fr.qCh).add(fr.chestMid)
      : tv().copy(L.jHip).sub(J.lumbosacral).applyQuaternion(fr.qPel).add(fr.lumbo);
    const p0 = P(0), p1 = P(1), p2 = P(2), p3 = P(3), p4 = P(4);
    const corr = tv().subVectors(top, p0);
    p0.add(corr); p1.addScaledVector(corr, 0.66); p2.addScaledVector(corr, 0.33);
    const lat = tv(1, 0, 0).applyQuaternion(fr.qB);
    if (L.front) {
      const p5 = P(5).add(corr);
      this.setBoneF(L.n.scapula, p5, tv().subVectors(p0, p5), lat);
      this.setBoneF(L.n.humerus, p0, tv().subVectors(p1, p0), lat);
      this.setBoneF(L.n.radius, p1, tv().subVectors(p2, p1), lat);
      this.setBoneF(L.n.metacarpus, p2, tv().subVectors(p3, p2), lat);
    } else {
      this.setBoneF(L.n.femur, p0, tv().subVectors(p1, p0), lat);
      this.setBoneF(L.n.tibia, p1, tv().subVectors(p2, p1), lat);
      this.setBoneF(L.n.metatarsus, p2, tv().subVectors(p3, p2), lat);
    }
    const paw = L.front ? L.n.fpaw : L.n.hpaw;
    if (L.hoof) {
      // pastern (fetlock -> coffin joint) and hoof (coffin joint -> toe)
      const p6 = P(6);
      this.setBoneF(paw, p3, tv().subVectors(p6, p3), lat);
      this.setBoneF(L.hoof, p6, tv().subVectors(p4, p6), lat);
    } else this.setBoneF(paw, p3, tv().subVectors(p4, p3), lat);
    leg.contact.copy(leg.state === 'stance' ? leg.plant : p4);
  }

  // ----------------------------------------------------------------- neck & head
  // stride nod of the head: { a: amplitude (share of the neck length), y: shape -1..1 (1 = lowest) }
  strideNod(vn) {
    const g = this.gait, P = this.P, cfg = this.cfg, out = this._nod || (this._nod = { a: 0, y: 0 });
    const tb = cfg.head.nod;
    const mv = smooth(0.05, 0.5, vn) * P.gaitW * (1 - P.headW) * (1 - 0.6 * (P.lookW || 0)) * this._bobGate;
    const lg = smooth(0.3, 0.8, this.P.legGait);
    if (!tb || mv * lg < 1e-3) { out.a = 0; out.y = 0; return out; }
    const gal = g.gallop, trot = smooth(0.35, 0.6, 1 - g.D) * (1 - gal);
    out.a = (tb[0] * (1 - trot - gal) + tb[1] * trot + tb[2] * gal) * mv * lg;
    const c0 = g.off[0] + 0.5 * g.DL[0] + (tb[3] || 0), c1 = g.off[1] + 0.5 * g.DL[1] + (tb[3] || 0);
    const two = Math.cos(4 * Math.PI * (this.phase - c0));
    const cm = c0 + 0.5 * d01(c0, c1);
    const one = Math.cos(2 * Math.PI * (this.phase - cm));
    out.y = lerp(two, one, gal);
    return out;
  }

  solveHead(dt) {
    const cfg = this.cfg, J = this.J, fr = this.fr, g = this.gait, P = this.P, inp = this.input;
    const vn = this.speed / cfg.sq, s = cfg.k, gal = g.gallop;
    const crouch = inp.crouch || 0;
    const moving = smooth(0.05, 0.9, vn);
    const carry = tableAt(cfg.headCarry, vn, this._carry);
    // how much the head is held still in space (vs. carried by the chest): rises with speed
    const stab = clamp(tableAt(cfg.headStab, vn, this._stab)[0] * P.gaitW, 0, 0.95);
    const neckRaise = carry[0] - crouch * 0.12 * s + P.headRaise * s;
    const reach = carry[1] + crouch * 0.03 * s + P.neckReach * s;
    const qCh = fr.qCh, base = fr.neckBase, qHeading = fr.qHeading;
    // rigid target: carried by the chest (mostly), levelled a little at speed
    const qN = tqc(qHeading).slerp(qCh, lerp(0.9, 0.6, gal));
    const rigid = tv().copy(J.occiput).sub(J.neckBase).applyQuaternion(qN).add(base).addScaledVector(fr.F, reach);
    rigid.y += neckRaise;
    if (P.headLocalW > 0) rigid.add(tv().copy(P.headLocal).multiplyScalar(s * P.headLocalW).applyQuaternion(fr.qB));
    // stabilised target: low-pass filtered in the heading frame, relative to the ground under the body
    const qInv = tqc(qHeading).invert();
    const ref = tv(this.pos.x, this.pos.y + this.lift, this.pos.z);
    const rel = tv().subVectors(rigid, ref).applyQuaternion(qInv);
    if (!this._headInit) {
      this.hx.reset(rel.x); this.hy.reset(rel.y); this.hz.reset(rel.z);
      this._headInit = true;
    }
    const w = lerp(7.5, 5.5, gal);
    const relS = tv(this.hx.step(rel.x, w, dt), this.hy.step(rel.y, w * 0.85, dt), this.hz.step(rel.z, w, dt));
    const stabP = relS.applyQuaternion(qHeading).add(ref);
    const Otgt = tv().copy(rigid).lerp(stabP, stab);
    // stride nod: the head and neck dip as the forelegs take the weight (walk and trot: at each
    // foreleg's mid stance, twice a stride; canter and gallop: once, a pump down and forward as the
    // forelegs land and back up through the hind stance). Added after the stabilisation, whose
    // filter would swallow a 2 Hz nod. cfg.head.nod: [walk, trot, gallop] amplitude / neck length
    const nod = this.strideNod(vn);
    // (braking: the head comes up and back, see pose)
    if (this.brake > 0.01) { Otgt.y += 0.09 * this.brake * cfg.neckLen; Otgt.addScaledVector(fr.F, -0.04 * this.brake * cfg.neckLen); }
    if (nod.a !== 0) {
      Otgt.y -= nod.a * nod.y * cfg.neckLen;
      Otgt.addScaledVector(fr.F, 0.45 * nod.a * nod.y * cfg.neckLen * gal);
    }
    // posture head target (world occiput position), e.g. mouth to the ground
    if (P.headW > 0.001) Otgt.lerp(P.headPos, P.headW);
    // one-arc neck of constant length, leaving the chest along its own neck direction
    const l1 = J.neckBase.distanceTo(J.neckMid), Ln = cfg.neckLen;
    const tChest = tv().copy(J.neckMid).sub(J.neckBase).normalize().applyQuaternion(qCh);
    let cdir = tv().subVectors(Otgt, base).normalize();
    const tB = tv().copy(tChest).lerp(cdir, cfg.head.neckPivot).normalize();
    let th = Math.acos(clamp(tB.dot(cdir), -1, 1));
    const thMax = cfg.head.neckBend * DEG;
    if (th > thMax) {
      const ax = tv().crossVectors(tB, cdir).normalize();
      cdir = tv().copy(tB).applyAxisAngle(ax, thMax);
      th = thMax;
    }
    const nC = tv().copy(cdir).addScaledVector(tB, -cdir.dot(tB));
    const nCl = nC.length();
    const mid = arcPoint(tv(), base, tB, nC, nCl, th, Ln, l1);
    const occ = arcPoint(tv(), base, tB, nC, nCl, th, Ln, Ln);
    const latRef = tv(1, 0, 0).applyQuaternion(qCh);
    this.setBoneF('neck1', base, tv().subVectors(mid, base), latRef);
    this.setBoneF('neck2', mid, tv().subVectors(occ, mid), latRef);

    // head orientation: gaze-stabilised (level, along heading + look target), with a little of the
    // chest's pitch and roll let through at low speed so the walk does not look robotic
    let yawT = 0, pitchT = carry[2] + crouch * 0.12;
    const look = inp.look || P.look;
    if (look && P.lookW > 0.01) {
      const to = tv().subVectors(look, occ);
      const want = Math.atan2(to.x, to.z);
      const hd = cfg.head;
      yawT = clamp(angDiff(this.heading, want), -hd.yaw, hd.yaw) * P.lookW;
      pitchT = lerp(pitchT, clamp(-Math.atan2(to.y, Math.hypot(to.x, to.z)), -hd.pitchUp, hd.pitchDown), P.lookW);
      this.lookTarget.copy(look);
      this.state.lookTarget = this.lookTarget;
    } else this.state.lookTarget = null;
    // the head leads a turn: it turns toward the commanded heading at once, before the body (which
    // follows over the next half second), and with the turn rate (it followed the turn rate only and
    // trailed the chest into a turn)
    const steer = inp.follow ? 0 : 0.5 * angDiff(this.heading, this.wantHeading ?? this.heading);
    yawT += clamp(this.yawRate * 0.22 + steer, -0.5, 0.5) + P.headYaw;
    pitchT += P.headPitch;
    const hw = P.headOmega;
    const yaw = this.lookYaw.step(yawT, 5.5 * hw, dt);
    const hp = this.headPitch.step(pitchT, 5.5 * hw, dt);
    const hr = this.headRollS.step(P.headRoll, 6 * hw, dt);
    const qHead = tq().setFromAxisAngle(UP, this.heading + yaw).multiply(tqa(X1, hp + 0.4 * nod.a * nod.y)).multiply(tqa(Z1, -0.25 * this.bank.x + hr));
    const carried = tqc(qCh).multiply(qInv).multiply(qHead);
    qHead.copy(carried.slerp(qHead, lerp(0.7, 0.95, clamp(stab / 0.62, 0, 1)) * (1 - P.headLimp)));
    // the nose / chin never enter the ground: pitch the head up about the occiput just enough
    // ... and the ear bases and the skin to either side of the head and jaw (cheeks, jaw, horns,
    // antlers: cfg.headSide) never enter it (a head lying on its side): roll the head back up about
    // its own long axis just enough (the sides only near the ground, or while a correction relaxes)
    // (then the nose and chin once more: rolling the head up onto a horn can put the chin down)
    const HS = cfg.headSide;
    // (near the ground: first against the ground under the body, which costs nothing, then under the head)
    const hc = this._hc, sides = HS && (hc[6] !== 0 || hc[7] !== 0 || hc[8] !== 0 || hc[9] !== 0 ||
      (occ.y - this.pos.y < cfg.headSideReach + 0.5 * cfg.legLen && occ.y - this.terrainH(occ.x, occ.z) < cfg.headSideReach + 0.02 * cfg.k));
    for (let k = 0; k < 8; k++) {
      if ((k === 2 || k === 3) && !cfg.earLocal) continue;
      if (k >= 4 && !sides) break;
      const nk = k >= 6 ? k - 6 : k;
      const ax = tv(nk < 2 ? 1 : 0, 0, nk < 2 ? 0 : 1).applyQuaternion(qHead);
      let phi;
      if (k === 4 || k === 5) {
        // a side: its cheek, jaw and horn points together (one correction, clearMulti)
        // (each point's floor under where last frame's correction put it: on a slope a long horn swings
        // well away from where it was before the roll)
        const pts = HS[k - 4], V = this._cmV, F = this._cmF, w = tv(), l = this._hc[k + 2];
        for (let j = 0; j < pts.length; j++) {
          V[j].copy(pts[j]).applyQuaternion(qHead);
          w.copy(V[j]).applyAxisAngle(ax, l);
          F[j] = this.terrainH(occ.x + w.x, occ.z + w.z) + 0.012 * cfg.k;
        }
        phi = this.clearMulti(ax, V, F, pts.length, occ.y, this._hc, k + 2, dt, 600);
      } else {
        const loc = nk === 0 ? cfg.noseLocal : nk === 1 ? cfg.chinLocal : cfg.earLocal[k - 2];
        const v = tv().copy(loc).applyQuaternion(qHead);
        const floor = this.terrainH(occ.x + v.x, occ.z + v.z) + (nk < 2 ? 0.012 : 0.03) * cfg.k;
        phi = this.clearAbout(ax, v, occ.y, floor, this._hc, k < 4 ? k : k + 2, dt);
      }
      if (phi !== 0) qHead.premultiply(tqa(ax, phi));
    }
    this.setBoneQ('head', occ, qHead, ONE);
    this.headPose.position.copy(occ);
    this.headPose.quaternion.copy(qHead);
    // jaw: panting, actions (bite, chew, lap)
    const pant = cfg.breath.pant ? smooth(0.15, 0.6, this.heat) * (vn < 6 ? 1 : 0.3) : 0;
    const jawT = pant * (0.16 + 0.08 * Math.sin(this.breath)) + P.jaw;
    const ja = this.jaw.step(jawT, P.jawOmega, dt);
    if (cfg.hasJaw) {
      const hinge = tv().copy(J.jawHinge).sub(J.occiput).applyQuaternion(qHead).add(occ);
      this.setBoneQ('jaw', hinge, tqc(qHead).multiply(tqa(X1, ja)), ONE);
    }
    if (cfg.hasEars) this.solveEars(dt, qHead, occ, look);
  }

  solveEars(dt, qHead, occ, look) {
    const cfg = this.cfg, J = this.J, P = this.P, E = cfg.ears, t = this.time;
    const vn = this.speed / cfg.sq;
    const lod = this.lod;
    for (let k = 0; k < 2; k++) {
      const S = k === 0 ? 'L' : 'R', s = k === 0 ? 1 : -1, ER = this.ears[k];
      const sp = k === 0 ? this.earL : this.earR, sw = k === 0 ? this.earSwL : this.earSwR;
      const tw = lod ? 0 : E.twitch * P.earTwitch * ((Math.sin(t * 0.7 + s * 3) > 0.985 ? 0.5 : 0) + 0.08 * Math.sin(t * 1.3 + s));
      const fs = E.flattenSpeeds || FLATTEN_SPEEDS;
      const back = smooth(fs[0], fs[1], vn) * E.speedFlatten * P.gaitW;
      const a = sp.step(E.rest[0] + (back + tw + P.earFlat * 1.1) * E.mobility, 18, dt);
      // swivel the pinna toward the look target
      let swT = 0;
      if (look && E.prick) {
        const to = tv().subVectors(look, occ);
        const rel = clamp(angDiff(this.heading, Math.atan2(to.x, to.z)), -1.5, 1.5);
        swT = clamp(rel * s * 0.6, -1, 1) * E.prick;
      }
      swT += P.earSwivel * s;
      const swv = sw.step(swT * (1 - P.earFlat), 10, dt);
      const base = tv().copy(ER.base).sub(J.occiput).applyQuaternion(qHead).add(occ);
      const earAx = tv().subVectors(ER.tip, ER.base).normalize();
      const q = tqc(qHead).multiply(tqa(X1, a)).multiply(tqa(Z1, -s * (a * 0.4 + E.rest[1]))).multiply(tqa(earAx, swv));
      // the pinna never enters the ground (a head lying on its side): fold it back or forward along
      // the head just enough (axis across the ear and the head's long axis: never parallel to the ear)
      const v = tv().subVectors(ER.tip, ER.base).applyQuaternion(q);
      const ax = tv().crossVectors(v, tv(0, 0, 1).applyQuaternion(qHead)).normalize();
      // (and the pinna's skin tip and rim with it, ER.pts: one correction, clearMulti)
      let phi;
      if (ER.pts && (this._hc[4 + k] !== 0 || (base.y - this.pos.y < ER.reach + 0.5 * cfg.legLen && base.y - this.terrainH(base.x, base.z) < ER.reach + 0.02 * cfg.k))) {
        // (each point's floor under where last frame's correction put it)
        const V = this._cmV, F = this._cmF, w = tv(), l = this._hc[4 + k];
        for (let j = 0; j <= EAR_PTS; j++) {
          if (j === 0) V[0].copy(v); else V[j].copy(ER.pts[j - 1]).applyQuaternion(q);
          w.copy(V[j]).applyAxisAngle(ax, l);
          F[j] = this.terrainH(base.x + w.x, base.z + w.z) + (j === 0 ? 0.008 : 0.006) * cfg.k;
        }
        phi = this.clearMulti(ax, V, F, EAR_PTS + 1, base.y, this._hc, 4 + k, dt);
      } else phi = this.clearAbout(ax, v, base.y, this.terrainH(base.x + v.x, base.z + v.z) + 0.008 * cfg.k, this._hc, 4 + k, dt);
      if (phi !== 0) q.premultiply(tqa(ax, phi));
      this.setBoneQ(ER.name, base, q, ONE);
    }
  }

  // ----------------------------------------------------------------- tail
  // Carriage by speed from the species table; stride sway; idle life (flick / wag / swish);
  // the cheetah tail-use model in turns and speed changes; each segment is a damped angular spring
  // toward a target bend relative to its parent, so motion ripples from base to tip; ground contact
  // is a hard constraint.
  solveTail(dt) {
    const cfg = this.cfg, T = cfg.tail, tl = this.tail, n = tl.n, g = this.gait, P = this.P, fr = this.fr;
    const v = this.speed, vn = v / cfg.sq, gal = g.gallop * P.gaitW, s = cfg.k;
    const moving = smooth(0.05, 1.0, vn) * P.gaitW;
    const t = this.time;
    const pitch = tl.pitch, yaw = tl.yaw;
    tableAt(cfg.tailCarry, vn, tl.carry);
    for (let i = 0; i < n; i++) { pitch[i] = tl.carry[i]; yaw[i] = 0; }
    // drive signals
    const aFwd = (v - tl.prevV) / Math.max(dt, 1e-4);
    tl.prevV = v;
    tl.aFwdS = expTo(tl.aFwdS, clamp(aFwd, -14, 14), dt, 0.16);
    const aLat = v * this.yawRate;
    tl.aLatFast = expTo(tl.aLatFast, aLat, dt, 0.04);
    tl.aLatSlow = expTo(tl.aLatSlow, aLat, dt, 0.14);
    // stride sway at walk / trot
    const swayA = T.sway * DEG * moving * (1 - 0.55 * smooth(1.6, 3.5, vn)) * (1 - gal);
    for (let i = 0; i < n; i++) {
      const k = i * 10 / n;
      yaw[i] += swayA * (0.35 + 0.12 * k) * Math.sin(TAU * this.phase - 0.42 * k);
      pitch[i] += 0.06 * gal * Math.sin(TAU * (this.phase + 0.3) - 0.3 * k);
    }
    // curl over the back (distal segments bend up)
    if (T.curl) for (let i = 0; i < n; i++) pitch[i] += T.curl * DEG * Math.pow(i / Math.max(1, n - 1), 1.5);
    // idle life
    const idle = (1 - moving) * P.tailIdle;
    if (idle > 0.01) {
      const wander = Math.sin(t * 0.31) * 0.6 + Math.sin(t * 0.137 + 1.3) * 0.4;
      for (let i = 0; i < n; i++) yaw[i] += idle * 14 * DEG * wander * (0.25 + i / n);
      if (T.flick) {
        tl.flickT -= dt;
        if (tl.flickT <= 0) { tl.flickT = 3.5 + this.rand() * 6; tl.flickAmp = (this.rand() < 0.5 ? -1 : 1) * (0.6 + this.rand() * 0.4); tl.flickAge = 0; }
        tl.flickAge += dt;
        const fk = Math.exp(-tl.flickAge * 3.2) * Math.sin(Math.min(tl.flickAge * 9, Math.PI)) * T.flick;
        const i0 = Math.floor(n * 0.6);
        for (let i = i0; i < n; i++) { const r = (i - i0 + 1) / (n - i0); yaw[i] += idle * fk * tl.flickAmp * 22 * DEG * r; pitch[i] += idle * fk * 12 * DEG * r; }
      }
      if (T.swish) {
        tl.swishT -= dt;
        if (tl.swishT <= 0) { tl.swishT = 2 + this.rand() * 5; tl.swishAmp = (this.rand() < 0.5 ? -1 : 1); tl.swishAge = 0; }
        tl.swishAge += dt;
        const sk = Math.sin(Math.min(tl.swishAge * 2.4, Math.PI)) * T.swish;
        for (let i = 0; i < n; i++) yaw[i] += idle * sk * tl.swishAmp * 18 * DEG * (0.3 + i / n);
      }
    }
    const wag = Math.max(T.wag * (1 - moving * 0.6), P.tailWag);
    if (wag > 0.01) for (let i = 0; i < n; i++) yaw[i] += wag * 0.5 * Math.sin(t * TAU * 2.6 - i * 0.25) * (0.4 + i / n);
    // cheetah tail-use model: into the turn, then swung to the outside; cone in sustained turns;
    // acceleration swings it down, braking up
    if (T.balance) {
      const turnIn = 0.18 * (tl.aLatFast - tl.aLatSlow);
      const turnOut = -0.066 * tl.aLatSlow;
      const side = clamp((turnIn + turnOut) * smooth(2, 8, vn), -1.1, 1.1) * T.balance * P.gaitW;
      const cone = clamp(Math.abs(tl.aLatSlow) / 13, 0, 1) * 0.2 * gal * T.balance;
      for (let i = 0; i < n; i++) {
        const k = i * 10 / n;
        yaw[i] += side * (0.55 + 0.06 * k) + cone * Math.sin(TAU * this.phase) * (0.5 + 0.06 * k);
        pitch[i] += Math.abs(side) * 0.3 + cone * Math.cos(TAU * this.phase) * Math.sign(tl.aLatSlow || 1) * 0.5;
      }
      const pAcc = clamp(-tl.aFwdS * 0.042, -0.34, 0.55) * smooth(0.5, 3, vn + Math.abs(tl.aFwdS) * 0.3) * T.balance;
      for (let i = 0; i < n; i++) pitch[i] += pAcc * (1 - 0.35 * i / Math.max(1, n - 1));
    }
    // posture: lift, drop to the ground, curl around the body
    for (let i = 0; i < n; i++) {
      const r = i / Math.max(1, n - 1);
      pitch[i] += P.tailLift * (1 - 0.5 * r);
      if (P.tailGround > 0) pitch[i] = lerp(pitch[i], -1.35 + 1.1 * r * r, P.tailGround);
      yaw[i] += P.tailSide * (0.05 + Math.pow(r, 1.3)); // cumulative: the tail curls around
      yaw[i] += P.tailCurl * (1 - Math.pow(1 - r, 3)); // wrapped: turns near the root, then runs on
    }
    // frame: follow the pelvis near the base, stabilised in space at speed
    const qT = tqc(fr.qHeading).slerp(fr.qPel, lerp(0.8, 0.4, gal) + (1 - P.gaitW) * 0.2);
    const back = tv(0, 0, -1).applyQuaternion(qT), upT = tv(0, 1, 0).applyQuaternion(qT), latT = tv(1, 0, 0).applyQuaternion(qT);
    const U = tl.U;
    for (let i = 0; i < n; i++) tailDir(U[i], back, upT, latT, pitch[i], yaw[i]);
    // keep the targets off the ground
    const rad0 = T.radius[0] * cfg.s, rad1 = T.radius[1] * cfg.s;
    const p = tv();
    for (let it = 0; it < 3; it++) {
      p.copy(fr.tailBase);
      let worst = 0, wi = -1;
      for (let i = 0; i < n; i++) {
        p.addScaledVector(U[i], tl.len[i]);
        const clr = p.y - (this.terrainH(p.x, p.z) + lerp(rad0, rad1, (i + 1) / n) + 0.004 * s);
        if (clr < worst) { worst = clr; wi = i; }
      }
      if (wi < 0) break;
      const dp = Math.min(0.6, -worst / (0.3 * s));
      for (let i = 0; i <= wi; i++) { pitch[i] += dp * (0.4 + 0.6 * i / Math.max(1, wi)); tailDir(U[i], back, upT, latT, pitch[i], yaw[i]); }
    }
    // damped angular springs, parent-relative targets
    const D = tl.D, Wv = tl.W;
    if (!tl.init) { for (let i = 0; i < n; i++) { D[i].copy(U[i]); Wv[i].set(0, 0, 0); } tl.init = true; }
    const stiffen = lerp(1, 1.5, gal) * T.stiffness * P.tailStiff;
    const wAbs = lerp(0.3, 0.75, smooth(2, 10, vn));
    const sub = this.lod >= 2 ? 1 : this.lod === 1 ? Math.max(1, Math.ceil(dt / (1 / 60))) : Math.max(1, Math.ceil(dt / (1 / 120)));
    const hstep = dt / sub;
    for (let i = 1; i < n; i++) tl.rel[i].setFromUnitVectors(U[i - 1], U[i]);
    // follow-through: the stride carries the tail's root up and down and from side to side; the tail
    // lags it like a chain of pendulums: the root's acceleration (low-passed, vertical and sideways)
    // spins each segment by d x (-a) / its distance from the root, and the springs swing it back.
    // (Through the spring targets it was filtered away: the root's bounce at twice the stride frequency
    // is above the springs' own) cfg.tail.inertia: 1 default, 0 for a stiff stub
    {
      const rb = fr.tailBase;
      if (!tl.rootInit || dt <= 0) { tl.rP = rb.clone(); tl.rV = new THREE.Vector3(); tl.rA = new THREE.Vector3(); tl.rootInit = true; }
      else {
        const vNow = tv().subVectors(rb, tl.rP).multiplyScalar(1 / dt);
        const aNow = tv().subVectors(vNow, tl.rV).multiplyScalar(1 / dt);
        tl.rP.copy(rb); tl.rV.copy(vNow);
        // (the forward part is the body's own speeding up and braking, which the balance model and the
        // carriage table handle: only the vertical and sideways parts; sideways fades in turns)
        const F = fr.F, aF = aNow.x * F.x + aNow.z * F.z;
        aNow.x -= F.x * aF; aNow.z -= F.z * aF;
        const tw = 1 - smooth(0.2, 0.8, Math.abs(this.yawRate));
        aNow.x *= tw; aNow.z *= tw;
        aNow.clampLength(0, 14 * cfg.sk);
        tl.rA.lerp(aNow, 1 - Math.exp(-dt / 0.03));
      }
      // (locomotion only: a hit or a fall jolts the hips far harder than a stride, and the root
      // segment, which carries the skin of the rump, stays with the pelvis)
      const inr = (T.inertia ?? 1) * P.gaitW * P.legGait * this._bobGate * smooth(0.05, 0.4, vn);
      if (inr > 0) {
        let cum = 0;
        const ax = tv();
        for (let i = 0; i < n; i++) {
          cum += tl.len[i];
          if (i === 0) continue;
          ax.crossVectors(D[i], tl.rA).multiplyScalar(-inr * dt / Math.max(cum - 0.5 * tl.len[i], 0.15 * cfg.k)).clampLength(0, 2 * dt * 60);
          Wv[i].add(ax);
        }
      }
    }
    integrateTail(D, Wv, U, tl.rel, n, sub, hstep, stiffen, wAbs);
    // bones along the chain; ground contact as a hard constraint (rotate a segment up just enough)
    tl.p[0].copy(fr.tailBase);
    const latRef = tv(1, 0, 0).applyQuaternion(fr.qPel);
    for (let i = 0; i < n; i++) {
      const pi = tl.p[i], pn = tl.p[i + 1];
      pn.copy(pi).addScaledVector(D[i], tl.len[i]);
      const floor = this.terrainH(pn.x, pn.z) + lerp(rad0, rad1, (i + 1) / n);
      if (pn.y < floor) {
        const dy = clamp((floor - pi.y) / tl.len[i], -1, 1);
        // keep the horizontal heading of the segment, raise its slope to clear the ground
        const hx = D[i].x, hz = D[i].z, hl = Math.hypot(hx, hz) || 1;
        const c = Math.sqrt(1 - dy * dy);
        D[i].set(hx / hl * c, dy, hz / hl * c);
        Wv[i].multiplyScalar(0.5);
        pn.copy(pi).addScaledVector(D[i], tl.len[i]);
      }
      latRef.addScaledVector(D[i], -latRef.dot(D[i])).normalize();
      this.setBoneF(this.tailNames[i], pi, D[i], latRef);
    }
  }

  // ----------------------------------------------------------------- state
  publish() {
    const st = this.state, P = this.P;
    st.heading = this.heading;
    st.speed = this.speed;
    st.gait = this.air.active ? 'jump' : st.stats.gait;
    st.grounded = !this.air.active;
    st.eyelid = P.eyelid;
    st.furRaise = P.furRaise || 0;
    st.action = this.actionsLayer.current();
    st.posture = this.actionsLayer.posture;
    for (let i = 0; i < 4; i++) {
      const leg = this.legs[i], o = st.legs[i];
      const pl = P.legs[i];
      // (a foot a posture or action has started to move is no longer a planted gait foot)
      o.stance = leg.state === 'stance' && !this.air.active && P.legGait > 0.5 && pl.fold + pl.sit + pl.side + pl.tuck + pl.reach < 0.005;
      o.contact.copy(leg.contact);
    }
  }
}
