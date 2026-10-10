// Single source of truth for timing: tempo grid, section bounds, and every sync point (picture, music, foley, voice).
// Pure JS (node can import it: tools/dump_timeline.mjs → timeline.json for the Python score / mix / checks).
export const BPM = 116, B = 60 / BPM, BAR = 4 * B;
export const K_BPM = 138, KB = 60 / K_BPM;

// stairwell: 16 beats accelerating 116 → 138 (each beat at its mid-point tempo)
export const STAIR0 = 36 * B;
export const STAIR_BEATS = (() => { const a = []; let t = STAIR0; for (let k = 0; k < 16; k++) { a.push(t); t += 60 / (116 + 22 * (k + .5) / 16); } a.push(t); return a; })();
export const KIT0 = STAIR_BEATS[16];
export const kb = k => KIT0 + k * KB;                 // kitchen / roof-run beat k (138)
export const ROOF0 = kb(12), CLOCK = kb(16);            // roof run starts; tower clock clunks → music stops
export const STRIKE1 = 35.86;                           // first bell = the catch
export const strike = k => STRIKE1 + (k - 1) * B;       // k = 1..12
export const TUTTI = STRIKE1 + 12 * B;                  // the song begins
export const BALL1 = TUTTI + BAR, BALL2 = TUTTI + 2 * BAR, PULL0 = TUTTI + 3 * BAR, FINAL = PULL0 + 2 * BAR;
export const DING = FINAL + B, DOORS0 = FINAL + 2 * B, DOORS1 = FINAL + 3 * B, CARD0 = DOORS1;
export const DUR = +(CARD0 + 4.4).toFixed(3);
export const bt = k => k * B;                           // 116-grid beat from film start (sections T, S, L)

export const SEC = [
  { id: 'T', t0: 0, t1: bt(12), name: 'title' },
  { id: 'S', t0: bt(12), t1: bt(24), name: 'street' },
  { id: 'L', t0: bt(24), t1: bt(36), name: 'lobby' },
  { id: 'C', t0: STAIR0, t1: KIT0, name: 'stairwell' },
  { id: 'K', t0: KIT0, t1: ROOF0, name: 'kitchen' },
  { id: 'R1', t0: ROOF0, t1: CLOCK, name: 'roof run' },
  { id: 'R2', t0: CLOCK, t1: STRIKE1, name: 'throw (silence)' },
  { id: 'R3', t0: STRIKE1, t1: TUTTI, name: 'twelve bells' },
  { id: 'R4', t0: TUTTI, t1: PULL0, name: 'ballroom' },
  { id: 'R5', t0: PULL0, t1: FINAL, name: 'pull-back' },
  { id: 'E', t0: FINAL, t1: DUR, name: 'end' },
];

// Named sync points (seconds). Picture, score, foley and the cue check all read these.
export const T = {
  gold: 0, titleHit: bt(4), archOpen: bt(10), street: bt(12), envelope: bt(20), sealGlint: bt(21),
  wing1: bt(24), wing2: bt(25), press1: bt(28), press2: bt(29), press3: bt(29.5), plaque: bt(30), faceCU: bt(32),
  tick1: bt(33), capFix: bt(34), tick2: bt(34), snare: bt(35), stair: STAIR0,
  zoomOut: STAIR_BEATS[8], zoomIn: STAIR_BEATS[12], vortex: STAIR_BEATS[14],
  kitchen: KIT0, trays: kb(4), capHit: kb(5), capLand: kb(8), whistle: kb(8.5), doors: kb(11), roof: ROOF0, clock: CLOCK,
  windup: CLOCK + .75, release: CLOCK + 1.2, catch: STRIKE1, tutti: TUTTI, ballTop: BALL1, clockForm: BALL2 + 3 * B,
  pull: PULL0, final: FINAL, ding: DING, doors0: DOORS0, doors1: DOORS1, card: CARD0,
};

// Voice lines: start times (subtitle holds are computed in film.js from voices/dur.json)
export const LINES = [
  { id: 'L1', t: bt(12) + .34, who: 'radio', space: 'street' },
  { id: 'L2', t: bt(25) - .06, who: 'radio', space: 'radio' },
  { id: 'B1', t: bt(32) + .06, who: 'boy', space: 'dry' },
  { id: 'L3', t: STAIR0 + .3, who: 'radio', space: 'hall' },
  { id: 'L4', t: STAIR_BEATS[13] + .05, who: 'radio', space: 'radio' },
  { id: 'B2', t: CLOCK + .28, who: 'boy', space: 'wind' },
  { id: 'L5', t: PULL0 + .3, who: 'radio', space: 'live' },
];
