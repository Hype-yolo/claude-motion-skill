// 调试：逐时间点测 render 耗时
import { chromium } from 'playwright-core';
import { serve } from '../../../../core/render/serve.mjs';
import { EXE, ARGS } from '../../../../core/render/browser.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { server, port } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => console.log('[page]', m.text().slice(0, 300)));
page.on('pageerror', e => console.log('[err]', e.message));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/styles/shadow-puppet/demo/index.html?t=0.5`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
console.log('ready', Date.now() - t0);
for (const t of process.argv.slice(2)) { const ms = await page.evaluate(t => { const a = performance.now(); window.render(t); return performance.now() - a; }, +t); console.log(t, ms.toFixed(0)); const b = Date.now(); try { await page.screenshot({ path: `styles/shadow-puppet/demo/out/r1/p_${t}.jpg`, type: 'jpeg', timeout: 20000 }); console.log('  shot', Date.now() - b); } catch (e) { console.log('  shot FAIL'); } }
await browser.close(); server.close();
