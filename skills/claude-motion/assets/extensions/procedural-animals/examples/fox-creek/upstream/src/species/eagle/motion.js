// Eagle motion data for the bird engine (schema: src/core/motion/bird.js). Numbers are for the
// reference individual (params.size = 1: ~4.7 kg adult bald eagle, 0.86 m bill to tail, span ~2.1 m);
// the engine scales them by dynamic similarity.
//
// Ground: eagles walk rarely and awkwardly (a rolling, wide-footed waddle with the talons lifted high)
// and hop with a wing flap to close on prey or reposition [research 4].
// Flight: soaring and gliding almost all the time (95-100 % flap-gliding, Pennycuick 1990): a few slow
// deep beats (2.72 Hz at 11.2 m/s, amplitude ~85 deg) then long glides on flat (bald) or slightly
// raised (golden) wings with the outer primaries splayed into 6-7 upturned fingers; banked thermal
// circles; take-off with 3-6 heavy beats; landing: long shallow approach, swoop up, body pitched up,
// wings raised and swept forward for braking beats, tail fanned and depressed, talons thrown forward.
const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

export const WING = {
  // humerus, ulna, hand (carpometacarpus + digit II) in metres (bald eagle osteometry)
  lengths: [0.19, 0.22, 0.15],
  // the wing root frame follows the upright body axis (standing tilt 48, see body.tilt), so the glide
  // chord and the stroke plane are level when the body is levelled in flight (2 deg short of it, with
  // glide.pitch 6: the folded / dead wing stays as it was tuned for the ground contact of a fly-death)
  tilt: 46,
  // degrees: elev (+ tip up), pitch (+ leading edge up), alpha (humerus, + back), elbow / wrist flexion
  bind: { elev: -5, pitch: 0, alpha: 50, elbow: 95, wrist: 100, bend: 0, twist: 0 },
  fold: { elev: -84, pitch: 2, alpha: 100, elbow: 152, wrist: 160, bend: 0, twist: 0 },
  // soaring glide: long flat "plank" wings, leading edge nearly straight, hand slightly swept back
  glide: { elev: 3, pitch: 6, alpha: 2, elbow: 18, wrist: 16, bend: 3, twist: 1 },
  // cruise stroke: slow and deep, flexed upstroke
  flap: { freq: 2.72, amp: 84, mid: 4, down: 0.56, upFlex: 30, upWrist: 36, sweep: 10, twist: 12 },
  // take-off / climb / braking beats (heavy, full amplitude; reduced from the research estimate of
  // ~3.5 Hz / 130 deg so the long primaries stay smooth at 60 fps)
  power: { freq: 3.2, amp: 98, mid: 6, down: 0.52, upFlex: 46, upWrist: 56, sweep: 16, twist: 16 },
  // flap-gliding: most of level flight is spent gliding; soaring birds take long glides
  glideShare: 0.6,
  soar: 0.8,
  // soaring: the slotted outer primaries bend up into separate fingers
  fingerLift: 12,
  // part-open wings on the ground are carried raised (the long primaries would drag)
  groundLift: 45,
  // thick feathered forearm: wrist / tip clearance above the ground
  skin: 0.04,
};

