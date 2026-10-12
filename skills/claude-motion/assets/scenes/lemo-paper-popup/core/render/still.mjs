// 渲静帧：node core/render/still.mjs <demo> <t> [<t> ...] [--range a:b:step] [--q 'k=v&..'] [--prefix t_] [--out dir] [--size 1920x1080]
// <demo> = 含 index.html 的文件夹（例如 styles/<slug>/demo、films/<name>）；页面需暴露 window.READY 和 window.render(t)。
// 页面报错、必需的文件 404 都会立即退出（非 0）；不给时间点会报用法错误
import fs from 'fs'; import path from 'path';
import { openDemo, closeServer, requireDemo, takeSize } from './page.mjs';
const args = process.argv.slice(2);
const take = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const { w, h } = takeSize(args), out = take('--out'), q = take('--q') || '', prefix = take('--prefix') || 't_', rg = take('--range');
const [dir, ...times] = args;
requireDemo(dir);
if (rg) {
  const [a, b, st] = rg.split(':').map(Number);
  if (![a, b, st].every(Number.isFinite) || !(st > 0) || b < a) { console.error(`bad --range "${rg}": use a:b:step with step > 0 (e.g. 0:50:2.5)`); process.exit(2); }
  for (let x = a; x <= b + 1e-9; x += st) times.push(x.toFixed(2));
}
if (!times.length || times.some(t => !Number.isFinite(parseFloat(t)))) { console.error('usage: node core/render/still.mjs <demo> <t> [<t> ...] [--range a:b:step] [--q k=v] [--prefix t_] [--out dir] [--size WxH]'); process.exit(2); }
const outDir = out || path.join(dir, 'stills'); fs.mkdirSync(outDir, { recursive: true });
const { browser, page } = await openDemo(dir, { w, h, q, warnings: true });   // 单页多帧静图
for (const ts of times) {
  const t0 = Date.now();
  await page.evaluate(t => window.render(t), parseFloat(ts));
  const f = path.join(outDir, `${prefix}${ts}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 92 }); console.log(f, Date.now() - t0 + 'ms');
}
await browser.close(); closeServer();
