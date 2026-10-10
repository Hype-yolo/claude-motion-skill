// 打印时间线（可换内容）：node styles/silkscreen-poster/demo/tools/timeline.mjs [content_alt.json]
import { openDemo, closeServer } from '../../../../core/render/page.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = process.argv[2];
const { browser, page } = await openDemo(path.relative(process.cwd(), dir), { q: c ? 'content=' + c : '' });
const r = await page.evaluate(() => ({ dur: window.DUR, tl: window.TL }));
console.log('dur', r.dur.toFixed(2)); r.tl.forEach(s => console.log(s.kind.padEnd(7), s.t0.toFixed(2), '→', s.t1.toFixed(2)));
await browser.close(); closeServer();
