// Sheep motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, a 0.70 m, 70 kg ewe); the engine
// scales them by dynamic similarity for lambs and big rams.
//
// Gaits: lateral-sequence 4-beat walk (0.9-1.3 m/s: 0.96-1.25 Hz,
// duty 0.66 -> 0.60, hoof swing height 49 mm fore / 55 mm hind, Kim & Breur 2008, treadmill studies),
// 2-beat diagonal trot (1.8-2.4 Hz, duty 0.45 -> 0.37), a 3-beat canter (right lead) in flock flight
// and the transverse gallop (2.5-3 Hz). Crossovers: walk -> trot at Froude ~0.45 (1.8 m/s for a
// 0.72 m hip height), trot -> canter / gallop 4.3 m/s at ~2.5 Hz (Heglund et al. 1974: v = 1.535
// M^0.24, f = 4.48 M^-0.14 for 70 kg).
import { hooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  maxSpeed: 8.5,
  accel: [3, 6.5],
  decel: 7,
  turnRate: 3.0,
  latAccelMax: 8,
  gears: { walk: 0.95, trot: 2.8, canter: 4.7, gallop: 6.8 },
  gallopBlend: [4.0, 6.5],
  //    name      v     f     D     [FL,   FR,   HL,  HR]
  gaits: [
    G('walk', 0.0, 0.75, 0.7, [0.25, 0.75, 0.0, 0.5], { liftF: 0.042, liftH: 0.046, bobF: 0.01, bobH: 0.01, flex: 0, lat: 0.02, fold: 0.65, heel: 18, tail: 0, drop: 0 }),
    G('walk', 1.5, 1.28, 0.6, [0.27, 0.77, 0.0, 0.5], { liftF: 0.05, liftH: 0.055, bobF: 0.022, bobH: 0.022, flex: 0, lat: 0.025, fold: 0.85, heel: 26, tail: 0.1, drop: 0 }),
    G('trot', 2.05, 1.9, 0.45, [0.52, 0.02, 0.0, 0.5], { liftF: 0.075, liftH: 0.062, bobF: 0.026, bobH: 0.026, flex: 0.01, lat: 0.0, fold: 1.05, heel: 36, tail: 0.12, drop: 0.006 }),
    G('trot', 3.8, 2.3, 0.36, [0.52, 0.02, 0.0, 0.5], { liftF: 0.09, liftH: 0.075, bobF: 0.03, bobH: 0.03, flex: 0.015, lat: 0.0, fold: 1.15, heel: 52, tail: 0.16, drop: 0.01 }),
    G('canter', 4.4, 2.35, 0.35, [0.3, 0.55, 0.0, 0.27], { liftF: 0.1, liftH: 0.085, bobF: 0.024, bobH: 0.032, flex: 0.06, lat: 0, fold: 1.2, heel: 38, tail: 0.20, drop: 0.015 }),
    G('canter', 5.1, 2.45, 0.32, [0.3, 0.55, 0.0, 0.26], { liftF: 0.105, liftH: 0.09, bobF: 0.025, bobH: 0.034, flex: 0.08, lat: 0, fold: 1.25, heel: 48, tail: 0.24, drop: 0.02 }),
    G('gallop', 6.0, 2.6, 0.28, [0.55, 0.65, 0.0, 0.1], { liftF: 0.11, liftH: 0.1, bobF: 0.022, bobH: 0.03, flex: 0.1, lat: 0, fold: 1.3, heel: 45, tail: 0.28, drop: 0.022 }),
    G('gallop', 8.5, 2.85, 0.24, [0.56, 0.66, 0.0, 0.1], { liftF: 0.115, liftH: 0.11, bobF: 0.024, bobH: 0.034, flex: 0.12, lat: 0, fold: 1.25, heel: 40, tail: 0.40, drop: 0.035 }),
  ],
  feet: {
    // cloven hooves on fairly upright pasterns: the fetlock sinks a little under load, the claws flip
    // in swing, breakover about the claw tips
    front: { type: 'unguligrade', contact: 1.0, curl: 62, flex: 4, sink: 6, hoofFlex: 15, swingBack: 0.06, liftBehind: 0.95 },
    hind: { type: 'unguligrade', contact: 0.92, curl: 60, flex: 4, sink: 8, hoofFlex: 15, swingBack: 0.02 },
  },
  stance: { width: 1, gallopWidth: 0.8, sprawl: 0, crouch: 0, scuff: [10, 20, 0] },
  // torso cross-sections of the shorn body (bind pose, reference size): centre height, half height,
  // half width (half heights include the legs folded under the chest and thighs when lying down);
  // behaviour.js adds the fleece of the individual
  body: {
    chest: { y: 0.47, hh: 0.25, hw: 0.165 },
    mid: { y: 0.47, hh: 0.24, hw: 0.18 },
    pelvis: { y: 0.53, hh: 0.3, hw: 0.17 },
    rump: { z: -0.43, y: 0.53, hh: 0.3, hw: 0.14 },
    back: 0.06,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: head up and alert at rest, lower and
    // forward at the walk (following the flock), stretched forward in flight
    carriage: [[0, 0.02, -0.01, -0.04], [0.95, -0.02, 0.01, 0.03], [2.5, -0.02, 0.03, 0.03], [4.2, -0.05, 0.05, 0.08], [8, -0.08, 0.08, 0.12]],
    stab: [[0, 0], [0.95, 0.15], [2.5, 0.45], [4.2, 0.35], [8, 0.4]],
    neckBend: 34, neckPivot: 0.75, yaw: 0.85, pitchUp: 0.65, pitchDown: 0.9, mouth: 'jawTip',
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), base -> tip]: hangs straight down (the docked
    // stump too), lifts a little when running
    carriage: [
      [0.0, [-38, -64, -76, -82, -86, -88]],
      [1.4, [-34, -60, -74, -80, -84, -86]],
      [3.5, [-32, -58, -72, -79, -83, -85]],
      [7, [-28, -52, -66, -74, -78, -80]],
    ],
    stiffness: 0.9, sway: 5, flick: 0.4, wag: 0, swish: 0, curl: 0, balance: 0,
    radius: [0.035, 0.025],
  },
  ears: { rest: [0, 0], mobility: 0.9, speedFlatten: 0.25, twitch: 1.5, prick: 0.25 },
  breath: { rate: 0.3, amp: 0.006, pant: false, pantRate: 2.2, pantAmp: 0.014, heatSpeed: 6 },
  actions: {
    // grazing: muzzle on the sward, the forefeet a little spread
    eat: { style: 'graze', dropF: 0.1, dropH: 0, pitch: 0.9, ahead: 0.6 },
    drink: { dropF: 0.1, dropH: 0, pitch: 0.9, ahead: 0.6 },
    // a low jump with the forelegs tucked (0.5-1 m obstacles)
    jump: { height: 0.6, distance: 1.4, land: [0.16, 0.14] },
    sit: { dropH: 0.8 },
    // kneels on both carpi first, then drops the hindquarters; rises hind end first (ruminant)
    lie: { down: 'front', up: 'hind' },
    sleep: { down: 'front', up: 'hind' },
    // lying sternal: forelegs folded under the chest (carpus flexed, cannons back along the ground)
    fold: { front: { z: -0.2, k: 1.45, beta: 0.9 } },
  },
  hooks,
};
