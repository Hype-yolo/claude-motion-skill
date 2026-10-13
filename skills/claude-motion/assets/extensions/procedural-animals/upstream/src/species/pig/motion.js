// Pig motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, a 0.72 m Large White finisher); the
// engine scales them by dynamic similarity for piglets and big sows / boars.
//
// Gaits: lateral-sequence walk (Yucatan minipig and 100-113 kg
// finishers: 1.0-1.7 Hz, duty 0.65 -> 0.55, the hind -> fore interval 0.25 -> 0.3 of the stride),
// a diagonal trot (duty 0.45 -> 0.40, 2.0-2.4 Hz), walk -> trot at Froude ~0.45 (~1.6 m/s), and a
// short transverse gallop (LH, RH, LF, RF) from ~3.5 m/s up to the domestic top speed of ~5 m/s
// (Heglund et al. 1974: trot -> gallop 4.7 m/s at 2.3 Hz for 110 kg). Heavy pigs roll their trunk
// from side to side when walking and trotting (the waddle: behaviour hook).
import { behaviour } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });
// torso sections for a breed's leg length (legs warp k, top 0.36 m) and width factor w
const bodyFor = (legs, w) => {
  const dy = 0.36 * 1.06 * (legs - 1);
  return {
    chest: { y: 0.535 + dy, hh: 0.245, hw: 0.275 * w },
    // (mid and rump measured on the body: barrel 0.199-0.209, rump 0.225-0.24 m; the barrel
    // later widened to 0.21-0.22 over the ribs)
    mid: { y: 0.53 + dy, hh: 0.26, hw: 0.215 * w },
    pelvis: { y: 0.54 + dy, hh: 0.24, hw: 0.255 * w },
    rump: { z: -0.47, y: 0.57 + dy, hh: 0.21, hw: 0.24 * w },
    back: 0.05,
  };
};

