// Lion motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, withers ~1.07 m); the engine scales them
// by dynamic similarity for cubs and big males.
//
// Gaits: a slow, heavy lateral-sequence walk (0.8-1.6 m/s, 0.6-0.8 Hz,
// duty 0.72-0.64, [LF .27, RF .77, LH 0, RH .5]), head carried low; a trot that lions rarely use
// (2-4 m/s, 1.3-1.7 Hz, duty 0.46-0.4: a narrow band between walk and gallop); the transverse gallop
// (4.5-8 m/s, 1.8-2.2 Hz, duty 0.36-0.3) and the rotary gallop of the charge (8-16 m/s, 2.2-2.6 Hz,
// duty 0.3-0.22, LH-RH-RF-LF); top speed ~14-16 m/s in bursts (98th percentile 13.9 m/s, Wilson et
// al. 2018), hard acceleration and even harder braking.
import { lionHooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  hooks: lionHooks,
  maxSpeed: 16,
  accel: [6, 9.5],
  decel: 13,
  // a heavy cat turns slowly and wide: ~50 deg/s at the walk, ~0.7 rad/s at a 7 m/s gallop (10 m radius,
  // a ~23 deg lean at speed),
  // wider at the charge (88 deg/s at the walk and a 5 m gallop radius read as a swinging rod)
  turnRate: 1.1,
  latAccelMax: 5,
  gears: { walk: 1.2, trot: 2.9, gallop: 7, sprint: 14 },
  gallopBlend: [4.2, 8],
  gaits: [
    G('walk', 0.0, 0.62, 0.72, [0.27, 0.77, 0.0, 0.5], { liftF: 0.075, liftH: 0.06, bobF: 0.008, bobH: 0.008, flex: 0.0, lat: 0.05, fold: 1.0, heel: 35, tail: 0, drop: 0.0, width: 0.95 }),
    G('walk', 1.5, 0.82, 0.64, [0.27, 0.77, 0.0, 0.5], { liftF: 0.1, liftH: 0.075, bobF: 0.014, bobH: 0.012, flex: 0.0, lat: 0.05, fold: 1.2, heel: 42, tail: 0.1, drop: 0.0, width: 0.9 }),
    G('trot', 2.1, 1.35, 0.46, [0.5, 0.02, 0.0, 0.5], { liftF: 0.13, liftH: 0.11, bobF: 0.025, bobH: 0.025, flex: 0.02, lat: 0.015, fold: 1.45, heel: 50, tail: 0.3, drop: 0.01, width: 0.95 }),
    G('trot', 3.6, 1.6, 0.4, [0.5, 0.02, 0.0, 0.5], { liftF: 0.15, liftH: 0.13, bobF: 0.03, bobH: 0.03, flex: 0.03, lat: 0.01, fold: 1.55, heel: 56, tail: 0.4, drop: 0.015, width: 0.95 }),
    G('gallop', 4.8, 1.85, 0.36, [0.46, 0.58, 0.0, 0.12], { liftF: 0.2, liftH: 0.18, bobF: 0.03, bobH: 0.045, flex: 0.22, lat: 0, fold: 1.75, heel: 62, tail: 0.6, drop: 0.03, width: 0.9 }),
    // (transverse up to 7.5 m/s, rotary from 9.5: in between the leads swap, and the 7 m/s gear read both
    // forefeet landing together, a half-bound)
    G('gallop', 7.5, 2.1, 0.32, [0.46, 0.58, 0.0, 0.12], { liftF: 0.235, liftH: 0.215, bobF: 0.033, bobH: 0.055, flex: 0.3, lat: 0, fold: 1.85, heel: 66, tail: 0.75, drop: 0.035, width: 0.95 }),
    G('gallop', 9.5, 2.25, 0.29, [0.58, 0.46, 0.0, 0.12], { liftF: 0.25, liftH: 0.23, bobF: 0.035, bobH: 0.06, flex: 0.34, lat: 0, fold: 1.9, heel: 68, tail: 0.8, drop: 0.04, width: 1 }),
    G('gallop', 16, 2.6, 0.23, [0.58, 0.46, 0.0, 0.12], { liftF: 0.3, liftH: 0.28, bobF: 0.04, bobH: 0.07, flex: 0.44, lat: 0, fold: 2.0, heel: 72, tail: 0.95, drop: 0.07, width: 1 }),
  ],
  feet: {
    front: { type: 'digitigrade', curl: 55 },
    hind: { type: 'digitigrade', curl: 65 },
  },
  stance: { width: 1, gallopWidth: 0.6, sprawl: 0, crouch: 0.03 }, // (a tall walk on straight legs: 0.15 walked crouched)
  // torso cross-sections (bind, reference size): centre height, half height, half width (from the mesh)
  body: {
    chest: { y: 0.745, hh: 0.28, hw: 0.185 },
    pelvis: { y: 0.79, hh: 0.25, hw: 0.18 }, // incl. the thigh muscles a lion lying on its side rests on
    rump: { z: -0.765, y: 0.81, hh: 0.17, hw: 0.165 },
    back: 0.13,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: standing head at about withers
    // height; the relaxed walk carries it low (crown below the withers, nose ~30 deg down) and the
    // charge stretches it forward in line with the spine
    carriage: [[0, 0.02, 0.0, -0.06], [1.0, -0.075, 0.04, 0.27], [2.4, -0.08, 0.05, 0.24], [4.5, -0.085, 0.07, 0.2], [9, -0.1, 0.09, 0.16]],
    stab: [[0, 0], [0.9, 0.25], [1.8, 0.3], [4.5, 0.34], [9, 0.6]],
    neckBend: 30, neckPivot: 0.4, yaw: 0.85, pitchUp: 0.45, pitchDown: 0.6,
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), base -> tip]: J-hang with the tuft curled up at
    // rest and in the walk; lifted into a shallow curve in the gallop
    carriage: [
      [0.0, [-40, -62, -74, -80, -82, -80, -72, -54, -24, 12]],
      [1.2, [-36, -58, -71, -77, -79, -76, -66, -46, -16, 16]],
      [3.0, [-24, -38, -46, -50, -50, -46, -38, -24, -6, 12]],
      [6.0, [-16, -20, -20, -18, -14, -9, -3, 4, 10, 16]],
      [12, [-10, -10, -8, -6, -3, 0, 3, 6, 9, 12]],
    ],
    stiffness: 0.9, sway: 6, flick: 1, wag: 0, swish: 0, curl: 0,
    balance: 0.6, // counterweight in turns and speed changes: the tuft lags and overshoots
    radius: [0.055, 0.045], // (coat and the tuft included)
  },
  ears: { rest: [0, 0], mobility: 0.6, speedFlatten: 0.45, twitch: 1, prick: 0.3 },
  breath: { rate: 0.25, amp: 0.012, pant: true, pantRate: 2.2, pantAmp: 0.045, heatSpeed: 7 },
  actions: {
    attack: { style: 'pounce' }, // replaced by the species action (stalk, charge, pounce, neck bite): behaviour.js
    eat: { style: 'tear', dropF: 0.45, dropH: 0.5, ahead: 0.75, pitch: 0.85 }, // (the lion's own eat lies down: behaviour.js)
    drink: { dropF: 0.72, dropH: 0.35, ahead: 0.7, pitch: 0.9 }, // crouched at the edge, elbows out, lapping
    jump: { height: 1.2, distance: 3.6 },
    sit: {},
    lie: { dropF: 0.93, dropH: 0.97 },
    // sphinx: forelegs stretched forward along the ground (paws ~0.7 leg lengths ahead of the shoulder;
    // the thick forearm lies on the ground instead of folding into it)
    fold: { front: { z: 0.03, k: -1.45, beta: 0 } },
    sleep: { style: 'lateral' }, // flat on one flank, legs out
  },
};
