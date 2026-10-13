// Red fox motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, withers 0.40 m, ~6 kg); the engine scales
// them by dynamic similarity for kits and big dog foxes.
//
// Gaits (Elbroch 2003, Heglund & Taylor 1988, Alexander & Jayes 1983): the trot
// is the fox's travelling gait. Lateral-sequence walk (0.4-1.0 m/s, 1.2-1.8 Hz, duty 0.60-0.70) used
// when hunting and investigating; trot (1.0-3.0 m/s, typically ~2 m/s, 2.4-3.2 Hz, duty 0.38-0.48,
// hind of each diagonal ~3 % first) in a near single-file line (trail straddle ~7.5 cm: `width`
// narrows the stance per row); transverse lope (3-6 m/s, right lead, 3.0-3.5 Hz); rotary gallop
// (LH-RH-RF-LF, 3.5-4.2 Hz, duty 0.20-0.28) with strong spinal flexion up to ~13 m/s (48 km/h).
// Trot -> gallop 1.53 M^0.24 = 2.4 m/s by scaling; foxes hold the trot to ~3 m/s.
import { foxHooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  // fox behaviour: mousing pounce, listening (ear swivels, head tilt), tail as a counterweight,
  // curled sleep with the brush over the nose, the upright sit with the tail round the forefeet
  hooks: foxHooks,
  maxSpeed: 13,
  accel: [5, 9],
  decel: 9,
  turnRate: 2.8,
  latAccelMax: 11,
  gears: { walk: 0.8, trot: 2.0, canter: 3.6, gallop: 8 },
  gallopBlend: [3.4, 6.5],
  gaits: [
    G('walk', 0.0, 1.1, 0.72, [0.25, 0.75, 0.0, 0.5], { liftF: 0.032, liftH: 0.027, bobF: 0.003, bobH: 0.003, flex: 0.0, lat: 0.05, fold: 1.0, heel: 35, tail: 0, drop: 0.0, width: 0.85 }),
    G('walk', 0.85, 1.55, 0.63, [0.25, 0.75, 0.0, 0.5], { liftF: 0.04, liftH: 0.032, bobF: 0.005, bobH: 0.005, flex: 0.0, lat: 0.05, fold: 1.2, heel: 42, tail: 0.12, drop: 0.0, width: 0.7 }),
    G('trot', 1.2, 2.45, 0.47, [0.53, 0.03, 0.0, 0.5], { liftF: 0.053, liftH: 0.045, bobF: 0.009, bobH: 0.009, flex: 0.02, lat: 0.015, fold: 1.45, heel: 50, tail: 0.3, drop: 0.003, width: 0.5 }),
    G('trot', 2.8, 2.95, 0.39, [0.53, 0.03, 0.0, 0.5], { liftF: 0.064, liftH: 0.054, bobF: 0.012, bobH: 0.012, flex: 0.03, lat: 0.01, fold: 1.6, heel: 58, tail: 0.4, drop: 0.006, width: 0.48 }),
    G('canter', 3.6, 3.1, 0.35, [0.3, 0.45, 0.0, 0.3], { liftF: 0.085, liftH: 0.075, bobF: 0.012, bobH: 0.018, flex: 0.2, lat: 0, fold: 1.8, heel: 62, tail: 0.6, drop: 0.01, width: 0.75 }),
    G('gallop', 6, 3.55, 0.27, [0.52, 0.42, 0.0, 0.1], { liftF: 0.105, liftH: 0.095, bobF: 0.016, bobH: 0.024, flex: 0.34, lat: 0, fold: 1.9, heel: 68, tail: 0.8, drop: 0.016, width: 1 }),
    G('gallop', 12, 4.1, 0.21, [0.52, 0.42, 0.0, 0.1], { liftF: 0.125, liftH: 0.115, bobF: 0.016, bobH: 0.026, flex: 0.44, lat: 0, fold: 2.0, heel: 72, tail: 0.9, drop: 0.026, width: 1 }),
  ],
  feet: {
    front: { type: 'digitigrade', curl: 55 },
    hind: { type: 'digitigrade', curl: 65 },
  },
  stance: { width: 1, gallopWidth: 0.6, sprawl: 0, crouch: 0, scuff: [11, 18, 0] },
  // torso cross-sections (bind, reference size): centre height, half height, half width (incl. coat)
  body: {
    chest: { y: 0.305, hh: 0.112, hw: 0.068 },
    pelvis: { y: 0.31, hh: 0.11, hw: 0.076 }, // incl. the folded thighs a lying fox rests on
    back: 0.036,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: standing, the head is held up at or
    // above the withers, muzzle near level; the trot lowers it toward the back line with the muzzle
    // pointing down and ahead; the gallop stretches it forward
    carriage: [[0, 0.09, -0.02, -0.02], [0.8, -0.008, 0.01, 0.16], [2.0, -0.045, 0.026, 0.3], [4.2, -0.04, 0.032, 0.25], [8, -0.037, 0.043, 0.18]],
    stab: [[0, 0], [0.7, 0.22], [1.5, 0.3], [4, 0.34], [8, 0.6]],
    neckBend: 42, neckPivot: 0.6, yaw: 1.3, pitchUp: 0.6, pitchDown: 0.75,
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), base -> tip]: at rest a shallow downward curve
    // with the tip just off the ground; held level with a slight droop in the trot (the brush floats
    // behind, never curled over the back); straight out behind as a counterweight in the gallop
    carriage: [
      [0.0, [-24, -32, -38, -41, -43, -43, -42, -40, -37, -33]],
      [0.8, [-14, -20, -24, -27, -28, -28, -27, -25, -22, -19]],
      [2.0, [-8, -10, -12, -13, -13, -12, -11, -9, -7, -5]],
      [4.2, [-5, -7, -7, -7, -6, -5, -4, -3, -2, -1]],
      [8, [-3, -4, -4, -3, -2, -1, 0, 1, 1, 2]],
    ],
    stiffness: 0.85, sway: 6, flick: 0, wag: 0, swish: 0, curl: 0,
    balance: 0.65, // the brush is a counterweight and rudder in turns and speed changes
    radius: [0.05, 0.052], // (the brush: coat included)
  },
  ears: { rest: [0, 0], mobility: 1.2, speedFlatten: 0.5, twitch: 1.2, prick: 0.5 },
  breath: { rate: 0.35, amp: 0.012, pant: true, pantRate: 4.0, pantAmp: 0.05, heatSpeed: 5 },
  actions: {
    attack: { style: 'pounce' }, // (the mousing pounce is a species action, behaviour.js)
    eat: { style: 'tear', dropF: 0.3, dropH: 0.1, ahead: 0.75 },
    drink: { dropF: 0.34, dropH: 0.12, ahead: 0.75 },
    jump: { height: 0.6, distance: 2.0 },
    sit: { dropH: 0.9 },
    lie: {},
    sleep: { style: 'curl' },
  },
};
