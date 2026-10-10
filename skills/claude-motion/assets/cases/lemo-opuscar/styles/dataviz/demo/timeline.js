// A Hundred Summers — tempo grid and every timed event. Single source of truth for picture, score, foley and checks.
// 90 BPM, 4/4. k = beat index from 0; t = k * B seconds.
export const BPM = 90, B = 60 / BPM, BAR = 4 * B;
export const T = k => k * B;
export const LIFE0 = 1926, LIFE1 = 2026;

// When each summer of her life lands (beats). Rhythm accelerates: quarter → eighth → sixteenth → thirty-second.
export function yearK(y) {
  if (y <= 1926) return 1;
  if (y <= 1933) return 8 + (y - 1927);                // quarters, k 8–14 (1933 = the sea)
  if (y <= 1958) return 16 + (y - 1934) * .5;          // eighths, k 16–28 (1958 = daughter)
  if (y <= 1998) return 30.25 + (y - 1959) * .25;      // sixteenths, k 30.25–40 (1998 = ceiling break)
  if (y <= 2025) return 43.125 + (y - 1999) * .125;    // thirty-seconds, k 43.125–46.375
  return 48;                                           // 2026, alone after the silence
}
export const lifeYears = () => Array.from({ length: LIFE1 - LIFE0 + 1 }, (_, i) => LIFE0 + i);

// Key beats (see TREATMENT §7 / §8)
export const K = {
  birth: 1, write1926: [1.4, 3.3],
  axis: [4, 5.5], title: [4.2, 5.1], sub: [4.9, 5.7],
  grid: [8.4, 10],
  write1933: [14.25, 15.35], wave: [15.35, 15.85],
  write1958: [28.25, 29.75], heart: [29.75, 30.1],
  break1: 40, startle: [40.0, 40.5], flip: [40.5, 41.0], rescale1: [41, 41.5], write1998: [41.5, 43.0],
  break2: yearK(2024),
  stop: 46.5,                        // everything stops (half a beat early); the only cut
  tap2026: 48, write2026: [48.75, 50.75], pencilExit: [50.9, 52],
  pull: [51, 55], rescale2: [52, 53.5],
  morph: [56, 57], labels: [57.1, 58.6],
  scale: [60, 64], prior: [60.5, 63.375], bracket: [62.4, 63.8],
  hush: [64, 65],
  cell: [65, 66], writeNext: [66, 67.3], pencilOut: [67.35, 68],
  end: [68, 75],
};
export const DUR = T(75);

// Chart geometry (world units). Plot box is fixed; the value range at the top changes (rescale).
export const U = 15;                         // px per year
export const X = y => (y - LIFE0) * U;
export const BOX = { top: -260, bot: 260, vmin: -.9 };
export const BAND = { top: -170, bot: 170 };  // stripes band after the morph
