// Crow motion data for the bird engine (schema: src/core/motion/bird.js). Numbers are for the
// reference individual (params.size = 1: ~450 g American crow, 44 cm bill to tail, span 0.92 m);
// the engine scales them by dynamic similarity.
//
// Ground: crows WALK with alternating steps (stately gait, head bobbing each step, tail swinging) and
// HOP (both feet together) when hurrying, before take-off and to turn round [research 4, 5].
// Flight: steady rowing flight, 3.84 Hz at 10.5 m/s (hooded crow, Pennycuick 2001), amplitude
// ~100 deg, flexed-wing upstroke; take-off beats faster (~6 Hz) and deeper (~140 deg); short glides
// (<= 2-3 s); landing: swoop, pitch up 40-70 deg, braking beats with the wings raised high, tail
// fanned and depressed, legs forward.
const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const WING = {
  // humerus, ulna, hand (carpometacarpus + digit II) in metres
  lengths: [0.067, 0.078, 0.058],
  // degrees: elev (+ tip up), pitch (+ leading edge up), alpha (humerus, + back), elbow / wrist flexion
  bind: { elev: -30, pitch: 0, alpha: 35, elbow: 95, wrist: 100, bend: 0, twist: 0 },
  fold: { elev: -82, pitch: 4, alpha: 80, elbow: 175, wrist: 174, bend: 0, twist: 0 },
  glide: { elev: 5, pitch: 3, alpha: 8, elbow: 24, wrist: 14, bend: 2, twist: 1 },
  // flapping (cruise): stroke plane amplitude, frequency (Hz), downstroke share, wing flexion in the
  // upstroke (crows fold the hand in the upstroke), sweep and twist
  flap: { freq: 3.84, amp: 92, mid: 5, down: 0.55, upFlex: 34, upWrist: 40, sweep: 10, twist: 14 },
  // take-off / climb / braking beats
  power: { freq: 4.3, amp: 112, mid: 12, down: 0.52, upFlex: 50, upWrist: 62, sweep: 20, twist: 18 },
  // intermittent flight: glide share at cruise (0 = always flapping, crows glide little)
  glideShare: 0.15,
};

export const FEATHERS = {
  // 10 primaries (p10 short, p5/p6-p9 emarginated "fingers", longest p6-p7); roots along the hand
  primaries: [
    { u: 0.06, len: 0.158, width: 0.030, spread: 80, fold: 9 },
    { u: 0.16, len: 0.166, width: 0.030, spread: 71, fold: 8 },
    { u: 0.27, len: 0.177, width: 0.029, spread: 62, fold: 7 },
    { u: 0.38, len: 0.190, width: 0.028, spread: 53, fold: 6 },
    { u: 0.49, len: 0.205, width: 0.027, spread: 44, fold: 5, emarg: 0.5 },
    { u: 0.60, len: 0.222, width: 0.026, spread: 36, fold: 4, emarg: 0.9 },
    { u: 0.71, len: 0.228, width: 0.025, spread: 28, fold: 3, emarg: 1 },
    { u: 0.81, len: 0.222, width: 0.024, spread: 20, fold: 2, emarg: 1 },
    { u: 0.91, len: 0.200, width: 0.022, spread: 12, fold: 1, emarg: 1 },
    { u: 1.00, len: 0.122, width: 0.019, spread: 5, fold: 0.5, emarg: 0.6 },
  ],
  // 6 secondaries + 3 tertials, from the wrist to the elbow
  secondaries: [
    { u: 0.03, len: 0.150, width: 0.033, spread: 90, fold: 176 },
    { u: 0.14, len: 0.150, width: 0.033, spread: 92, fold: 176 },
    { u: 0.25, len: 0.148, width: 0.033, spread: 94, fold: 176 },
    { u: 0.36, len: 0.146, width: 0.033, spread: 96, fold: 176 },
    { u: 0.47, len: 0.144, width: 0.033, spread: 99, fold: 176 },
    { u: 0.58, len: 0.140, width: 0.033, spread: 102, fold: 177 },
    { u: 0.70, len: 0.132, width: 0.032, spread: 108, fold: 177 },
    { u: 0.81, len: 0.122, width: 0.031, spread: 116, fold: 178 },
    { u: 0.92, len: 0.108, width: 0.030, spread: 125, fold: 179 },
  ],
  // 12 rectrices (6 a side, central -> outer); tail slightly rounded; fan: fully spread angle
  rectrices: [
    { x: 0.002, len: 0.168, width: 0.034, fan: 4, fold: 0.5, bend: 0 },
    { x: 0.004, len: 0.168, width: 0.033, fan: 14, fold: 1, bend: -1 },
    { x: 0.006, len: 0.166, width: 0.032, fan: 25, fold: 1.5, bend: -2 },
    { x: 0.008, len: 0.163, width: 0.031, fan: 36, fold: 2, bend: -3 },
    { x: 0.010, len: 0.158, width: 0.030, fan: 47, fold: 2.5, bend: -4 },
    { x: 0.012, len: 0.150, width: 0.029, fan: 58, fold: 3, bend: -5 },
  ],
  coverts: { primary: 0.34, secondary: 0.6, tail: 0.44 },
};

