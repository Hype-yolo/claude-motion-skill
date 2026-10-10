// render.mjs: renders studio.html in headless Chrome. Length and fps come from the page (PROJECT in src/config.js).
//
//   Look at it (open the images with your image viewer / Read tool):
//     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
//     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
//     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
//         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
//     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
//   Make the video:
//     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
//                                                                                              only frames of shots whose files changed are redrawn)
//     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
//   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
//     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
//   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
//   at once on this machine; the rest wait their turn.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ...playwrightChromes()];
// Chromium builds Playwright downloaded (~/.cache/ms-playwright/chromium-NNNN), newest first
function playwrightChromes() {
  const dir = `${homedir()}/.cache/ms-playwright`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1])
    .map(n => `${dir}/${n}/chrome-linux64/chrome`);
}
const CHROME = CHROMES.find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: pass --chrome=<path> or set CHROME_PATH'); process.exit(1); }
const fps = +(args.fps || 24), FRAMES_DIR = 'out/frames';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
const times = s => String(s).split(',').map(Number);
const span = s => String(s).split(':').map(Number);
// comma-separated fields, keeping commas inside parentheses ('PLK.MX(1.38),PLK.WL,500,300'); numbers stay numbers
const fields = s => { const out = []; let d = 0, cur = ''; for (const ch of String(s)) { if (ch === ',' && !d) { out.push(cur); cur = ''; continue; } d += ch === '(' ? 1 : ch === ')' ? -1 : 0; cur += ch; } out.push(cur); return out.map(v => isNaN(+v) ? v : +v); };

// JPEG frames decode as full-range (yuvj420p); without this the MP4 is flagged full-range and some players/platforms
// show it washed out or with crushed shadows. Convert to standard (tv) range and say so.
const TV_RANGE = ['-vf', 'scale=out_range=tv', '-pix_fmt', 'yuv420p', '-color_range', 'tv'];

