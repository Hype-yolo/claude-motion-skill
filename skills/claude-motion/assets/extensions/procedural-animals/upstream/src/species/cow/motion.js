// Cow motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, a 1.45 m Holstein cow); the engine
// scales them by dynamic similarity for calves, Jerseys and bulls.
//
// Gaits: lateral-sequence 4-beat walk (preferred ~1.2 m/s, stride
// ~0.8 Hz, duty 0.66), a short 2-beat trot (to feed, 2-3.5 m/s), and a clumsy canter / transverse
// gallop (right lead) up to ~11 m/s that cattle rarely use. Walk -> trot at Froude ~0.4 (~1.8 m/s).
import { behaviour } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  maxSpeed: 11,
  accel: [2.2, 4],
  decel: 5,
  turnRate: 1.3,
  latAccelMax: 5,
  gears: { walk: 1.2, trot: 2.6, canter: 4.6, gallop: 8 },
  gallopBlend: [4.2, 8],
  //    name      v     f     D     [FL,   FR,   HL,  HR]
  gaits: [
    G('walk', 0.0, 0.72, 0.7, [0.25, 0.75, 0.0, 0.5], { liftF: 0.07, liftH: 0.06, bobF: 0.025, bobH: 0.03, flex: 0, lat: 0.03, fold: 0.6, heel: 28, tail: 0, drop: 0 }),
    G('walk', 1.5, 0.9, 0.64, [0.25, 0.75, 0.0, 0.5], { liftF: 0.09, liftH: 0.08, bobF: 0.045, bobH: 0.05, flex: 0, lat: 0.04, fold: 0.72, heel: 36, tail: 0.1, drop: 0 }),
    G('trot', 2.0, 1.35, 0.5, [0.52, 0.02, 0.0, 0.5], { liftF: 0.12, liftH: 0.1, bobF: 0.06, bobH: 0.06, flex: 0.01, lat: 0.0, fold: 0.95, heel: 45, tail: 0.3, drop: 0.015 }),
    G('trot', 3.3, 1.55, 0.43, [0.52, 0.02, 0.0, 0.5], { liftF: 0.15, liftH: 0.12, bobF: 0.07, bobH: 0.07, flex: 0.015, lat: 0.0, fold: 1.05, heel: 50, tail: 0.4, drop: 0.02 }),
    G('canter', 4.0, 1.7, 0.42, [0.3, 0.55, 0.0, 0.27], { liftF: 0.17, liftH: 0.14, bobF: 0.04, bobH: 0.055, flex: 0.05, lat: 0, fold: 1.1, heel: 50, tail: 0.55, drop: 0.03 }),
    G('canter', 5.6, 1.8, 0.37, [0.3, 0.55, 0.0, 0.25], { liftF: 0.19, liftH: 0.16, bobF: 0.045, bobH: 0.06, flex: 0.065, lat: 0, fold: 1.15, heel: 45, tail: 0.65, drop: 0.035 }),
    G('gallop', 7.0, 1.95, 0.31, [0.38, 0.52, 0.0, 0.12], { liftF: 0.21, liftH: 0.18, bobF: 0.05, bobH: 0.065, flex: 0.09, lat: 0, fold: 1.25, heel: 40, tail: 0.8, drop: 0.05 }),
    G('gallop', 11, 2.15, 0.25, [0.4, 0.52, 0.0, 0.13], { liftF: 0.23, liftH: 0.2, bobF: 0.05, bobH: 0.07, flex: 0.11, lat: 0, fold: 1.3, heel: 40, tail: 1.0, drop: 0.07 }),
  ],
  feet: {
    // cloven hooves on short pasterns: the fetlock sinks a little under load, the claws flip in swing
    front: { type: 'unguligrade', contact: 0.9, curl: 65, flex: 4, sink: 14, hoofFlex: 20, swingBack: 0.16 },
    hind: { type: 'unguligrade', contact: 0.9, curl: 65, flex: 4, sink: 12, hoofFlex: 20, swingBack: 0.04 },
  },
  stance: { width: 1, gallopWidth: 0.85, sprawl: 0, crouch: 0, scuff: [14, 24, 0] },
  // torso cross-sections (bind pose, reference size): centre height, half height, half width
  body: {
    chest: { y: 1.03, hh: 0.42, hw: 0.42 },
    mid: { y: 1.0, hh: 0.4, hw: 0.37 },
    pelvis: { y: 1.14, hh: 0.5, hw: 0.4 },
    back: 0.12,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: low and forward at the walk
    // (nodding, see the hook), a little higher at the trot, up and stretched in the gallop
    carriage: [[0, 0, 0, 0], [1.2, -0.05, 0.06, 0.04], [2.6, -0.02, 0.05, 0.0], [4.6, 0.02, 0.08, -0.05], [9, -0.04, 0.14, 0.0]],
    stab: [[0, 0], [1.2, 0.1], [2.6, 0.4], [4.6, 0.3], [9, 0.3]],
    neckBend: 34, neckPivot: 0.55, yaw: 0.7, pitchUp: 0.55, pitchDown: 0.9, mouth: 'jawTip',
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), tail head -> switch]: hangs straight down at
    // rest, lifts and streams out behind when running
    carriage: [
      [0.0, [-38, -68, -80, -85, -87, -88, -89, -89, -90, -90, -90, -90]],
      [1.2, [-34, -64, -78, -84, -86, -87, -88, -89, -89, -90, -90, -90]],
      [2.6, [-32, -48, -62, -71, -76, -80, -83, -85, -86, -87, -88, -88]],
      [4.6, [-30, -30, -42, -52, -58, -62, -66, -69, -72, -74, -76, -78]],
      [9, [-24, -10, -16, -24, -30, -34, -37, -40, -42, -44, -46, -48]],
    ],
    stiffness: 0.75, sway: 6, flick: 0, wag: 0, swish: 1, curl: 0, balance: 0,
    radius: [0.05, 0.05], // (bony tail, then the switch)
  },
  ears: { rest: [0, 0], mobility: 1.1, speedFlatten: 0.2, twitch: 1.3, prick: 0.4 },
  breath: { rate: 0.3, amp: 0.009, pant: false, pantRate: 1.4, pantAmp: 0.02, heatSpeed: 9 },
  actions: {
    // grazing / drinking: the long head hangs near vertical, the tongue wraps the grass (hook)
    eat: { style: 'graze', dropF: 0.05, dropH: 0, pitch: 1.0, ahead: 0.62 },
    drink: { dropF: 0.06, dropH: 0, pitch: 0.95, ahead: 0.62 },
    // cattle jump reluctantly: a low, heavy hop, landing on the forelegs
    jump: { height: 0.55, distance: 2.2, land: [0.22, 0.18] },
    sit: { dropH: 0.8 },
    // kneels on both front knees first, then lowers the hindquarters; rises hind end first
    lie: { down: 'front', up: 'hind' },
    sleep: { style: 'curl', down: 'front', up: 'hind' },
    // lying sternal: forelegs folded under the chest (carpus flexed, cannons back along the ground)
    fold: { front: { z: -0.24, k: 1.5, beta: 0.9 } },
    idle: { shift: 0.8 },
  },
  hooks: behaviour,
};
