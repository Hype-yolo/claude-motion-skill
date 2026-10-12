// 打开 demo 页面（仓库根为静态服务根；库外的片子工程挂在 /@film/ 下），等待 window.READY
// 出错要大声：页面里的 JS 报错、脚本（<script>、模块 import，resourceType 为 script）或页面本身（document）加载失败都会立即退出（非 0）。
// 其它类型（fetch / xhr / 图片 / 字体…）404 只打印一行警告：很多 demo 会 fetch 可选的 voices/dur.json，没有就用默认值
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { serve, pageURL } from './serve.mjs';
import { EXE, ARGS, warnIfSoftwareGL } from './browser.mjs';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let srv = null;
export async function server() { if (!srv) srv = await serve(ROOT); return srv; }
// 每个入口脚本在建任何输出目录之前先调它
export function requireDemo(dir) {
  if (!dir || dir.startsWith('--')) { console.error('usage: <demo> is the folder that holds index.html (see core/README.md)'); process.exit(2); }
  if (!fs.existsSync(path.join(dir, 'index.html'))) { console.error(`no index.html in "${dir}": the demo folder is wrong or the page isn't there yet`); process.exit(2); }
}
// --size WxH（默认 1920x1080）：从 args 里取走这一对，返回 { w, h }。宽高须为偶数（H.264 yuv420p 的要求），16–8192
export function takeSize(args) {
  const i = args.indexOf('--size'); if (i < 0) return { w: 1920, h: 1080 };
  const v = args.splice(i, 2)[1] || '', m = /^(\d+)x(\d+)$/.exec(v), w = m && +m[1], h = m && +m[2];
  if (!m || [w, h].some(n => n < 16 || n > 8192 || n % 2)) { console.error(`bad --size "${v}": use WxH with even numbers from 16 to 8192, e.g. 1080x1920`); process.exit(2); }
  return { w, h };
}
const warned = new Set();   // 整个进程里每个可选文件只警告一次（video.mjs 会开好几个页面）
const FATAL = new Set(['script', 'document']);   // 页面必须有的东西；模块 import 的类型也是 script
export async function openDemo(dir, { w = 1920, h = 1080, q = '', warnings = false } = {}) {
  requireDemo(dir);
  const { port } = await server();
  const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const log = [];   // 最近的报错，READY 迟迟不来时一起打印
  const note = s => { log.push(s); if (log.length > 8) log.shift(); console.error(s); };
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && /^Failed to load resource/.test(t)) return;   // 由下面的 response 事件带 URL 打印
    if (m.type() === 'error' || (warnings && m.type() === 'warning')) note('[page] ' + t.slice(0, 300));
  });
  page.on('pageerror', e => { console.error('[pageerror]', e.message); process.exit(1); });   // 渲染中报错就停，免得产出坏片
  page.on('response', r => {
    if (r.status() < 400) return;
    const u = r.url(), p = new URL(u).pathname, type = r.request().resourceType();
    if (p === '/favicon.ico') return;
    if (FATAL.has(type)) {
      note(`[page] ${r.status()} ${u}`);
      console.error(`the page needs ${p} (a ${type}) but the server answered ${r.status()}. Check the path: pages use absolute URLs like /core/lib.js (see core/README.md)`); process.exit(1);
    }
    if (!warned.has(u)) { warned.add(u); note(`[page] optional file missing: ${u} (${r.status()}, requested by ${type === 'fetch' || type === 'xhr' ? 'fetch/xhr' : type}; fine if the page has a fallback)`); }
  });
  page.on('requestfailed', r => { if (!/favicon/.test(r.url()) && r.failure()?.errorText !== 'net::ERR_ABORTED') note(`[page] request failed ${r.url()} (${r.failure()?.errorText})`); });
  await page.goto(pageURL(ROOT, port, dir) + (q ? '?' + q : ''));
  const hint = setTimeout(() => {
    console.error(`still waiting for window.READY after 20 s. The page has to set window.READY = true once fonts and images are loaded.\n` +
      (log.length ? '  problems seen so far:\n    ' + log.join('\n    ') + '\n' : '  no console errors so far: is the <script> closed, does it reach the line that sets window.READY?\n') +
      `  debug: node core/render/still.mjs ${dir} 0, or open the page in a normal browser (the tools serve the library root on 127.0.0.1)`);
  }, 20000);
  const t0 = Date.now();
  try { await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 }); }
  catch (e) { console.error(`window.READY never became true (waited ${((Date.now() - t0) / 1000).toFixed(0)} s, limit 180 s): ${e.message.split('\n')[0]}`); process.exit(1); }
  finally { clearTimeout(hint); }
  await warnIfSoftwareGL(page);
  return { browser, page };
}
export function closeServer() { if (srv) srv.server.close(); }
