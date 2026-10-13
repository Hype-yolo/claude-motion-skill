// Frog motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1: bullfrog SVL 140 mm, hind limb ~250 mm
// fully extended); the engine scales them by dynamic similarity for males, juveniles and the smaller
// common frog.
//
// Gaits: a slow crawl-walk for short repositioning moves (diagonal couplets:
// LH with RF, RH with LF) and the hop, the main gait: both hind feet push off together (HL = HR), the
// body flies low, the forefeet catch it one just after the other, then the hind feet swing forward
// and land folded beside the body. Hop speed rises with hop frequency and length. Long jumps, single
// hops, turns on the spot and the frog behaviours are actions in behaviour.js.
// Offsets [FL, FR, HL, HR] relative to hind touchdown.
import { hooks } from './behaviour.js';
import { SPRAWL } from './rig.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  maxSpeed: 1.6,
  stride: { gallop: 0 }, // (a hopper's bound is not a gallop: no gallop forequarter drop or reach)
  accel: [2.5, 4],
  decel: 5,
  turnRate: 2.2,
  latAccelMax: 5,
  gears: { crawl: 0.06, hop: 0.6 },
  gallopBlend: [0.4, 1.2],
  flexBlend: [0.2, 0.8],
  reachDuty: 1,
  hooks,
  gaits: [
    G('crawl', 0.0, 0.8, 0.8, [0.55, 0.05, 0.0, 0.5], { liftF: 0.008, liftH: 0.01, bobF: 0.001, bobH: 0.0015, flex: 0.02, lat: 0.04, fold: 0.15, heel: 12, tail: 0, drop: 0 }),
    G('crawl', 0.12, 1.2, 0.72, [0.55, 0.05, 0.0, 0.5], { liftF: 0.01, liftH: 0.012, bobF: 0.0015, bobH: 0.002, flex: 0.03, lat: 0.05, fold: 0.15, heel: 16, tail: 0, drop: 0 }),
    G('hop', 0.3, 1.4, 0.34, [0.5, 0.53, 0.0, 0.0], { liftF: 0.012, liftH: 0.02, bobF: 0.01, bobH: 0.012, flex: 0.08, lat: 0, fold: 0.2, heel: 30, tail: 0, drop: -0.004 }),
    G('hop', 0.8, 1.8, 0.28, [0.48, 0.51, 0.0, 0.0], { liftF: 0.016, liftH: 0.026, bobF: 0.016, bobH: 0.018, flex: 0.12, lat: 0, fold: 0.2, heel: 40, tail: 0, drop: -0.006 }),
    G('hop', 1.6, 2.1, 0.22, [0.46, 0.49, 0.0, 0.0], { liftF: 0.02, liftH: 0.03, bobF: 0.02, bobH: 0.022, flex: 0.14, lat: 0, fold: 0.2, heel: 45, tail: 0, drop: -0.008 }),
  ],
  feet: {
    // flat hands, fingers forward and in
    front: { type: 'plantigrade', contact: 0.45, curl: 12, flex: 4, heelStrike: 0, toeOut: 0, lead: 0.3, liftBehind: 0.5, retract: 0.4 },
    // the long foot flat on the ground; the tarsus laid flat at rest and in postures (plantRest), the
    // heel rising in motion; toes fanned out in the sculpt
    hind: { type: 'plantigrade', zfold: true, swingFlat: 0.7, contact: 0.35, curl: 20, flex: 0, heelStrike: 0, toeOut: 0, lead: 0.25, liftBehind: 0.38, retract: 0.4 },
  },
  stance: { width: 1, gallopWidth: 1, sprawl: SPRAWL, crouch: 0, scuff: [10, 20, 0] },
  body: {
    // sections of the sitting bind sculpt (the half width includes the folded thighs)
    chest: { y: 0.04, hh: 0.025, hw: 0.03 },
    pelvis: { y: 0.03, hh: 0.023, hw: 0.048 },
    mid: { y: 0.032, hh: 0.024, hw: 0.039 },
    rump: { z: -0.05, y: 0.026, hh: 0.016, hw: 0.032 },
    back: 0.02,
  },
  head: {
    // no neck: the head moves only a few degrees relative to the trunk
    carriage: [[0, 0, 0, 0], [0.5, -0.002, 0.002, 0.04], [1.6, -0.004, 0.004, 0.08]],
    stab: [[0, 0], [0.5, 0.05], [1.6, 0.1]],
    neckBend: 10, neckPivot: 0.5, yaw: 0.14, pitchUp: 0.12, pitchDown: 0.15,
  },
  tail: { radius: [0.01, 0.01] },
  breath: { rate: 0.22, amp: 0.018, pant: false, heatSpeed: 99 },
  actions: {
    attack: { style: 'bite-lunge' },
    eat: { style: 'tear' },
    jump: { height: 0.35, distance: 1.1 },
    idle: { shift: 0.12, restep: false },
    sit: {},
    lie: {},
    sleep: { style: 'curl' },
  },
};
