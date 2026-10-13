// Rabbit motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, wild adult ~1.8 kg, hip height when
// hopping ~0.15 m); the engine scales them by dynamic similarity for kits and big domestic breeds.
//
// Gaits (Hall et al. 2022, Kraatz et al. 2021, Heglund et al. 1974): rabbits
// almost never walk. Grazing "shuffle" (hop-step: forefeet one after the other, both hind feet
// slide forward together), half-bound (forefeet land one after the other, the hind feet land
// TOGETHER beside / ahead of the forefeet) and the bound-like escape half-bound with a long
// extended suspension. Offsets [FL, FR, HL, HR] relative to hind touchdown; HL = HR (feet together).
import { hooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  // engine constants scale with the leg length relative to the cheetah's (0.234 m / 0.774 m)
  unit: 0.3,
  maxSpeed: 8,
  // (a hopper: its bound already folds the hind legs deep, and its hops carry their own bounce: the
  // engine's moving crouch, stride roll and variation jittered the hocks and wrists, and sitting back
  // on its haunches to brake pressed its long flat hind feet into the ground)
  moveCrouch: 0, stride: { bob: 1, bobSpring: true, roll: 0, vary: 0, brake: 0, gallop: 0 },
  accel: [9, 16],
  decel: 14,
  turnRate: 5.5,
  latAccelMax: 22,
  gears: { shuffle: 0.25, halfbound: 1.2, bound: 3.5 },
  gallopBlend: [1.2, 4],
  // the back flexes and extends in every hop, not only at a gallop
  flexBlend: [0.3, 1.5],
  hooks,
  gaits: [
    G('shuffle', 0.0, 1.3, 0.74, [0.44, 0.6, 0.0, 0.0], { liftF: 0.018, liftH: 0.02, bobF: 0.004, bobH: 0.01, flex: 0.04, lat: 0, fold: -0.2, heel: 10, tail: 0.1, drop: 0 }),
    G('shuffle', 0.35, 1.7, 0.62, [0.46, 0.6, 0.0, 0.0], { liftF: 0.024, liftH: 0.028, bobF: 0.006, bobH: 0.016, flex: 0.06, lat: 0, fold: -0.2, heel: 14, tail: 0.2, drop: 0 }),
    G('halfbound', 0.7, 2.2, 0.34, [0.5, 0.62, 0.0, 0.0], { liftF: 0.035, liftH: 0.045, bobF: 0.012, bobH: 0.02, flex: 0.1, lat: 0, fold: -0.2, heel: 18, tail: 0.4, drop: -0.012 }),
    G('halfbound', 1.8, 2.8, 0.26, [0.46, 0.58, 0.0, 0.0], { liftF: 0.045, liftH: 0.055, bobF: 0.016, bobH: 0.024, flex: 0.13, lat: 0, fold: -0.2, heel: 22, tail: 0.6, drop: -0.02 }),
    G('bound', 3.2, 3.4, 0.2, [0.44, 0.54, 0.0, 0.0], { liftF: 0.055, liftH: 0.06, bobF: 0.018, bobH: 0.026, flex: 0.17, lat: 0, fold: -0.2, heel: 25, tail: 0.85, drop: -0.022 }),
    G('bound', 6.5, 4.0, 0.16, [0.42, 0.52, 0.0, 0.0], { liftF: 0.06, liftH: 0.065, bobF: 0.02, bobH: 0.028, flex: 0.2, lat: 0, fold: -0.2, heel: 25, tail: 1, drop: -0.024 }),
    G('bound', 10, 4.4, 0.14, [0.42, 0.52, 0.0, 0.0], { liftF: 0.065, liftH: 0.07, bobF: 0.02, bobH: 0.03, flex: 0.22, lat: 0, fold: -0.2, heel: 25, tail: 1, drop: -0.026 }),
  ],
  feet: {
    // short forelegs: land close in front of the shoulder and lift early (limits / leg length)
    front: { type: 'digitigrade', curl: 50, contact: 0.5, flex: 4, lead: 0.15, liftBehind: 0.8, retract: 0.8, elbowDown: 0.4 },
    // flat on the ground at rest (bind), on the toes in motion (the pantograph lifts the heel)
    hind: { type: 'digitigrade', curl: 40, contact: 0.55, retract: 0.8, liftBehind: 0.25, plantRest: true, restTilt: 6 },
  },
  stance: { width: 1, gallopWidth: 0.85, sprawl: 0, crouch: 0, scuff: [6, 12, 0] },
  body: {
    // (sections of the half-extended bind sculpt: brisket bottom ~47 mm, belly ~35 mm, rump ~60 mm)
    chest: { y: 0.105, hh: 0.068, hw: 0.053 },
    pelvis: { y: 0.11, hh: 0.05, hw: 0.075 },
    mid: { y: 0.095, hh: 0.06, hw: 0.07 },
    back: 0.045,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]
    carriage: [[0, 0, 0, 0], [0.7, -0.008, 0.006, 0.08], [3, -0.015, 0.012, 0.12], [8, -0.02, 0.018, 0.15]],
    stab: [[0, 0], [0.5, 0.15], [1.5, 0.2], [4, 0.25], [8, 0.3]],
    // a rabbit sees almost all round: it turns its head little (the skin of the short neck is
    // stretched by every degree the skull turns on the atlas)
    neckBend: 40, neckPivot: 0.5, yaw: 0.55, pitchUp: 0.4, pitchDown: 0.5,
  },
  tail: {
    // the scut is pressed down against the rump at rest and flipped up at speed (white flag)
    carriage: [
      [0.0, [-12, -24, -36]],
      [0.7, [-10, -18, -26]],
      [2.5, [-8, 12, 35]],
      [5, [-2, 28, 60]],
    ],
    stiffness: 2.2, sway: 0, flick: 0.4, wag: 0, swish: 0, curl: 0, balance: 0,
    radius: [0.014, 0.012],
  },
  ears: { mobility: 0.7, speedFlatten: 0.9, flattenSpeeds: [1.5, 7], twitch: 1.5, prick: 0.6 },
  breath: { rate: 0.8, amp: 0.02, pant: false, heatSpeed: 8 },
  actions: {
    attack: { style: 'bite-lunge' },
    eat: { style: 'graze', dropF: 0.1, dropH: 0.0, pitch: 1.6 },
    drink: { dropF: 0.12, dropH: 0.0, pitch: 1.6 },
    jump: { height: 0.45, distance: 1.0 },
    idle: { shift: 0.35, restep: false },
    sit: {},
    lie: {},
    sleep: { style: 'curl' },
  },
};
