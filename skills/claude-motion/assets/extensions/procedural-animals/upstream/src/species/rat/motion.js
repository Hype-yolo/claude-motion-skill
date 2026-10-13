// Brown rat motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, ~330 g, hip joint ~56 mm); the engine
// scales them by dynamic similarity for pups and big males.
//
// Gaits (overground runway data for intact rats, Górska et al. / Koopmans et al.;
// hindlimb kinematics, Sci. Rep. 2022): an exploratory walk (lateral-sequence "alternate" pattern,
// LF ~0.3 after LH, duty 0.64-0.75, 1.5-2.5 Hz), a fast walk (4 Hz, duty 0.52), the trot (4.5 Hz,
// duty 0.43, diagonal pairs), a transverse gallop (5.1 Hz), the half-bound (5.6 Hz: the hind feet
// land almost together, the forefeet staggered) and the bound (5.7 Hz, pairs synchronous), mean duty
// 0.40 when running; bursts to ~3 m/s. Offsets [FL, FR, HL, HR] relative to HL touchdown.
import { hooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });
const WALK = [0.3, 0.8, 0.0, 0.5];
const TROT = [0.5, 0.02, 0.0, 0.5];
const GALLOP = [0.46, 0.58, 0.0, 0.12];
const HALFB = [0.6, 0.48, 0.0, 0.06];
const BOUND = [0.5, 0.52, 0.0, 0.02];