export const motion = {
  maxSpeed: 5.2,
  accel: [2.5, 4.5],
  decel: 6,
  // a heavy, stiff-backed animal: a walking turn of 0.7 body lengths radius (research 4: 0.5-1), a
  // cornering limit of 0.3 g (2.2 / 6 were a dog's: 0.61 g, the gallop leaned 23 deg like a motorbike)
  turnRate: 1.6,
  latAccelMax: 3,
  gears: { walk: 1.0, trot: 2.4, gallop: 4.4 },
  gallopBlend: [3.4, 5.2],
  //    name      v     f     D     [FL,   FR,   HL,  HR]
  gaits: [
    G('walk', 0.0, 0.95, 0.66, [0.25, 0.75, 0.0, 0.5], { liftF: 0.04, liftH: 0.035, bobF: 0.01, bobH: 0.01, flex: 0, lat: 0.03, fold: 0.7, heel: 26, tail: 0, drop: 0 }),
    G('walk', 1.3, 1.55, 0.56, [0.3, 0.8, 0.0, 0.5], { liftF: 0.05, liftH: 0.045, bobF: 0.018, bobH: 0.018, flex: 0, lat: 0.04, fold: 0.85, heel: 36, tail: 0.1, drop: 0 }),
    G('trot', 1.7, 1.95, 0.46, [0.52, 0.02, 0.0, 0.5], { liftF: 0.065, liftH: 0.055, bobF: 0.022, bobH: 0.022, flex: 0.008, lat: 0.0, fold: 1.0, heel: 45, tail: 0.3, drop: 0.004 }),
    G('trot', 3.2, 2.35, 0.4, [0.52, 0.02, 0.0, 0.5], { liftF: 0.08, liftH: 0.07, bobF: 0.028, bobH: 0.028, flex: 0.012, lat: 0.0, fold: 1.1, heel: 50, tail: 0.4, drop: 0.008 }),
    G('gallop', 3.6, 2.45, 0.34, [0.55, 0.65, 0.0, 0.12], { liftF: 0.09, liftH: 0.08, bobF: 0.02, bobH: 0.028, flex: 0.06, lat: 0, fold: 1.2, heel: 45, tail: 0.6, drop: 0.012 }),
    G('gallop', 5.2, 2.75, 0.29, [0.56, 0.66, 0.0, 0.12], { liftF: 0.1, liftH: 0.09, bobF: 0.022, bobH: 0.032, flex: 0.08, lat: 0, fold: 1.3, heel: 40, tail: 0.8, drop: 0.02 }),
  ],
  feet: {
    // on the tips of the two main claws, fairly upright pasterns: the fetlock sinks a little under
    // load, the claws flip in swing
    front: { type: 'unguligrade', contact: 0.9, curl: 62, flex: 4, sink: 10, hoofFlex: 16, swingBack: 0.04 },
    hind: { type: 'unguligrade', contact: 0.9, curl: 62, flex: 4, sink: 9, hoofFlex: 16, swingBack: 0.015 },
  },
  stance: { width: 1, gallopWidth: 0.85, sprawl: 0, crouch: 0, scuff: [10, 20, 0] },
  // torso cross-sections (bind pose, reference size): centre height, half height, half width
  // (measured on the bind mesh at the girdles, shoulder and thigh muscles included: tools sec.mjs)
  body: bodyFor(1, 1),


  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: low and forward, the snout near the
    // ground at the walk (side3, side4_walk, research 3), a little higher at the trot, stretched forward
    // when galloping
    carriage: [[0, 0, 0, 0], [1.0, -0.08, 0.03, 0.25], [2.4, -0.02, 0.03, 0.04], [4.4, -0.02, 0.05, 0.0]],
    stab: [[0, 0], [1.0, 0.15], [2.4, 0.35], [4.4, 0.3]],
    neckBend: 22, neckPivot: 0.5, yaw: 0.7, pitchUp: 0.5, pitchDown: 0.7, mouth: 'jawTip',
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), root -> tip]: the curled carriage (rig.js);
    // the behaviour hook adds the helix yaw and uncurls it when the pig rests or is afraid
    carriage: [
      [0.0, [14, -6, -24, -30, -32, -32, -32, -32, -32, -32]],
      [2.4, [18, -2, -20, -27, -30, -30, -30, -30, -30, -30]],
      [4.4, [24, 6, -12, -22, -26, -28, -28, -28, -28, -28]],
    ],
    stiffness: 1.6, sway: 3, flick: 0, wag: 0, swish: 0, curl: 0, balance: 0,
    radius: [0.012, 0.006],
  },
  ears: { rest: [0, 0], mobility: 0.8, speedFlatten: 0.15, twitch: 1.0, prick: 0.35 },
  breath: { rate: 0.35, amp: 0.008, pant: false, pantRate: 2.2, pantAmp: 0.015, heatSpeed: 5 },
  actions: {
    // rooting: the snout goes down to the ground in front of the forefeet (behaviour: nudges)
    eat: { style: 'graze', dropF: 0.06, dropH: 0, pitch: 0.95, ahead: 0.55 },
    drink: { dropF: 0.06, dropH: 0, pitch: 0.95, ahead: 0.55 },
    // poor jumpers: a low scrambling hop (research 4: they step or scramble over 0.3-0.5 m at most; the
    // body rises ~0.2 m, 0.4 s in the air; 0.42 m floated a 120 kg pig over its own withers height)
    jump: { height: 0.16, distance: 0.8, land: [0.24, 0.2] },
    sit: { dropH: 0.85 },
    // kneels on both carpi first, then drops the hindquarters, then flops onto the side
    lie: { style: 'lateral', down: 'front', up: 'front' },
    wallow: { style: 'lateral', down: 'front', up: 'front' },
    sleep: { style: 'lateral', down: 'front', up: 'front' },
    fold: { front: { z: -0.18, k: 1.45, beta: 0.9 } },
    idle: { shift: 0.7 },
  },
  // per breed: the torso sits lower on shorter legs (the legs warp, index.js BREED) and the
  // heavier-hammed breeds rest on wider sections (a body lying on its side)
  variants: {
    landrace: { body: bodyFor(0.98, 1) },
    duroc: { body: bodyFor(1.02, 1.07) },
    hampshire: { body: bodyFor(1, 1.05) },
    berkshire: { body: bodyFor(0.96, 1.03) },
    spotted: { body: bodyFor(0.98, 1.04) },
  },
  hooks: behaviour,
};
