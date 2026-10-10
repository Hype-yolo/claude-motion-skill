// 用法（可在任意目录运行，脚本会先 cd 到自己所在的 demo/）：
//       node render.mjs stills 1.9 3.1 ...   → stills/t_*.jpg（STILLS_DIR=out/check 改输出目录）
//       node render.mjs events               → events.json
//       node render.mjs video [workers] [只渲这些 worker 号,逗号分隔]  → out/seg_*.mp4 + out/list.txt
import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
import { serve } from './serve.mjs';
import { EXE } from '../../../core/render/browser.mjs';   // PLAYWRIGHT_CHROME 或本机 playwright 缓存里最新的 headless shell
const ARGS = ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--font-render-hinting=none', '--force-color-profile=srgb'];
const FPS = parseInt(process.env.FPS || '60');
const QS = process.env.QS || '';
const mode = process.argv[2];
const { server, port } = await serve(process.cwd());
const URL = `http://127.0.0.1:${port}/index.html${QS}`;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text().slice(0, 300)); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
  return page;
}
if (mode === 'stills') {
  const SD = process.env.STILLS_DIR || 'stills'; fs.mkdirSync(SD, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
  const page = await openPage(browser);
  for (const ts of process.argv.slice(3)) {
    await page.evaluate(t => window.render(t), parseFloat(ts));
    await page.screenshot({ path: `${SD}/t_${ts}.jpg`, type: 'jpeg', quality: 90 });
  }
  await browser.close();
} else if (mode === 'events') {
  const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
  const page = await openPage(browser);
  const ev = await page.evaluate(() => ({ dur: window.DUR, ev: window.EV }));
  fs.writeFileSync('events.json', JSON.stringify(ev));
  console.log('events', ev.ev.length, 'dur', ev.dur);
  await browser.close();
} else if (mode === 'video') {
  const Wk = parseInt(process.argv[3] || '6');
  const only = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
  fs.mkdirSync('out', { recursive: true });
  const DUR = parseFloat(fs.readFileSync('story.js', 'utf8').match(/DUR = ([\d.]+)/)[1]);
  const TOTAL = Math.round(FPS * DUR), per = Math.ceil(TOTAL / Wk), t0 = Date.now();
  await Promise.all([...Array(Wk)].map(async (_, w) => {
    if (only && !only.includes(w)) return;
    const a = w * per, b = Math.min(TOTAL, a + per);
    const br = await chromium.launch({ executablePath: EXE, args: ARGS });
    const page = await openPage(br);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', `out/seg_${w}.mp4`]);
    for (let f = a; f < b; f++) {
      await page.evaluate(t => window.render(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - a) % 120 === 0) console.log(`w${w} ${f - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); await br.close();
  }));
  fs.writeFileSync('out/list.txt', [...Array(Wk)].map((_, w) => `file 'seg_${w}.mp4'`).join('\n'));
  console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
server.close();
