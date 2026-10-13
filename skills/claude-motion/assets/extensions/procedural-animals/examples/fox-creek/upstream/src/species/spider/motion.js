// Spider motion data for the spider engine (schema: src/core/motion/spider.js).
// Numbers are for the reference individual of each variant (params.size = 1); the engine scales
// speeds by dynamic similarity (sqrt(size)) and reads every length from the joints.
//
// Gait: alternating tetrapod (L1 R2 L3 R4 against R1 L2 R3 L4) with a back-to-front metachronal lag
// inside each tetrapod (Biancardi et al. 2011 on Grammostola: quadruped lag 16 % slow, 8 % fast;
// Weihmann 2013 on Cupiennius: contralateral pairs in antiphase, body oscillation tiny). Offsets are
// touchdown phases relative to L4, in the order L1 L2 L3 L4 R1 R2 R3 R4.
// Duty factor falls with speed (d = 0.666 - 0.531 v for Grammostola; Cupiennius < 0.5 when fast);
// stride frequency rises with speed (f = 14.4 v + 0.14 Hz for an 18 g tarantula, faster for the
// smaller wolf spider by dynamic similarity).
const slow = [0.74, 0.16, 0.58, 0.0, 0.24, 0.66, 0.08, 0.5];
const fast = [0.62, 0.08, 0.54, 0.0, 0.12, 0.58, 0.04, 0.5];
const G = (name, v, f, D, off, o = {}) => ({ name, v, f, D, off, ...o });

export const motion = {
  // ---------------------------------------------------------------- wolf spider (default)
  maxSpeed: 0.32, // m/s: a dash (wolf spiders sprint at 0.3-0.6 m/s over short distances)
  accel: 1.6, // m/s^2: wolf spiders reach full speed within a stride or two
  decel: 2.4, // and freeze abruptly
  turnRate: 4.0, // rad/s (on the spot and at a walk)
  latAccelMax: 0.4, // m/s^2: at speed it turns in arcs of a few body lengths
  gears: { walk: 0.05, run: 0.14, sprint: 0.3 },
  gaits: [
    G('walk', 0.0, 1.6, 0.72, slow, { lift: 0.0022, bob: 0.00008, sway: 0.015 }),
    G('walk', 0.05, 2.4, 0.66, slow, { lift: 0.0026, bob: 0.00012, sway: 0.015 }),
    G('run', 0.1, 3.3, 0.58, fast, { lift: 0.003, bob: 0.00016, sway: 0.01 }),
    G('run', 0.18, 4.9, 0.5, fast, { lift: 0.0034, bob: 0.0002, sway: 0.008 }),
    G('run', 0.3, 6.0, 0.48, fast, { lift: 0.0038, bob: 0.00022, sway: 0.006 }),
  ],
  // neutral footholds: bind claw positions pulled toward the coxa (legs are not fully spread in
  // stance) and the stance height relative to the bind pose
  stance: { reach: [0.8, 0.9, 0.9, 0.78], height: 1.0, width: 1.0 },
  feet: { contact: 'claw', heelLift: 12 },
  abdomen: { stiffness: 16, lag: 0.12, droop: 0.05 },
  breath: { rate: 0.55, amp: 0.018 },
  chelicerae: { fang: 'labidognath', fangOpen: 1.25, spread: 0.35, pitch: 0.45 },
  palps: { twitch: 1, tap: 0.6 },
  idle: { twitch: 1, raiseFront: 0.12, look: 0.35 },
  look: { yaw: 0.45, pitch: 0.32 },
  actions: {
    jump: { height: 0.016, distance: 0.035, crouch: 0.25 },
    attack: { style: 'threat-lunge', rear: 0.3, lunge: 0.005, threat: 0.7 },
    sleep: { tuck: 0.85 },
  },

  // ---------------------------------------------------------------- tarantula
  variants: {
    tarantula: {
      maxSpeed: 0.18,
      accel: 1.2,
      decel: 2.4,
      turnRate: 3.2,
      gears: { walk: 0.035, run: 0.1, sprint: 0.2 },
      gaits: [
        G('walk', 0.0, 0.8, 0.7, slow, { lift: 0.005, bob: 0.00015, sway: 0.012 }),
        G('walk', 0.04, 1.4, 0.65, slow, { lift: 0.0055, bob: 0.0002, sway: 0.012 }),
        G('run', 0.11, 2.4, 0.6, fast, { lift: 0.0065, bob: 0.0003, sway: 0.008 }),
        G('run', 0.236, 3.6, 0.54, fast, { lift: 0.0075, bob: 0.0004, sway: 0.006 }),
      ],
      stance: { reach: [0.88, 0.93, 0.93, 0.88], height: 1.0, width: 1.0 },
      breath: { rate: 0.35, amp: 0.012 },
      chelicerae: { fang: 'orthognath', fangOpen: 1.2, spread: 0.12, pitch: 0.55 },
      idle: { twitch: 0.5, raiseFront: 0.05, look: 0.2 },
      actions: {
        jump: { height: 0.012, distance: 0.05, crouch: 0.2 },
        attack: { style: 'threat-lunge', rear: 0.7, raise2: 0.65, lunge: 0.008, threat: 0.9 },
        sleep: { tuck: 0.8 },
      },
    },
  },
};
