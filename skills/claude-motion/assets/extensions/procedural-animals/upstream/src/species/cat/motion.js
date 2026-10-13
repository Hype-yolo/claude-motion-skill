// Domestic cat motion data for the quadruped engine (schema: src/core/motion/quadruped.js).
// Numbers are for the reference individual (params.size = 1, withers ~0.245 m); the engine scales them
// by dynamic similarity for kittens and big toms.
//
// Gaits (force-plate and kinematic studies of cats: Goslow 1973, Halbertsma 1983,
// Bishop 2008, Smith 1993, Muybridge 1887): lateral-sequence walk (diagonality ~25 %: LF lands at
// ~0.27 of the stride after LH, not a pace; 0.8-1.5 Hz, duty 0.72 -> 0.58, direct register), trot
// (1.0-2.3 m/s, 2-3 Hz, duty 0.45), half-bound (2.2-4.5 m/s), rotary gallop (LH -> RH -> RF -> LF, 3.3-4 Hz, duty 0.35 -> 0.22,
// two flight phases, big lumbar flexion). Walk -> trot ~1.0 m/s (Froude 0.5), trot -> gallop ~2.2 m/s
// (Heglund: 1.53 M^0.24 for 4 kg). Top speed ~12 m/s.
import { hooks } from './behaviour.js';

