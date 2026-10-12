// 整机渲染限流（可选）：同一时间最多 RENDER_SLOTS 个整片渲染；已有渲染在跑、且空闲内存低于 RENDER_MIN_FREE%（默认 30）时排队。
// 只有设了 RENDER_SLOTS 时 video.mjs 才调用它；也可以包住任何命令：node core/render/slot.mjs -- <command…>（不设 RENDER_SLOTS 时按 3 个槽）
// 环境变量：RENDER_SLOTS（整数 ≥1）、RENDER_MIN_FREE（0–100）、RENDER_SLOT_DIR（锁目录，默认 <tmp>/lemo-opuscar-render-slots-<uid>，所有克隆共用，只读仓库也能用）。
//   RENDER_SLOT_HELD=1 表示外层已经占了槽：acquire() 直接放行，slot.mjs -- <cmd> 直接运行命令。
//   所以在一个外层 slot.mjs 里并行起多个 video.mjs 时，它们合起来只占一个槽（想各占一个，就不要包外层）。
// 一个槽位 = 锁目录下的一个目录：里面有 pid（占用者）和 beat（占用者每 15 秒 touch 一次的心跳）。
// 占用者进程不在了（EPERM 算还在）、或心跳超过 90 秒没动，槽位就是过期的，可以被接管。
// 所有"看状态 → 接管/占槽"的动作都在一把极短的互斥锁（.mutex 目录）里做，所以任何时刻一个槽位只有一个持有者。
import fs from 'fs'; import os from 'os'; import path from 'path'; import { spawn, execFileSync } from 'child_process'; import { fileURLToPath } from 'url';

const DIR = process.env.RENDER_SLOT_DIR || path.join(os.tmpdir(), `lemo-opuscar-render-slots-${process.getuid?.() ?? 'u'}`);
const BEAT_EVERY = 15000, STALE_AFTER = 90000, GRACE = 10000;
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const warned = new Set();
const warnOnce = m => { if (!warned.has(m)) { warned.add(m); console.error('[slot] ' + m); } };
function envNum(name, def, ok) {
  const v = process.env[name]; if (v == null || v === '') return def;
  const n = Number(v); if (ok(n)) return n;
  warnOnce(`ignoring ${name}="${v}" (using ${def})`); return def;
}
const alive = pid => {
  if (!Number.isInteger(pid) || pid <= 0) return false;   // kill(0) 会打到整个进程组，必须挡掉
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }   // EPERM = 进程在，只是不是我们的
};
const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
const readPid = d => { try { return Number(fs.readFileSync(path.join(d, 'pid'), 'utf8').trim()); } catch { return NaN; } };
const rmrf = p => { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} };

// 空闲内存百分比；探测不到就当 100（不设门槛）
export function freePct() {
  try {
    if (process.platform === 'darwin') return +(/free percentage:\s*(\d+)/.exec(execFileSync('memory_pressure', { encoding: 'utf8' }))?.[1] ?? 100);
    if (process.platform === 'linux') {
      const m = fs.readFileSync('/proc/meminfo', 'utf8'), avail = /MemAvailable:\s*(\d+)/.exec(m)?.[1], total = /MemTotal:\s*(\d+)/.exec(m)?.[1];
      if (avail && total) return 100 * avail / total;
    }
    return 100 * os.freemem() / os.totalmem();
  } catch { return 100; }
}

// 互斥锁：mkdir 是原子的；持有者只做几次文件操作，超过 10 秒说明它崩在里面了，可以清掉
function withMutex(fn) {
  const m = path.join(DIR, '.mutex');
  for (;;) {
    try { fs.mkdirSync(m); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() - mtime(m) > GRACE) { const t = `${m}.stale-${process.pid}-${Date.now()}`; try { fs.renameSync(m, t); } catch {} rmrf(t); continue; }
      pause(3 + Math.random() * 7);
    }
  }
  try { return fn(); } finally { try { fs.rmdirSync(m); } catch {} }
}

function stale(d) {
  const pid = readPid(d);
  if (!Number.isInteger(pid) || pid <= 0) return Date.now() - mtime(d) > GRACE;   // pid 文件空/坏：刚建的给 10 秒，之后算过期
  if (!alive(pid)) return true;
  return Date.now() - (mtime(path.join(d, 'beat')) || mtime(d)) > STALE_AFTER;
}

export function tryTake(slots, free, minFree) {   // 导出仅供测试
  return withMutex(() => {
    let live = 0; const open = [];
    for (let i = 0; i < slots; i++) {
      const d = path.join(DIR, `slot${i}`);
      if (!fs.existsSync(d)) { open.push(d); continue; }
      if (stale(d)) { const t = `${d}.stale-${process.pid}-${Date.now()}`; try { fs.renameSync(d, t); } catch { live++; continue; } rmrf(t); open.push(d); } else live++;
    }
    if (!open.length) return null;
    if (live > 0 && free < minFree) return null;   // 一个渲染都没在跑时永远放行，内存门槛只管"再多开一个"
    const d = open[0]; fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, 'pid'), String(process.pid)); fs.writeFileSync(path.join(d, 'beat'), '');
    return d;
  });
}

export async function acquire({ slots, minFree } = {}) {
  if (process.env.RENDER_SLOT_HELD === '1') return () => {};
  slots ??= envNum('RENDER_SLOTS', 3, n => Number.isInteger(n) && n >= 1 && n <= 256);
  minFree ??= envNum('RENDER_MIN_FREE', 30, n => Number.isFinite(n) && n >= 0 && n <= 100);
  fs.mkdirSync(DIR, { recursive: true });
  for (let waited = 0; ; waited++) {
    const d = tryTake(slots, freePct(), minFree);
    if (d) {
      const timer = setInterval(() => { try { const n = new Date(); fs.utimesSync(path.join(d, 'beat'), n, n); } catch {} }, BEAT_EVERY); timer.unref();
      let done = false;
      const release = () => {
        if (done) return; done = true; clearInterval(timer);
        if (readPid(d) === process.pid) { const t = `${d}.rel-${process.pid}-${Date.now()}`; try { fs.renameSync(d, t); rmrf(t); } catch { rmrf(d); } }   // 只删自己的（被接管后不动别人的）
      };
      process.on('exit', release);
      return release;
    }
    if (waited % 30 === 0) console.log(`waiting for a render slot (max ${slots}, free memory ≥ ${minFree}% while others render)…`);
    await new Promise(r => setTimeout(r, 2000));
  }
}

const real = p => { try { return fs.realpathSync(p); } catch { return p; } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  const i = process.argv.indexOf('--'), cmd = i >= 0 ? process.argv.slice(i + 1) : [];
  if (!cmd.length) { console.error('usage: node core/render/slot.mjs -- <command…>'); process.exit(2); }
  const release = await acquire();
  const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', env: { ...process.env, RENDER_SLOT_HELD: '1' } });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
  child.on('error', e => { console.error(`cannot run ${cmd[0]}: ${e.message}`); release(); process.exit(127); });
  child.on('exit', (code, sig) => { release(); process.exit(code ?? (sig ? 128 + (os.constants.signals[sig] || 1) : 0)); });
}
