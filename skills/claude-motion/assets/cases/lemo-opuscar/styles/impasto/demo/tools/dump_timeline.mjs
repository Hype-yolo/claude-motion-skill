// export the music grid for the Python score/mix
import fs from 'fs';
const m = await import('../timeline.js');
fs.writeFileSync(new URL('../out/timeline.json', import.meta.url), JSON.stringify({ T: m.T, A: m.A, B: m.B, BEAT_A: m.BEAT_A, BEAT_B: m.BEAT_B, NA: m.NA, NB: m.NB, POPS: m.POPS, CHORDS_B: m.CHORDS_B, DUR: m.DUR, TB: Array.from({ length: 17 }, (_, i) => m.TB(i)) }, null, 1));
console.log('ok');
