// 打开 demo/index.html（静态服务根 = 仓库根，页面可引用 /node_modules/three、/core/assets/...），等待 window.READY
import { chromium } from 'playwright-core';
import path from 'path'; import { fileURLToPath } from 'url';
import { serve } from './serve.mjs';
import { EXE, ARGS } from './browser.mjs';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');          // demo 目录
export const REPO = path.resolve(ROOT, '../../..');                                                  // 仓库根（静态服务根）
export const PAGE = '/' + path.relative(REPO, ROOT).split(path.sep).map(encodeURIComponent).join('/') + '/index.html';
let srv = null;
export async function server() { if (!srv) srv = await serve(REPO); return srv; }
export async function openPage(q = '') {
  const { port } = await server();
  const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text().slice(0, 400)); else if (process.env.LOG) console.log('[log]', m.text().slice(0, 400)); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}${PAGE}${q}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
  return { browser, page };
}
export function closeServer() { if (srv) srv.server.close(); }
