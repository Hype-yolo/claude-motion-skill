// 《送别》 arrangement (melody: J. P. Ordway, 1851 — public domain). C major.
// Story timing is derived from the same bar map so picture and sound stay locked.
const BASE = 60 / 72;           // beat at 72 bpm
const NB = 17;                  // bar 0 = intro, bars 1..16 = the tune
// ritardando over bars 13-16
const beatDur = bar => bar < 13 ? BASE : BASE * (1 + 0.07 * (bar - 12));
const barStart = [0];
for (let b = 0; b <= NB + 2; b++) barStart.push(barStart[b] + 4 * beatDur(b));
const T = (bar, beat = 1) => barStart[bar] + (beat - 1) * beatDur(bar);

const DEG = { 1: 72, 2: 74, 3: 76, 4: 77, 5: 79, 6: 81, 7: 83, "1'": 84, '7,': 71 };
// melody: [degree, beats]
const MEL = {
  1: [[5, 1], [3, .5], [5, .5], ["1'", 2]],
  2: [[6, 1], ["1'", 1], [5, 2]],
  3: [[5, 1], [1, .5], [2, .5], [3, 1], [2, .5], [1, .5]],
  4: [[2, 4]],
  5: [[5, 1], [3, .5], [5, .5], ["1'", 1.5], [7, .5]],
  6: [[6, 1], ["1'", 1], [5, 2]],
  7: [[5, 1], [2, .5], [3, .5], [4, 1.5], ['7,', .5]],
  8: [[1, 4]],
  9: [[6, 1], ["1'", 1], ["1'", 2]],
  10: [[7, 1], [6, .5], [7, .5], ["1'", 2]],
  11: [[6, .5], [7, .5], ["1'", 1], [6, .5], [5, .5], [3, .5], [1, .5]],
  12: [[2, 4]],
};
MEL[13] = MEL[5]; MEL[14] = MEL[6]; MEL[15] = MEL[7]; MEL[16] = MEL[8];

// harmony per half bar (root, third, fifth as MIDI in the left-hand register)
const CH = {
  C: [48, 55, 64], F: [41, 53, 57], G: [43, 50, 59], G7: [43, 53, 59], Am: [45, 52, 60], Em: [40, 52, 55],
};
const HARM = {
  0: ['C', 'C'], 1: ['C', 'C'], 2: ['F', 'C'], 3: ['C', 'Am'], 4: ['G', 'G7'],
  5: ['C', 'C'], 6: ['F', 'C'], 7: ['G', 'G7'], 8: ['C', 'C'],
  9: ['F', 'F'], 10: ['G', 'C'], 11: ['F', 'C'], 12: ['G', 'G7'],
  13: ['C', 'C'], 14: ['F', 'C'], 15: ['G', 'G7'], 16: ['C', 'C'],
};

const notes = [];
const add = (who, t, m, dur, v) => notes.push({ who, t, m, dur, v });
const hum = (seed) => { let x = Math.sin(seed * 91.7) * 43758.5; return (x - Math.floor(x)) - 0.5; };

for (let bar = 0; bar <= 16; bar++) {
  const bd = beatDur(bar);
  // left hand
  HARM[bar].forEach((c, h) => {
    const [r, f, x] = CH[c];
    const t0 = T(bar, 1 + h * 2);
    if (bar <= 12) {
      const v = bar >= 9 ? 0.42 : 0.3;
      [r, f, x, f].forEach((m, i) => add('snow-l', t0 + i * bd * 0.5 + hum(bar * 8 + h * 4 + i) * 0.012, m, bd * 0.5, v + (i === 0 ? 0.08 : 0)));
      if (bar >= 9 && h === 0) add('snow-l', t0, r - 12, bd * 2, 0.38); // deeper bass for the climax
    } else if (bar < 16) {
      // the snowman is small now: only soft open fifths
      add('snow-l', t0, r, bd * 2, 0.26);
      add('snow-l', t0 + 0.02, x - 12 >= r ? x - 12 : f, bd * 2, 0.2);
    }
  });
  if (!MEL[bar]) continue;
  let beat = 1;
  for (const [d, len] of MEL[bar]) {
    const m = DEG[d];
    const t = T(bar, beat) + hum(bar * 16 + beat * 2) * 0.01;
    if (bar <= 12) {
      const v = bar >= 9 ? 0.62 : 0.5;
      add('snow-r', t, m, len * bd * 0.95, v + (beat === 1 ? 0.05 : 0));
      if (bar >= 9) add('snow-r', t + 0.008, m - 12, len * bd * 0.95, v - 0.12); // octaves
    } else {
      // the cat plays the last phrase: one paw, a little hesitant
      const late = bar === 16 ? 0.25 : 0.03 + Math.abs(hum(bar * 7 + beat)) * 0.06;
      add('cat', t + late, m, len * bd * 0.9, bar === 16 ? 0.4 : 0.46);
    }
    beat += len;
  }
}
// final: snowman's last low C under the cat's note
const FINAL = T(16, 1);
add('snow-l', FINAL + 0.25, 36 + 12, 6, 0.3);
add('snow-l', FINAL + 0.27, 43 + 12, 6, 0.22);

// epilogue: four snowflakes land on the keys — 5 3 5 1' (G5 E5 G5 C6)
const END_T = FINAL + 4 * beatDur(16) + 1.2;
const FLAKES = [0, 1.25, 2.2, 3.6].map((d, i) => ({ t: END_T + 2.2 + d, m: [79, 76, 79, 84][i] }));
FLAKES.forEach(f => add('flake', f.t, f.m, 3, 0.22));
const LEN = FLAKES[3].t + 6.5;

const pedal = [];
for (let bar = 0; bar <= 12; bar++) for (let h = 0; h < 2; h++) pedal.push([T(bar, 1 + h * 2) + 0.03, T(bar, 3 + h * 2) - 0.02]);
for (let bar = 13; bar <= 15; bar++) pedal.push([T(bar, 1) + 0.03, T(bar + 1, 1) - 0.02]);
pedal.push([FINAL + 0.03, END_T + 1.5]);
pedal.push([FLAKES[0].t - 0.2, LEN]);

notes.sort((a, b) => a.t - b.t);
module.exports = { notes, pedal, T, beatDur, barStart, FINAL, END_T, FLAKES, LEN };
