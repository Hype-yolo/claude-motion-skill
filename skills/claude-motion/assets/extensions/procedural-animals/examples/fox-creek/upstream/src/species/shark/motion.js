// Shark motion data for the swimmer engine (schema: src/core/motion/swimmer.js). Speeds in body
// lengths per second (BL/s), so one table serves every size; the blacktip overrides in `variants`.
//
// White shark (lamnid, thunniform): stiff anterior body (envelope u^2.5), long body wave, lunate tail
// that stays a flat plate. Cruise 0.2-0.25 TL/s for adults (0.8-1 m/s), transit ~0.5 TL/s, bursts to
// ~1.5-2 TL/s (Spurgeon 2022, Semmens 2019); tail-beat f ~ 0.25 + 1.6 U/L Hz (research fit to 0.4-0.5
// Hz at cruise, 0.83-1.67 Hz in the breach ascent), amplitude ~0.18 TL peak-to-peak.
// Blacktip (carcharhinid, carangiform): U = 0.75 +- 0.18 TL/s at f = 0.82 +- 0.24 Hz, tail amplitude
// 0.24 TL, body wave over the rear half (Porter 2020, C. limbatus); head yaw noticeably.
// Both are obligate ram ventilators: minSpeed keeps them patrolling in wide circles when told to stop;
// rest postures keep swimming. Wave rows: [v, f Hz, amp p-p / L, lambda / L, pectoral activity,
// pectoral beat Hz, pectoral fold].
export const motion = {
  speeds: { patrol: 0.2, cruise: 0.35, sprint: 1.0 },
  minSpeed: 0.15, maxSpeed: 1.3, burstSpeed: 2.0, accel: 0.9, decel: 0.25, turnRate: 0.8, turnRadius: 0.9,
  patrolRadius: 3.5,
  wave: [
    [0, 0.3, 0.1, 1.35, 0, 1, 0],
    [0.2, 0.55, 0.15, 1.3, 0, 1, 0],
    [0.4, 0.85, 0.17, 1.25, 0, 1, 0],
    [0.8, 1.45, 0.18, 1.2, 0, 1, 0.2],
    [1.3, 1.9, 0.19, 1.15, 0, 1, 0.45],
    [2.0, 2.4, 0.2, 1.1, 0, 1, 0.7],
  ],
  envelope: { pow: 2.5 },
  flex: [0.3, 0.95], caudalStiff: 0.9, bend: 0.45, cBend: 1.1, bank: 0.45, bankGain: 1.4, pitchMax: 0.6, hover: 0.08,
  clearance: 0.12, cruiseDepth: 0.8,
  strandRoll: 0.25, // stranded on dry ground: on its belly (core default 1.3, a bony fish on its side)
  // stiff hydrofoil pectorals: no sculling; pressed a little toward the body at speed, depressed
  // (flared) when braking and on the inside of turns
  pectoral: { rest: [0, 0, 0], flap: 0, row: 0, feather: 0, fold: 7, flare: 30, alternate: 0, stiff: 1 },
  pelvic: { rest: 0, spread: 0, fold: 3 },
  breath: { rate: 0.4, operculum: 0, mouth: 0.1, ram: 0.2, slits: true },
  jaw: { gape: 50, protrude: 0.016, protrudeDir: [0, -0.8, 0.6] },
  actions: {
    burst: { turn: 70, coast: 1.4 },
    jump: { height: 0.55, bite: true, roll: 1.3 },
    attack: { headLift: 0.32, shake: 2, eye: 'roll', lunge: 1.2 },
    eat: { style: 'tear', headLift: 0.25, shake: 3, eye: 'roll' },
    drink: { reach: 0 },
    sleep: { style: 'hover' },
    death: { roll: 1.5708 },
  },
  variants: {
    white: {},
    blacktip: {
      speeds: { patrol: 0.4, cruise: 0.75, sprint: 2.0 },
      minSpeed: 0.3, maxSpeed: 2.6, burstSpeed: 4.0, accel: 2.5, decel: 0.7, turnRate: 2.0, turnRadius: 0.35,
      patrolRadius: 2.5,
      wave: [
        [0, 0.5, 0.12, 1.0, 0, 1, 0],
        [0.4, 0.66, 0.18, 1.0, 0, 1, 0],
        [0.75, 0.85, 0.22, 0.95, 0, 1, 0],
        [1.5, 1.4, 0.24, 0.9, 0, 1, 0.2],
        [2.5, 2.1, 0.24, 0.85, 0, 1, 0.45],
        [4.0, 3.0, 0.25, 0.8, 0, 1, 0.7],
      ],
      envelope: { pow: 1.6, head: 0.3 },
      flex: [0.2, 0.95], caudalStiff: 0.6, bend: 0.9, cBend: 1.8, bank: 0.5, bankGain: 1.0,
      jaw: { gape: 44, protrude: 0.012, protrudeDir: [0, -0.8, 0.6] },
      actions: {
        jump: { height: 0.35, bite: false, roll: 0 },
        attack: { headLift: 0.25, shake: 3, eye: 'nictitate', lunge: 1.0 },
        eat: { style: 'tear', headLift: 0.2, shake: 3, eye: 'nictitate' },
        death: { roll: 2.7 },
      },
    },
  },
};
