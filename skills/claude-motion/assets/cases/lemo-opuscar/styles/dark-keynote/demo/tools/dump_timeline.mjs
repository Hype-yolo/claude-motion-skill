// 速度网格 + 音符表 → timeline.json（配乐 / 混音 / 自检共用）
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import * as T from '../timeline.js';
const D = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = { bpm: T.BPM, beat: T.BEAT, bar: T.BAR, s16: T.S16, dur: T.DUR, P: T.P, K: T.K,
  voice1: T.voice1(), voice2: T.voice2(), voice3: T.voice3(), voiceClean: T.voiceClean() };
fs.writeFileSync(path.join(D, 'timeline.json'), JSON.stringify(out, null, 1));
console.log('timeline.json', out.voice1.length, out.voice2.length, out.voice3.length, out.voiceClean.length);
