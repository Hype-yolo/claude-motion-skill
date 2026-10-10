// 导出页面的 window.SUBS → out/subs.json（和画面里的日志栏用同一份时间）
import fs from 'fs'; import path from 'path';
import { openDemo, closeServer } from '../../../../core/render/page.mjs';
const dir = process.argv[2];
const { browser, page } = await openDemo(dir);
const subs = await page.evaluate(() => window.SUBS);
fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
fs.writeFileSync(path.join(dir, 'out/subs.json'), JSON.stringify(subs, null, 1));
console.log('subs', subs.length);
await browser.close(); closeServer();
