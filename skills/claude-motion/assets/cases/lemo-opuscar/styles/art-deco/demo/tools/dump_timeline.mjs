// timeline.js → timeline.json (for Python: score / mix / cuecheck)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tl = await import(path.join(D, 'timeline.js'));
const out = { BPM: tl.BPM, B: tl.B, BAR: tl.BAR, K_BPM: tl.K_BPM, STAIR_BEATS: tl.STAIR_BEATS, KIT0: tl.KIT0, STRIKES: Array.from({ length: 12 }, (_, i) => tl.strike(i + 1)), DUR: tl.DUR, SEC: tl.SEC, T: tl.T, LINES: tl.LINES };
fs.writeFileSync(path.join(D, 'timeline.json'), JSON.stringify(out, null, 1));
console.log('timeline.json', out.DUR, 's');
