// 导出声音设计用的 cues.json：世界笔画时间、帽子轨迹（速度/声像）、事件
// node styles/urban-sketch/demo/tools/export_cues.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { openDemo, closeServer } from '../../../../core/render/page.mjs';
const demo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { browser, page } = await openDemo(demo);
const r = await page.evaluate(() => ({ strokes: window.STROKES, track: window.TRACK(), ev: window.EV, dur: window.DUR }));
fs.writeFileSync(path.join(demo, 'audio/cues.json'), JSON.stringify(r));
console.log('cues', r.strokes.length, 'strokes', r.track.length, 'track', r.ev.length, 'events');
await browser.close(); closeServer();
