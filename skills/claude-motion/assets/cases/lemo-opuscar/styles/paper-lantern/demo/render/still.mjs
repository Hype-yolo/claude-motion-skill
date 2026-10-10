// 渲静帧：node render/still.mjs <t> [<t> ...] [--out dir] [--q ?ssaa=1]
import fs from 'fs'; import path from 'path';
import { openPage, closeServer, ROOT } from './page.mjs';
const args = process.argv.slice(2), take = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const out = take('--out') || path.join(ROOT, 'stills'), q = take('--q') || '';
fs.mkdirSync(out, { recursive: true });
const { browser, page } = await openPage(q);
for (const ts of args) {
  const t0 = Date.now();
  await page.evaluate(t => window.render(t), parseFloat(ts));
  const f = path.join(out, `t_${ts}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 90 }); console.log(f, Date.now() - t0 + 'ms');
}
await browser.close(); closeServer();
