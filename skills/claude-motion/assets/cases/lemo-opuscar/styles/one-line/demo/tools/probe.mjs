// 打印每段、每个 part 在段内的弧长比例，以及每 0.25s 的笔尖位置/速度
import { chromium } from 'playwright-core';
import { serve } from '../../../../core/render/serve.mjs';
import { EXE, ARGS } from '../../../../core/render/browser.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { server, port } = await serve(ROOT);
const b = await chromium.launch({ executablePath: EXE, args: ARGS });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => { console.error(e.message); process.exit(1); }); p.on('console', m => console.log('[page]', m.text()));
await p.goto(`http://127.0.0.1:${port}/styles/one-line/demo/index.html?nosub=1`);
await p.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
const r = await p.evaluate((step) => {
  const P = window.PATH, out = { parts: [], track: [], segs: [] };
  P.segs.forEach((s, i) => { const [a, bb] = P.range[i]; out.segs.push({ id: s.id, t: s.t, len: +(P.S[bb] - P.S[a]).toFixed(1) }); });
  for (const q of P.PARTS) { const [a, bb] = P.range[q.seg]; out.parts.push({ seg: P.segs[q.seg].id, part: q.part, f: +((P.S[q.i] - P.S[a]) / (P.S[bb] - P.S[a])).toFixed(3), t: +P.T[q.i].toFixed(2) }); }
  for (let t = 0; t <= 47.5; t += step) { let lo = 0, hi = P.N - 1; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (P.T[m] <= t) lo = m; else hi = m; } out.track.push([+t.toFixed(2), Math.round(P.X[lo]), Math.round(P.Y[lo]), Math.round(P.V[lo]), P.segs[P.SEG[lo]].id]); }
  return out;
}, parseFloat(process.argv[2] || '0.5'));
console.log(JSON.stringify(r.segs)); for (const q of r.parts) console.log('part', JSON.stringify(q));
if (process.argv[3] !== 'noTrack') for (const t of r.track) console.log(t.join('\t'));
await b.close(); server.close();
