// 用法（在 demo/ 目录下运行）：
//   node render.mjs stills 1.9 3.1 ...   → stills/t_*.png
//   node render.mjs video [workers]      → $OUTDIR/seg_*.mp4 + list.txt（无声分段，交给 mux.sh）
// 语言：LANGQ=ej（默认，英日版）→ 输出 out_ej/；LANGQ=zh（中文版）→ 输出 out/
// 可选：START / END（秒）只渲一段；FPS（默认 60）
import { chromium } from 'playwright-core';
import { EXE as CORE_EXE } from '../../../core/render/browser.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
const EXE = CORE_EXE; // 本机 playwright 缓存里的 headless shell（或 PLAYWRIGHT_CHROME）
const LANGQ = process.env.LANGQ || 'ej';
const URL = 'file://' + path.resolve('index.html') + '?lang=' + LANGQ;
const OUT = process.env.OUTDIR || (LANGQ === 'ej' ? 'out_ej' : 'out');
const FPS = parseInt(process.env.FPS || "60");
const mode = process.argv[2];

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  return page;
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--allow-file-access-from-files'] });
if (mode === 'stills') {
  fs.mkdirSync('stills', { recursive: true });
  const page = await openPage(browser);
  for (const ts of process.argv.slice(3)) {
    await page.evaluate(t => window.render(t), parseFloat(ts));
    await page.screenshot({ path: `stills/t_${ts}.png` });
  }
} else if (mode === 'events') {
  const page = await openPage(browser);
  const ev = await page.evaluate(() => ({ dur: window.DUR, ev: window.EV }));
  fs.writeFileSync('events.json', JSON.stringify(ev, null, 0));
  console.log('events', ev.ev.length, 'dur', ev.dur.toFixed(2));
} else if (mode === 'video') {
  const W = parseInt(process.argv[3] || '6');
  fs.mkdirSync(OUT, { recursive: true });
  const probe = await openPage(browser); const DURV = await probe.evaluate(() => window.DUR); await probe.close();
  const F0 = Math.round(FPS * parseFloat(process.env.START || '0')), F1 = Math.round(FPS * parseFloat(process.env.END || String(DURV)));
  const TOTAL = F1 - F0;
  const per = Math.ceil(TOTAL / W);
  const t0 = Date.now();
  await Promise.all([...Array(W)].map(async (_, w) => {
    const a = F0 + w * per, b = Math.min(F1, a + per);
    const br = await chromium.launch({ executablePath: EXE, args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--allow-file-access-from-files'] });
    const page = await openPage(br);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', `${OUT}/seg_${w}.mp4`]);
    for (let f = a; f < b; f++) {
      await page.evaluate(t => window.render(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 100 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (w === 0 && (f - a) % 30 === 0) console.log(`w0 ${f - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    await br.close();
  }));
  fs.writeFileSync(OUT + '/list.txt', [...Array(W)].map((_, w) => `file 'seg_${w}.mp4'`).join('\n'));
  console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close();
