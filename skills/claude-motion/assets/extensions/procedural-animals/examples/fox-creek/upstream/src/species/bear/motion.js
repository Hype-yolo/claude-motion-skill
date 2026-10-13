// Brown bear motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, hump ~1.0 m, hip joint 0.72 m); the
// engine scales them by dynamic similarity for cubs and big males.
//
// Gaits (Shine et al. 2015, 2017 on grizzlies): bears AVOID THE TROT. At slow to
// moderate speed they walk (lateral sequence, limb phase 0.2-0.25, mean 1.7 m/s), use a running
// walk / amble (singlefoot, at most two feet down, no suspension, ~2.6 m/s) and a three-beat canter
// (~2.9 m/s, no suspension); above ~4 m/s a rotary gallop with one gathered suspension, the hind
// feet landing close together, big spinal flexion (charges at 11-13 m/s). Stride frequencies
// from speed and Heglund-Taylor scaling, x1.14 for the reference individual's hip height (0.77 m
// against the ~1.0 m of the adults in research 4.1: f ~ 1 / sqrt(leg length)). The walk swaggers: the shoulders and hump roll +-4-6 deg,
// the head swings with the forelegs (behaviour.js), the forefeet swing out and land toes-in.
import { hooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  hooks,
  maxSpeed: 13,
  accel: [3.5, 6],
  decel: 7,
  // a 200 kg plantigrade animal steps round a turn with its back level (research 4.2: slow turns pivot
  // about the forelimbs with small steps): at 1.9 rad/s and 4.5 m/s^2 the torso spun about its middle,
  // the hips swung out at 0.85 m/s and it rolled 12-21 deg into every turn like a cheetah
  turnRate: 1.1,
  // (6 m/s^2, 0.6 g, with the lean into the turn at 0.4 of a runner's: a heavy bear corners on its feet, it
  // does not bank like a cheetah. At 2.5 without a lean scale the sprint turned at 0.20 rad/s, a 60 m radius;
  // at 4 / 0.55 0.32 rad/s at 12.7 m/s, ~40 m; now ~0.47 rad/s, ~27 m,
  // the lean still ~11 deg. research 4.2: charging bears turn and reverse within a few strides)
  latAccelMax: 6,
  bankScale: 0.4,
  gears: { walk: 1.2, amble: 2.4, canter: 3.3, gallop: 8 },
  gallopBlend: [3.6, 7],
  flexBlend: [3.2, 6],
  gaits: [
    // (the swinging forepaw peels off heel first with the palm turned back, flattens as it swings and is
    // carried low, the toes 5-6 cm up: fold -1.0 keeps the palm within ~13 deg of flat at mid swing. The
    // engine places the wrist from the paw: a paw folded to hang below the wrist put the wrist 25-30 cm up,
    // 35 cm under the shoulder, where the 62 cm arm is folded to 56 % of its length, and the forearm swung
    // up to 83 deg from vertical (a prance); now <= 55 deg. The body walks 1.5 cm low,
    // so the planted forefoot stays in reach through the stance)
    G('walk', 0.0, 0.7, 0.76, [0.25, 0.75, 0.0, 0.5], { liftF: 0.045, liftH: 0.065, bobF: 0.006, bobH: 0.008, flex: 0.0, lat: 0.06, fold: -1.0, heel: 30, tail: 0, drop: 0.015, width: 1.0 }),
    G('walk', 0.9, 0.84, 0.7, [0.23, 0.73, 0.0, 0.5], { liftF: 0.05, liftH: 0.075, bobF: 0.01, bobH: 0.012, flex: 0.0, lat: 0.07, fold: -1.0, heel: 38, tail: 0, drop: 0.015, width: 1.0 }),
    G('walk', 1.6, 1.0, 0.63, [0.22, 0.72, 0.0, 0.5], { liftF: 0.055, liftH: 0.085, bobF: 0.014, bobH: 0.016, flex: 0.01, lat: 0.07, fold: -1.0, heel: 45, tail: 0.1, drop: 0.015, width: 0.98 }),
    // running walk / amble: singlefoot, never more than two feet down, no suspension
    G('amble', 2.1, 1.24, 0.52, [0.18, 0.68, 0.0, 0.5], { liftF: 0.05, liftH: 0.095, bobF: 0.016, bobH: 0.018, flex: 0.02, lat: 0.05, fold: -1.0, heel: 52, tail: 0.2, drop: 0.005, width: 0.95 }),
    G('amble', 2.6, 1.35, 0.48, [0.18, 0.68, 0.0, 0.5], { liftF: 0.06, liftH: 0.1, bobF: 0.018, bobH: 0.02, flex: 0.03, lat: 0.045, fold: -0.9, heel: 56, tail: 0.3, drop: 0.008, width: 0.95 }),
    // three-beat canter (right lead): trailing hind, the diagonal pair, leading fore
    G('canter', 3.0, 1.52, 0.44, [0.3, 0.55, 0.0, 0.3], { liftF: 0.07, liftH: 0.12, bobF: 0.022, bobH: 0.03, flex: 0.1, lat: 0, fold: -0.5, heel: 60, tail: 0.4, drop: 0.012, width: 0.95 }),
    G('canter', 3.8, 1.7, 0.4, [0.3, 0.55, 0.0, 0.3], { liftF: 0.08, liftH: 0.13, bobF: 0.026, bobH: 0.034, flex: 0.16, lat: 0, fold: -0.3, heel: 64, tail: 0.5, drop: 0.016, width: 0.95 }),
    // rotary gallop: the hind feet land close together, then the forefeet; one gathered suspension
    // (the back arches and stretches: flex 0.36-0.48, research 4.1 "big spinal flexion"; at 0.26-0.38 the back
    // angle ranged 172-180 deg, a rigid loaf, against the cheetah's 162-180; now 170-180,
    // the back shortening 21 % through the stride. At 0.4-0.55 the rump skin stretched past 3x in the sprint
    // turns: the stretch metric's margin went under 5 %)
    // (the fore pair lands as the hind pair lifts off, so the only flight is the gathered one after the forefeet
    // push off, research 4.1 "single gathered suspension"; at [0.62, 0.5] with duty 0.2-0.26 the gallop and sprint
    // also flew 0.14-0.2 of a stride extended between the pairs)
    G('gallop', 5.0, 1.9, 0.34, [0.56, 0.44, 0.0, 0.1], { liftF: 0.17, liftH: 0.15, bobF: 0.022, bobH: 0.04, flex: 0.36, lat: 0, fold: 1.1, heel: 58, tail: 0.6, drop: 0.05, width: 1 }),
    // (the hips a little lower and steadier at speed, and the sprint's stride a little quicker: the hind foot that lands first
    // after the gathered flight came down under hips at the top of their bob, out of its reach, and its stance was cut to
    // half the other's, duty 0.10 against 0.21 at 13 m/s; now 0.19-0.25 / 0.21-0.27 from 10 to 13 m/s)
    G('gallop', 9.0, 2.3, 0.26, [0.48, 0.36, 0.0, 0.1], { liftF: 0.2, liftH: 0.18, bobF: 0.02, bobH: 0.03, flex: 0.44, lat: 0, fold: 1.2, heel: 60, tail: 0.8, drop: 0.09, width: 1 }),
    G('gallop', 13, 2.85, 0.2, [0.42, 0.3, 0.0, 0.1], { liftF: 0.22, liftH: 0.2, bobF: 0.02, bobH: 0.03, flex: 0.48, lat: 0, fold: 1.3, heel: 62, tail: 0.9, drop: 0.1, width: 1 }),
  ],
  feet: {
    // plantigrade: the palm lands nearly flat (a little toe-up), the hind foot heel first; the
    // forefeet are pigeon-toed (toeOut < 0 turns the toes in)
    // (no swing toe curl: curled toes lifted the palm's back 5 cm and tipped the wrist forward)
    front: { type: 'plantigrade', curl: 0, heelStrike: 3, flex: 6, couple: 1, toeOut: -0.26 },
    hind: { type: 'plantigrade', curl: 30, heelStrike: 5, lead: 0.42 },
  },
  stance: { width: 1, gallopWidth: 0.7, sprawl: 0, crouch: 0, scuff: [11, 18, 0] },
  // torso cross-sections (bind, reference size): centre height, half height, half width (incl. coat)
  body: {
    chest: { y: 0.66, hh: 0.26, hw: 0.28 },
    pelvis: { y: 0.7, hh: 0.28, hw: 0.29 },
    back: 0.11,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: the head hangs at or below the
    // withers at rest and in the walk, nose pointing down-forward; stretched forward in the gallop
    // (side1, side3 / side4_walk, tq4: walking, the ears at 0.6-0.75 of the hump height and the nose at
    // 0.4-0.45, pitched 30-40 deg down; gait1 / gait2: low and forward at the gallop)
    carriage: [[0, -0.08, 0.03, 0.34], [1.0, -0.11, 0.04, 0.46], [2.3, -0.12, 0.05, 0.42], [4.5, -0.1, 0.08, 0.32], [9, -0.1, 0.11, 0.28]],
    stab: [[0, 0], [0.9, 0.2], [1.8, 0.26], [4.5, 0.32], [9, 0.55]],
    neckBend: 34, neckPivot: 0.55, yaw: 1.0, pitchUp: 0.7, pitchDown: 0.7,
  },
  tail: {
    // the stub hangs over the anus; lifts a little at a gallop
    carriage: [[0, [-45, -70]], [4, [-30, -50]], [10, [-15, -30]]],
    stiffness: 1.6, sway: 3, flick: 0, wag: 0, swish: 0, curl: 0, balance: 0,
    radius: [0.06, 0.05],
  },
  ears: { rest: [0, 0], mobility: 0.6, speedFlatten: 0.5, flattenSpeeds: [4, 12], twitch: 0.8, prick: 0.3 },
  breath: { rate: 0.22, amp: 0.01, pant: true, pantRate: 1.6, pantAmp: 0.035, heatSpeed: 5 },
  actions: {
    attack: { style: 'charge' },
    eat: { style: 'graze', dropF: 0.12, dropH: 0.0, ahead: 0.45 },
    drink: { dropF: 0.2, dropH: 0.02, ahead: 0.45 },
    jump: { height: 0.45, distance: 1.8, land: [0.25, 0.2] },
    sit: {},
    lie: { dropF: 0.65 },
    sleep: { style: 'curl', dropF: 0.65 },
    idle: { shift: 1.2 },
    // lying sternal: the forearms forward along the ground with the palms flat (plantigrade), the paws
    // a little ahead of the chest and the elbows at its sides (at 0.42 leg lengths ahead of the shoulder
    // the humerus swung forward level with the ground, a sphinx, and stretched the brisket 3x); the palm
    // tilted 1.0 rad (at 1.15 it dipped 1 cm into the ground as the bear rose from sleep: 0.97 % S)
    fold: { front: { z: 0.2, k: -1.0, beta: 0 } },
  },
};
