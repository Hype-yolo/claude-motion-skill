// 本地副本：加 --w/--h（设定表用大画布）。渲静帧：node core/render/still.mjs styles/<slug>/demo <t> [<t> ...] [--range a:b:step] [--q 'k=v&..'] [--prefix t_] [--out dir]
// 以仓库根为静态服务根，页面需暴露 window.READY 和 window.render(t)；页面报错立即退出（非 0）
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { serve } from '../../../../core/render/serve.mjs';
import { EXE, ARGS } from '../../../../core/render/browser.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const args = process.argv.slice(2);
const take = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const out = take('--out'), q = take('--q') || '', prefix = take('--prefix') || 't_', rg = take('--range'), VW = +(take('--w') || 1920), VH = +(take('--h') || 1080);
const [dir, ...times] = args;
if (rg) { const [a, b, st] = rg.split(':').map(Number); for (let x = a; x <= b + 1e-9; x += st) times.push(x.toFixed(2)); }
const outDir = out || path.join(dir, 'stills'); fs.mkdirSync(outDir, { recursive: true });
const { server, port } = await serve(ROOT);   // 单页多帧静图
const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text().slice(0, 300)); });
page.on('pageerror', async e => { console.error('[pageerror]', e.message); await browser.close(); server.close(); process.exit(1); });
await page.goto(`http://127.0.0.1:${port}/${path.relative(ROOT, path.resolve(dir))}/index.html${q ? '?' + q : ''}`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
for (const ts of times) {
  const t0 = Date.now();
  await page.evaluate(t => window.render(t), parseFloat(ts));
  const f = path.join(outDir, `${prefix}${ts}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 92 }); console.log(f, Date.now() - t0 + 'ms');
}
await browser.close(); server.close();
