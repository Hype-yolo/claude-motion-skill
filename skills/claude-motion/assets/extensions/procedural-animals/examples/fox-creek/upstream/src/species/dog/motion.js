// Dog motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (a 30 kg shepherd type, params.size = 1, withers 0.60 m,
// hip 0.55 m); the engine scales them by dynamic similarity for retrievers (~0.93), terriers (~0.47)
// and pups: speeds x sqrt(size), stride frequencies / sqrt(size) (terrier ~x1.46, as measured).
//
// Gaits (Maes et al. 2008, Blaszczyk & Dobrzecka 2001, Hildebrand 1968,
// Heglund & Taylor 1988): lateral-sequence walk (0.5-1.4 m/s, 1.0-1.6 Hz, duty 0.75-0.6, limb phase
// ~0.25); trot, the dog's steady gait (1.3-3.5 m/s, 1.8-2.6 Hz, duty 0.5-0.35, hind of each diagonal
// ~3 % first), the shepherd's ground-covering flying trot with suspension at its top; the canter is a
// transverse (right-lead) gallop (3-6 m/s, 2.3-2.8 Hz, duty 0.3-0.4), the rotary gallop (LH-RH-RF-LF,
// 2.8-3.9 Hz, duty 0.2-0.3, strong spinal flexion-extension: gathered and extended flights) above
// ~6 m/s. Trot -> gallop 1.53 M^0.24 = 3.5 m/s for 30 kg (Heglund & Taylor 1988).
import { dogHooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });
const GAITS = [
    G('walk', 0.0, 0.95, 0.72, [0.25, 0.75, 0.0, 0.5], { liftF: 0.05, liftH: 0.042, bobF: 0.005, bobH: 0.005, flex: 0.0, lat: 0.05, fold: 1.0, heel: 35, tail: 0, drop: 0.0, width: 0.95 }),
    G('walk', 1.25, 1.35, 0.62, [0.25, 0.75, 0.0, 0.5], { liftF: 0.062, liftH: 0.05, bobF: 0.008, bobH: 0.008, flex: 0.0, lat: 0.05, fold: 1.2, heel: 42, tail: 0.12, drop: 0.0, width: 0.82 }),
    G('trot', 1.75, 1.95, 0.47, [0.53, 0.03, 0.0, 0.5], { liftF: 0.082, liftH: 0.07, bobF: 0.015, bobH: 0.015, flex: 0.02, lat: 0.015, fold: 1.45, heel: 50, tail: 0.3, drop: 0.005, width: 0.62 }),
    G('trot', 3.3, 2.35, 0.38, [0.53, 0.03, 0.0, 0.5], { liftF: 0.1, liftH: 0.085, bobF: 0.02, bobH: 0.02, flex: 0.03, lat: 0.01, fold: 1.6, heel: 58, tail: 0.4, drop: 0.01, width: 0.55 }),
    G('canter', 4.2, 2.5, 0.35, [0.3, 0.45, 0.0, 0.3], { liftF: 0.13, liftH: 0.115, bobF: 0.018, bobH: 0.028, flex: 0.2, lat: 0, fold: 1.8, heel: 62, tail: 0.6, drop: 0.016, width: 0.8 }),
    G('gallop', 7, 2.9, 0.27, [0.52, 0.42, 0.0, 0.1], { liftF: 0.16, liftH: 0.15, bobF: 0.025, bobH: 0.036, flex: 0.34, lat: 0, fold: 1.9, heel: 68, tail: 0.8, drop: 0.025, width: 1 }),
    G('gallop', 13, 3.5, 0.21, [0.52, 0.42, 0.0, 0.1], { liftF: 0.19, liftH: 0.18, bobF: 0.025, bobH: 0.04, flex: 0.44, lat: 0, fold: 2.0, heel: 72, tail: 0.9, drop: 0.04, width: 1 }),
];

