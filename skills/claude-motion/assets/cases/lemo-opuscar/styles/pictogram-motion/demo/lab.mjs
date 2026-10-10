// 用法：node lab.mjs out.png "p=sprint,hurdles&n=8&beats=4"
//       node lab.mjs out.png "pattern=1"   （图案检查）
import { chromium } from 'playwright-core';
import path from 'path';
import { EXE } from '../../../core/render/browser.mjs';
// 封面：node lab.mjs stills/cover_ej.png "lang=ej" cover.html   （cover34.html = 3:4 竖版）
const [out, qs = '', page_ = 'lab.html'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.error('[pageerror]', e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text())) console.error('[page]', m.text()); });
await p.goto('file://' + path.resolve(page_) + '?' + qs);
await p.waitForFunction(() => window.READY === true, null, { timeout: 30000 });
const sz = await p.evaluate(() => { const c = document.querySelector('canvas'); return [c.width, c.height]; });
await p.setViewportSize({ width: sz[0], height: sz[1] });
await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await p.screenshot({ path: out, clip: { x: 0, y: 0, width: sz[0], height: sz[1] } });
await b.close();
console.log('ok', out);
