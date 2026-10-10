// 导出字幕：node styles/scifi-toon/demo/srt.mjs → ../scifi-toon.srt（与烧录字幕同一份 window.SUBS）
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { openDemo, closeServer } from '../../../core/render/page.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const { browser, page } = await openDemo(dir);
const subs = await page.evaluate(() => window.SUBS);
const ts = t => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const who = { VASK: 'VASK', GARY: 'GARY', COFFEE: 'COFFEE' };
fs.writeFileSync(path.join(dir, '../scifi-toon.srt'), subs.map((s, i) => `${i + 1}\n${ts(s.t0)} --> ${ts(s.t1)}\n${who[s.who]}: ${s.text}\n`).join('\n'));
console.log('srt', subs.length); await browser.close(); closeServer();
