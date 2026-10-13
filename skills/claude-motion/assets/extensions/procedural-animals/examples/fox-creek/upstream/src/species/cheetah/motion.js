// Cheetah motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, shoulder height ~0.76 m); the engine
// scales them by dynamic similarity for smaller / larger individuals.
//
// Gaits (from high-speed footage studies of cheetahs, Hildebrand 1959/1961, Hudson et al. 2012):
// lateral-sequence walk, trot, rotary canter and rotary gallop with two flight phases (gathered and
// extended); stride frequency rises only slowly with speed (2.3 -> 3.6 Hz), stride length does the work.
const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  unit: 1, // the reference size the engine's own constants were tuned on
  maxSpeed: 29,
  moveCrouch: 0.02, // (its long, light legs need little extra flex; more stretched the neck and flank skin)
  stride: { bob: 0.3 }, // (a sprinter runs flat: its back flexes, the body hardly bounces)
  accel: [7, 10],
  decel: 11,
  turnRate: 2.4,
  latAccelMax: 13,
  gears: { walk: 1.25, trot: 3.0, canter: 5.6, gallop: 13, sprint: 27 },
  gallopBlend: [4.5, 9],
  gaits: [
    G('walk', 0.0, 0.8, 0.7, [0.2, 0.7, 0.0, 0.5], { liftF: 0.06, liftH: 0.05, bobF: 0.006, bobH: 0.006, flex: 0.0, lat: 0.06, fold: 1.0, heel: 40, tail: 0, drop: 0.0 }),
    G('walk', 1.5, 1.25, 0.62, [0.22, 0.72, 0.0, 0.5], { liftF: 0.075, liftH: 0.06, bobF: 0.01, bobH: 0.01, flex: 0.0, lat: 0.06, fold: 1.25, heel: 45, tail: 0.15, drop: 0.0 }),
    G('trot', 2.4, 1.75, 0.46, [0.51, 0.01, 0.0, 0.5], { liftF: 0.11, liftH: 0.09, bobF: 0.022, bobH: 0.022, flex: 0.03, lat: 0.02, fold: 1.5, heel: 55, tail: 0.35, drop: 0.01 }),
    G('trot', 3.6, 1.95, 0.41, [0.51, 0.01, 0.0, 0.5], { liftF: 0.13, liftH: 0.11, bobF: 0.026, bobH: 0.026, flex: 0.04, lat: 0.01, fold: 1.6, heel: 60, tail: 0.45, drop: 0.015 }),
    G('canter', 5.2, 2.1, 0.36, [0.47, 0.35, 0.0, 0.14], { liftF: 0.17, liftH: 0.15, bobF: 0.022, bobH: 0.035, flex: 0.22, lat: 0, fold: 1.8, heel: 65, tail: 0.6, drop: 0.025 }),
    G('gallop', 8.5, 2.3, 0.3, [0.62, 0.52, 0.0, 0.11], { liftF: 0.22, liftH: 0.2, bobF: 0.03, bobH: 0.05, flex: 0.38, lat: 0, fold: 1.95, heel: 70, tail: 0.8, drop: 0.035 }),
    G('gallop', 16, 2.9, 0.25, [0.62, 0.5, 0.0, 0.13], { liftF: 0.26, liftH: 0.24, bobF: 0.03, bobH: 0.055, flex: 0.5, lat: 0, fold: 2.05, heel: 75, tail: 0.95, drop: 0.06 }),
    G('sprint', 29, 3.6, 0.22, [0.63, 0.5, 0.0, 0.14], { liftF: 0.27, liftH: 0.25, bobF: 0.03, bobH: 0.055, flex: 0.56, lat: 0, fold: 2.1, heel: 78, tail: 1.0, drop: 0.07 }),
  ],
  feet: {
    front: { type: 'digitigrade', curl: 55 },
    hind: { type: 'digitigrade', curl: 70 },
  },
  stance: { width: 1, gallopWidth: 0.55, sprawl: 0, crouch: 0 },
  // torso cross-sections (bind pose, reference size): centre height, half height, half width
  body: {
    chest: { y: 0.5, hh: 0.135, hw: 0.115 },
    pelvis: { y: 0.55, hh: 0.105, hw: 0.12 }, // hw includes the thigh muscles (lying on the side)
    rump: { z: -0.578, y: 0.6, hh: 0.115, hw: 0.097 }, // over the tail root (from the mesh; low enough for the flanks)
    back: 0.075,
  },
  head: {
    // stride nod [walk, trot, gallop, phase]: a cheetah holds its head famously still while it runs
    nod: [0.03, 0.015, 0.012, 0.04],
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]
    carriage: [[0, 0.012, -0.012, 0], [4.5, 0.012, -0.012, 0], [9, -0.06, 0.045, 0.15]],
    // [speed, stabilisation 0..1]
    stab: [[0, 0], [0.9, 0.22], [1.8, 0.24], [4.5, 0.32], [9, 0.62]],
    neckBend: 36, neckPivot: 0.6, yaw: 1.1, pitchUp: 0.5, pitchDown: 0.6,
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), base -> tip]
    carriage: [
      [0.0, [-42, -58, -67, -72, -73, -68, -54, -30, 0, 22]],
      [1.2, [-34, -50, -60, -63, -61, -53, -38, -16, 6, 22]],
      [3.0, [-26, -35, -38, -37, -32, -24, -14, -3, 8, 17]],
      [5.6, [-20, -22, -19, -14, -9, -4, 1, 6, 11, 16]],
      [13, [-16, -12, -8, -5, -2, 1, 3, 6, 9, 13]],
      [27, [-12, -8, -5, -2, 0, 2, 3, 5, 8, 11]],
    ],
    stiffness: 1, sway: 7, flick: 1, wag: 0, swish: 0, curl: 0,
    balance: 1, // cheetah tail-use model in turns and speed changes
    radius: [0.028, 0.016],
  },
  ears: { mobility: 1, speedFlatten: 0.7, twitch: 1, prick: 0.35 },
  breath: { rate: 0.35, amp: 0.012, pant: true, pantRate: 2.6, pantAmp: 0.05, heatSpeed: 9 },
  actions: {
    attack: { style: 'bite-lunge' },
    eat: { style: 'tear', dropF: 0.62, dropH: 0.7 }, // crouched over the kill: hindquarters down too
    drink: { dropF: 0.72, dropH: 0.3, fold: 0.5 },
    jump: { height: 0.75, distance: 3.2 },
    sit: {},
    lie: {},
    sleep: { style: 'curl' },
  },
};
