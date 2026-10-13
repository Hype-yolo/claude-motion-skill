// Fish motion data for the swimmer engine (schema: src/core/motion/swimmer.js). Speeds in body
// lengths per second (BL/s), so one table serves every size. Per-variant overrides in `variants`.
//
// Tail-beat frequency vs speed from Bainbridge (1958, dace / trout / goldfish): U/L = 0.75 f - 1 above
// ~2 BL/s, tail amplitude ~0.2 L peak-to-peak; below that the frequencies and amplitudes are estimates
// from subcarangiform kinematics (Videler 1993). Bluegill: pectoral (labriform) swimming up to 1.2 BL/s,
// fin beat 2.8 Hz at the gait transition (Jones et al. 2007). C-start stage 1 ~ 0.24 s per metre of body
// (Domenici 2023: 16 ms at 5 cm, 60 ms at 25 cm). Wave rows: [v, f Hz, amp p-p / L, lambda / L,
// pectoral activity, pectoral beat Hz, pectoral fold].
export const motion = {
  speeds: { scull: 0.4, cruise: 1.5, sprint: 4 },
  maxSpeed: 6, burstSpeed: 10, accel: 12, decel: 4, turnRate: 3.2, turnRadius: 0.35,
  wave: [
    [0, 0.8, 0.03, 1.0, 1.0, 1.5, 0],
    [0.5, 1.9, 0.1, 0.95, 0.6, 1.8, 0.3],
    [1.5, 3.3, 0.17, 0.9, 0.15, 2.0, 0.75],
    [3, 5.3, 0.2, 0.85, 0, 2, 1],
    [6, 9.3, 0.2, 0.8, 0, 2, 1],
    [10, 14.7, 0.21, 0.75, 0, 2, 1],
  ],
  envelope: { exp: 3.5 },
  flex: [0.15, 0.86], bend: 1.4, cBend: 3.1, bank: 0.3, pitchMax: 0.9, hover: 0.35,
  clearance: 0.1, cruiseDepth: 0.6,
  pectoral: { rest: [0, 0, 0], flap: 9, row: 14, feather: 22, fold: 24, flare: 45, alternate: 0.25, stiff: 0 },
  pelvic: { rest: 0, spread: 10, fold: 12 },
  breath: { rate: 1.2, operculum: 9, mouth: 0.07, ram: 2.5 },
  jaw: { gape: 30, protrude: 0.02 },
  actions: {
    burst: { turn: 90 },
    jump: { height: 1.4 },
    eat: { style: 'suction' },
    drink: { reach: 3 },
    sleep: { style: 'bottom' },
  },
  variants: {
    trout: {
      speeds: { scull: 0.4, cruise: 1.5, sprint: 4 },
      jaw: { gape: 34, protrude: 0.012 },
      actions: { jump: { height: 1.8 } },
    },
    goldfish: {
      speeds: { scull: 0.35, cruise: 1.3, sprint: 3.5 },
      maxSpeed: 5, burstSpeed: 9,
      wave: [
        [0, 1.0, 0.03, 1.0, 1.0, 2.2, 0],
        [0.5, 1.8, 0.09, 0.95, 0.8, 2.4, 0.2],
        [1.3, 3.1, 0.17, 0.9, 0.3, 2.4, 0.6],
        [3, 5.3, 0.2, 0.85, 0, 2.4, 1],
        [6, 9.3, 0.2, 0.8, 0, 2.4, 1],
        [10, 14.7, 0.21, 0.75, 0, 2.4, 1],
      ],
      envelope: { exp: 3.0 }, turnRadius: 0.25,
      pectoral: { rest: [0, 0, 0], flap: 11, row: 16, feather: 26, fold: 26, flare: 48, alternate: 0.8 },
      jaw: { gape: 36, protrude: 0.03 },
      breath: { rate: 1.4 },
      actions: { eat: { style: 'bottom' }, jump: { height: 1.0 } },
    },
    clownfish: {
      speeds: { scull: 0.8, cruise: 2.0, sprint: 4 },
      maxSpeed: 6, burstSpeed: 9, turnRadius: 0.2, turnRate: 4,
      wave: [
        [0, 1.0, 0.02, 1.0, 1.0, 3.5, 0],
        [0.6, 1.2, 0.03, 1.0, 1.0, 4.5, 0],
        [1.4, 2.4, 0.08, 0.95, 0.8, 5.0, 0.15],
        [2.2, 4.0, 0.16, 0.9, 0.2, 4, 0.6],
        [4, 6.7, 0.2, 0.85, 0, 4, 1],
        [8, 12, 0.21, 0.8, 0, 4, 1],
      ],
      envelope: { exp: 2.8 },
      pectoral: { rest: [0, 0, 0], flap: 12, row: 20, feather: 28, fold: 28, flare: 45, alternate: 0.08 },
      breath: { rate: 1.8 },
      jaw: { gape: 30, protrude: 0.03 },
      actions: { sleep: { style: 'side' }, jump: { height: 0.8 } },
    },
    bluegill: {
      speeds: { scull: 0.6, cruise: 1.8, sprint: 4 },
      maxSpeed: 6, burstSpeed: 9, turnRadius: 0.2, turnRate: 3.8,
      wave: [
        [0, 0.8, 0.02, 1.0, 1.0, 1.6, 0],
        [0.6, 1.0, 0.03, 1.0, 1.0, 2.2, 0],
        [1.2, 2.2, 0.08, 0.95, 0.7, 2.8, 0.2],
        [1.8, 3.7, 0.17, 0.9, 0.15, 2.8, 0.7],
        [4, 6.7, 0.2, 0.85, 0, 2.8, 1],
        [8, 12, 0.21, 0.8, 0, 2.8, 1],
      ],
      envelope: { exp: 3.0 },
      pectoral: { rest: [0, 0, 0], flap: 12, row: 18, feather: 28, fold: 18, flare: 42, alternate: 0.1 },
      jaw: { gape: 32, protrude: 0.03 },
      actions: { sleep: { style: 'hover' }, jump: { height: 1.0 } },
    },
  },
};
