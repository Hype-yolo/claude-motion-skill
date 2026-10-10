// 导出字幕时间线（与烧录字幕同一份数据 window.SUBS）：node styles/crayon-book/demo/subs.mjs → subs.json
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { openDemo, closeServer } = await import(path.join(HERE, '../../../core/render/page.mjs'));
const { browser, page } = await openDemo(HERE);
const subs = await page.evaluate(() => window.SUBS.map(s => ({ t0: +s.t0.toFixed(3), t1: +s.t1.toFixed(3), text: s.text })));
fs.writeFileSync(path.join(HERE, 'subs.json'), JSON.stringify(subs, null, 1));
console.log('subs', subs.length);
await browser.close(); closeServer();
