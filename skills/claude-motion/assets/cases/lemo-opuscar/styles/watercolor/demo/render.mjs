// 用法（任意目录均可运行，脚本会先 chdir 到 demo/）：
//   node render.mjs stills 1.9 3.1 ...   → stills/t_*.png（OUT=dir 可改输出目录）
//   node render.mjs events               → events.json
//   node render.mjs video [workers]      → out/seg_<w>.mp4 + out/list.txt（再跑 sh mux.sh 合成 ../watercolor.mp4）
//   node render.mjs part t0 t1 out.mp4   → 只渲 [t0,t1) 一段（单 worker，局部返修用）
import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EXE as CORE_EXE } from '../../../core/render/browser.mjs';
const STILLS_DIR = path.resolve(process.env.OUT || path.join(path.dirname(fileURLToPath(import.meta.url)), 'stills'));
const INVOKE_CWD = process.cwd();
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
// 无头 Chrome：PLAYWRIGHT_CHROME > core/render/browser.mjs 自动查找（原项目写死 chromium_headless_shell-1228）
const EXE = CORE_EXE;
const URL = 'file://' + path.resolve('index.html');
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

const browser = await chromium.launch({ executablePath: EXE, args: ['--font-render-hinting=none', '--force-color-profile=srgb'] });
if (mode === 'stills') {
  const dir = STILLS_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const page = await openPage(browser);
  for (const ts of process.argv.slice(3)) {
    await page.evaluate(t => window.render(t), parseFloat(ts));
    await page.screenshot({ path: `${dir}/t_${ts}.png` });
  }
} else if (mode === 'events') {
  const page = await openPage(browser);
  const ev = await page.evaluate(() => ({ dur: window.DUR, ev: window.EV }));
  fs.writeFileSync('events.json', JSON.stringify(ev, null, 0));
  console.log('events', ev.ev.length, 'dur', ev.dur.toFixed(2));
} else if (mode === 'video') {
  const W = parseInt(process.argv[3] || '6');
  fs.mkdirSync('out', { recursive: true });
  const probe = await openPage(browser); const TOTAL = Math.round(FPS * await probe.evaluate(() => window.DUR)); await probe.close();
  const per = Math.ceil(TOTAL / W);
  const t0 = Date.now();
  await Promise.all([...Array(W)].map(async (_, w) => {
    const a = w * per, b = Math.min(TOTAL, a + per);
    const br = await chromium.launch({ executablePath: EXE, args: ['--font-render-hinting=none', '--force-color-profile=srgb'] });
    const page = await openPage(br);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', `out/seg_${w}.mp4`]);
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
  fs.writeFileSync('out/list.txt', [...Array(W)].map((_, w) => `file 'seg_${w}.mp4'`).join('\n'));
  console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
} else if (mode === 'part') {
  // 收录时新增：只渲一段（单 worker），编码参数与 video 模式相同。用于只重渲片尾等局部返修。
  // node render.mjs part <t0> <t1> <out.mp4>   → 帧 [round(t0*FPS), round(t1*FPS))
  const a = Math.round(parseFloat(process.argv[3]) * FPS), b = Math.round(parseFloat(process.argv[4]) * FPS);
  const outF = path.resolve(INVOKE_CWD, process.argv[5] || `out/part_${process.argv[3]}.mp4`);
  const page = await openPage(browser), t0 = Date.now();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', outF]);
  for (let f = a; f < b; f++) {
    await page.evaluate(t => window.render(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 100 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  const s = (Date.now() - t0) / 1000;
  console.log('part', b - a, 'frames', s.toFixed(1) + 's', (s / (b - a) * 1000).toFixed(0) + ' ms/frame', outF);
}
await browser.close();
