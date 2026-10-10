// 用法（可在任意目录运行，路径都相对本脚本所在的 demo/）：
//   node render.mjs stills 1.9 3.1 ... [--dir stills]  → <dir>/t_<秒>.png（默认 stills/）
//   node render.mjs video [workers]                   → out/seg_*.mp4 + out/video_noaudio.mp4（CRF 12 母版）
//   node render.mjs mux [输出.mp4]                    → 母版重编码 CRF 16 + music.wav(-1.6 dB, AAC 256k/48k)
//                                                        默认输出 ../halftone-dossier.mp4（会覆盖成片！）
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const P = (...a) => path.join(DIR, ...a);
// 优先用本机 Playwright 缓存里的 headless shell；找不到就让 playwright-core 自己找（需 npx playwright install chromium-headless-shell）
const CACHED = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const EXE = process.env.CHROME_PATH || (fs.existsSync(CACHED) ? CACHED : undefined);
const URL = 'file://' + P('index.html');
const FPS = 30, DUR = 30, TOTAL = FPS * DUR;
const args = process.argv.slice(2);
const mode = args[0];

if (mode === 'mux') {
  const outFile = path.resolve(args[1] || P('..', 'halftone-dossier.mp4'));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', P('out', 'video_noaudio.mp4'), '-i', P('music.wav'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-af', 'volume=-1.6dB', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', outFile], { stdio: 'inherit' });
  console.log(r.status === 0 ? `mux ok → ${outFile}` : 'mux failed');
  process.exit(r.status ?? 1);
}

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
  const di = args.indexOf('--dir');
  const outDir = di > 0 ? path.resolve(DIR, args[di + 1]) : P('stills');
  const times = args.slice(1).filter((a, i) => !(di > 0 && (i + 1 === di || i + 1 === di + 1)));
  fs.mkdirSync(outDir, { recursive: true });
  const page = await openPage(browser);
  for (const ts of times) {
    const t0 = Date.now();
    await page.evaluate(t => window.render(t), parseFloat(ts));
    await page.screenshot({ path: path.join(outDir, `t_${ts}.png`) });
    console.log(`t=${ts}  ${Date.now() - t0} ms`);
  }
} else if (mode === 'video') {
  const W = parseInt(args[1] || '6');
  fs.mkdirSync(P('out'), { recursive: true });
  const per = Math.ceil(TOTAL / W);
  const t0 = Date.now();
  await Promise.all([...Array(W)].map(async (_, w) => {
    const a = w * per, b = Math.min(TOTAL, a + per);
    const page = await openPage(browser);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', P('out', `seg_${w}.mp4`)]);
    for (let f = a; f < b; f++) {
      await page.evaluate(t => window.render(t), f / FPS);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (w === 0 && (f - a) % 30 === 0) console.log(`w0 ${f - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }));
  fs.writeFileSync(P('out', 'list.txt'), [...Array(W)].map((_, w) => `file 'seg_${w}.mp4'`).join('\n'));
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', P('out', 'list.txt'), '-c', 'copy', P('out', 'video_noaudio.mp4')], { stdio: 'inherit' });
  console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + 's → out/video_noaudio.mp4');
}
await browser.close();
