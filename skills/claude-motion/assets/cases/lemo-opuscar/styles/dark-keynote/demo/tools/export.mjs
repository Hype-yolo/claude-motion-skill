// 导出 events.json（混音）+ out/srt.json（字幕）：node styles/dark-keynote/demo/tools/export.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { openDemo, closeServer } from '../../../../core/render/page.mjs';
const D = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { browser, page } = await openDemo(D);
const r = await page.evaluate(() => ({ dur: window.DUR, ev: window.EV, subs: window.SUBS, echo: window.ECHO_SUB }));
fs.writeFileSync(path.join(D, 'events.json'), JSON.stringify({ dur: r.dur, ev: r.ev }));
fs.mkdirSync(path.join(D, 'out'), { recursive: true });
fs.writeFileSync(path.join(D, 'out/srt.json'), JSON.stringify([...r.subs, r.echo]));
console.log('events', r.ev.length, 'subs', r.subs.length + 1, 'dur', r.dur);
await browser.close(); closeServer();