export const motion = {
  hooks: dogHooks,
  maxSpeed: 13,
  accel: [5.5, 9],
  decel: 10,
  turnRate: 2.8,
  latAccelMax: 11,
  gears: { walk: 1.0, trot: 2.4, canter: 4.4, gallop: 9 },
  gallopBlend: [3.8, 7],
  gaits: GAITS,
  feet: {
    front: { type: 'digitigrade', curl: 55 },
    hind: { type: 'digitigrade', curl: 65 },
  },
  stance: { width: 1, gallopWidth: 0.6, sprawl: 0, crouch: 0, scuff: [11, 18, 0] },
  // torso cross-sections (bind, reference size): centre height, half height, half width (incl. coat)
  body: {
    // (measured on the bind mesh at the shoulder / hip, + coat; the pelvis includes the thighs a lying
    // dog rests on)
    chest: { y: 0.41, hh: 0.1, hw: 0.112 },
    pelvis: { y: 0.41, hh: 0.15, hw: 0.118 },
    back: 0.055,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: head carried up standing and walking (standing: raised
    // 7 cm, not 9.5 cm and pulled back 4.5: that bunched the throat skin under the jaw into a fold),
    // lowered toward the back line in the shepherd's ground-covering trot, stretched in the gallop
    carriage: [[0, 0.07, -0.02, -0.04], [1.0, 0.03, -0.01, 0.1], [2.4, -0.065, 0.045, 0.3], [4.4, -0.06, 0.05, 0.25], [9, -0.06, 0.07, 0.18]],
    stab: [[0, 0], [0.9, 0.22], [1.8, 0.3], [4.5, 0.34], [9, 0.6]],
    neckBend: 55, neckPivot: 0.6, yaw: 1.25, pitchUp: 0.65, pitchDown: 0.75,
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), base -> tip]: the shepherd's saber tail hangs
    // at rest (tip near the hock), rises toward level in the trot (never above the back), streams
    // back at the gallop
    carriage: [
      [0.0, [-45, -64, -72, -76, -77, -75, -70, -62]],
      [1.0, [-38, -54, -62, -65, -65, -62, -56, -48]],
      [2.4, [-20, -28, -32, -33, -32, -29, -24, -18]],
      [4.4, [-12, -16, -17, -16, -14, -11, -8, -5]],
      [9, [-6, -8, -8, -7, -6, -4, -2, 0]],
    ],
    stiffness: 0.9, sway: 7, flick: 0, wag: 0, swish: 0, curl: 0,
    balance: 0.4,
    radius: [0.055, 0.04],
  },
  ears: { rest: [0, 0], mobility: 1, speedFlatten: 0.6, twitch: 1, prick: 0.45 },
  breath: { rate: 0.3, amp: 0.012, pant: true, pantRate: 3.6, pantAmp: 0.045, heatSpeed: 3.2 },
  actions: {
    attack: { style: 'bite-lunge', paws: false }, // (forefeet planted: the head and neck drive the bite)
    eat: { style: 'tear', dropF: 0.3, dropH: 0.1, ahead: 0.9, pitch: 1.0 },
    drink: { dropF: 0.32, dropH: 0.1, ahead: 0.9, pitch: 1.0 },
    jump: { height: 0.9, distance: 2.8 },
    sit: { dropH: 1.0 },
    lie: {},
    sleep: { style: 'curl' },
  },
  // per variant (merged one level deep over the above)
  variants: {
    retriever: {
      // level, gently curved otter tail, wagging freely; drop ears swing (behaviour.js pose)
      tail: {
        carriage: [
          [0.0, [-28, -40, -46, -50, -52, -52, -50, -46]],
          [1.0, [-18, -26, -30, -32, -33, -32, -30, -26]],
          [2.4, [-10, -14, -16, -17, -17, -16, -14, -12]],
          [4.4, [-6, -8, -9, -9, -8, -7, -5, -3]],
          [9, [-4, -5, -5, -4, -3, -2, -1, 0]],
        ],
        stiffness: 1.0, sway: 9, balance: 0.35, radius: [0.04, 0.018],
      },
      ears: { rest: [0, 0], mobility: 0.25, speedFlatten: 0.25, twitch: 0.3, prick: 0.05 },
      body: { chest: { y: 0.385, hh: 0.112, hw: 0.128 }, pelvis: { y: 0.41, hh: 0.16, hw: 0.13 }, back: 0.05 },
      head: { carriage: [[0, 0.09, -0.045, -0.03], [1.0, 0.04, -0.01, 0.07], [2.4, -0.04, 0.04, 0.22], [4.4, -0.045, 0.05, 0.2], [9, -0.05, 0.07, 0.15]] },
    },
    terrier: {
      // erect tail, carried up (60-90 deg); lowers toward level only at the gallop
      tail: {
        carriage: [
          [0.0, [55, 64, 70, 72, 72, 70, 66, 60]],
          [1.0, [52, 60, 65, 66, 65, 62, 58, 52]],
          [2.4, [42, 48, 50, 50, 48, 45, 40, 35]],
          [4.4, [25, 28, 28, 26, 24, 21, 18, 15]],
          [9, [8, 8, 7, 5, 3, 2, 1, 0]],
        ],
        stiffness: 1.3, sway: 5, balance: 0.3, radius: [0.026, 0.014],
      },
      ears: { rest: [0, 0], mobility: 0.55, speedFlatten: 0.35, twitch: 0.8, prick: 0.15 },
      body: { chest: { y: 0.41, hh: 0.105, hw: 0.108 }, pelvis: { y: 0.41, hh: 0.15, hw: 0.11 }, back: 0.05 },
      head: { carriage: [[0, 0.085, -0.04, -0.04], [1.0, 0.04, -0.01, 0.05], [2.4, -0.02, 0.03, 0.15], [4.4, -0.03, 0.05, 0.15], [9, -0.04, 0.07, 0.12]] },
    },
  },
};
