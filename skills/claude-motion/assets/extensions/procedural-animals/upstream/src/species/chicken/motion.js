// Chicken motion data for the bird engine (schema: src/core/motion/bird.js). Numbers are for the
// reference individual (params.size = 1: a ~2 kg brown layer hen, hip 0.21 m, 0.42 m bill to tail);
// the engine scales them by dynamic similarity.
//
// Ground: a strictly alternating walk (duty 0.72 -> 0.6) with the signature head bob (the head holds
// still in space for ~60 % of each step, then thrusts forward), a grounded run (duty ~0.5) and an
// aerial sprint (wings folded on the body). Chickens never hop to travel (hop only as a jump).
// Flight: burst flight only - wingbeats ~10 Hz, amplitude ~135 deg (laying hens, R. Soc. Open Sci.
// 2021), a flutter up onto a perch or a short escape flight, then a steep glide down (not sustained).
// Per individual (motion.individual): roosters attack with a flapping jump-kick (spurs), hens peck;
// roosters crow as an idle behaviour; chicks have stubby wings and no tail.
const G = (name, v, f, D, off, o) => ({ name, v, f, D, off, ...o });

// Wing (humerus, ulna, hand in metres; configurations in degrees, see core/rig/bird.js). The folded
// wing lies high on the flank, its primaries tucked under the secondaries, tips below the tail base.
export function wingFor(form = {}) {
  const k = form.wingK ?? 1;
  return {
    lengths: [0.077 * k, 0.07 * k, 0.066 * k],
    bind: { elev: -30, pitch: 0, alpha: 35, elbow: 95, wrist: 100, bend: 0, twist: 0 },
    // folded: the wing plane leans out 14 deg from the vertical, on the barrel of the flank (fitted so
    // the stack's outline lies on the body; the flank under it is flattened and bedded, sculpt.js
    // flankUnderWing / wingPocket; leaning in more cut the primaries' tips into the rump); an upright
    // individual (form.up: a rooster's torso is pitched up) folds it turned down at the back with the
    // body, off the saddle (2 deg per deg of pitch: at 1.3 the primaries' tips cut into the thigh)
    fold: { elev: -76, pitch: 4, alpha: 76 - 2.0 * (form.up ?? 0), elbow: 171, wrist: 170, bend: 0, twist: 0 },
    glide: { elev: 6, pitch: 4, alpha: 6, elbow: 22, wrist: 12, bend: 2, twist: 2 },
    // burst flight: fast, deep beats (the wing tips clap close above and below the body); a chick's
    // stubby wings flutter above its round body (deep strokes dipped them into the ball of down)
    flap: form.chick ? { freq: 8.5, amp: 70, mid: 30, down: 0.55, upFlex: 30, upWrist: 36, sweep: 12, twist: 12 } : { freq: 8.5, amp: 108, mid: 8, down: 0.55, upFlex: 40, upWrist: 48, sweep: 16, twist: 16 },
    power: form.chick ? { freq: 9.6, amp: 78, mid: 32, down: 0.52, upFlex: 36, upWrist: 44, sweep: 14, twist: 14 } : { freq: 9.6, amp: 124, mid: 14, down: 0.52, upFlex: 52, upWrist: 62, sweep: 22, twist: 18 },
    glideShare: 0.35,
  };
}

