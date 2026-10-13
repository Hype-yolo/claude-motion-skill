// Goat motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, a 0.78 m Saanen doe); the engine
// scales them by dynamic similarity for kids, pygmies and big bucks.
//
// Gaits: lateral-sequence 4-beat walk (duty 0.72 -> 0.62), 2-beat
// diagonal trot (hind lands ~2 % before its diagonal fore, duty 0.45 -> 0.36) and the transverse
// gallop (LH, RH, LF, RF). Crossovers sit at the predicted transitions: walk -> trot at Froude
// ~0.45 (1.85 m/s for a 0.78 m goat), trot -> gallop 4.2 m/s at ~2.5 Hz (Heglund et al. 1974:
// v = 1.535 M^0.24, f = 4.48 M^-0.14 for 65 kg).
import { hooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  maxSpeed: 8.5,
  accel: [3.5, 7],
  decel: 7,
  turnRate: 1.7, // agile: pivots on the hind legs
  latAccelMax: 4.5,
  gears: { walk: 1.0, trot: 2.7, gallop: 5.6 },
  gallopBlend: [3.8, 6.5],
  //    name      v     f     D     [FL,   FR,   HL,  HR]
  gaits: [
    G('walk', 0.0, 0.85, 0.72, [0.25, 0.75, 0.0, 0.5], { liftF: 0.045, liftH: 0.04, bobF: 0.012, bobH: 0.012, flex: 0, lat: 0.02, fold: 0.7, heel: 30, tail: 0, drop: 0 }),
    G('walk', 1.5, 1.35, 0.62, [0.25, 0.75, 0.0, 0.5], { liftF: 0.055, liftH: 0.048, bobF: 0.025, bobH: 0.025, flex: 0, lat: 0.025, fold: 0.85, heel: 40, tail: 0.1, drop: 0 }),
    G('trot', 2.2, 2.05, 0.45, [0.52, 0.02, 0.0, 0.5], { liftF: 0.08, liftH: 0.065, bobF: 0.028, bobH: 0.028, flex: 0.01, lat: 0.0, fold: 1.05, heel: 50, tail: 0.3, drop: 0.006 }),
    G('trot', 3.4, 2.4, 0.37, [0.52, 0.02, 0.0, 0.5], { liftF: 0.095, liftH: 0.08, bobF: 0.032, bobH: 0.032, flex: 0.015, lat: 0.0, fold: 1.15, heel: 55, tail: 0.4, drop: 0.01 }),
    G('gallop', 4.8, 2.7, 0.3, [0.55, 0.65, 0.0, 0.1], { liftF: 0.11, liftH: 0.1, bobF: 0.022, bobH: 0.03, flex: 0.1, lat: 0, fold: 1.15, heel: 45, tail: 0.7, drop: 0.02 }),
    G('gallop', 8.5, 3.0, 0.23, [0.56, 0.66, 0.0, 0.1], { liftF: 0.13, liftH: 0.12, bobF: 0.024, bobH: 0.034, flex: 0.14, lat: 0, fold: 1.4, heel: 40, tail: 1.0, drop: 0.035 }),
  ],
  feet: {
    // cloven hooves: the fetlock sinks a little under load, the digit flips in swing, breakover
    // about the claw tips; pointed hard claws plant precisely (contact near the toe)
    front: { type: 'unguligrade', contact: 0.9, curl: 70, flex: 4, sink: 14, hoofFlex: 20, swingBack: 0.07 },
    hind: { type: 'unguligrade', contact: 0.9, curl: 70, flex: 4, sink: 12, hoofFlex: 20, swingBack: 0.02 },
  },
  stance: { width: 1, gallopWidth: 0.8, sprawl: 0, crouch: 0, scuff: [10, 20, 0] },
  // torso cross-sections (bind pose, reference size): centre height, half height, half width
  // (half heights include the legs folded under the chest and thighs when lying down)
  body: {
    // (0.28 with the pelvis's 0.36: the body lies level on its folded legs; the chest at 0.25 under the higher rump
    // pitched forward onto the folded forelegs, a Boer buck's forearm 5 cm in the ground asleep)
    chest: { y: 0.56, hh: 0.28, hw: 0.15 },
    mid: { y: 0.55, hh: 0.23, hw: 0.17 },
    // (the hindquarters rest on the folded hind legs: lying at 0.3 the stifles folded in against the belly and the skin
    // between the thigh and the flank crumpled into a pocket in front of the stifle, a light torn knob from the side)
    pelvis: { y: 0.63, hh: 0.36, hw: 0.16 },
    back: 0.06,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: head high and alert at rest, a
    // little lower and forward at the walk, stretched forward in the gallop
    carriage: [[0, 0.03, -0.015, -0.05], [1.0, 0.0, 0.01, 0.02], [2.7, -0.01, 0.03, 0.02], [5, -0.06, 0.06, 0.1], [8, -0.1, 0.09, 0.14]],
    stab: [[0, 0], [1.0, 0.15], [2.7, 0.45], [5, 0.35], [8, 0.4]],
    neckBend: 34, neckPivot: 0.55, yaw: 0.9, pitchUp: 0.7, pitchDown: 0.9, mouth: 'jawTip',
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), base -> tip]: carried up, higher when running
    carriage: [
      [0.0, [28, 42, 55, 62, 66]],
      [1.5, [30, 45, 58, 64, 68]],
      [3.5, [36, 52, 64, 70, 72]],
      [7, [42, 58, 70, 74, 76]],
    ],
    stiffness: 1.2, sway: 4, flick: 1, wag: 0, swish: 0, curl: 0, balance: 0,
    radius: [0.03, 0.02],
  },
  ears: { rest: [0, 0], mobility: 1.3, speedFlatten: 0.3, twitch: 1.6, prick: 0.5 },
  breath: { rate: 0.32, amp: 0.006, pant: false, pantRate: 2, pantAmp: 0.015, heatSpeed: 6 },
  actions: {
    // grazing: the long face already hangs 60 deg nose-down in the bind pose
    // (the face nearly vertical, 77 deg nose-down: at 1.1 rad the head was cocked back against the lowered neck, the
    // poll extended 120 deg from its standing angle and the nape's skin folded to 0.65 of its length, its hair standing
    // apart in a frayed band; the throat stretched more too: > 3x 1.37 -> 0.98 % of the kid's mesh in eat and drink)
    eat: { style: 'graze', dropF: 0.1, dropH: 0, pitch: 1.35, ahead: 0.5 },
    drink: { dropF: 0.1, dropH: 0, pitch: 1.3, ahead: 0.5 },
    // sure-footed: a high standing jump, landing on four feet close together (opts.target lands
    // exactly there)
    jump: { height: 0.75, distance: 1.3, land: [0.16, 0.14] },
    sit: { dropH: 0.8 },
    // kneels on the carpi first, then drops the hindquarters; rises hind end first
    lie: { down: 'front', up: 'hind' },
    sleep: { down: 'front', up: 'hind' },
    // lying sternal: forelegs folded under the chest (carpus flexed, cannons back along the ground)
    fold: { front: { z: -0.2, k: 1.45, beta: 0.9 } },
  },
  hooks,
  // the long lop ears of Nubians and Boers hang and swing with the head; they barely prick or twist
  // (the engine swivels a pinna about its own long axis toward what the goat looks at: a hanging ear
  // twisted 25 deg about its root)
  variants: {
    nubian: { ears: { mobility: 0.5, speedFlatten: 0.15, twitch: 0.4, prick: 0.06 } },
    boer: { ears: { mobility: 0.5, speedFlatten: 0.15, twitch: 0.4, prick: 0.06 } },
  },
};
