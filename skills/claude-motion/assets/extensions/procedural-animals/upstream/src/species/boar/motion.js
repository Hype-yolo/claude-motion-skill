// Wild boar motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, a 0.75 m adult); the engine scales them
// by dynamic similarity for piglets, yearlings and big boars.
//
// Gaits (domestic-pig kinematics scaled to boar size and leg length):
// lateral-sequence walk (duty 0.68 -> 0.6, the slow foraging walk at 0.3-0.8 m/s), the trot as the
// main travelling gait (duty 0.45 -> 0.36, 2.0-2.4 Hz: short quick steps, head low and steady, the
// "scurrying" look of side3) and the transverse gallop with a suspension (LH, RH, LF, RF; up to
// ~11 m/s = 40 km/h). Walk -> trot at Froude ~0.45 (1.7 m/s for a 0.72 m hip height), trot -> gallop
// 4.5 m/s at 2.4 Hz (Heglund et al. 1974 for 90 kg).
import { hooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  maxSpeed: 10.5,
  stride: { gallop: 0.5 }, // (short legs under a heavy forehand: half the gallop drop and reach, more stretched the neck)
  accel: [4, 8],
  decel: 8,
  turnRate: 3.0, // agile for its mass: tight turns pivoting on the forehand
  latAccelMax: 9,
  gears: { walk: 0.9, trot: 2.8, gallop: 6.5 },
  gallopBlend: [4.0, 6.5],
  //    name      v     f     D     [FL,   FR,   HL,  HR]
  gaits: [
    G('walk', 0.0, 0.85, 0.68, [0.25, 0.75, 0.0, 0.5], { liftF: 0.04, liftH: 0.035, bobF: 0.01, bobH: 0.01, flex: 0, lat: 0.025, fold: 0.7, heel: 28, tail: 0, drop: 0 }),
    G('walk', 1.4, 1.35, 0.6, [0.28, 0.78, 0.0, 0.5], { liftF: 0.05, liftH: 0.045, bobF: 0.018, bobH: 0.018, flex: 0, lat: 0.03, fold: 0.85, heel: 38, tail: 0.1, drop: 0 }),
    G('trot', 1.9, 2.0, 0.45, [0.52, 0.02, 0.0, 0.5], { liftF: 0.065, liftH: 0.055, bobF: 0.02, bobH: 0.02, flex: 0.01, lat: 0.0, fold: 1.0, heel: 48, tail: 0.3, drop: 0.006 }),
    G('trot', 4.0, 2.4, 0.36, [0.52, 0.02, 0.0, 0.5], { liftF: 0.08, liftH: 0.07, bobF: 0.026, bobH: 0.026, flex: 0.015, lat: 0.0, fold: 1.12, heel: 55, tail: 0.45, drop: 0.01 }),
    G('gallop', 4.8, 2.45, 0.3, [0.55, 0.65, 0.0, 0.12], { liftF: 0.1, liftH: 0.09, bobF: 0.02, bobH: 0.028, flex: 0.07, lat: 0, fold: 1.3, heel: 45, tail: 0.7, drop: 0.018 }),
    G('gallop', 10.5, 2.95, 0.22, [0.56, 0.66, 0.0, 0.12], { liftF: 0.12, liftH: 0.11, bobF: 0.022, bobH: 0.032, flex: 0.09, lat: 0, fold: 1.4, heel: 40, tail: 1.0, drop: 0.03 }),
  ],
  feet: {
    // cloven hooves on the claw tips: little fetlock sink, the digit flips in swing, breakover about
    // the claw tips
    front: { type: 'unguligrade', contact: 0.9, curl: 70, flex: 4, sink: 10, hoofFlex: 20, swingBack: 0.05 },
    hind: { type: 'unguligrade', contact: 0.9, curl: 70, flex: 4, sink: 9, hoofFlex: 20, swingBack: 0.02 },
  },
  stance: { width: 1, gallopWidth: 0.8, sprawl: 0, crouch: 0, scuff: [10, 20, 0] },
  // torso cross-sections (bind pose, reference size): centre height, half height, half width
  // (measured on the bind mesh; half heights include the legs folded under the chest and thighs)
  body: {
    chest: { y: 0.47, hh: 0.24, hw: 0.2 },
    mid: { y: 0.45, hh: 0.22, hw: 0.18 },
    pelvis: { y: 0.47, hh: 0.22, hw: 0.16 },
    back: 0.05,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: the long head is carried low, the
    // snout 20-35 cm off the ground walking; the trot keeps it low and steady; stretched forward in the
    // gallop
    carriage: [[0, 0.0, 0.0, -0.05], [0.9, -0.03, 0.01, 0.08], [2.8, -0.03, 0.03, 0.02], [5, -0.04, 0.05, 0.0], [9, -0.05, 0.07, -0.02]],
    stab: [[0, 0], [0.9, 0.2], [2.8, 0.6], [5, 0.45], [9, 0.45]],
    neckBend: 22, neckPivot: 0.6, yaw: 0.75, pitchUp: 0.75, pitchDown: 0.8, mouth: 'jawTip',
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), base -> tip]: hangs against the buttocks at
    // rest and walking, held out when trotting, straight up with the tassel flagging in the gallop
    carriage: [
      [0.0, [-35, -60, -72, -78, -82, -84]],
      [1.4, [-30, -55, -68, -75, -80, -82]],
      [2.5, [-5, -25, -40, -52, -60, -66]],
      [5, [15, 12, 5, -5, -15, -25]],
      [9, [32, 30, 25, 18, 8, 0]],
    ],
    stiffness: 1.0, sway: 10, flick: 0, wag: 0, swish: 0.5, curl: 0, balance: 0,
    radius: [0.02, 0.018],
  },
  ears: { rest: [0, 0], mobility: 1.1, speedFlatten: 0.35, flattenSpeeds: [3, 8], twitch: 1.2, prick: 0.5 },
  breath: { rate: 0.3, amp: 0.006, pant: false, pantRate: 2, pantAmp: 0.015, heatSpeed: 6 },
  actions: {
    // rooting: the snout disc on the ground ahead of the forefeet (boar.js hooks: the ploughing thrusts)
    eat: { style: 'graze', dropF: 0.05, dropH: 0, pitch: 0.75, ahead: 0.42 },
    drink: { dropF: 0.06, dropH: 0, pitch: 0.7, ahead: 0.45 },
    // jumps high for its size (1.4-1.5 m fences, research); a compact tuck
    jump: { height: 0.8, distance: 1.6, land: [0.25, 0.22] },
    sit: { dropH: 0.85 },
    // down on the carpi first, then the hindquarters; up forelegs first (dog-sitting)
    lie: { down: 'front', up: 'front' },
    sleep: { style: 'lateral', down: 'front', up: 'front' },
    fold: { front: { z: -0.2, k: 1.45, beta: 0.9 } },
    attack: { style: 'charge' },
  },
  hooks,
};
