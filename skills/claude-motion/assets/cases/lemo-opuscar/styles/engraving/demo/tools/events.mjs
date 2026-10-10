// events.json with a content file: node styles/engraving/demo/tools/events.mjs styles/engraving/demo [content.json]
// (core/render/events.mjs takes no query string; this is the same thing with ?content=)
import fs from 'fs'; import path from 'path';
import { openDemo, closeServer } from '../../../../core/render/page.mjs';
const dir = process.argv[2], content = process.argv[3] || 'content.json', work = process.argv[4] || dir;   // optional work folder
const { browser, page } = await openDemo(dir, { q: 'content=' + content });
const ev = await page.evaluate(() => ({ dur: window.DUR, ev: window.EV || [] }));
fs.mkdirSync(work, { recursive: true }); fs.writeFileSync(path.join(work, 'events.json'), JSON.stringify(ev, null, 0));
console.log('events', ev.ev.length, 'dur', ev.dur);
await browser.close(); closeServer();