// Flight feathers. 10 primaries (rounded galliform wing: p7-p8 longest; no emargination: the engine
// bends notched primaries up under load by their notch, and the outer three rose through each other), 10
// secondaries + tertials, 7 rectrices a side held as a steep "roof" (the two halves of the tail meet
// in an inverted V: fanned up and back, vanes near vertical); roosters add two sickles a side (long,
// arching central coverts) and chicks have only short pin feathers.
export function feathersFor(form = {}) {
  const pk = form.priK ?? 1, rk = form.recK ?? 1, wk = form.fwK ?? 1;
  // Stacking (every card lies on its neighbour, none cuts through it, folded or spread): each feather's
  // root is lifted 0.8 mm above the next one in the overlap order (primaries: inner on top; secondaries:
  // the tertials on top, all above the primaries), with nearly flat vanes (arch 3 % of the half width:
  // the default 12 % dropped a neighbour's vane edge through the next card wherever they overlap
  // sideways), little twist and droop (a twisted vane crossed its fanned neighbour); the folded
  // primaries lie almost along the hand, under the secondaries (steeper fold angles lifted their outer
  // vanes over the top of the wing into the back).
  const LP = 0.0008, LS = 0.0008, LS0 = 0.008, ARCH = 0.03;
  const P = [
    [0.06, 0.128, 78, -4], [0.16, 0.136, 70, -2.5], [0.26, 0.145, 62, -1], [0.36, 0.154, 54, 0.5], [0.46, 0.163, 46, 2.7],
    [0.56, 0.171, 38, 2.5], [0.66, 0.178, 30, 2.3], [0.76, 0.18, 22, 2], [0.87, 0.172, 14, 1], [0.98, 0.15, 6, 0.5],
  ];
  const primaries = P.map(([u, len, spread, fold], i) => ({ u, len: len * pk, width: 0.036 * wk, spread, fold, emarg: 0, tipRound: 0.5, outer: i < 3 ? 0.42 : 0.34, lift: (P.length - 1 - i) * LP, twist: 1, droop: 0.01, curve: 0.03, arch: ARCH,
    // the innermost primary coverts lie wholly under the covert shield when folded (their roots at the
    // wrist cut out through its front rim); the first one a little higher (half open, it crossed the
    // third secondary under the shield's thin front)
    ...(i < 2 ? { cov: { shift: 0.004, lenK: 0.3, ...(i === 0 && !form.chick ? { lift: 0.003 } : {}) } } : {}) }));
  // (the tertials, innermost, are shorter: their rounded ends step up along the folded wing's top)
  const S = [[0.03, 0.122], [0.13, 0.123], [0.23, 0.123], [0.33, 0.122], [0.43, 0.12], [0.53, 0.118], [0.63, 0.116], [0.73, 0.128], [0.83, 0.118], [0.93, 0.108]];
  // greater coverts: sculpted as skin (sculpt.js coverts(): the shingled shield of the folded wing), no
  // covert cards (a chick keeps its little covert cards: without them the metrics put its lying shank
  // skin 0.8 mm into the ground, seed 3 - the cause is in the engine's lie, not traced)
  // (a chick's inner secondaries are short pin feathers: longer ones swept into its round body as the wing
  // opened and folded)
  const ST = form.chick ? [1, 1, 1, 1, 1, 1, 0.9, 0.7, 0.62, 0.55] : null;
  const secondaries = S.map(([u, len], i) => ({
    u, len: (ST ? Math.min(len, 0.122) * ST[i] : len) * pk, width: 0.046 * wk, spread: 90 + i * 3.5, fold: 163 + i * 1.2, tipRound: i >= 7 && !form.chick ? 0.32 : 0.6, ...(i >= 7 && !form.chick ? { base0: 0.6 } : {}), outer: 0.42, lift: LS0 + i * LS, twist: 1, arch: ARCH,
    cov: { skip: true },
  }));
  // rectrices: central -> outer. `bend` lifts the feather out of the tail plane (the pygostyle already
  // points up and back), `twist` stands the vane up (roof), `fan` spreads it sideways when fanned. A hen's
  // roof is steep at the ridge (the central pairs near vertical, 80 / 74 deg; at 68 the second crossed the
  // first) and opens to 58 deg at the sides (at 44-50 the outer pairs' inner vanes met under the ridge),
  // her rectrices straight (curved in toward the midline, the two halves crossed); a rooster's arched
  // rectrices sit 6 mm further out from the midline with their vanes on edge (nearly vertical: each arc
  // curves back and down in its own side's plane; tilted like a hen's roof, the arcs of the two sides
  // curved in to the midline and crossed under the tail). No covert cards on the rectrices (each one's
  // covert crossed its inner neighbour or the other side's at the ridge as the tail swayed and fanned;
  // the uppertail coverts' mass, the saddle and the sickles cover the base), and a rooster's second sickle
  // fans no wider than his first rectrix (at 6 deg it crossed it in the landing flare).
  const R = [
    [0.002, 0.13, 3, 12], [0.004, 0.128, 7, 6], [0.006, 0.125, 12, 0], [0.008, 0.12, 17, -6],
    [0.01, 0.113, 22, -12], [0.012, 0.105, 27, -18], [0.014, 0.096, 32, -24],
  ];
  const rectrices = R.map(([x, len, fan, bend], i) => ({
    x: form.sickles ? x * 1.4 + 0.006 : x, len: len * rk, width: (form.sickles ? 0.034 : 0.042) * wk, fan, fold: 1 + i * 0.4, bend: bend + (form.sickles ? -6 : 0), twist: form.sickles ? 90 - i : i === 0 ? 80 : i === 1 ? 74 : 72 - i * 2, lift: 0.0024 - i * 0.0003,
    tipRound: 0.62, outer: 0.44, arc: form.sickles ? 55 + i * 5 : 0, cov: { skip: true },
  }));
  if (form.sickles) {
    // sickles: long, narrow, arching back and down over the tail (roosters)
    const sk = form.sickles;
    rectrices.push(
      { x: 0.001, len: 0.36 * sk, width: 0.03 * wk, fan: 2, fold: 0.5, bend: 30, twist: 90, lift: 0.004, tipRound: 0.8, outer: 0.46, arc: 118, droop: 0.02 },
      { x: 0.003, len: 0.3 * sk, width: 0.026 * wk, fan: 3, fold: 1, bend: 18, twist: 90, lift: 0.0035, tipRound: 0.8, outer: 0.46, arc: 108, droop: 0.02 },
    );
  }
  return { primaries, secondaries, rectrices, coverts: { primary: 0.4, secondary: 0.5, tail: form.sickles ? 0.62 : 0.55 } };
}

export const WING = wingFor();
export const FEATHERS = feathersFor();

