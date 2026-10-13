// White-tailed deer motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, 0.92 m at the withers); the engine
// scales them by dynamic similarity for fawns and big bucks.
//
// Gaits: lateral-sequence walk (hind foot into the fore track),
// a brief diagonal trot with high knee action when wary, the transverse gallop, and the bounding
// gallop of the escape (long suspension, forefeet landing almost together, hind feet planted ahead
// of the fore tracks, tail flagged). Walk -> trot ~1.6 m/s (Froude ~0.4), trot -> gallop ~4.3 m/s,
// gallop -> bound ~9 m/s; top speed 13.5 m/s (48 km/h).
import { hooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  maxSpeed: 13.5,
  accel: [4.5, 6.5],
  decel: 8,
  // turns: a walking deer comes round over 2-3 steps on a path of one to two body lengths (~1.2 rad/s
  // at 1.2 m/s); at speed the cornering limit (~0.5 g) keeps the lean of a sharp escape turn near
  // 23 deg (0.85 atan(a / g)) instead of the 34 deg clamp (a long-legged body rolled like a motorbike)
  turnRate: 1.5,
  latAccelMax: 5,
  gears: { walk: 1.1, trot: 2.9, gallop: 7, bound: 11.5 },
  gallopBlend: [3.8, 7.5],
  //    name      v     f     D     [FL,   FR,   HL,  HR]
  gaits: [
    G('walk', 0.0, 0.85, 0.72, [0.25, 0.75, 0.0, 0.5], { liftF: 0.06, liftH: 0.05, bobF: 0.015, bobH: 0.015, flex: 0, lat: 0.02, fold: 0.7, heel: 30, tail: 0, drop: 0 }),
    G('walk', 1.5, 1.15, 0.62, [0.25, 0.75, 0.0, 0.5], { liftF: 0.085, liftH: 0.065, bobF: 0.03, bobH: 0.03, flex: 0, lat: 0.025, fold: 0.9, heel: 40, tail: 0.1, drop: 0.02 }),
    G('trot', 2.1, 1.85, 0.45, [0.51, 0.01, 0.0, 0.5], { liftF: 0.12, liftH: 0.09, bobF: 0.03, bobH: 0.03, flex: 0.01, lat: 0.0, fold: 1.2, heel: 50, tail: 0.3, drop: 0.03 }),
    G('trot', 3.8, 2.15, 0.41, [0.51, 0.01, 0.0, 0.5], { liftF: 0.14, liftH: 0.11, bobF: 0.035, bobH: 0.035, flex: 0.015, lat: 0.0, fold: 1.3, heel: 55, tail: 0.4, drop: 0.035 }),
    // (the fast gaits run low: the long, near-straight forelegs only sweep through a real stance, fore
    // duty 0.2-0.25 in the gallop and ~0.13 in the bound, when the forequarters ride ~10 % of the
    // withers height lower than they stand; at the standing height a forefoot touched down for one or
    // two frames and the deer floated on its hind legs)
    G('gallop', 4.8, 2.35, 0.3, [0.4, 0.52, 0.0, 0.12], { liftF: 0.14, liftH: 0.12, bobF: 0.015, bobH: 0.04, flex: 0.12, lat: 0, fold: 1.35, heel: 45, tail: 0.6, drop: 0.08 }),
    G('gallop', 8, 2.55, 0.25, [0.4, 0.52, 0.0, 0.12], { liftF: 0.16, liftH: 0.14, bobF: 0.015, bobH: 0.045, flex: 0.17, lat: 0, fold: 1.4, heel: 40, tail: 0.8, drop: 0.1 }),
    // bound: the back gathers and stretches with each leap (bounding.jpg)
    G('bound', 10, 2.5, 0.21, [0.45, 0.5, 0.0, 0.06], { liftF: 0.2, liftH: 0.17, bobF: 0.02, bobH: 0.055, flex: 0.27, lat: 0, fold: 1.45, heel: 40, tail: 1.0, drop: 0.12 }),
    G('bound', 13.5, 2.6, 0.18, [0.45, 0.5, 0.0, 0.06], { liftF: 0.22, liftH: 0.19, bobF: 0.02, bobH: 0.06, flex: 0.3, lat: 0, fold: 1.5, heel: 40, tail: 1.0, drop: 0.13 }),
  ],
  feet: {
    // small cloven hooves: the fetlock gives under load, the digit flips in swing, breakover at the toe
    front: { type: 'unguligrade', contact: 0.95, curl: 75, flex: 4, sink: 16, hoofFlex: 20, swingBack: 0.12 },
    hind: { type: 'unguligrade', contact: 0.95, curl: 75, flex: 4, sink: 10, hoofFlex: 20, swingBack: 0.03 },
  },
  stance: { width: 1, gallopWidth: 0.8, sprawl: 0, crouch: 0, scuff: [10, 20, 0] },
  // torso cross-sections (bind pose, reference size): centre height, half height, half width
  body: {
    // (half heights include the legs folded under the chest and thighs when lying down)
    chest: { y: 0.66, hh: 0.26, hw: 0.19 },
    mid: { y: 0.67, hh: 0.22, hw: 0.18 },
    pelvis: { y: 0.74, hh: 0.3, hw: 0.2 },
    back: 0.08,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: lowered and nodding at the walk, up
    // at the wary trot, stretched forward in the gallop and bound
    carriage: [[0, 0, 0, 0], [1.2, -0.07, 0.04, 0.05], [3, -0.01, 0.02, 0.0], [6, -0.1, 0.08, 0.06], [12, -0.16, 0.12, 0.1]],
    stab: [[0, 0], [1.2, 0.1], [3, 0.4], [6, 0.3], [12, 0.35]],
    neckBend: 45, neckPivot: 0.6, yaw: 0.9, pitchUp: 0.6, pitchDown: 0.9, mouth: 'jawTip',
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), root -> tip]: flat on the rump at rest, lifting
    // with speed (the flag itself is the behaviour layer)
    carriage: [
      [0.0, [-45, -62, -72, -78, -80, -80]],
      [1.5, [-40, -58, -68, -74, -78, -80]],
      [3.5, [-25, -45, -58, -66, -72, -76]],
      [7, [0, -20, -35, -45, -52, -58]],
    ],
    stiffness: 1.1, sway: 4, flick: 0.6, wag: 0, swish: 0.45, curl: 0, balance: 0,
    radius: [0.035, 0.03],
  },
  ears: { rest: [0, 0], mobility: 1.1, speedFlatten: 0.35, flattenSpeeds: [5, 12], twitch: 1.3, prick: 0.55 },
  breath: { rate: 0.28, amp: 0.006, pant: false, pantRate: 1.5, pantAmp: 0.015, heatSpeed: 11 },
  actions: {
    attack: { style: 'headbutt', kick: 'rear' }, // (hooks: buck antler thrust, doe rears and flails)
    // grazing / drinking on straight forelegs (drinking.jpg): the long neck swings down from the
    // chest, the head hangs near vertical (bind 50 deg + 43 deg), the muzzle a little ahead of the
    // forefeet; the forehand stays at its standing height (it dropped 30-36 cm, a play bow, when the
    // neck could not reach)
    eat: { style: 'graze', dropF: 0, dropH: 0, pitch: 0.75, ahead: 0.25 },
    drink: { dropF: 0, dropH: 0, pitch: 0.7, ahead: 0.25 },
    // an everyday obstacle jump: the body rises ~1.1 m, 3.8 m long (play('jump', { height: 2 }) is the
    // record escape leap: clears ~2.4 m, 6.5 m standing, up to ~9 m from a gallop); lands on
    // near-straight forelegs, the hinds swing under
    jump: { height: 1.1, distance: 3.8, land: [0.14, 0.14] },
    // sit: deer do not sit like a dog (only briefly while rising, or hurt): a sit is sternal bedding
    // with the head up and alert (hooks: behaviour.js), lie the same, relaxed
    sit: { down: 'front', up: 'hind' },
    // kneels on both carpi first, then lowers the hindquarters; rises hind end first
    lie: { down: 'front', up: 'hind' },
    sleep: { style: 'curl', down: 'front', up: 'hind' },
    fold: { front: { z: -0.24, k: 1.5, beta: 0.9 } },
  },
  hooks,
};