export const motion = {
  maxSpeed: 3.0,
  accel: [7, 12],
  decel: 6,
  turnRate: 5,
  latAccelMax: 6,
  gears: { walk: 0.3, trot: 0.95, gallop: 1.25, halfbound: 1.45, bound: 1.75 },
  gallopBlend: [1.1, 1.8],
  flexBlend: [1.0, 1.7],
  hooks,
  gaits: [
    G('walk', 0.0, 1.6, 0.74, WALK, { liftF: 0.006, liftH: 0.007, bobF: 0.0012, bobH: 0.0015, flex: 0.0, lat: 0.07, fold: 0.5, heel: 25, tail: 0, drop: 0 }),
    G('walk', 0.3, 2.5, 0.64, WALK, { liftF: 0.007, liftH: 0.008, bobF: 0.0015, bobH: 0.002, flex: 0.0, lat: 0.08, fold: 0.55, heel: 35, tail: 0.1, drop: 0 }),
    G('walk', 0.7, 4.0, 0.52, WALK, { liftF: 0.008, liftH: 0.009, bobF: 0.002, bobH: 0.0025, flex: 0.02, lat: 0.06, fold: 0.6, heel: 45, tail: 0.2, drop: 0.001 }),
    G('trot', 0.9, 4.5, 0.43, TROT, { liftF: 0.009, liftH: 0.01, bobF: 0.0025, bobH: 0.003, flex: 0.03, lat: 0.03, fold: 0.7, heel: 55, tail: 0.3, drop: 0.002 }),
    G('trot', 1.05, 4.6, 0.43, TROT, { liftF: 0.009, liftH: 0.01, bobF: 0.0025, bobH: 0.003, flex: 0.04, lat: 0.03, fold: 0.7, heel: 55, tail: 0.3, drop: 0.002 }),
    G('gallop', 1.15, 5.0, 0.4, GALLOP, { liftF: 0.011, liftH: 0.012, bobF: 0.003, bobH: 0.004, flex: 0.14, lat: 0, fold: 0.8, heel: 60, tail: 0.5, drop: 0.003 }),
    G('gallop', 1.3, 5.2, 0.39, GALLOP, { liftF: 0.011, liftH: 0.012, bobF: 0.003, bobH: 0.004, flex: 0.16, lat: 0, fold: 0.8, heel: 60, tail: 0.5, drop: 0.003 }),
    G('halfbound', 1.4, 5.6, 0.38, HALFB, { liftF: 0.012, liftH: 0.013, bobF: 0.0035, bobH: 0.0045, flex: 0.2, lat: 0, fold: 0.85, heel: 62, tail: 0.6, drop: 0.003 }),
    G('halfbound', 1.6, 5.65, 0.36, HALFB, { liftF: 0.012, liftH: 0.013, bobF: 0.0035, bobH: 0.0045, flex: 0.22, lat: 0, fold: 0.85, heel: 62, tail: 0.6, drop: 0.003 }),
    G('bound', 1.75, 5.7, 0.34, BOUND, { liftF: 0.013, liftH: 0.014, bobF: 0.004, bobH: 0.005, flex: 0.25, lat: 0, fold: 0.72, heel: 64, tail: 0.7, drop: 0.004 }),
    G('bound', 3.0, 6.2, 0.28, BOUND, { liftF: 0.014, liftH: 0.015, bobF: 0.0045, bobH: 0.0055, flex: 0.28, lat: 0, fold: 0.75, heel: 66, tail: 0.8, drop: 0.004 }),
  ],
  feet: {
    // plantigrade: the palm and the whole hind sole flat in stance, the heel lifting first
    front: { type: 'plantigrade', curl: 20, heelStrike: 0, flex: 6, couple: 0.6, toeOut: 0.12, elbowDown: 0, retract: 0.5, liftBehind: 0.4 },
    hind: { type: 'plantigrade', curl: 35, heelStrike: 0, lead: 0.35, toeOut: 0.22, retract: 0.35, liftBehind: 0.3 },
  },
  stance: { width: 1, gallopWidth: 0.85, sprawl: 0, crouch: 0, scuff: [2, 3, 0] },
  body: {
    // sections of the bind mesh at the girdles, fur included (measured on the bind mesh: chest bottom
    // ~25 mm, belly ~22 mm (the sections reach a little lower, to 19-22 mm: with the measured 23 mm a
    // curled sleeping rat pushed a forearm into the ground), the rump over the tail root ~21 mm above the ground; the back
    // (long and low) ~91 mm over the withers, ~96 mm over the loins, ~85 mm over the tail root)
    chest: { y: 0.0565, hh: 0.0345, hw: 0.033 },
    pelvis: { y: 0.059, hh: 0.037, hw: 0.047 },
    mid: { y: 0.0575, hh: 0.0385, hw: 0.048 },
    rump: { z: -0.08, y: 0.0545, hh: 0.038, hw: 0.029 },
    back: 0.024,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: nose low, sniffing the ground
    carriage: [[0, -0.002, 0.002, 0.18], [0.3, -0.004, 0.004, 0.2], [1.0, -0.004, 0.006, 0.12], [2, -0.004, 0.008, 0.08]],
    stab: [[0, 0], [0.3, 0.15], [1, 0.25], [2, 0.35]],
    neckBend: 35, neckPivot: 0.5, yaw: 0.9, pitchUp: 0.6, pitchDown: 0.6,
  },
  tail: {
    // slopes down from the rump and trails along the ground at rest; carried straight out behind,
    // just off the ground, when running
    carriage: [
      [0.0, [-38, -30, -20, -12, -6, -3, -1, 0, 0, 0, 0, 0]],
      [0.5, [-30, -22, -14, -8, -4, -2, 0, 0, 0, 0, 0, 0]],
      [1.3, [-18, -10, -5, -2, 0, 0, 1, 1, 1, 1, 1, 1]],
      [3.0, [-12, -5, -1, 1, 2, 2, 2, 2, 2, 2, 2, 2]],
    ],
    stiffness: 1.1, sway: 6, flick: 0, wag: 0, swish: 0, curl: 0, balance: 0.4,
    radius: [0.0065, 0.0014],
  },
  ears: { mobility: 0.5, speedFlatten: 0.5, flattenSpeeds: [1.2, 3], twitch: 1.2, prick: 0.3 },
  breath: { rate: 1.4, amp: 0.02, pant: false, heatSpeed: 3 },
  actions: {
    attack: { style: 'bite-lunge' },
    eat: { style: 'graze', dropF: 0.1, dropH: 0.0 },
    drink: { dropF: 0.12, dropH: 0.0 },
    jump: { height: 0.25, distance: 0.45 },
    idle: { shift: 0.5 },
    sit: {},
    lie: {},
    sleep: { style: 'curl' },
  },
};