const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const motion = {
  hooks,
  maxSpeed: 12,
  accel: [4, 7],
  decel: 10,
  turnRate: 2.4, // (a pivot ~1.3 rad/s: the forequarters walk round; 3.4 spun the body like a compass needle)
  latAccelMax: 4.5, // (~0.46 g: the engine leans the body by 0.85 atan(a / g), so ~21 deg in a fast turn; 7 leaned it 28-30 deg, a motorbike)
  gears: { walk: 0.6, trot: 1.6, bound: 3.2, gallop: 7 },
  gallopBlend: [2.2, 4.5],
  flexBlend: [1.8, 3.2], // (the half-bound flexes its back: [2.2, 4] halved the table's flexion at 3.3 m/s)
  // (walk and trot rows: an extra landing lead, so the forefoot lands as far ahead as the foreleg reaches (the foot's
  // default lead cap, 0.59 leg lengths, landed it 4-5 cm short and cut the fore stance to ~60 % of the hind's); the
  // foot's own cap stays, as it also sets how far the forelegs reach in a jump's flight, where more stretched the
  // armpits)
  gaits: [
    G('walk', 0.0, 1.0, 0.72, [0.27, 0.77, 0.0, 0.5], { liftF: 0.018, liftH: 0.016, bobF: 0.0018, bobH: 0.0018, flex: 0.0, lat: 0.05, fold: 1.1, heel: 58, tail: 0, drop: 0.0, width: 0.8, lead: 0.02 }),
    G('walk', 0.95, 1.75, 0.6, [0.26, 0.76, 0.0, 0.5], { liftF: 0.024, liftH: 0.02, bobF: 0.003, bobH: 0.003, flex: 0.0, lat: 0.05, fold: 1.3, heel: 62, tail: 0.12, drop: 0.0, width: 0.72, lead: 0.02 }),
    // (a cat's trot has no flight phase at ~1.7 m/s: duty ~0.5, falling toward 0.44 at the top of the band)
    G('trot', 1.2, 2.45, 0.53, [0.51, 0.02, 0.0, 0.5], { liftF: 0.032, liftH: 0.028, bobF: 0.006, bobH: 0.006, flex: 0.02, lat: 0.02, fold: 1.5, heel: 60, tail: 0.3, drop: 0.008, width: 0.7, lead: 0.03 }),
    G('trot', 2.1, 3.05, 0.44, [0.51, 0.02, 0.0, 0.5], { liftF: 0.038, liftH: 0.034, bobF: 0.008, bobH: 0.008, flex: 0.03, lat: 0.01, fold: 1.6, heel: 64, tail: 0.4, drop: 0.012, width: 0.7, lead: 0.03 }),
    // half-bound: the hind feet land almost together, the forefeet one after the other
    G('bound', 2.5, 3.2, 0.37, [0.6, 0.48, 0.0, 0.05], { liftF: 0.05, liftH: 0.045, bobF: 0.008, bobH: 0.012, flex: 0.32, lat: 0, fold: 1.8, heel: 64, tail: 0.65, drop: 0.008, width: 0.9 }),
    G('bound', 4.2, 3.45, 0.32, [0.6, 0.48, 0.0, 0.06], { liftF: 0.06, liftH: 0.055, bobF: 0.009, bobH: 0.014, flex: 0.38, lat: 0, fold: 1.9, heel: 68, tail: 0.8, drop: 0.01, width: 0.95 }),
    // rotary gallop (LH -> RH -> RF -> LF), two flight phases
    G('gallop', 5.2, 3.6, 0.29, [0.6, 0.47, 0.0, 0.12], { liftF: 0.07, liftH: 0.064, bobF: 0.01, bobH: 0.015, flex: 0.36, lat: 0, fold: 1.95, heel: 70, tail: 0.85, drop: 0.012, width: 1 }),
    G('gallop', 12, 4.1, 0.22, [0.6, 0.47, 0.0, 0.13], { liftF: 0.085, liftH: 0.078, bobF: 0.01, bobH: 0.018, flex: 0.44, lat: 0, fold: 2.05, heel: 76, tail: 1.0, drop: 0.02, width: 1 }),
  ],
  feet: {
    front: { type: 'digitigrade', curl: 55, elbowDown: 0.25 },
    hind: { type: 'digitigrade', curl: 65 },
  },
  stance: { width: 1, gallopWidth: 0.6, sprawl: 0, crouch: 0, scuff: [11, 18, 0] },
  // torso cross-sections (bind, reference size): centre height, half height, half width (incl. coat)
  body: {
    // (measured on the bind mesh: the lowest skin at each girdle, incl. the brisket and the low belly of the
    // primordial pouch just in front of the hips; the chest floor at the elbows since the trunk was made shallower)
    chest: { y: 0.171, hh: 0.07, hw: 0.056 }, // (+ the forearms folded under the chest when lying)
    mid: { y: 0.166, hh: 0.053, hw: 0.053 },
    pelvis: { y: 0.165, hh: 0.066, hw: 0.066 }, // incl. the folded thighs a lying cat rests on
    rump: { z: -0.182, y: 0.172, hh: 0.048, hw: 0.042 },
    back: 0.024,
  },
  head: {
    // [speed, raise (m), reach (m), pitch (rad, + = nose down)]: standing, the head is carried above
    // the withers with the nose a little down; walking at or just below the back line, level and
    // steady; galloping stretched forward, level with the back
    // (standing: raised 6 mm, nose 0.05 rad down; raised 12 mm and 0.1 down, the engine lifted neck1 16 deg against the head
    // and the throat skin folded over 2-4 cm under the chin (posed inverted skin 600 mm2 on the blue tom, seed 12; now 270): a
    // pale crescent ledge under the jaw from the front and below, the face's own outline round the chin; the occiput's skin
    // blend cannot reach past neckMid in the core, rig.js)
    carriage: [[0, 0.006, -0.003, 0.05], [0.6, -0.012, 0.006, 0.14], [1.6, -0.014, 0.01, 0.1], [4, -0.022, 0.016, 0.05], [9, -0.026, 0.02, 0.04]],
    stab: [[0, 0], [0.35, 0.3], [1, 0.35], [2.5, 0.4], [5, 0.62]],
    neckBend: 42, neckPivot: 0.55, yaw: 1.3, pitchUp: 0.6, pitchDown: 0.7,
  },
  tail: {
    // [speed, pitch per segment from horizontal (deg), base -> tip]: carried out behind and curving up
    // when standing (side1, threequarter1: the standing photos hold it level to raised, the tip up); the
    // walking "question mark" (shaft upright, tip hooked forward); raised at the trot, streaming straight
    // back at the gallop
    carriage: [
      [0.0, [2, 5, 7, 9, 11, 15, 21, 29, 39, 50]],
      [0.35, [32, 62, 80, 87, 90, 93, 102, 120, 145, 166]],
      [0.95, [30, 58, 76, 83, 86, 89, 97, 113, 136, 156]],
      [1.6, [18, 34, 44, 47, 48, 48, 50, 53, 58, 63]],
      [3.0, [6, 10, 12, 12, 12, 12, 13, 15, 17, 20]],
      [8, [0, 3, 5, 6, 6, 6, 7, 8, 9, 11]],
    ],
    stiffness: 1.1, sway: 6, flick: 1, wag: 0, swish: 0, curl: 0,
    balance: 0.25, // a cat's tail counter-swings in turns and speed changes (0.8 threw it up like a flag; 0.4 still swung an upright tail 49 deg out in a walking U-turn)
    radius: [0.022, 0.016], // (coat included)
  },
  ears: { rest: [0, 0], mobility: 0.78, speedFlatten: 0.35, flattenSpeeds: [4, 10], twitch: 1, prick: 0.55 }, // (mobility 0.78: ears laid back up to ~49 deg in the pounce, 63 stretched the crown between them > 3x)
  breath: { rate: 0.45, amp: 0.012, pant: false },
  actions: {
    attack: { style: 'pounce' },
    // (crouched to eat and drink, the hind legs folded and the hocks down)
    eat: { style: 'tear', dropF: 0.5, dropH: 0.62, ahead: 0.55 },
    drink: { dropF: 0.58, dropH: 0.66, ahead: 0.55, pitch: 1.2 },
    jump: { height: 1.0, distance: 1.4, land: [0.42, 0.32] },
    sit: { dropH: 1.0 },
    // lying sternal: the forepaws just in front of the chest, forearms folded under it (with the
    // cat's deep chest and short forelegs the default sphinx reach put the elbows in the ground)
    fold: { front: { z: 0.2, k: -1.45, beta: 0 } },
    lie: {},
    sleep: { style: 'curl' },
  },
};
