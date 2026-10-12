// 渲视频：node core/render/video.mjs <demo> [--fps 24] [--workers 3] [--q 'k=v'] [--out <demo>/out/video.mp4] [--size 1920x1080]
// 多个片子并行制作时 workers 用 3（默认），单独渲染可开到 6
// 每个 worker 独立浏览器，JPEG 截图经管道交给 ffmpeg；最后无损拼接
// 设了环境变量 RENDER_SLOTS（整数）时，整机最多同时这么多个整片渲染（slot.mjs）；不设就不限。分段文件放在 --out 旁边各自独有的隐藏目录，渲完（或失败、被中断）就删。
// 同一个 demo 可以并行渲多个版本，但每个版本要有自己的 --out：两个渲染写同一个 --out 会直接报错，不会悄悄互相覆盖。
// <out>.lock 记着占用者的 pid，占用者已不在、或锁文件超过 12 小时没被刷新（pid 被别的进程复用了），都算过期，新渲染接手。
import fs from 'fs'; import path from 'path'; import { spawn, execFileSync } from 'child_process';
import { openDemo, closeServer, requireDemo, takeSize } from './page.mjs';
const args = process.argv.slice(2), { w: W, h: H } = takeSize(args), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = args[0]; requireDemo(dir);
const FPS = +opt('--fps', 24), WK = +opt('--workers', 3), Q = opt('--q', '');
if (!(FPS > 0) || !Number.isInteger(WK) || WK < 1) { console.error('bad --fps / --workers: fps must be > 0, workers an integer ≥ 1'); process.exit(2); }
const out = path.resolve(opt('--out', path.join(dir, 'out', 'video.mp4')));
const outDir = path.dirname(out), base = path.basename(out, path.extname(out));
fs.mkdirSync(outDir, { recursive: true });

// —— 同一个 --out 只能有一个渲染在写：<out>.lock 里记着 pid ——
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const lock = out + '.lock', LOCK_MAX_AGE = 12 * 3600 * 1000;
try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); } catch {
  const other = Number(fs.readFileSync(lock, 'utf8')), age = Date.now() - fs.statSync(lock).mtimeMs;
  if (Number.isInteger(other) && other > 0 && alive(other) && age < LOCK_MAX_AGE) {
    console.error(`another render (pid ${other}) is already writing ${out}. Give this one its own --out.\n` +
      `If no render is running (a crashed one can leave its lock behind), delete ${lock} and run this again.`); process.exit(2);
  }
  fs.writeFileSync(lock, String(process.pid));   // 上一个渲染崩了（或 pid 已被别的进程占用、锁太旧），接手
}
setInterval(() => { try { const n = new Date(); fs.utimesSync(lock, n, n); } catch {} }, 10 * 60 * 1000).unref();   // 长时间的渲染定期刷新，免得被当成过期
// 清掉崩溃遗留的分段目录（里面的 pid 已不在）
for (const n of fs.readdirSync(outDir)) if (n.startsWith(`.${base}_segs-`)) {
  try { const p = Number(fs.readFileSync(path.join(outDir, n, 'pid'), 'utf8')); if (!alive(p)) fs.rmSync(path.join(outDir, n), { recursive: true, force: true }); } catch {}
}
let segDir = null, cleaned = false; const procs = new Set();   // 在跑的 ffmpeg：清理目录前先停掉，免得它们对着已删的目录报错
const cleanup = () => { if (cleaned) return; cleaned = true; for (const p of procs) p.kill('SIGKILL'); if (segDir) fs.rmSync(segDir, { recursive: true, force: true }); try { fs.unlinkSync(lock); } catch {} };
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(128 + (sig === 'SIGINT' ? 2 : 15)); });
const fail = msg => { console.error(msg); cleanup(); process.exit(1); };

const release = process.env.RENDER_SLOTS ? await (await import('./slot.mjs')).acquire() : () => {};   // RENDER_SLOT_HELD=1（外层已占槽）时直接放行
segDir = fs.mkdtempSync(path.join(outDir, `.${base}_segs-`)); fs.writeFileSync(path.join(segDir, 'pid'), String(process.pid));
const probe = await openDemo(dir, { w: W, h: H, q: Q }); const DUR = await probe.page.evaluate(() => window.DUR); await probe.browser.close();
if (!(DUR > 0)) fail(`window.DUR must be a positive number of seconds (got ${DUR})`);
const TOTAL = Math.round(DUR * FPS), per = Math.ceil(TOTAL / WK), t0 = Date.now();
try { await Promise.all([...Array(WK)].map(async (_, w) => {
  const a = w * per, b = Math.min(TOTAL, a + per); if (a >= b) return;
  const { browser, page } = await openDemo(dir, { w: W, h: H, q: Q });
  // cwd 设在分段目录、用相对文件名：路径里有 # ? 之类的字符时 ffmpeg 才不会把它当协议语法
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', `seg_${w}.mp4`], { cwd: segDir, stdio: ['pipe', 'inherit', 'inherit'] });
  procs.add(ff); ff.on('close', () => procs.delete(ff));
  let dead = null;   // ffmpeg 提前退出（缺编码器、磁盘满…）：它自己的报错已打到 stderr，这里只记一笔并停止喂帧
  let done; const closed = new Promise(r => { done = r; }); ff.on('close', code => done(code));
  ff.on('error', e => { dead = e.code === 'ENOENT' ? 'ffmpeg is not installed (or not on PATH)' : e.message; done(-1); });
  ff.stdin.on('error', () => { dead ??= 'ffmpeg closed its input early'; });
  for (let f = a; f < b && !dead; f++) {
    await page.evaluate(t => window.render(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (dead) break;
    if (!ff.stdin.write(buf)) await Promise.race([new Promise(r => ff.stdin.once('drain', r)), closed]);
    if ((f - a) % 60 === 0) console.log(`w${w} ${f - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); const code = await closed; await browser.close();
  if (dead || code !== 0) fail(`ffmpeg failed for worker ${w}: ${dead || 'exit code ' + code} (ffmpeg's own message, if any, is above)`);
})); } catch (e) { fail(`render stopped: ${String(e.message || e).split('\n')[0]}`); }   // 例如页面的 render(t) 抛了错
const list = path.join(segDir, 'segs.txt');
fs.writeFileSync(list, [...Array(WK)].map((_, w) => `file 'seg_${w}.mp4'`).filter((_, w) => w * per < TOTAL).join('\n'));
try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'segs.txt', '-c', 'copy', 'merged.mp4'], { cwd: segDir, stdio: ['ignore', 'inherit', 'inherit'] }); }
catch { fail('ffmpeg could not join the segments (its message is above)'); }
fs.renameSync(path.join(segDir, 'merged.mp4'), out);   // 最终文件名里有什么字符都无所谓：不经过 ffmpeg
cleanup(); release();
console.log('done', out, TOTAL, 'frames', ((Date.now() - t0) / 1000).toFixed(0) + 's');
closeServer();
