// Wolf motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, withers ~0.75 m); the engine scales them
// by dynamic similarity for pups and big males.
//
// Gaits: the wolf is a trot specialist. Lateral-sequence walk (0.5-1.5 m/s,
// 0.9-1.4 Hz, duty 0.60-0.70); the travelling trot (1.5-3.5 m/s, 1.8-2.3 Hz, duty 0.40-0.50, hind of
// each diagonal pair lands ~3 % first) is single-tracking: the feet converge on the midline
// (trail straddle 8-15 cm), which `width` narrows per gait row; transverse canter / lope (4-7 m/s,
// right lead) and a rotary gallop (LH-RH-RF-LF, 2.7-3.5 Hz, duty 0.20-0.28) with flexing spine up to
// 15-17 m/s. Trot -> gallop transition ~3.7-4.5 m/s (1.53 M^0.24 for 40 kg).
import { wolfUpdate } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  // wolf body language layered over every action (tail by mood, ears, hackles, snarl, howling)
  hooks: { update: wolfUpdate },
  maxSpeed: 16,
  accel: [5.5, 9],
  decel: 10,
  // a walking canid turns at ~1-1.5 rad/s, leading with the head (2.6 swung the body round at 1.9 rad/s);
  // a chasing wolf corners at ~0.8 g
  turnRate: 1.8,
  latAccelMax: 8,
  gears: { walk: 1.1, trot: 2.5, canter: 5.2, gallop: 11 },
  gallopBlend: [4.2, 8],
  gaits: [
    G('walk', 0.0, 0.85, 0.7, [0.25, 0.75, 0.0, 0.5], { liftF: 0.06, liftH: 0.05, bobF: 0.006, bobH: 0.006, flex: 0.0, lat: 0.05, fold: 1.0, heel: 35, tail: 0, drop: 0.0, width: 0.95 }),
    G('walk', 1.35, 1.2, 0.62, [0.25, 0.75, 0.0, 0.5], { liftF: 0.075, liftH: 0.06, bobF: 0.01, bobH: 0.01, flex: 0.0, lat: 0.05, fold: 1.2, heel: 42, tail: 0.12, drop: 0.0, width: 0.8 }),
    G('trot', 1.9, 1.85, 0.48, [0.53, 0.03, 0.0, 0.5], { liftF: 0.1, liftH: 0.085, bobF: 0.018, bobH: 0.018, flex: 0.02, lat: 0.015, fold: 1.45, heel: 50, tail: 0.3, drop: 0.006, width: 0.55 }),
    G('trot', 3.6, 2.2, 0.4, [0.53, 0.03, 0.0, 0.5], { liftF: 0.12, liftH: 0.1, bobF: 0.024, bobH: 0.024, flex: 0.03, lat: 0.01, fold: 1.6, heel: 58, tail: 0.4, drop: 0.012, width: 0.5 }),
    G('canter', 4.8, 2.35, 0.36, [0.3, 0.45, 0.0, 0.3], { liftF: 0.16, liftH: 0.14, bobF: 0.022, bobH: 0.035, flex: 0.2, lat: 0, fold: 1.8, heel: 62, tail: 0.6, drop: 0.02, width: 0.8 }),
    G('gallop', 8, 2.7, 0.28, [0.52, 0.42, 0.0, 0.1], { liftF: 0.2, liftH: 0.18, bobF: 0.03, bobH: 0.045, flex: 0.32, lat: 0, fold: 1.9, heel: 68, tail: 0.8, drop: 0.03, width: 1 }),
    G('gallop', 15, 3.3, 0.22, [0.52, 0.42, 0.0, 0.1], { liftF: 0.24, liftH: 0.22, bobF: 0.03, bobH: 0.05, flex: 0.42, lat: 0, fold: 2.0, heel: 72, tail: 0.9, drop: 0.05, width: 1 }),
  ],
  feet: {
    front: { type: 'digitigrade', curl: 55 },
    hind: { type: 'digitigrade', curl: 65 },
  },
  stance: { width: 1, gallopWidth: 0.6, sprawl: 0, crouch: 0, scuff: [11, 18, 0] },
  // torso cross-sections (bind, reference size): centre height, half height, half width (incl. coat)
  body: {
    chest: { y: 0.54, hh: 0.172, hw: 0.13 },
    pelvis: { y: 0.6, hh: 0.2, hw: 0.13 }, // incl. the folded thighs a lying wolf rests on
    back: 0.07,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: standing head at withers height,
    // the travelling trot carries it low (skull at the back line, muzzle 30-45 deg down), the gallop
    // stretches it forward
    carriage: [[0, 0.0, 0.0, 0.1], [1.1, -0.03, 0.02, 0.22], [2.4, -0.085, 0.05, 0.38], [4.5, -0.075, 0.06, 0.3], [9, -0.07, 0.08, 0.2]],
    stab: [[0, 0], [0.9, 0.22], [1.8, 0.3], [4.5, 0.34], [9, 0.6]],
    neckBend: 40, neckPivot: 0.6, yaw: 1.2, pitchUp: 0.6, pitchDown: 0.7,
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), base -> tip]: hangs at rest, ~level with a
    // slight droop in the travelling trot, streams straight back in the gallop
    carriage: [
      [0.0, [-38, -60, -71, -76, -78, -78, -76, -72]],
      [1.1, [-30, -50, -61, -66, -68, -67, -64, -58]],
      [2.4, [-30, -40, -45, -47, -47, -45, -41, -36]], // ~30 deg below level, the tip swinging with the stride
      [5.0, [-16, -20, -22, -22, -20, -17, -13, -9]],
      [10, [-6, -8, -8, -7, -6, -4, -2, 0]],
    ],
    stiffness: 0.9, sway: 9, flick: 0, wag: 0, swish: 0, curl: 0,
    balance: 0.45, // counterweight in turns and speed changes
    radius: [0.075, 0.065], // (the brush: coat included)
  },
  ears: { rest: [0, 0], mobility: 1, speedFlatten: 0.6, twitch: 1, prick: 0.45 },
  breath: { rate: 0.3, amp: 0.012, pant: true, pantRate: 3.0, pantAmp: 0.05, heatSpeed: 10 }, // pants only after a real chase (mouth closed at rest)
  actions: {
    attack: { style: 'bite-lunge', paws: false }, // (forefeet planted: the head and neck drive the bite)
    eat: { style: 'tear', dropF: 0.3, dropH: 0.1, ahead: 0.8 }, // (short neck on long legs: the mouth reaches further ahead)
    drink: { dropF: 0.35, dropH: 0.12, ahead: 0.8 },
    jump: { height: 1.0, distance: 3.6 },
    sit: { dropH: 0.8 },
    lie: {},
    sleep: { style: 'curl' },
  },
};
