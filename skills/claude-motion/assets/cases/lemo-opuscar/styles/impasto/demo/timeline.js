// Music grid = source of truth for picture and sound.
// Part A: solo cello, D minor, 3/4 @ 80 BPM (the grey world).
// Part B: street waltz (musette), D major, 3/4 @ 132 BPM (colour).
export const A = { t0: 0.4, bpm: 80, beats: 3 };
export const B = { t0: 15.3, bpm: 132, beats: 3 };        // B bar 0 = the umbrella POP (pickup bar)
const beat = g => 60 / g.bpm;
export const at = (g, bar, b = 1) => g.t0 + ((bar - (g === A ? 1 : 0)) * g.beats + (b - 1)) * beat(g);
export const TA = (bar, b = 1) => at(A, bar, b);           // TA(1) = 0.4
export const TB = (bar, b = 1) => at(B, bar, b);           // TB(0) = 15.3 (pop), TB(1) = 16.66
export const BEAT_A = beat(A), BEAT_B = beat(B);

export const T = {
  hook: TA(1),            // first bow stroke (ECU)
  cutWide: TA(2),         // 2.65  cut to grey square
  title: TA(2, 2),        // title painted in
  titleOut: TA(3, 3),
  cutMed: TA(4),          // 7.15  medium: the cellist, nobody stops
  stop: TA(5, 2),         // 10.15 he stops mid-phrase (unresolved E)
  headDown: TA(5, 3),
  steps: [11.5, 11.95],   // two small footsteps heard in the silence (J-cut)
  splash: TA(6, 2),       // 12.4  boot lands in the puddle = first sound after silence
  pop: TB(0),             // 15.3  umbrella opens: the first colour
  react: TB(1),           // 16.66 cut to cellist: he looks up
  bowIn: TB(2),           // 18.03 cello enters with the waltz
  cutStreet: TB(3),       // 19.39 wide street: umbrellas pop colour, one per beat
  cutTop: TB(6),          // 23.48 overhead: the umbrella dance paints the square
  gp: TB(11, 3),          // 31.21 grand pause
  chord: TB(12),          // 31.66 final chord: rain stops, colour floods the square, sun
  last: TB(15),           // 35.75 last pizz
  end: TB(15) + 3.9,      // end card out
};
export const DUR = T.end;

// ---- melodies [bar, beat, beats, pitch]  (the bow changes direction on every note)
// Part A: alone, D minor; the phrase breaks off on an unresolved E.
export const MEL_A = [
  [1, 1, 3, 'D3'],
  [2, 1, 1, 'F3'], [2, 2, 1, 'A3'], [2, 3, 1, 'D4'],
  [3, 1, 2, 'C#4'], [3, 3, 1, 'A3'],
  [4, 1, 1, 'Bb3'], [4, 2, 1, 'A3'], [4, 3, 1, 'G3'],
  [5, 1, 1, 'F3'], [5, 2, .4, 'E3'],
];
// Part B: the waltz, D major. Cello melody enters in bar 2.
export const MEL_B = [
  [2, 1, 2, 'F#3'], [2, 3, 1, 'A3'],
  [3, 1, 2, 'D4'], [3, 3, 1, 'B3'],
  [4, 1, 1, 'A3'], [4, 2, 1, 'G3'], [4, 3, 1, 'E3'],
  [5, 1, 2, 'F#3'], [5, 3, 1, 'D3'],
  [6, 1, 1, 'B3'], [6, 2, 1, 'C#4'], [6, 3, 1, 'D4'],
  [7, 1, 2, 'E4'], [7, 3, 1, 'D4'],
  [8, 1, 1, 'C#4'], [8, 2, 1, 'B3'], [8, 3, 1, 'A3'],
  [9, 1, 2, 'F#4'], [9, 3, 1, 'E4'],
  [10, 1, 1, 'D4'], [10, 2, 1, 'B3'], [10, 3, 1, 'G3'],
  [11, 1, 1, 'A3'], [11, 2, 1, 'C#4'],
  [12, 1, 3, 'D4'],
  [13, 1, 1, 'F#3'], [13, 2, 2, 'E3'],
];
export const CHORDS_B = { 1: 'D', 2: 'D', 3: 'G', 4: 'A7', 5: 'D', 6: 'Bm', 7: 'G', 8: 'A7', 9: 'D', 10: 'G', 11: 'A7', 12: 'D', 13: 'G', 14: 'A7', 15: 'D' };
// the nine umbrellas that pop into colour, one per beat (bars 3-5), each a glockenspiel note
export const POPS = [[3, 1, 'G5'], [3, 2, 'B5'], [3, 3, 'D6'], [4, 1, 'A5'], [4, 2, 'C#6'], [4, 3, 'E6'], [5, 1, 'D6'], [5, 2, 'F#6'], [5, 3, 'A6']].map(([b, bt, p]) => ({ t: TB(b, bt), pitch: p }));
export const noteTimes = (mel, g) => mel.map(([b, bt, n, p]) => ({ t: at(g, b, bt), d: n * 60 / g.bpm, pitch: p }));
export const NA = noteTimes(MEL_A, A), NB = noteTimes(MEL_B, B);
// bow position from a note list: alternate down/up bows, long notes use more bow
export function bowPos(notes, t, p0 = .15) {
  let p = p0, dir = 1;
  for (const n of notes) {
    if (t < n.t) break;
    const amt = Math.min(.8, .22 + .2 * n.d / (60 / 132) * .5 + n.d * .12);
    const k = Math.min(1, (t - n.t) / n.d), e = k * (2 - k);
    const target = Math.max(.04, Math.min(.96, p + dir * amt));
    if (t < n.t + n.d) return p + (target - p) * e;
    p = target; dir = -dir;
  }
  return p;
}
