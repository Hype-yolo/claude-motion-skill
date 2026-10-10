// 导出 .srt：node styles/pixel-rpg/demo/tools/subs.mjs → styles/pixel-rpg/pixel-rpg.srt（与烧录对话框同一份 window.SUBS）
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { openDemo, closeServer } from '../../../../core/render/page.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), demo = path.resolve(here, '..');
const { browser, page } = await openDemo(demo);
const subs = (await page.evaluate(() => window.SUBS)).sort((a, b) => a.t0 - b.t0);
const ts = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const srt = subs.map((s, i) => `${i + 1}\n${ts(s.t0)} --> ${ts(s.t1)}\n${s.text}\n`).join('\n');
fs.writeFileSync(path.resolve(demo, '../pixel-rpg.srt'), srt); console.log('srt', subs.length);
await browser.close(); closeServer();