// Primaries: 10, p10 short, p5-p10 emarginated (6-7 "fingers" in flight), longest p7-p8.
// Secondaries + tertials 12 per wing, rectrices 12 (bald: slightly wedge-shaped tail).
export const FEATHERS = {
  primaries: [
    { u: 0.05, len: 0.33, width: 0.066, spread: 78, fold: 8, droop: 0.008 },
    { u: 0.15, len: 0.345, width: 0.066, spread: 70, fold: 7, droop: 0.008 },
    { u: 0.26, len: 0.36, width: 0.065, spread: 62, fold: 6, droop: 0.008 },
    { u: 0.37, len: 0.38, width: 0.064, spread: 54, fold: 5.5, emarg: 0.35, droop: 0.008 },
    { u: 0.48, len: 0.405, width: 0.062, spread: 46, fold: 5, emarg: 0.8, droop: 0.008 },
    { u: 0.59, len: 0.43, width: 0.06, spread: 38, fold: 4, emarg: 1, bend: 2, droop: 0.008 },
    { u: 0.70, len: 0.45, width: 0.058, spread: 30, fold: 3, emarg: 1, bend: 3, droop: 0.008 },
    { u: 0.80, len: 0.45, width: 0.055, spread: 21, fold: 2, emarg: 1, bend: 4, droop: 0.008 },
    { u: 0.90, len: 0.43, width: 0.052, spread: 12, fold: 1, emarg: 1, bend: 5, droop: 0.008 },
    { u: 1.00, len: 0.35, width: 0.046, spread: 3, fold: 0.5, emarg: 1, bend: 5, droop: 0.008 },
  ],
  secondaries: [
    { u: 0.03, len: 0.32, width: 0.072, spread: 84, fold: 144 },
    { u: 0.11, len: 0.325, width: 0.072, spread: 86, fold: 144 },
    { u: 0.19, len: 0.325, width: 0.072, spread: 88, fold: 144.5 },
    { u: 0.27, len: 0.325, width: 0.072, spread: 90, fold: 145 },
    { u: 0.35, len: 0.322, width: 0.072, spread: 92, fold: 145 },
    { u: 0.43, len: 0.318, width: 0.072, spread: 94, fold: 145.5 },
    { u: 0.51, len: 0.312, width: 0.071, spread: 96, fold: 146 },
    { u: 0.59, len: 0.304, width: 0.07, spread: 99, fold: 146 },
    { u: 0.67, len: 0.295, width: 0.069, spread: 104, fold: 146.5 },
    { u: 0.75, len: 0.29, width: 0.068, spread: 112, fold: 147 },
    { u: 0.84, len: 0.28, width: 0.068, spread: 124, fold: 147.5 },
    { u: 0.93, len: 0.265, width: 0.068, spread: 140, fold: 148 },
  ],
  rectrices: [
    { x: 0.004, len: 0.31, width: 0.075, fan: 4, fold: 0.5, bend: 0 },
    { x: 0.008, len: 0.305, width: 0.074, fan: 13, fold: 1, bend: -1 },
    { x: 0.012, len: 0.298, width: 0.073, fan: 23, fold: 1.5, bend: -2 },
    { x: 0.016, len: 0.29, width: 0.072, fan: 33, fold: 2, bend: -3 },
    { x: 0.020, len: 0.28, width: 0.07, fan: 43, fold: 2.5, bend: -4 },
    { x: 0.024, len: 0.268, width: 0.068, fan: 53, fold: 3, bend: -5 },
  ],
  coverts: { primary: 0.32, secondary: 0.46, tail: 0.5 },
};

// Cruise-flight carriage (bird engine flight.shape; flight photos): the head carried
// forward and low on an extended neck, in line with the body (bill and tail tip on one line, the belly
// ~0.06 of the bill-to-tail length below it, the back ~0.12 above), the neck sleeked (cross-section x0.6:
// ~0.55 of the torso's depth, the throat flush with the breast), the contour plumage sleeked (torso depth x0.82 about a centre 10 cm up on the back: the belly
// rises toward the back), the thigh and trouser feathers drawn in, the tail fanned into a broad wedge.
const FLIGHT_SHAPE = { reach: 0.1, drop: 0.5, neck: 0.4, body: [0.95, 1, 0.82], back: 0.1, legs: 0.3, fan: 0.6 };

