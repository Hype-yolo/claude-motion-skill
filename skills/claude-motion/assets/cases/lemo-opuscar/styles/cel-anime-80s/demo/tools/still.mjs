// core/render/still.mjs 的本地副本，多了 --q（页面查询串，如 test=side&raw=1）和 --prefix
// 用法：node styles/cel-anime-80s/demo/tools/still.mjs styles/cel-anime-80s/demo 1.5 3 --q test=side --out dir
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { serve } from '../../../../core/render/serve.mjs';
import { EXE, ARGS } from '../../../../core/render/browser.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const args = process.argv.slice(2);
const take = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const out = take('--out'), q = take('--q') || '', prefix = take('--prefix') || 't_';
const rg = take('--range');   // a:b:step
const [dir, ...times] = args;
if (rg) { const [a, b, st] = rg.split(':').map(Number); for (let x = a; x <= b + 1e-9; x += st) times.push(x.toFixed(2)); }
const outDir = out || path.join(dir, 'stills'); fs.mkdirSync(outDir, { recursive: true });
const { server, port } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text().slice(0, 300)); });
page.on('pageerror', async e => { console.error('[pageerror]', e.message); process.exit(1); });
await page.goto(`http://127.0.0.1:${port}/${path.relative(ROOT, path.resolve(dir))}/index.html?${q}`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
for (const ts of times) {
  const t0 = Date.now();
  await page.evaluate(t => window.render(t), parseFloat(ts));
  const f = path.join(outDir, `${prefix}${ts}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 90 }); console.log(f, Date.now() - t0 + 'ms');
}
await browser.close(); server.close();
