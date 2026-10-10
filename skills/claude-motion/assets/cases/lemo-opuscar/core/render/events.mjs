// 导出音效事件：node core/render/events.mjs <demo> [--q 'content=content_alt.json'] [--out <file>] [--size 1920x1080]
// 默认写 <demo>/events.json；换内容时用 --q 把参数传给页面，--out 写到别处，免得覆盖主片的事件表
import fs from 'fs'; import path from 'path';
import { openDemo, closeServer, requireDemo, takeSize } from './page.mjs';
const args = process.argv.slice(2), { w, h } = takeSize(args), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = args[0]; requireDemo(dir);
const Q = opt('--q', ''), out = opt('--out', path.join(dir, 'events.json'));
const { browser, page } = await openDemo(dir, { w, h, q: Q });
const ev = await page.evaluate(() => ({ dur: window.DUR, ev: window.EV || [] }));
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(ev, null, 0));
console.log('events', ev.ev.length, 'dur', ev.dur, '→', out);
await browser.close(); closeServer();
