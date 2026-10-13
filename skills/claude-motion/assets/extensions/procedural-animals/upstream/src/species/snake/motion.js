// Snake motion data for the snake engine (schema: src/core/motion/snake.js). Numbers are for the
// reference individual (params.size = 1, total length 1.2 m); the engine scales lengths by size and
// speeds by sqrt(size).
//
// Lateral undulation (Jayne 1986, Hu et al. 2009, Fu et al. 2022): every point follows the
// head's path; 1.5-2.5 waves on the body; wavelength 0.35-0.45 of the total length, amplitude
// 0.06-0.10 of it, shrinking at a slow crawl; cruise 0.1-0.3 m/s, sprint ~0.6-0.8 m/s.
// Strike (Penning et al. 2016): peak head speed ~2.7-3 m/s, ~190 m/s^2, 50-90 ms to the target.
export const motion = {
  maxSpeed: 0.7,
  accel: 0.9,
  decel: 1.6,
  turnRate: 2.2,
  minTurnRadius: 0.1, // x total length
  gears: { crawl: 0.07, slither: 0.24, dash: 0.6 },
  // [name, speed (m/s), wavelength (x TL), amplitude (x TL), head lift (m), head yaw stabilisation 0..1]
  gaits: [
    { name: 'crawl', v: 0, wave: 0.5, amp: 0.028, headLift: 0.012, stab: 0.75 },
    { name: 'crawl', v: 0.1, wave: 0.46, amp: 0.05, headLift: 0.012, stab: 0.7 },
    { name: 'slither', v: 0.16, wave: 0.43, amp: 0.066, headLift: 0.009, stab: 0.65 },
    { name: 'slither', v: 0.35, wave: 0.4, amp: 0.078, headLift: 0.006, stab: 0.6 },
    { name: 'dash', v: 0.45, wave: 0.37, amp: 0.085, headLift: 0.004, stab: 0.55 },
    { name: 'dash', v: 0.8, wave: 0.35, amp: 0.09, headLift: 0.003, stab: 0.5 },
  ],
  body: { neck: 0.12, forebody: 0.3 }, // x TL: neck (raised when looking), strike forebody
  tongue: { rate: 0.7, length: 0.6, flicks: [3, 6], freq: 7.5 },
  breath: { rate: 0.28, roll: 0.03 },
  actions: {
    strike: { reach: 0.33, speed: 2.8, gape: 75, coilHeight: 0.07, rise: 0.12 },
    coil: { pitch: 0.88, speed: 0.34 },
    sit: { raise: 0.13 },
    eat: { swallow: 3.2 },
    drink: { pumps: 4 },
  },
  variants: {
    // heavy-bodied viper: slower, stiffer undulation, big gape, fangs, rattle
    // C. atrox: heavy and slow; slow travel is nearly straight (rectilinear-looking, 1-5 cm/s),
    // a fast escape tops out ~0.35 m/s; the rattle is carried just off the ground while moving
    rattlesnake: {
      maxSpeed: 0.38, gears: { crawl: 0.04, slither: 0.16, dash: 0.34 }, tailCarry: 0.012,
      gaits: [
        { name: 'crawl', v: 0, wave: 0.6, amp: 0.012, headLift: 0.006, stab: 0.85 },
        { name: 'crawl', v: 0.06, wave: 0.55, amp: 0.022, headLift: 0.008, stab: 0.8 },
        { name: 'slither', v: 0.1, wave: 0.46, amp: 0.05, headLift: 0.008, stab: 0.7 },
        { name: 'slither', v: 0.22, wave: 0.42, amp: 0.062, headLift: 0.006, stab: 0.65 },
        { name: 'dash', v: 0.28, wave: 0.4, amp: 0.07, headLift: 0.004, stab: 0.6 },
        { name: 'dash', v: 0.38, wave: 0.38, amp: 0.075, headLift: 0.004, stab: 0.55 },
      ],
      tongue: { length: 0.85, amp: 0.55 }, strike: { gape: 115, reach: 0.36, coilHeight: 0.1 }, rattle: true },
  },
};