if (args.encode) {
  // no page here, so read PROJECT.audio from the config file (encoding used to drop the music when --audio was left out)
  const cfg = existsSync('src/config.js') ? readFileSync('src/config.js', 'utf8') : '';
  const audio = args.audio || cfg.match(/\baudio\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
  const out = args.out || 'out/video.mp4', n = readdirSync(FRAMES_DIR).filter(f => f.endsWith('.jpg')).length;
  if (audio && !existsSync(audio)) { console.error(`audio file not found: ${audio}`); process.exit(1); }
  console.log(`encoding ${n} frames → ${out}${audio ? ' with ' + audio : ' — WARNING: no audio track (pass --audio or set PROJECT.audio)'}`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES_DIR}/f%05d.jpg`,
    ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', ...TV_RANGE, '-movflags', '+faststart', out]);
  console.log('wrote ' + out);
  process.exit(0);
}

// --soft-gl: no GPU on this machine; render WebGL in software (SwiftShader), which Chrome only allows when asked.
// --gpu-angle=vulkan|gl-egl: headless Linux on an NVIDIA GPU (e.g. a cloud or cluster node); plain --use-gl=angle gets
// no WebGL context there. Check which GPU Chrome actually lands on with gpu_probe.mjs.
const ANGLE = { vulkan: ['--use-angle=vulkan', '--enable-features=Vulkan'], 'gl-egl': ['--use-angle=gl-egl'] };
if (args['gpu-angle'] && !ANGLE[args['gpu-angle']]) { console.error(`--gpu-angle must be one of ${Object.keys(ANGLE)}`); process.exit(1); }
const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : args['gpu-angle'] ? ANGLE[args['gpu-angle']]
  : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
// Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
// A slot whose owner died (its turn was cut off) is taken back.
// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
const BULK = !!(args.frames || args.clip || args.png);
const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function takeSlot() {
  mkdirSync(SLOT_DIR, { recursive: true });
  for (let waited = 0; ; waited++) {
    for (let i = 0; i < SLOTS; i++) {
      const f = `${SLOT_DIR}/slot${i}`;
      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
    }
    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
    await new Promise(r => setTimeout(r, 1000));
  }
}
// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
try {
  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
    const p = `${tmpdir()}/${d}`;
    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
  }
} catch {}
const slot = await takeSlot();
process.on('exit', () => { try { unlinkSync(slot); } catch {} });
let browser;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });

browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
});
async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  await page.goto(pathToFileURL(resolve('studio.html')).href + '?render', { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  if (args.loop) {
    const ok = await page.evaluate(name => { if (!LOOPS[name]) return false; window.LOOP = LOOPS[name]; return true; }, args.loop);
    if (!ok) { console.error(`no loop named "${args.loop}"`); process.exit(1); }
  }
  return page;
}
const frameOf = async (page, t, type, q) => {
  const url = await page.evaluate((t, type, q) => window.renderAt(t, type, q), t, type, q);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
// Frame key = hash(every shared file) + hash(the scene file that draws the frame's shot). Shared: studio.html, src/ outside
// src/scenes/, assets/ (size + mtime). A shot's scene file is the one whose text contains its function. Shots come from
// the page (SHOTS: [start, fn] in time order); a page without SHOTS gets no cache.
async function frameKeyer(fps) {
  const probe = await openPage(), shots = await probe.evaluate(() => (typeof SHOTS !== 'undefined' ? SHOTS.map(s => [s[0], String(s[1])]) : [])); await probe.close();
  if (!shots.length) return () => null;
  const walk = d => existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]) : [];
  const h = createHash('sha1');
  for (const f of ['studio.html', ...walk('src').filter(f => !f.startsWith('src/scenes/')), ...walk('assets')].sort()) {
    const st = statSync(f); h.update(/\.(js|json|html|css)$/.test(f) ? readFileSync(f) : `${f}:${st.size}:${st.mtimeMs}`);
  }
  const shared = h.digest('hex');
  const scenes = walk('src/scenes').map(f => [f, readFileSync(f, 'utf8')]);
  const keys = shots.map(([, src]) => { const own = scenes.find(([, txt]) => txt.includes(src)); return createHash('sha1').update(shared).update(own ? own[1] : src).digest('hex').slice(0, 16); });
  return i => { const t = i / fps; let k = 0; while (k + 1 < shots.length && t >= shots[k + 1][0]) k++; return keys[k]; };
}

// the length of whatever is being rendered: a loop's .len, or the video's duration
const lengthOf = page => page.evaluate(() => window.LOOP ? window.LOOP.len : DUR);

if (args.sheet || args.strip) {
  const page = await openPage(), out = args.out || 'out/sheet.jpg'; mkdirSync(dirname(out), { recursive: true });
  let ts;
  if (args.strip) { const [a, b] = span(args.strip), step = +(args.every || Math.max(1, Math.round(fps / 12))); ts = []; for (let i = Math.round(a * fps); i <= Math.round(b * fps); i += step) ts.push(i / fps); }
  else ts = times(args.sheet);
  const crop = args.crop ? times(args.crop) : null, at = args['crop-at'] ? fields(args['crop-at']) : null;
  const { url, ms } = await page.evaluate((ts, c, w, crop, at) => window.renderSheet(ts, c, w, crop, at), ts, +(args.cols || (args.strip ? 6 : 3)), +(args.w || (args.strip ? 320 : 640)), crop, at);
  writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  console.log(`${out}  (${ts.length} frames)  ms/frame: ${ms.join(' ')}`);
} else if (args.stills) {
  const page = await openPage(), out = args.out || 'out/stills'; mkdirSync(out, { recursive: true });
  console.log('GPU:', await page.evaluate(() => window.gpuInfo()));
  for (const s of times(args.stills)) {
    const t0 = Date.now(), buf = await frameOf(page, s, 'image/png');
    const f = `${out}/t${s.toFixed(2).replace('.', '_')}.png`; writeFileSync(f, buf);
    console.log(`${f}  ${Date.now() - t0} ms`);
  }
} else if (args.png) {
  // PNG sequence (for GIFs): a loop's full cycle (frame n equals frame 0, so it isn't rendered), or --range=a:b.
  const probe = await openPage(), len = await lengthOf(probe); await probe.close();
  const [a, b] = args.range ? span(args.range) : [0, len], n = Math.round((b - a) * fps);
  const out = args.out || `out/${args.loop ? 'loop_' + args.loop : 'png'}`, workers = +(args.workers || 3); mkdirSync(out, { recursive: true });
  let next = 0; const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage('#' + w);
    while (next < n) { const i = next++; writeFileSync(`${out}/f${String(i).padStart(4, '0')}.png`, await frameOf(page, a + i / fps, 'image/png')); }
  }));
  console.log(`${n} frames → ${out}  (${((Date.now() - start) / n).toFixed(0)} ms/frame)`);
} else if (args.frames) {
  // Parallel and resumable: each worker pulls the next missing frame; files are written atomically.
  const probe = await openPage(), len = await lengthOf(probe); await probe.close();
  const [a, b] = args.range ? span(args.range) : [0, len], workers = +(args.workers || 4);
  mkdirSync(FRAMES_DIR, { recursive: true });
  const first = Math.round(a * fps), last = Math.min(Math.ceil(len * fps) - 1, Math.round(b * fps) - 1);
  // cache: each frame remembers the key it was drawn with (shared files + the scene file of its shot); a changed key redraws it
  const keyOf = args.loop || args['no-cache'] ? () => null : await frameKeyer(fps);
  const MAN = `${FRAMES_DIR}/manifest.json`, man = (() => { try { const m = JSON.parse(readFileSync(MAN, 'utf8')); return m.fps === fps ? m.frames : {}; } catch { return {}; } })();
  const saveMan = () => { writeFileSync(MAN + '.tmp', JSON.stringify({ fps, frames: man })); renameSync(MAN + '.tmp', MAN); };
  const todo = []; let stale = 0;
  for (let i = first; i <= last; i++) {
    const f = `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`, k = keyOf(i);
    if (!existsSync(f) || statSync(f).size < 1000) todo.push(i);
    else if (k && man[i] !== k) { todo.push(i); stale++; }
  }
  console.log(`${todo.length} frames to render (${stale} changed since last render, ${last - first + 1 - todo.length} cached), ${workers} workers`);
  let next = 0, done = 0; const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage('#' + w);
    while (next < todo.length) {
      const i = todo[next++], f = `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`;
      const buf = await frameOf(page, i / fps, 'image/jpeg', .94);
      writeFileSync(f + '.tmp', buf); renameSync(f + '.tmp', f);
      const k = keyOf(i); if (k) man[i] = k;
      if (++done % 24 === 0 || done === todo.length) {
        saveMan();
        const el = (Date.now() - start) / 1000;
        console.log(`frame ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame effective  eta ${((todo.length - done) * el / done / 60).toFixed(1)} min`);
      }
    }
  }));
} else if (args.clip) {
  const page = await openPage(), len = await lengthOf(page);
  const [a, b] = args.range ? span(args.range) : typeof args.clip === 'string' ? span(args.clip) : [0, len];
  const audio = args.audio || await page.evaluate(() => PROJECT.audio || '');
  const out = args.out || 'out/clip.mp4'; mkdirSync(dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    ...(audio ? ['-ss', String(a), '-t', String(b - a), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', ...TV_RANGE, '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((b - a) * fps), start = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await frameOf(page, a + i / fps, 'image/jpeg', .93);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 24 === 0 || i === n - 1) console.log(`frame ${i + 1}/${n}  ${((Date.now() - start) / (i + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(`wrote ${out}`);
} else {
  console.log('nothing to do: see the usage notes at the top of render.mjs');
}
// Chrome's shutdown can hang (seen: a finished --frames run sat 7 hours in browser.close(), and everything queued behind
// it waited). Give it 10 s, then exit anyway: the work is already on disk.
await Promise.race([browser.close(), new Promise(r => setTimeout(r, 10000))]);
process.exit(0);