export const motion = {
  gears: { walk: 0.4, hop: 1.1, run: 2.2, fly: 11.2 },
  maxSpeed: 19,
  ground: { maxSpeed: 3, accel: [1.8, 3], decel: 4, turnRate: 3 },
  gaits: [
    // waddling walk: wide feet, big roll toward the stance leg, talons lifted high
    G('walk', 0.0, 0.8, 0.74, [0, 0.5], { lift: 0.05, bob: 0.008, sway: 0.02, pitch: 0, headBob: 0.25, wings: 0.05, tail: 0.3 }),
    G('walk', 0.35, 1.0, 0.7, [0, 0.5], { lift: 0.055, bob: 0.01, sway: 0.022, pitch: -4, headBob: 0.25, wings: 0.1, tail: 0.4 }),
    G('walk', 0.6, 1.2, 0.66, [0, 0.5], { lift: 0.06, bob: 0.012, sway: 0.02, pitch: -8, headBob: 0.2, wings: 0.15, tail: 0.4 }),
    // hop: both feet together (closing on prey, repositioning)
    G('hop', 0.9, 1.5, 0.36, [0, 0], { lift: 0.04, bob: 0.006, hop: 0.06, sway: 0, pitch: -14, headBob: 0.1, wings: 0, tail: 0.5 }),
    G('hop', 1.3, 1.7, 0.34, [0, 0], { lift: 0.045, bob: 0.006, hop: 0.07, sway: 0, pitch: -18, headBob: 0.05, wings: 0, tail: 0.5 }),
    // run: short alternating take-off run (2-4 steps, 1-3 m/s, 2-3 Hz, duty 0.4-0.5)
    G('run', 1.7, 2.2, 0.46, [0, 0.5], { lift: 0.05, bob: 0.01, sway: 0.012, pitch: -20, headBob: 0.05, wings: 0, tail: 0.5 }),
    G('run', 2.8, 2.6, 0.4, [0, 0.5], { lift: 0.055, bob: 0.012, sway: 0.01, pitch: -26, headBob: 0.0, wings: 0, tail: 0.5 }),
  ],
  // (hock: the intertarsal joint's skin radius - the feathered cuff and the end of the trousers, ~2 cm)
  feet: { spread: [0, 20, 0, -22], curl: 10, grip: 1, pad: 0.016, toeClear: 0.0075, sitPad: 0.011, hock: 0.02 },
  body: { tilt: 48, belly: { y: 0.26, hh: 0.13, hw: 0.2 } },
  head: { bob: 0.25, yaw: 1.8, pitchUp: 0.5, pitchDown: 1.0, saccade: 1, cock: 0.25, jawRest: 0 },
  // (flight 2.4: in flight the tail droops ~14 deg below the body axis, its underside continuing the
  // belly line, as in the flight photos)
  tail: { pitch: -4, walkBob: 4, sway: 4, flick: 0.5, fanRest: 0.04, soarFan: 0.35, flight: 2.4 },
  wing: WING,
  feathers: FEATHERS,
  flight: {
    minSpeed: 7, cruise: 11.2, maxSpeed: 19, climb: [2.2, -6], bankMax: 45, turnRate: 1.2,
    clearance: 3, glideRatio: 12, sustained: true,
    // legs folded back along the belly, the feet tight under the tail coverts (flight photos)
    legTuck: { back: 0.82, down: 0.07, side: 0.5 },
    shape: FLIGHT_SHAPE,
  },
  takeoff: { crouch: 0.3, jump: 2.4, angle: 25, beats: 5, open: 0.8 },
  landing: { approach: 8, flare: 0.8, touch: 1.0 },
  actions: {
    attack: { style: 'talons', mantle: 1 },
    eat: { style: 'tear', rate: 0.8 },
    drink: {},
    jump: { height: 0.3, distance: 0.8 },
    sleep: { style: 'sink' },
    // preening the breast / shoulder: the upright eagle's breast is well forward of the hips
    preen: { spot: [0.035, 0.27, 0.19], pitch: 0.9 },
  },
  // golden eagle: soars with the wings raised in a shallow V (dihedral); its smaller head projects less
  // in flight (less than half the tail's length, a field mark against the bald eagle's)
  variants: {
    golden: { wing: { glide: { ...WING.glide, elev: 3, bend: 10 } }, flight: { shape: { ...FLIGHT_SHAPE, reach: 0 } } },
  },
};