export const motion = {
  gears: { walk: 0.5, hop: 1.2, fly: 10.5 },
  maxSpeed: 13,
  ground: { maxSpeed: 1.9, accel: [2.5, 4], decel: 5, turnRate: 4.5 },
  gaits: [
    G('walk', 0.0, 1.5, 0.72, [0, 0.5], { lift: 0.02, bob: 0.004, sway: 0.006, pitch: 0, headBob: 1, wings: 0, tail: 0.6 }),
    G('walk', 0.45, 2.1, 0.66, [0, 0.5], { lift: 0.024, bob: 0.006, sway: 0.006, pitch: -2, headBob: 1, wings: 0, tail: 0.8 }),
    G('walk', 0.75, 2.5, 0.6, [0, 0.5], { lift: 0.026, bob: 0.007, sway: 0.005, pitch: -5, headBob: 0.6, wings: 0.05, tail: 0.8 }),
    G('hop', 1.0, 3.2, 0.42, [0, 0], { lift: 0.03, bob: 0.004, hop: 0.04, sway: 0, pitch: -10, headBob: 0.2, wings: 0.15, tail: 0.5 }),
    G('hop', 1.8, 3.6, 0.36, [0, 0], { lift: 0.032, bob: 0.004, hop: 0.05, sway: 0, pitch: -14, headBob: 0.1, wings: 0.3, tail: 0.5 }),
  ],
  feet: { spread: [0, 22, 0, -22], curl: 70, grip: 1, pad: 0.0055 },
  // standing body: axis tilt above horizontal (deg); belly section (bind, ref size): centre height,
  // half height, half width
  body: { tilt: 30, belly: { y: 0.15, hh: 0.058, hw: 0.045 } },
  head: { bob: 1, yaw: 2.4, pitchUp: 0.6, pitchDown: 1.2, saccade: 1, cock: 0.35, jawRest: -4.6 },
  tail: { pitch: -6, walkBob: 6, sway: 5, flick: 1, fanRest: 0.05 },
  wing: WING,
  feathers: FEATHERS,
  flight: {
    minSpeed: 5.5, cruise: 10.5, maxSpeed: 13, climb: [3.0, -5.0], bankMax: 60, turnRate: 2.4,
    clearance: 1.6, glideRatio: 7, sustained: true,
    // cruise: legs folded back along the body, feet under the undertail coverts (flight1 / flight2)
    legTuck: { back: 0.86, down: 0.0, side: 0.5 },
  },
  takeoff: { crouch: 0.16, jump: 2.2, angle: 35, beats: 5 },
  landing: { approach: 7, flare: 0.55, touch: 1.0 },
  actions: {
    attack: { style: 'peck' },
    eat: { style: 'peck', rate: 2.4, reach: 1.3, billPitch: 0.62, bodyPitch: -0.5, drop: 0.32 },
    drink: {},
    jump: { height: 0.2, distance: 0.45 },
    sleep: { style: 'sink' }, // roosting: head drawn into the shoulders, bill tucked into the breast feathers
  },
};