const base = {
  gears: { walk: 0.55, run: 1.9, fly: 5 },
  maxSpeed: 7,
  ground: { maxSpeed: 3.6, accel: [2.5, 5], decel: 5.5, turnRate: 5 },
  gaits: [
    // slow foraging walk -> preferred walk -> fast walk (head bob every step)
    G('walk', 0.0, 1.3, 0.74, [0, 0.5], { lift: 0.03, bob: 0.004, sway: 0.008, pitch: 0, headBob: 1, wings: 0, tail: 0.5 }),
    G('walk', 0.55, 1.9, 0.66, [0, 0.5], { lift: 0.038, bob: 0.006, sway: 0.009, pitch: -2, headBob: 1, wings: 0, tail: 0.7 }),
    G('walk', 0.95, 2.4, 0.6, [0, 0.5], { lift: 0.04, bob: 0.007, sway: 0.007, pitch: -5, headBob: 0.8, wings: 0.03, tail: 0.7 }),
    // grounded run (no aerial phase), then an aerial sprint; the wings stay folded on the body (part
    // open they stood off the flank)
    G('run', 1.4, 2.9, 0.52, [0, 0.5], { lift: 0.042, bob: 0.006, sway: 0.004, pitch: -12, headBob: 0.25, wings: 0, tail: 0.5 }),
    G('run', 2.6, 3.6, 0.42, [0, 0.5], { lift: 0.046, bob: 0.005, sway: 0.003, pitch: -18, headBob: 0.05, wings: 0, tail: 0.4 }),
  ],
  feet: { spread: [0, 24, 2, -26], curl: 75, grip: 1, pad: 0.009, hock: 0.0085, sole: 0.0125 },
  // belly section (bind, ref size): centre height, half height, half width
  body: { tilt: 22, belly: { y: 0.15, hh: 0.08, hw: 0.068 } },
  head: { bob: 1.33, bobHold: 0.62, yaw: 2.6, pitchUp: 1.0, pitchDown: 1.25, saccade: 1, cock: 0.45, jawRest: -2, radius: 0.017 },
  tail: { walkBob: 5, sway: 4, flick: 1, fanRest: 0.02 },
  wing: WING,
  feathers: FEATHERS,
  flight: {
    minSpeed: 2.6, cruise: 5, maxSpeed: 7, climb: [2.4, -3.5], bankMax: 45, turnRate: 3.2,
    clearance: 0.8, glideRatio: 2.5, sustained: false, maxTime: 2.5,
  },
  takeoff: { crouch: 0.18, jump: 2.4, angle: 50, beats: 6 },
  landing: { approach: 4, flare: 0.4, touch: 1.2 },
  actions: {
    attack: { style: 'peck' },
    // scratch the ground (two rakes of one foot, one or two of the other, step back), then peck
    eat: { style: 'scratch', rate: 2.6 },
    drink: {},
    jump: { height: 0.25, distance: 0.35 },
    // lying at rest with the wings folded on the body (the engine's default lie droops and part spreads
    // them, sunning)
    lie: { wings: 0 },
    death: { wings: 0 },
    // roosting: fluffed, settled on the hocks, head drawn into the shoulders (fluffed less than the engine's
    // default: the torso swells about the hips and the flank rose into the folded primaries)
    sleep: { style: 'sink', fluff: 0.4 },
    idle: {},
  },
};

// per-individual overrides (sex, age): read by the bird engine (motion.individual)
function individual(p = {}) {
  const out = {};
  const form = p.form || {};
  if (form.wingK || form.priK || form.recK || form.sickles) {
    out.wing = wingFor(form);
    out.feathers = feathersFor(form);
  }
  if (p.age === 'juvenile') {
    // chicks: short quick steps, no real flight (a flutter), peeping bill
    // (short legs: quicker, shorter steps and lower speeds than a scaled-down hen)
    out.gaits = base.gaits.map((g) => ({ ...g, f: g.f * 1.1, lift: g.lift * 1.1 }));
    out.gears = { walk: 0.4, run: 1.25, fly: 3.2 };
    out.ground = { ...base.ground, maxSpeed: 2.4 };
    out.maxSpeed = 4;
    out.flight = { ...base.flight, minSpeed: 2, cruise: 3.2, maxSpeed: 4, maxTime: 0.6, climb: [1.2, -3] };
    out.body = { tilt: 18, belly: { y: 0.15, hh: 0.075, hw: 0.075 } };
    out.actions = { ...base.actions, attack: { style: 'peck' }, eat: { style: 'peck', rate: 3 } };
    out.feet = { ...base.feet, pad: 0.011 };
  } else if (p.sex === 'male') {
    // roosters: flapping jump-kick with the spurs; crow as an idle behaviour
    out.actions = { ...base.actions, attack: { style: 'spur' }, idle: { crow: 0.22 } };
    // the sickle tail stays half raised in flight (it would sweep the ground in the landing flare)
    out.tail = { ...base.tail, flight: 0.45 };
  }
  return out;
}

export const motion = { ...base, individual };
